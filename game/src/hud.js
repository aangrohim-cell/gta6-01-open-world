// The interface over the world: health and armour, the five wanted stars, money, the minimap,
// the mission objective and timer, weapon and ammo, speed, subtitles, prompts and the centre
// banner. Everything is drawn in the game's 1280x720 space, with a warm noir palette.

import { CITY, FONT, FONT_MONO, PALETTE, VIEW, WEAPONS } from './config.js';
import { clamp } from './random.js';
import { pulse } from './vfx.js';

const GOLD = '#ffcf5c';
const CREAM = '#f6f1e6';
const MUTED = '#b9b0a1';

function panel(ctx, x, y, w, h, radius = 10, alpha = 0.74) {
  ctx.fillStyle = `rgba(15, 13, 22, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 236, 205, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function starPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function money(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------------------------------------------------------------- minimap */

function drawMinimap(ctx, world, x, y, size, time) {
  const radius = 16;
  const range = 820;
  const scale = size / (range * 2);
  const player = world.player;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.fillStyle = '#17242b';
  ctx.fill();
  ctx.clip();

  const mapX = (wx) => (wx - player.x) * scale + x + size / 2;
  const mapY = (wy) => (wy - player.y) * scale + y + size / 2;

  // Beach and sea.
  const waterY = world.city.waterY;
  const sandTop = world.city.beach.y;
  const sandY = mapY(sandTop);
  if (sandY < y + size) {
    ctx.fillStyle = '#cbb27f';
    ctx.fillRect(x, Math.max(y, sandY), size, y + size - Math.max(y, sandY));
    const seaY = mapY(waterY);
    if (seaY < y + size) {
      ctx.fillStyle = '#2d6d88';
      ctx.fillRect(x, Math.max(y, seaY), size, y + size - Math.max(y, seaY));
    }
  }

  // Blocks and their buildings, culled to the map circle.
  for (const block of world.city.blocks) {
    const bx = mapX(block.x);
    const by = mapY(block.y);
    if (bx > x + size || bx + block.w * scale < x || by > y + size || by + block.h * scale < y) continue;
    ctx.fillStyle = block.type === 'park' ? '#3d5a3f' : block.type === 'lot' ? '#3b3f4a' : '#2a3440';
    ctx.fillRect(bx, by, block.w * scale, block.h * scale);
    for (const building of block.buildings) {
      ctx.fillStyle = '#465364';
      ctx.fillRect(mapX(building.x), mapY(building.y), Math.max(1, building.w * scale), Math.max(1, building.h * scale));
    }
  }
  // The pier.
  ctx.fillStyle = '#8a6b47';
  ctx.fillRect(mapX(world.city.pier.x), mapY(world.city.pier.y), world.city.pier.w * scale, world.city.pier.h * scale);

  // Service blips.
  for (const service of world.city.services) {
    const sx = mapX(service.x);
    const sy = mapY(service.y);
    if (sx < x || sx > x + size || sy < y || sy > y + size) continue;
    ctx.fillStyle = service.color;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 18, 26, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Police and mission markers.
  for (const car of world.cars.list) {
    if (car.kind !== 'cop') continue;
    const sx = mapX(car.x);
    const sy = mapY(car.y);
    if (sx < x || sx > x + size || sy < y || sy > y + size) continue;
    ctx.fillStyle = pulse(time, 10) > 0.5 ? '#ff5a5a' : '#6f9dff';
    ctx.beginPath();
    ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const marker of world.state.markers) {
    const sx = mapX(marker.x);
    const sy = mapY(marker.y);
    if (sx < x || sx > x + size || sy < y || sy > y + size) continue;
    const color = marker.kind === 'kill' ? '#ff6b5a' : marker.kind === 'vehicle' ? '#7fe6c8' : GOLD;
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.strokeStyle = 'rgba(20, 18, 26, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 4, sy - 4, 8, 8);
  }
  // A ripple of the player's own position, and an arrow for the way the player faces.
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.strokeStyle = 'rgba(255, 244, 220, 0.18)';
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + pulse(time, 2.6) * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath();
  ctx.moveTo(0, -8.5);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3.2);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 26, 38, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // Frame.
  ctx.strokeStyle = 'rgba(255, 225, 180, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(10, 8, 16, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, size - 6, size - 6, radius - 4);
  ctx.stroke();
  ctx.fillStyle = 'rgba(15, 13, 22, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 8, 22, 18, 4);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', x + 19, y + 18);
  // Small edge letters make the fixed-north map readable at a glance.
  ctx.fillStyle = 'rgba(246, 241, 230, 0.5)';
  ctx.font = `700 8px ${FONT}`;
  ctx.fillText('S', x + size - 12, y + size / 2);
  ctx.fillText('W', x + size / 2, y + size - 12);
  ctx.fillText('E', x + size / 2, y + 12);
}

/* ---------------------------------------------------------------- dialogs and prompts */

function drawDialog(ctx, world, time) {
  const dialog = world.state.dialog;
  if (!dialog) return;
  const line = dialog.lines[dialog.index];
  if (!line) return;
  const boxW = 700;
  const boxX = (VIEW.width - boxW) / 2;
  const boxY = 542;
  const boxH = 116;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 10, 18, 0.86)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 207, 92, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 207, 92, 0.9)';
  ctx.fillRect(boxX + 1, boxY + 14, 3, boxH - 28);
  ctx.fillStyle = GOLD;
  ctx.font = `800 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(line.who, boxX + 26, boxY + 18);
  ctx.fillStyle = CREAM;
  ctx.font = `400 16px ${FONT}`;
  const text = line.text.slice(0, Math.floor(dialog.revealed));
  const lines = wrapText(ctx, text, boxW - 56);
  lines.forEach((textLine, index) => {
    ctx.fillText(textLine, boxX + 26, boxY + 42 + index * 22);
  });
  ctx.fillStyle = 'rgba(246, 241, 230, 0.55)';
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('E  /  SPACE  ›', boxX + boxW - 24, boxY + boxH - 22);
  // A small progress bar for the auto-advance.
  const progress = clamp(dialog.timer / (5.5 + line.text.length * 0.022), 0, 1);
  ctx.fillStyle = 'rgba(255, 207, 92, 0.25)';
  ctx.fillRect(boxX + 26, boxY + boxH - 10, boxW - 52, 2);
  ctx.fillStyle = 'rgba(255, 207, 92, 0.7)';
  ctx.fillRect(boxX + 26, boxY + boxH - 10, (boxW - 52) * progress, 2);
  ctx.restore();
}

