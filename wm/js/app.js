import * as D from './data.js';
import * as E from './engine.js';
import * as V from './views.js';
import { icon } from './icons.js';
import { assertState, parseSave, encodeSave, decodeSave } from './saves.js';

export const VERSION = '1.00';
const SAVE_KEY = 'wm.v1', MAX_UNDO = 40;
const root = document.getElementById('app'), sheet = document.getElementById('sheet');
let st = null, undo = [], active = 'table', showSetup = false, decisionCollapsed = false, errorSave = null, lastFocus = null, noticeTimer;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { const save = parseSave(decodeSave(raw)); st = save.state; undo = save.undo || []; }
} catch (error) { errorSave = String(error.message); }

function render() {
  const scroll = document.querySelector('.choice-list')?.scrollTop || 0, title = st?.prompt?.title;
  root.classList.toggle('game-over', !!st?.over && !showSetup);
  root.innerHTML = st && !showSetup ? V.game(st, active, { decisionCollapsed }) : V.setup();
  const list = document.querySelector('.choice-list'); if (list && title === st?.prompt?.title) list.scrollTop = scroll;
  if (showSetup && st) root.querySelector('.setup-links')?.insertAdjacentHTML('afterbegin', V.btn('Resume current game', 'resume', 'text-button'));
}
function notice(text) {
  clearTimeout(noticeTimer); const box = document.getElementById('notice'); box.textContent = text;
  noticeTimer = setTimeout(() => { box.textContent = ''; }, 4500);
}
function save() {
  try { localStorage.setItem(SAVE_KEY, encodeSave({ state: st, undo })); }
  catch { notice('Browser storage is full or unavailable. Export your game from the menu.'); }
}
function modal(title, body) {
  lastFocus = document.activeElement;
  sheet.innerHTML = `<header class="sheet-head"><h2 id="sheet-title">${V.esc(title)}</h2>${V.btn(icon('close'),'close','icon-button','aria-label="Close details"')}</header><div class="sheet-body">${body}</div>`;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
function close() { sheet.close(); if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true }); }
const p = text => `<p>${text}</p>`;
const rule = text => `<p class="sheet-rule">${text}</p>`;
const benefits = list => V.esc(D.benefitText(list) || 'No immediate benefit');
const name = w => D.WEATHER_NAME[w];
function info(key) {
  const [kind, a, b] = key.split(':');
  if (!st) { help(); return; }
  let title = '', body = '';
  if (kind === 'voucher') {
    title = `${D.VOUCHER_NAME[a]} vouchers · ${st.p.vouchers[a]}/${D.VOUCHER_CAP[a]}`;
    const purpose = { supply:'Extend your Workshop, construct Bots, acquire Chemicals, or take the Initiative.', government:'Sell a Part (1) or secure a Subsidy (2).', lab:'Work on an Experiment (1) or publish a Paper (2).', rd:'Research (1) or make a Breakthrough (2).', science:'Substitute for any other voucher, claim experiment rewards, or pay for Breakthroughs.' };
    body = p(purpose[a]) + p('Vouchers above your track’s limit are lost. Whenever you need a voucher and have neither the required type nor Science, you may exchange any three other vouchers for it. The payment screen lists the legal combinations.') + rule('Rulebook pp. 7–8.');
  } else if (kind === 'score' || kind === 'target' || kind === 'goals') {
    title = kind === 'target' ? `Saboteur target · ${st.target}` : 'Your victory conditions';
    body = p(`You have <b>${st.p.cp} CP</b>; the target is <b>${st.target}</b>. Your score must be strictly higher.`) + `<ul><li><b>Immediate victory:</b> at the beginning of your turn, beat the target, meet ${E.challenge(st,5)?5:4} active Goals, and reach space 5 on at least two Funding tracks.</li><li><b>Final scoring:</b> the target rises by 30. Score Funding, 5 CP per completed active Goal, and 5 CP for the Nobel Prize. Beat the final target.</li><li><b>Immediate defeat:</b> two Level 3 Extreme Weather tiles at the end of your turn, or no Report available when the Saboteurs’ turn begins.</li></ul>` + p(`Goals currently met: <b>${E.metGoals(st)}/${st.p.activeGoals.length}</b>. Funding tracks at 5+: <b>${Object.values(st.p.funding).filter(x=>x>=5).length}/2</b>.`) + (st.challenges.length ? p('Your chosen official Challenges may add victory restrictions. See the Saboteurs tab.') : '') + rule('Solo rules pp. 4–5, 12–13.');
  } else if (kind === 'round') {
    title = `Round ${st.round || '0 · initial Supply'}`;
    body = p('Each round: player turns in turn order → run the active Experiment → adjust turn order → income if Lativ is in his Office.') + p(`Current turn order: <b>${st.turnOrder.map(w=>w==='you'?'You':'Saboteurs').join(' → ')}</b>. Next round follows Initiative: <b>${st.initiative.map(w=>w==='you'?'You':'Saboteurs').join(' → ')}</b>.`) + p(st.endRound === null ? 'The Nobel Prize, final Experiment entering the display, completed Government Machine, or full R&D area triggers one last round.' : `${V.esc(st.endReason)} The final round is ${st.endRound}.`) + rule('Rulebook pp. 8–9, 20–22.');
  } else if (kind === 'lativ') {
    title = `Professor Lativ · ${D.LOCATION_NAME[st.positions.lativ.location]}`;
    body = p('When a Scientist moves into his Location, Lativ moves to the next Location, skipping full ones. He places one of his Bots in the Assistant’s branch, or the next eligible branch without one of his Bots.') + p('In two-player solo, entering Government or R&D also removes a Research token from that Location matching the Assistant’s current weather. If he ends a round in his Office, income happens and he returns to Supply.') + rule('Rulebook pp. 11, 21, 23.');
  } else if (kind === 'location') {
    const loc = Number(a); title = D.LOCATION_NAME[loc];
    body = p(loc === 1 ? 'Take any number of Supply actions, repeating them as often as you can pay. On entry, gain any voucher and 1 Science if Lativ is here; then pay any voucher for every Scientist to your left.' : `On entry, gain 1 ${D.VOUCHER_NAME[D.LOCATION_GAIN[loc]]} voucher, plus 1 per Saboteur to your left${E.challenge(st,8)?' (disabled by Moral High Ground)':''}. Gain Science if Lativ is to your left. The left space allows both actions, once each. The middle and right spaces allow one action.`);
    body += `<div class="detail-list">${E.LOCATION_ACTIONS[loc].map(k=>`<div>${icon(E.ACTIONS[k].icon)}<span><b>${E.ACTIONS[k].name}</b><br>${V.esc(E.ACTIONS[k].text)}</span></div>`).join('')}</div>` + p('In round 1, choose the middle space when it is free; otherwise choose the right. The left space is unavailable until round 2.') + rule('Rulebook pp. 11–19; Solo rules p. 2 leaves the right spaces open.');
  } else if (kind === 'funding') {
    title = `${D.VOUCHER_NAME[a]} funding · ${st.p.funding[a]}/9`;
    body = p(`Final scoring: <b>${D.FUNDING[a][st.p.funding[a]].cp} CP</b> at your current position. Funding advances when you perform this Location’s first action or gain a Funding benefit.`) + p(a === 'government' ? 'When you receive funding, gain all benefits at and to the left of your marker.' : a === 'lab' ? 'When you receive funding, gain the cumulative Science vouchers, then Government or R&D funding at its marker plus the Lab modifier. Markers do not move.' : 'When you receive funding, choose one available benefit at or to the left of your marker.') + `<table><thead><tr><th>Space</th><th>Final CP</th><th>Funding benefit</th></tr></thead><tbody>${D.FUNDING[a].map((d,i)=>`<tr><td>${i}${i===st.p.funding[a]?' ←':''}</td><td>${d.cp}</td><td>${a==='lab'?`${d.science} Science · modifier +${d.modifier}`:a==='rd'?(d.alternatives||[]).map(benefits).join(' OR '):benefits(d.benefits)}</td></tr>`).join('')}</tbody></table>` + rule('Rulebook p. 10.');
  } else if (kind === 'branch') {
    const weather = b, key = a, w = name(weather), ds = key === 'government' ? D.GOV[weather] : key === 'lab' ? D.LAB[weather] : D.RD[weather].map(x=>x.color);
    title = `${w} · ${D.VOUCHER_NAME[key]}`;
    body = p(`${st.research[key][weather]} Research token${st.research[key][weather]===1?'':'s'} remain in this branch.`) + `<div class="detail-list">${st[key][weather].map((s,i)=>`<div><b>${i+1}</b>${V.token(s.owner)}<span>${s.owner==='you'?'Your Bot':s.owner==='saboteurs'?'Saboteur Bot':s.owner==='lativ'?'Lativ Bot':'Empty'}${key==='rd'?`<br>${benefits(D.RD[weather][i].reward)}${D.RD[weather][i].extra?' · also pay any '+D.RD[weather][i].extra:''}`:''}</span>${V.color(ds[i])}</div>`).join('')}</div>`;
    if (key === 'government') body += p('Sell a matching Machine Part with one Bot to take a Subsidy and Research token. A full branch activates immediately: 3 CP per your Bot, +3 target per Saboteur Bot, and a Government marker helps fix this weather.');
    if (key === 'lab') {
      const id = st.experiments.findLast(id=>D.EXPERIMENTS[id].weather===weather), d = id===undefined?null:D.EXPERIMENTS[id];
      body += p(`The Assistant is ${st.assistant===weather?'here now':((D.WEATHER.indexOf(weather)-D.WEATHER.indexOf(st.assistant)+5)%5)+' branches away'}. ${d?`The rightmost matching Experiment costs ${d.cost} Science and pays ${d.cp} CP per Bot, plus a benefit and research.`:'No matching Experiment is in the display.'}`) + p('An Experiment runs only when every space has a Bot and a matching Experiment is displayed. You can displace Lativ’s Bot. Your Chemical is returned to Supply. A failed Experiment still worsens weather when Saboteur Bots are present.');
    }
    if (key === 'rd') body += p('Research uses one Bot and the matching Chemical. The Chemical stays on this space. The bottom space also costs any Chemical or Part as shown, and constructs another Bot for free. The last Bot in the branch gives an Investment instead of research and unlocks citations.');
    body += rule(`Rulebook ${key==='government'?'pp. 14–15':key==='lab'?'pp. 16, 20':'pp. 18–19'}; Solo rules pp. 9–11.`);
  } else if (kind === 'weather') {
    const e=st.extreme[a],d=E.tileData(st,a);title=`${name(a)} · ${e.level?'Level '+e.level:'fixed'}`;
    body=p(e.level?`Breakthrough costs <b>2 R&D + ${d.cost} Science</b>. Supply the three R&D-space Parts below plus ${d.parts.length?d.parts.map(c=>D.COLOR_NAME[c]).join(', '):'no extra Parts'} shown on this tile.`:'This weather is currently fixed. A later Experiment or Saboteur havoc may bring back Extreme Weather.') + p('A Bot on an R&D space may supply its Part instead of you. Each of your Bots in the branch and each Part you supply earns 2 CP. Each Saboteur Bot used raises the target by 2. All your supplied Parts must fit in one Workshop row; remaining Parts in that row are discarded. The app checks legal rearrangements for you.') + `<div class="detail-list">${d.spaces.map((r,i)=>`<div><b>${i+1}</b><span>${e.markers[i]?V.esc(e.markers[i]):'Available'}<br>${benefits(r)}</span></div>`).join('')}</div>` + p('Each breakthrough earns an Award. Your third Award earns the Nobel Prize. Filling every marker space fixes this tile. You may only have one Breakthrough marker on each tile.') + rule('Rulebook pp. 18–19; Solo rules p. 11.');
  } else if (kind === 'experiment') {
    const d = D.EXPERIMENTS[Number(a)]; title = `${name(d.weather)} · Stage ${d.stage}`;
    body = p(`Pay <b>${d.cost} Science</b> once to receive <b>${d.cp} CP per Bot</b> returned from the branch, one Research token if available (otherwise Science), and your choice of:`) + `<ul>${d.rewards.map(r=>`<li>${benefits(r)}</li>`).join('')}</ul>` + p('First return all your Bots. If you decline payment, you get no CP, benefit, or research. Benefits do not cost their normal vouchers, but any required materials still apply.') + rule('Rulebook p. 20.');
  } else if (kind === 'chemical') {
    title = `${D.COLOR_NAME[a]} Chemical`;
    body = p(`${st.supply[a]} of 5 are in Supply. ${st.supply[a]?`Next acquisition costs ${E.chemicalPrice(st,a)} Supply.`:'None can currently be acquired.'} Returned Chemicals fill the rightmost empty space; the return reward uses that space’s price.`) + p('You need a matching Chemical storage space or the single any-color space. Chemicals spent in Government/Lab go back to Supply; R&D keeps its primary Chemical beside the Bot. An Executive Exchange swaps a Chemical for a needed type at a cost of any two vouchers, only when you lack that type.') + rule('Rulebook pp. 7–8, 13, 16, 18.');
  } else if (kind === 'tile') {
    const d = D.WORKSHOPS[Number(a)]; title='Workshop tile';
    body=p(`${D.COLOR_NAME[d.top]} on one edge, ${D.COLOR_NAME[d.bottom]} on the other. You may rotate 180° when placing it.`)+p('Place orthogonally adjacent to your Workshop, within its three rows. Touching colored semicircles must match. A tile holds one Bot or one Machine Part. Two matching edges between rows form Chemical storage. Placement is permanent; stored resources can rearrange freely.')+rule('Rulebook pp. 7, 13.');
  } else if (kind === 'workshop' || kind === 'inventory' || kind === 'bots') {
    title=kind==='bots'?'Your Bots':'Workshop storage';
    body=p('The three base spaces hold any one Chemical, any one Part, and one Bot. Each Workshop tile holds one Bot or Part. A matching pair of tile edges creates one Chemical space of that color. The app legally rearranges inventory to make room.')+`<div class="detail-list">${st.p.items.map(i=>`<div>${icon(i.type)}<span>${i.color?D.COLOR_NAME[i.color]+' ':''}${i.type}<br><small>${V.esc(i.slot)}</small></span>${i.color?V.color(i.color):''}</div>`).join('')||'<div>No resources in your Workshop.</div>'}</div>`+p(`Bots constructed: ${st.p.assembly.filter(x=>!x).length}. Ready: ${E.items(st,'bot').length}. On the main board: ${['government','lab','rd'].reduce((n,k)=>n+D.WEATHER.reduce((m,w)=>m+E.botCount(st,'you',k,w),0),0)}.`)+rule('Rulebook pp. 7, 13.');
  } else if (kind === 'assembly') {
    const i=Number(a), d=D.ASSEMBLY[i];title=`Assembly Bot ${i+1}`;
    body=p(`Construct for <b>${d.cost} Supply</b>, provided a Bot storage space is available. Gain: <b>${benefits(d.reward)}</b>.`)+p(st.p.assembly[i]?'This Bot is still on your Assembly Line.':'This Assembly space is empty.')+p(i<6?'Empty spaces in the top two sections pay their benefits again at income.':'The third section unlocks with 6 constructed Bots or 5 Office/held tokens. The fourth unlocks with 9 constructed Bots or 8 tokens.')+rule('Rulebook pp. 13, 21.');
  } else if (kind === 'office') {
    title = a===undefined?'Research Office':`Office row ${Number(a)+1}`;
    body=p('Each row holds one weather type. Government, Lab, and R&D Research tokens belong in their matching column. Awards are wild; Citations fill the missing color of a two-token row by sacrificing an unset Goal of that color, once citations are unlocked.')+p('At least one real Research token is required to publish a completed row. A paper scores 2 CP per Research token, 4 per Award, and zero per Citation. It earns an Investment and its row’s publication benefit. A published row can make one Breakthrough.')+(a===undefined?'':p(`Publication benefit: <b>${benefits(D.OFFICE[Number(a)].publish)}</b>.`))+rule('Rulebook pp. 9, 12, 17.');
  } else if (kind === 'goal') {
    const id=Number(a),g=D.GOALS[id],r=E.goalProgress(st,id),set=st.p.activeGoals.find(x=>x.id===id);title=g.name;
    body=p(V.esc(g.text||g.name))+p(`<b>${r.value} / ${r.need}</b> · ${r.met?'condition met':'not yet met'}. ${set?'Active':'Not active'} Goals score 5 CP at final scoring when met. Only active Goals count for immediate victory.`)+p(set?`This Goal ${set.flipped?'has already been flipped for funding':'can be flipped for '+D.VOUCHER_NAME[g.kind]+' funding'} by spending an Investment at the start of a turn.`:'Spend an Investment at the beginning of your turn to place this Goal in a matching-color Goal space. An unset Goal may instead be sacrificed for a Citation.')+rule('Rulebook pp. 9–10, 17, 22; Player Aid Goals.');
  } else if (kind === 'investment' || kind === 'awards') {
    title=kind==='investment'?'Investment tiles':'Awards & the Nobel Prize';
    body=kind==='investment'?p('At the start of your turn, spend one Investment to set a Goal and gain its space’s benefit, or flip an active Goal to receive its Funding track’s benefits. A flipped Goal still scores.')+p(`You have ${st.p.investments} available.`):p('Place held Awards in any empty Office space during your turn. They are wild Research tokens worth 4 CP when published. You may keep them for later. Your third Award earns the Nobel Prize, triggering the last round and worth 5 CP at final scoring.')+p(`${st.p.totalAwards} Awards earned; ${st.p.awards} still held.`);
    body+=rule('Rulebook pp. 9, 17–19.');
  } else if (kind === 'subsidy' || kind === 'ownedSubsidy') {
    const tile=kind==='subsidy'?st.governmentSubsidies[a][Number(b)]:st.p.subsidies.find(s=>s.id===Number(a)),d=D.SUBSIDIES[tile.id];title=d.name;
    body=p(benefits(d.benefits))+p(kind==='subsidy'?(tile.part?'This space has been replaced with a Machine Part.':tile.used?'This tile has already been secured; it can still be taken when you sell a Part.':'Secure this tile for 2 Government vouchers to gain its row, column, and tile benefits; then flip it. Selling a Part in this branch takes a tile for later use.'):(tile.used?'You have already used this Subsidy.':'You may flip this Subsidy at the start of your turn instead of spending an Investment.'))+p('A benefit never costs its usual vouchers. Required materials still have to be provided unless the benefit explicitly waives them.')+rule('Rulebook pp. 9, 14–15, 23.');
  } else if (kind === 'report') {
    const c=D.REPORTS[Number(a)];title=`Security Report #${c.id+1}`;
    body=V.reportCard(st,c.id)+p('The Current Report chooses the moving Agent and destination. The Previous Report chooses the weather starting point and top/bottom priority. The moving Agent takes left, then right, then middle, or the leftmost Supply space. An invalid destination advances to the next Main Location.')+rule('Solo rules pp. 5–11.');
  } else if (kind === 'reports' || kind === 'saboteurs' || kind === 'havoc') {
    title=kind==='havoc'?`${name(a)} research set`:'The Saboteurs';
    body=p('Agents White and Pink share one opponent turn, target, Hideout, and pool of twelve Bots. They never pay vouchers or use Machine Parts. Branch priorities favor completing Research sets, then different-color matches, then any research; Lab first favors the most Bots.')+p('A locked-weather set uses all three Research colors. An unlocked-weather set uses two different colors; holding all three spends all three. Awards fill missing colors. At most one set is resolved per Saboteur turn, with locked weather first.')+p('Locked set: worsen weather, discard a Report, unlock citations. Unlocked set: you choose target +5 or discard a Report, if the deck is not empty.')+rule('Current official Solo rules v8 pp. 6–7.');
  } else { title='Weather Machine';body=p('Tap the Location, branch, resource, or action for the specific rule.'); }
  modal(title,body);
}
function help() {
  modal('Weather Machine · Solo Laboratory', `<p><b>Play the full game against The Saboteurs, the official solo opponent.</b> Tap any board item to inspect the rule, costs, and consequences. Legal choices appear in the decision panel.</p><h3>Getting started</h3><p>Use the initial Supply round to prepare Bots, Chemicals, and storage. In round 1, move to an available middle or right action space. Gain its vouchers, then choose one action.</p><h3>Your research loop</h3><ol><li>Sell Parts to Government, contribute to Lab Experiments, and Research in R&D to collect three colors of research.</li><li>Record a single weather type in each Office row. Publish a completed row in the Lab.</li><li>Build that paper’s prototype in R&D to earn CP and Awards and help fix Extreme Weather.</li><li>Spend Investments to activate Goals and receive Funding.</li></ol><h3>Practice controls</h3><p>The Workshop, Office, Saboteurs, and Journal tabs stay available during every decision. Undo restores the complete state, including hidden decks. Saves happen in this browser after every choice. Export a share code or save file from the menu.</p><h3>Rules & credits</h3><p>Weather Machine: Vital Lacerda. The Saboteurs: Dávid Turczi. Publisher: Eagle-Gryphon Games. This fan-made practice app uses original SVG artwork. It is not an official EGG product.</p><p>Component data transcribed from the supplied rulebooks and Tabletop Simulator definitions. Solo corrections follow the official v8 rules. <a href="docs/RULES.md" target="_blank" rel="noopener">Rules reference</a> · <a href="docs/ENGINE.md" target="_blank" rel="noopener">Implementation notes</a> · <a href="https://www.eagle-gryphon.com/" target="_blank" rel="noopener">Eagle-Gryphon Games ↗</a></p><p class="sheet-rule">WM ${VERSION}. No build step, runtime dependencies, or game artwork downloads. The local resources folder is excluded from Git.</p>`);
}
function menu() {
  modal('Your solo game', `<p>Seed <b>${st.seed}</b> · round ${st.round} · version ${VERSION}</p><div class="sheet-actions">${V.btn(icon('undo')+' Undo last choice','undo','secondary',undo.length?'':'disabled')}${V.btn(icon('download')+' Export save file','download','secondary')}${V.btn(icon('report')+' Share game code','share','secondary')}${V.btn('Load game','import','secondary')}${V.btn(icon('theme')+' Change theme','theme','secondary')}${V.btn('Rules & credits','help','secondary')}${V.btn('New solo game','new','secondary')}</div><p class="sheet-rule">${undo.length} undo steps available. Your saved game stays in this browser. Export a copy to move between devices or report a bug.</p>`);
}
function share() {
  const code=encodeSave({state:st});
  modal('Share your game', `<p>Copy this code for another device or a bug report. It includes the complete position and hidden decks.</p><textarea id="share-code" readonly aria-label="Game share code">${V.esc(code)}</textarea><div class="sheet-actions">${V.btn('Copy code','copy','primary')}${V.btn('Export save file','download','secondary')}</div>`);
}
function importDialog() {
  modal('Load a saved game', `<p>Paste a WM1 share code or the contents of an exported save file. Your current game is replaced only after the save has been validated.</p><textarea id="import-code" aria-label="Saved game code" placeholder="WM1:…"></textarea><div id="import-error" class="error" role="alert"></div>${V.btn('Load this game','load','primary')}`);
}
function doAnswer(index) {
  const before=E.clone(st), previousUndo=undo.slice(), option=st.prompt?.options[index];
  if (!option || option.disabled) return;
  try {
    E.answer(st, option.v); assertState(st); undo.push(before); if(undo.length>MAX_UNDO)undo.shift();
    decisionCollapsed=false; save(); render();
    const focus = matchMedia('(max-width:650px)').matches ? document.querySelector('.decision-toggle') : document.getElementById('decision-title');
    focus?.focus({preventScroll:true});
  } catch(error) {
    console.error(error); st=before;undo=previousUndo;render();
    modal('This choice could not be completed',p(V.esc(error.message))+p('Your previous position has been preserved. Export the game for a bug report, or undo and try another legal choice.')+V.btn('Share this position','share','secondary'));
  }
}
document.addEventListener('click', async event => {
  const el=event.target.closest('[data-do]');if(!el||el.disabled)return;
  const action=el.dataset.do;
  if(action==='close'){close();return;}
  if(action==='info'){info(el.dataset.info);return;}
  if(action==='help'){help();return;}
  if(action==='theme'){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('wm.theme',theme)}catch{}return;}
  if(action==='answer'){doAnswer(Number(el.dataset.choice));return;}
  if(action==='toggleDecision'){
    decisionCollapsed=!decisionCollapsed;render();document.querySelector('.decision-toggle')?.focus({preventScroll:true});return;
  }
  if(action==='awardNow'){
    const before=E.clone(st);
    try{E.placeAward(st);assertState(st);undo.push(before);if(undo.length>MAX_UNDO)undo.shift();save();render();}catch(error){st=before;notice(error.message);}return;
  }
  if(action==='tab'){active=el.dataset.tab;render();return;}
  if(action==='menu'){menu();return;}
  if(action==='share'){share();return;}
  if(action==='review'){active='table';render();document.querySelector('.main-view')?.scrollIntoView({behavior:'smooth'});return;}
  if(action==='undo'){
    if(!undo.length){notice('No earlier choice to undo.');return;}
    st=undo.pop();decisionCollapsed=false;save();if(sheet.open)close();render();notice('Last choice undone.');return;
  }
  if(action==='new'){
    modal('Start another solo game?',p('Your current game will be replaced when you start the new setup. Export it first if you want to keep it.')+`<div class="sheet-actions">${V.btn('Choose new setup','newSetup','primary')}${V.btn('Keep playing','close','secondary')}${V.btn('Export current game','download','secondary')}</div>`);return;
  }
  if(action==='newSetup'){close();showSetup=true;render();window.scrollTo(0,0);return;}
  if(action==='resume'){showSetup=false;render();return;}
  if(action==='start'){
    try{
      const seedInput=document.getElementById('seed').value;
      const options={challenges:[...document.querySelectorAll('input[name="challenge"]:checked')].map(x=>Number(x.value)),...(seedInput!==''?{seed:Number(seedInput)}:{})};
      const next=E.newGame(options);assertState(next);st=next;undo=[];showSetup=false;decisionCollapsed=false;active='table';save();render();window.scrollTo(0,0);
    }catch(error){console.error(error);modal('Setup could not be completed',p(V.esc(error.message)));}return;
  }
  if(action==='import'){importDialog();return;}
  if(action==='load'){
    try{const loaded=parseSave(decodeSave(document.getElementById('import-code').value.trim()));st=loaded.state;undo=loaded.undo||[];showSetup=false;decisionCollapsed=false;active='table';save();close();render();notice('Saved game loaded.');}
    catch(error){document.getElementById('import-error').textContent=error.message;}return;
  }
  if(action==='copy'){
    const text=document.getElementById('share-code').value;
    try{await navigator.clipboard.writeText(text);notice('Game code copied.');}catch{document.getElementById('share-code').select();notice('Select and copy the game code.');}return;
  }
  if(action==='download'){
    const data={format:'WM1',version:VERSION,state:st,undo},url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download=`weather-machine-${st.seed}-round-${st.round}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Save file exported.');
  }
});
sheet.addEventListener('click', event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!['TEXTAREA','INPUT'].includes(event.target.tagName)&&!sheet.open){event.preventDefault();if(undo.length){st=undo.pop();save();render();notice('Last choice undone.');}}});
window.addEventListener('storage',event=>{if(event.key===SAVE_KEY)notice('This game changed in another tab. Reload to use the newest save.');});
render();
if(errorSave)modal('Saved game could not be read',p('The previous save remains in browser storage. Export or restore a known good share code before starting over.')+p(V.esc(errorSave))+V.btn('Load another game','import','primary'));
else if(new URLSearchParams(location.search).has('load'))importDialog();
window.WM={get state(){return st},get undo(){return undo},answer(index){doAnswer(index)}};
