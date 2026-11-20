// Every tunable number and colour for VICE HARBOR, in one place. The simulation runs in
// world pixels (one metre is about four pixels) and draws through a fixed 1280x720 camera.

export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

/** The city: blocks at a 400 px pitch, 112 px roads, 26 px sidewalks, and a beach to the south. */
export const CITY = {
  blocks: 16,
  pitch: 400,
  road: 112,
  lane: 28,
  sidewalk: 26,
  beachDepth: 340,
  seaDepth: 460,
  /** The whole map, including the sea. */
  get width() { return this.blocks * this.pitch; },
  get landHeight() { return this.blocks * this.pitch; },
  get height() { return this.blocks * this.pitch + this.beachDepth + this.seaDepth; },
};

export const PLAYER = {
  radius: 10,
  walkSpeed: 172,
  runSpeed: 268,
  accel: 1800,
  maxHealth: 100,
  maxArmor: 100,
  respawnHealth: 100,
  hurtInvulnerable: 0.45,
};

export const FOOT = {
  /** How close a car has to be, in px, to get in. */
  enterRange: 64,
  interactRange: 66,
};

export const CAR = {
  /** Forward acceleration, px/s^2. */
  accel: 430,
  reverseAccel: 260,
  brake: 780,
  drag: 0.92,
  maxSpeed: 545,
  maxReverse: 195,
  turnRate: 2.85,
  grip: 7.2,
  handbrakeGrip: 1.6,
  health: 240,
  explodeDamage: 95,
  explodeRadius: 150,
  /** Impact speed above which a wall or kerb scratches the paint. */
  impactDamageSpeed: 70,
};

export const WEAPONS = {
  fists: { name: 'FISTS', damage: 16, range: 34, cooldown: 0.34, melee: true, mag: 0, spread: 0 },
  pistol: { name: 'PISTOL', damage: 27, range: 640, cooldown: 0.24, mag: 12, reload: 1.05, spread: 0.035, ammo: 48 },
  smg: { name: 'SMG', damage: 17, range: 690, cooldown: 0.075, mag: 30, reload: 1.5, spread: 0.085, ammo: 120 },
};

export const WANTED = {
  max: 5,
  /** Seconds without a crime, out of sight of police, before one star fades. */
  coolDelay: 8.5,
  coolPerStar: 6.2,
  /** How far the nearest officer has to be for the player to count as unseen. */
  unseenDistance: 540,
  spawnInterval: 3.1,
  /** An officer this close on foot starts a bust; the player has this long to break away. */
  bustDistance: 62,
  bustDelay: 1.7,
};

export const POLICE = {
  carHealth: 300,
  carSpeed: 470,
  manHealth: 110,
  manSpeed: 135,
  bulletDamage: 7,
  fireCooldown: 0.85,
  range: 360,
  accuracy: 0.62,
  /** How near a police car stops and lets its officers out. */
  deployRange: 250,
};

export const GANG = {
  health: 105,
  speed: 140,
  damage: 10,
  range: 330,
  accuracy: 0.55,
  fireCooldown: 0.7,
};

export const TRAFFIC = {
  cars: 82,
  parked: 46,
  speedMin: 132,
  speedMax: 196,
  pedCount: 196,
  pedSpeed: 34,
};

/** Loot tables. Kept here so balancing a drop never means hunting through people.js. */
export const LOOT = {
  copArmor: 0.34,
  gangArmor: 0.16,
  gangHealth: 0.35,
  pedArmor: 0.02,
  /** SMG-toting crews sometimes leave a magazine with their name on it. */
  smgAmmo: 0.24,
};

export const PALETTE = {
  sea: '#2a6b86',
  seaDeep: '#1d4e69',
  sand: '#dfc28a',
  sandLight: '#ecd4a3',
  asphalt: '#4b4754',
  asphaltDark: '#413e4b',
  sidewalk: '#b9ae9f',
  curb: '#9a9084',
  grass: '#6f8b52',
  grassDark: '#5c7742',
  land: '#8d8678',
  shadow: 'rgba(26, 22, 38, 0.26)',
  text: '#f6f1e6',
  muted: '#b9b0a1',
  money: '#9fe870',
  gold: '#ffcf5c',
  police: '#4d8bff',
  danger: '#ff5a5a',
  panel: 'rgba(16, 14, 24, 0.78)',
  panelLine: 'rgba(255, 240, 214, 0.18)',
};

/** Body colours for traffic and parked cars, keyed to a little name for the HUD. */
export const CAR_COLORS = [
  { name: 'Torero Red', body: '#d94a3d', roof: '#a8332b' },
  { name: 'Ocean Teal', body: '#2f8f95', roof: '#226b70' },
  { name: 'Cream', body: '#e8dfc6', roof: '#c4bba3' },
  { name: 'Night Navy', body: '#33456b', roof: '#22304d' },
  { name: 'Sunset Orange', body: '#e88a3c', roof: '#b4662a' },
  { name: 'Palm Green', body: '#5a8f5f', roof: '#3f6c44' },
  { name: 'Grape', body: '#7a5b96', roof: '#5a4170' },
  { name: 'Pearl White', body: '#ece9e2', roof: '#c8c5be' },
  { name: 'Taxi Yellow', body: '#f2c23f', roof: '#c99b22', taxi: true },
  { name: 'Midnight', body: '#26242d', roof: '#17161d' },
  { name: 'Coral Pink', body: '#e3919b', roof: '#b96c76' },
  { name: 'Harbor Slate', body: '#6c7f8d', roof: '#4d5e6a' },
];

/** The character's clothes, so the player reads clearly against the crowd. */
export const PLAYER_LOOK = { shirt: '#f4f0e6', jacket: '#1f2a3a', pants: '#2e3440', skin: '#c98d63', hair: '#241a17' };

export const FONT = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
export const FONT_TITLE = 'Impact, "Arial Narrow", "Arial Black", system-ui, sans-serif';
export const FONT_MONO = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';

export const SAVE_KEY = 'viceharbor.save.v1';

/** How far the camera leads the car, and how quickly it settles. */
export const CAMERA = { follow: 6, lookAhead: 0.34, zoomFoot: 1, zoomCar: 0.94, shakeDecay: 6 };
