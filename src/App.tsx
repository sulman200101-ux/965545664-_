import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
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
  Lock 
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

  /**
   * خط أنابيب الفحص البصري والاستخراج الشامل (Vision OCR Pipeline)
   */
  const processWithGeminiVision = async (base64Image: string) => {
    setIsEngineWorking(true);
    setEngineMessage('جاري معايرة وتصحيح اتجاه الورقة بالدقة العالية...');

    try {
      // 1. تدوير الصورة تلقائياً إن كانت أفقية لضمان قراءة عمودية مستقيمة
      const preparedBase64Image = await prepareImageForOCR(base64Image);

      setEngineMessage('جاري استخراج كافة صفوف جدول الجرد بالكامل عبر محرك Gemini...');

      // 2. الاتصال بالمحرك الخلفي المزود بشلال النماذج فائق السرعة
      // تحديد الرابط المناسب (دعم الأندرويد والويب ومحاكيات Capacitor)
      const cloudEndpoint = 'https://ais-dev-6bn5bn6hqiibgw2j7urtk3-344013703327.europe-west2.run.app/api/ocr-scan';
      const isNativeApp = typeof window !== 'undefined' && (
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        Boolean((window as any).Capacitor?.isNativePlatform?.())
      );

      const candidateUrls = isNativeApp
        ? [cloudEndpoint, '/api/ocr-scan']
        : ['/api/ocr-scan', cloudEndpoint];

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
          if (!contentType.includes('application/json')) {
            // إذا أعاد الخادم المحلي صفحة HTML بدلاً من JSON داخل الأندرويد
            continue;
          }

          result = await response.json();
          if (result) break;
        } catch (fErr: any) {
          lastFetchErr = fErr;
        }
      }

      if (!result) {
        throw new Error(lastFetchErr?.message || 'تعذر الاتصال بخادم الذكاء الاصطناعي. يرجى التأكد من توفر اتصال بالإنترنت.');
      }

      const dataArr = result.data || result.items;

      if (result.success && Array.isArray(dataArr) && dataArr.length > 0) {
        const parsed: InventoryItem[] = dataArr.map((d: any) => ({
          partNumber: String(d.partNumber || d.part_number),
          location: String(d.location || d.location_code || 'عام'),
          quantity: Number(d.quantity || d.qty_total || 1),
          outQty: 0,
          description: String(d.description || d.description_ar || d.description_en || ''),
          category: String(d.category || 'عام'),
          status: 'مضاف',
        }));
        setIncomingItems(parsed);
        setEngineMessage(result.message || `تم استخراج كافة صفوف الجدول بنجاح (${parsed.length} صنف بالكامل)`);
      } else {
        setEngineMessage(result.message || result.error || 'لم يتم التعرف على بنية جدول صالحة. تأكد من وضوح تصوير الورقة.');
      }
    } catch (err: any) {
      console.warn('OCR connection error:', err);
      setEngineMessage(`خطأ في المعالجة: ${err?.message || 'تعذر الاتصال بخادم الفحص'}`);
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

  // 4. دالة إنشاء ملف PDF حقيقي وإرساله عبر واتساب
  const sendWhatsAppReport = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      // إضافة ترويسة التقرير
      doc.setFontSize(16);
      doc.text("ASMO Spare Parts Inventory Report", 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Date: ${new Date().toISOString().slice(0, 10)}`, 20, 30);
      doc.text(`Total Items: ${totalQty}  |  Locations: ${uniqueLocations.length}`, 20, 36);

      // رسم خط فاصل
      doc.setLineWidth(0.5);
      doc.line(20, 40, 190, 40);

      // كتابة بيانات القطع
      let yPosition = 50;
      doc.setFontSize(9);

      items.forEach((item, index) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        doc.text(`${index + 1}. Part: ${item.partNumber}`, 20, yPosition);
        doc.text(`Loc: ${item.location}  |  Qty: ${item.quantity}  |  Status: ${item.status}`, 80, yPosition);
        yPosition += 5;
        
        // الوصف
        const desc = doc.splitTextToSize(`Desc: ${item.description}`, 160);
        doc.text(desc, 20, yPosition);
        yPosition += desc.length * 5 + 3;

        doc.setDrawColor(200, 200, 200);
        doc.line(20, yPosition - 1, 190, yPosition - 1);
        yPosition += 4;
      });

      // تحويل الـ PDF إلى ملف Blob
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `تقرير-الجرد-${new Date().toISOString().slice(0, 10)}.pdf`, {
        type: 'application/pdf',
      });

      // المشاركة المباشرة لملف الـ PDF مع واتساب عبر نظام الجوال
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: 'تقرير الجرد - أسمو',
            text: 'مرفق تقرير جرد قطع الغيار بصيغة PDF',
          });
        } catch (shareErr: any) {
          // إذا ألغى المستخدم نافذة المشاركة، يتم التنزيل التلقائي كخيار بديل
          if (
            shareErr?.name === 'AbortError' ||
            String(shareErr?.message).toLowerCase().includes('cancel')
          ) {
            return;
          }
          doc.save(`تقرير-الجرد-${new Date().toISOString().slice(0, 10)}.pdf`);
        }
      } else {
        // في حال عدم دعم المشاركة المباشرة، يتم تنزيله تلقائياً
        doc.save(`تقرير-الجرد-${new Date().toISOString().slice(0, 10)}.pdf`);
      }
    } catch (error: any) {
      if (
        error?.name === 'AbortError' ||
        String(error?.message).toLowerCase().includes('cancel')
      ) {
        return;
      }
      console.warn('ملاحظة توليد الـ PDF:', error);
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

        <div className="flex gap-1.5">
          <div className="bg-[#261712] border border-[#432A1F] px-2.5 py-1 rounded-lg text-center min-w-[50px]">
            <span className="block text-emerald-400 font-bold text-xs">{totalQty}</span>
            <span className="text-[9px] text-neutral-400">قطعة</span>
          </div>
          <div className="bg-[#261712] border border-[#432A1F] px-2.5 py-1 rounded-lg text-center min-w-[50px]">
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

      {/* زر تقرير الواتساب */}
      <div className="mb-3">
        <button 
          onClick={sendWhatsAppReport}
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-slate-900 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md transition cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-slate-900" />
          <span>رفع تقرير PDF / مشاركة عبر الواتساب</span>
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
              <div className="bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{engineMessage}</span>
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

    </div>
  );
}
