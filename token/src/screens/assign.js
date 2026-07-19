// assign.js — ASSIGN THE WORK. One card per task (fresh first, then backlog items
// marked ⏳), with four route buttons plus slip/keep. Routes that don't exist (no
// hire, no capacity) render as empty sockets — absence is visible, not hidden.
// The ai-hunt delegation (a plan-phase decision) rides at the bottom.
//
// Every button is a single applied decision through the engine; the option's
// consequence blurb comes straight from pendingDecisions (option.detail).

const SIZE_PIPS = { easy: '▪', medium: '▪▪', hard: '▪▪▪' };
const SHORT = {
  self: 'DO IT', ai: 'AI', 'ai-review': 'AI+REVIEW',
  'assign-junior': 'GIVE JR', 'assign-qa': 'GIVE QA', 'assign-senior': 'GIVE SR',
  slip: 'LET SLIP', defer: 'KEEP'
};

function taskMeta(vs, decision) {
  if (decision.id.startsWith('route-task-')) {
    const id = decision.id.slice('route-task-'.length);
    const t = vs.tasks.find((x) => String(x.id) === id);
    return t ? { title: t.title, size: t.size, backlog: false } : { title: decision.prompt, size: 'medium', backlog: false };
  }
  const id = decision.id.slice('route-backlog-'.length);
  const b = vs.backlog.find((x) => String(x.id) === id);
  return { title: decision.prompt.replace(/^Route backlog:\s*/, ''), size: b ? b.size : 'medium', backlog: true };
}

function routeButton(h, decId, opt) {
  const label = SHORT[opt.id] || opt.label;
  if (opt.disabled) {
    return `<div class="row empty" title="${h.esc(opt.detail || '')}"><span class="lab small">${h.esc(label)}</span></div>`;
  }
  return `<button class="row" data-action="dispatch" data-decision="${h.esc(decId)}" data-option="${h.esc(opt.id)}"
            title="${h.esc(opt.detail || '')}"><span class="lab small">${h.esc(label)}</span></button>`;
}

function taskCard(c, decision) {
  const { vs, h } = c;
  const meta = taskMeta(vs, decision);
  const routeOpts = decision.options.filter((o) => !['slip', 'defer'].includes(o.id));
  const tail = decision.options.filter((o) => ['slip', 'defer'].includes(o.id));
  return `
    <div class="card">
      <div><span class="hi">${meta.backlog ? '⏳ ' : ''}${h.esc(meta.title)}</span>
        <span class="det">${SIZE_PIPS[meta.size] || '▪▪'}</span></div>
      <div class="routes" style="margin-top:4px">
        ${routeOpts.map((o) => routeButton(h, decision.id, o)).join('')}
      </div>
      <div class="routes" style="margin-top:4px">
        ${tail.map((o) => `<button class="row" data-action="dispatch" data-decision="${h.esc(decision.id)}" data-option="${h.esc(o.id)}"><span class="lab small">${h.esc(SHORT[o.id] || o.label)}</span><span class="det">${h.esc(o.detail || '')}</span></button>`).join('')}
      </div>
    </div>`;
}

export function render(c) {
  const { decisions, h, vs } = c;
  const routes = decisions.filter((d) => d.kind === 'route' && d.id !== 'ai-hunt');
  const aiHunt = decisions.find((d) => d.id === 'ai-hunt');

  const cards = routes.length
    ? routes.map((d) => taskCard(c, d)).join('')
    : `<div class="dim">Everything is routed. Head back to spend your focus.</div>`;

  let huntBlock = '';
  if (aiHunt) {
    huntBlock = `
      <div class="card">
        <div class="hi">${h.esc(aiHunt.prompt)}</div>
        <div class="small dim">The AI closes bugs for tokens and no capacity — but each patch is code no one understands.</div>
        <div class="routes" style="margin-top:4px">
          ${aiHunt.options.map((o) => `<button class="row" data-action="dispatch" data-decision="ai-hunt" data-option="${h.esc(o.id)}"><span class="lab small">${h.esc(o.label)}</span><span class="det">${h.esc(o.detail || '')}</span></button>`).join('')}
        </div>
      </div>`;
  }

  return `
    <div class="screen scroll">
      ${h.strip(vs)}
      <h2 class="sub">Assign the work</h2>
      ${cards}
      ${huntBlock}
      <div class="menu">${h.row({ key: 'enter', label: '◀ Back to the office', attrs: 'data-action="nav" data-view="hub"' })}</div>
    </div>`;
}
