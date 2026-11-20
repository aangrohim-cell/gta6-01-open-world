// Cars: the traffic that follows the road lanes, the parked cars along the kerb, the player's
// stolen ride with its own throttle/steer/handbrake physics, and the police cruisers that give
// chase. Cars are the only thing in the city that can be stolen, rammed, shot at and blown up, so
// most of the game's noise comes from here.

import { CAR, CAR_COLORS, CITY, POLICE, TRAFFIC } from './config.js';
import { angleDelta, chance, clamp, distance, intRange, lerp, pick, range } from './random.js';

export const CAR_MODELS = {
  sedan: { w: 42, l: 84 },
  sports: { w: 40, l: 80 },
  van: { w: 50, l: 100 },
  taxi: { w: 42, l: 84 },
  pickup: { w: 46, l: 90 },
  coupe: { w: 41, l: 88 },
  cop: { w: 46, l: 92 },
};

const MODEL_NAMES = ['sedan', 'sports', 'van', 'taxi', 'pickup', 'coupe'];
const RADIO = ['VICE FM 98.6', 'SUNSET 104.2', 'COAST LINE RADIO', 'WAVE 89.1', 'NEON 99.3'];

export function createCars(world) {
  const { city, player, state, random } = world;
  const P = CITY.pitch;
  const list = [];
  let nextId = 1;

  function makeCar(options) {
    const model = options.model ?? pick(random, MODEL_NAMES);
    const dims = CAR_MODELS[model];
    const palette = options.color ?? pick(random, CAR_COLORS);
    const car = {
      id: nextId += 1,
      x: options.x,
      y: options.y,
      angle: options.angle ?? 0,
      vx: 0, vy: 0,
      kind: options.kind ?? 'parked',
      model,
      w: dims.w,
      l: dims.l,
      color: palette,
      health: options.kind === 'cop' ? POLICE.carHealth : CAR.health,
      maxHealth: options.kind === 'cop' ? POLICE.carHealth : CAR.health,
      cruise: range(random, TRAFFIC.speedMin, TRAFFIC.speedMax),
      speed: 0,
      target: null,
      axis: options.axis ?? 'h',
      sign: options.sign ?? 1,
      road: options.road ?? 5,
      along: 0,
      turning: false,
      deployTimer: 0,
      stuckTimer: 0,
      smokeTimer: 0,
      hornTimer: 0,
      skidSoundTimer: 0,
      siren: options.kind === 'cop',
      missionTag: options.missionTag ?? null,
      parked: options.kind === 'parked' || options.kind === 'special',
      build: options.kind === 'special' ? 1 : 0,
    };
    if (options.kind === 'traffic' || options.kind === 'cop') {
      car.axis = options.axis;
      car.sign = options.sign;
      car.road = options.road;
      car.along = options.axis === 'h' ? car.x : car.y;
      planStraight(car);
      car.angle = options.angle ?? (options.axis === 'h' ? (options.sign > 0 ? 0 : Math.PI) : (options.sign > 0 ? Math.PI / 2 : -Math.PI / 2));
    }
    list.push(car);
    return car;
  }

  /* ---------------------------------------------------------------- traffic lanes */

  function planStraight(car) {
    const along = car.axis === 'h' ? car.x : car.y;
    const ahead = car.sign > 0 ? Math.floor(along / P) + 1 : Math.ceil(along / P) - 1;
    const road = clamp(ahead, 1, CITY.blocks - 1);
    const point = city.lanePoint(car.axis, car.sign, car.road, road * P);
    car.target = point;
    car.turning = false;
  }

  function planTurn(car) {
    const eastWest = car.axis === 'h';
    const along = eastWest ? car.x : car.y;
    const cross = Math.round(along / P);
    const k = clamp(cross, 1, CITY.blocks - 1);
    const roll = random();
    const straight = roll < 0.52;
    const right = roll >= 0.52 && roll < 0.74;
    const left = roll >= 0.74 && roll < 0.96;
    if (straight) {
      const ahead = car.sign > 0 ? k + 1 : k - 1;
      car.target = city.lanePoint(car.axis, car.sign, car.road, clamp(ahead, 1, CITY.blocks - 1) * P);
      car.turning = false;
      return;
    }
    // A right turn is +90 degrees from the heading; a left turn is -90.
    if (eastWest) {
      const newSign = right ? (car.sign > 0 ? 1 : -1) : (car.sign > 0 ? -1 : 1);
      const exit = city.lanePoint('v', newSign, k, car.y + newSign * 84);
      car.axis = 'v';
      car.sign = newSign;
      car.road = k;
      car.target = exit;
    } else {
      const newSign = right ? (car.sign > 0 ? -1 : 1) : (car.sign > 0 ? 1 : -1);
      const exit = city.lanePoint('h', newSign, k, car.x + newSign * 84);
      car.axis = 'h';
      car.sign = newSign;
      car.road = k;
      car.target = exit;
    }
    car.turning = true;
  }

  function trafficSpeedFactor(car) {
    let factor = 1;
    if (car.turning) factor = 0.62;
    if (car.target) {
      const d = distance(car.x, car.y, car.target.x, car.target.y);
      if (d < 120) factor = Math.min(factor, 0.55 + d / 300);
    }
    // Keep a gap from the car in front, and ease off around the player's car.
    const headingX = Math.cos(car.angle);
    const headingY = Math.sin(car.angle);
    for (const other of list) {
      if (other === car || other.kind === 'parked' || other.kind === 'wreck' || other.kind === 'special') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * headingX + dy * headingY;
      if (ahead > 10 && ahead < 94 && Math.abs(dx * -headingY + dy * headingX) < 26) {
        factor = Math.min(factor, Math.max(0, (ahead - 24) / 90));
      }
    }
    return factor;
  }

  function updateTraffic(car, dt) {
    const desired = Math.atan2(car.target.y - car.y, car.target.x - car.x);
    const delta = angleDelta(car.angle, desired);
    const turn = clamp(delta, -3.1 * dt, 3.1 * dt);
    car.angle += turn;
    const targetSpeed = car.cruise * trafficSpeedFactor(car);
    car.speed = lerp(car.speed, targetSpeed, Math.min(1, dt * 2.6));
    const step = car.speed * dt;
    const nx = car.x + Math.cos(car.angle) * step;
    const ny = car.y + Math.sin(car.angle) * step;
    // Only the lanes are drivable for traffic, so a simple guard is enough.
    if (!city.solidAt(nx, ny, 8)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.angle += 0.9 * dt;
    }
    if (distance(car.x, car.y, car.target.x, car.target.y) < 82) {
      if (car.turning) planStraight(car);
      else planTurn(car);
    }
    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
    car.along = car.axis === 'h' ? car.x : car.y;
    // A driver honks when the player's car crowds its lane, but never more than once a moment.
    car.hornTimer = Math.max(0, (car.hornTimer ?? 0) - dt);
    if (car.hornTimer <= 0 && player.inCar && car.speed > 40
      && distance(car.x, car.y, player.x, player.y) < 115 && chance(random, dt * 0.5)) {
      car.hornTimer = 2.2 + random() * 2;
      world.audio.horn();
    }
    if (distance(car.x, car.y, player.x, player.y) > 1900) recycleTraffic(car);
  }

  function recycleTraffic(car) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const axis = random() < 0.5 ? 'h' : 'v';
      const sign = random() < 0.5 ? 1 : -1;
      const road = intRange(random, 1, CITY.blocks - 1);
      const along = 140 + random() * (CITY.width - 280);
      const point = city.lanePoint(axis, sign, road, along);
      if (distance(point.x, point.y, player.x, player.y) < 850) continue;
      car.x = point.x;
      car.y = point.y;
      car.axis = axis;
      car.sign = sign;
      car.road = road;
      car.angle = axis === 'h' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.speed = car.cruise * 0.7;
      planStraight(car);
      return;
    }
  }

  /* ---------------------------------------------------------------- player driving */

  function carFits(car, x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const halfW = car.w / 2 - 3;
    const halfL = car.l / 2 - 4;
    const points = [
      [-halfW, -halfL], [halfW, -halfL], [-halfW, halfL], [halfW, halfL],
      [0, -halfL], [0, halfL], [-halfW, 0], [halfW, 0],
    ];
    for (const point of points) {
      const px = x + c * point[0] - s * point[1];
      const py = y + s * point[0] + c * point[1];
      if (city.solidAt(px, py, 1)) return false;
    }
    return true;
  }

  function updatePlayerCar(car, dt, controls) {
    const startX = car.x;
    const startY = car.y;
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    const rightX = -forwardY;
    const rightY = forwardX;
    let forwardSpeed = car.vx * forwardX + car.vy * forwardY;
    const throttle = controls.throttle;
    const brake = controls.brake;

    if (throttle > 0) {
      const accel = CAR.accel * (1 - Math.min(0.55, Math.max(0, forwardSpeed) / CAR.maxSpeed) * 0.55);
      car.vx += forwardX * accel * throttle * dt;
      car.vy += forwardY * accel * throttle * dt;
    }
    if (brake > 0) {
      if (forwardSpeed > 12) {
        car.vx -= forwardX * CAR.brake * brake * dt;
        car.vy -= forwardY * CAR.brake * brake * dt;
      } else {
        car.vx -= forwardX * CAR.reverseAccel * brake * dt;
        car.vy -= forwardY * CAR.reverseAccel * brake * dt;
      }
    }

    // Grip: kill sideways velocity, more slowly with the handbrake down.
    forwardSpeed = car.vx * forwardX + car.vy * forwardY;
    const lateral = car.vx * rightX + car.vy * rightY;
    const grip = controls.handbrake ? CAR.handbrakeGrip : CAR.grip;
    const reduce = Math.min(1, grip * dt);
    car.vx -= rightX * lateral * reduce;
    car.vy -= rightY * lateral * reduce;

    // Speed caps, with a little extra top end down the boulevard.
    const speed = Math.hypot(car.vx, car.vy);
    const cap = forwardSpeed < -10 ? CAR.maxReverse : CAR.maxSpeed;
    if (speed > cap) {
      car.vx = (car.vx / speed) * cap;
      car.vy = (car.vy / speed) * cap;
    }
    if (throttle <= 0 && brake <= 0) {
      car.vx *= Math.pow(0.36, dt);
      car.vy *= Math.pow(0.36, dt);
    }

    // Steering scales with speed; reversing turns the other way.
    const speedAlong = car.vx * forwardX + car.vy * forwardY;
    const steerAuthority = clamp(Math.abs(speedAlong) / 160, 0, 1);
    const steer = controls.steer;
    if (Math.abs(steer) > 0.01 && Math.abs(speedAlong) > 6) {
      car.angle += steer * CAR.turnRate * steerAuthority * Math.sign(speedAlong) * dt;
    }

    const stepX = car.vx * dt;
    const stepY = car.vy * dt;
    // Snapshot the closing speed: the collision response below reverses most of it, and using the
    // post-bounce velocity made even a head-on crash count as a harmless scratch.
    const impactSpeed = Math.hypot(car.vx, car.vy);
    const nx = car.x + stepX;
    const ny = car.y + stepY;
    let hit = false;
    if (carFits(car, nx, ny, car.angle)) {
      car.x = nx;
      car.y = ny;
    } else if (carFits(car, nx, car.y, car.angle)) {
      car.x = nx;
      car.vy *= -0.18;
      hit = true;
    } else if (carFits(car, car.x, ny, car.angle)) {
      car.y = ny;
      car.vx *= -0.18;
      hit = true;
    } else {
      car.vx *= -0.2;
      car.vy *= -0.2;
      hit = true;
    }
    if (hit && impactSpeed > CAR.impactDamageSpeed) {
      world.damageCar(car, impactSpeed * 0.026, false);
      state.shake = Math.max(state.shake, Math.min(8, impactSpeed / 55));
      world.audio.impact();
    }

    // Count the distance actually travelled, not the intended step into a wall.
    state.distanceDriven += Math.hypot(car.x - startX, car.y - startY);
    player.x = car.x;
    player.y = car.y;
    car.speed = Math.hypot(car.vx, car.vy);

    // Rubber on the road when the handbrake is down hard.
    if (controls.handbrake && car.speed > 120) {
      car.skidTimer = (car.skidTimer ?? 0) - dt;
      if (car.skidTimer <= 0) {
        car.skidTimer = 0.035;
        const back = -car.l * 0.3;
        world.combat.skid(car.x + Math.cos(car.angle) * back, car.y + Math.sin(car.angle) * back, car.angle);
        world.combat.skid(car.x + Math.cos(car.angle) * back + Math.cos(car.angle + Math.PI / 2) * 12, car.y + Math.sin(car.angle) * back + Math.sin(car.angle + Math.PI / 2) * 12, car.angle);
        car.skidSoundTimer = Math.max(0, (car.skidSoundTimer ?? 0) - 0.035);
        if (car.skidSoundTimer <= 0) {
          car.skidSoundTimer = 0.16;
          world.audio.skid();
        }
      }
    }

    // Roadkill: pedestrians and gangsters caught on the bonnet.
    if (car.speed > 80) {
      const headingX = Math.cos(car.angle);
      const headingY = Math.sin(car.angle);
      for (const ped of world.peds.list) {
        if (ped.dead) continue;
        const dx = ped.x - car.x;
        const dy = ped.y - car.y;
        const ahead = dx * headingX + dy * headingY;
        if (ahead > 0 && ahead < car.l / 2 + 8 && Math.abs(dx * -headingY + dy * headingX) < car.w / 2 + 7) {
          world.people.killPed(ped, 'car');
          world.people.scare(ped.x, ped.y, 240);
          world.addWanted(0.75, null);
          state.shake = Math.max(state.shake, 4);
          world.audio.hit();
        }
      }
      for (const man of world.men.list) {
        if (man.dead) continue;
        const dx = man.x - car.x;
        const dy = man.y - car.y;
        const ahead = dx * headingX + dy * headingY;
        if (ahead > 0 && ahead < car.l / 2 + 8 && Math.abs(dx * -headingY + dy * headingX) < car.w / 2 + 7) {
          world.people.damageMan(man, 70, 'car');
          world.damagePlayer(4, 'car');
        }
      }
    }

    // Car against car: a nudge, some paint and a lot of noise.
    for (const other of list) {
      if (other === car || other.kind === 'wreck') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const min = (car.w + other.w) * 0.44;
      const d = Math.hypot(dx, dy);
      if (d > 0.001 && d < min) {
        const push = (min - d) / d;
        car.x -= dx * push * 0.45;
        car.y -= dy * push * 0.45;
        other.x += dx * push * 0.3;
        other.y += dy * push * 0.3;
        const rel = Math.hypot(car.vx - other.vx, car.vy - other.vy);
        if (rel > 90 && car.speed > 60) {
          world.damageCar(other, rel * 0.04, true);
          world.damageCar(car, rel * 0.025, false);
          world.audio.impact();
          state.shake = Math.max(state.shake, 2.5);
          if (other.kind !== 'cop') other.angle += (random() - 0.5) * 0.4;
        }
        car.vx *= 0.72;
        car.vy *= 0.72;
      }
    }

    // Cop cruisers ramming the player.
    for (const cop of list) {
      if (cop.kind !== 'cop') continue;
      const d = distance(cop.x, cop.y, car.x, car.y);
      if (d < 46 && Math.hypot(cop.vx, cop.vy) > 120) {
        world.damagePlayer(2.2, 'ram');
        cop.vx *= 0.8;
        cop.vy *= 0.8;
        state.shake = Math.max(state.shake, 3);
      }
    }
  }

  /* ---------------------------------------------------------------- police cruisers */

  function updateCopCar(car, dt) {
    const targetX = player.x;
    const targetY = player.y;
    const d = distance(car.x, car.y, targetX, targetY);
    if (state.heat <= 0 && d > 820) {
      car.fade = (car.fade ?? 0) + dt;
      if (car.fade > 3) removeCar(car);
      return;
    }
    if (d > 2600) { removeCar(car); return; }

    let desired = Math.atan2(targetY - car.y, targetX - car.x);
    // If a wall blocks the way ahead, swerve around it.
    const ahead = city.raycast(car.x, car.y, Math.cos(car.angle), Math.sin(car.angle), 130);
    if (ahead && ahead.t < 120) {
      const left = Math.atan2(targetY - car.y, targetX - car.x) - 1.25;
      const right = Math.atan2(targetY - car.y, targetX - car.x) + 1.25;
      const leftClear = !city.raycast(car.x, car.y, Math.cos(left), Math.sin(left), 110);
      desired += leftClear ? -1.1 : 1.1;
    }
    const delta = angleDelta(car.angle, desired);
    car.angle += clamp(delta, -2.4 * dt, 2.4 * dt);

    let wantedSpeed = POLICE.carSpeed;
    if (player.inCar) wantedSpeed = d > 220 ? POLICE.carSpeed : 250;
    else wantedSpeed = d > 300 ? POLICE.carSpeed * 0.85 : 90;
    car.speed = lerp(car.speed, wantedSpeed, Math.min(1, dt * 2.4));
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (carFits(car, nx, ny, car.angle)) {
      car.x = nx;
      car.y = ny;
      car.stuckTimer = Math.max(0, car.stuckTimer - dt);
    } else {
      car.stuckTimer += dt;
      car.speed *= 0.4;
      car.angle += (random() - 0.5) * 1.2 + 0.35;
      if (car.stuckTimer > 1.6) {
        car.x -= Math.cos(car.angle) * 12;
        car.y -= Math.sin(car.angle) * 12;
        car.angle += 1.4;
        car.stuckTimer = 0;
      }
    }
    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
    car.deployTimer = Math.max(0, car.deployTimer - dt);

    // Let the officers out once the cruiser is close to a player on foot.
    if (!player.inCar && d < POLICE.deployRange && car.speed < 180 && car.deployTimer <= 0) {
      car.deployTimer = 14;
      const baseAngle = Math.atan2(player.y - car.y, player.x - car.x);
      world.people.spawnCop(car.x + Math.cos(baseAngle + 1.4) * 26, car.y + Math.sin(baseAngle + 1.4) * 26);
      world.people.spawnCop(car.x + Math.cos(baseAngle - 1.4) * 26, car.y + Math.sin(baseAngle - 1.4) * 26);
    }
    // A cruiser that is wrecked loses its lights.
    if (car.health < car.maxHealth * 0.4) car.siren = false;
  }

  function removeCar(car) {
    const index = list.indexOf(car);
    if (index >= 0) list.splice(index, 1);
  }

  /* ---------------------------------------------------------------- public car API */

  function populate() {
    for (let index = 0; index < TRAFFIC.cars; index += 1) {
      const axis = random() < 0.5 ? 'h' : 'v';
      const sign = random() < 0.5 ? 1 : -1;
      const road = intRange(random, 1, CITY.blocks - 1);
      let along = 140 + random() * (CITY.width - 280);
      let point = city.lanePoint(axis, sign, road, along);
      let guard = 0;
      while (distance(point.x, point.y, player.x, player.y) < 260 && guard < 20) {
        along = 140 + random() * (CITY.width - 280);
        point = city.lanePoint(axis, sign, road, along);
        guard += 1;
      }
      makeCar({
        x: point.x, y: point.y, axis, sign, road, kind: 'traffic',
        model: pick(random, MODEL_NAMES),
      });
    }
    for (const spot of city.parkingSpots.slice(0, TRAFFIC.parked)) {
      if (distance(spot.x, spot.y, player.x, player.y) < 90) continue;
      makeCar({
        x: spot.x, y: spot.y, angle: spot.angle, kind: 'parked',
        model: pick(random, MODEL_NAMES), color: pick(random, CAR_COLORS),
      });
    }
    // Cars parked along the kerbs give the streets their shoulders.
    for (let index = 0; index < 26; index += 1) {
      const axis = random() < 0.5 ? 'h' : 'v';
      const road = intRange(random, 1, CITY.blocks - 1);
      const side = random() < 0.5 ? 1 : -1;
      const along = 160 + random() * (CITY.width - 320);
      const offset = side * (CITY.road / 2 - 12);
      const x = axis === 'h' ? along : road * P + offset;
      const y = axis === 'h' ? road * P + offset : along;
      if (city.solidAt(x, y, 24)) continue;
      if (distance(x, y, player.x, player.y) < 140) continue;
      makeCar({
        x, y, kind: 'parked',
        angle: axis === 'h' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2),
        model: pick(random, MODEL_NAMES),
      });
    }
    // The story's car: a cherry-red sports car waiting at the marina.
    world.missionCar = makeCar({
      x: city.storySites.marina.x,
      y: city.storySites.marina.y,
      angle: Math.PI,
      kind: 'special',
      model: 'sports',
      color: { name: 'Torero Red', body: '#d94a3d', roof: '#a8332b' },
      missionTag: 'torero',
    });
    world.missionCar.locked = false;
  }

  function enterCar(car) {
    if (car.kind === 'wreck') return;
    const wasOccupied = car.kind === 'traffic' || car.kind === 'cop';
    const stolenCop = car.kind === 'cop';
    player.inCar = car;
    car.kind = 'player';
    car.parked = false;
    car.siren = false;
    car.speed = Math.hypot(car.vx, car.vy);
    if (wasOccupied) {
      world.people.spawnFleeingDriver(car);
      world.people.scare(car.x, car.y, 230);
      // Base the heat on who saw it; taking a cruiser is its own, much louder statement.
      if (stolenCop) {
        world.addWanted(1.4, 'Stealing a police cruiser');
        world.audio.sirenBlip();
      } else {
        const witnessed = world.nearestOfficer < 620;
        world.addWanted(witnessed ? 0.62 : 0.42, 'Grand theft auto');
        world.audio.horn();
      }
    }
    state.radio = pick(random, RADIO);
    state.radioTimer = 4.5;
    world.notify(`Now playing: ${state.radio}`, '#ffcf5c', 3.2);
    world.emit('enterCar', { car });
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    const side = car.angle + Math.PI / 2;
    let x = car.x + Math.cos(side) * (car.w / 2 + 16);
    let y = car.y + Math.sin(side) * (car.w / 2 + 16);
    if (city.solidAt(x, y, 10)) {
      x = car.x - Math.cos(side) * (car.w / 2 + 16);
      y = car.y - Math.sin(side) * (car.w / 2 + 16);
    }
    if (city.solidAt(x, y, 10)) {
      x = car.x + Math.cos(car.angle) * (car.l / 2 + 14);
      y = car.y + Math.sin(car.angle) * (car.l / 2 + 14);
    }
    player.inCar = null;
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    car.kind = 'parked';
    car.vx = 0;
    car.vy = 0;
    car.speed = 0;
    player.invulnerable = Math.max(player.invulnerable, 0.4);
    world.emit('exitCar', { car });
  }

  function forceExit() {
    const car = player.inCar;
    if (!car) return;
    player.inCar = null;
    player.x = car.x;
    player.y = car.y;
    car.kind = 'wreck';
  }

  function spawnPoliceCar() {
    const point = city.randomRoadPoint(random, player, 780);
    const angle = Math.atan2(player.y - point.y, player.x - point.x);
    const car = makeCar({
      x: point.x, y: point.y, angle, kind: 'cop', model: 'cop',
      color: { name: 'Police', body: '#1c2436', roof: '#e7e4da' },
    });
    car.cruise = POLICE.carSpeed;
    car.siren = true;
    return car;
  }

  function copCount() {
    let count = 0;
    for (const car of list) if (car.kind === 'cop') count += 1;
    return count;
  }

  function update(dt, controls, frozen) {
    for (const car of list.slice()) {
      if (car.kind === 'traffic') updateTraffic(car, dt);
      else if (car.kind === 'cop') {
        car.siren = state.heat > 0 && car.health > car.maxHealth * 0.35;
        updateCopCar(car, dt);
      } else if (car.kind === 'player') {
        if (!frozen) updatePlayerCar(car, dt, controls);
      }
      // Damaged cars smoke and tick before they blow.
      if (car.kind !== 'wreck' && car.health < car.maxHealth * 0.42) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.16 + random() * 0.2;
          world.combat.smoke(car.x + (random() - 0.5) * 16, car.y + (random() - 0.5) * 16);
        }
      }
    }
  }

  function nearest(range = 70) {
    let best = null;
    let bestDistance = range;
    for (const car of list) {
      if (car.kind === 'wreck' || car.kind === 'player') continue;
      const d = distance(car.x, car.y, player.x, player.y);
      if (d < bestDistance) { bestDistance = d; best = car; }
    }
    return best;
  }

  function damageCar(car, amount, byPlayer) {
    if (!car || car.kind === 'wreck' || amount <= 0) return;
    car.health -= amount;
    if (byPlayer && car.kind === 'cop') world.addWanted(0.22, null);
    if (car.health <= 0) world.combat.explodeCar(car, byPlayer);
  }

  return {
    list,
    makeCar,
    populate,
    update,
    enterCar,
    exitCar,
    forceExit,
    spawnPoliceCar,
    copCount,
    nearest,
    removeCar,
    carFits,
    damageCar,
    models: CAR_MODELS,
  };
}
