import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

let cachedApp: FirebaseApp | undefined;
let cachedAuth: Auth | undefined;
let cachedDb: Firestore | undefined;
let cachedFunctions: Functions | undefined;

function initializeFirebase() {
  if (typeof window === 'undefined') {
    // Return null values for server-side rendering
    return {
      app: undefined as unknown as FirebaseApp,
      auth: undefined as unknown as Auth,
      db: undefined as unknown as Firestore,
      functions: undefined as unknown as Functions,
    };
  }

  if (cachedApp) {
    return {
      app: cachedApp,
      auth: cachedAuth!,
      db: cachedDb!,
      functions: cachedFunctions!,
    };
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  cachedApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  cachedAuth = getAuth(cachedApp);
  cachedDb = getFirestore(cachedApp);
  cachedFunctions = getFunctions(cachedApp);

  return {
    app: cachedApp,
    auth: cachedAuth,
    db: cachedDb,
    functions: cachedFunctions,
  };
}

const services = initializeFirebase();

export const app = services.app;
export const auth = services.auth;
export const db = services.db;
export const functions = services.functions;

export default app;