function drawPrompt(ctx, world) {
  const prompt = world.state.prompt;
  const missionPrompt = world.state.missionPrompt;
  if (world.state.dialog) return;
  if (!prompt && !missionPrompt) return;
  const text = missionPrompt || prompt;
  ctx.save();
  ctx.font = `700 13px ${FONT}`;
  const width = ctx.measureText(text).width + 34;
  const x = (VIEW.width - width) / 2;
  const y = missionPrompt ? 664 : 662;
  ctx.fillStyle = 'rgba(12, 10, 18, 0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, 32, 7);
  ctx.fill();
  ctx.strokeStyle = missionPrompt ? 'rgba(255, 207, 92, 0.6)' : 'rgba(255, 240, 214, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = missionPrompt ? GOLD : CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!missionPrompt) {
    const keyWidth = 20;
    ctx.fillStyle = 'rgba(255, 240, 214, 0.9)';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 7, keyWidth, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#1b1822';
    ctx.font = `800 11px ${FONT}`;
    ctx.fillText('E', x + 8 + keyWidth / 2, y + 16.5);
    ctx.fillStyle = CREAM;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 34, y + 16.5);
  } else {
    ctx.fillText(text, VIEW.width / 2, y + 16.5);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- top-level HUD */

export function drawHUD(ctx, world, camera, options = {}) {
  const { mouse, time = 0, missionSystem } = options;
  const player = world.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Low-health red bloom.
  if (player.health < 40) {
    const bloom = 0.12 + 0.06 * pulse(time, 5);
    const gradient = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 250, VIEW.width / 2, VIEW.height / 2, 720);
    gradient.addColorStop(0, 'rgba(120, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(120, 10, 14, ${bloom + (40 - player.health) * 0.002})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  /* health and armour */
  panel(ctx, 22, 20, 286, 78, 10, 0.7);
  ctx.fillStyle = MUTED;
  ctx.font = `700 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('VITALS', 38, 38);
  const barX = 38;
  const barW = 200;
  const health = clamp(player.health / 100, 0, 1);
  const armor = clamp(player.armor / 100, 0, 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.roundRect(barX, 46, barW, 10, 5);
  ctx.fill();
  const healthGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  healthGradient.addColorStop(0, '#ff6a5a');
  healthGradient.addColorStop(0.55, '#f5b95c');
  healthGradient.addColorStop(1, '#9fe870');
  ctx.fillStyle = healthGradient;
  ctx.beginPath();
  ctx.roundRect(barX, 46, Math.max(2, barW * health), 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(barX + 2, 47, Math.max(0, barW * health - 4), 2);
  ctx.fillStyle = CREAM;
  ctx.font = `800 11px ${FONT_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.ceil(player.health)), barX + barW + 26, 55);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `700 9px ${FONT}`;
  ctx.fillText('ARMOR', barX, 72);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.roundRect(barX + 48, 64, barW - 48, 6, 3);
  ctx.fill();
  if (armor > 0) {
    ctx.fillStyle = '#7fa8ff';
    ctx.beginPath();
    ctx.roundRect(barX + 48, 64, Math.max(1, (barW - 48) * armor), 6, 3);
    ctx.fill();
  }
  // A little silhouette portrait.
  ctx.save();
  ctx.translate(274, 56);
  ctx.fillStyle = 'rgba(255, 240, 210, 0.1)';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9b089';
  ctx.beginPath();
  ctx.arc(0, -4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c3a4f';
  ctx.beginPath();
  ctx.arc(0, 12, 11, Math.PI, 0);
  ctx.fill();
  ctx.restore();

  /* wanted stars and money */
  const heat = clamp(world.state.heat, 0, 5);
  const flash = world.state.wantedFlash > 0 ? 1 + Math.sin(time * 18) * 0.06 : 1;
  ctx.save();
  ctx.translate(1258, 38);
  ctx.scale(flash, flash);
  for (let index = 0; index < 5; index += 1) {
    const cx = -index * 32;
    const fill = clamp(heat - index, 0, 1);
    ctx.fillStyle = 'rgba(30, 26, 36, 0.72)';
    starPath(ctx, cx, 0, 13, 5.6);
    ctx.fill();
    ctx.strokeStyle = fill > 0 ? 'rgba(255, 207, 92, 0.9)' : 'rgba(255, 240, 214, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (fill > 0) {
      ctx.save();
      starPath(ctx, cx, 0, 12.2, 5.2);
      ctx.clip();
      ctx.fillStyle = '#ffcf5c';
      ctx.fillRect(cx - 13, -13, 26 * fill, 26);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(cx - 13, -13, 26 * fill, 3);
      ctx.restore();
      starPath(ctx, cx, 0, 13, 5.6);
      ctx.strokeStyle = 'rgba(120, 76, 20, 0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.restore();
  if (heat > 0) {
    const close = world.nearestOfficer < 620;
    ctx.textAlign = 'right';
    ctx.fillStyle = close ? '#ff7a6a' : MUTED;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText(close ? 'POLICE ON YOU' : 'POLICE SEARCHING', 1258, 16);
  }
  ctx.textAlign = 'right';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = '#9fe870';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(money(player.money), 1258, 84);
  ctx.shadowBlur = 0;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(missionSystem?.storyComplete ? 'STORY COMPLETE' : `JOBS DONE ${missionSystem?.progress ?? 0} / 6`, 1258, 101);

  /* minimap */
  drawMinimap(ctx, world, 22, VIEW.height - 238, 216, time);

  // A small address chip turns raw coordinates into a readable neighbourhood name.
  const location = world.city.locationAt?.(player.x, player.y) ?? 'Vice City';
  ctx.save();
  ctx.font = `700 11px ${FONT}`;
  const locationWidth = Math.min(216, ctx.measureText(location).width + 24);
  const locationY = VIEW.height - 260;
  ctx.fillStyle = 'rgba(15, 13, 22, 0.72)';
  ctx.beginPath();
  ctx.roundRect(22, locationY, locationWidth, 20, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 236, 205, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fillRect(22, locationY, 3, 20);
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(location, 32, locationY + 10);
  ctx.restore();

  /* objective */
  const objective = world.state.objective;
  if (objective) {
    const width = 560;
    const x = (VIEW.width - width) / 2;
    panel(ctx, x, 18, width, objective.timer > 0 ? 82 : 66, 10, 0.72);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x, 30, 3, objective.timer > 0 ? 58 : 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD;
    ctx.font = `800 10px ${FONT}`;
    ctx.fillText(`MISSION ${(missionSystem?.progress ?? 0) + 1} / 6  —  ${objective.title}`, x + 18, 38);
    ctx.fillStyle = CREAM;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(objective.text, x + 18, 60);
    if (objective.timer > 0) {
      const ratio = clamp(objective.timer / Math.max(1, objective.total), 0, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.roundRect(x + 18, 72, width - 36, 5, 3);
      ctx.fill();
      ctx.fillStyle = ratio < 0.25 ? '#ff6b5a' : '#ffcf5c';
      ctx.beginPath();
      ctx.roundRect(x + 18, 72, (width - 36) * ratio, 5, 3);
      ctx.fill();
      const seconds = Math.max(0, Math.ceil(objective.timer));
      ctx.fillStyle = ratio < 0.25 ? '#ff8a7a' : MUTED;
      ctx.font = `700 10px ${FONT_MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, x + width - 18, 48);
    }
  }

  /* toasts */
  ctx.textAlign = 'center';
  world.state.toasts.forEach((toast, index) => {
    const alpha = clamp(toast.life / Math.min(0.5, toast.max), 0, 1);
    ctx.globalAlpha = alpha;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = 'rgba(12, 10, 18, 0.65)';
    const width = ctx.measureText(toast.text).width + 26;
    const y = 118 + index * 27;
    ctx.beginPath();
    ctx.roundRect((VIEW.width - width) / 2, y - 16, width, 23, 5);
    ctx.fill();
    ctx.fillStyle = toast.color;
    ctx.fillText(toast.text, VIEW.width / 2, y);
  });
  ctx.globalAlpha = 1;

  /* weapon and speed */
  const weapon = WEAPONS[player.weapon];
  panel(ctx, VIEW.width - 262, VIEW.height - 132, 240, 110, 10, 0.72);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `700 9px ${FONT}`;
  ctx.fillText('WEAPON', VIEW.width - 246, VIEW.height - 110);
  ctx.fillStyle = CREAM;
  ctx.font = `800 20px ${FONT}`;
  ctx.fillText(weapon.name, VIEW.width - 246, VIEW.height - 85);
  if (!weapon.melee) {
    const mag = player.mag[player.weapon];
    const reserve = player.reserve[player.weapon];
    ctx.textAlign = 'right';
    ctx.font = `800 24px ${FONT_MONO}`;
    ctx.fillStyle = mag === 0 ? '#ff6b5a' : CREAM;
    ctx.fillText(String(mag), VIEW.width - 76, VIEW.height - 84);
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(`/ ${reserve}`, VIEW.width - 40, VIEW.height - 84);
  }
  // Weapon slots.
  const slots = [['1', 'FISTS'], ['2', 'PISTOL'], ['3', 'SMG']];
  slots.forEach((slot, index) => {
    const active = (index === 0 && player.weapon === 'fists') || (index === 1 && player.weapon === 'pistol') || (index === 2 && player.weapon === 'smg');
    const x = VIEW.width - 246 + index * 74;
    ctx.fillStyle = active ? 'rgba(255, 207, 92, 0.16)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, VIEW.height - 64, 66, 30, 5);
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255, 207, 92, 0.7)' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = active ? GOLD : MUTED;
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(slot[0], x + 7, VIEW.height - 46);
    ctx.fillStyle = active ? CREAM : MUTED;
    ctx.font = `600 9px ${FONT}`;
    ctx.fillText(slot[1], x + 18, VIEW.height - 46);
  });
  if (player.inCar) {
    const carName = (player.inCar.color?.name ?? player.inCar.model ?? 'car').toUpperCase();
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD;
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText(carName, VIEW.width - 246, VIEW.height - 163);
    const speed = Math.round(Math.hypot(player.inCar.vx, player.inCar.vy) * 0.18);
    const speedRatio = clamp(speed / 140, 0, 1);
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('SPEED', VIEW.width - 246, VIEW.height - 146);
    ctx.fillStyle = GOLD;
    ctx.font = `800 18px ${FONT_MONO}`;
    ctx.fillText(String(speed), VIEW.width - 208, VIEW.height - 145);
    ctx.fillStyle = MUTED;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('MPH', VIEW.width - 190, VIEW.height - 146);
    // A segmented speed strip gives a sense of acceleration without cluttering the panel.
    for (let index = 0; index < 10; index += 1) {
      const lit = index / 10 < speedRatio;
      ctx.fillStyle = lit ? (index > 7 ? '#ff6b5a' : GOLD) : 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(VIEW.width - 246 + index * 16, VIEW.height - 138, 12, 3);
    }
  }

  /* radio and car name */
  if (world.state.radioTimer > 0) {
    const alpha = clamp(world.state.radioTimer / 1.2, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(world.state.radio.toUpperCase(), VIEW.width - 24, VIEW.height - 150);
    ctx.globalAlpha = 1;
  }

  /* hint and banner */
  if (world.state.hint) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff7a6a';
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(world.state.hint, VIEW.width / 2, 112);
  }

  if (world.state.banner) {
    const banner = world.state.banner;
    const alpha = clamp(banner.life / 0.6, 0, 1);
    ctx.globalAlpha = alpha;
    const y = 250;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(12, 10, 18, 0.6)';
    ctx.fillRect(0, y - 56, VIEW.width, 116);
    ctx.strokeStyle = 'rgba(255, 207, 92, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y - 56);
    ctx.lineTo(VIEW.width, y - 56);
    ctx.moveTo(0, y + 60);
    ctx.lineTo(VIEW.width, y + 60);
    ctx.stroke();
    ctx.fillStyle = banner.color;
    ctx.font = `900 42px ${FONT}`;
    ctx.fillText(banner.title, VIEW.width / 2, y + 2);
    ctx.fillStyle = CREAM;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(banner.subtitle, VIEW.width / 2, y + 30);
    ctx.globalAlpha = 1;
  }

  drawDialog(ctx, world, time);
  drawPrompt(ctx, world);

  /* crosshair */
  if (mouse && !world.state.dialog) {
    const { x, y } = mouse;
    const spread = player.inCar ? 15 : 11;
    ctx.strokeStyle = 'rgba(255, 245, 225, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const direction of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(x + direction[0] * spread, y + direction[1] * spread);
      ctx.lineTo(x + direction[0] * (spread + 7), y + direction[1] * (spread + 7));
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 245, 225, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 1.7, 0, Math.PI * 2);
    ctx.fill();
    if (player.reloadTimer > 0) {
      const weaponReload = WEAPONS[player.weapon];
      const progress = 1 - player.reloadTimer / weaponReload.reload;
      ctx.strokeStyle = 'rgba(255, 207, 92, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export { drawMinimap };
