import './flow.js';
import './bots.js';
import './office.js';
import './actions.js';
import './economy.js';
import './state.js';
import { newState } from './state.js';
import { run, add } from './runner.js';
import { officeSpaces } from './office.js';
export { answer, choices, clone } from './runner.js';
export * from './state.js';
export * from './actions.js';
export * from './office.js';
export * from './economy.js';
export * from './workshop.js';
export * from './bots.js';
export { movementOptions, humanMenu } from './flow.js';
export function newGame(options) { return run(newState(options)); }
export function canPlaceAward(st) { return !st.over && st.phase === 'you' && st.p.awards > 0 && officeSpaces(st, {kind:'award'}).length > 0 && st.prompt?.task !== 'award' && !['pay','breakthrough','consume'].includes(st.prompt?.task); }
export function placeAward(st) {
  if(!canPlaceAward(st))throw new Error('An Award cannot be placed now.');
  st.prompt=null;add(st,{t:'award'});return run(st);
}
