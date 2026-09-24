"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2, Plus, FileText, ArrowRight, Folder } from "lucide-react";
import Link from "next/link";

export default function AssignmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    className: "",
    rubricId: "",
    maxStudents: 40
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else {
        setUser(currentUser);
        fetchData(currentUser.uid);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchData = async (uid: string) => {
    try {
      // Fetch Rubrics
      const rubricsSnap = await getDocs(query(collection(db, "rubrics"), where("createdBy", "==", uid)));
      const rubricsData = rubricsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRubrics(rubricsData);

      // Fetch Assignments
      const assignSnap = await getDocs(query(collection(db, "assignments"), where("createdBy", "==", uid)));
      const assignData = assignSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client side since we might need a composite index for orderBy
      assignData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAssignments(assignData);
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  const handleCreateAssignment = async () => {
    if (!newAssignment.title || !newAssignment.className || !newAssignment.rubricId) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setIsCreating(true);
    try {
      const selectedRubric = rubrics.find(r => r.id === newAssignment.rubricId);
      
      const docRef = await addDoc(collection(db, "assignments"), {
        ...newAssignment,
        rubricData: selectedRubric, // Store a snapshot of the rubric
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });
      
      // Redirect to the batch upload workspace for this assignment
      router.push(`/assignments/${docRef.id}`);
    } catch (error: any) {
      alert("สร้างชิ้นงานล้มเหลว: " + error.message);
      setIsCreating(false);
    }
  };

  if (authChecking || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">จัดการชิ้นงาน (Assignments)</h1>
            <p className="text-gray-500 mt-1">สร้างชิ้นงานใหม่ และเลือกเกณฑ์เพื่อรอการอัปโหลดข้อสอบแบบกลุ่ม (Batch Upload)</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">กลับหน้าหลัก</Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Assignment Form */}
          <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-blue-600" /> สร้างชิ้นงานใหม่
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อชิ้นงาน (เช่น สอบกลางภาค)</label>
                <input 
                  type="text" 
                  value={newAssignment.title}
                  onChange={e => setNewAssignment({...newAssignment, title: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน (เช่น ม.6/1)</label>
                <input 
                  type="text" 
                  value={newAssignment.className}
                  onChange={e => setNewAssignment({...newAssignment, className: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนนักเรียนในห้อง</label>
                <input 
                  type="number" 
                  value={newAssignment.maxStudents}
                  onChange={e => setNewAssignment({...newAssignment, maxStudents: Number(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลือกเกณฑ์ประเมิน (Rubric)</label>
                <select 
                  value={newAssignment.rubricId}
                  onChange={e => setNewAssignment({...newAssignment, rubricId: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- เลือกเกณฑ์ประเมิน --</option>
                  {rubrics.map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
                {rubrics.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">ยังไม่มีเกณฑ์ประเมิน <Link href="/rubrics" className="underline">คลิกที่นี่เพื่อสร้าง</Link></p>
                )}
              </div>
              <button 
                onClick={handleCreateAssignment}
                disabled={isCreating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mt-4 transition-colors disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="animate-spin" /> : "สร้างชิ้นงานและเริ่มตรวจ"}
              </button>
            </div>
          </section>

          {/* Assignments List */}
          <section className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Folder size={18} className="text-blue-600" /> ชิ้นงานทั้งหมดของคุณ
            </h2>
            
            {assignments.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500 shadow-sm">
                ไม่มีชิ้นงาน กรุณาสร้างชิ้นงานใหม่ทางด้านซ้าย
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignments.map(assignment => (
                  <Link href={`/assignments/${assignment.id}`} key={assignment.id} className="block group">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all h-full flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors line-clamp-1">{assignment.title}</h3>
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{assignment.className}</span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mb-4 line-clamp-1">
                        <FileText size={14}/> {assignment.rubricData?.title || 'ไม่มีชื่อเกณฑ์'}
                      </p>
                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                        <span className="text-gray-500">นักเรียนทั้งหมด {assignment.maxStudents} คน</span>
                        <span className="text-blue-600 font-medium flex items-center gap-1">เข้าไปตรวจงาน <ArrowRight size={16}/></span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}
