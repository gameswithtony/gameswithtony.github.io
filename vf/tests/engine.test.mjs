import test from 'node:test';
import assert from 'node:assert/strict';
import {session,config,answer,automatic} from './helpers.mjs';
import {game,setup} from '../js/views.js';

test('Solo setup has ten sectors, conserved fleet power, local views, and inspectable decisions',async()=>{
  const g=session();try{
    const first=await g.start(config),v=first.view;
    assert.equal(v.scenario,'First Stand');assert.equal(v.mode,'coop');assert.equal(v.sectors.length,10);
    const deployed=v.sectors.flatMap(s=>s.fleets).filter(f=>f.owner==='blue').reduce((a,f)=>a+f.cubes.length,0);
    assert.equal(deployed+v.player.fleets.active.length+v.player.fleets.inactive.length,14);
    for(const tab of ['galaxy','house','cards','void','log']){const html=game(v,tab,{scale:1,cardTab:'tech'});assert.ok(html.includes('data-do="tip"'));assert.ok(!html.includes('undefined'));assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Journal'));}
    assert.equal(v.player.resources.food.store,4);
  }finally{await g.stop();}
});

test('Choices replay deterministically; undo and exported transcripts restore the same board',async()=>{
  const g=session();let latest,earlier;
  try{latest=await g.start(config);for(let n=0;n<24;n++){earlier=latest;latest=await answer(g,latest.view,automatic(latest.view.decision));}}finally{await g.stop();}
  const replay=session();try{
    const restored=await replay.start(config,latest.journal);
    assert.deepEqual(restored.view.player,latest.view.player);assert.deepEqual(restored.view.sectors,latest.view.sectors);assert.deepEqual(restored.view.decision,latest.view.decision);
  }finally{await replay.stop();}
  const undo=session();try{
    const restored=await undo.start(config,earlier.journal);
    assert.deepEqual(restored.view.sectors,earlier.view.sectors);assert.equal(restored.view.decision.code,earlier.view.decision.code);
  }finally{await undo.stop();}
});

test('A stale decision is rejected without changing the board',async()=>{
  const g=session();try{
    const first=await g.start(config);
    g.send({type:'command',command:{kind:'option',code:999,index:0}});
    // Inspect the raw message because this is the deliberate failure case.
    const error=await g.next('error');
    assert.equal(error.type,'error');assert.match(error.message,/earlier decision/);
    const current=await g.next();assert.deepEqual(current.view.sectors,first.view.sectors);
  }finally{await g.stop();}
});

test('A revealed Alert has a level, readable name, symbol and inspection text',async()=>{
  const g=session();try{
    let m=await g.start(config);
    for(let n=0;n<12&&m.view.decision.message!=='Alert card for this round';n++)m=await answer(g,m.view,automatic(m.view.decision));
    assert.equal(m.view.decision.message,'Alert card for this round');
    const v=m.view,c=v.cards[v.foreground[0].id];
    assert.equal(c.name,`Level ${c.level} Alert`);assert.equal(c.glyph,'alert');assert.match(c.actionDescription,new RegExp(`level ${c.level} Crisis`));
    const html=game(v,'galaxy',{scale:1});assert.ok(html.includes('Round Alert'));assert.ok(!html.includes('Alert cards.'));
  }finally{await g.stop();}
});
