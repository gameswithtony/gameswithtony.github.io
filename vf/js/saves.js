export const VERSION='1.00';
export const SAVE_KEY='vf.v1';
const KINDS=new Set(['option','confirm','pay','convert','adjust','ranges','combat','cancel','anytime']);
export function validateSave(data,catalog){
  if(!data||data.format!=='VF1'||!data.config||!Array.isArray(data.journal))throw Error('Use a VF1 game code or a Voidfall save file.');
  const c=data.config;
  if(!catalog.scenarios.some(s=>s.name===c.scenario)||!catalog.houses.some(h=>h.name===c.house))throw Error('This save uses an unknown solo scenario or House.');
  if(!['A','B'].includes(c.side)||!['easy','medium','hard'].includes(c.difficulty)||typeof c.seed!=='string'||c.seed.length>100||!c.seed.length)throw Error('The saved setup is invalid.');
  if(data.journal.length>30000)throw Error('This save contains too many decisions.');
  for(const item of data.journal){
    if(!item||!KINDS.has(item.kind)||!Number.isSafeInteger(item.code)||item.code<1)throw Error('The saved decision log is invalid.');
    if(['option','combat'].includes(item.kind)&&(!Number.isSafeInteger(item.index)||item.index<0||item.index>10000))throw Error('The save contains an invalid choice.');
    if(item.indices&&(!Array.isArray(item.indices)||item.indices.length>100||new Set(item.indices).size!==item.indices.length||item.indices.some(i=>!Number.isInteger(i)||i<0||i>10000)))throw Error('The save contains an invalid selection.');
    if(item.values&&(Object.keys(item.values).some(k=>!/^\w{1,40}$/.test(k)||['__proto__','constructor','prototype'].includes(k))||Object.values(item.values).some(v=>!Number.isSafeInteger(v)||v<0||v>1000)))throw Error('The save contains invalid amounts.');
  }
  return {format:'VF1',version:VERSION,config:{scenario:c.scenario,house:c.house,side:c.side,difficulty:c.difficulty,seed:c.seed,preselected:!!c.preselected},journal:data.journal.map(c=>({...c}))};
}
export const makeSave=(config,journal)=>({format:'VF1',version:VERSION,config,journal});
export function encodeSave(save){return 'VF1:'+globalThis.LZString.compressToEncodedURIComponent(JSON.stringify(save));}
export function decodeSave(text,catalog){
  text=String(text).trim();if(text.length>3000000)throw Error('This save is too large.');
  let json=text;
  if(text.startsWith('VF1:')){json=globalThis.LZString.decompressFromEncodedURIComponent(text.slice(4));if(!json)throw Error('The game code is incomplete or damaged.');}
  let data;try{data=JSON.parse(json)}catch{throw Error('Paste the complete VF1 code or the contents of a save file.');}
  return validateSave(data,catalog);
}
