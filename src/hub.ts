/**
 * Where palette sends people for things the identity hub owns.
 *
 * Sign-in: the hub's contract (vixxiv-id docs/CONTRACT.md §1) — "Delete the
 * app's own sign-up and sign-in UI. Send unauthenticated users to
 * https://auth.vixxiv.com/?redirect_to=https://<app>.vixxiv.com/<path>".
 *
 * KNOWN GAP (change request CR-1): the hub page signs the user in on ITS
 * origin and redirects back carrying no credential. Firebase Auth state is
 * per-origin, so palette.vixxiv.com still has no session on return. palette
 * cannot fix this without inventing a token hand-off the ADR does not define.
 *
 * Membership: bought on vixxiv.com (ADR-0001 R5). The Tools page URL is not
 * defined yet (gap G2), so it is configuration.
 */

const env = import.meta.env;

/** auth.vixxiv.com once DNS exists; the deployed hub site until then. */
export const HUB_SIGN_IN_URL: string =
  env.VITE_HUB_SIGN_IN_URL || "https://auth.vixxiv.com/";

/** Where membership is sold. Placeholder until the Tools page exists. */
export const MEMBERSHIP_URL: string = env.VITE_MEMBERSHIP_URL || "https://vixxiv.com/";

/** Build the hub sign-in URL that returns the user to `returnTo`. */
export function signInUrl(returnTo: string, base: string = HUB_SIGN_IN_URL): string {
  const url = new URL(base);
  url.searchParams.set("redirect_to", returnTo);
  return url.toString();
}
