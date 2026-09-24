"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FileText } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  // If already logged in, redirect to home
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) router.push("/");
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (error: any) {
      console.error("Login failed:", error);
      alert("ไม่สามารถเข้าสู่ระบบได้: " + error.message);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full text-center space-y-6">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-4 rounded-full">
            <FileText className="text-blue-600 h-10 w-10" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800">ระบบผู้ช่วย AI ตรวจข้อสอบ</h1>
        <p className="text-gray-500">กรุณาเข้าสู่ระบบด้วยบัญชี Google เพื่อใช้งานระบบสำหรับครูผู้สอน</p>
        
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-4 rounded-lg transition-colors shadow-sm"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
          เข้าสู่ระบบด้วย Google
        </button>
      </div>
    </main>
  );
}
