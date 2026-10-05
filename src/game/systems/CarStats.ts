import { CarPhysics } from './CarPhysics';
import { toPhysics, NO_UPGRADES, KMH, PPM, type Upgrades, type VehicleStats } from '../data/vehicles';

export interface CarNumbers { top: number; zero100: number; brake100: number; grip: number; turn: number }
const cache = new Map<string, CarNumbers>();
/** The real numbers behind a car + its upgrades, measured by driving the actual physics model headlessly. Shown in the Garage so every upgrade level is visible. */
export function carNumbers(v: VehicleStats, u: Upgrades = NO_UPGRADES): CarNumbers {
  const key = v.id + JSON.stringify(u), hit = cache.get(key); if (hit) return hit;
  const p = toPhysics(v, u), kmh = (c: CarPhysics) => c.speed * KMH, go = { throttle: 1, brake: false, steer: 0, hand: false };
  let c = new CarPhysics(p), t = 0, z = 0; while (t < 40 && (c.speed < p.maxSpeed * .985 || !z)) { c.step(1 / 50, go, false); t += 1 / 50; if (!z && kmh(c) >= 100) z = t; if (t > 40) break; }
  const top = Math.round(c.speed * KMH);
  c = new CarPhysics(p); const s0 = 100 / KMH; c.vx = s0; c.vf = s0; let d = 0; t = 0;
  while (kmh(c) > 2 && t < 15) { const x0 = c.x; c.step(1 / 50, { throttle: 0, brake: true, steer: 0, hand: false }, false); d += Math.abs(c.x - x0); t += 1 / 50; }
  const out = { top, zero100: z || 99, brake100: Math.round(d / PPM), grip: Math.round(p.mu * 1.7 * 100) / 100, turn: Math.round(p.steerLock * (1 + (p.fk - 1)) * 57.3) };
  cache.set(key, out); return out;
}
