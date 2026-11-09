import * as D from './data.js';
import * as E from './engine.js';
import * as V from './views.js';
import { icon } from './icons.js';
import { assertState, parseSave, encodeSave, decodeSave } from './saves.js';
import * as Tips from './tips.js';

export const VERSION = '1.00';
const SAVE_KEY = 'wm.v1', MAX_UNDO = 40;
// A double tap must not land on whatever the next decision puts under the finger.
const TAP_GUARD_MS = 350;
let readyAt = 0;
const root = document.getElementById('app'), sheet = document.getElementById('sheet');
let st = null, undo = [], active = 'table', showSetup = false, decisionCollapsed = false, explainMode = false, errorSave = null, lastFocus = null, noticeTimer;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { const save = parseSave(decodeSave(raw)); st = save.state; undo = save.undo || []; }
} catch (error) { errorSave = String(error.message); }

// Collapsed blocks are a reading preference, kept outside the game save.
const PANEL_KEY = 'wm.panels';
let closedPanels = new Set();
try { closedPanels = new Set(JSON.parse(localStorage.getItem(PANEL_KEY) || '[]')); } catch {}
const savePanels = () => { try { localStorage.setItem(PANEL_KEY, JSON.stringify([...closedPanels])); } catch {} };
const ACTION_PANEL = { sell: 'government', subsidy: 'government', work: 'lativ-s-lab', publish: 'research-office', research: 'research-development', breakthrough: 'research-development', buyChemical: 'supply', returnChemical: 'supply', extend: 'your-workshop', construct: 'bot-assembly-line' };
const TASK_PANEL = { breakthrough: 'research-development', placeResearch: 'research-office', award: 'research-office', construct: 'bot-assembly-line', extend: 'your-workshop', setupWorkshop: 'your-workshop', useTile: 'your-goals', security: 'security-reports' };
/** The block a decision is about never stays collapsed. */
function openPanelForPrompt() {
  const task = st?.prompt?.task, key = task === 'action' ? ACTION_PANEL[st.stack.at(-1)?.kind] : TASK_PANEL[task];
  if (key && closedPanels.delete(key)) savePanels();
}

