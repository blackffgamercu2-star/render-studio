// Shot plan for "पानी पर दौड़ने वाला लड़का" — waterrun-hindi.
// Salted Mine V3 style/animation, rebuilt for Abid's NEW ACTION-LEVEL
// CAMERA order (2026-11-18, Zack D Films grammar): R2's smooth tracking
// read as NORMAL/SLOW to him, so here the camera RUNS with the subject —
// low water-level tracking alongside the boy's run, fast eased push-ins
// (subject scale x2-3 inside ~15 frames at action starts), declared
// impact KICKS on the leap landing / the SPLASH / the rescue yank, a
// whip-pan from the laughing crowd to the rescue, POV feet-and-splashes
// insert on the second run, reaction faces punched in FAST to >=65%.
// NO slow drift, NO static holds: every shot's camera travels.
// Voice stem: Google AI Studio Puck (series voice), 51.571 s, 30 fps,
// TOTAL 1547; line timings from timing.json (faster-whisper small,
// char-mapped onto the script — see ../align.py; tail 32/32 mapped).
// Scene changes ONLY at line boundaries (one sub-split inside L10 for
// the whip from the crowd to the rescue):
//   L1 hook run        L7 the second run     L13 flashback: laying
//   L2 the belief      L8 the chase          L14 the salute
//   L3 bets on the bank L9 THE SPLASH        L15 the question
//   L4 the boatman     L10 laugh + rescue    L16 THE LINE (performed)
//   L5 the swimmer     L11 the reveal        L17 hook board (woman
//   L6 the challenge   L12 the stones insert      who cooks w/o fire)
// ONE set: a village pond at dawn — the stone path runs west-east at
// z=-2 under the surface, the ferry lane at z=-6.5, the crowd's ghat
// on the south bank (z 5..8), huts and trees on the far banks, the
// hook board standing on the south bank at z=10.5.
// GRADE: Sunny Pop morning; the flashback runs the drier 'dry' twin.
// Boards/text never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1547, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 110, light: 'day' },
  { id: 'belief', a: 111, b: 192, light: 'day' },
  { id: 'crowd', a: 193, b: 289, light: 'day' },
  { id: 'boat', a: 290, b: 381, light: 'day' },
  { id: 'arrive', a: 382, b: 483, light: 'day' },
  { id: 'declare', a: 484, b: 596, light: 'day' },
  { id: 'run2', a: 597, b: 678, light: 'day' },
  { id: 'chase', a: 679, b: 763, light: 'day' },
  { id: 'splash', a: 764, b: 847, light: 'day' },
  { id: 'rescueA', a: 848, b: 884, light: 'day' },
  { id: 'rescueB', a: 885, b: 937, light: 'day' },
  { id: 'reveal', a: 938, b: 1033, light: 'day' },
  { id: 'stones', a: 1034, b: 1139, light: 'day' },
  { id: 'flash', a: 1140, b: 1229, light: 'dry' },
  { id: 'salute', a: 1230, b: 1311, light: 'day' },
  { id: 'ask', a: 1312, b: 1378, light: 'day' },
  { id: 'dialogue', a: 1379, b: 1472, light: 'day' },
  { id: 'hookboard', a: 1473, b: 1546, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const lerp3 = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)];

