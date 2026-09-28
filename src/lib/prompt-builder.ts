/**
 * Standardized Prompt Builder for grading Thai handwriting exams
 */

export interface PromptPayload {
  systemInstruction: string;
  userPromptText: string;
  imageBase64?: string;
  imageMimeType?: string;
  expectedCriteriaIds: string[];
}

export async function buildGradingPrompts(
  rubricData: any,
  customStylePrompt?: string,
  imageUrl?: string,
  overrideText?: string
): Promise<PromptPayload> {
  const criteria = rubricData?.criteria || [];
  const expectedCriteriaIds = criteria.map((c: any) => c.id);

  const criteriaText = criteria
    .map((c: any) => {
      const weightInfo = c.weight
        ? ` | น้ำหนัก x${c.weight} | คะแนนเต็มรวม ${c.max_score}`
        : ` | คะแนนเต็ม ${c.max_score}`;
      return `- ${c.name} (คะแนนดิบสูงสุด ${c.raw_score || c.max_score}${weightInfo}):\n  คำชี้แจง: ${c.description}`;
    })
    .join('\n\n');

  const jsonSchemaEval = criteria
    .map((c: any) => `"${c.id}": {"score": 0, "reason": ""}`)
    .join(',\n    ');

  const customStyleSection = customStylePrompt
    ? `\n[สไตล์การตรวจเฉพาะตัวของครู (Custom Skill / Persona)]\n${customStylePrompt}\n`
    : '';

  const systemInstruction = `
คุณคือ "ครูผู้เชี่ยวชาญด้านภาษาไทย" หน้าที่ของคุณคือการประเมินและให้คะแนนงานเขียนของนักเรียนอย่างละเอียด ยุติธรรม และเป็นกลางที่สุด 
โดยอ้างอิงจาก "เกณฑ์การให้คะแนน (Rubric Scores)" ที่กำหนดไว้อย่างเคร่งครัด
${customStyleSection}

[บริบทของงานเขียน]
หัวข้อ: ${rubricData?.title || 'แบบประเมินการเขียน'}
เงื่อนไขที่นักเรียนต้องทำ: ${rubricData?.description || '-'}

# Instruction (คำสั่ง)
1. อ่านข้อความอย่างละเอียด (หากสกัดจากภาพและมีคำไหนดูลายมือยากหรือไม่มั่นใจ ให้ครอบคำนั้นด้วยแท็ก <unsure>คำนั้น</unsure> เสมอ)
2. ประเมิน "เปอร์เซ็นต์ความมั่นใจในการอ่าน (ocr_confidence_percent)" 0-100% หากความมั่นใจต่ำกว่า 85% ให้ตั้งค่า "needs_human_review" เป็น true
3. ประเมินและให้คะแนนแยกตามเกณฑ์ (Rubric) ต่อไปนี้อย่างเคร่งครัด:
${criteriaText}

4. กฎเหล็กในการเขียน "reason" (เหตุผลประกอบการประเมิน) สำหรับแต่ละเกณฑ์:
   - คุณต้องวิเคราะห์ทีละข้อ โดยระบุให้ชัดเจนว่า "ตรวจพบว่าตรงกับเกณฑ์ย่อยข้อใดบ้าง" หรือ "พลาดเกณฑ์ย่อยข้อใด"
   - ต้องแสดงสูตรการคิดคะแนนในบรรทัดสุดท้ายของ reason เสมอ ในรูปแบบ: "คะแนนดิบ [X] x น้ำหนัก [Y] = [Z] คะแนน"
   - (หากเกณฑ์ไหนไม่มีน้ำหนัก ให้ระบุแค่คะแนนที่ได้)
5. คำนวณคะแนนรวมที่ได้ทั้งหมดใส่ใน "total_raw_score"
6. เขียนคำชมหรือข้อเสนอแนะสั้นๆ ใส่ใน "teacher_feedback"
7. กฎสำคัญที่สุด: ตอบกลับเป็นรูปแบบ Pure JSON Object ตามโครงสร้างด้านล่างนี้เท่านั้น ห้ามใส่เครื่องหมาย markdown block หรือคำอธิบายเพิ่มเติมใดๆ นอกเหนือจาก JSON

# Output JSON Schema
{
  "transcribed_text": "ข้อความที่นักเรียนเขียนทั้งหมด (เว้นวรรคและย่อหน้าให้ตรงตามต้นฉบับ พร้อมแท็ก <unsure> หากมี)",
  "ocr_confidence_percent": 0,
  "needs_human_review": false,
  "evaluation": {
    ${jsonSchemaEval}
  },
  "total_raw_score": 0,
  "teacher_feedback": ""
}
`.trim();

  let userPromptText = '';
  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;

  if (overrideText) {
    userPromptText = `จงประเมินข้อความต่อไปนี้ตามเกณฑ์และตอบกลับเป็น Pure JSON เท่านั้น:\n\n${overrideText}`;
  } else if (imageUrl) {
    userPromptText = `จงประเมินกระดาษคำตอบแผ่นนี้ตามเกณฑ์และตอบกลับเป็น Pure JSON โดยอย่าลืมใส่ <unsure> ครอบคำที่ไม่มั่นใจ`;
    const imageResp = await fetch(imageUrl);
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    imageBase64 = buffer.toString('base64');
    imageMimeType = imageResp.headers.get('content-type') || 'image/jpeg';
  }

  return {
    systemInstruction,
    userPromptText,
    imageBase64,
    imageMimeType,
    expectedCriteriaIds
  };
}
