// Tap-to-explain text for the numbers and icons on the boards. Each builder returns { ic, t, v, d }:
// icon, title, the value as it stands now, and short explanation lines. Attached with v-tip (app.js),
// which shows it as a hover title on desktop and as a popup on click or tap.
import * as D from './data.js';
import * as T from './text.js';
import { YOU, PF, storageCap, depotCap, lqCap, slotCost, scoreBreakdown, contractMet } from './engine.js';

const owner = pi => pi === YOU ? 'You' : 'Pathfinder';
const res = k => (T.RES_NAME[k] || k).toLowerCase();
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const lines = (...a) => a.filter(Boolean);

// ---------------------------------------------------------------- shuttle & turn order
export function shuttle(st, eta) {
    const sh = st.shuttle;
    return {
        ic: 'shuttle', t: 'Shuttle', v: eta.long,
        d: lines(
            !sh.gone && `Now on the ${sh.side === 'orbit' ? 'Orbit' : 'Mars'} side, space ${sh.pos}.`,
            'Moves down one space each round and leaves from space 1.',
            'It lands on the space matching the colony level (1 to 3), stops at level 4, and flies once more at level 5.',
        ),
    };
}
export function turnSpace(st, s) {
    const ben = D.TURN_SPACES[s.n];
    return {
        ic: s.who === YOU ? 'you' : s.who === PF ? 'pf' : ben ? T.SPACE[ben].ic : 'clock',
        t: `Turn order ${s.n}`,
        v: s.who >= 0 ? `${owner(s.who)}${s.done ? ' · played this round' : ''}` : 'Free',
        d: lines(
            s.n <= 4 ? 'Taken when you arrive in Orbit.' : 'Taken when you arrive on Mars.',
            ben ? `Bonus: ${T.SPACE[ben].long}.` : 'No bonus.',
            'Lower numbers go first.',
        ),
    };
}

// ---------------------------------------------------------------- actions & orbit
export function action(st, k) {
    const a = T.ACTION[k], s = st.slots[k], max = k === 'hire' ? 2 : 3;
    const d = [a.long + '.'];
    if (s) {
        const mine = s.filter(o => o === YOU).length;
        d.push(`Slots: ${mine} yours, ${s.length - mine} Pathfinder's, ${Math.max(0, max - s.length)} free.`);
        const c = slotCost(st, k, YOU);
        if (c) d.push(`Costs you ${plural(c, 'extra colonist')} now.`);
    }
    if (D.BOOST_ACTIONS.includes(k)) d.push('Boost: +1 per extra colonist.');
    return { ic: a.ic, t: a.name, v: s ? `${s.length} of ${max} slots taken` : 'Open', d };
}
const TECH_DO = {
    connect: b => `Lets ${D.BUILD_NAMES[b]}s join into complexes. Its level must be at least the number of buildings being joined.`,
    rover: () => 'Your rover moves extra spaces equal to its level.',
    colonist: () => 'Extra colonists when you welcome a ship, equal to its level.',
    upgrade: () => 'Extra upgrades equal to its level.',
};
export function tech(t, extra) {
    const def = D.TECHS[t];
    return { ic: T.TECH_IC[t], t: def.name, v: extra.v, d: lines(TECH_DO[def.kind](def.b), ...(extra.d || []), 'Anyone can use it. The owner gets a reward.') };
}
export function gridTech(t, cost) {
    return tech(t, { v: cost.length ? 'Price: ' + cost.map(res).join(' + ') : 'Free', d: ['Goes in column 1 of your lab.'] });
}
export function gridCost(cost) {
    return { ic: cost[0] || 'tech', t: 'Tech price', v: cost.length ? cost.map(res).join(' + ') : 'Free', d: ['For any tech in this row.'] };
}
export function ownedTech(t, pi, lvl) {
    return tech(t, { v: `${owner(pi)} · level ${lvl}`, d: [`Worth ${D.LAB_OP[lvl]} OP at the end.`] });
}
export function warehouse(k, n) {
    return { ic: k, t: `Warehouse ${res(k)}`, v: `${n} available`, d: ['Refills to 2 of each at every colony level.'] };
}
export function discovery(id) {
    const d = D.disc(id);
    const what = d.k === 'gain' ? `Gain ${d.n} × ${res(d.g)}` : d.k === 'build' ? `Construct a ${D.BUILD_NAMES[d.b]}` : T.DISC[d.k];
    return { ic: 'discovery', t: 'Discovery tile', v: what, d: ['Your rover collects it for the benefit.'] };
}

