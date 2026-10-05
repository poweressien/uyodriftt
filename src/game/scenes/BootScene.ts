import Phaser from 'phaser';
import { makeTextures } from '../systems/Textures';
import { Renderer3D } from '../render3d/Renderer3D';
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    makeTextures(this); const r3d = new Renderer3D(this.game); this.registry.set('r3d', r3d); this.game.events.once('destroy', () => r3d.dispose());
    const run = this.registry.get('runConfig');
    this.registry.set('touch', { left: false, right: false, brake: false, hand: false });
    this.registry.set('touchMode', (typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches) || /[?&]touch=1/.test(location.search));
    this.scene.start(run?.mode && run.mode !== 'drift' ? 'Endless' : 'Drive', run);
  }
}
