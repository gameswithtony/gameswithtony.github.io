// Tap-to-explain text: icon, name, current value, a few short lines. One entry for each thing on the table.
import * as D from './data.js';
import * as E from './engine.js';

const tip = (ic, t, v, d, rule, rows) => ({ ic, t, v: v === undefined || v === null ? '' : String(v), d: [].concat(d || []).filter(Boolean), rule: rule || '', rows: rows || null });
const W = D.WEATHER_NAME, VN = D.VOUCHER_NAME, CN = D.COLOR_NAME, LN = D.LOCATION_NAME;
const ben = list => D.benefitText(list) || 'No benefit';
const s = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const OWNER = { you: 'Your Bot', saboteurs: 'Saboteur Bot', lativ: 'Lativ’s Bot' };
const KIND_ACTION = { government: 'Sell a Part', lab: 'Work on Experiment', rd: 'Research' };
const POSITION = ['Left', 'Middle', 'Right'];
const OFFICE_KINDS = ['government', 'lab', 'rd'];
const leftOf = (st, location, space) => Object.entries(st.positions).filter(([who, p]) => who !== 'you' && who !== 'lativ' && p?.location === location && p.space < space).length;
const held = (st, type) => D.COLORS.filter(c => E.items(st, type, c).length).map(c => `${CN[c]}: ${E.items(st, type, c).length}`);

const VOUCHER_USE = {
  supply: 'Extend your Workshop, construct Bots, acquire Chemicals, or take the Initiative.',
  government: 'Sell a Part (1) or secure a Subsidy (2).',
  lab: 'Work on an Experiment (1) or publish a Paper (2).',
  rd: 'Research (1) or make a Breakthrough (2).',
  science: 'Substitutes for any other voucher, claims Experiment rewards, pays for Breakthroughs.',
};

export const ACTION_LINES = {
  extend: ['Pay 1 Supply. Take a tile from the offer, or the top of the deck.', 'Place it next to your Workshop, within its three rows. Touching semicircles must match.', 'A tile holds one Bot or one Part. Two matching edges between rows store a Chemical.'],
  construct: ['Pay the Bot’s Supply cost and gain what its Assembly space shows.', 'The Bot needs a storage space.', 'Empty spaces in the top two sections pay again at income.'],
  buyChemical: ['Pay the leftmost price in that color’s row.', 'Needs matching storage or the any-color space.'],
  returnChemical: ['Gain Supply equal to the price of the space it returns to.'],
  initiative: ['1 Supply: choose who goes first next round. This round’s order stays.'],
  sell: ['1 Government, a Bot and the matching Machine Part on an empty space.', 'Advances Government funding. Take a Subsidy and a Research token.', 'A full branch activates: 3 CP per your Bot, target +3 per Saboteur Bot.'],
  subsidy: ['2 Government: gain the tile’s benefit plus its row and column benefits, then flip it.'],
  work: ['1 Lab, a Bot and the matching Chemical on a space. The Chemical returns to Supply.', 'Advances Lab funding. You can displace Lativ’s Bot.'],
  publish: ['2 Lab: publish a complete Office row.', '2 CP per Research, 4 per Award, 0 per Citation. Gain an Investment and the row’s benefit.', 'A published row can make one Breakthrough.'],
  research: ['1 R&D, a Bot and the matching Chemical. The Chemical stays on the space.', 'Advances R&D funding. Gain the space’s reward and a Research token.'],
  breakthrough: ['2 R&D plus the Science on the Extreme Weather tile, using a published row of that weather.', 'Supply the three R&D Parts plus the tile’s Parts. A Bot on a space may supply its Part. Yours must fit in one Workshop row.', 'Earn an Award and 2 CP per your Bot in the branch and per Part you supply. Each Saboteur Bot used: target +2.'],
};

