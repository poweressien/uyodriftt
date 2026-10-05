/** Player-facing options. Kept free of Phaser/React imports so both the UI and the game can use it. */
export type View = 'behind' | 'top' | 'chase' | 'wide' | 'hood';
export const VIEWS: View[] = ['behind', 'top', 'chase', 'wide', 'hood'];
export const VIEW_LABEL: Record<View, string> = { behind: 'Behind (3D)', top: 'Top', chase: 'Chase', wide: 'Wide', hood: 'Hood' };
export type Controls = 'arrows' | 'tilt';
export type Mode = 'drift' | 'endless' | 'journey' | 'elim' | 'demo';
/** Race modes run in the endless-road scene with rivals, damage and a finish. */
export const isRace = (m?: Mode) => m === 'journey' || m === 'elim' || m === 'demo';
export type WeatherPick = 'auto' | 'sunny' | 'cloudy' | 'rain' | 'night';
export const WEATHER_PICKS: WeatherPick[] = ['auto', 'sunny', 'cloudy', 'rain', 'night'];
/** Four independent audio channels, each 0..1 (0 = off). */
export interface Settings {
  controls: Controls; view: View; tiltSens: number; // 1 soft, 2 normal, 3 sharp
  music: number;       // background music
  engine: number;      // car / engine / tyre / wind sounds
  radio: number;       // IBOM FM voice
  sfx: number;         // everything else: crashes, horn, coins, countdown, UI stings
  radioText: boolean;  // IBOM FM captions on screen
  haptics: boolean;    // phone vibration on crashes
  name: string;        // shown to friends in multiplayer
  v?: number;
}
export const SETTINGS_VERSION = 5;
export const DEFAULT_SETTINGS: Settings = { controls: 'arrows', view: 'behind', tiltSens: 2, music: .6, engine: 0, radio: .8, sfx: .8, radioText: true, haptics: true, name: '', v: SETTINGS_VERSION };
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : d);
/** Reads any older save (v1/v2 had music/sfx booleans) into the current shape. */
export function migrateSettings(raw: any): Settings {
  const d = DEFAULT_SETTINGS, r = raw && typeof raw === 'object' ? raw : {};
  const boolVol = (x: unknown, on: number) => (typeof x === 'boolean' ? (x ? on : 0) : undefined);
  const s: Settings = {
    controls: r.controls === 'tilt' ? 'tilt' : 'arrows', tiltSens: [1, 2, 3].includes(r.tiltSens) ? r.tiltSens : 2,
    view: VIEWS.includes(r.view) && (r.v ?? 0) >= 2 ? r.view : 'behind',
    music: num(boolVol(r.music, d.music) ?? r.music, d.music),
    engine: (r.v ?? 0) < 5 ? d.engine : num(r.engine ?? boolVol(r.sfx, d.engine), d.engine), // v5: the engine hum is OFF by default (players found it aggressive); everyone is reset to off once and can turn it up in Settings
    radio: num(r.radio ?? boolVol(r.sfx, d.radio), d.radio),
    sfx: num(boolVol(r.sfx, d.sfx) ?? r.sfx, d.sfx),
    radioText: typeof r.radioText === 'boolean' ? r.radioText : true,
    haptics: typeof r.haptics === 'boolean' ? r.haptics : true,
    name: typeof r.name === 'string' ? r.name.slice(0, 14) : '',
    v: SETTINGS_VERSION,
  };
  return s;
}
export const MAX_CRASHES = 5;
/** Revive price doubles each time it is used in one run: 300, 600, 1200 ... */
export const reviveCost = (used: number) => 300 * Math.pow(2, Math.min(used, 6));
