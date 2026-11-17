// Shot plan for "बिना पहिये वाली गाड़ी" — cart-hindi (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 8 topic 3 (Hindi). ONE set: a village stony
// road between a carpenter's workshop (west) and a godown (east), grain
// field to the south-east. A carpenter, tired of wheels breaking on the
// stones, builds a cart with NO wheels: it rides on hard wooden balls
// seated in grooved rails under the bed (ancient ball bearings). A worn
// ball is swapped mid-journey without stopping; on harvest day his cart
// alone keeps running and saves the grain.
// Voice stem: 54.611 s, 30 fps, TOTAL 1638; timings from faster-whisper
// small word alignment + char-level line mapping (timing.json; Hindi
// spellings garbled — timings only). Scene changes ONLY at clause
// boundaries (line starts, frames):
//   L1 0-113     उस बढ़ई की गाड़ी में पहिये थे ही नहीं...
//   L2 113-208   पथरीली सड़क... पहिया तोड़ देती थी।
//   L3 208-328   बढ़ई का अपना पहिया भी तीन बार टूटा...
//   L4 328-427   उसने गाड़ी के नीचे खाँचे बनाकर... गोले भर दिए।
//   L5 436-530   गाड़ी उन्हीं गोलों पर लुढ़कती चल पड़ी...
//   L6 539-610   गोला पत्थर पर रुकता नहीं, उछलकर आगे निकल जाता है।
//   L7 610-727   कोई गोला घिस जाए तो... गाड़ी रुकती ही नहीं।
//   L8 736-817   गाँव वाले हँसने लगे... खिलौना बना लिया है।
//   L9 826-914   फिर कटाई के दिन बादल घिर आए...
//   L10 914-994  बाकी गाड़ियों के पहिये पत्थरों और कीचड़ में टूटते रहे।
//   L11 1003-1109 बढ़ई की गाड़ी दिन भर दौड़ती रही... गोदाम पहुँच गया।
//   L12 1118-1199 उस शाम एक नौजवान गाड़ीवान ने... राज़ पूछा।
//   L13 1199-1271 बढ़ई ने एक गोला उसकी हथेली पर रखकर कहा।   (tag)
//   L14 1282-1356 "पहिये टूट जाते हैं, बेटा। गोले सिर्फ घूमते हैं।" (DIALOGUE)
//   L15 1366-1480 कहते हैं, पुराने ज़माने में... खिसकाए जाते थे।
//   L16 1493-1631 लेकिन कल... बज उठती थी?
// GRADE (FILTER_VFX_LIGHTING pack): Golden Hour throughout; the harvest
// threat (L9-L10) blends toward Monsoon Grey and back on clause
// boundaries only; evening beats settle into the Golden Hour dusk tail.
// Signature VFX: rotating balls with readable pegs, road dust trailing
// the cart, the stone-bump hop, storm clouds gathering over the field.
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

