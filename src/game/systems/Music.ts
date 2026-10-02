import { audio, makeBuses, Buses, noiseBuf, burst, tone } from './AudioCtx';
/** Procedural Afrobeats loop (104 BPM, A minor): drums, bass, guitar-style stabs, kalimba melody, pad. 'menu' = laid back, 'race' = full groove. */
export type MusicMode = 'menu' | 'race';
const BPM = 104, STEP = 60 / BPM / 4;
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 67]], BASS = [45, 41, 48, 43], PENT = [69, 72, 74, 76, 79, 81, 76, 72];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const hash = (n: number) => { let t = (n + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** Schedules everything that sounds at one 16th-note step (pure function of time/step so it can also render offline). */
export function scheduleStep(B: Buses, t: number, step: number, mode: MusicMode) {
  const c = B.ctx, o = B.music, s = step % 16, bar = Math.floor(step / 16), ch = bar % 4, race = mode === 'race', sw = s % 2 ? STEP * .12 : 0;
  const kicks = race ? [0, 6, 10, 13] : [0, 10];
  if (kicks.includes(s)) { tone(c, o, t, 150, 42, .2, race ? .85 : .5); burst(c, o, t, 'lowpass', 400, 1, .03, .2); }
  if (race ? (s === 4 || s === 12) : s === 12) { burst(c, o, t, 'bandpass', 1900, 1.2, .16, race ? .34 : .12); tone(c, o, t, 220, 160, .08, .12, 'triangle'); }
  if (s % 2 === 0 || race) burst(c, o, t + sw, 'highpass', 7500, .8, s % 4 === 2 ? .09 : .045, s % 4 === 2 ? .12 : .06);
  if (race && [3, 7, 11, 15].includes(s)) burst(c, o, t + sw, 'bandpass', 5200, 2, .06, .08);
  if ([2, 9, 14].includes(s) && race) tone(c, o, t, 320, 230, .12, .16, 'sine'); // conga
  // bass
  const bp = race ? [0, 3, 6, 10, 12] : [0, 10];
  if (bp.includes(s)) { const n = BASS[ch] + (s === 6 || s === 12 ? 12 : 0); tone(c, o, t, hz(n), hz(n), race ? .26 : .5, race ? .5 : .3, 'sine'); tone(c, o, t, hz(n) * 2, hz(n) * 2, .12, .08, 'triangle'); }
  // guitar-style offbeat stabs
  if (race && [3, 6, 11].includes(s)) CHORDS[ch].slice(1).forEach((n, i) => tone(c, o, t + i * .006, hz(n + 12), hz(n + 12), .13, .06, 'sawtooth'));
  // pad
  if (s === 0) CHORDS[ch].forEach(n => tone(c, o, t, hz(n), hz(n), STEP * 14, race ? .035 : .06, 'triangle', .35));
  // kalimba melody: 2-bar motif that repeats
  if (s % 2 === 0) { const h = hash((bar % 2) * 16 + s + 7); if (h < (race ? .62 : .4)) { const n = PENT[Math.floor(hash((bar % 2) * 31 + s) * PENT.length)] + (ch === 3 && h < .1 ? 2 : 0); tone(c, o, t, hz(n), hz(n), .38, .11, 'triangle'); tone(c, o, t, hz(n) * 2, hz(n) * 2, .14, .035, 'sine'); } }
}
class Music {
  private B: Buses | null = null; private timer = 0; private next = 0; private step = 0; mode: MusicMode = 'menu'; private on = false; private duck = 1;
  start() { if (this.on) return; const B = (this.B = audio()); if (!B) return; this.on = true; this.step = 0; this.next = B.ctx.currentTime + .1; noiseBuf(B.ctx);
    this.timer = window.setInterval(() => { if (!this.B) return; const c = this.B.ctx; if (c.state !== 'running') { this.next = c.currentTime + .1; return; } while (this.next < c.currentTime + .18) { scheduleStep(this.B, this.next, this.step++, this.mode); this.next += STEP; } }, 40); }
  setMode(m: MusicMode) { this.mode = m; }
  setDuck(d: boolean) { this.duck = d ? .35 : 1; if (this.B) this.B.music.gain.setTargetAtTime(this.duck, this.B.ctx.currentTime, .1); }
  stop() { clearInterval(this.timer); this.on = false; }
}
export const music = new Music();
export { makeBuses };
