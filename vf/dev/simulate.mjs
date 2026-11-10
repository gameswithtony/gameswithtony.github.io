// Exercise the same worker boundary as the UI. This is a mechanical smoke player,
// not a strategy bot or a replacement for rules review by an experienced player.
import {session,config,answer,automatic} from '../tests/helpers.mjs';
const g=session();let last;
try{
  last=await g.start({...config,house:process.argv[2]||config.house,scenario:process.argv[3]||config.scenario,seed:process.argv[4]||config.seed});
  for(let n=0;n<1500&&!last.view.ended;n++){
    const d=last.view.decision;
    if(!d)throw Error('No pending decision');
    if(n%50===0)console.log(n,last.view.phase,d.message.replace(/<[^>]*>/g,''));
    last=await answer(g,last.view,automatic(d));
  }
  console.log(JSON.stringify({ended:last.view.ended,choices:last.journal.length,phase:last.view.phase,score:last.view.player.influence,target:last.view.voidborn.score,decision:last.view.decision?.message}));
  if(!last.view.ended)process.exitCode=1;
}catch(e){console.error(e.message);if(last)console.error('Last decision:',JSON.stringify(last.view.decision));process.exitCode=1;}finally{await g.stop();}
