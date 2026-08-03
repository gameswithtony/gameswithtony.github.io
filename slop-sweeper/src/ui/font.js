// @ts-check
// The 3×5 procedural bitmap font (SPEC §10.8). Glyph set is exactly what clues need:
// 0-9, '-' and '+' — the range and open-ended forms ship now so the skill tiers of
// SPEC §7.2 are purely additive. Every glyph is bit rows drawn as art-pixel fillRects;
// `fillText` never touches the board canvas.

export const GLYPH_W = 3;
export const GLYPH_H = 5;
export const GLYPH_GAP = 1;

/**
 * Rows top→bottom; three bits each, most significant bit is the leftmost art pixel.
 * @type {Readonly<Record<string, number[]>>}
 */
const GLYPHS = Object.freeze({
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
  '+': [0b000, 0b010, 0b111, 0b010, 0b000],
});

/**
 * @param {string} text
 * @returns {number} width in art pixels (0 when nothing is drawable)
 */
export function textWidthArt(text) {
  let glyphs = 0;
  for (const ch of text) if (GLYPHS[ch]) glyphs++;
  return glyphs === 0 ? 0 : glyphs * GLYPH_W + (glyphs - 1) * GLYPH_GAP;
}

/**
 * Draw at an exact device-pixel top-left, one fillRect per lit art pixel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x   device px, integer
 * @param {number} y   device px, integer
 * @param {number} artPx
 * @param {string} color
 */
export function drawText(ctx, text, x, y, artPx, color) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    for (let r = 0; r < GLYPH_H; r++) {
      const bits = g[r];
      for (let c = 0; c < GLYPH_W; c++) {
        if (bits & (1 << (GLYPH_W - 1 - c))) {
          ctx.fillRect(cx + c * artPx, y + r * artPx, artPx, artPx);
        }
      }
    }
    cx += (GLYPH_W + GLYPH_GAP) * artPx;
  }
}

/**
 * Centre a string inside a box, snapped to whole art pixels so glyphs stay on the grid.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} cx  device px centre
 * @param {number} cy  device px centre
 * @param {number} artPx
 * @param {string} color
 */
export function drawTextCentered(ctx, text, cx, cy, artPx, color) {
  const w = textWidthArt(text) * artPx;
  const h = GLYPH_H * artPx;
  const x = Math.round((cx - w / 2) / artPx) * artPx;
  const y = Math.round((cy - h / 2) / artPx) * artPx;
  drawText(ctx, text, x, y, artPx, color);
}
