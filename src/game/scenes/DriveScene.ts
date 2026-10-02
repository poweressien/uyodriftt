import Phaser from 'phaser';
import { DISTRICTS, WEATHER_FX, Weather, District } from '../data/districts';
import { LAYOUTS, Layout } from '../data/layouts';
import { VEHICLES, VehicleStats, toPhysics, KMH, Phys } from '../data/vehicles';
import { SMOKES } from '../data/progression';
import { VIEW_LABEL, View } from '../data/settings';
import type { Renderer3D, R3DCar, R3DHaz } from '../render3d/Renderer3D';
import type { RunConfig } from '../types';
import { CarPhysics } from '../systems/CarPhysics';
import { DriftScorer } from '../systems/DriftScorer';
import { GameAudio, music } from '../systems/Audio';
import { Radio, speak, RadioKind } from '../systems/Radio';
import { buildTrack, locate, at, Track } from '../systems/Track';
import { buildWorld, rng } from '../systems/World';
import { buildCar, makeGrass, bodyShade, WHEEL_TINT } from '../systems/Textures';
import { CameraRig } from '../systems/CameraRig';
import { boxHit, resolveHit } from '../systems/Collision';
import { HazardField } from '../systems/Hazards';
import { ImpactFx } from '../systems/ImpactFx';
import { tilt } from '../systems/Controls';
import { getSave, setSettings } from '../../state/store';

const RUN_SECONDS = 90, LAP_BONUS = 500, COUNTDOWN = 3.2, TRAFFIC_TINTS = [0x8a8f94, 0x2f4a66, 0xa8281f, 0xe6e6e6, 0x2c6b3e];
type TCar = { k: 'sedan' | 'suv'; car: Phaser.GameObjects.Container; f: number; spd: number; base: number; off: number; baseOff: number; nm: boolean; cool: number; kick: number; rot: number; spinV: number; l: number; w: number; color: number };
type Touch = { left: boolean; right: boolean; brake: boolean; hand: boolean };

export class DriveScene extends Phaser.Scene {
  constructor() { super('Drive'); }
  private cfg!: RunConfig; private dist!: District; private layout!: Layout; private track!: Track; private veh!: VehicleStats; private pp!: Phys;
  private phys!: CarPhysics; private scorer = new DriftScorer(); private weather: Weather = 'sunny';
  private car!: Phaser.GameObjects.Container; private beam?: Phaser.GameObjects.Image; private ground!: Phaser.GameObjects.TileSprite; private carBody!: Phaser.GameObjects.Image; private carBrake!: Phaser.GameObjects.Image;
  private world!: ReturnType<typeof buildWorld>; private smoke!: Phaser.GameObjects.Particles.ParticleEmitter; private rig!: CameraRig; private fx!: ImpactFx; private haz!: HazardField;
  private traffic: TCar[] = []; private skids: Phaser.GameObjects.Image[] = []; private skidAge: number[] = []; private skidI = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>; private touch!: Touch; private touchMode = false; private baseColor = 0xffffff; private mass = 1; private pl = 62; private pw = 27;
  private offT = 0; private fastT = 0; private r3d?: Renderer3D; private r3dCars: R3DCar[] = []; private r3dHaz: R3DHaz[] = []; private shake3 = 0; private audio!: GameAudio; private radio!: Radio; private density = 1; private dmg = 0;
  private timeLeft = RUN_SECONDS; private countdown = COUNTDOWN; private lastCount = 4; private paused = false; private ended = false; private tiltChecked = false;
  private nextSpawn = 2; private hint = 4; private lastIdx = 4; private laps = 0; private armed = false; private floodT = 0; private hudT = 0; private frame = 0; private musT = 0;

