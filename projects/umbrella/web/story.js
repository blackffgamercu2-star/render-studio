// Shot plan for "The Umbrella That Knew the Rain" — umbrella (Batch 6 T3, EN)
// LIBRARY v4: speak.js dialogue performance + materials v4, camrig smooth
// tracking rig + solid colliders. Template = turtle-badge / island-car3.
// Voice stem: 49.411 s, 30 fps, TOTAL 1483; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1  0.00-4.24  One umbrella...minutes later.     S7  28.74-31.86 It felt the wet air...
//   S2  4.60-7.78  seller never touched...wait.      S8  32.48-36.04 evening...fog rolled in.
//   S3  8.30-11.66 snapped open...sold out.          S9  36.64-37.88 refunded every buyer double.
//   S4  12.38-17.9 rival...No string. Nothing.       S10 38.62-41.12 DIALOGUE (seller, fog evening)
//   S5  18.46-23.26 watchmaker...strand of hair.     S11 41.80-43.94 honesty...more famous.
//   S6  23.82-28.48 hair stretches...sprang open.    S12 44.60-49.00 But tomorrow...village?
// GRADE (FILTER_VFX_LIGHTING pack): Monsoon Grey throughout — desaturated
// blue-grey morning, darker rain arc, lamp-lit river-fog evening, grey
// morning payoff, dusk hook. Boards are never graded (basic material).
// Signature VFX: umbrella spring-pops (mechanical, overshoot settle),
// layered rain lit in the grey light + ground splashes, wet-ground sheen,
// rolling river fog (smoke/mist), market cloth/awnings in GUSTS, lamp glows.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, followCam, pushInCam, staticTrackCam, keysCam } from './camrig.js';
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

