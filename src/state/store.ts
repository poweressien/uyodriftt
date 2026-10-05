import { useSyncExternalStore } from 'react';
import { NO_UPGRADES, Upgrades, VEHICLES, UPGRADE_CATS } from '../game/data/vehicles';
import { DISTRICTS, endlessRoad } from '../game/data/districts';
import { RANKS, ACHIEVEMENTS, MISSIONS, EVENTS, DAILY_REWARDS, COSMETIC_MIN_RANK, UPGRADE_COST, rankFor, unlockLines } from '../game/data/progression';
import type { CarLook, RunResult } from '../game/types';
import { DEFAULT_SETTINGS, Settings, Mode, WeatherPick, migrateSettings, isRace } from '../game/data/settings';
import { GAS_MAX, GAS_REFILL_MS, GAS_REFILL_VIP_MS, VIP_COIN_BONUS } from '../monetize/config';
import { productById } from '../monetize/products';

/** Everything lives in localStorage: no server, no login. */
export interface Stats {
  runs: number; total_points: number; best_run: number; max_combo: number; total_drifts: number; total_laps: number; clean_runs: number; top_speed: number; challenges_won: number; rain_runs: number; endless_best_m: number; endless_runs: number;
  coins_collected: number; near_misses: number; distance_m: number; upgrades_bought: number; mp_races: number; mp_wins: number; best_streak: number; revives: number;
  ads_watched: number; races: number; race_wins: number; kos: number; journeys: number; rams: number; elim_wins: number; demo_wins: number;
}
export interface Run { t: number; points: number; d: string; v: string; m?: string }
export interface Rival { name: string; w: number; l: number; t: number }
export interface ChallengeLog { code: string; d: string; p: number; from: string; t: number; m: 'drift' | 'endless' }
export interface Sel { district: string; vehicle: string; mode: Mode; road: string; weather: WeatherPick; route: string }
export interface Save {
  xp: number; coins: number; parts: number; owned: Record<string, CarLook>; stats: Stats; unlocked: string[]; paidRanks: number[];
  missions: Record<string, { period: string; progress: number; claimed: boolean }>; runs: Run[]; districts: string[]; beaten: string[]; sel: Sel; settings: Settings;
  events: string[]; daily: { last: string; streak: number }; best: Record<string, number>; rivals: Record<string, Rival>; challenges: ChallengeLog[];
  /** Fuel: `n` bars (0..7). When it hits 0, `emptyAt` is the moment it ran dry; 3 hours later (90 min with the Turbo Pass) the tank is full again. */
  gas: { n: number; emptyAt: number };
  /** Things bought with real money. `orders` is the ledger of Paystack references already honoured; `pending` are paid but not yet confirmed by the server. */
  ent: { vip: boolean; style: boolean; cars: string[]; orders: string[]; pending: { ref: string; product: string }[]; email: string; device: string };
  /** Rank-locked cosmetics unlocked by watching ads: progress per item, and the finished list. */
  adUnlocks: Record<string, number>; cosUnlocked: string[];
  /** Free-coins ads watched today (capped). */
  freebie: { day: string; n: number };
}
const KEY = 'uyo-drift-save-v1';
export const newCar = (): CarLook => ({ upgrades: { ...NO_UPGRADES }, paint: null, wheels: 'stock', tint: 0, decal: 'none', smoke: 'white', horn: 'classic' });
const freshStats = (): Stats => ({ runs: 0, total_points: 0, best_run: 0, max_combo: 0, total_drifts: 0, total_laps: 0, clean_runs: 0, top_speed: 0, challenges_won: 0, rain_runs: 0, endless_best_m: 0, endless_runs: 0, coins_collected: 0, near_misses: 0, distance_m: 0, upgrades_bought: 0, mp_races: 0, mp_wins: 0, best_streak: 0, revives: 0, ads_watched: 0, races: 0, race_wins: 0, kos: 0, journeys: 0, rams: 0, elim_wins: 0, demo_wins: 0 });
const fresh = (): Save => ({ xp: 0, coins: 500, parts: 0, owned: { corolla: newCar() }, unlocked: [], paidRanks: [], missions: {}, runs: [], districts: [], beaten: [], settings: { ...DEFAULT_SETTINGS },
  sel: { district: 'ibom-plaza', vehicle: 'corolla', mode: 'drift', road: 'expressway', weather: 'auto', route: 'uyo-etinan' }, stats: freshStats(), events: [], daily: { last: '', streak: 0 }, best: {}, rivals: {}, challenges: [],
  gas: { n: GAS_MAX, emptyAt: 0 }, ent: { vip: false, style: false, cars: [], orders: [], pending: [], email: '', device: '' }, adUnlocks: {}, cosUnlocked: [], freebie: { day: '', n: 0 } });
