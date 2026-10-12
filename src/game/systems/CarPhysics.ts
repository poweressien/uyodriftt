import { PPM, type Phys } from '../data/vehicles';
export interface Inputs { throttle: number; brake: boolean; steer: number; hand: boolean } // steer is analog -1..1 (tilt) or digital

/** Arcade-leaning tuning: more tyre grip than a road car, more steering lock kept at speed, slightly stronger front axle (lively turn-in). */
const MU_K = 1.7, LOCK_K = 1.9, LOCK_0 = .2, FRONT_K = 1.1;
const G = 9.81, CRR = .015, H = .5, WHEEL_R = .33; // CG height (m); wheelbase L comes from the car (Phys.L), CG sits 44% back from the front axle
const GEARS = [0, .13, .27, .44, .62, .80, 1.01];                                // upper speed fraction of gears 1..6
const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;
/** Saturating tyre curve: rises with slip angle, peaks near 10 degrees, then falls away a little. That fall-off is what makes a slide feel like a slide. */
const tyre = (alpha: number) => { const t = Math.atan(10 * Math.abs(alpha)), y = t < 1.0472 ? Math.sin(1.5 * t) : 1 - .1 * (t - 1.0472) / .5236; return alpha < 0 ? -y : y; }; // gentle fall-off past the peak: a slide is progressive, never a snap

/**
 * Top-down vehicle dynamics (single-track "bicycle" model) integrated in SI units, converted to pixels for the world.
 *  - tyres: slip-angle curve per axle, friction circle (driving/braking spends cornering grip), weight transfer under accel/brake
 *  - rear-wheel drive, power-limited engine with torque curve and an automatic gearbox (rpm + gear exposed for sound), wheelspin
 *  - brakes with front bias; handbrake locks the rear wheels so the tail steps out
 *  - drag + rolling resistance, so top speed is where power meets drag; off-road tyre grip is about half
 *  - collisions add yaw through `spin` (Collision.ts); vx/vy may be changed from outside between steps
 * Body frame: x forward, y to the car's right; heading grows clockwise on screen (y is down).
 */
export class CarPhysics {
  x = 0; y = 0; heading = 0; vx = 0; vy = 0; steer = 0; vf = 0; vl = 0; spin = 0;
  w = 0;                  // yaw rate, rad/s
  delta = 0;              // front wheel angle, rad
  ax = 0; ay = 0;         // smoothed body accelerations (m/s^2), used for weight transfer and 3D pitch / roll
  dr = 0;                 // power-slide state (0..1): throttle keeps a started slide going, lifting off brings the grip back
  hf = 0;                 // handbrake-drift memory (0..1): the stability assist stays out of the way while a drift is being thrown and fades back in afterwards
  gear = 1; rpm = .22; wheelSlip = 0; private shiftT = 0; private prevGear = 1; private u = 0;
  manual = false;         // manual gearbox: the player picks the gear (shiftUp / shiftDown); automatic otherwise
  limiter = false;        // true while the engine is bouncing off the rev limiter
  reversing = false;
  private kd = 1;         // side the handbrake kick throws the tail
  private pend = 0;       // queued manual shifts
  shiftUp() { this.pend++; } shiftDown() { this.pend--; }
  constructor(public p: Phys) {}
  get speed() { return Math.hypot(this.vx, this.vy); }
  /** Angle between where the car points and where it travels (deg). */
  get slipDeg() { return this.vf > 20 ? Math.abs(Math.atan2(this.vl, this.vf)) * 57.2958 : 0; }
  /** Wheel angular speed (rad/s) for the visuals. */
  get wheelRate() { return this.u / WHEEL_R; }

