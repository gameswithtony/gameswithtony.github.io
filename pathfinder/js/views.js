// Display components: everything you look at (decisions live in prompt.js).
import { icon } from './icons.js';
import * as D from './data.js';
import * as T from './text.js';
import { scoreBreakdown, YOU, PF, lqCap, storageCap, depotCap, techTile, slotCost, progressCount, colonyRow, lssValue, contractMet, goalMet, B } from './engine.js';
import { HEXES } from './hex.js';

export const Ic = {
    props: { n: String, s: { type: Number, default: 20 }, c: String, label: String },
    computed: { html() { return icon(this.n, { size: this.s, color: this.c, label: this.label }); } },
    template: `<span class="ic-w" v-html="html"></span>`,
};

/** icon + number */
export const Chip = {
    components: { Ic },
    props: { n: String, v: [Number, String], cap: Number, s: { type: Number, default: 18 }, label: String, dim: Boolean },
    template: `<span class="chip" :class="{ dim: dim || v === 0 }" :title="label || n"><Ic :n="n" :s="s" :label="label || n"/><b>{{ v }}</b><small v-if="cap !== undefined">/{{ cap }}</small></span>`,
};

/** Colonist slots on an action: circles = you, diamonds = Pathfinder. */
export const Slots = {
    props: { owners: Array, max: { type: Number, default: 3 } },
    computed: {
        cells() { const a = this.owners.map(o => o); while (a.length < this.max) a.push(-1); return a; },
        label() { const y = this.owners.filter(o => o === 0).length, p = this.owners.length - y; return `${y} yours, ${p} Pathfinder's, ${this.max - this.owners.length} free`; },
    },
    template: `<span class="slots" :aria-label="label" role="img"><i v-for="(o,i) in cells" :key="i" :class="o===0?'s-you':o===1?'s-pf':'s-free'"></i></span>`,
};

/** When the shuttle leaves, short and long form. */
function shuttleEta(st) {
    const s = st.shuttle;
    if (s.gone) return { txt: 'gone', long: 'Shuttle is gone', n: null };
    if (st.level >= 5) return { txt: 'last', long: 'Shuttle makes its last flight this round', n: 0 };
    if (st.level === 4) return { txt: 'stop', long: 'Shuttle has stopped (colony level 4)', n: null };
    return s.pos <= 1 ? { txt: 'now', long: 'Shuttle leaves at the end of this round', n: 0 }
        : { txt: `+${s.pos - 1}`, long: `Shuttle leaves after ${s.pos - 1} more round${s.pos > 2 ? 's' : ''}`, n: s.pos - 1 };
}
const shuttleCells = (st, side, order) => order.map(n => ({ n, here: !st.shuttle.gone && st.shuttle.side === side && st.shuttle.pos === n }));

/** Shuttle strip. Always visible; tap the track for the shuttle and turn order sheet. */
export const ShuttleStrip = {
    components: { Ic },
    props: ['st', 'view'],
    emits: ['view', 'open'],
    computed: {
        eta() { return shuttleEta(this.st); },
        orbitCells() { return shuttleCells(this.st, 'orbit', [3, 2, 1]); },
        marsCells() { return shuttleCells(this.st, 'colony', [1, 2, 3]); },
        youSide() { return this.st.p[YOU].side; },
    },
    template: `
<div class="shuttle-strip" role="group" aria-label="Shuttle">
  <button class="side-tab" :class="{ on: view==='orbit', here: youSide==='orbit' }" @click="$emit('view','orbit')" :aria-pressed="view==='orbit'">
    <Ic n="orbit" :s="18"/><span>Orbit</span>
  </button>
  <button type="button" class="track" @click="$emit('open')" :aria-label="eta.long + '. Open shuttle and turn order.'" :title="eta.long">
    <span class="lane orbit">
      <span v-for="c in orbitCells" :key="'o'+c.n" class="cell" :class="{ here: c.here, red: c.n===1 }">
        <Ic v-if="c.here" n="ship" :s="18" c="var(--primary-bright)" label="Shuttle"/><i v-else>{{ c.n }}</i>
      </span>
    </span>
    <span class="eta" :class="{ now: eta.n===0 }"><Ic n="clock" :s="13"/>{{ eta.txt }}</span>
    <span class="lane mars">
      <span v-for="c in marsCells" :key="'m'+c.n" class="cell" :class="{ here: c.here, red: c.n===1 }">
        <Ic v-if="c.here" n="ship" :s="18" c="var(--primary-bright)" label="Shuttle"/><i v-else>{{ c.n }}</i>
      </span>
    </span>
  </button>
  <button class="side-tab" :class="{ on: view==='colony', here: youSide==='colony' }" @click="$emit('view','colony')" :aria-pressed="view==='colony'">
    <Ic n="mars" :s="18" c="var(--mars-1)"/><span>Mars</span>
  </button>
</div>`,
};

