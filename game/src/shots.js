// The four screenshot scenes behind ?shot=title|street|cover|mission. Each one builds a real city
// from the same generator the game uses, stages the player, the cars, the crowd and the police in
// a moment worth photographing, and hands the frame to main.js to paint. Nothing is faked inside
// the renderer: these are the same cars, people, HUD panels and sunset the players see.

import { createCity } from './city.js';
import { createWorld } from './world.js';
import { createMissions } from './missions.js';
import { VIEW } from './config.js';

/** The world calls into the audio graph a lot; a still frame wants none of it. */
const SILENT = new Proxy({}, { get: () => () => {} });

function boot(seed) {
  const city = createCity(seed);
  const world = createWorld(city, SILENT, seed ^ 0x2f6f2b17);
  return { city, world };
}

/** A Torero-shaped hole in the traffic, moved wherever the shot needs it. */
function placeMissionCar(world, x, y, angle) {
  const car = world.missionCar;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.kind = 'player';
  car.parked = false;
  car.vx = Math.cos(angle) * 300;
  car.vy = Math.sin(angle) * 300;
  car.health = car.maxHealth;
  world.player.inCar = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  return car;
}

function policeCar(world, x, y, angle) {
  const car = world.cars.makeCar({
    x, y, angle, kind: 'cop', model: 'cop',
    color: { name: 'Police', body: '#1c2436', roof: '#e7e4da' },
  });
  car.cruise = 470;
  car.siren = true;
  car.vx = Math.cos(angle) * 380;
  car.vy = Math.sin(angle) * 380;
  return car;
}

function traffic(world, x, y, angle, model = 'sedan') {
  const car = world.cars.makeCar({ x, y, angle, kind: 'traffic', model });
  car.cruise = 170;
  car.vx = Math.cos(angle) * 150;
  car.vy = Math.sin(angle) * 150;
  return car;
}

function ped(world, x, y, angle, kind = 'ped') {
  const person = world.people.makePed(x, y, { kind });
  person.x = x;
  person.y = y;
  person.angle = angle;
  person.walkPhase = 1.2;
  return person;
}

function pickup(world, type, x, y, value, extra = {}) {
  world.addPickup(type, x, y, value, { bob: 1.4, ...extra });
}

/* ------------------------------------------------------------------ title */

function titleShot() {
  // A believable mid-story save so the menu shows the CONTINUE row filled in.
  return {
    screen: 'title',
    time: 3.6,
    titleSave: { progress: 2, money: 18750, tapes: 3, health: 100, armor: 0 },
    mouse: { x: VIEW.width / 2, y: VIEW.height / 2 },
  };
}

/* ------------------------------------------------------------------ street: the marina on foot */

