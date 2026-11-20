// Boot, the fixed-step loop, the title/pause/play screens, the camera and the save slot. This is
// the only module that knows about the browser: the world, the city, the missions and the
// renderer are all plain functions that take the data they need.
//
// ?seed=N fixes the city. ?shot=title|street|cover|mission stages a screenshot scene and paints
// it without running, then sets window.__shotReady for the browser tool.

import { CAMERA, CITY, STEP, VIEW } from './config.js';
import { clamp } from './random.js';
import { createCity } from './city.js';
import { createWorld } from './world.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createWorldRenderer } from './render.js';
import { drawHUD } from './hud.js';
import { drawBusted, drawPause, drawTitle, drawWasted, TITLE_MENU } from './screens.js';
import { readSave, writeSave } from './save.js';
import { buildShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const SEED = Number.isInteger(seedParam) ? seedParam : 20260417;
let activeSeed = SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createWorldRenderer(canvas);
const ctx = renderer.ctx;
const input = createInput(canvas);
const audio = createAudio();
let city = createCity(activeSeed);

let world = null;
let missions = null;
let screen = 'title';
let camera = { x: 2600, y: 4700, zoom: 1 };
let clock = 0;
let lastTime = performance.now();
let accumulator = 0;
let saveCache = readSave();
let menuSelection = saveCache ? 0 : 1;
let menuHover = null;
let lastSaveLabel = '';
let autosaveTimer = 0;
let tutorialTimer = 0;
let tutorialStep = 0;

function announce(text) {
  if (status) status.textContent = text;
}

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function ensureCity(seed) {
  if (!Number.isSafeInteger(seed) || seed === activeSeed) return;
  activeSeed = seed;
  city = createCity(activeSeed);
}

// Browsers can suspend a tab without warning; bank progress before that happens.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'playing') saveNow(true);
});
window.addEventListener('pagehide', () => {
  if (screen === 'playing') saveNow(true);
});

/* ---------------------------------------------------------------- save slot */

function snapshot(forcePosition = false) {
  if (!world) return null;
  const player = world.player;
  const atGarage = missions && missions.active;
  return {
    version: 1,
    citySeed: activeSeed,
    progress: missions ? missions.progress : 0,
    storyComplete: missions ? missions.storyComplete : false,
    money: Math.round(player.money),
    health: Math.max(25, Math.round(player.health)),
    armor: Math.round(player.armor),
    x: atGarage && !forcePosition ? city.storySites.garage.x : Math.round(player.x * 10) / 10,
    y: atGarage && !forcePosition ? city.storySites.garage.y : Math.round(player.y * 10) / 10,
    weapon: player.weapon,
    mag: { ...player.mag },
    reserve: { ...player.reserve },
    tapes: city.tapes.filter((tape) => tape.taken).map((tape) => tape.index),
    updated: Date.now(),
  };
}

