// Vue components for the board, your board, the Colleagues, goals and the log.
import { icon, iconPaths } from './icons.js';
import * as D from './data.js';
import * as T from './text.js';
import * as TIP from './tips.js';
import {
    deptOf, di, isCert, certCount, deskCap, storeCap, slotCap, myCars, tested, partValue, upgCount, trackLeader,
    pgCount, pgSlot, finalMet, sandraDept, weekScore, occupant, garageOpen, tableCards, endTriggered,
} from './engine.js';

export const Ic = {
    props: { n: String, s: { type: Number, default: 20 }, c: String, label: String },
    computed: { html() { return icon(this.n, { size: this.s, color: this.c, label: this.label }); } },
    template: `<span class="ic-w" v-html="html"></span>`,
};
const WHO_C = { you: 'var(--c-you)', L: 'var(--c-l)', T: 'var(--c-t)', S: 'var(--c-s)' };
export const Tok = {
    components: { Ic },
    props: { w: String, s: { type: Number, default: 16 } },
    computed: { label() { return T.WHO[this.w]; } },
    template: `<span class="tok" :class="'tok-' + w"><Ic :n="w" :s="s" :label="label"/></span>`,
};
export const PartChip = {
    components: { Ic },
    props: { p: String, s: { type: Number, default: 18 }, st: Object, n: Number },
    template: `<span class="pchip" :class="'p-' + p" v-tip="st ? TIP.part(st, p) : null"><Ic :n="p" :s="s" :label="T.P[p]"/><b v-if="n !== undefined">{{ n }}</b></span>`,
};
export const CarIc = {
    components: { Ic },
    props: { m: String, s: { type: Number, default: 20 } },
    template: `<Ic :n="m" :s="s" :c="'var(--car-' + m + ')'" :label="T.M[m]"/>`,
};
export const DesignTile = {
    components: { Ic, CarIc },
    props: { id: String, st: Object, up: Boolean, label: Boolean, s: { type: Number, default: 18 } },
    computed: {
        m() { return D.dModel(this.id); }, pt() { return D.dPart(this.id); },
        isTested() { return this.up && this.st && myCars(this.st).includes(this.m); },
        tipv() { return this.st ? (this.up ? TIP.upgraded(this.id, this.st) : TIP.design(this.id, this.st)) : null; },
    },
    template: `<span class="dtile" :class="['m-' + m, { up, tested: isTested }]" v-tip="tipv">
      <CarIc :m="m" :s="s"/><span class="dpart" v-if="pt" :class="'p-' + pt"><Ic :n="pt" :s="s - 3" :label="T.P[pt]"/></span><span v-else class="dblank" aria-label="blank">∅</span>
      <Ic v-if="up" :n="isTested ? 'tested' : 'upgraded'" :s="13" class="dmark"/>
      <small v-if="label" class="dlabel">{{ T.M[m] + (pt ? ' ' + T.P[pt] : ' blank') }}</small>
    </span>`,
};
export const Ben = {
    components: { Ic },
    props: { b: String, s: { type: Number, default: 16 }, txt: Boolean },
    computed: { info() { return T.ben(this.b); } },
    template: `<span class="ben" :class="{ empty: !b }"><Ic :n="info.ic" :s="s" :label="info.txt"/><b v-if="info.n">{{ info.n }}</b><small v-if="txt">{{ info.txt }}</small></span>`,
};
/** A department's training track: 6 spaces, certified from 3, Expert at 5. */
export const TrainTrack = {
    components: { Ic, Tok },
    props: { st: Object, d: String },
    computed: {
        cells() {
            const i = di(this.d), st = this.st;
            return [0, 1, 2, 3, 4, 5].map(n => ({ n, who: ['you', 'L', 'T'].filter(w => (w === 'you' ? st.p.tr : st.bots[w].tr)[i] === n) }));
        },
        aw() { return this.st.award[this.d]; },
    },
    template: `<span class="ttrack" v-tip="TIP.track(st, d)">
      <span v-for="c in cells" :key="c.n" class="tcell" :class="{ cert: c.n >= 3, exp: c.n === 5 }">
        <Tok v-for="w in c.who" :key="w" :w="w" :s="10"/>
      </span>
      <span class="taward"><Ic :n="aw.tok || aw.tile ? 'award' : 'none'" :s="13"/></span>
    </span>`,
};

