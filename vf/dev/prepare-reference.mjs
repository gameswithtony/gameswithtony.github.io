// One-time research preparation. The game itself needs no build step.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'resources/solo-source');
const read = name => fs.readFileSync(path.join(source, fs.readdirSync(source).find(f => f.endsWith('-'+name))), 'utf8');
const out = path.join(root, 'js/rules');
fs.mkdirSync(out, {recursive:true});
const imports = s => s.replace(/(['"])(svelte(?:\/internal)?|svelte\/store|svelte\/transition|fast-json-patch|seedrandom|fast-deep-equal|pako|idb-keyval)\1/g, (_,q,p) => `${q}./runtime.js${q}`).replace(/(from\s*['"]\.\/[^'"]+?)(?<!\.js)(['"])/g, '$1.js$2');
const modules = ['stores','tracks','houses','tokens','agendas','events','stats','focus','turns','combat','crisis','resources','techs','costs','ui','fleets','actions','game','utils','sectors','scenarios','origins'];
for (const name of modules) {
  let text = read(name+'.js');
  text = imports(text);
  // No UI animation delays or legacy network/storage integration.
  if(name === 'stores') text = text.replace('actionPause: 300', 'actionPause: 0').replace('announcementPause: 1000','announcementPause: 0').replace('autoClick: true','autoClick: false').replace('announcePhases: true','announcePhases: false');
  if(name === 'utils') text = text.replace("import seedrandom from \"./runtime.js\";", "import { seedrandom } from './runtime.js';");
  if(name === 'combat') text = text.replace("import equal from './runtime.js';", "import { equal } from './runtime.js';").replace('return randomElements([-1, 1], 1, Math.random);','return a.id.localeCompare(b.id); // Stable display order; all rules-tied targets remain eligible.');
  if(name === 'scenarios') text = text.replace("name: 'First Contact'", "name: 'First Stand'");
  // Rollup removed these unused stale imports in the original bundle.
  if(name === 'game') text = text.replace('convert, deselect,','convert,').replace('canDo, checkCrisisResolution,','canDo,');
  fs.writeFileSync(path.join(out,name+'.js'), '// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.\n'+text);
}
let setup = read('Setup.svelte');
const helpers = setup.slice(setup.indexOf('    function getHouses(){'), setup.indexOf('  async function startGame(){'));
let core = setup.slice(setup.indexOf('   export function setup('),setup.indexOf('   function generateTechs(){'));
core = core.replace('export function setup(resetVS = true)', 'function setup(resetVS = true)').replace('scenario = customise(scenario);','');
const setupImports = `import {get} from './runtime.js';
import * as jsonpatch from './runtime.js';
import {state,ui,res,prefs,resetStores} from './stores.js';
import {getSectorList,generateDistances,isAdjacent,sectorKey,sectorTypes} from './sectors.js';
import {scenarios} from './scenarios.js';
import {setupTokens,takeToken,topToken,makeAlertDeck as unused} from './tokens.js';
import {shuffle,randomElements,ol,lo,setupSeed,clearList,makeList,moveBitTo} from './utils.js';
import {houses as allHouses,house} from './houses.js';
import {techs} from './techs.js';
import {basic_focus,special_focus,heroic_focus,joint_focus} from './focus.js';
import {galacticEvents} from './events.js';
import {agendas,startingAgendas} from './agendas.js';
import {crisisCards,difficultyLevels,warCards,makeAlertDeck} from './crisis.js';
import {originCards} from './origins.js';
import {getBGImage,setViewScale} from './images.js';
import {logAvailable} from './stats.js';
import {logEvent} from './game.js';
import {moveFleet} from './fleets.js';
import {updateSkirmish} from './combat.js';
import {takeTurns} from './turns.js';
let $state,$ui,$res,$prefs;
state.subscribe(v=>$state=v);ui.subscribe(v=>$ui=v);res.subscribe(v=>$res=v);prefs.subscribe(v=>$prefs=v);
let players=1, houses=allHouses, playerInfo=[], playerHouses=[], chosenHouses=[], fallenHouses=[], chosenDifficulty='easy',techsToUse=[], mode='Co-op', gameSeed='', preselectedFocus=false,strictMode=false, chosenScenario;
const crackedHouses=allHouses.filter(h=>h.cracked),normalHouses=allHouses.filter(h=>!h.cracked);
function getOrigins(h){return originCards.filter(o=>o.house===h)}
`;
let setupModule = setupImports.replace(',makeAlertDeck as unused','')+helpers+core+`
export async function start(config){
  chosenScenario = scenarios.find(s=>s.name===config.scenario && s.players===1 && ['coop','tutorial'].includes(s.type));
  if(!chosenScenario) throw Error('Unknown solo scenario');
  chosenDifficulty=config.difficulty||'easy'; gameSeed=config.seed; preselectedFocus=!!config.preselected;
  playerInfo=[{name:'You',colour:'blue',house:config.house}];
  setup(false); prefs.update(p=>({...p,actionPause:0,announcePhases:false,announcementPause:0,autoClick:false}));
  $state.playTimes=[{start:0}];
  await setupOriginCard($state.players[0], config.side||'A');
  clearList(); makeList(true); updateSkirmish($state.players[0]);
  $res.lastState=jsonpatch.deepClone($state);
  ui.update(u=>u); state.update(s=>s);
  await takeTurns();
}
`;
fs.writeFileSync(path.join(out,'setup.js'),imports(setupModule));

// The public app's own image table, before any DOM/image initialization.
let ims=read('images.js');
ims=ims.slice(ims.indexOf('let simpleImages'),ims.indexOf('let images ='));
const context={houseOrder:['Valnis','Belitan','Dunlork','Cortozaar','Zenor','Thegwyn','Shiveus','Yarvek','Nervo','Astoran','Fenrax','Kradmor','Marqualos','Novaris']};
try {
  vm.runInNewContext(ims+';this.manifest={simpleImages,compositeImages};',context);
  fs.writeFileSync(path.join(root,'resources/asset-manifest.json'),JSON.stringify(context.manifest,null,2));
} catch(e) { console.error('Image table:',e.message); }
console.log('Prepared rules modules and local research manifest.');
