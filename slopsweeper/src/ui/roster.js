// @ts-check
// The user roster (2026-08-05): every person this run has scheduled, who is about to walk
// away from it, and where on the board they are standing right now.
//
// It exists because the forecast's waiting count is a number, and a number cannot be argued
// with. "WAITING 4" says you are behind; it does not say that three of those four still have
// a dozen turns of goodwill left and the fourth leaves in two — which is the only version of
// that fact you can build against. So the chip carries the worst case (hud.js) and this panel
// carries the queue, sorted by whose patience runs out first.
//
// Everything on it is derived from `GameState` alone, NAMES INCLUDED. A refresh that restores
// a save (PLAN §11.10) brings back the same people in the same order with the same names,
// because nothing here is stored and nothing here is rolled: no Math.random, no Date, no
// reach into core's PRNG stream. The panel is a view of the state, exactly like the board is.

import { levelParams } from '../core/state.js';
import { IMPATIENT_AT, patienceSpent } from './renderer.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').User} User */

/**
 * The name pool. A first name and the team they are here on behalf of, which is the whole
 * joke: nobody in this game is a "user", they are a stakeholder with a calendar. The register
 * is the LinkedUp end screen's (linkedup.js) held one notch quieter — these are the people
 * your outage happened *to*, so it is affectionate and PG, and never a real person.
 *
 * Forty by ten is four hundred pairs against a dozen arrivals, which is the ratio the
 * collision rule below is sized for.
 */
const FIRST = [
  'HARPER', 'DEB', 'RAVI', 'PRIYA', 'MARGOT', 'TOBIAS', 'ANNEKE', 'CORBIN',
  'DEVRIN', 'MARISOL', 'SOREN', 'NIA', 'YUSUF', 'ELEANOR', 'KIRAN', 'BRETT',
  'JOSIE', 'OMAR', 'VIKRAM', 'TAMSIN', 'LARS', 'HOLLIS', 'ESME', 'DUSTIN',
  'AMARA', 'FELIX', 'ROSHNI', 'GRETA', 'MILO', 'SANJAY', 'CLEO', 'WENDELL',
  'INES', 'THEO', 'NADIA', 'BARRY', 'JUNO', 'PAVEL', 'DELPHINE', 'GUS',
];

const TEAMS = [
  'GROWTH', 'PLATFORM', 'FINANCE', 'LEGAL', 'DESIGN',
  'SUPPORT', 'DATA', 'PROCUREMENT', 'PEOPLE OPS', 'TRUST & SAFETY',
];

/**
 * A tiny integer hash, deliberately NOT core's `mulberry32`. Names are view state: drawing
 * them from the reducer's stream would put a cosmetic list inside the determinism budget the
 * seed link exists to protect, and a name that shifts when the game reloads is the loudest
 * possible way to look broken. Pure in (seed, id, salt) — same three numbers, same name, on
 * every machine and every refresh. Same shape as atlas.js's `cellHash`, for the same reason.
 * @param {number} seed
 * @param {number} id
 * @param {number} salt
 * @returns {number} uint32
 */
