import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { categorizeAndTranslate } from '../utils/translator';
import { sanitizePartNumber, sanitizeQuantity, sanitizeDescription } from '../utils/regexSanitizer';
import { X, Check, Save, Package, MapPin, Sparkles, ArrowRightLeft } from 'lucide-react';

interface ItemModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (itemData: {
    part_number: string;
    location_code: string;
    description_en: string;
    description_ar: string;
    category: string;
    qty_total: number;
    qty_out: number;
    status: InventoryItem['status'];
  }) => Promise<void>;
  onOpenRelocate?: (item: InventoryItem) => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  item,
  onClose,
  onSave,
  onOpenRelocate,
}) => {
  const [partNumber, setPartNumber] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [category, setCategory] = useState('عام');
  const [qtyTotal, setQtyTotal] = useState(1);
  const [qtyOut, setQtyOut] = useState(0);
  const [status, setStatus] = useState<'مضاف' | 'غير مدقق' | 'مدقق' | 'منقول' | 'تم النقل' | 'محدث'>('مضاف');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setPartNumber(item.part_number);
      setLocationCode(item.location_code);
      setDescEn(item.description_en);
      setDescAr(item.description_ar);
      setCategory(item.category);
      setQtyTotal(item.qty_total);
      setQtyOut(item.qty_out);
      setStatus(item.status);
    } else {
      setPartNumber(`P-${Math.floor(1000 + Math.random() * 9000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`);
      setLocationCode('LOC-A1-04');
      setDescEn('');
      setDescAr('');
      setCategory('عام');
      setQtyTotal(10);
      setQtyOut(0);
      setStatus('مضاف');
    }
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleDescEnChange = (val: string) => {
    setDescEn(val);
    if (val.trim()) {
      const { category: cat, descAr: ar } = categorizeAndTranslate(val);
      setCategory(cat);
      setDescAr(ar);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPart = sanitizePartNumber(partNumber);
    if (!cleanPart || !locationCode.trim()) return;

    setIsSubmitting(true);
    const { cleaned: cleanDescEn } = sanitizeDescription(descEn);
    const cleanQtyTotal = sanitizeQuantity(qtyTotal, 1);
    const cleanQtyOut = sanitizeQuantity(qtyOut, 0);

    await onSave({
      part_number: cleanPart,
      location_code: locationCode.trim().toUpperCase(),
      description_en: cleanDescEn,
      description_ar: descAr.trim() || cleanDescEn,
      category,
      qty_total: cleanQtyTotal,
      qty_out: cleanQtyOut,
      status,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#2C1E18] border border-[#52382D] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#231713] border-b border-[#3D271F] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">
              {item ? 'تعديل تفاصيل القطعة' : 'إضافة قطعة غيار جديدة'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#3A271F] hover:bg-[#4D342A] text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Part Number */}
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">رقم القطعة (Part Number)</label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                required
                placeholder="P-8841-A"
                className="w-full px-3 py-2 rounded-xl bg-[#1F1511] border border-[#4A342B] text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Location Code */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-neutral-300 font-semibold">رمز الموقع (Location)</label>
                {item && onOpenRelocate && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRelocate(item);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/40"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>نقل موقع القطعة 🟢</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                required
                placeholder="LOC-A1-04"
                className="w-full px-3 py-2 rounded-xl bg-[#1F1511] border border-[#4A342B] text-neutral-100 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Description EN with Auto-Translate trigger */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-neutral-300 font-semibold">
                الوصف باللغة الإنجليزية (English Description)
              </label>
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> تعريب وتصنيف تلقائي
              </span>
            </div>
            <input
              type="text"
              value={descEn}
              onChange={(e) => handleDescEnChange(e.target.value)}
              placeholder="e.g. GASKET SPIRAL WOUND 3 INCH 150#"
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl bg-[#1F1511] border border-[#4A342B] text-neutral-100 font-sans focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Description AR */}
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              الوصف المعرب (Arabic Description)
            </label>
            <input
              type="text"
              value={descAr}
              onChange={(e) => setDescAr(e.target.value)}
              placeholder="وجه إحكام حلزوني 3 بوصة..."
              className="w-full px-3 py-2 rounded-xl bg-[#1F1511] border border-[#4A342B] text-neutral-100 font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">التصنيف (Category)</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#1F1511] border border-[#4A342B] text-neutral-100 focus:outline-none focus:border-amber-500"
              >
                <option value="مسامير وروابط">مسامير وروابط</option>
                <option value="إضاءة ولمبات">إضاءة ولمبات</option>
                <option value="جازكيت وموانع تسرب">جازكيت وموانع تسرب</option>
                <option value="صمامات ومحابس">صمامات ومحابس</option>
                <option value="فلاتر ومصافي">فلاتر ومصافي</option>
                <option value="رولمان بلي ومحامل">رولمان بلي ومحامل</option>
                <option value="أنابيب وفلنجات">أنابيب وفلنجات</option>
                <option value="عام">عام</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">الحالة (Status)</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#1F1511] border border-[#4A342B] text-neutral-100 focus:outline-none focus:border-amber-500"
              >
                <option value="غير مدقق">غير مدقق</option>
                <option value="مضاف">مضاف</option>
                <option value="مدقق">مدقق</option>
                <option value="تم النقل">تم النقل 🟡</option>
                <option value="منقول">منقول</option>
              </select>
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-3 gap-2.5 bg-[#1F1511] p-3 rounded-xl border border-[#4A342B]">
            <div>
              <label className="block text-neutral-400 font-medium mb-1 text-[11px]">
                المخزون (Total)
              </label>
              <input
                type="number"
                min="0"
                value={qtyTotal}
                onChange={(e) => setQtyTotal(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#271B15] border border-[#432d24] text-amber-300 font-bold font-mono text-center focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-neutral-400 font-medium mb-1 text-[11px]">
                الخارج (Out)
              </label>
              <input
                type="number"
                min="0"
                value={qtyOut}
                onChange={(e) => setQtyOut(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#271B15] border border-[#432d24] text-orange-400 font-bold font-mono text-center focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-neutral-400 font-medium mb-1 text-[11px]">
                المتبقي (Remaining)
              </label>
              <div className="w-full px-2.5 py-1.5 rounded-lg bg-[#271B15] border border-[#432d24] text-emerald-400 font-bold font-mono text-center">
                {Math.max(0, qtyTotal - qtyOut)}
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#3D271F] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#3A271F] hover:bg-[#4D342A] text-neutral-300 font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold flex items-center gap-1.5 shadow-md shadow-amber-900/40 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{item ? 'حفظ التعديلات' : 'إضافة القطعة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
