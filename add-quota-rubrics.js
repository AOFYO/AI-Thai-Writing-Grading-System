const fs = require('fs');

let path = 'src/app/rubrics/page.tsx';
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

  const extractRubric = async () => {`;

code = code.replace(/const extractRubric = async \(\) => {/, quotaCheckFunc);

code = code.replace(
  /if \(!file\) return;\s*setIsExtracting\(true\);/,
  `if (!file) return;
    if (!(await checkAndUpdateQuota(1))) {
      return;
    }
    setIsExtracting(true);`
);

fs.writeFileSync(path, code);
console.log('Injected Quota checks into rubrics page successfully.');
