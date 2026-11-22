// Shot plan for "The Fisherman Who Sold the Same Fish Twice" —
// built on the charfix-proof painter (Abid's Character Fix Round 2:
// fingered hands drawHand/drawGrip/drawPinch, the new walk cycle,
// limb volume, cinematic ACES + split-tone grade in the ink pass).
// A poor fisherman lands ONE enormous fish. The proud fish-market
// boss mocks him: "One fish, one price — you'll earn a single coin
// today." But the innkeeper and the baker both need the WHOLE fish
// for their feasts that evening. The fisherman's plan, SHOWN in
// steps: (1) sell the WHOLE fish to the innkeeper, delivery at the
// evening bell; (2) sell the SAME whole fish to the baker, delivery
// at the same bell; (3) measure the giant against both feast tables
// and chalk its middle — each half alone outweighs any whole fish
// in the market. Payoff at the bell: one cut, two feast-sized
// halves, both buyers cheering, the boss admitting it before them
// all. The giant fish is CARRIED in both hands (the painter's new
// 'bigfish' carry: both palms cupped under the belly, fingertip
// caps up the near flank) on the haul in and on the walk to the
// scale. ONE set (harbour quay + market, the cinematic sea behind),
// DAYLIGHT throughout. Performed dialogue ONLY mid-script: L3 (the
// mock) and L15 (the admission); the final line is narration over
// the hook board "ONE FISH / SOLD TWICE", teasing the girl who
// carried water in a sieve.
// Exactly 60.000 s / 1800 frames @30 fps. Shots cut ONLY on voice
// lines (stem = voice_final.wav, timing.json; pause-cap 0.22 s +
// disclosed atempo 1.2739 — see STAGING.md):
//   L1 f0-89 · L2 f93-174 · L3 f178-259 (BOSS dialogue) ·
//   L4 f263-353 · L5 f356-457 · L6 f461-546 · L7 f550-678 ·
//   L8 f682-796 · L9 f799-900 · L10 f904-1026 · L11 f1030-1127 ·
//   L12 f1131-1236 · L13 f1240-1329 · L14 f1333-1452 ·
//   L15 f1456-1563 (BOSS dialogue) · L16 f1566-1680 ·
//   L17 f1684-1798.
import { M, blinkAt, q, clamp, lerp, ramp, kf, walk } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1800, DECK = 0;
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
export const SHOTS = [
  { id: 's01a', a: 0, b: 44, light: 'day' },
  { id: 's01b', a: 45, b: 90, light: 'day' },
  { id: 's02', a: 91, b: 175, light: 'day' },
  { id: 's03a', a: 176, b: 216, light: 'day' },
  { id: 's03b', a: 217, b: 260, light: 'day' },
  { id: 's04', a: 261, b: 354, light: 'day' },
  { id: 's05a', a: 355, b: 405, light: 'day' },
  { id: 's05b', a: 406, b: 458, light: 'day' },
  { id: 's06a', a: 459, b: 500, light: 'day' },
  { id: 's06b', a: 501, b: 547, light: 'day' },
  { id: 's07', a: 548, b: 679, light: 'day' },
  { id: 's08', a: 680, b: 797, light: 'day' },
  { id: 's09', a: 798, b: 901, light: 'day' },
  { id: 's10a', a: 902, b: 960, light: 'day' },
  { id: 's10b', a: 961, b: 1027, light: 'day' },
  { id: 's11', a: 1028, b: 1128, light: 'day' },
  { id: 's12', a: 1129, b: 1237, light: 'day' },
  { id: 's13', a: 1238, b: 1330, light: 'day' },
  { id: 's14a', a: 1331, b: 1390, light: 'day' },
  { id: 's14b', a: 1391, b: 1453, light: 'day' },
  { id: 's15a', a: 1454, b: 1510, light: 'day' },
  { id: 's15b', a: 1511, b: 1564, light: 'day' },
  { id: 's16a', a: 1565, b: 1622, light: 'day' },
  { id: 's16b', a: 1623, b: 1681, light: 'day' },
  { id: 's17', a: 1682, b: 1799, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights: ONE vivid daylight grade ----------
export const LIGHTS = {
  day: { az: 218, el: 46, sky: '#dcebf2', ground: '#5d7a3a', hemi: 1.05, sun: '#ffdca3', sunI: 2.55, fog: '#cfe0d8', fogNear: 55, fogFar: 380,
    skyTop: '#1a4f96', skyHor: '#84b4da', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.30, vig: 0.24, shadowExt: 40, aurora: 0, gain: '#fff0cd', waterDeep: '#14424f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const BOARD_POS = [5.8, 0.98, 6.4];
export const BOARD_RY = 0.65;
export const FISH_BOARD = { x: 0, z: -2.2, topY: 0.78 };   // the long plank table
export const SCALE_POS = { x: 5.2, z: -2.6 };               // the steelyard
export const INN_TABLE = { x: 8.6, z: 2.2 };
export const BAK_TABLE = { x: -8.6, z: 2.2 };
export const BELL_POS = { x: 2.6, z: -4.6 };

// walk helper: ONE M.walk call drives BOTH the position along a
// segment and the bodyFront march phase — feet can never slide.
const walkAlong = (f, f0, from, to, speed, stride) => {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const wk = walk(f, f0, speed, stride);
  const d = Math.min(wk.dist, len);
  const u = len ? d / len : 0;
  return { x: from[0] + dx * u, z: from[1] + dz * u, phase: wk.phase, moving: f >= f0 && wk.dist < len };
};
const walkChain = (f, legs) => {
  for (const [f0, from, to, sp, st] of legs) {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (f < f0 + (len / sp) * 30 + 2) return walkAlong(f, f0, from, to, sp, st);
  }
  const last = legs[legs.length - 1];
  return { x: last[2][0], z: last[2][1], phase: 0, moving: false };
};

// ---------- actor anchors (single source; checked against STATICS) ----------
export function fisherAt(f) {
  const S = shotAt(f);
  switch (S.id) {
    case 's01a': case 's01b': case 's02': {
      if (f < 100) return walkChain(f, [
        [6, [-1.5, -4.9], [-2.6, -2.6], 1.9, 0.82],
        [46, [-2.6, -2.6], [-2.6, -1.15], 1.9, 0.82],
        [69, [-2.6, -1.15], [-1.9, -1.15], 1.9, 0.82],
      ]);
      if (f < 132) { const w = walkAlong(f, 100, [-1.9, -1.15], [0.2, -1.15], 1.35, 0.78); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      return { x: 0.2, z: -1.15 };
    }
    case 's08': {
      if (f < 722) { const w = walkAlong(f, 690, [0.2, -1.15], [-0.9, -1.15], 1.35, 0.78); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      return { x: -0.9, z: -1.15 };
    }
    case 's10a': { const w = walkAlong(f, 906, [0.2, -1.15], [3.6, -1.2], 2.0, 0.82); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's10b': {
      if (f < 984) { const w = walkAlong(f, 961, [3.6, -1.2], [3.5, -1.45], 1.4, 0.75); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      return { x: 3.5, z: -1.45 };
    }
    case 's11': {
      if (f < 1052) return { x: 1.6, z: -1.15 };
      if (f < 1082) { const w = walkAlong(f, 1052, [1.6, -1.15], [0.15, -1.25], 1.3, 0.76); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      return { x: 0.15, z: -1.25 };
    }
    case 's14a': case 's14b': return { x: 0.1, z: -1.2 };
    case 's16a': return { x: 7.4, z: 3.5 };
    case 's16b': return { x: -7.4, z: 3.5 };
    case 's17': return { x: 4.9, z: 5.0 };
    default: return { x: 0.2, z: -1.15 };
  }
}
export const bossAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's01a': case 's01b': return { x: -1.8, z: -0.1 };
    case 's02': return walkChain(f, [
      [94, [-1.8, -0.1], [-2.95, -1.5], 2.0, 0.82],
      [122, [-2.95, -1.5], [-2.8, -3.3], 2.0, 0.82],
      [149, [-2.8, -3.3], [-0.9, -3.35], 2.3, 0.82],
    ]);
    case 's08': return { x: -0.3, z: -3.15 };   // behind the board's middle for the second sale
    case 's10a': return { x: 3.4, z: -3.4 };   // he follows the weighing from the scale's north side
    case 's17': return { x: 6.8, z: 4.6 };
    default: return { x: -0.9, z: -3.35 };
  }
};
export const innAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's05a': case 's05b': return walkChain(f, [
      [358, [8.8, 3.4], [6.2, 3.6], 2.9, 0.85],
      [390, [6.2, 3.6], [4.6, 1.2], 2.9, 0.85],
      [420, [4.6, 1.2], [2.7, -1.25], 2.9, 0.85],
    ]);
    case 's14a': return { x: 2.15, z: -1.35 };   // beside the board's east end for the cut
    case 's15a': return { x: 3.4, z: -2.0 };   // in frame behind the boss's admission
    case 's16a': return { x: 9.8, z: 1.2 };   // behind his feast table, beside the fish half
    case 's17': return { x: 3.9, z: 5.6 };
    default: return f < 355 ? { x: 8.8, z: 3.4 } : { x: 2.7, z: -1.25 };
  }
};
export const bakerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's05a': case 's05b': return walkChain(f, [
      [358, [-8.8, 3.4], [-6.2, 3.6], 2.9, 0.85],
      [390, [-6.2, 3.6], [-4.6, 1.2], 2.9, 0.85],
      [420, [-4.6, 1.2], [-4.4, -1.45], 3.1, 0.85],
      [446, [-4.4, -1.45], [-2.8, -1.25], 3.1, 0.85],
    ]);
    case 's16b': return { x: -9.8, z: 1.2 };
    case 's17': return { x: 7.6, z: 5.5 };
    default: return f < 355 ? { x: -8.8, z: 3.4 } : { x: -2.8, z: -1.25 };
  }
};
export const guestAAt = (f) => (shotAt(f).id === 's16a' ? { x: 8.85, z: 1.15 } : { x: -13.5, z: 7.5 });
export const guestBAt = (f) => (shotAt(f).id === 's16b' ? { x: -8.85, z: 1.15 } : { x: 13.5, z: 7.5 });

// ---------- the giant fish: world state (single source for main.js) ----------
// mode 'carry' = the 3D fish hides; the card draws it in both hands.
// 'board' = whole on the plank table. 'scale' = hanging in the
// steelyard sling. 'halves' = cut, on the board, then on the tables.
export const fishAt = (f) => {
  let mode = 'board', x = FISH_BOARD.x, y = 1.10, z = FISH_BOARD.z, ry = 0;
  if (f < 82) mode = 'carry';
  else if (f >= 902 && f < 980) mode = 'carry';
  else if (f >= 980 && f < 1028) { mode = 'scale'; x = SCALE_POS.x; y = 1.30; z = SCALE_POS.z; }
  else if (f >= 1454) mode = 'halves';
  const mark = smooth(ramp(f, 1075, 1105));            // the chalk line across the middle
  const cut = f >= 1454 ? 1 : smooth(ramp(f, 1400, 1432)); // the one cut at the bell
  const wag = f >= 93 && f < 175 ? (1 - (f - 93) / 82) * 0.5 + 0.08 : 0; // the tail slap, dying down
  return {
    mode, x, y, z, ry, mark, cut, wag,
    purses: f >= 760 ? 2 : f >= 640 ? 1 : 0,
    smallFish: f >= 1129 ? 1 : 0,
    halvesOnTables: f >= 1565 ? 1 : 0,
  };
};

// ---------- hero / focus ----------
const FOCUS = {
  s01a: () => [-1.5, 1.1, -4.9],
  s01b: () => { const b = fisherAt(70); return [b.x, 1.2, b.z]; },
  s02: () => [0, 0.95, -2.2],
  s03a: () => [-0.9, 1.5, -3.35],
  s03b: () => [-0.35, 1.35, -2.2],
  s04: () => [0, 0.85, 1.6],
  s05a: () => [0, 1.0, -2.2],
  s05b: () => [0, 1.25, -1.2],
  s06a: () => [0.2, 1.3, -1.15],
  s06b: () => [0.2, 1.3, -1.15],
  s07: () => [0.9, 1.0, -1.9],
  s08: () => [-0.9, 1.0, -1.9],
  s09: () => [0, 0.9, -2.0],
  s10a: () => { const b = fisherAt(930); return [b.x, 1.2, b.z]; },
  s10b: () => [SCALE_POS.x, 1.5, SCALE_POS.z],
  s11: () => [0.2, 1.0, -2.2],
  s12: () => [0, 0.8, -2.2],
  s13: () => [-0.9, 1.45, -3.35],
  s14a: () => [0.4, 1.1, -3.2],
  s14b: () => [0, 1.0, -2.2],
  s15a: () => [-0.9, 1.5, -3.35],
  s15b: () => [-0.3, 1.3, -2.0],
  s16a: () => [INN_TABLE.x, 1.0, INN_TABLE.z],
  s16b: () => [BAK_TABLE.x, 1.0, BAK_TABLE.z],
  s17: () => [BOARD_POS[0], 1.0, BOARD_POS[2]],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras (the raised bar: EVERY sub-shot travels) ----------
// The quay: sea z<-6.4, fish board at (0,-2.2), boss stall behind it
// (z 0.4..1.7), steelyard east (5.2,-2.6), bell post (2.6,-4.6),
// inn table east (8.6,2.2), bakery table west (-8.6,2.2), the hook
// board south-east (5.8,6.4).
const fisherPos = (f) => { const a = fisherAt(f); return [a.x, 0, a.z]; };
const bossPos = (f) => { const a = bossAt(f); return [a.x, 0, a.z]; };
const RIG_BY_ID = {
  s01a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [-5.6, 3.0, 1.6], look: [-1.5, 1.05, -4.7], fov: 42 },
    { f: 44, pos: [-4.4, 2.5, 0.4], look: [-1.7, 1.05, -4.3], fov: 38, ease: 'surge' }] }) },
  s01b: { cut: 'hard', raw: pushInCam({ subject: fisherPos, a: 45, b: 90, d0: 3.8, d1: 3.1, h0: 1.78, h1: 1.66, lookOff: [0, 1.26, 0], fov0: 37, fov1: 34, dir: [0.62, 0.78] }) },
  s02: { cut: 'hard', raw: keysCam({ keys: [
    { f: 91, pos: [4.3, 2.3, 2.1], look: [0.35, 1.0, -1.95], fov: 39 },
    { f: 175, pos: [3.3, 2.0, 0.9], look: [0.35, 1.0, -1.95], fov: 35, ease: 'surge' }] }) },
  s03a: { cut: 'hard', raw: pushInCam({ subject: bossPos, a: 176, b: 216, d0: 3.1, d1: 2.55, h0: 1.68, h1: 1.6, lookOff: [0, 1.48, 0], fov0: 35, fov1: 31, dir: [-0.25, -0.97] }) },
  s03b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 217, pos: [2.6, 2.05, 2.9], look: [-0.5, 1.3, -2.3], fov: 40 },
    { f: 260, pos: [2.2, 1.95, 2.3], look: [-0.45, 1.3, -2.3], fov: 37, ease: 'surge' }] }) },
  s04: { cut: 'hard', raw: keysCam({ keys: [
    { f: 261, pos: [-7.6, 3.4, 6.4], look: [-0.9, 0.85, -0.5], fov: 41 },
    { f: 354, pos: [7.6, 3.4, 6.4], look: [0.4, 0.85, -0.2], fov: 41, ease: 'smooth' }] }) },
  s05a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 355, pos: [0.4, 2.6, 3.4], look: [0, 1.0, -2.2], fov: 41 },
    { f: 405, pos: [0.3, 2.4, 2.6], look: [0, 1.02, -2.2], fov: 38, ease: 'surge' }] }) },
  s05b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 406, pos: [1.8, 2.0, 2.2], look: [0, 1.22, -1.35], fov: 38 },
    { f: 458, pos: [1.2, 1.9, 1.5], look: [0, 1.22, -1.35], fov: 35, ease: 'surge' }] }) },
  s06a: { cut: 'hard', raw: pushInCam({ subject: fisherPos, a: 459, b: 500, d0: 3.0, d1: 2.5, h0: 1.66, h1: 1.6, lookOff: [0, 1.34, 0], fov0: 35, fov1: 32, dir: [0.55, 0.83] }) },
  // DOLLY ZOOM A — "sell one fish — twice": dolly IN on the smiling
  // fisherman while the lens opens 32 -> 50; he holds his size, the
  // quay and the sea stretch behind him.
  s06b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 501, pos: [2.05, 1.72, 1.75], look: [0.2, 1.3, -1.15], fov: 32 },
    { f: 547, pos: [1.45, 1.64, 1.0], look: [0.2, 1.3, -1.15], fov: 50, ease: 'smooth' }] }) },
  s07: { cut: 'hard', raw: keysCam({ keys: [
    { f: 548, pos: [5.3, 2.2, 2.1], look: [1.15, 1.02, -1.9], fov: 38 },
    { f: 679, pos: [4.4, 2.05, 1.4], look: [1.15, 1.02, -1.9], fov: 34, ease: 'surge' }] }) },
  s08: { cut: 'hard', raw: keysCam({ keys: [
    { f: 680, pos: [-5.3, 2.2, 2.1], look: [-1.15, 1.02, -1.9], fov: 38 },
    { f: 797, pos: [-4.4, 2.05, 1.4], look: [-1.15, 1.02, -1.9], fov: 34, ease: 'surge' }] }) },
  s09: { cut: 'hard', raw: keysCam({ keys: [
    { f: 798, pos: [2.7, 2.1, 1.5], look: [0, 0.92, -2.0], fov: 39 },
    { f: 901, pos: [3.5, 3.5, 3.6], look: [0, 0.9, -2.0], fov: 37, ease: 'smooth' }] }) },
  s10a: { cut: 'hard', raw: pushInCam({ subject: fisherPos, a: 902, b: 960, d0: 3.6, d1: 3.0, h0: 1.8, h1: 1.7, lookOff: [0, 1.24, 0], fov0: 37, fov1: 34, dir: [0.72, 0.69] }) },
  s10b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 961, pos: [1.45, 2.05, 1.35], look: [4.6, 1.4, -2.6], fov: 39 },
    { f: 1027, pos: [1.7, 1.9, 0.75], look: [4.6, 1.38, -2.6], fov: 35, ease: 'surge' }] }) },
  s11: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1028, pos: [3.6, 1.95, 0.8], look: [0.9, 1.06, -2.15], fov: 37 },
    { f: 1078, pos: [2.2, 1.85, 0.2], look: [0.35, 1.09, -2.2], fov: 35, ease: 'smooth' },
    { f: 1128, pos: [1.7, 1.8, -0.1], look: [0.1, 1.13, -2.2], fov: 33, ease: 'surge' }] }) },
  // s12: the DRONE measure view — straight down the board: the giant
  // spans the plank, the market's ordinary fish beside it is shorter
  // than either half.
  s12: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1129, pos: [-0.4, 13.8, 1.6], look: [0, 0.8, -2.2], fov: 34 },
    { f: 1237, pos: [-0.9, 13.8, 0.7], look: [0, 0.8, -2.2], fov: 34, ease: 'smooth' }] }) },
  s13: { cut: 'hard', raw: pushInCam({ subject: bossPos, a: 1238, b: 1330, d0: 3.3, d1: 2.7, h0: 1.7, h1: 1.62, lookOff: [0, 1.46, 0], fov0: 36, fov1: 32, dir: [-0.3, -0.95] }) },
  s14a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1331, pos: [4.9, 2.5, 1.6], look: [0.9, 1.15, -3.1], fov: 40 },
    { f: 1390, pos: [4.2, 2.3, 0.9], look: [0.7, 1.1, -3.0], fov: 37, ease: 'surge' }] }) },
  // DOLLY ZOOM B — the one cut: dolly IN on the board as the halves
  // part, lens opens 33 -> 49; the fish holds, the market warps.
  s14b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1391, pos: [2.6, 1.72, 0.5], look: [0, 1.0, -2.2], fov: 33 },
    { f: 1453, pos: [2.0, 1.62, -0.2], look: [0, 1.0, -2.2], fov: 49, ease: 'smooth' }] }) },
  s15a: { cut: 'hard', raw: pushInCam({ subject: bossPos, a: 1454, b: 1510, d0: 3.0, d1: 2.5, h0: 1.66, h1: 1.6, lookOff: [0, 1.48, 0], fov0: 34, fov1: 30, dir: [-0.75, -0.66] }) },
  s15b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1511, pos: [-3.8, 2.1, 0.2], look: [-0.3, 1.28, -2.1], fov: 38 },
    { f: 1564, pos: [-3.4, 2.0, 0.6], look: [-0.3, 1.28, -2.1], fov: 35, ease: 'surge' }] }) },
  s16a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1565, pos: [4.6, 2.3, 6.6], look: [8.6, 1.0, 2.3], fov: 39 },
    { f: 1622, pos: [5.3, 2.15, 5.9], look: [8.6, 1.0, 2.3], fov: 36, ease: 'surge' }] }) },
  s16b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1623, pos: [-4.6, 2.3, 6.6], look: [-8.6, 1.0, 2.3], fov: 39 },
    { f: 1681, pos: [-5.3, 2.15, 5.9], look: [-8.6, 1.0, 2.3], fov: 36, ease: 'surge' }] }) },
  s17: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1682, pos: [9.9, 2.5, 10.2], look: [5.8, 1.0, 6.4], fov: 47 },
    { f: 1799, pos: [10.15, 2.6, 10.45], look: [5.8, 1.0, 6.4], fov: 45, ease: 'surge' }] }) },
};
const RIG_SEGMENTS = SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] }));
const RIG = buildRig({ total: TOTAL, shots: RIG_SEGMENTS, kicks: [], sigma: 2.8, fovSigma: 1.6 });
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: [], whips: RIG.declared.whips, samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.8;
  if (['s01a', 's04', 's09', 's14a', 's17'].includes(S.id)) cinf = 1.3;
  if (['s06b', 's14b'].includes(S.id)) cinf = 2.4;
  if (S.id === 's12') cinf = 0.8;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world dynamics ----------