// ================================================================ workstations
export const AlleyStrip = {
    components: { Ic, Tok },
    props: ['st'],
    emits: ['open'],
    computed: {
        cols() {
            return D.DEPTS.map((d, i) => ({ d, slots: (d === 'adm' ? [8, 9, D.DESK] : [i * 2, i * 2 + 1]).map(ws => ({ ws, who: occupant(this.st, ws) })), sandra: sandraDept(this.st) === d }));
        },
    },
    methods: { shifts(ws) { return ws === D.DESK ? '' : D.WS_SHIFTS[deptOf(ws)][ws % 2]; } },
    template: `<div class="alley" role="group" aria-label="Workstations">
      <div v-for="c in cols" :key="c.d" class="alley-col" :class="{ sandra: c.sandra }">
        <span class="alley-h" v-tip="TIP.track(st, c.d)"><Ic :n="c.d" :s="16"/><small>{{ T.DN[c.d] }}</small></span>
        <span class="alley-slots">
          <span v-for="s in c.slots" :key="s.ws" class="ws" :class="{ desk: s.ws === D.DESK, mine: s.who === 'you' }" v-tip="TIP.ws(st, s.ws)">
            <Tok v-if="s.who" :w="s.who" :s="15"/><small v-else-if="s.ws !== D.DESK" class="wsn">{{ shifts(s.ws) }}</small><small v-else class="wsn">desk</small>
          </span>
        </span>
      </div>
      <button class="alley-more icon-btn sm" @click="$emit('open')" aria-label="Workstations and training"><Ic n="chev" :s="16"/></button>
    </div>`,
};
export const StationsBoard = {
    components: { Ic, Tok, TrainTrack, PartChip },
    props: ['st'],
    computed: {
        rows() {
            const st = this.st;
            return D.DEPTS.map((d, i) => ({ d, i, slots: (d === 'adm' ? [8, 9] : [i * 2, i * 2 + 1]).map(ws => ({ ws, who: occupant(st, ws), n: D.WS_SHIFTS[d][ws % 2] })) }));
        },
        col() { return this.st.plan.col.map(id => D.plan(id)); },
    },
    template: `<div class="board-sec">
      <table class="stations">
        <tr v-for="r in rows" :key="r.d" :class="{ sandra: st.pos.S !== D.DESK && r.d === T_sd }">
          <th><Ic :n="r.d" :s="18"/> {{ T.DN[r.d] }}</th>
          <td v-for="s in r.slots" :key="s.ws" v-tip="TIP.ws(st, s.ws)"><span class="shn">{{ s.n }}</span><Tok v-if="s.who" :w="s.who" :s="15"/></td>
          <td><train-track :st="st" :d="r.d"/></td>
        </tr>
      </table>
      <p class="line" v-tip="TIP.sandra(st)"><Ic n="S" :s="16" c="var(--c-s)"/> Sandra: {{ st.pos.S === D.DESK ? 'her desk' : T.DN[T_sd] }} · {{ T.SANDRA_TASK[T_sd] }}</p>
      <h4>Plan cards left in the column</h4>
      <p class="line" v-if="!col.length">None</p>
      <p class="line" v-for="(c, i) in col" :key="c.id"><Ic n="plan" :s="16"/> {{ i === 0 ? 'Top' : i === col.length - 1 ? 'Bottom' : 'Middle' }}: {{ T.DN[c.d] }}<template v-if="c.parts.length"> · end of day: <part-chip v-for="p in c.parts" :key="p" :p="p" :s="14"/></template></p>
    </div>`,
};
StationsBoard.computed.T_sd = function () { return sandraDept(this.st); };

// ================================================================ factory panels
export const Panel = {
    components: { Ic, Tok, TrainTrack },
    props: { st: Object, d: String, open: { type: Boolean, default: true } },
    emits: ['toggle'],
    computed: {
        here() { return Object.keys(this.st.pos).filter(k => deptOf(this.st.pos[k]) === this.d); },
        isSandra() { return sandraDept(this.st) === this.d; },
    },
    template: `<section class="panel" :class="['d-' + d, { closed: !open }]">
      <header class="panel-h">
        <button class="panel-t" @click="$emit('toggle')" :aria-expanded="open"><Ic :n="d" :s="20"/><h3>{{ T.DN[d] }}</h3><Ic n="chev" :s="16" class="chev"/></button>
        <span class="here"><Tok v-for="w in here" :key="w" :w="w" :s="14"/></span>
        <train-track :st="st" :d="d"/>
      </header>
      <div class="panel-b" v-show="open"><slot/></div>
    </section>`,
};

