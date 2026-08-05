// @ts-check
// The overlay layer (PLAN §11.9): start · how to play · win · lose. Four DOM cards over an
// already-booted game, built lazily like the Level Lab (§9.2). Core never learns any of them
// exists — the level picker calls the same `onLevel` the HUD dropdown does, PLAY hides a div,
// and the end screens are handed plain numbers rather than a GameState.
//
// WHEN THE START SCREEN IS SKIPPED. It is the front door, so it opens on a plain load and
// stays out of the way of every flow that is not one:
//   · `?lab=1` — the Level Lab is a dev tool and its author did not ask for a title card.
//   · `?seed=` — a pinned seed is a repro link, shared to show somebody one exact game. A
//     door in front of it defeats the point, and worse, the level picker behind that door
//     would reroll the thing the link exists to preserve. The win screen's SHARE button
//     produces exactly such a link, so this rule is what makes a shared score land on the
//     board it is boasting about.
// `?level=` deliberately does NOT skip: the game writes it into the URL itself on every
// start, so honouring it would mean the screen shows exactly once, ever, on a given browser.
//
// ESC. The informational overlays back out — help returns to whatever opened it, the start
// screen closes. The end screens do not: they are a decision with their own buttons, and the
// board behind them is finished. That matches the banner they replaced, which had no dismiss.

import { initials, pickPost } from './linkedup.js';

/** @typedef {import('./linkedup.js').PostFacts} PostFacts */

/**
 * The rules, in the HUD's voice: terse headers, short lines, no paragraph anybody has to
 * re-read. Kept as data so the copy is legible as copy rather than buried in markup.
 * @type {[string, string[]][]}
 */
