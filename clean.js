const fs = require('fs');
let code = fs.readFileSync('src/app/assignments/[id]/page.tsx', 'utf8');
code = code.replace(/\\n/g, ''); // Remove literal \n strings if they exist
fs.writeFileSync('src/app/assignments/[id]/page.tsx', code);
