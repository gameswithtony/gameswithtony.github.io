// @ts-check
// Every tunable number in the game, one file (SPEC §10.2, PLAN §8). None of these is
// sacred except the structural ones marked SPEC — the sim (§13) tunes the rest.

// POINTS ECONOMY (user decision 2026-08-04). The stakeholder-confidence meter is gone, and
// with it CONFIDENCE_START, WAIT_DRAIN_PER_USER, DETONATE_HIT and SERVED_BONUS. Pressure is
// no longer a bar that empties: it is the users themselves. They run out of patience and
// leave, they die in blasts, and if every one of them is gone before a single arrival the
// level is lost. Score is users served. See SPEC §8 and PLAN §3 rulings 3/4/11.
export const RULES = Object.freeze({
  // Cumulative ticks a user will spend unable to move before it gives up and leaves for
  // good. Not consecutive: the count never resets, so a route that keeps stalling bleeds the
  // same user out over the whole game. Chosen empirically (PLAN §9); a level may override it
  // with `LevelDef.patience`.
  USER_PATIENCE: 20,
  BLAST_RADIUS: 1,            // tile + orthogonals (SPEC §5 baseline)
  // Every generation ships at least this many defects (user decision 2026-08-04, superseding
  // PLAN §3 ruling 6). A clean block made Generate strictly free, which removed the game's
  // central tension from that turn entirely. Placement-time floor only — a blast may take a
  // block below it and nothing puts it back. See `generate.rollMines`.
  MIN_BLOCK_DEFECTS: 2,
  // How many beta milestones a level lets the player ship (user decision 2026-08-05, SPEC
  // §4.7). A beta is an intermediate destination: users leave the origin for one as soon as
  // it is reachable and closer to B, walk to it, and camp there — which buys staging, never
  // patience, because camping is waiting like any other. Scarce on purpose: three is enough
  // to stage a long route in stages and nowhere near enough to breadcrumb it. Per-level
  // override with `LevelDef.betaSupply`; 0 turns the verb off for that level.
  BETA_SUPPLY: 3,
  // What reaching an intermediate destination gives back, as a fraction of the level's
  // patience (user decision 2026-08-05, SPEC §6). A user with more stops to make has its
  // cumulative `waited` cut by `round(patience × DEST_REFILL)` — half a bar, floored at zero.
  //
  // Half is chosen to make the multi-stop itinerary *possible* without making it free. A user
  // carrying three destinations has to survive three legs on one patience budget; without a
  // refill the second leg is walked by someone who has already spent whatever the first leg
  // cost them, and a long itinerary would simply be a slower way of losing that user. A full
  // refill is the other failure — it would make every extra stop a free extension of the
  // clock, and a level would get *easier* the more it asked for. Half keeps arriving somewhere
  // worth something and keeps the whole trip finite. Per-level override: `LevelDef.destRefill`.
  DEST_REFILL: 0.5,
  USER_MOVE_EVERY: 1,         // OPEN #1
  ART_PX_PER_TILE: 16,        // SPEC §10.8 (revised 2026-08-04: finer art grid, calmer tiles)
  FONT_MIN_DEVICE_PX: 10,     // zoom tiers derive from this, never tuned apart (SPEC §10.8)
  ZOOM_MAX_ARTPX: 6,          // 16 × 6 = 96 device px per tile, the same ceiling as before
  TAP_SLOP_CSS: 6,
  TAP_MS: 250,
  STEP_TWEEN_MS: 120,         // view only
  FF_INTERVAL_MS: 180,        // view only
});

/**
 * One user's itinerary as the level writes it down (rev. 2026-08-05, owner decision — opt-in
 * ordered visitation). The bare `string[]` is the original form and means exactly what it
 * always meant: these stops, in any order the walk finds convenient. The object form is the
 * opt-in: `ordered: true` says the list is a **sequence**, and the user owes `stops[0]` and
 * nothing else until it has stood on it (SPEC §6.5).
 *
 * A union rather than a second field on LevelDef, because orderedness is a property of one
 * itinerary and not of the level: `delta` carries two loose lists and one sequence, and a
 * level-wide flag could not say that. `{ stops }` with no `ordered` is the loose form spelled
 * the long way, which is deliberate — an author converting a list into a sequence should have
 * to type the word.
 * @typedef {string[] | { stops: string[], ordered?: boolean }} Itinerary
 */

/**
 * **One member of the cast** (owner decision 2026-08-05 — the walker cast list, SPEC §6.6).
 *
 * An `Itinerary` answers "where does this user go". A `WalkerDef` answers "who is this user",
 * which is a bigger question by exactly one field today and is the shape that has room for the
 * next one. `stops` and `ordered` are an itinerary's, spelled the object way and validated by
 * the identical code; `patience` is the new part — a walker who will wait less, or more, than
 * the level's own bar.
 *
 * It is a separate typedef rather than a third arm of `Itinerary` because the two are used at
 * different moments: an itinerary is a list a level writes down, and a WalkerDef is a **role
 * that gets cast** — the pool is dealt against the arrival count at init, and the entry that
 * comes out is a person rather than a route. `itineraries` levels are read as a pool of
 * WalkerDefs with no patience override, so there is exactly one thing downstream of the deal.
 * @typedef {object} WalkerDef
 * @property {string[]} stops       destination letters, exactly an itinerary's
 * @property {boolean} [ordered]    visit them in the authored sequence (SPEC §6.5)
 * @property {number} [patience]    this walker's own bar; absent means the level's
 */

