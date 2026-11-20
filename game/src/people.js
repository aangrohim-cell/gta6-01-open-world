// People: the pedestrians who walk the block perimeters and the beach, the police officers who
// get out of their cruisers, and the gangsters the story puts in the player's way. All of them
// are small state machines with a look, a health value and a panic reaction; combat.js does the
// shooting and asks this module who was hit.

import { CITY, GANG, LOOT, POLICE, TRAFFIC } from './config.js';
import { chance, clamp, distance, intRange, pick, range } from './random.js';

const SHIRTS = ['#e8dfc6', '#d76a5b', '#5c8fa8', '#e8b84a', '#7d6a9a', '#6f9c6f', '#c7779b', '#e0e4e8', '#3f4a5c', '#b5794e', '#d9a05b', '#6f8fa0', '#bd8eae'];
const PANTS = ['#3a4254', '#5a4a3a', '#2c3038', '#6b6357', '#46505f', '#7a5d46'];
const SKINS = ['#c98d63', '#a86f4b', '#e0b089', '#8a5a3c', '#d49a72', '#6f4a33'];
const HAIRS = ['#241a17', '#3b2a1e', '#5c3c22', '#171317', '#7a6144', '#b08a5a'];
const SWIMWEAR = ['#e8555f', '#3fc0c8', '#f2c23f', '#7f5ac8', '#4fc36a', '#f08a3c'];

function ringRect(block) {
  const lot = block.lot;
  const inset = 13;
  return { x: lot.x + inset, y: lot.y + inset, w: lot.w - inset * 2, h: lot.h - inset * 2 };
}

function ringPoint(block, t) {
  const rect = ringRect(block);
  const perimeter = (rect.w + rect.h) * 2;
  let value = ((t % perimeter) + perimeter) % perimeter;
  if (value < rect.w) return { x: rect.x + value, y: rect.y, angle: 0 };
  value -= rect.w;
  if (value < rect.h) return { x: rect.x + rect.w, y: rect.y + value, angle: Math.PI / 2 };
  value -= rect.h;
  if (value < rect.w) return { x: rect.x + rect.w - value, y: rect.y + rect.h, angle: Math.PI };
  value -= rect.w;
  return { x: rect.x, y: rect.y + rect.h - value, angle: -Math.PI / 2 };
}

function nearestRingT(block, x, y) {
  const rect = ringRect(block);
  const perimeter = (rect.w + rect.h) * 2;
  const points = [
    { t: clamp(x - rect.x, 0, rect.w), d: Math.abs(y - rect.y) },
    { t: rect.w + clamp(y - rect.y, 0, rect.h), d: Math.abs(x - (rect.x + rect.w)) },
    { t: rect.w + rect.h + clamp(rect.x + rect.w - x, 0, rect.w), d: Math.abs(y - (rect.y + rect.h)) },
    { t: 2 * rect.w + rect.h + clamp(rect.y + rect.h - y, 0, rect.h), d: Math.abs(x - rect.x) },
  ];
  points.sort((a, b) => a.d - b.d);
  return points[0].t % perimeter;
}

function randomLook(random, kind) {
  if (kind === 'cop') {
    return { shirt: '#2c3a57', jacket: '#1b2438', pants: '#1f2a3e', skin: pick(random, SKINS), hair: '#231c19', cap: true };
  }
  if (kind === 'gang') {
    return {
      shirt: pick(random, ['#7a2228', '#3a2a2a', '#9c5a2a', '#242424']),
      jacket: '#1a1717', pants: '#2a2730', skin: pick(random, SKINS), hair: '#151212', bandana: true,
    };
  }
  if (kind === 'beach') {
    return { shirt: pick(random, SWIMWEAR), jacket: null, pants: pick(random, SWIMWEAR), skin: pick(random, SKINS), hair: pick(random, HAIRS), beach: true };
  }
  return {
    shirt: pick(random, SHIRTS), jacket: random() < 0.3 ? pick(random, SHIRTS) : null,
    pants: pick(random, PANTS), skin: pick(random, SKINS), hair: pick(random, HAIRS),
  };
}

