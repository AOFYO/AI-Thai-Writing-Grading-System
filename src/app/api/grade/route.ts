import { NextResponse } from 'next/server';
import { gradeWithActiveModel } from '@/lib/model-router';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageUrl, rubricData, customStylePrompt, overrideText, userId, assignmentId, studentNumber } = body;

    if (!imageUrl && !overrideText) {
      return NextResponse.json({ error: 'No image URL or text provided' }, { status: 400 });
    }

    const result = await gradeWithActiveModel({
      imageUrl,
      rubricData,
      customStylePrompt,
      overrideText,
      userId,
      assignmentId,
      studentNumber
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/grade] Error evaluating exam:', error);
    return NextResponse.json({ error: error.message || 'Failed to process' }, { status: 500 });
  }
}
