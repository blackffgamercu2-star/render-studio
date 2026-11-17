// Shot plan for "वो लड़का जिसने सारे तारे गिन लिए" — stars-hindi (LIBRARY v4).
// Batch 7 topic 5, HINDI. Grade: Night Lamp. Setting: palace court at
// night + the palace pond where the sky's stars reflect. Story: a barefoot
// boy bets the king he can count every star before dawn by counting the
// stars reflected in the pond, marking each with a pebble. Twist: "The sky
// was too big to count. So I counted it where it was small enough to hold
// — in the water." Ends teasing tomorrow: the man who bought the wind.
//
// *** 2026-11-17 FIX-UP: STEM VERIFIED FINE — NO REGEN ***
// The previous builder PARKED this project claiming stem_hi.wav was
// unintelligible after 27.74s. That was a BROKEN slice-test pipeline,
// not the audio: faster-whisper base, whole file in ONE pass (language
// hi, word_timestamps), gives 217 words tiling 0.00-54.74s continuously,
// matching script_hi.txt word-for-word in order (L3 second half, L4,
// L7, L8 all present). md5 d4a48b8f2408e2c19e9d243500681b10.
// The old small-model CHUNKED words.json had dropped L3b+L4 (~13s) and
// shifted L5/L6/L7 ~13s early — every shot after f413 was mistimed.
// ALL shot boundaries below are the REAL whole-file ASR timings
// (words.json / timing.json, 8/8 lines verified, nothing missing).
//
// VERIFIED clause boundaries (words.json):
//   S1 drone   0-105    L1 boy enters the court (drone descends)
//   S2 court   106-177  L1 end — the boy faces the king
//   S3 bet     178-319  L2 DIALOGUE: "मैं आसमान के सारे तारे गिन दूँगा..."
//   S4 coins   320-574  L3 king laughs, coins out, astrologers shake heads
//   S5 walk    575-822  L4 boy walks to the pond, waits for first stars
//   S6 reveal  823-995  L5 stars reflected in the water (PAYOFF)
//   S7 count   996-1197 L6 counting, one pebble per star; sky pales
//   S8 twist   1198-1425 L7 DIALOGUE (two quoted spans, narration gap 1256-1297)
//   S9 hookq   1426-1499 L8 wind hook, boy with the gold
//   S10 hookq2 1500-1560 hook board fades in
//   S11 hook   1561-1642 hook board HELD to the literal last frame
// GRADE (FILTER_VFX_LIGHTING pack): Night Lamp throughout — deep blue
// ambient, warm pools only around the palace lanterns; the sky-paling beat
// (end of S6) blends toward a pale dawn. Signature VFX: star glints +
// shimmer on the pond water, fireflies/dust motes in the moonlight, moving
// sheen + glints on the gold coins.
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