/**
 * **The arrival schedule, in either of its two shapes** (owner decision 2026-08-05, SPEC §6.1).
 *
 * `{ count, firstTick, every }` is the cadence form and the original: N users, evenly spaced.
 * `{ at: [...] }` is the explicit form: these turns, exactly, and the list's length is the
 * count. A level writes one or the other, never a mixture — the validator refuses a definition
 * carrying fields from both rather than guessing which one the author meant, because guessing
 * would silently ship a schedule nobody wrote.
 *
 * The absent-key arms (`at?: undefined` on the cadence form and so on) are not decoration:
 * they make this a discriminated union that reading code may interrogate — `a.at ? … : …` —
 * without a cast at every site.
 * @typedef {{ count: number, firstTick: number, every: number, at?: undefined }
 *   | { at: number[], count?: undefined, firstTick?: undefined, every?: undefined }} Arrivals
 */

/**
 * Defaults for every optional LevelDef field (PLAN §6). `levels/index.js` applies them;
 * they live here so there is exactly one place a number is written down.
 *
 * `cast` is the one member that is not a default and not authored: it is **resolved per init
 * from (LevelDef, seed)** and lives here because LevelParams is the one thing that already
 * hangs off a game for its whole life without being inside `GameState` (state.js). Putting it
 * in the state would have been a save-shape change for data that is a pure function of two
 * things the save already carries, which is why it is not there — see `casting.js`.
 * @typedef {object} LevelParams
 * @property {Arrivals} arrivals
 * @property {number} mineDensity
 * @property {number} patience
 * @property {number} betaSupply
 * @property {Itinerary[]} itineraries  destination letters per user, as the level authored them
 * @property {WalkerDef[]} walkers      the explicit cast, as the level authored it
 * @property {WalkerDef[]} cast         RESOLVED: entry k is the walker spawn k gets, this seed
 * @property {number} destRefill       patience returned on reaching an intermediate stop
 * @property {string | string[]} shapePool  a preset name, a `+`-joined union of preset
 *   names (`'compact+awkward'` — see shapes.poolShapes), or an explicit array of shape ids
 * @property {number} userMoveEvery
 * @property {number} blastRadius
 */

// The annotation pins `arrivals` to the cadence arm rather than leaving it the union, because
// **the defaults are always a cadence** and several readers legitimately want `.count` without
// asking which shape they are holding (`levels/index.js` merges partial overrides into it; the
// Level Lab fills its three number fields from it). A level may write the other shape; the
// fallback never does, and saying so here is what keeps those readers honest instead of casting.
/** @type {Omit<LevelParams, 'arrivals'> & { arrivals: { count: number, firstTick: number, every: number } }} */
export const LEVEL_DEFAULTS = Object.freeze({
  arrivals: Object.freeze({ count: 10, firstTick: 6, every: 4 }),
  // 0.25 → 0.14 with the block rescale, then → 0.18 when Analyze became a single click:
  // a bulk-8 reveal made dense blocks cheap to read, and one click at a time does not, so
  // the puzzle can afford to be a puzzle again. A 16-cell block now carries ~3 defects.
  // The corpus runs 0.15–0.16 (PLAN §9); the validator warns outside 0.10–0.40.
  mineDensity: 0.16,
  shapePool: 'compact',
  patience: RULES.USER_PATIENCE,
  betaSupply: RULES.BETA_SUPPLY,
  // EMPTY MEANS EVERY DESTINATION (2026-08-05). A level that lists no itineraries hands every
  // user the whole map's list, which on a one-destination level is the list it always had —
  // that is the mechanism by which the six shipped levels play byte-for-byte as they did, and
  // it is why the default is `[]` rather than something clever like `[['B']]`.
  itineraries: Object.freeze([]),
  // EMPTY MEANS THE SAME THING TWICE (2026-08-05). `walkers` is the newer way to say what
  // `itineraries` says, so its default is empty for the same reason and with the same effect:
  // a level that lists neither is cast from the implicit every-destination role. `cast` is
  // empty here because LEVEL_DEFAULTS is also the fallback `levelParams()` hands back for a
  // state whose parameters were never associated — a revived save the UI has not re-linked
  // yet — and an empty cast is what makes `spawns` fall through to every destination, which is
  // the game those states came from.
  walkers: Object.freeze([]),
  cast: Object.freeze([]),
  destRefill: RULES.DEST_REFILL,
  userMoveEvery: RULES.USER_MOVE_EVERY,
  blastRadius: RULES.BLAST_RADIUS,
});
