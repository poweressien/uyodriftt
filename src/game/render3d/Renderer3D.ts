import * as THREE from 'three';
import type Phaser from 'phaser';
import { Car3D, CarKind, CarLook, makeEnvironment, CAR_DIMS } from './Car3D';
import { Fx3D } from './Fx3D';
import { Props, SKIES, grassTexture, roadTexture, skyTexture, rng } from './World3D';
import { PPM } from '../data/vehicles';
import { BUILDINGS, DECOR_EXT, type District, type Weather, type Decor } from '../data/districts';
import type { Track } from '../systems/Track';
import type { Layout } from '../data/layouts';

const S = 1 / PPM;                                         // px -> metres
export interface R3DCar { x: number; y: number; h: number; on: boolean; brake: boolean; color: number; hit: boolean }
export interface R3DHaz { kind: 'pothole' | 'cone' | 'flood'; x: number; y: number; a: number; s: number; r: number }
export interface R3DFrame { dt: number; px: number; py: number; heading: number; vx: number; vy: number; steer: number; ax: number; ay: number; wheelRate: number; brake: boolean; ratio: number; dmg: number; blink: boolean; shake: number; cars: R3DCar[]; haz: R3DHaz[]; coins?: { x: number; y: number }[] }
export interface R3DSetup { mode: 'endless' | 'drift'; dist: District; weather: Weather; player: CarLook; traffic: CarKind[]; seed: number; track?: Track; layout?: Layout; lanes?: number }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// endless road cross-section (px, same numbers as EndlessScene)
export const E_LANE_W = 110, E_KERB = 18, E_SHOULDER = 150, E_CHUNK = 1200;
export const eRoadW = (lanes: number) => lanes * E_LANE_W, eTW = (lanes: number) => eRoadW(lanes) + 2 * (E_KERB + E_SHOULDER), eWall = (lanes: number) => eTW(lanes) / 2 - 12;

