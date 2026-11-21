// Shot plan for "The Cook Who Seasoned a Feast for a Hundred Guests
// with One Chili" — built on the approved Salted Mine 60 / Paid-for-
// Smell / Diamond Heist template (same painter/cast family, N1 voice).
// A royal feast for a hundred guests; the proud head cook mocks his
// poor young assistant; the spice merchant never comes — the chest
// holds ONE dried chili. The boy's plan is SHOWN in three steps:
// (1) fry the chili in a spoon of ghee till the oil turns red and
// fierce; (2) one drop of that oil on every dish as it leaves the
// kitchen — a hundred dishes, one chili; (3) the drop goes in LAST,
// so the heat blooms on the tongue, not in the pot. The guests roar,
// the king demands the name, and the mocker must admit the "nobody"
// seasoned the whole feast. ONE set (royal kitchen + feast courtyard),
// DAYLIGHT throughout.
// CHARACTER FIX (Abid, 2026-11-21 ~18:21 IST — "patla lag raha or
// chapta"): the cast is drawn by the rebuilt toon.js — fuller builds
// (tw .80→.98 adult / .92→1.10 stout / .72→.86 kid), thicker limbs
// (legs 5.8u→7.4u, arms 5.2u→6.8u), ballFill heads + cylFill torsos
// replacing the flat fills; skins warmed to #ffe2c2 so the ball
// shading reads. Face SHAPE unchanged (approved Salted Mine bean).
// CAMERA (the raised bar): the camera NEVER sits still — every
// sub-shot travels; TWO true dolly zooms — s06b (the plan forms:
// dolly-in + zoom-out, the kitchen stretches behind the boy) and
// s15b (the admission: dolly-out + zoom-in, the king and dais
// compress in behind the cook as he names the boy).
// Exactly 60.000 s / 1800 frames @30 fps. Shots cut ONLY on voice
// lines and word onsets (stem = voice_final.wav, timing.json):
//   L1 0-90 · L2 94-199 · L3 202-293 (HEAD COOK dialogue, performed) ·
//   L4 297-438 · L5 442-518 · L6 521-627 · L7 630-743 · L8 747-854 ·
//   L9 858-953 · L10 957-1067 · L11 1070-1173 · L12 1177-1288 ·
//   L13 1292-1390 · L14 1394-1456 · L15 1460-1570 (HEAD COOK dialogue,
//   performed) · L16 1574-1654 · L17 1658-1798 (narration + board).
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
  { id: 's01b', a: 45, b: 93, light: 'day' },
  { id: 's02', a: 94, b: 201, light: 'day' },
  { id: 's03a', a: 202, b: 244, light: 'day' },
  { id: 's03b', a: 245, b: 296, light: 'day' },
  { id: 's04a', a: 297, b: 380, light: 'day' },
  { id: 's04b', a: 381, b: 413, light: 'day' },
  { id: 's04c', a: 414, b: 441, light: 'day' },
  { id: 's05a', a: 442, b: 484, light: 'day' },
  { id: 's05b', a: 485, b: 520, light: 'day' },
  { id: 's06a', a: 521, b: 572, light: 'day' },
  { id: 's06b', a: 573, b: 629, light: 'day' },
  { id: 's07a', a: 630, b: 692, light: 'day' },
  { id: 's07b', a: 693, b: 746, light: 'day' },
  { id: 's08a', a: 747, b: 806, light: 'day' },
  { id: 's08b', a: 807, b: 857, light: 'day' },
  { id: 's09', a: 858, b: 956, light: 'day' },
  { id: 's10a', a: 957, b: 1014, light: 'day' },
  { id: 's10b', a: 1015, b: 1069, light: 'day' },
  { id: 's11a', a: 1070, b: 1122, light: 'day' },
  { id: 's11b', a: 1123, b: 1176, light: 'day' },
  { id: 's12a', a: 1177, b: 1236, light: 'day' },
  { id: 's12b', a: 1237, b: 1291, light: 'day' },
  { id: 's13a', a: 1292, b: 1346, light: 'day' },
  { id: 's13b', a: 1347, b: 1393, light: 'day' },
  { id: 's14', a: 1394, b: 1459, light: 'day' },
  { id: 's15a', a: 1460, b: 1518, light: 'day' },
  { id: 's15b', a: 1519, b: 1573, light: 'day' },
  { id: 's16a', a: 1574, b: 1614, light: 'day' },
  { id: 's16b', a: 1615, b: 1657, light: 'day' },
  { id: 's17', a: 1658, b: 1799, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights: ONE vivid daylight grade ----------
export const LIGHTS = {
  day: { az: 218, el: 46, sky: '#ffe9bb', ground: '#8a6f4a', hemi: 1.05, sun: '#ffdca3', sunI: 2.55, fog: '#eed9ae', fogNear: 46, fogFar: 340,
    skyTop: '#3f6fb4', skyHor: '#f6d491', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.12, vig: 0.24, shadowExt: 26, aurora: 0, gain: '#fff0cd', waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const BOARD_POS = [2.2, 0.98, 4.0];
export const BOARD_RY = 0.6;
const PASS = { x: 2.3, z: -5.5 };       // the serving pass: the boy's station
const CHEST = { x: 5.4, z: -7.4 };      // the spice chest
const DAIS = { x: 0, z: 7.3, top: 0.35 };// the king's dais (south head)
const TABLES = [-4.6, -1.6, 1.4, 4.4];  // feast table centre x (z -3.4..2.4)

// walk helper: ONE M.walk call drives BOTH the position along a segment
// and the bodyFront march phase — feet can never slide.
const walkAlong = (f, f0, from, to, speed, stride) => {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const wk = walk(f, f0, speed, stride);
  const d = Math.min(wk.dist, len);
  const u = len ? d / len : 0;
  return { x: from[0] + dx * u, z: from[1] + dz * u, phase: wk.phase, moving: f >= f0 && wk.dist < len };
};

// ---------- actor anchors (single source; checked against STATICS) ----------
export const boyAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's03a': case 's03b': return { x: -2.1, z: -6.8 };
    case 's04a': { const w = walkAlong(f, 300, [-2.1, -6.8], [3.8, -7.35], 2.6, 0.8); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's04b': case 's04c': case 's05a': case 's05b': return { x: 3.8, z: -7.35 };
    case 's08a': case 's08b': case 's10a': case 's10b': return { x: 2.75, z: -5.45 };
    case 's16a': { const w = walkAlong(f, 1574, [2.3, -5.5], [5.6, -4.7], 3.1, 0.9); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's16b': { const w = walkAlong(f, 1615, [1.35, 3.85], [0.95, 5.35], 1.6, 0.75); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's17': return { x: 3.35, z: 3.45 }; // at the board's east corner, clear of its text
    default: return { x: PASS.x, z: PASS.z };
  }
};
export const cookAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's04a': {
      // the cook storms AROUND the pass (courtyard side) while the boy
      // takes the kitchen lane — three legs, no shared ground
      if (f < 330) { const w = walkAlong(f, 297, [-3.9, -7.35], [0.2, -5.7], 4.0, 0.95); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      if (f < 364) { const w = walkAlong(f, 330, [0.2, -5.7], [4.3, -5.6], 3.6, 0.95); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      const w = walkAlong(f, 364, [4.3, -5.6], [4.6, -7.1], 3.0, 0.85); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving };
    }
    case 's04b': case 's04c': case 's05a': case 's05b': return { x: 4.6, z: -7.1 };
    case 's13b': case 's14': { const w = walkAlong(f, 1352, [-0.2, -6.4], [0, 5.0], 2.05, 0.8); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's15a': case 's15b': return { x: 0, z: 5.0 };
    case 's16a': case 's16b': return { x: 1.95, z: 4.95 };
    case 's17': return { x: 5.8, z: 6.9 }; // slunk to the side, out of frame
    default: return { x: -3.9, z: -7.35 };
  }
};
export const kingAt = () => ({ x: DAIS.x, z: DAIS.z });
export const servantAAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's08a': { const w = walkAlong(f, 747, [5.6, -4.3], [3.5, -5.0], 1.9, 0.78); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's08b': { const w = walkAlong(f, 842, [3.5, -5.0], [5.7, -4.2], 2.2, 0.8); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's09': return { x: 3.22, z: 1.7 };
    case 's11a': { const w = walkAlong(f, 1070, [5.85, -4.6], [5.85, 2.6], 3.3, 1.0); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's17': return { x: 5.9, z: 5.6 }; // east edge, clear of the boy + the board's sightline
    default: return { x: 0.7, z: -6.7 };
  }
};
export const servantBAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's09': return { x: -3.42, z: 1.5 };
    case 's10a': case 's10b': { const w = walkAlong(f, 957, [-1.6, -4.7], [4.2, -4.7], 1.85, 0.78); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's11b': { const w = walkAlong(f, 1123, [-5.85, -4.4], [-5.85, 2.4], 3.3, 1.0); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's17': return { x: -3.3, z: 3.5 };
    default: return { x: -1.4, z: -6.9 };
  }
};
export const guestAAt = () => ({ x: -2.75, z: 2.2 });
export const guestBAt = () => ({ x: -0.45, z: 2.2 });
export const guestCAt = () => ({ x: 0.25, z: 2.2 });
export const guestDAt = () => ({ x: 2.55, z: 2.2 });

// ---------- hero / focus ----------
const FOCUS = {
  s01a: () => [0, 1.2, -4],
  s01b: () => [PASS.x, 1.15, PASS.z],
  s02: () => [0, 0.8, -0.5],
  s03a: () => [-3.9, 1.45, -7.35],
  s03b: () => [-3.0, 1.4, -7.0],
  s04a: () => [2.2, 1.2, -6.8],
  s04b: () => [CHEST.x, 1.05, CHEST.z],
  s04c: () => [CHEST.x, 1.0, CHEST.z],
  s05a: () => [4.6, 1.45, -7.1],
  s05b: () => [3.8, 1.3, -7.35],
  s06a: () => [PASS.x, 1.35, PASS.z],
  s06b: () => [PASS.x, 1.35, PASS.z],
  s07a: () => [2.42, 1.0, -6.15],
  s07b: () => [PASS.x, 1.3, PASS.z],
  s08a: () => [3.9, 1.1, -4.8],
  s08b: () => [3.5, 1.05, -4.85],
  s09: () => [0, 0.8, -0.5],
  s10a: () => [2.75, 1.1, -5.45],
  s10b: () => [2.8, 1.02, -4.9],
  s11a: () => { const s = servantAAt(1096); return [s.x, 1.3, s.z]; },
  s11b: () => { const s = servantBAt(1150); return [s.x, 1.3, s.z]; },
  s12a: () => [-1.6, 1.1, 2.2],
  s12b: () => [1.4, 1.35, 2.2],
  s13a: () => [DAIS.x, 1.6, DAIS.z],
  s13b: () => [DAIS.x, 1.55, DAIS.z],
  s14: () => { const c = cookAt(1426); return [c.x, 1.35, c.z]; },
  s15a: () => [0, 1.45, 5.0],
  s15b: () => [0, 1.45, 5.0],
  s16a: () => { const b = boyAt(1594); return [b.x, 1.3, b.z]; },
  s16b: () => [0.95, 1.35, 5.35],
  s17: () => [0, 1.1, 4.2],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras (the raised bar: EVERY sub-shot travels) ----------
// Kitchen line at z≈-8 (north), pass counter z≈-6.4, feast tables
// z -3.4..2.4, king's dais at the south head (z 7.3). Cameras work
// from the courtyard (south, +z) looking north, except the dais
// beats, which look south at the king.
const boyPos = (f) => { const a = boyAt(f); return [a.x, 0, a.z]; };
const cookPos = (f) => { const a = cookAt(f); return [a.x, 0, a.z]; };
const RIG_BY_ID = {
  s01a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [-6.5, 5.4, 6.8], look: [0, 1.1, -4], fov: 42 },
    { f: 44, pos: [-3.4, 2.5, 1.6], look: [0.6, 1.15, -4.8], fov: 37, ease: 'surge' }] }) },
  s01b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 45, pos: [5.3, 1.85, -1.4], look: [2.35, 1.12, -5.5], fov: 36 },
    { f: 93, pos: [4.3, 1.7, -2.9], look: [2.35, 1.1, -5.5], fov: 32, ease: 'surge' }] }) },
  s02: { cut: 'hard', raw: keysCam({ keys: [
    { f: 94, pos: [-6.9, 5.2, 7.5], look: [-1.6, 0.7, -2.2], fov: 40 },
    { f: 201, pos: [6.9, 5.2, 7.5], look: [1.6, 0.7, -2.2], fov: 40, ease: 'smooth' }] }) },
  s03a: { cut: 'hard', raw: pushInCam({ subject: cookPos, a: 202, b: 244, d0: 3.4, d1: 2.7, h0: 1.62, h1: 1.58, lookOff: [0, 1.48, 0], fov0: 35, fov1: 31, dir: [0.35, 0.94] }) },
  s03b: { cut: 'hard', raw: pushInCam({ subject: cookPos, a: 245, b: 296, d0: 2.6, d1: 2.05, h0: 1.6, h1: 1.56, lookOff: [0, 1.46, 0], fov0: 31, fov1: 28, dir: [0.55, 0.83] }) },
  s04a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 297, pos: [0.5, 2.1, -2.0], look: [-2.85, 1.3, -7.05], fov: 40 },
    { f: 338, pos: [3.2, 2.02, -2.5], look: [1.4, 1.25, -6.8], fov: 38, ease: 'smooth' },
    { f: 380, pos: [6.8, 2.05, -2.9], look: [4.7, 1.2, -7.0], fov: 37, ease: 'surge' }] }) },
  s04b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 381, pos: [7.35, 1.62, -4.5], look: [5.4, 1.02, -7.4], fov: 33 },
    { f: 413, pos: [6.85, 1.5, -5.2], look: [5.4, 1.0, -7.4], fov: 29, ease: 'surge' }] }) },
  s04c: { cut: 'hard', raw: keysCam({ keys: [
    { f: 414, pos: [6.9, 1.44, -5.6], look: [5.4, 0.98, -7.4], fov: 31 },
    { f: 441, pos: [6.5, 1.37, -5.85], look: [5.4, 0.98, -7.4], fov: 29, ease: 'surge' }] }) },
  s05a: { cut: 'hard', raw: pushInCam({ subject: cookPos, a: 442, b: 484, d0: 3.0, d1: 2.4, h0: 1.62, h1: 1.58, lookOff: [0, 1.46, 0], fov0: 34, fov1: 30, dir: [-0.5, 0.86] }) },
  s05b: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 485, b: 520, d0: 2.8, d1: 2.3, h0: 1.5, h1: 1.46, lookOff: [0, 1.32, 0], fov0: 33, fov1: 30, dir: [-0.62, 0.78] }) },
  s06a: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 521, b: 572, d0: 3.2, d1: 2.6, h0: 1.56, h1: 1.52, lookOff: [0, 1.36, 0], fov0: 34, fov1: 31, dir: [0.5, 0.86] }) },
  // DOLLY ZOOM A — the plan forms: dolly IN 3.1 units while the lens
  // opens 30→57; the boy holds his size, the kitchen stretches away.
  s06b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 573, pos: [2.3, 1.6, 0.6], look: [2.3, 1.33, -5.5], fov: 30 },
    { f: 629, pos: [2.3, 1.76, -2.5], look: [2.3, 1.33, -5.5], fov: 57, ease: 'smooth' }] }) },
  s07a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 630, pos: [4.0, 1.66, -3.7], look: [2.42, 1.05, -6.15], fov: 33 },
    { f: 692, pos: [3.5, 1.55, -4.1], look: [2.42, 1.05, -6.15], fov: 30, ease: 'surge' }] }) },
  s07b: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 693, b: 746, d0: 3.0, d1: 2.5, h0: 1.52, h1: 1.48, lookOff: [0, 1.3, 0], fov0: 33, fov1: 30, dir: [0.62, 0.78] }) },
  s08a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 747, pos: [6.4, 1.85, -1.25], look: [5.45, 1.1, -4.5], fov: 37 },
    { f: 806, pos: [5.4, 1.75, -1.75], look: [3.85, 1.08, -4.9], fov: 34, ease: 'surge' }] }) },
  s08b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 807, pos: [5.9, 1.75, -1.4], look: [3.2, 1.05, -4.9], fov: 38 },
    { f: 857, pos: [6.2, 1.8, -1.1], look: [3.9, 1.08, -4.75], fov: 35, ease: 'surge' }] }) },
  s09: { cut: 'hard', raw: keysCam({ keys: [
    { f: 858, pos: [6.7, 5.4, 7.2], look: [1.2, 0.6, -1.8], fov: 40 },
    { f: 956, pos: [-6.5, 5.8, 6.4], look: [-1.2, 0.6, -1.8], fov: 38, ease: 'smooth' }] }) },
  s10a: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 957, b: 1014, d0: 3.5, d1: 3.05, h0: 1.52, h1: 1.48, lookOff: [0, 1.28, 0], fov0: 33, fov1: 30, dir: [0.45, 0.89] }) },
  s10b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1015, pos: [3.95, 1.5, -3.95], look: [2.8, 1.02, -4.9], fov: 30 },
    { f: 1069, pos: [3.62, 1.45, -4.32], look: [2.8, 1.02, -4.9], fov: 28, ease: 'surge' }] }) },
  s11a: { cut: 'hard', raw: pushInCam({ subject: (f) => { const s = servantAAt(f); return [s.x, 0, s.z]; }, a: 1070, b: 1122, d0: 3.4, d1: 3.2, h0: 1.85, h1: 1.8, lookOff: [0, 1.3, 0], fov0: 38, fov1: 36, dir: [0.95, 0.31] }) },
  s11b: { cut: 'hard', raw: pushInCam({ subject: (f) => { const s = servantBAt(f); return [s.x, 0, s.z]; }, a: 1123, b: 1176, d0: 3.4, d1: 3.2, h0: 1.85, h1: 1.8, lookOff: [0, 1.3, 0], fov0: 38, fov1: 36, dir: [-0.95, 0.31] }) },
  // s12: single-guest close-ups — the two seated guests are 2.3 m
  // apart, wider than a 9:16 frame at tasting distance; one face per
  // beat reads stronger (taste → wonder, then the roar).
  s12a: { cut: 'hard', raw: pushInCam({ subject: (f) => { const g = guestBAt(); return [g.x, 0, g.z]; }, a: 1177, b: 1236, d0: 2.9, d1: 2.55, h0: 1.52, h1: 1.48, lookOff: [0, 1.32, 0], fov0: 38, fov1: 36, dir: [0.8, 0.6] }) },
  s12b: { cut: 'hard', raw: pushInCam({ subject: (f) => { const g = guestCAt(); return [g.x, 0, g.z]; }, a: 1237, b: 1291, d0: 3.0, d1: 2.65, h0: 1.56, h1: 1.5, lookOff: [0, 1.34, 0], fov0: 39, fov1: 37, dir: [0.8, 0.6] }) },
  s13a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1292, pos: [0.95, 1.92, 3.85], look: [0, 1.62, 7.3], fov: 35 },
    { f: 1346, pos: [0.7, 1.8, 4.6], look: [0, 1.62, 7.3], fov: 31, ease: 'surge' }] }) },
  s13b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1347, pos: [1.65, 1.86, 4.25], look: [0, 1.6, 7.3], fov: 33 },
    { f: 1393, pos: [1.2, 1.78, 4.9], look: [0, 1.6, 7.3], fov: 29, ease: 'surge' }] }) },
  s14: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1394, pos: [-3.4, 1.95, -5.4], look: [0, 1.32, -3.5], fov: 37 },
    { f: 1426, pos: [-3.25, 1.9, -3.2], look: [0, 1.33, -1.3], fov: 35, ease: 'smooth' },
    { f: 1459, pos: [-3.0, 1.85, -1.0], look: [0, 1.35, 0.9], fov: 34, ease: 'surge' }] }) },
  s15a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1460, pos: [0.85, 1.76, 2.15], look: [0, 1.45, 5.0], fov: 34 },
    { f: 1518, pos: [0.62, 1.68, 2.9], look: [0, 1.45, 5.0], fov: 30, ease: 'surge' }] }) },
  // DOLLY ZOOM B — the admission: dolly OUT 3 units while the lens
  // closes 32→17; the cook holds his size and the king on his dais
  // compresses in behind him as he names the boy.
  s15b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1519, pos: [0.5, 1.66, 2.4], look: [0, 1.42, 5.0], fov: 32 },
    { f: 1573, pos: [0.3, 1.85, -0.6], look: [0, 1.42, 5.0], fov: 17, ease: 'smooth' }] }) },
  s16a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1574, pos: [4.3, 1.82, -1.5], look: [2.8, 1.3, -5.3], fov: 36 },
    { f: 1614, pos: [6.2, 1.78, 0.7], look: [5.3, 1.3, -4.8], fov: 33, ease: 'surge' }] }) },
  s16b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1615, pos: [2.75, 1.86, 1.55], look: [1.3, 1.35, 4.3], fov: 34 },
    { f: 1636, pos: [2.45, 1.8, 2.0], look: [0.75, 1.35, 5.3], fov: 32, ease: 'smooth' },
    { f: 1657, pos: [2.15, 1.74, 2.3], look: [0.5, 1.35, 6.2], fov: 30, ease: 'surge' }] }) },
  // s17: the board from the south-east — a southern camera puts the
  // throne squarely on the board axis (proof f1799 v1/v2 both failed
  // the eye-check: wall, then throne). From the SE the dais party is
  // behind the camera and the board + boy fill the frame.
  s17: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1658, pos: [6.3, 2.1, 9.2], look: [2.2, 1.02, 4.0], fov: 48 },
    { f: 1799, pos: [6.55, 2.2, 9.35], look: [2.2, 1.02, 4.0], fov: 46, ease: 'surge' }] }) },
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
  if (['s01a', 's02', 's09', 's17'].includes(S.id)) cinf = 1.3;
  if (['s04c', 's07a', 's10b'].includes(S.id)) cinf = 3.8;
  if (['s06b', 's15b'].includes(S.id)) cinf = 2.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world dynamics ----------
