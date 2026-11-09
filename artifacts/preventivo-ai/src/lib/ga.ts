// GA4 events from the browser. index.html defines `gtag` everywhere but only
// configures and loads the tag on prevai.it / www.prevai.it, so on localhost,
// staging and previews these calls queue into a dataLayer that never ships.
// `purchase` is not sent from here: the Stripe webhook sends it server-side
// (api-server/src/lib/ga4.ts) so a closed tab after payment still counts.

export type GaEvent = "sign_up" | "quote_created" | "quote_shared";

type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

export function gaEvent(name: GaEvent, params: Record<string, unknown> = {}): void {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof gtag === "function") gtag("event", name, params);
  } catch {
    // analytics never breaks the page
  }
}
