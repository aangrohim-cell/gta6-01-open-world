// Canvas 2D renderer: sunset-lit top-down city, entirely procedural art.
import {
  VIEW_W, VIEW_H, ROAD_X, ROAD_Y, ROAD_W, CELL, COLS, ROWS, WORLD_W,
  WORLD_H, WATER_Y, BEACH_Y, CAR_TYPES, PALETTE,
} from './config.js';
import { clamp } from './random.js';
import { drawHud } from './hud.js';
import { drawScreens } from './screens.js';

const STATIC_H = WORLD_H + 500;
let staticLayer = null;
let staticCity = null;

const vis = (v, x, y, w, h) => x + w > v.x0 && x < v.x1 && y + h > v.y0 && y < v.y1;

function rr(ctx, x, y, w, h, r = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function render(game, ctx) {
  const v = {
    x0: game.camera.x - VIEW_W / 2 - 80,
    x1: game.camera.x + VIEW_W / 2 + 80,
    y0: game.camera.y - VIEW_H / 2 - 80,
    y1: game.camera.y + VIEW_H / 2 + 80,
  };
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.translate(VIEW_W / 2 - game.camera.x, VIEW_H / 2 - game.camera.y);

  drawBackdrop(game, ctx, v);
  drawSkids(game, ctx, v);
  drawPickups(game, ctx, v);
  drawPeds(game, ctx, v);
  drawCars(game, ctx, v);
  drawPlayer(game, ctx);
  drawEffects(game, ctx, v);
  drawMissionMarker(game, ctx);

  ctx.restore();
  drawSunsetLight(ctx);
  drawHud(game, ctx);
  drawScreens(game, ctx);
}

function ensureStatic(game) {
  if (staticLayer && staticCity === game.city) return;
  staticCity = game.city;
  staticLayer = document.createElement('canvas');
  staticLayer.width = WORLD_W;
  staticLayer.height = STATIC_H;
  const sctx = staticLayer.getContext('2d', { alpha: false });
  const snapshot = { city: game.city, time: 0 };
  const full = { x0: 0, x1: WORLD_W, y0: 0, y1: STATIC_H };
  drawGround(snapshot, sctx, full);
  drawProps(snapshot, sctx, full);
  drawBuildings(snapshot, sctx, full);
  drawBoats(snapshot, sctx, full);
}

function drawBackdrop(game, ctx, v) {
  ensureStatic(game);
  const sx = clamp(v.x0, 0, WORLD_W);
  const sy = clamp(v.y0, 0, STATIC_H);
  const ex = clamp(v.x1, 0, WORLD_W);
  const ey = clamp(v.y1, 0, STATIC_H);
  if (ex > sx && ey > sy) ctx.drawImage(staticLayer, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);

  // Animated surf highlights and traffic lights over the cached city.
  ctx.strokeStyle = 'rgba(215,255,242,0.22)';
  ctx.lineWidth = 2;
  for (let y = WATER_Y + 60; y < WORLD_H + 300; y += 96) {
    if (y < v.y0 || y > v.y1) continue;
    ctx.beginPath();
    const shift = Math.sin(game.time * 0.9 + y * 0.03) * 22;
    for (let x = Math.floor(v.x0 / 110) * 110; x < v.x1 + 110; x += 110) {
      ctx.moveTo(x + shift, y);
      ctx.lineTo(x + 58 + shift, y + Math.sin(x * 0.015 + game.time) * 3);
    }
    ctx.stroke();
  }
  const phase = Math.floor(game.time / 7) % 2;
  for (const rx of ROAD_X) {
    for (const ry of ROAD_Y) {
      if (rx < v.x0 || rx > v.x1 || ry < v.y0 || ry > v.y1) continue;
      const green = (Math.round(rx / CELL) + Math.round(ry / CELL) + phase) % 2 === 0;
      ctx.fillStyle = green ? '#6be8a0' : '#ee6d70';
      ctx.beginPath(); ctx.arc(rx + 45.5, ry + 43.5, 3.6, 0, 6.29); ctx.fill();
    }
  }
}

function drawGround(game, ctx, v) {
  const t = game.time;
  // Ground under the city.
  ctx.fillStyle = '#9b9b8e';
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);

  // Sand and surf.
  const sand = ctx.createLinearGradient(0, BEACH_Y, 0, WATER_Y);
  sand.addColorStop(0, '#d9b87f');
  sand.addColorStop(1, '#efd09a');
  ctx.fillStyle = sand;
  ctx.fillRect(0, BEACH_Y, WORLD_W, WATER_Y - BEACH_Y);
  ctx.fillStyle = PALETTE.sandDark;
  ctx.fillRect(0, BEACH_Y, WORLD_W, 9);
  for (let x = Math.floor(v.x0 / 40) * 40; x < v.x1; x += 40) {
    for (let y = Math.floor(Math.max(BEACH_Y, v.y0) / 37) * 37; y < Math.min(v.y1, WATER_Y); y += 37) {
      if ((x * 13 + y * 7) % 5 === 0) {
        ctx.fillStyle = 'rgba(160,120,75,0.18)';
        ctx.fillRect(x + 7, y + 11, 3, 3);
      }
    }
  }
  // Boardwalk planks.
  ctx.fillStyle = '#a98158';
  ctx.fillRect(0, BEACH_Y - 14, WORLD_W, 18);
  ctx.fillStyle = 'rgba(80,50,30,0.28)';
  for (let x = Math.floor(v.x0 / 22) * 22; x < v.x1; x += 22) ctx.fillRect(x, BEACH_Y - 14, 2, 18);

  // Ocean.
  const sea = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_H);
  sea.addColorStop(0, '#2f8994');
  sea.addColorStop(0.45, '#1f6677');
  sea.addColorStop(1, '#123e52');
  ctx.fillStyle = sea;
  ctx.fillRect(v.x0, WATER_Y, v.x1 - v.x0, WORLD_H - WATER_Y + 400);
  ctx.lineWidth = 2;
  for (let y = WATER_Y + 26; y < WORLD_H + 200; y += 38) {
    if (y < v.y0 - 20 || y > v.y1 + 20) continue;
    ctx.strokeStyle = y < WATER_Y + 150 ? 'rgba(220,255,240,0.30)' : 'rgba(160,220,225,0.16)';
    ctx.beginPath();
    const shift = Math.sin(t * 0.7 + y * 0.04) * 18;
    for (let x = Math.floor(v.x0 / 90) * 90; x < v.x1 + 90; x += 90) {
      ctx.moveTo(x + shift, y + Math.sin(x * 0.02 + t) * 3);
      ctx.lineTo(x + 46 + shift, y + Math.sin(x * 0.02 + t) * 3);
    }
    ctx.stroke();
  }
  // Foam line at the shore.
  ctx.strokeStyle = 'rgba(230,255,246,0.75)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = v.x0; x <= v.x1; x += 16) {
    const y = WATER_Y + Math.sin(x * 0.03 + t * 1.5) * 4;
    if (x === v.x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // City blocks: sidewalks, lots, parks.
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const x = ROAD_X[i] + ROAD_W / 2 - 4;
      const y = ROAD_Y[j] + ROAD_W / 2 - 4;
      const w = CELL - ROAD_W + 8;
      const h = CELL - ROAD_W + 8;
      if (!vis(v, x, y, w, h)) continue;
      ctx.fillStyle = '#aaa79b';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#d2caba';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.fillStyle = '#90948a';
      ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
    }
  }
  for (const p of game.city.parks) {
    if (!vis(v, p.x, p.y, p.w, p.h)) continue;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(p.x + 14, p.y + 14, p.w - 28, p.h - 28);
    ctx.strokeStyle = 'rgba(245,235,200,0.5)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(p.x + 22, p.y + p.h / 2);
    ctx.lineTo(p.x + p.w - 22, p.y + p.h / 2);
    ctx.moveTo(p.x + p.w / 2, p.y + 22);
    ctx.lineTo(p.x + p.w / 2, p.y + p.h - 22);
    ctx.stroke();
  }
  for (const lot of game.city.lots) {
    if (!vis(v, lot.x, lot.y, lot.w, lot.h)) continue;
    ctx.fillStyle = '#4b5157';
    ctx.fillRect(lot.x + 14, lot.y + 14, lot.w - 28, lot.h - 28);
    ctx.strokeStyle = 'rgba(245,230,180,0.55)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const px = lot.x + 26 + k * 72;
      ctx.strokeRect(px, lot.y + 30, 42, 96);
      ctx.strokeRect(px, lot.y + 140, 42, 96);
    }
  }

  // Asphalt avenues.
  ctx.fillStyle = PALETTE.asphalt;
  for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WATER_Y);
  for (const ry of ROAD_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_W / 2, 0, 3, WATER_Y);
  for (const ry of ROAD_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, 3);

  // Lane dashes.
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([26, 26]);
  for (const rx of ROAD_X) {
    const y0 = Math.max(0, v.y0), y1 = Math.min(WATER_Y, v.y1);
    ctx.beginPath(); ctx.moveTo(rx, y0); ctx.lineTo(rx, y1); ctx.stroke();
  }
  for (const ry of ROAD_Y) {
    const x0 = Math.max(0, v.x0), x1 = Math.min(WORLD_W, v.x1);
    ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Crosswalks and lights at every intersection in view.
  const phase = Math.floor(game.time / 7) % 2;
  for (const rx of ROAD_X) {
    for (const ry of ROAD_Y) {
      if (rx < v.x0 - 70 || rx > v.x1 + 70 || ry < v.y0 - 70 || ry > v.y1 + 70) continue;
      ctx.fillStyle = 'rgba(245,240,225,0.60)';
      for (let k = -3; k <= 3; k++) {
        ctx.fillRect(rx - ROAD_W / 2 + 5 + k * 12, ry - ROAD_W / 2 - 12, 7, 10);
        ctx.fillRect(rx - ROAD_W / 2 + 5 + k * 12, ry + ROAD_W / 2 + 2, 7, 10);
        ctx.fillRect(rx - ROAD_W / 2 - 12, ry - ROAD_W / 2 + 5 + k * 12, 10, 7);
        ctx.fillRect(rx + ROAD_W / 2 + 2, ry - ROAD_W / 2 + 5 + k * 12, 10, 7);
      }
      const green = (Math.round(rx / CELL) + Math.round(ry / CELL) + phase) % 2 === 0;
      ctx.fillStyle = '#1d272d';
      ctx.fillRect(rx + 40, ry + 38, 11, 11);
      ctx.fillStyle = green ? '#66e39a' : '#ec6b6b';
      ctx.beginPath(); ctx.arc(rx + 45.5, ry + 43.5, 3.6, 0, 6.29); ctx.fill();
    }
  }

  // Wooden piers over the water.
  for (const pier of game.city.piers) {
    if (!vis(v, pier.x, pier.y, pier.w, pier.h)) continue;
    ctx.fillStyle = 'rgba(6,25,32,0.4)';
    ctx.fillRect(pier.x + 9, pier.y + 12, pier.w, pier.h);
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = 'rgba(60,34,18,0.28)';
    const vertical = pier.h > pier.w;
    if (vertical) {
      for (let y = pier.y; y < pier.y + pier.h; y += 16) ctx.fillRect(pier.x, y, pier.w, 2);
      for (let x = pier.x; x < pier.x + pier.w; x += 20) ctx.fillRect(x, pier.y, 2, pier.h);
    } else {
      for (let x = pier.x; x < pier.x + pier.w; x += 16) ctx.fillRect(x, pier.y, 2, pier.h);
      for (let y = pier.y; y < pier.y + pier.h; y += 20) ctx.fillRect(pier.x, y, pier.w, 2);
    }
    ctx.strokeStyle = '#d3a473';
    ctx.lineWidth = 3;
    ctx.strokeRect(pier.x, pier.y, pier.w, pier.h);
  }
}

