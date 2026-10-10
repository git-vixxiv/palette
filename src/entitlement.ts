/**
 * What palette unlocks, decided from the vixxiv-id ID token.
 *
 * ADR-0001 Brief 2: "read tier/client from the ID token and gate features".
 * The entitlement itself (tools = client || tier >= gold) comes from the hub's
 * shared module and is never re-derived here. This file only maps that one
 * boolean onto palette's features, and maps the ratified `status` vocabulary
 * (ADR-0001 §10, gap 2) onto what the account menu says.
 *
 * Pure and dependency-free so it runs under `node --test` (tests/unit).
 */

import { entitlementFromToken, type Entitlement } from "./vendor/vixxiv-auth.js";

export type { Entitlement };

/** Signed out, or signed in with no tool access. */
export const NO_ENTITLEMENT: Entitlement = {
  tier: "none",
  client: false,
  tools: false,
  admin: false,
  uid: null,
};

export { entitlementFromToken };

export type HarmonyName =
  | "analogous"
  | "monochromatic"
  | "complementary"
  | "triadic"
  | "tetradic"
  | "split"
  | "random";

/** Harmonies that need tool access. Unchanged from palette's previous Pro gate. */
export const MEMBER_HARMONIES: ReadonlyArray<HarmonyName> = [
  "analogous",
  "complementary",
  "triadic",
  "tetradic",
  "split",
];

export interface Features {
  /** Most colour columns allowed in the workbench. */
  maxColumns: number;
  /** May use the MEMBER_HARMONIES. */
  memberHarmonies: boolean;
  /** Palettes are stored in vixxiv-id (Firestore database `palette`). */
  cloudVault: boolean;
  /** Most palettes kept in this browser when there is no cloud vault. */
  maxLocalSaves: number;
}

/**
 * The preview limits (5 columns, 2 harmonies, 2 browser-only saves) are the
 * limits palette's old free tier had. Whether a non-member should get this
 * preview at all is open — ADR-0001 R4 says "no free tier" and R4/R15 leave
 * trial mechanics undecided. See docs/BRIEF-2-PALETTE.md, contract gap G3.
 */
export function featuresFor(ent: Entitlement): Features {
  if (ent.tools) {
    return { maxColumns: 10, memberHarmonies: true, cloudVault: true, maxLocalSaves: 0 };
  }
  return { maxColumns: 5, memberHarmonies: false, cloudVault: false, maxLocalSaves: 2 };
}

export function harmonyAllowed(mode: HarmonyName, f: Features): boolean {
  return f.memberHarmonies || !MEMBER_HARMONIES.includes(mode);
}

/* ------------------------------------------------------------- status -- */

/** Ratified 2026-09-06, ADR-0001 §10 gap 2. Read verbatim. */
export const STATUSES = ["none", "active", "past_due", "canceling", "canceled"] as const;
export type Status = (typeof STATUSES)[number];

export function asStatus(value: unknown): Status {
  return (STATUSES as ReadonlyArray<string>).includes(value as string) ? (value as Status) : "none";
}

export interface StatusNotice {
  status: Status;
  tone: "ok" | "warn" | "info" | "none";
  label: string;
  detail: string | null;
}

function fmt(d: Date | null): string | null {
  return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;
}

/**
 * What to tell the member about their membership. Display only: access is
 * decided by the token's tier/client claims, never by `status`.
 */
export function statusNotice(
  raw: unknown,
  opts: { currentPeriodEnd?: Date | null; graceUntil?: Date | null; client?: boolean } = {}
): StatusNotice {
  const status = asStatus(raw);
  const end = fmt(opts.currentPeriodEnd ?? null);
  const grace = fmt(opts.graceUntil ?? null);
  switch (status) {
    case "active":
      return { status, tone: "ok", label: "Membership active", detail: end ? `Renews ${end}` : null };
    case "past_due":
      return {
        status,
        tone: "warn",
        label: "Payment past due",
        detail: "Update your payment details on vixxiv.com to keep access.",
      };
    case "canceling":
      return { status, tone: "info", label: "Membership ending", detail: end ? `Access ends ${end}` : null };
    case "canceled":
      return {
        status,
        tone: "warn",
        label: "Membership canceled",
        detail: grace ? `Saved palettes are kept until ${grace}, then deleted.` : null,
      };
    default:
      return opts.client
        ? { status, tone: "ok", label: "Client access", detail: null }
        : { status, tone: "none", label: "No membership", detail: null };
  }
}
