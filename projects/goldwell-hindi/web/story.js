// Shot plan for "दोगुना लौटाने वाला कुआँ" — goldwell-hindi.
// *** v4 UPGRADE (2026-11-19) — PICTURE-ONLY rebuild on the existing
// stem. Voice stem, beat map, clause timings, story content, scene
// order, boards and mix are UNCHANGED from the Batch-8 build. What
// changed: (1) the camera is now Abid's "v4" ACTION camera (Zack D
// Films grammar, proven in waterrun-hindi / fireless-hindi): camera
// velocity keyed to the subject, fast eased push-ins at action starts
// (subject scale x2-3 inside ~12-18 frames), tracking at subject
// speed, declared impact KICKS, clause-boundary cuts only, NO slow
// drift, NO static holds, camera NEVER behind the card characters
// (front / front three-quarter only). (2) ANIMATION UPGRADE v1+v2
// (kit body.js = Library v6): continuous life (lifeAt breath / weight
// shift / sway on EVERY figure), emotion morphs at beats (emoTrack),
// dialogue gesture (gestureAt), real leg stride from distance
// travelled (stridePh — no glide), PHYSICAL GRIPS (gripAt: the hand
// closes on the mango / coin / gold brick and releases with it),
// cheek/brow shading tied to the expression morphs (toon v6 cheek).
// (3) R2 FRAMING: the opening is no longer a distant drone wide —
// the boy is BIG from frame 0 (head ~50%), mid-action at the well,
// and the camera pulls back to reveal the well + title board. The
// FINAL frame is a character beat + hook board TOGETHER (potter in
// the foreground, head ~21%, board ~85% of frame width, whole panel
// inside the frame with margins, full opacity to the last frame) —
// the old build ended on a board-only shot wider than the frame.
// (4) Word-by-word captions (V3 signature) added in main.js from
// web/words.js (script text verbatim, timings char-mapped from the
// existing ASR — see align_captions.py).
// END RULE: the ONE performed dialogue line (L13, the potter) sits
// at 1204-1318 of 1529 (~79-86% — mid-story, before the final
// narration line + hook); the final quarter's narration (L14) and
// the hook line (L15) are voice-over only — no character is shown
// speaking at the end; the film ends on narration + hook board.
// Voice stem: 50.971 s, 30 fps, TOTAL 1529. Timings: faster-whisper
// small word alignment (words.json, timings only — Hindi spellings
// garbled). ASR dropped L10/L11 entirely (30.56-37.30 s); their
// boundary (33.50 / 33.80) comes from the stem's RMS clause dips.
// Scene changes ONLY at clause boundaries:
//   L1 0.00-3.34   उस गाँव के कुएँ में...लौट आता था।      L9  27.50-30.56 फिर लालची सेठ आया...डाल दी।
//   L2 3.64-5.96   एक लड़के ने एक आम डाला, / सुबह...मिले।   L10 30.80-33.50 उसे पक्का यक़ीन था...मिलेंगी।
//   L3 6.22-8.88   एक किसान ने सिक्का डाला, / सुबह...थे।    L11 33.80-37.20 सुबह कुएँ से दो ईंटें...थीं।
//   L4 8.88-12.42  ख़बर फैलते ही...कहने लगे।               L12 37.30-39.78 (tag) भीड़ के सामने...बोला।
//   L5 12.76-16.34 असली राज़...बूढ़ा कुम्हार।               L13 40.14-43.92 "कुआँ वही लौटाता है...था।"
//   L6 16.78-20.04 कुएँ की दीवार में...जाती थी।             L14 44.28-48.06 उस दिन के बाद...हो गई।
//   L7 20.04-24.26 रात को कुम्हार...रख देता।               L15 48.46-50.90 लेकिन कल...दे दिया?
//   L8 24.64-27.12 सूखे के उस साल...चाहता था।
// GRADE (FILTER_VFX_LIGHTING pack): Royal Gold throughout; the night
// beats (L7, and L10 as Seth waits into the dark) blend to Night Lamp
// and back — grade changes ONLY on clause boundaries. Signature VFX:
// heat shimmer over the cracked square, dry dust, the gold brick's
// moving sheen + glints, the lantern glow on night beats.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);

