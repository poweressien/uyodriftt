import Phaser from 'phaser';
import type { Renderer3D } from '../render3d/Renderer3D';
/** Crash feedback: sparks, paint/glass shards, shock ring, and a damage smoke trail once the car is hurt. */
export class ImpactFx {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter; private shards: Phaser.GameObjects.Particles.ParticleEmitter; private smoke: Phaser.GameObjects.Particles.ParticleEmitter; private t = 0;
  constructor(private s: Phaser.Scene, private r3d?: Renderer3D) {
    this.sparks = s.add.particles(0, 0, 'dot', { lifespan: { min: 180, max: 420 }, speed: { min: 140, max: 480 }, scale: { start: .42, end: 0 }, tint: [0xffffff, 0xffe08a, 0xff8c1a], blendMode: 'ADD', emitting: false }).setDepth(40);
    this.shards = s.add.particles(0, 0, 'skid', { lifespan: { min: 500, max: 950 }, speed: { min: 60, max: 280 }, rotate: { min: 0, max: 360 }, scale: { start: .8, end: .2 }, alpha: { start: 1, end: 0 }, emitting: false }).setDepth(39);
    this.smoke = s.add.particles(0, 0, 'smokep', { lifespan: 900, scale: { start: .35, end: 1.6 }, alpha: { start: .5, end: 0 }, speed: 14, tint: 0x2a2a2a, emitting: false }).setDepth(41);
  }
  /** strength 0..1 */
  hit(x: number, y: number, strength: number, color: number) {
    this.r3d?.hit(x, y, strength, color); const n = Math.round(6 + strength * 26); this.sparks.emitParticleAt(x, y, n);
    this.shards.setParticleTint(color); this.shards.emitParticleAt(x, y, Math.round(3 + strength * 9));
    const ring = this.s.add.circle(x, y, 8, 0xffffff, .0).setStrokeStyle(3, 0xffd9a0, .9).setDepth(40);
    this.s.tweens.add({ targets: ring, scale: 2.5 + strength * 3, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
  }
  scrape(x: number, y: number) { this.r3d?.scrape(x, y); this.sparks.emitParticleAt(x, y, 3); }
  /** hurt 0..1: grey smoke from the bonnet; heavier damage also lets a few sparks leak. */
  damage(dt: number, x: number, y: number, heading: number, hurt: number) {
    if (hurt <= 0) return; this.t -= dt; if (this.t <= 0) this.r3d?.damageSmoke(x, y, heading, hurt); if (this.t > 0) return; this.t = .14 - hurt * .08;
    const c = Math.cos(heading), s = Math.sin(heading); this.smoke.emitParticleAt(x + c * 22, y + s * 22, 1); if (hurt > .7 && Math.random() < .3) this.sparks.emitParticleAt(x + c * 22, y + s * 22, 1);
  }
}
