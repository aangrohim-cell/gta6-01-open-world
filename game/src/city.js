// Procedural city layout for VICE HARBOR. Deterministic from a seed; no external art.
import {
  CELL, ROAD_W, ROAD_X0, ROAD_Y0, ROAD_X, ROAD_Y, COLS, ROWS,
  WORLD_W, WATER_Y, WORLD_H, BEACH_Y, PIER_X, DOCK_X, PIER_END, DOCK_END,
  PLACES, blockCenter, PALETTE,
} from './config.js';
import { makeRng, rnd, rint, pick, chance, clamp, inRect, circleRect, dist } from './random.js';

const BUILDING_COLORS = [
  ['#c98f72', '#9d6a58'], ['#dcb487', '#ad8665'], ['#b88f9f', '#8c6b78'],
  ['#93a6ad', '#687d85'], ['#d1a98d', '#a17d68'], ['#a9a6c0', '#7e7b95'],
  ['#e0bd93', '#af8e70'], ['#8fa9a0', '#66827a'],
];
const ROOF_COLORS = ['#6b7079', '#777b83', '#646a73', '#7d7a78', '#5f686f'];
const SIGNS = [
  'MOTEL', 'BAYVIEW', 'CORAL', 'SUNSET', 'ARCADE', 'LAUNDRY', 'PIZZA', 'RECORDS',
  'MOTORS', 'FLORIST', 'CAFE', 'HOTEL', 'REALS', 'STUDIO', 'MARINA', 'GROCERY',
];