/** The shuttle track at full size, and the turn order spaces with who sits where. */
export const ShuttleBoard = {
    components: { Ic },
    props: ['st'],
    computed: {
        eta() { return shuttleEta(this.st); },
        orbitCells() { return shuttleCells(this.st, 'orbit', [3, 2, 1]); },
        marsCells() { return shuttleCells(this.st, 'colony', [1, 2, 3]); },
        sides() {
            const sp = n => {
                const who = this.st.p.findIndex(p => p.space === n), ben = D.TURN_SPACES[n];
                return { n, who, ben: ben ? T.SPACE[ben] : null, done: who >= 0 && this.st.p[who].done };
            };
            return [{ k: 'orbit', name: 'Orbit', ic: 'orbit', spaces: [1, 2, 3, 4].map(sp) }, { k: 'colony', name: 'Mars', ic: 'mars', spaces: [5, 6, 7, 8].map(sp) }];
        },
    },
    template: `
<div class="shuttle-board">
  <section class="panel">
    <h3><Ic n="shuttle" :s="16"/> Shuttle <small class="muted">{{ eta.long }}</small></h3>
    <div class="sb-track" v-tip="TIP.shuttle(st, eta)">
      <span class="sb-end"><Ic n="orbit" :s="18"/>Orbit</span>
      <span class="lane orbit"><span v-for="c in orbitCells" :key="'o'+c.n" class="cell" :class="{ here: c.here, red: c.n===1 }"><Ic v-if="c.here" n="ship" :s="20" c="var(--primary-bright)" label="Shuttle"/><i v-else>{{ c.n }}</i></span></span>
      <span class="lane mars"><span v-for="c in marsCells" :key="'m'+c.n" class="cell" :class="{ here: c.here, red: c.n===1 }"><Ic v-if="c.here" n="ship" :s="20" c="var(--primary-bright)" label="Shuttle"/><i v-else>{{ c.n }}</i></span></span>
      <span class="sb-end"><Ic n="mars" :s="18" c="var(--mars-1)"/>Mars</span>
    </div>
    <p class="muted small">Moves down one space each round and leaves from space 1.</p>
  </section>
  <section class="panel">
    <h3><Ic n="clock" :s="16"/> Turn order <small class="muted">lower goes first</small></h3>
    <div class="sb-order">
      <div v-for="side in sides" :key="side.k" class="sb-col" :class="side.k">
        <h4><Ic :n="side.ic" :s="14"/>{{ side.name }}</h4>
        <div v-for="s in side.spaces" :key="s.n" class="sb-space" :class="{ taken: s.who >= 0, done: s.done }" v-tip="TIP.turnSpace(st, s)">
          <b class="num">{{ s.n }}</b>
          <span class="who">
            <template v-if="s.who === 0"><Ic n="you" :s="16" c="var(--c-you)"/>You</template>
            <template v-else-if="s.who === 1"><Ic n="pf" :s="16" c="var(--c-pf)"/>Pathfinder</template>
            <small v-if="s.done" class="muted">played</small>
          </span>
          <span class="ben"><template v-if="s.ben"><Ic :n="s.ben.ic" :s="14"/><small>{{ s.ben.long }}</small></template><small v-else class="muted">no bonus</small></span>
        </div>
      </div>
    </div>
  </section>
</div>`,
};

/** LSS gauge: one bar per life-support type, with the colony line. Tap for the full board. */
export const LssWidget = {
    components: { Ic },
    props: ['st'],
    emits: ['open'],
    computed: {
        cols() {
            return D.LSS_TYPES.map((t, i) => {
                const n = this.st.lss[t], tile = this.st.lssTiles[i];
                const below = n < colonyRow(this.st);
                return { t, n, below, first: n === 1, tile, tl: T.LSS_TILE[tile], op: lssValue(this.st, YOU, tile), ic: T.TYPE_IC[t] };
            });
        },
        row() { return colonyRow(this.st); },
    },
    template: `
<button type="button" class="lss-strip" @click="$emit('open')" :aria-label="'Life support, colony level ' + st.level + '. Open the full board.'">
  <span class="lss-lv"><Ic n="level" :s="16"/><b>{{ st.level }}</b></span>
  <span v-for="c in cols" :key="c.t" class="lss-item" :class="{ hot: c.below }">
    <Ic :n="c.ic" :s="16"/>
    <span class="lss-seg"><i v-for="r in 6" :key="r" :class="{ on: r <= c.n, line: r === row }"></i></span>
    <span class="lss-rew"><Ic :n="c.tl.ic" :s="11"/><b v-if="c.below">+{{ c.op + (c.first?2:0) }}</b><Ic v-else n="lock" :s="10"/></span>
  </span>
  <span class="lss-more" aria-hidden="true"><Ic n="eye" :s="14"/></span>
</button>`,
};

