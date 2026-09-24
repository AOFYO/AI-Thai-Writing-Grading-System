"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Save, FileText, ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

interface Criterion {
  id: string;
  name: string;
  max_score: number;
  description: string;
}

interface Rubric {
  title: string;
  description: string;
  criteria: Criterion[];
}

export default function ManageRubrics() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [rubric, setRubric] = useState<Rubric>({
    title: "",
    description: "",
    criteria: []
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const extractRubric = async () => {
    if (!file) return;
    setIsExtracting(true);
    
    try {
      // 1. Upload image to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
      
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST", body: formData,
      });
      const cloudinaryData = await cloudinaryRes.json();
      if (!cloudinaryData.secure_url) throw new Error("อัปโหลดรูปภาพล้มเหลว");

      // 2. Extract Rubric via Gemini Vision
      const res = await fetch("/api/extract-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: cloudinaryData.secure_url }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สกัดข้อมูลล้มเหลว");
      
      setRubric(data);
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!rubric.title || rubric.criteria.length === 0) {
      alert("กรุณาระบุชื่อเกณฑ์และหัวข้อการประเมินให้ครบถ้วน");
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, "rubrics"), {
        ...rubric,
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      });
      alert("บันทึกเกณฑ์การประเมินสำเร็จ!");
      router.push("/");
    } catch (error: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (authChecking || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">สร้างเกณฑ์การประเมินใหม่ (Rubric Builder)</h1>
              <p className="text-gray-500 text-sm">สร้างเกณฑ์ด้วยตัวเอง หรือให้ AI อ่านจากรูปภาพใบเกณฑ์ก็ได้</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* AI Extractor Column */}
          <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-800">1. ใช้ AI สร้างจากรูปภาพ</h2>
            
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} className="absolute inset-0 w-full h-full object-contain p-2" alt="Rubric Preview" />
              ) : (
                <div className="text-center p-4">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-xs text-gray-500">อัปโหลดภาพตารางเกณฑ์</p>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>

            <button
              onClick={extractRubric}
              disabled={!file || isExtracting}
              className="w-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isExtracting ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              {isExtracting ? "AI กำลังวิเคราะห์รูปภาพ..." : "ให้ AI สกัดเกณฑ์จากภาพนี้"}
            </button>
            <p className="text-xs text-gray-400 text-center">AI จะอ่านตารางและสร้างฟอร์มด้านขวาให้อัตโนมัติ</p>
          </section>

          {/* Builder Form Column */}
          <section className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">2. ตรวจสอบและแก้ไขเกณฑ์</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อชุดเกณฑ์การประเมิน (เช่น สอบกลางภาควิชาภาษาไทย)</label>
                <input 
                  type="text" 
                  value={rubric.title} 
                  onChange={e => setRubric({...rubric, title: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ตั้งชื่อเกณฑ์ประเมิน..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบายภาพรวม (ตัวเลือก)</label>
                <input 
                  type="text" 
                  value={rubric.description}
                  onChange={e => setRubric({...rubric, description: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="เช่น ความยาว 12-15 บรรทัด..."
                />
              </div>

              <hr className="my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-800">หัวข้อการประเมิน (Criteria)</h3>
                </div>

                {rubric.criteria.map((criterion, index) => (
                  <div key={criterion.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3 relative">
                    <button 
                      onClick={() => setRubric({...rubric, criteria: rubric.criteria.filter(c => c.id !== criterion.id)})}
                      className="absolute top-3 right-3 text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                    
                    <div className="flex gap-4 pr-8">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">ชื่อหัวข้อ (เช่น ด้านเนื้อหา)</label>
                        <input 
                          type="text" 
                          value={criterion.name}
                          onChange={e => {
                            const newC = [...rubric.criteria];
                            newC[index].name = e.target.value;
                            setRubric({...rubric, criteria: newC});
                          }}
                          className="w-full p-2 border border-gray-300 rounded outline-none text-sm"
                        />
                      </div>
                      <div className="w-24 flex-shrink-0">
                        <label className="block text-xs text-gray-500 mb-1">คะแนนเต็ม</label>
                        <input 
                          type="number" 
                          value={criterion.max_score}
                          onChange={e => {
                            const newC = [...rubric.criteria];
                            newC[index].max_score = Number(e.target.value);
                            setRubric({...rubric, criteria: newC});
                          }}
                          className="w-full p-2 border border-gray-300 rounded outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">คำอธิบายเกณฑ์การให้คะแนน</label>
                      <textarea 
                        value={criterion.description}
                        onChange={e => {
                          const newC = [...rubric.criteria];
                          newC[index].description = e.target.value;
                          setRubric({...rubric, criteria: newC});
                        }}
                        rows={2}
                        className="w-full p-2 border border-gray-300 rounded outline-none text-sm resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setRubric({
                  ...rubric, 
                  criteria: [...rubric.criteria, { id: Date.now().toString(), name: "", max_score: 5, description: "" }]
                })}
                className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
              >
                <Plus size={16} /> เพิ่มหัวข้อประเมินใหม่
              </button>

            </div>

            <button
              onClick={handleSaveToFirestore}
              disabled={isSaving || rubric.criteria.length === 0}
              className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              บันทึกชุดเกณฑ์ประเมินลงฐานข้อมูล
            </button>

          </section>
        </div>
      </div>
    </main>
  );
}
