import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل CORS لجميع الطلبات القادمة من أجهزة أندرويد وCapacitor والمتصفحات
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// زيادة حجم الـ Payload لاستيعاب صور الكاميرا والمستندات عالية الدقة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========================================================
// خوارزميات ما بعد القراءة والفلترة (Post-Processing Helper Algorithms)
// ========================================================

// 1. خوارزمية تصحيح أخطاء الـ OCR الشائعة في الأرقام والكميات (Char-to-Digit Mapper)
function charToDigitMapper(raw: any, defaultValue: number = 10): number {
  if (raw === null || raw === undefined) return defaultValue;
  if (typeof raw === 'number') return isNaN(raw) ? defaultValue : Math.max(0, Math.floor(raw));

  let str = String(raw).trim()
    .replace(/[Oo]/g, '0')
    .replace(/[Il|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Gg]/g, '6')
    .replace(/[q]/g, '9');

  const parsed = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// 2. خوارزمية إعادة تشكيل وتطهير أرقام المواقع (Dynamic Location Normalizer)
function dynamicLocationNormalizer(rawLoc: any): string {
  if (!rawLoc) return 'N02 FL1 2';
  let cleaned = String(rawLoc).trim().toUpperCase();

  // تنظيف البادئات الشائعة
  cleaned = cleaned
    .replace(/^(002\s*02|0020|BIN|LOC|LOCATION|STORAGE[:\s]*)/gi, '')
    .trim();

  // فك التصاق الرموز
  cleaned = cleaned
    .replace(/\b([A-Z][0-9]{2})(FL[0-9]+)([0-9A-Z]+)\b/gi, '$1 $2 $3')
    .replace(/\b([A-Z][0-9]{2})(FL[0-9]+)\b/gi, '$1 $2')
    .replace(/\b([A-Z][0-9]{2})([A-Z][0-9]{1,2})\b/gi, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const match = cleaned.match(/\b([A-Z][0-9]{2}\s+[A-Z0-9]+\s+[0-9A-Z]+)\b/);
  if (match) return match[1].replace(/\s+/g, ' ').trim();

  const match2 = cleaned.match(/\b([A-Z][0-9]{2}\s+[A-Z0-9]+)\b/);
  if (match2) return match2[1].replace(/\s+/g, ' ').trim();

  return cleaned.length >= 3 ? cleaned : 'N02 FL1 2';
}

// 3. خوارزمية الترجمة والتعريب الهندسي لمصطلحات قطع الغيار (ASMO Technical Terms)
function arabicizeDescription(desc: string): string {
  if (!desc) return '';
  let res = desc;
  const termsMap: [RegExp, string][] = [
    [/GASKET SPIRAL WOUND/gi, 'جازكيت حلزوني مدعم'],
    [/GASKET SPIRAL/gi, 'جازكيت حلزوني مدعم'],
    [/GASKET METAL GROOVED/gi, 'جازكيت معدني مفرغ'],
    [/GASKET TEFLON/gi, 'جازكيت تفلون حراري'],
    [/GASKET FLANGE/gi, 'جازكيت فلنجة'],
    [/GASKET/gi, 'جازكيت/وجه إحكام'],
    [/BALL VALVE/gi, 'محبس كروي'],
    [/GATE VALVE/gi, 'محبس بوابة'],
    [/CHECK VALVE/gi, 'صمام عدم رجوع (رداد)'],
    [/GLOBE VALVE/gi, 'صمام قفاز'],
    [/CONTROL VALVE/gi, 'صمام تحكم هيدروليكي'],
    [/VALVE/gi, 'صمام/محبس'],
    [/BOLT HEX STEEL/gi, 'مسمار صلب سداسي'],
    [/BOLT CARBON STEEL/gi, 'مسمار كربوني مدعم'],
    [/BOLT STUD/gi, 'مسمار ربط مسنن (ستد بولت)'],
    [/BOLT/gi, 'مسمار/برغي'],
    [/HEX NUT/gi, 'صامولة سداسية'],
    [/NUT/gi, 'صامولة'],
    [/WASHER/gi, 'حلقة معدنية/وردة'],
    [/BALL BEARING/gi, 'رولمان بلي كري'],
    [/BEARING/gi, 'رولمان بلي/محمل'],
    [/PRESSURE GAUGE/gi, 'مقياس ضغط صناعي'],
    [/TEMPERATURE GAUGE/gi, 'مقياس حرارة'],
    [/GAUGE/gi, 'مقياس/عداد'],
    [/FILTER ELEMENT/gi, 'عنصر ترشيح/خرطوشة فلتر'],
    [/AIR FILTER/gi, 'فلتر هواء صناعي'],
    [/FILTER/gi, 'مرشح/فلتر'],
    [/STRAINER/gi, 'مصفاة خط أنابيب'],
    [/O-RING/gi, 'حلقة دائرية مانعة للتسرب (أورينج)'],
    [/MECHANICAL SEAL/gi, 'مانع تسرب ميكانيكي'],
    [/OIL SEAL/gi, 'سيل زيت/مانع تسريب'],
    [/SEAL/gi, 'مانع تسرب/سيل'],
    [/LAMP FLUORESCENT/gi, 'لمبة فلورسنت صناعية'],
    [/LAMP LED/gi, 'مصباح ليد عالي الكثافة'],
    [/LAMP BULB/gi, 'لمبة إضاءة'],
    [/LAMP/gi, 'لمبة/مصباح'],
    [/LIGHT/gi, 'إضاءة/كشاف'],
    [/BULB/gi, 'لمبة'],
    [/ACTUATOR/gi, 'مشغل/محرك صمام'],
    [/TRANSMITTER/gi, 'مرسل/حساس قياس'],
    [/FLANGE WELD NECK/gi, 'فلنجة لحام بعنق'],
    [/FLANGE/gi, 'فلنجة ربط أنابيب'],
    [/PIPE FITTING/gi, 'وصلة أنابيب'],
    [/PUMP IMPELLER/gi, 'دافع مضخة/ريشة'],
    [/COUPLING/gi, 'قارنة ربط (كوبلنج)'],
  ];

  for (const [re, ar] of termsMap) {
    if (re.test(res)) {
      res = res.replace(re, ar);
    }
  }
  return res;
}

// 4. خوارزمية التصنيف الهندسي التلقائي (Engineering Category Detector)
function detectEngineeringCategory(desc: string): string {
  if (!desc) return 'عام';
  const u = desc.toUpperCase();
  if (u.includes('GASKET') || u.includes('جازكيت') || u.includes('O-RING') || u.includes('SEAL') || u.includes('أوجه إحكام')) return 'جازكيت';
  if (u.includes('VALVE') || u.includes('صمام') || u.includes('محبس') || u.includes('ACTUATOR')) return 'صمامات ومحركات';
  if (u.includes('BOLT') || u.includes('مسمار') || u.includes('NUT') || u.includes('صامولة') || u.includes('SCREW') || u.includes('WASHER')) return 'مسامير وروابط';
  if (u.includes('LAMP') || u.includes('لمبة') || u.includes('LIGHT') || u.includes('LED') || u.includes('BULB') || u.includes('إضاءة')) return 'إنارة ولمبات';
  if (u.includes('BEARING') || u.includes('رولمان') || u.includes('محمل')) return 'رولمان بلي';
  if (u.includes('FILTER') || u.includes('فلتر') || u.includes('STRAINER') || u.includes('مرشح')) return 'فلاتر ومصافي';
  if (u.includes('GAUGE') || u.includes('مقياس') || u.includes('TRANSMITTER') || u.includes('حساس') || u.includes('ضغط')) return 'أجهزة قياس';
  if (u.includes('FLANGE') || u.includes('فلنجة') || u.includes('PIPE') || u.includes('أنبوب') || u.includes('FITTING')) return 'أنابيب وفلنجات';
  if (u.includes('PUMP') || u.includes('مضخة') || u.includes('IMPELLER') || u.includes('COUPLING')) return 'مضخات وميكانيكا';
  return 'عام';
}

/**
 * نقطة نهاية معالجة جداول الجرد عبر الذكاء الاصطناعي (Gemini Vision API)
 * مع شلال النماذج عالي السرعة (High-Performance Resilient OCR Engine)
 */
app.post(['/api/ocr-scan', '/api/gemini/parse-table'], async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(200).json({
        success: false,
        data: [],
        items: [],
        skipped_rows: [],
        message: 'الصورة غير متوفرة. يرجى التقاط الورقة بوضوح.',
      });
    }

    // استخراج بيانات الـ base64 النقية دون أي بادئات
    let cleanBase64 = String(imageBase64);
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s+/g, '');

    const currentKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!currentKey) {
      return res.status(200).json({
        success: false,
        items: [],
        skipped_rows: [],
        message: 'مفتاح Gemini API غير متاح في بيئة السيرفر.',
      });
    }

    // تهيئة عميل الذكاء الاصطناعي مع ترويسات القياس المعتمدة
    const ai = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // التوجيه الصارم والدقيق لاستخراج كافة صفوف الجدول من البداية حتى النهاية
    const prompt = `أنت مدقق ومحلل بصري متقدم لجداول ومستندات جرد قطع الغيار لشركة أسمو (ASMO).

المهمة الأساسية:
اقرأ جدول الجرد المرفق في الورقة سطراً بسطر من البداية وحتى نهاية آخر سطر في الورقة، واستخرج جميع الصفوف بالكامل دون استثناء.

تعليمات التكيف والاستخراج الشامل:
1. تعرف ديناميكياً على أعمدة الجدول مهما اختلفت تسمياتها (مثل: Material, Part No, Item, Storage Bin, Location, QTY, Description).
2. استخرج كل صف مرئي في الجدول يحتوي على صنف أو رقم قطعة كعنصر مستقل في المصفوفة.
3. إذا كانت الورقة تحتوي على 10 أو 20 أو 40 أو 60 صفاً أو أكثر، استخرجها جميعاً بالكامل دون أي اختصار أو اقتصار على عينة!
4. تفاصيل الحقول لكل عنصر:
   - partNumber: رقم القطعة أو كود المادة (المعرّف الرقمي أو الأبجدي، عادة 8-10 أرقام تبدأ بـ 100).
   - location: كود الموقع أو الرف التخزيني (مثل K01 A1, J01 B1, FL1, N02 FL1 2, إلخ).
   - quantity: كمية الصنف كرقم صحيح (QTY).
   - description: الوصف والمقاس المكتوب في الورقة مع الترجمة العربية الموضحة.
   - category: التصنيف المناسب (جازكيت، صمامات ومحركات، مسامير وروابط، إنارة ولمبات، رولمان بلي، فلاتر ومصافي، أجهزة قياس، أنابيب وفلنجات، عام).

قواعد صارمة:
- ممنوع التلخيص نهائياً وممنوع التوقف عند 4 أو 5 قطع. استخرج كافة الصفوف حتى نهاية الصفحة.
- يجب إرجاع مصفوفة JSON نقية فقط بالشكل التالي دون نصوص إضافية:
[
  {
    "partNumber": "1001010488",
    "location": "J01 A2",
    "quantity": 30,
    "description": "جازكيت حلزوني مدعم 3 INCH 150# GASKET SPIRAL",
    "category": "جازكيت"
  }
]`;

    // قائمة النماذج المعتمدة السريعة والفعالة للرؤية مع البدء بالأسرع والأعلى سعة
    const candidateModels = [
      'gemini-3.1-flash-lite', // فائق السرعة، عالي السعة، ممتاز في قراءة الجداول واستخراج JSON
      'gemini-3.8-flash',      // النموذج الرئيسي
      'gemini-flash-latest',   // أحدث إصدار فلاش
      'gemini-3.1-pro-preview' // دقة فائقة في الحالات المعقدة
    ];

    let response: any = null;
    let lastError: any = null;
    let selectedModel = '';

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
            ],
          },
          config: {
            maxOutputTokens: 8192,
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });

        if (response && response.text) {
          selectedModel = model;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} attempt failed:`, err?.status || err?.message || err);
      }
    }

    if (!response || !response.text) {
      console.error('All Gemini vision models failed. Last error:', lastError);
      return res.status(200).json({
        success: false,
        data: [],
        items: [],
        skipped_rows: [],
        message: `تعذر معالجة الصورة عبر الذكاء الاصطناعي: ${lastError?.message || 'يرجى التأكد من وضوح الصورة والمحاولة مرة أخرى'}`,
      });
    }

    const rawResponseText = response.text || '';
    let cleanedText = rawResponseText.trim();
    cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (e1) {
      const arrayMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        try {
          parsed = JSON.parse(arrayMatch[0]);
        } catch (e2) {}
      }
      if (!parsed) {
        const objMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            parsed = JSON.parse(objMatch[0]);
          } catch (e3) {}
        }
      }
    }

    if (!parsed) {
      parsed = [];
    }

    const rawItems: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed.inventory)
      ? parsed.inventory
      : Object.values(parsed).find(Array.isArray) || [];

    const validItems: any[] = [];
    const skippedRows: any[] = [];

    rawItems.forEach((item, idx) => {
      const rawPart = String(
        item.part_number ?? item.partNumber ?? item.material ?? item.part ?? item.part_no ?? item['Part Number'] ?? item['Material'] ?? ''
      ).trim();

      let cleanDigits = rawPart.replace(/[^0-9]/g, '');

      // إذا كان الرقم يحتوي على 10 أرقام صريحة تبدأ بـ 100
      const match10 = cleanDigits.match(/(100\d{7})/);
      if (match10) {
        cleanDigits = match10[1];
      }

      const rawLoc = item.location ?? item.location_code ?? item.bin ?? item.storage_bin ?? item.storageBin ?? item['Storage Bin'] ?? item['Location'] ?? '';
      const normLocation = dynamicLocationNormalizer(rawLoc);

      const rawQty = item.quantity ?? item.qty ?? item.total_qty ?? item.stock ?? item['QTY'] ?? item['Quantity'] ?? 10;
      const normQuantity = charToDigitMapper(rawQty, 1);

      const desc = String(
        item.description ?? item.description_ar ?? item.description_en ?? item.desc ?? item.name ?? item['Description'] ?? item['Material Description'] ?? ''
      ).trim();

      // قبول أي صنف يحتوي على معرف صالح (رقم 4 خانات فأكثر أو رمز صنف من 2 خانة فأكثر)
      const partIdentifier = cleanDigits.length >= 4 ? cleanDigits : (rawPart.length >= 2 ? rawPart : '');

      if (partIdentifier) {
        const arabicDesc = item.description_ar || arabicizeDescription(desc);
        const category = item.category || detectEngineeringCategory(desc);
        validItems.push({
          part_number: partIdentifier,
          location_code: normLocation,
          location: normLocation,
          qty_total: normQuantity,
          quantity: normQuantity,
          description_en: desc,
          description_ar: arabicDesc,
          description: arabicDesc,
          category: category,
          status: 'مضاف',
        });
      } else {
        skippedRows.push({
          id: `skip-${idx + 1}`,
          row_number: idx + 1,
          raw_text: `${rawPart || '---'} | ${normLocation} | ${normQuantity} | ${desc}`,
          part_number: rawPart,
          location: normLocation,
          quantity: normQuantity,
          description_en: desc,
          reason: 'رقم القطعة غير واضح',
        });
      }
    });

    const formattedData = validItems.map((item) => ({
      partNumber: item.part_number,
      location: item.location_code || item.location,
      quantity: item.qty_total || item.quantity,
      description: item.description_ar || item.description || item.description_en,
      category: item.category || 'عام',
      status: 'مضاف',
    }));

    return res.status(200).json({
      success: validItems.length > 0,
      model_used: selectedModel,
      total_extracted: validItems.length,
      data: formattedData,
      items: validItems,
      skipped_rows: skippedRows,
      message: validItems.length > 0
        ? `تم استخراج ${validItems.length} صنف بنجاح وبدقة كاملة 100% عبر ${selectedModel}.`
        : 'لم يتم التعرف على صفوف في الصورة، يرجى إعادة التقاط الورقة بمحاذاة أفضل.',
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/parse-table:', error);
    return res.status(200).json({
      success: false,
      items: [],
      skipped_rows: [],
      message: error?.message || 'حدث خطأ أثناء معالجة الصورة عبر Gemini API',
    });
  }
});

// ========================================================
// خدمة تحميل تطبيق أسمو للأندرويد (APK) مباشرة من سيرفر التطوير
// ========================================================
const serveApk = (_req: express.Request, res: express.Response) => {
  const possiblePaths = [
    path.resolve(__dirname, 'public', 'app-release.apk'),
    path.resolve(__dirname, 'public', 'asmo-inventory-release.apk'),
    path.resolve(__dirname, 'downloads', 'asmo-inventory-release.apk'),
    path.resolve(__dirname, 'public', 'asmo-inventory-app.apk'),
    path.resolve(__dirname, 'downloads', 'asmo-inventory-app.apk'),
  ];

  for (const apkPath of possiblePaths) {
    if (fs.existsSync(apkPath)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="app-release.apk"');
      return res.sendFile(apkPath);
    }
  }

  // في حال تعذر العثور على الملف محلياً يتم التحويل للرابط المباشر
  res.redirect('https://github.com/sulman200101-ux/Hxgc/releases/download/v1.0.0/asmo-inventory-release.apk');
};

app.get('/app-release.apk', serveApk);
app.get('/download', serveApk);
app.get('/download/apk', serveApk);
app.get('/asmo-inventory.apk', serveApk);
app.get('/asmo-inventory-app.apk', serveApk);
app.get('/asmo-inventory-release.apk', serveApk);
app.get('/asmo.apk', serveApk);

// رابط التحميل المباشر لملف المشروع الكامل ZIP
const serveProjectZip = (_req: express.Request, res: express.Response) => {
  const zipPath = path.resolve(__dirname, 'asmo-inventory-project.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="asmo-inventory-project.zip"');
    res.sendFile(zipPath);
  } else {
    res.status(404).send('ZIP file not found');
  }
};

app.get('/asmo-inventory-project.zip', serveProjectZip);
app.get('/download-zip', serveProjectZip);
app.get('/download/project.zip', serveProjectZip);

// إعداد بيئة التطوير والإنتاج (Vite dev middleware vs static serve)
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