export const RdPanel = {
    components: { Ic, CarIc, PartChip, Ben },
    props: ['st'],
    computed: {
        /** Test track geometry: 8 spaces round an oval, space 0 at the top, counterclockwise. */
        tt() {
            const cx = 180, cy = 80, rx = 148, ry = 56, w = 21, n = D.TRACK_LEN;
            const at = (i, dr = 0) => { const a = -Math.PI / 2 - (i / n) * Math.PI * 2; return { x: cx + (rx + dr) * Math.cos(a), y: cy + (ry + dr) * Math.sin(a) }; };
            const divs = [];
            for (let i = 0; i < n; i++) { const p = at(i + 0.5, -w), q = at(i + 0.5, w); divs.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y }); }
            const stripes = [];
            for (let i = 0; i < n; i += D.STRIPE_EVERY) {
                // the whole curved segment between the dividers either side of the space
                const a = at(i - 0.5, -w), b = at(i - 0.5, w), c = at(i + 0.5, w), d = at(i + 0.5, -w);
                stripes.push({ i, d: `M${a.x} ${a.y}L${b.x} ${b.y}A${rx + w} ${ry + w} 0 0 0 ${c.x} ${c.y}L${d.x} ${d.y}A${rx - w} ${ry - w} 0 0 1 ${a.x} ${a.y}Z` });
            }
            const pace = at(this.st.pace);
            const cars = this.st.track.map((m, k) => ({ k, m, cost: D.CLAIM_COST[k], ...at((this.st.pace - 1 - k + n * 2) % n) }));
            const toGo = (D.STRIPE_EVERY - (this.st.pace % D.STRIPE_EVERY)) % D.STRIPE_EVERY || D.STRIPE_EVERY;
            return { cx, cy, rx, ry, w, divs, stripes, pace, cars, toGo };
        },
    },
    template: `<div class="rd">
      <svg class="tt-svg" viewBox="0 0 360 160" role="img" aria-label="Test track" v-tip="TIP.testTrack(st)">
        <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#dfca5a"/><rect width="4" height="8" fill="#26261f"/></pattern></defs>
        <ellipse :cx="tt.cx" :cy="tt.cy" :rx="tt.rx + tt.w + 3" :ry="tt.ry + tt.w + 3" class="tt-kerb"/>
        <ellipse :cx="tt.cx" :cy="tt.cy" :rx="tt.rx" :ry="tt.ry" class="tt-road" :stroke-width="tt.w * 2"/>
        <ellipse :cx="tt.cx" :cy="tt.cy" :rx="tt.rx - tt.w - 3" :ry="tt.ry - tt.w - 3" class="tt-infield"/>
        <path v-for="sp in tt.stripes" :key="sp.i" :d="sp.d" fill="url(#hatch)" class="tt-stripe"/>
        <line v-for="(d, i) in tt.divs" :key="i" :x1="d.x1" :y1="d.y1" :x2="d.x2" :y2="d.y2" class="tt-div"/>
        <text :x="tt.cx" :y="tt.cy - 8" class="tt-t1">{{ st.meetingDue ? 'Meeting tonight' : 'Meeting in ' + tt.toGo }}</text>
        <text :x="tt.cx" :y="tt.cy + 11" class="tt-t2">{{ st.meetingDue ? 'Pace Car on a stripe' : 'Pace Car move' + (tt.toGo === 1 ? '' : 's') }}</text>
        <g v-for="c in tt.cars" :key="'c' + c.k" v-tip="TIP.slot(st, c.k)">
          <circle :cx="c.x" :cy="c.y" r="16" class="tt-carbg"/>
          <g v-if="c.m" :transform="'translate(' + (c.x - 13) + ',' + (c.y - 13) + ') scale(1.08)'" fill="none" :stroke="'var(--car-' + c.m + '-on-road)'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" v-html="paths(c.m)"></g>
          <circle v-else :cx="c.x" :cy="c.y" r="9" class="tt-gap"/>
          <circle :cx="c.x + 14" :cy="c.y - 13" r="8" class="tt-cost"/>
          <text :x="c.x + 14" :y="c.y - 9.5" class="tt-cost-t">{{ c.cost }}</text>
        </g>
        <g v-tip="TIP.meeting(st)">
          <circle :cx="tt.pace.x" :cy="tt.pace.y" r="17" class="tt-pacebg"/>
          <g :transform="'translate(' + (tt.pace.x - 12) + ',' + (tt.pace.y - 12) + ')'" fill="none" stroke="#26261f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" v-html="paths('pace')"></g>
        </g>
      </svg>
      <p class="line small muted tt-legend"><span class="tt-key"></span> Pace Car · cars behind it cost 1, 2, 2, 3 Shifts to claim<span v-if="!st.track.some(Boolean)">· none waiting</span></p>
      <table class="upg" aria-label="Upgrade spaces">
        <tr v-for="m in D.MODELS" :key="m">
          <th v-tip="TIP.model(st, m)"><car-ic :m="m" :s="22"/></th>
          <td v-for="(b, i) in D.UPGRADE_SPACES[m]" :key="i" :class="{ filled: st.upg[m][i] }" v-tip="TIP.upgSpace(st, m, i)">
            <part-chip v-if="st.upg[m][i]" :p="st.upg[m][i]" :s="15"/><ben v-else :b="b" :s="14"/>
          </td>
        </tr>
      </table>
      <div class="values" aria-label="Part values">
        <span v-for="p in D.PARTS" :key="p" class="val" v-tip="TIP.part(st, p)"><part-chip :p="p" :s="15"/><b>{{ partValue(st, p) || '–' }}</b><small v-if="st.dbl[p]" title="Double-Upgraded">×2</small></span>
      </div>
    </div>`,
    methods: { paths: n => iconPaths(n), partValue },
};

