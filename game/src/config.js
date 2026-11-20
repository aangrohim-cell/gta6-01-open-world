// VICE HARBOR - shared constants. Everything here is original to this entry.
export const VIEW_W = 1280;
export const VIEW_H = 720;

// City grid: twelve by eight blocks, roads between them, coast to the south.
export const CELL = 360;
export const ROAD_W = 96;
export const ROAD_X0 = 180;
export const ROAD_Y0 = 180;
export const COLS = 12;
export const ROWS = 8;
export const ROAD_X = Array.from({ length: COLS }, (_, i) => ROAD_X0 + i * CELL);
export const ROAD_Y = Array.from({ length: ROWS }, (_, i) => ROAD_Y0 + i * CELL);
export const WORLD_W = 4320;
export const WATER_Y = 3060;
export const WORLD_H = 3620;
export const BEACH_Y = 2748;
export const PIER_X = 2880;
export const DOCK_X = 2340;
export const PIER_END = 3540;
export const DOCK_END = 3220;

// Named places, one per city block. These also anchor story missions.
export const PLACES = {
  police: { i: 2, j: 2, name: 'BAY 12 PRECINCT', kind: 'police' },
  hospital: { i: 9, j: 1, name: 'SUNSET MERCY', kind: 'hospital' },
  bank: { i: 6, j: 3, name: 'CORAL FEDERAL', kind: 'bank' },
  club: { i: 8, j: 5, name: 'NEON PALM', kind: 'club' },
  safehouse: { i: 3, j: 5, name: 'CASA CIELO', kind: 'safehouse' },
  warehouse: { i: 7, j: 6, name: 'HARBOR DEPOT 9', kind: 'warehouse' },
  noodles: { i: 5, j: 4, name: 'MR. NOODLE', kind: 'shop' },
  garage: { i: 10, j: 3, name: 'VINCE MOTORS', kind: 'garage' },
};

export function blockCenter(i, j) {
  return { x: ROAD_X0 + i * CELL + CELL / 2, y: ROAD_Y0 + j * CELL + CELL / 2 };
}

export const PALETTE = {
  sand: '#e5c58d',
  sandDark: '#d3ab72',
  water: '#1e6474',
  waterDeep: '#124450',
  waterLight: '#3c92a0',
  foam: '#bfe7dd',
  asphalt: '#333941',
  asphaltLight: '#3d444d',
  sidewalk: '#a7a49a',
  curb: '#c7c1b3',
  line: '#ecd48a',
  grass: '#6f9b62',
  grassDark: '#577f50',
  wood: '#9a6b45',
  woodLight: '#bd8c5c',
  ink: '#1b2028',
  sun: '#ffb463',
  pink: '#ff7b8a',
  cyan: '#6ee7df',
  yellow: '#f7d774',
  red: '#f26b6b',
};

export const WEAPONS = {
  fists: { name: 'FISTS', damage: 17, rate: 0.34, ammo: Infinity, range: 52, spread: 0, speed: 0, kind: 'melee' },
  pistol: { name: 'PISTOL', damage: 31, rate: 0.23, ammo: 48, range: 780, spread: 0.025, speed: 960, kind: 'gun' },
  smg: { name: 'SMG', damage: 16, rate: 0.075, ammo: 180, range: 660, spread: 0.105, speed: 900, kind: 'gun' },
};

export const STAR_HEAT = [0, 12, 30, 50, 70, 90];
export const SAVE_KEY = 'vice_harbor_save_v1';

export const CAR_TYPES = {
  sedan: { w: 46, h: 86, max: 235, accel: 118, color: '#4f7fa8', name: 'SEDAN' },
  sports: { w: 44, h: 82, max: 320, accel: 172, color: '#d8494f', name: 'COUPE' },
  van: { w: 52, h: 100, max: 200, accel: 96, color: '#d8d3c2', name: 'VAN' },
  taxi: { w: 46, h: 86, max: 235, accel: 120, color: '#e8bf4d', name: 'TAXI' },
  truck: { w: 58, h: 118, max: 180, accel: 82, color: '#8a99a3', name: 'TRUCK' },
  police: { w: 48, h: 92, max: 295, accel: 155, color: '#dfe5ea', name: 'CRUISER' },
};
