// Pathfinder — On Mars vs the Pathfinder solo bot. Vue 3 (global build), no build step.
// Engine: engine.js (rules as a task stack). Docs: docs/*.md.
import { newGame, answer, scoreBreakdown, YOU, PF, complexOf, B } from './engine.js';
import { MarsMap } from './board.js';
import { Ic, Chip, ShuttleStrip, ShuttleBoard, LssWidget, LssBoard, OrbitView, ColonyStrip, CardsPanel, PlayerBoard, LogPanel } from './views.js';
import { PromptDock } from './prompt.js';
import * as TIP from './tips.js';
import * as D from './data.js';
import * as T from './text.js';

/* global Vue, LZString */
const { createApp, markRaw } = Vue;

export const SAVE_KEY = 'pathfinder.v1';
export const SHARE_PREFIX = 'PATHFINDER1:';
const MAX_UNDO = 40;
const clone = x => JSON.parse(JSON.stringify(x));

function loadSaved() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(LZString.decompressFromUTF16(raw));
        return data && data.st ? data : null;
    } catch (e) { console.warn('save unreadable', e); return null; }
}

const app = createApp({
    components: { Ic, Chip, MarsMap, ShuttleStrip, ShuttleBoard, LssWidget, LssBoard, OrbitView, ColonyStrip, CardsPanel, PlayerBoard, LogPanel, PromptDock },
    data() {
        return {
            st: null,
            undo: [],
            view: 'colony',
            sheet: null,          // me | pf | lss | cards | log | shuttle | menu
            side: 'me',           // desktop right-column tab
            inspect: null,        // hex id
            card: null,           // { k, id }
            tip: null,            // { ic, t, v, d } from a v-tip element
            setup: { difficulty: 'rookie', length: 'short', firstGame: false },
            share: '', copied: false, confirmNew: false, error: null,
            w: window.innerWidth,
        };
    },
    computed: {
        wide() { return this.w >= 1100; },
        mid() { return this.w >= 760 && this.w < 1100; },
        prompt() { return this.st?.prompt || null; },
        scores() { return this.st ? [scoreBreakdown(this.st, YOU).total, scoreBreakdown(this.st, PF).total] : [0, 0]; },
        missionsLeft() { return this.st ? this.st.remaining : 3; },
        isHexPrompt() { return this.prompt?.kind === 'hex'; },
        diffInfo() {
            return {
                rookie: 'No modifiers',
                chief: 'Builds when it lands on Mars',
                legend: 'Also picks the building that scores most',
            };
        },
        inspectInfo() {
            if (!this.inspect || !this.st) return null;
            const h = this.inspect, x = this.st.hex[h], b = x.b;
            const out = { h, lines: [] };
            if (b) {
                const cx = complexOf(this.st, h).length;
                out.lines.push({ ic: T.TYPE_IC[b.type], txt: `${D.BUILD_NAMES[b.type]}${b.type === 'shelter' ? (b.o === YOU ? ' (yours)' : ' (Pathfinder)') : ''}${cx > 1 ? ` · complex ${cx}` : ''}` });
                if (b.adv) out.lines.push({ ic: 'adv', txt: `${D.bp(b.adv.bp).name} (${b.adv.o === YOU ? 'yours' : 'Pathfinder'})`, c: b.adv.o === YOU ? 'var(--c-you)' : 'var(--c-pf)' });
                if (b.col !== null && b.col !== undefined) out.lines.push({ ic: 'colonist', txt: `Miner (${b.col === YOU ? 'yours' : 'Pathfinder'})` });
            }
            if (x.crystal) out.lines.push({ ic: 'crystal', txt: 'Crystal' });
            if (x.disc) { const d = D.disc(x.disc); out.lines.push({ ic: 'discovery', txt: d.k === 'gain' ? `Discovery: +${d.n} ${d.g}` : d.k === 'build' ? `Discovery: build ${D.BUILD_NAMES[d.b]}` : `Discovery: ${T.DISC[d.k]}` }); }
            if (x.res) out.lines.push({ ic: 'research', txt: `Research ${x.res[0]}: develop ×2 free` });
            this.st.bots.filter(bt => bt.h === h).forEach(bt => out.lines.push({ ic: 'bot', txt: bt.o === YOU ? 'Your bot' : 'Pathfinder bot', c: bt.o === YOU ? 'var(--c-you)' : 'var(--c-pf)' }));
            if (this.st.rover === h) out.lines.push({ ic: 'rover', txt: 'Your rover', c: 'var(--c-you)' });
            if (!out.lines.length) out.lines.push({ ic: 'mars', txt: 'Empty' });
            return out;
        },
        /** The explain popup: a tapped data point or dock button, else a card. */
        popInfo() {
            const t = this.tip || (this.card && TIP.card(this.card));
            return t ? { title: t.t, ic: t.ic, v: t.v, lines: [].concat(t.d || []) } : null;
        },
    },
    created() {
        const saved = loadSaved();
        if (saved) { this.st = markRaw(saved.st); this.undo = saved.undo || []; this.view = this.st.p[YOU].side; }
        window.addEventListener('resize', () => { this.w = window.innerWidth; });
        window.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.doUndo(); }
            if (e.key === 'Escape') { if (this.tip || this.card) this.closePop(); else this.closeAll(); }
            if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.tip) { e.preventDefault(); this.tip = JSON.parse(e.target.dataset.tip); }
        });
        // any v-tip element opens its explanation on click / tap
        document.addEventListener('click', e => {
            const el = e.target.closest?.('[data-tip]');
            if (!el) return;
            const ctl = e.target.closest('button, a');
            if (ctl && ctl !== el && el.contains(ctl)) return; // a control inside the data point (e.g. deliver +) does its own thing
            this.tip = JSON.parse(el.dataset.tip);
        });
        window.PATHFINDER = this; // dev handle
    },
    methods: {
        start() {
            try {
                this.st = markRaw(newGame({ ...this.setup }));
                this.undo = [];
                this.view = this.st.p[YOU].side === 'orbit' ? 'orbit' : 'colony';
                this.closeAll();
                this.save();
            } catch (e) { this.error = e.message; console.error(e); }
        },
        onAnswer(v) {
            const before = JSON.stringify(this.st);
            try {
                const next = answer(clone(this.st), v);
                this.undo.push(before);
                if (this.undo.length > MAX_UNDO) this.undo.shift();
                const sideBefore = this.st.p[YOU].side;
                this.st = markRaw(next);
                if (next.p[YOU].side !== sideBefore) this.view = next.p[YOU].side;
                if (next.prompt?.kind === 'menu' && next.prompt.main.length) this.view = next.p[YOU].side;
                if (next.prompt?.kind === 'hex') this.view = 'colony';
                if (next.prompt?.q === 'pfTurn' && next.p[PF].side === 'colony' && !this.wide) this.view = 'colony';
                this.inspect = null;
                this.save();
            } catch (e) {
                this.error = 'Something went wrong: ' + e.message + '. Use Menu → Share to send the game state.';
                console.error(e);
            }
        },
        doUndo() {
            if (!this.undo.length) return;
            this.st = markRaw(JSON.parse(this.undo.pop()));
            if (this.st.prompt?.kind === 'hex') this.view = 'colony';
            this.save();
        },
        save() {
            try { localStorage.setItem(SAVE_KEY, LZString.compressToUTF16(JSON.stringify({ st: this.st, undo: this.undo }))); }
            catch (e) {
                // storage full: drop older undo steps and retry
                this.undo = this.undo.slice(-10);
                try { localStorage.setItem(SAVE_KEY, LZString.compressToUTF16(JSON.stringify({ st: this.st, undo: this.undo }))); } catch (e2) { console.warn(e2); }
            }
        },
        newGame() { this.confirmNew = false; this.closeAll(); this.st = null; this.undo = []; localStorage.removeItem(SAVE_KEY); },
        makeShare() {
            this.share = SHARE_PREFIX + LZString.compressToBase64(JSON.stringify(this.st));
            this.copied = false;
            navigator.clipboard?.writeText(this.share).then(() => this.copied = true).catch(() => { });
        },
        /** Boards open in the side column when there is one, otherwise as a sheet. */
        openPanel(k) { if (this.wide || this.mid) { this.side = k; this.sheet = null; } else this.openSheet(k); },
        openSheet(s) { this.sheet = this.sheet === s ? null : s; this.share = ''; this.confirmNew = false; },
        closeAll() { this.sheet = null; this.card = null; this.tip = null; this.inspect = null; },
        closePop() { this.card = null; this.tip = null; },
        onInspect(h) { this.inspect = this.inspect === h ? null : h; },
        onDeliver(v) { if (this.prompt?.kind === 'menu') this.onAnswer({ a: 'deliver', c: v.c, item: v.item }); },
    },
});
/** v-tip="{ ic, t, v, d }": hover title on desktop; click, tap or Enter opens the explain popup. */
function setTip(el, { value }) {
    if (!value) { delete el.dataset.tip; el.removeAttribute('title'); el.classList.remove('tip'); return; }
    el.dataset.tip = JSON.stringify(value);
    el.title = value.v !== undefined && value.v !== '' ? `${value.t}: ${value.v}` : value.t;
    el.classList.add('tip');
    if (el.tagName !== 'BUTTON') { el.tabIndex = 0; el.setAttribute('role', 'button'); }
}
app.directive('tip', { mounted: setTip, updated: setTip });
app.config.globalProperties.TIP = TIP;
app.mount('#app');
