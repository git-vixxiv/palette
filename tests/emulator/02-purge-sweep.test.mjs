/**
 * Done-criterion 5 (sweep path): palette's backstop sweep deletes queued users'
 * palettes from the `palette` database and writes confirmed.palette, leaving
 * everyone else's data and every other queue field alone.
 *
 * Runs against the Firestore emulator only (no Functions emulator), so the
 * trigger cannot race the sweep.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { sweepPurgeQueue, purgeQueuedUser } from "../../functions/lib/purge.js";

// Use the Functions package's own firebase-admin, as the deployed code does,
// so FieldValue sentinels and Firestore instances come from one copy.
const fnRequire = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = fnRequire("firebase-admin/app");
const { getFirestore, Timestamp } = fnRequire("firebase-admin/firestore");

let app, hub, data;
before(() => {
  app = initializeApp({ projectId: "vixxiv-id" }, "sweep-test");
  hub = getFirestore(app);
  data = getFirestore(app, "palette");
});
after(async () => { await deleteApp(app); });

async function seedPalettes(uid, n) {
  let batch = data.batch();
  for (let i = 0; i < n; i++) {
    batch.set(data.collection("palettes").doc(`${uid}-${i}`), { userId: uid, name: `p${i}`, colors: [], harmonyMode: "random" });
    if (i % 400 === 399) { await batch.commit(); batch = data.batch(); }
  }
  await batch.commit();
}
const count = async (uid) => (await data.collection("palettes").where("userId", "==", uid).get()).size;
const queued = () => ({ requestedAt: Timestamp.now(), reason: "grace-expired", graceUntil: Timestamp.now(), apps: {} });

test("sweep purges every unconfirmed queue entry and only those users", async () => {
  await seedPalettes("gone-1", 3);
  await seedPalettes("gone-2", 650); // more than one delete batch
  await seedPalettes("keep", 2);
  await hub.collection("purgeQueue").doc("gone-1").set({ uid: "gone-1", ...queued() });
  await hub.collection("purgeQueue").doc("gone-2").set({ uid: "gone-2", ...queued() });

  const out = await sweepPurgeQueue(hub, data);
  const byUid = Object.fromEntries(out.map((o) => [o.uid, o]));
  assert.equal(byUid["gone-1"].deleted, 3);
  assert.equal(byUid["gone-2"].deleted, 650);
  assert.equal(await count("gone-1"), 0);
  assert.equal(await count("gone-2"), 0);
  assert.equal(await count("keep"), 2);

  const q = (await hub.collection("purgeQueue").doc("gone-1").get()).data();
  assert.ok(q.confirmed.palette instanceof Timestamp, "confirmed.palette is a timestamp");
  assert.equal(q.reason, "grace-expired");
  assert.deepEqual(q.apps, {});
  assert.equal(q.uid, "gone-1");

  // Second sweep: nothing left to do.
  assert.deepEqual(await sweepPurgeQueue(hub, data), []);

  // An entry another app already confirmed is still palette's job, and the
  // other app's confirmation survives.
  await seedPalettes("other-app", 1);
  await hub.collection("purgeQueue").doc("other-app").set({ uid: "other-app", ...queued(), confirmed: { vixxpix: Timestamp.now() } });
  const again = await sweepPurgeQueue(hub, data);
  assert.equal(again.length, 1);
  assert.equal(await count("other-app"), 0);
  const oq = (await hub.collection("purgeQueue").doc("other-app").get()).data();
  assert.ok(oq.confirmed.vixxpix && oq.confirmed.palette, "keeps other apps' confirmations");
});

test("no queue entry, no deletion", async () => {
  await seedPalettes("not-queued", 1);
  const o = await purgeQueuedUser(hub, data, "not-queued");
  assert.equal(o.skipped, "no-queue-entry");
  assert.equal(await count("not-queued"), 1);
});
