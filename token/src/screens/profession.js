// profession.js — PROFESSION screen. Pick your class: portrait, starting skill
// bars (calibrated at t=0, so this is the archetype profile, not a leak), and the
// score multiplier stated plainly. Renders however many classes data/classes.js
// ships (1 stub now, 4 after WP2).

const AVATAR = { vibe: '🧑‍💻', bootcamp: '🎓', greybeard: '🧔', craftsperson: '🛠️' };

function skillBars(h, skills) {
  return ['coding', 'debugging', 'judgment'].map((k) =>
    `<div class="small"><span class="dim caps">${k.slice(0, 4)}</span> ${h.bar(skills[k] || 0, 100, 10)}</div>`
  ).join('');
}

export function render(c) {
  const { h } = c;
  const cards = h.classes.map((cls, i) => {
    const av = AVATAR[cls.id] || '👤';
    return `
      <button class="row" data-key="${i + 1}" data-action="pick-class" data-class="${h.esc(cls.id)}"
              style="align-items:flex-start;flex-direction:column;gap:4px">
        <div style="display:flex;gap:8px;align-items:center;width:100%">
          <span class="key">${i + 1}</span>
          <span style="font-size:22px">${av}</span>
          <span class="lab hi">${h.esc(cls.name)}</span>
          <span class="det">×${cls.multiplier} pts</span>
        </div>
        ${skillBars(h, cls.skills)}
        <div class="small dim">Starting cash ${h.money(cls.cash)}</div>
      </button>`;
  }).join('');

  return `
    <div class="screen scroll">
      <h2 class="sub">Choose your profession</h2>
      <div class="dim small">The harder the road, the higher the score. Bars are where
      you start; the truth drifts from here.</div>
      <div class="menu" style="margin-top:6px">${cards}</div>
    </div>`;
}
