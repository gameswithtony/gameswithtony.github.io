// @ts-check
// All static component data for Kanban EV (3-player setup, as the solo rules use).
// Sources: rulebook, Reference Book (solo rules, pp 2-8), player aid, and the board/card images
// (values read off images are marked "img"). See docs/ENGINE.md for anything interpreted.

// ---------------------------------------------------------------- departments
export const DEPTS = ['rd', 'asm', 'log', 'des', 'adm'];
export const DEPT_NAME = { rd: 'R&D', asm: 'Assembly', log: 'Logistics', des: 'Design', adm: 'Admin' };
/** Shifts per workstation [top, bottom]. img: workstation alley. */
export const WS_SHIFTS = { rd: [2, 3], asm: [2, 3], log: [2, 3], des: [2, 3], adm: [1, 2] };
/** Workstation order top to bottom: index = dept*2 + pos; Sandra's desk is last. */
export const DESK = 10;
export const MAX_SHIFTS = 4;

// ---------------------------------------------------------------- cars and parts
/** Models in Assembly-line order, top to bottom (also the Colleagues' "next car to the right" order). */
export const MODELS = ['concept', 'suv', 'city', 'truck', 'sports'];
export const MODEL_NAME = { concept: 'Concept', suv: 'SUV', city: 'City', truck: 'Truck', sports: 'Sports' };
export const CAR_VALUE = { concept: 6, sports: 5, truck: 4, suv: 3, city: 2 };
export const CARS_PER_MODEL = 8;
/** Parts: warehouses above the Kanban line, then below. img: board warehouse badges. */
export const PARTS = ['motor', 'autopilot', 'battery', 'drivetrain', 'body', 'electronics'];
export const PART_NAME = { motor: 'Motor', autopilot: 'Autopilot', battery: 'Battery', drivetrain: 'Drivetrain', body: 'Body', electronics: 'Electronics' };
export const TOP_PARTS = ['motor', 'autopilot', 'battery'];
export const PARTS_PER_TYPE = 10;

/** Upgrade spaces per Model in R&D (top row then bottom row). img. */
export const UPGRADE_SPACES = {
    concept: ['shift', null, null, null, null, 'book'],
    suv: ['shift', 'shift', null, 'pp3', 'pp2', 'book'],
    city: ['shift', 'shift', 'shift', 'pp4', 'pp3', 'book'],
    truck: ['shift', 'shift', null, 'pp2', null, 'book'],
    sports: ['shift', null, null, 'pp1', null, 'book'],
};
/** Upgrade Value track: steps 0..5. Step 0 is the unlabelled start space. img. */
export const VALUE = [0, 2, 3, 4, 5, 6];
/** A Colleague's kept Part on the start space scores this ("2 to 6 PP", Reference Book p5). Interpretation 1. */
export const BOT_PART_MIN = 2;

/** Assembly spaces per Model. img. */
export const ASM_SPACES = { concept: 4, suv: 3, city: 3, truck: 3, sports: 4 };
/**
 * Assembly line graph. Start spaces are 's:<model>'; yellow plates P1..P8; exits X1 (top, 1 PP),
 * X2 (middle, 2 PP), X3 (bottom, 1 PP). Each list is [left, vertical] where a plate turns.
 * img: plates in rows 2 and 4 are turntables; vertical conveyors point toward the middle row.
 */
export const NEXT = {
    's:concept': ['P1'], 's:suv': ['P3'], 's:city': ['P5'], 's:truck': ['P7'], 's:sports': ['P8'],
    P1: ['P3'], P8: ['P7'],
    P3: ['P2', 'P5'], P2: ['X1', 'P4'],
    P5: ['P4'], P4: ['X2'],
    P7: ['P6', 'P5'], P6: ['X3', 'P4'],
};
export const PLATES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
export const EXIT_PP = { X1: 1, X2: 2, X3: 1 };
/** Setup: one car on each start space and one on the plate just left of it. */
export const START_PLATE = { concept: 'P1', suv: 'P3', city: 'P5', truck: 'P7', sports: 'P8' };

/** Test track (3-player overlay, used in solo): 8 spaces, striped spaces 0 and 4. img. */
export const TRACK_LEN = 8;
export const STRIPE_EVERY = 4;
export const TRACK_SLOTS = 4;
/** Shifts to claim the 1st..4th Car behind the Pace Car. */
export const CLAIM_COST = [1, 2, 2, 3];

