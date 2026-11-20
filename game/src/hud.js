// Heads-up display: minimap, health, armour, stars, weapon, objective and prompts.
import { VIEW_W, VIEW_H, ROAD_X, ROAD_Y, ROAD_W, WATER_Y, BEACH_Y, WORLD_W, WEAPONS, CAR_TYPES } from './config.js';
import { clamp, dist } from './random.js';

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.46;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHud(game, ctx) {
  if (game.mode === 'title') return;
  const p = game.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top left: money and vitals.
  panel(ctx, 18, 16, 250, 104);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = p.money >= 0 ? '#a8e9b0' : '#f08b8b';
  ctx.fillText('$' + Math.round(p.money).toLocaleString('en-US'), 32, 45);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(235,235,225,0.55)';
  ctx.fillText('CASH', 32, 59);

  bar(ctx, 108, 29, 146, 12, p.health / 100, '#e46d6d', 'HP');
  bar(ctx, 108, 55, 146, 12, p.armour / 100, '#78c4e8', 'AR');
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(240,240,230,0.8)';
  ctx.fillText(p.car ? CAR_TYPES[p.car.type].name : 'ON FOOT', 108, 96);

  // Wanted stars.
  ctx.font = 'bold 23px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    const x = 32 + i * 27;
    drawStar(ctx, x + 9, 82, 9, i < game.stars ? '#ffd166' : 'rgba(255,255,255,0.18)');
  }
  if (game.stars > 0) {
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,180,170,0.8)';
    ctx.fillText('WANTED', 174, 86);
  }

  // Objective banner.
  const objective = game.objective;
  ctx.font = 'bold 13px system-ui, sans-serif';
  const ow = Math.min(700, ctx.measureText(objective).width + 46);
  panel(ctx, VIEW_W / 2 - ow / 2, 16, ow, 34);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7d774';
  ctx.fillText(objective, VIEW_W / 2, 39);

  // Notices.
  let ny = 62;
  for (const n of game.notices) {
    ctx.globalAlpha = clamp(n.ttl / 0.7, 0, 1);
    ctx.font = 'bold 12px system-ui, sans-serif';
    const w = ctx.measureText(n.text).width + 24;
    ctx.fillStyle = 'rgba(18,24,31,0.78)';
    ctx.fillRect(VIEW_W / 2 - w / 2, ny, w, 22);
    ctx.fillStyle = n.color;
    ctx.textAlign = 'center';
    ctx.fillText(n.text, VIEW_W / 2, ny + 15);
    ctx.globalAlpha = 1;
    ny += 26;
  }

  drawMinimap(game, ctx);

  // Weapon panel.
  panel(ctx, 18, VIEW_H - 88, 232, 70);
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(230,230,220,0.55)';
  ctx.fillText('1 FISTS    2 PISTOL    3 SMG', 30, VIEW_H - 70);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#f5e7c8';
  ctx.fillText(WEAPONS[p.weapon].name, 30, VIEW_H - 45);
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = p.ammo[p.weapon] === 0 && p.weapon !== 'fists' ? '#ef7b7b' : '#f7d774';
  ctx.fillText(p.weapon === 'fists' ? '∞' : String(p.ammo[p.weapon]), 238, VIEW_H - 42);

  // Speedometer.
  if (p.car) {
    panel(ctx, VIEW_W - 202, VIEW_H - 88, 184, 70);
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = Math.abs(p.car.speed) > 220 ? '#ff9d7d' : '#e4f2ec';
    ctx.fillText(String(Math.round(Math.abs(p.car.speed) * 0.42)), VIEW_W - 144, VIEW_H - 42);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,235,230,0.6)';
    ctx.fillText('MPH', VIEW_W - 90, VIEW_H - 44);
    ctx.fillText(p.car.speed < -2 ? 'REVERSE' : 'DRIVE', VIEW_W - 144, VIEW_H - 27);
  }

  // Contextual prompt.
  const prompt = contextPrompt(game);
  if (prompt) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    const w = ctx.measureText(prompt).width + 30;
    ctx.fillStyle = 'rgba(18,24,31,0.85)';
    ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 130, w, 28);
    ctx.strokeStyle = 'rgba(247,215,116,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(VIEW_W / 2 - w / 2, VIEW_H - 130, w, 28);
    ctx.fillStyle = '#f7d774';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, VIEW_W / 2, VIEW_H - 111);
  }

  // Bust meter.
  if (game.bust > 0.05) {
    ctx.fillStyle = 'rgba(20,25,32,0.8)';
    ctx.fillRect(VIEW_W / 2 - 100, VIEW_H - 158, 200, 22);
    ctx.fillStyle = '#f26b6b';
    ctx.fillRect(VIEW_W / 2 - 97, VIEW_H - 155, 194 * clamp(game.bust / 2.1, 0, 1), 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE APPROACHING', VIEW_W / 2, VIEW_H - 143);
  }

  // Reticle.
  if (game.input && game.mode === 'play') {
    const mx = game.input.mouse.x, my = game.input.mouse.y;
    ctx.strokeStyle = p.weapon === 'fists' ? 'rgba(255,255,255,0.5)' : 'rgba(255,236,180,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, 6.29);
    ctx.moveTo(mx - 14, my); ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 14, my);
    ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 14);
    ctx.stroke();
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(16,23,31,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(247,215,116,0.20)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, value, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
  ctx.fillStyle = color;
  if (value > 0) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(5, w * clamp(value, 0, 1)), h, 5); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + h + 11);
}

