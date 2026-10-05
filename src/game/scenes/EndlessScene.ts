import Phaser from 'phaser';
import { DISTRICTS, WEATHER_FX, Weather, District, Decor, BUILDINGS, DECOR_EXT, endlessRoad, EndlessRoad } from '../data/districts';
import { VEHICLES, VehicleStats, toPhysics, KMH, Phys } from '../data/vehicles';
import { SMOKES } from '../data/progression';
import { VIEW_LABEL, MAX_CRASHES, reviveCost, View, isRace } from '../data/settings';
import { RaceKind, routeById, RACE_FIELD, PRIZE, BOT_NAMES, elimEvery, demoKoTarget, ROUTES } from '../data/races';
import { HP_MAX, BotP, makeBots, botDistOut, botTimeTo, rankAll, lastPlace, hitDamage, powerFactor, mulberry, type Standing } from '../systems/Race';
import type { MpSession, MpMsg } from '../systems/Net';
import type { Renderer3D, R3DCar, R3DHaz } from '../render3d/Renderer3D';
import type { RunConfig, RunResult, RaceResult } from '../types';
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
import { tilt, SteerShaper } from '../systems/Controls';
import { CoinField, COIN_VALUE, COIN_RADIUS } from '../systems/Pickups';
import { PPM, BODY, type Body } from '../data/vehicles';
import { getSave, setSettings, spendCoins, addCoins, grantLive } from '../../state/store';

/** Endless Drive: one dead-straight, never-ending road. Hit 5 cars and it is game over (revive with coins, restart, or menu). Road runs towards -y. */
const KERB = 18, SHOULDER = 150, CHUNK = 1200, KM = 12000, M_PER_PX = 1 / 12, COUNTDOWN = 3.2, UP = -Math.PI / 2;
/** Road geometry depends on the chosen road type (2-4 lanes), so these are set once per run. */
let LANES = 4, ROAD_W = 440, LANE_W = 110, TW = 0, WALL = 0;
function setGeo(l: number) { LANES = l; LANE_W = 110; ROAD_W = l * LANE_W; TW = ROAD_W + 2 * (KERB + SHOULDER); WALL = TW / 2 - 12; }
setGeo(4);
const TINTS = [0x8a8f94, 0x2f4a66, 0xa8281f, 0xe6e6e6, 0x2c6b3e, 0x1d2024, 0x7a5230], laneX = (i: number) => -ROAD_W / 2 + (i + .5) * LANE_W, hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
type Kind = Body;
interface ECar { c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; brake: Phaser.GameObjects.Image; kind: Kind; l: number; w: number; mass: number; active: boolean; color: number;
  x: number; y: number; vx: number; vy: number; h: number; spin: number; base: number; spd: number; lane: number; changeT: number; hit: boolean; nm: boolean; smoke: number }
/** A rival on the road: a deterministic bot (journey/elimination), a chasing bot (demolition) or the friend in a live race. */
interface Racer { id: string; name: string; human: boolean; dyn: boolean; bot?: BotP; c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; kind: Body; color: number; l: number; w: number; mass: number;
  x: number; y: number; h: number; vx: number; vy: number; spin: number; tx: number; ty: number; th: number; lastMsg: number; startY: number; prog: number; hp: number; out: boolean; outT?: number; finT?: number; kos: number; cd: number; has: boolean; delay: number; lastHit: number; wrecked: boolean }
type Touch = { left: boolean; right: boolean; brake: boolean; hand: boolean };
const MASSK: Record<Body, number> = { keke: .6, coupe: .95, sedan: 1, suv: 1.35, pickup: 1.4, minibus: 1.95, bus: 2.6 };
const SPEC = Object.fromEntries((Object.keys(BODY) as Body[]).map(k => [k, { l: BODY[k].pl, w: BODY[k].pw, mass: MASSK[k] }])) as Record<Body, { l: number; w: number; mass: number }>;
const POOL: [Body, number][] = [['sedan', 10], ['suv', 6], ['pickup', 3], ['minibus', 4], ['keke', 4], ['coupe', 3], ['bus', 3]], ROLL: [Body, number][] = [['sedan', .34], ['suv', .5], ['pickup', .6], ['minibus', .74], ['keke', .86], ['coupe', .92], ['bus', 1]], SLOW: Partial<Record<Body, number>> = { bus: 90, minibus: 95, keke: 80, pickup: 105 };

export class EndlessScene extends Phaser.Scene {
  constructor() { super('Endless'); }
  private cfg!: RunConfig; private dist0!: District; private rd!: EndlessRoad; private coinsF!: CoinField; private pickups = 0; private coinT = 1; private achT = 0; private shaper = new SteerShaper(); private veh!: VehicleStats; private pp!: Phys; private phys!: CarPhysics; private scorer = new DriftScorer(); private weather: Weather = 'sunny';
  private car!: Phaser.GameObjects.Container; private carBody!: Phaser.GameObjects.Image; private carBrake!: Phaser.GameObjects.Image; private beam?: Phaser.GameObjects.Image; private ground!: Phaser.GameObjects.TileSprite; private road!: Phaser.GameObjects.TileSprite;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter; private rig!: CameraRig; private fx!: ImpactFx; private haz!: HazardField; private audio!: GameAudio; private radio!: Radio;
  private cars: ECar[] = []; private chunks = new Map<number, Phaser.GameObjects.GameObject[]>(); private skids: Phaser.GameObjects.Image[] = []; private skidAge: number[] = []; private skidI = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>; private touch!: Touch; private touchMode = false; private baseColor = 0xffffff; private mass = 1; private pl = 62; private pw = 27;
  private countdown = COUNTDOWN; private lastCount = 4; private paused = false; private over = false; private banked = false; private tiltChecked = false;
  private rk: RaceKind | null = null; private racers: Racer[] = []; private hp = HP_MAX; private kos = 0; private rams = 0; private wrecked = false; private raceDone = false; private routeM = 0; private myId = 'h'; private myLane = 1; private elimNext = 0; private elimCount = 0; private myPlace = 0; private adRevives = 0; private hudRaceT = 0;
  private mp: MpSession | null = null; private mpWait = false; private mpWaited = 0; private mpSendT = 0; private meReady = false; private oppReady = false; private mpOffs: (() => void)[] = []; private oppName = ''; private oppFin: { t: number; sc: number } | null = null; private myFin: number | undefined; private raceMs = 0;
  private crashes = 0; private totalCrashes = 0; private revives = 0; private inv = 0; private dmg = 0; private distPx = 0; private lastKm = 0; private elapsed = 0; private nmCount = 0; private nmStreak = 0; private nmT = 0; private maxStreak = 1;
  private offT = 0; private fastT = 0; private r3d?: Renderer3D; private r3dCars: R3DCar[] = []; private r3dHaz: R3DHaz[] = []; private shake3 = 0; private nextHaz = 3; private frame = 0; private hudT = 0; private musT = 0; private scrapeT = 0; private chunkT = 0; private decorPick!: () => Decor; private seed = 1;

