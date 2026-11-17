// Shot plan for "The Salted Mine" — salted-mine (LIBRARY v4: materials v4,
// camrig smooth tracking + solid colliders). ONE set: a gold mine — tunnel
// interior (rails, timbers, lanterns) + entrance yard with the LUCKY STAR
// MINE sign. A broke miner "salts" his worthless mine by firing gold dust
// into its walls, sells it to a rich banker after a dynamite blast "reveals"
// a gold vein — and the banker's own expert quietly exposes the trick.
// Voice stem: Abid's own voice (GPT-SoVITS zero-shot tren, x1.25 + EQ),
// 51.449 s, 30 fps, TOTAL 1544; phrase timings from the assembled stem
// (timing.json), word beats from faster-whisper (words.json). Scene changes
// ONLY at phrase boundaries:
//   P1 0.00-4.12 fired into his own wall   P7 26.31-30.44 the blast / vein
//   P2 4.38-8.47 again... glittered        P8 30.70-34.56 paid double
//   P3 8.73-12.24 partner ran to town      P9 34.81-38.95 expert chipped
//   P4 12.49-15.88 banker offered          P10 39.20-44.01 skin deep
//   P5 16.14-20.81 walls sparkled          P11 44.26-47.84 tricksters gone
//   P6 21.07-26.05 one last test           P12 48.10-51.44 never told a soul
// GRADE (FILTER_VFX_LIGHTING pack): Royal Gold inside the mine (warm amber,
// gold the accent), Golden Hour in the yard. Grade changes ONLY on clause
// boundaries. Signature VFX: shotgun gold-dust bursts + wall salt glitter,
// lantern dust motes, dynamite blast (exposure choreography: dim -> flash
// -> recover) + dust, the crack-open gold vein with glints and glow.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';

