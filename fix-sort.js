const fs = require('fs');
let code = fs.readFileSync('src/app/assignments/[id]/page.tsx', 'utf8');

const targetStr = `{Object.entries(selectedSub.result?.evaluation || {}).map(([key, data]: [string, any]) => {`;
const replacement = `{Object.entries(selectedSub.result?.evaluation || {})
                      .sort(([keyA], [keyB]) => {
                        const numA = parseInt(keyA.replace(/\\D/g, '')) || 0;
                        const numB = parseInt(keyB.replace(/\\D/g, '')) || 0;
                        return numA - numB;
                      })
                      .map(([key, data]: [string, any]) => {`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/app/assignments/[id]/page.tsx', code);
console.log("Replaced successfully");
