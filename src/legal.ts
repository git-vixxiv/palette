// Facts the legal pages are built from. Change them here and every page follows.
// The three marked TODO are placeholders until confirmed by the owner.
export const LEGAL = {
  product: "palette",
  // TODO: the registered legal name of the business (for example "vixxiv, LLC").
  operator: "vixxiv",
  site: "https://palette.vixxiv.com",
  // TODO: a monitored contact address. Until one is set, pages point to vixxiv.com.
  contactEmail: "",
  contactUrl: "https://vixxiv.com",
  // TODO: the US state whose law governs the terms (for example "Ohio").
  governingState: "",
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
