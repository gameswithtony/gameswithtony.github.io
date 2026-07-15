// All tunables in one place. See SPEC.md §5 for the derivations; if you retune
// WORLD_W or GRAVITY_DEFAULT, re-derive MAX_SPEED = sqrt(g * WORLD_W).

// --- World / framing (§5.1) ---
export const ARENA_W = 640;        // default framing width — a framing concept, not a boundary
export const ARENA_H = 400;
export const WORLD_W = 2560;       // 4 × ARENA_W
export const GROUND_Y = 400;
export const VIEW_ASPECT = 16 / 9;

// --- Physics (§5.4) ---
export const GRAVITY_DEFAULT = 400;   // u/s²
export const MAX_SPEED = 1000;        // ≈ sqrt(GRAVITY * WORLD_W); full-power 45° ranges ≈ WORLD_W
export const WIND_MAX = 100;          // u/s²
export const DT = 1 / 120;            // fixed physics step
export const EXPLOSION_R = 25;        // carve radius — tied to building widths (§7.5)
export const BANANA_DRAW_R = 4;       // drawing only; terrain collision is a point (§8.1)
export const SWEEP_STEP = 1;          // max spacing of swept collision samples

// --- Actors ---
export const GORILLA_W = 26;          // hit AABB (world units)
export const GORILLA_H = 30;
export const SUN_R = 12;              // cosmetic hit circle (sun never blocks, §8.2)

// --- Terrain generation (§6) ---
export const BUILDING_W_MIN = 40;
export const BUILDING_W_MAX = 90;
export const BUILDING_H_MIN = 60;
export const BUILDING_H_MAX = 320;
export const BUILDING_GAP_MIN = 2;
export const BUILDING_GAP_MAX = 6;

// --- Camera (§9) ---
export const CAM_PAD = 80;
export const CAM_LOOKAHEAD = 0.25;    // seconds of velocity lead
export const CAM_K_OUT = 0.25;        // widening rate (per 60fps frame; rate-scaled by dt)
export const CAM_K_IN = 0.08;         // closing rate — lazy on purpose
export const CAM_DEADZONE = 10;       // world units

// --- LOD thresholds (§13.2), in multiples of ARENA_W ---
export const LOD_SIMPLE_BANANA = 1.6;
export const LOD_NO_PARTICLES = 2.4;
export const LOD_NO_PARALLAX_DETAIL = 3.2;

// --- Input ---
export const DRAG_FULL = 220;         // drag length (u) that maps to power 100
export const GRAB_RADIUS = 70;        // how close to the gorilla a drag may start

// --- Palette (EGA-adjacent, modernized) ---
export const SKY_TOP = '#040f33';
export const SKY_MID = '#0a2a6e';
export const SKY_HORIZON = '#1b47a8';
export const BUILDING_PALETTE = ['#9aa0a8', '#a03434', '#1a9a9a'];  // gray / maroon / teal
export const WINDOW_LIT = '#ffe14d';
export const WINDOW_DARK = '#333a44';
export const GORILLA_BODY = '#ffa851';
export const GORILLA_DETAIL = '#2a1505';
export const BANANA_COLOR = '#ffe14d';
export const SUN_COLOR = '#ffd83d';
export const GROUND_COLOR = '#11161d';
export const GROUND_EDGE = '#2c3a46';
export const PARALLAX_LAYERS = [
  { depth: 1.7, color: '#0d2d63', hMax: 240 },
  { depth: 2.9, color: '#081e49', hMax: 300 },
];
