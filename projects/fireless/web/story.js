// ============================================================
// FIRELESS — "The Woman Who Cooked Without Fire" (English, 1845f /
// 61.491 s). SALTED MINE V3 style + "v4" ACTION CAMERA + ANIMATION
// UPGRADE v2 (body.js v2 / toon armPose grips).
//
// STORY: at the fair a woman cooks a whole pot with NO fire — her box
// is lined with quicklime; water in a side channel makes it boil. A
// rival cook shoves through the crowd, slams down a bag of coins and
// bets her (PERFORMED: "Hidden coals! One spark in that box, and every
// coin is mine!"). She pours — steam bursts, the front row JUMPS BACK;
// the stew is bubbling. He seizes the box, tips it, digs bare-handed:
// only white stones. His own stones + water stay cold while the crowd
// roars. She scoops up his coins and closes (PERFORMED): "I never lit
// a fire, friends. The stones make their own heat." Hook board: "But
// tomorrow… the old woman who lifted a cart with one hand?"
//
// ANIMATION UPGRADE (Abid 2026-11-18) — nobody stands like a robot:
//  * CONTINUOUS LIFE: lifeAt() breathing / weight-shift / head counter-
//    tilt on EVERY actor, every frame; gaze follows the action.
//  * EXPRESSIONS: emoTrack() morphs at beats (wonder -> anger -> calm
//    -> shock -> humiliation -> laughter), smootherstep, never a snap.
//  * BODY: torso leans (tilt), dialogue speakers GESTURE (gestureAt +
//    speak nod pulses) and sway while they talk.
//  * LEGS: real march stride on every walk (phase from travelled
//    distance); the front row physically JUMPS BACK at the steam burst
//    (jumpTrack: gravity arc + landing squash + lean-back).
//  * PHYSICAL GRIPS: gripTrack() hand targets -> toon armPose (arm
//    bends to the target, finger wraps draw at grip>0); the held
//    object is drawn from the SAME track in the overlay, so hand and
//    object move in the same frames. Lifts add carryDip weight squash.
//    Grip beats: lid teaser, jug lift+pour (2 hands), lid lift, pot
//    carry-aside + back, box seize+tip (2 hands, box fights back),
//    bare-handed digging, stone scoop + cup splash, coin scoop.
//
// v4 CAMERA: push-ins land in 12-18f at action starts, tracking keys
// follow the rival's shove at his speed, kicks on slam (f362), steam
// burst (f650), box tip (f905), box righted (f1520); one whip reframe
// inside the burst line (f712) onto the jumping front row; everything
// else cuts on clause boundaries. R2 framing: opening hero BIG
// mid-action, inserts 85-95%, dialogue faces >=60%, final = hero +
// hook board (board 80-88%, hero head >=20%).
// ============================================================
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, turnTrack, gazeTrack, winkTrack, lifeAt, emoTrack, gripTrack, gestureAt, jumpTrack, carryDip } from './body.js';
import { circle, aabb, makeWorld } from './solid.js';
import * as TOON from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30;
export const TOTAL = 1845;
export const DECK = 0;

// ---- sections, snapped to timing.json phrase starts (ASR match 0.979,
// tail verified: L17 ends f1837 of 1844) ----
export const TIMING = [
  ['hook', 0, 104], ['box', 105, 206], ['crowd', 207, 306], ['shove', 307, 390],
  ['shout', 391, 510], ['pour', 511, 636], ['burst', 637, 750], ['lid', 751, 852],
  ['tip', 853, 959], ['stones', 960, 1083], ['pan', 1084, 1191], ['laugh', 1192, 1332],
  ['reveal', 1333, 1480], ['heat', 1481, 1581], ['scoop', 1582, 1647], ['line', 1648, 1747],
  ['hookboard', 1748, 1844],
];
export const BND = [104, 206, 306, 390, 510, 636, 750, 852, 959, 1083, 1191, 1332, 1480, 1581, 1647, 1747];
const PH = Object.fromEntries(TIMING.map(([id, a, b]) => [id, { a, b }]));
export const SHOTS = Object.fromEntries(TIMING.map(([id, a, b]) => [id, { a, b, light: 'noon' }]));
export const shotAt = (f) => TIMING.find(([, a, b]) => f >= a && f <= b) ? { id: TIMING.find(([, a, b]) => f >= a && f <= b)[0] } : { id: 'hookboard' };

// ---- Sunny Pop grade (FILTER_VFX_LIGHTING pack): one bright fair-day
// grade for the whole short; boards/text are never graded. ----
export const LIGHTS = {
  noon: { sky: '#a5d6f2', ground: '#86a860', sun: '#fff3d0', fog: '#d8eedb', skyTop: '#79bdf0', skyHor: '#eef6da', sunDisc: '#fff8dc', waterDeep: '#3d7a8c', waterShal: '#82c7cf', glint: '#ffffff', az: 0.62, el: 1.02, hemi: 0.66, sunI: 2.7, fogNear: 30, fogFar: 68, sunSize: 0.05, sat: 1.14, vig: 0.30, shadowExt: 0.34, aurora: 0 },
};
export const lightFor = (sec, f) => LIGHTS.noon;

// ---- world anchors ----
export const BOX = { x: 0.95, z: -4.5, topY: 1.38 };          // lime box on the counter
export const COUNTER = { x0: -1.9, x1: 2.6, z: -4.5, topY: 0.8 };
export const BAG = { x: -0.35, z: -4.4 };                     // coin bag lands here f362
export const PAN = { x: -2.5, z: -4.05, topY: 0.52 };         // rival's pan on its stool
export const BOARD_POS = [0.55, 3.85, -7.6];

