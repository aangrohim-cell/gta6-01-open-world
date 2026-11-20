// Vehicles: lane-following traffic, carjacking, collisions and police pursuit.
import { ROAD_X, ROAD_Y, COLS, ROWS, CAR_TYPES } from './config.js';
import { solidAt, nearestRoadX, nearestRoadY } from './city.js';
import {
  clamp, dist, angDiff, turnTo, approach, rnd as random, rint,
  pick as choose, chance as maybe,
} from './random.js';

const DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const LANE = 25;

export function carLength(car) { return CAR_TYPES[car.type].h; }
export function carRadius(car) { return CAR_TYPES[car.type].h * 0.46; }

export function makeCar(city, rng, opts = {}) {
  const type = opts.type || choose(rng, ['sedan', 'sedan', 'taxi', 'van', 'sports', 'truck']);
  const spec = CAR_TYPES[type];
  const x = opts.x ?? ROAD_X[2];
  const y = opts.y ?? ROAD_Y[2];
  const a = opts.a ?? 0;
  return {
    x, y, a,
    type,
    name: opts.name || spec.name,
    color: opts.color || choose(rng, ['#d7d9d8', '#3c6d95', '#b64d52', '#e7b850', '#4b8c83', '#7d6f9c', '#d3ccc0', '#2f3742']),
    speed: opts.speed ?? 0,
    targetSpeed: 0,
    hp: type === 'truck' ? 220 : 130,
    maxHp: type === 'truck' ? 220 : 130,
    ai: opts.ai || 'traffic',
    seg: opts.seg || null,
    target: opts.target || null,
    shootCd: 0,
    hornCd: 0,
    smoke: 0,
    wheel: 0,
    flash: 0,
    locked: !!opts.locked,
    missionTag: opts.missionTag || null,
    id: Math.floor(rng() * 1e9),
  };
}

function laneTarget(dir, ix, iy) {
  if (dir === 0) return { x: ROAD_X[ix], y: ROAD_Y[iy] + LANE };
  if (dir === 2) return { x: ROAD_X[ix], y: ROAD_Y[iy] - LANE };
  if (dir === 1) return { x: ROAD_X[ix] - LANE, y: ROAD_Y[iy] };
  return { x: ROAD_X[ix] + LANE, y: ROAD_Y[iy] };
}

function initRoute(car, rng) {
  let ix = 1, iy = 1;
  if (car.a === 0) {
    ix = ROAD_X.findIndex((v) => v > car.x + 30);
    iy = nearestIndex(ROAD_Y, car.y);
  } else if (car.a === Math.PI) {
    ix = ROAD_X.findLastIndex((v) => v < car.x - 30);
    iy = nearestIndex(ROAD_Y, car.y);
  } else if (car.a === Math.PI / 2) {
    iy = ROAD_Y.findIndex((v) => v > car.y + 30);
    ix = nearestIndex(ROAD_X, car.x);
  } else {
    iy = ROAD_Y.findLastIndex((v) => v < car.y - 30);
    ix = nearestIndex(ROAD_X, car.x);
  }
  ix = clamp(ix, 0, COLS - 1);
  iy = clamp(iy, 0, ROWS - 1);
  const dir = car.a === 0 ? 0 : car.a === Math.PI / 2 ? 1 : car.a === Math.PI ? 2 : 3;
  car.seg = { dir, ix, iy };
  car.target = laneTarget(dir, ix, iy);
  // Pull the car into its correct lane immediately.
  if (dir === 0) car.y = ROAD_Y[iy] + LANE;
  else if (dir === 2) car.y = ROAD_Y[iy] - LANE;
  else if (dir === 1) car.x = ROAD_X[ix] - LANE;
  else car.x = ROAD_X[ix] + LANE;
  void rng;
}

function nearestIndex(list, v) {
  let best = 0;
  for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) best = i;
  return best;
}

export function seedTraffic(city, rng, count = 30) {
  const cars = [];
  for (let k = 0; k < count; k++) {
    const dir = rint(rng, 0, 3);
    const ix = rint(rng, 0, COLS - 1);
    const iy = rint(rng, 0, ROWS - 1);
    const x = dir === 1 || dir === 3 ? ROAD_X[ix] + (dir === 1 ? -LANE : LANE) : random(rng, 120, ROAD_X[COLS - 1] + 120);
    const y = dir === 0 || dir === 2 ? ROAD_Y[iy] + (dir === 0 ? LANE : -LANE) : random(rng, 120, ROAD_Y[ROWS - 1] - 60);
    const car = makeCar(city, rng, { x, y, a: dir * Math.PI / 2, ai: 'traffic' });
    car.speed = random(rng, 55, 135);
    initRoute(car, rng);
    cars.push(car);
  }
  // Parked cars fill some of the marked spaces and side streets.
  for (let k = 0; k < city.parking.length; k++) {
    if (!maybe(rng, 0.7)) continue;
    const spot = city.parking[k];
    const car = makeCar(city, rng, { x: spot.x + random(rng, -6, 6), y: spot.y + random(rng, -5, 5), a: spot.a, ai: 'parked' });
    cars.push(car);
  }
  return cars;
}

