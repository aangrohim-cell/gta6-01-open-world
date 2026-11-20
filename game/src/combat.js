// Combat: the player's pistol, SMG and fists, the officers' and gangsters' return fire, and the
// hit-scan that decides what a bullet actually strikes. It also owns the effect pools (tracers,
// muzzle flashes, smoke, sparks, blood, scorch marks and explosion rings) that render.js paints,
// so every system reports damage through one place.

import { WEAPONS } from './config.js';
import { angleDelta, distance } from './random.js';

const DECAL_CAP = 180;

function rayCircle(ox, oy, dx, dy, cx, cy, radius) {
  const px = cx - ox;
  const py = cy - oy;
  const along = px * dx + py * dy;
  if (along < 0) return null;
  const perpSq = px * px + py * py - along * along;
  if (perpSq > radius * radius) return null;
  return along - Math.sqrt(Math.max(0, radius * radius - perpSq));
}

/** The distance along a ray to a car's oriented box, or null. */
export function rayCar(ox, oy, dx, dy, car) {
  const c = Math.cos(-car.angle);
  const s = Math.sin(-car.angle);
  const rx = (ox - car.x) * c - (oy - car.y) * s;
  const ry = (ox - car.x) * s + (oy - car.y) * c;
  const rdx = dx * c - dy * s;
  const rdy = dx * s + dy * c;
  const halfW = car.w / 2;
  const halfL = car.l / 2;
  let tmin = 0;
  let tmax = 1e9;
  for (let axis = 0; axis < 2; axis += 1) {
    const origin = axis === 0 ? rx : ry;
    const direction = axis === 0 ? rdx : rdy;
    const half = axis === 0 ? halfW : halfL;
    if (Math.abs(direction) < 1e-6) {
      if (origin < -half || origin > half) return null;
    } else {
      let t1 = (-half - origin) / direction;
      let t2 = (half - origin) / direction;
      if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export function createCombat(world) {
  const { effects, player, city } = world;

  function patch(entity, type, amount, source) {
    if (type === 'ped') {
      entity.health -= amount;
      if (entity.health <= 0) world.people.killPed(entity, source);
      else entity.state = 'flee';
    } else if (type === 'man') {
      world.people.damageMan(entity, amount, source);
    } else if (type === 'car') {
      world.damageCar(entity, amount, source === 'player');
    }
  }

  /** One bullet, resolved against the nearest wall, person or car. */
  function shoot(options) {
    const { x, y, angle, weapon } = options;
    const range = weapon.range;
    const spread = (world.random() - 0.5) * 2 * weapon.spread;
    const shotAngle = angle + spread;
    const dx = Math.cos(shotAngle);
    const dy = Math.sin(shotAngle);
    let best = { t: range, type: 'none' };
    const wall = city.raycast(x, y, dx, dy, range);
    if (wall) best = { t: wall.t, type: 'wall', x: wall.x, y: wall.y };

    for (const ped of world.peds.list) {
      if (ped.dead) continue;
      const t = rayCircle(x, y, dx, dy, ped.x, ped.y, 9);
      if (t !== null && t > 0 && t < best.t) best = { t, type: 'ped', entity: ped };
    }
    for (const man of world.men.list) {
      if (man.dead) continue;
      const t = rayCircle(x, y, dx, dy, man.x, man.y, 11);
      if (t !== null && t > 0 && t < best.t) best = { t, type: 'man', entity: man };
    }
    for (const car of world.cars.list) {
      if (car === player.inCar) continue;
      const t = rayCar(x, y, dx, dy, car);
      if (t !== null && t > 0.5 && t < best.t) best = { t, type: 'car', entity: car };
    }

    const endX = x + dx * best.t;
    const endY = y + dy * best.t;
    tracer(x, y, endX, endY, options.shooter === 'player' ? '#ffe5a8' : '#ffd0c0');
    if (best.type === 'ped' || best.type === 'man') {
      patch(best.entity, best.type, options.damage, options.shooter === 'player' ? 'player' : 'npc');
      if (best.type === 'man') {
        for (let index = 0; index < 4; index += 1) {
          particles.push({
            x: endX, y: endY, vx: (world.random() - 0.5) * 90, vy: (world.random() - 0.5) * 90,
            life: 0.4, max: 0.4, size: 2 + world.random() * 2, color: '#a5212a', drag: 6, gravity: 0,
          });
        }
      }
      world.people.scare(endX, endY, 260);
    } else if (best.type === 'car') {
      patch(best.entity, 'car', options.damage, options.shooter === 'player' ? 'player' : 'npc');
      impact(endX, endY, shotAngle, '#ffd27a');
      glass(endX, endY);
    } else if (best.type === 'wall') {
      impact(endX, endY, shotAngle, '#d8cfc0');
    }
    if (options.shooter === 'player') {
      world.state.shake = Math.max(world.state.shake, 1.2);
      // Shooting in public is itself a crime; the wanted system hears it.
      if (world.nearestOfficer < 460) world.addWanted(0.18, null);
    }
    return { x: endX, y: endY, type: best.type };
  }

  function melee(angle, weapon) {
    let hit = null;
    let bestDistance = 999;
    for (const ped of world.peds.list) {
      if (ped.dead) continue;
      const d = distance(player.x, player.y, ped.x, ped.y);
      // angleDelta wraps at +/-PI; a raw subtraction missed anyone just across that seam.
      const bearing = Math.abs(angleDelta(angle, Math.atan2(ped.y - player.y, ped.x - player.x)));
      if (d < weapon.range && bearing < 1.1 && d < bestDistance) {
        bestDistance = d;
        hit = { type: 'ped', entity: ped };
      }
    }
    for (const man of world.men.list) {
      if (man.dead) continue;
      const d = distance(player.x, player.y, man.x, man.y);
      const bearing = Math.abs(angleDelta(angle, Math.atan2(man.y - player.y, man.x - player.x)));
      if (d < weapon.range && bearing < 1.1 && d < bestDistance) {
        bestDistance = d;
        hit = { type: 'man', entity: man };
      }
    }
    world.audio.punch();
    if (!hit) return null;
    const target = hit.entity;
    patch(target, hit.type, weapon.damage, 'player');
    for (let index = 0; index < 5; index += 1) {
      particles.push({
        x: target.x, y: target.y, vx: (world.random() - 0.5) * 120, vy: (world.random() - 0.5) * 120,
        life: 0.35, max: 0.35, size: 2, color: '#a5212a', drag: 7, gravity: 0,
      });
    }
    world.state.shake = Math.max(world.state.shake, 1.4);
    world.people.scare(target.x, target.y, 180);
    return hit;
  }

  function npcShoot(man, angle, distanceToPlayer) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const wall = city.raycast(man.x, man.y, dx, dy, distanceToPlayer + 20);
    const endX = wall ? wall.x : man.x + dx * distanceToPlayer;
    const endY = wall ? wall.y : man.y + dy * distanceToPlayer;
    tracer(man.x + dx * 14, man.y + dy * 14, endX, endY, man.faction === 'cop' ? '#a8c8ff' : '#ff9a7a');
    flash(man.x + dx * 14, man.y + dy * 14, angle, 10);
    world.audio.gunshot('pistol');
    world.people.scare(man.x, man.y, 240);
    world.state.shake = Math.max(world.state.shake, 1.1);
  }

  function playerHit() {
    for (let index = 0; index < 5; index += 1) {
      particles.push({
        x: player.x, y: player.y, vx: (world.random() - 0.5) * 130, vy: (world.random() - 0.5) * 130,
        life: 0.4, max: 0.4, size: 2.5, color: '#b32e36', drag: 8, gravity: 0,
      });
    }
  }

  /* ---------------------------------------------------------------- effects */

  const particles = effects.particles;
  const decals = effects.decals;

  function tracer(x1, y1, x2, y2, color) {
    effects.tracers.push({ x1, y1, x2, y2, color, life: 0.075, max: 0.075 });
  }

  function flash(x, y, angle, size) {
    effects.flashes.push({ x, y, angle, size, life: 0.055, max: 0.055 });
  }

  function impact(x, y, angle, color) {
    for (let index = 0; index < 7; index += 1) {
      const spread = angle + Math.PI + (world.random() - 0.5) * 2.2;
      const speed = 60 + world.random() * 190;
      particles.push({
        x, y, vx: Math.cos(spread) * speed, vy: Math.sin(spread) * speed,
        life: 0.18 + world.random() * 0.2, max: 0.38, size: 1.5 + world.random() * 1.6,
        color, drag: 5, gravity: 0,
      });
    }
    addDecal({ x, y, angle, size: 2 + world.random() * 2, type: 'chip' });
  }

  function glass(x, y) {
    for (let index = 0; index < 5; index += 1) {
      const angle = world.random() * 6.28;
      const speed = 50 + world.random() * 140;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.5, max: 0.5, size: 1.6, color: '#cfe8f2', drag: 3, gravity: 30,
      });
    }
  }

  function smoke(x, y) {
    particles.push({
      x, y, vx: (world.random() - 0.5) * 18, vy: -12 - world.random() * 22,
      life: 1.1 + world.random() * 0.8, max: 1.9, size: 8 + world.random() * 10,
      color: '#4b4a52', drag: 1.4, gravity: -8, grow: 16,
    });
  }

  function blood(x, y) {
    for (let index = 0; index < 8; index += 1) {
      const angle = world.random() * 6.28;
      const speed = 20 + world.random() * 90;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.3 + world.random() * 0.4, max: 0.7, size: 1.6 + world.random() * 2.4,
        color: '#8f1d26', drag: 6, gravity: 40,
      });
    }
    addDecal({ x, y, angle: world.random() * 6.28, size: 13 + world.random() * 9, type: 'blood' });
    addDecal({ x: x + (world.random() - 0.5) * 14, y: y + (world.random() - 0.5) * 14, angle: world.random() * 6.28, size: 5 + world.random() * 7, type: 'blood' });
  }

  function addDecal(decal) {
    decals.push(decal);
    while (decals.length > DECAL_CAP) decals.shift();
  }

  function skid(x, y, angle) {
    addDecal({ x, y, angle, size: 9, type: 'skid' });
  }

  function explosionAt(x, y, radius, color = '#ffb35c') {
    effects.rings.push({ x, y, radius: 10, target: radius, life: 0.5, max: 0.5, color });
    for (let index = 0; index < 34; index += 1) {
      const angle = world.random() * 6.28;
      const speed = 60 + world.random() * 330;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.4 + world.random() * 0.9, max: 1.3,
        size: 3 + world.random() * 7, color: world.random() < 0.55 ? '#ffc45c' : '#ff7a3c',
        drag: 2.2, gravity: 0, grow: 10, glow: true,
      });
    }
    for (let index = 0; index < 18; index += 1) {
      particles.push({
        x: x + (world.random() - 0.5) * 40, y: y + (world.random() - 0.5) * 40,
        vx: (world.random() - 0.5) * 90, vy: -20 - world.random() * 60,
        life: 1.5 + world.random() * 1.5, max: 3, size: 16 + world.random() * 22,
        color: '#2c2a31', drag: 1, gravity: -6, grow: 22,
      });
    }
    addDecal({ x, y, angle: 0, size: radius * 0.6, type: 'scorch' });
  }

  function explodeCar(car, byPlayer) {
    if (!car || car.kind === 'wreck' || car.exploding) return;
    car.exploding = true;
    if (player.inCar === car) {
      player.inCar = null;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      // Ejected from the blast radius: the radial hit below is the only damage applied.
      player.invulnerable = 0;
    }
    car.kind = 'wreck';
    car.health = 0;
    car.vx = 0;
    car.vy = 0;
    car.speed = 0;
    car.siren = false;
    car.burnTimer = 7;
    explosionAt(car.x, car.y, 150);
    world.audio.explosion();
    world.state.shake = Math.max(world.state.shake, 11);
    world.people.scare(car.x, car.y, 460);
    world.addWanted(0.5, null);
    // Everything close enough gets hurt, the player included.
    for (const ped of world.peds.list) {
      if (ped.dead) continue;
      const d = distance(ped.x, ped.y, car.x, car.y);
      if (d < 140) world.people.killPed(ped, 'explosion');
      else if (d < 220) {
        ped.state = 'flee';
        ped.fleeTimer = 5;
        ped.fleeX = car.x;
        ped.fleeY = car.y;
      }
    }
    for (const man of world.men.list) {
      if (man.dead) continue;
      const d = distance(man.x, man.y, car.x, car.y);
      if (d < 145) world.people.damageMan(man, 140, 'explosion');
    }
    if (player.health > 0) {
      const d = distance(player.x, player.y, car.x, car.y);
      if (d < 170) world.damagePlayer(70 * (1 - d / 190), 'explosion');
    }
    for (const other of world.cars.list) {
      if (other === car || other.kind === 'wreck') continue;
      const d = distance(other.x, other.y, car.x, car.y);
      if (d < 120) world.damageCar(other, 90 * (1 - d / 150), byPlayer);
    }
    world.emit('explosion', { car, byPlayer });
  }

  function update(dt) {
    for (let index = effects.tracers.length - 1; index >= 0; index -= 1) {
      effects.tracers[index].life -= dt;
      if (effects.tracers[index].life <= 0) effects.tracers.splice(index, 1);
    }
    for (let index = effects.flashes.length - 1; index >= 0; index -= 1) {
      effects.flashes[index].life -= dt;
      if (effects.flashes[index].life <= 0) effects.flashes.splice(index, 1);
    }
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      const drag = Math.max(0, 1 - (particle.drag ?? 0) * dt);
      particle.vx *= drag;
      particle.vy *= drag;
      particle.vy += (particle.gravity ?? 0) * dt;
      if (particle.grow) particle.size += particle.grow * dt;
    }
    for (let index = effects.rings.length - 1; index >= 0; index -= 1) {
      const ring = effects.rings[index];
      ring.life -= dt;
      ring.radius += (ring.target - ring.radius) * Math.min(1, dt * 9);
      if (ring.life <= 0) effects.rings.splice(index, 1);
    }
    for (const car of world.cars.list) {
      if (car.kind === 'wreck' && car.burnTimer > 0) {
        car.burnTimer -= dt;
        car.smokeTimer = (car.smokeTimer ?? 0) - dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.12 + world.random() * 0.16;
          smoke(car.x + (world.random() - 0.5) * 18, car.y + (world.random() - 0.5) * 18);
          if (car.burnTimer > 4 && world.random() < 0.4) {
            particles.push({
              x: car.x + (world.random() - 0.5) * 20, y: car.y + (world.random() - 0.5) * 20,
              vx: 0, vy: -30, life: 0.4, max: 0.4, size: 7, color: '#ff9a3c', drag: 2, gravity: -20, grow: 8, glow: true,
            });
          }
        }
      }
    }
  }

  return {
    shoot,
    melee,
    npcShoot,
    playerHit,
    explodeCar,
    explosionAt,
    update,
    tracer,
    flash,
    impact,
    smoke,
    blood,
    glass,
    skid,
    addDecal,
    effects,
  };
}
