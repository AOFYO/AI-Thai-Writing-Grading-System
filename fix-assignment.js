const fs = require('fs');

let path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Remove all instances of maxAssignmentScore declaration
code = code.replace(/const maxAssignmentScore = assignment\?\.rubricData.*?\|\| 0;/g, '');
code = code.replace(/\\n  const maxAssignmentScore = assignment\?\.rubricData.*?\|\| 0;/g, '');

// Re-insert it after useState<any[]>([]);
code = code.replace(
  /const \[submissions, setSubmissions\] = useState<any\[\]>\(\[\]\);/,
  `const [submissions, setSubmissions] = useState<any[]>([]);\n  const maxAssignmentScore = assignment?.rubricData?.criteria?.reduce((sum: any, c: any) => sum + ((c.max_score || 5) * (c.weight || 1)), 0) || 0;`
);

fs.writeFileSync(path, code);
console.log('Fixed maxAssignmentScore');