/** The whole life-support board: track, reward tiles for both players, and what each colony level brings. */
export const LssBoard = {
    components: { Ic },
    props: ['st'],
    computed: {
        line() { return colonyRow(this.st); },
        cols() {
            return D.LSS_TYPES.map((t, i) => {
                const n = this.st.lss[t], tile = this.st.lssTiles[i], open = n < this.line, bonus = n === 1 ? 2 : 0;
                return {
                    t, n, tile, open, tl: T.LSS_TILE[tile], name: D.BUILD_NAMES[t], ic: T.TYPE_IC[t], cost: D.BUILD_COST[t], makes: D.PRODUCES[t],
                    need: Math.max(0, this.line - n), you: lssValue(this.st, YOU, tile) + bonus, pf: lssValue(this.st, PF, tile) + bonus,
                };
            });
        },
        need() { return this.cols.reduce((s, c) => s + c.need, 0); },
        levels() {
            return [1, 2, 3, 4, 5].map(L => ({
                L, now: L === this.st.level, past: L < this.st.level,
                progress: L === 2 || L === 3,
                missions: [3, 3, 2, 1, 0][L - 1],
                shuttle: L <= 3 ? L : L === 4 ? 'stop' : 'last',
                bp: L === 1 ? 'I' : L === 2 ? 'I·III' : 'III',
                pfDisc: L >= 2 && L <= 4 ? (this.st.pfDisc[L + 1] || []).length : null,
            }));
        },
        bens() { return D.LSS_BENEFITS.map(k => T.LSS_BEN[k]); },
    },
    template: `
<div class="lss-board">
  <section class="panel">
    <h3><Ic n="lss" :s="16"/> Track <small class="muted">colony level {{ st.level }}</small></h3>
    <div class="lssb-grid">
      <span></span>
      <span v-for="c in cols" :key="'h'+c.t" class="lssb-head" v-tip="TIP.lssHead(c)">
        <Ic :n="c.ic" :s="20"/><span class="nm">{{ c.name }}</span>
        <span class="flow"><Ic :n="c.cost" :s="13" :label="'costs 1 ' + c.cost"/><Ic n="arrow" :s="10"/><Ic :n="c.makes" :s="13" :label="'makes ' + c.makes"/></span>
      </span>

      <span class="lssb-rl" aria-hidden="true"><Ic n="op" :s="14"/></span>
      <span v-for="c in cols" :key="'t'+c.t" class="lssb-tile" :class="{ open: c.open }" v-tip="TIP.lssTile(c)">
        <Ic :n="c.tl.ic" :s="20"/>
        <span class="txt">{{ c.tl.long }}</span>
        <span class="vals">
          <span><Ic n="you" :s="11" c="var(--c-you)"/>{{ c.you }}</span>
          <span><Ic n="pf" :s="11" c="var(--c-pf)"/>{{ c.pf }}</span>
        </span>
        <Ic v-if="!c.open" n="lock" :s="12" c="var(--muted)"/>
      </span>

      <template v-for="r in [6,5,4,3,2,1]" :key="r">
        <span class="lssb-rl" :class="{ line: r === line }">
          <template v-if="r === line"><Ic n="level" :s="12"/>{{ st.level < 5 ? st.level + 1 : '' }}</template>
          <template v-else>{{ r }}</template>
        </span>
        <span v-for="c in cols" :key="c.t + r" class="lssb-cell"
              :class="{ on: r < c.n, mark: r === c.n, line: r === line, over: r > line && r > c.n }">
          <Ic v-if="r === c.n" :n="c.ic" :s="16" :label="c.n + ' built'"/>
          <template v-else-if="r === 2 && c.n === 1">+2</template>
        </span>
      </template>

      <span></span>
      <span v-for="c in cols" :key="'n'+c.t" class="lssb-need" :class="{ ok: !c.need }" v-tip="TIP.lssNeed(c, st)">
        <template v-if="c.need"><b>{{ c.need }}</b> to go</template><Ic v-else n="check" :s="14" label="at the line"/>
      </span>
    </div>
    <p class="hint" v-if="st.level < 5"><Ic n="level" :s="14"/> Level {{ st.level + 1 }} when every column reaches the line: <b>{{ need }}</b> more build{{ need === 1 ? '' : 's' }}.</p>
    <p class="hint" v-else><Ic n="level" :s="14"/> Top colony level reached.</p>
    <p class="lssb-key muted small">
      <span><i class="sw mark"></i>marker</span>
      <span><i class="sw line"></i>colony line</span>
      <span><i class="sw over"></i>past the line: no reward</span>
      <span><b class="op2">+2</b>first build of a type</span>
    </p>
  </section>

  <section class="panel">
    <h3><Ic n="lss" :s="16"/> Reward bonus <small class="muted">pick 1</small></h3>
    <div class="ware">
      <span v-for="b in bens" :key="b.ic" class="chip" v-tip="TIP.lssBenefit(b)"><Ic :n="b.ic" :s="18"/><small>{{ b.long }}</small></span>
    </div>
    <p class="muted small">Take one after scoring a reward tile. Mines and shelters don't move the track.</p>
  </section>

  <section class="panel">
    <h3><Ic n="level" :s="16"/> Colony levels</h3>
    <div class="lv-grid">
      <span class="hd">Lv</span>
      <span class="hd" title="Progress area scores"><Ic n="op" :s="15" label="Progress scores"/></span>
      <span class="hd" title="Missions needed to end the game"><Ic n="mission" :s="15" label="Missions to end"/></span>
      <span class="hd" title="Shuttle lands on space"><Ic n="shuttle" :s="15" label="Shuttle"/></span>
      <span class="hd" title="Blueprint display"><Ic n="blueprint" :s="15" label="Blueprints"/></span>
      <span class="hd" title="Ship limit"><Ic n="ship" :s="15" label="Ship limit"/></span>
      <span class="hd" title="Pathfinder discovery tiles"><Ic n="pf" :s="12" c="var(--c-pf)"/><Ic n="discovery" :s="15" label="Pathfinder discovery tiles"/></span>
      <template v-for="l in levels" :key="l.L">
        <span class="lv" :class="{ now: l.now, past: l.past }" v-tip="TIP.level(l, 'L')"><b>{{ l.L }}</b></span>
        <span :class="{ now: l.now, past: l.past }" v-tip="TIP.level(l, 'progress')"><Ic v-if="l.progress" n="check" :s="14" label="yes"/><i v-else>–</i></span>
        <span :class="{ now: l.now, past: l.past }" v-tip="TIP.level(l, 'missions')"><template v-if="l.missions">{{ l.missions }}</template><template v-else>end</template></span>
        <span :class="{ now: l.now, past: l.past }" v-tip="TIP.level(l, 'shuttle')">{{ l.shuttle }}</span>
        <span :class="{ now: l.now, past: l.past }" v-tip="TIP.level(l, 'bp')">{{ l.bp }}</span>
        <span :class="{ now: l.now, past: l.past }" v-tip="TIP.level(l, 'ships')">{{ l.L }}</span>
        <span :class="{ now: l.now, past: l.past }" v-tip="TIP.level(l, 'pfDisc')"><template v-if="l.pfDisc !== null">{{ l.pfDisc }}</template><i v-else>–</i></span>
      </template>
    </div>
    <p class="lssb-key muted small">
      <span><Ic n="op" :s="12"/>progress scores</span>
      <span><Ic n="mission" :s="12"/>missions to end</span>
      <span><Ic n="shuttle" :s="12"/>shuttle stop</span>
      <span><Ic n="blueprint" :s="12"/>blueprint levels</span>
      <span><Ic n="ship" :s="12"/>ship limit</span>
      <span><Ic n="discovery" :s="12"/>Pathfinder tiles</span>
    </p>
    <p class="muted small">Each level up refills the warehouse to 2 of each.</p>
  </section>
</div>`,
};

