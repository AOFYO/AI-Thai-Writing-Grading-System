import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { originalResult, editedScores, teacherComments, rubricData } = await req.json();

    const prompt = `
คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์พฤติกรรมการตรวจข้อสอบ
หน้าที่ของคุณคือ: เปรียบเทียบผลการตรวจเดิมของ AI กับ "คะแนนและคอมเมนต์ที่ครูแก้ไข" จากนั้นให้สกัด "สไตล์การตรวจเฉพาะตัวของครูท่านนี้" ออกมาเป็นคำสั่ง (Prompt) สั้นๆ กระชับ 1-3 ประโยค เพื่อให้ AI นำไปใช้เป็นกฎในการตรวจครั้งต่อไป

[ข้อมูลเกณฑ์การให้คะแนน (Rubric)]
${JSON.stringify(rubricData.criteria.map((c:any) => ({ id: c.id, name: c.name, max: c.raw_score || c.max_score })))}

[ผลการตรวจเดิมของ AI]
${JSON.stringify(originalResult.evaluation)}

[สิ่งที่ครูแก้ไข (คะแนนใหม่ & คอมเมนต์ของครู)]
คะแนนใหม่: ${JSON.stringify(editedScores)}
คอมเมนต์ของครู: ${JSON.stringify(teacherComments)}

จงวิเคราะห์ว่าครูท่านนี้มีสไตล์อย่างไร (เช่น ใจดีขึ้น, เข้มงวดเรื่องใดเป็นพิเศษ, ให้อภัยจุดไหน) 
และเขียนกลับมาเฉพาะ "ข้อความคำสั่ง (Prompt)" เท่านั้น ห้ามมีคำเกริ่นนำใดๆ ทั้งสิ้น
ตัวอย่างเอาต์พุต: "เน้นความสร้างสรรค์ หากนักเรียนเขียนวกวนแต่มีไอเดียแปลกใหม่ ไม่ต้องหักคะแนน แต่จะหักคะแนนหนักหากสะกดคำผิดพลาดเกิน 3 คำ"
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7
      }
    });

    const skillText = response.text?.trim() || "";
    return NextResponse.json({ skillText });
    
  } catch (error: any) {
    console.error("Error extracting skill:", error);
    return NextResponse.json({ error: error.message || 'Failed to extract skill' }, { status: 500 });
  }
}
