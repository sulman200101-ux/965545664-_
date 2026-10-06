import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { exportInventoryListToPdfFile } from '../utils/pdfExportUtil';
import { exportAndShareForEditing } from '../utils/csvExportUtil';
import { 
  Edit3, 
  Trash2, 
  MapPin, 
  Tag, 
  ArrowRightLeft, 
  CheckCircle2, 
  FileDown, 
  Loader2,
  Check,
  Share2
} from 'lucide-react';

interface ItemsTableViewProps {
  items: InventoryItem[];
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (partNumber: string) => void;
  onMarkItemStatus: (partNumber: string, status: InventoryItem['status']) => void;
  onOpenRelocate: (item: InventoryItem) => void;
}

export const ItemsTableView: React.FC<ItemsTableViewProps> = ({
  items,
  onEditItem,
  onDeleteItem,
  onMarkItemStatus,
  onOpenRelocate,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExportTablePdf = async () => {
    setIsExporting(true);
    try {
      await exportInventoryListToPdfFile({
        items,
        title: `تقرير جرد الأصناف المعروضة (${items.length} صنف)`,
      });
      setExportNotice('تم تصدير وحفظ ملف PDF بنجاح! 📥');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-[#2C1E18] rounded-2xl border border-[#432d24] p-12 text-center">
        <p className="text-neutral-400 text-sm">لا توجد قطع مطابقة لمعايير البحث الحالية.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#2C1E18] rounded-2xl border border-[#432d24] shadow-xl overflow-hidden flex flex-col">
      {/* شريط الإجراءات العلوي للجدول */}
      <div className="p-3 bg-[#241712] border-b border-[#3D271F] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-300">
            عدد الأصناف المعروضة:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
            {items.length} صنف
          </span>
        </div>

        <div className="flex items-center gap-2">
          {exportNotice && (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              {exportNotice}
            </span>
          )}

          <button
            type="button"
            onClick={handleExportTablePdf}
            disabled={isExporting}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-emerald-500/40 active:scale-95"
            title="تصدير جدول الأصناف كملف PDF مباشر"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span>تصدير ملف PDF 📥</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              setIsExporting(true);
              const success = await exportAndShareForEditing(items);
              if (success) {
                setExportNotice('تم إعداد ومشاركة ملف Excel (CSV)! 📊');
                setTimeout(() => setExportNotice(null), 4000);
              }
              setIsExporting(false);
            }}
            disabled={isExporting}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-blue-500/40 active:scale-95"
            title="تصدير ومشاركة تقرير الجرد القابل للتعديل عبر Excel"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-200" />
            <span>مشاركة Excel (قابل للتعديل) 📊</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-[#211612] text-neutral-400 border-b border-[#3D271F] font-bold">
            <tr>
              <th className="py-3.5 px-4">رقم القطعة (Part No)</th>
              <th className="py-3.5 px-4">الموقع (Location)</th>
              <th className="py-3.5 px-4">الوصف المعرب</th>
              <th className="py-3.5 px-4">التصنيف</th>
              <th className="py-3.5 px-4 text-center">المخزون</th>
              <th className="py-3.5 px-4 text-center">الخارج</th>
              <th className="py-3.5 px-4 text-center">المتبقي</th>
              <th className="py-3.5 px-4 text-center">الحالة</th>
              <th className="py-3.5 px-4 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3A271F]">
            {items.map((item) => {
              const isMoved = item.is_moved === 1 || item.status === 'تم النقل' || item.status === 'منقول';

              return (
                <tr
                  key={item.part_number}
                  className="hover:bg-[#34241D] transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-amber-300">
                    {item.part_number}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-neutral-300">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-500" />
                      {item.location_code}
                    </span>
                    {item.old_location && (
                      <span className="text-[10px] text-neutral-500 block font-normal">
                        السابق: {item.old_location}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-neutral-100">{item.description_ar}</p>
                    <p className="text-[11px] text-neutral-400 font-sans" dir="ltr">
                      {item.description_en}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#1F1511] text-neutral-300 border border-[#422D22]">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-amber-300">
                    {item.qty_total}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-orange-400">
                    {item.qty_out}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                    {item.qty_remaining}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isMoved ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/60 inline-flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        تم النقل 🟢
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-600/60 inline-flex items-center gap-1">
                        لم تنتقل 🟠
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onOpenRelocate(item)}
                        className="px-2 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="نقل موقع القطعة 🟢"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-emerald-400" />
                        <span>نقل 🟢</span>
                      </button>
                      <button
                        onClick={() => onEditItem(item)}
                        className="p-1 rounded bg-[#2A1B14] text-neutral-300 hover:text-amber-400 border border-[#4D3429]"
                        title="تعديل القطعة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item.part_number)}
                        className="p-1 rounded bg-[#2A1B14] text-neutral-300 hover:text-red-400 border border-[#4D3429]"
                        title="حذف القطعة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