const sanGas = (g: any) => { const n = typeof g?.n === 'number' && Number.isFinite(g.n) ? Math.max(0, Math.min(GAS_MAX, Math.floor(g.n))) : GAS_MAX, e = typeof g?.emptyAt === 'number' && Number.isFinite(g.emptyAt) ? g.emptyAt : 0; return { n, emptyAt: n === 0 ? (e || Date.now()) : 0 }; };
const sanEnt = (e: any, f: Save['ent']): Save['ent'] => ({ vip: !!e?.vip, style: !!e?.style, cars: Array.isArray(e?.cars) ? e.cars.filter((x: unknown) => typeof x === 'string') : [], orders: Array.isArray(e?.orders) ? e.orders.slice(-200) : [], pending: Array.isArray(e?.pending) ? e.pending.filter((p: any) => p && typeof p.ref === 'string' && typeof p.product === 'string') : [], email: typeof e?.email === 'string' ? e.email.slice(0, 120) : '', device: typeof e?.device === 'string' && e.device ? e.device : f.device });
function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw), f = fresh(); return { ...f, ...d, stats: { ...f.stats, ...d.stats }, sel: { ...f.sel, ...d.sel }, settings: migrateSettings(d.settings), daily: { ...f.daily, ...d.daily }, events: Array.isArray(d.events) ? d.events : [], best: d.best ?? {}, rivals: d.rivals ?? {}, challenges: Array.isArray(d.challenges) ? d.challenges : [], gas: sanGas(d.gas), ent: sanEnt(d.ent, f.ent), adUnlocks: d.adUnlocks && typeof d.adUnlocks === 'object' ? d.adUnlocks : {}, cosUnlocked: Array.isArray(d.cosUnlocked) ? d.cosUnlocked : [], freebie: { day: typeof d.freebie?.day === 'string' ? d.freebie.day : '', n: Number.isFinite(d.freebie?.n) ? d.freebie.n : 0 } }; }
  } catch { /* corrupted save: start fresh */ }
  return fresh();
}
let state = load(); if (!state.ent.device) state.ent.device = 'd' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); const subs = new Set<() => void>();
function commit(fn: (d: Save) => void) { const d: Save = JSON.parse(JSON.stringify(state)); fn(d); state = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full/blocked: keep playing in memory */ } subs.forEach(f => f()); }
export const getSave = () => state;
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSave = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
/** Wipes progress but never what the player paid for: purchases, the ledger and the device id stay. */
export const resetSave = () => commit(d => { const keep = d.ent; Object.assign(d, fresh()); d.ent = keep; for (const c of keep.cars) d.owned[c] = newCar(); });
export const select = (p: Partial<Save['sel']>) => commit(d => { d.sel = { ...d.sel, ...p }; });
export const setSettings = (p: Partial<Settings>) => commit(d => { d.settings = { ...d.settings, ...p }; });
export const playerName = (s: Save = state) => (s.settings.name || '').trim() || 'Driver';
/** Returns false (and charges nothing) when the player cannot afford it. */
export function spendCoins(n: number): boolean { if (state.coins < n) return false; commit(d => { d.coins -= n; }); return true; }
/** Coins picked up on the road go straight into the wallet so a revive can use them. */
export function addCoins(n: number) { if (n > 0) commit(d => { d.coins += Math.floor(n); }); }

