/**
 * vixxiv-id shared client module.
 *
 * The contract every vixxiv surface uses: read entitlement off the ID token,
 * force a refresh when billing moves, and hand the token to WordPress to get a
 * WP session. Brief 2 agents import THIS FILE rather than re-implementing it.
 *
 * It is dependency-free and DOM-free on purpose: the Firebase objects are
 * passed in, so the same module runs in the browser and under Node in the
 * emulator tests (tests/entitlement.test.mjs).
 *
 * NOTE: unlocksTools() below duplicates functions/src/tiers.ts. The two must
 * stay identical. The server copy is authoritative; this one is a convenience
 * for UI gating and must never be the only check on a privileged action.
 */

export const TIERS = ["platinum", "gold", "black"];
export const TIER_RANK = { none: 0, platinum: 1, gold: 2, black: 3 };
export const TOOL_TIER_FLOOR = "gold"; // ADR-0001 D4 — the top two.

export function unlocksTools(tier, client) {
  const rank = TIER_RANK[tier] ?? 0;
  return client === true || rank >= TIER_RANK[TOOL_TIER_FLOOR];
}

/** Entitlement as the apps see it, straight from a decoded ID token result. */
export function entitlementFromToken(tokenResult) {
  const claims = tokenResult?.claims ?? {};
  const tier = TIER_RANK[claims.tier] !== undefined ? claims.tier : "none";
  const client = claims.client === true;
  return {
    tier,
    client,
    tools: unlocksTools(tier, client),
    admin: claims.admin === true,
    uid: claims.user_id ?? claims.sub ?? null,
  };
}

/**
 * Post a Firebase ID token to the WordPress session endpoint and get a WP
 * session cookie back. `fetchImpl` is injectable for tests.
 */
export async function createWordPressSession({
  idToken,
  endpoint,
  redirectTo = null,
  fetchImpl = globalThis.fetch,
}) {
  if (!idToken) throw new Error("idToken is required");
  if (!endpoint) throw new Error("endpoint is required");
  const res = await fetchImpl(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken, redirect_to: redirectTo }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(body?.message || `Session exchange failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Force-refresh the ID token whenever billing moves.
 *
 * ADR-0001 Brief 1 item 3: "force token refresh on the client after billing
 * events." syncCustomClaims stamps users/{uid}.claimsSyncedAt after it writes
 * the claims; this watches that field and refreshes, so a tier change lands in
 * the client in about a second instead of up to an hour.
 *
 * Pass the modular SDK's own functions so this module imports nothing:
 *   watchEntitlement({ user, docRef, onSnapshot, onChange })
 * Returns an unsubscribe function.
 */
export function watchEntitlement({ user, docRef, onSnapshot, onChange }) {
  let lastSynced = null;
  return onSnapshot(docRef, async (snap) => {
    const data = snap.data ? snap.data() : null;
    if (!data) return;
    const synced = data.claimsSyncedAt?.toMillis?.() ?? data.claimsSyncedAt ?? null;
    const first = lastSynced === null;
    if (!first && synced === lastSynced) return;
    lastSynced = synced;
    const tokenResult = await user.getIdTokenResult(true); // force refresh
    onChange(entitlementFromToken(tokenResult), data);
  });
}

/**
 * Cross-origin session binding.
 *
 * auth.vixxiv.com and vixxiv.com are different origins, so a `fetch` with
 * credentials would ask the browser to set a THIRD-PARTY cookie — blocked by
 * default in current browsers. A top-level form POST navigates the browser to
 * vixxiv.com instead, so WordPress sets its auth cookie first-party and the
 * endpoint answers 303 to the page the user asked for.
 *
 * `doc` is injectable so this is testable without a browser.
 */
export function postSessionForm({
  idToken,
  endpoint,
  redirectTo = "",
  doc = globalThis.document,
  submit = true,
}) {
  if (!idToken) throw new Error("idToken is required");
  if (!endpoint) throw new Error("endpoint is required");
  const form = doc.createElement("form");
  form.method = "POST";
  form.action = endpoint;
  form.style.display = "none";
  for (const [name, value] of [
    ["id_token", idToken],
    ["redirect_to", redirectTo || ""],
    ["mode", "redirect"],
  ]) {
    const input = doc.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  if (submit) form.submit();
  return form;
}

/** True when the endpoint is on another origin and needs the form binding. */
export function needsFormBinding(endpoint, origin = globalThis.location?.origin) {
  try {
    return new URL(endpoint, origin).origin !== origin;
  } catch {
    return true;
  }
}
