import { useSyncExternalStore } from 'react';
import { NO_UPGRADES, Upgrades, VEHICLES, UPGRADE_CATS } from '../game/data/vehicles';
import { DISTRICTS } from '../game/data/districts';
import { RANKS, ACHIEVEMENTS, MISSIONS, COSMETIC_MIN_RANK, UPGRADE_COST, rankFor, unlockLines } from '../game/data/progression';
import type { CarLook, RunResult } from '../game/types';
import { DEFAULT_SETTINGS, Settings, Mode } from '../game/data/settings';

/** Everything lives in localStorage: no server, no login. */
export interface Stats { runs: number; total_points: number; best_run: number; max_combo: number; total_drifts: number; total_laps: number; clean_runs: number; top_speed: number; challenges_won: number; rain_runs: number; endless_best_m: number; endless_runs: number }
export interface Run { t: number; points: number; d: string; v: string; m?: string }
export interface Save {
  xp: number; coins: number; parts: number; owned: Record<string, CarLook>; stats: Stats; unlocked: string[]; paidRanks: number[];
  missions: Record<string, { period: string; progress: number; claimed: boolean }>; runs: Run[]; districts: string[]; beaten: string[]; sel: { district: string; vehicle: string; mode: Mode }; settings: Settings;
}
const KEY = 'uyo-drift-save-v1';
export const newCar = (): CarLook => ({ upgrades: { ...NO_UPGRADES }, paint: null, wheels: 'stock', tint: 0, decal: 'none', smoke: 'white', horn: 'classic' });
const fresh = (): Save => ({ xp: 0, coins: 500, parts: 0, owned: { corolla: newCar() }, unlocked: [], paidRanks: [], missions: {}, runs: [], districts: [], beaten: [], sel: { district: 'ibom-plaza', vehicle: 'corolla', mode: 'drift' }, settings: { ...DEFAULT_SETTINGS },
  stats: { runs: 0, total_points: 0, best_run: 0, max_combo: 0, total_drifts: 0, total_laps: 0, clean_runs: 0, top_speed: 0, challenges_won: 0, rain_runs: 0, endless_best_m: 0, endless_runs: 0 } });
function load(): Save { try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw), f = fresh(); return { ...f, ...d, stats: { ...f.stats, ...d.stats }, sel: { ...f.sel, ...d.sel }, settings: { ...f.settings, ...d.settings, ...(d.settings && d.settings.v !== 2 ? { view: 'behind' as const, v: 2 } : {}) } }; } } catch { /* corrupted save: start fresh */ } return fresh(); }
let state = load(); const subs = new Set<() => void>();
function commit(fn: (d: Save) => void) { const d: Save = JSON.parse(JSON.stringify(state)); fn(d); state = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full/blocked: keep playing in memory */ } subs.forEach(f => f()); }
export const getSave = () => state;
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSave = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
export const resetSave = () => commit(d => { Object.assign(d, fresh()); });
export const select = (p: Partial<Save['sel']>) => commit(d => { d.sel = { ...d.sel, ...p }; });
export const setSettings = (p: Partial<Settings>) => commit(d => { d.settings = { ...d.settings, ...p }; });
/** Returns false (and charges nothing) when the player cannot afford it. */
export function spendCoins(n: number): boolean { if (state.coins < n) return false; commit(d => { d.coins -= n; }); return true; }

