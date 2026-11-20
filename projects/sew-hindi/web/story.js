// Shot plan for "अंधेरे में सिलाई करने वाली लड़की" — sew-hindi (Batch 10 H1).
// Salted Mine V3 style + "v4" ACTION CAMERA + Library v6 body
// (life/emo/gesture/stride) + FULL UPGRADE (2026-11-19): real light —
// this is a NIGHT story: one moon logic, and the firefly jar is THE
// practical light source (brightest at source, soft falloff, glow on
// faces/cloth near it, honest darkness elsewhere). Characters NOT
// flat: volume shading, rim, cheek/brow emotion shading, springy
// hair, cloth folds, contact shadows. Speaking = moving + emotion.
// Real object physics: needle/thread rhythm, cloth weight, the jar
// lifted and held with real grips. END RULE: the only performed line
// is L12 (mid-film, f1190); the last quarter is narration only.
// Voice stem: voice_build.wav — Rishav voice clone (Chatterbox
// local), speed-fitted, 62.855583 s, 30 fps, TOTAL 1886. Line
// timings from timing.json (faster-whisper small char-mapped onto
// the script — see ../align.py). Scene changes ONLY at line bounds.
// ONE set: Munni's hut (interior z -3.2..1.2, window in the back
// wall at x -2.15..-1.05, door in the east wall) + the courtyard
// and lane to the south (z > 1.2). She sews at (0.35,-1.5); the
// covered jar sits by her knees at (0.95,-1.15).
// GRADE: Night Lamp while she works, warming to dawn across the
// proverb line (dawnK). Boards and captions are never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1886, DECK = 0;
export const SHOTS = [
  { id: 'opening',   a: 0,    b: 145,  light: 'night' },
  { id: 'needle',    a: 146,  b: 250,  light: 'night' },
  { id: 'rumour',    a: 251,  b: 359,  light: 'night' },
  { id: 'bhola',     a: 360,  b: 497,  light: 'night' },
  { id: 'sneak',     a: 498,  b: 595,  light: 'night' },
  { id: 'window',    a: 596,  b: 703,  light: 'night' },
  { id: 'leak',      a: 704,  b: 820,  light: 'night' },
  { id: 'glowleak',  a: 821,  b: 906,  light: 'night' },
  { id: 'burstin',   a: 907,  b: 1012, light: 'night' },
  { id: 'jar',       a: 1013, b: 1111, light: 'night' },
  { id: 'pickup',    a: 1112, b: 1189, light: 'night' },
  { id: 'line',      a: 1190, b: 1313, light: 'night' },
  { id: 'cover',     a: 1314, b: 1406, light: 'night' },
  { id: 'stop',      a: 1407, b: 1504, light: 'night' },
  { id: 'village',   a: 1505, b: 1552, light: 'night' },
  { id: 'proverb',   a: 1553, b: 1624, light: 'night' },
  { id: 'teach',     a: 1625, b: 1766, light: 'night' },
  { id: 'hookboard', a: 1767, b: 1885, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const lerp3 = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)];

// ---------- geography ----------
export const BOARD_POS = [0.1, 1.95, 1.55];
export const SIGN_POS = BOARD_POS;
export const groundAt = (x, z) => 0; // flat earth: hut floor and courtyard alike
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// ---------- world tracks ----------
export const dawnK = (f) => smooth(ramp(f, 1558, 1652));           // night -> dawn over the proverb
function track(keys) { // piecewise track with smootherstep easing per span
  return (f) => {
    if (f <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp(v0, v1, smooth(clamp((f - f0) / Math.max(1, f1 - f0)))); }
    }
    return keys[keys.length - 1][1];
  };
}
export const handK = track([[0, 0], [1418, 0], [1436, 1], [1504, 1], [1524, 0], [1885, 0]]); // Bhola's palm over the jar
export const jarK = track([                                   // master firefly glow
  [0, 0.22], [986, 0.22], [998, 1.0], [1436, 1.0], [1455, 0.05], [1504, 0.05],
  [1525, 0.95], [1624, 0.9], [1660, 0.55], [1885, 0.5]]);