export const FPS = 30, TOTAL = 1643, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 105, light: 'night' },
  { id: 'court', a: 106, b: 176, light: 'night' },
  { id: 'bet', a: 177, b: 319, light: 'night' },
  { id: 'coins', a: 320, b: 574, light: 'night' },
  { id: 'walk', a: 575, b: 822, light: 'night' },
  { id: 'reveal', a: 823, b: 995, light: 'night' },
  { id: 'count', a: 996, b: 1197, light: 'night' },
  { id: 'twist', a: 1198, b: 1425, light: 'dawn' },
  { id: 'hookq', a: 1426, b: 1499, light: 'dawn' },
  { id: 'hookq2', a: 1500, b: 1560, light: 'dawn' },
  { id: 'hook', a: 1561, b: 1642, light: 'dawn' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (Night Lamp) ----------
export const LIGHTS = {
  night: { az: 250, el: 38, sky: '#16233c', ground: '#1c2436', hemi: 0.85, sun: '#cdd8ff', sunI: 1.6, fog: '#0c1424', fogNear: 46, fogFar: 330,
    skyTop: '#060a18', skyHor: '#1a2a4a', sunDisc: '#f4f6ff', sunSize: 0.006, sat: 0.95, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#dfe8ff',
    waterDeep: '#04101e', waterShal: '#0a2438', glint: '#cfe4ff' },
  dawn: { az: 250, el: 22, sky: '#7a7f96', ground: '#3a3644', hemi: 1.0, sun: '#ffd9a8', sunI: 2.0, fog: '#8a7f96', fogNear: 42, fogFar: 300,
    skyTop: '#3a4a6e', skyHor: '#e8b48a', sunDisc: '#ffe9c0', sunSize: 0.005, sat: 1.0, vig: 0.28, shadowExt: 22, aurora: 0, gain: '#f2e2c8',
    waterDeep: '#0a1c2e', waterShal: '#1c3a50', glint: '#ffe9c0' },
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
  // the sky pales at the end of the count beat (clause boundary L6->L7):
  // night blends to dawn across the last 52 frames of 'count'.
  if (S.id === 'count') return blendLight(LIGHTS.night, LIGHTS.dawn, smooth(ramp(f, 1145, 1197)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const BOARD_POS = [0, 3.1, -6];
export const PLATFORM = { x: 0, z: 2, r: 1.35, top: 0.18 };
export const POND = { x: 0, z: 8.5, rx: 4.2, rz: 2.8, y: 0.02 };
export const BOY_KNEEL = [0, 5.9];
export const PEBBLE_ROW = { x0: -2.4, x1: 2.4, z: 5.45, y: 0.02, n: 16 };
export const COIN_PILE = [0.9, 0.18, 2.0];
const COIN_TABLE = [4.4, 7.2];

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// boy: court (-2.5, 5.5) for the bet/coins -> walks to the pond during
// 'walk' (575-822, L4 — the voice walks him there) -> kneels at the pond
// edge (0, 5.9) for reveal+count -> stands + turns for the twist (1198+).
const BOY_KEYS = [
  [0, -2.5, 5.5], [574, -2.5, 5.5], [640, -1.2, 5.7], [822, 0, 5.9],
  [1197, 0, 5.9], [1225, 0.4, 5.4], [1642, 0.4, 5.4],
];
const KING_KEYS = [
  [0, 2.6, 5.2], [1197, 2.6, 5.2], [1225, 1.9, 4.7], [1642, 1.9, 4.7],
];
export const boyAt = (f) => { const [x, z] = walkKeys(BOY_KEYS, f); return { x, z }; };
export const kingAt = (f) => { const [x, z] = walkKeys(KING_KEYS, f); return { x, z }; };
export const boyMode = (f) => {
  if (f >= 575 && f < 823) return 'stroll';
  if (f >= 823 && f < 1198) return 'sit';   // kneeling at the pond edge
  return 'stand';
};
// pebbles: one placed per counted star during 'count' (996-1197); each
// pebble rests ON the bank (y = PEBBLE_ROW.y) in a neat row — placed, never
// dropped.
export const pebbleK = (f) => {
  if (f < 996) return 0;
  if (f > 1197) return 1;
  return clamp((f - 996) / (1197 - 996), 0, 1);
};
export const pebbleCount = (f) => Math.round(pebbleK(f) * PEBBLE_ROW.n);
// stars in the water: appear with the reveal (823), shimmer through the
// count, fade as the sky pales at the end of the count.
export const starK = (f) => {
  if (f < 823) return 0;
  if (f < 879) return smooth(ramp(f, 823, 879));
  if (f < 1145) return 1;
  return 1 - smooth(ramp(f, 1145, 1197)) * 0.55;
};
// sky stars are always up (night); they pale with the dawn blend.
export const skyStarK = (f) => (f < 1145 ? 1 : 1 - smooth(ramp(f, 1145, 1197)) * 0.6);
// gold sheen glints: coins named (320-574), paid (1256+).
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(330, 400, 0.9); pulse(1256, 1290, 1); pulse(1500, 1560, 0.4);
  return s;
};
// the gold sack travels from the coin pile to the boy in the twist beat.
export const sackAt = (f) => {
  // the gold travels to the boy while he says "सोना लेते हुए" (1256-1297).
  const u = smooth(ramp(f, 1256, 1284));
  return { x: lerp(COIN_PILE[0], 0.4, u), y: lerp(0.55, 1.05, u) + Math.sin(u * Math.PI) * 0.12, z: lerp(COIN_PILE[2], 5.4, u), k: ramp(f, 1252, 1260) * (1 - ramp(f, 1284, 1289)) };
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const fireflyAt = (f) => segMax(f, [[0, 60, 1642, 1642, 0.5]]);
export const shimmerAt = (f) => segMax(f, [[823, 859, 1145, 1197, 1]]);

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  court: () => { const b = boyAt(140); return [b.x, 1.1, b.z]; },
  bet: () => { const b = boyAt(250); return [b.x, 1.2, b.z]; },
  coins: () => [0.9, 0.6, 2.0],
  walk: () => { const b = boyAt(700); return [b.x, 1.2, b.z]; },
  reveal: () => [0, 0.4, 8.5],
  count: () => [0, 0.5, 6.4],
  twist: () => { const b = boyAt(1300); return [b.x, 1.3, b.z]; },
  hookq: () => { const b = boyAt(1450); return [b.x, 1.2, b.z]; },
  hookq2: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const boyPos = (f) => { const b = boyAt(f); return [b.x, 0, b.z]; };
const pondPos = () => [POND.x, 0, POND.z];
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[22, 13, 27], [13, 7.5, 19], [9, 4.5, 15.5], [7.4, 3.1, 13.4]],
    [[0, 3.0, -6], [0, 2.2, -2], [0, 1.2, 1.6], [0, 1.0, 2.2]], 0, 105, 44, 40) },
  court: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 106, b: 176, d0: 5.6, d1: 4.6, h0: 1.55, h1: 1.45, lookOff: [0, 1.15, 0], fov0: 40, fov1: 36,
    dir: () => [0.62, 0.72] }) },
  bet: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 178, b: 319, d0: 3.6, d1: 2.8, h0: 1.5, h1: 1.42, lookOff: [0, 1.2, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  coins: { cut: 'hard', raw: pushInCam({ subject: () => [0.9, 0, 2.0], a: 320, b: 574, d0: 5.2, d1: 4.2, h0: 1.7, h1: 1.5, lookOff: [0, 0.5, 0], fov0: 36, fov1: 32,
    dir: () => [0.55, 0.8] }) },
  walk: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 575, b: 822, d0: 5.6, d1: 4.6, h0: 1.55, h1: 1.45, lookOff: [0, 1.15, 0], fov0: 40, fov1: 36,
    dir: () => [0.62, 0.72] }) },
  reveal: { cut: 'hard', raw: pushInCam({ subject: pondPos, a: 823, b: 995, d0: 7.0, d1: 5.6, h0: 3.4, h1: 2.8, lookOff: [0, 0.2, 0], fov0: 40, fov1: 34,
    dir: () => [0.3, 0.95] }) },
  count: { cut: 'hard', raw: keysCam({ keys: [
    { f: 996, pos: [-5.8, 2.5, 12.6], look: [0, 0.4, 5.6], fov: 40 },
    { f: 1197, pos: [-5.2, 2.3, 12.0], look: [0, 0.4, 5.6], fov: 38, ease: 'surge' }] }) },
  twist: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 1198, b: 1425, d0: 3.6, d1: 3.1, h0: 1.5, h1: 1.45, lookOff: [0, 1.25, 0], fov0: 32, fov1: 30,
    dir: () => [0.45, 0.85] }) },
  // L8 hook: slow arc around the boy + pond so the camera keeps moving.
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1426, pos: [5.4, 2.4, 12.4], look: [0.2, 1.0, 5.6], fov: 38 },
    { f: 1499, pos: [-4.6, 2.2, 12.0], look: [0, 1.0, 5.8], fov: 36, ease: 'surge' }] }) },
  hookq2: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1500, pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: 1560, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1561, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1642, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 823, a: 0.03 }, { f: 1256, a: 0.03 }],
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
  if (['drone', 'hookq2'].includes(S.id)) cinf = 1.4;
  if (['bet', 'twist', 'count', 'walk'].includes(S.id)) cinf = 3.6;
  if (S.id === 'reveal') cinf = 2.2;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), sk = sackAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    starK: starK(f), skyStarK: skyStarK(f), shimmerK: shimmerAt(f),
    pebbleN: pebbleCount(f), pebbleK: pebbleK(f),
    sackX: sk.x, sackY: sk.y, sackZ: sk.z, sackK: sk.k,
    glintK: glintAt(f), fireflyK: fireflyAt(f),
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 28, 45)) * (1 - smooth(ramp(f, 50, 62)));
  if (S.id === 'hookq2') W.boardHook = smooth(ramp(f, 1540, 1560));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: shimmerAt(f), grey: 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { night: '#cdd8ff', dawn: '#f2e2c8' };