function saveNow(quiet = false) {
  if (!world || !missions) return false;
  if (missions.active && !quiet) return false;
  const data = snapshot();
  const ok = writeSave(data);
  if (ok) {
    saveCache = data;
    saveNow.label = `Saved ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    lastSaveLabel = saveNow.label;
  }
  return ok;
}

/* ---------------------------------------------------------------- game setup */

function applySave(data) {
  if (!data) return;
  const player = world.player;
  player.money = Number(data.money) || 750;
  player.health = clamp(Number(data.health) || 100, 25, 100);
  player.armor = clamp(Number(data.armor) || 0, 0, 100);
  player.weapon = data.weapon || 'pistol';
  player.mag = { pistol: data.mag?.pistol ?? 12, smg: data.mag?.smg ?? 0 };
  player.reserve = { pistol: data.reserve?.pistol ?? 48, smg: data.reserve?.smg ?? 0 };
  if (!['fists', 'pistol', 'smg'].includes(player.weapon)) player.weapon = 'pistol';
  if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
    const x = data.x;
    const y = data.y;
    const offsets = [[0, 0], [0, 26], [0, -26], [26, 0], [-26, 0], [0, 52], [0, -52], [52, 0], [-52, 0]];
    for (const [dx, dy] of offsets) {
      if (!city.solidAt(x + dx, y + dy, 12)) {
        player.x = x + dx;
        player.y = y + dy;
        break;
      }
    }
  }
  city.tapes.forEach((tape) => { tape.taken = Array.isArray(data.tapes) && data.tapes.includes(tape.index); });
  world.state.tapes = city.tapes.filter((tape) => tape.taken).length;
  camera.x = player.x;
  camera.y = player.y;
}

function attachEvents() {
  world.onEvent = (type) => {
    if (type === 'missionComplete' || type === 'storyComplete' || type === 'tape' || type === 'service') {
      saveNow(true);
    }
    if (type === 'wasted') announce('Wasted. You wake up at Mercy General.');
    if (type === 'busted') announce('Busted. The police took your guns.');
  };
}

function newGame() {
  ensureCity(SEED);
  city.tapes.forEach((tape) => { tape.taken = false; });
  world = createWorld(city, audio, activeSeed + Math.floor(Math.random() * 10000));
  missions = createMissions(world, 0, false);
  attachEvents();
  world.player.money = 750;
  world.player.x = city.storySites.garage.x;
  world.player.y = city.storySites.garage.y + 12;
  camera = { x: world.player.x, y: world.player.y, zoom: 1 };
  screen = 'playing';
  accumulator = 0;
  autosaveTimer = 0;
  tutorialTimer = 0;
  tutorialStep = 0;
  audio.start();
  world.showDialog([
    { who: 'DEX', text: 'Vice Harbor. Sun, money, and everybody\'s got a price.' },
    { who: 'DEX', text: 'My garage is on your map. Come see me when you want to earn.' },
  ]);
  saveNow(true);
  announce('Vice Harbor. New game started.');
  canvas.style.cursor = 'none';
}

function continueGame() {
  const data = saveCache ?? readSave();
  if (!data) { newGame(); return; }
  if (Number.isSafeInteger(data.citySeed)) ensureCity(data.citySeed);
  city.tapes.forEach((tape) => { tape.taken = false; });
  world = createWorld(city, audio, activeSeed + (data.progress ?? 0) * 37 + 11);
  missions = createMissions(world, data.progress ?? 0, Boolean(data.storyComplete));
  attachEvents();
  applySave(data);
  screen = 'playing';
  accumulator = 0;
  autosaveTimer = 0;
  tutorialTimer = 0;
  tutorialStep = 3;
  audio.start();
  world.notify('Welcome back to Vice Harbor.', '#ffcf5c', 3);
  announce(`Vice Harbor. Continuing at job ${Math.min((data.progress ?? 0) + 1, 6)}.`);
  canvas.style.cursor = 'none';
}

function quitToTitle() {
  if (missions && !missions.active) saveNow(true);
  saveCache = readSave();
  screen = 'title';
  menuSelection = saveCache ? 0 : 1;
  audio.setEngine(0, false);
  audio.setSiren(0);
  announce('Vice Harbor title screen. Enter to start.');
  canvas.style.cursor = 'default';
}

/* ---------------------------------------------------------------- camera */

function updateCamera(dt) {
  if (!world) return;
  const player = world.player;
  const car = player.inCar;
  // The minimap arrow should point where the car is heading, not where the player last walked.
  if (car) player.angle = car.angle;
  const targetX = car ? car.x + car.vx * CAMERA.lookAhead : player.x;
  const targetY = car ? car.y + car.vy * CAMERA.lookAhead : player.y;
  const follow = 1 - Math.exp(-dt * CAMERA.follow * (car ? 0.85 : 1.25));
  camera.x += (targetX - camera.x) * follow;
  camera.y += (targetY - camera.y) * follow;
  const zoomTarget = car ? CAMERA.zoomCar : CAMERA.zoomFoot;
  camera.zoom += (zoomTarget - camera.zoom) * (1 - Math.exp(-dt * CAMERA.shakeDecay * 0.6));
  const halfW = VIEW.width / (2 * camera.zoom);
  const halfH = VIEW.height / (2 * camera.zoom);
  camera.x = clamp(camera.x, halfW, CITY.width - halfW);
  camera.y = clamp(camera.y, halfH, CITY.height - halfH);
}

function aimWorld() {
  return {
    x: camera.x + (input.mouse.x - VIEW.width / 2) / camera.zoom,
    y: camera.y + (input.mouse.y - VIEW.height / 2) / camera.zoom,
  };
}

/* ---------------------------------------------------------------- frame */

function menuClick() {
  const clicks = input.takeClicks();
  if (!clicks.length) return false;
  for (const click of clicks) {
    for (const [name, rect] of Object.entries(TITLE_MENU)) {
      if (click.x > rect.x && click.x < rect.x + rect.w && click.y > rect.y && click.y < rect.y + rect.h) {
        if (name === 'continue') {
          if (saveCache) continueGame();
          else audio.uiBack();
        } else {
          newGame();
        }
        return true;
      }
    }
  }
  return false;
}

function updateTitleMenu() {
  const continueRect = TITLE_MENU.continue;
  const newRect = TITLE_MENU.newGame;
  menuHover = null;
  for (const [name, rect] of Object.entries(TITLE_MENU)) {
    if (input.mouse.x > rect.x && input.mouse.x < rect.x + rect.w && input.mouse.y > rect.y && input.mouse.y < rect.y + rect.h) menuHover = name;
  }
  canvas.style.cursor = menuHover && (menuHover !== 'continue' || saveCache) ? 'pointer' : 'default';
  if (input.pressed('ArrowUp') || input.pressed('KeyW')) {
    menuSelection = menuSelection === 0 ? 1 : 0;
    if (menuSelection === 0 && !saveCache) menuSelection = 1;
    audio.ui();
  }
  if (input.pressed('ArrowDown') || input.pressed('KeyS')) {
    menuSelection = menuSelection === 0 ? 1 : 0;
    if (menuSelection === 0 && !saveCache) menuSelection = 1;
    audio.ui();
  }
  if (menuHover === 'continue' && saveCache) menuSelection = 0;
  if (menuHover === 'newGame') menuSelection = 1;
  const enter = input.pressed('Enter') || input.pressed('Space');
  const clicked = menuClick();
  if (!enter && !clicked) return;
  if (menuSelection === 0 && saveCache) continueGame();
  else newGame();
}

function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.12, (now - lastTime) / 1000);
  lastTime = now;
  clock += raw;

  if (screen === 'title') {
    updateTitleMenu();
    ctx.fillStyle = '#0b0912';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawTitle(ctx, { time: clock, save: saveCache, hover: menuHover, selected: menuSelection });
    input.endFrame();
    return;
  }

  if (!world) { input.endFrame(); return; }

  if (input.pressed('KeyM')) {
    const muted = audio.toggleMute();
    world.notify(muted ? 'Sound off' : 'Sound on', '#b9b0a1', 1.4);
    audio.ui();
  }

  if (screen === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape') || input.pressed('Enter')) {
      screen = 'playing';
      audio.ui();
      canvas.style.cursor = 'none';
    } else if (input.pressed('KeyQ')) {
      audio.uiBack();
      quitToTitle();
    }
    if (input.pressed('F5')) saveNow(true);
    renderer.drawWorld(world, camera, clock);
    drawHUD(ctx, world, camera, { mouse: input.mouse, time: clock, missionSystem: missions });
    drawPause(ctx, world, missions, lastSaveLabel);
    input.endFrame();
    return;
  }

  if (screen !== 'playing') { input.endFrame(); return; }

  // Getting up from WASTED / BUSTED early.
  if (world.state.wasted > 0) {
    if (input.pressed('Enter') || input.pressed('Space')) world.respawn('wasted');
    world.update(raw, {
      moveX: 0, moveY: 0, aimX: 0, aimY: 0, run: false,
      throttle: 0, brake: 0, steer: 0, handbrake: false,
      fire: false, enterPressed: false, hornPressed: false, reloadPressed: false, weaponSlot: null,
    });
    updateCamera(raw);
    renderer.drawWorld(world, camera, clock);
    drawHUD(ctx, world, camera, { mouse: input.mouse, time: clock, missionSystem: missions });
    drawWasted(ctx, world);
    input.endFrame();
    return;
  }
  if (world.state.busted > 0) {
    if (input.pressed('Enter') || input.pressed('Space')) world.respawn('busted');
    world.update(raw, {
      moveX: 0, moveY: 0, aimX: 0, aimY: 0, run: false,
      throttle: 0, brake: 0, steer: 0, handbrake: false,
      fire: false, enterPressed: false, hornPressed: false, reloadPressed: false, weaponSlot: null,
    });
    updateCamera(raw);
    renderer.drawWorld(world, camera, clock);
    drawHUD(ctx, world, camera, { mouse: input.mouse, time: clock, missionSystem: missions });
    drawBusted(ctx, world);
    input.endFrame();
    return;
  }

  if (input.pressed('KeyP') || input.pressed('Escape')) {
    screen = 'paused';
    saveNow(true);
    audio.ui();
    canvas.style.cursor = 'default';
    announce('Paused.');
    input.endFrame();
    return;
  }
  if (input.pressed('F5')) saveNow(true);

  const aim = aimWorld();
  const controls = {
    moveX: (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0),
    moveY: (input.down('KeyS') ? 1 : 0) - (input.down('KeyW') ? 1 : 0),
    aimX: aim.x,
    aimY: aim.y,
    run: input.down('ShiftLeft') || input.down('ShiftRight'),
    throttle: input.down('KeyW') ? 1 : 0,
    brake: input.down('KeyS') ? 1 : 0,
    steer: (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0),
    handbrake: input.down('Space'),
    fire: input.mouse.down || input.mouse.pressed,
    enterPressed: input.pressed('KeyE'),
    hornPressed: input.pressed('KeyH'),
    reloadPressed: input.pressed('KeyR'),
    weaponSlot: input.pressed('Digit1') ? 'fists' : input.pressed('Digit2') ? 'pistol' : input.pressed('Digit3') ? 'smg' : null,
  };

  if (world.state.dialog) {
    const advance = controls.enterPressed || input.pressed('Space') || input.pressed('Enter') || input.mouse.pressed;
    if (advance) world.advanceDialog();
    controls.fire = false;
    controls.enterPressed = false;
    controls.hornPressed = false;
    controls.reloadPressed = false;
    controls.weaponSlot = null;
  }

  // Tutorial nudges for a brand-new run.
  tutorialTimer += raw;
  if (tutorialTimer > 5 && tutorialStep === 0) {
    tutorialStep = 1;
    world.notify('Press E beside a car to steal it.', '#ffcf5c', 3.4);
  } else if (tutorialTimer > 12 && tutorialStep === 1) {
    tutorialStep = 2;
    world.notify('The gold M is Dex\'s garage. Press E there for a job.', '#ffcf5c', 3.8);
  }

  autosaveTimer += raw;
  if (autosaveTimer > 20) {
    autosaveTimer = 0;
    if (!missions.active) saveNow(true);
  }

  accumulator += raw;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    missions.update(STEP, controls);
    world.update(STEP, controls);
    controls.enterPressed = false;
    controls.hornPressed = false;
    controls.reloadPressed = false;
    controls.weaponSlot = null;
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;

  updateCamera(raw);
  audio.resume();

  renderer.drawWorld(world, camera, clock);
  drawHUD(ctx, world, camera, { mouse: input.mouse, time: clock, missionSystem: missions });

  // The story-complete card sits over free roam for a few seconds, then fades.
  if (world.state.storyComplete && world.state.banner?.title === 'THE END') {
    const alpha = Math.min(1, Math.max(0, world.state.banner.life / 1.2));
    ctx.fillStyle = `rgba(8, 6, 14, ${0.2 * alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  if (world.player.inCar) canvas.style.cursor = 'none';
  input.endFrame();
}

/* ---------------------------------------------------------------- shot mode */

function startShot(name) {
  const shot = buildShot(name, SEED);
  canvas.style.cursor = 'none';
  fitCanvas();
  window.__game = shot;
  if (shot.screen === 'title') {
    let frames = 0;
    const paint = () => {
      ctx.fillStyle = '#0b0912';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawTitle(ctx, { time: shot.time, save: shot.titleSave, selected: 0, hover: null });
      frames += 1;
      if (frames >= 3) window.__shotReady = true;
      else requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
    return;
  }
  let frames = 0;
  const paint = () => {
    renderer.drawWorld(shot.world, shot.camera, shot.time);
    drawHUD(ctx, shot.world, shot.camera, { mouse: shot.mouse, time: shot.time, missionSystem: shot.missions });
    frames += 1;
    if (frames >= 3) window.__shotReady = true;
    else requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);
  window.__game = shot;
}

if (shotName) {
  startShot(shotName);
} else {
  announce('Vice Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
  window.__game = { get world() { return world; }, get missions() { return missions; }, get screen() { return screen; } };
}
