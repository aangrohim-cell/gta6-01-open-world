// The city, generated from a seed: sixteen by sixteen blocks of buildings, shops, parks and
// parking lots, a beach boulevard along the south with sand, palms and a pier, and the landmark
// addresses the story uses (a garage, a hospital, a gun shop, a respray, a mansion, the marina).
//
// A block owns its buildings and props; the city also keeps a flat list of solid rectangles in a
// spatial hash, which is what people, cars, bullets and the camera's line of sight collide with.
// Nothing here draws: render.js reads this data.

import { CITY } from './config.js';
import { createRandom, intRange, pick, range, shade } from './random.js';

const { pitch: P, road: ROAD, lane: LANE, sidewalk: SIDEWALK } = CITY;

const BEACH_PASTELS = ['#e8917f', '#e8dcc0', '#a8d5c1', '#c9b6dd', '#a9cfe0', '#f0b58f', '#f3e2b6'];
const MIDTOWN_WARM = ['#d8b38a', '#c98f6b', '#e3c9a3', '#b98f7a', '#d9a17c', '#cdb08b'];
const DOWNTOWN_GLASS = ['#7d8fa8', '#94a6b8', '#6d7f96', '#b0bfc8', '#8aa0ad', '#6f8497'];
const LOWRISE = ['#c7b299', '#d6c3aa', '#bfa78f', '#e0cdb2', '#b9a893'];
const DISTRICT_NAMES = {
  beach: 'Vice Beach',
  downtown: 'Downtown',
  lowrise: 'Little Haiti',
  midtown: 'Midtown',
};

function lotOf(i, j) {
  return {
    x: i * P + ROAD / 2 + SIDEWALK,
    y: j * P + ROAD / 2 + SIDEWALK,
    w: P - ROAD - SIDEWALK * 2,
    h: P - ROAD - SIDEWALK * 2,
  };
}

function blockBounds(i, j) {
  return { x: i * P + ROAD / 2, y: j * P + ROAD / 2, w: P - ROAD, h: P - ROAD };
}

function districtOf(i, j) {
  const centre = Math.hypot(i - 8, j - 8);
  if (j >= 13) return 'beach';
  if (centre < 3.6) return 'downtown';
  if (j >= 9) return 'lowrise';
  return 'midtown';
}

function paletteFor(district) {
  if (district === 'beach') return BEACH_PASTELS;
  if (district === 'downtown') return DOWNTOWN_GLASS;
  if (district === 'lowrise') return LOWRISE;
  return MIDTOWN_WARM;
}

/** The roof furniture every building gets a little of, deterministically. */
function addRoofProps(random, props, building) {
  const { x, y, w, h, height } = building;
  const count = Math.min(4, Math.floor(w * h / 14000) + (height > 40 ? 1 : 0));
  for (let index = 0; index < count; index += 1) {
    const px = x + 18 + random() * Math.max(4, w - 36);
    const py = y + 18 + random() * Math.max(4, h - 36);
    const roll = random();
    if (roll < 0.4) props.push({ type: 'ac', x: px, y: py, angle: random() * Math.PI, size: 8 + random() * 8 });
    else if (roll < 0.62) props.push({ type: 'vent', x: px, y: py, angle: 0, size: 5 + random() * 4 });
    else if (roll < 0.8) props.push({ type: 'skylight', x: px, y: py, angle: 0, size: 6 + random() * 6 });
    else if (roll < 0.9) props.push({ type: 'sat', x: px, y: py, angle: random() * 3, size: 8 });
    else props.push({ type: 'roofbox', x: px, y: py, angle: 0, size: 6 + random() * 5 });
  }
}