// ---------------------------------------------------------------- missions
const MISSION_HOW = {
    research: 'a research tile is taken from Mars', adv: 'an advanced building is placed', discovery: 'a rover takes a discovery tile',
    progress: 'a progress cube is placed', contract: 'a contract is completed', blueprint: 'a blueprint is taken from the display',
    bot: 'a new bot is placed on Mars', tech: 'a tech is taken from the grid', scientist: 'a scientist is hired',
};
export function mission(st, m) {
    const def = D.mission(m.id);
    return {
        ic: 'mission', t: `Mission ${m.at}: ${def.name}`, v: m.done ? 'Complete' : `${m.left} to go (of ${def.need})`,
        d: [`One step each time ${MISSION_HOW[def.k]}.`, `Each step pays ${plural(def.gain, 'crystal')}.`, `${st.remaining} more complete missions end the game.`],
    };
}

// ---------------------------------------------------------------- player board
export function score(st, pi) {
    const sc = scoreBreakdown(st, pi, false);
    return { ic: pi === YOU ? 'you' : 'pf', t: `${owner(pi)}: score`, v: `${sc.total} OP`, d: ['Includes end-game scoring as if the game ended now.'] };
}
const PARTS = {
    game: ['op', 'Scored in play', ''],
    tech: ['tech', 'Techs', 'End: each tech scores by its lab column (1, 2, 3, 4, 5, 9).'],
    blueprints: ['blueprint', 'Blueprints', 'End: +3 per level I built, +5 per level III built; −3 / −5 for each not built.'],
    colonists: ['colonist', 'Colonists', 'End: your highest occupied living quarters tier (3, 6, 10, 15, 21).'],
    ships: ['ship', 'Ships', 'End: 3 OP per ship in your hangar.'],
    progress: ['level', 'Progress', '1 / 2 / 4 / 7 / 11 for 1 to 5 cubes, at colony levels 2 and 3 and at the end.'],
    scientists: ['scientist', 'Scientists', 'End: 3 OP per advanced building of each scientist\'s type.'],
    contracts: ['contract', 'Contracts', 'End: + if complete, − if not.'],
};
export function scorePart(st, pi, k) {
    const [ic, t, d] = PARTS[k];
    return { ic, t, v: `${scoreBreakdown(st, pi, false)[k]} OP`, d: lines(d) };
}
export function stored(st, pi, k) {
    const n = st.p[pi].res[k], cap = storageCap(st, pi);
    const builds = Object.keys(D.BUILD_COST).find(b => D.BUILD_COST[b] === k);
    return {
        ic: k, t: T.RES_NAME[k], v: `${n} of ${cap}`,
        d: lines(`You can hold ${cap} of each: your shelters + 1.`, builds && `Pays for a ${D.BUILD_NAMES[builds]}.`, k === 'mineral' && 'Can pay for any resource.', n >= cap && 'Full. Any more is lost.'),
    };
}
export function crystals(p) {
    const cap = depotCap(p);
    return {
        ic: 'crystal', t: 'Crystals', v: `${p.cr} of ${cap}`,
        d: lines(`Your depot holds ${cap}: 8 spaces minus ${plural(p.ships.length, 'docked ship')}.`, p.crP && `${p.crP} more arrive at the start of your next turn. Overflow is lost.`),
    };
}
export function colonists(st, pi, k, n) {
    const C = {
        lq: ['colonist', 'At home', `${n} of ${lqCap(st, pi)}`, ['Ready to place on actions.', 'Room grows by 2 per shelter.', 'End: your highest occupied tier (3, 6, 10, 15, 21).']],
        wa: ['hand', 'Working area', `${n}`, ['Colonists spent on boosts and extra slot costs.', 'They come home when you travel.']],
        sup: ['colonist', 'Supply', `${n}`, ['Welcome ships to bring them.']],
        mine: ['mine', 'Miners', `${n}`, ['Each makes 1 mineral when you travel to Orbit.']],
    }[k];
    return { ic: C[0], t: C[1], v: C[2], d: C[3] };
}
export function labCol(col) {
    return {
        ic: 'tech', t: `Lab column ${col.c}`, v: `${D.LAB_OP[col.c]} OP per tech at the end`,
        d: [col.c === 1 ? 'New techs start here.' : `Developing into it costs ${col.cost.map(res).join(' + ')}.`, 'Develop moves a tech one column right, to a touching space.'],
    };
}
export function labSpace(s, col, pi) {
    if (s.tech) return ownedTech(s.tech, pi, col);
    const ben = s.ben ? { warehouse: 'take 1 crystal or resource from the warehouse', crystal: 'gain 1 crystal', mineral: 'gain 1 mineral', bots: 'move bots 2', upgrade: 'upgrade 1 building (+1 per colonist)', blueprint: 'take 1 blueprint (+1 per colonist)' }[D.LAB.find(l => l.k === s.k).ben] : null;
    return { ic: s.ben || 'tech', t: `Lab space ${s.k}`, v: ben ? `Bonus: ${ben}` : 'No bonus', d: lines(ben && 'You get it when a tech moves here.') };
}
export function exec(e, p) {
    return {
        ic: e.ic, t: e.name, v: e.locked ? 'Locked by a ship' : `${e.cost} crystals`,
        d: lines(e.long + '.', e.k === 'adv' && 'Free with a matching scientist.', e.locked && 'Welcome a ship to unlock it.'),
    };
}
export function progress(g) {
    return {
        ic: g.ic, t: `Progress: ${D.BUILD_NAMES[g.t]}`, v: g.on ? 'Cube placed' : 'Not yet',
        d: [`Placed the first time you create or grow a ${D.BUILD_NAMES[g.t]} complex.`, '1 / 2 / 4 / 7 / 11 for 1 to 5 cubes, at colony levels 2 and 3 and at the end.'],
    };
}
export function need(st, pi, c, n) {
    return { ic: n.k, t: `Contract #${c.id}: ${res(n.k)}`, v: `${n.have} of ${n.n} delivered`, d: lines(contractMet(st, pi, c) ? 'Complete.' : 'Deliver with + at the start or end of a turn.') };
}
export function goal(id, ok, done) {
    const g = D.GOALS[id - 1];
    return {
        ic: 'goal', t: 'Private goal', v: done ? 'Completed' : ok ? 'Met: claim it from your turn menu' : 'Not met yet',
        d: [T.GOAL[g.k] + '.', g.r === 'develop2' ? 'Reward: develop a tech twice, free.' : `Reward: develop a tech twice, free, or ${T.GOAL_R[g.r].toLowerCase()}.`, 'You can complete only one goal. A goal card can pay for 1 crystal.'],
    };
}

