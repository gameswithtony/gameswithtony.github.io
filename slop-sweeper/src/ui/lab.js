// @ts-check
// The Level Lab (PLAN §9.2): paste a charmap → validate → play → quick-sim → export a
// finished `levels/<id>.js`. A dev overlay behind `?lab=1`, built only when asked for.
//
// It is DOM and nothing else. Core never learns the Lab exists: validation is core's own
// `validateLevel`, Play boots the pasted definition through the same `init()` a registered
// level uses, and the quick-sim is the *same* `runGames` the Node CLI runs — the direct
// payoff of a DOM-free core (SPEC §10.2).

import { LEVEL_DEFAULTS } from '../core/rules.js';
import { validateLevel } from '../core/validate.js';
import { POOLS } from '../core/shapes.js';
import { median, runGames } from '../sim/batch.js';

/** @typedef {import('../levels/index.js').LevelDef} LevelDef */

const STORE_KEY = 'slop-sweeper.lab';

/** Games per policy, and the two policies. Fifty each is a few seconds in a browser tab. */
const SIM_GAMES = 50;
const SIM_CHUNK = 5;
const SIM_POLICIES = ['handOnly', 'balanced:0.4'];
/** Matches runGames' own stride, so chunking reproduces the un-chunked seed sequence. */
const SEED_STRIDE = 0x9e3779b1;

/** The pool grammar levels actually use: presets plus the `+` unions (see core/shapes.js). */
const POOL_CHOICES = [
  'compact', 'awkward', 'heavy',
  'compact+awkward', 'compact+heavy', 'awkward+heavy', 'compact+awkward+heavy',
];

const STARTER_MAP = [
  '##########',
  '#####..###',
  'A####..###',
  '#####..###',
  '########B#',
  '##########',
].join('\n');

