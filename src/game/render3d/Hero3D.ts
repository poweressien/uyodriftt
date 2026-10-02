import * as THREE from 'three';
import { Car3D, CarLook, makeEnvironment } from './Car3D';

export interface HeroOpts { compact?: boolean; spin?: boolean }
/** Showroom: a car on a glossy turntable with neon rings, studio reflections, drag to rotate, gentle pointer parallax. Used by the main menu and the garage. */
export class Hero3D {
  readonly ok: boolean; private r!: THREE.WebGLRenderer; private scene = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(30, 1, .1, 100); private table = new THREE.Group(); private car: Car3D | null = null;
  private raf = 0; private yaw = -.6; private vel = 0; private drag = false; private lastX = 0; private px = 0; private py = 0; private t0 = performance.now(); private ro: ResizeObserver; private rings: THREE.Mesh[] = []; private visible = true;
  constructor(private host: HTMLElement, private o: HeroOpts = {}) {
    try { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); this.ok = true; } catch { this.ok = false; this.ro = new ResizeObserver(() => {}); return; }
    const r = this.r; r.setClearColor(0x000000, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = .92; r.outputColorSpace = THREE.SRGBColorSpace; r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab'; host.appendChild(r.domElement);
    this.scene.environment = makeEnvironment(r); (this.scene as any).environmentIntensity = .62;
    const glow = (rad: number, col: number, op: number) => { const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), new THREE.MeshBasicMaterial({ map: radial(), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .01; this.scene.add(m); };
    glow(6.5, 0xff8c1a, .22); glow(4.2, 0x2fd06a, .1);
    for (const [ri, col, w] of [[3.55, 0xff8c1a, .06], [4.35, 0x2fd06a, .035], [5.6, 0xffffff, .015]] as const) { const m = new THREE.Mesh(new THREE.RingGeometry(ri, ri + w, 128), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .015; this.scene.add(m); this.rings.push(m); }
    this.scene.add(new THREE.HemisphereLight(0xb7c8ff, 0x1b0f05, .35));
    const key = new THREE.SpotLight(0xffd2a0, 260, 30, .7, .6, 1.4); key.position.set(-6, 8, 6); key.target.position.set(0, .8, 0); const rim = new THREE.SpotLight(0xff7a18, 380, 30, .6, .5, 1.4); rim.position.set(7, 4, -6); rim.target.position.set(0, .8, 0);
    const rim2 = new THREE.SpotLight(0x35e08a, 220, 30, .6, .5, 1.4); rim2.position.set(-7, 3, -5); rim2.target.position.set(0, .8, 0); this.scene.add(key, key.target, rim, rim.target, rim2, rim2.target);
    this.scene.add(this.table);
    const el = r.domElement; el.addEventListener('pointerdown', e => { this.drag = true; this.lastX = e.clientX; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', e => { const b = el.getBoundingClientRect(); this.px = ((e.clientX - b.left) / b.width - .5) * 2; this.py = ((e.clientY - b.top) / b.height - .5) * 2; if (this.drag) { const d = (e.clientX - this.lastX) * .008; this.yaw += d; this.vel = d * 60; this.lastX = e.clientX; } });
    const up = () => { this.drag = false; el.style.cursor = 'grab'; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    const io = new IntersectionObserver(es => { this.visible = es[0]?.isIntersecting ?? true; }); io.observe(host);
    const loop = () => { this.raf = requestAnimationFrame(loop); if (this.visible) this.frame(); }; loop();
  }
  setCar(look: CarLook) {
    if (!this.ok) return; if (this.car) { this.table.remove(this.car.root); this.car.dispose(); }
    const c = new Car3D({ ...look }, true); c.root.rotation.y = 0; this.table.add(c.root); this.car = c; c.place(0, 0, 0, 0, {});
  }
  private resize() { if (!this.ok) return; const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = w / h < .9 ? 42 : 30; this.cam.updateProjectionMatrix(); }
  private frame() {
    const now = performance.now(), dt = Math.min(.05, (now - this.t0) / 1000); this.t0 = now;
    if (!this.drag) { this.yaw += this.vel * dt; this.vel *= Math.pow(.05, dt); if (this.o.spin !== false) this.yaw += dt * .28; }
    this.table.rotation.y = this.yaw; const k = this.o.compact ? 7.4 : 9.2, a = this.cam.aspect;
    const dist = a < .9 ? k * 2.15 : k; this.cam.position.set(this.px * 1.1, 1.55 - this.py * .35 + (a < .9 ? .6 : 0), dist); this.cam.lookAt(0, .72, 0);
    this.rings.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).opacity = .55 + .4 * Math.sin(now / 900 + i * 1.7); });
    if (this.car) { const t = now / 1000; this.car.chassis.rotation.z = Math.sin(t * 1.3) * .004; for (const w of this.car.wheels) if (w.front) w.pivot.rotation.y = Math.sin(t * .6) * .12; }
    this.r.render(this.scene, this.cam);
  }
  dispose() { cancelAnimationFrame(this.raf); this.ro.disconnect(); if (!this.ok) return; this.car?.dispose(); this.r.dispose(); this.r.forceContextLoss(); this.r.domElement.remove(); }
}
let radTex: THREE.CanvasTexture | null = null;
function radial() { if (radTex) return radTex; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return (radTex = new THREE.CanvasTexture(c)); }
