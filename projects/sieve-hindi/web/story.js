// Shot plan for "वो औरत जो छलनी में पानी लाई" — sieve-hindi (LIBRARY v4).
// Batch 7 topic 2, HINDI. A woman bets the village she can carry river
// water home in a sieve; she seals it hole by hole with beeswax, dips it,
// the water sits like in a bowl, and she carries it home. Twist: "The
// sieve never held the water. The wax did." Grade: Golden Hour, sunrise,
// dry village + riverbank. Voice stem: 42.851 s, 30 fps, TOTAL 1286;
// timings from faster-whisper small word alignment (words.json, align_hi2).
// Scene changes ONLY at clause boundaries (script phrases):
//   S1 drone  0-153    L1 setup: dry village, the bet is made
//   S2 bet    154-257  L2 DIALOGUE 1: "मैं नदी का पानी छलनी में घर ले जाऊँगी..."
//   S3 laugh  258-364  L3 the village laughs — a sieve is a net of holes
//   S4 river  365-490  L4 morning: she walks to the river, sieve + wax dibiya
//   S5 wax    491-657  L5 she warms wax in her palms, rubs it hole by hole
//   S6 dip    658-778  L6 PAYOFF: dip, lift — water sits like in a bowl
//   S7 carry  779-936  L7 she walks home through the village, crowd follows
//   S8 reveal 937-1108 L8 DIALOGUE 2: "छलनी ने पानी कभी नहीं रोका... मोम ने रोका।"
//   S9 hookq  1109-1239 L9 the old fisherman hook (spoken; board fades in)
//   S10 hook  1240-1285 hook board held at FULL opacity to the literal last frame
// Dialogue speak segments (quoted words only; tags stay closed):
//   bet:    [154,209] + [224,258]  (tag "उसने कहा" f210-223 closed)
//   reveal: [937,981] + [1026,1108] (tag "उसने भरी छलनी रखते हुए कहा" f982-1025 closed)
// GRADE (FILTER_VFX_LIGHTING pack): Golden Hour throughout; hook shifts to
// dusk. Signature VFX: wax glints (warm gold), dip splash + ripples + foam,
// water glints on the held sieve, sun rays converging on the lifted sieve.
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

export const FPS = 30, TOTAL = 1286, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 153, light: 'gold' },
  { id: 'bet', a: 154, b: 257, light: 'gold' },
  { id: 'laugh', a: 258, b: 364, light: 'gold' },
  { id: 'river', a: 365, b: 490, light: 'gold' },
  { id: 'wax', a: 491, b: 657, light: 'gold' },
  { id: 'dip', a: 658, b: 778, light: 'gold' },
  { id: 'carry', a: 779, b: 936, light: 'gold' },
  { id: 'reveal', a: 937, b: 1108, light: 'gold' },
  { id: 'hookq', a: 1109, b: 1239, light: 'dusk' },
  { id: 'hook', a: 1240, b: 1285, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (Golden Hour; dusk for the hook) ----------
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
  if (S.id === 'hookq') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, 1109, 1167)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const BOARD_POS = [0, 3.1, -6];
