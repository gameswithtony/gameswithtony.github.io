// State machine, turn orchestration, scoring (SPEC §4). Owns all simulation
// state. Emits events (drained by main) for audio/effects. Never draws,
// never reads the camera (Invariant 2).
//
// Reset model: every round is a new world (the original GORILLA.BAS
// structure — MakeCityScape ran at the top of every game). startRound()
// regenerates the city, re-places the gorillas, re-rolls wind, and clears all
// per-round state (banana, AI correction memory).
// newMatch() additionally resets scores and the match seed. Damage persists
// between turns WITHIN a round only.

import * as C from './config.js';
import { createRng, randomSeed } from './rng.js';
import { createFlight, runFlight } from './physics.js';
import * as terrain from './terrain.js';
import * as ai from './ai.js';

const S = {
  mode: 'MENU',        // MENU SETUP ROUND_INTRO AIM FLIGHT RESOLVE ROUND_END GAME_OVER
  time: 0,
  timer: 0,
  seed: 0,
  rng: createRng(1),
  settings: null,
  players: [],
  wind: 0,
  windAtThrow: 0,
  round: 0,
  turn: 0,
  nextThrower: 0,
  aim: [{ angle: 45, power: 55 }, { angle: 45, power: 55 }],
  banana: null,
  aiMem: null,
  aiPlanned: false,
  aiFireAt: 0,
  sun: { x: 0, y: 55, shocked: false },
  roundWinner: -1,
  matchWinner: -1,
  resolveAction: null,
  events: [],
};

let flight = null;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const emit = (type, data = {}) => S.events.push({ type, ...data });

export const getState = () => S;
export const activeIdx = () => S.turn;
export const isHumanTurn = () => S.mode === 'AIM' && S.players.length > 0 && !S.players[S.turn].isAI;

export function drainEvents() {
  const out = S.events;
  S.events = [];
  return out;
}

function gorillaRect(idx) {
  const p = S.players[idx];
  return {
    player: idx,
    x0: p.x - C.GORILLA_W / 2,
    y0: p.feetY - C.GORILLA_H,
    x1: p.x + C.GORILLA_W / 2,
    y1: p.feetY,
    alive: p.alive,
  };
}

function launchPos(idx) {
  const p = S.players[idx];
  return { x: p.x + p.facing * 8, y: p.feetY - C.GORILLA_H - 6 };
}

// The one place flight parameters are assembled. The real throw and the AI's
// forward simulation both come through here, so they cannot disagree
// (Invariant 5 / §17 exact-prediction check).
function buildFlightOpts(idx, angleFacingRel, power) {
  const p = S.players[idx];
  const worldAngle = p.facing === 1 ? angleFacingRel : 180 - angleFacingRel;
  const lp = launchPos(idx);
  return {
    x: lp.x,
    y: lp.y,
    angleDeg: worldAngle,
    power,
    wind: S.wind,
    gravity: S.settings.gravity,
    solidAt: terrain.solidAt,
    gorillas: [gorillaRect(0), gorillaRect(1)],
    shooter: idx,
  };
}

function rollWind() {
  if (S.settings.windMode === 'none') { S.wind = 0; return; }
  const r = S.rng;
  let w = r.range(-40, 40);
  if (r.chance(1 / 3)) w += Math.sign(w || 1) * r.range(10, 60);
  S.wind = clamp(w, -C.WIND_MAX, C.WIND_MAX);
  emit('windChange', { wind: S.wind });
}

export function toMenu() {
  S.mode = 'MENU';
  S.players = [];
  S.banana = null;
  flight = null;
  S.sun = { x: C.WORLD_W / 2, y: 55, shocked: false };
  const seed = randomSeed();
  terrain.generate(seed);
  emit('cityChange', { seed });
}

