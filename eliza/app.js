// Eliza v2: Brass: Birmingham opponents that play by the same rules as you.
// Vue 2 (global from CDN) drives the screens; all rules live in engine/.
// Notes: v2/notes/00-PLAN.md

import {
    IND, IND_NAMES, ERA, LOCATIONS, LINKS, LINKS_AT, SPACES, SPACES_AT, CARDS, SELLABLE, tileDef, ROUNDS_PER_ERA, deckFor,
    PLAYER_COLORS, WILD_LOC, WILD_IND,
} from './engine/data.js';
import {
    newGame, doAction, finishAction, currentPlayer, incomeLevel, nextLevel, buildSpacesAt, planBuild,
    planNetwork, planDevelop, canDevelop, sellTargets, saleBeerOptions, planSale, canLoan, canScout,
    coalSources, coalPlanValid, coalCost, ironCost, networkLocs, hasTilesOnBoard, linkAllowed, components,
    ranking, cardAllowsBuild, beerSources, distances, planCoal, topSpaceOfLevel,
} from './engine/core.js';
import { generateActions, sellableTiles } from './engine/moves.js';
import { chooseTurn, PERSONA_INFO } from './engine/ai.js';
import { describeEvent, history, tileName, spaceName } from './engine/describe.js';
import { IND_ABBR } from './ui/map.js';

const SAVE_KEY = 'elizagamestate2';
const V1_KEY = 'elizagamestate';
const APP_VERSION = '2.0';
const AI_NAMES = ['Eliza', 'Eleanor', 'Isambard'];
const MAX_UNDO = 30;

const copy = x => JSON.parse(JSON.stringify(x));
const freeze = x => Object.freeze(x);

function defaultSeats() {
    return [
        { kind: 'human', name: 'You', color: 'purple' },
        { kind: 'ai', name: 'Eliza', color: 'gray', persona: 'balanced' },
    ];
}

