import * as D from './data.js';
import * as E from './engine.js';
import { icon, machineArt, piece, symbol, gearNumber } from './icons.js';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const btn = (label, action, cls = '', extra = '') => `<button type="button" data-do="${action}" class="${cls}" ${extra}>${label}</button>`;
export const info = (title, key, content, cls = '') => btn(content, 'info', `inspect ${cls}`, `data-info="${esc(key)}" aria-label="${esc(title)}"`);
/** A Chemical (drum) or Machine Part (gear) of one of the five colors. */
export const color = (c, kind = 'chemical') => `<span class="material" data-color="${c}" data-kind="${kind}" role="img" aria-label="${esc(D.COLOR_NAME[c])} ${kind === 'part' ? 'Part' : 'Chemical'}" title="${esc(D.COLOR_NAME[c])} ${kind === 'part' ? 'Part' : 'Chemical'}">${piece(c, kind)}</span>`;
/** The solid weather flag hung at the top of branches and cards. */
export const pennant = w => `<span class="pennant" data-weather="${w}" title="${esc(D.WEATHER_NAME[w])}">${icon(w)}</span>`;
/** A Workshop tile's colored edge: half a storage circle. */
const dome = (c, side) => `<span class="dome ${side}" data-color="${c}" role="img" aria-label="${esc(D.COLOR_NAME[c])} edge">${symbol(c, 15)}</span>`;
export const token = (owner, size = 18, kind = 'bot') => {
  if (!owner) return '<span class="empty-dot" aria-label="Empty"></span>';
  const who = owner === 'you' ? 'Your' : owner === 'saboteurs' ? 'Saboteur' : 'Lativ';
  const glyph = kind === 'bot' ? {you:'bot',saboteurs:'saboteurBot',lativ:'lativBot'}[owner] : owner;
  return `<span class="person ${owner} ${kind}-token" role="img" aria-label="${who} ${kind === 'bot' ? 'Bot' : 'Scientist'}" title="${who} ${kind === 'bot' ? 'Bot' : 'Scientist'}">${icon(glyph, size)}</span>`;
};
let closedPanels = new Set();
const panelKey = title => title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const panelChevron = '<svg class="panel-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
/** A major block: its header collapses it, and the rest of the column closes up. */
export function section(title, glyph, body, extra = '', cls = '') {
  const key = panelKey(title), closed = closedPanels.has(key);
  return `<section class="panel ${cls}" data-section="${esc(glyph)}" data-panel="${key}" data-closed="${closed}"><header class="panel-head"><h2>${btn(`${icon(glyph)}<span>${title}</span>${panelChevron}`, 'panel', 'panel-toggle', `data-panel="${key}" aria-expanded="${!closed}"`)}</h2>${extra}</header>${body}</section>`;
}
/** Short reward text for tight spaces: "2 Supply", "+1 Funding", "2 Parts". */
function shortBenefit(list = []) {
  const totals = new Map();
  for (const x of list) {
    const n = x.n ?? 1, key = x.type === 'voucher' ? (D.VOUCHER_NAME[x.kind] || 'Voucher') : { funding: 'Funding', chemical: 'Chemical', part: 'Part', bot: 'Bot', workshop: 'Workshop', investment: 'Investment', cp: 'CP', action: { work: 'Work', research: 'Research', sell: 'Sell', publish: 'Publish', breakthrough: 'Breakthrough' }[x.kind] }[x.type] || x.type;
    totals.set(key, (totals.get(key) || 0) + n);
  }
  return [...totals].map(([k, n]) => k === 'Funding' ? `+${n} Funding` : ['Part', 'Voucher'].includes(k) && n > 1 ? `${n} ${k}s` : ['Bot', 'Workshop', 'Work', 'Research', 'Sell', 'Publish', 'Breakthrough'].includes(k) ? k : `${n} ${k}`).join(' + ');
}
/** One reward as a small glyph, for Extreme Weather marker spaces. */
function benefitGlyph(list) {
  const b = list[0];
  return b.type === 'cp' ? `<b>${b.n}</b>` : icon({ part: 'part', chemical: 'chemical', workshop: 'workshop', voucher: 'voucher', funding: 'funding', investment: 'investment' }[b.type] || 'next', 15);
}
export function workshopTile(id, flip = false) {
  const d = D.WORKSHOPS[id];
  return `<span class="tile-mini">${dome(flip ? d.bottom : d.top, 'top')}${dome(flip ? d.top : d.bottom, 'bottom')}</span>`;
}
export function setup() {
  return `<main class="setup"><div class="setup-intro"><div class="wordmark">GAMES WITH TONY</div><h1>Weather <br>Machine<span class="title-dot">.</span></h1><p class="lede">Solo against Agent White and Agent Pink, the official Saboteurs.</p>${machineArt()}</div><div class="setup-controls"><div class="setup-card"><h2>New solo game</h2><details><summary>Official challenges <span>12 optional</span></summary><p class="small">Choose any combination. Each changes the official solo rules.</p><div class="challenges">${D.CHALLENGES.map(c => `<label class="challenge"><input type="checkbox" name="challenge" value="${c.id}"><span><b>${c.id}. ${esc(c.name)}</b><small>${esc(c.text)}</small></span></label>`).join('')}</div></details><details><summary>Setup seed <span>optional</span></summary><label class="field">Setup seed<input id="seed" type="number" inputmode="numeric" placeholder="Random each game"></label></details>${btn(`${icon('next')} Start a solo game`, 'start', 'primary start-button')}<div class="setup-links">${btn('Load a saved game', 'import', 'text-button')}${btn('How to play', 'help', 'text-button')}${btn(icon('theme'), 'theme', 'icon-button', 'aria-label="Change theme"')}</div></div><p class="credit">Weather Machine by Vital Lacerda. The Saboteurs solo mode by Dávid Turczi. Published by Eagle-Gryphon Games. Fan-made practice app with original SVG graphics. <a href="https://www.eagle-gryphon.com/" target="_blank" rel="noopener">Support the publisher ↗</a></p><span class="version">WM · 1.00</span></div></main>`;
}
export function header(st) {
  const roundLabel = st.endRound === null ? `Round ${st.round || '0 (initial Supply)'}` : `Round ${st.round}, final round ${st.endRound}`;
  return `<header class="topbar">
    <a class="brand" href="./" aria-label="Weather Machine">WM</a>
    <div class="header-metrics">
      <div class="round">${info(roundLabel, 'round', `<small>R</small><b>${st.round}</b>${st.endRound === null ? '' : `<small class="round-end">${st.round === st.endRound ? '!' : '/' + st.endRound}</small>`}`)}</div>
      <div class="score-pair">${info(`Your Climate Points: ${st.p.cp}`, 'score', `<span>${icon('you',18)}<b>${st.p.cp}</b></span>`, 'your-score')}${info(`Target score: ${st.target}`, 'target', `<span>${icon('saboteurs',18)}<b>${st.target}</b></span>`, 'target-score')}</div>
      ${hand(st, true)}
    </div>
    <div class="header-actions">${btn(icon('theme'), 'theme', 'icon-button', 'title="Change theme" aria-label="Change theme"')}${btn(icon('menu'), 'menu', 'icon-button', 'title="Game menu" aria-label="Game menu"')}</div>
  </header>`;
}
/** Both ways to lose at a glance: Extreme Weather levels and Reports left. One tap explains them. */
export function gauge(st) {
  const levels = D.WEATHER.map(w => `${D.WEATHER_NAME[w]} ${st.extreme[w].level ? 'level ' + st.extreme[w].level : 'fixed'}`).join(', ');
  const cells = D.WEATHER.map(w => { const n = st.extreme[w].level; return `<span class="gauge-cell" data-weather="${w}" data-level="${n}">${pennant(w)}<b>${D.WEATHER_NAME[w]}</b>${n ? `<span class="gauge-pips">${[1,2,3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>` : icon('check', 13)}</span>`; }).join('');
  return info(`Extreme Weather: ${levels}. ${st.reportDeck.length} Reports left.`, 'gauge', `${cells}<span class="gauge-reports ${st.reportDeck.length <= 2 ? 'low' : ''}">${icon('report', 16)}<b>${st.reportDeck.length}</b></span>`, 'weather-gauge');
}
export function tabs(active) {
  return `<nav class="tabs" aria-label="Laboratory views">${[['table', 'supply', 'Table'], ['workshop', 'workshop', 'Workshop'], ['office', 'office', 'Office'], ['reports', 'security', 'Saboteurs'], ['history', 'history', 'Journal']].map(([key, ic, text]) => btn(`${icon(ic, 19)}<span>${text}</span>`, 'tab', active === key ? 'on' : '', `data-tab="${key}" aria-current="${active === key ? 'page' : 'false'}"`)).join('')}</nav>`;
}
export function vouchers(st) {
  return `<div class="voucher-bar" aria-label="Your vouchers">${E.VOUCHERS.map(k => info(`${D.VOUCHER_NAME[k]} vouchers: ${st.p.vouchers[k]} of ${D.VOUCHER_CAP[k]}`, `voucher:${k}`, `${icon(k,19)}<i class="voucher-n"><b>${st.p.vouchers[k]}</b><small>/${D.VOUCHER_CAP[k]}</small></i>`, `voucher ${k}`)).join('')}</div>`;
}
export function hand(st, compact = false) {
  if (compact) return `<div class="header-inventory" aria-label="Workshop inventory">${['bot','part','chemical'].map(type => info(`${type === 'bot' ? 'Available Bots' : type === 'part' ? 'Machine Parts' : 'Chemicals'}: ${E.items(st,type).length}`, type === 'bot' ? 'bots' : type === 'part' ? 'parts' : 'chemicals', `${icon(type,18)}<b>${E.items(st,type).length}</b>`)).join('')}</div>`;
  return `<div class="hand-bar">${info('Available Bots','bots',`${icon('bot',18)}<b>${E.items(st,'bot').length}</b>`)}${['part','chemical'].map(type=>info(type==='part'?'Your Machine Parts':'Your Chemicals',type==='part'?'parts':'chemicals',`${icon(type,18)}${D.COLORS.filter(c=>E.items(st,type,c).length).map(c=>`<span class="hand-color">${color(c,type)}${E.items(st,type,c).length>1?'<small>×'+E.items(st,type,c).length+'</small>':''}</span>`).join('')||'<span class="muted small">0</span>'}`)).join('')}</div>`;
}
export function funding(st, compact = false) {
  return `<div class="funding-tracks">${['government', 'lab', 'rd'].map(k => { const pos = st.p.funding[k]; return info(`${D.VOUCHER_NAME[k]} funding`, `funding:${k}`, `<span class="funding-label">${icon(k, 17)} ${D.VOUCHER_NAME[k]}<b>${pos}<small>/9</small></b></span><span class="track">${Array.from({ length: 10 }, (_, i) => `<i class="${i <= pos ? 'reached' : ''} ${i === pos ? 'here' : ''}">${i}</i>`).join('')}</span><span class="track track-cp" aria-hidden="true">${D.FUNDING[k].map((d, i) => d.cp > (D.FUNDING[k][i - 1]?.cp ?? 0) ? `<u class="${i <= pos ? 'on' : ''}">${d.cp}</u>` : '<u class="none"></u>').join('')}</span>`, `funding-track ${k}`); }).join('')}</div>`;
}
/** The three conditions for winning at the start of your turn. */
export function victory(st) {
  const need = E.challenge(st, 5) ? 5 : 4, goals = E.metGoals(st), tracks = Object.values(st.p.funding).filter(n => n >= 5).length, beat = st.p.cp > st.target;
  const chip = (ok, ic, value, label) => `<span class="victory-chip ${ok ? 'met' : ''}">${icon(ok ? 'check' : ic, 18)}<b>${value}</b><small>${label}</small></span>`;
  return info('Immediate victory progress', 'score', `${chip(beat, 'cp', `${st.p.cp}/${st.target}`, 'Beat target')}${chip(goals >= need, 'goal', `${goals}/${need}`, 'Goals met')}${chip(tracks >= 2, 'funding', `${tracks}/2`, 'Tracks at 5+')}${E.challenge(st, 4) ? chip(st.p.nobel, 'award', st.p.nobel ? 'Yes' : 'No', 'Nobel') : ''}`, 'victory');
}
/** Which weathers can be cited yet. */
function citations(st) {
  return `<div class="citations"><span class="citations-label">Citations</span>${D.WEATHER.map(w => info(`${D.WEATHER_NAME[w]} citations ${st.locked[w] ? 'locked' : 'unlocked'}`, `citation:${w}`, `${pennant(w)}${icon(st.locked[w] ? 'lock' : 'unlock', 15)}`, `citation ${st.locked[w] ? 'locked' : 'open'}`)).join('')}</div>`;
}
export function personal(st) {
  return section('Your Laboratory', 'you', `<div class="personal-summary">${info('Your available Bots', 'bots', `${icon('bot')}<b>${E.items(st, 'bot').length}</b><small>Ready</small>`)}${info('Machine Parts in Workshop', 'parts', `${icon('part')}<b>${E.items(st, 'part').length}</b><small>Parts</small>`)}${info('Chemicals in Workshop', 'chemicals', `${icon('chemical')}<b>${E.items(st, 'chemical').length}</b><small>Chemicals</small>`)}</div><div class="inventory-strip">${st.p.items.filter(i => i.color).map(i => info(`${D.COLOR_NAME[i.color]} ${i.type}`, i.type === 'part' ? 'parts' : 'chemicals', color(i.color, i.type))).join('') || '<span class="muted small">Workshop is empty</span>'}</div>${funding(st)}<div class="personal-bottom">${info('Investments', 'investment', `${icon('investment', 19)}<b>${st.p.investments}</b>`)}${info('Awards', 'awards', `${icon('award', 19)}<b>${st.p.totalAwards}</b>`)}${info('Completed Goals', 'score', `${icon('goal', 19)}<i class="voucher-n"><b>${E.metGoals(st)}</b><small>/${st.p.activeGoals.length}</small></i>`)}</div>${victory(st)}`, '', 'personal-panel');
}
function scientists(st, location) {
  const count = location === 1 ? 4 : 3;
  const actionNames = {1:'Supply actions, unlimited',2:'Sell / Subsidy',3:'Experiment / Publish',4:'Research / Prototype'};
  return `<div class="scientist-area"><p class="space-actions">${actionNames[location]}</p><div class="scientists" data-location="${location}">${Array.from({ length: count }, (_, i) => {
    const who = E.occupied(st, location, i), name = {you:'You',lativ:'Lativ',white:'White',pink:'Pink'}[who];
    const position = location === 1 ? 'Space ' + (i + 1) : ['Left','Middle','Right'][i];
    const allowance = location === 1 ? 'Unlimited actions' : i === 0 ? 'Both actions' : '1 action';
    const limited = location !== 1 && i === 0 && st.round < 2;
    const detail = who ? `<span class="space-occupant">${token(who === 'white' || who === 'pink' ? 'saboteurs' : who,18,'scientist')}<span>${name}</span></span>`
      : limited ? `<span class="space-occupant">${icon('lock',14)}<span>Round 2+</span></span>`
      : location === 1 ? '' : `<strong class="space-allowance">${allowance}</strong>`;
    return info(`${D.LOCATION_NAME[location]}, ${position}: ${allowance}. ${name ? 'Occupied by ' + name : limited ? 'Available from round 2' : 'Empty'}`, `seat:${location}:${i}`, `<span class="space-position">${position}</span>${detail}`, `scientist-space ${who ? 'occupied ' + who : limited ? 'round-limited' : ''}`);
  }).join('')}${location === 1 && st.positions.lativ.location === 1 ? info('Lativ at Supply', 'lativ', `${icon('lativ',18)}<span>Lativ: +1 Science on entry</span>`, 'lativ-space') : ''}</div></div>`;
}
function researchCount(st, kind, weather) { return `<span class="research-count ${kind}">${st.research[kind][weather]}<span class="sr-only"> ${kind} research tokens</span></span>`; }
export function supply(st) {
  return section('Supply', 'supply', `${scientists(st, 1)}<div class="chemical-market">${D.COLORS.map(c => info(`${D.COLOR_NAME[c]} supply`, `chemical:${c}`, `${color(c)}<b>${D.COLOR_NAME[c]}</b><span class="market-stock">${Array.from({ length: 5 }, (_, i) => `<i class="${i < 5 - st.supply[c] ? 'taken' : ''}">${D.CHEMICAL_PRICES[i]}</i>`).join('')}</span><span class="market-price">${st.supply[c] ? E.chemicalPrice(st, c) : '—'}${icon('supply', 15)}</span>`)).join('')}</div><div class="offer"><span class="small muted">Workshop offer</span><div>${[...st.workshopOffer, st.workshopDeck[0]].filter(x => x !== undefined).map(id => info('Workshop tile', `tile:${id}`, workshopTile(id))).join('')}</div></div>`, info('Supply actions', 'location:1', icon('info', 18)));
}
export function government(st) {
  return section('Government', 'government', `${scientists(st, 2)}<div class="branch-table government-table">${D.WEATHER.map(w => `<div class="branch-row" data-weather="${w}">${info(D.WEATHER_NAME[w] + ' Government', `branch:government:${w}`, `${pennant(w)}<span>${D.WEATHER_NAME[w]}</span>`, 'branch-name')}<div class="branch-slots">${st.government[w].map((s, i) => info(`${D.WEATHER_NAME[w]} Government space ${i + 1}`, `space:government:${w}:${i}`, `${color(D.GOV[w][i], 'part')}${token(s.owner, 24)}`, 'bot-slot')).join('')}</div><div class="subsidy-pips">${info('Government research remaining', `research:government:${w}`, researchCount(st, 'government', w), 'gov-research')}${st.governmentSubsidies[w].map((tile, i) => info('Subsidy tile', `subsidy:${w}:${i}`, tile.part ? color(tile.part, 'part') : `<span>${tile.used ? 'Used' : esc(D.SUBSIDIES[tile.id].name.replace(' without a ', ', no '))}</span>`, tile.part ? 'filled' : tile.used ? 'used' : 'blue')).join('')}</div></div>`).join('')}</div>`, info('Government actions', 'location:2', icon('info', 18)));
}
export function experimentCard(st, id, extra = '') {
  if (id === null || id === undefined) return '<span class="muted small">Deck empty</span>';
  const d = D.EXPERIMENTS[id];
  return info(`${D.WEATHER_NAME[d.weather]} Experiment`, `experiment:${id}`, `${pennant(d.weather)}<span class="experiment-stage">${extra || 'Stage ' + ['','I','II','III'][d.stage]}</span><b>${gearNumber(d.cp)}<small>/Bot</small></b><span class="science-cost">${d.cost}${icon('science', 15)}</span>`, 'experiment-card ' + d.weather);
}
/** How soon a Lab branch runs, and whether a matching Experiment is on display. */
function labWhen(st, w) {
  const away = (D.WEATHER.indexOf(w) - D.WEATHER.indexOf(st.assistant) + 5) % 5, has = st.experiments.some(id => D.EXPERIMENTS[id].weather === w);
  return `<small class="${away ? '' : 'now'}">${away ? `In ${away}` : 'Active'}</small><em class="${has ? 'has' : ''}">${has ? 'Tile' : 'No tile'}</em>`;
}
export function lab(st) {
  return section('Lativ’s Lab', 'lab', `${scientists(st, 3)}<div class="experiment-display">${st.experiments.map(id => experimentCard(st, id)).join('')}</div><div class="next-experiment"><span>Next</span>${experimentCard(st, st.experimentNext, 'Next')}${st.experimentDeck.length ? `<span>Then</span>${experimentCard(st, st.experimentDeck[0], 'Then')}` : ''}${info('Experiment deck', 'deck', `${st.experimentDeck.length}<small>in deck</small>`, 'deck-count')}</div><div class="machine-branches">${D.WEATHER.map(w => `<div class="machine-branch ${st.assistant === w ? 'active' : ''}" data-weather="${w}">${info(D.WEATHER_NAME[w] + ' Lab branch', `branch:lab:${w}`, `<span class="branch-weather">${pennant(w)}<b>${D.WEATHER_NAME[w]}</b>${labWhen(st, w)}</span>`, 'branch-label')}<div class="pipe">${st.lab[w].map((s, i) => info(`${D.WEATHER_NAME[w]} Lab space ${i + 1}`, `space:lab:${w}:${i}`, `${color(D.LAB[w][i])}${token(s.owner, 24)}`, 'bot-slot')).join('')}</div>${info('Lab research remaining', `research:lab:${w}`, researchCount(st, 'lab', w), 'branch-research')}</div>`).join('')}</div>${citations(st)}`, info('Lab actions', 'location:3', icon('info', 18)));
}
export function rd(st) {
  return section('Research & Development', 'rd', `${scientists(st, 4)}<div class="rd-branches">${D.WEATHER.map(w => {
    const e = st.extreme[w], d = E.tileData(st, w);
    return `<div class="rd-branch" data-weather="${w}">${info(D.WEATHER_NAME[w] + ' Extreme Weather', `weather:${w}`, `${pennant(w)}<b>${D.WEATHER_NAME[w]}</b><span class="weather-level level${e.level}">${e.level ? 'L' + e.level : 'Fixed'}</span>`, 'rd-weather')}<div class="rd-slots">${st.rd[w].map((s, i) => info(`${D.WEATHER_NAME[w]} R&D space ${i + 1}`, `space:rd:${w}:${i}`, `${color(D.RD[w][i].color)}${token(s.owner, 24)}${s.chemical ? '<i class="kept" aria-hidden="true"></i>' : ''}`, 'bot-slot')).join('')}</div>${info('Prototype requirements', `proto:${w}`, `<span class="prototype-parts">${d.parts.map(c => color(c, 'part')).join('')}</span>${e.level ? `<span class="science-cost">${d.cost}${icon('science', 14)}</span>` : ''}<span class="weather-markers">${e.level ? d.spaces.map((r, i) => `<i class="${e.markers[i] ? 'taken' : ''}">${e.markers[i] ? icon('check', 14) : benefitGlyph(r)}</i>`).join('') : icon('check', 17)}</span>`, 'rd-foot')}${info('R&D research remaining', `research:rd:${w}`, researchCount(st, 'rd', w), 'branch-research')}</div>`;
  }).join('')}</div>`, info('R&D actions', 'location:4', icon('info', 18)));
}
export function outlook(st) {
  const w = st.assistant, tile = st.experiments.findLast(id => D.EXPERIMENTS[id].weather === w), full = st.lab[w].every(s => s.owner);
  const m = st.currentReport === null ? null : E.saboteurMove(st), prev = D.REPORTS[st.reportDiscard.at(-1)];
  const who = m && (m.agent === 'pink' ? 'Pink' : 'White'), order = st.turnOrder.map(x => x === 'you' ? 'You' : 'Saboteurs').join(', then ');
  return `<div class="outlook">${info('Saboteurs next move', 'nextMove', `${icon('saboteurs', 26)}<span><b>${m ? `${who} to ${D.LOCATION_NAME[m.location]}` : 'No Report left'}</b><small>${m ? `${D.WEATHER_NAME[prev.weather]} first · ${prev.priority}` : 'You lose on their turn'}</small></span>`, `outlook-move ${m?.agent || ''}`)}${info('Next experiment', `branch:lab:${w}`, `${pennant(w)}<span><b>${D.WEATHER_NAME[w]} next</b><small>${st.lab[w].filter(s => s.owner).length}/${st.lab[w].length} Bots · ${tile === undefined ? 'no Experiment' : full ? 'ready to run' : 'needs more Bots'}</small></span>`)}${info('Lativ’s movement', 'lativ', `${icon('lativ', 23)}<span><b>${D.LOCATION_NAME[st.positions.lativ.location]}</b><small>Lativ’s location</small></span>`)}${info('Turn order', 'round', `${icon('initiative', 23)}<span><b>${order}</b><small>Next round: ${st.initiative[0] === 'you' ? 'you' : 'Saboteurs'} first</small></span>`)}</div>`;
}
/** Says plainly that the end is here. */
function endBanner(st) {
  if (st.endRound === null || st.over) return '';
  return info('End of game', 'round', `${icon('initiative', 20)}<b>${st.round === st.endRound ? 'Last round' : 'Next round is the last'}</b><span>${esc(st.endReason)}</span>`, 'end-banner');
}
export function table(st) { return `${outlook(st)}<div class="table-grid"><div class="table-column">${lab(st)}${supply(st)}</div><div class="table-column">${government(st)}${rd(st)}</div></div>`; }
export function workshop(st) {
  const spaces = E.slots(st), max = Math.max(1, ...st.p.workshop.map(t => t.col));
  return `${section('Your Workshop', 'workshop', `${hand(st)}<p class="small muted">Tiles stay in place. Bots, Parts, and Chemicals rearrange freely when needed.</p><div class="workshop-scroll"><div class="workshop-grid" style="--columns:${max + 1}">${Array.from({ length: 3 }, (_, row) => Array.from({ length: max + 1 }, (_, col) => {
    const tile = E.at(st, row, col), id = col === 0 ? ['chemical','part','bot'][row] : E.tileKey(row,col), item = st.p.items.find(i => i.slot === id);
    return info('Workshop space', `workshop:${id}`, `<span class="workshop-top">${tile ? dome(E.tileEdges(tile)[0], 'top') : col === 0 ? icon(['chemical','part','bot'][row], 20) : ''}</span><span class="workshop-item">${item ? (item.color ? color(item.color, item.type) : icon(item.type, 32)) : ''}</span><span class="workshop-bottom">${tile ? dome(E.tileEdges(tile)[1], 'bottom') : ''}</span>`, `workshop-cell ${col === 0 ? 'base' : tile ? 'tile' : 'void'}`);
  }).join('')).join('')}</div></div><div class="chemical-storage">${spaces.filter(s => s.type === 'chemical').map(s => { const item = st.p.items.find(i => i.slot === s.id); return info('Chemical storage', `workshop:${s.id}`, `${s.color === '*' ? icon('chemical', 20) : color(s.color)}<span>${s.color === '*' ? 'Any color' : D.COLOR_NAME[s.color]}</span>${item ? color(item.color) : '<small>Empty</small>'}`); }).join('')}</div>`)}${assembly(st)}${section('Funding', 'funding', funding(st))}`;
}
export function assembly(st) {
  const open = E.constructible(st), { built, tokens } = E.assemblyProgress(st), gates = [null, null, [6, 5], [9, 8]];
  return section('Bot Assembly Line', 'bot', `<div class="assembly">${[0,1,2,3].map(group => {
    const gate = gates[group], locked = gate && built < gate[0] && tokens < gate[1];
    return `<div class="assembly-section ${locked ? 'locked' : ''}"><header><span class="supply-cost">${D.ASSEMBLY[group*3].cost}${icon('supply', 15)}</span><small>${group < 2 ? 'Empty spaces pay income' : locked ? `${built}/${gate[0]} Bots or ${tokens}/${gate[1]} tokens` : 'Unlocked'}</small></header><div class="assembly-rail">${[0,1,2].map(j => { const i = group*3+j, here = st.p.assembly[i], state = !here ? 'built' : open.includes(i) ? 'ready' : 'locked'; return info('Assembly Bot ' + (i+1), `assembly:${i}`, `<span class="assembly-bot ${state}">${icon(state === 'built' ? 'check' : state === 'ready' ? 'bot' : 'lock', state === 'ready' ? 24 : 16)}</span><span class="assembly-reward">${esc(D.benefitText(D.ASSEMBLY[i].reward))}</span>`, `assembly-slot ${state}`); }).join('')}</div></div>`;
  }).join('')}</div>`);
}
export function goalCard(st, id, active) {
  const g = D.GOALS[id], progress = E.goalProgress(st, id);
  return info(g.name, `goal:${id}`, `<span class="goal-top">${icon(g.kind,18)}${active ? active.flipped ? 'Funded' : 'Active' : 'Unset'}${progress.met ? icon('check',16) : ''}</span><b>${esc(g.name)}</b><span class="goal-progress">${progress.value}<small>/${progress.need}</small><em>${gearNumber(5)}</em></span>`, `goal-card goal-${g.kind} ${active ? 'set' : ''} ${progress.met ? 'met' : ''}`);
}
export function office(st) {
  const kinds = ['government', 'lab', 'rd'];
  const slot = (t, i, c) => info('Office research slot', `officeSlot:${i}:${c}`, t ? `${t.kind === 'award' ? icon('award', 24) : t.kind === 'citation' ? icon('paper', 24) : pennant(t.weather)}${t.kind === 'award' ? '<small>Award</small>' : t.kind === 'citation' ? '<small>Citation</small>' : ''}` : `${icon(kinds[c], 16)}<span class="office-bonus">${esc(shortBenefit(D.OFFICE[i].spaces[c]))}</span>`, `office-slot col-${kinds[c]} ${t ? 'filled ' + t.kind : ''}`);
  return `${section('Path to victory', 'goal', victory(st))}${section('Research Office', 'office', `${citations(st)}<div class="office-head"><span>Row</span><span>${icon('government', 16)}Gov</span><span>${icon('lab', 16)}Lab</span><span>${icon('rd', 16)}R&D</span><span>Paper</span></div><div class="office-rows">${st.p.office.map((r,i) => `<div class="office-row ${r.published ? 'published' : ''} ${r.breakthrough ? 'built' : ''}">${info('Office row ' + (i+1), `office:${i}`, `<b>${i+1}</b>${r.weather ? pennant(r.weather) : ''}`, 'office-row-name')}${r.tokens.map((t,c) => slot(t, i, c)).join('')}${info('Publication status', `paper:${i}`, `${icon(r.breakthrough ? 'award' : r.published ? 'check' : 'paper', 20)}<small>${r.breakthrough ? 'Built' : r.published ? 'Published' : esc(shortBenefit(D.OFFICE[i].publish))}</small>`, 'paper-status')}</div>`).join('')}</div><div class="office-held">${info('Held Awards', 'awards', `${icon('award')}<b>${st.p.awards}</b> held Awards`)}${info('Pending research', 'pending', `${icon('office')}<b>${st.p.pending.length}</b> pending Research`)}</div>`)}${section('Your Goals', 'goal', `<h3>Active Goals · ${E.metGoals(st)} met</h3><div class="goals">${st.p.activeGoals.map(g=>goalCard(st,g.id,g)).join('') || '<p class="muted small">Spend Investments at the start of your turn to set Goals.</p>'}</div><h3>Available to set or cite</h3><div class="goals">${st.p.goals.map(id=>goalCard(st,id)).join('')}</div>`)}${section('Subsidies & Investments','subsidy', `<div class="tile-inventory">${st.p.subsidies.map(s=>info(D.SUBSIDIES[s.id].name,`ownedSubsidy:${s.id}`,`${icon('subsidy')}<span><b>${esc(D.SUBSIDIES[s.id].name)}</b><small>${s.used ? 'Already used' : D.benefitText(D.SUBSIDIES[s.id].benefits)}</small></span>`,s.used?'used':'')).join('') || '<span class="muted small">No Subsidies yet</span>'}</div><p class="investment-count">${icon('investment')} ${st.p.investments} Investment${st.p.investments===1?'':'s'} available</p>`)} `;
}
export function reportCard(st, id, label = '') {
  if (id === null || id === undefined) return '<p class="muted">No Report remaining.</p>';
  const c = D.REPORTS[id], agent = c.agent === 'pink' ? 'Pink' : 'White', place = c.location === 'lativ' ? 'Follow Lativ' : D.LOCATION_NAME[c.location];
  return info('Security Report', `report:${id}`, `<span class="report-band ${c.agent}">${icon('saboteurs', 24)}<b>Agent ${agent}</b></span><span class="report-body">${label ? `<span class="report-label">${label}</span>` : ''}<strong>${icon(c.location === 'lativ' ? 'lativ' : E.locationKind(c.location), 26)}<span>${place}</span></strong><span class="report-priority">${pennant(c.weather)}<span>${D.WEATHER_NAME[c.weather]}</span><b>${c.priority === 'top' ? '↑ Top' : '↓ Bottom'}</b></span></span>`, 'report-card');
}
export function reports(st) {
  return `${section('Security Reports','security', `<div class="reports-pair">${reportCard(st,st.currentReport,'Current · movement')}${reportCard(st,st.reportDiscard.at(-1),'Previous · priority')}</div><p class="small">${st.reportDeck.length} cards in the hidden deck · ${st.reportDiscard.length} discarded. Call Security during your actions to influence the next Report.</p>${info('Next round order','initiative',`${icon('initiative')}<span>Next round</span><b>${st.initiative[0] === 'you' ? 'You, then Saboteurs' : 'Saboteurs, then You'}</b>`,'initiative-order')}`)}${section('The Hideout','saboteurs',`<div class="hideout-stats">${info('Saboteur Bots','hideoutBots',`${icon('bot')}<b>${12-E.saboteurBots(st)}</b><small>Bots ready</small>`)}${info('Saboteur Awards','hideoutAwards',`${icon('award')}<b>${st.saboteurs.awards}</b><small>Wild tokens</small>`)}</div><div class="hideout-chemicals">${D.COLORS.map(c=>info('Saboteur Chemicals',`hideoutChem:${c}`,`${color(c)}<b>${st.saboteurs.chemicals[c]}</b>`)).join('')}</div><div class="hideout-research">${D.WEATHER.map(w=>info('Saboteur research set',`havoc:${w}`,`${icon(w,22)}<b>${D.WEATHER_NAME[w]}</b>${['government','lab','rd'].map(k=>`<span class="research-chip ${st.saboteurs.tokens.some(t=>t.weather===w&&t.kind===k)?'has':''}">${k==='government'?'G':k==='lab'?'L':'R'}</span>`).join('')}${icon(st.locked[w]?'lock':'paper',16)}`)).join('')}</div>`)}${section('Discarded Reports','history', `<div class="discard-list">${[...st.reportDiscard].reverse().map(id=>{const c=D.REPORTS[id];return info('Discarded Security Report',`report:${id}`,`<b>#${id+1}</b><span>Agent ${c.agent==='pink'?'Pink':'White'} · ${c.location==='lativ'?'Lativ':D.LOCATION_NAME[c.location]}</span>${icon(c.weather,19)}<small>${c.priority==='top'?'↑ Top':'↓ Bottom'}</small>`)}).join('')}</div>`)}${st.challenges.length?section('Active challenges','security',`<div class="active-challenges">${D.CHALLENGES.filter(c=>st.challenges.includes(c.id)).map(c=>`<p><b>${c.id}. ${esc(c.name)}</b><span>${esc(c.text)}</span></p>`).join('')}</div>`):''}`;
}
export function history(st) {
  let last = null;
  return section('Experiment Journal', 'history', `<ol class="journal">${[...st.log].reverse().map(entry => { const heading = entry.round !== last ? `<li class="journal-round">${entry.round ? 'Round '+entry.round : 'Setup'}</li>` : ''; last = entry.round; return `${heading}<li><span class="log-who ${entry.who}">${icon(entry.who === 'system' ? 'report' : entry.who,16)}</span><span>${logText(entry.text)}</span></li>`; }).join('')}</ol>`);
}
/** Score changes stand out in the Journal: "Target +2" and "+3 CP" lead their entries. */
const logText = text => esc(text).replace(/^Target \+\d+|^[+-]?\d+ CP/, m => `<b class="log-delta ${m.startsWith('Target') || m.startsWith('-') ? 'bad' : ''}">${m}</b>`);
/** Where your Scientist stands now, shown while you choose where to go next. */
function currentSpot(st) {
  const at = st.positions.you, name = D.LOCATION_NAME[at?.location];
  if (!name) return '';
  const where = at.location === 1 ? `${name}, space ${at.space + 1}` : `${name}, ${['left', 'middle', 'right'][at.space]}`;
  return info(`You are at ${where}`, `seat:${at.location}:${at.space}`, `${icon(E.locationKind(at.location), 20)}<span>Now at</span><b>${where}</b>`, 'current-spot');
}
/** How the final score was built, and the rank a win earned. */
function resultDetail(st) {
  const s = st.result.score, { rank, next } = E.rankOf(st);
  const lines = s ? `<dl class="score-lines"><div><dt>Before final scoring</dt><dd>${s.play}</dd></div><div><dt>Funding tracks</dt><dd>${s.funding}</dd></div><div><dt>Goals met</dt><dd>${s.goals}</dd></div><div><dt>Nobel Prize</dt><dd>${s.nobel}</dd></div></dl>` : '';
  const title = st.result.won ? `<div class="rank-card">${icon('award', 28)}<span><small>Rank</small><b>${rank || 'Unranked'}</b></span></div>${next ? `<p class="rank-next">${esc(next.name)} still needs ${esc(next.missing.join(', '))}.</p>` : ''}` : '';
  return lines + title;
}
/** Every option is one button. Compact layouts keep the full wording for screen readers and hover. */
function optionButton(o, i, explain, inner, cls) {
  const said = [o.label, o.text, o.detail, o.cost, typeof o.disabled === 'string' ? o.disabled : ''].filter(Boolean).join('. ');
  return btn(inner, 'answer', `${cls} ${o.disabled ? 'is-off' : ''}`, `data-choice="${i}" ${o.disabled && !explain ? 'disabled' : ''} title="${esc(said)}" aria-label="${esc(said)}"`);
}
function plainChoice(p, o, i, explain) {
  const glyph = o.tile !== undefined ? workshopTile(o.tile, o.flip) : o.color ? color(o.color, /chemical/i.test(o.text || '') ? 'chemical' : /part/i.test(`${p.title} ${o.icon || ''}`) ? 'part' : 'chemical') : o.weather ? pennant(o.weather) : icon(o.icon || 'next', 22);
  return optionButton(o, i, explain, `<span class="choice-icon">${glyph}</span><span class="choice-content"><strong>${esc(o.label)}</strong>${o.text ? `<small>${esc(o.text)}</small>` : ''}${o.detail ? `<small class="choice-detail">${esc(o.detail)}</small>` : ''}${o.cost ? `<em>${esc(o.cost)}</em>` : ''}${o.disabled ? `<small class="unavailable">${esc(typeof o.disabled === 'string' ? o.disabled : 'Unavailable')}</small>` : ''}</span>`, `choice ${o.v === 'cancel' ? 'back-choice' : ''}`);
}
const isPinned = o => o.primary || o.v === 'cancel' || o.v === 'skip';
const LOC_KEY = { 1: 'supply', 2: 'government', 3: 'lab', 4: 'rd' };
/** The turn menu: this Location's actions as tiles, free actions beneath them. */
function menuChoices(st, p, explain) {
  const loc = LOC_KEY[p.task === 'menu' ? st.positions.you.location : 1], rows = p.options.map((o, i) => [o, i]).filter(([o]) => !isPinned(o));
  const isFree = o => o.v === 'security' || o.v === 'award';
  const price = o => o.pay ? `<span class="act-cost">${o.pay.gain ? '+' : ''}${o.pay.n}${icon(o.pay.kind, 14)}</span>` : '';
  const tiles = rows.filter(([o]) => !isFree(o)).map(([o, i]) => optionButton(o, i, explain, `${price(o)}${icon(o.icon, 24)}<span class="act-name">${esc(o.label)}</span>${o.disabled ? `<span class="act-why">${esc(o.why || 'Unavailable')}</span>` : ''}`, 'act-tile')).join('');
  const free = rows.filter(([o]) => isFree(o)).map(([o, i]) => optionButton(o, i, explain, `${icon(o.icon, 18)}<span class="act-name">${esc(o.label)}</span>${o.pay ? `<span class="act-cost">${o.pay.n}${icon(o.pay.kind, 14)}</span>` : '<span class="act-cost">Free</span>'}`, 'act-free')).join('');
  return `<div class="act-tiles" data-loc="${loc}">${tiles}</div>${free ? `<div class="act-frees">${free}</div>` : ''}`;
}
/** Where to move: one row per Location, seats left to right as on the board. */
function moveChoices(st, p, explain) {
  const seats = new Map(p.options.map((o, i) => [`${o.v.location}:${o.v.space}`, [o, i]])), here = st.positions.you?.location;
  const names = { 1: 'Supply', 2: 'Gov', 3: 'Lab', 4: 'R&D' }, who = { you: 'You', lativ: 'Lativ', white: 'White', pink: 'Pink' }, words = ['Left', 'Middle', 'Right'];
  return `<div class="seat-grid">${[1, 2, 3, 4].map(loc => {
    if (loc === here) return `<div class="seat-row here" data-loc="${LOC_KEY[loc]}">${currentSpot(st)}</div>`;
    const count = loc === 1 ? 4 : 3;
    const cells = Array.from({ length: count }, (_, s) => {
      const pos = loc === 1 ? String(s + 1) : words[s], hit = seats.get(`${loc}:${s}`);
      if (!hit) {
        const on = E.occupied(st, loc, s), note = on ? who[on] : st.round === 1 && loc !== 1 && s === 0 ? 'Round 2+' : st.round === 1 && loc !== 1 ? 'Middle first' : 'Cannot pay';
        return `<span class="seat-off"><small>${pos}</small><b>${note}</b></span>`;
      }
      const [o, i] = hit, g = o.seat;
      return optionButton(o, i, explain, `<small>${pos}</small><b><span class="seat-gain">+${g.n}${icon(g.kind === 'any' ? 'voucher' : g.kind, 16)}</span>${g.science ? `<span class="seat-gain">+1${icon('science', 16)}</span>` : ''}</b>${g.toll ? `<small>Pay ${g.toll}</small>` : loc === 1 ? '' : `<small>${s === 0 ? 'Both' : '1 action'}</small>`}`, 'seat-cell');
    }).join('');
    return `<div class="seat-row" data-loc="${LOC_KEY[loc]}" style="--n:${count}"><span class="seat-loc">${icon(LOC_KEY[loc], 20)}<b>${names[loc]}</b></span>${cells}</div>`;
  }).join('')}</div>`;
}
/** Which board space: one row per weather, spaces in board order. */
function branchChoices(st, p, explain, task) {
  const kind = task.kind, cells = new Map(p.options.filter(o => o.v?.weather).map(o => [`${o.v.weather}:${o.v.space ?? o.v.index}`, [o, p.options.indexOf(o)]]));
  const sizeOf = w => kind === 'work' ? st.lab[w].length : 3;
  const swap = (type, c) => E.items(st, type, c).length ? '' : '<small class="slot-swap">Exchange 2</small>';
  const inside = (w, i) => {
    if (kind === 'subsidy') return `<small>${esc(D.SUBSIDIES[st.governmentSubsidies[w][i].id].name.replace(' without a ', ', no '))}</small>`;
    if (kind === 'sell') return `${color(D.GOV[w][i], 'part')}${task.noPart ? '' : swap('part', D.GOV[w][i])}`;
    if (kind === 'work') return `${color(D.LAB[w][i])}${st.lab[w][i].owner === 'lativ' ? '<small>Lativ</small>' : ''}${task.noChemical ? '' : swap('chemical', D.LAB[w][i])}`;
    const d = D.RD[w][i];
    return `${color(d.color)}<small>${esc(shortBenefit(d.reward))}${d.extra ? ` · pay ${d.extra === 'part' ? 'Part' : 'Chem'}` : ''}</small>${task.noChemical ? '' : swap('chemical', d.color)}`;
  };
  return `<div class="slot-grid">${D.WEATHER.filter(w => [...cells.keys()].some(k => k.startsWith(w + ':'))).map(w => `<div class="slot-row" style="--n:3"><span class="slot-head">${pennant(w)}<small>${D.WEATHER_NAME[w]}</small></span>${Array.from({ length: 3 }, (_, i) => {
    const hit = i < sizeOf(w) ? cells.get(`${w}:${i}`) : null;
    return hit ? optionButton(hit[0], hit[1], explain, inside(w, i), 'slot-cell') : '<span class="slot-off"></span>';
  }).join('')}</div>`).join('')}</div>`;
}
/** Picks the shape that suits the question. End turn, Back and Skip are always outside the scrolling area. */
function choiceLayout(st, p, explain) {
  const rows = p.options.map((o, i) => [o, i]).filter(([o]) => !isPinned(o)), task = st.stack.at(-1);
  if (p.kind === 'menu') return { html: menuChoices(st, p, explain), cls: 'is-menu' };
  if (p.task === 'move' && p.options.every(o => o.seat)) return { html: moveChoices(st, p, explain), cls: 'is-seats' };
  if (p.task === 'action' && ['sell', 'work', 'research', 'subsidy'].includes(task?.kind) && rows.length && rows.every(([o]) => o.v?.weather)) return { html: branchChoices(st, p, explain, task), cls: 'is-slots' };
  const short = rows.length >= 3 && rows.every(([o]) => o.label.length <= 24 && (o.text || '').length <= 26 && !o.detail);
  return { html: rows.map(([o, i]) => plainChoice(p, o, i, explain)).join(''), cls: short ? 'two' : '' };
}
function pinnedChoices(p, explain) {
  const pins = p.options.map((o, i) => [o, i]).filter(([o]) => isPinned(o));
  if (!pins.length) return '';
  return `<div class="choice-pinned">${pins.map(([o, i]) => optionButton(o, i, explain, `${icon(o.primary ? 'check' : o.v === 'cancel' ? 'back' : 'next', 20)}<strong>${esc(o.label)}</strong>`, `choice pin ${o.primary ? 'primary-choice' : 'back-choice'}`)).join('')}</div>`;
}
/** One short line for the turn menu in place of a paragraph. */
function menuStatus(st) {
  const t = st.turn;
  if (!t || t.limit > 2) return 'Any number of actions';
  const left = Math.max(0, t.limit - t.used.length);
  return `<b>${left} of ${t.limit}</b> action${t.limit === 1 ? '' : 's'} left`;
}
export function decision(st, collapsed = false, explain = false) {
  if (st.over) return `<aside class="decision result ${st.result.won?'won':'lost'}"><p class="eyebrow">EXPERIMENT COMPLETE</p>${icon(st.result.won?'award':'saboteurs',48)}<h2>${st.result.won?'Company saved.':'The Saboteurs prevail.'}</h2><p>${esc(st.result.reason)}</p><div class="result-score"><b>${st.p.cp}<small>Your CP</small></b><span>vs.</span><b>${st.target}<small>Target</small></b></div>${resultDetail(st)}${btn('Review the table','review','secondary')}${btn('Start another game','new','primary')}</aside>`;
  const p = st.prompt;
  if (!p) return '<aside class="decision">Resolving…</aside>';
  const layout = choiceLayout(st, p, explain);
  const phase = st.phase==='saboteurs'?'THE SABOTEURS':st.phase==='experiments'?'WEATHER MACHINE':st.phase==='supply'?'INITIAL SUPPLY':'YOUR DECISION';
  const chevron = `<svg class="dock-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const controls = `<div class="decision-controls">${btn(icon('undo',20),'undo','icon-button','title="Undo last choice" aria-label="Undo last choice"')}${btn(icon('help',20),'explain',`icon-button explain-toggle ${explain?'on':''}`,`title="Explain the options" aria-label="Explain the options" aria-pressed="${explain}"`)}</div>`;
  return `<aside class="decision" data-collapsed="${collapsed}" aria-labelledby="decision-title">
    <div class="decision-dock-header">
      ${btn(`<span class="dock-title"><span class="dock-label"><small>${phase}</small>${chevron}</span><strong>${esc(p.title)}</strong></span>`, 'toggleDecision', 'decision-toggle', `aria-label="${collapsed?'Expand':'Collapse'} decision" aria-expanded="${!collapsed}" aria-controls="decision-body"`)}
      ${controls}
    </div>
    <div class="decision-top"><div class="decision-heading"><span class="eyebrow">${phase}</span><h2 id="decision-title" tabindex="-1">${esc(p.title)}</h2></div>${controls}</div>
    ${vouchers(st)}
    <div class="decision-body" id="decision-body">
      ${explain?'<p class="explain-bar">Tap an option to see what it does. Nothing is chosen.</p>':''}${p.kind==='menu'?`<p class="menu-status">${menuStatus(st)}</p>`:p.task==='move'&&p.options.every(o=>o.seat)?'':`<p class="decision-text">${esc(p.text)}</p>`}
      ${E.canPlaceAward(st)&&p.kind!=='menu'?btn(icon('award',16)+' Place a held Award','awardNow','text-button'):''}
      <div class="choice-list ${layout.cls}" role="group" aria-label="${esc(p.title)}">${layout.html}</div>
      ${pinnedChoices(p, explain)}
    </div>
  </aside>`;
}
export function game(st, active, ui = {}) {
  closedPanels = ui.closedPanels || new Set();
  const view = {table,workshop,office,reports,history}[active] || table;
  return `${header(st)}${gauge(st)}${tabs(active)}<div class="layout"><aside class="personal-rail">${personal(st)}${st.currentReport!==null?section('Current Report','report',reportCard(st,st.currentReport)):''}<div class="rail-note">${icon('info',16)} Tap any item for the rule behind it.</div></aside><main class="main-view" id="main-view">${endBanner(st)}${view(st)}</main>${decision(st, ui.decisionCollapsed, ui.explain)}</div><footer class="game-footer"><span>Seed ${st.seed} · v1.00</span>${btn('Rules & credits','help','text-button')}</footer>`;
}
