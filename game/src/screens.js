// The screens around the game: the sunset title card with its save-aware menu, the pause sheet,
// and the WASTED and BUSTED overlays. These are the game's own painted art, no images loaded.

import { FONT, FONT_MONO, VIEW } from './config.js';

export const TITLE_MENU = {
  continue: { x: 86, y: 452, w: 372, h: 56 },
  newGame: { x: 86, y: 516, w: 372, h: 56 },
};

const GOLD = '#ffcf5c';
const CREAM = '#f6f1e6';
const MUTED = '#bfae9a';

function spaced(ctx, text, x, y, spacing) {
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + spacing;
  }
  return cursor;
}

function palm(ctx, x, y, height, lean, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Curved trunk.
  ctx.lineWidth = 13 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * 0.3, -height * 0.5, lean, -height);
  ctx.stroke();
  ctx.lineWidth = 8 * scale;
  ctx.strokeStyle = 'rgba(255, 170, 130, 0.18)';
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.quadraticCurveTo(lean * 0.3 + 5, -height * 0.5, lean + 3, -height);
  ctx.stroke();
  // Fronds.
  const tipX = lean;
  const tipY = -height;
  for (let index = 0; index < 9; index += 1) {
    const angle = -Math.PI + (index / 8) * Math.PI + Math.sin(index * 2.7) * 0.15;
    const length = (90 + (index % 3) * 26) * scale;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length * 0.55;
    ctx.strokeStyle = index % 2 ? color : 'rgba(20, 12, 30, 0.9)';
    ctx.lineWidth = 7 * scale;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(tipX + dx * 0.55, tipY + dy * 0.25, tipX + dx, tipY + dy + 10 * scale);
    ctx.stroke();
    // Leaflets.
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = color;
    for (let leaf = 0.25; leaf < 0.95; leaf += 0.18) {
      const lx = tipX + dx * leaf;
      const ly = tipY + dy * leaf + (leaf * leaf) * 30 * scale;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(angle + 1.2) * 16 * scale, ly + Math.sin(angle + 1.2) * 8 * scale);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function skyline(ctx, baseY, time) {
  const layers = [
    { color: 'rgba(58, 32, 62, 0.85)', offset: 0, height: 58, step: 46 },
    { color: 'rgba(37, 23, 47, 0.95)', offset: 26, height: 92, step: 62 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    for (let index = 0; index < 30; index += 1) {
      const x = -40 + index * layer.step + layer.offset;
      const noise = Math.sin(index * 12.9898 + layer.height) * 43758.5453;
      const fraction = noise - Math.floor(noise);
      const height = 22 + fraction * layer.height;
      ctx.fillRect(x, baseY - height, layer.step - 5, height + 20);
      // Rooftop antenna.
      if (fraction > 0.78) {
        ctx.fillRect(x + 14, baseY - height - 16, 2, 16);
        ctx.fillStyle = Math.sin(time * 2 + index) > 0.4 ? '#ff6a5a' : 'rgba(255, 106, 90, 0.2)';
        ctx.fillRect(x + 12.5, baseY - height - 18, 5, 3);
        ctx.fillStyle = layer.color;
      }
      // Lit windows.
      ctx.fillStyle = 'rgba(255, 196, 108, 0.5)';
      for (let wy = baseY - height + 8; wy < baseY + 4; wy += 9) {
        for (let wx = x + 6; wx < x + layer.step - 14; wx += 11) {
          if ((Math.floor(wx) + Math.floor(wy) + index) % 3 === 0) ctx.fillRect(wx, wy, 3, 3);
        }
      }
      ctx.fillStyle = layer.color;
    }
  }
}

function cloud(ctx, x, y, scale, alpha) {
  ctx.fillStyle = `rgba(255, 170, 160, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 120 * scale, 16 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 60 * scale, y - 10 * scale, 70 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 70 * scale, y - 5 * scale, 56 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMenuOption(ctx, rect, key, title, subtitle, selected, disabled) {
  ctx.save();
  if (selected && !disabled) {
    ctx.fillStyle = 'rgba(255, 207, 92, 0.12)';
    ctx.beginPath();
    ctx.roundRect(rect.x - 8, rect.y - 6, rect.w + 16, rect.h + 12, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 207, 92, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(rect.x - 24, rect.y + rect.h / 2 - 8);
    ctx.lineTo(rect.x - 8, rect.y + rect.h / 2);
    ctx.lineTo(rect.x - 24, rect.y + rect.h / 2 + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = disabled ? 'rgba(40, 36, 46, 0.8)' : 'rgba(18, 15, 26, 0.8)';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fill();
  ctx.strokeStyle = disabled ? 'rgba(120, 110, 100, 0.18)' : 'rgba(255, 240, 214, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Key cap.
  ctx.fillStyle = disabled ? 'rgba(90, 84, 80, 0.5)' : 'rgba(255, 240, 214, 0.9)';
  ctx.beginPath();
  ctx.roundRect(rect.x + 12, rect.y + 14, 30, 28, 4);
  ctx.fill();
  ctx.fillStyle = disabled ? '#5f5a56' : '#1b1822';
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(key, rect.x + 27, rect.y + 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = disabled ? 'rgba(150, 142, 132, 0.5)' : CREAM;
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText(title, rect.x + 58, rect.y + 25);
  ctx.fillStyle = disabled ? 'rgba(120, 112, 104, 0.5)' : 'rgba(246, 241, 230, 0.62)';
  ctx.font = `500 11px ${FONT}`;
  ctx.fillText(subtitle, rect.x + 58, rect.y + 43);
  ctx.restore();
}

export function drawTitle(ctx, options) {
  const { time = 0, save, hover = null, selected = 0 } = options;
  const horizon = 452;
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 70);
  sky.addColorStop(0, '#170e2c');
  sky.addColorStop(0.28, '#40204f');
  sky.addColorStop(0.58, '#93394f');
  sky.addColorStop(0.82, '#e06846');
  sky.addColorStop(1, '#ffb46a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, horizon + 70);
  // Sun and its bands.
  const sunX = 858;
  const sunY = 352;
  const sun = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 112);
  sun.addColorStop(0, '#fff6cc');
  sun.addColorStop(0.55, '#ffd27a');
  sun.addColorStop(1, 'rgba(255, 120, 70, 0.05)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 214, 150, 0.95)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(205, 90, 76, 0.28)';
  for (let band = 0; band < 6; band += 1) {
    const y = sunY + 8 + band * 13;
    ctx.fillRect(sunX - 82, y, 164, 3 + (band % 2) * 2);
  }
  // Clouds drifting.
  for (let index = 0; index < 6; index += 1) {
    const speed = 5 + index * 2.2;
    const x = ((time * speed + index * 240) % (VIEW.width + 320)) - 160;
    cloud(ctx, x, 130 + index * 42, 0.6 + index * 0.13, 0.1 + (index % 3) * 0.03);
  }
  // Ocean.
  const ocean = ctx.createLinearGradient(0, horizon, 0, VIEW.height);
  ocean.addColorStop(0, '#c9605c');
  ocean.addColorStop(0.12, '#7d3c55');
  ocean.addColorStop(0.5, '#342a49');
  ocean.addColorStop(1, '#121a2c');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, horizon, VIEW.width, VIEW.height - horizon);
  // Sun path on the water.
  for (let index = 0; index < 34; index += 1) {
    const y = horizon + 8 + index * 8;
    const width = 130 - index * 2.6 + Math.sin(index * 1.6 + time) * 14;
    if (width <= 0) continue;
    ctx.fillStyle = `rgba(255, 200, 120, ${0.42 - index * 0.008})`;
    ctx.fillRect(sunX - width / 2 + Math.sin(index + time) * 8, y, width, 2 + (index % 3));
  }
  // A distant helicopter crossing the sun.
  const heliX = ((time * 34) % (VIEW.width + 200)) - 100;
  const heliY = 206 + Math.sin(time * 0.8) * 8;
  ctx.fillStyle = 'rgba(22, 14, 26, 0.85)';
  ctx.fillRect(heliX - 14, heliY, 28, 6);
  ctx.fillRect(heliX + 12, heliY + 1, 14, 2);
  ctx.fillRect(heliX - 2, heliY - 9, 2, 9);
  ctx.beginPath();
  ctx.arc(heliX, heliY - 9, 12, 0, Math.PI * 2);
  ctx.globalAlpha = 0.2;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = Math.sin(time * 9) > 0 ? '#ff5a4a' : 'rgba(255, 90, 74, 0.2)';
  ctx.fillRect(heliX + 18, heliY - 2, 3, 3);

  // Skyline.
  skyline(ctx, horizon + 8, time);
  // Water reflection of the skyline.
  ctx.fillStyle = 'rgba(20, 16, 30, 0.2)';
  ctx.fillRect(0, horizon + 10, VIEW.width, 70);

  // Foreground palms.
  palm(ctx, 120, 748, 340, 60, 1.15, 'rgba(22, 13, 30, 0.95)');
  palm(ctx, 58, 748, 250, 100, 0.8, 'rgba(22, 13, 30, 0.9)');
  palm(ctx, 1190, 748, 300, -70, 1.05, 'rgba(20, 12, 28, 0.96)');

  // Title.
  ctx.save();
  ctx.translate(76, 0);
  ctx.transform(1, 0, -0.16, 1, 0, 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const titleGradient = ctx.createLinearGradient(0, 96, 0, 286);
  titleGradient.addColorStop(0, '#fff4d6');
  titleGradient.addColorStop(0.45, '#ffcf5c');
  titleGradient.addColorStop(1, '#ff6a4d');
  ctx.font = '900 182px Impact, "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(20, 10, 26, 0.55)';
  ctx.fillText('VICE', 8, 276);
  ctx.fillStyle = titleGradient;
  ctx.fillText('VICE', 0, 268);
  ctx.strokeStyle = 'rgba(40, 18, 30, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeText('VICE', 0, 268);
  ctx.font = '900 138px Impact, "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(20, 10, 26, 0.55)';
  ctx.fillText('HARBOR', 6, 390);
  ctx.fillStyle = '#f6e9d2';
  ctx.fillText('HARBOR', 0, 382);
  ctx.strokeStyle = 'rgba(40, 18, 30, 0.7)';
  ctx.strokeText('HARBOR', 0, 382);
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 207, 92, 0.9)';
  ctx.fillRect(86, 404, 56, 2);
  ctx.fillStyle = '#f6e9d2';
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'left';
  spaced(ctx, 'A SUNSET CITY CRIME STORY', 154, 409, 3.2);

  // Menu.
  const canContinue = Boolean(save);
  const continueSelected = selected === 0;
  drawMenuOption(ctx, TITLE_MENU.continue, '↵', 'CONTINUE', canContinue
    ? `Job ${Math.min(save.progress + 1, 6)} of 6  ·  $${Math.round(save.money).toLocaleString('en-US')}  ·  ${save.tapes ?? 0}/8 mixtapes`
    : 'No save in this browser yet', continueSelected || hover === 'continue', !canContinue);
  drawMenuOption(ctx, TITLE_MENU.newGame, '↵', 'NEW GAME', 'Start from Dex\'s garage with $750 and a pistol', selected === 1 || hover === 'newGame', false);

  // Controls card.
  const cardX = 790;
  const cardY = 470;
  const cardW = 410;
  const cardH = 212;
  ctx.fillStyle = 'rgba(13, 11, 20, 0.72)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 236, 205, 0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = `800 10px ${FONT}`;
  ctx.fillText('FIELD MANUAL', cardX + 22, cardY + 28);
  const manual = [
    ['WASD', 'walk / drive'],
    ['MOUSE', 'aim · click to shoot'],
    ['E', 'steal a car · interact'],
    ['SHIFT / SPACE', 'sprint / handbrake'],
    ['1 2 3 · R', 'weapons · reload'],
    ['P · M', 'pause · mute'],
  ];
  manual.forEach((row, index) => {
    const y = cardY + 56 + index * 24;
    ctx.fillStyle = 'rgba(255, 238, 208, 0.86)';
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.fillText(row[0], cardX + 22, y);
    ctx.fillStyle = MUTED;
    ctx.font = `500 11px ${FONT}`;
    ctx.fillText(row[1], cardX + 132, y);
  });
  ctx.fillStyle = 'rgba(246, 241, 230, 0.35)';
  ctx.font = `500 9px ${FONT}`;
  ctx.fillText('VICE HARBOR  ·  an open-world crime game  ·  built for make.fun', cardX, cardY + cardH + 24);

  // A soft vignette over the whole card.
  const vignette = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 260, VIEW.width / 2, VIEW.height / 2, 820);
  vignette.addColorStop(0, 'rgba(8, 5, 14, 0)');
  vignette.addColorStop(1, 'rgba(8, 5, 14, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // A fine scanline texture.
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#000';
  for (let y = 0; y < VIEW.height; y += 3) ctx.fillRect(0, y, VIEW.width, 1);
  ctx.globalAlpha = 1;
}

export function drawPause(ctx, world, missionSystem, saveInfo) {
  ctx.fillStyle = 'rgba(10, 8, 16, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = `800 11px ${FONT}`;
  ctx.fillText('VICE HARBOR', 80, 92);
  ctx.fillStyle = CREAM;
  ctx.font = '900 82px Impact, "Arial Black", sans-serif';
  ctx.fillText('PAUSED', 76, 172);
  ctx.fillStyle = 'rgba(246, 241, 230, 0.6)';
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('The city can wait. The cops cannot.', 80, 198);

  // Left block: the save and the job.
  const boxX = 80;
  const boxY = 234;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, 520, 300, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 236, 205, 0.13)';
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = `800 10px ${FONT}`;
  ctx.fillText('THE JOB', boxX + 24, boxY + 30);
  ctx.fillStyle = CREAM;
  ctx.font = `800 24px ${FONT}`;
  const jobLine = missionSystem?.storyComplete
    ? 'Story complete — free roam'
    : missionSystem?.active
      ? `${missionSystem.MISSIONS[missionSystem.missionIndex]?.title ?? 'Job'} — in progress`
      : `${missionSystem?.progress ?? 0} of 6 jobs done`;
  ctx.fillText(jobLine, boxX + 24, boxY + 62);
  ctx.fillStyle = MUTED;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(missionSystem?.active ? 'Progress is saved when the job is finished.' : 'Progress saved at the garage, and every 20 seconds.', boxX + 24, boxY + 86);

  const stats = [
    ['BANK', `$${Math.round(world.player.money).toLocaleString('en-US')}`],
    ['MIXTAPES', `${world.state.tapes} / 8`],
    ['JOBS DONE', `${missionSystem?.progress ?? 0} / 6`],
    ['PEOPLE DOWN', String(world.state.kills)],
    ['MILES DRIVEN', (world.state.distanceDriven / 400).toFixed(1)],
  ];
  stats.forEach((row, index) => {
    const y = boxY + 128 + index * 31;
    ctx.fillStyle = 'rgba(246, 241, 230, 0.42)';
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText(row[0], boxX + 24, y);
    ctx.fillStyle = index === 0 ? '#9fe870' : CREAM;
    ctx.font = `700 16px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(row[1], boxX + 496, y);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.moveTo(boxX + 24, y + 9);
    ctx.lineTo(boxX + 496, y + 9);
    ctx.stroke();
  });

  // Right block: controls.
  const rx = 650;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.beginPath();
  ctx.roundRect(rx, boxY, 550, 300, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 236, 205, 0.13)';
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = `800 10px ${FONT}`;
  ctx.fillText('CONTROLS', rx + 24, boxY + 30);
  const rows = [
    ['W A S D', 'walk, drive, steer'],
    ['MOUSE', 'aim · left click to fire'],
    ['E', 'get in / out of a car, buy, start a job'],
    ['SHIFT', 'sprint'],
    ['SPACE', 'handbrake in a car'],
    ['1 / 2 / 3', 'fists / pistol / SMG'],
    ['R', 'reload'],
    ['P / ESC', 'pause'],
    ['M', 'mute sound'],
  ];
  rows.forEach((row, index) => {
    const y = boxY + 58 + index * 25;
    ctx.fillStyle = 'rgba(255, 238, 208, 0.85)';
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.fillText(row[0], rx + 24, y);
    ctx.fillStyle = MUTED;
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText(row[1], rx + 140, y);
  });
  ctx.fillStyle = 'rgba(246, 241, 230, 0.55)';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('ENTER / ESC  resume        Q  quit to title        F5  save now', 80, 596);
  ctx.fillStyle = 'rgba(159, 232, 112, 0.85)';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(saveInfo ?? 'Saved to this browser.', 80, 626);
}