/** Assembly line drawing: rows top to bottom are Concept, SUV, City, Truck, Sports. */
const NODE_XY = {
    X1: [16, 46], X2: [16, 82], X3: [16, 118],
    P2: [64, 46], P4: [64, 82], P6: [64, 118], P3: [118, 46], P5: [118, 82], P7: [118, 118], P1: [150, 12], P8: [150, 152],
    's:concept': [196, 12], 's:suv': [196, 46], 's:city': [196, 82], 's:truck': [196, 118], 's:sports': [196, 152],
};
export const AsmPanel = {
    components: { Ic, CarIc, PartChip },
    props: ['st'],
    computed: {
        edges() {
            const out = [];
            for (const [a, list] of Object.entries(D.NEXT)) for (const b of list) out.push({ a, b, x1: NODE_XY[a][0], y1: NODE_XY[a][1], x2: NODE_XY[b][0], y2: NODE_XY[b][1] });
            return out;
        },
        cars() { return Object.entries(this.st.asm.at).filter(([, m]) => m).map(([n, m]) => ({ n, m, x: NODE_XY[n][0], y: NODE_XY[n][1] })); },
        plates() { return D.PLATES.map(p => ({ p, x: NODE_XY[p][0], y: NODE_XY[p][1] })); },
        rows() { return D.MODELS.map((m, i) => ({ m, y: [12, 46, 82, 118, 152][i], sp: this.st.asm.sp[m], n: D.ASM_SPACES[m] })); },
    },
    methods: {
        carPath(m) { return iconPaths(m); },
    },
    template: `<div class="asm">
      <div class="demand-row">
        <span v-for="(dm, i) in st.demand" :key="i" class="demand" v-tip="TIP.demand(st, i)"><Ic n="demand" :s="16"/><car-ic :m="dm.m" :s="20"/><b>{{ dm.tok }}</b><Ic n="generic" :s="14"/></span>
      </div>
      <svg class="line-svg" viewBox="-8 -22 376 210" role="img" aria-label="Assembly lines">
        <defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arr"/></marker></defs>
        <line v-for="(e, i) in edges" :key="i" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" class="conv" marker-end="url(#arr)"/>
        <g v-for="x in ['X1','X2','X3']" :key="x" v-tip="TIP.exit(x)"><circle :cx="NXY[x][0]" :cy="NXY[x][1]" r="11" class="exit"/><text :x="NXY[x][0]" :y="NXY[x][1] + 4" class="exit-t">{{ D.EXIT_PP[x] }}</text></g>
        <g v-for="p in plates" :key="p.p" v-tip="TIP.asmNode(st, p.p)"><rect :x="p.x - 13" :y="p.y - 13" width="26" height="26" rx="5" class="plate"/><text :x="p.x - 17" :y="p.y - 13" class="plate-n">{{ p.p.slice(1) }}</text></g>
        <g v-for="r in rows" :key="r.m">
          <rect :x="182" :y="r.y - 13" width="28" height="26" rx="4" class="startsp" :style="{ stroke: 'var(--car-' + r.m + ')' }" v-tip="TIP.asmNode(st, 's:' + r.m)"/>
          <g v-for="k in r.n" :key="k" :transform="'translate(' + (220 + (k - 1) * 33) + ',' + (r.y - 13) + ')'" v-tip="TIP.asmSpace(st, r.m, k - 1)">
            <rect width="28" height="26" rx="4" class="asp" :class="r.sp[k - 1] ? 'p-' + r.sp[k - 1] : ''"/>
            <g v-if="r.sp[k - 1]" transform="translate(4,3) scale(.84)" fill="none" :stroke="'var(--part-' + r.sp[k - 1] + ')'" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" v-html="carPath(r.sp[k - 1])"></g>
          </g>
        </g>
        <g v-for="c in cars" :key="c.n" :transform="'translate(' + (c.x - 12) + ',' + (c.y - 12) + ')'" class="carg" v-tip="TIP.asmNode(st, c.n)">
          <rect x="-1" y="-1" width="26" height="26" fill="transparent"/>
          <g fill="none" :stroke="'var(--car-' + c.m + ')'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" v-html="carPath(c.m)"></g>
        </g>
      </svg>
      <p class="legend"><span v-for="r in rows" :key="r.m" v-tip="TIP.model(st, r.m)"><car-ic :m="r.m" :s="16"/>{{ T.M[r.m] }} {{ r.sp.length }}/{{ r.n }}</span></p>
    </div>`,
};
AsmPanel.computed.NXY = () => NODE_XY;

