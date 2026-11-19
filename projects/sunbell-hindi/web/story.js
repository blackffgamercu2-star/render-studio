// Shot plan for "बिना छुए बजने वाली घंटी" — sunbell-hindi (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 8 H4. ONE set: a temple courtyard. The temple
// bell rings by itself at noon: a wet cotton rope tied to the hammer
// lever dries in the sun, shrinks, and pulls the striker into the bell.
// Voice stem: 49.091 s, 30 fps, TOTAL 1473. Clause boundaries from the
// stem's RMS-envelope clause dips cross-checked against line word rates
// (3.7-5.0 w/s per line); scene changes ONLY at clause boundaries:
//   L1 0.05-3.84   मंदिर की घंटी...छूता कोई नहीं।      L9  25.32-29.18 ठीक दोपहर...जा टकराया।
//   L2 3.84-6.84   उस समय न पुजारी...होता है।          L10 29.18-32.20 अगले दिन...बजी ही नहीं।
//   L3 6.84-9.60   गाँव वाले कहने लगे...बजाते हैं।      L11 32.20-36.16 शाम को पुजारी...बाँध दिया।
//   L4 9.60-12.94  एक शक्की युवक...बैठ गया।            L12 36.16-38.50 गाँव वालों के पूछने पर...कहा।
//   L5 12.94-16.60 घंटी के हथौड़े से...जाती थी।         L13 38.50-41.44 "इसे कोई हाथ...धूप खींचती है।"
//   L6 16.60-18.94 सुबह के समय...लटक रही थी।           L14 41.44-44.94 तब से गाँव वाले...बजेगी या नहीं।
//   L7 18.94-22.40 धूप तेज़ होते ही...होने लगी।         L15 44.94-48.95 लेकिन कल...राज़ क्या था?
//   L8 22.40-25.32 सिकुड़ती रस्सी...खींचती रही।
// GRADE (FILTER_VFX_LIGHTING pack): Sunny Pop (morning -> noon) with a
// Monsoon-Grey blend for the cloudy day and Golden Hour for the evening;
// grade changes ONLY on clause boundaries. Signature VFX: the rope's
// shrink-pull told physically (sag falls, hammer creeps stick-slip, then
// the strike), drips off the wet rope, drying wisps, noon heat shimmer,
// bell glints.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
import { emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.5 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1473, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 114, light: 'noon' },
  { id: 'noonempty', a: 115, b: 204, light: 'noon' },
  { id: 'villagers', a: 205, b: 287, light: 'noon' },
  { id: 'sneak', a: 288, b: 387, light: 'morn' },
  { id: 'rope', a: 388, b: 497, light: 'morn' },
  { id: 'wet', a: 498, b: 567, light: 'midmorn' },
  { id: 'drying', a: 568, b: 671, light: 'midmorn' },
  { id: 'creep', a: 672, b: 759, light: 'noon' },
  { id: 'strike', a: 760, b: 874, light: 'noon' },
  { id: 'cloudy', a: 875, b: 965, light: 'grey' },
  { id: 'reset', a: 966, b: 1084, light: 'eve' },
  { id: 'ask', a: 1085, b: 1154, light: 'eve' },
  { id: 'dialogue', a: 1155, b: 1242, light: 'eve' },
  { id: 'knowing', a: 1243, b: 1347, light: 'eve' },
  { id: 'hookq', a: 1348, b: 1420, light: 'dusk' },
  { id: 'hook', a: 1421, b: 1472, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  noon: { az: 198, el: 57, sky: '#bcd8e8', ground: '#8a6f4a', hemi: 1.05, sun: '#fff2cf', sunI: 2.6, fog: '#dcebf2', fogNear: 48, fogFar: 340,
    skyTop: '#2e6cd2', skyHor: '#cfe8f7', sunDisc: '#fff6d8', sunSize: 0.0045, sat: 1.14, vig: 0.24, shadowExt: 22, aurora: 0, gain: '#fff4dc',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  morn: { az: 138, el: 31, sky: '#c4d9e4', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.3, fog: '#e6ddc0', fogNear: 46, fogFar: 330,
    skyTop: '#3a74c4', skyHor: '#f7dcae', sunDisc: '#ffedb8', sunSize: 0.0042, sat: 1.12, vig: 0.25, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  midmorn: { az: 165, el: 44, sky: '#bfd9e6', ground: '#8a6f4a', hemi: 1.04, sun: '#ffe9b8', sunI: 2.45, fog: '#e2e4cc', fogNear: 47, fogFar: 335,
    skyTop: '#3570c8', skyHor: '#e8e2bc', sunDisc: '#fff2cc', sunSize: 0.0043, sat: 1.13, vig: 0.24, shadowExt: 22, aurora: 0, gain: '#fff0d2',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  grey: { az: 200, el: 38, sky: '#bcc3c6', ground: '#6b6e66', hemi: 1.18, sun: '#d4d9dc', sunI: 1.15, fog: '#b7bcbc', fogNear: 32, fogFar: 240,
    skyTop: '#5d6d7c', skyHor: '#c3c8c2', sunDisc: '#000000', sunSize: 0, sat: 0.55, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ccd2d4',
    waterDeep: '#24343c', waterShal: '#3c545e', glint: '#cfd8dc' },
  eve: { az: 252, el: 15, sky: '#c99a72', ground: '#5c4632', hemi: 0.95, sun: '#ffab5e', sunI: 2.1, fog: '#dcb98f', fogNear: 42, fogFar: 300,
    skyTop: '#3a4a7e', skyHor: '#f2a868', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.08, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f4e0ba',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  dusk: { az: 258, el: 9, sky: '#b98a64', ground: '#4c3826', hemi: 0.88, sun: '#ff9a4e', sunI: 1.7, fog: '#cfa87e', fogNear: 40, fogFar: 280,
    skyTop: '#2c3866', skyHor: '#e8935c', sunDisc: '#ffab60', sunSize: 0.0044, sat: 1.04, vig: 0.32, shadowExt: 22, aurora: 0, gain: '#eedaaa',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'drying') return blendLight(LIGHTS.midmorn, LIGHTS.noon, smooth(ramp(f, 568, 671)));
  if (S.id === 'cloudy') return blendLight(LIGHTS.noon, LIGHTS.grey, smooth(ramp(f, 875, 905)));
  if (S.id === 'reset') return blendLight(LIGHTS.grey, LIGHTS.eve, smooth(ramp(f, 966, 1030)));
  if (S.id === 'hookq') return blendLight(LIGHTS.eve, LIGHTS.dusk, smooth(ramp(f, 1348, 1420)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -0.5];
export const BELL = { x: 0, z: -2, hangY: 3.02 };
export const PEG = { x: 3.9, z: -0.8 };
export const LOTA = { x: 3.45, z: -0.3 };
export const BUSH = { x: -3.85, z: 1.45 };
const PRIEST_EVE = [2.3, 1.9];
const PRIEST_PEG = [3.05, 0.3];

// ---------- the mechanism: hammer angle, rope sag, wetness ----------
// Stick-slip creep steps during L8 (frames, target angle after each step)
const CREEP_STEPS = [[690, 0.028], [712, 0.055], [733, 0.082], [750, 0.10]];
const STRIKE_F = 845;
export const hammerAngAt = (f) => {
  if (f < 672) return 0;
  if (f < 760) { let a = 0; for (const [sf, sa] of CREEP_STEPS) a = Math.max(a, sa * smooth(ramp(f, sf, sf + 5))); return a; }
  if (f < STRIKE_F - 3) return lerp(0.10, 0.118, ramp(f, 760, STRIKE_F - 3));
  if (f < STRIKE_F) return lerp(0.118, 0.128, ramp(f, STRIKE_F - 3, STRIKE_F));
  if (f < 966) { const u = (f - STRIKE_F) / 30; return 0.055 + 0.073 * Math.exp(-u * 1.4) * Math.cos(u * 9); }  // recoil bounce, settles held at 0.055
  if (f < 1066) return lerp(0.055, 0, smooth(ramp(f, 1010, 1066)));   // the priest re-seats the arm by hand
  return 0;
};
export const ropeSagAt = (f) => {
  let sag;
  if (f < 620) sag = 0.34;
  else if (f < 672) sag = lerp(0.34, 0.26, ramp(f, 620, 672));
  else if (f < 760) sag = lerp(0.26, 0.055, ramp(f, 672, 760));
  else if (f < STRIKE_F) sag = lerp(0.055, 0.015, ramp(f, 760, STRIKE_F));
  else if (f < 966) { const u = (f - STRIKE_F) / 30; sag = 0.075 + 0.05 * Math.exp(-u * 1.2) * Math.abs(Math.sin(u * 9)); }  // rope trembles after the strike
  else sag = lerp(0.075, 0.34, smooth(ramp(f, 1000, 1076)));
  return sag;
};
export const wetAt = (f) => {
  if (f < 580) return 1;
  if (f < 672) return lerp(1, 0.3, ramp(f, 580, 665));
  if (f < 875) return 0.25;
  if (f < 966) return lerp(0.25, 0.85, ramp(f, 890, 950));
  return lerp(0.85, 1, ramp(f, 1000, 1060));
};
const STRIKES = [[150, 0.055], [STRIKE_F, 0.115]];
export const bellAngAt = (f) => {
  let a = 0.004 * Math.sin(f * 0.05);
  for (const [f0, A] of STRIKES) if (f >= f0) { const u = (f - f0) / 30; a += A * Math.sin(u * 7.4) * Math.exp(-u * 0.55); }
  return a;
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const glintAt = (f) => segMax(f, [
  [138, 152, 168, 182, 0.8], [600, 622, 645, 668, 0.5], [836, 848, 866, 884, 1],
  [1000, 1018, 1042, 1062, 0.35], [1180, 1200, 1224, 1242, 0.4],
]);
export const steamAt = (f) => segMax(f, [[575, 610, 720, 762, 0.8]]);
export const shimmerAt = (f) => Math.max(segMax(f, [[700, 730, 838, 874, 0.9]]), segMax(f, [[115, 140, 190, 204, 0.4]]));
export const cloudAt = (f) => {
  if (f < 875) return 0;
  if (f < 966) return ramp(f, 878, 908) * (1 - ramp(f, 938, 965) * 0.75);
  if (f < 1243) return 0.25 * (1 - ramp(f, 1155, 1242));
  if (f < 1348) return 0.3 * (1 - ramp(f, 1320, 1347) * 0.5);
  return 0.15 * (1 - ramp(f, 1421, 1472));
};
export const pourAt = (f) => segMax(f, [[995, 1015, 1035, 1058, 1]]);
export const lampAt = (f) => f < 966 ? 0 : ramp(f, 970, 1010) * (f >= 1421 ? lerp(0.85, 1, ramp(f, 1421, 1472)) : 0.85);

// ---------- cast positions ----------
const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const YOUTH_KEYS = [[0, -1.8, 4.6], [299, -1.8, 4.6], [362, BUSH.x, BUSH.z], [1472, BUSH.x, BUSH.z]];
export const youthAt = (f) => { const [x, z] = walkKeys(YOUTH_KEYS, f); return { x, z }; };
export const youthMode = (f) => (f >= 300 && f <= 362) ? 'stroll' : (f >= 363 ? 'sit' : 'stand');

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.8, -2],
  noonempty: () => [0, 2.1, -2],
  villagers: () => [0.4, 1.2, 3.5],
  sneak: () => { const y = youthAt(330); return [y.x, 0.9, y.z]; },
  rope: () => [2.7, 1.1, -1.4],
  wet: () => [2.7, 1.1, -1.4],
  drying: () => [1.3, 1.9, -2],
  creep: () => [0.8, 2.0, -2],
  strike: () => [0, 2.1, -2],
  cloudy: () => [0.3, 1.6, -1.5],
  reset: () => [PRIEST_PEG[0], 1.1, PRIEST_PEG[1]],
  ask: () => [PRIEST_EVE[0], 1.35, PRIEST_EVE[1]],
  dialogue: () => [PRIEST_EVE[0], 1.45, PRIEST_EVE[1]],
  knowing: () => [0.6, 1.3, 3.2],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: v4 ACTION CAMERA (2026-11-19 upgrade) ----------
// Zack D Films action level, proven on waterrun-hindi / fireless-hindi:
// camera velocity keyed to the subject, fast eased push-ins at action
// starts (subject scale x2-3 inside ~15 frames of travel), tracking at
// subject speed, impact kicks on the two strikes, clause-boundary cuts
// only, NO slow drift, NO static holds, and every position stays in the
// FRONT hemisphere (south / front three-quarter) — never behind a card.
// Shot boundaries, clause timings and the stem are UNCHANGED; only the
// camera path inside each shot was rebuilt. R2 framing: the bell (the
// opening hero) is BIG from frame 0 at a low angle; inserts fill the
// frame; the dialogue close-up holds the priest's face at ~75% width;
// the final frame carries the hook board (86% width, fully inside with
// margins) WITH the priest standing foreground-left, mouth closed.
const bellPos = () => [BELL.x, 2.1, BELL.z];
const priestPos = (f) => shotAt(f).id === 'reset' ? [PRIEST_PEG[0], 0, PRIEST_PEG[1]] : [PRIEST_EVE[0], 0, PRIEST_EVE[1]];
const youthPos = (f) => { const y = youthAt(f); return [y.x, 0, y.z]; };
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [2.2, 1.85, 3.2], look: [0, 2.2, -2], fov: 40 },
    { f: 28, pos: [1.2, 3.4, 9.8], look: [0, 3.0, -0.5], fov: 48 },
    { f: 82, pos: [0.9, 3.3, 9.6], look: [0, 3.0, -0.6], fov: 47 },
    { f: 114, pos: [2.6, 2.0, 2.2], look: [0, 2.15, -2], fov: 40, ease: 'surge' }] }) },
  noonempty: { cut: 'hard', raw: keysCam({ keys: [
    { f: 115, pos: [3.4, 2.3, 3.4], look: [0, 2.2, -2], fov: 38 },
    { f: 204, pos: [2.5, 2.05, 1.6], look: [0, 2.15, -2], fov: 34, ease: 'surge' }] }) },
  villagers: { cut: 'hard', raw: pushInCam({ subject: () => [0.15, 0, 3.6], a: 205, b: 287, d0: 4.6, d1: 3.3, h0: 1.45, h1: 1.38, lookOff: [0, 1.35, 0], fov0: 40, fov1: 36,
    dir: () => [0.25, 0.97] }) },
  sneak: { cut: 'hard', raw: keysCam({ keys: [
    { f: 288, pos: [0.6, 1.9, 9.0], look: [-1.8, 1.0, 4.6], fov: 40 },
    { f: 330, pos: [-1.2, 1.6, 7.2], look: [-3.0, 0.9, 2.6], fov: 37 },
    { f: 362, pos: [-1.9, 1.45, 5.6], look: [-3.85, 0.85, 1.45], fov: 35 },
    { f: 387, pos: [-2.2, 1.4, 5.2], look: [-3.85, 0.85, 1.45], fov: 33, ease: 'surge' }] }) },
  rope: { cut: 'hard', raw: keysCam({ keys: [
    { f: 388, pos: [5.6, 1.7, 2.4], look: [3.3, 1.0, -1.3], fov: 34 },
    { f: 497, pos: [5.2, 1.35, 1.7], look: [3.85, 0.4, -0.85], fov: 30, ease: 'surge' }] }) },
  wet: { cut: 'hard', raw: keysCam({ keys: [
    { f: 498, pos: [5.8, 1.8, 2.9], look: [3.25, 0.95, -1.35], fov: 35 },
    { f: 567, pos: [5.5, 1.5, 2.3], look: [3.3, 0.8, -1.3], fov: 32, ease: 'surge' }] }) },
  drying: { cut: 'hard', raw: pushInCam({ subject: () => [1.3, 1.9, -2], a: 568, b: 671, d0: 4.2, d1: 3.0, h0: 1.95, h1: 1.85, lookOff: [0, 0.05, 0], fov0: 35, fov1: 30,
    dir: () => [0.72, 0.66] }) },
  creep: { cut: 'hard', raw: keysCam({ keys: [
    { f: 672, pos: [2.5, 2.25, 1.5], look: [0.5, 2.05, -2], fov: 30 },
    { f: 759, pos: [2.15, 2.15, 0.9], look: [0.42, 2.08, -2], fov: 26, ease: 'surge' }] }) },
  strike: { cut: 'hard', raw: pushInCam({ subject: bellPos, a: 760, b: 874, d0: 4.8, d1: 3.1, h0: 2.15, h1: 2.0, lookOff: [0, 0.12, 0], fov0: 37, fov1: 32,
    dir: () => [0.6, 0.78] }) },
  cloudy: { cut: 'hard', raw: keysCam({ keys: [
    { f: 875, pos: [7.2, 3.2, 10.2], look: [0.3, 1.7, -1.5], fov: 42 },
    { f: 965, pos: [6.6, 3.0, 9.4], look: [0.3, 1.65, -1.5], fov: 40, ease: 'surge' }] }) },
  reset: { cut: 'hard', raw: pushInCam({ subject: priestPos, a: 966, b: 1084, d0: 4.4, d1: 3.3, h0: 1.5, h1: 1.4, lookOff: [0.3, 1.0, -0.3], fov0: 39, fov1: 35,
    dir: () => [0.5, 0.84] }) },
  ask: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1085, pos: [4.4, 2.2, 8.2], look: [1.25, 1.32, 1.7], fov: 39 },
    { f: 1154, pos: [4.0, 2.1, 7.5], look: [1.35, 1.38, 1.6], fov: 36, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: priestPos, a: 1155, b: 1242, d0: 3.1, d1: 2.55, h0: 1.55, h1: 1.5, lookOff: [0, 1.42, 0], fov0: 30, fov1: 27,
    dir: () => [0.42, 0.88] }) },
  knowing: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1243, pos: [5.2, 2.15, 9.4], look: [1.1, 1.45, 3.0], fov: 42 },
    { f: 1300, pos: [4.4, 2.3, 8.2], look: [0.6, 2.6, -0.6], fov: 40 },
    { f: 1347, pos: [4.9, 2.2, 9.0], look: [1.1, 1.9, 2.4], fov: 41, ease: 'surge' }] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1348, pos: [0.4, 2.7, 11.6], look: [0, 3.02, -0.5], fov: 43 },
    { f: 1420, pos: [0.35, 2.72, 11.55], look: [0, 3.03, -0.5], fov: 43, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1421, pos: [0.35, 2.72, 11.55], look: [0, 3.03, -0.5], fov: 43 },
    { f: 1472, pos: [0.3, 2.74, 11.5], look: [0, 3.04, -0.5], fov: 43, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 150, a: 0.025 }, { f: STRIKE_F, a: 0.035 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'hookq'].includes(S.id)) cinf = 1.4;
  if (['rope', 'wet', 'creep', 'dialogue'].includes(S.id)) cinf = 3.6;
  if (S.id === 'strike') cinf = 3.2;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    bellAng: bellAngAt(f), hammerAng: hammerAngAt(f), ropeSag: ropeSagAt(f), wetK: wetAt(f),
    glintK: glintAt(f), steamK: steamAt(f), shimmerK: shimmerAt(f), cloudK: cloudAt(f),
    dripK: wetAt(f) * (1 - ramp(f, 600, 660)), pourK: pourAt(f), lampK: lampAt(f),
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 26, 36)) * (1 - smooth(ramp(f, 72, 82)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1392, 1416));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: steamAt(f), shimmerRate: shimmerAt(f), grey: S.light === 'grey' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { noon: '#ffffff', morn: '#fff2dd', midmorn: '#fff6e6', grey: '#c3ccd4', eve: '#f2ddc4', dusk: '#e8cdb2' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  priest: { jacket: '#e07b24', pants: '#f3ead8', boots: '#6a4a2a', hat: 'hair', hair: '#cfc8bd', skin: '#8a5a34', moustache: '#cfc8bd' },
  youth: { jacket: '#3a6ea5', pants: '#4a3a2c', boots: '#241a12', hat: 'cap', cap: '#c84a3a', skin: '#a06a3c' },
  v1: { jacket: '#6a8a3a', pants: '#5a4632', boots: '#2c2015', hat: 'hair', hair: '#241a12', skin: '#8a5a34' },
  v2: { jacket: '#7a4a6e', pants: '#3a3242', boots: '#1c1712', hat: 'hair', hair: '#17100c', skin: '#c98a5a', moustache: '#241a12' },
  v3: { jacket: '#a03a2e', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#3a6ea5', skin: '#a06a3c' },
};
// ---------- ANIMATION UPGRADE v1+v2 (body.js, kit Library v6) ----------
// Continuous life on EVERY figure (breath + weight-shift tilt + sway,
// phase-offset per seed — nobody stands like a post), emotion morphs at
// clause beats (emoTrack over faceP: brow/cheek shading morphs WITH the
// expression — the v2 skin reaction), the priest's dialogue gesture
// (gestureAt — his free hand talks with the line) and his physical grip
// on the lota (gripAt lift/place timed to the pour in main.js, so hand
// and vessel rise and settle in the same frames). The youth's walk
// phase comes from distance travelled (stridePh — feet plant, no
// glide). Hair is part of the head blob in this card system: the head
// tilt/breath offsets above move the hair mass with the head, and the
// squash pulses on grip/landing beats spring it with the body.
const LIFE = { priest: lifeAt({ seed: 91 }), youth: lifeAt({ seed: 71 }), v1: lifeAt({ seed: 81 }), v2: lifeAt({ seed: 82 }), v3: lifeAt({ seed: 83 }) };
const EMO = {
  priest: emoTrack(T.faceP, 'smile', [[0, 'smile', 1], [966, 'stern', 10], [1046, 'smile', 12], [1348, 'smile_closed', 10]]),
  youth: emoTrack(T.faceP, 'neutral', [[0, 'neutral', 1], [205, 'smile', 10], [288, 'nervous', 12], [672, 'shock', 8], [770, 'shock', 6], [880, 'neutral', 12], [1243, 'smile', 10]]),
  v1: emoTrack(T.faceP, 'neutral', [[0, 'smile', 1], [875, 'neutral', 10], [1243, 'smile', 10]]),
  v2: emoTrack(T.faceP, 'neutral', [[0, 'neutral', 1], [875, 'nervous', 10], [1243, 'smile_closed', 10]]),
  v3: emoTrack(T.faceP, 'smile', [[0, 'smile', 1]]),
};
const PRIEST_GRIP = gripAt([{ f0: 988, dur: 12, type: 'lift' }, { f0: 1046, dur: 12, type: 'place', settle: 9 }]);
const PRIEST_GESTURE = gestureAt([{ a: 1155, b: 1242, beats: [1172, 1198, 1224], base: 0.45, amp: 0.15 }]);
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    const lf = LIFE[id] ? LIFE[id](f) : { breath: f, tilt: 0, sway: 0 };
    const o2 = { breath: Math.round(lf.breath / 6) * 6, tilt: q((opts.tilt || 0) + lf.sway, 2), headTilt: q((opts.headTilt || 0) + lf.tilt * 0.35, 2), ...opts };
    if (opts.breath !== undefined) o2.breath = opts.breath;
    out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
      actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(o2), draw: (p) => T.bodyFront(p, o, o2), x, y: 0, z, ground: 0, tint, ...extra }) });
  };
  const y = youthAt(f);
  const youthWatch = (expr) => std('youth', OUTFITS.youth, { exprP: { ...EMO.youth.at(f), cheek: 0.45 }, mode: 'sit', blink: blinkAt(f, 71), seed: 71, headTilt: 0.05, look: -0.3, lookY: 0.2 }, y.x, y.z, { yaw: -0.5 });
  switch (S.id) {
    case 'drone': {
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81 }, 0.2, 3.3, { yaw: 0.3 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 82), seed: 82 }, 1.3, 3.9, { yaw: -0.2 });
      break;
    }
    case 'noonempty': break;   // the point of the beat: NOBODY is there
    case 'villagers': {
      const nod = 0.05 + 0.03 * Math.sin(f * 0.11);
      std('v1', OUTFITS.v1, { exprP: { ...EMO.v1.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: q(nod, 2) }, 0.2, 3.3, { yaw: 0.35 });
      std('v2', OUTFITS.v2, { exprP: { ...EMO.v2.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: q(nod * 0.8, 2) }, 1.15, 3.7, { yaw: -0.25 });
      std('v3', OUTFITS.v3, { exprP: { ...EMO.v3.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 83), seed: 83, prop: f < 250 ? ['point', 0.6] : null }, -0.7, 3.6, { yaw: 0.5 });
      break;
    }
    case 'sneak': {
      const mode = youthMode(f);
      const ph = mode === 'stroll' ? q(stridePh(-1.8, y.x, 1.05), 2) : 0;
      std('youth', OUTFITS.youth, { exprP: { ...EMO.youth.at(f), cheek: 0.45 }, mode, phase: ph, blink: blinkAt(f, 71), seed: 71, look: -0.25, lookY: 0.15 }, y.x, y.z, { yaw: -0.4 });
      break;
    }
    case 'rope': case 'wet': youthWatch('nervous'); break;
    case 'drying': youthWatch('nervous'); break;
    case 'creep': youthWatch('shock'); break;
    case 'strike': {
      std('youth', OUTFITS.youth, { exprP: { ...EMO.youth.at(f), cheek: 0.45 }, mode: 'sit', blink: blinkAt(f, 71), seed: 71, headTilt: -0.06, look: -0.3, lookY: 0.2 }, y.x, y.z, { yaw: -0.5 });
      break;
    }
    case 'cloudy': {
      std('youth', OUTFITS.youth, { exprP: { ...EMO.youth.at(f), cheek: 0.45 }, mode: 'sit', blink: blinkAt(f, 71), seed: 71, headTilt: f >= 920 ? 0.22 : 0.05, look: -0.2, lookY: 0.1 }, y.x, y.z, { yaw: -0.5 });
      std('v1', OUTFITS.v1, { exprP: { ...EMO.v1.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: -0.08 }, -0.8, 1.8, { yaw: 0.3 });
      std('v2', OUTFITS.v2, { exprP: { ...EMO.v2.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: -0.08 }, 0.9, 2.2, { yaw: -0.3 });
      break;
    }
    case 'reset': {
      const pour = pourAt(f);
      const grip = PRIEST_GRIP(f);
      std('priest', OUTFITS.priest, { exprP: { ...EMO.priest.at(f), cheek: 0.45 }, mode: 'stand', blink: blinkAt(f, 91), seed: 91,
        prop: grip.holding || grip.k > 0.03 ? ['point', q(grip.k, 2)] : (f >= 1010 && f <= 1066 ? ['point', 0.7] : null),
        squash: q(Math.max(grip.squash, pour > 0.05 ? 0.03 : 0), 2), headTilt: pour > 0.05 ? 0.14 : 0.04, look: 0.3, lookY: -0.25 }, PRIEST_PEG[0], PRIEST_PEG[1], { yaw: 0.55 });
      break;
    }
    case 'ask': {
      std('priest', OUTFITS.priest, { exprP: { ...EMO.priest.at(f), cheek: 0.45 }, mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, PRIEST_EVE[0], PRIEST_EVE[1], { yaw: -0.35 });
      std('v1', OUTFITS.v1, { exprP: { ...EMO.v1.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 81), seed: 81, prop: f < 1120 ? ['point', 0.5] : null }, 0.6, 3.2, { yaw: 0.45 });
      std('v2', OUTFITS.v2, { exprP: { ...EMO.v2.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 82), seed: 82 }, 1.5, 3.85, { yaw: 0.2 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the priest PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the
      // villagers only listen (their mouths never open). His free hand
      // gestures with the voice (gestureAt) — he does not stand like a
      // post while he speaks.
      const gest = PRIEST_GESTURE(f);
      std('priest', OUTFITS.priest, { mode: 'stand', blink: blinkAt(f, 91), seed: 91, look: 0.12, prop: gest.on ? ['point', q(gest.k, 2)] : null, ...speakFace('smile', f) }, PRIEST_EVE[0], PRIEST_EVE[1], { yaw: -0.3 });
      std('v1', OUTFITS.v1, { exprP: { ...EMO.v1.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 81), seed: 81 }, 0.6, 3.2, { yaw: 0.45 });
      std('v2', OUTFITS.v2, { exprP: { ...EMO.v2.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 82), seed: 82 }, 1.5, 3.85, { yaw: 0.2 });
      break;
    }
    case 'knowing': {
      std('priest', OUTFITS.priest, { exprP: { ...EMO.priest.at(f), cheek: 0.45 }, mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, PRIEST_EVE[0], PRIEST_EVE[1], { yaw: -0.35 });
      std('v1', OUTFITS.v1, { exprP: { ...EMO.v1.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: f >= 1262 && f <= 1320 ? -0.16 : 0 }, 0.6, 3.2, { yaw: 0.4 });
      std('v2', OUTFITS.v2, { exprP: { ...EMO.v2.at(f), cheek: 0.4 }, mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: f >= 1262 && f <= 1320 ? -0.14 : 0 }, 1.5, 3.85, { yaw: 0.15 });
      break;
    }
    case 'hookq': case 'hook': {
      // R2 FINAL: character beat + hook board TOGETHER. The priest stands
      // foreground-left of the board, present but SILENT — the last line
      // is narration only (END RULE): mouth closed (smile_closed faceP,
      // no speak data), gaze up at the board.
      std('priest', OUTFITS.priest, { exprP: { ...EMO.priest.at(f), cheek: 0.45 }, mode: 'stand', blink: blinkAt(f, 91), seed: 91, look: 0.25, lookY: 0.3, headTilt: -0.05 }, -0.2, 7.4, { yaw: 0.3 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-7.5, 7.5, -13.8, -7.4, { h: 0.55, id: 'platform' }),
  SOL.aabb(-5.5, 5.5, -14.2, -13.0, { h: 5, id: 'sanctum' }),
  SOL.aabb(-5.8, -4.6, -13.9, -8.5, { h: 3.4, id: 'wingW' }),
  SOL.aabb(4.6, 5.8, -13.9, -8.5, { h: 3.4, id: 'wingE' }),
  SOL.aabb(-14.1, -12.9, -12, 10, { h: 1.5, id: 'wallW' }),
  SOL.aabb(12.9, 14.1, -12, 10, { h: 1.5, id: 'wallE' }),
  SOL.circle(-3.4, -8.6, 0.36, { h: 4.6, id: 'pillar' }),
  SOL.circle(3.4, -8.6, 0.36, { h: 4.6, id: 'pillar' }),
  SOL.circle(-1.15, BELL.z, 0.4, { h: 3.1, id: 'bellpost' }),
  SOL.circle(1.15, BELL.z, 0.4, { h: 3.1, id: 'bellpost' }),
  SOL.circle(1.85, BELL.z, 0.3, { h: 1.9, id: 'pivotpost' }),
  SOL.circle(PEG.x, PEG.z, 0.1, { h: 0.34, id: 'peg' }),
  SOL.obb(LOTA.x, LOTA.z, 0, 0.28, 0.28, { h: 0.3, id: 'lotablock' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
