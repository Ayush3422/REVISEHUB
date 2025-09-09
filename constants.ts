// Templates for generating contextual code diffs
export const MOCK_CODE_DIFF_TEMPLATES = {
  feat: `diff --git a/src/services/api.js b/src/services/api.js
--- a/src/services/api.js
+++ b/src/services/api.js
@@ -1,5 +1,10 @@
-export const fetchUserData = (userId) => {
-  return fetch(\`https://api.example.com/users/\${userId}\`);
+import { LATEST_API_VERSION } from './config';
+
+/**
+ * Fetches user data from the latest API endpoint.
+ * @param {string} userId - The ID of the user to fetch.
+ * @returns {Promise<Response>}
+ */
+export const fetchUserData = (userId) => {
+  return fetch(\`https://api.example.com/\${LATEST_API_VERSION}/users/\${userId}\`);
 };
 `,
  fix: `diff --git a/src/utils/calculator.js b/src/utils/calculator.js
--- a/src/utils/calculator.js
+++ b/src/utils/calculator.js
@@ -1,5 +1,5 @@
 function sum(a, b) {
-  return a - b; // Intentional bug
+  return a + b; // Corrected logic
 }
 
 export default sum;
`,
  refactor: `diff --git a/src/components/UserProfile.jsx b/src/components/UserProfile.jsx
--- a/src/components/UserProfile.jsx
+++ b/src/components/UserProfile.jsx
@@ -1,12 +1,12 @@
 import React, { useState, useEffect } from 'react';
 
-const UserProfile = ({ userId }) => {
+const useUserData = (userId) => {
   const [user, setUser] = useState(null);
   const [loading, setLoading] = useState(true);
-
   useEffect(() => {
     fetch(\`/api/users/\${userId}\`)
       .then(res => res.json())
       .then(data => {
         setUser(data);
         setLoading(false);
       });
   }, [userId]);
-
+  return { user, loading };
+}
+
+const UserProfile = ({ userId }) => {
+  const { user, loading } = useUserData(userId);
   if (loading) {
     return <div>Loading...</div>;
   }
`,
};
