// Shot plan for "The Statue That Drank the Milk" — batch 6 topic 4 (EN),
// Modern Library v4 (camrig + solid + props + materials + speak) on the
// island-car3 architecture. GRADE: Royal Gold (FILTER_VFX_LIGHTING pack)
// with a dawn light arc: dusk-gold ritual -> dark-blue pre-dawn -> first
// golden light -> full Royal Gold morning. Signature VFX: dawn light arc,
// dust motes in the first light, heat shimmer over the dry ground at day
// beats, gentle sparkle on the milk bowl.
// Voice stem: 55.091 s, 30 fps, TOTAL 1653. Timings: faster-whisper small
// word alignment on stem_en.wav (198 words, script-exact; Meera->Mira is
// an ASR homophone only). Shots change ONLY at voice-clause boundaries
// (ASR segments). Dialogue: the priest's line (41.18-43.32 s) is PERFORMED
// with speak.js lip-sync; the narration tag before it stays voice-over.
// World: a dry village square. Statue platform centre (0,-6), bowl stand
// on the platform's front edge, well at (-4.6,1.8), board at (4.6,3,2.5).
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const speakFace = (baseName, f) => {
  const s = SPEAK.at(Math.round(hiFrame(f)));   // HI speakdata: f here is an EN-grid frame
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.55 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1796, DECK = 0;
const SHOTS_EN = [
  { id: 'drone', a: 0, b: 99, light: 'dusk' },
  { id: 'offering', a: 100, b: 196, light: 'dusk' },
  { id: 'guardian', a: 197, b: 303, light: 'dusk' },
  { id: 'meera', a: 304, b: 386, light: 'dusk' },
  { id: 'hide', a: 387, b: 489, light: 'predawn' },
  { id: 'waits', a: 490, b: 565, light: 'predawn' },
  { id: 'crack', a: 566, b: 694, light: 'predawn' },
  { id: 'sips', a: 695, b: 802, light: 'predawn' },
  { id: 'hole', a: 803, b: 890, light: 'dawnfirst' },
  { id: 'miracle', a: 891, b: 1019, light: 'dawnfirst' },
  { id: 'sunrise', a: 1020, b: 1120, light: 'royalgold' },
  { id: 'nobody', a: 1121, b: 1181, light: 'royalgold' },
  { id: 'priest', a: 1182, b: 1312, light: 'royalgold' },
  { id: 'open', a: 1313, b: 1396, light: 'royalgold' },
  { id: 'birds', a: 1397, b: 1503, light: 'royalgold' },
  { id: 'hookq', a: 1504, b: 1593, light: 'royalgold' },
  { id: 'hook', a: 1594, b: 1652, light: 'royalgold' },
];
const TIMING_EN = SHOTS_EN.map((s) => [s.id, s.a, s.b]);
const shotAt_en = (f) => SHOTS_EN.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS_EN[0] : SHOTS_EN[SHOTS_EN.length - 1]);
const smooth = M.smooth;