/** Orbit station: actions, tech grid, warehouse, blueprints, exploration. */
export const OrbitView = {
    components: { Ic, Chip, Slots },
    props: ['st'],
    emits: ['card'],
    computed: {
        actions() {
            return D.ACTIONS_ORBIT.map(k => ({ k, ...T.ACTION[k], slots: D.SLOT_ACTIONS.includes(k) ? this.st.slots[k] : null, boost: D.BOOST_ACTIONS.includes(k) }));
        },
        grid() {
            return this.st.grid.map((t, i) => ({ t, i, cost: D.GRID_COST[i], owner: null }));
        },
        owned() {
            const out = [];
            for (const pi of [YOU, PF]) for (const pos in this.st.p[pi].lab) { const t = this.st.p[pi].lab[pos]; if (t !== 'shelter') out.push({ t, pi, lvl: +pos[0] }); }
            return out;
        },
    },
    methods: {
        tic(t) { return T.TECH_IC[t]; },
        bpOf(id) { return D.bp(id); },
        typeIc(t) { return T.TYPE_IC[t]; },
        discIc(id) { const d = D.disc(id); return d.k === 'build' ? T.TYPE_IC[d.b] : d.k === 'gain' ? d.g : { buildAny: 'upgrade', develop2: 'develop', blueprints2: 'blueprint', tech1: 'tech', upgrade2: 'adv', hire: 'scientist', warehouse2: 'warehouse' }[d.k]; },
        discTxt(id) { const d = D.disc(id); return d.k === 'gain' ? '×' + d.n : T.DISC[d.k]; },
    },
    template: `
<div class="orbit-view">
  <section class="panel">
    <h3><Ic n="orbit" :s="16"/> Station</h3>
    <div class="act-row">
      <div v-for="a in actions" :key="a.k" class="act-card" v-tip="TIP.action(st, a.k)">
        <Ic :n="a.ic" :s="24"/><span class="nm">{{ a.name }}</span>
        <Slots v-if="a.slots" :owners="a.slots"/>
        <span v-if="a.boost" class="boost-tag" title="Boostable with colonists"><Ic n="boost" :s="12"/></span>
      </div>
    </div>
  </section>
  <section class="panel">
    <h3><Ic n="tech" :s="16"/> Tech grid</h3>
    <div class="techgrid">
      <div v-for="row in [[0,1,2],[3,4,5],[6,7]]" class="tg-row">
        <span class="tg-cost" v-tip="TIP.gridCost(grid[row[0]].cost)"><template v-if="grid[row[0]].cost.length"><Ic v-for="(c,j) in grid[row[0]].cost" :key="j" :n="c" :s="13"/></template><small v-else>free</small></span>
        <div v-for="i in row" :key="i" class="tg-cell" :class="{ empty: !grid[i].t }" v-tip="grid[i].t ? TIP.gridTech(grid[i].t, grid[i].cost) : null">
          <template v-if="grid[i].t"><Ic :n="tic(grid[i].t)" :s="22"/><small>{{ TN[grid[i].t] }}</small></template>
        </div>
      </div>
    </div>
    <div class="owned" v-if="owned.length">
      <span v-for="o in owned" :key="o.t" class="own-chip" :class="o.pi===0?'you':'pf'" v-tip="TIP.ownedTech(o.t, o.pi, o.lvl)">
        <Ic :n="o.pi===0?'you':'pf'" :s="11" :c="o.pi===0?'var(--c-you)':'var(--c-pf)'"/><Ic :n="tic(o.t)" :s="14"/><b>{{ o.lvl }}</b>
      </span>
    </div>
  </section>
  <section class="panel">
    <h3><Ic n="warehouse" :s="16"/> Warehouse</h3>
    <div class="ware">
      <Chip v-for="w in ['crystal','battery','water','plant','oxygen']" :key="w" :n="w" :v="st.ware[w]" :s="20" :label="w" v-tip="TIP.warehouse(w, st.ware[w])"/>
    </div>
  </section>
  <section class="panel">
    <h3><Ic n="blueprint" :s="16"/> Blueprints <small class="muted">{{ st.bpDeck.length }} in deck</small></h3>
    <div class="bp-rows">
      <div class="bp-row" v-for="(row,ri) in [st.bpTop, st.bpBot]" :key="ri" v-show="row.some(Boolean) || ri===1">
        <button v-for="(id,i) in row" :key="i" class="bp-mini" :class="{ empty: !id, l3: id && bpOf(id).lvl===3 }" :disabled="!id" @click="id && $emit('card', { k: 'bp', id })" :aria-label="id ? bpOf(id).name : 'empty'">
          <template v-if="id">
            <Ic :n="typeIc(bpOf(id).type)" :s="18"/>
            <b class="lvl">{{ bpOf(id).lvl===3 ? 'III' : 'I' }}</b>
          </template>
        </button>
      </div>
    </div>
  </section>
  <section class="panel">
    <h3><Ic n="discovery" :s="16"/> Exploration <small class="muted">{{ st.discStack.length }} left</small></h3>
    <div class="explore">
      <div v-for="id in st.explore" :key="id" class="disc-card" v-tip="TIP.discovery(id)"><Ic :n="discIc(id)" :s="22"/><small>{{ discTxt(id) }}</small></div>
    </div>
  </section>
</div>`,
};

