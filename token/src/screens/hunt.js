// hunt.js — THE HUNT (WP5 placeholder). The hunt resolves statistically inside
// the engine when you spend your focus on it; this screen is the button-and-text
// stand-in that WP6 replaces with the whack-a-mole skin. It reports the fixed
// count and the formula in words — never how many bugs surfaced or how deep the
// pool was (a low-Understanding hunt is meant to look calm, not degraded).

export function render(c) {
  const { h, vs, huntResult } = c;
  const fixed = huntResult ? huntResult.fixed : 0;
  const ammo = huntResult ? huntResult.ammo : 0;

  return `
    <div class="screen center">
      ${h.strip(vs)}
      <div class="spacer"></div>
      <h2 class="sub">The Hunt</h2>
      <div class="card" style="max-width:460px;text-align:left">
        <div class="small dim">What surfaces scales with your hidden Debugging Understanding;
        what you can carry is capped by your review capacity (ammo). Overflow returns to the pool.</div>
        <div class="hi" style="margin-top:8px;font-size:1.2em">You fixed ${fixed} ${fixed === 1 ? 'bug' : 'bugs'}.</div>
        <div class="small dim">Ammo carried into the hunt: ${ammo}.</div>
        <div class="small dim">(WP6 will make this a 45-second whack-a-mole. The math above is already live.)</div>
      </div>
      <div class="spacer"></div>
      <div class="menu" style="width:100%;max-width:420px">
        ${h.row({ key: 'enter', label: '▶ Continue', attrs: 'data-action="hunt-continue"' })}
      </div>
    </div>`;
}
