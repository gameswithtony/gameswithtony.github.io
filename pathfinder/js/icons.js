// @ts-check
// Original line-icon set (24×24). Shape always carries the meaning; colour only reinforces it.

const P = {
    // resources
    mineral: '<path d="M5 15l2-7 6-3 6 4 1 7-6 4-7-1z"/><path d="M7 8l5 4 1 8M12 12l7-3"/>',
    battery: '<rect x="7" y="4" width="10" height="17" rx="2"/><path d="M10 2h4M13 8l-3 5h4l-3 5"/>',
    water: '<path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    plant: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 15c0-3-2-6-7-6 0 4 2 6 7 6z"/>',
    oxygen: '<circle cx="9" cy="13" r="5"/><circle cx="17.5" cy="7" r="3"/><circle cx="18" cy="17" r="2"/>',
    crystal: '<path d="M12 2l7 7-7 13-7-13z"/><path d="M5 9h14M9 9l3 13 3-13M9 9l3-7 3 7"/>',
    any: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 4v16M4 12h16"/>',
    goal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    // buildings
    mine: '<path d="M4 20h16"/><path d="M6 20l3-9h6l3 9"/><path d="M8 7c3-3 6-3 9 0M12 5v6"/>',
    gen: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    green: '<path d="M3 19h18"/><path d="M5 19v-6a7 7 0 0 1 14 0v6"/><path d="M12 19v-5M12 14c0-2 2-3 3-3M12 16c0-2-2-3-3-3"/>',
    oxy: '<path d="M4 9h11a3 3 0 1 0-3-3"/><path d="M3 13h16a3 3 0 1 1-3 3"/><path d="M5 17h7"/>',
    shelter: '<path d="M3 19h18"/><path d="M5 19v-5a7 7 0 0 1 14 0v5"/><rect x="10" y="14" width="4" height="5"/>',
    // pieces
    colonist: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-5a6 6 0 0 1 12 0v5z"/>',
    bot: '<rect x="6" y="8" width="12" height="9" rx="2"/><path d="M12 8V4M9 12h.01M15 12h.01M8 17v3M16 17v3"/><circle cx="12" cy="3.5" r="1"/>',
    rover: '<path d="M4 15h16l-2-6H8z"/><circle cx="7" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M14 9V5l3-1"/>',
    ship: '<path d="M12 2c3 3 4 7 4 11l2 3v4l-3-2H9l-3 2v-4l2-3c0-4 1-8 4-11z"/><circle cx="12" cy="10" r="1.6"/>',
    adv: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"/>',
    // cards & things
    blueprint: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 15h8v-4l-4-3-4 3z"/>',
    tech: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    develop: '<rect x="3" y="7" width="9" height="10" rx="1"/><path d="M15 12h6M18 9l3 3-3 3"/>',
    upgrade: '<path d="M4 20h16M7 20v-7h10v7"/><path d="M12 3v7M9 6l3-3 3 3"/>',
    scientist: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
    contract: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    warehouse: '<path d="M4 20V9l8-5 8 5v11"/><rect x="8" y="13" width="8" height="7"/><path d="M8 16.5h8"/>',
    research: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/>',
    discovery: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/><circle cx="16" cy="9" r="1.2" fill="currentColor"/>',
    op: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>',
    mission: '<path d="M5 21V4"/><path d="M5 4h12l-3 4 3 4H5"/>',
    lss: '<path d="M4 20V10M9 20V6M14 20v-8M19 20V4"/><path d="M2 14h20" stroke-dasharray="2 2"/>',
    level: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
    shuttle: '<path d="M4 20c2-6 6-12 16-16-4 10-10 14-16 16z"/><path d="M9 15l-3-1 2-4h4M14 11l1 3-4 2"/>',
    pod: '<path d="M7 14l-2 6h14l-2-6"/><path d="M7 14V9a5 5 0 0 1 10 0v5z"/><path d="M12 20v2"/>',
    orbit: '<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M2 12h7M15 12h7M5 9v6M19 9v6"/>',
    mars: '<circle cx="12" cy="12" r="9"/><path d="M6 8c3 1 4 4 8 3M9 17c2-2 5-2 8-1"/>',
    deck: '<rect x="7" y="4" width="12" height="16" rx="2"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
    exec: '<path d="M12 2l6 6-6 14-6-14z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    boost: '<circle cx="9" cy="6" r="3"/><path d="M3 21v-4a6 6 0 0 1 9-5"/><path d="M18 13v8M14 17h8"/>',
    retrieve: '<path d="M9 14l-5-5 5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    travel: '<path d="M4 8h14M14 4l4 4-4 4"/><path d="M20 16H6M10 12l-4 4 4 4"/>',
    production: '<path d="M4 20V10l5 3V10l5 3V6h6v14z"/><path d="M17 3v3"/>',
    hand: '<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5M10 10V3.5a1.5 1.5 0 0 1 3 0V10M13 10V5a1.5 1.5 0 0 1 3 0v6M16 9a1.5 1.5 0 0 1 3 0v4a8 8 0 0 1-8 8 7 7 0 0 1-6-4l-2-4a1.5 1.5 0 0 1 2.6-1.5L7 14"/>',
    // ui
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    log: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    skip: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M5 21V4M5 4h12l-3 4 3 4H5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4v4h-4z"/>',
    play: '<path d="M7 4l12 8-12 8z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
};

/** Pathfinder mark: a diamond eye. */
P.pf = '<path d="M12 2l10 10-10 10L2 12z"/><circle cx="12" cy="12" r="3"/>';
/** You: a round helmet. */
P.you = '<circle cx="12" cy="12" r="9"/><path d="M6 11a6 6 0 0 1 12 0v2H6z"/>';

/** Colour tokens per meaning (also set as CSS vars). */
export const HUE = {
    mineral: 'var(--c-mineral)', battery: 'var(--c-battery)', water: 'var(--c-water)', plant: 'var(--c-plant)',
    oxygen: 'var(--c-oxygen)', crystal: 'var(--c-crystal)', mine: 'var(--c-mineral)', gen: 'var(--c-battery)',
    green: 'var(--c-plant)', oxy: 'var(--c-oxygen)', you: 'var(--c-you)', pf: 'var(--c-pf)', op: 'var(--c-op)',
};

/**
 * @param {string} name
 * @param {{size?:number, color?:string, label?:string, cls?:string, sw?:number}} [o]
 */
export function icon(name, o = {}) {
    const body = P[name] || P.help;
    const s = o.size || 20;
    const col = o.color || HUE[name] || 'currentColor';
    const lab = o.label ? `role="img" aria-label="${o.label}"` : 'aria-hidden="true"';
    return `<svg class="ic ${o.cls || ''}" ${lab} viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${col}" stroke-width="${o.sw || 2}" stroke-linecap="round" stroke-linejoin="round">${o.label ? `<title>${o.label}</title>` : ''}${body}</svg>`;
}
/** Raw inner paths (for embedding inside the map SVG). */
export const iconPaths = name => P[name] || P.help;
export const ICON_NAMES = Object.keys(P);
