const fs = require('fs');

let path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const quotaCheckFunc = `
  const checkAndUpdateQuota = async (count: number) => {
    if (!userData || !user) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    let currentDaily = userData.lastRequestDate === today ? (userData.dailyUsed || 0) : 0;
    let currentMonthly = userData.lastRequestMonth === thisMonth ? (userData.monthlyUsed || 0) : 0;

    if (currentDaily + count > userData.rpdLimit) {
      alert(\`โควต้ารายวันเต็มแล้ว! คุณใช้งานครบ \${userData.rpdLimit} สแกนในวันนี้ กรุณาลองใหม่พรุ่งนี้\`);
      return false;
    }
    if (currentMonthly + count > userData.monthlyQuota) {
      alert(\`โควต้ารายเดือนเต็มแล้ว! คุณใช้งานครบ \${userData.monthlyQuota} สแกนในเดือนนี้\`);
      return false;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        dailyUsed: currentDaily + count,
        monthlyUsed: currentMonthly + count,
        lastRequestDate: today,
        lastRequestMonth: thisMonth
      });
      return true;
    } catch (err) {
      console.error("Error updating quota:", err);
      alert("ไม่สามารถอัปเดตโควต้าได้ โปรดลองอีกครั้ง");
      return false;
    }
  };

  const startBatchProcess = async () => {`;

// Insert the quota check function right before startBatchProcess
code = code.replace(/const startBatchProcess = async \(\) => {/, quotaCheckFunc);

// Insert quota check inside startBatchProcess
code = code.replace(
  /const filesToProcess = pendingFiles\.filter\(p => p\.status === "pending" \|\| p\.status === "error"\);\s*if \(filesToProcess\.length === 0\) return;\s*const missingNos = filesToProcess\.filter\(p => !p\.studentNo\.trim\(\)\);\s*if \(missingNos\.length > 0\) \{\s*alert\("กรุณาระบุเลขที่นักเรียนให้ครบทุกไฟล์ก่อนเริ่มตรวจ"\);\s*return;\s*\}/,
  `const filesToProcess = pendingFiles.filter(p => p.status === "pending" || p.status === "error");
    if (filesToProcess.length === 0) return;
    
    const missingNos = filesToProcess.filter(p => !p.studentNo.trim());
    if (missingNos.length > 0) {
      alert("กรุณาระบุเลขที่นักเรียนให้ครบทุกไฟล์ก่อนเริ่มตรวจ");
      return;
    }

    // Phase 4: Quota Check
    if (!(await checkAndUpdateQuota(filesToProcess.length))) {
      return;
    }`
);

// Insert quota check inside handleReanalyze
code = code.replace(
  /const handleReanalyze = async \(\) => \{\s*setIsReanalyzing\(true\);/,
  `const handleReanalyze = async () => {
    // Phase 4: Quota Check for Re-analyze
    if (!(await checkAndUpdateQuota(1))) {
      return;
    }
    setIsReanalyzing(true);`
);

fs.writeFileSync(path, code);
console.log('Injected Quota checks successfully.');