/** localStorage is never load-bearing (PLAN §4). */
const store = {
  /** @param {string} k @returns {string | null} */
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  /** @param {string} k @param {string} v */
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/**
 * @typedef {object} LabHandlers
 * @property {() => number} getSeed          the seed Play should boot with
 * @property {() => LevelDef} getLevel       whatever is on the board now, for "load current"
 * @property {(def: LevelDef, seed?: number) => void} onPlay
 */

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
 * @param {LabHandlers} h
 */
export function createLab(h) {
  const open = /** @type {HTMLButtonElement} */ (make('button'));
  open.id = 'lab-open';
  open.textContent = 'LAB';
  open.title = 'Level Lab (PLAN §9.2)';

  const panel = make('div', 'hidden');
  panel.id = 'lab';
  panel.innerHTML = `
    <div class="lab-head">
      <h2>LEVEL LAB</h2>
      <span class="hint">paste → validate → play → quick-sim → export</span>
      <button id="lab-close">CLOSE</button>
    </div>
    <div class="lab-body">
      <textarea id="lab-map" spellcheck="false" autocomplete="off" wrap="off"
        aria-label="charmap"></textarea>
      <div class="lab-fields">
        <label for="lab-id">ID</label><input id="lab-id" type="text" autocomplete="off">
        <label for="lab-name">NAME</label><input id="lab-name" type="text" autocomplete="off">
        <label for="lab-count">ARRIVALS</label><input id="lab-count" type="number" min="1" step="1">
        <label for="lab-first">FIRST TICK</label><input id="lab-first" type="number" min="0" step="1">
        <label for="lab-every">EVERY</label><input id="lab-every" type="number" min="1" step="1">
        <label for="lab-density">DENSITY</label><input id="lab-density" type="number" min="0" max="1" step="0.01">
        <label for="lab-pool">POOL</label><select id="lab-pool"></select>
        <label for="lab-analyze">ANALYZE</label><input id="lab-analyze" type="number" min="1" step="1">
        <label for="lab-move">MOVE EVERY</label><input id="lab-move" type="number" min="1" step="1">
        <label for="lab-blast">BLAST R</label><input id="lab-blast" type="number" min="0" step="1">
      </div>
    </div>
    <div class="lab-actions">
      <button id="lab-validate">VALIDATE</button>
      <button id="lab-play">PLAY</button>
      <button id="lab-sim">QUICK-SIM</button>
      <button id="lab-export">EXPORT</button>
      <button id="lab-load">LOAD CURRENT</button>
      <button id="lab-reset">RESET</button>
    </div>
    <pre id="lab-out"></pre>`;

  document.body.append(open, panel);

  const $ = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ (panel.querySelector(`#${id}`));
  const map = /** @type {HTMLTextAreaElement} */ (panel.querySelector('#lab-map'));
  const pool = /** @type {HTMLSelectElement} */ (panel.querySelector('#lab-pool'));
  const out = /** @type {HTMLElement} */ (panel.querySelector('#lab-out'));

  for (const name of POOL_CHOICES) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${name.split('+').reduce((n, p) => n + (POOLS[p]?.length ?? 0), 0)})`;
    pool.append(opt);
  }

  const fields = {
    id: $('lab-id'), name: $('lab-name'),
    count: $('lab-count'), first: $('lab-first'), every: $('lab-every'),
    density: $('lab-density'), analyze: $('lab-analyze'), move: $('lab-move'), blast: $('lab-blast'),
  };

  // --- draft --------------------------------------------------------------------------

  function defaults() {
    map.value = STARTER_MAP;
    fields.id.value = 'lab';
    fields.name.value = '';
    fields.count.value = String(LEVEL_DEFAULTS.arrivals.count);
    fields.first.value = String(LEVEL_DEFAULTS.arrivals.firstTick);
    fields.every.value = String(LEVEL_DEFAULTS.arrivals.every);
    fields.density.value = String(LEVEL_DEFAULTS.mineDensity);
    pool.value = String(LEVEL_DEFAULTS.shapePool);
    fields.analyze.value = String(LEVEL_DEFAULTS.analyzeReveals);
    fields.move.value = String(LEVEL_DEFAULTS.userMoveEvery);
    fields.blast.value = String(LEVEL_DEFAULTS.blastRadius);
  }

  function saveDraft() {
    store.set(STORE_KEY, JSON.stringify({
      map: map.value,
      id: fields.id.value, name: fields.name.value,
      count: fields.count.value, first: fields.first.value, every: fields.every.value,
      density: fields.density.value, pool: pool.value,
      analyze: fields.analyze.value, move: fields.move.value, blast: fields.blast.value,
    }));
  }

  function loadDraft() {
    defaults();
    const raw = store.get(STORE_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (typeof d?.map === 'string') map.value = d.map;
      for (const [k, node] of /** @type {[string, HTMLInputElement][]} */ (Object.entries(fields))) {
        if (typeof d?.[k] === 'string') node.value = d[k];
      }
      if (typeof d?.pool === 'string' && POOL_CHOICES.includes(d.pool)) pool.value = d.pool;
    } catch { /* a corrupt draft is not worth a crash */ }
  }

  /** @param {LevelDef} def */
  function fill(def) {
    const a = def.arrivals ?? LEVEL_DEFAULTS.arrivals;
    map.value = def.map.replace(/^\n+|\n+$/g, '');
    fields.id.value = def.id;
    fields.name.value = def.name && def.name !== def.id ? def.name : '';
    fields.count.value = String(a.count);
    fields.first.value = String(a.firstTick);
    fields.every.value = String(a.every);
    fields.density.value = String(def.mineDensity ?? LEVEL_DEFAULTS.mineDensity);
    const p = String(def.shapePool ?? LEVEL_DEFAULTS.shapePool);
    // `'compact+'` and friends are legal but not offered; they resolve to the trimmed name.
    pool.value = POOL_CHOICES.includes(p) ? p : (POOL_CHOICES.find((c) => c === p.replace(/\+$/, '')) ?? 'compact');
    fields.analyze.value = String(def.analyzeReveals ?? LEVEL_DEFAULTS.analyzeReveals);
    fields.move.value = String(def.userMoveEvery ?? LEVEL_DEFAULTS.userMoveEvery);
    fields.blast.value = String(def.blastRadius ?? LEVEL_DEFAULTS.blastRadius);
    saveDraft();
  }

  // --- the definition under construction ------------------------------------------------

  /**
   * A blank number field means "use the default", which is the same thing a level file
   * means by leaving the key out. Anything non-numeric is passed through as NaN so the
   * validator gets to name the field rather than the Lab quietly repairing it.
   * @param {HTMLInputElement} node
   * @param {number} fallback
   * @returns {number}
   */
  function num(node, fallback) {
    const text = node.value.trim();
    return text === '' ? fallback : Number(text);
  }

  /** @returns {LevelDef} */
  function buildDef() {
    /** @type {LevelDef} */
    const def = {
      id: fields.id.value.trim(),
      map: map.value,
      arrivals: {
        count: num(fields.count, LEVEL_DEFAULTS.arrivals.count),
        firstTick: num(fields.first, LEVEL_DEFAULTS.arrivals.firstTick),
        every: num(fields.every, LEVEL_DEFAULTS.arrivals.every),
      },
      mineDensity: num(fields.density, LEVEL_DEFAULTS.mineDensity),
      // The '+' union grammar is wider than the typedef's literals, exactly as the authored
      // levels already are (caldera is 'compact+awkward'); resolvePool() is the real check.
      shapePool: /** @type {LevelDef['shapePool']} */ (pool.value),
      analyzeReveals: num(fields.analyze, LEVEL_DEFAULTS.analyzeReveals),
      userMoveEvery: num(fields.move, LEVEL_DEFAULTS.userMoveEvery),
      blastRadius: num(fields.blast, LEVEL_DEFAULTS.blastRadius),
    };
    if (fields.name.value.trim()) def.name = fields.name.value.trim();
    return def;
  }

  // --- output ---------------------------------------------------------------------------

  /** @param {[string, string][]} lines  [cssClass, text] */
  function print(lines) {
    out.innerHTML = '';
    for (const [cls, text] of lines) {
      const row = make('div', cls, text);
      out.append(row);
    }
    out.scrollTop = 0;
  }

  /**
   * @param {{ errors: string[], warnings: string[] }} r
   * @returns {[string, string][]}
   */
  function report(r) {
    /** @type {[string, string][]} */
    const lines = [];
    for (const e of r.errors) lines.push(['err', `ERROR   ${e}`]);
    for (const w of r.warnings) lines.push(['warn', `WARNING ${w}`]);
    if (!r.errors.length && !r.warnings.length) lines.push(['ok', 'VALID — no errors, no warnings']);
    else if (!r.errors.length) lines.push(['ok', 'VALID — warnings only, the level loads']);
    return lines;
  }

  function validate() {
    const r = validateLevel(buildDef());
    print(report(r));
    return r.errors.length === 0;
  }

  function play() {
    const def = buildDef();
    const r = validateLevel(def);
    if (r.errors.length) {
      print([['err', 'CANNOT PLAY — fix these first:'], ...report(r)]);
      return;
    }
    try {
      h.onPlay(def, h.getSeed());
      panel.classList.add('hidden');
      print([['ok', `PLAYING '${def.id}' at seed ${h.getSeed()}`]]);
    } catch (err) {
      print([['err', `INIT FAILED — ${/** @type {Error} */ (err).message}`]]);
    }
  }

  // --- quick-sim ------------------------------------------------------------------------

  let simming = false;

  /**
   * Runs the real batch runner in slices so the tab keeps painting. The slice seeds
   * reproduce `runGames(def, policy, SIM_GAMES, seed)` exactly, one chunk at a time.
   */
  async function quickSim() {
    if (simming) return;
    const def = buildDef();
    const r = validateLevel(def);
    if (r.errors.length) {
      print([['err', 'CANNOT SIM — fix these first:'], ...report(r)]);
      return;
    }
    simming = true;
    const seed = h.getSeed() >>> 0;
    /** @type {[string, string][]} */
    const lines = [['', `QUICK-SIM · ${SIM_GAMES} games × ${SIM_POLICIES.length} policies · seed ${seed} · solver off`]];
    print([...lines, ['', 'running…']]);
    const started = performance.now();

    try {
      for (const policy of SIM_POLICIES) {
        /** @type {import('../sim/batch.js').GameResult[]} */
        const games = [];
        for (let done = 0; done < SIM_GAMES; done += SIM_CHUNK) {
          const n = Math.min(SIM_CHUNK, SIM_GAMES - done);
          const chunkSeed = (seed + done * SEED_STRIDE) >>> 0;
          games.push(...runGames(def, policy, n, chunkSeed, { solver: false }).games_);
          print([...lines, ['', `running ${policy} — ${games.length}/${SIM_GAMES}`]]);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const wins = games.filter((g) => g.won);
        const dets = games.reduce((a, g) => a + g.detonations, 0) / games.length;
        lines.push(['', [
          policy.padEnd(14),
          `WIN ${String(Math.round((wins.length / games.length) * 100)).padStart(3)}%`,
          `MEDIAN ${String(median(wins.map((g) => g.ticks))).padStart(4)}t`,
          `DET ${dets.toFixed(1)}/game`,
        ].join('  ')]);
        print(lines);
      }
      lines.push(['ok', `done in ${((performance.now() - started) / 1000).toFixed(1)}s`]);
      print(lines);
    } catch (err) {
      print([...lines, ['err', `SIM FAILED — ${/** @type {Error} */ (err).message}`]]);
    } finally {
      simming = false;
    }
  }

  // --- export ---------------------------------------------------------------------------

  /**
   * @param {string} id
   * @returns {string} a legal JS binding name for the module's export
   */
  function constName(id) {
    const clean = id.replace(/[^A-Za-z0-9_$]/g, '_');
    return /^[A-Za-z_$]/.test(clean) ? clean : `_${clean}`;
  }

  /**
   * A finished level module, in the same shape as every file in `src/levels/` — the header
   * comment, the `@type` annotation, the template-literal map, and only the fields that
   * deviate from the defaults (PLAN §9.1: "level files state only what deviates").
   * @param {LevelDef} def
   * @returns {string}
   */
  function moduleSource(def) {
    const name = constName(def.id);
    const a = def.arrivals ?? LEVEL_DEFAULTS.arrivals;
    /** @type {string[]} */
    const lines = [];
    if (def.name) lines.push(`  name: '${def.name.replace(/'/g, "\\'")}',`);
    lines.push(`  map: \`\n${def.map.replace(/^\n+|\n+$/g, '')}\n\`,`);
    if (a.count !== LEVEL_DEFAULTS.arrivals.count || a.firstTick !== LEVEL_DEFAULTS.arrivals.firstTick
        || a.every !== LEVEL_DEFAULTS.arrivals.every) {
      lines.push(`  arrivals: { count: ${a.count}, firstTick: ${a.firstTick}, every: ${a.every} },`);
    }
    if (def.mineDensity !== undefined && def.mineDensity !== LEVEL_DEFAULTS.mineDensity) {
      lines.push(`  mineDensity: ${def.mineDensity},`);
    }
    if (def.shapePool !== undefined && def.shapePool !== LEVEL_DEFAULTS.shapePool) {
      lines.push(`  shapePool: '${def.shapePool}',`);
    }
    for (const [key, value, fallback] of /** @type {[string, number | undefined, number][]} */ ([
      ['analyzeReveals', def.analyzeReveals, LEVEL_DEFAULTS.analyzeReveals],
      ['userMoveEvery', def.userMoveEvery, LEVEL_DEFAULTS.userMoveEvery],
      ['blastRadius', def.blastRadius, LEVEL_DEFAULTS.blastRadius],
    ])) {
      if (value !== undefined && value !== fallback) lines.push(`  ${key}: ${value},`);
    }

    return [
      '// @ts-check',
      `// ${def.name ?? def.id} — drafted in the Level Lab (PLAN §9.2). Say what the shape is`,
      '// for, in one or two lines: what it tests, and which axis it leans on.',
      '',
      "/** @type {import('./index.js').LevelDef} */",
      `export const ${name} = {`,
      `  id: '${def.id}',`,
      ...lines,
      '};',
      '',
    ].join('\n');
  }

  /** @param {LevelDef} def @returns {string} */
  function registryLines(def) {
    const name = constName(def.id);
    return `import { ${name} } from './${def.id}.js';\nregister(${name});`;
  }

  async function exportModule() {
    const def = buildDef();
    const r = validateLevel(def);
    const source = `${moduleSource(def)}\n// src/levels/index.js — the import and the one registration line:\n${registryLines(def)}\n`;
    /** @type {[string, string][]} */
    const head = r.errors.length ? [['err', 'EXPORTED ANYWAY — this level does NOT load:'], ...report(r)] : [];
    let copied = false;
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
    } catch { /* no permission, or no clipboard: the text is printed below either way */ }
    print([
      ...head,
      [copied ? 'ok' : 'warn', copied
        ? `COPIED src/levels/${def.id}.js + its registry line to the clipboard`
        : 'CLIPBOARD BLOCKED — copy it from here:'],
      ['', source],
    ]);
  }

  // --- wiring ---------------------------------------------------------------------------

  const toggle = () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) map.focus();
  };

  open.addEventListener('click', toggle);
  /** @type {HTMLButtonElement} */ (panel.querySelector('#lab-close')).addEventListener('click', toggle);
  /** @type {HTMLButtonElement} */ (panel.querySelector('#lab-validate')).addEventListener('click', validate);
  /** @type {HTMLButtonElement} */ (panel.querySelector('#lab-play')).addEventListener('click', play);
  /** @type {HTMLButtonElement} */ (panel.querySelector('#lab-sim')).addEventListener('click', quickSim);
  /** @type {HTMLButtonElement} */ (panel.querySelector('#lab-export')).addEventListener('click', exportModule);
  /** @type {HTMLButtonElement} */ (panel.querySelector('#lab-load')).addEventListener('click', () => {
    fill(h.getLevel());
    print([['ok', 'loaded the level on the board']]);
  });
  /** @type {HTMLButtonElement} */ (panel.querySelector('#lab-reset')).addEventListener('click', () => {
    defaults();
    saveDraft();
    print([['ok', 'draft reset']]);
  });

  for (const node of [map, pool, ...Object.values(fields)]) {
    node.addEventListener('input', saveDraft);
    node.addEventListener('change', saveDraft);
  }
  // Esc closes the Lab rather than reaching the board's deselect.
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { panel.classList.add('hidden'); e.stopPropagation(); }
  });

  loadDraft();
  print([['', 'paste a charmap  ·  # ocean  ·  . or space void  ·  ^ volcano  ·  A origin  ·  B destination']]);

  return {
    open: () => { panel.classList.remove('hidden'); map.focus(); },
    close: () => panel.classList.add('hidden'),
  };
}
