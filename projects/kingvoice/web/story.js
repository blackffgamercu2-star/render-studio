// Shot plan for "The King Who Lost His Voice" — kingvoice (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 8 E5. ONE set: a palace throne room opening onto
// a terrace over the square, where ten thousand guests wait.
// A voiceless king on speech day; the court fool hides the royal parrot
// (six years mimicking the king's voice) behind the throne curtain; the
// fool whispers, the parrot thunders the speech, and the "royal voice"
// slips once — demanding a biscuit.
// Voice stem: 57.771 s, 30 fps, TOTAL 1734; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1  0.00- 5.70 L1  morning, king opens his mouth — nothing comes out.
//   S2  5.70-10.30 L2  a day of shouting at the hunt stole his voice.
//   S3 10.30-15.40 L3  ten thousand guests in the square, treaty depends.
//   S4 15.40-20.30 L4  only the fool smiling — he knows about the parrot.
//   S5 20.30-24.60 L5  six years the parrot copied the king's voice.
//   S6 24.60-28.90 L6  the fool bows low and lays out his little plan.
//   S7 28.90-32.30 L7  DIALOGUE "A king needs a voice, Majesty..."
//   S8 32.30-36.30 L8  the king steps onto the balcony, moves his lips.
//   S9 36.30-42.60 L9  fool whispers, parrot thunders the speech.
//   S10 42.60-46.90 L10 the crowd roars, the treaty is signed.
//   S11 46.90-50.90 L11 the royal voice slips — it demands a biscuit.
//   S12 50.90-54.00 L12 hook question (board fades in).
//   S13 54.00-57.77 hook board held at FULL opacity to the last frame.
// GRADE (FILTER_VFX_LIGHTING pack): Royal Gold throughout (deep warm
// amber, glints only on metal); hook blends to dusk. Boards NEVER graded.
// Signature VFX: gold glints on the crown/parrot perch, sound rings from
// the parrot's thunder, dust motes in the throne-room sun.
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
// The king moves his lips SILENTLY on the balcony (the voice is the
// parrot's, not his): a gentle open/close cycle, NOT speak-driven.
const mimeFace = (f) => {
  const u = 0.5 + 0.5 * Math.sin((f - 971) * 0.21);
  return { expr: 'neutral', exprP: { ...T.faceP('neutral'), mOpen: 0.12 + 0.3 * u, mW: 0.85 }, headTilt: 0, clothShade: true };
};

