/** Pure race maths (no Phaser): deterministic rivals, finish times, places and elimination picks. Both phones of a live race run the same
 *  numbers from the same seed, so rivals are in the same place on both screens without sending them over the network. */
export const M_PER_PX = 1 / 12;
export const HP_MAX = 100;

export function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** One deterministic rival: speed = b * (1 + a*sin(w t + ph)), a gentle weave across its lane. */
import type { Body } from '../data/vehicles';
export interface BotP { id: string; name: string; b: number; a: number; w: number; ph: number; lane: number; amp: number; w2: number; ph2: number; kind: Body; color: number }
const COLORS = [0xa8281f, 0x2f4a66, 0xe6e6e6, 0x2c6b3e, 0xf2c200, 0x7a5230, 0x1d2024, 0x8a8f94];
/** `ratioHi` is the fastest rival's average speed as a share of the player's top speed. */
export function makeBots(seed: number, names: string[], n: number, playerMax: number, ratioHi: number, laneCount: number): BotP[] {
  const r = mulberry(seed ^ 0x9e3779b1), out: BotP[] = [];
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) : 1, ratio = (ratioHi - .2) + k * .2 + (r() - .5) * .03;
    out.push({ id: 'b' + i, name: names[i % names.length], b: playerMax * ratio, a: .06 + r() * .06, w: .35 + r() * .35, ph: r() * 6.28, lane: i % laneCount, amp: .22 + r() * .12, w2: .4 + r() * .4, ph2: r() * 6.28, kind: r() < .65 ? 'sedan' : 'suv', color: COLORS[Math.floor(r() * COLORS.length)] });
  }
  return out;
}
/** Distance driven (px) after t seconds. */
export const botDist = (p: BotP, t: number) => t <= 0 ? 0 : p.b * (t + p.a / p.w * (Math.cos(p.ph) - Math.cos(p.w * t + p.ph)));
export const botSpeed = (p: BotP, t: number) => p.b * (1 + p.a * Math.sin(p.w * t + p.ph));
/** After elimination at `te` the car coasts to a halt. */
export function botDistOut(p: BotP, te: number | undefined, t: number) {
  if (te === undefined || t <= te) return botDist(p, t); const v = botSpeed(p, te), tau = 1.1; return botDist(p, te) + v * tau * (1 - Math.exp(-(t - te) / tau));
}
/** Seconds until the rival has driven `px` (monotonic, so bisection is exact enough). */
export function botTimeTo(p: BotP, px: number): number { let lo = 0, hi = 2000; if (botDist(p, hi) < px) return Infinity; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (botDist(p, m) >= px) hi = m; else lo = m; } return hi; }

export interface Standing { id: string; prog: number; out?: boolean; fin?: number }
/** Order: finished first (earlier time first), then by distance. Eliminated cars go last (latest elimination ranks higher). */
export function rankAll(list: (Standing & { outT?: number })[]): string[] {
  return [...list].sort((a, b) => {
    const ao = a.out ? 1 : 0, bo = b.out ? 1 : 0; if (ao !== bo) return ao - bo; if (ao && bo) return (b.outT ?? 0) - (a.outT ?? 0);
    const af = a.fin !== undefined, bf = b.fin !== undefined; if (af && bf) return a.fin! - b.fin!; if (af !== bf) return af ? -1 : 1; return b.prog - a.prog;
  }).map(s => s.id);
}
/** The car to knock out: last place among those still running (ties broken by id so both phones agree). */
export function lastPlace(list: Standing[]): string | null {
  const alive = list.filter(s => !s.out); if (alive.length < 2) return null;
  return [...alive].sort((a, b) => a.prog - b.prog || (a.id < b.id ? -1 : 1))[0].id;
}
/** Hit damage from the closing speed (px/s) and the other car's weight relative to mine. */
export const hitDamage = (closing: number, otherMass: number, myMass: number) => Math.max(2, Math.min(38, (closing / 420) * 30 * Math.sqrt(otherMass / myMass) + 3));
/** Damaged cars lose power: 100% hp = full, 0% = 72%. */
export const powerFactor = (hp: number) => .72 + .28 * Math.max(0, Math.min(1, hp / HP_MAX));
export const placeLabel = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
