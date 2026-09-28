import { NextResponse } from 'next/server';
import { callGeminiModel } from '@/lib/adapters/gemini-adapter';
import { callOpenRouterModel } from '@/lib/adapters/openrouter-adapter';
import { PromptPayload } from '@/lib/prompt-builder';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { provider, modelId } = await req.json();

    if (!provider || !modelId) {
      return NextResponse.json({ error: 'Missing provider or modelId' }, { status: 400 });
    }

    const testPayload: PromptPayload = {
      systemInstruction: 'You are a test agent. Respond only with valid JSON: {"status": "ok", "message": "Connection verified"}',
      userPromptText: 'Test connection. Output JSON now.',
      expectedCriteriaIds: []
    };

    const startTime = Date.now();
    let responseText = '';

    if (provider === 'gemini') {
      responseText = await callGeminiModel(modelId, testPayload);
    } else if (provider === 'openrouter') {
      responseText = await callOpenRouterModel(modelId, testPayload);
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      latencyMs,
      responsePreview: responseText.slice(0, 100)
    });
  } catch (error: any) {
    console.error('Test Model Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Connection test failed'
    }, { status: 500 });
  }
}
