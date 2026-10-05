/** Fully procedural Web Audio (no asset downloads): smooth engine, tyre screech, wind, rain, crashes, UI sounds and a generative
 *  Afrobeats-style music loop. One shared AudioContext with four independent channels (settings.music / engine / sfx here, radio in Radio.ts). */
import { getSave, setSettings, subscribe } from '../../state/store';
import { EngineSynth } from './Engine';

interface Bus { ctx: AudioContext; master: GainNode; sfx: GainNode; music: GainNode; engine: GainNode; noise: AudioBuffer }
let bus: Bus | null = null;
export function getBus(): Bus {
  if (bus) return bus;
  const AC = window.AudioContext || (window as any).webkitAudioContext, ctx: AudioContext = new AC();
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor(), sfx = ctx.createGain(), music = ctx.createGain(), engine = ctx.createGain();
  master.gain.value = .9; comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination); sfx.connect(master); music.connect(master); engine.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  bus = { ctx, master, sfx, music, engine, noise }; applyAudioSettings(); return bus;
}
export function applyAudioSettings() {
  if (!bus) return; const s = getSave().settings, t = bus.ctx.currentTime;
  bus.sfx.gain.setTargetAtTime(s.sfx * 1.05, t, .04); bus.engine.gain.setTargetAtTime(s.engine * .7, t, .06); bus.music.gain.setTargetAtTime(s.music * .85, t, .08);
}
subscribe(applyAudioSettings);
/** Call from a tap/key. Browsers keep audio suspended until the player interacts. */
export function unlockAudio() { try { const b = getBus(); if (b.ctx.state !== 'running') void b.ctx.resume(); } catch { /* no audio available */ } }
if (typeof window !== 'undefined') for (const e of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(e, () => { if (!bus || bus.ctx.state !== 'running') unlockAudio(); }, { passive: true });

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const noiseSrc = (b: Bus, loop = false) => { const s = b.ctx.createBufferSource(); s.buffer = b.noise; s.loop = loop; return s; };
/** One-shot noise burst through a filter with an exponential decay. */
function burst(b: Bus, out: AudioNode, t: number, type: BiquadFilterType, f: number, q: number, vol: number, dur: number, f2?: number) {
  const s = noiseSrc(b), fl = b.ctx.createBiquadFilter(), g = b.ctx.createGain(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
}
function tone(b: Bus, out: AudioNode, t: number, type: OscillatorType, f: number, f2: number, vol: number, dur: number, attack = .004) {
  const o = b.ctx.createOscillator(), g = b.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2 !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
}

// ---------------------------------------------------------------- music
type Kind = 'menu' | 'drive' | 'endless';
const CHORDS = [{ root: 33, tones: [57, 60, 64] }, { root: 29, tones: [53, 57, 60] }, { root: 36, tones: [55, 60, 64] }, { root: 31, tones: [55, 59, 62] }]; // Am F C G
const PENTA = [0, 3, 5, 7, 10], BPM: Record<Kind, number> = { menu: 98, drive: 112, endless: 124 };
const KICK: Record<Kind, number[]> = { menu: [0, 10], drive: [0, 6, 10], endless: [0, 4, 8, 12, 15] };
const seeded = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export class Music {
  private timer = 0; private step = 0; private nextT = 0; private kind: Kind = 'drive'; private track: GainNode | null = null; private fx: GainNode | null = null; private intensity = .4; private duckV = 1; private running = false;
  private leadIdx = 4;
  start(kind: Kind) {
    if (this.running && this.kind === kind) return; this.stop(true); const b = getBus(), c = b.ctx; this.kind = kind; this.running = true; this.step = 0; this.nextT = c.currentTime + .08;
    const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(this.duckV, c.currentTime + 1.2); g.connect(b.music); this.track = g;
    const dl = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), send = c.createGain(); dl.delayTime.value = 60 / BPM[kind] * .75; fb.gain.value = .35; lp.type = 'lowpass'; lp.frequency.value = 2400; send.gain.value = .5;
    send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(g); this.fx = send;
    this.timer = window.setInterval(() => this.pump(), 25);
  }
  stop(quick = false) {
    if (!this.running) return; this.running = false; clearInterval(this.timer); const tr = this.track; this.track = null; this.fx = null;
    if (tr && bus) { const t = bus.ctx.currentTime; tr.gain.cancelScheduledValues(t); tr.gain.setTargetAtTime(0, t, quick ? .05 : .25); setTimeout(() => tr.disconnect(), quick ? 400 : 1600); }
  }
  setIntensity(v: number) { this.intensity = Math.max(0, Math.min(1, v)); }
  duck(v: number) { this.duckV = v; if (this.track && bus) this.track.gain.setTargetAtTime(v, bus.ctx.currentTime, .1); }
  private pump() {
    if (!bus || !this.track) return; const c = bus.ctx, sixteenth = 60 / BPM[this.kind] / 4;
    if (this.nextT < c.currentTime - .5) this.nextT = c.currentTime + .05; // tab was backgrounded: resync instead of burst-playing
    while (this.nextT < c.currentTime + .14) { if (getSave().settings.music > 0) this.play(this.step, this.nextT + ((this.step & 1) ? sixteenth * .1 : 0)); this.nextT += sixteenth; this.step++; }
  }
  private play(step: number, t: number) {
    const b = bus!, out = this.track!, k = this.kind, bar = (step >> 4) & 3, st = step & 15, ch = CHORDS[bar], I = this.intensity, menu = k === 'menu', v = menu ? .6 : 1;
    if (KICK[k].includes(st)) tone(b, out, t, 'sine', 150, 42, .75 * v, .26);
    if (st === 4 || st === 12) { burst(b, out, t, 'bandpass', 1500, 1.2, .3 * v, .13); burst(b, out, t + .012, 'bandpass', 1900, 1.2, .22 * v, .11); tone(b, out, t, 'triangle', 190, 150, .12 * v, .1); }
    if (k !== 'menu' || st % 4 === 2) { const open = st === 14; burst(b, out, t, 'highpass', 7500, .7, (st % 4 === 2 ? .13 : .07) * v, open ? .2 : .045); }
    if (!menu && (st & 1) && (k === 'endless' ? I > .3 : true)) burst(b, out, t, 'bandpass', 5200, 1, .06, .05);
    if (!menu && (I > .55 || k === 'endless') && st % 2 === 0 && st % 4 !== 2) burst(b, out, t, 'highpass', 9000, .7, .05, .03);
    if (st === 3 || st === 7 || st === 11 || st === 14) tone(b, out, t, 'sine', st % 8 === 3 ? 330 : 250, st % 8 === 3 ? 260 : 200, .11 * v, .13);
    const bassHits: Record<number, number> = { 0: 0, 3: 0, 6: 12, 8: 0, 11: 7, 14: 12 };
    if (st in bassHits && (!menu || st === 0 || st === 8 || st === 11)) { const f = mtof(ch.root + bassHits[st]); tone(b, out, t, 'sine', f, f, .55 * v, .34); tone(b, out, t, 'triangle', f * 2, f * 2, .12 * v, .2); }
    if (st === 2 || st === 7 || st === 10) ch.tones.forEach(m => { for (const det of [-7, 7]) { const o = b.ctx.createOscillator(), g = b.ctx.createGain(), fl = b.ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; fl.type = 'lowpass'; fl.frequency.setValueAtTime(2200, t); fl.frequency.exponentialRampToValueAtTime(500, t + .22);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.045 * v, t + .01); g.gain.exponentialRampToValueAtTime(.0008, t + .26); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + .3); } });
    if (st % 2 === 0 && (menu || I > .2 || k === 'drive')) { // lead: repeats every 8 bars, plucked pentatonic line
      const r = seeded(((step >> 4) % 8) * 977 + st * 31 + 13); if (r() < (menu ? .38 : .5)) { this.leadIdx = Math.max(0, Math.min(9, this.leadIdx + Math.floor(r() * 5) - 2)); const m = 69 + PENTA[this.leadIdx % 5] + 12 * Math.floor(this.leadIdx / 5), f = mtof(m);
        tone(b, out, t, 'triangle', f, f, .1 * v, .4, .003); tone(b, out, t, 'sine', f * 2, f * 2, .035 * v, .25, .003); if (this.fx) { const o = b.ctx.createOscillator(), g = b.ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0008, t + .35); o.connect(g); g.connect(this.fx); o.start(t); o.stop(t + .4); } } }
  }
}
export const music = new Music();

