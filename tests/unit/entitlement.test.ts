/**
 * Done-criterion 2: features gate on the token's tier/client claims, and
 * `status` is read with the ratified vocabulary (ADR-0001 §10 gap 2).
 * Runs under Node's built-in type stripping: `node --test tests/unit/`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  entitlementFromToken, featuresFor, harmonyAllowed, statusNotice, asStatus, STATUSES, NO_ENTITLEMENT,
} from "../../src/entitlement.ts";
import { signInUrl } from "../../src/hub.ts";

const tok = (claims: Record<string, unknown>) => ({ claims });

test("tool access follows the hub rule: client || tier >= gold", () => {
  const cases: Array<[Record<string, unknown>, boolean]> = [
    [{}, false],
    [{ tier: "none" }, false],
    [{ tier: "platinum" }, false],
    [{ tier: "gold" }, true],
    [{ tier: "black" }, true],
    [{ tier: "none", client: true }, true],
    [{ tier: "platinum", client: true }, true],
    [{ tier: "gold", client: false }, true],
    [{ tier: "diamond" }, false],          // unknown tier is not a tier
    [{ tier: "gold", client: "true" }, true], // string client ignored; gold still counts
    [{ tier: "none", client: "true" }, false],
    [{ tools: true }, false],              // palette never trusts a bare `tools` claim
  ];
  for (const [claims, expected] of cases) {
    assert.equal(entitlementFromToken(tok(claims)).tools, expected, JSON.stringify(claims));
  }
});

test("members get the full lab; everyone else gets the preview", () => {
  const gold = featuresFor(entitlementFromToken(tok({ tier: "gold" })));
  assert.deepEqual(gold, { maxColumns: 10, memberHarmonies: true, cloudVault: true, maxLocalSaves: 0 });
  const plat = featuresFor(entitlementFromToken(tok({ tier: "platinum" })));
  assert.deepEqual(plat, { maxColumns: 5, memberHarmonies: false, cloudVault: false, maxLocalSaves: 2 });
  assert.deepEqual(featuresFor(NO_ENTITLEMENT), plat);
  assert.equal(featuresFor(entitlementFromToken(tok({ client: true }))).cloudVault, true);
});

test("harmony gate", () => {
  const preview = featuresFor(NO_ENTITLEMENT);
  const full = featuresFor(entitlementFromToken(tok({ tier: "black" })));
  for (const m of ["analogous", "complementary", "triadic", "tetradic", "split"] as const) {
    assert.equal(harmonyAllowed(m, preview), false, m);
    assert.equal(harmonyAllowed(m, full), true, m);
  }
  assert.equal(harmonyAllowed("monochromatic", preview), true);
  assert.equal(harmonyAllowed("random", preview), true);
});

test("status vocabulary is exactly the ratified five", () => {
  assert.deepEqual([...STATUSES], ["none", "active", "past_due", "canceling", "canceled"]);
  for (const s of STATUSES) assert.equal(asStatus(s), s);
  // palette's old vocabulary and anything else is not a status.
  for (const s of ["cancelled", "deactivated", "ACTIVE", "", null, undefined, 3]) {
    assert.equal(asStatus(s), "none", String(s));
  }
});

test("status is displayed verbatim per value", () => {
  const end = new Date("2026-11-10T00:00:00Z");
  const grace = new Date("2026-12-09T00:00:00Z");
  assert.equal(statusNotice("active", { currentPeriodEnd: end }).tone, "ok");
  assert.equal(statusNotice("past_due").tone, "warn");
  assert.match(statusNotice("canceling", { currentPeriodEnd: end }).detail ?? "", /Access ends/);
  assert.match(statusNotice("canceled", { graceUntil: grace }).detail ?? "", /kept until/);
  assert.equal(statusNotice("none").label, "No membership");
  assert.equal(statusNotice("none", { client: true }).label, "Client access");
  assert.equal(statusNotice("bogus").status, "none");
});

test("sign-in goes to the hub with redirect_to", () => {
  const u = new URL(signInUrl("https://palette.vixxiv.com/?x=1#y"));
  assert.equal(u.origin, "https://auth.vixxiv.com");
  assert.equal(u.searchParams.get("redirect_to"), "https://palette.vixxiv.com/?x=1#y");
  const v = new URL(signInUrl("https://palette.vixxiv.com/", "https://vixxiv-id-auth.web.app/"));
  assert.equal(v.host, "vixxiv-id-auth.web.app");
});
