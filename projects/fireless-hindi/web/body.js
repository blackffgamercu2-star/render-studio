// ============================================================
// body.js — BODY-ACTION system v1 (Library v5, 2026-11-17)
// Parametric body language for the card characters, callable from the
// story layer per beat — the body-level sibling of speak.js (mouth) and
// the emoTrack face system. Abid's rule (salted-mine round 3): characters
// must not stand like posts — they SIT, KNEEL, TURN, LOOK and WINK where
// the story calls for it.
//
// Actions provided:
//   poseWindows(windows)  -> poseAt(f) -> { mode, squash }
//       windows: [{ a, b, mode, inF=6, outF=6 }]  mode: 'sit' | 'kneel' |
//       'kneel1' (bodyFront modes in toon.js v5). Outside a window the
//       pose is 'stand'. During inF/outF transition frames `squash`
//       compresses the card toward its sole so the mode switch reads as
//       weight shifting, never a pop. Merge into the actor:
//         const P = poseAt(f);
//         opts.mode = P.mode; opts.squash = Math.max(opts.squash||0, P.squash);
//       Ground contact: sit/kneel/kneel1 all keep sole ON the ground line
//       (knees / folded legs touch it) and the actor's y NEVER changes —
//       the figure shortens INSIDE the card — so the collision ground
//       gate (which flags any y < ground as sunk) stays green.
//   turnTrack(events)     -> turnAt(f) -> { yaw, hop, squash }
//       events: [{ f0, dur=12, dir=1, turns=1 }] — a body yaw turn WITH a
//       step feel: two small hops + a squash on landing, yaw eased with
//       M.easeInOut (slow-fast-slow, never a snap). yaw is CUMULATIVE
//       (events add up), so a character can turn away and later turn back
//       with a second event of dir -1. Merge: extra.yaw += T.yaw;
//       extra.y += T.hop; opts.squash = max(..., T.squash).
//   gazeTrack(events)     -> gazeAt(f) -> { look, lookY, facing, tilt }
//       events: [{ f, look, lookY, facing, tilt, ramp=8 }] — head + gaze
//       turns INDEPENDENT of the body (look left/right at named subjects).
//       Morphs between events with smootherstep, exactly like emoTrack.
//       Feed the result into the head/face params (look/lookY drive the
//       pupils in toon.js faceP; facing turns the whole head blob).
//   winkTrack(windows)    -> winkAt(f) -> 0..1
//       windows: [{ a, b }] — a wink envelope: 2f close, hold, 3f open.
//       Blend the face toward the 'wink' expression by this amount:
//         exprP = T.blendFaceP(exprP, T.faceP('wink', seed), winkAt(f));
//       Use on the trickster's plan beat / a smug payoff — one eye, tied
//       to the expression system, never a frozen lid.
//   pointLook(dir)        -> { prop, look, facing }
//       Point-while-looking: the head and gaze FOLLOW the pointing hand.
//       dir: -1 left, 0 ahead, 1 right. Spread into the actor opts and
//       head params together so hand, head and eyes agree on the target.
//
// All functions are pure in f (deterministic, random-access safe) so the
// gates (sweep / collision / jerk) and the renderer can sample any frame.
// ============================================================
import { M, clamp, lerp, ramp } from './motion.js';

const smooth = (t) => M.smooth(clamp(t));

/** Pose windows: sit / kneel / kneel1 with weight-shift transitions. */
export const poseWindows = (windows) => (f) => {
  for (const w of windows) {
    const inF = w.inF ?? 6, outF = w.outF ?? 6;
    if (f >= w.a && f <= w.b) {
      const tin = smooth((f - w.a) / Math.max(1, inF));
      const tout = smooth((w.b - f) / Math.max(1, outF));
      const edge = Math.min(tin, tout);            // 0 at the switch frames, 1 settled
      return { mode: w.mode, squash: 0.12 * (1 - edge) };
    }
  }
  return { mode: 'stand', squash: 0 };
};

