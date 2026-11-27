/**
 * Cloud Functions for "palette by vixxiv"
 * --------------------------------------------------------------------------
 * Responsibilities:
 *   1. createSubscription  — callable. Takes a Square card token from the
 *      browser (Web Payments SDK), saves the card on file, and either creates
 *      a real auto-renewing Square subscription (monthly / annual) or a
 *      one-time payment (lifetime). Grants the paid tier in Firestore via the
 *      Admin SDK (which bypasses Firestore security rules).
 *   2. cancelSubscription  — callable. Cancels the user's active Square
 *      subscription. The actual downgrade lands when Square emits the
 *      subscription.canceled webhook (or at period end).
 *   3. squareWebhook       — HTTPS. Receives Square events (renewals, payment
 *      failures, cancellations) and reconciles each user's tier/expiry.
 *
 * SECURITY: the Square access token & webhook signature key are loaded as
 * Firebase secrets and never reach the client. The client only ever holds a
 * single-use card token produced by Square's PCI-compliant iframe.
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { Client, Environment, WebhooksHelper } from "square";
import { randomUUID, createHmac } from "node:crypto";

initializeApp();
const db = getFirestore();

/* ----------------------------------------------------------------------- *
 * Configuration (secrets + params)
 * ----------------------------------------------------------------------- */

// Secrets — set via `firebase functions:secrets:set <NAME>`
const SQUARE_ACCESS_TOKEN = defineSecret("SQUARE_ACCESS_TOKEN");
const SQUARE_WEBHOOK_SIGNATURE_KEY = defineSecret("SQUARE_WEBHOOK_SIGNATURE_KEY");

// Non-secret params — set in functions/.env (see .env.example)
const SQUARE_ENVIRONMENT = defineString("SQUARE_ENVIRONMENT", { default: "sandbox" });
const SQUARE_LOCATION_ID = defineString("SQUARE_LOCATION_ID", { default: "" });
const SQUARE_PLAN_MONTHLY = defineString("SQUARE_PLAN_MONTHLY", { default: "" });
const SQUARE_PLAN_ANNUAL = defineString("SQUARE_PLAN_ANNUAL", { default: "" });
const LIFETIME_PRICE_CENTS = defineString("LIFETIME_PRICE_CENTS", { default: "5000" });
// Public URL the webhook is registered under in the Square dashboard. Used to
// validate the event signature.
const SQUARE_WEBHOOK_URL = defineString("SQUARE_WEBHOOK_URL", { default: "" });

type Plan = "monthly" | "annual" | "lifetime";

const PLAN_LABEL: Record<Plan, string> = {
  monthly: "$5/mo",
  annual: "$25/yr",
  lifetime: "$50 lifetime",
};

const TIER_FOR_PLAN: Record<Plan, string> = {
  monthly: "pro-monthly",
  annual: "pro-annual",
  lifetime: "pro-lifetime",
};

function squareClient(): Client {
  return new Client({
    accessToken: SQUARE_ACCESS_TOKEN.value(),
    environment:
      SQUARE_ENVIRONMENT.value() === "production"
        ? Environment.Production
        : Environment.Sandbox,
  });
}

