// Shot plan for "The Diamond Heist" — built on the approved Salted Mine
// 60 run-3 / Paid-for-Smell template (same painter/cast family, N1 voice).
// The grand hotel's famous diamond sits in a glass case in the marble
// lobby. The night porter — mocked by the manager as "furniture" — plans
// the theft in three SHOWN steps (the clock and the guard's round; a
// glass copy polished until it throws the same sparkle; the gala-night
// move to the safe) and swaps the stones DURING the move itself, so the
// manager locks his own glass copy in the safe, with a note. The payoff
// lands on the mocker. ONE set (the lobby), DAYLIGHT throughout (the
// gala is a blazing bright evening; the reveal is morning sun).
// CAMERA (Abid's raised bar, 2026-11-21): the camera NEVER sits still —
// every sub-shot is a travelling move (push-in, track-along, arc/orbit,
// crane) and the plan-reveal (s05) and the lock (s14b) are true DOLLY
// ZOOMS (dolly + counter-zoom, subject size holds, background warps).
// Exactly 60.000 s / 1800 frames @30 fps. Shots cut ONLY on voice lines
// and word onsets (stem = voice_final.wav, timing.json):
//   L1 0-89 · L2 93-171 · L3 175-320 (MANAGER dialogue, performed) ·
//   L4 324-414 · L5 418-482 · L6 486-579 · L7 583-691 · L8 696-799 ·
//   L9 803-927 · L10 932-1039 · L11 1043-1128 · L12 1132-1255 ·
//   L13 1259-1355 · L14 1359-1464 · L15 1468-1560 (MANAGER reads the
//   note, performed) · L16 1564-1668 · L17 1672-1798 (narration+board).
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
  { id: 's01b', a: 45, b: 92, light: 'day' },
  { id: 's02a', a: 93, b: 131, light: 'day' },
  { id: 's02b', a: 132, b: 174, light: 'day' },
  { id: 's03a', a: 175, b: 231, light: 'day' },
  { id: 's03b', a: 232, b: 274, light: 'day' },
  { id: 's03c', a: 275, b: 323, light: 'day' },
  { id: 's04a', a: 324, b: 368, light: 'day' },
  { id: 's04b', a: 369, b: 417, light: 'day' },
  { id: 's05', a: 418, b: 485, light: 'day' },
  { id: 's06a', a: 486, b: 532, light: 'day' },
  { id: 's06b', a: 533, b: 582, light: 'day' },
  { id: 's07a', a: 583, b: 636, light: 'day' },
  { id: 's07b', a: 637, b: 695, light: 'day' },
  { id: 's08a', a: 696, b: 747, light: 'day' },
  { id: 's08b', a: 748, b: 802, light: 'day' },
  { id: 's09a', a: 803, b: 864, light: 'gala' },
  { id: 's09b', a: 865, b: 931, light: 'gala' },
  { id: 's10a', a: 932, b: 985, light: 'gala' },
  { id: 's10b', a: 986, b: 1042, light: 'gala' },
  { id: 's11a', a: 1043, b: 1085, light: 'gala' },
  { id: 's11b', a: 1086, b: 1131, light: 'gala' },
  { id: 's12a', a: 1132, b: 1180, light: 'gala' },
  { id: 's12b', a: 1181, b: 1258, light: 'gala' },
  { id: 's13a', a: 1259, b: 1304, light: 'gala' },
  { id: 's13b', a: 1305, b: 1358, light: 'gala' },
  { id: 's14a', a: 1359, b: 1410, light: 'gala' },
  { id: 's14b', a: 1411, b: 1467, light: 'gala' },
  { id: 's15a', a: 1468, b: 1510, light: 'dawn' },
  { id: 's15b', a: 1511, b: 1563, light: 'dawn' },
  { id: 's16a', a: 1564, b: 1612, light: 'dawn' },
  { id: 's16b', a: 1613, b: 1671, light: 'dawn' },
  { id: 's17', a: 1672, b: 1799, light: 'dawn' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights: three DAYLIGHT grades (day / bright gala / dawn) ----------
export const LIGHTS = {
  day: { az: 218, el: 44, sky: '#ffe9bb', ground: '#8a6f4a', hemi: 1.04, sun: '#ffdca3', sunI: 2.5, fog: '#eed9ae', fogNear: 42, fogFar: 320,
    skyTop: '#3f6fb4', skyHor: '#f6d491', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.1, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#fff0cd', waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  gala: { az: 205, el: 38, sky: '#ffe4b0', ground: '#8a6a44', hemi: 1.1, sun: '#ffd9a0', sunI: 2.65, fog: '#f2ddb0', fogNear: 42, fogFar: 320,
    skyTop: '#46689e', skyHor: '#f8cf8e', sunDisc: '#ffedb8', sunSize: 0.0046, sat: 1.13, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#ffe9c4', waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  dawn: { az: 152, el: 27, sky: '#ffe2b0', ground: '#7d6244', hemi: 1.0, sun: '#ffc98f', sunI: 2.55, fog: '#efdcae', fogNear: 42, fogFar: 320,
    skyTop: '#4a74ac', skyHor: '#f8cf9a', sunDisc: '#ffeec2', sunSize: 0.005, sat: 1.11, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#ffedc8', waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const BOARD_POS = [2.15, 0.98, 1.9];
export const BOARD_RY = -0.42;
const CASE = { x: 0, z: -3 };
const SAFE_FRONT = { x: 5.35, z: -9.55 };

// walk helper: ONE M.walk call drives BOTH the position along a segment
// and the bodyFront march phase — feet can never slide (distance and
// phase come from the same integral).
const walkAlong = (f, f0, from, to, speed, stride) => {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const wk = walk(f, f0, speed, stride);
  const d = Math.min(wk.dist, len);
  const u = len ? d / len : 0;
  return { x: from[0] + dx * u, z: from[1] + dz * u, phase: wk.phase, moving: f >= f0 && wk.dist < len };
};

// ---------- actor anchors (single source; checked against STATICS) ----------
export const porterAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's01a': case 's01b': case 's02a': case 's02b': return { x: 4.55, z: -0.75 };
    case 's03a': case 's03b': case 's03c': case 's04a': return { x: -3.1, z: -7.3 };
    case 's04b': { const w = walkAlong(f, 369, [-3.1, -7.3], [-1.7, -5.5], 1.45, 0.72); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's05': return { x: -1.7, z: -5.5 };
    case 's06a': return { x: 5.35, z: -0.15 };
    case 's06b': { const w = walkAlong(f, 545, [5.35, -0.15], [4.7, -1.15], 1.0, 0.6); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's07a': case 's07b': case 's08a': return { x: 4.55, z: -0.75 };
    case 's08b': return { x: 4.55, z: -0.75 };
    case 's09a': case 's11a': case 's11b': case 's12a': return { x: 2.35, z: -9.5 };
    case 's12b': { const w = walkAlong(f, 1206, [2.35, -9.5], [3.05, -8.62], 1.05, 0.62); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's13a': case 's13b': return { x: 3.05, z: -8.62 };
    case 's14a': case 's14b': return { x: 2.35, z: -9.5 };
    case 's16b': return { x: 4.55, z: -0.75 };
    case 's17': return { x: -1.25, z: 0.8 };
    default: return { x: 4.55, z: -0.75 };
  }
};
// the manager's gala walk: ONE straight line from the desk side to the
// safe, HALTED by the chime at dist 8.45 — with stride 0.845 the phase
// at the halt is exactly 0 (feet together, a clean stop), and the
// resume restarts from that same clean phase.
const GALA_FROM = [-4.6, -6.4], GALA_DIR = [0.9532, -0.3017], GALA_LEN = 10.44;
const galaDist = (f) => {
  if (f < 1348) return Math.min(walk(f, 1043, 1.6, 0.845).dist, 8.45);
  return Math.min(8.45 + walk(f, 1348, 1.6, 0.845).dist, GALA_LEN);
};
export const managerPhase = (f) => (galaDist(f) / (2 * 0.845)) % 1;
export const managerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's02a': case 's02b': case 's09a': return { x: -4.9, z: -8.55 };
    case 's03a': case 's03b': case 's03c': return { x: -4.3, z: -8.15 };
    case 's04a': return { x: -3.85, z: -7.8 };
    case 's09b': return { x: 4.95, z: -9.35 };
    case 's10a': case 's10b': return { x: -4.9, z: -8.55 };
    case 's11a': case 's11b': case 's12a': case 's12b': case 's13a': case 's13b': case 's14a': {
      const d = galaDist(f);
      const moving = (f >= 1043 && f < 1201) || (f >= 1348 && d < GALA_LEN);
      return { x: GALA_FROM[0] + GALA_DIR[0] * d, z: GALA_FROM[1] + GALA_DIR[1] * d, phase: managerPhase(f), moving };
    }
    case 's14b': case 's15a': case 's15b': return { x: SAFE_FRONT.x, z: SAFE_FRONT.z };
    case 's16a': { const w = walkAlong(f, 1564, [5.35, -9.55], [2.2, -5.9], 3.4, 1.065); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's16b': {
      if (f < 1606) { const w = walkAlong(f, 1564, [5.35, -9.55], [2.2, -5.9], 3.4, 1.065); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      const w = walkAlong(f, 1606, [2.2, -5.9], [1.62, -2.1], 3.4, 1.065); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving };
    }
    case 's17': return { x: 1.75, z: -1.15 };
    default: return { x: -4.9, z: -8.55 };
  }
};
export const guardAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's02a': case 's02b': return { x: -2.9, z: -4.4 };
    case 's06a': case 's06b': { const w = walkAlong(f, 486, [-4.4, -1.05], [4.6, -1.05], 1.5, 0.78); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's09a': return { x: 1.95, z: -4.55 };
    case 's17': return { x: 4.3, z: -3.3 };
    default: return { x: -2.9, z: -4.4 };
  }
};
export const guestAAt = (f) => {
  const S = shotAt(f);
  if (['s09a', 's11a', 's12a', 's12b'].includes(S.id)) return { x: -2.3, z: -4.8 };
  return { x: -1.3, z: -1.2 };
};
export const guestBAt = (f) => {
  const S = shotAt(f);
  if (['s09a', 's11a', 's11b', 's12a', 's12b'].includes(S.id)) return { x: 2.5, z: -5.1 };
  return { x: 1.8, z: -0.9 };
};
export const guestCAt = (f) => {
  const S = shotAt(f);
  if (['s09a', 's11a', 's12a'].includes(S.id)) return { x: -0.9, z: -6.9 };
  return { x: 0.4, z: 0.9 };
};

// ---------- hero / focus ----------
const FOCUS = {
  s01a: () => [CASE.x, 1.35, CASE.z],
  s01b: () => [CASE.x, 1.36, CASE.z],
  s02a: () => [CASE.x, 1.3, CASE.z],
  s02b: () => [CASE.x, 1.32, CASE.z],
  s03a: () => [-4.3, 1.45, -8.15],
  s03b: () => [-3.1, 1.35, -7.3],
  s03c: () => [-4.3, 1.45, -8.15],
  s04a: () => [-3.1, 1.35, -7.3],
  s04b: () => { const p = porterAt(393); return [p.x, 1.32, p.z]; },
  s05: () => [0, 4.8, -11.95],
  s06a: () => { const g = guardAt(509); return [g.x, 1.32, g.z]; },
  s06b: () => [2.2, 1.3, -1.4],
  s07a: () => [4.55, 1.2, -0.75],
  s07b: () => [4.87, 0.97, 0.02],
  s08a: () => [4.35, 1.6, -0.6],
  s08b: () => [CASE.x, 1.36, CASE.z],
  s09a: () => [0, 1.3, -3],
  s09b: () => [6.05, 1.2, -10.5],
  s10a: () => [-4.9, 1.45, -8.55],
  s10b: () => [-4.9, 1.42, -8.55],
  s11a: () => { const m = managerAt(1064); return [m.x, 1.3, m.z]; },
  s11b: () => { const m = managerAt(1108); return [m.x, 1.3, m.z]; },
  s12a: () => [0, 4.8, -11.95],
  s12b: () => [3.25, 1.3, -8.8],
  s13a: () => [3.1, 1.05, -8.74],
  s13b: () => [3.2, 1.05, -8.78],
  s14a: () => { const m = managerAt(1385); return [m.x, 1.3, m.z]; },
  s14b: () => [6.05, 1.18, -10.55],
  s15a: () => [6.1, 0.9, -10.55],
  s15b: () => [5.35, 1.45, -9.55],
  s16a: () => { const m = managerAt(1588); return [m.x, 1.3, m.z]; },
  s16b: () => [CASE.x, 1.36, CASE.z],
  s17: () => [0.7, 1.1, 0.5],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: v4 grammar + the raised bar — EVERY shot travels.
// push-ins, track-alongs, arcs/orbits, cranes, and two true dolly zooms
// (s05 plan-reveal, s14b the lock). NO static frames, NO shake. ----------
const porterPos = (f) => { const p = porterAt(f); return [p.x, 0, p.z]; };
const managerPos = (f) => { const m = managerAt(f); return [m.x, 0, m.z]; };
const RIG_BY_ID = {
  s01a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [-5.8, 4.6, 7.6], look: [-0.4, 1.2, -3.1], fov: 42 },
    { f: 44, pos: [-2.6, 2.2, 2.0], look: [0, 1.3, -3], fov: 37, ease: 'surge' }] }) },
  s01b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 45, pos: [1.2, 1.66, 0.5], look: [0, 1.36, -3], fov: 33 },
    { f: 92, pos: [0.58, 1.52, -1.2], look: [0, 1.35, -3], fov: 29, ease: 'surge' }] }) },
  s02a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 93, pos: [-3.6, 1.74, 0.9], look: [-0.4, 1.25, -2.6], fov: 38 },
    { f: 131, pos: [0.2, 1.68, 0.1], look: [0.1, 1.3, -3], fov: 36, ease: 'surge' }] }) },
  s02b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 132, pos: [3.1, 1.95, -0.4], look: [0, 1.3, -3], fov: 37 },
    { f: 174, pos: [1.7, 1.8, 1.6], look: [0, 1.32, -3], fov: 35, ease: 'surge' }] }) },
  s03a: { cut: 'hard', raw: pushInCam({ subject: managerPos, a: 175, b: 231, d0: 3.5, d1: 2.8, h0: 1.62, h1: 1.56, lookOff: [0, 1.48, 0], fov0: 35, fov1: 31,
    dir: () => [0.55, 0.83] }) },
  s03b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 232, pos: [0.4, 1.6, -4.3], look: [-3.15, 1.35, -7.25], fov: 34 },
    { f: 274, pos: [-0.5, 1.56, -4.9], look: [-3.2, 1.36, -7.3], fov: 32, ease: 'surge' }] }) },
  s03c: { cut: 'hard', raw: pushInCam({ subject: managerPos, a: 275, b: 323, d0: 2.6, d1: 2.1, h0: 1.6, h1: 1.55, lookOff: [0, 1.5, 0], fov0: 31, fov1: 28,
    dir: () => [0.5, 0.86] }) },
  s04a: { cut: 'hard', raw: pushInCam({ subject: porterPos, a: 324, b: 368, d0: 3.5, d1: 2.95, h0: 1.62, h1: 1.56, lookOff: [-0.3, 1.42, -0.14], fov0: 35, fov1: 31.5,
    dir: () => [0.55, 0.83] }) },
  s04b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 369, pos: [0.6, 1.7, -3.6], look: [-3.0, 1.3, -7.1], fov: 36 },
    { f: 417, pos: [1.9, 1.66, -2.2], look: [-1.75, 1.32, -5.55], fov: 34, ease: 'surge' }] }) },
  // DOLLY ZOOM A (the plan reveal): dolly IN 7 units while zooming OUT
  // 30→57 — the clock holds its size, the lobby stretches away behind it.
  s05: { cut: 'hard', raw: keysCam({ keys: [
    { f: 418, pos: [1.7, 2.9, 1.6], look: [0, 4.75, -11.9], fov: 30 },
    { f: 485, pos: [1.35, 3.8, -5.4], look: [0, 4.78, -11.95], fov: 57, ease: 'smooth' }] }) },
  s06a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 486, pos: [-6.4, 1.85, 3.1], look: [-4.35, 1.3, -1.05], fov: 39 },
    { f: 509, pos: [-4.2, 1.8, 2.85], look: [-3.1, 1.3, -1.3], fov: 38, ease: 'smooth' },
    { f: 532, pos: [-1.8, 1.78, 2.6], look: [-1.9, 1.3, -1.75], fov: 37, ease: 'surge' }] }) },
  s06b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 533, pos: [-0.9, 1.74, 2.2], look: [-0.9, 1.3, -1.6], fov: 36 },
    { f: 582, pos: [2.6, 1.68, 1.4], look: [3.9, 1.25, -1.3], fov: 34, ease: 'surge' }] }) },
  s07a: { cut: 'hard', raw: pushInCam({ subject: porterPos, a: 583, b: 636, d0: 3.3, d1: 2.6, h0: 1.6, h1: 1.5, lookOff: [0, 1.25, 0], fov0: 34, fov1: 30,
    dir: () => [-0.72, 0.69] }) },
  s07b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 637, pos: [3.3, 1.35, 1.7], look: [4.87, 0.98, 0.02], fov: 33 },
    { f: 695, pos: [4.3, 1.5, 2.1], look: [4.87, 0.98, 0.02], fov: 31, ease: 'surge' }] }) },
  s08a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 696, pos: [6.7, 1.9, 2.4], look: [4.55, 1.55, -0.75], fov: 34 },
    { f: 747, pos: [6.5, 2.0, 2.0], look: [4.55, 1.57, -0.75], fov: 31, ease: 'surge' }] }) },
  s08b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 748, pos: [1.35, 1.66, 0.55], look: [0, 1.36, -3], fov: 33 },
    { f: 802, pos: [0.6, 1.52, -1.25], look: [0, 1.35, -3], fov: 29, ease: 'surge' }] }) },
  s09a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 803, pos: [-5.8, 3.6, 7.4], look: [-0.5, 1.2, -3.5], fov: 41 },
    { f: 864, pos: [-2.4, 2.3, 3.6], look: [0.2, 1.25, -3.2], fov: 38, ease: 'surge' }] }) },
  s09b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 865, pos: [2.9, 1.78, -6.3], look: [5.55, 1.25, -10.2], fov: 36 },
    { f: 931, pos: [3.7, 1.68, -7.3], look: [5.45, 1.22, -10.1], fov: 32, ease: 'surge' }] }) },
  s10a: { cut: 'hard', raw: pushInCam({ subject: managerPos, a: 932, b: 985, d0: 3.4, d1: 2.7, h0: 1.62, h1: 1.56, lookOff: [0, 1.45, 0], fov0: 34, fov1: 30,
    dir: () => [0.45, 0.89] }) },
  s10b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 986, pos: [-1.7, 1.85, -5.6], look: [-4.85, 1.4, -8.5], fov: 35 },
    { f: 1042, pos: [-3.3, 1.7, -5.2], look: [-4.9, 1.42, -8.55], fov: 32, ease: 'surge' }] }) },
  s11a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1043, pos: [-6.8, 2.6, 2.6], look: [-4.5, 1.3, -6.3], fov: 40 },
    { f: 1085, pos: [-3.8, 2.3, 1.2], look: [-2.0, 1.3, -7.3], fov: 38, ease: 'surge' }] }) },
  s11b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1086, pos: [-0.6, 1.75, -3.4], look: [-2.3, 1.3, -7.05], fov: 36 },
    { f: 1131, pos: [2.2, 1.7, -4.6], look: [0.15, 1.3, -7.6], fov: 34, ease: 'surge' }] }) },
  s12a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1132, pos: [1.9, 2.5, -3.2], look: [0.3, 3.4, -11.5], fov: 36 },
    { f: 1180, pos: [1.0, 3.3, -5.6], look: [0, 4.75, -11.95], fov: 31, ease: 'surge' }] }) },
  s12b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1181, pos: [6.8, 1.9, -3.6], look: [3.1, 1.27, -8.9], fov: 38 },
    { f: 1258, pos: [5.2, 1.7, -5.2], look: [3.25, 1.27, -8.8], fov: 34, ease: 'surge' }] }) },
  s13a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1259, pos: [4.9, 1.7, -6.1], look: [3.12, 1.22, -8.74], fov: 33 },
    { f: 1304, pos: [4.6, 1.62, -6.5], look: [3.1, 1.2, -8.74], fov: 31, ease: 'surge' }] }) },
  s13b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1305, pos: [2.2, 1.8, -5.9], look: [3.22, 1.3, -8.76], fov: 36 },
    { f: 1358, pos: [5.3, 1.95, -5.0], look: [3.4, 1.32, -8.82], fov: 37, ease: 'surge' }] }) },
  s14a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1359, pos: [1.6, 1.75, -6.0], look: [4.1, 1.3, -9.3], fov: 35 },
    { f: 1410, pos: [3.8, 1.7, -6.9], look: [6.0, 1.2, -10.4], fov: 32, ease: 'surge' }] }) },
  // DOLLY ZOOM B (the twist — the lock): dolly OUT while zooming IN
  // 46→20 — the safe holds its size, the lobby compresses behind it.
  s14b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1411, pos: [3.6, 1.6, -6.9], look: [6.05, 1.18, -10.55], fov: 46 },
    { f: 1467, pos: [2.3, 1.75, -3.6], look: [6.1, 1.2, -10.6], fov: 20, ease: 'smooth' }] }) },
  s15a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1468, pos: [3.2, 1.75, -5.7], look: [5.95, 1.0, -10.45], fov: 34 },
    { f: 1510, pos: [2.95, 1.65, -6.1], look: [6.0, 0.98, -10.5], fov: 30, ease: 'surge' }] }) },
  s15b: { cut: 'hard', raw: pushInCam({ subject: managerPos, a: 1511, b: 1563, d0: 2.9, d1: 2.3, h0: 1.62, h1: 1.56, lookOff: [0, 1.48, 0], fov0: 33, fov1: 29,
    dir: () => [-0.55, 0.83] }) },
  s16a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1564, pos: [2.4, 1.85, -6.2], look: [5.3, 1.3, -9.5], fov: 37 },
    { f: 1588, pos: [1.5, 1.78, -4.4], look: [3.6, 1.3, -7.5], fov: 36, ease: 'smooth' },
    { f: 1612, pos: [1.1, 1.78, -2.2], look: [2.35, 1.3, -5.95], fov: 35, ease: 'surge' }] }) },
  s16b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1613, pos: [1.3, 1.75, 0.6], look: [0.1, 1.32, -3.0], fov: 36 },
    { f: 1671, pos: [0.7, 1.65, -0.1], look: [0, 1.32, -3.0], fov: 32, ease: 'surge' }] }) },
  s17: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1672, pos: [0.5, 2.0, 9.4], look: [0.7, 1.05, 0.4], fov: 45 },
    { f: 1799, pos: [0.9, 2.1, 11.4], look: [0.85, 1.0, 0.2], fov: 42, ease: 'surge' }] }) },
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
  let cinf = 2.4;
  if (['s01a', 's02b', 's09a', 's11a', 's17'].includes(S.id)) cinf = 1.4;
  if (['s01b', 's07b', 's13a', 's15a'].includes(S.id)) cinf = 3.6;
  if (['s05', 's14b'].includes(S.id)) cinf = 2.6;
  if (S.id === 's08b') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- dynamic world state (diamonds, safe, clock, cart, box) ----------
