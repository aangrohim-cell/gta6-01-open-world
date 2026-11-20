// Saves: one slot in this browser's localStorage. The save holds the job counter, bank, the
// player's kit and where they were standing, plus which mixtapes they have found. A save is
// written after each finished job, each purchase and each tape, and by the pause menu.

import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.progress !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
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