// ---------- lights / mood grades ----------
export const LIGHTS = {
  day: { az: 122, el: 27, sky: '#bcd9ea', ground: '#5f7050', hemi: 0.78, sun: '#fff1d4', sunI: 1.18, fog: '#cfe4ef', fogNear: 30, fogFar: 170,
    skyTop: '#3f8fd2', skyHor: '#d7ecf7', sunDisc: '#fff7dd', sunSize: 0.012, sat: 1.12, vig: 0.26, shadowExt: 30, aurora: 0, gain: '#fff4e0',
    waterDeep: '#175d7a', waterShal: '#2f96b4', glint: '#fff3cf' },
  dry: { az: 118, el: 34, sky: '#cfe0d8', ground: '#8a6f42', hemi: 0.72, sun: '#ffeec4', sunI: 1.32, fog: '#e6d9b8', fogNear: 26, fogFar: 150,
    skyTop: '#4a90c4', skyHor: '#eee3c2', sunDisc: '#fff7dd', sunSize: 0.012, sat: 1.1, vig: 0.28, shadowExt: 30, aurora: 0, gain: '#ffe9c4',
    waterDeep: '#175d7a', waterShal: '#2f96b4', glint: '#fff3cf' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging constants ----------
export const BOARD_POS = [0.8, 2.0, 10.5];
export const SIGN_POS = BOARD_POS;
export const PATH_Z = -2, PATH_X0 = -11.5, PATH_X1 = 11.5;
export const SPLASH_F = 772;
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// ---------- movement tracks (single source of truth) ----------
// The boy's day: race 1 west->east (hook/belief), ashore east (crowd),
// a replay race behind the boat (boat), back along the south bank
// (arrive bg), waiting at the west start (declare), race 2 (run2),
// still ahead in the chase, turns back (splash), runs back to rescue,
// stands mid-pond for the reveal, kneels in the dry-bed flashback,
// then the ghat for salute/ask/dialogue and the final board.
export const boyAt = (f) => {
  const S = shotAt(f).id;
  const run = (x0, x1, a, b, stride = 1.05) => {
    const x = lerp(x0, x1, clamp((f - a) / (b - a)));
    return { x, ph: Math.abs(x - x0) / stride % 1 };
  };
  switch (S) {
    case 'hook': { const r = run(-8.5, 3.5, 0, 110); return { ...r, ph: (r.ph + 0.3) % 1, z: PATH_Z, y: 0, mode: 'run' }; }
    case 'belief': { const r = run(3.5, 9.5, 111, 192); return { ...r, z: PATH_Z, y: 0, mode: 'run' }; }
    case 'crowd': { const r = run(9.5, 12.1, 193, 240); return f <= 240 ? { ...r, z: PATH_Z, y: 0, mode: 'run' } : { x: 12.35, z: -2.1, y: 0, mode: 'stand', ph: 0 }; }
    case 'boat': { const r = run(-6, 4, 290, 381); return { ...r, z: PATH_Z, y: 0, mode: 'run' }; }
    case 'arrive': { const r = run(-3.5, -9.5, 382, 483, 1.35); return { ...r, z: 5.7, y: 0, mode: 'walk' }; }
    case 'declare': return { x: -12.2, z: -2.1, y: 0, mode: 'stand', ph: 0 };
    case 'run2': { const r = run(-11.8, -1.8, 597, 678); return { ...r, z: PATH_Z, y: 0, mode: 'run' }; }
    case 'chase': { const r = run(-1.8, 1.2, 679, 763); return { ...r, z: PATH_Z, y: 0, mode: 'run' }; }
    case 'splash': { const x = lerp(1.2, 0.1, clamp((f - 764) / 60)); return { x, z: PATH_Z, y: 0, mode: f < 800 ? 'run' : 'stand', ph: (1.2 - x) / 1.05 % 1 }; }
    case 'rescueA': return { x: 0.1, z: PATH_Z, y: 0, mode: 'stand', ph: 0 };
    case 'rescueB': { const r = run(0.1, -7.4, 885, 912); return f <= 912 ? { ...r, z: PATH_Z, y: 0, mode: 'run' } : { x: -7.55, z: PATH_Z, y: 0, mode: 'stand', ph: 0 }; }
    case 'reveal': case 'stones': return { x: -7.4, z: PATH_Z, y: 0, mode: 'stand', ph: 0 };
    case 'flash': return { x: -2.2, z: PATH_Z, y: -0.055, mode: 'kneel', ph: 0 };
    case 'salute': case 'ask': case 'dialogue': return { x: -0.6, z: 5.6, y: 0, mode: 'stand', ph: 0 };
    case 'hookboard': return { x: 0.0, z: 13.2, y: 0, mode: 'kneel', ph: 0 };
    default: return { x: 0, z: PATH_Z, y: 0, mode: 'stand', ph: 0 };
  }
};
// The swimmer: strides in along the bank, boasts, waits at the west
// start, LEAPS in behind the boy, two wobbling steps, SPLASHES down to
// his neck, is hauled out onto the path, then the ghat beats.
export const swimAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'arrive': { const x = lerp(-6.5, -1.6, clamp((f - 382) / 73)); return { x, z: 6.4, y: 0, mode: f < 455 ? 'walk' : 'stand', ph: Math.abs(x + 6.5) / 1.3 % 1 }; }
    case 'declare': return { x: -1.6, z: 6.2, y: 0, mode: 'stand', ph: 0 };
    case 'chase': {
      if (f < 696) { const u = (f - 679) / 17; return { x: lerp(-12.9, -11.3, u), z: -1.7, y: Math.sin(u * Math.PI) * 0.55, mode: 'leap', ph: 0 }; }
      const x = lerp(-11.3, -9.8, clamp((f - 696) / 67)); return { x, z: -1.6, y: 0, mode: 'run', ph: Math.abs(x + 11.3) / 0.95 % 1 };
    }
    case 'splash': {
      if (f < SPLASH_F) { const x = lerp(-9.8, -9.35, (f - 764) / 8); return { x, z: -1.55, y: 0, mode: 'run', ph: 0.4 }; }
      const u = smooth(ramp(f, SPLASH_F, SPLASH_F + 18));
      return { x: -9.3, z: -1.5, y: lerp(0, -0.62, u) + (f > SPLASH_F + 18 ? 0.045 * Math.sin((f - SPLASH_F) * 0.22) : 0), mode: 'sunk', ph: 0 };
    }
    case 'rescueA': return { x: -9.3, z: -1.5, y: -0.62, mode: 'sunk', ph: 0 };
    case 'rescueB': {
      if (f < 905) return { x: -9.3, z: -1.5, y: -0.62 + 0.045 * Math.sin(f * 0.22), mode: 'sunk', ph: 0 };
      const u = smooth(ramp(f, 905, 935));
      return { x: lerp(-9.3, -8.55, u), z: lerp(-1.5, -1.95, u), y: lerp(-0.62, -0.04, u), mode: 'pulled', ph: 0 };
    }
    case 'reveal': case 'stones': return { x: -8.45, z: -2.05, y: 0, mode: 'stand', ph: 0 };
    case 'salute': return { x: 2.6, z: 6.2, y: 0, mode: 'stand', ph: 0 };
    case 'ask': return { x: 1.4, z: 5.9, y: 0, mode: 'stand', ph: 0 };
    case 'dialogue': return { x: 1.3, z: 5.8, y: 0, mode: 'stand', ph: 0 };
    case 'hookboard': return { x: 3.6, z: 12.6, y: 0, mode: 'stand', ph: 0 };
    default: return { x: 14, z: 8, y: 0, mode: 'stand', ph: 0 };
  }
};
// The ferry: races the boy on the z=-6.5 lane (hook/belief/crowd), a
// replay race for the boatman's own shot, then moored at the east shore.
export const boatAt = (f) => {
  const S = shotAt(f).id;
  const row = (a, b) => f >= a && f <= b;
  switch (S) {
    case 'hook': return { x: lerp(-9, 0.5, clamp(f / 110)), z: -6.5, ry: 0, rowing: true };
    case 'belief': return { x: lerp(0.5, 4.5, clamp((f - 111) / 81)), z: -6.5, ry: 0, rowing: true };
    case 'crowd': return { x: lerp(4.5, 7, clamp((f - 193) / 96)), z: -6.5, ry: 0, rowing: f < 250 };
    case 'boat': return { x: lerp(-7, 2.5, clamp((f - 290) / 91)), z: -6.5, ry: 0, rowing: true };
    default: return { x: 11.6, z: -6.8, ry: 0.5, rowing: false };
  }
};
// oar stroke cycle 0..1 (drives the 3D oar + splash rhythm in main.js)
export const rowK = (f) => (boatAt(f).rowing ? (f * 0.045) % 1 : 0.12);
// the boatman rides his boat until it moors, then joins the bank crowd
export const boatmanAt = (f) => {
  const S = shotAt(f).id;
  if (['hook', 'belief', 'crowd', 'boat'].includes(S)) { const b = boatAt(f); return { x: b.x + 0.1, z: b.z + 0.15, y: 0.4, mode: 'sit', ph: 0, onBoat: true }; }
  switch (S) {
    case 'declare': return { x: 3.9, z: 7.3, y: 0, mode: 'stand', ph: 0 };
    case 'rescueA': return { x: 3.1, z: 6.6, y: 0, mode: 'stand', ph: 0 };
    case 'dialogue': return { x: -2.9, z: 6.3, y: 0, mode: 'stand', ph: 0 };
    case 'hookboard': return { x: -3.4, z: 12.4, y: 0, mode: 'stand', ph: 0 };
    default: return { x: 13, z: 7, y: 0, mode: 'stand', ph: 0 };
  }
};
export const vilAAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'belief': return { x: 0.5, z: 6.3, y: 0 };
    case 'crowd': return { x: 0.2, z: 6.2, y: 0 };
    case 'arrive': return { x: -4.6, z: 7.3, y: 0 };
    case 'declare': return { x: -3.6, z: 7.0, y: 0 };
    case 'rescueA': return { x: -0.4, z: 6.4, y: 0 };
    case 'salute': return { x: -3.4, z: 6.9, y: 0 };
    case 'dialogue': return { x: -3.9, z: 6.6, y: 0 };
    case 'hookboard': return { x: -4.9, z: 11.9, y: 0 };
    default: return { x: 14, z: 8, y: 0 };
  }
};
export const vilBAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'belief': return { x: -1.5, z: 6.7, y: 0 };
    case 'crowd': return { x: -1.7, z: 6.5, y: 0 };
    case 'arrive': return { x: 2.0, z: 6.9, y: 0 };
    case 'declare': return { x: 4.4, z: 6.6, y: 0 };
    case 'rescueA': return { x: 1.5, z: 6.7, y: 0 };
    case 'salute': return { x: 5.1, z: 7.0, y: 0 };
    default: return { x: 15, z: 9, y: 0 };
  }
};
export const vilCAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'belief': return { x: 2.4, z: 6.8, y: 0 };
    case 'crowd': return { x: 2.6, z: 6.6, y: 0 };
    case 'arrive': return { x: 3.6, z: 6.5, y: 0 };
    case 'declare': return { x: 2.7, z: 7.2, y: 0 };
    case 'rescueA': return { x: -2.3, z: 6.9, y: 0 };
    default: return { x: 16, z: 10, y: 0 };
  }
};