export const LogPanel = {
    components: { Ic, PartChip },
    props: ['st'],
    template: `<div class="logi">
      <div class="wares">
        <span v-for="p in D.TOP_PARTS" :key="p" class="ware" :class="'p-' + p" v-tip="TIP.ware(st, p)"><part-chip :p="p" :s="22"/><b>{{ st.ware[p] }}</b></span>
        <span class="kline" aria-hidden="true"></span>
        <span v-for="p in D.PARTS.filter(x => !D.TOP_PARTS.includes(x))" :key="p" class="ware" :class="'p-' + p" v-tip="TIP.ware(st, p)"><part-chip :p="p" :s="22"/><b>{{ st.ware[p] }}</b></span>
      </div>
      <p class="line" v-tip="TIP.recycle(st)"><Ic n="recycle" :s="18"/> Recycling <part-chip v-for="p in st.recycle" :key="p" :p="p" :s="16"/></p>
      <p class="line small muted"><Ic n="supply" :s="16"/> Supply <span v-for="p in D.PARTS" :key="p" class="sup"><part-chip :p="p" :s="13" :st="st"/>{{ st.supply[p] }}</span></p>
    </div>`,
};

export const DesPanel = {
    components: { Ic, DesignTile, Ben },
    props: ['st'],
    template: `<div class="des">
      <div class="des-grid">
        <div class="stacks">
          <span class="stk" v-tip="TIP.stacks(st, 'fo', 0)"><design-tile v-if="st.design.fo[0][0]" :id="st.design.fo[0][0]"/><small>{{ st.design.fo[0].length }}</small></span>
          <span class="stk central" v-tip="TIP.stacks(st, 'central')"><design-tile v-if="st.design.central[0]" :id="st.design.central[0]"/><small>{{ st.design.central.length }}</small></span>
          <span class="stk" v-tip="TIP.stacks(st, 'fo', 1)"><design-tile v-if="st.design.fo[1][0]" :id="st.design.fo[1][0]"/><small>{{ st.design.fo[1].length }}</small></span>
        </div>
        <div class="disp">
          <template v-for="r in [0, 1]" :key="r">
            <span v-for="c in [0, 1, 2, 3]" :key="r + '-' + c" class="dslot"><design-tile v-if="st.design.disp[r][c]" :id="st.design.disp[r][c]" :st="st"/></span>
          </template>
          <span v-for="c in [0, 1, 2, 3]" :key="'b' + c" class="dben" v-tip="TIP.dispCol(c)"><ben v-if="D.DISPLAY_BEN[c]" :b="D.DISPLAY_BEN[c]" :s="14"/></span>
        </div>
      </div>
    </div>`,
};

export const PgCard = {
    components: { Ic, Tok },
    props: { st: Object, id: Number, mini: Boolean },
    computed: {
        c() { return D.pg(this.id); },
        toks() { return this.st.pg.tok[this.id] || []; },
        have() { return pgCount(this.st, this.id); },
    },
    template: `<span class="pgc" :class="{ mini }" v-tip="TIP.pg(st, id)">
      <span class="pg-top"><Ic :n="T.pgIcon(id)" :s="18" :c="D.PARTS.includes(T.pgIcon(id)) ? 'var(--part-' + T.pgIcon(id) + ')' : D.MODELS.includes(T.pgIcon(id)) ? 'var(--car-' + T.pgIcon(id) + ')' : null"/><b>{{ c.pp }}</b><small>PP per {{ T.pgText(id) }}</small></span>
      <span class="pg-slots"><span v-for="(m, i) in c.m" :key="i" class="pgs" :class="{ used: toks[i] }"><Tok v-if="toks[i]" :w="toks[i]" :s="11"/><template v-else>{{ m }}×</template></span><small class="have">you {{ have }}</small></span>
    </span>`,
};

