export interface VehicleStats { id: string; name: string; kind: 'sedan' | 'suv'; price: number; minRank: number; accel: number; handling: number; driftControl: number; topSpeed: number; weight: number; brake: number; color: number }
export const VEHICLES: VehicleStats[] = [
  { id: 'corolla', name: 'Toyota Corolla', kind: 'sedan', price: 0, minRank: 0, accel: 5, handling: 6, driftControl: 6, topSpeed: 5, weight: 5, brake: 5, color: 0xe6e6e6 },
  { id: 'camry', name: 'Toyota Camry', kind: 'sedan', price: 12000, minRank: 1, accel: 6, handling: 5, driftControl: 5, topSpeed: 6, weight: 6, brake: 6, color: 0x9aa0a4 },
  { id: 'highlander', name: 'Toyota Highlander', kind: 'suv', price: 18000, minRank: 2, accel: 5, handling: 4, driftControl: 4, topSpeed: 5, weight: 8, brake: 5, color: 0x2f4a66 },
  { id: 'venza', name: 'Toyota Venza', kind: 'suv', price: 20000, minRank: 2, accel: 6, handling: 5, driftControl: 5, topSpeed: 6, weight: 7, brake: 6, color: 0x7a5230 },
  { id: 'rx', name: 'Lexus RX', kind: 'suv', price: 30000, minRank: 3, accel: 7, handling: 6, driftControl: 6, topSpeed: 7, weight: 7, brake: 7, color: 0x1d2024 },
  { id: 'es', name: 'Lexus ES', kind: 'sedan', price: 32000, minRank: 3, accel: 7, handling: 7, driftControl: 7, topSpeed: 7, weight: 6, brake: 7, color: 0xa8281f },
  { id: 'c-class', name: 'Mercedes C-Class', kind: 'sedan', price: 45000, minRank: 4, accel: 8, handling: 8, driftControl: 8, topSpeed: 8, weight: 5, brake: 8, color: 0xc4c8d0 },
];
export type Upgrades = Record<'engine' | 'tires' | 'suspension' | 'brakes' | 'transmission' | 'turbo' | 'steering', number>;
export const NO_UPGRADES: Upgrades = { engine: 0, tires: 0, suspension: 0, brakes: 0, transmission: 0, turbo: 0, steering: 0 };
export const UPGRADE_CATS = Object.keys(NO_UPGRADES) as (keyof Upgrades)[];
/** Pixels per metre. A 62 px car is about 4.6 m long, so all real-world units (kg, N, W, m/s) convert through this. */
export const PPM = 13.5;
/** Legacy arcade fields (accel/maxSpeed/turnRate/grip/slide/brake, px units) plus the real vehicle-dynamics parameters (SI units) used by CarPhysics. */
export interface Phys {
  accel: number; maxSpeed: number; turnRate: number; grip: number; slide: number; brake: number;
  mass: number; power: number; mu: number; steerLock: number; brakeG: number; kDrag: number; driftAssist: number; hbGrip: number; vmax: number;
}
const G = 9.81, CRR = .015;
/** Stats + upgrades -> a real vehicle: kg, watts, tyre friction coefficient, steering lock, brake force. Drag is solved so the car tops out at its listed top speed. */
export function toPhysics(v: VehicleStats, u: Upgrades = NO_UPGRADES): Phys {
  const maxSpeed = (470 + v.topSpeed * 32) * (1 + u.transmission * .05 + u.turbo * .03), vmax = maxSpeed / PPM;
  const mass = 900 + v.weight * 110, power = (108 + v.accel * 13) * 1000 * (1 + u.engine * .07) * (1 + u.turbo * .04);
  const kDrag = Math.max(.25, (power * .88 / vmax - CRR * mass * G) / (vmax * vmax));
  return {
    accel: (150 + v.accel * 24) * (1 + u.engine * .07) * (1 + u.turbo * .04) / (1 + (v.weight - 5) * .05), maxSpeed, turnRate: (2.0 + v.handling * .14) * (1 + u.steering * .06),
    grip: .11 + v.handling * .012 + u.tires * .012 + u.suspension * .006, slide: Math.max(.04, .095 - v.driftControl * .006), brake: (380 + v.brake * 45) * (1 + u.brakes * .08),
    mass, power, kDrag, vmax, mu: .98 + v.handling * .032 + u.tires * .045 + u.suspension * .02, steerLock: (.42 + v.handling * .012) * (1 + u.steering * .06),
    brakeG: (.8 + v.brake * .035) * (1 + u.brakes * .07), driftAssist: .35 + v.driftControl * .05, hbGrip: .46 + v.driftControl * .012,
  };
}
export const KMH = .3; // px/s -> displayed km/h
