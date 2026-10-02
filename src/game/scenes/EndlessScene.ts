import Phaser from 'phaser';
import { DISTRICTS, WEATHER_FX, Weather, District, Decor } from '../data/districts';
import { VEHICLES, VehicleStats, toPhysics, KMH, Phys } from '../data/vehicles';
import { SMOKES } from '../data/progression';
import { VIEW_LABEL, MAX_CRASHES, reviveCost, View } from '../data/settings';
import type { Renderer3D, R3DCar, R3DHaz } from '../render3d/Renderer3D';
import type { RunConfig, RunResult } from '../types';
import { CarPhysics } from '../systems/CarPhysics';
import { DriftScorer } from '../systems/DriftScorer';
import { GameAudio, music } from '../systems/Audio';
import { Radio, speak, RadioKind } from '../systems/Radio';
import { prop, rng } from '../systems/World';
import { buildCar, makeGrass, bodyShade, WHEEL_TINT } from '../systems/Textures';
import { CameraRig } from '../systems/CameraRig';
import { boxHit, resolveHit } from '../systems/Collision';
import { HazardField } from '../systems/Hazards';
import { ImpactFx } from '../systems/ImpactFx';
import { tilt } from '../systems/Controls';
import { getSave, setSettings, spendCoins } from '../../state/store';

/** Endless Drive: one dead-straight, never-ending road. Hit 5 cars and it is game over (revive with coins, restart, or menu). Road runs towards -y. */
const ROAD_W = 440, LANES = 4, LANE_W = ROAD_W / LANES, KERB = 18, SHOULDER = 150, TW = ROAD_W + 2 * (KERB + SHOULDER), WALL = TW / 2 - 12, CHUNK = 1200, KM = 12000, M_PER_PX = 1 / 12, COUNTDOWN = 3.2, UP = -Math.PI / 2;
const TINTS = [0x8a8f94, 0x2f4a66, 0xa8281f, 0xe6e6e6, 0x2c6b3e, 0x1d2024, 0x7a5230], laneX = (i: number) => -ROAD_W / 2 + (i + .5) * LANE_W, hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
type Kind = 'sedan' | 'suv' | 'bus';
interface ECar { c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; brake: Phaser.GameObjects.Image; kind: Kind; l: number; w: number; mass: number; active: boolean; color: number;
  x: number; y: number; vx: number; vy: number; h: number; spin: number; base: number; spd: number; lane: number; changeT: number; hit: boolean; nm: boolean; smoke: number }
type Touch = { left: boolean; right: boolean; brake: boolean; hand: boolean };
const SPEC: Record<Kind, { l: number; w: number; mass: number }> = { sedan: { l: 62, w: 27, mass: 1 }, suv: { l: 68, w: 31, mass: 1.35 }, bus: { l: 94, w: 36, mass: 2.6 } };

export class EndlessScene extends Phaser.Scene {
  constructor() { super('Endless'); }
  private cfg!: RunConfig; private dist0!: District; private veh!: VehicleStats; private pp!: Phys; private phys!: CarPhysics; private scorer = new DriftScorer(); private weather: Weather = 'sunny';
  private car!: Phaser.GameObjects.Container; private carBody!: Phaser.GameObjects.Image; private carBrake!: Phaser.GameObjects.Image; private beam?: Phaser.GameObjects.Image; private ground!: Phaser.GameObjects.TileSprite; private road!: Phaser.GameObjects.TileSprite;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter; private rig!: CameraRig; private fx!: ImpactFx; private haz!: HazardField; private audio!: GameAudio; private radio!: Radio;
  private cars: ECar[] = []; private chunks = new Map<number, Phaser.GameObjects.GameObject[]>(); private skids: Phaser.GameObjects.Image[] = []; private skidAge: number[] = []; private skidI = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>; private touch!: Touch; private touchMode = false; private baseColor = 0xffffff; private mass = 1; private pl = 62; private pw = 27;
  private countdown = COUNTDOWN; private lastCount = 4; private paused = false; private over = false; private banked = false; private tiltChecked = false;
  private crashes = 0; private totalCrashes = 0; private revives = 0; private inv = 0; private dmg = 0; private distPx = 0; private lastKm = 0; private elapsed = 0; private nmCount = 0; private nmStreak = 0; private nmT = 0; private maxStreak = 1;
  private offT = 0; private fastT = 0; private r3d?: Renderer3D; private r3dCars: R3DCar[] = []; private r3dHaz: R3DHaz[] = []; private shake3 = 0; private nextHaz = 3; private frame = 0; private hudT = 0; private musT = 0; private scrapeT = 0; private chunkT = 0; private decorPick!: () => Decor; private seed = 1;

