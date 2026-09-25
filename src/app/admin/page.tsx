"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { Loader2, ArrowLeft, ShieldCheck, Database, Users, Check, Save } from "lucide-react";
import Link from "next/link";

interface UserDoc {
  id: string;
  email: string;
  role: string;
  tier: string;
  monthlyQuota: number;
  monthlyUsed: number;
  rpdLimit: number;
  dailyUsed: number;
  createdAt?: string;
}

const TIER_DEFAULTS = {
  free: { monthlyQuota: 50, rpdLimit: 10 },
  premium: { monthlyQuota: 1000, rpdLimit: 200 },
  unlimited: { monthlyQuota: 99999, rpdLimit: 99999 }
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, userData, loading } = useUserRole();
  const [isMigrating, setIsMigrating] = useState(false);
  
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      else if (userData?.role !== "admin") router.push("/");
      else fetchUsers();
    }
  }, [user, userData, loading, router]);

  const fetchUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const snap = await getDocs(query(collection(db, "users")));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc));
      data.sort((a, b) => {
        if (a.role === 'guest' && b.role !== 'guest') return -1;
        if (a.role !== 'guest' && b.role === 'guest') return 1;
        return 0;
      });
      setUsers(data);
    } catch (error) {
      console.error(error);
    }
    setIsFetchingUsers(false);
  };

  const handleMigration = async () => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าจะทำการโอนกรรมสิทธิ์ข้อมูลเก่า (Rubrics และ AI Skills) ทั้งหมดให้เป็นของ Admin?")) return;
    
    setIsMigrating(true);
    try {
      let migratedCount = 0;

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

  const updateUser = async (userId: string, newRole: string, newTier: string) => {
    setUpdatingUserId(userId);
    try {
      const defaults = TIER_DEFAULTS[newTier as keyof typeof TIER_DEFAULTS];
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
        tier: newTier,
        monthlyQuota: defaults.monthlyQuota,
        rpdLimit: defaults.rpdLimit,
        updatedAt: new Date().toISOString()
      });
      alert("อัปเดตสิทธิผู้ใช้สำเร็จ!");
      fetchUsers();
    } catch (error: any) {
      alert("อัปเดตไม่สำเร็จ: " + error.message);
    }
    setUpdatingUserId(null);
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
      <div className="max-w-6xl mx-auto space-y-6">
        
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
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <Database size={24} />
              <h2 className="text-lg font-bold text-gray-800">จัดการฐานข้อมูล (Migration)</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              โอนกรรมสิทธิ์เกณฑ์ประเมิน (Rubrics) และ AI Skills แบบเก่าทั้งหมด เพื่อให้กลายเป็นของ Admin (ป้อนกันการถูกแก้ไขโดย Teacher)
            </p>
            <button
              onClick={handleMigration}
              disabled={isMigrating}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isMigrating ? <Loader2 className="animate-spin h-5 w-5" /> : "ดำเนินการโอนข้อมูลเก่า"}
            </button>
          </section>
        </div>

        {/* User Management */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 text-purple-600">
              <Users size={24} />
              <h2 className="text-lg font-bold text-gray-800">จัดการสิทธิผู้ใช้งาน (Users & Quotas)</h2>
            </div>
            <button onClick={fetchUsers} className="text-sm text-blue-600 hover:underline">รีเฟรชข้อมูล</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-4 py-3">อีเมล</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">รายเดือน (ใช้/ทั้งหมด)</th>
                  <th className="px-4 py-3">รายวัน (ใช้/สูงสุด)</th>
                  <th className="px-4 py-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isFetchingUsers ? (
                  <tr><td colSpan={6} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 text-gray-400 mx-auto" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">ไม่พบข้อมูลผู้ใช้</td></tr>
                ) : users.map(u => (
                  <UserRow key={u.id} user={u} onSave={(role, tier) => updateUser(u.id, role, tier)} isSaving={updatingUserId === u.id} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}

function UserRow({ user, onSave, isSaving }: { user: UserDoc, onSave: (r: string, t: string) => void, isSaving: boolean }) {
  const [role, setRole] = useState(user.role);
  const [tier, setTier] = useState(user.tier);
  const isChanged = role !== user.role || tier !== user.tier;

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-4 py-3 font-medium text-gray-900">{user.email}</td>
      <td className="px-4 py-3">
        <select value={role} onChange={e => setRole(e.target.value)} className={`border p-1.5 rounded text-sm outline-none ${role === 'guest' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : role === 'admin' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-300'}`}>
          <option value="guest">Guest (รออนุมัติ)</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <select value={tier} onChange={e => setTier(e.target.value)} className="border p-1.5 rounded text-sm outline-none bg-white border-gray-300">
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          <option value="unlimited">Unlimited</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${user.monthlyUsed >= user.monthlyQuota ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: \`\${Math.min(100, (user.monthlyUsed / user.monthlyQuota) * 100)}%\` }}></div>
          </div>
          <span className="text-xs">{user.monthlyUsed} / {user.monthlyQuota}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${user.dailyUsed >= user.rpdLimit ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: \`\${Math.min(100, (user.dailyUsed / user.rpdLimit) * 100)}%\` }}></div>
          </div>
          <span className="text-xs">{user.dailyUsed} / {user.rpdLimit}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {isChanged && (
          <button 
            onClick={() => onSave(role, tier)}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 ml-auto disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin h-3 w-3" /> : <Save size={14} />} บันทึก
          </button>
        )}
      </td>
    </tr>
  );
}
