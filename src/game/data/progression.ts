import { DISTRICTS } from './districts';
import { VEHICLES } from './vehicles';
export const RANKS = [
  { name: 'Street Learner', xp: 0, coins: 0, parts: 0 }, { name: 'Road Rookie', xp: 1000, coins: 1000, parts: 2 },
  { name: 'Corner Master', xp: 4000, coins: 2500, parts: 5 }, { name: 'Drift Captain', xp: 12000, coins: 5000, parts: 10 },
  { name: 'Street Legend', xp: 30000, coins: 10000, parts: 20 }, { name: 'Uyo Champion', xp: 70000, coins: 20000, parts: 40 },
  { name: 'King of Uyo Streets', xp: 150000, coins: 50000, parts: 100 },
];
export const rankFor = (xp: number) => RANKS.filter(r => xp >= r.xp).length - 1;

export const PAINTS = ['#e6e6e6', '#1d2024', '#a8281f', '#2f4a66', '#0f8a45', '#ff8c1a', '#f2c200', '#c4c8d0'];
export const WHEELS = ['stock', 'sport', 'chrome', 'gold'], DECALS = ['none', 'stripes', 'flames', 'ibom-pride'], HORNS = ['classic', 'danfo', 'keke', 'air'];
export const SMOKES: Record<string, string> = { white: '#ffffff', orange: '#ff8c1a', green: '#2fd06a', yellow: '#ffd21f', black: '#555555' };
/** "field:value" -> rank needed. Paint is always free. */
export const COSMETIC_MIN_RANK: Record<string, number> = {
  'wheels:sport': 1, 'wheels:chrome': 2, 'wheels:gold': 4, 'decal:stripes': 1, 'decal:flames': 2, 'decal:ibom-pride': 4,
  'smoke:orange': 1, 'smoke:green': 2, 'smoke:yellow': 3, 'smoke:black': 4, 'horn:danfo': 1, 'horn:air': 3, 'tint:2': 2, 'tint:3': 3,
};
export const UPGRADE_COST = (lvl: number) => ({ coins: 300 * (lvl + 1), parts: lvl >= 3 ? (lvl - 2) * 2 : 0 });

export function unlockLines(): string[][] {
  const t: string[][] = RANKS.map(() => []);
  DISTRICTS.forEach(d => d.minRank > 0 && t[d.minRank].push(`District: ${d.name}`));
  VEHICLES.forEach(v => v.minRank > 0 && t[v.minRank].push(`Car: ${v.name}`));
  for (const [k, r] of Object.entries(COSMETIC_MIN_RANK)) { const [f, v] = k.split(':'); t[r].push(`${f[0].toUpperCase() + f.slice(1)}: ${v}`); }
  return t;
}


