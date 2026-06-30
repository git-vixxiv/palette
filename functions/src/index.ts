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
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Client, Environment, WebhooksHelper } from "square";
import { randomUUID } from "node:crypto";

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

    try {
      // 2. Find or create a Square customer for this user.
      const snap = await userRef.get();
      let squareCustomerId: string | undefined = snap.get("squareCustomerId");

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

      // 3. Save the card on file from the single-use token.
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
      const premiumExpires = expiryForPlan(plan, now);

      if (plan === "lifetime") {
        // 4a. One-time charge for lifetime access.
        const payRes = await client.paymentsApi.createPayment({
          sourceId: cardToken,
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
      } else {
        // 4b. Recurring subscription (monthly / annual).
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
      }

      // 5. Grant the tier in Firestore via the Admin SDK (bypasses rules).
      await userRef.set(
        {
          userId: uid,
          email,
          tier: TIER_FOR_PLAN[plan],
          subscriptionId,
          subscriptionStatus: subscriptionStatus === "pending" ? "active" : subscriptionStatus,
          premiumExpires: premiumExpires.toISOString(),
          pricingPlan: PLAN_LABEL[plan],
          squareCustomerId,
          squareCardId: cardId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("Subscription granted", { uid, plan, subscriptionId });
      return { success: true, tier: TIER_FOR_PLAN[plan], pricingPlan: PLAN_LABEL[plan] };
    } catch (err: any) {
      // Surface Square API validation errors cleanly to the client.
      const squareErrors = err?.result?.errors ?? err?.errors;
      if (squareErrors?.length) {
        logger.error("Square API error", { uid, plan, errors: squareErrors });
        const e = squareErrors[0];
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
      await client.subscriptionsApi.cancelSubscription(subscriptionId);
      await userRef.set(
        { subscriptionStatus: "canceling", updatedAt: FieldValue.serverTimestamp() },
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

/** Locate the user document tied to a Square subscription or customer id. */
async function findUserRefBySubscription(subscriptionId?: string, customerId?: string) {
  if (subscriptionId) {
    const q = await db.collection("users").where("subscriptionId", "==", subscriptionId).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  if (customerId) {
    const q = await db.collection("users").where("squareCustomerId", "==", customerId).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  return null;
}

export const squareWebhook = onRequest(
  { region: "us-central1", secrets: [SQUARE_WEBHOOK_SIGNATURE_KEY] },
  async (req, res) => {
    // 1. Verify the event really came from Square.
    const signature = req.header("x-square-hmacsha256-signature") ?? "";
    const rawBody = (req as any).rawBody?.toString("utf8") ?? JSON.stringify(req.body);
    const notificationUrl = SQUARE_WEBHOOK_URL.value();

    const valid = WebhooksHelper.isValidWebhookEventSignature(
      rawBody,
      signature,
      SQUARE_WEBHOOK_SIGNATURE_KEY.value(),
      notificationUrl
    );
    if (!valid) {
      logger.warn("Rejected webhook with invalid signature");
      res.status(401).send("invalid signature");
      return;
    }

    const event = req.body;
    const type: string = event?.type ?? "";
    logger.info("Square webhook received", { type });

    try {
      const obj = event?.data?.object ?? {};

      switch (type) {
        // A subscription's status changed (ACTIVE, PAUSED, CANCELED, DEACTIVATED…)
        case "subscription.updated": {
          const sub = obj.subscription ?? {};
          const ref = await findUserRefBySubscription(sub.id, sub.customer_id);
          if (ref) {
            const status = String(sub.status ?? "").toLowerCase();
            const isDead = ["canceled", "deactivated"].includes(status);
            await ref.set(
              {
                subscriptionStatus: isDead ? "cancelled" : status || "active",
                ...(isDead ? { tier: "free", premiumExpires: new Date().toISOString() } : {}),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          break;
        }

        // A recurring invoice was paid → extend access one more period.
        case "invoice.payment_made": {
          const invoice = obj.invoice ?? {};
          const subscriptionId = invoice.subscription_id;
          const ref = await findUserRefBySubscription(subscriptionId);
          if (ref) {
            const snap = await ref.get();
            const tier: string = snap.get("tier") || "pro-monthly";
            const plan: Plan = tier === "pro-annual" ? "annual" : "monthly";
            await ref.set(
              {
                subscriptionStatus: "active",
                premiumExpires: expiryForPlan(plan).toISOString(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          break;
        }

        // Payment failed on a scheduled charge → flag the account as past due.
        case "invoice.scheduled_charge_failed":
        case "invoice.payment_failed": {
          const invoice = obj.invoice ?? {};
          const ref = await findUserRefBySubscription(invoice.subscription_id);
          if (ref) {
            await ref.set(
              { subscriptionStatus: "past_due", updatedAt: FieldValue.serverTimestamp() },
              { merge: true }
            );
          }
          break;
        }

        default:
          logger.info("Unhandled webhook type", { type });
      }

      res.status(200).send("ok");
    } catch (err: any) {
      logger.error("Webhook handler error", { type, message: err?.message });
      // Still 200 so Square doesn't hammer retries on our internal bugs;
      // the error is logged for follow-up.
      res.status(200).send("ok");
    }
  }
);