export function createCity(seed = 7) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const props = [];
  const parks = [];
  const lots = [];
  const parking = [];
  const specials = {};
  const boats = [];

  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const bx0 = ROAD_X0 + i * CELL + ROAD_W / 2 + 8;
      const by0 = ROAD_Y0 + j * CELL + ROAD_W / 2 + 8;
      const bx1 = ROAD_X0 + (i + 1) * CELL - ROAD_W / 2 - 8;
      const by1 = ROAD_Y0 + (j + 1) * CELL - ROAD_W / 2 - 8;
      const block = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, i, j };
      const named = Object.entries(PLACES).find(([, p]) => p.i === i && p.j === j);

      if (named) {
        const [key, place] = named;
        const b = makeBuilding(rng, block.x + 6, block.y + 6, block.w - 12, block.h - 12, place.kind, place.name);
        b.placeKey = key;
        buildings.push(b);
        specials[key] = b;
        continue;
      }

      const roll = rng();
      if (roll < 0.11) {
        parks.push(block);
        props.push({ type: 'fountain', x: block.x + block.w / 2, y: block.y + block.h / 2 });
        for (let k = 0; k < 7; k++) {
          props.push({
            type: 'tree',
            x: rnd(rng, block.x + 18, block.x + block.w - 18),
            y: rnd(rng, block.y + 18, block.y + block.h - 18),
            size: rnd(rng, 0.8, 1.25),
          });
        }
      } else if (roll < 0.22) {
        lots.push(block);
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            parking.push({
              x: block.x + 30 + col * 72,
              y: block.y + 45 + row * 110,
              a: Math.PI / 2,
            });
          }
        }
        props.push({ type: 'dumpster', x: block.x + block.w - 22, y: block.y + block.h - 22 });
      } else {
        const split = chance(rng, 0.3) ? 1 : 2;
        for (let s = 0; s < split; s++) {
          for (let t = 0; t < split; t++) {
            if (split === 2 && chance(rng, 0.12)) continue;
            const cw = block.w / split;
            const ch = block.h / split;
            const pad = rnd(rng, 5, 12);
            const x = block.x + s * cw + pad;
            const y = block.y + t * ch + pad;
            const w = cw - pad * 2 - rnd(rng, 0, 6);
            const h = ch - pad * 2 - rnd(rng, 0, 6);
            buildings.push(makeBuilding(rng, x, y, w, h, 'normal', pick(rng, SIGNS)));
          }
        }
      }
    }
  }

  // Palm-lined avenues and sidewalk furniture.
  for (const rx of ROAD_X) {
    for (let j = 0; j < ROWS; j++) {
      const y = ROAD_Y0 + j * CELL + CELL / 2;
      if (j < 6) palms.push({ x: rx + 62, y: y + 46, s: rnd(rng, 0.9, 1.15), sway: rng() * 6.28 });
      if (j > 0) palms.push({ x: rx - 62, y: y - 46, s: rnd(rng, 0.9, 1.15), sway: rng() * 6.28 });
    }
  }
  for (let i = 0; i < COLS; i++) {
    for (const ry of ROAD_Y) {
      const x = ROAD_X0 + i * CELL + CELL / 2;
      if (i < COLS - 1) props.push({ type: 'lamp', x: x + 44, y: ry + 63 });
      if (i > 0) props.push({ type: 'lamp', x: x - 44, y: ry - 63 });
      if ((i + Math.round(ry)) % 5 === 0) props.push({ type: 'bench', x: x - 40, y: ry + 62, a: 0 });
    }
  }

  // Curbside parking: along the outside lane of every third block.
  for (const rx of ROAD_X) {
    for (let j = 0; j < ROWS - 1; j++) {
      if ((j + Math.round(rx / CELL)) % 3 !== 0) continue;
      parking.push({ x: rx + 68, y: ROAD_Y[j] + 180, a: Math.PI / 2 });
      parking.push({ x: rx - 68, y: ROAD_Y[j] + 180, a: Math.PI / 2 });
    }
  }
  for (const ry of ROAD_Y) {
    for (let i = 0; i < COLS - 1; i++) {
      if ((i + Math.round(ry / CELL)) % 4 !== 0) continue;
      parking.push({ x: ROAD_X[i] + 180, y: ry + 68, a: 0 });
      parking.push({ x: ROAD_X[i] + 180, y: ry - 68, a: 0 });
    }
  }

  // The beach, boardwalk, marina and pier.
  for (let k = 0; k < 42; k++) {
    palms.push({
      x: 120 + k * 101 + rnd(rng, -22, 22),
      y: rnd(rng, BEACH_Y + 18, WATER_Y - 34),
      s: rnd(rng, 1.05, 1.5),
      sway: rng() * 6.28,
      beach: true,
    });
  }
  for (let k = 0; k < 16; k++) {
    props.push({
      type: 'umbrella',
      x: 180 + k * 260 + rnd(rng, -40, 40),
      y: rnd(rng, BEACH_Y + 50, WATER_Y - 70),
      tint: pick(rng, ['#f07c7c', '#f6d06a', '#69c4c1', '#ef9c62']),
    });
  }
  props.push({ type: 'hut', x: 900, y: BEACH_Y + 92 });

  const piers = [
    { x: PIER_X - 48, y: WATER_Y - 16, w: 96, h: PIER_END - WATER_Y + 30, name: 'SUNSET PIER' },
    { x: PIER_X - 112, y: PIER_END - 74, w: 224, h: 92, name: 'PIER HEAD' },
    { x: DOCK_X - 20, y: WATER_Y - 12, w: 40, h: DOCK_END - WATER_Y + 20, name: 'MARINA WALK' },
    { x: DOCK_X - 84, y: DOCK_END - 46, w: 168, h: 56, name: 'FLOAT' },
  ];

  for (let k = 0; k < 9; k++) {
    boats.push({
      x: DOCK_X + (k % 2 ? 1 : -1) * rnd(rng, 80, 190),
      y: 2980 + Math.floor(k / 2) * 105 + rnd(rng, -18, 18),
      a: Math.PI / 2 + rnd(rng, -0.12, 0.12),
      len: rnd(rng, 66, 128),
      tint: pick(rng, ['#e8e5da', '#df7d6e', '#79b4bd', '#e5c373', '#b9a7d0']),
      kind: k % 3 === 0 ? 'yacht' : 'boat',
    });
  }
  boats.push({ x: PIER_X + 240, y: 3260, a: -0.35, len: 150, tint: '#d7d9d2', kind: 'yacht' });
  boats.push({ x: PIER_X - 330, y: 3420, a: 0.4, len: 120, tint: '#d98a72', kind: 'boat' });

  // Waterfront goods, signs, and mission scenery.
  props.push({ type: 'sign', x: PIER_X, y: WATER_Y + 40, text: 'SUNSET PIER', tint: '#ffd37a' });
  props.push({ type: 'sign', x: DOCK_X, y: WATER_Y + 36, text: 'MARINA', tint: '#8ee9df' });
  props.push({ type: 'hut', x: PIER_X, y: PIER_END - 32, big: true });
  props.push({ type: 'crates', x: DOCK_X + 50, y: DOCK_END - 22 });
  props.push({ type: 'crates', x: DOCK_X - 42, y: DOCK_END - 30 });

  return {
    seed, rng, buildings, palms, props, parks, lots, parking, specials, boats, piers,
    roads: { x: ROAD_X, y: ROAD_Y },
    beachY: BEACH_Y, waterY: WATER_Y,
  };
}

