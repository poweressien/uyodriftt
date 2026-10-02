# UYO DRIFT
Arcade drifting game set in Uyo, Akwa Ibom. React + TypeScript + Vite + Phaser 3.
No backend, no login: everything saves on the player's device (localStorage).

## Run
```
npm install
npm run dev          # http://localhost:5173 (also reachable from your phone on the same Wi-Fi: use the Network URL it prints)
```
Needs internet once for Google Fonts (falls back to system fonts offline).

## What's new in v3
- **Behind-the-car 3D camera (Turbo-Racing style)**: a real three.js 3D view that sits behind Phaser's transparent canvas. Close chase camera, FOV widens with speed, body pitch/roll, spinning and steering wheels, brake lights, night/rain headlights, rain streaks, fog, sky. Works in Endless and Drift Run. Press **C** or tap **CAM** to cycle Behind (default) / Top / Chase / Wide / Hood.
- **Real vehicle physics** (`src/game/systems/CarPhysics.ts`): single-track tyre model with slip-angle curves, friction circle, weight transfer, RWD power curve with auto gearbox, wheelspin, brake bias, locking handbrake, drag + rolling resistance, off-road grip loss, and crash yaw. Each car's stats become kg / W / tyre mu / steering lock; top speed is solved from power vs drag.
- **Premium menu**: cinematic dusk skyline, neon grid road, 3D showroom car (drag to rotate), minimal glass controls. The Garage uses the same 3D showroom.
- **Ibom FM**: ~200 pidgin lines across 25 topics (crashes, near misses, drifts, rain, night, potholes, cones, floods, km, revive, game over...). Lines never repeat until the topic is exhausted; uses a Nigerian English voice if the device has one.
- 3D models are generated in code (no model files): `src/game/render3d/`.

## v2 features
- **Real collisions**: oriented-box physics against traffic (bounce, spin, shove, damage smoke, sparks, glass, screen shake, phone vibration). Cones get knocked flying; traffic cars you hit spin out and smoke.
- **4 camera views**: Top, Chase (rotates with the car), Wide, Hood. Press **C** or tap **CAM** during a run. Choice is remembered.
- **Mobile steering**: pick **Arrows** (on-screen < >) or **Tilt** (phone as a steering wheel; tap the tilt box to re-centre) in Settings or the pause menu. iOS asks for motion permission on first use.
- **Audio**: procedural engine (gears, turbo whine, backfire), tyre screech, wind, rain, crashes, countdown beeps, and a generative Afrobeats-style music loop (menu / drive / endless). Music and SFX toggles in Settings and pause menu. **M** mutes all.
- **Redesigned car art**: shaded body, glass panes, lights, grille, mirrors, gloss, brake lights, rims. Paint, wheels, decals and tint still apply.
- **Endless Drive** (menu: mode chips above DRIVE): a dead-straight, never-ending 4-lane road with traffic that changes lanes. Hit **5 cars** and it is game over: **Revive** (300 coins, doubling each use), **Restart** or **Main menu**. Score = metres + drift points + near-miss streaks + 500 per km. Runs bank coins, XP and achievements.

## Controls
Keyboard: W/Up throttle, S/Down brake/reverse, A/D or arrows steer, SPACE (or Shift) handbrake = drift, C change camera, H horn, M mute, Esc/P pause. Game over: Enter revive, R restart, Esc menu.
Touch: auto-throttle. Arrows or Tilt steering, BRAKE, DRIFT (handbrake), CAM. Preview touch controls on desktop with `?touch=1`.

## Deploy
`npm run build` -> upload `dist/` to Vercel / Netlify / any static host.

## Code map
- `src/game/systems/CarPhysics.ts`  handling model (pure, testable)
- `src/game/systems/World.ts`       road, kerbs, decor, landmarks (chunked so only nearby cells render)
- `src/game/scenes/`                Boot, Drive (loop), Endless (straight road), HUD
- `src/game/systems/`               also: Collision, CameraRig, Controls (tilt), Audio (sfx + music), ImpactFx, Hazards
- `src/game/data/`                  districts, layouts, vehicles, ranks/achievements/missions
- `src/state/store.ts`              save data + all progression rules
- `src/ui/`                         menus (React)
