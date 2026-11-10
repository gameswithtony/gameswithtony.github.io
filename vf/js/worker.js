// One fresh rules process per game/replay. Terminating it also cancels pending decisions.
console.log=()=>{};
const E=await import('./engine.js');
let config=null,journal=[],replay=[],replayIndex=0,busy=false,timer,started=false,lastCode;
const send=message=>postMessage(message);
globalThis.vfRewind=()=>send({type:'rewind'});
const fail=error=>send({type:'error',message:error?.message||String(error),stack:error?.stack});
globalThis.vfError=fail;
function schedule(){clearTimeout(timer);timer=setTimeout(flush,0);}
async function flush(){
  if(!started||busy)return;
  try{
    const view=E.snapshot();
    if(!view||(!view.decision&&!view.ended))return;
    if(replayIndex<replay.length){
      if(!view.decision)return;
      busy=true;
      const cmd=replay[replayIndex++];
      await E.command(cmd);journal.push(cmd);busy=false;schedule();return;
    }
    send({type:'view',view,journal,config,replayed:replayIndex});lastCode=view.decision?.code;
  }catch(error){busy=false;fail(error);}
}
E.state.subscribe(schedule);E.ui.subscribe(schedule);
send({type:'catalog',catalog:E.catalog});
onmessage=async event=>{
  const message=event.data;
  try{
    if(message.type==='start'){
      if(started)throw Error('Start a fresh worker before a new game');
      config=message.config;replay=message.journal||[];started=true;
      E.start(config).then(schedule).catch(fail);return;
    }
    if(message.type==='command'){
      if(busy)throw Error('The previous choice is still resolving');
      busy=true;
      await E.command(message.command);
      if(message.command.kind!=='selection')journal.push(message.command);
      busy=false;schedule();
    }
  }catch(error){busy=false;fail(error);schedule();}
};
addEventListener('unhandledrejection',event=>{event.preventDefault();fail(event.reason);});