  init(cfg: RunConfig) {
    this.offT = 0; this.fastT = 0; this.shake3 = 0;
    this.cfg = cfg; this.dist0 = DISTRICTS.find(x => x.id === cfg.districtId) ?? DISTRICTS[0]; this.veh = VEHICLES.find(x => x.id === cfg.vehicleId) ?? VEHICLES[0]; this.pp = toPhysics(this.veh, cfg.car.upgrades);
    this.weather = cfg.weather ?? Phaser.Utils.Array.GetRandom(this.dist0.weather); this.scorer = new DriftScorer();
    this.cars = []; this.chunks = new Map(); this.skids = []; this.skidAge = []; this.skidI = 0; this.countdown = COUNTDOWN; this.lastCount = 4; this.paused = false; this.over = false; this.banked = false; this.tiltChecked = false;
    this.crashes = 0; this.totalCrashes = 0; this.revives = 0; this.inv = 0; this.dmg = 0; this.distPx = 0; this.lastKm = 0; this.elapsed = 0; this.nmCount = 0; this.nmStreak = 0; this.nmT = 0; this.maxStreak = 1; this.nextHaz = 3; this.frame = 0; this.seed = (Date.now() & 0xffff) + 1;
    const suv = this.veh.kind === 'suv'; this.pl = suv ? 68 : 62; this.pw = suv ? 31 : 27; this.mass = 1 + (this.veh.weight - 5) * .08;
  }

  private get dist() { return Math.floor(this.distPx * M_PER_PX); }
  private get score() { return this.dist + this.scorer.total; }

