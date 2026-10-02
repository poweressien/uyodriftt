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
];
export interface MissionDef { id: string; kind: 'daily' | 'weekly' | 'seasonal'; metric: string; target: number; coins: number; parts: number; label: string }
export const MISSIONS: MissionDef[] = [
  { id: 'd-drift5', kind: 'daily', metric: 'drifts', target: 5, coins: 300, parts: 0, label: 'Perform 5 successful drifts' },
  { id: 'd-score10k', kind: 'daily', metric: 'points', target: 10000, coins: 500, parts: 1, label: 'Score 10,000 points' },
  { id: 'd-clean', kind: 'daily', metric: 'clean_runs', target: 1, coins: 400, parts: 0, label: 'Complete a run without collision' },
  { id: 'd-laps', kind: 'daily', metric: 'laps', target: 3, coins: 350, parts: 0, label: 'Complete 3 laps' },
  { id: 'w-score100k', kind: 'weekly', metric: 'points', target: 100000, coins: 3000, parts: 5, label: 'Score 100,000 points' },
  { id: 'w-drift100', kind: 'weekly', metric: 'drifts', target: 100, coins: 2500, parts: 4, label: 'Land 100 drifts' },
  { id: 's-speed', kind: 'seasonal', metric: 'top_speed', target: 200, coins: 5000, parts: 10, label: 'Reach 200 km/h' },
];
