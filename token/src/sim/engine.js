// engine.js — pendingDecisions, applyDecision, and the month pipeline as pure
// steps: plan -> resolveWork -> resolveHunt -> maybeEvent -> settleBooks ->
// advanceMonth (PLAN.md §4, §6). No DOM. (state, action, rng) -> newState.
//
// FROZEN interfaces (PLAN.md §4):
//   pendingDecisions(state) -> Decision[]
//   applyDecision(state, decisionId, optionId, rng) -> newState
//   Decision: { id, kind:'route'|'focus'|'event'|'store'|'outfit', prompt, options[] }
//   option:   { id, label, disabled, detail }

import { config } from '../../config.js';
import * as decay from './decay.js';
import { runCheck } from './checks.js';
import { applyEffects } from './effects.js';
import { drawEvent } from './events-engine.js';
import { resolveManualHunt, resolveAiHunt } from './hunt.js';
import { generateTasks } from '../data/tasks.js';
import { events } from '../data/events.js';
import { majors } from '../data/majors.js';
import { incidents } from '../data/incidents.js';

const clone = (s) => structuredClone(s);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ROLES = ['junior', 'qa', 'senior'];

// pendingEvent stores only { deck, id } in gameState (JSON-serializable — event
// objects hold functions and must never enter state). Resolve to the live event
// definition on demand. An inline { event } is also honored (test fixtures).
function resolvePendingEvent(state) {
  const pe = state.pendingEvent;
  if (!pe) return null;
  if (pe.event) return pe.event;
  const deck = pe.deck === 'major' ? majors : pe.deck === 'incident' ? incidents : events;
  return deck.find((e) => e.id === pe.id) || null;
}

// ---------------------------------------------------------------------------
// Capacity + month setup
// ---------------------------------------------------------------------------

/** Review capacity for the current month: base + QA + class bonus + carried
 *  capacityDelta, minus 1 for each low-energy band threshold crossed. */
export function computeCapacity(state) {
  let total = config.capacityBase;
  if (state.team.qa) total += config.capacityQaBonus;
  total += state.class?.quirks?.capacityBonus || 0;
  total += state.flags.capacityDelta || 0;
  const penalty = config.energyBands.capacityPenaltyThresholds
    .reduce((n, thr) => n + (state.energy < thr ? 1 : 0), 0);
  return Math.max(0, total - penalty);
}

/** Set up a fresh Plan step: new tasks, capacity, reset per-month transients.
 *  Used by state.initState (month 1) and advanceMonth (months 2..12). */
export function beginMonth(state, rng) {
  const s = clone(state);
  s.phase = 'plan';
  s.focus = null;
  s.focusUsed = false;
  s.aiHuntDecided = false;
  s.aiHuntRequested = false;
  s.monthTokens = 0;
  s._monthSlips = 0;
  s._skillActivity = {};             // 'grew' | 'delegated' per skill, for rust
  s.pendingEvent = null;

  const count = rng.range(config.tasksPerMonth.min, config.tasksPerMonth.max);
  s.tasks = generateTasks(rng, count, s.month);
  s.backlog = s.backlog.map((b) => ({ ...b, route: null }));

  s.capacity = { total: computeCapacity(s), spent: 0 };
  // capacityDelta and tokensCostMult are one-shot; consume them now
  if (s.flags.capacityDelta) s.flags.capacityDelta = 0;
  if (s.flags.tokensCostMult != null) delete s.flags.tokensCostMult;
  return s;
}

// ---------------------------------------------------------------------------
// Decision surface
// ---------------------------------------------------------------------------

