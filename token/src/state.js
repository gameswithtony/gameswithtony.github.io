// state.js — the gameState shape and initState(classId, hires, model, seed).
//
// gameState is plain JSON-serializable data: no functions, no class instances,
// no Dates (PLAN.md §4.6). The RNG cursor (rngState) serializes into the save so
// a resumed run continues its seed exactly. Calibration is DERIVED (decay.js),
// never stored. No slider / contingency / member-burnout / stored-calibration
// fields (PLAN.md §1).

import { config } from '../config.js';
import { createRng } from './sim/rng.js';
import { getClass } from './data/classes.js';
import { beginMonth } from './sim/engine.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Resolve the floor value for a class's learning profile.
function classFloor(profile) {
  if (profile === 'watching') return config.floors.watching;
  // 'doing' and 'high' both floor at the doing value in WP1 (Craftsperson's
  // higher floors are a WP2 tuning detail on the class table).
  return config.floors.doing;
}

// Normalize a hire object into a team member. `und` is the TRUE hidden
// Understanding (WP2's candidate generator computes it from the resume);
// tests may pass it directly. morale defaults to 60.
function makeMember(hire) {
  if (!hire) return null;
  return {
    name: hire.name ?? 'Someone',
    trait: hire.trait ?? 'steady under pages',
    salary: hire.salary ?? 0,
    und: clamp(hire.und ?? 40, 0, 100),
    morale: clamp(hire.morale ?? 60, 0, 100)
  };
}

/**
 * Build a fresh gameState at month 1, Plan phase.
 * @param {string} classId  a class id from data/classes.js
 * @param {{junior?, qa?, senior?}} hires  chosen candidates (or nulls)
 * @param {string} model  'budget' | 'standard' | 'frontier'
 * @param {number} seed
 */
export function initState(classId, hires = {}, model = 'standard', seed = 1) {
  const rng = createRng(seed);
  const cls = getClass(classId);
  const floor = classFloor(cls.floorProfile);

  const mkSkill = (und) => ({ conf: und, und, floor, streak: 0 }); // start calibrated

  let s = {
    // identity + rng cursor
    seed,
    rngState: 0,
    class: {
      id: cls.id, name: cls.name, multiplier: cls.multiplier,
      quirks: { ...cls.quirks }, floorProfile: cls.floorProfile
    },
    model,

    // clock + phase
    month: 1,
    phase: 'plan',

    // mortal meters
    money: cls.cash,
    energy: config.energyStart,
    client: config.clientStart,

    // focus + capacity
    focus: null,
    focusUsed: false,
    capacity: { total: 0, spent: 0 },

    // skills (Confidence shown, Understanding hidden)
    skills: {
      coding: mkSkill(cls.skills.coding),
      debugging: mkSkill(cls.skills.debugging),
      judgment: mkSkill(cls.skills.judgment)
    },

    // reliability + velocity pools
    cd: 0,
    slipped: 0,
    tasks: [],
    backlog: [],
    milestone: null,      // quarterly deliverable (MOREFUN D4); set by beginMonth
    defects: [],          // hidden
    openSeverity: 0,      // SLA pool from incidents (visible)

    team: {
      junior: makeMember(hires.junior),
      qa: makeMember(hires.qa),
      senior: makeMember(hires.senior)
    },

    // records
    history: [],          // {month, conf, und, money, cd, client}
    flags: {},
    log: [],

    // per-month transients (serializable; reset each month by beginMonth)
    monthTokens: 0,
    aiHuntDecided: false,
    aiHuntRequested: false,
    _monthSlips: 0,
    _skillActivity: {},
    pendingEvent: null,

    // run outcome
    ending: null
  };

  // Set up month 1 (tasks, capacity, transient resets) through the engine.
  s = beginMonth(s, rng);
  s.seed = seed;
  s.rngState = rng.getState();
  return s;
}

export default initState;
