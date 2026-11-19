// Shot plan for "The Giant's Shoes" — giantshoes. V4 UPGRADE build
// (2026-11-19): picture-only rebuild on the EXISTING stem — same beat
// map, same clause timings, same boards, same mix. What changed:
//  * "v4" ACTION CAMERA (Zack-D grammar, proven in valleyfly/fireless):
//    every shot is a keysCam track with fast eased push-ins landing in
//    12-18f at action starts, tracking at the subject's own speed,
//    declared impact kicks (shoe-place f1130, first ringing step f1240,
//    payoff doors f1349) and two whip reframes inside the laugh and
//    payoff sections. No slow drift, no static holds, camera never
//    behind the cards.
//  * ANIMATION UPGRADE v1+v2 (body.js v2 / toon armPose): continuous
//    lifeAt life on every actor, emoTrack expression morphs at beats,
//    gaze tracks that follow the named subject, PHYSICAL GRIPS via
//    gripTrack -> armPose (measuring strip, stitching needle, bell
//    placing, two-hand shoe carry with carryDip), dialogue gesture on
//    the performed line, distance-based stride phase (no glide),
//    jumpTrack startles at the midnight reveal.
//  * SALTED MINE V3 CAST: round WHITE heads (skin #fbf7ef, no card
//    tint in any light), costumes by role unchanged.
//  * R2 FRAMING: opening hero BIG from frame 0 (shoemaker crouched at
//    the giant print, push-in), inserts fill 85-95% (print, shoes,
//    bells, soles), reaction faces >=65% (laugh punch-ins, son's
//    laughing face), final frame = shoemaker foreground + hook board.
//  * Word-by-word captions are drawn in main.js from words.js.
// Voice stem: 60.611 s, 30 fps, TOTAL 1818; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1  0.00-4.02  One morning...river.        S8  32.18-34.96  "A giant I..."
//   S2  4.44-9.04  By nightfall...return.     S9  35.50-39.90  That evening...
//   S3  9.74-13.58 Only the old...leather.    S10 40.54-44.32  At midnight...
//   S4  14.10-17.30 For three days...seen.    S11 44.98-50.16  Doors flew open...
//   S5  17.76-21.30 The village laughed...    S12 50.70-55.26  His stilt-feet...
//   S6  21.74-26.26 Then he sewed...bells.    S13 55.76-60.32  But tomorrow...
//   S7  26.78-31.64 The mayor demanded...
// GRADE (FILTER_VFX_LIGHTING pack): Sunny Pop throughout; the night beats
// (watch, midnight, payoff, soles) are a night light — grade changes ONLY
// on clause boundaries. Signature VFX: brass-bell glints, footprint trail,
// chimney smoke, river shimmer, lamp glow at night.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, gazeTrack, lifeAt, emoTrack, gripTrack, gestureAt, jumpTrack, carryDip } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);

