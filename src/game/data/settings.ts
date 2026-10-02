/** Player-facing options. Kept free of Phaser/React imports so both the UI and the game can use it. */
export type View = 'behind' | 'top' | 'chase' | 'wide' | 'hood';
export const VIEWS: View[] = ['behind', 'top', 'chase', 'wide', 'hood'];
export const VIEW_LABEL: Record<View, string> = { behind: 'Behind (3D)', top: 'Top', chase: 'Chase', wide: 'Wide', hood: 'Hood' };
export type Controls = 'arrows' | 'tilt';
export type Mode = 'drift' | 'endless';
export interface Settings { controls: Controls; view: View; music: boolean; sfx: boolean; v?: number }
export const DEFAULT_SETTINGS: Settings = { controls: 'arrows', view: 'behind', music: true, sfx: true, v: 2 };
export const MAX_CRASHES = 5;
/** Revive price doubles each time it is used in one run: 300, 600, 1200 ... */
export const reviveCost = (used: number) => 300 * Math.pow(2, Math.min(used, 6));