function hash32(seed, id, salt) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (id + 0x165667b1), 0x27220a95) >>> 0;
  h = Math.imul(h ^ (salt + 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * One user's name. `bump` exists only for the collision walk below; at 0 this is the name.
 * @param {number} seed
 * @param {number} id
 * @param {number} [bump]
 * @returns {string}
 */
export function userName(seed, id, bump = 0) {
  const first = FIRST[hash32(seed, id, bump * 2 + 1) % FIRST.length];
  const team = TEAMS[hash32(seed, id, bump * 2 + 2) % TEAMS.length];
  return `${first} · ${team}`;
}

/**
 * Names for the whole run, collision-free ON FIRST NAMES. The first draft deduped whole
 * pairs, and the very first playtest produced a CORBIN · SUPPORT killed in a crater while a
 * CORBIN · PEOPLE OPS queued at the origin — technically distinct rows that read as one
 * person moonlighting. A list whose entire job is telling two people apart may not repeat a
 * first name at all; forty names against a dozen arrivals leaves room to insist. A taken
 * first name rehashes at the next bump.
 *
 * It stays a pure function of (seed, ids): ids never change, and the scan is ascending, so a
 * user's name is fixed the moment they are scheduled and no later arrival can rename them.
 * @param {GameState} s
 * @returns {Map<number, string>}
 */
function namesFor(s) {
  const ids = s.users.map((u) => u.id).sort((a, b) => a - b);
  const firstOf = (/** @type {string} */ n) => n.slice(0, n.indexOf(' '));
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {Map<number, string>} */
  const out = new Map();
  for (const id of ids) {
    let bump = 0;
    let name = userName(s.seed, id, 0);
    // Bounded: after eight rehashes take the collision rather than loop on a pool this small.
    while (taken.has(firstOf(name)) && bump < 8) name = userName(s.seed, id, ++bump);
    taken.add(firstOf(name));
    out.set(id, name);
  }
  return out;
}

/**
 * @typedef {object} Status
 * @property {string} word    the one word the row leads with
 * @property {string} cls     row modifier class
 * @property {boolean} done   resolved: no countdown, greyed, sorted to the bottom
 */

/**
 * What this user is doing, in one word, from the state and nothing else — so it survives a
 * refresh exactly as the board does. The four live words are the four things that can be true
 * of somebody who is still coming:
 *   QUEUED   at A, no path out yet (SPEC §6.2)
 *   WALKING  moving, and patience is not being spent this turn
 *   WAITING  stalled or stranded (SPEC §6.4) — the state that costs you the run
 *   BETA     stalled on a beta block: they walked out to what you shipped and are testing it
 * @param {GameState} s
 * @param {User} u
 * @returns {Status}
 */
function statusOf(s, u) {
  if (u.state === 'arrived') return { word: 'SERVED ✓', cls: 'done good', done: true };
  // The two ways a user is gone for good, told apart by the same threshold the reducer used:
  // at or past patience they walked away, otherwise a blast took them (SPEC §5).
  if (u.state === 'gone') {
    return u.waited >= levelParams(s).patience
      ? { word: 'GAVE UP', cls: 'done bad', done: true }
      : { word: 'KILLED', cls: 'done bad', done: true };
  }
  if (u.state === 'queued') return { word: 'QUEUED', cls: 's-queued', done: false };
  if (!u.stalled) return { word: 'WALKING', cls: 's-walking', done: false };
  return s.con[u.at].k === 'beta'
    ? { word: 'BETA', cls: 's-beta', done: false }
    : { word: 'WAITING', cls: 's-waiting', done: false };
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`roster: missing #${id}`);
  return node;
}

/**
 * @param {string} tag
 * @param {string} [cls]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function make(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @typedef {object} RosterHandlers
 * @property {(cell: number) => void} onJump   the minimap's own centring path (main.js)
 */

/**
 * @param {RosterHandlers} h
 */
export function createRoster(h) {
  const root = el('roster');
  const list = el('roster-list');
  const closeBtn = el('roster-close');
  let open = false;

  // Tap outside — the scrim itself, never a row — closes. Same gesture as every sheet on a
  // phone, and it means the panel needs no dismiss instruction.
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  closeBtn.addEventListener('click', close);

  // Esc, in capture, so it closes the panel instead of reaching the board's deselect. It only
  // swallows the key while the panel is open; start.js's own overlays are never open at the
  // same time (main.js closes this one before an end screen lands).
  window.addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Escape') return;
    close();
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // One delegated listener rather than a listener per row: the list is rebuilt on every turn,
  // and rebuilding handlers with it is how a panel starts leaking them.
  list.addEventListener('click', (e) => {
    const row = e.target instanceof Element ? e.target.closest('[data-cell]') : null;
    if (!row) return;
    close();
    h.onJump(Number(row.getAttribute('data-cell')));
  });

  /**
   * @param {GameState} s
   * @param {User} u
   * @param {string} name
   * @param {number} patience
   * @returns {HTMLElement}
   */
  function rowFor(s, u, name, patience) {
    const st = statusOf(s, u);
    // Live rows are buttons because they do something; resolved rows are not, because they
    // do not — a control that looks tappable and is not is worse than no control.
    const node = make(st.done ? 'div' : 'button', `ru-row ${st.cls}`);
    if (!st.done) {
      node.setAttribute('data-cell', String(u.at));
      node.setAttribute('type', 'button');
    }
    node.append(make('span', 'ru-name', name), make('span', 'ru-state', st.word));

    if (!st.done) {
      const left = Math.max(0, patience - (u.waited ?? 0));
      const cd = make('span', 'ru-left', `LEAVES IN ${left}`);
      // The same two-thirds the board's dot uses, imported rather than restated: one warning
      // threshold in the game, or the panel and the board disagree about who is in trouble.
      if (patienceSpent(s, u) >= IMPATIENT_AT) cd.classList.add('urgent');
      // A walker's countdown is true but paused — patience is only spent on the turns they
      // could not move — so it is dimmed rather than dropped. Dropping it would read as "this
      // one is safe", and the walk they are on can strand at any tile.
      if (st.word === 'WALKING') cd.classList.add('paused');
      node.append(cd);
    }
    return node;
  }

  /** @param {GameState} s */
  function render(s) {
    const names = namesFor(s);
    const patience = levelParams(s).patience;
    /** @type {User[]} */
    const live = [];
    /** @type {User[]} */
    const done = [];
    for (const u of s.users) (statusOf(s, u).done ? done : live).push(u);

    // Most urgent first: the row you have to answer is the row at the top. Ties break on id
    // so the order is stable turn to turn — a list that reshuffles under the finger is a list
    // nobody taps.
    live.sort((a, b) => (a.waited === b.waited ? a.id - b.id : b.waited - a.waited));

    list.innerHTML = '';
    if (live.length === 0 && done.length === 0) {
      list.append(make('div', 'ru-empty', 'NOBODY HAS ARRIVED YET'));
    }
    for (const u of live) list.append(rowFor(s, u, names.get(u.id) ?? '—', patience));
    if (done.length) {
      list.append(make('div', 'ru-sep', 'RESOLVED'));
      // Served first, then the losses, newest id last: the top of this section is the score.
      done.sort((a, b) => a.id - b.id);
      for (const u of done) list.append(rowFor(s, u, names.get(u.id) ?? '—', patience));
    }
  }

  function close() {
    if (!open) return;
    open = false;
    root.classList.add('hidden');
  }

  return {
    /**
     * The chip in the HUD is a toggle: the same tap that opened it puts it away.
     * @param {GameState} s
     */
    toggle(s) {
      if (open) return close();
      open = true;
      root.classList.remove('hidden');
      render(s);
    },

    /**
     * Every state update, and only while open — patience moves on every turn, so a stale
     * roster is a lying one. Closed, this costs one boolean test.
     * @param {GameState} s
     */
    update(s) { if (open) render(s); },

    close,
  };
}