export const FPS = 30, TOTAL = 1529, DECK = 0;
export const SHOTS = [
  { id: 'open', a: 0, b: 108, light: 'gold' },
  { id: 'boy', a: 109, b: 148, light: 'gold' },
  { id: 'boymorn', a: 149, b: 186, light: 'gold' },
  { id: 'farmer', a: 187, b: 223, light: 'gold' },
  { id: 'farmermorn', a: 224, b: 265, light: 'gold' },
  { id: 'crowd', a: 266, b: 382, light: 'gold' },
  { id: 'secret', a: 383, b: 502, light: 'gold' },
  { id: 'tunnel', a: 503, b: 600, light: 'gold' },
  { id: 'night', a: 601, b: 738, light: 'night' },
  { id: 'why', a: 739, b: 824, light: 'gold' },
  { id: 'seth', a: 825, b: 923, light: 'gold' },
  { id: 'wait', a: 924, b: 1013, light: 'night' },
  { id: 'payoff', a: 1014, b: 1118, light: 'gold' },
  { id: 'emerge', a: 1119, b: 1203, light: 'gold' },
  { id: 'dialogue', a: 1204, b: 1327, light: 'gold' },
  { id: 'after', a: 1328, b: 1453, light: 'gold' },
  { id: 'hookq', a: 1454, b: 1499, light: 'dusk' },
  { id: 'hook', a: 1500, b: 1528, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  gold: { az: 228, el: 30, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.04, sun: '#ffd9a0', sunI: 2.5, fog: '#ecd7ab', fogNear: 46, fogFar: 330,
    skyTop: '#2e4a7a', skyHor: '#f7cf8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.12, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedbe',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  night: { az: 300, el: 38, sky: '#39406b', ground: '#191722', hemi: 0.52, sun: '#93a7d4', sunI: 0.7, fog: '#252a3e', fogNear: 30, fogFar: 240,
    skyTop: '#10182e', skyHor: '#2c3550', sunDisc: '#dfe8ff', sunSize: 0.003, sat: 0.88, vig: 0.34, shadowExt: 22, aurora: 0, gain: '#c9d4e8',
    waterDeep: '#0e222c', waterShal: '#1a3038', glint: '#cfd8dc' },
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
  if (S.id === 'night') return blendLight(LIGHTS.gold, LIGHTS.night, smooth(ramp(f, 601, 645)));
  if (S.id === 'why') return blendLight(LIGHTS.night, LIGHTS.gold, smooth(ramp(f, 739, 783)));
  if (S.id === 'wait') return blendLight(LIGHTS.gold, LIGHTS.night, smooth(ramp(f, 924, 1013)));
  if (S.id === 'payoff') return blendLight(LIGHTS.night, LIGHTS.gold, smooth(ramp(f, 1014, 1064)));
  if (S.id === 'hookq') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, 1454, 1500)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.3, -8.2];
export const WELL = { x: 0, z: 2, r: 1.55, top: 1.02 };
export const KILN = { x: 5.6, z: -6.5 };
const MOUTH = [0, 0.55, 0.34];

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// stride phase from distance travelled along the key path (feet plant
// with the ground — no glide; body.js stridePh, shared form).
const phaseAlong = (keys, f, stride = 1.15) => {
  let dist = 0;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    const segLen = Math.hypot(b[1] - a[1], b[2] - a[2]);
    if (f <= b[0]) { const u = smooth(ramp(f, a[0], b[0])); return stridePh(0, dist + segLen * u, stride); }
    dist += segLen;
  }
  return stridePh(0, dist, stride);
};
const POTTER_KEYS = [
  [0, 4.2, -4.2], [502, 4.2, -4.2], [548, 1.3, 0.1], [700, 1.3, 0.1], [730, 1.05, 0.05],
  [738, 1.05, 0.05], [739, 1.35, 0.15], [824, 1.35, 0.15], [825, 4.2, -4.2], [1118, 4.2, -4.2],
  [1119, 1.05, 0.05], [1145, 2.3, 0.9], [1175, 3.1, 2.9], [1200, 1.7, 3.6], [1528, 1.7, 3.6],
];
const SETH_KEYS = [
  [0, 9.5, -3.0], [824, 9.5, -3.0], [825, 8.5, 7.5], [878, 2.9, 4.5], [1528, 2.9, 4.5],
];
export const potterAt = (f) => { const [x, z] = walkKeys(POTTER_KEYS, f); return { x, z }; };
export const sethAt = (f) => { const [x, z] = walkKeys(SETH_KEYS, f); return { x, z }; };
export const boyAt = (f) => f >= 1328 ? { x: -0.9, z: 4.6 } : { x: -1.3, z: 4.35 };
export const farmerAt = (f) => f >= 1328 ? { x: 0.7, z: 4.75 } : { x: 1.5, z: 4.4 };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const potterMode = (f) => strolling(f, [[503, 548], [700, 730], [1119, 1200]]) ? 'stroll' : 'stand';
export const sethMode = (f) => strolling(f, [[825, 878]]) ? 'stroll' : 'stand';
export const potterPh = (f) => phaseAlong(POTTER_KEYS, f);
export const sethPh = (f) => phaseAlong(SETH_KEYS, f);
// the potter's final-beat position: foreground by the hook board
// (waterrun/fireless pattern — the cast re-stages at the clause cut).
export const HOOK_POTTER = { x: 1.05, z: -2.2 };
export const HOOK_SETH = { x: -0.95, z: -4.6 };

// ---------- the basket, the brick, the drops ----------
export const basketAt = (f) => {
  let x = WELL.x, z = WELL.z, y = 0.72, k = 1, ropeK = 1, m = 0, c = 0, p = 0;
  if (f >= 109 && f <= 148) { m = f >= 140 ? 1 : 0; }
  else if (f >= 149 && f <= 186) { y = f < 156 ? -3.3 : lerp(-3.3, 0.72, smooth(ramp(f, 156, 176))); m = 2; }
  else if (f >= 187 && f <= 223) { c = f >= 216 ? 1 : 0; }
  else if (f >= 224 && f <= 265) { y = f < 231 ? -3.3 : lerp(-3.3, 0.72, smooth(ramp(f, 231, 253))); c = 2; }
  else if (f >= 601 && f <= 738) {
    // night: the basket rests on the ground at the tunnel mouth; the
    // potter adds one more mango, then carries it back inside.
    ropeK = 0; z = -0.35; y = 0; m = f >= 690 ? 2 : 1;
    if (f >= 700 && f <= 730) z = lerp(-0.35, 0.3, smooth(ramp(f, 700, 730)));
    if (f >= 731) k = 0;
  }
  else if (f >= 825 && f <= 923) { if (f >= 900) y = lerp(0.72, -3.3, smooth(ramp(f, 900, 920))); }
  else if (f >= 924 && f <= 1013) { y = -3.3; }
  else if (f >= 1014 && f <= 1118) { y = f < 1025 ? -3.3 : lerp(-3.3, 0.72, smooth(ramp(f, 1025, 1065))); p = 1; }
  else if (f >= 1119 && f <= 1327) { p = 1; }
  return { x, y, z, k, ropeK, contMango: m, contCoins: c, contPainted: p };
};
export const brickAt = (f) => {
  if (f < 825 || f > 923) return { k: 0, x: 0, y: -10, z: 0, yaw: 0, glint: 0 };
  const s = sethAt(f), B = basketAt(f);
  let x, y, z;
  if (f < 888) { x = s.x - 0.38; y = 1.02; z = s.z - 0.25; }
  else if (f <= 898) { const u = ramp(f, 888, 898); x = lerp(s.x - 0.38, 0, u); z = lerp(s.z - 0.25, WELL.z, u); y = lerp(1.02, B.y + 0.45, u * u * (3 - 2 * u)) + Math.sin(u * Math.PI) * 0.5; }
  else { x = 0; z = WELL.z; y = B.y + 0.45; }
  const glint = f < 898 ? 0.55 + 0.45 * Math.sin(ramp(f, 825, 898) * Math.PI * 3) : 0.3;
  return { k: 1, x, y, z, yaw: 0.2, glint: Math.max(0, glint) };
};
export const dropAt = (f) => {
  if (f >= 131 && f <= 140) { const u = ramp(f, 131, 140); return { k: 1, kind: 1, x: lerp(-1.05, 0, u), y: lerp(1.15, 1.18, u) + Math.sin(u * Math.PI) * 0.5, z: lerp(4.15, WELL.z, u) }; }
  if (f >= 207 && f <= 216) { const u = ramp(f, 207, 216); return { k: 1, kind: 2, x: lerp(1.25, 0, u), y: lerp(1.2, 1.18, u) + Math.sin(u * Math.PI) * 0.45, z: lerp(4.15, WELL.z, u) }; }
  return { k: 0, kind: 0, x: 0, y: -10, z: 0 };
};
export const slabAt = (f) => {
  if (f < 540) return 0;
  if (f <= 600) return smooth(ramp(f, 540, 558));
  if (f <= 738) return 1;
  if (f <= 1124) return 0;
  if (f <= 1327) return smooth(ramp(f, 1125, 1145));
  return 1 - smooth(ramp(f, 1330, 1350));
};
export const lanternAt = (f) => {
  if (f >= 601 && f <= 738) return smooth(ramp(f, 601, 620));
  if (f >= 924 && f <= 1013) return 0.85 * smooth(ramp(f, 950, 990));
  if (f >= 1014 && f <= 1040) return 0.85 * (1 - smooth(ramp(f, 1014, 1040)));
  return 0;
};