function render() {
  const scroll = document.querySelector('.choice-list')?.scrollTop || 0, title = st?.prompt?.title;
  root.classList.toggle('game-over', !!st?.over && !showSetup);
  root.innerHTML = st && !showSetup ? V.game(st, active, { decisionCollapsed, explain: explainMode, closedPanels }) : V.setup();
  const list = document.querySelector('.choice-list'); if (list && title === st?.prompt?.title) list.scrollTop = scroll;
  if (showSetup && st) root.querySelector('.setup-links')?.insertAdjacentHTML('afterbegin', V.btn('Resume current game', 'resume', 'text-button'));
  rollScores();
}
/** Header scores count to their new value, so a change is seen rather than discovered. */
const shown = { cp: null, target: null };
let rollFrame;
function rollScores() {
  cancelAnimationFrame(rollFrame);
  if (!st || showSetup) { shown.cp = shown.target = null; return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rolls = [['.your-score b', 'cp', st.p.cp], ['.target-score b', 'target', st.target]].map(([sel, key, to]) => {
    const from = shown[key] === null || reduce ? to : shown[key];
    shown[key] = from;
    return { el: document.querySelector(sel), key, from, to };
  }).filter(r => r.el && r.from !== r.to);
  if (!rolls.length) return;
  const start = performance.now(), span = Math.max(...rolls.map(r => Math.abs(r.to - r.from))), duration = Math.min(900, 250 + 40 * span);
  const step = now => {
    const k = Math.min(1, (now - start) / duration), eased = 1 - (1 - k) ** 3;
    for (const r of rolls) { shown[r.key] = Math.round(r.from + (r.to - r.from) * eased); r.el.textContent = shown[r.key]; }
    if (k < 1) rollFrame = requestAnimationFrame(step);
  };
  rolls.forEach(r => { r.el.textContent = r.from; });
  rollFrame = requestAnimationFrame(step);
}
function notice(text) {
  clearTimeout(noticeTimer); const box = document.getElementById('notice'); box.textContent = text;
  noticeTimer = setTimeout(() => { box.textContent = ''; }, 4500);
}
function save() {
  try { localStorage.setItem(SAVE_KEY, encodeSave({ state: st, undo })); }
  catch { notice('Browser storage is full or unavailable. Export your game from the menu.'); }
}
function modal(title, body, glyph = '') {
  lastFocus = document.activeElement;
  sheet.classList.remove('tip-sheet');
  sheet.innerHTML = `<header class="sheet-head"><h2 id="sheet-title">${glyph}<span>${V.esc(title)}</span></h2>${V.btn(icon('close'),'close','icon-button','aria-label="Close details"')}</header><div class="sheet-body">${body}</div>`;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
function close() { sheet.close(); if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true }); }
const p = text => `<p>${text}</p>`;
/** Icon, name, value, short lines: the same popup for every item on the table and every option. */
function showTip(t) {
  const glyph = D.WEATHER.includes(t.ic) ? V.pennant(t.ic) : icon(t.ic, 24);
  const rows = t.rows ? `<table class="tip-table"><thead><tr>${t.rows[0].map(h => `<th>${V.esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.slice(1).map(r => `<tr>${r.map(x => `<td>${V.esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  modal(t.t, `${t.v ? `<p class="tip-v">${V.esc(t.v)}</p>` : ''}<ul class="tip-lines">${t.d.map(x => `<li>${V.esc(x)}</li>`).join('')}</ul>${rows}${t.rule ? `<p class="sheet-rule">${V.esc(t.rule)}</p>` : ''}`, glyph);
  sheet.classList.add('tip-sheet');
}
function help() {
  modal('Weather Machine · Solo Laboratory', `<p><b>Play the full game against The Saboteurs, the official solo opponent.</b> Tap any board item to inspect the rule, costs, and consequences. Legal choices appear in the decision panel.</p><h3>Getting started</h3><p>Use the initial Supply round to prepare Bots, Chemicals, and storage. In round 1, move to an available middle or right action space. Gain its vouchers, then choose one action.</p><h3>Your research loop</h3><ol><li>Sell Parts to Government, contribute to Lab Experiments, and Research in R&D to collect three colors of research.</li><li>Record a single weather type in each Office row. Publish a completed row in the Lab.</li><li>Build that paper’s prototype in R&D to earn CP and Awards and help fix Extreme Weather.</li><li>Spend Investments to activate Goals and receive Funding.</li></ol><h3>Practice controls</h3><p>The Workshop, Office, Saboteurs, and Journal tabs stay available during every decision. Undo restores the complete state, including hidden decks. Saves happen in this browser after every choice. Export a share code or save file from the menu.</p><h3>Rules & credits</h3><p>Weather Machine: Vital Lacerda. The Saboteurs: Dávid Turczi. Publisher: Eagle-Gryphon Games. This fan-made practice app uses original SVG artwork. It is not an official EGG product.</p><p>Component data transcribed from the supplied rulebooks and Tabletop Simulator definitions. Solo corrections follow the official v8 rules. <a href="docs/RULES.md" target="_blank" rel="noopener">Rules reference</a> · <a href="docs/ENGINE.md" target="_blank" rel="noopener">Implementation notes</a> · <a href="https://www.eagle-gryphon.com/" target="_blank" rel="noopener">Eagle-Gryphon Games ↗</a></p><p class="sheet-rule">WM ${VERSION}. No build step, runtime dependencies, or game artwork downloads. The local resources folder is excluded from Git.</p>`);
}
function menu() {
  modal('Your solo game', `<p>Seed <b>${st.seed}</b> · round ${st.round} · version ${VERSION}</p><div class="sheet-actions">${V.btn(icon('undo')+' Undo last choice','undo','secondary',undo.length?'':'disabled')}${V.btn(icon('download')+' Export save file','download','secondary')}${V.btn(icon('report')+' Share game code','share','secondary')}${V.btn('Load game','import','secondary')}${V.btn('Rules & credits','help','secondary')}${V.btn('New solo game','new','secondary')}</div><p class="sheet-rule">${undo.length} undo steps available. Your saved game stays in this browser. Export a copy to move between devices or report a bug.</p>`);
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
    decisionCollapsed=false; explainMode=false; readyAt=Date.now()+TAP_GUARD_MS; openPanelForPrompt(); save(); render();
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
  if(action==='info'){if(st)showTip(Tips.explain(st,el.dataset.info));else help();return;}
  if(action==='help'){help();return;}
  if(action==='theme'){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#1c303b':'#263d4b');try{localStorage.setItem('wm.theme',theme)}catch{}return;}
  if(action==='answer'){const i=Number(el.dataset.choice);if(explainMode){showTip(Tips.choice(st,st.prompt,st.prompt.options[i]));return;}if(Date.now()<readyAt)return;doAnswer(i);return;}
  if(action==='panel'){const k=el.dataset.panel;if(!closedPanels.delete(k))closedPanels.add(k);savePanels();render();document.querySelector(`[data-do="panel"][data-panel="${k}"]`)?.focus({preventScroll:true});return;}
  if(action==='explain'){explainMode=!explainMode;decisionCollapsed=false;render();return;}
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
    st=undo.pop();decisionCollapsed=false;explainMode=false;readyAt=Date.now()+TAP_GUARD_MS;save();if(sheet.open)close();render();notice('Last choice undone.');return;
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
window.WM={get ready(){return Date.now()>=readyAt},get state(){return st},get undo(){return undo},answer(index){doAnswer(index)}};
