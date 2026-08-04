// @ts-check
// The front door and the rules card (PLAN §11.9). Two DOM overlays over an already-booted
// game, built lazily like the Level Lab (§9.2) so the shipped page only fetches them when it
// is going to show them. Core never learns either exists: the level picker calls the same
// `onLevel` the HUD dropdown does, and PLAY does nothing but hide a div.
//
// WHEN IT IS SKIPPED. The start screen is the front door, so it opens on a plain load and
// stays out of the way of every flow that is not one:
//   · `?lab=1` — the Level Lab is a dev tool and its author did not ask for a title card.
//   · `?seed=` — a pinned seed is a repro link, shared to show somebody one exact game. A
//     door in front of it defeats the point, and worse, the level picker behind that door
//     would reroll the thing the link exists to preserve.
// `?level=` deliberately does NOT skip: the game writes it into the URL itself on every
// start, so honouring it would mean the screen shows exactly once, ever, on a given browser.

/** @typedef {import('../levels/index.js').LevelDef} LevelDef */

/**
 * The rules, in the HUD's voice: terse headers, short lines, no paragraph anybody has to
 * re-read. Kept as data so the copy is legible as copy rather than buried in markup.
 * @type {[string, string[]][]}
 */
const HELP = [
  ['GOAL', [
    'Users arrive at A on a schedule and walk to B the moment a path exists.',
    'Serve every one of them to win. If confidence hits zero, you have lost.',
    'Every user still waiting drains confidence, every tick. Nothing gives it back.',
  ]],
  ['BUILD', [
    'PLACE — one tile, one turn. It has to touch something already built.',
    'GENERATE — a whole block, one turn. Rotate it, drop it on a highlighted anchor.',
    'You cannot decline a block once it is drawn, and it always ships hidden defects — at least two of them.',
  ]],
  ['READ', [
    'Every number counts the defects in the eight cells around it.',
    'A revealed cell shows its own count.',
    'Your hand tiles sense the defects beside them too — blank means provably clean.',
    'A block badge is the defects still left in that block.',
  ]],
  ['CLEAR OR AVOID', [
    'ANALYZE — one cell, one turn. A zero opens its neighbours with it.',
    'Analyze a defect and it DETONATES: the blast craters back to open ocean, users caught in it walk home, and confidence takes the hit.',
    'FLAG — free, and reversible. Users refuse to walk through a flagged cell.',
    'A user who steps onto a hidden defect sets it off exactly the same way.',
  ]],
  ['CONTROLS', [
    'Tap a cell to select it. The action bar does the acting — nothing on the board spends a turn by itself.',
    'Drag to pan. Pinch, scroll, or the + and − buttons to zoom. Tap the minimap to jump.',
    'R rotate · F flag · Enter confirm · Esc deselect.',
    'WAIT passes one turn. RUN keeps passing until something worth watching happens.',
  ]],
];

const PREMISE = 'Users are waiting. The AI builds fast and leaves defects. Ship anyway.';

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
 * @typedef {object} StartHandlers
 * @property {string[]} levels          registered level ids, in registry order
 * @property {() => string} getLevel    the level the game is booted on right now
 * @property {(id: string) => void} onLevel   the same switch the HUD dropdown calls
 */

/**
 * @param {StartHandlers} h
 */
export function createStart(h) {
  const start = make('div', 'overlay hidden');
  start.id = 'start';
  start.innerHTML = `
    <div class="overlay-card">
      <h1>SLOP SWEEPER</h1>
      <p class="premise"></p>
      <label class="field" for="start-level">LEVEL</label>
      <select id="start-level"></select>
      <div class="overlay-actions">
        <button id="start-play">PLAY</button>
        <button id="start-help">HOW TO PLAY</button>
      </div>
    </div>`;

  const help = make('div', 'overlay hidden');
  help.id = 'help';
  help.innerHTML = `
    <div class="overlay-card help-card">
      <div class="help-head">
        <h2>HOW TO PLAY</h2>
        <button id="help-back">BACK</button>
      </div>
      <div class="help-body"></div>
    </div>`;

  /** @type {HTMLElement} */ (start.querySelector('.premise')).textContent = PREMISE;

  const body = /** @type {HTMLElement} */ (help.querySelector('.help-body'));
  for (const [heading, lines] of HELP) {
    body.append(make('h3', undefined, heading));
    for (const line of lines) body.append(make('p', undefined, line));
  }

  const level = /** @type {HTMLSelectElement} */ (start.querySelector('#start-level'));
  const back = /** @type {HTMLButtonElement} */ (help.querySelector('#help-back'));

  document.body.append(start, help);

  /** Whether BACK returns to the start screen or just closes: set by whoever opened help. */
  let helpReturns = false;

  function syncLevels() {
    const current = h.getLevel();
    level.innerHTML = '';
    for (const id of h.levels) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      opt.selected = id === current;
      level.append(opt);
    }
  }

  level.addEventListener('change', () => h.onLevel(level.value));

  /** @param {HTMLElement} node @param {boolean} on */
  const show = (node, on) => node.classList.toggle('hidden', !on);

  function close() {
    show(start, false);
    show(help, false);
    document.body.classList.remove('starting');
  }

  function openStart() {
    syncLevels();
    show(help, false);
    show(start, true);
    document.body.classList.remove('starting');
  }

  /** @param {boolean} fromStart */
  function openHelp(fromStart) {
    helpReturns = fromStart;
    back.textContent = fromStart ? 'BACK' : 'CLOSE';
    show(start, false);
    show(help, true);
    document.body.classList.remove('starting');
    body.scrollTop = 0;
  }

  /** @type {HTMLButtonElement} */ (start.querySelector('#start-play')).addEventListener('click', close);
  /** @type {HTMLButtonElement} */ (start.querySelector('#start-help')).addEventListener('click', () => openHelp(true));
  back.addEventListener('click', () => (helpReturns ? openStart() : close()));

  // Esc backs out one step, and never reaches the board's own deselect while an overlay owns
  // the screen. Capture, because the board's keydown listener is on window too.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!help.classList.contains('hidden')) {
      if (helpReturns) openStart(); else close();
    } else if (!start.classList.contains('hidden')) {
      close();
    } else {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
  }, true);

  return {
    /** The front door. */
    open: openStart,
    /** Mid-game "?" — BACK reads CLOSE, because there is no start screen behind it. */
    help: () => openHelp(false),
    close,
  };
}