function routeOptions(state, isBacklog) {
  const cap = state.capacity;
  const opts = [
    { id: 'self', label: 'Do it yourself', disabled: state.focusUsed,
      detail: state.focusUsed ? 'focus already spent' : 'your focus + Energy' },
    { id: 'ai', label: 'AI (raw)', disabled: false, detail: 'tokens, +CD, decay' },
    { id: 'ai-review', label: 'AI + review', disabled: cap.spent >= cap.total,
      detail: cap.spent >= cap.total ? 'no capacity left' : '1 capacity' }
  ];
  for (const role of ROLES) {
    opts.push({
      id: `assign-${role}`, label: `Assign to ${role}`, disabled: !state.team[role],
      detail: state.team[role] ? 'their slot' : 'not hired'
    });
  }
  opts.push(isBacklog
    ? { id: 'defer', label: 'Leave in backlog', disabled: false, detail: 'no penalty' }
    : { id: 'slip', label: 'Let it slip', disabled: false, detail: `-$${config.slipFee}, -client` });
  return opts;
}

/** Every currently-askable decision as plain data. */
export function pendingDecisions(state) {
  if (state.phase === 'plan') {
    const decisions = [];
    for (const t of state.tasks) {
      if (t.route == null) {
        decisions.push({
          id: `route-task-${t.id}`, kind: 'route',
          prompt: `Route: ${t.title}`, options: routeOptions(state, false)
        });
      }
    }
    for (const b of state.backlog) {
      if (b.route == null) {
        decisions.push({
          id: `route-backlog-${b.id}`, kind: 'route',
          prompt: `Route backlog: ${b.task.title} (${b.task.size})`, options: routeOptions(state, true)
        });
      }
    }
    if (!state.aiHuntDecided) {
      decisions.push({
        id: 'ai-hunt', kind: 'route', prompt: 'Delegate a bug hunt to the AI?',
        options: [
          { id: 'do', label: 'Yes — AI hunt', disabled: false, detail: 'tokens, no capacity' },
          { id: 'skip', label: 'No', disabled: false, detail: '' }
        ]
      });
    }
    const allRouted = state.tasks.every((t) => t.route != null)
      && state.backlog.every((b) => b.route != null) && state.aiHuntDecided;
    if (allRouted && !state.focusUsed) {
      const opts = [
        { id: 'hunt', label: 'Hunt bugs (manual)', disabled: false, detail: 'spend capacity as ammo' },
        { id: 'rest', label: 'Rest', disabled: false, detail: `+${config.restEnergy} Energy` }
      ];
      for (const role of ROLES) {
        opts.push({
          id: `oneonone-${role}`, label: `1:1 with ${role}`, disabled: !state.team[role],
          detail: state.team[role] ? '+morale' : 'not hired'
        });
      }
      decisions.push({ id: 'focus', kind: 'focus', prompt: 'Spend your focus', options: opts });
    }
    return decisions;
  }

  if (state.phase === 'event' && state.pendingEvent) {
    const ev = resolvePendingEvent(state);
    return [{
      id: `event-${ev.id}`, kind: 'event', prompt: ev.text(state),
      options: ev.choices
        // prune choices whose check names an unhired member
        .filter((c) => !(c.check && ROLES.includes(c.check.target) && !state.team[c.check.target]))
        .map((c) => ({ id: c.id, label: c.label, disabled: false, detail: c.detail || '' }))
    }];
  }

  return [];
}

// ---------------------------------------------------------------------------
// applyDecision
// ---------------------------------------------------------------------------

export function applyDecision(state, decisionId, optionId, rng) {
  let s = clone(state);

  if (s.phase === 'plan') {
    if (decisionId.startsWith('route-task-')) {
      const t = s.tasks.find((x) => `route-task-${x.id}` === decisionId);
      if (t) applyRouteChoice(s, t, optionId, false);
    } else if (decisionId.startsWith('route-backlog-')) {
      const b = s.backlog.find((x) => `route-backlog-${x.id}` === decisionId);
      if (b) applyRouteChoice(s, b, optionId, true);
    } else if (decisionId === 'ai-hunt') {
      s.aiHuntDecided = true;
      s.aiHuntRequested = optionId === 'do';
    } else if (decisionId === 'focus') {
      s.focus = optionId;
      s.focusUsed = true;
    }
    if (planComplete(s)) s = continueAfterPlan(s, rng);
  } else if (s.phase === 'event') {
    s = resolveEvent(s, optionId, rng);
    s = resolveMonthEnd(s, rng);
  }

  s.rngState = rng.getState();
  return s;
}

