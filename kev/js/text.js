// @ts-check
// Short UI labels. Every line must add a fact.
import * as D from './data.js';

export const M = D.MODEL_NAME, P = D.PART_NAME, DN = D.DEPT_NAME;

/** Turn-menu actions: icon, name. */
export const ACT = {
    train: { ic: 'train', name: 'Train' },
    book: { ic: 'book', name: 'Read a Book' },
    design: { ic: 'design', name: 'Take a Design' },
    kanban: { ic: 'kanban', name: 'Kanban Order' },
    collect: { ic: 'warehouse', name: 'Collect Parts' },
    voucher: { ic: 'voucher', name: 'Parts Voucher' },
    provide: { ic: 'asm', name: 'Provide a Part' },
    claim: { ic: 'garage', name: 'Claim a Car' },
    upgrade: { ic: 'upgraded', name: 'Upgrade a Design' },
    charger: { ic: 'charger', name: 'Charger token' },
    recycle: { ic: 'recycle', name: 'Recycle' },
    sg: { ic: 'star', name: 'Special garage' },
    flip: { ic: 'garage', name: 'Flip garage tile' },
    end: { ic: 'check', name: 'End turn' },
};

/** Why an action is unavailable. */
export const BLOCK = {
    shifts: 'No Shifts left', expert: 'Track complete', books: 'No Books', newBook: 'New Books wait until next turn',
    desk: 'Desk full', noDesign: 'No Designs left', once: 'Once per turn', noKanban: 'No Kanban cards',
    storage: 'Storage full', emptyWare: 'Warehouses empty', certLog: 'Needs Logistics certification',
    noProvide: 'No Part fits any car', noCars: 'Test track empty', garages: 'No empty garage',
    noMatch: 'No Design matches a car on the track', noPart: 'No matching Part, Voucher or supply',
    noUpgDesign: 'No upgradeable Design', chargers: 'No Charger space or token', recycleSame: 'Your Parts are all in Recycling',
    noParts: 'No Parts to swap',
};

/** Benefit codes (certification track, upgrade spaces, display columns, awards, garages). */
export function ben(b) {
    if (!b) return { ic: 'none', txt: 'Nothing' };
    if (b.startsWith('pp')) return { ic: 'pp', txt: `${b.slice(2)} PP`, n: +b.slice(2) };
    return {
        shift: { ic: 'bank', txt: 'Banked Shift' }, book: { ic: 'book', txt: 'Book' }, voucher: { ic: 'voucher', txt: 'Parts Voucher' },
        sp: { ic: 'generic', txt: 'Speech token' },
    }[b] || { ic: 'help', txt: b };
}
export const GARAGE = {
    speech: { ic: 'generic', txt: 'Speech token' }, shift2: { ic: 'bank', txt: '2 Banked Shifts', n: 2 }, book2: { ic: 'book', txt: '2 Books', n: 2 },
    voucher2: { ic: 'voucher', txt: '2 Parts Vouchers', n: 2 }, all4: { ic: 'star', txt: 'Voucher, Speech token, Book and Banked Shift' },
    none: { ic: 'none', txt: 'Nothing' }, book1: { ic: 'book', txt: 'Book' }, shift1: { ic: 'bank', txt: 'Banked Shift' }, voucher1: { ic: 'voucher', txt: 'Parts Voucher' },
    sgUpgrade: { ic: 'upgraded', txt: 'Later: upgrade a Design with a supply Part' },
    sgTrain2: { ic: 'train', txt: 'Later: train once in 2 departments' },
    sgShift5: { ic: 'shift', txt: 'Later: work up to 5 Shifts in a turn' },
    sgAvoid: { ic: 'sandra', txt: "Avoid one of Sandra's penalties" },
    sgDesign: { ic: 'design', txt: 'Later: take a Design and its benefit' },
    sgCarValue: { ic: 'pp', txt: "End: score this garage's car twice" },
    sgSpeech: { ic: 'speech', txt: 'A Speech token on the tile, used once' },
};
export const AWARD = { book: 'Book', pp2: '2 PP', shift: 'Banked Shift', voucher: 'Parts Voucher' };
export const SANDRA_CRIT = {
    rd: 'Upgraded Designs', asm: 'Cars in garages', log: 'Parts on your board', des: 'Designs on your desk', adm: 'Certifications',
};
export const SANDRA_TASK = {
    rd: 'Pace Car +1', asm: 'Clears all Assembly spaces', log: 'Warehouses down to 1 each', des: 'Returns the 4 rightmost Designs', adm: 'End of Week scoring',
};
export const CHARGER = [
    'R&D: once a visit, upgrade with a supply Part',
    'Assembly: ignore Upgraded-first',
    'Logistics: Kanban banks 2 Shifts',
    'Design: Central-stack Design gives a Book',
    'Admin: +1 Shift',
];
export const PLACE = { P1: 'plate 1', P2: 'plate 2', P3: 'plate 3', P4: 'plate 4', P5: 'plate 5', P6: 'plate 6', P7: 'plate 7', P8: 'plate 8', X1: 'top exit (1 PP)', X2: 'middle exit (2 PP)', X3: 'bottom exit (1 PP)' };
export function placeName(n) { return n.startsWith('s:') ? `${M[n.slice(2)]} start` : PLACE[n]; }
/** Direction of a route choice. */
export function routeDir(from, to) {
    const row = { P1: 0, P2: 1, P3: 1, P4: 2, P5: 2, P6: 3, P7: 3, P8: 4, X1: 1, X2: 2, X3: 3 };
    if (row[to] > row[from]) return 'down';
    if (row[to] < row[from]) return 'up';
    return 'left';
}

