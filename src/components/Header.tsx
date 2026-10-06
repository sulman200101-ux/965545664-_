import React from 'react';
import { Search, Plus, X, Trash2, FileText, ArrowRightLeft } from 'lucide-react';

interface HeaderProps {
  locationCount: number;
  totalItemsCount: number;
  remainingTotal: number;
  movedCount?: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  activeTab: 'locations' | 'categories' | 'items' | 'flutter';
  onTabChange: (tab: 'locations' | 'categories' | 'items' | 'flutter') => void;
  onOpenAddItem: () => void;
  onOpenWipeModal: () => void;
  onOpenRelocationReport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  locationCount,
  totalItemsCount,
  remainingTotal,
  movedCount = 0,
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  activeTab,
  onTabChange,
  onOpenAddItem,
  onOpenWipeModal,
  onOpenRelocationReport,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#2C1E18] border-b border-[#432d24] shadow-xl">
      {/* Top Bar - تم إلغاء الهوامش العلوية (pt-1) لرفع الكارت لأعلى الشاشة واستغلال كامل المساحة */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-1.5 pb-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* كارت الشعار والعنوان: قطع الغيار - أسمو (مرتفع لأعلى الصفحة) */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D97706] to-[#92400E] flex items-center justify-center shadow-md shadow-amber-950/50 border border-amber-500/30">
                <span className="text-white font-black text-lg tracking-wider">A</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                    قطع الغيار - أسمو
                  </h1>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                    ASMO
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/60 font-medium">
                  نظام الجرد الميداني والمواقع
                </p>
              </div>
            </div>

            {/* شارة المواقع والقطع للموبايل مع أيقونة المسح */}
            <div className="flex sm:hidden items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-[#3F2B22] text-amber-300 text-xs font-bold border border-[#5A3F33]">
                {locationCount} موقع
              </span>
              <button
                type="button"
                onClick={onOpenWipeModal}
                className="px-2.5 py-1 rounded-lg bg-[#3F2B22] hover:bg-red-950/70 text-emerald-400 hover:text-red-300 text-xs font-bold border border-[#5A3F33] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="عدد القطع: مسح كل ما في البرنامج (محمي بـ 4 أرقام سرية)"
              >
                <span>{totalItemsCount} قطعة</span>
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>

          {/* إحصائيات سريعة مختصرة - كارت عدد القطع مزود بأيقونة مسح محمي بـ 4 أرقام سرية */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="px-3 py-1 rounded-xl bg-[#3A271F] border border-[#52382D] flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-neutral-300 font-medium">المواقع:</span>
              <span className="font-bold text-amber-300">{locationCount}</span>
            </div>

            {/* أيقونة وكارت عدد القطع مع مسح كل ما في البرنامج */}
            <button
              type="button"
              onClick={onOpenWipeModal}
              title="مسح وتصفير كافة بيانات البرنامج (محمي بـ 4 أرقام سرية)"
              className="px-3 py-1 rounded-xl bg-[#3A271F] hover:bg-[#4E271F] border border-[#52382D] hover:border-red-500/60 flex items-center gap-2 text-xs transition-all cursor-pointer group shadow-sm"
            >
              <span className="text-neutral-300 font-medium">القطع:</span>
              <span className="font-bold text-emerald-400 group-hover:text-amber-200">{totalItemsCount.toLocaleString()}</span>
              <span className="p-1 rounded-md bg-red-950/50 text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors mr-0.5" title="مسح كل ما في البرنامج">
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>

            <div className="px-3 py-1 rounded-xl bg-[#3A271F] border border-[#52382D] flex items-center gap-2 text-xs">
              <span className="text-neutral-300 font-medium">المتبقي:</span>
              <span className="font-bold text-blue-400">{remainingTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* أزرار الإجراءات العلوية: تقرير المنقولة وإضافة قطعة */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onOpenRelocationReport && (
              <button
                type="button"
                onClick={onOpenRelocationReport}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-950 hover:from-emerald-700 hover:to-emerald-900 text-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer border border-emerald-500/50"
                title="تصدير وطباعة تقرير PDF للقطع المنقولة للاعتماد والرصد في النظام الشامل"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>تقرير المنقولة (PDF)</span>
                {movedCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-neutral-950 text-[10px] font-black">
                    {movedCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onOpenAddItem}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-900/50 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قطعة</span>
            </button>
          </div>
        </div>

        {/* شريط البحث والفلاتر (تم إزالة الشريط العريض لزر التصنيفات البرتقالي نهائياً) */}
        <div className="mt-2.5 pt-2 border-t border-[#3F2B22] flex flex-col md:flex-row items-center gap-2.5">
          {/* شريط البحث الفوري */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="🔍 البحث عن رقم قطعة أو موقع أو وصف..."
              className="w-full pl-9 pr-10 py-2 rounded-xl bg-[#1F1511] text-neutral-100 placeholder-neutral-400 border border-[#4D3429] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs sm:text-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* فلتر الحالة وتبويبات العرض (مواقعي / قائمة القطع) */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none justify-between md:justify-start">
            {/* فلتر الحالة */}
            <div className="flex items-center gap-1 bg-[#1F1511] px-2.5 py-1 rounded-xl border border-[#4D3429] text-xs">
              <select
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="bg-transparent text-neutral-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="الكل" className="bg-[#2C1E18]">كل الحالات</option>
                <option value="تم النقل" className="bg-[#2C1E18]">تم النقل 🟢</option>
                <option value="لم تنتقل" className="bg-[#2C1E18]">لم تنتقل 🟠</option>
                <option value="غير مدقق" className="bg-[#2C1E18]">غير مدقق</option>
                <option value="مضاف" className="bg-[#2C1E18]">مضاف</option>
                <option value="مدقق" className="bg-[#2C1E18]">مدقق</option>
              </select>
            </div>

            {/* تبديل العرض بين مواقعي ودليل الأصناف وقائمة القطع */}
            <div className="flex rounded-xl bg-[#1F1511] p-1 border border-[#4D3429]">
              <button
                onClick={() => onTabChange('locations')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'locations'
                    ? 'bg-[#3A271F] text-amber-300 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                مواقعي
              </button>
              <button
                onClick={() => onTabChange('categories')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'categories'
                    ? 'bg-[#3A271F] text-amber-300 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                دليل الأصناف
              </button>
              <button
                onClick={() => onTabChange('items')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'items'
                    ? 'bg-[#3A271F] text-amber-300 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                قائمة القطع
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
