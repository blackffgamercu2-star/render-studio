// Shot plan for "वो नानबाई जिसने बिना भट्ठी के रोटी सेंकी" — baker-hindi
// (LIBRARY v4: speak.js dialogue performance + materials v4, camrig smooth
// tracking + solid colliders). Batch 7 topic 4, HINDI. Template: pot-hindi
// (batch 6 Hindi) — same courtyard set re-dressed as a village bakery
// courtyard, Golden Hour grade. ONE set: bakery courtyard in morning sun.
// The baker's clay oven cracks on festival morning; he drags a flat black
// stone into the sun, polishes a brass plate till it shines like a second
// sun, angles it to focus sunlight onto the stone, and bakes flatbread on
// the sun-heated stone. Twist: "The oven never baked the bread. The heat did."
// Voice stem: 48.011 s, 30 fps, TOTAL 1440.
// ALL timings derive from PHRASES (faster-whisper small, silence-segmented
// with ALL output-seek cuts + char-difflib line map, align_full.py —
// match_ratio 0.846, 190 words). Scene changes ONLY at clause boundaries.
// Patch PHRASES only — every shot/beat derives from it.
//   L1 0.00-4.64   festival morning, oven cracks ("चटक" 2.62s)
//   L2 4.86-8.32   D1 "मैं फिर भी... बिना भट्ठी के।" (baker vows)
//   L3 8.46-12.48  village doubts — bread needs fire, fire needs an oven
//   L4 12.73-19.71 stone dragged out (12.73-15.51) + brass plate polished
//   L5 19.71-24.75 plate angled, sunlight focuses to a burning patch
//   L6 24.78-31.53 stone hotter than any oven bar; bread hisses/puffs/browns
//   L7 31.83-37.01 loaves come off golden, steaming; village eats sun-baked bread
//   L8 37.27-42.62 D2 "भट्ठी ने रोटी कभी नहीं सेंकी... सूरज ख़ुद लेकर आया।"
//   L9 42.62-47.98 hook: the boy who counted all the stars ("भला..." 46.66s)
// GRADE (FILTER_VFX_LIGHTING pack): Golden Hour throughout; hook shifts to
// a dusk blend. Signature VFX: sun rays converging through the brass plate
// onto the stone, heat shimmer over the stone, steam wisps off the loaves,
// moving sheen + glints on the brass plate, golden glints on the loaves.
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

// Script-line spans in seconds [start, end] — the ONLY timing source.
export const PHRASES = [
  [0.00, 4.64], [4.86, 8.32], [8.46, 12.48], [12.73, 19.71], [19.71, 24.75],
  [24.78, 31.53], [31.83, 37.01], [37.27, 42.62], [42.62, 47.98],
];
const F = (sec) => Math.round(sec * 30);
const ph = (i) => [F(PHRASES[i][0]), F(PHRASES[i][1])];
// Intra-line splits (seconds): L4 = stone drag | plate polish (split at
// "लाया" end 15.51s); L9 = hook telling | hook board hold (split at "भला" 46.66s).
const DRAG = [12.73, 15.51], POLISH = [15.51, 19.71];
const HOOKQ = [42.62, 46.66], HOOK = [46.66, 47.98];

export const FPS = 30, TOTAL = 1440, DECK = 0;
// Shot cut frames, chained contiguously (a[i] = b[i-1]+1) so no frame is
// unassigned — gaps make shotAt() fall through to the last shot and the
// camera teleports (that was the f252 spike + jerk failures).
const CUTS = [0, ph(1)[0], ph(2)[0], F(DRAG[0]), F(POLISH[0]), ph(4)[0], ph(5)[0], ph(6)[0], ph(7)[0], F(HOOKQ[0]), F(HOOK[0]), TOTAL];
const SHOT_DEFS = [
  ['drone', 'gold'], ['vow', 'gold'], ['doubt', 'gold'], ['stone', 'gold'],
  ['plate', 'gold'], ['focus', 'gold'], ['bake', 'gold'], ['serve', 'gold'],
  ['twist', 'gold'], ['hookq', 'dusk'], ['hook', 'dusk'],
];
export const SHOTS = SHOT_DEFS.map(([id, light], i) => ({ id, a: CUTS[i], b: CUTS[i + 1] - 1, light }));
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
  if (S.id === 'hookq') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, F(HOOKQ[0]), F(HOOKQ[0]) + 58)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const PLATFORM = { x: 0, z: 2, r: 1.35, top: 0.24 };
