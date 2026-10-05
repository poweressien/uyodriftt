import type { Mode } from './settings';
/** Race modes that run on the endless road: rivals, damage, a finish line. Everything here is plain data. */
export type RaceKind = 'journey' | 'elim' | 'demo';
export const RACE_MODES: { id: RaceKind; name: string; tag: string; blurb: string }[] = [
  { id: 'journey', name: 'LGA Journey', tag: 'First to reach', blurb: 'Race from one Akwa Ibom LGA to the next. First to the town sign wins. Ram rivals to slow them down.' },
  { id: 'elim', name: 'Elimination', tag: 'Last car standing', blurb: 'Every 18 seconds the car in last place is knocked out. Stay ahead of the pack until you are the only one left.' },
  { id: 'demo', name: 'Demolition', tag: 'Smash and survive', blurb: 'No finish line. Wreck rivals with hard hits and keep your own car running. Three knockouts win.' },
];
export const raceName = (m?: Mode) => RACE_MODES.find(r => r.id === m)?.name ?? '';
/** Stylised routes between LGAs. Distances are game distances, not real road lengths. */
export interface Route { id: string; from: string; to: string; meters: number; road: string; scenery: string; minRank: number; legs: string[] }
export const ROUTES: Route[] = [
  { id: 'uyo-etinan', from: 'Uyo', to: 'Etinan', meters: 2400, road: 'expressway', scenery: 'stadium-road', minRank: 0, legs: ['Leaving Uyo', 'Open road', 'Approaching Etinan'] },
  { id: 'uyo-abak', from: 'Uyo', to: 'Abak', meters: 3200, road: 'dual', scenery: 'abak-road', minRank: 0, legs: ['Leaving Uyo', 'Long stretch', 'Approaching Abak'] },
  { id: 'uyo-itu', from: 'Uyo', to: 'Itu', meters: 3800, road: 'expressway', scenery: 'airport-road', minRank: 1, legs: ['Leaving Uyo', 'Open road', 'Approaching Itu'] },
  { id: 'uyo-ikot-ekpene', from: 'Uyo', to: 'Ikot Ekpene', meters: 4500, road: 'dual', scenery: 'oron-road', minRank: 1, legs: ['Leaving Uyo', 'Palm country', 'Approaching Ikot Ekpene'] },
  { id: 'uyo-oron', from: 'Uyo', to: 'Oron', meters: 5200, road: 'expressway', scenery: 'oron-road', minRank: 2, legs: ['Leaving Uyo', 'Market towns', 'Approaching Oron'] },
  { id: 'uyo-eket', from: 'Uyo', to: 'Eket', meters: 6500, road: 'expressway', scenery: 'airport-road', minRank: 3, legs: ['Leaving Uyo', 'Long haul', 'Approaching Eket'] },
  { id: 'eket-ikot-abasi', from: 'Eket', to: 'Ikot Abasi', meters: 5600, road: 'village', scenery: 'aka-road', minRank: 4, legs: ['Leaving Eket', 'Village road', 'Approaching Ikot Abasi'] },
];
export const routeById = (id?: string) => ROUTES.find(r => r.id === id) ?? ROUTES[0];
/** Rival names for bots. */
export const BOT_NAMES = ['Okon', 'Ekaette', 'Ime', 'Effiong', 'Utibe', 'Mfon', 'Aniekan', 'Nsikak'];
export const elimEvery = 18;       // seconds between eliminations
export const demoKoTarget = 3;
export const RACE_FIELD: Record<RaceKind, number> = { journey: 4, elim: 6, demo: 4 }; // cars on the grid including the player(s)
export const PRIZE: Record<RaceKind, number[]> = { journey: [3000, 1800, 1000, 500, 300, 200], elim: [3500, 2200, 1400, 900, 500, 300], demo: [3000, 1500, 800, 400, 200, 100] };
