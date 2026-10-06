import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  Save, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Trash2,
  Package,
  Sparkles,
  Edit3,
  RotateCcw
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { ExtractedSparePart, parseSimulatedTableOcr } from '../services/localOcr';
import { parseTableWithGeminiVision } from '../services/geminiVisionService';
import { SkippedRowsModal, SkippedRow } from './SkippedRowsModal';
import { playHighPitchWarningAlert } from '../utils/audioAlert';
import { prepareImageForAi, rotateImageDegrees } from '../utils/imagePreprocessor';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveItems: (items: ExtractedSparePart[]) => Promise<void>;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  isOpen,
  onClose,
  onSaveItems,
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedSparePart[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [isSkippedModalOpen, setIsSkippedModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastImage, setLastImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera access denied:', err);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setExtractedItems([]);
      setSkippedRows([]);
      setIsSkippedModalOpen(false);
      setIsProcessing(false);
      setStatusMessage('');
      setLastImage(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  /**
   * إرسال الصورة مباشرة للموديل (Direct API Call):
   * 1. تدوير الصورة تلقائياً 90 درجة عكس عقارب الساعة مع ضبط الأبعاد والتباين
   * 2. إرسال الصورة فوراً إلى Gemini Vision
   * 3. إذا كان السطر يحتوي على 10 أرقام يوضع في الجدول، وإذا وجد سطر ناقص ينطلق التنبيه الصوتي
   */
  const processImageDirectly = async (rawDataUrl: string) => {
    setIsProcessing(true);
    setStatusMessage('جاري معايرة الصورة وقراءتها فوراً عبر Gemini...');

    try {
      // 1. تدوير ومعايرة سريعة للورقة 90 درجة عكس عقارب الساعة
      const calibratedUrl = await prepareImageForAi(rawDataUrl);
      setLastImage(calibratedUrl);

      // 2. إرسال مباشر إلى Gemini
      const result = await parseTableWithGeminiVision(calibratedUrl);

      // 3. تحديث جدول النتائج وتنبيه الأسطر الناقصة
      if (result.items && result.items.length > 0) {
        setExtractedItems(result.items);

        if (result.skippedRows && result.skippedRows.length > 0) {
          setSkippedRows(result.skippedRows);
          playHighPitchWarningAlert();
          setStatusMessage(`⚠️ تم مسح ${result.items.length} قطعة وتجاهل ${result.skippedRows.length} سطر ناقص.`);
        } else {
          setSkippedRows([]);
          setStatusMessage(`🟢 تم مسح ${result.items.length} قطعة بنجاح وبمطابقة 100%!`);
        }
      } else {
        setStatusMessage('⚠️ لم يتم العثور على أرقام قطع في هذه اللقطة. يمكنك الضغط على "تدوير 90° ↺" أو إعادة التقاط الورقة.');
      }
    } catch (err) {
      console.error('Error processing image:', err);
      setStatusMessage('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي، يرجى إعادة المحاولة.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * تدوير يدوي سريع 90 درجة إذا كانت الورقة في اتجاه آخر
   */
  const handleQuickRotate = async () => {
    if (!lastImage || isProcessing) return;
    setIsProcessing(true);
    setStatusMessage('جاري تدوير الصورة 90° وإعادة القراءة...');
    try {
      const newlyRotated = await rotateImageDegrees(lastImage, 270);
      setLastImage(newlyRotated);
      const result = await parseTableWithGeminiVision(newlyRotated);

      if (result.items && result.items.length > 0) {
        setExtractedItems(result.items);
        if (result.skippedRows && result.skippedRows.length > 0) {
          setSkippedRows(result.skippedRows);
          playHighPitchWarningAlert();
          setStatusMessage(`⚠️ تم مسح ${result.items.length} قطعة وتجاهل ${result.skippedRows.length} سطر.`);
        } else {
          setSkippedRows([]);
          setStatusMessage(`🟢 تم مسح ${result.items.length} قطعة بنجاح 100%!`);
        }
      } else {
        setStatusMessage('لم يتم العثور على قطع بعد التدوير. أعد التقاط الصورة أفقياً.');
      }
    } catch (err) {
      console.error('Rotate error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeImageWithGemini = async (base64String: string) => {
    const dataUrl = base64String.startsWith('data:')
      ? base64String
      : `data:image/jpeg;base64,${base64String}`;
    stopCamera();
    await processImageDirectly(dataUrl);
  };

  /**
   * دالة pickFromGallery لفتح ألبوم الصور بجودة كاملة بدون ضغط
   * واستخراج البيانات عبر Gemini Vision
   */
  const pickFromGallery = async () => {
    try {
      const photo = await CapCamera.getPhoto({
        quality: 100, // جودة كاملة بدون ضغط
        allowEditing: false,
        resultType: CameraResultType.Base64, // للحصول على البيانات مباشرة
        source: CameraSource.Photos // فتح الألبوم تحديداً
      });

      if (photo && photo.base64String) {
        // إرسال الصورة للذكاء الاصطناعي لاستخراج البيانات
        await analyzeImageWithGemini(photo.base64String);
      }
    } catch (error) {
      console.error("فشل فتح الألبوم أو تم الإلغاء:", error);
    }
  };

  /**
   * دالة takePicture لالتقاط الصورة عبر @capacitor/camera
   * بجودة 90 وبصيغة Base64 لإرسالها مباشرة إلى Gemini
   */
  const takePicture = async (source: CameraSource = CameraSource.Camera) => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        // يجب استخدام Base64 لضمان قراءة الصورة برمجياً وإرسالها للذكاء الاصطناعي
        resultType: CameraResultType.Base64,
        source: source,
        correctOrientation: true,
      });

      if (image && image.base64String) {
        await analyzeImageWithGemini(image.base64String);
      }
    } catch (err: any) {
      console.warn('Capacitor camera interaction:', err);
      // إذا ألغى المستخدم أو لم تتوفر الكاميرا النيتيف، نفعّل كاميرا المتصفح
      if (!err?.message?.includes('cancelled') && !err?.message?.includes('User cancelled')) {
        startCamera();
      }
    }
  };

  const takeCapacitorPhoto = takePicture;

  const capturePhoto = async () => {
    if (Capacitor.isNativePlatform()) {
      await takeCapacitorPhoto(CameraSource.Camera);
      return;
    }
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1920;
    canvas.height = videoRef.current.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 1.0);
      stopCamera();
      await processImageDirectly(rawDataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      stopCamera();
      await processImageDirectly(rawDataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRunSample = () => {
    setIsProcessing(true);
    setStatusMessage('جاري تحميل عينة جدول جرد أسمو...');
    setTimeout(() => {
      const sampleItems = parseSimulatedTableOcr();
      setExtractedItems(sampleItems);
      setSkippedRows([]);
      setIsProcessing(false);
      setStatusMessage(`🟢 تم مسح ${sampleItems.length} قطعة بنجاح 100%!`);
    }, 250);
  };

  // حفظ في قاعدة البيانات فوراً دون أي أقفال
  const handleSaveToDatabase = async () => {
    if (extractedItems.length === 0) return;
    setIsProcessing(true);
    await onSaveItems(extractedItems);
    setIsProcessing(false);
    stopCamera();
    onClose();
  };

  const handleDeleteItem = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplySkippedRow = (item: ExtractedSparePart, skipId: string) => {
    setExtractedItems((prev) => [item, ...prev]);
    setSkippedRows((prev) => prev.filter((s) => s.id !== skipId));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
        <div className="bg-[#2C1E18] border border-[#52382D] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="px-4 py-3 bg-[#231713] border-b border-[#3D271F] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-600/40 flex items-center justify-center text-amber-400">
                <Camera className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white">
                الفحص الذكي لجداول الجرد (Gemini Vision)
              </h2>
            </div>

            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-[#3A271F] hover:bg-[#4D342A] text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls Bar: زرين أساسيين (التقاط صورة و حفظ في قاعدة البيانات) */}
          <div className="p-3 bg-[#1C120E] border-b border-[#3E2820] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {!isCameraActive ? (
                <button
                  onClick={() => {
                    if (Capacitor.isNativePlatform()) {
                      takeCapacitorPhoto(CameraSource.Camera);
                    } else {
                      startCamera();
                    }
                  }}
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>التقاط صورة</span>
                </button>
              ) : (
                <button
                  onClick={capturePhoto}
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer animate-pulse"
                >
                  <Camera className="w-4 h-4" />
                  <span>التقاط الآن 📸</span>
                </button>
              )}

              {Capacitor.isNativePlatform() ? (
                <button
                  type="button"
                  onClick={pickFromGallery}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl bg-[#2D1B15] hover:bg-[#40271E] text-amber-200 border border-[#523428] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>ألبوم الصور</span>
                </button>
              ) : (
                <label className="px-4 py-2.5 rounded-xl bg-[#2D1B15] hover:bg-[#40271E] text-amber-200 border border-[#523428] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>ألبوم الصور</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* زر التدوير السريع يظهر عند وجود صورة ملتقطة للمعايرة الفورية */}
              {lastImage && (
                <button
                  onClick={handleQuickRotate}
                  disabled={isProcessing}
                  title="تدوير 90 درجة عكس عقارب الساعة وإعادة القراءة"
                  className="px-3 py-2 rounded-xl bg-[#2D1B15] hover:bg-[#43271D] text-amber-300 border border-amber-600/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تدوير 90° ↺</span>
                </button>
              )}

              <button
                onClick={handleRunSample}
                disabled={isProcessing}
                className="px-3 py-2 rounded-xl bg-[#261712] hover:bg-[#382119] text-neutral-300 text-xs font-bold flex items-center gap-1.5 border border-[#3D251C] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>عينة تجريبية</span>
              </button>
            </div>

            {/* زر حفظ في قاعدة البيانات (مباشر وبدون أي أقفال) */}
            <button
              onClick={handleSaveToDatabase}
              disabled={extractedItems.length === 0 || isProcessing}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                extractedItems.length > 0 && !isProcessing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 cursor-pointer active:scale-95'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>حفظ في قاعدة البيانات ({extractedItems.length})</span>
            </button>
          </div>

          {/* Live Camera View */}
          {isCameraActive && (
            <div className="p-3 bg-black flex flex-col items-center border-b border-[#3D271F]">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-[260px] w-full max-w-xl flex items-center justify-center border-2 border-amber-600 shadow-lg">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-4 border border-dashed border-amber-400/80 rounded-lg pointer-events-none flex items-center justify-center">
                  <span className="text-[11px] text-amber-200 bg-black/75 px-3 py-1 rounded-full font-bold">
                    ضع جدول الجرد أفقياً داخل الإطار
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Modal Body: عرض النتائج فوراً */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            
            {/* Status Bar */}
            {isProcessing && (
              <div className="bg-[#1C120E] p-3 rounded-xl border border-amber-600/40 flex items-center justify-between text-xs animate-pulse">
                <span className="text-amber-300 font-bold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>{statusMessage}</span>
                </span>
                <span className="text-neutral-400 font-mono text-[11px]">Gemini Vision API</span>
              </div>
            )}

            {!isProcessing && extractedItems.length > 0 && skippedRows.length === 0 && (
              <div className="bg-emerald-950/70 border border-emerald-600/70 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-200">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>🟢 تم استخراج {extractedItems.length} قطعة بنجاح وبمطابقة 100%</span>
                </div>
                <span className="text-[11px] text-emerald-300/80 font-mono">
                  جاهزة للحفظ المباشر
                </span>
              </div>
            )}

            {!isProcessing && skippedRows.length > 0 && (
              <div className="bg-orange-950/80 border border-orange-500/80 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-orange-200">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>
                    ⚠️ تم استخراج {extractedItems.length} قطعة وتجاهل {skippedRows.length} سطر ناقص
                  </span>
                </div>

                <button
                  onClick={() => setIsSkippedModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 self-end sm:self-auto cursor-pointer shadow"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>مراجعة وتعديل الأسطر المتجاهلة ({skippedRows.length})</span>
                </button>
              </div>
            )}

            {/* Results Table (4 Columns: رقم القطعة الـ 10 أرقام، الموقع، الكمية، الوصف) */}
            {extractedItems.length > 0 ? (
              <div className="bg-[#1C120E] border border-[#3E2820] rounded-xl overflow-hidden shadow">
                <div className="overflow-x-auto max-h-[380px] scrollbar-thin">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#180F0C] text-neutral-400 text-[11px] sticky top-0 z-10 border-b border-[#3E2820]">
                      <tr>
                        <th className="py-2.5 px-3">رقم القطعة (10 أرقام)</th>
                        <th className="py-2.5 px-3">الموقع</th>
                        <th className="py-2.5 px-3">الكمية</th>
                        <th className="py-2.5 px-3">الوصف</th>
                        <th className="py-2.5 px-2 text-center w-12">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F1D16]">
                      {extractedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#261712] transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                            {item.part_number}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-neutral-200">
                            {item.location_code}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className="font-bold text-white">{item.qty_total}</span>
                            <span className="text-neutral-500 text-[10px] mr-1">
                              (المتبقي: {item.qty_remaining})
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-neutral-100">{item.description_ar}</div>
                            <div className="text-[10px] text-neutral-400 font-sans" dir="ltr">
                              {item.description_en}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => handleDeleteItem(idx)}
                              title="حذف هذا السطر"
                              className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              !isProcessing && (
                <div className="py-16 px-4 text-center rounded-2xl bg-[#1C120E] border border-[#3E2820] space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#2C1B14] flex items-center justify-center text-amber-500">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-200">
                    جاهز للفحص المباشر
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    اضغط على <span className="text-amber-400 font-bold">التقاط صورة</span> أو اختر صورة من الألبوم لقراءة الجدول وعرض نتائجه فوراً.
                  </p>
                </div>
              )
            )}

          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-[#231713] border-t border-[#3D271F] flex items-center justify-between text-xs">
            <span className="text-[11px] text-neutral-400 font-mono">
              {extractedItems.length} قطعة جاهزة للحفظ
            </span>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>

        </div>
      </div>

      {/* نافذة مراجعة الأسطر المتجاهلة (تفتح فقط عند الحاجة) */}
      <SkippedRowsModal
        isOpen={isSkippedModalOpen}
        onClose={() => setIsSkippedModalOpen(false)}
        skippedRows={skippedRows}
        validCount={extractedItems.length}
        onAcceptCorrectedItem={handleApplySkippedRow}
      />
    </>
  );
};
