// @ts-check
// A stable hash of the whole mutable game state, for the determinism contract of PLAN §7.5:
// init(level, seed) + an identical action sequence ⇒ identical hashState at every tick.
// Field order is fixed here rather than left to JSON.stringify's insertion order, so the
// hash cannot start disagreeing because a reducer wrote a property in a different order.

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Con} Con */

/**
 * @param {Con} c
 * @returns {string}
 */
function conToken(c) {
  switch (c.k) {
    case 'none': return '.';
    case 'hand': return 'H';
    case 'aiHidden': return `${c.mine ? 'X' : 'h'}${c.block}`;
    case 'aiRevealed': return `R${c.block}`;
    case 'flagged': return 'F';
    case 'mineConfirmed': return `M${c.block}`;
    default: throw new Error(`hashState: unhandled construction state ${JSON.stringify(c)}`);
  }
}

/**
 * @param {GameState['phase']} p
 * @returns {string}
 */
function phaseToken(p) {
  switch (p.k) {
    case 'play': case 'won': case 'lost': return p.k;
    case 'placing':
      return `placing:${p.shape}:${p.rots.map((r) => `${r.rot}=${r.anchors.join('.')}`).join('|')}`;
    default: throw new Error(`hashState: unhandled phase ${JSON.stringify(p)}`);
  }
}

/**
 * Terrain is not hashed: it is fixed at load and shared by every clone, so `level` plus the
 * board dimensions already pin it.
 * @param {GameState} s
 * @returns {string}
 */
export function serializeState(s) {
  return [
    s.level,
    s.seed,
    s.tick,
    `${s.w}x${s.h}`,
    `${s.origin}>${s.dest}`,
    s.con.map(conToken).join(','),
    s.blocks.map((b) => `${b.id}:${b.cells.join('.')}`).join('|'),
    s.users.map((u) => `${u.id}@${u.at}/${u.state}/${u.stalled ? 1 : 0}/${u.visited.join('.')}`).join('|'),
    `${s.schedule.total}/${s.schedule.spawned}/${s.schedule.nextTick}/${s.schedule.every}`,
    // Rounded so accumulated float drain can never make two identical games hash apart.
    s.confidence.toFixed(6),
    phaseToken(s.phase),
    `${s.rng.gen}/${s.rng.move}`,
    [s.stats.placed, s.stats.generated, s.stats.analyzed, s.stats.waited, s.stats.detonations, s.stats.served].join('/'),
  ].join('');
}

/**
 * @param {string} text
 * @returns {string} 8 hex digits
 */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * @param {GameState} s
 * @returns {string}
 */
export function hashState(s) {
  return fnv1a(serializeState(s));
}