const tintFor = (S) => TINT[S.light] || '#cdd8ff';
export const OUTFITS = {
  boy: { jacket: '#7a6a4a', pants: '#5a4a38', boots: '#a06a3c', hat: 'hair', hair: '#1c1410', skin: '#a06a3c', build: 'kid' },
  king: { jacket: '#8a2432', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#c98a5a' },
  astro1: { jacket: '#3a3a5a', pants: '#2a2a3a', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a', moustache: '#241a12' },
  astro2: { jacket: '#2c4a3a', pants: '#2a2a26', boots: '#1c1712', hat: 'cap', cap: '#7a6a9a', skin: '#8a5a34' },
  guard: { jacket: '#5a2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'shako', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const b = boyAt(f), k = kingAt(f);
  const bBase = { expr: 'smile', mode: boyMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('boy', OUTFITS.boy, { ...bBase, mode: 'stand' }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      std('astro1', OUTFITS.astro1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, -4.6, 0.8, { yaw: 0.4 });
      std('astro2', OUTFITS.astro2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 4.8, 3.2, { yaw: -0.3 });
      std('guard1', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -3, -11.5, {});
      std('guard2', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 3, -11.5, {});
      break;
    }
    case 'court': {
      std('boy', OUTFITS.boy, { ...bBase, mode: 'stand' }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      std('astro1', OUTFITS.astro1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'bet': {
      // DIALOGUE 1 (VERIFIED timing 177-319): the boy PERFORMS his bet —
      // mouth driven by the stem inside the speak segment, closed outside
      // it; the king only listens.
      std('boy', OUTFITS.boy, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      break;
    }
    case 'coins': {
      // L3: king laughs + sets out the coins; astrologers shake heads.
      // The boy stands at court watching — he walks to the pond in 'walk'.
      std('boy', OUTFITS.boy, { ...bBase, mode: 'stand' }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', 0.6] }, k.x, k.z, { yaw: -0.5 });
      std('astro1', OUTFITS.astro1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'walk': {
      // L4 (VERIFIED): the boy walks to the pond and waits for the first
      // stars — planted feet, strolling in place along BOY_KEYS.
      std('boy', OUTFITS.boy, { ...bBase, mode: 'stroll', phase: q((f * 0.011) % 1, 2) }, b.x, b.z, { yaw: 0 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      std('astro1', OUTFITS.astro1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'reveal': {
      // the boy kneels at the pond edge, back to camera, facing the water
      std('boy', OUTFITS.boy, { ...bBase, mode: 'sit', headTilt: 0.1 }, b.x, b.z, { yaw: 0 });
      break;
    }
    case 'count': {
      // kneeling, counting: the boy points at each star as a pebble is placed
      const tick = Math.floor(pebbleK(f) * PEBBLE_ROW.n);
      std('boy', OUTFITS.boy, { ...bBase, mode: 'sit', prop: ['point', 0.6 + 0.2 * Math.sin(tick * 1.7)] }, b.x, b.z, { yaw: 0 });
      break;
    }
    case 'twist': {
      // DIALOGUE 2 — VERIFIED whole-file ASR (1198-1425): two quoted spans
      // (1198-1256, 1297-1425) with a narration gap (1256-1297, mouth
      // closed). The boy performs the twist line; the king listens.
      std('boy', OUTFITS.boy, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      break;
    }
    case 'hookq': {
      std('boy', OUTFITS.boy, { ...bBase, mode: 'stand' }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      break;
    }
    case 'hookq2': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground ----------
export const STATICS = [
  SOL.circle(PLATFORM.x, PLATFORM.z, PLATFORM.r, { h: PLATFORM.top, id: 'platform' }),
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 12, { h: 2.6, id: 'wallE' }),
  SOL.obb(COIN_TABLE[0], COIN_TABLE[1], 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
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
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  // pebbles rest ON the bank: ground-checked, zero hover allowed
  const n = pebbleCount(f);
  for (let i = 0; i < n; i++) items.push({ id: `pebble${i}`, y: PEBBLE_ROW.y, ground: PEBBLE_ROW.y, maxHover: 0.01 });
  return items;
};