  step(dt: number, inp: Inputs, off: boolean, gripMul = 1) {
    dt = Math.min(dt, .05); const n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;   // clamp + fixed-size substeps: identical feel at 30 / 60 / 144 fps
    this.steer += (inp.steer - this.steer) * Math.min(1, dt * 50);                    // input is already ramped by SteerInput; this only removes frame stepping
    while (this.pend !== 0) { const d = this.pend > 0 ? 1 : -1; this.pend -= d; const g = clamp(this.gear + d, 1, 6); if (g !== this.gear) { this.gear = g; this.shiftT = (d > 0 ? .14 : .08) * this.p.shift; this.prevGear = g; } }
    for (let i = 0; i < n; i++) this.sub(h, inp, off, gripMul);
    this.x += this.vx * dt; this.y += this.vy * dt;
  }

  private sub(dt: number, inp: Inputs, off: boolean, gripMul: number) {
    const p = this.p, m = p.mass, L = p.L, A = L * .444, B = L - A;
    if (this.spin) { this.w += this.spin; this.spin = 0; }
    let c = Math.cos(this.heading), s = Math.sin(this.heading);
    let u = (this.vx * c + this.vy * s) / PPM, v = (-this.vx * s + this.vy * c) / PPM;  // world px/s -> body m/s
    const au = Math.abs(u), sg = u >= 0 ? 1 : -1, mu = p.mu * MU_K * gripMul * (off ? .55 : 1), vfrac = au / p.vmax;

    // ---- steering: the lock at speed is only as big as the tyres can use (graded, never saturated), plus counter-steer assist while the tail is out
    const lockEff = Math.min(p.steerLock, 1.3 * (LOCK_K * mu * G * L / (u * u + 12) + LOCK_0));
    let d = this.steer * lockEff;
    const beta = au > 4 ? Math.atan2(v, au) * sg : 0, bx = Math.sign(beta) * Math.max(0, Math.abs(beta) - .06);
    if (bx) d += clamp(bx * p.driftAssist * 1.6, -p.steerLock * .8, p.steerLock * .8) * (inp.steer * bx > 0 ? .35 : 1);
    d = clamp(d, -p.steerLock, p.steerLock); this.delta += (d - this.delta) * Math.min(1, dt * 36); const dl = this.delta;
    const hOn = inp.hand && au > .5; this.hf += ((hOn ? 1 : 0) - this.hf) * Math.min(1, dt * (hOn ? 14 : 1.1));
    // power-slide: a hard turn at speed with the pedal down, or an existing slide with the pedal down, tips the rear into a held drift; lift off and it straightens up
    const dcN = clamp((p.driftAssist - .35) / .5, 0, 1), commit = inp.throttle > .75 && Math.abs(this.steer) > .72 && au > 13, sliding = Math.abs(beta) > .15 && inp.throttle > .3 && au > 8;
    if (sliding) this.dr += (1 - this.dr) * Math.min(1, dt * 7); else if (commit) this.dr += (.8 - this.dr) * Math.min(1, dt * (.9 + dcN * 2)) * (this.dr < .8 ? 1 : 0);
    else this.dr -= this.dr * Math.min(1, dt * (inp.throttle < .25 || au < 6 ? 5 : Math.abs(beta) < .12 ? 2.2 : .6));
    const stab = 1 - Math.max(this.hf, this.dr * .9);

    // ---- engine + gearbox. rpm follows the real wheel speed through the gear (idle .2 .. redline 1), so a low gear revs high and a tall gear lugs.
    //      Automatic: shifts up near the redline (earlier when cruising), kicks down when you floor it. Manual: you pick the gear; the limiter bounces at the redline.
    let gear = this.gear; const fwd = u > -.5;
    if (!this.manual) {
      const upAt = inp.throttle > .85 ? .95 : .82;
      if (gear < 6 && vfrac > GEARS[gear] * upAt) gear++; else if (gear > 1 && vfrac < GEARS[gear - 1] * (inp.throttle > .85 ? .93 : .8)) gear--;
      if (gear !== this.gear) this.shiftT = (gear > this.gear ? .14 : .08) * p.shift;
    }
    this.gear = gear; this.prevGear = gear; if (this.shiftT > 0) this.shiftT -= dt;
    const geared = .2 + .8 * clamp(vfrac / GEARS[gear], 0, 1.08), clutch = au < 5 && inp.throttle > 0 ? .34 + inp.throttle * .2 : .2;   // launching: the clutch slips, the engine sits at ~40-55%
    const rpmT = this.shiftT > 0 && !this.manual ? Math.max(.2, geared - .12) : Math.max(geared, clutch);
    this.rpm += (Math.min(1, rpmT) - this.rpm) * Math.min(1, dt * 14);
    const over = geared > 1.0;                                                                 // manual only: past the redline in this gear
    this.limiter = inp.throttle > 0 && (over || (this.manual && this.rpm > .985 && (this.limiter || vfrac > GEARS[gear] * .985)));
    const torque = .72 + .28 * Math.sin(Math.PI * clamp((this.rpm - .12) / .93, 0, 1)) - (this.rpm < .3 ? (.3 - this.rpm) * 1.6 : 0), cut = (this.shiftT > 0 ? .35 : 1) * (this.limiter ? .05 : 1);
    const gk = clamp(.5 + 2.2 * (geared - .2), .5, 1);                                          // lugging in a tall gear: almost no pull below ~30% rpm
    let Fdrive = inp.throttle > 0 ? Math.min(inp.throttle * p.power * torque * cut / Math.max(au, 3.2), m * 11 * gk) : 0;
    if (inp.brake && u < 1) Fdrive = 0;                                                  // brake pedal wins; at standstill it becomes reverse
    const reverse = inp.brake && u < 1.2 && u > -p.vmax * .3 ? -m * 4.2 : 0;
    this.reversing = u < -.5;

    // ---- vertical loads with weight transfer
    const Fzf = clamp(m * G * B / L - m * this.ax * H / L * .55 * p.xfer, m * G * .2, m * G * .8), Fzr = m * G - Fzf;

    // ---- longitudinal forces
    const hand = inp.hand && au > .5, hk = clamp(1 - (Math.abs(beta) - .32) / .3, 0, 1), muR = mu * Fzr * 1.12;                             // driven axle runs sticky tyres
    const Fb = inp.brake && u > 1 ? p.brakeG * m * G : 0;
    const Fxf = -sg * Math.min(Fb * .62, mu * Fzf * .95);
    let Fxrb = -sg * Math.min(Fb * .38, mu * Fzr * .95); if (hand) Fxrb = -sg * muR * ((.42 - .24 * inp.throttle) * hk + Math.min(Fb * .38 / muR, .95) * (1 - hk)); // locked rears
    this.wheelSlip = clamp((Fdrive - muR * .92) / muR, 0, 1);
    const Fxr = Fdrive > muR * .92 ? muR * .88 : Fdrive;                                 // wheelspin: traction collapses a little
    const used = hand ? 0 : Math.min(1.2, Math.abs(Fxr + Fxrb) / muR);

    // ---- lateral forces from slip angles; friction circle: grip spent driving/braking is not available for cornering
    const ue = Math.max(au, 2.5);
    const af = Math.atan2(v + A * this.w, ue) - dl * sg, ar = Math.atan2(v - B * this.w, ue);
    const cf = Math.sqrt(Math.max(.1, 1 - (Math.abs(Fxf) / (mu * Fzf)) ** 2)), cr = Math.sqrt(1 - (used * .6) ** 2);
    const rearGrip = (hand ? p.hbGrip * hk + (1 + .1 * stab) * (1 - hk) : 1 + .1 * stab) * (1 - this.wheelSlip * .3) * (1 - this.dr * (.09 + .22 * inp.throttle) * (.7 + .3 * dcN) * Math.min(1.25, p.kick));
    const lsf = 1 - .14 * (Fzf / (m * G * B / L) - 1), lsr = 1 - .14 * (Fzr / (m * G * A / L) - 1);                  // tyres lose grip per newton as load shifts onto them
    const Fyf = -mu * FRONT_K * p.fk * Fzf * tyre(af) * cf * lsf, Fyr = -mu * Fzr * tyre(ar) * cr * rearGrip * lsr;

    // ---- resistance (always opposes motion)
    const engBrake = inp.throttle > 0 || inp.brake ? 0 : m * (.3 + 1.6 * Math.max(0, this.rpm - .2)) * Math.min(1, au / 1.5) * (this.manual && this.shiftT > 0 ? 0 : 1);   // lift off and the engine slows you
    const Fres = -sg * (p.kDrag * u * u + CRR * (off ? 4 : 1) * m * G + (off ? 380 : 0) * Math.min(1, au / 8) + engBrake);

    // ---- Newton-Euler in the body frame
    const sd = Math.sin(dl), cd = Math.cos(dl), Iz = m * A * B * 1.15;
        // stability assist: pull the yaw rate towards what the wheel is asking for (capped at what the tyres can give) and weathercock a sliding car back in line
    const wCap = 1.25 * mu * G / Math.max(au, 4), wT = clamp(u * Math.tan(dl) / L, -wCap, wCap), brk = beta ? Math.sign(beta) * Math.max(0, Math.abs(beta) - .25) : 0;
    const Mst = Iz * stab * (au > 3 ? clamp(au / 10, 0, 1) : 0) * (5 * (wT - this.w) + 9 * brk * (1 - .6 * this.hf)) + Iz * 11 * (beta ? Math.sign(beta) * Math.max(0, Math.abs(beta) - .55) : 0); // second term: slip-angle limiter, a drift can be held but never becomes a spin
    const kickDir = Math.abs(this.steer) > .08 ? Math.sign(this.steer) : (Math.abs(this.w) > .1 ? Math.sign(this.w) : this.kd); this.kd = kickDir;
    const kickM = hand && au > 7 ? Iz * 6 * kickDir * clamp(au / 16, 0, 1) * clamp(1 - Math.abs(beta) / .36, 0, 1) * Math.min(1, this.hf * 4) : 0;   // the button throws the tail out even with a light steer: the car rotates until a real slip angle is reached
    const Fx = Fxf * cd - Fyf * sd + Fxr + Fxrb + Fres + reverse + this.dr * inp.throttle * m * 1.4 * (au > 6 ? 1 : 0), /* a held drift carries its speed */ Fy = Fyf * cd + Fxf * sd + Fyr, Mz = A * (Fyf * cd + Fxf * sd) - B * Fyr + Mst + kickM;
    this.ax += (Fx / m - this.ax) * Math.min(1, dt * 8); this.ay += (Fy / m - this.ay) * Math.min(1, dt * 8);
    const u0 = u; u += (Fx / m + this.w * v) * dt; v += (Fy / m - this.w * u0) * dt; this.w += Mz / Iz * dt;
    if (u0 * u < 0 && Fdrive === 0 && reverse === 0) u = 0;                              // brakes / drag stop the car, they never reverse it

    // ---- crawling speeds: tyre models are ill-conditioned near standstill, so blend towards a kinematic bicycle
    const kb = clamp(1 - au / 4.5, 0, 1) * Math.min(1, dt * 14);
    if (kb > 0) { this.w += (u * Math.tan(dl) / L - this.w) * kb; v -= v * kb; }
    this.w -= this.w * Math.min(1, dt * (hand ? .25 : Math.abs(beta) < .15 ? 1.1 : .55));  // small yaw damping so a spun car settles
    this.w = clamp(this.w, -6, 6);

    // ---- back to world pixels
    this.heading += this.w * dt; c = Math.cos(this.heading); s = Math.sin(this.heading);
    this.u = u; this.vf = u * PPM; this.vl = v * PPM; this.vx = this.vf * c - this.vl * s; this.vy = this.vf * s + this.vl * c;
  }

  /** Energy loss from hitting something: scales velocity (px/s) and yaw. */
  bump(k: number) { this.vx *= k; this.vy *= k; this.vf *= k; this.vl *= k; this.w *= Math.min(1, k + .2); }
}
