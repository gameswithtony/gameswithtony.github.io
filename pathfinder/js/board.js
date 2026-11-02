// Mars map: SVG hex board with pan / pinch / wheel zoom.
import { HEXES, center, neighbors } from './hex.js';
import { iconPaths } from './icons.js';
import { complexOf, B } from './engine.js';
import * as D from './data.js';

const R = 40;
const SQ = Math.sqrt(3);
const px = id => { const c = center(id); return { x: c.x * R, y: c.y * R }; };
const hexPts = (x, y, r) => Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const BOUNDS = (() => {
    const xs = HEXES.map(h => px(h).x), ys = HEXES.map(h => px(h).y);
    return { x: Math.min(...xs) - R * 1.2, y: Math.min(...ys) - R * 1.2, w: Math.max(...xs) - Math.min(...xs) + R * 2.4, h: Math.max(...ys) - Math.min(...ys) + R * 2.4 };
})();
/** Deterministic per-hex shade for terrain texture. */
const shade = id => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; return (h % 7) / 7; };

const TYPE_COLOR = { mine: 'var(--c-mineral)', gen: 'var(--c-battery)', water: 'var(--c-water)', green: 'var(--c-plant)', oxy: 'var(--c-oxygen)' };
const TYPE_ICON = { mine: 'mine', gen: 'gen', water: 'water', green: 'plant', oxy: 'oxygen', shelter: 'shelter' };
const OWNER_COLOR = ['var(--c-you)', 'var(--c-pf)'];
const DISC_GLYPH = { build: null, buildAny: 'upgrade', develop2: 'develop', blueprints2: 'blueprint', tech1: 'tech', upgrade2: 'adv', hire: 'scientist', warehouse2: 'warehouse' };