/** Real 3D view (three.js) that sits behind Phaser's transparent canvas. The Phaser scene keeps simulating; this only draws the state it is given. */
export class Renderer3D {
  readonly ok: boolean; active = false; private r!: THREE.WebGLRenderer; private cv: HTMLCanvasElement; private host: HTMLElement; private scene = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(62, 16 / 9, .3, 700);
  private built = false; private mode: 'endless' | 'drift' = 'endless'; private weather: Weather = 'sunny'; private player!: Car3D; private traffic: Car3D[] = []; private fx!: Fx3D; private props!: Props; private ground!: THREE.Mesh; private road?: THREE.Mesh; private rails?: THREE.Group;
  private sun!: THREE.DirectionalLight; private lights: THREE.Object3D[] = []; private camYaw = 0; private fov = 62; private rain?: THREE.LineSegments; private rainN = 0; private pk = -999; private seed = 1; private pick!: () => Decor; private decor: [Decor, number][] = []; private ro: ResizeObserver; private roadPeriod = 0; private spots: THREE.SpotLight[] = []; private lanes = 4; private coins: THREE.Mesh[] = [];
  private hz: Record<string, THREE.Object3D[]> = { cone: [], pothole: [], flood: [] }; private hzUsed: Record<string, number> = { cone: 0, pothole: 0, flood: 0 }; private snapCam = true; private t = 0; private camPos = new THREE.Vector3(); private onResize = () => this.sync();
  constructor(private game: Phaser.Game) {
    this.cv = game.canvas; this.host = this.cv.parentElement!;
    try { this.r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); this.ok = true; } catch { this.ok = false; this.ro = new ResizeObserver(() => {}); return; }
    const r = this.r; r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    const el = r.domElement; el.style.cssText = 'position:absolute;display:none;pointer-events:none;z-index:0'; this.host.style.position = this.host.style.position || 'relative'; this.cv.style.position = 'relative'; this.cv.style.zIndex = '1'; this.host.insertBefore(el, this.cv);
    this.ro = new ResizeObserver(this.onResize); this.ro.observe(this.cv); window.addEventListener('resize', this.onResize); game.scale.on('resize', this.onResize); this.sync();
  }
  private sync() {
    if (!this.ok) return; const b = this.cv.getBoundingClientRect(), h = this.host.getBoundingClientRect(), el = this.r.domElement, w = Math.max(2, Math.round(b.width)), ht = Math.max(2, Math.round(b.height));
    el.style.left = `${b.left - h.left}px`; el.style.top = `${b.top - h.top}px`; el.style.width = `${w}px`; el.style.height = `${ht}px`;
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, w > 1100 ? 1.25 : 1.75)); this.r.setSize(w, ht, false); this.cam.aspect = w / ht; this.cam.updateProjectionMatrix();
  }
  setActive(on: boolean) { if (!this.ok) return; this.active = on && this.built; this.r.domElement.style.display = this.active ? 'block' : 'none'; if (this.active) this.sync(); }

  // ------------------------------------------------------------------ build
  setup(c: R3DSetup) {
    if (!this.ok) return; this.teardown(); this.mode = c.mode; this.weather = c.weather; this.seed = c.seed; const sk = SKIES[c.weather], pal = c.dist.palette, scene = this.scene = new THREE.Scene();
    const skyTex = skyTexture(sk); skyTex.mapping = THREE.EquirectangularReflectionMapping; scene.background = skyTex;
    const pm = new THREE.PMREMGenerator(this.r); scene.environment = pm.fromEquirectangular(skyTex).texture; pm.dispose(); (scene as any).environmentIntensity = c.weather === 'night' ? .35 : .75;
    scene.fog = new THREE.Fog(sk.fog, sk.fogNear, sk.fogFar); this.r.toneMappingExposure = c.weather === 'night' ? 1.25 : 1;
    scene.add(new THREE.HemisphereLight(sk.top, 0x3a2a14, sk.hemi), new THREE.AmbientLight(0xffffff, sk.ambient)); this.sun = new THREE.DirectionalLight(sk.sun, sk.sunI); this.sun.position.set(-40, 70, -30); scene.add(this.sun, this.sun.target);
    // ground
    const gt = grassTexture(pal.ground); gt.repeat.set(160, 160); this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1280, 1280), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -.02; scene.add(this.ground);
    const wts = Object.entries(c.dist.decor) as [Decor, number][], total = wts.reduce((a, [, w]) => a + w, 0), pr = rng(c.seed * 13 + 1); this.decor = wts; this.pick = () => { let x = pr() * total; for (const [k, w] of wts) if ((x -= w) < 0) return k; return wts[0]?.[0] ?? 'palm'; };
    this.props = new Props(c.mode === 'endless' ? 900 : 700); scene.add(this.props.group);
    this.lanes = c.lanes ?? 4; if (c.mode === 'endless') this.buildEndless(pal); else this.buildTrack(c, pal);
    // cars
    this.player = new Car3D({ ...c.player }, true); scene.add(this.player.root);
    if (c.weather === 'night' || c.weather === 'heavy_rain' || c.weather === 'rain') for (const z of [-.6, .6]) { const sp = new THREE.SpotLight(0xfff1c8, c.weather === 'night' ? 520 : 260, 90, .5, .65, 1.2); sp.position.set(2, .8, z); sp.target.position.set(30, .2, z * 1.4); this.player.root.add(sp, sp.target); this.spots.push(sp); }
    this.traffic = c.traffic.map(k => { const car = new Car3D({ kind: k, color: 0x8a8f94 }, false); car.root.visible = false; scene.add(car.root); return car; });
    for (const kind of ['cone', 'pothole', 'flood'] as const) for (let i = 0; i < 24; i++) { const o = this.makeHazard(kind); o.visible = false; scene.add(o); this.hz[kind].push(o); }
    const cg = new THREE.CylinderGeometry(.5, .5, .1, 20); cg.rotateX(Math.PI / 2); const cm = new THREE.MeshStandardMaterial({ color: 0xffc531, metalness: .85, roughness: .28, emissive: 0x5a3600, emissiveIntensity: .6 });
    this.coins = []; for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(cg, cm); m.visible = false; scene.add(m); this.coins.push(m); }
    this.fx = new Fx3D(); scene.add(this.fx.group);
    if (c.weather === 'rain' || c.weather === 'heavy_rain') this.makeRain(c.weather === 'heavy_rain' ? 1100 : 600);
    this.built = true; this.pk = -999; this.snapCam = true;
  }
  private teardown() { if (!this.built) return; this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry && !(o instanceof THREE.InstancedMesh)) { /* geometries are cached/shared: leave */ } }); this.built = false; this.spots = []; this.hz = { cone: [], pothole: [], flood: [] }; this.rain = undefined; this.road = undefined; this.rails = undefined; this.traffic = []; }
  private makeHazard(kind: string): THREE.Object3D {
    if (kind === 'cone') { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(.3, .75, 12), new THREE.MeshStandardMaterial({ color: 0xff7a14, roughness: .5 })); c.position.y = .38; const b = new THREE.Mesh(new THREE.CylinderGeometry(.19, .23, .14, 12), new THREE.MeshStandardMaterial({ color: 0xffffff })); b.position.y = .4; const base = new THREE.Mesh(new THREE.BoxGeometry(.6, .05, .6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a })); base.position.y = .03; g.add(c, b, base); return g; }
    if (kind === 'pothole') { const m = new THREE.Mesh(new THREE.CircleGeometry(.95, 20), new THREE.MeshBasicMaterial({ color: 0x0b0c0b })); m.rotation.x = -Math.PI / 2; m.position.y = .035; m.scale.set(1, 1.2, 1); const ring = new THREE.Mesh(new THREE.RingGeometry(.95, 1.15, 20), new THREE.MeshBasicMaterial({ color: 0x4a3a2a, transparent: true, opacity: .8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .034; const g = new THREE.Group(); g.add(m, ring); return g; }
    const m = new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), new THREE.MeshStandardMaterial({ color: 0x78aac8, metalness: .9, roughness: .05, transparent: true, opacity: .62 })); m.rotation.x = -Math.PI / 2; m.position.y = .04; m.scale.set(1, .65, 1); return m;
  }
  private makeRain(n: number) {
    const g = new THREE.BufferGeometry(); this.rainN = n; const p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (Math.random() - .5) * 60, y = Math.random() * 22, z = (Math.random() - .5) * 60; p.set([x, y, z, x, y + 1.1, z], i * 6); } g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe0ee, transparent: true, opacity: .32, depthWrite: false })); this.rain.frustumCulled = false; this.scene.add(this.rain);
  }
  private buildEndless(pal: District['palette']) {
    const { tex, TW } = roadTexture({ road: pal.road, shoulder: pal.shoulder, roadW: eRoadW(this.lanes), shoulderW: E_SHOULDER, kerbW: E_KERB, lanes: this.lanes }); const period = 256 * S, reps = 36; this.roadPeriod = period;
    tex.repeat.set(1, reps); this.road = new THREE.Mesh(new THREE.PlaneGeometry(TW * S, period * reps), new THREE.MeshStandardMaterial({ map: tex, roughness: .88, metalness: 0 })); this.road.rotation.x = -Math.PI / 2; this.scene.add(this.road);
    // guard rails: continuous beam + posts, moved in whole periods so the pattern never jumps
    const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0xcfd6da, metalness: .9, roughness: .3 }), len = period * reps, postGeo = new THREE.CylinderGeometry(.06, .06, .8, 6), posts = Math.round(len / (period / 5));
    for (const side of [-1, 1]) { const x = side * eWall(this.lanes) * S; const beam = new THREE.Mesh(new THREE.BoxGeometry(.12, .34, len), steel); beam.position.set(x, .62, 0); const pm = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x3a4146, roughness: .6 }), posts), o = new THREE.Object3D();
      for (let i = 0; i < posts; i++) { o.position.set(x, .4, -len / 2 + i * (period / 5)); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); } pm.frustumCulled = false; g.add(beam, pm); }
    this.rails = g; this.scene.add(g);
  }
  private buildTrack(c: R3DSetup, pal: District['palette']) {
    const t = c.track!, shoulderW = 70, kerbW = 18, lanes = 2, roadW = t.width, { tex, TW } = roadTexture({ road: pal.road, shoulder: pal.shoulder, roadW, shoulderW, kerbW, lanes });
    const n = t.n, pos: number[] = [], uv: number[] = [], idx: number[] = [], nor: number[] = []; let len = 0; const seg: number[] = [0];
    for (let i = 1; i <= n; i++) { const a = t.pts[i - 1], b = t.pts[i % n]; len += Math.hypot(b.x - a.x, b.y - a.y); seg.push(len); } const reps = Math.max(1, Math.round(len / 256));
    for (let i = 0; i <= n; i++) { const p = t.pts[i % n], nm = t.nrm[i % n], hw = TW / 2, v = (seg[i] / len) * reps; pos.push((p.x - nm.x * hw) * S, 0, (p.y - nm.y * hw) * S, (p.x + nm.x * hw) * S, 0, (p.y + nm.y * hw) * S); uv.push(0, v, 1, v); nor.push(0, 1, 0, 0, 1, 0); if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    this.road = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: .88, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); this.road.position.y = 0; this.scene.add(this.road); this.roadPeriod = 0;
    // props along the track, kept clear of every part of the road
    const r = rng(c.seed * 31 + 7); this.props.begin(); const placed: { x: number; y: number; e: number }[] = [];
    for (let i = 0; i < n; i += 3) for (const side of [-1, 1]) {
      if (r() < .25) continue; const kind = this.pick(), bld = BUILDINGS.includes(kind), ext = DECOR_EXT[kind], p = t.pts[i], nm = t.nrm[i], off = t.width / 2 + (bld ? 80 + ext + r() * 150 : 100 + r() * 260), x = p.x + nm.x * off * side, y = p.y + nm.y * off * side;
      const min2 = (t.width / 2 + (bld ? 70 + ext : 90)) ** 2; let ok = true;
      for (let j = 0; j < n; j += 2) { const q = t.pts[j]; if ((q.x - x) ** 2 + (q.y - y) ** 2 < min2) { ok = false; break; } } if (!ok) continue;
      if (bld) { if (placed.some(o => (o.x - x) ** 2 + (o.y - y) ** 2 < (o.e + ext + 30) ** 2)) continue; placed.push({ x, y, e: ext }); }
      const rot = bld ? Math.atan2(-nm.x * side, -nm.y * side) : side > 0 ? Math.PI / 2 : -Math.PI / 2; // buildings face the road
      this.props.place(kind, x * S, y * S, rot, kind === 'umbrella' ? 1 : bld ? .92 + r() * .16 : .85 + r() * .4, r());
      if (kind !== 'lamp' && !bld && r() < .15) this.props.place('lamp', (x + nm.x * 20 * side) * S, (y + nm.y * 20 * side) * S, side > 0 ? Math.PI : 0, 1, 0);
    }
    for (let i = 0; i < n; i += 8) for (const side of [-1, 1]) { const p = t.pts[i], nm = t.nrm[i], off = t.width / 2 + TW / 2 - t.width / 2 + 24; this.props.place('lamp', (p.x + nm.x * off * side) * S, (p.y + nm.y * off * side) * S, side > 0 ? Math.PI : 0, 1, 0); }
    this.props.end();
    // landmark
    const cc = t.center, flat = (geo: THREE.BufferGeometry, color: number, x: number, z: number, y: number) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: .8 })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); this.scene.add(m); return m; };
    if (c.layout?.landmark === 'plaza') [[340, 0xffffff], [322, 0x167a34], [250, 0xff8c1a], [226, 0xffffff], [200, 0x0f8a45], [92, 0xffffff], [80, 0xbfe8ff], [26, 0xffffff]].forEach(([rad, col], i) => flat(new THREE.CircleGeometry((rad as number) * S, 48), col as number, cc.x * S, cc.y * S, .01 + i * .004));
    if (c.layout?.landmark === 'stadium') [[1520, 340, 0xffffff], [1440, 300, 0xff8c1a], [1260, 240, 0x0f8a45], [920, 168, 0x1f9d4b]].forEach(([w, h, col], i) => { const m = flat(new THREE.CircleGeometry(.5, 48), col as number, cc.x * S, cc.y * S, .01 + i * .004); m.scale.set((w as number) * S, (h as number) * S, 1); });
    if (c.layout?.landmark === 'airport') { const m = new THREE.Mesh(new THREE.BoxGeometry(4600 * S, .2, 140 * S), new THREE.MeshStandardMaterial({ color: 0x1b1f1e })); m.position.set(cc.x * S, .1, cc.y * S); this.scene.add(m); const tm = new THREE.Mesh(new THREE.BoxGeometry(620 * S, 9, 170 * S), new THREE.MeshStandardMaterial({ color: 0xf1f1ea })); tm.position.set((cc.x - 0) * S, 4.5, (cc.y - 400) * S); this.scene.add(tm); }
  }
  private rebuildEndlessProps(pk: number) {
    this.props.begin(); const WALL = eWall(this.lanes), B = this.decor.filter(([k]) => BUILDINGS.includes(k)), N = this.decor.filter(([k]) => !BUILDINGS.includes(k) && k !== 'lamp');
    const pickW = (rr: () => number, list: [Decor, number][]): Decor => { const tot = list.reduce((a, [, w]) => a + w, 0); let x = rr() * tot; for (const [k, w] of list) if ((x -= w) < 0) return k; return list[0][0]; };
    for (let k = pk - 3; k <= pk + 9; k++) { const r = rng(k * 7919 + this.seed), top = -(k + 1) * E_CHUNK; // everything below comes from the chunk's own rng, so rebuilding never changes what a chunk looks like
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) this.props.place('lamp', side * (WALL + 16) * S, (top + i * (E_CHUNK / 5) + 40) * S, side > 0 ? Math.PI : 0, 1, 0);
        if (B.length) for (let i = 0; i < 3; i++) { const kind = pickW(r, B), x = side * (WALL + 90 + DECOR_EXT[kind] + r() * 150), z = top + (i + .5) * (E_CHUNK / 3) + (r() - .5) * 70; this.props.place(kind, x * S, z * S, side > 0 ? -Math.PI / 2 : Math.PI / 2, .92 + r() * .16, r()); }
        if (N.length) for (let i = 0; i < 7; i++) { const kind = pickW(r, N), near = r() < .45, x = side * (near ? WALL + 48 + r() * 40 : WALL + 250 + r() * 300), z = top + r() * E_CHUNK; this.props.place(kind, x * S, z * S, r() * 6.28, kind === 'umbrella' ? 1 : .85 + r() * .45, r()); }
      } }
    this.props.end();
  }

  // ------------------------------------------------------------------ per-frame
  hit(x: number, y: number, strength: number, color: number) { if (this.built) this.fx.hit(x * S, y * S, strength, color); }
  scrape(x: number, y: number) { if (this.built) this.fx.scrape(x * S, y * S); }
  tyreSmoke(x: number, y: number, vx: number, vy: number) { if (this.built) this.fx.tyre(x * S, y * S, vx * S, vy * S); }
  damageSmoke(x: number, y: number, heading: number, hurt: number) { if (this.built) this.fx.damage(x * S, y * S, Math.cos(heading), Math.sin(heading), hurt); }

  frame(f: R3DFrame) {
    if (!this.ok || !this.active || !this.built) return; const dt = Math.min(f.dt, .05), px = f.px * S, pz = f.py * S; this.t += dt;
    // player
    const P = this.player; P.place(px, pz, f.heading, dt, { steer: f.steer, ax: f.ax, ay: f.ay, wheelRate: f.wheelRate }); P.chassis.visible = !f.blink; P.setBrake(f.brake); P.setDamage(f.dmg);
    // traffic
    for (let i = 0; i < this.traffic.length; i++) { const c = f.cars[i], t = this.traffic[i]; if (!c || !c.on) { t.root.visible = false; continue; } t.root.visible = true; t.place(c.x * S, c.y * S, c.h, 0); if (t.look.color !== c.color) t.setColor(c.color); t.setBrake(c.brake); t.setDamage(c.hit ? 1 : 0); }
    // hazards
    this.hzUsed.cone = this.hzUsed.pothole = this.hzUsed.flood = 0;
    for (const h of f.haz) { const pool = this.hz[h.kind], i = this.hzUsed[h.kind]++; const o = pool?.[i]; if (!o) continue; o.visible = h.a > .02; o.position.set(h.x * S, h.kind === 'cone' ? Math.max(0, (h.s - 1) * 7) : 0, h.y * S); if (h.kind === 'cone') { o.rotation.set(h.s > 1 ? h.r : 0, h.r, h.s > 1 ? h.r * .6 : 0); } else o.rotation.y = h.r; }
    for (const k of ['cone', 'pothole', 'flood'] as const) for (let i = this.hzUsed[k]; i < this.hz[k].length; i++) this.hz[k][i].visible = false;
    { const cs = f.coins ?? [], tt = this.t; for (let i = 0; i < this.coins.length; i++) { const m = this.coins[i], c = cs[i]; if (!c) { m.visible = false; continue; } m.visible = true; m.position.set(c.x * S, 1 + .12 * Math.sin(tt * 4 + i), c.y * S); m.rotation.y = tt * 3 + i; } }
    // world follows the car
    const snap = (v: number, q: number) => Math.round(v / q) * q; this.ground.position.set(snap(px, 8), -.02, snap(pz, 8));
    if (this.mode === 'endless') { const zz = snap(pz, this.roadPeriod); this.road!.position.set(0, 0, zz); this.rails!.position.set(0, 0, zz); const pk = Math.floor(-f.py / E_CHUNK); if (pk !== this.pk) { this.pk = pk; this.rebuildEndlessProps(pk); } }
    this.sun.position.set(px - 40, 70, pz - 30); this.sun.target.position.set(px, 0, pz);
    // camera: close behind the car, follows its travel direction a little so slides show; FOV widens with speed
    const sp = Math.hypot(f.vx, f.vy) * S; let tgt = f.heading; if (sp > 3) tgt = f.heading + wrap(Math.atan2(f.vy, f.vx) - f.heading) * .32;
    if (this.snapCam) { this.snapCam = false; this.camYaw = f.heading; }
    this.camYaw += wrap(tgt - this.camYaw) * Math.min(1, dt * 5); const dx = Math.cos(this.camYaw), dz = Math.sin(this.camYaw), dist = 5.7 + f.ratio * 1.5, hgt = 2.05 + f.ratio * .3;
    const sh = f.shake * .35; this.camPos.set(px - dx * dist + (Math.random() - .5) * sh, hgt + (Math.random() - .5) * sh * .6, pz - dz * dist + (Math.random() - .5) * sh);
    this.cam.position.copy(this.camPos); this.cam.lookAt(px + dx * 7.5, 1.05, pz + dz * 7.5);
    const tf = 60 + f.ratio * 20 + Math.max(0, f.ax) * .5; this.fov += (tf - this.fov) * Math.min(1, dt * 3); if (Math.abs(this.cam.fov - this.fov) > .05) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
    this.fx.update(dt);
    if (this.rain) { const p = this.rain.geometry.attributes.position as THREE.BufferAttribute, a = p.array as Float32Array, cx = this.camPos.x, cz = this.camPos.z, fall = 26 * dt;
      for (let i = 0; i < this.rainN; i++) { const o = i * 6; a[o + 1] -= fall; a[o + 4] -= fall; a[o] -= dt * 2; a[o + 3] -= dt * 2; if (a[o + 1] < 0 || Math.abs(a[o] - cx) > 30 || Math.abs(a[o + 2] - cz) > 30) { const x = cx + (Math.random() - .5) * 60, y = 8 + Math.random() * 14, z = cz + (Math.random() - .5) * 60; a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = x - .05; a[o + 4] = y + 1.1; a[o + 5] = z; } } p.needsUpdate = true; }
    this.r.render(this.scene, this.cam);
  }
  dispose() { this.ro.disconnect(); window.removeEventListener('resize', this.onResize); if (!this.ok) return; this.game.scale.off('resize', this.onResize); this.r.dispose(); this.r.forceContextLoss(); this.r.domElement.remove(); }
}