// ---- position tracks (piecewise keys, smootherstep between) ----
const posKeys = (keys) => (f) => {
  if (f <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, x0, z0] = keys[i - 1], [f1, x1, z1] = keys[i];
      const u = M.smooth(clamp((f - f0) / Math.max(1, f1 - f0)));
      return [lerp(x0, x1, u), lerp(z0, z1, u)];
    }
  }
  const k = keys[keys.length - 1]; return [k[1], k[2]];
};
const heroinePosRaw = posKeys([
  [0, 0.15, -5.25], [105, 0.15, -5.25], [138, -0.8, -5.3], [505, -0.1, -5.2],
  [532, 0.35, -5.0], [645, 0.3, -5.45], [700, 0.3, -5.45], [751, 0.3, -5.1], [853, 0.42, -5.05], [885, 0.55, -5.0],
  [1333, 0.4, -5.05], [1481, 0.6, -4.95], [1582, -0.45, -5.05], [1648, 0.25, -5.2],
  [1747, 0.25, -5.2], [1792, -2.0, -5.0], [1822, -0.5, -2.15],
]);
const rivalPosRaw = posKeys([
  [0, -5.6, -5.0], [307, -5.6, -5.0], [320, -4.5, -4.35], [338, -3.1, -3.7],
  [352, -1.5, -3.4], [360, -0.3, -3.32], [380, 1.35, -3.25], [935, 1.35, -3.25], [960, 2.6, -3.1], [1084, 2.6, -3.1],
  [1112, -2.15, -3.45], [1748, -2.15, -3.45], [1795, -6.9, -4.7],
]);
// travelled-distance stride phase (real planted steps, no glide)
const distPhase = (raw) => {
  const D = [0];
  for (let f = 1; f < TOTAL; f++) { const a = raw(f - 1), b = raw(f); D[f] = D[f - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return { phase: (f) => (D[clamp(f, 0, TOTAL - 1)] / 0.82) % 1, moving: (f) => f > 0 && (D[clamp(f, 0, TOTAL - 1)] - D[clamp(f - 1, 0, TOTAL - 1)]) > 0.004 };
};
const heroMove = distPhase(heroinePosRaw), rivalMove = distPhase(rivalPosRaw);
export const heroPosAt = (f) => heroinePosRaw(f);

// ---- jump / shove envelopes ----
const burstJump = jumpTrack([{ f0: 650, dur: 12, h: 0.17, back: 9 }]);       // front row
const burstJump2 = jumpTrack([{ f0: 653, dur: 12, h: 0.09, back: 6 }]);      // back row
const rivalFlinch = jumpTrack([{ f0: 648, dur: 10, h: 0.07, back: 7 }]);
const lidFlinch = jumpTrack([{ f0: 792, dur: 9, h: 0.05, back: 4 }]);
const shove1 = jumpTrack([{ f0: 331, dur: 10, h: 0.06, dx: -0.5, back: 7 }]); // blocker 1
const shove2 = jumpTrack([{ f0: 351, dur: 10, h: 0.06, dx: 0.55, back: 7 }]); // blocker 2

// ---- full cast position map (single source for cast + gates) ----
export const posAt = (f) => {
  const sec = shotAt(f).id;
  const bj = burstJump(f), bj2 = burstJump2(f), lf = lidFlinch(f);
  const back = (j, amt) => (sec === 'burst' || sec === 'lid') ? amt * clamp(j.y / 0.17 + (j === lf ? 1 : 0)) : 0;
  const P = {};
  const [hx, hz] = heroinePosRaw(f); P.heroine = { x: hx, z: hz, y: 0 };
  const [rx, rz] = rivalPosRaw(f); const rf = rivalFlinch(f);
  P.rival = { x: rx, z: rz, y: rf.y, squash: rf.squash, lean: rf.lean };
  const s1 = shove1(f), s2 = shove2(f);
  P.b1 = { x: -3.3 + s1.dx - 0.18 * ramp(f, 700, 900) - 1.3 * ramp(f, 1000, 1084), z: -3.1, y: s1.y, squash: s1.squash, lean: s1.lean };
  P.b2 = { x: -1.7 + s2.dx + 0.15 * ramp(f, 700, 900) - 2.35 * ramp(f, 1000, 1084) - 0.9 * (ramp(f, 500, 540) * (1 - ramp(f, 860, 900))), z: -3.2 + 0.9 * (ramp(f, 500, 540) * (1 - ramp(f, 860, 900))), y: s2.y, squash: s2.squash, lean: s2.lean };
  P.fr1 = { x: -1.9 + 0.4 * (ramp(f, 1192, 1230) * (1 - ramp(f, 1332, 1370))) - 0.3 * (bj.y / 0.17 || 0), z: -1.55 + 0.34 * (bj.y / 0.17 || 0), y: bj.y, squash: Math.max(bj.squash, lf.squash), lean: bj.lean };
  P.fr2 = { x: 0.8 + 1.6 * ramp(f, 1748, 1790), z: -1.45 + 0.36 * (bj.y / 0.17 || 0), y: bj.y, squash: Math.max(bj.squash, lf.squash), lean: bj.lean };
  P.fr3 = { x: 2.3 - 1.3 * (ramp(f, 1192, 1230) * (1 - ramp(f, 1332, 1370))) + 0.3 * (bj.y / 0.17 || 0), z: -1.6 + 0.34 * (bj.y / 0.17 || 0), y: bj.y, squash: Math.max(bj.squash, lf.squash), lean: bj.lean };
  P.br1 = { x: -3.1, z: -0.5 + 0.2 * (bj2.y / 0.09 || 0), y: bj2.y, squash: bj2.squash, lean: bj2.lean };
  P.br2 = { x: 1.5 + 1.2 * ramp(f, 1748, 1790), z: -0.35 + 0.2 * (bj2.y / 0.09 || 0), y: bj2.y, squash: bj2.squash, lean: bj2.lean };
  P.kid = { x: 3.6, z: -0.6 + 0.22 * (bj2.y / 0.09 || 0), y: bj2.y * 1.2, squash: bj2.squash, lean: bj2.lean };
  return P;
};

// ---- v4 CAMERA RIG ----
const B = (id) => PH[id].a, E = (id) => PH[id].b;
const KC = (keys, fov) => keysCam({ keys: keys.map(([f, pos, look]) => ({ f, pos, look, fov, ease: 'io' })) });
const RIG_SHOTS = [
  { id: 'hook', cut: 'hard', raw: KC([[0, [0.05, 1.70, -3.30], [0.17, 1.36, -5.2]], [45, [0.08, 1.68, -3.44], [0.17, 1.35, -5.2]], [104, [0.10, 1.67, -3.52], [0.17, 1.35, -5.2]]], 40) },
  { id: 'box', cut: 'hard', raw: KC([[105, [2.0, 1.85, -1.55], [0.92, 0.98, -4.5]], [206, [1.9, 1.80, -1.70], [0.92, 0.97, -4.5]]], 42) },
  { id: 'crowd', cut: 'hard', raw: KC([[207, [-1.9, 1.95, 2.9], [0.0, 1.15, -3.6]], [306, [0.9, 1.85, 2.5], [0.1, 1.2, -3.8]]], 44) },
  { id: 'shove', cut: 'hard', raw: KC([[307, [-4.3, 1.7, -1.2], [-5.4, 1.25, -4.9]], [340, [-2.2, 1.66, -1.15], [-2.9, 1.2, -3.6]], [362, [-0.1, 1.6, -1.35], [-0.3, 1.05, -4.3]], [390, [0.75, 1.62, -1.5], [1.2, 1.25, -3.4]]], 42) },
  { id: 'shout', cut: 'hard', raw: KC([[391, [1.02, 1.58, -1.95], [1.33, 1.38, -3.3]], [510, [1.10, 1.56, -2.12], [1.34, 1.37, -3.3]]], 38) },
  { id: 'pour', cut: 'hard', raw: KC([[511, [-1.5, 2.3, -2.0], [0.55, 1.12, -4.8]], [636, [-1.32, 2.26, -2.3], [0.56, 1.11, -4.85]]], 40) },
  { id: 'burst', a: 637, b: 711, cut: 'hard', raw: KC([[637, [-1.15, 2.0, -2.2], [0.9, 1.42, -4.55]], [652, [-0.92, 2.05, -2.55], [0.88, 1.5, -4.55]], [700, [-0.9, 2.05, -2.6], [0.88, 1.49, -4.55]]], 40) },
  { id: 'burstB', a: 712, b: 750, cut: 'whip', blend: 6, raw: KC([[712, [0.24, 2.3, 3.6], [0.38, 1.0, -3.6]], [750, [0.28, 2.26, 3.45], [0.38, 1.0, -3.6]]], 44) },
  { id: 'lid', cut: 'hard', raw: KC([[751, [-1.9, 2.0, -2.0], [0.45, 1.3, -4.75]], [852, [-1.82, 1.97, -2.12], [0.45, 1.29, -4.75]]], 40) },
  { id: 'tip', cut: 'hard', raw: KC([[853, [-0.6, 1.7, -0.7], [1.25, 1.0, -4.15]], [959, [-0.52, 1.67, -0.82], [1.25, 0.99, -4.15]]], 42) },
  { id: 'stones', cut: 'hard', raw: KC([[960, [0.05, 1.45, -1.45], [1.3, 0.92, -4.05]], [1083, [0.12, 1.42, -1.55], [1.3, 0.91, -4.05]]], 42) },
  { id: 'pan', cut: 'hard', raw: KC([[1084, [-1.7, 1.3, -1.5], [-2.45, 0.7, -4.0]], [1191, [-1.78, 1.28, -1.62], [-2.45, 0.7, -4.0]]], 42) },
  { id: 'laugh', cut: 'hard', raw: KC([[1192, [0.25, 2.15, 4.6], [-0.35, 1.02, -3.8]], [1332, [0.3, 2.12, 4.5], [-0.35, 1.01, -3.8]]], 46) },
  { id: 'reveal', cut: 'hard', raw: KC([[1333, [1.5, 2.35, -2.6], [0.42, 1.05, -5.05]], [1480, [1.38, 2.3, -2.75], [0.42, 1.04, -5.05]]], 38) },
  { id: 'heat', cut: 'hard', raw: KC([[1481, [2.3, 1.78, -1.9], [0.75, 1.05, -4.6]], [1581, [2.1, 1.72, -2.15], [0.78, 1.05, -4.6]]], 42) },
  { id: 'scoop', cut: 'hard', raw: KC([[1582, [-1.9, 1.66, -2.7], [-0.35, 1.0, -4.8]], [1647, [-1.82, 1.64, -2.82], [-0.33, 1.01, -4.8]]], 40) },
  { id: 'line', cut: 'hard', raw: KC([[1648, [0.02, 1.6, -3.6], [0.27, 1.36, -5.2]], [1747, [0.08, 1.58, -3.78], [0.27, 1.35, -5.2]]], 37) },
  { id: 'hookboard', cut: 'hard', raw: KC([[1748, [0.35, 3.5, 5.7], [0.55, 3.78, -7.6]], [1844, [0.38, 3.45, 5.55], [0.55, 3.76, -7.6]]], 42) },
];
const rigShots = RIG_SHOTS.map((s) => s.a !== undefined ? s : { a: B(s.id), b: E(s.id), cut: s.cut, blend: s.blend || 0, raw: s.raw });
const RIG = buildRig({ total: TOTAL, shots: rigShots, kicks: [{ f: 362, a: 0.30 }, { f: 650, a: 0.38 }, { f: 905, a: 0.26 }, { f: 1520, a: 0.18 }], sigma: 1.7, smoothRadius: 5, fovSigma: 1.1 });
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = { kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts, blends: [], whips: RIG.declared.whips, samples: RIG.samples };

// ---- depth of field: focus = camera distance to the shot's subject ----
const CINF = { hook: 0.012, box: 0.02, crowd: 0.006, shove: 0.01, shout: 0.016, pour: 0.012, burst: 0.008, lid: 0.018, tip: 0.012, stones: 0.02, pan: 0.012, laugh: 0.006, reveal: 0.016, heat: 0.01, scoop: 0.016, line: 0.016, hookboard: 0.005 };
const SUBJ = (f) => {
  const id = shotAt(f).id, P = posAt(f);
  switch (id) {
    case 'box': case 'stones': return [BOX.x, 1.1, BOX.z];
    case 'lid': return [BOX.x, 1.6, BOX.z];
    case 'burst': return f >= 712 ? [0.3, 1.1, -1.6] : [BOX.x, 1.45, BOX.z];
    case 'shout': case 'tip': return [P.rival.x, 1.35, P.rival.z];
    case 'pan': return [PAN.x, 0.7, PAN.z];
    case 'crowd': case 'laugh': return [0.2, 1.1, -1.8];
    case 'hookboard': return BOARD_POS;
    default: return [P.heroine.x, 1.35, P.heroine.z];
  }
};
export const dofAt = (f) => { const C = camAt(f), s = SUBJ(f); return { focus: Math.hypot(C.pos[0] - s[0], C.pos[1] - s[1], C.pos[2] - s[2]), cinf: CINF[shotAt(f).id] ?? 0.012 }; };

// ---- shared action envelopes (story + main.js world state) ----
export const lidLiftAt = (f) =>
  0.35 * ramp(f, 10, 22) * (1 - ramp(f, 40, 54)) +              // opening teaser
  ramp(f, 782, 810) * (1 - ramp(f, 838, 856));                  // the reveal lift
export const pourAt = (f) => ramp(f, 560, 575) * (1 - ramp(f, 608, 622));
export const potOffAt = (f) => ramp(f, 858, 880) * (1 - ramp(f, 1545, 1570));   // 1 = pot aside on the counter
export const boxTipAt = (f) => M.easeInOut(ramp(f, 890, 922)) * (1 - M.easeInOut(ramp(f, 1495, 1530)));
export const spillAt = (f) => ramp(f, 905, 935);
export const bagAt = (f) => f >= 362 ? 1 : 0;

export const worldAt = (f) => {
  const sec = shotAt(f).id;
  const burstPulse = Math.exp(-Math.max(0, f - 645) / 26) * (f >= 645 ? 1 : 0);
  let steamK = 0.3;
  if (sec === 'hook') steamK = 0.5; else if (sec === 'pour') steamK = 0.3 + pourAt(f) * 0.5 + ramp(f, 600, 636) * 0.3;
  else if (sec === 'burst') steamK = 0.5 + burstPulse * 0.45; else if (sec === 'lid') steamK = 0.95;
  else if (sec === 'tip' || sec === 'stones') steamK = 0.12; else if (sec === 'pan' || sec === 'laugh') steamK = 0.15;
  else if (sec === 'reveal') steamK = 0.2; else if (sec === 'heat') steamK = 0.25 + ramp(f, 1545, 1581) * 0.6;
  else if (sec === 'scoop' || sec === 'line') steamK = 0.6; else if (sec === 'hookboard') steamK = 0.12;
  const dust = (c) => Math.exp(-Math.max(0, f - c) / 7) * (f >= c ? 1 : 0);
  return {
    boardHook: ramp(f, 1748, 1766),
    steamK, burstK: burstPulse,
    bubbleK: sec === 'lid' ? 0.95 : sec === 'heat' && f > 1555 ? 0.7 : 0.15,
    lidK: lidLiftAt(f), potOff: potOffAt(f), boxTipK: boxTipAt(f), spillK: spillAt(f), bagK: bagAt(f),
    wispK: (sec === 'stones' || sec === 'tip') ? 0.75 : 0,
    fizzK: ramp(f, 1405, 1418) * (1 - ramp(f, 1455, 1475)),
    dustK: Math.max(dust(362), dust(918) * 0.8, dust(1520) * 0.7),
    splashK: ramp(f, 1162, 1168) * (1 - ramp(f, 1174, 1184)),
    pourK: pourAt(f),
    glintK: 0,
  };
};
export const fxProfileAt = (f) => ({ steam: worldAt(f).steamK, burst: worldAt(f).burstK });

// ============================================================
// CAST + PERFORMANCE — the animation upgrade lives here: every actor
// gets lifeAt() breathing/sway, an emoTrack() face, gaze that follows
// the action, gripTrack() hands for every hold, and gestureAt() hands
// while speaking. Nobody is a statue in any frame.
// ============================================================
const SP = SPK.makeSpeakPlayer(SPEAK_DATA);
const RIVAL_SEGS = [[391, 412], [436, 499]];       // "Hidden coals!" + "One spark… mine!" (tag f416-424 excluded)
const HERO_SEGS = [[1642, 1735]];                  // her closing line
const inSeg = (f, segs) => segs.some(([a, b]) => f >= a && f <= b);

// ---- outfits (costumes by role) ----
const OUTF = {
  heroine: { build: 'adult', jacket: '#c2502a', shirtFront: '#f2e7cf', sash: '#e9b13c', pants: '#6d3b4a', boots: '#4a2c1c', skin: '#eec39b', hat: 'hair', hair: '#5a3420' },
  rival: { build: 'stout', jacket: '#3f5a36', shirtFront: '#ddd3b8', sash: '#8a6844', pants: '#4a3b2c', boots: '#33241a', skin: '#e0aa7e', hat: 'cap', cap: '#e8e2d4', moustache: '#2a201a' },
  elder: { build: 'adult', jacket: '#5d4a68', shirtFront: '#e8ddc4', pants: '#3d3444', boots: '#2c2118', skin: '#e8b08a', hat: 'cap', cap: '#3d3444', moustache: '#4a4038' },
  woman: { build: 'adult', jacket: '#7a9a4a', dress: '#a8bf6a', pants: '#5d7038', boots: '#4a3a26', skin: '#f0c8a2', hat: 'bonnet', hair: '#6d4526' },
  lad: { build: 'adult', jacket: '#3f6a8a', shirtFront: '#dfe8ee', pants: '#54443a', boots: '#33241a', skin: '#eec39b', hat: 'cap', cap: '#b8502e' },
  trader: { build: 'stout', jacket: '#8a6844', shirtFront: '#efe3c2', pants: '#5d4a68', boots: '#33241a', skin: '#e0aa7e', hat: 'cap', cap: '#5d4a68' },
  woman2: { build: 'adult', jacket: '#b8502e', dress: '#d98a4a', pants: '#7a4a2e', boots: '#4a2c1c', skin: '#e8b08a', hat: 'bonnet', hair: '#3a2618' },
  kid: { build: 'adult', jacket: '#e9b13c', shirtFront: '#fdf3d0', pants: '#3f6a8a', boots: '#33241a', skin: '#f0c8a2', hat: 'cap', cap: '#3f6a8a' },
};
const RADII = { rival: 0.34, kid: 0.24 };

// ---- expression morph tracks (the face matches the beat) ----
const heroEmo = emoTrack([[0, 'smile'], [105, 'proud'], [391, 'smile'], [511, 'smile_closed'], [640, 'shock'], [668, 'relief'], [751, 'proud'], [853, 'stern'], [960, 'smug'], [1192, 'grin'], [1333, 'smile'], [1400, 'determined'], [1481, 'proud'], [1582, 'grin'], [1648, 'smile'], [1748, 'grin']], 3);
const rivalEmo = emoTrack([[0, 'angry'], [645, 'shock'], [672, 'nervous'], [751, 'angry'], [853, 'determined'], [965, 'stubborn'], [1084, 'determined'], [1150, 'nervous'], [1196, 'sad'], [1333, 'sad'], [1400, 'confused'], [1481, 'sad'], [1582, 'dazed'], [1648, 'sad']], 7);
const crowdEmo = (seed, late) => emoTrack([[0, 'wonder'], [207, seed % 2 ? 'wonder' : 'confused'], [650, 'shock'], [675, 'relief'], [1196, 'laugh'], [1333, 'wonder'], [1481, 'smile'], [1582, 'grin'], [1748, late || 'smile']], seed);
const blockEmo = (seed) => emoTrack([[0, 'wonder'], [320, 'nervous'], [345, 'shock'], [420, 'nervous'], [650, 'shock'], [1196, 'laugh'], [1582, 'grin']], seed);

// ---- gaze tracks (eyes follow the named subject) ----
const heroGaze = gazeTrack([{ f: 0, look: 0.1, lookY: 0.1 }, { f: 207, look: -0.3 }, { f: 391, look: -0.45, tilt: 2 }, { f: 511, look: 0.35, lookY: -0.25 }, { f: 751, look: 0.3, lookY: -0.3 }, { f: 853, look: 0.45 }, { f: 1084, look: -0.4 }, { f: 1333, look: 0.15, lookY: -0.2 }, { f: 1582, look: -0.2, lookY: -0.3 }, { f: 1648, look: 0, lookY: 0.05 }, { f: 1748, look: 0.3, lookY: 0.35 }]);
const rivalGaze = gazeTrack([{ f: 0, look: 0.4 }, { f: 511, look: 0.3, lookY: -0.2 }, { f: 751, look: 0.35, lookY: -0.35 }, { f: 853, look: 0.2, lookY: -0.45 }, { f: 1084, look: -0.2, lookY: -0.4 }, { f: 1192, look: 0, lookY: -0.5 }, { f: 1648, look: 0.45 }]);

// ---- GRIP TRACKS (card units; hang ≈ L(190,730) R(410,730)) ----
const GT = (ks) => gripTrack(ks.map(([f, x, y, g]) => ({ f, x, y, grip: g })));
const jugL = GT([[505, 190, 730, 0], [522, 214, 588, 0.85], [548, 210, 505, 0.92], [575, 216, 470, 0.92], [600, 212, 478, 0.92], [622, 218, 565, 0.8], [640, 190, 730, 0]]);
const jugR = GT([[505, 410, 730, 0], [522, 386, 580, 0.85], [548, 382, 500, 0.92], [575, 386, 458, 0.92], [600, 384, 466, 0.92], [622, 388, 560, 0.8], [640, 410, 730, 0]]);
const hookStoneR = GT([[0, 368, 472, 0.4], [42, 368, 472, 0.4], [58, 415, 720, 0]]);
const lidR = GT([[0, 332, 508, 0.9], [40, 332, 508, 0.9], [56, 415, 720, 0], [745, 415, 720, 0], [770, 470, 300, 0.6], [782, 505, 235, 0.85], [800, 518, 178, 0.92], [822, 518, 176, 0.92], [840, 508, 228, 0.9], [856, 470, 320, 0.5], [866, 415, 720, 0]]);
const potL = GT([[858, 190, 730, 0], [868, 208, 566, 0.92], [885, 196, 580, 0.92], [898, 190, 730, 0], [1540, 190, 730, 0], [1550, 208, 566, 0.92], [1568, 200, 578, 0.92], [1580, 190, 730, 0]]);
const potR = GT([[858, 410, 730, 0], [868, 392, 566, 0.92], [885, 404, 580, 0.92], [898, 410, 730, 0], [1540, 410, 730, 0], [1550, 392, 566, 0.92], [1568, 400, 578, 0.92], [1580, 410, 730, 0]]);
const boxHL = GT([[1481, 190, 730, 0], [1492, 228, 646, 0.95], [1522, 224, 612, 0.95], [1538, 190, 730, 0]]);
const boxHR = GT([[1481, 410, 730, 0], [1492, 374, 646, 0.95], [1522, 378, 612, 0.95], [1538, 410, 730, 0]]);
const stoneR = GT([[1333, 415, 720, 0], [1358, 388, 604, 0.35], [1462, 388, 604, 0.35], [1478, 415, 720, 0]]);
const sprinkleL = GT([[1333, 190, 730, 0], [1392, 298, 468, 0.25], [1402, 314, 458, 0.25], [1412, 298, 468, 0.25], [1422, 314, 458, 0.25], [1435, 190, 730, 0]]);
const scoopR = GT([[1582, 415, 720, 0], [1600, 388, 560, 0.15], [1612, 382, 545, 1], [1632, 366, 480, 1], [1740, 366, 480, 1], [1754, 415, 720, 0]]);
const pointR = GT([[1748, 415, 720, 0], [1762, 448, 318, 0.15], [1844, 448, 318, 0.15]]);
const slamR = GT([[340, 415, 720, 0], [352, 380, 420, 0.55], [362, 340, 640, 0.85], [378, 415, 720, 0]]);
const flinchL = GT([[640, 190, 730, 0], [650, 168, 468, 0], [668, 168, 468, 0], [682, 190, 730, 0]]);
const flinchR = GT([[640, 410, 730, 0], [650, 432, 468, 0], [668, 432, 468, 0], [682, 410, 730, 0]]);
const digKeys = (side) => {
  const ks = [[853, side < 0 ? 190 : 410, 730, 0], [872, side < 0 ? 246 : 382, 664, 0.4], [888, side < 0 ? 252 : 378, 600, 0.95], [922, side < 0 ? 252 : 378, 600, 0.95]];
  for (let t = 922, i = 0; t < 1078; t += 13, i++) { const dip = (i % 2 === 0) === (side < 0); ks.push([t + (dip ? 0 : 6), side < 0 ? 266 : 362, dip ? 700 : 616, dip ? 0.85 : 0.3]); }
  ks.push([1083, side < 0 ? 190 : 410, 730, 0]);
  return GT(ks);
};
const digL = digKeys(-1), digR = digKeys(1);
const panScoopR = GT([[1108, 415, 720, 0], [1122, 398, 646, 0.8], [1138, 362, 602, 0.7], [1150, 398, 664, 0.1], [1165, 415, 720, 0]]);
const panCupL = GT([[1108, 190, 730, 0], [1152, 238, 600, 0.8], [1166, 262, 578, 0.85], [1180, 190, 730, 0]]);
const rivalKneel = poseWindows([{ a: 1116, b: 1168, mode: 'kneel1', inF: 7, outF: 7 }]);
const heroWink = winkTrack([{ a: 1622, b: 1644 }]);

const AP = (L, R) => {
  const o = {};
  if (L) o.L = { hand: [Math.round(L.x), Math.round(L.y)], grip: q(L.grip, 2), front: true };
  if (R) o.R = { hand: [Math.round(R.x), Math.round(R.y)], grip: q(R.grip, 2), front: true };
  return Object.keys(o).length ? o : undefined;
};
// redraw a gripping hand OVER its object (fingertips + palm dot)
const gripHand = (p, hx, hy, skin) => {
  p.ell(hx, hy, 9.5, 9.5, skin, 2.2);
  for (const [dx, dy] of [[-8, -5], [0, -8], [8, -5]]) p.ell(hx + dx, hy + dy, 4.2, 4.2, skin, 1.6);
};

const castAt = (f) => {
  const sec = shotAt(f).id, P = posAt(f), out = [];
  const add = (id, outfit, o, extra = {}) => out.push({
    id, x: o.x, y: o.y || 0, z: o.z, r: RADII[id] ?? 0.3, ground: 0, air: (o.y || 0) > 0.01, maxHover: extra.maxHover ?? 0.05, group: '',
    actor: (TT) => ({
      key: id + JSON.stringify(outfit) + JSON.stringify(o.opts) + (extra.ov || ''),
      draw: (p) => { TT.bodyFront(p, outfit, o.opts); if (extra.drawOv) extra.drawOv(p); },
      x: o.x, y: o.y || 0, z: o.z, ground: 0, tint: extra.tint, s: extra.s,
    }),
  });
  const base = (seed, lifeAmp = 1) => {
    const L = lifeAt(f, seed);
    return { seed, blink: new TOON.Blink(seed).at(f), breath: L.breath, tilt: q(L.tilt * lifeAmp, 2), headTilt: q(L.headTilt, 2), squashL: L.squash };
  };

  // ---------- HEROINE ----------
  {
    const seed = 3, B = base(seed), G = heroGaze(f);
    let exprP = heroEmo(f);
    const speaking = inSeg(f, HERO_SEGS);
    if (speaking) exprP = SPK.applySpeak(exprP, SP.at(f));
    const wk = heroWink(f);
    if (wk > 0) exprP = TOON.blendFaceP(exprP, TOON.faceP('wink', seed), wk);
    let hL = null, hR = null, ov = '', drawOv = null, dip = 0;
    if (sec === 'hook') hR = hookStoneR(f);
    else if (sec === 'pour') { hL = jugL(f); hR = jugR(f); dip = carryDip(f, 0.5); }
    else if (sec === 'lid') hR = lidR(f);
    else if (sec === 'tip') { hL = potL(f); hR = potR(f); dip = carryDip(f, 0.65); }
    else if (sec === 'stones') { hL = { x: 202, y: 614, grip: 0.3 }; hR = { x: 398, y: 614, grip: 0.3 }; }
    else if (sec === 'reveal') { hL = sprinkleL(f); hR = stoneR(f); }
    else if (sec === 'heat') { hL = f < 1540 ? boxHL(f) : potL(f); hR = f < 1540 ? boxHR(f) : potR(f); dip = f < 1540 ? carryDip(f, 0.85) : carryDip(f, 0.65); }
    else if (sec === 'scoop') hR = scoopR(f);
    else if (sec === 'line') {
      hR = scoopR(f);
      if (speaking) { const g = gestureAt(f, 5, SP.at(f).nod); hL = { x: 208 + g.dx, y: 596 + g.dy, grip: 0.15 }; }
      else hL = { x: 200, y: 612, grip: 0.3 };
    } else if (sec === 'hookboard') { hR = pointR(f); hL = { x: 204, y: 616, grip: 0.3 }; }
    if (sec === 'pour' && hL && hR) {
      const W = worldAt(f), cx = (hL.x + hR.x) / 2, cy = (hL.y + hR.y) / 2 + 30, tilt = W.pourK;
      ov = `jug${q(cx, 1)}:${q(cy, 1)}:${q(tilt, 2)}:${q(hL.x, 1)}:${q(hL.y, 1)}:${q(hR.x, 1)}:${q(hR.y, 1)}`;
      drawOv = (p) => {
        const th = tilt * 0.95, nx = cx + Math.sin(th) * 48, ny = cy - Math.cos(th) * 48;
        p.ell(cx + tilt * 10, cy, 58, 60, '#b26a35', 3);                                 // jug body (leans with the pour)
        p.ell(cx - 14, cy - 16, 17, 24, '#cd8a4e', 0);                                // belly light
        p.ell(nx, ny, 15, 17, '#a35c2c', 2.5);                                          // jug neck swings with the tilt
        if (tilt > 0.35) { const sx = nx + 13, sy = ny + 2; p.band([[sx, sy], [sx + 15, sy + 58], [sx + 21, sy + 118]], '#9fd0ee', 5.5, 0); }  // the pour stream from the lip
        gripHand(p, hL.x, hL.y, OUTF.heroine.skin); gripHand(p, hR.x, hR.y, OUTF.heroine.skin);
      };
    }
    if ((sec === 'reveal' || sec === 'hook') && hR && hR.grip > 0.2) {
      const W = worldAt(f), fz = W.fizzK;
      ov = `stone${q(hR.x, 1)}:${q(hR.y, 1)}:${q(fz, 2)}:${f % 24}`;
      drawOv = (p) => {
        p.ell(hR.x - 2, hR.y - 16, 18, 13.5, fz > 0.25 ? '#ffd9a0' : '#f4f1e8', 2.5);  // the quicklime stone
        if (fz > 0.05) for (let i = 0; i < 3; i++) { const u = ((f + i * 8) % 24) / 24; p.ell(hR.x - 8 + i * 8 + u * 4, hR.y - 34 - u * 42, 5 + u * 6, 6 + u * 7, '#eef2ee', 0); }  // fizz steam
        p.ell(hR.x, hR.y, 9.5, 9.5, OUTF.heroine.skin, 2.2);
      };
    }
    if ((sec === 'scoop' || sec === 'line' || sec === 'hookboard') && hR && scoopR(f).grip > 0.8 && f < 1752) {
      ov = `coins${q(hR.x, 1)}:${q(hR.y, 1)}`;
      drawOv = (p) => { for (const [dx, dy, r] of [[-9, -12, 7], [3, -16, 8], [12, -9, 6.5], [-2, -6, 6], [8, -20, 5]]) p.ell(hR.x + dx, hR.y + dy, r, r, '#e9b13c', 1.8); gripHand(p, hR.x, hR.y, OUTF.heroine.skin); };
    }
    const moving = heroMove.moving(f);
    add('heroine', OUTF.heroine, {
      x: P.heroine.x, z: P.heroine.z, y: 0,
      opts: {
        phase: heroMove.phase(f), mode: moving ? 'march' : 'stand', exprP, blink: B.blink, seed,
        breath: B.breath, tilt: B.tilt, headTilt: q(B.headTilt + G.tilt, 2),
        look: q(G.look, 2), lookY: q(G.lookY, 2), facing: q(G.facing, 2),
        squash: q(Math.max(B.squashL, dip), 3), armPose: AP(hL, hR),
      },
    }, { ov, drawOv });
  }

  // ---------- RIVAL ----------
  {
    const seed = 7, B = base(seed), G = rivalGaze(f), K1 = rivalKneel(f);
    let exprP = rivalEmo(f);
    const speaking = inSeg(f, RIVAL_SEGS);
    if (speaking) exprP = SPK.applySpeak(exprP, SP.at(f));
    let rL = null, rR = null, ov = '', drawOv = null, dip = 0;
    if (sec === 'shove' && f >= 340) rR = slamR(f);
    else if (sec === 'shout') {
      rL = { x: 196, y: 612, grip: 0.35 };
      if (speaking) { const g = gestureAt(f, 7, SP.at(f).nod); rR = { x: 438 + g.dx, y: 472 + g.dy, grip: 0.1 }; }
      else rR = { x: 420, y: 566, grip: 0.2 };
    } else if (sec === 'pour' || sec === 'lid') { rL = { x: 198, y: 612, grip: 0.32 }; rR = { x: 402, y: 612, grip: 0.32 }; }
    else if (sec === 'burst') { rL = flinchL(f); rR = flinchR(f); }
    else if (sec === 'tip' || sec === 'stones') { rL = digL(f); rR = digR(f); dip = f < 935 ? carryDip(f, 0.85) : carryDip(f, 0.3); }
    else if (sec === 'pan') { rL = panCupL(f); rR = panScoopR(f); }
    if (sec === 'shove' && f >= 340 && f < 362 && rR) {
      ov = `bag${q(rR.x, 1)}:${q(rR.y, 1)}`;
      drawOv = (p) => { p.ell(rR.x, rR.y + 20, 21, 25, '#8a6844', 3); p.band([[rR.x - 8, rR.y - 2], [rR.x + 8, rR.y - 2]], '#5d4a2e', 5, 0); gripHand(p, rR.x, rR.y, OUTF.rival.skin); };
    }
    const moving = rivalMove.moving(f);
    const slamDip = sec === 'shove' && f >= 360 && f <= 382 ? 0.13 * Math.sin((f - 360) / 22 * Math.PI) : 0;
    const slump = sec === 'laugh' || sec === 'reveal' || sec === 'scoop' ? 3.6 : 0;
    add('rival', OUTF.rival, {
      x: P.rival.x, z: P.rival.z, y: P.rival.y,
      opts: {
        phase: rivalMove.phase(f), mode: K1.mode !== 'stand' ? K1.mode : moving ? 'march' : 'stand',
        expr: 'stern', exprP, blink: B.blink, seed,
        breath: B.breath, tilt: q(B.tilt + (P.rival.lean || 0) + slump + ((sec === 'tip' || sec === 'stones') ? 5 : 0), 2), headTilt: q(B.headTilt + G.tilt + slump * 0.8, 2),
        look: q(G.look, 2), lookY: q(G.lookY, 2), facing: q(G.facing, 2),
        squash: q(Math.max(B.squashL, K1.squash, P.rival.squash || 0, dip, slamDip), 3), armPose: AP(rL, rR),
      },
    }, { ov, drawOv, maxHover: 0.3 });
  }

  // ---------- CROWD (all alive: life + emo + gaze + beat gestures) ----------
  const crowd = [
    ['b1', OUTF.trader, 11, 'block'], ['b2', OUTF.woman2, 13, 'block'],
    ['fr1', OUTF.elder, 17, 'front'], ['fr2', OUTF.woman, 19, 'front'], ['fr3', OUTF.lad, 23, 'front'],
    ['br1', OUTF.trader, 29, 'back'], ['br2', OUTF.woman2, 31, 'back'], ['kid', OUTF.kid, 37, 'back'],
  ];
  for (const [id, outfit, seed, row] of crowd) {
    const B = base(seed, row === 'back' ? 0.7 : 1), pos = P[id];
    let exprP = (row === 'block' ? blockEmo(seed) : crowdEmo(seed))(f);
    let cL = null, cR = null;
    if (sec === 'crowd' && row !== 'back') { const g = gestureAt(f, seed, 0.4); if (seed % 2) cR = { x: 428 + g.dx, y: 522 + g.dy, grip: 0.1 }; else cL = { x: 172 - g.dx, y: 522 + g.dy, grip: 0.1 }; }
    if (sec === 'burst' && f >= 645 && f < 692 && row === 'front') { cL = { x: 172, y: 478, grip: 0 }; cR = { x: 428, y: 478, grip: 0 }; }
    if (sec === 'laugh' && (id === 'fr2' || id === 'kid')) { cL = { x: 232, y: 512, grip: 0 }; cR = { x: 368, y: 512, grip: 0 }; }
    const laughShake = sec === 'laugh' ? 0.03 * (0.5 + 0.5 * Math.sin(f * 0.85 + seed * 2)) : 0;
    add(id, outfit, {
      x: pos.x, z: pos.z, y: pos.y,
      opts: {
        phase: 0, mode: 'stand', exprP, blink: B.blink, seed,
        breath: B.breath, tilt: q(B.tilt + (pos.lean || 0), 2), headTilt: B.headTilt,
        look: q(id === 'fr2' || id === 'b2' ? -0.2 : 0.2, 2), lookY: q(-0.05, 2),
        squash: q(Math.max(B.squashL, pos.squash || 0, laughShake), 3), armPose: AP(cL, cR),
      },
    }, { maxHover: 0.32, s: id === 'kid' ? 0.78 : 1 });
  }
  return out;
};
export const actorsAt = (f, TT) => castAt(f).map((c) => c.actor(TT));

// ---- fx actors: slam dust + pan splash droplets ----
export const fxAt = (f, T) => {
  const W = worldAt(f), out = [], sec = shotAt(f).id;
  const addFx = (id, x, y, z, draw, key) => out.push({ key, draw, x, y, z, ground: 0, tint: undefined, s: 1 });
  if (W.dustK > 0.06) for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5, rr = 0.22 + (1 - W.dustK) * 0.3;
    addFx(`dust${i}`, BAG.x + Math.cos(a) * rr, 0.92 + (1 - W.dustK) * 0.12, BAG.z + 0.42 + Math.sin(a) * 0.1,
      (p) => p.ell(300, 500, 12 + (1 - W.dustK) * 26, 8 + (1 - W.dustK) * 15, '#d8c49a', 0), `dust${i}:${q(W.dustK, 2)}`);
  }
  if (sec === 'stones') {
    const cyc = (f - 960) % 26;
    const dips = [cyc < 13 ? Math.sin(cyc / 13 * Math.PI) : 0, cyc >= 13 ? Math.sin((cyc - 13) / 13 * Math.PI) : 0];
    [[1.02, -3.9, 0], [1.52, -4.0, 1]].forEach(([hx, hz, si]) => {
      const dip = dips[si];
      addFx(`digH${si}`, hx, 0.08 - dip * 0.1, hz, (p) => {
        p.band([[272, 40], [282, 470]], '#3f5a36', 48, 0);
        p.band([[284, 470], [296, 556]], '#e0aa7e', 30, 0);
        p.ell(300, 596, 30, 24, '#e0aa7e', 2.4);
        for (const dx of [-16, 0, 16]) p.ell(300 + dx, 618, 7.5, 9, '#e0aa7e', 1.6);
        if (dip < 0.35) p.ell(302, 578, 10, 8, '#f4f1e8', 1.8);
      }, `digH${si}:${q(dip, 2)}`);
    });
  }
  if (W.splashK > 0.03) for (let i = 0; i < 8; i++) {
    const u = ((f - 1162) / 15 + i / 8) % 1;
    addFx(`drop${i}`, PAN.x + (i - 3.5) * 0.085, 0.62 + Math.sin(u * Math.PI) * 0.34, PAN.z + (i % 3) * 0.07,
      (p) => p.ell(300, 500, 5.5, 7.5, '#9fd0ee', 0), `drop${i}:${q(u, 2)}`);
  }
  return out;
};

// ---- set dressing + collision world ----
export const STATICS = [
  { id: 'counter', kind: 'counter', c: [0.35, 0, -4.5], size: [4.5, 0.8, 0.8] },
  { id: 'box', kind: 'limebox', c: [BOX.x, 0.8, BOX.z], size: [1.15, 0.58, 0.8] },
  { id: 'heroStall', kind: 'stall', c: [0.35, 0, -5.9], size: [5.2, 3.1, 0.3], col: '#c9552e' },
  { id: 'rivalStall', kind: 'stall', c: [-5.6, 0, -6.1], size: [3.4, 2.9, 0.3], col: '#3f6a8a' },
  { id: 'sideStall', kind: 'stall', c: [5.6, 0, -5.6], size: [3.2, 2.8, 0.3], col: '#7a9a4a' },
  { id: 'panTable', kind: 'pantable', c: [PAN.x, 0, -4.35], size: [0.9, 0.45, 0.7] },
  { id: 'tree', kind: 'tree', c: [6.8, 0, -6.5], size: [1, 4.4, 1] },
  { id: 'crates', kind: 'crates', c: [4.9, 0, -5.4], size: [1.6, 1.2, 1.2] },
  { id: 'backdrop', kind: 'tentwall', c: [0.55, 0, -10.4], size: [13, 5.4, 0.3] },
  { id: 'boardPosts', kind: 'posts', c: [0.55, 0, -9.2], size: [4.9, 3.4, 0.15] },
];
export const WORLD = makeWorld([
  aabb(-1.9, 2.6, -4.9, -4.1, { id: 'counter' }),
  circle(-2.5, -4.35, 0.42, { id: 'panTable' }),
  circle(-1.9, -5.6, 0.14, { id: 'postL' }), circle(2.6, -5.6, 0.14, { id: 'postR' }),
  circle(-6.3, -5.9, 0.14, { id: 'rpostL' }), circle(-4.9, -5.9, 0.14, { id: 'rpostR' }),
  circle(6.8, -6.5, 0.5, { id: 'tree' }), circle(4.9, -5.4, 0.9, { id: 'crates' }),
]);
export const dynamicsAt = (f) => Object.entries(posAt(f)).map(([id, p]) => ({ id, x: p.x, z: p.z, r: RADII[id] ?? 0.3 }));
export const groundItemsAt = (f) => Object.entries(posAt(f)).map(([id, p]) => ({ id, y: p.y || 0, ground: 0, maxHover: (p.y || 0) > 0.01 ? 0.3 : 0.05 }));
