/** Tilt steering. Works in any screen orientation by projecting gravity onto the screen plane, so it behaves like a steering wheel
 *  held upright OR a tablet tilted flat. Sign convention: tilt/turn right = positive.
 *  Reads the raw gravity sensor (devicemotion, no sensor-fusion lag) and falls back to deviceorientation. An adaptive "one euro" filter keeps
 *  the wheel dead steady while the phone is still and almost lag-free the moment it moves; a small rate term makes a quick flick bite instantly. */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const IOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
export const hasTilt = () => typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window);
/** Degrees of tilt for full lock, by sensitivity 1 (soft) .. 3 (sharp). */
export const TILT_FULL = [0, 14, 9, 6];
export const TILT_LABEL = ['', 'Soft', 'Normal', 'Sharp'];

/** iOS needs this called from a tap. Android/desktop resolve true straight away. */
export async function requestTilt(): Promise<boolean> {
  if (!hasTilt()) return false;
  let ok = true;
  for (const D of [(window as any).DeviceMotionEvent, (window as any).DeviceOrientationEvent]) if (D && typeof D.requestPermission === 'function') { try { ok = ok && (await D.requestPermission()) === 'granted'; } catch { ok = false; } }
  return ok;
}

export const screenAngle = () => (((screen.orientation?.angle ?? (window as any).orientation ?? 0) as number) + 360) % 360;
/** Roll angle in degrees (right positive) from the "world up" vector in device axes (x right, y up the screen, z out of the screen) for a given screen angle. */
export function rollFromUp(dx: number, dy: number, dz: number, ang: number): number {
  let sx = dx, sy = dy;
  if (ang === 90) { sx = -dy; sy = dx; } else if (ang === 270) { sx = dy; sy = -dx; } else if (ang === 180) { sx = -dx; sy = -dy; }
  return Math.atan2(-sx, Math.hypot(sy, dz)) * R2D;
}
/** Same, from deviceorientation beta/gamma (degrees). */
export function rollFrom(beta: number, gamma: number, ang: number): number {
  const b = beta * D2R, g = gamma * D2R; return rollFromUp(-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g), ang);
}

/** Adaptive low-pass: cutoff rises with speed of change, so it is smooth when still and quick when moving. */
class OneEuro {
  private x = 0; private dx = 0; private t = 0; private on = false;
  constructor(private minCut = 4.5, private beta = .12, private dCut = 8) {}
  private static a(cut: number, dt: number) { const r = 2 * Math.PI * cut * dt; return r / (r + 1); }
  reset(x: number, t: number) { this.x = x; this.dx = 0; this.t = t; this.on = true; }
  get value() { return this.x; } get rate() { return this.dx; }
  step(v: number, t: number) {
    if (!this.on) { this.reset(v, t); return v; }
    const dt = Math.min(.1, Math.max(.001, t - this.t)); this.t = t;
    this.dx += ((v - this.x) / dt - this.dx) * OneEuro.a(this.dCut, dt);
    const cut = this.minCut + this.beta * Math.abs(this.dx); this.x += (v - this.x) * OneEuro.a(cut, dt); return this.x;
  }
}

/** Pure steering core (no browser APIs) so it can be tested: feed it roll samples, read the steering value -1..1.
 *  Shaped like a real wheel: soft around the middle for fine corrections, firm at the edges for full lock, and speed-sensitive:
 *  the faster you go, the more tilt a given steering angle needs (like a power-steering rack), so the car never feels twitchy at 150 km/h
 *  nor lazy in a car park. Left and right are exactly symmetric. Tap the tilt box (or it auto-centres at GO) to set the middle. */