export const dynAt = (f) => {
  const FA = fishAt(f);
  return {
    fishMode: FA.mode, fishMark: FA.mark, fishCut: FA.cut,
    // the evening bell swings as it rings (L14), then settles
    bellSwing: f >= 1333 && f < 1470 ? Math.sin((f - 1333) * 0.55) * Math.exp(-(f - 1333) / 55) : 0,
    // the steelyard beam tips as the giant settles into the sling
    scaleTip: smooth(ramp(f, 982, 1012)),
  };
};
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    boardK: S.id === 's17' ? smooth(ramp(f, 1720, 1745)) : 0,
    ...dynAt(f),
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: 0, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
const SKIN = '#ffe2c2'; // warmed so ballFill shading reads
export const OUTFITS = {
  fisher: { jacket: '#7a6a4f', pants: '#4a3a2c', boots: '#241a12', hat: 'hair', hair: '#2c1c10', shirtFront: '#c9b18a', skin: SKIN },
  boss: { build: 'stout', jacket: '#7a4a21', pants: '#3a3230', boots: '#1c1410', hat: 'turban', shirtFront: '#e8dcc2', skin: SKIN, moustache: '#3a2a1a', bigMoustache: true },
  inn: { jacket: '#8a3324', pants: '#33413a', boots: '#1c1712', hat: 'cap', cap: '#f2c230', shirtFront: '#efe3c8', skin: SKIN },
  baker: { jacket: '#e6ddc8', pants: '#4a4238', boots: '#1c1712', hat: 'cap', cap: '#f7f2e2', shirtFront: '#f7f2e2', skin: SKIN },
  guestA: { jacket: '#2e6e5e', pants: '#33413a', boots: '#1c1712', hat: 'cap', cap: '#b3392e', skin: SKIN },
  guestB: { jacket: '#4a5d8a', pants: '#2e3242', boots: '#1c1712', hat: 'hair', hair: '#1c1410', skin: SKIN },
};
const TINT = { day: '#ffffff' };
const emoTrack = (initial, events) => ({
  at(f) {
    let from = T.faceP(initial), to = from, t0 = 0, dur = 0;
    const seg = (g) => {
      if (dur <= 0 || g >= t0 + dur) return { ...to };
      if (g <= t0) return { ...from };
      const u = (g - t0) / dur, s = u * u * u * (u * (u * 6 - 15) + 10), o = {};
      for (const k in to) o[k] = from[k] + (to[k] - from[k]) * s;
      return o;
    };
    for (const [ef, name, ed] of events) {
      if (ef > f) break;
      from = seg(ef); to = T.faceP(name); t0 = ef; dur = Math.max(1, ed);
    }
    return seg(f);
  },
});
const emoFisher = emoTrack('determined', [[91, 'determined', 12], [176, 'sad', 12], [261, 'neutral', 12], [406, 'determined', 12], [459, 'smile', 12], [501, 'grin', 12], [548, 'smile', 12], [798, 'proud', 12], [902, 'determined', 12], [1028, 'determined', 12], [1238, 'smile', 12], [1331, 'determined', 12], [1391, 'grin', 12], [1454, 'grin', 12], [1565, 'grin', 12], [1682, 'smile', 12]]);
const emoBoss = emoTrack('proud', [[176, 'smug', 12], [217, 'laugh', 15], [355, 'smug', 12], [548, 'stern', 12], [798, 'stern', 12], [974, 'nervous', 12], [1131, 'nervous', 12], [1238, 'smug', 12], [1331, 'nervous', 12], [1391, 'shock', 12], [1454, 'nervous', 12], [1492, 'pained', 15], [1565, 'smile_closed', 15], [1682, 'smile_closed', 15]]);
const emoInn = emoTrack('determined', [[406, 'determined', 12], [548, 'smile', 12], [798, 'smile', 12], [1454, 'grin', 12], [1565, 'laugh', 15], [1682, 'smile', 12]]);
const emoBaker = emoTrack('determined', [[406, 'determined', 12], [548, 'smile', 12], [798, 'smile', 12], [1454, 'grin', 12], [1623, 'laugh', 15], [1682, 'smile', 12]]);
const emoGuest = emoTrack('smile', [[1565, 'laugh', 15], [1623, 'laugh', 15]]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});
const spk = (baseP, f) => {
  const s = SPEAK.at(f);
  if (!s.active) return { exprP: baseP, nod: 0 };
  return { exprP: SPK.applySpeak({ ...baseP }, s), nod: q(s.nod || 0, 2) };
};
const mv = (a) => (a && a.moving ? { mode: 'march', phase: q(a.phase || 0, 2) } : { mode: 'stand' });

