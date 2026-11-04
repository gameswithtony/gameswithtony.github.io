// @ts-check
// Original 24x24 line icons. Shape always carries the meaning; colour only reinforces it.
const P = {
    // departments
    rd: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z"/><circle cx="12" cy="9" r="2"/>',
    asm: '<path d="M4 21h9"/><path d="M8 21v-5l4-6"/><circle cx="12" cy="10" r="1.6"/><path d="M12 10l6-3"/><path d="M18 7l2 3M18 7l1-3"/><circle cx="8" cy="16" r="1.6"/>',
    log: '<path d="M3 18V8h6l3 5h3v5"/><circle cx="7" cy="18.5" r="2"/><circle cx="15" cy="18.5" r="2"/><path d="M18 4v14h4"/><path d="M9 8V5"/>',
    des: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/><path d="M6 13c2-5 4 1 6-3s4-1 6-4"/>',
    adm: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    // parts
    motor: '<rect x="5" y="7" width="12" height="10" rx="1.5"/><path d="M17 10h3v4h-3M5 11H3M9 7V5h4v2"/><path d="M12 9l-2 3h3l-2 3"/>',
    autopilot: '<path d="M5 21L9 3M19 21L15 3"/><path d="M12 6v2M12 11v2M12 16v2"/><path d="M8 13l-3-3 3-3M16 13l3-3-3-3" stroke-width="1.6"/>',
    battery: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M10 3h4"/><path d="M13 8l-3 5h4l-3 5"/>',
    drivetrain: '<path d="M12 5v14M7 7h10M7 17h10"/><rect x="4" y="4.5" width="3" height="5" rx="1"/><rect x="17" y="4.5" width="3" height="5" rx="1"/><rect x="4" y="14.5" width="3" height="5" rx="1"/><rect x="17" y="14.5" width="3" height="5" rx="1"/>',
    body: '<path d="M3 16v-3l3-1 3-4h7l4 4h1v4"/><path d="M3 16h18"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
    electronics: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/><path d="M10 14l4-4"/>',
    // car models (side views)
    concept: '<path d="M2 16l2-3 7-3h4l7 4v2z"/><circle cx="7" cy="17" r="1.8"/><circle cx="18" cy="17" r="1.8"/>',
    sports: '<path d="M2 16v-2l5-1 4-3h5l4 3 2 1v2z"/><circle cx="7" cy="17" r="1.8"/><circle cx="17.5" cy="17" r="1.8"/><path d="M11 10l-1 3h7"/>',
    truck: '<path d="M2 16v-4l5-1 4-4 11 5v4z"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="18" cy="17" r="1.8"/>',
    suv: '<path d="M2 16v-4l2-5h12l3 5h3v4z"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="17.5" cy="17" r="1.8"/><path d="M8 7v5M2 12h17"/>',
    city: '<path d="M3 16v-3c0-4 3-6 7-6h3c3 0 5 3 6 6l2 1v2z"/><circle cx="7" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
    car: '<path d="M3 16v-3l3-1 3-4h7l4 4h1v4z"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
    // workers (shape = who)
    you: '<circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity=".9"/><circle cx="12" cy="12" r="8"/>',
    L: '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5" fill="currentColor" fill-opacity=".9"/><rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/>',
    T: '<path d="M12 3.5l9 16H3z" fill="currentColor" fill-opacity=".9"/><path d="M12 3.5l9 16H3z"/>',
    S: '<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" fill="currentColor" fill-opacity=".9"/><path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z"/>',
    // resources and tokens
    shift: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    bank: '<circle cx="11" cy="12" r="7"/><path d="M11 8v4l2.5 1.5"/><path d="M17 18h5M20 15.5l2 2.5-2 2.5"/>',
    book: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11"/><path d="M11.5 7v5M9 9.5h5"/>',
    voucher: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9 9l3-1.5L15 9v4.5L12 15l-3-1.5z"/><path d="M9 9l3 1.5L15 9M12 10.5V15"/>',
    speech: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="currentColor" fill-opacity=".25"/><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    generic: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" stroke-dasharray="3 2"/>',
    pp: '<circle cx="12" cy="12" r="9"/><path d="M8 16V8h2.5a2 2 0 0 1 0 4H8M14 16V8h2.5a2 2 0 0 1 0 4H14"/>',
    design: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 15l2-3 4-2h2l3 3v2z"/><path d="M7 7h5"/>',
    upgraded: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M8 12l4-4 4 4M8 16l4-4 4 4"/>',
    tested: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M8 12l3 3 5-6"/>',
    garage: '<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8M7 16h10"/>',
    cert: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4"/><path d="M8.5 13l2.5 2.5 5-5"/>',
    train: '<path d="M3 19h4v-4h4v-4h4V7h4"/><path d="M15 3h4v4"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/>',
    expert: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/><path d="M10 9l1.5 1.5L14.5 7.5"/>',
    pace: '<path d="M5 21V4"/><path d="M5 4h14v9H5"/><path d="M5 8.5h14M9.5 4v9M14 4v9" stroke-width="1.4"/>',
    meeting: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/>',
    week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M10 13v5l4-2.5z"/>',
    cycle: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    kanban: '<rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M3 12h18" stroke-dasharray="2 2"/><circle cx="9.5" cy="6.5" r="1.3"/><circle cx="14.5" cy="6.5" r="1.3"/><circle cx="9.5" cy="17.5" r="1.3"/><circle cx="14.5" cy="17.5" r="1.3"/>',
    recycle: '<path d="M7 8l3-5 3 5"/><path d="M10 3c5 1 8 5 7 10"/><path d="M19 15l-3 5-3-5"/><path d="M16 20c-5 0-9-3-10-8"/><path d="M4 15l2-3 3 2"/>',
    warehouse: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-9h10v9M7 15h10M7 18h10"/>',
    supply: '<path d="M3 8l9-5 9 5-9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    stack: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"/>',
    charger: '<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/><path d="M13 9l-2 3h2l-2 3"/>',
    goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    factory: '<path d="M3 21V10l5 3V10l5 3V10l5 3V4h3v17z"/><path d="M7 17h2M12 17h2"/>',
    final: '<path d="M6 21V3"/><path d="M6 4h12l-3 4 3 4H6"/>',
    hand: '<rect x="3" y="6" width="9" height="13" rx="1.5" transform="rotate(-12 7.5 12.5)"/><rect x="11" y="4" width="9" height="13" rx="1.5" transform="rotate(10 15.5 10.5)"/>',
    pg: '<rect x="3" y="3" width="18" height="13" rx="1.5"/><path d="M7 12v-2M11 12V8M15 12V6"/><path d="M12 16v5M8 21h8"/>',
    track: '<rect x="2" y="6" width="20" height="12" rx="6"/><rect x="7" y="10" width="10" height="4" rx="2"/>',
    demand: '<path d="M4 4h16v11H11l-5 4v-4H4z"/><path d="M7.5 11.5l1-2h7l1 2v1h-9z"/>',
    plan: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    selection: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 7v10M8 13l4 4 4-4"/>',
    difficulty: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    // ui
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14"/><path d="M12 17.5h.01"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    log: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',
    fired: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V5h6v3"/><path d="M9.5 11.5l5 5M14.5 11.5l-5 5"/>',
    buy: '<path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
    skip: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
    swap: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
    sandra: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/><path d="M8 7c0-4 8-4 8 0"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    none: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>',
};
/** Default meaning colours (CSS variables, theme-aware). */
const HUE = {
    motor: 'var(--part-motor)', autopilot: 'var(--part-autopilot)', battery: 'var(--part-battery)', drivetrain: 'var(--part-drivetrain)', body: 'var(--part-body)', electronics: 'var(--part-electronics)',
    concept: 'var(--car-concept)', sports: 'var(--car-sports)', truck: 'var(--car-truck)', suv: 'var(--car-suv)', city: 'var(--car-city)',
    you: 'var(--c-you)', L: 'var(--c-l)', T: 'var(--c-t)', S: 'var(--c-s)',
    pp: 'var(--c-pp)', speech: 'var(--c-speech)', generic: 'var(--c-speech)',
};
/**
 * @param {string} name @param {{size?:number,color?:string,label?:string,cls?:string,sw?:number}} [o]
 */
export function icon(name, o = {}) {
    const body = P[name] || P.help;
    const s = o.size || 20;
    const col = o.color || HUE[name] || 'currentColor';
    const lab = o.label ? `role="img" aria-label="${o.label}"` : 'aria-hidden="true"';
    return `<svg class="ic ${o.cls || ''}" ${lab} viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${col}" stroke-width="${o.sw || 2}" stroke-linecap="round" stroke-linejoin="round">${o.label ? `<title>${o.label}</title>` : ''}${body}</svg>`;
}
export const iconPaths = name => P[name] || P.help;
export const ICON_NAMES = Object.keys(P);
