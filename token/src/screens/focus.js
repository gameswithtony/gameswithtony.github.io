// focus.js — FOCUS. Your one wagon-stop decision for the month: build a task
// yourself (spent at routing time — that route IS this focus), hunt, rest, or a
// 1:1. The engine only offers a separate focus once all work is routed; if you
// already routed a task to yourself, your focus is spent and this screen says so.

const NICE = {
  hunt: 'Go bug hunting', rest: 'Rest',
  'oneonone-junior': 'Sit down with the junior',
  'oneonone-qa': 'Sit down with the QA',
  'oneonone-senior': 'Sit down with the senior'
};

export function render(c) {
  const { decisions, h, vs } = c;
  const focus = decisions.find((d) => d.kind === 'focus');

  if (!focus) {
    return `
      <div class="screen">
        ${h.strip(vs)}
        <h2 class="sub">Your focus</h2>
        <div class="dim">Your focus is already spent this month — you took a task in hand.</div>
        <div class="spacer"></div>
        <div class="menu">${h.row({ key: 'enter', label: '◀ Back to the office', attrs: 'data-action="nav" data-view="hub"' })}</div>
      </div>`;
  }

  const rows = focus.options.map((o, i) => h.row({
    key: i + 1,
    label: NICE[o.id] || o.label,
    detail: o.detail,
    attrs: `data-action="dispatch" data-decision="focus" data-option="${h.esc(o.id)}"`,
    disabled: o.disabled
  })).join('');

  return `
    <div class="screen">
      ${h.strip(vs)}
      <h2 class="sub">Spend your focus</h2>
      <div class="small dim">One choice. It is the cost of doing anything yourself.</div>
      <div class="menu" style="margin-top:6px">${rows}</div>
      <div class="menu" style="margin-top:6px">${h.row({ label: '◀ Back', attrs: 'data-action="nav" data-view="hub"' })}</div>
    </div>`;
}
