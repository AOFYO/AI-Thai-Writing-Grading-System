"use client";

import { useState, useEffect } from "react";
import { Upload, Loader2, AlertTriangle, CheckCircle, FileText, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      // 1. Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
      
      formData.append("upload_preset", uploadPreset);

      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      const cloudinaryData = await cloudinaryRes.json();
      if (!cloudinaryData.secure_url) {
        throw new Error("อัปโหลดรูปภาพล้มเหลว (ตรวจสอบ Cloud Name และ Upload Preset)");
      }

      const imageUrl = cloudinaryData.secure_url;

      // 2. Call Next.js API Route to evaluate via Gemini
      const gradeRes = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      const gradeData = await gradeRes.json();
      if (!gradeRes.ok) throw new Error(gradeData.error || "เกิดข้อผิดพลาดในการวิเคราะห์");

      setResult(gradeData);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (percent: number) => {
    if (percent >= 85) return "bg-green-100 text-green-800 border-green-200";
    if (percent >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="animate-spin h-8 w-8 mb-4 text-blue-600" />
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (!user) return null; // Prevent flicker before redirect

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header with User Info */}
        <header className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" />
              AI Thai Writing Grading
            </h1>
            <p className="text-gray-500 mt-1">ล็อกอินในชื่อ: {user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/rubrics" className="hidden sm:flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 px-4 rounded-lg transition-colors font-medium text-sm">
              <FileText size={16} /> จัดการเกณฑ์ประเมิน (Rubrics)
            </Link>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-red-600 bg-gray-100 hover:bg-red-50 py-2 px-4 rounded-lg transition-colors font-medium text-sm"
            >
              <LogOut size={16} /> ออกจากระบบ
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Upload & Preview */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">1. อัปโหลดรูปภาพ</h2>
            
            <label className="flex-1 flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-6">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-gray-600 font-medium">คลิกเพื่อเลือกไฟล์รูปภาพ</p>
                  <p className="text-gray-400 text-sm mt-1">รองรับ JPG, PNG</p>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>

            <button
              onClick={handleUploadAndAnalyze}
              disabled={!file || isAnalyzing}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <><Loader2 className="animate-spin" /> กำลังให้ AI วิเคราะห์...</>
              ) : (
                <>ประเมินคะแนนด้วย AI</>
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-200 text-sm">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </section>

          {/* Right Column: Result */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">2. ผลการประเมิน</h2>
            
            {!result && !isAnalyzing && (
              <div className="h-[300px] flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                รอผลการประเมิน...
              </div>
            )}

            {isAnalyzing && (
              <div className="h-[300px] flex flex-col items-center justify-center text-blue-600">
                <Loader2 className="animate-spin h-8 w-8 mb-4" />
                <p className="animate-pulse">AI กำลังอ่านลายมือและให้คะแนน...</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={`p-4 rounded-lg border ${getConfidenceColor(result.ocr_confidence_percent)} flex items-start justify-between`}>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {result.needs_human_review ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                      ความมั่นใจในการอ่านลายมือ: {result.ocr_confidence_percent}%
                    </h3>
                    <p className="text-sm mt-1 opacity-90">
                      {result.needs_human_review 
                        ? "⚠️ ลายมืออ่านยากมาก ครูควรตรวจสอบและแก้ไขคะแนนด้วยตนเอง" 
                        : "✅ AI มั่นใจในการสกัดข้อความ"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-semibold">จำนวนบรรทัด</p>
                    <p className="text-lg font-bold">{result.line_count}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-semibold">คะแนนรวมดิบ</p>
                    <p className="text-lg font-bold text-blue-600">{result.total_raw_score}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 border-b pb-2">รายละเอียดคะแนน (สามารถกดแก้ได้)</h3>
                  <div className="space-y-3">
                    {Object.entries(result.evaluation).map(([key, data]: [string, any]) => (
                      <div key={key} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
                        <div className="sm:w-32 flex-shrink-0">
                          <label className="text-xs text-gray-500 block mb-1 font-semibold uppercase">{key.replace('c', 'ด้านที่ ')}</label>
                          <select 
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            defaultValue={data.score}
                          >
                            {[1, 2, 3, 4, 5].map(num => (
                              <option key={num} value={num}>{num} คะแนน</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{data.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">ข้อความที่ AI แกะได้</h3>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-gray-700 font-serif leading-relaxed h-32 overflow-y-auto">
                    {result.transcribed_text}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">คำวิจารณ์เชิงบวก (Feedback)</h3>
                  <textarea 
                    className="w-full bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    rows={3}
                    defaultValue={result.teacher_feedback}
                  />
                </div>

                <div className="text-xs text-gray-400 text-right">
                  วิเคราะห์โดย: {result.used_model}
                </div>

                <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-sm">
                  บันทึก & สอน AI (Save & Train)
                </button>

              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
