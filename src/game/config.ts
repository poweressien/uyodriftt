import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { DriveScene } from './scenes/DriveScene';
import { EndlessScene } from './scenes/EndlessScene';
import { HUDScene } from './scenes/HUDScene';
import type { RunConfig } from './types';
export function createGame(parent: HTMLElement, run: RunConfig) {
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, transparent: true, width: 960, height: 540,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { powerPreference: 'high-performance', antialias: true, roundPixels: false },
    fps: { target: 60 }, input: { activePointers: 4 }, scene: [BootScene, DriveScene, EndlessScene, HUDScene],
  });
  game.registry.set('runConfig', run); return game;
}