// ---------------------------------------------------------------- Pathfinder
export function soloDeck(s) {
    return { ic: 'deck', t: 'Solo deck', v: `${s.left} cards left`, d: lines(`${s.disc} discarded.`, s.ex && 'The deck ran out once, so every card now also moves a mission.') };
}
export function pfDisc(d) {
    return { ic: 'discovery', t: `Pathfinder at colony level ${d.lvl}`, v: `${plural(d.n, 'discovery tile')}`, d: ['Pathfinder gets them when the colony reaches this level.'] };
}
export function pfShips(p) {
    return { ic: 'ship', t: 'Pathfinder ships', v: `${p.hangar} in hangar`, d: ['3 OP each at the end.'] };
}
export function pfColonists(st) {
    return { ic: 'colonist', t: 'Pathfinder colonists', v: `${lqCap(st, PF)}`, d: ['Always counts as full.'] };
}

// ---------------------------------------------------------------- cards
export function blueprint(id) {
    const b = D.bp(id);
    return {
        ic: T.TYPE_IC[b.type], t: b.name, v: `Level ${b.lvl === 3 ? 'III' : 'I'} ${D.BUILD_NAMES[b.type] || ''} blueprint`,
        d: lines(b.lvl === 3 && 'Needs a complex of 3 or more to build.', `Upgrades a ${D.BUILD_NAMES[b.type]}.`, D.PRODUCES[b.type] && `On take: +1 ${res(D.PRODUCES[b.type])}.`, `Advanced building action: ${T.BP_EX[b.ex].long}.`, `End: ${b.lvl === 3 ? '+5 if built, −5 if not' : '+3 if built, −3 if not'}.`),
    };
}
export function scientist(id) {
    const s = D.sci(id);
    return {
        ic: 'scientist', t: s.name, v: 'Cost: ' + Object.entries(s.cost).map(([a, n]) => `${n} × ${res(a === 'colonists' ? 'colonist' : a)}`).join(', '),
        d: [`Makes an advanced ${D.BUILD_NAMES[s.works]}'s action free for you.`, `End: 3 OP per advanced ${D.BUILD_NAMES[s.scores]} on Mars.`],
    };
}
export function contract(id) {
    const c = D.contract(id);
    return {
        ic: 'contract', t: `Contract #${id}`, v: `+${c.win} if done, −${c.lose} if not`,
        d: [c.up ? `Your advanced marker on a ${D.BUILD_NAMES[c.up]} complex of 4+.` : `Deliver ${Object.entries(c.need).map(([a, n]) => `${n} ${res(a)}`).join(' + ')}.`, 'Costs 1 crystal to take.'],
    };
}
export function card({ k, id }) {
    return k === 'bp' ? blueprint(id) : k === 'sci' ? scientist(id) : k === 'con' ? contract(id) : null;
}

