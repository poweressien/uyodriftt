import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Decor, Weather } from '../data/districts';

/** Procedural textures + scenery for the 3D view. Everything is generated in code. */
export const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};
export const rng = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export function grassTexture(color: number) {
  const r = rng(11), t = canvasTex(256, 256, g => {
    g.fillStyle = hex(color); g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.11)' : 'rgba(255,255,255,.07)'; const x = r() * 256, y = r() * 256, w = 1 + r() * 3; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) g.fillRect(x + ox, y + oy, w, 2 + r() * 5); }
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.7)' : 'rgba(255,140,26,.75)'; g.fillRect(r() * 256, r() * 256, 2, 2); }
  }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export interface RoadSpec { road: number; shoulder: number; roadW: number; shoulderW: number; kerbW: number; lanes: number; edgeLines?: boolean }
/** Cross-section strip: shoulder | kerb | asphalt with lane markings | kerb | shoulder. 256 px long, repeats along the road. */
export function roadTexture(s: RoadSpec) {
  const TW = s.roadW + 2 * (s.kerbW + s.shoulderW), r = rng(5), laneW = s.roadW / s.lanes, a0 = s.shoulderW + s.kerbW, a1 = a0 + s.roadW;
  const t = canvasTex(TW, 256, g => {
    g.fillStyle = hex(s.shoulder); g.fillRect(0, 0, TW, 256); for (let i = 0; i < TW * 1.2; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)'; g.fillRect(r() * TW, r() * 256, 2 + r() * 3, 2 + r() * 3); }
    for (let y = 0; y < 256; y += 32) for (const x of [s.shoulderW, a1]) { g.fillStyle = (y / 32) % 2 ? '#ffffff' : '#e0233a'; g.fillRect(x, y, s.kerbW, 32); }
    g.fillStyle = hex(s.road); g.fillRect(a0, 0, s.roadW, 256); for (let i = 0; i < s.roadW * 3.5; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.05)'; g.fillRect(a0 + r() * s.roadW, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = 'rgba(0,0,0,.11)'; for (let l = 0; l < s.lanes; l++) for (const o of [-laneW * .2, laneW * .2]) g.fillRect(a0 + (l + .5) * laneW + o - 7, 0, 14, 256);
    g.fillStyle = 'rgba(255,255,255,.9)'; if (s.edgeLines !== false) { g.fillRect(a0 + 10, 0, 5, 256); g.fillRect(a1 - 15, 0, 5, 256); }
    for (let l = 1; l < s.lanes; l++) for (const y of [0, 128]) g.fillRect(a0 + l * laneW - 3, y, 6, 64);
  }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; return { tex: t, TW };
}

// -------------------------------------------------------------------- sky
interface SkyDef { top: number; mid: number; horizon: number; fog: number; fogNear: number; fogFar: number; sun: number; hemi: number; sunI: number; ambient: number; stars?: boolean; clouds: number }
export const SKIES: Record<Weather, SkyDef> = {
  sunny: { top: 0x2f7fd0, mid: 0x6fb2ec, horizon: 0xe9f0f2, fog: 0xdbe8ee, fogNear: 70, fogFar: 380, sun: 0xfff1c9, hemi: .85, sunI: 2.6, ambient: .35, clouds: .35 },
  cloudy: { top: 0x6f8397, mid: 0x9fb0bd, horizon: 0xcdd5da, fog: 0xc3ccd2, fogNear: 50, fogFar: 320, sun: 0xe6edf2, hemi: .9, sunI: 1.2, ambient: .4, clouds: .9 },
  rain: { top: 0x46535d, mid: 0x6f7c85, horizon: 0x9aa4aa, fog: 0x8d979d, fogNear: 25, fogFar: 230, sun: 0xb9c4cc, hemi: .8, sunI: .55, ambient: .35, clouds: 1 },
  heavy_rain: { top: 0x2f3940, mid: 0x4c5860, horizon: 0x6f7a81, fog: 0x636e75, fogNear: 12, fogFar: 150, sun: 0x9aa7b0, hemi: .65, sunI: .3, ambient: .3, clouds: 1 },
  night: { top: 0x01040d, mid: 0x07122a, horizon: 0x16254a, fog: 0x0b1530, fogNear: 25, fogFar: 270, sun: 0x7f9bd8, hemi: .22, sunI: .45, ambient: .22, stars: true, clouds: .25 },
};
export function skyTexture(d: SkyDef) {
  const r = rng(3), css = (n: number) => hex(n);
  return canvasTex(1024, 512, g => {
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, css(d.top)); gr.addColorStop(.3, css(d.mid)); gr.addColorStop(.49, css(d.horizon)); gr.addColorStop(.5, css(d.fog)); gr.addColorStop(1, css(d.fog)); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    if (d.stars) for (let i = 0; i < 420; i++) { g.fillStyle = `rgba(255,255,255,${.3 + r() * .7})`; g.fillRect(r() * 1024, r() * 230, r() < .1 ? 2 : 1, r() < .1 ? 2 : 1); }
    for (let i = 0; i < 26 * d.clouds; i++) { const x = r() * 1024, y = 90 + r() * 150, w = 60 + r() * 170; for (let k = 0; k < 5; k++) { const cx = x + (r() - .5) * w, cy = y + (r() - .5) * 14, rad = 26 + r() * 40, cg = g.createRadialGradient(cx, cy, 0, cx, cy, rad); const a = d.stars ? .05 : .32 * d.clouds; cg.addColorStop(0, `rgba(255,255,255,${a})`); cg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = cg; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); } }
    for (const [u, sz] of [[.25, 90], [.25, 30]] as const) { const sg = g.createRadialGradient(u * 1024, 235, 0, u * 1024, 235, sz * 2.6); sg.addColorStop(0, d.stars ? 'rgba(180,200,255,.9)' : 'rgba(255,240,200,.95)'); sg.addColorStop(.25, d.stars ? 'rgba(120,150,230,.25)' : 'rgba(255,214,150,.4)'); sg.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = sg; g.fillRect(u * 1024 - sz * 3, 235 - sz * 3, sz * 6, sz * 6); }
  });
}

