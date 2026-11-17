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

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const bellPos = () => [BELL.x, 2.1, BELL.z];
const priestPos = (f) => shotAt(f).id === 'reset' ? [PRIEST_PEG[0], 0, PRIEST_PEG[1]] : [PRIEST_EVE[0], 0, PRIEST_EVE[1]];
const youthPos = (f) => { const y = youthAt(f); return [y.x, 0, y.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[20, 12, 24], [12, 7, 17], [8.5, 4.2, 13], [6.8, 2.9, 10.6]],
    [[0, 2.6, -6], [0, 2.0, -3.4], [0, 1.6, -2.4], [0, 1.7, -2.2]], 0, 114, 44, 40) },
  noonempty: { cut: 'hard', raw: keysCam({ keys: [
    { f: 115, pos: [5.4, 2.6, 7.6], look: [0, 2.2, -2], fov: 40 },
    { f: 204, pos: [4.6, 2.3, 6.4], look: [0, 2.15, -2], fov: 36, ease: 'surge' }] }) },
  villagers: { cut: 'hard', raw: pushInCam({ subject: () => [0.15, 0, 3.6], a: 205, b: 287, d0: 6.2, d1: 5.2, h0: 1.5, h1: 1.4, lookOff: [0, 1.3, 0], fov0: 42, fov1: 38,
    dir: () => [0.3, 0.92] }) },
  sneak: { cut: 'hard', raw: keysCam({ keys: [
    { f: 288, pos: [-0.6, 2.3, 8.6], look: [-1.8, 1.0, 4.6], fov: 42 },
    { f: 340, pos: [-1.7, 2.1, 6.9], look: [-3.2, 0.9, 2.2], fov: 39 },
    { f: 387, pos: [-2.4, 1.9, 5.9], look: [-3.85, 0.8, 1.45], fov: 37, ease: 'surge' }] }) },
  rope: { cut: 'hard', raw: keysCam({ keys: [
    { f: 388, pos: [5.2, 2.0, 2.6], look: [3.2, 1.1, -1.4], fov: 36 },
    { f: 497, pos: [5.4, 1.5, 2.0], look: [3.9, 0.35, -0.8], fov: 33, ease: 'surge' }] }) },
  wet: { cut: 'hard', raw: staticTrackCam({ pos: [5.6, 1.9, 3.1], subject: () => [3.2, 1.05, -1.4], lookOff: [0, 0.1, 0], fov: 36 }) },
  drying: { cut: 'hard', raw: pushInCam({ subject: () => [1.3, 1.9, -2], a: 568, b: 671, d0: 4.6, d1: 3.6, h0: 1.9, h1: 1.8, lookOff: [0, 0.1, 0], fov0: 36, fov1: 31,
    dir: () => [0.75, 0.62] }) },
  creep: { cut: 'hard', raw: keysCam({ keys: [
    { f: 672, pos: [2.6, 2.2, 1.6], look: [0.45, 2.05, -2], fov: 32 },
    { f: 759, pos: [2.35, 2.15, 1.25], look: [0.4, 2.08, -2], fov: 29, ease: 'surge' }] }) },
  strike: { cut: 'hard', raw: pushInCam({ subject: bellPos, a: 760, b: 874, d0: 5.6, d1: 4.2, h0: 2.2, h1: 2.0, lookOff: [0, 0.15, 0], fov0: 38, fov1: 33,
    dir: () => [0.62, 0.75] }) },
  cloudy: { cut: 'hard', raw: keysCam({ keys: [
    { f: 875, pos: [8.8, 3.6, 11.5], look: [0.3, 1.6, -1.5], fov: 44 },
    { f: 965, pos: [8.3, 3.4, 10.9], look: [0.3, 1.6, -1.5], fov: 42, ease: 'surge' }] }) },
  reset: { cut: 'hard', raw: pushInCam({ subject: priestPos, a: 966, b: 1084, d0: 5.2, d1: 4.4, h0: 1.5, h1: 1.42, lookOff: [0.35, 1.05, -0.35], fov0: 40, fov1: 36,
    dir: () => [0.55, 0.8] }) },
  ask: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1085, pos: [4.6, 2.3, 8.6], look: [1.2, 1.3, 1.6], fov: 40 },
    { f: 1154, pos: [4.3, 2.2, 8.1], look: [1.3, 1.35, 1.5], fov: 37, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: priestPos, a: 1155, b: 1242, d0: 3.3, d1: 2.7, h0: 1.56, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  knowing: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1243, pos: [5.4, 2.2, 9.8], look: [1.1, 1.5, 3.0], fov: 44 },
    { f: 1300, pos: [5.3, 2.3, 9.6], look: [1.0, 3.6, 0.8], fov: 43 },
    { f: 1347, pos: [5.1, 2.3, 9.4], look: [1.1, 2.0, 2.2], fov: 42, ease: 'surge' }] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1348, pos: [7.56, 3.02, 10.88], look: [0.1, 2.95, -0.45], fov: 40 },
    { f: 1420, pos: [7.11, 3.14, 10.62], look: [0.05, 3.0, -0.48], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1421, pos: [7.11, 3.14, 10.62], look: [0.05, 3.0, -0.48], fov: 37 },
    { f: 1472, pos: [6.95, 3.19, 10.47], look: [0.02, 3.05, -0.49], fov: 36, ease: 'surge' }] }) },
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
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 42)) * (1 - smooth(ramp(f, 66, 84)));
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
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const y = youthAt(f);
  const youthWatch = (expr) => std('youth', OUTFITS.youth, { expr, mode: 'sit', blink: blinkAt(f, 71), seed: 71, headTilt: 0.05 }, y.x, y.z, { yaw: -0.5 });
  switch (S.id) {
    case 'drone': {
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81 }, 0.2, 3.3, { yaw: 0.3 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 82), seed: 82 }, 1.3, 3.9, { yaw: -0.2 });
      break;
    }
    case 'noonempty': break;   // the point of the beat: NOBODY is there
    case 'villagers': {
      const nod = 0.05 + 0.03 * Math.sin(f * 0.11);
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: q(nod, 2) }, 0.2, 3.3, { yaw: 0.35 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: q(nod * 0.8, 2) }, 1.15, 3.7, { yaw: -0.25 });
      std('v3', OUTFITS.v3, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 83), seed: 83, prop: f < 250 ? ['point', 0.6] : null }, -0.7, 3.6, { yaw: 0.5 });
      break;
    }
    case 'sneak': {
      const mode = youthMode(f);
      std('youth', OUTFITS.youth, { expr: f >= 363 ? 'nervous' : 'neutral', mode, phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 71), seed: 71 }, y.x, y.z, { yaw: -0.4 });
      break;
    }
    case 'rope': case 'wet': youthWatch('nervous'); break;
    case 'drying': youthWatch('nervous'); break;
    case 'creep': youthWatch('shock'); break;
    case 'strike': {
      std('youth', OUTFITS.youth, { expr: 'shock', mode: 'sit', blink: blinkAt(f, 71), seed: 71, headTilt: -0.06 }, y.x, y.z, { yaw: -0.5 });
      break;
    }
    case 'cloudy': {
      std('youth', OUTFITS.youth, { expr: 'neutral', mode: 'sit', blink: blinkAt(f, 71), seed: 71, headTilt: f >= 920 ? 0.22 : 0.05 }, y.x, y.z, { yaw: -0.5 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: -0.08 }, -0.8, 1.8, { yaw: 0.3 });
      std('v2', OUTFITS.v2, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: -0.08 }, 0.9, 2.2, { yaw: -0.3 });
      break;
    }
    case 'reset': {
      const pour = pourAt(f);
      std('priest', OUTFITS.priest, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: pour > 0.05 ? ['point', 0.45] : (f >= 1010 && f <= 1066 ? ['point', 0.7] : null), headTilt: pour > 0.05 ? 0.14 : 0.04 }, PRIEST_PEG[0], PRIEST_PEG[1], { yaw: 0.55 });
      break;
    }
    case 'ask': {
      std('priest', OUTFITS.priest, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, PRIEST_EVE[0], PRIEST_EVE[1], { yaw: -0.35 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 81), seed: 81, prop: f < 1120 ? ['point', 0.5] : null }, 0.6, 3.2, { yaw: 0.45 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 82), seed: 82 }, 1.5, 3.85, { yaw: 0.2 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the priest PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the
      // villagers only listen (their mouths never open).
      std('priest', OUTFITS.priest, { mode: 'stand', blink: blinkAt(f, 91), seed: 91, look: 0.12, ...speakFace('smile', f) }, PRIEST_EVE[0], PRIEST_EVE[1], { yaw: -0.3 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81 }, 0.6, 3.2, { yaw: 0.45 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 82), seed: 82 }, 1.5, 3.85, { yaw: 0.2 });
      break;
    }
    case 'knowing': {
      std('priest', OUTFITS.priest, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, PRIEST_EVE[0], PRIEST_EVE[1], { yaw: -0.35 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: f >= 1262 && f <= 1320 ? -0.16 : 0 }, 0.6, 3.2, { yaw: 0.4 });
      std('v2', OUTFITS.v2, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: f >= 1262 && f <= 1320 ? -0.14 : 0 }, 1.5, 3.85, { yaw: 0.15 });
      break;
    }
    case 'hookq': case 'hook': break;
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
