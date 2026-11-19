// Shot plan for "The Man Who Sold the Same Horse Seven Times" — horse
// (LIBRARY v4 + Salted Mine V3 style lock: painted world, card characters,
// word-by-word captions, body actions, performed dialogue).
// R2 REBUILD (Abid approved the moonrent-hindi R2 proof as THE standard):
// same voice, timing, words, mix, lights and set — the six signature
// beats re-staged to true R2 grammar: (1) OPENING on the seller BIG
// beside his horse (head ~43% of frame width at f0, low angle, hand up
// at the horse's neck, push-in); (2) the 'coins' ACTION beat as a front
// three-quarter medium-close, both men front-on, hands meeting at
// centre, the coin passing on the word "paid" (mirror of moonrent's
// market R3 fix — never behind the cards); (3) the buyer's morning
// REACTION pushed to ~67% face width; (4) the dialogue hold tightened
// to moonrent's 38%->58% push; (5) L14 opens on an INSERT — the
// midnight treat bowl by the shed door filling ~90% of frame width —
// then pulls back to the kneeling dealer and the horse's lowered head;
// (6) the film ends on a CHARACTER BEAT: the dealer KNEELS in the
// foreground pointing up at the hook board behind him (board-only
// wide shot banned). All other shots keep their v1 V3 grammar.
// Voice stem: Google AI Studio Puck, 57.611 s, 30 fps, TOTAL 1729; clause
// timings from faster-whisper small (work/words.json, full-file decode,
// word-match 0.9906). Scene changes ONLY at clause boundaries:
//   L1 0.00-4.58   sold the same horse seven times, full price
//   L2 5.04-8.14   strong, gentle, fastest in the district
//   L3 8.64-11.28  each buyer rode it home proudly
//   L4 11.54-15.06 every morning the stable was empty
//   L5 15.54-18.74 no broken lock, no cut rope — vanished
//   L6 19.16-22.64 furious buyers marched back
//   L7 22.92-26.54 dealer pointed at his field: horse grazing
//   L8 26.54-30.16 shrugged, sold it to the next man
//   L9 30.50-33.78 the seventh buyer stayed awake, followed at midnight
//   L10 34.16-38.16 horse slipped its loose door, trotted home alone
//   L11 38.56-41.72 at dawn he confronted the dealer, waving the rope
//   L12 42.12-44.30 the dealer only grinned, gave his famous answer
//   L13 44.64-48.24 DIALOGUE (performed, lip-synced): "I never sold him
//                   seven times, sir. He sold himself — I just collected."
//   L14 48.66-52.94 two years of one special treat, midnight, at home
//   L15 52.94-57.20 hook: the night watchman who slept all night…
// GRADE (FILTER_VFX_LIGHTING pack): Sunny Pop day market, soft Dawn for the
// morning/dawn beats, Night Lamp for the midnight beats, dusk for the hook.
// Grade changes ONLY on clause boundaries; boards are never graded.
// WORLD (one set): market yard (dirt, z<9) — fence line z=9 with a gate gap
// x[-0.4,2.6] — the dealer's grass field + stable shed behind it (z>9.5);
// the current buyer's stable at (-13,3) with a loose front door; the road
// runs from that stable's front along z~1-3 to the dealer's gate.
import { M, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1729, DECK = 0;
export const SHOTS = [
  { id: 'deal', a: 0, b: 84, light: 'day' },
  { id: 'coins', a: 85, b: 150, light: 'day' },
  { id: 'horse', a: 151, b: 258, light: 'day' },
  { id: 'ride', a: 259, b: 345, light: 'day' },
  { id: 'morning', a: 346, b: 465, light: 'dawn' },
  { id: 'lock', a: 466, b: 519, light: 'night' },
  { id: 'empty', a: 520, b: 574, light: 'night' },
  { id: 'march', a: 575, b: 687, light: 'day' },
  { id: 'field', a: 688, b: 795, light: 'day' },
  { id: 'shrug', a: 796, b: 914, light: 'day' },
  { id: 'follow', a: 915, b: 1024, light: 'night' },
  { id: 'slip', a: 1025, b: 1156, light: 'night' },
  { id: 'dawn', a: 1157, b: 1263, light: 'dawn' },
  { id: 'grin', a: 1264, b: 1338, light: 'dawn' },
  { id: 'dialogue', a: 1339, b: 1459, light: 'day' },
  { id: 'treat', a: 1460, b: 1587, light: 'night' },
  { id: 'hookq', a: 1588, b: 1650, light: 'day' },
  { id: 'hook', a: 1651, b: 1728, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const lerp3 = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)];

// ---------- lights / mood grades ----------
const WATER = { waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 235, el: 34, sky: '#ffe9bb', ground: '#8a6f4a', hemi: 1.05, sun: '#ffdca3', sunI: 2.5, fog: '#eedcae', fogNear: 40, fogFar: 320,
    skyTop: '#3f74c2', skyHor: '#f6d9a0', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.12, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#fff0cd', ...WATER },
  dawn: { az: 255, el: 15, sky: '#f2c9a0', ground: '#6b5138', hemi: 0.95, sun: '#ffb377', sunI: 2.1, fog: '#eac49c', fogNear: 34, fogFar: 280,
    skyTop: '#4d5f9e', skyHor: '#f7b183', sunDisc: '#ffc98f', sunSize: 0.005, sat: 1.07, vig: 0.27, shadowExt: 24, aurora: 0, gain: '#ffe6c4', ...WATER },
  night: { az: 210, el: 48, sky: '#33406e', ground: '#141a2c', hemi: 0.38, sun: '#93b4ff', sunI: 0.55, fog: '#10182e', fogNear: 7, fogFar: 85,
    skyTop: '#070d22', skyHor: '#1d2a4d', sunDisc: '#dfe9ff', sunSize: 0.0028, sat: 0.94, vig: 0.34, shadowExt: 20, aurora: 0, gain: '#ccd8f2', ...WATER },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.92, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.05, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba', ...WATER },
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
  if (S.id === 'hookq') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 1588, 1650)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const BOARD_POS = [1.1, 2.3, 8.55];
export const SIGN_POS = BOARD_POS;
const yawOf = (dx, dz) => Math.atan2(dx, dz);
// slow graze cycle: head drops, dwells (chewing), lifts, looks, drops again
const grazeAt = (f, s = 0) => {
  const u = 0.5 + 0.5 * Math.sin(f * 0.013 + s);
  return u > 0.62 ? 1 : u < 0.3 ? 0.22 : 0.22 + (u - 0.3) / 0.32 * 0.78;
};

// ---------- the horse (3D character in main.js, posed from here) ----------
const horseRaw = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'deal': return { k: 1, x: 2.5, z: 6.3, yaw: -1.15, headK: 0.15, saddleK: 1 };
    case 'coins': return { k: 1, x: 3.1, z: 6.7, yaw: -1.3, headK: 0.15, saddleK: 1 };
    case 'horse': return { k: 1, x: 0.6, z: 13.2, yaw: 1.05, headK: 0.05, saddleK: 1 };
    case 'ride': {
      const p = kf3([[259, [4.2, 0, 4.6]], [302, [-3.5, 0, 0.2]], [345, [-11.3, 0, -1.3]]], f);
      return { k: 1, x: p[0], z: p[2], yaw: yawOf(-15.5, -2.3), headK: 0.25, saddleK: 1 };
    }
    case 'march': case 'field': return { k: 1, x: 2.8, z: 13.0, yaw: -2.64, headK: grazeAt(f, 1.3), saddleK: 0 };
    case 'shrug': return { k: 1, x: 2.8, z: 13.0, yaw: -2.64, headK: grazeAt(f, 0.9), saddleK: 1 };
    case 'follow': return { k: 1, x: -11.2, z: 3.2, yaw: 3.14, headK: 0.3, saddleK: 0 };
    case 'slip': {
      const p = kf3([[1025, [-12.4, 0, 4.2]], [1052, [-10.95, 0, 3.2]], [1078, [-10.95, 0, 0.3]], [1096, [-10.2, 0, -1.5]], [1116, [-6.5, 0, 0.2]], [1156, [1.1, 0, 8.3]]], f);
      const yaw = f < 1052 ? yawOf(1.45, -1.0) : f < 1096 ? yawOf(0, -1) : f < 1116 ? yawOf(3.7, 1.7) : yawOf(7.6, 8.1);
      return { k: 1, x: p[0], z: p[2], yaw, headK: 0.2, saddleK: 0 };
    }
    case 'dawn': case 'grin': case 'dialogue': return { k: 1, x: 3.0, z: 12.6, yaw: -0.85, headK: grazeAt(f, 4.1), saddleK: 0 };
    case 'treat': return { k: 1, x: 8.9, z: 13.9, yaw: -1.85, headK: kf([[1460, 0.35], [1485, 0.92], [1555, 0.92], [1580, 0.4]], f), saddleK: 0 };
    case 'hookq': case 'hook': return { k: 1, x: 6.2, z: 7.2, yaw: -0.5, headK: 0.1, saddleK: 0 };
    default: return { k: 0, x: 2.8, z: 13.0, yaw: 0, headK: 0.3, saddleK: 0 };
  }
};
// gait phase from DISTANCE travelled (planted feet: legs cycle with ground
// speed, freeze when the horse stands) — precomputed once, random-access.
const HPOS = [], HPHASE = [];
{
  let px = null, pz = null, ph = 0;
  for (let f = 0; f < TOTAL; f++) {
    const p = horseRaw(f);
    if (p.k > 0) {
      if (px !== null) ph += Math.hypot(p.x - px, p.z - pz) / 1.9 * Math.PI * 2;
      px = p.x; pz = p.z;
    } else { px = null; pz = null; }
    HPOS.push(p); HPHASE.push(ph);
  }
}
export const horseAt = (f) => ({ ...HPOS[clamp(Math.round(f), 0, TOTAL - 1)], phase: HPHASE[clamp(Math.round(f), 0, TOTAL - 1)] });
export const horsePosAt = (f) => { const h = horseAt(f); return [h.x, 0, h.z]; };

