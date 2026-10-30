// Random legal play, for smoke tests and engine probes.
import { newGame, applyAction, rand } from '../engine/core.js';
import { generateActions } from '../engine/moves.js';

export function playRandom(seed, seats, mode = 'phone', onStep = null) {
    const s = newGame({ players: seats, seed, mode });
    let guard = 0;
    while (!s.over) {
        const acts = generateActions(s);
        if (!acts.length) throw new Error('no actions');
        const nonPass = acts.filter(a => a.t !== 'pass');
        const pool = nonPass.length && rand(s) < 0.95 ? nonPass : acts;
        applyAction(s, pool[Math.floor(rand(s) * pool.length)]);
        if (onStep) onStep(s);
        if (++guard > 1000) throw new Error('game did not end');
    }
    return s;
}
