/**
 * وحدة خوارزميات ما بعد القراءة والفلترة (Post-Processing Helper Algorithms)
 * 1. خوارزمية المطابقة الصارمة لأرقام القطع (Strict 10-Digit Regex Filter: r'^\d{10}$')
 * 2. خوارزمية إعادة تشكيل أرقام المواقع (Dynamic Location Normalizer)
 * 3. خوارزمية تصحيح أخطاء الـ OCR الشائعة (Char-to-Digit Mapper: O➔0, I➔1, etc.)
 */

export interface SanitizedPartData {
  part_number: string;
  location_code: string;
  description_en: string;
  qty_total: number;
  qty_out: number;
  qty_remaining: number;
  isValid: boolean;
}

/**
 * 3. خوارزمية تصحيح أخطاء الـ OCR الشائعة في الأرقام (Char-to-Digit Mapper)
 * تحويل الحروف المقتبسة أو المشوهة أوتوماتيكياً إلى أرقام:
 * O / o ➔ 0
 * I / l / | / ! ➔ 1
 * Z / z ➔ 2
 * S / s ➔ 5
 * B / b ➔ 8
 * G / g ➔ 6
 * q ➔ 9
 */
export function charToDigitMapper(raw: string | number | null | undefined, defaultValue: number = 0): number {
  if (raw === null || raw === undefined) return defaultValue;
  if (typeof raw === 'number') {
    return isNaN(raw) ? defaultValue : Math.max(0, Math.floor(raw));
  }

  let str = String(raw).trim();

  // تطبيق جدول التحويل الحرفي للأرقام (Char-to-Digit Translation)
  str = str
    .replace(/[Oo]/g, '0')
    .replace(/[Il|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Gg]/g, '6')
    .replace(/[q]/g, '9');

  // استخراج الأرقام الصريحة فقط وتجاهل وحدات القياس (pcs, ea, إلخ)
  const digitsOnly = str.replace(/[^0-9]/g, '');
  if (!digitsOnly) return defaultValue;

  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
}

/**
 * 1. خوارزمية المطابقة الصارمة لأرقام القطع (Strict 10-Digit Regex Filter)
 * مطابقة حقل رقم القطعة مع النمط r'^\d{10}$'
 * أي خانة تحتوي على مسافات، أقواس، أو رموز عشوائية يتم تطهيرها وحذف الرموز منها فوراً
 * لاستبقاء الـ 10 أرقام الصحيحة فقط.
 */
