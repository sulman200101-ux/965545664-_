import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InventoryItem, LocationSummary } from '../types';

/**
 * وحدة تصدير التقارير المتوافقة 100% مع اللغة العربية والـ RTL
 * تضمن معالجة النصوص العربية وحروفها المتصلة والخطوط دون أي رموز مكسورة (þÞþàþþ...)
 */

export interface ExportReportOptions {
  title?: string;
  locationFilter?: string | null;
  categoryFilter?: string | null;
  items: InventoryItem[];
  locationsSummary?: LocationSummary[];
}

export class ExportService {
  /**
   * إنشاء وتوليد مستند الـ PDF باللغة العربية الصرفة وخطوط Cairo و Tajawal
   */
  static async generateArabicPdf(options: ExportReportOptions): Promise<{ doc: jsPDF; file: File; filename: string }> {
    const { title = 'تقرير جرد قطع الغيار - أسمو (ASMO)', locationFilter, items } = options;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const totalQty = items.reduce((sum, i) => sum + (i.qty_total || 0), 0);
    const remQty = items.reduce((sum, i) => sum + (i.qty_remaining || 0), 0);
    const outQty = items.reduce((sum, i) => sum + (i.qty_out || 0), 0);

    // إنشاء حاوية HTML مؤقتة بتنسيق A4 دقيق وخط عربي أصيل
    const reportContainer = document.createElement('div');
    reportContainer.style.position = 'fixed';
    reportContainer.style.left = '-9999px';
    reportContainer.style.top = '0';
    reportContainer.style.width = '794px'; // 210mm at 96 DPI
    reportContainer.style.backgroundColor = '#FFFFFF';
    reportContainer.style.color = '#1E1E1E';
    reportContainer.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif";
    reportContainer.style.direction = 'rtl';
    reportContainer.style.textAlign = 'right';
    reportContainer.style.boxSizing = 'border-box';
    reportContainer.style.padding = '24px';

    // هيكل التقرير المنسق بتصميم أسمو البني والذهبي
    reportContainer.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap');
        * { box-sizing: border-box; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif; }
      </style>
      <div style="direction: rtl; text-align: right; width: 100%;">
        <!-- Header -->
        <div style="background: #2C1E18; color: #FFFFFF; padding: 18px 24px; border-radius: 12px; margin-bottom: 20px; border-bottom: 4px solid #D97706; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: #F59E0B;">شركة أسمو (ASMO)</h1>
            <h2 style="margin: 0; font-size: 15px; font-weight: 600; color: #FDF4E7;">${title}</h2>
          </div>
          <div style="text-align: left; direction: ltr;">
            <div style="background: #3E2820; padding: 6px 12px; border-radius: 8px; border: 1px solid #5A3F33; font-size: 11px; color: #FCD34D;">
              ${dateFormatted} | ${timeFormatted}
            </div>
            <div style="font-size: 10px; color: #D1D5DB; margin-top: 4px; text-align: right;">
              نظام الجرد الميداني الذكي
            </div>
          </div>
        </div>

        <!-- Statistics Cards -->
        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; background: #FDF8F6; border: 1px solid #E2D5CF; padding: 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 12px; color: #78350F; font-weight: 600; margin-bottom: 4px;">إجمالي الأصناف</div>
            <div style="font-size: 18px; font-weight: 800; color: #92400E;">${items.length.toLocaleString('ar-SA')} صنف</div>
          </div>
          <div style="flex: 1; background: #F0FDF4; border: 1px solid #DCFCE7; padding: 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 12px; color: #166534; font-weight: 600; margin-bottom: 4px;">إجمالي المخزون</div>
            <div style="font-size: 18px; font-weight: 800; color: #15803D;">${totalQty.toLocaleString('ar-SA')} قطعة</div>
          </div>
          <div style="flex: 1; background: #EFF6FF; border: 1px solid #DBEAFE; padding: 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 12px; color: #1E40AF; font-weight: 600; margin-bottom: 4px;">المتبقي الفعلي</div>
            <div style="font-size: 18px; font-weight: 800; color: #2563EB;">${remQty.toLocaleString('ar-SA')} قطعة</div>
          </div>
          <div style="flex: 1; background: #FEF2F2; border: 1px solid #FEE2E2; padding: 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 12px; color: #991B1B; font-weight: 600; margin-bottom: 4px;">المنصرف / الخارج</div>
            <div style="font-size: 18px; font-weight: 800; color: #DC2626;">${outQty.toLocaleString('ar-SA')} قطعة</div>
          </div>
        </div>

        <!-- Inventory Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; direction: rtl;">
          <thead>
            <tr style="background: #2C1E18; color: #F59E0B; text-align: center;">
              <th style="padding: 10px 8px; border: 1px solid #432D24; width: 40px;">#</th>
              <th style="padding: 10px 8px; border: 1px solid #432D24; width: 110px;">رقم القطعة</th>
              <th style="padding: 10px 8px; border: 1px solid #432D24; width: 85px;">الموقع</th>
              <th style="padding: 10px 8px; border: 1px solid #432D24; text-align: right;">الوصف والبيان (عربي / إنجليزي)</th>
              <th style="padding: 10px 8px; border: 1px solid #432D24; width: 60px;">المخزون</th>
              <th style="padding: 10px 8px; border: 1px solid #432D24; width: 55px;">الخارج</th>
              <th style="padding: 10px 8px; border: 1px solid #432D24; width: 60px;">المتبقي</th>
              <th style="padding: 10px 8px; border: 1px solid #432D24; width: 75px;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((item, idx) => {
                const isEven = idx % 2 === 0;
                const rowBg = isEven ? '#FFFFFF' : '#F9F6F0';
                const statusColor = item.status === 'مدقق' ? '#059669' : item.status === 'غير مدقق' ? '#D97706' : '#2563EB';
                return `
                <tr style="background: ${rowBg}; text-align: center; border-bottom: 1px solid #E5E7EB;">
                  <td style="padding: 8px 6px; border: 1px solid #E5E7EB; font-weight: 700; color: #6B7280;">${idx + 1}</td>
                  <td style="padding: 8px 6px; border: 1px solid #E5E7EB; font-weight: 800; color: #111827; font-family: monospace; direction: ltr;">${item.part_number}</td>
                  <td style="padding: 8px 6px; border: 1px solid #E5E7EB; font-weight: 700; color: #92400E; background: #FEF3C7;">${item.location_code}</td>
                  <td style="padding: 8px 8px; border: 1px solid #E5E7EB; text-align: right; line-height: 1.4;">
                    <div style="font-weight: 700; color: #1F2937;">${item.description_ar || item.description_en || '—'}</div>
                    ${item.description_en && item.description_ar ? `<div style="font-size: 9.5px; color: #6B7280; direction: ltr; text-align: right;">${item.description_en}</div>` : ''}
                  </td>
                  <td style="padding: 8px 6px; border: 1px solid #E5E7EB; font-weight: 700; color: #374151;">${item.qty_total}</td>
                  <td style="padding: 8px 6px; border: 1px solid #E5E7EB; font-weight: 700; color: #DC2626;">${item.qty_out}</td>
                  <td style="padding: 8px 6px; border: 1px solid #E5E7EB; font-weight: 800; color: #059669;">${item.qty_remaining}</td>
                  <td style="padding: 8px 6px; border: 1px solid #E5E7EB;">
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 6px; font-size: 9.5px; font-weight: 700; color: ${statusColor}; border: 1px solid ${statusColor}40; background: ${statusColor}15;">
                      ${item.status || 'مضاف'}
                    </span>
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>

        <!-- Footer -->
        <div style="border-top: 2px solid #E5E7EB; padding-top: 12px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #6B7280;">
          <div>تم استخراج التقرير بواسطة تطبيق قطع الغيار - أسمو (ASMO)</div>
          <div>الصفحة 1 من 1</div>
        </div>
      </div>
    `;

    document.body.appendChild(reportContainer);

    try {
      // التقاط الحاوية كـ Canvas بدقة عالية 2x لضمان نقاء النصوص العربية والخطوط
      const canvas = await html2canvas(reportContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const filename = `تقرير_جرد_أسمو_${locationFilter ? locationFilter + '_' : ''}${now.toISOString().split('T')[0]}.pdf`;
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      return { doc: pdf, file, filename };
    } finally {
      // إزالة العنصر المؤقت
      if (reportContainer.parentNode) {
        reportContainer.parentNode.removeChild(reportContainer);
      }
    }
  }

  /**
   * تجهيز ملخص نصي للجرد
   */
  static generateTextSummary(items: InventoryItem[], locationCode?: string): string {
    const totalQty = items.reduce((sum, i) => sum + (i.qty_total || 0), 0);
    const remQty = items.reduce((sum, i) => sum + (i.qty_remaining || 0), 0);
    const outQty = items.reduce((sum, i) => sum + (i.qty_out || 0), 0);

    let text = `📦 *تقرير جرد قطع الغيار - أسمو (ASMO)*\n`;
    if (locationCode && locationCode !== 'ALL') {
      text += `📍 *الموقع:* ${locationCode}\n`;
    }
    text += `📊 *إجمالي الأصناف:* ${items.length} صنف\n`;
    text += `📈 *إجمالي المخزون:* ${totalQty} قطعة\n`;
    text += `📥 *المتبقي:* ${remQty} | 📤 *الخارج:* ${outQty}\n\n`;

    text += `*عينة من الأصناف المسجلة:*\n`;
    const sampleItems = items.slice(0, 10);
    sampleItems.forEach((item, idx) => {
      text += `${idx + 1}. \`${item.part_number}\` (${item.location_code}) - ${item.description_ar || item.description_en} [متبقي: ${item.qty_remaining}]\n`;
    });

    if (items.length > 10) {
      text += `... و ${items.length - 10} صنف إضافي.\n`;
    }

    text += `\n📄 *مرفق ملف الـ PDF المنسق بالكامل باللغة العربية.*`;
    return text;
  }

  /**
   * إرسال التقرير عبر واتساب (WhatsApp) مع إرفاق الـ PDF أوتوماتيكياً
   */
  static async sendViaWhatsApp(items: InventoryItem[], locationCode?: string): Promise<void> {
    const title = locationCode && locationCode !== 'ALL'
      ? `تقرير جرد أسمو للموقع ${locationCode}`
      : 'تقرير جرد قطع الغيار الشامل - أسمو';

    const { file, doc, filename } = await this.generateArabicPdf({
      title,
      locationFilter: locationCode && locationCode !== 'ALL' ? locationCode : null,
      items,
    });

    const summaryText = this.generateTextSummary(items, locationCode);

    // إذا كان المتصفح/الهاتف يدعم إرفاق ومشاركة ملف الـ PDF مباشرة إلى تطبيق WhatsApp
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title,
          text: summaryText,
          files: [file],
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // بديل فوري للمتصفحات التي لا تدعم navigator.share
    const encodedText = encodeURIComponent(summaryText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    doc.save(filename);
  }

  /**
   * إرسال التقرير عبر البريد الإلكتروني (Email) مع إرفاق الـ PDF أوتوماتيكياً
   */
  static async sendViaEmail(items: InventoryItem[], locationCode?: string): Promise<void> {
    const title = locationCode && locationCode !== 'ALL'
      ? `تقرير جرد قطع الغيار - الموقع ${locationCode}`
      : 'تقرير جرد قطع الغيار الشامل - أسمو (ASMO)';

    const { file, doc, filename } = await this.generateArabicPdf({
      title,
      locationFilter: locationCode && locationCode !== 'ALL' ? locationCode : null,
      items,
    });

    const summaryText = this.generateTextSummary(items, locationCode);

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title,
          text: summaryText,
          files: [file],
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(summaryText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    doc.save(filename);
  }
}