export function newMatch(settings) {
  S.settings = settings;
  S.seed = randomSeed();
  S.rng = createRng(S.seed ^ 0x9e3779b9);   // game stream, distinct from terrain's

  S.players = settings.names.map((name, i) => ({
    name,
    isAI: settings.ai && i === 1,
    score: 0,
    alive: true,
    x: 0,            // placed by startRound
    feetY: 0,
    facing: i === 0 ? 1 : -1,
    throwPoseUntil: 0,
  }));

  S.aim = [{ angle: 45, power: 55 }, { angle: 45, power: 55 }];
  S.round = 0;
  S.nextThrower = 0;
  S.matchWinner = -1;
  emit('matchStart', { seed: S.seed });
  startRound();
}

export function rematch() {
  newMatch(S.settings);
}

// Every round is a new world (§4.1): fresh city, fresh rooftops, fresh wind.
// Only the score line carries across rounds.
function startRound() {
  S.round++;

  // Derive the round's city from the match rng stream so a match seed still
  // reproduces the same sequence of skylines.
  const citySeed = Math.floor(S.rng.next() * 0xffffffff) >>> 0;
  const { gorillaSpawns } = terrain.generate(citySeed);
  emit('cityChange', { seed: citySeed });

  S.players.forEach((p, i) => {
    p.alive = true;
    p.x = gorillaSpawns[i].x;
    p.feetY = gorillaSpawns[i].feetY;
    p.facing = i === 0 ? 1 : -1;
    p.throwPoseUntil = 0;
  });

  S.sun = {
    x: (S.players[0].x + S.players[1].x) / 2,
    y: 55,
    shocked: false,
  };
  S.banana = null;
  flight = null;
  S.aiMem = ai.createAiState();     // new geometry — corrections start over
  S.roundWinner = -1;
  S.turn = S.nextThrower;
  rollWind();
  S.mode = 'ROUND_INTRO';
  S.timer = S.time + 1.4;
  emit('roundStart', { round: S.round });
}

function enterAim() {
  S.mode = 'AIM';
  S.sun.shocked = false;
  S.aiPlanned = false;
  S.aiFireAt = S.time + 0.9 + S.rng.range(0, 0.9);
}

export function setAim(idx, angle, power) {
  S.aim[idx] = {
    angle: clamp(angle, 0, 360),
    power: clamp(power, 1, 100),
  };
}

export function submitAim(angle, power) {
  if (S.mode !== 'AIM') return;
  setAim(S.turn, angle, power);
  const a = S.aim[S.turn];
  S.windAtThrow = S.wind;
  flight = createFlight(buildFlightOpts(S.turn, a.angle, a.power));
  S.banana = {
    prev: { x: flight.prev.x, y: flight.prev.y },
    cur: { x: flight.cur.x, y: flight.cur.y },
    vx: flight.cur.vx,
    vy: flight.cur.vy,
    rot: 0,
    escaped: false,
    boomerang: false,
  };
  S.players[S.turn].throwPoseUntil = S.time + 0.4;
  S.mode = 'FLIGHT';
  emit('throw', { player: S.turn });
}

function aiTakeTurn() {
  const me = S.turn;
  const other = 1 - me;
  const env = {
    meX: S.players[me].x,
    targetX: S.players[other].x,
    targetIdx: other,
    shooterIdx: me,
    dir: S.players[me].facing,
    wind: S.wind,
    gravity: S.settings.gravity,
    difficulty: S.settings.difficulty,
    rng: S.rng,
    mem: S.aiMem,
    simulate: (a, p) => runFlight(buildFlightOpts(me, a, p)),
  };
  const shot = ai.computeShot(env);
  S.aim[me] = { angle: Math.round(shot.angle), power: Math.round(shot.power) };
  S.aiPlanned = true;
}

function reportToAi(outcome, time) {
  const thrower = S.turn;
  if (!S.players[thrower].isAI) return;
  const other = 1 - thrower;
  ai.observe(S.aiMem, {
    angle: S.aim[thrower].angle,
    power: S.aim[thrower].power,
    wind: S.windAtThrow,
    time,
    outcome,
    meX: S.players[thrower].x,
    targetX: S.players[other].x,
    targetIdx: other,
    dir: S.players[thrower].facing,
  });
}

