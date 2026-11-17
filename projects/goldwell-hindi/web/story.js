// Shot plan for "दोगुना लौटाने वाला कुआँ" — goldwell-hindi (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 8 topic 5 (Hindi-only). ONE set: a drought-
// struck village square and its WELL. Whatever is dropped in the basket
// comes back doubled by morning — because the old potter slips through a
// hidden tunnel in the well wall at night and adds one more of everything,
// just to keep the village's hope alive in the dry year. The greedy Seth
// drops a whole GOLD brick (real ingot) expecting two — and gets back two
// PAINTED clay bricks.
// Voice stem: 50.971 s, 30 fps, TOTAL 1529. Timings: faster-whisper small
// word alignment (words.json, timings only — Hindi spellings garbled).
// ASR dropped L10/L11 entirely (30.56-37.30 s); their boundary (33.50 /
// 33.80) comes from the stem's RMS clause dips, verified by hand.
// Scene changes ONLY at clause boundaries:
//   L1 0.00-3.34   उस गाँव के कुएँ में...लौट आता था।      L9  27.50-30.56 फिर लालची सेठ आया...डाल दी।
//   L2 3.64-5.96   एक लड़के ने एक आम डाला, / सुबह...मिले।   L10 30.80-33.50 उसे पक्का यक़ीन था...मिलेंगी।
//   L3 6.22-8.88   एक किसान ने सिक्का डाला, / सुबह...थे।    L11 33.80-37.20 सुबह कुएँ से दो ईंटें...थीं।
//   L4 8.88-12.42  ख़बर फैलते ही...कहने लगे।               L12 37.30-39.78 (tag) भीड़ के सामने...बोला।
//   L5 12.76-16.34 असली राज़...बूढ़ा कुम्हार।               L13 40.14-43.92 "कुआँ वही लौटाता है...था।"
//   L6 16.78-20.04 कुएँ की दीवार में...जाती थी।             L14 44.28-48.06 उस दिन के बाद...हो गई।
//   L7 20.04-24.26 रात को कुम्हार...रख देता।               L15 48.46-50.90 लेकिन कल...दे दिया?
//   L8 24.64-27.12 सूखे के उस साल...चाहता था।
// GRADE (FILTER_VFX_LIGHTING pack): Royal Gold throughout; the night
// beats (L7, and L10 as Seth waits into the dark) blend to Night Lamp
// and back — grade changes ONLY on clause boundaries. Signature VFX:
// heat shimmer over the cracked square, dry dust, the gold brick's
// moving sheen + glints, the lantern glow on night beats.
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

export const FPS = 30, TOTAL = 1529, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 108, light: 'gold' },
  { id: 'boy', a: 109, b: 148, light: 'gold' },
  { id: 'boymorn', a: 149, b: 186, light: 'gold' },
  { id: 'farmer', a: 187, b: 223, light: 'gold' },
  { id: 'farmermorn', a: 224, b: 265, light: 'gold' },
  { id: 'crowd', a: 266, b: 382, light: 'gold' },
  { id: 'secret', a: 383, b: 502, light: 'gold' },
  { id: 'tunnel', a: 503, b: 600, light: 'gold' },
  { id: 'night', a: 601, b: 738, light: 'night' },
  { id: 'why', a: 739, b: 824, light: 'gold' },
  { id: 'seth', a: 825, b: 923, light: 'gold' },
  { id: 'wait', a: 924, b: 1013, light: 'night' },
  { id: 'payoff', a: 1014, b: 1118, light: 'gold' },
  { id: 'emerge', a: 1119, b: 1203, light: 'gold' },
  { id: 'dialogue', a: 1204, b: 1327, light: 'gold' },
  { id: 'after', a: 1328, b: 1453, light: 'gold' },
  { id: 'hookq', a: 1454, b: 1499, light: 'dusk' },
  { id: 'hook', a: 1500, b: 1528, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  gold: { az: 228, el: 30, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.04, sun: '#ffd9a0', sunI: 2.5, fog: '#ecd7ab', fogNear: 46, fogFar: 330,
    skyTop: '#2e4a7a', skyHor: '#f7cf8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.12, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedbe',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  night: { az: 300, el: 38, sky: '#39406b', ground: '#191722', hemi: 0.52, sun: '#93a7d4', sunI: 0.7, fog: '#252a3e', fogNear: 30, fogFar: 240,
    skyTop: '#10182e', skyHor: '#2c3550', sunDisc: '#dfe8ff', sunSize: 0.003, sat: 0.88, vig: 0.34, shadowExt: 22, aurora: 0, gain: '#c9d4e8',
    waterDeep: '#0e222c', waterShal: '#1a3038', glint: '#cfd8dc' },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.92, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.05, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba',
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
  if (S.id === 'night') return blendLight(LIGHTS.gold, LIGHTS.night, smooth(ramp(f, 601, 645)));
  if (S.id === 'why') return blendLight(LIGHTS.night, LIGHTS.gold, smooth(ramp(f, 739, 783)));
  if (S.id === 'wait') return blendLight(LIGHTS.gold, LIGHTS.night, smooth(ramp(f, 924, 1013)));
  if (S.id === 'payoff') return blendLight(LIGHTS.night, LIGHTS.gold, smooth(ramp(f, 1014, 1064)));
  if (S.id === 'hookq') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, 1454, 1500)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.3, -8.2];
