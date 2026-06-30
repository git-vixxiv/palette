import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import firebaseConfig from "../firebase-applet-config.json";

// Check if Firebase keys are unconfigured (empty strings)
export const isFirebaseConfigured = !!(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.length > 0 &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.length > 0
);

let app;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;
let functions: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    // Some envs might not have firestoreDatabaseId, fallback to default
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: "select_account",
    });
    // Cloud Functions (Square billing) live in us-central1.
    functions = getFunctions(app, "us-central1");
  } catch (error) {
    console.error("Firebase startup crash:", error);
  }
}

export { auth, db, googleProvider, functions };

// Required Firestore Error Logger and Parser according to Firebase integration guidelines
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentAuth = auth;
  const currentUser = currentAuth ? currentAuth.currentUser : null;

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo:
        currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  console.error("Firestore Error Detailed Object: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
