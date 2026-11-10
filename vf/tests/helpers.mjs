import {Worker} from 'node:worker_threads';
export function session(){
  const worker=new Worker(new URL('./worker-host.mjs',import.meta.url),{execArgv:[]});
  const queue=[],waiting=[];let stopped=false;
  worker.on('message',message=>{const next=waiting.shift();if(next)next(message);else queue.push(message);});
  const receive=()=>new Promise((resolve,reject)=>{
    if(queue.length){resolve(queue.shift());return;}
    const timer=setTimeout(()=>reject(Error('Rules worker timed out')),10000);
    waiting.push(m=>{clearTimeout(timer);resolve(m)});
  });
  const next=async(type='view')=>{for(let i=0;i<1000;i++){const m=await receive();if(m.type===type)return m;if(m.type==='error')throw Error(m.message+'\n'+m.stack);}};
  return {worker,next,send:m=>worker.postMessage(m),stop:()=>{if(!stopped){stopped=true;return worker.terminate();}},async start(config,journal=[]){await next('catalog');worker.postMessage({type:'start',config,journal});return await next();}};
}
export const config={scenario:'First Stand',house:'Valnis',side:'A',difficulty:'easy',seed:'voidfall-verification',preselected:false};
export async function answer(game,view,cmd){game.send({type:'command',command:{code:view.decision.code,...cmd}});return await game.next();}
export function automatic(d){
  if(d.cost)return {kind:'pay'};
  if(d.combat)return {kind:'combat',index:0};
  if(d.adjust){let left=d.adjust.num;const values={};for(const r of d.adjust.available){values[r]=Math.min(left,d.adjust.spendable?.[r]?.store??left);left-=values[r];}return{kind:'adjust',values};}
  if(d.ranges)return {kind:'ranges',values:Object.fromEntries(Object.entries(d.ranges).map(([k,r])=>[k,r.initial??r.min??0]))};
  const options=d.choices.filter(c=>!c.disabled&&!c.toggle);
  const text=options.find(c=>c.type==='text'&&c.label!=='Finish')||options.find(c=>c.type==='text');
  if(text)return {kind:'option',index:text.index};
  if(d.singleClick&&d.selectionNum===1)return{kind:'option',index:options[0].index};
  return{kind:'confirm',indices:options.slice(0,d.optional?0:d.selectionNum||1).map(c=>c.index)};
}
