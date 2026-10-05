import type { Upgrades } from './data/vehicles';
import type { Weather } from './data/districts';
import type { Mode } from './data/settings';
import type { MpSession } from './systems/Net';
import type { RaceKind } from './data/races';
export interface CarLook { upgrades: Upgrades; paint: string | null; wheels: string; tint: number; decal: string; smoke: string; horn: string }
export interface RunConfig { districtId: string; vehicleId: string; car: CarLook; weather?: Weather; mode?: Mode; road?: string; mp?: MpSession | null; seed?: number; race?: RaceCfg }
/** Set for LGA Journey / Elimination / Demolition. `seed` makes the rivals identical on both phones in a live race. */
export interface RaceCfg { kind: RaceKind; route?: string; seed: number; role: 'solo' | 'host' | 'guest'; field: number }
export interface RaceResult { kind: RaceKind; place: number; of: number; won: boolean; kos: number; rams: number; wrecked: boolean; finished: boolean; prize: number; timeSec: number; routeId?: string; toRoute?: string }
export interface MpResult { oppName: string; oppScore: number; won: boolean; tie: boolean }
export interface RunResult {
  districtId: string; vehicleId: string; weather: Weather; points: number; durationSec: number; maxCombo: number; drifts: number; topSpeed: number; clean: boolean; cleanBonus: number; laps: number;
  mode?: Mode; distance?: number; crashes?: number; revives?: number; nearMisses?: number; pickups?: number; distanceM?: number; road?: string; mp?: MpResult; race?: RaceResult;
}
