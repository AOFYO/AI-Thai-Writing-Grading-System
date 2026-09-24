"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, UploadCloud, Play, CheckCircle, AlertTriangle, FileText, Download, X, Save } from "lucide-react";
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

export default function AssignmentWorkspace() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params?.id as string;
  
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Review Modal State
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else {
        setUser(currentUser);
        if (assignmentId) {
          fetchAssignmentData(currentUser.uid, assignmentId);
        }
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [router, assignmentId]);

  const fetchAssignmentData = async (uid: string, id: string) => {
    try {
      if (!id) return;
      const docRef = doc(db, "assignments", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().createdBy === uid) {
        setAssignment({ id: docSnap.id, ...docSnap.data() });
      } else {
        router.push("/assignments"); 
        return;
      }

      const subSnap = await getDocs(query(collection(db, "submissions"), where("assignmentId", "==", id)));
      setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const newPending = files.map(f => {
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
    
    const missingNos = filesToProcess.filter(p => !p.studentNo.trim());
    if (missingNos.length > 0) {
      alert("กรุณาระบุเลขที่นักเรียนให้ครบทุกรูปก่อนเริ่มตรวจ");
      return;
    }

    setIsProcessingBatch(true);

    for (const item of filesToProcess) {
      updatePendingFile(item.id, { status: "processing" });

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
        
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST", body: formData,
        });
        const cloudinaryData = await cloudinaryRes.json();
        if (!cloudinaryData.secure_url) throw new Error("อัปโหลดรูปล้มเหลว");

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

        const newSub = {
          assignmentId: assignment.id,
          studentNumber: parseInt(item.studentNo),
          imageUrl: cloudinaryData.secure_url,
          result: gradeData,
          createdAt: new Date().toISOString()
        };
        
        const subRef = await addDoc(collection(db, "submissions"), newSub);
        
        updatePendingFile(item.id, { status: "success", result: gradeData });
        setSubmissions(prev => [...prev.filter(s => s.studentNumber !== newSub.studentNumber), { id: subRef.id, ...newSub }]); // Prevent dupe display if retried

      } catch (error: any) {
        updatePendingFile(item.id, { status: "error", errorMsg: error.message });
      }

      if (filesToProcess.indexOf(item) !== filesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    setIsProcessingBatch(false);
  };

  const exportToCSV = () => {
    // UTF-8 BOM for Excel Thai support
    let csv = "\uFEFFเลขที่,คะแนนรวม,ความมั่นใจ AI,สถานะ\n";
    
    for (let i = 1; i <= assignment.maxStudents; i++) {
      const sub = submissions.find(s => s.studentNumber === i);
      if (sub) {
        const overrideMark = sub.result.is_overridden ? " (แก้โดยครู)" : "";
        const score = sub.result.total_raw_score + overrideMark;
        const conf = sub.result.ocr_confidence_percent + "%";
        const status = sub.result.needs_human_review ? "ควรตรวจสอบซ้ำ" : "ตรวจแล้ว";
        csv += `${i},${score},${conf},${status}\n`;
      } else {
        csv += `${i},0,0%,ยังไม่ส่ง\n`;
      }
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `คะแนน_${assignment.title}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openReviewModal = (sub: any) => {
    setSelectedSub(sub);
    setOverrideScore(sub.result.total_raw_score);
  };

  const handleSaveOverride = async () => {
    if (!selectedSub) return;
    setIsSavingOverride(true);
    try {
      const docRef = doc(db, "submissions", selectedSub.id);
      await updateDoc(docRef, {
        "result.total_raw_score": overrideScore,
        "result.is_overridden": true
      });
      
      setSubmissions(prev => prev.map(s => 
        s.id === selectedSub.id 
          ? { ...s, result: { ...s.result, total_raw_score: overrideScore, is_overridden: true } } 
          : s
      ));
      setSelectedSub(null);
    } catch (error) {
      alert("บันทึกคะแนนล้มเหลว");
    }
    setIsSavingOverride(false);
  };

  if (authChecking || !user || !assignment) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

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
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors border border-blue-200"
          >
            <Download size={18} /> ส่งออกคะแนน (CSV)
          </button>
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
                    {pendingFiles.map((item) => (
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

                        <div className="w-40 flex flex-col items-end justify-center">
                          {item.status === "pending" && <button onClick={() => removePendingFile(item.id)} className="text-sm text-red-500 hover:underline">ลบออก</button>}
                          {item.status === "processing" && <span className="text-blue-500 flex items-center gap-1 text-sm"><Loader2 size={14} className="animate-spin"/> กำลังตรวจ</span>}
                          {item.status === "success" && <span className="text-green-600 flex items-center gap-1 text-sm"><CheckCircle size={14}/> ตรวจสำเร็จ</span>}
                          {item.status === "error" && (
                            <div className="text-right">
                              <span className="text-red-500 flex items-center justify-end gap-1 text-sm font-semibold"><AlertTriangle size={14}/> ผิดพลาด</span>
                              <p className="text-xs text-red-400 mt-1 line-clamp-2 max-w-[150px]" title={item.errorMsg}>{item.errorMsg}</p>
                            </div>
                          )}
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
              <p className="text-sm text-gray-500 mb-4">คลิกที่เลขที่เพื่อดูผลการตรวจและแก้ไขคะแนน</p>
              
              <div className="grid grid-cols-5 gap-2">
                {roster.map(studentNo => {
                  const sub = submissions.find(s => s.studentNumber === studentNo);
                  const isPending = pendingFiles.some(p => parseInt(p.studentNo) === studentNo && (p.status === 'pending' || p.status === 'processing'));
                  
                  let bgColor = "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"; // Missing
                  if (sub) {
                    const confidence = sub.result?.ocr_confidence_percent || 0;
                    if (confidence >= 85) bgColor = "bg-green-100 text-green-700 border-green-300 font-bold hover:bg-green-200 cursor-pointer shadow-sm";
                    else if (confidence >= 70) bgColor = "bg-yellow-100 text-yellow-700 border-yellow-300 font-bold hover:bg-yellow-200 cursor-pointer shadow-sm";
                    else bgColor = "bg-red-100 text-red-700 border-red-300 font-bold hover:bg-red-200 cursor-pointer shadow-sm";
                  } else if (isPending) {
                    bgColor = "bg-blue-50 text-blue-500 border-blue-200 animate-pulse";
                  }

                  return (
                    <div 
                      key={studentNo} 
                      onClick={() => sub && openReviewModal(sub)}
                      className={`aspect-square flex items-center justify-center rounded-lg border text-sm transition-all ${bgColor}`}
                      title={sub ? "คะแนนรวม: " + sub.result.total_raw_score : "ยังไม่ส่ง/ยังไม่ได้ตรวจ"}
                    >
                      {studentNo}
                      {sub?.result?.is_overridden && <span className="absolute ml-5 -mt-5 text-[10px] text-blue-600 font-black">*</span>}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded block"></span> ตรวจแล้ว (มั่นใจสูง)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded block"></span> ตรวจแล้ว (ควรตรวจสอบซ้ำ)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-50 border border-blue-200 rounded block"></span> กำลังรอตรวจในคิว</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-100 border border-gray-200 rounded block"></span> ยังไม่ส่งงาน (Missing)</div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Review & Override Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
            
            {/* Left: Original Image */}
            <div className="w-full md:w-1/2 bg-gray-100 border-r border-gray-200 overflow-y-auto p-4 flex flex-col items-center max-h-[40vh] md:max-h-full relative">
              <a href={selectedSub.imageUrl} target="_blank" rel="noreferrer" className="absolute top-6 right-6 bg-white/80 p-2 rounded shadow hover:bg-white text-sm font-medium">ดูรูปเต็ม</a>
              <img src={selectedSub.imageUrl} alt="กระดาษคำตอบ" className="w-full h-auto rounded-lg shadow-sm" />
            </div>

            {/* Right: AI Analysis & Score Override */}
            <div className="w-full md:w-1/2 flex flex-col h-full bg-white max-h-[50vh] md:max-h-full">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">นักเรียนเลขที่ {selectedSub.studentNumber}</h2>
                  <p className="text-sm text-gray-500">AI มั่นใจในการอ่าน: {selectedSub.result.ocr_confidence_percent}%</p>
                </div>
                <button onClick={() => setSelectedSub(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2 border-b pb-1">ข้อความที่ AI อ่านได้</h3>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap border border-gray-100 font-serif leading-relaxed">
                    {selectedSub.result.transcribed_text || "อ่านข้อความไม่ออก"}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-2 border-b pb-1">รายละเอียดคะแนนรายข้อ</h3>
                  <div className="space-y-3">
                    {Object.entries(selectedSub.result.evaluation || {}).map(([key, value]: [string, any]) => {
                      const criteriaName = assignment.rubricData?.criteria?.find((c:any) => c.id === key)?.name || key;
                      return (
                        <div key={key} className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm">
                          <div className="flex justify-between font-medium text-gray-800 mb-1">
                            <span>{criteriaName}</span>
                            <span className="text-blue-700">{value.score} คะแนน</span>
                          </div>
                          <p className="text-gray-600 text-xs">{value.reason}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {selectedSub.result.teacher_feedback && (
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 border-b pb-1">คำแนะนำจาก AI</h3>
                    <p className="text-sm text-gray-600 italic bg-amber-50 p-3 rounded border border-amber-100">
                      "{selectedSub.result.teacher_feedback}"
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer - Score Override */}
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">แก้ไขคะแนนรวม (ถ้า AI ตรวจพลาด)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        value={overrideScore}
                        onChange={(e) => setOverrideScore(Number(e.target.value))}
                        className="w-24 p-2 border border-gray-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-gray-500">
                        / {assignment.rubricData?.criteria?.reduce((acc:number, c:any) => acc + c.max_score, 0) || "?"} คะแนน
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveOverride}
                    disabled={isSavingOverride || overrideScore === selectedSub.result.total_raw_score}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingOverride ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    บันทึกคะแนน
                  </button>
                </div>
                {selectedSub.result.is_overridden && (
                  <p className="text-xs text-blue-600 mt-2">* คะแนนนี้ถูกแก้ไขโดยครูแล้ว</p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </main>
  );
}
