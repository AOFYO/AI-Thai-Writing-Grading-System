const fs = require('fs');
const path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add state for showBreakdown
const stateTarget = `const [autoNextNo, setAutoNextNo] = useState<number>(1);`;
const stateReplacement = `const [autoNextNo, setAutoNextNo] = useState<number>(1);
  const [showBreakdown, setShowBreakdown] = useState(false);`;
code = code.replace(stateTarget, stateReplacement);

// 2. Add getScoreBreakdown function after handleScoreChange
const insertTarget = `  const calculateNewTotal = () => {`;
const insertReplacement = `  const getScoreBreakdown = useCallback((sub: any) => {
    if (!sub.result?.evaluation) return "";
    const totalRawScore = sub.result.total_raw_score || 0;
    
    let sumAssumeRaw = 0;
    let sumAssumeWeighted = 0;
    Object.keys(sub.result.evaluation).forEach(k => {
      const cDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
      const w = cDef?.weight || 1;
      const s = sub.result.evaluation[k].score || 0;
      sumAssumeRaw += (s * w);
      sumAssumeWeighted += s;
    });
    
    const diffRaw = Math.abs(sumAssumeRaw - totalRawScore);
    const diffWeighted = Math.abs(sumAssumeWeighted - totalRawScore);
    const isWeighted = diffWeighted <= diffRaw;

    const sortedKeys = Object.keys(sub.result.evaluation).sort(([keyA], [keyB]) => {
      return (parseInt(keyA.replace(/\\D/g, '')) || 0) - (parseInt(keyB.replace(/\\D/g, '')) || 0);
    });

    const scores = sortedKeys.map(k => {
      const cDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
      const w = cDef?.weight || 1;
      const s = sub.result.evaluation[k].score || 0;
      return isWeighted ? s : (s * w);
    });

    return \`(\${scores.join('+')})\`;
  }, [assignment]);

  const calculateNewTotal = () => {`;
code = code.replace(insertTarget, insertReplacement);

// 3. Add toggle UI and change grid classes
const rosterTarget = `<div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">สถานะการส่งงาน (Roster)</h2>
              <p className="text-sm text-gray-600">คลิกที่หมายเลขเพื่อดูผลตรวจและแก้ไขคะแนน</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div> ตรวจแล้ว (มั่นใจสูง)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div> ตรวจแล้ว (ควรตรวจสอบซ้ำ)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div> แก้ไขคะแนนแล้วด้วยมือ</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></div> ยังไม่ส่งงาน</div>
            </div>
          </div>
          
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-2 md:gap-3">`;

const rosterReplacement = `<div className="flex flex-col xl:flex-row xl:items-start justify-between mb-6 gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">สถานะการส่งงาน (Roster)</h2>
              <p className="text-sm text-gray-600">คลิกที่หมายเลขเพื่อดูผลตรวจและแก้ไขคะแนน</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <label className="flex items-center gap-2 bg-indigo-50 text-indigo-800 border border-indigo-200 px-4 py-2 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors shadow-sm select-none">
                <input 
                  type="checkbox" 
                  checked={showBreakdown}
                  onChange={(e) => setShowBreakdown(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-sm font-bold">แสดงคะแนนย่อยรายข้อ (Breakdown)</span>
              </label>

              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div> ตรวจแล้ว (มั่นใจสูง)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div> ตรวจแล้ว (ควรตรวจสอบซ้ำ)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div> แก้ไขคะแนนแล้วด้วยมือ</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></div> ยังไม่ส่งงาน</div>
              </div>
            </div>
          </div>
          
          <div className={\`grid gap-2 md:gap-3 \${showBreakdown ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8' : 'grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15'}\`}>`;

code = code.replace(rosterTarget, rosterReplacement);

// 4. Update the button rendering
const buttonTarget = `<button 
                    key={num} 
                    onClick={() => openReviewModal(sub)}
                    className={\`aspect-square flex flex-col items-center justify-center rounded-xl border-2 shadow-sm transition-transform hover:scale-105 \${getStatusColor(sub)}\`}
                  >
                    <span className="font-bold text-lg leading-tight">{num}</span>
                    {sub.result && (
                      <span className={\`text-[11px] font-medium leading-none mt-1 px-1.5 py-0.5 rounded-full \${sub.isOverridden ? 'bg-blue-200 text-blue-800' : 'bg-white/50 text-gray-700'}\`}>
                        {sub.isOverridden ? sub.overrideScore : (sub.result.total_raw_score || 0)}/{maxAssignmentScore}
                      </span>
                    )}
                  </button>`;

const buttonReplacement = `<button 
                    key={num} 
                    onClick={() => openReviewModal(sub)}
                    className={\`\${showBreakdown ? 'min-h-[5rem] py-2 px-1' : 'aspect-square'} w-full flex flex-col items-center justify-center rounded-xl border-2 shadow-sm transition-transform hover:scale-105 \${getStatusColor(sub)}\`}
                  >
                    <span className="font-bold text-lg leading-tight">{num}</span>
                    {sub.result && (
                      <span className={\`text-[11px] font-medium leading-none mt-1 px-1.5 py-0.5 rounded-full \${sub.isOverridden ? 'bg-blue-200 text-blue-800' : 'bg-white/50 text-gray-700'}\`}>
                        {sub.isOverridden ? sub.overrideScore : (sub.result.total_raw_score || 0)}/{maxAssignmentScore}
                      </span>
                    )}
                    {showBreakdown && sub.result?.evaluation && (
                      <span className="text-[11px] font-semibold text-black/60 mt-1.5 tracking-tighter text-center leading-none">
                        {getScoreBreakdown(sub)}
                      </span>
                    )}
                  </button>`;

code = code.replace(buttonTarget, buttonReplacement);

fs.writeFileSync(path, code);
console.log('Applied score breakdown feature.');