export const AdmPanel = {
    components: { Ic, Tok, PgCard, Ben },
    props: ['st'],
    computed: {
        fg() { return D.fin(this.st.finalGoal); },
        cert() {
            const st = this.st, at = k => k === 'you' ? st.p.cert : st.bots[k].cert;
            return D.CERT.map((sec, s) => sec.map((b, sp) => ({ s, sp, b, who: ['you', 'L', 'T'].find(k => at(k)[0] === s && at(k)[1] === sp) })));
        },
    },
    methods: { finalMet },
    template: `<div class="adm">
      <div class="markers">
        <span class="mk" v-tip="TIP.week(st)"><Ic n="week" :s="18"/>Week <b>{{ st.week }}</b>/3</span>
        <span class="mk" v-tip="TIP.cycle(st)"><Ic n="cycle" :s="18"/>Cycle <b>{{ st.cycle }}</b>/3</span>
        <span class="mk" :class="{ hot: st.meetingDue }" v-tip="TIP.meeting(st)"><Ic n="meeting" :s="18"/>{{ st.meetingDue ? 'Meeting tonight' : 'No Meeting yet' }}</span>
      </div>
      <h4><Ic n="pg" :s="16"/> Meeting room</h4>
      <div class="pg-row"><pg-card v-for="id in tableCards(st)" :key="id" :st="st" :id="id"/></div>
      <h4><Ic n="final" :s="16"/> Final Goal</h4>
      <ul class="fg" v-tip="TIP.finalGoal(st)"><li v-for="(a, i) in fg.a" :key="i" :class="{ met: finalMet(st, a) }"><b>{{ a.pp }}</b> {{ T.finalText(a) }}<Ic v-if="finalMet(st, a)" n="check" :s="14"/></li></ul>
      <h4><Ic n="factory" :s="16"/> Factory Goals</h4>
      <div class="fgoals"><span v-for="f in st.factory" :key="f.g" class="fgl" :class="{ done: st.p.fg && st.p.fg[f.g] }" v-tip="TIP.factory(st, f)"><Ic :n="f.g === 'cars' ? 'garage' : f.g === 'upg' ? 'upgraded' : 'cert'" :s="16"/><b>{{ f.n }}</b><Ic :n="f.tok ? 'generic' : 'none'" :s="14"/></span></div>
      <h4 v-tip="TIP.cert(st)"><Ic n="cert" :s="16"/> Certification track</h4>
      <div class="certg">
        <div v-for="(sec, s) in cert" :key="s" class="csec"><small>{{ s }}</small>
          <span v-for="c in sec" :key="c.sp" class="csp" v-tip="TIP.certSpace(st, c.s, c.sp)"><Tok v-if="c.who" :w="c.who" :s="12"/><ben v-for="(b, k) in c.b" v-else :key="k" :b="b" :s="11"/></span>
        </div>
      </div>
    </div>`,
};
AdmPanel.methods.tableCards = tableCards;

