import test from 'node:test';
import assert from 'node:assert/strict';
import {decision} from '../js/views.js';
test('Resource distribution only offers the structured confirmation, never a generic OK value',()=>{
  const view={phase:'focus phase',foreground:[],cards:{},decision:{code:1,message:'Choose resources',choices:[{index:0,type:'text',ok:true,label:'OK'}],selected:[],adjust:{available:['food','science'],num:2,res:{}}}};
  const html=decision(view,{});
  assert.equal((html.match(/data-do="amount-confirm"/g)||[]).length,1);
  assert.ok(!html.includes('data-do="option"'));
});
test('Payments expose exactly one commit action: Pay & continue',()=>{
  const view={phase:'focus phase',foreground:[],cards:{},decision:{code:1,message:'Paying to Upgrade glory and/or Invade',choices:[{index:0,type:'text',ok:true,label:'OK'}],selected:[],cost:{},payment:[{resource:'energy',amount:2},{resource:'credits',amount:1}],canPay:true,conversions:[]}};
  const html=decision(view,{});
  assert.equal((html.match(/data-do="pay"/g)||[]).length,1);
  assert.ok(!html.includes('data-do="option"'));
  assert.ok(!html.includes('>Continue<'));
});