/** Demand tiles: Model and Generic Speech tokens placed beside it. img. */
export const DEMAND = { concept: 1, suv: 3, city: 3, truck: 2, sports: 1 };

// ---------------------------------------------------------------- designs
/** 35 Design tiles: each Model has one per Part plus one blank. id "model:part" or "model:-". */
export const DESIGNS = MODELS.flatMap(m => [...PARTS, '-'].map(p => `${m}:${p}`));
export const dModel = id => id.split(':')[0];
export const dPart = id => { const p = id.split(':')[1]; return p === '-' ? null : p; };
/** Benefit for taking a Design from display column 0..3 (left to right). img. */
export const DISPLAY_BEN = [null, null, 'shift', 'book'];

// ---------------------------------------------------------------- Kanban Order cards
/** Each card: three rows of two symbols; row 0 is the matching pair, row 1 is always Drivetrain + Motor. img. */
export const KANBAN = [
    [['autopilot', 'autopilot'], ['drivetrain', 'motor'], ['battery', 'electronics']],
    [['autopilot', 'autopilot'], ['drivetrain', 'motor'], ['electronics', 'body']],
    [['electronics', 'electronics'], ['drivetrain', 'motor'], ['autopilot', 'body']],
    [['body', 'body'], ['drivetrain', 'motor'], ['battery', 'autopilot']],
    [['battery', 'battery'], ['drivetrain', 'motor'], ['body', 'electronics']],
    [['body', 'body'], ['drivetrain', 'motor'], ['electronics', 'autopilot']],
    [['battery', 'battery'], ['drivetrain', 'motor'], ['electronics', 'autopilot']],
    [['electronics', 'electronics'], ['drivetrain', 'motor'], ['battery', 'body']],
    [['electronics', 'electronics'], ['drivetrain', 'motor'], ['autopilot', 'battery']],
    [['autopilot', 'autopilot'], ['drivetrain', 'motor'], ['battery', 'body']],
    [['body', 'body'], ['drivetrain', 'motor'], ['electronics', 'battery']],
    [['battery', 'battery'], ['drivetrain', 'motor'], ['body', 'autopilot']],
];
/** Layouts for placing a Kanban card. flip: pair at the bottom. up: 4 symbols above the line. */
export const KANBAN_LAYOUTS = [
    { k: 'a', flip: false, up: true }, { k: 'b', flip: false, up: false },
    { k: 'c', flip: true, up: true }, { k: 'd', flip: true, up: false },
];

// ---------------------------------------------------------------- certification track
/** Sections 0..5, four spaces each, left to right. Benefit codes: pp<n>, shift, book, voucher, sp (speech), x2 doubles. img. */
export const CERT = [
    [['shift'], ['book'], ['voucher'], []],
    [['pp3'], ['shift'], ['book'], ['voucher']],
    [['pp2', 'sp'], ['shift', 'sp'], ['pp1', 'sp'], ['sp']],
    [['pp4'], ['shift', 'shift'], ['book', 'book'], ['voucher', 'voucher']],
    [['pp2', 'sp'], ['shift', 'sp'], ['pp1', 'sp'], ['sp']],
    [['pp5'], ['pp3'], ['pp1'], []],
];
/** Training track: 0 start, 3 certified, 5 expert. */
export const CERTIFIED = 3, EXPERT = 5;
export const SHIFT_BANK_MAX = 10;
export const START_PP = 15;

// ---------------------------------------------------------------- player board
export const DESK_SPACES = 4;     // +1 with Design certification
export const STORAGE_SPACES = 5;  // +1 with Logistics certification
export const SPEECH_SLOTS = 4;    // +1 with Admin certification
export const SPEECH_TOKENS = 5;
export const GARAGES = 5;         // 5th unlocked by Assembly certification