// ---------------------------------------------------------------- per-run sound effects
type HornSpec = { f: number[]; dur: number; type: OscillatorType };
const HORNS: Record<string, HornSpec> = {
  classic: { f: [440, 554], dur: .35, type: 'triangle' }, danfo: { f: [311, 392], dur: .7, type: 'triangle' },
  keke: { f: [880], dur: .18, type: 'triangle' }, air: { f: [233, 293], dur: 1, type: 'triangle' },
};
export class GameAudio {
  private b = getBus(); private out: GainNode; private carOut: GainNode; private sources: (OscillatorNode | AudioBufferSourceNode)[] = []; private dead = false; private timer = 0; private eng: EngineSynth;
  private screech: GainNode; private wind: GainNode; private last = 0;
  /** `out` carries crashes, horn, coins, rain and other effects (sfx channel). `carOut` carries the engine, tyres and wind (engine channel). */
  constructor(weather: string, private hornId: string) {
    const b = this.b, c = b.ctx; this.out = c.createGain(); this.out.connect(b.sfx); this.carOut = c.createGain(); this.carOut.connect(b.engine); unlockAudio();
    this.eng = new EngineSynth(c, this.carOut, b.noise);
    this.screech = c.createGain(); this.wind = c.createGain(); // tyre screech and wind noise were removed: they were the harsh part of the car sound (gains stay at 0, unconnected)
    this.loop('highpass', 1200, weather === 'heavy_rain' ? .16 : weather === 'rain' ? .08 : 0, .7); this.loop('lowpass', 260, .035, .7); this.loop('bandpass', 900, weather === 'night' ? .006 : .012, .5);
    this.timer = window.setInterval(() => { if (!this.dead) this.beep([Math.random() < .5 ? 420 : 520], .3, .012, 'triangle'); }, 14000 + Math.random() * 10000); // distant horn in the traffic
  }
  /** Looping filtered noise. `lp` adds a low-pass after the band so it never turns hissy. */
  private loop(type: BiquadFilterType, freq: number, gain: number, q: number, dest: AudioNode = this.out, lp = 0) {
    const c = this.b.ctx, s = noiseSrc(this.b, true), f = c.createBiquadFilter(), g = c.createGain(); f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain; s.connect(f);
    if (lp) { const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; f.connect(l); l.connect(g); } else f.connect(g);
    g.connect(dest); s.start(); this.sources.push(s); return g;
  }
  private beep(freqs: number[], dur: number, vol: number, type: OscillatorType) { const t = this.b.ctx.currentTime; for (const f of freqs) tone(this.b, this.out, t, type, f, f, vol, dur, .01); }
  /** ratio 0..1 of top speed, slip 0..1 sideways, load 0..1 throttle, prpm 0..1 engine speed, pgear 1..6 */
  update(ratio: number, slip: number, load = 0, prpm?: number, pgear?: number) {
    if (this.dead) return; const c = this.b.ctx, t = c.currentTime, dt = Math.min(.1, Math.max(.001, t - this.last || .016)); this.last = t; const r = Math.min(1, ratio);
    let rpm = prpm ?? .22 + r * .7, gear = pgear ?? Math.min(6, 1 + Math.floor(r * 5));
    this.eng.update({ rpm, load, speed: r, gear }, dt, t);
    this.screech.gain.setTargetAtTime(slip > .35 ? Math.min(.016, (slip - .35) * .03) : 0, t, .12); this.wind.gain.setTargetAtTime(r * r * .01, t, .25);
  }
  horn() { const h = HORNS[this.hornId] ?? HORNS.classic; this.beep(h.f, h.dur, .15, h.type); }
  /** severity 0..1 */
  crash(sev = .6) {
    const b = this.b, t = b.ctx.currentTime, s = Math.max(.15, Math.min(1, sev));
    tone(b, this.out, t, 'sine', 120, 40, .2 + .28 * s, .3); burst(b, this.out, t, 'lowpass', 900, .7, .2 * s + .05, .35, 300);
    
  }
  thud() { this.crash(.45); }
  scrape(sev = .5) { burst(this.b, this.out, this.b.ctx.currentTime, 'lowpass', 700, .7, .05 * sev + .02, .22, 500); }
  whoosh() { burst(this.b, this.out, this.b.ctx.currentTime, 'bandpass', 500, 1.2, .1, .4, 2600); }
  countdown(n: number) { const t = this.b.ctx.currentTime; if (n > 0) tone(this.b, this.out, t, 'triangle', 520, 520, .08, .2, .01); else { tone(this.b, this.out, t, 'triangle', 1040, 1040, .1, .5, .01); tone(this.b, this.out, t, 'sine', 520, 520, .05, .5, .01); } }
  coin() { const t = this.b.ctx.currentTime; tone(this.b, this.out, t, 'triangle', 988, 988, .06, .08); tone(this.b, this.out, t + .08, 'triangle', 1319, 1319, .06, .22); }
  /** Achievement / reward chime */
  chime() { const t = this.b.ctx.currentTime; [784, 988, 1319, 1568].forEach((f, i) => tone(this.b, this.out, t + i * .08, 'triangle', f, f, .09, .45, .01)); }
  sting(kind: 'over' | 'revive' | 'milestone') {
    const t = this.b.ctx.currentTime, seq = kind === 'over' ? [392, 330, 262, 196] : kind === 'revive' ? [262, 330, 392, 523, 659] : [659, 784, 1047];
    seq.forEach((f, i) => tone(this.b, this.out, t + i * (kind === 'over' ? .22 : .09), 'triangle', f, f, .09, kind === 'over' ? .5 : .3, .01));
  }
  setPaused(p: boolean) { const t = this.b.ctx.currentTime; this.out.gain.setTargetAtTime(p ? 0 : 1, t, .03); this.carOut.gain.setTargetAtTime(p ? 0 : 1, t, .03); music.duck(p ? .3 : 1); }
  toggleMute() { toggleMuteAll(); }
  destroy() {
    if (this.dead) return; this.dead = true; clearInterval(this.timer); const t = this.b.ctx.currentTime; this.out.gain.setTargetAtTime(0, t, .05); this.carOut.gain.setTargetAtTime(0, t, .05);
    setTimeout(() => { this.eng.stop(); this.sources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } }); this.out.disconnect(); this.carOut.disconnect(); }, 400);
  }
}
let muteBackup: { music: number; engine: number; radio: number; sfx: number } | null = null;
/** M key: silence every channel, press again to bring back exactly the levels that were set. */
export function toggleMuteAll() {
  const s = getSave().settings;
  if (s.music + s.engine + s.radio + s.sfx > 0) { muteBackup = { music: s.music, engine: s.engine, radio: s.radio, sfx: s.sfx }; setSettings({ music: 0, engine: 0, radio: 0, sfx: 0 }); }
  else setSettings(muteBackup ?? { music: .6, engine: .35, radio: .8, sfx: .8 });
}

