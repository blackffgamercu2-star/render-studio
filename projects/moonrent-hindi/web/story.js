// Shot plan for "चाँद किराए पर देने वाला आदमी" — moonrent-hindi.
// UPGRADE ROUND 2 (Abid rejected the v2 proof too: "abhi aur upgrade
// chahiye") — four surgical fixes on the v2 staging: (1) the market
// beat is now an EXTREME CLOSE-UP on the coin exchange itself, hands
// meeting at centre frame, heads out; (2) the panchang insert is a
// pure object insert — tighter, lower, raking lantern light, NO hero
// sliver at the edge; (3) the opening hero and the fear reaction are
// pushed to full V3 scale (face >=65% of frame width on the reaction);
// (4) the film ends on a CHARACTER BEAT — the hero kneels in the
// foreground pointing up at the hook board behind him.
// UPGRADE REBUILD v2 (Abid's verdict on v1: camera/action below the
// Salted Mine V3 benchmark). Same voice, timing, words, mix, lights and
// set — staging and cameras rebuilt to TRUE V3 grammar, beat by beat:
//   opening ON the hero mid-action at a LOW angle, big in frame, the
//   huge moon behind him (V3 f0: miner on the tracks, wink, rifle up);
//   a crowd-level announcement with foreground heads cropped at the
//   frame edges (V3's layered tunnel frames); subject-level TRACKING
//   on the coin exchange (V3's workbench action); a tilt down from the
//   moon itself; a PULL-BACK for the empty-stall beat; reaction
//   CLOSE-UPS pushed to >50% face width (V3 buyer-laugh grammar); the
//   panchang INSERT with the hero's own hand landing on the eclipse
//   date (V3's shell-loading insert); panic shot THROUGH the doorway
//   as the crowd charges the camera; the performed line pushed in
//   from inside the hut so the lit square stays behind the speaker.
// ONE set: a village square at night — the hero's hut (door + interior
// with the panchang book on a table), his ticket stall, lantern posts,
// a big neem tree, neighbour huts, and a huge moon over the rooftops.
// Voice stem: Google AI Studio Puck (series voice), 58.171 s, 30 fps,
// TOTAL 1745; line timings from timing.json (faster-whisper small,
// char-mapped onto the script — see ../span_fix.py). Scene changes ONLY
// at line boundaries (one sub-split inside L14 at the moon's return):
//   L1 hook rent      L7 the panchang      L13 "wait a little"
//   L2 announcement   L8 the book insert   L14 the moon returns
//   L3 tickets sell   L9 sells full only   L15 the old man spots it
//   L4 always full    L10 the eclipse      L16 the laugh (tag)
//   L5 half / dim     L11 panic            L17 THE LINE (performed)
//   L6 fear grows     L12 begging          L18 hook board (sweets)
// GRADE: Night Lamp / Sea Glass night — moonlight + warm lantern
// practicals; the eclipse is an exposure event (smooth dim, smooth
// recovery, no one-frame pops). Boards/text never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1745, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 130, light: 'night' },
  { id: 'announce', a: 131, b: 261, light: 'night' },
  { id: 'market', a: 262, b: 368, light: 'night' },
  { id: 'fullmoon', a: 369, b: 472, light: 'night' },
  { id: 'halfmoon', a: 473, b: 561, light: 'night' },
  { id: 'fear', a: 562, b: 648, light: 'night' },
  { id: 'hutbook', a: 649, b: 756, light: 'hut' },
  { id: 'book', a: 757, b: 853, light: 'hut' },
  { id: 'sell', a: 854, b: 948, light: 'night' },
  { id: 'eclipse', a: 949, b: 1037, light: 'night' },
  { id: 'panic', a: 1038, b: 1131, light: 'night' },
  { id: 'beg', a: 1132, b: 1227, light: 'night' },
  { id: 'calm', a: 1228, b: 1311, light: 'night' },
  { id: 'booktime', a: 1312, b: 1362, light: 'hut' },
  { id: 'moonback', a: 1363, b: 1412, light: 'night' },
  { id: 'spot', a: 1413, b: 1471, light: 'hut' },
  { id: 'laugh', a: 1472, b: 1518, light: 'night' },
  { id: 'dialogue', a: 1519, b: 1631, light: 'night' },
  { id: 'hookboard', a: 1632, b: 1744, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const lerp3 = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)];

