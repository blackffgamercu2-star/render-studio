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
