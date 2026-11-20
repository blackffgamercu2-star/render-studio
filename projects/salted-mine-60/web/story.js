// Shot plan for "The Salted Mine" — SALTED-60: the Kit #4 25-shot remake.
// The ORIGINAL source narration (kit clean transcript, voiced by Abid's own
// tren voice) staged on the approved Salted Mine coded set: mine tunnel
// interior (rails, timbers, lanterns) + entrance yard with the SURE THING
// MINE sign. Exactly 60.000 s / 1800 frames @30 fps. Every kit shot boundary
// (SHOT_PLAN_60S target timecodes) is a shot boundary below; inside kit
// shot 3 the reference's 1-2 s coverage rhythm is kept with sub-shots
// (loadgun/fire1/fire2/fire3/glitter). Scene changes ONLY on voice clauses.
// ERRATA applied (images beat kit text): the buyer's top hat is SILVER with
// a black band; the final reveal follows shot_025_last.jpg — buyer
// centre-left, closed happy eyes, vein CENTRE, tape on the floor centre,
// pickaxe + miner hat right foreground, handwritten '10 FT' board low
// centre. Dialogue lines are PERFORMED (speak.js lip-sync on those beats
// only); everything else is voice-over. No character speaks at the end.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, winkTrack } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1800, DECK = 0;
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
export const SHOTS = [
  { id: 's01', a: 0, b: 24, light: 'mine' },
  { id: 's02', a: 25, b: 58, light: 'mine' },
  { id: 's03a', a: 59, b: 84, light: 'mine' },
  { id: 's03b', a: 85, b: 118, light: 'mine' },
  { id: 's03c', a: 119, b: 141, light: 'mine' },
  { id: 's03d', a: 142, b: 159, light: 'mine' },
  { id: 's04', a: 160, b: 227, light: 'mine' },
  { id: 's05', a: 228, b: 289, light: 'mine' },
  { id: 's06', a: 290, b: 464, light: 'day' },
  { id: 's07', a: 465, b: 559, light: 'day' },
  { id: 's08', a: 560, b: 632, light: 'day' },
  { id: 's09a', a: 633, b: 652, light: 'day' },
  { id: 's09b', a: 653, b: 722, light: 'mine' },
  { id: 's10', a: 723, b: 809, light: 'mine' },
  { id: 's11', a: 810, b: 850, light: 'mine' },
  { id: 's12', a: 851, b: 883, light: 'mine' },
  { id: 's13', a: 884, b: 979, light: 'mine' },
  { id: 's14', a: 980, b: 1001, light: 'mine' },
  { id: 's15', a: 1002, b: 1020, light: 'mine' },
  { id: 's16', a: 1021, b: 1091, light: 'mine' },
  { id: 's17', a: 1092, b: 1183, light: 'mine' },
  { id: 's18', a: 1184, b: 1258, light: 'mine' },
  { id: 's19', a: 1259, b: 1362, light: 'day' },
  { id: 's20', a: 1363, b: 1508, light: 'mine' },
  { id: 's21', a: 1509, b: 1565, light: 'deep' },
  { id: 's22', a: 1566, b: 1584, light: 'deep' },
  { id: 's23', a: 1585, b: 1612, light: 'deep' },
  { id: 's24', a: 1613, b: 1641, light: 'deep' },
  { id: 's25', a: 1642, b: 1799, light: 'deep' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (same approved grade family as V3) ----------
export const LIGHTS = {
  mine: { az: 205, el: 38, sky: '#7a5636', ground: '#33241a', hemi: 1.02, sun: '#ffb45e', sunI: 1.3, fog: '#402a12', fogNear: 9, fogFar: 62,
    skyTop: '#241a10', skyHor: '#5a3d1e', sunDisc: '#000000', sunSize: 0, sat: 1.1, vig: 0.24, shadowExt: 16, aurora: 0, gain: '#ffe9c2',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  deep: { az: 205, el: 38, sky: '#5f422a', ground: '#241a10', hemi: 0.9, sun: '#ff9e4e', sunI: 1.25, fog: '#2e1c0a', fogNear: 5, fogFar: 44,
    skyTop: '#180f08', skyHor: '#402a14', sunDisc: '#000000', sunSize: 0, sat: 1.08, vig: 0.3, shadowExt: 16, aurora: 0, gain: '#ffe0ae',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  day: { az: 232, el: 30, sky: '#f6dcae', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
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
const DIM = { ...LIGHTS.deep, hemi: 0.34, sunI: 0.4, gain: '#8a6a4a' };
export const lightFor = (S, f) => {
  // exposure choreography: s24 dims as the blast comes, s25 recovers into
  // the warm gold of the revealed vein
  if (S.id === 's24') return blendLight(LIGHTS.deep, DIM, smooth(ramp(f, 1618, 1632)));
  if (S.id === 's25') {
    const gold = { ...LIGHTS.deep, hemi: 0.95, sunI: 1.15, gain: '#ffe4b0', fog: '#33200c' };
    return blendLight(DIM, gold, smooth(ramp(f, 1642, 1700)));
  }
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const SIGN_POS = [0, 6.35, 10.45];
export const BOARD_POS = SIGN_POS;
const TABLE = { x: 3.6, z: 13.2 };
// gunfire frames (inside kit shot 3's coverage) + the dynamite blast
export const FIRE = [96, 124, 146];
export const BLAST_F = 1636;
export const saltAt = (f) => {
  let s = 0;
  const up = (a, b, v) => { if (f >= a) s = Math.max(s, v * smooth(ramp(f, a, b))); };
  up(96, 118, 0.35); up(124, 141, 0.7); up(146, 159, 1);
  return s;
};
export const saltParts = (f) => [
  f >= 96 ? smooth(ramp(f, 96, 118)) : 0,
  f >= 124 ? smooth(ramp(f, 124, 141)) : 0,
  f >= 146 ? smooth(ramp(f, 146, 159)) : 0,
];
// the vein stays HIDDEN behind its slabs until the blast's dust clears
export const veinAt = (f) => smooth(ramp(f, 1652, 1710));
export const muzzleAt = (f) => Math.max(...FIRE.map((ff) => (f >= ff && f <= ff + 3 ? 1 - (f - ff) / 4 : 0)), 0);
export const fuseAt = (f) => (f >= 1530 && f < 1613 ? 1 : 0);
// the flying dynamite: released at f1570 from the buyer's hand, tumbling
// down the tunnel to the deep wall (blast at f1636)
export const dynAt = (f) => {
  if (f < 1570 || f > 1612) return { k: 0, x: 0, y: 0, z: 0, rx: 0, rz: 0 };
  const u = (f - 1570) / 42;
  return { k: 1, x: lerp(1.05, 0, u), y: (1 - u) * 1.3 + u * 0.32 + Math.sin(u * Math.PI) * 0.55, z: lerp(0.9, -23.5, u * u * 0.4 + u * 0.6), rx: u * 9, rz: u * 3 };
};
export const sackAt = (f) => {
  // the miner's last-money sack sits on the yard table during the purchase
  if (f >= 465 && f <= 559) return { x: TABLE.x, y: 0.98, z: TABLE.z, k: ramp(f, 465, 473) * (1 - ramp(f, 552, 559)) };
  // the payment: sacks travel from the buyer to the bolting miner (s19)
  if (f >= 1259 && f <= 1362) {
    const u = smooth(ramp(f, 1282, 1302));
    return { x: lerp(2.0, -1.2, u), y: lerp(1.02, 1.05, u) + Math.sin(u * Math.PI) * 0.15, z: lerp(12.7, 13.4, u), k: 1 };
  }
  return { x: TABLE.x, y: 0.98, z: TABLE.z, k: 0 };
};
// actor anchors per shot (single source; checked against STATICS)
export const minerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's01': case 's02': case 's03a': case 's03b': return { x: 1.02, z: 1.88 };
    case 's03c': return { x: -1.6, z: -1.5 };
    case 's03d': case 's03e': case 's04': case 's05': return { x: 1.6, z: -4.2 };
    case 's06': return { x: -1.7, z: 11.6 };
    case 's07': return { x: 2.3, z: 12.3 };
    case 's10': case 's13': case 's14': case 's16': case 's17': case 's18': return { x: -1.9, z: -3.4 };
    case 's19': { const u = ramp(f, 1280, 1362); return { x: lerp(0.2, -4, u), z: lerp(11.9, 14, u) }; }
    default: return { x: -3.5, z: 12 };
  }
};
export const buddyAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's01': case 's02': case 's03a': case 's03b': return { x: -1.8, z: 2.6 };
    case 's03c': case 's03d': case 's03e': case 's04': case 's05': return { x: -2.4, z: -6.5 };
    case 's06': return { x: -2.9, z: 12.4 };
    case 's07': return { x: 1.2, z: 11.8 };
    case 's10': case 's13': case 's14': case 's16': case 's17': case 's18': return { x: -2.6, z: -5.8 };
    case 's19': { const u = ramp(f, 1280, 1362); return { x: lerp(1.6, -3, u), z: lerp(12.6, 14.8, u) }; }
    default: return { x: 3.4, z: 12 };
  }
};
export const bankerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's08': { const u = smooth(ramp(f, 566, 626)); return { x: lerp(2.6, 1.8, u), z: lerp(19.5, 13.8, u) }; }
    case 's09a': { const u = smooth(ramp(f, 633, 650)); return { x: lerp(1.8, 0.9, u), z: lerp(13.8, 8.6, u) }; }
    case 's09b': { const u = smooth(ramp(f, 653, 672)); return { x: lerp(0.9, 0.7, u), z: lerp(8.6, 3.55, u) }; }
    case 's10': case 's13': case 's14': case 's16': case 's17': case 's18': return { x: 0.9, z: -3.6 };
    case 's19': return { x: 2.2, z: 12.9 };
    case 's20': case 's21': case 's22': return { x: 0.5, z: 0.8 };
    case 's23': return { x: 0.5, z: 1.5 };
    case 's24': { const u = ramp(f, 1613, 1641); return { x: lerp(0.5, 0.3, u), z: lerp(-1, 4.6, u) }; }
    case 's25': return { x: -0.85, z: -29.2 };
    default: return { x: 8, z: 20 };
  }
};
export const expertAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's08': { const u = smooth(ramp(f, 572, 630)); return { x: lerp(3.4, 3.0, u), z: lerp(20.5, 15.2, u) }; }
    case 's09a': { const u = smooth(ramp(f, 638, 652)); return { x: lerp(2.4, 2.0, u), z: lerp(15.6, 10.6, u) }; }
    case 's09b': { const u = smooth(ramp(f, 658, 700)); return { x: lerp(2.0, 1.9, u), z: lerp(6.8, 5.6, u) }; }
    case 's10': case 's11': case 's13': case 's14': case 's16': case 's17': case 's18': return { x: 2.35, z: -5.35 };
    default: return { x: 9, z: 21 };
  }
};
// the shotgun: held low in s01; on the crate rig in s02 (gunAt hides — the
// shells are the subject); in s03a the miner KNEELS, breech opens, both
// filled shells slide in, barrel snaps shut and the gun raises into the
// s03b aim — one continuous action, poses at the miner's chest.
export const gunAt = (f) => {
  const S = shotAt(f);
  const m = minerAt(f);
  const recoil = Math.max(...FIRE.map((ff) => (f >= ff && f <= ff + 5 ? Math.sin((f - ff) / 5 * Math.PI) * 0.14 : 0)), 0);
  const low = { x: m.x + 0.30, y: 1.04, z: m.z + 0.30, ry: 0.55, rx: 0.42 };
  const aim = { x: m.x + 0.30, y: 1.17, z: m.z + 0.10, ry: 1.22, rx: -0.04 };
  if (S.id === 's01') return { k: 1, ...low, rz: 0 };
  if (S.id === 's03a') {
    const held = { x: m.x + 0.42, y: 0.80, z: m.z + 0.33, ry: 0.95, rx: 0.18 };
    const u = smooth(ramp(f, 79, 82));
    return { k: 1, x: lerp(held.x, aim.x, u), y: lerp(held.y, aim.y, u), z: lerp(held.z, aim.z, u),
      ry: lerp(held.ry, aim.ry, u), rx: lerp(held.rx, aim.rx, u), rz: 0 };
  }
  if (S.id === 's03b') return { k: 1, ...aim, rz: -recoil };
  if (S.id === 's03c') return { k: 1, x: m.x - 0.30, y: 1.17, z: m.z + 0.05, ry: -1.22, rx: -0.04, rz: recoil };
  if (S.id === 's03d') return { k: 1, x: m.x + 0.30, y: 1.17, z: m.z + 0.08, ry: 1.78, rx: -0.02, rz: -recoil };
  return { k: 0, x: 0, y: 0, z: 0 };
};

