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
    for (let y = 0; y < 256; y += 32) for (const x of [s.shoulderW, a1]) { g.fillStyle = (y / 32) % 2 ? '#ffffff' : '#ff8c1a'; g.fillRect(x, y, s.kerbW, 32); }
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
export type PropKind = Decor | 'lampHead';
const GEO: Record<PropKind, () => THREE.BufferGeometry> = {
  palm: () => { const gs: THREE.BufferGeometry[] = [paint(T(new THREE.CylinderGeometry(.2, .34, 7, 7), .3, 3.5, 0, 0, 0, -.07), 0x7a5230)];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, leaf = new THREE.ConeGeometry(.5, 4, 4); leaf.scale(1, 1, .35); gs.push(paint(T(leaf, 0, 0, 0, 0, 0, -Math.PI / 2 - .55), i % 2 ? 0x1c8a3a : 0x2bb04d)); const l = gs[gs.length - 1]; l.translate(1.9, 0, 0); l.rotateY(a); l.translate(.55, 6.9, 0); }
    gs.push(paint(T(new THREE.IcosahedronGeometry(.28, 0), .55, 6.6, 0), 0x5a3a1c)); return merge(gs); },
  tree: () => merge([paint(T(new THREE.CylinderGeometry(.3, .45, 3.4, 7), 0, 1.7, 0), 0x5a3a1c), paint(T(new THREE.IcosahedronGeometry(2.3, 1), 0, 5, 0), 0x17632c), paint(T(new THREE.IcosahedronGeometry(1.6, 1), 1.4, 4.2, .6), 0x1f7c38), paint(T(new THREE.IcosahedronGeometry(1.5, 1), -1.2, 4.4, -.9), 0x2a9a47)]),
  shrub: () => merge([paint(T(new THREE.IcosahedronGeometry(.9, 1), 0, .6, 0), 0x1f7c38), paint(T(new THREE.IcosahedronGeometry(.6, 1), .6, .9, .2), 0x2a9a47), ...[0, 1, 2, 3].map(i => paint(T(new THREE.IcosahedronGeometry(.1, 0), Math.cos(i * 1.7) * .7, 1.1 + (i % 2) * .2, Math.sin(i * 1.7) * .7), i % 2 ? 0xff8c1a : 0xffffff))]),
  umbrella: () => merge([paint(T(new THREE.CylinderGeometry(.05, .05, 2.3, 6), 0, 1.15, 0), 0xdddddd), paint(T(new THREE.ConeGeometry(1.6, .75, 10), 0, 2.5, 0), 0xffffff), paint(T(new THREE.BoxGeometry(1.2, .08, 1.2), 0, .85, 0), 0x6b4a2a)]),
  house: () => merge([paint(T(new THREE.BoxGeometry(7, 3.4, 6), 0, 1.7, 0), 0xf2e6cc), paint(T(new THREE.ConeGeometry(5.4, 1.9, 4), 0, 4.35, 0, 0, Math.PI / 4, 0), 0xa8452b), paint(T(new THREE.BoxGeometry(.9, 1.9, .12), 0, .95, 3.02), 0xff8c1a), ...[-2.2, 2.2].map(x => paint(T(new THREE.BoxGeometry(1.2, 1.1, .1), x, 1.9, 3.02), 0x2a3a46))]),
  billboard: () => merge([paint(T(new THREE.CylinderGeometry(.12, .12, 6.5, 6), -2.6, 3.25, 0), 0x555555), paint(T(new THREE.CylinderGeometry(.12, .12, 6.5, 6), 2.6, 3.25, 0), 0x555555), paint(T(new THREE.BoxGeometry(8.4, 3.4, .25), 0, 6.8, 0), 0x1b1b1b), paint(T(new THREE.BoxGeometry(2.6, 2.8, .3), -2.7, 6.8, 0), 0x0f8a45), paint(T(new THREE.BoxGeometry(2.6, 2.8, .3), 0, 6.8, 0), 0xffffff), paint(T(new THREE.BoxGeometry(2.6, 2.8, .3), 2.7, 6.8, 0), 0xff8c1a)]),
  lamp: () => merge([paint(T(new THREE.CylinderGeometry(.08, .12, 8.2, 7), 0, 4.1, 0), 0x6b7378), paint(T(new THREE.BoxGeometry(2.2, .12, .12), 1, 8.2, 0), 0x6b7378)]),
  lampHead: () => paint(T(new THREE.BoxGeometry(.7, .14, .34), 2, 8.1, 0), 0xfff0c0),
};
export type PlaceFn = (kind: Decor, xm: number, zm: number, rotY: number, scale: number, side: number) => void;
/** Instanced scenery: one draw call per prop type. */
export class Props {
  group = new THREE.Group(); private meshes = new Map<PropKind, THREE.InstancedMesh>(); private n = new Map<PropKind, number>(); private tmp = new THREE.Object3D(); private col = new THREE.Color();
  private static UMB = [0xff8c1a, 0xffffff, 0x0f8a45, 0xffb347];
  constructor(private cap: number) {
    for (const k of Object.keys(GEO) as PropKind[]) {
      const mat = k === 'lampHead' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true });
      const m = new THREE.InstancedMesh(GEO[k](), mat, cap); m.count = 0; m.frustumCulled = false; this.group.add(m); this.meshes.set(k, m); this.n.set(k, 0);
    }
  }
  begin() { for (const k of this.n.keys()) this.n.set(k, 0); }
  place(kind: Decor, x: number, z: number, rotY: number, scale: number, seed: number) {
    const put = (k: PropKind) => { const m = this.meshes.get(k)!, i = this.n.get(k)!; if (i >= this.cap) return; this.tmp.position.set(x, 0, z); this.tmp.rotation.set(0, rotY, 0); this.tmp.scale.setScalar(scale); this.tmp.updateMatrix(); m.setMatrixAt(i, this.tmp.matrix);
      if (kind === 'umbrella') m.setColorAt(i, this.col.set(Props.UMB[Math.floor(seed * 4) % 4])); this.n.set(k, i + 1); };
    put(kind); if (kind === 'lamp') put('lampHead');
  }
  end() { this.meshes.forEach((m, k) => { m.count = this.n.get(k)!; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }); }
}