function streetShot(seed) {
  const { world } = boot(seed);
  const missions = createMissions(world, 0, false);
  const player = world.player;

  // Late afternoon by the marina: the Torero on the sand, the pier to the south, a cruiser rolling up.
  player.x = 5520;
  player.y = 6636;
  player.angle = 0.4;
  player.aimAngle = 0.4;
  player.weapon = 'pistol';
  player.mag.pistol = 12;
  player.health = 96;
  player.money = 1240;
  player.walkPhase = 2.4;
  player.invulnerable = 0;
  world.state.time = 18;
  world.setHeat(1);
  world.state.wantedFlash = 0;
  world.state.shotsFired = 4;

  const torero = world.missionCar;
  torero.x = 5600;
  torero.y = 6556;
  torero.angle = -0.42;
  torero.kind = 'special';
  torero.vx = 0;
  torero.vy = 0;

  // An officer already sniffing around it, and the beach crowd.
  const cop = world.people.spawnCop(5664, 6684);
  cop.x = 5664;
  cop.y = 6684;
  cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.state = 'idle';
  cop.walkPhase = 3.1;
  const copCar = policeCar(world, 5786, 6428, -2.6);
  copCar.vx = 0;
  copCar.vy = 0;
  ped(world, 5296, 6574, 1.2, 'beach');
  ped(world, 5372, 6700, -0.6, 'beach');
  ped(world, 5352, 6560, 1.8, 'beach');
  ped(world, 5412, 6726, 0.4, 'beach');
  ped(world, 5836, 6710, -2.2, 'beach');
  ped(world, 5976, 6614, 2.6, 'beach');
  ped(world, 5080, 6608, -1.1, 'beach');
  ped(world, 5712, 6856, 0.9, 'beach');
  ped(world, 5232, 6464, 2.4, 'beach');
  ped(world, 5456, 6808, -2.1, 'beach');
  ped(world, 5904, 6484, 1.4, 'beach');
  ped(world, 6028, 6788, -0.8, 'beach');
  traffic(world, 5320, 6396, Math.PI, 'coupe');
  pickup(world, 'cash', 5468, 6488, 120);
  pickup(world, 'armor', 5628, 6404, 35);

  world.setObjective({
    title: 'SUNSET SCORE',
    text: 'Steal the cherry Torero at the marina',
    timer: 154,
    total: 190,
    index: 0,
  });
  world.setMarkers([{ x: torero.x, y: torero.y, r: 46, kind: 'vehicle' }]);
  world.state.radio = 'WAVE 89.1';
  world.state.radioTimer = 3;

  world.combat.flash(torero.x + 8, torero.y - 18, 0.4, 8);

  return {
    world,
    missions,
    camera: { x: 5552, y: 6600, zoom: 1.34 },
    screen: 'playing',
    time: 14.2,
    mouse: { x: 790, y: 472 },
  };
}

/* ------------------------------------------------------------------ cover: the beach boulevard chase */

