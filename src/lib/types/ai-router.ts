export type AIProvider = 'gemini' | 'openrouter';

export interface ModelRouteItem {
  provider: AIProvider;
  modelId: string;
  name: string;
  isFree?: boolean;
}

export interface CircuitBreakerState {
  [modelId: string]: {
    consecutiveFailures: number;
    degradedUntil?: number; // timestamp in ms
  };
}

export interface AIConfig {
  activeRoute: AIProvider;
  activeModelId: string;
  fallbackEnabled: boolean;
  fallbackChain: ModelRouteItem[];
  circuitBreaker?: CircuitBreakerState;
  updatedAt?: string;
  updatedBy?: string;
}

export interface GradeRequestParams {
  imageUrl?: string;
  overrideText?: string;
  rubricData: any;
  customStylePrompt?: string;
  userId?: string;
  assignmentId?: string;
  studentNumber?: number;
}

export interface GradingResult {
  transcribed_text: string;
  ocr_confidence_percent: number;
  needs_human_review: boolean;
  evaluation: Record<string, { score: number; reason: string; teacher_comment?: string }>;
  total_raw_score: number;
  teacher_feedback: string;
  used_model: string;
  used_provider: AIProvider;
  latency_ms: number;
  log_id?: string;
}

export interface ModelUsageLog {
  id?: string;
  timestamp: string;
  userId: string;
  assignmentId: string;
  studentNumber: number;
  provider: AIProvider;
  modelId: string;
  routeType: 'primary' | 'fallback';
  latencyMs: number;
  success: boolean;
  errorMessage?: string | null;
  usedFallback: boolean;
  aiConfidence: number;
  totalRawScore: number;
  wasOverridden: boolean;
  overrideScore?: number | null;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  activeRoute: 'gemini',
  activeModelId: 'gemini-3.8-flash',
  fallbackEnabled: true,
  fallbackChain: [
    { provider: 'gemini', modelId: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', isFree: true },
    { provider: 'openrouter', modelId: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B (Free)', isFree: true },
    { provider: 'openrouter', modelId: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (Free)', isFree: true },
    { provider: 'openrouter', modelId: 'openrouter/free', name: 'OpenRouter Free Auto-select', isFree: true },
    { provider: 'gemini', modelId: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Rescue)', isFree: true },
  ],
  circuitBreaker: {}
};

export const AVAILABLE_MODELS: Record<AIProvider, { id: string; name: string; isFree: boolean; contextLength: string }[]> = {
  gemini: [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (แนะนำ - เร็วและฉลาดสุด)', isFree: true, contextLength: '1M' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (เสถียรสูง)', isFree: true, contextLength: '1M' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', isFree: true, contextLength: '1M' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (เร็วและประหยัด)', isFree: true, contextLength: '1M' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Legacy)', isFree: true, contextLength: '1M' },
  ],
  openrouter: [
    { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B (Free - รองรับ Vision & ภาษาไทยดี)', isFree: true, contextLength: '262K' },
    { id: 'google/gemma-4-31b-it:free', name: 'Google Gemma 4 31B (Free - Vision)', isFree: true, contextLength: '262K' },
    { id: 'google/gemma-4-26b-a4b-it:free', name: 'Google Gemma 4 26B (Free - Vision)', isFree: true, contextLength: '262K' },
    { id: 'openrouter/free', name: 'OpenRouter Free Auto-Route (เลือกตัวฟรีที่ดีที่สุดอัตโนมัติ)', isFree: true, contextLength: '200K' },
  ]
};
