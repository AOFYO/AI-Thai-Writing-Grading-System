import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์และสกัดข้อมูลตารางเกณฑ์การประเมิน (Rubric) แบบละเอียด
จงสกัดข้อมูลทั้งหมดจากภาพตารางและแปลงเป็นโครงสร้าง JSON อย่างครบถ้วน

{
  "title": "ชื่อหัวข้อการประเมิน (เช่น ฉบับที่ 2 การเขียน การเขียนแสดงความคิดเห็น)",
  "description": "บริบทของงานเขียน คำชี้แจง เงื่อนไขต่างๆ (เช่น ต้องเขียน 12-15 บรรทัด ตัวบรรจงครึ่งบรรทัด สมมติว่าความยาวและลายมือผ่านเกณฑ์ยกเว้นจะระบุเป็นอย่างอื่น)",
  "criteria": [
    {
      "id": "c1",
      "name": "ชื่อหัวข้อ (เช่น การตั้งชื่อเรื่อง)",
      "max_score": 5,
      "description": "คำอธิบายวิธีการให้คะแนนอย่างละเอียดครบถ้วนที่สุด"
    }
  ]
}

กฎเหล็กในการสร้าง "description" และ "max_score":
1. การคิดคะแนนเต็ม (max_score): หากในตารางมีการระบุ "น้ำหนัก" (เช่น น้ำหนัก 3) ให้คำนวณ max_score = (คะแนนสูงสุดในระดับคะแนน) x น้ำหนัก
2. ในฟิลด์ "description" ของแต่ละ criteria คุณต้องรวบรวมข้อมูลต่อไปนี้ทั้งหมดมาเรียบเรียงเป็นคำสั่ง:
   - (ก) "น้ำหนักคะแนน": ระบุว่าหัวข้อนี้คูณน้ำหนักเท่าไร และคะแนนเต็มคืออะไร (เช่น น้ำหนัก x3 | คะแนนเต็ม 15)
   - (ข) "เกณฑ์ย่อย": ระบุรายการย่อยที่ต้องพิจารณาทั้งหมด (เช่น 1. สื่อความหมาย 2. ใช้คำถูกต้อง 3. น่าสนใจ 4. กระชับ)
   - (ค) "วิธีการให้คะแนน": อธิบายให้ชัดเจนว่าได้คะแนนดิบ 5, 4, 3, 2, 1 ต้องเข้าเงื่อนไขกี่ข้อ หรือทำอะไรได้บ้าง (เช่น ได้ 5 คะแนน: ทำได้ครบ 4 ข้อ)
   - (ง) "เงื่อนไขพิเศษ": เช่น "เขียนผิดซ้ำ ให้นับเป็น 1 คำ"
3. อธิบายใน description ให้ชัดเจนเสมือนกำลังป้อน Prompt ให้ AI อีกตัวใช้เป็นเกณฑ์ตรวจข้อสอบ ห้ามตกหล่นตรรกะการนับคะแนน
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
                { text: "จงสกัดข้อมูลตารางเกณฑ์ประเมินจากภาพนี้และตอบกลับมาเป็นโครงสร้าง JSON" }
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
      throw new Error(`ระบบ AI คิวเต็ม โปรดลองใหม่ในภายหลัง (Error: ${lastError})`);
    }

    const resultText = response.text || "{}";
    return NextResponse.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error extracting rubric:", error);
    return NextResponse.json({ error: error.message || 'Failed to extract rubric' }, { status: 500 });
  }
}