function endFlight(outcome) {
  reportToAi(outcome, flight ? flight.t : 0);
  S.nextThrower = 1 - S.turn;
}

function explodeAt(x, y) {
  const color = terrain.buildingColorAt(x, y);
  terrain.carve(x, y, C.EXPLOSION_R);
  emit('explode', { x, y, color });
}

function resolveImpact(outcome) {
  endFlight(outcome);

  if (outcome.type === 'gone') {
    // Hold briefly so the miss registers, then move on (§10.2).
    emit('gone', { x: outcome.x });
    S.banana = null;
    S.mode = 'RESOLVE';
    S.timer = S.time + 0.45;
    S.resolveAction = 'advance';
    return;
  }

  explodeAt(outcome.x, outcome.y);
  S.banana = null;

  if (outcome.type === 'gorilla') {
    const victim = outcome.player;
    const winner = victim === S.turn ? 1 - S.turn : S.turn;
    const selfHit = victim === S.turn;
    S.players[victim].alive = false;
    S.players[winner].score++;
    S.roundWinner = winner;
    emit('gorillaHit', { player: victim, x: outcome.x, y: outcome.y, selfHit });

    if (S.players[winner].score >= S.settings.playTo) {
      S.matchWinner = winner;
      S.mode = 'GAME_OVER';
      emit('matchEnd', { winner, selfHit });
    } else {
      S.mode = 'ROUND_END';
      S.timer = S.time + 3.4;
      emit('roundEnd', { winner, selfHit });
    }
    return;
  }

  // Terrain or ground: watch the dust settle, then next turn.
  S.mode = 'RESOLVE';
  S.timer = S.time + 0.75;
  S.resolveAction = 'advance';
}

function advanceTurn() {
  S.turn = S.nextThrower;
  if (S.settings.windMode === 'gusty') rollWind();
  enterAim();
}

function stepFlight() {
  if (!flight) return;
  const events = flight.stepOnce();

  const b = S.banana;
  b.prev.x = flight.prev.x;
  b.prev.y = flight.prev.y;
  b.cur.x = flight.cur.x;
  b.cur.y = flight.cur.y;
  b.vx = flight.cur.vx;
  b.vy = flight.cur.vy;
  b.rot = Math.floor(flight.t * 10) % 4;   // the original's spin timing
  b.escaped = flight.escaped;
  b.boomerang = flight.boomerang;

  // The sun is scenery with a reaction, not an obstacle (§8.2). Checked after
  // terrain, so a banana "at" the sun inside a building hits the building.
  if (!S.sun.shocked) {
    const dx = flight.cur.x - S.sun.x;
    const dy = flight.cur.y - S.sun.y;
    const r = C.SUN_R + C.BANANA_DRAW_R;
    if (dx * dx + dy * dy < r * r) {
      S.sun.shocked = true;
      emit('sunHit', {});
    }
  }

  for (const ev of events) {
    if (ev.type === 'exit') emit('exit', { boomerang: ev.boomerang });
    if (ev.type === 'reenter') emit('reenter', {});
  }

  if (flight.done) {
    resolveImpact(flight.outcome);
    flight = null;
  }
}

// Advances exactly one fixed DT (Invariant 4). main.js owns the accumulator.
export function tick(dt) {
  S.time += dt;
  switch (S.mode) {
    case 'ROUND_INTRO':
      if (S.time >= S.timer) enterAim();
      break;
    case 'AIM':
      if (S.players[S.turn] && S.players[S.turn].isAI) {
        if (!S.aiPlanned) aiTakeTurn();
        else if (S.time >= S.aiFireAt) submitAim(S.aim[S.turn].angle, S.aim[S.turn].power);
      }
      break;
    case 'FLIGHT':
      stepFlight();
      break;
    case 'RESOLVE':
      if (S.time >= S.timer && S.resolveAction === 'advance') {
        S.resolveAction = null;
        advanceTurn();
      }
      break;
    case 'ROUND_END':
      if (S.time >= S.timer) startRound();
      break;
    default:
      break;
  }
}