/** Body yaw turns with a step feel (two hops + landing squash). */
export const turnTrack = (events) => (f) => {
  let yaw = 0, hop = 0, squash = 0;
  for (const e of events) {
    const dur = e.dur ?? 12, turns = e.turns ?? 1, dir = e.dir ?? 1;
    if (f < e.f0) continue;
    const u = clamp((f - e.f0) / dur);
    yaw += dir * turns * Math.PI * M.easeInOut(u);
    if (u < 1) {
      hop = Math.max(hop, 0.035 * Math.abs(Math.sin(u * Math.PI * 2)));   // two steps
      squash = Math.max(squash, 0.08 * Math.sin(u * Math.PI));            // weight through the turn
    }
  }
  return { yaw, hop, squash };
};

/** Head + gaze track, independent of the body (look left/right/up/down). */
export const gazeTrack = (events) => {
  const evs = [...events].sort((a, b) => a.f - b.f);
  const base = { look: 0, lookY: 0, facing: 0, tilt: 0 };
  return (f) => {
    let cur = { ...base };
    for (const e of evs) {
      if (f < e.f) break;
      const k = smooth((f - e.f) / Math.max(1, e.ramp ?? 8));
      for (const key of ['look', 'lookY', 'facing', 'tilt'])
        if (e[key] !== undefined) cur[key] = lerp(cur[key], e[key], k);
    }
    return cur;
  };
};

/** Wink envelope: quick close, hold, soft open. Blend toward faceP('wink'). */
export const winkTrack = (windows) => (f) => {
  for (const w of windows) {
    if (f >= w.a && f <= w.b) {
      const up = clamp((f - w.a) / 2), down = clamp((w.b - f) / 3);
      return Math.min(up, down, 1);
    }
  }
  return 0;
};

/** Point-while-looking: hand, head and gaze on the same target. */
export const pointLook = (dir = 1, k = 0.8) => ({
  prop: ['point', dir * k],
  look: dir * 0.55, facing: dir * 0.30, lookY: 0.15,
});

// ============================================================
// ANIMATION UPGRADE v2 (2026-11-18 — Abid's order: "character robot
// jaisa khada hoke na bole" — nobody stands like a robot, not even
// while speaking; expressions, body movement, leg movement and
// hand/object grips must all read physical and real). Four systems,
// all pure functions of the frame, inherited by every future build:
//
//   emoTrack(faceP, initial, events) — emotion morphs at story beats
//       (smootherstep blends between named faces; moved here from the
//       story layer so every build shares one implementation).
//       events: [[frame, faceName, morphFrames], ...]
//       Usage: const P = emo.at(f); opts.exprP = P.
//
//   lifeAt({ seed, shift, swayAmp }) — CONTINUOUS LIFE for any figure
//       standing in frame: at(f) -> { breath, tilt, sway }.
//       breath: pass straight to bodyFront's breath opt (chest/head
//       settle on a ~108-frame cycle, phase-offset per seed).
//       tilt: a slow weight-shift lean (degrees) foot to foot — feed
//       into the actor's head()/tilt so the body never locks.
//       sway: a smaller faster torso sway, add to tilt for speakers.
//
//   gripAt(events) — PHYSICAL GRIPS with weight. events:
//       [{ f0, dur, type: 'lift' | 'place', settle }]
//       at(f) -> { k, squash, holding }.
//       k: 0 = object down / hand low, 1 = object up / hand on. Feed
//       the SAME k into the arm prop (['kind', k] / carry) and into
//       the object's own world track — hand and object then move in
//       the same frames. A lift strains (squash swells mid-lift as
//       the body takes the weight, then a settle pulse at the top);
//       a place ends with a contact settle pulse (the landing dip).
//       holding: 1 while the object is carried between lift & place.
//
//   gestureAt(events) — DIALOGUE GESTURE: while a character performs
//       a spoken line, the free hand talks with the voice: k rides a
//       speech-rhythm oscillation plus emphasis pulses at `beats`
//       frames (word stresses). events: [{ a, b, beats, base, amp }]
//       at(f) -> { k, on }. Outside events: { k: base rest, on: 0 }.
//
//   stridePh(x0, x, stride) — march/stroll phase from distance
//       travelled (shared form of the story-level run() helper), so
//       feet plant with the ground: no glide.
// ============================================================