// ---- periods for missions (local time) ----
const pad = (n: number) => String(n).padStart(2, '0'), day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const periodKey = (kind: string, now = new Date()) => { if (kind === 'daily') return day(now); if (kind === 'weekly') { const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return 'W' + day(m); } return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`; };
function sync(d: Save) { for (const m of MISSIONS) { const k = periodKey(m.kind), cur = d.missions[m.id]; if (!cur || cur.period !== k) d.missions[m.id] = { period: k, progress: 0, claimed: false }; } }
export function missionView(s: Save) { return MISSIONS.map(m => { const cur = s.missions[m.id], fresh = !cur || cur.period !== periodKey(m.kind); return { ...m, progress: fresh ? 0 : cur.progress, claimed: fresh ? false : cur.claimed }; }); }
export function claimMission(id: string) { let out = { coins: 0, parts: 0 }; commit(d => { sync(d); const m = MISSIONS.find(x => x.id === id), cur = d.missions[id]; if (!m || cur.claimed || cur.progress < m.target) throw new Error('Not ready to claim'); cur.claimed = true; d.coins += m.coins; d.parts += m.parts; out = { coins: m.coins, parts: m.parts }; }); return out; }

// ---- progression ----
const statsFor = (d: Save) => ({ ...d.stats, districts_played: d.districts.length, cars_owned: Object.keys(d.owned).length, rank: rankFor(d.xp) });
export function achievementView(s: Save) { const st = statsFor(s); return ACHIEVEMENTS.map(a => ({ ...a, unlocked: s.unlocked.includes(a.id), progress: Math.min(a.target, (st as any)[a.metric] ?? 0) })); }
export interface Outcome { coins: number; xp: number; rank: number; rankRewards: { rank: number; name: string; coins: number; parts: number; unlocks: string[] }[]; achievements: { id: string; name: string; description: string; coins: number }[]; challengeBeaten: boolean }
function unlock(d: Save) { const st: any = statsFor(d), out: Outcome['achievements'] = []; for (const a of ACHIEVEMENTS) if (!d.unlocked.includes(a.id) && (st[a.metric] ?? 0) >= a.target) { d.unlocked.push(a.id); d.coins += a.coins; out.push({ id: a.id, name: a.name, description: a.description, coins: a.coins }); } return out; }
export function finishRun(r: RunResult, challenge?: { code: string; d: string; p: number } | null): Outcome {
  let out!: Outcome;
  commit(d => {
    sync(d); const coins = Math.floor(r.points / 20); d.coins += coins; d.xp += Math.floor(r.points / 10);
    const s = d.stats; s.runs++; s.total_points += r.points; s.best_run = Math.max(s.best_run, r.points); s.max_combo = Math.max(s.max_combo, r.maxCombo); s.total_drifts += r.drifts; s.total_laps += r.laps; s.top_speed = Math.max(s.top_speed, r.topSpeed);
    if (r.clean) s.clean_runs++; if (r.weather.includes('rain')) s.rain_runs++; if (!d.districts.includes(r.districtId)) d.districts.push(r.districtId);
    d.runs.unshift({ t: Date.now(), points: r.points, d: r.districtId, v: r.vehicleId, ...(r.mode === 'endless' ? { m: 'e' } : {}) });
    if (r.mode === 'endless') { s.endless_runs++; s.endless_best_m = Math.max(s.endless_best_m, Math.floor(r.distance ?? 0)); } d.runs.length = Math.min(d.runs.length, 300);
    const add = (metric: string, v: number, max = false) => { for (const m of MISSIONS) if (m.metric === metric) { const c = d.missions[m.id]; if (!c.claimed) c.progress = max ? Math.max(c.progress, v) : c.progress + v; } };
    add('drifts', r.drifts); add('points', r.points); add('laps', r.laps); add('clean_runs', r.clean ? 1 : 0); add('top_speed', r.topSpeed, true);
    let challengeBeaten = false; if (challenge && challenge.d === r.districtId && r.points >= challenge.p && !d.beaten.includes(challenge.code)) { d.beaten.push(challenge.code); d.coins += 500; s.challenges_won++; challengeBeaten = true; }
    const rank = rankFor(d.xp), table = unlockLines(), rankRewards: Outcome['rankRewards'] = [];
    for (let i = 1; i <= rank; i++) if (!d.paidRanks.includes(i)) { d.paidRanks.push(i); d.coins += RANKS[i].coins; d.parts += RANKS[i].parts; rankRewards.push({ rank: i, name: RANKS[i].name, coins: RANKS[i].coins, parts: RANKS[i].parts, unlocks: table[i] }); }
    out = { coins, xp: Math.floor(r.points / 10), rank, rankRewards, achievements: unlock(d), challengeBeaten };
  });
  return out;
}

// ---- garage ----
export function buyCar(id: string) { commit(d => { const v = VEHICLES.find(x => x.id === id); if (!v || d.owned[id]) throw new Error('Cannot buy this car'); if (rankFor(d.xp) < v.minRank) throw new Error(`Unlocks at ${RANKS[v.minRank].name}`); if (d.coins < v.price) throw new Error('Not enough coins'); d.coins -= v.price; d.owned[id] = newCar(); const a = unlock(d); void a; }); }
export function upgradeCar(id: string, cat: keyof Upgrades) { commit(d => { const c = d.owned[id]; if (!c || !UPGRADE_CATS.includes(cat)) throw new Error('Bad upgrade'); const lvl = c.upgrades[cat]; if (lvl >= 5) throw new Error('Already maxed'); const cost = UPGRADE_COST(lvl); if (d.coins < cost.coins) throw new Error('Not enough coins'); if (d.parts < cost.parts) throw new Error('Not enough parts'); d.coins -= cost.coins; d.parts -= cost.parts; c.upgrades[cat] = lvl + 1; }); }
export function customize(id: string, patch: Partial<CarLook>) { commit(d => { const c = d.owned[id]; if (!c) throw new Error('You do not own this car'); const rank = rankFor(d.xp);
  for (const f of ['wheels', 'tint', 'decal', 'smoke', 'horn'] as const) if (patch[f] !== undefined) { const need = COSMETIC_MIN_RANK[`${f}:${patch[f]}`] ?? 0; if (need > rank) throw new Error(`Unlocks at ${RANKS[need].name}`); }
  Object.assign(c, patch); }); }

// ---- local leaderboards + challenge links ----
export type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';
export function topRuns(s: Save, period: Period, district?: string) {
  const now = Date.now(), today = day(new Date()), lim = period === 'weekly' ? 7 * 864e5 : period === 'monthly' ? 30 * 864e5 : Infinity;
  return s.runs.filter(r => (!district || r.d === district) && (period === 'daily' ? day(new Date(r.t)) === today : now - r.t < lim)).sort((a, b) => b.points - a.points).slice(0, 10);
}
export const districtName = (id: string) => DISTRICTS.find(d => d.id === id)?.name ?? id;
export function makeChallengeLink(districtId: string, points: number) { const code = btoa(JSON.stringify({ d: districtId, p: points })); return { code, url: `${location.origin}${location.pathname}#c=${encodeURIComponent(code)}` }; }
export function parseChallenge(hash: string) { const m = /[#&]c=([^&]+)/.exec(hash); if (!m) return null; try { const code = decodeURIComponent(m[1]), o = JSON.parse(atob(code)); return typeof o.d === 'string' && Number.isFinite(o.p) && DISTRICTS.some(x => x.id === o.d) ? { code, d: o.d as string, p: Math.floor(o.p) } : null; } catch { return null; } }
