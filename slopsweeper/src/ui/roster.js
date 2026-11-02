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
// ALWAYS ON SCREEN since 2026-11-02 (owner request). It used to sit behind the WAITING chip and
// said "NOBODY HAS ARRIVED YET" for the whole opening, which is exactly when the player is
// deciding where to build. Now it is a side column on wide screens and a one-row strip on
// phones (tap for the full sheet), and it covers the people who have not arrived yet: the cast
// is dealt at init (casting.js), so who comes, when, and where they need to go is known from
// turn zero and shown from turn zero. Read top to bottom: who is about to quit, who is walking,
// who is coming next, who is done.
//
// Everything on it is derived from `GameState` alone, NAMES INCLUDED. A refresh that restores
// a save (PLAN §11.10) brings back the same people in the same order with the same names,
// because nothing here is stored and nothing here is rolled: no Math.random, no Date, no
// reach into core's PRNG stream. The panel is a view of the state, exactly like the board is.

import { levelParams, patienceLimit } from '../core/state.js';
import { IMPATIENT_AT, patienceSpent, stopLetter } from './renderer.js';

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
 * Names for every scheduled slot, collision-free ON FIRST NAMES. The first draft deduped whole
 * pairs, and the very first playtest produced a CORBIN · SUPPORT killed in a crater while a
 * CORBIN · PEOPLE OPS queued at the origin. A list whose job is telling people apart may not
 * repeat a first name; forty names against a dozen arrivals leaves room to insist.
 *
 * The scan is ascending over slot ids and a slot's name depends only on the slots before it,
 * so naming the whole schedule up front (the arriving list needs it) gives every spawned user
 * the same name the old spawned-only scan did.
 * @param {GameState} s
 * @returns {string[]}
 */
function namesFor(s) {
  const firstOf = (/** @type {string} */ n) => n.slice(0, n.indexOf(' '));
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {string[]} */
  const out = [];
  for (let id = 0; id < s.schedule.total; id++) {
    let bump = 0;
    let name = userName(s.seed, id, 0);
    while (taken.has(firstOf(name)) && bump < 8) name = userName(s.seed, id, ++bump);
    taken.add(firstOf(name));
    out.push(name);
  }
  return out;
}

/** Turns of patience left at or below which a stuck row is an alarm, not a warning. */
export const URGENT_LEFT = 2;

/**
 * @typedef {object} Status
 * @property {string} word    the one word the row leads with
 * @property {string} cls     row modifier class
 * @property {'stuck' | 'walking' | 'done'} group
 */

/**
 * What this user is doing, from the state alone:
 *   QUEUED   at A, no path out yet (SPEC §6.2)
 *   WALKING  moving, and patience is not being spent this turn
 *   STUCK    stalled or stranded mid-route (SPEC §6.4)
 *   AT BETA  stalled on a beta block: they walked out to what you shipped
 * @param {GameState} s
 * @param {User} u
 * @returns {Status}
 */
function statusOf(s, u) {
  if (u.state === 'arrived') return { word: 'SERVED', cls: 'done good', group: 'done' };
  // Gave up (patience) versus failed (hit a bug), told apart by the walker's own bar (SPEC §6.6).
  if (u.state === 'gone') {
    return u.waited >= patienceLimit(s, u)
      ? { word: 'GAVE UP', cls: 'done bad', group: 'done' }
      : { word: 'FAILED', cls: 'done bad', group: 'done' };
  }
  if (u.state === 'queued') return { word: 'QUEUED', cls: 's-queued', group: 'stuck' };
  if (!u.stalled) return { word: 'WALKING', cls: 's-walking', group: 'walking' };
  return s.con[u.at].k === 'beta'
    ? { word: 'AT BETA', cls: 's-beta', group: 'stuck' }
    : { word: 'STUCK', cls: 's-waiting', group: 'stuck' };
}

/**
 * Every stop on a slot's itinerary as letters, in the order the panel prints them, plus
 * whether the order is enforced. Ordered lists keep the authored order (it is the whole fact);
 * loose ones sort, because their order carries none. No cast entry means every destination.
 * @param {GameState} s
 * @param {number} id
 * @returns {{ letters: string[], ordered: boolean }}
 */
