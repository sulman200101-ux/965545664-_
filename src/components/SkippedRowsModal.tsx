import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Volume2, 
  Check, 
  X, 
  Edit3, 
  Sparkles, 
  ArrowLeft, 
  CheckCircle2, 
  HelpCircle 
} from 'lucide-react';
import { playHighPitchWarningAlert } from '../utils/audioAlert';
import { ExtractedSparePart } from '../services/localOcr';
import { categorizeAndTranslate } from '../utils/translator';
import { sanitizeLocationCode } from '../utils/regexSanitizer';

export interface SkippedRow {
  id: string;
  row_number?: number;
  raw_text: string;
  part_number?: string;
  location?: string;
  quantity?: number;
  description_en?: string;
  reason: string;
}

interface SkippedRowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skippedRows: SkippedRow[];
  validCount: number;
  onAcceptCorrectedItem: (item: ExtractedSparePart, skippedRowId: string) => void;
  onDismissAllSkipped?: () => void;
}

export const SkippedRowsModal: React.FC<SkippedRowsModalProps> = ({
  isOpen,
  onClose,
  skippedRows,
  validCount,
  onAcceptCorrectedItem,
  onDismissAllSkipped,
}) => {
  // تتبع التعديلات لكل سطر متجاهل
  const [editingRows, setEditingRows] = useState<Record<string, {
    partNumber: string;
    location: string;
    quantity: number;
    description: string;
  }>>({});

  if (!isOpen || skippedRows.length === 0) return null;

  const getRowState = (row: SkippedRow) => {
    const existing = editingRows[row.id];
    if (existing) return existing;

    const initialPart = (row.part_number || '').trim().replace(/[^0-9]/g, '');
    return {
      partNumber: initialPart.length > 0 ? initialPart : '100',
      location: row.location || 'K01A1',
      quantity: row.quantity || 10,
      description: row.description_en || 'SPARE PART ASMO',
    };
  };

  const handleFieldChange = (rowId: string, field: 'partNumber' | 'location' | 'quantity' | 'description', value: any) => {
    const currentRow = skippedRows.find(r => r.id === rowId);
    if (!currentRow) return;

    const current = getRowState(currentRow);
    setEditingRows(prev => ({
      ...prev,
      [rowId]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const handleApplyRow = (row: SkippedRow) => {
    const state = getRowState(row);
    const cleanPart = state.partNumber.trim().replace(/[^0-9]/g, '');

    // شرط القبول الصارم
    if (!/^100\d{7}$/.test(cleanPart)) {
      alert('يجب أن يتكون رقم القطعة من 10 أرقام فقط ويبدأ بـ 100 (مثال: 1001410488)');
      return;
    }

    const { category, descAr } = categorizeAndTranslate(state.description);
    const cleanLoc = sanitizeLocationCode(state.location);
    const total = Math.max(1, state.quantity);
    const out = Math.floor(total * 0.2);

    const correctedItem: ExtractedSparePart = {
      part_number: cleanPart,
      location_code: cleanLoc,
      description_en: state.description.trim() || 'SPARE PART ASMO',
      description_ar: descAr,
      category,
      qty_total: total,
      qty_out: out,
      qty_remaining: Math.max(0, total - out),
      confidence: 'مراجعة وتعديل يدوي (Manual Override)',
    };

    onAcceptCorrectedItem(correctedItem, row.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#261712] border-2 border-orange-500/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-right">
        {/* رأس النافذة التحذيرية */}
        <div className="p-4 bg-[#1B100C] border-b border-[#3D251D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-orange-900/60 text-orange-300 font-bold text-xs border border-orange-700/60">
                  تنبيه ميداني عاجل
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  (استبعاد {skippedRows.length} أسطر)
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-0.5">
                نافذة مراجعة الأسطر المتجاهلة (Manual Override)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => playHighPitchWarningAlert()}
              title="إعادة تشغيل صوت التنبيه الحاد"
              className="p-2 rounded-xl bg-[#362118] hover:bg-[#4D2F23] text-orange-300 border border-[#543326] transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
            >
              <Volume2 className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">تشغيل الصوت</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#362118] text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* شريط الإشعار التحذيري */}
        <div className="bg-gradient-to-r from-orange-950/70 via-red-950/50 to-orange-950/70 p-3.5 border-b border-orange-900/50 text-xs">
          <p className="text-orange-200 font-bold leading-relaxed">
            ⚠️ <strong>تنبيه:</strong> تم حفظ <strong>{validCount}</strong> قطعة بنجاح، وتجاهل <strong>{skippedRows.length}</strong> {skippedRows.length === 1 ? 'سطر' : 'أسطر'} بسبب عدم وضوح رقم القطعة أو تشوه النص في الورقة.
          </p>
          <p className="text-neutral-300 text-[11px] mt-1">
            يمكنك الآن تصحيح رقم القطعة يدوياً (يجب أن يبدأ بـ 100 ويتكون من 10 أرقام) دون الحاجة لإعادة التقاط كامل الورقة.
          </p>
        </div>

        {/* قائمة الأسطر المتجاهلة */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
          {skippedRows.map((row, index) => {
            const state = getRowState(row);
            const cleanPart = state.partNumber.trim().replace(/[^0-9]/g, '');
            const isValid = /^100\d{7}$/.test(cleanPart);

            return (
              <div
                key={row.id}
                className="bg-[#1C120E] border border-orange-800/40 rounded-xl p-3.5 space-y-3 hover:border-orange-600/60 transition-all shadow-md"
              >
                {/* رأس السطر وسبب الاستبعاد */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2E1D16] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-900/60 text-orange-200 font-bold flex items-center justify-center text-[11px] border border-orange-700/60">
                      {row.row_number || index + 1}
                    </span>
                    <span className="font-bold text-white text-xs">
                      السطر المستبعد رقم {row.row_number || index + 1}
                    </span>
                  </div>

                  <span className="text-[11px] text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40 font-medium">
                    السبب: {row.reason}
                  </span>
                </div>

                {/* النص الأصلي المقروء من الورقة */}
                <div className="bg-[#130B09] p-2.5 rounded-lg border border-[#2B1B15] text-[11px]">
                  <span className="text-neutral-400 block mb-0.5 font-bold">النص المشوه المقروء من الورقة:</span>
                  <code className="text-amber-200/90 font-mono block break-words" dir="ltr">
                    {row.raw_text}
                  </code>
                </div>

                {/* حقول التعديل اليدوي السريع */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* رقم القطعة */}
                  <div>
                    <label className="block text-neutral-300 font-bold mb-1 text-[11px] flex items-center justify-between">
                      <span>رقم القطعة (10 أرقام):</span>
                      {isValid ? (
                        <span className="text-emerald-400 text-[10px] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> صحيح
                        </span>
                      ) : (
                        <span className="text-red-400 text-[10px]">
                          {cleanPart.length}/10 أرقام
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={state.partNumber}
                      onChange={(e) => handleFieldChange(row.id, 'partNumber', e.target.value)}
                      placeholder="1001410488"
                      className={`w-full px-2.5 py-1.5 rounded-lg bg-[#140B08] border font-mono font-bold text-xs focus:outline-none ${
                        isValid 
                          ? 'border-emerald-600/70 text-emerald-300' 
                          : 'border-orange-700/60 text-amber-200 focus:border-amber-400'
                      }`}
                    />
                  </div>

                  {/* الموقع */}
                  <div>
                    <label className="block text-neutral-300 font-bold mb-1 text-[11px]">
                      الموقع (Location):
                    </label>
                    <input
                      type="text"
                      value={state.location}
                      onChange={(e) => handleFieldChange(row.id, 'location', e.target.value)}
                      placeholder="K01A1"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#140B08] border border-[#3E251D] text-neutral-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* الكمية */}
                  <div>
                    <label className="block text-neutral-300 font-bold mb-1 text-[11px]">
                      الكمية (Qty):
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={state.quantity}
                      onChange={(e) => handleFieldChange(row.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#140B08] border border-[#3E251D] text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* وصف القطعة */}
                <div>
                  <label className="block text-neutral-300 font-bold mb-1 text-[11px]">
                    الوصف الأصلي بالإنجليزية (Description):
                  </label>
                  <input
                    type="text"
                    value={state.description}
                    onChange={(e) => handleFieldChange(row.id, 'description', e.target.value)}
                    placeholder="GASKET SPIRAL WOUND 3 INCH 150#"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#140B08] border border-[#3E251D] text-neutral-200 text-xs focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                {/* زر اعتماد السطر المصحح */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleApplyRow(row)}
                    disabled={!isValid}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isValid
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                        : 'bg-[#2E1E18] text-neutral-500 cursor-not-allowed border border-[#452D24]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>اعتماد وإضافة للقائمة المقبولة</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* شريط الإجراءات السفلي */}
        <div className="p-4 bg-[#1B100C] border-t border-[#3D251D] flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#362118] hover:bg-[#4D2F23] text-neutral-300 font-bold transition-colors cursor-pointer"
          >
            متابعة مع الأصناف المقبولة ({validCount})
          </button>

          {onDismissAllSkipped && (
            <button
              onClick={onDismissAllSkipped}
              className="px-3.5 py-2 rounded-xl bg-[#2D1B15] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer text-[11px]"
            >
              تجاهل الأسطر المتبقية
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