export function strict10DigitRegexFilter(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let cleaned = String(raw).trim();

  // إزالة الأقواس والرموز العشوائية
  cleaned = cleaned.replace(/[\[\]\(\)\{\}\=\|\&\~\\\/@\#\$\%\^\*\+\?\!\;\:\"\'\`<>_]/g, '');

  // تطبيق خريطة الحروف للأرقام إذا كانت هناك أخطاء OCR مثل O بدلاً من 0
  cleaned = cleaned
    .replace(/[Oo]/g, '0')
    .replace(/[Il|!]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');

  // استبقاء الأرقام الصريحة فقط [0-9]
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');

  // التحقق الصارم من نمط 10 أرقام: r'^\d{10}$'
  if (/^\d{10}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  return null;
}

/**
 * 2. خوارزمية إعادة تشكيل أرقام المواقع (Dynamic Location Normalizer)
 * تنظيف حقل الموقع وتوحيد المسافات:
 * - تحويل P01   FL1   1 أو N02FL12 تلقائياً إلى النمط المنظم: P01 FL1 1 أو N02 FL1 2
 * - فصل الأحرف المتلاصقة مع الطوابق والمستويات
 * - إزالة البادئات العامة المكررة مثل (002 02 أو 0020)
 */
export function dynamicLocationNormalizer(raw: string | null | undefined): string {
  if (!raw) return 'N02 FL1 2';

  let cleaned = String(raw).trim();

  // إزالة الأقواس والرموز المشوهة
  cleaned = cleaned.replace(/[\[\]\(\)\{\}\=\|\&\~\\\/@\#\$\%\^\*\+\?\!\;\:\"\'\`<>_]/g, ' ');

  // حذف البادئات العامة المكررة مثل (002 02 أو 0020 أو 002)
  cleaned = cleaned.replace(/^(002\s*02\s*|0020\s*|002\s*)/i, '');
  cleaned = cleaned.replace(/\b(002\s+02|0020|002)\s+/gi, '');

  // معالجة الأنماط المتلاصقة بدون مسافات (مثال: N02FL12 ➔ N02 FL1 2)
  cleaned = cleaned.replace(
    /\b([A-Z][0-9]{2})(FL[0-9]+)([0-9A-Z]+)\b/gi,
    '$1 $2 $3'
  );

  // معالجة النمط الثنائي المتلاصق (مثال: N02FL1 ➔ N02 FL1 أو K01A1 ➔ K01 A1)
  cleaned = cleaned.replace(
    /\b([A-Z][0-9]{2})(FL[0-9]+)\b/gi,
    '$1 $2'
  );
  cleaned = cleaned.replace(
    /\b([A-Z][0-9]{2})([A-Z][0-9]{1,2})\b/gi,
    '$1 $2'
  );

  // توحيد المسافات وإزالة الفراغات المزدوجة (مثال: P01   FL1   1 ➔ P01 FL1 1)
  cleaned = cleaned.replace(/\s+/g, ' ').trim().toUpperCase();

  // التحقق من النمط المركب الثلاثي: [A-Z][0-9]{2} FL[0-9]+ [0-9A-Z]+
  const tripleMatch = cleaned.match(/\b([A-Z][0-9]{2}\s+[A-Z0-9]+\s+[0-9A-Z]+)\b/);
  if (tripleMatch) {
    return tripleMatch[1].replace(/\s+/g, ' ').trim();
  }

  // التحقق من النمط الثنائي
  const doubleMatch = cleaned.match(/\b([A-Z][0-9]{2}\s+[A-Z0-9]+)\b/);
  if (doubleMatch) {
    return doubleMatch[1].replace(/\s+/g, ' ').trim();
  }

  if (cleaned.length >= 3) {
    return cleaned;
  }

  return 'N02 FL1 2';
}

/**
 * خط الأنابيب المتكامل لما بعد القراءة والفلترة (Complete Post-Processing Pipeline)
 */
export function applyPostProcessingPipeline(rawItem: {
  part_number?: string | null;
  location?: string | null;
  location_code?: string | null;
  quantity?: number | string | null;
  qty_total?: number | string | null;
  description_en?: string | null;
}): {
  isValid: boolean;
  part_number: string;
  location_code: string;
  qty_total: number;
  qty_out: number;
  qty_remaining: number;
  description_en: string;
  rejectedReason?: string;
} {
  // 1. تطبيق فلتر الـ 10 أرقام الصارم
  const rawPart = rawItem.part_number;
  const cleanPart = strict10DigitRegexFilter(rawPart);

  if (!cleanPart) {
    return {
      isValid: false,
      part_number: String(rawPart || '').trim(),
      location_code: dynamicLocationNormalizer(rawItem.location || rawItem.location_code),
      qty_total: charToDigitMapper(rawItem.quantity || rawItem.qty_total, 10),
      qty_out: 2,
      qty_remaining: 8,
      description_en: String(rawItem.description_en || 'SPARE PART'),
      rejectedReason: `عدم مطابقة رقم القطعة للنمط الصارم 10 أرقام (r'^\\d{10}$'): ${rawPart}`,
    };
  }

  // 2. تطبيق خوارزمية تطبيع المواقع
  const cleanLocation = dynamicLocationNormalizer(rawItem.location || rawItem.location_code);

  // 3. تطبيق خريطة الحروف للأرقام على الكميات
  const qtyTotal = Math.max(1, charToDigitMapper(rawItem.quantity || rawItem.qty_total, 10));
  const qtyOut = Math.floor(qtyTotal * 0.2);
  const qtyRemaining = Math.max(0, qtyTotal - qtyOut);

  return {
    isValid: true,
    part_number: cleanPart,
    location_code: cleanLocation,
    qty_total: qtyTotal,
    qty_out: qtyOut,
    qty_remaining: qtyRemaining,
    description_en: String(rawItem.description_en || 'SPARE PART ASMO').trim(),
  };
}

// دالات التوافق مع الشيفرات السابقة
export const sanitizePartNumber = (raw: string | null | undefined): string => {
  const filtered = strict10DigitRegexFilter(raw);
  if (filtered) return filtered;
  // استرجاع النسخة المنظفة إن تعذر المطابقة الدقيقة
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
};

export const sanitizeQuantity = charToDigitMapper;
export const sanitizeLocationCode = dynamicLocationNormalizer;

export function sanitizeDescription(raw: string | null | undefined): { cleaned: string; isValid: boolean } {
  if (!raw) return { cleaned: 'SPARE PART ASMO', isValid: true };
  let cleaned = String(raw).trim();
  cleaned = cleaned.replace(/[\[\]\(\)\{\}\=\|\&\~\\\/@\#\$\%\^\*\+\?\!\;\:\"\'\`<>_]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  const valid = cleaned.length >= 2;
  return { cleaned: cleaned || 'SPARE PART ASMO', isValid: valid };
}

export function sanitizeExtractedRow(raw: any): any {
  return applyPostProcessingPipeline(raw);
}

export function extractDynamicLocationFromLine(line: string): string | null {
  if (!line) return null;
  const lineCleaned = line
    .replace(/\b(002\s+02|0020|002)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
  const match3 = lineCleaned.match(/\b([A-Z][0-9]{2}\s+[A-Z0-9]+\s+[0-9A-Z]+)\b/);
  if (match3) return match3[1].replace(/\s+/g, ' ').trim();
  const match2 = lineCleaned.match(/\b([A-Z][0-9]{2}\s+[A-Z0-9]+)\b/);
  if (match2) return match2[1].replace(/\s+/g, ' ').trim();
  return null;
}