/** What a board item is, by its data-info key. */
export function explain(st, key) {
  const [kind, ...rest] = key.split(':'), [a, b, c] = rest;
  switch (kind) {
    case 'score': case 'goals': {
      const goals = E.metGoals(st), need = E.challenge(st, 5) ? 5 : 4, tracks = Object.values(st.p.funding).filter(x => x >= 5).length;
      return tip('cp', 'Your Climate Points', `${st.p.cp} of ${st.target}`, [
        'Finish strictly above the target.',
        'Final scoring adds Funding, 5 CP per completed active Goal, and 5 CP for the Nobel Prize.',
        `Immediate victory at the start of your turn: beat the target, ${need} active Goals met, 2 Funding tracks at 5+.`,
        `Now: ${goals} of ${st.p.activeGoals.length} active Goals met, ${tracks} of 2 tracks at 5+.`,
        st.challenges.length ? 'Your Challenges may add restrictions. See the Saboteurs tab.' : '',
      ], 'Solo rules pp. 4-5, 12-13.');
    }
    case 'target': return tip('saboteurs', 'Saboteur target', st.target, ['Your score must end strictly higher.', 'It rises when Saboteurs arrive beside other pieces, run Experiments, fill Government branches, or cite research.', 'Final scoring adds 30 more.'], 'Solo rules pp. 4-5, 12-13.');
    case 'round': return tip('history', st.round ? `Round ${st.round}` : 'Initial Supply', st.endRound === null ? 'No end triggered' : `Final round: ${st.endRound}`, [
      'Turns in order, run the active Experiment, adjust turn order, income if Lativ is in his Office.',
      `Turn order: ${st.turnOrder.map(w => w === 'you' ? 'You' : 'Saboteurs').join(', then ')}.`,
      `Next round: ${st.initiative.map(w => w === 'you' ? 'You' : 'Saboteurs').join(', then ')}.`,
      st.endRound === null ? 'The Nobel Prize, the last Experiment entering the display, a completed Government Machine, or a full R&D area triggers one last round.' : st.endReason,
    ], 'Rulebook pp. 8-9, 20-22.');
    case 'gauge': return tip('report', 'Ways to lose', `${D.WEATHER.filter(w => st.extreme[w].level === 3).length} of 2 at Level 3`, [
      'Two Level 3 Extreme Weather tiles at the end of your turn.', 'No Report available when the Saboteurs’ turn begins.',
    ], 'Solo rules pp. 4-5, 12-13.', [['Weather', 'Level'], ...D.WEATHER.map(w => [W[w], st.extreme[w].level ? `Level ${st.extreme[w].level}` : 'Fixed']), ['Reports left', st.reportDeck.length]]);
    case 'nextMove': return nextMoveTip(st);
    case 'citation': return tip(a, `${W[a]} citations`, st.locked[a] ? 'Locked' : 'Unlocked', [st.locked[a] ? 'Opens with the first paper on this weather, when an R&D branch runs out of research or fills, or when the Saboteurs break it open.' : 'A row of 2 tokens in this weather can give up an unset Goal of the missing color to publish.', st.locked[a] ? 'Saboteurs need all 3 Research colors for a set here.' : 'Saboteurs need only 2 Research colors for a set here.'], 'Rulebook pp. 17-18; Solo rules pp. 6-7.');
    case 'lativ': return tip('lativ', 'Professor Lativ', LN[st.positions.lativ.location], [
      'When a Scientist moves into his Location, he moves to the next one, skipping full ones.',
      'He places a Bot in the Assistant’s branch, or the next eligible branch without one of his Bots.',
      'Entering Government or R&D removes a Research token matching the Assistant’s weather.',
      'If he ends a round in his Office, income happens and he returns to Supply.',
    ], 'Rulebook pp. 11, 21, 23.');
    case 'location': return locationTip(st, Number(a));
    case 'seat': return seatTip(st, Number(a), Number(b));
    case 'voucher': return tip(a, `${VN[a]} vouchers`, `${st.p.vouchers[a]} of ${D.VOUCHER_CAP[a]}`, [VOUCHER_USE[a], 'Anything above the limit is lost.', 'Lacking the type and Science: pay any three other vouchers instead.'], 'Rulebook pp. 7-8.');
    case 'funding': return tip(a, `${VN[a]} funding`, `Space ${st.p.funding[a]} of 9 · ${D.FUNDING[a][st.p.funding[a]].cp} CP`, [
      'Advances when you take this Location’s first action or gain a Funding benefit.',
      a === 'government' ? 'Receiving funding: gain every benefit at and left of your marker.' : a === 'lab' ? 'Receiving funding: gain the Science, then Government or R&D funding at its marker plus the Lab modifier. Markers do not move.' : 'Receiving funding: choose one benefit at or left of your marker.',
    ], 'Rulebook p. 10.', [['Space', 'Final CP', 'Benefit'], ...D.FUNDING[a].map((d, i) => [`${i}${i === st.p.funding[a] ? ' (here)' : ''}`, d.cp, a === 'lab' ? `${d.science} Science, +${d.modifier}` : a === 'rd' ? (d.alternatives || []).map(ben).join(' or ') || 'None' : ben(d.benefits)])]);
    case 'bots': return tip('bot', 'Your Bots', `${E.items(st, 'bot').length} ready`, [`Constructed: ${st.p.assembly.filter(x => !x).length} of 12.`, `On the board: ${['government', 'lab', 'rd'].reduce((n, k) => n + D.WEATHER.reduce((m, w) => m + E.botCount(st, 'you', k, w), 0), 0)}.`, 'Each needs a Workshop space: the base Bot space or a tile.'], 'Rulebook pp. 7, 13.');
    case 'parts': return tip('part', 'Machine Parts', `${E.items(st, 'part').length} held`, [...held(st, 'part'), 'Sell them in Government or build prototypes in R&D.', 'Each needs a Workshop space: the base Part space or a tile.'], 'Rulebook pp. 7, 13.');
    case 'chemicals': return tip('chemical', 'Chemicals', `${E.items(st, 'chemical').length} held`, [...held(st, 'chemical'), 'Used for Experiments in the Lab and Research in R&D.', 'Each needs matching storage or the any-color space.'], 'Rulebook pp. 7, 13.');
    case 'inventory': return tip('workshop', 'Workshop storage', `${st.p.items.length} stored`, ['The app rearranges freely to make room. Tiles never move.'], 'Rulebook pp. 7, 13.');
    case 'workshop': return workshopTip(st, rest.join(':'));
    case 'chemical': return chemicalTip(st, a);
    case 'tile': { const id = Number(a), d = D.WORKSHOPS[id], next = st.workshopDeck[0] === id && !st.workshopOffer.includes(id); return tip('workshop', 'Workshop tile', `${CN[d.top]} / ${CN[d.bottom]}`, [next ? 'Top of the deck. You may take it instead of an offered tile.' : 'In the offer.', 'You may rotate it when placing.', 'Holds one Bot or one Part. Touching semicircles must match. Two matching edges between rows store a Chemical.'], 'Rulebook pp. 7, 13.'); }
    case 'branch': return branchTip(st, a, b);
    case 'space': return spaceTip(st, a, b, Number(c));
    case 'research': return researchTip(st, a, b);
    case 'subsidy': return subsidyTip(st, a, Number(b));
    case 'ownedSubsidy': { const t = st.p.subsidies.find(x => x.id === Number(a)), d = D.SUBSIDIES[t.id]; return tip('subsidy', d.name, t.used ? 'Used' : 'Ready', [ben(d.benefits) + '.', t.used ? 'Already flipped.' : 'Flip it at the start of your turn instead of spending an Investment.', 'A benefit waives voucher costs, not required materials.'], 'Rulebook pp. 9, 14-15, 23.'); }
    case 'weather': return weatherTip(st, a);
    case 'proto': { const e = st.extreme[a], d = E.tileData(st, a); return tip(a, `${W[a]} prototype`, e.level ? `${d.parts.length + 3} Parts · ${d.cost} Science` : 'Weather fixed', e.level ? [`The three R&D space Parts${d.parts.length ? ` plus ${d.parts.map(x => CN[x]).join(', ')}` : ''}.`, `Markers placed: ${e.markers.filter(Boolean).length} of ${d.spaces.length}. Filling all of them fixes this weather.`, 'You may have one marker on each tile.'] : ['A later Experiment or Saboteur havoc can bring it back.'], 'Rulebook pp. 18-19; Solo rules p. 11.'); }
    case 'experiment': return experimentTip(st, Number(a));
    case 'deck': return tip('lab', 'Experiment deck', `${st.experimentDeck.length} left`, ['The next card replaces each Experiment that leaves the display.', 'When the last one enters the display, one last round is triggered.'], 'Rulebook p. 20.');
    case 'assembly': { const i = Number(a), d = D.ASSEMBLY[i], open = E.constructible(st).includes(i); return tip('bot', `Assembly Bot ${i + 1}`, st.p.assembly[i] ? `${d.cost} Supply` : 'Constructed', [`Gain: ${ben(d.reward)}.`, !st.p.assembly[i] ? (i < 6 ? 'This empty space pays again at income.' : 'Already built.') : open ? 'Ready to construct. Needs a Bot storage space.' : i < 9 ? 'Locked until 6 Bots are constructed or you hold 5 Office tokens.' : 'Locked until 9 Bots are constructed or you hold 8 Office tokens.'], 'Rulebook pp. 13, 21.'); }
    case 'office': return officeTip(st, a === undefined ? null : Number(a));
    case 'officeSlot': return officeSlotTip(st, Number(a), Number(b));
    case 'paper': return paperTip(st, Number(a));
    case 'pending': return tip('office', 'Pending research', st.p.pending.length, ['Research you have won but not yet recorded.', 'You record it at the end of your turn. Without a legal Office space it is discarded.'], 'Rulebook pp. 9, 12.');
    case 'goal': return goalTip(st, Number(a));
    case 'investment': return tip('investment', 'Investments', st.p.investments, ['At the start of your turn, spend one to set a Goal and gain its space’s benefit.', 'Or flip an active Goal to receive its Funding track’s benefits. A flipped Goal still scores.'], 'Rulebook pp. 9, 17-19.');
    case 'awards': return tip('award', 'Awards', `${st.p.awards} held · ${st.p.totalAwards} earned`, ['Place held Awards in any empty Office space on your turn. Wild, worth 4 CP when published.', 'Your third Award earns the Nobel Prize: triggers the last round, 5 CP at final scoring.'], 'Rulebook pp. 9, 17-19.');
    case 'report': return reportTip(Number(a));
    case 'reports': return tip('report', 'Security Reports', `${st.reportDeck.length} in deck`, ['The Current Report picks the Agent and destination. The Previous Report picks the weather and priority.', 'No Report when the Saboteurs’ turn begins: you lose.', 'Call Security during your actions to choose the next one.'], 'Solo rules pp. 5-11.');
    case 'initiative': return tip('initiative', 'Next round', st.initiative.map(w => w === 'you' ? 'You' : 'Saboteurs').join(', then '), ['Take the Initiative in Supply to change who goes first next round.'], 'Rulebook pp. 8-9.');
    case 'hideoutBots': return tip('bot', 'Saboteur Bots', `${12 - E.saboteurBots(st)} of 12 ready`, ['White and Pink share one pool. They never pay vouchers or use Parts.'], 'Solo rules pp. 6-7.');
    case 'hideoutAwards': return tip('award', 'Saboteur Awards', st.saboteurs.awards, ['Each fills a missing color in a Research set.'], 'Solo rules pp. 6-7.');
    case 'hideoutChem': return tip('chemical', `${CN[a]} in the Hideout`, st.saboteurs.chemicals[a], ['Chemicals the Saboteurs have taken out of Supply.'], 'Solo rules pp. 6-7.');
    case 'havoc': { const have = OFFICE_KINDS.filter(k => st.saboteurs.tokens.some(t => t.weather === a && t.kind === k)); return tip(a, `${W[a]} research set`, st.locked[a] ? 'Locked weather' : 'Unlocked weather', [`Holding: ${have.map(k => VN[k]).join(', ') || 'none'}.`, st.locked[a] ? 'A set needs all three colors. It worsens this weather, discards a Report, and unlocks citations.' : 'A set needs two different colors. You choose: target +5, or discard a Report.', 'Awards fill missing colors. At most one set per Saboteur turn, locked first.'], 'Solo rules v8 pp. 6-7.'); }
    default: return tip('info', 'Weather Machine', '', ['Tap any Location, branch, resource, or action for its rule.']);
  }
}

