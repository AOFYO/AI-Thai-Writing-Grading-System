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
  activeModelId: 'gemini-3.5-flash-lite', // 500 RPD, 15 RPM, high throughput & fast
  fallbackEnabled: true,
  fallbackChain: [
    { provider: 'gemini', modelId: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (สำรอง 500 RPD)', isFree: true },
    { provider: 'openrouter', modelId: 'dots-studio/dots-3-note-preview:free', name: 'Dots3 Note Preview (Free อันดับ 1)', isFree: true },
    { provider: 'openrouter', modelId: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B (Free)', isFree: true },
    { provider: 'openrouter', modelId: 'thinkingmachines/inkling:free', name: 'Inkling (Free Context 1M)', isFree: true },
    { provider: 'gemini', modelId: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (ฉลาดสุด 20 RPD)', isFree: true },
    { provider: 'openrouter', modelId: 'openrouter/free', name: 'OpenRouter Free Auto-select (ฉุกเฉิน)', isFree: true },
    { provider: 'gemini', modelId: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Rescue Net)', isFree: true },
  ],
  circuitBreaker: {}
};

export const AVAILABLE_MODELS: Record<AIProvider, { id: string; name: string; isFree: boolean; contextLength: string }[]> = {
  gemini: [
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (แนะนำ - 500 ครั้ง/วัน, 15 RPM)', isFree: true, contextLength: '1M' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (สำรอง - 500 ครั้ง/วัน, 15 RPM)', isFree: true, contextLength: '1M' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (ฉลาดที่สุด - 20 ครั้ง/วัน)', isFree: true, contextLength: '1M' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (เสถียรสูง - 20 ครั้ง/วัน)', isFree: true, contextLength: '1M' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (20 ครั้ง/วัน)', isFree: true, contextLength: '1M' },
  ],
  openrouter: [
    { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots3 Note Preview (Free - ยอดนิยมอันดับ 1 สำหรับเอกสาร)', isFree: true, contextLength: '512K' },
    { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B (Free - รองรับ Vision & ภาษาไทยดี)', isFree: true, contextLength: '262K' },
    { id: 'thinkingmachines/inkling:free', name: 'Thinking Machines Inkling (Free - Context 1M)', isFree: true, contextLength: '1M' },
    { id: 'openrouter/free', name: 'OpenRouter Free Auto-Route (เลือกตัวฟรีที่ดีที่สุดอัตโนมัติ)', isFree: true, contextLength: '200K' },
  ]
};
