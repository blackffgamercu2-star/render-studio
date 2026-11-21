// Shot plan for "The Man Who Paid for a Smell" — built on the approved
// Salted Mine 60 run-3 template (same painter/cast family, v4 camera,
// N1 voice). A poor traveller seasons his dry crust with the steam of a
// rich eatery's pot; the greedy owner drags him to court for the smell;
// the judge shakes the man's last coins in a bag beside the owner's ear
// — the SOUND of money for the SMELL of food. Daylight village square:
// eatery stall (back-left) + judge's dais (front-right), one set.
// Exactly 60.000 s / 1800 frames @30 fps. Shots cut ONLY on voice lines
// and word onsets (stem = voice_final.wav, timing.json):
//   L1 0-106 · L2 114-205 · L3 213-308 · L4 317-406 · L5 415-488 ·
//   L6 497-581 · L7 590-648 (OWNER dialogue, performed) · L8 657-759 ·
//   L9 768-848 · L10 857-983 · L11 992-1126 · L12 1135-1252 ·
//   L13 1260-1334 · L14 1343-1444 · L15 1453-1545 (JUDGE ruling,
//   performed) · L16 1554-1668 · L17 1676-1799 (narration + board).
// Internal cuts on word onsets: dragged f53 · steam f382 · laughing
// f899 · feast f1074 · coins f1235 · shook f1408 · roared f1603.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1800, DECK = 0;
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
export const SHOTS = [
  { id: 's01a', a: 0, b: 52, light: 'day' },
  { id: 's01b', a: 53, b: 113, light: 'day' },
  { id: 's02', a: 114, b: 212, light: 'day' },
  { id: 's03', a: 213, b: 316, light: 'day' },
  { id: 's04a', a: 317, b: 381, light: 'day' },
  { id: 's04b', a: 382, b: 414, light: 'day' },
  { id: 's05', a: 415, b: 496, light: 'day' },
  { id: 's06', a: 497, b: 589, light: 'day' },
  { id: 's07', a: 590, b: 656, light: 'day' },
  { id: 's08a', a: 657, b: 705, light: 'day' },
  { id: 's08b', a: 706, b: 767, light: 'day' },
  { id: 's09', a: 768, b: 856, light: 'day' },
  { id: 's10a', a: 857, b: 898, light: 'day' },
  { id: 's10b', a: 899, b: 991, light: 'day' },
  { id: 's11a', a: 992, b: 1073, light: 'day' },
  { id: 's11b', a: 1074, b: 1134, light: 'day' },
  { id: 's12a', a: 1135, b: 1234, light: 'day' },
  { id: 's12b', a: 1235, b: 1259, light: 'day' },
  { id: 's13', a: 1260, b: 1342, light: 'day' },
  { id: 's14a', a: 1343, b: 1407, light: 'day' },
  { id: 's14b', a: 1408, b: 1452, light: 'day' },
  { id: 's15', a: 1453, b: 1553, light: 'day' },
  { id: 's16a', a: 1554, b: 1602, light: 'day' },
  { id: 's16b', a: 1603, b: 1675, light: 'day' },
  { id: 's17', a: 1676, b: 1799, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights: one daylight grade (same vivid family as the template) ----------
export const LIGHTS = {
  day: { az: 218, el: 44, sky: '#ffe9bb', ground: '#8a6f4a', hemi: 1.04, sun: '#ffdca3', sunI: 2.5, fog: '#eed9ae', fogNear: 42, fogFar: 320,
    skyTop: '#3f6fb4', skyHor: '#f6d491', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.1, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#fff0cd',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const BOARD_POS = [-1.45, 0.62, 6.2];
const POT = { x: -2.4, z: -3.2 };
const DAIS = { x: 2.2, z: 8.8, top: 0.38 };
// the bread: over the pot (hook + L4), in the traveller's hands at the
// bench (L5), carried off at the end (L17)
export const breadAt = (f) => {
  const S = shotAt(f);
  if (S.id === 's01a' || S.id === 's04a' || S.id === 's04b')
    return { k: 1, x: -2.16, y: 1.31 + 0.02 * Math.sin(f * 0.11), z: -3.06, rz: 0.12 };
  if (S.id === 's05') return { k: 1, x: 0.42, y: 1.02, z: -1.92, rz: 0.06 };
  if (S.id === 's17') { const t = travAt(f); return { k: 1, x: t.x + 0.34, y: 1.02, z: t.z + 0.18, rz: 0.1 }; }
  return { k: 0, x: 0, y: 0, z: 0, rz: 0 };
};
// the coin bag: in the judge's raised hand from L14 on — dropped full of
// coins, then SHAKEN beside the owner's ear on "shook" (f1408-1444)
export const bagAt = (f) => {
  const S = shotAt(f);
  if (S.id === 's14a') return { k: 1, x: 2.74, y: 1.30, z: 7.28, sh: 0 };
  if (S.id === 's14b' || S.id === 's15') {
    const env = S.id === 's14b' ? 1 : Math.max(0, 1 - ramp(f, 1453, 1470));
    const sh = Math.sin((f - 1408) * 0.9) * 0.055 * env;
    return { k: 1, x: 2.82 + sh, y: 1.58, z: 6.66, sh };
  }
  return { k: 0, x: 0, y: 0, z: 0, sh: 0 };
};
// actor anchors per shot (single source; checked against STATICS)
export const travAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's01a': case 's04a': case 's04b': return { x: -1.3, z: -2.8 };
    case 's01b': { const u = ramp(f, 53, 113); return { x: lerp(-0.9, 0.2, u), z: lerp(-2.5, 1.5, u) }; }
    case 's02': { const u = ramp(f, 114, 205); return { x: lerp(7.5, -3.2, u), z: lerp(6.5, 0.5, u) }; }
    case 's03': return { x: -1.6, z: -1.2 };
    case 's05': return { x: 0.5, z: -2.35 };
    case 's06': case 's07': case 's08a': case 's08b': return { x: -0.9, z: -2.5 };
    case 's09': { const u = ramp(f, 768, 848); return { x: lerp(-0.9, 0.9, u), z: lerp(-2.5, 5.7, u) }; }
    case 's10a': case 's10b': case 's11a': case 's11b': case 's12a': return { x: 0.9, z: 5.7 };
    case 's12b': return { x: 1.55, z: 6.55 };
    case 's13': case 's14a': case 's14b': case 's15': case 's16a': case 's16b': return { x: 0.9, z: 5.7 };
    case 's17': { const u = ramp(f, 1676, 1799); return { x: lerp(0.9, -1.5, u), z: lerp(5.7, -1.0, u) }; }
    default: return { x: 0.9, z: 5.7 };
  }
};
export const ownAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's01a': case 's03': case 's04a': case 's04b': case 's05': return { x: -2.7, z: -5.55 };
    case 's01b': { const u = ramp(f, 53, 113); return { x: lerp(-1.8, 0.85, u), z: lerp(-1.9, 2.2, u) }; }
    case 's02': return { x: -2.7, z: -5.55 };
    case 's06': { if (f < 524) { const u = ramp(f, 497, 524); return { x: lerp(-2.7, 0.75, u), z: lerp(-5.55, -5.3, u) }; } if (f < 556) { const u = ramp(f, 524, 556); return { x: lerp(0.75, 0.55, u), z: lerp(-5.3, -3.9, u) }; } const u = ramp(f, 556, 589); return { x: lerp(0.55, -2.0, u), z: lerp(-3.9, -3.95, u) }; }
    case 's07': case 's08a': case 's08b': return { x: -2.0, z: -3.95 };
    case 's09': { if (f < 824) { const u = ramp(f, 768, 824); return { x: lerp(-1.45, 0.05, u), z: lerp(-1.55, 4.35, u) }; } const u = ramp(f, 824, 856); return { x: lerp(0.05, 2.6, u), z: lerp(4.35, 6.4, u) }; }
    case 's10a': case 's10b': case 's11a': case 's11b': case 's12a': case 's12b': case 's13': return { x: 3.35, z: 5.9 };
    case 's14a': case 's14b': case 's15': case 's16a': case 's16b': return { x: 3.2, z: 6.9 };
    case 's17': return { x: 3.2, z: 6.9 };
    default: return { x: 3.35, z: 5.9 };
  }
};
export const judgeAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's14a': case 's14b': case 's15': return { x: 2.5, z: 7.7 };
    default: return { x: DAIS.x, z: DAIS.z };
  }
};
export const vilAAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's09': { const u = ramp(f, 790, 856); return { x: lerp(-4.5, -0.5, u), z: lerp(0.5, 4.15, u) }; }
    case 's10a': { const u = ramp(f, 857, 878); return { x: lerp(-0.5, -0.6, u), z: lerp(4.15, 4.6, u) }; }
    case 's10b': case 's11a': case 's11b': case 's12a': case 's12b': case 's13': case 's14a': case 's14b': case 's15': case 's16a': case 's16b': case 's17': return { x: -0.6, z: 4.6 };
    default: return { x: -4.5, z: 0.5 };
  }
};
export const vilBAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's09': { const u = ramp(f, 800, 856); return { x: lerp(6.5, 5.6, u), z: lerp(0.0, 4.9, u) }; }
    case 's10a': case 's10b': case 's11a': case 's11b': case 's12a': case 's12b': case 's13': case 's14a': case 's14b': case 's15': case 's16a': case 's16b': case 's17': return { x: 5.6, z: 4.9 };
    default: return { x: 6.5, z: 0.0 };
  }
};
export const vilCAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's10a': { const u = ramp(f, 857, 898); return { x: lerp(8.5, 6.6, u), z: lerp(2.0, 6.3, u) }; }
    case 's10b': case 's11a': case 's11b': case 's12a': case 's12b': case 's13': case 's14a': case 's14b': case 's15': case 's16a': case 's16b': case 's17': return { x: 6.6, z: 6.3 };
    default: return { x: 8.5, z: 2.0 };
  }
};

