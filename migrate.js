const fs = require('fs');
let code = fs.readFileSync('src/app/rubrics/page.tsx', 'utf8');

// Replace imports
code = code.replace(
  'import { onAuthStateChanged } from "firebase/auth";',
  'import { useUserRole } from "@/hooks/useUserRole";\nimport { Copy } from "lucide-react";'
);

// Replace state and auth check
code = code.replace(
  /const \[user, setUser\] = useState<any>\(null\);\s*const \[authChecking, setAuthChecking\] = useState\(true\);/,
  'const { user, userData, loading: authChecking } = useUserRole();'
);

// Replace useEffect for auth
code = code.replace(
  /useEffect\(\(\) => {[\s\S]*?}, \[router\]\);/,
  `useEffect(() => {
    if (!authChecking) {
      if (!user) router.push("/login");
      else if (userData?.role === "guest") router.push("/pending-approval");
      else fetchRubrics();
    }
  }, [user, userData, authChecking, router]);`
);

// Replace fetchRubrics
code = code.replace(
  /const fetchRubrics = async \(uid: string\) => {[\s\S]*?};/,
  `const fetchRubrics = async () => {
    const snap = await getDocs(query(collection(db, "rubrics")));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a: any, b: any) => {
      const aIsAdmin = !a.createdBy || a.creatorRole === 'admin';
      const bIsAdmin = !b.createdBy || b.creatorRole === 'admin';
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return 0;
    });
    setMyRubrics(data);
  };`
);

// Update save payload with role
code = code.replace(
  /createdBy: user.uid,\s*createdAt: new Date\(\).toISOString\(\),/,
  `createdBy: user.uid,
          creatorRole: userData?.role || 'teacher',
          createdAt: new Date().toISOString(),`
);

// Add clone function and auth checks
code = code.replace(
  /const deleteRubric = async \(id: string\) => {/,
  `const cloneRubric = (r: any) => {
    const cloned = { ...r };
    const mappedCriteria = cloned.criteria?.map((c: any) => ({
        ...c,
        raw_score: c.raw_score || c.max_score || 5,
        weight: c.weight || 1,
        max_score: c.max_score || 5
    })) || [];
    setRubric({ title: r.title + " (สำเนา)", description: r.description, criteria: mappedCriteria });
    setSelectedRubricId(null);
    setFile(null);
    setPreviewUrl(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteRubric = async (id: string, createdBy: string) => {
    const canDelete = createdBy === user.uid || userData?.role === 'admin' || (!createdBy && userData?.role === 'admin');
    if (!canDelete) return alert("คุณไม่มีสิทธิลบเกณฑ์นี้");
  `
);

// Fix deleteDoc call signature inside the HTML
code = code.replace(
  /<button onClick={\(\) => deleteRubric\(r\.id\)}/g,
  `<button onClick={() => deleteRubric(r.id, r.createdBy)}`
);

// Auth check for loadRubricForEdit
code = code.replace(
  /const loadRubricForEdit = \(r: any\) => {/,
  `const loadRubricForEdit = (r: any) => {
    const canEdit = r.createdBy === user?.uid || userData?.role === 'admin' || (!r.createdBy && userData?.role === 'admin');
    if (!canEdit) {
      alert("คุณไม่มีสิทธิแก้ไขเกณฑ์นี้ (กรุณากด 'ทำสำเนา' แทน)");
      return;
    }
  `
);

// Extract the original buttons block first
const buttonsRegex = /<button onClick={\(\) => loadRubricForEdit\(r\)}[\s\S]*?<\/button>\s*<button onClick={\(\) => deleteRubric\(r\.id, r\.createdBy\)}[\s\S]*?<\/button>/;

code = code.replace(
  buttonsRegex,
  `{ (r.createdBy === user?.uid || userData?.role === 'admin' || (!r.createdBy && userData?.role === 'admin')) ? (
    <>
      <button onClick={() => loadRubricForEdit(r)} className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium px-3 py-1.5 hover:bg-purple-50 rounded-lg transition-colors">
        <Edit size={14} /> แก้ไข
      </button>
      <button onClick={() => deleteRubric(r.id, r.createdBy)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 size={14} /> ลบ
      </button>
    </>
  ) : (
    <button onClick={() => cloneRubric(r)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100">
      <Copy size={14} /> ทำสำเนา
    </button>
  )}`
);

// Also update the Title rendering to show Admin tag
code = code.replace(
  /<h3 className="font-bold text-gray-800 mb-2">{r\.title}<\/h3>/,
  `<div className="flex justify-between items-start mb-2">
     <h3 className="font-bold text-gray-800">{r.title}</h3>
     {(!r.createdBy || r.creatorRole === 'admin') && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold whitespace-nowrap">Admin Preset</span>}
   </div>`
);


fs.writeFileSync('src/app/rubrics/page.tsx', code);
console.log('Done!');