function itineraryOf(s, id) {
  const entry = levelParams(s).cast?.[id];
  if (!entry) return { letters: s.dests.map((_, i) => stopLetter(i)), ordered: false };
  return entry.ordered
    ? { letters: entry.stops.slice(), ordered: true }
    : { letters: entry.stops.slice().sort(), ordered: false };
}

/**
 * The stops as spans: visited ones dimmed, the live one(s) bright. For an ordered list only
 * the first remaining stop is live and the joiner is an arrow; a loose list has every
 * remaining stop live and a dot between them.
 * @param {GameState} s
 * @param {number} id
 * @param {number[] | null} todo  remaining dest indexes, or null for a user not yet arrived
 * @returns {HTMLElement}
 */
function stopsNode(s, id, todo) {
  const { letters, ordered } = itineraryOf(s, id);
  const left = todo ? new Set(todo.map(stopLetter)) : new Set(letters);
  /** @type {string | null} null means every remaining stop is live */
  let now = null;
  if (ordered) now = todo ? (todo.length ? stopLetter(todo[0]) : '') : letters[0];
  const wrap = make('span', `pp-stops${ordered ? ' ordered' : ''}`);
  wrap.title = ordered ? 'Must visit in this order' : 'Visits these in any order';
  letters.forEach((ch, i) => {
    if (i) wrap.append(make('span', 'pp-join', ordered ? '→' : '·'));
    const cls = !left.has(ch) ? 'st-done' : (now === null || now === ch) ? 'st-now' : 'st-later';
    wrap.append(make('span', cls, ch));
  });
  return wrap;
}

/**
 * Where this user goes next, as letters: the head of an ordered list, or every remaining stop
 * of a loose one (any of them counts next). Owner rule (2026-11-02): the panel says where a
 * user is going and, if they are stuck, when they quit; it never shows steps taken or turns
 * already waited, so there is no patience bar here.
 * @param {GameState} s
 * @param {number} id
 * @param {number[] | null} todo  remaining dest indexes, or null for a user not yet arrived
 * @returns {string}
 */
function nextStop(s, id, todo) {
  const { letters, ordered } = itineraryOf(s, id);
  const left = todo ? letters.filter((ch) => todo.map(stopLetter).includes(ch)) : letters;
  if (!left.length) return '';
  return ordered ? left[0] : left.join('·');
}

/**
 * The turn slot `k` is due, read from the level's schedule (either shape).
 * @param {GameState} s
 * @param {number} k
 * @returns {number}
 */
function arrivalTick(s, k) {
  const a = levelParams(s).arrivals;
  if (a?.at) return a.at[k] ?? a.at[a.at.length - 1];
  if (a && typeof a.firstTick === 'number') return a.firstTick + k * a.every;
  // Unassociated params: extrapolate from the stored schedule.
  return s.schedule.nextTick + (k - s.schedule.spawned) * (s.schedule.every || 1);
}

/**
 * Actions until slot `k` walks in. Spawns run inside the turn that starts at its due tick, so a
 * slot due this turn arrives with the next action: "IN 1". Same arithmetic as the NEXT IN chip.
 * @param {GameState} s
 * @param {number} k
 */
