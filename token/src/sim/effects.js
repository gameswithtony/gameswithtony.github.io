// effects.js — applyEffects: the ONE function events touch. Declarative deltas
// in, new state out. Throws on any illegal key or sub-key (PLAN.md §4; the
// schema test in WP2 leans on this throw).
//
// Legal effect keys (exhaustive):
//   money            number
//   energy           number
//   cd               number
//   skill            { coding|debugging|judgment: +/-n }   (moves Understanding)
//   conf             { coding|debugging|judgment: +/-n }   (moves Confidence directly)
//   member           { junior|qa|senior: { morale, comp, burnout } }
//   removeMember     'junior'|'qa'|'senior'
//   defects          +/-n  OR  { add: { severity, provenance } }
//   client           number
//   capacityDelta    number  (applied to NEXT month's review capacity)
//   tokensCostMult   number  (multiplies this month's token costs)
//   flag             'name'  (sets state.flags.name = true)
//   endRun           'cause-id'  (ends the run with this cause)
//
// FROZEN member vocabulary note (PLAN.md §4): the effect sub-keys are
// morale/comp/burnout verbatim, even though a member's state stat is `und` and
// there is no member burnout. Mapping (documented call):
//   - `comp`    -> the member's `und` (Understanding)
//   - `burnout` -> legal but IGNORED (no member-burnout stat exists; PLAN §1 cut)
//   - `morale`  -> the member's `morale`

import { config } from '../../config.js';

const clone = (s) => structuredClone(s);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const SKILLS = ['coding', 'debugging', 'judgment'];
const ROLES = ['junior', 'qa', 'senior'];
const MEMBER_FIELDS = ['morale', 'comp', 'burnout'];

export function applyEffects(state, effects, rng) {
  const s = clone(state);
  if (!effects || typeof effects !== 'object') return s;

  for (const key of Object.keys(effects)) {
    const v = effects[key];
    switch (key) {
      case 'money':
        s.money += v;
        break;

      case 'energy':
        s.energy = Math.min(config.energyMax, s.energy + v);
        break;

      case 'cd':
        s.cd = Math.max(0, s.cd + v);
        break;

      case 'client':
        s.client = clamp(s.client + v, config.clientMin, config.clientMax);
        break;

      case 'skill':
        for (const sk of Object.keys(v)) {
          if (!SKILLS.includes(sk)) throw new Error(`applyEffects: illegal skill '${sk}'`);
          s.skills[sk].und = clamp(s.skills[sk].und + v[sk], 0, 100);
        }
        break;

      case 'conf':
        for (const sk of Object.keys(v)) {
          if (!SKILLS.includes(sk)) throw new Error(`applyEffects: illegal conf skill '${sk}'`);
          s.skills[sk].conf = clamp(s.skills[sk].conf + v[sk], 0, 100);
        }
        break;

      case 'member':
        for (const role of Object.keys(v)) {
          if (!ROLES.includes(role)) throw new Error(`applyEffects: illegal member role '${role}'`);
          const m = s.team[role];
          const sub = v[role];
          for (const field of Object.keys(sub)) {
            if (!MEMBER_FIELDS.includes(field)) {
              throw new Error(`applyEffects: illegal member field '${field}'`);
            }
            if (!m) continue; // effect on an unhired member no-ops
            if (field === 'morale') m.morale = clamp(m.morale + sub.morale, 0, 100);
            else if (field === 'comp') m.und = clamp(m.und + sub.comp, 0, 100); // comp -> und
            // 'burnout': legal but ignored (no member burnout stat)
          }
        }
        break;

      case 'removeMember':
        if (!ROLES.includes(v)) throw new Error(`applyEffects: illegal removeMember '${v}'`);
        s.team[v] = null;
        break;

      case 'defects':
        if (typeof v === 'number') {
          if (v >= 0) {
            for (let i = 0; i < v; i++) {
              s.defects.push({ severity: 1, provenance: 'event', monthShipped: s.month });
            }
          } else {
            s.defects.splice(0, Math.min(s.defects.length, -v));
          }
        } else if (v && v.add) {
          s.defects.push({
            severity: v.add.severity ?? 1,
            provenance: v.add.provenance ?? 'event',
            monthShipped: s.month
          });
        } else {
          throw new Error('applyEffects: illegal defects payload');
        }
        break;

      case 'capacityDelta':
        s.flags.capacityDelta = (s.flags.capacityDelta || 0) + v;
        break;

      case 'tokensCostMult':
        s.flags.tokensCostMult = v;
        break;

      case 'flag':
        s.flags[v] = true;
        break;

      case 'endRun':
        if (!s.ending) s.ending = v;
        break;

      default:
        throw new Error(`applyEffects: illegal effect key '${key}'`);
    }
  }
  return s;
}

export default applyEffects;
