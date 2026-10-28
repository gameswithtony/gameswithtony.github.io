// Regenerates ../data.js from the community-maintained MarvelCDB card data
// (https://github.com/zzorba/marvelsdb-json-data).
//
//   node mc/converter/build.js              pull the latest card data, rebuild data.js, print a report
//   node mc/converter/build.js --offline    rebuild from the copy already in converter/data
//   node mc/converter/build.js --source <dir>   rebuild from some other checkout of the json data
//   node mc/converter/build.js --dry-run    print the report without writing data.js
//
// The report lists what changed in data.js and anything in the card data this script
// doesn't know how to handle yet (new card types, set types, fields...). Hand corrections
// go in overrides.js, never in data.js.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DATA_REPO = 'https://github.com/zzorba/marvelsdb-json-data.git';
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_FILE = path.join(__dirname, '..', 'data.js');
const LISTS = ['heroes', 'villains', 'main_schemes', 'side_schemes', 'minions', 'allies', 'countercards'];

// ---------------------------------------------------------------------------
// What the app knows about. When the report flags something new, decide how the
// app should treat it and add it here (and to app.js if it needs a new feature).
// ---------------------------------------------------------------------------

// Card type -> app list. 'counter' types only appear if their text says they hold counters.
const CARD_TYPES = {
    hero: 'heroes',
    villain: 'villains',
    leader: 'villains',             // Civil War: "affect leaders the same way" as villains
    main_scheme: 'main_schemes',
    side_scheme: 'side_schemes',
    player_side_scheme: 'side_schemes',
    minion: 'minions',
    ally: 'allies',
    alter_ego: 'countercards',
    event: 'countercards',
    support: 'countercards',
    upgrade: 'countercards',
    resource: 'countercards',
    attachment: 'countercards',
    treachery: 'countercards',
    obligation: 'countercards',
    environment: 'countercards',
    evidence_means: 'countercards',
    evidence_motive: 'countercards',
    evidence_opportunity: 'countercards'
};

// Encounter set type -> who its cards belong to in the app's filters.
const SET_TYPES = {
    hero: 'hero',
    hero_special: 'hero',           // e.g. Doctor Strange's Invocation deck (uses parent_code)
    nemesis: 'hero',
    villain: 'villain',
    leader: 'villain',
    modular: 'module',
    standard: 'module',
    expert: 'module',
    evidence: 'module',
    main_scheme: 'module'           // Civil War's swappable main scheme decks
};

// Factions that aren't aspects.
const NON_ASPECT_FACTIONS = ['hero', 'encounter', 'campaign'];

// Encounter sets that come with an aspect. Deadpool rules insert: a player using 'Pool
// shuffles Crisis of Infinite Deadpools into the encounter deck and sets aside the rest of Dreadpool.
const ASPECT_ENCOUNTER_SETS = { pool: ['dreadpool'] };

// Every card field this script has considered. Anything else gets reported.
const KNOWN_FIELDS = new Set([
    // used
    'code', 'name', 'subname', 'type_code', 'faction_code', 'set_code', 'card_set_code', 'pack_code',
    'back_link', 'hidden', 'duplicate_of', 'stage', 'text', 'back_text', 'back_name', 'double_sided', 'traits',
    'health', 'health_per_hero', 'threat', 'threat_fixed', 'base_threat', 'base_threat_fixed',
    // deliberately ignored: player-facing or not something the tracker counts
    'attack', 'attack_star', 'attack_cost', 'defense', 'defense_star', 'thwart', 'thwart_star', 'thwart_cost',
    'recover', 'recover_star', 'scheme', 'scheme_star', 'scheme_acceleration', 'scheme_amplify', 'scheme_crisis',
    'scheme_hazard', 'boost', 'boost_star', 'cost', 'cost_star', 'cost_per_hero', 'hand_size', 'deck_limit',
    'deck_options', 'deck_requirements', 'is_unique', 'permanent', 'resource_energy', 'resource_mental',
    'resource_physical', 'resource_wild', 'escalation_threat', 'escalation_threat_star', 'escalation_threat_fixed',
    'health_star', 'threat_star', 'base_threat_star', 'flavor', 'illustrator', 'octgn_id', 'position',
    'set_position', 'quantity', 'errata', 'meta', 'spoiler', 'scheme text',
    // competitive (PvP) mode only
    'threat_per_group', 'health_per_group', 'base_threat_per_group'
]);

