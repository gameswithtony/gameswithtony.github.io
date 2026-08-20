// @ts-check
// The overlay layer (PLAN §11.9): start · how to play · win · lose. Four DOM cards over an
// already-booted game, built lazily like the Level Lab (§9.2). Core never learns any of them
// exists — a level card calls `onLevel` (main.js: a fresh game) and then hides the div, and
// the end screens are handed plain numbers rather than a GameState.
//
// THE LEVEL SELECT (owner request 2026-08-20). The start screen's <select> grew into a card
// grid: one card per registered level, in registry order, which is the difficulty arc
// (levels/index.js). Each card wears a canvas thumbnail drawn from `parseMap(def.map)` on
// every open — the charmap is the only source, so editing a level redraws its own card with
// no asset to regenerate. Tapping a card opens that level — continuing its saved game when
// one is standing (the CONTINUE badge says so; saves are one slot per level, same day),
// starting fresh when not. There is no PLAY button any more because every card is one.
//
// WHEN THE START SCREEN IS SKIPPED. It is the front door, so it opens on a plain load and
// stays out of the way of every flow that is not one — and a skip is never a lockout, because
// the bar's LEVEL button reopens this screen at any time (owner report 2026-08-20: a restored
// save skipped the title card and left no way back to the level select short of finishing the
// game). The skips:
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

import { parseMap } from '../core/grid.js';
import { arrivalCount } from '../core/casting.js';
import { getLevel as levelById } from '../levels/index.js';
import { PALETTE } from './palette.js';
import { initials, pickPost } from './linkedup.js';

/** @typedef {import('./linkedup.js').PostFacts} PostFacts */
/** @typedef {import('../core/grid.js').ParsedMap} ParsedMap */

/**
 * The rules as a plain how-to-play with the story in short asides, written for somebody
 * sitting down to their first game (owner revision 2026-08-05, second pass: the first
 * rewrite led with story and got called on it — instruction first, flavour in passing).
 * Every mechanical claim from the original terse version survives. Kept as data so the copy
 * is legible as copy rather than buried in markup. One deliberate style rule from the
 * owner's voice profile: no em-dashes anywhere in this copy, colons and commas do the work.
 * @type {[string, string[]][]}
 */
