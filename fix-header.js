const fs = require('fs');
let code = fs.readFileSync('src/app/assignments/[id]/page.tsx', 'utf8');

const targetStr = `{userData && (
      <div className="hidden md:flex flex-col gap-1 text-right text-xs bg-gray-50 p-2 rounded border border-gray-200">`;

const replacement = `<div className="flex items-center gap-4">
          {userData && (
            <div className="hidden md:flex flex-col gap-1 text-right text-xs bg-gray-50 p-2 rounded border border-gray-200">`;

code = code.replace(targetStr, replacement);

const targetStr2 = `<Download size={16} /> ส่งออกคะแนน (CSV)
          </button>
        </header>`;

const replacement2 = `<Download size={16} /> ส่งออกคะแนน (CSV)
          </button>
          </div>
        </header>`;

code = code.replace(targetStr2, replacement2);

fs.writeFileSync('src/app/assignments/[id]/page.tsx', code);
console.log('Fixed layout');
