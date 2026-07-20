// assign.js — ASSIGN THE WORK. One card per task (fresh first, then backlog items
// marked ⏳), with four route buttons plus slip/keep. Routes that don't exist (no
// hire, no capacity) render as empty sockets — absence is visible, not hidden.
// The ai-hunt delegation (a plan-phase decision) rides at the bottom.
//
// Picks are a UI draft (app.assignDraft): tapping a route highlights it and the
// card stays put, so any pick can be changed until Continue commits the whole
// plan through the engine in one go. Because the engine reserves capacity and
// focus at decision time, the draft mirrors those two constraints itself: one
// 'self' across all cards, and no more AI+review picks than capacity remaining.

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
    return t
      ? { title: t.title, size: t.size, backlog: false, milestone: !!t.milestone }
      : { title: decision.prompt, size: 'medium', backlog: false, milestone: false };
  }
  const id = decision.id.slice('route-backlog-'.length);
  const b = vs.backlog.find((x) => String(x.id) === id);
  return {
    title: decision.prompt.replace(/^Route backlog:\s*/, ''),
    size: b ? b.size : 'medium', backlog: true, milestone: !!(b && b.milestone)
  };
}

// Overlay draft-level constraints on top of the engine's own disabled flags.
function optionState(opt, decision, draft, capLeft) {
  const picked = draft[decision.id] === opt.id;
  let disabled = !!opt.disabled;
  let detail = opt.detail || '';
  if (!picked && !disabled) {
    if (opt.id === 'self' && Object.entries(draft).some(([id, o]) => o === 'self' && id !== decision.id)) {
      disabled = true; detail = 'focus already spent';
    } else if (opt.id === 'ai-review' && capLeft <= 0) {
      disabled = true; detail = 'no capacity left';
    } else if (opt.id.startsWith('assign-')
        && Object.entries(draft).some(([id, o]) => o === opt.id && id !== decision.id)) {
      disabled = true; detail = 'their slot is taken';
    }
  }
  return { picked, disabled, detail };
}

function routeButton(h, decId, opt, st) {
  const label = SHORT[opt.id] || opt.label;
  if (st.disabled) {
    return `<div class="row empty" title="${h.esc(st.detail)}"><span class="lab small">${h.esc(label)}</span></div>`;
  }
  return `<button class="row${st.picked ? ' sel' : ''}" data-action="assign-pick" data-decision="${h.esc(decId)}" data-option="${h.esc(opt.id)}"
            title="${h.esc(st.detail)}"><span class="lab small">${h.esc(label)}</span></button>`;
}

function taskCard(c, decision, draft, capLeft) {
  const { vs, h } = c;
  const meta = taskMeta(vs, decision);
  const routeOpts = decision.options.filter((o) => !['slip', 'defer'].includes(o.id));
  const tail = decision.options.filter((o) => ['slip', 'defer'].includes(o.id));
  return `
    <div class="card">
      <div><span class="hi">${meta.milestone ? '⭐ ' : ''}${meta.backlog ? '⏳ ' : ''}${h.esc(meta.title)}</span>
        <span class="det">${SIZE_PIPS[meta.size] || '▪▪'}${meta.milestone ? ' · milestone' : ''}</span></div>
      <div class="routes" style="margin-top:4px">
        ${routeOpts.map((o) => routeButton(h, decision.id, o, optionState(o, decision, draft, capLeft))).join('')}
      </div>
      <div class="routes" style="margin-top:4px">
        ${tail.map((o) => {
          const st = optionState(o, decision, draft, capLeft);
          return `<button class="row${st.picked ? ' sel' : ''}" data-action="assign-pick" data-decision="${h.esc(decision.id)}" data-option="${h.esc(o.id)}"><span class="lab small">${h.esc(SHORT[o.id] || o.label)}</span><span class="det">${h.esc(o.detail || '')}</span></button>`;
        }).join('')}
      </div>
    </div>`;
}

export function render(c) {
  const { decisions, h, vs, app } = c;
  const draft = (app && app.assignDraft) || {};
  const routes = decisions.filter((d) => d.kind === 'route' && d.id !== 'ai-hunt');
  const aiHunt = decisions.find((d) => d.id === 'ai-hunt');

  // AI+review capacity remaining once draft picks are counted.
  const cap = vs.capacity || { total: 0, spent: 0 };
  const draftReviews = Object.values(draft).filter((o) => o === 'ai-review').length;
  const capLeft = cap.total - cap.spent - draftReviews;

  const cards = routes.length
    ? routes.map((d) => taskCard(c, d, draft, capLeft)).join('')
    : `<div class="dim">Everything is routed. Head back to spend your focus.</div>`;

  let huntBlock = '';
  if (aiHunt) {
    huntBlock = `
      <div class="card">
        <div class="hi">${h.esc(aiHunt.prompt)}</div>
        <div class="small dim">The AI closes bugs for tokens and no capacity — but each patch is code no one understands.</div>
        <div class="routes" style="margin-top:4px">
          ${aiHunt.options.map((o) => `<button class="row${draft['ai-hunt'] === o.id ? ' sel' : ''}" data-action="assign-pick" data-decision="ai-hunt" data-option="${h.esc(o.id)}"><span class="lab small">${h.esc(o.label)}</span><span class="det">${h.esc(o.detail || '')}</span></button>`).join('')}
        </div>
      </div>`;
  }

  const undecided = decisions.filter((d) => d.kind === 'route' && draft[d.id] == null).length;
  const canCommit = decisions.some((d) => d.kind === 'route') && undecided === 0;
  const commitRow = canCommit
    ? h.row({ key: 'enter', label: 'Continue ▶', attrs: 'data-action="assign-commit"' })
    : h.row({ label: 'Continue ▶', detail: undecided ? `${undecided} still unrouted` : '', disabled: true });

  return `
    <div class="screen scroll">
      ${h.strip(vs)}
      <h2 class="sub">Assign the work</h2>
      ${cards}
      ${huntBlock}
      <div class="menu">
        ${routes.length || aiHunt ? commitRow : ''}
        ${h.row({ label: '◀ Back to the office', attrs: 'data-action="nav" data-view="hub"' })}
      </div>
    </div>`;
}
