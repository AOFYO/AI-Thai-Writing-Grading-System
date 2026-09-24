import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
# Role (บทบาท)
คุณคือ "ผู้ช่วยครูวิชาภาษาไทยระดับมัธยมศึกษา" ผู้เชี่ยวชาญด้านการตรวจข้อสอบอัตนัย หน้าที่ของคุณคือการอ่านกระดาษคำตอบจากภาพถ่าย สกัดข้อความที่นักเรียนเขียน และประเมินให้คะแนนอย่างยุติธรรมตามเกณฑ์ที่กำหนดอย่างเคร่งครัด

# Instruction (คำสั่ง)
1. อ่านข้อความลายมือจากภาพในส่วนของ "ฉบับที่ 2 การเขียน" 
2. นับจำนวนบรรทัดที่นักเรียนเขียน (เกณฑ์คือ 12-15 บรรทัด)
3. ตรวจสอบความชัดเจนของลายมือ และประเมิน "เปอร์เซ็นต์ความมั่นใจในการอ่าน (ocr_confidence_percent)" จาก 0 ถึง 100% หากเจอคำที่อ่านไม่ออกเลย ให้แทนที่คำนั้นด้วยเครื่องหมาย [อ่านไม่ออก] และถ้ามีคำอ่านไม่ออกเยอะ ให้ลด % ลง
4. หากความมั่นใจต่ำกว่า 70% ให้ตั้งค่า "needs_human_review" เป็น true
5. ตรวจหาคำผิดเพื่อใช้ในการหักคะแนน
6. ประเมินคะแนนแยกตามเกณฑ์ (Rubric) 5 ด้าน
7. ตอบกลับเป็นรูปแบบ JSON เท่านั้น

# Rubric (เกณฑ์การให้คะแนน)
หัวข้อ: "รักษ์ภาษาไทย" ความยาว 12-15 บรรทัด

ด้านที่ 1: การตั้งชื่อเรื่อง (คะแนน 1-5)
- 5 คะแนน = ครบ 4 ข้อ (สอดคล้องประเด็น, ใช้คำถูกต้อง, น่าสนใจ, กระชับ), 4=3ข้อ, 3=2ข้อ, 2=1ข้อ, 1=ไม่ได้ตั้งหรือไม่ได้ตามเกณฑ์เลย
- *หมายเหตุ: หากนักเรียนนำชื่อหัวข้อมาตั้งเป็นชื่อเรื่องทื่อๆ โดยไม่คิดใหม่ อาจพิจารณาให้ 1 คะแนน*

ด้านที่ 2: เนื้อหา (คะแนน 1-5, น้ำหนัก x3 ในใจ แต่ส่งค่าคะแนนดิบ 1-5 มา)
- 5 คะแนน = ครบ 5 ข้อ (ตรงประเด็น, มีเอกภาพ, ลำดับความคิดต่อเนื่อง, เป็นเหตุเป็นผล, นำเสนอความคิดเชิงบวก)

ด้านที่ 3: การใช้ภาษา (คะแนน 1-4)
- 4 คะแนน = ครบ 4 ข้อ (ใช้ภาษาถูกต้อง, ภาษาระดับถูกต้อง, เว้นวรรคตอนถูก, ไม่เขียนฉีกคำ)

ด้านที่ 4: ความเป็นระเบียบเรียบร้อยและตรงตามคำชี้แจง (คะแนน 1-3)
- 3 คะแนน = ครบ 3 ข้อ (อ่านง่ายเป็นระเบียบ, สะอาดเรียบร้อย, 12-15 บรรทัด)

ด้านที่ 5: การเขียนสะกดคำ (คะแนน 1-5)
- นับจำนวนคำที่เขียนผิดซ้ำ (ให้นับเป็น 1 คำ)
- 5=ถูกทุกคำ, 4=ผิด 1-3 คำ, 3=ผิด 4-6 คำ, 2=ผิด 7-9 คำ, 1=ผิด 10 คำขึ้นไป

# Output JSON Schema
{
  "student_info": { "name_detected": "", "class": "", "number": "" },
  "transcribed_text": "...",
  "line_count": 0,
  "ocr_confidence_percent": 0,
  "needs_human_review": false,
  "spelling_errors_found": [],
  "evaluation": {
    "c1_title": {"score": 0, "reason": ""},
    "c2_content": {"score": 0, "reason": ""},
    "c3_language": {"score": 0, "reason": ""},
    "c4_neatness": {"score": 0, "reason": ""},
    "c5_spelling": {"score": 0, "reason": ""}
  },
  "total_raw_score": 0,
  "teacher_feedback": ""
}
`;

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    // 1. Fetch image from Cloudinary to pass to Gemini as base64
    // (Gemini API handles base64 inlineData directly without needing public URLs)
    const imageResp = await fetch(imageUrl);
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';

    // 2. Call Gemini AI API (using 1.5-flash as the current stable fast model)
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const resultText = response.text || "{}";
    const parsedData = JSON.parse(resultText);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Error evaluating exam:", error);
    return NextResponse.json({ error: error.message || 'Failed to process' }, { status: 500 });
  }
}
