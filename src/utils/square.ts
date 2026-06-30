/**
 * Square Web Payments SDK loader + config (frontend).
 *
 * The Application ID and Location ID are *publishable* values (safe in the
 * browser). The Square access token is NOT here — it lives only in Cloud
 * Functions secrets. Card data is entered into Square's hosted iframe and
 * never touches our code, which keeps us out of PCI scope.
 *
 * Set these in a root .env.local (see .env.example):
 *   VITE_SQUARE_APP_ID
 *   VITE_SQUARE_LOCATION_ID
 *   VITE_SQUARE_ENV   ("sandbox" | "production")
 */

export const SQUARE_APP_ID = import.meta.env.VITE_SQUARE_APP_ID as string | undefined;
export const SQUARE_LOCATION_ID = import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined;
export const SQUARE_ENV = (import.meta.env.VITE_SQUARE_ENV as string) || "sandbox";

export const isSquareConfigured = !!(SQUARE_APP_ID && SQUARE_LOCATION_ID);

const SDK_URL =
  SQUARE_ENV === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";

let sdkPromise: Promise<any> | null = null;

/** Lazily inject the Square Web Payments SDK and resolve the global `Square`. */
export function loadSquareSdk(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if ((window as any).Square) return Promise.resolve((window as any).Square);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).Square));
      existing.addEventListener("error", () => reject(new Error("Failed to load Square SDK")));
      if ((window as any).Square) resolve((window as any).Square);
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve((window as any).Square);
    script.onerror = () => reject(new Error("Failed to load Square SDK"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/**
 * Initialise Square Payments + a Card payment method, attach it to the given
 * container element, and return the live `card` instance ready for tokenize().
 */
export async function initSquareCard(containerId: string): Promise<any> {
  if (!isSquareConfigured) {
    throw new Error("Square is not configured (missing VITE_SQUARE_APP_ID / VITE_SQUARE_LOCATION_ID).");
  }
  const Square = await loadSquareSdk();
  const payments = Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
  const card = await payments.card();
  await card.attach(`#${containerId}`);
  return card;
}