// Record a route choice. Capacity for AI+review is reserved at decision time so
// later decisions see the remaining pool. Consequences resolve in resolveWork.
function applyRouteChoice(s, item, optionId, isBacklog) {
  item.route = optionId;
  if (optionId === 'self') { s.focusUsed = true; s.focus = 'build'; }
  if (optionId === 'ai-review') s.capacity.spent += 1;
}

function planComplete(s) {
  return s.tasks.every((t) => t.route != null)
    && s.backlog.every((b) => b.route != null)
    && s.aiHuntDecided && s.focusUsed;
}

// ---------------------------------------------------------------------------
// Pipeline steps (exported for unit tests)
// ---------------------------------------------------------------------------

function continueAfterPlan(state, rng) {
  let s = resolveWork(state, rng);
  s = resolveFocus(s, rng);
  s = resolveHunt(s, rng);
  s = maybeEvent(s, rng);
  if (s.phase === 'event') return s;   // wait for the player's event choice
  return resolveMonthEnd(s, rng);
}

// Token cost for one AI task, factoring class token multiplier, free-frontier
// quirk, and any this-month tokensCostMult from an event.
function taskTokenCost(s, hard) {
  const tier = s.model;
  if (s.class?.quirks?.freeFrontier && tier === 'frontier') return 0;
  let cost = config.tokenCosts[tier] ?? config.tokenCosts.standard;
  cost *= s.class?.quirks?.tokenMult ?? 1;
  if (s.flags.tokensCostMult != null) cost *= s.flags.tokensCostMult;
  return Math.round(cost);
}