const KNOWN_STATUSES = ['stunned', 'confused', 'tough'];

// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const args = { offline: false, dryRun: false, source: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--offline') args.offline = true;
        else if (argv[i] === '--dry-run') args.dryRun = true;
        else if (argv[i] === '--source') args.source = argv[++i];
        else throw new Error(`Unknown argument: ${argv[i]}`);
    }
    return args;
}

function git(args, cwd) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function syncSource(args) {
    if (args.source) return path.resolve(args.source);

    if (!fs.existsSync(path.join(DATA_DIR, '.git'))) {
        console.log(`Cloning ${DATA_REPO} ...`);
        git(['clone', '--depth', '1', DATA_REPO, DATA_DIR]);
    } else if (!args.offline) {
        console.log('Pulling latest card data ...');
        git(['pull', '--ff-only'], DATA_DIR);
    }
    return DATA_DIR;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadSource(dir) {
    const packDir = path.join(dir, 'pack');
    const raw = [];
    for (const file of fs.readdirSync(packDir).filter(f => f.endsWith('.json')).sort()) {
        raw.push(...readJson(path.join(packDir, file)));
    }

    const packs = readJson(path.join(dir, 'packs.json'));
    const packOrder = new Map(packs.map(p => [p.code, p.position]));

    // Reprints are stubs pointing at the original card; fill them in.
    // Cards are kept in release order so the oldest printing of a name keeps it plain.
    const byCode = new Map(raw.map(c => [c.code, c]));
    const cards = raw.map(c => {
        const card = c.duplicate_of ? { ...byCode.get(c.duplicate_of), ...c } : { ...c };
        card.set_code = card.set_code || card.card_set_code || null;
        return card;
    }).sort((a, b) => (packOrder.get(a.pack_code) - packOrder.get(b.pack_code)) || (a.position - b.position) || a.code.localeCompare(b.code));

    let commit = null;
    let date = null;
    try {
        commit = git(['rev-parse', '--short', 'HEAD'], dir);
        date = git(['log', '-1', '--format=%cs'], dir);
    } catch (e) {
        // not a git checkout; that's fine
    }

    return {
        cards,
        rawCards: raw,
        sets: readJson(path.join(dir, 'sets.json')),
        packs,
        factions: readJson(path.join(dir, 'factions.json')),
        commit,
        date
    };
}

// The heuristic for "this card holds counters of its own" (as opposed to putting
// counters on other cards). Misses and false hits go in overrides.js.
function usesCounters(card, text) {
    if (card.type_code === 'support' && card.traits && card.traits.includes('S.H.I.E.L.D.')) {
        return true;
    }
    if (card.type_code === 'upgrade' && text.includes('suit form.')) {
        return true;
    }

    const name = card.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        // "place 2 growth counters on Groot", "remove 6 progress counters from Ironheart", "toon counter on him"
        new RegExp(`counters? (on|from) (him|her|${name}(?!\\s?[a-z0-9']))`),
        /uses \(\d+ \w+ counters?\)/,                          // "Uses (3 warrior counters)"
        /enters? play with \d+ \w+ counters?/,                 // "enters play with 2 psionic counters"
        /starts? with \d+ \w+ counters?/,                      // "starts with 3 growth counters"
        /(place|put) \d+ \w+ counters? on (this|itself|~)/,    // "place 2 growth counters on this card"
        /remove \d+ \w+ counters? from (this|itself|~)/,       // "remove a quantum counter from this card"
        /\d+ \w+ counters? (on|from) it/,                      // "with 2 acceleration counters on it"
        /counters? from (this|itself|~)/,
        /\w+ counters? here\b/,                                // "knock counter here"
        /gets \+\d+ \w+ (points? )?for each \w+ counter/       // "gets +1 ATK for each momentum counter"
    ];
    return patterns.some(p => p.test(text));
}

