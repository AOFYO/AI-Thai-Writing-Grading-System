const fs = require('fs');
let c = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

c = c.replace(/style=\{\{ width: \\\`\\\$\{(.*?)\}%\\\` \}\}/g, 'style={{ width: `${$1}%` }}');

fs.writeFileSync('src/app/admin/page.tsx', c);
console.log('Fixed syntax!');
