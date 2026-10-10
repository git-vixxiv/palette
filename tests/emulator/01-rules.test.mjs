/**
 * Done-criteria 2 + 3: palette's rules for the `palette` database gate on the
 * vixxiv-id token's tier/client claims, owner-only, schema-checked.
 *
 * @firebase/rules-unit-testing loads firestore.rules into the emulator and
 * mints tokens with arbitrary custom claims, exactly as the hub's
 * syncCustomClaims would set them. The ruleset is database-agnostic
 * (match /databases/{database}/documents); firebase.json binds it to the
 * named database `palette` at deploy time.
 */
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, serverTimestamp, updateDoc,
} from "firebase/firestore";

let env;
const COLORS = [
  { hex: "#112233", role: "primary", locked: false },
  { hex: "#445566", role: "secondary", locked: false },
  { hex: "#778899", role: "accent", locked: false },
];
const palette = (uid, extra = {}) => ({
  userId: uid, name: "Test", harmonyMode: "analogous", colors: COLORS,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "vixxiv-id",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid, claims) => env.authenticatedContext(uid, claims).firestore();

async function seed(id, uid) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "palettes", id), { ...palette(uid), createdAt: new Date(), updatedAt: new Date() });
  });
}

test("gold and black members can create, list, read, delete their own palettes", async () => {
  for (const tier of ["gold", "black"]) {
    const db = as(`u-${tier}`, { tier, client: false });
    await assertSucceeds(setDoc(doc(db, "palettes", `p-${tier}`), palette(`u-${tier}`)));
    await assertSucceeds(getDoc(doc(db, "palettes", `p-${tier}`)));
    await assertSucceeds(getDocs(query(collection(db, "palettes"), where("userId", "==", `u-${tier}`))));
    await assertSucceeds(deleteDoc(doc(db, "palettes", `p-${tier}`)));
  }
});

test("a client at tier none has tool access", async () => {
  const db = as("u-client", { tier: "none", client: true });
  await assertSucceeds(setDoc(doc(db, "palettes", "p1"), palette("u-client")));
});

test("platinum, tier none, no claims, bare tools claim, and signed-out are denied everything", async () => {
  await seed("p-own", "u-x");
  for (const claims of [{ tier: "platinum" }, { tier: "none" }, {}, { tier: "none", client: "true" }, { tools: true }]) {
    const db = as("u-x", claims);
    await assertFails(setDoc(doc(db, "palettes", "new"), palette("u-x")));
    await assertFails(getDoc(doc(db, "palettes", "p-own")));
    await assertFails(getDocs(query(collection(db, "palettes"), where("userId", "==", "u-x"))));
    await assertFails(deleteDoc(doc(db, "palettes", "p-own")));
  }
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, "palettes", "p-own")));
});

test("R8: when the tier drops, the member loses access but the data is retained", async () => {
  await seed("p-lapsed", "u-lapse");
  await assertSucceeds(getDoc(doc(as("u-lapse", { tier: "gold" }), "palettes", "p-lapsed")));
  await assertFails(getDoc(doc(as("u-lapse", { tier: "none" }), "palettes", "p-lapsed")));
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), "palettes", "p-lapsed"));
    if (!snap.exists()) throw new Error("palette was deleted on lapse; R8 says retain");
  });
});

test("members cannot touch another member's palettes", async () => {
  await seed("p-other", "u-other");
  const db = as("u-me", { tier: "black" });
  await assertFails(getDoc(doc(db, "palettes", "p-other")));
  await assertFails(deleteDoc(doc(db, "palettes", "p-other")));
  await assertFails(getDocs(query(collection(db, "palettes"), where("userId", "==", "u-other"))));
  await assertFails(setDoc(doc(db, "palettes", "spoof"), palette("u-other")));
});

test("schema: size limits, extra fields, client timestamps, ids", async () => {
  const db = as("u-s", { tier: "gold" });
  await assertFails(setDoc(doc(db, "palettes", "a"), palette("u-s", { colors: COLORS.slice(0, 2) })));
  await assertFails(setDoc(doc(db, "palettes", "b"), palette("u-s", { name: "" })));
  await assertFails(setDoc(doc(db, "palettes", "c"), palette("u-s", { tier: "black" })));
  await assertFails(setDoc(doc(db, "palettes", "d"), palette("u-s", { createdAt: new Date(0) })));
  await assertFails(setDoc(doc(db, "palettes", "bad id!"), palette("u-s")));
  await assertSucceeds(setDoc(doc(db, "palettes", "ok"), palette("u-s")));
  await assertSucceeds(updateDoc(doc(db, "palettes", "ok"), { name: "Renamed", updatedAt: serverTimestamp() }));
});

test("palette's rules grant nothing outside `palettes` (no user table, no hub collections)", async () => {
  const db = as("u-g", { tier: "black", admin: true });
  for (const path of ["users/u-g", "purgeQueue/u-g", "grants/u-g", "anything/x"]) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { a: 1 }));
  }
});