// ================================================================ your board
export const MeBoard = {
    components: { Ic, Tok, PartChip, DesignTile, CarIc, PgCard, Ben },
    props: ['st'],
    computed: {
        p() { return this.st.p; },
        garages() { return this.p.garages.map((g, i) => ({ ...g, i, open: garageOpen(this.st, i) })); },
        certs() { return D.DEPTS.map((d, i) => ({ d, n: this.p.tr[i], c: this.p.tr[i] >= 3 })); },
    },
    methods: { storeCap, deskCap, slotCap, weekScore },
    template: `<div class="me board-sec">
      <div class="res">
        <span class="r" v-tip="TIP.pp(st)"><Ic n="pp" :s="20" c="var(--c-pp)"/><b>{{ p.pp }}</b><small>PP</small></span>
        <span class="r" v-tip="TIP.bank(st)"><Ic n="bank" :s="20"/><b>{{ p.bank }}</b><small v-if="p.pend.shift">+{{ p.pend.shift }}</small></span>
        <span class="r" v-tip="TIP.books(st)"><Ic n="book" :s="20"/><b>{{ p.books }}</b><small v-if="p.pend.book">+{{ p.pend.book }}</small></span>
        <span class="r" v-tip="TIP.vouchers(st)"><Ic n="voucher" :s="20"/><b>{{ p.vouchers }}</b><small v-if="p.pend.voucher">+{{ p.pend.voucher }}</small></span>
        <span class="r" v-tip="TIP.speech(st)"><Ic n="speech" :s="20"/><b>{{ p.sp }}</b><small>/{{ slotCap(st) }}<template v-if="p.gen"> +{{ p.gen }}g</template><template v-if="p.sgSpeech"> +1★</template></small></span>
      </div>
      <h4 v-tip="TIP.storage(st)"><Ic n="supply" :s="16"/> Parts {{ p.parts.length }}/{{ storeCap(st) }}</h4>
      <div class="row"><part-chip v-for="(x, i) in p.parts" :key="i" :p="x" :st="st"/><span v-for="i in Math.max(0, storeCap(st) - p.parts.length)" :key="'e' + i" class="empty-slot"></span></div>
      <h4 v-tip="TIP.desk(st)"><Ic n="design" :s="16"/> Desk {{ p.desk.length }}/{{ deskCap(st) }}</h4>
      <div class="row"><design-tile v-for="id in p.desk" :key="id" :id="id" :st="st" label/><span v-if="!p.desk.length" class="muted small">No Designs</span></div>
      <h4><Ic n="upgraded" :s="16"/> Upgraded Designs {{ p.upgd.length }}</h4>
      <div class="row"><design-tile v-for="id in p.upgd" :key="id" :id="id" :st="st" up label/><span v-if="!p.upgd.length" class="muted small">None</span></div>
      <h4 v-tip="TIP.weekPreview(st)"><Ic n="garage" :s="16"/> Garages · End of Week now {{ weekScore(st) }} PP</h4>
      <div class="garages">
        <span v-for="g in garages" :key="g.i" class="gar" :class="{ locked: !g.open, full: g.car }" v-tip="TIP.garage(st, g.i)">
          <small>{{ g.i + 1 }}</small>
          <car-ic v-if="g.car" :m="g.car" :s="24"/><Ic v-else-if="!g.open" n="lock" :s="18"/><span v-else class="empty-dot"></span>
          <span v-if="g.tile" class="gtile" :class="{ used: g.flipped }"><Ic :n="T.GARAGE[g.tile].ic" :s="13"/><b v-if="T.GARAGE[g.tile].n">{{ T.GARAGE[g.tile].n }}</b></span>
        </span>
      </div>
      <p v-if="st.opts.delayed && p.aside.length" class="line small"><Ic n="garage" :s="14"/> Tiles beside your board: {{ p.aside.map(x => T.GARAGE[x].txt).join(' · ') }}</p>
      <h4><Ic n="cert" :s="16"/> Training</h4>
      <div class="certs"><span v-for="c in certs" :key="c.d" class="crt" :class="{ on: c.c }" v-tip="TIP.track(st, c.d)"><Ic :n="c.d" :s="16"/><b>{{ c.n }}</b><Ic v-if="c.c" n="check" :s="12"/></span></div>
      <p class="line small" v-if="isCert(st, 'you', 'rd')"><Ic n="upgraded" :s="14"/> Double-Upgrade {{ p.dblUsed ? 'used' : 'ready' }}</p>
      <h4><Ic n="kanban" :s="16"/> Kanban cards</h4>
      <div class="row"><span v-for="k in p.kanban" :key="k" class="kcard" v-tip="TIP.kanbanCard(k)"><span v-for="(r, j) in D.KANBAN[k]" :key="j" class="krow"><part-chip v-for="(x, n) in r" :key="n" :p="x" :s="13"/></span></span></div>
      <h4><Ic n="hand" :s="16"/> Performance Goals in hand</h4>
      <div class="pg-row"><pg-card v-for="id in p.hand" :key="id" :st="st" :id="id"/></div>
      <template v-if="p.chargers">
        <h4><Ic n="charger" :s="16"/> Charging board</h4>
        <div class="chg"><span v-for="(on, i) in p.chargers" :key="i" class="chs" :class="{ on }" v-tip="TIP.charger(st, i)"><Ic :n="on ? 'charger' : D.DEPTS[i]" :s="16"/><small>{{ i + 1 }}</small></span></div>
      </template>
    </div>`,
};
MeBoard.methods.isCert = isCert;