const HELP = [
  ['GOAL', [
    'Users arrive at A on a schedule and walk to B the moment a path exists.',
    'Every user who gets across is a point. The run ends once none are left to arrive.',
    'Serve one and you have shipped something. Serve all of them and the run is perfect.',
    'Serve nobody and you have not shipped.',
  ]],
  ['PATIENCE', [
    'A user who cannot move is waiting, and waiting is counted — across the whole game, not per trip.',
    'Spend enough of a user\'s patience and they give up and leave. They do not come back.',
    'A user caught in a detonation is gone the same way. Nothing you build afterwards returns either of them.',
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
    'Analyze a defect and it DETONATES: the blast craters back to open ocean, and any user standing in it is gone.',
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
 * Everything an end screen needs, as numbers. Deliberately not a GameState: these cards are
 * shown after the game is over and must not be able to ask it anything.
 * @typedef {object} EndFacts
 * @property {boolean} won
 * @property {string} levelId
 * @property {string} mapName
 * @property {number} served
 * @property {number} total
 * @property {number} lost
 * @property {number} detonations
 * @property {number} ticks
 * @property {number} seed
 * @property {number} placed
 * @property {number} generated
 * @property {number} analyzed
 * @property {number} waited
 */

/**
 * The replay link: same page, same level, same seed, nothing else. Determinism is the reason
 * a URL is in the share string at all — the score only means something if whoever you sent it
 * to can stand on the identical board.
 * @param {EndFacts} f
 * @returns {string}
 */
export function replayUrl(f) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('level', f.levelId);
  url.searchParams.set('seed', String(f.seed >>> 0));
  return url.toString();
}

/**
 * @param {EndFacts} f
 * @returns {string}
 */
export function shareText(f) {
  return [
    'SLOP SWEEPER',
    f.mapName.toUpperCase(),
    `SERVED ${f.served}/${f.total}`,
    `${f.ticks} TICKS`,
    replayUrl(f),
  ].join(' · ');
}

/**
 * @typedef {object} StartHandlers
 * @property {string[]} levels          registered level ids, in registry order
 * @property {() => string} getLevel    the level the game is booted on right now
 * @property {(id: string) => void} onLevel   the same switch the HUD dropdown calls
 * @property {() => void} onRestart     replay the level that just ended
 */

/**
 * @typedef {object} Overlays
 * @property {() => void} open       the front door
 * @property {() => void} help       the "?" in the HUD
 * @property {(f: EndFacts) => void} end
 * @property {() => void} close
 */

/**
 * @param {StartHandlers} h
 * @returns {Overlays}
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

  const win = make('div', 'overlay hidden');
  win.id = 'win';
  win.innerHTML = `
    <div class="overlay-card end-card">
      <div class="end-kicker"></div>
      <div class="end-score"></div>
      <div class="end-sub"></div>
      <div class="end-stats"></div>
      <div class="overlay-actions">
        <button id="win-share">SHARE</button>
        <button id="win-again">PLAY AGAIN</button>
        <button id="win-levels">LEVELS</button>
      </div>
    </div>`;

  const lose = make('div', 'overlay hidden');
  lose.id = 'lose';
  lose.innerHTML = `
    <div class="overlay-card lose-card">
      <div class="lu-brand">Linked<span>Up</span></div>
      <article class="lu-post">
        <header class="lu-head">
          <div class="lu-avatar"></div>
          <div class="lu-who">
            <b class="lu-author"></b>
            <span class="lu-headline"></span>
            <span class="lu-meta">1h · 🌐</span>
          </div>
        </header>
        <div class="lu-body"></div>
        <div class="lu-reactions"></div>
      </article>
      <div class="overlay-actions">
        <button id="lose-retry">RETRY</button>
        <button id="lose-levels">LEVELS</button>
      </div>
    </div>`;

  /** @type {HTMLElement} */ (start.querySelector('.premise')).textContent = PREMISE;

  const body = /** @type {HTMLElement} */ (help.querySelector('.help-body'));
  for (const [heading, lines] of HELP) {
    body.append(make('h3', undefined, heading));
    for (const line of lines) body.append(make('p', undefined, line));
  }

  const level = /** @type {HTMLSelectElement} */ (start.querySelector('#start-level'));
  const back = /** @type {HTMLButtonElement} */ (help.querySelector('#help-back'));
  const shareBtn = /** @type {HTMLButtonElement} */ (win.querySelector('#win-share'));

  document.body.append(start, help, win, lose);

  const panels = { start, help, win, lose };

  /** @type {'start' | 'win' | 'lose' | null} where BACK out of help goes; null closes. */
  let helpReturn = null;
  /** @type {EndFacts | null} */
  let lastEnd = null;

  /** @param {keyof typeof panels | null} name */
  function show(name) {
    for (const [key, node] of Object.entries(panels)) node.classList.toggle('hidden', key !== name);
    document.body.classList.remove('starting');
  }

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

  function openStart() {
    syncLevels();
    show('start');
  }

  /** @param {'start' | 'win' | 'lose' | null} from */
  function openHelp(from) {
    helpReturn = from;
    back.textContent = from ? 'BACK' : 'CLOSE';
    show('help');
    body.scrollTop = 0;
  }

  // --- win ---------------------------------------------------------------------------

  /** @param {EndFacts} f */
  function openWin(f) {
    lastEnd = f;
    const perfect = f.served >= f.total;
    const kicker = /** @type {HTMLElement} */ (win.querySelector('.end-kicker'));
    kicker.textContent = perfect ? 'PERFECT' : 'SHIPPED';
    kicker.classList.toggle('perfect', perfect);
    /** @type {HTMLElement} */ (win.querySelector('.end-score')).textContent = `SERVED ${f.served}/${f.total}`;
    /** @type {HTMLElement} */ (win.querySelector('.end-sub')).textContent =
      `${f.mapName.toUpperCase()} · ${f.ticks} TICKS · SEED ${f.seed}`;

    const stats = /** @type {HTMLElement} */ (win.querySelector('.end-stats'));
    stats.innerHTML = '';
    /** @type {[string, number][]} */
    const rows = [
      ['LOST', f.lost],
      ['DETONATIONS', f.detonations],
      ['PLACED', f.placed],
      ['GENERATED', f.generated],
      ['ANALYZED', f.analyzed],
      ['WAITED', f.waited],
    ];
    for (const [label, value] of rows) {
      const cell = make('div', 'stat');
      cell.append(make('span', undefined, label), make('b', undefined, String(value)));
      stats.append(cell);
    }
    shareBtn.textContent = 'SHARE';
    show('win');
  }

  /**
   * The platform's share sheet where there is one, the clipboard otherwise, and the raw
   * string on screen if neither is permitted — a score you cannot get out of the tab is not
   * a score.
   */
  async function share() {
    if (!lastEnd) return;
    const text = shareText(lastEnd);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Slop Sweeper', text });
        shareBtn.textContent = 'SHARED';
        return;
      }
    } catch (err) {
      // Backing out of the OS sheet is a decision, not a failure, and must not fall through
      // to silently copying something the player just declined to send.
      if (/** @type {Error} */ (err)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = 'COPIED';
    } catch {
      /** @type {HTMLElement} */ (win.querySelector('.end-sub')).textContent = text;
      shareBtn.textContent = 'COPY IT';
    }
  }

  // --- lose --------------------------------------------------------------------------

  /** @param {EndFacts} f */
  function openLose(f) {
    lastEnd = f;
    /** @type {PostFacts} */
    const facts = {
      map: f.mapName,
      served: f.served,
      total: f.total,
      lost: f.lost,
      detonations: f.detonations,
      ticks: f.ticks,
    };
    const post = pickPost(facts);
    /** @type {HTMLElement} */ (lose.querySelector('.lu-avatar')).textContent = initials(post.author);
    /** @type {HTMLElement} */ (lose.querySelector('.lu-author')).textContent = post.author;
    /** @type {HTMLElement} */ (lose.querySelector('.lu-headline')).textContent = post.headline;

    const text = /** @type {HTMLElement} */ (lose.querySelector('.lu-body'));
    text.innerHTML = '';
    for (const para of post.body.split(/\n{2,}/)) text.append(make('p', undefined, para.trim()));

    // Reaction counts are decorative, and derived from the post's own author so a given post
    // always wears the same numbers — engagement that reshuffles on every repaint reads as
    // broken rather than as satire.
    let hash = 0;
    for (const ch of post.author) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
    /** @type {HTMLElement} */ (lose.querySelector('.lu-reactions')).textContent =
      `👏 ${20 + (hash % 180)} · 💡 ${3 + (hash % 40)} · Insightful`;
    show('lose');
  }

  // --- wiring ------------------------------------------------------------------------

  level.addEventListener('change', () => h.onLevel(level.value));
  /** @type {HTMLButtonElement} */ (start.querySelector('#start-play')).addEventListener('click', () => show(null));
  /** @type {HTMLButtonElement} */ (start.querySelector('#start-help')).addEventListener('click', () => openHelp('start'));
  back.addEventListener('click', () => {
    if (helpReturn === 'start') openStart();
    else if (helpReturn === 'win' && lastEnd) openWin(lastEnd);
    else if (helpReturn === 'lose') show('lose');   // re-opening would reroll the post
    else show(null);
  });

  shareBtn.addEventListener('click', share);
  /** @type {HTMLButtonElement} */ (win.querySelector('#win-again')).addEventListener('click', () => { show(null); h.onRestart(); });
  /** @type {HTMLButtonElement} */ (win.querySelector('#win-levels')).addEventListener('click', openStart);
  /** @type {HTMLButtonElement} */ (lose.querySelector('#lose-retry')).addEventListener('click', () => { show(null); h.onRestart(); });
  /** @type {HTMLButtonElement} */ (lose.querySelector('#lose-levels')).addEventListener('click', openStart);

  // Esc backs out of the informational overlays and never reaches the board's own deselect.
  // Capture, because the board's keydown listener is on window too.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!help.classList.contains('hidden')) back.click();
    else if (!start.classList.contains('hidden')) show(null);
    else return;                        // an end screen is a decision, not a dialog
    e.stopPropagation();
    e.preventDefault();
  }, true);

  return {
    /** The front door. */
    open: openStart,
    /** Mid-game "?" — BACK reads CLOSE unless an end screen is waiting behind it. */
    help: () => openHelp(
      !win.classList.contains('hidden') ? 'win'
        : !lose.classList.contains('hidden') ? 'lose'
          : null,
    ),
    /** @param {EndFacts} f */
    end: (f) => (f.won ? openWin(f) : openLose(f)),
    close: () => show(null),
  };
}