  init(cfg: RunConfig) {
    this.offT = 0; this.fastT = 0; this.shake3 = 0;
    this.rd = endlessRoad(cfg.road); setGeo(this.rd.lanes); this.pickups = 0; this.coinT = 1; this.achT = 0; this.shaper = new SteerShaper();
    this.cfg = cfg; this.dist0 = DISTRICTS.find(x => x.id === cfg.districtId) ?? DISTRICTS[0]; this.veh = VEHICLES.find(x => x.id === cfg.vehicleId) ?? VEHICLES[0]; this.pp = toPhysics(this.veh, cfg.car.upgrades);
    this.weather = cfg.weather ?? Phaser.Utils.Array.GetRandom(this.dist0.weather); this.scorer = new DriftScorer();
    this.cars = []; this.chunks = new Map(); this.skids = []; this.skidAge = []; this.skidI = 0; this.countdown = COUNTDOWN; this.lastCount = 4; this.paused = false; this.over = false; this.banked = false; this.tiltChecked = false;
    this.crashes = 0; this.totalCrashes = 0; this.revives = 0; this.inv = 0; this.dmg = 0; this.distPx = 0; this.lastKm = 0; this.elapsed = 0; this.nmCount = 0; this.nmStreak = 0; this.nmT = 0; this.maxStreak = 1; this.nextHaz = 3; this.frame = 0; this.seed = (Date.now() & 0xffff) + 1;
    this.pl = BODY[this.veh.kind].pl; this.pw = BODY[this.veh.kind].pw; this.mass = 1 + (this.veh.weight - 5) * .08;
    this.rk = cfg.race?.kind ?? null; this.racers = []; this.hp = HP_MAX; this.kos = 0; this.rams = 0; this.wrecked = false; this.raceDone = false; this.elimCount = 0; this.myPlace = 0; this.adRevives = 0; this.hudRaceT = 0;
    this.mp = this.rk ? cfg.mp ?? null : null; this.mpWait = !!this.mp; this.mpWaited = 0; this.mpSendT = 0; this.meReady = false; this.oppReady = false; this.mpOffs = []; this.oppName = this.mp?.opponent?.name ?? ''; this.oppFin = null; this.myFin = undefined;
    this.routeM = this.rk === 'journey' ? routeById(cfg.race!.route).meters : 0; this.elimNext = 25; if (cfg.race) this.seed = (cfg.race.seed & 0xffff) + 1;
  }

  private get dist() { return Math.floor(this.distPx * M_PER_PX); }
  private get score() { return this.dist + this.scorer.total; }

