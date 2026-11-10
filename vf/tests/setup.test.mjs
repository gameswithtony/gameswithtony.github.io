import test from 'node:test';
import assert from 'node:assert/strict';
import {session,config} from './helpers.mjs';
const houses=['Valnis','Belitan','Cortozaar','Dunlork','Fenrax','Kradmor','Marqualos','Nervo','Novaris','Shiveus','Thegwyn','Yarvek','Zenor','Astoran'];
test('All fourteen Houses initialize with each origin in solo mode',async()=>{
  for(const house of houses)for(const side of ['A','B']){
    const g=session();try{const {view:v}=await g.start({...config,house,side});assert.equal(v.player.house,house);assert.equal(v.player.side,side);assert.ok(v.decision,house+' '+side);assert.equal(v.mode,'coop');}finally{await g.stop();}
  }
});
test('All eight official solo scenarios initialize',async()=>{
  for(const scenario of ['First Stand','And One for All','Darkest Hour','Ancient Secrets',"Devil's Triangle",'When Darkness Fades','Today Is Not The Day','Fall of Civilization']){
    const g=session();try{const {view:v}=await g.start({...config,scenario});assert.equal(v.scenario,scenario);assert.ok(v.sectors.length>=10);assert.ok(v.decision);}finally{await g.stop();}
  }
});
test('Standard and Hard initialize their proper base scores and Crisis setup',async()=>{
  for(const [difficulty,base] of [['medium',100],['hard',140]]){
    const g=session();try{const {view:v}=await g.start({...config,difficulty});assert.equal(v.voidborn.elements.base_score,base);assert.equal(v.crisis.military.length,1);assert.equal(v.crisis.economic.length,1);}finally{await g.stop();}
  }
});