export const dynAt = (f) => {
  const S = shotAt(f), id = S.id;
  // the great clock: day 8:40 (its minute hand sweeps ten minutes during
  // the guard's round), gala 9:00 sharp (the chime), dawn 6:05.
  let clockH, clockM;
  if (f < 803) { clockH = 4.537; clockM = 4.189 + 0.52 * ramp(f, 486, 582); }
  else if (f < 1132) { clockH = 4.712; clockM = 0; }
  else if (f < 1359) { const u = ramp(f, 1132, 1160); clockH = lerp(4.66, 4.712, u); clockM = lerp(5.76, 6.283, u); }
  else if (f < 1468) { clockH = 4.73; clockM = 0.21; }
  else { clockH = 3.185; clockM = 0.524; }
  // the safe door: demonstrated in the plan (s09b), opened for the box
  // (s14a), LOCKED on the dolly zoom (s14b), reopened at dawn (s15a).
  let safeOpen = 0;
  if (id === 's09b') safeOpen = 0.55 * (1 - ramp(f, 890, 915));
  else if (id === 's14a') safeOpen = ramp(f, 1382, 1396);
  else if (id === 's14b') safeOpen = 1 - ramp(f, 1415, 1435);
  else if (f >= 1468) safeOpen = ramp(f, 1472, 1490);
  const dialSpin = 4 * Math.PI * ramp(f, 880, 905) + 4 * Math.PI * ramp(f, 1436, 1458) - 3 * Math.PI * ramp(f, 1468, 1482);
  const hubSpin = 2 * Math.PI * ramp(f, 1446, 1460);
  // the porter's cart: day station by the column, gala station behind
  // the case, back at the column by morning, beside him at the end.
  let cart;
  if (f < 803) cart = { x: 4.95, z: -0.05, ry: -0.45 };
  else if (f < 1564) cart = { x: 2.6, z: -9.3, ry: 0.25 };
  else if (f < 1672) cart = { x: 4.95, z: -0.05, ry: -0.45 };
  else cart = { x: -1.95, z: 1.05, ry: 0.4 };
  // the glass copy: on the cart (polishing), raised to the light, then
  // in the porter's palm from the step-out until the breath of the swap.
  let diaCopy = null;
  if (id === 's07a' || id === 's07b') diaCopy = { x: 4.87, y: 0.97, z: 0.02, ry: f * 0.01 };
  else if (id === 's08a') diaCopy = { x: 4.32, y: 1.66, z: -0.62, ry: 0.4 };
  else if (f >= 1229 && f < 1332) diaCopy = { x: 2.98, y: 1.03, z: -8.72, ry: 0.3 };
  // the velvet carry box: in the manager's hands for the whole walk,
  // between the pair at the swap, into the safe at the lock.
  let carry = null;
  if (f >= 1043 && f < 1400) {
    const m = managerAt(f);
    if (f < 1201 || (f >= 1348 && f < 1390)) {
      const bob = Math.abs(Math.sin(managerPhase(f) * Math.PI * 2)) * 0.03;
      carry = { x: m.x + 0.34, y: 1.03 + bob, z: m.z - 0.11, ry: 1.88 };
    } else if (f >= 1390) carry = { x: 5.62, y: 1.0, z: -9.9, ry: 0.2 };
    else carry = { x: 3.16, y: 1.03, z: -8.76, ry: 0.4 };
  }
  const glintK = (id === 's01b' || id === 's08b') ? 1.0 : id === 's16b' ? 1.3 : id === 's13a' ? 0.5 : 0.75;
  return {
    diaCase: 1, diaCopy, diaSafe: f >= 1476 ? 1 : 0,
    safeOpen, dialSpin, hubSpin, clockH, clockM, cart, carry, glintK,
  };
};
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    boardK: S.id === 's17' ? smooth(ramp(f, 1706, 1728)) : 0,
    ...dynAt(f),
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: 0, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
const TINT = { day: '#ffffff' };
export const OUTFITS = {
  porter: { jacket: '#2e4a6e', pants: '#2c2c34', boots: '#1c1712', hat: 'cap', cap: '#22384f', shirtFront: '#dfe6ee', skin: '#fbf7ef' },
  manager: { jacket: '#4a2e2e', pants: '#241d18', boots: '#17120e', hat: 'hair', hair: '#4a3626', shirtFront: '#f3ead8', skin: '#fbf7ef', moustache: '#33241a', bigMoustache: true },
  guard: { jacket: '#2e4a34', pants: '#22301f', boots: '#141a12', hat: 'cap', cap: '#22301f', skin: '#fbf7ef', moustache: '#241a12' },
  guestA: { jacket: '#1f7a6a', pants: '#3a3a42', boots: '#241a12', hat: 'cap', cap: '#f2c230', skin: '#fbf7ef' },
  guestB: { jacket: '#4a5d8a', pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#33241a', skin: '#fbf7ef' },
  guestC: { jacket: '#8a6d1f', pants: '#3c3a40', boots: '#1c1712', hat: 'cap', cap: '#5d8a3a', skin: '#fbf7ef', moustache: '#2a201a' },
};

// ---------- HEAD PERFORMANCE (same track folder as the template) ----------
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
const emoPorter = emoTrack('neutral', [
  [324, 'smile', 10], [418, 'determined', 8], [583, 'determined', 8], [696, 'wonder', 8],
  [803, 'smile_closed', 8], [1181, 'determined', 6], [1305, 'smile_closed', 8], [1672, 'grin', 10],
]);
const emoManager = emoTrack('proud', [
  [175, 'smug', 8], [275, 'angry', 8], [324, 'stern', 8], [803, 'smug', 8], [932, 'smug', 6],
  [1043, 'proud', 6], [1181, 'confused', 6], [1259, 'smug', 6], [1359, 'smug', 6],
  [1468, 'nervous', 6], [1511, 'shock', 6], [1564, 'scared', 6], [1613, 'shock', 6], [1672, 'pained', 10],
]);
const emoGuard = emoTrack('neutral', [
  [486, 'stern', 8], [1672, 'smile_closed', 10],
]);
const emoGuestA = emoTrack('smile', [[1132, 'wonder', 8], [1672, 'smile', 8]]);
const emoGuestB = emoTrack('smile', [[1132, 'wonder', 8], [1672, 'smile', 8]]);
const emoGuestC = emoTrack('grin', [[1132, 'wonder', 8], [1672, 'smile', 8]]);
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
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const p = porterAt(f), m = managerAt(f), g = guardAt(f);
  const aA = guestAAt(f), aB = guestBAt(f), aC = guestCAt(f);
  const PP = emoPorter.at(f), MP = emoManager.at(f), GP = emoGuard.at(f);
  const AP = emoGuestA.at(f), BP = emoGuestB.at(f), CP = emoGuestC.at(f);
  PP.blush = 0; MP.blush = 0; GP.blush = 0; AP.blush = 0; BP.blush = 0; CP.blush = 0;
  const porterPolish = (seed = 31) => std('porter', OUTFITS.porter, { expr: 'neutral', exprP: PP, mode: 'stand', blink: blinkAt(f, seed), seed, prop: ['point', 0.42],
    ...head(f, seed, 1.5, 0.15, 0.42, 0.15) }, p.x, p.z, { yaw: 0.15 });
  const guestsAtRope = () => {
    std('guestA', OUTFITS.guestA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
      ...head(f, 41, -1, 0.3, 0.3, 0.3) }, aA.x, aA.z, { yaw: 0.3 });
    std('guestB', OUTFITS.guestB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
      ...head(f, 61, -1, -0.3, 0.3, -0.3) }, aB.x, aB.z, { yaw: -0.3 });
    std('guestC', OUTFITS.guestC, { expr: 'grin', exprP: CP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
      ...head(f, 81, -0.5, 0.1, 0.35, 0.1) }, aC.x, aC.z, { yaw: 0.1 });
  };
  const guestsGala = () => {
    const up = ramp(f, 1150, 1175);
    const ly = lerp(0.28, -0.52, up);
    std('guestA', OUTFITS.guestA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
      ...head(f, 41, -1, 0.3, ly, 0.3) }, aA.x, aA.z, { yaw: 0.3 });
    std('guestB', OUTFITS.guestB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
      ...head(f, 61, -1, -0.3, ly, -0.3) }, aB.x, aB.z, { yaw: -0.3 });
    std('guestC', OUTFITS.guestC, { expr: 'grin', exprP: CP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
      ...head(f, 81, -0.5, 0.1, ly, 0.1) }, aC.x, aC.z, { yaw: 0.1 });
  };
  switch (S.id) {
    case 's01a': {
      porterPolish();
      std('guestA', OUTFITS.guestA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.3, 0.3, 0.3) }, aA.x, aA.z, { yaw: 0.3 });
      std('guestB', OUTFITS.guestB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, -0.3, 0.3, -0.3) }, -2.7, -1.5, { yaw: -0.3 });
      break;
    }
    case 's01b': case 's08b': break; // the diamond alone, macro
    case 's02a': case 's02b': {
      guestsAtRope();
      std('guard', OUTFITS.guard, { expr: 'stern', exprP: GP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, 0.35, 0.1, 0.35) }, g.x, g.z, { yaw: 0.3 });
      porterPolish();
      break;
    }
    case 's03a': case 's03b': case 's03c': {
      // the manager's MOCK — performed dialogue (speak track, L3)
      const SM = spk(MP, f);
      std('manager', OUTFITS.manager, { expr: S.id === 's03c' ? 'angry' : 'smug', exprP: SM.exprP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.72],
        ...head(f, 51, -2.5 + SM.nod, 0.3, 0.05, 0.3) }, m.x, m.z, { yaw: 0.3 });
      std('porter', OUTFITS.porter, { expr: 'nervous', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1.5, -0.4, 0.2, -0.4) }, p.x, p.z, { yaw: -0.4 });
      break;
    }
    case 's04a': {
      std('porter', OUTFITS.porter, { expr: 'smile', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1.5, 0.3, -0.1, 0.3) }, p.x, p.z, { yaw: 0.3 });
      std('manager', OUTFITS.manager, { expr: 'stern', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, 1, -0.35, 0.15, -0.35) }, m.x, m.z, { yaw: -0.35 });
      break;
    }
    case 's04b': {
      std('porter', OUTFITS.porter, { expr: 'smile', exprP: PP, ...mv(p), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, 0.25, 0.05, 0.25) }, p.x, p.z, { yaw: 0.25 });
      break;
    }
    case 's05': {
      std('porter', OUTFITS.porter, { expr: 'determined', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, -2, 0.1, -0.55, 0.1) }, p.x, p.z, { yaw: 0.1 });
      break;
    }
    case 's06a': {
      std('guard', OUTFITS.guard, { expr: 'stern', exprP: GP, ...mv(g), blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, 0.3, 0.05, 0.3) }, g.x, g.z, { yaw: 0.55 });
      break;
    }
    case 's06b': {
      std('guard', OUTFITS.guard, { expr: 'stern', exprP: GP, ...mv(g), blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, 0.3, 0.05, 0.3) }, g.x, g.z, { yaw: 0.55 });
      std('porter', OUTFITS.porter, { expr: 'determined', exprP: PP, ...mv(p), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, -0.45, 0.1, -0.45) }, p.x, p.z, { yaw: -0.45 });
      break;
    }
    case 's07a': {
      std('porter', OUTFITS.porter, { expr: 'determined', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.45],
        ...head(f, 31, 2, 0.1, 0.5, 0.1) }, p.x, p.z, { yaw: 0.1 });
      break;
    }
    case 's07b': {
      std('porter', OUTFITS.porter, { expr: 'determined', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.62],
        ...head(f, 31, 2.5, 0.05, 0.55, 0.05) }, p.x, p.z, { yaw: 0.05 });
      break;
    }
    case 's08a': {
      std('porter', OUTFITS.porter, { expr: 'wonder', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.92],
        ...head(f, 31, -2, 0.05, -0.42, 0.05) }, p.x, p.z, { yaw: 0.05 });
      break;
    }
    case 's09a': {
      guestsGala();
      std('manager', OUTFITS.manager, { expr: 'smug', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.25, 0.05, 0.25) }, m.x, m.z, { yaw: 0.25 });
      std('guard', OUTFITS.guard, { expr: 'stern', exprP: GP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, -0.3, 0.1, -0.3) }, g.x, g.z, { yaw: -0.3 });
      porterPolish();
      break;
    }
    case 's09b': {
      std('manager', OUTFITS.manager, { expr: 'smug', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.55],
        ...head(f, 51, -1, 0.3, 0.3, 0.3) }, m.x, m.z, { yaw: 0.3 });
      break;
    }
    case 's10a': {
      std('manager', OUTFITS.manager, { expr: 'smug', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['coin', 0.5],
        ...head(f, 51, -2, 0.2, 0.25, 0.2) }, m.x, m.z, { yaw: 0.2 });
      break;
    }
    case 's10b': {
      std('manager', OUTFITS.manager, { expr: 'smug', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, -0.25, 0.1, -0.25) }, m.x, m.z, { yaw: -0.25 });
      break;
    }
    case 's11a': {
      guestsGala();
      std('manager', OUTFITS.manager, { expr: 'proud', exprP: MP, ...mv(m), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.15, 0.05, 0.15) }, m.x, m.z, { yaw: 0.35 });
      std('guard', OUTFITS.guard, { expr: 'stern', exprP: GP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, -0.3, 0.1, -0.3) }, 1.95, -4.55, { yaw: -0.3 });
      porterPolish();
      break;
    }
    case 's11b': {
      std('manager', OUTFITS.manager, { expr: 'proud', exprP: MP, ...mv(m), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.15, 0.05, 0.15) }, m.x, m.z, { yaw: 0.35 });
      std('guestB', OUTFITS.guestB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, -0.3, 0.28, -0.3) }, aB.x, aB.z, { yaw: -0.3 });
      porterPolish();
      break;
    }
    case 's12a': {
      guestsGala();
      const upM = lerp(0.05, -0.55, ramp(f, 1150, 1175));
      std('manager', OUTFITS.manager, { expr: 'proud', exprP: MP, ...mv(m), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.15, upM, 0.15) }, m.x, m.z, { yaw: 0.35 });
      porterPolish();
      break;
    }
    case 's12b': {
      std('guestA', OUTFITS.guestA, { expr: 'wonder', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.3, -0.5, 0.3) }, aA.x, aA.z, { yaw: 0.3 });
      std('guestB', OUTFITS.guestB, { expr: 'wonder', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, -0.3, -0.5, -0.3) }, aB.x, aB.z, { yaw: -0.3 });
      std('manager', OUTFITS.manager, { expr: 'confused', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, -0.4, -0.3, -0.4) }, m.x, m.z, { yaw: -0.3 });
      std('porter', OUTFITS.porter, { expr: 'determined', exprP: PP, ...mv(p), blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.4],
        ...head(f, 31, -1, 0.4, 0.05, 0.4) }, p.x, p.z, { yaw: 0.4 });
      break;
    }
    case 's13a': case 's13b': {
      std('porter', OUTFITS.porter, { expr: 'determined', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.5],
        ...head(f, 31, 1.5, 0.45, 0.4, 0.45) }, p.x, p.z, { yaw: 0.45 });
      std('manager', OUTFITS.manager, { expr: 'smug', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.42],
        ...head(f, 51, 1.5, -0.45, 0.4, -0.45) }, m.x, m.z, { yaw: -0.45 });
      break;
    }
    case 's14a': {
      std('manager', OUTFITS.manager, { expr: 'smug', exprP: MP, ...mv(m), blink: blinkAt(f, 51), seed: 51, prop: f >= 1370 ? ['key', 0.55] : null,
        ...head(f, 51, -1.5, 0.2, 0.1, 0.2) }, m.x, m.z, { yaw: 0.3 });
      porterPolish();
      break;
    }
    case 's14b': {
      std('manager', OUTFITS.manager, { expr: 'smug', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.55],
        ...head(f, 51, 1, 0.3, 0.35, 0.3) }, m.x, m.z, { yaw: 0.3 });
      porterPolish();
      break;
    }
    case 's15a': {
      std('manager', OUTFITS.manager, { expr: 'nervous', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['key', 0.55],
        ...head(f, 51, 1.5, 0.3, 0.35, 0.3) }, m.x, m.z, { yaw: 0.3 });
      break;
    }
    case 's15b': {
      // the manager READS THE NOTE aloud — performed dialogue (speak track, L15)
      const SM = spk(MP, f);
      std('manager', OUTFITS.manager, { expr: 'shock', exprP: SM.exprP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['letter', 0.5],
        ...head(f, 51, -1 + SM.nod, 0.1, 0.3, 0.1) }, m.x, m.z, { yaw: 0.1 });
      break;
    }
    case 's16a': {
      std('manager', OUTFITS.manager, { expr: 'scared', exprP: MP, ...mv(m), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -2, 0.3, 0.1, 0.3) }, m.x, m.z, { yaw: 0.6 });
      break;
    }
    case 's16b': {
      std('manager', OUTFITS.manager, { expr: 'shock', exprP: MP, ...mv(m), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.35, 0.3, 0.35, m.moving ? 0 : 0.02) }, m.x, m.z, { yaw: 0.35 });
      porterPolish();
      break;
    }
    case 's17': {
      // the payoff wide: NO speech — narration + the hook board only.
      std('porter', OUTFITS.porter, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.35],
        ...head(f, 31, -1.5, 0.25, 0.05, 0.25) }, p.x, p.z, { yaw: 0.25 });
      std('manager', OUTFITS.manager, { expr: 'pained', exprP: MP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, 4.5, -0.2, 0.5, -0.2, 0.03) }, m.x, m.z, { yaw: -0.2 });
      std('guard', OUTFITS.guard, { expr: 'smile_closed', exprP: GP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1.5, -0.25, 0.05, -0.25) }, g.x, g.z, { yaw: -0.25 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.circle(CASE.x, CASE.z, 1.0, { h: 2.0, id: 'case' }),
  ...[[-6.2, -0.5], [6.2, -0.5], [-6.2, -8.6], [6.2, -8.6]].map(([x, z]) => SOL.circle(x, z, 0.55, { h: 6.5, id: 'column' })),
  SOL.aabb(-7.9, -3.3, -10.3, -9.5, { h: 1.2, id: 'desk' }),
  SOL.aabb(5.25, 6.95, -11.2, -10.0, { h: 2.3, id: 'safe' }),
  SOL.circle(3.9, -5.6, 0.62, { h: 0.8, id: 'table' }),
  SOL.circle(-3.7, 2.9, 0.62, { h: 0.8, id: 'table2' }),
  SOL.circle(6.4, 3.2, 1.15, { h: 0.9, id: 'sofa' }),
  SOL.aabb(-12.4, -10.3, -11.2, -4.2, { h: 3.2, id: 'stairs' }),
  ...[[-1.35, -1.65], [1.35, -1.65], [-1.35, -4.35], [1.35, -4.35]].map(([x, z]) => SOL.circle(x, z, 0.06, { h: 0.95, id: 'ropepost' })),
  SOL.circle(BOARD_POS[0], BOARD_POS[2], 0.32, { h: 1.2, id: 'boardstand' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  // during the swap the two men work as one unit (hands together over
  // the box) — a shared group, the solid.js rider rule.
  const swapPair = f >= 1206 && f <= 1358;
  for (const a of castAt(f)) {
    const o = { kind: 'dynamic', id: a.id };
    if (swapPair && (a.id === 'porter' || a.id === 'manager')) o.group = 'swap';
    out.push(SOL.circle(a.x, a.z, a.r, o));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
