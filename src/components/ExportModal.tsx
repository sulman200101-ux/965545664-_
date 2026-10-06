import React, { useState } from 'react';
import { Mail, MessageSquare, X, Loader2 } from 'lucide-react';
import { ExportService } from '../services/exportService';
import { InventoryItem, LocationSummary } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  locationsSummary: LocationSummary[];
  selectedLocation?: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  items,
  locationsSummary,
  selectedLocation,
}) => {
  const [targetLocation, setTargetLocation] = useState<string>(selectedLocation || 'ALL');
  const [isSending, setIsSending] = useState<'whatsapp' | 'email' | null>(null);

  if (!isOpen) return null;

  const filteredItems = targetLocation === 'ALL'
    ? items
    : items.filter((i) => i.location_code === targetLocation);

  const handleSendWhatsApp = async () => {
    try {
      setIsSending('whatsapp');
      await ExportService.sendViaWhatsApp(filteredItems, targetLocation === 'ALL' ? undefined : targetLocation);
    } finally {
      setIsSending(null);
    }
  };

  const handleSendEmail = async () => {
    try {
      setIsSending('email');
      await ExportService.sendViaEmail(filteredItems, targetLocation === 'ALL' ? undefined : targetLocation);
    } finally {
      setIsSending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="bg-[#241813] border border-[#432D24] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-amber-50">
        {/* Header */}
        <div className="p-4 border-b border-[#3E2820] flex items-center justify-between bg-[#1C120E]">
          <div>
            <h3 className="font-bold text-base text-amber-200">إرسال تقرير الجرد (PDF)</h3>
            <p className="text-xs text-neutral-400">توليد وإرفاق ملف الـ PDF تلقائياً</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Location Scope Selector */}
          <div>
            <label className="block text-xs font-semibold text-amber-300 mb-1.5">
              تحديد نطاق التقرير:
            </label>
            <select
              value={targetLocation}
              onChange={(e) => setTargetLocation(e.target.value)}
              className="w-full px-3 py-2 bg-[#170E0B] border border-[#3E2820] rounded-xl text-xs text-amber-100 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">جميع المواقع والأصناف ({items.length} صنف)</option>
              {locationsSummary.map((loc) => (
                <option key={loc.location_code} value={loc.location_code}>
                  الموقع: {loc.location_code} ({loc.item_count} صنف)
                </option>
              ))}
            </select>
          </div>

          {/* Quick Summary Preview */}
          <div className="p-3.5 bg-[#170E0B] border border-[#3A241C] rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-neutral-400">الأصناف المشمولة: </span>
              <span className="font-bold text-amber-300">{filteredItems.length} صنف</span>
            </div>
            <div>
              <span className="text-neutral-400">إجمالي القطع: </span>
              <span className="font-bold text-emerald-400">
                {filteredItems.reduce((acc, curr) => acc + (curr.qty_total || 0), 0)} قطعة
              </span>
            </div>
          </div>

          {/* Direct Send Buttons - Only WhatsApp & Email */}
          <div className="space-y-3 pt-2">
            {/* WhatsApp Send */}
            <button
              onClick={handleSendWhatsApp}
              disabled={isSending !== null}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-98"
            >
              {isSending === 'whatsapp' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <MessageSquare className="w-5 h-5 text-emerald-100" />
              )}
              <span>إرسال التقرير عبر واتساب (WhatsApp) 🟢</span>
            </button>

            {/* Email Send */}
            <button
              onClick={handleSendEmail}
              disabled={isSending !== null}
              className="w-full py-3.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-sky-950/40 transition-all cursor-pointer active:scale-98"
            >
              {isSending === 'email' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Mail className="w-5 h-5 text-sky-100" />
              )}
              <span>إرسال عبر البريد الإلكتروني (Email) 🔵</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
