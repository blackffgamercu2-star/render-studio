// Shot plan for "The Baker Who Baked Bread Without an Oven" — baker
// (LIBRARY v4: speak.js dialogue performance + materials v4, camrig smooth
// tracking + solid colliders). Batch 7 topic 4. ONE set: a village bakery
// courtyard in morning sun. The baker's oven cracks on harvest-festival
// morning; he drags a flat black stone into the courtyard, polishes a wide
// brass plate to a second sun, tilts it to focus the light into a burning
// patch on the stone, and bakes flatbread on sun-heated stone.
// Voice stem: 50.611 s, 30 fps, TOTAL 1519; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1 0.00-5.06 On the morning...bread.      S6 25.52-31.32 By noon...browned.
//   S2 5.66-9.04 "I will still bake..."       S7 31.80-37.78 One by one...sun.
//   S3 9.46-13.24 The village thought...oven. S8 38.20-43.46 "The oven never..."
//   S4 13.66-19.80 But the baker dragged...sun. S9 44.14-50.04 But one boy...stars?
//   S5 20.12-24.90 He tilted the plate...patch.
// GRADE (FILTER_VFX_LIGHTING pack): Golden Hour throughout; the hook beat
// (S9) blends to dusk — grade changes ONLY on clause boundaries.
// Signature VFX: sun patch glowing on the black stone, heat shimmer, steam
// burst as bread hisses/puffs/browns, moving sheen + glints on the brass
// plate, golden glints on the loaves, festival bunting sway, dust motes.
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

export const FPS = 30, TOTAL = 1519, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 151, light: 'gold' },
  { id: 'promise', a: 152, b: 283, light: 'gold' },
  { id: 'doubt', a: 284, b: 409, light: 'gold' },
  { id: 'drag', a: 410, b: 487, light: 'gold' },
  { id: 'polish', a: 488, b: 603, light: 'gold' },
  { id: 'tilt', a: 604, b: 765, light: 'gold' },
  { id: 'noon', a: 766, b: 953, light: 'gold' },
  { id: 'feast', a: 954, b: 1145, light: 'gold' },
  { id: 'twist', a: 1146, b: 1323, light: 'gold' },
  { id: 'hookq', a: 1324, b: 1439, light: 'dusk' },
  { id: 'hook', a: 1440, b: 1518, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  gold: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
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
  if (S.id === 'hookq') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, 1324, 1390)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const STONE_HOME = { x: 0, z: 2.5, r: 0.85, top: 0.28 };