/** Emotion morph track: smootherstep blends between named faces. */
export const emoTrack = (faceP, initial, events) => ({
  at(f) {
    let from = faceP(initial), to = from, t0 = 0, dur = 0;
    const seg = (g) => {
      if (dur <= 0 || g >= t0 + dur) return { ...to };
      if (g <= t0) return { ...from };
      const u = (g - t0) / dur, s = u * u * u * (u * (u * 6 - 15) + 10), o = {};
      for (const k in to) o[k] = from[k] + (to[k] - from[k]) * s;
      return o;
    };
    for (const [ef, name, ed] of events) {
      if (ef > f) break;
      from = seg(ef); to = faceP(name); t0 = ef; dur = Math.max(1, ed);
    }
    return seg(f);
  },
});

/** Continuous life: breathing + weight shift + micro sway. */
export const lifeAt = ({ seed = 1, shift = 1.4, swayAmp = 0.7 } = {}) => (f) => ({
  breath: f + seed * 41,
  tilt: shift * Math.sin(f * 0.011 + seed * 2.3) + swayAmp * Math.sin(f * 0.023 + seed * 1.7),
  sway: 0.6 * Math.sin(f * 0.017 + seed * 1.7),
});

/** Physical grips: lift / place / hold with weight and settle. */
export const gripAt = (events) => {
  const evs = [...events].sort((a, b) => a.f0 - b.f0);
  return (f) => {
    let k = 0, squash = 0, holding = 0;
    for (const e of evs) {
      const dur = e.dur || 16, end = e.f0 + dur, settle = e.settle ?? 8;
      if (f < e.f0) break;
      if (e.type === 'lift') {
        if (f <= end) {
          const u = clamp((f - e.f0) / dur);
          k = smooth(u); holding = u > 0.85 ? 1 : 0;
          squash = Math.max(squash, 0.10 * Math.sin(Math.PI * Math.min(1, u * 1.12)));
        } else {
          k = 1; holding = 1;
          if (f <= end + settle) squash = Math.max(squash, 0.07 * Math.sin(Math.PI * (f - end) / settle));
        }
      } else { // place
        if (f <= end) {
          const u = clamp((f - e.f0) / dur);
          k = 1 - smooth(u); holding = u < 0.9 ? 1 : 0;
        } else {
          k = 0; holding = 0;
          if (f <= end + settle) squash = Math.max(squash, 0.13 * Math.sin(Math.PI * (f - end) / settle));
        }
      }
    }
    return { k, squash, holding };
  };
};

/** Dialogue gesture: the free hand talks with the voice. */
export const gestureAt = (events) => (f) => {
  for (const e of events) {
    if (f >= e.a && f <= e.b) {
      const base = e.base ?? 0.45, amp = e.amp ?? 0.16;
      let k = base + amp * Math.sin((f - e.a) * 0.62) * (0.4 + 0.6 * Math.abs(Math.sin((f - e.a) * 0.09 + 1)));
      for (const bf of e.beats || []) {
        const d = Math.abs(f - bf);
        if (d <= 5) k += 0.22 * (1 - d / 5);
      }
      return { k: clamp(k, 0.05, 0.95), on: 1 };
    }
  }
  return { k: 0.5, on: 0 };
};

/** March/stroll phase from distance travelled — feet plant, no glide. */
export const stridePh = (x0, x, stride = 1.05) => Math.abs(x - x0) / stride % 1;