  init(cfg: RunConfig) {
    this.offT = 0; this.fastT = 0; this.shake3 = 0;
    this.cfg = cfg; this.dist = DISTRICTS.find(x => x.id === cfg.districtId) ?? DISTRICTS[0]; this.veh = VEHICLES.find(x => x.id === cfg.vehicleId) ?? VEHICLES[0];
    this.layout = LAYOUTS[this.dist.id] ?? LAYOUTS['ibom-plaza']; this.track = buildTrack(this.layout); this.pp = toPhysics(this.veh, cfg.car.upgrades);
    this.weather = cfg.weather ?? Phaser.Utils.Array.GetRandom(this.dist.weather); this.density = this.dist.traffic + this.dist.difficulty * .1;
    this.scorer = new DriftScorer(); this.timeLeft = RUN_SECONDS; this.countdown = COUNTDOWN; this.lastCount = 4; this.paused = false; this.ended = false; this.tiltChecked = false; this.dmg = 0;
    this.traffic = []; this.skids = []; this.skidAge = []; this.skidI = 0; this.hint = 4; this.lastIdx = 4; this.laps = 0; this.armed = false; this.floodT = 0; this.nextSpawn = 2;
    const suv = this.veh.kind === 'suv'; this.pl = suv ? 68 : 62; this.pw = suv ? 31 : 27; this.mass = 1 + (this.veh.weight - 5) * .08;
  }