const HELP = [
  ['THE GOAL', [
    'Welcome to Slopsweeper! You are a coder with software to ship. Users arrive at A, and each one carries a list of destinations to visit, the things they came to do. On many levels that list is just B.',
    'Build paths of code between the letters. The moment a user can reach one of their stops, they walk there on their own, in any order they can manage.',
    'A user who finishes their whole list exits and scores you a point. One is a win. Every user is a perfect run.',
  ]],
  ['TURNS', [
    'Tap a cell, then pick an action from the bar at the bottom. Each button shows its cost in turns.',
    'Users move while you work: after every turn you spend, each walking user takes one step, and new users keep arriving on a schedule.',
    'Users are not patient. Each turn one of them stands stuck, they lose one patience, and it never comes back. A user who runs out leaves for good.',
    'There is one way to win patience back: a user who reaches one of their stops, with more still to visit, gets half the bar back.',
    'Tap the WAITING counter any time to see each user by name, which stops they still owe (arrows mean the order is fixed), and how many turns they have left.',
  ]],
  ['WRITE CODE', [
    'PLACE writes one tile of code by hand. One turn. It must touch code already built. Hand-written code never has bugs.',
    'GENERATE asks the AI for code. One turn buys a whole block. Rotate it if you like, then drop it on a highlighted anchor.',
    'You cannot preview a block and you cannot reject one. And every block contains bugs: at least two defects, hidden inside. The game tells you how many, not where.',
  ]],
  ['THE BUGS', [
    'A defect explodes when a user steps on it, or when you analyze it. The blast turns nearby code back into open ocean, including yours, and kills any user standing in it.',
    'The numbers on the board are how you find defects first. Each number counts the defects in the eight cells touching it.',
    'Your hand tiles show a number too, so building next to AI code is a safe way to probe it. A blank hand tile means zero: nothing dangerous beside it.',
    'The badge on each block counts the defects still in that block.',
  ]],
  ['REVIEW', [
    'ANALYZE reviews one cell of AI code. One turn.',
    'If the cell is clean, it flips over and shows its number. If that number is zero, its neighbours open too, free.',
    'If the cell is a defect, it explodes. The numbers are there so you can know before you click.',
    'FLAG is free and reversible. Mark a cell you do not trust and users will refuse to walk through it.',
    'A flag can also close your only road. When your flag is the one thing keeping stuck users from their next stop, it glows red: the guardrail has become the roadblock.',
  ]],
  ['BETAS', [
    'You get a few beta releases per run. The BETA button counts them down.',
    'A beta is one tile, one turn, placed like a hand tile. Users walk out to a beta and wait there instead of standing at A. That keeps them moving and stages them closer to their next stop, but it does not score. Only finishing the list scores.',
    'Careful: users will cross unreviewed AI code to reach a beta.',
  ]],
  ['CONTROLS', [
    'Tap a cell to select it, then act from the bar at the bottom. Or stay on the keyboard: arrow keys move the selection, and every button wears its key. P places, G generates, A analyzes, F flags, B ships a beta, W waits, Space runs.',
    'R rotates a block, Enter commits it, Esc deselects.',
    'Drag to pan. Pinch, scroll, or the + and − buttons to zoom. Tap the minimap to jump anywhere.',
    'WAIT passes one turn without building. RUN keeps passing turns until something needs your attention.',
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
 * Backing-store pixels per map cell. Three, not one: the endpoints and the texture pixels
 * below need a centre a cell can spare, and CSS does the rest of the scaling with
 * `image-rendering: pixelated`, the same way the board itself is blown up (SPEC §10.8).
 */
const THUMB_PX = 3;

/**
 * A level's portrait, drawn from its parsed charmap in the board's own palette: ocean,
 * volcano, red endpoints, and a coastline traced on the VOID cells that touch playable
 * ground. It is re-drawn from the map string on every open of the start screen, so a level
 * edit is a card edit — there is no thumbnail asset anywhere to fall out of date.
 * Exported like `replayUrl` and `shareText`: a pure function of its arguments that a Node
 * script can drive with a mock canvas, which is the only kind of check a UI module gets.
 * @param {HTMLCanvasElement} canvas
 * @param {ParsedMap} m
 */
export function drawThumb(canvas, m) {
  const S = THUMB_PX;
  // One virtual cell of margin all round, with everything off-map read as VOID, so the
  // coastline closes even where playable cells run to the array edge — a level authored
  // without its own border of '.' rows still gets a complete silhouette.
  const x0 = m.bbox.x0 - 1, y0 = m.bbox.y0 - 1;
  const w = m.bbox.x1 - x0 + 2, h = m.bbox.y1 - y0 + 2;
  canvas.width = w * S;
  canvas.height = h * S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  /** @param {number} x @param {number} y @returns {import('../core/state.js').Terrain} */
  const at = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? 'void' : m.terrain[y * m.w + x];

  for (let vy = 0; vy < h; vy++) {
    for (let vx = 0; vx < w; vx++) {
      const x = x0 + vx, y = y0 + vy;
      const t = at(x, y);
      if (t === 'void') {
        // The coastline: a VOID cell touching playable ground on any of its eight sides.
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++) {
          for (let dx = -1; dx <= 1 && !touches; dx++) {
            if ((dx || dy) && at(x + dx, y + dy) !== 'void') touches = true;
          }
        }
        if (!touches) continue;              // open void stays the card's own dark
        ctx.fillStyle = PALETTE.COAST;
        ctx.fillRect(vx * S, vy * S, S, S);
        continue;
      }
      ctx.fillStyle = t === 'volcano' ? PALETTE.VOLCANO : PALETTE.OCEAN;
      ctx.fillRect(vx * S, vy * S, S, S);
      // Texture, deterministic per cell so a card never shimmers between opens: sparse
      // dither on ocean, sparse lava speckle on volcano — the board's own idioms in one pixel.
      if (t === 'ocean' && (x * 7 + y * 13) % 11 === 0) {
        ctx.fillStyle = PALETTE.OCEAN_DITHER;
        ctx.fillRect(vx * S + 1, vy * S + 1, 1, 1);
      } else if (t === 'volcano' && (x * 5 + y * 3) % 7 === 0) {
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(vx * S + 1, vy * S + 1, 1, 1);
      }
    }
  }

  // Endpoints over everything, red like the board's. The origin gets a user-yellow centre —
  // it is where everybody comes from, and the one cell a glance should find first.
  /** @param {number} cell @param {string} [centre] */
  const mark = (cell, centre) => {
    const x = (cell % m.w) - x0, y = ((cell / m.w) | 0) - y0;
    ctx.fillStyle = PALETTE.RED;
    ctx.fillRect(x * S, y * S, S, S);
    if (centre) {
      ctx.fillStyle = centre;
      ctx.fillRect(x * S + 1, y * S + 1, 1, 1);
    }
  };
  for (const d of m.dests) mark(d);
  mark(m.origin, PALETTE.USER);
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
    // `ticks` is what the reducer counts and what EndFacts carries; TURNS is what a person
    // reading a shared score understands. The rename is display-only, everywhere (2026-08-05).
    `${f.ticks} TURNS`,
    replayUrl(f),
  ].join(' · ');
}

/**
 * @typedef {object} StartHandlers
 * @property {string[]} levels          registered level ids, in registry order
 * @property {() => string} getLevel    the level the game is booted on right now
 * @property {(id: string) => void} onLevel   open that level: continue its saved game if one
 *                                            is standing, a fresh game if not — main.js owns
 *                                            that choice (saves are one slot per level,
 *                                            2026-08-20). A card click is this, then the
 *                                            overlay closing over the board; since the bar's
 *                                            dropdown became a door to this screen, the
 *                                            cards are the only caller
 * @property {(id: string) => { tick: number, served: number, total: number } | null} getResume
 *                                            the slot's summary when the level holds a game
 *                                            underway — what the CONTINUE badge wears. Null
 *                                            for no save, a finished one, an untouched
 *                                            tick-0 board (what RESTART leaves), or one that
 *                                            no longer parses
 * @property {() => void} onRestart     replay the level that just ended
 */

/**
 * @typedef {object} Overlays
 * @property {() => void} open       the front door
 * @property {() => void} help       the "?" in the HUD
 * @property {(f: EndFacts) => void} end
 * @property {() => void} close
 * @property {() => boolean} isOpen  any of the four is up: the keyboard is not the board's
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
      <h1>SLOPSWEEPER</h1>
      <p class="premise"></p>
      <div id="start-levels"></div>
      <div class="overlay-actions">
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

  const grid = /** @type {HTMLElement} */ (start.querySelector('#start-levels'));
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

  /**
   * Rebuilt on every open rather than cached: ten cards of a few thousand pixels each is
   * nothing, and it is what keeps a thumbnail a live read of the level definition instead of
   * a copy that was right once. The current level's card is marked, because it is the game
   * Esc backs out to.
   */
  function buildCards() {
    const current = h.getLevel();
    grid.innerHTML = '';
    h.levels.forEach((id, i) => {
      const def = levelById(id);
      const m = parseMap(def.map);

      const card = /** @type {HTMLButtonElement} */ (make('button', 'level-card'));
      card.type = 'button';
      card.classList.toggle('current', id === current);

      const thumb = /** @type {HTMLCanvasElement} */ (make('canvas', 'level-thumb'));
      drawThumb(thumb, m);

      // Registry order is the difficulty arc (levels/index.js), so the cards are numbered:
      // the menu should say it is a curriculum, not a drawer of maps.
      const name = make('span', 'level-name', def.name.toUpperCase());
      name.prepend(make('i', undefined, String(i + 1).padStart(2, '0')));

      // The demand, on the card: §6.1's forecast argument starts at the menu — which level
      // you can face is a dosage judgement too, and users and stops are the dose.
      const stops = m.dests.length;
      const facts = make('span', 'level-facts',
        `${arrivalCount(def.arrivals)} USERS · ${stops} ${stops === 1 ? 'STOP' : 'STOPS'}`);

      card.append(thumb, name, facts);

      // The CONTINUE badge (owner request 2026-08-20, with the per-level slots): a level
      // holding an unfinished game says so on its card, with the score so far — served over
      // total is the number a player choosing which game to go finish actually wants. The
      // card still just calls onLevel; whether that resumes or restarts is main.js's call,
      // and the badge is a read of the same slot that call will read.
      const resume = h.getResume(id);
      if (resume) {
        card.classList.add('saved');
        card.append(make('span', 'level-resume', `CONTINUE · ${resume.served}/${resume.total}`));
        card.title = `Continue your saved game — turn ${resume.tick}, ${resume.served}/${resume.total} served`;
      } else {
        card.title = 'Start a new game';
      }

      // The blur is the HUD dropdown's fix (2026-08-05) applied here: a clicked button keeps
      // keyboard focus, and the next hotkey belongs to the board this card just revealed.
      card.addEventListener('click', () => { card.blur(); h.onLevel(id); show(null); });
      grid.append(card);
    });
  }

  function openStart() {
    buildCards();
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
      `${f.mapName.toUpperCase()} · ${f.ticks} TURNS · SEED ${f.seed}`;

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

    /**
     * Whether any of the four cards is up. main.js asks before letting a keystroke reach the
     * board: an end screen is a decision and the rules are a page of text, and neither is a
     * place where W should pass a turn on the game behind it. Read off the DOM rather than off
     * a flag of our own, because `show()` is already the single source of that truth.
     */
    isOpen: () => Object.values(panels).some((node) => !node.classList.contains('hidden')),
  };
}