export const coverOn = track([[0, 1], [986, 1], [1002, 0], [1885, 0]]); // cloth ON the jar -> ripped off
export const doorK = track([[0, 0], [944, 0], [964, 1], [1885, 1]]);
export const stitchK = (f) => kf([[0, 1], [244, 1], [252, 0], [590, 0], [598, 1], [984, 1], [992, 0], [1885, 0]], f);
export const burstK = (f) => Math.max(0, kf([[984, 0], [990, 1], [1014, 0]], f)); // glow flash at the lift
// jar position: floor spot -> held in her left palm -> set down front
const JAR_FLOOR = [0.95, 0, -1.15], JAR_HELD = [0.13, 0.52, -1.0], JAR_DOWN = [0.8, 0, -0.8];
export function jarStateAt(f) {
  if (f < 1140) return { x: JAR_FLOOR[0], y: JAR_FLOOR[1], z: JAR_FLOOR[2] };
  if (f < 1172) { const p = lerp3(JAR_FLOOR, JAR_HELD, smooth(ramp(f, 1140, 1172))); p[1] += Math.sin(ramp(f, 1140, 1172) * Math.PI) * 0.08; return { x: p[0], y: p[1], z: p[2] }; }
  if (f < 1493) return { x: JAR_HELD[0], y: JAR_HELD[1], z: JAR_HELD[2] };
  if (f < 1522) { const p = lerp3(JAR_HELD, JAR_DOWN, smooth(ramp(f, 1493, 1522))); return { x: p[0], y: p[1], z: p[2] }; }
  return { x: JAR_DOWN[0], y: JAR_DOWN[1], z: JAR_DOWN[2] };
}
// needle: stitch bob ~2.1 Hz while sewing; FROZEN at its f986 pose after
const PH = Math.PI * 2 * 2.1 / 30, FROZEN_BOB = 0.5 + 0.5 * Math.sin(986 * PH);
export function needleAt(f) {
  const k = stitchK(f);
  if (k > 0.02) { const b = 0.5 + 0.5 * Math.sin(f * PH); return { bob: b, glint: k * Math.pow(Math.max(0, Math.sin(f * PH + 0.6)), 6), active: k }; }
  return { bob: FROZEN_BOB, glint: 0, active: 0 };
}

// ---------- lights / mood grades ----------
// ONE moon all night (az/el fixed in the night grade); the dawn grade
// is a different hour, blended ONLY across the proverb line (dawnK).
// Exposure choreography: the scene DIMS while the jar is covered
// (handK) and breathes up in a short flash at the cloth lift (burstK).
export const LIGHTS = {
  night: { az: 248, el: 30, sky: '#7d8db0', ground: '#262b33', hemi: 0.5, sun: '#b9c9e8', sunI: 0.62,
    fog: '#1f2735', fogNear: 8, fogFar: 52, skyTop: '#0e1626', skyHor: '#31435f', sunDisc: '#e6edf7', sunSize: 0.005,
    sat: 0.94, vig: 0.34, shadowExt: 20, aurora: 0, gain: '#ccd6ea', waterDeep: '#16222e', waterShal: '#2c4256', glint: '#cfe0ff' },
  dawn: { az: 96, el: 17, sky: '#e6d3a3', ground: '#5c5540', hemi: 0.74, sun: '#ffc478', sunI: 1.3,
    fog: '#e9dab4', fogNear: 26, fogFar: 150, skyTop: '#6ea8d8', skyHor: '#ffd9a1', sunDisc: '#fff1c4', sunSize: 0.012,
    sat: 1.09, vig: 0.25, shadowExt: 22, aurora: 0, gain: '#ffedc6', waterDeep: '#274b5c', waterShal: '#4d7d94', glint: '#ffe2a8' },
};
const mixHex = (a, b, u) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
};
export const lightFor = (S, f) => {
  const base = LIGHTS[S.light] || LIGHTS.night, D = LIGHTS.dawn, u = dawnK(f);
  const out = { ...base };
  if (u > 0.001) {
    for (const k of ['az', 'el', 'hemi', 'sunI', 'sat', 'vig', 'sunSize', 'fogNear', 'fogFar', 'shadowExt']) out[k] = lerp(base[k], D[k], u);
    for (const k of ['sky', 'ground', 'sun', 'skyTop', 'skyHor', 'sunDisc', 'gain', 'waterDeep', 'waterShal', 'glint', 'fog']) out[k] = mixHex(base[k], D[k], u);
  }
  const dim = 1 - 0.22 * handK(f), fl = burstK(f);
  out.hemi = out.hemi * dim + 0.22 * fl;
  out.sunI = out.sunI * (1 - 0.3 * handK(f)) + 0.3 * fl;
  return out;
};