// -------------------------------------------------------------------- props
const paint = (g: THREE.BufferGeometry, color: number) => { const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const T = (g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = g.index ? g.toNonIndexed() : g.clone(); o.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))); o.deleteAttribute('uv'); return o; };
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map(g => { const o = g.index ? g.toNonIndexed() : g; if (o.attributes.uv) o.deleteAttribute('uv'); return o; }), false)!;
/** Gable roof (triangular prism). Ridge runs along x, width across z, base at y=0. */
function gable(L: number, W: number, H: number) {
  const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(0, H); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }); g.translate(0, 0, -L / 2); g.rotateY(Math.PI / 2); return g;
}
/** Hip roof: four-sided pyramid fitted to a wx x wz footprint, base at y=0. */
function hip(wx: number, wz: number, H: number) { const g = new THREE.ConeGeometry(1, H, 4); g.rotateY(Math.PI / 4); g.scale(wx / 2 / Math.SQRT1_2, 1, wz / 2 / Math.SQRT1_2); g.translate(0, H / 2, 0); return g; }
function spire(w: number, H: number) { const g = new THREE.ConeGeometry(1, H, 4); g.rotateY(Math.PI / 4); g.scale(w / 2 / Math.SQRT1_2, 1, w / 2 / Math.SQRT1_2); g.translate(0, H / 2, 0); return g; }
export type PropKind = Decor | 'lampHead';
const GEO: Record<PropKind, () => THREE.BufferGeometry> = {
  palm: () => { const gs: THREE.BufferGeometry[] = [paint(T(new THREE.CylinderGeometry(.2, .34, 7, 7), .3, 3.5, 0, 0, 0, -.07), 0x7a5230)];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, leaf = new THREE.ConeGeometry(.5, 4, 4); leaf.scale(1, 1, .35); gs.push(paint(T(leaf, 0, 0, 0, 0, 0, -Math.PI / 2 - .55), i % 2 ? 0x1c8a3a : 0x2bb04d)); const l = gs[gs.length - 1]; l.translate(1.9, 0, 0); l.rotateY(a); l.translate(.55, 6.9, 0); }
    gs.push(paint(T(new THREE.IcosahedronGeometry(.28, 0), .55, 6.6, 0), 0x5a3a1c)); return merge(gs); },
  tree: () => merge([paint(T(new THREE.CylinderGeometry(.3, .45, 3.4, 7), 0, 1.7, 0), 0x5a3a1c), paint(T(new THREE.IcosahedronGeometry(2.3, 1), 0, 5, 0), 0x17632c), paint(T(new THREE.IcosahedronGeometry(1.6, 1), 1.4, 4.2, .6), 0x1f7c38), paint(T(new THREE.IcosahedronGeometry(1.5, 1), -1.2, 4.4, -.9), 0x2a9a47)]),
  shrub: () => merge([paint(T(new THREE.IcosahedronGeometry(.9, 1), 0, .6, 0), 0x1f7c38), paint(T(new THREE.IcosahedronGeometry(.6, 1), .6, .9, .2), 0x2a9a47), ...[0, 1, 2, 3].map(i => paint(T(new THREE.IcosahedronGeometry(.1, 0), Math.cos(i * 1.7) * .7, 1.1 + (i % 2) * .2, Math.sin(i * 1.7) * .7), i % 2 ? 0xff8c1a : 0xffffff))]),
  umbrella: () => merge([paint(T(new THREE.CylinderGeometry(.05, .05, 2.3, 6), 0, 1.15, 0), 0xdddddd), paint(T(new THREE.ConeGeometry(1.6, .75, 10), 0, 2.5, 0), 0xffffff), paint(T(new THREE.BoxGeometry(1.2, .08, 1.2), 0, .85, 0), 0x6b4a2a)]),
  bungalow: () => merge([
    paint(T(new THREE.BoxGeometry(8.4, 3.2, 6.4), 0, 1.6, 0), 0xffffff), paint(T(hip(8.4 + .9, 6.4 + .9, 2.1), 0, 3.2, 0), 0xa8452b),
    paint(T(new THREE.BoxGeometry(1, 2.1, .12), -1.6, 1.05, 3.23), 0x7a4a2a), ...[1.4, 3.2].map(x => paint(T(new THREE.BoxGeometry(1.3, 1.1, .1), x, 1.9, 3.23), 0x24323d)),
    ...[-1, 1].map(sx => paint(T(new THREE.BoxGeometry(4.2, 1.5, .24), sx * 3.5, .75, 5.3), 0xffffff)), paint(T(new THREE.BoxGeometry(2.4, 1.6, .1), 0, .8, 5.3), 0x2f6fb5), ...[-1, 1].map(sx => paint(T(new THREE.BoxGeometry(.36, 1.9, .36), sx * 1.45, .95, 5.3), 0xffffff))]),
  faceme: () => merge([
    paint(T(new THREE.BoxGeometry(15, 3, 5.4), 0, 1.5, 0), 0xffffff), paint(T(gable(15.8, 6.8, 1.6), 0, 3, 0), 0x8a8f94),
    ...[-6, -3.6, -1.2, 1.2, 3.6, 6].map((x, i) => paint(T(new THREE.BoxGeometry(1, 2.1, .1), x, 1.05, 2.73), i % 2 ? 0x2f6b4f : 0xff8c1a)),
    paint(T(new THREE.BoxGeometry(15.4, .14, 1.9), 0, 2.7, 3.55), 0x6b7378), ...[-7.2, -2.4, 2.4, 7.2].map(x => paint(T(new THREE.CylinderGeometry(.07, .07, 2.7, 6), x, 1.35, 4.45), 0x888888))]),
  duplex: () => merge([
    paint(T(new THREE.BoxGeometry(8.2, 6.4, 7), 0, 3.2, 0), 0xffffff), paint(T(new THREE.BoxGeometry(8.7, .35, 7.5), 0, 6.55, 0), 0xb9bec2), paint(T(new THREE.BoxGeometry(8.7, .5, .2), 0, 6.95, 3.65), 0xdfe3e5),
    paint(T(new THREE.BoxGeometry(4.6, .16, 1.7), -1.3, 3.3, 4.2), 0xdadde0), paint(T(new THREE.BoxGeometry(4.6, .75, .08), -1.3, 3.78, 5.0), 0x4a5056),
    paint(T(new THREE.CylinderGeometry(.85, .85, 1.7, 10), 2.4, 7.55, -1.4), 0x1b1f22), paint(T(new THREE.BoxGeometry(1.6, 2.2, 1.6), -2.8, 7.5, -2), 0xdfe3e5),
    paint(T(new THREE.BoxGeometry(1.1, 2.2, .12), -2.3, 1.1, 3.53), 0x7a4a2a), ...[-1.9, 1.9].flatMap(x => [1.0, 4.6].map(y => paint(T(new THREE.BoxGeometry(1.3, 1.2, .1), x + 1.0, y + 1.0, 3.53), 0x24323d))),
    ...[-1, 1].map(sx => paint(T(new THREE.BoxGeometry(3.4, 1.5, .24), sx * 4.1, .75, 6.3), 0xffffff)), paint(T(new THREE.BoxGeometry(2.6, 1.6, .1), 0, .8, 6.3), 0x3b3b3b)]),
  kiosk: () => merge([
    paint(T(new THREE.BoxGeometry(2.6, 2.2, 2.2), 0, 1.1, 0), 0xffffff), paint(T(new THREE.BoxGeometry(3.1, .14, 2.7), 0, 2.28, 0), 0x3a3f43), paint(T(new THREE.BoxGeometry(2.6, .08, 1.2), 0, 1.95, 1.6, .3), 0xffffff),
    paint(T(new THREE.BoxGeometry(1.7, .9, .05), 0, 1.3, 1.12), 0x24323d), paint(T(new THREE.BoxGeometry(2.7, .08, .6), 0, .82, 1.4), 0x6b4a2a)]),
  church: () => merge([
    paint(T(new THREE.BoxGeometry(8, 5, 14), 0, 2.5, -1), 0xffffff), paint(T(gable(14.8, 9, 3.2), 0, 5, -1, 0, Math.PI / 2, 0), 0xa8452b),
    paint(T(new THREE.BoxGeometry(3.2, 9, 3.2), 0, 4.5, 7.2), 0xffffff), paint(T(spire(2.5, 4.2), 0, 9, 7.2), 0x6b7378), paint(T(new THREE.BoxGeometry(.25, 2, .25), 0, 14.2, 7.2), 0xffffff), paint(T(new THREE.BoxGeometry(1.2, .25, .25), 0, 14.1, 7.2), 0xffffff),
    paint(T(new THREE.BoxGeometry(1.8, 2.8, .12), 0, 1.4, 8.82), 0x7a4a2a), ...[-3, -.5, 2, 4.5].flatMap(z => [-1, 1].map(sx => paint(T(new THREE.BoxGeometry(.1, 1.7, 1), sx * 4.02, 2.8, z - 1), 0x2a3a6a)))]),
  plaza: () => merge([
    paint(T(new THREE.BoxGeometry(14, 10, 10), 0, 5, 0), 0xffffff), ...[4.4, 7.4].map(y => paint(T(new THREE.BoxGeometry(14.1, 1.7, 10.1), 0, y, 0), 0x28465c)), paint(T(new THREE.BoxGeometry(14.6, .5, 10.6), 0, 10.2, 0), 0xcfd5d9),
    paint(T(new THREE.BoxGeometry(12.4, 2.4, .2), 0, 1.3, 5.05), 0x2f4a5a), paint(T(new THREE.BoxGeometry(9, 1.3, .35), 0, 9.3, 5.15), 0xff8c1a), paint(T(new THREE.BoxGeometry(3, 2.2, 3), 4, 11.5, -2), 0xe3e6e8),
    ...[0, 1, 2].map(i => paint(T(new THREE.BoxGeometry(1.3, .8, 1), -4.5 + i * 1.8, 10.8, 2.5), 0x8a9094)), paint(T(new THREE.BoxGeometry(3.6, .2, 2.2), 0, 2.9, 6.1), 0xdadde0)]),
  station: () => merge([
    paint(T(new THREE.BoxGeometry(12.6, .5, 8.4), 0, 5.2, 0), 0xffffff), paint(T(new THREE.BoxGeometry(12.8, .9, 8.6), 0, 4.8, 0), 0xd62d20),
    ...[-4.5, 4.5].flatMap(x => [-2.8, 2.8].map(z => paint(T(new THREE.CylinderGeometry(.18, .18, 4.6, 8), x, 2.3, z), 0xdddddd))),
    ...[-3.4, -1.2, 1.2, 3.4].map(x => paint(T(new THREE.BoxGeometry(.8, 1.5, .55), x, .75, 0), 0x2a2f33)), paint(T(new THREE.BoxGeometry(13, .1, 9), 0, .04, 0), 0x4a4f52),
    paint(T(new THREE.BoxGeometry(7, 3.4, 5), -1, 1.7, -8.5), 0xffffff), paint(T(new THREE.BoxGeometry(7.6, .3, 5.6), -1, 3.5, -8.5), 0x6b7378), paint(T(new THREE.BoxGeometry(5, 1.6, .1), -1, 1.5, -5.95), 0x24323d)]),
  lamp: () => merge([paint(T(new THREE.CylinderGeometry(.08, .12, 8.2, 7), 0, 4.1, 0), 0x6b7378), paint(T(new THREE.BoxGeometry(2.2, .12, .12), 1, 8.2, 0), 0x6b7378)]),
  lampHead: () => paint(T(new THREE.BoxGeometry(.7, .14, .34), 2, 8.1, 0), 0xfff0c0),
};
export type PlaceFn = (kind: Decor, xm: number, zm: number, rotY: number, scale: number, side: number) => void;
/** Instanced scenery: one draw call per prop type. */
export class Props {
  group = new THREE.Group(); private meshes = new Map<PropKind, THREE.InstancedMesh>(); private n = new Map<PropKind, number>(); private tmp = new THREE.Object3D(); private col = new THREE.Color();
  private static UMB = [0xff8c1a, 0xffffff, 0x0f8a45, 0xffb347];
  private static PASTEL = [0xfff3dc, 0xdcecff, 0xffded4, 0xfff1b0, 0xdcf5d4, 0xffffff];
  private static KIOSK = [0xffd23f, 0x2ea3f2, 0xe8452c, 0x3fbf60, 0xff8c1a];
  private static PAL: Partial<Record<PropKind, number[]>> = { umbrella: Props.UMB, bungalow: Props.PASTEL, faceme: Props.PASTEL, duplex: Props.PASTEL, church: [0xffffff, 0xfff3dc, 0xeaf2ff], plaza: [0xffffff, 0xeaf2ff, 0xfff3dc, 0xf0f0f0], kiosk: Props.KIOSK };
  constructor(private cap: number) {
    for (const k of Object.keys(GEO) as PropKind[]) {
      const mat = k === 'lampHead' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true });
      const m = new THREE.InstancedMesh(GEO[k](), mat, cap); m.count = 0; m.frustumCulled = false; this.group.add(m); this.meshes.set(k, m); this.n.set(k, 0);
    }
  }
  begin() { for (const k of this.n.keys()) this.n.set(k, 0); }
  place(kind: Decor, x: number, z: number, rotY: number, scale: number, seed: number) {
    const put = (k: PropKind) => { const m = this.meshes.get(k)!, i = this.n.get(k)!; if (i >= this.cap) return; this.tmp.position.set(x, 0, z); this.tmp.rotation.set(0, rotY, 0); this.tmp.scale.setScalar(scale); this.tmp.updateMatrix(); m.setMatrixAt(i, this.tmp.matrix);
      const pal = Props.PAL[k]; if (pal) m.setColorAt(i, this.col.set(pal[Math.floor(seed * pal.length) % pal.length])); this.n.set(k, i + 1); };
    put(kind); if (kind === 'lamp') put('lampHead');
  }
  end() { this.meshes.forEach((m, k) => { m.count = this.n.get(k)!; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }); }
}
