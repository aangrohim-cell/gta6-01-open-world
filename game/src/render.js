// Everything the world looks like, drawn top-down through a follow camera: the sea and sand, the
// road grid with its crosswalks, blocks, extruded buildings with long sunset shadows, palms and
// street furniture, cars, people, bullets and blood. hud.js draws the interface over it.
//
// The renderer allocates nothing per frame that it can reuse, and culls by the visible rectangle.

import { CAR_COLORS, CITY, PALETTE, PLAYER_LOOK, VIEW } from './config.js';
import { clamp, shade, withAlpha } from './random.js';
import { breathe, pulse } from './vfx.js';

const HALF_W = VIEW.width / 2;
const HALF_H = VIEW.height / 2;
const ROAD_HALF = CITY.road / 2;

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeNoise(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(128, 128);
  let state = seed | 0;
  for (let index = 0; index < image.data.length; index += 4) {
    state = (state * 1664525 + 1013904223) | 0;
    const value = ((state >>> 16) & 255);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 26;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function makeCanvasPattern(ctx, seed) {
  const canvas = makeNoise(seed);
  const pattern = ctx.createPattern(canvas, 'repeat');
  return { canvas, pattern };
}

export function createWorldRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  const grain = makeCanvasPattern(ctx, 923741);

  function visible(cam, margin = 120) {
    const halfW = HALF_W / cam.zoom;
    const halfH = HALF_H / cam.zoom;
    return {
      x0: cam.x - halfW - margin,
      y0: cam.y - halfH - margin,
      x1: cam.x + halfW + margin,
      y1: cam.y + halfH + margin,
      halfW, halfH,
    };
  }

  function inView(rect, view) {
    return rect.x < view.x1 && rect.x + rect.w > view.x0 && rect.y < view.y1 && rect.y + rect.h > view.y0;
  }

  /* ---------------------------------------------------------------- ground */

  function drawSea(view, time) {
    if (view.y1 < CITY.landHeight + CITY.road / 2) return;
    const waterY = CITY.landHeight + CITY.road / 2 + CITY.beachDepth;
    if (view.y1 < waterY) return;
    const top = Math.max(waterY, view.y0);
    const gradient = ctx.createLinearGradient(0, waterY, 0, CITY.height);
    gradient.addColorStop(0, '#3a819a');
    gradient.addColorStop(0.35, '#2a6b86');
    gradient.addColorStop(1, '#1b4560');
    ctx.fillStyle = gradient;
    ctx.fillRect(view.x0, top, view.x1 - view.x0, Math.min(view.y1, CITY.height) - top);
    // Long glittering rows of small waves.
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 225, 235, 0.32)';
    ctx.lineWidth = 1.6;
    for (let row = 0; row < 26; row += 1) {
      const y = waterY + 18 + row * 26;
      if (y > view.y1) break;
      if (y < view.y0) continue;
      ctx.beginPath();
      for (let x = Math.max(view.x0, 0); x < Math.min(view.x1, CITY.width); x += 46) {
        const wave = Math.sin(x * 0.02 + time * 0.9 + row) * 5;
        const alpha = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(x * 0.006 - time * 0.4 + row));
        ctx.globalAlpha = alpha;
        ctx.moveTo(x, y + wave);
        ctx.lineTo(x + 22, y + wave + Math.sin(x * 0.03 + time) * 2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSand(view, time) {
    const sandTop = CITY.landHeight + ROAD_HALF;
    const waterY = sandTop + CITY.beachDepth;
    if (view.y1 < sandTop) return;
    const top = Math.max(sandTop, view.y0);
    const bottom = Math.min(waterY, view.y1);
    if (bottom > top) {
      const gradient = ctx.createLinearGradient(0, sandTop, 0, waterY);
      gradient.addColorStop(0, '#e2c48d');
      gradient.addColorStop(0.8, '#e8cd9a');
      gradient.addColorStop(1, '#d9b982');
      ctx.fillStyle = gradient;
      ctx.fillRect(view.x0, top, view.x1 - view.x0, bottom - top);
      // Dry ripples and darker damp sand at the water line.
      ctx.fillStyle = 'rgba(186, 147, 95, 0.18)';
      for (let row = 0; row < 12; row += 1) {
        const y = sandTop + 30 + row * 26 + Math.sin(row * 2.1) * 8;
        if (y < view.y0 || y > bottom) continue;
        ctx.fillRect(view.x0, y, view.x1 - view.x0, 2);
      }
      ctx.fillStyle = 'rgba(160, 132, 96, 0.5)';
      ctx.fillRect(view.x0, waterY - 10, view.x1 - view.x0, 10);
      // Foam.
      ctx.fillStyle = 'rgba(235, 250, 245, 0.6)';
      for (let x = Math.max(view.x0, 0); x < Math.min(view.x1, CITY.width); x += 32) {
        const y = waterY - 4 + Math.sin(x * 0.05 + time * 1.4) * 2;
        ctx.fillRect(x, y, 22, 3);
      }
    }
  }

  function drawRoads(view) {
    const P = CITY.pitch;
    const startJ = Math.floor((view.y0 - ROAD_HALF) / P);
    const endJ = Math.ceil((view.y1 + ROAD_HALF) / P);
    const startI = Math.floor((view.x0 - ROAD_HALF) / P);
    const endI = Math.ceil((view.x1 + ROAD_HALF) / P);
    ctx.fillStyle = PALETTE.asphalt;
    for (let j = startJ; j <= endJ; j += 1) {
      const y = j * P;
      if (y + ROAD_HALF < 0 || y - ROAD_HALF > CITY.landHeight + ROAD_HALF) continue;
      ctx.fillRect(view.x0, y - ROAD_HALF, view.x1 - view.x0, CITY.road);
    }
    for (let i = startI; i <= endI; i += 1) {
      const x = i * P;
      if (x + ROAD_HALF < 0 || x - ROAD_HALF > CITY.width) continue;
      ctx.fillRect(x - ROAD_HALF, view.y0, CITY.road, view.y1 - view.y0);
    }
    // A little tar and repair variety.
    ctx.fillStyle = 'rgba(30, 27, 38, 0.16)';
    for (let j = startJ; j <= endJ; j += 1) {
      for (let i = startI; i <= endI; i += 1) {
        const cx = i * P + ((i * 37 + j * 61) % 140) - 70;
        const cy = j * P + ((i * 71 + j * 23) % 70) - 35;
        if (cx < view.x0 || cx > view.x1 || cy < view.y0 || cy > view.y1) continue;
        ctx.fillRect(cx, cy, 42 + (i * 13) % 30, 6);
      }
    }
    // Edge lines and centre line.
    ctx.lineWidth = 2;
    for (let j = startJ; j <= endJ; j += 1) {
      const y = j * P;
      if (y < view.y0 - 10 || y > view.y1 + 10) continue;
      ctx.strokeStyle = 'rgba(235, 230, 212, 0.35)';
      for (const offset of [-ROAD_HALF + 10, ROAD_HALF - 10]) {
        ctx.beginPath();
        ctx.moveTo(Math.max(view.x0, 0), y + offset);
        ctx.lineTo(Math.min(view.x1, CITY.width), y + offset);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(240, 199, 96, 0.5)';
      ctx.setLineDash([16, 22]);
      for (const offset of [-2, 2]) {
        ctx.beginPath();
        ctx.moveTo(Math.max(view.x0, 0), y + offset);
        ctx.lineTo(Math.min(view.x1, CITY.width), y + offset);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    for (let i = startI; i <= endI; i += 1) {
      const x = i * P;
      if (x < view.x0 - 10 || x > view.x1 + 10) continue;
      ctx.strokeStyle = 'rgba(235, 230, 212, 0.35)';
      for (const offset of [-ROAD_HALF + 10, ROAD_HALF - 10]) {
        ctx.beginPath();
        ctx.moveTo(x + offset, Math.max(view.y0, 0));
        ctx.lineTo(x + offset, Math.min(view.y1, CITY.landHeight));
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(240, 199, 96, 0.5)';
      ctx.setLineDash([16, 22]);
      for (const offset of [-2, 2]) {
        ctx.beginPath();
        ctx.moveTo(x + offset, Math.max(view.y0, 0));
        ctx.lineTo(x + offset, Math.min(view.y1, CITY.landHeight));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // Crosswalks and stop lines around each intersection.
    ctx.fillStyle = 'rgba(240, 237, 226, 0.72)';
    for (let j = startJ; j <= endJ; j += 1) {
      for (let i = startI; i <= endI; i += 1) {
        const cx = i * P;
        const cy = j * P;
        if (cx < view.x0 - 90 || cx > view.x1 + 90 || cy < view.y0 - 90 || cy > view.y1 + 90) continue;
        if (cy > CITY.landHeight || cx > CITY.width || cx < 0 || cy < 0) continue;
        for (let s = 0; s < 5; s += 1) {
          const offset = s * 9;
          ctx.fillRect(cx - 56 + offset, cy - ROAD_HALF + 14, 5, 26);
          ctx.fillRect(cx - 56 + offset, cy + ROAD_HALF - 40, 5, 26);
          ctx.fillRect(cx - ROAD_HALF + 14, cy - 56 + offset, 26, 5);
          ctx.fillRect(cx + ROAD_HALF - 40, cy - 56 + offset, 26, 5);
        }
      }
    }
  }

  function drawBlockGround(block, view) {
    const { x, y, w, h } = block;
    // Sidewalk slab.
    ctx.fillStyle = PALETTE.sidewalk;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(98, 88, 78, 0.55)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 4);
    ctx.stroke();
    // Expansion joints along the kerb.
    ctx.strokeStyle = 'rgba(120, 110, 100, 0.35)';
    ctx.lineWidth = 1;
    for (let t = 20; t < w; t += 28) {
      ctx.beginPath();
      ctx.moveTo(x + t, y + 1);
      ctx.lineTo(x + t, y + 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + t, y + h - 24);
      ctx.lineTo(x + t, y + h - 1);
      ctx.stroke();
    }
    const lot = block.lot;
    if (block.type === 'park') {
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.fillStyle = 'rgba(88, 115, 64, 0.55)';
      for (let index = 0; index < 12; index += 1) {
        const px = lot.x + 10 + ((index * 97) % (lot.w - 20));
        const py = lot.y + 10 + ((index * 61) % (lot.h - 20));
        ctx.beginPath();
        ctx.ellipse(px, py, 12, 7, index, 0, Math.PI * 2);
        ctx.fill();
      }
      if (block.park?.paths) {
        ctx.fillStyle = 'rgba(206, 190, 158, 0.75)';
        ctx.fillRect(lot.x, lot.y + lot.h / 2 - 9, lot.w, 18);
        ctx.fillRect(lot.x + lot.w / 2 - 9, lot.y, 18, lot.h);
      }
    } else if (block.type === 'lot') {
      ctx.fillStyle = '#56525e';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(235, 232, 218, 0.32)';
      ctx.lineWidth = 1.4;
      for (const spot of block.parking ?? []) {
        ctx.beginPath();
        ctx.moveTo(spot.x - 24, spot.y - 36);
        ctx.lineTo(spot.x - 24, spot.y + 36);
        ctx.stroke();
      }
    } else if (block.type === 'pierlot' || block.type === 'beach') {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    } else {
      ctx.fillStyle = '#958d80';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.fillStyle = 'rgba(120, 112, 103, 0.35)';
      for (let index = 0; index < 5; index += 1) {
        ctx.fillRect(lot.x + 14 + index * 47, lot.y + 18, 2, lot.h - 36);
      }
    }
    // Kerb highlight on the street sides.
    ctx.fillStyle = 'rgba(240, 232, 216, 0.22)';
    ctx.fillRect(x + 3, y + h - 4, w - 6, 2);
    ctx.fillRect(x + w - 4, y + 3, 2, h - 6);
  }

  function drawBuildingShadow(building, view) {
    if (!inView({ x: building.x - 20, y: building.y - 20, w: building.w + 90, h: building.h + 90 }, view)) return;
    const e = Math.min(30, 6 + building.height * 0.34);
    ctx.fillStyle = 'rgba(35, 26, 46, 0.24)';
    ctx.fillRect(building.x + e * 1.35 + 4, building.y + e * 0.95 + 3, building.w, building.h);
    // A soft second edge fakes the penumbra.
    ctx.fillStyle = 'rgba(35, 26, 46, 0.09)';
    ctx.fillRect(building.x + e * 1.35 + 10, building.y + e * 0.95 + 9, building.w + 6, building.h + 4);
  }

  function drawBuilding(building, view, time) {
    if (!inView({ x: building.x - 10, y: building.y - 10, w: building.w + 40, h: building.h + 40 }, view)) return;
    const e = Math.min(30, 6 + building.height * 0.34);
    const x = building.x;
    const y = building.y;
    const w = building.w;
    const h = building.h;
    // The two visible walls, extruded to the south-east.
    ctx.fillStyle = building.wall;
    ctx.fillRect(x, y, w + e, h + e);
    ctx.fillStyle = shade(building.wall, -14);
    ctx.fillRect(x + 2, y + h, w + e - 2, e);
    ctx.fillRect(x + w, y + 2, e, h + e - 2);
    // A stripe of windows on the south wall.
    ctx.fillStyle = 'rgba(34, 44, 58, 0.72)';
    const rows = Math.max(1, Math.floor(e / 9));
    for (let row = 0; row < rows; row += 1) {
      const wy = y + h + 4 + row * 9;
      for (let wx = x + 6; wx < x + w - 8; wx += 15) {
        if ((Math.floor(wx) + row * 3) % 4 === 0) continue;
        ctx.fillRect(wx, wy, 8, 5);
      }
    }
    for (let wy = y + 6; wy < y + h - 6; wy += 15) {
      ctx.fillStyle = (Math.floor(wy) % 3 === 0) ? 'rgba(200, 190, 150, 0.4)' : 'rgba(34, 44, 58, 0.55)';
      ctx.fillRect(x + w + 5, wy, 5, 8);
    }
    // Roof.
    ctx.fillStyle = building.color;
    ctx.fillRect(x, y, w, h);
    if (building.kind === 'tower') {
      ctx.fillStyle = shade(building.color, 12);
      ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
      ctx.strokeStyle = 'rgba(32, 40, 54, 0.35)';
      ctx.lineWidth = 1;
      for (let gx = x + 12; gx < x + w - 8; gx += 16) {
        ctx.beginPath();
        ctx.moveTo(gx, y + 8);
        ctx.lineTo(gx, y + h - 8);
        ctx.stroke();
      }
      for (let gy = y + 12; gy < y + h - 8; gy += 18) {
        ctx.beginPath();
        ctx.moveTo(x + 8, gy);
        ctx.lineTo(x + w - 8, gy);
        ctx.stroke();
      }
    } else if (building.kind === 'shop') {
      ctx.fillStyle = 'rgba(255, 246, 225, 0.18)';
      ctx.fillRect(x + 8, y + 8, w - 16, 12);
    } else {
      ctx.fillStyle = 'rgba(255, 250, 235, 0.1)';
      ctx.fillRect(x + 7, y + 7, w - 14, 5);
    }
    // Parapet.
    ctx.strokeStyle = 'rgba(30, 27, 38, 0.38)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = 'rgba(255, 245, 225, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    // Awning over the pavement.
    if (building.awning) {
      ctx.fillStyle = building.awning;
      ctx.fillRect(x + 5, y + h - 2, w - 10, 10);
      ctx.fillStyle = 'rgba(255, 246, 230, 0.55)';
      for (let sx = x + 9; sx < x + w - 12; sx += 14) ctx.fillRect(sx, y + h - 2, 6, 10);
    }
    // Roof lettering and landmark marks.
    if (building.sign) {
      ctx.save();
      ctx.fillStyle = 'rgba(22, 20, 28, 0.55)';
      const signW = Math.min(w - 12, 16 + building.sign.text.length * 6.2);
      const signX = x + (w - signW) / 2;
      ctx.fillRect(signX, y + h - 30, signW, 14);
      ctx.fillStyle = building.sign.color;
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(building.sign.text, x + w / 2, y + h - 23);
      ctx.restore();
    }
    if (building.landmark === 'hospital') {
      ctx.fillStyle = '#f4f0e8';
      ctx.beginPath();
      ctx.arc(x + w - 36, y + 34, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d4453c';
      ctx.fillRect(x + w - 42, y + 30, 12, 8);
      ctx.fillRect(x + w - 39, y + 23, 6, 22);
    } else if (building.landmark === 'garage') {
      ctx.fillStyle = '#2b211c';
      ctx.fillRect(x + w / 2 - 34, y + h - 22, 68, 16);
      ctx.fillStyle = '#ffcf5c';
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("DEX'S", x + w / 2, y + h - 10);
    } else if (building.landmark === 'mansion') {
      ctx.fillStyle = 'rgba(140, 60, 55, 0.5)';
      ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
      ctx.fillStyle = '#f0e2c0';
      ctx.fillRect(x + 22, y + 22, w - 44, h - 44);
      ctx.fillStyle = 'rgba(90, 140, 150, 0.65)';
      ctx.fillRect(x + 36, y + 36, w - 72, h - 72);
    }
  }

  function drawProp(prop, view) {
    if (prop.x < view.x0 - 40 || prop.x > view.x1 + 40 || prop.y < view.y0 - 50 || prop.y > view.y1 + 40) return;
    const { x, y } = prop;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(prop.angle ?? 0);
    if (prop.type === 'palm') {
      const scale = prop.size ?? 1;
      ctx.fillStyle = 'rgba(30, 25, 40, 0.2)';
      ctx.beginPath();
      ctx.ellipse(8 * scale, 12 * scale, 24 * scale, 9 * scale, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6e5a3c';
      ctx.beginPath();
      ctx.arc(0, 0, 3.4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4d7a42';
      ctx.lineWidth = 2.4 * scale;
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2 + (prop.x % 1);
        ctx.strokeStyle = index % 2 === 0 ? '#3f6c3c' : '#578a45';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(angle) * 16 * scale, Math.sin(angle) * 16 * scale, Math.cos(angle) * 25 * scale, Math.sin(angle) * 25 * scale);
        ctx.stroke();
      }
    } else if (prop.type === 'tree') {
      const scale = prop.size ?? 1;
      ctx.fillStyle = 'rgba(30, 25, 40, 0.22)';
      ctx.beginPath();
      ctx.ellipse(7 * scale, 10 * scale, 25 * scale, 12 * scale, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f6239';
      ctx.beginPath();
      ctx.arc(-5 * scale, 2 * scale, 17 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#557d45';
      ctx.beginPath();
      ctx.arc(4 * scale, -4 * scale, 15 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b9452';
      ctx.beginPath();
      ctx.arc(-1 * scale, -8 * scale, 10 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'lamp') {
      ctx.fillStyle = 'rgba(30, 26, 38, 0.28)';
      ctx.beginPath();
      ctx.ellipse(5, 7, 10, 4, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d3b45';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a5862';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(9, -9);
      ctx.stroke();
      ctx.fillStyle = '#f4e6b4';
      ctx.beginPath();
      ctx.arc(10, -10, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'hydrant') {
      ctx.fillStyle = '#b93a30';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d85a4a';
      ctx.fillRect(-1.5, -6, 3, 12);
    } else if (prop.type === 'bench') {
      ctx.fillStyle = 'rgba(30, 26, 36, 0.2)';
      ctx.fillRect(-12, 3, 26, 5);
      ctx.fillStyle = '#7a5a3e';
      ctx.fillRect(-13, -4, 26, 8);
      ctx.fillStyle = '#5c4330';
      ctx.fillRect(-13, -4, 26, 2);
    } else if (prop.type === 'trash') {
      ctx.fillStyle = '#3f5948';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c3f33';
      ctx.beginPath();
      ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'planter') {
      ctx.fillStyle = '#8b7660';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#557d45';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b9452';
      ctx.beginPath();
      ctx.arc(-2, -3, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'fountain') {
      ctx.fillStyle = '#b8ad9e';
      ctx.beginPath();
      ctx.arc(0, 0, prop.size + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4d93a5';
      ctx.beginPath();
      ctx.arc(0, 0, prop.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 250, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, prop.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'pool') {
      ctx.fillStyle = '#c9bdab';
      ctx.fillRect(-prop.size / 2 - 4, -prop.size / 2 - 4, prop.size + 8, prop.size + 8);
      ctx.fillStyle = '#4fa3b8';
      ctx.fillRect(-prop.size / 2, -prop.size / 2, prop.size, prop.size);
      ctx.fillStyle = 'rgba(220, 250, 255, 0.4)';
      ctx.fillRect(-prop.size / 2 + 6, -prop.size / 2 + 6, prop.size - 12, 5);
    } else if (prop.type === 'umbrella') {
      const colors = ['#e8555f', '#3fc0c8', '#f2c23f', '#f08a3c'];
      ctx.fillStyle = 'rgba(30, 25, 40, 0.2)';
      ctx.beginPath();
      ctx.ellipse(6, 8, 18, 8, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors[Math.abs(Math.floor(prop.x + prop.y)) % colors.length];
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 250, 240, 0.65)';
      for (let index = 0; index < 4; index += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 17, index * 1.57, index * 1.57 + 0.35);
        ctx.fill();
      }
    } else if (prop.type === 'towel') {
      const colors = ['#e8555f', '#3fc0c8', '#f2c23f', '#7f5ac8'];
      ctx.fillStyle = colors[Math.abs(Math.floor(prop.x)) % colors.length];
      ctx.fillRect(-13, -7, 26, 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(-13, -2, 26, 3);
    } else if (prop.type === 'dune') {
      ctx.fillStyle = 'rgba(198, 164, 112, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 10, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'lifeguard') {
      ctx.fillStyle = 'rgba(30, 25, 40, 0.2)';
      ctx.fillRect(-18, 10, 46, 12);
      ctx.fillStyle = '#e6d7b4';
      ctx.fillRect(-18, -22, 36, 30);
      ctx.fillStyle = '#d75a4c';
      ctx.fillRect(-18, -22, 36, 7);
      ctx.fillStyle = '#3f8a92';
      ctx.fillRect(-8, -10, 16, 12);
      ctx.fillStyle = '#8a6b47';
      ctx.fillRect(-20, 8, 4, 12);
      ctx.fillRect(16, 8, 4, 12);
    } else if (prop.type === 'boat') {
      ctx.fillStyle = 'rgba(20, 40, 50, 0.25)';
      ctx.beginPath();
      ctx.ellipse(8, 10, 34, 13, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9e7df';
      ctx.beginPath();
      ctx.moveTo(-34, -10);
      ctx.quadraticCurveTo(0, -18, 38, 0);
      ctx.quadraticCurveTo(0, 18, -34, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8fb4c4';
      ctx.beginPath();
      ctx.arc(6, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3f5d6b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
    } else if (prop.type === 'pierlamp') {
      ctx.fillStyle = '#5a4632';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 230, 160, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'piercrate') {
      ctx.fillStyle = '#8a6740';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeStyle = '#5e4529';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-9, -9, 18, 18);
    } else if (prop.type === 'crates') {
      ctx.fillStyle = '#9a7446';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#6b4f2d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.beginPath();
      ctx.moveTo(-11, -11);
      ctx.lineTo(11, 11);
      ctx.moveTo(11, -11);
      ctx.lineTo(-11, 11);
      ctx.stroke();
    } else if (prop.type === 'garagedoor') {
      ctx.fillStyle = '#6c6a70';
      ctx.fillRect(-prop.size / 2, -5, prop.size, 10);
      ctx.strokeStyle = 'rgba(230, 230, 220, 0.25)';
      for (let line = -prop.size / 2 + 6; line < prop.size / 2; line += 9) {
        ctx.beginPath();
        ctx.moveTo(line, -5);
        ctx.lineTo(line, 5);
        ctx.stroke();
      }
    } else if (prop.type === 'helipad') {
      ctx.strokeStyle = 'rgba(245, 240, 225, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, prop.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(245, 240, 225, 0.6)';
      ctx.font = '700 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', 0, 2);
    } else if (prop.type === 'ambulance') {
      ctx.fillStyle = '#f0ede5';
      ctx.fillRect(-20, -9, 40, 18);
      ctx.fillStyle = '#d4453c';
      ctx.fillRect(-8, -9, 6, 18);
      ctx.fillStyle = '#7c8795';
      ctx.fillRect(6, -6, 10, 12);
    } else if (prop.type === 'neon') {
      ctx.fillStyle = 'rgba(255, 207, 92, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffcf5c';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-9, -6, 18, 12);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = '700 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GUNS', 0, 2);
    } else if (prop.type === 'ac') {
      ctx.fillStyle = 'rgba(25, 25, 30, 0.25)';
      ctx.fillRect(-prop.size / 2 + 2, -prop.size / 2 + 2, prop.size, prop.size);
      ctx.fillStyle = '#a9adb2';
      ctx.fillRect(-prop.size / 2, -prop.size / 2, prop.size, prop.size);
      ctx.strokeStyle = '#777c84';
      ctx.lineWidth = 1;
      for (let line = -prop.size / 2 + 2; line < prop.size / 2; line += 3) {
        ctx.beginPath();
        ctx.moveTo(line, -prop.size / 2 + 2);
        ctx.lineTo(line, prop.size / 2 - 2);
        ctx.stroke();
      }
    } else if (prop.type === 'vent' || prop.type === 'roofbox' || prop.type === 'skylight' || prop.type === 'sat') {
      ctx.fillStyle = prop.type === 'skylight' ? 'rgba(140, 190, 205, 0.65)' : '#6f7278';
      ctx.fillRect(-prop.size / 2, -prop.size / 2, prop.size, prop.size);
      if (prop.type === 'sat') {
        ctx.strokeStyle = '#c9c6bd';
        ctx.beginPath();
        ctx.arc(0, 0, prop.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- entities */

  function drawCar(car, time, isPlayer) {
    if (car.x < -80 || car.y < -80) return;
    const l = car.l;
    const w = car.w;
    const wreck = car.kind === 'wreck';
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(22, 18, 30, 0.3)';
    roundRect(ctx, -l / 2 + 5, -w / 2 + 6, l, w, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#1f1e25';
    for (const offset of [-l * 0.28, l * 0.28]) {
      ctx.fillRect(offset - 5, -w / 2 - 1, 10, 4);
      ctx.fillRect(offset - 5, w / 2 - 3, 10, 4);
    }
    const body = wreck ? '#3b3634' : car.color.body;
    const roof = wreck ? '#2c2827' : car.color.roof;
    // Body, with a lighter centre and darker bumpers.
    const gradient = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
    gradient.addColorStop(0, shade(body, 12));
    gradient.addColorStop(0.5, body);
    gradient.addColorStop(1, shade(body, -16));
    ctx.fillStyle = gradient;
    roundRect(ctx, -l / 2, -w / 2, l, w, 8);
    ctx.fill();
    ctx.fillStyle = shade(body, -26);
    ctx.fillRect(-l / 2, -w / 2 + 3, 5, w - 6);
    ctx.fillRect(l / 2 - 5, -w / 2 + 3, 5, w - 6);
    if (!wreck) {
      // Bonnet and boot highlights.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      roundRect(ctx, -l * 0.44, -w * 0.36, l * 0.22, w * 0.72, 4);
      ctx.fill();
      // Cabin.
      ctx.fillStyle = roof;
      roundRect(ctx, -l * 0.16, -w * 0.35, l * 0.4, w * 0.7, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(140, 196, 210, 0.72)';
      roundRect(ctx, l * 0.16, -w * 0.3, l * 0.075, w * 0.6, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 170, 190, 0.6)';
      roundRect(ctx, -l * 0.14, -w * 0.29, l * 0.06, w * 0.58, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(-l * 0.02, -w * 0.3, 2, w * 0.6);
      // Mirrors.
      ctx.fillStyle = shade(body, -18);
      ctx.fillRect(l * 0.1, -w / 2 - 3, 6, 3);
      ctx.fillRect(l * 0.1, w / 2, 6, 3);
      // Head and tail lights.
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(l / 2 - 3, -w / 2 + 4, 3, 6);
      ctx.fillRect(l / 2 - 3, w / 2 - 10, 3, 6);
      ctx.fillStyle = '#d2453e';
      ctx.fillRect(-l / 2, -w / 2 + 5, 2.5, 6);
      ctx.fillRect(-l / 2, w / 2 - 11, 2.5, 6);
      if (car.model === 'taxi') {
        ctx.fillStyle = '#23222a';
        ctx.fillRect(-4, -w * 0.18, 12, w * 0.36);
        ctx.fillStyle = '#f7e6a0';
        ctx.fillRect(-2, -w * 0.1, 8, w * 0.2);
        ctx.fillStyle = 'rgba(30, 30, 36, 0.5)';
        ctx.fillRect(-l / 2 + 8, -1, l - 16, 2);
      }
      if (car.model === 'sports') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(-l * 0.34, -w * 0.12, l * 0.24, 3);
        ctx.fillRect(-l * 0.34, w * 0.12 - 3, l * 0.24, 3);
      }
    } else {
      ctx.fillStyle = 'rgba(25, 22, 22, 0.7)';
      ctx.fillRect(-l * 0.2, -w * 0.3, l * 0.32, w * 0.6);
      ctx.strokeStyle = 'rgba(90, 80, 74, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-l * 0.1, -w * 0.2);
      ctx.lineTo(l * 0.1, w * 0.2);
      ctx.moveTo(l * 0.1, -w * 0.2);
      ctx.lineTo(-l * 0.1, w * 0.2);
      ctx.stroke();
    }
    if (car.kind === 'cop' && car.siren) {
      const phase = pulse(time, 11) > 0.5;
      // A soft coloured wash on the asphalt makes a distant siren readable before the light bar is.
      const washRadius = 92 * breathe(time, 11, 0, 0.16);
      const wash = ctx.createRadialGradient(0, 0, 4, 0, 0, washRadius);
      wash.addColorStop(0, phase ? 'rgba(255, 70, 60, 0.18)' : 'rgba(75, 125, 255, 0.18)');
      wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(0, 0, washRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const glow = (color) => {
        const radial = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
        radial.addColorStop(0, color);
        radial.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
      };
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(-l * 0.02, -w * 0.2);
      glow(phase ? 'rgba(255, 60, 50, 0.55)' : 'rgba(70, 120, 255, 0.5)');
      ctx.restore();
      ctx.fillStyle = '#1f2638';
      ctx.fillRect(-l * 0.09, -w * 0.34, l * 0.1, w * 0.68);
      ctx.fillStyle = phase ? '#ff4a3d' : '#3d6bff';
      ctx.fillRect(-l * 0.09, -w * 0.34, l * 0.1, w * 0.3);
      ctx.fillStyle = phase ? '#3d6bff' : '#ff4a3d';
      ctx.fillRect(-l * 0.09, w * 0.04, l * 0.1, w * 0.3);
    }
    if (isPlayer) {
      ctx.fillStyle = 'rgba(255, 250, 235, 0.16)';
      roundRect(ctx, -l / 2 - 2, -w / 2 - 2, l + 4, w + 4, 9);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 240, 210, 0.4)';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(person, look, angle, walkPhase, options = {}) {
    const scale = options.scale ?? 1;
    const dead = options.dead;
    ctx.save();
    ctx.translate(person.x, person.y);
    if (dead) {
      ctx.rotate(person.angle + 0.6);
      ctx.fillStyle = 'rgba(22, 18, 28, 0.25)';
      ctx.beginPath();
      ctx.ellipse(3, 4, 12 * scale, 8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11 * scale, 6.4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.skin;
      ctx.beginPath();
      ctx.arc(9 * scale, 0, 3.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.pants;
      ctx.fillRect(-9 * scale, -4 * scale, 7 * scale, 3 * scale);
      ctx.fillRect(-9 * scale, 1 * scale, 7 * scale, 3 * scale);
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(22, 18, 28, 0.28)';
    ctx.beginPath();
    ctx.ellipse(2 * scale, 4 * scale, 8 * scale, 4 * scale, 0.4, 0, Math.PI * 2);
    ctx.fill();
    const swing = Math.sin(walkPhase) * 2.4 * scale;
    // Legs.
    ctx.fillStyle = look.pants;
    ctx.fillRect(-3 * scale, -4.6 * scale + swing * 0.4, 8 * scale, 3.2 * scale);
    ctx.fillRect(-3 * scale, 1.4 * scale - swing * 0.4, 8 * scale, 3.2 * scale);
    // Body.
    ctx.fillStyle = look.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.4 * scale, 5.6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    if (look.jacket) {
      ctx.strokeStyle = look.jacket;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, 5.5 * scale, Math.PI * 0.35, Math.PI * 1.65);
      ctx.stroke();
    }
    // Arms; the right one holds a gun forward when the person is armed.
    ctx.strokeStyle = look.skin;
    ctx.lineWidth = 2.6 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -4.6 * scale);
    ctx.lineTo(3.4 * scale, -7 * scale);
    ctx.stroke();
    if (options.armed) {
      ctx.beginPath();
      ctx.moveTo(1 * scale, 4.6 * scale);
      ctx.lineTo(8.6 * scale, 4 * scale);
      ctx.stroke();
      ctx.fillStyle = '#22212a';
      ctx.fillRect(8 * scale, 3 * scale, 6 * scale, 2 * scale);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, 4.6 * scale);
      ctx.lineTo(3.4 * scale, 7 * scale);
      ctx.stroke();
    }
    // Head.
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(1.6 * scale, 0, 4.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(0.6 * scale, 0, 4.1 * scale, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fill();
    if (look.cap) {
      ctx.fillStyle = '#1b2438';
      ctx.beginPath();
      ctx.arc(1.6 * scale, 0, 4.6 * scale, Math.PI * 0.6, Math.PI * 1.4);
      ctx.fill();
      ctx.fillRect(4.4 * scale, -2.6 * scale, 3.4 * scale, 5.2 * scale);
    }
    if (look.bandana) {
      ctx.fillStyle = '#a12b31';
      ctx.fillRect(0.4 * scale, -3.2 * scale, 5.2 * scale, 6.4 * scale);
    }
    if (options.boss) {
      ctx.strokeStyle = 'rgba(255, 207, 92, 0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarker(marker, time) {
    const markerScale = breathe(time, 3.2, 0, 0.12);
    const radius = (marker.r ?? 55) * 0.55;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.globalAlpha = 0.75;
    const color = marker.kind === 'mission' ? '#ffcf5c' : marker.kind === 'kill' ? '#ff6b5a' : marker.kind === 'vehicle' ? '#7fe6c8' : '#ffcf5c';
    ctx.fillStyle = withAlpha(color, 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.25 * markerScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.8);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius * markerScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(color, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7 * markerScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    const size = 13;
    if (marker.kind === 'kill') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.stroke();
    } else if (marker.kind === 'vehicle') {
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = 'rgba(20, 30, 30, 0.7)';
      ctx.fillRect(-5, -3, 6, 6);
    } else {
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.kind === 'mission' ? (marker.label ?? 'M') : '!', 0, 1);
    }
    ctx.restore();
  }

  function drawPickup(item, time) {
    const bob = Math.sin(item.bob) * 2;
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    if (item.type === 'cash') {
      ctx.fillStyle = 'rgba(30, 80, 40, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7fc95c';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = '#d9f5b8';
      ctx.font = '700 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3);
    } else if (item.type === 'ammo') {
      ctx.fillStyle = 'rgba(180, 140, 40, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9a545';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#3a3020';
      for (let index = -5; index <= 5; index += 5) ctx.fillRect(index, -3, 2, 6);
    } else if (item.type === 'health') {
      ctx.fillStyle = 'rgba(200, 70, 70, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f0e8';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#d4453c';
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillRect(-5, -2, 10, 4);
    } else if (item.type === 'armor') {
      ctx.fillStyle = 'rgba(80, 120, 230, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7fa8ff';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, -4);
      ctx.lineTo(6, 5);
      ctx.lineTo(0, 8);
      ctx.lineTo(-6, 5);
      ctx.lineTo(-7, -4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTapes(view, time) {
    for (const tape of worldTapes) {
      if (tape.taken) continue;
      if (tape.x < view.x0 - 30 || tape.x > view.x1 + 30 || tape.y < view.y0 - 30 || tape.y > view.y1 + 30) continue;
      const glow = 0.6 + 0.4 * Math.sin(time * 3 + tape.index);
      ctx.save();
      ctx.translate(tape.x, tape.y);
      ctx.fillStyle = `rgba(255, 130, 220, ${0.16 * glow})`;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c2634';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#ff9de2';
      ctx.fillRect(-6, -3, 5, 3);
      ctx.fillRect(1, -3, 5, 3);
      ctx.fillStyle = '#ffcf5c';
      ctx.fillRect(-9, -6, 18, 1.5);
      ctx.restore();
    }
  }

  let worldTapes = [];

  /* ---------------------------------------------------------------- effects */

  let effects = null;

  function drawDecals(view) {
    for (const decal of effects.decals) {
      if (decal.x < view.x0 || decal.x > view.x1 || decal.y < view.y0 || decal.y > view.y1) continue;
      if (decal.type === 'blood') {
        ctx.fillStyle = 'rgba(112, 22, 30, 0.55)';
        ctx.beginPath();
        ctx.ellipse(decal.x, decal.y, decal.size, decal.size * 0.7, decal.angle, 0, Math.PI * 2);
        ctx.fill();
      } else if (decal.type === 'scorch') {
        ctx.fillStyle = 'rgba(24, 20, 22, 0.45)';
        ctx.beginPath();
        ctx.ellipse(decal.x, decal.y, decal.size, decal.size * 0.8, decal.angle, 0, Math.PI * 2);
        ctx.fill();
      } else if (decal.type === 'skid') {
        ctx.save();
        ctx.translate(decal.x, decal.y);
        ctx.rotate(decal.angle);
        ctx.fillStyle = 'rgba(28, 26, 32, 0.35)';
        ctx.fillRect(-6, -1.6, 12, 3.2);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(60, 55, 50, 0.4)';
        ctx.beginPath();
        ctx.arc(decal.x, decal.y, decal.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawEffects(view, time) {
    // Tracers.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const tracer of effects.tracers) {
      const alpha = Math.max(0, tracer.life / tracer.max);
      ctx.strokeStyle = tracer.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(tracer.x1, tracer.y1);
      ctx.lineTo(tracer.x2, tracer.y2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.5;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    for (const flashEffect of effects.flashes) {
      if (flashEffect.x < view.x0 || flashEffect.x > view.x1) continue;
      const alpha = Math.max(0, flashEffect.life / flashEffect.max);
      const radial = ctx.createRadialGradient(flashEffect.x, flashEffect.y, 1, flashEffect.x, flashEffect.y, flashEffect.size);
      radial.addColorStop(0, `rgba(255, 240, 190, ${0.9 * alpha})`);
      radial.addColorStop(0.5, `rgba(255, 190, 80, ${0.5 * alpha})`);
      radial.addColorStop(1, 'rgba(255, 140, 40, 0)');
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(flashEffect.x, flashEffect.y, flashEffect.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Particles, back to front by type.
    for (const particle of effects.particles) {
      if (particle.x < view.x0 - 30 || particle.x > view.x1 + 30 || particle.y < view.y0 - 30 || particle.y > view.y1 + 30) continue;
      const alpha = clamp(particle.life / Math.min(0.6, particle.max), 0, 1);
      ctx.globalAlpha = alpha * (particle.glow ? 0.9 : 0.8);
      if (particle.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    for (const ring of effects.rings) {
      const alpha = Math.max(0, ring.life / ring.max);
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = 3 + (1 - alpha) * 8;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- water front pier */

  function drawPier(view, pier) {
    if (!pier) return;
    if (pier.x > view.x1 || pier.x + pier.w < view.x0 || pier.y > view.y1) return;
    ctx.fillStyle = 'rgba(30, 40, 46, 0.35)';
    ctx.fillRect(pier.x + 8, pier.y + 12, pier.w, pier.h);
    ctx.fillStyle = '#9a774f';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = 'rgba(90, 66, 40, 0.4)';
    for (let y = pier.y + 4; y < Math.min(pier.y + pier.h, view.y1); y += 12) {
      ctx.fillRect(pier.x, y, pier.w, 1.4);
    }
    ctx.fillStyle = '#6d5033';
    ctx.fillRect(pier.x, pier.y, 5, pier.h);
    ctx.fillRect(pier.x + pier.w - 5, pier.y, 5, pier.h);
  }

  /* ---------------------------------------------------------------- top-level draw */

  function drawWorld(world, cam, time) {
    const view = visible(cam);
    effects = world.effects;
    worldTapes = world.city.tapes;
    ctx.fillStyle = '#8d8678';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(HALF_W + world.state.shakeX * cam.zoom, HALF_H + world.state.shakeY * cam.zoom);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawSea(view, time);
    drawSand(view, time);
    drawRoads(view);

    const blocks = world.city.blocks;
    for (const block of blocks) {
      if (block.x > view.x1 || block.x + block.w < view.x0 || block.y > view.y1 || block.y + block.h < view.y0) continue;
      drawBlockGround(block, view);
    }
    drawPier(view, world.city.pier);

    // Building shadows first, then bodies: a long shadow can cross the next street.
    for (const building of world.city.buildings) drawBuildingShadow(building, view);
    for (const building of world.city.buildings) drawBuilding(building, view, time);
    for (const prop of world.city.props) drawProp(prop, view);
    drawDecals(view);
    drawTapes(view, time);

    for (const marker of world.state.markers) drawMarker(marker, time);
    for (const pickup of world.pickups) drawPickup(pickup, time);

    // People and cars: dead before living, parked and wrecks before moving cars.
    for (const ped of world.peds.list) {
      if (ped.x < view.x0 - 30 || ped.x > view.x1 + 30 || ped.y < view.y0 - 30 || ped.y > view.y1 + 30) continue;
      drawPerson(ped, ped.look, ped.angle, ped.walkPhase, { dead: ped.dead, armed: false });
    }
    for (const man of world.men.list) {
      if (man.x < view.x0 - 30 || man.x > view.x1 + 30 || man.y < view.y0 - 30 || man.y > view.y1 + 30) continue;
      drawPerson(man, man.look, man.angle, man.walkPhase, { dead: man.dead, armed: !man.dead, boss: man.boss });
    }
    const cars = world.cars.list;
    for (const car of cars) {
      if (car.kind !== 'player') continue;
      drawCar(car, time, true);
    }
    for (const car of cars) {
      if (car.kind === 'player') continue;
      if (car.x < view.x0 - 80 || car.x > view.x1 + 80 || car.y < view.y0 - 80 || car.y > view.y1 + 80) continue;
      drawCar(car, time, false);
    }
    if (!world.player.inCar && !world.player.dead) {
      drawPerson(world.player, PLAYER_LOOK, world.player.angle, world.player.walkPhase, {
        armed: world.player.weapon !== 'fists',
        scale: 1.06,
      });
      // A soft ring under the player's feet, tinted blue while armor is active.
      const armored = world.player.armor > 0;
      ctx.strokeStyle = armored ? 'rgba(140, 190, 255, 0.55)' : 'rgba(255, 244, 210, 0.35)';
      ctx.lineWidth = armored ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(world.player.x, world.player.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      if (armored) {
        ctx.strokeStyle = `rgba(120, 175, 255, ${0.16 + pulse(time, 2.4) * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(world.player.x, world.player.y, 17 * breathe(time, 2.4, 0, 0.06), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    drawEffects(view, time);
    ctx.restore();

    // Warm light and a vignette over the world, under the HUD.
    ctx.save();
    const light = ctx.createLinearGradient(0, 0, VIEW.width, VIEW.height);
    light.addColorStop(0, 'rgba(255, 196, 120, 0.10)');
    light.addColorStop(0.55, 'rgba(255, 160, 110, 0.02)');
    light.addColorStop(1, 'rgba(40, 30, 80, 0.12)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const vignette = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.36, VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.72);
    vignette.addColorStop(0, 'rgba(10, 8, 18, 0)');
    vignette.addColorStop(1, 'rgba(10, 8, 18, 0.32)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = grain.pattern;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.restore();
  }

  return { drawWorld, ctx, roundRect };
}
