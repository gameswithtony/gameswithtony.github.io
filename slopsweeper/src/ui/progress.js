// @ts-check
// Campaign progress (2026-11-02): which levels are cleared and the best score on each. Every
// level is open to play (owner decision, same day); the record only guides, through the
// CLEARED and NEXT marks on the level select.
//
// Keyed by level id, so a level renamed in the registry simply reads as never played. Stored
// under its own key, apart from the per-level saves (main.js), because a save is one game in
// progress and this is the record of every game finished.

const PROGRESS_KEY = 'slop-sweeper.progress';

/**
 * @typedef {object} LevelRecord
 * @property {boolean} cleared  has ever reached its goal
 * @property {number} best      most users served in a finished game
 * @property {number} total     users scheduled when `best` was set
 */

/** @typedef {Record<string, LevelRecord>} Progress */

/** @returns {Progress} */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

/** @param {Progress} p */
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

/**
 * Book a finished game. Returns the updated record set.
 * @param {string} id
 * @param {{ served: number, total: number, won: boolean }} r
 * @returns {Progress}
 */
export function recordResult(id, r) {
  const p = loadProgress();
  const prev = p[id];
  p[id] = {
    cleared: !!prev?.cleared || r.won,
    best: Math.max(prev?.best ?? 0, r.served),
    total: r.served >= (prev?.best ?? 0) ? r.total : (prev?.total ?? r.total),
  };
  saveProgress(p);
  return p;
}

/**
 * The level a returning player is pointed at: the first one not yet cleared, or the last level
 * when everything is.
 * @param {string[]} ids   registry order, which is campaign order
 * @param {Progress} [p]
 * @returns {string}
 */
export function frontier(ids, p = loadProgress()) {
  for (const id of ids) if (!p[id]?.cleared) return id;
  return ids[ids.length - 1];
}