export const FPS = 30, TOTAL = 1638, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 112, light: 'gold' },
  { id: 'road', a: 113, b: 207, light: 'gold' },
  { id: 'broke', a: 208, b: 327, light: 'gold' },
  { id: 'grooves', a: 328, b: 435, light: 'gold' },
  { id: 'rollout', a: 436, b: 538, light: 'gold' },
  { id: 'bump', a: 539, b: 609, light: 'gold' },
  { id: 'swap', a: 610, b: 735, light: 'gold' },
  { id: 'laugh', a: 736, b: 825, light: 'gold' },
  { id: 'harvest', a: 826, b: 913, light: 'grey' },
  { id: 'mud', a: 914, b: 1002, light: 'grey' },
  { id: 'trips', a: 1003, b: 1117, light: 'gold' },
  { id: 'evening', a: 1118, b: 1198, light: 'dusk' },
  { id: 'palm', a: 1199, b: 1281, light: 'dusk' },
  { id: 'dialogue', a: 1282, b: 1365, light: 'dusk' },
  { id: 'slab', a: 1366, b: 1492, light: 'dusk' },
  { id: 'hookq', a: 1493, b: 1599, light: 'dusk' },
  { id: 'hook', a: 1600, b: 1637, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  gold: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  grey: { az: 232, el: 34, sky: '#bcc3c6', ground: '#6b6e66', hemi: 1.15, sun: '#d4d9dc', sunI: 1.25, fog: '#b4bab4', fogNear: 34, fogFar: 260,
    skyTop: '#5d6d7c', skyHor: '#c3c8c2', sunDisc: '#000000', sunSize: 0, sat: 0.6, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ccd2d4',
    waterDeep: '#24343c', waterShal: '#3c545e', glint: '#cfd8dc' },
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
// storm-grey amount: gathers over the harvest threat, breaks for the trips
export const greyAmt = (f) => {
  if (f < 826) return 0;
  if (f < 914) return smooth(ramp(f, 826, 872));
  if (f < 1003) return 0.88;
  if (f < 1118) return 0.88 * (1 - smooth(ramp(f, 1003, 1052)));
  return 0;
};
export const duskAmt = (f) => (f < 1118 ? 0 : smooth(ramp(f, 1118, 1162)));
export const lightFor = (S, f) => blendLight(blendLight(LIGHTS.gold, LIGHTS.grey, greyAmt(f)), LIGHTS.dusk, duskAmt(f));

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [-2.7, 3.55, -2.3]; // HOOK board: east + raised, clear of the workshop roof from the low hook camera (eye-check fix — the old shared spot hid line 3 behind the roof in the final frame)
export const TITLE_POS = [-4.5, 3.05, -3.4]; // TITLE board keeps the original gantry — proven fully in frame from the high drone camera; the raised hook spot overflows the drone frame's right edge
export const ROAD_Z = 3.5;
export const BUMP = { x: 0.8, z: 3.95, r: 0.17 };
export const BALL_R = 0.17;

// ---------- THE CART's path (keys: f, x, z, yaw) ----------
// The cart exists in the drone (present day), vanishes for the two
// flashback beats (road/broke — only wheeled carts there), is built in
// grooves, then works for the rest of the film. Position jumps happen
// ONLY across shot boundaries (hard cuts); cumulative travel distance
// (for ball spin) is accumulated per-shot so cuts never spin the balls.
const CART_KEYS = [
  [0, -3.4, 3.5, 0], [112, -0.6, 3.5, 0],
  [113, -7.3, 0.9, 0.25], [435, -7.3, 0.9, 0.25],
  [478, -5.7, 2.1, 0.08], [538, -2.6, 3.5, 0],
  [609, 2.6, 3.5, 0], [735, 4.3, 3.5, 0], [825, 7.6, 3.5, 0],
  [826, 2.6, 3.5, 0], [913, 2.6, 3.5, 0],
  [914, 6.8, 3.5, 0], [1002, 6.8, 3.5, 0],
  [1003, 2.6, 3.5, 0], [1045, 8.2, 3.5, 0], [1064, 8.2, 3.5, 0],
  [1074, 8.2, 3.5, Math.PI], [1096, 2.6, 3.5, Math.PI], [1117, 2.6, 3.5, Math.PI],
  [1118, -7.3, 0.9, 0.25], [1637, -7.3, 0.9, 0.25],
];
const walkKeys3 = (keys, f) => {
  let cur = keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], u = smooth(ramp(f, a[0], b[0]));
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
    }
    cur = keys[i];
  }
  return [cur[1], cur[2], cur[3]];
};
export const cartRawAt = (f) => { const [x, z, yaw] = walkKeys3(CART_KEYS, f); return { x, z, yaw }; };
// cumulative travel distance per frame (cuts excluded)
const DIST = (() => {
  const d = new Float64Array(TOTAL);
  let prev = cartRawAt(0), acc = 0;
  for (let f = 0; f < TOTAL; f++) {
    const p = cartRawAt(f);
    if (f > 0 && shotAt(f).id === shotAt(f - 1).id) acc += Math.hypot(p.x - prev.x, p.z - prev.z);
    d[f] = acc; prev = p;
  }
  return d;
})();
export const cartDistAt = (f) => DIST[Math.max(0, Math.min(TOTAL - 1, f))];
export const cartSpeedAt = (f) => (cartDistAt(f) - cartDistAt(Math.max(0, f - 1))) * 30; // m/s
const gauss = (d, w) => Math.exp(-((d / w) ** 2));
export const cartAt = (f) => {
  const p = cartRawAt(f), S = shotAt(f), speed = cartSpeedAt(f);
  let y = 0, pitch = 0, roll = 0;
  if (speed > 0.05) y += 0.005 * Math.sin(cartDistAt(f) * 24) * Math.min(1, speed); // stone rumble
  if (S.id === 'bump') {
    // the south-row balls hop the embedded stone: front row, then rear
    const fi = gauss((p.x + 0.63) - BUMP.x, 0.20), ri = gauss((p.x - 0.63) - BUMP.x, 0.20);
    y += 0.055 * fi + 0.042 * ri;
    pitch = (fi - ri) * 0.05;
    roll = -(0.035 * fi + 0.028 * ri);
  }
  return { x: p.x, y, z: p.z, yaw: p.yaw, speed, dist: cartDistAt(f), pitch, roll };
};
export const cartKAt = (f) => (shotAt(f).id === 'road' || shotAt(f).id === 'broke') ? 0 : 1;
export const wornKAt = (f) => {
  if (f < 555) return 0;
  if (f < 610) return smooth(ramp(f, 555, 605));       // the stone run wears it down
  if (f < 736) return 1;                                // visibly flat through the swap
  return 0;                                             // fresh ball from the laugh beat on
};
export const swapOutAt = (f) => smooth(ramp(f, 658, 694));
export const swapInAt = (f) => smooth(ramp(f, 698, 728));
export const loadKAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'harvest') return 3 * smooth(ramp(f, 845, 905));
  if (S === 'trips') {
    if (f < 1045) return 3;
    if (f < 1096) return 3 * (1 - smooth(ramp(f, 1045, 1058)));
    return 3 * smooth(ramp(f, 1096, 1112));
  }
  return 0;
};
export const stackKAt = (f) => (f < 1048 ? 0 : 3 * smooth(ramp(f, 1048, 1064)));

