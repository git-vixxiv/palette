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

export const SQUARE_LOAD_ERROR =
  "Couldn't reach Square's secure payment form. Check your connection, pause any ad or tracker blocker for this site, then try again.";

/** One attempt at injecting the SDK script, with a timeout. */
function injectSdkOnce(): Promise<any> {
  return new Promise((resolve, reject) => {
    // A script tag left over from a failed attempt will never fire again.
    document.querySelectorAll<HTMLScriptElement>(`script[src^="${SDK_URL}"]`).forEach((el) => el.remove());
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error(SQUARE_LOAD_ERROR));
    };
    const timer = setTimeout(fail, 15000);
    script.onload = () => {
      clearTimeout(timer);
      if ((window as any).Square) resolve((window as any).Square);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
}

/**
 * Lazily load the Square Web Payments SDK and resolve the global `Square`.
 * A failed load is retried twice with a short pause, and a final failure is
 * not remembered, so the next call (for example a "Try again" button) starts
 * fresh without a page reload.
 */
export function loadSquareSdk(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if ((window as any).Square) return Promise.resolve((window as any).Square);
  if (sdkPromise) return sdkPromise;

  const attempt = (async () => {
    let lastError: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        return await injectSdkOnce();
      } catch (err) {
        lastError = err;
        if (i < 2) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
    }
    throw lastError;
  })();
  sdkPromise = attempt;
  attempt.catch(() => {
    if (sdkPromise === attempt) sdkPromise = null;
  });
  return attempt;
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
