// The decision dock: shows only what is being decided and sends back the answer.
import * as D from './data.js';
import * as T from './text.js';
import * as TIP from './tips.js';
import { Ic, Tok, PartChip, CarIc, DesignTile, Ben, PgCard } from './views.js';
import { deptOf, wsShifts, occupant, sandraDept, kanbanAdds, speakValue, partValue, botLine, pgSlot, pgCount } from './engine.js';

export const PromptDock = {
    components: { Ic, Tok, PartChip, CarIc, DesignTile, Ben, PgCard },
    props: ['st', 'prompt', 'canUndo'],
    emits: ['answer', 'undo', 'tip', 'newgame'],
    data() { return { num: 0, explain: false, collapsed: false, readyAt: 0 }; },
    watch: { prompt: { immediate: true, handler(p) { this.explain = false; this.collapsed = false; this.readyAt = Date.now() + 350; if (p && p.kind === 'num') this.num = p.def ?? p.min; } } },
    computed: {
        pr() { return this.prompt; },
        q() { return this.pr.kind === 'menu' ? 'turn' : this.pr.q || this.pr.kind; },
        title() {
            const p = this.pr, st = this.st;
            const t = {
                turn: ['shift', `Your turn · ${T.DN[p.dept]}${p.other ? ' + ' + T.DN[p.other] : ''}`],
                station: ['arrow', `Day ${st.day}: pick a workstation`],
                stations: ['week', `Day ${st.day} workstations`],
                certStart: ['cert', 'Pick a starting Certification space'],
                certSpace: ['cert', `Certified: section ${p.sec} space`],
                special: ['star', 'Pick your special garage tile'],
                planner: ['garage', `The Planner: tile for garage ${(p.g || 0) + 1}`],
                adminOther: ['adm', 'Admin: also work in'],
                design: ['design', p.free ? 'Special garage: take a Design' : 'Take a Design'],
                kanbanCard: ['kanban', 'Kanban Order: pick a card'],
                kanbanLayout: ['kanban', 'Kanban Order: place the card'],
                collectWare: ['warehouse', 'Collect: pick a warehouse'],
                collectNum: ['warehouse', `Collect how many ${T.P[p.part]}?`],
                recycle: ['recycle', 'Recycle: give one, take one'],
                provide: ['asm', 'Provide a Part'],
                route: ['asm', `${T.M[p.car]} car bumped: which way?`],
                claimCar: ['garage', 'Claim which car?'],
                claimDesign: ['design', 'Return which Design?'],
                garage: ['garage', `Park the ${T.M[p.m] || ''} in`],
                delayTile: ['garage', 'Delayed Tuning: tile for this garage'],
                upgDesign: ['upgraded', 'Upgrade which Design?'],
                upgSource: ['upgraded', `${T.P[p.part] || ''} from`],
                upgSpace: ['upgraded', `${T.M[p.m] || ''} upgrade space`],
                double: ['upgraded', 'Use your Double-Upgrade?'],
                chargerSlot: ['charger', 'Charger token space'],
                train2: ['train', `Special garage: train (${(p.n || 0) + 1} of 2)`],
                meet: ['meeting', `Meeting ${st.meetings + 1}: your turn`],
                nextPG: ['pg', `Next Meeting: give a goal (${(p.n || 0) + 1} of 2)`],
                botTurn: [p.who, `${T.WHO[p.who]} · ${T.DN[p.d] || ''}`],
                sandra: ['S', `Sandra · ${T.DN[p.d] || ''}`],
                eod: ['week', 'End of day'],
                eodRecycle: ['recycle', 'End of day: pick the Recycling swap'],
                avoid: ['sandra', "Avoid Sandra's penalty?"],
                over: [st.result?.win ? 'trophy' : 'fired', st.result?.win ? 'You keep your job!' : 'You are fired'],
            }[this.q] || ['help', this.q];
            return { ic: t[0], txt: t[1] };
        },
        tint() { return this.q === 'botTurn' ? 'var(--c-' + (this.pr.who === 'L' ? 'l' : 't') + ')' : this.q === 'sandra' ? 'var(--c-s)' : null; },
        // ---------- turn menu
        pips() {
            const p = this.pr, out = [];
            const bankUsable = Math.min(this.st.p.bank, Math.max(0, p.cap - Math.max(p.base, p.used)));
            for (let i = 0; i < p.base; i++) out.push({ k: 'wsp', used: i < p.used });
            const bankUsed = Math.max(0, p.used - p.base);
            for (let i = 0; i < bankUsed; i++) out.push({ k: 'bank', used: true });
            for (let i = 0; i < bankUsable; i++) out.push({ k: 'bank', used: false });
            return out;
        },
        recent() { const t = this.st.turn; return t && t.log0 !== undefined ? this.st.log.slice(t.log0).slice(-4) : []; },
        trains() { return this.pr.acts.filter(a => a.k === 'train' || a.k === 'book'); },
        tasks() { return this.pr.acts.filter(a => !['train', 'book', 'recycle', 'sg', 'flip', 'end'].includes(a.k)); },
        frees() { return this.pr.acts.filter(a => ['recycle', 'sg', 'flip'].includes(a.k)); },
        // ---------- other prompts
        stationGrid() {
            const st = this.st, ok = new Set(this.pr.opts), cur = deptOf(st.pos.you), sd = sandraDept(st);
            return D.DEPTS.map((d, i) => ({
                d, why: d === cur ? 'You worked here yesterday' : d === sd ? 'Sandra is here' : '',
                slots: [i * 2, i * 2 + 1].map(ws => ({ ws, ok: ok.has(ws), who: occupant(st, ws), n: wsShifts(ws) })),
            }));
        },
        provideGroups() {
            const g = {};
            this.pr.opts.forEach(o => (g[o.m] = g[o.m] || []).push(o));
            return D.MODELS.filter(m => g[m]).map(m => ({ m, opts: g[m] }));
        },
        meetGroups() {
            const o = this.pr.opts;
            return { play: o.filter(x => x.a === 'play'), speak: o.filter(x => x.a === 'speak'), pass: o.find(x => x.a === 'pass') };
        },
        result() { return this.st.result; },
        handCards() { return [...new Set(this.meetGroups.play.map(o => o.id))]; },
        anyVoucher() { return this.pr.opts?.some?.(o => o.src === 'voucher'); },
    },
    methods: {
        // a new question ignores taps for a moment, so a double-tap on OK cannot also hit End turn
        go(v) { if (Date.now() < this.readyAt) return; if (this.explain) this.$emit('tip', TIP.choice(this.st, this.pr, v)); else this.$emit('answer', v); },
        menuV(a) { const v = { a: a.k }; if (a.d) v.d = a.d; if (a.g !== undefined) v.g = a.g; return v; },
        actName(a) {
            if (a.k === 'train') return `Train ${T.DN[a.d]}`;
            if (a.k === 'book') return `Book → ${T.DN[a.d]}`;
            if (a.k === 'sg') return T.GARAGE[a.tile].txt.replace('Later: ', '');
            if (a.k === 'flip') return `Flip garage ${a.g + 1}: ${T.GARAGE[a.tile].txt}`;
            return T.ACT[a.k].name;
        },
        actIc(a) { return a.k === 'train' ? a.d : T.ACT[a.k].ic; },
        why(a) { return T.BLOCK[a.why] || a.why; },
        layout(k) { return kanbanAdds(this.pr.card, D.KANBAN_LAYOUTS.find(l => l.k === k)); },
        layoutInfo(k) { return D.KANBAN_LAYOUTS.find(l => l.k === k); },
        certBen(sec, sp) { return D.CERT[sec][sp]; },
        speak(id) { return speakValue(this.st, id); },
        pgSlot(id) { return pgSlot(this.st, id); },
        line(l) { return botLine(l); },
        sandraLine(l) {
            const d = this.pr.d;
            switch (l.k) {
                case 'notYou': return { ic: 'check', t: `You are not the ${this.st.opts.nice ? 'most' : 'least'} trained here: no evaluation.` };
                case 'pass': return { ic: 'check', t: `Evaluated: ${l.val} ${T.SANDRA_CRIT[d]}. No penalty.` };
                case 'penalty': return { ic: 'x', t: `Evaluated: ${l.val} ${T.SANDRA_CRIT[d]}. Penalty −${l.pp} PP.`, bad: true };
                case 'avoided': return { ic: 'star', t: `Penalty of ${l.pp} PP avoided with your special garage.` };
                case 'reward': return { ic: l.pp ? 'pp' : 'check', t: `Evaluated: ${l.val} ${T.SANDRA_CRIT[d]}. ${l.pp ? `Reward +${l.pp} PP.` : 'No reward.'}` };
                case 'pace': return { ic: 'pace', t: `Pace Car +1${l.stripe ? ': Meeting tonight.' : '.'}` };
                case 'clearAsm': return { ic: 'asm', t: `Assembly spaces cleared (${l.n} Parts).` };
                case 'clearWare': return { ic: 'warehouse', t: `Warehouses cut to 1 each (${l.n} Parts out).` };
                case 'clearDesign': return { ic: 'design', t: `${l.n} rightmost Designs returned; display refilled.` };
                case 'week': return { ic: 'week', t: `End of Week ${l.n}: you +${l.you} PP. Colleagues' Designs −${l.L + l.T}${l.keep ? `, Keeping Up −${l.keep}` : ''}.` };
            }
            return { ic: 'help', t: l.k };
        },
        lineIc(l) {
            return { train: 'train', cert: 'cert', expert: 'expert', upgrade: 'upgraded', claim: 'garage', provide: 'asm', kanban: 'kanban', collect: 'warehouse', designs: 'design', cleaned: 'asm', overtime: 'bank' }[l.k] || 'x';
        },
        noteTxt(n) { return `${T.WHO[n.w]} → ${T.wsName(n.ws)}`; },
        sel(id) { return id ? D.sel(id) : null; },
        plan(id) { return id ? D.plan(id) : null; },
        dir(o) { return T.routeDir(this.pr.from, o); },
    },
    template: `
<section class="dock" :class="['q-' + q, { explaining: explain, collapsed }]" aria-live="polite">
  <header class="dock-head">
    <h2 class="dock-title">
      <button type="button" class="dock-toggle" @click="collapsed = !collapsed" :aria-expanded="!collapsed" aria-controls="dock-main">
        <Ic :n="title.ic" :s="20" :c="tint"/><span>{{ title.txt }}</span><span class="chev"><Ic n="chev" :s="18"/></span>
      </button>
    </h2>
    <span class="sp"></span>
    <button v-if="pr.kind !== 'over'" class="icon-btn explain-btn" :class="{ on: explain }" @click="explain = !explain; collapsed = false" :aria-pressed="explain" :aria-label="explain ? 'Stop explaining' : 'Explain the buttons'" :title="explain ? 'Stop explaining' : 'Explain the buttons'"><Ic n="help" :s="18"/></button>
    <button class="icon-btn" :disabled="!canUndo" @click="$emit('undo')" aria-label="Undo" title="Undo (Ctrl+Z)"><Ic n="undo" :s="18"/></button>
  </header>
  <div id="dock-main" v-show="!collapsed">
  <p v-if="explain" class="explain-bar"><Ic n="help" :s="15"/><span>Tap a button to see what it does.</span><button class="btn ghost sm" @click="explain = false">Done</button></p>

  <!-- ============ your turn ============ -->
  <div v-if="q==='turn'" class="dock-body">
    <div class="pips" v-tip="TIP.bank(st)" :aria-label="pr.left + ' Shifts left'">
      <span v-for="(x, i) in pips" :key="i" class="pip" :class="[x.k, { used: x.used }]"></span>
      <small><b>{{ pr.left }}</b> Shift{{ pr.left === 1 ? '' : 's' }} left · max {{ pr.cap }}</small>
    </div>
    <ul v-if="recent.length" class="notes recent"><li v-for="(l, i) in recent" :key="i" :class="{ pos: l.pp > 0, neg: l.pp < 0 }"><Ic n="check" :s="12"/>{{ l.text }}</li></ul>
    <div class="tiles">
      <button v-for="a in trains" :key="a.k + a.d" class="tile" :class="{ off: a.why }" :disabled="!!a.why && !explain" @click="go(menuV(a))">
        <Ic :n="a.k === 'book' ? 'book' : a.d" :s="22"/><span class="nm">{{ actName(a) }}</span>
        <span class="cost">{{ a.cost ? '1' : 'free' }}<Ic v-if="a.cost" n="shift" :s="12"/></span>
        <span v-if="a.why" class="why">{{ why(a) }}</span>
      </button>
      <button v-for="a in tasks" :key="a.k" class="tile" :class="{ off: a.why }" :disabled="!!a.why && !explain" @click="go(menuV(a))">
        <Ic :n="actIc(a)" :s="22"/><span class="nm">{{ actName(a) }}</span>
        <span class="cost">{{ a.k === 'claim' ? a.cost + '+' : a.cost }}<Ic n="shift" :s="12"/></span>
        <span v-if="a.why" class="why">{{ why(a) }}</span>
      </button>
    </div>
    <div class="free-row">
      <button v-for="a in frees" :key="a.k + (a.g ?? '')" class="btn sm" :disabled="!!a.why && !explain" :class="{ off: a.why }" @click="go(menuV(a))" :title="a.why ? why(a) : ''"><Ic :n="actIc(a)" :s="16"/>{{ actName(a) }}<small v-if="a.why" class="why-i">· {{ why(a) }}</small></button>
    </div>
    <button class="btn primary wide" @click="go({ a: 'end' })"><Ic n="check" :s="18"/>End turn</button>
  </div>

  <!-- ============ workstation ============ -->
  <div v-else-if="q==='station'" class="dock-body">
    <ul v-if="pr.notes.length" class="notes"><li v-for="(n, i) in pr.notes" :key="i"><Tok :w="n.w" :s="13"/>{{ noteTxt(n) }}</li></ul>
    <div class="stgrid">
      <div v-for="r in stationGrid" :key="r.d" class="strow" :class="{ off: r.why }">
        <span class="stn"><Ic :n="r.d" :s="20"/>{{ T.DN[r.d] }}</span>
        <button v-for="s in r.slots" :key="s.ws" class="opt st" :disabled="!s.ok && !explain" :class="{ off: !s.ok }" @click="go(s.ws)">
          <b>{{ s.n }}</b><Ic n="shift" :s="13"/><small>{{ s.ws % 2 ? 'bottom' : 'top' }}</small><Tok v-if="s.who" :w="s.who" :s="13"/>
        </button>
        <small v-if="r.why" class="why">{{ r.why }}</small>
      </div>
    </div>
  </div>

  <div v-else-if="q==='stations'" class="dock-body">
    <ul class="notes big"><li v-for="(n, i) in pr.notes" :key="i"><Tok :w="n.w" :s="15"/>{{ noteTxt(n) }}<template v-if="n.plan"> <small class="muted">· Plan {{ T.DN[plan(n.plan).d] }}, <part-chip :p="sel(n.sel).part" :s="12"/> {{ sel(n.sel).take === 't' ? 'top' : 'bottom' }}</small></template></li></ul>
    <button class="btn primary wide" @click="go(true)"><Ic n="check" :s="18"/>Work</button>
  </div>

  <!-- ============ certification ============ -->
  <div v-else-if="q==='certStart' || q==='certSpace'" class="dock-body">
    <p v-if="q==='certStart'" class="hint">Mr Lacerda takes space 1 (2 if you take 1); Mr Turczi space 3 (4 if you take 3). Further right goes first.</p>
    <div class="opts">
      <button v-for="sp in pr.opts" :key="sp" class="opt" @click="go(sp)">
        <b class="big-n">{{ sp + 1 }}</b>
        <span class="bens"><ben v-for="(b, k) in certBen(q==='certStart' ? 0 : pr.sec, sp)" :key="k" :b="b" txt/><small v-if="!certBen(q==='certStart' ? 0 : pr.sec, sp).length" class="muted">No benefit</small></span>
      </button>
    </div>
  </div>

  <!-- ============ garage tiles ============ -->
  <div v-else-if="q==='special' || q==='planner' || q==='delayTile'" class="dock-body">
    <div class="opts">
      <button v-for="k in pr.opts" :key="k" class="opt" @click="go(k)"><Ic :n="T.GARAGE[k].ic" :s="22"/><small>{{ T.GARAGE[k].txt }}</small></button>
    </div>
  </div>

  <div v-else-if="q==='adminOther'" class="dock-body">
    <p class="hint">Split Shifts and Books between Admin (training only) and one other department.</p>
    <div class="opts">
      <button v-for="d in pr.opts" :key="d" class="opt" @click="go(d)"><Ic :n="d === 'none' ? 'adm' : d" :s="24"/><small>{{ d === 'none' ? 'Admin only' : T.DN[d] }}</small><small v-if="d === 'asm'" class="muted">full lines clear first</small></button>
    </div>
  </div>

  <!-- ============ design ============ -->
  <div v-else-if="q==='design'" class="dock-body">
    <div class="opts">
      <button v-for="(o, i) in pr.opts" :key="i" class="opt" @click="go(o)">
        <design-tile :id="o.id" :s="22"/>
        <small>{{ T.designName(o.id) }}</small>
        <small class="muted">{{ o.k === 'disp' ? 'Display ' + (o.r ? 'bottom' : 'top') + ' ' + (o.c + 1) : o.k === 'central' ? 'Central stack' : 'First Office ' + (o.r ? 'bottom' : 'top') }}</small>
        <ben v-if="o.ben" :b="o.ben" txt/>
      </button>
    </div>
  </div>

  <!-- ============ kanban ============ -->
  <div v-else-if="q==='kanbanCard'" class="dock-body">
    <div class="opts">
      <button v-for="k in pr.opts" :key="k" class="opt kopt" @click="go(k)">
        <span class="kcard"><span v-for="(r, j) in D.KANBAN[k]" :key="j" class="krow"><part-chip v-for="(x, n) in r" :key="n" :p="x" :s="15"/></span></span>
      </button>
    </div>
  </div>
  <div v-else-if="q==='kanbanLayout'" class="dock-body">
    <p class="hint">A symbol adds its Part when it sits on its warehouse's side: top <part-chip p="motor" :s="12"/><part-chip p="autopilot" :s="12"/><part-chip p="battery" :s="12"/>, bottom <part-chip p="drivetrain" :s="12"/><part-chip p="body" :s="12"/><part-chip p="electronics" :s="12"/>. You also bank 1 Shift.</p>
    <div class="opts">
      <button v-for="k in pr.opts" :key="k" class="opt kopt" @click="go(k)">
        <span class="kcard">
          <template v-for="(r, j) in layout(k).rows" :key="j">
            <span class="krow"><part-chip v-for="(x, n) in r" :key="n" :p="x" :s="13"/></span>
            <span v-if="(layoutInfo(k).up && j === 1) || (!layoutInfo(k).up && j === 0)" class="kline-s"></span>
          </template>
        </span>
        <span class="adds">+{{ layout(k).out.length }} <part-chip v-for="(x, n) in layout(k).out" :key="n" :p="x" :s="12"/></span>
      </button>
    </div>
  </div>

  <!-- ============ logistics ============ -->
  <div v-else-if="q==='collectWare'" class="dock-body">
    <p class="hint">Room for {{ pr.room }}.</p>
    <div class="opts">
      <button v-for="p in pr.opts" :key="p" class="opt" @click="go(p)"><part-chip :p="p" :s="24"/><b>{{ st.ware[p] }}</b><small>{{ T.P[p] }}</small></button>
    </div>
  </div>
  <div v-else-if="pr.kind==='num'" class="dock-body">
    <div class="nums">
      <button v-for="i in (pr.max - pr.min + 1)" :key="i" class="num-btn" @click="go(pr.min + i - 1)"><b>{{ pr.min + i - 1 }}</b><part-chip :p="pr.part" :s="14"/></button>
    </div>
  </div>
  <div v-else-if="q==='recycle'" class="dock-body">
    <div class="opts">
      <button v-for="(o, i) in pr.opts" :key="i" class="opt" @click="go(o)"><span class="swap"><part-chip :p="o.give" :s="20"/><Ic n="swap" :s="16"/><part-chip :p="o.take" :s="20"/></span><small>{{ T.P[o.give] }} for {{ T.P[o.take] }}</small></button>
    </div>
  </div>

  <!-- ============ assembly ============ -->
  <div v-else-if="q==='provide'" class="dock-body">
    <div class="pgroups">
      <div v-for="g in provideGroups" :key="g.m" class="pgroup">
        <span class="pg-m" v-tip="TIP.model(st, g.m)"><car-ic :m="g.m" :s="24"/><small>{{ T.M[g.m] }}</small><span class="have"><part-chip v-for="(x, i) in st.asm.sp[g.m]" :key="i" :p="x" :s="12"/></span></span>
        <button v-for="(o, i) in g.opts" :key="i" class="opt sm" @click="go(o)"><part-chip :p="o.part" :s="18"/><Ic v-if="o.src === 'voucher'" n="voucher" :s="14"/></button>
      </div>
    </div>
    <p class="hint small"><template v-if="anyVoucher"><Ic n="voucher" :s="12"/> uses a Parts Voucher. </template>Upgraded Parts go in first.</p>
  </div>
  <div v-else-if="q==='route'" class="dock-body">
    <p class="hint">Pushed to {{ T.placeName(pr.from) }}. It moves on:</p>
    <div class="opts">
      <button v-for="o in pr.opts" :key="o" class="opt" @click="go(o)"><Ic :n="dir(o)" :s="24"/><b>{{ dir(o) === 'left' ? 'Left' : dir(o) === 'down' ? 'Down' : 'Up' }}</b><small>{{ T.placeName(o) }}</small><small v-if="!(o in D.EXIT_PP) && st.asm.at[o]" class="muted">bumps the {{ T.M[st.asm.at[o]] }}</small></button>
    </div>
  </div>

  <!-- ============ R&D ============ -->
  <div v-else-if="q==='claimCar'" class="dock-body">
    <div class="opts">
      <button v-for="o in pr.opts" :key="o.i" class="opt" @click="go(o)"><car-ic :m="o.m" :s="26"/><small>Car {{ o.i + 1 }} · {{ T.M[o.m] }}</small><span class="cost">{{ o.cost }}<Ic n="shift" :s="12"/></span></button>
    </div>
  </div>
  <div v-else-if="q==='claimDesign' || q==='upgDesign'" class="dock-body">
    <div class="opts">
      <button v-for="id in pr.opts" :key="id" class="opt" @click="go(id)"><design-tile :id="id" :s="22"/><small>{{ T.designName(id) }}</small><small v-if="q==='upgDesign'" class="muted">{{ T.P[D.dPart(id)] }} value {{ partValue(st, D.dPart(id)) || '–' }}</small></button>
    </div>
  </div>
  <div v-else-if="q==='garage'" class="dock-body">
    <div class="opts">
      <button v-for="g in pr.opts" :key="g" class="opt" @click="go(g)"><Ic n="garage" :s="22"/><b>{{ g + 1 }}</b><small v-if="st.p.garages[g].tile">{{ T.GARAGE[st.p.garages[g].tile].txt }}</small><small v-else class="muted">pick a tile next</small></button>
    </div>
  </div>
  <div v-else-if="q==='upgSource'" class="dock-body">
    <div class="opts">
      <button v-for="s in pr.opts" :key="s" class="opt" @click="go(s)"><Ic :n="s === 'store' ? 'supply' : s === 'voucher' ? 'voucher' : 'charger'" :s="22"/><small>{{ s === 'store' ? 'Your storage' : s === 'voucher' ? 'Parts Voucher' : 'Supply (Charger)' }}</small></button>
    </div>
  </div>
  <div v-else-if="q==='upgSpace'" class="dock-body">
    <div class="opts">
      <button v-for="i in pr.opts" :key="i" class="opt" @click="go(i)"><ben :b="D.UPGRADE_SPACES[pr.m][i]" txt :s="20"/><small class="muted">{{ i < 3 ? 'top' : 'bottom' }} row</small></button>
    </div>
  </div>
  <div v-else-if="q==='double'" class="dock-body">
    <p class="hint">Once per game. {{ T.P[pr.part] }} goes from {{ partValue(st, pr.part) || '–' }} to {{ D.VALUE[Math.min(5, st.val[pr.part] + 2)] }} and you score {{ D.VALUE[Math.min(5, st.val[pr.part] + 2)] }} PP.</p>
    <div class="opts"><button class="opt" @click="go('yes')"><Ic n="upgraded" :s="22"/><b>Double</b></button><button class="opt" @click="go('no')"><Ic n="x" :s="22"/><b>Single</b></button></div>
  </div>

  <!-- ============ admin extras ============ -->
  <div v-else-if="q==='chargerSlot'" class="dock-body">
    <div class="opts"><button v-for="i in pr.opts" :key="i" class="opt" @click="go(i)"><Ic :n="D.DEPTS[i]" :s="22"/><b>{{ i + 1 }}</b><small>{{ T.CHARGER[i] }}</small></button></div>
  </div>
  <div v-else-if="q==='train2'" class="dock-body">
    <div class="opts"><button v-for="d in pr.opts" :key="d" class="opt" @click="go(d)"><Ic :n="d" :s="22"/><small>{{ T.DN[d] }}</small></button></div>
  </div>

  <!-- ============ meeting ============ -->
  <div v-else-if="q==='meet'" class="dock-body">
    <ul v-if="pr.notes.length" class="notes"><li v-for="(n, i) in pr.notes" :key="i"><Tok :w="n.w" :s="13"/>{{ T.WHO[n.w] }} spoke on goal {{ n.id }}: <span class="neg">−{{ n.pts }}</span></li></ul>
    <p class="hint small">Tokens: <b>{{ st.p.sp + st.p.sgSpeech }}</b><Ic n="speech" :s="12"/> · Lacerda {{ pr.bot.L }} · Turczi {{ pr.bot.T }} left</p>
    <template v-if="meetGroups.speak.length">
      <h4>Speak on a goal</h4>
      <div class="opts">
        <button v-for="o in meetGroups.speak" :key="'s' + o.id" class="opt pgopt" @click="go(o)"><pg-card :st="st" :id="o.id" mini/><b class="pos">+{{ speak(o.id) }}</b></button>
      </div>
    </template>
    <template v-if="handCards.length">
      <h4>Play a goal from your hand (once)</h4>
      <div class="hand-opts">
        <div v-for="id in handCards" :key="id" class="hand-opt">
          <pg-card :st="st" :id="id" mini/>
          <span class="hand-btns">
            <button class="btn sm" @click="go({ a: 'play', id, tok: false })">Play</button>
            <button v-if="meetGroups.play.some(o => o.id === id && o.tok)" class="btn sm" @click="go({ a: 'play', id, tok: true })">Play + speak <b class="pos">+{{ speakHand(id) }}</b></button>
          </span>
        </div>
      </div>
    </template>
    <button v-if="meetGroups.pass" class="btn wide" @click="go(meetGroups.pass)"><Ic n="skip" :s="18"/>Pass</button>
  </div>
  <div v-else-if="q==='nextPG'" class="dock-body">
    <p class="hint" v-if="pr.n === 0">Meeting over: you +{{ pr.scored.you }}, Lacerda −{{ pr.scored.L }}, Turczi −{{ pr.scored.T }}. Two of your goals join two from the deck for the next Meeting.</p>
    <div class="opts"><button v-for="id in pr.opts" :key="id" class="opt pgopt" @click="go(id)"><pg-card :st="st" :id="id" mini/></button></div>
  </div>

  <!-- ============ Colleagues and Sandra ============ -->
  <div v-else-if="q==='botTurn'" class="dock-body bot-turn">
    <p class="hint small" v-if="pr.cert"><Ic n="cert" :s="13"/> Certified here: actions twice.</p>
    <ul class="lines"><li v-for="(l, i) in pr.lines" :key="i"><Ic :n="lineIc(l)" :s="16"/><span>{{ line(l) }}</span></li></ul>
    <button class="btn primary wide" @click="go(true)"><Ic n="check" :s="18"/>OK</button>
  </div>
  <div v-else-if="q==='sandra'" class="dock-body">
    <ul class="lines"><li v-for="(l, i) in pr.lines" :key="i" :class="{ bad: sandraLine(l).bad }"><Ic :n="sandraLine(l).ic" :s="16"/><span>{{ sandraLine(l).t }}</span></li></ul>
    <button class="btn primary wide" @click="go(true)"><Ic n="check" :s="18"/>OK</button>
  </div>
  <div v-else-if="q==='avoid'" class="dock-body">
    <p class="hint">Your special garage tile cancels this penalty of {{ pr.pen }} PP, once.</p>
    <div class="opts"><button class="opt" @click="go('yes')"><Ic n="star" :s="22"/><b>Avoid it</b></button><button class="opt" @click="go('no')"><Ic n="x" :s="22"/><b>Take it, save the tile</b></button></div>
  </div>
  <div v-else-if="q==='eod'" class="dock-body">
    <ul class="lines">
      <li v-for="(l, i) in pr.lines" :key="i"><Ic n="recycle" :s="16"/><span v-if="l.k === 'swap'">Plan card Recycling: {{ T.P[l.out] }} out, {{ T.P[l.in] }} in.</span><span v-else>Plan card Recycling: {{ T.P[l.part] }} makes no swap.</span></li>
      <li v-if="pr.meeting"><Ic n="meeting" :s="16"/><span>Meeting now.</span></li>
    </ul>
    <button class="btn primary wide" @click="go(true)"><Ic n="check" :s="18"/>OK</button>
  </div>
  <div v-else-if="q==='eodRecycle'" class="dock-body">
    <p class="hint">Selection card <part-chip :p="pr.part" :s="13"/> matches more than one swap.</p>
    <div class="opts"><button v-for="(o, i) in pr.opts" :key="i" class="opt" @click="go(o)"><span class="swap"><part-chip :p="o.out" :s="18"/><Ic n="swap" :s="14"/><part-chip :p="o.in" :s="18"/></span><small>{{ T.P[o.out] }} out, {{ T.P[o.in] }} in</small></button></div>
  </div>

  <!-- ============ game over ============ -->
  <div v-else-if="pr.kind==='over'" class="dock-body over">
    <template v-if="result && result.fired">
      <p class="verdict lose"><Ic n="fired" :s="22"/> Fired on day {{ result.day }} at {{ result.pp }} PP.</p>
    </template>
    <template v-else-if="result">
      <p class="verdict" :class="result.win ? 'win' : 'lose'"><Ic :n="result.win ? 'trophy' : 'fired'" :s="22"/> {{ result.pp }} PP<template v-if="result.rank"> · {{ D.RANKS[result.rank - 1].name }}</template></p>
      <table class="score-table">
        <tr><th>Final Goal</th><td class="pos">+{{ result.you.final }}</td></tr>
        <tr><th>Banked Shifts</th><td class="pos">+{{ result.you.shifts }}</td></tr>
        <tr><th>Tokens, Books, Vouchers</th><td class="pos">+{{ result.you.tokens }}</td></tr>
        <tr><th>Cars</th><td class="pos">+{{ result.you.cars }}</td></tr>
        <tr><th>Training leads</th><td class="pos">+{{ result.you.training }}</td></tr>
        <tr><th>Tested Designs</th><td class="pos">+{{ result.you.tested }}</td></tr>
        <tr v-if="result.you.chargers"><th>Chargers</th><td class="pos">+{{ result.you.chargers }}</td></tr>
        <tr v-if="result.you.special"><th>Special garage</th><td class="pos">+{{ result.you.special }}</td></tr>
        <tr><th>Colleagues: training leads</th><td class="neg">−{{ result.bots.training }}</td></tr>
        <tr><th>Colleagues: Designs</th><td class="neg">−{{ result.bots.designs }}</td></tr>
        <tr><th>Colleagues: cars</th><td class="neg">−{{ result.bots.cars }}</td></tr>
        <tr><th>Colleagues: Parts</th><td class="neg">−{{ result.bots.parts }}</td></tr>
      </table>
    </template>
    <button class="btn primary wide" @click="$emit('newgame')"><Ic n="factory" :s="18"/>New game</button>
  </div>

  <div v-else class="dock-body"><div class="opts"><button v-for="(o, i) in (pr.opts || [])" :key="i" class="opt" @click="go(o)">{{ o }}</button></div></div>
  </div>
</section>`,
};
PromptDock.methods.partValue = function (st, p) { return partValue(st, p); };
PromptDock.methods.speakHand = function (id) {
    // speaking on a just-played card uses its top icon
    const c = D.pg(id);
    const n = pgCount(this.st, id) - (c.c === 'speech' && this.st.p.sp > 0 ? 1 : 0);
    return Math.max(0, Math.min(n, c.m[0])) * c.pp;
};
