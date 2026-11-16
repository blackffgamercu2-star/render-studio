// Shot plan for "टोल वसूलने वाला बंदर" (The Monkey Who Collected the Toll) —
// Batch 6 Topic 2 HINDI (LIBRARY v4: speak.js dialogue performance +
// materials v4, camrig smooth tracking rig + solid colliders,
// FILTER+VFX+LIGHTING pack applied). Re-time of the EN build: identical
// scenes, sets, camera design, grades and VFX; the picture is re-timed to
// the Hindi stem through a clause-boundary warp (ef: HI frame -> EN frame).
// GRADE PLAN (pack): Sunny Pop for the whole jungle-road story; Memory Warm
// for the 'secret' flashback beat; Golden Hour blend for the cap payoff and
// the hook board. Boards are never graded (drawn after, full contrast).
// SIGNATURE VFX: dappled leaf light on the road, dust at cart wheels,
// drifting motes/fireflies in light shafts, bunting/gate-cloth sway in
// gusts, dust bursts on troop landings and monkey hops.
// Voice stem: 50.891 s, 30 fps, TOTAL 1527 (timings from faster-whisper
// word alignment on stem_hi.wav, see timing.json). Scene changes ONLY at
// Hindi clause starts. Boards: Devanagari, verbatim from script_hi.txt.
// World: dirt road along Z (x in [-2.6, 2.6]); toll gate at z=0 (posts at
// x=+-2.3, bamboo barrier pivots on the +x post); the monkey's stump at
// (3.3,-1.3); its weight platform at (3.0,0.6) — stepping on dips the deck
// and the rope lifts the barrier (barrier angle = platK, same function).
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.55 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1527, DECK = 0;
const TOTAL_EN = 1731;
// HI frame -> EN frame, piecewise-linear over clause-boundary anchors
// (HI and EN stems carry the same 18 clauses in the same order).
const WARP_HI = [0, 110, 221, 266, 386, 486, 530, 575, 636, 716, 816, 889, 939, 1042, 1174, 1218, 1285, 1394, 1527];
const WARP_EN = [0, 116, 243, 289, 411, 510, 567, 615, 703, 789, 914, 983, 1046, 1179, 1340, 1390, 1446, 1557, 1731];
const ef = (f) => {
  if (f <= 0) return 0;
  if (f >= TOTAL - 1) return TOTAL_EN - 1;
  let i = 0;
  while (i < WARP_HI.length - 2 && f > WARP_HI[i + 1]) i++;
  const h0 = WARP_HI[i], h1 = WARP_HI[i + 1], e0 = WARP_EN[i], e1 = WARP_EN[i + 1];
  return e0 + (e1 - e0) * (f - h0) / (h1 - h0);
};
export const SHOTS = [
  { id: 'drone', a: 0, b: 109, light: 'sunny' },
  { id: 'barrier', a: 110, b: 220, light: 'sunny' },
  { id: 'pays', a: 221, b: 265, light: 'sunny' },
  { id: 'platform', a: 266, b: 385, light: 'sunny' },
  { id: 'nohuman', a: 386, b: 485, light: 'sunny' },
  { id: 'merchant', a: 486, b: 574, light: 'sunny' },
  { id: 'dialogue', a: 575, b: 635, light: 'sunny' },
  { id: 'whip', a: 636, b: 715, light: 'sunny' },
  { id: 'troop', a: 716, b: 815, light: 'sunny' },
  { id: 'block', a: 816, b: 938, light: 'sunny' },
  { id: 'paydouble', a: 939, b: 1041, light: 'sunny' },
  { id: 'secret', a: 1042, b: 1173, light: 'memory' },
  { id: 'design', a: 1174, b: 1284, light: 'sunny' },
  { id: 'cap', a: 1285, b: 1393, light: 'sunny' },
  { id: 'hookq', a: 1394, b: 1476, light: 'golden' },
  { id: 'hook', a: 1477, b: 1526, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / grades (FILTER pack) ----------
const WATER = { waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' };
export const LIGHTS = {
  sunny: { az: 128, el: 52, sky: '#9fd3e8', ground: '#6a7a44', hemi: 1.1, sun: '#fff3cf', sunI: 2.55, fog: '#d8ecd8', fogNear: 55, fogFar: 380,
    skyTop: '#2e6fd0', skyHor: '#dff2e2', sunDisc: '#fff8e2', sunSize: 0.0034, sat: 1.14, vig: 0.2, shadowExt: 22, aurora: 0, gain: '#fff6e2', ...WATER },
  memory: { az: 150, el: 38, sky: '#e8d9b0', ground: '#7a6a44', hemi: 1.0, sun: '#ffd9a0', sunI: 2.2, fog: '#e8dcbc', fogNear: 40, fogFar: 300,
    skyTop: '#7a86b8', skyHor: '#f2dfae', sunDisc: '#ffedbe', sunSize: 0.004, sat: 1.02, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#ffedcb', lift: '#141008', ...WATER },
  golden: { az: 235, el: 22, sky: '#d9a06a', ground: '#5c4a34', hemi: 1.02, sun: '#ffb763', sunI: 2.3, fog: '#e8cba0', fogNear: 48, fogFar: 340,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0038, sat: 1.1, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffe9d2', ...WATER },
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
  if (S.id === 'cap') return blendLight(LIGHTS.sunny, LIGHTS.golden, smooth(ramp(ef(f), 1470, 1550)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging points (shared by story, main, colliders) ----------
export const BOARD_POS = [5.6, 3.05, 8.2];
export const GATE = { postL: [-2.3, 0], postR: [2.3, 0], pivotY: 1.15 };
export const STUMP = { x: 3.3, z: -1.3, top: 0.52, r: 0.34 };
export const PLAT = { x: 3.0, z: 0.6, hx: 0.75, hz: 0.65, top: 0.34 };
// jungle trees [x, z, s] — trunk colliders r = 0.45*s
export const TREES = [
  [-6.4, -2.2, 1.15], [7.6, -3.4, 1.25], [-6.0, 1.8, 1.0], [6.3, 2.6, 1.1],
  [-5.0, 5.4, 0.95], [5.4, 6.4, 1.0], [-7.6, -8.5, 1.3], [7.8, -9.0, 1.2],
  [-8.2, 10.5, 1.15], [11.5, 13.5, 1.05], [-3.6, -15.5, 1.35], [-6.8, 14.0, 1.0],
];
export const ROCKS = [
  { x: -3.9, z: -6.4, s: 0.8 }, { x: 4.4, z: -8.8, s: 1.0 }, { x: -4.2, z: 8.6, s: 0.7 }, { x: 4.6, z: 11.8, s: 0.9 },
];

// ---------- the platform weight (ONE function: deck dip + barrier) ----------
const kAtEN = (f) => {
  const win = (u0, u1, d0, d1) => smooth(ramp(f, u0, u1)) * (1 - smooth(ramp(f, d0, d1)));
  return Math.max(win(314, 330, 400, 414), win(1112, 1132, 1166, 1178), win(1370, 1392, 1402, 1420));
};
const deckTopAtEN = (f) => PLAT.top - 0.10 * kAtEN(f);
export const kAt = (f) => kAtEN(ef(f));
export const deckTopAt = (f) => deckTopAtEN(ef(f));
export const barrierAngAt = (f) => kAt(f) * 1.29;   // ~74 degrees at full weight

// ---------- the monkey track (precomputed per frame) ----------
const SP = { x: STUMP.x, z: STUMP.z, y: STUMP.top, yaw: -1.33 };            // on the stump
const EP = { x: 2.8, z: 0.35, y: 'deck', yaw: -2.55 };                        // platform edge (the grab)
const CP = { x: 3.05, z: 0.65, y: 'deck', yaw: -2.5 };                        // platform centre (full weight)
const MSEG = [
  [0, 296, SP, SP, 0], [296, 306, SP, EP, 0.30], [306, 322, EP, CP, 0], [322, 398, CP, CP, 0],
  [398, 410, CP, SP, 0.30], [410, 1085, SP, SP, 0], [1085, 1097, SP, EP, 0.30], [1097, 1112, EP, CP, 0],
  [1112, 1166, CP, CP, 0], [1166, 1178, CP, EP, 0], [1178, 1368, EP, EP, 0], [1368, 1384, EP, CP, 0],
  [1384, 1402, CP, CP, 0], [1402, 1418, CP, EP, 0], [1418, 1432, EP, SP, 0.30], [1432, 1730, SP, SP, 0],
];
const resY = (p, f) => (p.y === 'deck' ? deckTopAtEN(f) : p.y);
const MONK_EN = [];
for (let f = 0; f < TOTAL_EN; f++) {
  const seg = MSEG.find((s) => f >= s[0] && f <= s[1]) || MSEG[MSEG.length - 1];
  const [f0, f1, A, B, arc] = seg;
  const u = f1 > f0 ? smooth(ramp(f, f0, f1)) : 0;
  const ur = f1 > f0 ? ramp(f, f0, f1) : 0;
  const x = lerp(A.x, B.x, u), z = lerp(A.z, B.z, u);
  const y = lerp(resY(A, f), resY(B, f), u) + (arc ? Math.sin(ur * Math.PI) * arc : 0);
  let yaw = lerp(A.yaw, B.yaw, u);
  if (f >= 760 && f <= 1445) yaw = -1.59;              // watching the road / troop
  if (f > 1445) yaw = -1.95;                            // facing the elder + villagers
  const air = arc > 0 && f > f0 && f < f1 ? 1 : 0;
  MONK_EN.push({ x, y, z, yaw, air });
}
export const MONK = [];
for (let f = 0; f < TOTAL; f++) MONK.push(MONK_EN[clamp(Math.round(ef(f)), 0, TOTAL_EN - 1)]);
export const monkeyAt = (f) => MONK[clamp(Math.round(f), 0, TOTAL - 1)];

// ---------- the troop (6 monkeys: perch -> drop -> sit -> melt back) ----------
export const PERCH = [[-5.9, 4.2, -4.3], [-4.6, 3.6, -2.2], [-3.9, 3.4, -4.9], [6.3, 4.4, -5.3], [3.6, 3.6, -5.2], [5.15, 3.5, -3.85]];
export const ROW = [[-1.75, -1.15], [-0.95, -1.6], [-0.38, -1.22], [0.32, -1.3], [1.02, -1.24], [1.72, -1.28]];
const TROOP_DELAY = [0, 30, 10, 18, 46, 34];
const MELT_DELAY = [0, 8, 24, 28, 14, 36];
const troopAtEN = (i, f) => {
  const P = PERCH[i], R = ROW[i];
  const d0 = 826 + TROOP_DELAY[i], d1 = d0 + 46, m0 = 1104 + MELT_DELAY[i], m1 = m0 + 44;
  const u = ramp(f, d0, d1), v = ramp(f, m0, m1);
  if (v > 0) {
    const e = 1 - Math.pow(1 - v, 2);
    return { x: lerp(R[0], P[0], smooth(v)), y: lerp(0, P[1], e) + Math.sin(v * Math.PI) * 0.4, z: lerp(R[1], P[2], smooth(v)), yaw: Math.PI, state: v >= 1 ? 'perch' : 'climb' };
  }
  if (u <= 0) return { x: P[0], y: P[1], z: P[2], yaw: Math.PI, state: 'perch' };
  if (u >= 1) return { x: R[0], y: 0, z: R[1], yaw: Math.PI, state: 'sit' };
  return { x: lerp(P[0], R[0], smooth(u)), y: lerp(P[1], 0, u * u), z: lerp(P[2], R[1], smooth(u)), yaw: Math.PI, state: 'fall' };
};

// ---------- cart tracks (precomputed: z + wheel + speed) ----------
const trackFromKeys = (keys) => {
  const arr = [];
  let wheel = 0, prev = null;
  for (let f = 0; f < TOTAL_EN; f++) {
    let z = keys[keys.length - 1][1];
    for (let i = 1; i < keys.length; i++) {
      if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; z = lerp(a[1], b[1], smooth(ramp(f, a[0], b[0]))); break; }
    }
    let speed = 0;
    if (prev) { const d = Math.abs(z - prev.z); speed = d * 30; wheel += d / 0.55; }
    arr.push({ z, wheel, speed }); prev = { z };
  }
  return arr;
};
export const CART1 = trackFromKeys([[0, -26], [243, -26], [272, -5.2], [344, -5.2], [405, 13], [1730, 13]]);
export const MCART = trackFromKeys([[0, -30], [510, -30], [575, -5.2], [738, -5.2], [778, -4.65], [1148, -4.65], [1225, 13], [1730, 13]]);
export const troopAt = (i, f) => troopAtEN(i, ef(f));
export const cart1At = (f) => CART1[clamp(Math.round(ef(f)), 0, TOTAL_EN - 1)];
export const merchAt = (f) => MCART[clamp(Math.round(ef(f)), 0, TOTAL_EN - 1)];

// ---------- bananas (props, not colliders) ----------
export const banana1At = (f) => {
  const e = ef(f), c = cart1At(f), m = monkeyAt(f);
  if (e < 243) return { p: [0.78, 1.55, c.z + 1.62], vis: 0 };
  if (e < 284) return { p: [0.78, 1.55, c.z + 1.62], vis: 1 };
  if (e < 300) { const u = ramp(e, 284, 300); return { p: [lerp(0.78, 2.52, u), lerp(1.55, deckTopAt(f) + 0.5, u) + Math.sin(u * Math.PI) * 1.05, lerp(c.z + 1.62, 0.3, u)], vis: 1 }; }
  if (e < 412) return { p: [m.x - 0.28, m.y + 0.46, m.z - 0.08], vis: 1 };
  return { p: [3.62, STUMP.top + 0.09, -1.02], vis: 1 };   // resting in the bowl on the stump
};
export const banana2At = (f) => {
  const e = ef(f), c = merchAt(f), m = monkeyAt(f);
  if (e < 1046) return { p: [0.62, 1.55, c.z + 1.62], vis: 0 };
  if (e < 1078) return { p: [0.62, 1.55, c.z + 1.62], vis: 1 };
  if (e < 1098) { const u = ramp(e, 1078, 1098); return { p: [lerp(0.62, 2.52, u), lerp(1.55, deckTopAt(f) + 0.5, u) + Math.sin(u * Math.PI) * 1.05, lerp(c.z + 1.62, 0.3, u)], vis: 1 }; }
  if (e < 1112) return { p: [m.x - 0.28, m.y + 0.46, m.z - 0.08], vis: 1 };
  return { p: [2.6, deckTopAt(f) + 0.07, 0.16], vis: 1 };   // the pair, in the bowl at the platform edge
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [1.2, 1.0, 0], barrier: () => [STUMP.x, 0.9, STUMP.z], pays: () => [0.4, 1.0, -3.4],
  platform: () => [PLAT.x, 0.75, PLAT.z], nohuman: () => [1.0, 0.9, -0.3],
  merchant: () => [0.35, 1.6, merchAt(538).z + 1.5], dialogue: () => [0.35, 1.9, merchAt(606).z + 1.5],
  whip: () => [0, 1.1, -2.5], troop: () => [0, 0.6, -1.25], block: () => [0, 0.6, -1.25],
  paydouble: () => [PLAT.x, 0.75, PLAT.z], secret: () => [PLAT.x, 0.75, PLAT.z], design: () => [PLAT.x, 0.75, PLAT.z],
  cap: () => [STUMP.x, 0.95, STUMP.z], hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[26, 27, 38], [17, 14, 26], [11, 6, 16], [7.8, 2.9, 11.2]],
    [[3.2, 2.4, 5.2], [4.0, 2.5, 6.0], [2.6, 1.8, 3.0], [1.4, 1.1, -0.2]], 0, 109, 48, 41) },
  barrier: { cut: 'hard', raw: keysCam({ keys: [
    { f: 110, pos: [6.9, 2.1, 5.6], look: [1.6, 1.0, -0.5], fov: 40 },
    { f: 220, pos: [6.2, 1.9, 4.7], look: [1.9, 1.05, -0.7], fov: 37, ease: 'surge' }] }) },
  pays: { cut: 'hard', raw: keysCam({ keys: [
    { f: 221, pos: [5.6, 2.0, -9.2], look: [0.6, 1.05, -3.2], fov: 40 },
    { f: 265, pos: [5.0, 1.85, -8.4], look: [0.9, 1.05, -3.0], fov: 38, ease: 'surge' }] }) },
  platform: { cut: 'hard', raw: pushInCam({ subject: () => [PLAT.x, 0, PLAT.z], dir: () => [0.55, -0.75], d0: 6.4, d1: 5.2, h0: 1.7, h1: 1.5, a: 266, b: 385, lookOff: [0, 0.72, 0], fov0: 40, fov1: 36 }) },
  nohuman: { cut: 'hard', raw: keysCam({ keys: [
    { f: 386, pos: [7.6, 2.9, 10.8], look: [1.2, 0.85, -0.4], fov: 42 },
    { f: 485, pos: [6.7, 2.5, 9.0], look: [1.5, 0.9, -0.5], fov: 40, ease: 'surge' }] }) },
  merchant: { cut: 'whip', blend: 18, raw: keysCam({ keys: [
    { f: 486, pos: [-6.4, 2.65, -12.5], look: [0, 1.2, -9], fov: 43 },
    { f: 538, pos: [-6.6, 2.3, -9.0], look: [0.2, 1.3, -4.6], fov: 41, ease: 'surge' },
    { f: 574, pos: [-6.2, 2.2, -8.4], look: [0.3, 1.35, -4.2], fov: 40, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: 575, pos: [3.6, 2.1, -9.0], look: [0.35, 2.3, -3.7], fov: 36 },
    { f: 635, pos: [2.4, 1.95, -7.3], look: [0.35, 2.35, -3.7], fov: 31, ease: 'surge' }] }) },
  whip: { cut: 'hard', raw: keysCam({ keys: [
    { f: 636, pos: [4.4, 1.8, -9.6], look: [0.1, 1.2, -3.4], fov: 38 },
    { f: 715, pos: [4.0, 1.7, -8.8], look: [0.1, 1.15, -3.1], fov: 36, ease: 'surge' }] }) },
  troop: { cut: 'hard', raw: keysCam({ keys: [
    { f: 716, pos: [7.0, 3.4, 7.6], look: [0.4, 0.9, -1.6], fov: 44 },
    { f: 815, pos: [6.2, 2.9, 6.2], look: [0.3, 0.8, -1.4], fov: 41, ease: 'surge' }] }) },
  block: { cut: 'hard', raw: keysCam({ keys: [
    { f: 816, pos: [-2.9, 1.8, -8.2], look: [0.3, 0.75, -1.3], fov: 37 },
    { f: 938, pos: [-2.5, 1.7, -7.4], look: [0.35, 0.75, -1.3], fov: 35, ease: 'surge' }] }) },
  paydouble: { cut: 'hard', raw: keysCam({ keys: [
    { f: 939, pos: [6.0, 2.3, -7.2], look: [1.6, 0.95, -0.6], fov: 40 },
    { f: 1041, pos: [6.6, 2.1, -3.0], look: [2.2, 0.9, 0.1], fov: 38, ease: 'surge' }] }) },
  secret: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1042, pos: [7.0, 1.7, 5.0], look: [2.85, 0.8, 0.55], fov: 36 },
    { f: 1173, pos: [6.3, 1.6, 4.3], look: [2.9, 0.8, 0.6], fov: 33, ease: 'surge' }] }) },
  design: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1174, pos: [-3.6, 1.6, 4.4], look: [2.6, 0.85, 0.4], fov: 38 },
    { f: 1284, pos: [-3.1, 1.5, 3.9], look: [2.7, 0.85, 0.45], fov: 36, ease: 'surge' }] }) },
  cap: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1285, pos: [5.9, 2.0, -5.2], look: [3.1, 1.0, -1.2], fov: 38 },
    { f: 1393, pos: [5.3, 1.9, -4.4], look: [3.2, 1.05, -1.25], fov: 35, ease: 'surge' }] }) },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1394, pos: [12.9, 3.5, 23.0], look: [5.7, 2.9, 8.3], fov: 43 },
    { f: 1476, pos: [10.8, 3.35, 19.6], look: [5.62, 2.98, 8.22], fov: 39, ease: 'surge' }] }) },
  hook: { cut: 'blend', blend: 8, raw: keysCam({ keys: [
    { f: 1477, pos: [10.8, 3.35, 19.6], look: [5.62, 2.98, 8.22], fov: 39 },
    { f: 1526, pos: [10.4, 3.4, 19.0], look: [5.6, 3.0, 8.2], fov: 38, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 296, a: 0.035 }, { f: 675, a: 0.04 }, { f: 720, a: 0.03 }, { f: 747, a: 0.05 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: [...RIG.declared.whips],
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (S.id === 'drone') cinf = 1.4;
  if (['dialogue', 'platform', 'design', 'secret', 'cap'].includes(S.id)) cinf = 3.4;
  if (['hook', 'hookq'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), e = ef(f), m = monkeyAt(f), c1 = cart1At(f), mc = merchAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    cartZ: c1.z, cartWheel: c1.wheel, cartSpeed: c1.speed,
    merchZ: mc.z, merchWheel: mc.wheel, merchSpeed: mc.speed,
    monkeyX: m.x, monkeyY: m.y, monkeyZ: m.z, monkeyYaw: m.yaw,
    platK: kAt(f), barrierAng: barrierAngAt(f), deckTop: deckTopAt(f),
    screechK: 0, capK: 0, napK: 0,
    dustCart: 0, dustMerch: 0, dustTroop: 0, dustMonkey: 0, glowK: 0,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(e, 46, 62)) * (1 - smooth(ramp(e, 58, 72)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(e, 1612, 1634));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  W.screechK = Math.sin(ramp(e, 793, 830) * Math.PI);
  W.capK = smooth(ramp(e, 1496, 1514));
  if (S.id === 'nohuman') W.napK = 0.5 + 0.5 * Math.sin(f * 0.06);
  W.dustCart = clamp(c1.speed / 3, 0, 1);
  W.dustMerch = clamp(mc.speed / 3, 0, 1);
  W.dustTroop = ramp(e, 898, 906) * (1 - ramp(e, 912, 928));
  W.dustMonkey = Math.max(ramp(e, 296, 300) * (1 - ramp(e, 302, 310)), ramp(e, 398, 402) * (1 - ramp(e, 404, 412)),
    ramp(e, 1085, 1089) * (1 - ramp(e, 1091, 1099)), ramp(e, 1418, 1422) * (1 - ramp(e, 1424, 1432)));
  if (S.id === 'cap' || S.id === 'hookq' || S.id === 'hook') W.glowK = 0.85;
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const nearGate = !['drone'].includes(S.id);
  return { smokeRate: nearGate ? 0.12 : 0.05, dustRate: 0.06, splashRate: 0, moteRate: 0.5, leafRate: 0.22 };
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { sunny: '#ffffff', memory: '#ffe9c4', golden: '#ffe0b0' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  driver1: { jacket: '#6a7a6a', pants: '#4a4238', boots: '#2c2118', hat: 'cap', cap: '#7a4a26', skin: '#c98a5a' },
  merchant: { jacket: '#7a1f4d', pants: '#e8dcc0', boots: '#3a2c1c', hat: 'turban', skin: '#e8b08a' },
  keeper: { jacket: '#ded6c2', pants: '#6a6252', boots: '#2c2118', hat: 'hair', hair: '#cfcfcf', skin: '#c98a5a', moustache: '#b8b8b8' },
  elder: { jacket: '#31517a', pants: '#37474f', boots: '#241a12', hat: 'cap', cap: '#e8e2d2', skin: '#a06a3c', moustache: '#8a8a8a' },
  vill1: { jacket: '#c26a2a', pants: '#3d4a42', boots: '#2c2118', hat: 'cap', cap: '#2a7ac2', skin: '#e8b08a' },
  vill2: { jacket: '#3f7a4a', pants: '#7a4a26', boots: '#33302c', hat: 'hair', hair: '#241a12', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), e = ef(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, ground, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: ground ?? y, tint, ...extra }) });
  // driver 1 rides his cart (present while the cart is in play)
  if (e >= 243 && e <= 412) {
    const c = cart1At(f);
    const opts = { expr: e >= 262 && e <= 292 ? 'smile' : 'smile_closed', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: e >= 262 && e <= 292 ? ['point', 0.85] : undefined };
    std('driver1', OUTFITS.driver1, opts, 0.52, 0.88, c.z + 1.5, null, { yaw: 0.5 });
  }
  // the merchant rides his cart from arrival to exit
  if (e >= 510 && e <= 1230) {
    const c = merchAt(f);
    let opts;
    if (S.id === 'dialogue' && f >= 588) opts = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...speakFace('stern', f) };
    else if (S.id === 'dialogue' && f < 585) opts = { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 71), seed: 71 };
    else if (S.id === 'dialogue') opts = { expr: 'grin', mode: 'stand', blink: blinkAt(f, 71), seed: 71 };
    else if (S.id === 'whip') opts = { expr: 'stern', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: e >= 706 && e <= 726 ? ['point', q(Math.sin(ramp(e, 706, 726) * Math.PI), 2)] : undefined };
    else if (S.id === 'block') opts = { expr: f % 90 < 45 ? 'stern' : 'nervous', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.4] };
    else if (S.id === 'paydouble') opts = { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: e >= 1052 && e <= 1082 ? ['point', 0.85] : undefined };
    else opts = { expr: 'grin', mode: 'stand', blink: blinkAt(f, 71), seed: 71 };
    std('merchant', OUTFITS.merchant, opts, 0.35, 0.88, c.z + 1.5, null, { yaw: 0.45 });
  }
  // the old keeper appears in the memory beat only
  if (S.id === 'secret') {
    const pk = q(0.45 + 0.25 * Math.sin(f * 0.045), 2);
    std('keeper', OUTFITS.keeper, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81, prop: ['point', pk] }, 2.15, 0, 1.55, 0, { yaw: -0.9 });
  }
  // the village elder + two villagers for the cap ceremony
  if (S.id === 'cap') {
    const reach = q(smooth(ramp(e, 1480, 1500)) * (1 - smooth(ramp(e, 1520, 1542))), 2);
    std('elder', OUTFITS.elder, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['point', reach] }, 2.35, 0, -0.55, 0, { yaw: -0.7 });
    const wv = q(Math.sin(f * 0.3) * 0.5, 2);
    std('vill1', OUTFITS.vill1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 92), seed: 92, wave: wv }, -2.6, 0, 1.8, 0, { yaw: 0.6 });
    std('vill2', OUTFITS.vill2, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 93), seed: 93, wave: -wv }, -3.1, 0, 3.3, 0, { yaw: 0.9 });
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));
export const fxAt = () => [];

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
// NOTE: the stump and the platform are GROUND surfaces for the monkey, not
// colliders (the monkey stands ON them; carts never reach them in plan).
export const STATICS = [
  ...TREES.map(([x, z, s]) => SOL.circle(x, z, 0.45 * s, { h: 5.5, id: 'tree' })),
  SOL.circle(GATE.postL[0], GATE.postL[1], 0.12, { h: 2.6, id: 'postL' }),
  SOL.circle(GATE.postR[0], GATE.postR[1], 0.12, { h: 2.6, id: 'postR' }),
  SOL.circle(BOARD_POS[0] - 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  ...ROCKS.map((r) => SOL.circle(r.x, r.z, r.s * 0.95, { h: r.s * 1.1, id: 'rock' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [], e = ef(f), m = monkeyAt(f);
  if (e >= 200 && e <= 460) {
    const c = cart1At(f);
    out.push(SOL.obb(0, c.z, 0, 0.95, 1.55, { kind: 'dynamic', id: 'cart1' }));
    out.push(SOL.circle(0, c.z + 2.15, 0.55, { kind: 'dynamic', id: 'horse1' }));
  }
  if (e >= 500 && e <= 1240) {
    const c = merchAt(f);
    out.push(SOL.obb(0, c.z, 0, 0.95, 1.55, { kind: 'dynamic', id: 'cart2' }));
    out.push(SOL.circle(0, c.z + 2.15, 0.55, { kind: 'dynamic', id: 'horse2' }));
  }
  out.push(SOL.circle(m.x, m.z, 0.26, { kind: 'dynamic', id: 'monkey' }));
  for (let i = 0; i < 6; i++) { const t = troopAt(i, f); out.push(SOL.circle(t.x, t.z, 0.26, { kind: 'dynamic', id: 'troop' + i })); }
  for (const a of castAt(f)) {
    if (a.ground === null || a.ground === undefined) continue;   // riders ride inside their cart
    out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const items = [], e = ef(f), m = monkeyAt(f);
  if (e >= 200 && e <= 460) { items.push({ id: 'cart1', y: 0, ground: 0, maxHover: 0.04 }); items.push({ id: 'horse1', y: 0, ground: 0, maxHover: 0.04 }); }
  if (e >= 500 && e <= 1240) { items.push({ id: 'cart2', y: 0, ground: 0, maxHover: 0.04 }); items.push({ id: 'horse2', y: 0, ground: 0, maxHover: 0.04 }); }
  if (!m.air) items.push({ id: 'monkey', y: m.y, ground: m.y, maxHover: 0.05 });
  for (let i = 0; i < 6; i++) {
    const t = troopAt(i, f);
    if (t.state === 'sit') items.push({ id: 'troop' + i, y: 0, ground: 0, maxHover: 0.05 });
    else if (t.state === 'perch') items.push({ id: 'troop' + i, y: t.y, ground: t.y, maxHover: 0.05 });
  }
  for (const a of castAt(f)) if (a.ground !== null && a.ground !== undefined) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  return items;
};
