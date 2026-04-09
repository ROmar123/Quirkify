import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDZ5wLauYYVERxEfcdOGOZ8GNI2Qvjf9RM",
  authDomain: "gen-lang-client-0358761247.firebaseapp.com",
  projectId: "gen-lang-client-0358761247",
  storageBucket: "gen-lang-client-0358761247.firebasestorage.app",
  messagingSenderId: "24353526972",
  appId: "1:24353526972:web:f80463794cd97f98b9ecb9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
