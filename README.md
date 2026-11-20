# VICE HARBOR — The Sunset City

An original, top-down open-world crime game built for the `make.fun` bounty **gta6-01**.
Everything under `game/` is plain static HTML and ES modules; every building, car,
pedestrian, sound and musical note is generated in code. There are no images, audio
files, libraries, build steps or network requests — it plays offline in desktop Chrome.

The city of Vice Harbor is a twelve-by-eight asphalt grid with sidewalks, shops, a
park, a beach, a marina full of boats and a long wooden pier. Drive across it, take
jobs from Frankie Two-Fingers and his crew, and try not to make the whole city chase you.

## Play

```sh
node serve.ts
# open http://127.0.0.1:8080
```

`serve.ts` is a tiny Node 22 standard-library static server for `game/`. You can also
open `game/index.html` directly from disk in a browser that allows local ES modules.
The title screen offers **New Game** and, when a save exists, **Continue**. Progress
is kept in `localStorage` under `vice_harbor_save_v1`.

## Controls

| Key | Action |
| --- | --- |
| `WASD` / arrows | Walk, or drive the car you are in |
| `Shift` | Sprint on foot |
| Mouse | Aim; left click fires (or shoots from the car window) |
| `Space` | Fire on foot; handbrake while driving |
| `E` | Start a job, carjack a car, or exit your car |
| `1` / `2` / `3` | Fists, pistol, SMG (the SMG is unlocked in a mission) |
| `M` | Mute / unmute |
| `Esc` | Pause / resume |

Pickups restore health and armour, refill ammunition, or pay cash. On foot, shootings,
carjackings and running people down raise heat; at the top of the wanted meter you get
five stars and the whole precinct arrives. If your health runs out you wake up at
**Sunset Mercy** (WASTED); if the police catch you on foot you are booked at
**Bay 12 Precinct** (BUSTED). Either way you lose some cash and half your ammo.

## Story

Six linked jobs, free roam in between:

1. **First Shift** — meet Frankie at Mr. Noodle and borrow a car.
2. **Dockside Delivery** — run a depot van out to the end of Sunset Pier against the clock.
3. **Pier Pressure** — clear a rival crew off the pier and collect the crate.
4. **Coral Federal** — crack the bank vault and lose the heat at Casa Cielo.
5. **Hot Wires** — steal the red coupe, survive a city-wide pursuit and reach the safehouse.
6. **Sunset Showdown** — settle things with the rival crew at the marina.

## Hand-in

`shots.json` lists the four screenshot scenes and `main.ts` uses the vendored
`vendor/makefun-game.ts` to build the dossier. To rebuild it:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`shots.json` scenes are set up by `game/src/shots.js` through `?shot=<name>&seed=<n>`:

- `1-cover.jpg` — a four-star downtown chase with traffic, police and the HUD.
- `2-marina.jpg` — the waterfront standoff by the marina and its boats.
- `3-pier.jpg` — the pier mission with armed rivals and the minimap.
- `4-title.jpg` — the title screen over a live render of the city.

## Source layout

`game/src/` contains the hand-written game: `config.js`, `random.js`, `input.js`,
`audio.js`, `city.js`, `cars.js`, `people.js`, `combat.js`, `missions.js`, `world.js`,
`render.js`, `hud.js`, `screens.js`, `shots.js`, `save.js`, `vfx.js` and `main.js`.
The static city is cached to an offscreen canvas; cars, people, effects and the HUD
are redrawn every frame. All audio is synthesised with Web Audio oscillators and
noise buffers, started after the first key press or click.

Licence: MIT (see `LICENSE`).
