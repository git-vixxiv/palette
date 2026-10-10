/**
 * Done-criterion 5 (trigger path), end to end against the hub contract.
 *
 * The queue entry is written by the HUB'S OWN CODE: this test imports the
 * built runPurge from the vixxiv-id repo (read-only; HUB_DIR, default
 * C:/dev/vixxiv-id) and runs it against the emulator. palette's deployed
 * trigger, palettePurgeOnQueue, running in the Functions emulator, must then
 * delete the user's palettes and write purgeQueue/{uid}.confirmed.palette.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const HUB_DIR = process.env.HUB_DIR || "C:/dev/vixxiv-id";
const HUB_FNS = join(HUB_DIR, "functions");
const HUB_PURGE = join(HUB_FNS, "lib", "purge.js");

let app, hub, data, runPurge;

before(async () => {
  if (!existsSync(HUB_PURGE)) throw new Error(`hub build not found at ${HUB_PURGE}`);
  // Initialise the default app in the HUB's firebase-admin instance, which is
  // what its purge.js uses via getFirestore().
  const hubRequire = createRequire(join(HUB_FNS, "package.json"));
  hubRequire("firebase-admin/app").initializeApp({ projectId: "vixxiv-id" });
  ({ runPurge } = await import(pathToFileURL(HUB_PURGE).href));

  app = initializeApp({ projectId: "vixxiv-id" }, "trigger-test");
  hub = getFirestore(app);
  data = getFirestore(app, "palette");
});
after(async () => { await deleteApp(app); });

const count = async (uid) => (await data.collection("palettes").where("userId", "==", uid).get()).size;

async function seedPalettes(uid, n) {
  for (let i = 0; i < n; i++) {
    await data.collection("palettes").add({ userId: uid, name: `p${i}`, colors: [], harmonyMode: "random" });
  }
}

async function lapsedUser(uid) {
  // The shape the hub's webhook leaves after cancel/non-payment (R8), with the
  // 60-day grace already elapsed.
  await hub.collection("users").doc(uid).set({
    uid, email: `${uid}@example.test`, tier: "none", client: false, status: "canceled",
    graceUntil: Timestamp.fromMillis(Date.now() - 60_000), purgedAt: null,
  });
}

async function waitForConfirmation(uid, notBefore = 0, ms = 45_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const q = (await hub.collection("purgeQueue").doc(uid).get()).data();
    const at = q?.confirmed?.palette;
    if (at && at.toMillis() >= notBefore) return q;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`purgeQueue/${uid}.confirmed.palette never appeared`);
}

test("hub runPurge -> palette trigger deletes the user's palettes and confirms", async () => {
  await lapsedUser("lapsed-1");
  await seedPalettes("lapsed-1", 4);
  await seedPalettes("active-1", 2);

  const result = await runPurge(new Date());
  assert.ok(result.purged.includes("lapsed-1"), "hub queued the user");

  const q = await waitForConfirmation("lapsed-1");
  assert.equal(await count("lapsed-1"), 0, "palettes deleted");
  assert.equal(await count("active-1"), 2, "other users untouched");
  assert.equal(q.reason, "grace-expired", "hub fields preserved");
  assert.deepEqual(q.apps, {}, "hub fields preserved");
  const ms = q.confirmed.palette.toMillis() - q.requestedAt.toMillis();
  assert.ok(ms >= 0 && ms < 7 * 24 * 3600 * 1000, `confirmed ${ms} ms after request (< 7 days)`);
});

test("re-subscribe and lapse again: the hub re-queues and palette purges again", async () => {
  const before = Date.now();
  await lapsedUser("lapsed-1"); // purgedAt back to null, as billing.ts does on re-subscribe
  await seedPalettes("lapsed-1", 2);
  const result = await runPurge(new Date());
  assert.ok(result.purged.includes("lapsed-1"));
  await waitForConfirmation("lapsed-1", before);
  assert.equal(await count("lapsed-1"), 0);
});