// ---------- cast position tracks ----------
function bholaAt(f) {
  const s = shotAt(f).id;
  if (s === 'sneak') {
    const x = kf([[498, 2.7], [528, -4.1], [552, -4.0], [575, -1.62], [596, -1.62]], f);
    const z = kf([[498, 4.7], [528, 1.6], [552, -3.95], [575, -4.02], [596, -4.02]], f);
    return { x, z, mode: f < 562 ? 'stroll' : BHOLA_POSE(f).mode, ph: stridePh(498 / 30, f / 30, 1.05) };
  }
  if (s === 'burstin') {
    const x = kf([[907, -1.62], [938, 4.45], [950, 3.85], [962, 3.0], [978, 1.5], [986, 1.32], [1013, 1.32]], f);
    const z = kf([[907, -4.02], [938, -3.75], [950, 0.5], [962, 0.3], [978, -0.7], [986, -0.82], [1013, -0.82]], f);
    return { x, z, mode: f < 978 ? 'stroll' : 'stand', ph: stridePh(907 / 30, f / 30, 1.05) };
  }
  if (s === 'window' || s === 'leak' || s === 'glowleak') return { x: -0.85, z: -4.05, mode: 'kneel1', ph: 0 }; // east of the window, clear of the POV axis
  if (s === 'jar') return { x: 2.6, z: -1.9, mode: 'stand', ph: 0 }; // stepped well back: the insert stays clean
  if (s === 'pickup' || s === 'line') return { x: 1.45, z: -1.55, mode: 'kneel', ph: 0 }; // beside her, clear of the line camera
  if (s === 'cover' || s === 'stop') return { x: 1.15, z: -0.7, mode: 'stand', ph: 0 };
  if (s === 'village' || s === 'proverb') return { x: 1.3, z: -0.5, mode: 'stand', ph: 0 };
  if (s === 'teach') return { x: 2.05, z: 2.3, mode: 'stand', ph: 0 };
  if (s === 'hookboard') return { x: 1.42, z: 5.6, mode: 'stand', ph: 0 };
  return { x: 3.05, z: 4.75, mode: 'stand', ph: 0 }; // at his father's stall
}
function munniAt(f) {
  const s = shotAt(f).id;
  if (s === 'teach') return { x: 0.2, z: 2.6 };
  if (s === 'hookboard') return { x: -0.7, z: 5.75 };
  return { x: 0.35, z: -1.5 };
}
const MUNNI_POSE = poseWindows([{ a: 0, b: 1111, mode: 'sit' }, { a: 1112, b: 1624, mode: 'kneel' }, { a: 1767, b: 1885, mode: 'kneel' }]);
const BHOLA_POSE = poseWindows([{ a: 562, b: 906, mode: 'kneel1' }]);