export const FPS = 30, TOTAL = 1734, DECK = 0;
// Shot boundaries (frames) — from ASR word timings (words.json):
// L1 0-132 L2 133-268 L3 269-414 L4 415-555 L5 556-710 L6 711-844
// L7 845-970 L8 971-1092 L9 1093-1288 L10 1289-1427 L11 1428-1576
// L12 1577-1725 (hook line; board held through f1733).
export const SHOTS = [
  { id: 'morning', a: 0, b: 132, light: 'royalgold' },
  { id: 'hunt', a: 133, b: 268, light: 'royalgold' },
  { id: 'square', a: 269, b: 414, light: 'royalgold' },
  { id: 'fool', a: 415, b: 555, light: 'royalgold' },
  { id: 'parrot', a: 556, b: 710, light: 'royalgold' },
  { id: 'plan', a: 711, b: 844, light: 'royalgold' },
  { id: 'dialogue', a: 845, b: 970, light: 'royalgold' },
  { id: 'balcony', a: 971, b: 1092, light: 'royalgold' },
  { id: 'whisper', a: 1093, b: 1288, light: 'royalgold' },
  { id: 'cheer', a: 1289, b: 1427, light: 'royalgold' },
  { id: 'biscuit', a: 1428, b: 1576, light: 'royalgold' },
  { id: 'hookq', a: 1577, b: 1650, light: 'royalgold' },
  { id: 'hook', a: 1651, b: 1733, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
const WTR = { waterDeep: '#6a5136', waterShal: '#a8834a', glint: '#ffe9c0' };
export const LIGHTS = {
  royalgold: { az: 122, el: 42, sky: '#c9a86a', ground: '#6a5638', hemi: 1.05, sun: '#ffcf8a', sunI: 2.5, fog: '#ecd3a0', fogNear: 45, fogFar: 320,
    skyTop: '#3f6fb4', skyHor: '#f7dc9e', sunDisc: '#fff0c0', sunSize: 0.0036, sat: 1.1, vig: 0.22, shadowExt: 22, aurora: 0, gain: '#ffedca', ...WTR },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.92, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.05, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba', ...WTR },
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
  if (S.id === 'hookq') return blendLight(LIGHTS.royalgold, LIGHTS.dusk, smooth(ramp(f, 1577, 1630)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
// Throne room: facade north (z=-14), throne at z=-12.2, curtain z=-12.7,
// parrot perch behind the right drape. Treaty table east. Board gantry
// centre. Terrace edge z=+8, steps down to the square (y=-2.5, z 10..34).
export const BOARD_POS = [0, 3.1, -5];
export const THRONE = { x: 0, z: -12.2 };
export const PERCH = [2.1, 1.55, -12.45];
export const TABLE = { x: 4.6, z: 3.5 };
export const TERRACE = { z: 8 };

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// King: at the throne through the dialogue; then a brisk royal stride
// (march) from just south of the board to the terrace edge in the balcony
// shot (the cut hides the jump from the throne — same as pot's actors).
const KING_KEYS = [
  [0, 0, -11.0], [970, 0, -11.0],
  [971, 0, -6.0], [1092, 0, 7.6], [1733, 0, 7.6],
];
const FOOL_KEYS = [
  [0, 2.6, -10.5], [710, 2.6, -10.5],
  [711, 2.6, -10.5], [770, 1.3, -10.0], [970, 1.3, -10.0],
  [1093, 2.0, -11.9], [1733, 2.0, -11.9],
];
const C1_KEYS = [
  [0, 3.2, 4.8], [1733, 3.2, 4.8],
];
export const kingAt = (f) => { const [x, z] = walkKeys(KING_KEYS, f); return { x, z }; };
export const foolAt = (f) => { const [x, z] = walkKeys(FOOL_KEYS, f); return { x, z }; };
export const c1At = (f) => { const [x, z] = walkKeys(C1_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const kingMode = (f) => strolling(f, [[971, 1092]]) ? 'march' : 'stand';
export const foolMode = (f) => strolling(f, [[711, 770]]) ? 'stroll' : 'stand';

// ---------- parrot / quill / biscuit animation ----------
// Parrot beak: 0 closed .. 1 wide open. Mimic chatter in S5, thunder in
// S9 (with sound rings), biscuit held in S11.
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const parrotAt = (f) => {
  const S = shotAt(f);
  let beak = 0, bob = 0, headTilt = 0;
  if (S.id === 'parrot') { // mimicking the king: rapid chatter
    beak = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(f * 0.55));
    bob = 0.5 + 0.5 * Math.sin(f * 0.35);
    headTilt = 0.12 * Math.sin(f * 0.11);
  } else if (S.id === 'whisper') { // thundering the speech
    beak = segMax(f, [[1093, 1113, 1250, 1288, 1]]);
    bob = 0.6 + 0.4 * Math.sin(f * 0.5);
    headTilt = -0.08;
  } else if (S.id === 'biscuit') {
    beak = 0.35; bob = 0.2; headTilt = 0.15;
  } else if (S.id === 'fool') {
    beak = 0.1; bob = 0.15; // a green flash behind the curtain gap
  }
  return { beak, bob, headTilt };
};
export const ringsAt = (f) => segMax(f, [[1103, 1123, 1240, 1288, 1]]);
export const quillAt = (f) => {
  // the quill signs the treaty across the cheer shot, then the wax seal
  // stamps at the very end of it.
  const u = smooth(ramp(f, 1340, 1410));
  return { x: TABLE.x - 0.25 + u * 0.5, y: 0.82 + Math.sin(u * Math.PI * 6) * 0.02, z: TABLE.z - 0.1, k: ramp(f, 1310, 1330), sealK: smooth(ramp(f, 1405, 1427)) };
};
export const biscuitAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'biscuit') return { k: 1 }; // in the parrot's beak
  return { k: 0 };
};

// ---------- hero / focus ----------
const FOCUS = {
  morning: () => { const k = kingAt(80); return [k.x, 1.3, k.z]; },
  hunt: () => { const k = kingAt(200); return [k.x, 1.3, k.z]; },
  square: () => [0, -0.5, 12],
  fool: () => { const w = foolAt(480); return [w.x, 1.35, w.z]; },
  parrot: () => [PERCH[0], PERCH[1] + 0.2, PERCH[2]],
  plan: () => { const w = foolAt(770); return [w.x, 1.3, w.z]; },
  dialogue: () => { const w = foolAt(900); return [w.x, 1.45, w.z]; },
  balcony: () => { const k = kingAt(1030); return [k.x, 1.4, k.z]; },
  whisper: () => [2.0, 1.5, -12.3],
  cheer: () => [0, 0, 10],
  biscuit: () => [PERCH[0], PERCH[1] + 0.2, PERCH[2]],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const kingPos = (f) => { const k = kingAt(f); return [k.x, 0, k.z]; };
const foolPos = (f) => { const w = foolAt(f); return [w.x, 0, w.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  morning: { cut: 'hard', raw: pushInCam({ subject: kingPos, a: 0, b: 132, d0: 4.6, d1: 3.4, h0: 1.6, h1: 1.5, lookOff: [0, 1.35, 0], fov0: 38, fov1: 32,
    dir: () => [0.55, 0.8] }) },
  hunt: { cut: 'hard', raw: keysCam({ keys: [
    { f: 133, pos: [6.8, 2.4, -6.2], look: [0, 1.2, -11], fov: 40 },
    { f: 268, pos: [5.6, 2.1, -7.4], look: [0, 1.2, -11], fov: 36, ease: 'surge' }] }) },
  square: { cut: 'hard', raw: bezierCam(
    [[16, 9, 30], [10, 5.5, 24], [6, 3.2, 19], [6.2, 2.4, 16.4]],
    [[0, 1.5, 8], [0, 1.0, 8], [0, 0.4, 10], [0, 2.2, -2]], 269, 414, 46, 40) },
  fool: { cut: 'hard', raw: pushInCam({ subject: foolPos, a: 415, b: 555, d0: 4.4, d1: 3.2, h0: 1.55, h1: 1.45, lookOff: [0, 1.4, 0], fov0: 38, fov1: 32,
    dir: () => [-0.5, 0.8] }) },
  parrot: { cut: 'hard', raw: keysCam({ keys: [
    { f: 556, pos: [4.6, 2.2, -9.6], look: [2.1, 1.6, -12.45], fov: 38 },
    { f: 710, pos: [4.0, 2.0, -10.2], look: [2.1, 1.6, -12.45], fov: 33, ease: 'surge' }] }) },
  plan: { cut: 'hard', raw: keysCam({ keys: [
    { f: 711, pos: [4.8, 2.2, -6.4], look: [0.7, 1.2, -10.4], fov: 40 },
    { f: 844, pos: [4.2, 2.0, -7.0], look: [0.7, 1.2, -10.4], fov: 36, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: foolPos, a: 845, b: 970, d0: 3.4, d1: 2.75, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  balcony: { cut: 'hard', raw: keysCam({ keys: [
    { f: 971, pos: [0.6, 1.0, 14.5], look: [0, 1.4, -4], fov: 42 },
    { f: 1030, pos: [0.4, 1.1, 12.5], look: [0, 1.4, 2], fov: 38 },
    { f: 1092, pos: [0.3, 1.2, 10.5], look: [0, 1.4, 7.6], fov: 32, ease: 'surge' }] }) },
  whisper: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1093, pos: [4.4, 2.0, -8.6], look: [2.0, 1.4, -11.9], fov: 38 },
    { f: 1180, pos: [4.2, 1.9, -9.2], look: [2.05, 1.55, -12.4], fov: 35 },
    { f: 1288, pos: [3.9, 1.9, -9.8], look: [2.1, 1.6, -12.45], fov: 32, ease: 'surge' }] }) },
  cheer: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1289, pos: [3.5, 2.8, 6.0], look: [0, -1.5, 18], fov: 46 },
    { f: 1340, pos: [2.5, 2.4, 9.5], look: [3.5, 0.5, 5.5], fov: 40 },
    { f: 1427, pos: [5.9, 2.0, 7.6], look: [4.6, 0.8, 3.5], fov: 34, ease: 'surge' }] }) },
  biscuit: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1428, pos: [4.8, 2.3, -9.4], look: [2.1, 1.6, -12.45], fov: 38 },
    { f: 1576, pos: [4.2, 2.1, -10.0], look: [2.1, 1.6, -12.45], fov: 33, ease: 'surge' }] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1577, pos: [5.9, 3.1, 9.3], look: [0.05, 3.0, -5], fov: 40 },
    { f: 1650, pos: [5.4, 3.2, 8.8], look: [0.02, 3.05, -5], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1651, pos: [5.4, 3.2, 8.8], look: [0.02, 3.05, -5], fov: 37 },
    { f: 1733, pos: [5.2, 3.25, 8.6], look: [0, 3.05, -5], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1092, a: 0.03 }, { f: 1410, a: 0.03 }],
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
  if (['square', 'hookq'].includes(S.id)) cinf = 1.4;
  if (['morning', 'dialogue', 'parrot', 'biscuit', 'whisper'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), p = parrotAt(f), ql = quillAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    parrotBeak: p.beak, parrotBob: p.bob, parrotTilt: p.headTilt,
    ringsK: ringsAt(f),
    quillX: ql.x, quillY: ql.y, quillZ: ql.z, quillK: ql.k, sealK: ql.sealK,
    biscuitK: biscuitAt(f).k,
    dustK: 0.05,
  };
  if (S.id === 'square') W.boardTitle = smooth(ramp(f, 372, 386)) * (1 - smooth(ramp(f, 398, 412)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1600, 1624));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: 0, grey: 0, ringsRate: ringsAt(f) };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { royalgold: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#8a2432', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#c98a5a' },
  fool: { jacket: '#7a2a6e', pants: '#2c4a6e', boots: '#241a12', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a' },
  court1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a' },
  court2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#8a5a34', moustache: '#241a12' },
  guard: { jacket: '#5a2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'shako', skin: '#a06a3c' },
};
const CROWD_JACKETS = ['#7a4a2a', '#2c4a6e', '#4a6a3a', '#8a2432', '#6a4a7a', '#3a6a5a', '#9a5a3a', '#5a5a5a'];
const CROWD_SKINS = ['#c98a5a', '#a06a3c', '#8a5a34', '#e8b88a'];
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const crowd = (id, idx, x, z, j, sk, cheer) => {
    const o = { jacket: j, pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#1c1410', skin: sk };
    const ph = q((f * 0.011 + idx * 0.13) % 1, 2);
    const opts = { expr: cheer ? 'laugh' : 'neutral', mode: 'stand', blink: blinkAt(f, 70 + idx), seed: 70 + idx, phase: ph };
    out.push({ id, x, y: -2.5, z, r: 0.32, ground: -2.5,
      actor: (T) => ({ key: 'crowd' + id + (cheer ? 'c' : '') + Math.floor(ph * 4), draw: (p) => T.bodyFront(p, o, opts), x, y: -2.5, z, ground: -2.5, tint, yaw: 0 }) });
  };
  const k = kingAt(f), w = foolAt(f), c1 = c1At(f);
  const kBase = { expr: 'stern', mode: kingMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 41), seed: 41 };
  const wBase = { expr: 'grin', mode: foolMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'morning': {
      // the king opens his mouth — and nothing comes out (shock, then pain)
      std('king', OUTFITS.king, { ...kBase, expr: f < 80 ? 'shock' : 'pained', headTilt: f >= 50 ? 0.1 : 0 }, k.x, k.z, { yaw: 0.1 });
      std('guard1', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -3, -11.5, {});
      std('guard2', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 3, -11.5, {});
      break;
    }
    case 'hunt': {
      std('king', OUTFITS.king, { ...kBase, expr: 'pained', headTilt: 0.16 }, k.x, k.z, { yaw: -0.9 });
      std('court1', OUTFITS.court1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'square': {
      std('king', OUTFITS.king, { ...kBase, expr: 'stern' }, 0, 7.6, {});
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
        const x = -12 + i * 3 + (r % 2 ? 1.5 : 0), z = 13 + r * 3;
        crowd(`c${r}${i}`, r * 9 + i, x, z, CROWD_JACKETS[(r * 9 + i) % 8], CROWD_SKINS[(r * 9 + i) % 4], false);
      }
      break;
    }
    case 'fool': {
      std('fool', OUTFITS.fool, { ...wBase, expr: 'grin', prop: ['point', 0.5] }, w.x, w.z, { yaw: -0.5 });
      std('king', OUTFITS.king, { ...kBase, expr: 'stern' }, k.x, k.z, { yaw: 0.5 });
      break;
    }
    case 'parrot': {
      std('fool', OUTFITS.fool, { ...wBase, expr: 'grin' }, w.x, w.z, { yaw: -0.4 });
      break;
    }
    case 'plan': {
      const bowK = smooth(ramp(f, 724, 748)) * (1 - smooth(ramp(f, 772, 796)));
      std('fool', OUTFITS.fool, { ...wBase, expr: 'grin', headTilt: q(bowK * 0.38, 2), prop: f >= 796 ? ['point', 0.85] : null }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { ...kBase, expr: 'stern' }, k.x, k.z, { yaw: -0.55 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the fool PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the king
      // only listens (his mouth never opens: narration stays voice-over).
      std('fool', OUTFITS.fool, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('grin', f) }, w.x, w.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { ...kBase, expr: 'stern' }, k.x, k.z, { yaw: -0.5 });
      break;
    }
    case 'balcony': {
      // the king steps onto the terrace and moves his lips SILENTLY —
      // mimeFace oscillates his mouth gently; the voice is the parrot's.
      std('king', OUTFITS.king, { mode: kingMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 41), seed: 41, ...mimeFace(f) }, k.x, k.z, {});
      std('court1', OUTFITS.court1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'whisper': {
      std('fool', OUTFITS.fool, { ...wBase, expr: 'grin', prop: ['point', 0.3] }, w.x, w.z, { yaw: 0.4 });
      break;
    }
    case 'cheer': {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
        const x = -12 + i * 3 + (r % 2 ? 1.5 : 0), z = 13 + r * 3;
        crowd(`c${r}${i}`, r * 9 + i, x, z, CROWD_JACKETS[(r * 9 + i) % 8], CROWD_SKINS[(r * 9 + i) % 4], f >= 1289 && f < 1340);
      }
      std('king', OUTFITS.king, { ...kBase, expr: 'relief' }, 0, 7.6, {});
      std('court1', OUTFITS.court1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'biscuit': {
      std('court1', OUTFITS.court1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      std('court2', OUTFITS.court2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 14, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 14, { h: 2.6, id: 'wallE' }),
  SOL.obb(THRONE.x, THRONE.z, 0, 0.9, 0.7, { h: 1.6, id: 'throne' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.aabb(-16, -2, 7.6, 8.4, { h: 1.1, id: 'balustradeW' }),
  SOL.aabb(2, 16, 7.6, 8.4, { h: 1.1, id: 'balustradeE' }),
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => SOL.circle(x, -13.2, 0.35, { h: 4.4, id: 'column' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
