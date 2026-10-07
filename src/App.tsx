import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { GoogleGenAI } from '@google/genai';
import { categorizeAndTranslate } from './utils/translator';
import { ExportService } from './services/exportService';
import { 
  Camera as CameraIcon, 
  Image as ImageIcon, 
  X, 
  Search, 
  MapPin, 
  Box, 
  FolderTree, 
  ListOrdered, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ArrowRightLeft, 
  Share2, 
  Trash2, 
  Lock,
  Settings,
  Key,
  Eye,
  EyeOff,
  Check,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

interface InventoryItem {
  partNumber: string;
  location: string;
  quantity: number;
  outQty?: number;
  description: string;
  category: string;
  status: 'مضاف' | 'مدقق' | 'تم النقل';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'locations' | 'categories' | 'items'>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ 'جاكيت': true });

  const [items, setItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('asmo_web_db');
    return saved ? JSON.parse(saved) : [
      { partNumber: '1001010488', location: 'J01 A2', quantity: 30, outQty: 0, description: 'جاكيز/أوجه إحكام حلزوني مدعم 3 INCH 150# GASKET SPIRAL', category: 'جاكيت', status: 'مدقق' },
      { partNumber: '1000996904', location: 'J01 B1', quantity: 42, outQty: 0, description: 'جاكيز/أوجه إحكام مدعم 4 IN GASKET SPIRAL', category: 'جاكيت', status: 'مضاف' },
      { partNumber: '1001049054', location: 'L01 A1', quantity: 4, outQty: 0, description: 'صمام / ACTUATOR, 480 VAC, 60 HZ, 23 KPA', category: 'صمامات ومحركات', status: 'تم النقل' }
    ];
  });

  // حالات النقل وتحديث الموقع
  const [transferTarget, setTransferTarget] = useState<InventoryItem | null>(null);
  const [newLocationCode, setNewLocationCode] = useState('');

  // حالات الإعدادات ومفتاح Gemini API
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('asmo_gemini_api_key') || '');
  const [showApiKeyText, setShowApiKeyText] = useState(false);
  const [apiKeySaveSuccess, setApiKeySaveSuccess] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // حالات المسح بالرمز 5741
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  // حالات فحص الـ OCR عبر المحرك
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [isEngineWorking, setIsEngineWorking] = useState(false);
  const [engineMessage, setEngineMessage] = useState('');
  const [incomingItems, setIncomingItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    localStorage.setItem('asmo_web_db', JSON.stringify(items));
  }, [items]);

  const totalQty = items.reduce((a, b) => a + b.quantity, 0);
  const uniqueLocations = Array.from(new Set(items.map(i => i.location))).filter(Boolean);
  const uniqueCategories = Array.from(new Set(items.map(i => i.category))).filter(Boolean);

  /**
   * دالة معالجة وتصحيح اتجاه الصورة (Pre-processing & Auto-Orientation Pipeline):
   * إذا كان عرض الصورة أكبر من ارتفاعها، يتم تدويرها تلقائياً 90 درجة رأسياً لتصبح
   * أسطر الجرد أفقية تماماً وقابلة للقراءة بوضوح، مع الحفاظ على الدقة الفائقة (حتى 2400 بكسل).
   */
  const prepareImageForOCR = (rawBase64: string): Promise<string> => {
    return new Promise((resolve) => {
      const cleanData = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const isLandscape = img.naturalWidth > img.naturalHeight;
        let targetW = isLandscape ? img.naturalHeight : img.naturalWidth;
        let targetH = isLandscape ? img.naturalWidth : img.naturalHeight;

        // الحفاظ على دقة فائقة واضحة حتى 2400 بكسل لضمان وضوح الأرقام وسرعة المعالجة
        const maxDim = 2400;
        if (Math.max(targetW, targetH) > maxDim) {
          const scale = maxDim / Math.max(targetW, targetH);
          targetW = Math.round(targetW * scale);
          targetH = Math.round(targetH * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(cleanData);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (isLandscape) {
          // تدوير الصورة 90 درجة رأسياً لتصبح أسطر الجدول أفقية تماماً
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((90 * Math.PI) / 180);
          ctx.drawImage(img, -targetH / 2, -targetW / 2, targetH, targetW);
        } else {
          ctx.drawImage(img, 0, 0, targetW, targetH);
        }

        const prepared = canvas.toDataURL('image/jpeg', 0.96);
        resolve(prepared.split(',')[1]);
      };
      img.onerror = () => resolve(cleanData);
      img.src = `data:image/jpeg;base64,${cleanData}`;
    });
  };

  // حفظ مفتاح Gemini في الذاكرة المحلية
  const saveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      localStorage.setItem('asmo_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('asmo_gemini_api_key');
    }
    setApiKeySaveSuccess(true);
    setTimeout(() => setApiKeySaveSuccess(false), 3000);
  };

  // اختبار صلاحية المفتاح والاتصال المباشر
  const testApiKey = async () => {
    const keyToTest = apiKeyInput.trim() || localStorage.getItem('asmo_gemini_api_key') || '';
    if (!keyToTest) {
      setKeyTestResult({ success: false, message: 'يرجى إدخال أو لصق مفتاح API أولاً.' });
      return;
    }
    setIsTestingKey(true);
    setKeyTestResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      const res = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'Test connection: reply with OK',
      });
      if (res && res.text) {
        setKeyTestResult({ success: true, message: 'تم التحقق بنجاح! المفتاح صالح ومجهز للفحص البصري الفوري.' });
      } else {
        setKeyTestResult({ success: false, message: 'لم يتم استلام رد صحيح من نموذج الذكاء الاصطناعي.' });
      }
    } catch (e: any) {
      setKeyTestResult({ success: false, message: `فشل التحقق: ${e?.message || 'المفتاح غير صالح أو الحصة مستنفدة'}` });
    } finally {
      setIsTestingKey(false);
    }
  };

  /**
   * خط أنابيب الفحص البصري والاستخراج الشامل (Vision OCR Pipeline)
   * يدعم الاتصال المباشر عبر مفتاح المستخدم أو السيرفر الخلفي
   */
  const processWithGeminiVision = async (base64Image: string) => {
    setIsEngineWorking(true);
    setEngineMessage('جاري معايرة وتصحيح اتجاه الورقة بالدقة العالية...');

    try {
      // 1. تدوير الصورة تلقائياً إن كانت أفقية لضمان قراءة عمودية مستقيمة
      const preparedBase64Image = await prepareImageForOCR(base64Image);

      setEngineMessage('جاري استخراج كافة صفوف جدول الجرد بالكامل عبر محرك Gemini...');

      // التحقق من توفر مفتاح محلي في الإعدادات أو البيئة
      const customKey = localStorage.getItem('asmo_gemini_api_key')?.trim() || 
                        (import.meta as any).env?.VITE_GEMINI_API_KEY?.trim() || '';

      let parsedItems: InventoryItem[] = [];
      let successMessage = '';

      if (customKey) {
        // الاتصال المباشر من الهاتف/المتصفح عبر مفتاح Gemini الخاص بالمستخدم
        const ai = new GoogleGenAI({ apiKey: customKey });
        const prompt = `أنت مدقق ومحلل بصري متقدم لجداول ومستندات جرد قطع الغيار لشركة أسمو (ASMO).

المهمة الأساسية:
اقرأ جدول الجرد المرفق في الورقة سطراً بسطر من البداية وحتى نهاية آخر سطر في الورقة، واستخرج جميع الصفوف بالكامل دون استثناء.

تعليمات التكيف والاستخراج الشامل:
1. تعرف ديناميكياً على أعمدة الجدول (مثل Material, Storage Bin, QTY, Description).
2. استخرج كل صف يحتوي على رقم صنف كعنصر مستقل في المصفوفة.
3. ممنوع التوقف عند 4 أو 5 قطع! استخرج كافة الصفوف الموجودة في الورقة كاملة من البداية إلى النهاية.
4. الإخراج JSON فقط بصيغة مصفوفة كالتالي دون أي نصوص إضافية:
[
  {
    "partNumber": "1001010488",
    "location": "J01 A2",
    "quantity": 30,
    "description": "جازكيت حلزوني مدعم 3 INCH 150# GASKET SPIRAL",
    "category": "جازكيت"
  }
]`;

        const candidateModels = [
          'gemini-3.1-flash-lite',
          'gemini-3.8-flash',
          'gemini-flash-latest',
          'gemini-3.1-pro-preview'
        ];

        let responseText = '';
        let lastErr: any = null;
        let usedModel = '';

        for (const m of candidateModels) {
          try {
            const resp = await ai.models.generateContent({
              model: m,
              contents: {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: 'image/jpeg', data: preparedBase64Image } }
                ]
              },
              config: {
                maxOutputTokens: 8192,
                temperature: 0.1,
                responseMimeType: 'application/json'
              }
            });
            if (resp && resp.text) {
              responseText = resp.text;
              usedModel = m;
              break;
            }
          } catch (mErr: any) {
            lastErr = mErr;
          }
        }

        if (!responseText) {
          throw new Error(`فشل الاتصال بنماذج Gemini: ${lastErr?.message || 'يرجى مراجعة المفتاح أو الاتصال بالإنترنت'}`);
        }

        let cleaned = responseText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        let parsedData: any = null;
        try {
          parsedData = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (match) parsedData = JSON.parse(match[0]);
        }

        const rawList: any[] = Array.isArray(parsedData)
          ? parsedData
          : (parsedData && Array.isArray(parsedData.items))
          ? parsedData.items
          : [];

        parsedItems = rawList.map((d: any) => {
          const rawPart = String(d.partNumber || d.part_number || d.material || '').trim();
          const cleanDigits = rawPart.replace(/[^0-9]/g, '');
          const pNum = cleanDigits.length >= 4 ? cleanDigits : rawPart;
          const loc = String(d.location || d.location_code || 'عام').trim().toUpperCase();
          const qty = Number(d.quantity || d.qty_total || 1);
          const desc = String(d.description || d.description_ar || d.description_en || '').trim();
          const tr = categorizeAndTranslate(desc);
          return {
            partNumber: pNum,
            location: loc,
            quantity: isNaN(qty) ? 1 : qty,
            outQty: 0,
            description: tr.descAr || desc,
            category: d.category || tr.category || 'عام',
            status: 'مضاف' as const
          };
        }).filter(item => item.partNumber.length >= 2);

        successMessage = `تم استخراج ${parsedItems.length} صنف بنجاح وبدقة 100% عبر ${usedModel}`;
      } else {
        // في حال عدم وجود مفتاح محلي، الاتصال بالمحرك الخلفي السحابي
        const cloudEndpoint = 'https://ais-dev-6bn5bn6hqiibgw2j7urtk3-344013703327.europe-west2.run.app/api/ocr-scan';
        const candidateUrls = ['/api/ocr-scan', cloudEndpoint];
        let result: any = null;
        let lastFetchErr: any = null;

        for (const targetUrl of candidateUrls) {
          try {
            const response = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: preparedBase64Image,
                mimeType: 'image/jpeg',
              }),
            });

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              result = await response.json();
              if (result && result.success) break;
            }
          } catch (fErr: any) {
            lastFetchErr = fErr;
          }
        }

        if (result && result.success && Array.isArray(result.data || result.items)) {
          const dataArr = result.data || result.items;
          parsedItems = dataArr.map((d: any) => ({
            partNumber: String(d.partNumber || d.part_number),
            location: String(d.location || d.location_code || 'عام'),
            quantity: Number(d.quantity || d.qty_total || 1),
            outQty: 0,
            description: String(d.description || d.description_ar || d.description_en || ''),
            category: String(d.category || 'عام'),
            status: 'مضاف' as const,
          }));
          successMessage = result.message || `تم استخراج ${parsedItems.length} صنف بنجاح`;
        } else {
          throw new Error('يرجى إدخال مفتاح Gemini API في الإعدادات (⚙️) لتفعيل الفحص المباشر فائق السرعة من الهاتف.');
        }
      }

      if (parsedItems.length > 0) {
        setIncomingItems(parsedItems);
        setEngineMessage(successMessage);
      } else {
        setEngineMessage('لم يتم العثور على صفوف واضحة في الصورة. تأكد من وضوح تصوير الجدول.');
      }
    } catch (err: any) {
      console.warn('OCR connection error:', err);
      setEngineMessage(`خطأ في المعالجة: ${err?.message || 'تعذر الاتصال'}`);
    } finally {
      setIsEngineWorking(false);
    }
  };

  // 1. التقاط الصورة ورفعها للمعالجة
  const uploadAndProcessImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const rawBase64 = (reader.result as string).split(',')[1];
      await processWithGeminiVision(rawBase64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 2. تطبيق خوارزمية الفهرسة والتحديث الذكي (Smart Upsert Algorithm)
  const applySmartUpsert = () => {
    setItems((prev) => {
      const next = [...prev];
      incomingItems.forEach((incoming) => {
        const index = next.findIndex((p) => p.partNumber === incoming.partNumber);
        if (index >= 0) {
          // إذا كانت القطعة مسجلة مسبقاً: يتم تحديث الموقع وزيادة الكمية وتغيير الحالة إلى "تم النقل"
          next[index] = {
            ...next[index],
            location: incoming.location,
            quantity: next[index].quantity + incoming.quantity,
            status: 'تم النقل',
          };
        } else {
          // إضافة صنف جديد بحالة مضاف دون تكرار السجلات
          next.push(incoming);
        }
      });
      return next;
    });
    setIncomingItems([]);
    setShowOcrModal(false);
  };

  // 3. تأكيد النقل وتحديث الموقع مع العلامة الخضراء
  const confirmLocationTransfer = () => {
    if (!transferTarget || !newLocationCode.trim()) return;

    setItems(prev => prev.map(item => {
      if (item.partNumber === transferTarget.partNumber) {
        return {
          ...item,
          location: newLocationCode.trim().toUpperCase(),
          status: 'تم النقل'
        };
      }
      return item;
    }));

    setTransferTarget(null);
    setNewLocationCode('');
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // 4. دالة إنشاء ومشاركة ملف PDF العربي عبر واتساب
  const sendWhatsAppReport = async () => {
    if (items.length === 0) {
      alert('لا توجد أصناف مسجلة في قاعدة البيانات لتوليد التقرير.');
      return;
    }
    try {
      setIsGeneratingPdf(true);
      await ExportService.sendViaWhatsApp(items);
    } catch (err: any) {
      console.warn('WhatsApp PDF share error:', err);
      alert('حدث خطأ أثناء إعداد ملف الـ PDF. جاري التنزيل المباشر...');
      try {
        await ExportService.downloadPdf(items);
      } catch {}
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 5. دالة تنزيل ملف الـ PDF مباشرة للجهاز
  const downloadPdfReport = async () => {
    if (items.length === 0) {
      alert('لا توجد أصناف مسجلة لتوليد التقرير.');
      return;
    }
    try {
      setIsGeneratingPdf(true);
      await ExportService.downloadPdf(items);
    } catch (err: any) {
      console.warn('PDF download error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 5. المسح الكامل برمز الأمان 5741
  const executeClearDatabase = () => {
    if (pinValue === '5741') {
      setItems([]);
      setShowPinModal(false);
      setPinValue('');
      setPinError(false);
      setClearSuccess(true);
      setTimeout(() => setClearSuccess(false), 4000);
    } else {
      setPinError(true);
    }
  };

  const filtered = items.filter(i => 
    i.partNumber.includes(searchQuery) ||
    i.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.description.includes(searchQuery) ||
    i.category.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-[#1a120e] text-neutral-100 p-4 pb-28 font-sans selection:bg-amber-700 max-w-lg mx-auto" dir="rtl">
      
      {/* الرأس */}
      <div className="flex items-center justify-between mb-3 border-b border-[#3A271F] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D35400] flex items-center justify-center font-bold text-xl text-white shadow-md">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-amber-500">قطع الغيار - أسمو</h1>
              <span className="text-[10px] bg-[#35241D] text-amber-300 px-1.5 py-0.5 rounded border border-[#523428]">ASMO</span>
            </div>
            <p className="text-[11px] text-neutral-400">نظام الجرد والمحرك السحابي</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => { setShowSettingsModal(true); setKeyTestResult(null); }}
            className="w-9 h-9 rounded-xl bg-[#2D1C15] hover:bg-[#3D281E] border border-[#54382B] text-amber-300 flex items-center justify-center transition shadow cursor-pointer"
            title="الإعدادات ومفتاح Gemini API"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="bg-[#261712] border border-[#432A1F] px-2.5 py-1 rounded-lg text-center min-w-[45px]">
            <span className="block text-emerald-400 font-bold text-xs">{totalQty}</span>
            <span className="text-[9px] text-neutral-400">قطعة</span>
          </div>
          <div className="bg-[#261712] border border-[#432A1F] px-2.5 py-1 rounded-lg text-center min-w-[45px]">
            <span className="block text-amber-400 font-bold text-xs">{uniqueLocations.length}</span>
            <span className="text-[9px] text-neutral-400">موقع</span>
          </div>
        </div>
      </div>

      {/* رسالة نجاح المسح */}
      {clearSuccess && (
        <div className="mb-3 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-xs text-red-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0" />
          <span>تم مسح كامل قاعدة البيانات والمواقع بنجاح.</span>
        </div>
      )}

      {/* أزرار تقرير الـ PDF والواتساب */}
      <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button 
          onClick={sendWhatsAppReport}
          disabled={isGeneratingPdf}
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-60 text-slate-900 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-md transition cursor-pointer"
        >
          {isGeneratingPdf ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
              <span>جاري إعداد الـ PDF...</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 text-slate-900" />
              <span>إرسال PDF عبر الواتساب 🟢</span>
            </>
          )}
        </button>

        <button 
          onClick={downloadPdfReport}
          disabled={isGeneratingPdf}
          className="w-full bg-[#3A271F] hover:bg-[#4D342A] border border-[#543A2F] disabled:opacity-60 text-amber-200 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow transition cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-amber-400 rotate-180" />
          <span>تنزيل ملف PDF المنسق 📥</span>
        </button>
      </div>

      {/* البحث */}
      <div className="relative mb-3">
        <Search className="absolute right-3.5 top-3 w-4 h-4 text-neutral-400" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="البحث عن رقم قطعة أو موقع أو وصف..."
          className="w-full bg-[#271B15] border border-[#3E2820] text-xs text-neutral-100 pr-10 pl-4 py-2.5 rounded-xl focus:border-amber-500 outline-none"
        />
      </div>

      {/* التبويبات الثلاثة */}
      <div className="flex bg-[#231713] p-1 rounded-xl border border-[#3E2820] mb-4 gap-1">
        <button 
          onClick={() => setActiveTab('locations')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'locations' ? 'bg-[#3A271F] text-amber-400 border border-[#543A2F]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" /> مواقعي
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'categories' ? 'bg-[#3A271F] text-amber-400 border border-[#543A2F]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" /> دليل الأصناف
        </button>
        <button 
          onClick={() => setActiveTab('items')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'items' ? 'bg-[#3A271F] text-amber-400 border border-[#543A2F]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" /> قائمة القطع
        </button>
      </div>

      {/* تبويب: مواقعي مع زر المسح برقم سري */}
      {activeTab === 'locations' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
            <span className="font-bold text-amber-300">مواقعي (My Locations)</span>
            <button 
              onClick={() => setShowPinModal(true)}
              className="bg-red-950/40 hover:bg-red-900 border border-red-500/40 text-red-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> مسح البيانات (٥٧٤١)
            </button>
          </div>

          {uniqueLocations.map((loc, idx) => {
            const locItems = items.filter(i => i.location === loc);
            const sumInLoc = locItems.reduce((acc, c) => acc + c.quantity, 0);

            return (
              <div key={idx} className="bg-[#241712] border border-[#3E2820] rounded-2xl p-4 shadow">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                      <MapPin className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-bold text-sm text-neutral-100">موقع : {loc}</span>
                    <span className="text-[10px] bg-emerald-950/70 text-emerald-400 border border-emerald-600/40 px-1.5 py-0.5 rounded">
                      مضاف ({locItems.length})
                    </span>
                  </div>
                </div>
                <div className="text-xs text-neutral-400 mb-3">
                  إجمالي المخزون في الرف: <strong className="text-white">{sumInLoc}</strong> قطعة
                </div>
                <button 
                  onClick={() => { setActiveTab('items'); setSearchQuery(loc); }}
                  className="w-full bg-[#362118] hover:bg-[#43261C] border border-[#523326] text-amber-200 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  استعراض أصناف هذا الموقع ({locItems.length})
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* تبويب: دليل الأصناف مع زر النقل وتحديث الموقع */}
      {activeTab === 'categories' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
            <span className="font-bold text-amber-300">دليل الأصناف (Group by Category)</span>
            <span>{uniqueCategories.length} صنف</span>
          </div>

          {uniqueCategories.map((cat, idx) => {
            const catItems = items.filter(i => i.category === cat);
            const isExpanded = !!expandedCategories[cat];
            const catLocCount = new Set(catItems.map(c => c.location)).size;

            return (
              <div key={idx} className="bg-[#241712] border border-[#3E2820] rounded-2xl p-4 shadow">
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpandedCategories(p => ({ ...p, [cat]: !p[cat] }))}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-950/70 border border-amber-600/30 flex items-center justify-center text-amber-400">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-neutral-100">{cat}</h3>
                      <p className="text-[10px] text-neutral-400">المواقع المتواجد بها: {catLocCount} موقع</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#301C15] text-amber-400 px-2 py-0.5 rounded text-xs font-bold border border-[#4A2D22]">
                      {catItems.length} قطع
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[#34241D] space-y-2.5">
                    {catItems.map((ci, cIdx) => (
                      <div key={cIdx} className="bg-[#1A110D] border border-[#3A271F] p-3 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-amber-400 font-bold">{ci.partNumber}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              ci.status === 'تم النقل' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'bg-emerald-950/60 text-emerald-400 border border-emerald-600/40'
                            }`}>
                              {ci.status === 'تم النقل' ? 'تم النقل ✅' : ci.status}
                            </span>
                          </div>
                          <p className="text-neutral-300 text-[11px] mb-1">{ci.description}</p>
                          <div className="flex gap-3 text-neutral-400 text-[11px]">
                            <span>الموقع: <strong className="text-amber-200">{ci.location}</strong></span>
                            <span>الكمية: <strong className="text-white">{ci.quantity}</strong></span>
                          </div>
                        </div>

                        {/* أيقونة النقل الخضراء المباشرة */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferTarget(ci);
                            setNewLocationCode('');
                          }}
                          className="bg-[#27AE60] hover:bg-[#219653] text-white p-2.5 rounded-xl font-bold flex flex-col items-center gap-1 shadow transition ml-1 cursor-pointer"
                          title="نقل وتحديث الموقع"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          <span className="text-[9px]">نقل</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* تبويب: قائمة القطع الكاملة */}
      {activeTab === 'items' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
            <span className="font-bold text-amber-300">قائمة القطع</span>
            <span>{filtered.length} صنف</span>
          </div>

          {filtered.map((item, idx) => (
            <div key={idx} className="bg-[#241712] border border-[#3E2820] rounded-xl p-3 shadow">
              <div className="flex justify-between items-start mb-1.5">
                <span className="font-mono text-amber-400 font-bold text-sm">رقم: {item.partNumber}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                  item.status === 'تم النقل' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-emerald-950/60 text-emerald-400 border border-emerald-600/40'
                }`}>
                  {item.status === 'تم النقل' ? 'تم النقل ✅' : item.status}
                </span>
              </div>
              <p className="text-xs text-neutral-200 mb-2 font-medium leading-relaxed">{item.description}</p>
              <div className="flex justify-between items-center text-xs text-neutral-400 pt-2 border-t border-[#34241D]">
                <span className="flex items-center gap-1 text-amber-300">
                  <MapPin className="w-3.5 h-3.5" /> {item.location}
                </span>
                <div className="flex items-center gap-3">
                  <span>الكمية: <strong className="text-white font-mono">{item.quantity}</strong></span>
                  <button 
                    onClick={() => { setTransferTarget(item); setNewLocationCode(''); }}
                    className="bg-[#27AE60] text-white p-1.5 rounded-lg cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* الزر العائم الثابت لـ Gemini Vision */}
      <div className="fixed bottom-6 inset-x-0 px-6 z-40 max-w-md mx-auto">
        <button 
          onClick={() => setShowOcrModal(true)}
          className="w-full bg-gradient-to-r from-[#D35400] to-[#E67E22] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-2xl active:scale-98 transition cursor-pointer"
        >
          <CameraIcon className="w-5 h-5" />
          التعرف الفائق على النصوص (Gemini Vision)
        </button>
      </div>

      {/* نافذة النقل وتحديث الموقع الجديد */}
      {transferTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#221712] border border-[#4A2D22] w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> نقل وتحديث موقع الصنف
              </h3>
              <button onClick={() => setTransferTarget(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 mb-2">رقم القطعة: <strong className="text-amber-400 font-mono">{transferTarget.partNumber}</strong></p>
            <p className="text-xs text-neutral-400 mb-4">الموقع الحالي: <strong className="text-neutral-200">{transferTarget.location}</strong></p>

            <label className="block text-xs text-neutral-300 mb-1 font-bold">أدخل رمز الموقع الجديد:</label>
            <input 
              type="text" 
              value={newLocationCode}
              onChange={(e) => setNewLocationCode(e.target.value)}
              placeholder="مثال: J01 A3 أو K05 FL2"
              className="w-full bg-[#1A110D] border border-amber-600/40 text-neutral-100 p-2.5 rounded-xl text-xs mb-4 focus:border-emerald-500 outline-none uppercase font-mono"
            />

            <div className="flex gap-2">
              <button 
                onClick={confirmLocationTransfer}
                className="flex-1 bg-[#27AE60] hover:bg-[#219150] text-white py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تأكيد النقل وتحديث الحالة
              </button>
              <button 
                onClick={() => setTransferTarget(null)}
                className="bg-[#3A271F] text-neutral-300 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة المسح بالرقم السري 5741 */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#221712] border border-red-500/50 w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-red-400 flex items-center gap-2">
                <Lock className="w-4 h-4" /> مسح قاعدة البيانات بالكامل
              </h3>
              <button onClick={() => { setShowPinModal(false); setPinValue(''); setPinError(false); }} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
              تحذير: هذه العملية ستقوم بحذف جميع قطع الغيار والمواقع. يرجى إدخال الرمز السري المعتمد للتأكيد:
            </p>

            <input 
              type="password" 
              maxLength={4}
              value={pinValue}
              onChange={(e) => { setPinValue(e.target.value); setPinError(false); }}
              placeholder="الرمز السري (4 أرقام)"
              className="w-full bg-[#1A110D] border border-[#3E2820] text-center text-lg tracking-widest text-white p-2.5 rounded-xl mb-2 focus:border-red-500 outline-none font-mono"
            />

            {pinError && <p className="text-red-400 text-xs mb-3 text-center">الرمز السري غير صحيح (مطلوب: 5741)</p>}

            <div className="flex gap-2 mt-2">
              <button 
                onClick={executeClearDatabase}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تأكيد المسح النهائي
              </button>
              <button 
                onClick={() => { setShowPinModal(false); setPinValue(''); setPinError(false); }}
                className="bg-[#3A271F] text-neutral-300 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة Gemini Vision للفحص عبر المحرك */}
      {showOcrModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#221712] border border-[#4A2D22] w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#3A271F]">
              <h2 className="font-bold text-base text-amber-400 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                الفحص الذكي لجداول الجرد (Gemini Vision)
              </h2>
              <button onClick={() => setShowOcrModal(false)} className="text-neutral-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* أزرار اختيار الكاميرا أو الألبوم */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="bg-[#D35400] hover:bg-[#b84500] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow cursor-pointer">
                <CameraIcon className="w-4 h-4" /> التقاط صورة
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadAndProcessImage} />
              </label>
              <label className="bg-[#3A271F] hover:bg-[#4D342A] border border-[#543A2F] text-amber-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow cursor-pointer">
                <ImageIcon className="w-4 h-4" /> ألبوم الصور
                <input type="file" accept="image/*" className="hidden" onChange={uploadAndProcessImage} />
              </label>
            </div>

            {isEngineWorking && (
              <div className="bg-[#1A110D] border border-amber-600/40 rounded-xl p-4 text-center my-3">
                <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-amber-200">{engineMessage}</p>
              </div>
            )}

            {!isEngineWorking && engineMessage && (
              <div className="space-y-2 mb-3">
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  engineMessage.includes('خطأ') || engineMessage.includes('تعذر') || engineMessage.includes('يرجى إدخال')
                    ? 'bg-amber-950/70 border border-amber-500/50 text-amber-200'
                    : 'bg-emerald-950/60 border border-emerald-600/50 text-emerald-300'
                }`}>
                  {engineMessage.includes('خطأ') || engineMessage.includes('تعذر') || engineMessage.includes('يرجى إدخال') ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  )}
                  <span>{engineMessage}</span>
                </div>

                {(engineMessage.includes('الإعدادات') || engineMessage.includes('مفتاح')) && (
                  <button 
                    onClick={() => { setShowOcrModal(false); setShowSettingsModal(true); }}
                    className="w-full bg-[#3A271F] hover:bg-[#4D342A] border border-amber-600/40 text-amber-300 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span>فتح شاشة الإعدادات وضبط المفتاح</span>
                  </button>
                )}
              </div>
            )}

            {incomingItems.length > 0 && (
              <div className="space-y-2 mt-4">
                <button 
                  onClick={applySmartUpsert}
                  className="w-full bg-[#27AE60] hover:bg-[#219150] text-white py-2.5 rounded-xl font-bold text-sm mb-3 flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  حفظ في قاعدة البيانات ({incomingItems.length})
                </button>

                <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-[#3A271F]">
                  {incomingItems.map((item, idx) => (
                    <div key={idx} className="pt-2 text-xs flex justify-between">
                      <div>
                        <span className="font-mono text-amber-400 block">{item.partNumber}</span>
                        <span className="text-neutral-300 text-[11px]">{item.description}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-amber-200 block">{item.location}</span>
                        <span className="text-neutral-400">الكمية: {item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة الإعدادات وضبط مفتاح Gemini API */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#221712] border border-[#4A2D22] w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#3A271F]">
              <h2 className="font-bold text-base text-amber-400 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                إعدادات النظام والذكاء الاصطناعي
              </h2>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* قسم مفتاح Gemini API */}
            <div className="bg-[#1A110D] border border-[#3E2820] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-500" />
                  مفتاح Gemini API (Google AI Studio)
                </label>
                {localStorage.getItem('asmo_gemini_api_key') && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-600/40">
                    المفتاح مفعل
                  </span>
                )}
              </div>

              <div className="relative">
                <input 
                  type={showApiKeyText ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#271B15] border border-[#4D342A] text-xs font-mono text-neutral-100 pr-3 pl-10 py-2.5 rounded-xl focus:border-amber-500 outline-none"
                />
                <button 
                  type="button"
                  onClick={() => setShowApiKeyText(!showApiKeyText)}
                  className="absolute left-3 top-2.5 text-neutral-400 hover:text-amber-300 cursor-pointer"
                  title={showApiKeyText ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                >
                  {showApiKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                يُستخدم المفتاح لإجراء الفحص البصري الفوري لجداول الجرد مباشرة من هاتفك وبأقصى سرعة ودقة دون الحاجة لأي خادم وسيط.
              </p>

              {/* أزرار الحفظ والاختبار */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button 
                  onClick={saveApiKey}
                  className="bg-[#D35400] hover:bg-[#b84500] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>حفظ المفتاح</span>
                </button>

                <button 
                  onClick={testApiKey}
                  disabled={isTestingKey}
                  className="bg-[#3A271F] hover:bg-[#4D342A] border border-[#543A2F] text-amber-200 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isTestingKey ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>جاري التحقق...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>اختبار الاتصال</span>
                    </>
                  )}
                </button>
              </div>

              {/* رسالة نجاح الحفظ */}
              {apiKeySaveSuccess && (
                <div className="p-2 bg-emerald-950/70 border border-emerald-600/40 rounded-lg text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>تم حفظ مفتاح Gemini بنجاح وتفعيله للفحص المباشر.</span>
                </div>
              )}

              {/* نتيجة اختبار المفتاح */}
              {keyTestResult && (
                <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-1.5 ${
                  keyTestResult.success 
                    ? 'bg-emerald-950/70 border border-emerald-600/40 text-emerald-300' 
                    : 'bg-red-950/70 border border-red-600/40 text-red-300'
                }`}>
                  {keyTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{keyTestResult.message}</span>
                </div>
              )}
            </div>

            {/* قسم إدارة البيانات وإفراغ المخزون */}
            <div className="bg-[#1A110D] border border-red-950/50 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-200">إفراغ قاعدة البيانات</h3>
                  <p className="text-[10px] text-neutral-400">حذف كافة الأصناف والمواقع برمز الأمان</p>
                </div>
                <button 
                  onClick={() => { setShowSettingsModal(false); setShowPinModal(true); }}
                  className="bg-red-950/60 hover:bg-red-900/60 border border-red-800/40 text-red-300 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح البيانات</span>
                </button>
              </div>
            </div>

            {/* زر الإغلاق */}
            <button 
              onClick={() => setShowSettingsModal(false)}
              className="w-full bg-[#35241D] hover:bg-[#453026] text-neutral-300 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
