// Small, synchronous stores and deterministic randomness. No framework runtime.
export function writable(value) {
  const listeners = new Set();
  return { subscribe(fn) { listeners.add(fn); fn(value); return () => listeners.delete(fn); },
    set(next) { value = next; for (const fn of [...listeners]) fn(value); },
    update(fn) { this.set(fn(value)); } };
}
export const get = store => { let value; store.subscribe(v => value=v)(); return value; };
export const set = async () => {};
export const update = async () => {};
export const setMany = async () => {};
export const del = async () => {};
export const tick = () => Promise.resolve();
export const crossfade = () => [()=>{},()=>{}];
export const fly = () => {};
export const deepClone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export function equal(a,b) {
  if(a===b) return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object') return false;
  const ak=Object.keys(a).filter(k=>a[k]!==undefined), bk=Object.keys(b).filter(k=>b[k]!==undefined);
  return ak.length===bk.length && ak.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
}
export const compare = (a,b) => equal(a,b)?[]:[{op:'replace',path:'',value:deepClone(b)}];
export function applyPatch(target, patch) {
  for(const op of patch) {
    if(op.path!=='') throw Error('Unsupported legacy patch');
    for(const k of Object.keys(target)) delete target[k];
    Object.assign(target,deepClone(op.value));
  }
  return {newDocument:target};
}
export function seedrandom(seed) {
  let n=2166136261;
  for(const ch of String(seed)) n=Math.imul(n^ch.charCodeAt(0),16777619);
  const random=()=>{ n+=0x6D2B79F5; let z=n; z=Math.imul(z^(z>>>15),z|1); z^=z+Math.imul(z^(z>>>7),z|61); return ((z^(z>>>14))>>>0)/4294967296; };
  random.quick=random; random.state=()=>({n}); return random;
}
export function deflate(){throw Error('Legacy compression is not used by VF saves');}
export function inflate(){throw Error('Load a VF1 save through the menu');}
