/** Body shapes. Each has its own 3D model, top-view size and wheelbase. */
export type Body = 'sedan' | 'coupe' | 'suv' | 'pickup' | 'minibus' | 'bus' | 'keke';
/** pl/pw: length and width in world pixels (hit box); sx/sy: top-view sprite scale; L: wheelbase in metres; label: shown in menus. */
export const BODY: Record<Body, { pl: number; pw: number; sx: number; sy: number; L: number; label: string }> = {
  sedan: { pl: 62, pw: 27, sx: 1, sy: 1, L: 2.7, label: 'Sedan' },
  coupe: { pl: 60, pw: 26, sx: .97, sy: .95, L: 2.6, label: 'Coupe' },
  suv: { pl: 68, pw: 31, sx: 1.1, sy: 1.16, L: 2.85, label: 'SUV' },
  pickup: { pl: 74, pw: 31, sx: 1.19, sy: 1.15, L: 3.1, label: 'Pickup' },
  minibus: { pl: 82, pw: 32, sx: 1.32, sy: 1.18, L: 3.1, label: 'Minibus' },
  bus: { pl: 92, pw: 34, sx: 1.5, sy: 1.22, L: 4.0, label: 'Coach' },
  keke: { pl: 40, pw: 24, sx: .66, sy: .88, L: 2.0, label: 'Keke' },
};
export interface VehicleStats { id: string; name: string; kind: Body; price: number; minRank: number; accel: number; handling: number; driftControl: number; topSpeed: number; weight: number; brake: number; color: number; premium?: string; kg?: number; pwr?: number; speedK?: number; livery?: string; blurb?: string }
export const VEHICLES: VehicleStats[] = [
  { id: 'keke', name: 'Keke NAPEP', kind: 'keke', price: 4000, minRank: 0, accel: 3, handling: 8, driftControl: 9, topSpeed: 2, weight: 1, brake: 3, color: 0xffc41f, kg: 520, pwr: .34, speedK: .66, blurb: 'Tiny, tippy and made for sliding. Slow, but it spins on a coin.' },
  { id: 'corolla', name: 'Toyota Corolla', kind: 'sedan', price: 0, minRank: 0, accel: 5, handling: 6, driftControl: 6, topSpeed: 5, weight: 5, brake: 5, color: 0xe6e6e6, blurb: 'The Naija classic. Honest and easy.' },
  { id: 'danfo', name: 'Danfo Bus', kind: 'minibus', price: 14000, minRank: 1, accel: 3, handling: 3, driftControl: 5, topSpeed: 3, weight: 8, brake: 3, color: 0xf5b800, kg: 2100, speedK: .8, livery: 'danfo', blurb: 'Yellow with the black stripe. Heavy, but funny to drift.' },
  { id: 'accord', name: 'Honda Accord', kind: 'sedan', price: 9000, minRank: 1, accel: 5, handling: 6, driftControl: 6, topSpeed: 6, weight: 5, brake: 5, color: 0x2f4a66 },
  { id: 'altima', name: 'Nissan Altima', kind: 'sedan', price: 10500, minRank: 1, accel: 6, handling: 6, driftControl: 6, topSpeed: 6, weight: 5, brake: 5, color: 0x7d1f26 },
  { id: 'camry', name: 'Toyota Camry', kind: 'sedan', price: 12000, minRank: 1, accel: 6, handling: 5, driftControl: 5, topSpeed: 6, weight: 6, brake: 6, color: 0x9aa0a4 },
  { id: 'hiace', name: 'Toyota HiAce Mini Bus', kind: 'minibus', price: 16000, minRank: 1, accel: 4, handling: 3, driftControl: 4, topSpeed: 4, weight: 8, brake: 4, color: 0xf2f2f2, kg: 2000, speedK: .85, blurb: 'Carries the whole street. Slow to turn, hard to stop.' },
  { id: 'highlander', name: 'Toyota Highlander', kind: 'suv', price: 18000, minRank: 2, accel: 5, handling: 4, driftControl: 4, topSpeed: 5, weight: 8, brake: 5, color: 0x2f4a66 },
  { id: 'venza', name: 'Toyota Venza', kind: 'suv', price: 20000, minRank: 2, accel: 6, handling: 5, driftControl: 5, topSpeed: 6, weight: 7, brake: 6, color: 0x7a5230 },
  { id: 'hilux', name: 'Toyota Hilux', kind: 'pickup', price: 24000, minRank: 2, accel: 6, handling: 5, driftControl: 6, topSpeed: 6, weight: 7, brake: 6, color: 0xe8e8e8, kg: 1900, speedK: .97, blurb: 'Tough as an Akwa Ibom road. Light rear end, easy to kick out.' },
  { id: 'rx', name: 'Lexus RX', kind: 'suv', price: 30000, minRank: 3, accel: 7, handling: 6, driftControl: 6, topSpeed: 7, weight: 7, brake: 7, color: 0x1d2024 },
  { id: 'es', name: 'Lexus ES', kind: 'sedan', price: 32000, minRank: 3, accel: 7, handling: 7, driftControl: 7, topSpeed: 7, weight: 6, brake: 7, color: 0xa8281f },
  { id: 'bmw3', name: 'BMW 330i', kind: 'sedan', price: 36000, minRank: 3, accel: 8, handling: 8, driftControl: 8, topSpeed: 8, weight: 5, brake: 8, color: 0x1f4aa8, blurb: 'Rear drive, balanced, loves a slide.' },
  { id: 'patrol', name: 'Nissan Patrol', kind: 'suv', price: 38000, minRank: 3, accel: 7, handling: 6, driftControl: 6, topSpeed: 7, weight: 9, brake: 7, color: 0xefeee6 },
  { id: '350z', name: 'Nissan 350Z', kind: 'coupe', price: 40000, minRank: 4, accel: 8, handling: 8, driftControl: 10, topSpeed: 8, weight: 4, brake: 7, color: 0xb7bcc2, blurb: 'The drift legend. Short, light and happy sideways.' },
  { id: 'c-class', name: 'Mercedes C-Class', kind: 'sedan', price: 45000, minRank: 4, accel: 8, handling: 8, driftControl: 8, topSpeed: 8, weight: 5, brake: 8, color: 0xc4c8d0 },
  { id: 'tahoe', name: 'Chevrolet Tahoe', kind: 'suv', price: 52000, minRank: 4, accel: 7, handling: 6, driftControl: 6, topSpeed: 7, weight: 9, brake: 7, color: 0x1a1d22 },
  { id: 'camaro', name: 'Chevrolet Camaro SS', kind: 'coupe', price: 58000, minRank: 5, accel: 9, handling: 7, driftControl: 9, topSpeed: 9, weight: 5, brake: 8, color: 0xff6a00, blurb: 'V8 muscle. Plenty of power to light up the rears.' },
  { id: 'e-class', name: 'Mercedes E-Class', kind: 'sedan', price: 62000, minRank: 5, accel: 9, handling: 8, driftControl: 8, topSpeed: 9, weight: 6, brake: 9, color: 0x1d2024 },
  { id: 'lx570', name: 'Lexus LX 570', kind: 'suv', price: 70000, minRank: 5, accel: 8, handling: 6, driftControl: 7, topSpeed: 8, weight: 9, brake: 8, color: 0x101214 },
  { id: 'range', name: 'Range Rover', kind: 'suv', price: 78000, minRank: 5, accel: 8, handling: 7, driftControl: 7, topSpeed: 8, weight: 8, brake: 8, color: 0x0f3d2a },
  { id: 'm4', name: 'BMW M4', kind: 'coupe', price: 85000, minRank: 6, accel: 9, handling: 9, driftControl: 9, topSpeed: 9, weight: 5, brake: 9, color: 0x1f8a5b, blurb: 'The best all-round drift machine in the game.' },
  { id: 'coach', name: 'Luxury Coach', kind: 'bus', price: 95000, minRank: 6, accel: 3, handling: 2, driftControl: 3, topSpeed: 4, weight: 10, brake: 3, color: 0x1c5fd0, kg: 5200, pwr: 1.9, speedK: .86, blurb: 'Interstate bus. Nobody overtakes you, nobody turns you either.' },
  { id: 'g-class', name: 'Mercedes G-Class', kind: 'suv', price: 110000, minRank: 6, accel: 9, handling: 7, driftControl: 8, topSpeed: 9, weight: 9, brake: 9, color: 0x232a2e },
  { id: 's-class', name: 'Mercedes S-Class', kind: 'sedan', price: 0, minRank: 0, premium: 'car_sclass', accel: 9, handling: 8, driftControl: 8, topSpeed: 10, weight: 6, brake: 9, color: 0x14181c },
  { id: 'escalade', name: 'Cadillac Escalade', kind: 'suv', price: 0, minRank: 0, premium: 'car_escalade', accel: 8, handling: 6, driftControl: 7, topSpeed: 9, weight: 10, brake: 8, color: 0x0b0c0e },
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
  /** wheelbase (m), weight-transfer scale, front-axle grip scale, gearbox shift time (s), crash damage scale, oversteer on throttle */
  L: number; xfer: number; fk: number; shift: number; armor: number; kick: number;
}
const G = 9.81, CRR = .015;
/** What each upgrade level does. Every level is meant to be felt: the Garage shows the resulting numbers. */
export const UPGRADE_FX: Record<keyof Upgrades, { name: string; per: string }> = {
  engine: { name: 'Engine', per: '+10% power, +1.2% top speed' },
  turbo: { name: 'Turbo', per: '+6% power, +1.2% top speed, more wheelspin kick' },
  transmission: { name: 'Transmission', per: '+3% top speed, faster shifts' },
  tires: { name: 'Tires', per: '+7% grip' },
  suspension: { name: 'Suspension', per: '+2.5% grip, steadier body, less crash damage' },
  brakes: { name: 'Brakes', per: '+10% braking' },
  steering: { name: 'Steering', per: '+7% steering lock, sharper front end' },
};
/** Stats + upgrades -> a real vehicle: kg, watts, tyre friction coefficient, steering lock, brake force. Drag is solved so the car tops out at its (upgraded) top speed. */
export function toPhysics(v: VehicleStats, u: Upgrades = NO_UPGRADES): Phys {
  const vmaxMul = Math.min(1.3, (1 + u.engine * .012) * (1 + u.turbo * .012) * (1 + u.transmission * .03));
  const maxSpeed = (470 + v.topSpeed * 32) * (v.speedK ?? 1) * vmaxMul, vmax = maxSpeed / PPM;
  const mass = v.kg ?? 900 + v.weight * 110, pMul = (1 + u.engine * .10) * (1 + u.turbo * .06), power = (108 + v.accel * 13) * 1000 * (v.pwr ?? 1) * pMul;
  const kDrag = Math.max(.25, (power * .88 / vmax - CRR * mass * G) / (vmax * vmax));
  const gripMul = 1 + u.tires * .07 + u.suspension * .025;
  return {
    accel: (150 + v.accel * 24) * pMul / (1 + (v.weight - 5) * .05), maxSpeed, turnRate: (2.0 + v.handling * .14) * (1 + u.steering * .07),
    grip: (.11 + v.handling * .012) * gripMul, slide: Math.max(.04, .095 - v.driftControl * .006), brake: (380 + v.brake * 45) * (1 + u.brakes * .10),
    mass, power, kDrag, vmax, mu: (.98 + v.handling * .032) * gripMul, steerLock: (.42 + v.handling * .012) * (1 + u.steering * .07),
    brakeG: (.8 + v.brake * .035) * (1 + u.brakes * .10), driftAssist: .35 + v.driftControl * .05, hbGrip: .46 + v.driftControl * .012,
    L: BODY[v.kind].L, xfer: 1 - u.suspension * .09, fk: 1 + u.steering * .04, shift: 1 - u.transmission * .13, armor: 1 - u.suspension * .07, kick: 1 + u.turbo * .06,
  };
}
export const KMH = .3; // px/s -> displayed km/h
