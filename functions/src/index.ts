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
import { getAuth } from "firebase-admin/auth";
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

// List prices in cents. Used to work out promo prices and to restore the
// normal price after a first-payment-only promo.
const PRICE_MONTHLY_CENTS = defineString("PRICE_MONTHLY_CENTS", { default: "500" });
const PRICE_ANNUAL_CENTS = defineString("PRICE_ANNUAL_CENTS", { default: "2500" });
// Comma-separated sign-in emails allowed to use the admin tools.
const ADMIN_EMAILS = defineString("ADMIN_EMAILS", { default: "joe@vixxiv.com,amvp123@gmail.com" });

type Plan = "monthly" | "annual" | "lifetime";

function listPriceCents(plan: Plan): number {
  const raw =
    plan === "monthly" ? PRICE_MONTHLY_CENTS.value() : plan === "annual" ? PRICE_ANNUAL_CENTS.value() : LIFETIME_PRICE_CENTS.value();
  return parseInt(raw, 10);
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const PLAN_UNIT: Record<Plan, string> = { monthly: "/mo", annual: "/yr", lifetime: " lifetime" };

/* ----------------------------------------------------------------------- *
 * Promo codes
 *   promoCodes/{CODE}: { kind: "percent" | "fixed", percentOff?, fixedCents?:
 *   { monthly?, annual?, lifetime? }, plans: Plan[], duration: "first" |
 *   "forever", maxRedemptions?, redeemed, expiresAt?, active, note }
 *   kind "comp" is a free pass: { compKind: "lifetime" | "until", compUntil? }.
 *   It is redeemed without a card and never touches Square.
 *   promoCodes/{CODE}/redemptions/{uid}: one per account.
 * Only Cloud Functions read or write these (firestore.rules denies clients).
 * ----------------------------------------------------------------------- */

// Square will not charge a card less than this.
const MIN_CHARGE_CENTS = 100;

interface PromoQuote {
  code: string;
  priceCents: number;
  fullCents: number;
  duration: "first" | "forever";
  /** Set for a complimentary code: no payment, Pro is granted directly. */
  comp?: { kind: "lifetime" | "until"; until: number | null };
}

const cleanCode = (raw: unknown) => String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);

/** Work out what `plan` costs with this code for this account, or explain why it can't be used. */
async function quotePromo(rawCode: unknown, plan: Plan, uid: string): Promise<PromoQuote> {
  const code = cleanCode(rawCode);
  if (!code) throw new HttpsError("invalid-argument", "Enter a promo code.");
  const ref = db.collection("promoCodes").doc(code);
  const [snap, used] = await Promise.all([ref.get(), ref.collection("redemptions").doc(uid).get()]);
  const d = snap.data();
  if (!snap.exists || !d || d.active === false) throw new HttpsError("not-found", "That promo code isn't valid.");
  if (d.expiresAt && d.expiresAt.toMillis() < Date.now()) throw new HttpsError("failed-precondition", "That promo code has expired.");
  if (d.maxRedemptions && (d.redeemed ?? 0) >= d.maxRedemptions) throw new HttpsError("failed-precondition", "That promo code has been fully used.");
  if (used.exists) throw new HttpsError("failed-precondition", "You've already used that promo code.");
  const fullCents = listPriceCents(plan);
  if (d.kind === "comp") {
    const until = d.compKind === "lifetime" ? null : d.compUntil?.toMillis?.() ?? 0;
    if (until !== null && until < Date.now()) throw new HttpsError("failed-precondition", "That promo code has expired.");
    return { code, priceCents: 0, fullCents, duration: "forever", comp: { kind: d.compKind === "lifetime" ? "lifetime" : "until", until } };
  }
  if (Array.isArray(d.plans) && !d.plans.includes(plan)) throw new HttpsError("failed-precondition", `That promo code doesn't apply to the ${plan} plan.`);

  let priceCents: number;
  if (d.kind === "fixed") {
    priceCents = Number(d.fixedCents?.[plan]);
    if (!Number.isFinite(priceCents)) throw new HttpsError("failed-precondition", `That promo code doesn't apply to the ${plan} plan.`);
  } else {
    priceCents = Math.round((fullCents * (100 - Number(d.percentOff))) / 100);
  }
  priceCents = Math.max(MIN_CHARGE_CENTS, Math.round(priceCents));
  if (priceCents >= fullCents) throw new HttpsError("failed-precondition", "That promo code doesn't lower the price of this plan.");
  // A one-time purchase has no renewals, so "first payment" and "every renewal" are the same thing.
  const duration: "first" | "forever" = plan === "lifetime" ? "forever" : d.duration === "first" ? "first" : "forever";
  return { code, priceCents, fullCents, duration };
}

