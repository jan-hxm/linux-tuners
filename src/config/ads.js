/**
 * AdSense configuration.
 *
 * Values come from Vite-injected env vars (`VITE_*` are exposed to the client
 * at build time). Keep them empty in development — the AdSlot component
 * renders a labelled placeholder when no publisher ID is configured, so we
 * can plan slot positions without showing real ads.
 *
 * To enable ads in a production build, set the env vars in `.env.local`:
 *   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
 *   VITE_ADSENSE_SLOT_LANDING=XXXXXXXXXX
 *   VITE_ADSENSE_SLOT_SWAP=XXXXXXXXXX
 *
 * See `.env.example` and the AdSense console (https://www.google.com/adsense)
 * for how to obtain these values.
 */

export const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT ?? ''

/**
 * Slot ID lookup. Each placement in the app passes a slot key to <AdSlot>;
 * adding a new slot means adding a key here + setting the corresponding env var.
 */
export const AD_SLOTS = {
  landing: import.meta.env.VITE_ADSENSE_SLOT_LANDING ?? '',
  swap: import.meta.env.VITE_ADSENSE_SLOT_SWAP ?? '',
}

/**
 * True only when both a publisher ID exists. The CookieBanner is hidden when
 * `false` — there's nothing to consent to, so showing a banner would be both
 * misleading and a UX nuisance.
 */
export function adsEnabled() {
  return Boolean(ADSENSE_CLIENT)
}