export const FPS = 30, TOTAL = 1544, DECK = 0;
// FIX ROUND 2 (Abid's staging notes + COVERAGE_MAP.md): phrases are now covered
// by sub-shots — a loading INSERT, close firing coverage with push-ins on the
// impact, face close-ups with living heads — instead of one wide per phrase.
export const SHOTS = [
  { id: 'load', a: 0, b: 18, light: 'mine' },
  { id: 'insert', a: 19, b: 73, light: 'mine' },
  { id: 'fire1', a: 74, b: 130, light: 'mine' },
  { id: 'fire2', a: 131, b: 153, light: 'mine' },
  { id: 'fire3', a: 154, b: 186, light: 'mine' },
  { id: 'glitter', a: 187, b: 261, light: 'mine' },
  { id: 'town', a: 262, b: 374, light: 'day' },
  { id: 'offer', a: 375, b: 483, light: 'day' },
  { id: 'sparkle', a: 484, b: 545, light: 'mine' },
  { id: 'dance', a: 546, b: 631, light: 'mine' },
  { id: 'test', a: 632, b: 724, light: 'deep' },
  { id: 'dyn', a: 725, b: 788, light: 'deep' },
  { id: 'blast', a: 789, b: 838, light: 'deep' },
  { id: 'vein', a: 839, b: 920, light: 'deep' },
  { id: 'paid', a: 921, b: 1043, light: 'day' },
  { id: 'chip', a: 1044, b: 1089, light: 'mine' },
  { id: 'chipx', a: 1090, b: 1145, light: 'mine' },
  { id: 'chip2', a: 1146, b: 1175, light: 'mine' },
  { id: 'skindeep', a: 1176, b: 1255, light: 'mine' },
  { id: 'shock', a: 1256, b: 1327, light: 'mine' },
  { id: 'gone', a: 1328, b: 1442, light: 'day' },
  { id: 'silent', a: 1443, b: 1543, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  mine: { az: 205, el: 38, sky: '#7a5636', ground: '#33241a', hemi: 0.78, sun: '#ffb45e', sunI: 1.15, fog: '#2e1d0f', fogNear: 7, fogFar: 62,
    skyTop: '#241a10', skyHor: '#5a3d1e', sunDisc: '#000000', sunSize: 0, sat: 1.07, vig: 0.3, shadowExt: 16, aurora: 0, gain: '#ffd9ae',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  deep: { az: 205, el: 38, sky: '#5f422a', ground: '#241a10', hemi: 0.68, sun: '#ff9e4e', sunI: 1.1, fog: '#201307', fogNear: 5, fogFar: 44,
    skyTop: '#180f08', skyHor: '#402a14', sunDisc: '#000000', sunSize: 0, sat: 1.05, vig: 0.37, shadowExt: 16, aurora: 0, gain: '#ffc98e',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  day: { az: 232, el: 30, sky: '#f6dcae', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
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
  if (S.id === 'blast') {
    // exposure choreography: the scene DIMS as the fuse burns, the blast
    // flashes (camAt flash), then the gold vein light takes over warm.
    const dim = { ...LIGHTS.deep, hemi: 0.34, sunI: 0.4, gain: '#8a6a4a' };
    if (f < 796) return blendLight(LIGHTS.deep, dim, smooth(ramp(f, 786, 796)));
    const gold = { ...LIGHTS.deep, hemi: 0.85, sunI: 1.0, gain: '#ffd9a0', fog: '#33200c' };
    return blendLight(dim, gold, smooth(ramp(f, 800, 836)));
  }
  if (S.id === 'silent') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 1443, 1500)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const SIGN_POS = [0, 6.35, 10.45];
export const BOARD_POS = SIGN_POS;
const TABLE = { x: 3.6, z: 13.2 };
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
// gunfire frames (word "fired" f77; "again" f122/f157 land in shot 2)
export const FIRE = [77, 140, 168];
export const BLAST_F = 796;
export const saltAt = (f) => {
  let s = 0;
  const up = (a, b, v) => { if (f >= a) s = Math.max(s, v * smooth(ramp(f, a, b))); };
  up(77, 112, 0.35); up(140, 175, 0.7); up(168, 235, 1);
  return s;
};
// per-impact splat strengths (main.js fades a gold splat cluster in on the
// exact wall spot each shot hits: right wall z0.6 / left wall z-3 / right z-5)
export const saltParts = (f) => [
  f >= 77 ? smooth(ramp(f, 77, 112)) : 0,
  f >= 140 ? smooth(ramp(f, 140, 168)) : 0,
  f >= 168 ? smooth(ramp(f, 168, 210)) : 0,
];
export const veinAt = (f) => smooth(ramp(f, BLAST_F + 4, BLAST_F + 58));
export const muzzleAt = (f) => Math.max(...FIRE.map((ff) => (f >= ff && f <= ff + 3 ? 1 - (f - ff) / 4 : 0)), 0);
export const fuseAt = (f) => (f >= 762 && f < BLAST_F ? 1 : 0);
export const sackAt = (f) => {
  // the sacks sit on the yard table during the offer, then travel from the
  // banker's side to the miner's hands on "paid double" (f932)
  const u = smooth(ramp(f, 936, 992));
  return { x: lerp(TABLE.x, 1.35, u), y: lerp(0.98, 1.05, u) + Math.sin(u * Math.PI) * 0.18, z: lerp(TABLE.z, 12.1, u), k: ramp(f, 424, 432) * (1 - ramp(f, 1030, 1042)) };
};
// miner / buddy / banker / expert anchor points per shot (single source)
export const minerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'load': case 'insert': case 'fire1': return { x: 1.02, z: 1.88 };
    case 'fire2': return { x: -1.6, z: -1.5 };
    case 'fire3': case 'glitter': return { x: 1.6, z: -4.2 };
    case 'town': return { x: -1.6, z: 9.6 };
    case 'offer': return { x: -1.7, z: 11.6 };
    case 'sparkle': case 'dance': return { x: -1.9, z: -1.2 };
    case 'test': case 'dyn': return { x: -1.2, z: -26.4 };
    case 'blast': case 'vein': return { x: -2.1, z: -26.2 };
    case 'paid': return { x: 0.2, z: 11.9 };
    case 'chip': case 'chipx': case 'chip2': case 'skindeep': case 'shock': return { x: -2.4, z: -28.6 };
    case 'gone': { const u = ramp(f, 1328, 1442); return { x: lerp(-6, -17, u), z: lerp(13, 19, u) }; }
    default: return { x: -3.5, z: 12 };
  }
};
export const buddyAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'load': case 'insert': case 'fire1': return { x: -1.8, z: 2.6 };
    case 'fire2': case 'fire3': case 'glitter': return { x: -2.4, z: -6.5 };
    case 'town': { const u = smooth(ramp(f, 268, 330)); return { x: lerp(-0.8, 1.3, u), z: lerp(9.8, 15.6, u) }; }
    case 'offer': return { x: -2.9, z: 12.4 };
    case 'sparkle': case 'dance': return { x: 2.1, z: -2.6 };
    case 'test': case 'dyn': return { x: 2.4, z: -24.8 };
    case 'blast': case 'vein': return { x: 2.6, z: -24.6 };
    case 'paid': return { x: 1.6, z: 12.6 };
    case 'gone': { const u = ramp(f, 1328, 1442); return { x: lerp(-4.8, -15.6, u), z: lerp(13.8, 19.8, u) }; }
    default: return { x: 3.4, z: 12 };
  }
};
export const bankerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'offer': { const u = smooth(ramp(f, 380, 440)); return { x: lerp(2.6, 1.8, u), z: lerp(19.5, 13.8, u) }; }
    case 'sparkle': case 'dance': return { x: 0.2, z: -0.6 };
    case 'test': case 'dyn': return { x: 0.4, z: -25.4 };
    case 'blast': case 'vein': return { x: 0.6, z: -27.6 };
    case 'paid': return { x: 2.2, z: 12.9 };
    case 'chip': case 'chipx': case 'chip2': case 'skindeep': case 'shock': return { x: 2.3, z: -28.2 };
    case 'silent': return { x: 0.4, z: 11.8 };
    default: return { x: 8, z: 20 };
  }
};
export const expertAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'offer': return { x: 3.4, z: 14.6 };
    case 'test': case 'dyn': case 'blast': case 'vein': return { x: -0.9, z: -24.6 };
    case 'chipx': return { x: 0.7, z: -30.9 };
    case 'chip': case 'chip2': case 'skindeep': case 'shock': return { x: 0.85, z: -29.6 };
    default: return { x: 9, z: 21 };
  }
};
// the shotgun: held low in `load`, on the crate rig during `insert` (gunAt
// hides — main.js shows the break-action insert rig), then raised and fired
// in the three close firing shots. Poses sit at the miner's chest so his
// raised card arm meets the stock — the gun never floats free of the body.
export const gunAt = (f) => {
  const S = shotAt(f);
  const m = minerAt(f);
  const recoil = Math.max(...FIRE.map((ff) => (f >= ff && f <= ff + 5 ? Math.sin((f - ff) / 5 * Math.PI) * 0.14 : 0)), 0);
  const low = { x: m.x + 0.30, y: 1.04, z: m.z + 0.30, ry: 0.55, rx: 0.42 };
  if (S.id === 'load') return { k: 1, ...low, rz: 0 };
  if (S.id === 'fire1') {
    const aim = { x: m.x + 0.30, y: 1.17, z: m.z + 0.10, ry: 1.22, rx: -0.04 };
    const u = smooth(ramp(f, 74, 78));
    return { k: 1, x: lerp(low.x, aim.x, u), y: lerp(low.y, aim.y, u), z: lerp(low.z, aim.z, u),
      ry: lerp(low.ry, aim.ry, u), rx: lerp(low.rx, aim.rx, u), rz: -recoil };
  }
  if (S.id === 'fire2') return { k: 1, x: m.x - 0.30, y: 1.17, z: m.z + 0.05, ry: -1.22, rx: -0.04, rz: recoil };
  if (S.id === 'fire3') return { k: 1, x: m.x + 0.30, y: 1.17, z: m.z + 0.08, ry: 1.78, rx: -0.02, rz: -recoil };
  return { k: 0, x: 0, y: 0, z: 0 };
};

