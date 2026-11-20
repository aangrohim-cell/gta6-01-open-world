// Gunfire, melee, pickups, damage and destruction. All effects are procedural.
import { WEAPONS } from './config.js';
import { clamp, dist, rnd, rint, pick, chance } from './random.js';
import { solidAt } from './city.js';
import { carRadius } from './cars.js';
import { hitPed, alertNearby } from './people.js';
import { makeBulletBurst } from './vfx.js';

export function playerFire(game) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (game.time < p.fireCd) return;
  if (p.car) {
    // Drive-by shooting: the aim is the mouse direction from the car.
    p.aim = game.mouseAngle();
  }
  if (w.kind === 'melee') {
    p.fireCd = game.time + w.rate;
    const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    let hit = false;
    for (const ped of game.peds) {
      if (!ped.alive) continue;
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d > w.range) continue;
      const dot = ((ped.x - p.x) * dx + (ped.y - p.y) * dy) / (d || 1);
      if (dot < 0.25) continue;
      hitPed(game, ped, w.damage, 'player');
      game.addParticles(ped.x, ped.y, 3, '#ffd0a0', 60);
      hit = true;
    }
    game.sound.shoot('fists');
    if (hit) game.addHeat(2, 'assault');
    return;
  }
  if (p.ammo[p.weapon] <= 0) {
    game.notify('OUT OF AMMO', '#f26b6b');
    p.fireCd = game.time + 0.35;
    game.sound.ui();
    return;
  }
  p.ammo[p.weapon]--;
  p.fireCd = game.time + w.rate;
  const ox = p.x + Math.cos(p.aim) * 20;
  const oy = p.y + Math.sin(p.aim) * 20;
  const spread = game.rng() * 2 - 1;
  const a = p.aim + spread * w.spread;
  game.bullets.push({
    x: ox, y: oy, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
    life: w.range / w.speed, damage: w.damage, friendly: true,
    color: '#ffe38a', trail: p.weapon === 'smg' ? 7 : 12,
  });
  game.sound.shoot(p.weapon);
  game.addParticles(ox, oy, 3, '#ffe2a0', 120);
  game.addHeat(0.85, 'firing a weapon');
  alertNearby(game, ox, oy, 190);
  p.recoil = 1;
}

export function enemyFire(game, x, y, tx, ty, source) {
  const a = Math.atan2(ty - y, tx - x) + (game.rng() - 0.5) * 0.16;
  const speed = 620;
  game.bullets.push({
    x: x + Math.cos(a) * 22, y: y + Math.sin(a) * 22,
    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    life: 0.85, damage: source && source.type === 'rival' ? 9 : 11,
    friendly: false, color: '#ff9a8a', trail: 8,
  });
  game.sound.shoot('pistol');
  game.addParticles(x, y, 2, '#ffc39a', 80);
}

export function updateBullets(game, dt) {
  const p = game.player;
  const keep = [];
  for (const b of game.bullets) {
    b.life -= dt;
    if (b.life <= 0) continue;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 11));
    let consumed = false;
    for (let s = 0; s < steps && !consumed; s++) {
      b.x += b.vx * dt / steps;
      b.y += b.vy * dt / steps;
      if (solidAt(game.city, b.x, b.y, 2)) {
        game.addParticles(b.x, b.y, 3, '#d9d2b4', 70);
        consumed = true;
        break;
      }
      if (b.friendly) {
        for (const ped of game.peds) {
          if (!ped.alive) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 11) {
            hitPed(game, ped, b.damage, 'player');
            consumed = true;
            break;
          }
        }
        if (consumed) break;
        for (const car of game.cars) {
          if (car === p.car || car.hp <= 0) continue;
          if (dist(b.x, b.y, car.x, car.y) < carRadius(car) * 0.86) {
            game.damageCar(car, b.damage, 'bullet');
            consumed = true;
            break;
          }
        }
      } else {
        const tx = p.car || p;
        if (dist(b.x, b.y, tx.x, tx.y) < (p.car ? carRadius(p.car) * 0.9 : 13)) {
          game.damagePlayer(b.damage, 'shot');
          consumed = true;
        }
      }
    }
    if (!consumed) keep.push(b);
  }
  game.bullets = keep;
}

export function makePickup(game, x, y, type, amount) {
  game.pickups.push({ x, y, type, amount, ttl: 100, bob: game.rng() * 6.28 });
}

export function updatePickups(game, dt) {
  const p = game.player;
  const keep = [];
  for (const item of game.pickups) {
    item.ttl -= dt;
    item.bob += dt * 3;
    if (item.ttl <= 0) continue;
    const d = dist(item.x, item.y, p.x, p.y);
    if (d < (p.car ? 42 : 28)) {
      collectPickup(game, item);
      continue;
    }
    keep.push(item);
  }
  game.pickups = keep;
}

export function collectPickup(game, item) {
  const p = game.player;
  if (item.type === 'health') { p.health = clamp(p.health + item.amount, 0, 100); game.notify(`+${item.amount} HEALTH`, '#8ee0a8'); }
  else if (item.type === 'armour') { p.armour = clamp(p.armour + item.amount, 0, 100); game.notify(`+${item.amount} ARMOUR`, '#8ecbe8'); }
  else if (item.type === 'ammo') {
    p.ammo.pistol = clamp(p.ammo.pistol + item.amount, 0, 180);
    p.ammo.smg = clamp(p.ammo.smg + item.amount, 0, 600);
    game.notify('+AMMO', '#f7d774');
  } else if (item.type === 'money') { p.money += item.amount; game.notify(`+$${item.amount}`, '#9ce7a4'); }
  else if (item.type === 'weapon') {
    p.unlocked.smg = true;
    p.ammo.smg += 120;
    p.weapon = 'smg';
    game.notify('SMG UNLOCKED - PRESS 3', '#ff9b9b');
  }
  game.sound.pickup();
}

export function explodeCar(game, car) {
  car.hp = 0;
  game.addParticles(car.x, car.y, 22, '#ffab5e', 210);
  game.addParticles(car.x, car.y, 12, '#59565a', 110);
  game.sound.crack();
  game.shake = Math.max(game.shake, 9);
  if (chance(game.rng, 0.45)) makePickup(game, car.x, car.y, 'money', rint(game.rng, 40, 140));
  if (chance(game.rng, 0.3)) makePickup(game, car.x, car.y, 'health', 25);
  if (car === game.player.car) {
    game.player.car = null;
    game.player.health -= 22;
    game.addHeat(4, 'wrecked a car');
  }
  if (car.missionTag) game.onMissionCarDestroyed(car);
  game.cars = game.cars.filter((c) => c !== car);
  makeBulletBurst(car.x, car.y);
}

export function dropAmmo(game, x, y) {
  makePickup(game, x, y, 'ammo', 36);
}
