import Phaser from 'phaser';
import type { Layout } from '../data/layouts';
import { DECOR_EXT, type District, type Decor } from '../data/districts';
import { Track, at, locate } from './Track';
import type { ViewRect } from './CameraRig';
const CELL = 1200;
type Cell = { kerb: Phaser.GameObjects.Graphics; road: Phaser.GameObjects.Graphics; shoulder: Phaser.GameObjects.Graphics; deco: Phaser.GameObjects.Graphics; cx: number; cy: number };
export const rng = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const UMB = [0xff8c1a, 0xffffff, 0x0f8a45, 0xffb347];

export function prop(g: Phaser.GameObjects.Graphics, kind: Decor, x: number, y: number, r: () => number) {
  switch (kind) {
    case 'palm': { const s = 30 + r() * 18, rot = r() * 6.28; g.fillStyle(0x000000, .22).fillEllipse(x + 10, y + 12, s * 2.2, s * 1.2);
      for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4, L = s * 1.2, px = -Math.sin(a) * s * .17, py = Math.cos(a) * s * .17; g.fillStyle(k % 2 ? 0x1c8a3a : 0x2bb04d).fillTriangle(x + px, y + py, x - px, y - py, x + Math.cos(a) * L, y + Math.sin(a) * L); }
      g.fillStyle(0x7a4a22).fillCircle(x, y, s * .14); break; }
    case 'tree': { const s = 38 + r() * 26; g.fillStyle(0x000000, .2).fillEllipse(x + 12, y + 14, s * 2.4, s * 1.7);
      g.fillStyle(0x17632c).fillCircle(x, y, s).fillStyle(0x1f7c38).fillCircle(x - s * .3, y - s * .25, s * .7).fillStyle(0x2a9a47).fillCircle(x + s * .25, y + s * .2, s * .5); break; }
    case 'shrub': { const s = 14 + r() * 10; g.fillStyle(0x1f7c38).fillCircle(x, y, s).fillStyle(0x2a9a47).fillCircle(x + s * .4, y - s * .3, s * .7);
      for (let k = 0; k < 5; k++) g.fillStyle(r() < .6 ? 0xff8c1a : 0xffffff).fillCircle(x + (r() - .5) * s * 1.5, y + (r() - .5) * s * 1.5, 2.6); break; }
    case 'umbrella': { const n = 1 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { const ux = x + k * 46 - 20, uy = y + (r() - .5) * 20, s = 24 + r() * 8, c = UMB[Math.floor(r() * 4)];
      g.fillStyle(0x000000, .22).fillCircle(ux + 6, uy + 8, s).fillStyle(c).fillCircle(ux, uy, s).lineStyle(2, 0x000000, .18).strokeCircle(ux, uy, s * .6).strokeCircle(ux, uy, s * .25); } break; }
    case 'bungalow': { // hip zinc roof inside a compound wall with a gate
      const w = 96 + r() * 36, h = 70 + r() * 20, x0 = x - w / 2, y0 = y - h / 2, roofs = [0xa8452b, 0x7a3b2a, 0x2f6b4f, 0x3b5f8a, 0x8a8f94], roof = roofs[Math.floor(r() * roofs.length)];
      g.lineStyle(3, 0xf4efe4, .9).strokeRect(x0 - 22, y0 - 22, w + 44, h + 44); g.fillStyle(0x7a4a2a).fillRect(x - 14, y0 + h + 19, 28, 6);
      g.fillStyle(0x000000, .26).fillRect(x0 + 9, y0 + 9, w, h); g.fillStyle(0xfff3dc).fillRect(x0, y0, w, h); g.fillStyle(roof).fillRect(x0 + 5, y0 + 5, w - 10, h - 10);
      g.fillStyle(0xffffff, .16).fillTriangle(x0 + 5, y0 + 5, x0 + w - 5, y0 + 5, x, y); g.fillStyle(0x000000, .16).fillTriangle(x0 + 5, y0 + h - 5, x0 + w - 5, y0 + h - 5, x, y);
      g.lineStyle(2, 0x000000, .22).lineBetween(x0 + 5, y0 + 5, x, y).lineBetween(x0 + w - 5, y0 + 5, x, y).lineBetween(x0 + 5, y0 + h - 5, x, y).lineBetween(x0 + w - 5, y0 + h - 5, x, y);
      for (let k = 1; k < 5; k++) g.lineStyle(1, 0xffffff, .12).lineBetween(x0 + 5, y0 + 5 + k * (h - 10) / 5, x0 + w - 5, y0 + 5 + k * (h - 10) / 5); break; }
    case 'faceme': { // face-me-I-face-you: one long low block, two rows of doors, shared veranda
      const w = 150 + r() * 36, h = 60, x0 = x - w / 2, y0 = y - h / 2, roof = [0x8a8f94, 0xa8452b, 0x6b7378, 0x3b5f8a][Math.floor(r() * 4)];
      g.fillStyle(0x000000, .26).fillRect(x0 + 8, y0 + 8, w, h); g.fillStyle(0xf2e6cc).fillRect(x0, y0, w, h); g.fillStyle(roof).fillRect(x0 + 4, y0 + 10, w - 8, h - 20);
      for (let k = 0; k < w - 8; k += 9) g.fillStyle(k % 18 ? 0xffffff : 0x000000, .09).fillRect(x0 + 4 + k, y0 + 10, 4, h - 20);
      g.fillStyle(0xc9b894).fillRect(x0 + 4, y0, w - 8, 8).fillRect(x0 + 4, y0 + h - 8, w - 8, 8); for (let k = 0; k < Math.floor(w / 22); k++) { g.fillStyle(k % 2 ? 0x2f6b4f : 0xff8c1a).fillRect(x0 + 12 + k * 22, y0 + 1, 8, 5).fillRect(x0 + 12 + k * 22, y0 + h - 6, 8, 5); } break; }
    case 'duplex': { // two storeys, flat roof with water tank and stair box
      const w = 100 + r() * 20, h = 84 + r() * 12, x0 = x - w / 2, y0 = y - h / 2;
      g.lineStyle(3, 0xf4efe4, .9).strokeRect(x0 - 20, y0 - 20, w + 40, h + 40); g.fillStyle(0x7a4a2a).fillRect(x - 14, y0 + h + 17, 28, 6);
      g.fillStyle(0x000000, .3).fillRect(x0 + 12, y0 + 12, w, h); g.fillStyle(0xffffff).fillRect(x0, y0, w, h); g.fillStyle(0xcfd3d6).fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      g.lineStyle(2, 0x000000, .18).strokeRect(x0 + 6, y0 + 6, w - 12, h - 12); g.fillStyle(0x1b1f1e).fillCircle(x0 + w * .72, y0 + h * .3, 11).fillStyle(0x3b4044).fillCircle(x0 + w * .72, y0 + h * .3, 7);
      g.fillStyle(0xe8e0d0).fillRect(x0 + 14, y0 + h * .55, 26, 22).fillStyle(0xb0492b, .85).fillRect(x0 + w * .55, y0 + h * .6, 22, 16); break; }
    case 'kiosk': { const n = 1 + Math.floor(r() * 3), cols = [0xffd23f, 0x2ea3f2, 0xe8452c, 0x3fbf60, 0xff8c1a];
      for (let k = 0; k < n; k++) { const kx = x + k * 36 - (n - 1) * 18, ky = y + (r() - .5) * 14, c = cols[Math.floor(r() * cols.length)]; g.fillStyle(0x000000, .26).fillRect(kx - 14, ky - 11, 32, 26); g.fillStyle(0x4a4f52).fillRect(kx - 16, ky - 13, 32, 26); g.fillStyle(c).fillRect(kx - 14, ky - 11, 28, 22);
        g.fillStyle(0xffffff, .25).fillRect(kx - 14, ky - 11, 28, 6); g.fillStyle(c, .75).fillRect(kx - 16, ky + 13, 32, 8); g.lineStyle(1, 0x000000, .25).strokeRect(kx - 16, ky + 13, 32, 8); } break; }
    case 'church': { // nave with a front tower and cross
      const w = 64, h = 120, x0 = x - w / 2, y0 = y - h / 2, roof = [0xa8452b, 0x3b5f8a, 0x6b7378][Math.floor(r() * 3)];
      g.lineStyle(3, 0xf4efe4, .85).strokeRect(x0 - 26, y0 - 26, w + 52, h + 56); g.fillStyle(0x000000, .28).fillRect(x0 + 10, y0 + 10, w, h); g.fillStyle(0xfdf6e6).fillRect(x0, y0, w, h); g.fillStyle(roof).fillRect(x0 + 5, y0 + 26, w - 10, h - 34);
      g.fillStyle(0xffffff, .14).fillRect(x0 + 5, y0 + 26, (w - 10) / 2, h - 34); g.lineStyle(2, 0x000000, .25).lineBetween(x, y0 + 26, x, y0 + h - 8);
      g.fillStyle(0xfdf6e6).fillRect(x - 17, y0 - 2, 34, 34).fillStyle(0x000000, .25).fillRect(x - 17, y0 + 28, 34, 4); g.fillStyle(0xffffff).fillRect(x - 3, y0 + 4, 6, 22).fillRect(x - 10, y0 + 10, 20, 6); break; }
    case 'plaza': { // shopping plaza: flat roof, skylights, rooftop units, coloured parapet
      const w = 150 + r() * 40, h = 104 + r() * 16, x0 = x - w / 2, y0 = y - h / 2;
      g.fillStyle(0x000000, .3).fillRect(x0 + 14, y0 + 14, w, h); g.fillStyle(0xe9edef).fillRect(x0, y0, w, h); g.fillStyle([0xff8c1a, 0x2ea3f2, 0xe8452c, 0x3fbf60][Math.floor(r() * 4)]).fillRect(x0, y0, w, 8);
      g.fillStyle(0xbfc6ca).fillRect(x0 + 8, y0 + 14, w - 16, h - 22); for (let k = 0; k < 3; k++) g.fillStyle(0x7fb6d6, .8).fillRect(x0 + 18 + k * ((w - 50) / 3), y0 + 26, (w - 60) / 3, 22);
      for (let k = 0; k < 4; k++) g.fillStyle(0x8a9094).fillRect(x0 + 16 + k * 30, y0 + h - 34, 20, 16).lineStyle(1, 0x000000, .25).strokeRect(x0 + 16 + k * 30, y0 + h - 34, 20, 16);
      g.lineStyle(2, 0x000000, .2).strokeRect(x0, y0, w, h); break; }
    case 'station': { // filling station: canopy over pumps + shop box
      const w = 124, h = 76, x0 = x - w / 2, y0 = y - h / 2, red = r() < .5;
      g.fillStyle(0x000000, .26).fillRect(x0 + 12, y0 + 12, w, h); g.fillStyle(0xf2e6cc).fillRect(x0 - 70, y0 + h - 40, 50, 36);
      g.fillStyle(0xeeeeee).fillRect(x0, y0, w, h); g.fillStyle(red ? 0xd62d20 : 0x1f5fa8).fillRect(x0, y0, w, 9).fillRect(x0, y0 + h - 9, w, 9); g.lineStyle(2, 0x000000, .2).strokeRect(x0, y0, w, h);
      for (let k = 0; k < 4; k++) g.fillStyle(0x24292c).fillRect(x0 + 16 + k * 28, y0 + h / 2 - 8, 10, 16); break; }
    case 'lamp': g.fillStyle(0xffe9b0, .09).fillCircle(x, y, 30).fillStyle(0xffe9b0, .18).fillCircle(x, y, 15).fillStyle(0xffffff).fillCircle(x, y, 4); break;
  }
}
function landmark(g: Phaser.GameObjects.Graphics, kind: Layout['landmark'], c: { x: number; y: number }, r: () => number) {
  switch (kind) {
    case 'plaza': g.fillStyle(0xffffff).fillCircle(c.x, c.y, 340).fillStyle(0x167a34).fillCircle(c.x, c.y, 322).fillStyle(0xff8c1a).fillCircle(c.x, c.y, 250).fillStyle(0xffffff).fillCircle(c.x, c.y, 226)
      .fillStyle(0x0f8a45).fillCircle(c.x, c.y, 200).fillStyle(0xffffff).fillCircle(c.x, c.y, 92).fillStyle(0xbfe8ff).fillCircle(c.x, c.y, 80).fillStyle(0xffffff).fillCircle(c.x, c.y, 26); break;
    case 'stadium': g.fillStyle(0xffffff).fillEllipse(c.x, c.y, 1520, 340).fillStyle(0xff8c1a).fillEllipse(c.x, c.y, 1440, 300).fillStyle(0x0f8a45).fillEllipse(c.x, c.y, 1260, 240)
      .fillStyle(0x1f9d4b).fillRect(c.x - 460, c.y - 84, 920, 168); for (let i = 0; i < 8; i++) g.fillStyle(i % 2 ? 0x1f9d4b : 0x27b356).fillRect(c.x - 460 + i * 115, c.y - 84, 115, 168);
      g.lineStyle(3, 0xffffff, .9).strokeRect(c.x - 460, c.y - 84, 920, 168).lineBetween(c.x, c.y - 84, c.x, c.y + 84).strokeCircle(c.x, c.y, 34);
      for (const [dx, dy] of [[-700, -140], [700, -140], [-700, 140], [700, 140]]) g.fillStyle(0xffffff, .25).fillCircle(c.x + dx, c.y + dy, 40).fillStyle(0xffffff).fillCircle(c.x + dx, c.y + dy, 8); break;
    case 'airport': { g.fillStyle(0x1b1f1e).fillRect(c.x - 2300, c.y - 70, 4600, 140).lineStyle(4, 0xffffff, .8).strokeRect(c.x - 2300, c.y - 70, 4600, 140);
      for (let x = -2200; x < 2200; x += 180) g.fillStyle(0xffffff, .85).fillRect(c.x + x, c.y - 3, 90, 6);
      g.fillStyle(0x000000, .25).fillRect(c.x - 280, c.y - 470, 620, 170).fillStyle(0xffffff).fillRect(c.x - 300, c.y - 490, 620, 170).fillStyle(0x0f8a45).fillRect(c.x - 300, c.y - 490, 620, 34).fillStyle(0xff8c1a).fillRect(c.x - 300, c.y - 456, 620, 14);
      const px = c.x - 700; g.fillStyle(0x000000, .25).fillEllipse(px + 12, c.y + 14, 230, 30).fillStyle(0xffffff).fillEllipse(px, c.y, 230, 30).fillTriangle(px + 20, c.y, px - 30, c.y - 130, px - 60, c.y).fillTriangle(px + 20, c.y, px - 30, c.y + 130, px - 60, c.y)
        .fillStyle(0x0f8a45).fillTriangle(px - 100, c.y, px - 120, c.y - 46, px - 70, c.y).fillTriangle(px - 100, c.y, px - 120, c.y + 46, px - 70, c.y).fillStyle(0xff8c1a).fillRect(px - 70, c.y - 3, 150, 6); break; }
    case 'market': for (let i = 0; i < 36; i++) { const x = c.x - 520 + (i % 6) * 190, y = c.y - 380 + Math.floor(i / 6) * 150; prop(g, i % 3 === 0 ? 'kiosk' : 'umbrella', x, y, r); } break;
    case 'estate': for (let i = 0; i < 9; i++) prop(g, i % 3 === 1 ? 'duplex' : 'bungalow', c.x - 420 + (i % 3) * 420, c.y - 420 + Math.floor(i / 3) * 420, r); break;
    case 'circuit': g.fillStyle(0x000000, .35).fillRect(c.x - 380, c.y - 40, 800, 130).fillStyle(0xffffff).fillRect(c.x - 400, c.y - 60, 800, 130).fillStyle(0xff8c1a).fillRect(c.x - 400, c.y - 60, 800, 34).fillStyle(0x0f8a45).fillRect(c.x - 400, c.y - 26, 800, 34).fillStyle(0xffffff).fillRect(c.x - 400, c.y + 8, 800, 34);
      for (let i = -6; i <= 6; i++) g.fillStyle(0xffffff, .22).fillCircle(c.x + i * 62, c.y - 90, 30).fillStyle(0xffffff).fillCircle(c.x + i * 62, c.y - 90, 6); break;
  }
}

