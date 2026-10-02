/** Tilt steering. Works in any screen orientation by projecting gravity onto the screen plane, so it behaves like a steering wheel
 *  held upright OR a tablet tilted flat. Sign convention: tilt/turn right = positive. */
const D2R = Math.PI / 180, R2D = 180 / Math.PI, DEAD = 3, FULL = 24;
export const hasTilt = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

/** iOS needs this called from a tap. Android/desktop resolve true straight away. */
export async function requestTilt(): Promise<boolean> {
  const D = (window as any).DeviceOrientationEvent;
  if (!D) return false;
  if (typeof D.requestPermission === 'function') { try { return (await D.requestPermission()) === 'granted'; } catch { return false; } }
  return true;
}

export const screenAngle = () => (((screen.orientation?.angle ?? (window as any).orientation ?? 0) as number) + 360) % 360;
/** Roll angle in degrees (right positive) from deviceorientation beta/gamma for a given screen angle. */
export function rollFrom(beta: number, gamma: number, ang: number): number {
  const b = beta * D2R, g = gamma * D2R, dx = -Math.cos(b) * Math.sin(g), dy = Math.sin(b), dz = Math.cos(b) * Math.cos(g); // world "up" in device axes
  let sx = dx, sy = dy;
  if (ang === 90) { sx = -dy; sy = dx; } else if (ang === 270) { sx = dy; sy = -dx; } else if (ang === 180) { sx = -dx; sy = -dy; }
  return Math.atan2(-sx, Math.hypot(sy, dz)) * R2D;
}
export const tiltToSteer = (deg: number) => { const a = Math.abs(deg); if (a <= DEAD) return 0; return Math.sign(deg) * Math.pow(Math.min(1, (a - DEAD) / (FULL - DEAD)), .85); };

class Tilt {
  value = 0; got = false; private raw = 0; private neutral = 0; private on = false;
  private handler = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    const a = rollFrom(e.beta, e.gamma, screenAngle());
    if (!this.got) { this.got = true; this.raw = a; this.neutral = a; } else this.raw += (a - this.raw) * .35;
    this.value = tiltToSteer(this.raw - this.neutral); (window as any).__tiltValue = this.value;
  };
  start() { if (this.on || !hasTilt()) return; this.on = true; this.got = false; this.value = 0; window.addEventListener('deviceorientation', this.handler); }
  stop() { if (!this.on) return; this.on = false; window.removeEventListener('deviceorientation', this.handler); this.value = 0; }
  /** Treat the current phone angle as "straight". */
  calibrate() { this.neutral = this.raw; this.value = 0; }
}
export const tilt = new Tilt();
