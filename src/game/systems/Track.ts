import type { Layout } from '../data/layouts';
export interface V { x: number; y: number }
export interface Track { pts: V[]; tan: V[]; nrm: V[]; n: number; width: number; center: V }
const SPACING = 40;

/** Closed Catmull-Rom spline resampled at ~constant spacing. */
export function buildTrack(l: Layout): Track {
  const P = l.points.map(([x, y]) => ({ x, y })), m = P.length, dense: V[] = [];
  const cr = (a: number, b: number, c: number, d: number, t: number) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < m; i++) {
    const p0 = P[(i + m - 1) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    for (let s = 0; s < 40; s++) { const t = s / 40; dense.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t) }); }
  }
  const pts: V[] = [dense[0]]; let acc = 0;
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length]; acc += Math.hypot(b.x - a.x, b.y - a.y);
    if (acc >= SPACING) { pts.push(b); acc = 0; }
  }
  if (Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < SPACING * .5) pts.pop();
  const n = pts.length, tan: V[] = [], nrm: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    tan.push({ x: dx / len, y: dy / len }); nrm.push({ x: -dy / len, y: dx / len });
  }
  return { pts, tan, nrm, n, width: l.width, center: { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n } };
}
/** Distance to the centreline; windowed around `hint` (pass -1 for a full search). */
export function locate(t: Track, x: number, y: number, hint: number): { i: number; d: number } {
  const full = hint < 0, span = full ? t.n : 26, start = full ? 0 : hint - 13; let best = Infinity, bi = 0;
  for (let k = 0; k < span; k++) {
    const i = (start + k + t.n) % t.n, a = t.pts[i], b = t.pts[(i + 1) % t.n], abx = b.x - a.x, aby = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / (abx * abx + aby * aby || 1)));
    const dx = x - (a.x + abx * u), dy = y - (a.y + aby * u), d = dx * dx + dy * dy; if (d < best) { best = d; bi = i; }
  }
  return { i: bi, d: Math.sqrt(best) };
}
/** World position at fractional index f, offset sideways by `off` px. */
export function at(t: Track, f: number, off = 0): V {
  const i = Math.floor(f) % t.n, u = f - Math.floor(f), a = t.pts[i], b = t.pts[(i + 1) % t.n], nr = t.nrm[i];
  return { x: a.x + (b.x - a.x) * u + nr.x * off, y: a.y + (b.y - a.y) * u + nr.y * off };
}