export function createPeople(world) {
  const { city, player, state, random } = world;
  const peds = { list: [] };
  const men = { list: [] };
  let pedId = 1;

  const walkableBlocks = city.blocks.filter((block) => block.type !== 'pierlot');

  function makePed(x, y, options = {}) {
    const ped = {
      id: pedId += 1,
      x, y,
      angle: random() * 6.28,
      health: 62,
      dead: false,
      deathTimer: 0,
      state: 'walk',
      walkPhase: random() * 10,
      speed: range(random, TRAFFIC.pedSpeed * 0.7, TRAFFIC.pedSpeed * 1.25),
      fleeTimer: 0,
      fleeX: 0,
      fleeY: 0,
      look: randomLook(random, options.kind ?? 'ped'),
      block: null,
      ringT: 0,
      ringDir: random() < 0.5 ? 1 : -1,
      beach: false,
      target: null,
      pause: random() * 1.5,
      kind: options.kind ?? 'ped',
    };
    if (options.block) {
      ped.block = options.block;
      ped.ringT = nearestRingT(options.block, x, y);
      const point = ringPoint(options.block, ped.ringT);
      ped.x = point.x;
      ped.y = point.y;
    } else {
      ped.beach = true;
      setWanderTarget(ped);
    }
    peds.list.push(ped);
    return ped;
  }

  function setWanderTarget(ped) {
    const beachStart = city.beach.y + 20;
    const beachEnd = city.waterY - 26;
    if (ped.beach || (ped.y > beachStart && ped.y < beachEnd)) {
      ped.target = { x: 80 + random() * (CITY.width - 160), y: beachStart + random() * (beachEnd - beachStart) };
    } else {
      // A short wander across a park or a plaza.
      const block = city.blockAt(ped.x, ped.y);
      const anchor = block ? block.lot : { x: CITY.width / 2, y: CITY.height / 2, w: 200, h: 200 };
      ped.target = { x: anchor.x + random() * anchor.w, y: anchor.y + random() * anchor.h };
      if (city.solidAt(ped.target.x, ped.target.y, 12)) ped.target = null;
    }
  }

  function spawnRingPed(nearX, nearY, minDistance, maxDistance) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const block = pick(random, walkableBlocks);
      const d = Math.hypot(block.lot.x + 144 - nearX, block.lot.y + 144 - nearY);
      if (d < minDistance || d > maxDistance) continue;
      const t = random() * ((block.lot.w + block.lot.h) * 2);
      const point = ringPoint(block, t);
      if (city.solidAt(point.x, point.y, 8)) continue;
      return makePed(point.x, point.y, { block });
    }
    const block = city.blockAt(nearX, nearY) ?? walkableBlocks[0];
    const point = ringPoint(block, random() * 500);
    return makePed(point.x, point.y, { block });
  }

  function spawnBeachPed() {
    const x = 100 + random() * (CITY.width - 200);
    const y = city.beach.y + 30 + random() * (city.beach.depth - 90);
    return makePed(x, y, { kind: 'beach' });
  }

  function populate() {
    // A crowd near the player's start and around the city, plus the beach crowd.
    for (let index = 0; index < 46; index += 1) spawnRingPed(player.x, player.y, 80, 900);
    for (let index = 0; index < TRAFFIC.pedCount - 46 - 26; index += 1) {
      const block = pick(random, walkableBlocks);
      const point = ringPoint(block, random() * 600);
      if (city.solidAt(point.x, point.y, 8)) continue;
      makePed(point.x, point.y, { block });
    }
    for (let index = 0; index < 26; index += 1) spawnBeachPed();
  }

  function scare(x, y, radius) {
    for (const ped of peds.list) {
      if (ped.dead) continue;
      const d = distance(ped.x, ped.y, x, y);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeTimer = range(random, 3.2, 6.5);
        ped.fleeX = x;
        ped.fleeY = y;
      }
    }
  }

  function killPed(ped, cause = 'shot') {
    if (ped.dead) return;
    ped.dead = true;
    ped.deathTimer = 0;
    ped.state = 'dead';
    ped.angle += range(random, -0.5, 0.5);
    state.kills += 1;
    world.combat.blood(ped.x, ped.y);
    if (ped.kind !== 'beach' && random() < 0.62) {
      world.addPickup('cash', ped.x + range(random, -10, 10), ped.y + range(random, -10, 10), intRange(random, 8, 55));
    }
    if (random() < 0.12) world.addPickup('ammo', ped.x, ped.y, 12);
    if (chance(random, LOOT.pedArmor)) world.addPickup('armor', ped.x, ped.y, 25);
    if (cause === 'shot') world.addWanted(0.85, null);
    world.audio.hit();
    world.emit('pedKilled', { ped, cause });
  }

  function updatePedWalk(ped, dt) {
    if (ped.pause > 0) {
      ped.pause -= dt;
      ped.walkPhase += dt * 1.2;
      return;
    }
    if (ped.block) {
      ped.ringT += ped.speed * ped.ringDir * dt;
      const point = ringPoint(ped.block, ped.ringT);
      ped.x = point.x;
      ped.y = point.y;
      ped.angle = point.angle + (ped.ringDir > 0 ? 0 : Math.PI);
      if (random() < 0.0016) ped.pause = range(random, 0.6, 2.4);
    } else if (ped.target) {
      const dx = ped.target.x - ped.x;
      const dy = ped.target.y - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 16) {
        ped.target = null;
        ped.pause = range(random, 0.4, 1.8);
        setWanderTarget(ped);
      } else {
        const angle = Math.atan2(dy, dx);
        ped.angle = angle;
        ped.x += Math.cos(angle) * ped.speed * 0.8 * dt;
        ped.y += Math.sin(angle) * ped.speed * 0.8 * dt;
        if (city.solidAt(ped.x, ped.y, 7)) {
          ped.target = null;
          setWanderTarget(ped);
        }
      }
    } else {
      setWanderTarget(ped);
    }
    ped.walkPhase += dt * (ped.speed / 26);
  }

  function reattachPed(ped) {
    let nearestBlock = null;
    let nearestDistance = Infinity;
    for (const block of walkableBlocks) {
      const d = Math.hypot(block.lot.x + 144 - ped.x, block.lot.y + 144 - ped.y);
      if (d < nearestDistance) { nearestDistance = d; nearestBlock = block; }
    }
    if (nearestBlock && nearestDistance < 1200) {
      ped.block = nearestBlock;
      ped.ringT = nearestRingT(nearestBlock, ped.x, ped.y);
      ped.beach = false;
    } else {
      ped.block = null;
      ped.beach = true;
      setWanderTarget(ped);
    }
  }

  function updatePed(ped, dt) {
    if (ped.dead) {
      ped.deathTimer += dt;
      return;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      const speed = 150 + ped.speed;
      const stepX = (dx / d) * speed * dt;
      const stepY = (dy / d) * speed * dt;
      if (!city.solidAt(ped.x + stepX, ped.y, 8)) ped.x += stepX;
      if (!city.solidAt(ped.x, ped.y + stepY, 8)) ped.y += stepY;
      ped.angle = Math.atan2(dy, dx);
      ped.walkPhase += dt * 9;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        reattachPed(ped);
      }
      return;
    }
    // A car bearing down on a pedestrian makes them jump out of the way.
    if (player.inCar) {
      const d = distance(player.inCar.x, player.inCar.y, ped.x, ped.y);
      if (d < 80 && player.inCar.speed > 50) {
        ped.state = 'flee';
        ped.fleeTimer = 1.6;
        ped.fleeX = player.inCar.x;
        ped.fleeY = player.inCar.y;
      }
    }
    updatePedWalk(ped, dt);
    if (distance(ped.x, ped.y, player.x, player.y) > 1500) {
      // Keep the streets populated: move a distant pedestrian to a block near the player.
      const block = pick(random, walkableBlocks);
      const d = Math.hypot(block.lot.x + 144 - player.x, block.lot.y + 144 - player.y);
      if (d > 450 && d < 1100) {
        const point = ringPoint(block, random() * 600);
        if (!city.solidAt(point.x, point.y, 8)) {
          ped.block = block;
          ped.ringT = nearestRingT(block, point.x, point.y);
          ped.x = point.x;
          ped.y = point.y;
          ped.beach = false;
          ped.state = 'walk';
        }
      }
    }
  }

  /* ---------------------------------------------------------------- men (cops and gangsters) */

  function makeMan(x, y, faction, options = {}) {
    const man = {
      id: pedId += 1,
      x, y,
      angle: Math.atan2(player.y - y, player.x - x),
      health: options.health ?? (faction === 'cop' ? POLICE.manHealth : GANG.health),
      maxHealth: options.health ?? (faction === 'cop' ? POLICE.manHealth : GANG.health),
      dead: false,
      deathTimer: 0,
      faction,
      look: randomLook(random, faction),
      speed: faction === 'cop' ? POLICE.manSpeed : GANG.speed,
      cooldown: range(random, 0.4, 1.5),
      walkPhase: random() * 8,
      state: 'idle',
      tag: options.tag ?? null,
      gun: options.gun ?? 'pistol',
      accuracy: options.accuracy ?? (faction === 'cop' ? POLICE.accuracy : GANG.accuracy),
      damage: options.damage ?? (faction === 'cop' ? POLICE.bulletDamage : GANG.damage),
      range: options.range ?? (faction === 'cop' ? POLICE.range : GANG.range),
      lingerTimer: 0,
      homeX: x,
      homeY: y,
      aggroRange: options.aggroRange ?? (faction === 'cop' ? 2400 : 540),
    };
    men.list.push(man);
    return man;
  }

  function spawnCop(x, y) {
    const man = makeMan(x, y, 'cop');
    man.state = 'responding';
    return man;
  }

  function spawnBoss(x, y) {
    const boss = makeMan(x, y, 'gang', {
      tag: 'mendez', health: 420, gun: 'smg', damage: 13, accuracy: 0.74, aggroRange: 1500,
    });
    boss.look = { shirt: '#efe6d2', jacket: '#1a1717', pants: '#26222a', skin: '#a8754f', hair: '#151212', bandana: false };
    boss.boss = true;
    return boss;
  }

  function spawnGang(x, y, count, options = {}) {
    const spawned = [];
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + random() * 0.5;
      const px = x + Math.cos(angle) * range(random, 30, 90);
      const py = y + Math.sin(angle) * range(random, 30, 90);
      if (city.solidAt(px, py, 10)) {
        spawned.push(makeMan(x + range(random, -20, 20), y + range(random, -20, 20), 'gang', options));
      } else {
        spawned.push(makeMan(px, py, 'gang', options));
      }
    }
    return spawned;
  }

  function spawnFleeingDriver(car) {
    const angle = car.angle + Math.PI / 2;
    const x = car.x + Math.cos(angle) * 26;
    const y = car.y + Math.sin(angle) * 26;
    if (city.solidAt(x, y, 8)) return;
    const ped = makePed(x, y, {});
    ped.state = 'flee';
    ped.fleeTimer = 5.5;
    ped.fleeX = car.x;
    ped.fleeY = car.y;
  }

  function damageMan(man, amount, source) {
    if (man.dead) return;
    man.health -= amount;
    if (man.health > 0) return;
    man.dead = true;
    man.deathTimer = 0;
    world.combat.blood(man.x, man.y);
    if (man.faction === 'cop') {
      state.copKills += 1;
      world.addWanted(1.3, 'Officer down');
      if (random() < 0.8) world.addPickup('ammo', man.x, man.y, 20);
      // Armour pickups were renderable but never dropped; fallen officers are the natural source.
      if (chance(random, LOOT.copArmor)) world.addPickup('armor', man.x + random() * 12 - 6, man.y + random() * 12 - 6, 35);
    } else {
      world.addWanted(0.35, null);
      if (random() < 0.85) world.addPickup('cash', man.x + random() * 14 - 7, man.y + random() * 14 - 7, intRange(random, 40, 120));
      if (chance(random, LOOT.gangHealth)) world.addPickup('health', man.x, man.y, 25);
      if (man.boss || chance(random, LOOT.gangArmor)) {
        world.addPickup('armor', man.x + random() * 12 - 6, man.y + random() * 12 - 6, man.boss ? 60 : 30);
      }
    }
    if (man.gun === 'smg' && chance(random, LOOT.smgAmmo)) {
      world.addPickup('ammo', man.x + range(random, -12, 12), man.y + range(random, -12, 12), 30, { weapon: 'smg' });
    }
    world.audio.hit();
    world.emit('manKilled', { man, source });
  }

  function moveMan(man, dx, dy, dt) {
    const stepX = dx * man.speed * dt;
    const stepY = dy * man.speed * dt;
    if (!city.solidAt(man.x + stepX, man.y, 8)) man.x += stepX;
    if (!city.solidAt(man.x, man.y + stepY, 8)) man.y += stepY;
  }

  function updateMan(man, dt) {
    if (man.dead) {
      man.deathTimer += dt;
      return;
    }
    const d = distance(man.x, man.y, player.x, player.y);
    const targetAngle = Math.atan2(player.y - man.y, player.x - man.x);
    man.angle = targetAngle;
    man.cooldown -= dt;
    const wanted = man.faction === 'cop' ? state.heat > 0 : true;
    if (man.faction === 'cop' && !wanted) {
      man.lingerTimer += dt;
      man.state = 'idle';
      if (man.lingerTimer > 16) man.dead = true;
      return;
    }
    if (man.faction === 'gang' && d > man.aggroRange) {
      const homeDx = man.homeX - man.x;
      const homeDy = man.homeY - man.y;
      const homeDist = Math.hypot(homeDx, homeDy);
      if (homeDist > 30) {
        moveMan(man, homeDx / homeDist, homeDy / homeDist, dt);
        man.walkPhase += dt * 6;
      }
      man.state = 'idle';
      return;
    }
    const stopRange = man.faction === 'cop' ? 145 : 165;
    if (d > stopRange) {
      const dx = Math.cos(targetAngle);
      const dy = Math.sin(targetAngle);
      moveMan(man, dx, dy, dt);
      man.walkPhase += dt * 7;
      man.state = 'chase';
    } else {
      man.state = 'aim';
      man.walkPhase += dt * 1.5;
    }
    man.cooldown = Math.max(0, man.cooldown);
    if (d < man.range && man.cooldown <= 0) {
      const wall = city.raycast(man.x, man.y, Math.cos(targetAngle), Math.sin(targetAngle), d);
      if (!wall) {
        man.cooldown = man.faction === 'cop' ? POLICE.fireCooldown + random() * 0.35 : GANG.fireCooldown + random() * 0.4;
        const spread = (random() - 0.5) * 0.16;
        const shotAngle = targetAngle + spread;
        world.combat.npcShoot(man, shotAngle, d);
        if (random() < man.accuracy) {
          if (player.inCar) {
            world.damagePlayer(man.damage * 0.45, man.faction);
            world.damageCar(player.inCar, man.damage * 0.7, false);
          } else {
            world.damagePlayer(man.damage, man.faction);
          }
        }
      }
    }
    // Keep the officers from standing in the player's car.
    if (player.inCar && distance(player.inCar.x, player.inCar.y, man.x, man.y) < 40) {
      man.x += Math.cos(targetAngle) * 40 * dt;
      man.y += Math.sin(targetAngle) * 40 * dt;
    }
  }

  function update(dt, controls, frozen) {
    // Iterate backwards: bodies and distant cops are removed inside the loop, and a forward
    // for...of would skip the entity after every removal.
    for (let index = peds.list.length - 1; index >= 0; index -= 1) {
      const ped = peds.list[index];
      if (distance(ped.x, ped.y, player.x, player.y) < 1700 || ped.dead) updatePed(ped, dt);
      if (ped.dead && ped.deathTimer > 26) peds.list.splice(index, 1);
    }
    for (let index = men.list.length - 1; index >= 0; index -= 1) {
      const man = men.list[index];
      if (man.dead) {
        man.deathTimer += dt;
        if (man.deathTimer > 28) men.list.splice(index, 1);
        continue;
      }
      if (distance(man.x, man.y, player.x, player.y) > 1800 && man.faction === 'cop') {
        men.list.splice(index, 1);
        continue;
      }
      if (!frozen) updateMan(man, dt);
    }
    // Drop peds who have wandered far away, so the population stays near the action.
    if (peds.list.length < TRAFFIC.pedCount - 20) {
      spawnRingPed(player.x, player.y, 420, 1050);
    }
    state.nearestOfficer = world.nearestOfficer;
  }

  return {
    peds,
    men,
    list: peds.list,
    populate,
    update,
    scare,
    killPed,
    damageMan,
    spawnCop,
    spawnGang,
    spawnBoss,
    spawnFleeingDriver,
    spawnRingPed,
    makePed,
  };
}
