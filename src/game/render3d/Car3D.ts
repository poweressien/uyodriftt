import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Procedural 3D cars: no model files. Units are metres, the car faces +x, y is up, +z is the car's right.
 *  Bodies are side-profile outlines (with real wheel-arch cut-outs) extruded across the car and bevelled, so the paint catches reflections. */
export type CarKind = 'sedan' | 'suv' | 'bus';
export interface CarLook { color: number; kind: CarKind; decal?: string; wheel?: number; glass?: number }
type Cat = 'paint' | 'glass' | 'trim' | 'chrome' | 'head' | 'tail' | 'plate' | 'stripe' | 'tire';
type Part = { cat: Cat; g: THREE.BufferGeometry };
interface Cfg { halfL: number; width: number; belt: number; hoodY: number; tailY: number; ghR0: number; ghF0: number; ghR1: number; ghF1: number; roof: number; wr: number; wxF: number; wxR: number; boxy?: boolean; clear: number }
const CFG: Record<CarKind, Cfg> = {
  sedan: { halfL: 2.3, width: 1.86, belt: 1.04, hoodY: .84, tailY: .9, ghR0: -1.15, ghF0: .92, ghR1: -.78, ghF1: .38, roof: 1.47, wr: .34, wxF: 1.42, wxR: -1.38, clear: .3 },
  suv: { halfL: 2.4, width: 1.98, belt: 1.2, hoodY: 1.02, tailY: 1.12, ghR0: -1.6, ghF0: .98, ghR1: -1.5, ghF1: .52, roof: 1.78, wr: .4, wxF: 1.5, wxR: -1.5, clear: .38 },
  bus: { halfL: 2.95, width: 2.08, belt: 1.12, hoodY: .98, tailY: 1.12, ghR0: -2.78, ghF0: 2.1, ghR1: -2.78, ghF1: 1.95, roof: 2.55, wr: .42, wxF: 1.85, wxR: -1.85, boxy: true, clear: .36 },
};
export const WHEEL_COLORS: Record<string, number> = { stock: 0x9aa0a6, sport: 0x2a2d30, chrome: 0xeef3f6, gold: 0xff8c1a };
export const CAR_DIMS = (k: CarKind) => ({ length: CFG[k].halfL * 2 + .16, width: CFG[k].width, wheelR: CFG[k].wr, wheelX: [CFG[k].wxF, CFG[k].wxR], track: CFG[k].width / 2 - .17 });

const V3 = THREE.Vector3, Q = THREE.Quaternion, Eu = THREE.Euler, M4 = THREE.Matrix4;
const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
function xf(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const o = ni(g.clone()); o.applyMatrix4(new M4().compose(new V3(x, y, z), new Q().setFromEuler(new Eu(rx, ry, rz)), new V3(sx, sy, sz))); return o;
}
const box = (l: number, h: number, w: number) => new THREE.BoxGeometry(l, h, w);
function extrude(pts: [number, number][], depth: number, bevel: number, seg = 3) {
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 6 }); g.translate(0, 0, -depth / 2); return g;
}
const arch = (xc: number, r: number, y0: number): [number, number][] => { const o: [number, number][] = []; for (let i = 0; i <= 12; i++) { const a = Math.PI - (i / 12) * Math.PI; o.push([xc + Math.cos(a) * r, y0 + Math.sin(a) * r * 1.02 + .0]); } return o; };

