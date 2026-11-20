// Deterministic scene set-ups used by the four hand-in screenshots.
import { PIER_X, PIER_END, DOCK_X, DOCK_END, ROAD_X, ROAD_Y } from './config.js';
import { makeCar } from './cars.js';
import { spawnRivals, makePed } from './people.js';
import { spawnPolice } from './cars.js';
import { makePickup } from './combat.js';

export function setupShot(scene, seed, game, input) {
  game.reset(seed);
  game.input = input;
  game.time = 11.5;
  game.mode = scene === 'title' ? 'title' : 'play';
  game.titleSel = 0;
  game.dialogue = null;
  game.missionBanner = null;
  game.notices = [];
  game.rng = game.rng;

  if (input) {
    input.mouse.x = 830;
    input.mouse.y = 300;
  }

  if (scene === 'cover') setupCover(game);
  else if (scene === 'marina') setupMarina(game);
  else if (scene === 'pier') setupPier(game);
  else if (scene === 'title') setupTitle(game);
  else setupCover(game);

  if (game.mode === 'play') game.snapCamera();
  return game;
}

function setupCover(game) {
  const p = game.player;
  const car = makeCar(game.city, game.rng, {
    x: ROAD_X[6] + 30, y: ROAD_Y[3] + 25, a: -0.08,
    type: 'sports', color: '#d8434b', ai: 'player',
  });
  car.speed = 205;
  game.cars.push(car);
  p.car = car;
  p.x = car.x; p.y = car.y; p.a = car.a;
  p.aim = -0.35;
  p.weapon = 'pistol';
  p.ammo.pistol = 27;
  p.money = 8420;

  game.mission.index = 3;
  game.mission.stage = 2;
  game.mission.active = true;
  game.mission.data = { robbed: true };
  game.setHeat(76);
  game.lastCrime = 'bank robbery';

  // Visible cruisers box the player in.
  spawnPolice(game);
  const cops = game.cars.filter((c) => c.ai === 'police');
  const spots = [
    { x: car.x + 250, y: car.y + 150, a: Math.PI * 0.85, s: 190 },
    { x: car.x - 215, y: car.y - 128, a: 0.3, s: 170 },
    { x: car.x + 90, y: car.y - 205, a: 1.8, s: 150 },
  ];
  for (let i = 0; i < cops.length && i < spots.length; i++) {
    cops[i].x = spots[i].x;
    cops[i].y = spots[i].y;
    cops[i].a = spots[i].a;
    cops[i].speed = spots[i].s;
  }
  // Traffic ahead in the adjacent lane, and a truck crossing the intersection.
  const ahead = makeCar(game.city, game.rng, { x: car.x + 165, y: ROAD_Y[3] + 25, a: 0, type: 'sedan', color: '#d9d5c9' });
  ahead.speed = 90; ahead.ai = 'traffic';
  game.cars.push(ahead);
  const crossing = makeCar(game.city, game.rng, { x: ROAD_X[6] - 25, y: ROAD_Y[3] - 150, a: Math.PI / 2, type: 'truck', color: '#6e8b9a' });
  crossing.speed = 80; crossing.ai = 'traffic';
  game.cars.push(crossing);

  game.addParticles(car.x + 24, car.y - 8, 7, '#ffe0a0', 120);
  game.addParticles(car.x - 30, car.y + 14, 5, '#ffb36e', 70);
  game.shake = 3;
  game.notify('BANK ROBBERY IN PROGRESS', '#f26b6b');
  game.dialogue = { speaker: 'DISPATCH', line: 'All units, suspect is a red coupe near Coral Federal. Intercept!', ttl: 30 };
  game.snapCamera();
}

function setupMarina(game) {
  const p = game.player;
  p.x = DOCK_X + 30;
  p.y = 3020;
  p.aim = 0.9;
  p.weapon = 'smg';
  p.unlocked.smg = true;
  p.ammo.smg = 118;
  p.health = 76;
  p.armour = 52;
  p.money = 5680;

  game.mission.index = 5;
  game.mission.stage = 0;
  game.mission.active = true;
  game.mission.data = {};
  game.setHeat(34);
  game.lastCrime = 'harbor standoff';

  spawnRivals(game, [
    { x: DOCK_X + 46, y: DOCK_END + 6 },
    { x: DOCK_X - 44, y: DOCK_END - 18 },
  ], 'final-crew');
  for (let k = 0; k < 5; k++) {
    const ped = makePed(game.rng, DOCK_X - 120 + k * 58, 2990 + (k % 2) * 30);
    ped.flee = 3;
    game.peds.push(ped);
  }
  makePickup(game, DOCK_X + 82, 3070, 'money', 120);
  makePickup(game, DOCK_X - 90, 3085, 'health', 30);
  game.dialogue = { speaker: 'FRANKIE', line: 'Marina’s quiet tonight. Too quiet. Watch the float.', ttl: 30 };
  game.notify('TWO STARS - POLICE SCANNING THE DOCKS', '#f26b6b');
  game.cameraLock = true;
  game.camera.x = DOCK_X + 30;
  game.camera.y = 3055;
}

function setupPier(game) {
  const p = game.player;
  p.x = PIER_X - 10;
  p.y = PIER_END - 66;
  p.aim = -1.25;
  p.weapon = 'pistol';
  p.ammo.pistol = 31;
  p.health = 64;
  p.armour = 18;
  p.money = 9840;

  game.mission.index = 2;
  game.mission.stage = 1;
  game.mission.active = true;
  game.mission.data = { kills: 1, killsTarget: 3 };
  game.setHeat(52);
  game.lastCrime = 'shooting on the pier';

  spawnRivals(game, [
    { x: PIER_X - 48, y: PIER_END - 40 },
    { x: PIER_X + 54, y: PIER_END - 20 },
    { x: PIER_X + 6, y: PIER_END + 6 },
  ], 'pier-crew');
  game.addParticles(PIER_X + 20, PIER_END - 52, 9, '#ffe2a0', 150);
  game.addParticles(PIER_X - 20, PIER_END - 30, 6, '#ff9c7a', 100);
  game.bullets.push({
    x: PIER_X + 28, y: PIER_END - 58, vx: -260, vy: 120,
    life: 0.8, damage: 30, friendly: true, color: '#ffe38a', trail: 12,
  });
  game.dialogue = { speaker: 'CREW BOSS', line: 'This pier belongs to us, sunshine!', ttl: 30 };
  game.notify('CREW DOWN  1/3', '#ff9b9b');
  game.cameraLock = true;
  game.camera.x = PIER_X;
  game.camera.y = PIER_END - 120;
}

function setupTitle(game) {
  game.mode = 'title';
  game.titleSel = 0;
  game.cameraLock = true;
  game.camera.x = 2100;
  game.camera.y = 1280;
  game.player.x = 2100;
  game.player.y = 1280;
  game.time = 8;
}