export const STONE_START = { x: -5.6, z: -5.2 };
export const TABLE = { x: 4.4, z: 7.2 };
export const OVEN = { x: -5.6, z: -13.1 };
const PLATE_LEAN = [-4.2, -11.75]; // leaning on the oven base front (z=-12.3), bottom edge on the ground
const PLATE_REST = [0.8, 0.6];
const PLATE_HELD = [-1.05, 1.05, 3.15];
const PLATE_TILT = [-1.0, 1.25, 3.1];

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const BAKER_KEYS = [
  [0, -4.0, -3.4], [151, -4.0, -3.4],
  [152, -3.2, -1.8], [409, -3.2, -1.8],
  [410, -6.9, -4.0], [487, -1.5, 3.6],
  [603, -1.5, 3.6], [765, -1.5, 3.6],
  [766, -1.6, 3.6], [953, -1.6, 3.6],
  [954, -1.7, 4.2], [1145, -1.7, 4.2],
  [1146, -1.2, 3.8], [1518, -1.2, 3.8],
];
const V1_KEYS = [
  [0, 3.1, 5.6], [953, 3.1, 5.6], [1000, 2.2, 4.4], [1518, 2.2, 4.4],
];
const V2_KEYS = [
  [0, 4.8, 3.2], [953, 4.8, 3.2], [1000, 3.4, 3.6], [1518, 3.4, 3.6],
];
const V3_KEYS = [
  [0, -4.6, 0.8], [953, -4.6, 0.8], [1000, -3.2, 2.6], [1518, -3.2, 2.6],
];
export const bakerAt = (f) => { const [x, z] = walkKeys(BAKER_KEYS, f); return { x, z }; };
export const v1At = (f) => { const [x, z] = walkKeys(V1_KEYS, f); return { x, z }; };
export const v2At = (f) => { const [x, z] = walkKeys(V2_KEYS, f); return { x, z }; };
export const v3At = (f) => { const [x, z] = walkKeys(V3_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const bakerMode = (f) => strolling(f, [[410, 487]]) ? 'stroll' : 'stand';
export const villagerMode = (f) => strolling(f, [[954, 1000]]) ? 'stroll' : 'stand';

// The flat black stone: dragged slowly along the ground (bottom flush, y=0)
// from the oven into the courtyard, then resting ON the courtyard ground.
export const stoneAt = (f) => {
  if (f < 410) return { x: STONE_START.x, y: 0, z: STONE_START.z, resting: 1, moving: 0 };
  if (f <= 487) {
    const u = smooth(ramp(f, 410, 487));
    return { x: lerp(STONE_START.x, STONE_HOME.x, u), y: 0, z: lerp(STONE_START.z, STONE_HOME.z, u), resting: 0, moving: 1 };
  }
  return { x: STONE_HOME.x, y: 0, z: STONE_HOME.z, resting: 1, moving: 0 };
};
// The wide brass plate: leaning by the oven -> picked up -> polished in the
// baker's hands -> tilted to the sun -> set down leaning on the stone edge.
export const plateAt = (f) => {
  if (f < 488) return { x: PLATE_LEAN[0], y: 0, z: PLATE_LEAN[1], tilt: 1.25, held: 0, resting: 1 };
  if (f <= 603) return { x: PLATE_HELD[0], y: PLATE_HELD[1], z: PLATE_HELD[2], tilt: 0.55 + 0.1 * Math.sin(f * 0.35), held: 1, resting: 0 };
  if (f <= 765) {
    const u = smooth(ramp(f, 604, 660));
    return { x: lerp(PLATE_HELD[0], PLATE_TILT[0], u), y: lerp(PLATE_HELD[1], PLATE_TILT[1], u), z: lerp(PLATE_HELD[2], PLATE_TILT[2], u), tilt: lerp(0.55, 1.0, u), held: 1, resting: 0 };
  }
  if (f <= 820) {
    const u = smooth(ramp(f, 766, 820));
    return { x: lerp(PLATE_TILT[0], PLATE_REST[0], u), y: lerp(PLATE_TILT[1], 0, u), z: lerp(PLATE_TILT[2], PLATE_REST[1], u), tilt: lerp(1.0, 1.2, u), held: 0, resting: 0 };
  }
  return { x: PLATE_REST[0], y: 0, z: PLATE_REST[1], tilt: 1.2, held: 0, resting: 1 };
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
// Three flatbreads, laid one by one on the stone (laid 847/862/877), each
// falling with accelerating gravity and landing exactly on the stone top.
const BREAD_SPOTS = [[-0.45, 2.15], [0.4, 2.05], [-0.05, 2.95]];
const BREAD_LAY = [847, 862, 877];
export const breadAt = (f) => BREAD_SPOTS.map(([x, z], i) => {
  const u = ramp(f, BREAD_LAY[i], BREAD_LAY[i] + 8);
  const y = STONE_HOME.top + (1 - u) * (1 - u) * 0.4; // accelerating fall, lands and STOPS
  return { x, y, z, k: u };
});
export const brownKAt = (f) => ramp(f, 885, 940); // hissed -> puffed -> browned
export const patchKAt = (f) => {
  if (f < 640) return 0;
  if (f <= 700) return smooth(ramp(f, 640, 700));
  if (f <= 953) return 1;
  return lerp(1, 0.25, smooth(ramp(f, 954, 1000))); // bread off the stone, patch fades
};
export const steamAt = (f) => segMax(f, [
  [847, 860, 940, 953, 0.5],   // wisps while the bread bakes
  [886, 895, 925, 940, 1],     // the HISS burst
]);
export const shimmerAt = (f) => segMax(f, [
  [650, 680, 740, 765, 0.6],   // heat rising as the patch forms
  [766, 790, 940, 953, 1],     // the noon stone, hotter than any oven shelf
]);
export const raysAt = (f) => segMax(f, [
  [620, 650, 740, 765, 1],     // sunlight bent down onto the stone
]);
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(510, 560, 0.7); pulse(560, 603, 0.9);   // polished until it shone
  pulse(604, 700, 1);                            // tilted to the sun
  pulse(960, 1050, 0.5);                         // golden loaves
  return s;
};
export const dustAt = (f) => Math.max(0.05, segMax(f, [
  [410, 430, 470, 487, 0.8],   // the heavy stone drags across the courtyard
  [487, 490, 500, 515, 0.9],   // it lands with a settle
]));
export const loafKAt = (f) => ramp(f, 960, 990); // the basket of golden loaves

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  promise: () => { const b = bakerAt(200); return [b.x, 1.45, b.z]; },
  doubt: () => [0.6, 1.1, 3.2],
  drag: () => { const s = stoneAt(450); return [s.x, 0.6, s.z]; },
  polish: () => [PLATE_HELD[0], 1.2, PLATE_HELD[2]],
  tilt: () => [PLATE_TILT[0], 1.2, PLATE_TILT[2]],
  noon: () => [STONE_HOME.x, 0.6, STONE_HOME.z],
  feast: () => [0.3, 1.1, 5],
  twist: () => { const b = bakerAt(1200); return [b.x, 1.45, b.z]; },
  hookq: () => [1.5, 1.3, 4.5],
  hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const stonePos = (f) => { const s = stoneAt(f); return [s.x, s.y, s.z]; };
const bakerPos = (f) => { const b = bakerAt(f); return [b.x, 0, b.z]; };
const platePos = (f) => { const p = plateAt(f); return [p.x, p.y, p.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[22, 13, 27], [13, 7.5, 19], [9, 4.5, 15.5], [7.4, 3.1, 13.4]],
    [[0, 3.0, -6], [0, 2.2, -2], [0, 1.2, 1.6], [0, 1.0, 2.2]], 0, 151, 44, 40) },
  promise: { cut: 'hard', raw: pushInCam({ subject: bakerPos, a: 152, b: 283, d0: 6.4, d1: 5.2, h0: 1.7, h1: 1.6, lookOff: [0, 1.45, 0], fov0: 40, fov1: 36,
    dir: () => [-0.5, 0.85] }) },
  doubt: { cut: 'hard', raw: keysCam({ keys: [
    { f: 284, pos: [8.6, 3.5, 13.2], look: [0.4, 1.0, 2.8], fov: 44 },
    { f: 409, pos: [8.1, 3.3, 12.6], look: [0.4, 1.0, 2.8], fov: 42, ease: 'surge' }] }) },
  drag: { cut: 'hard', raw: keysCam({ keys: [
    { f: 410, pos: [-1.5, 2.8, 3.5], look: [-5.6, 0.5, -5.2], fov: 44 },
    { f: 487, pos: [4.2, 2.6, 9.6], look: [-0.6, 0.9, 3.2], fov: 36, ease: 'surge' }] }) },
  polish: { cut: 'hard', raw: pushInCam({ subject: platePos, a: 488, b: 603, d0: 6.2, d1: 5.2, h0: 2.3, h1: 2.1, lookOff: [0, 0.2, 0], fov0: 34, fov1: 32,
    dir: () => [0.55, 0.8] }) },
  tilt: { cut: 'hard', raw: pushInCam({ subject: (f) => { const pl = plateAt(f), st = stoneAt(f), bk = bakerPos(f); return [(pl.x + st.x + bk[0]) / 3, 0.6, (pl.z + st.z + bk[2]) / 3]; }, a: 604, b: 765, d0: 9.0, d1: 7.5, h0: 2.4, h1: 2.2, lookOff: [0, 0.4, 0], fov0: 34, fov1: 32,
    dir: () => [0.55, 0.8] }) },
  noon: { cut: 'hard', raw: pushInCam({ subject: stonePos, a: 766, b: 953, d0: 10.0, d1: 9.0, h0: 2.4, h1: 2.2, lookOff: [-0.5, 0.3, 0], fov0: 44, fov1: 42,
    dir: () => [0.55, 0.8] }) },
  feast: { cut: 'hard', raw: keysCam({ keys: [
    { f: 954, pos: [8.6, 3.8, 15.2], look: [-0.6, 0.8, 3.2], fov: 46 },
    { f: 1145, pos: [6.3, 2.8, 11.2], look: [-0.6, 0.75, 3.0], fov: 38, ease: 'surge' }] }) },
  twist: { cut: 'hard', raw: pushInCam({ subject: bakerPos, a: 1146, b: 1323, d0: 3.4, d1: 2.75, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1324, pos: [5.2, 2.6, 8.6], look: [1.5, 1.3, 4.5], fov: 40 },
    { f: 1439, pos: [4.9, 2.5, 8.2], look: [1.4, 1.4, 4.5], fov: 38, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1440, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1518, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 487, a: 0.03 }, { f: 960, a: 0.02 }],
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
  if (['noon', 'twist', 'tilt', 'drag', 'polish'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), st = stoneAt(f), pl = plateAt(f), br = breadAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    stoneX: st.x, stoneY: st.y, stoneZ: st.z, stoneMoving: st.moving,
    bakerX: bakerAt(f).x, bakerZ: bakerAt(f).z,
    plateX: pl.x, plateY: pl.y, plateZ: pl.z, plateTilt: pl.tilt, plateHeld: pl.held,
    patchK: patchKAt(f), breadK: br[0].k + br[1].k + br[2].k, brownK: brownKAt(f),
    breadY0: br[0].y, breadY1: br[1].y, breadY2: br[2].y,
    breadX0: br[0].x, breadX1: br[1].x, breadX2: br[2].x,
    breadZ0: br[0].z, breadZ1: br[1].z, breadZ2: br[2].z,
    steamK: steamAt(f), shimmerK: shimmerAt(f), raysK: raysAt(f), plateGlint: glintAt(f),
    dustK: dustAt(f), loafK: loafKAt(f),
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 38)) * (1 - smooth(ramp(f, 54, 68)));
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1460, 1490)); // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: dustAt(f), splashRate: 0, steamRate: steamAt(f), shimmerRate: shimmerAt(f), grey: S.light === 'grey' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  baker: { jacket: '#f2e8d5', pants: '#5a4632', boots: '#3a2a1c', hat: 'cap', cap: '#f2e8d5', apron: '#6a7a8a', skin: '#c98a5a', moustache: '#3a2a1c' },
  vill1: { jacket: '#7a4a6e', pants: '#4a3a2a', boots: '#2c2018', hat: 'hair', hair: '#1c1410', skin: '#a06a3c' },
  vill2: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a' },
  vill3: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#888888', skin: '#8a5a34', moustache: '#888888' },
  boy: { jacket: '#3a6a8a', pants: '#2a3242', boots: '#1c1712', hat: 'hair', hair: '#241a14', skin: '#e8b88a' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const b = bakerAt(f), v1 = v1At(f), v2 = v2At(f), v3 = v3At(f);
  const bBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'shock', headTilt: 0.1 }, b.x, b.z, { yaw: -0.4 });
      std('vill1', OUTFITS.vill1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, v1.x, v1.z, { yaw: -0.3 });
      std('vill2', OUTFITS.vill2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, v2.x, v2.z, { yaw: -0.3 });
      std('vill3', OUTFITS.vill3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 53), seed: 53 }, v3.x, v3.z, { yaw: 0.4 });
      break;
    }
    case 'promise': {
      // THE first dialogue beat: the baker PERFORMS his promise — mouth
      // driven by the stem inside the speak segment, closed outside it.
      std('baker', OUTFITS.baker, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, prop: ['point', 0.6], ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.5 });
      break;
    }
    case 'doubt': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'neutral' }, b.x, b.z, { yaw: 0.55 });
      std('vill1', OUTFITS.vill1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, v1.x, v1.z, { yaw: -0.3 });
      std('vill2', OUTFITS.vill2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, v2.x, v2.z, { yaw: -0.3 });
      std('vill3', OUTFITS.vill3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 53), seed: 53, headTilt: 0.12 }, v3.x, v3.z, { yaw: 0.4 });
      break;
    }
    case 'drag': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'pained', mode: bakerMode(f), phase: q((f * 0.011) % 1, 2),
        prop: ['push', 0.8], headTilt: 0.15 }, b.x, b.z, { yaw: 0.55 });
      std('vill1', OUTFITS.vill1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, v1.x, v1.z, { yaw: -0.3 });
      std('vill2', OUTFITS.vill2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, v2.x, v2.z, { yaw: -0.3 });
      break;
    }
    case 'polish': {
      // the plate is already in his hands from the cut — he polishes it,
      // the brass catching the sun brighter with every rub
      const polishK = 0.5 + 0.5 * Math.sin(f * 0.35);
      std('baker', OUTFITS.baker, { ...bBase, prop: ['point', polishK] }, b.x, b.z, { yaw: 0.55 });
      std('vill1', OUTFITS.vill1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, v1.x, v1.z, { yaw: -0.3 });
      std('vill2', OUTFITS.vill2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, v2.x, v2.z, { yaw: -0.3 });
      break;
    }
    case 'tilt': {
      std('baker', OUTFITS.baker, { ...bBase, prop: ['point', 0.85] }, b.x, b.z, { yaw: 0.55 });
      std('vill1', OUTFITS.vill1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, v1.x, v1.z, { yaw: -0.3 });
      break;
    }
    case 'noon': {
      const browning = f >= 885;
      std('baker', OUTFITS.baker, { ...bBase, expr: browning ? 'grin' : 'smile', prop: f >= 847 && f < 880 ? ['point', 0.7] : null }, b.x, b.z, { yaw: 0.55 });
      std('vill1', OUTFITS.vill1, { expr: f >= 886 ? 'shock' : 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, v1.x, v1.z, { yaw: -0.3 });
      std('vill2', OUTFITS.vill2, { expr: f >= 886 ? 'shock' : 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, v2.x, v2.z, { yaw: -0.3 });
      break;
    }
    case 'feast': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'grin', prop: ['point', 0.55] }, b.x, b.z, { yaw: 0.55 });
      std('vill1', OUTFITS.vill1, { expr: 'laugh', mode: villagerMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51 }, v1.x, v1.z, { yaw: -0.3 });
      std('vill2', OUTFITS.vill2, { expr: 'laugh', mode: villagerMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 52), seed: 52 }, v2.x, v2.z, { yaw: -0.3 });
      std('vill3', OUTFITS.vill3, { expr: 'smile', mode: villagerMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 53), seed: 53 }, v3.x, v3.z, { yaw: 0.4 });
      break;
    }
    case 'twist': {
      // THE twist dialogue beat: the baker PERFORMS both spoken lines —
      // mouth driven by the stem inside the two speak segments, firmly
      // closed in the "the baker said" tag between them.
      std('baker', OUTFITS.baker, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.5 });
      break;
    }
    case 'hookq': {
      std('boy', OUTFITS.boy, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 71), seed: 71, headTilt: -0.18 }, 1.5, 4.5, { yaw: 0.2, s: 0.78 });
      std('baker', OUTFITS.baker, { ...bBase, expr: 'smile' }, b.x, b.z, { yaw: 0.5 });
      break;
    }
    case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-8, -3.2, -14, -12.2, { h: 4, id: 'oven' }),
  SOL.aabb(-17.5, -16, -14, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 12, { h: 2.6, id: 'wallE' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => SOL.circle(x, -13.2, 0.35, { h: 4.4, id: 'column' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  // the stone is a dynamic collider whenever it RESTS (at the oven before
  // the drag, at its home after); while dragged it is transitional, like a
  // carried prop, and unchecked.
  const st = stoneAt(f);
  if (st.resting) out.push(SOL.circle(st.x, st.z, STONE_HOME.r, { kind: 'dynamic', id: 'stone' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const st = stoneAt(f);
  items.push({ id: 'stone', y: st.y, ground: 0, maxHover: 0.03 });
  const pl = plateAt(f);
  if (pl.resting) items.push({ id: 'plate', y: pl.y, ground: 0, maxHover: 0.03 });
  for (const [i, br] of breadAt(f).entries()) {
    if (br.k >= 1) items.push({ id: `bread${i}`, y: STONE_HOME.top, ground: STONE_HOME.top, maxHover: 0.03 });
  }
  if (loafKAt(f) >= 1) items.push({ id: 'loafbasket', y: 0.78, ground: 0.78, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