function drawSkids(game, ctx, v) {
  ctx.strokeStyle = 'rgba(28,30,34,0.30)';
  ctx.lineWidth = 5;
  for (const s of game.skids) {
    if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue;
    ctx.globalAlpha = clamp(s.life / 5, 0, 0.5);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.a) * 17, s.y - Math.sin(s.a) * 17);
    ctx.lineTo(s.x + Math.cos(s.a) * 17, s.y + Math.sin(s.a) * 17);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawProps(game, ctx, v) {
  for (const palm of game.city.palms) {
    if (palm.x < v.x0 - 40 || palm.x > v.x1 + 40 || palm.y < v.y0 - 40 || palm.y > v.y1 + 40) continue;
    const sway = Math.sin(game.time * 1.3 + palm.sway) * 3;
    ctx.fillStyle = 'rgba(45,40,30,0.24)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 12, palm.y + 14, 20 * palm.s, 8 * palm.s, 0.5, 0, 6.29);
    ctx.fill();
    ctx.strokeStyle = '#7c5a3a';
    ctx.lineWidth = 5 * palm.s;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 5, palm.y - 3); ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + palm.sway * 0.1;
      const ex = palm.x + Math.cos(a) * 22 * palm.s + sway;
      const ey = palm.y + Math.sin(a) * 22 * palm.s;
      ctx.strokeStyle = k % 2 ? '#3f8b5f' : '#4fa36b';
      ctx.lineWidth = 6 * palm.s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y - 2);
      ctx.quadraticCurveTo((palm.x + ex) / 2, (palm.y + ey) / 2 - 8, ex, ey);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#8a6a3d';
    ctx.beginPath(); ctx.arc(palm.x, palm.y, 4 * palm.s, 0, 6.29); ctx.fill();
  }

  for (const prop of game.city.props) {
    if (prop.x < v.x0 - 40 || prop.x > v.x1 + 40 || prop.y < v.y0 - 40 || prop.y > v.y1 + 40) continue;
    if (prop.type === 'tree') {
      ctx.fillStyle = 'rgba(30,45,28,0.22)';
      ctx.beginPath(); ctx.arc(prop.x + 8, prop.y + 9, 17 * prop.size, 0, 6.29); ctx.fill();
      ctx.fillStyle = prop.size > 1 ? '#54824c' : PALETTE.grassDark;
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 16 * prop.size, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(160,210,130,0.35)';
      ctx.beginPath(); ctx.arc(prop.x - 5, prop.y - 5, 8 * prop.size, 0, 6.29); ctx.fill();
    } else if (prop.type === 'lamp') {
      ctx.fillStyle = 'rgba(30,30,30,0.25)';
      ctx.beginPath(); ctx.ellipse(prop.x + 6, prop.y + 7, 8, 4, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#465059';
      ctx.fillRect(prop.x - 2, prop.y - 2, 4, 5);
      ctx.fillStyle = '#ffe2a0';
      ctx.beginPath(); ctx.arc(prop.x, prop.y - 3, 5, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,150,0.10)';
      ctx.beginPath(); ctx.arc(prop.x, prop.y - 3, 20, 0, 6.29); ctx.fill();
    } else if (prop.type === 'bench') {
      ctx.fillStyle = '#8a6646';
      ctx.fillRect(prop.x - 15, prop.y - 4, 30, 9);
      ctx.fillStyle = 'rgba(40,30,20,0.3)';
      ctx.fillRect(prop.x - 13, prop.y + 5, 26, 3);
    } else if (prop.type === 'umbrella') {
      ctx.fillStyle = 'rgba(80,60,40,0.22)';
      ctx.beginPath(); ctx.ellipse(prop.x + 8, prop.y + 10, 22, 9, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = prop.tint;
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 19, 0, 6.29); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(prop.x, prop.y); ctx.lineTo(prop.x + Math.cos(a) * 18, prop.y + Math.sin(a) * 18); ctx.stroke();
      }
    } else if (prop.type === 'fountain') {
      ctx.fillStyle = '#c9c2b3';
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 34, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#4ea8b2';
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 27, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(210,245,240,0.55)';
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 10, 0, 6.29); ctx.fill();
    } else if (prop.type === 'hut') {
      const w = prop.big ? 74 : 52;
      const h = prop.big ? 52 : 38;
      ctx.fillStyle = 'rgba(20,30,30,0.3)';
      ctx.fillRect(prop.x - w / 2 + 6, prop.y - h / 2 + 7, w, h);
      ctx.fillStyle = prop.big ? '#9d6c4d' : '#c99c6b';
      ctx.fillRect(prop.x - w / 2, prop.y - h / 2, w, h);
      ctx.fillStyle = prop.big ? '#c9895e' : '#e0b27c';
      ctx.fillRect(prop.x - w / 2 - 5, prop.y - h / 2 - 5, w + 10, 11);
      ctx.fillStyle = '#5a3b2c';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prop.big ? 'PIER SHACK' : 'LIFEGUARD', prop.x, prop.y + 4);
    } else if (prop.type === 'crates') {
      ctx.fillStyle = '#8f6a45';
      ctx.fillRect(prop.x - 16, prop.y - 14, 30, 28);
      ctx.fillStyle = '#a98155';
      ctx.fillRect(prop.x - 11, prop.y - 18, 28, 26);
      ctx.strokeStyle = 'rgba(50,30,15,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x - 11, prop.y - 18, 28, 26);
    } else if (prop.type === 'sign') {
      ctx.fillStyle = 'rgba(20,25,30,0.35)';
      ctx.fillRect(prop.x - 70, prop.y - 8, 140, 22);
      ctx.fillStyle = '#303b43';
      ctx.fillRect(prop.x - 72, prop.y - 11, 144, 22);
      ctx.strokeStyle = prop.tint;
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x - 72, prop.y - 11, 144, 22);
      ctx.fillStyle = prop.tint;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prop.text, prop.x, prop.y + 4);
    } else if (prop.type === 'dumpster') {
      ctx.fillStyle = '#4c6a5b';
      ctx.fillRect(prop.x - 16, prop.y - 12, 32, 24);
      ctx.strokeStyle = '#2e4338';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x - 16, prop.y - 12, 32, 24);
    }
  }
}

