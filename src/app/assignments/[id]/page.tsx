"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, UploadCloud, Play, CheckCircle, AlertTriangle, Image as ImageIcon } from "lucide-react";
import Link from "next/link";

interface PendingFile {
  id: string;
  file: File;
  preview: string;
  studentNo: string;
  status: "pending" | "processing" | "success" | "error";
  result?: any;
  errorMsg?: string;
}

export default function AssignmentWorkspace({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else {
        setUser(currentUser);
        fetchAssignmentData(currentUser.uid);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [router, params.id]);

  const fetchAssignmentData = async (uid: string) => {
    try {
      const docRef = doc(db, "assignments", params.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().createdBy === uid) {
        setAssignment({ id: docSnap.id, ...docSnap.data() });
      } else {
        router.push("/assignments"); // Not found or no permission
      }

      // Fetch existing submissions
      const subSnap = await getDocs(query(collection(db, "submissions"), where("assignmentId", "==", params.id)));
      setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const newPending = files.map(f => {
      // Identity Matching (Option A): Auto-match from filename e.g. "1.jpg" -> "1"
      const match = f.name.match(/^(\d+)/);
      const studentNo = match ? match[1] : "";
      
      return {
        id: Math.random().toString(36).substring(7),
        file: f,
        preview: URL.createObjectURL(f),
        studentNo,
        status: "pending" as const
      };
    });
    
    setPendingFiles(prev => [...prev, ...newPending]);
  };

  const updatePendingFile = (id: string, updates: Partial<PendingFile>) => {
    setPendingFiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(p => p.id !== id));
  };

  const startBatchProcess = async () => {
    const filesToProcess = pendingFiles.filter(p => p.status === "pending" || p.status === "error");
    if (filesToProcess.length === 0) return;
    
    // Validation: Check if student numbers are filled
    const missingNos = filesToProcess.filter(p => !p.studentNo.trim());
    if (missingNos.length > 0) {
      alert("กรุณาระบุเลขที่นักเรียนให้ครบทุกรูปก่อนเริ่มตรวจ");
      return;
    }

    setIsProcessingBatch(true);

    for (const item of filesToProcess) {
      updatePendingFile(item.id, { status: "processing" });

      try {
        // 1. Upload to Cloudinary
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
        
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST", body: formData,
        });
        const cloudinaryData = await cloudinaryRes.json();
        if (!cloudinaryData.secure_url) throw new Error("อัปโหลดรูปล้มเหลว");

        // 2. Call Next.js API Route for Gemini Grading
        const gradeRes = await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            imageUrl: cloudinaryData.secure_url,
            rubricData: assignment.rubricData
          }),
        });

        const gradeData = await gradeRes.json();
        if (!gradeRes.ok) throw new Error(gradeData.error || "AI วิเคราะห์ล้มเหลว");

        // 3. Save to Firestore Submissions
        const newSub = {
          assignmentId: assignment.id,
          studentNumber: parseInt(item.studentNo),
          imageUrl: cloudinaryData.secure_url,
          result: gradeData,
          createdAt: new Date().toISOString()
        };
        
        const subRef = await addDoc(collection(db, "submissions"), newSub);
        
        // Update local UI
        updatePendingFile(item.id, { status: "success", result: gradeData });
        setSubmissions(prev => [...prev, { id: subRef.id, ...newSub }]);

      } catch (error: any) {
        updatePendingFile(item.id, { status: "error", errorMsg: error.message });
      }
    }

    setIsProcessingBatch(false);
  };

  if (authChecking || !user || !assignment) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  // Generate roster array [1, 2, ..., maxStudents]
  const roster = Array.from({ length: assignment.maxStudents }, (_, i) => i + 1);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/assignments" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 line-clamp-1">{assignment.title} ({assignment.className})</h1>
              <p className="text-gray-500 text-sm flex items-center gap-2">
                <FileText size={14}/> เกณฑ์: {assignment.rubricData?.title || 'ไม่ได้ระบุ'}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left/Top: Batch Dropzone & Queue */}
          <section className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UploadCloud className="text-blue-600" /> อัปโหลดกระดาษคำตอบ (Batch Upload)
              </h2>
              
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors bg-gray-50">
                <div className="text-center">
                  <p className="text-gray-700 font-medium">คลิกเพื่อเลือกไฟล์รูปภาพ (เลือกได้หลายไฟล์พร้อมกัน)</p>
                  <p className="text-gray-400 text-sm mt-1">ตั้งชื่อไฟล์เป็น "เลขที่.jpg" (เช่น 1.jpg) ระบบจะจับคู่ให้อัตโนมัติ</p>
                </div>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
              </label>

              {pendingFiles.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-700">คิวเตรียมตรวจ ({pendingFiles.length} รูป)</h3>
                    <button 
                      onClick={startBatchProcess}
                      disabled={isProcessingBatch}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      {isProcessingBatch ? <Loader2 className="animate-spin" size={18}/> : <Play size={18}/>}
                      {isProcessingBatch ? "กำลังให้ AI ทยอยตรวจ..." : "เริ่มตรวจทั้งหมด"}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {pendingFiles.map((item, idx) => (
                      <div key={item.id} className="flex gap-4 p-3 border border-gray-200 rounded-lg bg-gray-50 items-center">
                        <img src={item.preview} className="w-16 h-16 object-cover rounded border border-gray-300" alt="preview" />
                        
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1 truncate max-w-[200px]">{item.file.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">เลขที่:</span>
                            <input 
                              type="number"
                              value={item.studentNo}
                              onChange={e => updatePendingFile(item.id, { studentNo: e.target.value })}
                              disabled={item.status === "processing" || item.status === "success"}
                              placeholder="ระบุเลขที่"
                              className="w-20 p-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-200"
                            />
                          </div>
                        </div>

                        <div className="w-32 flex justify-end">
                          {item.status === "pending" && <button onClick={() => removePendingFile(item.id)} className="text-sm text-red-500 hover:underline">ลบออก</button>}
                          {item.status === "processing" && <span className="text-blue-500 flex items-center gap-1 text-sm"><Loader2 size={14} className="animate-spin"/> กำลังตรวจ</span>}
                          {item.status === "success" && <span className="text-green-600 flex items-center gap-1 text-sm"><CheckCircle size={14}/> ตรวจสำเร็จ</span>}
                          {item.status === "error" && <span className="text-red-500 flex items-center gap-1 text-sm" title={item.errorMsg}><AlertTriangle size={14}/> ผิดพลาด</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right: Class Roster / Dashboard */}
          <section className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                สถานะการส่งงาน ({submissions.length}/{assignment.maxStudents})
              </h2>
              
              <div className="grid grid-cols-5 gap-2">
                {roster.map(studentNo => {
                  const sub = submissions.find(s => s.studentNumber === studentNo);
                  const isPending = pendingFiles.some(p => parseInt(p.studentNo) === studentNo && (p.status === 'pending' || p.status === 'processing'));
                  
                  let bgColor = "bg-gray-100 text-gray-400 border-gray-200"; // Missing
                  if (sub) {
                    const confidence = sub.result?.ocr_confidence_percent || 0;
                    if (confidence >= 85) bgColor = "bg-green-100 text-green-700 border-green-300 font-bold";
                    else if (confidence >= 70) bgColor = "bg-yellow-100 text-yellow-700 border-yellow-300 font-bold";
                    else bgColor = "bg-red-100 text-red-700 border-red-300 font-bold";
                  } else if (isPending) {
                    bgColor = "bg-blue-50 text-blue-500 border-blue-200 animate-pulse";
                  }

                  return (
                    <div 
                      key={studentNo} 
                      className={`aspect-square flex items-center justify-center rounded-lg border text-sm transition-colors ${bgColor}`}
                      title={sub ? `คะแนนรวม: ${sub.result.total_raw_score}` : "ยังไม่ส่ง/ยังไม่ได้ตรวจ"}
                    >
                      {studentNo}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded block"></span> ตรวจแล้ว (มั่นใจสูง)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded block"></span> ตรวจแล้ว (ควรเช็ค)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-50 border border-blue-200 rounded block"></span> กำลังรอตรวจในคิว</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-100 border border-gray-200 rounded block"></span> ยังไม่ส่งงาน (Missing)</div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
