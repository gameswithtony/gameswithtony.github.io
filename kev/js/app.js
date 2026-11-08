// KEV: Kanban EV against the official solo Colleagues. Vue 3 (global build), no build step.
import { newGame, answer } from './engine.js';
import { Ic, Tok, PPBadge, AlleyStrip, StationsBoard, Panel, RdPanel, AsmPanel, LogPanel, DesPanel, AdmPanel, MeBoard, BotsBoard, GoalsBoard, LogList, installGlobals } from './views.js';
import { PromptDock } from './prompt.js';
import * as D from './data.js';

/* global Vue, LZString */
const { createApp, markRaw } = Vue;

/** Bump on every push (1.01, 1.02, ...) so a player can check they have the latest. Shown in the menu. */
export const VERSION = '1.02';
export const SAVE_KEY = 'kev.v1';
export const SHARE_PREFIX = 'KEV1:';
const THEME_KEY = 'kev.theme';
const MAX_UNDO = 40;
const clone = x => JSON.parse(JSON.stringify(x));
/** Which factory panel a prompt is about. */
const PANEL_FOR = { provide: 'asm', route: 'asm', design: 'des', kanbanLayout: 'log', collectWare: 'log', recycle: 'log', claimCar: 'rd', upgDesign: 'rd', upgSpace: 'rd', meet: 'adm', nextPG: 'adm', certSpace: 'adm', certStart: 'adm' };

function loadSaved() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(LZString.decompressFromUTF16(raw));
        return data && data.st ? data : null;
    } catch (e) { console.warn('save unreadable', e); return null; }
}

