"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";
import { doc, getDoc, collection, addDoc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, UploadCloud, Play, CheckCircle, AlertTriangle, Download, X, Save, Sparkles, BrainCircuit, FileText, RefreshCw, ZoomIn } from "lucide-react";
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
  
  const { user, userData, loading: authChecking } = useUserRole();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const currentDaily = userData?.lastRequestDate === today ? (userData.dailyUsed || 0) : 0;
  const currentMonthly = userData?.lastRequestMonth === thisMonth ? (userData.monthlyUsed || 0) : 0;
  
  
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const maxAssignmentScore = assignment?.rubricData?.criteria?.reduce((sum: any, c: any) => sum + (Number(c.max_score) || 5), 0) || 0;  
  
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // AI Skills State
  const [skills, setSkills] = useState<any[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [activeSkillText, setActiveSkillText] = useState<string>("");
  const [isSkillEdited, setIsSkillEdited] = useState(false);
  const [isExtractingSkill, setIsExtractingSkill] = useState(false);

  // Review Modal State
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [originalAiText, setOriginalAiText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [editedScores, setEditedScores] = useState<any>({});
  const [teacherComments, setTeacherComments] = useState<any>({});
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Hover Zoom State
  const [showZoom, setShowZoom] = useState(false);
  const [zoomStyle, setZoomStyle] = useState({});
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!authChecking) {
      if (!user) router.push("/login");
      else if (userData?.role === "guest") router.push("/pending-approval");
      else if (assignmentId) {
        fetchAssignmentData(user.uid, assignmentId);
        fetchSkills();
      }
    }
  }, [user, userData, authChecking, router, assignmentId]);

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
      console.error("Error fetching assignment", error);
    }
  };

  const fetchSkills = async () => {
    try {
      const snap = await getDocs(collection(db, "ai_skills"));
      setSkills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching skills", error);
    }
  };

  const handleSkillChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedSkillId(val);
    setIsSkillEdited(false);
    if (val === "") {
      setActiveSkillText("");
    } else {
      const found = skills.find(s => s.id === val);
      if (found) setActiveSkillText(found.prompt);
    }
  };

  const handleSkillTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setActiveSkillText(e.target.value);
    setIsSkillEdited(true);
  };

  const saveAsNewSkill = async (defaultText?: string) => {
    const textToSave = defaultText || activeSkillText;
    const name = prompt("ตั้งชื่อสไตล์การตรวจใหม่นี้ (เช่น สไตล์ครูใจดี):");
    if (!name) return;
    try {
      const newSkill = {
        name,
        prompt: textToSave,
        createdBy: user.uid,
        creatorRole: userData?.role || 'teacher',
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "ai_skills"), newSkill);
      await fetchSkills();
      setSelectedSkillId(docRef.id);
      setActiveSkillText(textToSave);
      setIsSkillEdited(false);
      alert("บันทึกสไตล์การตรวจใหม่สำเร็จ!");
    } catch (error: any) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
    }
  };

  const extractSkillFromCorrections = async () => {
    if (!selectedSub) return;
    // Phase 4: Quota Check for Extract Skill
    if (!(await checkAndUpdateQuota(1))) {
      return;
    }
    setIsExtractingSkill(true);
    try {
      const res = await fetch("/api/extract-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalResult: selectedSub.result,
          editedScores,
          teacherComments,
          rubricData: assignment.rubricData
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (confirm(`AI สกัดสไตล์การตรวจของคุณได้ดังนี้:"${data.skillText}"คุณต้องการบันทึกเป็นสไตล์ใหม่เพื่อใช้ตรวจครั้งหน้าหรือไม่?`)) {
        await saveAsNewSkill(data.skillText);
      }
    } catch (err: any) {
      alert("สกัด Skill ล้มเหลว: " + err.message);
    }
    setIsExtractingSkill(false);
  };

  const handleFiles = (files: File[]) => {
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

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const updatePendingFile = (id: string, updates: Partial<PendingFile>) => {
    setPendingFiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(p => p.id !== id));
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

  const startBatchProcess = async () => {
    const filesToProcess = pendingFiles.filter(p => p.status === "pending" || p.status === "error");
    if (filesToProcess.length === 0) return;
    
    const missingNos = filesToProcess.filter(p => !p.studentNo.trim());
    if (missingNos.length > 0) {
      alert("กรุณาระบุเลขที่นักเรียนให้ครบทุกไฟล์ก่อนเริ่มตรวจ");
      return;
    }

    // Phase 4: Quota Check
    if (!(await checkAndUpdateQuota(filesToProcess.length))) {
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
        if (!cloudinaryData.secure_url) throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");

        const gradeRes = await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            imageUrl: cloudinaryData.secure_url,
            rubricData: assignment.rubricData,
            customStylePrompt: activeSkillText
          }),
        });

        const gradeData = await gradeRes.json();
        if (!gradeRes.ok) throw new Error(gradeData.error || "AI ประมวลผลล้มเหลว");

        const newSub = {
          assignmentId: assignment.id,
          studentNumber: parseInt(item.studentNo),
          imageUrl: cloudinaryData.secure_url,
          result: gradeData,
          createdAt: new Date().toISOString()
        };
        
        const subRef = await addDoc(collection(db, "submissions"), newSub);
        
        updatePendingFile(item.id, { status: "success", result: gradeData });
        setSubmissions(prev => [...prev.filter(s => s.studentNumber !== newSub.studentNumber), { id: subRef.id, ...newSub }]); 
        
        await new Promise(r => setTimeout(r, 3000));
        
      } catch (err: any) {
        updatePendingFile(item.id, { status: "error", errorMsg: err.message });
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    
    setIsProcessingBatch(false);
  };

  const getStatusColor = (sub: any) => {
    if (sub.isOverridden) return "bg-blue-100 text-blue-700 border-blue-300";
    if (sub.result?.needs_human_review) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    return "bg-green-100 text-green-700 border-green-300";
  };

  const exportCSV = () => {
    if (!assignment) return;
    const maxStudents = assignment.maxStudents || 0;
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "เลขที่,คะแนนรวม,สถานะการตรวจ";

    for (let i = 1; i <= maxStudents; i++) {
      const sub = submissions.find(s => s.studentNumber === i);
      if (sub) {
        const score = sub.isOverridden ? sub.overrideScore : sub.result?.total_raw_score;
        csvContent += `${i},${score},ตรวจแล้ว`;
      } else {
        csvContent += `${i},0,ยังไม่ส่ง`;
      }
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `คะแนน_${assignment.title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openReviewModal = (sub: any) => {
    setSelectedSub(sub);
    const rawAiText = sub.result?.transcribed_text || "";
    setOriginalAiText(rawAiText);
    setEditedText(rawAiText.replace(/<\/?unsure>/g, ''));
    
    const initialScores: any = {};
    const initialComments: any = {};
    if (sub.result?.evaluation) {
      Object.keys(sub.result.evaluation).forEach(k => {
        const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
        const weight = criteriaDef?.weight || 1;
        initialScores[k] = (sub.result.evaluation[k].score || 0) / weight;
        initialComments[k] = sub.result.evaluation[k].teacher_comment || "";
      });
    }
    setEditedScores(initialScores);
    setTeacherComments(initialComments);
  };

  const handleScoreChange = (criteriaId: string, val: number) => {
    setEditedScores((prev: any) => ({ ...prev, [criteriaId]: val }));
  };

  const handleCommentChange = (criteriaId: string, text: string) => {
    setTeacherComments((prev: any) => ({ ...prev, [criteriaId]: text }));
  };

  const calculateNewTotal = () => {
    if (!assignment?.rubricData?.criteria) return 0;
    return Object.keys(editedScores).reduce((acc: number, key: string) => {
      const criteriaDef = assignment.rubricData.criteria.find((c:any) => c.id === key);
      const weight = criteriaDef?.weight || 1;
      return acc + (Number(editedScores[key]) * weight);
    }, 0);
  };

  const saveOverride = async () => {
    if (!selectedSub) return;
    setIsSavingOverride(true);
    try {
      const newTotal = calculateNewTotal();
      
      const updatedResult = { ...selectedSub.result };
      updatedResult.transcribed_text = editedText; 
      updatedResult.total_raw_score = newTotal;
      if (updatedResult.evaluation) {
        Object.keys(editedScores).forEach(k => {
          if (updatedResult.evaluation[k]) {
            const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
            const weight = criteriaDef?.weight || 1;
            updatedResult.evaluation[k].score = editedScores[k] * weight;
            updatedResult.evaluation[k].teacher_comment = teacherComments[k] || "";
          }
        });
      }

      await updateDoc(doc(db, "submissions", selectedSub.id), {
        result: updatedResult,
        isOverridden: true,
        overrideScore: newTotal,
        overriddenAt: new Date().toISOString()
      });
      
      setSubmissions(prev => prev.map(s => s.id === selectedSub.id ? { ...s, result: updatedResult, isOverridden: true, overrideScore: newTotal } : s));
      setSelectedSub(null);
    } catch (err: any) {
      alert("บันทึกไม่สำเร็จ: " + err.message);
    }
    setIsSavingOverride(false);
  };

  const handleReanalyzeText = async () => {
    if (!selectedSub || !editedText.trim()) return;
    setIsReanalyzing(true);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          overrideText: editedText,
          rubricData: assignment.rubricData,
          customStylePrompt: activeSkillText
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "วิเคราะห์ใหม่ล้มเหลว");

      const newSubData = { ...selectedSub, result: data };
      setSelectedSub(newSubData);
      
      const initialScores: any = {};
      const initialComments: any = { ...teacherComments };
      if (data.evaluation) {
        Object.keys(data.evaluation).forEach(k => {
          const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
          const weight = criteriaDef?.weight || 1;
          initialScores[k] = (data.evaluation[k].score || 0) / weight;
        });
      }
      setEditedScores(initialScores);
      setTeacherComments(initialComments);
      alert("AI วิเคราะห์คะแนนใหม่จากข้อความที่แก้ไขเสร็จสมบูรณ์");

    } catch (err: any) {
      alert(err.message);
    }
    setIsReanalyzing(false);
  };

  // -------------------------
  // Live Diff Preview Logic
  // -------------------------
  const renderLiveDiff = () => {
    if (typeof Intl === 'undefined' || !Intl.Segmenter) {
      return <div className="text-gray-700">{editedText}</div>;
    }

    try {
      const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
      const cleanOriginal = originalAiText.replace(/<\/?unsure>/g, '');
      
      const oldWordsSet = new Set(Array.from(segmenter.segment(cleanOriginal)).map(s => s.segment));
      const unsureMatches = originalAiText.match(/<unsure>(.*?)<\/unsure>/g) || [];
      const unsureWordsSet = new Set(unsureMatches.map(s => s.replace(/<\/?unsure>/g, '')));
      const segments = Array.from(segmenter.segment(editedText));
      
      return (
        <div className="text-gray-800 leading-relaxed font-serif whitespace-pre-wrap">
          {segments.map((seg, idx) => {
            const w = seg.segment;
            if (w.trim() === '') return <span key={idx}>{w}</span>;
            
            if (!oldWordsSet.has(w)) {
              return <span key={idx} className="bg-green-100 text-green-700 font-bold px-0.5 rounded">{w}</span>;
            }
            if (unsureWordsSet.has(w)) {
              return <span key={idx} className="bg-red-100 text-red-600 font-bold px-0.5 rounded">{w}</span>;
            }
            return <span key={idx}>{w}</span>;
          })}
        </div>
      );
    } catch (e) {
      return <div className="text-gray-700">{editedText}</div>;
    }
  };

  // -------------------------
  // Hover Zoom Logic
  // -------------------------
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;
    const { left, top, width, height } = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      backgroundImage: `url(${selectedSub?.imageUrl})`,
      backgroundPosition: `${x}% ${y}%`,
      backgroundSize: '250%' // Zoom level
    });
  };

  if (authChecking || !user || !assignment) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Link href="/assignments" className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                {assignment.title} <span className="text-gray-500 font-medium text-lg">({assignment.className})</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <FileText size={14}/> เกณฑ์: {assignment.rubricData?.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
          {userData && (
            <div className="hidden md:flex flex-col gap-1 text-right text-xs bg-gray-50 p-2 rounded border border-gray-200">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 font-medium">โควต้าวันนี้:</span>
          <span className={currentDaily >= userData.rpdLimit ? "text-red-600 font-bold" : "text-gray-800 font-bold"}>
            {currentDaily} / {userData.rpdLimit}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 font-medium">รอบบิลเดือนนี้:</span>
          <span className={currentMonthly >= userData.monthlyQuota ? "text-red-600 font-bold" : "text-gray-800 font-bold"}>
            {currentMonthly} / {userData.monthlyQuota}
          </span>
        </div>
      </div>
    )}
    <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 font-medium text-sm transition-colors shadow-sm">
            <Download size={16} /> ส่งออกคะแนน (CSV)
          </button>
          </div>
        </header>

        {/* AI Skills Selection */}
        <section className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl shadow-sm border border-indigo-100">
          <div className="flex items-start gap-3 mb-4">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <BrainCircuit size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">สไตล์การตรวจ (Custom AI Skill)</h2>
              <p className="text-sm text-gray-600">เลือกสไตล์การตรวจของครูท่านอื่น หรือพิมพ์กำหนดตรรกะใหม่เอง เพื่อให้ AI ตรวจได้ตรงใจคุณมากที่สุด</p>
            </div>
          </div>
          
          <div className="space-y-4 bg-white p-4 rounded-xl border border-white shadow-sm">
            <div>
              <select 
                value={selectedSkillId}
                onChange={handleSkillChange}
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium bg-white"
              >
                <option value="">-- ไม่ใช้สไตล์ (อิงตาม Rubric ปกติ) --</option>
                {skills.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.createdBy === user.uid ? "(ของคุณ)" : ""}</option>
                ))}
              </select>
            </div>
            
            {(selectedSkillId !== "" || isSkillEdited) && (
              <div>
                <textarea 
                  value={activeSkillText}
                  onChange={handleSkillTextChange}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 bg-gray-50 resize-y"
                  placeholder="พิมพ์ตรรกะหรือสไตล์การตรวจของคุณ เช่น ใจดี เน้นความคิดสร้างสรรค์ หักคะแนนคำหยาบ..."
                />
                {isSkillEdited && (
                  <button 
                    onClick={() => saveAsNewSkill()}
                    className="mt-2 text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <Save size={14} /> บันทึกเป็นสไตล์ของฉัน (Clone & Save)
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Top: Upload Section */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UploadCloud size={20} className="text-blue-600"/> อัปโหลดกระดาษคำตอบ (Batch Upload)
          </h2>
          
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors relative ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <input type="file" multiple accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={onFileSelect} />
            <UploadCloud className={`mx-auto h-10 w-10 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-gray-900 font-medium text-lg">ลากไฟล์รูปภาพมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="text-gray-500 text-sm mt-1">ตั้งชื่อไฟล์เป็น "เลขที่.jpg" (เช่น 1.jpg) ระบบจะจับคู่ให้อัตโนมัติ</p>
          </div>

          {pendingFiles.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">คิวตรวจข้อสอบ ({pendingFiles.length} ไฟล์)</h3>
                <button 
                  onClick={startBatchProcess}
                  disabled={isProcessingBatch || !pendingFiles.some(p => p.status === 'pending' || p.status === 'error')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {isProcessingBatch ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                  เริ่มตรวจข้อสอบทั้งหมด
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[300px] overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                {pendingFiles.map((pf) => (
                  <div key={pf.id} className="relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm group">
                    <button onClick={() => removePendingFile(pf.id)} className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-gray-500 hover:text-red-500 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={14} />
                    </button>
                    <img src={pf.preview} alt="preview" className="w-full h-24 object-cover" />
                    <div className="p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-600">เลขที่:</label>
                        <input 
                          type="text" 
                          value={pf.studentNo}
                          onChange={e => updatePendingFile(pf.id, { studentNo: e.target.value })}
                          className="w-full border-b border-gray-300 outline-none text-sm text-center font-bold text-gray-900 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex justify-center">
                        {pf.status === 'pending' && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded w-full text-center font-medium">รอตรวจ</span>}
                        {pf.status === 'processing' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center justify-center gap-1 w-full font-medium"><Loader2 size={12} className="animate-spin"/> กำลังตรวจ</span>}
                        {pf.status === 'success' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded w-full text-center font-medium">เสร็จสิ้น</span>}
                        {pf.status === 'error' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded w-full text-center font-medium truncate" title={pf.errorMsg}>ล้มเหลว</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Bottom: Roster Section */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">สถานะการส่งงาน (Roster)</h2>
              <p className="text-sm text-gray-600">คลิกที่หมายเลขเพื่อดูผลตรวจและแก้ไขคะแนน</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div> ตรวจแล้ว (มั่นใจสูง)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div> ตรวจแล้ว (ควรตรวจสอบซ้ำ)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div> แก้ไขคะแนนแล้วด้วยมือ</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></div> ยังไม่ส่งงาน</div>
            </div>
          </div>
          
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-2 md:gap-3">
            {Array.from({ length: assignment.maxStudents }).map((_, i) => {
              const num = i + 1;
              const sub = submissions.find(s => s.studentNumber === num);
              
              if (sub) {
                return (
                  <button 
                    key={num} 
                    onClick={() => openReviewModal(sub)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 shadow-sm transition-transform hover:scale-105 ${getStatusColor(sub)}`}
                  >
                    <span className="font-bold text-lg leading-tight">{num}</span>
                    {sub.result && (
                      <span className={`text-[11px] font-medium leading-none mt-1 px-1.5 py-0.5 rounded-full ${sub.isOverridden ? 'bg-blue-200 text-blue-800' : 'bg-white/50 text-gray-700'}`}>
                        {sub.isOverridden ? sub.overrideScore : (sub.result.total_raw_score || 0)}/{maxAssignmentScore}
                      </span>
                    )}
                  </button>
                );
              }
              
              const pFile = pendingFiles.find(p => parseInt(p.studentNo) === num);
              if (pFile) {
                return (
                  <div key={num} className="aspect-square flex items-center justify-center rounded-xl border-2 border-blue-200 bg-blue-50/50 text-blue-400 font-bold text-lg shadow-inner">
                    {pFile.status === 'processing' ? <Loader2 className="animate-spin text-blue-500" size={20}/> : num}
                  </div>
                );
              }

              return (
                <div key={num} className="aspect-square flex items-center justify-center rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-400 font-bold text-lg">
                  {num}
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* Teacher Review Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                นักเรียนเลขที่ {selectedSub.studentNumber}
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${selectedSub.result?.needs_human_review ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                  AI มั่นใจ: {selectedSub.result?.ocr_confidence_percent || 0}%
                </span>
                {selectedSub.isOverridden && <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">แก้ไขด้วยมือแล้ว</span>}
              </h3>
              <button onClick={() => setSelectedSub(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
              
              {/* Left: Original Image & Hover Zoom */}
              <div className="lg:w-5/12">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <ZoomIn size={16} className="text-blue-600"/> กระดาษคำตอบต้นฉบับ 
                  <span className="text-xs font-normal text-gray-500">(ชี้เพื่อซูม)</span>
                </h4>
                
                {/* Hover Zoom Container */}
                <div 
                  className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative group cursor-crosshair"
                  onMouseEnter={() => setShowZoom(true)}
                  onMouseLeave={() => setShowZoom(false)}
                  onMouseMove={handleMouseMove}
                >
                  <img 
                    ref={imageRef}
                    src={selectedSub.imageUrl} 
                    alt="Exam" 
                    className="w-full h-auto object-contain max-h-[75vh]" 
                  />
                  
                  {/* Magnifying Glass (Floating Div) */}
                  {showZoom && (
                    <div 
                      className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200"
                      style={zoomStyle}
                    ></div>
                  )}

                  <a href={selectedSub.imageUrl} target="_blank" rel="noreferrer" className="absolute top-2 right-2 bg-white/90 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white z-20">
                    ดูรูปเต็ม
                  </a>
                </div>
              </div>

              {/* Right: AI Evaluation & Edit form */}
              <div className="lg:w-7/12 space-y-6">
                
                {/* Text Editing & Live Preview */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-900">ข้อความที่แกะมาได้ (สามารถแก้ไขได้)</h4>
                    <div className="flex gap-3 text-xs font-medium">
                      <span className="text-red-600 bg-red-50 px-2 py-1 rounded">จุดที่ AI ไม่มั่นใจ</span>
                      <span className="text-green-700 bg-green-50 px-2 py-1 rounded">คำที่คุณพิมพ์แก้/เพิ่ม</span>
                    </div>
                  </div>
                  
                  {/* Live Preview Box - Resizable */}
                  <div className="mb-3 p-4 bg-gray-50 rounded-lg border border-gray-200 h-28 overflow-auto resize-y shadow-inner">
                    {renderLiveDiff()}
                  </div>

                  <textarea 
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full bg-white p-4 rounded-lg border border-gray-300 text-sm text-gray-900 font-serif leading-relaxed h-28 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                  />

                  <button 
                    onClick={handleReanalyzeText}
                    disabled={isReanalyzing || !editedText.trim() || editedText === originalAiText.replace(/<\/?unsure>/g, '')}
                    className="mt-3 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isReanalyzing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    วิเคราะห์และให้คะแนนใหม่จากข้อความด้านบนนี้ (Re-analyze)
                  </button>
                </div>

                {/* Criteria Score Breakdown & Teacher Comments */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">รายละเอียดคะแนนรายข้อ <span className="text-sm font-normal text-gray-500">(ระบบคำนวณคะแนนรวมให้อัตโนมัติ)</span></h4>
                  <div className="space-y-4">
                    {Object.entries(selectedSub.result?.evaluation || {})
                      .sort(([keyA], [keyB]) => {
                        const numA = parseInt(keyA.replace(/\D/g, '')) || 0;
                        const numB = parseInt(keyB.replace(/\D/g, '')) || 0;
                        return numA - numB;
                      })
                      .map(([key, data]: [string, any]) => {
                      const criteriaDef = assignment.rubricData?.criteria?.find((c:any) => c.id === key);
                      const weight = criteriaDef?.weight || 1;
                      const maxRaw = criteriaDef?.raw_score || criteriaDef?.max_score || 0;
                      const currentRaw = editedScores[key] ?? ((data.score || 0) / weight);
                      const totalSubScore = currentRaw * weight;

                      return (
                        <div key={key} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                          <div className="flex flex-col xl:flex-row justify-between xl:items-start gap-3">
                            <label className="text-sm font-bold text-gray-800 flex-1">{key.replace('c', 'ข้อที่ ')}: {criteriaDef?.name}</label>
                            
                            {/* Score Breakdown UI */}
                            <div className="flex flex-wrap items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg border border-gray-200 shrink-0">
                              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded px-2 py-1">
                                <span className="text-gray-500 font-medium">ดิบ</span>
                                <input 
                                  type="number"
                                  min={0}
                                  max={maxRaw}
                                  value={currentRaw}
                                  onChange={(e) => handleScoreChange(key, Number(e.target.value))}
                                  className="w-12 text-center font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                />
                                <span className="text-gray-400">/ {maxRaw}</span>
                              </div>
                              <span className="text-gray-400">x</span>
                              <div className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-600 font-medium">
                                น้ำหนัก {weight}
                              </div>
                              <span className="text-gray-400">=</span>
                              <div className="bg-blue-50 border border-blue-200 rounded px-3 py-1 font-bold text-blue-700">
                                {totalSubScore} คะแนน
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg leading-relaxed border border-gray-100">{data.reason}</p>
                          
                          {/* Teacher Comment Box */}
                          <div>
                            <textarea 
                              placeholder="หมายเหตุ/เหตุผลที่ครูแก้ไขคะแนนข้อนี้ (Teacher Comment)..."
                              value={teacherComments[key] || ""}
                              onChange={(e) => handleCommentChange(key, e.target.value)}
                              className="w-full text-sm p-3 border border-blue-200 rounded-lg bg-blue-50/30 focus:bg-white resize-y outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-blue-300 text-blue-900"
                              rows={2}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Final Score and Save Actions */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200 flex flex-col sm:flex-row justify-between items-center shadow-sm gap-4">
                  <h4 className="font-bold text-gray-900 text-lg">คะแนนรวมสุทธิ:</h4>
                  <span className="text-3xl font-bold text-blue-700">{calculateNewTotal()} คะแนน</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={saveOverride}
                    disabled={isSavingOverride}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 text-lg"
                  >
                    {isSavingOverride ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    บันทึกคะแนน
                  </button>
                  
                  <button
                    onClick={extractSkillFromCorrections}
                    disabled={isExtractingSkill}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 text-base"
                  >
                    {isExtractingSkill ? <Loader2 className="animate-spin" /> : <BrainCircuit size={18} />}
                    🧠 เรียนรู้สไตล์การตรวจ
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}