// ---------- lights / grades (Royal Gold family + dawn arc) ----------
const WTR = { waterDeep: '#6a5136', waterShal: '#a8834a', glint: '#ffe9c0' };
export const LIGHTS = {
  dusk: { az: 118, el: 16, sky: '#c98a4a', ground: '#5c4630', hemi: 0.95, sun: '#ffb763', sunI: 2.2, fog: '#e0b98a', fogNear: 40, fogFar: 300,
    skyTop: '#4a4a86', skyHor: '#f2b06b', sunDisc: '#ffd9a0', sunSize: 0.0042, sat: 1.08, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffe2b8', ...WTR },
  predawn: { az: 112, el: 5, sky: '#6d7ea6', ground: '#3c4054', hemi: 0.92, sun: '#8a9ac2', sunI: 1.25, fog: '#8a97b5', fogNear: 34, fogFar: 260,
    skyTop: '#1c2447', skyHor: '#5a6a94', sunDisc: '#aab6d8', sunSize: 0.003, sat: 0.92, vig: 0.34, shadowExt: 22, aurora: 0, gain: '#c8d2ea', ...WTR },
  dawnfirst: { az: 114, el: 9, sky: '#a898b0', ground: '#4a4038', hemi: 0.8, sun: '#ffb37a', sunI: 1.6, fog: '#cbb49a', fogNear: 38, fogFar: 280,
    skyTop: '#2c3a6e', skyHor: '#f2a56b', sunDisc: '#ffc98f', sunSize: 0.004, sat: 1.0, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddc4', ...WTR },
  royalgold: { az: 122, el: 42, sky: '#c9a86a', ground: '#6a5638', hemi: 1.05, sun: '#ffcf8a', sunI: 2.5, fog: '#ecd3a0', fogNear: 45, fogFar: 320,
    skyTop: '#3f6fb4', skyHor: '#f7dc9e', sunDisc: '#fff0c0', sunSize: 0.0036, sat: 1.1, vig: 0.22, shadowExt: 22, aurora: 0, gain: '#ffedca', ...WTR },
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
const lightFor_en = (S, f) => {
  // the dawn arc: grades blend INSIDE the clause where the light changes
  if (S.id === 'sips') return blendLight(LIGHTS.predawn, LIGHTS.dawnfirst, smooth(ramp(f, 730, 800)));
  if (S.id === 'miracle') return blendLight(LIGHTS.dawnfirst, LIGHTS.royalgold, smooth(ramp(f, 920, 1010)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging points ----------
export const BOARD_POS = [4.6, 3.0, 2.5];
export const STATUE = [0, -6];                 // platform centre [x,z]
export const STAND = [0, -4.62];               // bowl stand on the platform front edge
export const BOWL_REST = [0, 1.34, -4.62];     // bowl base sits ON the stand (stand top = 1.34)
export const HOLE_POS = [0, 1.17, -4.33];      // tiny hole in the stand's front face
export const CRACK_POS = [0.25, 2.6, -6.42];   // crack panel in the statue's back
export const PERCH = [0.8, 3.08, -6.0];        // statue's arm end — the sparrow's perch
export const WELL = [-4.6, 1.8];
export const GRAIN_REST = [1.3, 0.02, -2.2];   // grain bowl set openly on the ground
export const BOWL2_REST = [0.2, 0.02, -2.6];   // second milk bowl, set openly
export const PALMS = [[10, 0.5, 1], [-10.5, -6, 1.05], [5.5, -11.5, 0.9], [-3.5, -12, 1]];
export const HUTS = [
  { x: -8.5, z: -2.5, ry: 0.7, s: 1.1, wall: 'plaster' },
  { x: -8, z: 5.5, ry: 1.1, s: 1, wall: 'stone' },
  { x: 8.5, z: -3, ry: -0.7, s: 1.05, wall: 'plaster' },
  { x: 7.5, z: 5.5, ry: -1.2, s: 0.95, wall: 'stone' },
  { x: 7.4, z: -13.6, ry: 0, s: 1.2, wall: 'plaster' },
];
export const TREE = [3.4, -10.8];              // bare tree — the sparrow's home perch

// ---------- the sparrow track (precomputed per frame) ----------
const SP_KEYS = [
  // [f, x, y, z] — perch, flight to the crack, inside, pop-out, shoulder, grain
  [0, 3.3, 3.3, -10.8], [574, 3.3, 3.3, -10.8],
  [612, 1.8, 3.0, -8.6], [640, 0.3, 2.62, -6.78],
  [664, 0.26, 2.6, -6.6], [694, 0.25, 2.55, -6.3],
  [908, 0.25, 2.55, -6.3], [932, 0.3, 2.66, -6.85],
  [958, 1.9, 3.2, -5.2], [986, PERCH[0], PERCH[1], PERCH[2]],
  [1409, PERCH[0], PERCH[1], PERCH[2]],
  [1440, 2.2, 1.8, -4.2], [1468, 1.55, 0.16, -2.5],
  [1652, 1.55, 0.16, -2.5],
];
export const SPARROW = [];
{
  for (let f = 0; f < TOTAL; f++) {
    let x = SP_KEYS[0][1], y = SP_KEYS[0][2], z = SP_KEYS[0][3];
    for (let i = 1; i < SP_KEYS.length; i++) {
      if (f <= SP_KEYS[i][0]) {
        const a = SP_KEYS[i - 1], b = SP_KEYS[i], u = smooth(ramp(f, a[0], b[0]));
        x = lerp(a[1], b[1], u); y = lerp(a[2], b[2], u) + Math.sin(u * Math.PI) * (b[0] - a[0] > 20 ? 0.22 : 0);
        z = lerp(a[3], b[3], u); break;
      }
      x = SP_KEYS[SP_KEYS.length - 1][1]; y = SP_KEYS[SP_KEYS.length - 1][2]; z = SP_KEYS[SP_KEYS.length - 1][3];
    }
    const flying = (f >= 575 && f <= 664) || (f >= 909 && f <= 986) || (f >= 1410 && f <= 1468);
    const inside = f >= 665 && f <= 908;
    SPARROW.push({ x, y, z, flying, inside, flap: flying ? 1 : 0 });
  }
}
export const sparrowAt = (f) => SPARROW[clamp(Math.round(f), 0, TOTAL - 1)];

// ---------- bowls (contact-animated props) ----------
export const bowlAt = (f) => {
  // offering: rests on the stand, lifted f104-118, poured f120-134, set
  // back down f136-148 (lands ON the stand and stays). Elsewhere: rests.
  if (f < 104) return { x: BOWL_REST[0], y: BOWL_REST[1], z: BOWL_REST[2], tilt: 0, rest: 1 };
  if (f < 118) { const u = smooth(ramp(f, 104, 118)); return { x: lerp(BOWL_REST[0], 0.72, u), y: lerp(BOWL_REST[1], 1.02, u), z: lerp(BOWL_REST[2], -3.62, u), tilt: 0, rest: 0 }; }
  if (f < 136) { const u = ramp(f, 120, 134); return { x: 0.72, y: 1.02, z: -3.62, tilt: Math.sin(u * Math.PI) * 0.5, rest: 0 }; }
  if (f < 148) { const u = smooth(ramp(f, 136, 148)); return { x: lerp(0.72, BOWL_REST[0], u), y: lerp(1.02, BOWL_REST[1], u), z: lerp(-3.62, BOWL_REST[2], u), tilt: 0, rest: u >= 1 ? 1 : 0 }; }
  return { x: BOWL_REST[0], y: BOWL_REST[1], z: BOWL_REST[2], tilt: 0, rest: 1 };
};
export const grainAt = (f) => {
  if (f < 1313) return { x: GRAIN_REST[0], y: -3, z: GRAIN_REST[2], on: 0, rest: 0 };
  if (f < 1332) return { x: 1.78, y: 0.78, z: -1.72, on: 1, rest: 0 };                       // carried by Meera
  if (f < 1360) { const u = smooth(ramp(f, 1332, 1360)); return { x: lerp(1.78, GRAIN_REST[0], u), y: lerp(0.78, GRAIN_REST[1], u), z: lerp(-1.72, GRAIN_REST[2], u), on: 1, rest: u >= 1 ? 1 : 0 }; }
  return { x: GRAIN_REST[0], y: GRAIN_REST[1], z: GRAIN_REST[2], on: 1, rest: 1 };
};
export const bowl2At = (f) => {
  if (f < 1313) return { x: BOWL2_REST[0], y: -3, z: BOWL2_REST[2], on: 0, rest: 0 };
  if (f < 1330) return { x: 0.62, y: 0.8, z: -2.95, on: 1, rest: 0 };                        // carried by the auntie
  if (f < 1352) { const u = smooth(ramp(f, 1330, 1352)); return { x: lerp(0.62, BOWL2_REST[0], u), y: lerp(0.8, BOWL2_REST[1], u), z: lerp(-2.95, BOWL2_REST[2], u), on: 1, rest: u >= 1 ? 1 : 0 }; }
  return { x: BOWL2_REST[0], y: BOWL2_REST[1], z: BOWL2_REST[2], on: 1, rest: 1 };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 2, -6], offering: () => [0, 1.3, -4.62], guardian: () => [0, 3.1, -6],
  meera: () => [2.6, 1.2, -2.6], hide: () => [-4.6, 1.1, 3.3], waits: () => [0, 1.3, -4.62],
  crack: () => [...CRACK_POS], sips: () => [-4.35, 1.05, 3.1], hole: () => [...HOLE_POS],
  miracle: () => { const s = sparrowAt(960); return [s.x, s.y, s.z]; },
  sunrise: () => [0, 2.4, -6], nobody: () => [...PERCH],
  priest: () => [1.7, 1.35, -3.1], open: () => [1.3, 0.4, -2.2], birds: () => [1.3, 0.3, -2.2],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
const heroPosAt_en = (f) => FOCUS[shotAt_en(f).id]();

// ---------- cameras: every shot is a camrig track on its subject ----------
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[26, 20, 26], [14, 11, 12], [6, 5, 2], [3.4, 3.6, -0.2]],
    [[0, 0.8, -6], [0, 1.4, -6], [0, 2, -5.8], [0, 2.2, -5.6]], 0, 99, 46, 40) },
  offering: { cut: 'blend', blend: 10, raw: pushInCam({ subject: () => [0, 0, -4.62], dir: () => [0.25, 0.97], d0: 5.4, d1: 4.4, h0: 1.55, h1: 1.42, a: 100, b: 196, lookOff: [0, 1.32, 0], fov0: 38, fov1: 34 }) },
  guardian: { cut: 'hard', raw: pushInCam({ subject: () => [0, 0, -6], dir: () => [0.3, 0.95], d0: 7.5, d1: 5.6, h0: 2.3, h1: 2.05, a: 197, b: 303, lookOff: [0, 2.6, 0], fov0: 40, fov1: 34 }) },
  meera: { cut: 'hard', raw: staticTrackCam({ pos: [4.7, 1.5, -0.5], subject: () => [2.6, 0, -2.6], lookOff: [0, 1.22, 0], fov: 34 }) },
  hide: { cut: 'hard', raw: keysCam({ keys: [
    { f: 387, pos: [-1.7, 1.7, 5.7], look: [-4.6, 1.1, 2.7], fov: 40 },
    { f: 489, pos: [-2.2, 1.6, 5.2], look: [-4.55, 1.08, 2.85], fov: 38, ease: 'surge' }] }) },
  waits: { cut: 'hard', raw: pushInCam({ subject: () => [0, 0, -4.62], dir: () => [-0.35, 0.94], d0: 5.2, d1: 4.2, h0: 1.35, h1: 1.3, a: 490, b: 565, lookOff: [0, 1.3, 0], fov0: 36, fov1: 32 }) },
  crack: { cut: 'hard', raw: keysCam({ keys: [
    { f: 566, pos: [0.5, 2.65, -15.0], look: [0.2, 2.2, -6.55], fov: 40 },
    { f: 694, pos: [0.35, 2.5, -14.2], look: [0.25, 2.35, -6.5], fov: 37, ease: 'surge' }] }) },
  sips: { cut: 'hard', raw: keysCam({ keys: [
    { f: 695, pos: [-2.3, 1.5, 4.7], look: [-4.35, 1.05, 3.05], fov: 36 },
    { f: 802, pos: [-2.7, 1.45, 4.2], look: [-4.3, 1.05, 3.1], fov: 33, ease: 'surge' }] }) },
  hole: { cut: 'hard', raw: staticTrackCam({ pos: [0.75, 1.55, -2.35], subject: () => [0, 0, -4.62], lookOff: [0, 1.24, 0], fov: 30 }) },
  miracle: { cut: 'hard', raw: keysCam({ keys: [
    { f: 891, pos: [2.6, 2.3, -10.9], look: [0.3, 2.4, -6.55], fov: 36 },
    { f: 960, pos: [3.4, 2.5, -3.4], look: [0.6, 3.0, -6.05], fov: 34, ease: 'surge' },
    { f: 1019, pos: [3.1, 2.55, -3.0], look: [0.65, 3.02, -6.05], fov: 33, ease: 'surge' }] }) },
  sunrise: { cut: 'blend', blend: 12, raw: keysCam({ keys: [
    { f: 1020, pos: [6.2, 2.6, 4.6], look: [0, 2.2, -5.5], fov: 44 },
    { f: 1120, pos: [5.6, 2.4, 3.9], look: [0, 2.2, -5.6], fov: 42, ease: 'surge' }] }) },
  nobody: { cut: 'hard', raw: pushInCam({ subject: () => [0.6, 0, -6.05], dir: () => [0.55, 0.83], d0: 5.4, d1: 4.6, h0: 2.7, h1: 2.55, a: 1121, b: 1181, lookOff: [0, 3.0, 0], fov0: 36, fov1: 33 }) },
  priest: { cut: 'hard', raw: pushInCam({ subject: () => [1.7, 0, -3.1], dir: () => [0.5, 0.86], d0: 3.6, d1: 2.7, h0: 1.58, h1: 1.5, a: 1182, b: 1312, lookOff: [0, 1.32, 0], fov0: 36, fov1: 30 }) },
  open: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1313, pos: [4.4, 1.8, 1.8], look: [1.2, 0.7, -2.4], fov: 40 },
    { f: 1396, pos: [4.0, 1.7, 1.4], look: [1.25, 0.6, -2.3], fov: 38, ease: 'surge' }] }) },
  birds: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1397, pos: [3.6, 1.25, 1.3], look: [1.15, 0.25, -2.2], fov: 42 },
    { f: 1503, pos: [3.25, 1.1, 0.95], look: [1.2, 0.2, -2.25], fov: 40, ease: 'surge' }] }) },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1504, pos: [1.2, 3.1, 13.8], look: [4.62, 2.6, 2.6], fov: 42 },
    { f: 1593, pos: [0.7, 3.25, 12.9], look: [4.6, 2.85, 2.55], fov: 39, ease: 'surge' }] }) },
  hook: { cut: 'blend', blend: 8, raw: keysCam({ keys: [
    { f: 1594, pos: [0.7, 3.25, 12.9], look: [4.6, 2.85, 2.55], fov: 39 },
    { f: 1652, pos: [0.45, 3.3, 12.6], look: [4.6, 2.9, 2.52], fov: 38, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS_EN.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [],
  sigma: 2.3, fovSigma: 1.6,
});
const camAt_en = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS_EN.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: [...RIG.declared.whips],
  samples: RIG.samples,
};
const dofAt_en = (f) => {
  const S = shotAt_en(f), C = camAt_en(f), hp = heroPosAt_en(f);
  let cinf = 2.4;
  if (['drone', 'sunrise'].includes(S.id)) cinf = 1.4;
  if (['hole', 'crack', 'priest', 'meera', 'nobody', 'miracle'].includes(S.id)) cinf = 3.6;
  if (['hook', 'hookq'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
const worldAt_en = (f) => {
  const S = shotAt_en(f), sp = sparrowAt(f), bw = bowlAt(f), gr = grainAt(f), b2 = bowl2At(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    bowlX: bw.x, bowlY: bw.y, bowlZ: bw.z, bowlTilt: bw.tilt, milkK: 0,
    grainX: gr.x, grainY: gr.y, grainZ: gr.z, grainOn: gr.on,
    bowl2X: b2.x, bowl2Y: b2.y, bowl2Z: b2.z, bowl2On: b2.on,
    sparrowX: sp.x, sparrowY: sp.y, sparrowZ: sp.z, sparrowFlap: sp.flap, sparrowOn: sp.inside ? 0 : 1,
    beakK: 0, crackK: 0, shimmerK: 0, sparkK: 0, glowK: 0,
  };
  // title board is FULLY in frame only during the drone's first leg
  // (f0-47, measured) — fade in/out entirely inside that window
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 6, 22)) * (1 - smooth(ramp(f, 36, 46)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1548, 1568));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  W.milkK = smooth(ramp(f, 126, 140));                        // milk appears as she pours
  if (S.id === 'offering' || S.id === 'hole' || S.id === 'open') W.sparkK = 0.55 + 0.45 * Math.sin(f * 0.22);
  if (S.id === 'miracle' || S.id === 'sunrise') W.glowK = 0.7;
  // the sparrow's beak slips out of the stand hole to sip (hole shot)
  W.beakK = smooth(ramp(f, 812, 832)) * (1 - smooth(ramp(f, 872, 888)));
  // the crack panel: opens for the entry, closes; opens for the exit, closes
  W.crackK = Math.max(smooth(ramp(f, 648, 664)) * (1 - smooth(ramp(f, 676, 694))),
                      smooth(ramp(f, 896, 912)) * (1 - smooth(ramp(f, 928, 946))));
  if (['sunrise', 'nobody', 'priest', 'open', 'birds'].includes(S.id)) W.shimmerK = 0.65;   // heat shimmer, day beats
  return W;
};
const fxProfileAt_en = (f) => {
  const S = shotAt_en(f);
  // dust motes ride the first light (hole/miracle), a low drift elsewhere
  const mote = ['hole', 'miracle', 'sunrise'].includes(S.id) ? 0.3 : 0.06;
  return { smokeRate: 0.03, dustRate: mote, splashRate: 0 };
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { dusk: '#ffe0b0', predawn: '#c8d2ea', dawnfirst: '#f2ddc4', royalgold: '#ffedca' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  meera: { build: 'kid', jacket: '#c23a6e', pants: '#2a4a7a', boots: '#33302c', hat: 'hair', hair: '#171008', skin: '#c98a5a' },
  priest: { jacket: '#e8912d', pants: '#f2ede2', boots: '#7a4a26', hat: 'turban', skin: '#a06a3c', moustache: '#4a3826' },
  auntie: { jacket: '#7a3a8a', pants: '#37474f', boots: '#2c2118', hat: 'hair', hair: '#241a12', skin: '#a06a3c' },
  vill1: { jacket: '#5d7a8a', pants: '#4a4238', boots: '#2c2118', hat: 'cap', cap: '#8a2f2a', skin: '#c98a5a' },
  vill2: { jacket: '#8a7a4a', pants: '#3d4a42', boots: '#2c2118', hat: 'hair', hair: '#241a12', skin: '#8a5a34', moustache: '#2c1e12' },
  vill3: { jacket: '#3f7a52', pants: '#5a4632', boots: '#2c2118', hat: 'cap', cap: '#2a4a7a', skin: '#e8b08a' },
};
// the priest's chest ornament (bead necklace + pendant), drawn over bodyFront
const priestDraw = (T, o, opts) => (p) => {
  T.bodyFront(p, o, opts);
  p.band([[268, 596], [300, 650]], '#7a1f2e', 5, 2);
  p.band([[332, 596], [300, 650]], '#7a1f2e', 5, 2);
  p.ell(300, 658, 11, 13, '#d9a441', 2);
};
export const castAt = (f) => {
  const S = shotAt_en(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const priest = (opts, x, z, extra = {}) => out.push({ id: 'priest', x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'priest' + JSON.stringify(opts), draw: priestDraw(T, OUTFITS.priest, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const meera = (opts, x, z, extra = {}) => std('meera', OUTFITS.meera, opts, x, z, extra);
  const group = (withPriest) => {
    meera({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8] }, 1.6, -2.9, { yaw: 0.3 });
    std('vill1', OUTFITS.vill1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -1.8, -2.4, { yaw: -0.2 });
    std('vill2', OUTFITS.vill2, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, -0.6, -1.9, { yaw: 0.1 });
    std('vill3', OUTFITS.vill3, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 63), seed: 63 }, 3.1, -2.2, { yaw: -0.3 });
    std('auntie', OUTFITS.auntie, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 2.4, -1.4, { yaw: 0.2 });
    if (withPriest) priest({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 44), seed: 44 }, 0.4, -3.4, { yaw: 0 });
  };
  switch (S.id) {
    case 'drone': {
      std('auntie', OUTFITS.auntie, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 0.95, -3.35, { yaw: 0.4 });
      std('vill1', OUTFITS.vill1, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -1.7, -3.1, { yaw: -0.2 });
      std('vill2', OUTFITS.vill2, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 2.0, -2.5, { yaw: 0.2 });
      break;
    }
    case 'offering': {
      const pour = q(smooth(ramp(f, 118, 128)) * (1 - smooth(ramp(f, 134, 144))), 2);
      std('auntie', OUTFITS.auntie, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52, prop: ['point', Math.max(0.25, pour)] }, 0.95, -3.35, { yaw: 0.4 });
      std('vill1', OUTFITS.vill1, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -1.7, -3.1, { yaw: -0.2 });
      std('vill2', OUTFITS.vill2, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 2.0, -2.5, { yaw: 0.2 });
      break;
    }
    case 'guardian': {
      std('auntie', OUTFITS.auntie, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 0.95, -3.35, { yaw: 0.4 });
      std('vill1', OUTFITS.vill1, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -1.7, -3.1, { yaw: -0.2 });
      std('vill2', OUTFITS.vill2, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 2.0, -2.5, { yaw: 0.2 });
      priest({ expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 44), seed: 44 }, -2.9, -3.7, { yaw: -0.2 });
      break;
    }
    case 'meera': {
      meera({ expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, 2.6, -2.6, { yaw: 0.3 });
      std('auntie', OUTFITS.auntie, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 0.95, -3.35, { yaw: 0.4 });
      break;
    }
    case 'hide': case 'waits': case 'crack': {
      meera({ expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, -4.6, 3.3, { yaw: -0.4 });
      break;
    }
    case 'sips': case 'hole': {
      // she leans out from behind the well, ear toward the statue
      meera({ expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, -4.25, 3.1, { yaw: -0.4, roll: 0.1 });
      break;
    }
    case 'miracle': {
      if (f < 960) meera({ expr: 'relief_open', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, -4.25, 3.1, { yaw: -0.4 });
      else {
        // two-leg path bowed AWAY from the well (r 0.95 at (-4.6,1.8)) —
        // the straight line clipped its collider (gate caught f987-1007)
        const u = ramp(f, 960, 1019);
        const P0 = [-4.25, 3.1], P1 = [-3.1, 2.95], P2 = [-2.6, 0.9];
        let px, pz;
        if (u < 0.45) { const w = smooth(u / 0.45); px = lerp(P0[0], P1[0], w); pz = lerp(P0[1], P1[1], w); }
        else { const w = smooth((u - 0.45) / 0.55); px = lerp(P1[0], P2[0], w); pz = lerp(P1[1], P2[1], w); }
        out.push({ id: 'meera', x: px, y: 0, z: pz, r: 0.32, ground: 0,
          actor: (T) => ({ key: 'meeraW' + q(u, 2), draw: (p) => T.bodyFront(p, OUTFITS.meera, { expr: 'relief_open', mode: 'stroll', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 }), x: px, y: 0, z: pz, ground: 0, tint, yaw: 0.5 }) });
      }
      break;
    }
    case 'sunrise': case 'nobody': { group(true); break; }
    case 'priest': {
      // the priest PERFORMS his line (f1235-1300); before it (the narration
      // tag "smiles and says") and after it, speakFace keeps the mouth shut.
      priest({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 44), seed: 44, look: 0.2, ...speakFace('smile', f) }, 1.7, -3.1, { yaw: 0.15 });
      meera({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, 0.7, -2.7, { yaw: 0.3 });
      std('vill1', OUTFITS.vill1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -0.9, -2.9, { yaw: -0.2 });
      std('vill3', OUTFITS.vill3, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 63), seed: 63 }, 3.0, -2.5, { yaw: -0.3 });
      break;
    }
    case 'open': {
      meera({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.5] }, 1.95, -1.55, { yaw: 0.4 });
      std('auntie', OUTFITS.auntie, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52, prop: ['point', 0.5] }, 0.55, -2.95, { yaw: 0.2 });
      priest({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 44), seed: 44 }, 3.1, -3.3, { yaw: -0.2 });
      break;
    }
    case 'birds': {
      meera({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, 2.1, -1.4, { yaw: 0.3 });
      std('auntie', OUTFITS.auntie, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 0.4, -3.0, { yaw: 0.2 });
      priest({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 44), seed: 44 }, 3.2, -3.2, { yaw: -0.2 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
const actorsAt_en = (f, T) => castAt(f).map((c) => c.actor(T));
const fxAt_en = () => [];

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.obb(STATUE[0], STATUE[1], 0, 2.0, 2.0, { h: 1.0, id: 'platform' }),
  SOL.circle(STATUE[0], STATUE[1], 0.8, { h: 3.9, id: 'statue' }),
  SOL.circle(WELL[0], WELL[1], 0.95, { h: 1.1, id: 'well' }),
  ...PALMS.map(([x, z]) => SOL.circle(x, z, 0.22, { h: 4.5, id: 'palm' })),
  ...HUTS.map((h) => SOL.obb(h.x, h.z, h.ry, 1.45 * h.s, 1.2 * h.s, { h: 3.2, id: 'hut' })),
  SOL.circle(TREE[0], TREE[1], 0.3, { h: 3.6, id: 'tree' }),
  SOL.circle(BOARD_POS[0] - 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
const dynamicsAt_en = (f) => {
  const out = [];
  // the sparrow is a small flying bird: it is excluded from the ground
  // dynamics (the driver-in-car precedent) — its crack entry is by design.
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
const groundItemsAt_en = (f) => {
  const items = [];
  for (const a of castAt(f)) if (a.ground !== null && a.ground !== undefined) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  const bw = bowlAt(f); if (bw.rest) items.push({ id: 'bowl', y: bw.y, ground: 1.34, maxHover: 0.04 });
  const gr = grainAt(f); if (gr.rest) items.push({ id: 'grainbowl', y: gr.y, ground: 0, maxHover: 0.06 });
  const b2 = bowl2At(f); if (b2.rest) items.push({ id: 'bowl2', y: b2.y, ground: 0, maxHover: 0.06 });
  return items;
};

export const SHOTS = [
  { id: 'drone', a: 0, b: 79, light: 'dusk' },
  { id: 'offering', a: 80, b: 190, light: 'dusk' },
  { id: 'guardian', a: 191, b: 338, light: 'dusk' },
  { id: 'meera', a: 339, b: 414, light: 'dusk' },
  { id: 'hide', a: 415, b: 519, light: 'predawn' },
  { id: 'waits', a: 520, b: 591, light: 'predawn' },
  { id: 'crack', a: 592, b: 692, light: 'predawn' },
  { id: 'sips', a: 693, b: 831, light: 'predawn' },
  { id: 'hole', a: 832, b: 950, light: 'dawnfirst' },
  { id: 'miracle', a: 951, b: 1093, light: 'dawnfirst' },
  { id: 'sunrise', a: 1094, b: 1201, light: 'royalgold' },
  { id: 'nobody', a: 1202, b: 1293, light: 'royalgold' },
  { id: 'priest', a: 1294, b: 1447, light: 'royalgold' },
  { id: 'open', a: 1448, b: 1536, light: 'royalgold' },
  { id: 'birds', a: 1537, b: 1658, light: 'royalgold' },
  { id: 'hookq', a: 1659, b: 1745, light: 'royalgold' },
  { id: 'hook', a: 1746, b: 1795, light: 'royalgold' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
// ---------- HINDI retime wrapper (generated by retime.py) ----------
// Piecewise-linear EN->HI frame warp on phrase anchors; EN logic verbatim.
const WARP = [[0,0], [92,80], [100,80], [185,191], [197,191], [293,339], [304,339], [375,414], [386,414], [476,520], [490,520], [553,592], [566,592], [680,693], [695,693], [789,832], [803,832], [890,950], [1003,1094], [1020,1094], [1107,1200], [1120,1200], [1169,1294], [1182,1294], [1300,1435], [1313,1448], [1385,1537], [1397,1537], [1493,1659], [1504,1659], [1642,1793], [1653,1796]];
export const enFrame = (f) => {
  if (f <= 0) return 0;
  for (let i = 1; i < WARP.length; i++) {
    if (f <= WARP[i][0]) {
      const [x0, y0] = WARP[i - 1], [x1, y1] = WARP[i];
      return y0 + (y1 - y0) * (f - x0) / Math.max(1, x1 - x0);
    }
  }
  return WARP[WARP.length - 1][1];
};
const hiFrame = (e) => {
  if (e <= 0) return 0;
  for (let i = 1; i < WARP.length; i++) {
    if (e <= WARP[i][1]) {
      const [x0, y0] = WARP[i - 1], [x1, y1] = WARP[i];
      return x0 + (x1 - x0) * (e - y0) / Math.max(1, y1 - y0);
    }
  }
  return WARP[WARP.length - 1][0];
};
export const shotAt = (f) => shotAt_en(hiFrame(f));
export const camAt = (f) => camAt_en(hiFrame(f));
export const dofAt = (f) => dofAt_en(hiFrame(f));
export const worldAt = (f) => worldAt_en(hiFrame(f));
export const fxProfileAt = (f) => fxProfileAt_en(hiFrame(f));
export const heroPosAt = (f) => heroPosAt_en(hiFrame(f));
export const lightFor = (S, f) => lightFor_en(S, hiFrame(f));
export const actorsAt = (f, T) => actorsAt_en(hiFrame(f), T);
export const fxAt = (f, T) => fxAt_en(hiFrame(f), T);
export const dynamicsAt = (f) => dynamicsAt_en(hiFrame(f));
export const groundItemsAt = (f) => groundItemsAt_en(hiFrame(f));
