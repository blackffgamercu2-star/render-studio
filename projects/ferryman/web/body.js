// ============================================================
// body.js — BODY-ACTION system v2 (Library v6, 2026-11-18)
// Parametric body language for the card characters, callable from the
// story layer per beat — the body-level sibling of speak.js (mouth) and
// the emoTrack face system. Abid's rule (salted-mine round 3): characters
// must not stand like posts — they SIT, KNEEL, TURN, LOOK and WINK where
// the story calls for it.
//
// v2 — THE ANIMATION UPGRADE (Abid, 2026-11-18: "character robot jaisa
// khada hoke na bole — expressions, body hilna, pair ki movement, haath
// ki pakad sab physical aur real jaisa"). New in v2:
//   lifeAt(f, seed)      -> CONTINUOUS LIFE for every standing figure:
//       breathing phase (feed opts.breath), weight shifting foot to
//       foot (tilt sway), counter head-tilt, micro squash — a still
//       grabbed mid-narration must show everyone ALIVE.
//   emoTrack(events)     -> EXPRESSION MORPHS as a pure track: the face
//       glides between named emotions at story beats (wonder -> anger
//       -> calm -> shock -> humiliation -> laughter), smootherstep
//       morphs, never a snap. Returns FACEP params (feed opts.exprP).
//   gripTrack(keys)      -> PHYSICAL GRIPS: per-hand keyframed hand
//       targets in card units {x, y, grip}. Feed into opts.armPose
//       (toon.js v6 honours it: the arm bends to put the hand exactly
//       there and draws finger wraps when grip > 0). The held object
//       is drawn from the SAME track in the actor overlay, so hand and
//       object move in the same frames — the hand visibly WRAPS the
//       object. Ease = M.easeInOut; a held load adds carryDip squash.
//   gestureAt(f, seed)   -> dialogue GESTURE driver: emphatic hand
//       arcs for a speaking character (combine with speak nod pulses),
//       so a performed line is hands + body sway, never just a mouth.
//   jumpTrack(events)    -> physical HOPS: jump-back from a steam
//       burst, startle flinches, landing squash + lean. Returns
//       { y (world lift), dx (lateral), squash, lean }.
//   carryDip(f, load)    -> weight read while carrying: body dip +
//       effort bob proportional to load (0..1).
//
// v1 actions (unchanged):
//   poseWindows(windows)  -> poseAt(f) -> { mode, squash }
//       windows: [{ a, b, mode, inF=6, outF=6 }]  mode: 'sit' | 'kneel' |
//       'kneel1' (bodyFront modes in toon.js). Outside a window the pose
//       is 'stand'. During inF/outF transition frames `squash`
//       compresses the card toward its sole so the mode switch reads as
//       weight shifting, never a pop. Merge into the actor:
//         const P = poseAt(f);
//         opts.mode = P.mode; opts.squash = Math.max(opts.squash||0, P.squash);
//       Ground contact: sit/kneel/kneel1 all keep sole ON the ground line
//       and the actor's y NEVER changes — the figure shortens INSIDE the
//       card — so the collision ground gate stays green.
//   turnTrack(events)     -> turnAt(f) -> { yaw, hop, squash }
//       events: [{ f0, dur=12, dir=1, turns=1 }] — a body yaw turn WITH a
//       step feel: two small hops + a squash on landing, yaw eased with
//       M.easeInOut. yaw is CUMULATIVE (events add up).
//   gazeTrack(events)     -> gazeAt(f) -> { look, lookY, facing, tilt }
//       events: [{ f, look, lookY, facing, tilt, ramp=8 }] — head + gaze
//       turns INDEPENDENT of the body. Morphs with smootherstep.
//   winkTrack(windows)    -> winkAt(f) -> 0..1 (blend toward 'wink').
//   pointLook(dir)        -> { prop, look, facing } — point-while-looking.
//
// All functions are pure in f (deterministic, random-access safe) so the
// gates (sweep / collision / jerk) and the renderer can sample any frame.
// ============================================================
import { M, clamp, lerp, ramp } from './motion.js';
import { faceP, blendFaceP } from './toon.js';

const smooth = (t) => M.smooth(clamp(t));

// ---------------- v1 (unchanged) ----------------

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

// ---------------- v2 — THE ANIMATION UPGRADE ----------------

/**
 * CONTINUOUS LIFE. Returns the idle-life params for a standing figure:
 *   breath — phase value for bodyFront's opts.breath (chest/head settle)
 *   tilt   — whole-body weight-shift sway, degrees (feed opts.tilt)
 *   headTilt — counter head tilt, degrees (feed head params)
 *   squash — micro weight squash 0..~0.03
 *   swayX  — tiny card-space lean offset for overlays that follow the body
 * Periods are long (breath ~3.4 s, shift ~7 s) and seeded per character
 * so a crowd never breathes in sync.
 */
export const lifeAt = (f, seed = 1) => {
  const br = f + seed * 41;                                   // breath phase (bodyFront scales it)
  const shift = Math.sin((f + seed * 67) * 0.029 + seed);     // slow weight shift L<->R
  const settle = Math.sin((f + seed * 67) * 0.058 + seed * 2) * 0.3;
  return {
    breath: br,
    tilt: shift * 1.15 + settle * 0.4,
    headTilt: -shift * 1.7 + Math.sin((f + seed * 31) * 0.021 + seed * 3) * 0.9,
    squash: 0.016 + 0.012 * (0.5 + 0.5 * Math.sin((f + seed * 41) * 0.0582)),
    swayX: shift * 3.2,
  };
};

