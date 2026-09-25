const fs = require('fs');

let path = 'src/app/rubrics/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /<Trash2 size={14} \/>\r?\n\s*<\/button>/g,
  `<Trash2 size={14} />\n                  </button>\n                  )}`
);

fs.writeFileSync(path, code);
console.log('Fixed unmatched brace');
