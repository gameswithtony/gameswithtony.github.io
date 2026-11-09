import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js';
import * as E from '../js/engine.js';
import { H, add, run } from '../js/runner.js';
import { assertState, parseSave } from '../js/saves.js';
import * as Views from '../js/views.js';

const start = (seed=41, challenges=[]) => {const st=E.newGame({seed,challenges});E.answer(st,false);return st;};
const v = st => E.choices(st.prompt);
const select = (st, pred) => E.answer(st, v(st).find(pred));
const onlyTask = (st,task) => {st.stack=[task];st.prompt=null;st.over=false;run(st);};

test('seeded setup is reproducible and physically legal',()=>{
  const a=start(),b=start();assert.deepEqual(a,b);assertState(a);
  assert.equal(a.reportDeck.length,17);assert.equal(a.reportDiscard.length,2);
  assert.notEqual(D.REPORTS[a.reportDiscard[0]].agent,D.REPORTS[a.reportDiscard[1]].agent);
  assert.equal(a.p.goals.length,6);assert.equal(new Set(a.p.goals.map(id=>D.GOALS[id].middle||D.GOALS[id].condition)).size,6);
  assert.equal(D.WEATHER.reduce((n,w)=>n+a.lab[w].filter(s=>s.owner==='lativ').length,0),5);
});
test('all choices are validated before state changes',()=>{
  const st=start(),before=E.clone(st);
  assert.throws(()=>E.answer(st,'invented action'));assert.deepEqual(st,before);
});
test('JSON snapshots restore hidden randomness and legal prompts',()=>{
  const st=start();const saved=parseSave(JSON.parse(JSON.stringify({state:st,undo:[]})));
  E.answer(st,'done');E.answer(saved.state,'done');assert.deepEqual(st,saved.state);
});
test('round one bars left spaces, later rounds make them available',()=>{
  const st=start();E.answer(st,'done');assert.equal(st.prompt.task,'move');
  assert.ok(E.movementOptions(st).every(o=>o.space!==0));
  st.round=2;assert.ok(E.movementOptions(st).some(o=>o.location!==1&&o.space===0));
});
test('Science substitutes and 3-for-1 exchanges only apply when needed',()=>{
  const st=start();st.p.vouchers={supply:3,government:0,lab:0,rd:0,science:0};
  const ps=E.payments(st,{lab:1});assert.equal(ps.length,1);assert.equal(ps[0].supply,3);
  st.p.vouchers.science=1;const next=E.payments(st,{lab:1});assert.equal(next.length,1);assert.equal(next[0].science,1);assert.equal(next[0].supply,0);
  assert.equal(E.canPay(st,{lab:2}),true);
});
test('materials exchange keeps Chemical counts conserved',()=>{
  const st=start(),owned=D.COLORS[0],needed=D.COLORS[1],original={...st.supply};E.store(st,'chemical',owned);st.supply[owned]--;
  const plans=E.materialPlans(st,[{type:'chemical',color:needed}]);assert.equal(plans.length,1);assert.equal(plans[0].extra.length,2);
  E.consumePlan(st,plans[0]);assert.equal(st.supply[owned],original[owned]);assert.equal(st.supply[needed],original[needed]);assertState(st);
});
test('Workshop cannot store a second arbitrary Chemical without a matching edge',()=>{
  const st=start();st.p.items=st.p.items.filter(i=>i.type!=='chemical');
  assert.equal(E.store(st,'chemical','green'),true);st.supply.green--;
  assert.equal(E.canStore(st,'chemical','blue'),false);assertState(st);
});
test('Lativ removes research from the Location he enters',()=>{
  const st=start();st.positions.lativ={location:1,space:-1};
  st.positions.white={location:3,space:1};st.positions.pink={location:4,space:1};
  const old=st.research.government[st.assistant];E.moveLativ(st);
  assert.equal(st.positions.lativ.location,2);assert.equal(st.research.government[st.assistant],Math.max(0,old-1));
});
test('Saboteurs prefer a completing Research token',()=>{
  const st=start();st.saboteurs.tokens=[{kind:'government',weather:'rain'},{kind:'lab',weather:'rain'}];st.saboteurs.awards=0;
  st.research.rd.rain=1;assert.equal(E.researchPriority(st,'rd','rain'),3);
  assert.equal(E.researchPriority(st,'government','rain'),2);
});
test('v8 havoc resolves at most one set and spends three colors when held',()=>{
  const st=start();st.locked.rain=false;st.locked.wind=false;
  st.saboteurs.tokens=['rain','wind'].flatMap(weather=>['government','lab','rd'].map(kind=>({kind,weather})));st.saboteurs.awards=0;
  const first=E.havocSets(st)[0].weather;onlyTask(st,{t:'havoc'});assert.equal(st.prompt.task,'havoc');
  E.answer(st,'target');assert.equal(st.saboteurs.tokens.length,3);assert.ok(st.saboteurs.tokens.every(t=>t.weather!==first));
});
test('fixing a weather tile returns it atop its own stack',()=>{
  const st=start();const w='rain',n=E.tileData(st,w).spaces.length;
  for(let i=0;i<n;i++)E.fixWeather(st,w,i===0?'you:0':'government',i);
  assert.equal(st.extreme[w].level,0);assert.deepEqual(st.extreme[w].stack,[1,2,3]);
  E.worsen(st,w);assert.equal(st.extreme[w].level,1);
});
test('deck exhaustion is checked at the beginning of a Saboteur turn',()=>{
  const st=start();st.reportDeck=[];st.currentReport=null;onlyTask(st,{t:'botTurn'});
  assert.equal(st.over,true);assert.equal(st.result.won,false);
});
test('a failed experiment with Saboteurs worsens weather and leaves their Bots',()=>{
  const st=start();const weather=D.WEATHER.find(w=>st.lab[w].length===3);st.lab[weather]=st.lab[weather].map(()=>({}));st.lab[weather][0]={owner:'saboteurs'};
  onlyTask(st,{t:'experiment',weather});assert.equal(st.extreme[weather].level,2);assert.equal(st.lab[weather][0].owner,'saboteurs');
});
test('two Level 3 tiles cause defeat at the end of your turn',()=>{
  const st=start();st.extreme.rain.level=3;st.extreme.wind.level=3;onlyTask(st,{t:'human',stage:'finish'});
  assert.equal(st.over,true);assert.match(st.result.reason,/Level 3/);
});
test('official Challenge setup effects combine without changing the bot system',()=>{
  const st=start(41,[1,3,4,6,10,11,12]);
  assert.equal(st.target,30);assert.equal(st.saboteurs.awards,2);assert.equal(st.reportDeck.length,15);
  assert.equal(Object.values(st.saboteurs.chemicals).reduce((n,x)=>n+x,0),7);assertState(st);
});
test('fixing a higher weather tile exposes the covered lower tile',()=>{
  const st=start();E.worsen(st,'rain');assert.equal(st.extreme.rain.level,2);
  const n=E.tileData(st,'rain').spaces.length;
  for(let i=0;i<n;i++)E.fixWeather(st,'rain',i?'government':'you:0',i);
  assert.equal(st.extreme.rain.level,1);assert.deepEqual(st.extreme.rain.layers,[1]);assert.deepEqual(st.extreme.rain.stack,[2,3]);
});
test('zero Science on the Lab funding track grants zero, not one',()=>{
  const st=start();st.p.vouchers.science=0;onlyTask(st,{t:'receiveFunding',kind:'lab'});
  assert.equal(st.p.vouchers.science,0);assert.equal(st.prompt.title,'Choose additional Lab funding');
});
test('a publication receives its row benefit before the citation reward payment',()=>{
  const st=start();st.p.vouchers.science=0;st.p.vouchers.supply=0;st.p.vouchers.government=0;st.p.vouchers.lab=0;st.p.vouchers.rd=0;
  st.p.office[1]={weather:'sun',tokens:['government','lab','rd'].map(kind=>({kind,weather:'sun'})),published:false,breakthrough:false};
  onlyTask(st,{t:'publish',row:1,cite:null});
  assert.equal(st.prompt.title,'Gain a voucher');assert.equal(st.p.cp,0);
  E.answer(st,'science');E.answer(st,'science');
  assert.equal(st.prompt.task,'unlock');assert.equal(st.p.cp,6);assert.equal(st.p.vouchers.science,2);
  E.answer(st,true);assert.equal(st.p.cp,9);assert.equal(st.p.vouchers.science,1);
});
test('a Breakthrough can use the Part gained from its marker-space benefit',()=>{
  const st=start();st.p.items=[];st.p.workshop.push({id:0,row:1,col:2,flip:false});E.store(st,'part','blue');E.store(st,'part','green');
  st.p.office[0]={weather:'wind',tokens:['government','lab','rd'].map(kind=>({kind,weather:'wind'})),published:true,breakthrough:false};
  st.p.vouchers={supply:0,government:0,lab:0,rd:2,science:0};
  assert.equal(E.prototypeOptions(st,0).length,0);assert.ok(E.breakthroughOffers(st,0).length);
  onlyTask(st,{t:'breakthrough'});E.answer(st,0);E.answer(st,0);
  let steps=0;while(st.prompt&&steps++<20)E.answer(st,E.choices(st.prompt)[0]);
  assert.ok(steps<20);assert.equal(st.p.cp,6);assert.equal(st.p.totalAwards,1);assert.equal(st.awardReserve,11);assert.equal(st.p.office[0].breakthrough,true);assert.equal(E.items(st,'part').length,0);
});
test('an Award may interrupt a start-of-turn publication decision',()=>{
  const st=start();st.phase='you';st.p.awards=1;st.p.totalAwards=1;st.awardReserve=11;
  st.p.subsidies=[{id:1,used:false}];onlyTask(st,{t:'useTile'});
  assert.equal(E.canPlaceAward(st),true);E.placeAward(st);assert.equal(st.prompt.task,'award');E.answer(st,{row:1,col:1});
  assert.equal(st.p.awards,0);assert.equal(st.p.office[1].tokens[1].kind,'award');assert.equal(st.prompt.task,'useTile');
});
test('final Investment handling does not offer Subsidy tiles',()=>{
  const st=start();st.p.subsidies=[{id:1,used:false}];st.p.investments=1;onlyTask(st,{t:'useTile',investmentOnly:true});
  assert.ok(st.prompt.options.every(o=>o.v?.type!=='subsidy'));
});
test('every responsive view renders using only original local graphics',()=>{
  const st=start();assert.match(Views.setup(),/Start a solo game/);
  for(const tab of ['table','workshop','office','reports','history']){
    const html=Views.game(st,tab);assert.ok(html.length>1000);assert.doesNotMatch(html,/undefined|NaN|resources\/|steamusercontent|<img/);
  }
});
test('all eligible Goal conditions have a working progress query',()=>{
  const st=start();for(const goal of D.GOALS.filter(g=>!g.majority)){const progress=E.goalProgress(st,goal);assert.ok(Number.isFinite(progress.value),goal.name);}
});
test('Call Security preserves all three chosen Reports and changes Previous priority',()=>{
  const st=start();st.phase='you';const original=[st.currentReport,...st.reportDeck.slice(0,2)],count=st.reportDiscard.length;onlyTask(st,{t:'security'});
  while(st.prompt?.task==='pay')E.answer(st,E.choices(st.prompt)[0]);
  assertState(st);E.answer(st,original[1]);assertState(st);E.answer(st,original[2]);
  assert.equal(st.currentReport,original[1]);assert.equal(st.reportDeck[0],original[2]);assert.equal(st.reportDiscard.at(-1),original[0]);assert.equal(st.reportDiscard.length,count+1);
});
test('the player chooses which income space loses a returned Bot',()=>{
  const st=start();st.p.items=[];E.store(st,'part','blue');E.store(st,'part','green');E.store(st,'bot',null,'bot998');
  st.p.assembly[0]=false;st.p.assembly[3]=false;st.lab.rain[0]={owner:'you',id:'bot999'};
  onlyTask(st,{t:'returnYourBot',weather:'rain',space:0});
  assert.deepEqual(E.choices(st.prompt),[0,3]);E.answer(st,3);assert.equal(st.p.assembly[3],true);assert.equal(st.p.assembly[0],false);
});
test('strict score and Challenge restrictions apply to both victory routes',()=>{
  const st=start();st.p.cp=st.target;assert.equal(E.finalVictory(st),false);
  st.p.cp++;assert.equal(E.finalVictory(st),true);
  st.challenges=[4];assert.equal(E.finalVictory(st),false);st.p.nobel=true;assert.equal(E.finalVictory(st),true);
  st.challenges=[5];assert.equal(E.finalVictory(st),false);
  st.challenges=[12];assert.equal(E.finalVictory(st),false);
});
test('immediate victory is checked before a human turn starts',()=>{
  const st=start();st.p.cp=100;st.p.funding={government:5,lab:5,rd:0};
  st.p.activeGoals=[9,19,28,31].map(id=>({id,slot:0,flipped:false}));
  st.p.subsidies=Array.from({length:5},(_,id)=>({id,used:false}));
  st.p.office.slice(0,4).forEach(r=>{r.weather='rain';r.tokens=['government','lab','rd'].map(kind=>({kind,weather:'rain'}));r.published=true;});
  assert.equal(E.immediateVictory(st),true);onlyTask(st,{t:'human'});assert.equal(st.over,true);assert.equal(st.result.won,true);
});
test('the final score adds 30 to the target, funding, Goals, and Nobel',()=>{
  const st=start();st.p.cp=80;st.p.nobel=true;st.p.funding={government:9,lab:9,rd:9};
  onlyTask(st,{t:'final'});E.answer(st,'score');
  assert.equal(st.target,65);assert.equal(st.p.cp,103);assert.equal(st.result.won,true);
});