// ---------- the wheeled cart (the one that keeps breaking) ----------
const WCART_KEYS = [
  [113, -6.2, 3.55, 0], [176, -3.15, 3.55, 0], [207, -3.15, 3.55, 0],
  [208, -9.75, 1.15, 0.5], [913, -9.75, 1.15, 0.5],
  [914, -2.4, 3.75, 0], [1002, -2.4, 3.75, 0],
];
const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2], yaw = keys[0][3];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2]; yaw = keys[keys.length - 1][3];
  }
  return [x, z, yaw];
};
export const wcartAt = (f) => { const [x, z, yaw] = walkKeys(WCART_KEYS, f); return { x, z, yaw }; };
export const wcartKAt = (f) => ['road', 'broke', 'mud'].includes(shotAt(f).id) ? 1 : 0;
export const wbreakAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'road') return smooth(ramp(f, 180, 198));
  if (S === 'broke') return 1;
  if (S === 'mud') return smooth(ramp(f, 948, 982));
  return 0;
};

// ---------- the ancient slab ----------
export const slabAt = (f) => {
  const x = lerp(5.6, 7.4, smooth(ramp(f, 1380, 1478)));
  return { x, z: -0.6, k: shotAt(f).id === 'slab' ? 1 : 0, ang: (x - 5.6) / 0.22 };
};

// ---------- the palm ball (dialogue beat contact) ----------
const PALM_A = [-7.24, 1.29, 2.08];  // the carpenter's extended point hand
const PALM_B = [-7.31, 1.27, 2.09];  // resting on the young man's raised palm
export const palmAt = (f) => {
  if (f < 1199 || f >= 1282) return { x: PALM_A[0], y: -5, z: PALM_A[2], k: 0 }; // palm shot only — in the dialogue close-up the ball rests out of frame on the palm
  const u = smooth(ramp(f, 1226, 1256));
  return { x: lerp(PALM_A[0], PALM_B[0], u), y: lerp(PALM_A[1], PALM_B[1], u) + Math.sin(u * Math.PI) * 0.05, z: lerp(PALM_A[2], PALM_B[2], u), k: ramp(f, 1205, 1216) };
};
export const cloudKAt = (f) => smooth(ramp(f, 838, 895)) * (1 - smooth(ramp(f, 1003, 1055)));