// ---- gas (7 bars) ----
const refillMs = (e: Save['ent']) => (e.vip ? GAS_REFILL_VIP_MS : GAS_REFILL_MS);
/** Pure view of the tank at `now`: if the refill time has passed an empty tank reads as full (it is written back on the next change). */
export function gasView(s: Save = state, now = Date.now()) {
  let n = s.gas.n, at = s.gas.emptyAt; if (n <= 0) { if (at > now) at = now; if (!at) at = now; if (now - at >= refillMs(s.ent)) { n = GAS_MAX; at = 0; } }
  const left = n <= 0 ? Math.max(0, at + refillMs(s.ent) - now) : 0; return { n, max: GAS_MAX, msLeft: left, refillMs: refillMs(s.ent), empty: n <= 0 };
}
function settleGas(d: Save, now = Date.now()) { const v = gasView(d, now); if (v.n !== d.gas.n || (v.n === 0 && !d.gas.emptyAt)) d.gas = { n: v.n, emptyAt: v.n === 0 ? Math.min(d.gas.emptyAt || now, now) : 0 }; }
/** Takes one bar for a race start. Returns false (and takes nothing) when the tank is dry. */
export function useGas(): boolean { if (gasView().n <= 0) return false; commit(d => { settleGas(d); d.gas.n = Math.max(0, d.gas.n - 1); if (d.gas.n === 0) d.gas.emptyAt = Date.now(); }); return true; }
/** +1 bar (a watched ad). Never goes above 7. */
export function addGas(bars = 1) { commit(d => { settleGas(d); d.gas.n = Math.min(GAS_MAX, d.gas.n + bars); d.gas.emptyAt = 0; }); }
export function refillGas() { commit(d => { d.gas = { n: GAS_MAX, emptyAt: 0 }; }); }
export const fmtWait = (ms: number) => { const m = Math.ceil(ms / 60000), h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };

// ---- ads and purchases ----
/** Call only after the ad provider said the player really finished watching. */
export function noteAd() { commit(d => { d.stats.ads_watched++; addMission(d, 'ads', 1); }); }
/** Idempotent: the same payment reference can only ever be honoured once. */
export function grantProduct(id: string, ref: string): boolean {
  const p = productById(id); if (!p) return false; let done = false;
  commit(d => {
    if (d.ent.orders.includes(ref)) return; d.ent.orders.push(ref); d.ent.orders = d.ent.orders.slice(-200); d.ent.pending = d.ent.pending.filter(x => x.ref !== ref); done = true;
    if (p.kind === 'coins') d.coins += p.coins ?? 0; else if (p.kind === 'gas') d.gas = { n: GAS_MAX, emptyAt: 0 }; else if (p.kind === 'vip') d.ent.vip = true; else if (p.kind === 'style') d.ent.style = true;
    else if (p.kind === 'car' && p.car) { if (!d.ent.cars.includes(p.car)) d.ent.cars.push(p.car); if (!d.owned[p.car]) d.owned[p.car] = newCar(); }
  });
  return done;
}
export const FREEBIE_COINS = 250, FREEBIE_PER_DAY = 5;
export const freebiesLeft = (s: Save = state) => (s.freebie.day === day(new Date()) ? Math.max(0, FREEBIE_PER_DAY - s.freebie.n) : FREEBIE_PER_DAY);
/** After a watched ad: +250 coins, at most 5 a day. */
export function claimFreebie() { commit(d => { const t = day(new Date()); if (d.freebie.day !== t) d.freebie = { day: t, n: 0 }; if (d.freebie.n >= FREEBIE_PER_DAY) throw new Error('No free-coin ads left today. Come back tomorrow.'); d.freebie.n++; d.coins += FREEBIE_COINS; }); }
export const addPending = (ref: string, product: string) => commit(d => { if (!d.ent.pending.some(x => x.ref === ref) && !d.ent.orders.includes(ref)) d.ent.pending.push({ ref, product }); });
export const dropPending = (ref: string) => commit(d => { d.ent.pending = d.ent.pending.filter(x => x.ref !== ref); });
export const setEmail = (email: string) => commit(d => { d.ent.email = email.trim().slice(0, 120); });