/** Colony actions strip (above the map). */
export const ColonyStrip = {
    components: { Ic, Slots },
    props: ['st'],
    computed: {
        actions() { return D.ACTIONS_COLONY.map(k => ({ k, ...T.ACTION[k], slots: D.SLOT_ACTIONS.includes(k) ? this.st.slots[k] : null, max: k === 'hire' ? 2 : 3, boost: D.BOOST_ACTIONS.includes(k) })); },
    },
    template: `
<div class="colony-strip" aria-label="Colony actions">
  <div v-for="a in actions" :key="a.k" class="act-card sm" v-tip="TIP.action(st, a.k)">
    <Ic :n="a.ic" :s="20"/><span class="nm">{{ a.name }}</span>
    <Slots v-if="a.slots" :owners="a.slots" :max="a.max"/>
  </div>
</div>`,
};

/** Scientists & contracts display + missions. */
export const CardsPanel = {
    components: { Ic, Chip },
    props: ['st'],
    emits: ['card'],
    methods: {
        sci(id) { return D.sci(id); }, con(id) { return D.contract(id); }, mis(id) { return D.mission(id); },
        typeIc(t) { return T.TYPE_IC[t]; },
        costList(c) { return Object.entries(c).map(([k, n]) => ({ k: k === 'colonists' ? 'colonist' : k, n })); },
        needList(c) { return Object.entries(c.need || {}).map(([k, n]) => ({ k, n })); },
    },
    template: `
<div class="cards-panel">
  <section class="panel">
    <h3><Ic n="mission" :s="16"/> Missions <small class="muted">{{ st.remaining }} to end</small></h3>
    <div class="missions">
      <div v-for="m in st.missions" :key="m.id" class="mission" :class="{ done: m.done }" v-tip="TIP.mission(st, m)">
        <span class="m-at">{{ m.at }}</span>
        <span class="m-name">{{ mis(m.id).name }}</span>
        <span class="m-left" :aria-label="m.left + ' to go'"><b>{{ m.done ? '✓' : m.left }}</b></span>
        <span class="m-gain"><Ic n="crystal" :s="13"/>{{ mis(m.id).gain }}</span>
      </div>
    </div>
  </section>
  <section class="panel">
    <h3><Ic n="scientist" :s="16"/> Scientists &amp; contracts</h3>
    <div class="sci-row">
      <button v-for="(s,i) in st.sciSlots" :key="i" class="sci-card" :class="{ empty: !s.s && !s.c }" @click="s.s ? $emit('card', { k: 'sci', id: s.s }) : s.c && $emit('card', { k: 'con', id: s.c })">
        <template v-if="s.s">
          <b class="nm">{{ sci(s.s).name }}</b>
          <span class="row"><small>works</small><Ic :n="typeIc(sci(s.s).works)" :s="16"/><small>scores</small><Ic :n="typeIc(sci(s.s).scores)" :s="16"/></span>
          <span class="row cost"><span v-for="c in costList(sci(s.s).cost)" :key="c.k"><Ic :n="c.k" :s="14"/>{{ c.n }}</span></span>
        </template>
        <template v-else-if="s.c">
          <span class="row"><Ic n="contract" :s="16"/><b>#{{ s.c }}</b></span>
          <span class="row" v-if="con(s.c).up"><Ic n="adv" :s="14"/><Ic :n="typeIc(con(s.c).up)" :s="16"/><small>4+</small></span>
          <span class="row" v-else><span v-for="c in needList(con(s.c))" :key="c.k"><Ic :n="c.k" :s="14"/>{{ c.n }}</span></span>
          <span class="row pts"><b class="pos">+{{ con(s.c).win }}</b><b class="neg">−{{ con(s.c).lose }}</b></span>
          <span class="row cost"><Ic n="crystal" :s="13"/>1</span>
        </template>
      </button>
    </div>
  </section>
</div>`,
};

