import Phaser from 'phaser';
import { VIEWS, VIEW_LABEL, View } from '../data/settings';

interface Preset { zoom: number; drop: number; rotate: boolean; shift: number; look: number }
/** top = classic north-up follow, chase = camera turns with the car, wide = pulled-back overview, hood = low close chase. */
const PRESETS: Record<View, Preset> = {
  behind: { zoom: 1.12, drop: .26, rotate: true, shift: 135, look: 0 },
  top: { zoom: 1.3, drop: .34, rotate: false, shift: 0, look: .28 },
  chase: { zoom: 1.12, drop: .26, rotate: true, shift: 135, look: 0 },
  wide: { zoom: .8, drop: .2, rotate: false, shift: 0, look: .34 },
  hood: { zoom: 1.7, drop: .5, rotate: true, shift: 150, look: 0 },
};
export interface ViewRect { x: number; y: number; right: number; bottom: number }

/** Owns the main camera: smooth zoom, optional rotation with the car, look-ahead. Replaces startFollow. */
export class CameraRig {
  view: View = 'top'; private rot = 0; private zoom = 1.3; private lx = 0; private ly = 0; private cx = 0; private cy = 0;
  constructor(private cam: Phaser.Cameras.Scene2D.Camera, private o: { zoomMul?: number; lookMul?: number } = {}) {
    cam.disableCull = true; // Phaser's cull test is not rotation-safe; our object counts are small
  }
  setView(v: View) { this.view = v; }
  next(): View { this.view = VIEWS[(VIEWS.indexOf(this.view) + 1) % VIEWS.length]; return this.view; }
  label() { return VIEW_LABEL[this.view]; }
  snap(x: number, y: number, heading: number) {
    const p = PRESETS[this.view]; this.rot = p.rotate ? -Math.PI / 2 - heading : 0; this.zoom = p.zoom * (this.o.zoomMul ?? 1); this.lx = this.ly = 0; this.apply(x, y);
  }
  update(dt: number, x: number, y: number, heading: number, vx: number, vy: number, speedRatio: number) {
    const p = PRESETS[this.view], k = (r: number) => Math.min(1, dt * r), la = Math.min(1, speedRatio);
    this.rot += Phaser.Math.Angle.Wrap((p.rotate ? -Math.PI / 2 - heading : 0) - this.rot) * k(3.4);
    this.zoom += ((p.zoom - p.drop * la * p.zoom) * (this.o.zoomMul ?? 1) - this.zoom) * k(2.2);
    if (p.rotate) { // push the car towards the bottom of the screen so the road ahead is visible
      const s = (p.shift + la * 70) / this.zoom; this.lx = -Math.sin(this.rot) * s; this.ly = -Math.cos(this.rot) * s;
    } else {
      const m = p.look * (this.o.lookMul ?? 1); this.lx += (vx * m - this.lx) * k(2.5); this.ly += (vy * m - this.ly) * k(2.5);
    }
    this.apply(x, y);
  }
  private apply(x: number, y: number) {
    this.cx = x + this.lx; this.cy = y + this.ly;
    this.cam.setRotation(this.rot); this.cam.setZoom(this.zoom); this.cam.centerOn(this.cx, this.cy);
  }
  /** Axis-aligned box that contains everything visible (safe for rotated views). */
  bounds(): ViewRect {
    const r = Math.hypot(this.cam.width, this.cam.height) / 2 / this.zoom;
    return { x: this.cx - r, y: this.cy - r, right: this.cx + r, bottom: this.cy + r };
  }
  get centerX() { return this.cx; } get centerY() { return this.cy; } get radius() { return Math.hypot(this.cam.width, this.cam.height) / 2 / this.zoom; }
}
