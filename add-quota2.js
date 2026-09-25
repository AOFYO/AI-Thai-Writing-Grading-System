const fs = require('fs');

let path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /const extractSkillFromCorrections = async \(\) => \{\s*if \(!selectedSub\) return;\s*setIsExtractingSkill\(true\);/,
  `const extractSkillFromCorrections = async () => {
    if (!selectedSub) return;
    // Phase 4: Quota Check for Extract Skill
    if (!(await checkAndUpdateQuota(1))) {
      return;
    }
    setIsExtractingSkill(true);`
);

fs.writeFileSync(path, code);
console.log('Injected Quota checks into extractSkill successfully.');
