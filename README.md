# VICE HARBOR

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aangrohim-cell/gta6-01-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aangrohim-cell/gta6-01-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete open-world crime game in the spirit of GTA, built for make.fun's “Make GTA 6” bounty (gta6-01). It runs offline in a desktop browser from plain static files: a top-down sunset city of sixteen blocks, on foot and behind the wheel.

![VICE HARBOR](screenshots/1-cover.jpg)

## What is in the city

- **A whole city, not a level:** sixteen blocks of downtown, Calle Ocho, motels, bodegas, a marina, a beach and a pier, with traffic, pedestrians, palms, rooftop billboards and a sunset shoreline. The HUD names the neighbourhood you are in.
- **On foot and by car:** walk, sprint, carjack, drive with a handbrake, watch the car take damage and sound the horn. A minimap, speedometer strip, car-name chip and radio ride along. Sirens wash the asphalt red and blue before a cruiser reaches you.
- **A wanted level and police:** crimes raise the heat from one to five stars; cruisers spawn, sirens close in, officers deploy and give chase, and the stars cool off when you disappear. An officer who stays too close on foot BUSTS you; going down wakes you at Mercy General.
- **Combat and loot:** fists, a pistol and an SMG, with muzzle flashes, tracers, impacts, blood, explosions, smoke and bodies that stay down. Cash, ammo, health and armor drop around the city; armor soaks most of the next hit and draws a blue ring under your feet.
- **A six-job story from Dex:** steal the cherry Torero, shake down three debtors, lose a two-star tail, survive a double-cross at the pier, wipe out a cartel crew, and finish it at the Mendez mansion.
- **A start screen and a save:** continue from `localStorage`, autosave every 20 seconds, quick-save with `F5`, pause screen with stats, eight mixtapes to find, and service markers for the garage, hospital, gun shop and spray shop.

## Controls

| Input | Action |
| --- | --- |
| `WASD` | walk / drive / steer |
| Mouse | aim; left click to shoot |
| `E` | get in / out of a car, interact, start a job, advance dialogue |
| `Shift` | sprint |
| `Space` | handbrake in a car; advance dialogue |
| `1` `2` `3` | fists / pistol / SMG |
| `R` | reload |
| `H` | sound the horn while driving |
| `F5` | save progress instantly (outside a job) |
| `P` / `Esc` | pause |
| `M` | mute sound |
| `Enter` / `Space` | start, continue, get up from WASTED/BUSTED |

Progress is saved when a job finishes, a purchase is made, a mixtape is found, the tab is hidden, the game is paused or `F5` is pressed. The slot records the city seed, so CONTINUE rebuilds the same streets you left. Every field is validated when written and when read, so a truncated or hand-edited slot will not crash the title screen.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The server only serves files from `game/`; there is no build step, no bundler and no dependency to install. Use a desktop Chrome or Chromium with JavaScript and Web Audio enabled. The city is deterministic for a given seed:

```text
http://localhost:8080/?seed=20260417
```

Hand in the entry (the same program the grader runs):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` checks the file count, path lengths, screenshot names, dimensions and sizes, rejects any network reference inside `game/`, copies `game/` and `screenshots/` to the output directory, then writes `dossier.json`. It prints a short summary and exits non-zero if the entry would be refused. The game itself loads nothing from the network: no libraries, fonts, images or data leave the folder.

## Screenshots

The four images in `screenshots/` are real 1280×720 browser renders, staged by the game's `?shot=` mode and captured with Playwright:

1. `1-cover.jpg` — `?shot=cover&seed=20260417`: a three-star downtown chase with the Torero, cruisers, wreck smoke, traffic, gunfire, pickups, mission objective and the full HUD.
2. `2-marina.jpg` — `?shot=street&seed=20260417`: on foot at the marina with the cherry Torero, a patrol cruiser, the beach crowd and the pier.
3. `3-pier.jpg` — `?shot=mission&seed=20260417`: a pier firefight with SMG tracers, Vic's crew, dialogue, wanted level and minimap.
4. `4-title.jpg` — `?shot=title&seed=20260417`: the sunset title screen with a saved game and the field manual.

The first image by name is the cover. Each shot uses the same renderer, city generator and HUD as normal play; only the starting positions are staged.

## Under the hood

`game/src/` is a small set of ES modules with no dependencies:

| Module | Job |
| --- | --- |
| `config.js` / `random.js` | tuning constants, seeded RNG and small math helpers |
| `city.js` | blocks, buildings, landmarks, collision and neighbourhood lookup |
| `world.js` | player, wanted level, pickups, damage and the fixed-step simulation |
| `cars.js` / `people.js` | traffic, parking, police, crowds and factions |
| `combat.js` | hit-scan weapons, explosions and pooled effects |
| `missions.js` | the six-job story and its markers |
| `render.js` / `hud.js` / `screens.js` | canvas world, interface, and title/pause/end cards |
| `audio.js` | synthetic Web Audio soundtrack, sirens, horns and impacts |
| `input.js` / `save.js` / `vfx.js` | keyboard and mouse, validated save slot, shared timing helpers |
| `main.js` / `shots.js` | boot loop, camera, and the staged screenshot scenes |

`vendor/makefun-game.ts` is the untouched dossier builder supplied by make.fun; `main.ts` only validates the entry and calls it.

## License

MIT — see [LICENSE](LICENSE).
