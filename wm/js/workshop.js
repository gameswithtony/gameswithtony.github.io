import * as D from './data.js';

export const tileKey = (r, c) => `tile:${r}:${c}`;
export function tileEdges(tile) {
  const d = D.WORKSHOPS[tile.id];
  return tile.flip ? [d.bottom, d.top] : [d.top, d.bottom];
}
export function at(st, r, c) { return st.p.workshop.find(t => t.row === r && t.col === c); }
export function placements(st, id) {
  const out = [], max = Math.max(1, ...st.p.workshop.map(t => t.col)) + 1;
  for (let r = 0; r < 3; r++) for (let c = 1; c <= max; c++) for (const flip of [false, true]) {
    if (at(st, r, c)) continue;
    if (!(c === 1 || at(st, r, c - 1) || at(st, r, c + 1) || at(st, r - 1, c) || at(st, r + 1, c))) continue;
    const [top, bottom] = tileEdges({ id, flip });
    const above = at(st, r - 1, c), below = at(st, r + 1, c);
    if (above && tileEdges(above)[1] !== top) continue;
    if (below && tileEdges(below)[0] !== bottom) continue;
    out.push({ row: r, col: c, flip });
  }
  return out;
}
export function slots(st) {
  const result = [
    { id: 'chemical', type: 'chemical', color: '*', row: 0, col: 0 },
    { id: 'part', type: 'part', row: 1, col: 0 },
    { id: 'bot', type: 'bot', row: 2, col: 0 },
  ];
  for (const t of st.p.workshop) {
    result.push({ id: tileKey(t.row, t.col), type: 'solid', row: t.row, col: t.col });
    const below = at(st, t.row + 1, t.col);
    if (below) result.push({ id: `chemical:${t.row}:${t.col}`, type: 'chemical', color: tileEdges(t)[1], row: t.row + .5, col: t.col });
  }
  return result;
}
// Bipartite matching performs the free rearrangement permitted by the rules.
// Constraints also verify that prototype parts really fit together in ONE row.
export function packing(st, items = st.p.items, constraints = {}) {
  const spaces = slots(st), occupant = {}, result = {};
  const legal = (item, s) => {
    if (item.type === 'chemical' ? s.type !== 'chemical' || (s.color !== '*' && s.color !== item.color) : !(s.type === item.type || s.type === 'solid')) return false;
    if (constraints.rowItems?.includes(item.id) && s.row !== constraints.row) return false;
    if (constraints.avoidRowItems?.includes(item.id) && s.row === constraints.row) return false;
    if (constraints.fixed?.[item.id] && constraints.fixed[item.id] !== s.id) return false;
    return true;
  };
  function fit(item, seen) {
    const possible = spaces.filter(s => legal(item, s)).sort((a, b) => Number(b.id === item.slot) - Number(a.id === item.slot));
    for (const s of possible) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      if (!occupant[s.id] || fit(occupant[s.id], seen)) {
        occupant[s.id] = item; result[item.id] = s.id; return true;
      }
    }
    return false;
  }
  for (const item of [...items].sort((a, b) => spaces.filter(s => legal(a, s)).length - spaces.filter(s => legal(b, s)).length)) if (!fit(item, new Set())) return null;
  return result;
}
export function repack(st, constraints) {
  const result = packing(st, st.p.items, constraints);
  if (!result) return false;
  st.p.items.forEach(item => { item.slot = result[item.id]; });
  return true;
}
export function canStore(st, type, color) { return !!packing(st, [...st.p.items, { id: 'prospective', type, color }]); }
export function store(st, type, color, id) {
  if (!canStore(st, type, color)) return false;
  st.p.items.push({ id: id ?? `i${++st.itemSeq}`, type, ...(color ? { color } : {}) });
  repack(st); return true;
}
export const items = (st, type, color) => st.p.items.filter(i => i.type === type && (!color || i.color === color));