function coverShot(seed) {
  const { world } = boot(seed);
  const missions = createMissions(world, 0, false);
  const player = world.player;

  // East through downtown, three stars and a pair of cruisers on the bumper.
  const torero = placeMissionCar(world, 3000, 4028, 0);
  torero.vx = 470;
  torero.vy = 0;
  player.weapon = 'pistol';
  player.mag.pistol = 6;
  player.reserve.pistol = 36;
  player.health = 74;
  player.armor = 42;
  player.money = 3420;
  world.state.time = 52;
  world.state.shotsFired = 38;
  world.state.kills = 4;
  world.state.distanceDriven = 1840;
  world.setHeat(3);
  world.state.wantedFlash = 0;

  // The pursuit, nose to tail and closing.
  const copA = policeCar(world, 2886, 4028, 0);
  copA.x = 2886;
  const copB = policeCar(world, 2792, 3972, 0);
  copB.x = 2792;
  policeCar(world, 3392, 3972, Math.PI);

  // One cruiser already went up in smoke behind them.
  const wreck = world.cars.makeCar({
    x: 2624, y: 3972, angle: 0.4, kind: 'wreck', model: 'cop',
    color: { name: 'Police', body: '#1c2436', roof: '#e7e4da' },
  });
  wreck.health = 0;
  for (let index = 0; index < 2; index += 1) world.combat.smoke(2618 + index * 10, 3966 + (index % 2) * 8);

  // Traffic, so the road reads busy and the chase has to weave.
  traffic(world, 3252, 4028, 0, 'sedan');
  traffic(world, 3166, 3972, Math.PI, 'taxi');
  traffic(world, 3480, 3972, Math.PI, 'van');
  traffic(world, 2900, 3972, Math.PI, 'sports');
  traffic(world, 3120, 4104, 0, 'pickup');
  traffic(world, 2760, 4104, Math.PI, 'sedan');
  traffic(world, 3620, 4028, 0, 'van');
  traffic(world, 3378, 3880, Math.PI, 'coupe');
  traffic(world, 3088, 3880, 0, 'sedan');
  traffic(world, 3696, 3880, Math.PI, 'pickup');
  traffic(world, 3724, 4104, 0, 'taxi');
  policeCar(world, 2690, 4104, 0.5);

  // Dropped loot from the pursuit, close enough to read but out of the collector's reach.
  pickup(world, 'armor', 3112, 4082, 40);
  pickup(world, 'health', 2952, 4082, 35);
  pickup(world, 'ammo', 3268, 4082, 30);
  pickup(world, 'cash', 3416, 4082, 180);

  // Skid marks from the chase so far, plus a little tyre smoke.
  for (let index = 0; index < 15; index += 1) {
    const x = torero.x - index * 26;
    world.combat.skid(x, torero.y - 16, 0);
    if (index % 3 === 0) world.combat.skid(x, torero.y + 16, 0);
  }
  world.combat.smoke(copA.x - 26, copA.y + 10);
  world.combat.smoke(copB.x - 20, copB.y - 8);

  // The player answering the pursuit out of the window.
  world.combat.flash(torero.x - 26, torero.y - 10, Math.PI + 0.3, 16);
  world.combat.tracer(torero.x - 22, torero.y - 10, copA.x + 30, copA.y, '#ffd27a');
  world.combat.impact(copA.x + 24, copA.y + 2, 0, '#ffcf8a');
  world.combat.tracer(copB.x + 26, copB.y - 8, torero.x - 32, torero.y - 12, '#a8c8ff');
  world.combat.flash(copB.x + 24, copB.y - 8, 0, 12);
  world.combat.flash(2630, 3970, 0.4, 22);
  world.combat.impact(copA.x + 30, copA.y - 6, 0.2, '#ffd27a');

  // People on the pavement, watching it go by.
  ped(world, 2870, 4094, 0.2);
  ped(world, 3210, 4090, 3.0);
  ped(world, 3322, 4096, -0.4);
  ped(world, 2680, 4108, 2.2);
  ped(world, 3062, 4106, -1.4, 'beach');
  ped(world, 3528, 4102, 0.8);
  ped(world, 3660, 3900, -2.4);
  ped(world, 2796, 3892, 1.6);
  ped(world, 3018, 3898, -2.6);
  ped(world, 3244, 3894, 0.6);
  ped(world, 3564, 3896, -1.2);
  ped(world, 3788, 4106, 2.8);
  ped(world, 2608, 3888, -0.5);

  world.setObjective({
    title: 'SUNSET SCORE',
    text: "Take the Torero to Dex's garage — lose the heat",
    timer: 132,
    total: 190,
    index: 0,
  });
  world.setMarkers([{ x: 2600, y: 4700, r: 62, kind: 'objective' }]);

  const camera = { x: 3078, y: 3996, zoom: 1.02 };
  return { world, missions, camera, screen: 'playing', time: 31.4, mouse: { x: 383, y: 382 } };
}

/* ------------------------------------------------------------------ mission: the pier gunfight */

