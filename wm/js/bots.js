// The official Saboteurs' decision tables. No evaluation function or custom AI.
import * as D from './data.js';
import { H, DONE, ask, add, log, takeAnswer } from './runner.js';
import { target, chemicalPrice } from './economy.js';
import { locationKind, challenge, freeSpaces, saboteurAvailable, occupied, moveLativ, takeResearch, unlock, worsen, endGame, activateGovernment, checkEnd, takeAward } from './state.js';

export const report = (st, previous = false) => D.REPORTS[previous ? st.reportDiscard.at(-1) : st.currentReport];
export const weatherOrder = weather => D.WEATHER.map((_, i) => D.WEATHER[(D.WEATHER.indexOf(weather) + i) % 5]);
export function discardReport(st, reason) {
  if (!st.reportDeck.length) return false;
  st.reportDiscard.push(st.reportDeck.shift()); log(st, 'saboteurs', `Discarded a Security Report${reason ? ': ' + reason : ''}.`); return true;
}
export function stealChemical(st, count = 1) {
  for (let n = 0; n < count; n++) {
    let opts = D.COLORS.filter(c => st.supply[c] > 0);
    if (!opts.length) return;
    const cheapest = Math.min(...opts.map(c => chemicalPrice(st, c)));
    opts = opts.filter(c => chemicalPrice(st, c) === cheapest);
    const least = Math.min(...opts.map(c => st.saboteurs.chemicals[c]));
    opts = opts.filter(c => st.saboteurs.chemicals[c] === least);
    const color = report(st, true).priority === 'top' ? opts[0] : opts.at(-1);
    st.supply[color]--; st.saboteurs.chemicals[color]++;
    log(st, 'saboteurs', `Took ${D.COLOR_NAME[color]} Chemical.`);
  }
}
function setChoice(st, weather, extraKind) {
  const kinds = new Set(st.saboteurs.tokens.filter(t => t.weather === weather).map(t => t.kind));
  if (extraKind) kinds.add(extraKind);
  const need = st.locked[weather] ? 3 : 2;
  return { complete: kinds.size + st.saboteurs.awards >= need, count: kinds.size };
}
export function researchPriority(st, kind, weather) {
  if (!st.research[kind][weather]) return 0;
  if (!st.saboteurs.tokens.some(t => t.weather === weather && t.kind === kind) && !setChoice(st, weather).complete && setChoice(st, weather, kind).complete) return 3;
  if (st.saboteurs.tokens.some(t => t.weather === weather && t.kind !== kind)) return 2;
  return 1;
}
function chooseBranch(st, kind) {
  const prev = report(st, true), opts = [];
  for (const w of weatherOrder(prev.weather)) {
    if (kind === 'lab' && !st.experiments.some(id => D.EXPERIMENTS[id].weather === w)) continue;
    const ds = kind === 'government' ? D.GOV[w] : kind === 'lab' ? D.LAB[w] : D.RD[w].map(s => s.color);
    const positions = st[kind][w].map((s, i) => ({ ...s, i, color: ds[i] })).filter(s => (!s.owner || kind === 'lab' && s.owner === 'lativ') && st.saboteurs.chemicals[s.color] > 0);
    if (!positions.length) continue;
    opts.push({ w, positions, bots: st.lab[w].filter(s => s.owner).length, priority: researchPriority(st, kind, w) });
  }
  opts.sort((a, b) => (kind === 'lab' ? b.bots - a.bots : 0) || b.priority - a.priority);
  if (!opts.length) return null;
  const chosen = opts[0];
  chosen.space = kind === 'government' || prev.priority === 'top' ? chosen.positions[0].i : chosen.positions.at(-1).i;
  return chosen;
}
function botToken(st, kind, w) {
  if (st.research[kind][w]) takeResearch(st, 'saboteurs', kind, w);
  else { target(st, 5, 'Research unavailable'); if (kind === 'rd') unlock(st, w, 'saboteurs'); }
}
export function nefariousPlan(st, location, space) {
  const prev = report(st, true), order = weatherOrder(prev.weather);
  if (location === 1) {
    if (st.initiative[0] === 'saboteurs') target(st, 2, 'Already holds Initiative');
    else st.initiative = ['saboteurs', 'you'];
    stealChemical(st, 2); return;
  }
  const kind = locationKind(location), bothActions = space === 0;
  if (bothActions && location === 2) {
    stealChemical(st);
    for (const w of order) {
      const tiles = st.governmentSubsidies[w].filter(x => !x.part && !x.used);
      if (!tiles.length) continue;
      (prev.priority === 'top' ? tiles[0] : tiles.at(-1)).used = true; break;
    }
  }
  if (bothActions && location === 3) takeAward(st, 'saboteurs');
  if (bothActions && location === 4 && saboteurAvailable(st)) {
    for (const w of order) {
      const opts = st.rd[w].map((s, i) => ({ ...s, i })).filter(s => !s.owner);
      if (!opts.length) continue;
      const i = (prev.priority === 'top' ? opts[0] : opts.at(-1)).i, color = D.RD[w][i].color;
      st.rd[w][i].owner = 'saboteurs';
      if (st.saboteurs.chemicals[color]) {
        st.saboteurs.chemicals[color]--; st.rd[w][i].chemical = color; botToken(st, 'rd', w);
      }
      log(st, 'saboteurs', `Placed extra Bot in ${w} R&D.`); break;
    }
  }
  if (!saboteurAvailable(st)) { log(st, 'saboteurs', 'All twelve Bots are on the board.'); checkEnd(st); return; }
  const branch = chooseBranch(st, kind);
  if (!branch) { discardReport(st, 'No eligible branch'); stealChemical(st); checkEnd(st); return; }
  const w = branch.w, i = branch.space;
  const color = kind === 'government' ? D.GOV[w][i] : kind === 'lab' ? D.LAB[w][i] : D.RD[w][i].color;
  const slot = st[kind][w][i];
  if (slot.owner === 'lativ') { const empty = st.lab[w].find(s => !s.owner); if (empty) empty.owner = 'lativ'; }
  slot.owner = 'saboteurs'; st.saboteurs.chemicals[color]--;
  if (kind === 'rd') slot.chemical = color; else st.supply[color]++;
  log(st, 'saboteurs', `Placed Bot in ${w} ${kind}, space ${i + 1}.`);
  if (kind === 'government') {
    const tiles = st.governmentSubsidies[w].filter(x => !x.part);
    if (tiles.length) (prev.priority === 'top' ? tiles[0] : tiles.at(-1)).part = color;
    botToken(st, 'government', w);
    if (st.government[w].every(s => s.owner)) activateGovernment(st, w);
  }
  if (kind === 'rd') botToken(st, 'rd', w);
  checkEnd(st);
}
export function havocSets(st) {
  const order = weatherOrder(report(st, true).weather);
  const opts = order.map(weather => ({ weather, ...setChoice(st, weather) })).filter(x => x.complete);
  return opts.sort((a, b) => Number(st.locked[b.weather]) - Number(st.locked[a.weather]));
}
export function spendSet(st, w) {
  const availableKinds = ['government', 'lab', 'rd'].filter(k => st.saboteurs.tokens.some(t => t.weather === w && t.kind === k));
  // v8: an unlocked weather with all three colors spends three, rather than citing.
  const need = st.locked[w] || availableKinds.length === 3 ? 3 : 2;
  let spent = 0;
  for (const kind of availableKinds.slice(0, need)) {
    const i = st.saboteurs.tokens.findIndex(t => t.weather === w && t.kind === kind);
    st.saboteurs.tokens.splice(i, 1); spent++;
  }
  st.saboteurs.awards -= need - spent;
}
H.botTurn = (st, t) => {
  const a = takeAnswer(t);
  if (!t.stage) {
    st.phase = 'saboteurs';
    if (st.currentReport === null) { endGame(st, false, 'The Security Report deck is exhausted.'); return DONE; }
    if (a !== undefined) { t.stage = 'move'; return; }
    const c = report(st), prev = report(st, true);
    ask(st, t, `${c.agent === 'pink' ? 'Agent Pink' : 'Agent White'} acts`, [{ v: true, label: 'Resolve Saboteurs', icon: 'saboteurs' }], `Current Report: ${c.location === 'lativ' ? 'follow Lativ' : D.LOCATION_NAME[c.location]}. Previous Report: ${D.WEATHER_NAME[prev.weather]} · ${prev.priority} priority.`, 'bot'); return;
  }
  if (t.stage === 'move') {
    const c = report(st), old = st.positions[c.agent];
    let desired = c.location === 'lativ' ? st.positions.lativ.location : c.location;
    const canMove = loc => loc <= 4 && old.location !== loc && freeSpaces(st, loc, c.agent).length;
    if (!canMove(desired)) {
      desired = desired === 1 ? 2 : desired === 5 ? 2 : desired % 4 + 1;
      if (desired === 1) desired = 2;
      while (!canMove(desired)) desired = desired === 4 ? 2 : desired + 1;
    }
    const free = freeSpaces(st, desired, c.agent), space = desired === 1 ? free[0] : [0, 2, 1].find(s => free.includes(s));
    st.positions[c.agent] = { location: desired, space };
    log(st, 'saboteurs', `Agent ${c.agent} moved to ${D.LOCATION_NAME[desired]}, space ${space + 1}.`);
    if (desired !== 1) {
      const left = Object.entries(st.positions).filter(([who, p]) => who !== c.agent && p?.location === desired && p.space < space).length;
      if (left) target(st, left, 'Pieces to the left');
    }
    if (st.positions.lativ.location === desired) moveLativ(st);
    nefariousPlan(st, desired, space);
    st.reportDiscard.push(st.currentReport); st.currentReport = st.reportDeck.length ? st.reportDeck.shift() : null;
    t.stage = 'havoc'; add(st, { t: 'havoc' }); return;
  }
  return DONE;
};
H.havoc = (st, t) => {
  const a = takeAnswer(t);
  const sets = havocSets(st);
  if (!sets.length) return DONE;
  const w = sets[0].weather;
  if (a !== undefined || st.locked[w]) {
    const locked = st.locked[w]; spendSet(st, w);
    if (locked) { worsen(st, w); discardReport(st, 'Saboteurs wreak havoc'); unlock(st, w, 'saboteurs'); }
    else if (a === 'discard') discardReport(st, 'Saboteurs cite prior work');
    else target(st, 5, 'Saboteurs cite prior work');
    // v8: at most ONE research set resolved per Saboteur turn.
    return DONE;
  }
  ask(st, t, `Saboteurs cite ${D.WEATHER_NAME[w]} research`, [{ v: 'target', label: 'Raise target by 5', text: `Target ${st.target} → ${st.target + 5}` }, ...(st.reportDeck.length ? [{ v: 'discard', label: 'Discard a Security Report', text: `${st.reportDeck.length} cards in deck` }] : [])], 'Choose the consequence of their completed research set.');
};
