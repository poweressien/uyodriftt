import Phaser from 'phaser';
const G = (s: Phaser.Scene) => s.make.graphics({ x: 0, y: 0 }, false);
const shade = (c: number, f: number) => { const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f); return (r << 16) | (g << 8) | b; };
export const WHEEL_TINT: Record<string, number> = { stock: 0x9aa0a6, sport: 0x2a2d30, chrome: 0xeef3f6, gold: 0xff8c1a };

const S = 2; // car textures are drawn at 2x and displayed at half scale, so they stay crisp at the hood-view zoom
type Ctx = CanvasRenderingContext2D;
function paint(s: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  const t = s.textures.createCanvas(key, w * S, h * S); if (!t) return; const c = t.getContext(); c.scale(S, S); draw(c); t.refresh();
}
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
/** Closed smooth outline through the control points (mid-point quadratic scheme). */
const smooth = (c: Ctx, pts: number[][]) => { const n = pts.length, mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; let m = mid(pts[n - 1], pts[0]); c.beginPath(); c.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i]; m = mid(p, pts[(i + 1) % n]); c.quadraticCurveTo(p[0], p[1], m[0], m[1]); } c.closePath(); };
const TOP = [[1.5, 7.5], [4, 5], [10, 3.6], [20, 3.1], [32, 3], [44, 3.1], [52, 3.6], [58, 5.2], [62, 8], [63.8, 12]];
const OUTLINE = [...TOP, ...TOP.map(([x, y]) => [x, 30 - y]).reverse()];
const bodyPath = (c: Ctx) => smooth(c, OUTLINE);
const flipY = (pts: number[][]) => pts.map(([x, y]) => [x, 30 - y]);
const poly = (c: Ctx, pts: number[][]) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };

