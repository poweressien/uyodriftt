import Phaser from 'phaser';
/** Coins on the road. A fixed pool of images (2D view) plus plain data the 3D view can draw. Collected coins stay hidden until `reset` or `respawnNear` brings them back. */
export interface Coin { x: number; y: number; on: boolean; img: Phaser.GameObjects.Image; away: number }
export const COIN_VALUE = 10, COIN_RADIUS = 40;
export class CoinField {
  list: Coin[] = [];
  constructor(private s: Phaser.Scene, count: number) {
    for (let i = 0; i < count; i++) this.list.push({ x: 0, y: 0, on: false, away: 0, img: s.add.image(0, 0, 'coin').setDepth(6).setVisible(false).setScale(.9) });
  }
  /** Puts a coin at (x, y) using a free slot. Returns false when the pool is full. */
  place(x: number, y: number): boolean { const c = this.list.find(o => !o.on); if (!c) return false; c.x = x; c.y = y; c.on = true; c.away = 0; c.img.setPosition(x, y).setVisible(true); return true; }
  remove(c: Coin) { c.on = false; c.img.setVisible(false); }
  clear() { this.list.forEach(c => this.remove(c)); }
  /** Collects every coin within `r` of the car; calls back once per coin. */
  collect(px: number, py: number, r: number, cb: (c: Coin) => void) { for (const c of this.list) if (c.on && (c.x - px) ** 2 + (c.y - py) ** 2 < r * r) { this.remove(c); cb(c); } }
  /** Gentle spin/bob so coins catch the eye. */
  animate(timeMs: number) { const k = timeMs / 1000; this.list.forEach((c, i) => { if (c.on) c.img.setScale(.78 + .14 * Math.abs(Math.sin(k * 4 + i))); }); }
  /** Active coins as plain points for the 3D renderer. */
  points(px: number, py: number, range = 2600): { x: number; y: number }[] { const out: { x: number; y: number }[] = []; for (const c of this.list) if (c.on && Math.abs(c.x - px) < range && Math.abs(c.y - py) < range) out.push(c); return out; }
}