/** All static parts of one car kind. `dynamicWheels` leaves the wheels out so the player's can spin and steer. */
function parts(kind: CarKind, dynamicWheels: boolean): Part[] {
  const c = CFG[kind], out: Part[] = [], add = (cat: Cat, g: THREE.BufferGeometry) => out.push({ cat, g: ni(g) }), bev = .11, depth = c.width - bev * 2, hw = c.width / 2, ar = c.wr + .1, y0 = c.clear;
  // ---- lower body: side profile with arch cut-outs
  const L = c.halfL - bev; const pts: [number, number][] = [[-L, y0], ...arch(c.wxR, ar, y0), ...arch(c.wxF, ar, y0), [L, y0]];
  if (c.boxy) pts.push([L, c.hoodY], [L - .15, c.belt + .1], [-L + .05, c.belt + .1], [-L, c.tailY]);
  else pts.push([L, y0 + .16], [L - .04, c.hoodY - .2], [L - .22, c.hoodY - .02], [L - .75, c.hoodY + .08], [c.ghF0 + .45, c.belt - .03], [c.ghF0, c.belt], [c.ghR0 - .1, c.belt + .01], [-L + .55, c.tailY + .12], [-L + .12, c.tailY + .04], [-L, c.tailY - .28]);
  add('paint', extrude(pts, depth, bev));
  // ---- greenhouse (glass) + roof + pillars
  const gh: [number, number][] = c.boxy ? [[c.ghR0, c.belt + .05], [c.ghR0 + .1, c.roof], [c.ghF1 - .45, c.roof], [c.ghF0, c.belt + .05]] : [[c.ghR0, c.belt - .02], [c.ghR1, c.roof - .03], [c.ghF1, c.roof - .03], [c.ghF0, c.belt - .02]];
  const gw = c.width - (c.boxy ? .14 : .3);
  if (c.boxy) { const n = 6, x0 = c.ghR0 + .15, x1 = c.ghF0 - .35, pw = (x1 - x0) / n; for (let i = 0; i < n; i++) add('glass', xf(box(pw - .14, c.roof - c.belt - .5, gw + .02), x0 + pw * (i + .5), (c.belt + c.roof) / 2 + .02, 0)); add('glass', extrude([[c.ghF0 - .3, c.belt + .15], [c.ghF1 - .45, c.roof - .35], [c.ghF1 - .5, c.roof - .35], [c.ghF0 - .3, c.belt + .15]], gw - .1, .02, 1)); add('paint', xf(box(x1 - x0 + .3, c.roof - c.belt, gw - .1), (x0 + x1) / 2, (c.belt + c.roof) / 2, 0)); } else add('glass', extrude(gh, gw, .035, 2));
  add('paint', xf(box(c.ghF1 - c.ghR1 + .15, .07, gw + .06), (c.ghF1 + c.ghR1) / 2 - .02, c.roof + .03, 0));
  const ang = (x0: number, y0b: number, x1: number, y1: number) => [Math.atan2(y1 - y0b, x1 - x0), Math.hypot(x1 - x0, y1 - y0b)] as const;
  for (const z of [-1, 1]) {
    const [aA, lA] = ang(c.ghF0, c.belt, c.ghF1, c.roof), [aC, lC] = ang(c.ghR0, c.belt, c.ghR1, c.roof);
    add('paint', xf(box(lA, .07, .07), (c.ghF0 + c.ghF1) / 2, (c.belt + c.roof) / 2, z * (gw / 2 + .01), 0, 0, aA));
    add('paint', xf(box(lC, .07, .16), (c.ghR0 + c.ghR1) / 2, (c.belt + c.roof) / 2, z * (gw / 2 - .01), 0, 0, aC));
    if (!c.boxy) add('paint', xf(box(.07, c.roof - c.belt, .06), (c.ghR1 + c.ghF1) / 2 + .15, (c.belt + c.roof) / 2, z * (gw / 2 + .01))); // B pillar
    if (kind === 'suv') add('chrome', xf(box(c.ghF1 - c.ghR1 - .3, .04, .05), (c.ghF1 + c.ghR1) / 2, c.roof + .09, z * .7)); // roof rails
    // trim: sills, door cuts, handles, mirrors
    add('trim', xf(box(c.wxF - c.wxR - c.wr * 2 - .3, .1, .03), (c.wxF + c.wxR) / 2, y0 + .09, z * (hw + .004)));
    for (const dx of c.boxy ? [-1.6, -.2, 1.2] : [-.5, .45, 1.1]) add('trim', xf(box(.02, c.belt - y0 - .25, .02), dx, (c.belt + y0) / 2 + .02, z * (hw + .008)));
    for (const dx of c.boxy ? [-1, .4] : [-.2, .75]) add('chrome', xf(box(.16, .03, .03), dx, c.belt - .12, z * (hw + .012)));
    if (!c.boxy) { add('paint', xf(box(.2, .12, .22), c.ghF0 - .28, c.belt + .06, z * (hw + .08), 0, z * .25)); add('trim', xf(box(.04, .1, .2), c.ghF0 - .3, c.belt + .06, z * (hw + .08))); }
    // headlights / tail lights / fog / exhaust
    if (c.boxy) { add('head', xf(box(.1, .22, .36), c.halfL, c.hoodY - .12, z * .62)); add('tail', xf(box(.1, .26, .3), -c.halfL, c.tailY - .12, z * .72)); }
    else { add('head', xf(box(.14, .17, .5), c.halfL - .18, c.hoodY - .12, z * .6, 0, z * -.22)); add('tail', xf(box(.1, .17, .52), -c.halfL + .04, c.tailY - .2, z * .64, 0, z * .1)); add('chrome', xf(new THREE.CylinderGeometry(.045, .045, .14, 10), -c.halfL - .02, y0 + .06, z * .55, 0, 0, Math.PI / 2)); add('head', xf(box(.08, .06, .16), c.halfL - .04, y0 + .22, z * .66)); }
    if (dynamicWheels === false) for (const [wx, wz] of [[c.wxF, z], [c.wxR, z]] as const) { add('tire', xf(new THREE.CylinderGeometry(c.wr, c.wr, .26, 18), wx, c.wr, wz * (hw - .17), Math.PI / 2)); add('chrome', xf(new THREE.CylinderGeometry(c.wr * .62, c.wr * .62, .275, 14), wx, c.wr, wz * (hw - .17), Math.PI / 2)); }
  }
  // ---- bumpers, grille, plates, underbody, accents
  add('trim', xf(box(.14, .16, c.width - .36), c.halfL - .03, y0 + .09, 0)); add('trim', xf(box(.14, .16, c.width - .36), -c.halfL + .03, y0 + .09, 0));
  add('trim', xf(box(.1, .2, .85), c.halfL - .01, c.hoodY - .26, 0)); add('chrome', xf(box(.11, .03, .9), c.halfL - .005, c.hoodY - .2, 0));
  add('plate', xf(box(.03, .13, .42), -c.halfL - .06, y0 + .35, 0)); add('plate', xf(box(.03, .12, .4), c.halfL + .04, y0 + .22, 0));
  add('trim', xf(box(c.halfL * 2 - .5, .3, c.width - .7), 0, y0 + .08, 0));
  if (!c.boxy) { add('trim', xf(box(.05, .035, .8), -.1, c.roof + .075, 0)); add('trim', xf(box(.4, .02, .03), c.halfL - .95, c.hoodY + .12, 0)); }
  if (kind === 'bus') { for (const z of [-1, 1]) { add('trim', xf(box(c.halfL * 2 - .5, .26, .04), 0, c.belt + .02, z * (hw + .01))); add('trim', xf(box(.12, .55, .02), c.ghF0 + .02, c.belt + .6, z * (hw - .08))); } add('trim', xf(box(.08, .3, c.width - .4), c.ghF0 + .2, c.roof - .35, 0)); add('head', xf(box(.05, .12, .5), c.ghF0 + .22, c.roof - .22, 0)); }
  return out;
}

