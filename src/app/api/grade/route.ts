import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `ระบบเกณฑ์เก่าไม่ได้ใช้งานแล้ว ขอให้ใช้จาก dynamic rubric เท่านั้น`;

export async function POST(req: Request) {
  try {
    const { imageUrl, rubricData, customStylePrompt } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    let currentSystemInstruction = SYSTEM_INSTRUCTION;
    
    if (rubricData && rubricData.criteria) {
      const criteriaText = rubricData.criteria
        .map((c: any) => {
          const weightInfo = c.weight ? ` | น้ำหนัก x${c.weight} | คะแนนเต็มรวม ${c.max_score}` : ` | คะแนนเต็ม ${c.max_score}`;
          return `- ${c.name} (คะแนนดิบสูงสุด ${c.raw_score || c.max_score}${weightInfo}):\n  คำชี้แจง: ${c.description}`;
        })
        .join('\n\n');
        
      const jsonSchemaEval = rubricData.criteria
        .map((c: any) => `"${c.id}": {"score": 0, "reason": ""}`)
        .join(',\n    ');

      const customStyleSection = customStylePrompt ? `\n[สไตล์การตรวจเฉพาะตัวของครู (Custom Skill / Persona)]\n${customStylePrompt}\n` : '';

      currentSystemInstruction = `
คุณคือ "ครูผู้เชี่ยวชาญด้านภาษาไทย" หน้าที่ของคุณคือการประเมินและให้คะแนนงานเขียนของนักเรียนอย่างละเอียด ยุติธรรม และเป็นกลางที่สุด 
โดยอ้างอิงจาก "เกณฑ์การให้คะแนน (Rubric Scores)" ที่กำหนดไว้อย่างเคร่งครัด
${customStyleSection}

[บริบทของงานเขียน]
หัวข้อ: ${rubricData.title}
เงื่อนไขที่นักเรียนต้องทำ: ${rubricData.description || "-"}

# Instruction (คำสั่ง)
1. อ่านข้อความลายมือจากภาพอย่างละเอียด
2. ประเมิน "เปอร์เซ็นต์ความมั่นใจในการอ่าน (ocr_confidence_percent)" 0-100% หากความมั่นใจต่ำกว่า 85% ให้ตั้งค่า "needs_human_review" เป็น true
3. ประเมินและให้คะแนนแยกตามเกณฑ์ (Rubric) ต่อไปนี้อย่างเคร่งครัด:
${criteriaText}

4. กฎเหล็กในการเขียน "reason" (เหตุผลประกอบการประเมิน) สำหรับแต่ละเกณฑ์:
   - คุณต้องวิเคราะห์ทีละข้อ โดยระบุให้ชัดเจนว่า "ตรวจพบว่าตรงกับเกณฑ์ย่อยข้อใดบ้าง" หรือ "พลาดเกณฑ์ย่อยข้อใด"
   - ต้องแสดงสูตรการคิดคะแนนในบรรทัดสุดท้ายของ reason เสมอ ในรูปแบบ: "คะแนนดิบ [X] x น้ำหนัก [Y] = [Z] คะแนน"
   - (หากเกณฑ์ไหนไม่มีน้ำหนัก ให้ระบุแค่คะแนนที่ได้)
5. คำนวณคะแนนรวมที่ได้ทั้งหมดใส่ใน "total_raw_score"
6. เขียนคำชมหรือข้อเสนอแนะสั้นๆ ใส่ใน "teacher_feedback"
7. ตอบกลับเป็นรูปแบบ JSON ตามโครงสร้างด้านล่างนี้เท่านั้น

# Output JSON Schema
{
  "transcribed_text": "ข้อความที่นักเรียนเขียนทั้งหมด (เว้นวรรคและย่อหน้าให้ตรงตามภาพ)",
  "ocr_confidence_percent": 0,
  "needs_human_review": false,
  "evaluation": {
    ${jsonSchemaEval}
  },
  "total_raw_score": 0,
  "teacher_feedback": ""
}
`;
    }

    const imageResp = await fetch(imageUrl);
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';

    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];
    let response;
    let successfulModel = '';

    for (const modelName of fallbackModels) {
      try {
        console.log(`Attempting to grade with ${modelName}...`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: "จงประเมินกระดาษคำตอบแผ่นนี้ตามเกณฑ์และตอบกลับเป็น JSON" }
              ]
            }
          ],
          config: {
            systemInstruction: currentSystemInstruction,
            responseMimeType: "application/json",
            temperature: 0.1
          }
        });
        
        successfulModel = modelName;
        break;
      } catch (err: any) {
        console.warn(`[Fallback Chain] Model ${modelName} failed:`, err.message);
        if (modelName === fallbackModels[fallbackModels.length - 1]) {
          throw new Error(`ระบบ AI ทุกตัวคิวเต็ม กรุณาลองใหม่ในภายหลัง (Error: ${err.message})`);
        }
      }
    }

    if (!response) {
      throw new Error('ไม่สามารถเชื่อมต่อ AI ได้');
    }

    const resultText = response.text || "{}";
    const parsedData = JSON.parse(resultText);
    parsedData.used_model = successfulModel;

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Error evaluating exam:", error);
    return NextResponse.json({ error: error.message || 'Failed to process' }, { status: 500 });
  }
}
