// Title, pause, story dialogue and end-state overlays, all drawn on the same canvas.
import { VIEW_W, VIEW_H } from './config.js';
import { clamp } from './random.js';
import { hasSave } from './save.js';

export function drawScreens(game, ctx) {
  if (game.mode === 'title') drawTitle(game, ctx);
  if (game.mode === 'pause') drawPause(game, ctx);
  if (game.dialogue && game.mode === 'play') drawDialogue(game, ctx);
  if (game.missionBanner && game.mode === 'play') drawMissionBanner(game, ctx);
  if (game.mode === 'wasted' || game.mode === 'busted') drawEnd(game, ctx);
  if (game.ending && game.mode === 'play' && !game.missionBanner) {
    ctx.fillStyle = 'rgba(20,25,32,0.78)';
    ctx.fillRect(VIEW_W / 2 - 210, 92, 420, 44);
    ctx.strokeStyle = '#f7d774';
    ctx.lineWidth = 2;
    ctx.strokeRect(VIEW_W / 2 - 210, 92, 420, 44);
    ctx.fillStyle = '#f7d774';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALL JOBS COMPLETE - FREE ROAM', VIEW_W / 2, 120);
  }
}

function drawTitle(game, ctx) {
  const t = game.time;
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  shade.addColorStop(0, 'rgba(12,17,32,0.70)');
  shade.addColorStop(0.5, 'rgba(20,18,38,0.55)');
  shade.addColorStop(1, 'rgba(8,14,24,0.86)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Sun disk and horizontal retro lines.
  ctx.save();
  ctx.globalAlpha = 0.5;
  const sun = ctx.createLinearGradient(0, 100, 0, 330);
  sun.addColorStop(0, '#ffd08a');
  sun.addColorStop(1, '#f06f8c');
  ctx.fillStyle = sun;
  ctx.beginPath(); ctx.arc(VIEW_W / 2, 255, 118, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(16,22,38,0.78)';
  for (let k = 0; k < 8; k++) ctx.fillRect(VIEW_W / 2 - 130, 255 + k * 15, 260, 4 + k * 1.6);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = 'bold 78px system-ui, sans-serif';
  const grad = ctx.createLinearGradient(VIEW_W / 2 - 260, 0, VIEW_W / 2 + 260, 0);
  grad.addColorStop(0, '#ffd38b');
  grad.addColorStop(0.5, '#fff0c8');
  grad.addColorStop(1, '#ff8fa3');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255,130,150,0.6)';
  ctx.shadowBlur = 24;
  ctx.fillText('VICE HARBOR', VIEW_W / 2, 216);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#8ee9df';
  ctx.letterSpacing = '7px';
  ctx.fillText('THE SUNSET CITY', VIEW_W / 2, 246);
  ctx.letterSpacing = '0px';

  const options = hasSave() ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
  const baseY = 395;
  for (let i = 0; i < options.length; i++) {
    const y = baseY + i * 54;
    const sel = game.titleSel === i;
    const w = 300;
    ctx.fillStyle = sel ? 'rgba(247,215,116,0.20)' : 'rgba(18,25,34,0.65)';
    ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, y - 22, w, 42, 8); ctx.fill();
    ctx.strokeStyle = sel ? '#f7d774' : 'rgba(200,215,215,0.28)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = sel ? '#fff0c8' : 'rgba(235,240,235,0.72)';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(options[i], VIEW_W / 2, y + 5);
    if (sel) {
      ctx.fillStyle = '#f7d774';
      ctx.beginPath();
      ctx.moveTo(VIEW_W / 2 - w / 2 - 18, y - 1);
      ctx.lineTo(VIEW_W / 2 - w / 2 - 7, y - 8);
      ctx.lineTo(VIEW_W / 2 - w / 2 - 7, y + 6);
      ctx.closePath(); ctx.fill();
    }
  }

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(230,235,235,0.62)';
  ctx.fillText('WASD DRIVE / WALK    SHIFT SPRINT    MOUSE AIM + FIRE    E ENTER / EXIT    ESC PAUSE', VIEW_W / 2, 528);
  ctx.fillText('SIX JOBS. ONE COASTLINE. NO RULES.', VIEW_W / 2, 552);
  ctx.fillStyle = 'rgba(247,215,116,0.65)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('PRESS ENTER TO START  //  ORIGINAL MAKE.FUN ENTRY', VIEW_W / 2, 610);
  ctx.fillStyle = `rgba(142,233,223,${0.25 + Math.sin(t * 2) * 0.12})`;
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('A PROCEDURAL OPEN WORLD - BUILT FROM CODE, NO ASSETS', VIEW_W / 2, 690);
}

