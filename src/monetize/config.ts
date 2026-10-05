/** Monetization switches. Everything is driven by VITE_* env vars set at build time (see README). */
const env = (import.meta as any).env ?? {};
const DEV = !!env.DEV;
export type AdsMode = 'mock' | 'adsense' | 'admob' | 'none';
export type PayMode = 'mock' | 'paystack' | 'none';

const cap = () => (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
export const isNative = () => !!cap()?.isNativePlatform?.();

/** Which rewarded-ad provider is live. Production with no keys = 'none' (the ad buttons disable themselves, nothing is given away). */
export function adsMode(): AdsMode {
  const forced = String(env.VITE_ADS_MODE ?? '').toLowerCase();
  if (forced === 'mock' || forced === 'none') return forced;
  if (isNative() && env.VITE_ADMOB_REWARDED_ID) return 'admob';
  if (!isNative() && env.VITE_ADSENSE_CLIENT) return 'adsense';
  return DEV ? 'mock' : 'none';
}
export function payMode(): PayMode {
  const forced = String(env.VITE_PAY_MODE ?? '').toLowerCase();
  if (forced === 'mock' || forced === 'none') return forced;
  // The app cannot confirm a payment without your server, so a native build with no VITE_API_BASE takes no payments at all.
  if (env.VITE_PAYSTACK_KEY) return isNative() && !String(env.VITE_API_BASE ?? '').trim() ? 'none' : 'paystack';
  return DEV ? 'mock' : 'none';
}
export const CFG = {
  adsenseClient: String(env.VITE_ADSENSE_CLIENT ?? ''),
  adsenseTest: String(env.VITE_ADSENSE_TEST ?? '') === '1',
  admobRewardedId: String(env.VITE_ADMOB_REWARDED_ID ?? ''),
  admobTest: String(env.VITE_ADMOB_TEST ?? '') === '1' || DEV,
  paystackKey: String(env.VITE_PAYSTACK_KEY ?? ''),
  apiBase: String(env.VITE_API_BASE ?? '').replace(/\/$/, ''),
  /** Minimum gap between two ads, so a double tap cannot farm rewards. */
  adGapMs: 4000,
};
export const GAS_MAX = 7, GAS_REFILL_MS = 3 * 3600_000, GAS_REFILL_VIP_MS = 90 * 60_000, VIP_COIN_BONUS = 0.25;
