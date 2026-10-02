import * as THREE from 'three';
import { canvasTex } from './World3D';

/** Particle cloud with a fixed pool: positions, velocities, life and RGBA are updated on the CPU. */
class Cloud {
  readonly pts: THREE.Points; private pos: Float32Array; private col: Float32Array; private vel: Float32Array; private life: Float32Array; private max: Float32Array; private i = 0; private base: THREE.Color[] = [];
  constructor(private n: number, size: number, tex: THREE.Texture, additive: boolean, private grow = 0, private gravity = 0, private drag = 1.5) {
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(n * 3).fill(-9999); this.col = new Float32Array(n * 4); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    this.pts.frustumCulled = false; for (let i = 0; i < n; i++) this.base.push(new THREE.Color());
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: number) {
    const i = this.i++ % this.n; this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i] = life; this.max[i] = life; this.base[i].set(color);
  }
  update(dt: number, alpha: number) {
    const k = Math.pow(1 / this.drag, dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; } this.life[i] -= dt; const t = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.gravity * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt; if (this.pos[i * 3 + 1] < .05 && this.gravity) { this.pos[i * 3 + 1] = .05; this.vel[i * 3 + 1] *= -.3; }
      const c = this.base[i]; this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = alpha * t * (this.grow ? Math.min(1, (1 - t) * 6) : 1);
    }
    (this.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.pts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
const soft = () => canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

/** Tyre smoke, damage smoke, crash sparks and debris in world metres. */
export class Fx3D {
  readonly group = new THREE.Group(); private smoke: Cloud; private dark: Cloud; private sparks: Cloud; private bits: Cloud;
  constructor() {
    const t = soft();
    this.smoke = new Cloud(160, 2.6, t, false, 1, 0, 1.6); this.dark = new Cloud(90, 2.2, t, false, 1, 0, 1.4); this.sparks = new Cloud(160, .32, t, true, 0, 14, 1.2); this.bits = new Cloud(80, .35, t, false, 0, 18, 1.1);
    this.group.add(this.smoke.pts, this.dark.pts, this.sparks.pts, this.bits.pts);
  }
  tyre(x: number, z: number, vx: number, vz: number, color = 0xffffff) { this.smoke.emit(x, .35, z, vx * .15 + (Math.random() - .5), 1.1, vz * .15 + (Math.random() - .5), .9, color); }
  damage(x: number, z: number, hx: number, hz: number, hurt: number) { this.dark.emit(x + hx * 1.8, 1.1, z + hz * 1.8, (Math.random() - .5) * .8, 1.6, (Math.random() - .5) * .8, 1.2, 0x2a2a2a); if (hurt > .7 && Math.random() < .3) this.sparks.emit(x + hx * 1.9, 1, z + hz * 1.9, (Math.random() - .5) * 3, 2, (Math.random() - .5) * 3, .4, 0xffd27a); }
  hit(x: number, z: number, strength: number, color: number) {
    for (let i = 0; i < 8 + strength * 30; i++) { const a = Math.random() * 6.28, s = 4 + Math.random() * 14 * (.4 + strength); this.sparks.emit(x, .7 + Math.random() * .6, z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, .25 + Math.random() * .35, Math.random() < .5 ? 0xffffff : 0xffb347); }
    for (let i = 0; i < 4 + strength * 10; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 8; this.bits.emit(x, .8, z, Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s, .8 + Math.random() * .5, color); }
    for (let i = 0; i < 4 + strength * 6; i++) this.dark.emit(x, .8, z, (Math.random() - .5) * 4, 1 + Math.random() * 2, (Math.random() - .5) * 4, 1.1, 0x3a3a3a);
  }
  scrape(x: number, z: number) { for (let i = 0; i < 3; i++) this.sparks.emit(x, .5, z, (Math.random() - .5) * 6, 2 + Math.random() * 3, (Math.random() - .5) * 6, .25, 0xffe0a0); }
  update(dt: number) { this.smoke.update(dt, .5); this.dark.update(dt, .55); this.sparks.update(dt, 1); this.bits.update(dt, 1); }
}