// ---------------------------------------------------------------- decision buttons (explain mode)
const WHY = {
    busy: 'Your colonist is already on this action.', colonist: 'You have no colonist at home to send.', cost: "You can't pay for it.",
    none: 'There is nothing it could do right now.', level: "Ships welcomed can't exceed the colony level.", ship: 'A ship still covers this action.', full: 'Your storage is full.',
};
const why = r => r ? (WHY[r] || `${T.BLOCK[r] || r}.`) : null;
const lab = pos => ({ k: pos, ben: D.LAB.find(l => l.k === pos).ben, tech: null });
/** Explain one answer `v` to the current prompt without answering it. */
export function choice(st, pr, v) {
    const q = pr.kind === 'menu' ? 'menu' : pr.q || pr.kind;
    const p = st.p[YOU];
    if (v === 'done') return { ic: 'skip', t: pr.q === 'pay' ? 'Skip' : 'Done', v: 'Finish this step', d: [] };
    if (v === 'back') return { ic: 'back', t: 'Back', v: 'Go back one step', d: [] };
    if (q === 'menu') {
        if (v.a === 'main') { const m = pr.main.find(x => x.k === v.k), t = action(st, v.k); return { ...t, v: m.why ? 'Not possible now' : t.v, d: lines(why(m.why), ...t.d) }; }
        if (v.a === 'exec') {
            const e = pr.exec.find(x => x.i === v.i), x = T.EXEC[e.k];
            return { ic: x.ic, t: `Executive: ${x.name}`, v: e.why ? 'Not possible now' : `${D.EXEC[e.i].cost} crystals`, d: lines(why(e.why), e.why && `Costs ${D.EXEC[e.i].cost} crystals.`, x.long + '.', e.k === 'adv' && 'Free with a matching scientist.') };
        }
        if (v.a === 'goal') return { ...goal(v.id, true, false), t: 'Claim private goal' };
        if (v.a === 'end') return { ic: 'check', t: 'End turn', v: 'Finish your turn', d: ['Use any executive actions first.'] };
    }
    switch (q) {
        case 'boost': return { ic: 'boost', t: `Boost +${v}`, v: v ? `${plural(v, 'colonist')} to work` : 'No boost', d: [v ? 'They move from home to your working area.' : 'Your colonists stay home.', `${p.col.lq} at home.`] };
        case 'pfTurn': return { ic: 'check', t: 'OK', v: 'Continue', d: [] };
        case 'slotCost': return { ic: 'colonist', t: 'Pay the slot cost', v: lines(v.cr && plural(v.cr, 'crystal'), v.col && plural(v.col, 'colonist')).join(' + '), d: ['Colonists already here raise the cost.', 'Colonists paid go to your working area.'] };
        case 'blueprint': return { ...blueprint(v), t: `Take: ${D.bp(v).name}` };
        case 'upgradeBp': return { ...blueprint(v), t: `Upgrade with: ${D.bp(v).name}` };
        case 'tech': return gridTech(pr.techs.find(t => t.i === v).tech, D.GRID_COST[v]);
        case 'labSpace': return labSpace(lab(v), +v[0], YOU);
        case 'devTo': { const t = labSpace(lab(v), +v[0], YOU); return { ...t, t: `Move to ${v}`, d: [...t.d, `Costs ${(D.LAB_COST[+v[0]] || []).map(res).join(' + ') || 'nothing'}.`] }; }
        case 'develop': {
            const c = +v[0], tt = p.lab[v];
            return tech(tt, { v: `Column ${c} → ${c + 1}`, d: [pr.free ? 'Free this time.' : `Costs ${(D.LAB_COST[c + 1] || []).map(res).join(' + ')}.`, `End value goes from ${D.LAB_OP[c]} to ${D.LAB_OP[c + 1]} OP.`] });
        }
        case 'warehouse': return { ...warehouse(v, st.ware[v]), t: `Take ${res(v)}` };
        case 'tradeOut': return { ic: v, t: `Spend ${res(v)}`, v: `You have ${p.res[v]}`, d: ['Then choose what to gain.'] };
        case 'tradeIn': return { ic: v, t: `Gain ${res(v)}`, v: `You have ${p.res[v]}`, d: [] };
        case 'pay': return { ic: 'crystal', t: 'Pay with', v: Object.entries(v).map(([k, n]) => `${n} ${k === 'goal' ? 'goal card' : res(k)}`).join(' + '), d: lines(v.mineral && 'Minerals stand in for any resource.', v.goal && 'You can\'t complete that goal later.') };
        case 'goalCrystal': return { ...goal(v, false, false), t: 'Spend this goal as a crystal', v: 'Pays for 1 crystal', d: [T.GOAL[D.GOALS[v - 1].k] + '.', 'You can\'t complete it later.'] };
        case 'buildType': {
            const o = pr.types.find(t => t.type === v), lss = D.LSS_TYPES.includes(v);
            return {
                ic: T.TYPE_IC[v], t: `Build a ${D.BUILD_NAMES[v]}`, v: `Costs 1 ${res(o.cost)}`,
                d: lines(`Makes ${res(D.PRODUCES[v])} × the size of its complex.`, o.arrows && 'Puts crystals on 3 empty hexes around it.', lss && (st.lss[v] < st.level + 1 ? 'Below the colony line: scores its LSS reward and a bonus.' : 'At or past the line: no LSS reward.'), v === 'shelter' && 'Adds storage and living quarters room.', v === 'mine' && 'One of your colonists works it.'),
            };
        }
        case 'lssBen': return lssBenefit(T.LSS_BEN[v]);
        case 'retrieve': return { ic: v === 'wa' ? 'hand' : T.ACTION[v].ic, t: 'Retrieve a colonist', v: v === 'wa' ? 'From your working area' : `From ${T.ACTION[v].name}`, d: ['It goes home.'] };
        case 'useTech': return { ic: 'tech', t: v === 'yes' ? 'Use Pathfinder\'s tech' : 'Don\'t use it', v: v === 'yes' ? `+${pr.level}` : 'No bonus', d: lines(v === 'yes' && 'Pathfinder may develop that tech after your turn.') };
        case 'hire': { const c = pr.choices.find(x => x.i === v); return c.sci ? { ...scientist(c.sci), t: `Hire ${D.sci(c.sci).name}` } : { ...contract(c.contract), t: `Take contract #${c.contract}` }; }
        case 'refill': return { ...contract(v), t: `Put out contract #${v}` };
        case 'ship': { const e = D.EXEC[v], x = T.EXEC[e.k]; return { ic: x.ic, t: `Unlock ${x.name}`, v: `${e.cost} crystals to use`, d: [x.long + '.', 'The ship goes to your hangar (3 OP at the end) and frees a crystal space.'] }; }
        case 'shipGain': return v === 'bot' ? { ic: 'bot', t: 'Colonists + a bot', v: `${pr.big ? 2 : 1} colonist${pr.big ? 's' : ''} + 1 bot`, d: ['The bot is placed on Mars.'] } : { ic: 'colonist', t: 'Colonists', v: `${pr.big ? 3 : 2} colonists`, d: ['They arrive in your living quarters.'] };
        case 'adv': { const b = blueprint(v.id); return { ...b, t: `Use ${D.bp(v.id).name}`, v: v.way === 'pay' ? 'Pay 2 crystals' : v.way === 'sci' ? 'Send a scientist' : 'Free', d: [T.BP_EX[D.bp(v.id).ex].long + '.'] }; }
        case 'side': return { ic: v === 'orbit' ? 'orbit' : 'mars', t: `Recall from ${v === 'orbit' ? 'Orbit' : 'Mars'}`, v: 'All your colonists there come home', d: [] };
        case 'radar': case 'discPick': return discovery(v);
        case 'goalReward': return { ic: v === 'develop2' ? 'develop' : 'goal', t: 'Goal reward', v: T.GOAL_R[v], d: [] };
        case 'techReward': return { ic: v === 'oxygen' ? 'oxygen' : 'develop', t: v === 'oxygen' ? 'Take 1 oxygen' : 'Develop it free', v: v === 'oxygen' ? '+1 oxygen' : 'Tech moves 1 column right', d: ['Pathfinder used your tech.'] };
        case 'travel': return v === 'go'
            ? { ic: pr.to === 'orbit' ? 'orbit' : 'mars', t: `Go to ${pr.to === 'orbit' ? 'Orbit' : 'Mars'}`, v: pr.free ? 'Free ride' : 'Costs a hangar ship', d: ['Your colonists there come home, then you pick a turn order space.'] }
            : { ic: 'x', t: 'Stay', v: 'Keep your turn order space', d: [] };
        case 'space': return { ...turnSpace(st, { n: v, who: -1, done: false }), t: `Take turn order ${v}`, v: v <= 4 ? 'Orbit' : 'Mars' };
    }
    if (pr.kind === 'hex') {
        const b = { crBot: ['crystal', 'Extra bot move', 'Costs 1 crystal.'], crRover: ['crystal', 'Extra rover move', 'Costs 1 crystal.'], tech: ['tech', 'Rover tech', `Add ${pr.techLevel} rover moves from Faster Rovers${pr.techOwner === PF ? ' (Pathfinder\'s: it may develop it)' : ''}.`] }[v];
        if (b) return { ic: b[0], t: b[1], v: '', d: [b[2]] };
    }
    return { ic: 'help', t: String(v), v: '', d: [] };
}