/** Garage Bonus tiles: garages 1-4 then the 5th (lock) tile. img. */
export const GARAGE_TILES = {
    basic: ['speech', 'shift2', 'book2', 'voucher2', 'all4'],
    expert: ['none', 'book1', 'shift1', 'voucher1', 'speech'],
};
export const SPECIAL_GARAGE = ['sgUpgrade', 'sgTrain2', 'sgShift5', 'sgAvoid', 'sgDesign', 'sgCarValue', 'sgSpeech'];
/** What each garage tile gives. */
export const GARAGE_GAIN = {
    speech: { speech: 1 }, shift2: { shift: 2 }, book2: { book: 2 }, voucher2: { voucher: 2 },
    all4: { voucher: 1, speech: 1, book: 1, shift: 1 },
    none: {}, book1: { book: 1 }, shift1: { shift: 1 }, voucher1: { voucher: 1 },
};

// ---------------------------------------------------------------- goals and awards
/** Award tiles: 5 of each. img. */
export const AWARDS = ['book', 'pp2', 'shift', 'voucher'];
/** Factory Goals: three groups of four tiles. img. */
export const FACTORY = { cars: [2, 3, 4, 5], upg: [2, 3, 4, 5], cert: [2, 3, 4, 5] };

/**
 * Performance Goal cards. c = condition, pp per unit, m = multipliers on the speech icons (highest first).
 * Reference Book p8; card 30 shows the Parts Voucher icon (Interpretation 2).
 */
export const PG = [
    { id: 1, c: 'cars', pp: 2, m: [3, 2, 1] },
    { id: 2, c: 'models', pp: 3, m: [3, 2, 1] },
    { id: 3, c: 'model', x: 'truck', pp: 4, m: [2, 1] },
    { id: 4, c: 'model', x: 'city', pp: 4, m: [2, 1] },
    { id: 5, c: 'model', x: 'concept', pp: 4, m: [2, 1] },
    { id: 6, c: 'model', x: 'sports', pp: 4, m: [2, 1] },
    { id: 7, c: 'model', x: 'suv', pp: 4, m: [2, 1] },
    { id: 8, c: 'upgPart', x: 'battery', pp: 4, m: [2, 1] },
    { id: 9, c: 'upgPart', x: 'electronics', pp: 4, m: [2, 1] },
    { id: 10, c: 'upgPart', x: 'body', pp: 4, m: [2, 1] },
    { id: 11, c: 'upgPart', x: 'autopilot', pp: 4, m: [2, 1] },
    { id: 12, c: 'upgPart', x: 'drivetrain', pp: 4, m: [2, 1] },
    { id: 13, c: 'upgPart', x: 'motor', pp: 4, m: [2, 1] },
    { id: 14, c: 'upg', pp: 2, m: [3, 2, 1] },
    { id: 15, c: 'tested', pp: 4, m: [2, 1] },
    { id: 16, c: 'parts2', x: ['battery', 'electronics'], pp: 2, m: [3, 2, 1] },
    { id: 17, c: 'parts2', x: ['body', 'autopilot'], pp: 2, m: [3, 2, 1] },
    { id: 18, c: 'parts2', x: ['motor', 'drivetrain'], pp: 2, m: [3, 2, 1] },
    { id: 19, c: 'garages', x: [0, 1], pp: 4, m: [2, 1] },
    { id: 20, c: 'garages', x: [1, 2], pp: 4, m: [2, 1] },
    { id: 21, c: 'garages', x: [3, 4], pp: 4, m: [2, 1] },
    { id: 22, c: 'certIn', x: 'rd', pp: 4, m: [1] },
    { id: 23, c: 'certIn', x: 'asm', pp: 4, m: [1] },
    { id: 24, c: 'certIn', x: 'log', pp: 4, m: [1] },
    { id: 25, c: 'certIn', x: 'des', pp: 4, m: [1] },
    { id: 26, c: 'certIn', x: 'adm', pp: 4, m: [1] },
    { id: 27, c: 'designs', pp: 2, m: [3, 2, 1] },
    { id: 28, c: 'books', pp: 2, m: [3, 2, 1] },
    { id: 29, c: 'certs', pp: 3, m: [3, 2, 1] },
    { id: 30, c: 'vouchers', pp: 2, m: [3, 2, 1] },
    { id: 31, c: 'shifts', pp: 2, m: [3, 2, 1] },
    { id: 32, c: 'speech', pp: 3, m: [3, 2, 1] },
    // Speedcharger add-ons
    { id: 41, c: 'chargers', pp: 2, m: [3, 2, 1], addon: true },
    { id: 42, c: 'chargerAt', x: 0, pp: 4, m: [1], addon: true },
    { id: 43, c: 'chargerAt', x: 1, pp: 4, m: [1], addon: true },
    { id: 44, c: 'chargerAt', x: 2, pp: 4, m: [1], addon: true },
    { id: 45, c: 'chargerAt', x: 3, pp: 4, m: [1], addon: true },
    { id: 46, c: 'chargerAt', x: 4, pp: 4, m: [1], addon: true },
];
export const pg = id => PG.find(c => c.id === id);

