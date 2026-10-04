import Phaser from 'phaser';
import { getSave, subscribe } from '../../state/store';
import { requestTilt } from '../systems/Controls';
import { MAX_CRASHES } from '../data/settings';
const NUM = 'Orbitron, Eurostile, sans-serif', UI = '"Saira Condensed", "Arial Narrow", sans-serif', OR = '#19d3ff', GR = '#3ff2d0', RD = '#ff3560'; // OR = accent (cyan), GR = good, RD = danger
const PAN = 0x070c1a, ACC = 0x19d3ff;
/** Chamfered outline points (top-left and bottom-right corners cut) for HUD panels and touch buttons. */
const chamfer = (x: number, y: number, w: number, h: number, c = 12) => [new Phaser.Math.Vector2(x + c, y), new Phaser.Math.Vector2(x + w, y), new Phaser.Math.Vector2(x + w, y + h - c), new Phaser.Math.Vector2(x + w - c, y + h), new Phaser.Math.Vector2(x, y + h), new Phaser.Math.Vector2(x, y + c)];
/** In-run HUD for both modes. Text is only re-rendered when its value changes (canvas text is expensive). */
export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }
  create() {
    const W = this.scale.width, H = this.scale.height, ev = this.game.events, endless = this.registry.get('mode') === 'endless', touchMode = !!this.registry.get('touchMode');
    const T = (x: number, y: number, s: string, size: number, color = '#fff', font = UI, ox = 0, oy = 0) => this.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color, fontStyle: font === UI ? '800' : '900', stroke: '#04060c', strokeThickness: font === UI ? 3 : 4 }).setOrigin(ox, oy);
    const set = (t: Phaser.GameObjects.Text, s: string) => { if (t.text !== s) t.setText(s); };
    const g = this.add.graphics(), panel = (x: number, y: number, w: number, h: number, c = 12) => { const p = chamfer(x, y, w, h, c); g.fillStyle(PAN, .72).fillPoints(p, true).lineStyle(2, ACC, .85).strokePoints(p, true); g.fillStyle(ACC, 1).fillRect(x + c, y, 46, 3); };
    panel(12, 10, 236, 100, 16); panel(W / 2 - 80, 10, 160, 48, 12); panel(W - 190, 10, 126, 100, 16);
    T(26, 16, 'SCORE', 16, OR); const score = T(26, 32, '0', 34, '#fff', NUM), combo = T(26, 80, '', 22, OR);
    const time = T(W / 2, 34, endless ? '0 m' : '90', endless ? 22 : 26, '#fff', NUM, .5, .5);
    T(W - 176, 16, 'SPEED', 16, OR); const speed = T(W - 120, 36, '0', 36, '#fff', NUM, 1, 0); T(W - 114, 58, 'KM/H', 16, OR, UI, 0, 0); const lap = T(W - 176, 90, endless ? 'BEST 0m' : 'LAP 0', endless ? 16 : 20, GR);
    const circ = (x: number, y: number, label: string, fn: () => void, size = 22) => { const c = this.add.rectangle(x, y, 44, 44, PAN, .72).setStrokeStyle(2, ACC, .9).setInteractive({ useHandCursor: true }); T(x, y, label, size, '#fff', NUM, .5, .5); c.on('pointerup', fn); return c; };
    circ(W - 34, 34, 'II', () => ev.emit('pause-toggle')); circ(W - 34, 86, 'CAM', () => ev.emit('cam-next'), 14);
    const pips = endless ? Array.from({ length: MAX_CRASHES }, (_, i) => this.add.rectangle(W / 2 + (i - (MAX_CRASHES - 1) / 2) * 24, 80, 18, 10, ACC).setStrokeStyle(1, 0xffffff, .7)) : [];
    if (endless) T(W / 2, 94, 'CARS HIT', 12, '#ffffffaa', UI, .5, 0);
    const live = T(W / 2, 128, '', 30, OR, NUM, .5, .5).setAlpha(0), count = T(W / 2, H / 2 - 130, '', 130, '#fff', NUM, .5, .5).setAlpha(0);
    const info = T(W / 2, H - 78, '', 18, '#ffffffdd', UI, .5, .5).setAlpha(0).setWordWrapWidth(W - 100).setAlign('center');
    const sub = this.add.text(W / 2, H - 28, '', { fontFamily: UI, fontStyle: '700', fontSize: '22px', color: '#fff', backgroundColor: '#070c1aee', padding: { x: 14, y: 5 }, wordWrap: { width: W - 380 }, align: 'center' }).setOrigin(.5).setAlpha(0);
    const toast = (msg: string, color = OR) => { const t = T(W / 2, 170, msg, 24, color, NUM, .5, .5).setAlpha(0); this.tweens.add({ targets: t, alpha: 1, y: 148, duration: 180, hold: 800, yoyo: true, onComplete: () => t.destroy() }); };

    // generic button
    const mkBtn = (y: number, label: string, fn: () => void, bg: number, w = 300) => { const r = this.add.rectangle(W / 2, y, w, 50, bg).setStrokeStyle(2, 0xffffff, .7).setInteractive({ useHandCursor: true }); const t = T(W / 2, y, label, 26, bg === ACC ? '#02122e' : '#fff', UI, .5, .5).setStroke('#000000', 0); r.on('pointerup', fn); return { r, t, all: [r, t] as Phaser.GameObjects.GameObject[] }; };
    const cfg = () => getSave().settings; // (the pause menu is a React overlay: see ui/PauseMenu.tsx)

    // ---- game over overlay (Endless)
    const goUI: Phaser.GameObjects.GameObject[] = []; let goBtns: ReturnType<typeof mkBtn>[] = [], goTxt: Phaser.GameObjects.Text[] = [];
    if (endless) {
      const gs = this.add.rectangle(W / 2, H / 2, W, H, 0x04060c, .86).setInteractive(), gt = T(W / 2, 96, 'GAME OVER', 60, RD, NUM, .5, .5), sc = T(W / 2, 176, '', 42, '#fff', NUM, .5, .5), d1 = T(W / 2, 226, '', 24, '#ffffffdd', UI, .5, .5), d2 = T(W / 2, 252, '', 20, OR, UI, .5, .5);
      const bRev = mkBtn(316, '', () => ev.emit('go-revive'), ACC, 360), bRes = mkBtn(378, 'RESTART  (R)', () => ev.emit('go-restart'), 0x1b2a58, 360), bMen = mkBtn(440, 'MAIN MENU  (ESC)', () => ev.emit('go-menu'), 0x6b1230, 360);
      goBtns = [bRev, bRes, bMen]; goTxt = [sc, d1, d2, gt]; goUI.push(gs, gt, sc, d1, d2, ...bRev.all, ...bRes.all, ...bMen.all); goUI.forEach(o => { (o as any).setVisible(false); (o as any).setDepth(45); });
      const onOver = (r: { score: number; dist: number; best: number; cost: number; coins: number; crashes: number; max: number }) => {
        goUI.forEach(o => (o as any).setVisible(true)); sc.setText(r.score.toLocaleString()); d1.setText(`${r.dist.toLocaleString()} m driven  ·  ${r.crashes}/${r.max} cars hit`); d2.setText(r.dist >= r.best && r.dist > 0 ? 'NEW BEST DISTANCE!' : `Best: ${r.best.toLocaleString()} m`);
        const can = r.coins >= r.cost; goBtns[0].t.setText(can ? `REVIVE  ·  ${r.cost.toLocaleString()} COINS  (ENTER)` : `REVIVE  ·  ${r.cost.toLocaleString()} COINS  (HAVE ${r.coins.toLocaleString()})`); goBtns[0].r.setFillStyle(can ? ACC : 0x2a3350); goBtns[0].t.setColor(can ? '#02122e' : '#7f8db0');
        goUI.forEach(o => { (o as any).alpha = 0; this.tweens.add({ targets: o, alpha: 1, duration: 350 }); });
      };
      ev.on('gameover', onOver); ev.on('revived', () => goUI.forEach(o => (o as any).setVisible(false))); this.events.once('shutdown', () => { ev.off('gameover', onOver); ev.removeAllListeners('revived'); });
    }

    // ---- touch controls: steering arrows OR tilt, plus brake + drift. Throttle is automatic.
    // Buttons are read from every finger each frame (rectangle hit-test), so you can slide from < to > without lifting and use two thumbs freely.
    if (touchMode) {
      this.input.addPointer(3); const st = this.registry.get('touch') as Record<string, boolean>, bottom = H - 80, S = 120;
      type B = { key: string; x: number; label: string; size: number; r: Phaser.GameObjects.Graphics; on: boolean };
      const drawB = (b: B, down: boolean) => { const p = chamfer(b.x - S / 2, bottom - S / 2, S, S, 18); b.on = down; b.r.clear().fillStyle(down ? ACC : PAN, down ? .85 : .55).fillPoints(p, true).lineStyle(3, ACC, .95).strokePoints(p, true); };
      const mk = (x: number, label: string, key: string, size = 50): B => { const b: B = { key, x, label, size, r: this.add.graphics().setDepth(5), on: false }; drawB(b, false); T(x, bottom, label, size, '#fff', NUM, .5, .5).setDepth(6); return b; };
      const btns = [mk(86, '<', 'left'), mk(224, '>', 'right'), mk(W - 226, 'BRAKE', 'brake', 18), mk(W - 86, 'DRIFT', 'hand', 18)];
      const tiltBox = this.add.rectangle(155, bottom, 276, S, PAN, .5).setStrokeStyle(3, 0x3ff2d0, .9).setInteractive().setDepth(5), tiltTxt = T(155, bottom - 12, 'TILT TO STEER', 16, GR, NUM, .5, .5).setDepth(6), tiltSub = T(155, bottom + 22, 'tap to re-centre', 16, '#ffffffcc', UI, .5, .5).setDepth(6);
      tiltBox.on('pointerup', () => { ev.emit('tilt-cal'); toast('RE-CENTRED', GR); });
      const bar = this.add.rectangle(155, bottom + 46, 6, 8, 0x3ff2d0).setDepth(6);
      const applyCtl = () => { const t = cfg().controls === 'tilt'; btns.slice(0, 2).forEach(b => { b.r.setVisible(!t); }); [tiltBox, tiltTxt, tiltSub, bar].forEach(o => o.setVisible(t)); this.children.list.forEach(o => { if (o instanceof Phaser.GameObjects.Text && (o.text === '<' || o.text === '>')) o.setVisible(!t); }); };
      applyCtl(); const unsub = subscribe(applyCtl);
      const hit = (b: B, x: number, y: number) => Math.abs(x - b.x) <= S / 2 + 14 && Math.abs(y - bottom) <= S / 2 + 18;
      const poll = () => {
        const down: Record<string, boolean> = { left: false, right: false, brake: false, hand: false }, tiltMode = cfg().controls === 'tilt';
        for (const p of this.input.manager.pointers) if (p.isDown) for (const b of btns) { if (tiltMode && (b.key === 'left' || b.key === 'right')) continue; if (hit(b, p.x, p.y)) down[b.key] = true; }
        for (const b of btns) { st[b.key] = down[b.key]; if (b.on !== down[b.key]) drawB(b, down[b.key]); }
        if (tiltMode) { const v = ((window as any).__tiltValue as number) ?? 0; bar.x = 155 + v * 110; }
      };
      this.events.on('update', poll); this.events.once('shutdown', () => { this.events.off('update', poll); unsub(); st.left = st.right = st.brake = st.hand = false; });
    }
    // ---- run cash + live race score
    const cash = T(26, 116, 'COINS +0', 20, '#ffd23f'), mpTxt = T(W / 2, 68, '', 22, '#fff', UI, .5, .5).setAlpha(0);
    const onCoin = (n: number) => { set(cash, `COINS +${n.toLocaleString()}`); this.tweens.killTweensOf(cash); cash.setScale(1.25); this.tweens.add({ targets: cash, scale: 1, duration: 220 }); };
    const hint = (i: { district: string; weather: string; car: string; touchMode: boolean }) => `${i.district.toUpperCase()}  ·  ${i.weather.toUpperCase()}  ·  ${i.car.toUpperCase()}${i.touchMode ? '' : `\nW/S gas-brake  ·  A/D steer  ·  SPACE handbrake = DRIFT  ·  C camera  ·  H horn  ·  ESC pause${endless ? '\nHit 5 cars and it is game over' : ''}`}`;
    const onInfo = (i: { district: string; weather: string; car: string; touchMode: boolean }) => { set(info, hint(i)); this.tweens.add({ targets: info, alpha: 1, duration: 300, hold: 4200, yoyo: true }); };
    let lastLive = 0, lastLiveT = 0;
    const onStats = (s: any) => {
      set(score, s.score.toLocaleString()); set(speed, String(s.speed)); set(combo, s.combo > 1 ? (endless ? `NEAR MISS x${s.combo}` : `COMBO x${s.combo}`) : '');
      if (endless) { set(time, `${(s.dist as number).toLocaleString()} m`); set(lap, `BEST ${(s.best as number).toLocaleString()}m`); pips.forEach((p, i) => p.setFillStyle(i < s.crashes ? 0xff3560 : ACC)); }
      else { set(time, String(s.time)); time.setColor(s.time <= 10 ? OR : '#fff'); set(lap, 'LAP ' + s.laps); }
      if (typeof s.coins === 'number') set(cash, `COINS +${s.coins.toLocaleString()}`); if (s.mp) { set(mpTxt, `${(s.mp.name as string).toUpperCase()}  ${(s.mp.score as number).toLocaleString()}`); mpTxt.setColor(s.mp.score > s.score ? RD : GR).setAlpha(1); } else mpTxt.setAlpha(0);
      const now = this.time.now; if (s.live !== lastLive && now - lastLiveT > 90) { lastLive = s.live; lastLiveT = now; if (s.live > 0) { set(live, `DRIFT  +${s.live.toLocaleString()}`); live.setAlpha(1); } else live.setAlpha(0); }
    };
    const onCount = (n: number) => { set(count, n > 0 ? String(n) : 'GO!'); count.setColor(n > 0 ? '#fff' : GR).setAlpha(1).setScale(1.5); this.tweens.add({ targets: count, scale: 1, duration: 280, ease: 'Back.Out' }); if (n <= 0) this.tweens.add({ targets: count, alpha: 0, duration: 500, delay: 350 }); };
    const onDrift = (r: any) => { live.setAlpha(0); lastLive = 0; toast(`+${r.points.toLocaleString()} ${r.perfect ? 'PERFECT ' : ''}${r.long ? 'LONG ' : ''}DRIFT`, r.perfect ? GR : OR); };
    const onRadio = (line: string) => { sub.setText('IBOM FM  ·  ' + line); this.tweens.killTweensOf(sub); this.tweens.add({ targets: sub, alpha: 1, duration: 200, hold: 3800, yoyo: true }); };
    const on: [string, (...a: any[]) => void][] = [['stats', onStats], ['coin', onCoin], ['countdown', onCount], ['drift', onDrift], ['radio', onRadio], ['info', onInfo], ['toast', (m: string, c?: string) => toast(m, c)],
      ['nearmiss', (p: number) => toast(`NEAR MISS +${p}`, '#fff')], ['crash', (st: number) => { if (!endless) toast('KAI! WATCH THE ROAD!', RD); else if (st > .5) toast('BIG HIT!', RD); }], ['lap', (l: any) => toast(`LAP ${l.lap}  +${l.bonus}`, GR)]];
    on.forEach(([e, f]) => ev.on(e, f)); this.events.once('shutdown', () => on.forEach(([e, f]) => ev.off(e, f)));
  }
}