const PLAN = { 1: ['Takes the Initiative, or target +2 if it already has it, then 2 Chemicals.'], 2: ['Takes a Chemical and flips a Subsidy, then places a Bot if a Chemical matches.', 'Places a Bot if a Chemical matches, replaces a Subsidy and takes Research.'], 3: ['Takes an Award, then places a Bot in the Lab branch with the most Bots.', 'Places a Bot in the Lab branch with the most Bots.'], 4: ['Places an extra Bot by the Previous Report, then one more if a Chemical matches.', 'Places a Bot in R&D if a Chemical matches and takes Research.'] };
function nextMoveTip(st) {
  if (st.currentReport === null) return tip('report', 'No Report left', '', ['If the Saboteurs’ turn begins with no Report, you lose.'], 'Solo rules p. 5.');
  const m = E.saboteurMove(st), c = D.REPORTS[st.currentReport], prev = D.REPORTS[st.reportDiscard.at(-1)], name = m.agent === 'pink' ? 'Agent Pink' : 'Agent White';
  const left = m.location === 1 ? 0 : Object.entries(st.positions).filter(([who, p]) => who !== m.agent && p?.location === m.location && p.space < m.space).length;
  const sentTo = c.location === 'lativ' ? 'Follows Lativ.' : c.location !== m.location ? `The Report says ${LN[c.location]}, which is blocked, so they move on.` : '';
  return tip('saboteurs', `${name}’s next move`, m.location === 1 ? `Supply, space ${m.space + 1}` : `${LN[m.location]}, ${POSITION[m.space].toLowerCase()}`, [sentTo, m.location === 1 ? PLAN[1][0] : PLAN[m.location][m.space === 0 ? 0 : 1], left ? `Target +${left} on arrival for pieces to the left.` : '', `Uses the Previous Report: ${W[prev.weather]} first, ${prev.priority} priority.`, 'Where you move first can change this. Call Security to change the Report.'], 'Solo rules pp. 5-11.');
}
function locationTip(st, loc) {
  const gain = loc === 1 ? 'any voucher' : `${VN[D.LOCATION_GAIN[loc]]} voucher`;
  return tip(E.locationKind(loc), LN[loc], loc === 1 ? 'Unlimited actions' : `Gives ${gain}s`, [
    loc === 1 ? 'Enter: gain any voucher, +1 Science if Lativ is here. Pay any voucher for each Scientist to your left.' : `Enter: gain 1 ${gain}, +1 per Saboteur to your left${E.challenge(st, 8) ? ' (disabled by Moral High Ground)' : ''}. +1 Science if Lativ is to your left.`,
    ...(E.LOCATION_ACTIONS[loc] || []).map(k => `${E.ACTIONS[k].name}: ${E.ACTIONS[k].text}.`),
  ], 'Rulebook pp. 11-19.');
}
function seatTip(st, loc, i) {
  const who = E.occupied(st, loc, i), name = { you: 'You', lativ: 'Lativ', white: 'Agent White', pink: 'Agent Pink' }[who];
  const left = leftOf(st, loc, i), title = loc === 1 ? `Supply space ${i + 1}` : `${LN[loc]}, ${POSITION[i].toLowerCase()}`;
  if (loc === 1) return tip('supply', title, name || 'Empty', ['Any number of Supply actions.', `Enter: gain any voucher${st.positions.lativ.location === 1 ? ', +1 Science (Lativ is here)' : ''}.`, left ? `Pay ${s(left, 'any voucher')} for the Scientists to your left.` : 'No Scientists to your left: no payment.'], 'Rulebook p. 11.');
  const gain = D.LOCATION_GAIN[loc], n = 1 + (E.challenge(st, 8) ? 0 : left);
  return tip(E.locationKind(loc), title, name || (i === 0 ? 'Both actions' : '1 action'), [
    i === 0 ? 'Take both of this Location’s actions, once each.' : 'Take one of this Location’s actions.',
    `Enter here now: gain ${n} ${VN[gain]} voucher${n === 1 ? '' : 's'}.`,
    i === 0 && st.round < 2 ? 'Opens in round 2.' : st.round === 1 ? 'Round 1: use the middle space when free, otherwise the right.' : '',
  ], 'Rulebook pp. 11-19; Solo rules p. 2.');
}
function workshopTip(st, id) {
  const slot = E.slots(st).find(x => x.id === id), item = st.p.items.find(i => i.slot === id), have = item ? `${item.color ? CN[item.color] + ' ' : ''}${item.type}` : 'Empty';
  if (id === 'chemical') return tip('chemical', 'Base Chemical space', have, ['Stores one Chemical of any color.', 'Tiles add more spaces.'], 'Rulebook pp. 7, 13.');
  if (id === 'part') return tip('part', 'Base Part space', have, ['Stores one Machine Part.'], 'Rulebook pp. 7, 13.');
  if (id === 'bot') return tip('bot', 'Base Bot space', have, ['Stores one Bot.'], 'Rulebook pp. 7, 13.');
  if (slot?.type === 'chemical') return tip('chemical', `${CN[slot.color]} storage`, have, ['Two matching tile edges make this space. It stores that color only.'], 'Rulebook pp. 7, 13.');
  if (slot) return tip('workshop', 'Workshop tile', have, ['Holds one Bot or one Machine Part.', 'Placement is permanent. Contents rearrange freely.'], 'Rulebook pp. 7, 13.');
  return tip('workshop', 'Open space', 'No tile', ['Extend your Workshop to fill it. Touching semicircles must match.'], 'Rulebook pp. 7, 13.');
}
function chemicalTip(st, c) {
  return tip('chemical', CN[c], st.supply[c] ? `Next: ${E.chemicalPrice(st, c)} Supply` : 'None left', [`${st.supply[c]} of 5 in Supply. Boxed price is next.`, 'Returned Chemicals fill the rightmost empty space and pay that space’s price.', 'Spent in Government or Lab, it returns to Supply. Research keeps its Chemical on the space.', 'Executive Exchange: swap a Chemical for a needed type for any two vouchers, only when you lack that type.'], 'Rulebook pp. 7-8, 13, 16, 18.');
}
function branchTip(st, key, w) {
  const left = st.research[key][w];
  if (key === 'government') return tip(w, `${W[w]} Government`, s(left, 'Research token'), [KIND_ACTION.government + ' here with a Bot and a matching Part: take a Subsidy and a Research token.', 'A full branch activates: 3 CP per your Bot, target +3 per Saboteur Bot, and a Government marker helps fix this weather.'], 'Rulebook pp. 14-15; Solo rules pp. 9-11.');
  if (key === 'lab') {
    const id = st.experiments.findLast(x => D.EXPERIMENTS[x].weather === w), d = id === undefined ? null : D.EXPERIMENTS[id], away = (D.WEATHER.indexOf(w) - D.WEATHER.indexOf(st.assistant) + 5) % 5;
    return tip(w, `${W[w]} Lab branch`, st.assistant === w ? 'Runs next' : `${s(away, 'branch').replace('branchs', 'branches')} away`, [d ? `Rightmost matching Experiment: ${d.cost} Science, ${d.cp} CP per Bot, a benefit and research.` : 'No matching Experiment on display.', 'Runs only when every space has a Bot and a matching Experiment is displayed.', 'A failed Experiment still worsens the weather when Saboteur Bots are present.', `${s(left, 'Research token')} left.`], 'Rulebook pp. 16, 20; Solo rules pp. 9-11.');
  }
  return tip(w, `${W[w]} R&D`, s(left, 'Research token'), ['The last Bot in the branch gives an Investment instead of research and unlocks citations.', 'The bottom space also costs any Chemical or Part as shown, and constructs another Bot for free.'], 'Rulebook pp. 18-19; Solo rules pp. 9-11.');
}
function spaceTip(st, key, w, i) {
  const slot = st[key][w][i], who = slot.owner ? OWNER[slot.owner] : 'Empty', title = `${W[w]} ${key === 'rd' ? 'R&D' : VN[key]} space ${i + 1}`;
  if (key === 'government') return tip('part', title, who, [`Needs a ${CN[D.GOV[w][i]]} Machine Part.`, 'Sell a Part: 1 Government and a Bot. Take a Subsidy and a Research token.', `Filled: ${st.government[w].filter(x => x.owner).length} of 3. Full branch: 3 CP per your Bot, target +3 per Saboteur Bot.`], 'Rulebook pp. 14-15.');
  if (key === 'lab') return tip('chemical', title, who, [`Needs a ${CN[D.LAB[w][i]]} Chemical. It returns to Supply.`, 'Work on Experiment: 1 Lab and a Bot.', slot.owner === 'lativ' ? 'You may displace Lativ’s Bot.' : '', `Filled: ${st.lab[w].filter(x => x.owner).length} of ${st.lab[w].length}. It runs only when full.`], 'Rulebook pp. 16, 20.');
  const d = D.RD[w][i];
  return tip('chemical', title, who, [`Needs a ${CN[d.color]} Chemical${d.extra ? ` and any ${d.extra === 'part' ? 'Machine Part' : 'Chemical'}` : ''}. The Chemical stays here.`, `Reward: ${ben(d.reward)}, plus a Research token.`, slot.chemical ? `${CN[slot.chemical]} is on this space.` : '', slot.owner ? 'This Bot may supply its Part for a Breakthrough. Your Bot: +2 CP. Saboteur Bot: target +2.' : ''], 'Rulebook pp. 18-19; Solo rules p. 11.');
}
function researchTip(st, key, w) {
  const n = st.research[key][w];
  return tip(w, `${W[w]} ${key === 'rd' ? 'R&D' : VN[key]} research`, `${n} left`, ['Won by taking the matching action in this branch, then recorded in your Office.', key === 'lab' ? 'When none remain, you gain a Science voucher instead. The Saboteurs gain nothing.' : key === 'rd' ? 'When none remain, you gain an Investment and unlock Citations. The Saboteurs raise the target by 5 and unlock them.' : 'When none remain, you gain an Investment instead. The Saboteurs raise the target by 5.'], 'Rulebook pp. 12, 16.');
}
function subsidyTip(st, w, i) {
  const t = st.governmentSubsidies[w][i], d = D.SUBSIDIES[t.id];
  if (t.part) return tip('part', 'Machine Part installed', CN[t.part], ['A Part sold here replaced this Subsidy.'], 'Rulebook pp. 14-15.');
  return tip('subsidy', d.name, t.used ? 'Used' : `${W[w]}, row ${i + 1}`, [`Tile: ${ben(d.benefits)}.`, t.used ? 'Already secured. You can still take it when you sell a Part.' : `Secure it for 2 Government: also gain ${ben([...D.SECURE_COLUMNS[w], ...D.SECURE_ROWS[i]])}. Then flip it.`, 'Sell a Part in this branch to take a tile for later.'], 'Rulebook pp. 9, 14-15, 23.');
}
function weatherTip(st, w) {
  const e = st.extreme[w], d = E.tileData(st, w);
  if (!e.level) return tip(w, `${W[w]} Extreme Weather`, 'Fixed', ['A later Experiment or Saboteur havoc may bring it back.'], 'Rulebook pp. 18-19.');
  return tip(w, `${W[w]} Extreme Weather`, `Level ${e.level}`, [`Breakthrough: 2 R&D + ${d.cost} Science. Parts: the three R&D spaces${d.parts.length ? ` plus ${d.parts.map(x => CN[x]).join(', ')}` : ''}.`, 'Each Breakthrough earns an Award. Filling every marker space fixes this tile.', 'Two tiles at Level 3 at the end of your turn: you lose.'], 'Rulebook pp. 18-19; Solo rules p. 11.', [['Marker', 'Benefit', 'Status'], ...d.spaces.map((r, i) => [i + 1, ben(r), e.markers[i] ? 'Taken' : 'Open'])]);
}
function experimentTip(st, id) {
  const d = D.EXPERIMENTS[id], where = st.experiments.includes(id) ? 'On display' : st.experimentNext === id ? 'Next to enter the display' : 'Top of the deck, follows Next';
  return tip(d.weather, `${W[d.weather]} Experiment`, `${d.cp} CP per Bot · ${d.cost} Science`, [`${where}. Stage ${['', 'I', 'II', 'III'][d.stage]}.`, 'First return all your Bots. Pay the Science once to score CP for each Bot, take one Research token if available (else Science), and choose a reward.', 'Decline payment: no CP, reward or research.'], 'Rulebook p. 20.', [['Reward options'], ...d.rewards.map(r => [ben(r)])]);
}
function officeTip(st, r) {
  if (r === null) return tip('office', 'Research Office', `${st.p.office.filter(x => x.published).length} of 6 published`, ['Each row holds one weather. Research goes in its matching column.', 'Awards are wild. Citations fill the missing space of a two-token row by giving up an unset Goal.', 'Publishing: 2 CP per Research, 4 per Award, 0 per Citation. Gain an Investment and the row’s benefit.'], 'Rulebook pp. 9, 12, 17.');
  const row = st.p.office[r];
  return tip('office', `Office row ${r + 1}`, row.weather ? W[row.weather] : 'No weather yet', [`Publishing gains: ${ben(D.OFFICE[r].publish)}.`, `${row.tokens.filter(Boolean).length} of 3 tokens. At least one must be real Research.`, 'A published row can make one Breakthrough.'], 'Rulebook pp. 9, 12, 17.');
}
function officeSlotTip(st, r, c) {
  const t = st.p.office[r].tokens[c], k = OFFICE_KINDS[c], reward = ben(D.OFFICE[r].spaces[c]);
  const have = t ? (t.kind === 'award' ? 'Award' : t.kind === 'citation' ? 'Citation' : `${W[t.weather]} research`) : 'Empty';
  return tip(t?.kind === 'award' ? 'award' : t?.weather || k, `Row ${r + 1}, ${VN[k]} column`, have, [t ? (t.kind === 'award' ? 'Worth 4 CP when published.' : t.kind === 'citation' ? 'Worth 0 CP when published.' : 'Worth 2 CP when published.') : `Takes ${VN[k]} research, or an Award.`, !t && reward !== 'No benefit' ? `Placing here gains: ${reward}.` : ''], 'Rulebook pp. 9, 12, 17.');
}
function paperTip(st, r) {
  const row = st.p.office[r], v = row.breakthrough ? 'Prototype built' : row.published ? 'Published' : 'Unpublished';
  return tip(row.breakthrough ? 'award' : row.published ? 'paper' : 'lock', `Row ${r + 1} paper`, v, [row.published ? (row.breakthrough ? 'This row has made its Breakthrough.' : 'It can make one Breakthrough in R&D.') : 'Publish a Paper in the Lab once the row is complete.', `Publication benefit: ${ben(D.OFFICE[r].publish)}.`], 'Rulebook pp. 9, 12, 17.');
}
function goalTip(st, id) {
  const g = D.GOALS[id], r = E.goalProgress(st, id), set = st.p.activeGoals.find(x => x.id === id);
  return tip(g.kind, g.name, `${r.value} of ${r.need}${r.met ? ' · met' : ''}`, [set ? 'Active: scores 5 CP at final scoring when met, and counts for immediate victory.' : 'Spend an Investment at the start of your turn to place it in a matching Goal space.', set ? (set.flipped ? 'Already flipped for funding. It still scores.' : `Spend an Investment to flip it for ${VN[g.kind]} funding.`) : 'Or give it up for a Citation.'], 'Rulebook pp. 9-10, 17, 22.');
}
function reportTip(id) {
  const c = D.REPORTS[id];
  return tip('report', `Security Report ${c.id + 1}`, `Agent ${c.agent === 'pink' ? 'Pink' : 'White'}`, [`As Current: ${c.agent === 'pink' ? 'Pink' : 'White'} moves to ${c.location === 'lativ' ? 'Lativ' : LN[c.location]}. Takes left, then right, then middle, or the leftmost Supply space.`, `As Previous: starts at ${W[c.weather]}, priority ${c.priority}.`, 'An invalid destination advances to the next main Location.'], 'Solo rules pp. 5-11.');
}