export function createCity(seed) {
  const random = createRandom(seed);
  const blocks = [];
  const buildings = [];
  const props = [];
  const parkingSpots = [];
  const lots = [];
  const special = new Map();

  // Landmark blocks, placed before the general city so their lots are reserved.
  special.set('3,8', 'hospital');
  special.set('9,6', 'gunshop');
  special.set('11,4', 'spray');
  special.set('6,11', 'garage');
  special.set('2,2', 'mansion');
  special.set('14,14', 'marina');

  function addBuilding(rect, options) {
    const building = {
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      height: options.height,
      color: options.color,
      roof: shade(options.color, -48),
      wall: shade(options.color, -30),
      kind: options.kind ?? 'building',
      sign: options.sign ?? null,
      awning: options.awning ?? null,
      landmark: options.landmark ?? null,
      seed: random(),
    };
    buildings.push(building);
    addRoofProps(random, props, building);
    return building;
  }

  function buildLandmark(type, lot, block) {
    const cx = lot.x + lot.w / 2;
    const cy = lot.y + lot.h / 2;
    if (type === 'hospital') {
      addBuilding({ x: lot.x + 12, y: lot.y + 22, w: lot.w - 24, h: 150 }, {
        height: 34, color: '#f0ece2', kind: 'landmark', landmark: 'hospital', sign: { text: 'MERCY GENERAL', color: '#e8eef5' },
      });
      props.push({ type: 'helipad', x: cx, y: lot.y + 218, angle: 0, size: 34 });
      props.push({ type: 'ambulance', x: lot.x + 34, y: lot.y + 214, angle: 0, size: 1 });
      props.push({ type: 'ambulance', x: lot.x + 82, y: lot.y + 214, angle: 0, size: 1 });
      block.service = { id: 'hospital', name: 'Mercy General', icon: '+', color: '#ff6b6b', x: cx, y: lot.y + lot.h - 16 };
    } else if (type === 'gunshop') {
      addBuilding({ x: lot.x + 18, y: lot.y + 34, w: lot.w - 36, h: 118 }, {
        height: 17, color: '#e8b84a', kind: 'shop', landmark: 'gunshop', awning: '#b3402f', sign: { text: 'AMMO NATION', color: '#f5d76e' },
      });
      props.push({ type: 'crates', x: lot.x + 38, y: lot.y + 196, angle: 0, size: 1 });
      props.push({ type: 'neon', x: cx, y: lot.y + 176, angle: 0, size: 1 });
      block.service = { id: 'gunshop', name: 'Ammo Nation', icon: 'gun', color: '#ffcf5c', x: cx, y: lot.y + lot.h - 16 };
    } else if (type === 'spray') {
      addBuilding({ x: lot.x + 10, y: lot.y + 30, w: lot.w - 20, h: 128 }, {
        height: 18, color: '#4f9c94', kind: 'shop', landmark: 'spray', sign: { text: 'SPRAY & GO', color: '#9ff2e2' },
      });
      props.push({ type: 'garagedoor', x: cx, y: lot.y + 152, angle: 0, size: 58 });
      block.service = { id: 'spray', name: 'Spray & Go', icon: 'spray', color: '#63e6d2', x: cx, y: lot.y + lot.h - 16 };
    } else if (type === 'garage') {
      addBuilding({ x: lot.x + 8, y: lot.y + 26, w: lot.w - 16, h: 136 }, {
        height: 16, color: '#a86b4a', kind: 'shop', landmark: 'garage', sign: { text: "DEX'S GARAGE", color: '#ffd9a0' },
      });
      props.push({ type: 'garagedoor', x: cx, y: lot.y + 156, angle: 0, size: 70 });
      props.push({ type: 'crates', x: lot.x + 20, y: lot.y + 214, angle: 0.4, size: 1 });
      props.push({ type: 'crates', x: lot.x + lot.w - 34, y: lot.y + 206, angle: -0.2, size: 1 });
      block.service = { id: 'garage', name: "Dex's Garage", icon: 'D', color: '#ffcf5c', x: cx, y: lot.y + lot.h - 20 };
      block.missionSite = true;
    } else if (type === 'mansion') {
      addBuilding({ x: lot.x + 26, y: lot.y + 20, w: lot.w - 52, h: 96 }, {
        height: 22, color: '#e6cfa8', kind: 'landmark', landmark: 'mansion', sign: null,
      });
      props.push({ type: 'pool', x: lot.x + 58, y: lot.y + 182, angle: 0, size: 42 });
      props.push({ type: 'palm', x: lot.x + 16, y: lot.y + 140, angle: random() * 6, size: 1 });
      props.push({ type: 'palm', x: lot.x + lot.w - 16, y: lot.y + 140, angle: random() * 6, size: 1 });
      props.push({ type: 'fountain', x: lot.x + 182, y: lot.y + 230, angle: 0, size: 16 });
      block.landmark = 'mansion';
    } else if (type === 'marina') {
      addBuilding({ x: lot.x + 14, y: lot.y + 8, w: lot.w - 28, h: 96 }, {
        height: 14, color: '#cfe1e3', kind: 'shop', landmark: 'marina', sign: { text: 'MARINA', color: '#d9f3f7' },
      });
      props.push({ type: 'boat', x: lot.x + 60, y: lot.y + 172, angle: 0.2, size: 1 });
      props.push({ type: 'boat', x: lot.x + 176, y: lot.y + 202, angle: -0.15, size: 1 });
      props.push({ type: 'crates', x: lot.x + 240, y: lot.y + 176, angle: 0, size: 1 });
      block.landmark = 'marina';
    }
  }

  function buildBlock(i, j) {
    const block = { i, j, ...blockBounds(i, j), lot: lotOf(i, j), district: districtOf(i, j), type: 'city', buildings: [], props: [] };
    const lot = block.lot;
    const kind = special.get(`${i},${j}`);
    if (kind) {
      block.type = kind;
      buildLandmark(kind, lot, block);
    } else {
      const district = block.district;
      let roll = random();
      if (district === 'downtown') roll *= 0.6;
      else if (district === 'beach') roll = roll * 0.7 + 0.16;
      if (roll < 0.17) {
        block.type = 'park';
        buildPark(block);
      } else if (roll < 0.3) {
        block.type = 'lot';
        buildLot(block);
      } else if (roll < 0.55) {
        block.type = 'shops';
        buildShops(block);
      } else {
        block.type = 'tower';
        buildTowers(block);
      }
    }
    decorateSidewalk(block);
    blocks.push(block);
  }

  function buildTowers(block) {
    const lot = block.lot;
    const district = block.district;
    const palette = paletteFor(district);
    const towerHeight = district === 'downtown' ? range(random, 48, 92) : district === 'beach' ? range(random, 16, 30) : range(random, 20, 46);
    const layout = random();
    if (layout < 0.45) {
      const inset = range(random, 8, 30);
      const building = addBuilding({ x: lot.x + inset, y: lot.y + inset, w: lot.w - inset * 2, h: lot.h - inset * 2 }, {
        height: towerHeight, color: pick(random, palette), kind: district === 'downtown' ? 'tower' : 'building',
      });
      block.buildings.push(building);
    } else if (layout < 0.75) {
      const split = range(random, 0.4, 0.62);
      const gap = 14;
      const a = addBuilding({ x: lot.x + 6, y: lot.y + 10, w: (lot.w - gap) * split - 6, h: lot.h - 40 }, {
        height: towerHeight, color: pick(random, palette),
      });
      const b = addBuilding({ x: lot.x + (lot.w - gap) * split + gap, y: lot.y + 10, w: lot.w - (lot.w - gap) * split - gap - 6, h: lot.h - 88 }, {
        height: towerHeight * range(random, 0.52, 0.85), color: pick(random, palette),
      });
      block.buildings.push(a, b);
    } else {
      const a = addBuilding({ x: lot.x + 8, y: lot.y + 8, w: lot.w - 74, h: lot.h - 16 }, {
        height: towerHeight, color: pick(random, palette),
      });
      const b = addBuilding({ x: lot.x + lot.w - 52, y: lot.y + lot.h - 100, w: 44, h: 92 }, {
        height: towerHeight * 0.45, color: pick(random, palette), kind: 'annex',
      });
      block.buildings.push(a, b);
    }
  }

  function buildShops(block) {
    const lot = block.lot;
    const palette = paletteFor(block.district);
    const count = intRange(random, 2, 3);
    const stripHeight = 96;
    const width = (lot.w - 6 * (count - 1)) / count;
    for (let index = 0; index < count; index += 1) {
      const color = pick(random, palette);
      const building = addBuilding({
        x: lot.x + index * (width + 6), y: lot.y + 6, w: width, h: stripHeight,
      }, {
        height: range(random, 11, 21), color, kind: 'shop',
        awning: pick(random, ['#c85a4a', '#3f7d74', '#c79a3a', '#6b5b8a']),
      });
      if (random() < 0.65) {
        building.sign = {
          text: pick(random, ['CAFÉ SOL', 'LIQUOR', 'TATTOO', 'PAWN', 'DELI', 'SURF CO.', 'BODEGA', 'PIZZA', 'NAILS', 'MOTEL']),
          color: '#fbeccd',
        };
      }
      block.buildings.push(building);
    }
    // A second row at the back, facing the alley, on some blocks.
    if (random() < 0.55) {
      const w = range(random, 90, 150);
      const building = addBuilding({
        x: lot.x + range(random, 6, lot.w - w - 6), y: lot.y + lot.h - 92, w, h: 80,
      }, { height: range(random, 14, 26), color: pick(random, palette) });
      block.buildings.push(building);
    }
  }

  function buildPark(block) {
    const lot = block.lot;
    block.type = 'park';
    const hasFountain = random() < 0.5;
    if (hasFountain) props.push({ type: 'fountain', x: lot.x + lot.w / 2, y: lot.y + lot.h / 2, angle: 0, size: 26 });
    const paths = random() < 0.6;
    block.park = { fountain: hasFountain, paths, benches: [] };
    for (let index = 0; index < 9; index += 1) {
      const px = lot.x + 18 + random() * (lot.w - 36);
      const py = lot.y + 18 + random() * (lot.h - 36);
      if (hasFountain && Math.hypot(px - (lot.x + lot.w / 2), py - (lot.y + lot.h / 2)) < 46) continue;
      props.push({ type: random() < 0.55 ? 'tree' : 'palm', x: px, y: py, angle: random() * 6.28, size: 0.85 + random() * 0.4, solid: true });
    }
    for (let index = 0; index < 3; index += 1) {
      const side = intRange(random, 0, 3);
      const px = side === 0 || side === 2 ? lot.x + 26 + random() * (lot.w - 52) : side === 1 ? lot.x + lot.w - 12 : lot.x + 12;
      const py = side === 1 || side === 3 ? lot.y + 26 + random() * (lot.h - 52) : side === 0 ? lot.y + 12 : lot.y + lot.h - 12;
      props.push({ type: 'bench', x: px, y: py, angle: side * Math.PI / 2, size: 1 });
    }
  }

  function buildLot(block) {
    const lot = block.lot;
    block.type = 'lot';
    block.parking = [];
    const cols = 3;
    const rows = 2;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const px = lot.x + 52 + col * ((lot.w - 104) / (cols - 1));
        const py = lot.y + 76 + row * 108;
        block.parking.push({ x: px, y: py, angle: Math.PI / 2 });
        if (random() < 0.45) parkingSpots.push({ x: px, y: py, angle: Math.PI / 2 });
      }
    }
    if (random() < 0.5) {
      const building = addBuilding({ x: lot.x + lot.w - 74, y: lot.y + 6, w: 68, h: 48 }, {
        height: 10, color: pick(random, paletteFor(block.district)), kind: 'annex',
      });
      block.buildings.push(building);
    }
  }

  function decorateSidewalk(block) {
    const lot = block.lot;
    const inset = 11;
    const corners = [
      { x: lot.x + inset, y: lot.y + inset },
      { x: lot.x + lot.w - inset, y: lot.y + inset },
      { x: lot.x + lot.w - inset, y: lot.y + lot.h - inset },
      { x: lot.x + inset, y: lot.y + lot.h - inset },
    ];
    // Lamps at two opposite corners, planters or palms along the sides.
    props.push({ type: 'lamp', x: corners[0].x, y: corners[0].y, angle: 0, size: 1 });
    props.push({ type: 'lamp', x: corners[2].x, y: corners[2].y, angle: 0, size: 1 });
    const sides = intRange(random, 1, 3);
    for (let index = 0; index <= sides; index += 1) {
      const t = 0.25 + random() * 0.5;
      const side = intRange(random, 0, 3);
      const px = side < 2 ? lot.x + lot.w * t : side === 2 ? lot.x + inset : lot.x + lot.w - inset;
      const py = side >= 2 ? lot.y + lot.h * t : side === 0 ? lot.y + inset : lot.y + lot.h - inset;
      props.push({ type: random() < 0.5 ? 'palm' : 'planter', x: px, y: py, angle: random() * 6.28, size: 0.7 + random() * 0.3 });
    }
    if (random() < 0.5) props.push({ type: 'hydrant', x: corners[1].x + 6, y: corners[1].y, angle: 0, size: 1 });
    if (random() < 0.4) props.push({ type: 'trash', x: corners[3].x - 10, y: corners[3].y, angle: random() * 6, size: 1 });
    if (random() < 0.35) props.push({ type: 'bench', x: lot.x + lot.w * 0.5, y: lot.y + lot.h - inset, angle: Math.PI, size: 1 });
  }

  for (let j = 0; j < CITY.blocks; j += 1) {
    for (let i = 0; i < CITY.blocks; i += 1) {
      if (i === 9 && j === 15) continue;
      buildBlock(i, j);
    }
  }
  // Block 9,15 is the pier's parking apron and stays open.
  const pierLot = lotOf(9, 15);
  blocks.push({ i: 9, j: 15, ...blockBounds(9, 15), lot: pierLot, district: 'beach', type: 'pierlot', buildings: [], props: [] });

  // ---- the beach ----
  const beachY = CITY.landHeight;
  const sandStart = beachY + ROAD / 2;
  const waterY = sandStart + CITY.beachDepth;
  const beach = { y: sandStart, waterY, depth: CITY.beachDepth };
  for (let index = 0; index < 46; index += 1) {
    const px = 80 + random() * (CITY.width - 160);
    const py = sandStart + 34 + random() * (CITY.beachDepth - 84);
    const roll = random();
    if (roll < 0.46) props.push({ type: 'palm', x: px, y: py, angle: random() * 6.28, size: 0.9 + random() * 0.5, solid: true });
    else if (roll < 0.76) props.push({ type: 'umbrella', x: px, y: py, angle: random() * 6.28, size: 0.8 + random() * 0.3 });
    else if (roll < 0.88) props.push({ type: 'towel', x: px, y: py, angle: random() * 6.28, size: 1 });
    else props.push({ type: 'dune', x: px, y: py, angle: random() * 3, size: 1 });
  }
  props.push({ type: 'lifeguard', x: 1120, y: sandStart + 168, angle: 0, size: 1 });
  props.push({ type: 'lifeguard', x: 4860, y: sandStart + 150, angle: 0, size: 1 });
  // A regular line of boardwalk lamps makes the boulevard read as a street at night.
  for (let x = 260; x < CITY.width - 220; x += 210) {
    props.push({ type: 'lamp', x, y: sandStart - 20, angle: 0, size: 0.9 });
  }
  // The pier: planks from the sand out over the water, with lamps.
  const pier = { x: 5760, y: 6420, w: 118, h: 780 };
  for (let index = 0; index < 11; index += 1) {
    props.push({ type: 'pierlamp', x: pier.x + 8 + (index % 2) * (pier.w - 16), y: pier.y + 90 + index * 62, angle: 0, size: 1 });
  }
  props.push({ type: 'piercrate', x: pier.x + 18, y: pier.y + 690, angle: 0.3, size: 1 });
  props.push({ type: 'piercrate', x: pier.x + pier.w - 26, y: pier.y + 720, angle: -0.2, size: 1 });

  // ---- landmark service markers ----
  const services = [];
  for (const block of blocks) {
    if (block.service) {
      const s = block.service;
      services.push({ ...s, radius: 66 });
    }
  }
  // The marina car park and the pier are the story's waterfront addresses.
  const storySites = {
    garage: { x: 2600, y: 4700 },
    marina: { x: 5560, y: 6440 },
    pier: { x: 5820, y: 6880 },
    mansion: { x: 1010, y: 1070 },
    debtors: [
      { x: 3400, y: 3812 },
      { x: 4200, y: 5012 },
      { x: 1800, y: 2612 },
    ],
    gunshop: { x: 3800, y: 2700 },
    hospital: { x: 1400, y: 3500 },
    spray: { x: 4600, y: 1900 },
  };

  // Hidden mixtapes: a little exploration reward in out-of-the-way corners.
  const tapeSpots = [
    { x: 5820, y: 7040 }, { x: 6150, y: 6580 }, { x: 3666, y: 866 }, { x: 1266, y: 4866 },
    { x: 5266, y: 2866 }, { x: 2866, y: 1666 }, { x: 300, y: 6560 }, { x: 1266, y: 1266 },
  ];
  const tapes = tapeSpots.map((spot, index) => ({ ...spot, index, taken: false }));

  // Traffic lanes: a lane point is where a car driving that way would sit.
  const lanePoint = (axis, dir, roadIndex, along) => {
    const road = roadIndex * P;
    const offset = LANE * (axis === 'h' ? (dir > 0 ? 1 : -1) : (dir > 0 ? -1 : 1));
    return axis === 'h' ? { x: along, y: road + offset } : { x: road + offset, y: along };
  };

  // ---- collision ----
  const HASH = 200;
  const hash = new Map();
  function key(ix, iy) { return `${ix},${iy}`; }
  function addCollider(x, y, w, h) {
    const collider = { x, y, w, h };
    const minX = Math.floor(x / HASH);
    const maxX = Math.floor((x + w) / HASH);
    const minY = Math.floor(y / HASH);
    const maxY = Math.floor((y + h) / HASH);
    for (let iy = minY; iy <= maxY; iy += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        const k = key(ix, iy);
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k).push(collider);
      }
    }
  }
  for (const building of buildings) addCollider(building.x, building.y, building.w, building.h);
  for (const prop of props) {
    if (prop.type === 'fountain' || prop.type === 'pool') addCollider(prop.x - prop.size * 0.8, prop.y - prop.size * 0.8, prop.size * 1.6, prop.size * 1.6);
    if (prop.type === 'palm' || prop.type === 'tree') {
      if (prop.solid) addCollider(prop.x - 4, prop.y - 4, 8, 8);
    }
  }
  // Solid walls at the edge of the map (the sea is handled separately).
  addCollider(-60, -60, CITY.width + 120, 60);
  addCollider(-60, CITY.height - 40, CITY.width + 120, 60);
  addCollider(-60, -60, 60, CITY.height + 120);
  addCollider(CITY.width - 10, -60, 70, CITY.height + 120);

  function nearby(x, y, radius) {
    const minX = Math.floor((x - radius) / HASH);
    const maxX = Math.floor((x + radius) / HASH);
    const minY = Math.floor((y - radius) / HASH);
    const maxY = Math.floor((y + radius) / HASH);
    const found = new Set();
    for (let iy = minY; iy <= maxY; iy += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        const list = hash.get(key(ix, iy));
        if (list) for (const item of list) found.add(item);
      }
    }
    return found;
  }

  /** Is the point inside a solid rectangle, expanded by radius? */
  function solidAt(x, y, radius = 0) {
    if (y > waterY - 4) {
      const onPier = x > pier.x - 6 && x < pier.x + pier.w + 6 && y < pier.y + pier.h;
      if (!onPier) return true;
    }
    if (x < 24 || x > CITY.width - 24 || y < 24) return true;
    for (const rect of nearby(x, y, radius + 4)) {
      if (x > rect.x - radius && x < rect.x + rect.w + radius && y > rect.y - radius && y < rect.y + rect.h + radius) return true;
    }
    return false;
  }

  /** The first rectangle hit by a ray, for line of sight and bullets. */
  function raycast(x, y, dx, dy, maxDistance) {
    let best = null;
    let bestT = maxDistance;
    for (const rect of nearby(x + (dx * maxDistance) / 2, y + (dy * maxDistance) / 2, maxDistance / 2 + 80)) {
      let tmin = 0;
      let tmax = bestT;
      for (let axis = 0; axis < 2; axis += 1) {
        const origin = axis === 0 ? x : y;
        const direction = axis === 0 ? dx : dy;
        const min = axis === 0 ? rect.x : rect.y;
        const max = axis === 0 ? rect.x + rect.w : rect.y + rect.h;
        if (Math.abs(direction) < 0.00001) {
          if (origin < min || origin > max) { tmin = Infinity; break; }
        } else {
          let t1 = (min - origin) / direction;
          let t2 = (max - origin) / direction;
          if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) { tmin = Infinity; break; }
        }
      }
      if (tmin < bestT && tmin >= 0) {
        bestT = tmin;
        best = { x: x + dx * tmin, y: y + dy * tmin, t: tmin, rect };
      }
    }
    return best;
  }

  function randomRoadPoint(randomFn, awayFrom, minAway = 700) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const axis = randomFn() < 0.5 ? 'h' : 'v';
      const dir = randomFn() < 0.5 ? 1 : -1;
      const roadIndex = intRange(randomFn, 1, CITY.blocks - 2);
      const along = 120 + randomFn() * (CITY.width - 240);
      const point = lanePoint(axis, dir, roadIndex, along);
      if (!awayFrom || Math.hypot(point.x - awayFrom.x, point.y - awayFrom.y) > minAway) return point;
    }
    return { x: 2000, y: 2000 };
  }

  // A single lookup table keeps blockAt/locationAt cheap enough to call from the HUD every frame.
  const blockMap = new Map(blocks.map((block) => [`${block.i},${block.j}`, block]));

  function findBlock(x, y) {
    return blockMap.get(`${Math.floor(x / P)},${Math.floor(y / P)}`) ?? null;
  }

  /** A short, human-readable address for the HUD (landmark > district > waterfront). */
  function locationAt(x, y) {
    if (y > waterY - 6) return 'Offshore';
    const block = findBlock(x, y);
    if (!block) return 'Vice City';
    if (block.service) return block.service.name;
    if (block.landmark === 'mansion') return 'Vesper Mansion';
    if (block.landmark === 'marina') return 'Bayside Marina';
    if (block.type === 'pierlot') return 'Pier Approach';
    return DISTRICT_NAMES[block.district] ?? 'Vice City';
  }

  return {
    seed,
    width: CITY.width,
    height: CITY.height,
    landHeight: CITY.landHeight,
    blocks,
    buildings,
    props,
    parkingSpots,
    services,
    storySites,
    tapes,
    beach,
    pier,
    waterY,
    lanePoint,
    solidAt,
    raycast,
    nearby,
    randomRoadPoint,
    locationAt,
    blockAt: findBlock,
  };
}
