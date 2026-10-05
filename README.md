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

## v4 changes
- Separate screens: Menu, Play, Garage, Career, Multiplayer, Missions, Achievements, Leaderboard, Ranks, Settings, Quit.
- Settings: independent volumes for car sound, IBOM radio, music and other sounds; steering, camera, name, reset.
- Road types (Roundabout, Highway, City, Market, Estate, Circuit; Endless: Expressway, Dual, Village).
- Smooth procedural engine (`systems/Engine.ts`); ~470 IBOM radio lines.
- Touch: all camera views turn with the car, shaped steering, multi-touch buttons.
- Nigerian roadside buildings (bungalow, face-me-I-face-you, duplex, kiosk, church, plaza, filling station) replace flags/billboards.
- Economy: coins on the road, 11 cars, upgrades, sell car, daily streak, 13 career events, many achievements.
- Multiplayer: challenge links, serverless WebRTC live race (swap two codes; no global lobby).

## v4.2
- Handling retuned (more grip and steering lock at speed, quicker steering ramp): turn radius at 120 km/h went from 83 m to 36 m.
- New turbo-racing UI: dark carbon, electric cyan and hot red, chamfered panels, slanted buttons, Orbitron + Saira type (bundled, works offline).
- Night view of the Ibom Plaza roundabout as the home screen, START button, tabbed Settings, restyled HUD and touch controls.

## v4.3: missions, race modes, gas, shop

- Engine sound is off by default (Settings > Audio to turn it on).
- Race modes (solo or live with a friend): **LGA Journey** (first to the finish, Uyo to Etinan up to Eket to Ikot Abasi), **Elimination** (last place is knocked out every 18 s), **Demolition** (damage rivals, 3 KOs win). Cars have 100 HP; damage cuts power. Prizes by finishing place.
- **Gas**: 7 bars, 1 per run or race. At 0 it refills after 3 h (90 min with Turbo Pass) or watch an ad for +1.
- **Revive** a wrecked car with coins or by watching an ad (max 3 ads per run).
- **Upgrades** with coins and parts; levels 1 to 3 can be free via ad.
- **Missions** daily and weekly, claim x2 with an ad.
- **Shop**: coin packs, Full Tank, Turbo Pass, Style Pack, premium cars (S-Class, Escalade), free coins via ads.
- Live race **room codes** (5 letters) when the API has Upstash configured; otherwise the copy/paste codes still work.

### Monetization setup (do this before going live)

1. Copy `.env.example` values into Vercel project env vars. Rebuild after changing any `VITE_` value.
2. **Payments**: create a Paystack account, set `VITE_PAYSTACK_KEY` (public) and `PAYSTACK_SECRET_KEY` (server). Every purchase is verified by `/api/verify` (status, NGN, amount, product) before anything is granted. Unconfirmed payments are retried on next launch.
3. **Replay protection**: add an Upstash Redis (`UPSTASH_REDIS_REST_URL/TOKEN`). Without it a payment reference can be reused. Same Upstash also powers room codes.
4. **Ads, web**: AdSense for Games / H5 rewarded ads needs an approved account; set `VITE_ADS_MODE=adsense` and `VITE_ADSENSE_CLIENT`. Use `VITE_ADSENSE_TEST=1` while testing.
5. **Ads, Android**: wrap with Capacitor, add an AdMob plugin, set `VITE_ADS_MODE=admob` and the rewarded unit id. Use test ids first.
6. With `VITE_ADS_MODE=none` in production the ad buttons are disabled and nothing is given free. `mock` is for testing only; never ship it.
7. Prices live in `src/monetize/products.ts` and `api/_products.js`. Change both together (server prices are in kobo).

Honest limits: progress lives in the player's browser, so a determined cheater can edit local coins. Paid items are protected by server verification, but there are no accounts, so purchases do not follow a player to another device.

## v4.4: cars, upgrades, drift, menu

- **Menu** now leads with the six ways to play: Challenge, Online Race, Friend Link, Classic, Endless, Career. Garage, Shop, Missions, Trophies, Ranks, Board, Settings and Quit are in the small dock.
- **New roster** (27 cars, each with its own 3D body, top-view size and wheelbase): Keke NAPEP, Danfo Bus, Toyota HiAce Mini Bus, Toyota Hilux, Nissan Altima / Patrol / 350Z, BMW 330i / M4, Chevrolet Tahoe / Camaro SS, Lexus LX 570, Luxury Coach, plus the earlier Toyota, Lexus, Mercedes, Range Rover and the two premium cars. Bodies: sedan, coupe, SUV, pickup, minibus, coach, keke.
- **Upgrades now do something you can feel.** Before, engine and turbo power was cancelled by the drag calculation, so top speed never changed. Now every level changes the physics (engine +10% power, tyres +7% grip, brakes +10% braking, steering +7% lock, transmission +3% top speed and faster shifts, suspension steadier body and less crash damage, turbo power plus wheelspin kick). The Garage shows the measured numbers (top speed, 0 to 100, 100 to 0, grip, steering lock) with the change from stock, and each purchase pops up exactly what it changed. Measured with the real physics model: a Corolla at all level 5 goes from 186 to 241 km/h, 3.7 to 2.4 s to 100, and 30 m to 20 m braking.
- **Drift feel**: tyre model retuned so a car holds a slide at 25 to 30 degrees with the throttle, keeps most of its speed through the drift, and recovers cleanly. Light rear-drive coupes (350Z, M4, Camaro) slide easily; the keke spins on a coin; the coach and the danfo are heavy and slow to rotate.