function drawBuildings(game, ctx, v) {
  for (const b of game.city.buildings) {
    if (!vis(v, b.x - 12, b.y - 12, b.w + 24, b.h + 24)) continue;
    // Drop shadow.
    ctx.fillStyle = 'rgba(25,25,32,0.32)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    // Walls and roof.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 5);

    // Rooftop windows / strip lighting around the rim.
    ctx.fillStyle = 'rgba(255,222,150,0.72)';
    const step = 17;
    for (let x = b.x + 10; x < b.x + b.w - 14; x += step) {
      if ((Math.floor(x + b.seedVal * 100) % 4) !== 0) {
        ctx.fillRect(x, b.y + 12, 8, 4);
        ctx.fillRect(x, b.y + b.h - 18, 8, 4);
      }
    }
    for (let y = b.y + 10; y < b.y + b.h - 14; y += step) {
      if ((Math.floor(y + b.seedVal * 77) % 3) !== 0) {
        ctx.fillRect(b.x + 12, y, 4, 8);
        ctx.fillRect(b.x + b.w - 18, y, 4, 8);
      }
    }

    // Rooftop mechanical details.
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    ctx.fillStyle = 'rgba(35,40,45,0.5)';
    ctx.fillRect(b.x + 18, b.y + 22, Math.min(32, b.w * 0.22), Math.min(24, b.h * 0.2));
    ctx.fillStyle = 'rgba(210,215,210,0.16)';
    ctx.fillRect(b.x + 18, b.y + 22, Math.min(32, b.w * 0.22), 3);
    if (b.w > 100 && b.h > 90) {
      ctx.fillStyle = 'rgba(40,45,50,0.45)';
      ctx.fillRect(b.x + b.w - 55, b.y + b.h - 52, 34, 30);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + b.w - 55, b.y + b.h - 52, 34, 30);
    }

    // Distinctive rooftop signage for named locations.
    if (b.signAbove && b.w > 90) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(20,22,28,0.6)';
      ctx.fillRect(cx - b.w * 0.42, cy - 11, b.w * 0.84, 23);
      ctx.fillStyle = signColor(b.kind);
      ctx.shadowColor = signColor(b.kind);
      ctx.shadowBlur = b.kind === 'club' ? 12 : 5;
      ctx.fillText(b.name, cx, cy + 4);
      ctx.restore();
    } else if (b.w > 70 && b.seedVal > 0.45) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(245,235,210,0.48)';
      ctx.fillText(b.name, cx, cy + 3);
      ctx.restore();
    }

    if (b.kind === 'hospital') drawCross(ctx, b.x + 20, b.y + 20, 12);
    if (b.kind === 'bank') {
      ctx.fillStyle = '#e8c773';
      for (let k = 0; k < 4; k++) ctx.fillRect(b.x + 16 + k * 24, b.y + b.h - 26, 10, 15);
    }
    if (b.kind === 'safehouse') {
      ctx.fillStyle = '#57b7bd';
      ctx.fillRect(b.x + b.w - 60, b.y + 16, 40, 30);
      ctx.strokeStyle = '#e0d6bb';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + b.w - 60, b.y + 16, 40, 30);
    }
    if (b.kind === 'police') {
      ctx.fillStyle = '#2f5f9e';
      ctx.fillRect(b.x + 14, b.y + b.h - 28, b.w - 28, 12);
      ctx.fillStyle = '#e8edf2';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PRECINCT 12', cx, b.y + b.h - 19);
    }
  }
}