/** A player's board: storage, colonists, lab, executive actions, cards, score. */
export const PlayerBoard = {
    components: { Ic, Chip },
    props: ['st', 'pi', 'interactive'],
    emits: ['deliver', 'card'],
    computed: {
        p() { return this.st.p[this.pi]; },
        isPF() { return this.pi === PF; },
        sc() { return scoreBreakdown(this.st, this.pi, false); },
        cap() { return storageCap(this.st, this.pi); },
        lab() {
            return D.LAB.map(l => ({ ...l, tech: this.p.lab[l.k] || null, ben: l.ben ? T.LAB_BEN[l.ben] : null }));
        },
        cols() { return [1, 2, 3, 4, 5, 6].map(c => ({ c, cost: D.LAB_COST[c] || [], op: D.LAB_OP[c], spaces: this.lab.filter(l => l.col === c) })); },
        exec() { return D.EXEC.map((e, i) => ({ ...e, i, ...T.EXEC[e.k], locked: this.p.ships.includes(i) })); },
        progress() { return ['mine', 'gen', 'water', 'green', 'oxy'].map(t => ({ t, on: !!this.p.progress[t], ic: T.TYPE_IC[t] })); },
        mineWorkers() { return HEXES.filter(h => B(this.st, h)?.type === 'mine' && B(this.st, h).col === this.pi).length; },
        solo() { const s = this.st.solo; return { left: s.deck.length, disc: s.discard.length, card: s.card && D.solo(s.card), ex: s.exhausted }; },
        pfDisc() { return [3, 4, 5].map(r => ({ r, n: (this.st.pfDisc[r] || []).length, lvl: r - 1 })); },
    },
    methods: {
        tic(t) { return T.TECH_IC[t]; }, bpOf(id) { return D.bp(id); }, typeIc(t) { return T.TYPE_IC[t]; },
        sci(id) { return D.sci(id); }, con(id) { return D.contract(id); },
        needList(c) { return Object.entries(D.contract(c.id).need || {}).map(([k, n]) => ({ k, n, have: c.del[k] || 0 })); },
        met(c) { return contractMet(this.st, this.pi, c); },
        goalTxt(id) { return T.GOAL[D.GOALS[id - 1].k]; },
        goalOk(id) { return goalMet(this.st, id); },
        canGive(k) { return this.interactive && (k === 'crystal' ? this.p.cr > 0 : this.p.res[k] > 0); },
        sciHome(id) { const b = this.st.sciLoc[id]; return b ? D.bp(b).name : null; },
    },
    template: `
<div class="pboard" :class="isPF ? 'pf' : 'you'">
  <div class="pb-score">
    <Ic :n="isPF?'pf':'you'" :s="22" :c="isPF?'var(--c-pf)':'var(--c-you)'"/>
    <b class="tot" v-tip="TIP.score(st, pi)">{{ sc.total }}</b><small>OP now</small>
    <span class="pb-break" aria-label="Score breakdown">
      <span v-for="(ic, k) in PART_IC" :key="k" v-tip="TIP.scorePart(st, pi, k)"><Ic :n="ic" :s="12"/>{{ sc[k] }}</span>
    </span>
  </div>

  <section v-if="!isPF" class="panel">
    <h3>Storage <small class="muted">cap {{ cap }}</small></h3>
    <div class="store">
      <Chip v-for="r in ['mineral','battery','water','plant','oxygen']" :key="r" :n="r" :v="p.res[r]" :cap="cap" :s="22" :label="r" v-tip="TIP.stored(st, pi, r)"/>
      <span class="chip depot" v-tip="TIP.crystals(p)"><Ic n="crystal" :s="22" label="crystal"/><b>{{ p.cr }}</b><small>/{{ 8 - p.ships.length }}</small><em v-if="p.crP" title="Arrive next turn">+{{ p.crP }}</em></span>
    </div>
    <div class="colonists">
      <span class="chip" v-tip="TIP.colonists(st, pi, 'lq', p.col.lq)"><Ic n="colonist" :s="20" label="At home"/><b>{{ p.col.lq }}</b><small>/{{ lqCapV }}</small></span>
      <span class="chip" v-tip="TIP.colonists(st, pi, 'wa', p.col.wa)"><Ic n="hand" :s="18" label="Working area"/><b>{{ p.col.wa }}</b></span>
      <span class="chip dim" v-tip="TIP.colonists(st, pi, 'sup', p.col.sup)"><Ic n="colonist" :s="16" c="var(--muted)" label="Supply"/><b>{{ p.col.sup }}</b></span>
      <span class="chip" v-tip="TIP.colonists(st, pi, 'mine', mineWorkers)"><Ic n="mine" :s="18" label="Miners"/><b>{{ mineWorkers }}</b></span>
    </div>
  </section>

  <section class="panel">
    <h3><Ic n="tech" :s="16"/> Lab</h3>
    <div class="lab" role="group" aria-label="Laboratory">
      <div v-for="col in cols" :key="col.c" class="lab-col">
        <div class="lab-cost" v-tip="TIP.labCol(col)"><b>+{{ col.c }}</b><span><Ic v-for="(c,j) in col.cost" :key="j" :n="c" :s="11"/></span></div>
        <div class="lab-spaces" :class="'n' + col.spaces.length">
          <div v-for="s in col.spaces" :key="s.k" class="lab-hex" :class="{ full: s.tech, mine: s.tech && !isPF, theirs: s.tech && isPF }" v-tip="TIP.labSpace(s, col.c, pi)">
            <Ic v-if="s.tech" :n="tic(s.tech)" :s="20"/>
            <Ic v-else-if="s.ben" :n="s.ben" :s="13" c="var(--muted)"/>
          </div>
        </div>
        <div class="lab-op" v-tip="TIP.labCol(col)">{{ col.op }}</div>
      </div>
    </div>
  </section>

  <section v-if="!isPF" class="panel">
    <h3><Ic n="exec" :s="16"/> Executive <small class="muted">{{ p.hangar }} ship{{ p.hangar===1?'':'s' }} in hangar</small></h3>
    <div class="exec-list">
      <div v-for="e in exec" :key="e.i" class="exec" :class="{ locked: e.locked }" v-tip="TIP.exec(e, p)">
        <Ic :n="e.locked ? 'ship' : e.ic" :s="18"/>
        <span class="nm">{{ e.name }}</span>
        <span class="cost"><Ic n="crystal" :s="12"/>{{ e.cost }}<small v-if="e.k==='adv'">/sci</small></span>
      </div>
    </div>
  </section>

  <section class="panel" v-if="isPF">
    <h3><Ic n="deck" :s="16"/> Solo deck</h3>
    <div class="solo-info">
      <span class="chip" v-tip="TIP.soloDeck(solo)"><Ic n="deck" :s="18"/><b>{{ solo.left }}</b><small>left</small></span>
      <span class="chip" v-if="solo.ex" v-tip="TIP.soloDeck(solo)"><Ic n="mission" :s="18"/><small>missions move</small></span>
      <span class="chip" v-tip="TIP.pfShips(p)"><Ic n="ship" :s="18"/><b>{{ p.hangar }}</b></span>
      <span class="chip" v-tip="TIP.pfColonists(st)"><Ic n="colonist" :s="18"/><b>{{ lqCapV }}</b></span>
    </div>
    <div class="pf-lss">
      <span v-for="d in pfDisc" :key="d.r" class="chip" :class="{ dim: !d.n }" v-tip="TIP.pfDisc(d)"><Ic n="level" :s="13"/><small>Lv{{ d.lvl }}</small><Ic n="discovery" :s="15"/><b>{{ d.n }}</b></span>
    </div>
  </section>

  <section class="panel">
    <h3><Ic n="level" :s="16"/> Progress</h3>
    <div class="progress">
      <span v-for="g in progress" :key="g.t" class="prog" :class="{ on: g.on }" v-tip="TIP.progress(g)"><Ic :n="g.ic" :s="16"/><i></i></span>
    </div>
  </section>

  <section class="panel">
    <h3><Ic n="blueprint" :s="16"/> Blueprints <small class="muted">{{ p.ab }} markers left</small></h3>
    <div class="bp-list">
      <button v-for="b in p.bps" :key="b.id" class="bp-line" :class="{ built: b.h }" @click="$emit('card', { k: 'bp', id: b.id })">
        <Ic :n="typeIc(bpOf(b.id).type)" :s="16"/><span class="nm">{{ bpOf(b.id).name }}</span>
        <b class="lvl">{{ bpOf(b.id).lvl===3?'III':'I' }}</b>
        <Ic v-if="b.h" n="adv" :s="14" :c="isPF?'var(--c-pf)':'var(--c-you)'" label="built"/><small v-else class="neg">{{ isPF ? '' : (bpOf(b.id).lvl===3?'−5':'−3') }}</small>
      </button>
      <p v-if="!p.bps.length" class="muted">None</p>
    </div>
  </section>

  <section class="panel" v-if="p.scis.length || p.contracts.length">
    <h3><Ic n="scientist" :s="16"/> Scientists &amp; contracts</h3>
    <div v-for="s in p.scis" :key="s" class="sci-line tip" role="button" tabindex="0" @click="$emit('card', { k: 'sci', id: s })" @keydown.enter="$emit('card', { k: 'sci', id: s })">
      <b>{{ sci(s).name }}</b><small>works</small><Ic :n="typeIc(sci(s).works)" :s="15"/><small>scores</small><Ic :n="typeIc(sci(s).scores)" :s="15"/>
      <small v-if="sciHome(s)" class="muted">@ {{ sciHome(s) }}</small>
    </div>
    <div v-for="(c,ci) in p.contracts" :key="c.id" class="con-line" :class="{ ok: c.done || met(c) || isPF }">
      <button class="con-id tip" @click="$emit('card', { k: 'con', id: c.id })" :aria-label="'Contract ' + c.id"><Ic n="contract" :s="15"/><b>#{{ c.id }}</b></button>
      <template v-if="con(c.id).up"><Ic n="adv" :s="13"/><Ic :n="typeIc(con(c.id).up)" :s="15"/><small>4+</small></template>
      <template v-else>
        <span v-for="n in needList(c)" :key="n.k" class="need" v-tip="TIP.need(st, pi, c, n)"><Ic :n="n.k" :s="14"/>{{ n.have }}/{{ n.n }}
          <button v-if="!isPF && n.have < n.n && canGive(n.k)" class="mini" @click="$emit('deliver', { c: ci, item: n.k })" :aria-label="'Deliver ' + n.k">+</button>
        </span>
      </template>
      <b class="pos">+{{ con(c.id).win }}</b><b class="neg" v-if="!isPF">−{{ con(c.id).lose }}</b>
    </div>
  </section>

  <section class="panel" v-if="!isPF">
    <h3><Ic n="goal" :s="16"/> Private goals</h3>
    <div v-if="p.goalDone" class="goal done" v-tip="TIP.goal(p.goalDone, true, true)"><Ic n="check" :s="14"/>{{ goalTxt(p.goalDone) }}</div>
    <div v-for="g in p.goals" :key="g" class="goal" :class="{ ok: goalOk(g) }" v-tip="TIP.goal(g, goalOk(g), false)"><Ic :n="goalOk(g)?'check':'goal'" :s="14"/>{{ goalTxt(g) }}</div>
    <p class="muted small">A goal card can also pay for 1 crystal.</p>
  </section>
</div>`,
};
PlayerBoard.computed.lqCapV = function () { return lqCap(this.st, this.pi); };
PlayerBoard.computed.PART_IC = () => ({ game: 'op', tech: 'tech', blueprints: 'blueprint', colonists: 'colonist', ships: 'ship', progress: 'level', scientists: 'scientist', contracts: 'contract' });