/** Road, kerbs, verge, decor and landmark are baked into per-cell Graphics; cells off-screen are hidden so only ~4 render per frame. */
export function buildWorld(s: Phaser.Scene, t: Track, layout: Layout, d: District, r: () => number) {
  const cells = new Map<string, Cell>(), pal = d.palette, W = t.width;
  const cell = (x: number, y: number): Cell => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), k = cx + ',' + cy;
    let c = cells.get(k); if (!c) { c = { cx, cy, shoulder: s.add.graphics().setDepth(-3), kerb: s.add.graphics().setDepth(-2), road: s.add.graphics().setDepth(-1), deco: s.add.graphics().setDepth(3) }; cells.set(k, c); } return c; };
  const lm = s.add.graphics().setDepth(-4); landmark(lm, layout.landmark, t.center, r);
  // road in runs of consecutive samples that share a cell (1 sample overlap each side => no seams)
  let i = 0;
  while (i < t.n) {
    const c = cell(t.pts[i].x, t.pts[i].y); let j = i; while (j + 1 < t.n) { const q = t.pts[j + 1], k = Math.floor(q.x / CELL) + ',' + Math.floor(q.y / CELL); if (k !== c.cx + ',' + c.cy) break; j++; }
    const idx: number[] = []; for (let k = i - 1; k <= j + 1; k++) idx.push((k + t.n) % t.n);
    const line = (off: number) => idx.map(k => new Phaser.Math.Vector2(t.pts[k].x + t.nrm[k].x * off, t.pts[k].y + t.nrm[k].y * off));
    const mid = line(0);
    c.shoulder.lineStyle(W + 130, pal.shoulder, .9).strokePoints(mid, false, false);
    c.kerb.lineStyle(W + 24, 0xffffff, 1).strokePoints(mid, false, false); c.kerb.lineStyle(W + 24, 0xff8c1a, 1);
    for (let k = 0; k < mid.length - 1; k++) if (k % 4 < 2) c.kerb.lineBetween(mid[k].x, mid[k].y, mid[k + 1].x, mid[k + 1].y);
    c.road.lineStyle(W, pal.road, 1).strokePoints(mid, false, false);
    c.road.lineStyle(5, 0xffffff, .85).strokePoints(line(W / 2 - 16), false, false).strokePoints(line(-(W / 2 - 16)), false, false);
    c.road.lineStyle(6, 0xffffff, .6); for (let k = 0; k < mid.length - 1; k += 3) c.road.lineBetween(mid[k].x, mid[k].y, mid[k + 1].x, mid[k + 1].y);
    i = j + 1;
  }
  // roadside decor by district mix
  const wts = Object.entries(d.decor) as [Decor, number][], total = wts.reduce((a, [, w]) => a + w, 0);
  const pick = (): Decor => { let x = r() * total; for (const [k, w] of wts) if ((x -= w) < 0) return k; return wts[0][0]; };
  for (let k = 0; k < t.n; k += W < 300 ? 2 : 3) for (const side of [-1, 1]) {
    const kind = pick(), ext = DECOR_EXT[kind], big = ext > 60, off = side * (W / 2 + (kind === 'lamp' ? 46 : big ? 80 + ext + r() * 180 : 130 + r() * 200)), q = at(t, k + r(), off);
    if (locate(t, q.x, q.y, -1).d < W / 2 + (kind === 'lamp' ? 30 : big ? 70 + ext : 100)) continue; prop(cell(q.x, q.y).deco, kind, q.x, q.y, r);
  }
  const xs = t.pts.map(p => p.x), ys = t.pts.map(p => p.y), x0 = Math.min(...xs) - 600, y0 = Math.min(...ys) - 600, bw = Math.max(...xs) - x0 + 600, bh = Math.max(...ys) - y0 + 600;
  for (let k = 0; k < 150; k++) { const x = x0 + r() * bw, y = y0 + r() * bh; if (locate(t, x, y, -1).d < W / 2 + 280) continue; prop(cell(x, y).deco, (['palm', 'tree', 'shrub'] as Decor[])[Math.floor(r() * 3)], x, y, r); }
  let frame = 0;
  return { cells: cells.size, update(v: ViewRect, force = false) {
    if (!force && frame++ % 8) return; const m = 420;
    cells.forEach(c => { const vis = c.cx * CELL - m < v.right && (c.cx + 1) * CELL + m > v.x && c.cy * CELL - m < v.bottom && (c.cy + 1) * CELL + m > v.y; c.shoulder.setVisible(vis); c.kerb.setVisible(vis); c.road.setVisible(vis); c.deco.setVisible(vis); });
  } };
}
