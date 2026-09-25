"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";
import { Copy } from "lucide-react";
import { collection, addDoc, updateDoc, doc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Save, FileText, Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RubricsBuilderPage() {
  const router = useRouter();
  const { user, userData, loading: authChecking } = useUserRole();
  
  const [myRubrics, setMyRubrics] = useState<any[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emptyRubric = {
    title: "",
    description: "",
    criteria: [] as { id: string, name: string, raw_score: number, weight: number, max_score: number, description: string }[]
  };

  const [rubric, setRubric] = useState(emptyRubric);

  useEffect(() => {
    if (!authChecking) {
      if (!user) router.push("/login");
      else if (userData?.role === "guest") router.push("/pending-approval");
      else fetchRubrics();
    }
  }, [user, userData, authChecking, router]);

  const fetchRubrics = async () => {
    const snap = await getDocs(query(collection(db, "rubrics")));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a: any, b: any) => {
      const aIsAdmin = !a.createdBy || a.creatorRole === 'admin';
      const bIsAdmin = !b.createdBy || b.creatorRole === 'admin';
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return 0;
    });
    setMyRubrics(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  
  const checkAndUpdateQuota = async (count: number) => {
    if (!userData || !user) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    let currentDaily = userData.lastRequestDate === today ? (userData.dailyUsed || 0) : 0;
    let currentMonthly = userData.lastRequestMonth === thisMonth ? (userData.monthlyUsed || 0) : 0;

    if (currentDaily + count > userData.rpdLimit) {
      alert(`โควต้ารายวันเต็มแล้ว! คุณใช้งานครบ ${userData.rpdLimit} สแกนในวันนี้ กรุณาลองใหม่พรุ่งนี้`);
      return false;
    }
    if (currentMonthly + count > userData.monthlyQuota) {
      alert(`โควต้ารายเดือนเต็มแล้ว! คุณใช้งานครบ ${userData.monthlyQuota} สแกนในเดือนนี้`);
      return false;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        dailyUsed: currentDaily + count,
        monthlyUsed: currentMonthly + count,
        lastRequestDate: today,
        lastRequestMonth: thisMonth
      });
      return true;
    } catch (err) {
      console.error("Error updating quota:", err);
      alert("ไม่สามารถอัปเดตโควต้าได้ โปรดลองอีกครั้ง");
      return false;
    }
  };

  const extractRubric = async () => {
    if (!file) return;
    if (!(await checkAndUpdateQuota(1))) {
      return;
    }
    setIsExtracting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
      
      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST", body: formData,
      });
      const cloudinaryData = await cloudinaryRes.json();

      const response = await fetch("/api/extract-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: cloudinaryData.secure_url }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Ensure mapping handles both old and new schema
      const mappedCriteria = data.criteria?.map((c: any) => ({
        id: c.id || Date.now().toString() + Math.random(),
        name: c.name || "",
        raw_score: c.raw_score || c.max_score || 5,
        weight: c.weight || 1,
        max_score: c.max_score || 5,
        description: c.description || ""
      })) || [];

      setRubric({
        title: data.title || "",
        description: data.description || "",
        criteria: mappedCriteria
      });
      
    } catch (error: any) {
      alert("Error extracting rubric: " + error.message);
    }
    
    setIsExtracting(false);
  };

  const handleSaveToFirestore = async () => {
    if (!rubric.title) {
      alert("กรุณาตั้งชื่อเกณฑ์ประเมิน");
      return;
    }
    setIsSaving(true);
    try {
      if (selectedRubricId) {
        await updateDoc(doc(db, "rubrics", selectedRubricId), {
          ...rubric,
          updatedAt: new Date().toISOString()
        });
        alert("อัปเดตเกณฑ์ประเมินสำเร็จ!");
      } else {
        await addDoc(collection(db, "rubrics"), {
          ...rubric,
          createdBy: user.uid,
          creatorRole: userData?.role || 'teacher',
          createdAt: new Date().toISOString(),
        });
        alert("บันทึกเกณฑ์ประเมินใหม่สำเร็จ!");
      }
      await fetchRubrics();
      setRubric(emptyRubric);
      setSelectedRubricId(null);
      setFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      alert("Error saving rubric: " + error.message);
    }
    setIsSaving(false);
  };

  const loadRubricForEdit = (r: any) => {
    const canEdit = r.createdBy === user?.uid || (userData?.role as string) === 'admin' || (!r.createdBy && (userData?.role as string) === 'admin');
    if (!canEdit) {
      alert("คุณไม่มีสิทธิแก้ไขเกณฑ์นี้ (กรุณากด 'ทำสำเนา' แทน)");
      return;
    }
  
    // Map older data that might not have raw_score or weight
    const mappedCriteria = r.criteria?.map((c: any) => ({
        ...c,
        raw_score: c.raw_score || c.max_score || 5,
        weight: c.weight || 1,
        max_score: c.max_score || 5
    })) || [];
    
    setRubric({ title: r.title, description: r.description, criteria: mappedCriteria });
    setSelectedRubricId(r.id);
    setFile(null);
    setPreviewUrl(null);
  };

  const handleDeleteRubric = async (id: string, r: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const canDelete = r.createdBy === user?.uid || (userData?.role as string) === 'admin' || (!r.createdBy && (userData?.role as string) === 'admin');
    if (!canDelete) return alert("คุณไม่มีสิทธิลบเกณฑ์นี้");
  
    e.stopPropagation();
    if (!confirm("คุณต้องการลบเกณฑ์นี้ใช่หรือไม่? (หากเกณฑ์นี้ถูกใช้ในชิ้นงานไปแล้ว ชิ้นงานนั้นอาจได้รับผลกระทบ)")) return;
    try {
      await deleteDoc(doc(db, "rubrics", id));
      if (selectedRubricId === id) {
        setRubric(emptyRubric);
        setSelectedRubricId(null);
      }
      fetchRubrics();
    } catch (err) {
      alert("ลบไม่สำเร็จ");
    }
  };

  const createNewRubric = () => {
    setRubric(emptyRubric);
    setSelectedRubricId(null);
    setFile(null);
    setPreviewUrl(null);
  };

  if (authChecking || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-6xl w-full space-y-6">
        
        <header className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">สร้างและจัดการเกณฑ์ (Rubric Builder)</h1>
            <p className="text-gray-500 mt-1">อัปโหลดภาพตารางเพื่อให้ AI ช่วยสร้างเกณฑ์อัตโนมัติ หรือแก้ไขเกณฑ์เดิม</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">กลับหน้าหลัก</Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar */}
          <section className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit max-h-[80vh] overflow-y-auto">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <FileText size={18} className="text-blue-600" /> เกณฑ์ของคุณ
            </h2>
            
            <button 
              onClick={createNewRubric}
              className={`w-full py-2 px-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 mb-4 transition-colors ${!selectedRubricId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Plus size={16} /> + สร้างเกณฑ์ใหม่
            </button>

            <div className="space-y-2">
              {myRubrics.map(r => (
                <div 
                  key={r.id} 
                  onClick={() => loadRubricForEdit(r)}
                  className={`p-3 rounded-lg border cursor-pointer group flex justify-between items-start transition-colors ${selectedRubricId === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <div>
                    <div className="flex justify-between items-start">
    <h3 className={`font-medium text-sm line-clamp-2 ${selectedRubricId === r.id ? 'text-blue-700' : 'text-gray-800'}`}>{r.title}</h3>
    {(!r.createdBy || r.creatorRole === 'admin') && <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded ml-1 whitespace-nowrap">Admin</span>}
  </div>
                    <p className="text-xs text-gray-500 mt-1">{r.criteria?.length || 0} หัวข้อ</p>
   {r.createdBy !== user?.uid && (userData?.role as string) !== 'admin' && (
      <button onClick={(e) => {
        e.stopPropagation();
        const cloned = { ...r };
        const mappedCriteria = cloned.criteria?.map((c: any) => ({
            ...c,
            raw_score: c.raw_score || c.max_score || 5,
            weight: c.weight || 1,
            max_score: c.max_score || 5
        })) || [];
        setRubric({ title: r.title + " (สำเนา)", description: r.description, criteria: mappedCriteria });
        setSelectedRubricId(null);
      }} className="mt-1 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1 w-fit">
        <Copy size={10} /> ทำสำเนา
      </button>
   )}
                  </div>
                  {(r.createdBy === user?.uid || (userData?.role as string) === 'admin') && (
    <button onClick={(e) => handleDeleteRubric(r.id, r, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
  
                    <Trash2 size={14} />
                  </button>
                  )}
                </div>
              ))}
              {myRubrics.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">ยังไม่มีเกณฑ์ที่สร้างไว้</p>
              )}
            </div>
          </section>

          {/* Main Area */}
          <div className="lg:col-span-3 space-y-6">
            
            {!selectedRubricId && (
              <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 space-y-2">
                  <h2 className="font-semibold text-gray-800 text-lg">สกัดเกณฑ์ด้วย AI Vision ✨</h2>
                  <p className="text-sm text-gray-500">อัปโหลดภาพตารางเกณฑ์คะแนน แล้วให้ AI ดึงข้อมูลและวิธีคิดคะแนนมาสร้างเป็นฟอร์มให้อัตโนมัติ</p>
                </div>
                
                <div className="w-full md:w-1/3 space-y-3">
                  <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-50 relative overflow-hidden bg-gray-50 transition-colors">
                    {previewUrl ? (
                      <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Rubric Preview" />
                    ) : (
                      <div className="text-center p-4">
                        <Upload className="mx-auto h-6 w-6 text-blue-500 mb-1" />
                        <p className="text-xs text-gray-500">คลิกเพื่ออัปโหลดรูปตาราง</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} ref={fileInputRef} />
                  </label>

                  <button
                    onClick={extractRubric}
                    disabled={!file || isExtracting}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors text-sm"
                  >
                    {isExtracting ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                    {isExtracting ? "AI กำลังดึงเกณฑ์..." : "ดึงเกณฑ์ด้วย AI"}
                  </button>
                </div>
              </section>
            )}

            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-semibold text-gray-800 text-lg">
                  {selectedRubricId ? "แก้ไขชุดเกณฑ์ประเมิน" : "ฟอร์มสร้างเกณฑ์ประเมิน"}
                </h2>
                {selectedRubricId && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium">โหมดแก้ไข</span>}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อชุดเกณฑ์ประเมิน (เช่น งานเขียน ม.6)</label>
                  <input 
                    type="text" 
                    value={rubric.title} 
                    onChange={e => setRubric({...rubric, title: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-semibold"
                    placeholder="พิมพ์ชื่อชุดเกณฑ์..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบายบริบท (บอก AI ถึงรูปแบบงาน หรือข้อจำกัด)</label>
                  <textarea 
                    value={rubric.description}
                    onChange={e => setRubric({...rubric, description: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none text-gray-900 font-medium"
                    placeholder="เช่น นักเรียนต้องเขียน 12-15 บรรทัด ตัวบรรจงครึ่งบรรทัด..."
                    rows={2}
                  />
                </div>

                <hr className="my-6 border-gray-100" />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">หัวข้อการให้คะแนน (Criteria)</h3>
                  </div>

                  {rubric.criteria.map((criterion, index) => (
                    <div key={criterion.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 space-y-3 relative group transition-colors hover:border-blue-200">
                      <button 
                        onClick={() => setRubric({...rubric, criteria: rubric.criteria.filter(c => c.id !== criterion.id)})}
                        className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="ลบหัวข้อนี้"
                      >
                        <Trash2 size={16} />
                      </button>
                      
                      <div className="flex flex-col md:flex-row gap-4 md:pr-8">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อหัวข้อย่อย</label>
                          <input 
                            type="text" 
                            value={criterion.name}
                            onChange={e => {
                              const newC = [...rubric.criteria];
                              newC[index].name = e.target.value;
                              setRubric({...rubric, criteria: newC});
                            }}
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white text-gray-900 font-semibold"
                          />
                        </div>
                        
                        <div className="w-full md:w-24 flex-shrink-0">
                          <label className="block text-xs font-medium text-gray-600 mb-1">คะแนนดิบเต็ม</label>
                          <input 
                            type="number" 
                            value={criterion.raw_score || criterion.max_score}
                            onChange={e => {
                              const newC = [...rubric.criteria];
                              newC[index].raw_score = Number(e.target.value);
                              newC[index].max_score = newC[index].raw_score * (newC[index].weight || 1);
                              setRubric({...rubric, criteria: newC});
                            }}
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-900 bg-white"
                          />
                        </div>

                        <div className="w-full md:w-20 flex-shrink-0">
                          <label className="block text-xs font-medium text-gray-600 mb-1">น้ำหนัก</label>
                          <input 
                            type="number" 
                            value={criterion.weight || 1}
                            onChange={e => {
                              const newC = [...rubric.criteria];
                              newC[index].weight = Number(e.target.value);
                              newC[index].max_score = (newC[index].raw_score || 5) * newC[index].weight;
                              setRubric({...rubric, criteria: newC});
                            }}
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-900 bg-white"
                          />
                        </div>

                        <div className="w-full md:w-24 flex-shrink-0">
                          <label className="block text-xs font-medium text-gray-600 mb-1">คะแนนรวม (x)</label>
                          <input 
                            type="number" 
                            value={criterion.max_score}
                            disabled
                            className="w-full p-2 border border-blue-200 rounded-lg outline-none text-sm font-bold text-blue-700 bg-blue-50 cursor-not-allowed text-center"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">อธิบายวิธีการคิดคะแนน / เกณฑ์ย่อยให้ AI เข้าใจอย่างละเอียด</label>
                        <textarea 
                          value={criterion.description}
                          onChange={e => {
                            const newC = [...rubric.criteria];
                            newC[index].description = e.target.value;
                            setRubric({...rubric, criteria: newC});
                          }}
                          rows={4}
                          className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y bg-white font-mono leading-relaxed text-gray-900 font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setRubric({
                    ...rubric, 
                    criteria: [...rubric.criteria, { id: Date.now().toString(), name: "", raw_score: 5, weight: 1, max_score: 5, description: "" }]
                  })}
                  className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors mt-2"
                >
                  <Plus size={16} /> เพิ่มหัวข้อการประเมิน
                </button>

              </div>

              <button
                onClick={handleSaveToFirestore}
                disabled={isSaving || rubric.criteria.length === 0}
                className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {selectedRubricId ? "บันทึกการแก้ไข (Update Rubric)" : "บันทึกเกณฑ์ประเมินใหม่ (Save New Rubric)"}
              </button>

            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
