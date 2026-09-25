"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !isLoggingIn) router.push("/");
    });
    return () => unsubscribe();
  }, [router, isLoggingIn]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // First time login -> Register in DB
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
        const isMasterAdmin = user.email === adminEmail;
        
        const initialUserData = {
          uid: user.uid,
          email: user.email,
          role: isMasterAdmin ? "admin" : "guest",
          tier: "free",
          monthlyQuota: 100, // Default for new users
          monthlyUsed: 0,
          rpdLimit: 20, // Default 20 scans per day
          dailyUsed: 0,
          lastRequestDate: "",
          lastRequestMonth: "",
          createdAt: new Date().toISOString()
        };
        
        await setDoc(userRef, initialUserData);
      }
      
      router.push("/");
    } catch (error: any) {
      console.error("Login failed:", error);
      alert("เข้าสู่ระบบล้มเหลว: " + error.message);
    } finally {
      setIsLoggingIn(false);
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
        
        <h1 className="text-2xl font-bold text-gray-800">ระบบ AI ตรวจข้อสอบ</h1>
        <p className="text-gray-500">กรุณาเข้าสู่ระบบด้วยบัญชี Google เพื่อใช้งาน</p>
        
        <button 
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-4 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {isLoggingIn ? (
            <Loader2 className="animate-spin text-gray-500" />
          ) : (
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
          )}
          เข้าสู่ระบบด้วย Google
        </button>
      </div>
    </main>
  );
}
