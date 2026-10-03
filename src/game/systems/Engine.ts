/** Smooth engine voice. The old one stacked bright saw/square waves through a hard shaper, which sounded like a buzzing lawnmower.
 *  This one is built the opposite way: triangle + sine partials only, gently low-passed, with every control value eased before it reaches
 *  the oscillators, so changes in speed, gear and throttle glide instead of jumping. No pops, no thumps, no whistle.
 *  Takes any BaseAudioContext so it can be rendered offline in tests. */
export interface EngineIn { rpm: number; load: number; speed: number; gear: number }
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class EngineSynth {
  private o: OscillatorNode[] = []; private lp1: BiquadFilterNode; private lp2: BiquadFilterNode; private body: BiquadFilterNode; private g: GainNode; private air: GainNode; private airF: BiquadFilterNode; private src: AudioBufferSourceNode;
  private rpm = .2; private load = 0; private spd = 0; private gear = 1; private dip = 0; private dead = false;
  constructor(private ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer) {
    const c = ctx; this.g = c.createGain(); this.g.gain.value = 0;
    this.lp1 = c.createBiquadFilter(); this.lp1.type = 'lowpass'; this.lp1.Q.value = .4; this.lp1.frequency.value = 300;
    this.lp2 = c.createBiquadFilter(); this.lp2.type = 'lowpass'; this.lp2.Q.value = .3; this.lp2.frequency.value = 520;
    this.body = c.createBiquadFilter(); this.body.type = 'peaking'; this.body.frequency.value = 160; this.body.Q.value = .8; this.body.gain.value = 3.5; // a little chest, not a rasp
    // partials: sub, fundamental (triangle), 2nd and 3rd soft sine partials
    const spec: [OscillatorType, number, number][] = [['sine', .5, .55], ['triangle', 1, 1], ['sine', 2, .34], ['sine', 3, .12]];
    for (const [type, mult, lvl] of spec) { const o = c.createOscillator(), gg = c.createGain(); o.type = type; o.frequency.value = 40 * mult; gg.gain.value = lvl; o.connect(gg); gg.connect(this.lp1); o.start(); this.o.push(o); (o as any)._m = mult; }
    this.lp1.connect(this.lp2); this.lp2.connect(this.body); this.body.connect(this.g); this.g.connect(dest);
    // intake air: very quiet, band-limited, follows throttle
    this.src = c.createBufferSource(); this.src.buffer = noise; this.src.loop = true; this.airF = c.createBiquadFilter(); this.airF.type = 'bandpass'; this.airF.frequency.value = 420; this.airF.Q.value = .6; this.air = c.createGain(); this.air.gain.value = 0;
    this.src.connect(this.airF); this.airF.connect(this.air); this.air.connect(dest); this.src.start();
  }
  /** Call every frame with raw physics values; smoothing happens inside. t = ctx time (s), dt = frame time (s). */
  update(inp: EngineIn, dt: number, t = this.ctx.currentTime) {
    if (this.dead) return; const k = (rate: number) => 1 - Math.exp(-dt * rate);
    this.rpm += (clamp(inp.rpm, 0, 1) - this.rpm) * k(5); this.load += (clamp(inp.load, 0, 1) - this.load) * k(4); this.spd += (clamp(inp.speed, 0, 1) - this.spd) * k(3);
    if (inp.gear !== this.gear) { if (inp.gear > this.gear) this.dip = .16; this.gear = inp.gear; } this.dip = Math.max(0, this.dip - dt);
    const r = clamp((this.rpm - .2) / .8, 0, 1), f0 = 36 + r * 62 + this.gear * 1.5;                       // 38..104 Hz: low, relaxed
    for (const o of this.o) o.frequency.setTargetAtTime(f0 * (o as any)._m, t, .07);
    const cut = 230 + r * 520 + this.load * 160 + this.spd * 120;                                             // never opens past ~1 kHz
    this.lp1.frequency.setTargetAtTime(cut, t, .12); this.lp2.frequency.setTargetAtTime(cut * 1.6, t, .12);
    const shift = this.dip > 0 ? .78 : 1;                                                                     // soft dip on upshift instead of a thump
    this.g.gain.setTargetAtTime((.018 + this.spd * .016 + r * .01 + this.load * .014) * shift, t, .1);
    this.air.gain.setTargetAtTime(this.load * (.0015 + this.spd * .003), t, .15); this.airF.frequency.setTargetAtTime(340 + this.spd * 380, t, .2);
  }
  stop() { if (this.dead) return; this.dead = true; for (const o of this.o) { try { o.stop(); } catch { /* ok */ } } try { this.src.stop(); } catch { /* ok */ } this.g.disconnect(); this.air.disconnect(); }
}