export const WELL = { x: 0, z: 2, r: 1.55, top: 1.02 };
export const KILN = { x: 5.6, z: -6.5 };
const MOUTH = [0, 0.55, 0.34];

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const POTTER_KEYS = [
  [0, 4.2, -4.2], [502, 4.2, -4.2], [548, 1.3, 0.1], [700, 1.3, 0.1], [730, 1.05, 0.05],
  [738, 1.05, 0.05], [739, 1.35, 0.15], [824, 1.35, 0.15], [825, 4.2, -4.2], [1118, 4.2, -4.2],
  [1119, 1.05, 0.05], [1145, 2.3, 0.9], [1175, 3.1, 2.9], [1200, 1.7, 3.6], [1528, 1.7, 3.6],
];
const SETH_KEYS = [
  [0, 9.5, -3.0], [824, 9.5, -3.0], [825, 8.5, 7.5], [878, 2.9, 4.5], [1528, 2.9, 4.5],
];
export const potterAt = (f) => { const [x, z] = walkKeys(POTTER_KEYS, f); return { x, z }; };
export const sethAt = (f) => { const [x, z] = walkKeys(SETH_KEYS, f); return { x, z }; };
export const boyAt = (f) => f >= 1328 ? { x: -0.9, z: 4.6 } : { x: -1.3, z: 4.35 };
export const farmerAt = (f) => f >= 1328 ? { x: 0.7, z: 4.75 } : { x: 1.5, z: 4.4 };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const potterMode = (f) => strolling(f, [[503, 548], [700, 730], [1119, 1200]]) ? 'stroll' : 'stand';
export const sethMode = (f) => strolling(f, [[825, 878]]) ? 'stroll' : 'stand';