export const MarsMap = {
    props: ['st', 'prompt', 'compact'],
    emits: ['hex', 'inspect'],
    data() { return { R, vb: { ...BOUNDS }, drag: null, pointers: {}, pinch: null, moved: false }; },
    computed: {
        hexes() {
            return HEXES.map(id => { const p = px(id); return { id, x: p.x, y: p.y, pts: hexPts(p.x, p.y, R - 1.5), inner: hexPts(p.x, p.y, R * 0.8), s: shade(id) }; });
        },
        byId() { const m = {}; this.hexes.forEach(h => m[h.id] = h); return m; },
        hexPrompt() { return this.prompt && this.prompt.kind === 'hex' ? this.prompt : null; },
        hi() {
            const m = {};
            if (this.hexPrompt) for (const e of this.hexPrompt.hexes) m[e.h] = e;
            return m;
        },
        flash() { return new Set(this.st.flash || []); },
        buildings() {
            const st = this.st, out = [], badge = new Set();
            for (const id of HEXES) {
                const b = st.hex[id].b;
                if (!b) continue;
                const p = px(id);
                const cx = complexOf(st, id);
                let size = 0;
                if (cx.length >= 2) { const lead = [...cx].sort()[0]; if (lead === id) size = cx.length; }
                const color = b.type === 'shelter' ? OWNER_COLOR[b.o] : TYPE_COLOR[b.type];
                // edges shared with same-type neighbours are drawn as joins
                const joins = neighbors(id).filter(n => { const nb = st.hex[n].b; return nb && nb.type === b.type && (b.type !== 'shelter' || nb.o === b.o); })
                    .map(n => { const q = px(n); return { x2: (p.x + q.x) / 2, y2: (p.y + q.y) / 2 }; });
                out.push({ id, ...p, type: b.type, o: b.o, color, icon: iconPaths(TYPE_ICON[b.type]), size, adv: b.adv, col: b.col, joins, pts: hexPts(p.x, p.y, R * 0.86) });
            }
            return out;
        },
        things() {
            const st = this.st, out = [];
            for (const id of HEXES) {
                const x = st.hex[id], p = px(id);
                if (x.crystal) out.push({ id, k: 'crystal', ...p });
                if (x.disc) {
                    const d = D.disc(x.disc);
                    const g = d.k === 'build' ? TYPE_ICON[d.b] : d.k === 'gain' ? d.g : DISC_GLYPH[d.k];
                    out.push({ id, k: 'disc', ...p, glyph: iconPaths(g || 'discovery'), n: d.k === 'gain' ? d.n : d.k.endsWith('2') ? 2 : 0 });
                }
                if (x.res) out.push({ id, k: 'res', ...p, letter: x.res[0] });
            }
            return out;
        },
        pieces() {
            const st = this.st, out = [];
            for (const b of st.bots) {
                const p = px(b.h); const hasB = !!st.hex[b.h].b;
                out.push({ k: 'bot', o: b.o, x: p.x + (hasB ? R * 0.42 : 0), y: p.y + (hasB ? -R * 0.4 : 0), h: b.h });
            }
            const rh = st.rover;
            if (rh) { const p = px(rh); const hasB = !!st.hex[rh].b; out.push({ k: 'rover', o: 0, x: p.x + (hasB ? -R * 0.42 : 0), y: p.y + (hasB ? -R * 0.4 : 0), h: rh }); }
            else { const p = px(D.CENTER); out.push({ k: 'rover', o: 0, ghost: true, x: p.x - R * 0.42, y: p.y - R * 0.4, h: D.CENTER }); }
            return out;
        },
        viewBox() { const v = this.vb; return `${v.x} ${v.y} ${v.w} ${v.h}`; },
        center() { return px(D.CENTER); },
    },
    watch: {
        hexPrompt: { immediate: true, handler(p, old) {
            if (p && p.hexes.length) this.focusOn(p.hexes.map(e => e.h));
            else if (old) this.fit();
        } },
    },
    methods: {
        icon: iconPaths,
        researchColor(l) { return { A: 'var(--r-a)', B: 'var(--r-b)', C: 'var(--r-c)', D: 'var(--r-d)' }[l]; },
        fit() { this.vb = { ...BOUNDS }; },
        zoom(f, cx, cy) {
            const v = this.vb;
            const w = Math.min(BOUNDS.w * 1.4, Math.max(BOUNDS.w / 6, v.w * f));
            const k = w / v.w;
            cx ??= v.x + v.w / 2; cy ??= v.y + v.h / 2;
            this.vb = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w, h: v.h * k };
        },
        /** Zoom out enough to show every highlighted hex (only if some are off-screen). */
        /** Zoom to the hexes that matter (keeps at least ~7 hexes across so you keep your bearings). */
        focusOn(ids) {
            const pts = ids.map(px);
            let x0 = Math.min(...pts.map(p => p.x)) - R * 1.6, x1 = Math.max(...pts.map(p => p.x)) + R * 1.6;
            let y0 = Math.min(...pts.map(p => p.y)) - R * 1.6, y1 = Math.max(...pts.map(p => p.y)) + R * 1.6;
            const minW = R * 10, minH = R * 8;
            if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
            if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
            if (x1 - x0 > BOUNDS.w * 0.85 || y1 - y0 > BOUNDS.h * 0.85) { this.fit(); return; }
            this.vb = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        },
        toSvg(e) {
            const svg = this.$refs.svg, r = svg.getBoundingClientRect();
            const v = this.vb;
            const s = Math.max(v.w / r.width, v.h / r.height);
            const ox = (r.width * s - v.w) / 2, oy = (r.height * s - v.h) / 2;
            return { x: v.x - ox + (e.clientX - r.left) * s, y: v.y - oy + (e.clientY - r.top) * s, s };
        },
        down(e) {
            this.$refs.svg.setPointerCapture?.(e.pointerId);
            this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            const ids = Object.keys(this.pointers);
            if (ids.length === 1) { this.drag = { x: e.clientX, y: e.clientY, vb: { ...this.vb } }; this.moved = false; this.downTarget = e.target; }
            if (ids.length === 2) {
                const [a, b] = ids.map(i => this.pointers[i]);
                this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), vb: { ...this.vb }, mid: this.toSvg({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }) };
                this.moved = true;
            }
        },
        move(e) {
            if (!this.pointers[e.pointerId]) return;
            this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            const ids = Object.keys(this.pointers);
            if (ids.length === 2 && this.pinch) {
                const [a, b] = ids.map(i => this.pointers[i]);
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                const k = this.pinch.d / Math.max(10, d);
                const v0 = this.pinch.vb, m = this.pinch.mid;
                const w = Math.min(BOUNDS.w * 1.4, Math.max(BOUNDS.w / 6, v0.w * k)); const kk = w / v0.w;
                this.vb = { x: m.x - (m.x - v0.x) * kk, y: m.y - (m.y - v0.y) * kk, w, h: v0.h * kk };
                return;
            }
            if (this.drag) {
                const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
                if (Math.abs(dx) + Math.abs(dy) > 6) this.moved = true;
                if (!this.moved) return;
                const s = this.toSvg(e).s;
                this.vb = { ...this.drag.vb, x: this.drag.vb.x - dx * s, y: this.drag.vb.y - dy * s };
            }
        },
        up(e) {
            delete this.pointers[e.pointerId];
            if (Object.keys(this.pointers).length < 2) this.pinch = null;
            if (Object.keys(this.pointers).length === 0) {
                if (!this.moved && this.drag) this.tap(this.downTarget);
                this.drag = null;
            }
        },
        wheel(e) { const p = this.toSvg(e); this.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y); },
        tap(target) {
            const el = target && target.closest && target.closest('[data-h]');
            if (!el) return;
            const h = el.getAttribute('data-h');
            const hp = this.hi[h];
            if (hp) this.$emit('hex', hp.v ?? hp.h);
            else this.$emit('inspect', h);
        },
        label(e) {
            const q = this.hexPrompt?.q;
            if (q === 'buildHex') return e.size > 1 ? String(e.size) : '';
            if (q === 'moveTo') return String(e.d);
            return '';
        },
    },
    template: `
<div class="map-wrap" :class="{ deciding: !!hexPrompt }">
  <svg ref="svg" class="map" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet"
       @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel.prevent="wheel"
       role="img" aria-label="Map of Mars">
    <defs>
      <radialGradient id="mars-glow" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="var(--mars-1)"/><stop offset="100%" stop-color="var(--mars-3)"/>
      </radialGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000" flood-opacity=".55"/></filter>
      <!-- fixed backing under the see-through terrain, so tiles look the same on any theme's backdrop -->
      <radialGradient id="hex-base" gradientUnits="userSpaceOnUse" cx="${(BOUNDS.x + BOUNDS.w / 2).toFixed(0)}" cy="${(BOUNDS.y + BOUNDS.h * 0.4).toFixed(0)}" r="${(Math.max(BOUNDS.w, BOUNDS.h) * 0.6).toFixed(0)}">
        <stop offset="0%" stop-color="#3a1709"/><stop offset="100%" stop-color="#070d14"/>
      </radialGradient>
    </defs>
    <!-- terrain -->
    <g class="terrain">
      <polygon v-for="h in hexes" :key="'b' + h.id" :points="h.pts" fill="url(#hex-base)"/>
      <polygon v-for="h in hexes" :key="h.id" :points="h.pts" :data-h="h.id"
        class="hx" :style="{ fillOpacity: 0.55 + h.s * 0.35 }"
        :class="{ dim: hexPrompt && !hi[h.id], center: h.id === '${D.CENTER}' }"/>
    </g>
    <!-- buildings -->
    <g class="buildings">
      <g v-for="b in buildings" :key="b.id" :data-h="b.id" :class="{ dim: hexPrompt && !hi[b.id] }">
        <line v-for="(j,i) in b.joins" :key="i" :x1="b.x" :y1="b.y" :x2="j.x2" :y2="j.y2" class="join" :style="{ stroke: b.color }"/>
        <polygon :points="b.pts" class="bld" :style="{ stroke: b.color }"/>
        <g :transform="'translate(' + (b.x - 14) + ',' + (b.y - 16) + ') scale(1.17)'" fill="none" :stroke="b.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="b.icon"></g>
        <g v-if="b.type==='shelter'" :transform="'translate(' + (b.x - 6) + ',' + (b.y + 9) + ') scale(.5)'" fill="none" :stroke="b.color" stroke-width="3" v-html="icon(b.o===0?'you':'pf')"></g>
        <g v-if="b.size" class="badge">
          <circle :cx="b.x + R*0.55" :cy="b.y + R*0.42" r="10" :style="{ stroke: b.color }"/>
          <text :x="b.x + R*0.55" :y="b.y + R*0.42 + 4.5" text-anchor="middle">{{ b.size }}</text>
        </g>
        <g v-if="b.adv" class="adv" filter="url(#soft)">
          <circle v-if="b.adv.o===0" :cx="b.x" :cy="b.y + R*0.5" r="11" />
          <rect v-else :x="b.x - 9" :y="b.y + R*0.5 - 9" width="18" height="18" :transform="'rotate(45 ' + b.x + ' ' + (b.y + R*0.5) + ')'"/>
          <g :transform="'translate(' + (b.x - 7) + ',' + (b.y + R*0.5 - 7) + ') scale(.58)'" fill="currentColor" stroke="none" v-html="icon('adv')" :style="{ color: b.adv.o===0 ? 'var(--c-you)' : 'var(--c-pf)' }"></g>
        </g>
        <g v-if="b.col !== null && b.col !== undefined" :transform="'translate(' + (b.x - R*0.75) + ',' + (b.y + 2) + ') scale(.7)'" fill="var(--bg)" :stroke="b.col===0 ? 'var(--c-you)' : 'var(--c-pf)'" stroke-width="2.5" v-html="icon('colonist')"></g>
      </g>
    </g>
    <!-- tiles & crystals -->
    <g class="things">
      <g v-for="t in things" :key="t.k + t.id" :data-h="t.id" :class="{ dim: hexPrompt && !hi[t.id] }">
        <g v-if="t.k==='crystal'" :transform="'translate(' + (t.x - 12) + ',' + (t.y - 13) + ') scale(1)'" fill="var(--c-crystal-fill)" stroke="var(--c-crystal)" stroke-width="2" stroke-linejoin="round" v-html="icon('crystal')" filter="url(#soft)"></g>
        <g v-else-if="t.k==='disc'" filter="url(#soft)">
          <rect :x="t.x - 17" :y="t.y - 17" width="34" height="34" rx="7" class="disc"/>
          <g :transform="'translate(' + (t.x - 11) + ',' + (t.y - 11) + ') scale(.92)'" fill="none" stroke="#1d2c38" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" v-html="t.glyph"></g>
          <text v-if="t.n" :x="t.x + 13" :y="t.y + 14" class="disc-n">{{ t.n }}</text>
        </g>
        <g v-else filter="url(#soft)">
          <circle :cx="t.x" :cy="t.y" r="16" class="res" :style="{ fill: researchColor(t.letter) }"/>
          <text :x="t.x" :y="t.y + 6" text-anchor="middle" class="res-l">{{ t.letter }}</text>
        </g>
      </g>
    </g>
    <!-- pieces -->
    <g class="pieces">
      <g v-for="(p,i) in pieces" :key="p.k + p.h" :data-h="p.h" filter="url(#soft)" :class="['piece', p.k, p.o===0?'mine':'theirs', { ghost: p.ghost, pick: hexPrompt && hexPrompt.q==='movePick' && hi[p.h] }]">
        <template v-if="p.k==='bot'">
          <circle v-if="p.o===0" :cx="p.x" :cy="p.y" r="13" class="tok you"/>
          <rect v-else :x="p.x-11" :y="p.y-11" width="22" height="22" class="tok pf" :transform="'rotate(45 ' + p.x + ' ' + p.y + ')'"/>
          <g :transform="'translate(' + (p.x - 9) + ',' + (p.y - 9) + ') scale(.75)'" fill="none" stroke="var(--bg)" stroke-width="2.6" stroke-linecap="round" v-html="icon('bot')"></g>
        </template>
        <template v-else>
          <circle :cx="p.x" :cy="p.y" r="14" class="tok rover"/>
          <g :transform="'translate(' + (p.x - 10) + ',' + (p.y - 10) + ') scale(.83)'" fill="none" stroke="var(--c-you)" stroke-width="2.4" stroke-linecap="round" v-html="icon('rover')"></g>
        </template>
      </g>
    </g>
    <!-- decision overlay -->
    <g class="hilite" v-if="hexPrompt">
      <g v-for="e in hexPrompt.hexes" :key="'h'+e.h" :data-h="e.h">
        <polygon :points="byId[e.h].inner" class="pick-ring"/>
        <g v-if="label(e)">
          <circle :cx="byId[e.h].x" :cy="byId[e.h].y - R*0.52" r="10" class="pick-lab-bg"/>
          <text :x="byId[e.h].x" :y="byId[e.h].y - R*0.52 + 4.5" text-anchor="middle" class="pick-lab">{{ label(e) }}</text>
        </g>
        <g v-if="e.need" :transform="'translate(' + (byId[e.h].x + R*0.25) + ',' + (byId[e.h].y - R*0.75) + ') scale(.6)'" fill="none" stroke="var(--primary-bright)" stroke-width="2.5" v-html="icon('tech')"></g>
      </g>
    </g>
    <g class="flash"><polygon v-for="f in [...flash]" :key="'f'+f" :points="byId[f]?.pts" class="flash-ring"/></g>
  </svg>
  <div class="map-ctl">
    <button class="icon-btn" @click="zoom(1/1.3)" aria-label="Zoom in" v-html="iconBtn('plus')"></button>
    <button class="icon-btn" @click="zoom(1.3)" aria-label="Zoom out" v-html="iconBtn('minus')"></button>
    <button class="icon-btn" @click="fit" aria-label="Fit map" v-html="iconBtn('fit')"></button>
  </div>
  <slot></slot>
</div>`,
};
MarsMap.methods.iconBtn = function (n) { return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths(n)}</svg>`; };
MarsMap.methods.icon = iconPaths;
export { R };
