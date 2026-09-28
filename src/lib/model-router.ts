import { db } from './firebase';
import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import {
  AIConfig,
  DEFAULT_AI_CONFIG,
  GradeRequestParams,
  GradingResult,
  ModelRouteItem
} from './types/ai-router';
import { buildGradingPrompts } from './prompt-builder';
import { parseAndValidateGradingJSON } from './json-sanitizer';
import { callGeminiModel } from './adapters/gemini-adapter';
import { callOpenRouterModel } from './adapters/openrouter-adapter';

// In-memory circuit breaker tracker
interface BreakerStatus {
  consecutiveFailures: number;
  degradedUntil: number; // timestamp
}
const circuitBreakerState: Record<string, BreakerStatus> = {};
const DEGRADED_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function getAIConfig(): Promise<AIConfig> {
  try {
    const configSnap = await getDoc(doc(db, 'settings', 'ai_config'));
    if (configSnap.exists()) {
      return { ...DEFAULT_AI_CONFIG, ...configSnap.data() } as AIConfig;
    }
  } catch (err) {
    console.warn('[ModelRouter] Failed to fetch settings/ai_config from Firestore, using default:', err);
  }
  return DEFAULT_AI_CONFIG;
}

export async function saveAIConfig(config: Partial<AIConfig>, adminEmail?: string): Promise<void> {
  const current = await getAIConfig();
  const updated: AIConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail || 'admin'
  };

  await setDoc(doc(db, 'settings', 'ai_config'), updated);
}

function isModelDegraded(modelId: string): boolean {
  const status = circuitBreakerState[modelId];
  if (!status) return false;
  if (Date.now() < status.degradedUntil) {
    return true;
  }
  return false;
}

function recordModelFailure(modelId: string) {
  if (!circuitBreakerState[modelId]) {
    circuitBreakerState[modelId] = { consecutiveFailures: 0, degradedUntil: 0 };
  }
  circuitBreakerState[modelId].consecutiveFailures += 1;
  if (circuitBreakerState[modelId].consecutiveFailures >= 3) {
    circuitBreakerState[modelId].degradedUntil = Date.now() + DEGRADED_DURATION_MS;
    console.warn(`[Circuit Breaker] Model ${modelId} marked DEGRADED for 15 minutes due to 3 consecutive failures.`);
  }
}

function recordModelSuccess(modelId: string) {
  if (circuitBreakerState[modelId]) {
    circuitBreakerState[modelId].consecutiveFailures = 0;
    circuitBreakerState[modelId].degradedUntil = 0;
  }
}

