import { recognize } from 'tesseract.js';
import type { DocumentType } from './types';

export type OcrResult = {
  text: string;
  confidence: number;
  fields: Record<string, string>;
};

const FIELD_PATTERNS: Record<DocumentType, { key: string; label: string; pattern: RegExp }[]> = {
  aadhaar: [
    { key: 'aadhaar_number', label: 'Aadhaar Number', pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
    { key: 'name', label: 'Name', pattern: /(?:name|नाम)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,40})/i },
    { key: 'dob', label: 'Date of Birth', pattern: /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/ },
    { key: 'gender', label: 'Gender', pattern: /\b(male|female|transgender)\b/i },
    { key: 'address', label: 'Address', pattern: /(?:address|पता)\s*[:\-]?\s*([A-Za-z0-9\s,.\-]{10,120})/i },
  ],
  pan: [
    { key: 'pan_number', label: 'PAN Number', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/ },
    { key: 'name', label: 'Name', pattern: /(?:name|नाम)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,40})/i },
    { key: 'father_name', label: "Father's Name", pattern: /(?:father|पिता)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,40})/i },
    { key: 'dob', label: 'Date of Birth', pattern: /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/ },
  ],
  passport: [
    { key: 'passport_number', label: 'Passport Number', pattern: /\b[A-Z]\d{7}\b/ },
    { key: 'name', label: 'Name', pattern: /(?:name|नाम)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,40})/i },
    { key: 'surname', label: 'Surname', pattern: /(?:surname|last name)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,40})/i },
    { key: 'nationality', label: 'Nationality', pattern: /(?:nationality)\s*[:\-]?\s*([A-Za-z]{3,30})/i },
    { key: 'dob', label: 'Date of Birth', pattern: /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/ },
    { key: 'issue_date', label: 'Date of Issue', pattern: /(?:issue|date of issue)\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i },
    { key: 'expiry_date', label: 'Date of Expiry', pattern: /(?:expiry|date of expiry)\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i },
  ],
  driving_licence: [
    { key: 'dl_number', label: 'DL Number', pattern: /\b[A-Z]{2}\s?\d{2}\s?\d{4}\s?\d{7}\b/ },
    { key: 'name', label: 'Name', pattern: /(?:name|नाम)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,40})/i },
    { key: 'dob', label: 'Date of Birth', pattern: /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/ },
    { key: 'vehicle_class', label: 'Vehicle Class', pattern: /(?:class|vehicle class)\s*[:\-]?\s*([A-Z0-9, ]{1,20})/i },
    { key: 'issue_date', label: 'Date of Issue', pattern: /(?:issue|date of issue)\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i },
    { key: 'validity', label: 'Valid Till', pattern: /(?:valid till|validity)\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i },
  ],
};

export async function runOcr(
  imageFile: File,
  documentType: DocumentType,
  onProgress?: (p: number) => void
): Promise<OcrResult> {
  const { data } = await recognize(imageFile, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  const text = data.text;
  const baseConfidence = (data.confidence ?? 0) / 100 * 100;
  const fields: Record<string, string> = {};
  const patterns = FIELD_PATTERNS[documentType];

  for (const { key, pattern } of patterns) {
    const match = text.match(pattern);
    if (match) {
      fields[key] = (match[1] ?? match[0]).trim();
    }
  }

  const matchedRatio = Object.keys(fields).length / patterns.length;
  const fieldBoost = matchedRatio * 12;
  const confidence = Math.min(99, Math.round(baseConfidence * 0.7 + fieldBoost + 18));

  return { text, confidence, fields };
}
