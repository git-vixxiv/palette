/**
 * Firebase for palette — a client of the vixxiv-id identity hub.
 *
 * ADR-0001 Brief 2: "Point the Firebase client config at vixxiv-id."
 *   - Auth is vixxiv-id's. palette has no sign-in UI of its own; it sends the
 *     user to the hub (see ./hub.ts) and reads the session it finds.
 *   - `hubDb` is vixxiv-id's (default) database. palette only READS one doc
 *     from it, users/{uid}, for the `status` field. The hub owns it.
 *   - `db` is the named Firestore database `palette` inside vixxiv-id. It holds
 *     palette's own data (the `palettes` collection) under palette's own rules
 *     (firestore.rules), so palette never edits the hub's rules.
 *
 * The web config values are vixxiv-id's publishable ones, identical to the
 * hub's hosting/auth/config.js. authDomain stays vixxiv-id.firebaseapp.com
 * until auth.vixxiv.com DNS exists (same as the hub).
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

/** Named Firestore database for palette's own data inside vixxiv-id. */
export const PALETTE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || "palette";

/**
 * Local emulator run: `VITE_USE_EMULATORS=1 npm run dev`. Auth is on 9399
 * (TourBox holds 9099 on Joe's machine), matching the hub's firebase.json.
 */
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === "1";

export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let hubDb: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app, PALETTE_DATABASE_ID);
    hubDb = getFirestore(app);
    if (USE_EMULATORS) {
      connectAuthEmulator(auth, "http://127.0.0.1:9399", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8085);
      connectFirestoreEmulator(hubDb, "127.0.0.1", 8085);
    }
  } catch (error) {
    console.error("Firebase startup failed:", error);
  }
}

export { app, auth, db, hubDb };

// Required Firestore Error Logger and Parser according to Firebase integration guidelines
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth ? auth.currentUser : null;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: { userId: currentUser?.uid || null },
  };
  console.error("Firestore Error Detailed Object: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
