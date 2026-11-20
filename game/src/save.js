// Saves: one slot in this browser's localStorage. The save holds the job counter, bank, the
// player's kit and where they were standing, plus which mixtapes they have found. A save is
// written after each finished job, each purchase and each tape, and by the pause menu.
//
// A save is user-editable data, so every field is validated on the way in. A corrupt or truncated
// slot is ignored rather than crashing the game on the title screen.

import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 1;

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (!Number.isFinite(data.progress)) return null;
    const mag = data.mag && typeof data.mag === 'object' ? data.mag : {};
    const reserve = data.reserve && typeof data.reserve === 'object' ? data.reserve : {};
    const tapes = Array.isArray(data.tapes)
      ? data.tapes.filter((index) => Number.isInteger(index) && index >= 0 && index < 8)
      : [];
    return {
      version: SAVE_VERSION,
      citySeed: Number.isSafeInteger(data.citySeed) ? data.citySeed : null,
      progress: Math.max(0, Math.min(6, Math.floor(data.progress))),
      storyComplete: Boolean(data.storyComplete) || Number(data.progress) >= 6,
      money: Math.max(0, Math.round(finite(data.money, 750))),
      health: Math.max(25, Math.min(100, Math.round(finite(data.health, 100)))),
      armor: Math.max(0, Math.min(100, Math.round(finite(data.armor, 0)))),
      x: finite(data.x, 2600),
      y: finite(data.y, 4734),
      weapon: ['fists', 'pistol', 'smg'].includes(data.weapon) ? data.weapon : 'pistol',
      mag: {
        pistol: Math.max(0, Math.min(12, Math.round(finite(mag.pistol, 12)))),
        smg: Math.max(0, Math.min(30, Math.round(finite(mag.smg, 0)))),
      },
      reserve: {
        pistol: Math.max(0, Math.min(9999, Math.round(finite(reserve.pistol, 48)))),
        smg: Math.max(0, Math.min(9999, Math.round(finite(reserve.smg, 0)))),
      },
      tapes: [...new Set(tapes)],
      updated: finite(data.updated, Date.now()),
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    const safe = readSaveFromObject(data);
    if (!safe) return false;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

/** The same validation without localStorage, so a save written is a save that can be read. */
function readSaveFromObject(data) {
  if (!data || typeof data !== 'object' || !Number.isFinite(data.progress)) return null;
  const progress = Math.max(0, Math.min(6, Math.floor(finite(data.progress, 0))));
  return {
    version: SAVE_VERSION,
    citySeed: Number.isSafeInteger(data.citySeed) ? data.citySeed : null,
    progress,
    storyComplete: Boolean(data.storyComplete) || progress >= 6,
    money: Math.max(0, Math.round(finite(data.money, 750))),
    health: Math.max(25, Math.min(100, Math.round(finite(data.health, 100)))),
    armor: Math.max(0, Math.min(100, Math.round(finite(data.armor, 0)))),
    x: finite(data.x, 2600),
    y: finite(data.y, 4734),
    weapon: ['fists', 'pistol', 'smg'].includes(data.weapon) ? data.weapon : 'pistol',
    mag: {
      pistol: Math.max(0, Math.min(12, Math.round(finite(data.mag?.pistol, 12)))),
      smg: Math.max(0, Math.min(30, Math.round(finite(data.mag?.smg, 0)))),
    },
    reserve: {
      pistol: Math.max(0, Math.min(9999, Math.round(finite(data.reserve?.pistol, 48)))),
      smg: Math.max(0, Math.min(9999, Math.round(finite(data.reserve?.smg, 0)))),
    },
    tapes: Array.isArray(data.tapes)
      ? [...new Set(data.tapes.filter((index) => Number.isInteger(index) && index >= 0 && index < 8))]
      : [],
    updated: finite(data.updated, Date.now()),
  };
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; nothing to clear.
  }
}

export function saveSummary(save) {
  if (!save) return 'No save yet';
  return `Job ${Math.min(save.progress + 1, 6)} of 6 · $${Math.round(save.money).toLocaleString('en-US')}`;
}
