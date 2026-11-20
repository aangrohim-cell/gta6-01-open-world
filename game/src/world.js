// The game state and the simulation step. Everything is deterministic from a seed.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, WEAPONS, STAR_HEAT } from './config.js';
import { makeRng, rnd, approach, clamp, dist } from './random.js';
import { createCity, placePos, solidAt, isLand } from './city.js';
import { seedTraffic, makeCar, moveCar, updateTraffic, updatePolice, spawnPolice, updateCarCollisions, nearestCar, carRadius } from './cars.js';
import { seedPeople, updatePeople, hitPed, alertNearby, spawnRivals } from './people.js';
import { playerFire, enemyFire, updateBullets, makePickup, updatePickups, explodeCar } from './combat.js';
import { burst, ring, skid, floatText, updateVfx } from './vfx.js';
import { updateMissions, missionInteract, onRivalDown, currentMarker, currentObjective, missionCount } from './missions.js';
import { Sound } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

export class Game {
  constructor(seed = 3141) {
    this.sound = new Sound();
    this.reset(seed);
  }

  reset(seed = 3141) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.city = createCity(seed + 17);
    this.cars = seedTraffic(this.city, this.rng, 34);
    this.peds = seedPeople(this.city, this.rng, 84);
    this.bullets = [];
    this.particles = [];
    this.rings = [];
    this.skids = [];
    this.texts = [];
    this.pickups = [];
    this.time = 0;
    this.heat = 0;
    this.stars = 0;
    this.heatHold = 0;
    this.shake = 0;
    this.flash = 0;
    this.bust = 0;
    this.lastCrime = 'None';
    this.mode = 'title';
    this.titleSel = hasSave() ? 1 : 0;
    this.ending = false;
    this.dialogue = null;
    this.missionBanner = null;
    this.notices = [];
    this.interactPressed = false;
    this.autosave = 0;
    this.camera = { x: 2080, y: 1300 };
    this.cameraLock = false;

    const hospital = placePos(this.city, 'hospital');
    this.player = {
      x: hospital.x + 30, y: hospital.y + 60, a: -Math.PI / 2,
      health: 100, armour: 40, money: 400,
      weapon: 'fists', ammo: { pistol: 48, smg: 0 },
      unlocked: { smg: false },
      car: null, aim: -Math.PI / 2, fireCd: 0, recoil: 0,
      sprint: false, moveAmount: 0, hurt: 0,
    };
    this.mission = { index: 0, stage: 0, active: false, done: [], data: {}, timer: 0 };

