// @ts-check
// The 5×7 procedural bitmap font (SPEC §10.8, revised 2026-08-04). Glyph set is what clues
// need — 0-9, '-' and '+', with the range and open-ended forms shipping now so the skill tiers
// of SPEC §7.2 are purely additive — plus 'A' through 'H' since 2026-08-05, which is what the
// endpoints wear. Every glyph is bit rows drawn as art-pixel fillRects; `fillText` never
// touches the board canvas.
//
// WHY EIGHT LETTERS AND NOT AS MANY AS TODAY'S LEVELS USE. A level's stops are named down the
// alphabet from the origin's 'A', so the glyph a board asks for is a function of how many
// destinations somebody authored into it. Cutting the table at the current corpus would mean a
// level author's ordinary Tuesday afternoon producing a blank tile, and the missing-glyph path
// in `drawText` is a silent skip: the board would say nothing rather than say something wrong.
// 'H' is exactly where the charmap legend stops (grid.js's `LAST_DEST`), so a table that runs
// to 'H' is a table the level format can never outrun, for eight rows of it.
//
// Why 5×7 and not 6×8: a clue may be a RANGE, three glyphs wide, and three glyphs have to fit
// inside one 16-art-pixel tile or they bleed onto the neighbouring cell. 5×7 at the default
// one-pixel gap is 17 art px — one over — and at gap 0 it is 15, which fits. So callers that
// must stay inside a tile pass `gap`; the '-' glyph is drawn three pixels wide with blank
// columns either side precisely so a tightened range still reads as three separate marks.

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const GLYPH_GAP = 1;

/**
 * Rows top→bottom; five bits each, most significant bit is the leftmost art pixel.
 * @type {Readonly<Record<string, number[]>>}
 */
const GLYPHS = Object.freeze({
  '0': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  '-': [0b00000, 0b00000, 0b00000, 0b01110, 0b00000, 0b00000, 0b00000],
  '+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
  // The endpoint letters. Same five columns, same seven rows and the same one-art-pixel strokes
  // as the digits, so a 'B' on one tile and a '3' on the tile beside it read as one alphabet
  // rather than as two fonts sharing a board.
  'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
});

/**
 * @param {string} text
 * @param {number} [gap]  art pixels between glyphs; 0 tightens a range to fit one tile
 * @returns {number} width in art pixels (0 when nothing is drawable)
 */
export function textWidthArt(text, gap = GLYPH_GAP) {
  let glyphs = 0;
  for (const ch of text) if (GLYPHS[ch]) glyphs++;
  return glyphs === 0 ? 0 : glyphs * GLYPH_W + (glyphs - 1) * gap;
}

/**
 * Draw at an exact device-pixel top-left, one fillRect per lit art pixel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x   device px, integer
 * @param {number} y   device px, integer
 * @param {number} artPx
 * @param {string} color
 * @param {number} [gap]
 */
export function drawText(ctx, text, x, y, artPx, color, gap = GLYPH_GAP) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    for (let r = 0; r < GLYPH_H; r++) {
      const bits = g[r];
      if (bits === 0) continue;
      // Runs, not single pixels: a solid row of a 5-wide glyph is one fillRect instead of
      // five, which matters now that a clue digit is 35 art pixels rather than 15.
      let c = 0;
      while (c < GLYPH_W) {
        if (!(bits & (1 << (GLYPH_W - 1 - c)))) { c++; continue; }
        let n = 1;
        while (c + n < GLYPH_W && (bits & (1 << (GLYPH_W - 1 - c - n)))) n++;
        ctx.fillRect(cx + c * artPx, y + r * artPx, n * artPx, artPx);
        c += n;
      }
    }
    cx += (GLYPH_W + gap) * artPx;
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
 * @param {number} [gap]
 */
export function drawTextCentered(ctx, text, cx, cy, artPx, color, gap = GLYPH_GAP) {
  const w = textWidthArt(text, gap) * artPx;
  const h = GLYPH_H * artPx;
  const x = Math.round((cx - w / 2) / artPx) * artPx;
  const y = Math.round((cy - h / 2) / artPx) * artPx;
  drawText(ctx, text, x, y, artPx, color, gap);
}