  create() {
    const { width: W, height: H } = this.scale, t = this.track, cam = this.cameras.main, pal = this.dist.palette, look = this.cfg.car;
    const gkey = `grass-${this.dist.id}`; makeGrass(this, gkey, pal.ground);
    cam.setBackgroundColor(pal.ground); const GS = Math.ceil(Math.hypot(W, H) * 3); this.ground = this.add.tileSprite(0, 0, GS, GS, gkey).setDepth(-10);
    this.world = buildWorld(this, t, this.layout, this.dist, rng([...this.dist.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)));
    // start / finish: chequered line + road paint
    const p0 = t.pts[0], n0 = t.nrm[0], tg = t.tan[0], sg = this.add.graphics().setDepth(-0.9);
    for (let row = 0; row < 2; row++) for (let k = -Math.floor(t.width / 40); k < Math.floor(t.width / 40); k++) { sg.fillStyle((k + row) % 2 ? 0x111111 : 0xffffff, .95); const cx = p0.x + n0.x * (k * 20 + 10) + tg.x * (row * 20 - 10), cy = p0.y + n0.y * (k * 20 + 10) + tg.y * (row * 20 - 10); sg.fillPoints([{ x: cx - 10 * n0.x - 10 * tg.x, y: cy - 10 * n0.y - 10 * tg.y }, { x: cx + 10 * n0.x - 10 * tg.x, y: cy + 10 * n0.y - 10 * tg.y }, { x: cx + 10 * n0.x + 10 * tg.x, y: cy + 10 * n0.y + 10 * tg.y }, { x: cx - 10 * n0.x + 10 * tg.x, y: cy - 10 * n0.y + 10 * tg.y }], true); }
    this.add.text(p0.x + tg.x * 260, p0.y + tg.y * 260, this.dist.name.toUpperCase(), { fontFamily: 'Anton, Impact, sans-serif', fontSize: '64px', color: '#ffffff' }).setOrigin(.5).setRotation(Math.atan2(tg.y, tg.x)).setAlpha(.3).setDepth(-0.8);

    const s = t.pts[4]; this.phys = new CarPhysics(this.pp); this.phys.x = s.x; this.phys.y = s.y; this.phys.heading = Math.atan2(t.tan[4].y, t.tan[4].x);
    this.baseColor = look.paint ? parseInt(look.paint.slice(1), 16) : this.veh.color;
    this.car = buildCar(this, { color: this.baseColor, decal: look.decal, glass: .55 + look.tint * .15, wheel: WHEEL_TINT[look.wheels], kind: this.veh.kind, x: s.x, y: s.y }).setDepth(30).setRotation(this.phys.heading);
    this.carBody = this.car.getData('body'); this.carBrake = this.car.getData('brake');
    const vis = WEATHER_FX[this.weather].visibility;
    if (vis < .85) this.beam = this.add.image(s.x, s.y, 'beam').setOrigin(0, .5).setBlendMode(Phaser.BlendModes.ADD).setDepth(26).setRotation(this.phys.heading);
    this.smoke = this.add.particles(0, 0, 'smokep', { lifespan: 650, scale: { start: .6, end: 2.2 }, alpha: { start: .55, end: 0 }, speed: 18, emitting: false, tint: parseInt(SMOKES[look.smoke]?.slice(1) ?? 'ffffff', 16) }).setDepth(29);
    this.r3d = this.registry.get('r3d') as Renderer3D | undefined; this.fx = new ImpactFx(this, this.r3d); this.haz = new HazardField(this);
    for (let i = 0; i < 140; i++) { this.skids.push(this.add.image(0, 0, 'skid').setTint(0x000000).setDepth(-0.5).setVisible(false)); this.skidAge.push(9); }
    const cnt = Math.round(this.dist.traffic * 10); // traffic density per district
    for (let i = 0; i < cnt; i++) {
      const suv = i % 4 === 1, color = i % 3 === 0 ? 0xffb300 : Phaser.Utils.Array.GetRandom(TRAFFIC_TINTS), base = 2.2 + Math.random() * 2.3, off = (i % 2 ? 1 : -1) * t.width * .2;
      this.traffic.push({ k: suv ? 'suv' : 'sedan', car: buildCar(this, { color, kind: suv ? 'suv' : 'sedan' }).setDepth(8), f: 30 + (i * (t.n - 60)) / Math.max(1, cnt), spd: base, base, off, baseOff: off, nm: false, cool: 0, kick: 0, rot: 0, spinV: 0, l: suv ? 68 : 62, w: suv ? 31 : 27, color });
    }
    // camera: the rig replaces startFollow so views can rotate / zoom
    this.rig = new CameraRig(cam); this.rig.snap(s.x, s.y, this.phys.heading);
    this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x02140b, (1 - vis) * .95).setScrollFactor(0).setDepth(20);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,H,M,C,V,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
    this.touch = this.registry.get('touch') as Touch; this.touchMode = !!this.registry.get('touchMode'); this.input.addPointer(3); if (this.touchMode) tilt.start();
    this.registry.set('mode', 'drift'); this.registry.set('weather', this.weather);
    this.scene.launch('HUD'); this.world.update(this.rig.bounds(), true);
    this.r3d?.setup({ mode: 'drift', dist: this.dist, weather: this.weather, seed: [...this.dist.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) & 0xffff, track: this.track, layout: this.layout, player: { kind: this.veh.kind, color: this.baseColor, decal: look.decal, wheel: WHEEL_TINT[look.wheels], glass: .55 + look.tint * .15 }, traffic: this.traffic.map(t => t.k) });
    this.applyView(getSave().settings.view);
    this.audio = new GameAudio(this.weather, look.horn); music.start('drive');
    this.radio = new Radio(line => { this.game.events.emit('radio', line); if (!this.audio.isMuted()) speak(line); });
    const toggle = () => { this.paused = !this.paused; this.audio.setPaused(this.paused); this.game.events.emit('paused', this.paused); };
    const cycle = () => { const v = this.rig.next(); setSettings({ view: v }); this.applyView(v); this.game.events.emit('toast', `VIEW: ${VIEW_LABEL[v].toUpperCase()}`); };
    const quit = () => this.game.events.emit('quit'), recal = () => tilt.calibrate();
    this.game.events.on('pause-toggle', toggle); this.game.events.on('cam-next', cycle); this.game.events.on('quit-req', quit); this.game.events.on('tilt-cal', recal);
    const stop = () => { this.r3d?.setActive(false); if (this.cameras?.main) this.cameras.main.visible = true; this.game.events.off('pause-toggle', toggle); this.game.events.off('cam-next', cycle); this.game.events.off('quit-req', quit); this.game.events.off('tilt-cal', recal); tilt.stop(); music.stop(); this.audio.destroy(); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
    this.events.once('shutdown', stop); this.events.once('destroy', stop);
    this.time.delayedCall(9000, () => { if (this.weather === 'rain' || this.weather === 'heavy_rain') this.radio.say('rain'); else if (this.weather === 'night') this.radio.say('night'); });
    this.time.delayedCall(350, () => this.game.events.emit('info', { district: this.dist.name, weather: WEATHER_FX[this.weather].label, car: this.veh.name, touchMode: this.touchMode })); // HUD scene boots a frame later
  }