/** Final Goal tiles: three achievements each. Reference Book p7 (and p6 for add-ons). */
export const FINAL = [
    { id: 1, a: [{ c: 'sameModel', n: 3, pp: 7 }, { c: 'upgDiffParts', n: 3, pp: 6 }, { c: 'certs', n: 5, pp: 8 }] },
    { id: 2, a: [{ c: 'cars', n: 5, pp: 8 }, { c: 'upg', n: 4, pp: 6 }, { c: 'certs', n: 4, pp: 7 }] },
    { id: 3, a: [{ c: 'diffModels', n: 4, pp: 8 }, { c: 'upgSamePart', n: 3, pp: 7 }, { c: 'certBoth', x: ['log', 'asm'], pp: 6 }] },
    { id: 4, a: [{ c: 'shifts', n: 7, pp: 6 }, { c: 'books', n: 3, pp: 8 }, { c: 'experts', n: 2, pp: 7 }] },
    { id: 5, a: [{ c: 'model', x: 'city', n: 2, pp: 8 }, { c: 'upgPart', x: 'battery', n: 2, pp: 7 }, { c: 'certBoth', x: ['rd', 'asm'], pp: 6 }] },
    { id: 6, a: [{ c: 'model', x: 'suv', n: 2, pp: 8 }, { c: 'upgPart', x: 'drivetrain', n: 2, pp: 7 }, { c: 'certBoth', x: ['log', 'des'], pp: 6 }] },
    { id: 7, a: [{ c: 'model', x: 'truck', n: 2, pp: 8 }, { c: 'upgPart', x: 'electronics', n: 2, pp: 7 }, { c: 'certBoth', x: ['asm', 'des'], pp: 6 }] },
    { id: 8, a: [{ c: 'model', x: 'sports', n: 2, pp: 7 }, { c: 'upg', n: 5, pp: 8 }, { c: 'certBoth', x: ['adm'], pp: 6 }] },
    { id: 9, a: [{ c: 'model', x: 'concept', n: 2, pp: 8 }, { c: 'upgPart', x: 'body', n: 2, pp: 7 }, { c: 'certBoth', x: ['rd', 'des'], pp: 6 }] },
    { id: 10, a: [{ c: 'sameModel', n: 3, pp: 7 }, { c: 'tested', n: 5, pp: 7 }, { c: 'certsMax', n: 3, pp: 7 }] },
    { id: 11, a: [{ c: 'diffModels', n: 5, pp: 8 }, { c: 'testedDiffParts', n: 5, pp: 8 }, { c: 'expertsMax', n: 1, pp: 8 }] },
    // Speedcharger add-ons
    { id: 12, addon: true, a: [{ c: 'shifts', n: 7, pp: 6 }, { c: 'chargers', n: 4, pp: 8 }, { c: 'experts', n: 2, pp: 7 }] },
    { id: 13, addon: true, a: [{ c: 'diffModels', n: 4, pp: 8 }, { c: 'upgSamePart', n: 3, pp: 7 }, { c: 'certCharger', x: 'log', pos: 0, pp: 6 }] },
    { id: 14, addon: true, a: [{ c: 'vouchers', n: 2, pp: 7 }, { c: 'chargersAt', x: [1, 3], pp: 6 }, { c: 'certs', n: 5, pp: 8 }] },
    { id: 15, addon: true, a: [{ c: 'books', n: 2, pp: 7 }, { c: 'chargersAt', x: [2, 4], pp: 6 }, { c: 'speech', n: 2, pp: 8 }] },
];
export const fin = id => FINAL.find(f => f.id === id);

/** Sandra's evaluation criteria and departmental task, per department. */
export const SANDRA = {
    rd: { c: 'upg', task: 'pace' },
    asm: { c: 'cars', task: 'clearAsm' },
    log: { c: 'parts', task: 'clearWare' },
    des: { c: 'designs', task: 'clearDesign' },
    adm: { c: 'certs', task: 'week' },
};