// ---------- lights / mood grades ----------
export const LIGHTS = {
  night: { az: 208, el: 36, sky: '#33477a', ground: '#131a28', hemi: 0.62, sun: '#b9cdf5', sunI: 0.95, fog: '#141e33', fogNear: 14, fogFar: 110,
    skyTop: '#0a1226', skyHor: '#2c4066', sunDisc: '#000000', sunSize: 0, sat: 1.07, vig: 0.3, shadowExt: 20, aurora: 0, gain: '#ccdaf5',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  hut: { az: 205, el: 32, sky: '#6a4a2c', ground: '#20140a', hemi: 0.62, sun: '#ffb45e', sunI: 0.85, fog: '#1e1206', fogNear: 5, fogFar: 42,
    skyTop: '#140b04', skyHor: '#402a12', sunDisc: '#000000', sunSize: 0, sat: 1.09, vig: 0.34, shadowExt: 12, aurora: 0, gain: '#eed9b4',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
const blendLight = (A, B, u) => {
  const o = {};
  for (const k in A) {
    if (typeof A[k] === 'number') o[k] = lerp(A[k], B[k], u);
    else if (typeof A[k] === 'string' && A[k][0] === '#') {
      const pa = [1, 3, 5].map((i) => parseInt(A[k].slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(B[k].slice(i, i + 2), 16));
      o[k] = '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
    } else o[k] = A[k];
  }
  return o;
};
// the eclipse: the moon's shadow crosses f955-1005, holds total through
// the panic / begging / calm beats, and slides off f1363-1408 as the book
// said it would. Smooth both ways — an exposure event, never a pop.
export const eclipseAt = (f) => {
  if (f < 955) return 0;
  if (f < 1005) return smooth(ramp(f, 955, 1005));
  if (f < 1363) return 1;
  if (f < 1408) return 1 - smooth(ramp(f, 1363, 1408));
  return 0;
};
const ECLIPSE_DIM = { ...LIGHTS.night, hemi: 0.34, sunI: 0.22, gain: '#7787a8', fog: '#0a101f', skyTop: '#04070f', skyHor: '#131f38' };
export const lightFor = (S, f) => {
  if (S.light === 'hut') return { ...LIGHTS.hut };
  const e = eclipseAt(f);
  return e > 0 ? blendLight(LIGHTS.night, ECLIPSE_DIM, e) : { ...LIGHTS.night };
};

// ---------- staging ----------
// The hook board stands in the square, left of the hut door; transform
// mirrored in boards.json — keep in sync.
export const BOARD_POS = [0, 2.0, -8.2];
export const SIGN_POS = BOARD_POS;
export const BOOK_POS = [0.55, 0.86, -12.9];
const STALL = { x: 3.1, z: -3.9 };
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// cast anchors per shot (single source of truth) — v2 staging: the hero
// OPENS standing on the grain crate under the moon; the crowd crowds
// the camera for the announcement; beggars kneel in a wide arc.
export const heroAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: 1.1, z: -3.5, y: 0.5 };
    case 'announce': return { x: 1.1, z: -3.5, y: 0.5 };
    case 'market': return { x: 3.44, z: -2.48 };
    case 'sell': return { x: STALL.x - 0.25, z: -4.85 };
    case 'fullmoon': return { x: 1.9, z: -2.7 };
    case 'halfmoon': return { x: STALL.x, z: -4.85 };
    case 'hutbook': return { x: 0.35, z: -14.35 };
    case 'book': return { x: -1.3, z: -13.55 };
    case 'booktime': return { x: 0.35, z: -14.35 };
    case 'eclipse': return { x: 1.6, z: -2.6 };
    case 'panic': return { x: 0.62, z: -10.5 };
    case 'beg': case 'calm': return { x: 0, z: -10.25 };
    case 'spot': return { x: -1.25, z: -13.3 };
    case 'laugh': case 'dialogue': return { x: 0, z: -10.2 };
    case 'moonback': return { x: 1.35, z: -4.5 };
    case 'hookboard': return { x: -0.42, z: -3.7 };
    default: return { x: 0, z: -3 };
  }
};
export const oldAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'announce': return { x: 0.10, z: -2.89 };
    case 'fear': return { x: -0.55, z: -5.35 };
    case 'eclipse': return { x: 0.45, z: -4.7 };
    case 'panic': { const u = smooth(ramp(f, 1038, 1120)); return { x: lerp(0.45, -1.15, u), z: lerp(-4.7, -8.95, u) }; }
    case 'beg': return { x: -1.15, z: -8.6 };
    case 'calm': return { x: -1.3, z: -9.1 };
    case 'moonback': return { x: -0.2, z: -4.6 };
    case 'spot': return { x: 2.35, z: -9.3 };
    case 'laugh': return { x: 1.05, z: -9.8 };
    case 'dialogue': return { x: 1.6, z: -9.6 };
    default: return { x: 12, z: 6 };
  }
};
export const fishAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'announce': return { x: 1.02, z: -2.52 };
    case 'market': return { x: 2.72, z: -2.46 };
    case 'sell': return { x: 3.45, z: -2.35 };
    case 'fear': return { x: 0.75, z: -5.9 };
    case 'eclipse': return { x: 2.35, z: -4.95 };
    case 'panic': { const u = smooth(ramp(f, 1044, 1126)); return { x: lerp(2.35, 1.25, u), z: lerp(-4.95, -9.0, u) }; }
    case 'beg': return { x: 0.7, z: -8.6 };
    case 'calm': return { x: 1.45, z: -9.2 };
    case 'moonback': return { x: 2.0, z: -4.9 };
    case 'dialogue': return { x: -1.7, z: -9.3 };
    case 'hookboard': return { x: 3.6, z: -10.2 };
    default: return { x: 13, z: 7 };
  }
};
export const vilAAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'market': return { x: 4.4, z: -2.35 };
    case 'fear': return { x: -2.9, z: -7.0 };
    case 'eclipse': return { x: -0.1, z: -4.1 };
    case 'panic': { const u = smooth(ramp(f, 1050, 1130)); return { x: lerp(-0.1, -2.3, u), z: lerp(-4.1, -8.6, u) }; }
    case 'beg': return { x: -3.1, z: -7.85 };
    case 'dialogue': return { x: -2.6, z: -8.9 };
    default: return { x: 14, z: 8 };
  }
};
export const vilBAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'fear': return { x: 1.7, z: -6.35 };
    case 'eclipse': return { x: 4.4, z: -3.1 };
    case 'panic': { const u = smooth(ramp(f, 1056, 1131)); return u < 0.5
      ? { x: lerp(4.4, 4.7, u * 2), z: lerp(-3.1, -5.8, u * 2) }
      : { x: lerp(4.7, 2.5, u * 2 - 1), z: lerp(-5.8, -8.55, u * 2 - 1) }; }
    case 'beg': return { x: 2.9, z: -7.9 };
    case 'dialogue': return { x: 2.7, z: -8.7 };
    case 'hookboard': return { x: -3.3, z: -9.6 };
    default: return { x: 15, z: 9 };
  }
};

