import { InventoryItem, LocationSummary } from '../types';
import { categorizeAndTranslate } from '../utils/translator';
import { sanitizeLocationCode, strict10DigitRegexFilter, dynamicLocationNormalizer } from '../utils/regexSanitizer';

const DB_NAME = 'ASMO_Inventory_DB';
const DB_VERSION = 2;
const STORE_NAME = 'items';

class InventoryDatabase {
  private db: IDBDatabase | null = null;
  private cache: InventoryItem[] = [];
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'part_number' });
          store.createIndex('idx_part', 'part_number', { unique: true });
          store.createIndex('idx_location', 'location_code', { unique: false });
          store.createIndex('idx_category', 'category', { unique: false });
          store.createIndex('idx_status', 'status', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isInitialized = true;
        await this.loadCache();
        const hasTestItems = this.cache.some((i) => i.part_number === '1001354367');
        if (this.cache.length === 0 || !hasTestItems) {
          await this.seedInitialData();
        }
        resolve();
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event);
        reject(request.error);
      };
    });
  }

  private async loadCache(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        this.cache = request.result || [];
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public getAllItems(): InventoryItem[] {
    return [...this.cache];
  }

  public getLocationsSummary(): LocationSummary[] {
    const summaryMap = new Map<string, LocationSummary>();

    for (const item of this.cache) {
      const loc = item.location_code || 'بدون موقع';
      let entry = summaryMap.get(loc);
      if (!entry) {
        entry = {
          location_code: loc,
          item_count: 0,
          total_qty: 0,
          out_qty: 0,
          remaining_qty: 0,
          unverified_count: 0,
          added_count: 0,
          moved_count: 0,
        };
        summaryMap.set(loc, entry);
      }

      entry.item_count += 1;
      entry.total_qty += Number(item.qty_total) || 0;
      entry.out_qty += Number(item.qty_out) || 0;
      entry.remaining_qty += Number(item.qty_remaining) || 0;

      if (item.status === 'غير مدقق') entry.unverified_count += 1;
      if (item.status === 'مضاف') entry.added_count += 1;
      if (item.status === 'منقول' || item.status === 'تم النقل' || item.is_moved === 1) entry.moved_count += 1;
    }

    // Sort location names alphanumerically
    return Array.from(summaryMap.values()).sort((a, b) => 
      a.location_code.localeCompare(b.location_code, undefined, { numeric: true, sensitivity: 'base' })
    );
  }

  public getItemByPartNumber(partNumber: string): InventoryItem | undefined {
    const clean = String(partNumber || '').trim();
    return this.cache.find((i) => i.part_number === clean);
  }

  public getItemsByLocation(locationCode: string): InventoryItem[] {
    return this.cache.filter((i) => i.location_code === locationCode);
  }

  public getItemsByCategory(categoryName: string): InventoryItem[] {
    const cat = categoryName.trim().toLowerCase();
    return this.cache.filter((i) => {
      const itemCat = (i.category || '').toLowerCase();
      return itemCat === cat || itemCat.includes(cat) || cat.includes(itemCat);
    });
  }

  // استعلام تجميع الأصناف الفريدة (GROUP BY category)
  public getCategoryGroups(): Array<{
    category: string;
    count: number;
    total_qty: number;
    remaining_qty: number;
    locations_count: number;
    locations: string[];
  }> {
    const map = new Map<string, {
      count: number;
      total_qty: number;
      remaining_qty: number;
      locations: Set<string>;
    }>();

    for (const item of this.cache) {
      const cat = item.category || 'عام';
      if (!map.has(cat)) {
        map.set(cat, {
          count: 0,
          total_qty: 0,
          remaining_qty: 0,
          locations: new Set<string>(),
        });
      }
      const entry = map.get(cat)!;
      entry.count += 1;
      entry.total_qty += Number(item.qty_total) || 0;
      entry.remaining_qty += Number(item.qty_remaining) || 0;
      if (item.location_code) {
        entry.locations.add(item.location_code);
      }
    }

    return Array.from(map.entries())
      .map(([cat, data]) => ({
        category: cat,
        count: data.count,
        total_qty: data.total_qty,
        remaining_qty: data.remaining_qty,
        locations_count: data.locations.size,
        locations: Array.from(data.locations),
      }))
      .sort((a, b) => b.count - a.count);
  }

  public searchItems(query: string, categoryFilter?: string, statusFilter?: string): InventoryItem[] {
    const q = query.trim().toLowerCase();
    
    return this.cache.filter((item) => {
      if (categoryFilter && categoryFilter !== 'الكل' && item.category !== categoryFilter) {
        return false;
      }
      if (statusFilter && statusFilter !== 'الكل' && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;

      return (
        item.part_number.toLowerCase().includes(q) ||
        item.location_code.toLowerCase().includes(q) ||
        (item.description_ar && item.description_ar.toLowerCase().includes(q)) ||
        (item.description_en && item.description_en.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }

  public async insertOrUpdateItem(
    partNum: string,
    locCode: string,
    descEn: string,
    qty: number,
    qtyOut: number = 0,
    forcedStatus?: InventoryItem['status'],
    existingAr?: string
  ): Promise<InventoryItem> {
    const existing = this.getItemByPartNumber(partNum);
    const cleanLocation = sanitizeLocationCode(locCode);
    
    // فحص هل القطعة مسجلة سابقاً في موقع مختلف:
    // إذا مسحت قطعة موجودة سابقاً ولكن في موقع جديد، تقوم قاعدة البيانات بتحديث موقعها وحالتها إلى (تم النقل 🟡) تلقائياً بدلاً من تكرار الصنف.
    const isMoved = existing && existing.location_code !== cleanLocation ? 1 : (existing?.is_moved || 0);
    const remaining = Math.max(0, qty - qtyOut);

    // اعتماد القراءة والترجمة لمرة واحدة والحفظ الدائم (One-Time Processing):
    // إذا كان الصنف مسجلاً ومترجماً سابقاً يتم استرجاع الوصف العربي والتصنيف مباشرة
    const cachedAr = existingAr || existing?.description_ar;
    const { category, descAr } = categorizeAndTranslate(descEn);
    const finalDescAr = cachedAr || descAr;

    let status: 'مضاف' | 'غير مدقق' | 'مدقق' | 'منقول' | 'تم النقل' | 'محدث' = forcedStatus || 'غير مدقق';
    if (isMoved) {
      status = 'تم النقل'; // تحديث الحالة إلى (تم النقل 🟡) تلقائياً عند تغيير الموقع
    } else if (!forcedStatus) {
      if (!existing) status = 'مضاف';
      else status = existing.status;
    }

    const item: InventoryItem = {
      part_number: partNum.trim(),
      location_code: cleanLocation,
      description_en: (existing?.description_en || descEn).trim(),
      description_ar: finalDescAr,
      category: existing?.category || category,
      qty_total: qty,
      qty_out: qtyOut,
      qty_remaining: remaining,
      is_moved: isMoved,
      status,
      updated_at: new Date().toISOString()
    };

    await this.putInStore(item);
    
    const index = this.cache.findIndex((i) => i.part_number === item.part_number);
    if (index >= 0) {
      this.cache[index] = item;
    } else {
      this.cache.unshift(item);
    }

    return item;
  }

  /**
   * 3. خوارزمية الربط والتحديث المباشر (Smart Upsert)
   * مطابقة رقم القطعة المكون من 10 أرقام مع قاعدة البيانات:
   * - إذا كانت القطعة مسجلة سابقاً: يتم تحديث بياناتها والموقع الجديد إن تغير وحالتها إلى "محدث" أو "تم النقل" دون تكرار
   * - إذا كانت جديدة: حفظ كصنف جديد بحالة "مضاف"
   */
  public async smartUpsertItem(item: {
    part_number: string;
    location_code: string;
    description_en: string;
    description_ar?: string;
    category?: string;
    qty_total: number;
    qty_out?: number;
    qty_remaining?: number;
  }): Promise<{ item: InventoryItem; action: 'inserted' | 'updated' | 'moved' }> {
    const cleanPart = strict10DigitRegexFilter(item.part_number) || item.part_number.trim();
    const cleanLocation = dynamicLocationNormalizer(item.location_code);
    const existing = this.getItemByPartNumber(cleanPart);

    const isMoved = existing && existing.location_code !== cleanLocation ? 1 : (existing?.is_moved || 0);
    const totalQty = item.qty_total;
    const outQty = item.qty_out !== undefined ? item.qty_out : Math.floor(totalQty * 0.2);
    const remaining = item.qty_remaining !== undefined ? item.qty_remaining : Math.max(0, totalQty - outQty);

    const { category, descAr } = categorizeAndTranslate(item.description_en);
    const finalDescAr = item.description_ar || existing?.description_ar || descAr;
    const finalCategory = item.category || existing?.category || category;

    let status: 'مضاف' | 'غير مدقق' | 'مدقق' | 'منقول' | 'تم النقل' | 'محدث';
    let action: 'inserted' | 'updated' | 'moved';

    if (isMoved) {
      status = 'تم النقل';
      action = 'moved';
    } else if (existing) {
      status = 'محدث';
      action = 'updated';
    } else {
      status = 'مضاف';
      action = 'inserted';
    }

    const upserted: InventoryItem = {
      part_number: cleanPart,
      location_code: cleanLocation,
      description_en: item.description_en.trim(),
      description_ar: finalDescAr,
      category: finalCategory,
      qty_total: totalQty,
      qty_out: outQty,
      qty_remaining: remaining,
      is_moved: isMoved,
      status,
      updated_at: new Date().toISOString(),
    };

    await this.putInStore(upserted);

    const idx = this.cache.findIndex((i) => i.part_number === upserted.part_number);
    if (idx >= 0) {
      this.cache[idx] = upserted;
    } else {
      this.cache.unshift(upserted);
    }

    return { item: upserted, action };
  }

  public async smartUpsertBatch(items: any[]): Promise<{
    total: number;
    insertedCount: number;
    updatedCount: number;
    movedCount: number;
  }> {
    let insertedCount = 0;
    let updatedCount = 0;
    let movedCount = 0;

    for (const item of items) {
      const res = await this.smartUpsertItem(item);
      if (res.action === 'inserted') insertedCount++;
      else if (res.action === 'updated') updatedCount++;
      else if (res.action === 'moved') movedCount++;
    }

    return {
      total: items.length,
      insertedCount,
      updatedCount,
      movedCount,
    };
  }

  public async deleteItem(partNumber: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(partNumber);

      req.onsuccess = () => {
        this.cache = this.cache.filter((i) => i.part_number !== partNumber);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteLocation(locationCode: string): Promise<number> {
    const itemsToDelete = this.cache.filter((i) => i.location_code === locationCode);
    for (const item of itemsToDelete) {
      await this.deleteItem(item.part_number);
    }
    return itemsToDelete.length;
  }

  public async updateLocationCode(oldCode: string, newCode: string): Promise<void> {
    const itemsToUpdate = this.cache.filter((i) => i.location_code === oldCode);
    for (const item of itemsToUpdate) {
      const updated: InventoryItem = {
        ...item,
        old_location: item.old_location || oldCode,
        location_code: newCode.trim().toUpperCase(),
        is_moved: 1,
        status: 'تم النقل',
        updated_at: new Date().toISOString()
      };
      await this.putInStore(updated);
      const idx = this.cache.findIndex((i) => i.part_number === item.part_number);
      if (idx >= 0) this.cache[idx] = updated;
    }
  }

  /**
   * نقل موقع القطعة (Relocate Action)
   * - يتم نقل القطعة أوتوماتيكياً من موقعها القديم إلى الموقع الجديد وحذف ارتباطها بالموقع القديم
   * - تسجيل الموقع القديم (old_location)
   * - تتغير علامة الحالة البصرية إلى (تم النقل 🟢)
   * - تسجيل تاريخ ووقت النقل تلقائياً في قاعدة البيانات
   */
  public async relocateItem(partNumber: string, newLocation: string): Promise<InventoryItem | null> {
    const item = this.cache.find((i) => i.part_number === partNumber);
    if (!item) return null;

    const oldLoc = item.location_code;
    const cleanNewLoc = sanitizeLocationCode(newLocation);
    const now = new Date();
    const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const updated: InventoryItem = {
      ...item,
      old_location: item.old_location || oldLoc,
      location_code: cleanNewLoc,
      is_moved: 1,
      status: 'تم النقل',
      moved_at: formattedDate,
      updated_at: now.toISOString(),
    };

    await this.putInStore(updated);
    const idx = this.cache.findIndex((i) => i.part_number === partNumber);
    if (idx >= 0) {
      this.cache[idx] = updated;
    }

    return updated;
  }

  public getMovedItems(): InventoryItem[] {
    return this.cache.filter((i) => i.is_moved === 1 || i.status === 'تم النقل' || i.status === 'منقول');
  }

  public async markStatus(partNumber: string, newStatus: InventoryItem['status']): Promise<void> {
    const item = this.cache.find((i) => i.part_number === partNumber);
    if (!item) return;
    item.status = newStatus;
    item.updated_at = new Date().toISOString();
    await this.putInStore(item);
  }

  public async batchImport(items: InventoryItem[]): Promise<number> {
    if (!this.db) return 0;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const item of items) {
        store.put(item);
        const idx = this.cache.findIndex((i) => i.part_number === item.part_number);
        if (idx >= 0) this.cache[idx] = item;
        else this.cache.push(item);
      }

      tx.oncomplete = () => resolve(items.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  public async resetAndSeedDatabase(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = async () => {
        this.cache = [];
        await this.seedInitialData();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  // مسح وتصفير كافة بيانات البرنامج نهائياً (Wipe All Data)
  public async wipeAllData(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => {
        this.cache = [];
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  private async putInStore(item: InventoryItem): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // توليد +4,000 قطعة لاختبار الأداء والسرعة العالية مع الفهرسة
  public async generateBulkItems(count: number = 4000): Promise<number> {
    const templates = [
      { en: 'GASKET SPIRAL WOUND 3 INCH 150# 316SS', qty: 45, out: 12, loc: 'LOC-A1-04' },
      { en: 'BOLT HEX STEEL 5/8 X 3 INCH GRADE 8', qty: 250, out: 70, loc: 'LOC-A1-05' },
      { en: 'LAMP FLUORESCENT 36W T8 120CM COOL WHITE', qty: 120, out: 30, loc: 'LOC-B2-11' },
      { en: 'STUD BOLT WITH 2 NUTS ASTM A193 B7 3/4X4', qty: 180, out: 40, loc: 'LOC-A1-04' },
      { en: 'GATE VALVE 2 INCH FLANGED CLASS 300 CS', qty: 15, out: 2, loc: 'LOC-C3-01' },
      { en: 'O-RING VITON 75 SHORE 2-224', qty: 500, out: 150, loc: 'LOC-A2-08' },
      { en: 'BALL BEARING DEEP GROOVE 6205-2RS SKF', qty: 60, out: 14, loc: 'LOC-C1-09' },
      { en: 'PRESSURE GAUGE 0-100 PSI BOTTOM ENTRY 2.5 INCH', qty: 25, out: 5, loc: 'LOC-D4-02' },
      { en: 'FILTER ELEMENT CARTRIDGE 10 MICRON 10 INCH', qty: 85, out: 20, loc: 'LOC-B1-03' },
      { en: 'LED FLOODLIGHT 50W IP66 OUTDOOR', qty: 40, out: 8, loc: 'LOC-B2-14' },
    ];

    const bulk: InventoryItem[] = [];
    const statuses: Array<'غير مدقق' | 'مضاف' | 'مدقق'> = ['غير مدقق', 'مضاف', 'مدقق'];

    for (let i = 1; i <= count; i++) {
      const t = templates[i % templates.length];
      const partNum = `ASMO-${10000 + i}`;
      const locZone = String.fromCharCode(65 + (i % 6)); // A, B, C, D, E, F
      const locShelf = (i % 25) + 1;
      const locCode = `LOC-${locZone}${Math.floor((i % 10) / 2) + 1}-${locShelf < 10 ? '0' + locShelf : locShelf}`;
      
      const { category, descAr } = categorizeAndTranslate(t.en);
      const total = t.qty + (i % 50);
      const out = Math.floor(total * 0.25);
      const status = statuses[i % statuses.length];

      bulk.push({
        part_number: partNum,
        location_code: locCode,
        description_en: `${t.en} #${i}`,
        description_ar: `${descAr} رقم ${i}`,
        category,
        qty_total: total,
        qty_out: out,
        qty_remaining: total - out,
        is_moved: i % 17 === 0 ? 1 : 0,
        status: i % 17 === 0 ? 'منقول' : status,
        updated_at: new Date().toISOString()
      });
    }

    return await this.batchImport(bulk);
  }

  private async seedInitialData(): Promise<void> {
    const testItems = [
      { part_number: "1001354367", location_code: "N03 A01", desc_en: "BOLT HEX 80 MM STEEL", qty: 29, out: 8, status: 'مضاف' as const },
      { part_number: "1000996904", location_code: "P01 FL1 1", desc_en: "GASKET SPIRAL WOUND 4 IN", qty: 15, out: 5, status: 'غير مدقق' as const },
      { part_number: "1000801147", location_code: "P01 FL1 1", desc_en: "LAMP FLUORESCENT 36 WATT", qty: 8, out: 2, status: 'غير مدقق' as const },
      { part_number: "1002441190", location_code: "N02 FL1 2", desc_en: "BOLT CARBON STEEL 4 IN", qty: 42, out: 12, status: 'مضاف' as const },
      { part_number: "1001883341", location_code: "N02 FL1 2", desc_en: "LAMP LED 15 WATT 220V", qty: 10, out: 3, status: 'مضاف' as const },
      { part_number: "1003112005", location_code: "P07 FL1 1", desc_en: "GASKET METAL GROOVED 2 IN", qty: 18, out: 4, status: 'غير مدقق' as const },
      { part_number: "1005112849", location_code: "P07 FL1 1", desc_en: "BOLT STUD LENGTH 6 CM WIDE 2 CM", qty: 20, out: 6, status: 'مضاف' as const },
      { part_number: "1008332119", location_code: "N03 A01", desc_en: "BOLT 3 MM STAINLESS", qty: 25, out: 5, status: 'مضاف' as const },
    ];

    const initialItemsData = [
      ...testItems,
      {
        part_number: 'P-8841-A',
        location_code: 'LOC-A1-04',
        desc_en: 'GASKET SPIRAL WOUND 4 INCH 300# 316SS',
        qty: 85,
        out: 25,
        status: 'غير مدقق' as const
      },
      {
        part_number: 'P-8842-B',
        location_code: 'LOC-A1-04',
        desc_en: 'BOLT HEX STEEL 3/4 X 4 INCH ASTM A325',
        qty: 320,
        out: 110,
        status: 'مضاف' as const
      },
      {
        part_number: 'P-9102-K',
        location_code: 'LOC-A1-04',
        desc_en: 'NUT HEX HEAVY 3/4 INCH ASTM A194 2H',
        qty: 600,
        out: 180,
        status: 'مدقق' as const
      },
      {
        part_number: 'P-7721-L',
        location_code: 'LOC-A1-05',
        desc_en: 'LAMP FLUORESCENT 36W T8 DAYLIGHT',
        qty: 140,
        out: 40,
        status: 'غير مدقق' as const
      },
      {
        part_number: 'P-7722-M',
        location_code: 'LOC-A1-05',
        desc_en: 'LED TUBE LIGHT 18W 1200MM 6500K',
        qty: 210,
        out: 35,
        status: 'مضاف' as const
      },
      {
        part_number: 'P-3310-V',
        location_code: 'LOC-B2-01',
        desc_en: 'GATE VALVE 3 INCH CLASS 150 FLANGED CS',
        qty: 18,
        out: 4,
        status: 'غير مدقق' as const
      },
      {
        part_number: 'P-3312-C',
        location_code: 'LOC-B2-01',
        desc_en: 'CHECK VALVE DUAL PLATE WAFER 3 INCH',
        qty: 12,
        out: 2,
        status: 'مضاف' as const
      },
      {
        part_number: 'P-5520-F',
        location_code: 'LOC-C3-12',
        desc_en: 'FILTER ELEMENT HYDRAULIC 10 MICRON FIBERGLASS',
        qty: 45,
        out: 15,
        status: 'غير مدقق' as const
      },
      {
        part_number: 'P-6611-R',
        location_code: 'LOC-D1-08',
        desc_en: 'BALL BEARING 6309-2RS DEEP GROOVE',
        qty: 55,
        out: 12,
        status: 'مضاف' as const
      },
      {
        part_number: 'P-4401-G',
        location_code: 'LOC-D1-08',
        desc_en: 'PRESSURE GAUGE 0-16 BAR GLYCERIN FILLED 1/2 NPT',
        qty: 28,
        out: 6,
        status: 'غير مدقق' as const
      }
    ];

    for (const item of initialItemsData) {
      await this.insertOrUpdateItem(
        item.part_number,
        item.location_code,
        item.desc_en,
        item.qty,
        item.out,
        item.status
      );
    }
  }
}

export const dbService = new InventoryDatabase();