// ---------- focus / depth of field ----------
const FOCUS = {
  opening: () => [0.35, 1.02, -1.5], needle: () => [0.35, 0.38, -1.02], rumour: () => [-1.8, 1.35, 5.6],
  bhola: () => [3.05, 1.32, 4.75], sneak: (f) => { const b = bholaAt(f); return [b.x, 1.0, b.z]; },
  window: () => [0.35, 0.9, -1.5], leak: () => [0.95, 0.2, -1.15], glowleak: () => [0.95, 0.17, -1.15],
  burstin: () => [0.95, 0.25, -1.15], jar: () => [0.95, 0.16, -1.15], pickup: () => [0.35, 1.02, -1.5],
  line: () => [0.35, 1.02, -1.5], cover: () => [0.13, 0.55, -1.0], stop: () => [0.35, 0.38, -1.02],
  village: () => [0.8, 0.25, -0.8], proverb: () => [0.35, 1.02, -1.5], teach: () => [0.2, 1.5, 2.6],
  hookboard: () => [0.1, 1.92, 1.55],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: v4 ACTION LEVEL — every shot travels ----------
// Head-width maths (card head ~0.61 m): % = 0.61 / (2*d*tan(fov/2)*0.5625).
const MUNNI_FACE = [0.35, 1.02, -1.5], JAR_PT = [0.95, 0.2, -1.15], LAP_PT = [0.35, 0.38, -1.02];
const KC = (keys) => keysCam({ keys });
const RIG_BY_ID = {
  // hero BIG from frame 0 (~40% head, low angle), mid-stitch, slow push
  opening: { raw: KC([{ f: 0, pos: [2.1, 1.0, 2.45], look: MUNNI_FACE, fov: 37 }, { f: 145, pos: [1.8, 0.96, 1.9], look: MUNNI_FACE, fov: 34 }]) },
  // lap INSERT: needle + thread + embroidered cloth fill the frame
  needle: { raw: KC([{ f: 146, pos: [1.2, 0.74, -0.08], look: LAP_PT, fov: 37 }, { f: 250, pos: [1.02, 0.66, -0.28], look: LAP_PT, fov: 35 }]) },
  rumour: { raw: KC([{ f: 251, pos: [0.7, 1.55, 10.1], look: [-1.25, 1.2, 5.7], fov: 40 }, { f: 359, pos: [0.25, 1.45, 9.1], look: [-1.25, 1.22, 5.7], fov: 37 }]) },
  bhola: { raw: KC([{ f: 360, pos: [5.7, 1.75, 8.7], look: [3.05, 1.3, 4.75], fov: 40 }, { f: 430, pos: [4.6, 1.5, 7.2], look: [3.05, 1.3, 4.75], fov: 37 }, { f: 497, pos: [4.3, 1.42, 6.8], look: [3.05, 1.22, 4.75], fov: 36 }]) },
  // tracking at his speed, west of him, hut wall as backdrop
  sneak: { raw: (f) => { const b = bholaAt(f); return { pos: [b.x - 1.9, 1.5, b.z + 0.9], look: [b.x, 1.05, b.z], fov: 38, roll: 0 }; } },
  // his POV from outside: the camera sits on the axis through the
  // window's EAST pane (the centre mullion blocks the middle pane)
  // to Munni's hands — she sews framed inside the opening
  window: { raw: KC([{ f: 596, pos: [-2.15, 1.35, -4.15], look: [0.35, 0.98, -1.5], fov: 38 }, { f: 703, pos: [-2.0, 1.32, -3.95], look: [0.35, 0.98, -1.5], fov: 35 }]) },
  // his gaze lands: interior pan from her hands down to the cloth
  leak: { raw: KC([{ f: 704, pos: [1.7, 0.85, 0.15], look: [0.35, 0.75, -1.45], fov: 38 }, { f: 762, pos: [1.6, 0.7, -0.05], look: [0.65, 0.45, -1.3], fov: 37 }, { f: 820, pos: [1.5, 0.6, -0.2], look: JAR_PT, fov: 36 }]) },
  // the covered jar fills the frame, green breathing under the cloth edge
  glowleak: { raw: KC([{ f: 821, pos: [1.95, 0.5, -0.4], look: [0.95, 0.17, -1.15], fov: 36 }, { f: 906, pos: [1.7, 0.44, -0.55], look: [0.95, 0.17, -1.15], fov: 34 }]) },
  // wide enough to read door (east) + Munni + jar; push lands WITH the lift
  burstin: { raw: KC([{ f: 907, pos: [-2.7, 1.55, 3.0], look: [0.8, 0.8, -1.0], fov: 41 }, { f: 986, pos: [-2.2, 1.4, 2.4], look: [0.7, 0.7, -1.1], fov: 39 }, { f: 1012, pos: [-1.55, 1.3, 2.2], look: [0.55, 0.65, -1.15], fov: 37 }]) },
  // firefly jar INSERT (glow reads big, glass + cork + dozens of lights)
  jar: { raw: KC([{ f: 1013, pos: [1.62, 0.52, -0.3], look: [0.95, 0.16, -1.15], fov: 36 }, { f: 1111, pos: [1.3, 0.4, -0.62], look: [0.95, 0.15, -1.15], fov: 34 }]) },
  pickup: { raw: KC([{ f: 1112, pos: [1.95, 1.08, 1.65], look: [0.55, 0.78, -1.2], fov: 39 }, { f: 1189, pos: [1.7, 1.05, 1.3], look: [0.5, 0.82, -1.2], fov: 37 }]) },
  line: { raw: pushInCam({ subject: MUNNI_FACE, dir: [0.53, 0.85], d0: 2.7, d1: 2.2, h0: 0.12, h1: 0.1, a: 1190, b: 1313, fov0: 38, fov1: 35 }) },
  cover: { raw: KC([{ f: 1314, pos: [1.8, 0.98, 0.95], look: [0.6, 0.62, -1.05], fov: 38 }, { f: 1406, pos: [1.62, 0.92, 0.7], look: [0.55, 0.6, -1.05], fov: 36 }]) },
  // frozen needle in the returned dark; jar at frame right for the hand-off
  stop: { raw: KC([{ f: 1407, pos: [1.5, 0.9, 0.5], look: [0.5, 0.4, -1.05], fov: 37 }, { f: 1504, pos: [1.42, 0.84, 0.34], look: [0.5, 0.4, -1.05], fov: 35 }]) },
  village: { raw: KC([{ f: 1505, pos: [0.2, 1.75, 5.4], look: [0.3, 0.9, -1.1], fov: 42 }, { f: 1552, pos: [0.2, 1.65, 4.8], look: [0.3, 0.9, -1.1], fov: 40 }]) },
  proverb: { raw: pushInCam({ subject: MUNNI_FACE, dir: [0.48, 0.88], d0: 2.5, d1: 2.05, h0: 0.12, h1: 0.1, a: 1553, b: 1624, fov0: 37, fov1: 35 }) },
  teach: { raw: KC([{ f: 1625, pos: [3.9, 2.1, 9.2], look: [0.3, 0.95, 2.6], fov: 43 }, { f: 1766, pos: [3.3, 1.95, 8.4], look: [0.3, 0.95, 2.6], fov: 40 }]) },
  // hook board ~84% width, fully inside; cast kneeling in the foreground
  hookboard: { raw: KC([{ f: 1767, pos: [0.55, 2.05, 11.85], look: [0.1, 1.92, 1.55], fov: 44 }, { f: 1885, pos: [0.5, 2.0, 11.55], look: [0.1, 1.92, 1.55], fov: 44 }]) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 988, a: 0.3 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { opening: 2.6, needle: 3.0, rumour: 2.2, bhola: 2.8, sneak: 2.4, window: 2.6, leak: 3.0, glowleak: 2.8,
  burstin: 2.2, jar: 3.2, pickup: 2.6, line: 3.2, cover: 3.0, stop: 3.0, village: 1.8, proverb: 3.0, teach: 2.0, hookboard: 1.3 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1772, 1796)) : 0,
    jarK: jarK(f), coverOn: coverOn(f), doorK: doorK(f), dawnK: dawnK(f),
    handK: handK(f), stitchK: stitchK(f), burstK: burstK(f),
  };
};
export const fxProfileAt = (f) => {
  return { moteRate: 0.08 + 0.3 * dawnK(f), blastRate: 0, sparkRate: 0.5 * stitchK(f), steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours
// flat and saturated (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  munni: { jacket: '#7a1f3d', dress: '#c94f30', pants: '#5d2a3a', boots: '#4a2c1c', hat: 'hair', hair: '#17110c', skin: '#fbf7ef' },
  bhola: { jacket: '#3f7d5a', pants: '#4a3626', boots: '#3a2a1a', hat: '#e8b93c', hair: '#241a10', skin: '#fbf7ef' },
  villA: { jacket: '#5a5348', pants: '#3d3830', boots: '#2e2620', hat: '#e8e3d5', hair: '#2a2018', skin: '#fbf7ef', moustache: '#2a2018' },
  villB: { jacket: '#2f5d8a', dress: '#3d7ab5', pants: '#2c4a6b', boots: '#3a2a1a', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  girlA: { jacket: '#e8b93c', dress: '#d9a441', pants: '#8a6a2a', boots: '#4a2c1c', hat: 'hair', hair: '#17110c', skin: '#fbf7ef' },
  girlB: { jacket: '#4a7d3a', dress: '#7ab648', pants: '#3d5a2e', boots: '#4a2c1c', hat: 'hair', hair: '#17110c', skin: '#fbf7ef' },
};
// Emotion morphs at story beats (body.js emoTrack over toon.faceP).
const emoMunni = emoTrack(T.faceP, 'neutral', [
  [146, 'thinking', 8], [596, 'neutral', 8], [990, 'shock', 5], [1000, 'wonder', 10],
  [1112, 'smile', 8], [1352, 'shock', 5], [1407, 'nervous', 8], [1505, 'relief', 8],
  [1553, 'proud', 8], [1625, 'smile', 8], [1767, 'grin', 8]]);
const emoBhola = emoTrack(T.faceP, 'squint', [
  [498, 'nervous', 8], [596, 'wonder', 8], [986, 'shock', 5], [1112, 'wonder', 8],
  [1314, 'smug', 6], [1407, 'shock', 6], [1505, 'nervous', 8], [1625, 'relief', 8], [1767, 'smile', 8]]);
const emoVill = emoTrack(T.faceP, 'neutral', [[1505, 'wonder', 8]]);
const emoGirl = emoTrack(T.faceP, 'wonder', [[1700, 'smile', 10], [1767, 'grin', 8]]);
// Continuous life per character (body.js lifeAt).
const lifeMunni = lifeAt({ seed: 21 }), lifeBhola = lifeAt({ seed: 31 }),
  lifeVillA = lifeAt({ seed: 41 }), lifeVillB = lifeAt({ seed: 51 }),
  lifeGirlA = lifeAt({ seed: 61 }), lifeGirlB = lifeAt({ seed: 71 });
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
const noBlush = (P) => { const P2 = { ...P, cheek: Math.max(P.cheek ?? 0, 0.55) }; P2.blush = 0; P2.openL = Math.min(1, (P2.openL ?? 0.85) * 1.45); P2.openR = Math.min(1, (P2.openR ?? 0.85) * 1.45); return P2; };
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// dialogue gesture: Munni's free (right) hand talks with the voice —
// stresses on दोस्तों (f1237), रोशनी (f1264), शीशी (f1284).
const gestMunni = gestureAt([{ a: 1190, b: 1310, beats: [1237, 1264, 1284], base: 0.5, amp: 0.18 }]);
const gestTeach = gestureAt([{ a: 1625, b: 1766, beats: [1660, 1700, 1740], base: 0.55, amp: 0.12 }]);
// the jar lift: both hands rise with it, then it rests (pickup shot).
const carryAt = (f) => (f < 1140 ? null : f < 1172 ? q(smooth(ramp(f, 1140, 1172)) * 0.85, 2) : 0.85);

export const castAt = (f) => {
  const S = shotAt(f), id = S.id, tint = tintFor(S), out = [];
  const std = (cid, o, opts, x, z, extra = {}) => {
    const gy = groundAt(x, z);
    out.push({ id: cid, x, y: extra.y ?? gy, z, r: extra.r || 0.32, ground: extra.ground ?? gy,
      actor: (TT) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? gy),
        draw: (p) => { TT.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
        x, y: extra.y ?? gy, z, ground: extra.ground ?? gy, tint, ...extra }) });
  };
  const MP = noBlush(emoMunni.at(f)), BP = noBlush(emoBhola.at(f)), VP = noBlush(emoVill.at(f)), GP = noBlush(emoGirl.at(f));
  const m = munniAt(f), b = bholaAt(f), mp = MUNNI_POSE(f);
  const stK = stitchK(f);
  // ---- Munni (present in every shot: sewing inside even when the
  // camera is out on the lane — the gossip's subject, in the dark) ----
  const mOpts = { expr: 'smile', exprP: MP, mode: mp.mode, blink: blinkAt(f, 20), seed: 21,
    ...H2(lifeMunni, f, 21, { squash: mp.squash, look: 0, lookY: 0.3 }) };
  if (id === 'opening' || id === 'needle' || id === 'window' || id === 'leak' || id === 'glowleak' || id === 'burstin') {
    mOpts.lookY = q(0.32 + 0.05 * Math.sin(f * PH) * stK, 2); // eyes ride the needle
    mOpts.look = q(id === 'burstin' && f > 992 ? 0.5 : 0.05, 2); // glance up as the cloth flies
  }
  if (id === 'jar') { mOpts.look = q(0.3, 2); mOpts.lookY = q(0.2, 2); }
  if (id === 'pickup') { const c = carryAt(f); if (c !== null) mOpts.carry = c; mOpts.look = q(0.35, 2); mOpts.lookY = q(0.05, 2); }
  if (id === 'line') {
    // THE LINE, performed: mouth driven by the stem (speak.js); jar
    // rests on her left palm, right hand gestures on the stress
    // words; nobody else's mouth moves — narration is voice-over.
    const sp = SPEAK.at(f);
    const speakP = SPK.applySpeak({ ...emoMunni.at(f), cheek: Math.max(emoMunni.at(f).cheek ?? 0, 0.55) }, sp);
    speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
    mOpts.exprP = speakP;
    mOpts.propL = ['point', 0.8];
    mOpts.prop = ['point', q(gestMunni(f).k, 2)];
    mOpts.headTilt = q((sp.nod || 0) * 0.8 + micro(f, 21) + lifeMunni(f).sway, 1);
    mOpts.look = q(0.18, 2); mOpts.lookY = q(-0.02, 2);
  }
  if (id === 'cover') { mOpts.propL = ['point', 0.8]; mOpts.look = q(0.3, 2); mOpts.lookY = q(0.1, 2); }
  if (id === 'stop') { mOpts.propL = ['point', 0.8]; mOpts.look = q(0.1, 2); mOpts.lookY = q(0.34, 2); } // staring at the frozen needle
  if (id === 'village' || id === 'proverb') { mOpts.look = q(0.1, 2); mOpts.lookY = q(0, 2); }
  if (id === 'teach') { mOpts.mode = 'stand'; mOpts.prop = ['point', q(gestTeach(f).k, 2)]; mOpts.look = q(0.15, 2); mOpts.lookY = q(0.05, 2); }
  if (id === 'hookboard') { mOpts.mode = 'kneel'; mOpts.prop = ['point', 0.3]; mOpts.look = q(-0.25, 2); mOpts.lookY = q(-0.3, 2); }
  std('munni', OUTFITS.munni, mOpts, m.x, m.z, { yaw: 0.05, s: 1 });
  // ---- Bhola ----
  const bOpts = { expr: 'smile', exprP: BP, mode: b.mode, phase: q(b.ph, 2), blink: blinkAt(f, 31), seed: 31,
    ...H2(lifeBhola, f, 31, { look: 0, lookY: 0 }) };
  if (id === 'bhola' || id === 'rumour' || id === 'opening' || id === 'needle') {
    bOpts.prop = ['point', f < 428 && id === 'bhola' ? 0.85 : id === 'bhola' ? 0.25 : 0.85]; // squinting at his needle
    bOpts.lookY = q(id === 'bhola' && f >= 428 ? 0.55 : -0.25, 2); bOpts.look = q(-0.1, 2);
  }
  if (id === 'sneak') { bOpts.look = q(0.3, 2); bOpts.lookY = q(0.1, 2); }
  if (id === 'window' || id === 'leak') { bOpts.propL = ['point', 0.5]; bOpts.look = q(0.15, 2); bOpts.lookY = q(0.12, 2); }
  if (id === 'glowleak') { bOpts.propL = ['point', 0.5]; bOpts.look = q(0.1, 2); bOpts.lookY = q(0.2, 2); } // face in the window, glow from below
  if (id === 'burstin' && f >= 978) { bOpts.prop = ['point', 0.9]; bOpts.look = q(-0.4, 2); bOpts.lookY = q(0.25, 2); }
  if (id === 'jar') { bOpts.look = q(-0.45, 2); bOpts.lookY = q(0.3, 2); }
  if (id === 'pickup' || id === 'line') { bOpts.look = q(-0.5, 2); bOpts.lookY = q(-0.05, 2); if (id === 'line') bOpts.headTilt = q(nodAt(f, 1284, 10, 0.5) + micro(f, 31) + lifeBhola(f).sway, 1); }
  if (id === 'cover' || id === 'stop') { bOpts.prop = ['point', q(0.55 + 0.35 * handK(f), 2)]; bOpts.look = q(-0.45, 2); bOpts.lookY = q(0.28, 2); }
  if (id === 'village' || id === 'proverb') { bOpts.look = q(-0.3, 2); bOpts.lookY = q(0.1, 2); }
  if (id === 'teach') { bOpts.carry = 0.5; bOpts.look = q(-0.4, 2); bOpts.lookY = q(0.15, 2); } // his own jar, held careful
  if (id === 'hookboard') { bOpts.look = q(-0.3, 2); bOpts.lookY = q(-0.28, 2); }
  std('bhola', OUTFITS.bhola, bOpts, b.x, b.z, { yaw: 0, s: 0.84 });
  // ---- rumour villagers (lane) / doorway pair (village) ----
  if (id === 'rumour') {
    std('villA', OUTFITS.villA, { expr: 'smile', exprP: VP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeVillA, f, 41, { look: 0.4, lookY: -0.05 }) }, -1.8, 5.6, { yaw: 0.1, s: 1 });
    std('villB', OUTFITS.villB, { expr: 'smile', exprP: VP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeVillB, f, 51, { look: -0.35, lookY: 0 }) }, -0.85, 6.15, { yaw: -0.1, s: 0.97 });
  }
  if (id === 'village') {
    const eAx = kf([[1505, 5.4], [1530, 3.4], [1545, 2.6], [1885, 2.6]], f), eAz = kf([[1505, 0.6], [1530, 0.45], [1545, -0.1], [1885, -0.1]], f);
    const eBx = kf([[1505, 6.3], [1512, 6.3], [1548, 3.4], [1560, 2.9], [1885, 2.9]], f), eBz = kf([[1505, 1.1], [1512, 1.1], [1548, 0.42], [1560, 0.6], [1885, 0.6]], f);
    std('villA', OUTFITS.villA, { expr: 'smile', exprP: VP, mode: f < 1545 ? 'stroll' : 'stand', phase: q(stridePh(1505 / 30, f / 30, 1.05), 2), blink: blinkAt(f, 41), seed: 41, ...H2(lifeVillA, f, 41, { look: -0.4, lookY: 0.15 }) }, eAx, eAz, { yaw: 0, s: 1 });
    std('villB', OUTFITS.villB, { expr: 'smile', exprP: VP, mode: f < 1560 ? 'stroll' : 'stand', phase: q(stridePh(1512 / 30, f / 30, 1.05), 2), blink: blinkAt(f, 51), seed: 51, ...H2(lifeVillB, f, 51, { look: -0.45, lookY: 0.15 }) }, eBx, eBz, { yaw: 0, s: 0.97 });
  }
  // ---- courtyard girls ----
  if (id === 'teach' || id === 'hookboard') {
    const gAOpts = { expr: 'smile', exprP: GP, mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...H2(lifeGirlA, f, 61, { look: 0.4, lookY: 0.1 }) };
    const gBOpts = { expr: 'smile', exprP: GP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...H2(lifeGirlB, f, 71, { look: -0.35, lookY: 0.1 }) };
    if (id === 'teach') { gAOpts.carry = 0.5; gBOpts.prop = ['point', 0.4]; }
    if (id === 'hookboard') { gAOpts.lookY = q(-0.28, 2); gBOpts.lookY = q(-0.28, 2); gAOpts.look = q(-0.2, 2); gBOpts.look = q(-0.25, 2); }
    std('girlA', OUTFITS.girlA, gAOpts, id === 'teach' ? -0.95 : 0.45, id === 'teach' ? 2.95 : 5.2, { yaw: 0, s: 0.8 });
    std('girlB', OUTFITS.girlB, gBOpts, id === 'teach' ? 1.25 : 1.1, id === 'teach' ? 3.15 : 4.95, { yaw: 0, s: 0.8 });
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-3.4, -2.15, -3.35, -3.05, { h: 2.6, id: 'wallBackL' }),
  SOL.aabb(-1.05, 3.4, -3.35, -3.05, { h: 2.6, id: 'wallBackR' }),
  SOL.aabb(-3.55, -3.25, -3.2, 1.2, { h: 2.6, id: 'wallW' }),
  SOL.aabb(3.25, 3.55, -3.2, -0.05, { h: 2.6, id: 'wallE1' }),
  SOL.aabb(3.25, 3.55, 1.0, 1.2, { h: 2.6, id: 'wallE2' }),
  SOL.aabb(-3.2, -2.0, -2.8, -0.6, { h: 0.5, id: 'cot' }),
  SOL.aabb(3.8, 4.9, 4.6, 5.8, { h: 1.1, id: 'stall' }),
  SOL.circle(-4.5, 3.5, 0.5, { h: 4, id: 'neem' }),
  SOL.circle(-0.75, 1.47, 0.07, { h: 2, id: 'postL' }),
  SOL.circle(0.95, 1.47, 0.07, { h: 2, id: 'postR' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: '' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
