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
    // A beta carries no payload — the cell being one is the whole fact (rev. 2026-08-05).
    case 'beta': return 'B';
    // The flag rides in the token: toggling one is a free action, so it changes nothing
    // else about the state, and a hash that ignored it could not tell two boards apart.
    case 'aiHidden': return `${c.mine ? 'X' : 'h'}${c.flagged ? 'F' : ''}${c.block}`;
    case 'aiRevealed': return `R${c.block}`;
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
    // Every endpoint (rev. 2026-08-05). Terrain is not hashed, so the destination set is the
    // only thing pinning *which* cells the level is asking for.
    `${s.origin}>${s.dests.join('.')}`,
    s.con.map(conToken).join(','),
    s.blocks.map((b) => `${b.id}:${b.cells.join('.')}`).join('|'),
    // `waited` and `state` are the whole economy since the points revision, so both are in
    // the fingerprint: two boards that differ only in how close a user is to giving up are
    // genuinely different boards. `todo` joins them on the same argument (rev. 2026-08-05):
    // two users standing on the same cell with the same clock, one owing C and one owing
    // nothing more than B, are about to walk in different directions.
    //
    // And so does the ordered bit, on the same argument again (rev. 2026-08-05): two users
    // owing {B, C} from the same cell walk differently if one of them may only have B. It is
    // written as a suffix that is **empty when the bit is false or absent**, so a v3 save —
    // whose users predate the field entirely — fingerprints exactly as it did, which is the
    // whole reason the field is optional (state.js).
    s.users.map((u) => `${u.id}@${u.at}/${u.state}/${u.stalled ? 1 : 0}/${u.waited}/${u.todo.join('.')}${u.ordered ? '!' : ''}/${u.visited.join('.')}`).join('|'),
    `${s.schedule.total}/${s.schedule.spawned}/${s.schedule.nextTick}/${s.schedule.every}`,
    phaseToken(s.phase),
    `${s.rng.gen}/${s.rng.move}`,
    // `betas` is in here for the same reason `waited` is: it is not decoration, it is the
    // supply, so two boards that differ only in how many betas are left are different boards
    // even when the tiles they built with them are identical (rev. 2026-08-05).
    [s.stats.placed, s.stats.generated, s.stats.analyzed, s.stats.waited, s.stats.detonations, s.stats.served, s.stats.lost, s.stats.betas].join('/'),
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
