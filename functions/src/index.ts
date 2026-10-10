/**
 * palette — Cloud Functions, codebase "palette" in vixxiv-id.
 *
 * ADR-0001 Brief 2. palette has NO billing functions: the hub owns Square.
 * The only server-side work palette does is honour the hub's purge queue.
 *
 * Deploy only with `firebase deploy --only functions:palette`. The codebase
 * name keeps a palette deploy from touching (or offering to delete) the hub's
 * functions, which live in codebase "default" from git-vixxiv/vixxiv-id.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { APP, PALETTE_DATABASE_ID, purgeQueuedUser, sweepPurgeQueue } from "./purge.js";

const app = initializeApp();
const hub = () => getFirestore(app);
const data = () => getFirestore(app, PALETTE_DATABASE_ID);

/**
 * Runs the moment the hub writes purgeQueue/{uid}. `retry: true` makes a
 * failed run retry (Cloud Functions retries event triggers for up to 7 days,
 * which is also the ADR's deadline); the daily sweep is the backstop.
 */
export const palettePurgeOnQueue = onDocumentWritten(
  { document: "purgeQueue/{uid}", database: "(default)", region: "us-central1", retry: true },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    if (after.get(`confirmed.${APP}`)) return; // our own write, or already done
    const outcome = await purgeQueuedUser(hub(), data(), event.params.uid);
    logger.info("palette purge", outcome);
  }
);

/** Daily, an hour after the hub's 03:15 UTC purge job. */
export const palettePurgeSweep = onSchedule(
  { schedule: "15 4 * * *", timeZone: "Etc/UTC", region: "us-central1" },
  async () => {
    const outcomes = await sweepPurgeQueue(hub(), data());
    logger.info("palette purge sweep", { purged: outcomes.length });
  }
);
