const fs = require('fs');

// --- Fix src/app/assignments/page.tsx ---
let path1 = 'src/app/assignments/page.tsx';
let code1 = fs.readFileSync(path1, 'utf8');

// Replace the buggy useEffect body
code1 = code1.replace(
  /fetchRubrics\(\);\s*fetchAssignments\(user\.uid\);/,
  `fetchData(user.uid);`
);

// We should also change how fetchData fetches rubrics. Teachers need to see ALL rubrics to select from, not just their own!
code1 = code1.replace(
  /const rubricsSnap = await getDocs\(query\(collection\(db, "rubrics"\), where\("createdBy", "==", uid\)\)\);/,
  `const rubricsSnap = await getDocs(query(collection(db, "rubrics")));`
);

fs.writeFileSync(path1, code1);
console.log('Fixed page.tsx');

// --- Fix src/app/assignments/[id]/page.tsx ---
let path2 = 'src/app/assignments/[id]/page.tsx';
let code2 = fs.readFileSync(path2, 'utf8');

const buggyAuthString = `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else {
        setUser(currentUser);
        if (assignmentId) {
          fetchAssignmentData(currentUser.uid, assignmentId);
          fetchSkills();
        }
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [router, assignmentId]);`;

const correctAuthString = `useEffect(() => {
    if (!authChecking) {
      if (!user) router.push("/login");
      else if (userData?.role === "guest") router.push("/pending-approval");
      else if (assignmentId) {
        fetchAssignmentData(user.uid, assignmentId);
        fetchSkills();
      }
    }
  }, [user, userData, authChecking, router, assignmentId]);`;

code2 = code2.replace(buggyAuthString, correctAuthString);

// Also remove `import { onAuthStateChanged } from "firebase/auth";` if it's there
code2 = code2.replace('import { onAuthStateChanged } from "firebase/auth";', '');

fs.writeFileSync(path2, code2);
console.log('Fixed [id]/page.tsx');

// --- Fix src/app/rubrics/page.tsx ---
// (131,26): Expected 0 arguments, but got 1.
// (172,20): Expected 0 arguments, but got 1.
let path3 = 'src/app/rubrics/page.tsx';
let code3 = fs.readFileSync(path3, 'utf8');

code3 = code3.replace(/fetchRubrics\(user\.uid\)/g, 'fetchRubrics()');

fs.writeFileSync(path3, code3);
console.log('Fixed rubrics/page.tsx');

