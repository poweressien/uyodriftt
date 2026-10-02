import { useSyncExternalStore } from 'react';
import { setVolumes } from '../game/systems/AudioCtx';
export interface Settings { controls: 'arrows' | 'tilt'; tiltSens: number; tiltInvert: boolean; camera: 'top' | 'chase' | 'wide'; music: boolean; sfx: boolean; musicVol: number; sfxVol: number; mode: 'circuit' | 'endless' }
const KEY = 'uyo-drift-settings-v1', DEF: Settings = { controls: 'arrows', tiltSens: 1, tiltInvert: false, camera: 'top', music: true, sfx: true, musicVol: .7, sfxVol: .85, mode: 'circuit' };
let s: Settings = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } })(); const subs = new Set<() => void>();
const push = () => setVolumes({ music: s.musicVol, sfx: s.sfxVol, musicOn: s.music, sfxOn: s.sfx }); push();
export const getSettings = () => s;
export function setSettings(p: Partial<Settings>) { s = { ...s, ...p }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } push(); subs.forEach(f => f()); }
export const useSettings = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => s);