// ---------- the basket, the brick, the drops ----------
export const basketAt = (f) => {
  let x = WELL.x, z = WELL.z, y = 0.72, k = 1, ropeK = 1, m = 0, c = 0, p = 0;
  if (f >= 109 && f <= 148) { m = f >= 140 ? 1 : 0; }
  else if (f >= 149 && f <= 186) { y = f < 156 ? -3.3 : lerp(-3.3, 0.72, smooth(ramp(f, 156, 176))); m = 2; }
  else if (f >= 187 && f <= 223) { c = f >= 216 ? 1 : 0; }
  else if (f >= 224 && f <= 265) { y = f < 231 ? -3.3 : lerp(-3.3, 0.72, smooth(ramp(f, 231, 253))); c = 2; }
  else if (f >= 601 && f <= 738) {
    // night: the basket rests on the ground at the tunnel mouth; the
    // potter adds one more mango, then carries it back inside.
    ropeK = 0; z = -0.35; y = 0; m = f >= 690 ? 2 : 1;
    if (f >= 700 && f <= 730) z = lerp(-0.35, 0.3, smooth(ramp(f, 700, 730)));
    if (f >= 731) k = 0;
  }
  else if (f >= 825 && f <= 923) { if (f >= 900) y = lerp(0.72, -3.3, smooth(ramp(f, 900, 920))); }
  else if (f >= 924 && f <= 1013) { y = -3.3; }
  else if (f >= 1014 && f <= 1118) { y = f < 1025 ? -3.3 : lerp(-3.3, 0.72, smooth(ramp(f, 1025, 1065))); p = 1; }
  else if (f >= 1119 && f <= 1327) { p = 1; }
  return { x, y, z, k, ropeK, contMango: m, contCoins: c, contPainted: p };
};
export const brickAt = (f) => {
  if (f < 825 || f > 923) return { k: 0, x: 0, y: -10, z: 0, yaw: 0, glint: 0 };
  const s = sethAt(f), B = basketAt(f);
  let x, y, z;
  if (f < 888) { x = s.x - 0.38; y = 1.02; z = s.z - 0.25; }
  else if (f <= 898) { const u = ramp(f, 888, 898); x = lerp(s.x - 0.38, 0, u); z = lerp(s.z - 0.25, WELL.z, u); y = lerp(1.02, B.y + 0.45, u * u * (3 - 2 * u)) + Math.sin(u * Math.PI) * 0.5; }
  else { x = 0; z = WELL.z; y = B.y + 0.45; }
  const glint = f < 898 ? 0.55 + 0.45 * Math.sin(ramp(f, 825, 898) * Math.PI * 3) : 0.3;
  return { k: 1, x, y, z, yaw: 0.2, glint: Math.max(0, glint) };
};
export const dropAt = (f) => {
  if (f >= 131 && f <= 140) { const u = ramp(f, 131, 140); return { k: 1, kind: 1, x: lerp(-1.05, 0, u), y: lerp(1.15, 1.18, u) + Math.sin(u * Math.PI) * 0.5, z: lerp(4.15, WELL.z, u) }; }
  if (f >= 207 && f <= 216) { const u = ramp(f, 207, 216); return { k: 1, kind: 2, x: lerp(1.25, 0, u), y: lerp(1.2, 1.18, u) + Math.sin(u * Math.PI) * 0.45, z: lerp(4.15, WELL.z, u) }; }
  return { k: 0, kind: 0, x: 0, y: -10, z: 0 };
};
export const slabAt = (f) => {
  if (f < 540) return 0;
  if (f <= 600) return smooth(ramp(f, 540, 558));
  if (f <= 738) return 1;
  if (f <= 1124) return 0;
  if (f <= 1327) return smooth(ramp(f, 1125, 1145));
  return 1 - smooth(ramp(f, 1330, 1350));
};
export const lanternAt = (f) => {
  if (f >= 601 && f <= 738) return smooth(ramp(f, 601, 620));
  if (f >= 924 && f <= 1013) return 0.85 * smooth(ramp(f, 950, 990));
  if (f >= 1014 && f <= 1040) return 0.85 * (1 - smooth(ramp(f, 1014, 1040)));
  return 0;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  boy: () => { const b = boyAt(130); return [b.x, 0.95, b.z]; },
  boymorn: () => [0, 1.0, 2],
  farmer: () => { const a = farmerAt(205); return [a.x, 1.3, a.z]; },
  farmermorn: () => [0, 1.0, 2],
  crowd: () => [0, 1.1, 3.2],
  secret: () => { const p = potterAt(460); return [p.x, 1.1, p.z]; },
  tunnel: () => MOUTH,
  night: () => [0.2, 0.6, 0],
  why: () => { const p = potterAt(780); return [p.x, 1.1, p.z]; },
  seth: () => { const s = sethAt(880); return [s.x, 1.3, s.z]; },
  wait: () => { const s = sethAt(960); return [s.x, 1.3, s.z]; },
  payoff: () => { const B = basketAt(1065); return [B.x, B.y + 0.4, B.z]; },
  emerge: () => { const p = potterAt(1160); return [p.x, 1.2, p.z]; },
  dialogue: () => { const p = potterAt(1260); return [p.x, 1.45, p.z]; },
  after: () => [0, 1.1, 2.6],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const potterPos = (f) => { const p = potterAt(f); return [p.x, 0, p.z]; };
const sethPos = (f) => { const s = sethAt(f); return [s.x, 0, s.z]; };
const boyPos = (f) => { const b = boyAt(f); return [b.x, 0, b.z]; };
const farmerPos = (f) => { const a = farmerAt(f); return [a.x, 0, a.z]; };
const basketPos = (f) => { const B = basketAt(f); return [B.x, B.y, B.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[20, 12, 26], [12, 7, 18], [8.5, 4.2, 14.5], [6.8, 2.9, 12.6]],
    [[0, 3.0, -8], [0, 2.2, -3], [0, 1.2, 1.4], [0, 1.0, 2.2]], 0, 108, 44, 40) },
  boy: { cut: 'hard', raw: keysCam({ keys: [
    { f: 109, pos: [-2.9, 1.7, 7.6], look: [-1.3, 1.05, 4.35], fov: 36 },
    { f: 126, pos: [-3.3, 1.95, 8.1], look: [-0.9, 1.0, 3.7], fov: 36 },
    { f: 148, pos: [-3.64, 2.2, 8.58], look: [-0.5, 1.0, 3.0], fov: 35, ease: 'surge' }] }) },
  boymorn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 149, pos: [-3.9, 2.3, 9.2], look: [-0.4, 0.95, 2.9], fov: 37 },
    { f: 186, pos: [-3.5, 2.1, 8.7], look: [-0.45, 0.95, 2.9], fov: 35, ease: 'surge' }] }) },
  farmer: { cut: 'hard', raw: keysCam({ keys: [
    { f: 187, pos: [3.6, 1.7, 8.2], look: [1.5, 1.25, 4.4], fov: 36 },
    { f: 205, pos: [4.1, 1.95, 8.7], look: [0.9, 1.05, 3.6], fov: 36 },
    { f: 223, pos: [4.35, 2.2, 8.96], look: [0.5, 1.0, 3.0], fov: 35, ease: 'surge' }] }) },
  farmermorn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 224, pos: [4.8, 2.6, 10.6], look: [-0.2, 1.0, 2.1], fov: 38 },
    { f: 265, pos: [4.4, 2.4, 10.0], look: [-0.2, 1.0, 2.1], fov: 35, ease: 'surge' }] }) },
  crowd: { cut: 'hard', raw: keysCam({ keys: [
    { f: 266, pos: [7.6, 3.2, 14.5], look: [0, 1.1, 2.6], fov: 44 },
    { f: 382, pos: [6.9, 3.0, 13.6], look: [0, 1.1, 2.6], fov: 41, ease: 'surge' }] }) },
  secret: { cut: 'hard', raw: keysCam({ keys: [
    { f: 383, pos: [6.9, 3.0, 13.6], look: [0, 1.1, 2.6], fov: 41 },
    { f: 502, pos: [1.8, 2.0, -0.5], look: [4.2, 1.1, -4.2], fov: 36, ease: 'surge' }] }) },
  tunnel: { cut: 'hard', raw: keysCam({ keys: [
    { f: 503, pos: [5.2, 1.9, -4.6], look: [0.5, 0.7, 0.25], fov: 42 },
    { f: 600, pos: [4.6, 1.7, -4.2], look: [0.5, 0.65, 0.25], fov: 40, ease: 'surge' }] }) },
  night: { cut: 'hard', raw: keysCam({ keys: [
    { f: 601, pos: [7.6, 2.2, -8.4], look: [4.2, 1.0, -4.2], fov: 40 },
    { f: 665, pos: [4.8, 1.8, -4.2], look: [0.45, 0.65, 0.15], fov: 40 },
    { f: 738, pos: [4.5, 1.7, -3.9], look: [0.45, 0.65, 0.15], fov: 38, ease: 'surge' }] }) },
  why: { cut: 'hard', raw: keysCam({ keys: [
    { f: 739, pos: [-5.5, 2.6, 10.5], look: [0.3, 1.0, 1.8], fov: 42 },
    { f: 824, pos: [-4.9, 2.4, 9.8], look: [0.4, 1.05, 1.8], fov: 39, ease: 'surge' }] }) },
  seth: { cut: 'hard', raw: keysCam({ keys: [
    { f: 825, pos: [9.2, 2.4, 13.2], look: [4.6, 1.15, 5.6], fov: 38 },
    { f: 878, pos: [7.0, 2.0, 11.0], look: [2.2, 1.05, 4.0], fov: 35 },
    { f: 923, pos: [6.2, 1.9, 10.2], look: [1.3, 1.0, 3.2], fov: 33, ease: 'surge' }] }) },
  wait: { cut: 'hard', raw: staticTrackCam({ pos: [5.6, 2.3, 11.8], subject: sethPos, lookOff: [0, 1.2, 0], fov: 38 }) },
  payoff: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1014, pos: [6.4, 3.2, 9.4], look: [1.2, 1.1, 3.4], fov: 36 },
    { f: 1055, pos: [5.2, 2.9, 7.6], look: [0.4, 1.0, 2.3], fov: 34 },
    { f: 1118, pos: [4.5, 2.6, 6.4], look: [0.2, 1.05, 2.1], fov: 33, ease: 'surge' }] }) },
  emerge: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1119, pos: [4.6, 1.8, -2.8], look: [0.3, 0.8, 0.3], fov: 40 },
    { f: 1203, pos: [6.4, 2.6, 10.8], look: [1.7, 1.2, 3.6], fov: 38, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: potterPos, a: 1204, b: 1327, d0: 3.6, d1: 2.9, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  after: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1328, pos: [8.8, 3.6, 15.5], look: [0, 1.1, 2.4], fov: 44 },
    { f: 1453, pos: [8.2, 3.4, 14.6], look: [0, 1.1, 2.4], fov: 42, ease: 'surge' }] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1454, pos: [8.2, 3.4, 14.6], look: [0, 1.1, 2.4], fov: 42 },
    { f: 1499, pos: [6.3, 3.4, 4.0], look: [0, 3.22, -8.12], fov: 38, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1500, pos: [6.3, 3.4, 4.0], look: [0, 3.22, -8.12], fov: 38 },
    { f: 1528, pos: [6.05, 3.45, 3.7], look: [0, 3.27, -8.17], fov: 37, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 898, a: 0.03 }, { f: 1058, a: 0.03 }],
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
  if (['tunnel', 'night', 'dialogue', 'payoff'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), B = basketAt(f), br = brickAt(f), dr = dropAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    basketX: B.x, basketY: B.y, basketZ: B.z, basketK: B.k, ropeK: B.ropeK,
    contMango: B.contMango, contCoins: B.contCoins, contPainted: B.contPainted,
    brickX: br.x, brickY: br.y, brickZ: br.z, brickK: br.k, brickYaw: br.yaw, glintK: br.glint,
    dropX: dr.x, dropY: dr.y, dropZ: dr.z, dropK: dr.k, dropKind: dr.kind,
    slabK: slabAt(f), lanternK: lanternAt(f),
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 16, 30)) * (1 - smooth(ramp(f, 42, 56)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1484, 1498));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const shimmer = S.light === 'night' ? 0.08 : (S.id === 'wait' ? 0.2 : 0.55);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: shimmer, grey: S.light === 'night' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffffff', night: '#aebadd', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  potter: { jacket: '#cbb59a', pants: '#8a6f52', boots: '#4a3826', hat: 'hair', hair: '#d8d0bc', skin: '#8a5a34', moustache: '#d8d0bc' },
  seth: { jacket: '#7a1f3a', pants: '#3a2a4a', boots: '#241a12', hat: 'cap', cap: '#d9a441', skin: '#c98a5a', moustache: '#241a12', build: 'stout' },
  boy: { jacket: '#3a7a8c', pants: '#5a4632', boots: '#2c2015', hat: 'hair', hair: '#1c1410', skin: '#a06a3c' },
  farmer: { jacket: '#5d7a2e', pants: '#4a3b28', boots: '#2c2015', hat: 'cap', cap: '#a8894f', skin: '#8a5a34', moustache: '#2a201a' },
  v1: { jacket: '#8c4a5a', pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  v2: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#7a8a99', skin: '#a06a3c', moustache: '#241a12' },
  v3: { jacket: '#a8873a', pants: '#3a332a', boots: '#241a12', hat: 'hair', hair: '#101010', skin: '#7a4a2a' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const pt = potterAt(f), st = sethAt(f), by = boyAt(f), fa = farmerAt(f);
  const ptBase = { expr: 'neutral', mode: potterMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 };
  const bgCast = () => {
    std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, -5.2, -6.2, { yaw: 0.3 });
    std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 72), seed: 72 }, -9.8, -6.5, { yaw: 0.5 });
    std('v3', OUTFITS.v3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 73), seed: 73 }, -10.2, -1.8, { yaw: 0.6 });
  };
  const arcCast = (exprs) => {
    std('v1', OUTFITS.v1, { expr: exprs[0], mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, -2.7, 5.0, { yaw: 0.25 });
    std('v2', OUTFITS.v2, { expr: exprs[1], mode: 'stand', blink: blinkAt(f, 72), seed: 72 }, 0.1, 5.4, { yaw: 0 });
    std('v3', OUTFITS.v3, { expr: exprs[2], mode: 'stand', blink: blinkAt(f, 73), seed: 73 }, -3.6, 4.6, { yaw: -0.25 });
  };
  switch (S.id) {
    case 'drone': {
      std('potter', OUTFITS.potter, { ...ptBase }, pt.x, pt.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      std('seth', OUTFITS.seth, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, st.x, st.z, { yaw: -0.5 });
      bgCast();
      break;
    }
    case 'boy': {
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 21), seed: 21, prop: f >= 126 && f <= 148 ? ['point', 0.62] : null }, by.x, by.z, { s: 0.8, yaw: 0.35 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.35 });
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'smile_closed' }, pt.x, pt.z, { yaw: -0.4 });
      break;
    }
    case 'boymorn': {
      std('boy', OUTFITS.boy, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      break;
    }
    case 'farmer': {
      std('farmer', OUTFITS.farmer, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: f >= 202 && f <= 223 ? ['point', 0.62] : null }, fa.x, fa.z, { yaw: -0.3 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.35 });
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'smile_closed' }, pt.x, pt.z, { yaw: -0.4 });
      break;
    }
    case 'farmermorn': {
      std('farmer', OUTFITS.farmer, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      break;
    }
    case 'crowd': {
      std('boy', OUTFITS.boy, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      arcCast(['shock', 'smile', 'shock']);
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'smile_closed' }, pt.x, pt.z, { yaw: -0.4 });
      break;
    }
    case 'secret': {
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'neutral', headTilt: 0.06 }, pt.x, pt.z, { yaw: -0.5 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, -5.2, -6.2, { yaw: 0.3 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 72), seed: 72 }, -9.8, -6.5, { yaw: 0.5 });
      break;
    }
    case 'tunnel': {
      std('potter', OUTFITS.potter, { ...ptBase, prop: f >= 536 && f <= 575 ? ['point', 0.7] : null }, pt.x, pt.z, { yaw: 0.4 });
      break;
    }
    case 'night': {
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'neutral', headTilt: f >= 700 ? 0.14 : 0.05, prop: f >= 672 && f <= 700 ? ['point', 0.5] : null }, pt.x, pt.z, { yaw: 0.35 });
      break;
    }
    case 'why': {
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'smile_closed', headTilt: -0.05 }, pt.x, pt.z, { yaw: -0.3 });
      std('boy', OUTFITS.boy, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, -2.7, 5.0, { yaw: 0.25 });
      std('v3', OUTFITS.v3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 73), seed: 73 }, -3.6, 4.6, { yaw: -0.25 });
      break;
    }
    case 'seth': {
      std('seth', OUTFITS.seth, { expr: 'grin', mode: sethMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51, prop: f >= 884 && f <= 902 ? ['point', 0.55] : null }, st.x, st.z, { yaw: -0.45 });
      std('boy', OUTFITS.boy, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      arcCast(['nervous', 'neutral', 'nervous']);
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'neutral' }, pt.x, pt.z, { yaw: -0.4 });
      break;
    }
    case 'wait': {
      std('seth', OUTFITS.seth, { expr: f >= 975 ? 'smile_closed' : 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt: f >= 960 ? q(smooth(ramp(f, 960, 1000)) * 0.22, 2) : 0 }, st.x, st.z, { yaw: -0.4 });
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'neutral' }, pt.x, pt.z, { yaw: -0.4 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 72), seed: 72 }, -9.8, -6.5, { yaw: 0.5 });
      break;
    }
    case 'payoff': {
      const shocked = f >= 1055;
      std('seth', OUTFITS.seth, { expr: shocked ? (f >= 1090 ? 'dazed' : 'shock') : 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt: f >= 1090 ? 0.12 : 0 }, st.x, st.z, { yaw: -0.5 });
      std('boy', OUTFITS.boy, { expr: shocked ? 'laugh' : 'smile', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: shocked ? 'shock' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      arcCast([shocked ? 'shock' : 'smile', shocked ? 'shock' : 'smile', shocked ? 'shock' : 'neutral']);
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'smile_closed' }, pt.x, pt.z, { yaw: -0.4 });
      break;
    }
    case 'emerge': {
      std('potter', OUTFITS.potter, { ...ptBase, expr: f >= 1180 ? 'neutral' : 'stern' }, pt.x, pt.z, { yaw: 0.3 });
      std('seth', OUTFITS.seth, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, st.x, st.z, { yaw: -0.5 });
      std('boy', OUTFITS.boy, { expr: f >= 1180 ? 'smile' : 'shock', mode: 'stand', blink: blinkAt(f, 21), seed: 21 }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: f >= 1180 ? 'smile' : 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      arcCast([f >= 1180 ? 'smile' : 'shock', f >= 1180 ? 'smile' : 'shock', f >= 1180 ? 'smile' : 'neutral']);
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the POTTER performs his line — mouth driven
      // by the stem inside the speak segment, closed outside it; Seth
      // and the crowd only listen (narration stays voice-over).
      std('potter', OUTFITS.potter, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.12, ...speakFace('smile', f) }, pt.x, pt.z, { yaw: 0.45 });
      std('seth', OUTFITS.seth, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, st.x, st.z, { yaw: -0.5 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, -2.7, 5.0, { yaw: 0.25 });
      std('v2', OUTFITS.v2, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 72), seed: 72 }, 0.1, 5.4, { yaw: 0 });
      break;
    }
    case 'after': {
      std('potter', OUTFITS.potter, { ...ptBase, expr: 'smile' }, pt.x, pt.z, { yaw: 0.3 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 21), seed: 21, prop: ['point', 0.5] }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, fa.x, fa.z, { yaw: -0.3 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, -2.7, 5.0, { yaw: 0.25 });
      std('v3', OUTFITS.v3, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 73), seed: 73 }, -3.6, 4.6, { yaw: -0.25 });
      std('seth', OUTFITS.seth, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt: 0.15 }, st.x, st.z, { yaw: -0.5 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(WELL.x, WELL.z, 1.75, { h: WELL.top, id: 'well' }),
  SOL.circle(KILN.x, KILN.z, 1.55, { h: 1.7, id: 'kiln' }),
  SOL.circle(-8.8, 1.2, 0.65, { h: 3, id: 'tree' }),
  SOL.circle(WELL.x - 1.88, WELL.z, 0.1, { h: 2.75, id: 'beampost' }),
  SOL.circle(WELL.x + 1.88, WELL.z, 0.1, { h: 2.75, id: 'beampost' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.4, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.4, id: 'boardpost' }),
  SOL.obb(-6.4, -8.2, 0.3, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(10.8, -5.5, -0.45, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(-11.5, -3.5, 0.6, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(7.8, -12.5, -0.2, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(-3.4, -14.5, 0.1, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.circle(-2.2, 3.6, 0.24, { h: 0.45, id: 'pitcher' }),
  SOL.circle(-2.5, 2.9, 0.24, { h: 0.45, id: 'pitcher' }),
  SOL.circle(3.3, 1.15, 0.24, { h: 0.45, id: 'pitcher' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const B = basketAt(f);
  // the basket is a suspended/carried prop (unchecked) EXCEPT on the
  // night beat, where it RESTS on the ground at the tunnel mouth.
  if (f >= 601 && f <= 730 && B.k) items.push({ id: 'basket', y: B.y, ground: 0, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