const matCache = new Map<string, THREE.Material>();
const sharedMat = (cat: Cat): THREE.Material => {
  let m = matCache.get(cat); if (m) return m;
  switch (cat) {
    case 'glass': m = new THREE.MeshPhysicalMaterial({ color: 0x0a141c, metalness: .85, roughness: .06, envMapIntensity: 1.6, clearcoat: 1 }); break;
    case 'trim': m = new THREE.MeshStandardMaterial({ color: 0x111213, roughness: .65, metalness: .1 }); break;
    case 'tire': m = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: .92 }); break;
    case 'chrome': m = new THREE.MeshStandardMaterial({ color: 0xd3d8db, metalness: 1, roughness: .14 }); break;
    case 'head': m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c4, emissiveIntensity: 1.8, roughness: .2 }); break;
    case 'tail': m = new THREE.MeshStandardMaterial({ color: 0x7a0b07, emissive: 0xff1a10, emissiveIntensity: 1.2, roughness: .3 }); break;
    case 'plate': m = new THREE.MeshStandardMaterial({ color: 0xf1f1ea, roughness: .5 }); break;
    case 'stripe': m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .3, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); break;
    default: m = new THREE.MeshStandardMaterial();
  }
  matCache.set(cat, m); return m;
};
const geoCache = new Map<string, Map<Cat, THREE.BufferGeometry>>();
function compiled(kind: CarKind, dyn: boolean) {
  const key = kind + (dyn ? 'd' : 's'); let hit = geoCache.get(key); if (hit) return hit; hit = new Map();
  const by = new Map<Cat, THREE.BufferGeometry[]>(); for (const p of parts(kind, dyn)) (by.get(p.cat) ?? by.set(p.cat, []).get(p.cat)!).push(p.g);
  by.forEach((gs, cat) => hit!.set(cat, mergeGeometries(gs, false)!)); geoCache.set(key, hit); return hit;
}

