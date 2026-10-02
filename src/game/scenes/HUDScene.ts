import Phaser from 'phaser';
import { getSave, setSettings } from '../../state/store';
import { requestTilt } from '../systems/Controls';
import { MAX_CRASHES } from '../data/settings';
const NUM = 'Anton, Impact, sans-serif', UI = '"Barlow Condensed", "Arial Narrow", sans-serif', OR = '#ff8c1a', GR = '#2fd06a', RD = '#ff5a3c';
/** In-run HUD for both modes. Text is only re-rendered when its value changes (canvas text is expensive). */
export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }
  create() {
    const W = this.scale.width, H = this.scale.height, ev = this.game.events, endless = this.registry.get('mode') === 'endless', touchMode = !!this.registry.get('touchMode');
    const T = (x: number, y: number, s: string, size: number, color = '#fff', font = UI, ox = 0, oy = 0) => this.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color, fontStyle: font === UI ? '700' : 'normal', stroke: '#031a0f', strokeThickness: font === UI ? 3 : 4 }).setOrigin(ox, oy);
    const set = (t: Phaser.GameObjects.Text, s: string) => { if (t.text !== s) t.setText(s); };
    const g = this.add.graphics(); g.fillStyle(0x031a0f, .62).fillRoundedRect(12, 10, 236, 100, 16).lineStyle(2, 0xff8c1a, .9).strokeRoundedRect(12, 10, 236, 100, 16);
    g.fillStyle(0x031a0f, .62).fillRoundedRect(W / 2 - 80, 10, 160, 48, 24).lineStyle(2, 0xffffff, .5).strokeRoundedRect(W / 2 - 80, 10, 160, 48, 24);
    g.fillStyle(0x031a0f, .62).fillRoundedRect(W - 190, 10, 126, 100, 16).lineStyle(2, 0xff8c1a, .9).strokeRoundedRect(W - 190, 10, 126, 100, 16);
    T(26, 16, 'SCORE', 16, OR); const score = T(26, 32, '0', 42, '#fff', NUM), combo = T(26, 80, '', 22, OR);
    const time = T(W / 2, 34, endless ? '0 m' : '90', endless ? 28 : 32, '#fff', NUM, .5, .5);
    T(W - 176, 16, 'SPEED', 16, OR); const speed = T(W - 120, 36, '0', 46, '#fff', NUM, 1, 0); T(W - 114, 58, 'KM/H', 16, OR, UI, 0, 0); const lap = T(W - 176, 90, endless ? 'BEST 0m' : 'LAP 0', endless ? 16 : 20, GR);
    const circ = (x: number, y: number, label: string, fn: () => void, size = 22) => { const c = this.add.circle(x, y, 22, 0x031a0f, .62).setStrokeStyle(2, 0xffffff, .6).setInteractive({ useHandCursor: true }); T(x, y, label, size, '#fff', NUM, .5, .5); c.on('pointerup', fn); return c; };
    circ(W - 34, 34, 'II', () => ev.emit('pause-toggle')); circ(W - 34, 86, 'CAM', () => ev.emit('cam-next'), 14);
    const pips = endless ? Array.from({ length: MAX_CRASHES }, (_, i) => this.add.circle(W / 2 + (i - (MAX_CRASHES - 1) / 2) * 24, 78, 8, 0x2fd06a).setStrokeStyle(2, 0xffffff, .8)) : [];
    if (endless) T(W / 2, 94, 'CARS HIT', 12, '#ffffffaa', UI, .5, 0);
    const live = T(W / 2, 128, '', 40, OR, NUM, .5, .5).setAlpha(0), count = T(W / 2, H / 2 - 130, '', 150, '#fff', NUM, .5, .5).setAlpha(0);
    const info = T(W / 2, H - 78, '', 18, '#ffffffdd', UI, .5, .5).setAlpha(0).setWordWrapWidth(W - 100).setAlign('center');
    const sub = this.add.text(W / 2, H - 28, '', { fontFamily: UI, fontStyle: '700', fontSize: '22px', color: '#fff', backgroundColor: '#031a0fcc', padding: { x: 14, y: 5 }, wordWrap: { width: W - 380 }, align: 'center' }).setOrigin(.5).setAlpha(0);
    const toast = (msg: string, color = OR) => { const t = T(W / 2, 170, msg, 30, color, NUM, .5, .5).setAlpha(0); this.tweens.add({ targets: t, alpha: 1, y: 148, duration: 180, hold: 800, yoyo: true, onComplete: () => t.destroy() }); };

    // generic button
    const mkBtn = (y: number, label: string, fn: () => void, bg: number, w = 300) => { const r = this.add.rectangle(W / 2, y, w, 50, bg).setStrokeStyle(2, 0xffffff, .7).setInteractive({ useHandCursor: true }); const t = T(W / 2, y, label, 26, bg === 0xff8c1a ? '#1a0b00' : '#fff', UI, .5, .5).setStroke('#000000', 0); r.on('pointerup', fn); return { r, t, all: [r, t] as Phaser.GameObjects.GameObject[] }; };
    // ---- pause overlay
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x031a0f, .8).setInteractive(), pt = T(W / 2, H / 2 - 165, 'PAUSED', 60, '#fff', NUM, .5, .5);
    const cfg = () => getSave().settings, y0 = H / 2 - 100, bs = 56;
    const bResume = mkBtn(y0, 'RESUME', () => ev.emit('pause-toggle'), 0xff8c1a);
    const bCtl = mkBtn(y0 + bs, '', async () => { const next = cfg().controls === 'arrows' ? 'tilt' : 'arrows'; if (next === 'tilt') { const ok = await requestTilt(); if (!ok) { toast('TILT NOT AVAILABLE', RD); return; } } setSettings({ controls: next }); ev.emit('tilt-cal'); refresh(); }, 0x0f5a32);
    const bMus = mkBtn(y0 + bs * 2, '', () => { setSettings({ music: !cfg().music }); refresh(); }, 0x0f5a32), bSfx = mkBtn(y0 + bs * 3, '', () => { setSettings({ sfx: !cfg().sfx }); refresh(); }, 0x0f5a32);
    const bQuit = mkBtn(y0 + bs * 4, 'QUIT TO MENU', () => ev.emit('quit-req'), 0x7a2418);
    const refresh = () => { const s = cfg(); bCtl.t.setText(`STEERING: ${s.controls === 'tilt' ? 'TILT' : 'ARROWS'}`); bMus.t.setText(`MUSIC: ${s.music ? 'ON' : 'OFF'}`); bSfx.t.setText(`SOUND: ${s.sfx ? 'ON' : 'OFF'}`); };
    const pauseUI: Phaser.GameObjects.GameObject[] = [shade, pt, ...bResume.all, ...bMus.all, ...bSfx.all, ...bQuit.all, ...(touchMode ? bCtl.all : [])];
    if (!touchMode) { bMus.r.y = bMus.t.y = y0 + bs; bSfx.r.y = bSfx.t.y = y0 + bs * 2; bQuit.r.y = bQuit.t.y = y0 + bs * 3; bCtl.r.setVisible(false).disableInteractive(); bCtl.t.setVisible(false); }
    refresh(); pauseUI.forEach(o => (o as any).setVisible(false)); const onPaused = (p: boolean) => { refresh(); pauseUI.forEach(o => (o as any).setVisible(p)); }; pauseUI.forEach(o => (o as any).setDepth(50));

    // ---- game over overlay (Endless)
    const goUI: Phaser.GameObjects.GameObject[] = []; let goBtns: ReturnType<typeof mkBtn>[] = [], goTxt: Phaser.GameObjects.Text[] = [];
    if (endless) {
      const gs = this.add.rectangle(W / 2, H / 2, W, H, 0x1a0503, .82).setInteractive(), gt = T(W / 2, 96, 'GAME OVER', 78, RD, NUM, .5, .5), sc = T(W / 2, 176, '', 54, '#fff', NUM, .5, .5), d1 = T(W / 2, 226, '', 24, '#ffffffdd', UI, .5, .5), d2 = T(W / 2, 252, '', 20, OR, UI, .5, .5);
      const bRev = mkBtn(316, '', () => ev.emit('go-revive'), 0xff8c1a, 360), bRes = mkBtn(378, 'RESTART  (R)', () => ev.emit('go-restart'), 0x0f5a32, 360), bMen = mkBtn(440, 'MAIN MENU  (ESC)', () => ev.emit('go-menu'), 0x7a2418, 360);
      goBtns = [bRev, bRes, bMen]; goTxt = [sc, d1, d2, gt]; goUI.push(gs, gt, sc, d1, d2, ...bRev.all, ...bRes.all, ...bMen.all); goUI.forEach(o => { (o as any).setVisible(false); (o as any).setDepth(45); });
      const onOver = (r: { score: number; dist: number; best: number; cost: number; coins: number; crashes: number; max: number }) => {
        goUI.forEach(o => (o as any).setVisible(true)); sc.setText(r.score.toLocaleString()); d1.setText(`${r.dist.toLocaleString()} m driven  ·  ${r.crashes}/${r.max} cars hit`); d2.setText(r.dist >= r.best && r.dist > 0 ? 'NEW BEST DISTANCE!' : `Best: ${r.best.toLocaleString()} m`);
        const can = r.coins >= r.cost; goBtns[0].t.setText(can ? `REVIVE  ·  ${r.cost.toLocaleString()} COINS  (ENTER)` : `REVIVE  ·  ${r.cost.toLocaleString()} COINS  (HAVE ${r.coins.toLocaleString()})`); goBtns[0].r.setFillStyle(can ? 0xff8c1a : 0x4a3a2a); goBtns[0].t.setColor(can ? '#1a0b00' : '#9a8a7a');
        goUI.forEach(o => { (o as any).alpha = 0; this.tweens.add({ targets: o, alpha: 1, duration: 350 }); });
      };
      ev.on('gameover', onOver); ev.on('revived', () => goUI.forEach(o => (o as any).setVisible(false))); this.events.once('shutdown', () => { ev.off('gameover', onOver); ev.removeAllListeners('revived'); });
    }

    // ---- touch controls: steering arrows OR tilt, plus brake + drift. Throttle is automatic.
    if (touchMode) {
      this.input.addPointer(3); const st = this.registry.get('touch') as Record<string, boolean>, bottom = H - 84;
      const mk = (x: number, label: string, key: string, size = 46) => { const r = this.add.rectangle(x, bottom, 112, 112, 0x031a0f, .5).setStrokeStyle(3, 0xff8c1a, .95).setInteractive(); const t = T(x, bottom, label, size, '#fff', NUM, .5, .5);
        const on = (v: boolean) => { st[key] = v; r.setFillStyle(v ? 0xff8c1a : 0x031a0f, v ? .75 : .5); }; r.on('pointerdown', () => on(true)).on('pointerup', () => on(false)).on('pointerout', () => on(false)); return [r, t] as Phaser.GameObjects.GameObject[]; };
      const arrows = [...mk(76, '<', 'left'), ...mk(200, '>', 'right')], tiltBox = this.add.rectangle(138, bottom, 236, 112, 0x031a0f, .4).setStrokeStyle(3, 0x2fd06a, .9).setInteractive(), tiltTxt = T(138, bottom - 10, 'TILT TO STEER', 22, GR, NUM, .5, .5), tiltSub = T(138, bottom + 22, 'tap to re-centre', 16, '#ffffffcc', UI, .5, .5);
      tiltBox.on('pointerup', () => { ev.emit('tilt-cal'); toast('RE-CENTRED', GR); }); mk(W - 200, 'BRAKE', 'brake', 24); mk(W - 76, 'DRIFT', 'hand', 24);
      const bar = this.add.rectangle(138, bottom + 44, 4, 8, 0x2fd06a); const applyCtl = () => { const t = cfg().controls === 'tilt'; arrows.forEach(o => (o as any).setVisible(!t)); [tiltBox, tiltTxt, tiltSub, bar].forEach(o => o.setVisible(t)); }; applyCtl();
      this.events.on('update', () => { if (cfg().controls === 'tilt') { const v = ((window as any).__tiltValue as number) ?? 0; bar.x = 138 + v * 100; } });
      const off = () => ev.off('paused', applyCtl); ev.on('paused', applyCtl); this.events.once('shutdown', off);
    }
    const hint = (i: { district: string; weather: string; car: string; touchMode: boolean }) => `${i.district.toUpperCase()}  ·  ${i.weather.toUpperCase()}  ·  ${i.car.toUpperCase()}${i.touchMode ? '' : `\nW/S gas-brake  ·  A/D steer  ·  SPACE handbrake = DRIFT  ·  C camera  ·  H horn  ·  ESC pause${endless ? '\nHit 5 cars and it is game over' : ''}`}`;
    const onInfo = (i: { district: string; weather: string; car: string; touchMode: boolean }) => { set(info, hint(i)); this.tweens.add({ targets: info, alpha: 1, duration: 300, hold: 4200, yoyo: true }); };
    let lastLive = 0, lastLiveT = 0;
    const onStats = (s: any) => {
      set(score, s.score.toLocaleString()); set(speed, String(s.speed)); set(combo, s.combo > 1 ? (endless ? `NEAR MISS x${s.combo}` : `COMBO x${s.combo}`) : '');
      if (endless) { set(time, `${(s.dist as number).toLocaleString()} m`); set(lap, `BEST ${(s.best as number).toLocaleString()}m`); pips.forEach((p, i) => p.setFillStyle(i < s.crashes ? 0xff3b2a : 0x2fd06a)); }
      else { set(time, String(s.time)); time.setColor(s.time <= 10 ? OR : '#fff'); set(lap, 'LAP ' + s.laps); }
      const now = this.time.now; if (s.live !== lastLive && now - lastLiveT > 90) { lastLive = s.live; lastLiveT = now; if (s.live > 0) { set(live, `DRIFT  +${s.live.toLocaleString()}`); live.setAlpha(1); } else live.setAlpha(0); }
    };
    const onCount = (n: number) => { set(count, n > 0 ? String(n) : 'GO!'); count.setColor(n > 0 ? '#fff' : GR).setAlpha(1).setScale(1.5); this.tweens.add({ targets: count, scale: 1, duration: 280, ease: 'Back.Out' }); if (n <= 0) this.tweens.add({ targets: count, alpha: 0, duration: 500, delay: 350 }); };
    const onDrift = (r: any) => { live.setAlpha(0); lastLive = 0; toast(`+${r.points.toLocaleString()} ${r.perfect ? 'PERFECT ' : ''}${r.long ? 'LONG ' : ''}DRIFT`, r.perfect ? GR : OR); };
    const onRadio = (line: string) => { sub.setText('IBOM FM  ·  ' + line); this.tweens.killTweensOf(sub); this.tweens.add({ targets: sub, alpha: 1, duration: 200, hold: 3800, yoyo: true }); };
    const on: [string, (...a: any[]) => void][] = [['stats', onStats], ['countdown', onCount], ['drift', onDrift], ['radio', onRadio], ['paused', onPaused], ['info', onInfo], ['toast', (m: string, c?: string) => toast(m, c)],
      ['nearmiss', (p: number) => toast(`NEAR MISS +${p}`, '#fff')], ['crash', (st: number) => { if (!endless) toast('KAI! WATCH THE ROAD!', RD); else if (st > .5) toast('BIG HIT!', RD); }], ['lap', (l: any) => toast(`LAP ${l.lap}  +${l.bonus}`, GR)]];
    on.forEach(([e, f]) => ev.on(e, f)); this.events.once('shutdown', () => on.forEach(([e, f]) => ev.off(e, f)));
  }
}