function makeBuilding(rng, x, y, w, h, kind, name) {
  const pair = pick(rng, BUILDING_COLORS);
  return {
    x, y, w, h, kind, name,
    color: pair[0], wall: pair[1],
    roof: pick(rng, ROOF_COLORS),
    seedVal: rng(),
    floors: rint(rng, 2, 6),
    width: w, height: h,
    door: { x: x + w / 2, y: y + h - 4 },
    signAbove: kind !== 'normal',
  };
}

export function nearestRoadX(x) {
  let best = ROAD_X[0];
  for (const r of ROAD_X) if (Math.abs(r - x) < Math.abs(best - x)) best = r;
  return best;
}

export function nearestRoadY(y) {
  let best = ROAD_Y[0];
  for (const r of ROAD_Y) if (Math.abs(r - y) < Math.abs(best - y)) best = r;
  return best;
}

export function isRoad(x, y) {
  return ROAD_X.some((r) => Math.abs(r - x) < ROAD_W / 2) || ROAD_Y.some((r) => Math.abs(r - y) < ROAD_W / 2);
}

export function onPier(city, x, y, pad = 0) {
  return city.piers.some((p) => inRect(x, y, { x: p.x - pad, y: p.y - pad, w: p.w + pad * 2, h: p.h + pad * 2 }));
}

export function isLand(city, x, y, pad = 0) {
  if (x < pad || x > WORLD_W - pad || y < pad) return false;
  if (y > WATER_Y - pad) return onPier(city, x, y, pad);
  return true;
}

// Collision against buildings, cliffs and the sea. Used by people and cars.
export function solidAt(city, x, y, r = 10) {
  if (!isLand(city, x, y, r)) return true;
  for (const b of city.buildings) {
    if (circleRect(x, y, r, b)) return true;
  }
  return false;
}

export function placePos(city, key) {
  const b = city.specials[key];
  if (!b) return blockCenter(3, 5);
  return { x: b.x + b.w / 2, y: b.y + b.h + 28 };
}

export function freeStreetPoint(city, rng, near = null, maxTry = 80) {
  for (let t = 0; t < maxTry; t++) {
    const rx = pick(rng, ROAD_X);
    const ry = pick(rng, ROAD_Y);
    const horizontal = chance(rng, 0.5);
    const x = horizontal ? rnd(rng, 80, WORLD_W - 80) : rx;
    const y = horizontal ? ry : rnd(rng, 80, ROAD_Y[ROWS - 1] - 20);
    if (!solidAt(city, x, y, 12) && (!near || dist(x, y, near.x, near.y) > 400)) return { x, y };
  }
  return { x: ROAD_X[4], y: ROAD_Y[4] };
}

export function sidewalkPoint(city, rng, near = null) {
  for (let t = 0; t < 80; t++) {
    const rx = pick(rng, ROAD_X);
    const ry = pick(rng, ROAD_Y);
    const side = rint(rng, 0, 3);
    const s = rnd(rng, 58, 70);
    const x = side === 0 ? rx + s : side === 1 ? rx - s : rnd(rng, rx - 130, rx + 130);
    const y = side === 2 ? ry + s : side === 3 ? ry - s : rnd(rng, ry - 130, ry + 130);
    if (!solidAt(city, x, y, 7) && (!near || dist(x, y, near.x, near.y) > 300)) return { x, y };
  }
  return { x: ROAD_X[4] + 64, y: ROAD_Y[4] };
}

export { clamp, PALETTE };