// ---- periods for missions (local time) ----
const pad = (n: number) => String(n).padStart(2, '0'), day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const periodKey = (kind: string, now = new Date()) => { if (kind === 'daily') return day(now); if (kind === 'weekly') { const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return 'W' + day(m); } return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`; };
function sync(d: Save) { for (const m of MISSIONS) { const k = periodKey(m.kind), cur = d.missions[m.id]; if (!cur || cur.period !== k) d.missions[m.id] = { period: k, progress: 0, claimed: false }; } }
export function missionView(s: Save) { return MISSIONS.map(m => { const cur = s.missions[m.id], fresh = !cur || cur.period !== periodKey(m.kind); return { ...m, progress: fresh ? 0 : cur.progress, claimed: fresh ? false : cur.claimed }; }); }
function addMission(d: Save, metric: string, v: number, max = false) { sync(d); for (const m of MISSIONS) if (m.metric === metric) { const c = d.missions[m.id]; if (!c.claimed) c.progress = max ? Math.max(c.progress, v) : c.progress + v; } }
/** `doubled` is only passed after a rewarded ad finished: the coins are paid twice. */
export function claimMission(id: string, doubled = false) { let out = { coins: 0, parts: 0 }; commit(d => { sync(d); const m = MISSIONS.find(x => x.id === id), cur = d.missions[id]; if (!m || cur.claimed || cur.progress < m.target) throw new Error('Not ready to claim'); cur.claimed = true; const c = m.coins * (doubled ? 2 : 1); d.coins += c; d.parts += m.parts; out = { coins: c, parts: m.parts }; }); return out; }

// ---- progression ----
const upgradesMaxed = (d: Save) => Object.values(d.owned).reduce((n, c) => n + UPGRADE_CATS.filter(k => (c.upgrades?.[k] ?? 0) >= 5).length, 0);
const statsFor = (d: Save) => ({ ...d.stats, districts_played: d.districts.length, cars_owned: Object.keys(d.owned).length, rank: rankFor(d.xp), total_km: Math.floor(d.stats.distance_m / 1000), upgrades_maxed: upgradesMaxed(d), events_done: d.events.length });
export function achievementView(s: Save) { const st = statsFor(s); return ACHIEVEMENTS.map(a => ({ ...a, unlocked: s.unlocked.includes(a.id), progress: Math.min(a.target, (st as any)[a.metric] ?? 0) })); }
export interface AchInfo { id: string; name: string; description: string; coins: number }
export interface EventInfo { id: string; name: string; coins: number; parts: number }
export interface Outcome { coins: number; xp: number; rank: number; rankRewards: { rank: number; name: string; coins: number; parts: number; unlocks: string[] }[]; achievements: AchInfo[]; challengeBeaten: boolean; events: EventInfo[]; newBest: boolean }
function unlock(d: Save, st: any = statsFor(d)) { const out: AchInfo[] = []; for (const a of ACHIEVEMENTS) if (!d.unlocked.includes(a.id) && (st[a.metric] ?? 0) >= a.target) { d.unlocked.push(a.id); d.coins += a.coins; out.push({ id: a.id, name: a.name, description: a.description, coins: a.coins }); } return out; }

/** In-run numbers used to unlock achievements while the run is still going. */
export interface LiveProgress { mode: Mode; points: number; maxCombo: number; topSpeed: number; distanceM: number; drifts: number; pickups: number; nearMisses: number; laps: number }
function liveStats(d: Save, p: LiveProgress) {
  const s = statsFor(d);
  return { ...s, best_run: Math.max(s.best_run, p.points), total_points: s.total_points + p.points, max_combo: Math.max(s.max_combo, p.maxCombo), top_speed: Math.max(s.top_speed, p.topSpeed), total_drifts: s.total_drifts + p.drifts, coins_collected: s.coins_collected + p.pickups,
    near_misses: s.near_misses + p.nearMisses, total_laps: s.total_laps + p.laps, total_km: Math.floor((s.distance_m + p.distanceM) / 1000), endless_best_m: p.mode === 'endless' ? Math.max(s.endless_best_m, p.distanceM) : s.endless_best_m };
}
/** Grants (and returns) any achievements the run has already earned. Safe to call often: it only writes when something unlocks. */
export function grantLive(p: LiveProgress): AchInfo[] {
  const st = liveStats(state, p); if (!ACHIEVEMENTS.some(a => !state.unlocked.includes(a.id) && ((st as any)[a.metric] ?? 0) >= a.target)) return [];
  let out: AchInfo[] = []; commit(d => { out = unlock(d, liveStats(d, p)); }); return out;
}
export function finishRun(r: RunResult, challenge?: { code: string; d: string; p: number; m?: Mode } | null): Outcome {
  let out!: Outcome;
  commit(d => {
    sync(d); const coins = Math.floor(r.points / 20 * (d.ent.vip ? 1 + VIP_COIN_BONUS : 1)) + (r.race ? Math.floor(r.race.prize * (d.ent.vip ? 1 + VIP_COIN_BONUS : 1)) : 0); d.coins += coins; d.xp += Math.floor(r.points / 10);
    const s = d.stats; s.runs++; s.total_points += r.points; s.best_run = Math.max(s.best_run, r.points); s.max_combo = Math.max(s.max_combo, r.maxCombo); s.total_drifts += r.drifts; s.total_laps += r.laps; s.top_speed = Math.max(s.top_speed, r.topSpeed);
    s.coins_collected += r.pickups ?? 0; s.near_misses += r.nearMisses ?? 0; s.distance_m += Math.floor(r.distanceM ?? r.distance ?? 0); s.revives += r.revives ?? 0;
    if (r.clean) s.clean_runs++; if (r.weather.includes('rain')) s.rain_runs++; if (!d.districts.includes(r.districtId)) d.districts.push(r.districtId);
    d.runs.unshift({ t: Date.now(), points: r.points, d: r.districtId, v: r.vehicleId, ...(r.mode === 'endless' ? { m: 'e' } : {}) });
    if (r.mode === 'endless') { s.endless_runs++; s.endless_best_m = Math.max(s.endless_best_m, Math.floor(r.distance ?? 0)); } d.runs.length = Math.min(d.runs.length, 300);
    const bestKey = (r.mode === 'endless' ? 'e:' : isRace(r.mode) ? r.mode + ':' : '') + r.districtId, newBest = r.points > (d.best[bestKey] ?? 0); if (newBest) d.best[bestKey] = r.points;
    const add = (metric: string, v: number, max = false) => addMission(d, metric, v, max);
    add('drifts', r.drifts); add('points', r.points); add('laps', r.laps); add('clean_runs', r.clean ? 1 : 0); add('top_speed', r.topSpeed, true); add('near_misses', r.nearMisses ?? 0); add('pickups', r.pickups ?? 0); add('meters', Math.floor(r.distanceM ?? r.distance ?? 0)); add('runs', 1);
    if (r.race) { const q = r.race; s.races++; s.kos += q.kos; s.rams += q.rams; add('races', 1); add('kos', q.kos); add('rams', q.rams); if (q.won) { s.race_wins++; add('race_wins', 1); if (q.kind === 'elim') s.elim_wins++; if (q.kind === 'demo') s.demo_wins++; } if (q.kind === 'journey' && !q.wrecked && q.finished) { s.journeys++; add('journeys', 1); } }
    if (r.mp) { s.mp_races++; add('mp_races', 1); if (r.mp.won) { s.mp_wins++; add('mp_wins', 1); } const k = r.mp.oppName.toLowerCase(), cur = d.rivals[k] ?? { name: r.mp.oppName, w: 0, l: 0, t: 0 }; if (r.mp.won) cur.w++; else if (!r.mp.tie) cur.l++; cur.t = Date.now(); d.rivals[k] = cur; const ks = Object.keys(d.rivals); if (ks.length > 20) { ks.sort((a, b) => d.rivals[a].t - d.rivals[b].t); delete d.rivals[ks[0]]; } }
    let challengeBeaten = false; if (challenge && challenge.d === r.districtId && (challenge.m ?? 'drift') === (r.mode ?? 'drift') && r.points >= challenge.p && !d.beaten.includes(challenge.code)) { d.beaten.push(challenge.code); d.coins += 500; s.challenges_won++; challengeBeaten = true; }
    // career events
    const evOut: EventInfo[] = []; const rankNow = rankFor(d.xp);
    for (const e of EVENTS) {
      if (d.events.includes(e.id) || e.minRank > rankNow || e.mode !== (r.mode ?? 'drift') || e.district !== r.districtId) continue;
      if (e.road && (r.road ?? 'expressway') !== e.road) continue;
      if (e.score && r.points < e.score) continue; if (e.distance && (r.distance ?? 0) < e.distance) continue; if (e.topSpeed && r.topSpeed < e.topSpeed) continue; if (e.clean && !r.clean) continue; if (e.drifts && r.drifts < e.drifts) continue; if (e.laps && r.laps < e.laps) continue;
      d.events.push(e.id); d.coins += e.coins; d.parts += e.parts; evOut.push({ id: e.id, name: e.name, coins: e.coins, parts: e.parts });
    }
    const rank = rankFor(d.xp), table = unlockLines(), rankRewards: Outcome['rankRewards'] = [];
    for (let i = 1; i <= rank; i++) if (!d.paidRanks.includes(i)) { d.paidRanks.push(i); d.coins += RANKS[i].coins; d.parts += RANKS[i].parts; rankRewards.push({ rank: i, name: RANKS[i].name, coins: RANKS[i].coins, parts: RANKS[i].parts, unlocks: table[i] }); }
    out = { coins, xp: Math.floor(r.points / 10), rank, rankRewards, achievements: unlock(d), challengeBeaten, events: evOut, newBest };
  });
  return out;
}

// ---- garage ----
export function buyCar(id: string): AchInfo[] { let out: AchInfo[] = []; commit(d => { const v = VEHICLES.find(x => x.id === id); if (!v || d.owned[id]) throw new Error('Cannot buy this car'); if (v.premium) throw new Error('This premium car is sold in the Shop'); if (rankFor(d.xp) < v.minRank) throw new Error(`Unlocks at ${RANKS[v.minRank].name}`); if (d.coins < v.price) throw new Error('Not enough coins'); d.coins -= v.price; d.owned[id] = newCar(); out = unlock(d); }); return out; }
/** `viaAd` = a rewarded ad was just watched: levels 1-3 are free that way (parts-priced levels 4-5 never are). */
export const AD_UPGRADE_MAX_LEVEL = 3;
export function upgradeCar(id: string, cat: keyof Upgrades, viaAd = false): AchInfo[] { let out: AchInfo[] = []; commit(d => { const c = d.owned[id]; if (!c || !UPGRADE_CATS.includes(cat)) throw new Error('Bad upgrade'); const lvl = c.upgrades[cat]; if (lvl >= 5) throw new Error('Already maxed'); const cost = UPGRADE_COST(lvl); if (viaAd) { if (lvl >= AD_UPGRADE_MAX_LEVEL) throw new Error('Ads only pay for levels 1 to 3'); } else { if (d.coins < cost.coins) throw new Error('Not enough coins'); if (d.parts < cost.parts) throw new Error('Not enough parts'); d.coins -= cost.coins; d.parts -= cost.parts; } c.upgrades[cat] = lvl + 1; d.stats.upgrades_bought++; out = unlock(d); }); return out; }
/** Selling gives back half the price. The starter Corolla and the last car cannot be sold. */
export const sellValue = (id: string) => Math.floor((VEHICLES.find(v => v.id === id)?.price ?? 0) * .5);
export function sellCar(id: string) { commit(d => { const v = VEHICLES.find(x => x.id === id); if (!v || !d.owned[id]) throw new Error('You do not own this car'); if (id === 'corolla' || v.price <= 0) throw new Error('The starter car cannot be sold'); if (Object.keys(d.owned).length <= 1) throw new Error('Keep at least one car'); delete d.owned[id]; d.coins += Math.floor(v.price * .5); if (d.sel.vehicle === id) d.sel.vehicle = 'corolla'; }); }
/** A cosmetic is open when the rank is high enough, the Style Pack was bought, or its ads were watched. */
export const cosmeticOpen = (s: Save, key: string, rank = rankFor(s.xp)) => (COSMETIC_MIN_RANK[key] ?? 0) <= rank || s.ent.style || s.cosUnlocked.includes(key);
/** Ads needed to open a rank-locked cosmetic: 2 for early items, 3 for the late ones. */
export const adsToUnlock = (key: string) => ((COSMETIC_MIN_RANK[key] ?? 0) >= 4 ? 3 : 2);
/** One watched ad towards a locked cosmetic. Returns true when that was the last one needed. */
export function adUnlockStep(key: string): boolean { let opened = false; commit(d => { if (!(key in COSMETIC_MIN_RANK) || cosmeticOpen(d, key)) throw new Error('Nothing to unlock'); const n = (d.adUnlocks[key] ?? 0) + 1; d.adUnlocks[key] = n; if (n >= adsToUnlock(key)) { d.cosUnlocked.push(key); delete d.adUnlocks[key]; opened = true; } }); return opened; }
export function customize(id: string, patch: Partial<CarLook>) { commit(d => { const c = d.owned[id]; if (!c) throw new Error('You do not own this car'); const rank = rankFor(d.xp);
  for (const f of ['wheels', 'tint', 'decal', 'smoke', 'horn'] as const) if (patch[f] !== undefined) { const key = `${f}:${patch[f]}`; if (!cosmeticOpen(d, key, rank)) throw new Error(`Locked: ${RANKS[COSMETIC_MIN_RANK[key]].name}, a few ads, or the Style Pack`); }
  Object.assign(c, patch); }); }

// ---- daily reward ----
const dayBefore = (n = 1) => { const d = new Date(); d.setDate(d.getDate() - n); return day(d); };
export function dailyStatus(s: Save = state) { const today = day(new Date()), cont = s.daily.last === dayBefore(), claimed = s.daily.last === today, streak = claimed || cont ? s.daily.streak : 0; return { claimed, streak, nextIndex: claimed ? (streak - 1 + 7) % 7 : streak % 7, reward: DAILY_REWARDS[claimed ? (streak - 1 + 7) % 7 : streak % 7] }; }
export function claimDaily() {
  let out = { coins: 0, parts: 0, day: 1, achievements: [] as AchInfo[] };
  commit(d => { const st = dailyStatus(d); if (st.claimed) throw new Error('Already claimed today'); const streak = st.streak + 1, r = DAILY_REWARDS[(streak - 1) % 7]; d.daily = { last: day(new Date()), streak }; d.coins += r.coins; d.parts += r.parts; d.stats.best_streak = Math.max(d.stats.best_streak, streak); out = { coins: r.coins, parts: r.parts, day: ((streak - 1) % 7) + 1, achievements: unlock(d) }; });
  return out;
}

// ---- local leaderboards + challenge links ----
export type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';
export function topRuns(s: Save, period: Period, district?: string) {
  const now = Date.now(), today = day(new Date()), lim = period === 'weekly' ? 7 * 864e5 : period === 'monthly' ? 30 * 864e5 : Infinity;
  return s.runs.filter(r => (!district || r.d === district) && (period === 'daily' ? day(new Date(r.t)) === today : now - r.t < lim)).sort((a, b) => b.points - a.points).slice(0, 10);
}
export const districtName = (id: string) => DISTRICTS.find(d => d.id === id)?.name ?? id;
export const roadName = (id?: string) => endlessRoad(id).name;
const b64 = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))), unb64 = (s: string) => JSON.parse(decodeURIComponent(escape(atob(s))));
export function makeChallengeLink(districtId: string, points: number, mode: Mode = 'drift', name = playerName()) { const code = b64({ d: districtId, p: points, m: mode === 'endless' ? 'endless' : 'drift', n: name }); return { code, url: `${location.origin}${location.pathname}#c=${encodeURIComponent(code)}` }; }
export function parseChallenge(hash: string) { const m = /[#&]c=([^&]+)/.exec(hash); if (!m) return null; try { const code = decodeURIComponent(m[1]), o = unb64(code); return typeof o.d === 'string' && Number.isFinite(o.p) && DISTRICTS.some(x => x.id === o.d) ? { code, d: o.d as string, p: Math.floor(o.p), m: (o.m === 'endless' ? 'endless' : 'drift') as 'drift' | 'endless', n: typeof o.n === 'string' ? o.n.slice(0, 14) : 'A friend' } : null; } catch { return null; } }
export function logChallenge(c: { code: string; d: string; p: number; n: string; m: 'drift' | 'endless' }) { commit(d => { if (d.challenges.some(x => x.code === c.code)) return; d.challenges.unshift({ code: c.code, d: c.d, p: c.p, from: c.n, t: Date.now(), m: c.m }); d.challenges.length = Math.min(d.challenges.length, 20); }); }