// Cards that collect threat on themselves, like Beat Cop or Nick Fury's suit.
function holdsThreat(text) {
    return /\bthreat [^.]*?\b(to|on|from) here\b|\bthreat here\b|threat on this card/.test(text);
}

// "Uses (3 charge counters)" -> 3
function startingCounters(text) {
    const m = text.match(/uses \((\d+)|(?:enters? play|starts?) with (\d+) [^.]*?counters?/);
    return m ? Number(m[1] || m[2]) : 0;
}

// Characters that can hold more than one of a status card, e.g. Luke Cage ("any number of
// tough status cards"), Colossus ("1 additional tough status card"), or steady (2 stunned, 2 confused).
const STACKING_TOUGH = /can have (any number of|\d+ additional) tough status cards?/;

function statusLimits(text) {
    const limits = {};
    const tough = text.match(STACKING_TOUGH);
    if (tough) limits.maxtough = tough[1] === 'any number of' ? 99 : 1 + parseInt(tough[1], 10);
    if (/\bsteady\b/.test(text)) {
        limits.maxstunned = 2;
        limits.maxconfused = 2;
    }
    return limits;
}

// "Suggestion ([energy])" -> "Suggestion (energy)"
function cleanName(name) {
    return name.replace(/\[(\w+)\]/g, '$1');
}

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

// Orders villain stages written as I/II/III, A/B, 1/2 or A1/A2.
function stageRank(stage) {
    if (stage == null) return 0;
    const s = String(stage).toUpperCase();
    if (ROMAN[s]) return ROMAN[s];
    const m = s.match(/^([A-Z]?)(\d*)$/);
    if (!m) return 99;
    const letter = m[1] ? m[1].charCodeAt(0) - 64 : 0;
    const digit = m[2] ? Number(m[2]) : 0;
    return letter * 10 + digit;
}

function build(source, overrides) {
    const { cards, sets, factions } = source;
    const byCode = new Map(cards.map(c => [c.code, c]));
    const setByCode = new Map(sets.map(s => [s.code, s]));
    const packByCode = new Map(source.packs.map(p => [p.code, p]));
    const backCodes = new Set(cards.filter(c => c.back_link).map(c => c.back_link));
    const isBack = c => backCodes.has(c.code) || c.hidden === true;
    const setKind = c => {
        const set = c.set_code && setByCode.get(c.set_code);
        return set ? SET_TYPES[set.card_set_type_code] : null;
    };
    const fullText = c => {
        const back = c.back_link && byCode.get(c.back_link);
        return [c.text, c.back_text, back && back.text].filter(Boolean).join('\n')
            .toLowerCase().replace(/<[^>]*>/g, '');
    };

    const aspectNames = new Map(factions
        .filter(f => !NON_ASPECT_FACTIONS.includes(f.code))
        .map(f => [f.code, f.name]));

    // ---- pick cards for each list ----

    // Villains and leaders: the earliest stage of each name in each villain set.
    const villainPicks = new Map();
    for (const c of cards) {
        if (CARD_TYPES[c.type_code] !== 'villains' || setKind(c) !== 'villain') continue;
        const key = `${c.set_code}|${c.name}`;
        const prev = villainPicks.get(key);
        if (!prev || stageRank(c.stage) < stageRank(prev.stage)) villainPicks.set(key, c);
    }

    function wanted(card, list) {
        if (!card.name || overrides.exclude.includes(card.code) || overrides.exclude.includes(card.name)) return false;
        if (list === 'villains') return villainPicks.get(`${card.set_code}|${card.name}`) === card;
        if (list === 'main_schemes') return !isBack(card);
        if (list === 'countercards') {
            const text = fullText(card);
            return !isBack(card) && (usesCounters(card, text) || holdsThreat(text) || card.code in overrides.cards);
        }
        // Back faces count too (Archangel, flipped side schemes) if they have values of their own;
        // identical copies merge later.
        if (isBack(card)) return list === 'side_schemes' ? card.base_threat != null : card.health != null;
        return true;
    }

    function entryFor(card, list) {
        let entry;
        if (list === 'heroes') {
            entry = { name: card.name, type: 'hero', hitpoints: card.health };
        } else if (list === 'villains') {
            entry = { name: card.type_code === 'leader' ? `${card.name} (Leader)` : card.name, type: 'villain', hitpoints: card.health };
            if (card.health_per_hero) entry.hitpointsper = true;
        } else if (list === 'main_schemes') {
            // The A side is setup; the B side has the threat values and is what sits on the table.
            const back = card.back_link && byCode.get(card.back_link);
            const side = back && back.type_code === 'main_scheme' ? back : card;
            entry = { name: side.name, type: 'main_scheme', threat: side.threat || 0, basethreat: side.base_threat || 0 };
            if (side.threat_fixed) entry.threatfixed = true;
            if (side.base_threat_fixed) entry.basethreatfixed = true;
        } else if (list === 'side_schemes') {
            entry = { name: card.name, type: 'side_scheme', basethreat: card.base_threat || 0 };
            if (card.base_threat_fixed) entry.basethreatfixed = true;
            if (card.type_code === 'player_side_scheme') entry.isPlayerSideScheme = true;
        } else if (list === 'minions') {
            entry = { name: card.name, type: 'minion', hitpoints: card.health };
            if (card.health_per_hero) entry.hitpointsper = true;
        } else if (list === 'allies') {
            entry = { name: card.name, type: 'ally', hitpoints: card.health };
        } else {
            entry = { name: cleanName(card.name), type: 'counter', counter: startingCounters(fullText(card)) };
            if (holdsThreat(fullText(card))) entry.isThreat = true;
            return entry;
        }
        entry.name = cleanName(entry.name);
        if (usesCounters(card, fullText(card))) {
            entry.useCounter = true;
            entry.counter = startingCounters(fullText(card));
        }
        if (list !== 'main_schemes' && list !== 'side_schemes') {
            // a villain gaining steady at stage II still needs room for two cards
            const stages = list === 'villains'
                ? cards.filter(c => c.set_code === card.set_code && c.name === card.name && CARD_TYPES[c.type_code] === 'villains')
                : [card];
            Object.assign(entry, statusLimits(stages.map(fullText).join('\n')));
        }
        return entry;
    }

    const picked = Object.fromEntries(LISTS.map(l => [l, []]));
    for (const card of cards) {
        const list = CARD_TYPES[card.type_code];
        if (list && wanted(card, list)) picked[list].push({ card, entry: entryFor(card, list), owners: [] });
    }

    // ---- heroes and villains first: their final names are what other cards belong to ----

    const final = {};
    final.heroes = finalize(picked.heroes);

    const heroOwner = new Map();    // hero set code -> hero name
    for (const item of final.heroes) {
        for (const c of item.cards) if (!heroOwner.has(c.set_code)) heroOwner.set(c.set_code, item.entry.name);
    }

    const heroNames = new Set(final.heroes.map(i => i.entry.name));
    for (const item of picked.villains) {
        if (heroNames.has(item.entry.name)) item.entry.name += ' (Villain)';
    }
    final.villains = finalize(picked.villains);

    const villainSetOwners = new Map();    // villain set code -> villain names
    for (const item of final.villains) {
        for (const c of item.cards) {
            const names = villainSetOwners.get(c.set_code) || [];
            if (!names.includes(item.entry.name)) names.push(item.entry.name);
            villainSetOwners.set(c.set_code, names);
        }
    }

    // Module names, made unique (e.g. two sets both called "Campaign").
    const moduleSets = sets.filter(s => {
        const kind = SET_TYPES[s.card_set_type_code];
        return kind === 'module' || (kind === 'villain' && !villainSetOwners.has(s.code));
    });
    const takenNames = new Set([...heroNames, ...final.villains.map(i => i.entry.name)]);
    const moduleNameCount = countBy(moduleSets.map(s => s.name));
    const moduleNames = new Map();
    for (const s of moduleSets) {
        let name = s.name;
        if (moduleNameCount[name] > 1 || takenNames.has(name)) {
            const firstCard = cards.find(c => c.set_code === s.code);
            const pack = firstCard && packByCode.get(firstCard.pack_code);
            name = `${name} (${pack ? pack.name : s.code})`;
        }
        moduleNames.set(s.code, name);
    }

    function ownersOf(card) {
        if (card.faction_code && aspectNames.has(card.faction_code)) {
            return [{ type: 'aspect', name: aspectNames.get(card.faction_code) }];
        }
        const set = card.set_code && setByCode.get(card.set_code);
        if (!set) return [];
        if (moduleNames.has(set.code)) {
            const aspects = Object.keys(ASPECT_ENCOUNTER_SETS)
                .filter(f => ASPECT_ENCOUNTER_SETS[f].includes(set.code))
                .map(f => ({ type: 'aspect', name: aspectNames.get(f) }));
            return [{ type: 'module', name: moduleNames.get(set.code) }, ...aspects];
        }
        const kind = SET_TYPES[set.card_set_type_code];
        if (kind === 'hero') {
            const name = heroOwner.get(set.parent_code || set.code.replace(/_nemesis$/, ''));
            return name ? [{ type: 'hero', name }] : [];
        }
        if (kind === 'villain') {
            return (villainSetOwners.get(set.code) || []).map(name => ({ type: 'villain', name }));
        }
        return [];
    }

    for (const list of LISTS.filter(l => !final[l])) {
        for (const item of picked[list]) item.owners = ownersOf(item.card);
        final[list] = finalize(picked[list]);
    }

    // Merges copies of the same card (same entry) from different sets, then makes names unique.
    function finalize(items) {
        const merged = new Map();
        for (const item of items) {
            const key = JSON.stringify(item.entry);
            const m = merged.get(key);
            if (m) {
                m.cards.push(item.card);
                for (const o of item.owners) if (!m.owners.some(x => x.name === o.name)) m.owners.push(o);
            } else {
                merged.set(key, { entry: item.entry, cards: [item.card], owners: [...item.owners] });
            }
        }
        const result = [...merged.values()];
        disambiguate(result);
        return result;
    }

    // The oldest card keeps the plain name; later ones get the first label that tells them apart.
    function disambiguate(items) {
        const alterEgo = c => {
            const back = c.back_link && byCode.get(c.back_link);
            return back && back.type_code === 'alter_ego' ? back.name : null;
        };
        const mode = c => (/^(standard|expert) mode only/i.exec((c.text || '').replace(/<[^>]*>/g, '')) || [])[1];
        const labels = [
            i => i.cards[0].subname && cleanName(i.cards[0].subname),
            i => alterEgo(i.cards[0]),
            i => mode(i.cards[0]),
            i => i.owners[0] && !i.owners[0].name.includes('(') && i.owners[0].name,
            i => (setByCode.get(i.cards[0].set_code) || {}).name,
            i => (packByCode.get(i.cards[0].pack_code) || {}).name,
            i => (i.cards[0].code.match(/[a-z]$/) || [''])[0].toUpperCase(),
            i => i.cards[0].code
        ];
        for (const group of Object.values(groupBy(items, i => i.entry.name))) {
            if (group.length < 2) continue;
            for (const label of labels) {
                const values = group.map(label);
                if (values.slice(1).every(Boolean) && new Set(values).size === values.length) {
                    group.slice(1).forEach((i, n) => { i.entry.name = `${i.entry.name} (${values[n + 1]})`; });
                    break;
                }
            }
        }
    }

    // ---- output shape ----

    const result = {};
    const applied = new Set();
    for (const list of LISTS) {
        result[list] = final[list]
            .map(({ entry, owners, cards: copies }) => {
                const out = { name: entry.name, code: copies[0].code, isSelected: false, ...entry };
                if (owners.length && list !== 'allies') {
                    out.belongstotype = ['module', 'aspect', 'villain', 'hero'].find(t => owners.some(o => o.type === t));
                    out.belongsto = owners.map(o => o.name);
                }
                return out;
            })
            .filter(e => !overrides.exclude.includes(e.code) && !overrides.exclude.includes(e.name));

        for (const e of result[list]) {
            const key = e.code in overrides.cards ? e.code : e.name;
            if (!(key in overrides.cards)) continue;
            applied.add(key);
            Object.assign(e, overrides.cards[key]);
        }
        result[list].sort((a, b) => a.name.localeCompare(b.name));
    }
    const unusedOverrides = [
        ...Object.keys(overrides.cards).filter(k => !applied.has(k)),
        ...overrides.exclude.filter(k => !cards.some(c => c.code === k || c.name === k) && !LISTS.some(l => final[l].some(i => i.entry.name === k)))
    ];

    result.modules = [...new Set(moduleNames.values())].sort((a, b) => a.localeCompare(b)).map(name => ({ name }));
    result.aspects = [...aspectNames.values()].filter(n => n !== 'Basic').map(name => ({ name }));

    return { data: result, unusedOverrides };
}

function countBy(values) {
    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    return counts;
}

function groupBy(items, keyFn) {
    const groups = {};
    for (const i of items) (groups[keyFn(i)] = groups[keyFn(i)] || []).push(i);
    return groups;
}

// ---------------------------------------------------------------------------
// Checks and reports
// ---------------------------------------------------------------------------

// Problems that would break the app's lists or filters. Any of these stops the build.
function validate(data) {
    const errors = [];
    for (const list of LISTS) {
        for (const [name, n] of Object.entries(countBy(data[list].map(e => e.name)))) {
            if (n > 1) errors.push(`${list}: "${name}" appears ${n} times`);
        }
        for (const e of data[list]) {
            if ('hitpoints' in e && !(Number.isInteger(e.hitpoints) && e.hitpoints >= 0)) {
                errors.push(`${list}: "${e.name}" (${e.code}) has no usable hit points (${e.hitpoints}) - fix it in overrides.js`);
            }
        }
    }
    const characters = [...data.heroes, ...data.villains].map(e => e.name);
    for (const [name, n] of Object.entries(countBy(characters))) {
        if (n > 1) errors.push(`"${name}" is both a hero and a villain; filters would mix their cards`);
    }
    const owners = new Set([...characters, ...data.modules.map(m => m.name), ...data.aspects.map(a => a.name), 'Basic']);
    for (const list of LISTS) {
        for (const e of data[list]) {
            for (const o of e.belongsto || []) {
                if (!owners.has(o)) errors.push(`${list}: "${e.name}" belongs to unknown "${o}"`);
            }
        }
    }
    return errors;
}

// Things in the card data this script hasn't been taught about.
function findUnknowns(source) {
    const notes = [];
    const sample = list => list.slice(0, 3).map(c => `${c.name} (${c.pack_code})`).join(', ');
    const real = source.rawCards.filter(c => !c.duplicate_of);

    const byType = groupBy(real.filter(c => !(c.type_code in CARD_TYPES)), c => c.type_code);
    for (const [type, list] of Object.entries(byType)) {
        notes.push(`New card type "${type}": ${list.length} cards, e.g. ${sample(list)}. Add it to CARD_TYPES.`);
    }

    for (const s of source.sets.filter(s => !(s.card_set_type_code in SET_TYPES))) {
        notes.push(`New set type "${s.card_set_type_code}" (set "${s.name}"). Add it to SET_TYPES.`);
    }

    const fields = groupBy(real.flatMap(c => Object.keys(c).filter(k => !KNOWN_FIELDS.has(k)).map(k => ({ k, c }))), x => x.k);
    for (const [field, list] of Object.entries(fields)) {
        notes.push(`New card field "${field}": ${list.length} cards, e.g. ${sample(list.map(x => x.c))}. Add it to KNOWN_FIELDS once handled.`);
    }

    const knownFactions = new Set([...NON_ASPECT_FACTIONS, ...source.factions.map(f => f.code)]);
    for (const [f, list] of Object.entries(groupBy(real.filter(c => c.faction_code && !knownFactions.has(c.faction_code)), c => c.faction_code))) {
        notes.push(`Cards use faction "${f}" which factions.json doesn't list: ${sample(list)}.`);
    }

    const statusWords = groupBy(real.flatMap(c => [...(c.text || '').matchAll(/\b(\w+ed|tough) status card/gi)]
        .map(m => ({ w: m[1].toLowerCase(), c }))).filter(x => !KNOWN_STATUSES.includes(x.w)), x => x.w);
    for (const [w, list] of Object.entries(statusWords)) {
        notes.push(`Possible new status "${w}": ${sample(list.map(x => x.c))}. The app tracks ${KNOWN_STATUSES.join('/')}.`);
    }

    const stacking = real.filter(c => {
        const text = (c.text || '').toLowerCase().replace(/<[^>]*>/g, '');
        return /can have [^.]*status cards?/.test(text) && !STACKING_TOUGH.test(text);
    });
    if (stacking.length) {
        notes.push(`New wording for holding several status cards: ${sample(stacking)}. Teach statusLimits() about it.`);
    }

    return notes;
}

function loadPrevious(file) {
    if (!fs.existsSync(file)) return null;
    const src = fs.readFileSync(file, 'utf8');
    const ctx = {};
    new Function(src.replace(/^let /gm, 'var ') + `;this.lists = {${LISTS.join(',')}, modules};`).call(ctx);
    return ctx.lists;
}

function diff(previous, data) {
    const lines = [];
    for (const list of [...LISTS, 'modules']) {
        const before = new Map((previous && previous[list] || []).map(e => [e.name, e]));
        const after = new Map(data[list].map(e => [e.name, e]));
        const added = [...after.keys()].filter(n => !before.has(n));
        const removed = [...before.keys()].filter(n => !after.has(n));
        const changed = [];
        for (const [name, e] of after) {
            const old = before.get(name);
            if (!old) continue;
            const fields = Object.keys({ ...old, ...e })
                .filter(k => k !== 'code' && JSON.stringify(old[k]) !== JSON.stringify(e[k]))
                .map(k => `${k}: ${JSON.stringify(old[k])} -> ${JSON.stringify(e[k])}`);
            if (fields.length) changed.push(`${name} (${fields.join('; ')})`);
        }
        if (!added.length && !removed.length && !changed.length) continue;
        lines.push(`\n${list}:`);
        if (added.length) lines.push(`  + added (${added.length}): ${added.join(', ')}`);
        if (removed.length) lines.push(`  - removed (${removed.length}): ${removed.join(', ')}`);
        for (const c of changed) lines.push(`  ~ ${c}`);
    }
    return lines;
}

function render(data, source) {
    const rows = list => '[\n' + list.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n]';
    const stamp = source.commit ? `marvelsdb-json-data @ ${source.commit} (${source.date})` : 'marvelsdb-json-data';
    return `// Generated by converter/build.js from ${stamp}.\n` +
        `// Don't edit by hand: rerun the script, and put corrections in converter/overrides.js.\n\n` +
        `let carddatadate = ${JSON.stringify(source.date || '')};\n\n` +
        [...LISTS, 'modules', 'aspects'].map(l => `let ${l} = ${rows(data[l])};\n`).join('\n');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const source = loadSource(syncSource(args));
    const overrides = require('./overrides.js');
    const { data, unusedOverrides } = build(source, overrides);

    console.log(`\nCard data: ${source.commit || 'local'} ${source.date || ''}, ${source.packs.length} packs`);
    for (const l of [...LISTS, 'modules']) console.log(`  ${l.padEnd(13)} ${data[l].length}`);

    const changes = diff(loadPrevious(OUTPUT_FILE), data);
    console.log('\n=== Changes to data.js ===');
    console.log(changes.length ? changes.join('\n') : '\nnone');

    const notes = findUnknowns(source);
    for (const k of unusedOverrides) notes.push(`overrides.js entry "${k}" didn't match any card.`);
    console.log('\n=== Needs a decision ===');
    console.log(notes.length ? notes.map(n => `! ${n}`).join('\n') : 'nothing new');

    const errors = validate(data);
    if (errors.length) {
        console.error('\n=== Errors (data.js not written) ===\n' + errors.map(e => `x ${e}`).join('\n'));
        process.exit(1);
    }

    if (args.dryRun) {
        console.log('\nDry run: data.js not written.');
    } else {
        fs.writeFileSync(OUTPUT_FILE, render(data, source), 'utf8');
        console.log(`\nWrote ${path.relative(process.cwd(), OUTPUT_FILE)}`);
    }
}

if (require.main === module) {
    main();
}

module.exports = { build, loadSource, validate, findUnknowns, stageRank, usesCounters };