// ---------- people anchors ----------
export const dealerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'deal': return { x: 1.0, z: 6.05 };
    case 'coins': return { x: 1.35, z: 5.1 };
    case 'horse': return { x: -2.2, z: 12.6 };
    case 'march': case 'field': return { x: 0.2, z: 7.6 };
    case 'shrug': return { x: 0.6, z: 5.2 };
    case 'dawn': case 'grin': case 'dialogue': return { x: 1.5, z: 7.9 };
    case 'treat': return { x: 6.3, z: 12.4 };
    // R2 final (v2): the dealer kneels in the near FOREGROUND on the
    // road in front of the gate (z 0.9, ~4.7m from the hook camera) so
    // his head reads ~26% of frame width beside the board — at z 4.35
    // he shrank to ~13% and the character beat was lost. x 1.25 puts
    // him screen-LEFT of the board axis (looking +z, screen-left = +x)
    case 'hookq': case 'hook': return { x: 1.25, z: 0.9 };
    default: return { x: 0.4, z: 4.8 };
  }
};
export const buyer1At = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'deal': return { x: 4.5, z: 7.6 };
    case 'coins': return { x: 2.15, z: 5.15 };
    case 'ride': { const h = horseAt(f); return { x: h.x, z: h.z }; }
    case 'morning': { const u = smooth(ramp(f, 348, 388)); return { x: lerp(-9.2, -10.8, u), z: lerp(-1.4, -0.15, u) }; }
    case 'march': { const u = smooth(ramp(f, 578, 678)); return { x: lerp(-15.5, -5.0, u), z: lerp(-0.9, -0.5, u) }; }
    default: return { x: 3.6, z: 4.3 };
  }
};
export const buyer2At = (f) => {
  const S = shotAt(f);
  if (S.id === 'march') { const u = smooth(ramp(f, 578, 678)); return { x: lerp(-16.6, -6.6, u), z: lerp(-0.5, -0.1, u) }; }
  if (S.id === 'shrug') return { x: 2.05, z: 4.75 };
  return { x: 3.8, z: 4.4 };
};
export const buyer3At = (f) => {
  const u = smooth(ramp(f, 578, 678));
  return { x: lerp(-17.3, -7.5, u), z: lerp(-1.3, -0.9, u) };
};
export const buyer7At = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'follow': return { x: -8.4, z: -2.6 };
    case 'slip': {
      const p = kf3([[1025, [-8.5, 0, -2.7]], [1092, [-8.45, 0, -2.5]], [1156, [-4.4, 0, 0.2]]], f);
      return { x: p[0], z: p[2] };
    }
    case 'dawn': case 'grin': case 'dialogue': return { x: 0.1, z: 6.3 };
    default: return { x: 0.1, z: 6.3 };
  }
};

