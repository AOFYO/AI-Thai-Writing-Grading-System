const fs = require('fs');
const path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add Camera import
code = code.replace(
  /import \{ Loader2, ArrowLeft, UploadCloud, Play, CheckCircle, AlertTriangle, Download, X, Save, Sparkles, BrainCircuit, FileText, RefreshCw, ZoomIn \} from "lucide-react";/g,
  `import { Loader2, ArrowLeft, UploadCloud, Play, CheckCircle, AlertTriangle, Download, X, Save, Sparkles, BrainCircuit, FileText, RefreshCw, ZoomIn, Camera } from "lucide-react";`
);

// 2. Add state
const stateTarget = `const [isDragging, setIsDragging] = useState(false);`;
const stateReplacement = `const [isDragging, setIsDragging] = useState(false);
  const [autoNextNo, setAutoNextNo] = useState<number>(1);`;
code = code.replace(stateTarget, stateReplacement);

// 3. Update handleFiles
const handleFilesTarget = `const handleFiles = (files: File[]) => {
    const newPending = files.map(f => {
      const match = f.name.match(/^(\\d+)/);
      const studentNo = match ? match[1] : "";
      return {
        id: Math.random().toString(36).substring(7),
        file: f,
        preview: URL.createObjectURL(f),
        studentNo,
        status: "pending" as const
      };
    });
    setPendingFiles(prev => [...prev, ...newPending]);
  };`;
const handleFilesReplacement = `const handleFiles = (files: File[]) => {
    let currentAuto = autoNextNo;
    const newPending = files.map(f => {
      let studentNo = "";
      const match = f.name.match(/^(\\d+)/);
      if (match) {
        studentNo = match[1];
      } else {
        studentNo = currentAuto.toString();
        currentAuto++;
      }
      return {
        id: Math.random().toString(36).substring(7),
        file: f,
        preview: URL.createObjectURL(f),
        studentNo,
        status: "pending" as const
      };
    });
    setAutoNextNo(currentAuto);
    setPendingFiles(prev => [...newPending, ...prev]);
  };`;
code = code.replace(handleFilesTarget, handleFilesReplacement);

// 4. Update Dropzone UI
const dropzoneTarget = `<section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UploadCloud size={20} className="text-blue-600"/> อัปโหลดกระดาษคำตอบ (Batch Upload)
          </h2>
          
          <div 
            className={\`border-2 border-dashed rounded-xl p-8 text-center transition-colors relative \${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}\`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <input type="file" multiple accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={onFileSelect} />
            <UploadCloud className={\`mx-auto h-10 w-10 mb-3 \${isDragging ? 'text-blue-500' : 'text-gray-400'}\`} />
            <p className="text-gray-900 font-medium text-lg">ลากไฟล์รูปภาพมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="text-gray-500 text-sm mt-1">ตั้งชื่อไฟล์เป็น "เลขที่.jpg" (เช่น 1.jpg) ระบบจะจับคู่ให้อัตโนมัติ</p>
          </div>`;

const dropzoneReplacement = `<section className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 mb-4 items-start sm:items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UploadCloud size={20} className="text-blue-600"/> อัปโหลด / ถ่ายรูปกระดาษคำตอบ
            </h2>
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm shadow-sm w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-semibold whitespace-nowrap">รันเลขที่อัตโนมัติ เริ่มจาก:</span>
              <input 
                type="number" 
                min={1} 
                className="w-16 px-2 py-1 text-center font-bold text-blue-900 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                value={autoNextNo} 
                onChange={e => setAutoNextNo(Number(e.target.value) || 1)} 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
            {/* Standard Dropzone */}
            <div 
              className={\`border-2 border-dashed rounded-xl p-4 md:p-8 text-center transition-colors relative flex flex-col items-center justify-center min-h-[100px] \${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}\`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input type="file" multiple accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={onFileSelect} />
              <UploadCloud className={\`h-6 w-6 md:h-8 md:w-8 mb-2 \${isDragging ? 'text-blue-500' : 'text-gray-400'}\`} />
              <p className="text-gray-900 font-medium text-sm md:text-base">เลือกไฟล์ หรือลากมาวาง</p>
              <p className="text-gray-500 text-xs mt-1 hidden md:block">ตั้งชื่อ "เลขที่.jpg" จะจับคู่ให้อัตโนมัติ</p>
            </div>
            
            {/* Mobile Camera Direct Button */}
            <div className="border-2 border-blue-200 rounded-xl p-4 md:p-8 text-center transition-colors relative flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 min-h-[100px] shadow-sm">
              <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={onFileSelect} />
              <Camera className="h-6 w-6 md:h-8 md:w-8 mb-2 text-blue-600" />
              <p className="text-blue-900 font-bold text-sm md:text-base">ถ่ายรูปจากกล้องมือถือ</p>
              <p className="text-blue-600/70 text-xs mt-1">ระบบจะรันเลขที่ให้เองทีละใบ</p>
            </div>
          </div>`;
          
code = code.replace(dropzoneTarget, dropzoneReplacement);

fs.writeFileSync(path, code);
console.log('Applied mobile-friendly upload features.');