function drawCross(ctx, x, y, s) {
  ctx.fillStyle = '#f5f5f2';
  ctx.fillRect(x, y, s * 2, s * 2);
  ctx.fillStyle = '#e05a63';
  ctx.fillRect(x + s * 0.8, y + s * 0.2, s * 0.4, s * 1.6);
  ctx.fillRect(x + s * 0.2, y + s * 0.8, s * 1.6, s * 0.4);
}

function signColor(kind) {
  if (kind === 'club') return '#ff87d6';
  if (kind === 'bank') return '#ffd87a';
  if (kind === 'hospital') return '#ff9b9b';
  if (kind === 'police') return '#8dc7ff';
  if (kind === 'garage') return '#9de2c4';
  return '#ffe6b8';
}

function drawBoats(game, ctx, v) {
  for (const b of game.city.boats) {
    if (b.x < v.x0 - 150 || b.x > v.x1 + 150 || b.y < v.y0 - 100 || b.y > v.y1 + 100) continue;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.fillStyle = 'rgba(5,25,35,0.3)';
    rr(ctx, -b.len / 2 + 6, -18 + 8, b.len, 36, 14); ctx.fill();
    ctx.fillStyle = b.tint;
    rr(ctx, -b.len / 2, -18, b.len, 36, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    rr(ctx, -b.len * 0.24, -12, b.len * 0.42, 24, 8); ctx.fill();
    ctx.fillStyle = '#52707a';
    ctx.fillRect(-b.len * 0.1, -9, b.len * 0.24, 18);
    ctx.fillStyle = '#f0e7d3';
    ctx.fillRect(b.len / 2 - 5, -12, 5, 24);
    ctx.restore();
  }
}

function drawPickups(game, ctx, v) {
  const colors = { health: '#6fe09a', armour: '#7fc8ef', ammo: '#f3d071', money: '#8fe0a0', weapon: '#f28b8b' };
  const icons = { health: '+', armour: '◆', ammo: '•', money: '$', weapon: 'W' };
  for (const p of game.pickups) {
    if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
    const bob = Math.sin(p.bob) * 2;
    ctx.fillStyle = 'rgba(20,25,30,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 6, 13, 6, 0, 0, 6.29); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(Math.sin(p.bob * 0.5) * 0.12);
    ctx.fillStyle = colors[p.type] || '#fff';
    rr(ctx, -11, -11, 22, 22, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(20,25,30,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#28313a';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(icons[p.type] || '?', 0, 5);
    ctx.restore();
  }
}

function drawPeds(game, ctx, v) {
  for (const ped of game.peds) {
    if (ped.x < v.x0 - 20 || ped.x > v.x1 + 20 || ped.y < v.y0 - 20 || ped.y > v.y1 + 20) continue;
    if (!ped.alive) {
      ctx.globalAlpha = clamp(1 - (ped.deadFor - 12) / 6, 0, 1);
      ctx.fillStyle = 'rgba(25,25,30,0.25)';
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 11, 5, ped.a, 0, 6.29); ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 8, 5, ped.a, 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    const step = Math.sin(ped.wobble) * 2;
    ctx.fillStyle = 'rgba(20,25,28,0.28)';
    ctx.beginPath(); ctx.ellipse(ped.x + 4, ped.y + 6, 9, 4, 0, 0, 6.29); ctx.fill();
    if (ped.type === 'rival') {
      ctx.fillStyle = 'rgba(240,80,90,0.25)';
      ctx.beginPath(); ctx.arc(ped.x, ped.y, 16, 0, 6.29); ctx.fill();
    }
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.a);
    ctx.fillStyle = '#2c333b';
    ctx.fillRect(-5, -7 + step, 5, 4);
    ctx.fillRect(-5, 3 - step, 5, 4);
    ctx.fillStyle = ped.shirt;
    rr(ctx, -6, -6, 13, 12, 4); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(5, 0, 5.2, 0, 6.29); ctx.fill();
    ctx.fillStyle = ped.hair;
    ctx.beginPath(); ctx.arc(4, -0.6, 4.6, Math.PI * 0.6, Math.PI * 1.9); ctx.fill();
    ctx.restore();
  }
}

function drawCars(game, ctx, v) {
  for (const car of game.cars) {
    if (car.x < v.x0 - 90 || car.x > v.x1 + 90 || car.y < v.y0 - 90 || car.y > v.y1 + 90) continue;
    const spec = CAR_TYPES[car.type];
    const L = spec.h, W = spec.w;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.a);
    ctx.fillStyle = 'rgba(15,20,25,0.35)';
    rr(ctx, -L / 2 + 6, -W / 2 + 7, L, W, 10); ctx.fill();
    ctx.fillStyle = car.flash > 0 ? '#fff2d8' : car.color;
    rr(ctx, -L / 2, -W / 2, L, W, car.type === 'truck' ? 6 : 12); ctx.fill();
    ctx.strokeStyle = 'rgba(20,25,30,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Cabin and glass.
    ctx.fillStyle = '#283e4a';
    rr(ctx, -L * 0.26, -W / 2 + 6, L * 0.48, W - 12, 8); ctx.fill();
    ctx.fillStyle = 'rgba(150,215,225,0.45)';
    rr(ctx, -L * 0.05, -W / 2 + 8, L * 0.16, W - 16, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(ctx, -L * 0.24, -W / 2 + 9, L * 0.18, 4, 2); ctx.fill();
    // Headlights and tail lights.
    ctx.fillStyle = '#fff4cf';
    ctx.fillRect(L / 2 - 5, -W / 2 + 4, 5, 8);
    ctx.fillRect(L / 2 - 5, W / 2 - 12, 5, 8);
    ctx.fillStyle = car.speed < -5 ? '#fff4cf' : '#e65454';
    ctx.fillRect(-L / 2 + 1, -W / 2 + 4, 4, 8);
    ctx.fillRect(-L / 2 + 1, W / 2 - 12, 4, 8);
    // Wheels.
    ctx.fillStyle = '#1d2228';
    for (const wx of [-L * 0.32, L * 0.31]) {
      ctx.fillRect(wx - 4, -W / 2 - 2, 8, 4);
      ctx.fillRect(wx - 4, W / 2 - 2, 8, 4);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#f7e6a0';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -3);
      ctx.fillStyle = '#2b3138';
      ctx.fillRect(-3, -W / 2 - 5, 12, 5);
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#2a5b9b';
      ctx.fillRect(-L / 2 + 3, -W / 2 + 2, L - 6, 6);
      ctx.fillRect(-L / 2 + 3, W / 2 - 8, L - 6, 6);
      const on = Math.floor(game.time * 5) % 2 === 0;
      ctx.fillStyle = on ? '#ff5158' : '#3f5f78';
      ctx.fillRect(-5, -W / 2 - 2, 10, 7);
      ctx.fillStyle = on ? '#3f5f78' : '#4a9bff';
      ctx.fillRect(-5, W / 2 - 5, 10, 7);
      if (on) {
        ctx.fillStyle = 'rgba(255,70,80,0.16)';
        ctx.beginPath(); ctx.arc(0, 0, 74, 0, 6.29); ctx.fill();
      }
      ctx.fillStyle = '#e6eef4';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', L * 0.06, 3);
    }
    if (car.hp < 65 && car.ai !== 'parked') {
      ctx.fillStyle = 'rgba(70,72,74,0.5)';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(-L / 2 - 6 - k * 9, Math.sin(game.time * 3 + k) * 5, 6 + k * 3, 0, 6.29);
        ctx.fill();
      }
    }
    ctx.restore();
    if (car === game.player.car) {
      ctx.fillStyle = 'rgba(255,225,120,0.9)';
      ctx.beginPath();
      ctx.moveTo(car.x, car.y - 48);
      ctx.lineTo(car.x - 6, car.y - 59);
      ctx.lineTo(car.x + 6, car.y - 59);
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawPlayer(game, ctx) {
  const p = game.player;
  if (p.car) return;
  const a = p.aim;
  ctx.fillStyle = 'rgba(20,24,28,0.35)';
  ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 7, 12, 5, 0, 0, 6.29); ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(a);
  // Legs, jacket, head.
  ctx.fillStyle = '#262d35';
  ctx.fillRect(-6, -8, 7, 5);
  ctx.fillRect(-6, 3, 7, 5);
  ctx.fillStyle = p.weapon === 'fists' ? '#e0884f' : '#d96051';
  rr(ctx, -7, -7, 14, 14, 5); ctx.fill();
  ctx.fillStyle = '#f0d6c0';
  ctx.beginPath(); ctx.arc(3, 0, 6, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#20242b';
  ctx.beginPath(); ctx.arc(2, 0, 5.7, Math.PI * 0.55, Math.PI * 1.85); ctx.fill();
  // Weapon in the aiming hand.
  ctx.fillStyle = '#c9d0d4';
  if (p.weapon === 'fists') ctx.fillRect(7, -3, 8, 6);
  else if (p.weapon === 'pistol') ctx.fillRect(6, -2.5, 20, 5);
  else { ctx.fillRect(6, -4, 27, 8); ctx.fillStyle = '#39434c'; ctx.fillRect(9, 2, 7, 9); }
  ctx.restore();
  if (p.hurt > 0) {
    ctx.fillStyle = `rgba(240,70,80,${p.hurt * 0.3})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, 6.29); ctx.fill();
  }
  // Player marker arrow.
  ctx.fillStyle = '#f7d774';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 38);
  ctx.lineTo(p.x - 6, p.y - 49);
  ctx.lineTo(p.x + 6, p.y - 49);
  ctx.closePath(); ctx.fill();
}

function drawEffects(game, ctx, v) {
  for (const b of game.bullets) {
    if (b.x < v.x0 || b.x > v.x1 || b.y < v.y0 || b.y > v.y1) continue;
    const l = Math.hypot(b.vx, b.vy) || 1;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.friendly ? 3 : 2.6;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - (b.vx / l) * b.trail, b.y - (b.vy / l) * b.trail);
    ctx.stroke();
  }
  for (const r of game.rings) {
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = clamp(r.life / 0.55, 0, 1);
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const p of game.particles) {
    if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const t of game.texts) {
    ctx.globalAlpha = clamp(t.life / 1.25, 0, 1);
    ctx.fillStyle = t.color;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(game, ctx) {
  const m = game.marker;
  if (!m) return;
  const pulse = 1 + Math.sin(game.time * 4) * 0.12;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.fillStyle = m.color === '#8ee9df' ? 'rgba(120,235,220,0.14)' : 'rgba(250,210,110,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 10, 40 * pulse, 18 * pulse, 0, 0, 6.29); ctx.fill();
  ctx.strokeStyle = m.color;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 10, 34 * pulse, 15 * pulse, 0, 0, 6.29); ctx.stroke();
  ctx.translate(0, -46 + Math.sin(game.time * 3) * 5);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = m.color;
  ctx.fillRect(-9, -9, 18, 18);
  ctx.fillStyle = 'rgba(30,35,42,0.85)';
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = m.label || 'OBJECTIVE';
  const w = ctx.measureText(label).width + 16;
  ctx.fillStyle = 'rgba(20,25,32,0.85)';
  ctx.fillRect(m.x - w / 2, m.y - 82, w, 18);
  ctx.fillStyle = m.color;
  ctx.fillText(label, m.x, m.y - 69);
}

function drawSunsetLight(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, 'rgba(255,158,112,0.075)');
  g.addColorStop(0.55, 'rgba(255,120,130,0.025)');
  g.addColorStop(1, 'rgba(16,34,66,0.13)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 250, VIEW_W / 2, VIEW_H / 2, 780);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,14,26,0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