export const FPS = 30, TOTAL = 1483, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 137, light: 'grey' },
  { id: 'wait', a: 138, b: 248, light: 'grey' },
  { id: 'pop1', a: 249, b: 370, light: 'grey' },
  { id: 'rival', a: 371, b: 552, light: 'grey' },
  { id: 'reveal', a: 553, b: 713, light: 'grey' },
  { id: 'rain', a: 714, b: 861, light: 'rain' },
  { id: 'wetair', a: 862, b: 973, light: 'rain' },
  { id: 'fog', a: 974, b: 1098, light: 'fog' },
  { id: 'refund', a: 1099, b: 1157, light: 'fog' },
  { id: 'dialogue', a: 1158, b: 1253, light: 'fog' },
  { id: 'fame', a: 1254, b: 1337, light: 'grey2' },
  { id: 'hookq', a: 1338, b: 1420, light: 'dusk' },
  { id: 'hook', a: 1421, b: 1482, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (Monsoon Grey family) ----------
const WATER = { waterDeep: '#24333c', waterShal: '#3d5a68', glint: '#cfdce2' };
export const LIGHTS = {
  grey: { az: 130, el: 34, sky: '#9fb2bc', ground: '#5c6258', hemi: 0.98, sun: '#e9edec', sunI: 1.65, fog: '#aebbc0', fogNear: 42, fogFar: 300,
    skyTop: '#5a7182', skyHor: '#c3ced2', sunDisc: '#f2f4ec', sunSize: 0.003, sat: 0.82, vig: 0.26, shadowExt: 20, aurora: 0, gain: '#dfe6ea', ...WATER },
  rain: { az: 150, el: 26, sky: '#71828d', ground: '#454c46', hemi: 0.8, sun: '#c3ced4', sunI: 1.3, fog: '#7e8f98', fogNear: 30, fogFar: 220,
    skyTop: '#33424e', skyHor: '#93a5ae', sunDisc: '#000000', sunSize: 0, sat: 0.8, vig: 0.32, shadowExt: 20, aurora: 0, gain: '#d7e0e4', ...WATER },
  fog: { az: 235, el: 13, sky: '#7d8b96', ground: '#3f4442', hemi: 0.58, sun: '#d8b28a', sunI: 1.05, fog: '#93a1a8', fogNear: 16, fogFar: 150,
    skyTop: '#2e3c4c', skyHor: '#8a97a3', sunDisc: '#e8c9a0', sunSize: 0.0034, sat: 0.78, vig: 0.34, shadowExt: 20, aurora: 0, gain: '#e6ddcf', ...WATER },
  grey2: { az: 122, el: 38, sky: '#a7b8c0', ground: '#5f6459', hemi: 1.02, sun: '#eef0e6', sunI: 1.85, fog: '#b4c0c4', fogNear: 44, fogFar: 310,
    skyTop: '#647d8e', skyHor: '#ccd4d2', sunDisc: '#f6f6ea', sunSize: 0.0032, sat: 0.88, vig: 0.24, shadowExt: 20, aurora: 0, gain: '#e6eae2', ...WATER },
  dusk: { az: 252, el: 11, sky: '#7e8296', ground: '#46423c', hemi: 0.72, sun: '#ffab60', sunI: 1.5, fog: '#a89a8c', fogNear: 38, fogFar: 280,
    skyTop: '#2c3a4e', skyHor: '#c09a76', sunDisc: '#ffb37a', sunSize: 0.004, sat: 0.85, vig: 0.3, shadowExt: 20, aurora: 0, gain: '#ecd9c2', ...WATER },
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
  if (S.id === 'rain') return blendLight(LIGHTS.grey, LIGHTS.rain, smooth(ramp(f, 714, 790)));
  if (S.id === 'fog') return blendLight(LIGHTS.rain, LIGHTS.fog, smooth(ramp(f, 974, 1050)));
  if (S.id === 'fame') return blendLight(LIGHTS.fog, LIGHTS.grey2, smooth(ramp(f, 1254, 1300)));
  if (S.id === 'hookq') return blendLight(LIGHTS.grey2, LIGHTS.dusk, smooth(ramp(f, 1338, 1390)));
  return { ...LIGHTS[S.light] };
};

// ---------- market layout (single source for render + colliders) ----------
export const UMB = [-2.2, 1.2];                    // hero umbrella stand (x,z); canopy top ~2.5
export const UMBTOP = [-2.2, 2.35, 1.2];
export const LATCHP = [-2.2, 1.45, 1.2];
export const SELLERP = [-5.3, -0.7];
export const RIVALP = [3.4, 0.6];
export const BOARD_POS = [2.5, 3.15, 13.5];
export const LAMPS = [[-8.5, 3.5], [8.0, 2.0]];
export const STALLS = [                            // back row (x, z, ry)
  { x: -9.5, z: -7.5, ry: 0.12 }, { x: -3.5, z: -8.0, ry: 0 }, { x: 2.5, z: -7.8, ry: -0.1 }, { x: 8.0, z: -7.2, ry: -0.2 },
];
export const HEROSTALL = { x: -3.4, z: -3.1, ry: 0.06 };
export const RIVALSTALL = { x: 4.8, z: -2.6, ry: -0.14 };
export const CARTP = [9.8, 1.8];
export const CRATES = [[-6.1, -0.6], [-6.0, 0.35]];
export const STOCKB = [-5.1, 1.5];                 // stock barrel beside the stand
export const CROWD_HOME = [
  [-0.6, 4.6], [0.9, 5.4], [-4.6, 3.6], [2.3, 3.9], [-1.9, 6.3], [4.4, 5.8],
];
export const heroPosAt = (f) => {
  const id = shotAt(f).id;
  if (id === 'dialogue' || id === 'refund') return [SELLERP[0], 1.55, SELLERP[1]];
  if (id === 'reveal') return [...LATCHP];
  if (id === 'hookq' || id === 'hook') return [...BOARD_POS];
  if (id === 'rival') return [0.6, 1.6, 0.9];
  return [...UMBTOP];
};

// ---------- umbrella mechanics ----------
// easeOutBack snap: mechanical spring-open with a small overshoot settle.
const snapK = (f, f0, dur = 11) => {
  const u = clamp((f - f0) / dur);
  if (u <= 0) return 0; if (u >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};
export const POP1 = 100, POP2 = 257, POP3 = 845, POP4 = 993;
export const umbOpenAt = (f) => {
  if (f < POP1) return 0;
  if (f < 249) return snapK(f, POP1);                    // drone: the hook visual
  if (f < POP2) return 0;                                // seller reset it (montage)
  if (f < 714) return snapK(f, POP2);                    // pop1: rush + sellout
  if (f < POP3) return 0;                                // next morning, closed
  if (f < 974) return snapK(f, POP3);                    // rain pop
  if (f < POP4) return 0;                                // evening, closed again
  return snapK(f, POP4);                                 // fog pop, stays open
};
export const latchAt = (f) => {
  // hair-strand stretch: visible in the reveal close-up, decisive in rain shot
  if (f >= 553 && f < 714) return smooth(ramp(f, 610, 700));
  if (f >= 714 && f < 862) return smooth(ramp(f, 770, 845));
  if (f >= 974 && f < 1099) return smooth(ramp(f, 974, 993));
  return 0;
};
export const rainAt = (f) => {
  if (f < 845 || f >= 974) return 0;                     // evening: NO rain — only fog
  return smooth(ramp(f, 848, 875));
};
export const fogAt = (f) => (f < 974 ? 0 : smooth(ramp(f, 1000, 1098)) * (f >= 1254 ? 1 - smooth(ramp(f, 1254, 1300)) : 1));
export const stockAt = (f) => {
  if (f < 300) return 6;
  if (f >= 1254) return 6;
  return Math.max(0, 6 - Math.floor((f - 300) / 11));    // sells out during pop1 rush
};

// ---------- camera (camrig: damped subject tracking only) ----------
const UMBF = () => [...UMBTOP];
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [15, 23, 29], look: [1, 0.8, -1], fov: 46 },
    { f: 58, pos: [8, 10, 22], look: [2.5, 3.0, 13.5], fov: 43 },
    { f: 92, pos: [3.4, 5.4, 23.2], look: [2.5, 3.05, 13.5], fov: 40 },
    { f: 137, pos: [2.4, 4.8, 22.4], look: [2.5, 3.05, 13.5], fov: 39, ease: 'surge' }] }) },
  wait: { cut: 'hard', raw: staticTrackCam({ pos: [-7.4, 2.3, 9.2], subject: UMBF, lookOff: [0, -0.15, 0], fov: 41 }) },
  pop1: { cut: 'hard', raw: pushInCam({ subject: UMBF, dir: [-0.55, 1], d0: 9.5, d1: 6.2, h0: 1.7, h1: 1.35, a: 249, b: 370, fov0: 42, fov1: 39 }) },
  rival: { cut: 'hard', raw: staticTrackCam({ pos: [-1.4, 2.1, 9.6], subject: () => [0.6, 1.5, 0.9], fov: 42 }) },
  reveal: { cut: 'hard', raw: pushInCam({ subject: () => [...LATCHP], dir: [-0.62, 1], d0: 4.6, d1: 2.6, h0: 0.35, h1: 0.12, a: 553, b: 713, lookOff: [0, 0.05, 0], fov0: 40, fov1: 36 }) },
  rain: { cut: 'hard', raw: keysCam({ keys: [
    { f: 714, pos: [-5.4, 2.6, 7.6], look: [-2.2, 1.9, 1.2], fov: 40 },
    { f: 800, pos: [-6.4, 3.0, 9.6], look: [-2.0, 1.7, 0.6], fov: 42 },
    { f: 845, pos: [-6.8, 3.1, 10.4], look: [-2.2, 1.9, 1.2], fov: 42 },
    { f: 861, pos: [-7.0, 3.2, 10.8], look: [-2.2, 1.85, 1.2], fov: 42, ease: 'surge' }] }) },
  wetair: { cut: 'hard', raw: staticTrackCam({ pos: [-8.6, 2.4, 6.8], subject: () => [SELLERP[0], 1.5, SELLERP[1]], lookOff: [0.9, 0.1, 0.9], fov: 41 }) },
  fog: { cut: 'hard', raw: keysCam({ keys: [
    { f: 974, pos: [10.5, 4.2, 15.5], look: [-1, 1.2, 0], fov: 44 },
    { f: 1030, pos: [4.5, 3.2, 12.5], look: [-2.0, 1.7, 0.8], fov: 42 },
    { f: 1098, pos: [1.8, 2.8, 11.2], look: [-2.2, 1.9, 1.2], fov: 41, ease: 'surge' }] }) },
  refund: { cut: 'hard', raw: pushInCam({ subject: () => [SELLERP[0], 1.35, SELLERP[1]], dir: [-0.35, 1], d0: 5.4, d1: 4.2, h0: 0.5, h1: 0.35, a: 1099, b: 1157, fov0: 41, fov1: 39 }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: () => [SELLERP[0], 1.52, SELLERP[1]], dir: [-0.3, 1], d0: 3.4, d1: 2.5, h0: 0.25, h1: 0.12, a: 1158, b: 1253, lookOff: [0, 0.05, 0], fov0: 39, fov1: 36 }) },
  fame: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1254, pos: [12, 6.5, 17], look: [-1, 1.0, -1], fov: 44 },
    { f: 1300, pos: [6, 4.4, 13.5], look: [-2.0, 1.6, 0.5], fov: 42 },
    { f: 1337, pos: [3.4, 3.6, 12.0], look: [-2.2, 1.9, 1.2], fov: 41, ease: 'surge' }] }) },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1338, pos: [2.9, 3.6, 14.5], look: [0.2, 2.4, 7.3], fov: 41 },
    { f: 1360, pos: [1.9, 3.5, 18.6], look: [1.6, 2.8, 10.8], fov: 40 },
    { f: 1380, pos: [1.2, 3.5, 21.5], look: [2.5, 3.0, 13.5], fov: 40 },
    { f: 1400, pos: [0.7, 3.5, 22.6], look: [2.5, 3.0, 13.5], fov: 39 },
    { f: 1420, pos: [0.5, 3.5, 23.0], look: [2.52, 2.98, 13.5], fov: 38, ease: 'surge' }] }) },
  hook: { cut: 'blend', blend: 8, raw: keysCam({ keys: [
    { f: 1421, pos: [0.5, 3.5, 23.0], look: [2.52, 2.98, 13.5], fov: 38 },
    { f: 1482, pos: [0.3, 3.55, 22.7], look: [2.53, 3.0, 13.5], fov: 37, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: POP1, a: 0.045 }, { f: POP2, a: 0.05 }, { f: POP3, a: 0.05 }, { f: POP4, a: 0.04 }],
  sigma: 3.4, fovSigma: 2.0,
});
export const camAt = (f) => { const c = RIG.camAt(f); c.flash = 0; return c; };
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: [...RIG.declared.whips],
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.2;
  if (S.id === 'drone') cinf = 1.2;
  if (S.id === 'reveal') cinf = 3.4;
  if (S.id === 'dialogue') cinf = 3.2;
  if (S.id === 'hook') cinf = 2.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    umbOpen: umbOpenAt(f), latchK: latchAt(f),
    rainK: rainAt(f), fogK: fogAt(f),
    lampK: (S.light === 'fog' || S.light === 'dusk') ? 1 : 0,
    stockN: stockAt(f),
    wetK: clamp(rainAt(f) + (f >= 974 ? 0.55 : 0)),
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 54, 68)) * (1 - smooth(ramp(f, 118, 132)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1408, 1420));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return {
    smokeRate: S.light === 'fog' ? 0.55 : 0.05,          // river fog rolling in
    dustRate: (S.light === 'grey' || S.light === 'grey2') ? 0.06 : 0.0,
    splashRate: 0,
  };
};
// deterministic ground splashes while it rains (consumed by main's fx stepper)
export const fxBurstsAt = (f) => {
  const out = { splash: [], wake: null };
  if (rainAt(f) > 0.3 && f % 3 === 0) {
    const h1 = Math.sin(f * 12.9898) * 43758.5453, h2 = Math.sin(f * 78.233) * 12543.123;
    out.splash.push([-7 + (h1 - Math.floor(h1)) * 15, 0.02, -4 + (h2 - Math.floor(h2)) * 10, 1.5]);
  }
  return out;
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { grey: '#eef2f2', rain: '#b9c8d2', fog: '#e8dcc8', grey2: '#f2f2e8', dusk: '#ecd9c2' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  seller: { jacket: '#5a4632', pants: '#3c3630', boots: '#241a12', hat: 'cap', cap: '#37414a', skin: '#c98a5a', moustache: '#4a3826' },
  rival: { jacket: '#2e2a33', pants: '#232028', boots: '#17130f', hat: 'hair', hair: '#14100c', skin: '#a06a3c', moustache: '#14100c' },
  c1: { jacket: '#7a4a5e', pants: '#3d3444', boots: '#241a12', hat: 'hair', hair: '#2c1e12', skin: '#e8b08a' },
  c2: { jacket: '#44607a', pants: '#2f3a44', boots: '#1c1712', hat: 'cap', cap: '#8a2f2a', skin: '#c98a5a' },
  c3: { jacket: '#6d7a3a', pants: '#44402e', boots: '#241a12', hat: 'cap', cap: '#e8e0cc', skin: '#a06a3c', moustache: '#2c1e12' },
  c4: { jacket: '#b06a2e', pants: '#4a3423', boots: '#241a12', hat: 'hair', hair: '#101010', skin: '#8a5a34' },
  c5: { jacket: '#5e548a', pants: '#37304a', boots: '#1c1712', hat: 'cap', cap: '#2e4a3a', skin: '#e8b08a' },
  c6: { jacket: '#94555e', pants: '#40303a', boots: '#241a12', hat: 'hair', hair: '#3a2415', skin: '#c98a5a' },
};
const RING = [[-0.9, 2.8], [0.7, 3.1], [-4.2, 2.4], [1.9, 1.9], [-5.4, 3.2], [3.1, 3.6]];
const crowdPosAt = (i, f) => {
  const home = CROWD_HOME[i];
  const rush = (a, b) => smooth(ramp(f, a, b));
  let k = 0;
  const S = shotAt(f);
  if (S.id === 'pop1') k = rush(258, 302);
  else if (['rival', 'reveal', 'rain', 'wetair'].includes(S.id)) k = 1;
  else if (S.id === 'fog') k = rush(994, 1036);
  else if (['refund', 'dialogue'].includes(S.id)) k = 1;
  else if (S.id === 'fame') k = 0.55;
  const ring = RING[i];
  return [lerp(home[0], ring[0], k), lerp(home[1], ring[1], k), k];
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground: y,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: y, tint, ...extra }) });
  // the seller (dialogue shot: performed with speak.js lip-sync)
  {
    let opts;
    if (S.id === 'dialogue') {
      const sp = speakFace('smile', f);
      opts = { expr: sp.expr, exprP: sp.exprP, headTilt: sp.headTilt, clothShade: true, mode: 'stand', blink: 0, seed: 51 };
      out.push({ id: 'seller', x: SELLERP[0], y: 0, z: SELLERP[1], r: 0.32, ground: 0,
        actor: (T) => ({ key: 'sellerSPK' + JSON.stringify(opts), draw: (p) => T.bodyFront(p, OUTFITS.seller, opts), x: SELLERP[0], y: 0, z: SELLERP[1], ground: 0, tint }) });
    } else {
      const expr = { drone: 'smile_closed', wait: 'smile_closed', pop1: 'grin', rival: 'smile', reveal: 'stern',
        rain: f >= 845 && f < 875 ? 'shock' : 'grin', wetair: 'smile', fog: f >= 993 ? 'nervous' : 'smile_closed',
        refund: 'smile', fame: 'laugh', hookq: 'smile_closed', hook: 'smile_closed' }[S.id] || 'smile';
      std('seller', OUTFITS.seller, { expr, mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, SELLERP[0], 0, SELLERP[1], { yaw: 0.35 });
    }
  }
  // the rival: at his stall normally; beside the umbrella for the slash test
  {
    const near = S.id === 'rival';
    const [rx2, rz2] = near ? [-0.7, 0.4] : [4.4, -1.0];
    std('rival', OUTFITS.rival, { expr: near ? 'stern' : 'smile_closed', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, rx2, 0, rz2, { yaw: near ? -0.5 : 0.2 });
  }
  // the crowd
  for (let i = 0; i < 6; i++) {
    const [cx, cz, k] = crowdPosAt(i, f);
    const moving = (S.id === 'pop1' && f >= 258 && f < 302) || (S.id === 'fog' && f >= 994 && f < 1036);
    const bob = moving ? Math.abs(Math.sin(f * 0.55 + i * 1.3)) * 0.045 : 0;
    const expr = S.id === 'rain' && f >= 845 ? 'shock' : (S.id === 'fame' ? 'grin' : 'smile');
    std('crowd' + (i + 1), OUTFITS['c' + (i + 1)], { expr, mode: moving ? 'march' : 'stand', blink: blinkAt(f, 61 + i), seed: 61 + i, phase: q((f * 0.3 + i * 0.7) % 1, 2) }, cx, bob, cz, { yaw: -0.15 + i * 0.06 });
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));
export const fxAt = (f, T) => {
  const out = [];
  // rival's knife slashes the air around the umbrella (glint bursts, no contact)
  for (const w0 of [430, 472, 514]) {
    if (f >= w0 && f < w0 + 6) {
      const u = (f - w0) / 6;
      out.push({ key: 'slash' + w0 + Math.round(u * 4), draw: (p) => T.fxBurst(p, u, '#dfe9ee', 6, 30, 120),
        x: -1.15, y: 1.75, z: 0.75, s: 0.5, blob: false, shadow: false });
    }
  }
  // coins flash in the seller's hands during the double refund
  if (f >= 1112 && f < 1152 && f % 8 < 4) {
    out.push({ key: 'coin' + Math.floor(f / 8), draw: (p) => T.fxStars(p, (f % 8) / 8),
      x: SELLERP[0] + 0.45, y: 1.05, z: SELLERP[1] + 0.35, s: 0.45, blob: false, shadow: false });
  }
  return out;
};

// ---------- solids ----------
const STATICS = [
  SOL.obb(HEROSTALL.x, HEROSTALL.z, HEROSTALL.ry, 1.9, 0.6, { h: 2.6, id: 'herostall' }),
  SOL.obb(-3.4, -2.2, 0, 1.7, 0.22, { h: 1.05, id: 'counter' }),
  SOL.obb(RIVALSTALL.x, RIVALSTALL.z, RIVALSTALL.ry, 1.7, 0.7, { h: 2.5, id: 'rivalstall' }),
  ...STALLS.map((s) => SOL.obb(s.x, s.z, s.ry, 1.7, 0.9, { h: 2.6, id: 'stall' })),
  SOL.circle(UMB[0], UMB[1], 0.3, { h: 2.6, id: 'umbstand' }),
  SOL.circle(STOCKB[0], STOCKB[1], 0.42, { h: 0.95, id: 'stockbarrel' }),
  SOL.circle(-6.25, -1.45, 0.55, { h: 1.4, id: 'crates' }),
  ...LAMPS.map(([x, z]) => SOL.circle(x, z, 0.12, { h: 3.4, id: 'lamp' })),
  SOL.circle(BOARD_POS[0] - 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.obb(CARTP[0], CARTP[1], 0.7, 0.95, 0.62, { h: 1.1, id: 'cart' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => castAt(f).map((a) => SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
export const groundItemsAt = (f) => castAt(f).map((a) => ({ id: a.id, y: a.y, ground: 0, maxHover: 0.07 }));
