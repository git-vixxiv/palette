/**
 * palette's purge worker. ADR-0001 R8 + §10 gap 4 (binding on Brief 2):
 *
 *   "every app migration must consume purgeQueue/{uid} and delete that user's
 *    app-owned resources within 7 days of the queue entry, then write
 *    purgeQueue/{uid}.confirmed.<app>."
 *
 * The hub's runPurge writes purgeQueue/{uid} (default database) when a user's
 * 60-day grace window has passed. palette owns exactly one kind of resource:
 * documents in `palettes` (named database `palette`) whose userId is the uid.
 * This deletes all of them, then sets purgeQueue/{uid}.confirmed.palette to a
 * server timestamp. It touches no other field of the hub's queue document and
 * nothing else the hub owns. The Auth account is the hub's and is retained.
 *
 * Idempotent: an entry that already carries confirmed.palette is skipped. If
 * the hub re-queues the same uid later (re-subscribe, lapse again), its set()
 * replaces the document without `confirmed`, and the worker runs again.
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";

export const APP = "palette";
export const PALETTE_DATABASE_ID = "palette";
export const QUEUE = "purgeQueue";

export interface PurgeOutcome {
  uid: string;
  deleted: number;
  confirmed: boolean;
  skipped?: "no-queue-entry" | "already-confirmed";
}

/** Delete every palette owned by `uid`, in batches. Returns the count. */
export async function deleteUserPalettes(data: Firestore, uid: string, batchSize = 300): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await data.collection("palettes").where("userId", "==", uid).limit(batchSize).get();
    if (snap.empty) return deleted;
    const batch = data.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) return deleted;
  }
}

/**
 * Purge one queued user. `hub` is vixxiv-id's (default) database (purgeQueue);
 * `data` is the named database `palette` (palettes).
 */
export async function purgeQueuedUser(hub: Firestore, data: Firestore, uid: string): Promise<PurgeOutcome> {
  const ref = hub.collection(QUEUE).doc(uid);
  const entry = await ref.get();
  if (!entry.exists) return { uid, deleted: 0, confirmed: false, skipped: "no-queue-entry" };
  if (entry.get(`confirmed.${APP}`)) return { uid, deleted: 0, confirmed: true, skipped: "already-confirmed" };

  const deleted = await deleteUserPalettes(data, uid);
  await ref.update({ [`confirmed.${APP}`]: FieldValue.serverTimestamp() });
  return { uid, deleted, confirmed: true };
}

/**
 * Backstop sweep: confirm every queue entry palette has not confirmed yet.
 * Catches anything the trigger missed (deploy gap, exhausted retries).
 */
export async function sweepPurgeQueue(hub: Firestore, data: Firestore): Promise<PurgeOutcome[]> {
  const snap = await hub.collection(QUEUE).get();
  const out: PurgeOutcome[] = [];
  for (const d of snap.docs) {
    if (d.get(`confirmed.${APP}`)) continue;
    out.push(await purgeQueuedUser(hub, data, d.id));
  }
  return out;
}
