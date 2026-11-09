// Original SVG vocabulary. Shapes, initials, and labels carry meaning independently of color.
const P = {
  rain: '<g fill="currentColor" stroke="none"><path d="M7 3c-2.2 3.2-3.6 4.8-3.6 6.5a3.6 3.6 0 0 0 7.2 0C10.600 7.800 9.200 6.200 7 3Z"/><path d="M17 3c-2.200 3.200-3.600 4.800-3.600 6.500a3.600 3.600 0 0 0 7.200 0C20.600 7.800 19.200 6.200 17 3Z"/><path d="M12 12.500c-2.200 3.200-3.600 4.800-3.600 6.500a3.600 3.600 0 0 0 7.200 0c0-1.700-1.400-3.300-3.600-6.500Z"/></g>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a2 2 0 1 1-2 2M3 16h8a3 3 0 1 1-3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  fog: '<path d="M2.500 7c3.200-3.400 6.300 3.400 9.500 0s6.300 3.400 9.500 0M2.500 12.500c3.200-3.400 6.300 3.400 9.500 0s6.300 3.400 9.500 0M2.500 18c3.200-3.400 6.300 3.400 9.500 0s6.300 3.400 9.500 0"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 4 4-4M8 20l4-4 4 4M3 11l5-1-1-5m14 8-5 1 1 5M7 19l1-5-5-1M17 5l-1 5 5 1"/>',
  supply: '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v11l9 4 9-4V7m-9 4v11M7 5l10 4"/>',
  government: '<path d="m2 8 10-5 10 5H2Zm3 3v8m7-8v8m7-8v8M3 22h18M3 19h18"/>',
  lab: '<path d="M8 3h8m-6 0v7l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 16h10"/><circle cx="12" cy="13" r="1"/>',
  rd: '<path d="M12 2.500a6.800 6.800 0 0 0-4.300 12.100c.9.700 1.300 1.500 1.300 2.400v.5h6V17c0-.9.4-1.700 1.300-2.400A6.800 6.800 0 0 0 12 2.500Z"/><path d="M9.300 21.200h5.400"/>',
  science: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/>',
  bot: '<g fill="currentColor" stroke="none"><circle cx="12" cy="6.200" r="4.700"/><rect x="5" y="10" width="14" height="9.500" rx="3"/><rect x="1.200" y="11" width="3" height="7" rx="1.500"/><rect x="19.800" y="11" width="3" height="7" rx="1.500"/><rect x="7" y="19" width="4" height="4" rx="1"/><rect x="13" y="19" width="4" height="4" rx="1"/><circle cx="12" cy="14.700" r="3" fill="#fffdf7"/><circle cx="10" cy="5.800" r="1.200" fill="#fffdf7"/><circle cx="14" cy="5.800" r="1.200" fill="#fffdf7"/></g><path d="m12 14.700 1.700-1.600" stroke-width="1.400"/>',
  lativBot: '<g fill="currentColor" stroke="none"><rect x="5.500" y="1.800" width="13" height="8.700" rx="1.500"/><rect x="4" y="11.300" width="16" height="8.200" rx="1.500"/><rect x="1" y="12" width="2.400" height="6.500" rx="1"/><rect x="20.600" y="12" width="2.400" height="6.500" rx="1"/><rect x="7" y="19" width="4" height="4" rx="1"/><rect x="13" y="19" width="4" height="4" rx="1"/></g><circle cx="9.200" cy="6.100" r="1.900" stroke="#fffdf7" stroke-width="1.500"/><circle cx="14.800" cy="6.100" r="1.900" stroke="#fffdf7" stroke-width="1.500"/><path d="M10 13.500v3.800h4.500" stroke="#fffdf7" stroke-width="1.800"/>',
  saboteurBot: '<g fill="currentColor" stroke="none"><path d="M7.500 1.800h9l2.700 3.400v5.300H4.800V5.200Z"/><path d="M3.500 11.300h17L19 19.500H5Z"/><path d="M7 19h4v4H7zM13 19h4v4h-4zM.8 11.800l2.500-.5 1 7-2 .4zM23.200 11.800l-2.500-.5-1 7 2 .4z"/></g><path d="M7.700 6.300h8.600" stroke="#fffdf7" stroke-width="2.200" stroke-linecap="butt"/><path d="m9.500 13.300 5 4m0-4-5 4" stroke="#fffdf7" stroke-width="1.800"/>',
  chemical: '<path d="M9 3h6m-5 0v5L5 19a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3L14 8V3M7 16h10"/><path d="M10 12h4"/>',
  part: '<path d="m12 2 8 5v10l-8 5-8-5V7l8-5Zm-8 5 8 5 8-5m-8 5v10"/><path d="m8 5 8 5"/>',
  workshop: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="7" rx="1"/><path d="M14 18h8m-4-4v8"/>',
  office: '<path d="M4 3h16v19H4zM4 9h16M4 15h16M10 3v19m5-19v19"/>',
  paper: '<path d="M5 2h10l5 5v15H5V2Zm10 0v6h5M8 12h9m-9 4h9m-9 3h5"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/><path d="m9 8 2 2 4-4"/>',
  goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m10 12 2 2 8-9"/>',
  investment: '<path d="M3 5h18v14H3zM7 9h10m-5-3v10M3 9l4-4m10 14 4-4"/>',
  subsidy: '<path d="M5 2h14v20H5zM8 7h8m-8 4h8m-8 4h4m3 3 2-2"/>',
  funding: '<path d="M3 20h18M5 17v-4h4v-4h4V5h4V2m-4 0h4v4"/>',
  initiative: '<path d="M5 21V3m0 0h14l-4 5 4 5H5"/>',
  security: '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  saboteurs: '<path d="m6 10 2-6 4 1.5L16 4l2 6Z" fill="currentColor" stroke="none"/><path d="M2 11h20M10 15h4"/><path d="M4 14h6v2a3 3 0 0 1-6 0v-2Zm10 0h6v2a3 3 0 0 1-6 0v-2Z" fill="currentColor" stroke="none"/>',
  you: '<circle cx="12" cy="6" r="3"/><path d="M5 22v-7a7 7 0 0 1 14 0v7M8 22v-6m8 6v-6"/>',
  lativ: '<circle cx="12" cy="7" r="4.5"/><circle cx="10" cy="7" r="1.5"/><circle cx="14" cy="7" r="1.5"/><path d="M11.5 7h1M5 22v-4a7 5 0 0 1 14 0v4M9 14l3 4 3-4M12 18v4"/>',
  cp: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  report: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8m-8 4h8m-8 4h4m1 4h3"/>',
  history: '<path d="M3 10a9 9 0 1 1 0 6M3 4v6h6m3-4v7l4 2"/>',
  undo: '<path d="m8 4-6 6 6 6M2 10h12a7 7 0 0 1 0 14"/>',
  next: '<path d="M3 12h18m-7-7 7 7-7 7"/>',
  back: '<path d="M21 12H3m7-7-7 7 7 7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v7m0-12v1"/>',
  check: '<path d="m4 12 5 5L20 5"/>',
  lock: '<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  download: '<path d="M12 2v14m-5-5 5 5 5-5M3 18v4h18v-4"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.200 9.200a2.900 2.900 0 1 1 4.300 2.500c-1 .6-1.500 1.200-1.500 2.300M12 17.300v.2"/>',
  unlock: '<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.700-1.500"/>',
  voucher: '<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z"/><path d="M14 8v1.500m0 2v1m0 2V16"/>',
  theme: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
};
// The five Chemicals: color plus a symbol, so identity never rests on hue alone.
const SYMBOL = {
  green: '<circle cx="12" cy="12" r="1.900" fill="currentColor"/><path fill="currentColor" d="M10.46 9.54L7.97 5.55A7.6 7.6 0 0 1 16.03 5.55L13.54 9.54A2.9 2.9 0 0 0 10.46 9.54ZM14.90 11.90L19.60 11.73A7.6 7.6 0 0 1 15.57 18.71L13.36 14.56A2.9 2.9 0 0 0 14.90 11.90ZM10.64 14.56L8.43 18.71A7.6 7.6 0 0 1 4.40 11.73L9.10 11.90A2.9 2.9 0 0 0 10.64 14.56Z"/>',
  white: '<path fill="currentColor" d="M12 4.300a6.700 6.700 0 0 0-6.700 6.700c0 2.400 1.200 4.200 2.900 5.300v2.900a.8.8 0 0 0 .8.8h6a.8.8 0 0 0 .8-.8v-2.900c1.700-1.100 2.900-2.900 2.900-5.300A6.700 6.700 0 0 0 12 4.300Z"/><circle cx="9.300" cy="11.300" r="1.900" fill="var(--c)"/><circle cx="14.700" cy="11.300" r="1.900" fill="var(--c)"/>',
  pink: '<circle cx="8.300" cy="15.700" r="3.900" fill="currentColor"/><path d="M11 11.800 16.200 4.800M12.800 13.300l6.400-5M12.900 15.900l6.300-1.700M9.100 10.800l1.800-6" fill="none" stroke="currentColor" stroke-width="1.900" stroke-linecap="round"/>',
  magenta: '<path fill="currentColor" d="M12.200 3.500c.5 3.300 5.300 5.500 5.300 10.700a5.500 5.500 0 0 1-11 0c0-2.300 1.200-3.700 2.300-4.700.2 1.500 1 2.300 1.900 2.500C10.500 9 11.100 5.900 12.200 3.500Z"/>',
  blue: '<circle cx="12.00" cy="8.50" r="3.7" fill="none" stroke="currentColor" stroke-width="1.800"/><circle cx="15.03" cy="13.75" r="3.7" fill="none" stroke="currentColor" stroke-width="1.800"/><circle cx="8.97" cy="13.75" r="3.7" fill="none" stroke="currentColor" stroke-width="1.800"/><circle cx="12" cy="12" r="1.200" fill="currentColor"/>',
};
export const PIECE_COLOR = { green: ['#6fa544', '#14240b'], white: ['#efe9d8', '#2b3733'], pink: ['#e09a8b', '#361a15'], magenta: ['#a92454', '#ffffff'], blue: ['#5aa6cf', '#0f2c3b'] };
const GEAR = 'M20.94 9.10L23.62 9.97L23.62 14.03L20.94 14.90L20.94 14.90L22.60 17.19L20.21 20.47L17.53 19.60L17.53 19.60L17.52 22.43L13.66 23.68L12.00 21.40L12.00 21.40L10.34 23.68L6.48 22.43L6.47 19.60L6.47 19.60L3.79 20.47L1.40 17.19L3.06 14.90L3.06 14.90L0.38 14.03L0.38 9.97L3.06 9.10L3.06 9.10L1.40 6.81L3.79 3.53L6.47 4.40L6.47 4.40L6.48 1.57L10.34 0.32L12.00 2.60L12.00 2.60L13.66 0.32L17.52 1.57L17.53 4.40L17.53 4.40L20.21 3.53L22.60 6.81L20.94 9.10Z';
const symbolAt = (c, x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})" style="--c:${PIECE_COLOR[c][0]};color:${PIECE_COLOR[c][1]}">${SYMBOL[c]}</g>`;
/** Just the symbol, for a Workshop tile edge. */
export const symbol = (c, size = 14) => `<svg class="symbol" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="--c:${PIECE_COLOR[c][0]};color:${PIECE_COLOR[c][1]}">${SYMBOL[c]}</svg>`;
/** A Chemical is a drum, a Machine Part is a gear. Same five colors and symbols. */
export function piece(c, kind = 'chemical') {
  const [fill, on] = PIECE_COLOR[c], line = c === 'white' ? '#7b857f' : 'rgba(0,0,0,.35)';
  const body = kind === 'part'
    ? `<path d="${GEAR}" fill="${fill}" stroke="${line}" stroke-width=".8" stroke-linejoin="round"/>${symbolAt(c, 4.800, 4.800, .6)}`
    : `<path d="M3.200 5.200C3.200 3.400 7.200 2 12 2s8.800 1.400 8.800 3.200v13.600C20.800 20.600 16.800 22 12 22s-8.800-1.400-8.800-3.200Z" fill="${fill}" stroke="${line}" stroke-width=".8"/><path d="M3.200 6c1.300 1.400 4.800 2.200 8.800 2.200S19.500 7.400 20.800 6" fill="none" stroke="${on}" stroke-opacity=".45" stroke-width="1.100"/>${symbolAt(c, 4.900, 7.200, .59)}`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
/** Brass gear around a number. */
export const gearNumber = n => `<span class="gear-n"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${GEAR}" fill="#c0912f" stroke="#7d5a16" stroke-width=".7" stroke-linejoin="round"/></svg><b>${n}</b></span>`;
export const icon = (name, size = 22) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;
export function machineArt() {
  return `<svg class="machine-art" viewBox="0 0 480 240" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="2"><path d="M65 181h350M65 61h350M240 28v193M38 120h407" opacity=".23"/><path d="M90 61v120m75-120v120m75-120v120m75-120v120m75-120v120"/>${[90,165,240,315,390].map((x,i)=>`<g style="color:var(--${['rain','wind','sun','fog','snow'][i]})"><circle cx="${x}" cy="120" r="27" fill="var(--paper)"/><circle cx="${x}" cy="120" r="36" stroke-dasharray="2 7" opacity=".55"/><g transform="translate(${x-14},106) scale(1.16)">${P[['rain','wind','sun','fog','snow'][i]]}</g></g><rect x="${x-14}" y="49" width="28" height="24" rx="6" fill="var(--paper)"/><path d="M${x-5} 57h10m-10 7h10"/><circle cx="${x}" cy="181" r="8" fill="var(--paper)"/>`).join('')}<path d="M65 61H38v120h27m350-120h27v120h-27"/><circle cx="240" cy="28" r="9" fill="var(--accent)"/><path d="M229 219h22M235 230h10"/></g></svg>`;
}
