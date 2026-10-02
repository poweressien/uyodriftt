import type { CarPhysics } from './CarPhysics';
/** Oriented box: centre, heading, length (along heading) and width. */
export interface Box { x: number; y: number; h: number; l: number; w: number }
export interface Hit { nx: number; ny: number; depth: number; px: number; py: number }
/** Anything the player can bump. mass <= 0 means immovable (rail traffic, walls). */
export interface Body { x: number; y: number; vx: number; vy: number; mass: number; spin: number }

/** Separating-axis test for two rotated rectangles. Normal points from b towards a (the direction a is pushed). */
export function boxHit(a: Box, b: Box): Hit | null {
  const ac = Math.cos(a.h), as = Math.sin(a.h), bc = Math.cos(b.h), bs = Math.sin(b.h);
  const radius = (c: number, s: number, bx: Box, ux: number, uy: number) => Math.abs(ux * c + uy * s) * bx.l / 2 + Math.abs(-ux * s + uy * c) * bx.w / 2;
  const axes = [[ac, as], [-as, ac], [bc, bs], [-bs, bc]], dx = b.x - a.x, dy = b.y - a.y;
  let best = Infinity, bn = [0, 0];
  for (const [ux, uy] of axes) {
    const ov = radius(ac, as, a, ux, uy) + radius(bc, bs, b, ux, uy) - Math.abs(dx * ux + dy * uy);
    if (ov <= 0) return null;
    if (ov < best) { best = ov; bn = dx * ux + dy * uy > 0 ? [-ux, -uy] : [ux, uy]; }
  }
  // contact point: middle of the overlap along the contact normal, centred on the overlapping stretch of the sideways axis
  const [nx, ny] = bn, tx = -ny, ty = nx, ran = radius(ac, as, a, nx, ny), rat = radius(ac, as, a, tx, ty), rbt = radius(bc, bs, b, tx, ty), db = dx * tx + dy * ty;
  const mid = (Math.max(-rat, db - rbt) + Math.min(rat, db + rbt)) / 2;
  return { nx, ny, depth: best, px: a.x + tx * mid - nx * (ran - best / 2), py: a.y + ty * mid - ny * (ran - best / 2) };
}

/** Impulse response between the player and a body. Returns the impact speed (px/s) along the normal, 0 if already separating. */
export function resolveHit(P: CarPhysics, pm: number, o: Body, hit: Hit, e = .4): number {
  const { nx, ny, depth, px, py } = hit, im = 1 / pm, io = o.mass > 0 ? 1 / o.mass : 0, tot = im + io;
  P.x += nx * depth * (im / tot); P.y += ny * depth * (im / tot); o.x -= nx * depth * (io / tot); o.y -= ny * depth * (io / tot);
  const rvx = P.vx - o.vx, rvy = P.vy - o.vy, vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const j = -(1 + e) * vn / tot;
  P.vx += j * im * nx; P.vy += j * im * ny; o.vx -= j * io * nx; o.vy -= j * io * ny;
  const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = Math.max(-Math.abs(j) * .35, Math.min(Math.abs(j) * .35, -vt * .2 / tot)); // glancing friction
  P.vx += jt * im * tx; P.vy += jt * im * ty; o.vx -= jt * io * tx; o.vy -= jt * io * ty;
  // off-centre hits twist the car: torque = r x impulse
  const clampS = (v: number) => Math.max(-5, Math.min(5, v));
  P.spin += clampS((((px - P.x) * ny - (py - P.y) * nx) * j) * .0007);
  if (io > 0) o.spin += clampS(((((px - o.x) * -ny - (py - o.y) * -nx)) * j) * .0007);
  return -vn;
}
