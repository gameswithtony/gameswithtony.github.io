import * as D from './data.js';
import { H, DONE, ask, add, takeAnswer, log } from './runner.js';
import { ACTIONS, LOCATION_ACTIONS, actionAvailable, actionReason } from './actions.js';
import { canPay, benefits, cp, target, voucher } from './economy.js';
import { items, repack, canStore, store } from './workshop.js';
import { challenge, occupied, freeSpaces, locationKind, moveLativ, endGame, triggerEnd, checkEnd, returnBot, takeResearch, worsen, saboteurBots } from './state.js';
import { immediateVictory, finalVictory, metGoals, officeSpaces } from './office.js';
import { report } from './bots.js';

export function movementOptions(st) {
  const out = [], current = st.positions.you.location;
  for (const location of [1, 2, 3, 4]) {
    if (location === current) continue;
    const free = freeSpaces(st, location, 'you');
    for (const space of free) {
      if (st.round === 1 && location !== 1) {
        if (space === 0 || space === 2 && free.includes(1)) continue;
      }
      const left = Object.entries(st.positions).filter(([who, p]) => who !== 'you' && who !== 'lativ' && p?.location === location && p.space < space).length;
      if (location === 1 && Object.values(st.p.vouchers).reduce((n, v) => n + v, 0) + 1 + Number(st.positions.lativ.location === 1) < left) continue;
      const kind = location === 1 ? 'any' : D.LOCATION_GAIN[location];
      const science = st.positions.lativ.location === location && (location === 1 || st.positions.lativ.space < space);
      out.push({ location, space, kind, n: location === 1 ? 1 : 1 + (challenge(st, 8) ? 0 : left), science, toll: location === 1 ? left : 0 });
    }
  }
  return out;
}
export function humanMenu(st, setup = false) {
  const location = setup ? 1 : st.positions.you.location, turn = st.turn;
  const options = LOCATION_ACTIONS[location].map(kind => {
    const used = !setup && location !== 1 && (turn.used.includes(kind) || turn.used.length >= turn.limit);
    const available = actionAvailable(st, kind);
    return { v: kind, label: ACTIONS[kind].name, text: ACTIONS[kind].text, icon: ACTIONS[kind].icon, disabled: used ? 'Action allowance used' : available ? false : actionReason(st,kind) };
  });
  if (!setup) {
    if (st.currentReport !== null && st.reportDeck.length >= 2) options.push({ v: 'security', label: 'Call Security', text: '1 local or Science voucher · rearrange 3 Reports', icon: 'security', disabled: !canPay(st, { [locationKind(location)]: 1 }) && 'Need a matching voucher' });
    if (st.p.awards && officeSpaces(st, { kind: 'award' }).length) options.push({ v: 'award', label: 'Place an Award', text: `${st.p.awards} available · free action`, icon: 'award' });
  }
  options.push({ v: 'done', label: setup ? 'Finish initial Supply round' : 'End your turn', text: setup ? 'Begin round 1' : 'Record research, then continue the round', icon: 'next', primary: true });
  return options;
}
H.setupWorkshop = (st,t) => {
  const a=takeAnswer(t),tile=st.p.workshop[0],d=D.WORKSHOPS[tile.id];
  if(a!==undefined){tile.flip=a;return DONE;}
  ask(st,t,'Orient your first Workshop tile',[{v:false,label:`${D.COLOR_NAME[d.top]} above`,text:`${D.COLOR_NAME[d.bottom]} below`,tile:tile.id},{v:true,label:`${D.COLOR_NAME[d.bottom]} above`,text:`${D.COLOR_NAME[d.top]} below`,tile:tile.id,flip:true}],'Your starting tile goes beside the middle row. Choose its permanent orientation.','workshop');
};
H.setupSupply = (st, t) => {
  const a = takeAnswer(t);
  if (a === 'done') { st.round = 1; add(st, { t: 'round' }); return DONE; }
  if (a !== undefined) { add(st, { t: 'action', kind: a }); return; }
  ask(st, t, 'Prepare your Laboratory', humanMenu(st, true), 'Initial Supply round · take any number of Supply actions, paying as usual. You begin with 4 Supply and 2 Science vouchers.', 'menu');
};
H.round = (st, t) => {
  if (!t.stage) {
    st.phase = 'turns'; t.stage = 'afterTurns';
    log(st, 'system', `Round ${st.round}${st.endRound === st.round ? ' · final round' : ''}.`);
    add(st, ...st.turnOrder.map(who => ({ t: who === 'you' ? 'human' : 'botTurn' }))); return;
  }
  if (t.stage === 'afterTurns') {
    t.stage = 'afterExperiment'; st.phase = 'experiments';
    if (st.endRound === st.round) {
      add(st, ...D.WEATHER.map((_, i) => D.WEATHER[(D.WEATHER.indexOf(st.assistant) + i) % 5]).map(weather => ({ t: 'experiment', weather, final: true }))); return;
    }
    add(st, { t: 'experiment', weather: st.assistant }); return;
  }
  if (st.endRound === st.round) { add(st, { t: 'final' }); return DONE; }
  if (t.stage === 'afterExperiment') {
    t.stage = 'next'; st.phase = 'endRound';
    st.turnOrder = [...st.initiative];
    if (st.positions.lativ.location === 5) { add(st, { t: 'income' }); return; }
  }
  st.round++; add(st, { t: 'round' }); return DONE;
};
H.human = (st, t) => {
  if (!t.stage) {
    st.phase = 'you';
    if (immediateVictory(st)) { endGame(st, true, 'You restored the good name of Lightning Technologies.'); return DONE; }
    t.stage = 'move'; add(st, { t: 'useTile' }); return;
  }
  if (t.stage === 'move') { t.stage = 'actions'; add(st, { t: 'move' }); return; }
  if (t.stage === 'actions') {
    const pos = st.positions.you;
    st.turn = { used: [], limit: pos.location === 1 ? 999 : pos.space === 0 ? 2 : 1 };
    t.stage = 'research'; add(st, { t: 'menu' }); return;
  }
  if (t.stage === 'research') { t.stage = 'finish'; add(st, { t: 'placeResearch' }); return; }
  if (D.WEATHER.filter(w => st.extreme[w].level === 3).length >= 2) { endGame(st, false, 'Two Level 3 Extreme Weather tiles remain at the end of your turn.'); return DONE; }
  if (challenge(st, 7) && st.initiative[0] === 'saboteurs') target(st, 3, 'One Step Ahead');
  st.turn = null; checkEnd(st); return DONE;
};
H.move = (st, t) => {
  const a = takeAnswer(t);
  if (t.stage === 'finish') {
    if (st.positions.lativ.location === t.location) moveLativ(st);
    return DONE;
  }
  const opts = movementOptions(st);
  if (a !== undefined) {
    const selected = opts.find(o => o.location === a.location && o.space === a.space);
    st.positions.you = { location: selected.location, space: selected.space };
    t.location = selected.location; t.stage = 'finish';
    log(st, 'you', `Moved to ${D.LOCATION_NAME[selected.location]}, space ${selected.space + 1}.`);
    const tasks = [];
    if (selected.kind === 'any') tasks.push({ t: 'benefit', benefit: { type: 'voucher', kind: 'any' } });
    else voucher(st, selected.kind, selected.n);
    if (selected.science) tasks.push({ t: 'benefit', benefit: { type: 'voucher', kind: 'science' } });
    if (selected.toll) tasks.push({ t: 'pay', cost: Array(selected.toll).fill('any'), reason: 'Supply entry toll' });
    add(st, ...tasks); return;
  }
  ask(st, t, 'Move your Scientist', opts.map(o => ({ v: { location: o.location, space: o.space }, label: `${D.LOCATION_NAME[o.location]} · ${o.space === 0 ? 'left' : o.space === 1 ? 'middle' : o.space === 2 ? 'right' : 'space 4'}`, text: `+${o.n} ${o.kind === 'any' ? 'any voucher' : D.VOUCHER_NAME[o.kind]}${o.science ? ' + 1 Science' : ''}${o.toll ? ' · pay ' + o.toll + ' any' : ''}`, icon: locationKind(o.location), detail: o.location === 1 ? 'Any number of actions' : o.space === 0 ? 'Both actions available' : 'Choose one action' })), st.round === 1 ? 'Round 1: use the middle space when free, otherwise the right. The left space opens in round 2.' : 'Choose an empty space at a different Location. Vouchers are gained before Lativ moves.', 'move');
};
H.menu = (st, t) => {
  const a = takeAnswer(t);
  if (a === 'done') return DONE;
  if (a === 'security') { add(st, { t: 'security' }); return; }
  if (a === 'award') { add(st, { t: 'award' }); return; }
  if (a !== undefined) { add(st, { t: 'action', kind: a }); return; }
  const p = st.positions.you;
  ask(st, t, `${D.LOCATION_NAME[p.location]} actions`, humanMenu(st), p.location === 1 ? 'Any number of Supply actions. Call Security and Awards are free actions.' : `${st.turn.used.length} / ${st.turn.limit} action${st.turn.limit === 1 ? '' : 's'} used · each Location action at most once.`, 'menu');
};
H.security = (st, t) => {
  const a = takeAnswer(t);
  if (!t.stage) { t.stage = 'draw'; add(st, { t: 'pay', cost: { [locationKind(st.positions.you.location)]: 1 }, reason: 'Call Security' }); return; }
  if (t.stage === 'draw') { t.cards = [st.currentReport, ...st.reportDeck.splice(0, 2)]; t.stage = 'current'; }
  const desc = id => { const c = D.REPORTS[id]; return { label: `Agent ${c.agent} · ${c.location === 'lativ' ? 'follow Lativ' : D.LOCATION_NAME[c.location]}`, text: `${D.WEATHER_NAME[c.weather]} · ${c.priority} priority`, report: id }; };
  if (t.stage === 'current') {
    if (a !== undefined) { t.current = a; t.stage = 'top'; return; }
    ask(st, t, 'Choose the Current Report', t.cards.map(id => ({ v: id, ...desc(id) })), 'This card will control the next Saboteur turn.'); return;
  }
  if (a !== undefined) {
    st.currentReport = t.current; st.reportDeck.unshift(a); st.reportDiscard.push(t.cards.find(id => id !== t.current && id !== a));
    log(st, 'you', 'Called Security: chose Current Report, returned one to the deck, discarded one.'); return DONE;
  }
  ask(st, t, 'Return one Report to the top of the deck', t.cards.filter(id => id !== t.current).map(id => ({ v: id, ...desc(id) })), 'The remaining Report is discarded and becomes the Previous Report.');
};
H.income = (st, t) => {
  const a = takeAnswer(t);
  if (!t.stage) {
    t.stage = 'challenges';
    log(st, 'system', 'Income: empty spaces in the top two Assembly sections pay their benefits again.');
    benefits(st, st.p.assembly.flatMap((present, i) => !present && i < 6 ? D.ASSEMBLY[i].reward : [])); return;
  }
  if (t.stage === 'challenges') {
    t.stage = 'finish';
    if (challenge(st, 2)) target(st, saboteurBots(st), 'Jamming Devices');
    if (challenge(st, 3)) {
      const opts = Object.keys(st.p.funding).filter(k => st.p.funding[k] > 0);
      if (opts.length) { t.stage = 'accounting'; ask(st, t, 'Creative Accounting', opts.map(k => ({ v: k, label: `Move ${D.VOUCHER_NAME[k]} funding back one`, text: `${st.p.funding[k]} → ${st.p.funding[k] - 1}` }))); return; }
    }
  }
  if (t.stage === 'accounting') { st.p.funding[a]--; }
  st.positions.lativ = { location: 1, space: -1 }; log(st, 'lativ', 'Returned to Supply after income.'); return DONE;
};
H.experiment = (st, t) => {
  const a = takeAnswer(t), w = t.weather;
  if (!t.stage) {
    const tile = st.experiments.findLast(id => D.EXPERIMENTS[id].weather === w);
    t.id = tile ?? null; t.runs = tile !== undefined && st.lab[w].every(s => s.owner);
    if (t.final && !t.runs) return DONE;
    t.stage = 'participants'; t.participants = [...st.turnOrder];
    t.lativ = st.lab[w].some(s => s.owner === 'lativ');
    t.saboteurs = st.lab[w].filter(s => s.owner === 'saboteurs').length;
    log(st, 'system', `${D.WEATHER_NAME[w]} experiment ${t.runs ? 'runs' : 'does not run'}.`);
    return;
  }
  if (t.stage === 'participants') {
    if (!t.participants.length) { t.stage = 'cleanup'; return; }
    const who = t.participants[0], bots = st.lab[w].filter(s => s.owner === who);
    if (!bots.length) { t.participants.shift(); return; }
    if (who === 'saboteurs') {
      if (t.runs) { bots.forEach(s => returnBot(st, s)); target(st, bots.length * D.EXPERIMENTS[t.id].cp, `${w} experiment`); takeResearch(st, 'saboteurs', 'lab', w, 'none'); }
      t.participants.shift(); return;
    }
    if (!t.runs) {
      if (a !== undefined) { if (a) add(st, ...st.lab[w].flatMap((s,space) => s.owner === 'you' ? [{t:'returnYourBot',weather:w,space}] : [])); t.participants.shift(); return; }
      ask(st, t, `${D.WEATHER_NAME[w]} experiment cannot run`, [{ v: false, label: `Leave ${bots.length} Bot${bots.length > 1 ? 's' : ''} in the branch` }, { v: true, label: 'Return your Bots to Workshop' }], 'Returned Bots that cannot fit go to an empty space in either top Assembly section.', 'experiment'); return;
    }
    t.count = bots.length; t.stage = 'reward'; add(st, ...st.lab[w].flatMap((s,space) => s.owner === 'you' ? [{t:'returnYourBot',weather:w,space}] : [])); return;
  }
  if (t.stage === 'reward') {
    const d = D.EXPERIMENTS[t.id];
    if (a === 'skip') { t.participants.shift(); t.stage = 'participants'; return; }
    if (a !== undefined) {
      t.stage = 'record'; t.reward = a;
      add(st, { t: 'pay', cost: Array(d.cost).fill('science'), reason: `${D.WEATHER_NAME[w]} experiment reward` }, { t: 'experimentReward', id: t.id, count: t.count, choice: a, weather: w }); return;
    }
    const can = canPay(st, Array(d.cost).fill('science'));
    ask(st, t, `${D.WEATHER_NAME[w]} experiment reward`, [...d.rewards.map((reward, i) => ({ v: i, label: `+${t.count * d.cp} CP + ${D.benefitText(reward)}`, text: `${d.cost} Science · gain research if available`, disabled: !can && 'Not enough vouchers' })), { v: 'skip', label: 'Take Bots back without rewards' }], `${t.count} Bot${t.count === 1 ? '' : 's'} returned. Pay Science once, score CP for each Bot.`, 'experiment'); return;
  }
  if (t.stage === 'record') { t.participants.shift(); t.stage = 'participants'; return; }
  if (t.stage === 'cleanup') {
    st.lab[w].filter(s => s.owner === 'lativ').forEach(s => returnBot(st, s));
    if (t.runs && t.lativ && st.research.lab[w]) { st.research.lab[w]--; log(st, 'lativ', `Removed ${w} Lab research after experiment.`); }
    if (!t.final && (t.runs || t.saboteurs)) worsen(st, w);
    if (t.id !== null) {
      st.experiments.splice(st.experiments.lastIndexOf(t.id), 1);
      if (!t.final && st.experimentNext !== null) {
        st.experiments.unshift(st.experimentNext);
        st.experimentNext = st.experimentDeck.length ? st.experimentDeck.shift() : null;
        if (st.experimentNext === null) triggerEnd(st, 'The last Experiment entered the display.');
      }
    }
    if (!t.final) st.assistant = D.WEATHER[(D.WEATHER.indexOf(w) + 1) % 5];
    return DONE;
  }
};
H.experimentReward = (st, t) => {
  if (!t.stage) { t.stage = 'research'; cp(st, t.count * D.EXPERIMENTS[t.id].cp, 'Experiment'); benefits(st, D.EXPERIMENTS[t.id].rewards[t.choice]); return; }
  if (t.stage === 'research') { t.stage = 'finish'; takeResearch(st, 'you', 'lab', t.weather, 'science'); add(st, { t: 'placeResearch' }); return; }
  return DONE;
};
H.returnYourBot = (st,t) => {
  const slot=st.lab[t.weather][t.space],a=takeAnswer(t);
  if(slot.owner!=='you')return DONE;
  if(canStore(st,'bot')){store(st,'bot',null,slot.id);delete slot.owner;delete slot.id;return DONE;}
  const opts=st.p.assembly.flatMap((present,i)=>!present&&i<6?[{v:i,label:`Assembly slot ${i+1}`,text:D.benefitText(D.ASSEMBLY[i].reward)+' at future income'}]:[]);
  if(!opts.length)throw new Error('Returning Bot has no Workshop or Assembly space.');
  if(a!==undefined){st.p.assembly[a]=true;delete slot.owner;delete slot.id;return DONE;}
  ask(st,t,'Return a Bot to Assembly',opts,'Your Workshop is full. Choose an empty space in either top Assembly section; you lose its income until reconstructed.');
};
H.final = (st, t) => {
  const a = takeAnswer(t);
  if (!t.stage) { st.phase = 'final'; t.stage = 'prepare'; target(st, 30, 'Final scoring'); add(st, { t: 'placeResearch' }); return; }
  if (t.stage === 'prepare') {
    if (a === 'award') { add(st, { t: 'award' }); return; }
    if (a === 'investment') { add(st, { t: 'useTile', investmentOnly: true }); return; }
    if (a === 'score') { t.stage = 'score'; return; }
    const opts = [];
    if (st.p.awards && officeSpaces(st, { kind: 'award' }).length) opts.push({ v: 'award', label: 'Place an Award' });
    if (st.p.investments && (st.p.goals.length || st.p.activeGoals.some(g => !g.flipped))) opts.push({ v: 'investment', label: 'Use an Investment', text: 'Set or flip a Goal' });
    ask(st, t, 'Prepare final scoring', [...opts, { v: 'score', label: 'Score the game', primary: true }], 'Place remaining Awards and use Investments to set or flip Goals.'); return;
  }
  for (const kind of ['government', 'lab', 'rd']) cp(st, D.FUNDING[kind][st.p.funding[kind]].cp, `${D.VOUCHER_NAME[kind]} funding`);
  cp(st, 5 * metGoals(st), 'Completed Goals');
  if (st.p.nobel) cp(st, 5, 'Nobel Prize');
  const won = finalVictory(st);
  endGame(st, won, challenge(st, 12) ? 'Publish or Perish requires immediate victory.' : `Final score ${st.p.cp}; target ${st.target}. Your score must be higher than the target.`);
  return DONE;
};