/** Career events: one-off goals with a fixed place, mode and target. Each pays coins (and parts) once. */
export interface CareerEvent { id: string; name: string; description: string; mode: 'drift' | 'endless'; district: string; minRank: number; coins: number; parts: number; score?: number; distance?: number; topSpeed?: number; clean?: boolean; drifts?: number; laps?: number; road?: string }
export const EVENTS: CareerEvent[] = [
  { id: 'ev-plaza-3k', name: 'Plaza Warm-up', description: 'Score 3,000 on Ibom Plaza', mode: 'drift', district: 'ibom-plaza', minRank: 0, coins: 400, parts: 0, score: 3000 },
  { id: 'ev-plaza-laps', name: 'Round the Roundabout', description: 'Finish 4 laps of Ibom Plaza', mode: 'drift', district: 'ibom-plaza', minRank: 0, coins: 600, parts: 0, laps: 4 },
  { id: 'ev-stadium-fast', name: 'Stadium Sprint', description: 'Hit 150 km/h on Stadium Road', mode: 'drift', district: 'stadium-road', minRank: 0, coins: 700, parts: 1, topSpeed: 150 },
  { id: 'ev-endless-1k', name: 'First Kilometre', description: 'Drive 1,000 m in Endless Drive (Expressway)', mode: 'endless', district: 'ibom-plaza', minRank: 0, coins: 700, parts: 0, distance: 1000, road: 'expressway' },
  { id: 'ev-oron-clean', name: 'Market Manners', description: 'Finish Oron Road with no collisions', mode: 'drift', district: 'oron-road', minRank: 1, coins: 1200, parts: 1, clean: true },
  { id: 'ev-aka-8k', name: 'Aka Hustle', description: 'Score 8,000 on Aka Road', mode: 'drift', district: 'aka-road', minRank: 1, coins: 1500, parts: 1, score: 8000 },
  { id: 'ev-village-1k', name: 'Village Run', description: 'Drive 1,500 m on the Village Road', mode: 'endless', district: 'oron-road', minRank: 1, coins: 1500, parts: 1, distance: 1500, road: 'village' },
  { id: 'ev-abak-drifts', name: 'Abak Drifter', description: 'Land 12 drifts on Abak Road', mode: 'drift', district: 'abak-road', minRank: 2, coins: 2200, parts: 2, drifts: 12 },
  { id: 'ev-ewet-15k', name: 'Estate Boss', description: 'Score 15,000 in Ewet Housing', mode: 'drift', district: 'ewet-housing', minRank: 3, coins: 3500, parts: 3, score: 15000 },
  { id: 'ev-shelter-clean', name: 'Quiet Compound', description: 'Finish Shelter Afrique clean', mode: 'drift', district: 'shelter-afrique', minRank: 3, coins: 4000, parts: 4, clean: true },
  { id: 'ev-airport-200', name: 'Wheels Up', description: 'Reach 200 km/h on Airport Road', mode: 'drift', district: 'airport-road', minRank: 4, coins: 6000, parts: 5, topSpeed: 200 },
  { id: 'ev-endless-5k', name: 'Highway Legend', description: 'Drive 5,000 m in Endless Drive', mode: 'endless', district: 'airport-road', minRank: 4, coins: 8000, parts: 6, distance: 5000 },
  { id: 'ev-night-30k', name: 'Champion of the Night', description: 'Score 30,000 on the Night Circuit', mode: 'drift', district: 'night-circuit', minRank: 6, coins: 20000, parts: 15, score: 30000 },
];
export const EVENTS_COUNT = EVENTS.length;

/** Daily login reward: 7-day streak, resets if a day is missed. */
export const DAILY_REWARDS: { coins: number; parts: number }[] = [
  { coins: 200, parts: 0 }, { coins: 300, parts: 0 }, { coins: 450, parts: 1 }, { coins: 600, parts: 0 }, { coins: 800, parts: 1 }, { coins: 1200, parts: 2 }, { coins: 3000, parts: 5 },
];

