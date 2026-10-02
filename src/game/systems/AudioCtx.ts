/** One shared AudioContext with separate music / sfx buses (volumes come from Settings). */
export interface Buses { ctx: BaseAudioContext; master: GainNode; music: GainNode; sfx: GainNode }
export function makeBuses(ctx: BaseAudioContext): Buses {
  const master = ctx.createGain(); master.gain.value = .9; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
  master.connect(comp); comp.connect(ctx.destination); const music = ctx.createGain(), sfx = ctx.createGain(); music.connect(master); sfx.connect(master); return { ctx, master, music, sfx };
}
let live: Buses | null = null, vol = { music: .6, sfx: .8, musicOn: true, sfxOn: true };
export function audio(): Buses | null { if (typeof AudioContext === 'undefined') return null; if (!live) { live = makeBuses(new AudioContext()); apply(); } return live; }
function apply() { if (!live) return; live.music.gain.value = vol.musicOn ? vol.music * .55 : 0; live.sfx.gain.value = vol.sfxOn ? vol.sfx : 0; }
export function setVolumes(v: Partial<typeof vol>) { vol = { ...vol, ...v }; apply(); }
export function unlock() { const b = audio(); if (b && b.ctx.state === 'suspended') void (b.ctx as AudioContext).resume(); }
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
export function noiseBuf(ctx: BaseAudioContext) { let b = noiseCache.get(ctx); if (!b) { b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseCache.set(ctx, b); } return b; }
/** Short filtered noise hit. */
export function burst(ctx: BaseAudioContext, out: AudioNode, t: number, type: BiquadFilterType, freq: number, q: number, dur: number, vol: number, sweepTo?: number) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + .05);
}
/** Short pitched tone with exponential decay. */
export function tone(ctx: BaseAudioContext, out: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', attack = .004) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
}
/** Menu / UI feedback sounds. */
export const sfx = {
  click() { const b = audio(); if (!b) return; const t = b.ctx.currentTime; tone(b.ctx, b.sfx, t, 520, 380, .07, .12, 'triangle'); },
  success() { const b = audio(); if (!b) return; const t = b.ctx.currentTime; [660, 880, 1320].forEach((f, i) => tone(b.ctx, b.sfx, t + i * .07, f, f, .22, .14, 'sine')); },
  error() { const b = audio(); if (!b) return; const t = b.ctx.currentTime; tone(b.ctx, b.sfx, t, 180, 120, .2, .16, 'sawtooth'); },
  coin() { const b = audio(); if (!b) return; const t = b.ctx.currentTime; tone(b.ctx, b.sfx, t, 1200, 1200, .08, .12, 'square'); tone(b.ctx, b.sfx, t + .07, 1800, 1800, .22, .12, 'square'); },
};