function nextRoute(car, rng) {
  if (!car.seg) return;
  const { ix, iy } = car.seg;
  let dir = car.seg.dir;
  if (maybe(rng, 0.24)) dir = (dir + (maybe(rng, 0.5) ? 1 : 3)) % 4;
  let nix = ix, niy = iy;
  if (dir === 0) { nix = ix + 1; if (nix >= COLS) { dir = 2; nix = ix - 1; } }
  if (dir === 2) { nix = ix - 1; if (nix < 0) { dir = 0; nix = ix + 1; } }
  if (dir === 1) { niy = iy + 1; if (niy >= ROWS) { dir = 3; niy = iy - 1; } }
  if (dir === 3) { niy = iy - 1; if (niy < 0) { dir = 1; niy = iy + 1; } }
  nix = clamp(nix, 0, COLS - 1);
  niy = clamp(niy, 0, ROWS - 1);
  car.seg = { dir, ix: nix, iy: niy };
  car.target = laneTarget(dir, nix, niy);
}

function blockedAhead(game, car, look = 105) {
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  let nearest = Infinity;
  const front = { x: car.x + fx * look * 0.55, y: car.y + fy * look * 0.55 };
  for (const other of game.cars) {
    if (other === car) continue;
    const dx = other.x - front.x, dy = other.y - front.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > -20 && along < look && side < 46) nearest = Math.min(nearest, Math.hypot(dx, dy));
  }
  const px = front.x - game.player.x, py = front.y - game.player.y;
  const pa = px * fx + py * fy, ps = Math.abs(-px * fy + py * fx);
  if (pa > -10 && pa < look && ps < (game.player.car ? 48 : 30)) nearest = Math.min(nearest, Math.hypot(px, py));
  for (const ped of game.peds) {
    if (!ped.alive) continue;
    const dx = ped.x - front.x, dy = ped.y - front.y;
    const along = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx);
    if (along > -10 && along < look * 0.8 && side < 28) nearest = Math.min(nearest, Math.hypot(dx, dy));
  }
  return nearest;
}

export function updateTraffic(game, dt) {
  const rng = game.rng;
  const cars = game.cars;
  for (const car of cars) {
    if (car.ai !== 'traffic' || car === game.player.car) continue;
    const spec = CAR_TYPES[car.type];
    if (!car.target) initRoute(car, rng);
    if (dist(car.x, car.y, car.target.x, car.target.y) < 48) nextRoute(car, rng);
    let desired = Math.atan2(car.target.y - car.y, car.target.x - car.x);

    // Red lights: halt on one axis on alternating phases.
    const lightPhase = Math.floor(game.time / 7) % 2;
    const seg = car.seg;
    if (seg && dist(car.x, car.y, car.target.x, car.target.y) < 145) {
      const green = (seg.ix + seg.iy + lightPhase + (seg.dir % 2)) % 2 === 0;
      if (!green) car.targetSpeed = approach(car.targetSpeed, 0, 260 * dt);
      else car.targetSpeed = approach(car.targetSpeed, spec.max * 0.5, 150 * dt);
    } else {
      car.targetSpeed = approach(car.targetSpeed, spec.max * 0.52, 100 * dt);
    }

    const ahead = blockedAhead(game, car, 120);
    if (ahead < 110) {
      car.targetSpeed = Math.min(car.targetSpeed, Math.max(0, (ahead - 28) * 2.1));
      if (ahead < 48 && car.speed > 25) {
        car.hornCd -= dt;
        if (car.hornCd <= 0) { car.hornCd = 2.4; game.sound.tone(300, 0.12, 'square', 0.02, -60); }
        desired += (ahead < 34 ? 0.6 : 0.25) * (car.id % 2 ? 1 : -1);
      }
    }
    car.speed = approach(car.speed, car.targetSpeed, (car.speed < car.targetSpeed ? spec.accel : 190) * dt);
    car.a = turnTo(car.a, desired, (2.2 + Math.abs(car.speed) * 0.004) * dt);
    moveCar(cityMove(game.city), car, dt, game);
    car.wheel += car.speed * dt * 0.05;
  }
}

function cityMove(city) { return city; }

