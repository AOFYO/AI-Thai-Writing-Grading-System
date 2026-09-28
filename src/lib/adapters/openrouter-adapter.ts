import { PromptPayload } from '../prompt-builder';

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

  // Attempt with standard payload
  const makeRequest = async (useJsonMode: boolean) => {
    const body: any = {
      model: modelId,
      messages,
      temperature: 0.1
    };
    if (useJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

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
  };

  try {
    return await makeRequest(true);
  } catch (err: any) {
    // If the error was due to response_format not supported by this specific model, retry without it
    if (err.message && (err.message.includes('response_format') || err.message.includes('json_object'))) {
      console.warn(`[OpenRouter] ${modelId} does not support response_format: json_object, retrying with raw prompt...`);
      return await makeRequest(false);
    }
    throw err;
  }
}
