# AEROVANT

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/barongz1/aerovant/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/barongz1/aerovant/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

AEROVANT — original 3D flight game: 3 aircraft with real stats, 5 maps, 4 missions — a make.fun bounty entry.

## The game

A WebGL2 flight simulator that runs fully offline in a desktop browser — no network, no libraries, no external files. Everything (terrain, aircraft, sky, sound) is generated in code.

- **3 aircraft, stats that really matter** — VELTRIX (speed 10, handling 18, accel 12, stability 14: the most agile interceptor), SKYRION (speed 15, handling 12, accel 18, stability 11: the fastest star-jet with blue afterburners), STRATOVEX (speed 12, handling 14, accel 13, stability 18: the most stable delta stealth jet). Top speed, acceleration, roll/pitch rates and stall speed all come from the stats.
- **5 maps, each a different world** — Kepulauan Nusantara (golden-hour islands), Puncak Salju (snow peaks, falling snow), Kawah Api (volcano with a glowing lava sea and embers), Orbit Antariksa (deep space: stars, a giant planet, asteroids, low gravity), Gurun Pasir (golden dunes and an oasis). Each map changes the sky, fog, lighting, terrain, water and particles.
- **4 modes** — Koridor Cincin Udara (5 ring gates, then an ILS landing on RWY 27), Lepas Landas Fajar (night ops with lit runway and PAPI), Jelajah Bebas (free flight), and Pertempuran Angkasa (wave combat against scout, heavy and boss Leviathan aliens — cannon with left click / X, homing missiles with right click / Z, combo scoring).
- **Hangar** — pick your jet on a 3D turntable and preview each map with a flyover camera before launching.
- **Full HUD** — compass, speed/altitude tapes, pitch ladder, radar with sweep, ADI, MFDs (radar, attitude, engine/fuel/hull), throttle, fuel and hull bars, gear/flap/brake/light controls, checklist, terrain warning, and three cameras (chase, cockpit, cinematic).
- **Systems** — fuel burn, hull damage from hard landings, asteroids and enemy fire, stall behaviour, flaps, landing gear, brakes, afterburners, contrails and crash explosions. Procedural Web Audio sound effects (cannon, missile, explosion, hit).

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

Controls: W/S pitch, A/D roll, Q/E rudder, Shift/Ctrl throttle, C camera, G gear, F flap, Space brake, L lights, P pause, R reset, M mission, X cannon, Z missile.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` via the vendored make.fun library. The game itself is plain static files under `game/` — open `game/index.html` in any browser, no build step.
