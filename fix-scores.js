const fs = require('fs');
const path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace openReviewModal logic
const openReviewModalTarget = `Object.keys(sub.result.evaluation).forEach(k => {
        const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
        const weight = criteriaDef?.weight || 1;
        initialScores[k] = (sub.result.evaluation[k].score || 0) / weight;
        initialComments[k] = sub.result.evaluation[k].teacher_comment || "";
      });`;

const openReviewModalReplacement = `let sumAssumeRaw = 0;
      let sumAssumeWeighted = 0;
      const totalRawScore = sub.result.total_raw_score || 0;
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

      Object.keys(sub.result.evaluation).forEach(k => {
        const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
        const weight = criteriaDef?.weight || 1;
        const rawScore = isWeighted ? ((sub.result.evaluation[k].score || 0) / weight) : (sub.result.evaluation[k].score || 0);
        initialScores[k] = rawScore;
        initialComments[k] = sub.result.evaluation[k].teacher_comment || "";
      });`;

code = code.replace(openReviewModalTarget, openReviewModalReplacement);

// Replace handleReanalyzeText logic
const handleReanalyzeTarget = `Object.keys(data.evaluation).forEach(k => {
          const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
          const weight = criteriaDef?.weight || 1;
          initialScores[k] = (data.evaluation[k].score || 0) / weight;
        });`;

const handleReanalyzeReplacement = `let sumAssumeRaw = 0;
        let sumAssumeWeighted = 0;
        const totalRawScore = data.total_raw_score || 0;
        Object.keys(data.evaluation).forEach(k => {
          const cDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
          const w = cDef?.weight || 1;
          const s = data.evaluation[k].score || 0;
          sumAssumeRaw += (s * w);
          sumAssumeWeighted += s;
        });
        const diffRaw = Math.abs(sumAssumeRaw - totalRawScore);
        const diffWeighted = Math.abs(sumAssumeWeighted - totalRawScore);
        const isWeighted = diffWeighted <= diffRaw;

        Object.keys(data.evaluation).forEach(k => {
          const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
          const weight = criteriaDef?.weight || 1;
          const rawScore = isWeighted ? ((data.evaluation[k].score || 0) / weight) : (data.evaluation[k].score || 0);
          initialScores[k] = rawScore;
        });`;

code = code.replace(handleReanalyzeTarget, handleReanalyzeReplacement);

fs.writeFileSync(path, code);
console.log('Fixed dynamic raw vs weighted detection.');
