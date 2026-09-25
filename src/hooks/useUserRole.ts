import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export interface UserData {
  uid: string;
  email: string;
  role: "admin" | "teacher" | "guest";
  tier: "free" | "premium" | "unlimited";
  monthlyQuota: number;
  monthlyUsed: number;
  rpdLimit: number;
  dailyUsed: number;
  lastRequestDate: string;
  lastRequestMonth: string;
}

export function useUserRole() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Listen to user document changes in real-time so quota/role updates reflect immediately
        const unsubscribeDoc = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
          } else {
            setUserData(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Error fetching user data:", err);
          setLoading(false);
        });
        
        return () => unsubscribeDoc();
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return { user, userData, loading };
}