export const LogPanel = {
    components: { Ic },
    props: ['st'],
    computed: {
        rounds() {
            const out = [];
            for (const e of [...this.st.log].reverse()) {
                let r = out.find(x => x.r === e.r);
                if (!r) { r = { r: e.r, items: [] }; out.push(r); }
                r.items.push(e);
            }
            return out;
        },
    },
    methods: {
        ic(e) {
            const m = { build: 'shelter', bp: 'blueprint', tech: 'tech', develop: 'develop', ware: 'warehouse', sci: 'scientist', contract: 'contract', upgrade: 'upgrade', bots: 'bot', bot: 'bot', ship: 'ship', travel: 'travel', space: 'clock', mission: 'mission', lss: 'lss', progress: 'level', level: 'level', disc: 'discovery', research: 'research', exec: 'exec', adv: 'adv', goal: 'goal', retrieve: 'retrieve', shuttle: 'shuttle', round: 'clock', final: 'trophy', end: 'flag', start: 'flag', shuffle: 'deck', deliver: 'contract', clear: 'colonist', lost: 'lock' };
            return m[e.k] || T.ACTION[e.k]?.ic || 'arrow';
        },
    },
    template: `
<div class="log">
  <div v-for="r in rounds" :key="r.r" class="log-round">
    <h4>Round {{ r.r }}</h4>
    <ul>
      <li v-for="(e,i) in r.items" :key="i" :class="e.w">
        <Ic :n="e.w==='pf'?'pf':e.w==='you'?'you':'orbit'" :s="13" :c="e.w==='pf'?'var(--c-pf)':e.w==='you'?'var(--c-you)':'var(--muted)'"/>
        <Ic :n="ic(e)" :s="14"/><span>{{ e.text }}</span>
      </li>
    </ul>
  </div>
</div>`,
};
OrbitView.computed.TN = () => T.TECH_NAME;