let shadowTex: THREE.CanvasTexture | null = null;
export function blobShadow(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.55, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (shadowTex = new THREE.CanvasTexture(c));
}
const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
function decalTexture(decal: string) {
  if (decal === 'flames') return canvasTex(512, 128, g => { g.fillStyle = '#ff8c1a'; for (const [a, b, d] of [[20, 52, 84], [44, 70, 100], [34, 62, 92]] as const) { g.beginPath(); g.moveTo(512, a); g.lineTo(260 + a * 2, b); g.lineTo(512, d); g.fill(); } g.fillStyle = '#ffd21f'; g.beginPath(); g.moveTo(512, 50); g.lineTo(330, 64); g.lineTo(512, 78); g.fill(); });
  if (decal === 'ibom-pride') return canvasTex(256, 64, g => { g.fillStyle = '#0f8a45'; g.fillRect(0, 0, 90, 64); g.fillStyle = '#fff'; g.fillRect(90, 0, 80, 64); g.fillStyle = '#ff8c1a'; g.fillRect(170, 0, 86, 64); });
  return null;
}

/** Studio reflections for glossy paint. Call once per WebGL renderer and assign to scene.environment. */
export function makeEnvironment(r: THREE.WebGLRenderer) { const pm = new THREE.PMREMGenerator(r), t = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); return t; }

