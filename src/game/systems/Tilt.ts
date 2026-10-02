/** Phone tilt steering (device orientation). Calibrates to however the phone is held when the run starts. */
let raw = 0, neutral: number | null = null, sens = 1, inv = false, on = false;
const angle = () => (((screen.orientation && screen.orientation.angle) ?? (window as any).orientation ?? 0) + 360) % 360;
function onOri(e: DeviceOrientationEvent) { const a = angle(), land = a === 90 || a === 270, v = (land ? e.beta : e.gamma) ?? 0; raw = v * (a === 90 ? -1 : 1); if (neutral === null) neutral = raw; }
export async function startTilt(s: number, invert: boolean): Promise<boolean> {
  sens = s; inv = invert; const D = (window as any).DeviceOrientationEvent; if (!D) return false;
  if (typeof D.requestPermission === 'function') { try { if ((await D.requestPermission()) !== 'granted') return false; } catch { return false; } } // iOS asks once
  if (!on) { window.addEventListener('deviceorientation', onOri); on = true; } neutral = null; return true;
}
export const configureTilt = (s: number, invert: boolean) => { sens = s; inv = invert; };
export const calibrateTilt = () => { neutral = raw; };
export const stopTilt = () => { window.removeEventListener('deviceorientation', onOri); on = false; neutral = null; };
export function tiltValue() { if (neutral === null) return 0; const d = ((raw - neutral) * (inv ? -1 : 1)) / (28 / sens); return Math.abs(d) < .06 ? 0 : Math.max(-1, Math.min(1, d)); }
