// Phone mode: a schematic map of the board drawn with SVG (no game art).
// mapSVG(g) returns markup (also usable from Node for screenshots); the Vue component wraps it.
// Positions follow images/board.jpg (1200 x 1200) so it reads like the real board.
import { LOCATIONS, LINKS, SPACES_AT, SPACES, IND, ERA } from '../engine/data.js';

export const IND_ABBR = ['BR', 'MG', 'CT', 'PO', 'CL', 'FE'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const COLOR_HEX = { purple: '#7B5EA7', red: '#E06A2C', yellow: '#E2B93B', gray: '#7E8790' };

const POS = {
    0: [330, 95], 1: [470, 200], 2: [665, 110], 3: [895, 140], 4: [370, 320], 5: [680, 300], 6: [905, 345],
    7: [1080, 215], 8: [480, 440], 9: [835, 470], 10: [360, 530], 11: [570, 555], 12: [840, 615], 13: [95, 655],
    14: [285, 700], 15: [445, 665], 16: [635, 680], 17: [945, 730], 18: [490, 810], 19: [750, 835], 20: [960, 870],
    21: [415, 935], 22: [290, 1010], 23: [700, 995], 24: [880, 1035], 25: [420, 1085], 26: [600, 1110],
};
const SQ = 46;

// Tile label widths in px at 700 16px Atkinson Hyperlegible, measured in Chrome (sim/measure: canvas measureText).
// Labels wider than the tile minus its outline go on two lines.
const LABEL_PX = {
    'BR I': 33.1, 'BR II': 40.5, 'BR III': 47.8, 'BR IV': 43.6,
    'MG I': 37.4, 'MG II': 44.8, 'MG III': 52.1, 'MG IV': 47.9, 'MG V': 40.6, 'MG VI': 47.9, 'MG VII': 55.2, 'MG VIII': 62.6,
    'CT I': 33.1, 'CT II': 40.4, 'CT III': 47.7, 'CT IV': 43.6,
    'PO I': 34.7, 'PO II': 42, 'PO III': 49.3, 'PO IV': 45.2, 'PO V': 37.9,
    'CL I': 31.8, 'CL II': 39.1, 'CL III': 46.5, 'CL IV': 42.3,
    'FE I': 30.4, 'FE II': 37.8, 'FE III': 45.1, 'FE IV': 40.9,
};
const fitsOneLine = label => (LABEL_PX[label] ?? 99) <= 42.5;

export const MAP_CSS = `
.board-map-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 8px; }
.board-map { width: var(--map-zoom, 100%); max-width: none; height: auto; display: block; background: var(--map-bg, #E3E9E6); }
.board-map .sp-empty { fill: var(--map-space, #FBFCFA); stroke: var(--map-line, #15181B); stroke-width: 2px; }
.board-map .sp-tile { stroke: var(--map-line, #15181B); }
.board-map .sp-band { fill: #15181B; }
.board-map .merch { fill: var(--map-merch, #FBFCFA); stroke: var(--map-merch-line, #1B3A57); stroke-width: 4px; }
.board-map .map-name { font: 700 30px 'Atkinson Hyperlegible', sans-serif; fill: var(--map-text, #15181B); paint-order: stroke; stroke: var(--map-halo, #FBFCFA); stroke-width: 7px; }
.board-map .map-net { fill: var(--prussian, #1B3A57); text-decoration: underline; }
.board-map .map-small { font: 400 22px 'Atkinson Hyperlegible', sans-serif; fill: var(--map-text, #15181B); }
.board-map .map-tile { font: 700 16px 'Atkinson Hyperlegible', sans-serif; fill: #FFFFFF; paint-order: stroke; stroke: #15181B; stroke-width: 3px; }
.board-map .map-tile--lvl { font-size: 13px; }
.board-map .map-res { font: 700 13px 'Atkinson Hyperlegible', sans-serif; fill: var(--map-text, #15181B); }
.board-map .map-tiny { font: 400 12px 'Atkinson Hyperlegible', sans-serif; fill: var(--map-tiny, #4A5560); }
.board-map .map-hl .sp-empty, .board-map .map-hl .merch { stroke: var(--prussian, #1B3A57); stroke-width: 6px; }`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const merchText = m => m.accepts.length === 0 ? 'blank' : m.accepts.slice().sort((a, b) => a - b).map(i => IND_ABBR[i]).join(' ');

export function mapSVG(g, highlight = null, net = []) {
    const out = [`<svg class="board-map" viewBox="0 30 1200 1140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of the board. Game State describes the same information as text.">`];
    // lines
    for (const l of LINKS) {
        const [a, b] = l.locs, [x1, y1] = POS[a], [x2, y2] = POS[b];
        const o = g.links[l.id];
        const built = o >= 0;
        const usable = g.era === ERA.Canal ? l.canal : l.rail;
        const color = built ? COLOR_HEX[g.players[o].color] || '#999' : l.canal && l.rail ? '#6E8FA0' : l.canal ? '#4F86B0' : '#55504A';
        const dash = built ? '' : !l.rail ? '10 8' : !l.canal ? '3 6' : '';
        out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${built ? 14 : 5}" ${dash ? `stroke-dasharray="${dash}"` : ''} opacity="${built ? 1 : usable ? 0.75 : 0.18}" stroke-linecap="round"/>`);
    }
    // locations
    for (const loc of LOCATIONS) {
        const [x, y] = POS[loc.id];
        const name = esc(loc.name.replace(' (Cannock)', '').replace(' (Kidderminster)', ''));
        out.push(`<g data-loc="${loc.id}" class="${highlight === loc.id ? 'map-hl' : ''}" style="cursor:pointer">`);
        if (loc.kind === 'merchant') {
            const ms = g.merch.filter(m => m.loc === loc.id).map(m => merchText(m) + (m.beer ? ' (beer)' : '')).join(' | ') || 'no tile';
            out.push(`<rect x="${x - 70}" y="${y - 34}" width="140" height="68" rx="10" class="merch"/>`);
            out.push(`<text x="${x}" y="${y - 10}" text-anchor="middle" class="map-name">${name}</text>`);
            out.push(`<text x="${x}" y="${y + 20}" text-anchor="middle" class="map-small">${esc(ms)}</text>`);
        } else {
            const sps = SPACES_AT[loc.id];
            const w = sps.length * (SQ + 4) - 4;
            sps.forEach((sp, i) => {
                const sx = x - w / 2 + i * (SQ + 4), sy = y - SQ / 2;
                const t = g.spaces[sp];
                if (!t) {
                    out.push(`<rect x="${sx}" y="${sy}" width="${SQ}" height="${SQ}" rx="5" class="sp-empty"/>`);
                    out.push(`<text x="${sx + SQ / 2}" y="${sy + 28}" text-anchor="middle" class="map-tiny">${SPACES[sp].types.map(k => IND_ABBR[k]).join('/')}</text>`);
                    return;
                }
                const color = COLOR_HEX[g.players[t.o].color] || '#999';
                // fill, then the flipped band as the tile's own top edge (rounded top, square bottom), then the outline
                out.push(`<rect x="${sx}" y="${sy}" width="${SQ}" height="${SQ}" rx="5" fill="${color}"/>`);
                if (t.flip) out.push(`<path d="M${sx} ${sy + 12}V${sy + 5}Q${sx} ${sy} ${sx + 5} ${sy}H${sx + SQ - 5}Q${sx + SQ} ${sy} ${sx + SQ} ${sy + 5}V${sy + 12}Z" class="sp-band"/>`);
                out.push(`<rect x="${sx}" y="${sy}" width="${SQ}" height="${SQ}" rx="5" fill="none" class="sp-tile" stroke-width="${t.flip ? 4 : 2}"/>`);
                // one line when it fits ("CT IV"), else industry over level ("MG" / "VIII"); clear of the flipped band
                const label = `${IND_ABBR[t.ind]} ${ROMAN[t.lvl]}`;
                if (fitsOneLine(label)) {
                    out.push(`<text x="${sx + SQ / 2}" y="${sy + 33}" text-anchor="middle" class="map-tile">${label}</text>`);
                } else {
                    out.push(`<text x="${sx + SQ / 2}" y="${sy + 28}" text-anchor="middle" class="map-tile">${IND_ABBR[t.ind]}</text>`);
                    out.push(`<text x="${sx + SQ / 2}" y="${sy + 43}" text-anchor="middle" class="map-tile map-tile--lvl">${ROMAN[t.lvl]}</text>`);
                }
                if (t.res) {
                    const kind = t.ind === IND.CoalMine ? 'coal' : t.ind === IND.IronWorks ? 'iron' : 'beer';
                    out.push(`<text x="${sx + SQ / 2}" y="${sy + SQ + 15}" text-anchor="middle" class="map-res">${t.res} ${kind}</text>`);
                }
            });
            out.push(`<text x="${x}" y="${y - SQ / 2 - 8}" text-anchor="middle" class="map-name${net.includes(loc.id) ? ' map-net' : ''}">${name}</text>`);
        }
        out.push('</g>');
    }
    out.push('</svg>');
    return out.join('');
}

// Vue wrapper (browser only)
if (typeof window !== 'undefined' && window.Vue) {
    const style = document.createElement('style');
    style.textContent = MAP_CSS;
    document.head.appendChild(style);
    window.Vue.component('board-map', {
        props: ['g', 'highlight', 'zoom', 'net'],
        computed: { svg() { return mapSVG(this.g, this.highlight, this.net || []); } },
        methods: {
            tap(e) {
                const el = e.target.closest('[data-loc]');
                if (el) this.$emit('select', +el.getAttribute('data-loc'));
            },
        },
        template: `<div class="board-map-wrap" :style="{ '--map-zoom': (zoom || 1) * 100 + '%' }" v-html="svg" v-on:click="tap"></div>`,
    });
}
