/**
 * Robust JSON Sanitizer & Validator for LLM responses
 * Handles markdown formatting, extraneous commentary, trailing commas, and schema verification.
 */

export interface ValidationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export function sanitizeJSONString(raw: string): string {
  if (!raw) return "";

  let cleaned = raw.trim();

  // 1. Remove markdown code fences if wrapped: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/, "");

  // 2. Locate the first '{' and the last '}'
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Remove trailing commas before '}' or ']' (common LLM JSON syntax error)
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  return cleaned.trim();
}

export function parseAndValidateGradingJSON(
  rawText: string,
  expectedCriteriaIds: string[] = []
): ValidationResult {
  const sanitized = sanitizeJSONString(rawText);

  if (!sanitized) {
    return {
      success: false,
      error: "Empty or invalid response from AI model (No JSON structure found)"
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(sanitized);
  } catch (err: any) {
    // Attempt secondary fallback: replace newlines inside string literals if broken
    try {
      const fixedNewlines = sanitized.replace(/(?<="[^"]*)\n(?=[^"]*")/g, "\\n");
      parsed = JSON.parse(fixedNewlines);
    } catch {
      return {
        success: false,
        error: `JSON syntax error: ${err.message}`
      };
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      success: false,
      error: "Parsed JSON is not an object"
    };
  }

  // Schema verification
  if (!parsed.evaluation || typeof parsed.evaluation !== "object") {
    return {
      success: false,
      error: "Missing or invalid 'evaluation' object in JSON response"
    };
  }

  // Ensure total_raw_score is a valid number
  if (parsed.total_raw_score === undefined || parsed.total_raw_score === null) {
    // Calculate sum of evaluation scores if missing
    let sum = 0;
    for (const key of Object.keys(parsed.evaluation)) {
      sum += Number(parsed.evaluation[key]?.score) || 0;
    }
    parsed.total_raw_score = sum;
  } else {
    parsed.total_raw_score = Number(parsed.total_raw_score) || 0;
  }

  // Ensure all expected criteria exist in evaluation
  for (const cId of expectedCriteriaIds) {
    if (!parsed.evaluation[cId]) {
      parsed.evaluation[cId] = {
        score: 0,
        reason: "ไม่พบผลการประเมินเกณฑ์ข้อนี้จากโมเดล"
      };
    } else {
      parsed.evaluation[cId].score = Number(parsed.evaluation[cId].score) || 0;
      parsed.evaluation[cId].reason = String(parsed.evaluation[cId].reason || "");
    }
  }

  // Default values for standard fields
  parsed.transcribed_text = String(parsed.transcribed_text || "");
  parsed.ocr_confidence_percent = Number(parsed.ocr_confidence_percent) || 85;
  parsed.needs_human_review = Boolean(parsed.needs_human_review);
  parsed.teacher_feedback = String(parsed.teacher_feedback || "");

  return {
    success: true,
    data: parsed
  };
}