function drawPause(game, ctx) {
  ctx.fillStyle = 'rgba(8,14,22,0.76)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7d774';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 190);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(235,240,235,0.8)';

  const lines = [
    'WASD / ARROWS   WALK OR DRIVE',
    'SHIFT           SPRINT ON FOOT',
    'MOUSE           AIM',
    'LEFT CLICK      FIRE  /  DRIVE-BY',
    'SPACE           GUN  /  HANDBRAKE IN CAR',
    'E               ENTER / EXIT CAR  ·  START JOBS',
    '1 / 2 / 3       FISTS  /  PISTOL  /  SMG',
    'M               MUTE SOUND',
    'ESC             RESUME',
  ];
  ctx.fillStyle = 'rgba(16,24,32,0.8)';
  ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 270, 220, 540, lines.length * 30 + 34, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(247,215,116,0.3)'; ctx.stroke();
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(225,232,228,0.72)' : '#e9eede';
    ctx.fillText(lines[i], VIEW_W / 2, 256 + i * 30);
  }
  ctx.fillStyle = '#8ee9df';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('PRESS ESC OR ENTER TO RETURN', VIEW_W / 2, 220 + lines.length * 30 + 22);
  void game;
}

function drawDialogue(game, ctx) {
  const d = game.dialogue;
  const w = 620, h = 86;
  const x = VIEW_W / 2 - w / 2, y = VIEW_H - 224;
  ctx.globalAlpha = clamp(d.ttl / 0.8, 0, 1);
  ctx.fillStyle = 'rgba(12,19,28,0.90)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = '#f7d774'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e8796a';
  ctx.beginPath(); ctx.arc(x + 38, y + 38, 20, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(20,25,32,0.8)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.speaker.slice(0, 1), x + 38, y + 42);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f7d774';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(d.speaker, x + 70, y + 29);
  ctx.fillStyle = '#e8eee8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(wrap(ctx, d.line, w - 96), x + 70, y + 53);
  ctx.globalAlpha = 1;
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    if (ctx.measureText(line + ' ' + word).width > maxW && line) break;
    line += (line ? ' ' : '') + word;
  }
  return line + (line.length < text.length ? '…' : '');
}

function drawMissionBanner(game, ctx) {
  const b = game.missionBanner;
  const a = clamp(b.ttl / 0.6, 0, 1);
  ctx.globalAlpha = a;
  const w = 430, h = 92;
  const x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - h / 2 - 40;
  ctx.fillStyle = 'rgba(14,22,30,0.92)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#f7d774'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8ee9df';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('JOB COMPLETE', VIEW_W / 2, y + 27);
  ctx.fillStyle = '#fff0c8';
  ctx.font = 'bold 27px system-ui, sans-serif';
  ctx.fillText(b.title, VIEW_W / 2, y + 58);
  ctx.fillStyle = '#a8e9b0';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('+$' + b.reward.toLocaleString('en-US'), VIEW_W / 2, y + 80);
  ctx.globalAlpha = 1;
}

function drawEnd(game, ctx) {
  const busted = game.mode === 'busted';
  ctx.fillStyle = busted ? 'rgba(14,22,42,0.82)' : 'rgba(42,12,18,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = busted ? '#9bc7ff' : '#ff7b7b';
  ctx.font = 'bold 86px system-ui, sans-serif';
  ctx.shadowColor = busted ? '#4a80d8' : '#d83f4f';
  ctx.shadowBlur = 26;
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', VIEW_W / 2, 280);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(240,242,235,0.88)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(busted ? 'BOOKED AT BAY 12 PRECINCT' : 'ADMITTED TO SUNSET MERCY', VIEW_W / 2, 326);
  ctx.fillText(`CASH LEFT: $${Math.round(game.player.money).toLocaleString('en-US')}`, VIEW_W / 2, 356);
  ctx.fillStyle = '#f7d774';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('PRESS ENTER TO RESPAWN', VIEW_W / 2, 420);
  ctx.fillStyle = 'rgba(230,235,230,0.5)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('YOU LOSE SOME CASH AND HALF YOUR AMMO', VIEW_W / 2, 452);
}
