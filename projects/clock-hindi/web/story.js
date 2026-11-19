// Shot plan for "हमेशा सही बताने वाली घड़ी" — clock-hindi, v4 UPGRADE
// (2026-11-19, picture-only rebuild on the existing stem). Batch 8 H2,
// Kahani Me Twist. WHAT CHANGED vs web_prev4: (1) the camera is now
// Abid's "v4" ACTION camera — fast eased push-ins at action starts
// (subject scale x2+ in ~14-20 frames), tracking at subject speed,
// impact kicks on the bell tolls / face swing, a whip reframe into the
// final shot; NO slow drift, NO static holds, camera never behind the
// cards. (2) ANIMATION UPGRADE v1+v2 via body.js (Library v6): lifeAt
// breathing/weight-shift on EVERY figure, emoTrack emotion morphs at
// beats (cheek/brow shading rides the morphs), gestureAt dialogue
// gesture, gripAt physical rope grip with weight squash, stridePh
// distance-true stride phases (no glide), hair/head micro-motion on
// every head. (3) R2 framing: opening hero BIG from frame 0 (keeper,
// low angle, mid-action), inserts at 85-95% width, reaction faces
// >=65%, and the final frame is a CHARACTER BEAT + hook board together
// (the keeper strolls into the foreground during 'refuse' and stands
// pointing up at the board — head ~30% width, board ~86%). (4) Word-
// by-word captions (main.js + words.js). UNCHANGED: the stem, the
// beat map / clause timings (P[] below), the story, scene order, the
// boards (boards.json, Devanagari verbatim) and the mix.
// Voice stem: 47.931 s, 30 fps, TOTAL 1438; timings from faster-whisper
// small word alignment (words.json / timing.json — Hindi spellings are
// timings only; board text is verbatim from script_hi.txt). Scene
// changes ONLY at clause boundaries (P[] = script-line start frames):
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
// NOTE (END RULE): the performed dialogue (L14, f1099-1188) sits at
// 76-83% of the runtime — inside the final quarter. That is how the
// original Batch 8 script/stem was authored (2026-11-17, before the
// END RULE); the stem may not be re-timed, so it is flagged, not moved.
// No character speaks after it: L15-L17 are narration + hook board.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);

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
  [P[8], 1.15, -2.3], [P[14], 1.15, -2.3], [P[14] + 52, 4.6, 2.6], [TOTAL - 1, 4.6, 2.6],
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
// keeper: sundial -> rope -> water clock -> the asking group -> (v4
// upgrade) strolls SOUTH into the foreground during 'refuse' so the
// final frame is his character beat in front of the hook board.
const KEEPER_KEYS = [
  [0, 2.7, -2.7], [P[7], 2.7, -2.7], [P[8], 2.9, -3.1], [P[9], 2.9, -3.1],
  [P[9] + 11, 1.3, -4.85], [P[9] + 24, 1.55, -6.35], [P[10], 1.55, -6.35], [P[10] + 13, -2.2, -1.55], [P[10] + 26, -4.35, 0.35],
  [P[11], -4.35, 0.35], [P[11] + 30, 3.3, -2.2], [P[14] + 30, 3.3, -2.2], [P[16] + 30, 3.3, 4.15], [TOTAL - 1, 3.3, 4.15],
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
export const keeperMode = (f) => strolling(f, [[P[9], P[9] + 24], [P[10], P[10] + 26], [P[11], P[11] + 30], [P[14] + 30, P[16] + 30]]) ? 'stroll' : 'stand';
export const farmerMode = (f) => strolling(f, [[P[2], P[3] - 12], [P[11], P[11] + 34]]) ? 'stroll' : 'stand';
export const kidMode = (f) => strolling(f, [[P[2], P[3] - 8]]) ? 'stroll' : 'stand';

// ---------- stride phases from distance travelled (body.js stridePh:
// feet plant with the ground — the old build's constant-rate phase
// glided whenever a walk eased in/out) ----------
const distTable = (fn) => {
  const t = [0]; let prev = fn(0), acc = 0;
  for (let f = 1; f < TOTAL; f++) { const p = fn(f); acc += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; t.push(acc); }
  return t;
};
const MAKER_DIST = distTable(makerAt), KEEPER_DIST = distTable(keeperAt), FARMER_DIST = distTable(farmerAt),
  KID1_DIST = distTable(kid1At), KID2_DIST = distTable(kid2At);
const phOf = (table, f, stride = 1.05) => q(stridePh(0, table[f], stride), 2);

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
  refuse: () => [3.3, 1.1, 1.0],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: the v4 ACTION rig ----------
// Every shot is authored dense: a fast eased push-in lands in the
// first ~14-20 frames of the shot (subject scale x2+), then the camera
// keeps tracking / pushing at the subject's own speed. Impact kicks
// ride the bell tolls and the face-swing clunk. One whip reframe (6f)
// into the final framing; every other cut is a clause-boundary cut.
const makerPos = (f) => { const m = makerAt(f); return [m.x, makerY(f).y, m.z]; };
const keeperPos = (f) => { const k = keeperAt(f); return [k.x, 0, k.z]; };
const RIG_BY_ID = {
  // OPENING (R2): frame 0 is the KEEPER, big and low, mid-action at his
  // sundial (head ~41% of width) — then a fast pull-back/rise reveals
  // the square + title board, and the shot ends pushing up toward the
  // clock face. The title board is only up (f36-84) while the wide key
  // frames it whole.
  drone: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[0], pos: [3.82, 0.68, 0.35], look: [2.62, 1.7, -2.7], fov: 38 },
    { f: P[0] + 14, pos: [4.05, 0.82, 0.8], look: [2.5, 1.8, -3.0], fov: 39 },
    { f: P[0] + 36, pos: [8.8, 4.0, 15.6], look: [0.6, 2.6, -3.4], fov: 42, ease: 'surge' },
    { f: P[0] + 84, pos: [7.9, 3.6, 14.0], look: [0.5, 2.8, -3.8], fov: 40 },
    { f: P[1] - 1, pos: [4.4, 5.4, 6.2], look: [0, 5.6, -7.4], fov: 38, ease: 'surge' }] }) },
  // the painted dial: wide -> insert (91% width) in 20 frames, the
  // 6-o'clock toll kicks at P[1]+38.
  face: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[1], pos: [7.5, 10.5, 9.5], look: [FACE.x, FACE.y, FACE.z], fov: 44 },
    { f: P[1] + 20, pos: [4.0, 8.4, 2.9], look: [FACE.x, FACE.y, FACE.z], fov: 35, ease: 'surge' },
    { f: P[2] - 1, pos: [3.55, 8.25, 2.2], look: [0.05, 7.6, FACE.z], fov: 33 }] }) },
  // the village lives by the bell: a ground-level track that rides
  // WITH the farmer as he crosses the square (subject-speed tracking).
  village: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[2], pos: [-8.6, 2.0, 6.8], look: [-10.3, 1.1, -1.6], fov: 40 },
    { f: P[2] + 37, pos: [-1.5, 1.9, 6.4], look: [-0.5, 1.1, -1.3], fov: 38 },
    { f: P[3] - 13, pos: [6.4, 1.9, 6.6], look: [9.6, 1.1, -1.0], fov: 38 },
    { f: P[3] - 1, pos: [7.6, 2.0, 7.0], look: [10.0, 1.1, -0.9], fov: 37 }] }) },
  // the clockmaker's approach + ladder climb: the camera tracks him
  // in, then RISES with him (look height follows makerY).
  climb: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[3], pos: [-9.8, 1.6, 3.4], look: [-5.6, 1.2, -1.7], fov: 40 },
    { f: P[3] + 31, pos: [-4.6, 1.7, 1.4], look: [-1.8, 1.3, -3.4], fov: 37 },
    { f: P[4] - 45, pos: [-1.2, 3.4, -0.6], look: [0.95, 3.4, -5.2], fov: 35 },
    { f: P[4] - 1, pos: [-0.9, 6.6, -1.3], look: [1.3, 6.6, -6.4], fov: 33 }] }) },
  // he taps the painted face: fast push to a 95% dial insert with his
  // head/hand at its lower-left.
  tap: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[4], pos: [4.4, 8.5, 3.6], look: [0.1, 7.6, FACE.z], fov: 40 },
    { f: P[4] + 14, pos: [3.3, 8.15, 1.7], look: [0.1, 7.58, FACE.z], fov: 38, ease: 'surge' },
    { f: P[5] - 1, pos: [3.3, 8.15, 1.9], look: [0.1, 7.6, FACE.z], fov: 37 }] }) },
  // the face swings open on the hollow tower: push-in DURING the
  // swing, kick as it clunks fully open (~P[5]+36).
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[5], pos: [4.4, 7.9, 4.4], look: [0.2, 7.2, -7.4], fov: 40 },
    { f: P[5] + 28, pos: [3.7, 7.6, 3.0], look: [0.15, 7.15, -7.4], fov: 36, ease: 'surge' },
    { f: P[6] - 29, pos: [3.4, 7.45, 2.5], look: [0.1, 7.1, -7.45], fov: 34 },
    { f: P[6] - 1, pos: [3.3, 7.4, 2.3], look: [0.1, 7.1, -7.45], fov: 33 }] }) },
  // "but how is the bell on time?" — a pushing two-shot: the maker
  // lands from the ladder, nervous; the keeper just smiles.
  question: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[6], pos: [-4.4, 2.3, 5.6], look: [1.2, 1.6, -3.6], fov: 40 },
    { f: P[6] + 33, pos: [-3.6, 2.1, 4.6], look: [1.4, 1.45, -3.2], fov: 37, ease: 'surge' },
    { f: P[7] - 1, pos: [-3.1, 2.0, 4.0], look: [1.5, 1.4, -3.0], fov: 35 }] }) },
  // the sundial INSERT: a low glide along the marked slab, following
  // the shadow's creep toward the gold bell mark.
  sundial: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[7], pos: [-0.3, 2.5, 0.9], look: [4.2, 0.3, -4.5], fov: 39 },
    { f: P[7] + 54, pos: [0.3, 2.2, 0.2], look: [4.5, 0.3, -4.65], fov: 36 },
    { f: P[8] - 1, pos: [0.8, 2.0, -0.3], look: [4.8, 0.3, -4.8], fov: 34 }] }) },
  // the keeper's portrait: fast push to a reaction close-up, then the
  // camera holds the track on him (never a frozen frame).
  keeper: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[8], pos: [6.1, 1.75, 2.3], look: [2.9, 1.42, -3.1], fov: 38 },
    { f: P[8] + 14, pos: [5.0, 1.6, 0.9], look: [2.9, 1.43, -3.1], fov: 34, ease: 'surge' },
    { f: P[9] - 1, pos: [4.75, 1.58, 0.55], look: [2.9, 1.44, -3.1], fov: 32 }] }) },
  // the pull: track him to the rope, push in on his hands, then tilt
  // up the tower to the swinging bell. Kicks on both tolls.
  bellpull: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[9], pos: [5.6, 1.9, 1.8], look: [2.6, 1.3, -3.6], fov: 40 },
    { f: P[9] + 24, pos: [4.6, 1.95, 0.4], look: [1.9, 1.5, -6.2], fov: 37, ease: 'surge' },
    { f: P[9] + 54, pos: [4.3, 2.2, 0.0], look: [1.95, 2.2, -6.9], fov: 35 },
    { f: P[10] - 1, pos: [4.15, 2.7, -0.4], look: [0.8, 8.8, -9.2], fov: 34, ease: 'surge' }] }) },
  // the water clock INSERT: fast push onto the dripping pot + bowl;
  // the keeper's pointing hand stays in frame.
  water: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[10], pos: [-1.2, 1.8, 4.6], look: [-4.9, 0.8, 0.7], fov: 40 },
    { f: P[10] + 16, pos: [-2.2, 1.55, 3.6], look: [-4.85, 0.78, 0.65], fov: 36, ease: 'surge' },
    { f: P[11] - 1, pos: [-2.6, 1.45, 3.2], look: [-4.8, 0.75, 0.6], fov: 34 }] }) },
  // "why did you hide it for thirty years?" — a pushing group shot
  // that ends on the keeper.
  ask: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[11], pos: [0.2, 2.1, 4.6], look: [3.9, 1.3, -2.0], fov: 40 },
    { f: P[11] + 38, pos: [0.7, 2.0, 3.9], look: [3.7, 1.35, -2.1], fov: 37, ease: 'surge' },
    { f: P[12] - 1, pos: [1.0, 1.95, 3.5], look: [3.55, 1.38, -2.15], fov: 35 }] }) },
  // THE dialogue: fast push onto the keeper, then the camera HOLDS
  // on the speaker (a living push, never a freeze) while he performs.
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[12], pos: [5.1, 1.75, 0.9], look: [3.3, 1.45, -2.2], fov: 34 },
    { f: P[12] + 16, pos: [4.9, 1.7, 0.55], look: [3.3, 1.46, -2.2], fov: 31, ease: 'surge' },
    { f: P[14] - 1, pos: [4.7, 1.66, 0.3], look: [3.3, 1.47, -2.2], fov: 29 }] }) },
  // the refusal: the village stands stern while the keeper strolls
  // toward camera — the camera pulls back AT HIS SPEED (front track).
  refuse: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[14], pos: [1.2, 2.2, 6.8], look: [3.6, 1.2, -1.2], fov: 40 },
    { f: P[15] + 14, pos: [0.6, 2.0, 8.6], look: [2.9, 1.25, 1.2], fov: 38 },
    { f: P[16] - 1, pos: [0.9, 2.1, 9.6], look: [3.2, 1.5, 3.9], fov: 37 }] }) },
  // the hook question: a 6-frame WHIP settles into the final framing —
  // keeper foreground-left (head ~21%), hook board behind him (~84%
  // wide), the refused new-clock crate kept out of frame west.
  hookq: { cut: 'whip', blend: 6, raw: keysCam({ keys: [
    { f: P[16], pos: [7.9, 2.85, 11.0], look: [0, 3.0, -2.6], fov: 37 },
    { f: P[16] + 97, pos: [7.6, 2.8, 10.6], look: [0, 3.0, -2.6], fov: 36, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: P[16] + 98, pos: [7.6, 2.8, 10.6], look: [0, 3.0, -2.6], fov: 36 },
    { f: TOTAL - 1, pos: [7.5, 2.81, 10.45], look: [0, 3.01, -2.6], fov: 35.5, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [
    { f: P[1] + 38, a: 0.3 },     // the 6-o'clock bell toll
    { f: P[5] + 36, a: 0.2 },     // the painted face clunks fully open
    { f: P[9] + 30, a: 0.35 },    // the shadow touches the mark -> TOLL
    { f: P[9] + 74, a: 0.22 },    // second pull
  ],
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
  if (['drone', 'hookq'].includes(S.id)) cinf = 1.3;
  if (['face', 'tap', 'reveal', 'dialogue', 'water'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 1.6;
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
  // the title board is up only while the opening's wide key frames it
  // whole (f36-84 of the v4 opening choreography)
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 36, 50)) * (1 - smooth(ramp(f, 70, 84)));
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

// ---------- performance system (ANIMATION UPGRADE v1+v2, body.js) ----------
// Emotion morphs at story beats: cheek/brow shading rides these morphs
// (toon v6 face params), so the SKIN reacts with the expression.
const emoKeeper = emoTrack(T.faceP, 'smile', [
  [P[5], 'smile', 8], [P[7], 'proud', 10], [P[10], 'thinking', 8], [P[11], 'smile', 8],
  [P[13], 'proud', 8], [P[14], 'smile', 8], [P[16], 'proud', 10],
]);
const emoMaker = emoTrack(T.faceP, 'neutral', [
  [P[3], 'determined', 8], [P[4], 'wonder', 6], [P[5] + 20, 'shock', 6], [P[6], 'nervous', 8],
  [P[7], 'thinking', 8], [P[11], 'wonder', 8], [P[14], 'nervous', 8],
]);
const emoFarmer = emoTrack(T.faceP, 'smile', [[P[11], 'thinking', 8], [P[14], 'stern', 8]]);
const emoWoman = emoTrack(T.faceP, 'smile', [[P[6], 'thinking', 8], [P[14], 'stern', 8]]);
const emoShop = emoTrack(T.faceP, 'smile', [[P[14], 'stern', 8]]);
const emoKid1 = emoTrack(T.faceP, 'grin', [[P[9], 'laugh', 7], [P[10], 'grin', 8]]);
const emoKid2 = emoTrack(T.faceP, 'grin', [[P[9], 'laugh', 7], [P[10], 'grin', 8]]);
// Continuous life per character: breath phase, weight-shift tilt, sway.
const lifeKeeper = lifeAt({ seed: 71 }), lifeMaker = lifeAt({ seed: 81 }), lifeFarmer = lifeAt({ seed: 85 }),
  lifeShop = lifeAt({ seed: 91 }), lifeWoman = lifeAt({ seed: 95 }), lifeKid1 = lifeAt({ seed: 96 }), lifeKid2 = lifeAt({ seed: 97 });
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
// head/body opts fragment: life (breath/tilt/sway + hair-follow micro
// head motion) + directed gaze. Merged into EVERY figure, every shot.
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
// the keeper CROUCHES by the slab to watch the shadow line (sundial
// beat): knees on the stone, weight settled — poseWindows keeps his
// sole/knees on the ground line, y never changes.
const keeperPose = poseWindows([{ a: P[7] + 30, b: P[8] - 14, mode: 'kneel1', inF: 8, outF: 8 }]);
// PHYSICAL GRIP on the bell rope: hand closes (lift) as each pull
// starts, releases (place) after it — the same grip squash feeds the
// body, so the strain reads. Pulls: P[9]+18.. and P[9]+62...
const ropeGrip = gripAt([
  { f0: P[9] + 16, dur: 13, type: 'lift' },
  { f0: P[9] + 50, dur: 10, type: 'place', settle: 7 },
  { f0: P[9] + 60, dur: 13, type: 'lift' },
  { f0: P[10] - 14, dur: 10, type: 'place', settle: 7 },
]);
// the gripping hand's HEIGHT on the rope (toon propL param: 0 = hand
// UP at the grab, 1 = hand pulled DOWN): reach up, hold, haul down,
// release, reach again — keyed to the same pull windows.
const ropeHand = (() => {
  const K = [[P[9], 0.9], [P[9] + 16, 0.9], [P[9] + 29, 0.06], [P[9] + 50, 0.06], [P[9] + 60, 0.9], [P[9] + 73, 0.06], [P[10] - 14, 0.06], [P[10] - 4, 0.9], [P[10] + 10, 0.9]];
  return (f) => {
    if (f <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) {
      if (f <= K[i][0]) { const [f0, v0] = K[i - 1], [f1, v1] = K[i]; return v0 + (v1 - v0) * ((f - f0) / Math.max(1, f1 - f0)); }
    }
    return K[K.length - 1][1];
  };
})();
// dialogue gesture: while the keeper performs L14 his free hand talks
// with the voice; pulses land on the stressed words (घड़ी / बोला /
// झूठ / चली — the speakgen STRESSED set).
const gestKeeper = gestureAt([{ a: P[13], b: P[14] - 1, beats: [P[13] + 2, P[13] + 26, P[13] + 32, P[13] + 64], base: 0.42, amp: 0.16 }]);

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
  // per-character base opts: emotion morph (exprP) + continuous life
  const keeperBase = { expr: 'smile', exprP: emoKeeper.at(f), mode: keeperMode(f), phase: phOf(KEEPER_DIST, f), blink: blinkAt(f, 71), seed: 71 };
  const makerBase = { expr: 'neutral', exprP: emoMaker.at(f), mode: makerMode(f), phase: phOf(MAKER_DIST, f), blink: blinkAt(f, 81), seed: 81 };
  // the clockmaker — special entry: his y rides the ladder / ledge
  const makerEntry = (opts, extra = {}) => out.push({ id: 'maker', x: mk.x, y: my.y, z: mk.z, r: 0.32, ground: my.state === 'ledge' ? LEDGE.y : 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(OUTFITS.maker) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, OUTFITS.maker, opts), x: mk.x, y: my.y, z: mk.z, ground: my.state === 'ledge' ? LEDGE.y : 0, tint, ...extra }) });
  switch (S.id) {
    case 'drone': {
      // frame 0: the keeper is the hero — at his sundial, mid-action,
      // one hand raised to the shadow line.
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, { ht: -1.5, look: 0.3, lookY: 0.1, facing: 0.25 }), prop: ['point', 0.6] }, kp.x, kp.z, { yaw: 0.4 });
      std('shopkeeper', OUTFITS.shopkeeper, { expr: 'smile', exprP: emoShop.at(f), mode: 'stand', blink: blinkAt(f, 91), seed: 91, ...H2(lifeShop, f, 91, {}) }, -7.35, 6.35, { yaw: 0.5 });
      std('woman', OUTFITS.woman, { expr: 'smile', exprP: emoWoman.at(f), mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...H2(lifeWoman, f, 95, {}) }, 6.1, 0.6, { yaw: -0.4 });
      break;
    }
    case 'face': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, { ht: -2, look: 0.1, lookY: -0.2, facing: 0.15 }) }, kp.x, kp.z, { yaw: 0.3 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', exprP: emoKid1.at(f), mode: 'stand', blink: blinkAt(f, 96), seed: 96, ...H2(lifeKid1, f, 96, { ht: -2.5, lookY: -0.25 }) }, -2.6, -3.4, { yaw: 0.2, s: 0.7 });
      std('kid2', OUTFITS.kid2, { expr: 'grin', exprP: emoKid2.at(f), mode: 'stand', blink: blinkAt(f, 97), seed: 97, ...H2(lifeKid2, f, 97, { ht: -2.5, lookY: -0.25 }) }, -3.3, -2.8, { yaw: 0.3, s: 0.66 });
      break;
    }
    case 'village': {
      makerEntry({ ...makerBase, ...H2(lifeMaker, f, 81, {}) }, { yaw: 0.5 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', exprP: emoFarmer.at(f), mode: farmerMode(f), phase: phOf(FARMER_DIST, f, 1.15), blink: blinkAt(f, 85), seed: 85, ...H2(lifeFarmer, f, 85, {}) }, fa.x, fa.z, { yaw: 0.45 });
      std('shopkeeper', OUTFITS.shopkeeper, { expr: 'smile', exprP: emoShop.at(f), mode: 'stand', blink: blinkAt(f, 91), seed: 91, ...H2(lifeShop, f, 91, {}), prop: f >= P[2] + 20 ? ['point', 0.5] : null }, -7.35, 6.35, { yaw: 0.5 });
      std('kid1', OUTFITS.kid1, { expr: 'laugh', exprP: emoKid1.at(f), mode: kidMode(f), phase: phOf(KID1_DIST, f, 0.8), blink: blinkAt(f, 96), seed: 96, ...H2(lifeKid1, f, 96, {}) }, k1.x, k1.z, { yaw: 0.5, s: 0.7 });
      std('kid2', OUTFITS.kid2, { expr: 'laugh', exprP: emoKid2.at(f), mode: kidMode(f), phase: phOf(KID2_DIST, f, 0.8), blink: blinkAt(f, 97), seed: 97, ...H2(lifeKid2, f, 97, {}) }, k2.x, k2.z, { yaw: 0.5, s: 0.66 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, {}) }, kp.x, kp.z, { yaw: 0.4 });
      std('woman', OUTFITS.woman, { expr: 'smile', exprP: emoWoman.at(f), mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...H2(lifeWoman, f, 95, {}) }, 6.1, 0.6, { yaw: -0.5 });
      break;
    }
    case 'climb': {
      makerEntry({ ...makerBase, expr: f >= P[4] - 52 ? 'stern' : 'neutral', ...H2(lifeMaker, f, 81, { ht: -1 }) }, { yaw: 0.15 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, expr: 'neutral', ...H2(lifeKeeper, f, 71, { ht: -2.5, lookY: -0.3 }) }, kp.x, kp.z, { yaw: 0.5 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', exprP: emoKid1.at(f), mode: 'stand', blink: blinkAt(f, 96), seed: 96, ...H2(lifeKid1, f, 96, { ht: -3, lookY: -0.35 }) }, -3.6, -1.7, { yaw: 0.4, s: 0.7 });
      break;
    }
    case 'tap': {
      makerEntry({ ...makerBase, expr: 'shock', ...H2(lifeMaker, f, 81, { ht: -1.5 }), prop: f >= P[4] + 12 && f < P[5] - 20 ? ['point', 0.8] : null }, { yaw: 0.1 });
      break;
    }
    case 'reveal': {
      makerEntry({ ...makerBase, expr: 'shock', ...H2(lifeMaker, f, 81, { ht: -2 }) }, { yaw: 0.1 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, { ht: -2, lookY: -0.2 }) }, kp.x, kp.z, { yaw: 0.4 });
      break;
    }
    case 'question': {
      makerEntry({ ...makerBase, expr: 'nervous', ...H2(lifeMaker, f, 81, {}) }, { yaw: 0.3 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, {}) }, kp.x, kp.z, { yaw: 0.4 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', exprP: emoFarmer.at(f), mode: 'stand', blink: blinkAt(f, 85), seed: 85, ...H2(lifeFarmer, f, 85, { ht: -6 }) }, fa.x, fa.z, { yaw: -0.4 });
      std('woman', OUTFITS.woman, { expr: 'neutral', exprP: emoWoman.at(f), mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...H2(lifeWoman, f, 95, { ht: -6 }) }, 5.7, -0.5, { yaw: -0.5 });
      break;
    }
    case 'sundial': {
      const pose = keeperPose(f);
      std('keeper', OUTFITS.keeper, { ...keeperBase, mode: pose.mode, ...H2(lifeKeeper, f, 71, { ht: 2, look: 0.35, lookY: 0.3, facing: 0.3, squash: pose.squash }), prop: pose.mode === 'stand' ? ['point', 0.75] : null }, kp.x, kp.z, { yaw: 0.5 });
      break;
    }
    case 'keeper': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, { ht: -3, look: 0.15, lookY: -0.05, facing: 0.2 }), prop: ['point', 0.55] }, kp.x, kp.z, { yaw: 0.55 });
      break;
    }
    case 'bellpull': {
      const g = ropeGrip(f);
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, { ht: g.k > 0.3 ? -4 : -1.5, squash: g.squash }), prop: f >= P[9] && f <= P[10] + 10 ? ['point', q(ropeHand(f), 2)] : null }, kp.x, kp.z, { yaw: 0.35 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', exprP: emoKid1.at(f), mode: 'stand', blink: blinkAt(f, 96), seed: 96, ...H2(lifeKid1, f, 96, { ht: -3, lookY: -0.3 }) }, -1.8, -4.4, { yaw: 0.3, s: 0.7 });
      std('woman', OUTFITS.woman, { expr: 'smile', exprP: emoWoman.at(f), mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...H2(lifeWoman, f, 95, {}) }, 6.4, -0.4, { yaw: -0.5 });
      break;
    }
    case 'water': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, { ht: 1.5, look: -0.3, lookY: 0.25, facing: -0.3 }), prop: ['point', 0.7] }, kp.x, kp.z, { yaw: -0.5 });
      break;
    }
    case 'ask': {
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, {}) }, kp.x, kp.z, { yaw: 0.5 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', exprP: emoFarmer.at(f), mode: farmerMode(f), phase: phOf(FARMER_DIST, f, 1.15), blink: blinkAt(f, 85), seed: 85, ...H2(lifeFarmer, f, 85, {}), prop: ['point', 0.6] }, fa.x, fa.z, { yaw: -0.5 });
      std('woman', OUTFITS.woman, { expr: 'neutral', exprP: emoWoman.at(f), mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...H2(lifeWoman, f, 95, {}) }, 5.7, -0.5, { yaw: -0.5 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', exprP: emoKid1.at(f), mode: 'stand', blink: blinkAt(f, 96), seed: 96, ...H2(lifeKid1, f, 96, {}) }, 3.6, -0.9, { yaw: -0.5, s: 0.7 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the keeper PERFORMS his line — mouth driven
      // by the stem inside the speak segment (L14), firmly closed
      // during the narration tag (L13) and everywhere else; his free
      // hand gestures with the voice (gestureAt); listeners never open.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...emoKeeper.at(f), cheek: 0.35 }, sp);
      std('keeper', OUTFITS.keeper, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        propL: f >= P[13] && f <= P[14] - 1 ? ['point', q(gestKeeper(f).k, 2)] : null,
        headTilt: q((sp.nod || 0) + micro(f, 71), 1), look: q(0.1, 2), lookY: q(0.02, 2), facing: q(0.08, 2),
        squash: 0, tilt: q(lifeKeeper(f).tilt + lifeKeeper(f).sway, 1), breath: Math.round(lifeKeeper(f).breath / 6) * 6,
        clothShade: true }, kp.x, kp.z, { yaw: 0.45 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', exprP: emoFarmer.at(f), mode: 'stand', blink: blinkAt(f, 85), seed: 85, ...H2(lifeFarmer, f, 85, { ht: -1.5, look: -0.3, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.5 });
      std('woman', OUTFITS.woman, { expr: 'smile', exprP: emoWoman.at(f), mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...H2(lifeWoman, f, 95, { ht: -1.5, look: -0.35, facing: -0.35 }) }, 5.7, -0.5, { yaw: -0.5 });
      break;
    }
    case 'refuse': {
      makerEntry({ ...makerBase, expr: 'nervous', ...H2(lifeMaker, f, 81, {}) }, { yaw: -0.4 });
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, {}) }, kp.x, kp.z, { yaw: 0.5 });
      std('farmer', OUTFITS.farmer, { expr: 'stern', exprP: emoFarmer.at(f), mode: 'stand', blink: blinkAt(f, 85), seed: 85, ...H2(lifeFarmer, f, 85, {}) }, fa.x, fa.z, { yaw: -0.5 });
      std('woman', OUTFITS.woman, { expr: 'stern', exprP: emoWoman.at(f), mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...H2(lifeWoman, f, 95, {}) }, 5.7, -0.5, { yaw: -0.5 });
      std('shopkeeper', OUTFITS.shopkeeper, { expr: 'stern', exprP: emoShop.at(f), mode: 'stand', blink: blinkAt(f, 91), seed: 91, ...H2(lifeShop, f, 91, {}) }, 0.6, 4.9, { yaw: -0.3 });
      break;
    }
    case 'hookq': case 'hook': {
      // the film ends on a CHARACTER BEAT (R2): the keeper stands in
      // the foreground pointing up at the hook board behind him —
      // breathing, head following the board, mouth firmly shut (the
      // hook is narration + board only).
      std('keeper', OUTFITS.keeper, { ...keeperBase, ...H2(lifeKeeper, f, 71, { ht: -2.5, look: 0.4, lookY: -0.35, facing: 0.4 }), prop: ['point', 0.38] }, kp.x, kp.z, { yaw: 0.5 });
      break;
    }
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