  private applyView(v: View) { const on = v === 'behind' && !!this.r3d?.ok; this.rig.setView(v); this.r3d?.setActive(on); this.cameras.main.visible = !on; }
  private draw3d(dt: number, brake: boolean) {
    const r = this.r3d; if (!r || !r.active) return; const P = this.phys, cs = this.r3dCars, hs = this.r3dHaz; this.shake3 = Math.max(0, this.shake3 - dt * 2.4);
    while (cs.length < this.traffic.length) cs.push({ x: 0, y: 0, h: 0, on: true, brake: false, color: 0, hit: false });
    this.traffic.forEach((t, i) => { const c = cs[i]; c.x = t.car.x; c.y = t.car.y; c.h = t.car.rotation; c.color = t.color; c.hit = t.cool > 0 && Math.abs(t.spinV) > .05; });
    const hl = this.haz.draw(); hs.length = hl.length; hl.forEach((h, i) => { const o = hs[i] ?? (hs[i] = { kind: 'cone', x: 0, y: 0, a: 1, s: 1, r: 0 }); o.kind = h.kind; o.x = h.x; o.y = h.y; o.a = h.alpha; o.s = h.scaleX; o.r = h.rotation; });
    r.frame({ dt, px: P.x, py: P.y, heading: P.heading, vx: P.vx, vy: P.vy, steer: P.delta, ax: P.ax, ay: P.ay, wheelRate: P.wheelRate, brake, ratio: P.speed / this.pp.maxSpeed, dmg: this.dmg, blink: false, shake: this.shake3, cars: cs, haz: hs });
  }
  private spawnHazard() {
    const kind = Phaser.Utils.Array.GetRandom(['pothole', 'cone', 'flood'] as const), cnt = kind === 'cone' ? 3 : 1; // cones = construction cluster
    const f = this.hint + 16 + Math.random() * 14, off = (Math.random() - .5) * this.track.width * .7;
    for (let k = 0; k < cnt; k++) { const q = at(this.track, f + k * .6, off + (k - 1) * 26); this.haz.add(kind, q.x, q.y); }
  }
  /** One place for every crash: score reset, sparks, shake, sound, haptics, damage. strength 0..1 */
  private crash(strength: number, x: number, y: number, color: number, damage = true, line?: RadioKind) {
    this.scorer.crash(); if (damage) { this.dmg = Math.min(1.2, this.dmg + strength * .3); this.carBody.setTint(bodyShade(this.baseColor, 1 - .38 * Math.min(1, this.dmg))); }
    this.fx.hit(x, y, strength, color); this.shake3 = Math.max(this.shake3, .35 + strength); this.cameras.main.shake(110 + strength * 230, .003 + strength * .012); this.audio.crash(strength); this.radio.say(line ?? (strength > .6 ? 'bigcrash' : 'crash'));
    if (navigator.vibrate) navigator.vibrate(30 + strength * 90); this.game.events.emit('crash', strength);
  }
  private near() { this.audio.whoosh(); this.game.events.emit('nearmiss', this.scorer.nearMiss()); this.radio.say('nearmiss'); }
  private skid(x: number, y: number, rot: number) { const i = this.skidI++ % this.skids.length; this.skids[i].setPosition(x, y).setRotation(rot).setAlpha(.5).setVisible(true); this.skidAge[i] = 0; }