/** Performance Goal text. */
export function pgText(id) {
    const c = D.pg(id);
    switch (c.c) {
        case 'cars': return 'Car in your garages';
        case 'models': return 'different Car Model';
        case 'model': return `${M[c.x]} car`;
        case 'upgPart': return `Upgraded ${P[c.x]} Design`;
        case 'upg': return 'Upgraded Design';
        case 'tested': return 'Tested Design';
        case 'parts2': return `${P[c.x[0]]} or ${P[c.x[1]]} Part`;
        case 'garages': return `car in garage ${c.x[0] + 1} or ${c.x[1] + 1}`;
        case 'certIn': return `certified in ${DN[c.x]}`;
        case 'designs': return 'Design on your desk';
        case 'books': return 'Book';
        case 'certs': return 'certification';
        case 'vouchers': return 'Parts Voucher';
        case 'shifts': return 'Banked Shift';
        case 'speech': return 'Speech token left on your board';
        case 'chargers': return 'Charger token';
        case 'chargerAt': return `Charger token on space ${c.x + 1}`;
    }
    return '';
}
export function pgIcon(id) {
    const c = D.pg(id);
    return {
        cars: 'garage', models: 'car', model: c.x, upgPart: c.x, upg: 'upgraded', tested: 'tested', parts2: Array.isArray(c.x) ? c.x[0] : 'supply',
        garages: 'garage', certIn: c.x, designs: 'design', books: 'book', certs: 'cert', vouchers: 'voucher', shifts: 'bank', speech: 'speech',
        chargers: 'charger', chargerAt: 'charger',
    }[c.c] || 'pg';
}
/** Final Goal achievement text. */
export function finalText(a) {
    switch (a.c) {
        case 'sameModel': return `${a.n} cars of one Model`;
        case 'upgDiffParts': return `Upgraded Designs for ${a.n} different Parts`;
        case 'certs': return a.n === 5 ? 'Certified in all 5' : `Certified in ${a.n}`;
        case 'cars': return `${a.n} cars`;
        case 'upg': return `${a.n} Upgraded Designs`;
        case 'diffModels': return `${a.n} cars of different Models`;
        case 'upgSamePart': return `${a.n} Upgraded Designs for one Part`;
        case 'certBoth': return `Certified in ${a.x.map(d => DN[d]).join(' and ')}`;
        case 'shifts': return `${a.n} Banked Shifts`;
        case 'books': return `${a.n} Books`;
        case 'experts': return `Expert in ${a.n} departments`;
        case 'model': return `${a.n} ${M[a.x]} cars`;
        case 'upgPart': return `${a.n} Upgraded ${P[a.x]} Designs`;
        case 'tested': return `${a.n} Tested Designs`;
        case 'certsMax': return `Certified in ${a.n} or fewer`;
        case 'testedDiffParts': return `Tested Designs for ${a.n} different Parts`;
        case 'expertsMax': return `Expert in ${a.n} or fewer`;
        case 'chargers': return `${a.n} Charger tokens`;
        case 'certCharger': return `Certified in ${DN[a.x]}, Charger on space ${a.pos + 1}`;
        case 'chargersAt': return `Chargers on spaces ${a.x.map(i => i + 1).join(' and ')}`;
        case 'vouchers': return `${a.n} Parts Vouchers`;
        case 'speech': return `${a.n} Speech tokens on your board`;
    }
    return a.c;
}
export const designName = id => `${M[D.dModel(id)]} ${D.dPart(id) ? P[D.dPart(id)] : 'blank'}`;
export const wsName = ws => ws === D.DESK ? "Sandra's desk" : `${DN[D.DEPTS[Math.floor(ws / 2)]]} ${ws % 2 ? 'bottom' : 'top'}`;
export const WHO = { you: 'You', L: 'Mr Lacerda', T: 'Mr Turczi', S: 'Sandra' };
export const FACT = { cars: 'cars in garages', upg: 'Upgraded Designs', cert: 'certifications' };
