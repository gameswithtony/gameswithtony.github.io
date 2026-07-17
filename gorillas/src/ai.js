// Adaptive shooter, analytically seeded (SPEC §11). Not a sniper: it opens
// with a plausible coarse solve, observes its signed miss, and walks shots in.
// Correction memory lives for a single round — each round is a new world
// (§4.1) — and persists turn to turn within it.
//
// env.simulate(angle, power) is a closure the game builds around the SAME
// flight code path the real banana uses (Invariant 5) — this module never
// approximates physics itself.

import { MAX_SPEED, GORILLA_W } from './config.js';

const PARAMS = {
  easy:   { openA: 12,  openP: 12,  gain: 0.38, overQ: 0.45, overM: 1.8,  jitA: 3.0, jitP: 3.5 },
  medium: { openA: 7,   openP: 7,   gain: 0.62, overQ: 0.18, overM: 1.4,  jitA: 1.6, jitP: 1.8 },
  hard:   { openA: 3.5, openP: 3.5, gain: 0.85, overQ: 0.06, overM: 1.15, jitA: 0.8, jitP: 0.9 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Approximate normal in [-3, 3], sigma ≈ 0.9
function gauss(rng) {
  return (rng.next() + rng.next() + rng.next()) * 2 - 3;
}

export function createAiState() {
  return {
    lastShot: null,   // { angle, power, wind, time, missAlong, blocked, blockedCount }
    solved: null,     // { angle, power, wind, time } — a shot that connected
    solvedMisses: 0,
    shotsFired: 0,
    futileCount: 0,   // consecutive throws with no forward progress — arms tunneling
  };
}

// Last-resort tunneling (§11.3): pinned against a tall neighbor with the wind
// hard against us, every steep lob just blows back behind us — the correction
// loop can't walk that in. Instead, bite into the blocking wall at the lowest
// angle that connects; a few carves open a flatter corridor toward the target.
// Only reached after consecutive futile throws — normal play never tunnels
// (a mid-map blocker has its own lob/hammer logic in computeShot).
function tunnelShot(env) {
  const { rng, dir } = env;
  const R = Math.abs(env.targetX - env.meX);
  for (let a = 30; a <= 62; a += 4) {         // lowest workable angle wins
    const angle = clamp(a + rng.range(-2, 2), 20, 85);
    const power = clamp(52 + rng.range(0, 12), 12, 100);
    const o = env.simulate(angle, power).outcome;
    if (o.type === 'gorilla') continue;       // digging, not sniping (§11.2)
    const progress = (o.x - env.meX) * dir;
    if (o.type === 'terrain' && progress > GORILLA_W && progress < R * 0.55) {
      return { angle, power };
    }
  }
  return null;   // no wall bites — the corridor is open (or this isn't a wall problem)
}

// Coarse ballistic solve: R = v² sin(2θ) / g, two wind-drift refinements.
function openingSolve(env, P) {
  const { rng, gravity, wind, dir } = env;
  const R = Math.abs(env.targetX - env.meX);
  const angle = rng.range(40, 70);
  const rad = (angle * Math.PI) / 180;
  let rEff = R;
  let v = 300;
  for (let i = 0; i < 3; i++) {
    rEff = Math.max(60, rEff);
    v = Math.sqrt((rEff * gravity) / Math.max(0.2, Math.sin(2 * rad)));
    const T = (2 * v * Math.sin(rad)) / gravity;
    const driftAlong = 0.5 * wind * T * T * dir;
    rEff = R - driftAlong;
  }
  let power = (v / MAX_SPEED) * 100;
  return {
    angle: angle + gauss(env.rng) * P.openA,
    power: power + gauss(env.rng) * P.openP,
  };
}

export function computeShot(env) {
  const P = PARAMS[env.difficulty] || PARAMS.medium;
  const { rng, dir, mem } = env;
  const R = Math.abs(env.targetX - env.meX);
  let angle;
  let power;

  // Worst-case escape hatch: nothing we throw lands ahead of us. Dig.
  // Returned directly — the verification loop below would reject a
  // deliberate wall shot as stillborn and steepen it right back into the
  // futile lob. (`|| 0`: resumed matches may carry a mem without the field.)
  if ((mem.futileCount || 0) >= 2) {
    const dig = tunnelShot(env);
    if (dig) return dig;
    // Corridor open — restart clean rather than correct off a wall shot.
    mem.futileCount = 0;
    mem.lastShot = null;
  }

  if (mem.solved) {
    // Reuse the converged solution, compensating for any wind change since.
    angle = mem.solved.angle;
    power = mem.solved.power;
    const dw = env.wind - mem.solved.wind;
    const T = mem.solved.time || 2.5;
    const driftAlong = 0.5 * dw * T * T * dir;
    // range ∝ v² → dR/R = 2·dv/v
    power *= 1 + (-driftAlong) / (2 * Math.max(R, 60));
    angle += gauss(rng) * P.jitA * 0.5;
    power += gauss(rng) * P.jitP * 0.5;
  } else if (mem.lastShot) {
    const L = mem.lastShot;
    angle = L.angle;
    power = L.power;
    // Fold the wind change since last shot into the observed miss.
    const dw = env.wind - L.wind;
    const missAlong = L.missAlong + 0.5 * dw * L.time * L.time * dir;
    let dP = ((-missAlong) / (2 * Math.max(R, 60))) * power * P.gain;
    if (rng.chance(P.overQ)) dP *= P.overM;   // humans overcorrect
    dP = clamp(dP, -18, 18);
    power += dP;

    if (L.blocked) {
      // The building between us again. Sometimes lob over it; sometimes keep
      // hammering the same divot — that is how tunnels get dug (§7.1).
      const mustLob = L.blockedCount >= 4;
      if (mustLob || rng.chance(0.5)) {
        angle += rng.range(6, 14);
        power += rng.range(1, 4);
      } else {
        angle += gauss(rng) * 1.2;
        power = L.power + rng.range(0.5, 2.5);
      }
    }
    angle += gauss(rng) * P.jitA;
    power += gauss(rng) * P.jitP;
  } else {
    ({ angle, power } = openingSolve(env, P));
  }

  angle = clamp(angle, 20, 85);
  power = clamp(power, 12, 100);

  // Verification, not omniscience (§11.2): reject only shots the sim shows
  // dying immediately — clipping our own roof or killing ourselves. Never
  // search until a hit lands.
  for (let tries = 0; tries < 6; tries++) {
    const res = env.simulate(angle, power);
    const o = res.outcome;
    const selfKill = o.type === 'gorilla' && o.player === env.shooterIdx;
    const progress = (o.x - env.meX) * dir;
    const stillborn = o.type !== 'gone' && progress < R * 0.3 && o.type !== 'gorilla';
    if (!selfKill && !stillborn) break;
    angle = clamp(angle + 7 + rng.range(0, 4), 20, 88);
    power = clamp(power + 4, 12, 100);
  }

  return { angle, power };
}

export function observe(mem, rep) {
  mem.shotsFired++;
  const { dir } = rep;
  const R = Math.abs(rep.targetX - rep.meX);
  const o = rep.outcome;
  let missAlong = (o.x - rep.targetX) * dir;
  const progress = (o.x - rep.meX) * dir;

  if (o.type === 'gorilla' && o.player === rep.targetIdx) {
    mem.solved = { angle: rep.angle, power: rep.power, wind: rep.wind, time: rep.time };
    mem.solvedMisses = 0;
    mem.futileCount = 0;
    mem.lastShot = null;
    return;
  }

  // No meaningful forward progress — blown back behind us or dead at our
  // feet. Consecutive futile throws arm last-resort tunneling (§11.3).
  mem.futileCount = progress < R * 0.12 ? (mem.futileCount || 0) + 1 : 0;

  if (mem.solved) {
    // The stored solution missed under new conditions; tolerate one fluke.
    mem.solvedMisses++;
    if (mem.solvedMisses >= 2) {
      mem.solved = null;
      mem.solvedMisses = 0;
    }
  }

  if (o.type === 'gone') {
    // Off the edge of the world: a huge overshoot. Correct hard.
    missAlong = Math.max(missAlong, R * 0.9);
  }

  const blocked = o.type === 'terrain' &&
    progress > R * 0.12 && progress < R * 0.92 && missAlong < 0;
  const prevCount = mem.lastShot ? mem.lastShot.blockedCount : 0;

  mem.lastShot = {
    angle: rep.angle,
    power: rep.power,
    wind: rep.wind,
    time: rep.time,
    missAlong,
    blocked,
    blockedCount: blocked ? prevCount + 1 : 0,
  };
}
