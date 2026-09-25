const fs = require('fs');

const path = 'src/app/assignments/page.tsx';
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
  /useEffect\(\(\) => {[\s\S]*?}, \[router\]\);/,
  `useEffect(() => {
    if (!authChecking) {
      if (!user) router.push("/login");
      else if (userData?.role === "guest") router.push("/pending-approval");
      else {
        fetchRubrics();
        fetchAssignments(user.uid);
      }
    }
  }, [user, userData, authChecking, router]);`
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

fs.writeFileSync(path, code);
console.log('Updated assignments page');
