import * as E from '../js/engine.js';
import { assertState } from '../js/saves.js';
import { rand } from '../js/rng.js';
const games=Number(process.argv[2]||100),seed=Number(process.argv[3]||1);
let maxSteps=0;const ends={};
for(let i=0;i<games;i++){
  const setupSeed=seed+i;let st;
  try{
    st=E.newGame({seed:setupSeed,challenges:process.argv.includes('challenges')?Array.from({length:12},(_,i)=>i+1).filter(n=>(setupSeed*31+n*7)%5===0):[]});
    const sim={rng:setupSeed^0x2188};
    for(let step=0;!st.over;step++){
      if(step>4000)throw new Error('Game did not terminate');
      assertState(st);
      const opts=E.choices(st.prompt);let choice=opts[Math.floor(rand(sim)*opts.length)];
      // Favor actually doing work, while retaining random coverage of all choices.
      if(st.prompt.kind==='menu'&&rand(sim)<.7){const work=opts.filter(v=>v!=='done'&&v!=='initiative'&&v!=='returnChemical'&&v!=='security');if(work.length)choice=work[Math.floor(rand(sim)*work.length)];}
      if(choice==='cancel'&&opts.length>1&&rand(sim)<.85)choice=opts[0];
      E.answer(st,choice);assertState(st);maxSteps=Math.max(maxSteps,step+1);
    }
    const key=st.result.reason;ends[key]=(ends[key]||0)+1;
  }catch(error){console.error('Failed seed',setupSeed,'round',st?.round,'prompt',JSON.stringify(st?.prompt));throw error;}
}
console.log(JSON.stringify({games,seed,maxSteps,results:ends},null,2));