export function arrivesIn(s, k) {
  return Math.max(1, arrivalTick(s, k) - s.tick + 1);
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
 * @typedef {{ u: User, st: Status, left: number, limit: number }} LiveRow
 * @typedef {{ id: number, in: number, limit: number }} ComingRow
 */

/**
 * What all three views read: every slot of the schedule, sorted into its group.
 * @param {GameState} s
 */
function model(s) {
  const names = namesFor(s);
  /** @type {LiveRow[]} */
  const stuck = [];
  /** @type {LiveRow[]} */
  const walking = [];
  /** @type {{ u: User, st: Status }[]} */
  const done = [];
  for (const u of s.users) {
    const st = statusOf(s, u);
    if (st.group === 'done') { done.push({ u, st }); continue; }
    const limit = patienceLimit(s, u);
    (st.group === 'stuck' ? stuck : walking).push({ u, st, left: Math.max(0, limit - (u.waited ?? 0)), limit });
  }
  // Most urgent first; ties on id so rows do not reshuffle under the finger.
  stuck.sort((a, b) => a.left - b.left || a.u.id - b.u.id);
  walking.sort((a, b) => a.left - b.left || a.u.id - b.u.id);
  done.sort((a, b) => a.u.id - b.u.id);
  /** @type {ComingRow[]} */
  const coming = [];
  for (let k = s.schedule.spawned; k < s.schedule.total; k++) {
    coming.push({ id: k, in: arrivesIn(s, k), limit: patienceLimit(s, { id: k }) });
  }
  return { names, stuck, walking, done, coming };
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
  const sheet = el('roster-list');
  const closeBtn = el('roster-close');
  const panel = el('people');
  const list = el('pp-list');
  const strip = el('pp-strip');
  const tally = el('pp-tally');
  let open = false;
  /** @type {GameState | null} */
  let last = null;

  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  closeBtn.addEventListener('click', close);
  strip.addEventListener('click', () => { if (last) toggle(last); });

  window.addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Escape') return;
    close();
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // One delegated listener per list: the rows are rebuilt every turn.
  /** @param {Event} e */
  const onRowClick = (e) => {
    const row = e.target instanceof Element ? e.target.closest('[data-cell]') : null;
    if (!row) return;
    close();
    h.onJump(Number(row.getAttribute('data-cell')));
  };
  sheet.addEventListener('click', onRowClick);
  list.addEventListener('click', onRowClick);

  /** @type {Map<HTMLElement, number>} when the player last scrolled each list by hand */
  const scrolledAt = new Map();
  for (const node of [sheet, list]) {
    for (const type of ['wheel', 'touchmove', 'pointerdown']) {
      node.addEventListener(type, () => scrolledAt.set(node, performance.now()), { passive: true });
    }
  }

  /**
   * Line two of every row: where the user goes next, then the whole sequence when there is
   * more than one stop (next emphasized, visited struck).
   * @param {GameState} s
   * @param {number} id
   * @param {number[] | null} todo
   */
  function routeLine(s, id, todo) {
    const l2 = make('span', 'pp-l2');
    const next = nextStop(s, id, todo);
    const label = make('span', 'pp-next', 'NEXT ');
    label.append(make('b', undefined, next || '·'));
    l2.append(label);
    // The sequence only when it says more than NEXT does: an ordered list, or a loose one with
    // a stop already visited.
    const { letters, ordered } = itineraryOf(s, id);
    const visited = !!todo && todo.length < letters.length;
    if (letters.length > 1 && (ordered || visited)) l2.append(stopsNode(s, id, todo));
    return l2;
  }

  /**
   * One stuck or walking person. Stuck: the box is turns until they quit. Walking: no number,
   * because nothing is running down while they walk.
   * @param {GameState} s
   * @param {LiveRow} r
   * @param {string} name
   */
  function liveRow(s, r, name) {
    const stuck = r.st.group === 'stuck';
    const urgent = stuck && r.left <= URGENT_LEFT;
    const warn = stuck && patienceSpent(s, r.u) >= IMPATIENT_AT;
    const row = make('button', `pp-row ${r.st.cls}${urgent ? ' urgent' : warn ? ' warn' : ''}`);
    row.setAttribute('type', 'button');
    row.setAttribute('data-cell', String(r.u.at));
    const box = make('span', stuck ? 'pp-left' : 'pp-left pp-go');
    if (stuck) {
      box.append(make('span', undefined, 'QUITS'), make('b', undefined, String(r.left)));
      box.title = `Quits in ${r.left} turn${r.left === 1 ? '' : 's'}`;
    } else {
      box.append(make('b', undefined, '→'));
      box.title = 'Walking';
    }
    const main = make('span', 'pp-main');
    const l1 = make('span', 'pp-l1');
    l1.append(make('span', 'pp-name', name), make('span', 'pp-state', r.st.word));
    main.append(l1, routeLine(s, r.u.id, r.u.todo));
    row.append(box, main);
    return row;
  }

  /**
   * @param {GameState} s
   * @param {ComingRow} c
   * @param {string} name
   */
  function comingRow(s, c, name) {
    const row = make('button', 'pp-row coming');
    row.setAttribute('type', 'button');
    row.setAttribute('data-cell', String(s.origin));
    const box = make('span', 'pp-in');
    box.append(make('span', undefined, 'IN'), make('b', undefined, String(c.in)));
    box.title = `Arrives at A in ${c.in} turn${c.in === 1 ? '' : 's'}; quits after ${c.limit} turns stuck`;
    const main = make('span', 'pp-main');
    const l1 = make('span', 'pp-l1');
    l1.append(make('span', 'pp-name', name));
    main.append(l1, routeLine(s, c.id, null));
    row.append(box, main);
    return row;
  }

  /**
   * @param {GameState} s
   * @param {HTMLElement} into
   */
  function renderList(s, into) {
    const m = model(s);
    // The top of the list is the most urgent row, so a re-render goes back to it, unless the
    // player scrolled this list in the last few seconds and is reading something further down.
    const keep = performance.now() - (scrolledAt.get(into) ?? -1e9) < 4000 ? into.scrollTop : 0;
    into.innerHTML = '';
    /** @param {string} text @param {number} n */
    const sep = (text, n) => into.append(make('div', 'pp-sep', `${text} · ${n}`));
    if (m.stuck.length) {
      sep('STUCK', m.stuck.length);
      for (const r of m.stuck) into.append(liveRow(s, r, m.names[r.u.id] ?? '?'));
    }
    if (m.walking.length) {
      sep('WALKING', m.walking.length);
      for (const r of m.walking) into.append(liveRow(s, r, m.names[r.u.id] ?? '?'));
    }
    if (m.coming.length) {
      sep('ARRIVING', m.coming.length);
      for (const c of m.coming) into.append(comingRow(s, c, m.names[c.id] ?? '?'));
    }
    if (m.done.length) {
      // Done is a tally, not a list.
      const count = (/** @type {string} */ w) => m.done.filter((d) => d.st.word === w).length;
      const line = make('div', 'pp-sep pp-tally');
      line.append(
        make('span', 'good', `SERVED ${count('SERVED')}`),
        make('span', undefined, ' · '),
        make('span', 'bad', `GAVE UP ${count('GAVE UP')}`),
        make('span', undefined, ' · '),
        make('span', 'bad', `FAILED ${count('FAILED')}`),
      );
      into.append(line);
    }
    into.scrollTop = keep;
  }

  /**
   * The phone strip: the stuck in urgency order, a walking count, then the next arrivals.
   * @param {GameState} s
   */
  function renderStrip(s) {
    const m = model(s);
    strip.innerHTML = '';
    for (const r of m.stuck) {
      const urgent = r.left <= URGENT_LEFT;
      const warn = patienceSpent(s, r.u) >= IMPATIENT_AT;
      const chip = make('span', `ps-chip ${r.st.cls}${urgent ? ' urgent' : warn ? ' warn' : ''}`);
      const first = (m.names[r.u.id] ?? '?').split(' ')[0];
      chip.append(make('b', undefined, String(r.left)), make('span', 'ps-name', first), stopsNode(s, r.u.id, r.u.todo));
      strip.append(chip);
    }
    if (m.walking.length) strip.append(make('span', 'ps-chip s-walking', `${m.walking.length} WALKING`));
    for (const c of m.coming.slice(0, 6)) {
      const chip = make('span', 'ps-chip coming');
      chip.append(make('span', 'ps-in', `IN ${c.in}`), stopsNode(s, c.id, null));
      strip.append(chip);
    }
    if (!strip.childElementCount) strip.append(make('span', 'ps-chip', 'EVERYONE RESOLVED'));
  }

  /** @param {GameState} s */
  function render(s) {
    last = s;
    const st = s.stats;
    tally.textContent = `${s.schedule.total} USERS · ${st.served} SERVED · ${st.lost ?? 0} LOST`;
    renderList(s, list);
    renderStrip(s);
    if (open) renderList(s, sheet);
  }

  function close() {
    if (!open) return;
    open = false;
    root.classList.add('hidden');
  }

  /** @param {GameState} s */
  function toggle(s) {
    if (open) return close();
    // On wide screens the side column already is the full list: the chip points at it.
    if (getComputedStyle(list).display !== 'none' && list.offsetParent !== null) {
      list.scrollTop = 0;
      panel.classList.remove('flash');
      void panel.offsetWidth;
      panel.classList.add('flash');
      return;
    }
    open = true;
    root.classList.remove('hidden');
    renderList(s, sheet);
  }

  return {
    toggle,

    /**
     * Every state update. The panel is always on screen now, so it always renders.
     * @param {GameState} s
     */
    update: render,

    close,

    /** While the sheet is up it owns the keyboard (input.js). */
    isOpen: () => open,
  };
}