export interface Ach { id: string; name: string; description: string; metric: string; target: number; coins: number }
export const ACHIEVEMENTS: Ach[] = [
  { id: 'first-run', name: 'First Spin', description: 'Finish your first run', metric: 'runs', target: 1, coins: 100 },
  { id: 'drift-50', name: 'Smoke Machine', description: 'Land 50 drifts', metric: 'total_drifts', target: 50, coins: 300 },
  { id: 'drift-500', name: 'Tyre Burner', description: 'Land 500 drifts', metric: 'total_drifts', target: 500, coins: 1500 },
  { id: 'score-10k', name: 'Big Slide', description: 'Score 10,000 in one run', metric: 'best_run', target: 10000, coins: 400 },
  { id: 'score-50k', name: 'Uyo Showstopper', description: 'Score 50,000 in one run', metric: 'best_run', target: 50000, coins: 1500 },
  { id: 'points-100k', name: 'Naira Rain', description: 'Earn 100,000 total points', metric: 'total_points', target: 100000, coins: 800 },
  { id: 'combo-8', name: 'Max Combo', description: 'Reach an x8 combo', metric: 'max_combo', target: 8, coins: 500 },
  { id: 'laps-10', name: 'Roundabout Regular', description: 'Complete 10 laps', metric: 'total_laps', target: 10, coins: 400 },
  { id: 'laps-100', name: 'Ring Road Legend', description: 'Complete 100 laps', metric: 'total_laps', target: 100, coins: 2000 },
  { id: 'clean-1', name: 'Clean Sweep', description: 'Finish a run with no collisions', metric: 'clean_runs', target: 1, coins: 300 },
  { id: 'clean-10', name: 'Spotless', description: 'Finish 10 clean runs', metric: 'clean_runs', target: 10, coins: 1500 },
  { id: 'speed-180', name: 'Fast and Curious', description: 'Reach 180 km/h', metric: 'top_speed', target: 180, coins: 400 },
  { id: 'rain-5', name: 'Rain Dancer', description: 'Finish 5 runs in the rain', metric: 'rain_runs', target: 5, coins: 600 },
  { id: 'rank-3', name: 'Drift Captain', description: 'Reach Drift Captain', metric: 'rank', target: 3, coins: 1000 },
  { id: 'rank-6', name: 'King of Uyo Streets', description: 'Reach the top rank', metric: 'rank', target: 6, coins: 5000 },
  { id: 'tour-5', name: 'Tour of Uyo', description: 'Drive in 5 districts', metric: 'districts_played', target: 5, coins: 800 },
  { id: 'tour-9', name: 'All Roads Lead to Uyo', description: 'Drive in all 9 districts', metric: 'districts_played', target: 9, coins: 3000 },
  { id: 'challenge-1', name: 'Challenge Accepted', description: "Beat a friend's challenge link", metric: 'challenges_won', target: 1, coins: 300 },
  { id: 'road-2k', name: 'Long Haul', description: 'Drive 2,000 m in one Endless run', metric: 'endless_best_m', target: 2000, coins: 500 },
  { id: 'road-10k', name: 'Highway Hero', description: 'Drive 10,000 m in one Endless run', metric: 'endless_best_m', target: 10000, coins: 2500 },
  { id: 'garage-3', name: 'Garage Growing', description: 'Own 3 cars', metric: 'cars_owned', target: 3, coins: 500 },
  { id: 'garage-6', name: 'Oga Collector', description: 'Own 6 cars', metric: 'cars_owned', target: 6, coins: 2500 },
  { id: 'garage-all', name: 'Whole Showroom', description: 'Own every car', metric: 'cars_owned', target: VEHICLES.filter(v => !v.premium).length, coins: 10000 },
  { id: 'cash-100', name: 'Pocket Money', description: 'Pick up 100 coins on the road', metric: 'coins_collected', target: 100, coins: 400 },
  { id: 'cash-1000', name: 'Naira Magnet', description: 'Pick up 1,000 coins on the road', metric: 'coins_collected', target: 1000, coins: 2500 },
  { id: 'near-50', name: 'Needle Threader', description: 'Make 50 near misses', metric: 'near_misses', target: 50, coins: 600 },
  { id: 'near-500', name: 'Traffic Ninja', description: 'Make 500 near misses', metric: 'near_misses', target: 500, coins: 3000 },
  { id: 'dist-50', name: 'Road Tripper', description: 'Drive 50 km in total', metric: 'total_km', target: 50, coins: 800 },
  { id: 'dist-500', name: 'Uyo to Lagos', description: 'Drive 500 km in total', metric: 'total_km', target: 500, coins: 4000 },
  { id: 'upgrade-1', name: 'First Mod', description: 'Buy your first upgrade', metric: 'upgrades_bought', target: 1, coins: 200 },
  { id: 'upgrade-20', name: 'Mechanic Special', description: 'Buy 20 upgrades', metric: 'upgrades_bought', target: 20, coins: 2000 },
  { id: 'maxed-1', name: 'Fully Loaded', description: 'Max out one upgrade on a car', metric: 'upgrades_maxed', target: 1, coins: 1000 },
  { id: 'event-1', name: 'Career Started', description: 'Finish a career event', metric: 'events_done', target: 1, coins: 300 },
  { id: 'event-all', name: 'Career Complete', description: 'Finish every career event', metric: 'events_done', target: EVENTS_COUNT, coins: 8000 },
  { id: 'daily-3', name: 'Regular Customer', description: 'Claim the daily reward 3 days in a row', metric: 'best_streak', target: 3, coins: 500 },
  { id: 'daily-7', name: 'Full Week', description: 'Claim the daily reward 7 days in a row', metric: 'best_streak', target: 7, coins: 3000 },
  { id: 'mp-1', name: 'Friendly Race', description: 'Finish a live race with a friend', metric: 'mp_races', target: 1, coins: 400 },
  { id: 'mp-win', name: 'Bragging Rights', description: 'Win a live race with a friend', metric: 'mp_wins', target: 1, coins: 800 },
  { id: 'mp-win-10', name: 'Undefeated Oga', description: 'Win 10 live races', metric: 'mp_wins', target: 10, coins: 4000 },
  { id: 'race-1', name: 'On the Grid', description: 'Finish a race', metric: 'races', target: 1, coins: 400 },
  { id: 'race-win-1', name: 'First to Reach', description: 'Win a race', metric: 'race_wins', target: 1, coins: 800 },
  { id: 'race-win-10', name: 'Road King', description: 'Win 10 races', metric: 'race_wins', target: 10, coins: 4000 },
  { id: 'ko-10', name: 'Wrecking Ball', description: 'Knock out 10 rivals', metric: 'kos', target: 10, coins: 1500 },
  { id: 'journey-5', name: 'Akwa Ibom Tourist', description: 'Complete 5 LGA journeys', metric: 'journeys', target: 5, coins: 1500 },
  { id: 'elim-1', name: 'Last One Standing', description: 'Win an Elimination race', metric: 'elim_wins', target: 1, coins: 1000 },
  { id: 'revive-1', name: 'Second Wind', description: 'Revive once in Endless Drive', metric: 'revives', target: 1, coins: 300 },
  { id: 'endless-5', name: 'Endless Regular', description: 'Play 5 Endless Drive runs', metric: 'endless_runs', target: 5, coins: 500 },
];
export interface MissionDef { id: string; kind: 'daily' | 'weekly' | 'seasonal'; metric: string; target: number; coins: number; parts: number; label: string }
export const MISSIONS: MissionDef[] = [
  { id: 'd-drift5', kind: 'daily', metric: 'drifts', target: 5, coins: 300, parts: 0, label: 'Perform 5 successful drifts' },
  { id: 'd-score10k', kind: 'daily', metric: 'points', target: 10000, coins: 500, parts: 1, label: 'Score 10,000 points' },
  { id: 'd-clean', kind: 'daily', metric: 'clean_runs', target: 1, coins: 400, parts: 0, label: 'Complete a run without collision' },
  { id: 'd-laps', kind: 'daily', metric: 'laps', target: 3, coins: 350, parts: 0, label: 'Complete 3 laps' },
  { id: 'd-near10', kind: 'daily', metric: 'near_misses', target: 10, coins: 400, parts: 0, label: 'Make 10 near misses' },
  { id: 'd-coins25', kind: 'daily', metric: 'pickups', target: 25, coins: 350, parts: 0, label: 'Pick up 25 coins on the road' },
  { id: 'w-score100k', kind: 'weekly', metric: 'points', target: 100000, coins: 3000, parts: 5, label: 'Score 100,000 points' },
  { id: 'w-drift100', kind: 'weekly', metric: 'drifts', target: 100, coins: 2500, parts: 4, label: 'Land 100 drifts' },
  { id: 'w-meters', kind: 'weekly', metric: 'meters', target: 10000, coins: 2000, parts: 3, label: 'Drive 10,000 m' },
  { id: 'd-runs3', kind: 'daily', metric: 'runs', target: 3, coins: 300, parts: 0, label: 'Play 3 runs in any mode' },
  { id: 'd-race1', kind: 'daily', metric: 'races', target: 1, coins: 600, parts: 0, label: 'Finish a race (Journey, Elimination or Demolition)' },
  { id: 'd-ko2', kind: 'daily', metric: 'kos', target: 2, coins: 500, parts: 0, label: 'Knock out 2 rivals in Demolition' },
  { id: 'd-ad1', kind: 'daily', metric: 'ads', target: 1, coins: 200, parts: 0, label: 'Watch 1 ad' },
  { id: 'w-wins3', kind: 'weekly', metric: 'race_wins', target: 3, coins: 3000, parts: 4, label: 'Win 3 races' },
  { id: 'w-journey3', kind: 'weekly', metric: 'journeys', target: 3, coins: 2500, parts: 3, label: 'Reach 3 LGAs in LGA Journey' },
  { id: 'w-ko10', kind: 'weekly', metric: 'kos', target: 10, coins: 2800, parts: 3, label: 'Knock out 10 rivals' },
  { id: 'w-mp2', kind: 'weekly', metric: 'mp_races', target: 2, coins: 2000, parts: 2, label: 'Race a friend live 2 times' },
  { id: 's-mpwin5', kind: 'seasonal', metric: 'mp_wins', target: 5, coins: 6000, parts: 8, label: 'Beat your friends 5 times' },
  { id: 's-journey25', kind: 'seasonal', metric: 'journeys', target: 25, coins: 8000, parts: 10, label: 'Complete 25 LGA journeys' },
  { id: 's-speed', kind: 'seasonal', metric: 'top_speed', target: 200, coins: 5000, parts: 10, label: 'Reach 200 km/h' },
];