  /** Seamless tile: dirt shoulder, guard-rails, striped kerbs, asphalt with wear, edge lines and lane dashes. */
  private roadTexture(key: string) {
    if (this.textures.exists(key)) return; const pal = this.dist0.palette, t = this.textures.createCanvas(key, TW, 256)!, c = t.getContext(), r = rng(99);
    c.fillStyle = hex(pal.shoulder); c.fillRect(0, 0, TW, 256); for (let i = 0; i < 700; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)'; c.fillRect(r() * TW, r() * 256, 2 + r() * 3, 2 + r() * 3); }
    const a0 = SHOULDER + KERB, a1 = a0 + ROAD_W;
    for (let y = 0; y < 256; y += 32) for (const x of [SHOULDER, a1]) { c.fillStyle = (y / 32) % 2 ? '#ffffff' : '#e0233a'; c.fillRect(x, y, KERB, 32); }
    c.fillStyle = hex(pal.road); c.fillRect(a0, 0, ROAD_W, 256); for (let i = 0; i < 1400; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.05)'; c.fillRect(a0 + r() * ROAD_W, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    c.fillStyle = 'rgba(0,0,0,.1)'; for (let l = 0; l < LANES; l++) for (const o of [-22, 22]) c.fillRect(a0 + (l + .5) * LANE_W + o - 7, 0, 14, 256); // tyre wear
    c.fillStyle = 'rgba(255,255,255,.88)'; c.fillRect(a0 + 12, 0, 5, 256); c.fillRect(a1 - 17, 0, 5, 256);
    for (let l = 1; l < LANES; l++) for (const y of [0, 128]) c.fillRect(a0 + l * LANE_W - 3, y, 6, 64);
    for (const x of [0, TW - 12]) { const g = c.createLinearGradient(x, 0, x + 12, 0); g.addColorStop(0, '#6b7276'); g.addColorStop(.5, '#d7dde0'); g.addColorStop(1, '#6b7276'); c.fillStyle = g; c.fillRect(x, 0, 12, 256); c.fillStyle = '#2c3033'; for (let y = 0; y < 256; y += 64) c.fillRect(x + (x ? -4 : 12), y, 4, 8); }
    t.refresh();
  }
  private bld: [Decor, number][] = []; private nat: [Decor, number][] = [];
  private pickW(rr: () => number, list: [Decor, number][]): Decor { const tot = list.reduce((a, [, w]) => a + w, 0); let x = rr() * tot; for (const [k, w] of list) if ((x -= w) < 0) return k; return list[0][0]; }
  private makeChunk(k: number) {
    const out: Phaser.GameObjects.GameObject[] = [], g = this.add.graphics().setDepth(3), r = rng(k * 7919 + this.seed), top = -(k + 1) * CHUNK; out.push(g);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) prop(g, 'lamp', side * (WALL + 16), top + i * (CHUNK / 5) + 40, r);
      if (this.bld.length) for (let i = 0; i < 3; i++) { const kind = this.pickW(r, this.bld), x = side * (WALL + 90 + DECOR_EXT[kind] + r() * 150); prop(g, kind, x, top + (i + .5) * (CHUNK / 3) + (r() - .5) * 70, r); }
      if (this.nat.length) for (let i = 0; i < 7; i++) { const kind = this.pickW(r, this.nat), near = r() < .45, x = side * (near ? WALL + 48 + r() * 40 : WALL + 250 + r() * 300); prop(g, kind, x, top + r() * CHUNK, r); }
    }
    if (k > 0 && k % (KM / CHUNK) === 0) { // kilometre marker painted across the road
      const y = -k * CHUNK, band = this.add.graphics().setDepth(-2); band.fillStyle(0xffffff, .55).fillRect(-ROAD_W / 2, y - 7, ROAD_W, 14); band.fillStyle(0xff8c1a, .8).fillRect(-ROAD_W / 2, y - 7, ROAD_W, 4);
      out.push(band, this.add.text(0, y - 70, `${k / (KM / CHUNK)} KM`, { fontFamily: 'Orbitron, sans-serif', fontSize: '84px', color: '#ffffff' }).setOrigin(.5).setAlpha(.5).setDepth(-1.5));
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
    const rkey = `e-road-${this.dist0.id}-${LANES}`; this.roadTexture(rkey); this.road = this.add.tileSprite(0, 0, TW, GS, rkey).setDepth(-3);
    const wts = Object.entries(this.dist0.decor) as [Decor, number][], total = wts.reduce((a, [, w]) => a + w, 0), pr = rng(this.seed * 13);
    this.bld = wts.filter(([k]) => BUILDINGS.includes(k)); this.nat = wts.filter(([k]) => !BUILDINGS.includes(k) && k !== 'lamp');
    this.decorPick = () => { let x = pr() * total; for (const [k, w] of wts) if ((x -= w) < 0) return k; return wts[0][0]; };

    this.phys = new CarPhysics({ ...this.pp, steerLock: this.pp.steerLock * .92 }); this.phys.x = laneX(this.myLaneFor()); this.phys.y = 0; this.phys.heading = UP;
    this.baseColor = look.paint ? parseInt(look.paint.slice(1), 16) : this.veh.color;
    this.car = buildCar(this, { color: this.baseColor, decal: look.decal !== 'none' ? look.decal : this.veh.livery ?? 'none', glass: .55 + look.tint * .15, wheel: WHEEL_TINT[look.wheels], kind: this.veh.kind, x: this.phys.x, y: 0 }).setDepth(30).setRotation(UP);
    this.carBody = this.car.getData('body'); this.carBrake = this.car.getData('brake');
    const vis = WEATHER_FX[this.weather].visibility; if (vis < .85) this.beam = this.add.image(0, 0, 'beam').setOrigin(0, .5).setBlendMode(Phaser.BlendModes.ADD).setDepth(26).setRotation(UP);
    this.smoke = this.add.particles(0, 0, 'smokep', { lifespan: 650, scale: { start: .6, end: 2.2 }, alpha: { start: .55, end: 0 }, speed: 18, emitting: false, tint: parseInt(SMOKES[look.smoke]?.slice(1) ?? 'ffffff', 16) }).setDepth(29);
    this.r3d = this.registry.get('r3d') as Renderer3D | undefined; this.fx = new ImpactFx(this, this.r3d); this.haz = new HazardField(this);
    for (let i = 0; i < 110; i++) { this.skids.push(this.add.image(0, 0, 'skid').setTint(0x000000).setDepth(-0.5).setVisible(false)); this.skidAge.push(9); }
    for (const [kind, n] of POOL) for (let i = 0; i < n; i++) {
      const sp = SPEC[kind], color = kind === 'bus' ? 0x1c5fd0 : kind === 'minibus' ? 0xf5b800 : kind === 'keke' ? 0xffc41f : TINTS[0], c = buildCar(this, { color, kind, decal: kind === 'minibus' ? 'danfo' : undefined }).setDepth(8).setVisible(false);
      this.cars.push({ c, body: c.getData('body'), brake: c.getData('brake'), kind, l: sp.l, w: sp.w, mass: sp.mass, active: false, color, x: 0, y: 0, vx: 0, vy: 0, h: UP, spin: 0, base: 150, spd: 150, lane: 0, changeT: 5, hit: false, nm: false, smoke: 0 });
    }
    if (this.rk) this.buildRacers();
    for (let i = 0; i < 12; i++) this.spawnCar(-400 - i * 290 - Math.random() * 120);
    this.touchMode = !!this.registry.get('touchMode'); this.coinsF = new CoinField(this, 70); this.rig = new CameraRig(cam, { zoomMul: .75, lookMul: 1.1, headingUp: this.touchMode }); this.rig.snap(this.phys.x, 0, UP); this.updateChunks(0);
    this.r3d?.setup({ lanes: LANES, mode: 'endless', dist: this.dist0, weather: this.weather, seed: this.seed, player: { kind: this.veh.kind, color: this.baseColor, decal: look.decal !== 'none' ? look.decal : this.veh.livery ?? 'none', wheel: WHEEL_TINT[look.wheels], glass: .55 + look.tint * .15 }, traffic: [...this.cars.map(c => c.kind), ...this.racers.map(r => r.kind)] });
    if (this.routeM) { const rt = routeById(this.cfg.race!.route); this.finishLine(-this.routeM * 12, `WELCOME TO ${rt.to.toUpperCase()} LGA`); this.r3d?.setFinish(-this.routeM * 12, `WELCOME TO ${rt.to.toUpperCase()} LGA`); }
    this.applyView(getSave().settings.view);
    this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x02140b, (1 - vis) * .95).setScrollFactor(0).setDepth(20);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,H,M,C,V,R,ENTER,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
    this.touch = this.registry.get('touch') as Touch; this.touchMode = !!this.registry.get('touchMode'); this.input.addPointer(3); if (this.touchMode) tilt.start();
    this.registry.set('mode', this.cfg.mode && isRace(this.cfg.mode) ? this.cfg.mode : 'endless'); this.registry.set('weather', this.weather); this.scene.launch('HUD');
    this.audio = new GameAudio(this.weather, look.horn); music.start('endless');
    this.radio = new Radio(line => { const st = getSave().settings; if (st.radioText) this.game.events.emit('radio', line); if (st.radio > 0) speak(line, st.radio); });
    const ev = this.game.events, toggle = () => { this.paused = !this.paused; this.audio.setPaused(this.paused); ev.emit('paused', this.paused); };
    const cycle = () => { const v = this.rig.next(); setSettings({ view: v }); this.applyView(v); ev.emit('toast', `VIEW: ${VIEW_LABEL[v].toUpperCase()}`); };
    const quit = () => { this.bank(); this.mpLeave(); ev.emit('quit'); }, recal = () => tilt.calibrate(), revive = () => this.revive(false), reviveAd = () => this.revive(true), results = () => this.finishRace('quit'), restart = () => { this.bank(); ev.emit('restart-req'); }, menu = () => { this.bank(); this.mpLeave(); ev.emit('quit'); };
    const on: [string, () => void][] = [['pause-toggle', toggle], ['cam-next', cycle], ['quit-req', quit], ['tilt-cal', recal], ['go-revive', revive], ['go-revive-ad', reviveAd], ['go-results', results], ['go-restart', restart], ['go-menu', menu]];
    on.forEach(([e, f]) => ev.on(e, f));
    const stop = () => { this.mpOffs.forEach(f => f()); this.mpOffs = []; on.forEach(([e, f]) => ev.off(e, f)); this.r3d?.setActive(false); if (this.cameras?.main) this.cameras.main.visible = true; tilt.stop(); music.stop(); this.audio.destroy(); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
    this.events.once('shutdown', stop); this.events.once('destroy', stop);
    this.setupMp();
    this.time.delayedCall(9000, () => { if (this.weather === 'rain' || this.weather === 'heavy_rain') this.radio.say('rain'); else if (this.weather === 'night') this.radio.say('night'); });
    this.time.delayedCall(350, () => ev.emit('info', { district: this.dist0.name, weather: WEATHER_FX[this.weather].label, car: this.veh.name, touchMode: this.touchMode }));
  }

  /** Damage takes power away; in a duel the leader is held back so the two cars stay close enough to trade paint. */
  private throttleMul() {
    if (!this.rk) return 1; let m = powerFactor(this.hp);
    if (this.rk === 'demo' && this.mp) { const f = this.racers.find(r => r.human && r.has && !r.out); if (f) { const ahead = f.y - this.phys.y; if (ahead > 90) m *= Math.max(.5, 1 - (ahead - 90) / 500); } }
    return m;
  }
  private applyView(v: View) { const on = v === 'behind' && !!this.r3d?.ok; this.rig.setView(v); this.r3d?.setActive(on); this.cameras.main.visible = !on; }
  private draw3d(dt: number, brake: boolean) {
    const r = this.r3d; if (!r || !r.active) return; const P = this.phys, cs = this.r3dCars, hs = this.r3dHaz; this.shake3 = Math.max(0, this.shake3 - dt * 2.4);
    while (cs.length < this.cars.length + this.racers.length) cs.push({ x: 0, y: 0, h: 0, on: false, brake: false, color: 0, hit: false });
    this.cars.forEach((o, i) => { const c = cs[i]; c.x = o.x; c.y = o.y; c.h = o.h; c.on = o.active; c.brake = o.brake.alpha > .5; c.color = o.color; c.hit = o.hit; });
    this.racers.forEach((q, i) => { const c = cs[this.cars.length + i]; c.x = q.x; c.y = q.y; c.h = q.h; c.on = q.has && !(q.out && !q.human && this.elapsed - (q.outT ?? 0) > 5); c.brake = false; c.color = q.color; c.hit = q.out || q.wrecked || q.hp < 35; });
    const hl = this.haz.draw(); hs.length = hl.length; hl.forEach((h, i) => { const o = hs[i] ?? (hs[i] = { kind: 'cone', x: 0, y: 0, a: 1, s: 1, r: 0 }); o.kind = h.kind; o.x = h.x; o.y = h.y; o.a = h.alpha; o.s = h.scaleX; o.r = h.rotation; });
    r.frame({ dt, px: P.x, py: P.y, heading: P.heading, vx: P.vx, vy: P.vy, steer: P.delta, ax: P.ax, ay: P.ay, wheelRate: P.wheelRate, brake, ratio: P.speed / this.pp.maxSpeed, dmg: this.dmg, blink: this.inv > 0 && Math.floor(this.inv * 10) % 2 === 1, shake: this.shake3, cars: cs, haz: hs, coins: this.coinsF.points(P.x, P.y) });
  }

  // ------------------------------------------------------------------ traffic
  private laneFree(lane: number, y: number, self?: ECar) { return !this.cars.some(o => o !== self && o.active && Math.abs(o.y - y) < 280 && Math.abs(o.x - laneX(lane)) < LANE_W * .8); }
  private spawnCar(y: number) {
    const free = this.cars.filter(c => !c.active); if (!free.length) return; const lanes = [0, 1, 2, 3].filter(l => this.laneFree(l, y)); if (!lanes.length) return;
    if (this.cars.filter(o => o.active && Math.abs(o.y - y) < 260).length >= Math.max(1, LANES - 2)) return;
    const roll = Math.random(), want: Kind = (ROLL.find(r => roll < r[1]) ?? ROLL[0])[0], c = free.find(f => f.kind === want) ?? free[0], lane = Phaser.Utils.Array.GetRandom(lanes), m = this.dist;
    c.active = true; c.hit = false; c.nm = false; c.smoke = 0; c.lane = lane; c.x = laneX(lane); c.y = y; c.vx = 0; c.h = UP; c.spin = 0; c.changeT = 3 + Math.random() * 6;
    c.base = ((SLOW[c.kind] ?? 110) + Math.random() * (150 + Math.min(130, m / 50))) * this.rd.speed; c.spd = c.base; c.vy = -c.spd; c.color = c.kind === 'bus' ? Phaser.Utils.Array.GetRandom([0x1c5fd0, 0xd23a2c, 0x2a7a3b]) : c.kind === 'minibus' ? 0xf5b800 : c.kind === 'keke' ? 0xffc41f : Math.random() < .2 ? 0xffb300 : Phaser.Utils.Array.GetRandom(TINTS);
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

  // ------------------------------------------------------------------ race modes (LGA Journey, Elimination, Demolition)
  private myLaneFor() { const r = this.cfg.race; if (!r) return Math.min(1, LANES - 1); const hostLane = LANES >= 3 ? 1 : 0, guestLane = Math.min(LANES - 1, hostLane + 1); return r.role === 'guest' ? guestLane : r.role === 'host' ? hostLane : Math.min(1, LANES - 1); }
  private mkRacer(id: string, name: string, kind: Body, color: number, human: boolean, x: number, startY: number, look?: { decal?: string; glass?: number; wheel?: number }): Racer {
    const sp = SPEC[kind], c = buildCar(this, { color, kind, decal: look?.decal, glass: look?.glass, wheel: look?.wheel }).setDepth(human ? 29 : 9).setPosition(x, startY).setRotation(UP);
    return { id, name, human, dyn: false, c, body: c.getData('body'), kind, color, l: sp.l, w: sp.w, mass: sp.mass, x, y: startY, h: UP, vx: 0, vy: 0, spin: 0, tx: x, ty: startY, th: UP, lastMsg: 0, startY, prog: -startY, hp: HP_MAX, out: false, kos: 0, cd: 0, has: true, delay: 0, lastHit: -99, wrecked: false };
  }
  private buildRacers() {
    const rc = this.cfg.race!, mpOn = !!this.mp, n = RACE_FIELD[rc.kind], hostLane = LANES >= 3 ? 1 : 0, guestLane = Math.min(LANES - 1, hostLane + 1);
    this.myId = rc.role === 'guest' ? 'g' : 'h'; this.myLane = this.myLaneFor(); const theirLane = rc.role === 'guest' ? hostLane : guestLane, used = new Set<number>([this.myLane]); if (mpOn) used.add(theirLane);
    const slots: { lane: number; row: number }[] = []; for (let row = 0; slots.length < 8; row++) for (let l = 0; l < LANES; l++) { if (row === 0 && used.has(l)) continue; slots.push({ lane: l, row }); }
    if (mpOn && this.mp!.opponent) { const o = this.mp!.opponent, f = this.mkRacer(rc.role === 'guest' ? 'h' : 'g', o.name, o.kind, o.color, true, laneX(theirLane), 0, { decal: o.decal, glass: o.glass, wheel: o.wheel }); f.c.setAlpha(1); this.racers.push(f); }
    const nb = mpOn ? (rc.kind === 'demo' ? 0 : n - 2) : n - 1, ref = mpOn ? 650 : this.pp.maxSpeed, route = this.rk === 'journey' ? routeById(rc.route) : null, hi = Math.min(.9, .78 + .012 * (route ? route.minRank * 2 : this.dist0.difficulty));
    const names = [...BOT_NAMES], rr = mulberry(rc.seed); names.sort(() => rr() - .5); const bots = makeBots(rc.seed, names, nb, ref, hi, LANES);
    bots.forEach((b, i) => { const s = slots[i]; b.lane = s.lane; const r = this.mkRacer(b.id, b.name, b.kind, b.color, false, laneX(s.lane), s.row * 95); r.bot = b; r.dyn = rc.kind === 'demo'; this.racers.push(r); });
  }
  /** Chequered line and town sign painted on the road for the Journey finish. */
  private finishLine(y: number, text: string) {
    const g = this.add.graphics().setDepth(-2), sq = 22; for (let i = 0; i < Math.ceil(ROAD_W / sq); i++) for (let j = 0; j < 3; j++) { g.fillStyle((i + j) % 2 ? 0xffffff : 0x111111, .92).fillRect(-ROAD_W / 2 + i * sq, y - 33 + j * sq, sq, sq); }
    this.add.text(0, y - 150, text, { fontFamily: 'Orbitron, sans-serif', fontSize: '54px', color: '#19d3ff', fontStyle: '900', stroke: '#04060c', strokeThickness: 8 }).setOrigin(.5).setAlpha(.9).setDepth(-1.5);
  }
  private driveDet(r: Racer, t: number) {
    const p = r.bot!, d = botDistOut(p, r.outT, t) - r.delay, d0 = botDistOut(p, r.outT, Math.max(0, t - .05)) - r.delay, wob = r.out ? 0 : Math.sin(p.w2 * t + p.ph2) * p.amp * LANE_W;
    r.y = r.startY - d; r.vy = -(d - d0) / .05; r.x = Phaser.Math.Clamp(laneX(p.lane) + wob, -ROAD_W / 2 + 28, ROAD_W / 2 - 28); r.vx = r.out ? 0 : Math.cos(p.w2 * t + p.ph2) * p.amp * LANE_W * p.w2;
    r.h = UP + Math.atan2(r.vx, Math.max(60, -r.vy));
  }
  private driveDyn(r: Racer, dt: number) {
    const P = this.phys, i = parseInt(r.id.slice(1)) || 0, t = this.elapsed;
    if (r.out) { const f = Math.pow(.35, dt); r.vx *= f; r.vy *= f; r.x += r.vx * dt; r.y += r.vy * dt; r.h += r.spin * dt; r.spin *= Math.pow(.2, dt); return; }
    const off = Math.sin(t * .35 + i * 2.1) * 260 - (i % 2 ? 90 : -40), desY = P.y + off, cap = this.pp.maxSpeed * (.8 + i * .03), vy0 = Phaser.Math.Clamp(P.vy + (desY - r.y) * 1.3, -cap, -90);
    const near = Math.abs(r.y - P.y) < 190, tx = near ? P.x + Math.sin(t * 1.3 + i) * 24 : laneX(i % LANES), vx0 = Phaser.Math.Clamp((tx - r.x) * (near ? 1.5 : 1), -150, 150), k = Math.min(1, dt * 2.6);
    r.vy += (vy0 - r.vy) * k; r.vx += (vx0 - r.vx) * k; r.x = Phaser.Math.Clamp(r.x + r.vx * dt, -ROAD_W / 2 + 28, ROAD_W / 2 - 28); r.y += r.vy * dt; r.h += (Phaser.Math.Angle.Wrap(UP + Math.atan2(r.vx, Math.max(60, -r.vy)) - r.h)) * Math.min(1, dt * 6) + r.spin * dt; r.spin *= Math.pow(.15, dt);
  }
  private tickRacers(dt: number) {
    const t = this.elapsed;
    for (const r of this.racers) {
      r.cd = Math.max(0, r.cd - dt);
      if (r.human) { if (!r.has) continue; const k = Math.min(1, dt * 12); r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.h += Phaser.Math.Angle.Wrap(r.th - r.h) * k; }
      else if (r.dyn) this.driveDyn(r, dt); else this.driveDet(r, t);
      r.prog = -r.y; r.c.setPosition(r.x, r.y).setRotation(r.h);
      if (!r.human && r.out) { this.fx.damage(dt, r.x, r.y, r.h, 1); if (t - (r.outT ?? 0) > 5) r.c.setVisible(false); }
      else if (!r.human && r.hp < 45 && !r.out) this.fx.damage(dt, r.x, r.y, r.h, 1 - r.hp / 45);
      // rivals shove traffic out of the way instead of driving through it
      if (!r.out) for (const o of this.cars) { if (!o.active || o.hit || Math.abs(o.y - r.y) > 90 || Math.abs(o.x - r.x) > 70) continue; const hit = boxHit({ x: r.x, y: r.y, h: r.h, l: r.l - 4, w: r.w - 3 }, { x: o.x, y: o.y, h: o.h, l: o.l - 4, w: o.w - 3 });
        if (hit) { const ghost = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, spin: 0 } as unknown as CarPhysics, body = { x: o.x, y: o.y, vx: o.vx, vy: o.vy, mass: o.mass, spin: o.spin }; const imp = resolveHit(ghost, r.mass * 1.6, body, hit, .3); o.x = body.x; o.y = body.y; o.vx = body.vx; o.vy = body.vy; o.spin = body.spin; o.hit = true; o.spd = 0; o.smoke = 2.5; o.body.setTint(bodyShade(o.color, .6)); this.fx.hit(hit.px, hit.py, Math.min(.6, imp / 500), o.color); if (r.dyn) { r.vx = ghost.vx; r.vy = ghost.vy; } } }
    }
  }
  /** Player against every rival: bounce, damage to me, and (against bots) damage back. */
  private racerHits(pBox: { x: number; y: number; h: number; l: number; w: number }) {
    const P = this.phys;
    for (const r of this.racers) {
      if (!r.has || r.out || r.wrecked || Math.abs(r.y - P.y) > 130 || Math.abs(r.x - P.x) > 130) continue;
      const hit = boxHit(pBox, { x: r.x, y: r.y, h: r.h, l: r.l - 4, w: r.w - 3 }); if (!hit) continue;
      const body = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, mass: r.human || r.dyn ? r.mass : 0, spin: 0 }, imp = resolveHit(P, this.mass, body, hit, .4);
      if (r.dyn) { r.x = body.x; r.y = body.y; r.vx = body.vx; r.vy = body.vy; r.spin += body.spin * .3; }
      if (imp < 25 || r.cd > 0 || this.over || this.inv > 0) continue; r.cd = .4;
      const st = Math.max(.15, Math.min(1, imp / 420)); this.hurt(hitDamage(imp, r.mass, this.mass), hit.px, hit.py, r.color, st);
      if (imp > 120) { this.rams++; r.lastHit = this.elapsed; if (!r.human) { const dmg = hitDamage(imp, this.mass * (r.dyn ? 1 : .6), r.mass); r.hp = Math.max(0, r.hp - dmg); if (!this.mp) r.delay += imp * .55; if (r.hp <= 0 && !r.out) this.knockOut(r); } }
    }
  }
  private knockOut(r: Racer) {
    r.out = true; r.wrecked = true; r.outT = this.elapsed; r.body.setTint(bodyShade(r.color, .55)); r.spin = (Math.random() - .5) * 5;
    if (this.elapsed - r.lastHit < 6) { this.kos++; this.game.events.emit('toast', `KO!  ${r.name.toUpperCase()}`, '#ff3560'); this.scorer.bonus(500); this.audio.sting('milestone'); }
  }
  /** Silent hit-point loss (hazards, scrapes). Wrecks the car at 0. */
  private hpLoss(a: number) {
    if (!this.rk || this.over || this.raceDone) return; this.hp = Math.max(0, this.hp - a * this.pp.armor); this.dmg = Math.min(1.2, (1 - this.hp / HP_MAX) * 1.05); this.carBody.setTint(bodyShade(this.baseColor, 1 - .38 * Math.min(1, this.dmg))); if (this.hp <= 0) this.raceWreck();
  }
  private hurt(a: number, x: number, y: number, color: number, st: number) { if (this.over || this.raceDone) return; this.crashFx(st, x, y, color, false, this.hp - a <= 0 ? 'gameover' : undefined); this.hpLoss(a); }
  private raceWreck() {
    if (this.wrecked) return; this.wrecked = true; this.over = true; this.audio.sting('over'); music.duck(.35); const final = this.rk === 'demo' && !!this.mp;
    if (this.mp) this.mp.send({ t: 'wreck' });
    this.game.events.emit('gameover', { race: true, final, kind: this.rk, score: this.score, dist: this.dist, best: Math.max(getSave().stats.endless_best_m, this.dist), cost: reviveCost(this.revives), coins: getSave().coins, crashes: 0, max: 0, kos: this.kos, adLeft: Math.max(0, 3 - this.adRevives) });
    if (final) this.time.delayedCall(2200, () => this.finishRace('wrecked'));
  }

  // live race with a friend
  private setupMp() {
    const m = this.mp; if (!m) return; const off = (f: () => void) => this.mpOffs.push(f), fr = () => this.racers.find(r => r.human);
    off(m.on('ready', () => { this.oppReady = true; this.tryGo(); })); off(m.on('go', () => { this.mpWait = false; }));
    off(m.on('r', (d: MpMsg) => { const f = fr(); if (!f) return; const now = performance.now(), dtm = (now - f.lastMsg) / 1000; if (f.lastMsg && dtm > .02 && dtm < .6) { f.vx = (d.x - f.tx) / dtm; f.vy = (d.y - f.ty) / dtm; } f.lastMsg = now; f.tx = d.x; f.ty = d.y; f.th = d.h; f.hp = d.hp; f.kos = d.kos; f.wrecked = !!d.w; if (!f.has) { f.has = true; f.x = d.x; f.y = d.y; f.h = d.h; } }));
    off(m.on('elim', (d: MpMsg) => this.applyElim(String(d.id), Number(d.at), false)));
    off(m.on('fin', (d: MpMsg) => { this.oppFin = { t: d.at, sc: d.sc }; const f = fr(); if (f) f.finT = d.at; if (!this.raceDone) this.game.events.emit('toast', `${(f?.name ?? 'FRIEND').toUpperCase()} REACHED FIRST`, '#ff3560'); }));
    off(m.on('wreck', () => { const f = fr(); if (!f) return; f.wrecked = true; if (this.rk === 'demo') { f.out = true; f.outT = this.elapsed; this.kos++; this.game.events.emit('toast', `KO!  ${f.name.toUpperCase()}`, '#ff3560'); this.time.delayedCall(1200, () => this.finishRace('win')); } else this.game.events.emit('toast', `${f.name.toUpperCase()} IS WRECKED`, '#ffffff'); }));
    off(m.on('_close', () => { if (this.mpWait) this.mpWait = false; const f = fr(); if (f && !f.out) { f.out = true; f.outT = this.elapsed; f.has = false; f.c.setVisible(false); } this.mp = null; this.game.events.emit('toast', `${this.oppName.toUpperCase() || 'FRIEND'} LEFT`, '#ff5a3c'); }));
    this.oppReady = m.peerReady; if (m.goSeen) this.mpWait = false; this.meReady = true; m.send({ t: 'ready' }); this.tryGo(); this.game.events.emit('toast', `WAITING FOR ${this.oppName.toUpperCase() || 'FRIEND'}...`, '#ffffff');
  }
  private tryGo() { const m = this.mp; if (m && m.role === 'host' && this.meReady && this.oppReady && this.mpWait) { this.mpWait = false; m.send({ t: 'go' }); } }
  private mpLeave() { const m = this.mp; if (m) { m.send({ t: 'wreck' }); } }
  private get isAuth() { return !this.mp || this.mp.role === 'host'; }

  private standings(): (Standing & { outT?: number })[] {
    const P = this.phys, list: (Standing & { outT?: number })[] = [{ id: this.myId, prog: -P.y, out: this.myPlace > 0 && this.rk === 'elim' ? true : this.wrecked && !this.raceDone ? undefined : undefined, fin: this.myFin }];
    for (const r of this.racers) list.push({ id: r.id, prog: r.prog, out: r.out || undefined, outT: r.outT, fin: r.finT });
    return list;
  }
  private applyElim(id: string, t: number, local: boolean) {
    if (this.raceDone || this.rk !== 'elim') return; const alive = this.standings().filter(s => !s.out).length;
    if (id === this.myId) { this.myPlace = alive; this.elimCount++; this.game.events.emit('toast', 'ELIMINATED', '#ff3560'); this.finishRace('out'); return; }
    const r = this.racers.find(x => x.id === id); if (!r || r.out) return; r.out = true; r.outT = t; r.body.setTint(bodyShade(r.color, .55)); this.elimCount++; this.audio.sting('milestone'); this.game.events.emit('toast', `${r.name.toUpperCase()} OUT`, '#ff3560');
    if (local && this.mp) this.mp.send({ t: 'elim', id, at: t });
    if (this.standings().filter(s => !s.out).length <= 1) this.time.delayedCall(700, () => this.finishRace('win'));
  }
  private elimTick() {
    if (this.rk !== 'elim' || this.raceDone || !this.isAuth || this.elapsed < this.elimNext) return; this.elimNext += elimEvery; const id = lastPlace(this.standings()); if (!id) return;
    if (id === this.myId) { if (this.mp) this.mp.send({ t: 'elim', id, at: this.elapsed }); this.applyElim(id, this.elapsed, false); } else this.applyElim(id, this.elapsed, true);
  }
  private raceTick(dt: number, P: CarPhysics) {
    this.tickRacers(dt); this.elimTick();
    const D = this.routeM * 12;
    if (this.rk === 'journey' && !this.raceDone && !this.wrecked && -P.y >= D) { this.myFin = this.elapsed; if (this.mp) this.mp.send({ t: 'fin', at: this.elapsed, sc: this.score }); this.finishRace('finish'); return; }
    if (this.rk === 'demo' && !this.raceDone) {
      const alive = this.racers.filter(r => !r.out); if (!this.mp && this.kos >= demoKoTarget) this.finishRace('win'); else if (!this.mp && alive.length === 0 && this.racers.length) this.finishRace('win'); else if (this.elapsed > 150) this.finishRace('time');
    }
    if (this.mp && (this.mpSendT -= dt) <= 0) { this.mpSendT = .1; this.mp.send({ t: 'r', x: Math.round(P.x), y: Math.round(P.y), h: +P.heading.toFixed(3), hp: Math.round(this.hp), kos: this.kos, w: this.wrecked ? 1 : 0 }); }
    if ((this.hudRaceT -= dt) <= 0) { this.hudRaceT = .1; this.emitRace(P); }
  }
  private emitRace(P: CarPhysics) {
    const st = this.standings(), order = rankAll(st.map(s => ({ ...s, fin: undefined }))), place = order.indexOf(this.myId) + 1, D = this.routeM * 12, alive = st.filter(s => !s.out).length; let line = '';
    if (this.rk === 'journey') { const rt = routeById(this.cfg.race!.route), pr = Math.max(0, Math.min(1, -P.y / D)); line = `${rt.legs[Math.min(2, Math.floor(pr * 3))].toUpperCase()}  ·  ${Math.max(0, Math.round((D + P.y) / 12)).toLocaleString()} m TO GO`; }
    else if (this.rk === 'elim') line = `NEXT OUT IN ${Math.max(0, Math.ceil(this.elimNext - this.elapsed))}s  ·  ${alive} LEFT`;
    else line = this.mp ? `${Math.max(0, Math.ceil(150 - this.elapsed))}s  ·  WRECK ${(this.racers[0]?.name ?? 'THEM').toUpperCase()}` : `KO ${this.kos}/${demoKoTarget}  ·  ${Math.max(0, Math.ceil(150 - this.elapsed))}s`;
    this.game.events.emit('race', { kind: this.rk, place, of: st.length, hp: this.hp, line, prog: this.rk === 'journey' ? Math.max(0, Math.min(1, -P.y / D)) : -1, dots: this.rk === 'journey' ? this.racers.map(r => Math.max(0, Math.min(1, r.prog / D))) : [], kos: this.kos });
  }
  private finishRace(why: 'finish' | 'out' | 'win' | 'wrecked' | 'time' | 'quit') {
    if (this.raceDone || !this.rk) return; this.raceDone = true; this.over = true; const k = this.rk, t = this.elapsed, st = this.standings(), D = this.routeM * 12, field = st.length;
    let place = 1;
    if (k === 'journey') {
      const fin = new Map<string, number>(); fin.set(this.myId, this.myFin ?? Infinity);
      for (const r of this.racers) { if (r.human) { if (r.finT !== undefined) fin.set(r.id, r.finT); } else { const tf = botTimeTo(r.bot!, D + r.startY + r.delay); if (tf <= t) fin.set(r.id, tf); } }
      const list = st.map(s => ({ ...s, fin: fin.get(s.id) !== undefined && fin.get(s.id)! < Infinity ? fin.get(s.id) : undefined, out: s.id === this.myId && this.myFin === undefined ? true : s.out, outT: s.id === this.myId ? t : s.outT }));
      place = rankAll(list).indexOf(this.myId) + 1;
    } else if (k === 'elim') {
      place = this.myPlace > 0 ? this.myPlace : 1;
      if (why === 'quit' || why === 'wrecked') place = Math.max(place, st.filter(s => !s.out).length);
    } else {
      const bots = this.racers, f = bots.find(r => r.human);
      if (why === 'win') place = 1;
      else if (f) place = why === 'wrecked' || this.wrecked ? 2 : (f.out ? 1 : this.hp > f.hp ? 1 : this.hp < f.hp ? 2 : 1);
      else { const aliveB = bots.filter(r => !r.out); place = this.wrecked || why === 'quit' ? 1 + aliveB.length : 1 + aliveB.filter(r => r.hp > this.hp).length; }
    }
    place = Math.max(1, Math.min(field, place)); const prize = (why === 'quit' && k !== 'journey') ? 0 : PRIZE[k][Math.min(PRIZE[k].length - 1, place - 1)] ?? 100, route = k === 'journey' ? routeById(this.cfg.race!.route) : null;
    const race: RaceResult = { kind: k, place, of: field, won: place === 1, kos: this.kos, rams: this.rams, wrecked: this.wrecked, finished: this.myFin !== undefined, prize: why === 'quit' ? 0 : prize, timeSec: Math.round(t), routeId: route?.id, toRoute: route?.to };
    const f = this.racers.find(r => r.human); let mpr: RunResult['mp'];
    if (f && this.cfg.mp) { const fp = (() => { const o = rankAll(st.map(s => ({ ...s, fin: s.id === this.myId ? this.myFin : s.fin }))); return o.indexOf(f.id) + 1; })(); mpr = { oppName: this.oppName || f.name, oppScore: this.oppFin?.sc ?? Math.max(0, Math.floor(f.prog / 12)), won: place === 1 || place < fp, tie: false }; }
    this.banked = true; this.mpOffs.forEach(o => o()); this.mpOffs = []; this.cfg.mp?.resetRace();
    const r: RunResult = { districtId: this.dist0.id, vehicleId: this.veh.id, weather: this.weather, points: this.score, durationSec: Math.round(t), maxCombo: this.maxStreak, drifts: this.scorer.drifts, topSpeed: Math.round(this.scorer.topSpeed * KMH), clean: false, cleanBonus: 0, laps: 0, mode: this.cfg.mode, distance: this.dist, crashes: this.totalCrashes, revives: this.revives, nearMisses: this.nmCount, pickups: this.pickups, distanceM: this.dist, road: this.rd.id, race, ...(mpr ? { mp: mpr } : {}) };
    this.game.events.emit('end', r); this.scene.stop('HUD');
  }

  // ------------------------------------------------------------------ crash / game flow
  private crashFx(st: number, x: number, y: number, color: number, damage = true, line?: RadioKind) {
    this.scorer.crash(); this.nmStreak = 0; if (damage) { this.dmg = Math.min(1.2, this.dmg + st * .3); this.carBody.setTint(bodyShade(this.baseColor, 1 - .38 * Math.min(1, this.dmg))); }
    this.fx.hit(x, y, st, color); this.shake3 = Math.max(this.shake3, .35 + st); this.cameras.main.shake(110 + st * 240, .003 + st * .013); this.audio.crash(st); this.radio.say(line ?? (st > .6 ? 'bigcrash' : 'crash')); if (navigator.vibrate) navigator.vibrate(30 + st * 100); this.game.events.emit('crash', st);
  }
  private carCrash(c: ECar, st: number, x: number, y: number) {
    if (this.rk) { this.totalCrashes++; c.smoke = 3; c.body.setTint(bodyShade(c.color, .6)); this.hurt(7 + st * 26, x, y, c.color, st); return; }
    this.crashes++; this.totalCrashes++; c.smoke = 3; c.body.setTint(bodyShade(c.color, .6)); this.crashFx(st, x, y, c.color, true, this.crashes >= MAX_CRASHES ? 'gameover' : this.crashes === MAX_CRASHES - 1 ? 'lastlife' : undefined);
    if (this.crashes >= MAX_CRASHES) this.gameOver(); else if (this.crashes === MAX_CRASHES - 1) this.game.events.emit('toast', 'LAST LIFE - ONE MORE AND IT IS OVER', '#ff5a3c');
  }
  private gameOver() {
    if (this.over) return; this.over = true; this.audio.sting('over'); music.duck(.35); this.game.events.emit('gameover', { score: this.score, dist: this.dist, best: Math.max(getSave().stats.endless_best_m, this.dist), cost: reviveCost(this.revives), coins: getSave().coins, crashes: this.crashes, max: MAX_CRASHES });
  }
  /** `free` = a rewarded ad was watched (at most 3 per run). Otherwise it costs coins. */
  private revive(free = false) {
    if (!this.over || this.raceDone || (this.rk === 'demo' && this.mp)) return; const cost = reviveCost(this.revives);
    if (free) { if (this.adRevives >= 3) return; this.adRevives++; } else if (!spendCoins(cost)) { this.game.events.emit('toast', 'NOT ENOUGH COINS', '#ff5a3c'); return; }
    this.revives++; this.crashes = 0; this.over = false; this.inv = 3; this.dmg = 0; this.carBody.setTint(this.baseColor);
    if (this.rk) { this.wrecked = false; this.hp = 60; this.dmg = (1 - this.hp / HP_MAX) * 1.05; this.carBody.setTint(bodyShade(this.baseColor, 1 - .38 * this.dmg)); } music.duck(1); this.audio.sting('revive'); this.audio.coin(); this.radio.say('revive');
    const P = this.phys; P.vx = 0; P.vy = -280; P.spin = 0; P.heading = UP; P.x = Phaser.Math.Clamp(P.x, -ROAD_W / 2 + 30, ROAD_W / 2 - 30);
    for (const c of this.cars) if (c.active && Math.abs(c.y - P.y) < 700) { c.active = false; c.c.setVisible(false); } // clear the road around the player
    this.game.events.emit('revived', { cost: free ? 0 : cost, coins: getSave().coins });
  }
  private bank() {
    if (this.banked || this.score <= 0) return; this.banked = true;
    const r: RunResult = { districtId: this.dist0.id, vehicleId: this.veh.id, weather: this.weather, points: this.score, durationSec: Math.round(this.elapsed), maxCombo: this.maxStreak, drifts: this.scorer.drifts, topSpeed: Math.round(this.scorer.topSpeed * KMH), clean: false, cleanBonus: 0, laps: 0, mode: this.cfg.mode ?? 'endless', distance: this.dist, crashes: this.totalCrashes, revives: this.revives, nearMisses: this.nmCount, pickups: this.pickups, distanceM: this.dist, road: this.rd.id };
    this.game.events.emit('bank', r);
  }
  private spawnCoins(y: number) {
    const lanes = [0, 1, 2, 3].filter(l => l < LANES), free = lanes.filter(l => this.laneFree(l, y)), pool = free.length ? free : lanes, lane = Phaser.Utils.Array.GetRandom(pool);
    for (let i = 0; i < 5; i++) this.coinsF.place(laneX(lane), y - i * 70);
  }
  private gotCoin() { this.pickups++; addCoins(COIN_VALUE); this.audio.coin(); this.game.events.emit('coin', this.pickups * COIN_VALUE); if (this.pickups % 10 === 0) this.radio.say('pickup'); }
  private liveAch() {
    const got = grantLive({ mode: this.rk ? 'drift' : 'endless', points: this.score, maxCombo: this.maxStreak, topSpeed: Math.round(this.scorer.topSpeed * KMH), distanceM: this.dist, drifts: this.scorer.drifts, pickups: this.pickups, nearMisses: this.nmCount, laps: 0 });
    got.forEach(a => { this.game.events.emit('achievement', a); this.audio.chime(); this.radio.say('achievement'); });
  }
  private near() { this.nmCount++; this.nmStreak = Math.min(10, this.nmStreak + 1); this.maxStreak = Math.max(this.maxStreak, this.nmStreak); this.nmT = 4; const pts = 100 * this.nmStreak; this.scorer.bonus(pts); this.audio.whoosh(); this.game.events.emit('nearmiss', pts); this.radio.say(this.nmStreak >= 4 ? 'streak' : 'nearmiss'); }
  private skid(x: number, y: number, rot: number) { const i = this.skidI++ % this.skids.length; this.skids[i].setPosition(x, y).setRotation(rot).setAlpha(.5).setVisible(true); this.skidAge[i] = 0; }

  update(_t: number, ms: number) {
    const dt = Math.min(ms / 1000, .04), k = this.keys, P = this.phys, view = this.rig;
    if (Phaser.Input.Keyboard.JustDown(k.ESC) || Phaser.Input.Keyboard.JustDown(k.P)) { if (!this.over) this.game.events.emit('pause-toggle'); else this.game.events.emit('go-menu'); }
    if (this.paused || this.raceDone) return;
    if (Phaser.Input.Keyboard.JustDown(k.C) || Phaser.Input.Keyboard.JustDown(k.V)) this.game.events.emit('cam-next');
    if (this.over) { if (Phaser.Input.Keyboard.JustDown(k.ENTER)) this.game.events.emit('go-revive'); if (Phaser.Input.Keyboard.JustDown(k.R)) this.game.events.emit('go-restart'); }
    // world follows the camera
    const cx = Math.round(view.centerX), cy = Math.round(view.centerY), g = this.ground, rd = this.road;
    g.setPosition(cx, cy); g.tilePositionX = cx - g.width / 2; g.tilePositionY = cy - g.height / 2; rd.setPosition(0, cy); rd.tilePositionY = cy - rd.height / 2;
    if ((this.chunkT -= dt) <= 0) { this.chunkT = .25; this.updateChunks(P.y); }
    if (this.mpWait) { this.mpWaited += dt; if (this.mpWaited > 20) { this.mpWait = false; this.game.events.emit('toast', 'NO ANSWER - STARTING', '#ff5a3c'); } view.update(dt, P.x, P.y, P.heading, 0, 0, 0); this.audio.update(0, 0); this.draw3d(dt, false); return; }
    if (this.countdown > 0) {
      this.countdown -= dt; const c = Math.ceil(this.countdown - .2); if (c !== this.lastCount) { this.lastCount = c; this.game.events.emit('countdown', c); this.audio.countdown(c); if (c <= 0) { tilt.calibrate(); this.radio.say('start'); } }
      for (const c2 of this.cars) if (c2.active) c2.c.setPosition(c2.x, c2.y); view.update(dt, P.x, P.y, P.heading, 0, 0, 0); this.audio.update(0, 0); this.draw3d(dt, false); return;
    }
    this.elapsed += dt;
    const t = this.touch, set = getSave().settings, left = k.A.isDown || k.LEFT.isDown || t.left, right = k.D.isDown || k.RIGHT.isDown || t.right, drive = !this.over;
    const brake = !drive || k.S.isDown || k.DOWN.isDown || t.brake, throttle = (drive && (k.W.isDown || k.UP.isDown || (this.touchMode && !brake)) ? 1 : 0) * this.throttleMul(), hand = drive && (k.SPACE.isDown || k.SHIFT.isDown || t.hand);
    let steer = drive ? (right ? 1 : 0) - (left ? 1 : 0) : 0; if (drive && this.touchMode && set.controls === 'tilt') steer = Phaser.Math.Clamp(steer + tilt.value, -1, 1);
    steer = this.shaper.step(steer, dt, P.speed / this.pp.maxSpeed, this.touchMode && set.controls === 'tilt'); // same ramp for keys / arrows / tilt in every view
    if (!this.tiltChecked && this.countdown < -1.5) { this.tiltChecked = true; if (this.touchMode && set.controls === 'tilt' && !tilt.got) this.game.events.emit('toast', 'NO TILT SENSOR - SWITCH TO ARROWS IN PAUSE MENU'); }
    if (Phaser.Input.Keyboard.JustDown(k.H)) this.audio.horn(); if (Phaser.Input.Keyboard.JustDown(k.M)) this.audio.toggleMute();

    // keep the car pointing down the road: self-centring when not steering, hard limit at ~57 degrees
    const ratio = P.speed / this.pp.maxSpeed; let dh = Phaser.Math.Angle.Wrap(P.heading - UP);
    if (!hand && Math.abs(steer) < .02 && P.slipDeg < 8) P.heading -= dh * Math.min(1, dt * (.8 + ratio * .6)); // gentle, only when the car is already tracking straight (never fights a slide)
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
    if (Math.abs(P.vl) > 75) { const rx = P.x - c * 24, ry = P.y - s * 24; this.smoke.emitParticleAt(rx, ry, P.dr > .5 ? 3 : 1); this.r3d?.tyreSmoke(rx, ry, P.vx, P.vy); if (!off && this.frame % 2 === 0) { this.skid(rx - s * 12, ry + c * 12, Math.atan2(P.vy, P.vx)); this.skid(rx + s * 12, ry - c * 12, Math.atan2(P.vy, P.vx)); } }
    if ((this.frame++ & 3) === 0) for (let i = 0; i < this.skids.length; i++) if (this.skidAge[i] < 6) { this.skidAge[i] += dt * 4; const a = .5 * (1 - this.skidAge[i] / 6); if (a <= 0) this.skids[i].setVisible(false); else this.skids[i].setAlpha(a); }
    if (drive) { const res = this.scorer.update(dt, off ? 0 : speed, P.slipDeg); if (res) this.game.events.emit('drift', res); }
    if (this.nmStreak > 0 && (this.nmT -= dt) <= 0) this.nmStreak = 0;

    // traffic
    const pBox = { x: P.x, y: P.y, h: P.heading, l: this.pl - 3, w: this.pw - 3 }, want = Math.max(4, Math.round(Math.min(24, 12 + Math.floor(this.dist / 400)) * this.rd.traffic));
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
    if (this.rk) { this.raceTick(dt, P); if (this.raceDone) return; if (!this.over) this.racerHits(pBox); }
    this.nextHaz -= dt; if (this.nextHaz <= 0) { this.nextHaz = (3 + Math.random() * 3) / this.rd.hazards; const kind = Phaser.Utils.Array.GetRandom(['pothole', 'cone', 'flood'] as const), x = Phaser.Math.Between(-ROAD_W / 2 + 40, ROAD_W / 2 - 40), y = P.y - 2300 - Math.random() * 1000;
      if (kind === 'cone') for (let i = 0; i < 3; i++) this.haz.add(kind, x + (i - 1) * 24, y - i * 20); else this.haz.add(kind, x, y); }
    if (!this.over) this.haz.update(P.x, P.y, speed, { onFlood: () => { P.bump(.985); this.radio.say('flood'); }, onNear: () => this.near(), onHit: (kind, h) => { P.bump(kind === 'cone' ? .78 : .62); if (this.rk) this.hpLoss(kind === 'cone' ? 2 : 5); this.crashFx(kind === 'cone' ? .3 : .25, h.x, h.y, kind === 'cone' ? 0xff8c1a : 0x4a3a2a, false, kind === 'cone' ? 'cone' : 'pothole'); } }, 4600);

    this.audio.update(ratio, Math.min(1, Math.abs(P.vl) / 170), throttle, P.rpm, P.gear); this.radio.tick(dt); this.draw3d(dt, brake);
    this.coinsF.animate(this.time.now); this.coinsF.collect(P.x, P.y, COIN_RADIUS, () => this.gotCoin());
    for (const c of this.coinsF.list) if (c.on && c.y > P.y + 700) this.coinsF.remove(c);
    if ((this.coinT -= dt) <= 0) { this.coinT = .8 + Math.random() * .9; this.spawnCoins(P.y - 1900 - Math.random() * 900); }
    if ((this.achT -= dt) <= 0) { this.achT = 1; this.liveAch(); }
    this.musT -= dt; if (this.musT <= 0) { this.musT = .4; music.setIntensity(.3 + Math.min(1, ratio) * .7); }
    view.update(dt, P.x, P.y, P.heading, P.vx, P.vy, ratio);
    this.hudT += dt; if (this.hudT > .05) { this.hudT = 0; this.game.events.emit('stats', { coins: this.pickups * COIN_VALUE, score: this.score, combo: Math.max(1, this.nmStreak), speed: Math.round(speed * KMH), dist: this.dist, crashes: this.crashes, max: MAX_CRASHES, best: Math.max(getSave().stats.endless_best_m, this.dist), live: this.scorer.live, off }); }
  }
}
