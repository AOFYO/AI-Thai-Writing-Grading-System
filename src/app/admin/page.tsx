"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, setDoc, query, orderBy, limit } from "firebase/firestore";
import {
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Database,
  Users,
  Save,
  Cpu,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  TrendingUp,
  Clock,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import {
  AIConfig,
  AIProvider,
  AVAILABLE_MODELS,
  DEFAULT_AI_CONFIG,
  ModelRouteItem
} from "@/lib/types/ai-router";

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

interface UsageLogDoc {
  id: string;
  timestamp: string;
  userId: string;
  assignmentId: string;
  studentNumber: number;
  provider: AIProvider;
  modelId: string;
  routeType: 'primary' | 'fallback';
  latencyMs: number;
  success: boolean;
  errorMessage?: string | null;
  usedFallback: boolean;
  aiConfidence: number;
  totalRawScore: number;
  wasOverridden: boolean;
  overrideScore?: number | null;
}

const TIER_DEFAULTS = {
  free: { monthlyQuota: 50, rpdLimit: 10 },
  premium: { monthlyQuota: 1000, rpdLimit: 200 },
  unlimited: { monthlyQuota: 99999, rpdLimit: 99999 }
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, userData, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState<'users' | 'ai_config' | 'performance'>('users');
  
  // Migration & User management state
  const [isMigrating, setIsMigrating] = useState(false);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // AI Config state
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [isFetchingConfig, setIsFetchingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; message?: string } | null>(null);

  // Performance state
  const [logs, setLogs] = useState<UsageLogDoc[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [timeFilterDays, setTimeFilterDays] = useState<number>(30);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      else if (userData?.role !== "admin") router.push("/");
      else {
        fetchUsers();
        fetchAIConfig();
        fetchPerformanceLogs();
      }
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

  const fetchAIConfig = async () => {
    setIsFetchingConfig(true);
    try {
      const snap = await getDocs(collection(db, "settings"));
      const configDoc = snap.docs.find(d => d.id === 'ai_config');
      if (configDoc && configDoc.exists()) {
        setAiConfig({ ...DEFAULT_AI_CONFIG, ...configDoc.data() } as AIConfig);
      } else {
        setAiConfig(DEFAULT_AI_CONFIG);
      }
    } catch (err) {
      console.warn("Could not fetch ai_config, using defaults:", err);
      setAiConfig(DEFAULT_AI_CONFIG);
    }
    setIsFetchingConfig(false);
  };

  const fetchPerformanceLogs = async () => {
    setIsFetchingLogs(true);
    try {
      const q = query(collection(db, "model_usage_logs"), orderBy("timestamp", "desc"), limit(300));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as UsageLogDoc));
      setLogs(data);
    } catch (err) {
      console.warn("Could not fetch usage logs:", err);
    }
    setIsFetchingLogs(false);
  };

  const handleSaveAIConfig = async () => {
    setIsSavingConfig(true);
    setConfigSaveSuccess(false);
    try {
      const updated: AIConfig = {
        ...aiConfig,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin'
      };
      await setDoc(doc(db, "settings", "ai_config"), updated);
      setConfigSaveSuccess(true);
      setTimeout(() => setConfigSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("บันทึกการตั้งค่าไม่สำเร็จ: " + err.message);
    }
    setIsSavingConfig(false);
  };

  const handleTestConnection = async () => {
    setIsTestingModel(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiConfig.activeRoute,
          modelId: aiConfig.activeModelId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          latencyMs: data.latencyMs,
          message: `เชื่อมต่อสำเร็จ! ตอบสนองใน ${data.latencyMs} ms`
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "เชื่อมต่อไม่สำเร็จ"
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ"
      });
    }
    setIsTestingModel(false);
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

  // Performance calculations
  const filteredLogs = logs.filter(l => {
    if (timeFilterDays === 0) return true;
    const logDate = new Date(l.timestamp).getTime();
    const threshold = Date.now() - (timeFilterDays * 24 * 60 * 60 * 1000);
    return logDate >= threshold;
  });

  const totalLogs = filteredLogs.length;
  const successfulLogs = filteredLogs.filter(l => l.success);
  const successRate = totalLogs > 0 ? ((successfulLogs.length / totalLogs) * 100).toFixed(1) : "0.0";
  const avgLatency = successfulLogs.length > 0 
    ? (successfulLogs.reduce((acc, l) => acc + (l.latencyMs || 0), 0) / successfulLogs.length / 1000).toFixed(2)
    : "0.0";
  const teacherAccepted = successfulLogs.filter(l => !l.wasOverridden);
  const acceptanceRate = successfulLogs.length > 0 
    ? ((teacherAccepted.length / successfulLogs.length) * 100).toFixed(1) 
    : "0.0";

  // Group by modelId
  const modelStats: Record<string, {
    modelId: string;
    provider: AIProvider;
    total: number;
    success: number;
    avgLatencyMs: number;
    accepted: number;
    fallbackCount: number;
  }> = {};

  filteredLogs.forEach(l => {
    if (!modelStats[l.modelId]) {
      modelStats[l.modelId] = {
        modelId: l.modelId,
        provider: l.provider,
        total: 0,
        success: 0,
        avgLatencyMs: 0,
        accepted: 0,
        fallbackCount: 0
      };
    }
    const stat = modelStats[l.modelId];
    stat.total += 1;
    if (l.success) {
      stat.success += 1;
      stat.avgLatencyMs += l.latencyMs || 0;
      if (!l.wasOverridden) stat.accepted += 1;
    }
    if (l.usedFallback) stat.fallbackCount += 1;
  });

  Object.values(modelStats).forEach(s => {
    if (s.success > 0) {
      s.avgLatencyMs = Math.round(s.avgLatencyMs / s.success);
    }
  });

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
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                <ShieldCheck className="text-red-600" /> Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">ระบบจัดการสิทธิ ผู้ใช้ และตั้งค่าการทำงานของ AI</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200 gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'users' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users size={16} /> ผู้ใช้งาน & โควต้า
            </button>
            <button
              onClick={() => setActiveTab('ai_config')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ai_config' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Cpu size={16} /> ตั้งค่า AI Model & Fallback
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'performance' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 size={16} /> สถิติ & การวัดผล
            </button>
          </div>
        </header>

        {/* TAB 1: USERS & MIGRATION */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Migration Card */}
              <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                <div className="flex items-center gap-3 mb-4 text-blue-600">
                  <Database size={24} />
                  <h2 className="text-lg font-bold text-gray-800">จัดการฐานข้อมูล (Migration)</h2>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  โอนกรรมสิทธิ์เกณฑ์ประเมิน (Rubrics) และ AI Skills แบบเก่าทั้งหมด เพื่อให้กลายเป็นของ Admin (ป้องกันการถูกแก้ไขโดย Teacher)
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
        )}

        {/* TAB 2: AI CONFIG & FALLBACK ROUTING */}
        {activeTab === 'ai_config' && (
          <div className="space-y-6">
            {/* Primary Model Selection Card */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="text-blue-600" /> โมเดลหลักในการตรวจ (Primary Route)
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    เลือกผู้ให้บริการและโมเดล AI ที่ต้องการใช้ตรวจกระดาษคำตอบเป็นตัวเลือกแรก
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingModel}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 transition-colors disabled:opacity-50"
                  >
                    {isTestingModel ? <Loader2 className="animate-spin h-4 w-4 text-blue-600" /> : <Play size={14} className="text-green-600" />}
                    ทดสอบการเชื่อมต่อโมเดลนี้
                  </button>

                  <button
                    onClick={handleSaveAIConfig}
                    disabled={isSavingConfig}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSavingConfig ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={14} />}
                    {configSaveSuccess ? "บันทึกแล้ว!" : "บันทึกการตั้งค่า"}
                  </button>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
                  testResult.success ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {testResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    ผู้ให้บริการ (AI Provider)
                  </label>
                  <select
                    value={aiConfig.activeRoute}
                    onChange={(e) => {
                      const newProvider = e.target.value as AIProvider;
                      const firstModel = AVAILABLE_MODELS[newProvider][0]?.id || '';
                      setAiConfig(prev => ({
                        ...prev,
                        activeRoute: newProvider,
                        activeModelId: firstModel
                      }));
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="gemini">Google Gemini AI (Direct API)</option>
                    <option value="openrouter">OpenRouter (Multi-Model Hub - Free Models)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {aiConfig.activeRoute === 'gemini' 
                      ? 'ใช้ GEMINI_API_KEY ของคุณโดยตรง โควต้าฟรี 500 ครั้ง/วัน'
                      : 'ใช้ OPENROUTER_API_KEY ที่ตั้งค่าไว้ใน Vercel เข้าถึง Qwen, Gemma, Llama ฟรี'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    เลือกโมเดล (Active Model ID)
                  </label>
                  <select
                    value={aiConfig.activeModelId}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, activeModelId: e.target.value }))}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {AVAILABLE_MODELS[aiConfig.activeRoute].map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} (Context: {m.contextLength})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1.5">
                    โมเดลที่เลือกรองรับ Image Vision สำหรับอ่านกระดาษคำตอบลายมือนักเรียน
                  </p>
                </div>
              </div>
            </section>

            {/* Fallback Chain Card */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Zap className="text-amber-500" /> ระบบสำรองอัตโนมัติ (Cascading Fallback Chain)
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    เมื่อโมเดลหลักเกิด Error, ติด Rate Limit หรือ Lineup ถูกถอด ระบบจะสลับไปโมเดลถัดไปทันที
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    checked={aiConfig.fallbackEnabled}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, fallbackEnabled: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-700">เปิดใช้งาน Fallback</span>
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase">
                  ลำดับการ Fallback ตามขั้นตอน (Waterfall Sequence):
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-sm font-medium text-blue-900">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">1</span>
                    <span className="font-bold">Primary Model:</span>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-md uppercase font-bold">{aiConfig.activeRoute}</span>
                    <span className="font-mono text-xs">{aiConfig.activeModelId}</span>
                  </div>

                  {aiConfig.fallbackChain.map((item, idx) => (
                    <div key={item.modelId} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-400 text-white text-xs font-bold shrink-0">
                          {idx + 2}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-tight bg-gray-200 text-gray-700">
                          {item.provider}
                        </span>
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="font-mono text-xs text-gray-500 hidden sm:inline">({item.modelId})</span>
                      </div>
                      <span className="text-xs text-green-700 bg-green-100 font-semibold px-2 py-0.5 rounded-full">
                        Free Tier
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-900">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0">
                      {aiConfig.fallbackChain.length + 2}
                    </span>
                    <span className="font-bold">Emergency Safety Net:</span>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-md uppercase font-bold">gemini</span>
                    <span className="font-mono text-xs">gemini-3.5-flash-lite (Rescue Model)</span>
                  </div>
                </div>
              </div>

              {/* Circuit breaker info callout */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 mb-0.5">ระบบตัดวงจรอัตโนมัติ (Smart Circuit Breaker)</h4>
                  <p className="text-amber-800 leading-relaxed">
                    หากโมเดลฟรีตัวใดบน OpenRouter ส่งผลลัพธ์ล้มเหลวติดต่อกัน 3 ครั้ง (เช่น โดนจำกัดโควต้า หรือถูกถอด Lineup)
                    ระบบจะตัดวงจรและข้ามโมเดลนั้นชั่วคราวเป็นเวลา 15 นาที เพื่อให้การตรวจของครูไม่สะดุดและไม่ต้องเสียเวลารอ Timeout
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: PERFORMANCE TRACKING & BENCHMARKS */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-emerald-600" size={20} />
                <span className="font-bold text-gray-800 text-sm">สถิติประสิทธิภาพการตรวจของ AI</span>
                <span className="text-xs text-gray-500 font-normal">({totalLogs} บันทึกล่าสุด)</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">ช่วงเวลา:</span>
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
                  <button
                    onClick={() => setTimeFilterDays(1)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${timeFilterDays === 1 ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600'}`}
                  >
                    วันนี้
                  </button>
                  <button
                    onClick={() => setTimeFilterDays(7)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${timeFilterDays === 7 ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600'}`}
                  >
                    7 วัน
                  </button>
                  <button
                    onClick={() => setTimeFilterDays(30)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${timeFilterDays === 30 ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600'}`}
                  >
                    30 วัน
                  </button>
                  <button
                    onClick={() => setTimeFilterDays(0)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${timeFilterDays === 0 ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600'}`}
                  >
                    ทั้งหมด
                  </button>
                </div>

                <button
                  onClick={fetchPerformanceLogs}
                  disabled={isFetchingLogs}
                  className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                  title="รีเฟรชสถิติ"
                >
                  <RotateCcw size={16} className={isFetchingLogs ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* 4 Metric Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase">ตรวจทั้งหมด</span>
                  <Zap size={18} className="text-blue-500" />
                </div>
                <div className="text-2xl font-black text-gray-900">{totalLogs.toLocaleString()}</div>
                <p className="text-[11px] text-gray-400 mt-1">จำนวนครั้งที่เรียก AI ประเมิน</p>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase">อัตราตรวจสำเร็จ</span>
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600">{successRate}%</div>
                <p className="text-[11px] text-gray-400 mt-1">ประมวลผลและตอบกลับสมบูรณ์</p>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase">ความเร็วเฉลี่ย</span>
                  <Clock size={18} className="text-amber-500" />
                </div>
                <div className="text-2xl font-black text-amber-600">{avgLatency} <span className="text-sm font-medium">วิ</span></div>
                <p className="text-[11px] text-gray-400 mt-1">เวลาเฉลี่ยต่อกระดาษคำตอบ 1 แผ่น</p>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase">ความแม่นยำ (ครูไม่อีดิท)</span>
                  <TrendingUp size={18} className="text-purple-500" />
                </div>
                <div className="text-2xl font-black text-purple-600">{acceptanceRate}%</div>
                <p className="text-[11px] text-gray-400 mt-1">สัดส่วนที่ครูอนุมัติโดยไม่ต้องแก้มือ</p>
              </div>
            </div>

            {/* Model Comparison Benchmark Table */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                เปรียบเทียบสถิติแยกรายโมเดล (Model Benchmark Table)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="px-4 py-3">ชื่อโมเดล</th>
                      <th className="px-4 py-3">ผู้ให้บริการ</th>
                      <th className="px-4 py-3 text-center">เรียกใช้ (ครั้ง)</th>
                      <th className="px-4 py-3 text-center">ความสำเร็จ</th>
                      <th className="px-4 py-3 text-center">ความเร็วเฉลี่ย</th>
                      <th className="px-4 py-3 text-center">ความแม่นยำ (ครูไม่แก้)</th>
                      <th className="px-4 py-3 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.values(modelStats).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-400 text-xs">
                          ยังไม่มีข้อมูลประวัติการตรวจในฐานข้อมูล หรือเพิ่งเริ่มใช้งานระบบใหม่
                        </td>
                      </tr>
                    ) : (
                      Object.values(modelStats).map(stat => {
                        const mSuccessRate = stat.total > 0 ? ((stat.success / stat.total) * 100).toFixed(1) : "0";
                        const mAcceptanceRate = stat.success > 0 ? ((stat.accepted / stat.success) * 100).toFixed(1) : "0";
                        const isPrimary = stat.modelId === aiConfig.activeModelId;

                        return (
                          <tr key={stat.modelId} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-semibold text-gray-900 flex items-center gap-2">
                              <span className="font-mono text-xs">{stat.modelId}</span>
                              {isPrimary && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-sm">
                                  PRIMARY
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 uppercase text-xs font-bold text-gray-500">
                              {stat.provider}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-gray-800">
                              {stat.total.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${Number(mSuccessRate) >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {mSuccessRate}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">
                              {(stat.avgLatencyMs / 1000).toFixed(2)} วิ
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-purple-700">
                              {mAcceptanceRate}%
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ปกติ
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

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
            <div className={`h-2.5 rounded-full ${user.monthlyUsed >= user.monthlyQuota ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (user.monthlyUsed / user.monthlyQuota) * 100)}%` }}></div>
          </div>
          <span className="text-xs">{user.monthlyUsed} / {user.monthlyQuota}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${user.dailyUsed >= user.rpdLimit ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (user.dailyUsed / user.rpdLimit) * 100)}%` }}></div>
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
