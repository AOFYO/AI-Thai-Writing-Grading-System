import { PromptPayload } from '../prompt-builder';

const OPENROUTER_TIMEOUT_MS = 25000; // 25 seconds timeout guard

export async function callOpenRouterModel(
  modelId: string,
  payload: PromptPayload,
  retryFeedback?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in environment variables');
  }

  let prompt = payload.userPromptText;
  if (retryFeedback) {
    prompt += `\n\n[ข้อผิดพลาดจากรอบก่อนหน้า]\n${retryFeedback}\nกรุณาแก้ไขและตอบกลับเป็น Pure JSON เท่านั้น`;
  }

  const userContent: any[] = [{ type: 'text', text: prompt }];

  if (payload.imageBase64 && payload.imageMimeType) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${payload.imageMimeType};base64,${payload.imageBase64}`
      }
    });
  }

  const messages = [
    { role: 'system', content: payload.systemInstruction },
    { role: 'user', content: userContent }
  ];

  const headers = {
    'Authorization': `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://ai-thai-writing-grading-system.vercel.app',
    'X-Title': 'AI Thai Writing Grading System'
  };

  // Setup AbortController for 25-second timeout guard
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const body: any = {
      model: modelId,
      messages,
      temperature: 0.1
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(`OpenRouter Error (${modelId}): ${errMsg}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`Empty response from OpenRouter model ${modelId}`);
    }

    return content;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`OpenRouter model ${modelId} timed out after 25s. Fallback triggered.`);
    }
    throw err;
  }
}
