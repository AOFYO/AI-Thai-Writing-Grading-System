const fs = require('fs');
const path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `const sortedKeys = Object.keys(sub.result.evaluation).sort(([keyA], [keyB]) => {`;
const replacement = `const sortedKeys = Object.keys(sub.result.evaluation).sort((keyA, keyB) => {`;

code = code.replace(target, replacement);

fs.writeFileSync(path, code);
console.log('Fixed sorting logic for Object.keys');