export const PLATFORM = { x: 0, z: 2, r: 1.35, top: 0.18 };          // home stone: sieve's final rest
export const RIVER_STONE = { x: 2.2, z: -10.2, r: 0.9, top: 0.55 }; // waxing stone at the riverbank
export const WAXPOT_REST = [2.9, RIVER_STONE.top, -9.9];              // wax dibiya rests on the stone
export const DIP_POS = [-0.4, -13.2];                                 // where the sieve dips (in the water, past edge z=-13)
export const HUTS = [
  { x: -8.5, z: 5.5, s: 1.0, wall: 'plaster' },
  { x: 8.5, z: 6.5, s: 1.1, wall: 'planks' },
  { x: -6.5, z: -20.5, s: 1.0, wall: 'stone' },
];
export const PALMS = [[-12, -11], [12, -11], [-13, 2], [13, 2]];

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// Woman: village (-2.5,6.5) -> riverbank (-0.4,-9.2) -> water edge (-0.4,-12.0)
// -> home beside the platform (-1.2,3.6). Paths routed around the platform
// collider and the board posts (collision gate verified).
const WOMAN_KEYS = [
  [0, -2.5, 6.5], [364, -2.5, 6.5], [430, -2.9, 2.8], [490, -0.4, -9.2],
  [657, -0.4, -9.2], [700, -0.4, -12.6], [778, -0.4, -12.6],
  [860, -2.6, 0.5], [936, -1.2, 3.6], [1285, -1.2, 3.6],
];
const V1_KEYS = [
  [0, -4.3, 5.2], [364, -4.3, 5.2], [430, -5.2, 2.0], [490, 0.4, -7.0], [778, 0.4, -7.0], [830, 0.4, -7.0], [880, -3.6, -0.5], [936, -4.2, 6.2], [1285, -4.2, 6.2],
];
const V2_KEYS = [
  [0, -5.6, 7.2], [364, -5.6, 7.2], [490, 2.8, -8.6], [778, 2.8, -8.6], [936, 2.2, 6.8], [1285, 2.2, 6.8],
];
const V3_KEYS = [
  [0, 2.6, 4.2], [364, 2.6, 4.2], [490, 4.6, -8.2], [778, 4.6, -8.2], [936, 3.0, 7.0], [1285, 3.0, 7.0],
];
export const womanAt = (f) => { const [x, z] = walkKeys(WOMAN_KEYS, f); return { x, z }; };
export const v1At = (f) => { const [x, z] = walkKeys(V1_KEYS, f); return { x, z }; };
export const v2At = (f) => { const [x, z] = walkKeys(V2_KEYS, f); return { x, z }; };
export const v3At = (f) => { const [x, z] = walkKeys(V3_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const womanMode = (f) => strolling(f, [[365, 490], [658, 700], [779, 936]]) ? 'stroll' : 'stand';
export const crowdMode = (f) => strolling(f, [[365, 490], [779, 936]]) ? 'stroll' : 'stand';
export const v1Mode = (f) => strolling(f, [[365, 490], [830, 936]]) ? 'stroll' : 'stand';  // v1 lags: holds at the bank till f830 so the carry paths never cross

// ---------- the sieve (hero prop): it NEVER travels alone —
// while carried it rides at the woman's hand (fixed offset from womanAt),
// and it is set down only when she has arrived at the stone / platform.
// Rests: home platform (f<365), river stone (f>=499), platform again (f>=921).
const handSieve = (f) => { const w = womanAt(f); return { x: w.x + 0.55, y: 0.55, z: w.z + 0.15 }; };   // low at her side — never covers her face
const handSieveFront = (f) => { const w = womanAt(f); return { x: w.x, y: 0.95, z: w.z - 0.55 }; };
const handSieveCarry = (f) => { const w = womanAt(f); return { x: w.x + 0.55, y: 0.6, z: w.z + 0.15 }; };
const handWax = (f) => { const w = womanAt(f); return { x: w.x - 0.4, y: 0.5, z: w.z + 0.35 }; };
export const sieveAt = (f) => {
  // she HOLDS the sieve from the first frame (bet, laugh, walk to the river)
  // — the voice names it in L2/L4, so it must be on screen in her hand.
  if (f <= 479) { const h = handSieve(f); return { x: h.x, y: h.y, z: h.z, carried: 1, resting: 0 }; }
  if (f <= 498) {
    const u = smooth(ramp(f, 480, 498)), h = handSieve(480);
    return { x: lerp(h.x, RIVER_STONE.x, u), y: lerp(h.y, RIVER_STONE.top, u) + Math.sin(u * Math.PI) * 0.1, z: lerp(h.z, RIVER_STONE.z, u), carried: 1, resting: 0 };
  }
  if (f <= 657) return { x: RIVER_STONE.x, y: RIVER_STONE.top, z: RIVER_STONE.z, carried: 0, resting: 1 };
  if (f <= 690) { const h = handSieveFront(f); return { x: h.x, y: h.y, z: h.z, carried: 1, resting: 0 }; }
  if (f <= 715) {
    const u = smooth(ramp(f, 691, 715)), h = handSieveFront(690);
    return { x: lerp(h.x, DIP_POS[0], u), y: lerp(h.y, 0.12, u), z: lerp(h.z, DIP_POS[1], u), carried: 1, resting: 0 };
  }
  if (f <= 745) {
    const u = smooth(ramp(f, 716, 745));   // lifted — the water comes up WITH it
    return { x: DIP_POS[0], y: lerp(0.12, 1.0, u), z: DIP_POS[1], carried: 1, resting: 0 };
  }
  if (f <= 778) return { x: DIP_POS[0], y: 1.0, z: DIP_POS[1], carried: 1, resting: 0 };
  if (f <= 900) { const h = handSieveCarry(f); return { x: h.x, y: h.y, z: h.z, carried: 1, resting: 0 }; }
  if (f <= 920) {
    const u = smooth(ramp(f, 901, 920)), h = handSieveCarry(901);
    return { x: lerp(h.x, PLATFORM.x, u), y: lerp(h.y, PLATFORM.top, u), z: lerp(h.z, PLATFORM.z, u), carried: 0, resting: 0 };
  }
  return { x: PLATFORM.x, y: PLATFORM.top, z: PLATFORM.z, carried: 0, resting: 1 };
};
export const waxPotAt = (f) => {
  // the wax dibiya rides in her other hand from the first frame too.
  if (f <= 479) { const h = handWax(f); return { x: h.x, y: h.y, z: h.z, resting: 0, ground: 0 }; }
  if (f <= 498) {
    const u = smooth(ramp(f, 480, 498)), h = handWax(480);
    return { x: lerp(h.x, WAXPOT_REST[0], u), y: lerp(h.y, WAXPOT_REST[1], u) + Math.sin(u * Math.PI) * 0.1, z: lerp(h.z, WAXPOT_REST[2], u), resting: 0, ground: 0 };
  }
  return { x: WAXPOT_REST[0], y: WAXPOT_REST[1], z: WAXPOT_REST[2], resting: 1, ground: RIVER_STONE.top };
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const waterAt = (f) => smooth(ramp(f, 716, 745));                       // water sits in the sieve after the lift
export const waxAt = (f) => segMax(f, [[500, 520, 630, 657, 1]]);               // hands rubbing wax, hole by hole
export const dipAt = (f) => segMax(f, [[691, 700, 706, 730, 1]]);               // splash on the dip
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(500, 657, 0.8);   // warm wax glints while she rubs
  pulse(716, 778, 1);     // water glints on the lifted sieve
  pulse(800, 860, 0.6);   // glints on the carried sieve
  pulse(1000, 1108, 0.7); // "मोम ने रोका" — the sealed sieve glints
  return s;
};
export const raysAt = (f) => segMax(f, [[716, 745, 760, 778, 1], [1040, 1060, 1085, 1108, 0.5]]);

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  bet: () => { const w = womanAt(200); return [w.x, 1.2, w.z]; },
  laugh: () => [-1.5, 1.2, 6],
  river: () => { const w = womanAt(430); return [w.x, 1.1, w.z]; },
  wax: () => [RIVER_STONE.x, 0.7, RIVER_STONE.z],
  dip: () => [DIP_POS[0], 0.6, DIP_POS[1]],
  carry: () => { const w = womanAt(860); return [w.x, 1.1, w.z]; },
  reveal: () => { const w = womanAt(1000); return [w.x, 1.45, w.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const sievePos = (f) => { const p = sieveAt(f); return [p.x, p.y, p.z]; };
const womanPos = (f) => { const w = womanAt(f); return [w.x, 0, w.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[24, 14, 28], [14, 8, 20], [9, 4.6, 15.5], [7.2, 3.2, 13.2]],
    [[0, 3.0, -6], [0, 2.2, -2], [0, 1.2, 1.6], [-1, 1.1, 3.5]], 0, 153, 44, 40) },
  bet: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 154, b: 257, d0: 5.4, d1: 4.1, h0: 1.55, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 40, fov1: 34,
    dir: () => [0.62, 0.72] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 258, pos: [7.5, 3.2, 13.5], look: [-1.5, 1.2, 6], fov: 42 },
    { f: 364, pos: [6.9, 3.0, 12.9], look: [-1.5, 1.2, 6], fov: 40, ease: 'surge' }] }) },
  river: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 365, b: 490, d0: 6.8, d1: 5.6, h0: 1.9, h1: 1.6, lookOff: [0, 1.1, 0], fov0: 42, fov1: 38,
    dir: () => [0.6, 0.75] }) },
  wax: { cut: 'hard', raw: staticTrackCam({ pos: [-1.8, 1.9, -5.2], subject: sievePos, lookOff: [0, 0.35, 0], fov: 36 }) },
  dip: { cut: 'hard', raw: pushInCam({ subject: sievePos, a: 658, b: 778, d0: 6.4, d1: 5.0, h0: 1.9, h1: 1.5, lookOff: [0, 0.35, 0], fov0: 40, fov1: 36,
    dir: () => [0.55, 0.8] }) },
  carry: { cut: 'hard', raw: keysCam({ keys: [
    { f: 779, pos: [6.5, 3.0, 9.5], look: [0, 1.0, -5], fov: 42 },
    { f: 936, pos: [5.4, 2.7, 9.0], look: [-0.8, 1.0, 2.8], fov: 38, ease: 'surge' }] }) },
  reveal: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 937, b: 1108, d0: 3.4, d1: 2.75, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1109, pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: 1239, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1240, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1285, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 745, a: 0.03 }, { f: 910, a: 0.03 }],
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
  if (['wax', 'dip', 'reveal'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), p = sieveAt(f), wp = waxPotAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    sieveX: p.x, sieveY: p.y, sieveZ: p.z, sieveCarried: p.carried,
    waxPotX: wp.x, waxPotY: wp.y, waxPotZ: wp.z,
    waxK: waxAt(f), waterK: waterAt(f), dipK: dipAt(f),
    raysK: raysAt(f), sieveGlint: glintAt(f),
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 40)) * (1 - smooth(ramp(f, 55, 72)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1140, 1165));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: dipAt(f), steamRate: 0, shimmerRate: glintAt(f), grey: 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  woman: { jacket: '#7a5a40', pants: '#5a4636', boots: '#3a2a1c', hat: 'hair', hair: '#2c1a10', skin: '#a06a3c' },
  v1: { jacket: '#6a5a3a', pants: '#3a3230', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#c98a5a' },
  v2: { jacket: '#4a5a6a', pants: '#2a3242', boots: '#1c1712', hat: 'hair', hair: '#3a2a1a', skin: '#8a5a34', moustache: '#241a12' },
  v3: { jacket: '#5a6a4a', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#c8a03a', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const w = womanAt(f), v1 = v1At(f), v2 = v2At(f), v3 = v3At(f);
  const wBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  const strollOpts = (base) => ({ ...base, mode: womanMode(f), phase: q((f * 0.011) % 1, 2) });
  const crowdOpts = (o, expr, modeFn = crowdMode) => ({ expr, mode: modeFn(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51 });
  switch (S.id) {
    case 'drone': {
      std('woman', OUTFITS.woman, { ...wBase }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.3 });
      std('v3', OUTFITS.v3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, v3.x, v3.z, { yaw: 0.4 });
      break;
    }
    case 'bet': {
      // DIALOGUE 1: the woman PERFORMS her bet — mouth driven by the stem
      // inside the two quoted spans, firmly closed on the tag "उसने कहा".
      std('woman', OUTFITS.woman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, prop: ['point', 0.55], ...speakFace('smile', f) }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.3 });
      break;
    }
    case 'laugh': {
      std('woman', OUTFITS.woman, { ...wBase, expr: 'neutral', headTilt: 0.1, prop: ['point', 0.55] }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.3 });
      std('v3', OUTFITS.v3, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, v3.x, v3.z, { yaw: 0.4 });
      break;
    }
    case 'river': {
      std('woman', OUTFITS.woman, strollOpts({ ...wBase, prop: ['point', 0.5] }), w.x, w.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, crowdOpts(OUTFITS.v1, 'neutral', v1Mode), v1.x, v1.z, { yaw: -0.3 });
      std('v2', OUTFITS.v2, crowdOpts(OUTFITS.v2, 'neutral'), v2.x, v2.z, { yaw: -0.3 });
      std('v3', OUTFITS.v3, crowdOpts(OUTFITS.v3, 'neutral'), v3.x, v3.z, { yaw: 0.4 });
      break;
    }
    case 'wax': {
      std('woman', OUTFITS.woman, { ...wBase, expr: 'neutral', prop: ['point', 0.7] }, w.x, w.z, { yaw: 0.85 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.6 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.9 });
      std('v3', OUTFITS.v3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, v3.x, v3.z, { yaw: -0.7 });
      break;
    }
    case 'dip': {
      const lifted = f >= 716;
      std('woman', OUTFITS.woman, { ...wBase, mode: womanMode(f), phase: q((f * 0.011) % 1, 2), expr: lifted ? 'smile' : 'neutral', prop: ['point', 0.8] }, w.x, w.z, { yaw: 0.85 });
      std('v1', OUTFITS.v1, { expr: lifted ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.6 });
      std('v2', OUTFITS.v2, { expr: lifted ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.9 });
      std('v3', OUTFITS.v3, { expr: lifted ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, v3.x, v3.z, { yaw: -0.7 });
      break;
    }
    case 'carry': {
      std('woman', OUTFITS.woman, strollOpts({ ...wBase }), w.x, w.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, crowdOpts(OUTFITS.v1, 'neutral', v1Mode), v1.x, v1.z, { yaw: -0.3 });
      std('v2', OUTFITS.v2, crowdOpts(OUTFITS.v2, 'neutral'), v2.x, v2.z, { yaw: -0.3 });
      std('v3', OUTFITS.v3, crowdOpts(OUTFITS.v3, 'neutral'), v3.x, v3.z, { yaw: 0.4 });
      break;
    }
    case 'reveal': {
      // DIALOGUE 2: the woman PERFORMS the twist — mouth open on the two
      // quoted spans, closed on the tag "उसने भरी छलनी रखते हुए कहा".
      std('woman', OUTFITS.woman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.3 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(PLATFORM.x, PLATFORM.z, PLATFORM.r, { h: PLATFORM.top, id: 'platform' }),
  SOL.circle(RIVER_STONE.x, RIVER_STONE.z, RIVER_STONE.r, { h: RIVER_STONE.top, id: 'riverstone' }),
  SOL.aabb(-10, -7, 4.3, 6.7, { h: 3.0, id: 'hutW' }),
  SOL.aabb(7, 10, 5.3, 7.7, { h: 3.0, id: 'hutE' }),
  SOL.aabb(-8, -5, -21.5, -19.5, { h: 3.0, id: 'hutFar' }),
  SOL.aabb(-18, 18, -23.5, -22.5, { h: 1.2, id: 'farbank' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(-3, -12.6, 0.5, { h: 0.8, id: 'bankstone1' }),
  SOL.circle(3.5, -12.8, 0.6, { h: 0.9, id: 'bankstone2' }),
  SOL.circle(-1.5, -13.4, 0.4, { h: 0.6, id: 'bankstone3' }),
  ...PALMS.map(([x, z]) => SOL.circle(x, z, 0.35, { h: 4.5, id: 'palm' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const p = sieveAt(f);
  // the sieve is ground-checked whenever it RESTS (home platform top 0.18
  // / river stone top 0.55); while carried it is transitional (in her
  // hands) and unchecked; the 901-920 set-down is transitional too.
  if (p.resting) items.push({ id: 'sieve', y: p.y, ground: f > 920 ? PLATFORM.top : RIVER_STONE.top, maxHover: 0.03 });  // rests: stone (499-657) / platform (921+)
  const wp = waxPotAt(f);
  if (wp.resting) items.push({ id: 'waxpot', y: wp.y, ground: wp.ground, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
