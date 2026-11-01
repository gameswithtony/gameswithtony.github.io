// @ts-check
// Seeded RNG kept inside the game state so undo/replay is deterministic.

/** @param {{rng:number}} st @returns {number} in [0,1) */
export function rand(st) {
    let t = (st.rng = (st.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** Fisher-Yates in place. @template T @param {{rng:number}} st @param {T[]} a */
export function shuffle(st, a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand(st) * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** @template T @param {{rng:number}} st @param {T[]} a */
export const pick = (st, a) => a[Math.floor(rand(st) * a.length)];