export const OVEN = { x: -7.3, z: 6.1, ry: 0.2 };
export const TABLE = { x: 4.4, z: 7.2 };
export const STONE_START = [-5.2, 5.0];
export const STONE_HOME = [PLATFORM.x, PLATFORM.z];
const STONE_TOP = PLATFORM.top; // 0.24 — bread rests ON this
const LOAF_SPOTS = [[-0.6, 1.7], [0.55, 1.75], [0.0, 2.55]]; // [x,z] on the stone

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// Baker: at the oven for the crack + vow + doubt, walks with the stone
// during the drag, then planted beside the stone for the rest.
const BAKER_KEYS = [
  [0, -5.6, 6.2], [F(DRAG[0]), -5.6, 6.2], [F(DRAG[1]), -1.2, 3.6], [TOTAL - 1, -1.2, 3.6],
];
// Villagers gather: start spread out, step closer for the serve beat.
const V1_KEYS = [[0, 3.1, 5.6], [ph(6)[0], 3.1, 5.6], [ph(6)[0] + 45, 2.2, 4.4], [TOTAL - 1, 2.2, 4.4]];
const V2_KEYS = [[0, 4.8, 3.2], [ph(6)[0], 4.8, 3.2], [ph(6)[0] + 45, 3.4, 3.6], [TOTAL - 1, 3.4, 3.6]];
export const bakerAt = (f) => { const [x, z] = walkKeys(BAKER_KEYS, f); return { x, z }; };
export const v1At = (f) => { const [x, z] = walkKeys(V1_KEYS, f); return { x, z }; };
export const v2At = (f) => { const [x, z] = walkKeys(V2_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const bakerMode = (f) => strolling(f, [[F(DRAG[0]), F(DRAG[1])]]) ? 'stroll' : 'stand';
// The stone: heavy — dragged SLOWLY on the ground (never lifted, never
// floating) from the oven to the courtyard centre, lands with a settle.
export const stoneAt = (f) => {
  if (f < F(DRAG[0])) return { x: STONE_START[0], z: STONE_START[1], dragging: 0 };
  if (f <= F(DRAG[1])) {
    const u = smooth(ramp(f, F(DRAG[0]), F(DRAG[1])));
    return { x: lerp(STONE_START[0], STONE_HOME[0], u), z: lerp(STONE_START[1], STONE_HOME[1], u), dragging: 1 };
  }
  return { x: STONE_HOME[0], z: STONE_HOME[1], dragging: 0 };
};
// The brass plate: hidden until the polish beat; held at the baker's hands
// while polishing/angling (tilt grows as he angles it to the sun); set down
// leaning on the stone's edge once the patch is made.
export const plateAt = (f) => {
  const b = bakerAt(f);
  if (f < F(POLISH[0])) return { k: 0, x: b.x, y: 1.1, z: b.z, rx: 0, ry: 0 };
  if (f <= ph(4)[1]) {
    const polish = smooth(ramp(f, F(POLISH[0]), F(POLISH[0]) + 60));
    const tilt = f < ph(4)[0] ? 0.35 : 0.35 + smooth(ramp(f, ph(4)[0], ph(4)[0] + 75)) * 0.32;
    return { k: 1, x: b.x + 0.55, y: 1.15, z: b.z - 0.55, rx: -tilt, ry: 0.5, polish };
  }
  // set down: carried smoothly from the hands to lean on the stone's WEST
  // edge (away from the south-east bake/serve cameras, so it never crowds
  // the loaves), bottom edge ON the ground, over 15 frames — no 1-frame pop
  const held = { x: b.x + 0.55, y: 1.15, z: b.z - 0.55, rx: -0.67, ry: 0.5 };
  const down = { x: STONE_HOME[0] - 1.35, y: 0.28, z: STONE_HOME[1] + 0.2, rx: -0.5, ry: 0 };
  const u = smooth(ramp(f, ph(4)[1], ph(4)[1] + 15));
  return { k: 1, x: lerp(held.x, down.x, u), y: lerp(held.y, down.y, u), z: lerp(held.z, down.z, u),
    rx: lerp(held.rx, down.rx, u), ry: lerp(held.ry, down.ry, u), polish: 1 };
};
// Loaves: dropped one by one onto the stone during the bake beat — each
// falls with gravity (fast, one small bounce) and lands ON the stone top,
// then puffs and browns.
const LOAF_DROPS = [0, 45, 90]; // frames after bake start
export const loafAt = (f, i) => {
  const [lx, lz] = LOAF_SPOTS[i];
  const dropStart = ph(5)[0] + LOAF_DROPS[i];
  const restY = STONE_TOP + 0.07;
  if (f < dropStart) return { k: 0, x: lx, y: restY, z: lz, puff: 0, glint: 0 };
  const t = (f - dropStart) / 30; // seconds since drop
  let y;
  // free fall from the baker's hand (1.05) to the stone top (0.31):
  // t_fall = sqrt(2*0.74/9.8) = 0.39 s, then ONE small bounce (0.06) and rest
  if (t < 0.39) y = 1.05 - 0.5 * 9.8 * t * t;
  else {
    const tb = t - 0.39, h = 0.06 * Math.max(0, 1 - tb / 0.25);
    y = restY + h * Math.abs(Math.sin((tb / 0.25) * Math.PI));
    if (tb >= 0.25) y = restY;
  }
  y = Math.max(y, restY);
  const puff = smooth(ramp(f, dropStart + 20, ph(5)[1]));
  const glint = smooth(ramp(f, dropStart + 55, ph(5)[1])) * (0.6 + 0.4 * Math.sin(f * 0.09 + i * 2.1));
  return { k: 1, x: lx, y, z: lz, puff, glint: Math.max(0, glint) };
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
// Sun patch on the stone: grows as the plate angles, holds through the bake
// and serve, fades as the twist is spoken.
export const sunPatchAt = (f) => segMax(f, [
  [ph(4)[0], ph(4)[0] + 75, ph(6)[1], ph(6)[1] + 40, 1],
]);
export const steamAt = (f) => segMax(f, [
  [ph(5)[0] + 25, ph(5)[0] + 45, ph(5)[1], ph(5)[1] + 20, 1],   // bread hissing
  [ph(6)[0], ph(6)[0] + 30, ph(6)[1], ph(6)[1] + 45, 0.7],     // steam off the loaves
]);
export const shimmerAt = (f) => segMax(f, [
  [ph(4)[0] + 40, ph(4)[0] + 90, ph(6)[1], ph(6)[1] + 30, 1],
]);
export const raysAt = (f) => segMax(f, [
  [ph(4)[0] + 30, ph(4)[0] + 75, ph(4)[1], ph(4)[1] + 20, 1],   // the focus
  [ph(7)[0] + 20, ph(7)[0] + 50, ph(7)[0] + 80, ph(7)[1], 0.55], // twist echo
]);
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(F(POLISH[0]), F(POLISH[1]), 1);          // plate polished to a shine
  pulse(ph(4)[0], ph(4)[1], 0.9);                // angled plate catches the sun
  pulse(ph(5)[0] + 55, ph(5)[1], 0.7);           // golden loaves
  pulse(ph(7)[0] + 40, ph(7)[1], 0.6);           // the twist lands
  return s;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  vow: () => { const b = bakerAt(ph(1)[0] + 30); return [b.x, 1.3, b.z]; },
  doubt: () => [1.2, 1.2, 4.6],
  stone: () => { const s = stoneAt(F(DRAG[0]) + 55); return [s.x, 0.5, s.z]; },
  plate: () => { const b = bakerAt(ph(3)[1] - 30); return [b.x + 0.3, 1.2, b.z - 0.3]; },
  focus: () => [0, 0.5, 2],
  bake: () => [0, 0.5, 2],
  serve: () => [0.6, 1.0, 3.2],
  twist: () => { const b = bakerAt(ph(7)[0] + 30); return [b.x, 1.35, b.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const stonePos = (f) => { const s = stoneAt(f); return [s.x, 0, s.z]; };
const bakerPos = (f) => { const b = bakerAt(f); return [b.x, 0, b.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[22, 13, 27], [13, 7.5, 19], [9, 4.5, 15.5], [7.4, 3.1, 13.4]],
    [[0, 3.0, -6], [0, 2.2, -2], [-3, 1.2, 4], [-5.2, 1.0, 5.8]], ph(0)[0], ph(0)[1], 44, 40) },
  vow: { cut: 'hard', raw: pushInCam({ subject: bakerPos, a: ph(1)[0], b: ph(1)[1], d0: 4.6, d1: 3.2, h0: 1.6, h1: 1.5, lookOff: [0, 1.4, 0], fov0: 38, fov1: 32,
    dir: () => [0.5, 0.8] }) },
  doubt: { cut: 'hard', raw: keysCam({ keys: [
    { f: ph(2)[0], pos: [7.2, 2.8, 11.4], look: [1.2, 1.1, 4.4], fov: 42 },
    { f: ph(2)[1], pos: [6.6, 2.6, 10.6], look: [1.2, 1.1, 4.4], fov: 38, ease: 'surge' }] }) },
  stone: { cut: 'hard', raw: keysCam({ keys: [
    { f: F(DRAG[0]), pos: [-8.2, 2.6, 11.6], look: [-4.6, 0.4, 4.8], fov: 40 },
    { f: F(DRAG[1]), pos: [-3.4, 2.2, 9.4], look: [-1.4, 0.4, 3.2], fov: 36, ease: 'surge' }] }) },
  plate: { cut: 'hard', raw: pushInCam({ subject: bakerPos, a: F(POLISH[0]), b: F(POLISH[1]), d0: 4.4, d1: 3.5, h0: 1.55, h1: 1.45, lookOff: [0.45, 1.15, 0], fov0: 38, fov1: 36,
    dir: () => [0.5, 0.8] }) },
  focus: { cut: 'hard', raw: keysCam({ keys: [
    { f: ph(4)[0], pos: [7.4, 3.4, 13.2], look: [-0.2, 0.8, 2.4], fov: 46 },
    { f: ph(4)[1], pos: [5.8, 2.6, 10.2], look: [-0.2, 0.6, 2.2], fov: 38, ease: 'surge' }] }) },
  bake: { cut: 'hard', raw: pushInCam({ subject: stonePos, a: ph(5)[0], b: ph(5)[1], d0: 7.0, d1: 5.6, h0: 2.2, h1: 1.8, lookOff: [0, 1.1, 0.3], fov0: 40, fov1: 36,
    dir: () => [0.55, 0.8] }) },

  serve: { cut: 'hard', raw: keysCam({ keys: [
    { f: ph(6)[0], pos: [6.4, 2.6, 10.8], look: [0.6, 1.0, 3.2], fov: 40 },
    { f: ph(6)[1], pos: [5.8, 2.4, 10.0], look: [0.6, 1.0, 3.2], fov: 37, ease: 'surge' }] }) },
  twist: { cut: 'hard', raw: pushInCam({ subject: bakerPos, a: ph(7)[0], b: ph(7)[1], d0: 4.6, d1: 3.8, h0: 1.7, h1: 1.7, lookOff: [0, 1.4, 0], fov0: 36, fov1: 32,
    dir: () => [0.0, 0.9] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: F(HOOKQ[0]), pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: F(HOOKQ[1]), pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: F(HOOK[0]), pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: TOTAL - 1, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: F(DRAG[1]), a: 0.03 }],
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
  if (['focus', 'bake', 'vow', 'twist'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), st = stoneAt(f), pl = plateAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    stoneX: st.x, stoneZ: st.z, stoneDrag: st.dragging,
    plateK: pl.k, plateX: pl.x, plateY: pl.y, plateZ: pl.z, plateRX: pl.rx, plateRY: pl.ry,
    sunPatchK: sunPatchAt(f), plateGlint: glintAt(f),
    loaves: [0, 1, 2].map((i) => loafAt(f, i)),
    steamK: steamAt(f), shimmerK: shimmerAt(f), raysK: raysAt(f),
    dustK: 0.05 + st.dragging * 0.25,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 28, 45)) * (1 - smooth(ramp(f, 52, 64)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, F(HOOKQ[0]) + 46, F(HOOKQ[0]) + 70));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05 + (stoneAt(f).dragging ? 0.5 : 0), splashRate: 0, steamRate: steamAt(f), shimmerRate: shimmerAt(f), grey: 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  baker: { jacket: '#f2ead8', pants: '#5a4632', boots: '#3a2a1c', hat: 'cap', cap: '#f2ead8', skin: '#a06a3c' },
  v1: { jacket: '#7a5a34', pants: '#4a3a2a', boots: '#2c1e12', hat: 'hair', hair: '#1c1410', skin: '#c98a5a' },
  v2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#2c1a10', skin: '#8a5a34', moustache: '#241a12' },
  v3: { jacket: '#8a3a4a', pants: '#3a2a2c', boots: '#241a12', hat: 'hair', hair: '#3a2010', skin: '#b0703e' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const b = bakerAt(f), v1 = v1At(f), v2 = v2At(f);
  const bBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  const dragging = f >= F(DRAG[0]) && f <= F(DRAG[1]);
  const polishing = f >= F(POLISH[0]) && f <= F(POLISH[1]);
  switch (S.id) {
    case 'drone': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'shock' }, b.x, b.z, { yaw: 0.9 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.4 });
      std('v3', OUTFITS.v3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'vow': {
      // D1: the baker PERFORMS his vow — mouth driven by the stem inside
      // the speak segment, closed outside it; villagers only listen.
      std('baker', OUTFITS.baker, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.6 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.6 });
      break;
    }
    case 'doubt': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'stern' }, b.x, b.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.4 });
      std('v3', OUTFITS.v3, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'stone': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'stern', mode: bakerMode(f), phase: q((f * 0.011) % 1, 2), prop: ['point', 0.6] }, b.x, b.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      break;
    }
    case 'plate': {
      std('baker', OUTFITS.baker, { ...bBase, prop: polishing ? ['point', 0.8] : null }, b.x, b.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      break;
    }
    case 'focus': {
      std('baker', OUTFITS.baker, { ...bBase, prop: ['point', 0.75] }, b.x, b.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.4 });
      break;
    }
    case 'bake': {
      std('baker', OUTFITS.baker, { ...bBase }, b.x, b.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.4 });
      break;
    }
    case 'serve': {
      std('baker', OUTFITS.baker, { ...bBase, expr: 'laugh' }, b.x, b.z, { yaw: 0.55 });
      std('v1', OUTFITS.v1, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      std('v2', OUTFITS.v2, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, v2.x, v2.z, { yaw: -0.4 });
      std('v3', OUTFITS.v3, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'twist': {
      // D2: the baker PERFORMS the twist line; villagers listen, mouths closed.
      std('baker', OUTFITS.baker, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, v1.x, v1.z, { yaw: -0.5 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(PLATFORM.x, PLATFORM.z, PLATFORM.r, { h: PLATFORM.top, id: 'stonehome' }),
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 12, { h: 2.6, id: 'wallE' }),
  SOL.obb(OVEN.x, OVEN.z, OVEN.ry, 1.3, 1.1, { h: 1.4, id: 'oven' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
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
  // the stone slab rests ON the courtyard ground at every frame (its
  // bottom is y=0; it is dragged, never lifted)
  items.push({ id: 'stone', y: 0, ground: 0, maxHover: 0.03 });
  for (let i = 0; i < 3; i++) {
    const L = loafAt(f, i);
    // a loaf is ground-checked only once it has LANDED on the stone top;
    // mid-fall it is transitional (in the air by gravity), like pot's carry
    if (L.k && L.y <= STONE_TOP + 0.07 + 0.001) items.push({ id: `loaf${i}`, y: L.y - 0.07, ground: STONE_TOP, maxHover: 0.03 });
  }
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
