// Facts the legal pages are built from. Change them here and every page follows.
export const LEGAL = {
  product: "palette",
  // The legal entity that operates the product, and where it is based.
  operator: "DOru LLC",
  operatorLocation: "Austin, Texas",
  // The brand the product is published under. DOru LLC is its parent company.
  brand: "vixxiv",
  site: "https://palette.vixxiv.com",
  contactEmail: "contact@vixxiv.com",
  contactUrl: "https://vixxiv.com",
  governingState: "Texas",
  venue: "Travis County, Texas",
  effective: "November 27, 2026",
};

export type LegalDoc = "terms" | "privacy" | "refunds";

export const LEGAL_PATHS: Record<LegalDoc, string> = {
  terms: "/terms",
  privacy: "/privacy",
  refunds: "/refunds",
};

export const LEGAL_TITLES: Record<LegalDoc, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  refunds: "Refunds & Cancellation",
};

/** Which legal page, if any, the current address is asking for. */
export function legalDocFromPath(pathname: string): LegalDoc | null {
  const p = pathname.replace(/\/+$/, "").toLowerCase();
  if (p === "/terms") return "terms";
  if (p === "/privacy") return "privacy";
  if (p === "/refunds" || p === "/refund" || p === "/cancel") return "refunds";
  return null;
}

/**
 * Sign-ins that are shown the Admin link and are comped automatically. This
 * only controls what the page shows; the server holds the real list
 * (ADMIN_EMAILS in functions/.env) and checks it on every admin request.
 */
export const ADMIN_EMAILS = ["joe@vixxiv.com", "amvp123@gmail.com"];
export const isAdminEmail = (email?: string | null) => ADMIN_EMAILS.includes((email || "").toLowerCase());
