export interface DriftResult { points: number; perfect: boolean; long: boolean; combo: number }
/** Rewards length, angle, speed, precision (steady angle), combos, near misses and a clean run. */
export class DriftScorer {
  total = 0; combo = 1; maxCombo = 1; drifts = 0; collisions = 0; topSpeed = 0;
  private active = false; private t = 0; private chain = 0; private angleVar = 0; private lastAngle = 0; private idle = 0;
  get live() { return this.active ? Math.round(this.chain) : 0; }
  get liveTime() { return this.active ? this.t : 0; }
  update(dt: number, speed: number, angleDeg: number): DriftResult | null {
    this.topSpeed = Math.max(this.topSpeed, speed);
    const drifting = speed > 150 && angleDeg > 12 && angleDeg < 100;
    if (drifting) {
      if (!this.active) { this.active = true; this.t = 0; this.chain = 0; this.angleVar = 0; this.lastAngle = angleDeg; }
      this.t += dt; this.idle = 0;
      this.angleVar += Math.abs(angleDeg - this.lastAngle); this.lastAngle = angleDeg;
      this.chain += (speed / 200) * (angleDeg / 25) * this.combo * dt * 60;
      return null;
    }
    if (this.active) { this.idle += dt; if (this.idle > .3) return this.bank(); }
    return null;
  }
  private bank(): DriftResult | null {
    this.active = false;
    if (this.t < .5) { this.combo = 1; return null; }
    const long = this.t > 3, perfect = this.angleVar / this.t < 25;
    const pts = Math.round(this.chain * (1 + (long ? .5 : 0) + (perfect ? .35 : 0))); this.total += pts; this.drifts++;
    const combo = this.combo; this.combo = Math.min(8, this.combo + 1); this.maxCombo = Math.max(this.maxCombo, this.combo);
    return { points: pts, perfect, long, combo };
  }
  bonus(n: number) { this.total += n; }
  nearMiss() { const p = 150 * this.combo; this.total += p; return p; }
  crash() { this.collisions++; this.combo = 1; this.active = false; this.chain = 0; }
  finish() { const clean = this.collisions === 0 ? 1000 : 0; this.total += clean; return clean; }
}
