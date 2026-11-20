// localStorage saves: continue an existing criminal career or start a fresh one.
import { SAVE_KEY } from './config.js';

export function saveGame(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