function missionShot(seed) {
  const { world } = boot(seed);
  const missions = createMissions(world, 3, false);
  const player = world.player;

  // The fight has spilled off the planks onto the sand at the pier's landward end: beach and
  // palms behind the crew, the sea across the bottom of the frame, the deck running through it.
  player.x = 5664;
  player.y = 6664;
  player.angle = -0.18;
  player.aimAngle = -0.12;
  player.weapon = 'smg';
  player.mag.smg = 22;
  player.reserve.smg = 90;
  player.health = 58;
  player.armor = 34;
  player.money = 12480;
  player.walkPhase = 4.8;
  world.state.time = 87;
  world.setHeat(4);
  world.state.wantedFlash = 0;
  world.state.kills = 11;

  // Vic's crew around the pier entrance, mid-firefight.
  const crew = world.people.spawnGang(5800, 6590, 5, { tag: 'rival', aggroRange: 900 });
  const arranged = [
    { x: 5776, y: 6552, angle: 1.5 },
    { x: 5820, y: 6568, angle: 1.8 },
    { x: 5862, y: 6602, angle: 2.1 },
    { x: 5900, y: 6570, angle: 2.5 },
    { x: 5792, y: 6624, angle: 1.9 },
  ];
  crew.forEach((man, index) => {
    const spot = arranged[index % arranged.length];
    man.x = spot.x;
    man.y = spot.y;
    man.angle = spot.angle;
    man.state = 'aim';
    man.walkPhase = 2 + index;
  });

  // Two already down on the sand and the boards.
  const fallen = world.people.spawnGang(5780, 6640, 2, { tag: 'rival' });
  fallen[0].x = 5744;
  fallen[0].y = 6618;
  fallen[0].dead = true;
  fallen[0].angle = 0.8;
  fallen[1].x = 5866;
  fallen[1].y = 6530;
  fallen[1].dead = true;
  fallen[1].angle = -0.4;

  // A gang sedan parked across the pier mouth, and smoke from the shooting.
  const getaway = traffic(world, 5886, 6668, Math.PI * 0.82, 'sports');
  getaway.vx = 0;
  getaway.vy = 0;
  getaway.kind = 'parked';
  getaway.color = { name: 'Midnight', body: '#242334', roof: '#15141f' };

  // A cruiser and two officers cordon the street behind the firefight.
  policeCar(world, 6224, 6400, -2.4);
  const backupA = world.people.spawnCop(6136, 6444);
  backupA.angle = -2.2;
  backupA.state = 'idle';
  const backupB = world.people.spawnCop(6312, 6432);
  backupB.angle = -2.6;
  backupB.state = 'idle';

  // Smoke, muzzle flashes and tracer fire across the beach.
  for (let index = 0; index < 5; index += 1) world.combat.smoke(5760 + index * 26, 6570 + (index % 2) * 34);
  world.combat.flash(player.x + 24, player.y - 24, -0.1, 18);
  world.combat.tracer(player.x + 28, player.y - 26, 5776, 6552, '#ffd27a');
  world.combat.tracer(5862, 6602, player.x + 20, player.y - 30, '#ffb46a');
  world.combat.tracer(5792, 6624, player.x + 6, player.y - 26, '#ffb46a');
  world.combat.blood(5744, 6618);
  world.combat.impact(5822, 6650, 2.2, '#ffcf8a');
  world.combat.skid(player.x - 20, player.y + 18, 0.4);

  world.showDialog([
    { who: 'VIC', text: "You're late, courier. And you brought the whole neighborhood." },
  ]);
  world.state.dialog.revealed = 99;
  world.state.dialog.timer = 1.8;

  world.setObjective({
    title: 'THE DROP',
    text: "Deal with Vic's crew",
    timer: 176,
    total: 260,
    index: 3,
  });
  world.setMarkers([{ x: 5836, y: 6592, r: 100, kind: 'kill' }]);

  // A few beach-goers scattering along the sand.
  ped(world, 5472, 6588, 0.2, 'beach');
  ped(world, 5506, 6722, -0.4, 'beach');
  ped(world, 6088, 6604, 2.8, 'beach');
  ped(world, 5992, 6766, 2.2, 'beach');
  ped(world, 5688, 6802, -1.1, 'beach');
  ped(world, 5368, 6504, 1.2, 'beach');
  ped(world, 6176, 6588, -2.2, 'beach');
  ped(world, 6248, 6724, 2.6, 'beach');
  pickup(world, 'armor', 5612, 6698, 30);
  pickup(world, 'health', 5928, 6694, 40);
  pickup(world, 'ammo', 5536, 6602, 36);
  pickup(world, 'ammo', 5688, 6708, 24, { weapon: 'smg' });
  pickup(world, 'cash', 6024, 6568, 220);

  return {
    world,
    missions,
    camera: { x: 5768, y: 6618, zoom: 1.36 },
    screen: 'playing',
    time: 44.6,
    mouse: { x: 762, y: 288 },
  };
}

export function buildShot(name, seed) {
  if (name === 'title') return titleShot();
  if (name === 'street') return streetShot(seed);
  if (name === 'mission') return missionShot(seed);
  return coverShot(seed);
}