export function drawWasted(ctx, world) {
  const phase = 1 - Math.max(0, world.state.wasted) / 3.4;
  ctx.fillStyle = `rgba(40, 4, 8, ${0.45 + phase * 0.3})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const gradient = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 100, VIEW.width / 2, VIEW.height / 2, 700);
  gradient.addColorStop(0, 'rgba(120, 10, 18, 0)');
  gradient.addColorStop(1, 'rgba(90, 4, 10, 0.8)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(VIEW.width / 2, VIEW.height / 2 - 20);
  ctx.transform(1, 0, -0.08, 1, 0, 0);
  ctx.fillStyle = 'rgba(20, 4, 6, 0.7)';
  ctx.font = '900 136px Impact, "Arial Black", sans-serif';
  ctx.fillText('WASTED', 8, 12);
  ctx.fillStyle = '#d33a38';
  ctx.fillText('WASTED', 0, 0);
  ctx.strokeStyle = 'rgba(255, 190, 160, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeText('WASTED', 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(246, 241, 230, 0.86)';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('You wake up at Mercy General with a lighter wallet.', VIEW.width / 2, VIEW.height / 2 + 52);
  ctx.fillStyle = 'rgba(246, 241, 230, 0.5)';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('ENTER  to get up', VIEW.width / 2, VIEW.height / 2 + 84);
}

export function drawBusted(ctx, world) {
  const phase = 1 - Math.max(0, world.state.busted) / 3.2;
  ctx.fillStyle = `rgba(4, 10, 34, ${0.5 + phase * 0.25})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const gradient = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 100, VIEW.width / 2, VIEW.height / 2, 700);
  gradient.addColorStop(0, 'rgba(20, 40, 110, 0)');
  gradient.addColorStop(1, 'rgba(8, 18, 60, 0.8)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(VIEW.width / 2, VIEW.height / 2 - 20);
  ctx.transform(1, 0, -0.08, 1, 0, 0);
  ctx.fillStyle = 'rgba(4, 8, 26, 0.7)';
  ctx.font = '900 136px Impact, "Arial Black", sans-serif';
  ctx.fillText('BUSTED', 8, 12);
  ctx.fillStyle = '#5f8cff';
  ctx.fillText('BUSTED', 0, 0);
  ctx.strokeStyle = 'rgba(200, 220, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeText('BUSTED', 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(246, 241, 230, 0.86)';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('The cops took your guns and a chunk of your bank.', VIEW.width / 2, VIEW.height / 2 + 52);
  ctx.fillStyle = 'rgba(246, 241, 230, 0.5)';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('ENTER  to walk out', VIEW.width / 2, VIEW.height / 2 + 84);
}
