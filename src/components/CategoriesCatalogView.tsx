import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { dbService } from '../services/db';
import { exportCategoryToPdfFile, exportInventoryListToPdfFile } from '../utils/pdfExportUtil';
import { 
  Package, 
  ArrowRight, 
  MapPin, 
  ChevronLeft, 
  X, 
  Search, 
  Edit3, 
  Trash2,
  Printer,
  FileText,
  CheckCircle2,
  ExternalLink,
  Download,
  ArrowRightLeft,
  FileDown,
  Loader2
} from 'lucide-react';

interface CategoriesCatalogViewProps {
  onBack: () => void;
  onOpenLocation: (locationCode: string) => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (partNumber: string) => void;
  onOpenRelocate: (item: InventoryItem) => void;
}

export const CategoriesCatalogView: React.FC<CategoriesCatalogViewProps> = ({
  onBack,
  onOpenLocation,
  onEditItem,
  onDeleteItem,
  onOpenRelocate,
}) => {
  // جلب تجميع الأصناف الفريدة (GROUP BY category) من قاعدة البيانات
  const categoryGroups = useMemo(() => {
    return dbService.getCategoryGroups();
  }, []);

  // الصنف المختار لعرض قائمته المنبثقة
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // حالة معاينة التقرير في حال حظر النوافذ المنبثقة
  const [previewReport, setPreviewReport] = useState<{
    title: string;
    items: InventoryItem[];
  } | null>(null);

  // القطع المندرجة تحت الصنف المختار بجميع المقاسات والمواقع
  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return dbService.getItemsByCategory(selectedCategory);
  }, [selectedCategory]);

  // تصفية بطاقات الأصناف بالبحث
  const filteredGroups = useMemo(() => {
    if (!searchFilter.trim()) return categoryGroups;
    const q = searchFilter.toLowerCase();
    return categoryGroups.filter((g) => g.category.toLowerCase().includes(q));
  }, [categoryGroups, searchFilter]);

  // أيقونة مناسبة لكل صنف فريد
  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('مسمار') || c.includes('مسامير')) return '🔩';
    if (c.includes('جازكيت')) return '⚙️';
    if (c.includes('لمب') || c.includes('إضاءة')) return '💡';
    if (c.includes('فلنج') || c.includes('أنبوب')) return '⭕';
    if (c.includes('صمام') || c.includes('محبس')) return '🚰';
    if (c.includes('فلتر') || c.includes('مصفا')) return '🌪️';
    if (c.includes('رولمان') || c.includes('محمل')) return '🔘';
    if (c.includes('قياس') || c.includes('ضغط')) return '🧭';
    return '📦';
  };

  /**
   * دالة إنشاء وتصدير تقرير PDF الحقيقي المطلوب
   */
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = async (targetCategory?: string) => {
    setIsExportingPdf(true);
    try {
      if (targetCategory) {
        const itemsToExport = dbService.getItemsByCategory(targetCategory);
        await exportCategoryToPdfFile({
          categoryName: targetCategory,
          items: itemsToExport,
        });
        setExportNotice(`تم تصدير ملف PDF لصنف (${targetCategory}) بنجاح! 📥`);
      } else {
        const itemsToExport = dbService.getAllItems();
        await exportInventoryListToPdfFile({
          items: itemsToExport,
          title: 'تقرير شامل لحركة ونقل أصناف أسمو (ASMO)',
        });
        setExportNotice('تم تصدير ملف PDF الشامل بنجاح! 📥');
      }
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // توليد كود HTML منسق للطباعة و PDF
  const generatePrintableHtml = (title: string, items: InventoryItem[]) => {
    const movedCount = items.filter((i) => i.is_moved === 1 || i.status === 'منقول').length;
    const notMovedCount = items.length - movedCount;
    const dateStr = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const rowsHtml = items
      .map((item, index) => {
        const isMoved = item.is_moved === 1 || item.status === 'منقول';
        const statusText = isMoved ? 'تم النقل' : 'لم تنتقل';
        const badgeColor = isMoved
          ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;'
          : 'background-color: #ffe8d6; color: #d35400; border: 1px solid #f5c6cb;';

        return `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 10px; text-align: center; color: #666; font-size: 11px;">${index + 1}</td>
            <td style="padding: 10px; font-weight: bold; font-family: monospace; direction: ltr; text-align: right; color: #111;">${item.part_number}</td>
            <td style="padding: 10px; color: #222; font-weight: 500;">
              <div>${item.description_ar}</div>
              <div style="font-size: 10px; color: #777; direction: ltr; text-align: right;">${item.description_en}</div>
            </td>
            <td style="padding: 10px; text-align: center; font-weight: bold; color: #2c1e18;">${item.location_code}</td>
            <td style="padding: 10px; text-align: center; font-weight: bold; color: #2e7d32; font-size: 14px;">${item.qty_remaining}</td>
            <td style="padding: 10px; text-align: center;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; ${badgeColor}">
                ${isMoved ? '🟢' : '🟠'} ${statusText}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; color: #333; margin: 0; padding: 15px; direction: rtl; }
          .header { border-bottom: 3px solid #2C1E18; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title-area h1 { margin: 0 0 5px 0; font-size: 20px; color: #2C1E18; }
          .title-area p { margin: 0; font-size: 12px; color: #666; }
          .badge-box { background: #fdf5f0; border: 1px solid #ebd2c1; border-radius: 8px; padding: 10px 15px; font-size: 12px; display: flex; gap: 15px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background-color: #2C1E18; color: #fff; padding: 10px; text-align: center; font-weight: bold; }
          th:nth-child(2), th:nth-child(3) { text-align: right; }
          .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 11px; color: #777; display: flex; justify-content: space-between; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #2C1E18; color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
          <span>📄 جاهز للطباعة أو الحفظ كملف PDF (اضغط Ctrl+P أو زر الطباعة)</span>
          <button onclick="window.print()" style="background: #27AE60; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🖨️ طباعة / حفظ PDF
          </button>
        </div>

        <div class="header">
          <div class="title-area">
            <h1>قطع الغيار - أسمو (ASMO)</h1>
            <p>${title}</p>
          </div>
          <div style="text-align: left; font-size: 12px; color: #555;">
            <div><strong>تاريخ الإصدار:</strong> ${dateStr}</div>
            <div><strong>نظام إدارة الجرد:</strong> ASMO SQLite Core</div>
          </div>
        </div>

        <div class="badge-box">
          <div><strong>إجمالي القطع بالتقرير:</strong> ${items.length} قطعة</div>
          <div style="color: #2e7d32;"><strong>🟢 تم النقل:</strong> ${movedCount} قطعة</div>
          <div style="color: #d35400;"><strong>🟠 لم تنتقل:</strong> ${notMovedCount} قطعة</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th style="width: 130px;">رقم القطعة</th>
              <th>الوصف العربي</th>
              <th style="width: 120px;">الموقع الحالي</th>
              <th style="width: 110px;">الكميات المتبقية</th>
              <th style="width: 110px;">حالة النقل</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <span>نظام الجرد الميداني وتتبع النقل - شركة أسمو</span>
          <span>صفحة 1 من 1</span>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="bg-[#2C1E18] rounded-2xl border border-[#432d24] shadow-2xl overflow-hidden flex flex-col min-h-[650px] relative">
      {/* إشعار تصدير التقرير المنبثق */}
      {exportNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="px-4 py-2.5 rounded-xl bg-emerald-950 text-emerald-200 border border-emerald-700 shadow-2xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{exportNotice}</span>
          </div>
        </div>
      )}

      {/* 1. الشريط العلوي: دليل الأصناف المتشابهة + زر تصدير تقرير PDF */}
      <div className="p-4 bg-[#231713] border-b border-[#3D271F] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-[#3A271F] hover:bg-[#4D342A] text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#543A2F]"
          >
            <ArrowRight className="w-4 h-4" />
            <span>⬅ عودة للمواقع</span>
          </button>

          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-[#E67E22]" />
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                دليل الأصناف
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                  GROUP BY category
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                بطاقة واحدة لكل صنف فريد تجمع كافة المقاسات والمواقع التابعة له
              </p>
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات والبحث وزر تصدير تقرير PDF */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* زر تصدير تقرير PDF الشامل (الخطوة 4) */}
          <button
            onClick={() => handleExportPdf()}
            title="تصدير تقرير حركة ونقل كافة الأصناف كـ PDF"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 border border-emerald-600/50 transition-all cursor-pointer shrink-0"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            <span>تصدير تقرير PDF</span>
          </button>

          {/* شريط بحث سريع داخل الأصناف */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="بحث في أسماء الأصناف..."
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-[#19110D] text-neutral-200 placeholder-neutral-500 border border-[#443027] focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 2. شبكة بطاقات الأصناف الفريدة (بطاقة واحدة لكل اسم فريد بدون تكرار) */}
      <div className="p-5 flex-1 overflow-y-auto">
        <div className="text-xs text-neutral-400 font-semibold mb-3 flex items-center justify-between">
          <span>الأصناف المسجلة بدون تكرار ({filteredGroups.length} صنف):</span>
          <span className="text-amber-400 text-[11px]">اضغط على أي بطاقة لعرض كافة مقاساتها ومواقعها</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredGroups.map((group) => {
            const icon = getCategoryIcon(group.category);
            return (
              <div
                key={group.category}
                onClick={() => setSelectedCategory(group.category)}
                className="bg-[#231713] rounded-2xl p-4 border border-[#432d24] hover:border-amber-500/60 hover:bg-[#281b16] transition-all cursor-pointer group shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-xl bg-[#2F1F19] border border-[#4C3328] flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        {icon}
                      </span>
                      <div>
                        <h3 className="text-base font-black text-white group-hover:text-amber-300 transition-colors">
                          {group.category}
                        </h3>
                        <span className="text-[11px] text-neutral-400">
                          صنف فريد موحد
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-[#3A271F] text-amber-300 text-xs font-mono font-bold border border-[#543A2F]">
                      {group.count} قطع
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#19110D] p-2.5 rounded-xl border border-[#3E2A21] mb-3">
                    <div>
                      <span className="text-neutral-500 block text-[10px]">المواقع المتواجدة بها</span>
                      <span className="font-bold text-amber-200 flex items-center gap-1 font-mono">
                        <MapPin className="w-3 h-3 text-amber-500" />
                        {group.locations_count} موقع
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[10px]">إجمالي المتبقي بالمخزن</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {group.remaining_qty} قطعة
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#34241D] flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300">
                  <span>استعراض المقاسات والمواقع</span>
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. القائمة المنبثقة للقطع المندرجة تحت الصنف بجميع المقاسات والمواقع + زر PDF للصنف */}
      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#2C1E18] border border-[#52382D] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#231713] border-b border-[#3D271F] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">
                  {getCategoryIcon(selectedCategory)}
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    قطع صنف: <span className="text-amber-300 underline">{selectedCategory}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono font-bold">
                      {selectedCategoryItems.length} مقاس/قطعة
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    كافة مقاسات الصنف ومواقع التخزين وحالة النقل
                  </p>
                </div>
              </div>

              {/* أزرار الهيدر في النافذة المنبثقة: زر PDF للصنف وزر الإغلاق */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPdf(selectedCategory)}
                  title="تصدير تقرير حركة النقل لهذا الصنف بملف PDF"
                  className="px-3 py-1.5 rounded-xl bg-[#27AE60] hover:bg-[#219150] text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>تصدير تقرير PDF للصنف</span>
                </button>

                <button
                  onClick={() => setSelectedCategory(null)}
                  className="p-2 rounded-xl bg-[#3A271F] hover:bg-[#4D342A] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* جدول وبطاقات القطع التفصيلية */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {selectedCategoryItems.map((item) => {
                const isMoved = item.is_moved === 1 || item.status === 'تم النقل' || item.status === 'منقول';
                const movedBadge = isMoved ? 'تم النقل 🟢' : 'لم تنتقل 🟠';
                const badgeClass = isMoved
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-600/60';

                return (
                  <div
                    key={item.part_number}
                    className="bg-[#231713] rounded-xl p-3.5 border border-[#432d24] hover:border-amber-500/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 font-medium">الوصف العربي:</span>
                        <h4 className="font-bold text-white text-sm">
                          {item.description_ar}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-neutral-300 pt-0.5">
                        <span className="font-mono text-amber-300 font-bold bg-[#19110D] px-2 py-0.5 rounded border border-[#3D271F]">
                          رقم القطعة: {item.part_number}
                        </span>
                        <span className="text-neutral-600">|</span>
                        <span className="flex items-center gap-1 font-mono text-neutral-200">
                          <MapPin className="w-3.5 h-3.5 text-amber-500" />
                          الموقع الحالي: <strong>{item.location_code}</strong>
                        </span>
                        <span className="text-neutral-600">|</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badgeClass}`}>
                          {movedBadge}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400 font-sans" dir="ltr">
                        {item.description_en}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 justify-end shrink-0">
                      <div className="bg-[#19110D] px-3 py-1.5 rounded-lg border border-[#3E2A21] font-mono text-center">
                        <span className="text-[10px] text-neutral-500 block">الكميات المتبقية</span>
                        <span className="font-bold text-emerald-400 text-sm">{item.qty_remaining}</span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          onOpenRelocate(item);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-sm active:scale-95"
                        title="نقل موقع القطعة 🟢"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                        <span>نقل موقع القطعة 🟢</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          onOpenLocation(item.location_code);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#3A271F] hover:bg-[#4D342A] text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>فتح الموقع</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          onEditItem(item);
                        }}
                        className="p-1.5 rounded-lg bg-[#3A271F] hover:bg-[#4D342A] text-neutral-300 cursor-pointer"
                        title="تعديل"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteItem(item.part_number)}
                        className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 text-red-400 border border-red-900/50 cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#231713] border-t border-[#3D271F] flex items-center justify-between text-xs">
              <span className="text-neutral-400">
                إجمالي قطع هذا الصنف: <strong className="text-white font-mono">{selectedCategoryItems.length}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPdf(selectedCategory)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#27AE60] hover:bg-[#219150] text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة / تصدير PDF</span>
                </button>

                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-1.5 rounded-xl bg-[#3A271F] hover:bg-[#4D342A] text-neutral-200 font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. نافذة معاينة وطباعة التقرير الاحتياطية (في حال حظر النوافذ المنبثقة) */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md">
          <div className="bg-white text-neutral-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-[#2C1E18] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">{previewReport.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#27AE60] hover:bg-[#219150] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة المستند</span>
                </button>
                <button
                  onClick={() => setPreviewReport(null)}
                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 font-sans text-xs">
              <div className="border-b-2 border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-[#2C1E18]">قطع الغيار - أسمو (ASMO)</h2>
                  <p className="text-neutral-500">{previewReport.title}</p>
                </div>
                <div className="text-left text-neutral-600">
                  <div><strong>التاريخ:</strong> {new Date().toLocaleDateString('ar-SA')}</div>
                  <div><strong>إجمالي القطع:</strong> {previewReport.items.length}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#2C1E18] text-white">
                      <th className="p-2 border">#</th>
                      <th className="p-2 border">رقم القطعة</th>
                      <th className="p-2 border">الوصف العربي</th>
                      <th className="p-2 border text-center">الموقع الحالي</th>
                      <th className="p-2 border text-center">الكميات المتبقية</th>
                      <th className="p-2 border text-center">حالة النقل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewReport.items.map((item, idx) => {
                      const isMoved = item.is_moved === 1 || item.status === 'منقول';
                      return (
                        <tr key={item.part_number} className="border-b hover:bg-neutral-50">
                          <td className="p-2 border text-center text-neutral-500">{idx + 1}</td>
                          <td className="p-2 border font-mono font-bold" dir="ltr">{item.part_number}</td>
                          <td className="p-2 border font-semibold">{item.description_ar}</td>
                          <td className="p-2 border text-center font-bold">{item.location_code}</td>
                          <td className="p-2 border text-center font-bold text-emerald-700 text-sm">{item.qty_remaining}</td>
                          <td className="p-2 border text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isMoved ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {isMoved ? '🟢 تم النقل' : '🟠 لم تنتقل'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
