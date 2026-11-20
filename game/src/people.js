// Pedestrians, witnesses and armed rivals. Drawn as small top-down figures.
import { clamp, dist, angleTo, turnTo, rnd, rint, pick, chance, approach } from './random.js';
import { sidewalkPoint, solidAt, isLand } from './city.js';

const SHIRTS = ['#e07a6a', '#6ea9c9', '#e5c15d', '#9a86bd', '#75b394', '#d9d5c9', '#c8799b', '#5f7286'];
const SKINS = ['#d7a077', '#b87550', '#8d5b42', '#e4b892', '#6f4a38'];
const HAIR = ['#2b2320', '#593c2a', '#171c22', '#8b5c32', '#c8a56c'];

export function makePed(rng, x, y, opts = {}) {
  return {
    x, y,
    a: opts.a ?? rnd(rng, 0, Math.PI * 2),
    speed: opts.speed ?? rnd(rng, 34, 62),
    target: opts.target || null,
    shirt: opts.shirt || pick(rng, SHIRTS),
    skin: opts.skin || pick(rng, SKINS),
    hair: opts.hair || pick(rng, HAIR),
    type: opts.type || 'civilian',
    hp: opts.hp || 55,
    alive: true,
    deadFor: 0,
    flee: 0,
    shootCd: rnd(rng, 0.5, 1.6),
    wobble: rnd(rng, 0, 6.28),
    step: 0,
    loyalty: opts.loyalty || null,
    missionTag: opts.missionTag || null,
  };
}

export function seedPeople(city, rng, count = 78) {
  const peds = [];
  for (let k = 0; k < count; k++) {
    const pt = sidewalkPoint(city, rng);
    const ped = makePed(rng, pt.x, pt.y);
    ped.target = sidewalkPoint(city, rng, pt);
    peds.push(ped);
  }
  // A few loiterers on the boardwalk and pier.
  for (let k = 0; k < 9; k++) {
    const x = 300 + k * 430 + rnd(rng, -80, 80);
    const y = rnd(rng, city.beachY + 20, city.waterY - 40);
    if (isLand(city, x, y, 8)) {
      const ped = makePed(rng, x, y);
      ped.shirt = pick(rng, ['#f5d07a', '#f28b87', '#73c9c4']);
      peds.push(ped);
    }
  }
  return peds;
}

export function spawnRivals(game, points, tag = 'rival') {
  const added = [];
  for (const pt of points) {
    const ped = makePed(game.rng, pt.x, pt.y, {
      type: 'rival', hp: 90, speed: 78, shirt: '#7b3542',
      skin: '#9d6748', hair: '#20242a', missionTag: tag,
    });
    game.peds.push(ped);
    added.push(ped);
  }
  return added;
}

export function alertNearby(game, x, y, radius = 260) {
  for (const ped of game.peds) {
    if (ped.alive && dist(ped.x, ped.y, x, y) < radius) ped.flee = Math.max(ped.flee, 6);
  }
}

export function hitPed(game, ped, damage, credit) {
  if (!ped.alive) return;
  ped.hp -= damage;
  ped.flee = 9;
  game.addParticles(ped.x, ped.y, 5, '#e87878', 80);
  game.sound.hit();
  if (ped.hp <= 0) {
    ped.alive = false;
    ped.deadFor = 0;
    if (ped.type === 'rival') {
      game.onRivalDown(ped);
    } else {
      game.addHeat(9, 'hit a pedestrian');
      if (chance(game.rng, 0.65)) game.spawnPickup(ped.x, ped.y, 'money', rint(game.rng, 25, 90));
    }
    void credit;
  }
}

export function updatePeople(game, dt) {
  const p = game.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  for (const ped of game.peds) {
    if (!ped.alive) {
      ped.deadFor += dt;
      continue;
    }
    if (dist(ped.x, ped.y, px, py) > 1500 && ped.type !== 'rival') continue;

    // Panic when the player is wanted and close, or when shots were fired nearby.
    if (game.stars > 0 && dist(ped.x, ped.y, px, py) < 320) ped.flee = Math.max(ped.flee, 2);
    if (ped.flee > 0) ped.flee -= dt;

    if (ped.type === 'rival') {
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (d < 620 && !p.car) {
        ped.a = turnTo(ped.a, angleTo(ped.x, ped.y, p.x, p.y), 2.6 * dt);
        if (d > 240) {
          const nx = ped.x + Math.cos(ped.a) * ped.speed * dt;
          const ny = ped.y + Math.sin(ped.a) * ped.speed * dt;
          if (!solidAt(game.city, nx, ny, 8)) { ped.x = nx; ped.y = ny; }
        }
        ped.shootCd -= dt;
        if (ped.shootCd <= 0 && d < 480) {
          ped.shootCd = rnd(game.rng, 1.1, 1.9);
          game.enemyFire(ped.x, ped.y, p.x, p.y, ped);
        }
      }
      continue;
    }

    if (ped.flee > 0) {
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 30) {
        const away = angleTo(px, py, ped.x, ped.y) + rnd(game.rng, -0.7, 0.7);
        ped.target = {
          x: clamp(ped.x + Math.cos(away) * 230, 40, 4260),
          y: clamp(ped.y + Math.sin(away) * 230, 40, game.city.waterY - 40),
        };
      }
    } else if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 18) {
      ped.target = sidewalkPoint(game.city, game.rng, ped);
    }

    const desired = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
    ped.a = turnTo(ped.a, desired, 4 * dt);
    const speed = ped.flee > 0 ? ped.speed * 2.1 : ped.speed;
    const nx = ped.x + Math.cos(ped.a) * speed * dt;
    const ny = ped.y + Math.sin(ped.a) * speed * dt;
    if (!solidAt(game.city, nx, ny, 7)) {
      ped.x = nx; ped.y = ny;
      ped.wobble += speed * dt * 0.12;
    } else {
      ped.target = sidewalkPoint(game.city, game.rng, ped);
    }
  }

  // Keep sidewalks busy near the player.
  const active = game.peds.filter((q) => q.alive && dist(q.x, q.y, px, py) < 1100).length;
  if (active < 14) {
    for (let k = 0; k < 4; k++) {
      const pt = sidewalkPoint(game.city, game.rng, { x: px, y: py });
      if (dist(pt.x, pt.y, px, py) > 180) game.peds.push(makePed(game.rng, pt.x, pt.y));
    }
  }
  // Retire old corpses and distant crowds.
  if (game.peds.length > 220) {
    game.peds = game.peds.filter((q) => q.alive || q.deadFor < 18);
  }
}
