import {ui} from './stores.js';
import {at} from './utils.js';
export const afterAnimation = async () => {};
export const unhover = () => {};
export function select(id){ ui.update(u=>({...u,selection:[...u.selection,at(id)].filter(Boolean).slice(-u.selectionNum)})); }
export function deselect(id){ui.update(u=>({...u,selection:u.selection.filter(s=>s.id!==id)}));}
