const fs = require('fs');

let path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Calculate quota variables near top of component
code = code.replace(
  /const \{ user, userData, loading: authChecking \} = useUserRole\(\);/,
  `const { user, userData, loading: authChecking } = useUserRole();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const currentDaily = userData?.lastRequestDate === today ? (userData.dailyUsed || 0) : 0;
  const currentMonthly = userData?.lastRequestMonth === thisMonth ? (userData.monthlyUsed || 0) : 0;
  const maxAssignmentScore = assignment?.rubricData?.criteria?.reduce((sum: any, c: any) => sum + ((c.max_score || 5) * (c.weight || 1)), 0) || 0;`
);

// 2. Add Quota Display in Header
code = code.replace(
  /<button onClick=\{exportCSV\} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 font-medium text-sm transition-colors shadow-sm">/,
  `{userData && (
      <div className="hidden md:flex flex-col gap-1 text-right text-xs bg-gray-50 p-2 rounded border border-gray-200">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 font-medium">โควต้าวันนี้:</span>
          <span className={currentDaily >= userData.rpdLimit ? "text-red-600 font-bold" : "text-gray-800 font-bold"}>
            {currentDaily} / {userData.rpdLimit}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 font-medium">รอบบิลเดือนนี้:</span>
          <span className={currentMonthly >= userData.monthlyQuota ? "text-red-600 font-bold" : "text-gray-800 font-bold"}>
            {currentMonthly} / {userData.monthlyQuota}
          </span>
        </div>
      </div>
    )}
    <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 font-medium text-sm transition-colors shadow-sm">`
);

// 3. Update Roster Button Display
code = code.replace(
  /className=\{`aspect-square flex items-center justify-center rounded-xl border-2 font-bold text-lg shadow-sm transition-transform hover:scale-105 \$\{getStatusColor\(sub\)\}`\}\s*>\s*\{num\}\{sub\.isOverridden \? <span className="text-blue-500 ml-0\.5 text-sm">\*<\/span> : ''\}\s*<\/button>/,
  `className={\`aspect-square flex flex-col items-center justify-center rounded-xl border-2 shadow-sm transition-transform hover:scale-105 \${getStatusColor(sub)}\`}
                  >
                    <span className="font-bold text-lg leading-tight">{num}</span>
                    {sub.result && (
                      <span className={\`text-[11px] font-medium leading-none mt-1 px-1.5 py-0.5 rounded-full \${sub.isOverridden ? 'bg-blue-200 text-blue-800' : 'bg-white/50 text-gray-700'}\`}>
                        {sub.isOverridden ? sub.overrideScore : (sub.result.total_raw_score || 0)}/{maxAssignmentScore}
                      </span>
                    )}
                  </button>`
);

fs.writeFileSync(path, code);
console.log('Applied updates successfully.');
