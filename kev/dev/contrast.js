// Contrast audit of the theme tokens: text 4.5:1, icons and large text 3:1, in both themes.
// Usage: node dev/contrast.js
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
function block(sel) {
    const i = css.indexOf(sel + ' {');
    const body = css.slice(i, css.indexOf('}', i));
    const out = {};
    for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
    return out;
}
const light = block(':root, :root[data-theme="light"]');
const dark = { ...light, ...block(':root[data-theme="dark"]') };
const lum = hex => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const v = (t, k) => k.startsWith('#') ? k : t[k];
// [foreground, background, minimum, what]
const PAIRS = [
    ['ink', 'bg', 4.5, 'body text'], ['ink', 'surface', 4.5, 'text'], ['ink', 'floor', 4.5, 'text on board floor'], ['ink', 'raised', 4.5, 'option text'],
    ['muted', 'surface', 4.5, 'secondary text'], ['muted', 'floor', 4.5, 'secondary on floor'], ['muted', 'bg', 4.5, 'secondary on page'], ['muted', 'raised', 4.5, 'hint'],
    ['faint', 'surface', 3, 'blocked icons'], ['faint', 'floor', 3, 'empty benefit icons'],
    ['accent', 'surface', 4.5, 'headings'], ['accent', 'accent-bg', 4.5, 'upgraded'], ['accent', 'bg', 4.5, 'setup title'],
    ['teal', 'surface', 4.5, 'links, benefits'], ['teal', 'teal-bg', 4.5, 'selected'], ['teal', 'floor', 3, 'benefit icons'], ['teal', 'bg', 4.5, 'legend'],
    ['good', 'surface', 4.5, 'gains'], ['good', 'good-bg', 4.5, 'met'], ['bad', 'surface', 4.5, 'losses'], ['bad', 'bad-bg', 4.5, 'toast'],
    ['c-pp', 'surface', 4.5, 'PP numbers'], ['c-pp', 'floor', 4.5, 'PP on floor'], ['c-pp', 'raised', 4.5, 'PP on cards'], ['c-speech', 'raised', 4.5, 'speech slots'],
    ['on-band', 'band', 4.5, 'bands'], ['on-band-muted', 'band', 4.5, 'band secondary'], ['#ffffff', 'sage', 4.5, 'panel headers'],
    ['yellow', 'band', 3, 'tile costs'], ['#1c1c18', 'yellow', 4.5, 'text on yellow'], ['#4a4520', '#f1ecc9', 4.5, 'strip shifts'],
    ['copper', 'bg', 4.5, 'wordmark'],
    ...['motor', 'autopilot', 'battery', 'drivetrain', 'body', 'electronics'].map(p => ['#ffffff', 'part-' + p, 3, 'icon on ' + p]),
    ...['concept', 'sports', 'truck', 'suv', 'city'].flatMap(m => [['car-' + m, 'floor', 3, m + ' on floor'], ['car-' + m, 'surface', 3, m + ' on surface']]),
    ['on-ppb', 'bad', 4.5, 'PP loss badge'], ['on-ppb', 'good', 4.5, 'PP gain badge'],
    ['c-you', 'surface', 3, 'you outline'], ['c-l', 'surface', 3, 'Lacerda outline'], ['c-t', 'surface', 3, 'Turczi outline'], ['c-s', 'surface', 3, 'Sandra outline'],
];
let fails = 0;
for (const [name, t] of [['light', light], ['dark', dark]]) {
    for (const [f, b, min, what] of PAIRS) {
        const fg = v(t, f), bg = v(t, b);
        if (!fg || !bg) { console.log(`${name}: missing ${f} or ${b}`); fails++; continue; }
        const r = ratio(fg, bg);
        if (r < min) { fails++; console.log(`${name.padEnd(5)} FAIL ${r.toFixed(2)} < ${min}  ${what} (${f} ${fg} on ${b} ${bg})`); }
    }
}
// player colours (both themes) on surface
const you = { blue: ['#076f90', '#8fe0f8'], yellow: ['#6b6400', '#f6f08a'], orange: ['#a3460c', '#ffb07a'], purple: ['#7a3480', '#e2a8e8'] };
for (const [c, [l, d]] of Object.entries(you)) {
    if (ratio(l, light.surface) < 3) { fails++; console.log(`light FAIL you ${c}`); }
    if (ratio(d, dark.surface) < 3) { fails++; console.log(`dark  FAIL you ${c}`); }
}
console.log(fails ? `${fails} failures` : `All ${PAIRS.length * 2 + 8} pairs pass`);