// ---------- hero / focus ----------
const FOCUS = {
  s01: () => { const m = minerAt(9); return [m.x, 1.45, m.z]; },
  s02: () => [1.96, 0.88, 2.47],
  s03a: () => [1.45, 0.9, 2.2],
  s03b: () => [3.3, 1.75, 0.65],
  s03c: () => { const m = minerAt(130); return [m.x, 1.6, m.z]; },
  s03d: () => [2.2, 1.6, -4.7],
  s03e: () => { const b = buddyAt(220); return [b.x, 1.5, b.z]; },
  s04: () => { const b = buddyAt(195); return [b.x, 1.45, b.z]; },
  s05: () => { const m = minerAt(258); return [m.x, 1.5, m.z]; },
  s06: () => [0, 2.6, 10.4],
  s07: () => [3.0, 1.0, 12.7],
  s08: () => { const b = bankerAt(600); return [b.x, 1.4, b.z]; },
  s09a: () => { const b = bankerAt(642); return [b.x, 1.45, b.z]; },
  s09b: () => { const b = bankerAt(705); return [b.x, 1.5, b.z]; },
  s10: () => { const e = expertAt(760); return [e.x, 1.35, e.z]; },
  s11: () => [2.62, 0.92, -6.2],
  s12: () => [2.68, 0.88, -6.28],
  s13: () => { const e = expertAt(950); return [e.x, 1.45, e.z]; },
  s14: () => { const e = expertAt(993); return [e.x, 1.5, e.z]; },
  s15: () => [3.45, 1.6, -5],
  s16: () => { const e = expertAt(1035); return [e.x, 1.42, e.z]; },
  s17: () => { const b = bankerAt(1150); return [b.x, 1.55, b.z]; },
  s18: () => { const b = buddyAt(1220); return [b.x, 1.45, b.z]; },
  s19: () => [0, 1.2, 12.6],
  s20: () => { const b = bankerAt(1430); return [b.x, 1.4, b.z]; },
  s21: () => [0.9, 1.18, 0.9],
  s22: () => [0.3, 1.15, -1],
  s23: () => [0, 0.8, -10],
  s24: () => { const b = bankerAt(1627); return [b.x, 1.35, b.z]; },
  s25: () => [0.15, 1.8, -31],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: reference rhythm — hard cuts, every shot its own size
// with a slow push; NO shake, NO frozen frames ----------
const minerPos = (f) => { const m = minerAt(f); return [m.x, 0, m.z]; };
const buddyPos = (f) => { const b = buddyAt(f); return [b.x, 0, b.z]; };
const bankerPos = (f) => { const b = bankerAt(f); return [b.x, 0, b.z]; };
const expertPos = (f) => { const e = expertAt(f); return [e.x, 0, e.z]; };
const RIG_BY_ID = {
  s01: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [0.15, 1.52, 5.7], look: [1.12, 1.28, 1.95], fov: 38 },
    { f: 24, pos: [0.3, 1.5, 5.35], look: [1.14, 1.3, 1.95], fov: 36, ease: 'surge' }] }) },
  s02: { cut: 'hard', raw: keysCam({ keys: [
    { f: 25, pos: [2.42, 1.45, 3.66], look: [1.96, 0.88, 2.45], fov: 31 },
    { f: 58, pos: [2.28, 1.37, 3.48], look: [1.97, 0.86, 2.44], fov: 29, ease: 'surge' }] }) },
  s03a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 59, pos: [0.05, 1.3, 4.45], look: [1.4, 0.85, 2.2], fov: 33 },
    { f: 82, pos: [0.22, 1.24, 4.18], look: [1.42, 0.84, 2.2], fov: 31, ease: 'surge' }] }) },
  s03b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 85, pos: [0.2, 1.62, 4.6], look: [1.5, 1.3, 1.8], fov: 37 },
    { f: 96, pos: [0.75, 1.62, 3.85], look: [2.55, 1.5, 1.1], fov: 34, ease: 'smooth' },
    { f: 118, pos: [1.35, 1.6, 3.0], look: [3.0, 1.6, 0.8], fov: 32, ease: 'surge' }] }) },
  s03c: { cut: 'hard', raw: keysCam({ keys: [
    { f: 119, pos: [0.6, 1.66, 1.6], look: [-1.2, 1.5, -1.6], fov: 37 },
    { f: 141, pos: [-0.4, 1.64, -0.2], look: [-3.3, 1.85, -2.9], fov: 33, ease: 'surge' }] }) },
  s03d: { cut: 'hard', raw: keysCam({ keys: [
    { f: 142, pos: [-0.6, 1.7, -1.6], look: [1.3, 1.4, -4.6], fov: 37 },
    { f: 159, pos: [0.7, 1.64, -3.2], look: [3.4, 1.58, -4.95], fov: 33, ease: 'surge' }] }) },
    s04: { cut: 'hard', raw: pushInCam({ subject: buddyPos, a: 160, b: 227, d0: 3.1, d1: 2.55, h0: 1.52, h1: 1.5, lookOff: [0, 1.42, 0], fov0: 34, fov1: 30,
    dir: () => [0.55, 0.83] }) },
  s05: { cut: 'hard', raw: pushInCam({ subject: minerPos, a: 228, b: 289, d0: 3.3, d1: 2.7, h0: 1.54, h1: 1.52, lookOff: [0, 1.45, 0], fov0: 34, fov1: 30,
    dir: () => [-0.5, 0.86] }) },
  s06: { cut: 'hard', raw: keysCam({ keys: [
    { f: 290, pos: [7.5, 3.4, 24], look: [0, 3.2, 10.4], fov: 44 },
    { f: 464, pos: [6.6, 3.1, 22.4], look: [0, 3.1, 10.4], fov: 41, ease: 'surge' }] }) },
  s07: { cut: 'hard', raw: pushInCam({ subject: () => [3.0, 0, 12.7], a: 465, b: 559, d0: 5.2, d1: 4.2, h0: 1.6, h1: 1.45, lookOff: [0, 1.0, 0], fov0: 38, fov1: 34,
    dir: () => [0.3, 0.95] }) },
  s08: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 560, b: 632, d0: 7.4, d1: 5.4, h0: 1.8, h1: 1.6, lookOff: [0, 1.5, 0], fov0: 42, fov1: 36,
    dir: () => [0.3, 0.95] }) },
  s09a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 633, pos: [2.4, 1.7, 12.8], look: [1.2, 1.4, 9.5], fov: 38 },
    { f: 652, pos: [2.25, 1.65, 12.2], look: [1.1, 1.42, 9.0], fov: 35, ease: 'surge' }] }) },
  s09b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 653, pos: [2.4, 1.65, 0.4], look: [0.7, 1.4, 3.4], fov: 36 },
    { f: 722, pos: [2.15, 1.6, 0.75], look: [0.7, 1.42, 3.45], fov: 32, ease: 'surge' }] }) },
  s10: { cut: 'hard', raw: keysCam({ keys: [
    { f: 723, pos: [0.4, 1.7, -1.6], look: [2.9, 1.35, -5.2], fov: 38 },
    { f: 809, pos: [0.7, 1.6, -2.6], look: [3.1, 1.3, -5.3], fov: 33, ease: 'surge' }] }) },
  s11: { cut: 'hard', raw: keysCam({ keys: [
    { f: 810, pos: [0.9, 1.35, -3.4], look: [2.55, 0.95, -6.1], fov: 34 },
    { f: 850, pos: [1.05, 1.25, -3.9], look: [2.62, 0.92, -6.2], fov: 30, ease: 'surge' }] }) },
  s12: { cut: 'hard', raw: keysCam({ keys: [
    { f: 851, pos: [1.85, 1.25, -4.7], look: [2.68, 0.88, -6.28], fov: 30 },
    { f: 883, pos: [1.95, 1.18, -5.05], look: [2.68, 0.88, -6.28], fov: 27, ease: 'surge' }] }) },
  s13: { cut: 'hard', raw: pushInCam({ subject: expertPos, a: 884, b: 979, d0: 3.2, d1: 2.6, h0: 1.52, h1: 1.5, lookOff: [0, 1.42, 0], fov0: 33, fov1: 29,
    dir: () => [0.55, 0.83] }) },
  s14: { cut: 'hard', raw: keysCam({ keys: [
    { f: 980, pos: [1.15, 1.62, -3.55], look: [2.3, 1.5, -5.3], fov: 28 },
    { f: 1001, pos: [1.3, 1.6, -3.85], look: [2.32, 1.5, -5.32], fov: 26, ease: 'surge' }] }) },
  s15: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1002, pos: [1.7, 1.7, -3.3], look: [3.45, 1.62, -4.98], fov: 29 },
    { f: 1020, pos: [1.95, 1.66, -3.75], look: [3.47, 1.62, -4.99], fov: 26, ease: 'surge' }] }) },
  s16: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1021, pos: [-0.6, 1.66, -1.4], look: [1.6, 1.4, -4.9], fov: 37 },
    { f: 1091, pos: [-0.3, 1.6, -2.2], look: [1.2, 1.42, -4.7], fov: 33, ease: 'surge' }] }) },
  s17: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 1092, b: 1183, d0: 3.6, d1: 2.8, h0: 1.56, h1: 1.54, lookOff: [0, 1.52, 0], fov0: 34, fov1: 29,
    dir: () => [0.5, 0.86] }) },
  s18: { cut: 'hard', raw: pushInCam({ subject: buddyPos, a: 1184, b: 1258, d0: 3.4, d1: 2.8, h0: 1.52, h1: 1.5, lookOff: [0, 1.42, 0], fov0: 34, fov1: 30,
    dir: () => [0.55, 0.83] }) },
  s19: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1259, pos: [6.8, 2.6, 20.5], look: [0.4, 1.2, 12.4], fov: 40 },
    { f: 1362, pos: [6.2, 2.45, 19.6], look: [-0.6, 1.2, 13], fov: 37, ease: 'surge' }] }) },
  s20: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 1363, b: 1508, d0: 4.6, d1: 3.4, h0: 1.62, h1: 1.56, lookOff: [0, 1.4, 0], fov0: 38, fov1: 32,
    dir: () => [0.45, 0.89] }) },
  s21: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1509, pos: [1.9, 1.5, 3.1], look: [0.85, 1.15, 0.95], fov: 32 },
    { f: 1565, pos: [1.7, 1.42, 2.75], look: [0.9, 1.18, 0.9], fov: 28, ease: 'surge' }] }) },
  s22: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1566, pos: [1.9, 1.6, 3.3], look: [0.6, 1.25, 0.2], fov: 36 },
    { f: 1584, pos: [1.5, 1.55, 2.2], look: [0.2, 1.1, -3], fov: 33, ease: 'surge' }] }) },
  s23: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1585, pos: [1.3, 1.7, 1.8], look: [0.1, 0.9, -8], fov: 38 },
    { f: 1612, pos: [1.0, 1.6, -1.6], look: [0, 0.7, -16], fov: 35, ease: 'surge' }] }) },
  s24: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1613, pos: [0.4, 1.66, 7.8], look: [0.35, 1.35, 0.5], fov: 38 },
    { f: 1641, pos: [0.5, 1.6, 7.2], look: [0.3, 1.3, 1.5], fov: 35, ease: 'surge' }] }) },
  s25: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1642, pos: [0.8, 1.95, -18.6], look: [0.1, 1.5, -30.4], fov: 38 },
    { f: 1799, pos: [0.6, 1.85, -20.4], look: [0.12, 1.45, -30.6], fov: 35, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 96, a: 0.05 }, { f: 124, a: 0.05 }, { f: 146, a: 0.04 }, { f: BLAST_F, a: 0.09 }],
  sigma: 2.3, fovSigma: 1.6,
});
// exposure flash: muzzle pops + the blast (builds ~6f, recovers ~10f)
const flashAt = (f) => {
  let v = 0;
  for (const ff of FIRE) if (f >= ff && f <= ff + 2) v = Math.max(v, 0.05);
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
  if (['s06', 's19', 's03e'].includes(S.id)) cinf = 1.4;
  if (S.id === 's01') cinf = 2.8;
  if (['s02', 's03a', 's03c', 's03d', 's10', 's11', 's12', 's13', 's14', 's15', 's16', 's21', 's22'].includes(S.id)) cinf = 3.6;
  if (S.id === 's03b') cinf = 2.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), sk = sackAt(f), dyn = dynAt(f);
  let bx = 3.3, by = 1.8, bz = 0.6;
  if (f >= 119 && f < 142) { bx = -3.3; by = 2.0; bz = -3; }
  else if (f >= 142 && f < 228) { bx = 3.35; by = 1.6; bz = -5.0; }
  if (S.id === 's10') { bx = 3.3; by = 1.7; bz = -5; }
  if (dyn.k) { bx = dyn.x; by = dyn.y; bz = dyn.z; }
  if (S.id === 's24' || S.id === 's25') { bx = 0; by = 2.1; bz = -31; }
  const ins = S.id === 's02', lg = S.id === 's03a';
  // fuse glow anchor: the buyer's hand while he lights it (s21/s22), then
  // the flying stick itself (s23 via dyn), else the deep crate (unused)
  let fuseX = 2.95, fuseY = 1.02, fuseZ = -30.6;
  if (f >= 1530 && f < 1570) { fuseX = 1.02; fuseY = 1.28; fuseZ = 0.95; }
  else if (dyn.k) { fuseX = dyn.x; fuseY = dyn.y + 0.05; fuseZ = dyn.z - 0.26; }
  return {
    always: 1,
    // the sign board is only framed (and only checked) in the establishing
    // exterior; everywhere else it is simply not shown
    signK: S.id === 's06' ? 1 : 0,
    lampK: S.light === 'day' ? 0.25 : 1,
    coneK: S.id === 's01' ? 1 : S.id === 's02' ? 0.35 : S.id === 's03a' ? 0.4 : S.id === 's03b' ? 0.5 : S.id === 's03d' ? 0.3 : 0,
    veinK: veinAt(f), saltK: saltAt(f), saltP: saltParts(f), muzzleK: muzzleAt(f), fuseK: fuseAt(f),
    fuseX, fuseY, fuseZ,
    // the insert rig: gold POURS into the shells (s02), then in s03a the
    // filled shells are picked up and LOADED INTO THE OPEN GUN
    loadK: ins || lg ? 1 : 0,
    pourK: ins ? smooth(ramp(f, 34, 40)) * (1 - smooth(ramp(f, 48, 54))) : 0,
    fillK: ins ? smooth(ramp(f, 44, 57)) : 0,
    nugT: ins && f >= 47 && f <= 57 ? (f - 47) / 10 : -1,
    gunOpenK: lg ? (f < 78 ? smooth(ramp(f, 65, 68)) : 1 - smooth(ramp(f, 78, 81))) : 0,
    shellAT: f < 68 ? 0 : f > 75 ? 1 : smooth(ramp(f, 68, 75)),
    shellBT: f < 73 ? 0 : f > 78 ? 1 : smooth(ramp(f, 73, 78)),
    crateA: f < 68 ? 1 : 0,
    crateB: f < 73 ? 1 : 0,
    sackX: sk.x, sackY: sk.y, sackZ: sk.z, sackK: sk.k,
    blastX: bx, blastY: by, blastZ: bz,
    // SALTED-60 set pieces
    panK: ['s10', 's11', 's12', 's13'].includes(S.id) ? 1 : 0,
    panSwirl: S.id === 's11' ? Math.min((f - 810) * 0.25, 8.75) : S.id === 's12' || S.id === 's13' ? 8.75 : 0,
    dynK: dyn.k, dynX: dyn.x, dynY: dyn.y, dynZ: dyn.z, dynRx: dyn.rx, dynRz: dyn.rz,
    tapeK: S.id === 's25' && f >= 1660 ? 1 : 0,
    finalK: S.id === 's25' && f >= 1660 ? 1 : 0,
    tenK: S.id === 's25' ? smooth(ramp(f, 1690, 1710)) : 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  let blast = 0, spark = 0;
  for (const ff of FIRE) if (f >= ff && f <= ff + 16) { blast = Math.max(blast, 0.8); spark = Math.max(spark, 1.4); }
  // chisel taps while the expert chips the wall sample (s10)
  if (S.id === 's10' && f <= 800) spark = Math.max(spark, 0.85 * Math.pow(Math.abs(Math.sin(f * 0.5)), 6));
  // fuse spark trail on the flying stick
  if (dynAt(f).k) spark = Math.max(spark, 1.0);
  if (f >= BLAST_F && f <= BLAST_F + 30) { blast = Math.max(blast, 2.6); spark = Math.max(spark, 1.2); }
  // dust settling over the reveal
  if (S.id === 's25' && f <= 1700) blast = Math.max(blast, 0.55 * (1 - (f - 1642) / 58));
  return { moteRate: S.light === 'day' ? 0.02 : 0.16, blastRate: blast, sparkRate: spark, steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours flat.
// ERRATA: banker hatCol is SILVER/light (#eceae4) with a BLACK band.
const TINT = { mine: '#ffffff', deep: '#ffffff', day: '#ffffff' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  miner: { jacket: '#b3372a', pants: '#3a3230', boots: '#2a1c10', hat: 'miner', hatCol: '#7a5a30', suspenders: '#c9a15a', skin: '#fbf7ef' },
  buddy: { jacket: '#1f7a6a', pants: '#3a3a42', boots: '#241a12', hat: 'cap', cap: '#f2c230', skin: '#fbf7ef' },
  banker: { jacket: '#c9ccd2', pants: '#3c3a40', boots: '#1c1712', hat: 'tophat', hatCol: '#eceae4', hatBand: '#232028', shirtFront: '#f7f3e8', doubleButtons: true, buttons: '#26221f', bowtie: '#b3372a', watch: true, skin: '#fbf7ef', moustache: '#2a201a', bigMoustache: true },
  expert: { jacket: '#5e2a4a', pants: '#33302c', boots: '#1c1712', hat: 'bowler', hatCol: '#211e24', knife: false, skin: '#fbf7ef', moustache: '#2a201a' },
};
// round glasses drawn over a face card (expert AND buddy wear them in the
// source); head centre from T.headCenter(seed)
const drawGlasses = (seed) => (p) => {
  const hc = T.headCenter(seed);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};
const glassesExpert = drawGlasses(71);
const glassesBuddy = drawGlasses(41);

// ---------- HEAD PERFORMANCE ----------
// Expressions MORPH on the narration's emphasis words; heads nod, tilt,
// snap and turn toward whatever the voice names, plus a continuous idle
// sway so no head is ever frozen. Pure track folder (deterministic).
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
  [8, 'smug', 8], [66, 'determined', 6], [92, 'grin', 8], [146, 'determined', 6], [152, 'smug', 8],
  [228, 'smug', 8], [330, 'sad', 10], [420, 'smug', 8], [490, 'determined', 8], [1092, 'nervous', 10],
  [1184, 'nervous', 10], [1300, 'grin', 8],
]);
const emoBuddy = emoTrack('grin', [
  [150, 'wonder', 8], [160, 'thinking', 10], [300, 'nervous', 8], [465, 'nervous', 8], [723, 'nervous', 8],
  [1092, 'nervous', 8], [1184, 'grin', 8], [1300, 'laugh', 8],
]);
const emoBanker = emoTrack('smile', [
  [600, 'proud', 8], [672, 'dazed', 6], [686, 'proud', 8], [884, 'smile', 8], [1092, 'laugh', 6],
  [1200, 'proud', 8], [1363, 'thinking', 10], [1530, 'wonder', 8], [1690, 'smile_closed', 12],
]);
const emoExpert = emoTrack('neutral', [
  [723, 'thinking', 10], [884, 'thinking', 9], [1002, 'stern', 8], [1100, 'stern', 10],
]);
// ---------- BODY ACTIONS (library body.js) ----------
const minerPose = poseWindows([{ a: 59, b: 84, mode: 'kneel', inF: 5, outF: 4 }]);
const expertPose = poseWindows([{ a: 810, b: 850, mode: 'kneel1', inF: 6, outF: 6 }]);
const minerWink = winkTrack([{ a: 255, b: 263 }]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});
// fold the baked dialogue track into a face: ONLY the segment's owner is
// ever passed here, and only in their dialogue shots — everyone else keeps
// a scripted (closed-mouth) narration face.
const spk = (baseP, f) => {
  const s = SPEAK.at(f);
  if (!s.active) return { exprP: baseP, nod: 0 };
  return { exprP: SPK.applySpeak({ ...baseP }, s), nod: q(s.nod || 0, 2) };
};

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: 0, tint, ...extra }) });
  const m = minerAt(f), b = buddyAt(f), bk = bankerAt(f), ex = expertAt(f);
  let MP = emoMiner.at(f);
  const BP = emoBuddy.at(f), KP = emoBanker.at(f), EP = emoExpert.at(f);
  MP.blush = 0; BP.blush = 0; KP.blush = 0; EP.blush = 0;
  const winkK = minerWink(f);
  if (winkK > 0) MP = T.blendFaceP(MP, T.faceP('wink', 31), winkK);
  switch (S.id) {
    case 's01': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.55],
        ...head(f, 31, kf([[0, -2], [11, -4], [24, -4]], f), 0.15, kf([[0, 0.3], [11, 0.55], [24, 0.55]], f), 0.25) }, m.x, m.z, { yaw: 0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.6, 0.2, 0.55) }, b.x, b.z, { yaw: -0.3, overlay: glassesBuddy });
      break;
    }
    case 's02': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.35],
        ...head(f, 31, -4 + nodAt(f, 40, 9, -1.6) + nodAt(f, 49, 9, -1.6), 0.3, 0.6 + nodAt(f, 40) + nodAt(f, 49), 0.35) }, m.x, m.z, { yaw: 0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.6, 0.3, 0.55) }, b.x, b.z, { yaw: -0.3, overlay: glassesBuddy });
      break;
    }
    case 's03a': {
      const P = minerPose(f);
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.3],
        ...head(f, 31, -6, 0.35, 0.65, 0.3) }, m.x, m.z, { yaw: 0.35 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2, 0.6, 0.3, 0.55) }, b.x, b.z, { yaw: -0.3, overlay: glassesBuddy });
      break;
    }
    case 's03b': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, kf([[85, -2], [90, -2], [96, 3.5], [104, 3.5], [112, -3], [118, -3]], f),
          kf([[85, 0.2], [96, 0.75], [118, 0.8]], f), 0.1, kf([[85, 0.2], [102, 0.65], [118, 0.65]], f)) }, m.x, m.z, { yaw: 0.55 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.6, 0.15, 0.55) }, b.x, b.z, { yaw: -0.3, overlay: glassesBuddy });
      break;
    }
    case 's03c': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, kf([[119, -2], [124, -2], [129, 3.5], [141, -2.5]], f), -0.7, 0.1, -0.6) }, m.x, m.z, { yaw: -0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.5, 0.1, 0.4) }, b.x, b.z, { yaw: -0.3, overlay: glassesBuddy });
      break;
    }
    case 's03d': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, kf([[142, -2], [146, -2], [151, 3.5], [159, -3]], f), 0.75, 0.1, 0.6) }, m.x, m.z, { yaw: 0.55 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.55, 0.1, 0.5) }, b.x, b.z, { yaw: -0.3, overlay: glassesBuddy });
      break;
    }
    case 's03e': {
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, kf([[193, 0], [210, -3], [227, -4.5], [233, 3]], f),
          kf([[193, 0.4], [215, 0.7], [233, 0.3]], f), -0.1, kf([[193, 0.3], [215, 0.55], [233, 0.2]], f)) }, b.x, b.z, { yaw: -0.2, overlay: glassesBuddy });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, 0.4, 0.1, 0.3) }, m.x, m.z, { yaw: 0.4 });
      break;
    }
    case 's04': {
      // the buddy ASKS his question — performed dialogue (speak track)
      const SB = spk(BP, f);
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: SB.exprP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1 + SB.nod, 0.35, 0.05, 0.4) }, b.x, b.z, { yaw: -0.25, overlay: glassesBuddy });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, 0.4, 0.1, 0.3) }, m.x, m.z, { yaw: 0.4 });
      break;
    }
    case 's05': {
      // the miner ANSWERS — "it's called salting", performed + the wink
      const SM = spk(MP, f);
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: SM.exprP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.6],
        ...head(f, 31, -2.5 + SM.nod, -0.4, 0.05, -0.4) }, m.x, m.z, { yaw: -0.45 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, 0.5, 0.1, 0.5) }, b.x, b.z, { yaw: 0.3, overlay: glassesBuddy });
      break;
    }
    case 's06': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.6],
        ...head(f, 31, kf([[290, -2], [320, 2.5], [390, 3], [440, -2], [464, -2]], f), -0.3, kf([[290, 0.1], [360, 0.45], [464, 0.2]], f), -0.35) }, m.x, m.z, { yaw: -0.4 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.35, 0.05, 0.35) }, b.x, b.z, { yaw: 0.3, overlay: glassesBuddy });
      break;
    }
    case 's07': {
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['coin', 0.55],
        ...head(f, 31, -1, 0.3, kf([[465, 0.1], [510, 0.5], [559, 0.3]], f), 0.3) }, m.x, m.z, { yaw: 0.5 });
      std('buddy', OUTFITS.buddy, { expr: 'nervous', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1, 0.4, 0.1, 0.4) }, b.x, b.z, { yaw: 0.4, overlay: glassesBuddy });
      break;
    }
    case 's08': {
      const walking = f >= 566 && f <= 626;
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: walking ? 'march' : 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.15, -0.1, 0.15) }, bk.x, bk.z, { yaw: -0.2 });
      const ew = f >= 572 && f <= 630;
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: ew ? 'march' : 'stand', phase: q((f * 0.011 + 0.4) % 1, 2), blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, 0.25, 0.05, 0.25) }, ex.x, ex.z, { yaw: 0.25, overlay: glassesExpert });
      break;
    }
    case 's09a': {
      const walking = f >= 633 && f <= 650;
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: walking ? 'march' : 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.15, -0.05, 0.15) }, bk.x, bk.z, { yaw: -0.15 });
      const ew = f >= 638 && f <= 652;
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: ew ? 'march' : 'stand', phase: q((f * 0.011 + 0.4) % 1, 2), blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, 0.25, 0.05, 0.25) }, ex.x, ex.z, { yaw: 0.25, overlay: glassesExpert });
      break;
    }
    case 's09b': {
      // the BONK at f700: head squash spike + tilt snap, then the rub and
      // the pompous recovery (emoBanker: dazed -> proud)
      const bonk = f >= 672 && f <= 679 ? Math.sin((f - 672) / 7 * Math.PI) * 0.15 : 0;
      const walking = f >= 653 && f < 672;
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: walking ? 'march' : 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51, prop: f >= 680 ? ['point', 0.3] : null,
        ...head(f, 51, (f >= 672 && f <= 686 ? -7 : -1.5), 0.1, f >= 672 ? 0.3 : -0.05, 0.1, bonk) }, bk.x, bk.z, { yaw: 0.1 });
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: f >= 658 && f <= 700 ? 'march' : 'stand', phase: q((f * 0.011 + 0.4) % 1, 2), blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, 0, 0.3, 0.05, 0.3) }, ex.x, ex.z, { yaw: 0.3, overlay: glassesExpert });
      break;
    }
    case 's10': {
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        prop: f < 795 ? ['carve', q(0.4 + 0.4 * Math.abs(Math.sin(f * 0.5)), 2)] : ['point', 0.3],
        ...head(f, 71, -2.5, 0.2, 0.5, 0.2) }, ex.x, ex.z, { yaw: 0.35, overlay: glassesExpert });
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.3, 0.05, 0.3) }, bk.x, bk.z, { yaw: 0.35 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.35, 0.05, -0.4) }, m.x, m.z, { yaw: -0.4 });
      std('buddy', OUTFITS.buddy, { expr: 'nervous', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1.5, 0.35, 0.1, 0.4) }, b.x, b.z, { yaw: 0.4, overlay: glassesBuddy });
      break;
    }
    case 's11': {
      const P = expertPose(f);
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: EP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 71), seed: 71, prop: ['pan', 0.5],
        ...head(f, 71, -4, 0.15, 0.6, 0.15) }, ex.x, ex.z, { yaw: 0.2, overlay: glassesExpert });
      break;
    }
    case 's12': break; // pure insert: the pan, the water, the settling flakes
    case 's13': {
      const SE = spk(EP, f);
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: SE.exprP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['lens', 0.8],
        ...head(f, 71, -4 + SE.nod, 0.1, 0.55, 0.15) }, ex.x, ex.z, { yaw: 0.25, overlay: glassesExpert });
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.35, 0.05, 0.35) }, bk.x, bk.z, { yaw: 0.35 });
      break;
    }
    case 's14': {
      const SE = spk(EP, f);
      std('expert', OUTFITS.expert, { expr: 'neutral', exprP: SE.exprP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['lens', 0.85],
        ...head(f, 71, -4.5 + SE.nod, 0.1, 0.6, 0.15) }, ex.x, ex.z, { yaw: 0.25, overlay: glassesExpert });
      break;
    }
    case 's15': break; // pure insert: flat gold specks in the porous wall
    case 's16': {
      // "Somebody shot this gold into the wall" — the expert's accusation,
      // performed; the buyer behind him still unconvinced
      const SE = spk(EP, f);
      std('expert', OUTFITS.expert, { expr: 'stern', exprP: SE.exprP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.8],
        ...head(f, 71, -3 + SE.nod, 0.4, 0.2, 0.45) }, ex.x, ex.z, { yaw: 0.3, overlay: glassesExpert });
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1, 0.35, 0.1, 0.35) }, bk.x, bk.z, { yaw: 0.4 });
      std('miner', OUTFITS.miner, { expr: 'smile', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.35, 0.05, -0.4) }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 's17': {
      // the buyer's big laugh + his line, performed; the expert fumes, the
      // accomplices freeze guilty at the edges
      const SK = spk(KP, f);
      const laughPh = f <= 1176;
      std('banker', OUTFITS.banker, { expr: 'grin', exprP: SK.exprP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, (laughPh ? -3 + 2.6 * Math.sin(f * 0.35) : -3) + SK.nod, -0.3, laughPh ? -0.15 : 0, -0.35, laughPh ? 0.04 + 0.045 * Math.sin(f * 0.35) : 0.02) },
        bk.x, bk.z, { yaw: 0.15, y: Math.abs(Math.sin(f * 0.3)) * 0.05 });
      std('expert', OUTFITS.expert, { expr: 'stern', exprP: EP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, -0.3, 0.1, -0.3) }, ex.x, ex.z, { yaw: -0.3, overlay: glassesExpert });
      std('miner', OUTFITS.miner, { expr: 'nervous', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, -0.4, 0.15, -0.4) }, m.x, m.z, { yaw: -0.45 });
      std('buddy', OUTFITS.buddy, { expr: 'nervous', exprP: BP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1.5, 0.4, 0.1, 0.4) }, b.x, b.z, { yaw: 0.4, overlay: glassesBuddy });
      break;
    }
    case 's18': {
      // "Completely insane" — the buddy's stiff, over-eager nodding,
      // performed; the miner frozen innocent beside him
      const SB = spk(BP, f);
      const eager = SPEAK.at(f).active ? 1.6 * Math.abs(Math.sin((f - 1184) * 0.22)) : 0;
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: SB.exprP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1 + SB.nod + eager, 0.3, 0.05, 0.35) }, b.x, b.z, { yaw: 0.3, overlay: glassesBuddy });
      std('miner', OUTFITS.miner, { expr: 'nervous', exprP: MP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0.5, -0.3, 0.1, -0.3) }, m.x, m.z, { yaw: -0.35 });
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, 0.3, 0, 0.3) }, bk.x, bk.z, { yaw: 0.3 });
      break;
    }
    case 's19': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: f <= 1278 ? ['coin', 0.55] : null,
        ...head(f, 51, -2, 0.2, 0.3, 0.25) }, bk.x, bk.z, { yaw: 0.3 });
      std('miner', OUTFITS.miner, { expr: 'grin', exprP: MP, mode: f >= 1280 ? 'march' : 'stand', phase: q((f * 0.013) % 1, 2), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1.5 * Math.sin(f * 0.24), 0.2, 0, 0.3) }, m.x, m.z, { yaw: 0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', exprP: BP, mode: f >= 1280 ? 'march' : 'stand', phase: q((f * 0.013 + 0.4) % 1, 2), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1.5 * Math.sin(f * 0.24 + 1.3), 0.2, -0.1, 0.3) }, b.x, b.z, { yaw: 0.3, overlay: glassesBuddy });
      break;
    }
    case 's20': {
      // alone at last: the buyer produces the dynamite from his suit
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: f >= 1420 ? ['dyn', 0.55] : null,
        ...head(f, 51, kf([[1363, -1], [1400, 2], [1420, 2.5], [1450, -2], [1508, -2.5]], f), 0.15, kf([[1363, 0], [1420, 0.5], [1450, 0.1], [1508, 0.05]], f), 0.15) }, bk.x, bk.z, { yaw: 0.2 });
      break;
    }
    case 's21': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['dyn', 0.8],
        ...head(f, 51, -3.5, 0.1, 0.55, 0.1) }, bk.x, bk.z, { yaw: 0.15 });
      break;
    }
    case 's22': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: f <= 1569 ? ['dyn', 0.85] : null,
        ...head(f, 51, kf([[1566, -3], [1570, -4], [1584, -2]], f), 0.3, 0.2, 0.3) }, bk.x, bk.z, { yaw: 0.2 });
      break;
    }
    case 's23': {
      std('banker', OUTFITS.banker, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -2, 0.2, 0.1, 0.25) }, bk.x, bk.z, { yaw: 0.25 });
      break;
    }
    case 's24': {
      std('banker', OUTFITS.banker, { expr: 'grin', exprP: KP, mode: 'march', phase: q((f * 0.02) % 1, 2), blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, 2 * Math.sin(f * 0.3), 0.1, -0.1, 0.15) }, bk.x, bk.z, { yaw: 0.15 });
      break;
    }
    case 's25': {
      // the reveal: NO speech — narration + the '10 FT' board only. The
      // buyer stands centre-left, closed happy eyes, before the vein.
      std('banker', OUTFITS.banker, { expr: 'smile_closed', exprP: KP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, kf([[1642, -1], [1700, -3], [1799, -3.5]], f), 0.35, 0.05, 0.35) }, bk.x, bk.z, { yaw: 0.25 });
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
  SOL.circle(2.7, -6.3, 0.55, { h: 0.85, id: 'pancrate' }),
  SOL.circle(0.17, -28.9, 0.55, { h: 0.75, id: 'tenrock' }),
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
  if (sk.k > 0.01 && f < 1259) items.push({ id: 'sacks', y: sk.y - 0.196, ground: 0.78, maxHover: 0.05 });
  return items;
};