// ---------- focus (DOF target per shot) ----------
const FOCUS = {
  hook: (f) => { const b = boyAt(f); return [b.x, 1.05, PATH_Z]; },
  belief: () => [0.5, 1.62, 6.3],
  crowd: () => [0.2, 1.5, 6.3],
  boat: (f) => { const b = boatAt(f); return [b.x, 1.15, -6.4]; },
  arrive: (f) => { const s = swimAt(f); return [s.x, 1.5, 6.3]; },
  declare: () => [-1.6, 1.6, 6.2],
  run2: (f) => { const b = boyAt(f); return [b.x, 0.8, PATH_Z]; },
  chase: (f) => { const s = swimAt(f); return [s.x, 1.1, -1.7]; },
  splash: () => [-9.3, 1.05, -1.5],
  rescueA: () => [0.2, 1.55, 6.5],
  rescueB: (f) => { const b = boyAt(f); return [b.x, 1.1, PATH_Z]; },
  reveal: () => [-7.2, 0.35, PATH_Z],
  stones: () => [-6.9, 0.1, PATH_Z],
  flash: () => [-1.9, 0.5, PATH_Z],
  salute: () => [1.0, 1.5, 6.0],
  ask: () => [-0.2, 1.55, 5.7],
  dialogue: () => [-0.6, 1.58, 5.6],
  hookboard: () => [0.8, 1.95, 10.5],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: ACTION LEVEL — every shot travels WITH its subject ----------
// Head-width maths (card head ~0.61 m): % = 0.61 / (2*d*tan(fov/2)*0.5625).
// Push-ins are authored as eased key moves concentrated in the first
// ~15 frames of the action; tracking raws follow the movement tracks
// analytically every frame, so the camera truly runs with the subject.
const boyPos = (f) => { const b = boyAt(f); return [b.x, b.y || 0, b.z]; };
const RIG_BY_ID = {
  // hook: LOW at water level SOUTH of the path, running WITH the boy.
  // Frames 0-15 are the snap push-in (head ~34% -> ~74%, x2.2) while the
  // track locks on; then it runs alongside him to the east, the ferry
  // racing in the deep background.
  hook: { cut: 'hard', raw: (f) => {
    const b = boyAt(f), u = smooth(ramp(f, 0, 15));
    const d = lerp(3.4, 1.7, u), dz = lerp(3.0, 2.2, u);
    return { pos: [b.x - d * 0.42, lerp(1.5, 0.85, u), PATH_Z + dz], look: [b.x + 0.25, 0.98, PATH_Z], fov: lerp(40, 37, u), roll: 0 };
  } },
  // belief: the crowd's wonder — a FAST punch from the group onto the
  // elder's face (41% -> 74% inside 15 frames), boy still running far
  // behind them over the elder's shoulder line.
  belief: { cut: 'hard', raw: keysCam({ keys: [
    { f: 111, pos: [-1.7, 1.7, 10.6], look: [0.5, 1.5, 6.3], fov: 40 },
    { f: 126, pos: [-0.55, 1.62, 8.85], look: [0.5, 1.62, 6.3], fov: 34, ease: 'surge' },
    { f: 192, pos: [-0.42, 1.58, 8.6], look: [0.52, 1.62, 6.3], fov: 33, ease: 'surge' }] }) },
  // crowd: the bets — a lateral track that slides along the ghat crowd
  // at walking pace (4.5 m of travel), a coin passing hand to hand at
  // centre frame mid-shot.
  crowd: { cut: 'hard', raw: keysCam({ keys: [
    { f: 193, pos: [-3.3, 1.66, 9.9], look: [-0.6, 1.45, 6.4], fov: 41 },
    { f: 241, pos: [-0.6, 1.6, 9.55], look: [0.35, 1.42, 6.35], fov: 39, ease: 'smooth' },
    { f: 289, pos: [1.7, 1.56, 9.3], look: [1.15, 1.45, 6.4], fov: 38, ease: 'surge' }] }) },
  // boat: FRONT three-quarter tracking — the camera races BACKWARD just
  // ahead of the ferry's bow, the boatman rowing straight at it, the
  // boy's run crossing the deep background. Push 4.3 -> 3.0 m.
  boat: { cut: 'hard', raw: (f) => {
    const b = boatAt(f), u = smooth(ramp(f, 290, 381));
    const d = lerp(4.3, 3.0, u);
    return { pos: [b.x + d * 0.78, 1.35, -6.5 + d * 0.62], look: [b.x + 0.1, 1.0, -6.45], fov: lerp(39, 36, u), roll: 0 };
  } },
  // arrive: tracks the swimmer's stride along the bank, then PUNCHES IN
  // on his laugh in the last 14 frames (head -> ~72%).
  arrive: { cut: 'hard', raw: (f) => {
    const s = swimAt(f), u = smooth(ramp(f, 469, 483));
    const back = lerp(4.1, 2.35, u);
    return { pos: [s.x - back * 0.38, lerp(1.66, 1.6, u), 6.35 + back], look: [s.x + 0.15, lerp(1.45, 1.6, u), 6.3], fov: lerp(40, 34, u), roll: 0 };
  } },
  // declare: the boast — pushInCam surge on the swimmer, face 47% ->
  // 78%, his pointing arm swinging up at the pond as he announces.
  declare: { cut: 'hard', raw: pushInCam({ subject: () => [-1.6, 0, 6.2], a: 484, b: 596, d0: 3.6, d1: 2.05, h0: 1.64, h1: 1.58, lookOff: [0, 1.6, 0], fov0: 37, fov1: 32,
    dir: () => [-0.35, 0.94] }) },
  // run2: the POV feet-and-splashes insert — camera at water level
  // running just ahead-south of the boy, looking DOWN at his feet and
  // the bursting stones-line for the first half, then swinging UP to
  // his face as it tightens (2.6 -> 1.9 m) for the run's last stretch.
  run2: { cut: 'hard', raw: (f) => {
    const b = boyAt(f), up = smooth(ramp(f, 640, 662));
    const d = lerp(2.9, 2.3, smooth(ramp(f, 597, 678)));
    return { pos: [b.x - d * 0.5, lerp(0.88, 1.0, up), PATH_Z + d * 0.85], look: [b.x + 0.3, lerp(0.3, 1.25, up), PATH_Z], fov: lerp(42, 38, up), roll: 0 };
  } },
  // chase: side-tracking the swimmer's leap and wobbling steps from
  // just south of the path, pushing 4.5 -> 2.6 m as he closes on the
  // boy; a declared KICK lands with his feet at f696.
  chase: { cut: 'hard', raw: (f) => {
    const s = swimAt(f), u = smooth(ramp(f, 679, 763));
    const d = lerp(4.5, 2.6, u);
    return { pos: [s.x - d * 0.3, 1.02, -1.7 + d * 0.94], look: [s.x + 0.2, 1.05, -1.75], fov: lerp(40, 36, u), roll: 0 };
  } },
  // splash: the track slams into a PUNCH-IN the moment he goes down
  // (f764-780: 3.2 -> 2.3 m, face to ~75%) and holds on his shocked,
  // bobbing face; declared KICK at the impact frame f772.
  splash: { cut: 'hard', raw: keysCam({ keys: [
    { f: 764, pos: [-11.6, 1.05, 1.35], look: [-9.5, 1.0, -1.55], fov: 38 },
    { f: 780, pos: [-11.15, 0.98, 0.72], look: [-9.3, 1.02, -1.5], fov: 35, ease: 'surge' },
    { f: 847, pos: [-11.3, 0.94, 0.55], look: [-9.3, 1.0, -1.5], fov: 34, ease: 'surge' }] }) },
  // rescueA: the crowd's laugh — a fast lateral slide across the ghat
  // faces, all of them cracking up, heads bobbing.
  rescueA: { cut: 'hard', raw: keysCam({ keys: [
    { f: 848, pos: [-3.6, 1.62, 9.9], look: [-1.2, 1.5, 6.6], fov: 39 },
    { f: 884, pos: [-1.2, 1.58, 9.5], look: [0.3, 1.52, 6.5], fov: 37, ease: 'surge' }] }) },
  // rescueB: WHIP-in from the crowd to the boy already running back
  // along the path; the camera lands in a side-track, runs west with
  // him, and settles front three-quarter on the pull (KICK at the yank).
  rescueB: { cut: 'whip', blend: 12, raw: (f) => {
    const b = boyAt(f);
    if (f <= 912) { const d = 3.1; return { pos: [b.x - d * 0.34, 0.92, PATH_Z + d * 0.94], look: [b.x + 0.2, 1.0, PATH_Z], fov: 38, roll: 0 }; }
    const u = smooth(ramp(f, 912, 937));
    return { pos: [lerp(-8.5, -9.6, u), lerp(0.92, 1.12, u), lerp(0.75, 1.35, u)], look: [lerp(-7.5, -8.35, u), 1.05, -1.95], fov: lerp(38, 36, u), roll: 0 };
  } },
  // reveal: starts on the two-shot, then DIVES with the boy's pointing
  // hand toward the water at their feet as the pond turns clear — the
  // stone row blooms under the surface, glittering east-west.
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 938, pos: [-8.1, 1.5, 1.6], look: [-7.9, 1.15, -2.0], fov: 39 },
    { f: 972, pos: [-7.9, 1.06, 0.6], look: [-7.35, 0.5, -2.0], fov: 37, ease: 'surge' },
    { f: 1033, pos: [-7.75, 0.62, 0.15], look: [-7.1, 0.12, -2.0], fov: 36, ease: 'surge' }] }) },
  // stones: the INSERT — camera skimming the surface ALONG the row:
  // the nearest flat stone fills ~90% of the frame width, the row
  // recedes east under clear water, the boy standing on it far down
  // the line, toe tapping the stone he stands on.
  stones: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1034, pos: [-10.9, 0.8, 0.3], look: [-7.4, 0.75, -2.0], fov: 37 },
    { f: 1139, pos: [-10.5, 0.74, 0.05], look: [-7.4, 0.8, -2.0], fov: 35, ease: 'surge' }] }) },
  // flash: the dry summer — a steady push along the laid row toward
  // the kneeling boy as he sets the next stone; heat shimmer in the
  // grade, cracked bed all around.
  flash: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1140, pos: [-5.6, 1.35, 1.9], look: [-2.4, 0.35, -2.0], fov: 39 },
    { f: 1229, pos: [-4.4, 1.12, 1.15], look: [-2.15, 0.42, -2.0], fov: 36, ease: 'surge' }] }) },
  // salute: opens WIDE on the ghat and punches in fast (14 frames) to
  // the two-shot as the swimmer snaps his salute; then a gentle track.
  salute: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1230, pos: [-1.4, 1.8, 11.4], look: [0.9, 1.4, 6.0], fov: 42 },
    { f: 1244, pos: [-0.9, 1.66, 9.9], look: [1.0, 1.48, 6.0], fov: 38, ease: 'surge' },
    { f: 1311, pos: [-0.55, 1.6, 9.45], look: [1.05, 1.5, 6.0], fov: 37, ease: 'surge' }] }) },
  // ask: over the swimmer's shoulder line — starts on both faces, then
  // pushes past him onto the boy as the question lands (rack focus
  // follows in dofAt via FOCUS).
  ask: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1312, pos: [2.2, 1.66, 9.6], look: [0.3, 1.5, 5.75], fov: 39 },
    { f: 1378, pos: [1.15, 1.6, 8.6], look: [-0.35, 1.55, 5.65], fov: 36, ease: 'surge' }] }) },
  // dialogue: THE LINE, performed — push-in on the boy as he answers,
  // face 50% -> 74%; the swimmer listens at the frame edge, mouth shut.
  dialogue: { cut: 'hard', raw: pushInCam({ subject: () => [-0.6, 0, 5.6], a: 1379, b: 1472, d0: 3.4, d1: 2.2, h0: 1.62, h1: 1.57, lookOff: [0, 1.58, 0], fov0: 37, fov1: 33,
    dir: () => [0.3, 0.95] }) },
  // hookboard: the film ends on a CHARACTER BEAT — the boy kneels in
  // the foreground pointing up at the hook board (86% of frame width,
  // whole panel inside with margins, full opacity to the last frame).
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1473, pos: [1.25, 2.05, 20.4], look: [0.8, 1.92, 10.5], fov: 47 },
    { f: 1546, pos: [1.15, 1.98, 19.6], look: [0.8, 1.95, 10.5], fov: 46, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 696, a: 0.35 }, { f: SPLASH_F, a: 0.38 }, { f: 908, a: 0.35 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { hook: 1.6, belief: 2.6, crowd: 2.2, boat: 1.8, arrive: 2.4, declare: 2.8, run2: 1.4, chase: 1.8, splash: 2.8, rescueA: 2.6, rescueB: 2.0, reveal: 2.2, stones: 3.0, flash: 2.4, salute: 2.4, ask: 2.8, dialogue: 3.2, hookboard: 1.3 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
// stonesK: the reveal — the pond turns clear (f950-990 ramp) and stays
// clear through the stones insert. dryK: the flashback's dry bed.
// rowA: the oar's stroke angle for the 3D oar in main.js.
export const worldAt = (f) => {
  const S = shotAt(f);
  const stonesK = (S.id === 'reveal' || S.id === 'stones') ? smooth(ramp(f, 950, 990)) : 0;
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1478, 1502)) : 0,
    stonesK,
    dryK: S.id === 'flash' ? 1 : 0,
    rowA: boatAt(f).rowing ? Math.sin(rowK(f) * Math.PI * 2) : 0.25,
    lampK: 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  // sun glints dance on the revealed stones
  const spark = (S.id === 'reveal' || S.id === 'stones') ? 0.5 * Math.pow(Math.abs(Math.sin(f * 0.4)), 4) : 0;
  return { moteRate: 0.05, blastRate: 0, sparkRate: spark, steamRate: 0, shimmerRate: S.id === 'flash' ? 0.4 : 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours
// flat and saturated even in morning shade (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  boy: { jacket: '#e07b2a', pants: '#efe6d0', boots: '#3a2410', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  swim: { jacket: '#28518f', pants: '#e8e4da', boots: '#1c1712', hat: 'hair', hair: '#101418', skin: '#fbf7ef' },
  boat: { jacket: '#1f7a6a', pants: '#33424a', boots: '#1c1712', hat: 'cap', cap: '#f2e3c2', skin: '#fbf7ef', moustache: '#2a201a' },
  vilA: { jacket: '#cfc8b8', pants: '#5a5348', boots: '#241a12', hat: 'hair', hair: '#e9e7e1', skin: '#fbf7ef', moustache: '#e9e7e1', bigMoustache: true },
  vilB: { jacket: '#a03a5e', pants: '#4a2436', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  vilC: { jacket: '#7a4a2a', pants: '#3c3a40', boots: '#241a12', hat: 'cap', cap: '#8e2323', skin: '#fbf7ef' },
};
// the elder's round glasses, drawn over the face card (card space
// 600x1000; head centre from T.headCenter(seed), eyes ~ +/-46 around 300)
const drawGlasses = (p) => {
  const hc = T.headCenter(71);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};

// ---------- HEAD PERFORMANCE ----------
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
const emoBoy = emoTrack('determined', [
  [111, 'determined', 8], [193, 'proud', 8], [290, 'determined', 8], [382, 'smile', 8], [484, 'smug', 8],
  [597, 'determined', 7], [679, 'determined', 7], [764, 'nervous', 8], [848, 'nervous', 6], [885, 'determined', 7],
  [913, 'relief', 8], [938, 'proud', 8], [1034, 'proud', 8], [1140, 'thinking', 9], [1230, 'grin', 8],
  [1312, 'smile', 8], [1473, 'grin', 8],
]);
const emoSwim = emoTrack('proud', [
  [484, 'laugh', 9], [560, 'proud', 8], [679, 'determined', 7], [764, 'shock', 6], [848, 'dazed', 8],
  [905, 'relief', 9], [938, 'wonder', 9], [1034, 'wonder', 8], [1230, 'proud', 8], [1312, 'thinking', 9], [1379, 'relief', 8],
]);
const emoBoat = emoTrack('grin', [
  [290, 'pained', 9], [382, 'grin', 8], [848, 'laugh', 7], [938, 'relief', 8],
]);
const emoVilA = emoTrack('wonder', [
  [193, 'thinking', 8], [382, 'wonder', 8], [484, 'smile', 8], [848, 'laugh', 7], [1230, 'smile', 8], [1379, 'smile', 8],
]);
const emoVilB = emoTrack('smile', [
  [193, 'grin', 8], [484, 'smile', 8], [848, 'laugh', 7], [1230, 'smile', 8],
]);
const emoVilC = emoTrack('grin', [
  [484, 'smile', 8], [848, 'laugh', 7],
]);
const boyWink = winkTrack([{ a: 1020, b: 1030 }]);
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});
const noBlush = (P) => { P.blush = 0; P.openL = Math.min(1, (P.openL ?? 0.85) * 1.45); P.openR = Math.min(1, (P.openR ?? 0.85) * 1.45); return P; };

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: extra.r || 0.32, ground: extra.ground ?? (extra.y || 0),
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground ?? (extra.y || 0), tint, ...extra }) });
  const b = boyAt(f), s = swimAt(f), bt = boatAt(f), bm = boatmanAt(f);
  const va = vilAAt(f), vb = vilBAt(f), vc = vilCAt(f);
  let BP = noBlush(emoBoy.at(f));
  const SP = noBlush(emoSwim.at(f)), BT = noBlush(emoBoat.at(f)), AP = noBlush(emoVilA.at(f)), VB = noBlush(emoVilB.at(f)), VC = noBlush(emoVilC.at(f));
  const winkK = boyWink(f);
  if (winkK > 0) BP = T.blendFaceP(BP, T.faceP('wink', 31), winkK);
  const runBoy = (exprP, extra = {}) => std('boy', OUTFITS.boy, { expr: 'smile', exprP: exprP || BP, mode: 'march', phase: q(b.ph, 2), blink: blinkAt(f, 31), seed: 31,
    ...head(f, 31, 2.5, 0.35, 0.05, 0.35) }, b.x, b.z, { y: b.y, ground: b.y, ...extra });
  const standBoy = (opts, extra = {}) => std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...opts }, b.x, b.z, { y: b.y, ground: b.y, ...extra });
  const boatmanRowing = () => std('boatman', OUTFITS.boat, { expr: 'grin', exprP: BT, mode: 'sit', blink: blinkAt(f, 41), seed: 41,
    prop: ['point', q(0.4 + 0.28 * Math.sin(rowK(f) * Math.PI * 2), 2)], ...head(f, 41, 1.5, 0.3, 0.1, 0.3) }, bm.x, bm.z, { y: bm.y, ground: bm.y, blob: false });
  const crowd3 = (laughing = false) => {
    const bob = (seed) => (laughing ? 1.7 * Math.abs(Math.sin(f * 0.45 + seed)) : 0);
    std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.25],
      ...head(f, 71, -2 + bob(71), -0.3, -0.3, -0.3) }, va.x, va.z, { yaw: -0.3, overlay: drawGlasses });
    std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: VB, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
      ...head(f, 81, -2 + bob(81), 0.3, -0.3, 0.3) }, vb.x, vb.z, { yaw: 0.3 });
    std('vilC', OUTFITS.vilC, { expr: 'grin', exprP: VC, mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.3],
      ...head(f, 61, -2 + bob(61), 0, -0.3, 0) }, vc.x, vc.z, { yaw: 0 });
  };
  switch (S.id) {
    case 'hook': {
      // the boy mid-stride on the water, the ferry racing behind him
      runBoy();
      boatmanRowing();
      break;
    }
    case 'belief': {
      // the crowd cannot believe its eyes; the boy runs on behind them
      runBoy();
      boatmanRowing();
      crowd3();
      break;
    }
    case 'crowd': {
      // bets fly on the ghat — a coin passes vilB -> vilA at f235 —
      // while the boy steps ashore in the far background
      if (f <= 240) runBoy(); else standBoy({ ...head(f, 31, -2, -0.4, -0.1, -0.4) }, { yaw: -0.3 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: f >= 235 ? ['coin', 0.52] : ['point', 0.3],
        ...head(f, 71, -1.5, -0.35, -0.25, -0.35) }, va.x, va.z, { yaw: -0.3, overlay: drawGlasses });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: VB, mode: 'stand', blink: blinkAt(f, 81), seed: 81, prop: f < 235 ? ['coin', 0.55] : ['point', 0.35],
        ...head(f, 81, -1.5, 0.4, -0.2, 0.4) }, vb.x, vb.z, { yaw: 0.35 });
      std('vilC', OUTFITS.vilC, { expr: 'grin', exprP: VC, mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.18],
        ...head(f, 61, -2.5, 0.1, -0.4, 0.1) }, vc.x, vc.z, { yaw: 0.1 });
      break;
    }
    case 'boat': {
      // the boatman's own race — all effort, still beaten (the boy
      // crosses the deep background on the path)
      boatmanRowing();
      runBoy();
      break;
    }
    case 'arrive': {
      // the famous swimmer strides in; the crowd parts; the boy walks
      // back west along the bank behind him, unnoticed
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'stroll', phase: q(b.ph, 2), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, -0.3, 0, -0.3) }, b.x, b.z, { y: 0, ground: 0, yaw: -0.35 });
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: s.mode === 'walk' ? 'stroll' : 'stand', phase: q(s.ph, 2), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.2, -0.1, 0.2) }, s.x, s.z, { y: 0, ground: 0, yaw: 0.15 });
      crowd3();
      break;
    }
    case 'declare': {
      // the boast: chest out, laughing, arm swinging up at the pond;
      // the boy waits at the far start line, stretching, smug
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        prop: ['point', q(lerp(0.55, 0.14, smooth(ramp(f, 500, 524))), 2)],
        ...head(f, 51, kf([[484, -2], [530, -4], [596, -3]], f), 0.15, -0.25, 0.15) }, s.x, s.z, { yaw: 0.1 });
      standBoy({ prop: ['point', q(0.2 + 0.1 * Math.sin(f * 0.05), 2)], ...head(f, 31, -2, 0.4, -0.2, 0.4) }, { yaw: 0.3 });
      std('boatman', OUTFITS.boat, { expr: 'grin', exprP: BT, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2, -0.3, -0.25, -0.3) }, bm.x, bm.z, { yaw: -0.3 });
      crowd3();
      break;
    }
    case 'run2': {
      runBoy();
      break;
    }
    case 'chase': {
      // the leap, then two wobbling steps — roll sells the wobble
      const wob = s.mode === 'run' ? 0.07 * Math.sin(f * 0.55) : 0;
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: s.mode === 'leap' ? 'stand' : 'march', phase: q(s.ph, 2), blink: blinkAt(f, 51), seed: 51,
        prop: s.mode === 'leap' ? ['point', 0.1] : null, ...head(f, 51, s.mode === 'leap' ? -3 : 2, 0.3, -0.1, 0.3) }, s.x, s.z, { y: s.y, ground: s.y, roll: q(wob, 3), yaw: 0.2 });
      runBoy();
      break;
    }
    case 'splash': {
      // DOWN he goes — arms up, face shocked, sinking to his neck,
      // then bobbing; the boy skids to a stop and turns back
      const sunk = s.mode === 'sunk';
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, sunk ? -4 : 2, 0, sunk ? -0.2 : 0, 0) }, s.x, s.z, { y: s.y, ground: s.y, roll: q(sunk ? 0.05 * Math.sin(f * 0.22) : 0, 3) });
      if (f < 800) runBoy(); else standBoy({ ...head(f, 31, -1, -0.65, 0, -0.65) }, { yaw: -0.5 });
      break;
    }
    case 'rescueA': {
      // the whole ghat cracks up
      crowd3(true);
      std('boatman', OUTFITS.boat, { expr: 'grin', exprP: BT, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2 + 1.7 * Math.abs(Math.sin(f * 0.45 + 41)), 0.3, -0.2, 0.3) }, bm.x, bm.z, { yaw: 0.3 });
      break;
    }
    case 'rescueB': {
      // the boy runs back along the stones and HAULS him out by the hand
      if (f <= 912) runBoy(); else standBoy({ prop: ['point', 0.55], ...head(f, 31, 1.5, 0.55, 0.15, 0.55) }, { yaw: 0.45 });
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        prop: ['point', 0.5], ...head(f, 51, f < 905 ? -3 : -1, -0.4, 0, -0.4) }, s.x, s.z, { y: s.y, ground: s.y, roll: q(f < 905 ? 0.05 * Math.sin(f * 0.22) : lerp(0.14, 0, smooth(ramp(f, 905, 935))), 3), yaw: -0.3 });
      break;
    }
    case 'reveal': {
      // the boy points DOWN at the water between his feet; the swimmer
      // stares as the pond turns clear around the stone row
      standBoy({ prop: ['point', q(lerp(0.4, 0.88, smooth(ramp(f, 944, 962))), 2)], ...head(f, 31, 3.5, 0.2, 0.55, 0.2) }, { yaw: 0.15 });
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, 3, -0.35, 0.55, -0.35) }, s.x, s.z, { yaw: -0.3 });
      break;
    }
    case 'stones': {
      // far down the row the boy stands ON a stone and taps it with
      // his toe — a little bounce on the tap (f1080-1100)
      const tap = f >= 1080 && f <= 1100 ? Math.sin((f - 1080) / 20 * Math.PI) * 0.1 : 0;
      standBoy({ prop: ['point', 0.85], ...head(f, 31, 4, 0.1, 0.6, 0.1), squash: q(tap, 2) }, { yaw: 0.1 });
      break;
    }
    case 'flash': {
      // the dry summer: he kneels on the cracked bed and sets the
      // next flat stone into the row with both hands' care
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'kneel', blink: blinkAt(f, 31), seed: 31,
        prop: ['point', q(lerp(0.55, 0.85, smooth(ramp(f, 1160, 1200))), 2)], ...head(f, 31, 4.5, 0.15, 0.6, 0.15) }, b.x, b.z, { y: b.y, ground: b.y, yaw: 0.2 });
      break;
    }
    case 'salute': {
      // the salute — snapped up at f1246, held, the boy grinning back
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        prop: ['point', q(f < 1246 ? 0.5 : lerp(0.5, 0.05, smooth(ramp(f, 1246, 1254))), 2)], ...head(f, 51, -1.5, -0.4, -0.05, -0.4) }, s.x, s.z, { yaw: -0.35 });
      standBoy({ prop: ['point', 0.42], ...head(f, 31, -2, 0.5, -0.05, 0.5) }, { yaw: 0.4 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, 0.3, -0.1, 0.3) }, va.x, va.z, { yaw: 0.3, overlay: drawGlasses });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: VB, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -2, -0.3, -0.1, -0.3) }, vb.x, vb.z, { yaw: -0.3 });
      break;
    }
    case 'ask': {
      // dripping, humbled, he leans in with the question
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        prop: ['point', q(0.45 + 0.12 * Math.sin(f * 0.09), 2)], ...head(f, 51, 1, -0.5, 0.1, -0.5) }, s.x, s.z, { yaw: -0.45 });
      standBoy({ ...head(f, 31, -1.5, 0.5, 0, 0.5) }, { yaw: 0.45 });
      break;
    }
    case 'dialogue': {
      // THE LINE, performed: the boy's mouth is driven by the stem
      // itself (speak.js); every other mouth stays shut.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...T.faceP('smile'), cheek: 0 }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        prop: f >= 1425 ? ['point', 0.5] : null,
        headTilt: q((sp.nod || 0) + micro(f, 31) - 1.5, 1), look: q(-0.08, 2), lookY: q(0.02, 2), facing: q(-0.1, 2), squash: 0 }, b.x, b.z, { yaw: -0.1 });
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5 + nodAt(f, 1440, 10, 0.5), -0.45, 0.05, -0.45) }, s.x, s.z, { yaw: -0.4 });
      std('boatman', OUTFITS.boat, { expr: 'grin', exprP: BT, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.4, 0.05, 0.4) }, bm.x, bm.z, { yaw: 0.35 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1, -0.4, 0.05, -0.4) }, va.x, va.z, { yaw: -0.35, overlay: drawGlasses });
      break;
    }
    case 'hookboard': {
      // the film ends on a CHARACTER BEAT — the boy kneels in the
      // foreground pointing up at the hook board as it rises behind
      // him; his head stays below the board's text band, so the board
      // remains fully readable at full opacity to the last frame.
      std('boy', OUTFITS.boy, { expr: 'grin', exprP: BP, mode: 'kneel', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.32],
        ...head(f, 31, -2.5, 0.45, -0.35, 0.45) }, b.x, b.z, { y: 0, ground: 0, yaw: 0.5 });
      std('swim', OUTFITS.swim, { expr: 'smile', exprP: SP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -2.5, -0.4, -0.4, -0.4) }, s.x, s.z, { yaw: -0.35 });
      std('boatman', OUTFITS.boat, { expr: 'grin', exprP: BT, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2, 0.4, -0.35, 0.4) }, bm.x, bm.z, { yaw: 0.35 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, -0.4, -0.35, -0.4) }, va.x, va.z, { yaw: -0.35, overlay: drawGlasses });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.circle(-16.5, -2, 0.55, { h: 4.5, id: 'treeW' }),
  SOL.circle(16.5, -3, 0.55, { h: 4.5, id: 'treeE' }),
  SOL.aabb(-11, -6.5, -19.5, -16, { h: 3, id: 'hutN1' }),
  SOL.aabb(5, 10.5, -19.5, -16, { h: 3, id: 'hutN2' }),
  SOL.aabb(-13.5, -9, 15.5, 19.5, { h: 3, id: 'hutS1' }),
  SOL.aabb(9, 13.5, 15.5, 19.5, { h: 3, id: 'hutS2' }),
  SOL.circle(-0.85, 10.58, 0.07, { h: 2, id: 'boardPostL' }),
  SOL.circle(2.45, 10.58, 0.07, { h: 2, id: 'boardPostR' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: a.id === 'boatman' && boatmanAt(f).onBoat ? 'boat' : '' }));
  const bt = boatAt(f);
  out.push(SOL.obb(bt.x, bt.z, bt.ry, 1.8, 0.7, { kind: 'dynamic', id: 'boat', group: 'boat' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