// ---------- hero / focus ----------
const FOCUS = {
  s01a: () => [POT.x, 1.25, POT.z],
  s01b: () => { const t = travAt(83); return [t.x, 1.4, t.z]; },
  s02: () => { const t = travAt(160); return [t.x, 1.4, t.z]; },
  s03: () => [-2.2, 1.5, -3.6],
  s04a: () => [POT.x, 1.2, POT.z],
  s04b: () => [-2.2, 1.3, -3.08],
  s05: () => [0.5, 1.2, -2.35],
  s06: () => { const o = ownAt(545); return [o.x, 1.45, o.z]; },
  s07: () => { const o = ownAt(620); return [o.x, 1.5, o.z]; },
  s08a: () => [-0.9, 1.0, -2.4],
  s08b: () => [-1.4, 1.35, -3.2],
  s09: () => [0.2, 1.3, 1.6],
  s10a: () => [2.2, 1.3, 4.6],
  s10b: () => { const a = vilAAt(945); return [a.x, 1.45, a.z]; },
  s11a: () => [2.3, 1.6, 7.4],
  s11b: () => { const o = ownAt(1100); return [o.x, 1.45, o.z]; },
  s12a: () => [DAIS.x, 1.85, DAIS.z],
  s12b: () => [1.55, 1.3, 6.55],
  s13: () => [2.4, 1.4, 5.2],
  s14a: () => [2.8, 1.5, 7.2],
  s14b: () => [3.05, 1.55, 7.0],
  s15: () => [2.5, 1.9, 7.7],
  s16a: () => { const o = ownAt(1580); return [o.x, 1.5, o.z]; },
  s16b: () => [2.6, 1.35, 5.4],
  s17: () => [0.65, 1.2, 7.2],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: v4 grammar — hard cuts on lines/word onsets, every
// shot moves (push-in / track / pan), NO shake, NO frozen frames ----------
const travPos = (f) => { const t = travAt(f); return [t.x, 0, t.z]; };
const ownPos = (f) => { const o = ownAt(f); return [o.x, 0, o.z]; };
const judgePos = (f) => { const j = judgeAt(f); return [j.x, DAIS.top, j.z]; };
const vilAPos = (f) => { const a = vilAAt(f); return [a.x, 0, a.z]; };
const RIG_BY_ID = {
  s01a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [0.6, 1.52, 0.8], look: [-2.1, 1.13, -3.02], fov: 34 },
    { f: 52, pos: [0.22, 1.44, 0.22], look: [-2.12, 1.14, -3.04], fov: 31, ease: 'surge' }] }) },
  s01b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 53, pos: [2.85, 1.85, 3.0], look: [-1.35, 1.3, -2.2], fov: 37 },
    { f: 83, pos: [3.8, 1.82, 5.0], look: [-0.41, 1.3, -0.17], fov: 36, ease: 'smooth' },
    { f: 113, pos: [4.7, 1.8, 7.05], look: [0.52, 1.3, 1.85], fov: 34, ease: 'surge' }] }) },
  s02: { cut: 'hard', raw: keysCam({ keys: [
    { f: 114, pos: [10.1, 1.7, 11.1], look: [7.5, 1.35, 6.5], fov: 38 },
    { f: 160, pos: [4.7, 1.66, 8.1], look: [2.1, 1.35, 3.5], fov: 36, ease: 'smooth' },
    { f: 212, pos: [-0.6, 1.62, 5.1], look: [-3.2, 1.35, 0.5], fov: 34, ease: 'surge' }] }) },
  s03: { cut: 'hard', raw: keysCam({ keys: [
    { f: 213, pos: [3.9, 2.7, 4.8], look: [-2.2, 1.35, -3.5], fov: 42 },
    { f: 316, pos: [3.3, 2.45, 3.9], look: [-2.25, 1.3, -3.5], fov: 39, ease: 'surge' }] }) },
  s04a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 317, pos: [0.35, 1.62, -0.1], look: [-1.95, 1.15, -3.0], fov: 34 },
    { f: 381, pos: [0.05, 1.52, -0.55], look: [-2.05, 1.18, -3.05], fov: 31, ease: 'surge' }] }) },
  s04b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 382, pos: [-0.5, 1.52, -1.05], look: [-2.24, 1.24, -3.08], fov: 30 },
    { f: 414, pos: [-0.62, 1.46, -1.2], look: [-2.26, 1.25, -3.09], fov: 29, ease: 'surge' }] }) },
  s05: { cut: 'hard', raw: pushInCam({ subject: travPos, a: 415, b: 496, d0: 3.6, d1: 3.0, h0: 1.58, h1: 1.5, lookOff: [0, 1.3, 0], fov0: 34, fov1: 30,
    dir: () => [0.35, 0.94] }) },
  s06: { cut: 'hard', raw: pushInCam({ subject: ownPos, a: 497, b: 589, d0: 4.3, d1: 3.0, h0: 1.66, h1: 1.56, lookOff: [0, 1.45, 0], fov0: 36, fov1: 31,
    dir: () => [0.22, 0.98] }) },
  s07: { cut: 'hard', raw: pushInCam({ subject: ownPos, a: 590, b: 656, d0: 2.9, d1: 2.35, h0: 1.58, h1: 1.54, lookOff: [0, 1.5, 0], fov0: 33, fov1: 29,
    dir: () => [0.95, 0.31] }) },
  s08a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 657, pos: [1.15, 1.5, -0.35], look: [-0.92, 1.16, -2.42], fov: 30 },
    { f: 705, pos: [1.05, 1.5, -0.45], look: [-0.94, 1.18, -2.45], fov: 29, ease: 'surge' }] }) },
  s08b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 706, pos: [1.85, 1.72, 0.85], look: [-1.45, 1.3, -3.15], fov: 36 },
    { f: 767, pos: [1.6, 1.66, 0.5], look: [-1.5, 1.3, -3.2], fov: 33, ease: 'surge' }] }) },
  s09: { cut: 'hard', raw: keysCam({ keys: [
    { f: 768, pos: [3.3, 1.95, 3.3], look: [-1.18, 1.3, -2.02], fov: 38 },
    { f: 812, pos: [4.35, 1.9, 7.3], look: [-0.2, 1.3, 2.6], fov: 37, ease: 'smooth' },
    { f: 856, pos: [6.4, 1.95, 11.6], look: [1.75, 1.3, 6.05], fov: 36, ease: 'surge' }] }) },
  s10a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 857, pos: [-3.6, 2.25, 0.4], look: [2.4, 1.25, 4.2], fov: 40 },
    { f: 898, pos: [-3.1, 2.1, 0.9], look: [2.5, 1.25, 4.5], fov: 38, ease: 'surge' }] }) },
  s10b: { cut: 'hard', raw: pushInCam({ subject: vilAPos, a: 899, b: 991, d0: 2.9, d1: 2.3, h0: 1.54, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 33, fov1: 29,
    dir: () => [-0.5, 0.86] }) },
  s11a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 992, pos: [-1.9, 2.35, 0.7], look: [2.4, 1.5, 7.5], fov: 40 },
    { f: 1073, pos: [-1.5, 2.2, 1.3], look: [2.45, 1.48, 7.6], fov: 37, ease: 'surge' }] }) },
  s11b: { cut: 'hard', raw: pushInCam({ subject: ownPos, a: 1074, b: 1134, d0: 3.4, d1: 2.7, h0: 1.6, h1: 1.55, lookOff: [0, 1.45, 0], fov0: 34, fov1: 30,
    dir: () => [-0.3, -0.95] }) },
  s12a: { cut: 'hard', raw: pushInCam({ subject: judgePos, a: 1135, b: 1234, d0: 3.2, d1: 2.55, h0: 1.72, h1: 1.66, lookOff: [0, 1.47, 0], fov0: 34, fov1: 30,
    dir: () => [-0.25, -0.97] }) },
  s12b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1235, pos: [3.45, 1.75, 3.95], look: [1.57, 1.38, 6.5], fov: 28 },
    { f: 1259, pos: [3.3, 1.7, 4.15], look: [1.57, 1.38, 6.52], fov: 27, ease: 'surge' }] }) },
  s13: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1260, pos: [0.3, 1.82, 1.1], look: [-0.4, 1.4, 4.8], fov: 36 },
    { f: 1342, pos: [0.9, 1.78, 1.5], look: [5.4, 1.38, 5.0], fov: 34, ease: 'surge' }] }) },
  s14a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1343, pos: [-0.3, 2.05, 3.0], look: [2.9, 1.48, 7.3], fov: 40 },
    { f: 1407, pos: [-0.1, 1.98, 3.3], look: [2.92, 1.48, 7.32], fov: 38, ease: 'surge' }] }) },
  s14b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1408, pos: [5.1, 2.0, 3.8], look: [3.08, 1.52, 6.9], fov: 34 },
    { f: 1452, pos: [4.95, 1.94, 4.0], look: [3.09, 1.52, 6.92], fov: 32, ease: 'surge' }] }) },
  s15: { cut: 'hard', raw: pushInCam({ subject: judgePos, a: 1453, b: 1553, d0: 2.95, d1: 2.35, h0: 1.74, h1: 1.68, lookOff: [0, 1.5, 0], fov0: 33, fov1: 29,
    dir: () => [-0.3, -0.95] }) },
  s16a: { cut: 'hard', raw: pushInCam({ subject: ownPos, a: 1554, b: 1602, d0: 2.6, d1: 2.05, h0: 1.6, h1: 1.52, lookOff: [0, 1.48, 0], fov0: 32, fov1: 28,
    dir: () => [-0.3, -0.95] }) },
  s16b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1603, pos: [-2.3, 2.45, 0.5], look: [2.7, 1.3, 5.5], fov: 41 },
    { f: 1675, pos: [-1.9, 2.3, 1.1], look: [2.75, 1.3, 5.6], fov: 38, ease: 'surge' }] }) },
  s17: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1676, pos: [0.65, 2.25, 18.6], look: [0.65, 1.02, 7.0], fov: 46 },
    { f: 1799, pos: [0.6, 2.35, 19.6], look: [0.62, 1.0, 6.9], fov: 44, ease: 'surge' }] }) },
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
  if (['s03', 's10a', 's11a', 's16b', 's17'].includes(S.id)) cinf = 1.4;
  if (['s01a', 's08a', 's12b', 's14b'].includes(S.id)) cinf = 3.6;
  if (S.id === 's04b') cinf = 2.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), br = breadAt(f), bg = bagAt(f);
  const steamK = ['s01a', 's03', 's04a', 's04b'].includes(S.id) ? 1 : S.id === 's05' ? 0.7 : ['s06', 's07', 's08a', 's08b'].includes(S.id) ? 0.35 : 0;
  return {
    always: 1,
    steamK,
    breadK: br.k, breadX: br.x, breadY: br.y, breadZ: br.z, breadRz: br.rz || 0,
    clothK: S.id === 's08a' ? 1 : 0,
    bagK: bg.k, bagX: bg.x, bagY: bg.y, bagZ: bg.z,
    boardK: S.id === 's17' ? smooth(ramp(f, 1684, 1706)) : 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const steam = ['s01a', 's03', 's04a', 's04b'].includes(S.id) ? 1 : S.id === 's05' ? 0.6 : ['s06', 's07', 's08a', 's08b'].includes(S.id) ? 0.3 : 0;
  return { moteRate: 0.05, blastRate: 0, sparkRate: 0, steamRate: steam, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
const TINT = { day: '#ffffff' };
export const OUTFITS = {
  traveller: { jacket: '#6e5136', pants: '#463c33', boots: '#2a1c10', hat: 'cap', cap: '#8a764f', skin: '#fbf7ef' },
  owner: { jacket: '#7c3f21', pants: '#3a3230', boots: '#1c1712', hat: 'turban', hatCol: '#c8552e', shirtFront: '#f3ead8', skin: '#fbf7ef', moustache: '#241a12', bigMoustache: true },
  judge: { jacket: '#e6dcc2', pants: '#5a4a38', boots: '#2a2018', hat: 'turban', hatCol: '#f5efe0', skin: '#fbf7ef', moustache: '#cfc8b8' },
  vilA: { jacket: '#1f7a6a', pants: '#3a3a42', boots: '#241a12', hat: 'cap', cap: '#f2c230', skin: '#fbf7ef' },
  vilB: { jacket: '#4a5d8a', pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#33241a', skin: '#fbf7ef' },
  vilC: { jacket: '#8a6d1f', pants: '#3c3a40', boots: '#1c1712', hat: 'cap', cap: '#5d8a3a', skin: '#fbf7ef', moustache: '#2a201a' },
};
const drawGlasses = (seed) => (p) => {
  const hc = T.headCenter(seed);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};
const glassesJudge = drawGlasses(71);

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
const emoTrav = emoTrack('neutral', [
  [213, 'wonder', 10], [415, 'smile_closed', 10], [497, 'nervous', 8], [1135, 'nervous', 10],
  [1453, 'nervous', 8], [1520, 'relief', 10], [1603, 'grin', 8], [1676, 'smile', 10],
]);
const emoOwn = emoTrack('proud', [
  [415, 'stern', 10], [497, 'angry', 8], [992, 'stern', 10], [1260, 'smug', 10],
  [1408, 'smug', 8], [1477, 'confused', 8], [1528, 'shock', 8], [1554, 'sad', 10], [1676, 'pained', 10],
]);
const emoJudge = emoTrack('neutral', [
  [1135, 'thinking', 10], [1260, 'stern', 8], [1343, 'thinking', 8], [1453, 'smile', 10], [1676, 'smile_closed', 12],
]);
const emoVilA = emoTrack('grin', [
  [857, 'laugh', 8], [1260, 'nervous', 8], [1453, 'nervous', 8], [1603, 'laugh', 8],
]);
const emoVilB = emoTrack('smile', [
  [857, 'laugh', 8], [1260, 'scared', 8], [1603, 'laugh', 8],
]);
const emoVilC = emoTrack('smile', [
  [992, 'grin', 8], [1260, 'nervous', 8], [1603, 'laugh', 8],
]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});
const spk = (baseP, f) => {
  const s = SPEAK.at(f);
  if (!s.active) return { exprP: baseP, nod: 0 };
  return { exprP: SPK.applySpeak({ ...baseP }, s), nod: q(s.nod || 0, 2) };
};

export const castAt = (f) => {
  const S = shotAt(f), tint = TINT.day, out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: extra.ground || 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const t = travAt(f), o = ownAt(f), j = judgeAt(f);
  const aA = vilAAt(f), aB = vilBAt(f), aC = vilCAt(f);
  const TP = emoTrav.at(f), OP = emoOwn.at(f), JP = emoJudge.at(f);
  const AP = emoVilA.at(f), BP = emoVilB.at(f), CP = emoVilC.at(f);
  TP.blush = 0; OP.blush = 0; JP.blush = 0; AP.blush = 0; BP.blush = 0; CP.blush = 0;
  const march = (speed = 0.011) => ({ mode: 'march', phase: q((f * speed) % 1, 2) });
  switch (S.id) {
    case 's01a': {
      std('traveller', OUTFITS.traveller, { expr: 'determined', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.78],
        ...head(f, 31, -3, -0.55, 0.55, -0.5) }, t.x, t.z, { yaw: -0.5 });
      break;
    }
    case 's01b': {
      std('owner', OUTFITS.owner, { expr: 'angry', exprP: OP, ...march(), blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.55],
        ...head(f, 51, -2, 0.4, 0.1, 0.4) }, o.x, o.z, { yaw: 0.35 });
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, ...march(0.012), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, -0.3, 0.15, -0.3) }, t.x, t.z, { yaw: 0.3 });
      break;
    }
    case 's02': {
      std('traveller', OUTFITS.traveller, { expr: 'neutral', exprP: TP, ...march(0.012), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[114, 2], [160, 0], [212, -2]], f), 0.1, 0.35, 0.1) }, t.x, t.z, { yaw: -0.25 });
      break;
    }
    case 's03': {
      std('traveller', OUTFITS.traveller, { expr: 'wonder', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, -0.3, 0.3, -0.3) }, t.x, t.z, { yaw: -0.35 });
      std('owner', OUTFITS.owner, { expr: 'proud', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.35, 0.05, 0.35) }, o.x, o.z, { yaw: 0.35 });
      break;
    }
    case 's04a': case 's04b': {
      std('traveller', OUTFITS.traveller, { expr: 'wonder', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.82],
        ...head(f, 31, -3.5, -0.55, 0.6, -0.5) }, t.x, t.z, { yaw: -0.5 });
      std('owner', OUTFITS.owner, { expr: 'proud', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.3, 0.1, 0.3) }, o.x, o.z, { yaw: 0.3 });
      break;
    }
    case 's05': {
      std('traveller', OUTFITS.traveller, { expr: 'smile_closed', exprP: TP, mode: 'sit', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2 + 1.3 * Math.sin(f * 0.22), 0, 0.45, 0) }, t.x, t.z, { yaw: 0.15 });
      std('owner', OUTFITS.owner, { expr: 'proud', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, -0.4, 0.1, -0.4) }, o.x, o.z, { yaw: -0.35 });
      break;
    }
    case 's06': {
      const walking = f >= 497 && f < 589;
      std('owner', OUTFITS.owner, { expr: 'angry', exprP: OP, ...(walking ? march() : { mode: 'stand' }), blink: blinkAt(f, 51), seed: 51, prop: null,
        ...head(f, 51, -2, 0.45, 0.05, 0.45) }, o.x, o.z, { yaw: 0.4 });
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.5, 0.1, -0.5) }, t.x, t.z, { yaw: -0.45 });
      break;
    }
    case 's07': {
      // the owner's DEMAND — performed dialogue (speak track)
      const SO = spk(OP, f);
      std('owner', OUTFITS.owner, { expr: 'angry', exprP: SO.exprP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.68],
        ...head(f, 51, -2.5 + SO.nod, 0.3, 0.05, 0.3) }, o.x, o.z, { yaw: 0.3 });
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, -0.5, 0.15, -0.5) }, t.x, t.z, { yaw: -0.45 });
      break;
    }
    case 's08a': {
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.3],
        ...head(f, 31, -1, -0.2, 0.5, -0.2) }, t.x, t.z, { yaw: -0.2 });
      std('owner', OUTFITS.owner, { expr: 'angry', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.4, 0.05, 0.4) }, o.x, o.z, { yaw: 0.4 });
      break;
    }
    case 's08b': {
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[706, 2.5], [730, 2.5], [752, -1], [767, -1]], f), -0.4, 0.2, -0.4) }, t.x, t.z, { yaw: -0.4 });
      std('owner', OUTFITS.owner, { expr: 'angry', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.45],
        ...head(f, 51, -2, 0.4, 0.05, 0.4) }, o.x, o.z, { yaw: 0.4 });
      break;
    }
    case 's09': {
      std('owner', OUTFITS.owner, { expr: 'angry', exprP: OP, ...march(), blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.55],
        ...head(f, 51, -2, 0.35, 0.05, 0.35) }, o.x, o.z, { yaw: 0.3 });
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, ...march(0.012), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, -0.3, 0.1, -0.3) }, t.x, t.z, { yaw: 0.25 });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, ...(f >= 790 ? march(0.012) : { mode: 'stand' }), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.4, 0.05, 0.4) }, aA.x, aA.z, { yaw: 0.3 });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, ...(f >= 800 ? march(0.012) : { mode: 'stand' }), blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, -0.4, 0.05, -0.4) }, aB.x, aB.z, { yaw: -0.3 });
      break;
    }
    case 's10a': {
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, 0.3, 0.1, 0.3) }, t.x, t.z, { yaw: 0.3 });
      std('owner', OUTFITS.owner, { expr: 'angry', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, -0.3, 0.05, -0.3) }, o.x, o.z, { yaw: -0.3 });
      std('vilA', OUTFITS.vilA, { expr: 'laugh', exprP: AP, ...(f < 878 ? march(0.012) : { mode: 'stand' }), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2 + 1.8 * Math.sin(f * 0.3), 0.2, -0.1, 0.2) }, aA.x, aA.z, { yaw: 0.2 });
      std('vilB', OUTFITS.vilB, { expr: 'laugh', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -2 + 1.8 * Math.sin(f * 0.3 + 1.2), -0.2, -0.1, -0.2) }, aB.x, aB.z, { yaw: -0.2 });
      std('vilC', OUTFITS.vilC, { expr: 'grin', exprP: CP, ...march(0.012), blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1, -0.3, 0.05, -0.3) }, aC.x, aC.z, { yaw: -0.25 });
      break;
    }
    case 's10b': {
      std('vilA', OUTFITS.vilA, { expr: 'laugh', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2.5 + 2.2 * Math.sin(f * 0.3), 0.1, -0.15, 0.1) }, aA.x, aA.z, { yaw: 0.1, y: Math.abs(Math.sin(f * 0.3)) * 0.04 });
      std('vilB', OUTFITS.vilB, { expr: 'laugh', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -2 + 1.8 * Math.sin(f * 0.3 + 1.2), -0.3, -0.1, -0.3) }, aB.x, aB.z, { yaw: -0.3 });
      break;
    }
    case 's11a': {
      std('judge', OUTFITS.judge, { expr: 'neutral', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1, 0.1, 0.15, 0.1) }, j.x, j.z, { yaw: -0.1, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      const bow = f >= 1000 && f <= 1062 ? Math.sin((f - 1000) / 62 * Math.PI) : 0;
      std('owner', OUTFITS.owner, { expr: 'stern', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.35],
        ...head(f, 51, -1.5 - 6.5 * bow, 0.2, 0.1 + 0.4 * bow, 0.2, 0.04 * bow) }, o.x, o.z, { yaw: -0.25 });
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, 0.35, 0.1, 0.35) }, t.x, t.z, { yaw: 0.35 });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.3, 0.05, 0.3) }, aA.x, aA.z, { yaw: 0.3 });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, -0.3, 0.05, -0.3) }, aB.x, aB.z, { yaw: -0.3 });
      std('vilC', OUTFITS.vilC, { expr: 'grin', exprP: CP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1, -0.3, 0.05, -0.3) }, aC.x, aC.z, { yaw: -0.3 });
      break;
    }
    case 's11b': {
      std('owner', OUTFITS.owner, { expr: 'stern', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.7],
        ...head(f, 51, -2.5, -0.2, 0.1, -0.2) }, o.x, o.z, { yaw: 0.2 });
      std('judge', OUTFITS.judge, { expr: 'neutral', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1, -0.15, 0.1, -0.15) }, j.x, j.z, { yaw: 0.15, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      break;
    }
    case 's12a': {
      std('judge', OUTFITS.judge, { expr: 'thinking', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.22],
        ...head(f, 71, kf([[1135, -1], [1170, -4], [1210, -4], [1234, -1.5]], f), 0.05, 0.5, 0.05) }, j.x, j.z, { yaw: -0.05, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, 0.3, 0.1, 0.3) }, t.x, t.z, { yaw: 0.3 });
      std('owner', OUTFITS.owner, { expr: 'stern', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, -0.3, 0.05, -0.3) }, o.x, o.z, { yaw: -0.3 });
      break;
    }
    case 's12b': {
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['coin', 0.8],
        ...head(f, 31, -2, 0.25, 0.3, 0.25) }, t.x, t.z, { yaw: 0.25 });
      std('judge', OUTFITS.judge, { expr: 'thinking', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.5],
        ...head(f, 71, -2, -0.2, 0.3, -0.2) }, j.x, j.z, { yaw: -0.2, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      break;
    }
    case 's13': {
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1.5, 0.2, 0.2, 0.2) }, t.x, t.z, { yaw: 0.25 });
      std('vilA', OUTFITS.vilA, { expr: 'nervous', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1, 0.25, 0.1, 0.25) }, aA.x, aA.z, { yaw: 0.25 });
      std('vilB', OUTFITS.vilB, { expr: 'scared', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, 1, -0.25, 0.1, -0.25) }, aB.x, aB.z, { yaw: -0.25 });
      std('vilC', OUTFITS.vilC, { expr: 'nervous', exprP: CP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, 1, -0.25, 0.1, -0.25) }, aC.x, aC.z, { yaw: -0.25 });
      std('judge', OUTFITS.judge, { expr: 'stern', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1.5, 0.1, 0.2, 0.1) }, j.x, j.z, { yaw: -0.1, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      break;
    }
    case 's14a': {
      std('judge', OUTFITS.judge, { expr: 'thinking', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.6],
        ...head(f, 71, -3, 0.2, 0.45, 0.2) }, j.x, j.z, { yaw: 0.15, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      std('owner', OUTFITS.owner, { expr: 'smug', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -2, -0.35, 0.05, -0.35) }, o.x, o.z, { yaw: -0.4 });
      std('traveller', OUTFITS.traveller, { expr: 'nervous', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, 0.3, 0.1, 0.3) }, t.x, t.z, { yaw: 0.3 });
      break;
    }
    case 's14b': {
      std('owner', OUTFITS.owner, { expr: 'smug', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -3.5, -0.5, 0.1, -0.5) }, o.x, o.z, { yaw: -0.55 });
      break;
    }
    case 's15': {
      // the judge's RULING — performed dialogue (speak track)
      const SJ = spk(JP, f);
      std('judge', OUTFITS.judge, { expr: 'smile', exprP: SJ.exprP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.8],
        ...head(f, 71, -2 + SJ.nod, -0.1, 0.1, -0.1) }, j.x, j.z, { yaw: 0.1, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      std('owner', OUTFITS.owner, { expr: 'shock', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, kf([[1453, -3], [1500, -1], [1553, 1]], f), -0.3, 0.15, -0.3) }, o.x, o.z, { yaw: -0.35 });
      break;
    }
    case 's16a': {
      std('owner', OUTFITS.owner, { expr: 'sad', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, kf([[1554, 0], [1580, 4.5], [1602, 5.5]], f), 0, kf([[1554, 0.1], [1602, 0.55]], f), 0, 0.03) }, o.x, o.z, { yaw: -0.1 });
      break;
    }
    case 's16b': {
      std('vilA', OUTFITS.vilA, { expr: 'laugh', exprP: AP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2.5 + 2.2 * Math.sin(f * 0.3), 0.2, -0.12, 0.2) }, aA.x, aA.z, { yaw: 0.2, y: Math.abs(Math.sin(f * 0.3)) * 0.04 });
      std('vilB', OUTFITS.vilB, { expr: 'laugh', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -2.5 + 2.2 * Math.sin(f * 0.3 + 1.1), -0.2, -0.12, -0.2) }, aB.x, aB.z, { yaw: -0.2, y: Math.abs(Math.sin(f * 0.3 + 1.1)) * 0.04 });
      std('vilC', OUTFITS.vilC, { expr: 'laugh', exprP: CP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -2.5 + 2.2 * Math.sin(f * 0.3 + 2.2), -0.25, -0.12, -0.25) }, aC.x, aC.z, { yaw: -0.25, y: Math.abs(Math.sin(f * 0.3 + 2.2)) * 0.04 });
      std('traveller', OUTFITS.traveller, { expr: 'grin', exprP: TP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1.5, 0.2, 0, 0.2) }, t.x, t.z, { yaw: 0.25 });
      std('owner', OUTFITS.owner, { expr: 'sad', exprP: OP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, 4.5, -0.3, 0.5, -0.3, 0.03) }, o.x, o.z, { yaw: -0.3 });
      std('judge', OUTFITS.judge, { expr: 'smile', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, 0.1, 0.05, 0.1) }, j.x, j.z, { yaw: -0.1, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      break;
    }
    case 's17': {
      // the payoff wide: NO speech — narration + the hook board only.
      std('judge', OUTFITS.judge, { expr: 'smile_closed', exprP: JP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2.5, 0.15, 0.05, 0.15) }, j.x, j.z, { yaw: 0.1, y: DAIS.top, ground: DAIS.top, overlay: glassesJudge });
      std('traveller', OUTFITS.traveller, { expr: 'smile', exprP: TP, mode: 'stroll', phase: q((f * 0.009) % 1, 2), blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.4],
        ...head(f, 31, -1.5, 0.2, 0.2, 0.2) }, t.x, t.z, { yaw: 0.2 });
      std('vilB', OUTFITS.vilB, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1.5, -0.3, 0, -0.3) }, aB.x, aB.z, { yaw: -0.3 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
// The dais and the bench are PLATFORMS the cast stands/sits on — they are
// floors, not obstacles, so they are not statics (the judge's ground is
// the dais top, carried per-actor). Everything an actor could walk
// through IS a static.
export const STATICS = [
  SOL.circle(POT.x, POT.z, 0.45, { h: 1.05, id: 'pot' }),
  SOL.aabb(-5.0, 0.0, -5.0, -4.3, { h: 1.05, id: 'counter' }),
  ...[[-4.9, -2.0], [-0.1, -2.0], [-4.9, -5.9], [-0.1, -5.9]].map(([x, z]) => SOL.circle(x, z, 0.09, { h: 3.4, id: 'stallpost' })),
  SOL.circle(6.5, -4.0, 0.42, { h: 5, id: 'tree' }),
  SOL.circle(-7.5, 1.5, 0.9, { h: 1.1, id: 'cart' }),
  SOL.circle(-5.5, -8.0, 0.8, { h: 0.9, id: 'well' }),
  SOL.aabb(-11, -5, -16, -12, { h: 4.5, id: 'house1' }),
  SOL.aabb(0.5, 6.5, -16.5, -12.5, { h: 4.5, id: 'house2' }),
  SOL.aabb(8, 13, -15, -11.5, { h: 4.5, id: 'house3' }),
  ...[[0.2, 7.4], [4.2, 7.4], [0.2, 10.2], [4.2, 10.2]].map(([x, z]) => SOL.circle(x, z, 0.07, { h: 3.1, id: 'daispost' })),
  SOL.circle(BOARD_POS[0], BOARD_POS[2], 0.30, { h: 1.1, id: 'boardstand' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