const app = createApp({
    components: { Ic, Tok, PPBadge, AlleyStrip, StationsBoard, Panel, RdPanel, AsmPanel, LogPanel, DesPanel, AdmPanel, MeBoard, BotsBoard, GoalsBoard, LogList, PromptDock },
    data() {
        return {
            st: null, undo: [],
            sheet: null, side: 'me',
            open: { rd: true, asm: true, log: true, des: true, adm: true },
            tip: null, shownPP: null, version: VERSION,
            setup: { color: 'blue', nice: false, planner: false, expert: false, delayed: false, special: false, charger: false, addons: false, noFire: false, diff: [] },
            share: '', copied: false, confirmNew: false, error: null,
            w: window.innerWidth,
            theme: document.documentElement.getAttribute('data-theme') || 'light',
        };
    },
    computed: {
        wide() { return this.w >= 1100; },
        mid() { return this.w >= 760 && this.w < 1100; },
        prompt() { return this.st?.prompt || null; },
        themeLabel() { return this.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; },
        popInfo() { const t = this.tip; return t ? { title: t.t, ic: t.ic, v: t.v, lines: [].concat(t.d || []) } : null; },
        diffNames() { return D.DIFFICULTY; },
    },
    watch: {
        /** The score counts to its new value instead of jumping. */
        'st.p.pp': {
            immediate: true,
            handler(to, from) {
                cancelAnimationFrame(this._ppAnim);
                if (to === undefined) { this.shownPP = null; return; }
                const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                if (from === undefined || this.shownPP === null || reduce || to === this.shownPP) { this.shownPP = to; return; }
                const start = this.shownPP, t0 = performance.now();
                const dur = Math.min(900, 250 + 40 * Math.abs(to - start));
                const step = now => {
                    const k = Math.min(1, (now - t0) / dur);
                    this.shownPP = Math.round(start + (to - start) * (1 - Math.pow(1 - k, 3)));
                    if (k < 1) this._ppAnim = requestAnimationFrame(step);
                    else this.shownPP = to;
                };
                this._ppAnim = requestAnimationFrame(step);
            },
        },
        prompt(p) {
            const k = p && PANEL_FOR[p.q]; if (k) this.open[k] = true;
            if (p && p.q === 'station' && (this.wide || this.mid)) this.side = 'bots'; // the Plan cards drive this choice
        },
    },
    created() {
        const saved = loadSaved();
        if (saved) { this.st = markRaw(saved.st); this.undo = saved.undo || []; }
        window.addEventListener('resize', () => { this.w = window.innerWidth; });
        window.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.doUndo(); }
            if (e.key === 'Escape') { if (this.tip) this.tip = null; else this.sheet = null; }
            if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.tip) { e.preventDefault(); this.tip = JSON.parse(e.target.dataset.tip); }
        });
        // any v-tip element opens its explanation on click or tap
        document.addEventListener('click', e => {
            const el = e.target.closest?.('[data-tip]');
            if (!el) return;
            const ctl = e.target.closest('button, a');
            if (ctl && ctl !== el && el.contains(ctl)) return;
            if (ctl && ctl === el && !el.classList.contains('tip-btn')) return;
            this.tip = JSON.parse(el.dataset.tip);
        });
        const h = location.hash.match(/sheet=(\w+)/); if (h && this.st) this.sheet = h[1]; // open a sheet from the URL (#sheet=me)
        window.KEV = this; // dev handle
    },
    methods: {
        start() {
            try {
                this.st = markRaw(newGame({ ...this.setup, diff: this.setup.diff.slice() }));
                this.undo = []; this.sheet = null; this.tip = null;
                this.save();
                window.scrollTo(0, 0);
            } catch (e) { this.error = e.message; console.error(e); }
        },
        onAnswer(v) {
            const before = JSON.stringify(this.st);
            try {
                const next = answer(clone(this.st), v);
                this.undo.push(before);
                if (this.undo.length > MAX_UNDO) this.undo.shift();
                this.st = markRaw(next);
                this.save();
            } catch (e) {
                this.error = 'Something went wrong: ' + e.message + '. Use Menu → Share game state to report it.';
                console.error(e);
            }
        },
        doUndo() {
            if (!this.undo.length) return;
            this.st = markRaw(JSON.parse(this.undo.pop()));
            this.save();
        },
        save() {
            const write = () => localStorage.setItem(SAVE_KEY, LZString.compressToUTF16(JSON.stringify({ st: this.st, undo: this.undo })));
            try { write(); } catch (e) { this.undo = this.undo.slice(-10); try { write(); } catch (e2) { console.warn(e2); } }
        },
        /** Back to setup, keeping the finished game's options. */
        newGame() {
            if (this.st) { const o = this.st.opts; Object.assign(this.setup, { color: o.color, nice: o.nice, planner: o.planner, expert: o.expert, delayed: o.delayed, special: o.special, charger: o.charger, addons: o.addons, noFire: !!o.noFire, diff: o.diff.slice() }); }
            this.confirmNew = false; this.sheet = null; this.tip = null; this.st = null; this.undo = []; localStorage.removeItem(SAVE_KEY); window.scrollTo(0, 0);
        },
        makeShare() {
            this.share = SHARE_PREFIX + LZString.compressToBase64(JSON.stringify(this.st));
            this.copied = false;
            navigator.clipboard?.writeText(this.share).then(() => this.copied = true).catch(() => { });
        },
        openPanel(k) { if (this.wide || this.mid) { this.side = k; this.sheet = null; } else this.openSheet(k); },
        openSheet(s) { this.sheet = this.sheet === s ? null : s; this.share = ''; this.confirmNew = false; },
        toggleTheme() {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', this.theme);
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', this.theme === 'dark' ? '#1e1e1b' : '#3f3f3a');
            try { localStorage.setItem(THEME_KEY, this.theme); } catch (e) { /* not saved; still applies */ }
        },
        toggleDiff(id) { if (id === 9 && this.setup.noFire) return; const d = this.setup.diff, i = d.indexOf(id); if (i >= 0) d.splice(i, 1); else d.push(id); },
        setNoFire() { if (this.setup.noFire) this.setup.diff = this.setup.diff.filter(id => id !== 9); },
        randomDiff() { const ids = D.DIFFICULTY.map(x => x.id).filter(id => !(this.setup.noFire && id === 9)).sort(() => Math.random() - .5); this.setup.diff = ids.slice(0, 2); },
    },
});
/** v-tip="{ ic, t, v, d }": hover title on desktop; click, tap or Enter opens the explain popup. */
function setTip(el, { value }) {
    if (!value) { delete el.dataset.tip; el.removeAttribute('title'); el.classList.remove('tip'); return; }
    el.dataset.tip = JSON.stringify(value);
    el.title = value.v !== undefined && value.v !== '' ? `${value.t}: ${value.v}` : value.t;
    el.classList.add('tip');
    if (el.tagName !== 'BUTTON') { el.tabIndex = 0; el.setAttribute('role', 'button'); }
    else el.classList.add('tip-btn');
}
app.directive('tip', { mounted: setTip, updated: setTip });
installGlobals(app);
app.mount('#app');
