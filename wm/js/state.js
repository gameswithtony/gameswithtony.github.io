import * as D from './data.js';
import { shuffle, pick } from './rng.js';
import { log, add, DONE, H, ask, takeAnswer } from './runner.js';
import { store, items, canStore, repack } from './workshop.js';
import { target, voucher, cp, benefits, canPay } from './economy.js';

export const LOCATIONS = [1, 2, 3, 4];
export const locationKind = l => ({ 1: 'supply', 2: 'government', 3: 'lab', 4: 'rd' })[l];
export const challenge = (st, n) => st.challenges.includes(n);
export const occupied = (st, location, space, except) => Object.entries(st.positions).find(([who, p]) => who !== except && p?.location === location && p.space === space)?.[0] || null;
export const freeSpaces = (st, location, except) => Array.from({ length: location === 1 ? 4 : 3 }, (_, i) => i).filter(s => !occupied(st, location, s, except));
export const saboteurBots = st => ['government', 'lab', 'rd'].flatMap(k => D.WEATHER.flatMap(w => st[k][w])).filter(s => s.owner === 'saboteurs').length;
export const saboteurAvailable = st => saboteurBots(st) < 12;
export const botCount = (st, owner, kind, weather) => st[kind][weather].filter(s => s.owner === owner).length;
export const level = (st, w) => st.extreme[w].level;
export const tileData = (st, w) => D.EXTREME[w][Math.max(0, level(st, w) - 1)];
export function endGame(st, won, reason) {
  st.over = true; st.result = { won, reason }; st.prompt = null; st.stack = [];
  log(st, 'system', `${won ? 'Victory' : 'Defeat'}: ${reason}`);
}
export function triggerEnd(st, reason) {
  if (st.endRound !== null) return;
  st.endRound = st.round + 1; st.endReason = reason;
  log(st, 'system', `${reason} Final round: ${st.endRound}.`);
}
export function checkEnd(st) {
  if (st.p.nobel) triggerEnd(st, 'You earned the Nobel Prize.');
  if (D.WEATHER.every(w => st.government[w].every(s => s.owner))) triggerEnd(st, 'The Government Machine is complete.');
  if (D.WEATHER.every(w => st.rd[w].every(s => s.owner))) triggerEnd(st, 'All R&D spaces are occupied.');
}
export function worsen(st, weather) {
  const e = st.extreme[weather];
  if (!e.stack.length) { log(st, 'system', `No further ${weather} Extreme Weather tile is available.`); return; }
  e.level = e.stack.shift(); e.layers.push(e.level); e.markers = [];
  log(st, 'system', `${D.WEATHER_NAME[weather]} worsens to Level ${e.level}.`);
}
export function fixWeather(st, weather, marker, chosenSpace) {
  const e = st.extreme[weather];
  if (!e.level) return false;
  if (marker === 'government' && D.WEATHER.reduce((n, w) => n + st.extreme[w].markers.filter(m => m === 'government').length, 0) >= 3) return false;
  const count = tileData(st, weather).spaces.length;
  if (!e.markers.length) e.markers = Array(count).fill(null);
  const space = chosenSpace ?? e.markers.findIndex(x => !x);
  if (space < 0 || e.markers[space]) return false;
  e.markers[space] = marker;
  if (e.markers.filter(Boolean).length >= count) {
    e.stack.unshift(e.layers.pop()); e.level = e.layers.at(-1) || 0; e.markers = [];
    log(st, 'system', `${D.WEATHER_NAME[weather]} weather fixed.`);
  }
  return true;
}
export function takeResearch(st, owner, kind, weather, fallback = 'investment') {
  if (st.research[kind][weather] > 0) {
    st.research[kind][weather]--;
    const token = { kind, weather };
    if (owner === 'you') st.p.pending.push(token); else st.saboteurs.tokens.push(token);
    log(st, owner, `Took ${D.VOUCHER_NAME[kind]} ${D.WEATHER_NAME[weather]} research.`);
  } else if (owner === 'you') {
    if (fallback === 'investment') st.p.investments++;
    else if (fallback === 'science') voucher(st, 'science');
  } else if (fallback !== 'none') target(st, 5, 'Research exhausted');
}
export function takeAward(st, owner) {
  if (!st.awardReserve) { log(st, owner, 'No Award token remains in the reserve.'); return false; }
  st.awardReserve--;
  if (owner === 'saboteurs') st.saboteurs.awards++;
  else { st.p.awards++; st.p.totalAwards++; if (st.p.totalAwards >= 3) st.p.nobel = true; }
  return true;
}
export function unlock(st, weather, owner) {
  if (!st.locked[weather]) return false;
  st.locked[weather] = false;
  log(st, owner, `${D.WEATHER_NAME[weather]} citations unlocked.`);
  if (owner === 'saboteurs' && challenge(st, 12)) target(st, 5, 'Publish or Perish');
  if (owner === 'you' && !challenge(st, 9)) add(st, { t: 'unlock', weather });
  return true;
}
export function moveLativ(st) {
  let location = st.positions.lativ.location;
  do { location++; } while (location < 5 && location > 1 && !freeSpaces(st, location, 'lativ').length);
  st.positions.lativ = { location, space: location === 5 || location === 1 ? -1 : freeSpaces(st, location, 'lativ')[0] };
  log(st, 'lativ', `Moved to ${D.LOCATION_NAME[location]}.`);
  // Two-player depletion applies to the location Lativ ENTERS.
  if (location === 2 || location === 4) {
    const kind = locationKind(location), w = st.assistant;
    if (st.research[kind][w] > 0) { st.research[kind][w]--; log(st, 'lativ', `Removed ${kind} ${w} research.`); }
  }
  if (D.WEATHER.reduce((n, w) => n + botCount(st, 'lativ', 'lab', w), 0) < 5) {
    for (let i = 0; i < 5; i++) {
      const w = D.WEATHER[(D.WEATHER.indexOf(st.assistant) + i) % 5];
      if (st.lab[w].some(s => s.owner === 'lativ')) continue;
      const s = st.lab[w].findLast(s => !s.owner);
      if (s) { s.owner = 'lativ'; log(st, 'lativ', `Placed a Bot in ${w}.`); break; }
    }
  }
}
export function returnBot(st, slot) {
  if (slot.owner === 'you') {
    if (!store(st, 'bot', null, slot.id)) {
      const i = st.p.assembly.findIndex((present, j) => !present && j < 6);
      if (i < 0) throw new Error('No Assembly space for returned Bot');
      st.p.assembly[i] = true;
      // A bot identity follows its current Assembly slot when reconstructed.
    }
  }
  delete slot.owner; delete slot.id;
}
export function placeYourBot(st, kind, weather, space) {
  const item = items(st, 'bot')[0]; if (!item) throw new Error('No available Bot');
  st.p.items.splice(st.p.items.indexOf(item), 1);
  const s = st[kind][weather][space];
  if (s.owner === 'lativ') {
    const empty = st.lab[weather].find(x => !x.owner);
    if (empty) empty.owner = 'lativ';
  }
  s.owner = 'you'; s.id = item.id; repack(st);
}
export function activateGovernment(st, weather) {
  cp(st, 3 * botCount(st, 'you', 'government', weather), `${weather} Government Machine`);
  target(st, 3 * botCount(st, 'saboteurs', 'government', weather), `${weather} Government Machine`);
  fixWeather(st, weather, 'government');
  checkEnd(st);
}
export function newState(options = {}) {
  const seed = (options.seed ?? (Date.now() ^ Math.random() * 0x7fffffff)) | 0;
  const st = {
    version: 1, seed, rng: seed, challenges: [...new Set(options.challenges || [])].filter(n => n >= 1 && n <= 12).sort((a, b) => a - b),
    round: 0, phase: 'supply', turn: null, turnOrder: ['you', 'saboteurs'], initiative: ['you', 'saboteurs'],
    target: 35, awardReserve: 12, positions: { you: { location: 1, space: 0 }, lativ: { location: 1, space: -1 }, white: null, pink: null },
    p: { cp: 0, vouchers: { supply: 4, government: 1, lab: 1, rd: 1, science: 2 }, funding: { government: 0, lab: 0, rd: 0 },
      items: [], workshop: [], assembly: Array(12).fill(true), office: Array.from({ length: 6 }, () => ({ weather: null, tokens: [null, null, null], published: false, breakthrough: false })),
      pending: [], awards: 0, totalAwards: 0, nobel: false, investments: 0, subsidies: [], goals: [], activeGoals: [] },
    supply: Object.fromEntries(D.COLORS.map(c => [c, 5])),
    saboteurs: { chemicals: Object.fromEntries(D.COLORS.map(c => [c, 0])), tokens: [], awards: 0 },
    research: Object.fromEntries(['government', 'lab', 'rd'].map(k => [k, Object.fromEntries(D.WEATHER.map(w => [w, 2]))])),
    locked: Object.fromEntries(D.WEATHER.map(w => [w, true])),
    government: Object.fromEntries(D.WEATHER.map(w => [w, D.GOV[w].map(() => ({}))])),
    lab: Object.fromEntries(D.WEATHER.map(w => [w, D.LAB[w].map((_, i) => i === D.LAB[w].length - 1 ? { owner: 'lativ' } : {})])),
    rd: Object.fromEntries(D.WEATHER.map(w => [w, D.RD[w].map(() => ({}))])),
    extreme: Object.fromEntries(D.WEATHER.map(w => [w, { level: 1, layers: [1], stack: [2, 3], markers: [] }])),
    governmentSubsidies: {}, workshopOffer: [], workshopDeck: [], experiments: [], experimentDeck: [], experimentNext: null,
    reportDeck: [], reportDiscard: [], currentReport: null, assistant: null,
    endRound: null, endReason: null, over: false, result: null, stack: [], prompt: null, log: [], seq: 0, itemSeq: 0,
  };
  if (!D.WORKSHOPS.length) throw new Error('Workshop component data has not been verified.');
  const tiles = shuffle(st, D.WORKSHOPS.map((_, i) => i));
  st.p.workshop.push({ id: tiles.pop(), row: 1, col: 1, flip: false });
  st.workshopOffer = tiles.splice(0, 4); st.workshopDeck = tiles;
  store(st, 'part', pick(st, D.COLORS));
  const subsidies = shuffle(st, D.SUBSIDIES.map(s => s.id));
  D.WEATHER.forEach(w => { st.governmentSubsidies[w] = subsidies.splice(0, 3).map(id => ({ id, used: false, part: null })); });
  st.experimentDeck = [1, 2, 3].flatMap(stage => shuffle(st, D.EXPERIMENTS.filter(e => e.stage === stage).map(e => e.id)).slice(0, stage === 3 ? 2 : 5));
  st.experiments = st.experimentDeck.splice(0, 3); st.experimentNext = st.experimentDeck.shift();
  st.assistant = D.EXPERIMENTS[st.experimentDeck[0]].weather;
  let reports = shuffle(st, D.REPORTS.map(r => r.id));
  const setupReports = [];
  for (const id of reports) {
    const c = D.REPORTS[id];
    if (![2, 3, 4].includes(c.location) || setupReports.some(other => D.REPORTS[other].agent === c.agent)) continue;
    setupReports.push(id);
    const kind = locationKind(c.location); takeResearch(st, 'saboteurs', kind, c.weather);
    st.positions[c.agent] = { location: c.location, space: occupied(st, c.location, 1) ? 2 : 1 };
    if (setupReports.length === 2) break;
  }
  st.reportDiscard = setupReports;
  st.reportDeck = shuffle(st, reports.filter(id => !setupReports.includes(id)));
  st.currentReport = st.reportDeck.shift();
  const initialChemicals = challenge(st, 1) ? [...D.COLORS] : shuffle(st, [...D.COLORS]).slice(0, 2);
  if (challenge(st, 4)) initialChemicals.push(pick(st, D.COLORS));
  if (challenge(st, 11)) initialChemicals.push(pick(st, D.COLORS));
  initialChemicals.forEach(c => { st.supply[c]--; st.saboteurs.chemicals[c]++; });
  if (challenge(st, 3)) takeAward(st, 'saboteurs');
  if (challenge(st, 10)) takeAward(st, 'saboteurs');
  if (challenge(st, 6)) st.reportDeck.splice(0, 2);
  if (challenge(st, 12)) st.target -= 5;
  const goalPool = shuffle(st, D.GOALS.filter(g => !g.majority && g.condition !== 'awards3').map(g => g.id));
  function chooseGoals(index, selected, used) {
    if (index === 6) return selected;
    const kind = ['government', 'lab', 'rd'][Math.floor(index / 2)];
    for (const id of goalPool) {
      const g = D.GOALS[id], middle = g.middle || g.condition;
      if (g.kind !== kind || selected.includes(id) || used.has(middle)) continue;
      const result = chooseGoals(index + 1, [...selected, id], new Set([...used, middle]));
      if (result) return result;
    }
    return null;
  }
  st.p.goals = chooseGoals(0, [], new Set());
  if (!st.p.goals) throw new Error('Unable to select six distinct solo Goals.');
  log(st, 'system', `Weather Machine · The Saboteurs · seed ${seed}.`);
  add(st, { t: 'setupWorkshop' }, { t: 'setupSupply' });
  return st;
}
H.unlock = (st, t) => {
  const a = takeAnswer(t);
  if (t.paid) { cp(st, 3, 'Unlocked citations'); return DONE; }
  if (a !== undefined) { if (a) { t.paid = true; add(st, { t: 'pay', cost: ['science'], reason: 'Recognize your first publication' }); return; } return DONE; }
  if (!canPay(st, ['science'])) return DONE;
  ask(st, t, 'Recognize your first publication', [{ v: true, label: 'Pay 1 Science → gain 3 CP' }, { v: false, label: 'Keep Science voucher' }], `${D.WEATHER_NAME[t.weather]} citations are now unlocked.`);
};