export const dynAt = (f) => {
  const S = shotAt(f);
  // the single drop, twice: onto the held dish (lands on "one drop
  // fell", f822) and onto the passing dish at "last" (f1022)
  let drop = null;
  if (f >= 812 && f <= 842) { const u = ramp(f, 820, 834); drop = { x: 3.5, y: lerp(1.24, 1.07, u * u), z: -4.72, s: f >= 834 ? 0.6 : 1 }; }
  if (f >= 1016 && f <= 1040) { const u = ramp(f, 1020, 1032); drop = { x: 2.8, y: lerp(1.22, 1.07, u * u), z: -4.5, s: f >= 1032 ? 0.6 : 1 }; }
  // dishes served across the hundred settings
  let servedN = 0;
  if (f >= 845) servedN = 1;
  if (f >= 858) servedN = Math.min(100, 1 + Math.floor((f - 858) / 3));
  // the gold chain: the king's hands → the boy's neck
  let chain = null;
  if (f >= 1615) {
    const u = smooth(ramp(f, 1624, 1644));
    chain = { x: lerp(0.35, 0.95, u), y: lerp(1.52, 0.92, u), z: lerp(6.75, 5.24, u), ry: lerp(0.4, 0, u) }; // ends on the KID's chest (0.92), not an adult neck — v2 sat on his face
  }
  // carried trays follow their servants' hands
  const sA = servantAAt(f), sB = servantBAt(f);
  let trayA = null, trayB = null;
  if (['s08a', 's08b', 's11a'].includes(S.id)) trayA = { x: sA.x + 0.05, y: 1.04, z: sA.z + 0.32 };
  if (['s10a', 's10b', 's11b'].includes(S.id)) trayB = { x: sB.x + 0.1, y: 1.04, z: sB.z + 0.35 };
  return {
    chestOpen: f < 381 ? 0 : ramp(f, 388, 406),
    chiliChest: f < 630 ? 1 : 0,
    chiliSpoon: f >= 630 ? 1 : 0,
    oilK: ramp(f, 648, 722),
    drop, servedN, chain, trayA, trayB,
    glintK: S.id === 's07b' || S.id === 's08b' ? 1.0 : 0.7,
  };
};
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    boardK: S.id === 's17' ? smooth(ramp(f, 1692, 1716)) : 0,
    ...dynAt(f),
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: 0, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
const SKIN = '#ffe2c2'; // warmed from the heist's #fbf7ef so ballFill shading reads
export const OUTFITS = {
  boy: { build: 'kid', jacket: '#7a4a26', pants: '#4a3a2c', boots: '#241a12', hat: 'hair', hair: '#2c1c10', shirtFront: '#a9805a', skin: SKIN },
  cook: { build: 'stout', jacket: '#e8e0cc', pants: '#5a4a3a', boots: '#2a2018', hat: 'turban', shirtFront: '#f7f2e2', skin: SKIN, moustache: '#3a2a1a', bigMoustache: true },
  king: { build: 'stout', jacket: '#7c2233', pants: '#3a2a3f', boots: '#1c1410', hat: 'crown', sash: '#e8b93c', skin: SKIN, moustache: '#241a12' },
  servantA: { jacket: '#2e6e5e', pants: '#33413a', boots: '#1c1712', hat: 'cap', cap: '#f2c230', skin: SKIN },
  servantB: { jacket: '#4a5d8a', pants: '#2e3242', boots: '#1c1712', hat: 'hair', hair: '#1c1410', skin: SKIN },
  guestA: { jacket: '#8a6d1f', pants: '#3a3230', boots: '#241a12', hat: 'cap', cap: '#d9c9a3', skin: SKIN },
  guestB: { jacket: '#5d3a6e', pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#33241a', skin: SKIN },
  guestC: { jacket: '#2e5a7a', pants: '#3c3a40', boots: '#1c1712', hat: 'cap', cap: '#7a9a52', skin: SKIN, moustache: '#2a201a' },
  guestD: { jacket: '#7a3a2e', pants: '#3a3230', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: SKIN },
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
const emoCook = emoTrack('proud', [[202, 'smug', 18], [297, 'stern', 15], [442, 'angry', 15], [521, 'stern', 15], [1292, 'smug', 15], [1394, 'nervous', 15], [1574, 'pained', 18]]);
const emoBoy = emoTrack('neutral', [[202, 'sad', 15], [442, 'sad', 15], [485, 'neutral', 12], [521, 'smile', 15], [630, 'determined', 15], [693, 'wonder', 15], [747, 'determined', 12], [957, 'determined', 12], [1177, 'smile', 15], [1460, 'neutral', 12], [1574, 'nervous', 12], [1615, 'grin', 15], [1658, 'smile', 12]]);
const emoKing = emoTrack('proud', [[1292, 'smile', 15], [1347, 'laugh', 15], [1460, 'stern', 12], [1574, 'smile', 12], [1615, 'smile_closed', 15]]);
const emoGuest = emoTrack('smile', [[1210, 'wonder', 12], [1237, 'laugh', 15]]);
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
  const b = boyAt(f), c = cookAt(f), k = kingAt(f);
  const sA = servantAAt(f), sB = servantBAt(f);
  const BP = emoBoy.at(f), CP = emoCook.at(f), KP = emoKing.at(f), GP = emoGuest.at(f);
  BP.blush = 0; CP.blush = 0; KP.blush = 0; GP.blush = 0;
  const boy = (opts = {}, extra = {}) => std('boy', OUTFITS.boy, { expr: 'neutral', exprP: BP, blink: blinkAt(f, 31), seed: 31, ...mv(b), ...opts }, b.x, b.z, extra);
  const cook = (opts = {}, extra = {}) => std('cook', OUTFITS.cook, { expr: 'proud', exprP: CP, blink: blinkAt(f, 51), seed: 51, ...mv(c), ...opts }, c.x, c.z, extra);
  const king = (opts = {}, extra = {}) => std('king', OUTFITS.king, { expr: 'proud', exprP: KP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...opts }, k.x, k.z, { yaw: Math.PI, ground: DAIS.top, y: DAIS.top, ...extra });
  const servantA = (opts = {}, extra = {}) => std('servantA', OUTFITS.servantA, { expr: 'smile', exprP: T.faceP('smile'), blink: blinkAt(f, 41), seed: 41, ...mv(sA), ...opts }, sA.x, sA.z, extra);
  const servantB = (opts = {}, extra = {}) => std('servantB', OUTFITS.servantB, { expr: 'neutral', exprP: T.faceP('neutral'), blink: blinkAt(f, 61), seed: 61, ...mv(sB), ...opts }, sB.x, sB.z, extra);
  const guestsSit = (propFor, tiltFor, only = null) => {
    const defs = [
      ['guestA', OUTFITS.guestA, guestAAt(), 81, -0.3], ['guestB', OUTFITS.guestB, guestBAt(), 91, 0.3],
      ['guestC', OUTFITS.guestC, guestCAt(), 101, -0.3], ['guestD', OUTFITS.guestD, guestDAt(), 111, 0.3]];
    for (const [id, o, at, seed, yaw] of defs) {
      if (only && !only.includes(id)) continue;
      std(id, o, { expr: 'smile', exprP: GP, mode: 'sit', blink: blinkAt(f, seed), seed,
        prop: propFor ? propFor(id) : undefined, ...head(f, seed, tiltFor ? tiltFor(id) : 0, 0, 0.1) }, at.x, at.z, { yaw });
    }
  };
  switch (S.id) {
    case 's01a':
      boy({ prop: ['point', 0.7], ...head(f, 31, 1.0, 0.2, 0.1) });
      cook({ prop: ['spoon', 0.7], ...head(f, 51, -1.5, 0, 0) });
      servantA({ ...head(f, 41, 0.5, 0, 0) });
      servantB({ ...head(f, 61, 0.5, 0, 0) });
      break;
    case 's01b':
      boy({ prop: ['point', 0.65], ...head(f, 31, 1.2, 0.25, 0.25) });
      break;
    case 's02': break; // the hundred covers alone, from the air
    case 's03a': case 's03b': {
      // the head cook's MOCK — performed dialogue (speak track, L3)
      const SM = spk(CP, f);
      cook({ expr: 'smug', exprP: SM.exprP, prop: ['point', 0.8], ...head(f, 51, -2.2 + SM.nod, 0.3, 0.05, 0.3) }, { yaw: 0.3 });
      boy({ expr: 'sad', ...head(f, 31, 1.8, -0.35, 0.2, -0.35) }, { yaw: -0.35 });
      break;
    }
    case 's04a':
      cook({ ...head(f, 51, -1.0, 0.3, 0) }, { yaw: 0.4 });
      boy({ ...head(f, 31, 1.0, 0.3, 0.1) }, { yaw: 0.3 });
      break;
    case 's04b':
      cook({ prop: ['point', 0.8], ...head(f, 51, -1.5, 0.2, 0.15, 0.2) }, { yaw: 0.2 });
      boy({ ...head(f, 31, 1.2, 0.3, 0.2) }, { yaw: 0.25 });
      break;
    case 's04c':
      boy({ ...head(f, 31, 1.5, 0.35, 0.3) }, { yaw: 0.3 });
      break;
    case 's05a':
      cook({ expr: 'angry', prop: ['wave', 0.9], ...head(f, 51, Math.sin((f - 442) * 0.3) * 2.4, 0, 0, 0.15) }, { yaw: 0.15 });
      boy({ expr: 'sad', ...head(f, 31, 1.6, -0.3, 0.15) }, { yaw: -0.3 });
      break;
    case 's05b':
      boy({ ...head(f, 31, 0.8, -0.25, 0.1) }, { yaw: -0.25 });
      cook({ prop: ['point', 0.7], ...head(f, 51, -1.2, -0.2, 0) }, { yaw: -0.2 });
      break;
    case 's06a':
      boy({ expr: 'smile', prop: ['point', 0.8], ...head(f, 31, 0.6, 0.2, 0.05) }, { yaw: 0.2 });
      cook({ prop: ['spoon', 0.75], ...head(f, 51, -1.0, 0, 0) });
      break;
    case 's06b':
      boy({ expr: 'smile', prop: ['raise', 0.85], ...head(f, 31, 0.4, 0, -0.05) });
      break;
    case 's07a':
      boy({ expr: 'determined', prop: ['point', 0.9], ...head(f, 31, 1.4, 0.1, 0.32) }, { yaw: 0.1 });
      break;
    case 's07b':
      boy({ expr: 'wonder', prop: ['point', 0.8], ...head(f, 31, 1.0, 0.15, 0.2) }, { yaw: 0.15 });
      break;
    case 's08a':
      boy({ expr: 'determined', ...head(f, 31, 0.8, 0.3, 0.15) }, { yaw: 0.3 });
      servantA({ ...head(f, 41, 0.6, -0.2, 0.1) }, { yaw: -0.2 });
      break;
    case 's08b':
      boy({ expr: 'determined', prop: ['point', 0.85], ...head(f, 31, 1.2, 0.2, 0.28) }, { yaw: 0.2 });
      servantA({ ...head(f, 41, 0.6, -0.15, 0.1) }, { yaw: -0.15 });
      break;
    case 's09':
      servantA({ ...head(f, 41, 0.8, 0, 0.2) }, { yaw: -0.5 });
      servantB({ ...head(f, 61, 0.8, 0, 0.2) }, { yaw: 0.5 });
      break;
    case 's10a':
      boy({ expr: 'determined', prop: ['raise', 0.8], ...head(f, 31, 0.9, 0.25, 0.1) }, { yaw: 0.25 });
      servantB({ ...head(f, 61, 0.6, 0, 0.05) });
      break;
    case 's10b':
      boy({ expr: 'determined', prop: ['point', 0.9], ...head(f, 31, 1.3, 0.15, 0.3) }, { yaw: 0.15 });
      servantB({ ...head(f, 61, 0.6, 0, 0.05) });
      break;
    case 's11a':
      servantA({ ...head(f, 41, 0.4, 0, 0) }, { yaw: -0.15 });
      boy({ expr: 'smile', ...head(f, 31, 0.6, 0.2, 0) }, { yaw: 0.2 });
      break;
    case 's11b':
      servantB({ ...head(f, 61, 0.4, 0, 0) }, { yaw: 0.15 });
      break;
    case 's12a':
      guestsSit(() => ['spoon', 0.8], () => 1.2, ['guestB']);
      break;
    case 's12b':
      guestsSit(() => ['wave', 0.85], (id) => Math.sin(f * 0.3 + 1.7) * 2.0, ['guestC']);
      break;
    case 's13a':
      king({ prop: ['spoon', 0.85], ...head(f, 71, 0.8, 0, 0.15) });
      break;
    case 's13b':
      king({ expr: 'laugh', prop: ['point', 0.9], ...head(f, 71, -0.6, 0, -0.05) });
      break;
    case 's14':
      cook({ ...head(f, 51, -0.8, 0, 0) }, { yaw: Math.PI });
      guestsSit(null, () => 0.6);
      break;
    case 's15a': case 's15b': {
      // the head cook's ADMISSION — performed dialogue (speak track, L15)
      const SM = spk(CP, f);
      cook({ expr: 'nervous', exprP: SM.exprP, prop: ['point', 0.75], ...head(f, 51, 1.8 + SM.nod, 0, 0.1, 0) }, { yaw: Math.PI });
      king({ ...head(f, 71, 0.4, 0, 0) });
      break;
    }
    case 's16a':
      boy({ expr: 'nervous', ...head(f, 31, 1.0, 0.2, 0) }, { yaw: 0.3 });
      cook({ expr: 'pained', ...head(f, 51, 2.0, -0.2, 0.1) }, { yaw: Math.PI });
      king({ ...head(f, 71, 0.4, 0, 0) });
      break;
    case 's16b':
      boy({ expr: 'grin', ...head(f, 31, 0.6, -0.15, -0.05) }, { yaw: -0.2 });
      king({ expr: 'smile_closed', prop: ['point', 0.8], ...head(f, 71, 0.6, 0.1, 0.1) });
      cook({ expr: 'pained', ...head(f, 51, 2.2, 0.25, 0.15) }, { yaw: Math.PI });
      break;
    case 's17':
      boy({ expr: 'smile', prop: ['wave', 0.8], ...head(f, 31, 0.5, 0, 0) }, { yaw: -0.15 });
      king({ ...head(f, 71, 0.4, 0, 0) });
      cook({ expr: 'pained', ...head(f, 51, 2.0, 0.2, 0.1) }, { yaw: Math.PI });
      servantA({ ...head(f, 41, 0.5, 0, 0) }, { yaw: -0.3 });
      servantB({ ...head(f, 61, 0.5, 0, 0) }, { yaw: 0.3 });
      guestsSit(() => ['clap', 0.8], () => 0.8);
      break;
    default:
      boy({}); cook({});
  }
  return out;
};
export const actorsAt = (f, T2) => castAt(f).map((c) => c.actor(T2));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-7.5, 3.0, -8.9, -7.9, { h: 1.05, id: 'hearth' }),
  SOL.aabb(1.1, 3.5, -6.75, -6.05, { h: 1.0, id: 'pass' }),
  SOL.circle(CHEST.x, CHEST.z, 0.42, { h: 1.1, id: 'chest' }),
  ...TABLES.map((cx) => SOL.aabb(cx - 0.8, cx + 0.8, -3.5, 2.5, { h: 0.95, id: 'table' })),
  SOL.circle(BOARD_POS[0], BOARD_POS[2], 0.3, { h: 1.9, id: 'boardstand' }),
  ...[[-8.5, 3], [8.5, 3], [-8.5, -5], [8.5, -5]].map(([x, z]) => SOL.circle(x, z, 0.4, { h: 5, id: 'tree' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => castAt(f).map((a) => SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
