import Phaser from 'phaser';
import type { District, Decor } from '../data/districts';
import { prop, rng } from './World';
export const LANE = 118, LANES = 4, ROAD_W = LANE * LANES, CH = 1000;
/** Straight, endless highway running up the screen (y gets more negative). Chunks are made ahead of the car and destroyed behind it. */
export class EndlessWorld {
  private chunks = new Map<number, Phaser.GameObjects.GameObject[]>();
  constructor(private s: Phaser.Scene, private d: District) {}
  laneX(i: number) { return (i - (LANES - 1) / 2) * LANE; }
  private make(k: number) {
    const s = this.s, y0 = -(k + 1) * CH, pal = this.d.palette, W = ROAD_W, objs: Phaser.GameObjects.GameObject[] = [], r = rng(k * 7919 + 13);
    const sh = s.add.graphics().setDepth(-3), kb = s.add.graphics().setDepth(-2), rd = s.add.graphics().setDepth(-1), dc = s.add.graphics().setDepth(3); objs.push(sh, kb, rd, dc);
    sh.fillStyle(pal.shoulder, .9).fillRect(-W / 2 - 80, y0, W + 160, CH);
    kb.fillStyle(0xffffff).fillRect(-W / 2 - 16, y0, W + 32, CH).fillStyle(0xff8c1a); for (let y = 0; y < CH; y += 100) kb.fillRect(-W / 2 - 16, y0 + y, 16, 50).fillRect(W / 2, y0 + y, 16, 50);
    rd.fillStyle(pal.road).fillRect(-W / 2, y0, W, CH).fillStyle(0xffffff, .85).fillRect(-W / 2 + 12, y0, 5, CH).fillRect(W / 2 - 17, y0, 5, CH);
    for (let i = 1; i < LANES; i++) for (let y = 0; y < CH; y += 130) rd.fillStyle(0xffffff, .65).fillRect(-W / 2 + i * LANE - 3, y0 + y, 6, 70);
    const wts = Object.entries(this.d.decor) as [Decor, number][], total = wts.reduce((a, [, w]) => a + w, 0), pick = (): Decor => { let x = r() * total; for (const [kk, w] of wts) if ((x -= w) < 0) return kk; return wts[0][0]; };
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) { const kind = pick(), y = y0 + ((i + r()) * CH) / 6, x = side * (W / 2 + (kind === 'lamp' ? 50 : 130 + r() * 280)); prop(dc, kind, x, y, r); }
    if (k === 0) for (let row = 0; row < 2; row++) for (let c = 0; c < W / 20; c++) rd.fillStyle((c + row) % 2 ? 0x111111 : 0xffffff, .95).fillRect(-W / 2 + c * 20, -120 + row * 20, 20, 20);
    if (k % 9 === 4) { // pedestrian bridge: cars pass under it
      const yb = y0 + CH / 2, sh2 = s.add.graphics().setDepth(-0.5), br = s.add.graphics().setDepth(35); sh2.fillStyle(0x000000, .25).fillRect(-W / 2 - 60, yb + 10, W + 120, 34);
      br.fillStyle(0x000000, .3).fillRect(-W / 2 - 74, yb - 16, 16, 44).fillRect(W / 2 + 58, yb - 16, 16, 44); br.fillStyle(0xe8e8e8).fillRect(-W / 2 - 84, yb - 16, W + 168, 32).fillStyle(0xff8c1a).fillRect(-W / 2 - 84, yb - 16, W + 168, 7).fillStyle(0x0f8a45).fillRect(-W / 2 - 84, yb + 9, W + 168, 7);
      const t = s.add.text(0, yb - 1, 'WELCOME TO UYO · AKWA IBOM', { fontFamily: 'Anton, Impact, sans-serif', fontSize: '16px', color: '#0b5a2e' }).setOrigin(.5).setDepth(36); objs.push(sh2, br, t);
    }
    this.chunks.set(k, objs);
  }
  ensure(y: number) {
    const k = Math.floor(-y / CH); for (let i = k - 2; i <= k + 6; i++) if (!this.chunks.has(i)) this.make(i);
    this.chunks.forEach((o, key) => { if (key < k - 3) { o.forEach(x => x.destroy()); this.chunks.delete(key); } });
  }
  get count() { return this.chunks.size; }
}
