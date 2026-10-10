/**
 * Types for ./vixxiv-auth.js.
 *
 * vixxiv-auth.js is a BYTE-IDENTICAL copy of the identity hub's shared client
 * module (git-vixxiv/vixxiv-id, hosting/shared/vixxiv-auth.js). The hub's
 * contract (docs/CONTRACT.md §2) says to import it from
 * https://auth.vixxiv.com/shared/vixxiv-auth.js, but that file is served
 * without an Access-Control-Allow-Origin header, so a browser on
 * palette.vixxiv.com cannot import it cross-origin. Until the hub serves it
 * with CORS (change request CR-2), palette vendors it and `npm run check:hub`
 * fails if the copy drifts from the hub's source.
 *
 * Never edit vixxiv-auth.js by hand. Re-copy it from the hub.
 */

export type Tier = "none" | "platinum" | "gold" | "black";

export interface Entitlement {
  tier: Tier;
  client: boolean;
  tools: boolean;
  admin: boolean;
  uid: string | null;
}

export const TIERS: ReadonlyArray<Exclude<Tier, "none">>;
export const TIER_RANK: Record<Tier, number>;
export const TOOL_TIER_FLOOR: "gold";

export function unlocksTools(tier: string, client: boolean): boolean;
export function entitlementFromToken(tokenResult: { claims?: Record<string, unknown> } | null | undefined): Entitlement;

export function watchEntitlement(args: {
  user: { getIdTokenResult(forceRefresh?: boolean): Promise<{ claims: Record<string, unknown> }> };
  docRef: unknown;
  onSnapshot: (ref: any, cb: (snap: any) => void) => () => void;
  onChange: (ent: Entitlement, data: Record<string, any>) => void;
}): () => void;
