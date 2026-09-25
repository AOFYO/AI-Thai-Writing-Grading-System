const fs = require('fs');
let code = fs.readFileSync('src/app/assignments/[id]/page.tsx', 'utf8');

// 1. openReviewModal
code = code.replace(
  /Object\.keys\(sub\.result\.evaluation\)\.forEach\(k => \{\s*initialScores\[k\] = sub\.result\.evaluation\[k\]\.score \|\| 0;\s*initialComments\[k\] = sub\.result\.evaluation\[k\]\.teacher_comment \|\| "";\s*\}\);/g,
  `Object.keys(sub.result.evaluation).forEach(k => {
        const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
        const weight = criteriaDef?.weight || 1;
        initialScores[k] = (sub.result.evaluation[k].score || 0) / weight;
        initialComments[k] = sub.result.evaluation[k].teacher_comment || "";
      });`
);

// 2. handleSaveOverride
code = code.replace(
  /Object\.keys\(editedScores\)\.forEach\(k => \{\s*if \(updatedResult\.evaluation\[k\]\) \{\s*updatedResult\.evaluation\[k\]\.score = editedScores\[k\];\s*updatedResult\.evaluation\[k\]\.teacher_comment = teacherComments\[k\] \|\| "";\s*\}\s*\}\);/g,
  `Object.keys(editedScores).forEach(k => {
          if (updatedResult.evaluation[k]) {
            const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
            const weight = criteriaDef?.weight || 1;
            updatedResult.evaluation[k].score = editedScores[k] * weight;
            updatedResult.evaluation[k].teacher_comment = teacherComments[k] || "";
          }
        });`
);

// 3. handleReanalyzeText
code = code.replace(
  /Object\.keys\(data\.evaluation\)\.forEach\(k => \{\s*initialScores\[k\] = data\.evaluation\[k\]\.score \|\| 0;\s*\}\);/g,
  `Object.keys(data.evaluation).forEach(k => {
          const criteriaDef = assignment?.rubricData?.criteria?.find((c:any) => c.id === k);
          const weight = criteriaDef?.weight || 1;
          initialScores[k] = (data.evaluation[k].score || 0) / weight;
        });`
);

// 4. Modal Render UI
code = code.replace(
  /const currentRaw = editedScores\[key\] \?\? data\.score \?\? 0;/g,
  `const currentRaw = editedScores[key] ?? ((data.score || 0) / weight) ?? 0;`
);

fs.writeFileSync('src/app/assignments/[id]/page.tsx', code);
console.log('Fixed score weighting logic!');