    const starts = [
      ['health', hospital.x + 110, hospital.y + 60, 35],
      ['armour', hospital.x - 90, hospital.y + 60, 40],
      ['money', 1980, 1620, 120],
      ['ammo', 1080, 960, 48],
      ['health', 3060, 1980, 30],
      ['ammo', 2880, 3300, 60],
    ];
    for (const [type, x, y, amount] of starts) this.pickups.push({ x, y, type, amount, ttl: Infinity, bob: this.rng() * 6.28 });
  }

  get objective() { return currentObjective(this); }
  get marker() { return currentMarker(this); }

  mouseAngle() {
    const input = this.input;
    if (!input) return this.player.aim;
    const wx = this.camera.x - VIEW_W / 2 + input.mouse.x;
    const wy = this.camera.y - VIEW_H / 2 + input.mouse.y;
    const a = Math.atan2(wy - this.player.y, wx - this.player.x);
    if (Math.hypot(wx - this.player.x, wy - this.player.y) < 12) return this.player.aim;
    return a;
  }

  snapCamera() {
    const p = this.player;
    this.camera.x = clamp(p.x, VIEW_W / 2, WORLD_W - VIEW_W / 2);
    this.camera.y = clamp(p.y, VIEW_H / 2, WORLD_H - VIEW_H / 2);
  }

  notify(text, color = '#f7d774') {
    this.notices.unshift({ text, color, ttl: 3.1 });
    if (this.notices.length > 5) this.notices.pop();
  }

  addParticles(x, y, count, color, speed) { burst(this, x, y, count, color, speed); }
  spawnPickup(x, y, type, amount) { makePickup(this, x, y, type, amount); }
  enemyFire(x, y, tx, ty, source) { enemyFire(this, x, y, tx, ty, source); }

  spawnMissionCar(type, pos, tag, color) {
    const car = makeCar(this.city, this.rng, { x: pos.x, y: pos.y, a: Math.PI, type, ai: 'parked', color, missionTag: tag });
    this.cars.push(car);
    return car;
  }

  onRivalDown(ped) {
    onRivalDown(this, ped);
    this.spawnPickup(ped.x, ped.y, 'ammo', 22);
    if (this.rng() < 0.5) this.spawnPickup(ped.x + 14, ped.y, 'money', 55);
  }

  onMissionCarDestroyed(car) {
    this.notify('MISSION VEHICLE DESTROYED', '#f26b6b');
    void car;
  }

  addHeat(amount, reason = 'crime') {
    const before = this.stars;
    this.heat = clamp(this.heat + amount, 0, 100);
    this.heatHold = 7.5;
    this.lastCrime = reason;
    this.stars = this.starFromHeat(this.heat);
    if (this.stars > before) {
      this.notify('WANTED  ' + '★'.repeat(this.stars), '#f26b6b');
      this.sound.tone(520, 0.2, 'sawtooth', 0.08, -180);
    }
    if (this.stars > 0) spawnPolice(this);
  }

  setHeat(value) {
    this.heat = clamp(value, 0, 100);
    this.heatHold = 6;
    this.stars = this.starFromHeat(this.heat);
    if (this.stars > 0) spawnPolice(this);
  }

  starFromHeat(heat) {
    let s = 0;
    for (let i = 1; i < STAR_HEAT.length; i++) if (heat >= STAR_HEAT[i]) s = i;
    return s;
  }

  damagePlayer(amount, source) {
    if (this.mode !== 'play') return;
    const p = this.player;
    let dmg = amount;
    if (p.armour > 0) {
      const absorbed = Math.min(p.armour, dmg * 0.65);
      p.armour -= absorbed;
      dmg -= absorbed;
    }
    p.health -= dmg;
    p.hurt = 0.5;
    this.shake = Math.max(this.shake, 4);
    this.flash = Math.max(this.flash, 0.3);
    this.sound.hit();
    if (p.health <= 0) {
      p.health = 0;
      this.mode = this.stars > 0 && dist(p.x, p.y, this.nearestPoliceX(), this.nearestPoliceY()) < 130 ? 'busted' : 'wasted';
      this.sound.stopMusic();
      this.sound.crack();
    }
    void source;
  }

  nearestPoliceX() {
    let best = 1e9;
    for (const c of this.cars) if (c.ai === 'police') best = Math.min(best, c.x);
    return best;
  }

  nearestPoliceY() {
    let best = 1e9;
    for (const c of this.cars) if (c.ai === 'police') best = Math.min(best, c.y);
    return best;
  }

  damageCar(car, amount, source) {
    if (car.hp <= 0) return;
    car.hp -= amount;
    car.flash = 0.12;
    this.addParticles(car.x, car.y, 2, '#ffcf87', 55);
    if (source === 'bullet' && car.ai === 'police') this.addHeat(1.4, 'shooting at police');
    if (car.hp <= 0) explodeCar(this, car);
  }

  respawn(kind) {
    const p = this.player;
    const spot = placePos(this.city, kind === 'busted' ? 'police' : 'hospital');
    p.car = null;
    p.x = spot.x + 40;
    p.y = spot.y + 40;
    p.health = 100;
    p.armour = kind === 'busted' ? 0 : 25;
    p.money = Math.max(0, p.money - (kind === 'busted' ? 750 : 500));
    p.ammo.pistol = Math.floor(p.ammo.pistol / 2);
    p.ammo.smg = Math.floor(p.ammo.smg / 2);
    this.heat = 0;
    this.stars = 0;
    this.heatHold = 0;
    this.bust = 0;
    this.cars = this.cars.filter((c) => c.ai !== 'police');
    this.mode = 'play';
    this.flash = 0.8;
    this.notify(kind === 'busted' ? 'BOOKED AND RELEASED' : 'DISCHARGED FROM SUNSET MERCY', '#8ee9df');
    this.sound.startMusic();
    this.snapCamera();
    this.save();
  }

  newGame() {
    const saveExists = hasSave();
    this.reset(this.seed);
    clearSave();
    this.mode = 'play';
    this.sound.init();
    this.sound.startMusic();
    this.snapCamera();
    void saveExists;
  }

  continueGame() {
    const data = loadGame();
    if (!data) { this.newGame(); return; }
    const p = this.player;
    p.money = Math.max(0, Number(data.money) || 0);
    p.health = clamp(Number(data.health) || 100, 1, 100);
    p.armour = clamp(Number(data.armour) || 0, 0, 100);
    p.weapon = WEAPONS[data.weapon] ? data.weapon : 'fists';
    p.ammo.pistol = Number(data.pistol) || 48;
    p.ammo.smg = Number(data.smg) || 0;
    p.unlocked.smg = !!data.unlockedSmg;
    if (data.x && data.y && isLand(this.city, data.x, data.y, 14)) { p.x = data.x; p.y = data.y; }
    this.mission.index = clamp(Number(data.mission) || 0, 0, missionCount());
    this.mission.done = Array.isArray(data.done) ? data.done : [];
    this.mode = 'play';
    this.sound.init();
    this.sound.startMusic();
    this.snapCamera();
  }

  save() {
    if (this.mode === 'title') return;
    const p = this.player;
    saveGame({
      money: Math.round(p.money), health: Math.round(p.health), armour: Math.round(p.armour),
      weapon: p.weapon, pistol: p.ammo.pistol, smg: p.ammo.smg, unlockedSmg: p.unlocked.smg,
      x: Math.round(p.x), y: Math.round(p.y),
      mission: this.mission.index, done: this.mission.done,
    });
  }

  handleUI(input) {
    if (this.mode === 'title') {
      const options = hasSave() ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
      if (input.tapped('ArrowUp') || input.tapped('KeyW')) { this.titleSel = (this.titleSel + options.length - 1) % options.length; this.sound.init(); this.sound.ui(); }
      if (input.tapped('ArrowDown') || input.tapped('KeyS')) { this.titleSel = (this.titleSel + 1) % options.length; this.sound.init(); this.sound.ui(); }
      const go = input.tapped('Enter') || input.tapped('Space') || input.mouse.clicked;
      if (go) {
        this.sound.init();
        this.sound.ui();
        if (this.titleSel === 1 && hasSave()) this.continueGame();
        else this.newGame();
      }
      return;
    }
    if (this.mode === 'pause') {
      if (input.tapped('Escape') || input.tapped('Enter') || input.mouse.clicked) {
        this.mode = 'play';
        this.sound.ui();
      }
      return;
    }
    if (this.mode === 'wasted' || this.mode === 'busted') {
      if (input.tapped('Enter') || input.tapped('Space') || input.tapped('KeyE') || input.mouse.clicked) this.respawn(this.mode);
      return;
    }
  }

  update(dt, input) {
    this.input = input;
    if (this.mode !== 'play') { this.handleUI(input); this.updateVfxOnly(dt); input.endFrame(); return; }

    if (input.tapped('Escape')) { this.mode = 'pause'; this.sound.ui(); input.endFrame(); return; }
    if (input.tapped('KeyM')) { const muted = this.sound.toggleMute(); this.notify(muted ? 'SOUND MUTED' : 'SOUND ON', '#8ee9df'); }
    this.interactPressed = input.tapped('KeyE');
    this.time += dt;
    this.player.recoil = Math.max(0, this.player.recoil - dt * 5);
    this.player.hurt = Math.max(0, this.player.hurt - dt * 2);

    if (this.player.car) this.updateDriving(dt, input);
    else this.updateWalking(dt, input);

    updateTraffic(this, dt);
    updatePolice(this, dt);
    updateCarCollisions(this, dt);
    updatePeople(this, dt);
    updateBullets(this, dt);
    updatePickups(this, dt);
    updateMissions(this, dt);
    updateVfx(this, dt);
    this.updateHeat(dt);
    this.updateCamera(dt);

    if (this.dialogue) { this.dialogue.ttl -= dt; if (this.dialogue.ttl <= 0) this.dialogue = null; }
    if (this.missionBanner) { this.missionBanner.ttl -= dt; if (this.missionBanner.ttl <= 0) this.missionBanner = null; }
    for (const n of this.notices) n.ttl -= dt;
    this.notices = this.notices.filter((n) => n.ttl > 0);
    for (const c of this.cars) c.flash = Math.max(0, c.flash - dt);

    this.sound.sprint = this.player.sprint;
    this.sound.tick(dt, this.player.car ? Math.abs(this.player.car.speed) : this.player.moveAmount * 160, !!this.player.car, this.stars, this.player.moveAmount > 0.1);

    this.autosave += dt;
    if (this.autosave > 22) { this.autosave = 0; this.save(); }
    input.endFrame();
  }

  updateVfxOnly(dt) { updateVfx(this, dt); }

  updateWalking(dt, input) {
    const p = this.player;
    let mx = 0, my = 0;
    if (input.anyDown('KeyW', 'ArrowUp')) my -= 1;
    if (input.anyDown('KeyS', 'ArrowDown')) my += 1;
    if (input.anyDown('KeyA', 'ArrowLeft')) mx -= 1;
    if (input.anyDown('KeyD', 'ArrowRight')) mx += 1;
    const l = Math.hypot(mx, my) || 1;
    p.sprint = input.anyDown('ShiftLeft', 'ShiftRight');
    const speed = p.sprint ? 285 : 178;
    const vx = (mx / l) * speed * dt;
    const vy = (my / l) * speed * dt;
    if (!solidAt(this.city, p.x + vx, p.y, 12)) p.x += vx;
    if (!solidAt(this.city, p.x, p.y + vy, 12)) p.y += vy;
    p.moveAmount = mx || my ? 1 : 0;
    p.aim = this.mouseAngle();
    if (input.tapped('Digit1')) { p.weapon = 'fists'; this.sound.ui(); }
    if (input.tapped('Digit2')) { p.weapon = 'pistol'; this.sound.ui(); }
    if (input.tapped('Digit3') && p.unlocked.smg) { p.weapon = 'smg'; this.sound.ui(); }
    if (input.mouse.down || input.tapped('Space')) playerFire(this);

    if (this.interactPressed) {
      if (!missionInteract(this)) {
        const car = nearestCar(this.cars, p.x, p.y, 64);
        if (car && Math.abs(car.speed) < 120) {
          p.car = car;
          car.ai = 'player';
          car.speed = Math.max(0, car.speed);
          p.x = car.x; p.y = car.y; p.a = car.a;
          this.addHeat(14, 'carjacking');
          this.notify('CARJACKED - ' + car.name, '#f7d774');
          this.sound.confirm();
        } else if (car) this.notify('TOO FAST TO JACK', '#f26b6b');
      }
    }
    // Being run over.
    for (const car of this.cars) {
      if (car === p.car || Math.abs(car.speed) < 45) continue;
      if (dist(car.x, car.y, p.x, p.y) < carRadius(car) + 10) {
        this.damagePlayer(Math.abs(car.speed) * 0.16, 'run over');
        if (car.ai === 'police') this.bust += 0.2;
        const away = Math.atan2(p.y - car.y, p.x - car.x);
        if (!solidAt(this.city, p.x + Math.cos(away) * 30, p.y + Math.sin(away) * 30, 12)) {
          p.x += Math.cos(away) * 30; p.y += Math.sin(away) * 30;
        }
      }
    }
  }

  updateDriving(dt, input) {
    const p = this.player;
    const car = p.car;
    const spec = WEAPONS[p.weapon];
    const up = input.anyDown('KeyW', 'ArrowUp');
    const down = input.anyDown('KeyS', 'ArrowDown');
    const left = input.anyDown('KeyA', 'ArrowLeft');
    const right = input.anyDown('KeyD', 'ArrowRight');
    const handbrake = input.anyDown('Space');

    if (up) car.speed += 155 * dt;
    else if (down) car.speed -= 230 * dt;
    else car.speed = approach(car.speed, 0, 62 * dt);
    if (handbrake) car.speed = approach(car.speed, 0, 300 * dt);
    const maxSpeed = car.type === 'sports' ? 330 : car.type === 'truck' ? 195 : 250;
    car.speed = clamp(car.speed, -80, maxSpeed);
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    if (steer && Math.abs(car.speed) > 4) {
      car.a += steer * (1.25 + Math.min(0.65, Math.abs(car.speed) / 500)) * dt * Math.sign(car.speed || 1);
    }
    const beforeX = car.x, beforeY = car.y;
    moveCar(this.city, car, dt, this);
    p.x = car.x; p.y = car.y; p.a = car.a;
    p.moveAmount = Math.abs(car.speed) / 200;
    car.wheel += car.speed * dt * 0.05;
    if (handbrake && Math.abs(car.speed) > 110 && Math.hypot(car.x - beforeX, car.y - beforeY) > 1) {
      skid(this, car.x - Math.cos(car.a) * 20, car.y - Math.sin(car.a) * 20, car.a);
    }

    // Pedestrians and traffic get out of the way (or don't).
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < carRadius(car) + 8 && Math.abs(car.speed) > 40) {
        hitPed(this, ped, Math.abs(car.speed) * 0.32, 'car');
        car.speed *= 0.88;
      }
    }
    for (const other of this.cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < carRadius(car) + carRadius(other) && Math.abs(car.speed) > 130) {
        this.damageCar(other, Math.abs(car.speed) * 0.12, 'ram');
        car.speed *= 0.78;
        this.shake = Math.max(this.shake, 5);
      }
    }
    p.aim = this.mouseAngle();
    if (input.mouse.down && spec.kind === 'gun') playerFire(this);
    if (this.interactPressed) {
      if (Math.abs(car.speed) < 95) {
        const side = car.a + Math.PI / 2;
        const ex = car.x + Math.cos(side) * 46, ey = car.y + Math.sin(side) * 46;
        if (!solidAt(this.city, ex, ey, 12)) { p.x = ex; p.y = ey; }
        car.ai = car.missionTag ? 'parked' : 'traffic';
        car.speed = 0;
        p.car = null;
        this.notify('LEFT VEHICLE', '#8ee9df');
      } else this.notify('SLOW DOWN TO EXIT', '#f26b6b');
    }
  }

  updateHeat(dt) {
    if (this.heatHold > 0) this.heatHold -= dt;
    else {
      const before = this.stars;
      this.heat = Math.max(0, this.heat - dt * (this.stars >= 4 ? 1.15 : 1.55));
      this.stars = this.starFromHeat(this.heat);
      if (this.stars < before) this.notify('WANTED LEVEL DROPPED', '#8ee9df');
    }
    if (this.stars > 0) spawnPolice(this);

    // Busted: cops close in while the player is on foot.
    if (this.stars > 0 && !this.player.car) {
      let close = false;
      for (const c of this.cars) {
        if (c.ai === 'police' && dist(c.x, c.y, this.player.x, this.player.y) < 52) close = true;
      }
      this.bust = close ? this.bust + dt : Math.max(0, this.bust - dt * 0.8);
      if (this.bust > 2.1) { this.mode = 'busted'; this.sound.crack(); }
    } else this.bust = Math.max(0, this.bust - dt);

    if (this.heat <= 0) this.lastCrime = 'None';
  }

  updateCamera(dt) {
    if (this.cameraLock) return;
    const p = this.player;
    const shakeX = this.shake ? rnd(this.rng, -this.shake, this.shake) : 0;
    const shakeY = this.shake ? rnd(this.rng, -this.shake, this.shake) : 0;
    const tx = clamp(p.x + shakeX, VIEW_W / 2, WORLD_W - VIEW_W / 2);
    const ty = clamp(p.y + shakeY, VIEW_H / 2, WORLD_H - VIEW_H / 2);
    const k = Math.min(1, dt * 5.5);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
  }
}
