export interface InventoryItem {
  id?: number;
  part_number: string;
  location_code: string;
  old_location?: string;
  description_en: string;
  description_ar: string;
  category: string;
  qty_total: number;
  qty_out: number;
  qty_remaining: number;
  is_moved: number; // 0 or 1
  status: 'مضاف' | 'غير مدقق' | 'مدقق' | 'منقول' | 'تم النقل' | 'لم تنتقل' | 'محدث';
  moved_at?: string;
  updated_at?: string;
}

export interface LocationSummary {
  location_code: string;
  item_count: number;
  total_qty: number;
  out_qty: number;
  remaining_qty: number;
  unverified_count: number;
  added_count: number;
  moved_count: number;
}
