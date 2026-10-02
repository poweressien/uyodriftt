import Phaser from 'phaser';
import { Pool } from './Pool';
export type HazardKind = 'pothole' | 'cone' | 'flood';
type Hazard = Phaser.GameObjects.Image & { kind: HazardKind; nm?: boolean };
export interface HazardEvents { onFlood(): void; onHit(kind: HazardKind, h: Hazard, nx: number, ny: number): void; onNear(): void }

/** Potholes, cones and puddles: pooled images, circle hit tests. Cones are knocked flying instead of vanishing. */
export class HazardField {
  list: Hazard[] = []; flying: Hazard[] = []; private pool: Pool<Hazard>;
  constructor(private s: Phaser.Scene) { this.pool = new Pool<Hazard>(() => s.add.image(0, 0, 'pothole') as Hazard); }
  add(kind: HazardKind, x: number, y: number) {
    const h = this.pool.get(); h.kind = kind; h.nm = false; h.setAlpha(1).setTexture(kind === 'cone' ? 'cone' : kind === 'flood' ? 'puddle' : 'pothole').setScale(1).setPosition(x, y).setDepth(kind === 'flood' ? -0.6 : 1).setRotation(Math.random() * 6); this.list.push(h); return h;
  }
  clear() { this.list.forEach(h => this.pool.release(h)); this.list = []; }
  /** Everything the 3D view should draw: live hazards plus cones still flying. */
  draw(): Hazard[] { return this.flying.length ? this.list.concat(this.flying) : this.list; }
  update(px: number, py: number, speed: number, ev: HazardEvents, farAway = 1400) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i], d = Phaser.Math.Distance.Between(h.x, h.y, px, py);
      if (d < (h.kind === 'flood' ? 44 : 30)) {
        if (h.kind === 'flood') { ev.onFlood(); this.release(i); } else { const nx = (h.x - px) / (d || 1), ny = (h.y - py) / (d || 1); ev.onHit(h.kind, h, nx, ny); if (h.kind === 'cone') this.fly(i, nx, ny, speed); else this.release(i); }
      } else if (d < 85 && !h.nm && h.kind !== 'flood' && speed > 200) { h.nm = true; ev.onNear(); } else if (d > farAway) this.release(i);
    }
  }
  private fly(i: number, nx: number, ny: number, speed: number) {
    const h = this.list[i]; this.list.splice(i, 1); this.flying.push(h); const k = 120 + speed * .35;
    this.s.tweens.add({ targets: h, x: h.x + nx * k, y: h.y + ny * k, rotation: h.rotation + 7, scale: 1.5, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => { this.flying.splice(this.flying.indexOf(h), 1); this.pool.release(h); } });
  }
  release(i: number) { const h = this.list[i]; this.list.splice(i, 1); this.pool.release(h); }
}
