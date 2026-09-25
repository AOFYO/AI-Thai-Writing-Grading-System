const fs = require('fs');

const path = 'src/app/assignments/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Imports
code = code.replace(
  'import { onAuthStateChanged } from "firebase/auth";',
  'import { useUserRole } from "@/hooks/useUserRole";'
);

// State hook and auth logic
code = code.replace(
  /const \[user, setUser\] = useState<any>\(null\);\s*const \[authChecking, setAuthChecking\] = useState\(true\);/,
  'const { user, userData, loading: authChecking } = useUserRole();'
);

// useEffect
code = code.replace(
  /useEffect\(\(\) => {\s*const unsubscribe = onAuthStateChanged\(auth, \(currentUser\) => {[\s\S]*?}\);\s*return \(\) => unsubscribe\(\);\s*}, \[router, id\]\);/,
  `useEffect(() => {
    if (!authChecking) {
      if (!user) router.push("/login");
      else if (userData?.role === "guest") router.push("/pending-approval");
      else {
        fetchAssignment(user.uid);
        fetchSkills();
      }
    }
  }, [user, userData, authChecking, router, id]);`
);

// Return value checking
code = code.replace(
  /if \(authChecking\) {/,
  `if (authChecking || !user) {`
);
code = code.replace(
  /if \(!user\) return null;/,
  ``
);

// AI Skill cloning check to save creatorRole
code = code.replace(
  /createdBy: user.uid,\s*createdAt: new Date\(\).toISOString\(\)/,
  `createdBy: user.uid,
        creatorRole: userData?.role || 'teacher',
        createdAt: new Date().toISOString()`
);

fs.writeFileSync(path, code);
console.log('Updated [id] page');