// ---------- hero / focus ----------
const FOCUS = {
  open: () => { const b = boyAt(60); return [b.x, 1.3, b.z]; },
  boy: () => { const b = boyAt(130); return [b.x, 0.95, b.z]; },
  boymorn: () => [0, 1.0, 2],
  farmer: () => { const a = farmerAt(205); return [a.x, 1.3, a.z]; },
  farmermorn: () => [0, 1.0, 2],
  crowd: () => [0, 1.1, 3.2],
  secret: () => { const p = potterAt(460); return [p.x, 1.1, p.z]; },
  tunnel: () => MOUTH,
  night: () => [0.2, 0.6, 0],
  why: () => { const p = potterAt(780); return [p.x, 1.1, p.z]; },
  seth: () => { const s = sethAt(880); return [s.x, 1.3, s.z]; },
  wait: () => { const s = sethAt(960); return [s.x, 1.3, s.z]; },
  payoff: (f) => f < 1055 ? [0, 1.15, 2] : (() => { const s = sethAt(f); return [s.x, 1.45, s.z]; })(),
  emerge: () => { const p = potterAt(1160); return [p.x, 1.2, p.z]; },
  dialogue: () => { const p = potterAt(1260); return [p.x, 1.45, p.z]; },
  after: () => [0, 1.1, 2.6],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: v4 ACTION LEVEL — every shot travels WITH its subject ----------
// Head-width maths (card head ~0.61 m): % = 0.61 / (2*d*tan(fov/2)*0.5625).
// Push-ins are eased key moves concentrated in the first ~15 frames of
// the action; tracking raws follow the movement tracks analytically.
// ALL cameras stay SOUTH / FRONT of the card characters (front three-
// quarter); never behind them.
const potterPos = (f) => { const p = potterAt(f); return [p.x, 0, p.z]; };
const sethPos = (f) => { const s = sethAt(f); return [s.x, 0, s.z]; };
const RIG_BY_ID = {
  // open: NO drone wide. The boy is BIG from frame 0 (head ~50%),
  // low front three-quarter at the well, mid-action; a snap push-in
  // over f0-15, then the camera pulls back and rises to reveal the
  // well and the title board behind it by the end of the line.
  open: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [-2.45, 1.44, 7.0], look: [-1.3, 1.3, 4.35], fov: 38 },
    { f: 15, pos: [-2.2, 1.37, 6.6], look: [-1.28, 1.32, 4.35], fov: 36, ease: 'surge' },
    { f: 45, pos: [-3.6, 2.05, 9.8], look: [-0.7, 1.6, 1.6], fov: 39, ease: 'smooth' },
    { f: 72, pos: [-4.4, 2.5, 11.2], look: [-0.3, 1.9, -0.6], fov: 40, ease: 'surge' },
    { f: 108, pos: [-4.2, 2.45, 10.85], look: [-0.3, 1.9, -0.6], fov: 40, ease: 'surge' }] }) },
  // boy: tight on the boy's hands + the basket — the mango drop
  // (f131-140) plays centre frame; push 3.1 -> 2.2 m in 14 frames.
  boy: { cut: 'hard', raw: keysCam({ keys: [
    { f: 109, pos: [-2.95, 1.6, 7.5], look: [-0.85, 1.0, 3.4], fov: 37 },
    { f: 123, pos: [-2.45, 1.42, 6.6], look: [-0.7, 1.02, 3.1], fov: 35, ease: 'surge' },
    { f: 148, pos: [-2.3, 1.38, 6.35], look: [-0.65, 1.02, 3.0], fov: 34, ease: 'surge' }] }) },
  // boymorn: the basket RISES with two mangoes — the camera rides up
  // with it, the boy's laughing face at the frame edge.
  boymorn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 149, pos: [-3.1, 1.75, 7.3], look: [-0.3, 0.9, 2.6], fov: 37 },
    { f: 176, pos: [-2.7, 1.6, 6.5], look: [-0.35, 1.0, 2.5], fov: 35, ease: 'surge' },
    { f: 186, pos: [-2.6, 1.58, 6.35], look: [-0.35, 1.02, 2.5], fov: 34, ease: 'surge' }] }) },
  // farmer: the coin drop, mirrored from the east — same energy.
  farmer: { cut: 'hard', raw: keysCam({ keys: [
    { f: 187, pos: [3.75, 1.6, 7.7], look: [0.85, 1.05, 3.4], fov: 37 },
    { f: 201, pos: [3.2, 1.42, 6.8], look: [0.7, 1.05, 3.1], fov: 35, ease: 'surge' },
    { f: 223, pos: [3.05, 1.38, 6.55], look: [0.65, 1.05, 3.0], fov: 34, ease: 'surge' }] }) },
  // farmermorn: the basket rises with two coins; punch toward the
  // farmer's satisfied face in the last frames.
  farmermorn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 224, pos: [3.9, 1.9, 7.9], look: [0.2, 0.95, 2.4], fov: 38 },
    { f: 253, pos: [3.3, 1.7, 6.9], look: [0.3, 1.0, 2.4], fov: 36, ease: 'surge' },
    { f: 265, pos: [3.15, 1.65, 6.7], look: [0.35, 1.05, 2.5], fov: 35, ease: 'surge' }] }) },
  // crowd: the news spreads — a lateral track that slides along the
  // arc of villagers at walking pace (7+ m of travel), faces punched
  // in, ending on the boy's shock.
  crowd: { cut: 'hard', raw: keysCam({ keys: [
    { f: 266, pos: [-4.6, 1.75, 9.9], look: [-1.6, 1.35, 4.6], fov: 40 },
    { f: 324, pos: [-0.6, 1.66, 9.7], look: [0.1, 1.35, 4.5], fov: 38, ease: 'smooth' },
    { f: 382, pos: [2.9, 1.6, 9.5], look: [0.7, 1.35, 4.4], fov: 37, ease: 'surge' }] }) },
  // secret: the ONE man who knows — a fast punch-in on the potter at
  // his kiln corner (head ~33% -> ~62% inside 15 frames), then a
  // slow track as he watches the square.
  secret: { cut: 'hard', raw: keysCam({ keys: [
    { f: 383, pos: [3.3, 1.7, -0.35], look: [4.2, 1.35, -4.2], fov: 38 },
    { f: 398, pos: [3.75, 1.55, -2.15], look: [4.2, 1.4, -4.2], fov: 35, ease: 'surge' },
    { f: 502, pos: [3.95, 1.5, -2.45], look: [4.18, 1.4, -4.2], fov: 34, ease: 'surge' }] }) },
  // tunnel: front three-quarter TRACKING — the camera walks with the
  // potter from his corner to the well's hidden mouth, staying ahead
  // -south of him, and settles on the slab as it slides aside.
  tunnel: { cut: 'hard', raw: (f) => {
    const p = potterAt(f), u = smooth(ramp(f, 503, 600));
    const off = [lerp(-2.5, -1.7, u), lerp(1.55, 1.35, u), lerp(3.3, 2.6, u)];
    return { pos: [p.x + off[0], off[1], p.z + off[2]], look: [lerp(p.x, 0.4, u * 0.35), lerp(1.25, 0.75, u), lerp(p.z, 0.3, u * 0.35)], fov: lerp(38, 36, u), roll: 0 };
  } },
  // night: low at the tunnel mouth — the potter adds the mango by
  // lantern light (grip beat f663-700 centre frame); push-in as he
  // works, then he carries the basket back inside.
  night: { cut: 'hard', raw: keysCam({ keys: [
    { f: 601, pos: [4.15, 1.45, 3.75], look: [1.2, 0.9, 0.1], fov: 39 },
    { f: 663, pos: [3.35, 1.28, 2.95], look: [1.22, 0.85, 0.08], fov: 37, ease: 'surge' },
    { f: 738, pos: [3.1, 1.22, 2.7], look: [1.1, 0.82, 0.06], fov: 36, ease: 'surge' }] }) },
  // why: his reason — a tender close on the potter (face ~40% ->
  // ~58%), the village asleep behind him.
  why: { cut: 'hard', raw: keysCam({ keys: [
    { f: 739, pos: [3.6, 1.7, 3.6], look: [1.35, 1.35, 0.15], fov: 38 },
    { f: 754, pos: [3.0, 1.58, 2.85], look: [1.35, 1.4, 0.15], fov: 35, ease: 'surge' },
    { f: 824, pos: [2.85, 1.55, 2.7], look: [1.35, 1.4, 0.15], fov: 34, ease: 'surge' }] }) },
  // seth: FRONT three-quarter tracking — the camera races backward
  // ahead of the striding Seth, the gold brick glinting in his hand;
  // the push tightens as he reaches the well, and the look swings to
  // the basket for the drop (f888-898, KICK on the splash-down).
  seth: { cut: 'hard', raw: (f) => {
    const s = sethAt(f), b = brickAt(f), u = smooth(ramp(f, 825, 890));
    // camera rides FRONT-RIGHT (south-east) of Seth so the farmer at
    // the well stays out of the narrow portrait frame; the look holds
    // Seth's head until the release (f888), whips to the flying brick,
    // follows it down, then settles on the basket.
    const off = f < 886
      ? [lerp(2.6, 1.85, u), lerp(1.62, 1.48, u), lerp(3.3, 2.5, u)]
      : (() => { const w = smooth(ramp(f, 886, 900)); return [lerp(1.85, 2.45, w), lerp(1.48, 1.58, w), lerp(2.5, 3.1, w)]; })();
    const head = [s.x, 1.3, s.z];
    const lk = f < 888 ? head : (() => {
      const v = smooth(ramp(f, 888, 895));
      const brick = [b.x, Math.max(b.y, 0.85), b.z];
      const mid = [lerp(head[0], brick[0], v), lerp(head[1], brick[1], v), lerp(head[2], brick[2], v)];
      const w2 = smooth(ramp(f, 915, 923));
      return [lerp(mid[0], 0, w2), lerp(mid[1], 1.35, w2), lerp(mid[2], 2, w2)];
    })();
    return { pos: [s.x + off[0], off[1], s.z + off[2]], look: lk, fov: lerp(38, 34, u), roll: 0 };
  } },
  // wait: night — Seth waits by the well, sure of his gold; a slow
  // push-in as his eyelids droop (no static hold: the push travels
  // the whole shot).
  wait: { cut: 'hard', raw: keysCam({ keys: [
    { f: 924, pos: [5.3, 1.85, 9.6], look: [2.9, 1.3, 4.5], fov: 38 },
    { f: 1013, pos: [4.55, 1.65, 8.4], look: [2.9, 1.32, 4.5], fov: 35, ease: 'surge' }] }) },
  // payoff: the basket rises — camera rides with it — then a FAST
  // reframe onto Seth's face as the painted bricks appear: shock at
  // ~75% (KICK at f1058), the crowd laughing at the edges.
  payoff: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1014, pos: [-2.0, 1.95, 8.6], look: [0, 1.05, 2.1], fov: 37 },
    { f: 1050, pos: [-1.9, 1.9, 8.5], look: [0.05, 1.1, 2.1], fov: 35, ease: 'smooth' },
    { f: 1062, pos: [-1.8, 1.85, 8.35], look: [0.05, 1.15, 2.1], fov: 34, ease: 'smooth' },
    { f: 1070, pos: [1.9, 1.58, 7.0], look: [2.9, 1.45, 4.5], fov: 33, ease: 'surge' },
    { f: 1118, pos: [1.8, 1.58, 6.85], look: [2.9, 1.45, 4.5], fov: 33, ease: 'surge' }] }) },
  // emerge: the potter comes OUT of the tunnel in front of everyone
  // — front three-quarter tracking as he walks to face Seth.
  emerge: { cut: 'hard', raw: (f) => {
    const p = potterAt(f), u = smooth(ramp(f, 1119, 1203));
    const off = [lerp(2.2, 1.9, u), lerp(1.5, 1.55, u), lerp(3.1, 3.3, u)];
    return { pos: [p.x + off[0], off[1], p.z + off[2]], look: [p.x, 1.25, p.z], fov: lerp(38, 35, u), roll: 0 };
  } },
  // dialogue: THE LINE, performed — push-in on the potter as he
  // speaks (face ~48% -> ~72%); Seth listens at the frame edge,
  // mouth shut. Camera holds on the speaker.
  dialogue: { cut: 'hard', raw: pushInCam({ subject: potterPos, a: 1204, b: 1327, d0: 3.35, d1: 2.2, h0: 1.6, h1: 1.52, lookOff: [0, 1.45, 0], fov0: 34, fov1: 30,
    dir: () => [0.5, 0.86] }) },
  // after: the village after — a warm group shot with a gentle
  // push; the helping hands already at work.
  after: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1328, pos: [6.1, 2.3, 12.3], look: [0.5, 1.2, 3.2], fov: 42 },
    { f: 1453, pos: [5.2, 2.05, 10.9], look: [0.55, 1.22, 3.3], fov: 39, ease: 'surge' }] }) },
  // hookq: the hook line (narration) — the camera pushes from the
  // group toward the board as the potter steps into the foreground
  // beside it; the board fades up behind him.
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1454, pos: [5.2, 2.05, 10.9], look: [0.55, 1.22, 3.3], fov: 39 },
    { f: 1499, pos: [0.7, 2.05, 3.1], look: [0, 3.22, -8.15], fov: 46, ease: 'surge' }] }) },
  // hook: the final frame — character beat + hook board TOGETHER:
  // board ~85% of frame width, whole panel inside with margins,
  // the potter's head ~21% in the foreground, board at FULL opacity
  // through the literal last frame. A last small push, never frozen.
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1500, pos: [0.7, 2.05, 3.1], look: [0, 3.22, -8.15], fov: 46 },
    { f: 1528, pos: [0.62, 2.08, 2.85], look: [0, 3.25, -8.17], fov: 45, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 140, a: 0.12 }, { f: 898, a: 0.22 }, { f: 1058, a: 0.3 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { open: 1.6, boy: 3.0, boymorn: 2.6, farmer: 3.0, farmermorn: 2.6, crowd: 2.0, secret: 3.2, tunnel: 2.6, night: 3.2, why: 3.2, seth: 2.8, wait: 2.6, payoff: 3.0, emerge: 2.6, dialogue: 3.6, after: 1.8, hookq: 1.6, hook: 2.6 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), B = basketAt(f), br = brickAt(f), dr = dropAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    basketX: B.x, basketY: B.y, basketZ: B.z, basketK: B.k, ropeK: B.ropeK,
    contMango: B.contMango, contCoins: B.contCoins, contPainted: B.contPainted,
    brickX: br.x, brickY: br.y, brickZ: br.z, brickK: br.k, brickYaw: br.yaw, glintK: br.glint,
    dropX: dr.x, dropY: dr.y, dropZ: dr.z, dropK: dr.k, dropKind: dr.kind,
    slabK: slabAt(f), lanternK: lanternAt(f),
    dustK: 0.05,
  };
  if (S.id === 'open') W.boardTitle = smooth(ramp(f, 66, 80)) * (1 - smooth(ramp(f, 94, 108)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1484, 1498));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const shimmer = S.light === 'night' ? 0.08 : (S.id === 'wait' ? 0.2 : 0.55);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: shimmer, grey: S.light === 'night' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