export function moveCar(city, car, dt, game, ignoreSolid = false) {
  const steps = Math.max(1, Math.ceil(Math.abs(car.speed * dt) / 12));
  const step = (car.speed * dt) / steps;
  const r = carRadius(car) * 0.82;
  for (let s = 0; s < steps; s++) {
    const nx = car.x + Math.cos(car.a) * step;
    const ny = car.y + Math.sin(car.a) * step;
    if (!ignoreSolid && solidAt(city, nx, ny, r)) {
      car.speed *= 0.25;
      car.a += (car.id % 2 ? 1 : -1) * 0.5;
      if (Math.abs(car.speed) > 50 && game) {
        game.sound.crack();
        game.addParticles(nx, ny, 5, '#ffd37a', 70);
      }
      break;
    }
    car.x = nx;
    car.y = ny;
  }
}

export function spawnPolice(game) {
  const p = game.player;
  const want = Math.min(10, [0, 2, 3, 5, 7, 10][game.stars] || 0);
  const live = game.cars.filter((c) => c.ai === 'police').length;
  let toSpawn = Math.max(0, want - live);
  if (toSpawn <= 0) return;
  const rng = game.rng;
  while (toSpawn-- > 0) {
    const angle = random(rng, 0, Math.PI * 2);
    const r = random(rng, 620, 940);
    let px = clamp(p.x + Math.cos(angle) * r, 100, ROAD_X[COLS - 1] - 60);
    let py = clamp(p.y + Math.sin(angle) * r, 100, ROAD_Y[ROWS - 1] - 60);
    // Place cruisers on the street grid, never inside a building.
    px = nearestRoadX(px) + (rng() > 0.5 ? 26 : -26);
    py = nearestRoadY(py) + (rng() > 0.5 ? 26 : -26);
    const a = Math.atan2(p.y - py, p.x - px);
    const car = makeCar(game.city, rng, { x: px, y: py, a, type: 'police', ai: 'police', color: '#e7ecef' });
    car.speed = 120;
    game.cars.push(car);
  }
}

export function updatePolice(game, dt) {
  const p = game.player;
  const target = p.car ? p.car : p;
  const spec = CAR_TYPES.police;
  for (const car of game.cars) {
    if (car.ai !== 'police') continue;
    const d = dist(car.x, car.y, target.x, target.y);
    if (game.stars === 0 || d > 2100) {
      if (game.stars === 0) car.speed = approach(car.speed, 0, 180 * dt);
      if (d > 2100) car.hp = 0;
      continue;
    }
    let desired = Math.atan2(target.y - car.y, target.x - car.x);
    // Steer around solid obstacles.
    const fx = Math.cos(car.a), fy = Math.sin(car.a);
    if (solidAt(game.city, car.x + fx * 95, car.y + fy * 95, 30)) desired += car.id % 2 ? 0.85 : -0.85;
    const ahead = blockedAhead(game, car, 90);
    if (ahead < 65) {
      car.targetSpeed = Math.min(spec.max, Math.max(70, ahead * 2.6));
      desired += ahead < 40 ? 0.45 : 0.12;
    } else {
      car.targetSpeed = spec.max * (d > 400 ? 0.95 : 0.72);
    }
    car.speed = approach(car.speed, car.targetSpeed, spec.accel * dt);
    car.a = turnTo(car.a, desired, 3.1 * dt);
    moveCar(game.city, car, dt, game);
    car.wheel += car.speed * dt * 0.05;

    if (game.stars >= 2 && !p.car && d < 540 && Math.abs(angDiff(Math.atan2(car.y - p.y, car.x - p.x), car.a)) < 2.4) {
      car.shootCd -= dt;
      if (car.shootCd <= 0) {
        car.shootCd = Math.max(0.55, 1.35 - game.stars * 0.14) + game.rng() * 0.35;
        game.enemyFire(car.x + Math.cos(car.a) * 25, car.y + Math.sin(car.a) * 25, p.x, p.y, car);
      }
    }
  }
  game.cars = game.cars.filter((c) => c.hp > 0 || c.ai !== 'police');
}

export function nearestCar(cars, x, y, radius = 60) {
  let best = null, bestD = radius;
  for (const car of cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function updateCarCollisions(game, dt) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = (carRadius(a) + carRadius(b)) * 0.82;
      if (d >= min) continue;
      const push = (min - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const dv = Math.abs(a.speed) + Math.abs(b.speed);
      if (dv > 110 && a.hitCd !== game.time && b.hitCd !== game.time) {
        a.hitCd = game.time; b.hitCd = game.time;
        game.sound.crack();
        game.addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 5, '#ffd88a', 90);
        a.speed *= 0.7; b.speed *= 0.7;
      }
    }
  }
  void dt;
}
