"use client";

import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Clock, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function PendingApprovalPage() {
  const { user, userData, loading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (userData && userData.role !== "guest") {
        // If the admin approved them, redirect to home
        router.push("/");
      }
    }
  }, [user, userData, loading, router]);

  const handleLogout = () => {
    auth.signOut();
    router.push("/login");
  };

  if (loading) return null; // Wait for redirect or status check

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full text-center space-y-6">
        <div className="flex justify-center mb-4">
          <div className="bg-yellow-100 p-4 rounded-full">
            <Clock className="text-yellow-600 h-12 w-12" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800">รอการอนุมัติ</h1>
        <p className="text-gray-600">
          บัญชีของคุณ (<b>{user?.email}</b>) อยู่ระหว่างรอการอนุมัติสิทธิการใช้งานจากผู้ดูแลระบบ
        </p>
        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
          เมื่อผู้ดูแลระบบกดอนุมัติแล้ว คุณจะสามารถเข้าสู่ระบบและเริ่มต้นใช้งานได้ทันที หากรอนานเกินไป โปรดติดต่อผู้ดูแลระบบ
        </p>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 font-medium py-2 px-4 transition-colors"
        >
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </div>
    </main>
  );
}
