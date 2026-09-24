"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, FileText, CheckSquare, Settings, LogOut, FileSignature, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

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

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!user) return null; // Will redirect in useEffect

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-8">
      <div className="max-w-4xl w-full">
        
        {/* Header / Top Navigation */}
        <header className="flex flex-col sm:flex-row items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <FileSignature size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight">AI Thai Writing Grader</h1>
              <p className="text-sm text-gray-500">ยินดีต้อนรับ, {user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-600 font-medium text-sm flex items-center gap-2 transition-colors px-4 py-2 hover:bg-red-50 rounded-lg"
          >
            <LogOut size={16} /> ออกจากระบบ
          </button>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Assignments Hub */}
          <Link href="/assignments" className="group">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-400 hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              
              <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CheckSquare size={32} />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-3">เริ่มตรวจข้อสอบ</h2>
              <p className="text-gray-500 mb-8 flex-1 leading-relaxed">
                สร้างห้องเรียน อัปโหลดรูปกระดาษคำตอบทีละหลายแผ่นเพื่อตรวจรวดเดียว พร้อมระบบเช็คชื่อและจัดการเกรด (Assignments Hub)
              </p>
              
              <div className="flex items-center text-blue-600 font-semibold gap-2 group-hover:gap-3 transition-all">
                เข้าสู่โหมดตรวจข้อสอบ <ArrowRight size={18} />
              </div>
            </div>
          </Link>

          {/* Card 2: Rubrics Builder */}
          <Link href="/rubrics" className="group">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:border-purple-400 hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              
              <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Settings size={32} />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-3">จัดการเกณฑ์ประเมิน</h2>
              <p className="text-gray-500 mb-8 flex-1 leading-relaxed">
                สร้างและแก้ไขเกณฑ์การให้คะแนน (Rubrics) โดยสามารถอัปโหลดภาพตารางเพื่อให้ AI ช่วยสกัดน้ำหนักและเงื่อนไขให้อัตโนมัติ
              </p>
              
              <div className="flex items-center text-purple-600 font-semibold gap-2 group-hover:gap-3 transition-all">
                เข้าสู่ตัวสร้างเกณฑ์ <ArrowRight size={18} />
              </div>
            </div>
          </Link>

        </div>

        {/* Footer info */}
        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>ระบบประเมินงานเขียนภาษาไทยด้วย AI • พัฒนาด้วย Next.js, Firebase & Gemini API</p>
        </div>
        
      </div>
    </main>
  );
}
