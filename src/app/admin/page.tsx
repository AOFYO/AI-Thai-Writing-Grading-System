"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query } from "firebase/firestore";
import { Loader2, ArrowLeft, ShieldCheck, Database, Users } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, userData, loading } = useUserRole();
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      else if (userData?.role !== "admin") router.push("/");
    }
  }, [user, userData, loading, router]);

  const handleMigration = async () => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าจะทำการโอนกรรมสิทธิ์ข้อมูลเก่า (Rubrics และ AI Skills) ทั้งหมดให้เป็นของ Admin?")) return;
    
    setIsMigrating(true);
    try {
      let migratedCount = 0;

      // Migrate Rubrics
      const rubricsSnap = await getDocs(collection(db, "rubrics"));
      for (const d of rubricsSnap.docs) {
        const data = d.data();
        if (!data.creatorRole || data.creatorRole !== 'admin') {
          await updateDoc(doc(db, "rubrics", d.id), {
            createdBy: user.uid,
            creatorRole: "admin",
            updatedAt: new Date().toISOString()
          });
          migratedCount++;
        }
      }

      // Migrate AI Skills
      const skillsSnap = await getDocs(collection(db, "ai_skills"));
      for (const d of skillsSnap.docs) {
        const data = d.data();
        if (!data.creatorRole || data.creatorRole !== 'admin') {
          await updateDoc(doc(db, "ai_skills", d.id), {
            createdBy: user.uid,
            creatorRole: "admin",
            updatedAt: new Date().toISOString()
          });
          migratedCount++;
        }
      }

      alert(`โอนกรรมสิทธิ์สำเร็จ! ทำการแก้ไขข้อมูลทั้งหมด ${migratedCount} รายการ`);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
    setIsMigrating(false);
  };

  if (loading || userData?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                <ShieldCheck className="text-red-600" /> Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">ระบบจัดการและตั้งค่าสำหรับผู้ดูแลระบบ</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Migration Card */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <Database size={24} />
              <h2 className="text-lg font-bold text-gray-800">จัดการฐานข้อมูล (Migration)</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              โอนกรรมสิทธิ์เกณฑ์ประเมิน (Rubrics) และ AI Skills แบบเก่าทั้งหมด ที่ถูกสร้างไว้ก่อนระบบ RBAC เพื่อให้กลายเป็นของ Admin (ป้อนกันการถูกแก้ไขโดย Teacher)
            </p>
            <button
              onClick={handleMigration}
              disabled={isMigrating}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isMigrating ? <Loader2 className="animate-spin h-5 w-5" /> : "ดำเนินการโอนข้อมูลเก่า"}
            </button>
          </section>

          {/* User Management Placeholder */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 opacity-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/40 flex items-center justify-center z-10 backdrop-blur-[1px]">
              <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">Coming Soon</span>
            </div>
            <div className="flex items-center gap-3 mb-4 text-purple-600">
              <Users size={24} />
              <h2 className="text-lg font-bold text-gray-800">จัดการสิทธิผู้ใช้งาน</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              อนุมัติผู้ใช้งานใหม่ (Guest → Teacher), กำหนดโควต้า (Tiers) รายวัน/รายเดือน และดูประวัติการเข้าใช้งาน
            </p>
            <button disabled className="w-full bg-gray-100 text-gray-500 font-medium py-2.5 px-4 rounded-lg">
              จัดการผู้ใช้
            </button>
          </section>

        </div>
      </div>
    </main>
  );
}