/* global Vue, LZString */
const app = new Vue({
    el: '#eliza',
    data: {
        appVersion: APP_VERSION,
        personas: PERSONA_INFO,
        colors: PLAYER_COLORS,
        // setup
        setup: { mode: 'physical', seats: defaultSeats() },
        // game
        g: null,            // engine state (frozen; replaced after every change)
        screen: 'start',    // start | setup | turn | handoff | roundEnd | eraEnd | final
        draft: null,        // the human action being entered
        aiTurn: null,       // { p, actions: [{ title, lines }] }
        endLines: [],       // lines for round/era end screens
        undoStack: [],
        thinking: false,
        showBoardState: false,
        showHistory: false,
        error: null,
        message: null,
        hasV1Game: false,
        isGameStateOpen: false,
        gameState: '',
        mapSel: null,
        theme: document.documentElement.getAttribute('data-theme') || 'light',
        sheet: null,        // phone mode: open information sheet (ledger | hand | board | mat)
        bigMap: false,
        mapKey: IND_ABBR.map((abbr, i) => ({ abbr, name: IND_NAMES[i] })),
    },
    watch: {
        phoneTabs(tabs) { if (this.sheet && !tabs.some(x => x.k === this.sheet)) this.sheet = null; },
    },
    mounted() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                const d = JSON.parse(LZString.decompress(saved));
                this.g = freeze(d.g);
                this.screen = d.screen;
                this.aiTurn = d.aiTurn || null;
                this.endLines = d.endLines || [];
                this.undoStack = d.undoStack || [];
                this.setup = d.setup || this.setup;
                if (this.screen === 'turn' && this.g && !this.g.over && !this.isHumanTurn && !this.aiTurn) this.runAI();
            }
            const v1 = localStorage.getItem(V1_KEY);
            if (v1 && !this.g) {
                const d = JSON.parse(LZString.decompress(v1));
                this.hasV1Game = !!(d && d.gameHasStarted);
            }
        } catch (e) {
            this.error = 'Could not load the saved game: ' + e.message;
        }
    },
    computed: {
        gameHasStarted() { return !!this.g; },
        nHumans() { return this.setup.seats.filter(s => s.kind === 'human').length; },
        nAIs() { return this.setup.seats.filter(s => s.kind === 'ai').length; },
        cur() { return this.g ? currentPlayer(this.g) : null; },
        curPlayer() { return this.g ? this.g.players[this.cur] : null; },
        isHumanTurn() { return this.g && this.curPlayer.kind === 'human'; },
        isPhone() { return this.g && this.g.mode === 'phone'; },
        actionIndex() {
            // 0 = first action of the turn, 1 = second
            if (!this.g) return 0;
            const total = this.g.firstTurnOfEra ? 1 : 2;
            return total - this.g.acts;
        },
        playersInOrder() { return this.g ? this.g.order.map(p => this.g.players[p]) : []; },
        eraName() { return this.g && this.g.era === ERA.Rail ? 'Rail' : 'Canal'; },
        historyEntries() { return this.g ? history(this.g) : []; },
        /** Phone mode footer tabs. Hand and mat only on the current human's own turn (pass-and-play privacy). */
        phoneTabs() {
            if (!this.isPhone || this.error || this.screen === 'setup' || this.screen === 'handoff') return [];
            const tabs = [{ k: 'ledger', label: 'Ledger' }];
            const mine = this.screen === 'turn' && this.isHumanTurn && !this.aiTurn;
            if (mine) tabs.push({ k: 'hand', label: 'Hand', count: (this.curPlayer.hand || []).length });
            tabs.push({ k: 'board', label: 'Board' });
            if (mine) tabs.push({ k: 'mat', label: 'Mat' });
            return tabs;
        },
        sheetTitle() {
            return { ledger: 'Ledger', hand: this.possessive(this.cur) + ' hand', board: 'Board', mat: this.possessive(this.cur) + ' player mat' }[this.sheet] || '';
        },
        showNext() {
            const s = this.screen;
            return s === 'roundEnd' || s === 'eraEnd' || s === 'handoff' || (s === 'turn' && !!this.aiTurn)
                || (s === 'turn' && !!this.draft && this.draft.stage === 'confirm' && this.draft.ok);
        },
        aiShare() { return this.g ? 2 * this.g.rounds : 2 * ROUNDS_PER_ERA[this.setup.seats.length]; },
    },
    methods: {
        // ------------------------------------------------------------------ helpers for templates
        playerName(p) { return this.g.players[p].name; },
        possessive(p) { const n = this.g.players[p].name; return n === 'You' ? 'Your' : n + "'s"; },
        incomeOf(p) { return incomeLevel(this.g.players[p].inc); },
        colorClass(p) { return 'player-icon-' + (this.g.players[p].color || 'gray'); },
        tileName, spaceName,
        locName(id) { return LOCATIONS[id].name; },
        money(n) { return '£' + n; },
        merchantText(m) {
            if (!m.accepts.length) return 'Blank merchant (buys nothing)';
            if (m.accepts.length === 3) return 'Buys Manufactured Goods, Cotton and Pottery';
            return 'Buys ' + m.accepts.map(i => IND_NAMES[i]).join(', ');
        },

        // ------------------------------------------------------------------ setup
        addSeat(kind) {
            const seats = this.setup.seats;
            if (seats.length >= 4) return;
            if (kind === 'ai' && this.nAIs >= 2) return; // 3rd AI planned for later
            if (kind === 'human' && this.nHumans >= 3) return;
            const used = seats.map(s => s.color);
            const color = PLAYER_COLORS.find(c => !used.includes(c));
            if (kind === 'ai') seats.push({ kind, name: AI_NAMES.find(n => !seats.some(s => s.name === n)), color, persona: 'balanced' });
            else seats.push({ kind, name: 'Player ' + (this.nHumans + 1), color });
        },
        removeSeat(i) {
            const s = this.setup.seats;
            if (s.length <= 2) return;
            const seat = s[i];
            if (seat.kind === 'ai' && this.nAIs <= 1) return;
            if (seat.kind === 'human' && this.nHumans <= 1) return;
            s.splice(i, 1);
        },
        setSeatColor(i, color) {
            const other = this.setup.seats.findIndex(s => s.color === color);
            if (other >= 0) this.setup.seats[other].color = this.setup.seats[i].color;
            this.setup.seats[i].color = color;
        },
        startGame() {
            const seats = this.setup.seats.map(s => ({ ...s, name: (s.name || '').trim() || (s.kind === 'ai' ? 'AI' : 'Player') }));
            const g = newGame({ players: seats, mode: this.setup.mode });
            this.g = freeze(g);
            this.screen = 'setup';
            this.undoStack = [];
            this.save();
        },
        beginPlay() {
            this.screen = 'turn';
            this.afterChange();
        },
        newGame() {
            if (!confirm('Are you sure you want to start a NEW GAME?')) return;
            this.g = null; this.screen = 'start'; this.draft = null; this.aiTurn = null; this.undoStack = [];
            this.showBoardState = false; this.showHistory = false; this.error = null;
            this.setup = { mode: 'physical', seats: defaultSeats() };
            localStorage.removeItem(SAVE_KEY);
        },

        // ------------------------------------------------------------------ flow
        /** Apply an action for the current player. Returns false (and shows why) if the engine rejects it. */
        apply(action) {
            const before = this.g;
            const s = copy(before);
            const logAt = s.log.length;
            try {
                doAction(s, action);
                finishAction(s);
            } catch (e) {
                this.message = 'That does not work: ' + e.message;
                return false;
            }
            this.pushUndo(before);
            this.g = freeze(s);
            this.collectEndLines(logAt, before);
            return true;
        },
        collectEndLines(logAt, before) {
            // round/era bookkeeping after the last action
            const ev = this.g.log.slice(logAt);
            const lastAction = ev.map(e => e.t).lastIndexOf('action');
            const tail = ev.slice(lastAction + 1).map(e => describeEvent(this.g, e)).filter(l => l && !l.startsWith('---'));
            this.endLines = tail;
            if (this.g.over) this.screen = 'final';
            else if (this.g.era !== before.era) this.screen = 'eraEnd';
            else if (this.g.round !== before.round) this.screen = 'roundEnd';
            else this.screen = 'turn';
        },
        next() {
            this.message = null;
            if (this.aiTurn) {
                if (this.thinking) return;
                // finished reading the AI's turn
                this.aiTurn = null;
                this.screen = this.pendingScreen || 'turn';
                this.pendingScreen = null;
                this.afterChange();
                return;
            }
            if (this.screen === 'roundEnd' || this.screen === 'eraEnd') { this.screen = 'turn'; this.afterChange(); return; }
            if (this.screen === 'handoff') { this.screen = 'turn'; this.save(); return; }
            if (this.screen === 'turn' && this.isHumanTurn && this.draft) this.confirmDraft();
        },
        afterChange() {
            this.draft = null;
            if (this.screen === 'turn' && this.g && !this.g.over) {
                if (!this.isHumanTurn) this.runAI();
                else if (this.isPhone && this.nHumansInGame() > 1 && this.actionIndex === 0) this.screen = 'handoff';
            }
            this.save();
            window.scrollTo(0, 0);
        },
        nHumansInGame() { return this.g.players.filter(p => p.kind === 'human').length; },
        runAI() {
            this.thinking = true;
            this.aiTurn = { p: this.cur, actions: [] };
            setTimeout(() => {
                try {
                    const before = this.g;
                    const p = currentPlayer(before);
                    const { actions } = chooseTurn(before, before.players[p].persona);
                    const s = copy(before);
                    const logAt = s.log.length;
                    const shown = [];
                    for (const a of actions) {
                        const at = s.log.length;
                        doAction(s, a);
                        const lines = s.log.slice(at).filter(e => e.t !== 'action').map(e => describeEvent(s, e)).filter(Boolean);
                        shown.push({ title: actionTitle(a), lines });
                        finishAction(s);
                    }
                    this.pushUndo(before);
                    this.g = freeze(s);
                    this.aiTurn = { p, actions: shown };
                    // where to go after the player has read the AI's turn
                    const save = this.screen;
                    this.collectEndLines(logAt, before);
                    this.pendingScreen = this.screen;
                    this.screen = save === 'turn' ? 'turn' : save;
                    this.thinking = false;
                    this.save();
                } catch (e) {
                    this.thinking = false;
                    this.error = (e && e.stack) || String(e);
                }
            }, 30);
        },

        // ------------------------------------------------------------------ undo / save
        pushUndo(state) {
            this.undoStack.push({ g: state, screen: this.screen, endLines: this.endLines });
            if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
        },
        undo() {
            if (!this.undoStack.length) return;
            if (!confirm('Are you sure you want to UNDO?\nThis takes back the last action.')) return;
            const u = this.undoStack.pop();
            this.g = freeze(u.g);
            this.screen = 'turn';
            this.endLines = u.endLines || [];
            this.aiTurn = null;
            this.draft = null;
            // if the undone action was an AI's, step back once more to the last human decision
            if (!this.isHumanTurn && this.undoStack.length) {
                const v = this.undoStack.pop();
                this.g = freeze(v.g);
            }
            this.save();
            if (!this.isHumanTurn) this.runAI();
        },
        save() {
            if (!this.g) return;
            const d = { v: 2, g: this.g, screen: this.screen, aiTurn: this.aiTurn, endLines: this.endLines, setup: this.setup, undoStack: this.undoStack.slice(-10) };
            try { localStorage.setItem(SAVE_KEY, LZString.compress(JSON.stringify(d))); } catch (e) { /* storage full: keep playing */ }
        },
        getGameState() {
            this.gameState = btoa(LZString.decompress(localStorage.getItem(SAVE_KEY)) || '');
            this.isGameStateOpen = true;
            return this.gameState;
        },
        copyGameState() {
            navigator.clipboard.writeText(this.gameState).then(() => alert('Save game copied to clipboard')).catch(err => alert('Error in copying text: ' + err));
        },
        toggleShowBoardState() { this.showBoardState = !this.showBoardState; this.showHistory = false; },
        toggleShowHistory() { this.showHistory = !this.showHistory; this.showBoardState = false; },

        // ------------------------------------------------------------------ human actions
        startAction(t) {
            this.message = null;
            const p = this.cur;
            const d = { t, stage: null, card: null };
            if (t === 'build') d.stage = 'industry';
            if (t === 'network' || t === 'double') { d.stage = 'from'; d.links = []; }
            if (t === 'sell') { d.stage = 'tiles'; d.tiles = sellableTiles(this.g, p).map(sp => ({ sp, selected: false })); }
            if (t === 'develop') { d.stage = 'develop'; d.picks = this.developOptions(); }
            if (t === 'loan' || t === 'scout' || t === 'pass') d.stage = 'confirm';
            this.draft = d;
            if (d.stage === 'confirm') this.prepareConfirm();
        },
        back() {
            this.message = null;
            const d = this.draft;
            if (!d) return;
            const prev = d.history && d.history.pop();
            if (prev) { Object.assign(d, prev); this.draft = { ...d }; } else this.draft = null;
        },
        go(stage, patch = {}) {
            const d = this.draft;
            const snap = copy({ ...d, history: undefined });
            d.history = (d.history || []).concat([snap]);
            Object.assign(d, patch, { stage });
            this.message = null;
            this.draft = { ...d };
        },

        // ---- build
        buildIndustries() {
            const p = this.cur, out = [];
            for (let ind = 0; ind < 6; ind++) {
                const lvl = nextLevel(this.g, p, ind);
                if (!lvl) continue;
                out.push({ ind, lvl, label: tileName(ind, lvl) });
            }
            return out;
        },
        buildSpaces() {
            const p = this.cur, d = this.draft, out = [];
            for (const loc of LOCATIONS) {
                if (loc.kind === 'merchant') continue;
                for (const sp of buildSpacesAt(this.g, p, d.ind, loc.id)) {
                    // physical mode: any card might be held; phone mode: must be possible with some card in hand
                    const ok = this.cardsForBuild(d.ind, sp).length > 0;
                    if (!ok) continue;
                    const t = this.g.spaces[sp];
                    const ok2 = !!planBuild(this.g, p, this.anyCardFor(d.ind, sp), d.ind, sp);
                    const def = tileDef(d.ind, d.lvl);
                    const g2 = t ? { ...this.g, spaces: this.g.spaces.map((x, i) => i === sp ? null : x) } : this.g;
                    const coalOk = def.coal === 0 || !!planCoal(g2, p, [loc.id], def.coal);
                    out.push({ sp, label: spaceName(sp), overbuild: !!t, victim: t ? t.o : null, affordable: ok2, blocked: ok2 ? '' : coalOk ? "can't afford" : 'no coal connection' });
                }
            }
            return out;
        },
        cardsForBuild(ind, sp) {
            const p = this.cur, hand = this.g.players[p].hand;
            if (hand === null) return [null];
            const inNet = networkLocs(this.g, p);
            const loc = SPACES[sp].loc;
            return [...new Set(hand)].filter(c => {
                if (!cardAllowsBuild(this.g, p, c, ind, loc, inNet)) return false;
                if (LOCATIONS[loc].kind === 'farm') return CARDS[c].kind === 'wildInd' || (CARDS[c].kind === 'ind' && CARDS[c].inds.includes(IND.Brewery));
                return true;
            });
        },
        anyCardFor(ind, sp) { const c = this.cardsForBuild(ind, sp); return c.length ? c[0] : null; },
        chooseIndustry(o) { this.go('space', { ind: o.ind, lvl: o.lvl }); },
        chooseSpace(o) {
            const plan = planBuild(this.g, this.cur, this.anyCardFor(this.draft.ind, o.sp), this.draft.ind, o.sp);
            if (!plan) { this.message = `You cannot build there right now (${o.blocked}).`; return; }
            this.go('resources', { sp: o.sp });
            this.draft.coalEdit = this.coalEditor([SPACES[o.sp].loc], tileDef(this.draft.ind, this.draft.lvl).coal, plan.coal, o.sp);
            this.draft.ironEdit = this.ironEditor(tileDef(this.draft.ind, this.draft.lvl).iron, plan.iron, o.sp);
            this.draft = { ...this.draft };
            if (!this.draft.coalEdit.choice && !this.draft.ironEdit.choice) this.toCardOrConfirm();
        },

        // ---- resource editors (coal: closest-first; iron: any works)
        coalEditor(locs, need, plan, excludeSp = -1) {
            const src = need > 0 ? coalSources(this.g, locs) : { src: [], market: false };
            const rows = src.src.filter(c => c.sp !== excludeSp).sort((a, b) => a.d - b.d).map(c => ({
                sp: c.sp, label: `${this.possessive(c.o)} Coal Mine in ${spaceName(c.sp)} (${c.d === 0 ? 'same location' : c.d + ' link' + (c.d > 1 ? 's' : '') + ' away'})`,
                options: range(Math.min(c.res, need)), chosen: (plan.take.find(t => t[0] === c.sp) || [0, 0])[1],
            }));
            if (src.market) rows.push({ sp: -1, label: 'Coal market', options: range(need), chosen: plan.mkt });
            // a real choice exists only if a different legal split is possible
            const choice = rows.length > 1 && need > 0;
            return { need, rows, choice, locs };
        },
        ironEditor(need, plan, excludeSp = -1) {
            const rows = [];
            if (need > 0) {
                for (let sp = 0; sp < SPACES.length; sp++) {
                    const t = this.g.spaces[sp];
                    if (t && t.ind === IND.IronWorks && t.res > 0 && sp !== excludeSp) rows.push({ sp, label: `${this.possessive(t.o)} Iron Works in ${spaceName(sp)}`, options: range(Math.min(t.res, need)), chosen: (plan.take.find(x => x[0] === sp) || [0, 0])[1] });
                }
                rows.push({ sp: -1, label: 'Iron market', options: range(need), chosen: plan.mkt });
            }
            return { need, rows, choice: rows.length > 1 };
        },
        planFromEditor(ed) {
            const take = ed.rows.filter(r => r.sp >= 0 && r.chosen > 0).map(r => [r.sp, +r.chosen]);
            const mkt = +(ed.rows.find(r => r.sp === -1) || { chosen: 0 }).chosen;
            return { take, mkt };
        },
        checkResources() {
            const d = this.draft;
            if (d.coalEdit && d.coalEdit.need > 0) {
                const plan = this.planFromEditor(d.coalEdit);
                const total = plan.mkt + plan.take.reduce((a, t) => a + t[1], 0);
                if (total !== d.coalEdit.need) { this.message = `Choose exactly ${d.coalEdit.need} coal.`; return false; }
                const g = d.sp !== undefined && this.g.spaces[d.sp] ? { ...this.g, spaces: this.g.spaces.map((t, i) => i === d.sp ? null : t) } : this.g;
                if (!coalPlanValid(g, d.coalEdit.locs, d.coalEdit.need, plan)) { this.message = 'Coal must come from the closest connected coal mine first, and from the market only when no connected mine has coal left.'; return false; }
            }
            if (d.ironEdit && d.ironEdit.need > 0) {
                const plan = this.planFromEditor(d.ironEdit);
                const total = plan.mkt + plan.take.reduce((a, t) => a + t[1], 0);
                if (total !== d.ironEdit.need) { this.message = `Choose exactly ${d.ironEdit.need} iron.`; return false; }
            }
            return true;
        },
        resourcesDone() { if (this.checkResources()) this.toCardOrConfirm(); },

        // ---- network
        networkFromOptions() {
            const p = this.cur, d = this.draft;
            const g = this.withDraftLinks();
            const inNet = networkLocs(g, p), noTiles = !hasTilesOnBoard(g, p);
            const froms = new Set();
            for (let l = 0; l < LINKS.length; l++) {
                if (!linkAllowed(g, p, l, inNet, noTiles)) continue;
                for (const loc of LINKS[l].locs) if (inNet[loc] || noTiles) froms.add(loc);
            }
            return [...froms].sort((a, b) => LOCATIONS[a].name.localeCompare(LOCATIONS[b].name)).map(id => ({ id, label: LOCATIONS[id].name }));
        },
        networkToOptions() {
            const p = this.cur, d = this.draft, g = this.withDraftLinks();
            const inNet = networkLocs(g, p), noTiles = !hasTilesOnBoard(g, p);
            const out = [];
            for (const l of LINKS_AT[d.from]) {
                if (!linkAllowed(g, p, l, inNet, noTiles)) continue;
                const others = LINKS[l].locs.filter(x => x !== d.from);
                out.push({ link: l, label: others.map(x => LOCATIONS[x].name).join(' and ') });
            }
            return out;
        },
        withDraftLinks() {
            const d = this.draft;
            if (!d || !d.links || !d.links.length) return this.g;
            const links = this.g.links.slice();
            for (const l of d.links) links[l] = this.cur;
            return { ...this.g, links };
        },
        chooseFrom(id) { this.go('to', { from: id }); },
        chooseTo(o) {
            const d = this.draft;
            const links = d.links.concat([o.link]);
            if (d.t === 'double' && links.length < 2) { this.go('from', { links }); return; }
            const plan = planNetwork(this.g, this.cur, this.anyCard(), links);
            if (!plan) { this.message = d.t === 'double' ? 'You cannot build that pair (money, coal, or beer for the second link).' : 'You cannot build that link (money or coal).'; return; }
            this.go('netres', { links });
            this.draft.netPlan = plan;
            if (this.g.era === ERA.Rail) {
                // coal per link, editable when there is a real choice
                this.draft.coalEdits = links.map((l, i) => {
                    const g = this.withLinks(links.slice(0, i + 1));
                    const ed = this.coalEditor(LINKS[l].locs, 1, plan.coal[i]);
                    ed.g = null;
                    return ed;
                });
            } else this.draft.coalEdits = [];
            if (links.length === 2) this.draft.beerEdit = this.doubleBeerEditor(links, plan.beer);
            this.draft = { ...this.draft };
            const anyChoice = this.draft.coalEdits.some(e => e.choice) || (this.draft.beerEdit && this.draft.beerEdit.rows.length > 1);
            if (!anyChoice) this.toCardOrConfirm();
        },
        withLinks(links) { const l = this.g.links.slice(); for (const x of links) l[x] = this.cur; return { ...this.g, links: l }; },
        doubleBeerEditor(links, chosen) {
            const g = this.withLinks(links);
            const { src } = beerSources(g, this.cur, LINKS[links[1]].locs, -1);
            return { rows: src.map(b => ({ sp: b.sp, label: `${this.possessive(b.o)} Brewery in ${spaceName(b.sp)}` })), chosen };
        },
        netResourcesDone() {
            const d = this.draft;
            for (const ed of d.coalEdits) {
                const plan = this.planFromEditor(ed);
                if (plan.mkt + plan.take.reduce((a, t) => a + t[1], 0) !== 1) { this.message = 'Each rail link needs exactly 1 coal.'; return; }
            }
            this.toCardOrConfirm();
        },

        // ---- sell
        sellTilesDone() {
            const d = this.draft;
            const chosen = d.tiles.filter(t => t.selected).map(t => t.sp);
            if (!chosen.length) { this.message = 'Choose at least one industry to sell.'; return; }
            // default plan per tile, step by step on a working copy
            const w = copy(this.g); w.log = null;
            const sales = [];
            for (const sp of chosen) {
                const targets = sellTargets(w, sp).sort((a, b) => w.merch[b].beer - w.merch[a].beer);
                let sale = null;
                for (const mi of targets) { sale = planSale(w, this.cur, sp, mi); if (sale) break; }
                const need = tileDef(w.spaces[sp].ind, w.spaces[sp].lvl).beer;
                sales.push({ sp, mi: sale ? sale.mi : targets[0], need, beer: sale ? sale.beer : [] });
                if (sale) for (const b of sale.beer) { if (b.m !== undefined) w.merch[b.m].beer--; else w.spaces[b.sp].res--; }
            }
            this.go('selldetail', { sales });
        },
        merchantOptions(sp) {
            return sellTargets(this.g, sp).map(mi => {
                const m = this.g.merch[mi];
                return { mi, label: `${LOCATIONS[m.loc].name}${m.beer ? ' (merchant beer available)' : ''}` };
            });
        },
        beerOptions(sale) {
            const { src, merchBeer } = saleBeerOptions(this.g, this.cur, sale.sp, sale.mi);
            const rows = src.map(b => ({ key: 'b' + b.sp, sp: b.sp, label: `${this.possessive(b.o)} Brewery in ${spaceName(b.sp)} (${b.res} beer)` }));
            if (merchBeer) rows.push({ key: 'm' + sale.mi, m: sale.mi, label: `Merchant beer at ${LOCATIONS[this.g.merch[sale.mi].loc].name} (gives the bonus)` });
            return rows;
        },
        toggleBeer(sale, row) {
            const i = sale.beer.findIndex(b => (row.m !== undefined ? b.m === row.m : b.sp === row.sp));
            if (i >= 0) sale.beer.splice(i, 1);
            else if (sale.beer.length < sale.need) sale.beer.push(row.m !== undefined ? { m: row.m } : { sp: row.sp });
            this.draft = { ...this.draft };
        },
        beerChosen(sale, row) { return sale.beer.some(b => (row.m !== undefined ? b.m === row.m : b.sp === row.sp)); },
        sellDetailDone() {
            const d = this.draft;
            for (const s of d.sales) if (s.beer.length !== s.need) { this.message = `Each tile needs exactly the beer shown (${spaceName(s.sp)} needs ${s.need}).`; return; }
            const gl = d.sales.filter(s => s.beer.some(b => b.m !== undefined) && LOCATIONS[this.g.merch[s.mi].loc].bonus.type === 'develop').length;
            if (gl > 0) { this.go('freedev', { freeDevCount: gl, freePicks: this.developOptions() }); return; }
            this.toCardOrConfirm();
        },

        // ---- develop
        developOptions() {
            // top two removable tiles of each industry (as in v1)
            const p = this.cur, out = [];
            for (let ind = 0; ind < 6; ind++) {
                const mat = this.g.players[p].mat[ind].slice();
                const tiles = [];
                for (let k = 0; k < 2; k++) {
                    const i = mat.findIndex(c => c > 0);
                    if (i < 0 || tileDef(ind, i + 1).noDev) break;
                    tiles.push({ ind, lvl: i + 1, selected: false, label: tileName(ind, i + 1) });
                    mat[i]--;
                }
                if (tiles.length) out.push({ ind, name: IND_NAMES[ind], tiles });
            }
            return out;
        },
        pickedDevelop(groups) {
            const inds = [];
            for (const g of groups) for (const t of g.tiles) if (t.selected) inds.push(t.ind);
            return inds;
        },
        developDone() {
            const inds = this.pickedDevelop(this.draft.picks);
            if (!inds.length) { this.message = 'You must choose at least one tile to develop.'; return; }
            if (inds.length > 2) { this.message = 'You cannot choose more than 2 tiles to develop.'; return; }
            const plan = planDevelop(this.g, this.cur, this.anyCard(), inds);
            if (!plan) { this.message = 'You cannot develop those tiles (check you remove the lowest tile first, and can pay for iron).'; return; }
            this.go('devres', { inds });
            this.draft.ironEdit = this.ironEditor(inds.length, plan.iron);
            this.draft = { ...this.draft };
            if (!this.draft.ironEdit.choice) this.toCardOrConfirm();
        },
        freeDevDone() {
            const inds = this.pickedDevelop(this.draft.freePicks);
            if (inds.length > this.draft.freeDevCount) { this.message = `You may develop at most ${this.draft.freeDevCount} tile(s) for free.`; return; }
            this.draft.freeDev = inds;
            this.toCardOrConfirm();
        },

        // ---- card choice (phone mode only) and confirm
        anyCard() { const h = this.curPlayer.hand; return h === null ? null : h[0]; },
        toCardOrConfirm() {
            if (this.curPlayer.hand === null) { this.go('confirm'); this.prepareConfirm(); return; }
            this.go('card', { card: null, extra: [] });
        },
        cardOptions() {
            const d = this.draft, hand = this.curPlayer.hand;
            const list = d.t === 'build' ? this.cardsForBuild(d.ind, d.sp) : [...new Set(hand)];
            return list.map(c => ({ card: c, label: CARDS[c].name }));
        },
        chooseCard(c) {
            const d = this.draft;
            if (d.t === 'scout') {
                const h = this.curPlayer.hand.slice();
                d.chosenCards = d.chosenCards || [];
                d.chosenCards.push(c);
                if (d.chosenCards.length < 3) { this.draft = { ...d }; return; }
                d.card = d.chosenCards[0]; d.extra = d.chosenCards.slice(1);
            } else d.card = c;
            this.go('confirm');
            this.prepareConfirm();
        },
        buildAction() {
            const d = this.draft, p = this.cur;
            const card = this.curPlayer.hand === null ? null : d.card;
            switch (d.t) {
                case 'build': {
                    const def = tileDef(d.ind, d.lvl);
                    const coal = this.planFromEditor(d.coalEdit), iron = this.planFromEditor(d.ironEdit);
                    const g = this.g.spaces[d.sp] ? { ...this.g, spaces: this.g.spaces.map((t, i) => i === d.sp ? null : t) } : this.g;
                    coal.cost = coalCost(g, coal.mkt); iron.cost = ironCost(g, iron.mkt);
                    return { t: 'build', card, ind: d.ind, lvl: d.lvl, sp: d.sp, coal, iron, cost: def.cost + coal.cost + iron.cost };
                }
                case 'network': case 'double': {
                    const plan = { ...d.netPlan, card };
                    if (d.coalEdits.length) plan.coal = d.coalEdits.map(ed => this.planFromEditor(ed));
                    if (d.beerEdit) plan.beer = d.beerEdit.chosen;
                    return plan;
                }
                case 'develop': return { t: 'develop', card, inds: d.inds, iron: this.planFromEditor(d.ironEdit) };
                case 'sell': return { t: 'sell', card, sales: d.sales.map(s => ({ sp: s.sp, mi: s.mi, beer: s.beer })), freeDev: d.freeDev || [] };
                case 'loan': return { t: 'loan', card };
                case 'scout': return { t: 'scout', card, extra: d.extra || [] };
                case 'pass': return { t: 'pass', card };
            }
        },
        prepareConfirm() {
            const d = this.draft;
            if (d.t === 'loan' && !canLoan(this.g, this.cur)) { this.message = 'A loan would take your income below -10.'; }
            if (d.t === 'scout' && this.curPlayer.hand !== null && !canScout(this.g, this.cur)) { this.message = 'You cannot scout while holding a wild card (and you need 3 cards).'; }
            if (this.curPlayer.hand !== null && !d.card && d.t !== 'scout') { this.draft.stage = 'card'; this.draft = { ...this.draft }; return; }
            if (this.curPlayer.hand !== null && d.t === 'scout' && !d.card) { this.draft.stage = 'card'; this.draft = { ...this.draft }; return; }
            // preview the action's effects on a copy
            const s = copy(this.g); s.log = [];
            try {
                doAction(s, this.buildAction());
                this.draft.preview = s.log.filter(e => e.t !== 'action').map(e => describeEvent(s, e)).filter(Boolean);
                this.draft.previewMoney = s.players[this.cur].money;
                this.draft.previewIncome = incomeLevel(s.players[this.cur].inc);
                this.draft.ok = true;
            } catch (e) {
                this.draft.preview = [];
                this.draft.ok = false;
                this.message = 'That does not work: ' + e.message;
            }
            this.draft = { ...this.draft };
        },
        confirmDraft() {
            if (!this.draft || this.draft.stage !== 'confirm' || !this.draft.ok) return;
            if (this.apply(this.buildAction())) {
                this.draft = null;
                if (this.screen === 'turn' && this.isHumanTurn && this.actionIndex === 1) { this.save(); window.scrollTo(0, 0); }
                else this.afterChange();
            }
        },

        // ------------------------------------------------------------------ board state view
        boardLocations() {
            const g = this.g, out = [];
            for (const loc of LOCATIONS) {
                const tiles = [];
                if (loc.kind === 'merchant') {
                    g.merch.filter(m => m.loc === loc.id).forEach(m => tiles.push(`${this.merchantText(m)}${m.accepts.length ? ` | beer: ${m.beer}` : ''}`));
                } else {
                    for (const sp of SPACES_AT[loc.id]) {
                        const t = g.spaces[sp];
                        if (!t) continue;
                        const def = tileDef(t.ind, t.lvl);
                        const res = t.ind === IND.CoalMine ? ` | coal: ${t.res}` : t.ind === IND.IronWorks ? ` | iron: ${t.res}` : t.ind === IND.Brewery ? ` | beer: ${t.res}` : '';
                        tiles.push(`${SPACES[sp].idx + 1}: ${g.players[t.o].name} | ${tileName(t.ind, t.lvl)}${t.flip ? ' (flipped)' : ''}${res}`);
                    }
                }
                const links = LINKS_AT[loc.id].filter(l => g.links[l] >= 0).map(l => `--> ${LINKS[l].locs.filter(x => x !== loc.id).map(x => LOCATIONS[x].name).join(' and ')} (${g.players[g.links[l]].name})`);
                if (tiles.length || links.length) out.push({ id: loc.id, name: loc.name, tiles, links });
            }
            return out;
        },
        playerMatSummary(p) {
            const pl = this.g.players[p];
            return [0, 1, 2, 3, 4, 5].map(ind => {
                const lvl = nextLevel(this.g, p, ind);
                const left = pl.mat[ind].reduce((a, b) => a + b, 0);
                return `${IND_NAMES[ind]}: ${lvl ? 'next Level ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][lvl] : 'none left'} (${left} left)`;
            });
        },
        toggleTheme() {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', this.theme);
            try { localStorage.setItem('elizatheme', this.theme); } catch (e) { /* not saved; still applies */ }
        },
        toggleSheet(k) {
            this.sheet = this.sheet === k ? null : k;
            if (this.sheet) this.$nextTick(() => this.$refs.sheetTitle && this.$refs.sheetTitle.focus());
        },

        // ------------------------------------------------------------------ phone mode: decision info
        /** Ledger rows in turn order: money, income, VP, spent this round. */
        ledgerRows() {
            return this.g.order.map(p => {
                const pl = this.g.players[p];
                return { p, name: pl.name, money: pl.money, income: incomeOf(this.g, p), vp: pl.vp, spent: pl.spent, current: p === this.cur && !this.aiTurn };
            });
        },
        eraLine() {
            const left = this.g.rounds - this.g.round, cards = this.g.deck.length;
            const rounds = left === 0 ? `Last round of the ${this.eraName} era` : `${left} round${left === 1 ? '' : 's'} left in the ${this.eraName} era after this one`;
            return `${rounds} · ${cards} card${cards === 1 ? '' : 's'} in the deck`;
        },
        /** Market spaces from cheapest to dearest, each {price, full}. */
        marketPips(kind) {
            const size = kind === 'coal' ? 14 : 10, count = this.g[kind];
            return Array.from({ length: size }, (_, i) => ({ price: Math.floor(i / 2) + 1, full: i >= size - count }));
        },
        nextPrice(kind) {
            const size = kind === 'coal' ? 14 : 10, count = this.g[kind];
            return count > 0 ? Math.floor((size - count) / 2) + 1 : (kind === 'coal' ? 8 : 6);
        },
        /** One line under each action button: what it costs, or why it can't be done. */
        actionHint(t) {
            const g = this.g, p = this.cur, pl = g.players[p];
            const rail = g.era === ERA.Rail;
            switch (t) {
                case 'build': return 'Pay the tile cost, plus any coal and iron';
                case 'network': return rail ? '£5 and 1 coal per link' : '£3 per canal link';
                case 'double': return '£15, 2 coal and 1 beer from a brewery';
                case 'sell': {
                    const n = sellableTiles(g, p).length;
                    return n ? `${n} tile${n > 1 ? 's' : ''} connected to a buyer (beer still needed)` : 'Nothing is connected to a merchant that buys it';
                }
                case 'develop': return `1 iron per tile (market iron costs £${this.nextPrice('iron')})`;
                case 'loan': return canLoan(g, p) ? `+£30, income ${incomeOf(g, p)} → ${incomeLevel(topSpaceOfLevel(incomeOf(g, p) - 3))}` : 'Not allowed: income would fall below -10';
                case 'scout': return pl.hand && !canScout(g, p) ? (pl.hand.includes(WILD_LOC) || pl.hand.includes(WILD_IND) ? 'Not allowed: you already hold a wild card' : 'Needs 3 cards') : 'Discard 3 cards, take both wild cards';
                case 'pass': return 'Discard 1 card and do nothing';
            }
            return '';
        },
        /** Hand grouped by kind with counts: [{label, cards:[{name,count}]}]. */
        handGroups(p) {
            const h = this.g.players[p].hand || [];
            const groups = [['Locations', 'loc'], ['Industries', 'ind'], ['Wild', 'wild']].map(([label, k]) => ({ label, k, cards: [] }));
            const counts = new Map();
            for (const c of h) counts.set(c, (counts.get(c) || 0) + 1);
            for (const [c, n] of counts) {
                const kind = CARDS[c].kind;
                const g = groups.find(x => x.k === (kind === 'wildLoc' || kind === 'wildInd' ? 'wild' : kind));
                g.cards.push({ name: CARDS[c].name, count: n });
            }
            for (const g of groups) g.cards.sort((a, b) => a.name.localeCompare(b.name));
            return groups.filter(g => g.cards.length);
        },
        /** The next tile of each industry on a player's mat, as table rows. */
        matTable(p) {
            const pl = this.g.players[p];
            return [0, 1, 2, 3, 4, 5].map(ind => {
                const lvl = nextLevel(this.g, p, ind);
                const left = pl.mat[ind].reduce((a, b) => a + b, 0);
                if (!lvl) return { ind, name: IND_NAMES[ind], level: '', cost: '—', vp: '', inc: '', beer: 'none left', left, note: '' };
                const d = tileDef(ind, lvl);
                const cost = ['£' + d.cost, d.coal ? d.coal + ' coal' : '', d.iron ? d.iron + ' iron' : ''].filter(Boolean).join(' ');
                const notes = [];
                if (d.canalOnly) notes.push(this.g.era === ERA.Rail ? 'canal only: develop it away' : 'canal only');
                if (d.railOnly) notes.push('rail only');
                if (d.noDev) notes.push("can't develop");
                const beer = SELLABLE.includes(ind) ? (d.beer ? `sells with ${d.beer} beer` : 'sells with no beer')
                    : ind === IND.Brewery ? `makes ${this.g.era === ERA.Rail ? 2 : 1} beer` : `makes ${d.res} ${ind === IND.CoalMine ? 'coal' : 'iron'}`;
                return { ind, name: IND_NAMES[ind], level: ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][lvl], cost, vp: d.vp, inc: '+' + d.inc, beer, left, note: notes.join(', ') };
            });
        },
        networkOf(p) {
            const n = networkLocs(this.g, p);
            return LOCATIONS.filter(l => n[l.id]).map(l => l.id);
        },

        // ------------------------------------------------------------------ phone mode panels
        matRows(p) {
            const pl = this.g.players[p], out = [];
            for (let ind = 0; ind < 6; ind++) {
                const lvl = nextLevel(this.g, p, ind);
                const left = pl.mat[ind].reduce((a, b) => a + b, 0);
                if (!lvl) { out.push({ ind, name: IND_NAMES[ind], text: 'none left' }); continue; }
                const d = tileDef(ind, lvl);
                const cost = ['£' + d.cost, d.coal ? d.coal + ' coal' : '', d.iron ? d.iron + ' iron' : ''].filter(Boolean).join(' + ');
                const era = d.canalOnly ? ', canal era only' : d.railOnly ? ', rail era only' : '';
                const sells = SELLABLE.includes(ind) ? `, sells with ${d.beer} beer` : ind === IND.Brewery ? ', makes 1 beer (2 in rail)' : `, makes ${d.res} ${ind === IND.CoalMine ? 'coal' : 'iron'}`;
                out.push({ ind, name: IND_NAMES[ind], text: `Level ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][lvl]}: ${cost}${sells}; ${d.vp} VP, ${d.link} link, +${d.inc} income${era}${d.noDev ? ', cannot develop' : ''} (${left} left)` });
            }
            return out;
        },
        handCards(p) {
            const h = this.g.players[p].hand || [];
            return h.map(c => CARDS[c].name).sort();
        },
        marketText() {
            const price = (n, size, empty) => n > 0 ? Math.floor((size - n) / 2) + 1 : empty;
            return `Coal market: ${this.g.coal} cubes (next costs £${price(this.g.coal, 14, 8)}). Iron market: ${this.g.iron} cubes (next costs £${price(this.g.iron, 10, 6)}). Cards left in the draw deck: ${this.g.deck.length}.`;
        },
        selectedLocation() {
            if (this.mapSel === null) return null;
            return this.boardLocations().find(l => l.id === this.mapSel) || { id: this.mapSel, name: LOCATIONS[this.mapSel].name, tiles: ['(nothing built here yet)'], links: [] };
        },
        finalRanking() {
            return ranking(this.g).map((p, i) => ({ p, place: i + 1, ...this.g.players[p] }));
        },
    },
});

function incomeOf(g, p) { return incomeLevel(g.players[p].inc); }
function range(n) { return Array.from({ length: n + 1 }, (_, i) => i); }
function actionTitle(a) {
    return { build: 'Build', network: a.links && a.links.length === 2 ? 'Network (double)' : 'Network', develop: 'Develop', sell: 'Sell', loan: 'Loan', scout: 'Scout', pass: 'Pass' }[a.t];
}

window.elizaApp = app;