export const FPS = 30, TOTAL = 1818, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 132, light: 'sun' },
  { id: 'watch', a: 133, b: 291, light: 'night' },
  { id: 'measure', a: 292, b: 422, light: 'sun' },
  { id: 'stitch', a: 423, b: 531, light: 'sun' },
  { id: 'laugh', a: 532, b: 651, light: 'sun' },
  { id: 'bells', a: 652, b: 802, light: 'sun' },
  { id: 'mayor', a: 803, b: 964, light: 'sun' },
  { id: 'dialogue', a: 965, b: 1064, light: 'sun' },
  { id: 'riverbank', a: 1065, b: 1215, light: 'dusk' },
  { id: 'midnight', a: 1216, b: 1348, light: 'night' },
  { id: 'payoff', a: 1349, b: 1520, light: 'night' },
  { id: 'soles', a: 1521, b: 1671, light: 'night' },
  { id: 'hookq', a: 1672, b: 1755, light: 'dusk' },
  { id: 'hook', a: 1756, b: 1817, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  sun: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  night: { az: 250, el: 32, sky: '#4a5a7a', ground: '#2c2a3a', hemi: 0.62, sun: '#8aa4cc', sunI: 0.55, fog: '#3a4460', fogNear: 30, fogFar: 240,
    skyTop: '#0c1428', skyHor: '#2a3a5c', sunDisc: '#e8ecf4', sunSize: 0.0032, sat: 0.85, vig: 0.34, shadowExt: 22, aurora: 0, gain: '#c8d2e8',
    waterDeep: '#0a1e2e', waterShal: '#14344a', glint: '#a8c8e8' },
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
  if (S.id === 'watch') return blendLight(LIGHTS.sun, LIGHTS.night, smooth(ramp(f, 133, 178)));
  if (S.id === 'measure') return blendLight(LIGHTS.night, LIGHTS.sun, smooth(ramp(f, 292, 337)));
  if (S.id === 'riverbank') return blendLight(LIGHTS.sun, LIGHTS.dusk, smooth(ramp(f, 1065, 1130)));
  if (S.id === 'midnight') return blendLight(LIGHTS.dusk, LIGHTS.night, smooth(ramp(f, 1216, 1260)));
  if (S.id === 'hookq') return blendLight(LIGHTS.night, LIGHTS.dusk, smooth(ramp(f, 1672, 1727)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const STALL = { x: -8, z: 4.5, ry: 0.35 };
export const TABLE = { x: -7.6, z: 4.6 };
export const BANK = { x: -6, z: 10.3 };
export const PRINTS = [[-6, 10.3], [-4, 8], [-2, 5.5], [0, 4], [2, 2.5]];
export const HOUSES = [
  { x: -12, z: -8, ry: 0.3, w: 5, d: 4.5 },
  { x: 12, z: -8, ry: -0.3, w: 5, d: 4.5 },
  { x: -13, z: 6, ry: 1.2, w: 4.5, d: 4 },
  { x: 13, z: 6, ry: -1.2, w: 4.5, d: 4 },
];

// ---------- position tracks (piecewise keys, smootherstep between) ----------
const posKeys = (keys) => (f) => {
  if (f <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, x0, z0] = keys[i - 1], [f1, x1, z1] = keys[i];
      const u = M.smooth(clamp((f - f0) / Math.max(1, f1 - f0)));
      return [lerp(x0, x1, u), lerp(z0, z1, u)];
    }
  }
  const k = keys[keys.length - 1]; return [k[1], k[2]];
};
// travelled-distance stride phase — feet plant with the ground, no glide
const distPhase = (raw) => {
  const D = [0];
  for (let f = 1; f < TOTAL; f++) { const a = raw(f - 1), b = raw(f); D[f] = D[f - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return { phase: (f) => (D[clamp(Math.round(f), 0, TOTAL - 1)] / 0.82) % 1, moving: (f) => f > 0 && (D[clamp(Math.round(f), 0, TOTAL - 1)] - D[clamp(Math.round(f) - 1, 0, TOTAL - 1)]) > 0.004 };
};
// shoemaker: crouched at the biggest print at dawn -> back to his stall
// while the watch is set -> out to the print to measure -> stall (stitch,
// bells, mayor, dialogue) -> carries the shoes to the riverbank -> home
// -> steps into the foreground for the hook board.
const shoeRaw = posKeys([
  [0, 0.75, 4.75], [140, 0.75, 4.75], [158, 0.0, 4.7], [218, -6.0, 5.0],
  [292, -6.0, 5.0], [330, 0.75, 4.75], [422, 0.75, 4.75], [460, -6.0, 5.0],
  [1065, -6.0, 5.0], [1100, -5.6, 8.6], [1197, -5.6, 8.6], [1230, -6.0, 5.0],
  [1672, -6.0, 5.0], [1702, 1.35, 1.5], [1817, 1.35, 1.5],
]);
const mayorRaw = posKeys([
  [0, 3.6, 5.4], [803, 3.6, 5.4], [850, 1.2, 5.0], [964, 1.2, 5.0],
  [1065, 3.6, 5.4], [1817, 3.6, 5.4],
]);
const shoeMove = distPhase(shoeRaw), mayorMove = distPhase(mayorRaw);
export const shoeAt = (f) => { const [x, z] = shoeRaw(f); return { x, z }; };
export const mayorAt = (f) => { const [x, z] = mayorRaw(f); return { x, z }; };
// THE GIANT SHOES (hero prop): on the stall table -> carried to the
// riverbank -> set down -> at midnight they RISE onto the stilts and
// walk the bank (the son steps in off-camera at the hard cut).
export const shoesAt = (f) => {
  if (f < 1065) return { x: TABLE.x, y: 0.78, z: TABLE.z, carried: 0, resting: 1, walk: 0, scale: f < 423 ? 0.55 : 0.55 + 0.45 * smooth(ramp(f, 423, 531)) };
  if (f <= 1100) {
    const u = smooth(ramp(f, 1065, 1100));
    return { x: lerp(TABLE.x, -5.6, u), y: lerp(0.78, 0.9, u) + Math.sin(u * Math.PI) * 0.12, z: lerp(TABLE.z, 8.6, u), carried: 1, resting: 0, walk: 0, scale: 1 };
  }
  if (f <= 1130) {
    const u = smooth(ramp(f, 1100, 1130));
    return { x: lerp(-5.6, BANK.x, u), y: lerp(0.9, 0, u), z: lerp(8.6, BANK.z, u), carried: 1, resting: 0, walk: 0, scale: 1 };
  }
  if (f < 1216) return { x: BANK.x, y: 0, z: BANK.z, carried: 0, resting: 1, walk: 0, scale: 1 };
  if (f <= 1240) { // the shoes lift onto the stilts as the bells begin
    const u = smooth(ramp(f, 1216, 1240));
    return { x: BANK.x, y: u * 0.95, z: BANK.z, carried: 0, resting: 0, walk: 0, scale: 1 };
  }
  // midnight walk: two slow steps along the bank, bells swinging
  const step = f < 1280 ? smooth(ramp(f, 1240, 1280)) : 1 + smooth(ramp(f, 1290, 1330));
  const bob = Math.abs(Math.sin((f - 1240) * Math.PI / 40)) * 0.1;
  return { x: lerp(BANK.x, -4.2, Math.min(step / 2, 1)), y: 0.95 + bob, z: lerp(BANK.z, 9.8, Math.min(step / 2, 1)), carried: 0, resting: 0, walk: 1, scale: 1 };
};
// the miller's son: hidden until the payoff — he rides the stilts above
// the shoes from f1349 on.
export const sonAt = (f) => {
  if (f < 1349) return null;
  const s = shoesAt(f);
  return { x: s.x, y: 0.9, z: s.z };
};
// bells: sewn on one by one during the bells shot; swinging at midnight
export const bellsK = (f) => f < 652 ? 0 : f <= 787 ? smooth(ramp(f, 652, 787)) : 1;
export const bellSwing = (f) => {
  if (f >= 1216 && f <= 1348) return Math.sin((f - 1216) * 0.5) * 0.5;
  if (f >= 1349) return Math.sin(f * 0.12) * 0.12;
  return 0;
};
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(652, 787, 0.8); pulse(1216, 1348, 1); pulse(1349, 1520, 0.9); pulse(1521, 1671, 0.7);
  return s;
};
export const lampK = (f) => {
  const S = shotAt(f);
  if (S.light === 'night') return 1;
  if (S.id === 'riverbank') return smooth(ramp(f, 1130, 1215));
  return 0;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => { const s = shoeAt(60); return [s.x, 1.0, s.z]; },
  watch: () => [0, 1.2, 6.2],
  measure: () => [0, 0.4, 4],
  stitch: () => [TABLE.x, 0.9, TABLE.z],
  laugh: () => [5.2, 1.3, 2.0],
  bells: () => [TABLE.x, 0.9, TABLE.z],
  mayor: () => { const m = mayorAt(900); return [m.x, 1.35, m.z]; },
  dialogue: () => { const s = shoeAt(1010); return [s.x, 1.45, s.z]; },
  riverbank: () => [BANK.x, 0.8, BANK.z],
  midnight: () => [-5, 0.9, 10],
  payoff: () => { const s = sonAt(1420) || { x: -4.2, z: 9.8 }; return [s.x, 1.8, s.z]; },
  soles: () => [-4.2, 0.3, 9.8],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- v4 ACTION CAMERA: every shot a keysCam track ----------
// Push-ins land in 12-18f at action starts; tracking keys ride the
// subject at its own speed; the laugh and payoff sections carry one
// declared whip reframe each (rig sub-shots — the story TIMING above
// is untouched). All cuts sit on clause boundaries.
const KC = (keys, fov) => keysCam({ keys: keys.map(([f, pos, look]) => ({ f, pos, look, fov, ease: 'io' })) });
const RIG_SHOTS = [
  // S1: hero BIG at the print from f0 (push-in by f16), he rises, then a
  // fast pull-back reveal of the whole square as the title board lands.
  { id: 'drone', a: 0, b: 132, cut: 'hard', raw: KC([
    [0, [2.25, 1.1, 7.3], [0.8, 1.0, 4.8]], [16, [2.05, 1.05, 7.05], [0.75, 0.98, 4.8]],
    [46, [2.3, 1.25, 7.9], [0.7, 0.95, 4.75]], [66, [-2.4, 5.2, 14.5], [0.7, 1.2, -2.5]],
    [132, [-3.0, 5.4, 13.9], [0.8, 1.25, -2.5]]], 42) },
  // S2: lateral track along the night-watch line, faces passing close.
  { id: 'watch', a: 133, b: 291, cut: 'hard', raw: KC([
    [133, [7.4, 1.7, 11.0], [5.0, 1.5, 4.2]], [185, [4.2, 1.6, 10.6], [2.0, 1.5, 6.5]],
    [240, [0.0, 1.55, 10.5], [-2.0, 1.5, 6.5]], [291, [-4.4, 1.65, 10.8], [-5.2, 1.3, 5.2]]], 41) },
  // S3: track the walk out, then dive to the print + strip insert.
  { id: 'measure', a: 292, b: 422, cut: 'hard', raw: KC([
    [292, [-3.4, 1.7, 10.2], [-5.6, 1.2, 5.1]], [330, [2.2, 1.3, 8.3], [0.3, 0.5, 4.3]],
    [348, [2.0, 1.2, 7.9], [0.28, 0.48, 4.28]], [422, [1.9, 1.22, 8.0], [0.28, 0.48, 4.28]]], 37) },
  // S4: fast push-in onto the growing shoes on the table.
  { id: 'stitch', a: 423, b: 531, cut: 'hard', raw: KC([
    [423, [-3.4, 1.9, 9.6], [-6.6, 1.05, 4.8]], [441, [-4.0, 1.62, 7.9], [-6.55, 0.95, 4.8]],
    [531, [-3.9, 1.6, 7.8], [-6.55, 0.95, 4.8]]], 36) },
  // S5a: punch-in on the lead laugher's face.
  { id: 'laughA', a: 532, b: 589, cut: 'hard', raw: KC([
    [532, [7.9, 1.85, 7.6], [5.4, 1.6, 2.6]], [548, [5.95, 1.62, 3.8], [5.2, 1.68, 2.05]],
    [589, [5.9, 1.6, 3.7], [5.2, 1.68, 2.05]]], 40) },
  // S5b: whip reframe onto the mayor, laughing just as hard.
  { id: 'laughB', a: 590, b: 651, cut: 'whip', blend: 6, raw: KC([
    [590, [5.3, 1.75, 7.6], [3.7, 1.62, 5.3]], [606, [4.9, 1.62, 6.9], [3.6, 1.68, 5.4]],
    [651, [4.8, 1.6, 6.8], [3.6, 1.68, 5.4]]], 40) },
  // S6: bell-sewing insert — the sole and the row of bells fill frame.
  { id: 'bells', a: 652, b: 802, cut: 'hard', raw: KC([
    [652, [-3.5, 1.7, 9.9], [-7.0, 1.05, 4.6]], [668, [-4.0, 1.3, 9.0], [-7.2, 0.95, 4.5]],
    [802, [-3.95, 1.32, 8.9], [-7.2, 0.95, 4.5]]], 34) },
  // S7: track the mayor's march, then punch-in on his stern face.
  { id: 'mayor', a: 803, b: 964, cut: 'hard', raw: KC([
    [803, [6.9, 1.8, 10.6], [3.4, 1.3, 5.3]], [850, [3.4, 1.6, 9.3], [1.6, 1.3, 5.1]],
    [866, [2.5, 1.6, 6.8], [1.2, 1.62, 5.0]], [964, [2.4, 1.58, 6.7], [1.2, 1.62, 5.0]]], 38) },
  // S8: the performed line — push-in lands by f980, camera holds on him.
  { id: 'dialogue', a: 965, b: 1064, cut: 'hard', raw: KC([
    [965, [-3.4, 1.75, 8.6], [-6.0, 1.6, 5.0]], [980, [-4.6, 1.62, 7.1], [-6.0, 1.68, 5.0]],
    [1064, [-4.75, 1.6, 7.0], [-6.0, 1.68, 5.0]]], 33) },
  // S9: front three-quarter track at his carrying speed to the bank.
  { id: 'riverbank', a: 1065, b: 1215, cut: 'hard', raw: KC([
    [1065, [-3.2, 1.7, 9.4], [-6.0, 1.2, 5.2]], [1100, [-2.9, 1.6, 12.6], [-5.6, 1.1, 8.7]],
    [1130, [-2.7, 1.5, 13.4], [-5.9, 0.8, 10.1]], [1215, [-2.9, 1.6, 13.0], [-5.8, 0.9, 9.9]]], 40) },
  // S10: low track beside the walking, ringing shoes.
  { id: 'midnight', a: 1216, b: 1348, cut: 'hard', raw: KC([
    [1216, [-1.4, 1.3, 15.6], [-5.8, 1.0, 10.2]], [1240, [-1.7, 1.25, 15.2], [-5.9, 1.0, 10.2]],
    [1348, [-1.3, 1.2, 14.6], [-4.4, 1.0, 9.9]]], 39) },
  // S11a: the reveal — son high on stilts, fast push-in.
  { id: 'payoffA', a: 1349, b: 1439, cut: 'hard', raw: KC([
    [1349, [2.2, 2.3, 16.4], [-4.2, 1.8, 9.8]], [1365, [0.6, 2.05, 13.9], [-4.2, 1.85, 9.8]],
    [1439, [0.4, 2.0, 13.7], [-4.2, 1.85, 9.8]]], 40) },
  // S11b: whip onto his laughing face, too full of laughter to run.
  { id: 'payoffB', a: 1440, b: 1520, cut: 'whip', blend: 6, raw: KC([
    [1440, [-2.85, 2.75, 11.45], [-4.2, 2.8, 9.8]], [1456, [-2.95, 2.7, 11.3], [-4.2, 2.8, 9.8]],
    [1520, [-3.0, 2.68, 11.25], [-4.2, 2.8, 9.8]]], 38) },
  // S12: carved soles insert, then a reframe up to the pointing shoemaker.
  { id: 'soles', a: 1521, b: 1671, cut: 'hard', raw: KC([
    [1521, [-1.5, 1.1, 13.2], [-4.2, 0.35, 9.9]], [1537, [-2.8, 0.85, 11.3], [-4.2, 0.3, 9.85]],
    [1600, [-2.85, 0.88, 11.35], [-4.2, 0.3, 9.85]], [1671, [-1.7, 1.25, 13.3], [-4.9, 0.65, 8.7]]], 36) },
  // S13: push toward the board as it lands; the shoemaker steps into
  // the foreground — final frame is hero + board together.
  { id: 'hookq', a: 1672, b: 1755, cut: 'hard', raw: KC([
    [1672, [5.6, 3.0, 8.6], [0.2, 2.7, -6]], [1755, [2.6, 2.3, 7.6], [0.1, 2.5, -6]]], 40) },
  { id: 'hook', a: 1756, b: 1817, cut: 'hard', raw: KC([
    [1756, [2.6, 2.3, 7.6], [0.1, 2.5, -6]], [1817, [2.5, 2.28, 7.45], [0.1, 2.5, -6]]], 40) },
];
const RIG = buildRig({
  total: TOTAL, shots: RIG_SHOTS,
  kicks: [{ f: 1130, a: 0.22 }, { f: 1240, a: 0.25 }, { f: 1349, a: 0.30 }],
  sigma: 1.7, smoothRadius: 5, fovSigma: 1.1,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: RIG_SHOTS.filter((s) => s.cut === 'whip').map((s) => ({ a: s.a - 3, b: s.a + 3 })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'hookq'].includes(S.id)) cinf = 1.4;
  if (['dialogue', 'payoff', 'soles', 'bells'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), sh = shoesAt(f), sn = sonAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    shoeX: sh.x, shoeY: sh.y, shoeZ: sh.z, shoeCarried: sh.carried, shoeScale: sh.scale, shoeWalk: sh.walk,
    bellsK: bellsK(f), bellSwing: bellSwing(f), bellGlint: glintAt(f),
    lampK: lampK(f),
    sonK: sn ? 1 : 0, sonX: sn ? sn.x : 0, sonY: sn ? sn.y : 0, sonZ: sn ? sn.z : 0,
    dustK: 0.05,
  };
  // title board lands during the S1 pull-back reveal (fully framed there)
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 52, 66)) * (1 - smooth(ramp(f, 112, 124)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1716, 1740));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: 0, grey: S.light === 'night' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast: SALTED MINE V3 white heads, costumes by role ----------
export const OUTFITS = {
  shoemaker: { jacket: '#6a4a2e', pants: '#4a3826', boots: '#2c1c10', hat: 'hair', hair: '#e8e8e8', skin: '#fbf7ef', moustache: '#e8e8e8' },
  mayor: { jacket: '#8a2432', pants: '#3a2a4a', boots: '#241a12', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef' },
  son: { jacket: '#2c6a3a', pants: '#3a3226', boots: '#4a2e18', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef' },
  villager1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#7a5a2e', skin: '#fbf7ef' },
  villager2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef', moustache: '#241a12' },
  villager3: { jacket: '#9a5a3a', pants: '#6a4a3a', boots: '#3a2a1c', hat: 'hair', hair: '#2c1a10', skin: '#fbf7ef' },
  watchman: { jacket: '#5a2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'shako', skin: '#fbf7ef' },
};

// ---------- performance tracks (body.js v2) ----------
const GT = (ks) => gripTrack(ks.map(([f, x, y, g]) => ({ f, x, y, grip: g })));
const AP = (L, R) => {
  const o = {};
  if (L) o.L = { hand: [Math.round(L.x), Math.round(L.y)], grip: q(L.grip, 2), front: true };
  if (R) o.R = { hand: [Math.round(R.x), Math.round(R.y)], grip: q(R.grip, 2), front: true };
  return Object.keys(o).length ? o : undefined;
};
// redraw a gripping hand OVER its object (palm dot + fingertip arcs)
const gripHand = (p, hx, hy, skin) => {
  p.ell(hx, hy, 9.5, 9.5, skin, 2.2);
  for (const [dx, dy] of [[-8, -5], [0, -8], [8, -5]]) p.ell(hx + dx, hy + dy, 4.2, 4.2, skin, 1.6);
};

// expression morphs — the face matches the beat, glides, never snaps
const shoeEmo = emoTrack([[0, 'neutral'], [292, 'smile'], [423, 'proud'], [532, 'smile'], [652, 'proud'], [803, 'smile'], [965, 'smile'], [1065, 'proud'], [1216, 'smile'], [1349, 'grin'], [1521, 'proud'], [1672, 'grin']], 31);
const mayorEmo = emoTrack([[0, 'stern'], [532, 'laugh'], [700, 'stern'], [1349, 'shock'], [1521, 'shock'], [1672, 'smile']], 41);
const v1Emo = emoTrack([[0, 'neutral'], [532, 'laugh'], [652, 'neutral'], [1349, 'shock'], [1521, 'neutral']], 51);
const v2Emo = emoTrack([[0, 'neutral'], [532, 'laugh'], [652, 'neutral'], [1216, 'shock'], [1521, 'neutral']], 52);
const v3Emo = emoTrack([[0, 'neutral'], [532, 'laugh'], [652, 'neutral']], 53);
const sonEmo = emoTrack([[1349, 'laugh'], [1521, 'grin'], [1672, 'smile']], 71);
// gaze — eyes follow the subject the voice names
const shoeGaze = gazeTrack([{ f: 0, look: 0.15, lookY: -0.35, tilt: 3 }, { f: 133, look: 0.2, lookY: 0 }, { f: 292, look: 0.1, lookY: -0.1 }, { f: 336, look: 0, lookY: -0.4, tilt: 4 }, { f: 423, look: 0.1, lookY: -0.3 }, { f: 652, look: 0, lookY: -0.35 }, { f: 803, look: 0.35, lookY: 0 }, { f: 965, look: 0.3, lookY: 0.05 }, { f: 1065, look: 0.15, lookY: -0.15 }, { f: 1349, look: -0.2, lookY: 0.1 }, { f: 1521, look: -0.3, lookY: -0.35 }, { f: 1672, look: -0.15, lookY: 0.3 }]);
const mayorGaze = gazeTrack([{ f: 0, look: -0.3 }, { f: 803, look: -0.4 }, { f: 965, look: -0.35 }, { f: 1349, look: -0.2, lookY: 0.2 }]);
// crouches: examining the print at dawn, measuring it at mid-morning
const shoePose = poseWindows([{ a: 6, b: 96, mode: 'kneel1', inF: 8, outF: 10 }, { a: 336, b: 418, mode: 'kneel1', inF: 7, outF: 7 }]);
// grips — hands land ON the work in the same frames the work moves
const measL = GT([[292, 190, 730, 0], [338, 224, 688, 0.85], [410, 224, 688, 0.85], [424, 190, 730, 0]]);
const measR = GT([[292, 410, 730, 0], [338, 376, 688, 0.85], [410, 376, 688, 0.85], [424, 410, 730, 0]]);
const stitchL = GT([[423, 190, 730, 0], [436, 268, 596, 0.9], [531, 268, 596, 0.9]]);
const stitchRKeys = [[423, 410, 730, 0], [436, 392, 600, 0.8]];
for (let t = 448, i = 0; t <= 520; t += 12, i++) stitchRKeys.push([t, 392 + (i % 2 ? 7 : -7), i % 2 ? 560 : 618, 0.8]);
stitchRKeys.push([531, 410, 730, 0]);
const stitchR = GT(stitchRKeys);
const bellL = GT([[652, 190, 730, 0], [664, 268, 596, 0.9], [802, 268, 596, 0.9]]);
const bellRKeys = [[652, 410, 730, 0], [664, 252, 600, 0.4]];
for (let i = 0; i < 8; i++) { bellRKeys.push([668 + i * 17, 252 + i * 15, 596, 0.92]); bellRKeys.push([676 + i * 17, 252 + i * 15, 576, 0.45]); }
bellRKeys.push([802, 410, 730, 0]);
const bellR = GT(bellRKeys);
const carryL = GT([[1065, 190, 730, 0], [1078, 252, 636, 0.95], [1120, 252, 636, 0.95], [1138, 236, 672, 0.4], [1150, 190, 730, 0]]);
const carryR = GT([[1065, 410, 730, 0], [1078, 348, 636, 0.95], [1120, 348, 636, 0.95], [1138, 364, 672, 0.4], [1150, 410, 730, 0]]);
const pointR = GT([[1672, 415, 720, 0], [1692, 448, 318, 0.15], [1817, 448, 318, 0.15]]);
// startles — laughter hops and the midnight flinch
const v1Jump = jumpTrack([{ f0: 540, dur: 11, h: 0.06, back: 5 }, { f0: 1352, dur: 11, h: 0.1, back: 8 }]);
const v2Jump = jumpTrack([{ f0: 1218, dur: 11, h: 0.09, back: 9 }, { f0: 1352, dur: 11, h: 0.08, back: 6 }]);

export const castAt = (f) => {
  const S = shotAt(f), out = [];
  const add = (id, outfit, o, extra = {}) => out.push({
    id, x: o.x, y: o.y || 0, z: o.z, r: 0.32, ground: 0,
    actor: (TT) => ({
      key: id + JSON.stringify(outfit) + JSON.stringify({ ...o.opts, mode: 'stand' }) + '|m=' + (o.opts.mode || 'stand') + (extra.ov || ''),
      draw: (p) => { TT.bodyFront(p, outfit, o.opts); if (extra.drawOv) extra.drawOv(p); },
      x: o.x, y: o.y || 0, z: o.z, ground: 0, tint: '#ffffff', yaw: extra.yaw || 0, s: extra.s,
    }),
  });
  const base = (seed, amp = 1) => {
    const L = lifeAt(f, seed);
    return { blink: new T.Blink(seed).at(f), breath: L.breath, tilt: q(L.tilt * amp, 2), headTilt: q(L.headTilt, 2), squashL: L.squash };
  };
  const qP = (P) => Object.fromEntries(Object.entries(P).map(([k, v]) => [k, typeof v === 'number' ? q(v, 2) : v]));

  // ---------- THE OLD SHOEMAKER (hero) ----------
  const shoeActor = (yaw) => {
    const seed = 31, B = base(seed), G = shoeGaze(f), P = shoePose(f);
    let exprP = shoeEmo(f);
    const speaking = S.id === 'dialogue' && f >= 965 && f <= 1048;
    if (speaking) exprP = SPK.applySpeak({ ...exprP, cheek: 0.5 }, SPEAK.at(f));
    let hL = null, hR = null, ov = '', drawOv = null, dip = 0;
    if (S.id === 'measure') {
      hL = measL(f); hR = measR(f);
      if (hL.grip > 0.4 || hR.grip > 0.4) { ov = `meas${q(hL.y, 1)}:${q(hR.y, 1)}`; drawOv = (p) => { gripHand(p, hL.x, hL.y, OUTFITS.shoemaker.skin); gripHand(p, hR.x, hR.y, OUTFITS.shoemaker.skin); }; }
    } else if (S.id === 'stitch') {
      hL = stitchL(f); hR = stitchR(f);
      ov = `needle${q(hR.x, 1)}:${q(hR.y, 1)}:${q(hL.x, 1)}`;
      drawOv = (p) => {
        p.band([[hR.x - 11, hR.y - 15], [hR.x + 13, hR.y + 11]], '#c8ccd4', 3, 0);   // the needle in his hand
        p.band([[hR.x + 10, hR.y + 8], [hL.x + 16, hL.y - 6]], '#e8dcc0', 1.6, 0);     // thread to the held shoe
        gripHand(p, hR.x, hR.y, OUTFITS.shoemaker.skin); gripHand(p, hL.x, hL.y, OUTFITS.shoemaker.skin);
      };
    } else if (S.id === 'bells') {
      hL = bellL(f); hR = bellR(f);
      ov = `bell${q(hR.x, 1)}:${q(hR.y, 1)}:${q(hR.grip, 2)}`;
      drawOv = (p) => {
        if (hR.grip > 0.7) p.ell(hR.x, hR.y + 10, 10, 10, '#e8b64a', 2);               // the bell being sewn on
        gripHand(p, hR.x, hR.y, OUTFITS.shoemaker.skin); gripHand(p, hL.x, hL.y, OUTFITS.shoemaker.skin);
      };
    } else if (S.id === 'dialogue') {
      if (speaking) { const g = gestureAt(f, 5, SPEAK.at(f).nod); hL = { x: 208 + g.dx, y: 596 + g.dy, grip: 0.15 }; }
      hR = { x: 415, y: 720, grip: 0 };
    } else if (S.id === 'riverbank') {
      hL = carryL(f); hR = carryR(f);
      if (f >= 1078 && f <= 1138) dip = carryDip(f, 0.75);
    } else if (S.id === 'soles') {
      hR = { x: 432, y: 472, grip: 0.1 };
    } else if (S.id === 'hookq' || S.id === 'hook') {
      hR = pointR(f); hL = { x: 204, y: 616, grip: 0.3 };
    }
    const pos = shoeAt(f);
    const mode = P.mode !== 'stand' ? P.mode : (shoeMove.moving(f) ? 'march' : 'stand');
    add('shoemaker', OUTFITS.shoemaker, {
      x: pos.x, z: pos.z,
      opts: {
        phase: q(shoeMove.phase(f), 3), mode, exprP: qP(exprP), blink: B.blink, seed,
        breath: B.breath, tilt: q(B.tilt + (speaking ? gestureAt(f, 5, SPEAK.at(f).nod).sway : 0), 2),
        headTilt: q(B.headTilt + G.tilt, 2), look: q(G.look, 2), lookY: q(G.lookY, 2),
        squash: q(Math.max(B.squashL, P.squash, dip), 3), armPose: AP(hL, hR),
      },
    }, { yaw, ov, drawOv });
  };
  // ---------- THE MAYOR ----------
  const mayorActor = (yaw) => {
    const seed = 41, B = base(seed), G = mayorGaze(f), pos = mayorAt(f);
    const laughShake = S.id === 'laugh' ? 0.03 * (0.5 + 0.5 * Math.sin(f * 0.85 + seed * 2)) : 0;
    add('mayor', OUTFITS.mayor, {
      x: pos.x, z: pos.z,
      opts: {
        phase: q(mayorMove.phase(f), 3), mode: mayorMove.moving(f) ? 'march' : 'stand',
        exprP: qP(mayorEmo(f)), blink: B.blink, seed, breath: B.breath,
        tilt: B.tilt, headTilt: q(B.headTilt + G.tilt, 2), look: q(G.look, 2), lookY: q(G.lookY, 2),
        squash: q(Math.max(B.squashL, laughShake), 3),
      },
    }, { yaw });
  };
  // ---------- VILLAGERS / WATCHMEN / SON ----------
  const villager = (id, outfit, seed, x, z, yaw, emo, jump) => {
    const B = base(seed), J = jump ? jump(f) : { y: 0, squash: 0, lean: 0 };
    const laughShake = S.id === 'laugh' ? 0.03 * (0.5 + 0.5 * Math.sin(f * 0.85 + seed * 2)) : 0;
    add(id, outfit, {
      x, z, y: J.y,
      opts: {
        phase: 0, mode: 'stand', exprP: qP(emo(f)), blink: B.blink, seed, breath: B.breath,
        tilt: q(B.tilt + (J.lean || 0), 2), headTilt: B.headTilt, look: 0.15, lookY: 0,
        squash: q(Math.max(B.squashL, J.squash || 0, laughShake), 3),
      },
    }, { yaw });
  };
  const watchman = (id, seed, x, z, yaw) => {
    const B = base(seed, 0.7);
    add(id, OUTFITS.watchman, {
      x, z,
      opts: {
        phase: 0, mode: 'stand', exprP: qP(emoTrack([[0, 'stern']], seed)(f)), blink: B.blink, seed,
        breath: B.breath, tilt: B.tilt, headTilt: B.headTilt, look: 0.2, lookY: 0.1,
        squash: q(B.squashL, 3), armPose: AP(null, { x: 432, y: 440, grip: 0.8 }),
      },
    }, { yaw });
  };
  const sonActor = () => {
    const seed = 71, B = base(seed), sn = sonAt(f);
    if (!sn) return;
    const laughShake = S.id === 'payoff' ? 0.035 * (0.5 + 0.5 * Math.sin(f * 0.8 + seed)) : 0;
    out.push({
      id: 'son', x: sn.x, y: 0.9, z: sn.z, r: 0.32, ground: 0,
      actor: (TT) => ({
        key: 'son' + JSON.stringify(OUTFITS.son) + JSON.stringify({ m: S.id, e: qP(sonEmo(f)), sq: q(laughShake, 3), bl: B.blink }),
        draw: (p) => TT.bodyFront(p, OUTFITS.son, {
          phase: 0, mode: 'stand', exprP: qP(sonEmo(f)), blink: B.blink, seed,
          breath: B.breath, tilt: B.tilt, headTilt: B.headTilt, look: -0.15, lookY: 0.05,
          squash: q(Math.max(B.squashL, laughShake), 3),
        }),
        x: sn.x, y: 0.9, z: sn.z, ground: 0, tint: '#ffffff', yaw: 0.3,
      }),
    });
  };

  switch (S.id) {
    case 'drone': {
      shoeActor(0.5);
      mayorActor(-0.5);
      villager('villager1', OUTFITS.villager1, 51, 5.2, 2.0, -0.3, v1Emo, null);
      villager('villager2', OUTFITS.villager2, 52, -3.2, 7.2, 0.4, v2Emo, null);
      break;
    }
    case 'watch': {
      watchman('watch1', 61, -2.0, 6.5, 0.2);
      watchman('watch2', 62, 2.0, 6.5, -0.2);
      watchman('watch3', 63, 5.0, 4.0, -0.6);
      shoeActor(0.4);
      break;
    }
    case 'measure': {
      shoeActor(0.55);
      mayorActor(-0.55);
      villager('villager1', OUTFITS.villager1, 51, 5.2, 2.0, -0.3, v1Emo, null);
      break;
    }
    case 'stitch': {
      shoeActor(0.5);
      villager('villager2', OUTFITS.villager2, 52, -3.2, 7.2, 0.4, v2Emo, null);
      break;
    }
    case 'laugh': {
      shoeActor(0.5);
      villager('villager1', OUTFITS.villager1, 51, 5.2, 2.0, -0.3, v1Emo, v1Jump);
      villager('villager2', OUTFITS.villager2, 52, -3.2, 7.2, 0.4, v2Emo, null);
      villager('villager3', OUTFITS.villager3, 53, 6.0, 8.0, -0.5, v3Emo, null);
      mayorActor(-0.5);
      break;
    }
    case 'bells': {
      shoeActor(0.5);
      villager('villager1', OUTFITS.villager1, 51, 5.2, 2.0, -0.3, v1Emo, null);
      break;
    }
    case 'mayor': {
      mayorActor(-0.5);
      shoeActor(0.5);
      break;
    }
    case 'dialogue': {
      shoeActor(0.5);
      mayorActor(-0.5);
      break;
    }
    case 'riverbank': {
      shoeActor(0.55);
      mayorActor(-0.55);
      villager('villager1', OUTFITS.villager1, 51, 5.2, 2.0, -0.3, v1Emo, null);
      break;
    }
    case 'midnight': {
      // the shoes walk alone in the dark; one villager at his doorway,
      // flinching as the bells pass
      villager('villager2', OUTFITS.villager2, 52, -3.2, 7.2, 0.4, v2Emo, v2Jump);
      break;
    }
    case 'payoff': {
      sonActor();
      shoeActor(0.5);
      mayorActor(-0.5);
      villager('villager1', OUTFITS.villager1, 51, 5.2, 2.0, -0.3, v1Emo, v1Jump);
      break;
    }
    case 'soles': {
      sonActor();
      shoeActor(0.55);
      mayorActor(-0.5);
      break;
    }
    case 'hookq': case 'hook': {
      // END RULE: the final stretch is narration + board only — the
      // shoemaker stands in the foreground, mouth closed, pointing up
      // at the hook board. Nobody speaks.
      shoeActor(-0.25);
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 12, { h: 2.6, id: 'wallE' }),
  ...HOUSES.map((h, i) => SOL.obb(h.x, h.z, h.ry, h.w / 2, h.d / 2, { h: 3.2, id: 'house' + i })),
  SOL.obb(STALL.x, STALL.z, STALL.ry, 1.3, 0.8, { h: 2.2, id: 'stall' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const sh = shoesAt(f);
  // the giant shoes: ground-checked whenever they REST (stall table top
  // 0.78 / riverbank ground 0); while carried or walking on stilts they
  // are transitional and unchecked, like a fall.
  if (sh.resting) items.push({ id: 'shoes', y: sh.y, ground: f < 1065 ? 0.78 : 0, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.id === 'son' ? 0.9 : 0, maxHover: a.y > 0.01 ? 0.3 : 0.06 });
  return items;
};
