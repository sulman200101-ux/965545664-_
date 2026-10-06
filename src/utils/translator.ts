// قاموس المصطلحات الفنية لقطع الغيار الصناعية (ASMO)
const TERM_TRANSLATIONS: Record<string, string> = {
  // مسامير وروابط
  'BOLT': 'مسمار/برغي',
  'SCREW': 'برغي',
  'STUD BOLT': 'مسمار ربط مسنن (ستد بولت)',
  'NUT': 'صامولة',
  'HEX': 'سداسي',
  'WASHER': 'وردة/حلقة معدنية',
  'ANCHOR': 'مرساة تثبيت/أنكر',
  'STEEL': 'حديد/صلب',
  'CARBON STEEL': 'صلب كربوني',
  'STAINLESS STEEL': 'فولاذ مقاوم للصدأ (ستانلس)',
  'STAINLESS': 'ستيل ستانلس',

  // أوجه وجازكيت
  'GASKET': 'جازكيت/وجه إحكام',
  'SPIRAL WOUND': 'حلزوني مدعم',
  'O-RING': 'حلقة دائرية (أورينج)',
  'SEAL': 'مانع تسرب/سيل',
  'PACKING': 'حشوة إحكام',
  'PTFE': 'تفلون مقاوم للحرارة',
  'ASBESTOS FREE': 'خالي من الأسبستوس',

  // إضاءة ولمبات
  'LAMP': 'لمبة/مصباح',
  'LIGHT': 'إضاءة/كشاف',
  'BULB': 'لمبة',
  'FLUORESCENT': 'فلورسنت',
  'LED': 'ليد عالي الكفاءة',
  'BALLAST': 'ترانس/بادئ تشغيل',
  'FLOODLIGHT': 'كشاف غامر',

  // صمامات وفلاتر
  'VALVE': 'صمام/محبس',
  'GATE VALVE': 'محبس بوابة',
  'BALL VALVE': 'محبس كروي',
  'CHECK VALVE': 'صمام عدم رجوع (رداد)',
  'GLOBE VALVE': 'صمام قفاز',
  'FILTER': 'مرشح/فلتر',
  'FILTER ELEMENT': 'عنصر ترشيح/خرطوشة فلتر',
  'STRAINER': 'مصفاة خطية',
  
  // مضخات ورولمان بلي
  'BEARING': 'رولمان بلي/محمل',
  'BALL BEARING': 'رولمان بلي كري',
  'ROLLER BEARING': 'محمل أسطواني',
  'PUMP': 'مضخة',
  'IMPELLER': 'دافع المضخة/ريشة',
  'COUPLING': 'قارنة ربط/كوبلنج',
  'GAUGE': 'مقياس',
  'PRESSURE GAUGE': 'مقياس ضغط',
  'PRESSURE': 'ضغط',
  'FLANGE': 'فلنجة/شفة ربط',
  'PIPE': 'أنبوب/ماسورة',
  'FITTING': 'وصلة ربط',
  'ELBOW': 'كوع توصيل',
  'TEE': 'تي ثلاثي',
  'NIPPLE': 'نيبل/حلمة توصيل'
};

// ذاكرة تخزين مؤقت دائمة للترجمة والتصنيف (One-Time Processing Cache)
const TRANSLATION_CACHE = new Map<string, { category: string; descAr: string }>();

export function categorizeAndTranslate(descEn: string): { category: string; descAr: string } {
  const normalizedKey = (descEn || '').trim().toUpperCase();
  if (TRANSLATION_CACHE.has(normalizedKey)) {
    return TRANSLATION_CACHE.get(normalizedKey)!;
  }

  const upper = normalizedKey;
  
  let category = 'عام';
  if (upper.includes('BOLT') || upper.includes('SCREW') || upper.includes('NUT') || upper.includes('WASHER')) {
    category = 'مسامير';
  } else if (upper.includes('LAMP') || upper.includes('LIGHT') || upper.includes('BULB') || upper.includes('LED') || upper.includes('FLUORESCENT')) {
    category = 'لمبة';
  } else if (upper.includes('GASKET') || upper.includes('O-RING') || upper.includes('SEAL') || upper.includes('PACKING')) {
    category = 'جازكيت';
  } else if (upper.includes('VALVE')) {
    category = 'صمامات ومحابس';
  } else if (upper.includes('FILTER') || upper.includes('STRAINER')) {
    category = 'فلاتر ومصافي';
  } else if (upper.includes('BEARING')) {
    category = 'رولمان بلي';
  } else if (upper.includes('GAUGE')) {
    category = 'أجهزة قياس';
  } else if (upper.includes('FLANGE') || upper.includes('PIPE') || upper.includes('ELBOW')) {
    category = 'أنابيب وفلنجات';
  }

  // ترجمة ذكية مع استبدال الكلمات والعبارات المركبة أولاً
  let descAr = descEn;
  
  // فرز الكلمات حسب الطول لتفضيل العبارات المركبة مثل "SPIRAL WOUND" و "STAINLESS STEEL"
  const sortedTerms = Object.keys(TERM_TRANSLATIONS).sort((a, b) => b.length - a.length);

  for (const enWord of sortedTerms) {
    const arWord = TERM_TRANSLATIONS[enWord];
    // استبدال ككلمة كاملة بدون حساسية لحالة الأحرف
    const regex = new RegExp(`\\b${enWord}\\b`, 'gi');
    descAr = descAr.replace(regex, arWord);
  }

  const result = { category, descAr };
  TRANSLATION_CACHE.set(normalizedKey, result);
  return result;
}