// ---------- hero / focus ----------
const FOCUS = {
  load: () => { const m = minerAt(9); return [m.x, 1.45, m.z]; },
  insert: () => [1.96, 0.88, 2.47],
  fire1: () => [3.3, 1.75, 0.65],
  fire2: () => { const m = minerAt(140); return [m.x, 1.6, m.z]; },
  fire3: () => [2.2, 1.6, -4.7],
  glitter: () => { const b = buddyAt(240); return [b.x, 1.5, b.z]; },
  town: () => { const b = buddyAt(320); return [b.x, 1.2, b.z]; },
  offer: () => { const b = bankerAt(430); return [b.x, 1.25, b.z]; },
  sparkle: () => { const b = bankerAt(510); return [b.x, 1.5, b.z]; },
  dance: () => { const b = bankerAt(590); return [b.x, 1.55, b.z]; },
  test: () => [1.2, 0.9, -27],
  dyn: () => [2.95, 0.8, -30.6],
  blast: () => [0, 2.2, -31],
  vein: () => [0.2, 1.9, -31],
  paid: () => [1.2, 1.1, 12.3],
  chip: () => { const e = expertAt(1060); return [e.x, 1.4, e.z]; },
  chipx: () => [0.5, 1.2, -31.8],
  chip2: () => { const e = expertAt(1160); return [e.x, 1.42, e.z]; },
  skindeep: () => { const e = expertAt(1210); return [e.x, 1.45, e.z]; },
  shock: () => { const b = bankerAt(1290); return [b.x, 1.6, b.z]; },
  gone: () => [0, 2.6, 10.4],
  silent: () => { const b = bankerAt(1490); return [b.x, 1.35, b.z]; },
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const minerPos = (f) => { const m = minerAt(f); return [m.x, 0, m.z]; };
const buddyPos = (f) => { const b = buddyAt(f); return [b.x, 0, b.z]; };
const bankerPos = (f) => { const b = bankerAt(f); return [b.x, 0, b.z]; };
const expertPos = (f) => { const e = expertAt(f); return [e.x, 0, e.z]; };
const RIG_BY_ID = {
  // load: medium on the miner at the work crate, gun low in his hands
  load: { cut: 'hard', raw: pushInCam({ subject: minerPos, a: 0, b: 18, d0: 4.9, d1: 4.35, h0: 1.5, h1: 1.42, lookOff: [0, 1.32, 0], fov0: 40, fov1: 37,
    dir: () => [0.55, 0.83] }) },
  // insert: EXTREME close-up on the crate top — open breech, gold pour, snap shut
  insert: { cut: 'hard', raw: keysCam({ keys: [
    { f: 19, pos: [2.32, 1.48, 3.55], look: [1.98, 0.89, 2.40], fov: 33 },
    { f: 46, pos: [2.23, 1.41, 3.45], look: [1.97, 0.89, 2.43], fov: 31 },
    { f: 73, pos: [2.19, 1.39, 3.42], look: [1.96, 0.88, 2.47], fov: 31, ease: 'surge' }] }) },
  // fire1: back-left 3/4 close on the raise + shot, then push PAST him to the wall
  fire1: { cut: 'hard', raw: keysCam({ keys: [
    { f: 74, pos: [-0.7, 1.7, 3.85], look: [1.2, 1.42, 1.8], fov: 37 },
    { f: 94, pos: [0.9, 1.62, 3.6], look: [2.9, 1.6, 0.85], fov: 34 },
    { f: 130, pos: [1.55, 1.6, 2.75], look: [3.35, 1.72, 0.62], fov: 32, ease: 'surge' }] }) },
  // fire2: front-right diagonal — miner AND his left-wall target share the
  // frame axis, so the shot plays in one framing with a gentle push
  fire2: { cut: 'hard', raw: keysCam({ keys: [
    { f: 131, pos: [1.05, 1.72, 1.15], look: [-1.7, 1.45, -1.7], fov: 38 },
    { f: 153, pos: [0.55, 1.66, 0.35], look: [-2.6, 1.62, -2.45], fov: 34, ease: 'surge' }] }) },
  // fire3: over-shoulder deep, third shot into the right wall, push-in to the impact
  fire3: { cut: 'hard', raw: keysCam({ keys: [
    { f: 154, pos: [-1.0, 1.72, -2.1], look: [1.2, 1.38, -4.9], fov: 36 },
    { f: 186, pos: [0.55, 1.64, -3.3], look: [3.4, 1.58, -4.95], fov: 33, ease: 'surge' }] }) },
  // glitter: ride down the tracks past both sparkling walls, ending close on the buddy
  glitter: { cut: 'hard', raw: keysCam({ keys: [
    { f: 187, pos: [1.55, 1.72, 0.7], look: [-0.5, 1.42, -4.2], fov: 40 },
    { f: 226, pos: [0.7, 1.65, -2.3], look: [-1.6, 1.45, -5.6], fov: 37 },
    { f: 261, pos: [-0.55, 1.6, -4.6], look: [-2.35, 1.5, -6.45], fov: 34, ease: 'surge' }] }) },
  town: { cut: 'hard', raw: pushInCam({ subject: buddyPos, a: 262, b: 374, d0: 6.4, d1: 4.6, h0: 1.7, h1: 1.5, lookOff: [0, 1.3, 0], fov0: 40, fov1: 35,
    dir: () => [-0.3, 0.95] }) },
  offer: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 375, b: 483, d0: 7.2, d1: 4.9, h0: 1.8, h1: 1.55, lookOff: [0, 1.85, 0], fov0: 44, fov1: 36,
    dir: () => [0.25, 0.97] }) },
  // sparkle: medium-close — the banker's head turns, scanning the glittering walls
  sparkle: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 484, b: 545, d0: 4.3, d1: 3.55, h0: 1.58, h1: 1.52, lookOff: [0, 1.48, 0], fov0: 37, fov1: 33,
    dir: () => [0.5, 0.86] }) },
  // dance: closer — laugh, dance, begging all play on the face
  dance: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 546, b: 631, d0: 3.5, d1: 2.85, h0: 1.55, h1: 1.52, lookOff: [0, 1.55, 0], fov0: 33, fov1: 30,
    dir: () => [0.5, 0.86] }) },
  test: { cut: 'hard', raw: keysCam({ keys: [
    { f: 632, pos: [2.4, 1.85, -21.2], look: [-0.6, 1.15, -26.6], fov: 42 },
    { f: 724, pos: [1.9, 1.68, -22.9], look: [-0.9, 1.25, -26.8], fov: 36, ease: 'surge' }] }) },
  // dyn: push-in INSERT on the dynamite crate — sticks + burning fuse fill the frame
  dyn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 725, pos: [1.72, 1.38, -27.2], look: [2.8, 0.78, -30.4], fov: 36 },
    { f: 788, pos: [1.98, 1.16, -28.35], look: [2.93, 0.82, -30.55], fov: 32, ease: 'surge' }] }) },
  blast: { cut: 'hard', raw: keysCam({ keys: [
    { f: 789, pos: [1.3, 1.8, -24.2], look: [0.1, 1.9, -31], fov: 40 },
    { f: 838, pos: [1.15, 1.72, -25.2], look: [0.1, 2.0, -31.2], fov: 37, ease: 'surge' }] }) },
  // vein: push-in on the opening gold river, the banker big in frame reacting
  vein: { cut: 'hard', raw: keysCam({ keys: [
    { f: 839, pos: [0.95, 1.68, -25.5], look: [0.3, 1.82, -30.6], fov: 36 },
    { f: 920, pos: [0.8, 1.62, -26.5], look: [0.32, 1.78, -30.3], fov: 33, ease: 'surge' }] }) },
  // paid: push-in on the table — the sack handover plays centre-frame
  paid: { cut: 'hard', raw: pushInCam({ subject: () => [1.75, 0, 12.55], a: 921, b: 1043, d0: 6.4, d1: 4.9, h0: 2.0, h1: 1.7, lookOff: [0, 1.05, 0], fov0: 40, fov1: 35,
    dir: () => [0.35, 0.94] }) },
  chip: { cut: 'hard', raw: pushInCam({ subject: expertPos, a: 1044, b: 1089, d0: 3.9, d1: 3.5, h0: 1.55, h1: 1.52, lookOff: [0, 1.42, 0], fov0: 36, fov1: 33,
    dir: () => [0.55, 0.83] }) },
  // chipx: INSERT at the vein base — chisel arm big at frame left, lump + vein behind
  chipx: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1090, pos: [1.72, 1.32, -28.15], look: [0.42, 1.12, -31.7], fov: 31 },
    { f: 1145, pos: [1.55, 1.24, -28.6], look: [0.45, 1.15, -31.75], fov: 29, ease: 'surge' }] }) },
  chip2: { cut: 'hard', raw: pushInCam({ subject: expertPos, a: 1146, b: 1175, d0: 3.3, d1: 2.9, h0: 1.52, h1: 1.5, lookOff: [0, 1.44, 0], fov0: 33, fov1: 30,
    dir: () => [0.55, 0.83] }) },
  skindeep: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1176, pos: [2.8, 1.85, -24.5], look: [1.55, 1.6, -28.9], fov: 37 },
    { f: 1255, pos: [2.6, 1.78, -25.15], look: [1.72, 1.58, -28.85], fov: 34, ease: 'surge' }] }) },
  // shock: the banker's face fills the frame for the reveal snap + shake
  shock: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 1256, b: 1327, d0: 3.4, d1: 2.7, h0: 1.6, h1: 1.56, lookOff: [0, 1.58, 0], fov0: 34, fov1: 30,
    dir: () => [0.55, 0.83] }) },
  gone: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1328, pos: [7.6, 3.2, 22.0], look: [0, 3.05, 10.4], fov: 46 },
    { f: 1442, pos: [7.1, 3.15, 21.2], look: [-0.3, 3.0, 10.4], fov: 44, ease: 'surge' }] }) },
  silent: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 1443, b: 1543, d0: 5.2, d1: 3.6, h0: 1.7, h1: 1.55, lookOff: [0, 1.35, 0], fov0: 38, fov1: 33,
    dir: () => [0.3, 0.95] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 77, a: 0.05 }, { f: 140, a: 0.05 }, { f: 168, a: 0.05 }, { f: BLAST_F, a: 0.09 }],
  sigma: 2.3, fovSigma: 1.6,
});
// exposure flash: muzzle pops + the blast (builds ~6f, recovers ~10f)
const flashAt = (f) => {
  let v = 0;
  for (const ff of FIRE) if (f >= ff && f <= ff + 2) v = Math.max(v, 0.05);
  if (f >= BLAST_F - 6 && f < BLAST_F) v = Math.max(v, 0);           // the dim is in lightFor
  if (f >= BLAST_F && f <= BLAST_F + 3) v = Math.max(v, 0.92);
  if (f > BLAST_F + 3 && f <= BLAST_F + 14) v = Math.max(v, 0.92 * (1 - (f - BLAST_F - 3) / 11));
  return v;
};
export const camAt = (f) => ({ ...RIG.camAt(f), flash: flashAt(f) });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['glitter', 'gone'].includes(S.id)) cinf = 1.4;
  if (S.id === 'load') cinf = 2.8;
  if (S.id === 'sparkle') cinf = 3.2;
  if (['insert', 'fire2', 'fire3', 'dance', 'dyn', 'chip', 'chipx', 'chip2', 'skindeep', 'shock', 'blast', 'vein'].includes(S.id)) cinf = 3.6;
  if (S.id === 'fire1') cinf = 2.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), sk = sackAt(f);
  // blast / spark emitter anchor: gun wall hits, then the deep wall
  let bx = 3.3, by = 1.8, bz = 0.6;
  if (f >= 131 && f < 154) { bx = -3.3; by = 2.0; bz = -3; }
  else if (f >= 154 && f < 187) { bx = 3.35; by = 1.6; bz = -5.0; }
  else if (f >= 187 && f < 632) { bx = 3.3; by = 1.6; bz = -6; }
  if (S.id === 'blast' || S.id === 'vein' || S.id === 'test' || S.id === 'dyn') { bx = 0; by = 2.1; bz = -31; }
  if (S.id === 'chipx') { bx = 0.5; by = 1.2; bz = -31.8; }
  const ins = S.id === 'insert';
  return {
    always: 1,
    signK: S.id === 'offer' ? 1 - smooth(ramp(f, 400, 408)) : 1,
    lampK: S.light === 'day' || S.light === 'dusk' ? 0.25 : 1,
    coneK: S.id === 'load' ? 1 : S.id === 'insert' ? 0.35 : S.id === 'fire1' ? 0.5 : S.id === 'glitter' ? 0.3 : 0,
    veinK: veinAt(f), saltK: saltAt(f), saltP: saltParts(f), muzzleK: muzzleAt(f), fuseK: fuseAt(f),
    // the loading-insert rig (main.js): visible only in `insert`; gold pours
    // f44-62 (ahead of the word "gold" f49), the nugget drops f50-58, the
    // chambers read gold-filled from f54, the breech snaps shut f66-71.
    loadK: ins ? 1 : 0,
    pourK: ins ? smooth(ramp(f, 44, 50)) * (1 - smooth(ramp(f, 60, 66))) : 0,
    fillK: ins ? smooth(ramp(f, 54, 68)) : 0,
    breechK: ins ? smooth(ramp(f, 66, 71)) : 0,
    nugT: ins && f >= 50 && f <= 62 ? (f - 50) / 12 : -1,
    sackX: sk.x, sackY: sk.y, sackZ: sk.z, sackK: sk.k,
    blastX: bx, blastY: by, blastZ: bz,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  let blast = 0, spark = 0;
  for (const ff of FIRE) if (f >= ff && f <= ff + 16) { blast = Math.max(blast, 0.8); spark = Math.max(spark, 1.4); }
  if (f >= BLAST_F && f <= BLAST_F + 30) { blast = Math.max(blast, 2.6); spark = Math.max(spark, 1.2); }
  // chisel taps in the chip insert: a spark puff on each strike of the carve cycle
  if (S.id === 'chipx') spark = Math.max(spark, 0.85 * Math.pow(Math.abs(Math.sin(f * 0.5)), 6));
  return { moteRate: S.light === 'day' || S.light === 'dusk' ? 0.02 : 0.16, blastRate: blast, sparkRate: spark, steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
const TINT = { mine: '#ffe2bc', deep: '#ffd6a3', day: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  miner: { jacket: '#b3372a', pants: '#3a3230', boots: '#2a1c10', hat: 'miner', hatCol: '#7a5a30', suspenders: '#c9a15a', skin: '#fbf7ef' },
  buddy: { jacket: '#1f7a6a', pants: '#3a3a42', boots: '#241a12', hat: 'cap', cap: '#f2c230', skin: '#fbf7ef' },
  banker: { jacket: '#c9ccd2', pants: '#3c3a40', boots: '#1c1712', hat: 'tophat', hatCol: '#eceae4', hatBand: '#232028', shirtFront: '#f7f3e8', doubleButtons: true, buttons: '#26221f', bowtie: '#26221f', watch: true, skin: '#fbf7ef', moustache: '#2a201a', bigMoustache: true },
  expert: { jacket: '#5e2a4a', pants: '#33302c', boots: '#1c1712', hat: 'bowler', hatCol: '#211e24', knife: true, skin: '#fbf7ef', moustache: '#2a201a' },
};
// the expert's round glasses, drawn over the face card (card space 600x1000;
// head centre from T.headCenter(seed), eyes ~ +/-46 around cx=300)
const drawGlasses = (p) => {
  const hc = T.headCenter(71);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};

// ---------- HEAD PERFORMANCE (fix round 2) ----------
// Expressions MORPH on the narration's emphasis words (Emotion timelines set
// 0-5f before the word lands); heads nod, tilt, snap and turn toward whoever
// or whatever the voice names, via per-shot head tracks (headTilt in degrees
// about the chin, look/lookY pupil tracking, facing = head-turn shift), plus a
// continuous idle sway so no head is ever frozen. All values are quantised so
// card redraws happen only when the pose visibly changes.
// NOTE: T.Emotion is stateful (built for forward playback) — at(f) cannot
// random-access a pre-baked timeline, so the timelines live in this pure
// track folder instead: at(f) folds every event up to f, deterministically.
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
const emoMiner = emoTrack('smile', [
  [11, 'smug', 8], [70, 'determined', 6], [92, 'grin', 8], [128, 'determined', 6], [146, 'grin', 7],
  [160, 'determined', 6], [180, 'smug', 8], [262, 'smile', 8], [428, 'grin', 8], [498, 'smug', 8],
  [634, 'stern', 8], [828, 'smile', 9], [934, 'grin', 8], [1044, 'smile', 8], [1248, 'nervous', 10],
]);
const emoBuddy = emoTrack('grin', [
  [198, 'wonder', 8], [238, 'thinking', 10], [262, 'grin', 8], [638, 'nervous', 8], [848, 'grin', 9], [1330, 'laugh', 8],
]);
const emoBanker = emoTrack('smile', [
  [424, 'proud', 8], [468, 'smile', 8], [503, 'wonder', 7], [543, 'laugh', 6], [592, 'grin', 7],
  [640, 'smile', 8], [793, 'shock', 5], [872, 'grin', 9], [1004, 'proud', 8], [1046, 'smile', 8],
  [1292, 'shock', 5], [1458, 'sad', 12], [1504, 'thinking', 10],
]);
const emoExpert = emoTrack('neutral', [
  [438, 'thinking', 12], [630, 'neutral', 8], [1146, 'thinking', 9], [1180, 'stern', 10],
]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: 0, tint, ...extra }) });
  const m = minerAt(f), b = buddyAt(f), bk = bankerAt(f), ex = expertAt(f);
  const MP = emoMiner.at(f), BP = emoBuddy.at(f), KP = emoBanker.at(f), EP = emoExpert.at(f);
  switch (S.id) {
    case 'load': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.55],
        ...head(f, 31, kf([[0, -2], [11, -4], [18, -4]], f), 0.15, kf([[0, 0.3], [11, 0.55], [18, 0.55]], f), 0.25) }, m.x, m.z, { yaw: 0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.6, 0.2, 0.55) }, b.x, b.z, { yaw: -0.3 });
      break;
    }
    case 'insert': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.35],
        ...head(f, 31, -4 + nodAt(f, 35, 9, -1.6) + nodAt(f, 52, 9, -1.6), 0.3, 0.6 + nodAt(f, 35) + nodAt(f, 52), 0.35) }, m.x, m.z, { yaw: 0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.6, 0.3, 0.55) }, b.x, b.z, { yaw: -0.3 });
      break;
    }
    case 'fire1': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, kf([[74, -2], [78, -2], [84, 3.5], [92, 3.5], [100, -3], [130, -3]], f),
          kf([[74, 0.2], [84, 0.75], [130, 0.8]], f), 0.1, kf([[74, 0.2], [90, 0.65], [130, 0.65]], f)) }, m.x, m.z, { yaw: 0.55 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.6, 0.15, 0.55) }, b.x, b.z, { yaw: -0.3 });
      break;
    }
    case 'fire2': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, kf([[131, -2], [141, -2], [146, 3.5], [153, -2.5]], f), -0.7, 0.1, -0.6) }, m.x, m.z, { yaw: -0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.5, 0.1, 0.4) }, b.x, b.z, { yaw: -0.3 });
      break;
    }
    case 'fire3': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, kf([[154, -2], [169, -2], [174, 3.5], [186, -3]], f), 0.75, 0.1, 0.6) }, m.x, m.z, { yaw: 0.55 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.55, 0.1, 0.5) }, b.x, b.z, { yaw: -0.3 });
      break;
    }
    case 'glitter': {
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, kf([[187, 0], [204, -3], [221, -4.5], [236, 3], [261, 3.5]], f),
          kf([[187, 0.4], [215, 0.7], [245, 0.3], [261, 0.3]], f), -0.1 + nodAt(f, 219, 9, 0.25),
          kf([[187, 0.3], [210, 0.55], [240, 0.2], [261, 0.2]], f)) }, b.x, b.z, { yaw: -0.2 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, 0.4, 0.1, 0.3) }, m.x, m.z, { yaw: 0.4 });
      break;
    }
    case 'town': {
      const running = f >= 268 && f <= 330;
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: running ? 'march' : 'stand', phase: q((f * 0.014) % 1, 2), blink: blinkAt(f, 41), seed: 41, prop: f > 330 ? ['point', 0.85] : null,
        ...head(f, 41, running ? 2.2 * Math.sin(f * 0.3) : 0, 0.2, nodAt(f, 337) + nodAt(f, 345), 0.2) }, b.x, b.z, { yaw: 0.2 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.4, 0.05, -0.45) }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 'offer': {
      const walking = f >= 380 && f <= 440;
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: walking ? 'march' : 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51, prop: f >= 445 ? ['coin', 0.6] : null,
        ...head(f, 51, kf([[375, -1], [424, -3], [483, -3]], f), 0.2, -0.15 + nodAt(f, 446) + nodAt(f, 458), 0.15) }, bk.x, bk.z, { yaw: -0.25 });
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, kf([[375, 0], [438, -2.5], [483, -3]], f), 0.3, 0.05, 0.3) }, ex.x, ex.z, { yaw: 0.3, overlay: drawGlasses });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1.5, 0.45, 0.05, 0.4) }, m.x, m.z, { yaw: 0.45 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.3, 0.05, 0.3) }, b.x, b.z, { yaw: 0.3 });
      break;
    }
    case 'sparkle': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, kf([[484, 0], [518, -2], [545, -3]], f),
          kf([[484, -0.5], [512, 0.1], [530, 0.55], [545, 0.3]], f), -0.2,
          kf([[484, -0.55], [512, 0.1], [530, 0.6], [545, 0.3]], f)) }, bk.x, bk.z, { yaw: 0.15 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2.5, -0.5, 0.05, -0.5) }, m.x, m.z, { yaw: -0.5 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.5, 0.05, 0.5) }, b.x, b.z, { yaw: 0.5 });
      break;
    }
    case 'dance': {
      const laughPh = f < 586;
      std('banker', OUTFITS.banker, { expr: 'grin', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, laughPh ? -3 + 2.6 * Math.sin(f * 0.35) : kf([[586, -3], [596, -5], [631, -4]], f),
          -0.5, laughPh ? -0.15 : nodAt(f, 596) + nodAt(f, 607), -0.45, laughPh ? 0.04 + 0.045 * Math.sin(f * 0.35) : 0.02) },
        bk.x, bk.z, { yaw: 0.15, y: Math.abs(Math.sin(f * 0.3)) * 0.06 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2.5, -0.5, 0.05, -0.5) }, m.x, m.z, { yaw: -0.5 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.5, 0.05, 0.5) }, b.x, b.z, { yaw: 0.5 });
      break;
    }
    case 'test': case 'dyn': {
      std('miner', OUTFITS.miner, { expr: 'stern', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: S.id === 'test' ? ['point', 0.7] : null,
        ...head(f, 31, 1, -0.3, nodAt(f, 690, 11, 0.3), -0.35) }, m.x, m.z, { yaw: -0.4 });
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.25, 0.05, 0.3) }, bk.x, bk.z, { yaw: 0.35 });
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1, -0.25, 0.1, -0.3) }, ex.x, ex.z, { yaw: -0.3, overlay: drawGlasses });
      std('buddy', OUTFITS.buddy, { expr: 'nervous', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1.5, 0.35, 0.1, 0.4) }, b.x, b.z, { yaw: 0.4 });
      break;
    }
    case 'blast': case 'vein': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, S.id === 'blast'
          ? kf([[789, -1], [796, -6], [806, -5], [838, -2]], f)
          : kf([[839, -4], [872, -2], [906, -3.5], [920, -3.5]], f) + nodAt(f, 885) + nodAt(f, 899, 9, -1.2),
          S.id === 'blast' ? 0.2 : 0.45, S.id === 'blast' ? -0.4 : 0.1 + nodAt(f, 885, 9, 0.2), S.id === 'blast' ? 0.2 : 0.35,
          S.id === 'blast' ? kf([[789, 0], [797, 0.12], [810, 0.02], [838, 0]], f) : 0) }, bk.x, bk.z, { yaw: 0.3 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.35, 0.05, -0.4) }, m.x, m.z, { yaw: -0.4 });
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, -0.3, 0.05, -0.3) }, ex.x, ex.z, { yaw: -0.3, overlay: drawGlasses });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.35, 0.05, 0.4) }, b.x, b.z, { yaw: 0.4 });
      break;
    }
    case 'paid': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: f >= 930 && f <= 990 ? ['coin', 0.55] : null,
        ...head(f, 51, -2.5, 0.2, kf([[921, 0], [936, 0.45], [992, 0.45], [1010, 0], [1043, -0.1]], f) + nodAt(f, 932) + nodAt(f, 941), 0.25) }, bk.x, bk.z, { yaw: 0.3 });
      std('miner', OUTFITS.miner, { expr: 'grin', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, -0.3, 0.3, -0.3) }, m.x, m.z, { yaw: -0.35 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2, -0.25, 0.1, -0.2) }, b.x, b.z, { yaw: -0.2 });
      break;
    }
    case 'chip': case 'chipx': case 'chip2': {
      const tapping = f >= 1090 && f <= 1145;
      const expertOpts = S.id === 'chip'
        ? { prop: f >= 1084 ? ['carve', q(0.4 + 0.4 * Math.abs(Math.sin(f * 0.5)), 2)] : null,
            ...head(f, 71, kf([[1044, -1], [1090, -2.5]], f), 0.15, kf([[1044, 0.3], [1090, 0.55]], f), 0.2) }
        : S.id === 'chipx'
        ? { prop: ['carve', q(0.4 + 0.4 * Math.abs(Math.sin(f * 0.5)), 2)],
            ...head(f, 71, -3.5 - 0.8 * Math.abs(Math.sin(f * 0.5)), 0.1, 0.6, 0.15) }
        : { prop: ['coin', 0.5],
            ...head(f, 71, kf([[1146, -3], [1162, -4.5], [1175, -5.5]], f),
              kf([[1146, 0.1], [1170, 0.45], [1175, 0.45]], f), kf([[1146, 0.55], [1168, 0.1], [1175, 0.1]], f),
              kf([[1146, 0.15], [1172, 0.4], [1175, 0.4]], f)) };
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...expertOpts }, ex.x, ex.z, { yaw: 0.25, overlay: drawGlasses });
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.4, 0.1, 0.4) }, bk.x, bk.z, { yaw: 0.4 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.35, 0.05, -0.4) }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 'skindeep': {
      std('expert', OUTFITS.expert, { expr: 'stern', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['coin', 0.5],
        ...head(f, 71, kf([[1176, -5.5], [1255, -7]], f), 0.3, 0.35, kf([[1176, 0.4], [1244, 0.5], [1255, 0.5]], f)) }, ex.x, ex.z, { yaw: 0.25, overlay: drawGlasses });
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.35, 0.1, 0.35) }, bk.x, bk.z, { yaw: 0.4 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.35, 0.05, -0.4) }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 'shock': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, kf([[1256, -1], [1292, -1], [1296, -8], [1304, -6], [1312, -7.5], [1320, -6], [1327, -6.5]], f),
          0.2, kf([[1256, 0.1], [1296, -0.55], [1327, -0.4]], f), 0.3,
          kf([[1256, 0], [1296, 0.13], [1306, 0.03], [1327, 0.02]], f)) }, bk.x, bk.z, { yaw: 0.4 });
      std('expert', OUTFITS.expert, { expr: 'stern', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['coin', 0.5],
        ...head(f, 71, -7, 0.5, 0.2, 0.5) }, ex.x, ex.z, { yaw: 0.25, overlay: drawGlasses });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 2, -0.3, 0.2, -0.3) }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 'gone': {
      std('miner', OUTFITS.miner, { expr: 'grin', exprP: MP, mode: 'march', phase: q((f * 0.012) % 1, 2), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1.8 * Math.sin(f * 0.24), 0.2, 0, 0.3) }, m.x, m.z, { yaw: 0.3, s: 0.92 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'march', phase: q((f * 0.012 + 0.4) % 1, 2), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1.8 * Math.sin(f * 0.24 + 1.3), 0.2, -0.1, 0.3) }, b.x, b.z, { yaw: 0.3, s: 0.92 });
      break;
    }
    case 'silent': {
      std('banker', OUTFITS.banker, { expr: 'neutral', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, kf([[1443, 4.5], [1458, 5.5], [1490, 5], [1506, 1.5], [1543, -3.5]], f),
          kf([[1443, 0.1], [1510, -0.15], [1543, -0.1]], f), kf([[1443, 0.5], [1490, 0.45], [1510, 0], [1543, -0.15]], f), 0.1) }, bk.x, bk.z, { yaw: 0.1 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-5.2, -3.4, -32.5, 10, { h: 5.4, id: 'wallL' }),
  SOL.aabb(3.4, 5.2, -32.5, 10, { h: 5.4, id: 'wallR' }),
  SOL.aabb(-5.2, 5.2, -34.2, -32.4, { h: 6, id: 'endwall' }),
  SOL.aabb(-14.8, -3.6, 6.8, 10.6, { h: 12, id: 'faceL' }),
  SOL.aabb(3.6, 14.8, 6.8, 10.6, { h: 12, id: 'faceR' }),
  SOL.circle(0, -5, 1.05, { h: 1.2, id: 'cart' }),
  SOL.circle(2.95, -30.6, 0.55, { h: 0.6, id: 'crate' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(2.02, 2.32, 0.55, { h: 0.78, id: 'loadcrate' }),
  SOL.circle(-4.6, 11.5, 0.5, { h: 1.8, id: 'crates' }),
  SOL.circle(4.8, 11.8, 0.36, { h: 0.95, id: 'barrel' }),
  ...[5, -1, -7, -13, -19, -25].flatMap((fz) => [SOL.circle(-3.2, fz, 0.17, { h: 4.6, id: 'post' }), SOL.circle(3.2, fz, 0.17, { h: 4.6, id: 'post' })]),
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
  const sk = sackAt(f);
  if (sk.k > 0.01 && f < 936) items.push({ id: 'sacks', y: sk.y - 0.196, ground: 0.78, maxHover: 0.05 });
  return items;
};
