// title.js — TITLE screen + "Learn about the trail" pane.
// Deadpan Oregon-Trail menu. Offers "Continue the year" only when a save exists.

export function render(c) {
  if (c.view === 'about') return about(c);

  const { h } = c;
  const rows = [];
  let k = 1;
  rows.push(h.row({ key: k++, label: 'Travel the year', attrs: 'data-action="new-run"' }));
  if (c.hasSave) rows.push(h.row({ key: k++, label: 'Continue the year', detail: 'a run is in progress', attrs: 'data-action="resume"' }));
  rows.push(h.row({ key: k++, label: 'Learn about the trail', attrs: 'data-action="nav" data-view="about"' }));

  return `
    <div class="screen center">
      <div class="title-big">THE&nbsp;TOKEN&nbsp;TRAIL</div>
      <div class="sub">How much of you will arrive?</div>
      <div class="dim small">A year in a dev shop, in the age of the machine.</div>
      <div class="spacer"></div>
      <div class="menu" style="width:100%;max-width:420px">${rows.join('')}</div>
      <div class="spacer"></div>
      <div class="hintbar">Tap a line — or press its number. Enter picks the first.</div>
    </div>`;
}

function about(c) {
  const { h } = c;
  return `
    <div class="screen scroll">
      <h2 class="sub">The Trail</h2>
      <p>You run a small dev shop on a one-year contract. Build the software, keep it
      running for twelve months. The client pays monthly — while it stays up. Payroll
      and AI tokens burn cash the whole way.</p>
      <p>Every task can go to <span class="hi">you</span>, the <span class="hi">AI</span>,
      or a <span class="hi">teammate</span>. The dashboard shows <span class="hi">Confidence</span>.
      What it never shows is <span class="hi">Understanding</span> — the truth, revealed
      only at a check: <span class="dim">"You believed 78. Reality 41."</span></p>
      <p>Keep three meters alive — <span class="money">money</span>, <span class="hi">energy</span>,
      and the <span class="hi">client</span> — for twelve months, then pass the Renewal
      Review. Survive, and find out whether surviving meant anything.</p>
      <div class="menu" style="max-width:360px">
        ${h.row({ key: 1, label: 'Back', attrs: 'data-action="nav" data-view="title"' })}
      </div>
    </div>`;
}