export function resolveWork(state, rng) {
  const s = clone(state);
  const newBacklog = [];
  let slipCount = 0;

  const runRoute = (workItem, route, { fromBacklog }) => {
    const size = workItem.size;
    const hard = size === 'hard';
    switch (route) {
      case 'self': {
        s.energy -= config.taskEnergyCost[size];
        s.skills.coding = decay.grow(s.skills.coding, config.growthRates.selfCoding, {
          diminishThreshold: config.diminishingThreshold, diminishFactor: config.diminishingFactor
        });
        s.skills.coding = decay.converge(s.skills.coding, { fraction: config.confConvergeFraction });
        s.skills.coding = decay.shipConf(s.skills.coding, { confPerShip: config.confPerShip });
        s._skillActivity.coding = 'grew';
        return 'shipped';
      }
      case 'ai': {
        s.monthTokens += taskTokenCost(s, hard);
        s.skills.coding = decay.delegateDecay(s.skills.coding, {
          base: config.decayBase, accel: config.decayAccel
        });
        s.cd += config.cdPerRawAi;
        s._skillActivity.coding = 'delegated';
        const rate = (config.errorRates[s.model] ?? config.errorRates.standard) * (hard ? config.hardAiErrorMult : 1);
        if (rng.chance(clamp(rate, 0, 1))) {
          s.defects.push({ severity: 1, provenance: 'ai-raw', monthShipped: s.month });
        }
        s.skills.coding = decay.shipConf(s.skills.coding, { confPerShip: config.confPerShip });
        return 'shipped';
      }
      case 'ai-review': {
        s.monthTokens += taskTokenCost(s, hard);
        s.skills.coding = decay.reviewDecay(s.skills.coding, {
          base: config.decayBase, accel: config.decayAccel
        });
        s.skills.coding = decay.converge(s.skills.coding, { fraction: config.confConvergeFraction });
        s.skills.judgment = decay.grow(s.skills.judgment, config.growthRates.reviewJudgment);
        s._skillActivity.coding = 'delegated';
        s._skillActivity.judgment = 'grew';
        const base = (config.errorRates[s.model] ?? config.errorRates.standard) * (hard ? config.hardAiErrorMult : 1);
        const filtered = base * (1 - s.skills.coding.und / config.reviewUndDivisor) - (config.subtletyMods[s.model] || 0);
        if (rng.chance(clamp(filtered, 0, 1))) {
          s.defects.push({ severity: 1, provenance: 'ai-review', monthShipped: s.month });
        }
        s.skills.judgment = decay.shipConf(s.skills.judgment, { confPerShip: config.confPerShip });
        return 'shipped';
      }
      case 'assign-junior':
      case 'assign-qa':
      case 'assign-senior': {
        const role = route.slice('assign-'.length);
        const m = s.team[role];
        if (m) {
          const growAmt = config.growthRates.assignMember + (m.trait === 'quick study' ? config.traitMods.quickStudyGrowth : 0);
          m.und = clamp(m.und + growAmt, 0, 100);
          m.morale = clamp(m.morale + config.assignMorale, 0, 100);
          const rate = clamp((100 - m.und) / 100 * (config.errorRates[s.model] ?? 0.15), 0, 1);
          if (rng.chance(rate)) {
            s.defects.push({ severity: 1, provenance: 'teammate', monthShipped: s.month });
          }
        }
        return 'shipped';
      }
      case 'slip': {
        s.money -= config.slipFee;
        s.client = clamp(s.client + config.clientDeltas.slip, config.clientMin, config.clientMax);
        s.slipped += 1;
        slipCount += 1;
        return 'slipped';
      }
      case 'defer':
        return 'deferred';
      default:
        return 'noop';
    }
  };

  // fresh tasks
  for (const t of s.tasks) {
    const result = runRoute(t, t.route, { fromBacklog: false });
    if (result === 'slipped') {
      newBacklog.push({ id: `bl-${s.month}-${t.id}`, task: { ...t, route: null }, route: null });
    }
  }
  // backlog items
  for (const b of s.backlog) {
    if (b.route === 'defer' || b.route == null) {
      newBacklog.push({ ...b, route: null });
      continue;
    }
    runRoute(b.task, b.route, { fromBacklog: true });
    // cleared: goodwill + client bump (not re-added to backlog)
    s.money += config.goodwillBonus;
    s.client = clamp(s.client + config.clientDeltas.backlogClear, config.clientMin, config.clientMax);
  }

  s.backlog = newBacklog;
  s._monthSlips = slipCount;
  return s;
}

export function resolveFocus(state, rng) {
  const s = clone(state);
  if (s.focus === 'rest') {
    s.energy = Math.min(config.energyMax, s.energy + config.restEnergy);
    for (const role of ROLES) if (s.team[role]) {
      s.team[role].morale = clamp(s.team[role].morale + config.restMoraleAura, 0, 100);
    }
  } else if (typeof s.focus === 'string' && s.focus.startsWith('oneonone-')) {
    const role = s.focus.slice('oneonone-'.length);
    if (s.team[role]) s.team[role].morale = clamp(s.team[role].morale + config.oneOnOneMorale, 0, 100);
  }
  return s;
}

export function resolveHunt(state, rng) {
  let s = clone(state);
  if (s.focus === 'hunt') {
    const ammo = Math.max(0, s.capacity.total - s.capacity.spent);
    const res = resolveManualHunt(s, { ammo, skinModifier: 0 }, rng);
    s = res.state;
    s._skillActivity.debugging = 'grew';
    s.log.push({ month: s.month, type: 'hunt', ...res.report });
  }
  if (s.aiHuntRequested) {
    const res = resolveAiHunt(s, rng, { tier: s.model });
    s = res.state;
    s._skillActivity.debugging = 'delegated';
    s.log.push({ month: s.month, type: 'ai-hunt', ...res.report });
  }
  return s;
}