/** Compute the next renewal / expiry boundary for a given plan. */
function expiryForPlan(plan: Plan, from = new Date()): Date {
  const d = new Date(from);
  if (plan === "monthly") d.setMonth(d.getMonth() + 1);
  else if (plan === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setFullYear(d.getFullYear() + 100); // lifetime ≈ forever
  return d;
}

/** Square returns billing boundaries as YYYY-MM-DD; treat as end of that day (UTC). */
function dateFromSquareDay(day?: string | null): Date | null {
  if (!day) return null;
  const d = new Date(`${day}T23:59:59Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Both representations of the expiry: ISO string (client) + Timestamp (rules). */
function expiryFields(d: Date) {
  return { premiumExpires: d.toISOString(), premiumExpiresAt: Timestamp.fromDate(d) };
}

/** True while a monthly/annual plan still entitles the user to Pro. */
function hasLiveRecurring(data: FirebaseFirestore.DocumentData): boolean {
  if (data.tier !== "pro-monthly" && data.tier !== "pro-annual") return false;
  if (data.subscriptionStatus === "cancelled") return false;
  const exp = data.premiumExpires ? Date.parse(data.premiumExpires) : NaN;
  return Number.isFinite(exp) && exp > Date.now();
}

// A checkout holds this lock so two concurrent requests can't both charge.
const CHECKOUT_LOCK_MS = 90_000;

/* ----------------------------------------------------------------------- *
 * createSubscription (callable)
 * ----------------------------------------------------------------------- */

export const createSubscription = onCall(
  {
    region: "us-central1",
    secrets: [SQUARE_ACCESS_TOKEN],
    cors: true,
  },
  async (request) => {
    // 1. Must be an authenticated Firebase user.
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to subscribe.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email ?? "";

    const plan = request.data?.plan as Plan;
    const cardToken = request.data?.token as string;
    const verificationToken = request.data?.verificationToken as string | undefined;

    if (!plan || !["monthly", "annual", "lifetime"].includes(plan)) {
      throw new HttpsError("invalid-argument", "A valid plan is required.");
    }
    if (!cardToken) {
      throw new HttpsError("invalid-argument", "Missing card token.");
    }

    const client = squareClient();
    const locationId = SQUARE_LOCATION_ID.value();
    const userRef = db.collection("users").doc(uid);

    // 2. Refuse duplicate purchases and take a short checkout lock, atomically.
    //    - Lifetime owners have nothing left to buy.
    //    - A live monthly/annual plan may only be upgraded to lifetime.
    let previous: FirebaseFirestore.DocumentData = {};
    await db.runTransaction(async (tx) => {
      const s = await tx.get(userRef);
      previous = s.data() ?? {};
      if (previous.tier === "pro-lifetime") {
        throw new HttpsError("already-exists", "You already have lifetime Pro access.");
      }
      if (hasLiveRecurring(previous) && plan !== "lifetime") {
        throw new HttpsError(
          "already-exists",
          "You already have an active Pro plan. It must end before you can start a different one."
        );
      }
      const lockAt: number = previous.checkoutLockAt?.toMillis?.() ?? 0;
      if (Date.now() - lockAt < CHECKOUT_LOCK_MS) {
        throw new HttpsError("aborted", "A checkout is already in progress. Please wait a moment.");
      }
      tx.set(userRef, { checkoutLockAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    try {
      // 3. Find or create a Square customer for this user.
      let squareCustomerId: string | undefined = previous.squareCustomerId;

      if (!squareCustomerId) {
        const customerRes = await client.customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          emailAddress: email || undefined,
          referenceId: uid,
        });
        squareCustomerId = customerRes.result.customer?.id;
        if (!squareCustomerId) {
          throw new HttpsError("internal", "Could not create Square customer.");
        }
      }

      // 4. Save the card on file from the single-use token.
      //    Only include verificationToken when it's a real string — Square's
      //    SDK rejects a null value for this optional field.
      const cardRes = await client.cardsApi.createCard({
        idempotencyKey: randomUUID(),
        sourceId: cardToken,
        ...(verificationToken ? { verificationToken } : {}),
        card: { customerId: squareCustomerId },
      });
      const cardId = cardRes.result.card?.id;
      if (!cardId) {
        throw new HttpsError("internal", "Could not save card on file.");
      }

      let subscriptionId = "";
      let subscriptionStatus = "active";
      const now = new Date();
      let premiumExpires = expiryForPlan(plan, now);

      if (plan === "lifetime") {
        // 5a. One-time charge for lifetime access. The single-use card token
        //     was consumed by createCard above, so charge the card on file.
        const payRes = await client.paymentsApi.createPayment({
          sourceId: cardId,
          idempotencyKey: randomUUID(),
          amountMoney: {
            amount: BigInt(parseInt(LIFETIME_PRICE_CENTS.value(), 10)),
            currency: "USD",
          },
          locationId,
          customerId: squareCustomerId,
          referenceId: uid,
          note: "palette Pro — Lifetime",
        });
        if (payRes.result.payment?.status !== "COMPLETED") {
          throw new HttpsError("failed-precondition", "Payment was not completed.");
        }
        subscriptionId = payRes.result.payment?.id ?? "";

        // Upgrading from monthly/annual: stop the old plan from renewing.
        // (Square ends it at period close; no further charges are made.)
        const oldSubId: string | undefined = previous.subscriptionId;
        if (hasLiveRecurring(previous) && oldSubId && previous.subscriptionStatus !== "canceling") {
          try {
            await client.subscriptionsApi.cancelSubscription(oldSubId);
          } catch (cancelErr: any) {
            logger.error("Lifetime upgrade: could not cancel previous subscription", {
              uid,
              oldSubId,
              errors: cancelErr?.result?.errors ?? cancelErr?.message,
            });
          }
        }
      } else {
        // 5b. Recurring subscription (monthly / annual).
        const planVariationId =
          plan === "monthly" ? SQUARE_PLAN_MONTHLY.value() : SQUARE_PLAN_ANNUAL.value();
        if (!planVariationId) {
          throw new HttpsError(
            "failed-precondition",
            `No Square plan configured for ${plan}. Run the plan setup script.`
          );
        }
        const subRes = await client.subscriptionsApi.createSubscription({
          idempotencyKey: randomUUID(),
          locationId,
          planVariationId,
          customerId: squareCustomerId,
          cardId,
        });
        const sub = subRes.result.subscription;
        subscriptionId = sub?.id ?? "";
        subscriptionStatus = (sub?.status ?? "ACTIVE").toLowerCase();
        // Prefer Square's own paid-through date when it is already known.
        premiumExpires = dateFromSquareDay(sub?.chargedThroughDate) ?? premiumExpires;
      }

      // 6. Grant the tier in Firestore via the Admin SDK (bypasses rules).
      await userRef.set(
        {
          userId: uid,
          email,
          tier: TIER_FOR_PLAN[plan],
          subscriptionId,
          subscriptionStatus: subscriptionStatus === "pending" ? "active" : subscriptionStatus,
          ...expiryFields(premiumExpires),
          pricingPlan: PLAN_LABEL[plan],
          squareCustomerId,
          squareCardId: cardId,
          checkoutLockAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("Subscription granted", { uid, plan, subscriptionId });
      return { success: true, tier: TIER_FOR_PLAN[plan], pricingPlan: PLAN_LABEL[plan] };
    } catch (err: any) {
      // Release the checkout lock so the user can retry straight away.
      await userRef
        .set({ checkoutLockAt: FieldValue.delete() }, { merge: true })
        .catch(() => undefined);

      // Surface Square API validation errors cleanly to the client.
      const squareErrors = err?.result?.errors ?? err?.errors;
      if (squareErrors?.length) {
        // Square's error objects do not serialise as-is, so log plain fields.
        // Also record whether the configured location belongs to the account
        // behind our access token: a mismatch there is a setup fault, and it
        // otherwise looks like a card problem.
        let locationKnown: boolean | string = "unchecked";
        try {
          const locs = await client.locationsApi.listLocations();
          locationKnown = (locs.result.locations ?? []).some((l) => l.id === SQUARE_LOCATION_ID.value());
        } catch {
          locationKnown = "lookup failed";
        }
        logger.error("Square API error", {
          uid,
          plan,
          request: err?.request?.url ? String(err.request.url) : undefined,
          statusCode: err?.statusCode,
          locationBelongsToTokenAccount: locationKnown,
          errors: squareErrors.map((x: any) => ({ category: x.category, code: x.code, detail: x.detail, field: x.field })),
        });
        const e = squareErrors[0];
        // Square refusing our own credentials is not something the customer
        // can fix; the client shows its "unavailable on our side" message.
        if (e.category === "AUTHENTICATION_ERROR") {
          throw new HttpsError("unavailable", "unavailable");
        }
        throw new HttpsError(
          "failed-precondition",
          e.detail || e.code || "Payment failed."
        );
      }
      if (err instanceof HttpsError) throw err;
      logger.error("createSubscription failed", {
        uid,
        plan,
        name: err?.name,
        message: err?.message,
        statusCode: err?.statusCode,
        body: err?.body,
        stack: err?.stack,
        dump: JSON.stringify(err, Object.getOwnPropertyNames(err || {})).slice(0, 2000),
      });
      throw new HttpsError("internal", `Checkout error: ${err?.message || err?.name || "unknown"}`);
    }
  }
);

/* ----------------------------------------------------------------------- *
 * cancelSubscription (callable)
 * ----------------------------------------------------------------------- */

export const cancelSubscription = onCall(
  { region: "us-central1", secrets: [SQUARE_ACCESS_TOKEN], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const subscriptionId: string | undefined = snap.get("subscriptionId");
    const tier: string | undefined = snap.get("tier");

    // Lifetime cannot be cancelled; nothing recurring to stop.
    if (tier === "pro-lifetime") {
      throw new HttpsError("failed-precondition", "Lifetime access cannot be cancelled.");
    }
    if (!subscriptionId) {
      throw new HttpsError("failed-precondition", "No active subscription to cancel.");
    }

    try {
      const client = squareClient();
      // Schedules cancellation at the end of the current billing period.
      const cancelRes = await client.subscriptionsApi.cancelSubscription(subscriptionId);
      const endsOn = dateFromSquareDay(cancelRes.result.subscription?.canceledDate);
      await userRef.set(
        {
          subscriptionStatus: "canceling",
          ...(endsOn ? expiryFields(endsOn) : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      logger.info("Subscription cancellation scheduled", { uid, subscriptionId });
      return { success: true };
    } catch (err: any) {
      const squareErrors = err?.result?.errors ?? err?.errors;
      logger.error("cancelSubscription failed", { uid, errors: squareErrors, message: err?.message });
      throw new HttpsError("internal", "Could not cancel subscription. Please contact support.");
    }
  }
);

/* ----------------------------------------------------------------------- *
 * squareWebhook (HTTPS) — subscription lifecycle reconciliation
 * ----------------------------------------------------------------------- */

/**
 * Locate the user whose CURRENT plan is this Square subscription. Matching on
 * subscriptionId only (never the customer id) means events for a superseded
 * subscription - e.g. the old monthly plan after a lifetime upgrade - are
 * ignored instead of downgrading the account.
 */
async function findUserBySubscription(subscriptionId?: string) {
  if (!subscriptionId) return null;
  const q = await db.collection("users").where("subscriptionId", "==", subscriptionId).limit(1).get();
  return q.empty ? null : q.docs[0];
}

export const squareWebhook = onRequest(
  { region: "us-central1", secrets: [SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_ACCESS_TOKEN] },
  async (req, res) => {
    // 1. Verify the event really came from Square.
    const signature = req.header("x-square-hmacsha256-signature") ?? "";
    const rawBody = (req as any).rawBody?.toString("utf8") ?? JSON.stringify(req.body);
    const notificationUrl = SQUARE_WEBHOOK_URL.value();

    // Trim so stray whitespace/newlines from pasting the secret can't break it.
    const signatureKey = SQUARE_WEBHOOK_SIGNATURE_KEY.value().trim();

    const valid = WebhooksHelper.isValidWebhookEventSignature(
      rawBody,
      signature,
      signatureKey,
      notificationUrl
    );
    if (!valid) {
      // Diagnostics only: never log the key or signature themselves. This
      // reports whether a different notification URL would have validated,
      // which separates "wrong URL registered" from "wrong key".
      const sign = (url: string) =>
        createHmac("sha256", signatureKey).update(url + rawBody).digest("base64");
      const host = req.header("x-forwarded-host") ?? req.header("host") ?? "";
      const candidates: Record<string, string> = {
        configured: notificationUrl,
        configuredTrailingSlash: notificationUrl.replace(/\/?$/, "/"),
        requestHost: `https://${host}${req.originalUrl === "/" ? "" : req.originalUrl}`,
        requestHostSlash: `https://${host}/`,
        requestHostFunctionPath: `https://${host}/squareWebhook`,
      };
      const urlThatValidates =
        Object.entries(candidates).find(([, url]) => signature && sign(url) === signature)?.[0] ??
        null;
      logger.warn("Rejected webhook with invalid signature", {
        signatureHeaderPresent: signature.length > 0,
        signatureKeyLength: signatureKey.length,
        rawKeyHadWhitespace: SQUARE_WEBHOOK_SIGNATURE_KEY.value() !== signatureKey,        configuredUrl: notificationUrl,
        requestHost: host,
        requestPath: req.originalUrl,
        bodyLength: rawBody.length,
        hasRawBody: Boolean((req as any).rawBody),
        urlThatValidates,
      });
      res.status(401).send("invalid signature");
      return;
    }

    const event = req.body;
    const type: string = event?.type ?? "";
    logger.info("Square webhook received", { type, eventId: event?.event_id });

    try {
      const obj = event?.data?.object ?? {};

      switch (type) {
        // A subscription changed: cancel scheduled, cancelled, deactivated, resumed...
        case "subscription.updated": {
          const sub = obj.subscription ?? {};
          const doc = await findUserBySubscription(sub.id);
          if (!doc || doc.get("tier") === "pro-lifetime") break;

          const status = String(sub.status ?? "").toLowerCase();
          const isDead = ["canceled", "deactivated"].includes(status);
          const endsOn = dateFromSquareDay(sub.canceled_date);
          const paidThrough = dateFromSquareDay(sub.charged_through_date);

          if (isDead) {
            await doc.ref.set(
              {
                tier: "free",
                subscriptionStatus: "cancelled",
                ...expiryFields(new Date()),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } else if (endsOn) {
            // Still active, but will not renew: access runs to the end date.
            await doc.ref.set(
              {
                subscriptionStatus: "canceling",
                ...expiryFields(endsOn),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } else {
            await doc.ref.set(
              {
                subscriptionStatus: status === "pending" ? "active" : status || "active",
                ...(paidThrough ? expiryFields(paidThrough) : {}),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          break;
        }

        // A recurring invoice was paid -> extend access through the new period.
        case "invoice.payment_made": {
          const invoice = obj.invoice ?? {};
          const doc = await findUserBySubscription(invoice.subscription_id);
          if (!doc || doc.get("tier") === "pro-lifetime") break;

          // Ask Square for the authoritative paid-through date; fall back to
          // one plan period from now if it is not available.
          let paidThrough: Date | null = null;
          try {
            const subRes = await squareClient().subscriptionsApi.retrieveSubscription(
              invoice.subscription_id
            );
            paidThrough = dateFromSquareDay(subRes.result.subscription?.chargedThroughDate);
          } catch (lookupErr: any) {
            logger.warn("Could not read paid-through date", { message: lookupErr?.message });
          }
          const plan: Plan = doc.get("tier") === "pro-annual" ? "annual" : "monthly";
          const keepCanceling = doc.get("subscriptionStatus") === "canceling";
          await doc.ref.set(
            {
              subscriptionStatus: keepCanceling ? "canceling" : "active",
              ...expiryFields(paidThrough ?? expiryForPlan(plan)),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          break;
        }

        // A scheduled charge failed -> flag the account. Access lapses on its
        // own when premiumExpires (+ grace) passes, or when Square deactivates.
        case "invoice.scheduled_charge_failed": {
          const invoice = obj.invoice ?? {};
          const doc = await findUserBySubscription(invoice.subscription_id);
          if (!doc || doc.get("tier") === "pro-lifetime") break;
          await doc.ref.set(
            { subscriptionStatus: "past_due", updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          break;
        }

        default:
          logger.info("Unhandled webhook type", { type });
      }

      res.status(200).send("ok");
    } catch (err: any) {
      // 500 so Square retries the delivery; a dropped event here would leave
      // a paying or cancelled account in the wrong state.
      logger.error("Webhook handler error", { type, message: err?.message, stack: err?.stack });
      res.status(500).send("handler error");
    }
  }
);
