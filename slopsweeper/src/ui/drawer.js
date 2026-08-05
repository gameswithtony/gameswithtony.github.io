// @ts-check
// The menu drawer (owner decision 2026-08-05): the level picker, the seed link, the turn
// counter and the remaining count, one tap off the top bar.
//
// It exists because the top bar became walker-first. The most important thing in this game is
// the people standing still, and a bar carrying five chips of equal weight cannot say that —
// so the four items you consult rather than play against moved in here, and the WAITING chip
// got the room to shout (styles.css, and the arithmetic in its media queries).
//
// This module is the PANEL and nothing else. It has no render(): every value inside it is a
// plain DOM node that hud.js already writes on each state change, whether the drawer is open
// or shut, so there is no second copy of "what does the game say right now" in here. That is
// the difference from roster.js, which derives a whole list per turn and therefore has to be
// told when the state moved. Same scrim, same Esc, same toggle-to-dismiss otherwise: the two
// panels are deliberately the same object hung on opposite edges.

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`drawer: missing #${id}`);
  return node;
}

/**
 * @returns {{ toggle: () => void, close: () => void, isOpen: () => boolean }}
 */
export function createDrawer() {
  const root = el('drawer');
  const closeBtn = el('drawer-close');
  let open = false;

  // Tap the scrim — never the card — to dismiss, exactly as the roster does. Between that, the
  // ✕, Esc, and the ☰ that opened it, there are four ways out and none of them needs a label.
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  closeBtn.addEventListener('click', close);

  // Esc, in capture, so it closes this panel instead of reaching the board's own deselect —
  // roster.js's listener to the letter. Only ever swallows the key while this is open, and
  // main.js guarantees the roster is shut whenever it is, so the two can never both claim it.
  window.addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Escape') return;
    close();
    e.stopPropagation();
    e.preventDefault();
  }, true);

  function close() {
    if (!open) return;
    open = false;
    root.classList.add('hidden');
  }

  return {
    /** The ☰ is a toggle: the same tap that opened the drawer puts it away. */
    toggle() {
      if (open) return close();
      open = true;
      root.classList.remove('hidden');
    },

    close,

    /**
     * Asked by main.js on every keystroke: the hotkeys are dead while any panel is open, so
     * a level name typed into the select can never also place a tile.
     */
    isOpen: () => open,
  };
}