  update(_t: number, ms: number) {
    const dt = Math.min(ms / 1000, .04), k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.ESC) || Phaser.Input.Keyboard.JustDown(k.P)) this.game.events.emit('pause-toggle');
    if (this.paused || this.ended) return;
    if (Phaser.Input.Keyboard.JustDown(k.C) || Phaser.Input.Keyboard.JustDown(k.V)) this.game.events.emit('cam-next');
    const P = this.phys, tr = this.track, n = tr.n, view = this.rig;
    const ground = this.ground; ground.setPosition(view.centerX, view.centerY); ground.tilePositionX = view.centerX - ground.width / 2; ground.tilePositionY = view.centerY - ground.height / 2; this.world.update(view.bounds());
    if (this.countdown > 0) { // 3-2-1-GO with the car held on the line
      this.countdown -= dt; const c = Math.ceil(this.countdown - .2); if (c !== this.lastCount) { this.lastCount = c; this.game.events.emit('countdown', c); this.audio.countdown(c); if (c <= 0) { tilt.calibrate(); this.radio.say('start'); } }
      view.update(dt, P.x, P.y, P.heading, 0, 0, 0); this.audio.update(0, 0); this.draw3d(dt, false); return;
    }
    const t = this.touch, set = getSave().settings, left = k.A.isDown || k.LEFT.isDown || t.left, right = k.D.isDown || k.RIGHT.isDown || t.right, brake = k.S.isDown || k.DOWN.isDown || t.brake;
    const throttle = k.W.isDown || k.UP.isDown || (this.touchMode && !brake) ? 1 : 0, hand = k.SPACE.isDown || k.SHIFT.isDown || t.hand;
    let steer = (right ? 1 : 0) - (left ? 1 : 0); if (this.touchMode && set.controls === 'tilt') steer = Math.max(-1, Math.min(1, steer + tilt.value));
    if (!this.tiltChecked && this.countdown < -1.5) { this.tiltChecked = true; if (this.touchMode && set.controls === 'tilt' && !tilt.got) this.game.events.emit('toast', 'NO TILT SENSOR - SWITCH TO ARROWS IN PAUSE MENU'); }
    if (Phaser.Input.Keyboard.JustDown(k.H)) this.audio.horn(); if (Phaser.Input.Keyboard.JustDown(k.M)) this.audio.toggleMute();

    const loc = locate(tr, P.x, P.y, this.hint); this.hint = loc.i; const off = loc.d > tr.width / 2 + 28;
    this.floodT = Math.max(0, this.floodT - dt);
    P.step(dt, { throttle, brake, steer, hand }, off, WEATHER_FX[this.weather].grip * (this.floodT > 0 ? .45 : 1));
    const speed = P.speed, c = Math.cos(P.heading), s = Math.sin(P.heading);
    this.car.setPosition(P.x, P.y).setRotation(P.heading); if (this.beam) this.beam.setPosition(P.x + c * 30, P.y + s * 30).setRotation(P.heading); this.carBrake.setAlpha(brake ? .95 : 0);
    view.update(dt, P.x, P.y, P.heading, P.vx, P.vy, speed / this.pp.maxSpeed);
    if (off && speed > 200) { this.cameras.main.shake(60, .0016); this.shake3 = Math.max(this.shake3, .12); if ((this.offT += dt) > 1.6) { this.offT = -8; this.radio.say('offroad'); } }
    if (speed > this.pp.maxSpeed * .94) { if ((this.fastT += dt) > 3.5) { this.fastT = -25; this.radio.say('fast'); } }
    this.fx.damage(dt, P.x, P.y, P.heading, this.dmg > .3 ? Math.min(1, this.dmg) : 0);
    // slide feedback: tyre smoke + skid marks
    if (Math.abs(P.vl) > 75) { const rx = P.x - c * 24, ry = P.y - s * 24; this.smoke.emitParticleAt(rx, ry, 1); this.r3d?.tyreSmoke(rx, ry, P.vx, P.vy);
      if (!off && this.frame % 2 === 0) { this.skid(rx - s * 12, ry + c * 12, Math.atan2(P.vy, P.vx)); this.skid(rx + s * 12, ry - c * 12, Math.atan2(P.vy, P.vx)); } }
    if ((this.frame++ & 3) === 0) for (let i = 0; i < this.skids.length; i++) if (this.skidAge[i] < 6) { this.skidAge[i] += dt * 4; const a = .5 * (1 - this.skidAge[i] / 6); if (a <= 0) this.skids[i].setVisible(false); else this.skids[i].setAlpha(a); }
    // scoring
    const res = this.scorer.update(dt, off ? 0 : speed, P.slipDeg);
    if (res) { this.game.events.emit('drift', res); this.radio.say(res.perfect ? 'perfect' : res.combo >= 4 ? 'combo' : 'drift'); }
    this.audio.update(speed / this.pp.maxSpeed, Math.min(1, Math.abs(P.vl) / 170), throttle, P.rpm, P.gear); this.radio.tick(dt); this.draw3d(dt, brake);
    this.musT -= dt; if (this.musT <= 0) { this.musT = .5; music.setIntensity(.25 + Math.min(1, this.scorer.combo / 6) * .6); }
    // laps
    if (loc.i > n * .45 && loc.i < n * .55) this.armed = true;
    if (this.armed && this.lastIdx > n * .85 && loc.i < n * .15) { this.armed = false; this.laps++; this.radio.say('lap'); this.scorer.bonus(LAP_BONUS); this.game.events.emit('lap', { lap: this.laps, bonus: LAP_BONUS }); }
    this.lastIdx = loc.i;
    // hazards
    this.nextSpawn -= dt; if (this.nextSpawn <= 0) { this.spawnHazard(); this.nextSpawn = Math.max(.8, 2.6 - this.density); }
    this.haz.update(P.x, P.y, speed, {
      onFlood: () => { this.floodT = .9; P.bump(.985); this.radio.say('flood'); }, onNear: () => this.near(),
      onHit: (kind, h) => { P.bump(kind === 'cone' ? .75 : .6); this.crash(kind === 'cone' ? .35 : .3, h.x, h.y, kind === 'cone' ? 0xff8c1a : 0x4a3a2a, kind === 'cone', kind === 'cone' ? 'cone' : 'pothole'); },
    });
    // traffic: real box-vs-box collisions; hit cars spin and get shoved sideways before recovering
    const pBox = { x: P.x, y: P.y, h: P.heading, l: this.pl - 3, w: this.pw - 3 };
    for (const tc of this.traffic) {
      tc.cool = Math.max(0, tc.cool - dt); tc.f = (tc.f + tc.spd * dt) % n; tc.spd += (tc.base - tc.spd) * Math.min(1, dt * .6);
      tc.kick *= Math.pow(.03, dt); tc.off += (tc.baseOff - tc.off) * Math.min(1, dt * 1.1) + tc.kick * dt; tc.rot += tc.spinV * dt; tc.spinV *= Math.pow(.05, dt); tc.rot -= tc.rot * Math.min(1, dt * 1.5);
      const q = at(tr, tc.f, tc.off), ti = Math.floor(tc.f) % n, tan = tr.tan[ti], nrm = tr.nrm[ti], hd = Math.atan2(tan.y, tan.x) + tc.rot; tc.car.setPosition(q.x, q.y).setRotation(hd);
      const d = Phaser.Math.Distance.Between(q.x, q.y, P.x, P.y);
      if (d < 70) {
        const tvx = tan.x * tc.spd * 40 + nrm.x * tc.kick, tvy = tan.y * tc.spd * 40 + nrm.y * tc.kick, hit = boxHit(pBox, { x: q.x, y: q.y, h: hd, l: tc.l - 3, w: tc.w - 3 });
        if (hit) {
          const imp = resolveHit(P, this.mass, { x: q.x, y: q.y, vx: tvx, vy: tvy, mass: 0, spin: 0 }, hit, .3), rel = Math.hypot(P.vx - tvx, P.vy - tvy);
          if (tc.cool <= 0) {
            tc.cool = .8; const st = Math.max(.12, Math.min(1, Math.max(imp, rel * .4) / 420)); tc.kick = (-hit.nx * nrm.x - hit.ny * nrm.y) * (140 + st * 260); tc.spinV = (Math.sign((hit.px - q.x) * -hit.ny - (hit.py - q.y) * -hit.nx) || 1) * (1.5 + st * 4); tc.spd *= .45;
            this.crash(st, hit.px, hit.py, tc.color);
          }
        } else if (d < 100 && !tc.nm && speed > 200) { tc.nm = true; this.near(); }
      } else if (d > 190) tc.nm = false;
      if (d > 1800) tc.f = (this.hint + 30 + Math.random() * 20) % n;
    }
    // HUD feed (20 Hz)
    this.hudT += dt; if (this.hudT > .05) { this.hudT = 0; this.game.events.emit('stats', { score: this.scorer.total, combo: this.scorer.combo, speed: Math.round(speed * KMH), time: Math.ceil(this.timeLeft), laps: this.laps, live: this.scorer.live, off }); }
    this.timeLeft -= dt; if (this.timeLeft <= 0) this.finish();
  }
  private finish() {
    this.ended = true; const bonus = this.scorer.finish();
    this.game.events.emit('end', { districtId: this.dist.id, vehicleId: this.veh.id, weather: this.weather, points: this.scorer.total, durationSec: RUN_SECONDS, maxCombo: this.scorer.maxCombo, drifts: this.scorer.drifts, topSpeed: Math.round(this.scorer.topSpeed * KMH), clean: bonus > 0, cleanBonus: bonus, laps: this.laps });
    this.scene.stop('HUD');
  }
}
