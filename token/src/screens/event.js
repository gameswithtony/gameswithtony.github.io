// event.js — EVENT / MAJOR card, and the resolution beat on the same card.
//
// Choices carry DERIVED axis icons (💰⚡🧠🚚🤝, PLAN.md §1) showing which of the
// five balances the choice puts at stake — never the numbers — plus the check
// target: (you) / (name) / (anyone). When a check targeted you, the resolution
// reveals it in small caps: YOU BELIEVED 78. REALITY 41. That reveal is the only
// moment true Understanding ever prints in-run; then the number goes dark again.

function quarterOf(month) {
  if (month <= 3) return 'Q1'; if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3'; return 'Q4';
}
function humanize(id) {
  return String(id).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

// ---- choices mode ---------------------------------------------------------
function renderChoices(c) {
  const { decisions, h, vs, event } = c;
  const decision = decisions.find((d) => d.kind === 'event');
  if (!decision) return renderResolution(c);   // defensive: state already advanced
  const def = event && event.def;
  const major = event && event.deck === 'major';

  const rows = decision.options.map((o, i) => {
    const choiceDef = def ? def.choices.find((ch) => ch.id === o.id) : null;
    const axes = choiceDef ? h.deriveAxes(choiceDef) : '';
    let detail = o.detail || '';
    if (choiceDef && choiceDef.check) {
      const tl = h.targetLabel(choiceDef.check.target);
      detail = detail ? `${detail} · check ${tl}` : `check ${tl}`;
    }
    return h.row({
      key: i + 1, label: h.esc(o.label), detail, axes,
      attrs: `data-action="dispatch" data-decision="${h.esc(decision.id)}" data-option="${h.esc(o.id)}"`,
      disabled: o.disabled
    });
  }).join('');

  const plate = major
    ? `<div class="plate">${h.esc((def && def.title) ? def.title : humanize(def ? def.id : 'Major'))} — ${quarterOf(vs.month)}</div>`
    : '';

  return `
    <div class="screen center">
      <div class="event-card${major ? ' major' : ''}">
        ${plate}
        <div class="hi">${h.esc(decision.prompt)}</div>
        <div class="menu" style="margin-top:10px">${rows}</div>
      </div>
    </div>`;
}

// ---- resolution beat ------------------------------------------------------
function renderResolution(c) {
  const { h, eventResult, event, vs } = c;
  const r = eventResult || {};
  const def = r.def || (event && event.def);
  const major = (r.deck || (event && event.deck)) === 'major';

  let checkLine = '';
  if (r.check) {
    checkLine = r.check.success
      ? `<div class="sub">The check holds. ✓</div>`
      : `<div class="warn">The check fails. ✗</div>`;
  }
  let revealLine = '';
  if (r.reveal) {
    revealLine = `<div class="reveal caps small">You believed <span class="believed">${r.reveal.believed}</span>.
      Reality <span class="reality">${r.reveal.reality}</span>.</div>`;
  }
  const choiceLine = r.choice ? `<div class="dim small">You chose: ${h.esc(r.choice.label)}</div>` : '';

  return `
    <div class="screen center">
      <div class="event-card${major ? ' major' : ''}">
        <div class="hi">${h.esc(r.prompt || (def ? def.id : 'Resolved.'))}</div>
        ${choiceLine}
        <div style="margin-top:8px">${checkLine}</div>
        ${revealLine}
        <div class="menu" style="margin-top:12px">
          ${h.row({ key: 'enter', label: '▶ Continue', attrs: 'data-action="event-continue"' })}
        </div>
      </div>
    </div>`;
}

export function render(c) {
  return c.view === 'eventResult' ? renderResolution(c) : renderChoices(c);
}
