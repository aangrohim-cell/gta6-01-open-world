// The running world: the player, the wanted level, pickups, the camera shake, the toast and
// subtitle queues, and the update order that drives the traffic, the people and the combat.
//
// The world is browser-free and render-free. main.js feeds it controls, missions.js pushes
// objectives into its marker list, and render.js reads its state.

import { CITY, FOOT, PLAYER, STEP, WANTED, WEAPONS } from './config.js';
import { angleDelta, clamp, createRandom, distance, lerp } from './random.js';
import { createCombat } from './combat.js';
import { createCars } from './cars.js';
import { createPeople } from './people.js';

const RADIO = ['VICE FM 98.6', 'SUNSET 104.2', 'COAST LINE RADIO', 'WAVE 89.1', 'PALM TALK 101'];

export function createWorld(city, audio, seed) {
  const random = createRandom(seed ^ 0x51ed270b);
  const effects = { tracers: [], particles: [], decals: [], flashes: [], rings: [] };

  const player = {
    x: 2600, y: 4800, angle: -Math.PI / 2,
    vx: 0, vy: 0,
    health: PLAYER.maxHealth, armor: 0,
    money: 750,
    weapon: 'pistol',
    mag: { pistol: WEAPONS.pistol.mag, smg: 0 },
    reserve: { pistol: 48, smg: 0 },
    inCar: null,
    invulnerable: 0,
    dead: false,
    walkPhase: 0,
    run: 0,
    aimAngle: 0,
    fireCooldown: 0,
    reloadTimer: 0,
    lastHitBy: null,
  };

  const state = {
    time: 0,
    heat: 0,
    lastCrime: -99,
    copSpawnTimer: 0,
    wantedFlash: 0,
    wasted: 0,
    busted: 0,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    toasts: [],
    dialog: null,
    markers: [],
    objective: null,
    prompt: '',
    radio: '',
    radioTimer: 0,
    tapes: 0,
    kills: 0,
    copKills: 0,
    missionsDone: 0,
    shotsFired: 0,
    distanceDriven: 0,
    startedAt: 0,
    lastVitals: 0,
    serviceCooldown: 0,
    sirenPulse: 0,
    hint: '',
    missionPrompt: '',
    banner: null,
    storyComplete: false,
  };

  const world = {
    city, audio, random, effects, player, state,
    peds: null, men: null, cars: null, combat: null,
    time: 0,
    nearestOfficer: 9999,
    nearestCopCar: null,
    playerCar: null,
    onEvent: null,
  };

  /* ------------------------------------------------------------------ messaging */

  world.notify = function notify(text, color = '#f6f1e6', life = 2.6) {
    state.toasts.push({ text, color, life, max: life });
    if (state.toasts.length > 5) state.toasts.shift();
  };

  world.showDialog = function showDialog(lines) {
    state.dialog = { lines: lines.slice(), index: 0, timer: 0, revealed: 0 };
  };

  world.advanceDialog = function advanceDialog() {
    if (!state.dialog) return false;
    state.dialog.index += 1;
    state.dialog.timer = 0;
    state.dialog.revealed = 0;
    if (state.dialog.index >= state.dialog.lines.length) state.dialog = null;
    return true;
  };

  world.setMarkers = function setMarkers(markers) {
    state.markers = markers;
  };

  world.setObjective = function setObjective(objective) {
    state.objective = objective;
  };

  world.showBanner = function showBanner(title, subtitle, color = '#ffcf5c', life = 4.2) {
    state.banner = { title, subtitle, color, life, max: life };
  };

  /* ------------------------------------------------------------------ wanted */

  world.addWanted = function addWanted(amount, reason) {
    state.heat = clamp(state.heat + amount, 0, WANTED.max);
    state.lastCrime = state.time;
    state.wantedFlash = 0.8;
    if (reason) world.notify(reason, '#ffcf5c', 1.8);
    if (amount >= 0.8) world.audio.sirenBlip();
  };

  world.setHeat = function setHeat(value) {
    state.heat = clamp(value, 0, WANTED.max);
    state.lastCrime = state.time;
    state.wantedFlash = 0.6;
  };

  world.clearWanted = function clearWanted() {
    state.heat = 0;
    state.wantedFlash = 0;
  };

  world.stars = function stars() {
    return Math.max(0, Math.min(WANTED.max, Math.ceil(state.heat - 0.001)));
  };

  /* ------------------------------------------------------------------ player hurt and death */

  world.damagePlayer = function damagePlayer(amount, source) {
    if (player.dead || state.wasted > 0 || state.busted > 0) return;
    if (player.invulnerable > 0) return;
    player.invulnerable = PLAYER.hurtInvulnerable;
    let left = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, left * 0.62);
      player.armor -= absorbed;
      left -= absorbed;
      state.shake = Math.max(state.shake, 2.2);
    }
    player.health = Math.max(0, player.health - left);
    state.shake = Math.max(state.shake, 4.2);
    player.lastHitBy = source;
    world.audio.hit();
    if (player.health <= 0) world.wasted();
  };

  world.wasted = function wasted() {
    if (player.dead) return;
    player.dead = true;
    state.wasted = 3.4;
    state.dialog = null;
    state.heat = 0;
    state.objective = null;
    world.audio.wasted();
    world.emit('wasted');
    if (player.inCar) {
      const car = player.inCar;
      world.cars.forceExit();
      world.combat.explodeCar(car, false);
    }
  };

  world.busted = function busted() {
    if (player.dead) return;
    player.dead = true;
    state.busted = 3.2;
    state.dialog = null;
    state.heat = 0;
    state.objective = null;
    world.audio.fail();
    world.emit('busted');
    if (player.inCar) world.cars.forceExit();
  };

  world.respawn = function respawn(kind) {
    player.dead = false;
    player.health = PLAYER.respawnHealth;
    player.armor = 0;
    player.vx = 0;
    player.vy = 0;
    player.weapon = 'pistol';
    player.mag = { pistol: WEAPONS.pistol.mag, smg: 0 };
    player.reserve = { pistol: 24, smg: 0 };
    player.invulnerable = 2;
    player.fireCooldown = 0;
    player.reloadTimer = 0;
    const site = kind === 'busted' ? { x: 3430, y: 3880 } : city.storySites.hospital;
    player.x = site.x;
    player.y = site.y;
    player.angle = 0;
    player.money = Math.max(0, player.money - (kind === 'busted' ? 150 : 200));
    state.wasted = 0;
    state.busted = 0;
    world.clearWanted();
    world.notify(kind === 'busted' ? 'Busted. The cops took your guns.' : 'Patched up at Mercy General.', '#f6f1e6', 3);
    world.emit('respawn', { kind });
  };

  world.emit = function emit(type, data) {
    if (world.onEvent) world.onEvent(type, data);
  };

  /* ------------------------------------------------------------------ pickups */

  world.pickups = [];

  world.addPickup = function addPickup(type, x, y, value, extra = {}) {
    world.pickups.push({ type, x, y, value, life: extra.life ?? 60, bob: random() * 6.28, ...extra });
    if (world.pickups.length > 120) world.pickups.shift();
  };

  function collectPickups(dt) {
    for (let index = world.pickups.length - 1; index >= 0; index -= 1) {
      const item = world.pickups[index];
      item.life -= dt;
      item.bob += dt * 4;
      const px = player.inCar ? player.inCar.x : player.x;
      const py = player.inCar ? player.inCar.y : player.y;
      const reach = player.inCar ? 34 : 24;
      const near = distance(px, py, item.x, item.y) < reach;
      if (near) {
        if (item.type === 'cash') {
          player.money += item.value;
          world.audio.cash();
          world.notify(`+$${item.value}`, '#9fe870', 1.8);
        } else if (item.type === 'health') {
          player.health = Math.min(PLAYER.maxHealth, player.health + item.value);
          world.audio.pickup();
          world.notify(`+${item.value} HEALTH`, '#ff8a8a', 1.8);
        } else if (item.type === 'armor') {
          player.armor = Math.min(PLAYER.maxArmor, player.armor + item.value);
          world.audio.pickup();
          world.notify('ARMOR PICKED UP', '#8fb8ff', 1.8);
        } else if (item.type === 'ammo') {
          player.reserve.pistol += item.value;
          world.audio.pickup();
          world.notify(`+${item.value} PISTOL AMMO`, '#ffcf5c', 1.8);
        }
        world.pickups.splice(index, 1);
        continue;
      }
      if (item.life <= 0) world.pickups.splice(index, 1);
    }
    // The eight hidden mixtapes.
    for (const tape of city.tapes) {
      if (tape.taken) continue;
      if (distance(player.x, player.y, tape.x, tape.y) < 34) {
        tape.taken = true;
        state.tapes += 1;
        player.money += 500;
        world.notify(`MIXTAPE ${state.tapes}/8  +$500`, '#ff9de2', 3);
        world.audio.mission();
        world.emit('tape', { index: tape.index, total: state.tapes });
      }
    }
  }

  /* ------------------------------------------------------------------ player on foot */

  function moveOnFoot(dt, controls) {
    let mx = controls.moveX;
    let my = controls.moveY;
    const length = Math.hypot(mx, my);
    if (length > 1) { mx /= length; my /= length; }
    const sprint = controls.run && length > 0.1;
    const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const targetVx = mx * speed;
    const targetVy = my * speed;
    const blend = Math.min(1, (sprint ? 12 : 14) * dt);
    player.vx = lerp(player.vx, targetVx, blend);
    player.vy = lerp(player.vy, targetVy, blend);
    if (length < 0.05) {
      player.vx = lerp(player.vx, 0, Math.min(1, 16 * dt));
      player.vy = lerp(player.vy, 0, Math.min(1, 16 * dt));
    }
    const stepX = player.vx * dt;
    const stepY = player.vy * dt;
    if (!city.solidAt(player.x + stepX, player.y, PLAYER.radius)) player.x += stepX;
    else player.vx *= -0.1;
    if (!city.solidAt(player.x, player.y + stepY, PLAYER.radius)) player.y += stepY;
    else player.vy *= -0.1;
    player.run = Math.hypot(player.vx, player.vy);
    player.walkPhase += dt * (4 + player.run * 0.035);
    player.angle = player.aimAngle;
  }

  /* ------------------------------------------------------------------ interaction */

  world.nearestCar = function nearestCar(range = FOOT.enterRange) {
    let best = null;
    let bestDistance = range;
    for (const car of world.cars.list) {
      if (car.kind === 'wreck' || car === player.inCar) continue;
      const d = distance(player.x, player.y, car.x, car.y);
      if (d < bestDistance) { bestDistance = d; best = car; }
    }
    return best;
  };

  world.nearestService = function nearestService() {
    let best = null;
    let bestDistance = 72;
    for (const service of city.services) {
      const d = distance(player.x, player.y, service.x, service.y);
      if (d < bestDistance) { bestDistance = d; best = service; }
    }
    return best;
  };

  function serviceCost(service) {
    if (service.id === 'gunshop') return 350;
    if (service.id === 'hospital') return 150;
    if (service.id === 'spray') return 500;
    return 0;
  }

  function useService(service) {
    const cost = serviceCost(service);
    if (service.id === 'garage') {
      world.notify("Dex's Garage: come back when you have work.", '#ffcf5c', 2.2);
      return;
    }
    if (player.money < cost) {
      world.notify(`Need $${cost} for ${service.name}.`, '#ff8a8a', 2);
      world.audio.uiBack();
      return;
    }
    if (service.id === 'hospital' && player.health >= PLAYER.maxHealth) {
      world.notify('You are already patched up.', '#f6f1e6', 1.8);
      return;
    }
    if (service.id === 'spray' && state.heat <= 0) {
      world.notify('Nothing to respray. You are clean.', '#f6f1e6', 1.8);
      return;
    }
    player.money -= cost;
    if (service.id === 'gunshop') {
      player.reserve.pistol += 60;
      player.reserve.smg += 60;
      world.notify('AMMO NATION: +60 pistol, +60 SMG', '#ffcf5c', 2.4);
    } else if (service.id === 'hospital') {
      player.health = PLAYER.maxHealth;
      world.notify('PATCHED UP. $150.', '#ff8a8a', 2.4);
    } else if (service.id === 'spray') {
      world.clearWanted();
      world.notify('RESPRAYED. The heat is off.', '#63e6d2', 2.6);
    }
    world.audio.cash();
    world.emit('service', { id: service.id });
  }

  function interact() {
    if (player.inCar) {
      world.cars.exitCar();
      return;
    }
    const car = world.nearestCar(FOOT.enterRange);
    if (car) {
      world.cars.enterCar(car);
      return;
    }
    const service = world.nearestService();
    if (service) {
      useService(service);
      return;
    }
    world.notify('Nothing here.', '#b9b0a1', 1.2);
  }

  world.interact = interact;

  /* ------------------------------------------------------------------ update */

  function updateDialog(dt) {
    const dialog = state.dialog;
    if (!dialog) return;
    dialog.timer += dt;
    const line = dialog.lines[dialog.index];
    dialog.revealed = Math.min(line.text.length, dialog.revealed + dt * 78);
    if (dialog.timer > 5.5 + line.text.length * 0.022) {
      world.advanceDialog();
    }
  }

  function updateWanted(dt) {
    if (state.heat <= 0) return;
    if (state.wasted > 0 || state.busted > 0) return;
    if (state.time - state.lastCrime > WANTED.coolDelay && world.nearestOfficer > WANTED.unseenDistance) {
      const before = world.stars();
      state.heat = Math.max(0, state.heat - dt / WANTED.coolPerStar);
      if (world.stars() < before) {
        world.notify('You lost a star.', '#b9b0a1', 1.6);
      }
    }
    state.wantedFlash = Math.max(0, state.wantedFlash - dt);
  }

  function updatePolicePresence(dt) {
    let nearest = 9999;
    for (const car of world.cars.list) {
      if (car.kind === 'cop') nearest = Math.min(nearest, distance(player.x, player.y, car.x, car.y));
    }
    for (const man of world.men.list) {
      if (man.faction === 'cop' && !man.dead) nearest = Math.min(nearest, distance(player.x, player.y, man.x, man.y));
    }
    world.nearestOfficer = nearest;
    if (state.heat > 0 && state.wasted <= 0 && state.busted <= 0) {
      state.copSpawnTimer -= dt;
      const wantedCars = Math.min(8, 1 + Math.floor(state.heat * 1.5));
      if (state.copSpawnTimer <= 0 && world.cars.copCount() < wantedCars) {
        world.cars.spawnPoliceCar();
        state.copSpawnTimer = WANTED.spawnInterval;
      }
    }
    if (state.heat > 0.15) {
      world.audio.setSiren(Math.max(0, 1 - nearest / 900));
      state.sirenPulse -= dt;
      if (state.sirenPulse <= 0 && nearest < 700) {
        state.sirenPulse = 0.55;
        world.audio.sirenBlip();
      }
    } else {
      world.audio.setSiren(0);
    }
  }

  function checkBusted(dt) {
    if (state.heat <= 0 || player.inCar || player.dead) {
      world.bustTimer = 0;
      return;
    }
    if (world.nearestOfficer < 62) {
      world.bustTimer = (world.bustTimer ?? 0) + dt;
      state.hint = 'POLICE ARE ON YOU — MOVE!';
      if (world.bustTimer > 1.7) world.busted();
    } else {
      world.bustTimer = 0;
    }
  }

  function updateToasts(dt) {
    for (let index = state.toasts.length - 1; index >= 0; index -= 1) {
      state.toasts[index].life -= dt;
      if (state.toasts[index].life <= 0) state.toasts.splice(index, 1);
    }
    if (state.radioTimer > 0) state.radioTimer -= dt;
    if (state.banner) {
      state.banner.life -= dt;
      if (state.banner.life <= 0) state.banner = null;
    }
  }

  function updatePrompt() {
    state.hint = '';
    if (state.wasted > 0 || state.busted > 0) {
      state.prompt = '';
      return;
    }
    if (player.inCar) {
      state.prompt = 'E  GET OUT';
      return;
    }
    const car = world.nearestCar(FOOT.enterRange);
    if (car) {
      state.prompt = car.kind === 'traffic' || car.kind === 'cop' ? 'E  CARJACK' : 'E  GET IN';
      return;
    }
    const service = world.nearestService();
    if (service) {
      const cost = serviceCost(service);
      state.prompt = cost > 0 ? `E  ${service.name.toUpperCase()} — $${cost}` : `E  ${service.name.toUpperCase()}`;
      return;
    }
    state.prompt = '';
  }

  world.update = function update(dt, controls) {
    state.time += dt;
    state.serviceCooldown = Math.max(0, state.serviceCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    // A reload that never counted down left the HUD ring stuck and locked the weapon forever.
    const wasReloading = player.reloadTimer > 0;
    player.reloadTimer = Math.max(0, player.reloadTimer - dt);
    if (wasReloading && player.reloadTimer === 0) world.audio.reload();

    updateToasts(dt);
    updateDialog(dt);

    if (state.wasted > 0) {
      state.wasted -= dt;
      world.cars.update(dt, controls, true);
      world.people.update(dt, controls, true);
      world.combat.update(dt);
      updatePolicePresence(dt);
      state.shake = Math.max(0, state.shake - dt * 8);
      if (state.wasted <= 0) world.respawn('wasted');
      return;
    }
    if (state.busted > 0) {
      state.busted -= dt;
      world.cars.update(dt, controls, true);
      world.people.update(dt, controls, true);
      world.combat.update(dt);
      updatePolicePresence(dt);
      if (state.busted <= 0) world.respawn('busted');
      return;
    }

    // Aiming: while on foot the body always faces the mouse; in a car the gun does.
    player.aimAngle = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);
    if (player.inCar) {
      player.x = player.inCar.x;
      player.y = player.inCar.y;
    } else {
      moveOnFoot(dt, controls);
    }

    if (controls.enterPressed) interact();
    if (controls.weaponSlot) world.selectWeapon(controls.weaponSlot);
    if (controls.reloadPressed) world.reload();
    if (controls.fire) world.tryFire(controls.aimX, controls.aimY);

    world.cars.update(dt, controls, false);
    world.people.update(dt, controls, false);
    world.combat.update(dt);
    collectPickups(dt);
    updatePolicePresence(dt);
    updateWanted(dt);
    checkBusted(dt);
    updatePrompt();

    // A periodic tiny health trickle keeps a careful player alive; it stops while being shot.
    if (state.time - state.lastVitals > 1 && world.nearestOfficer > 420 && player.health < 55) {
      state.lastVitals = state.time;
      player.health = Math.min(PLAYER.maxHealth, player.health + 2);
    }

    state.shake = Math.max(0, state.shake - dt * 9);
    const shake = state.shake + Math.min(3.6, player.inCar ? Math.hypot(player.inCar.vx, player.inCar.vy) / 260 : 0);
    const t = state.time * 46;
    state.shakeX = (Math.sin(t) + Math.sin(t * 1.7)) * 0.5 * shake * 0.6;
    state.shakeY = (Math.cos(t * 1.3) + Math.sin(t * 2.1)) * 0.5 * shake * 0.6;

    const engineSpeed = player.inCar ? Math.min(1, Math.hypot(player.inCar.vx, player.inCar.vy) / 520) : 0;
    world.audio.setEngine(engineSpeed, Boolean(player.inCar));
    if (state.radioTimer > 0) state.radioTimer -= dt;
  };

  /* ------------------------------------------------------------------ weapons */

  world.selectWeapon = function selectWeapon(name) {
    if (!WEAPONS[name]) return;
    if (name === 'smg' && player.reserve.smg <= 0 && player.mag.smg <= 0) {
      world.notify('No SMG. Do the Heat Check job for one.', '#b9b0a1', 2);
      return;
    }
    player.weapon = name;
    player.reloadTimer = 0;
    world.audio.ui();
  };

  world.reload = function reload() {
    const weapon = WEAPONS[player.weapon];
    if (!weapon || weapon.melee) return;
    if (player.mag[player.weapon] >= weapon.mag) return;
    if (player.reserve[player.weapon] <= 0) {
      world.notify('No ammo.', '#ff8a8a', 1.2);
      return;
    }
    player.reloadTimer = weapon.reload;
    world.audio.reload();
  };

  world.tryFire = function tryFire(aimX, aimY) {
    if (player.dead || state.wasted > 0 || state.busted > 0) return;
    if (player.fireCooldown > 0 || player.reloadTimer > 0) return;
    const weapon = WEAPONS[player.weapon];
    const inCar = Boolean(player.inCar);
    const angle = inCar
      ? Math.atan2(aimY - player.inCar.y, aimX - player.inCar.x)
      : player.aimAngle;
    if (weapon.melee) {
      player.fireCooldown = weapon.cooldown;
      world.combat.melee(angle, weapon);
      return;
    }
    if (player.mag[player.weapon] <= 0) {
      if (player.reserve[player.weapon] > 0) world.reload();
      else {
        world.notify('Out of ammo — FISTS out.', '#ff8a8a', 1.4);
        world.selectWeapon('fists');
      }
      return;
    }
    player.mag[player.weapon] -= 1;
    player.fireCooldown = weapon.cooldown;
    state.shotsFired += 1;
    const muzzleX = player.x + Math.cos(angle) * (inCar ? 26 : 16);
    const muzzleY = player.y + Math.sin(angle) * (inCar ? 26 : 16);
    world.combat.shoot({
      x: muzzleX, y: muzzleY, angle, weapon,
      shooter: 'player', damage: weapon.damage,
    });
    world.audio.gunshot(player.weapon === 'smg' ? 'smg' : 'pistol');
    state.shake = Math.max(state.shake, player.weapon === 'smg' ? 2.4 : 3.4);
    if (inCar) world.combat.flash(player.inCar.x, player.inCar.y, angle, 20);
    else world.combat.flash(player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, angle, 16);
    // Gunfire scatters the street.
    world.people.scare(player.x, player.y, 280);
    if (world.nearestOfficer < 520) world.addWanted(0.28);
  };

  world.tryReload = world.reload;

  /* ------------------------------------------------------------------ boot */

  world.combat = createCombat(world);
  world.people = createPeople(world);
  world.peds = world.people.peds;
  world.men = world.people.men;
  world.cars = createCars(world);
  world.damageCar = function damageCar(car, amount, byPlayer) {
    world.cars.damageCar(car, amount, byPlayer);
  };

  world.cars.populate();
  world.people.populate();

  world.player.x = city.storySites.garage.x;
  world.player.y = city.storySites.garage.y + 34;
  world.player.angle = -Math.PI / 2;

  world.drainInput = function drainInput() {};

  return world;
}