/** Callable: preview a promo code on the checkout screen. */
export const validatePromo = onCall({ region: "us-central1", cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
  const plan = request.data?.plan as Plan;
  if (!["monthly", "annual", "lifetime"].includes(plan)) throw new HttpsError("invalid-argument", "A valid plan is required.");
  return await quotePromo(request.data?.code, plan, request.auth.uid);
});

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
    const promoInput = request.data?.promoCode as string | undefined;

    if (!plan || !["monthly", "annual", "lifetime"].includes(plan)) {
      throw new HttpsError("invalid-argument", "A valid plan is required.");
    }
    if (!cardToken) {
      throw new HttpsError("invalid-argument", "Missing card token.");
    }

    const client = squareClient();
    const locationId = SQUARE_LOCATION_ID.value();
    const userRef = db.collection("users").doc(uid);

    // A promo code is checked before anything is charged; a bad code stops here.
    const promo: PromoQuote | null = promoInput ? await quotePromo(promoInput, plan, uid) : null;
    if (promo?.comp) {
      throw new HttpsError("failed-precondition", "That code is a complimentary pass. Redeem it without a card.");
    }

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
            amount: BigInt(promo ? promo.priceCents : listPriceCents("lifetime")),
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
          // Promo: bill the promo price in place of the plan's own price. For
          // a first-payment-only code the webhook restores the normal price
          // once the first invoice has been paid.
          ...(promo ? { priceOverrideMoney: { amount: BigInt(promo.priceCents), currency: "USD" } } : {}),
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
          pricingPlan: promo
            ? promo.duration === "first" && plan !== "lifetime"
              ? `${PLAN_LABEL[plan]} (first payment ${dollars(promo.priceCents)})`
              : `${dollars(promo.priceCents)}${PLAN_UNIT[plan]} (promo ${promo.code})`
            : PLAN_LABEL[plan],
          comp: FieldValue.delete(),
          promoCode: promo ? promo.code : FieldValue.delete(),
          promoPriceCents: promo ? promo.priceCents : FieldValue.delete(),
          // Set while a first-payment-only promo still has to be reverted.
          promoRevertPending: promo && promo.duration === "first" && plan !== "lifetime" ? true : FieldValue.delete(),
          squareCustomerId,
          squareCardId: cardId,
          checkoutLockAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (promo) {
        // Count the redemption. The charge already succeeded, so a failure
        // here is logged and must not undo the purchase.
        const promoRef = db.collection("promoCodes").doc(promo.code);
        await Promise.all([
          promoRef.set({ redeemed: FieldValue.increment(1) }, { merge: true }),
          promoRef.collection("redemptions").doc(uid).set({
            uid,
            email,
            plan,
            priceCents: promo.priceCents,
            fullCents: promo.fullCents,
            at: FieldValue.serverTimestamp(),
          }),
        ]).catch((e) => logger.error("Could not record promo redemption", { uid, code: promo.code, message: e?.message }));
      }

      logger.info("Subscription granted", { uid, plan, subscriptionId, promo: promo?.code });
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
        // Which Square application issued our access token. A card collected
        // by the web form under one application cannot be saved with another
        // application's token. Application and merchant IDs are not secret.
        let tokenApplication: string = "unchecked";
        try {
          const base = SQUARE_ENVIRONMENT.value() === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
          const r = await fetch(`${base}/oauth2/token/status`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SQUARE_ACCESS_TOKEN.value()}`, "Content-Type": "application/json" },
          });
          const j: any = await r.json();
          tokenApplication = j?.client_id ? `${j.client_id} (merchant ${j.merchant_id})` : `status ${r.status}`;
        } catch {
          tokenApplication = "lookup failed";
        }
        logger.error("Square API error", {
          uid,
          tokenApplication,
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
          let subVersion: bigint | undefined;
          try {
            const subRes = await squareClient().subscriptionsApi.retrieveSubscription(
              invoice.subscription_id
            );
            paidThrough = dateFromSquareDay(subRes.result.subscription?.chargedThroughDate);
            subVersion = subRes.result.subscription?.version;
          } catch (lookupErr: any) {
            logger.warn("Could not read paid-through date", { message: lookupErr?.message });
          }
          const plan: Plan = doc.get("tier") === "pro-annual" ? "annual" : "monthly";

          // First-payment-only promo: the discounted invoice is now paid, so
          // set the subscription back to the normal price for every renewal.
          if (doc.get("promoRevertPending") === true) {
            try {
              await squareClient().subscriptionsApi.updateSubscription(invoice.subscription_id, {
                subscription: {
                  priceOverrideMoney: { amount: BigInt(listPriceCents(plan)), currency: "USD" },
                  ...(subVersion !== undefined ? { version: subVersion } : {}),
                },
              });
              await doc.ref.set({ promoRevertPending: FieldValue.delete(), promoRevertFailed: FieldValue.delete() }, { merge: true });
              logger.info("Promo reverted to list price", { subscriptionId: invoice.subscription_id, plan });
            } catch (revertErr: any) {
              // Leave the flag set so the next invoice event tries again, and
              // mark the account so it shows up in the admin user list.
              await doc.ref.set({ promoRevertFailed: true }, { merge: true });
              logger.error("Could not revert promo price", {
                subscriptionId: invoice.subscription_id,
                errors: (revertErr?.result?.errors ?? []).map((x: any) => ({ code: x.code, detail: x.detail, field: x.field })),
                message: revertErr?.message,
              });
            }
          }
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


/* ----------------------------------------------------------------------- *
 * adminApi (callable) - owner tools: users, comps, promo codes, revenue.
 * Every action re-checks that the caller is a verified admin sign-in.
 * ----------------------------------------------------------------------- */

function requireAdmin(request: { auth?: { uid: string; token: Record<string, any> } }): string {
  const email = String(request.auth?.token?.email ?? "").toLowerCase();
  const allowed = ADMIN_EMAILS.value().split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!request.auth || !email || request.auth.token.email_verified !== true || !allowed.includes(email)) {
    throw new HttpsError("permission-denied", "Not available.");
  }
  return email;
}

const millis = (v: any): number | null => (v?.toMillis ? v.toMillis() : typeof v === "string" && v ? Date.parse(v) : null);

async function adminUsers() {
  const auth = getAuth();
  const authUsers: any[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    authUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken && authUsers.length < 10000);

  const profiles = new Map<string, FirebaseFirestore.DocumentData>();
  (await db.collection("users").get()).forEach((d) => profiles.set(d.id, d.data()));

  const now = Date.now();
  const users = authUsers.map((u) => {
    const p = profiles.get(u.uid) ?? {};
    const expires = millis(p.premiumExpires);
    let tier: string = p.tier ?? "free";
    // Mirror the app: a lapsed monthly/annual plan (3-day grace) counts as free.
    if ((tier === "pro-monthly" || tier === "pro-annual") && (!expires || expires + 3 * 86400000 < now)) tier = "free";
    return {
      uid: u.uid,
      email: u.email ?? p.email ?? "",
      name: u.displayName ?? "",
      created: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
      lastSignIn: u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null,
      tier,
      status: p.subscriptionStatus ?? "",
      plan: p.pricingPlan ?? "",
      expires,
      comp: p.comp === true,
      promoCode: p.promoCode ?? "",
      promoRevertFailed: p.promoRevertFailed === true,
      squareCustomerId: p.squareCustomerId ?? "",
    };
  });
  users.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

  const paying = users.filter((u) => u.tier !== "free" && !u.comp);
  const count = (t: string) => paying.filter((u) => u.tier === t).length;
  const renewing = (t: string) => paying.filter((u) => u.tier === t && u.status !== "canceling").length;
  const summary = {
    total: users.length,
    free: users.filter((u) => u.tier === "free").length,
    monthly: count("pro-monthly"),
    annual: count("pro-annual"),
    lifetime: count("pro-lifetime"),
    comps: users.filter((u) => u.tier !== "free" && u.comp).length,
    canceling: paying.filter((u) => u.status === "canceling").length,
    newLast7: users.filter((u) => (u.created ?? 0) > now - 7 * 86400000).length,
    newLast30: users.filter((u) => (u.created ?? 0) > now - 30 * 86400000).length,
    // List-price estimate from subscriptions set to renew. Promo prices are not reflected.
    mrrCents: Math.round(renewing("pro-monthly") * listPriceCents("monthly") + (renewing("pro-annual") * listPriceCents("annual")) / 12),
  };
  return { users, summary };
}

async function adminRevenue(days: number) {
  const client = squareClient();
  const now = Date.now();
  const begin = new Date(now - days * 86400000).toISOString();
  const payments: any[] = [];
  let cursor: string | undefined;
  let pages = 0;
  let truncated = false;
  do {
    const res = await client.paymentsApi.listPayments(begin, undefined, "DESC", cursor, SQUARE_LOCATION_ID.value(), undefined, undefined, undefined, 100);
    payments.push(...(res.result.payments ?? []));
    cursor = res.result.cursor;
    pages++;
    if (cursor && pages >= 30) {
      truncated = true;
      break;
    }
  } while (cursor);

  const emailByCustomer = new Map<string, string>();
  (await db.collection("users").get()).forEach((d) => {
    const c = d.get("squareCustomerId");
    if (c) emailByCustomer.set(c, d.get("email") ?? "");
  });

  const rows = payments.map((p) => ({
    id: p.id as string,
    at: Date.parse(p.createdAt),
    status: p.status as string,
    amountCents: Number(p.amountMoney?.amount ?? 0),
    refundedCents: Number(p.refundedMoney?.amount ?? 0),
    email: emailByCustomer.get(p.customerId ?? "") ?? "",
    note: (p.note as string) || (p.orderId ? "Subscription invoice" : ""),
  }));
  const done = rows.filter((r) => r.status === "COMPLETED");
  const windowTotals = (ms: number) => {
    const inWin = done.filter((r) => r.at >= now - ms);
    return {
      sales: inWin.length,
      grossCents: inWin.reduce((a, r) => a + r.amountCents, 0),
      refundedCents: inWin.reduce((a, r) => a + r.refundedCents, 0),
    };
  };
  // Daily gross for a chart, oldest first.
  const byDay = new Map<string, number>();
  for (const r of done) {
    const day = new Date(r.at).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + r.amountCents - r.refundedCents);
  }
  return {
    environment: SQUARE_ENVIRONMENT.value(),
    days,
    truncated,
    today: windowTotals(now - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()),
    last7: windowTotals(7 * 86400000),
    last30: windowTotals(30 * 86400000),
    window: windowTotals(days * 86400000),
    daily: [...byDay.entries()].sort().map(([day, cents]) => ({ day, cents })),
    payments: rows.slice(0, 100),
  };
}

async function adminListPromos() {
  const snap = await db.collection("promoCodes").get();
  const promos = snap.docs.map((d) => {
    const p = d.data();
    return {
      code: d.id,
      kind: p.kind,
      percentOff: p.percentOff ?? null,
      fixedCents: p.fixedCents ?? null,
      compKind: p.compKind ?? null,
      compUntil: millis(p.compUntil),
      plans: p.plans ?? [],
      duration: p.duration,
      maxRedemptions: p.maxRedemptions ?? null,
      redeemed: p.redeemed ?? 0,
      expiresAt: millis(p.expiresAt),
      active: p.active !== false,
      note: p.note ?? "",
      createdAt: millis(p.createdAt),
    };
  });
  promos.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { promos, listPrices: { monthly: listPriceCents("monthly"), annual: listPriceCents("annual"), lifetime: listPriceCents("lifetime") } };
}

async function adminCreatePromo(data: any, adminEmail: string) {
  const code = cleanCode(data?.code);
  if (code.length < 3) throw new HttpsError("invalid-argument", "A code needs at least 3 letters or numbers.");
  const isComp = data?.kind === "comp";
  const plans: Plan[] = isComp
    ? ["monthly", "annual", "lifetime"]
    : (Array.isArray(data?.plans) ? data.plans : []).filter((x: any) => ["monthly", "annual", "lifetime"].includes(x));
  if (!plans.length) throw new HttpsError("invalid-argument", "Choose at least one plan.");
  const duration = data?.duration === "first" ? "first" : "forever";
  const doc: Record<string, any> = {
    plans,
    duration,
    active: true,
    redeemed: 0,
    note: String(data?.note ?? "").slice(0, 200),
    createdBy: adminEmail,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (isComp) {
    doc.kind = "comp";
    doc.compKind = data?.compKind === "lifetime" ? "lifetime" : "until";
    if (doc.compKind === "until") {
      const t = Date.parse(`${String(data?.compUntil ?? "").slice(0, 10)}T23:59:59Z`);
      if (!Number.isFinite(t) || t < Date.now()) throw new HttpsError("invalid-argument", "Pick a future date for the complimentary access to end.");
      doc.compUntil = Timestamp.fromMillis(t);
    }
  } else if (data?.kind === "fixed") {
    const fixedCents: Record<string, number> = {};
    for (const plan of plans) {
      const cents = Math.round(Number(data?.fixedCents?.[plan]));
      if (!Number.isFinite(cents) || cents < MIN_CHARGE_CENTS) throw new HttpsError("invalid-argument", `Set a ${plan} price of at least ${dollars(MIN_CHARGE_CENTS)}.`);
      if (cents >= listPriceCents(plan)) throw new HttpsError("invalid-argument", `The ${plan} promo price must be below the normal ${dollars(listPriceCents(plan))}.`);
      fixedCents[plan] = cents;
    }
    doc.kind = "fixed";
    doc.fixedCents = fixedCents;
  } else {
    const pct = Math.round(Number(data?.percentOff));
    if (!Number.isFinite(pct) || pct < 1 || pct > 99) throw new HttpsError("invalid-argument", "Percent off must be between 1 and 99. For a free account, issue a comp.");
    doc.kind = "percent";
    doc.percentOff = pct;
  }
  const max = Math.round(Number(data?.maxRedemptions));
  if (Number.isFinite(max) && max > 0) doc.maxRedemptions = max;
  if (data?.expiresAt) {
    const t = Date.parse(String(data.expiresAt).length === 10 ? `${data.expiresAt}T23:59:59Z` : data.expiresAt);
    if (!Number.isFinite(t) || t < Date.now()) throw new HttpsError("invalid-argument", "The expiry date must be in the future.");
    doc.expiresAt = Timestamp.fromMillis(t);
  }
  const ref = db.collection("promoCodes").doc(code);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw new HttpsError("already-exists", "That code already exists.");
    tx.set(ref, doc);
  });
  logger.info("Promo created", { code, by: adminEmail });
  return { ok: true, code };
}

/**
 * Why this account cannot take a comp of this kind, or null if it can.
 * A comp never replaces something the customer paid for, except that a
 * lifetime comp supersedes a monthly/annual subscription (which is cancelled).
 */
function compBlocker(prev: FirebaseFirestore.DocumentData, kind: "lifetime" | "until"): string | null {
  const paying = !prev.comp && (prev.tier === "pro-lifetime" || hasLiveRecurring(prev));
  if (prev.tier === "pro-lifetime" && !prev.comp) return "This account already has lifetime Pro.";
  if (prev.tier === "pro-lifetime" && prev.comp && kind === "until") return "This account already has complimentary lifetime Pro.";
  if (kind === "until" && paying) return "This account has a paid subscription. It has to end before a complimentary period can start.";
  return null;
}

/** The profile fields that make an account a comp. */
function compFields(uid: string, email: string, kind: "lifetime" | "until", until: Date | null, by: string) {
  return {
    userId: uid,
    email,
    tier: kind === "lifetime" ? "pro-lifetime" : "pro-annual",
    comp: true,
    compBy: by,
    compAt: FieldValue.serverTimestamp(),
    // No Square subscription sits behind a comp, so webhooks never touch it.
    subscriptionId: "",
    // "canceling" makes the app show an end date and no cancel button.
    subscriptionStatus: kind === "lifetime" ? "active" : "canceling",
    pricingPlan: kind === "lifetime" ? "Complimentary lifetime" : "Complimentary Pro",
    ...expiryFields(kind === "lifetime" ? expiryForPlan("lifetime") : (until as Date)),
    promoRevertPending: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/** A lifetime comp replaces a paid subscription: stop it renewing first. */
async function cancelPaidSubscriptionForComp(prev: FirebaseFirestore.DocumentData, uid: string) {
  if (!prev.comp && hasLiveRecurring(prev) && prev.subscriptionId && prev.subscriptionStatus !== "canceling") {
    try {
      await squareClient().subscriptionsApi.cancelSubscription(prev.subscriptionId);
    } catch (e: any) {
      logger.error("Comp: could not cancel paid subscription", { uid, message: e?.message });
      throw new HttpsError("internal", "The existing paid subscription could not be cancelled, so the complimentary access was not applied.");
    }
  }
}

/**
 * Callable: redeem a complimentary promo code. No card and no Square call
 * (other than cancelling a subscription a lifetime pass replaces).
 */
export const redeemCompCode = onCall(
  { region: "us-central1", secrets: [SQUARE_ACCESS_TOKEN], cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const email = request.auth.token.email ?? "";
    const quote = await quotePromo(request.data?.code, "annual", uid);
    if (!quote.comp) throw new HttpsError("failed-precondition", "That code is a discount. Use it at checkout.");
    const { kind, until } = quote.comp;

    const userRef = db.collection("users").doc(uid);
    const blocked = compBlocker((await userRef.get()).data() ?? {}, kind);
    if (blocked) throw new HttpsError("failed-precondition", blocked);
    await cancelPaidSubscriptionForComp((await userRef.get()).data() ?? {}, uid);

    // Count the use and grant access together, so a limited code can never
    // be redeemed more times than its limit, or twice by one account.
    const promoRef = db.collection("promoCodes").doc(quote.code);
    const useRef = promoRef.collection("redemptions").doc(uid);
    await db.runTransaction(async (tx) => {
      const [promoSnap, useSnap] = await Promise.all([tx.get(promoRef), tx.get(useRef)]);
      const d = promoSnap.data() ?? {};
      if (!promoSnap.exists || d.active === false) throw new HttpsError("not-found", "That promo code isn't valid.");
      if (useSnap.exists) throw new HttpsError("failed-precondition", "You've already used that promo code.");
      if (d.maxRedemptions && (d.redeemed ?? 0) >= d.maxRedemptions) throw new HttpsError("failed-precondition", "That promo code has been fully used.");
      tx.set(promoRef, { redeemed: FieldValue.increment(1) }, { merge: true });
      tx.set(useRef, { uid, email, plan: kind === "lifetime" ? "comp-lifetime" : "comp-until", priceCents: 0, at: FieldValue.serverTimestamp() });
      tx.set(userRef, { ...compFields(uid, email, kind, until ? new Date(until) : null, `code ${quote.code}`), promoCode: quote.code }, { merge: true });
    });
    logger.info("Comp code redeemed", { uid, code: quote.code, kind });
    return { success: true, kind, until };
  }
);

async function adminGrantComp(data: any, adminEmail: string) {
  const email = String(data?.email ?? "").trim().toLowerCase();
  if (!email) throw new HttpsError("invalid-argument", "Enter the account's email.");
  let target;
  try {
    target = await getAuth().getUserByEmail(email);
  } catch {
    throw new HttpsError("not-found", "No palette account uses that email yet. Ask them to sign up first, then issue the comp.");
  }
  const ref = db.collection("users").doc(target.uid);
  const prev = (await ref.get()).data() ?? {};
  const kind = data?.kind === "lifetime" ? "lifetime" : "until";
  const blocked = compBlocker(prev, kind);
  if (blocked) throw new HttpsError("failed-precondition", blocked);

  let until: Date | null = null;
  if (kind === "until") {
    until = new Date(`${String(data?.until ?? "").slice(0, 10)}T23:59:59Z`);
    if (Number.isNaN(until.getTime()) || until.getTime() < Date.now()) throw new HttpsError("invalid-argument", "Pick an end date in the future.");
  }
  await cancelPaidSubscriptionForComp(prev, target.uid);
  await ref.set(compFields(target.uid, email, kind, until, adminEmail), { merge: true });
  logger.info("Comp granted", { uid: target.uid, kind, by: adminEmail });
  return { ok: true };
}

async function adminRevokeComp(data: any, adminEmail: string) {
  const uid = String(data?.uid ?? "");
  if (!uid) throw new HttpsError("invalid-argument", "Missing account.");
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.get("comp") !== true) throw new HttpsError("failed-precondition", "That account is not on a comp. Paid plans are cancelled by the customer or in Square.");
  await ref.set(
    {
      tier: "free",
      comp: FieldValue.delete(),
      subscriptionStatus: "cancelled",
      pricingPlan: "",
      ...expiryFields(new Date()),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  logger.info("Comp revoked", { uid, by: adminEmail });
  return { ok: true };
}

export const adminApi = onCall(
  { region: "us-central1", secrets: [SQUARE_ACCESS_TOKEN], cors: true, timeoutSeconds: 120 },
  async (request) => {
    const adminEmail = requireAdmin(request as any);
    const action = String(request.data?.action ?? "");
    const data = request.data ?? {};
    try {
      switch (action) {
        case "whoami": {
          // Admins always have Pro: one without a plan of their own is given
          // complimentary lifetime access the first time they are recognised.
          const uid = request.auth!.uid;
          const ref = db.collection("users").doc(uid);
          const prev = (await ref.get()).data() ?? {};
          const hasPro = prev.tier === "pro-lifetime" || hasLiveRecurring(prev);
          if (!hasPro) {
            await ref.set(compFields(uid, adminEmail, "lifetime", null, "admin account"), { merge: true });
            logger.info("Admin comp applied", { uid, email: adminEmail });
          }
          return { admin: true, email: adminEmail, comped: !hasPro };
        }
        case "users":
          return await adminUsers();
        case "revenue":
          return await adminRevenue(Math.min(366, Math.max(1, Math.round(Number(data.days) || 90))));
        case "promos":
          return await adminListPromos();
        case "createPromo":
          return await adminCreatePromo(data, adminEmail);
        case "setPromoActive": {
          const code = cleanCode(data.code);
          const ref = db.collection("promoCodes").doc(code);
          if (!(await ref.get()).exists) throw new HttpsError("not-found", "No such code.");
          await ref.set({ active: data.active === true }, { merge: true });
          return { ok: true };
        }
        case "grantComp":
          return await adminGrantComp(data, adminEmail);
        case "revokeComp":
          return await adminRevokeComp(data, adminEmail);
        default:
          throw new HttpsError("invalid-argument", "Unknown action.");
      }
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      const squareErrors = err?.result?.errors;
      logger.error("adminApi failed", {
        action,
        message: err?.message,
        errors: squareErrors?.map((x: any) => ({ category: x.category, code: x.code, detail: x.detail })),
      });
      throw new HttpsError("internal", squareErrors?.[0]?.detail || err?.message || "Something went wrong.");
    }
  }
);
