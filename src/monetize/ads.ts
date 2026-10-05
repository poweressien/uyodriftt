/** Rewarded ads behind one function. The game never knows which network is live:
 *    adsense : Google AdSense "H5 Games Ads" (web). Needs an approved site and VITE_ADSENSE_CLIENT.
 *    admob   : Google AdMob through Capacitor (Android/iOS wrapper). Needs the @capacitor-community/admob plugin and VITE_ADMOB_REWARDED_ID.
 *    mock    : a fake 5-second ad for development and demos (never active in a production build unless VITE_ADS_MODE=mock).
 *    none    : no network configured. Ad buttons disable themselves and NOTHING is given away. */
import { adsMode, CFG, type AdsMode } from './config';
import { duckForAd } from '../game/systems/Audio';

export type AdResult = 'rewarded' | 'dismissed' | 'unavailable' | 'error';
export const adsAvailable = () => adsMode() !== 'none';
export const adsLabel = (m: AdsMode = adsMode()) => (m === 'mock' ? 'Demo ad' : 'Ad');

// ---- mock provider: AdHost listens here
export interface MockAd { placement: string; done: (watched: boolean) => void }
let mockListener: ((a: MockAd) => void) | null = null;
export const onMockAd = (f: ((a: MockAd) => void) | null) => { mockListener = f; };

let busy = false, last = 0;
/** Shows one rewarded ad. Resolves 'rewarded' ONLY when the network confirms the player watched it to the end. */
export async function showRewarded(placement: string): Promise<AdResult> {
  const mode = adsMode(); if (mode === 'none') return 'unavailable';
  if (busy || Date.now() - last < CFG.adGapMs) return 'unavailable';
  busy = true; duckForAd(true);
  try {
    if (mode === 'mock') return await new Promise<AdResult>(res => { if (!mockListener) return res('unavailable'); mockListener({ placement, done: w => res(w ? 'rewarded' : 'dismissed') }); });
    if (mode === 'adsense') return await adsenseReward(placement);
    return await admobReward();
  } catch { return 'error'; } finally { busy = false; last = Date.now(); duckForAd(false); }
}

// ---- AdSense H5 Games Ads
let adsenseReady: Promise<boolean> | null = null;
function loadAdsense(): Promise<boolean> {
  if (adsenseReady) return adsenseReady;
  adsenseReady = new Promise(res => {
    const w = window as any; w.adsbygoogle = w.adsbygoogle || [];
    w.adBreak = w.adConfig = (o: unknown) => { w.adsbygoogle.push(o); };
    const sc = document.createElement('script'); sc.async = true; sc.crossOrigin = 'anonymous';
    sc.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CFG.adsenseClient)}`;
    if (CFG.adsenseTest) sc.setAttribute('data-adbreak-test', 'on');
    sc.onload = () => { try { w.adConfig({ preloadAdBreaks: 'on', sound: 'on', onReady: () => {} }); } catch { /* ok */ } res(true); }; sc.onerror = () => res(false);
    document.head.appendChild(sc); setTimeout(() => res(false), 8000);
  });
  return adsenseReady;
}
async function adsenseReward(name: string): Promise<AdResult> {
  if (!(await loadAdsense())) { adsenseReady = null; return 'unavailable'; }
  const w = window as any;
  return new Promise<AdResult>(res => {
    let viewed = false, settled = false, showFn: (() => void) | null = null; const end = (r: AdResult) => { if (!settled) { settled = true; res(r); } };
    const guard = setTimeout(() => end('unavailable'), 15000);
    w.adBreak({
      type: 'reward', name: name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40),
      beforeAd: () => duckForAd(true), afterAd: () => duckForAd(false),
      beforeReward: (show: () => void) => { showFn = show; show(); },
      adViewed: () => { viewed = true; }, adDismissed: () => end('dismissed'),
      adBreakDone: (info: { breakStatus?: string }) => { clearTimeout(guard); if (viewed) end('rewarded'); else end(info?.breakStatus === 'viewed' ? 'rewarded' : info?.breakStatus === 'dismissed' ? 'dismissed' : 'unavailable'); void showFn; },
    });
  });
}

// ---- AdMob via Capacitor (@capacitor-community/admob registers itself as Capacitor.Plugins.AdMob)
let admobInit: Promise<void> | null = null;
async function admobReward(): Promise<AdResult> {
  const A = (window as any).Capacitor?.Plugins?.AdMob; if (!A) return 'unavailable';
  if (!admobInit) admobInit = A.initialize({}).then(() => undefined);
  await admobInit;
  await A.prepareRewardVideoAd({ adId: CFG.admobRewardedId, isTesting: CFG.admobTest });
  const r = await A.showRewardVideoAd(); // resolves with the reward item once the video is completed
  return r && (r.amount !== undefined || r.type !== undefined) ? 'rewarded' : 'dismissed';
}