/** All art is generated in code: nothing to download, easy to swap for sprites later. Car faces +x. */
export function makeTextures(s: Phaser.Scene) {
  if (s.textures.exists('car-body')) return;
  paint(s, 'coin', 40, 40, c => { // gold coin with a raised rim and a naira-style N
    const g = c.createRadialGradient(15, 14, 2, 20, 20, 19); g.addColorStop(0, '#fff3b0'); g.addColorStop(.55, '#ffc531'); g.addColorStop(1, '#c47a0a'); c.fillStyle = g; c.beginPath(); c.arc(20, 20, 18, 0, 7); c.fill();
    c.strokeStyle = '#8a5200'; c.lineWidth = 2; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4; c.beginPath(); c.arc(20, 20, 13.5, 0, 7); c.stroke();
    c.strokeStyle = '#8a5200'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(14, 27); c.lineTo(14, 13); c.lineTo(26, 27); c.lineTo(26, 13); c.stroke(); c.lineWidth = 1.8; c.beginPath(); c.moveTo(11, 18); c.lineTo(29, 18); c.moveTo(11, 22.5); c.lineTo(29, 22.5); c.stroke();
  });
  // ---- car: shaded greyscale body (tinted to the paint colour at runtime), then untinted gloss / glass / lights on top
  paint(s, 'car-body', 64, 30, c => {
    bodyPath(c); const g = c.createLinearGradient(0, 3, 0, 27);
    [[0, '#7f7f7f'], [.1, '#bdbdbd'], [.3, '#ececec'], [.5, '#ffffff'], [.7, '#eeeeee'], [.9, '#b4b4b4'], [1, '#777777']].forEach(([o, col]) => g.addColorStop(o as number, col as string)); c.fillStyle = g; c.fill();
    c.save(); bodyPath(c); c.clip();
    const lg = c.createLinearGradient(0, 0, 64, 0); lg.addColorStop(0, 'rgba(0,0,0,.2)'); lg.addColorStop(.28, 'rgba(0,0,0,0)'); lg.addColorStop(.8, 'rgba(255,255,255,.05)'); lg.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = lg; c.fillRect(0, 0, 64, 30);
    c.fillStyle = 'rgba(0,0,0,.34)'; for (const [x, y] of [[16, 2.2], [16, 27.8], [49, 2.2], [49, 27.8]]) { c.beginPath(); c.ellipse(x, y, 8.4, 4.2, 0, 0, 7); c.fill(); } // wheel arches
    c.strokeStyle = 'rgba(0,0,0,.26)'; c.lineWidth = .5; for (const y of [12.4, 17.6]) { c.beginPath(); c.moveTo(45, y); c.lineTo(60, y + (y < 15 ? -.8 : .8)); c.stroke(); } // bonnet creases
    for (const y of [4.7, 25.3]) { c.beginPath(); c.moveTo(13, y); c.lineTo(50, y); c.stroke(); } // sill creases
    c.beginPath(); c.moveTo(7, 15); c.lineTo(11, 15); c.stroke(); // boot seam
    const rg = c.createLinearGradient(0, 8, 0, 22); rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(.5, 'rgba(255,255,255,.2)'); rg.addColorStop(1, 'rgba(0,0,0,.12)'); rr(c, 22.5, 7.8, 19, 14.4, 4.5); c.fillStyle = rg; c.fill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = .6; c.stroke(); // roof panel
    bodyPath(c); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.6; c.stroke(); c.restore();
    for (const y of [1.4, 26.4]) { const mg = c.createLinearGradient(0, y, 0, y + 2.6); mg.addColorStop(0, '#f4f4f4'); mg.addColorStop(1, '#9a9a9a'); rr(c, 42.5, y, 5, 2.6, 1.1); c.fillStyle = mg; c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .4; c.stroke(); } // door mirrors
  });
  paint(s, 'car-wheels', 64, 30, c => {
    for (const [cx, top] of [[16, 0], [16, 23.2], [49, 0], [49, 23.2]]) { const h = 6.8, tg = c.createLinearGradient(0, top, 0, top + h); tg.addColorStop(0, '#2a2a2a'); tg.addColorStop(.5, '#0c0c0c'); tg.addColorStop(1, '#232323'); rr(c, cx - 7.4, top, 14.8, h, 2.4); c.fillStyle = tg; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = .35; for (let k = -6; k <= 6; k += 1.6) { c.beginPath(); c.moveTo(cx + k, top + .6); c.lineTo(cx + k, top + h - .6); c.stroke(); }
      const ry = top < 10 ? top + 1.2 : top + h - 3.4; rr(c, cx - 3.6, ry, 7.2, 2.2, 1); c.fillStyle = '#f2f2f2'; c.fill(); } // rims: lit by wheel tint
  });
  paint(s, 'car-glass', 64, 30, c => {
    const pane = (pts: number[][], x0: number, x1: number) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#0a141b'); g.addColorStop(.6, '#1a3140'); g.addColorStop(1, '#2c4a5c'); poly(c, pts); c.fillStyle = g; c.fill(); c.save(); poly(c, pts); c.clip(); c.fillStyle = 'rgba(255,255,255,.17)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(64, 0); c.lineTo(52, 30); c.lineTo(40, 30); c.closePath(); c.fill(); c.restore(); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = .5; poly(c, pts); c.stroke(); };
    const ws = [[41.6, 7.2], [49.6, 9.8], [49.6, 20.2], [41.6, 22.8]], rw = [[16.6, 7.6], [9.2, 9.6], [9.2, 20.4], [16.6, 22.4]];
    pane(ws, 41, 50); pane(rw, 9, 17);
    for (const side of [[[18.6, 6.1], [28.4, 6.1], [28.4, 7.7], [18.2, 7.7]], [[31.6, 6.1], [40.6, 6.1], [41.4, 7.7], [31.6, 7.7]]]) { pane(side, 18, 41); pane(flipY(side), 18, 41); }
  });
  paint(s, 'car-detail', 64, 30, c => {
    const lamp = (pts: number[][], a: string, b: string) => { const g = c.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]); g.addColorStop(0, a); g.addColorStop(1, b); poly(c, pts); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = .4; c.stroke(); };
    const head = [[57.4, 5.2], [61.6, 6.6], [62.7, 8.2], [62.3, 10.6], [58, 8.8]], tail = [[.3, 5.8], [2.8, 6.8], [3, 10.6], [.4, 9.6]];
    lamp(head, '#ffffff', '#ffe08a'); lamp(flipY(head), '#ffffff', '#ffe08a'); lamp(tail, '#ff5a4d', '#9d1009'); lamp(flipY(tail), '#ff5a4d', '#9d1009');
    c.fillStyle = 'rgba(255,255,255,.9)'; for (const y of [7.6, 22.4]) { c.beginPath(); c.arc(61, y, .9, 0, 7); c.fill(); }
    rr(c, 62, 11.4, 2, 7.2, .6); c.fillStyle = '#0b0b0b'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = .3; for (let y = 12.6; y < 18.4; y += 1.5) { c.beginPath(); c.moveTo(62.2, y); c.lineTo(63.8, y); c.stroke(); } // grille
    rr(c, .1, 12.2, 1.8, 5.6, .4); c.fillStyle = '#f0f0f0'; c.fill(); c.strokeStyle = '#222'; c.lineWidth = .3; c.stroke(); // rear plate
    c.fillStyle = '#111'; c.beginPath(); c.ellipse(13.5, 15, 1.5, .8, 0, 0, 7); c.fill(); // roof antenna
  });
  paint(s, 'car-gloss', 64, 30, c => {
    c.save(); bodyPath(c); c.clip();
    const sp = (x: number, y: number, rx: number, ry: number, a: number, rot = 0) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(rx, ry); const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill(); c.restore(); };
    sp(54, 9.5, 9, 2.4, .42, -.1); sp(32, 10.5, 9, 2, .3); sp(6, 9.5, 3.4, 1.6, .22); sp(54, 20.5, 6, 1.4, .1, .1);
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = .7; c.beginPath(); c.moveTo(11, 3.8); c.lineTo(50, 3.7); c.stroke(); c.restore();
  });
  paint(s, 'car-brake', 64, 30, c => { for (const y of [8.2, 21.8]) { const g = c.createRadialGradient(1.5, y, 0, 1.5, y, 8); g.addColorStop(0, 'rgba(255,60,40,.9)'); g.addColorStop(1, 'rgba(255,60,40,0)'); c.fillStyle = g; c.fillRect(-8, y - 8, 20, 16); } });
  const decal = (key: string, fn: (c: Ctx) => void) => paint(s, key, 64, 30, c => { c.save(); bodyPath(c); c.clip(); fn(c); c.restore(); });
  decal('decal-stripes', c => { c.fillStyle = 'rgba(255,255,255,.93)'; c.fillRect(0, 11.2, 64, 3); c.fillRect(0, 15.8, 64, 3); });
  decal('decal-flames', c => { c.fillStyle = '#ff8c1a'; for (const [a, b, d] of [[8, 11, 13], [17, 19, 22], [12, 15, 18]]) { c.beginPath(); c.moveTo(64, a); c.lineTo(38 + (b - 11) , b); c.lineTo(64, d); c.closePath(); c.fill(); } c.fillStyle = '#ffd21f'; c.beginPath(); c.moveTo(64, 11); c.lineTo(48, 13); c.lineTo(64, 15); c.closePath(); c.fill(); });
  decal('decal-ibom-pride', c => { c.fillStyle = '#0f8a45'; c.fillRect(36, 0, 8, 30); c.fillStyle = '#fff'; c.fillRect(44, 0, 8, 30); c.fillStyle = '#ff8c1a'; c.fillRect(52, 0, 8, 30); });
  decal('decal-bus', c => { c.fillStyle = 'rgba(0,0,0,.16)'; for (const x of [14, 28, 42]) { rr(c, x, 10, 9, 10, 1.5); c.fill(); } c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(0, 13.4, 64, 3.2); });
  paint(s, 'car-shadow', 72, 34, c => { for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(0,0,0,.075)'; c.beginPath(); c.ellipse(35, 17, 34 - i * 1.3, 15.5 - i * .7, 0, 0, 7); c.fill(); } });

  let g = G(s); const done = (k: string, w: number, h: number) => { g.generateTexture(k, w, h); g.clear(); };
  g.fillStyle(0xffffff).fillCircle(6, 6, 6); done('dot', 12, 12);
  g.fillStyle(0xffffff, .22).fillCircle(16, 16, 16).fillStyle(0xffffff, .3).fillCircle(16, 16, 10).fillStyle(0xffffff, .35).fillCircle(16, 16, 5); done('smokep', 32, 32);
  g.fillStyle(0xffffff).fillRect(0, 0, 9, 4); done('skid', 9, 4);
  g.fillStyle(0x000000, .3).fillEllipse(15, 17, 28, 16); g.fillStyle(0xff8c1a).fillTriangle(15, 0, 3, 24, 27, 24); g.fillStyle(0xffffff).fillTriangle(15, 7, 9, 17, 21, 17); g.fillStyle(0xd96f00).fillRect(2, 23, 26, 4); done('cone', 30, 28);
  g.fillStyle(0x0d0f0e).fillEllipse(30, 19, 58, 36); g.fillStyle(0x1e2321).fillEllipse(30, 19, 46, 26); g.lineStyle(3, 0x4a3a2a, .9).strokeEllipse(30, 19, 58, 36); done('pothole', 60, 38);
  g.fillStyle(0x6fa8c8, .55).fillEllipse(60, 38, 118, 72); g.fillStyle(0x9fd0ea, .5).fillEllipse(52, 30, 70, 34); g.fillStyle(0xffffff, .35).fillEllipse(44, 26, 30, 10); done('puddle', 120, 76);
  for (let k = 0; k < 6; k++) { const L = 280 * (1 - k * .1), h = 62 * (1 - k * .11); g.fillStyle(0xfff6d0, .075).fillTriangle(0, 60, L, 60 - h, L, 60 + h); } done('beam', 280, 120);
  g.destroy();
}
/** Seamless 256px grass tile: patches, blades and tiny orange/white/yellow flowers. */
export function makeGrass(s: Phaser.Scene, key: string, base: number) {
  if (s.textures.exists(key)) return; const g = G(s), S = 256, r = Phaser.Math.RND;
  g.fillStyle(base).fillRect(0, 0, S, S);
  const blob = (x: number, y: number, rad: number, col: number, a: number) => { g.fillStyle(col, a); for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) g.fillCircle(x + dx, y + dy, rad); };
  for (let i = 0; i < 26; i++) blob(r.between(0, S), r.between(0, S), r.between(14, 34), shade(base, r.pick([.86, .92, 1.1, 1.16])), .5);
  g.lineStyle(1, shade(base, 1.28), .7); for (let i = 0; i < 260; i++) { const x = r.between(0, S), y = r.between(0, S); g.lineBetween(x, y, x + r.between(-2, 2), y - r.between(3, 6)); }
  g.lineStyle(1, shade(base, .72), .6); for (let i = 0; i < 160; i++) { const x = r.between(0, S), y = r.between(0, S); g.lineBetween(x, y, x + r.between(-2, 2), y - r.between(2, 5)); }
  for (let i = 0; i < 9; i++) blob(r.between(0, S), r.between(0, S), 2, r.pick([0xff8c1a, 0xffffff, 0xffd21f]), 1);
  g.generateTexture(key, S, S); g.destroy();
}
export interface CarOpts { color: number; decal?: string; glass?: number; wheel?: number; kind?: 'sedan' | 'suv' | 'bus'; x?: number; y?: number }
export const bodyShade = shade;
/** Layered car: shadow, wheels, tinted body, decal, gloss, glass, lights, brake glow. The container exposes `body` and `brake` via getData. */
export function buildCar(s: Phaser.Scene, o: CarOpts) {
  const im = (k: string, x = 0, y = 0) => s.add.image(x, y, k).setScale(1 / S), body = im('car-body').setTint(o.color), brake = im('car-brake').setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const parts: Phaser.GameObjects.GameObject[] = [im('car-shadow', 3, 4), im('car-wheels').setTint(o.wheel ?? WHEEL_TINT.stock), body];
  if (o.decal && o.decal !== 'none') parts.push(im(`decal-${o.decal}`)); if (o.kind === 'bus') parts.push(im('decal-bus'));
  parts.push(im('car-gloss'), im('car-glass').setAlpha(o.glass ?? .7), im('car-detail'), brake);
  const c = s.add.container(o.x ?? 0, o.y ?? 0, parts); c.setData('body', body); c.setData('brake', brake); c.setData('color', o.color);
  if (o.kind === 'suv') c.setScale(1.1, 1.16); else if (o.kind === 'bus') c.setScale(1.5, 1.22); return c;
}