/** Explain mode: what answering a dock option would do. */
export function choice(st, p, o) {
  const t = specific(st, p, o) || tip(o.weather || o.icon || 'next', o.label, o.cost || '', [o.text, o.detail, p.text || 'Take this option.']);
  if (o.disabled) t.d.unshift(`Unavailable: ${typeof o.disabled === 'string' ? o.disabled : 'not legal now'}.`);
  return t;
}
function specific(st, p, o) {
  const v = o.v, task = st.stack.at(-1);
  if (v === 'cancel') return tip('back', o.label, '', ['Return to the previous choice without spending anything.']);
  switch (p.task) {
    case 'menu': case 'setupSupply':
      if (v === 'done') return tip('next', o.label, '', [p.task === 'menu' ? 'Record any Research you won, then the round continues.' : 'Begin round 1.']);
      if (v === 'security') return tip('security', 'Call Security', '1 local or Science voucher', ['See the Current Report and the top two of the deck.', 'Choose the Current Report, return one to the top, discard the third.', 'Does not use up an action.']);
      if (v === 'award') return explain(st, 'awards');
      return tip(E.ACTIONS[v].icon, E.ACTIONS[v].name, '', ACTION_LINES[v]);
    case 'move': return tip(E.locationKind(v.location), o.label, o.text, [o.detail, ...(st.positions.lativ.location === v.location ? ['Lativ moves on after you gain your vouchers.'] : [])]);
    case 'action': {
      const kind = task.kind;
      if (task.stage === 'materials') return tip('next', o.label, '', [o.text]);
      if (task.stage === 'subsidyPick') return tip('subsidy', o.label, 'Yours to keep', [o.text, 'Received blue side up. Flip it at the start of a turn.']);
      if (['sell', 'work', 'research'].includes(kind)) {
        const key = kind === 'sell' ? 'government' : kind === 'work' ? 'lab' : 'rd', t = spaceTip(st, key, v.weather, v.space);
        const type = kind === 'sell' ? 'part' : 'chemical', need = kind === 'sell' ? D.GOV[v.weather][v.space] : kind === 'work' ? D.LAB[v.weather][v.space] : D.RD[v.weather][v.space].color;
        if (!(kind === 'sell' ? task.noPart : task.noChemical) && !E.items(st, type, need).length) t.d.unshift(`Exchange 2: you hold no ${CN[need]}, so pay any 2 Vouchers to exchange one of yours.`);
        return t;
      }
      if (kind === 'buyChemical') return chemicalTip(st, v.color);
      if (kind === 'returnChemical') return tip('chemical', o.label, o.text, ['It goes back to Supply and fills the rightmost empty space.', 'You gain that space’s price in Supply vouchers.']);
      if (kind === 'initiative') return tip('initiative', o.label, '1 Supply', ACTION_LINES.initiative);
      if (kind === 'subsidy') return subsidyTip(st, v.weather, v.index);
      if (kind === 'publish') return v.cite === null || v.cite === undefined ? officeTip(st, v.row) : tip('paper', o.label, 'Citation', [`Gives up Goal: ${D.GOALS[v.cite].name}.`, 'A Citation scores 0 CP but completes the row.', `Publishing gains: ${ben(D.OFFICE[v.row].publish)}.`]);
      return null;
    }
    case 'breakthrough': return tip('award', o.label, '', [o.text, ...ACTION_LINES.breakthrough.slice(2)]);
    case 'pay': return tip('voucher', o.label, 'Payment', [p.text, 'Science substitutes for any voucher.']);
    case 'construct': return explain(st, `assembly:${v}`);
    case 'extend': return o.tile !== undefined && typeof v === 'number' ? explain(st, `tile:${v}`) : tip('workshop', o.label, o.text, ['Placement is permanent. Touching semicircles must match.']);
    case 'placeResearch': return officeSlotTip(st, v.row, v.col);
    case 'award': return officeSlotTip(st, v.row, v.col);
    case 'useTile':
      if (v === 'skip') return tip('next', o.label, '', ['Keep your tiles and move your Scientist.']);
      if (v.type === 'goal') return explain(st, 'investment');
      if (v.type === 'funding') return explain(st, 'investment');
      if (v.type === 'subsidy') return explain(st, `ownedSubsidy:${v.id}`);
      if (v.id !== undefined) return goalTip(st, v.id);
      if (typeof v === 'number') return goalTip(st, v);
      return null;
    case 'security': return reportTip(v);
    case 'receiveFunding': return typeof v === 'string' ? explain(st, `funding:${v}`) : null;
    case 'benefit': return VN[v] && st.p.vouchers[v] !== undefined && p.title === 'Gain a voucher' ? explain(st, `voucher:${v}`) : VN[v] ? explain(st, `funding:${v}`) : D.COLORS.includes(v) && o.icon === 'chemical' ? chemicalTip(st, v) : D.COLORS.includes(v) ? tip('part', o.label, 'Machine Part', ['Gain this Part. It needs a Workshop space.', 'Sell it in Government or use it in a prototype.']) : null;
    case 'botTurn': return tip('saboteurs', o.label, '', ['The Agent moves as the Current Report says, then uses the Previous Report’s weather and priority.', 'You have no choices during this step.']);
    case 'havoc': return tip('saboteurs', o.label, '', [o.text, v === 'target' ? 'Your finish line moves up by 5.' : 'One less Report before the deck runs out.']);
    case 'experiment': return tip('lab', o.label, '', [o.text, v === false ? 'Your Bots stay for a later Experiment.' : v === 'skip' ? 'No CP, reward or research.' : p.text]);
    case 'returnYourBot': return explain(st, `assembly:${v}`);
    case 'setupWorkshop': return tip('workshop', o.label, o.text, ['Beside the middle row. Its orientation is permanent.']);
    case 'final':
      if (v === 'score') return tip('cp', 'Score the game', '', ['Target +30 has been applied. Funding, 5 CP per completed active Goal, and the Nobel Prize score now.', 'Your CP must beat the target.']);
      return null;
    default: return null;
  }
}