export function maybeEvent(state, rng) {
  let s = clone(state);
  const month = s.month;

  if (config.majorMonths.includes(month)) {
    if (month === config.months) return s; // month 12: Renewal Review runs at month-end
    const unused = majors.filter((m) => !s.flags[`major-${m.id}`]);
    const major = drawEvent(s, unused, rng);
    if (major) {
      s.flags[`major-${major.id}`] = true;
      s.pendingEvent = { deck: 'major', id: major.id };
      s.phase = 'event';
    }
    return s;
  }

  // incident flare (independent of the regular draw)
  const pool = s.defects.length;
  if (pool > 0) {
    const flareP = Math.min(config.incident.flarePerDefect * pool, config.incident.flareCap);
    if (rng.chance(flareP)) s = flareIncident(s, rng);
  }

  // regular monthly event
  if (rng.chance(config.eventChance)) {
    const ev = drawEvent(s, events, rng);
    if (ev) { s.pendingEvent = { deck: 'event', id: ev.id }; s.phase = 'event'; }
  }
  return s;
}

// WP1: an incident flare is engine-computed. Severity = Base x (1 + cdCoef*CD)
// x (responderPassMult if a team-Debugging check passes) + floor(pool/divisor).
// The responder check demonstrates team-target resolution. WP2 aligns incidents
// to the full event schema.
function flareIncident(state, rng) {
  const s = clone(state);
  const list = incidents.filter((i) => { try { return i.when ? i.when(s) : true; } catch { return false; } });
  const inc = list.length ? list[rng.range(0, list.length - 1)] : null;
  const base = inc?.base ?? config.incident.baseSeverity;

  const chk = runCheck(s, { skill: 'debugging', dc: 50, target: 'team' }, rng);
  const passMult = chk.success ? config.incident.responderPassMult : 1.0;
  const sev = Math.round(
    base * (1 + config.cdCoef * s.cd) * passMult + Math.floor(s.defects.length / config.incident.defectPoolDivisor)
  );
  s.openSeverity = Math.min(config.openSeverityCap, s.openSeverity + Math.max(0, sev));
  s.log.push({ month: s.month, type: 'incident', id: inc?.id ?? 'incident', severity: sev, responderPassed: chk.success });
  return s;
}

export function resolveEvent(state, optionId, rng) {
  let s = clone(state);
  const ev = resolvePendingEvent(s);
  const choice = ev.choices.find((c) => c.id === optionId) || ev.choices[0];

  if (choice.cost) s = applyEffects(s, choice.cost, rng);

  if (choice.check) {
    const chk = runCheck(s, choice.check, rng);
    // a check targeting you is always a calibration reveal (snap conf toward und)
    if (chk.valid && (choice.check.target == null || choice.check.target === 'you')) {
      const before = s.skills[choice.check.skill].conf;
      s.skills[choice.check.skill] = decay.revealSnap(s.skills[choice.check.skill], { fraction: config.calibrationSnap });
      s.log.push({
        month: s.month, type: 'reveal', skill: choice.check.skill,
        believed: Math.round(before), reality: Math.round(chk.understanding)
      });
    }
    const branch = chk.success ? choice.success : choice.fail;
    if (branch && branch.effects) s = applyEffects(s, branch.effects, rng);
    s.log.push({ month: s.month, type: 'check', event: ev.id, skill: choice.check.skill, success: chk.success, roll: chk.roll });
  } else if (choice.effects) {
    s = applyEffects(s, choice.effects, rng);
  }

  s.log.push({ month: s.month, type: 'event', id: ev.id, choice: choice.id });
  s.pendingEvent = null;
  return s;
}

export function settleBooks(state, rng) {
  const s = clone(state);
  const revenue = Math.max(0, config.contractMonthly - config.slaPerSeverity * s.openSeverity);
  let salaries = 0;
  for (const role of ROLES) if (s.team[role]) salaries += s.team[role].salary;

  s.money += revenue - salaries - (s.monthTokens || 0);

  // monthly client deltas (slip/backlog-clear were applied during resolveWork)
  s.client += config.clientDeltas.openSeverityPerPoint * s.openSeverity;
  s.client += config.clientDeltas.backlogLingerPerItem * s.backlog.length;
  if (s._monthSlips === 0) s.client += config.clientDeltas.allShipped;
  s.client = clamp(s.client, config.clientMin, config.clientMax);

  s.log.push({
    month: s.month, type: 'books', revenue, salaries, tokens: s.monthTokens || 0, money: s.money
  });

  // engine-level deaths (only these three; others arrive via endRun effect)
  if (!s.ending) {
    if (s.money < 0) s.ending = 'bankruptcy';
    else if (s.energy <= 0) s.ending = 'burnout';
    else if (s.client <= 0) s.ending = 'fired';
  }
  return s;
}

