// The decision dock: renders whatever the engine is asking and sends back the answer.
import * as D from './data.js';
import * as T from './text.js';
import { Ic, Chip, Slots } from './views.js';
import { YOU, PF, slotCost, techTile, lssValue } from './engine.js';
import * as TIP from './tips.js';

export const PromptDock = {
    components: { Ic, Chip, Slots },
    props: ['st', 'prompt', 'canUndo'],
    emits: ['answer', 'undo', 'card', 'tip'],
    data() { return { num: 0, explain: false, collapsed: false }; },
    watch: { prompt: { immediate: true, handler(p) { this.explain = false; this.collapsed = false; if (p && p.kind === 'num') this.num = p.def ?? 0; } } },
    computed: {
        pr() { return this.prompt; },
        q() { return this.pr.kind === 'menu' ? 'menu' : this.pr.q || this.pr.kind; },
        title() { const t = T.TITLE[this.q] || ['help', '']; return { ic: t[0], txt: t[1] }; },
        you() { return this.st.p[YOU]; },
        mainTiles() {
            return this.pr.main.map(m => {
                const a = T.ACTION[m.k];
                const cost = D.SLOT_ACTIONS.includes(m.k) ? slotCost(this.st, m.k, YOU) : 0;
                return { ...m, ...a, slot: D.SLOT_ACTIONS.includes(m.k), cost, boost: D.BOOST_ACTIONS.includes(m.k), owners: this.st.slots[m.k], max: m.k === 'hire' ? 2 : 3, blockTxt: m.why ? T.BLOCK[m.why] : '' };
            });
        },
        execOpen() { return this.pr.exec.filter(e => !e.covered).map(e => ({ ...e, ...T.EXEC[e.k] })); },
        execLocked() { return this.pr.exec.filter(e => e.covered).length; },
        card() { return this.pr.card ? D.solo(this.pr.card) : null; },
        cardAction() {
            if (!this.card) return null;
            const orbit = { 1: 'blueprint', 2: 'tech', 3: 'rnd' }, colony = { 1: 'construct', 2: 'upgrade', 3: 'hire' };
            return T.ACTION[(this.pr.side === 'orbit' ? orbit : colony)[this.card.n]];
        },
        moveInfo() { return this.q === 'movePick' ? this.pr : null; },
        result() { return this.st.result; },
    },
    methods: {
        /** Answer the prompt, or in explain mode say what this answer would do. */
        go(v) { if (this.explain) this.$emit('tip', TIP.choice(this.st, this.pr, v)); else this.$emit('answer', v); },
        bp(id) { return D.bp(id); }, sci(id) { return D.sci(id); }, con(id) { return D.contract(id); },
        typeIc(t) { return T.TYPE_IC[t]; }, tic(t) { return T.TECH_IC[t]; },
        bagList(b) { return Object.entries(b).map(([k, n]) => ({ k, n })); },
        costList(c) { return Object.entries(c).map(([k, n]) => ({ k: k === 'colonists' ? 'colonist' : k, n })); },
        needList(c) { return Object.entries(D.contract(c).need || {}).map(([k, n]) => ({ k, n })); },
        discIc(id) { const d = D.disc(id); return d.k === 'build' ? T.TYPE_IC[d.b] : d.k === 'gain' ? d.g : { buildAny: 'upgrade', develop2: 'develop', blueprints2: 'blueprint', tech1: 'tech', upgrade2: 'adv', hire: 'scientist', warehouse2: 'warehouse' }[d.k]; },
        discTxt(id) { const d = D.disc(id); return d.k === 'gain' ? `+${d.n} ${d.g}` : d.k === 'build' ? `Build ${D.BUILD_NAMES[d.b]}` : T.DISC[d.k]; },
        labBen(pos) { const s = D.LAB.find(l => l.k === pos); return s.ben ? T.LAB_BEN[s.ben] : null; },
        labLevel(pos) { return +pos[0]; },
        techOf(pos) { return this.you.lab[pos]; },
        spaceBen(n) { const b = D.TURN_SPACES[n]; return b ? T.SPACE[b] : null; },
        execName(k) { return T.EXEC[k]; },
        hexLabel() {
            const p = this.pr;
            switch (p.q) {
                case 'buildHex': return { ic: this.typeIc(p.type), txt: `${D.BUILD_NAMES[p.type]} · tap a glowing hex` };
                case 'upgradeHex': return { ic: this.typeIc(D.bp(p.id).type), txt: `${D.bp(p.id).name} · tap a building` };
                case 'moveTo': return { ic: p.piece === 'rover' ? 'rover' : 'bot', txt: `${p.mp} move${p.mp === 1 ? '' : 's'} · tap a destination` };
                case 'displace': return { ic: p.piece === 'rover' ? 'rover' : 'bot', txt: 'Your piece was bumped · tap where it goes' };
                case 'placeBot': return { ic: 'bot', txt: 'Tap where the new bot lands' };
                case 'produceExtra': return { ic: 'production', txt: `${p.left} extra · tap a building` };
                case 'discHex': return { ic: this.discIc(p.disc), txt: `${this.discTxt(p.disc)} · 3 from your rover` };
            }
            return { ic: 'arrow', txt: '' };
        },
        btnInfo(b) {
            const p = this.pr;
            return {
                done: { ic: 'check', txt: 'Done' },
                crBot: { ic: 'crystal', txt: '+1 bot move' },
                crRover: { ic: 'crystal', txt: '+1 rover move' },
                tech: { ic: 'tech', txt: `+${p.techLevel} rover tech${p.techOwner === PF ? ' (Pathfinder’s)' : ''}` },
            }[b] || { ic: 'arrow', txt: b };
        },
        lssPreview(k) { return T.LSS_BEN[k]; },
        sumIc(s) {
            const m = { build: this.typeIc(s.type) || 'shelter', bp: 'blueprint', tech: 'tech', develop: 'develop', ware: s.item || 'warehouse', sci: 'scientist', contract: 'contract', upgrade: 'upgrade', bots: 'bot', mission: 'mission' };
            return m[s.k] || 'arrow';
        },
    },
    template: `
<section class="dock" :class="['q-' + q, { explaining: explain, collapsed }]" aria-live="polite">
  <header class="dock-head">
    <h2 class="dock-title">
      <button type="button" class="dock-toggle" @click="collapsed = !collapsed" :aria-expanded="!collapsed" aria-controls="dock-main">
        <Ic :n="title.ic" :s="20" :c="q==='pfTurn' ? 'var(--c-pf)' : 'var(--primary-bright)'"/>
        <span>{{ title.txt }}</span>
        <span v-if="pr.left" class="left-tag" :aria-label="pr.left + ' left'">×{{ pr.left }}</span>
        <span class="chev"><Ic n="chev" :s="18"/></span>
      </button>
    </h2>
    <span class="sp"></span>
    <button v-if="pr.kind !== 'over'" class="icon-btn explain-btn" :class="{ on: explain }" @click="explain = !explain; collapsed = false" :aria-pressed="explain" :aria-label="explain ? 'Stop explaining' : 'Explain the buttons'" :title="explain ? 'Stop explaining' : 'Explain the buttons'"><Ic n="help" :s="18"/></button>
    <button class="icon-btn" :disabled="!canUndo" @click="$emit('undo')" aria-label="Undo" title="Undo"><Ic n="undo" :s="18"/></button>
  </header>
  <div id="dock-main" v-show="!collapsed">
  <p v-if="explain" class="explain-bar"><Ic n="help" :s="15"/><span>Tap a button to see what it does.</span><button class="btn ghost" @click="explain = false">Done</button></p>

  <!-- ===================== your turn ===================== -->
  <div v-if="q==='menu'" class="dock-body">
    <div v-if="pr.main.length" class="tiles main">
      <button v-for="m in mainTiles" :key="m.k" class="tile" :class="{ off: m.why }" :disabled="!!m.why && !explain" @click="go({ a: 'main', k: m.k })" :title="m.why ? m.blockTxt : m.long">
        <Ic :n="m.ic" :s="26"/>
        <span class="nm">{{ m.name }}</span>
        <span class="meta">
          <Slots v-if="m.slot" :owners="m.owners" :max="m.max"/>
          <span v-if="m.slot && m.cost" class="extra" :title="'Extra cost: ' + m.cost + ' crystal or colonist'">+{{ m.cost }}<Ic n="crystal" :s="11"/>/<Ic n="colonist" :s="11"/></span>
          <Ic v-if="m.boost" n="boost" :s="13" c="var(--primary)" label="boostable"/>
        </span>
        <span v-if="m.why" class="why"><Ic n="lock" :s="11"/>{{ m.blockTxt }}</span>
      </button>
    </div>
    <div v-if="execOpen.length" class="exec-row" role="group" aria-label="Executive actions">
      <span class="lbl"><Ic n="exec" :s="15"/></span>
      <button v-for="e in execOpen" :key="e.i" class="xbtn" :disabled="!!e.why && !explain" @click="go({ a: 'exec', i: e.i })" :title="e.long + (e.why ? ': ' + (T_BLOCK[e.why]||'') : '')">
        <Ic :n="e.ic" :s="18"/><small><Ic n="crystal" :s="10"/>{{ e.cost }}</small>
      </button>
      <span v-if="execLocked" class="locked-n" :title="execLocked + ' executive actions still locked by ships'"><Ic n="ship" :s="14" c="var(--muted)"/>{{ execLocked }}</span>
    </div>
    <div v-if="pr.goals.length" class="goal-row">
      <button v-for="g in pr.goals" :key="g.id" class="btn goal-btn" @click="go({ a: 'goal', id: g.id })"><Ic n="goal" :s="16"/>Claim goal</button>
    </div>
    <button v-if="pr.canEnd" class="btn primary wide" @click="go({ a: 'end' })"><Ic n="check" :s="18"/>End turn</button>
    <p v-else class="hint">Pick one main action. Executive actions can go before or after.</p>
  </div>

  <!-- ===================== numbers ===================== -->
  <div v-else-if="pr.kind==='num'" class="dock-body">
    <p class="hint"><Ic n="colonist" :s="14"/> {{ you.col.lq }} at home · each boost sends one to work</p>
    <div class="nums">
      <button v-for="i in (pr.max - pr.min + 1)" :key="i" class="num-btn" @click="go(pr.min + i - 1)">
        <b>+{{ pr.min + i - 1 }}</b>
        <span class="men"><Ic v-for="j in Math.min(pr.min + i - 1, 4)" :key="j" n="colonist" :s="12"/></span>
      </button>
    </div>
  </div>

  <!-- ===================== hex prompts ===================== -->
  <div v-else-if="pr.kind==='hex'" class="dock-body">
    <template v-if="moveInfo">
      <div class="mp">
        <span v-if="moveInfo.botMode" class="chip big"><Ic n="bot" :s="20" c="var(--c-you)"/><b>{{ moveInfo.bot }}</b><small>moves</small></span>
        <span v-if="moveInfo.roverMode" class="chip big"><Ic n="rover" :s="20" c="var(--c-you)"/><b>{{ moveInfo.rover }}</b><small>moves</small></span>
        <span v-if="moveInfo.asRover" class="tag">bots collect like rovers</span>
      </div>
      <p class="hint">Tap your {{ moveInfo.botMode && moveInfo.roverMode ? 'bot or rover' : moveInfo.botMode ? 'bot' : 'rover' }} on the map.</p>
    </template>
    <p v-else class="hint big"><Ic :n="hexLabel().ic" :s="18"/>{{ hexLabel().txt }}</p>
    <p v-if="pr.q==='buildHex' && pr.tech" class="hint small"><Ic n="tech" :s="13"/> Joining uses the level-{{ pr.tech.level }} tech{{ pr.tech.o===1 ? ' (Pathfinder’s: it may develop it)' : '' }}. Numbers show the new complex size.</p>
    <div class="btn-row">
      <button v-for="b in (pr.btns || [])" :key="b" class="btn" :class="{ primary: b==='done' }" @click="go(b)"><Ic :n="btnInfo(b).ic" :s="16"/>{{ btnInfo(b).txt }}</button>
      <button v-if="pr.back" class="btn ghost" @click="go('back')"><Ic n="back" :s="16"/>Back</button>
    </div>
  </div>

  <!-- ===================== Pathfinder's turn ===================== -->
  <div v-else-if="q==='pfTurn'" class="dock-body pf-turn">
    <div class="solo-card" :aria-label="'Solo card ' + card.n + (card.x ? ' with X' : '') + ', mission ' + card.m">
      <span class="sc-m">{{ card.m }}</span>
      <span class="sc-x" :class="{ x: card.x }">{{ card.x ? '✕' : '‹' }}<i></i></span>
      <span class="sc-n">{{ card.n }}</span>
      <small>{{ pr.side === 'orbit' ? 'Orbit' : 'Mars' }}</small>
    </div>
    <div class="pf-sum">
      <div class="pf-act"><Ic :n="cardAction.ic" :s="20"/><b>{{ cardAction.name }}</b><small v-if="card.x" class="tag">no travel</small></div>
      <ul>
        <li v-for="(s,i) in pr.sum" :key="i"><Ic :n="sumIc(s)" :s="16"/><span>{{ s.text }}</span></li>
        <li v-if="!pr.sum.length" class="muted">Nothing happened.</li>
      </ul>
    </div>
    <button class="btn primary wide" @click="go(true)"><Ic n="check" :s="18"/>OK</button>
  </div>

  <!-- ===================== a bonus that can't be used ===================== -->
  <div v-else-if="q==='lost'" class="dock-body">
    <p class="hint big"><Ic :n="T_SPACE[pr.ben].ic" :s="18"/>{{ T_SPACE[pr.ben].long }}: {{ T_BLOCK[pr.why] }}</p>
    <button class="btn primary wide" @click="go(true)"><Ic n="check" :s="18"/>OK</button>
  </div>

  <!-- ===================== game over ===================== -->
  <div v-else-if="pr.kind==='over'" class="dock-body over">
    <h3 class="verdict" :class="result.win ? 'win' : 'lose'"><Ic :n="result.win ? 'trophy' : 'pf'" :s="24"/>{{ result.win ? 'You win!' : 'Pathfinder wins' }}</h3>
    <table class="score-table">
      <thead><tr><th></th><th><Ic n="you" :s="16" c="var(--c-you)" label="You"/></th><th><Ic n="pf" :s="16" c="var(--c-pf)" label="Pathfinder"/></th></tr></thead>
      <tbody>
        <tr v-for="k in ['game','progress','tech','colonists','ships','blueprints','scientists','contracts']" :key="k">
          <th>{{ ({ game: 'In game', progress: 'Progress', tech: 'Techs', colonists: 'Colonists', ships: 'Ships', blueprints: 'Blueprints', scientists: 'Scientists', contracts: 'Contracts' })[k] }}</th>
          <td>{{ result.you[k] }}</td><td>{{ result.pf[k] }}</td>
        </tr>
        <tr class="tot"><th>Total</th><td>{{ result.you.total }}</td><td>{{ result.pf.total }}</td></tr>
      </tbody>
    </table>
  </div>

  <!-- ===================== picks ===================== -->
  <div v-else class="dock-body">
    <div class="opts" :class="'o-' + q">
      <template v-if="q==='slotCost'">
        <button v-for="(o,i) in pr.opts" :key="i" class="opt" @click="go(o.v)">
          <span v-if="o.cr"><Ic n="crystal" :s="18"/>×{{ o.cr }}</span><span v-if="o.col"><Ic n="colonist" :s="18"/>×{{ o.col }}</span>
        </button>
      </template>
      <template v-else-if="q==='blueprint' || q==='upgradeBp'">
        <button v-for="id in (pr.cards ? pr.cards.map(c=>c.id) : pr.ids)" :key="id" class="opt bp-opt" :class="{ l3: bp(id).lvl===3 }" @click="go(id)">
          <span class="bp-top"><Ic :n="typeIc(bp(id).type)" :s="22"/><b class="lvl">{{ bp(id).lvl===3?'III':'I' }}</b><span class="gain">+<Ic :n="['mine','gen','water','green','oxy','shelter'].includes(bp(id).type) ? ({mine:'mineral',gen:'battery',water:'water',green:'plant',oxy:'oxygen',shelter:'crystal'})[bp(id).type] : 'any'" :s="14"/></span></span>
          <b class="nm">{{ bp(id).name }}</b>
          <span class="ex"><Ic :n="T_BP[bp(id).ex].ic" :s="14"/><small>{{ T_BP[bp(id).ex].long }}</small></span>
          <span class="pts">±{{ bp(id).lvl===3?5:3 }}</span>
        </button>
      </template>
      <template v-else-if="q==='tech'">
        <button v-for="t in pr.techs" :key="t.i" class="opt" @click="go(t.i)">
          <Ic :n="tic(t.tech)" :s="24"/><b class="nm">{{ T_TN[t.tech] }}</b>
          <span class="cost"><template v-if="D.GRID_COST[t.i].length"><Ic v-for="(c,j) in D.GRID_COST[t.i]" :key="j" :n="c" :s="14"/></template><small v-else>free</small></span>
        </button>
      </template>
      <template v-else-if="q==='labSpace' || q==='devTo'">
        <button v-for="pos in (pr.spaces || pr.to)" :key="pos" class="opt" @click="go(pos)">
          <b class="lvlbig">{{ labLevel(pos) }}</b><span v-if="labBen(pos)" class="ben">+<Ic :n="labBen(pos)" :s="18"/></span><small v-else class="muted">no bonus</small>
          <span v-if="q==='devTo'" class="cost"><Ic v-for="(c,j) in (D.LAB_COST[labLevel(pos)]||[])" :key="j" :n="c" :s="13"/></span>
        </button>
      </template>
      <template v-else-if="q==='develop'">
        <button v-for="pos in pr.tiles" :key="pos" class="opt" @click="go(pos)">
          <Ic :n="tic(techOf(pos))" :s="22"/><b>{{ labLevel(pos) }}<Ic n="arrow" :s="12"/>{{ labLevel(pos)+1 }}</b>
          <span v-if="!pr.free" class="cost"><Ic v-for="(c,j) in (D.LAB_COST[labLevel(pos)+1]||[])" :key="j" :n="c" :s="13"/></span>
        </button>
      </template>
      <template v-else-if="q==='warehouse' || q==='tradeIn' || q==='tradeOut'">
        <button v-for="w in pr.items" :key="w" class="opt res" @click="go(w)"><Ic :n="w" :s="28" :label="w"/><small v-if="q==='warehouse'">{{ st.ware[w] }} left</small></button>
      </template>
      <template v-else-if="q==='pay'">
        <button v-for="(b,i) in pr.bags" :key="i" class="opt pay" @click="go(b)">
          <span class="pay-icons"><span v-for="x in bagList(b)" :key="x.k" class="pay-it"><Ic :n="x.k==='goal'?'goal':x.k" :s="20" :label="x.k"/><b v-if="x.n>1">×{{ x.n }}</b></span></span>
          <small>{{ bagList(b).map(x => (x.n > 1 ? x.n + ' ' : '') + (x.k === 'mineral' ? 'mineral (wild)' : x.k === 'goal' ? 'goal card' : x.k)).join(' + ') }}</small>
        </button>
      </template>
      <template v-else-if="q==='buildType'">
        <button v-for="t in pr.types" :key="t.type" class="opt" @click="go(t.type)">
          <Ic :n="typeIc(t.type)" :s="28"/><b class="nm">{{ ({mine:'Mine',gen:'Generator',water:'Water',green:'Greenhouse',oxy:'Oxygen',shelter:'Shelter'})[t.type] }}</b>
          <span class="cost">−<Ic :n="t.cost" :s="15"/></span>
          <span v-if="t.arrows" class="arrows" title="This tile drops crystals around it"><Ic n="crystal" :s="12"/>×3</span>
          <span v-if="['gen','water','green','oxy'].includes(t.type) && st.lss[t.type] < st.level + 1" class="lsshot" title="Below the colony line: LSS reward"><Ic n="lss" :s="12"/>+</span>
        </button>
      </template>
      <template v-else-if="q==='lssBen'">
        <button v-for="o in pr.opts" :key="o" class="opt" @click="go(o)"><Ic :n="lssPreview(o).ic" :s="26"/><small>{{ lssPreview(o).long }}</small></button>
      </template>
      <template v-else-if="q==='retrieve'">
        <button v-for="s in pr.src" :key="s" class="opt" @click="go(s)"><Ic :n="s==='wa' ? 'hand' : T_ACTION[s].ic" :s="24"/><small>{{ s==='wa' ? 'Work area' : T_ACTION[s].name }}</small></button>
      </template>
      <template v-else-if="q==='useTech'">
        <p class="hint wide"><Ic :n="tic(pr.tech)" :s="16"/> +{{ pr.level }} from Pathfinder’s tech. It may develop it after your turn.</p>
        <button class="opt" @click="go('yes')"><Ic n="check" :s="22"/><b>Use +{{ pr.level }}</b></button>
        <button class="opt" @click="go('no')"><Ic n="x" :s="22"/><b>No</b></button>
      </template>
      <template v-else-if="q==='hire'">
        <button v-for="c in pr.choices" :key="c.i" class="opt sci-opt" @click="go(c.i)">
          <template v-if="c.sci">
            <b class="nm">{{ sci(c.sci).name }}</b>
            <span class="row"><small>works</small><Ic :n="typeIc(sci(c.sci).works)" :s="16"/><small>· 3 OP per</small><Ic n="adv" :s="12"/><Ic :n="typeIc(sci(c.sci).scores)" :s="16"/></span>
            <span class="cost"><span v-for="x in costList(sci(c.sci).cost)" :key="x.k"><Ic :n="x.k" :s="14"/>{{ x.n }}</span></span>
          </template>
          <template v-else>
            <b class="nm"><Ic n="contract" :s="16"/> #{{ c.contract }}</b>
            <span class="row" v-if="con(c.contract).up"><Ic n="adv" :s="14"/><small>on a complex of 4+</small><Ic :n="typeIc(con(c.contract).up)" :s="16"/></span>
            <span class="row" v-else><span v-for="x in needList(c.contract)" :key="x.k"><Ic :n="x.k" :s="14"/>{{ x.n }}</span></span>
            <span class="row"><b class="pos">+{{ con(c.contract).win }}</b>/<b class="neg">−{{ con(c.contract).lose }}</b></span>
            <span class="cost"><Ic n="crystal" :s="13"/>1</span>
          </template>
        </button>
      </template>
      <template v-else-if="q==='refill'">
        <button v-for="c in pr.contracts" :key="c" class="opt" @click="go(c)">
          <b>#{{ c }}</b>
          <span v-if="con(c).up" class="row"><Ic n="adv" :s="12"/><Ic :n="typeIc(con(c).up)" :s="16"/></span>
          <span v-else class="row"><span v-for="x in needList(c)" :key="x.k"><Ic :n="x.k" :s="13"/>{{ x.n }}</span></span>
          <small>+{{ con(c).win }}/−{{ con(c).lose }}</small>
        </button>
      </template>
      <template v-else-if="q==='ship'">
        <p class="hint wide">Unlocks that executive action and opens a crystal space.</p>
        <button v-for="i in pr.slots" :key="i" class="opt" @click="go(i)"><Ic :n="T_EXEC[D.EXEC[i].k].ic" :s="22"/><small>{{ T_EXEC[D.EXEC[i].k].name }}</small><span class="cost"><Ic n="crystal" :s="11"/>{{ D.EXEC[i].cost }}</span></button>
      </template>
      <template v-else-if="q==='shipGain'">
        <button v-for="o in pr.opts" :key="o" class="opt" @click="go(o)">
          <span v-if="o==='bot'"><Ic n="colonist" :s="22"/><b>×{{ pr.big ? 2 : 1 }}</b> + <Ic n="bot" :s="22"/></span>
          <span v-else><Ic n="colonist" :s="22"/><b>×{{ pr.big ? 3 : 2 }}</b></span>
        </button>
      </template>
      <template v-else-if="q==='adv'">
        <template v-for="c in pr.choices" :key="c.id">
          <button v-for="w in c.ways" :key="w" class="opt bp-opt" @click="go({ id: c.id, way: w })">
            <span class="bp-top"><Ic :n="typeIc(bp(c.id).type)" :s="20"/><Ic :n="c.o===0?'you':'pf'" :s="12" :c="c.o===0?'var(--c-you)':'var(--c-pf)'"/></span>
            <b class="nm">{{ bp(c.id).name }}</b>
            <span class="ex"><Ic :n="T_BP[bp(c.id).ex].ic" :s="14"/><small>{{ T_BP[bp(c.id).ex].long }}</small></span>
            <span class="cost"><template v-if="w==='pay'"><Ic n="crystal" :s="13"/>2</template><template v-else-if="w==='sci'"><Ic n="scientist" :s="13"/>send {{ sci(c.sci).name }}</template><template v-else>free</template></span>
          </button>
        </template>
      </template>
      <template v-else-if="q==='side'">
        <button v-for="o in pr.opts" :key="o" class="opt" @click="go(o)"><Ic :n="o==='orbit'?'orbit':'mars'" :s="24"/><small>{{ o==='orbit'?'Orbit':'Mars' }}</small></button>
      </template>
      <template v-else-if="q==='radar' || q==='discPick'">
        <button v-for="id in pr.discs" :key="id" class="opt" @click="go(id)"><Ic :n="discIc(id)" :s="26"/><small>{{ discTxt(id) }}</small></button>
      </template>
      <template v-else-if="q==='goalReward'">
        <button v-for="o in pr.opts" :key="o" class="opt" @click="go(o)"><Ic :n="o==='develop2'?'develop':'goal'" :s="22"/><small>{{ T_GOAL_R[o] }}</small></button>
      </template>
      <template v-else-if="q==='goalCrystal'">
        <button v-for="g in pr.goals" :key="g" class="opt" @click="go(g)"><Ic n="goal" :s="20"/><small>{{ T_GOAL[D.GOALS[g-1].k] }}</small></button>
      </template>
      <template v-else-if="q==='techReward'">
        <p class="hint wide">Pathfinder used your <Ic :n="tic(pr.tech)" :s="14"/> tech.</p>
        <button class="opt" @click="go('oxygen')"><Ic n="oxygen" :s="26"/><small>Keep +1 oxygen</small></button>
        <button class="opt" @click="go('develop')"><Ic n="develop" :s="26"/><small>Develop it free</small></button>
      </template>
      <template v-else-if="q==='travel'">
        <button class="opt" @click="go('go')"><Ic :n="pr.to==='orbit'?'orbit':'mars'" :s="26"/><b>Go to {{ pr.to==='orbit'?'Orbit':'Mars' }}</b><small>{{ pr.free ? 'free ride' : 'costs a hangar ship' }}</small></button>
        <button class="opt" @click="go('stay')"><Ic n="x" :s="22"/><b>Stay</b></button>
      </template>
      <template v-else-if="q==='space'">
        <p v-if="pr.first" class="hint wide">Lower numbers go first. 1 to 4 start in Orbit, 5 to 8 on Mars.</p>
        <button v-for="n in pr.spaces" :key="n" class="opt space" :class="{ mars: n > 4 }" @click="go(n)">
          <b class="lvlbig">{{ n }}</b>
          <span v-if="spaceBen(n)"><Ic :n="spaceBen(n).ic" :s="18"/><small>{{ spaceBen(n).long }}</small></span>
          <small v-else class="muted">no bonus</small>
          <small v-if="pr.blocked && pr.blocked[n]" class="why"><Ic n="lock" :s="11"/>{{ T_BLOCK[pr.blocked[n]] }}</small>
        </button>
      </template>
      <template v-else>
        <button v-for="o in (pr.opts||[])" :key="String(o)" class="opt" @click="go(o)"><b>{{ o }}</b></button>
      </template>
      <button v-if="pr.skip" class="opt ghost" @click="go('done')"><Ic n="skip" :s="18"/><small>{{ pr.left !== undefined && pr.q !== 'pay' ? 'Done' : 'Skip' }}</small></button>
    </div>
  </div>
  </div>
</section>`,
};
// constants reachable from the template
Object.assign(PromptDock.methods, {});
PromptDock.computed.D = () => D;
PromptDock.computed.T_BP = () => T.BP_EX;
PromptDock.computed.T_EXEC = () => T.EXEC;
PromptDock.computed.T_ACTION = () => T.ACTION;
PromptDock.computed.T_GOAL = () => T.GOAL;
PromptDock.computed.T_GOAL_R = () => T.GOAL_R;
PromptDock.computed.T_BLOCK = () => T.BLOCK;
PromptDock.computed.T_TN = () => T.TECH_NAME;
PromptDock.computed.T_SPACE = () => T.SPACE;
