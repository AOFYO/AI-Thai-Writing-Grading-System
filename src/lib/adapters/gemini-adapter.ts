import { GoogleGenAI } from '@google/genai';
import { PromptPayload } from '../prompt-builder';

export async function callGeminiModel(
  modelId: string,
  payload: PromptPayload,
  retryFeedback?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey });
  const contentParts: any[] = [];

  if (payload.imageBase64 && payload.imageMimeType) {
    contentParts.push({
      inlineData: {
        data: payload.imageBase64,
        mimeType: payload.imageMimeType
      }
    });
  }

  let prompt = payload.userPromptText;
  if (retryFeedback) {
    prompt += `\n\n[ข้อผิดพลาดจากรอบก่อนหน้า]\n${retryFeedback}\nกรุณาแก้ไขและตอบกลับเป็น Pure JSON เท่านั้น`;
  }
  contentParts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: modelId,
    contents: [{ role: 'user', parts: contentParts }],
    config: {
      systemInstruction: payload.systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  return response.text || '';
}
