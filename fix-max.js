const fs = require('fs');

let path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /const maxAssignmentScore = assignment\?\.rubricData\?\.criteria\?\.reduce\(\(sum: any, c: any\) => sum \+ \(\(c\.max_score \|\| 5\) \* \(c\.weight \|\| 1\)\), 0\) \|\| 0;/g,
  `const maxAssignmentScore = assignment?.rubricData?.criteria?.reduce((sum: any, c: any) => sum + (Number(c.max_score) || 5), 0) || 0;`
);

fs.writeFileSync(path, code);
console.log('Fixed max score logic.');