// ---------- hero / focus ----------
const FOCUS = {
  deal: () => [1.15, 1.5, 6.2],
  coins: () => [1.75, 1.2, 5.12],
  horse: () => [2.05, 1.72, 14.05],
  ride: () => { const h = horseAt(300); return [h.x, 1.5, h.z]; },
  morning: (f) => { const b = buyer1At(f); return [b.x, 1.5, b.z]; },
  lock: () => [-10.45, 1.05, 0.55],
  empty: () => [-14.8, 0.95, 5.0],
  march: () => { const b = buyer1At(630); return [b.x, 1.4, b.z]; },
  field: (f) => (f < 735 ? [0.2, 1.45, 7.6] : [1.9, 0.95, 11.4]),
  shrug: (f) => (f < 862 ? [1.4, 1.3, 5.0] : [0.6, 1.4, 5.2]),
  follow: () => [-11.2, 1.2, 2.4],
  slip: () => { const h = horseAt(1090); return [h.x, 1.4, h.z]; },
  dawn: () => [1.5, 1.45, 7.9],
  grin: () => [1.5, 1.5, 7.9],
  dialogue: () => [1.5, 1.45, 7.9],
  // rack: starts ON the treat bowl (the insert), settles on the
  // kneeling dealer + the horse's lowered head as the camera pulls back
  treat: (f) => lerp3([7.05, 0.3, 13.15], [7.3, 0.9, 13.4], smooth(ramp(f, 1470, 1525))),
  hookq: () => BOARD_POS,
  hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: V4 ACTION UPGRADE (2026-11-19) — same staging,
// anchors and end framings as the R2 build; the MOTION is rebuilt to
// the v4 grammar (waterrun-hindi / fireless-hindi samples): every shot
// opens pulled-back and SNAPS in with an easeOut burst over ~14-18
// frames (subject scale x1.5-2.5), tracking shots ride locked at the
// subject's own speed, dialogue/grin pushes are front-loaded then
// hold, and real impact kicks land on the action beats. No slow
// creep, no frozen holds: after the snap each shot keeps a settle
// key in motion. The hook/hookq END keys are the R2-proven board
// framing, byte-identical — only their speed shape changed.
const dealerPos = (f) => { const d = dealerAt(f); return [d.x, 0, d.z]; };
const RIG_BY_ID = {
  // R2 OPENING (v2): ON the seller BIG beside his horse from frame 0 —
  // the camera sits SOUTH-EAST looking north-west so the horse's head
  // and neck read large at frame LEFT and the dealer (card FLIPPED so
  // his raised prop hand reaches toward the horse) fills the right,
  // head ~40% of frame width growing to ~49% (V3 f0 grammar: hero
  // mid-action, already pushing in). The first framing (camera SW)
  // stacked the horse's head directly behind the dealer's hat.
  deal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [3.74, 1.28, 2.49], look: [1.2, 1.52, 6.42], fov: 43 },
    { f: 15, pos: [2.9, 1.2, 3.8], look: [1.2, 1.5, 6.42], fov: 37, ease: 'easeOut' },
    { f: 84, pos: [2.8, 1.22, 3.95], look: [1.2, 1.49, 6.42], fov: 36, ease: 'smooth' }] }) },
  // R2 ACTION BEAT: the coin pass as a front three-quarter medium-close
  // (moonrent market R3 framing) — both men front-on, faces and torsos
  // in frame, hands meeting at centre, the coin crossing on "paid"
  coins: { cut: 'hard', raw: keysCam({ keys: [
    { f: 85, pos: [0.69, 1.66, 1.45], look: [1.78, 1.16, 5.12], fov: 42 },
    { f: 99, pos: [1.1, 1.5, 2.7], look: [1.78, 1.16, 5.12], fov: 36.5, ease: 'easeOut' },
    { f: 150, pos: [1.18, 1.48, 2.86], look: [1.79, 1.13, 5.13], fov: 35, ease: 'smooth' }] }) },
  // HERO horse: low angle, the horse fills the frame, dealer small at left
  horse: { cut: 'hard', raw: keysCam({ keys: [
    { f: 151, pos: [6.06, 1.93, 19.95], look: [1.2, 1.62, 13.6], fov: 41 },
    { f: 166, pos: [4.45, 1.8, 17.7], look: [1.22, 1.63, 13.62], fov: 35, ease: 'easeOut' },
    { f: 210, pos: [4.35, 1.79, 17.6], look: [1.24, 1.64, 13.64], fov: 34.5, ease: 'smooth' },
    { f: 258, pos: [4.25, 1.78, 17.45], look: [1.25, 1.64, 13.65], fov: 34, ease: 'smooth' }] }) },
  // ride: side tracking at the horse's own speed — the distance snaps
  // in over the first 15 frames (v4), then the camera rides locked to
  // the horse, rider centred the whole way
  ride: { cut: 'hard', raw: (f) => {
    const h = horsePosAt(f), u = M.easeOut(ramp(f, 259, 274)), d = lerp(11.5, 7.6, u);
    return { pos: [h[0] + 0.12 * d, lerp(1.75, 1.52, u), h[2] - 0.99 * d], look: [h[0] - 0.54, 1.45, h[2] - 0.08], fov: lerp(43, 38, u), roll: 0 };
  } },
  // morning: buyer crosses to his stable, hauls the door open — the
  // push keeps going to a true R2 REACTION: his face passes 65% of
  // frame width as the shock lands on "empty"
  morning: { cut: 'hard', raw: keysCam({ keys: [
    { f: 346, pos: [-7.9, 1.95, -7.3], look: [-10.5, 1.3, 0.4], fov: 43 },
    { f: 360, pos: [-9.3, 1.78, -4.9], look: [-10.9, 1.36, 0.1], fov: 36, ease: 'easeOut' },
    { f: 408, pos: [-9.85, 1.68, -4.05], look: [-11.0, 1.42, 0.0], fov: 31, ease: 'smooth' },
    { f: 430, pos: [-10.5, 1.6, -3.1], look: [-10.85, 1.48, -0.1], fov: 27.5, ease: 'easeOut' },
    { f: 465, pos: [-10.66, 1.57, -2.78], look: [-10.85, 1.5, -0.12], fov: 26.5, ease: 'smooth' }] }) },
  // INSERT: the padlock — unbroken. the rope — uncut. nothing was forced.
  lock: { cut: 'hard', raw: keysCam({ keys: [
    { f: 466, pos: [-9.63, 1.55, -2.53], look: [-10.45, 1.05, 0.55], fov: 34 },
    { f: 479, pos: [-10.08, 1.34, -1.05], look: [-10.46, 1.05, 0.55], fov: 27.5, ease: 'easeOut' },
    { f: 519, pos: [-10.18, 1.31, -0.9], look: [-10.46, 1.06, 0.55], fov: 26.5, ease: 'smooth' }] }) },
  // the empty stall: hay untouched, one moonbeam — a decisive push
  // across the nothing in the first 16 frames, then the settle
  empty: { cut: 'hard', raw: keysCam({ keys: [
    { f: 520, pos: [-9.9, 1.62, 0.6], look: [-14.8, 0.95, 5.0], fov: 44 },
    { f: 536, pos: [-10.75, 1.5, 1.95], look: [-14.85, 0.93, 5.02], fov: 38.5, ease: 'easeOut' },
    { f: 574, pos: [-10.95, 1.47, 2.15], look: [-14.9, 0.92, 5.05], fov: 37.5, ease: 'smooth' }] }) },
  // march: front-track ahead of the furious buyers, faces big, feet locked
  march: { cut: 'hard', raw: keysCam({ keys: [
    { f: 575, pos: [-16.5, 2.05, -9.8], look: [-17.2, 1.35, -0.8], fov: 45 },
    { f: 589, pos: [-13.6, 1.92, -8.7], look: [-16.2, 1.34, -0.78], fov: 42.5, ease: 'easeOut' },
    { f: 632, pos: [-8.6, 1.88, -8.6], look: [-10.9, 1.32, -0.7], fov: 42, ease: 'smooth' },
    { f: 687, pos: [-2.9, 1.79, -8.35], look: [-5.9, 1.32, -0.55], fov: 40.5, ease: 'surge' }] }) },
  // field: hold the dealer's calm point, then swing WITH his arm to the
  // horse grazing in the field behind him — the payoff lands on the horse
  field: { cut: 'whip', blend: 18, raw: keysCam({ keys: [
    { f: 688, pos: [-2.1, 1.74, 2.9], look: [0.2, 1.42, 7.6], fov: 40 },
    { f: 716, pos: [-2.25, 1.66, 4.7], look: [1.5, 1.2, 10.4], fov: 36.5, ease: 'easeInOut' },
    { f: 795, pos: [-0.65, 1.57, 7.7], look: [1.9, 0.95, 11.4], fov: 33.5, ease: 'surge' }] }) },
  // shrug: the dealer shrugs, takes the next man's coins, hands the rope
  shrug: { cut: 'hard', raw: keysCam({ keys: [
    { f: 796, pos: [-2.6, 1.8, -2.6], look: [1.4, 1.3, 5.0], fov: 48 },
    { f: 810, pos: [-1.6, 1.7, -0.7], look: [1.38, 1.29, 5.02], fov: 43.5, ease: 'easeOut' },
    { f: 862, pos: [-1.45, 1.67, -0.4], look: [1.35, 1.29, 5.05], fov: 42, ease: 'smooth' },
    { f: 914, pos: [-0.55, 1.6, 1.25], look: [0.75, 1.3, 5.25], fov: 35.5, ease: 'surge' }] }) },
  // follow: night — the seventh buyer crouched in shadow with a lantern,
  // the horse standing in its stall across the yard, both in one frame
  follow: { cut: 'hard', raw: keysCam({ keys: [
    { f: 915, pos: [-5.6, 2.4, -6.6], look: [-10.9, 0.95, 1.5], fov: 44 },
    { f: 938, pos: [-6.55, 2.18, -4.95], look: [-10.95, 0.95, 1.55], fov: 38, ease: 'easeOut' },
    { f: 1024, pos: [-6.75, 2.14, -4.6], look: [-11.0, 0.95, 1.6], fov: 36.5, ease: 'smooth' }] }) },
  // slip: side tracking on the horse the whole way home — it is the subject,
  // biggest in frame; the buyer trails in darkness behind. Distance snaps
  // in over the first 16 frames (v4), then locked to the horse's speed.
  slip: { cut: 'hard', raw: (f) => {
    const h = horsePosAt(f), u = M.easeOut(ramp(f, 1025, 1041)), d = lerp(11.0, 7.9, u);
    return { pos: [h[0] - 0.25 * d, lerp(1.7, 1.47, u), h[2] - 0.97 * d], look: [h[0] + 0.3, 1.38, h[2]], fov: lerp(45, 39, u), roll: 0 };
  } },
  // dawn: the confrontation at the gate — rope waved, dealer unruffled
  dawn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1157, pos: [-2.7, 1.85, 1.2], look: [0.8, 1.35, 7.2], fov: 42 },
    { f: 1172, pos: [-1.25, 1.65, 3.15], look: [0.83, 1.34, 7.22], fov: 35, ease: 'easeOut' },
    { f: 1263, pos: [-1.0, 1.61, 3.4], look: [0.85, 1.34, 7.25], fov: 33.5, ease: 'smooth' }] }) },
  // grin: the dealer's face fills the frame — grin, then the wink
  grin: { cut: 'blend', blend: 14, raw: keysCam({ keys: [
    { f: 1264, pos: [0.05, 1.66, 4.15], look: [1.5, 1.5, 7.9], fov: 36 },
    { f: 1282, pos: [0.5, 1.59, 5.3], look: [1.5, 1.5, 7.9], fov: 29.5, ease: 'easeOut' },
    { f: 1338, pos: [0.58, 1.57, 5.5], look: [1.5, 1.5, 7.9], fov: 28.5, ease: 'smooth' }] }) },
  // dialogue: the camera HOLDS on the speaker for the whole line (speak
  // gate rule) — no cutaway. V4: the push is front-loaded (the face
  // reaches dialogue scale by ~f1395), then a true hold with only
  // micro-settle for the rest of the line
  dialogue: { cut: 'blend', blend: 14, raw: keysCam({ keys: [
    { f: 1339, pos: [0.22, 1.62, 3.3], look: [1.42, 1.44, 7.88], fov: 37 },
    { f: 1395, pos: [0.58, 1.57, 5.05], look: [1.45, 1.44, 7.89], fov: 29, ease: 'easeOut' },
    { f: 1459, pos: [0.62, 1.56, 5.24], look: [1.46, 1.44, 7.89], fov: 28.3, ease: 'smooth' }] }) },
  // treat: R2 INSERT first — the camera opens ON the midnight treat
  // bowl waiting by the shed door, the bowl filling ~90% of frame
  // width in the lantern pool; then one continuous pull-back reveals
  // the ritual: the dealer kneeling, the horse's head coming down
  treat: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1460, pos: [6.66, 0.6, 11.6], look: [7.04, 0.3, 13.14], fov: 36 },
    { f: 1500, pos: [4.9, 1.25, 9.95], look: [6.98, 0.85, 13.25], fov: 37, ease: 'easeOut' },
    { f: 1587, pos: [4.3, 1.42, 9.45], look: [7.0, 0.95, 13.3], fov: 37, ease: 'smooth' }] }) },
  // hookq: R2 — the gate at dusk, the board rising into frame as the
  // question is asked; the dealer already kneels in the foreground
  // below it, pointing up (the final's character beat starts here).
  // V4: the push-in is front-loaded; the END key is the R2-proven
  // board framing, untouched.
  hookq: { cut: 'whip', blend: 20, raw: keysCam({ keys: [
    { f: 1588, pos: [0.05, 2.42, -7.6], look: [1.1, 2.2, 8.55], fov: 46 },
    { f: 1606, pos: [0.42, 2.1, -4.85], look: [1.1, 2.19, 8.55], fov: 42.8, ease: 'easeOut' },
    { f: 1650, pos: [0.45, 2.08, -4.6], look: [1.1, 2.19, 8.55], fov: 42.5, ease: 'smooth' }] }) },
  // hook: R2 FINAL — character beat + board together: the kneeling
  // dealer in the foreground points up at the board, full and readable
  // with margins, held to the literal last frame
  hook: { cut: 'blend', blend: 16, raw: keysCam({ keys: [
    { f: 1651, pos: [0.45, 2.08, -4.6], look: [1.1, 2.19, 8.55], fov: 42.5 },
    { f: 1728, pos: [0.6, 2.0, -3.8], look: [1.1, 2.2, 8.55], fov: 41, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  // V4 impact kicks (amplitudes in the proven sample range; the old
  // 0.02 ticks were inaudible): the coin lands in the dealer's palm
  // (f112), the stable door bangs fully open (f418), the rope changes
  // hands (f872), the horse bursts out and breaks into its trot
  // (f1078), the horse's head lands at the treat bowl (f1488), the
  // hook board finishes rising (f1632).
  kicks: [{ f: 112, a: 0.16 }, { f: 418, a: 0.2 }, { f: 872, a: 0.12 }, { f: 1078, a: 0.22 }, { f: 1488, a: 0.13 }, { f: 1632, a: 0.12 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['march', 'hook', 'hookq', 'empty'].includes(S.id)) cinf = 1.4;
  if (['coins', 'lock', 'grin', 'dialogue'].includes(S.id)) cinf = 3.5;
  if (['horse', 'follow'].includes(S.id)) cinf = 3.0;
  if (S.id === 'treat') cinf = 3.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const h = horseAt(f);
  const b7 = buyer7At(f);
  const night = S.light === 'night';
  // the loose stable door: shut for the lock insert (it was never forced),
  // hauled open by buyer1 in the morning, and slipped by the horse itself
  // at midnight — it swings on its loose hinge f1040-1090 and stays ajar
  let doorK = 0;
  if (S.id === 'morning') doorK = smooth(ramp(f, 392, 416));
  else if (S.id === 'follow') doorK = 0.06;
  else if (S.id === 'slip') doorK = f < 1046 ? 0.06 : f > 1078 ? 0.92 : 0.06 + 0.86 * smooth(ramp(f, 1046, 1078));
  else if (S.id === 'dawn' || S.id === 'grin' || S.id === 'dialogue') doorK = 0.92;
  const moving = (S.id === 'ride' || S.id === 'slip') && h.k > 0;
  return {
    always: 1,
    boardHook: S.id === 'hook' ? 1 : S.id === 'hookq' ? smooth(ramp(f, 1600, 1632)) : 0,
    lampK: night ? 1 : 0,
    lampStable: (S.id === 'lock' || S.id === 'empty' || S.id === 'follow' || S.id === 'slip') ? 1 : 0,
    lampDealer: S.id === 'treat' ? 1 : 0,
    lampHand: (S.id === 'follow' || S.id === 'slip') ? 1 : 0,
    lampHX: b7.x + 0.42, lampHY: 1.02, lampHZ: b7.z + 0.3,
    doorK,
    treatK: S.id === 'treat' ? smooth(ramp(f, 1468, 1485)) * (1 - smooth(ramp(f, 1562, 1580))) : 0,
    ropeK: (S.id === 'dawn' || S.id === 'grin') ? 1 : 0,
    ropeX: 0.32, ropeY: 1.52, ropeZ: 6.35,
    blastX: moving ? h.x : 0, blastY: 0.25, blastZ: moving ? h.z : 5,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  let dust = 0;
  if (S.id === 'ride') dust = 0.55;
  if (S.id === 'slip') dust = f > 1078 ? 0.8 : 0.25;
  if (S.id === 'march') dust = 0.3;
  return {
    moteRate: S.light === 'day' ? 0.05 : S.light === 'night' ? 0.015 : 0.03,
    blastRate: dust, sparkRate: 0, steamRate: 0, shimmerRate: 0,
  };
};
export const fxAt = () => [];

// ---------- cast ----------
// No card tint in any light — faces stay pure white, costumes flat and
// saturated in every grade (Salted Mine V3 rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  dealer: { jacket: '#6e4520', pants: '#3a3230', boots: '#241a12', hat: 'bowler', hatCol: '#4a3220', hatBand: '#2a1c10', shirtFront: '#f3e8d2', suspenders: '#c9a15a', skin: '#fbf7ef', moustache: '#3a281a' },
  buyer1: { jacket: '#31517a', pants: '#33302c', boots: '#1c1712', hat: 'cap', cap: '#2e4a6b', skin: '#fbf7ef' },
  buyer2: { jacket: '#5d6e46', pants: '#3a3a42', boots: '#241a12', hat: 'hair', hair: '#4a3220', skin: '#fbf7ef' },
  buyer3: { jacket: '#7a3040', pants: '#33302c', boots: '#1c1712', hat: 'cap', cap: '#5d2430', skin: '#fbf7ef', moustache: '#2a201a' },
  buyer7: { jacket: '#274b4f', pants: '#2c2c30', boots: '#1c1712', hat: 'cap', cap: '#20303a', skin: '#fbf7ef' },
};
// ---------- HEAD PERFORMANCE ----------
// Expressions MORPH on the narration's emphasis words; heads nod, tilt and
// turn toward whatever the voice names; a continuous idle sway means no
// head is ever frozen. (Pure track folder — T.Emotion is stateful.)
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
const emoDealer = emoTrack('smug', [
  [80, 'grin', 8], [151, 'smug', 8], [688, 'smug', 6], [800, 'grin', 8],
  [1157, 'smug', 8], [1268, 'grin', 7], [1460, 'smile', 9], [1590, 'smug', 8],
]);
const emoBuyer1 = emoTrack('proud', [
  [352, 'shock', 6], [450, 'stern', 8], [575, 'stern', 6],
]);
const emoBuyer2 = emoTrack('smile', [
  [575, 'stern', 6], [830, 'wonder', 8], [885, 'grin', 8],
]);
const emoBuyer3 = emoTrack('stern', []);
const emoBuyer7 = emoTrack('thinking', [
  [1030, 'stern', 7], [1157, 'stern', 6], [1339, 'neutral', 8],
]);
// ---------- BODY ACTIONS (library body.js) ----------
// the dealer KNEELS at his own stable to feed the midnight treat; the
// seventh buyer CROUCHES (one knee) in the dark, watching; buyer1 TURNS
// from the stable door to us as the shock lands; the dealer WINKS on his
// grin beat — the plan working exactly as he built it.
const dealerTreatPose = poseWindows([{ a: 1468, b: 1578, mode: 'kneel', inF: 7, outF: 6 }]);
const dealerHookPose = poseWindows([{ a: 1580, b: 1728, mode: 'kneel', inF: 9, outF: 1 }]);
const buyer7Pose = poseWindows([{ a: 922, b: 1016, mode: 'kneel1', inF: 7, outF: 6 }]);
const buyer1Turn = turnTrack([{ f0: 420, dur: 12, dir: -1 }]);
const dealerWink = winkTrack([{ a: 1300, b: 1312 }]);
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// ---------- ANIMATION UPGRADE v2 (kit body.js, 2026-11-19) ----------
// Continuous life on every standing figure (breath + weight shift +
// micro sway — no robot-standing), physical grips on the two coin
// passes (the hand rises to meet, takes the weight, settles), a
// dialogue gesture hand that talks with the performed line, and
// march phases measured from DISTANCE travelled (feet plant, no
// glide) instead of a free-running clock.
const lifeDealer = lifeAt({ seed: 31 }), lifeBuyer1 = lifeAt({ seed: 51 }), lifeBuyer2 = lifeAt({ seed: 61 }),
  lifeBuyer3 = lifeAt({ seed: 81 }), lifeBuyer7 = lifeAt({ seed: 71 });
const LIFE_FOR = { dealer: lifeDealer, buyer1: lifeBuyer1, buyer2: lifeBuyer2, buyer3: lifeBuyer3, buyer7: lifeBuyer7 };
const gestDealer = gestureAt([{ a: 1339, b: 1459, beats: [1368, 1400, 1431, 1452], base: 0.42, amp: 0.15 }]);
const coinGripB1 = gripAt([{ f0: 84, dur: 2, type: 'lift' }, { f0: 100, dur: 12, type: 'place', settle: 6 }]);
const coinGripD = gripAt([{ f0: 104, dur: 16, type: 'lift', settle: 8 }]);
const coinGripB2 = gripAt([{ f0: 826, dur: 2, type: 'lift' }, { f0: 862, dur: 12, type: 'place', settle: 6 }]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts0, x, z, extra = {}) => {
    // v2 life injection: every non-marching figure breathes and shifts
    // its weight (kit lifeAt via the toon v6 tilt/breath opts). March
    // keeps its own gait sway inside the renderer.
    let opts = opts0;
    const LF = LIFE_FOR[id];
    if (LF && opts0.mode !== 'march') {
      const L = LF(f);
      opts = { tilt: q(L.tilt + L.sway, 1), breath: Math.round(L.breath / 6) * 6, ...opts0 };
    }
    out.push({ id, x, y: extra.y || 0, z, r: extra.r || 0.32, ground: extra.groundY ?? 0, grp: extra.grp || '',
      actor: (T) => ({ key: 'hsx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
        draw: (p) => { T.bodyFront(p, o, opts); },
        x, y: extra.y || 0, z, ground: extra.groundY ?? 0, tint, ...extra }) });
  };
  const d = dealerAt(f), b1 = buyer1At(f), b2 = buyer2At(f), b3 = buyer3At(f), b7 = buyer7At(f);
  let DP = emoDealer.at(f);
  const P1 = emoBuyer1.at(f), P2 = emoBuyer2.at(f), P3 = emoBuyer3.at(f), P7 = emoBuyer7.at(f);
  DP.blush = 0; P1.blush = 0; P2.blush = 0; P3.blush = 0; P7.blush = 0;
  const winkK = dealerWink(f);
  if (winkK > 0) DP = T.blendFaceP(DP, T.faceP('wink', 31), winkK);
  switch (S.id) {
    case 'deal': {
      // R2 opening: the seller alone with his horse, BIG — one arm raised
      // to the horse's neck in a pat, the sales pitch already running.
      // (The buyer is introduced by the 'coins' beat; in v1 he peeked
      // half-hidden from behind the horse — a banned partial face.)
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.62],
        ...head(f, 31, -2, -0.5, 0.05, -0.45) }, d.x, d.z, { yaw: 0.3, flip: true });
      break;
    }
    case 'coins': {
      // the coin crosses between their hands at centre frame, landing
      // in the dealer's palm on the word "paid" (f112). The dealer is
      // FLIPPED (moonrent market rule): the prop arm sits on a fixed
      // side of the card, and unflipped it pointed AWAY from centre —
      // his received coin fell outside the tight frame entirely
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: f >= 112 ? ['coin', q(0.25 + 0.32 * coinGripD(f).k, 2)] : ['point', 0.4],
        ...head(f, 31, -2.5, -0.3, 0.5, -0.3), squash: q(coinGripD(f).squash, 2) }, d.x, d.z, { yaw: 0.4, flip: true });
      std('buyer1', OUTFITS.buyer1, { expr: 'smile', exprP: P1, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: f < 112 ? ['coin', q(0.25 + 0.3 * coinGripB1(f).k, 2)] : null,
        ...head(f, 51, -1.5, -0.35, 0.45, -0.35) }, b1.x, b1.z, { yaw: -0.4 });
      break;
    }
    case 'horse': {
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.35],
        ...head(f, 31, -1.5, 0.55, 0.05, 0.5) }, d.x, d.z, { yaw: 0.5 });
      break;
    }
    case 'ride': {
      // seated ON the horse (sit mode, base at the blanket), proud as a king
      const h = horseAt(f);
      std('buyer1', OUTFITS.buyer1, { expr: 'smile', exprP: P1, mode: 'sit', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -2 + 1.2 * Math.sin(f * 0.22), -0.2, -0.1, -0.2) }, b1.x, b1.z,
        { y: 1.24, groundY: 1.24, grp: 'mount', yaw: -0.25, blob: false, shadow: false });
      void h;
      break;
    }
    case 'morning': {
      const walking = f >= 348 && f < 390;
      const Tn = buyer1Turn(f);
      std('buyer1', OUTFITS.buyer1, { expr: 'smile', exprP: P1, mode: walking ? 'march' : 'stand', phase: q(stridePh(-9.2, b1.x), 2), squash: Tn.squash, blink: blinkAt(f, 51), seed: 51, prop: f >= 392 && f < 420 ? ['point', 0.5] : null,
        ...head(f, 51, walking ? 1.5 * Math.sin(f * 0.26) : kf([[390, 0], [420, -2], [436, -6], [465, -5]], f),
          kf([[390, 0.2], [420, 0.5], [465, 0.1]], f), kf([[390, 0.1], [420, 0.45], [465, 0.2]], f), kf([[390, 0.3], [436, 0], [465, 0]], f)) },
        b1.x, b1.z, { yaw: -0.5 + Tn.yaw, y: Tn.hop });
      break;
    }
    case 'march': {
      const marching = f < 678;
      // v2: each buyer's gait phase comes from HIS OWN distance
      // travelled (stridePh) — feet plant on the ground he covers
      const ph = q(stridePh(-15.5, b1.x), 2);
      std('buyer1', OUTFITS.buyer1, { expr: 'stern', exprP: P1, mode: marching ? 'march' : 'stand', phase: ph, blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.8],
        ...head(f, 51, marching ? 1.6 * Math.sin(f * 0.28) : -1, 0.3, 0, 0.3) }, b1.x, b1.z, { yaw: 0.35 });
      std('buyer2', OUTFITS.buyer2, { expr: 'stern', exprP: P2, mode: marching ? 'march' : 'stand', phase: q(stridePh(-16.6, b2.x), 2), blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, marching ? 1.6 * Math.sin(f * 0.28 + 1.2) : -1, 0.25, 0, 0.25) }, b2.x, b2.z, { yaw: 0.3 });
      std('buyer3', OUTFITS.buyer3, { expr: 'stern', exprP: P3, mode: marching ? 'march' : 'stand', phase: q(stridePh(-17.3, b3.x), 2), blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, marching ? 1.6 * Math.sin(f * 0.28 + 2.1) : -1, 0.3, 0, 0.3) }, b3.x, b3.z, { yaw: 0.3 });
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, -0.5, 0.05, -0.5) }, d.x, d.z, { yaw: -0.5 });
      break;
    }
    case 'field': {
      // the calm point: arm out at the field, head turned WITH the arm
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.85],
        ...head(f, 31, -1.5, kf([[688, 0.2], [730, 0.7], [795, 0.7]], f), 0.05, kf([[688, 0.2], [730, 0.6], [795, 0.6]], f)) }, d.x, d.z, { yaw: 0.55 });
      break;
    }
    case 'shrug': {
      // THE shrug on "shrugged": both shoulders up (squash pulse + head
      // tilt), then the coins, then the rope changes hands
      const shrugK = f >= 806 && f <= 852 ? Math.sin((f - 806) / 46 * Math.PI) : 0;
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: f >= 872 ? ['point', 0.5] : null,
        ...head(f, 31, -2 + 3.2 * shrugK, 0.3, 0.15, 0.3, q(0.1 * shrugK, 2)) }, d.x, d.z, { yaw: 0.4 });
      std('buyer2', OUTFITS.buyer2, { expr: 'smile', exprP: P2, mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: f >= 830 && f < 878 ? ['coin', q(0.25 + 0.3 * coinGripB2(f).k, 2)] : null,
        ...head(f, 61, -1, -0.35, 0.3, -0.35) }, b2.x, b2.z, { yaw: -0.4 });
      break;
    }
    case 'follow': {
      // crouched on one knee in the dark, lantern low, eyes on the stall
      const P = buyer7Pose(f);
      std('buyer7', OUTFITS.buyer7, { expr: 'neutral', exprP: P7, mode: P.mode, squash: P.squash, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, 0.55, 0.25, 0.5) }, b7.x, b7.z, { yaw: 0.5 });
      break;
    }
    case 'slip': {
      // trailing the horse through the dark, staying in its shadow
      const walking = f > 1040;
      std('buyer7', OUTFITS.buyer7, { expr: 'stern', exprP: P7, mode: walking ? 'march' : 'stand', phase: q(stridePh(-8.45, b7.x), 2), blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, walking ? 1.4 * Math.sin(f * 0.25) : -2, 0.5, 0.15, 0.45) }, b7.x, b7.z, { yaw: 0.45 });
      break;
    }
    case 'dawn': {
      // rope waved in the dealer's face; the dealer does not blink
      std('buyer7', OUTFITS.buyer7, { expr: 'stern', exprP: P7, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', q(0.55 + 0.3 * Math.sin(f * 0.32), 2)],
        ...head(f, 71, -2.5, 0.45, 0.05, 0.45) }, b7.x, b7.z, { yaw: 0.5 });
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[1157, -1], [1240, -3], [1263, -3.5]], f), -0.4, 0.05, -0.4) }, d.x, d.z, { yaw: -0.45 });
      break;
    }
    case 'grin': {
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -3.5, -0.25, -0.05, -0.3) }, d.x, d.z, { yaw: -0.35 });
      std('buyer7', OUTFITS.buyer7, { expr: 'stern', exprP: P7, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1, 0.5, 0.1, 0.5) }, b7.x, b7.z, { yaw: 0.5 });
      break;
    }
    case 'dialogue': {
      // THE performed line: the dealer's mouth is driven by the stem
      // itself (speak.js); the buyer listens — mouth firmly shut
      const s = SPEAK.at(f);
      const spoken = SPK.applySpeak({ ...DP }, s);
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: spoken, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        propL: ['point', q(gestDealer(f).k, 2)],
        ...head(f, 31, -3 + q(s.nod * 40, 2), -0.3, 0, -0.35) }, d.x, d.z, { yaw: -0.4 });
      std('buyer7', OUTFITS.buyer7, { expr: 'neutral', exprP: P7, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, kf([[1339, -1], [1400, -2.5], [1459, -3]], f), 0.5, 0.1, 0.5) }, b7.x, b7.z, { yaw: 0.5 });
      break;
    }
    case 'treat': {
      const P = dealerTreatPose(f);
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.3],
        ...head(f, 31, -4, 0.5, 0.6, 0.45) }, d.x, d.z, { yaw: 0.5 });
      break;
    }
    case 'hookq': case 'hook': {
      // R2 final: the dealer KNEELS in the foreground, grinning up and
      // pointing at the hook board behind him — the character beat and
      // the board share the frame to the literal last frame
      const P = dealerHookPose(f);
      std('dealer', OUTFITS.dealer, { expr: 'smile', exprP: DP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.78],
        ...head(f, 31, -2, 0.55, -0.3, 0.5) }, d.x, d.z, { yaw: 0.5 });
      break;
    }
    default: break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-14, -0.4, 8.8, 9.25, { h: 1.6, id: 'fenceL' }),
  SOL.aabb(2.6, 16, 8.8, 9.25, { h: 1.6, id: 'fenceR' }),
  SOL.aabb(-17, -9.5, 6.3, 6.8, { h: 3.4, id: 'stableBack' }),
  SOL.aabb(-17, -16.55, 0.4, 6.5, { h: 3.2, id: 'stableSideL' }),
  SOL.aabb(-9.3, -8.85, 0.4, 6.5, { h: 3.2, id: 'stableSideR' }),
  SOL.aabb(-17, -12.6, 0.35, 0.8, { h: 3.2, id: 'stableFrontL' }),
  SOL.aabb(5.4, 11.6, 17.3, 17.8, { h: 3.6, id: 'shedBack' }),
  SOL.aabb(5.4, 5.85, 13.4, 17.8, { h: 3.4, id: 'shedSideL' }),
  SOL.aabb(11.15, 11.6, 13.4, 17.8, { h: 3.4, id: 'shedSideR' }),
  SOL.circle(-6.5, 14, 0.45, { h: 5, id: 'tree' }),
  SOL.circle(-8, 5.8, 1.0, { h: 2.6, id: 'stallA' }),
  SOL.circle(10.5, 4.5, 1.0, { h: 2.6, id: 'stallB' }),
  SOL.circle(-0.7, 8.55, 0.14, { h: 3.4, id: 'boardPostL' }),
  SOL.circle(2.9, 8.55, 0.14, { h: 3.4, id: 'boardPostR' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: a.grp || '' }));
  const h = horseAt(f);
  if (h.k > 0) out.push(SOL.circle(h.x, h.z, 1.15, { kind: 'dynamic', id: 'horse', group: 'mount' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  const h = horseAt(f);
  if (h.k > 0) items.push({ id: 'horse', y: 0, ground: 0, maxHover: 0.06 });
  return items;
};
