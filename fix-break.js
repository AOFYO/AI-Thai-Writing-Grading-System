const fs = require('fs');
const path = 'src/app/assignments/[id]/page.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  /updatePendingFile\(item\.id, \{ status: "error", errorMsg: err\.message \}\);\s*break;/g,
  `updatePendingFile(item.id, { status: "error", errorMsg: err.message });
        await new Promise(r => setTimeout(r, 3000));`
);

fs.writeFileSync(path, c);
console.log('Fixed break logic');
