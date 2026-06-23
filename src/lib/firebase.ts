// Firebase client init. The web API key is NOT a secret for Firebase web apps —
// access is enforced by Firebase Auth + the Firestore security rules
// (firestore.rules restricts reads/writes to an allowlist of AM emails).
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDstQnqEcFX3jL83X1M0qgjLK7l6VbSXhw",
  authDomain: "vendasta-citizen-developers.firebaseapp.com",
  projectId: "vendasta-citizen-developers",
  storageBucket: "vendasta-citizen-developers.firebasestorage.app",
  messagingSenderId: "497738876564",
  appId: "1:497738876564:web:40ec71aaffdc079df01681",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Scoped to the named "am-strategist" database, NOT (default). Must match
// firestore.database in firebase.json so rules and reads target the same DB.
export const db = getFirestore(app, "am-strategist");

// Restrict the Google chooser to Vendasta accounts. This is a UX hint only —
// real enforcement is the Firestore email allowlist + the ALLOWED_DOMAIN check
// in the auth gate.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: "vendasta.com" });

// Separate provider used only for the Gmail MIA-sync flow (MIARecovery page).
// Requesting this scope at initial sign-in would force all users through a Gmail
// consent screen — instead we offer it opt-in on the page that uses it.
export const gmailProvider = new GoogleAuthProvider();
gmailProvider.addScope("https://www.googleapis.com/auth/gmail.readonly");
gmailProvider.setCustomParameters({ hd: "vendasta.com" });

export const ALLOWED_DOMAIN = "vendasta.com";
