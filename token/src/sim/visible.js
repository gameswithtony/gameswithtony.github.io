// visible.js — the fair-bot boundary (PLAN.md §4.3). visibleState(state) is the
// ONLY projection policies and screens ever see. It strips:
//   - hidden Understanding (skills expose Confidence only)
//   - Calibration (derived from und; never exposed)
//   - the defect pool (hidden; only its downstream openSeverity is visible)
//   - member internals (und + morale number gone; a mood icon remains)
//   - history's und column
//
// One function enforces both honest balance and a no-leak UI.

import { config } from '../../config.js';

function moodIcon(morale) {
  if (morale >= config.moodThresholds.happy) return '🙂';
  if (morale >= config.moodThresholds.ok) return '😐';
  return '☹️';
}

function clientMood(client) {
  if (client >= 70) return '🙂';
  if (client >= 40) return '😐';
  return '☹️';
}

export function visibleState(state) {
  return {
    month: state.month,
    phase: state.phase,
    months: config.months,

    // visible meters
    money: state.money,
    energy: state.energy,
    cd: state.cd,
    slipped: state.slipped,
    openSeverity: state.openSeverity,        // SLA pool is visible
    client: state.client,
    clientMood: clientMood(state.client),
    capacity: { ...state.capacity },
    model: state.model,

    // skills: Confidence only, never Understanding
    skills: {
      coding: { conf: state.skills.coding.conf },
      debugging: { conf: state.skills.debugging.conf },
      judgment: { conf: state.skills.judgment.conf }
    },

    // backlog is a visible count + routable list; defect POOL stays hidden
    backlogCount: state.backlog.length,
    backlog: state.backlog.map((b) => ({
      id: b.id, size: b.task.size, route: b.route,
      milestone: !!(state.milestone && b.task.milestone === state.milestone.id)
    })),
    tasks: state.tasks.map((t) => ({
      id: t.id, title: t.title, size: t.size, route: t.route,
      milestone: !!(state.milestone && t.milestone === state.milestone.id)
    })),

    // the quarterly deliverable is fully visible (MOREFUN D4)
    milestone: state.milestone ? { ...state.milestone } : null,

    // team: role, name, trait, salary, mood icon — no und, no morale number
    team: {
      junior: memberView(state.team.junior),
      qa: memberView(state.team.qa),
      senior: memberView(state.team.senior)
    },

    // history for the postmortem chart, with und stripped
    history: state.history.map((h) => ({
      month: h.month, conf: h.conf, money: h.money, cd: h.cd, client: h.client
    })),

    flags: { ...state.flags },
    log: state.log.slice(),
    pendingEvent: state.pendingEvent
      ? { deck: state.pendingEvent.deck, id: state.pendingEvent.id ?? state.pendingEvent.event?.id }
      : null,
    ending: state.ending
  };
}

function memberView(m) {
  if (!m) return null;
  return { name: m.name, trait: m.trait, salary: m.salary, mood: moodIcon(m.morale) };
}

export default visibleState;