function resolveMonthEnd(state, rng) {
  let s = settleBooks(state, rng);
  if (s.ending) { s.phase = 'gameover'; return s; }
  if (s.month === config.months) {
    s = resolveRenewal(s, rng);
    s.phase = 'gameover';
    return s;
  }
  return advanceMonth(s, rng);
}

export function advanceMonth(state, rng) {
  const s = clone(state);
  // history snapshot (averages of the three skills), then rust unused skills
  const keys = ['coding', 'debugging', 'judgment'];
  const avg = (f) => keys.reduce((a, k) => a + f(s.skills[k]), 0) / keys.length;
  s.history.push({
    month: s.month,
    conf: Math.round(avg((sk) => sk.conf) * 10) / 10,
    und: Math.round(avg((sk) => sk.und) * 10) / 10,
    money: s.money, cd: s.cd, client: s.client
  });

  for (const k of keys) {
    const activity = s._skillActivity[k];
    if (activity === 'grew') s.skills[k] = decay.resetStreak(s.skills[k]);
    else if (activity === 'delegated') { /* streak already advanced; no rust */ }
    else { s.skills[k] = decay.rust(s.skills[k], { rate: config.rustRate }); s.skills[k] = decay.resetStreak(s.skills[k]); }
  }

  // junior title bump (visible log line) — one-time per threshold
  const j = s.team.junior;
  if (j) {
    if (j.und >= 50 && !s.flags.juniorMid) { s.flags.juniorMid = true; s.log.push({ month: s.month, type: 'title', role: 'junior', title: 'Mid-level' }); }
    else if (j.und >= 30 && !s.flags.juniorDev) { s.flags.juniorDev = true; s.log.push({ month: s.month, type: 'title', role: 'junior', title: 'Developer' }); }
  }

  s.month += 1;
  return beginMonth(s, rng);
}

// Renewal Review (month 12, fixed): Coding(you), Judgment(you), bus-factor(team)
// at dc = base + cdCoef*CD -/+ clientMod. Pass `needed` of `of` -> renewed.
export function resolveRenewal(state, rng) {
  const s = clone(state);
  const R = config.renewal;
  const cm = config.renewalClientMod;
  const clientMod = s.client >= cm.high ? -cm.amount : (s.client <= cm.low ? cm.amount : 0);
  const dc = R.baseDc + R.cdCoef * s.cd + clientMod;

  const specs = [
    { skill: 'coding', target: 'you' },
    { skill: 'judgment', target: 'you' },
    { skill: 'judgment', target: 'team' }
  ];
  let passed = 0;
  const results = [];
  for (const spec of specs) {
    const chk = runCheck(s, { skill: spec.skill, dc, target: spec.target }, rng);
    if (spec.target === 'you') {
      const before = s.skills[spec.skill].conf;
      s.skills[spec.skill] = decay.revealSnap(s.skills[spec.skill], { fraction: config.calibrationSnap });
      s.log.push({ month: s.month, type: 'reveal', skill: spec.skill, believed: Math.round(before), reality: Math.round(chk.understanding) });
    }
    if (chk.success) passed++;
    results.push({ ...spec, success: chk.success });
  }
  const renewed = passed >= R.needed;
  s.ending = renewed ? 'qualified' : 'impostor';
  s.renewalResult = { dc, passed, needed: R.needed, results };
  s.log.push({ month: s.month, type: 'renewal', passed, renewed });
  return s;
}