/**
 * EXPRESSION MORPH TRACK. events: [{ f, expr, morph=9 }] — the track
 * folds them in time order. Before the first event the face is the
 * first event's expression (or 'neutral' when the list is empty). Each
 * event morphs from the previous target over `morph` frames with
 * smootherstep — the face MATCHES the beat and glides, never snaps.
 * Returns FACEP (feed opts.exprP).
 */
export const emoTrack = (events, seed = 0) => {
  const evs = events.map((e) => Array.isArray(e) ? { f: e[0], expr: e[1], morph: e[2] } : e)
    .sort((a, b) => a.f - b.f);
  return (f) => {
    if (!evs.length) return faceP('neutral', seed);
    let cur = faceP(evs[0].expr, seed);
    for (let i = 1; i < evs.length; i++) {
      const e = evs[i];
      if (f < e.f) break;
      const target = faceP(e.expr, seed);
      const k = smooth((f - e.f) / Math.max(1, e.morph ?? 9));
      cur = k >= 1 ? target : blendFaceP(cur, target, k);
      if (k < 1) break;
    }
    return cur;
  };
};

/**
 * PHYSICAL GRIP TRACK — one hand. keys: [{ f, x, y, grip=0 }] in card
 * units (600x1000 card space). Between keys the hand travels with
 * M.easeInOut (accelerate, decelerate — a reaching hand, not a slide);
 * `grip` (0 open .. 1 fully wrapped) eases on its own shorter curve so
 * fingers close AS the hand lands on the object. Before the first key /
 * after the last, the hand holds. Feed the result into opts.armPose
 * ({ L: {hand:[x,y], grip, front:true}, R: {...} }) AND draw the held
 * object from the same numbers in the actor overlay — hand and object
 * then move in the same frames, and lifting reads as weight when the
 * caller adds carryDip squash.
 */
export const gripTrack = (keys) => {
  const ks = [...keys].sort((a, b) => a.f - b.f);
  return (f) => {
    if (!ks.length) return null;
    if (f <= ks[0].f) { const k = ks[0]; return { x: k.x, y: k.y, grip: k.grip ?? 0 }; }
    for (let i = 1; i < ks.length; i++) {
      const a = ks[i - 1], b = ks[i];
      if (f <= b.f) {
        const u = M.easeInOut(clamp((f - a.f) / Math.max(1, b.f - a.f)));
        const gu = smooth(clamp((f - (b.f - Math.min(6, (b.f - a.f) * 0.4))) / 6));
        const gA = a.grip ?? 0, gB = b.grip ?? 0;
        return {
          x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u),
          grip: gB > gA ? lerp(gA, gB, gu) : lerp(gA, gB, u),
        };
      }
    }
    const k = ks[ks.length - 1];
    return { x: k.x, y: k.y, grip: k.grip ?? 0 };
  };
};

/**
 * DIALOGUE GESTURE driver. While a character performs a line, the free
 * hand makes slow emphatic arcs and the body sways — combine the nod
 * pulses from speakdata (pass `nod` 0..1) to punch the hand UP on
 * stressed words. Returns card-space offsets to ADD to a base hand
 * position, plus a body sway tilt (degrees).
 */
export const gestureAt = (f, seed = 1, nod = 0) => {
  const t = f + seed * 57;
  return {
    dx: Math.sin(t * 0.105) * 16 + Math.sin(t * 0.041) * 7,
    dy: -Math.abs(Math.sin(t * 0.073 + 1.2)) * 20 - nod * 26,
    sway: Math.sin(t * 0.052) * 1.5 + nod * 1.2,
  };
};

/**
 * PHYSICAL HOPS — jump-back startles, flinches, little leaps.
 * events: [{ f0, dur=11, h=0.16 (world lift), dx=0 (world lateral),
 *            back=0 (lean-back degrees at the peak) }]
 * Returns { y, dx, squash, lean }: y follows a gravity arc, squash
 * peaks in the frames AFTER touchdown, lean peaks mid-air. Overlapping
 * events take the max.
 */
export const jumpTrack = (events) => (f) => {
  let y = 0, dx = 0, squash = 0, lean = 0;
  for (const e of events) {
    const dur = e.dur ?? 11, h = e.h ?? 0.16;
    const u = (f - e.f0) / dur;
    if (u < 0) continue;
    dx += (e.dx ?? 0) * M.easeOut(clamp(u * 1.15));   // displacement PERSISTS after the hop
    if (u > 1.35) continue;
    if (u <= 1) {
      const arc = Math.sin(Math.PI * Math.pow(u, 0.9));
      y = Math.max(y, h * arc);
      lean = Math.max(lean, (e.back ?? 0) * Math.sin(Math.PI * u));
    }
    const land = clamp((u - 0.92) / 0.28);                    // touchdown squash
    if (u > 0.85) squash = Math.max(squash, 0.15 * Math.sin(Math.PI * clamp(land)));
  }
  return { y, dx, squash, lean };
};

/**
 * WEIGHT while carrying. load 0..1 (jug of water ~0.45, box ~0.8).
 * Returns the squash to ADD while the load is held: a constant dip plus
 * an effort bob at sway frequency — the body works under the load.
 */
export const carryDip = (f, load = 0.5) => load <= 0 ? 0 :
  load * 0.055 + load * 0.018 * Math.sin(f * 0.31);