export async function gradeWithActiveModel(params: GradeRequestParams): Promise<GradingResult> {
  const config = await getAIConfig();
  const promptPayload = await buildGradingPrompts(
    params.rubricData,
    params.customStylePrompt,
    params.imageUrl,
    params.overrideText
  );

  // Build ordered candidate list
  const candidates: ModelRouteItem[] = [];
  candidates.push({
    provider: config.activeRoute,
    modelId: config.activeModelId,
    name: `Primary (${config.activeModelId})`
  });

  if (config.fallbackEnabled && config.fallbackChain && config.fallbackChain.length > 0) {
    for (const item of config.fallbackChain) {
      if (!candidates.some(c => c.modelId === item.modelId)) {
        candidates.push(item);
      }
    }
  }

  // Safety net: Ensure at least one Gemini rescue model exists at the very end
  if (!candidates.some(c => c.modelId === 'gemini-3.5-flash-lite')) {
    candidates.push({
      provider: 'gemini',
      modelId: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash-Lite (Emergency Rescue)'
    });
  }

  let lastError: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const isPrimary = i === 0;

    // Check circuit breaker (skip degraded unless it's the last remaining option)
    if (isModelDegraded(candidate.modelId) && i < candidates.length - 1) {
      console.warn(`[ModelRouter] Skipping degraded model: ${candidate.modelId}`);
      continue;
    }

    const startTime = Date.now();
    console.log(`[ModelRouter] Attempting grading with [${candidate.provider}] ${candidate.modelId}...`);

    try {
      let rawResponse = '';
      if (candidate.provider === 'gemini') {
        rawResponse = await callGeminiModel(candidate.modelId, promptPayload);
      } else if (candidate.provider === 'openrouter') {
        rawResponse = await callOpenRouterModel(candidate.modelId, promptPayload);
      } else {
        throw new Error(`Unsupported AI Provider: ${candidate.provider}`);
      }

      // Validate JSON Output
      let validation = parseAndValidateGradingJSON(rawResponse, promptPayload.expectedCriteriaIds);

      // Self-Healing Retry (1-time) if JSON validation failed
      if (!validation.success) {
        console.warn(`[ModelRouter] Initial JSON validation failed for ${candidate.modelId}: ${validation.error}. Retrying with self-healing feedback...`);
        let retryResponse = '';
        if (candidate.provider === 'gemini') {
          retryResponse = await callGeminiModel(candidate.modelId, promptPayload, validation.error);
        } else if (candidate.provider === 'openrouter') {
          retryResponse = await callOpenRouterModel(candidate.modelId, promptPayload, validation.error);
        }

        validation = parseAndValidateGradingJSON(retryResponse, promptPayload.expectedCriteriaIds);
      }

      if (!validation.success) {
        throw new Error(`JSON Schema Failure: ${validation.error}`);
      }

      // Success!
      const latencyMs = Date.now() - startTime;
      recordModelSuccess(candidate.modelId);
      console.log(`[ModelRouter] Successfully graded with ${candidate.modelId} in ${latencyMs}ms`);

      const resultData = validation.data;

      // Log usage asynchronously to Firestore
      let logId: string | undefined;
      try {
        const logDoc = await addDoc(collection(db, 'model_usage_logs'), {
          timestamp: new Date().toISOString(),
          userId: params.userId || 'anonymous',
          assignmentId: params.assignmentId || 'unknown',
          studentNumber: params.studentNumber || 0,
          provider: candidate.provider,
          modelId: candidate.modelId,
          routeType: isPrimary ? 'primary' : 'fallback',
          latencyMs,
          success: true,
          errorMessage: null,
          usedFallback: !isPrimary,
          aiConfidence: resultData.ocr_confidence_percent || 0,
          totalRawScore: resultData.total_raw_score || 0,
          wasOverridden: false,
          overrideScore: null
        });
        logId = logDoc.id;
      } catch (logErr) {
        console.warn('[ModelRouter] Failed to record usage log:', logErr);
      }

      return {
        ...resultData,
        used_model: candidate.modelId,
        used_provider: candidate.provider,
        latency_ms: latencyMs,
        log_id: logId
      };
    } catch (err: any) {
      lastError = err;
      recordModelFailure(candidate.modelId);
      console.warn(`[ModelRouter] Model ${candidate.modelId} failed: ${err.message}. Cascading to next candidate...`);

      // Log failure attempt to Firestore
      try {
        await addDoc(collection(db, 'model_usage_logs'), {
          timestamp: new Date().toISOString(),
          userId: params.userId || 'anonymous',
          assignmentId: params.assignmentId || 'unknown',
          studentNumber: params.studentNumber || 0,
          provider: candidate.provider,
          modelId: candidate.modelId,
          routeType: isPrimary ? 'primary' : 'fallback',
          latencyMs: Date.now() - startTime,
          success: false,
          errorMessage: err.message || 'Unknown error',
          usedFallback: !isPrimary,
          aiConfidence: 0,
          totalRawScore: 0,
          wasOverridden: false,
          overrideScore: null
        });
      } catch {}
    }
  }

  throw new Error(`ระบบ AI ทุกตัวในเส้นทางสำรองเกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง (Error: ${lastError?.message || 'All models failed'})`);
}
