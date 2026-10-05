import { isNative } from './monetize/config';
/** Thin bridge to the Capacitor shell. Every call is a no-op on the web, and the plugins load lazily so the web bundle stays small. */
type Off = () => void;
export async function initNative() {
  if (!isNative()) return;
  try { const { StatusBar } = await import('@capacitor/status-bar'); await StatusBar.hide(); } catch { /* optional */ }
}
export function onBackButton(cb: () => void): Off {
  if (!isNative()) return () => {};
  let off: Off | null = null, dead = false;
  void import('@capacitor/app').then(({ App }) => App.addListener('backButton', () => cb())).then(h => { if (dead) void h.remove(); else off = () => void h.remove(); }).catch(() => {});
  return () => { dead = true; off?.(); };
}
/** Fires with false when the app goes to the background (home button, call, screen off). */
export function onAppActive(cb: (active: boolean) => void): Off {
  const vis = () => cb(!document.hidden); document.addEventListener('visibilitychange', vis);
  let off: Off | null = null, dead = false;
  if (isNative()) void import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', s => cb(s.isActive))).then(h => { if (dead) void h.remove(); else off = () => void h.remove(); }).catch(() => {});
  return () => { dead = true; document.removeEventListener('visibilitychange', vis); off?.(); };
}
export async function exitApp(): Promise<boolean> {
  if (!isNative()) return false;
  try { const { App } = await import('@capacitor/app'); await App.exitApp(); return true; } catch { return false; }
}