  /** Seamless tile: dirt shoulder, guard-rails, striped kerbs, asphalt with wear, edge lines and lane dashes. */
  private roadTexture(key: string) {
    if (this.textures.exists(key)) return; const pal = this.dist0.palette, t = this.textures.createCanvas(key, TW, 256)!, c = t.getContext(), r = rng(99);
    c.fillStyle = hex(pal.shoulder); c.fillRect(0, 0, TW, 256); for (let i = 0; i < 700; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)'; c.fillRect(r() * TW, r() * 256, 2 + r() * 3, 2 + r() * 3); }
    const a0 = SHOULDER + KERB, a1 = a0 + ROAD_W;
    for (let y = 0; y < 256; y += 32) for (const x of [SHOULDER, a1]) { c.fillStyle = (y / 32) % 2 ? '#ffffff' : '#ff8c1a'; c.fillRect(x, y, KERB, 32); }
    c.fillStyle = hex(pal.road); c.fillRect(a0, 0, ROAD_W, 256); for (let i = 0; i < 1400; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.05)'; c.fillRect(a0 + r() * ROAD_W, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    c.fillStyle = 'rgba(0,0,0,.1)'; for (let l = 0; l < LANES; l++) for (const o of [-22, 22]) c.fillRect(a0 + (l + .5) * LANE_W + o - 7, 0, 14, 256); // tyre wear
    c.fillStyle = 'rgba(255,255,255,.88)'; c.fillRect(a0 + 12, 0, 5, 256); c.fillRect(a1 - 17, 0, 5, 256);
    for (let l = 1; l < LANES; l++) for (const y of [0, 128]) c.fillRect(a0 + l * LANE_W - 3, y, 6, 64);
    for (const x of [0, TW - 12]) { const g = c.createLinearGradient(x, 0, x + 12, 0); g.addColorStop(0, '#6b7276'); g.addColorStop(.5, '#d7dde0'); g.addColorStop(1, '#6b7276'); c.fillStyle = g; c.fillRect(x, 0, 12, 256); c.fillStyle = '#2c3033'; for (let y = 0; y < 256; y += 64) c.fillRect(x + (x ? -4 : 12), y, 4, 8); }
    t.refresh();
  }
  private makeChunk(k: number) {
    const out: Phaser.GameObjects.GameObject[] = [], g = this.add.graphics().setDepth(3), r = rng(k * 7919 + this.seed), top = -(k + 1) * CHUNK; out.push(g);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) prop(g, 'lamp', side * (WALL + 16), top + i * (CHUNK / 5) + 40, r);
      for (let i = 0; i < 9; i++) { const kind = this.decorPick(), x = side * (WALL + 70 + r() * (kind === 'house' ? 340 : 230)); prop(g, kind, x, top + r() * CHUNK, r); }
    }
    if (k > 0 && k % (KM / CHUNK) === 0) { // kilometre marker painted across the road
      const y = -k * CHUNK, band = this.add.graphics().setDepth(-2); band.fillStyle(0xffffff, .55).fillRect(-ROAD_W / 2, y - 7, ROAD_W, 14); band.fillStyle(0xff8c1a, .8).fillRect(-ROAD_W / 2, y - 7, ROAD_W, 4);
      out.push(band, this.add.text(0, y - 70, `${k / (KM / CHUNK)} KM`, { fontFamily: 'Anton, Impact, sans-serif', fontSize: '84px', color: '#ffffff' }).setOrigin(.5).setAlpha(.5).setDepth(-1.5));
    }
    this.chunks.set(k, out);
  }
  private updateChunks(py: number) {
    const pk = Math.floor(-py / CHUNK); for (let k = pk - 2; k <= pk + 4; k++) if (!this.chunks.has(k)) this.makeChunk(k);
    this.chunks.forEach((objs, k) => { if (k < pk - 3 || k > pk + 7) { objs.forEach(o => o.destroy()); this.chunks.delete(k); } });
  }

  create() {
    const { width: W, height: H } = this.scale, cam = this.cameras.main, pal = this.dist0.palette, look = this.cfg.car;
    const gkey = `grass-${this.dist0.id}`; makeGrass(this, gkey, pal.ground); cam.setBackgroundColor(pal.ground); const GS = Math.ceil(Math.hypot(W, H) * 3);
    this.ground = this.add.tileSprite(0, 0, GS, GS, gkey).setDepth(-10);
    const rkey = `e-road-${this.dist0.id}`; this.roadTexture(rkey); this.road = this.add.tileSprite(0, 0, TW, GS, rkey).setDepth(-3);
    const wts = Object.entries(this.dist0.decor) as [Decor, number][], total = wts.reduce((a, [, w]) => a + w, 0), pr = rng(this.seed * 13);
    this.decorPick = () => { let x = pr() * total; for (const [k, w] of wts) if ((x -= w) < 0) return k; return wts[0][0]; };

    this.phys = new CarPhysics({ ...this.pp, steerLock: this.pp.steerLock * .92 }); this.phys.x = laneX(1); this.phys.y = 0; this.phys.heading = UP;
    this.baseColor = look.paint ? parseInt(look.paint.slice(1), 16) : this.veh.color;
    this.car = buildCar(this, { color: this.baseColor, decal: look.decal, glass: .55 + look.tint * .15, wheel: WHEEL_TINT[look.wheels], kind: this.veh.kind, x: this.phys.x, y: 0 }).setDepth(30).setRotation(UP);
    this.carBody = this.car.getData('body'); this.carBrake = this.car.getData('brake');
    const vis = WEATHER_FX[this.weather].visibility; if (vis < .85) this.beam = this.add.image(0, 0, 'beam').setOrigin(0, .5).setBlendMode(Phaser.BlendModes.ADD).setDepth(26).setRotation(UP);
    this.smoke = this.add.particles(0, 0, 'smokep', { lifespan: 650, scale: { start: .6, end: 2.2 }, alpha: { start: .55, end: 0 }, speed: 18, emitting: false, tint: parseInt(SMOKES[look.smoke]?.slice(1) ?? 'ffffff', 16) }).setDepth(29);
    this.r3d = this.registry.get('r3d') as Renderer3D | undefined; this.fx = new ImpactFx(this, this.r3d); this.haz = new HazardField(this);
    for (let i = 0; i < 110; i++) { this.skids.push(this.add.image(0, 0, 'skid').setTint(0x000000).setDepth(-0.5).setVisible(false)); this.skidAge.push(9); }
    for (const [kind, n] of [['sedan', 14], ['suv', 8], ['bus', 4]] as [Kind, number][]) for (let i = 0; i < n; i++) {
      const sp = SPEC[kind], color = kind === 'bus' ? 0xffb300 : TINTS[0], c = buildCar(this, { color, kind }).setDepth(8).setVisible(false);
      this.cars.push({ c, body: c.getData('body'), brake: c.getData('brake'), kind, l: sp.l, w: sp.w, mass: sp.mass, active: false, color, x: 0, y: 0, vx: 0, vy: 0, h: UP, spin: 0, base: 150, spd: 150, lane: 0, changeT: 5, hit: false, nm: false, smoke: 0 });
    }
    for (let i = 0; i < 12; i++) this.spawnCar(-400 - i * 290 - Math.random() * 120);
    this.rig = new CameraRig(cam, { zoomMul: .75, lookMul: 1.1 }); this.rig.snap(this.phys.x, 0, UP); this.updateChunks(0);
    this.r3d?.setup({ mode: 'endless', dist: this.dist0, weather: this.weather, seed: this.seed, player: { kind: this.veh.kind, color: this.baseColor, decal: look.decal, wheel: WHEEL_TINT[look.wheels], glass: .55 + look.tint * .15 }, traffic: this.cars.map(c => c.kind) });
    this.applyView(getSave().settings.view);
    this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x02140b, (1 - vis) * .95).setScrollFactor(0).setDepth(20);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,H,M,C,V,R,ENTER,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
    this.touch = this.registry.get('touch') as Touch; this.touchMode = !!this.registry.get('touchMode'); this.input.addPointer(3); if (this.touchMode) tilt.start();
    this.registry.set('mode', 'endless'); this.registry.set('weather', this.weather); this.scene.launch('HUD');
    this.audio = new GameAudio(this.weather, look.horn); music.start('endless');
    this.radio = new Radio(line => { this.game.events.emit('radio', line); if (!this.audio.isMuted()) speak(line); });
    const ev = this.game.events, toggle = () => { this.paused = !this.paused; this.audio.setPaused(this.paused); ev.emit('paused', this.paused); };
    const cycle = () => { const v = this.rig.next(); setSettings({ view: v }); this.applyView(v); ev.emit('toast', `VIEW: ${VIEW_LABEL[v].toUpperCase()}`); };
    const quit = () => { this.bank(); ev.emit('quit'); }, recal = () => tilt.calibrate(), revive = () => this.revive(), restart = () => { this.bank(); this.scene.stop('HUD'); this.scene.restart(this.cfg); }, menu = () => { this.bank(); ev.emit('quit'); };
    const on: [string, () => void][] = [['pause-toggle', toggle], ['cam-next', cycle], ['quit-req', quit], ['tilt-cal', recal], ['go-revive', revive], ['go-restart', restart], ['go-menu', menu]];
    on.forEach(([e, f]) => ev.on(e, f));
    const stop = () => { on.forEach(([e, f]) => ev.off(e, f)); this.r3d?.setActive(false); if (this.cameras?.main) this.cameras.main.visible = true; tilt.stop(); music.stop(); this.audio.destroy(); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
    this.events.once('shutdown', stop); this.events.once('destroy', stop);
    this.time.delayedCall(9000, () => { if (this.weather === 'rain' || this.weather === 'heavy_rain') this.radio.say('rain'); else if (this.weather === 'night') this.radio.say('night'); });
    this.time.delayedCall(350, () => ev.emit('info', { district: this.dist0.name, weather: WEATHER_FX[this.weather].label, car: this.veh.name, touchMode: this.touchMode }));
  }

  private applyView(v: View) { const on = v === 'behind' && !!this.r3d?.ok; this.rig.setView(v); this.r3d?.setActive(on); this.cameras.main.visible = !on; }
  private draw3d(dt: number, brake: boolean) {
    const r = this.r3d; if (!r || !r.active) return; const P = this.phys, cs = this.r3dCars, hs = this.r3dHaz; this.shake3 = Math.max(0, this.shake3 - dt * 2.4);
    while (cs.length < this.cars.length) cs.push({ x: 0, y: 0, h: 0, on: false, brake: false, color: 0, hit: false });
    this.cars.forEach((o, i) => { const c = cs[i]; c.x = o.x; c.y = o.y; c.h = o.h; c.on = o.active; c.brake = o.brake.alpha > .5; c.color = o.color; c.hit = o.hit; });
    const hl = this.haz.draw(); hs.length = hl.length; hl.forEach((h, i) => { const o = hs[i] ?? (hs[i] = { kind: 'cone', x: 0, y: 0, a: 1, s: 1, r: 0 }); o.kind = h.kind; o.x = h.x; o.y = h.y; o.a = h.alpha; o.s = h.scaleX; o.r = h.rotation; });
    r.frame({ dt, px: P.x, py: P.y, heading: P.heading, vx: P.vx, vy: P.vy, steer: P.delta, ax: P.ax, ay: P.ay, wheelRate: P.wheelRate, brake, ratio: P.speed / this.pp.maxSpeed, dmg: this.dmg, blink: this.inv > 0 && Math.floor(this.inv * 10) % 2 === 1, shake: this.shake3, cars: cs, haz: hs });
  }

  // ------------------------------------------------------------------ traffic
  private laneFree(lane: number, y: number, self?: ECar) { return !this.cars.some(o => o !== self && o.active && Math.abs(o.y - y) < 280 && Math.abs(o.x - laneX(lane)) < LANE_W * .8); }
  private spawnCar(y: number) {
    const free = this.cars.filter(c => !c.active); if (!free.length) return; const lanes = [0, 1, 2, 3].filter(l => this.laneFree(l, y)); if (!lanes.length) return;
    if (this.cars.filter(o => o.active && Math.abs(o.y - y) < 260).length >= LANES - 2) return;
    const roll = Math.random(), want: Kind = roll < .6 ? 'sedan' : roll < .88 ? 'suv' : 'bus', c = free.find(f => f.kind === want) ?? free[0], lane = Phaser.Utils.Array.GetRandom(lanes), m = this.dist;
    c.active = true; c.hit = false; c.nm = false; c.smoke = 0; c.lane = lane; c.x = laneX(lane); c.y = y; c.vx = 0; c.h = UP; c.spin = 0; c.changeT = 3 + Math.random() * 6;
    c.base = (c.kind === 'bus' ? 90 : 110) + Math.random() * (150 + Math.min(130, m / 50)); c.spd = c.base; c.vy = -c.spd; c.color = c.kind === 'bus' ? 0xffb300 : Math.random() < .25 ? 0xffb300 : Phaser.Utils.Array.GetRandom(TINTS);
    c.body.setTint(c.color); c.brake.setAlpha(0); c.c.setVisible(true).setPosition(c.x, c.y).setRotation(c.h).setAlpha(1);
  }
  private drive(c: ECar, dt: number) {
    if (c.hit) { const f = Math.pow(.5, dt); c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= f; c.vy *= f; c.h += c.spin * dt; c.spin *= Math.pow(.12, dt); if (c.smoke > 0) { c.smoke -= dt; this.fx.damage(dt, c.x, c.y, c.h, 1); } return; }
    let lead: ECar | undefined, gap = 1e9; for (const o of this.cars) if (o !== c && o.active && Math.abs(o.x - c.x) < LANE_W * .55 && o.y < c.y && c.y - o.y < gap) { gap = c.y - o.y; lead = o; }
    let want = c.base; if (lead && gap < 240) { want = Math.min(c.base, Math.max(0, -lead.vy) * Math.min(1, gap / 170)); if (c.spd < c.base * .75) c.changeT = Math.min(c.changeT, .25); }
    c.spd += (want - c.spd) * Math.min(1, dt * 2.4); c.vy = -c.spd;
    c.changeT -= dt; if (c.changeT <= 0) { c.changeT = 4 + Math.random() * 8; for (const dir of Math.random() < .5 ? [-1, 1] : [1, -1]) { const nl = c.lane + dir; if (nl >= 0 && nl < LANES && this.laneFree(nl, c.y, c)) { c.lane = nl; break; } } }
    c.vx = Phaser.Math.Clamp((laneX(c.lane) - c.x) * 2.4, -85, 85); c.x += c.vx * dt; c.y += c.vy * dt; c.h += Phaser.Math.Angle.Wrap(UP + Math.atan2(c.vx, Math.max(60, c.spd)) - c.h) * Math.min(1, dt * 6);
    c.brake.setAlpha(c.spd < c.base * .7 ? .9 : 0);
  }

  // ------------------------------------------------------------------ crash / game flow
  private crashFx(st: number, x: number, y: number, color: number, damage = true, line?: RadioKind) {
    this.scorer.crash(); this.nmStreak = 0; if (damage) { this.dmg = Math.min(1.2, this.dmg + st * .3); this.carBody.setTint(bodyShade(this.baseColor, 1 - .38 * Math.min(1, this.dmg))); }
    this.fx.hit(x, y, st, color); this.shake3 = Math.max(this.shake3, .35 + st); this.cameras.main.shake(110 + st * 240, .003 + st * .013); this.audio.crash(st); this.radio.say(line ?? (st > .6 ? 'bigcrash' : 'crash')); if (navigator.vibrate) navigator.vibrate(30 + st * 100); this.game.events.emit('crash', st);
  }
  private carCrash(c: ECar, st: number, x: number, y: number) {
    this.crashes++; this.totalCrashes++; c.smoke = 3; c.body.setTint(bodyShade(c.color, .6)); this.crashFx(st, x, y, c.color, true, this.crashes >= MAX_CRASHES ? 'gameover' : this.crashes === MAX_CRASHES - 1 ? 'lastlife' : undefined);
    if (this.crashes >= MAX_CRASHES) this.gameOver(); else if (this.crashes === MAX_CRASHES - 1) this.game.events.emit('toast', 'LAST LIFE - ONE MORE AND IT IS OVER', '#ff5a3c');
  }
  private gameOver() {
    if (this.over) return; this.over = true; this.audio.sting('over'); music.duck(.35); this.game.events.emit('gameover', { score: this.score, dist: this.dist, best: Math.max(getSave().stats.endless_best_m, this.dist), cost: reviveCost(this.revives), coins: getSave().coins, crashes: this.crashes, max: MAX_CRASHES });
  }
  private revive() {
    if (!this.over) return; const cost = reviveCost(this.revives);
    if (!spendCoins(cost)) { this.game.events.emit('toast', 'NOT ENOUGH COINS', '#ff5a3c'); return; }
    this.revives++; this.crashes = 0; this.over = false; this.inv = 3; this.dmg = 0; this.carBody.setTint(this.baseColor); music.duck(1); this.audio.sting('revive'); this.audio.coin(); this.radio.say('revive');
    const P = this.phys; P.vx = 0; P.vy = -280; P.spin = 0; P.heading = UP; P.x = Phaser.Math.Clamp(P.x, -ROAD_W / 2 + 30, ROAD_W / 2 - 30);
    for (const c of this.cars) if (c.active && Math.abs(c.y - P.y) < 700) { c.active = false; c.c.setVisible(false); } // clear the road around the player
    this.game.events.emit('revived', { cost, coins: getSave().coins });
  }
  private bank() {
    if (this.banked || this.score <= 0) return; this.banked = true;
    const r: RunResult = { districtId: this.dist0.id, vehicleId: this.veh.id, weather: this.weather, points: this.score, durationSec: Math.round(this.elapsed), maxCombo: this.maxStreak, drifts: this.scorer.drifts, topSpeed: Math.round(this.scorer.topSpeed * KMH), clean: false, cleanBonus: 0, laps: 0, mode: 'endless', distance: this.dist, crashes: this.totalCrashes, revives: this.revives, nearMisses: this.nmCount };
    this.game.events.emit('bank', r);
  }
  private near() { this.nmCount++; this.nmStreak = Math.min(10, this.nmStreak + 1); this.maxStreak = Math.max(this.maxStreak, this.nmStreak); this.nmT = 4; const pts = 100 * this.nmStreak; this.scorer.bonus(pts); this.audio.whoosh(); this.game.events.emit('nearmiss', pts); this.radio.say(this.nmStreak >= 4 ? 'streak' : 'nearmiss'); }
  private skid(x: number, y: number, rot: number) { const i = this.skidI++ % this.skids.length; this.skids[i].setPosition(x, y).setRotation(rot).setAlpha(.5).setVisible(true); this.skidAge[i] = 0; }

  update(_t: number, ms: number) {
    const dt = Math.min(ms / 1000, .04), k = this.keys, P = this.phys, view = this.rig;
    if (Phaser.Input.Keyboard.JustDown(k.ESC) || Phaser.Input.Keyboard.JustDown(k.P)) { if (!this.over) this.game.events.emit('pause-toggle'); else this.game.events.emit('go-menu'); }
    if (this.paused) return;
    if (Phaser.Input.Keyboard.JustDown(k.C) || Phaser.Input.Keyboard.JustDown(k.V)) this.game.events.emit('cam-next');
    if (this.over) { if (Phaser.Input.Keyboard.JustDown(k.ENTER)) this.game.events.emit('go-revive'); if (Phaser.Input.Keyboard.JustDown(k.R)) this.game.events.emit('go-restart'); }
    // world follows the camera
    const cx = Math.round(view.centerX), cy = Math.round(view.centerY), g = this.ground, rd = this.road;
    g.setPosition(cx, cy); g.tilePositionX = cx - g.width / 2; g.tilePositionY = cy - g.height / 2; rd.setPosition(0, cy); rd.tilePositionY = cy - rd.height / 2;
    if ((this.chunkT -= dt) <= 0) { this.chunkT = .25; this.updateChunks(P.y); }
    if (this.countdown > 0) {
      this.countdown -= dt; const c = Math.ceil(this.countdown - .2); if (c !== this.lastCount) { this.lastCount = c; this.game.events.emit('countdown', c); this.audio.countdown(c); if (c <= 0) { tilt.calibrate(); this.radio.say('start'); } }
      for (const c2 of this.cars) if (c2.active) c2.c.setPosition(c2.x, c2.y); view.update(dt, P.x, P.y, P.heading, 0, 0, 0); this.audio.update(0, 0); this.draw3d(dt, false); return;
    }
    this.elapsed += dt;
    const t = this.touch, set = getSave().settings, left = k.A.isDown || k.LEFT.isDown || t.left, right = k.D.isDown || k.RIGHT.isDown || t.right, drive = !this.over;
    const brake = !drive || k.S.isDown || k.DOWN.isDown || t.brake, throttle = drive && (k.W.isDown || k.UP.isDown || (this.touchMode && !brake)) ? 1 : 0, hand = drive && (k.SPACE.isDown || k.SHIFT.isDown || t.hand);
    let steer = drive ? (right ? 1 : 0) - (left ? 1 : 0) : 0; if (drive && this.touchMode && set.controls === 'tilt') steer = Phaser.Math.Clamp(steer + tilt.value, -1, 1);
    if (!this.tiltChecked && this.countdown < -1.5) { this.tiltChecked = true; if (this.touchMode && set.controls === 'tilt' && !tilt.got) this.game.events.emit('toast', 'NO TILT SENSOR - SWITCH TO ARROWS IN PAUSE MENU'); }
    if (Phaser.Input.Keyboard.JustDown(k.H)) this.audio.horn(); if (Phaser.Input.Keyboard.JustDown(k.M)) this.audio.toggleMute();

    // keep the car pointing down the road: self-centring when not steering, hard limit at ~57 degrees
    const ratio = P.speed / this.pp.maxSpeed; let dh = Phaser.Math.Angle.Wrap(P.heading - UP);
    if (!hand && steer === 0) P.heading -= dh * Math.min(1, dt * (1.1 + ratio * .9));
    dh = Phaser.Math.Angle.Wrap(P.heading - UP); if (Math.abs(dh) > 1) { P.heading = UP + Math.sign(dh); P.w *= .2; }
    const off = Math.abs(P.x) > ROAD_W / 2 + KERB; P.step(dt, { throttle, brake, steer, hand }, off, WEATHER_FX[this.weather].grip);
    const lim = WALL - 16; // guard-rail
    if (Math.abs(P.x) > lim) { const sd = Math.sign(P.x), vn = P.vx * sd; P.x = sd * lim; if (vn > 0) { P.vx = -vn * .3 * sd; P.vy *= .93; P.spin += -sd * Math.min(1.2, vn / 260); if (vn > 90) { this.fx.scrape(P.x + sd * 12, P.y); this.shake3 = Math.max(this.shake3, .25); this.cameras.main.shake(90, .004); if ((this.scrapeT -= dt) <= 0) { this.audio.scrape(Math.min(1, vn / 300)); this.scrapeT = .2; } } } }
    const speed = P.speed, c = Math.cos(P.heading), s = Math.sin(P.heading);
    if (P.vy < 0) this.distPx += -P.vy * dt; const km = Math.floor(this.dist / 1000);
    if (km > this.lastKm) { this.lastKm = km; this.scorer.bonus(500); this.audio.sting('milestone'); this.radio.say('km'); this.game.events.emit('toast', `${km} KM  +500`, '#2fd06a'); }
    if (this.inv > 0) { this.inv -= dt; this.car.setAlpha(Math.floor(this.inv * 10) % 2 ? .35 : 1); if (this.inv <= 0) this.car.setAlpha(1); }
    this.car.setPosition(P.x, P.y).setRotation(P.heading); if (this.beam) this.beam.setPosition(P.x + c * 30, P.y + s * 30).setRotation(P.heading); this.carBrake.setAlpha(brake ? .95 : 0);
    if (off && speed > 200) { this.cameras.main.shake(60, .0016); this.shake3 = Math.max(this.shake3, .12); if ((this.offT += dt) > 1.6) { this.offT = -8; this.radio.say('offroad'); } }
    if (ratio > .94) { if ((this.fastT += dt) > 3.5) { this.fastT = -25; this.radio.say('fast'); } }
    this.fx.damage(dt, P.x, P.y, P.heading, this.dmg > .3 ? Math.min(1, this.dmg) : 0);
    if (Math.abs(P.vl) > 75) { const rx = P.x - c * 24, ry = P.y - s * 24; this.smoke.emitParticleAt(rx, ry, 1); this.r3d?.tyreSmoke(rx, ry, P.vx, P.vy); if (!off && this.frame % 2 === 0) { this.skid(rx - s * 12, ry + c * 12, Math.atan2(P.vy, P.vx)); this.skid(rx + s * 12, ry - c * 12, Math.atan2(P.vy, P.vx)); } }
    if ((this.frame++ & 3) === 0) for (let i = 0; i < this.skids.length; i++) if (this.skidAge[i] < 6) { this.skidAge[i] += dt * 4; const a = .5 * (1 - this.skidAge[i] / 6); if (a <= 0) this.skids[i].setVisible(false); else this.skids[i].setAlpha(a); }
    if (drive) { const res = this.scorer.update(dt, off ? 0 : speed, P.slipDeg); if (res) this.game.events.emit('drift', res); }
    if (this.nmStreak > 0 && (this.nmT -= dt) <= 0) this.nmStreak = 0;

    // traffic
    const pBox = { x: P.x, y: P.y, h: P.heading, l: this.pl - 3, w: this.pw - 3 }, want = Math.min(24, 12 + Math.floor(this.dist / 400));
    let live = 0; for (const o of this.cars) if (o.active) live++;
    for (const o of this.cars) {
      if (!o.active) continue; this.drive(o, dt); o.c.setPosition(o.x, o.y).setRotation(o.h);
      if (o.y > P.y + 750 || o.y < P.y - 4300) { o.active = false; o.c.setVisible(false); live--; continue; }
      const dx = Math.abs(o.x - P.x), dy = Math.abs(o.y - P.y);
      if (dy < 120 && dx < 120) {
        const hit = boxHit(pBox, { x: o.x, y: o.y, h: o.h, l: o.l - 4, w: o.w - 3 });
        if (hit) {
          const body = { x: o.x, y: o.y, vx: o.vx, vy: o.vy, mass: o.mass, spin: o.spin }, rel = Math.hypot(P.vx - o.vx, P.vy - o.vy), imp = resolveHit(P, this.mass, body, hit, .35);
          o.x = body.x; o.y = body.y; o.vx = body.vx; o.vy = body.vy; o.spin = body.spin;
          if (!o.hit) { o.hit = true; o.spd = 0; const st = Math.max(.15, Math.min(1, Math.max(imp, rel * .4) / 420)); if (!this.over && this.inv <= 0) this.carCrash(o, st, hit.px, hit.py); else { this.fx.hit(hit.px, hit.py, st * .6, o.color); this.audio.crash(st * .5); } }
        } else if (!o.hit && !o.nm && speed > 200 && P.vy < -100 && dy < (o.l + this.pl) / 2 + 10 && dx - (o.w + this.pw) / 2 < 56) { o.nm = true; if (!this.over) this.near(); }
      } else if (dy > 200) o.nm = false;
    }
    if (live < want && Math.random() < dt * 3) this.spawnCar(P.y - 2300 - Math.random() * 1200);
    this.nextHaz -= dt; if (this.nextHaz <= 0) { this.nextHaz = 3 + Math.random() * 3; const kind = Phaser.Utils.Array.GetRandom(['pothole', 'cone', 'flood'] as const), x = Phaser.Math.Between(-ROAD_W / 2 + 40, ROAD_W / 2 - 40), y = P.y - 2300 - Math.random() * 1000;
      if (kind === 'cone') for (let i = 0; i < 3; i++) this.haz.add(kind, x + (i - 1) * 24, y - i * 20); else this.haz.add(kind, x, y); }
    if (!this.over) this.haz.update(P.x, P.y, speed, { onFlood: () => { P.bump(.985); this.radio.say('flood'); }, onNear: () => this.near(), onHit: (kind, h) => { P.bump(kind === 'cone' ? .78 : .62); this.crashFx(kind === 'cone' ? .3 : .25, h.x, h.y, kind === 'cone' ? 0xff8c1a : 0x4a3a2a, false, kind === 'cone' ? 'cone' : 'pothole'); } }, 4600);

    this.audio.update(ratio, Math.min(1, Math.abs(P.vl) / 170), throttle, P.rpm, P.gear); this.radio.tick(dt); this.draw3d(dt, brake);
    this.musT -= dt; if (this.musT <= 0) { this.musT = .4; music.setIntensity(.3 + Math.min(1, ratio) * .7); }
    view.update(dt, P.x, P.y, P.heading, P.vx, P.vy, ratio);
    this.hudT += dt; if (this.hudT > .05) { this.hudT = 0; this.game.events.emit('stats', { score: this.score, combo: Math.max(1, this.nmStreak), speed: Math.round(speed * KMH), dist: this.dist, crashes: this.crashes, max: MAX_CRASHES, best: Math.max(getSave().stats.endless_best_m, this.dist), live: this.scorer.live, off }); }
  }
}
