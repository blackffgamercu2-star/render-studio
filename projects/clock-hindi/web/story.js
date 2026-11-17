// Shot plan for "हमेशा सही बताने वाली घड़ी" — clock-hindi (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 8 H2, Kahani Me Twist. ONE set: a village
// square under a monsoon-grey sky, dominated by the old clock tower. The
// tower clock has been stopped for 30 years yet is never wrong: its hands
// are PAINTED on a wooden board, the inside is hollow, and the keeper
// rings the bell by the sun's shadow on a marked stone (a dripping water
// clock on cloudy days). The village refuses a new clock.
// Voice stem: 47.931 s, 30 fps, TOTAL 1438; timings from faster-whisper
// small word alignment (words.json / timing.json — Hindi spellings are
// timings only; board text is verbatim from script_hi.txt). Scene changes
// ONLY at clause boundaries (P[] = script-line start frames):
//   L1  घड़ी तीस साल से रुकी...   L10 परछाई निशान छूते ही...घंटी बजा देता था।
//   L2  सुइयाँ बारह बजे...         L11 बादल वाले दिन...पानी की घड़ी...
//   L3  किसान, दुकानदार, बच्चे...  L12 गाँव वालों ने पूछा...राज़ छिपाया क्यों।
//   L4  घड़ीसाज़...मीनार पर चढ़ा।  L13 तब रखवाले ने कहा। (tag — mouth closed)
//   L5  अंदर कोई पुर्ज़ा नहीं था।   L14 "घड़ी ने कभी झूठ नहीं बोला..." (DIALOGUE)
//   L6  सुइयाँ...रंग से बनी थीं।    L15 गाँव ने नई घड़ी से मना कर दिया।
//   L7  घंटी ठीक समय पर कैसे?      L16 मशीन रुक सकती है, सूरज और रखवाला नहीं।
//   L8  पत्थर पर...लंबी रेखा।       L17 लेकिन कल...गाड़ी...? (HOOK)
//   L9  रखवाला...परछाई देख रहा था।
// GRADE (FILTER_VFX_LIGHTING pack): Monsoon Grey throughout (dim variant
// on the cloudy water-clock beat, a pale-sun lift for the refusal) —
// grade changes ONLY on clause boundaries. Signature VFX: the sundial
// shadow creeping to the gold bell mark, the bell swinging on its tolls,
// water-clock drips, the painted face swinging open on the hollow tower.
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