export interface WheelRig { pivot: THREE.Group; spin: THREE.Group; front: boolean; side: number }
/** One car. `dynamic` = separate wheels that spin/steer plus a chassis group that pitches and rolls (player); traffic gets merged static geometry. */
export class Car3D {
  root = new THREE.Group(); chassis = new THREE.Group(); wheels: WheelRig[] = []; paint: THREE.MeshPhysicalMaterial; brake: THREE.MeshStandardMaterial; head: THREE.Material;
  readonly dims; private base: THREE.Color; private shadow: THREE.Mesh; private yaw = 0; private spinAng = 0;
  constructor(public look: CarLook, public dynamic = false) {
    const k = look.kind, c = CFG[k]; this.dims = CAR_DIMS(k); this.base = new THREE.Color(look.color);
    this.paint = new THREE.MeshPhysicalMaterial({ color: look.color, metalness: k === 'bus' ? .15 : .55, roughness: k === 'bus' ? .4 : .26, clearcoat: 1, clearcoatRoughness: .07, envMapIntensity: 1.15 });
    this.brake = (sharedMat('tail') as THREE.MeshStandardMaterial).clone(); this.head = sharedMat('head');
    const g = compiled(k, dynamic);
    g.forEach((geo, cat) => {
      const m = cat === 'paint' ? this.paint : cat === 'tail' ? this.brake : cat === 'glass' ? this.glassMat(look.glass) : sharedMat(cat);
      const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; this.chassis.add(mesh);
    });
    if (look.decal === 'stripes') for (const z of [-.13, .13]) this.chassis.add(this.stripe(c, z));
    const tex = look.decal ? decalTexture(look.decal) : null;
    if (tex) for (const z of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(c.halfL * 1.1, (c.belt - c.clear) * .75), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); p.position.set(.1, (c.belt + c.clear) / 2, z * (c.width / 2 + .004)); p.rotation.y = z < 0 ? Math.PI : 0; p.scale.x = z < 0 ? -1 : 1; this.chassis.add(p); }
    if (dynamic) this.buildWheels(c, look.wheel ?? 0xd8dcde);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(this.dims.length * 1.32, c.width * 1.7), new THREE.MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = .03; sh.renderOrder = 1; this.shadow = sh;
    this.root.add(sh, this.chassis);
  }
  private glassMat(tint = .7) { const m = (sharedMat('glass') as THREE.MeshPhysicalMaterial).clone(); m.color.setScalar(.04 + (1 - tint) * .3).lerp(new THREE.Color(0x0a1a26), .5); return m; }
  private stripe(c: Cfg, z: number) {
    const L = c.halfL - .07, pts: [number, number][] = [[-L + .45, c.tailY + .115], [-L + .12, c.tailY + .06], [c.ghR0 - .1, c.belt + .02], [c.ghR0, c.belt + .02], [c.ghR1, c.roof + .06], [c.ghF1, c.roof + .06], [c.ghF0, c.belt + .02], [c.ghF0 + .45, c.belt - .01], [L - .75, c.hoodY + .1], [L - .22, c.hoodY + .01], [L - .02, c.hoodY - .2]];
    const g = extrude(pts, .1, .01, 1); const m = new THREE.Mesh(g, sharedMat('stripe')); m.position.set(0, .012, z); m.scale.set(1, 1, 1); m.matrixAutoUpdate = true; return m;
  }
  private buildWheels(c: Cfg, rimColor: number) {
    const tire = new THREE.CylinderGeometry(c.wr, c.wr, .27, 22), rimGeo = mergeGeometries([ni(new THREE.CylinderGeometry(c.wr * .66, c.wr * .66, .285, 20)), ...[0, 1, 2, 3, 4].map(i => xf(box(.05, c.wr * 1.2, .292), 0, 0, 0, 0, 0, (i / 5) * Math.PI)).map(ni)], false)!;
    const disc = new THREE.CylinderGeometry(c.wr * .5, c.wr * .5, .06, 14), rimMat = new THREE.MeshStandardMaterial({ color: rimColor, metalness: .95, roughness: .22 }), discMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: .8, roughness: .5 });
    const hub = new THREE.CylinderGeometry(c.wr * .17, c.wr * .17, .3, 10), hubMat = new THREE.MeshStandardMaterial({ color: 0x151515 });
    for (const [wx, front] of [[c.wxF, true], [c.wxR, false]] as const) for (const side of [-1, 1]) {
      const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.set(wx, c.wr, side * (c.width / 2 - .17)); pivot.add(spin);
      for (const [geo, m] of [[tire, sharedMat('tire')], [rimGeo, rimMat], [disc, discMat], [hub, hubMat]] as const) { const me = new THREE.Mesh(geo, m); me.rotation.x = Math.PI / 2; spin.add(me); }
      this.chassis.add(pivot); this.wheels.push({ pivot, spin, front, side });
    }
  }
  setColor(c: number) { this.look.color = c; this.base.set(c); this.paint.color.copy(this.base); }
  /** damage 0..1 darkens and dulls the paint. */
  setDamage(d: number) { const k = 1 - .45 * Math.min(1, d); this.paint.color.copy(this.base).multiplyScalar(k); this.paint.roughness = .26 + .3 * Math.min(1, d); }
  setBrake(on: boolean) { this.brake.emissiveIntensity = on ? 4 : 1.1; }
  /** Pose in world metres. heading in game radians (clockwise on screen); steer = front wheel angle; ax/ay in m/s^2 for pitch/roll; wheelRate in rad/s. */
  place(x: number, z: number, heading: number, dt = 0, o: { steer?: number; ax?: number; ay?: number; wheelRate?: number; lift?: number; spinY?: number } = {}) {
    this.root.position.set(x, 0, z); this.root.rotation.y = -heading;
    const tp = THREE.MathUtils.clamp((o.ax ?? 0) * .006, -.05, .05), tr = THREE.MathUtils.clamp(-(o.ay ?? 0) * .006, -.06, .06);
    this.chassis.rotation.set(tr, 0, tp); this.chassis.position.y = o.lift ?? 0;
    if (this.dynamic) { this.spinAng -= (o.wheelRate ?? 0) * dt; for (const w of this.wheels) { w.spin.rotation.z = this.spinAng; if (w.front) w.pivot.rotation.y = -(o.steer ?? 0); } }
  }
  dispose() { this.paint.dispose(); this.brake.dispose(); }
}