/** Menu sounds (sfx channel): taps, back, purchase, reward, error. Silent until the first user gesture unlocks audio. */
export function uiSound(kind: 'tap' | 'back' | 'buy' | 'reward' | 'error' | 'tick') {
  try {
    const b = getBus(); if (b.ctx.state !== 'running') { void b.ctx.resume(); } const t = b.ctx.currentTime, o = b.sfx;
    if (kind === 'tap') tone(b, o, t, 'triangle', 660, 520, .07, .09, .004);
    else if (kind === 'tick') tone(b, o, t, 'triangle', 880, 880, .035, .04, .002);
    else if (kind === 'back') tone(b, o, t, 'triangle', 440, 330, .07, .12, .004);
    else if (kind === 'error') { tone(b, o, t, 'triangle', 220, 200, .05, .14, .004); tone(b, o, t + .1, 'triangle', 180, 160, .05, .16, .004); }
    else if (kind === 'buy') { tone(b, o, t, 'triangle', 988, 988, .05, .07); tone(b, o, t + .07, 'triangle', 1319, 1319, .05, .07); tone(b, o, t + .14, 'triangle', 1760, 1760, .05, .2); }
    else [784, 988, 1319, 1568].forEach((f, i) => tone(b, o, t + i * .08, 'triangle', f, f, .08, .45, .01));
  } catch { /* no audio */ }
}
/** Silences the whole game while a rewarded ad plays (the ad brings its own sound). */
export function duckForAd(on: boolean) { if (!bus) return; bus.master.gain.setTargetAtTime(on ? 0 : .9, bus.ctx.currentTime, .03); }