export const FPS = 30, TOTAL = 1438, DECK = 0;
// script-line start frames (patched from timing.json phrases)
export const P = [0, 112, 203, 289, 397, 469, 567, 636, 750, 822, 910, 992, 1070, 1099, 1197, 1248, 1328];
export const SHOTS = [
  { id: 'drone', a: P[0], b: P[1] - 1, light: 'grey' },
  { id: 'face', a: P[1], b: P[2] - 1, light: 'grey' },
  { id: 'village', a: P[2], b: P[3] - 1, light: 'grey' },
  { id: 'climb', a: P[3], b: P[4] - 1, light: 'grey' },
  { id: 'tap', a: P[4], b: P[5] - 1, light: 'grey' },
  { id: 'reveal', a: P[5], b: P[6] - 1, light: 'grey' },
  { id: 'question', a: P[6], b: P[7] - 1, light: 'grey' },
  { id: 'sundial', a: P[7], b: P[8] - 1, light: 'grey' },
  { id: 'keeper', a: P[8], b: P[9] - 1, light: 'grey' },
  { id: 'bellpull', a: P[9], b: P[10] - 1, light: 'grey' },
  { id: 'water', a: P[10], b: P[11] - 1, light: 'dim' },
  { id: 'ask', a: P[11], b: P[12] - 1, light: 'dim' },
  { id: 'dialogue', a: P[12], b: P[14] - 1, light: 'grey' },
  { id: 'refuse', a: P[14], b: P[16] - 1, light: 'sun' },
  { id: 'hookq', a: P[16], b: P[16] + 97, light: 'dusk' },
  { id: 'hook', a: P[16] + 98, b: TOTAL - 1, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (Monsoon Grey family) ----------
export const LIGHTS = {
  grey: { az: 215, el: 34, sky: '#b4bcc0', ground: '#5f625c', hemi: 1.32, sun: '#cfd6da', sunI: 1.6, fog: '#aeb6ba', fogNear: 36, fogFar: 280,
    skyTop: '#5d6d7c', skyHor: '#c3c8c2', sunDisc: '#e8ecec', sunSize: 0.0025, sat: 0.68, vig: 0.27, shadowExt: 24, aurora: 0, gain: '#ccd2d4',
    waterDeep: '#24343c', waterShal: '#3c545e', glint: '#cfd8dc' },
  dim: { az: 215, el: 30, sky: '#a7b0b4', ground: '#565a54', hemi: 1.22, sun: '#bfc7cb', sunI: 1.15, fog: '#a2aaae', fogNear: 30, fogFar: 240,
    skyTop: '#525f6c', skyHor: '#b6bab2', sunDisc: '#000000', sunSize: 0, sat: 0.55, vig: 0.28, shadowExt: 24, aurora: 0, gain: '#c2c8ca',
    waterDeep: '#202e34', waterShal: '#35494f', glint: '#c3ced2' },
  sun: { az: 208, el: 36, sky: '#bcc2bc', ground: '#66685e', hemi: 1.2, sun: '#e3ddc8', sunI: 1.9, fog: '#b2bab0', fogNear: 38, fogFar: 290,
    skyTop: '#66788a', skyHor: '#ccd0c0', sunDisc: '#f2ead2', sunSize: 0.004, sat: 0.7, vig: 0.26, shadowExt: 24, aurora: 0, gain: '#d4d8cc',
    waterDeep: '#24343c', waterShal: '#3c545e', glint: '#e6e2cc' },
  dusk: { az: 232, el: 20, sky: '#a8a89e', ground: '#4e4c44', hemi: 1.02, sun: '#d8c9a8', sunI: 1.5, fog: '#a9a294', fogNear: 36, fogFar: 260,
    skyTop: '#46536a', skyHor: '#c9b795', sunDisc: '#eeddB0', sunSize: 0.0035, sat: 0.66, vig: 0.3, shadowExt: 24, aurora: 0, gain: '#d8d2ba',
    waterDeep: '#24343c', waterShal: '#3c545e', glint: '#e6ddba' },
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
  if (S.id === 'water') return blendLight(LIGHTS.grey, LIGHTS.dim, smooth(ramp(f, P[10], P[10] + 40)));
  if (S.id === 'dialogue') return blendLight(LIGHTS.dim, LIGHTS.grey, smooth(ramp(f, P[12], P[12] + 45)));
  if (S.id === 'refuse') return blendLight(LIGHTS.grey, LIGHTS.sun, smooth(ramp(f, P[14], P[14] + 50)));
  if (S.id === 'hookq') return blendLight(LIGHTS.sun, LIGHTS.dusk, smooth(ramp(f, P[16], P[16] + 55)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -2.6];
export const TOWER = { x: 0, z: -10 };
export const FACE = { x: 0, y: 7.55, z: -7.38 };
export const LEDGE = { x: 0, y: 5.9, z: -6.7, w: 3.6, d: 1.1 };
export const SUNDIAL = { x: 4.6, z: -4.6, ry: -0.35 };
export const WATER = { x: -5.2, z: 0.8 };
export const ROPE = { x: 2.3, z: -7.25 };

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// clockmaker: enters west, climbs the ladder (y handled separately),
// works the face from the ledge, climbs down, ends by his crate.
const MAKER_KEYS = [
  [0, -12.8, -0.9], [P[2] + 24, -12.8, -0.9], [P[3] - 1, -5.5, -1.6], [P[4] - 40, 0.9, -4.75],
  [P[5] - 38, 1.55, -6.6], [P[7] - 30, 1.55, -6.6], [P[7] + 26, 0.9, -4.75],
  [P[8], 1.15, -2.3], [P[14], 1.15, -2.3], [P[14] + 52, 3.9, 3.6], [TOTAL - 1, 3.9, 3.6],
];
export const makerAt = (f) => { const [x, z] = walkKeys(MAKER_KEYS, f); return { x, z }; };
// his height: ground 0, ladder climb during [P4-40, P5-38], ledge 5.9,
// down-climb during [P7-30, P7+26]
export const makerY = (f) => {
  if (f < P[4] - 40) return { y: 0, state: 'ground' };
  if (f < P[5] - 38) { const u = smooth(ramp(f, P[4] - 40, P[5] - 38)); return { y: lerp(0, LEDGE.y, u), state: 'climb' }; }
  if (f < P[7] - 30) return { y: LEDGE.y, state: 'ledge' };
  if (f < P[7] + 26) { const u = smooth(ramp(f, P[7] - 30, P[7] + 26)); return { y: lerp(LEDGE.y, 0, u), state: 'climb' }; }
  return { y: 0, state: 'ground' };
};
const KEEPER_KEYS = [
  [0, 2.7, -2.7], [P[7], 2.7, -2.7], [P[8], 2.9, -3.1], [P[9], 2.9, -3.1],
  [P[9] + 11, 1.3, -4.85], [P[9] + 24, 1.55, -6.35], [P[10], 1.55, -6.35], [P[10] + 13, -2.2, -1.55], [P[10] + 26, -4.35, 0.35],
  [P[11], -4.35, 0.35], [P[11] + 30, 3.3, -2.2], [TOTAL - 1, 3.3, -2.2],
];
export const keeperAt = (f) => { const [x, z] = walkKeys(KEEPER_KEYS, f); return { x, z }; };
const FARMER_KEYS = [
  [0, -10.5, -1.6], [P[2], -10.5, -1.6], [P[3] - 12, 10.2, -0.9], [P[11], 10.2, -0.9],
  [P[11] + 34, 4.5, -1.7], [TOTAL - 1, 4.5, -1.7],
];
export const farmerAt = (f) => { const [x, z] = walkKeys(FARMER_KEYS, f); return { x, z }; };
const KID1_KEYS = [[0, -9.5, 7.6], [P[2] + 6, -9.5, 7.6], [P[3] - 16, 9.0, 8.4], [TOTAL - 1, 9.0, 8.4]];
const KID2_KEYS = [[0, -10.6, 8.6], [P[2] + 14, -10.6, 8.6], [P[3] - 8, 7.8, 9.3], [TOTAL - 1, 7.8, 9.3]];
export const kid1At = (f) => { const [x, z] = walkKeys(KID1_KEYS, f); return { x, z }; };
export const kid2At = (f) => { const [x, z] = walkKeys(KID2_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const makerMode = (f) => strolling(f, [[P[2] + 24, P[4] - 40], [P[7] + 26, P[8]], [P[14], P[14] + 52]]) ? 'stroll' : 'stand';
export const keeperMode = (f) => strolling(f, [[P[9], P[9] + 24], [P[10], P[10] + 26], [P[11], P[11] + 30]]) ? 'stroll' : 'stand';
export const farmerMode = (f) => strolling(f, [[P[2], P[3] - 12], [P[11], P[11] + 34]]) ? 'stroll' : 'stand';
export const kidMode = (f) => strolling(f, [[P[2], P[3] - 8]]) ? 'stroll' : 'stand';

// ---------- story-driven world values ----------
const env1 = (f, a, b, c, d, peak = 1) => (f >= a && f <= d) ? peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))) : 0;
export const faceOpenAt = (f) =>
  // he swings it open across the reveal line; it stays open while the
  // village stares, and he eases it shut as he climbs down (question)
  env1(f, P[5] + 6, P[5] + 52, P[6] + 30, P[7] + 10, 1);
export const bellSwingAt = (f) => {
  let s = 0;
  const toll = (t0, peak) => { if (f >= t0 && f <= t0 + 95) s = Math.max(s, peak * Math.exp(-(f - t0) / 34)); };
  toll(P[1] + 38, 1);        // "सुबह की घंटी ठीक छह बजे" — the 6-o'clock toll
  toll(P[9] + 30, 1);        // the shadow touches the mark -> he pulls
  toll(P[9] + 74, 0.8);      // second pull
  toll(P[16] + 8, 0.45);     // a soft toll under the hook
  return s;
};
export const ropePullAt = (f) => Math.max(
  env1(f, P[9] + 18, P[9] + 30, P[9] + 40, P[9] + 54, 1),
  env1(f, P[9] + 62, P[9] + 74, P[9] + 82, P[10] - 6, 0.85));
// shadow progress across the dial: morning creep; the gold BELL mark sits
// at shadowK = 0.78, reached exactly as the bellpull line begins.
export const shadowKAt = (f) => {
  const keys = [[0, 0.1], [P[2], 0.24], [P[4], 0.38], [P[7], 0.55], [P[8], 0.66], [P[9], 0.74], [P[9] + 26, 0.78], [P[11], 0.8], [P[14], 0.83], [TOTAL - 1, 0.9]];
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return lerp(a[1], b[1], smooth(ramp(f, a[0], b[0]))); }
  return 0.9;
};
export const shadowVisAt = (f) => {
  // thick cloud on the water-clock beat: the shadow all but vanishes
  let v = 1;
  if (f >= P[10] && f < P[12]) v = 1 - 0.85 * smooth(ramp(f, P[10], P[10] + 30)) * (f < P[11] + 20 ? 1 : 1 - smooth(ramp(f, P[11] + 20, P[12])));
  return v;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 2.5, -4],
  face: () => [FACE.x, FACE.y, FACE.z],
  village: () => [0, 1.1, 0],
  climb: () => { const m = makerAt(300); return [m.x, 1.2, m.z]; },
  tap: () => [FACE.x, FACE.y, FACE.z],
  reveal: () => [FACE.x - 1.2, FACE.y, FACE.z + 1.6],
  question: () => [0.8, 1.3, -3.4],
  sundial: () => [SUNDIAL.x, 0.4, SUNDIAL.z],
  keeper: () => { const k = keeperAt(P[8] + 30); return [k.x, 1.35, k.z]; },
  bellpull: () => [2.0, 3.0, -6.8],
  water: () => [WATER.x, 0.75, WATER.z],
  ask: () => { const k = keeperAt(P[11] + 40); return [k.x, 1.3, k.z]; },
  dialogue: () => { const k = keeperAt(P[13]); return [k.x, 1.45, k.z]; },
  refuse: () => [3.5, 1.0, 3.4],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const bezierCam = (P_, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P_), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const makerPos = (f) => { const m = makerAt(f); return [m.x, makerY(f).y, m.z]; };
const keeperPos = (f) => { const k = keeperAt(f); return [k.x, 0, k.z]; };
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[24, 14, 30], [14, 8, 21], [9.5, 5, 16], [7.6, 3.4, 13.8]],
    [[0, 4.5, -8], [0, 3.4, -6], [0, 2.2, -3], [0, 1.6, -1]], P[0], P[1] - 1, 44, 40) },
  face: { cut: 'hard', raw: pushInCam({ subject: () => [FACE.x, FACE.y, FACE.z], a: P[1], b: P[2] - 1, d0: 11.5, d1: 8.6, h0: 7.95, h1: 7.7, lookOff: [0, 0, 0], fov0: 38, fov1: 33,
    dir: () => [0.38, 0.92] }) },
  village: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[2], pos: [-7.8, 3.1, 12.6], look: [0.5, 1.0, -1.5], fov: 42 },
    { f: P[3] - 1, pos: [-6.9, 2.9, 11.8], look: [0.8, 1.0, -1.2], fov: 39, ease: 'surge' }] }) },
  climb: { cut: 'hard', raw: pushInCam({ subject: makerPos, a: P[3], b: P[4] - 1, d0: 6.4, d1: 4.6, h0: 1.7, h1: 2.6, lookOff: [0, 1.1, 0], fov0: 40, fov1: 34,
    dir: () => [-0.55, 0.8] }) },
  tap: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[4], pos: [2.3, 7.95, -1.2], look: [FACE.x, FACE.y + 0.17, FACE.z], fov: 32 },
    { f: P[5] - 1, pos: [1.7, 7.85, -2.35], look: [FACE.x - 0.1, FACE.y + 0.13, FACE.z], fov: 29, ease: 'surge' }] }) },
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[5], pos: [2.0, 7.0, 2.8], look: [-0.3, 7.25, -7.5], fov: 40 },
    { f: P[6] - 1, pos: [1.6, 6.85, 1.9], look: [-0.35, 7.3, -7.55], fov: 36, ease: 'surge' }] }) },
  question: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[6], pos: [-5.6, 2.6, 6.4], look: [0.8, 2.2, -5.2], fov: 40 },
    { f: P[7] - 1, pos: [-5.0, 2.45, 5.8], look: [0.8, 1.7, -4.4], fov: 37, ease: 'surge' }] }) },
  sundial: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[7], pos: [7.8, 2.5, 1.4], look: [5.0, 0.3, -4.75], fov: 38 },
    { f: P[8] - 1, pos: [7.3, 2.2, 0.9], look: [4.9, 0.3, -4.8], fov: 34, ease: 'surge' }] }) },
  keeper: { cut: 'hard', raw: pushInCam({ subject: keeperPos, a: P[8], b: P[9] - 1, d0: 4.6, d1: 3.6, h0: 1.6, h1: 1.5, lookOff: [0, 1.35, 0], fov0: 38, fov1: 33,
    dir: () => [-0.6, 0.75] }) },
  bellpull: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[9], pos: [4.7, 2.0, -0.2], look: [1.95, 1.8, -6.5], fov: 42 },
    { f: P[9] + 40, pos: [4.55, 2.15, -0.5], look: [2.0, 2.4, -6.9], fov: 40 },
    { f: P[10] - 1, pos: [4.5, 2.6, -0.8], look: [0.7, 8.6, -8.8], fov: 38, ease: 'surge' }] }) },
  water: { cut: 'hard', raw: pushInCam({ subject: () => [WATER.x + 0.42, 0.8, WATER.z - 0.2], a: P[10], b: P[11] - 1, d0: 5.0, d1: 4.3, h0: 1.5, h1: 1.3, lookOff: [0, 0.05, 0], fov0: 40, fov1: 37,
    dir: () => [0.8, 0.55] }) },
  ask: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[11], pos: [-1.8, 2.2, 3.4], look: [2.6, 1.25, -2.8], fov: 40 },
    { f: P[12] - 1, pos: [-1.4, 2.1, 3.0], look: [2.55, 1.25, -2.85], fov: 37, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: keeperPos, a: P[12], b: P[14] - 1, d0: 3.5, d1: 2.8, h0: 1.6, h1: 1.52, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  refuse: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[14], pos: [7.3, 2.5, 12.3], look: [3.35, 1.0, 2.7], fov: 42 },
    { f: P[16] - 1, pos: [6.8, 2.35, 11.7], look: [3.5, 1.0, 2.4], fov: 38, ease: 'surge' }] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: P[16], pos: [4.4, 3.3, 11.0], look: [0.1, 3.0, -2.58], fov: 40 },
    { f: P[16] + 97, pos: [4.1, 3.35, 10.6], look: [0.05, 3.05, -2.6], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[16] + 98, pos: [4.1, 3.35, 10.6], look: [0.05, 3.05, -2.6], fov: 37 },
    { f: TOTAL - 1, pos: [3.95, 3.4, 10.45], look: [0.02, 3.08, -2.6], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: P[1] + 38, a: 0.03 }, { f: P[9] + 30, a: 0.035 }],
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
  if (['face', 'tap', 'reveal', 'dialogue', 'water'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    faceOpen: faceOpenAt(f), bellSwing: bellSwingAt(f), ropePull: ropePullAt(f),
    shadowK: shadowKAt(f), shadowVis: shadowVisAt(f),
    waterK: 0, crateK: f >= P[3] ? 1 : 0, dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 26, 43)) * (1 - smooth(ramp(f, 58, 76)));
  if (S.id === 'water' || S.id === 'ask') W.waterK = 1;
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, P[16] + 42, P[16] + 66));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: 0, grey: S.light === 'dim' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { grey: '#c3ccd4', dim: '#b6bfc6', sun: '#e8e4da', dusk: '#d8d2ba' };
const tintFor = (S) => TINT[S.light] || '#c3ccd4';
export const OUTFITS = {
  keeper: { jacket: '#6e5b40', pants: '#4c4034', boots: '#2c2118', hat: 'hair', hair: '#cfc8bc', skin: '#a06a3c', moustache: '#cfc8bc' },
  maker: { jacket: '#2e4a68', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#37414e', skin: '#c98a5a' },
  farmer: { jacket: '#66713a', pants: '#54483a', boots: '#2c2118', hat: 'cap', cap: '#b0883a', skin: '#8a5a34' },
  shopkeeper: { jacket: '#8a5a2a', pants: '#3a3230', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#c98a5a', moustache: '#241a12' },
  woman: { jacket: '#96455a', pants: '#5c3244', boots: '#2c1c14', hat: 'hair', hair: '#241610', skin: '#a06a3c' },
  kid1: { jacket: '#b0883a', pants: '#4a3a2a', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#c98a5a' },
  kid2: { jacket: '#4a6a7a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#241610', skin: '#8a5a34' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const kp = keeperAt(f), mk = makerAt(f), my = makerY(f), fa = farmerAt(f), k1 = kid1At(f), k2 = kid2At(f);
  const keeperBase = { expr: 'smile', mode: keeperMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 71), seed: 71 };
  const makerBase = { expr: 'neutral', mode: makerMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 81), seed: 81 };
  // the clockmaker — special entry: his y rides the ladder / ledge
  const makerEntry = (opts, extra = {}) => out.push({ id: 'maker', x: mk.x, y: my.y, z: mk.z, r: 0.32, ground: my.state === 'ledge' ? LEDGE.y : 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(OUTFITS.maker) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, OUTFITS.maker, opts), x: mk.x, y: my.y, z: mk.z, ground: my.state === 'ledge' ? LEDGE.y : 0, tint, ...extra }) });
  switch (S.id) {
    case 'drone': {
      std('keeper', OUTFITS.keeper, { ...keeperBase }, kp.x, kp.z, { yaw: 0.4 });
      std('shopkeeper', OUTFITS.shopkeeper, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, -7.35, 6.35, { yaw: 0.7 });
      std('woman', OUTFITS.woman, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 95), seed: 95 }, 6.1, 0.6, { yaw: -0.4 });
      break;
    }
    case 'face': {
      std('keeper', OUTFITS.keeper, { ...keeperBase }, kp.x, kp.z, { yaw: 0.3 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 96), seed: 96 }, -2.6, -3.4, { yaw: 0.2, s: 0.7 });
      std('kid2', OUTFITS.kid2, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 97), seed: 97 }, -3.3, -2.8, { yaw: 0.3, s: 0.66 });
      break;
    }
    case 'village': {
      makerEntry({ ...makerBase }, { yaw: 1.1 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', mode: farmerMode(f), phase: q((f * 0.013) % 1, 2), blink: blinkAt(f, 85), seed: 85 }, fa.x, fa.z, { yaw: 1.2 });
      std('shopkeeper', OUTFITS.shopkeeper, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: f >= P[2] + 20 ? ['point', 0.5] : null }, -7.35, 6.35, { yaw: 0.7 });
      std('kid1', OUTFITS.kid1, { expr: 'laugh', mode: kidMode(f), phase: q((f * 0.02) % 1, 2), blink: blinkAt(f, 96), seed: 96 }, k1.x, k1.z, { yaw: 1.3, s: 0.7 });
      std('kid2', OUTFITS.kid2, { expr: 'laugh', mode: kidMode(f), phase: q((f * 0.02) % 1, 2), blink: blinkAt(f, 97), seed: 97 }, k2.x, k2.z, { yaw: 1.3, s: 0.66 });
      std('keeper', OUTFITS.keeper, { ...keeperBase }, kp.x, kp.z, { yaw: 0.4 });
      std('woman', OUTFITS.woman, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 95), seed: 95 }, 6.1, 0.6, { yaw: -0.5 });
      break;
    }
    case 'climb': {
      makerEntry({ ...makerBase, expr: f >= P[4] - 52 ? 'stern' : 'neutral' }, { yaw: 0.15 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'neutral' }, kp.x, kp.z, { yaw: 0.5 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 96), seed: 96 }, -3.6, -1.7, { yaw: 0.4, s: 0.7 });
      break;
    }
    case 'tap': {
      makerEntry({ ...makerBase, expr: 'shock', prop: f >= P[4] + 12 && f < P[5] - 20 ? ['point', 0.8] : null }, { yaw: 0.1 });
      break;
    }
    case 'reveal': {
      makerEntry({ ...makerBase, expr: 'shock', headTilt: -0.06 }, { yaw: 0.1 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'smile' }, kp.x, kp.z, { yaw: 0.4 });
      break;
    }
    case 'question': {
      makerEntry({ ...makerBase, expr: 'nervous' }, { yaw: 0.3 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'smile' }, kp.x, kp.z, { yaw: 0.4 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 85), seed: 85, headTilt: -0.14 }, fa.x, fa.z, { yaw: -0.4 });
      std('woman', OUTFITS.woman, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 95), seed: 95, headTilt: -0.14 }, 5.7, -0.5, { yaw: -0.5 });
      break;
    }
    case 'sundial': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, prop: ['point', 0.75] }, kp.x, kp.z, { yaw: 0.9 });
      break;
    }
    case 'keeper': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'smile', headTilt: 0.1, prop: ['point', 0.55] }, kp.x, kp.z, { yaw: 0.55 });
      break;
    }
    case 'bellpull': {
      const pulling = ropePullAt(f) > 0.25;
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'smile', prop: pulling ? ['point', 0.95] : null, headTilt: pulling ? -0.12 : -0.04 }, kp.x, kp.z, { yaw: 2.2 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 96), seed: 96 }, -1.8, -4.4, { yaw: 0.3, s: 0.7 });
      std('woman', OUTFITS.woman, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 95), seed: 95 }, 6.4, -0.4, { yaw: -0.6 });
      break;
    }
    case 'water': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, prop: ['point', 0.7] }, kp.x, kp.z, { yaw: -0.7 });
      break;
    }
    case 'ask': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'smile' }, kp.x, kp.z, { yaw: 0.5 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', mode: farmerMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 85), seed: 85, prop: ['point', 0.6] }, fa.x, fa.z, { yaw: -0.9 });
      std('woman', OUTFITS.woman, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 95), seed: 95 }, 5.7, -0.5, { yaw: -0.7 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 96), seed: 96 }, 3.6, -0.9, { yaw: -0.5, s: 0.7 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the keeper PERFORMS his line — mouth driven by
      // the stem inside the speak segment (L14), firmly closed during the
      // narration tag (L13) and everywhere else; listeners never open.
      std('keeper', OUTFITS.keeper, { mode: 'stand', blink: blinkAt(f, 71), seed: 71, look: 0.12, ...speakFace('smile', f) }, kp.x, kp.z, { yaw: 0.45 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 85), seed: 85 }, fa.x, fa.z, { yaw: -0.8 });
      std('woman', OUTFITS.woman, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 95), seed: 95 }, 5.7, -0.5, { yaw: -0.7 });
      break;
    }
    case 'refuse': {
      makerEntry({ ...makerBase, expr: 'nervous' }, { yaw: -0.4 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'smile' }, kp.x, kp.z, { yaw: 0.6 });
      std('farmer', OUTFITS.farmer, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 85), seed: 85 }, fa.x, fa.z, { yaw: -0.9 });
      std('woman', OUTFITS.woman, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 95), seed: 95 }, 5.7, -0.5, { yaw: -0.8 });
      std('shopkeeper', OUTFITS.shopkeeper, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, 0.6, 4.9, { yaw: -0.3 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-2.9, 2.9, -12.9, -7.35, { h: 11, id: 'tower' }),
  SOL.aabb(-14.2, -9.2, -9.2, -3.8, { h: 4.2, id: 'houseW1' }),
  SOL.aabb(9.2, 14.6, -10.4, -4.8, { h: 4.4, id: 'houseE1' }),
  SOL.aabb(-15.0, -10.2, 1.0, 6.2, { h: 3.9, id: 'houseW2' }),
  SOL.aabb(10.2, 15.0, 2.0, 7.0, { h: 4.1, id: 'houseE2' }),
  SOL.obb(-8.6, 5.2, 0.85, 1.85, 0.95, { h: 1.0, id: 'shop' }),
  SOL.circle(9.2, -2.6, 0.5, { h: 2.6, id: 'tree' }),
  SOL.obb(SUNDIAL.x, SUNDIAL.z, SUNDIAL.ry, 2.5, 0.85, { h: 0.36, id: 'sundial' }),
  SOL.circle(WATER.x, WATER.z, 0.58, { h: 0.9, id: 'waterclock' }),
  SOL.aabb(-5.55, -3.25, 3.05, 3.75, { h: 0.45, id: 'bench' }),
  SOL.obb(3.1, 5.6, -0.4, 0.66, 0.66, { h: 1.1, id: 'crate' }),
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
  for (const a of castAt(f)) {
    // the clockmaker mid-climb is transitional (hands on the ladder) —
    // unchecked then, like a carried prop; settled frames are checked
    // against the ground he actually stands on (square / ledge).
    if (a.id === 'maker' && makerY(f).state === 'climb') continue;
    items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  }
  return items;
};
