/**
 * Amplitude, loaded after the app is on screen.
 *
 * The SDK (analytics, autocapture, session replay) is large. Importing it at
 * the top of the app made every visitor download and run it before anything
 * else could happen, including restoring their sign-in. It is now fetched in
 * the background once the page is idle; calls made before it arrives wait.
 */
type Amplitude = typeof import("@amplitude/unified");

let loading: Promise<Amplitude | null> | null = null;

function load(): Promise<Amplitude | null> {
  if (loading) return loading;
  const key = import.meta.env.VITE_AMPLITUDE_API_KEY;
  if (!key) {
    console.error("[amplitude] VITE_AMPLITUDE_API_KEY is not set — no events will be sent");
    loading = Promise.resolve(null);
    return loading;
  }
  loading = import("@amplitude/unified")
    .then((amp) => {
      amp.initAll(key, {
        serverZone: "US",
        analytics: { autocapture: true },
        sessionReplay: { sampleRate: 1 },
      });
      return amp;
    })
    .catch(() => null); // blocked or offline: the app carries on without analytics
  return loading;
}

/** Start analytics once the browser has a quiet moment. */
export function initAnalytics() {
  const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => void);
  if (idle) idle(() => void load(), { timeout: 4000 });
  else setTimeout(() => void load(), 1500);
}

export function track(event: string, properties?: Record<string, unknown>) {
  void load().then((amp) => amp?.track(event, properties));
}
