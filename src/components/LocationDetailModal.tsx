import React, { useState } from 'react';
import { InventoryItem, LocationSummary } from '../types';
import { exportLocationToPdfFile } from '../utils/pdfExportUtil';
import { 
  ArrowRight, 
  Printer, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  Search,
  FileDown,
  MapPin,
  ArrowRightLeft,
  Loader2
} from 'lucide-react';

interface LocationDetailModalProps {
  locationCode: string | null;
  summary: LocationSummary | undefined;
  items: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (partNumber: string) => void;
  onAddNewItemForLocation: (locationCode: string) => void;
  onMarkItemStatus: (partNumber: string, status: InventoryItem['status']) => void;
  onOpenRelocate: (item: InventoryItem) => void;
  onExportPdf?: (locationCode: string) => void;
}

export const LocationDetailModal: React.FC<LocationDetailModalProps> = ({
  locationCode,
  summary,
  items,
  isOpen,
  onClose,
  onEditItem,
  onDeleteItem,
  onAddNewItemForLocation,
  onMarkItemStatus,
  onOpenRelocate,
  onExportPdf,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen || !locationCode) return null;

  const filtered = items.filter((i) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      i.part_number.toLowerCase().includes(q) ||
      i.description_ar.toLowerCase().includes(q) ||
      i.description_en.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  });

  const handleExportPdf = async () => {
    if (onExportPdf) {
      onExportPdf(locationCode);
    }
    
    setIsExportingPdf(true);
    try {
      await exportLocationToPdfFile({
        locationCode,
        items,
        summary,
      });
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#2C1E18] border border-[#52382D] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* الشريط العلوي مطابق تماماً لـ LocationDetailsScreen */}
        <div className="p-4 bg-[#231713] border-b border-[#3D271F] flex flex-wrap items-center justify-between gap-3">
          {/* btn_back: ⬅ عودة */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#3A271F] hover:bg-[#4D342A] text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#543A2F]"
            >
              <ArrowRight className="w-4 h-4" />
              <span>⬅ عودة</span>
            </button>

            {/* lbl_loc_name: تفاصيل الموقع: {loc_code} */}
            <h2 className="text-base sm:text-lg font-black text-white font-mono flex items-center gap-2">
              تفاصيل الموقع: {locationCode}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* btn_pdf: تصدير ملف PDF */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-4 py-1.5 rounded-xl bg-[#27AE60] hover:bg-[#219653] disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-95"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span>تصدير ملف PDF</span>
            </button>

            {/* إضافة صنف */}
            <button
              onClick={() => onAddNewItemForLocation(locationCode)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صنف</span>
            </button>
          </div>
        </div>

        {/* تنبيه التصدير بنجاح */}
        {showExportSuccess && (
          <div className="bg-[#27AE60]/20 border-b border-[#27AE60]/40 p-2.5 px-4 text-xs font-bold text-emerald-300 flex items-center justify-between">
            <span>تم إنشاء وتجهيز تقرير PDF للموقع {locationCode} بنجاح!</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        )}

        {/* 4 Stats Grid */}
        {summary && (
          <div className="p-3.5 bg-[#1F1511] border-b border-[#3A271F]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2 rounded-xl bg-[#271B15] border border-[#3C271E] text-center">
                <span className="text-[10px] text-neutral-400 block mb-0.5">المخزون (Total)</span>
                <span className="text-base font-black text-amber-300 font-mono">
                  {summary.total_qty.toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#271B15] border border-[#3C271E] text-center">
                <span className="text-[10px] text-neutral-400 block mb-0.5">الخارج (Out)</span>
                <span className="text-base font-black text-orange-400 font-mono">
                  {summary.out_qty.toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#271B15] border border-[#3C271E] text-center">
                <span className="text-[10px] text-neutral-400 block mb-0.5">المتبقي (Remaining)</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {summary.remaining_qty.toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#271B15] border border-[#3C271E] text-center">
                <span className="text-[10px] text-neutral-400 block mb-0.5">أصناف القطع (قطعة)</span>
                <span className="text-base font-black text-purple-400 font-mono">
                  {summary.item_count.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search inside location */}
        <div className="p-3 bg-[#231713] border-b border-[#3D271F]">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="🔍 تصفية القطع داخل هذا الموقع..."
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-[#19110D] text-xs text-neutral-100 placeholder-neutral-500 border border-[#432d24] focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* منطقة القائمة: scroll_frame matching CustomTkinter card content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-xs">
              لا توجد قطع مطابقة للبحث داخل هذا الموقع
            </div>
          ) : (
            filtered.map((item) => {
              const isMoved = item.is_moved === 1 || item.status === 'منقول' || item.status === 'تم النقل';
              const statusText = isMoved ? 'تم النقل 🟡' : (item.status === 'غير مدقق' ? 'غير مدقق' : 'مضاف');

              return (
                <div
                  key={item.part_number}
                  className="bg-[#231713] rounded-xl p-3.5 border border-[#432d24] hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 space-y-1">
                    {/* الوصف: {desc_ar} */}
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400 font-medium">الوصف:</span>
                      <h4 className="font-bold text-neutral-100 text-sm">
                        {item.description_ar}
                      </h4>
                    </div>

                    {/* رقم القطعة: {part_num} | المخزون: {total} | الخارج: {out_qty} | المتبقي: {remaining} | الحالة: {status_text} */}
                    <div className="flex flex-wrap items-center gap-2 text-neutral-300 pt-0.5">
                      <span className="font-mono text-amber-300 font-bold bg-[#19110D] px-2 py-0.5 rounded border border-[#3D271F]">
                        رقم القطعة: {item.part_number}
                      </span>
                      <span className="text-neutral-500">|</span>
                      <span>المخزون: <strong className="text-amber-300 font-mono">{item.qty_total}</strong></span>
                      <span className="text-neutral-500">|</span>
                      <span>الخارج: <strong className="text-orange-400 font-mono">{item.qty_out}</strong></span>
                      <span className="text-neutral-500">|</span>
                      <span>المتبقي: <strong className="text-emerald-400 font-mono">{item.qty_remaining}</strong></span>
                      <span className="text-neutral-500">|</span>
                      {isMoved || item.status === 'تم النقل' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 inline-flex items-center gap-1 shadow-sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          تم النقل 🟢
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-600/60 inline-flex items-center gap-1">
                          لم تنتقل 🟠
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-neutral-400 font-sans" dir="ltr">
                      {item.description_en}
                    </p>
                  </div>

                  {/* Actions (نقل موقع القطعة، تعديل، حذف، اعتماد) */}
                  <div className="flex items-center gap-2 justify-end shrink-0">
                    <button
                      onClick={() => onOpenRelocate(item)}
                      title="نقل موقع القطعة 🟢"
                      className="px-2.5 py-1 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                      <span>نقل موقع القطعة 🟢</span>
                    </button>
                    <button
                      onClick={() =>
                        onMarkItemStatus(
                          item.part_number,
                          item.status === 'غير مدقق' ? 'مدقق' : 'غير مدقق'
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        item.status === 'غير مدقق'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                      }`}
                    >
                      {item.status === 'غير مدقق' ? 'اعتماد' : 'إلغاء'}
                    </button>

                    <button
                      onClick={() => onEditItem(item)}
                      className="p-1.5 rounded-lg bg-[#3A271F] hover:bg-[#4D342A] text-amber-300 border border-[#52382D]"
                      title="تعديل"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteItem(item.part_number)}
                      className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 text-red-400 border border-red-900/50"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