// ---------------------------------------------------------------- the Colleagues (solo)
/** Plan cards: department and the end-of-day Parts. Card 0 is Reshuffle. img + /kanbanev/. */
export const PLAN = [
    { id: 1, d: 'rd', parts: ['motor'] }, { id: 2, d: 'rd', parts: [] },
    { id: 3, d: 'asm', parts: ['electronics', 'drivetrain'] }, { id: 4, d: 'asm', parts: [] },
    { id: 5, d: 'log', parts: ['body'] }, { id: 6, d: 'log', parts: [] },
    { id: 7, d: 'des', parts: ['battery'] }, { id: 8, d: 'des', parts: [] },
    { id: 9, d: 'adm', parts: ['autopilot'] }, { id: 10, d: 'adm', parts: [] },
];
export const RESHUFFLE = 0;
export const plan = id => PLAN.find(p => p.id === id);
/** Selection cards: a Part and which Plan card to take (t = top, b = bottom). /kanbanev/. */
export const SELECTION = [
    ['motor', 't'], ['motor', 'b'], ['motor', 'b'],
    ['autopilot', 't'], ['autopilot', 't'], ['autopilot', 'b'],
    ['battery', 't'], ['battery', 't'], ['battery', 'b'],
    ['body', 't'], ['body', 'b'], ['body', 'b'],
    ['electronics', 't'], ['electronics', 't'], ['electronics', 'b'],
    ['drivetrain', 't'], ['drivetrain', 'b'], ['drivetrain', 'b'],
].map(([part, take], i) => ({ id: i + 1, part, take }));
export const sel = id => SELECTION.find(s => s.id === id);
/** Car a Colleague assembles, by Sandra's department. */
export const BOT_ASM_MODEL = { rd: 'concept', asm: 'suv', log: 'city', des: 'truck', adm: 'sports' };
/** Display column a Colleague takes Designs from, by Sandra's department (0 = First Office stacks). */
export const BOT_DESIGN_COL = { rd: 0, asm: 1, log: 2, des: 3, adm: 4 };
/** Mr Turczi claims the most valuable car. */
export const TURCZI_CLAIM = ['concept', 'sports', 'truck', 'suv', 'city'];
export const BOT_PART_CAP = 6;
export const TURCZI_SPEECH = 3;

export const DIFFICULTY = [
    { id: 1, name: 'Certified Lacerda', d: 'Mr Lacerda uses his "if certified" actions everywhere.' },
    { id: 2, name: 'Cushy Speech', d: 'Speech tokens the Colleagues take score 2 PP, not 1.' },
    { id: 3, name: 'Certified Advantage', d: 'Colleagues score the Certification track PP, plus 1 per Speech token on the space.' },
    { id: 4, name: 'Productive Upgrades', d: 'A Colleague covering a PP upgrade space scores it.' },
    { id: 5, name: 'Optimized Upgrades', d: 'A Colleague covering a Shift or Book upgrade space scores 1 PP.' },
    { id: 6, name: 'Increased Quotas', d: 'End of Week: 3 PP per Colleague Upgraded Design, not 2.' },
    { id: 7, name: 'Forced Overtime', d: 'A Colleague training on a maxed track removes 1 of your Banked Shifts.' },
    { id: 8, name: 'Keeping Up', d: 'End of Week: Colleagues also score 2, 4, 6, 8 PP for weeks 1 to 4.' },
    { id: 9, name: 'Immediate Termination', d: 'At 0 PP or below at any time, you are fired.' },
];

export const RANKS = [
    { id: 1, name: 'Musk-a-tier' }, { id: 2, name: 'The CEO' }, { id: 3, name: 'Factory Manager' },
    { id: 4, name: 'Assistant Supervisor' }, { id: 5, name: 'Intern' },
];

// ---------------------------------------------------------------- Speedcharger
export const CHARGER_SLOTS = 5;
export const CHARGER_SUPPLY = 11; // 3-player count
export const CHARGER_ABILITY = ['rd', 'asm', 'log', 'des', 'adm'];

export const PLAYER_COLORS = ['blue', 'yellow', 'orange', 'purple'];
