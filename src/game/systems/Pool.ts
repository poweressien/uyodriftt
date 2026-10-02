import Phaser from 'phaser';
export class Pool<T extends Phaser.GameObjects.Image> {
  private free: T[] = []; constructor(private make: () => T) {}
  get(): T { const o = this.free.pop() ?? this.make(); o.setActive(true).setVisible(true); return o; }
  release(o: T) { o.setActive(false).setVisible(false); this.free.push(o); }
}