// ---------------------------------------------------------------- life support
export function lssTile(c) {
    return {
        ic: c.tl.ic, t: `${D.BUILD_NAMES[c.t]} reward`, v: c.open ? `Build now: you ${c.you}, Pathfinder ${c.pf}` : 'Locked until the colony levels up',
        d: lines(c.tl.long + '.', c.n === 1 && 'Includes +2 for the first build of this type.', 'Build below the line to score it, then pick one bonus.'),
    };
}
export function lssHead(c) {
    return { ic: c.ic, t: D.BUILD_NAMES[c.t], v: `${c.n} on the track`, d: [`Costs 1 ${res(c.cost)} to build.`, `Makes ${res(c.makes)} × the size of its complex.`] };
}
export function lssNeed(c, st) {
    return { ic: c.ic, t: D.BUILD_NAMES[c.t], v: c.need ? `${plural(c.need, 'build')} to the line` : 'At the line', d: [`The colony reaches level ${st.level + 1} when every column is at the line.`] };
}
export function lssBenefit(b) {
    return { ic: b.ic, t: 'Reward bonus', v: b.long, d: ['Pick one each time you score a reward tile.'] };
}
const LV_COL = {
    progress: ['op', 'Progress scoring', l => l.progress ? 'Progress area scores' : 'No progress scoring', '1 / 2 / 4 / 7 / 11 for 1 to 5 cubes.'],
    missions: ['mission', 'Missions to end', l => l.missions ? `${l.missions} complete missions end the game` : 'Reaching it ends the game', ''],
    shuttle: ['shuttle', 'Shuttle', l => typeof l.shuttle === 'number' ? `Lands on space ${l.shuttle}` : l.shuttle === 'stop' ? 'Stops moving' : 'One last flight, then removed', 'It waits one round per space.'],
    bp: ['blueprint', 'Blueprints', l => ({ 'I': 'Level I only', 'I·III': 'Fresh display: level I and III', 'III': 'Level III only' })[l.bp], ''],
    ships: ['ship', 'Ship limit', l => `${plural(l.L, 'ship')} welcomed at most`, ''],
    pfDisc: ['discovery', 'Pathfinder discovery', l => l.pfDisc === null ? 'None' : `Pathfinder takes ${plural(l.pfDisc, 'tile')}`, ''],
};
export function level(l, k) {
    if (k === 'L') return { ic: 'level', t: `Colony level ${l.L}`, v: l.now ? 'Current level' : l.past ? 'Passed' : 'Ahead', d: ['Each level up refills the warehouse to 2 of each.'] };
    const [ic, t, v, d] = LV_COL[k];
    return { ic, t: `Level ${l.L}: ${t}`, v: v(l), d: lines(d) };
}
