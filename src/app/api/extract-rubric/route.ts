import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์ตารางเกณฑ์การประเมิน (Rubric) จากรูปภาพ
จงดึงข้อมูลเกณฑ์การประเมินจากภาพที่ผู้ใช้อัปโหลด และแปลงเป็นรูปแบบ JSON ตามโครงสร้างด้านล่างนี้เท่านั้น ห้ามมีข้อความอื่น:

{
  "title": "ชื่อของงานหรือเกณฑ์ประเมิน (เช่น รักษ์ภาษาไทย, การเขียนเรียงความ)",
  "description": "คำอธิบายภาพรวม (ถ้ามี)",
  "criteria": [
    {
      "id": "c1",
      "name": "ชื่อหัวข้อการประเมิน (เช่น การตั้งชื่อเรื่อง)",
      "max_score": 5,
      "description": "เงื่อนไขการให้คะแนนอย่างละเอียด"
    },
    ... (เพิ่มจนครบทุกหัวข้อที่อยู่ในภาพ)
  ]
}
หมายเหตุ: max_score ต้องเป็นตัวเลขเสมอ
`;

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    const imageResp = await fetch(imageUrl);
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';

    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];
    let response;
    let lastError = "";

    for (const modelName of fallbackModels) {
      try {
        console.log(`[Rubric Extractor] Attempting with ${modelName}...`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: "ดึงข้อมูลโครงสร้างเกณฑ์การประเมินจากภาพนี้ให้อยู่ในรูป JSON" }
              ]
            }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.1
          }
        });
        break; 
      } catch (err: any) {
        console.warn(`[Rubric Extractor] Model ${modelName} failed:`, err.message);
        lastError = err.message;
      }
    }

    if (!response) {
      throw new Error(`ระบบ AI คิวเต็มทุกรุ่น กรุณาลองใหม่ในภายหลัง (Error: ${lastError})`);
    }

    const resultText = response.text || "{}";
    return NextResponse.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error extracting rubric:", error);
    return NextResponse.json({ error: error.message || 'Failed to extract rubric' }, { status: 500 });
  }
}