export const BotsBoard = {
    components: { Ic, Tok, PartChip, DesignTile, CarIc },
    props: ['st'],
    computed: {
        bots() {
            const st = this.st;
            return ['L', 'T'].map(w => ({ w, b: st.bots[w], ws: st.pos[w], plan: st.plan.card[w] && D.plan(st.plan.card[w]), sel: st.sel.card[w] && D.sel(st.sel.card[w]) }));
        },
    },
    methods: { certCount },
    template: `<div class="bots board-sec">
      <div v-for="x in bots" :key="x.w" class="botc">
        <h4 v-tip="TIP.bot(st, x.w)"><Tok :w="x.w" :s="18"/> {{ T.WHO[x.w] }} <span class="neg">−{{ x.b.pts }}</span></h4>
        <p class="line small">{{ x.ws === null ? 'Not placed' : T.wsName(x.ws) }}<template v-if="x.plan"> · Plan {{ T.DN[x.plan.d] }}</template><template v-if="x.sel"> · Selection <part-chip :p="x.sel.part" :s="13"/> {{ x.sel.take === 't' ? 'top' : 'bottom' }}</template></p>
        <p class="line small">Training <span v-for="(n, i) in x.b.tr" :key="i" class="tl"><Ic :n="D.DEPTS[i]" :s="13"/>{{ n }}</span> · certified {{ certCount(st, x.w) }}</p>
        <p class="line small"><Ic n="garage" :s="14"/> Cars <car-ic v-for="(m, i) in x.b.cars" :key="i" :m="m" :s="18"/><span v-if="!x.b.cars.length" class="muted">none</span></p>
        <p class="line small"><Ic n="upgraded" :s="14"/> Upgraded this week <design-tile v-for="id in x.b.upgd" :key="id" :id="id" up :s="14"/><span v-if="!x.b.upgd.length" class="muted">none</span></p>
      </div>
      <h4><Ic n="stack" :s="16"/> Shared Design stack {{ st.bots.stack.length }}</h4>
      <div class="row"><design-tile v-for="(id, i) in st.bots.stack" :key="id" :id="id" :s="14" :class="{ next: i === 0 }"/></div>
      <h4><Ic n="supply" :s="16"/> Shared Parts {{ st.bots.parts.length }}/6</h4>
      <div class="row"><part-chip v-for="(p, i) in st.bots.parts" :key="i" :p="p" :st="st"/><span v-if="!st.bots.parts.length" class="muted small">None</span></div>
      <template v-if="st.opts.diff.length">
        <h4><Ic n="difficulty" :s="16"/> Difficulty</h4>
        <p v-for="id in st.opts.diff" :key="id" class="line small" v-tip="TIP.diffCard(id)"><b>{{ id }}</b> {{ D.DIFFICULTY[id - 1].name }}</p>
      </template>
    </div>`,
};

export const GoalsBoard = {
    components: { Ic, PgCard },
    props: ['st'],
    computed: { fg() { return D.fin(this.st.finalGoal); } },
    methods: { finalMet, tableCards, endTriggered },
    template: `<div class="goals board-sec">
      <h4><Ic n="pg" :s="16"/> Meeting room</h4>
      <div class="pg-row"><pg-card v-for="id in tableCards(st)" :key="id" :st="st" :id="id"/></div>
      <h4><Ic n="hand" :s="16"/> Your hand</h4>
      <div class="pg-row"><pg-card v-for="id in st.p.hand" :key="id" :st="st" :id="id"/></div>
      <h4 v-tip="TIP.finalGoal(st)"><Ic n="final" :s="16"/> Final Goal</h4>
      <ul class="fg"><li v-for="(a, i) in fg.a" :key="i" :class="{ met: finalMet(st, a) }"><b>{{ a.pp }}</b> {{ T.finalText(a) }}<ic v-if="finalMet(st, a)" n="check" :s="14"/></li></ul>
      <h4><Ic n="flag" :s="16"/> End of game</h4>
      <p class="line small">Week {{ st.week }}/3 · Production Cycle {{ st.cycle }}/3 · ends at 2 and 3, either way{{ endTriggered(st) ? ': triggered' : '' }}.</p>
    </div>`,
};

export const LogList = {
    components: { Tok },
    props: ['st'],
    computed: { rows() { return this.st.log.slice(-150).reverse(); } },
    template: `<ol class="log">
      <li v-for="(l, i) in rows" :key="i" :class="['w-' + l.w, { pos: l.pp > 0, neg: l.pp < 0 }]"><small>D{{ l.d }}</small><Tok v-if="['you','L','T','S'].includes(l.w)" :w="l.w" :s="11"/>{{ l.text }}</li>
    </ol>`,
};

/** Template globals. */
export function installGlobals(app) {
    app.config.globalProperties.D = D;
    app.config.globalProperties.T = T;
    app.config.globalProperties.TIP = TIP;
}