// V3 rule (as in waterrun/fireless): NO card tint in any light —
// faces stay pure white, costume colours flat and saturated.
const tintFor = () => '#ffffff';
export const OUTFITS = {
  potter: { jacket: '#cbb59a', pants: '#8a6f52', boots: '#4a3826', hat: 'hair', hair: '#d8d0bc', skin: '#fbf7ef', moustache: '#d8d0bc' },
  seth: { jacket: '#7a1f3a', pants: '#3a2a4a', boots: '#241a12', hat: 'cap', cap: '#d9a441', skin: '#fbf7ef', moustache: '#241a12', build: 'stout' },
  boy: { jacket: '#3a7a8c', pants: '#5a4632', boots: '#2c2015', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  farmer: { jacket: '#5d7a2e', pants: '#4a3b28', boots: '#2c2015', hat: 'cap', cap: '#a8894f', skin: '#fbf7ef', moustache: '#2a201a' },
  v1: { jacket: '#8c4a5a', pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
  v2: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#7a8a99', skin: '#fbf7ef', moustache: '#241a12' },
  v3: { jacket: '#a8873a', pants: '#3a332a', boots: '#241a12', hat: 'hair', hair: '#101010', skin: '#fbf7ef' },
};

// ---------- HEAD + BODY PERFORMANCE (animation upgrade v1+v2) ----------
// Emotion morphs at story beats (body.js emoTrack; cheek/brow shading
// rides inside the face params — toon v6 cheek contour).
const emoPotter = emoTrack(T.faceP, 'neutral', [
  [383, 'thinking', 8], [503, 'determined', 8], [739, 'smile', 9], [825, 'neutral', 8],
  [1119, 'stern', 8], [1204, 'proud', 8], [1328, 'smile', 8], [1454, 'grin', 8],
]);
const emoSeth = emoTrack(T.faceP, 'smug', [
  [825, 'grin', 8], [924, 'sleepy', 10], [1014, 'smug', 8], [1055, 'shock', 6],
  [1119, 'scared', 8], [1204, 'nervous', 8], [1328, 'sad', 9], [1454, 'smile', 8],
]);
const emoBoy = emoTrack(T.faceP, 'smile', [
  [149, 'laugh', 7], [266, 'shock', 7], [383, 'smile', 8], [1014, 'laugh', 7], [1328, 'smile', 8],
]);
const emoFarmer = emoTrack(T.faceP, 'neutral', [
  [224, 'smile_closed', 8], [266, 'smile', 7], [1014, 'shock', 6], [1328, 'smile', 8],
]);
const emoV1 = emoTrack(T.faceP, 'neutral', [[266, 'shock', 7], [1014, 'shock', 6], [1119, 'smile', 8], [1328, 'smile', 8]]);
const emoV2 = emoTrack(T.faceP, 'neutral', [[266, 'smile', 7], [1014, 'shock', 6], [1119, 'smile', 8], [1328, 'smile', 8]]);
const emoV3 = emoTrack(T.faceP, 'neutral', [[266, 'shock', 7], [1014, 'shock', 6], [1119, 'smile', 8], [1328, 'smile', 8]]);
// Continuous life per character (body.js lifeAt): breathing phase,
// weight-shift tilt, micro sway — nobody stands like a post.
const lifePotter = lifeAt({ seed: 31 }), lifeSeth = lifeAt({ seed: 51 }), lifeBoy = lifeAt({ seed: 21 }),
  lifeFarmer = lifeAt({ seed: 41 }), lifeV1 = lifeAt({ seed: 71 }), lifeV2 = lifeAt({ seed: 72 }), lifeV3 = lifeAt({ seed: 73 });
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
// head/body opts fragment: life (breath/tilt/sway) + directed gaze.
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
const noBlush = (P) => { const o = { ...P }; o.blush = 0; o.openL = Math.min(1, (o.openL ?? 0.85) * 1.45); o.openR = Math.min(1, (o.openR ?? 0.85) * 1.45); return o; };
// PHYSICAL GRIPS (body.js gripAt): the hand closes on the object and
// releases WITH it — the same k drives the arm and matches the 3D
// prop's own track (dropAt / brickAt in the world state above).
const gripBoy = gripAt([{ f0: 120, dur: 10, type: 'lift' }, { f0: 130, dur: 10, type: 'place', settle: 6 }]);
const gripFarmer = gripAt([{ f0: 196, dur: 10, type: 'lift' }, { f0: 206, dur: 10, type: 'place', settle: 6 }]);
const gripPotterNight = gripAt([{ f0: 662, dur: 9, type: 'lift' }, { f0: 686, dur: 10, type: 'place', settle: 6 }]);
const gripSeth = gripAt([{ f0: 879, dur: 9, type: 'place', settle: 5 }]);   // release as the brick arcs (f888-898)
// dialogue gesture: the potter's free hand talks with the voice
// during the performed line (stresses on the content words).
const gestPotter = gestureAt([{ a: 1204, b: 1318, beats: [1218, 1252, 1286, 1308], base: 0.42, amp: 0.16 }]);

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const pt = potterAt(f), st = sethAt(f), by = boyAt(f), fa = farmerAt(f);
  const PP = noBlush(emoPotter.at(f)), SP2 = noBlush(emoSeth.at(f)), BP = noBlush(emoBoy.at(f)),
    FP = noBlush(emoFarmer.at(f)), P1 = noBlush(emoV1.at(f)), P2 = noBlush(emoV2.at(f)), P3 = noBlush(emoV3.at(f));
  const potterStd = (opts, extra = {}) => std('potter', OUTFITS.potter, { expr: 'neutral', exprP: PP, blink: blinkAt(f, 31), seed: 31, ...opts }, pt.x, pt.z, extra);
  const bgCast = () => {
    std('v1', OUTFITS.v1, { expr: 'neutral', exprP: P1, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...H2(lifeV1, f, 71, { ht: -2, look: 0.2, lookY: -0.1, facing: 0.2 }) }, -5.2, -6.2, { yaw: 0.3 });
    std('v2', OUTFITS.v2, { expr: 'neutral', exprP: P2, mode: 'stand', blink: blinkAt(f, 72), seed: 72, ...H2(lifeV2, f, 72, { ht: -2, look: 0.3, lookY: -0.1, facing: 0.3 }) }, -9.8, -6.5, { yaw: 0.5 });
    std('v3', OUTFITS.v3, { expr: 'neutral', exprP: P3, mode: 'stand', blink: blinkAt(f, 73), seed: 73, ...H2(lifeV3, f, 73, { ht: -2, look: 0.3, lookY: -0.1, facing: 0.3 }) }, -10.2, -1.8, { yaw: 0.6 });
  };
  const arcCast = () => {
    std('v1', OUTFITS.v1, { expr: 'smile', exprP: P1, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...H2(lifeV1, f, 71, { ht: -2, look: 0.2, lookY: -0.1, facing: 0.2 }) }, -2.7, 5.0, { yaw: 0.25 });
    std('v2', OUTFITS.v2, { expr: 'smile', exprP: P2, mode: 'stand', blink: blinkAt(f, 72), seed: 72, ...H2(lifeV2, f, 72, { ht: -2, look: 0, lookY: -0.1, facing: 0 }) }, 0.1, 5.4, { yaw: 0 });
    std('v3', OUTFITS.v3, { expr: 'smile', exprP: P3, mode: 'stand', blink: blinkAt(f, 73), seed: 73, ...H2(lifeV3, f, 73, { ht: -2, look: -0.2, lookY: -0.1, facing: -0.2 }) }, -3.6, 4.6, { yaw: -0.25 });
  };
  switch (S.id) {
    case 'open': {
      std('potter', OUTFITS.potter, { expr: 'neutral', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...H2(lifePotter, f, 31, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, pt.x, pt.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, prop: ['point', 0.4], ...H2(lifeBoy, f, 21, { ht: -1.5, look: 0.3, lookY: 0.1, facing: 0.3 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.3 });
      std('seth', OUTFITS.seth, { expr: 'stern', exprP: SP2, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeSeth, f, 51, { ht: -2, look: -0.4, lookY: 0, facing: -0.4 }) }, st.x, st.z, { yaw: -0.5 });
      bgCast();
      break;
    }
    case 'boy': {
      // the drop, hands on: his hand closes on the mango and opens
      // as it arcs into the basket (grip k rides the same frames).
      const g = gripBoy(f);
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, prop: ['point', q(0.15 + 0.5 * g.k, 2)], squash: q(Math.max(g.squash * 0.6, 0), 2), ...H2(lifeBoy, f, 21, { ht: 1.5, look: 0.3, lookY: 0.35, facing: 0.3 }) }, by.x, by.z, { s: 0.8, yaw: 0.35 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -1.5, look: -0.35, lookY: 0.1, facing: -0.35 }) }, fa.x, fa.z, { yaw: -0.35 });
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, { yaw: -0.4 });
      break;
    }
    case 'boymorn': {
      std('boy', OUTFITS.boy, { expr: 'laugh', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: -3, look: 0.25, lookY: -0.1, facing: 0.25 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.3 });
      break;
    }
    case 'farmer': {
      // the coin, in his fingers until the arc takes it (f207-216):
      // the drawn coin rides his hand while the grip holds.
      const g = gripFarmer(f);
      std('farmer', OUTFITS.farmer, { expr: 'neutral', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: f < 207 ? ['coin', q(0.2 + 0.45 * g.k, 2)] : ['point', q(0.15 + 0.4 * g.k, 2)], ...H2(lifeFarmer, f, 41, { ht: 1.5, look: -0.3, lookY: 0.35, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.3 });
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: -1.5, look: 0.35, lookY: 0.1, facing: 0.35 }) }, by.x, by.z, { s: 0.8, yaw: 0.35 });
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, { yaw: -0.4 });
      break;
    }
    case 'farmermorn': {
      std('farmer', OUTFITS.farmer, { expr: 'smile_closed', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -2.5, look: -0.25, lookY: -0.05, facing: -0.25 }) }, fa.x, fa.z, { yaw: -0.3 });
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: -1.5, look: 0.3, lookY: 0, facing: 0.3 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      break;
    }
    case 'crowd': {
      std('boy', OUTFITS.boy, { expr: 'shock', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: -2.5, look: 0.2, lookY: -0.15, facing: 0.2 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -2, look: -0.2, lookY: -0.1, facing: -0.2 }) }, fa.x, fa.z, { yaw: -0.3 });
      arcCast();
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, { yaw: -0.4 });
      break;
    }
    case 'secret': {
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: 1, look: -0.45, lookY: 0.1, facing: -0.4 }) }, { yaw: -0.5 });
      std('v1', OUTFITS.v1, { expr: 'neutral', exprP: P1, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...H2(lifeV1, f, 71, { ht: -2, look: 0.2, lookY: -0.1, facing: 0.2 }) }, -5.2, -6.2, { yaw: 0.3 });
      std('v2', OUTFITS.v2, { expr: 'neutral', exprP: P2, mode: 'stand', blink: blinkAt(f, 72), seed: 72, ...H2(lifeV2, f, 72, { ht: -2, look: 0.3, lookY: -0.1, facing: 0.3 }) }, -9.8, -6.5, { yaw: 0.5 });
      break;
    }
    case 'tunnel': {
      potterStd({ mode: potterMode(f), phase: q(potterPh(f), 2), prop: f >= 536 && f <= 575 ? ['point', 0.7] : null, ...H2(lifePotter, f, 31, { ht: 1.5, look: 0.35, lookY: 0.2, facing: 0.3 }) }, { yaw: 0.4 });
      break;
    }
    case 'night': {
      // the secret kindness, hands on: he lifts the second mango and
      // sets it into the basket (grip f662-696), then carries the
      // basket back inside (stroll f700-730).
      const g = gripPotterNight(f);
      potterStd({ mode: potterMode(f), phase: q(potterPh(f), 2), prop: f >= 655 && f <= 705 ? ['point', q(0.15 + 0.45 * g.k, 2)] : null, ...H2(lifePotter, f, 31, { ht: f >= 655 && f <= 705 ? 3 : 0.5, look: 0.3, lookY: f >= 655 && f <= 705 ? 0.5 : 0.1, facing: 0.3 }) }, { yaw: 0.35 });
      break;
    }
    case 'why': {
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -1, look: -0.25, lookY: -0.05, facing: -0.25 }) }, { yaw: -0.3 });
      std('boy', OUTFITS.boy, { expr: 'neutral', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: -1.5, look: 0.3, lookY: 0, facing: 0.3 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('v1', OUTFITS.v1, { expr: 'neutral', exprP: P1, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...H2(lifeV1, f, 71, { ht: -2, look: 0.2, lookY: -0.1, facing: 0.2 }) }, -2.7, 5.0, { yaw: 0.25 });
      std('v3', OUTFITS.v3, { expr: 'neutral', exprP: P3, mode: 'stand', blink: blinkAt(f, 73), seed: 73, ...H2(lifeV3, f, 73, { ht: -2, look: -0.2, lookY: -0.1, facing: -0.2 }) }, -3.6, 4.6, { yaw: -0.25 });
      break;
    }
    case 'seth': {
      // the brick rides his hand until the release (grip place
      // f879-888; the 3D ingot arcs f888-898 on brickAt).
      const g = gripSeth(f);
      std('seth', OUTFITS.seth, { expr: 'grin', exprP: SP2, mode: sethMode(f), phase: q(sethPh(f), 2), blink: blinkAt(f, 51), seed: 51, prop: f >= 860 && f <= 905 ? ['point', q(0.62 - 0.35 * (1 - g.k), 2)] : null, ...H2(lifeSeth, f, 51, { ht: -2, look: -0.4, lookY: -0.1, facing: -0.4 }) }, st.x, st.z, { yaw: -0.45 });
      std('boy', OUTFITS.boy, { expr: 'nervous', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: -1.5, look: 0.4, lookY: 0, facing: 0.4 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'neutral', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.3 });
      arcCast();
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -1.5, look: 0.4, lookY: 0, facing: 0.35 }) }, { yaw: -0.4 });
      break;
    }
    case 'wait': {
      std('seth', OUTFITS.seth, { expr: 'grin', exprP: SP2, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeSeth, f, 51, { ht: q(lerp(-1, 4.5, smooth(ramp(f, 960, 1010))), 1), look: -0.2, lookY: 0.3, facing: -0.2 }) }, st.x, st.z, { yaw: -0.4 });
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -1, look: 0.3, lookY: 0, facing: 0.3 }) }, { yaw: -0.4 });
      std('v2', OUTFITS.v2, { expr: 'neutral', exprP: P2, mode: 'stand', blink: blinkAt(f, 72), seed: 72, ...H2(lifeV2, f, 72, { ht: -2, look: 0.3, lookY: -0.1, facing: 0.3 }) }, -9.8, -6.5, { yaw: 0.5 });
      break;
    }
    case 'payoff': {
      const shocked = f >= 1055;
      std('seth', OUTFITS.seth, { expr: shocked ? (f >= 1090 ? 'dazed' : 'shock') : 'grin', exprP: SP2, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeSeth, f, 51, { ht: shocked ? -3.5 : -2, look: -0.3, lookY: shocked ? -0.2 : 0, facing: -0.3 }) }, st.x, st.z, { yaw: -0.5 });
      std('boy', OUTFITS.boy, { expr: shocked ? 'laugh' : 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: shocked ? -3 : -1.5, look: 0.3, lookY: -0.1, facing: 0.3 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: shocked ? 'shock' : 'smile', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -2, look: -0.3, lookY: -0.1, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.3 });
      arcCast();
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.3 }) }, { yaw: -0.4 });
      break;
    }
    case 'emerge': {
      potterStd({ mode: potterMode(f), phase: q(potterPh(f), 2), ...H2(lifePotter, f, 31, { ht: f >= 1180 ? 0 : -1, look: 0.3, lookY: 0, facing: 0.3 }) }, { yaw: 0.3 });
      std('seth', OUTFITS.seth, { expr: 'nervous', exprP: SP2, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeSeth, f, 51, { ht: -2, look: -0.4, lookY: 0, facing: -0.4 }) }, st.x, st.z, { yaw: -0.5 });
      std('boy', OUTFITS.boy, { expr: f >= 1180 ? 'smile' : 'shock', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, ...H2(lifeBoy, f, 21, { ht: -2, look: 0.3, lookY: -0.1, facing: 0.3 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: f >= 1180 ? 'smile' : 'shock', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -2, look: -0.3, lookY: -0.1, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.3 });
      arcCast();
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the POTTER performs his line — mouth
      // driven by the stem inside the speak segment, closed outside
      // it; his free hand gestures with the voice (gestureAt); Seth
      // and the crowd only listen (narration stays voice-over).
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...PP, cheek: 0.5 }, sp);
      speakP.blush = 0;
      std('potter', OUTFITS.potter, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', q(gestPotter(f).k, 2)], clothShade: true,
        headTilt: q((sp.nod || 0) + micro(f, 31) + lifePotter(f).sway - 1, 1), look: q(0.12, 2), lookY: q(0.02, 2), facing: q(0.1, 2), tilt: q(lifePotter(f).tilt, 1), breath: Math.round(lifePotter(f).breath / 6) * 6 },
        pt.x, pt.z, { yaw: 0.45 });
      std('seth', OUTFITS.seth, { expr: 'nervous', exprP: SP2, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeSeth, f, 51, { ht: -1.5, look: -0.45, lookY: 0.05, facing: -0.4 }) }, st.x, st.z, { yaw: -0.5 });
      std('v1', OUTFITS.v1, { expr: 'smile', exprP: P1, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...H2(lifeV1, f, 71, { ht: -1.5, look: 0.3, lookY: 0, facing: 0.25 }) }, -2.7, 5.0, { yaw: 0.25 });
      std('v2', OUTFITS.v2, { expr: 'smile', exprP: P2, mode: 'stand', blink: blinkAt(f, 72), seed: 72, ...H2(lifeV2, f, 72, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.25 }) }, 0.1, 5.4, { yaw: 0 });
      break;
    }
    case 'after': {
      potterStd({ mode: 'stand', ...H2(lifePotter, f, 31, { ht: -2, look: 0.25, lookY: -0.05, facing: 0.25 }) }, { yaw: 0.3 });
      std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 23), seed: 21, prop: ['point', 0.5], ...H2(lifeBoy, f, 21, { ht: -2, look: 0.3, lookY: -0.05, facing: 0.3 }) }, by.x, by.z, { s: 0.8, yaw: 0.3 });
      std('farmer', OUTFITS.farmer, { expr: 'smile', exprP: FP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...H2(lifeFarmer, f, 41, { ht: -2, look: -0.3, lookY: -0.05, facing: -0.3 }) }, fa.x, fa.z, { yaw: -0.3 });
      std('v1', OUTFITS.v1, { expr: 'smile', exprP: P1, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...H2(lifeV1, f, 71, { ht: -2, look: 0.2, lookY: -0.05, facing: 0.2 }) }, -2.7, 5.0, { yaw: 0.25 });
      std('v3', OUTFITS.v3, { expr: 'smile', exprP: P3, mode: 'stand', blink: blinkAt(f, 73), seed: 73, ...H2(lifeV3, f, 73, { ht: -2, look: -0.2, lookY: -0.05, facing: -0.2 }) }, -3.6, 4.6, { yaw: -0.25 });
      std('seth', OUTFITS.seth, { expr: 'neutral', exprP: SP2, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeSeth, f, 51, { ht: 2.5, look: -0.3, lookY: 0.15, facing: -0.3 }) }, st.x, st.z, { yaw: -0.5 });
      break;
    }
    case 'hookq': case 'hook': {
      // the film ends on a CHARACTER BEAT — the potter stands in the
      // foreground pointing up at the hook board behind him; his
      // head stays right of the board's text band, so the board
      // remains fully readable at full opacity to the last frame.
      // Narration only — his mouth is shut (smile, no speak track).
      std('potter', OUTFITS.potter, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.3], ...H2(lifePotter, f, 31, { ht: -2.5, look: 0.45, lookY: -0.35, facing: 0.45 }) }, HOOK_POTTER.x, HOOK_POTTER.z, { yaw: 0.5 });
      std('seth', OUTFITS.seth, { expr: 'smile', exprP: SP2, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...H2(lifeSeth, f, 51, { ht: -2.5, look: 0.4, lookY: -0.35, facing: 0.4 }) }, HOOK_SETH.x, HOOK_SETH.z, { yaw: -0.35 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(WELL.x, WELL.z, 1.75, { h: WELL.top, id: 'well' }),
  SOL.circle(KILN.x, KILN.z, 1.55, { h: 1.7, id: 'kiln' }),
  SOL.circle(-8.8, 1.2, 0.65, { h: 3, id: 'tree' }),
  SOL.circle(WELL.x - 1.88, WELL.z, 0.1, { h: 2.75, id: 'beampost' }),
  SOL.circle(WELL.x + 1.88, WELL.z, 0.1, { h: 2.75, id: 'beampost' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.4, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.4, id: 'boardpost' }),
  SOL.obb(-6.4, -8.2, 0.3, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(10.8, -5.5, -0.45, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(-11.5, -3.5, 0.6, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(7.8, -12.5, -0.2, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.obb(-3.4, -14.5, 0.1, 1.8, 1.4, { h: 2.3, id: 'hut' }),
  SOL.circle(-2.2, 3.6, 0.24, { h: 0.45, id: 'pitcher' }),
  SOL.circle(-2.5, 2.9, 0.24, { h: 0.45, id: 'pitcher' }),
  SOL.circle(3.3, 1.15, 0.24, { h: 0.45, id: 'pitcher' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const B = basketAt(f);
  // the basket is a suspended/carried prop (unchecked) EXCEPT on the
  // night beat, where it RESTS on the ground at the tunnel mouth.
  if (f >= 601 && f <= 730 && B.k) items.push({ id: 'basket', y: B.y, ground: 0, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