// ---------- focus (DOF target per shot; two shots RACK focus) ----------
const MOON_PT = [10.5, 23.5, -58];
const FOCUS = {
  hook: () => [1.1, 2.28, -3.5],
  announce: () => [1.1, 2.0, -3.5],
  market: () => [3.08, 1.12, -2.49],
  // fullmoon racks from the moon itself down to the hero's face
  fullmoon: (f) => lerp3(MOON_PT, [1.9, 1.7, -2.7], smooth(ramp(f, 398, 450))),
  halfmoon: () => [3.1, 1.5, -4.85],
  fear: () => [-0.55, 1.64, -5.35],
  hutbook: () => [...BOOK_POS],
  book: () => [...BOOK_POS],
  sell: () => [3.4, 1.2, -2.5],
  eclipse: () => [1.5, 2.2, -4.2],
  panic: () => [0.1, 1.3, -7.0],
  beg: () => [0.1, 1.2, -9.8],
  calm: () => [0, 1.56, -10.25],
  booktime: () => [...BOOK_POS],
  moonback: () => [1.5, 2.0, -4.6],
  // spot racks from the old man's face to the book his eye finds
  spot: (f) => lerp3([2.35, 1.7, -9.3], BOOK_POS, smooth(ramp(f, 1432, 1462))),
  laugh: () => [0.4, 1.7, -10.1],
  dialogue: () => [0, 1.56, -10.2],
  hookboard: () => [0, 1.95, -8.2],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: EVERY shot is a camrig track with REAL travel ----------
// Distances are V3 distances: mediums 3-4.5 m, close-ups push to where
// the face passes 50% of frame width, inserts fill the frame.
const heroPos = (f) => { const h = heroAt(f); return [h.x, h.y || 0, h.z]; };
const RIG_BY_ID = {
  // hook: LOW angle from the ground, hero BIG on his crate mid-action,
  // arm up at the huge full moon haloed behind his head; the push-in
  // runs from frame 0 (V3 opens already moving, on the miner).
  // R2: pushed to full V3 scale — head+torso dominant from frame 0
  // (face ~40% of frame width, growing to ~48%), feet out of frame.
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [0.5, 0.8, -0.55], look: [1.1, 2.18, -3.5], fov: 39 },
    { f: 130, pos: [0.28, 0.92, -0.95], look: [1.1, 2.24, -3.5], fov: 36, ease: 'surge' }] }) },
  // announce: crowd-level — two villagers' heads cropped huge at the
  // frame edges, the hero elevated on the crate beyond them, pushing in.
  announce: { cut: 'hard', raw: keysCam({ keys: [
    { f: 131, pos: [-0.85, 1.3, -0.75], look: [1.12, 2.02, -3.5], fov: 42 },
    { f: 261, pos: [-0.35, 1.38, -1.5], look: [1.1, 2.05, -3.5], fov: 39, ease: 'surge' }] }) },
  // market: R3 TARGETED FIX — the R2 extreme close-up FAILED (parent
  // eye-check): at ~1 m / fov 30 the frame sliced a 0.3 m window
  // through the two cards, both bodies fell out of frame, and the
  // meeting hands + coin smeared (CINF 1.1 bokeh) into a concentric
  // navy/gold target floating over the stall table — the exchange did
  // not read at all. NOW: a front three-quarter MEDIUM-CLOSE from the
  // north-west at ~2.5 m pushing to ~2.1 m — both men front-on, faces
  // and torsos in frame, their hands meeting at centre over the stall
  // table (stack + coin bowl behind), the coin passing fish -> hero
  // at f300 in plain view. Same span, same push-in feel.
  market: { cut: 'hard', raw: keysCam({ keys: [
    { f: 262, pos: [2.68, 1.6, -0.05], look: [3.08, 1.1, -2.49], fov: 37 },
    { f: 368, pos: [2.8, 1.55, -0.28], look: [3.09, 1.06, -2.49], fov: 35, ease: 'surge' }] }) },
  // fullmoon: starts ON the moon itself, tilts down onto the smug hero —
  // his nights really do always come out full.
  fullmoon: { cut: 'hard', raw: keysCam({ keys: [
    { f: 369, pos: [0.6, 1.3, 1.0], look: [1.94, 4.4, -7.1], fov: 36 },
    { f: 472, pos: [1.02, 1.52, -0.15], look: [1.9, 1.7, -2.7], fov: 37, ease: 'smooth' }] }) },
  // halfmoon: the PULL-BACK — he shrinks alone at his empty stall
  // under the half moon as the camera retreats from him.
  halfmoon: { cut: 'hard', raw: keysCam({ keys: [
    { f: 473, pos: [2.5, 1.55, -0.75], look: [3.08, 1.8, -4.85], fov: 41 },
    { f: 561, pos: [2.28, 1.7, 0.35], look: [3.05, 1.9, -4.85], fov: 43, ease: 'surge' }] }) },
  // fear: REACTION push-in on the old man's face — dread grows as the
  // face grows past half the frame width (V3 buyer-close-up grammar).
  // R2: full V3 scale — the face passes 65% of frame width mid-shot and
  // ends near 80%; the rest of the crowd falls out of the tight frame.
  fear: { cut: 'hard', raw: pushInCam({ subject: () => [-0.55, 0, -5.35], a: 562, b: 648, d0: 2.9, d1: 2.1, h0: 1.68, h1: 1.6, lookOff: [0, 1.64, 0], fov0: 36, fov1: 30.5,
    dir: () => [0.42, 0.91] }) },
  // hutbook: INSIDE the hut this time — a tracking push across the
  // dark room toward the lantern-lit table where he kneels.
  hutbook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 649, pos: [1.6, 1.4, -11.55], look: [0.45, 0.9, -13.2], fov: 40 },
    { f: 756, pos: [1.25, 1.32, -11.85], look: [0.47, 0.9, -13.15], fov: 37, ease: 'surge' }] }) },
  // book INSERT: R2 — a PURE object insert, like V3's dynamite frame:
  // no character in frame at all. The panchang fills ~90% of the frame
  // from a low raking angle, the hut lantern raking across the page;
  // the hero kneels out of frame to the west (his glint still lands on
  // the eclipse date as the last page settles, f842-858).
  book: { cut: 'hard', raw: keysCam({ keys: [
    { f: 757, pos: [0.93, 1.64, -10.18], look: [0.52, 0.83, -12.93], fov: 34 },
    { f: 853, pos: [0.9, 1.58, -10.32], look: [0.52, 0.83, -12.93], fov: 32, ease: 'surge' }] }) },
  // sell: the mirror of market from the EAST end — fisherman huge in
  // the foreground edge, the hero dealing tickets beyond him.
  sell: { cut: 'hard', raw: keysCam({ keys: [
    { f: 854, pos: [3.15, 1.58, -6.6], look: [3.2, 1.08, -2.3], fov: 39 },
    { f: 948, pos: [2.95, 1.5, -6.25], look: [3.15, 1.05, -2.35], fov: 36, ease: 'surge' }] }) },
  // eclipse: LOW behind the crowd — heads and shoulders across the
  // bottom of the frame, the moon huge above them, bite growing.
  eclipse: { cut: 'hard', raw: keysCam({ keys: [
    { f: 949, pos: [0.3, 1.05, 1.6], look: [2.3, 4.6, -11.0], fov: 37 },
    { f: 1037, pos: [0.1, 1.18, 0.9], look: [2.25, 4.55, -11.0], fov: 35, ease: 'surge' }] }) },
  // panic: from INSIDE the dark hut, framed by the doorway — the
  // crowd marches straight at the camera, growing every frame.
  panic: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1038, pos: [0.25, 1.52, -14.6], look: [0.1, 1.3, -5.5], fov: 52 },
    { f: 1131, pos: [0.22, 1.47, -14.0], look: [0.12, 1.32, -5.9], fov: 49, ease: 'surge' }] }) },
  // beg: three-quarter from the south-west — kneeling faces upturned
  // in the foreground, the hero standing in his doorway beyond them.
  beg: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1132, pos: [-1.8, 1.8, -5.55], look: [0.1, 1.0, -9.7], fov: 42 },
    { f: 1227, pos: [-1.7, 1.74, -6.0], look: [0.28, 1.02, -9.65], fov: 39, ease: 'surge' }] }) },
  // calm: "wait a little" — a close push on the hero from the
  // crowd's side, his face passing half the frame width.
  calm: { cut: 'hard', raw: pushInCam({ subject: heroPos, a: 1228, b: 1311, d0: 3.7, d1: 2.9, h0: 1.62, h1: 1.56, lookOff: [0, 1.56, 0], fov0: 36, fov1: 33,
    dir: () => [-0.52, 0.86] }) },
  // booktime: the insert's tighter twin — lower, closer, the hero's
  // head bowed over the far side of the page as the hour is checked.
  booktime: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1312, pos: [0.28, 1.78, -11.05], look: [0.53, 0.8, -12.94], fov: 31 },
    { f: 1362, pos: [0.38, 1.7, -11.35], look: [0.54, 0.8, -12.94], fov: 29, ease: 'surge' }] }) },
  // moonback: hero + relieved faces in one rising frame with the
  // returning moon — both on the same axis at last.
  moonback: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1363, pos: [-0.75, 1.42, 1.5], look: [1.15, 2.55, -5.3], fov: 43 },
    { f: 1412, pos: [-0.5, 1.52, 0.9], look: [1.2, 2.6, -5.35], fov: 40, ease: 'surge' }] }) },
  // spot: OPENS on the old man's face (thinking), then his gaze PANS
  // across the square and through the doorway onto the book — the
  // camera follows his eye, and focus racks with it.
  spot: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1413, pos: [1.85, 1.52, -7.0], look: [2.35, 1.7, -9.3], fov: 38 },
    { f: 1442, pos: [1.68, 1.47, -7.35], look: [1.6, 1.35, -10.6], fov: 36, ease: 'smooth' },
    { f: 1471, pos: [1.5, 1.42, -7.65], look: [0.52, 0.88, -12.9], fov: 34, ease: 'surge' }] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1472, pos: [0.4, 1.55, -5.6], look: [0.45, 1.5, -10.1], fov: 37 },
    { f: 1518, pos: [0.15, 1.5, -6.1], look: [0.4, 1.52, -10.15], fov: 34, ease: 'surge' }] }) },
  // dialogue: the performed line — the camera sits INSIDE the hut
  // and pushes out toward the speaker in his doorway, the lantern-
  // lit square alive behind him; face 32% -> 56% of frame width.
  dialogue: { cut: 'hard', raw: pushInCam({ subject: heroPos, a: 1519, b: 1631, d0: 4.6, d1: 3.0, h0: 1.62, h1: 1.57, lookOff: [0, 1.56, 0], fov0: 37, fov1: 33,
    dir: () => [0.12, -0.99] }) },
  // hookboard: camera UNCHANGED from v1 — this framing was already
  // correct (whole panel inside the frame with margins, held to the
  // last frame). R2 changes the STAGING in front of it: the hero now
  // kneels in the foreground (see heroAt/castAt 'hookboard'), and the
  // fisherman steps fully out of frame east.
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1632, pos: [0.4, 2.0, 2.6], look: [0, 1.9, -8.4], fov: 47 },
    { f: 1744, pos: [0.3, 1.95, 1.3], look: [0, 1.95, -8.35], fov: 45, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { hook: 1.8, announce: 2.4, market: 1.1, fullmoon: 1.1, halfmoon: 2.4, fear: 2.8, hutbook: 3.2, book: 3.6, sell: 2.6, eclipse: 1.2, panic: 2.4, beg: 2.6, calm: 3.2, booktime: 3.6, moonback: 1.4, spot: 3.2, laugh: 2.8, dialogue: 3.4, hookboard: 1.3 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), e = eclipseAt(f);
  const half = S.id === 'halfmoon' ? 0.5 * smooth(ramp(f, 473, 490)) * (1 - smooth(ramp(f, 545, 561))) : 0;
  // page flips: one as he opens the book in the hut, two in the insert,
  // one as he checks the eclipse hour
  const flip = (a, b) => (f >= a && f <= b ? (f - a) / (b - a) : 0);
  const bookK = Math.max(flip(740, 754), flip(788, 802), flip(824, 838), flip(1322, 1338));
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1640, 1666)) : 0,
    lampK: 1,
    hutK: ['hutbook', 'book', 'booktime', 'spot'].includes(S.id) ? 1 : 0.12,
    moonK: (1 - 0.82 * e) * (S.id === 'halfmoon' ? 0.78 : 1),
    coverK: Math.max(e, half),
    starK: 0.35 + 0.6 * e,
    bookK,
    blastX: BOOK_POS[0], blastY: 1.2, blastZ: BOOK_POS[2],
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  // the truth glints on the book the moment the old man's eye finds it
  const spark = S.id === 'spot' ? 0.55 * Math.pow(Math.abs(Math.sin(f * 0.4)), 4) : 0;
  // ...and a small glint the moment the hero's finger lands on the date
  const land = S.id === 'book' && f >= 842 && f <= 858 ? 0.5 * Math.pow(Math.abs(Math.sin(f * 0.5)), 4) : 0;
  return { moteRate: S.light === 'hut' ? 0.05 : 0.1, blastRate: 0, sparkRate: spark + land, steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours flat
// and saturated even in moonlight (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  hero: { jacket: '#d99a26', pants: '#efe6d0', boots: '#3a2410', hat: 'cap', cap: '#8e2323', skin: '#fbf7ef', moustache: '#2a201a' },
  old: { jacket: '#cfc8b8', pants: '#5a5348', boots: '#241a12', hat: 'hair', hair: '#e9e7e1', skin: '#fbf7ef', moustache: '#e9e7e1', bigMoustache: true },
  fish: { jacket: '#1f7a6a', pants: '#33424a', boots: '#1c1712', hat: 'cap', cap: '#274b63', skin: '#fbf7ef' },
  vilA: { jacket: '#7a4a2a', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#1c1712', skin: '#fbf7ef' },
  vilB: { jacket: '#a03a5e', pants: '#4a2436', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
};
// the old man's round glasses, drawn over the face card (card space
// 600x1000; head centre from T.headCenter(seed), eyes ~ +/-46 around 300)
const drawGlasses = (p) => {
  const hc = T.headCenter(71);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};

// ---------- HEAD PERFORMANCE ----------
// Expressions MORPH on the narration's emphasis beats; heads nod, tilt,
// snap and turn toward whoever/whatever the voice names, plus a continuous
// idle sway so no head is ever frozen. Pure track folder (deterministic).
const emoTrack = (initial, events) => ({
  at(f) {
    let from = T.faceP(initial), to = from, t0 = 0, dur = 0;
    const seg = (g) => {
      if (dur <= 0 || g >= t0 + dur) return { ...to };
      if (g <= t0) return { ...from };
      const u = (g - t0) / dur, s = u * u * u * (u * (u * 6 - 15) + 10), o = {};
      for (const k in to) o[k] = from[k] + (to[k] - from[k]) * s;
      return o;
    };
    for (const [ef, name, ed] of events) {
      if (ef > f) break;
      from = seg(ef); to = T.faceP(name); t0 = ef; dur = Math.max(1, ed);
    }
    return seg(f);
  },
});
const emoHero = emoTrack('smile', [
  [30, 'smug', 8], [131, 'grin', 8], [262, 'grin', 8], [369, 'smug', 9], [473, 'sad', 10],
  [562, 'smile', 8], [649, 'thinking', 9], [854, 'grin', 8], [949, 'nervous', 8], [1132, 'nervous', 8],
  [1228, 'smile', 9], [1363, 'grin', 8], [1472, 'laugh', 7], [1519, 'smile', 8], [1600, 'smug', 9],
]);
const emoOld = emoTrack('neutral', [
  [131, 'smile', 8], [562, 'nervous', 8], [949, 'nervous', 8], [1228, 'relief', 9], [1363, 'relief', 8],
  [1413, 'thinking', 10], [1442, 'wonder', 8], [1472, 'smile', 8],
]);
const emoFish = emoTrack('grin', [
  [562, 'nervous', 8], [949, 'nervous', 8], [1228, 'relief', 9], [1363, 'laugh', 8],
]);
const emoVilA = emoTrack('smile', [
  [562, 'nervous', 8], [949, 'nervous', 8], [1363, 'relief', 8],
]);
const emoVilB = emoTrack('grin', [
  [562, 'nervous', 8], [949, 'nervous', 8], [1363, 'relief', 8],
]);
// ---------- BODY ACTIONS (library body.js) ----------
// the hero KNEELS at the panchang (in the hut, in the insert, and when
// he checks the eclipse hour); the whole crowd KNEELS begging at his
// door; the hero TURNS from the old man back to the crowd on the laugh
// beat and WINKS on his smug plan beats.
const heroPose = poseWindows([
  { a: 649, b: 756, mode: 'kneel', inF: 6, outF: 5 },
  { a: 757, b: 853, mode: 'kneel', inF: 5, outF: 5 },
  { a: 1312, b: 1362, mode: 'kneel', inF: 6, outF: 5 },
]);
const crowdPose = poseWindows([{ a: 1132, b: 1227, mode: 'kneel', inF: 8, outF: 6 }]);
const heroTurn = turnTrack([{ f0: 1486, dur: 12, dir: -1 }]);
const heroWink = winkTrack([{ a: 116, b: 126 }, { a: 928, b: 938 }]);
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});
const noBlush = (P) => { P.blush = 0; P.openL = Math.min(1, (P.openL ?? 0.85) * 1.45); P.openR = Math.min(1, (P.openR ?? 0.85) * 1.45); return P; };

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: extra.ground || 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const h = heroAt(f), o = oldAt(f), fi = fishAt(f), va = vilAAt(f), vb = vilBAt(f);
  let HP = noBlush(emoHero.at(f));
  const OP = noBlush(emoOld.at(f)), FP = noBlush(emoFish.at(f)), AP = noBlush(emoVilA.at(f)), BP = noBlush(emoVilB.at(f));
  const winkK = heroWink(f);
  if (winkK > 0) HP = T.blendFaceP(HP, T.faceP('wink', 31), winkK);
  const marching = (a, b) => f >= a && f <= b;
  switch (S.id) {
    case 'hook': {
      // SOLO, mid-action: standing ON the crate, one arm UP at the moon
      // he "owns", head tipped back to it; the wink lands at f116-126.
      // R2: the arm RISES through the first two seconds (k 0.16 -> 0.04)
      // so the gesture reads at first glance in the tighter framing.
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', q(lerp(0.16, 0.04, smooth(ramp(f, 0, 60))), 2)],
        ...head(f, 31, kf([[0, -3], [60, -4.5], [130, -4]], f), 0.25, -0.55, 0.25) }, h.x, h.z, { yaw: 0.25, y: 0.5, ground: 0.5 });
      break;
    }
    case 'announce': {
      // the hero addresses the crowd from the crate; old + fish are the
      // FOREGROUND — cropped heads at the frame edges, looking up at him
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.3],
        ...head(f, 31, kf([[131, -2], [190, -3.5], [261, -3]], f), 0, -0.15 + nodAt(f, 205, 9, -0.8), 0) }, h.x, h.z, { yaw: 0.1, y: 0.5, ground: 0.5 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2.5, -0.5, -0.35, -0.5) }, o.x, o.z, { yaw: -0.45, overlay: drawGlasses });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2.5, 0.55, -0.35, 0.55) }, fi.x, fi.z, { yaw: 0.5 });
      break;
    }
    case 'market': {
      // R3: both men stand at the stall's front corner, hands meeting
      // at centre frame (camera is the R3 medium-close above — faces,
      // torsos, arms and the two hands all in the shot). The hero's
      // card is FLIPPED so his prop hand reaches centre too (the
      // un-flipped prop arm would point away from the fisherman). The
      // coin passes fish -> hero at f300; before it, the hero's bare
      // hand waits open; after it, the fisherman's hand stays raised,
      // empty.
      const kk = q(lerp(0.86, 0.92, smooth(ramp(f, 262, 368))), 2);
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: f >= 300 ? ['coin', kk] : ['point', kk],
        ...head(f, 31, -1.5, 0.45, 0.5, 0.45) }, h.x, h.z, { yaw: 0.3, flip: true });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: f < 300 ? ['coin', kk] : ['point', kk],
        ...head(f, 41, -1, 0.45, 0.5, 0.45) }, fi.x, fi.z, { yaw: 0.3 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['coin', 0.5],
        ...head(f, 61, 0, 0.3, 0.1, 0.3) }, va.x, va.z, { yaw: 0.3 });
      break;
    }
    case 'fullmoon': {
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[369, -4], [420, -3], [472, -3.5]], f), 0.15, kf([[369, -0.55], [420, -0.2], [472, -0.25]], f), 0.2) }, h.x, h.z, { yaw: 0.2 });
      break;
    }
    case 'halfmoon': {
      // the empty stall: no buyers, no coins — he waits alone, head down
      std('hero', OUTFITS.hero, { expr: 'pained', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[473, 2], [520, 4.5], [561, 4]], f), 0.1, 0.5, 0.1) }, h.x, h.z, { yaw: -0.3 });
      break;
    }
    case 'fear': {
      // pure REACTION group: four frightened faces tipped up at the
      // moon, the old man's glasses catching the light in front
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, kf([[562, -3], [605, -4], [648, -3.5]], f), 0.3, -0.5, 0.3) }, o.x, o.z, { yaw: 0.3, overlay: drawGlasses });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -3, -0.35, -0.5, -0.35) }, fi.x, fi.z, { yaw: -0.3 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -2.5, 0.4, -0.45, 0.4) }, va.x, va.z, { yaw: 0.35 });
      std('vilB', OUTFITS.vilB, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -2.5, -0.4, -0.45, -0.4) }, vb.x, vb.z, { yaw: -0.35 });
      break;
    }
    case 'hutbook': {
      // he KNEELS at the far side of the table (body.js pose) and
      // opens the old panchang — a page turns near the end (f740-754)
      const P = heroPose(f);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 31), seed: 31, prop: ['point', q(lerp(0.3, 0.92, smooth(ramp(f, 736, 752))), 2)],
        ...head(f, 31, -5, 0.3, 0.6 + nodAt(f, 700, 9, 0.5), 0.3) }, h.x, h.z, { yaw: 0.3 });
      break;
    }
    case 'book': {
      // R2: the INSERT is a pure object shot now — he kneels WEST of
      // the table, fully out of the tightened frame; the page glint at
      // f842-858 (fxProfileAt) marks the eclipse date on its own.
      const P = heroPose(f);
      const pk = f < 838 ? 0.3 : lerp(0.3, 0.95, smooth(ramp(f, 838, 852)));
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 31), seed: 31, prop: ['point', q(pk, 2)],
        ...head(f, 31, -5, 0.3, 0.6 + nodAt(f, 845, 9, 0.4), 0.3) }, h.x, h.z, { yaw: 0.35 });
      break;
    }
    case 'booktime': {
      // he kneels at the far side again, head bowed to the page,
      // checking the hour the eclipse ends
      const P = heroPose(f);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -5, 0.25, 0.62 + nodAt(f, 1340, 9, 0.45), 0.25) }, h.x, h.z, { yaw: 0.25 });
      break;
    }
    case 'sell': {
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.45],
        ...head(f, 31, -2, 0.4, 0.35 + nodAt(f, 905), 0.4) }, h.x, h.z, { yaw: 0.4 });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['coin', 0.55],
        ...head(f, 41, -1, -0.5, 0.25, -0.5) }, fi.x, fi.z, { yaw: -0.45 });
      break;
    }
    case 'eclipse': {
      // every head in the square tips UP at the darkening moon
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.12],
        ...head(f, 31, -5, 0.2, -0.6, 0.2) }, h.x, h.z, { yaw: 0.2 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -4.5, 0.3, -0.6, 0.3) }, o.x, o.z, { yaw: 0.3, overlay: drawGlasses });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -4.5, -0.3, -0.6, -0.3) }, fi.x, fi.z, { yaw: -0.3 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -4, 0.35, -0.55, 0.35) }, va.x, va.z, { yaw: 0.35 });
      std('vilB', OUTFITS.vilB, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -4, -0.35, -0.55, -0.35) }, vb.x, vb.z, { yaw: -0.35 });
      break;
    }
    case 'panic': {
      const run = (seed, ph) => ({ mode: marching(1038, 1126) ? 'march' : 'stand', phase: q((f * 0.016 + ph) % 1, 2), blink: blinkAt(f, seed), seed });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, ...run(71, 0), ...head(f, 71, 1.5, 0.2, 0.1, 0.2) }, o.x, o.z, { yaw: 0.15, overlay: drawGlasses });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, ...run(41, 0.35), ...head(f, 41, 1.5, -0.2, 0.1, -0.2) }, fi.x, fi.z, { yaw: -0.15 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, ...run(61, 0.6), ...head(f, 61, 1.5, 0.25, 0.1, 0.25) }, va.x, va.z, { yaw: 0.2 });
      std('vilB', OUTFITS.vilB, { expr: 'grin', exprP: BP, ...run(81, 0.15), ...head(f, 81, 1.5, -0.25, 0.1, -0.25) }, vb.x, vb.z, { yaw: -0.2 });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0.5, 0, 0.15, 0) }, h.x, h.z, { yaw: 0 });
      break;
    }
    case 'beg': {
      // the whole crowd on its knees at his door, hands up begging
      const P = crowdPose(f);
      const kneel = (o2, opts, x, z, extra = {}) => std(opts.id, o2, { ...opts.o, mode: P.mode, squash: P.squash }, x, z, extra);
      kneel(OUTFITS.old, { id: 'old', o: { expr: 'neutral', exprP: OP, blink: blinkAt(f, 71), seed: 71, ...head(f, 71, -2, 0.25, -0.1, 0.25) } }, o.x, o.z, { yaw: 0.25, overlay: drawGlasses });
      kneel(OUTFITS.fish, { id: 'fish', o: { expr: 'grin', exprP: FP, blink: blinkAt(f, 41), seed: 41, ...head(f, 41, -2, -0.25, -0.1, -0.25) } }, fi.x, fi.z, { yaw: -0.25 });
      kneel(OUTFITS.vilA, { id: 'vilA', o: { expr: 'smile', exprP: AP, blink: blinkAt(f, 61), seed: 61, ...head(f, 61, -2, 0.3, -0.1, 0.3) } }, va.x, va.z, { yaw: 0.3 });
      kneel(OUTFITS.vilB, { id: 'vilB', o: { expr: 'grin', exprP: BP, blink: blinkAt(f, 81), seed: 81, ...head(f, 81, -2, -0.3, -0.1, -0.3) } }, vb.x, vb.z, { yaw: -0.3 });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, 0, 0.3, 0) }, h.x, h.z, { yaw: 0 });
      break;
    }
    case 'calm': {
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.4],
        ...head(f, 31, kf([[1228, -2], [1265, -3.5], [1311, -3]], f), 0.1, 0.1 + nodAt(f, 1268, 10, -0.7), 0.1) }, h.x, h.z, { yaw: 0.1 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1.5, 0.35, 0, 0.35) }, o.x, o.z, { yaw: 0.3, overlay: drawGlasses });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, -0.35, 0, -0.35) }, fi.x, fi.z, { yaw: -0.3 });
      break;
    }
    case 'moonback': {
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.12],
        ...head(f, 31, -4.5, 0.2, -0.55, 0.2) }, h.x, h.z, { yaw: 0.2 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -4, 0.3, -0.5, 0.3) }, o.x, o.z, { yaw: 0.3, overlay: drawGlasses });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -4, -0.3, -0.5, -0.3) }, fi.x, fi.z, { yaw: -0.3 });
      break;
    }
    case 'spot': {
      // the old man's gaze travels from the hero to the BOOK on the table
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, kf([[1413, -1], [1442, -2.5], [1471, -3]], f),
          kf([[1413, -0.2], [1442, 0.55], [1471, 0.6]], f), kf([[1413, 0], [1442, 0.3], [1471, 0.32]], f),
          kf([[1413, -0.2], [1442, 0.45], [1471, 0.5]], f)) }, o.x, o.z, { yaw: 0.3, overlay: drawGlasses });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -3, -0.4, 0.45, -0.4) }, h.x, h.z, { yaw: -0.55 });
      break;
    }
    case 'laugh': {
      const Tn = heroTurn(f);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', squash: Tn.squash, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -3 + 2.2 * Math.sin(f * 0.33), kf([[1472, 0.5], [1486, 0.5], [1498, -0.1], [1518, 0]], f), -0.1, kf([[1472, 0.45], [1498, 0.05], [1518, 0]], f)) }, h.x, h.z, { yaw: Tn.yaw, y: Tn.hop });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.7],
        ...head(f, 71, -1.5, -0.45, 0.1, -0.45) }, o.x, o.z, { yaw: -0.4, overlay: drawGlasses });
      break;
    }
    case 'dialogue': {
      // THE LINE, performed: the hero's mouth is driven by the stem
      // itself (speak.js); every other mouth stays shut.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...T.faceP('smile'), cheek: 0 }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        headTilt: q((sp.nod || 0) + micro(f, 31) - 1.5, 1), look: q(0.08, 2), lookY: q(0.02, 2), facing: q(0.1, 2), squash: 0 }, h.x, h.z, { yaw: 0.1 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1.5, -0.4, 0.05, -0.4) }, o.x, o.z, { yaw: -0.35, overlay: drawGlasses });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.4, 0.05, 0.4) }, fi.x, fi.z, { yaw: 0.35 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, -0.45, 0.05, -0.45) }, va.x, va.z, { yaw: -0.4 });
      std('vilB', OUTFITS.vilB, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1, 0.45, 0.05, 0.45) }, vb.x, vb.z, { yaw: 0.4 });
      break;
    }
    case 'hookboard': {
      // R2: the film ends on a CHARACTER BEAT (V3's final-frame
      // grammar) — the hero kneels on one knee in the FOREGROUND,
      // grinning up and pointing at the hook board as it rises behind
      // him; his head stays below the board's text band, so the board
      // remains fully readable at full opacity to the last frame.
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'kneel', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.35],
        ...head(f, 31, -2.5, 0.45, -0.35, 0.45) }, h.x, h.z, { yaw: 0.5 });
      std('fish', OUTFITS.fish, { expr: 'grin', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, -0.4, 0, -0.4) }, fi.x, fi.z, { yaw: -0.35 });
      std('vilB', OUTFITS.vilB, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1, -0.45, 0, -0.45) }, vb.x, vb.z, { yaw: -0.4 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-4.6, -0.62, -11.25, -10.75, { h: 3.4, id: 'hutfrontL' }),
  SOL.aabb(1.12, 4.6, -11.25, -10.75, { h: 3.4, id: 'hutfrontR' }),
  SOL.aabb(-4.85, -4.35, -16.5, -11, { h: 3.4, id: 'hutsideL' }),
  SOL.aabb(4.35, 4.85, -16.5, -11, { h: 3.4, id: 'hutsideR' }),
  SOL.aabb(-4.6, 4.6, -16.75, -16.25, { h: 3.4, id: 'hutback' }),
  SOL.circle(0.55, -12.9, 0.5, { h: 0.78, id: 'table' }),
  SOL.obb(STALL.x, STALL.z, 0, 0.85, 0.45, { h: 0.78, id: 'stall' }),
  SOL.circle(1.1, -3.5, 0.55, { h: 0.5, id: 'platform', group: 'stage' }),
  SOL.circle(-5.8, -5.5, 0.5, { h: 3.2, id: 'tree' }),
  SOL.circle(3.9, -2.6, 0.09, { h: 2.6, id: 'post1' }),
  SOL.circle(-3.4, 1.8, 0.09, { h: 2.6, id: 'post2' }),
  SOL.circle(-3.1, -8.6, 0.09, { h: 2.6, id: 'post3' }),
  SOL.aabb(-12.6, -8.4, -13.6, -10.4, { h: 3, id: 'hutL' }),
  SOL.aabb(8.4, 12.6, -12.6, -9.4, { h: 3, id: 'hutR' }),
  SOL.aabb(-10.6, -7.4, 1.4, 4.6, { h: 3, id: 'hutL2' }),
  SOL.aabb(7.9, 11.1, 2.4, 5.6, { h: 3, id: 'hutR2' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  const onStage = ['hook', 'announce'].includes(shotAt(f).id);
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: a.id === 'hero' && onStage ? 'stage' : '' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