// ---------- hero / focus ----------
export const CARP_HOME = { x: -7.7, z: 2.0 };
const FOCUS = {
  drone: (f) => { const c = cartAt(f); return [c.x, 0.8, c.z]; },
  road: (f) => { const w = wcartAt(f); return [w.x, 0.7, w.z]; },
  broke: () => [CARP_HOME.x, 1.2, CARP_HOME.z],
  grooves: (f) => { const c = cartAt(f); return [c.x, 0.35, c.z]; },
  rollout: (f) => { const c = cartAt(f); return [c.x, 0.6, c.z]; },
  bump: (f) => { const c = cartAt(f); return [c.x, 0.4, c.z]; },
  swap: (f) => { const c = cartAt(f); return [c.x, 0.4, c.z]; },
  laugh: (f) => { const c = cartAt(f); return [c.x, 0.8, c.z]; },
  harvest: (f) => { const c = cartAt(f); return [c.x, 0.8, c.z]; },
  mud: (f) => { const w = wcartAt(f); return [w.x, 0.7, w.z]; },
  trips: (f) => { const c = cartAt(f); return [c.x, 0.7, c.z]; },
  evening: () => [CARP_HOME.x, 1.3, CARP_HOME.z],
  palm: () => [-7.3, 1.2, 2.08],
  dialogue: () => [CARP_HOME.x, 1.45, CARP_HOME.z],
  slab: (f) => { const s = slabAt(f); return [s.x, 0.6, s.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const cartPos = (f) => { const c = cartAt(f); return [c.x, c.y, c.z]; };
const wcartPos = (f) => { const w = wcartAt(f); return [w.x, 0, w.z]; };
const carpPos = () => [CARP_HOME.x, 0, CARP_HOME.z];
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[17, 11.5, 25], [11, 7, 18.5], [7.5, 4.2, 14.5], [5.2, 2.7, 11.6]],
    [[-3.2, 1.2, 2.6], [-2.2, 0.9, 3.1], [-1.2, 0.8, 3.4], [-0.5, 0.8, 3.5]], 0, 112, 44, 40) },
  road: { cut: 'hard', raw: staticTrackCam({ pos: [-6.6, 1.7, 9.8], subject: wcartPos, lookOff: [0, 0.45, 0], fov: 38 }) },
  broke: { cut: 'hard', raw: pushInCam({ subject: carpPos, a: 208, b: 327, d0: 5.4, d1: 4.1, h0: 1.6, h1: 1.5, lookOff: [0, 1.25, 0], fov0: 38, fov1: 33,
    dir: () => [0.55, 0.78] }) },
  grooves: { cut: 'hard', raw: keysCam({ keys: [
    { f: 328, pos: [-4.9, 0.95, 4.9], look: [-7.2, 0.32, 1.0], fov: 36 },
    { f: 435, pos: [-5.4, 0.85, 4.3], look: [-7.25, 0.3, 0.95], fov: 33, ease: 'surge' }] }) },
  rollout: { cut: 'hard', raw: keysCam({ keys: [
    { f: 436, pos: [-9.6, 1.2, 5.9], look: [-7.2, 0.45, 1.3], fov: 37 },
    { f: 538, pos: [-5.1, 1.05, 7.7], look: [-2.7, 0.4, 3.4], fov: 35, ease: 'surge' }] }) },
  bump: { cut: 'hard', raw: keysCam({ keys: [
    { f: 539, pos: [-3.7, 0.95, 7.5], look: [-1.9, 0.35, 3.5], fov: 34 },
    { f: 609, pos: [1.7, 0.9, 7.6], look: [2.3, 0.35, 3.5], fov: 32, ease: 'surge' }] }) },
  swap: { cut: 'hard', raw: staticTrackCam({ pos: [3.6, 1.35, 8.8], subject: cartPos, lookOff: [0.4, 0.3, 0], fov: 40 }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 736, pos: [3.1, 1.9, 10.6], look: [4.6, 0.9, 3.2], fov: 38 },
    { f: 825, pos: [6.3, 1.8, 10.8], look: [7.3, 0.9, 3.3], fov: 36, ease: 'surge' }] }) },
  harvest: { cut: 'hard', raw: keysCam({ keys: [
    { f: 826, pos: [9.9, 3.5, 13.6], look: [3.4, 0.8, 4.6], fov: 44 },
    { f: 913, pos: [9.3, 3.2, 12.9], look: [3.2, 0.8, 4.4], fov: 42, ease: 'surge' }] }) },
  mud: { cut: 'hard', raw: staticTrackCam({ pos: [-2.0, 1.7, 10.2], subject: wcartPos, lookOff: [0, 0.45, 0], fov: 37 }) },
  trips: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1003, pos: [0.3, 2.2, 10.9], look: [2.8, 0.7, 3.5], fov: 40 },
    { f: 1117, pos: [7.7, 2.1, 11.0], look: [6.2, 0.7, 3.5], fov: 38, ease: 'surge' }] }) },
  evening: { cut: 'hard', raw: pushInCam({ subject: carpPos, a: 1118, b: 1198, d0: 5.4, d1: 4.2, h0: 1.6, h1: 1.5, lookOff: [0, 1.3, 0], fov0: 38, fov1: 34,
    dir: () => [0.5, 0.82] }) },
  palm: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1199, pos: [-5.5, 1.5, 5.5], look: [-7.3, 1.15, 2.05], fov: 34 },
    { f: 1281, pos: [-5.85, 1.45, 5.05], look: [-7.25, 1.15, 2.1], fov: 31, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: carpPos, a: 1282, b: 1365, d0: 3.3, d1: 2.7, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.42, 0.86] }) },
  slab: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1366, pos: [3.3, 1.8, 5.7], look: [5.8, 0.6, -0.6], fov: 38 },
    { f: 1492, pos: [5.1, 1.7, 5.5], look: [7.3, 0.6, -0.6], fov: 36, ease: 'surge' }] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1493, pos: [3.9, 3.4, 6.6], look: [-2.6, 3.45, -2.25], fov: 40 },
    { f: 1599, pos: [5.3, 3.85, 7.85], look: [-2.68, 3.52, -2.29], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1600, pos: [5.3, 3.85, 7.85], look: [-2.68, 3.52, -2.29], fov: 37 },
    { f: 1637, pos: [5.15, 3.9, 7.7], look: [-2.69, 3.53, -2.29], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 186, a: 0.025 }, { f: 576, a: 0.03 }, { f: 593, a: 0.02 }, { f: 965, a: 0.025 }],
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
  if (['grooves', 'bump', 'palm', 'dialogue'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), c = cartAt(f), w = wcartAt(f), s = slabAt(f), p = palmAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    cartX: c.x, cartY: c.y, cartZ: c.z, cartYaw: c.yaw, cartPitch: c.pitch || 0, cartRoll: c.roll || 0, cartK: cartKAt(f),
    ballAng: c.dist / BALL_R, swapOut: swapOutAt(f), swapIn: swapInAt(f), wornK: wornKAt(f),
    loadK: loadKAt(f), stackK: stackKAt(f),
    wcartX: w.x, wcartZ: w.z, wcartYaw: w.yaw, wcartK: wcartKAt(f), wbreak: wbreakAt(f),
    slabX: s.x, slabZ: s.z, slabK: s.k, slabAng: s.ang,
    palmX: p.x, palmY: p.y, palmZ: p.z, palmK: p.k,
    cloudK: cloudKAt(f),
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 26, 44)) * (1 - smooth(ramp(f, 66, 86)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1546, 1572));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const sp = cartSpeedAt(f);
  return { smokeRate: 0.04, dustRate: 0.04, splashRate: 0, steamRate: 0, shimmerRate: 0, cartDust: clamp(sp / 2.0, 0, 1), grey: greyAmt(f) };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffffff', grey: '#ccd2d8', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  carpenter: { jacket: '#8a5a34', pants: '#4a3826', boots: '#2c1e12', hat: 'hair', hair: '#241610', skin: '#a06a3c', moustache: '#241610' },
  driver: { jacket: '#2e5f74', pants: '#33424e', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a' },
  villager1: { jacket: '#5f7038', pants: '#3d3a2c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#8a5a34' },
  villager2: { jacket: '#7c3b2c', pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#120c08', skin: '#a06a3c', moustache: '#1c1410' },
  villager3: { jacket: '#6b5636', pants: '#2e2a33', boots: '#1c1712', hat: 'cap', cap: '#7a4a2e', skin: '#c98a5a' },
};
// the driver walks at the cart's pull-bar whenever the cart works
const driverAt = (f) => {
  const c = cartAt(f), S = shotAt(f).id;
  if (['evening', 'palm', 'dialogue'].includes(S)) return { x: -6.85, z: 2.15, moving: 0 };
  if (S === 'harvest') return { x: 4.15, z: 4.35, moving: 0 };
  if (S === 'mud') return { x: 6.6, z: 4.8, moving: 0 };
  const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw);
  const front = { x: c.x + fx * 1.98, z: c.z + fz * 1.98, moving: c.speed > 0.12 ? 1 : 0 };
  if (S === 'trips' && f >= 1040 && f <= 1084) {
    // godown choreography: peel off east, walk the south side, hold the
    // rail while the cart pivots, then round the west end to the bar
    const WP = [[1040, null], [1047, [10.35, 4.85]], [1058, [8.2, 5.15]], [1072, [8.2, 5.15]], [1078, [5.6, 4.9]], [1084, null]];
    for (let i = 1; i < WP.length; i++) {
      if (f <= WP[i][0]) {
        const [f0, P0] = WP[i - 1], [f1, P1] = WP[i];
        const A = P0 || [front.x, front.z], B = P1 || [front.x, front.z], u = smooth(ramp(f, f0, f1));
        return { x: lerp(A[0], B[0], u), z: lerp(A[1], B[1], u), moving: (f >= 1058 && f <= 1072) ? 0 : 1 };
      }
    }
  }
  return front;
};
const carpAt = (f) => {
  const S = shotAt(f).id, c = cartAt(f);
  switch (S) {
    case 'drone': return { x: -8.3, z: 0.9, mode: 'stand' };
    case 'broke': return { x: -8.35, z: 2.15, mode: 'stand' };
    case 'grooves': return { x: -6.5, z: 2.25, mode: 'sit' };
    case 'rollout': return { x: -6.9, z: 3.15, mode: 'stand' };
    case 'bump': return { x: c.x - 0.5, z: 2.02, mode: 'stroll' };
    case 'swap': return f >= 650 && f <= 732 ? { x: c.x + 0.85, z: 4.82, mode: 'sit' } : { x: c.x + 0.8, z: 4.85, mode: 'stroll' };
    case 'laugh': return { x: c.x - 0.6, z: 4.95, mode: 'stroll' };
    case 'harvest': return { x: 1.85, z: 4.55, mode: 'stand' };
    case 'mud': return { x: 7.9, z: 4.75, mode: 'stand' };
    case 'trips': return { x: 8.75, z: -0.75, mode: 'stand' };
    case 'slab': return { x: 5.0, z: 0.6, mode: 'stand' };
    default: return { x: CARP_HOME.x, z: CARP_HOME.z, mode: 'stand' };
  }
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const c = cartAt(f), d = driverAt(f), cp = carpAt(f), w = wcartAt(f), s = slabAt(f);
  const walkPhase = q((c.dist / 1.7) % 1, 2), fPhase = q((f * 0.011) % 1, 2);
  const carpBase = { mode: cp.mode, blink: blinkAt(f, 31), seed: 31, phase: fPhase };
  switch (S.id) {
    case 'drone': {
      std('driver', OUTFITS.driver, { expr: 'smile', mode: 'stroll', phase: walkPhase, blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.4 });
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile' }, cp.x, cp.z, { yaw: 0.5 });
      break;
    }
    case 'road': {
      const broken = f >= 180;
      std('villager2', OUTFITS.villager2, { expr: broken ? 'shock' : 'neutral', mode: broken ? 'stand' : 'stroll', phase: fPhase, blink: blinkAt(f, 52), seed: 52 }, w.x + 1.92, w.z, { yaw: -0.3 });
      break;
    }
    case 'broke': {
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'stern', headTilt: 0.14 }, cp.x, cp.z, { yaw: -0.7 });
      break;
    }
    case 'grooves': {
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile', headTilt: 0.22 }, cp.x, cp.z, { yaw: -0.9 });
      std('driver', OUTFITS.driver, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, -5.8, 1.4, { yaw: -0.5 });
      std('villager1', OUTFITS.villager1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 53), seed: 53 }, -5.95, 2.75, { yaw: -0.4 });
      break;
    }
    case 'rollout': {
      std('driver', OUTFITS.driver, { expr: 'smile', mode: d.moving ? 'stroll' : 'stand', phase: walkPhase, blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.4 });
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile' }, cp.x, cp.z, { yaw: 0.6 });
      std('villager1', OUTFITS.villager1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 53), seed: 53 }, -2.2, 1.7, { yaw: 0.4 });
      break;
    }
    case 'bump': case 'swap': case 'laugh': {
      std('driver', OUTFITS.driver, { expr: 'smile', mode: d.moving ? 'stroll' : 'stand', phase: walkPhase, blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.4 });
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: S.id === 'swap' && cp.mode === 'sit' ? 'stern' : 'smile', headTilt: cp.mode === 'sit' ? 0.2 : 0 }, cp.x, cp.z, { yaw: S.id === 'laugh' ? -0.5 : 0.4 });
      if (S.id === 'laugh') {
        std('villager2', OUTFITS.villager2, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 5.6, 2.05, { yaw: 0.2 });
        std('villager1', OUTFITS.villager1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 53), seed: 53 }, 6.35, 1.85, { yaw: -0.2 });
      }
      break;
    }
    case 'harvest': {
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: f < 880 ? 'nervous' : 'smile', prop: ['point', 0.5] }, cp.x, cp.z, { yaw: 0.7 });
      std('driver', OUTFITS.driver, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.6 });
      std('villager2', OUTFITS.villager2, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 52), seed: 52, headTilt: -0.08 }, 1.55, 5.3, { yaw: 0.3 });
      std('villager1', OUTFITS.villager1, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 53), seed: 53, headTilt: -0.08 }, 3.15, 4.85, { yaw: -0.3 });
      std('villager3', OUTFITS.villager3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 54), seed: 54 }, 2.6, 5.6, { yaw: 0 });
      break;
    }
    case 'mud': {
      std('villager2', OUTFITS.villager2, { expr: 'nervous', mode: 'stand', prop: ['point', 0.7], blink: blinkAt(f, 52), seed: 52 }, w.x + 1.92, w.z + 0.05, { yaw: -0.3 });
      std('villager3', OUTFITS.villager3, { expr: 'nervous', mode: 'stand', prop: ['push', 0.7], blink: blinkAt(f, 54), seed: 54, headTilt: 0.15 }, w.x - 1.95, w.z + 0.15, { yaw: 0.85 });
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile' }, cp.x, cp.z, { yaw: -0.5 });
      std('driver', OUTFITS.driver, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.5 });
      break;
    }
    case 'trips': {
      std('driver', OUTFITS.driver, { expr: 'smile', mode: d.moving ? 'stroll' : 'stand', phase: walkPhase, blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: c.yaw > 1.5 ? 0.4 : -0.4 });
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile' }, cp.x, cp.z, { yaw: -0.4 });
      break;
    }
    case 'evening': {
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile' }, cp.x, cp.z, { yaw: 0.55 });
      std('driver', OUTFITS.driver, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.55 });
      break;
    }
    case 'palm': {
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile', prop: f >= 1216 && f <= 1262 ? ['point', 0.8] : null }, cp.x, cp.z, { yaw: 0.55 });
      std('driver', OUTFITS.driver, { expr: 'smile', mode: 'stand', prop: f >= 1210 ? ['point', 0.85] : null, blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.55 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the carpenter PERFORMS his line — mouth driven
      // by the stem inside the speak segment, closed outside it; the
      // young man only listens, the ball resting on his palm.
      std('carpenter', OUTFITS.carpenter, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.12, ...speakFace('smile', f) }, cp.x, cp.z, { yaw: 0.5 });
      std('driver', OUTFITS.driver, { expr: 'smile_closed', mode: 'stand', prop: ['point', 0.85], blink: blinkAt(f, 51), seed: 51 }, d.x, d.z, { yaw: -0.5 });
      break;
    }
    case 'slab': {
      std('villager2', OUTFITS.villager2, { expr: 'stern', mode: 'stand', prop: ['push', 0.65], headTilt: 0.18, blink: blinkAt(f, 52), seed: 52 }, s.x - 1.68, s.z - 0.35, { yaw: 0.85 });
      std('villager1', OUTFITS.villager1, { expr: 'stern', mode: 'stand', prop: ['push', 0.65], headTilt: 0.18, blink: blinkAt(f, 53), seed: 53 }, s.x - 1.68, s.z + 0.35, { yaw: 0.85 });
      std('carpenter', OUTFITS.carpenter, { ...carpBase, expr: 'smile' }, cp.x, cp.z, { yaw: 0.7 });
      std('driver', OUTFITS.driver, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, 8.9, 0.9, { yaw: -0.6 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-11.4, -5.7, -5.2, -4.9, { h: 2.5, id: 'workshopBack' }),
  SOL.aabb(-11.4, -11.0, -5.0, -1.3, { h: 2.5, id: 'workshopW' }),
  SOL.aabb(-6.0, -5.6, -5.0, -1.3, { h: 2.5, id: 'workshopE' }),
  SOL.aabb(-4.2, -0.8, -9.0, -6.2, { h: 2.1, id: 'hut1' }),
  SOL.aabb(2.9, 6.3, -9.5, -6.7, { h: 2.1, id: 'hut2' }),
  SOL.aabb(7.5, 12.9, -5.1, -1.7, { h: 3.1, id: 'godown' }),
  SOL.circle(-12.6, -0.8, 0.25, { h: 2.5, id: 'tree' }),
  SOL.circle(13.6, -6.6, 0.3, { h: 2.8, id: 'tree' }),
  SOL.circle(-4.2, -11, 0.22, { h: 2.2, id: 'tree' }),
  SOL.circle(14.8, 1.8, 0.2, { h: 2.0, id: 'tree' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 4.5, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 4.5, id: 'boardpost' }),
  SOL.circle(TITLE_POS[0] - 2.1, TITLE_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(TITLE_POS[0] + 2.1, TITLE_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BUMP.x, BUMP.z, 0.12, { h: 0.15, id: 'bumpstone', group: 'bump' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  const c = cartAt(f);
  if (cartKAt(f)) out.push(SOL.obb(c.x, c.z, c.yaw, 1.05, 0.62, { kind: 'dynamic', id: 'cart', group: 'bump' }));
  const w = wcartAt(f);
  if (wcartKAt(f)) out.push(SOL.obb(w.x, w.z, w.yaw, 1.0, 0.68, { kind: 'dynamic', id: 'wcart' }));
  const s = slabAt(f);
  if (s.k) out.push(SOL.obb(s.x, s.z, 0, 1.25, 0.7, { kind: 'dynamic', id: 'slab' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const c = cartAt(f);
  // the cart's ground plane is the bottom of its balls; over the bump
  // stone it legitimately rises (maxHover covers the hop + rumble)
  if (cartKAt(f)) items.push({ id: 'cart', y: c.y, ground: 0, maxHover: 0.1 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