export const castAt = (f) => {
  const S = shotAt(f), tint = TINT.day, out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: extra.ground || 0,
    actor: (T2) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T2.bodyFront(p, o, opts); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const fi = fisherAt(f), bo = bossAt(f), ia = innAt(f), ba = bakerAt(f), gA = guestAAt(f), gB = guestBAt(f);
  const FP = emoFisher.at(f), BP = emoBoss.at(f), IP = emoInn.at(f), KP = emoBaker.at(f), GP = emoGuest.at(f);
  FP.blush = 0; BP.blush = 0; IP.blush = 0; KP.blush = 0; GP.blush = 0;
  const fisher = (opts = {}, extra = {}) => std('fisher', OUTFITS.fisher, { expr: 'neutral', exprP: FP, blink: blinkAt(f, 31), seed: 31, ...mv(fi), ...opts }, fi.x, fi.z, extra);
  const boss = (opts = {}, extra = {}) => std('boss', OUTFITS.boss, { expr: 'proud', exprP: BP, blink: blinkAt(f, 51), seed: 51, ...mv(bo), ...opts }, bo.x, bo.z, extra);
  const inn = (opts = {}, extra = {}) => std('inn', OUTFITS.inn, { expr: 'determined', exprP: IP, blink: blinkAt(f, 41), seed: 41, ...mv(ia), ...opts }, ia.x, ia.z, extra);
  const baker = (opts = {}, extra = {}) => std('baker', OUTFITS.baker, { expr: 'determined', exprP: KP, blink: blinkAt(f, 61), seed: 61, ...mv(ba), ...opts }, ba.x, ba.z, extra);
  const guestA = (opts = {}, extra = {}) => std('guestA', OUTFITS.guestA, { expr: 'smile', exprP: GP, blink: blinkAt(f, 71), seed: 71, ...opts }, gA.x, gA.z, extra);
  const guestB = (opts = {}, extra = {}) => std('guestB', OUTFITS.guestB, { expr: 'smile', exprP: GP, blink: blinkAt(f, 81), seed: 81, ...opts }, gB.x, gB.z, extra);
  const carry = ['bigfish', 0.85];
  const cheerWave = { wave: q(Math.sin(f * 0.32) * 0.85, 2) };
  switch (S.id) {
    case 's01a': case 's01b':
      fisher({ expr: 'determined', prop: carry, ...head(f, 31, 1.2, 0.1, 0.3) }, { yaw: 0.15 });
      break;
    case 's02':
      if (f < 82) fisher({ expr: 'determined', prop: carry, ...head(f, 31, 1.2, 0.1, 0.3) }, { yaw: 0.15 });
      else if (f < 100) fisher({ expr: 'determined', ...head(f, 31, 1.0, 0.15, 0.25) }, { yaw: 0.2 });
      else fisher({ expr: 'determined', prop: ['point', 0.75], ...head(f, 31, 0.9, 0.3, 0.2) }, { yaw: 0.3 });
      boss({ ...head(f, 51, -0.6, 0.1, 0) }, { yaw: 0.15 });
      break;
    case 's03a': case 's03b': {
      // the market boss's MOCK — performed dialogue (speak track, L3)
      const SM = spk(BP, f);
      boss({ expr: 'smug', exprP: SM.exprP, prop: ['point', 0.8], ...head(f, 51, -2.0 + SM.nod, 0.25, 0.05, 0.2) }, { yaw: 0.2 });
      fisher({ expr: 'sad', ...head(f, 31, 1.8, -0.25, 0.2, -0.25) }, { yaw: -0.25 });
      break;
    }
    case 's04':
      fisher({ ...head(f, 31, 0.6, 0.2, 0.1) }, { yaw: 0.2 });
      boss({ prop: ['point', 0.6], ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      inn({ prop: ['pan', 0.5], ...head(f, 41, 0.7, 0, 0.15) }, { yaw: -0.3 });
      baker({ ...head(f, 61, 0.7, 0, 0.15) }, { yaw: 0.3 });
      break;
    case 's05a':
      fisher({ expr: 'determined', ...head(f, 31, 0.7, 0.2, 0.1) }, { yaw: 0.2 });
      boss({ expr: 'smug', ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      inn({ expr: 'determined', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.35 });
      baker({ expr: 'determined', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.35 });
      break;
    case 's05b':
      fisher({ expr: 'determined', prop: ['point', 0.7], ...head(f, 31, 0.6, 0, 0.05) }, { yaw: 0 });
      inn({ expr: 'determined', prop: ['point', 0.85], ...head(f, 41, 0.4, -0.35, 0, -0.3) }, { yaw: -0.45 });
      baker({ expr: 'determined', prop: ['point', 0.85], ...head(f, 61, 0.4, 0.35, 0, 0.3) }, { yaw: 0.45 });
      boss({ expr: 'smug', ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      break;
    case 's06a':
      fisher({ expr: 'smile', ...head(f, 31, 0.5, 0.15, 0) }, { yaw: 0.15 });
      inn({ ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.3 });
      baker({ ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.3 });
      break;
    case 's06b':
      fisher({ expr: 'grin', prop: ['count', 0.55], ...head(f, 31, 0.4, 0.1, -0.05) }, { yaw: 0.1 });
      break;
    case 's07':
      inn({ expr: 'smile', prop: ['coin', 0.55], ...head(f, 41, 0.7, -0.25, 0.15, -0.2) }, { yaw: -0.3 });
      fisher({ expr: 'smile', ...head(f, 31, 0.6, 0.25, 0.1) }, { yaw: 0.3 });
      baker({ expr: 'determined', ...head(f, 61, 0.5, 0.3, 0) }, { yaw: 0.35 });
      boss({ expr: 'stern', ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      break;
    case 's08':
      baker({ expr: 'smile', prop: ['coin', 0.55], ...head(f, 61, 0.7, 0.25, 0.15, 0.2) }, { yaw: 0.3 });
      fisher({ expr: 'smile', ...head(f, 31, 0.6, -0.25, 0.1) }, { yaw: -0.3 });
      inn({ expr: 'determined', ...head(f, 41, 0.5, -0.3, 0) }, { yaw: -0.35 });
      boss({ expr: 'stern', ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      break;
    case 's09':
      fisher({ expr: 'proud', prop: ['point', 0.8], ...head(f, 31, 0.5, 0.2, 0) }, { yaw: 0.2 });
      inn({ expr: 'smile', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.3 });
      baker({ expr: 'smile', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.3 });
      boss({ expr: 'stern', prop: ['point', 0.6], ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      break;
    case 's10a':
      fisher({ expr: 'determined', prop: carry, ...head(f, 31, 1.1, 0.1, 0.28) }, { yaw: 0.3 });
      boss({ expr: 'stern', ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      break;
    case 's10b':
      if (f < 980) fisher({ expr: 'determined', prop: carry, ...head(f, 31, 1.1, 0.1, 0.28) }, { yaw: 0.3 });
      else fisher({ expr: 'determined', prop: ['point', 0.7], ...head(f, 31, 0.8, 0.3, 0.1) }, { yaw: 0.35 });
      boss({ expr: 'nervous', ...head(f, 51, -0.6, 0, 0) }, { yaw: -0.2 });
      break;
    case 's11':
      if (f < 1082) fisher({ expr: 'determined', prop: ['point', 0.72], ...head(f, 31, 0.8, 0.25, 0.15) }, { yaw: 0.25 });
      else fisher({ expr: 'determined', prop: ['chalk', 0.5], mode: 'kneel1', ...head(f, 31, 1.7, 0.2, 0.4) }, { yaw: 0.2 });
      boss({ expr: 'nervous', ...head(f, 51, -0.6, 0, 0) }, { yaw: -0.2 });
      inn({ ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.3 });
      baker({ ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.3 });
      break;
    case 's12':
      fisher({ expr: 'determined', prop: ['point', 0.7], ...head(f, 31, 0.7, 0.25, 0.1) }, { yaw: 0.25 });
      boss({ expr: 'nervous', ...head(f, 51, -0.6, 0, 0) }, { yaw: -0.2 });
      break;
    case 's13':
      boss({ expr: 'smug', prop: ['point', 0.65], ...head(f, 51, -1.2, 0.15, 0) }, { yaw: -0.15 });
      fisher({ expr: 'smile', ...head(f, 31, 0.6, 0.2, 0.05) }, { yaw: 0.2 });
      inn({ ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.3 });
      baker({ ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.3 });
      break;
    case 's14a':
      fisher({ expr: 'determined', prop: ['carve', 0.55], ...head(f, 31, 1.0, 0.2, 0.25) }, { yaw: 0.25 });
      boss({ expr: 'nervous', ...head(f, 51, -0.7, 0, 0) }, { yaw: -0.2 });
      inn({ ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.3 });
      baker({ expr: 'smile', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.3 });
      break;
    case 's14b':
      fisher({ expr: 'determined', prop: ['carve', 0.5], mode: 'kneel1', ...head(f, 31, 1.6, 0.2, 0.35) }, { yaw: 0.25 });
      boss({ expr: 'shock', ...head(f, 51, -0.4, 0, -0.05) }, { yaw: -0.2 });
      inn({ expr: 'shock', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.3 });
      baker({ expr: 'shock', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.3 });
      break;
    case 's15a': case 's15b': {
      // the market boss's ADMISSION — performed dialogue (speak track, L15)
      const SM = spk(BP, f);
      boss({ expr: 'nervous', exprP: SM.exprP, ...head(f, 51, 1.9 + SM.nod, -0.1, 0.12, -0.15) }, { yaw: -0.15 });
      fisher({ expr: 'grin', ...head(f, 31, 0.7, 0.25, 0) }, { yaw: 0.25 });
      inn({ expr: 'grin', ...head(f, 41, 0.6, -0.2, 0) }, { yaw: -0.3 });
      baker({ expr: 'grin', ...head(f, 61, 0.6, 0.2, 0) }, { yaw: 0.3 });
      break;
    }
    case 's16a':
      fisher({ expr: 'grin', ...cheerWave, ...head(f, 31, 0.4, 0, -0.05) }, { yaw: -0.2 });
      inn({ expr: 'laugh', ...cheerWave, ...head(f, 41, Math.sin(f * 0.3) * 1.6, 0, -0.05) }, { yaw: -0.25 });
      guestA({ expr: 'laugh', prop: ['clap', 0.8], ...head(f, 71, Math.sin(f * 0.34 + 1) * 1.6, 0, 0) }, { yaw: -0.2 });
      break;
    case 's16b':
      fisher({ expr: 'grin', ...cheerWave, ...head(f, 31, 0.4, 0, -0.05) }, { yaw: 0.2 });
      baker({ expr: 'laugh', ...cheerWave, ...head(f, 61, Math.sin(f * 0.3 + 2) * 1.6, 0, -0.05) }, { yaw: 0.25 });
      guestB({ expr: 'laugh', prop: ['clap', 0.8], ...head(f, 81, Math.sin(f * 0.34) * 1.6, 0, 0) }, { yaw: 0.2 });
      break;
    case 's17':
      fisher({ expr: 'smile', prop: ['wave', 0.8], ...head(f, 31, 0.5, 0, 0) }, { yaw: -0.15 });
      boss({ expr: 'smile_closed', ...head(f, 51, 0.8, 0, 0) }, { yaw: -0.25 });
      inn({ expr: 'smile', prop: ['clap', 0.8], ...head(f, 41, 0.5, 0, 0) }, { yaw: -0.3 });
      baker({ expr: 'smile', ...head(f, 61, 0.5, 0, 0) }, { yaw: 0.2 });
      break;
    default:
      fisher({}); boss({});
  }
  return out;
};
export const actorsAt = (f, T2) => castAt(f).map((c) => c.actor(T2));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-1.75, 1.75, -2.75, -1.65, { h: 0.85, id: 'fishboard' }),
  SOL.aabb(-2.3, 1.3, 0.35, 1.7, { h: 2.3, id: 'stall' }),
  SOL.circle(SCALE_POS.x, SCALE_POS.z, 0.16, { h: 2.4, id: 'scalepost' }),
  SOL.aabb(6.75, 10.45, 1.6, 2.8, { h: 0.95, id: 'inntable' }),
  SOL.aabb(-10.45, -6.75, 1.6, 2.8, { h: 0.95, id: 'baketable' }),
  SOL.circle(BELL_POS.x, BELL_POS.z, 0.12, { h: 2.6, id: 'bellpost' }),
  SOL.circle(BOARD_POS[0], BOARD_POS[2], 0.3, { h: 1.9, id: 'boardstand' }),
  SOL.aabb(-3.6, -2.9, -0.9, -0.2, { h: 0.9, id: 'crate' }),
  SOL.circle(-3.3, 1.35, 0.34, { h: 0.95, id: 'barrel' }),
  SOL.circle(3.1, 0.95, 0.34, { h: 0.95, id: 'barrel' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => castAt(f).map((a) => SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