function contextPrompt(game) {
  const p = game.player;
  if (game.marker && dist(p.x, p.y, game.marker.x, game.marker.y) < 110 && !game.mission.active) return 'E  START JOB';
  if (!p.car) {
    let near = false;
    for (const c of game.cars) if (dist(c.x, c.y, p.x, p.y) < 64) near = true;
    if (near) return 'E  CARJACK';
    return 'WASD MOVE   SHIFT SPRINT   LMB FIRE   ESC PAUSE';
  }
  return 'E EXIT   SPACE HANDBRAKE   LMB DRIVE-BY';
}

function drawMinimap(game, ctx) {
  const x = VIEW_W - 218, y = 16, w = 200, h = 174;
  ctx.save();
  ctx.fillStyle = 'rgba(13,20,28,0.86)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(247,215,116,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x + 5, y + 20, w - 10, h - 26, 6); ctx.clip();
  const mx = x + 5, my = y + 20, mw = w - 10, mh = h - 26;
  const sx = mw / WORLD_W, sy = mh / 3620;
  const P = (wx, wy) => [mx + wx * sx, my + wy * sy];

  ctx.fillStyle = '#7d8a80';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#dcbf8c';
  ctx.fillRect(mx, my + BEACH_Y * sy, mw, (WATER_Y - BEACH_Y) * sy);
  ctx.fillStyle = '#246c7a';
  ctx.fillRect(mx, my + WATER_Y * sy, mw, mh - (WATER_Y - BEACH_Y) * sy);
  ctx.fillStyle = '#9f9d90';
  for (const b of game.city.buildings) {
    const [bx, by] = P(b.x, b.y);
    ctx.fillRect(bx, by, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  ctx.fillStyle = '#40474d';
  for (const rx of ROAD_X) { const [px] = P(rx, 0); ctx.fillRect(px - ROAD_W * sx / 2, my, 2.4, WATER_Y * sy); }
  for (const ry of ROAD_Y) { const [, py] = P(0, ry); ctx.fillRect(mx, py - 1.2, mw, 2.4); }
  // Piers.
  ctx.fillStyle = '#b08458';
  for (const pier of game.city.piers) {
    const [px, py] = P(pier.x, pier.y);
    ctx.fillRect(px, py, Math.max(2, pier.w * sx), Math.max(2, pier.h * sy));
  }
  // Police.
  for (const c of game.cars) {
    if (c.ai !== 'police') continue;
    const [px, py] = P(c.x, c.y);
    ctx.fillStyle = Math.floor(game.time * 6) % 2 ? '#ff5a63' : '#5c9cff';
    ctx.beginPath(); ctx.arc(px, py, 3.4, 0, 6.29); ctx.fill();
  }
  // Mission marker.
  if (game.marker) {
    const [px, py] = P(game.marker.x, game.marker.y);
    ctx.fillStyle = game.marker.color;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  }
  // Player arrow.
  const [px, py] = P(game.player.x, game.player.y);
  const a = game.player.car ? game.player.car.a : game.player.aim;
  ctx.save();
  ctx.translate(px, py); ctx.rotate(a);
  ctx.fillStyle = '#fff6d2';
  ctx.strokeStyle = '#28313a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();

  ctx.fillStyle = 'rgba(247,215,116,0.85)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VICE HARBOR  //  LIVE MAP', x + 10, y + 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(220,230,225,0.55)';
  ctx.fillText(game.stars > 0 ? `${game.stars}★` : 'CLEAR', x + w - 10, y + 14);
  ctx.restore();
}