export class TiltCore {
  value = 0; got = false; sens = 2; neutral = 0; ratio = 0; private f = new OneEuro();
  push(roll: number, t: number) {
    const x = this.f.step(roll, t); if (!this.got) { this.got = true; this.neutral = x;  }
    const full = (TILT_FULL[this.sens] ?? 9) * (1 + .08 * Math.min(1, this.ratio)), dead = .5, rt = this.f.rate;
    const a = x - this.neutral;
    const m = Math.min(1, Math.max(0, Math.abs(a) - dead) / (full - dead));
    const shaped = m * (1.55 - .55 * m);                                                // direct from the first degree, full lock at `full`
    const fr = Math.sign(rt) * Math.max(0, Math.abs(rt) - 30), ff = Math.max(-.3, Math.min(.3, fr * .004 * (9 / full)));   // a real flick leads the angle; tremor never counts
    this.value = Math.max(-1, Math.min(1, Math.sign(a) * shaped + ff));
    return this.value;
  }
  calibrate() { this.neutral = this.f.value; this.value = 0; }
  reset() { this.got = false; this.value = 0; this.f = new OneEuro(); }
}

class Tilt {
  core = new TiltCore(); private on = false; private motion = false;
  get value() { return this.core.value; } get got() { return this.core.got; }
  set sens(n: number) { this.core.sens = n >= 1 && n <= 3 ? n : 2; }
  /** current speed as a fraction of top speed: set by the scene every frame */
  set ratio(r: number) { this.core.ratio = r; }
  private out() { (window as any).__tiltValue = this.core.value; }
  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null || a.z == null) return;
    const g = Math.hypot(a.x, a.y, a.z); if (g < 3) return; const k = IOS ? -1 : 1;                 // iOS reports gravity with the opposite sign to Android
    this.motion = true; this.core.push(rollFromUp(k * a.x / g, k * a.y / g, k * a.z / g, screenAngle()), performance.now() / 1000); this.out();
  };
  private onOrient = (e: DeviceOrientationEvent) => {
    if (this.motion || e.beta == null || e.gamma == null) return;
    this.core.push(rollFrom(e.beta, e.gamma, screenAngle()), performance.now() / 1000); this.out();
  };
  start() { if (this.on || !hasTilt()) return; this.on = true; this.motion = false; this.core.reset(); window.addEventListener('devicemotion', this.onMotion); window.addEventListener('deviceorientation', this.onOrient); }
  stop() { if (!this.on) return; this.on = false; window.removeEventListener('devicemotion', this.onMotion); window.removeEventListener('deviceorientation', this.onOrient); this.core.reset(); this.out(); }
  /** Treat the current phone angle as "straight". */
  calibrate() { this.core.calibrate(); this.out(); }
}
export const tilt = new Tilt();

/** One steering pipeline for every input (keys, touch arrows, tilt) in every view and both modes.
 *  Digital input ramps: attack ~0.16 s to full lock (a touch slower at speed), release / self-centre faster, and reversing direction passes through centre quickly.
 *  Analog (tilt) input is only lightly smoothed. Lock at speed is scaled by the physics itself (CarPhysics.lockEff), so nothing here fights it. */
export class SteerInput {
  private v = 0;
  reset() { this.v = 0; }
  /** raw: -1..1 digital (keys / buttons) or analog (tilt). */
  step(raw: number, dt: number, speedRatio: number, analog = false) {
    dt = Math.min(dt, .05);
    if (analog) { this.v += (raw - this.v) * Math.min(1, dt * 80); if (Math.abs(this.v) < .002 && raw === 0) this.v = 0; return this.v; }
    const sr = Math.min(1, speedRatio), attack = 1 / (.10 + .08 * sr), release = 1 / (.07 + .04 * sr);
    const target = raw * (1 - .08 * sr), diff = target - this.v;
    let rate = Math.abs(target) > Math.abs(this.v) && Math.sign(target) === (this.v === 0 ? Math.sign(target) : Math.sign(this.v)) ? attack : release;
    if (this.v * target < 0) rate = release * 1.6;                                        // flipping sides: unwind fast, no sluggish crossover
    const step = rate * dt; this.v = Math.abs(diff) <= step ? target : this.v + Math.sign(diff) * step;
    return this.v;
  }
}
export { SteerInput as SteerShaper };

/** Edge detector for the gear buttons (keyboard or touch): returns +1 on a fresh "up", -1 on a fresh "down", else 0. */
export class GearInput {
  private u = false; private d = false; private g = false;
  step(up: boolean, down: boolean, toggle: boolean) { const r = up && !this.u ? 1 : down && !this.d ? -1 : 0, t = toggle && !this.g; this.u = up; this.d = down; this.g = toggle; return { shift: r, toggle: t }; }
}
