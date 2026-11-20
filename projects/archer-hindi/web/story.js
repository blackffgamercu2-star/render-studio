// archer-hindi — "आँख बंद करके निशाना लगाने वाला लड़का"
// Salted Mine V3 + "v4" ACTION CAMERA + Library v6 body + FULL
// UPGRADE (2026-11-19): real fair-ground sunlight (ONE sun), volume
// characters with emotion, speaking = moving, real object physics
// (bow draw, arrow flight with arc, target impact, the tiny bell's
// swing, blindfold cloth). END RULE: the only performed line is L13
// (mid-film); the last quarter is narration only, all mouths shut.
// Voice stem: voice_build.wav — Rishav voice clone (Chatterbox
// local), speed-fitted, 62.923375 s, 30 fps, TOTAL 1888. Line
// timings from timing.json (faster-whisper small char-mapped onto
// the verbatim script — see ../align.py; the dropped 24.9–34.2 s
// span was recovered by ../span_fix.py). Scene changes ONLY at
// line boundaries: 19 shots = 19 script lines.
// ONE set: a fair ground. Shooting line z=+6 (boy at (0,6)); the
// straw target at (0,-6), centre y≈1.27, a TINY brass bell tied at
// its centre; crowd rows flank the lane at x=±3.3..3.4; stalls
// behind the line (z +9..+15); bunting poles at (±3.8, 7.5) and
// (±3.8,-4.2); the hook board beyond the target at (-1.35,2.45,-11.2).
// GRADE: Sunny Pop fair daylight, warming to gold late (goldK on
// the L18 clause boundary only). Boards/captions never graded.
import { M, blinkAt, q, clamp, lerp, lerp3, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { emoTrack, lifeAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';
const { smooth } = M;

export const FPS = 30, TOTAL = 1888;
export const SHOTS = [
  { id: 'open',      a: 0,    b: 104,  light: 'day' },  // L1  boy BIG, bow at full draw, frame 0
  { id: 'fair',      a: 105,  b: 192,  light: 'day' },  // L2  the fair; bettors leave empty-pocketed
  { id: 'bet',       a: 193,  b: 327,  light: 'day' },  // L3  rich youth strides in, big bet
  { id: 'tie',       a: 328,  b: 407,  light: 'day' },  // L4  blindfold tied, first arrow loosed
  { id: 'hit1',      a: 408,  b: 519,  light: 'day' },  // L5  flight tracked → centre hit, crowd roars
  { id: 'bell',      a: 520,  b: 653,  light: 'day' },  // L6  INSERT: the tiny bell at the centre
  { id: 'listen',    a: 654,  b: 755,  light: 'day' },  // L7  he aims by the sound — ear cocked
  { id: 'steal',     a: 756,  b: 833,  light: 'day' },  // L8  youth pockets the bell
  { id: 'silence',   a: 834,  b: 908,  light: 'day' },  // L9  boy strains to listen — only wind
  { id: 'miss',      a: 909,  b: 1027, light: 'day' },  // L10 edge hit, then mud
  { id: 'stunned',   a: 1028, b: 1111, light: 'day' },  // L11 crowd stunned
  { id: 'laugh',     a: 1112, b: 1191, light: 'day' },  // L12 he laughs, lifts the blindfold
  { id: 'line',      a: 1192, b: 1311, light: 'day' },  // L13 THE LINE (performed, speak.js)
  { id: 'restore',   a: 1312, b: 1407, light: 'day' },  // L14 bell out of the pocket, re-tied
  { id: 'retie',     a: 1408, b: 1491, light: 'day' },  // L15 blindfold on again, bow drawn
  { id: 'hit2',      a: 1492, b: 1579, light: 'day' },  // L16 bell rings → arrow flies true
  { id: 'payoff',    a: 1580, b: 1672, light: 'day' },  // L17 crowd erupts, youth pays
  { id: 'aftermath', a: 1673, b: 1770, light: 'day' },  // L18 nobody bets with him again
  { id: 'hookboard', a: 1771, b: 1887, light: 'day' },  // L19 hook board finale
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
export const BOARD_POS = [-1.35, 2.45, -11.2];

// Action beats (frames, anchored to ASR word onsets in timing.json)
export const REL1 = 396, IMP1 = 452;    // L4 release ("छोड़ दिया") → L5 centre hit ("धंसा")
export const REL2 = 948, IMP2 = 972;    // L10 arrow 2 → edge hit ("लगा")
export const REL3 = 995, IMP3 = 1013;   // L10 arrow 3 → mud ("धंस गया")
export const REL4 = 1556, IMP4 = 1574;  // L16 release ("छूट गया") → centre hit
export const BELL_OFF = 800;            // L8: youth slips the bell into his pocket
export const BELL_HAND = 1335;          // L14: bell taken out of the pocket
export const BELL_ON = 1385;            // L14: bell re-tied at the centre
export const BLIND_OFF = 1172;          // L12: boy lifts the blindfold ("पट्टी खोलकर")
export const BLIND_ON2 = 1442;          // L15: blindfold re-tied ("पट्टी बांधी")

// ---------- lights: Sunny Pop day, late gold ----------
export const LIGHTS = {
  day: { az: 118, el: 38, sky: '#bfe0f2', ground: '#77813f', hemi: 0.92, sun: '#fff2d8', sunI: 1.38, fog: '#cfe4ee', fogNear: 30, fogFar: 165,
    skyTop: '#3f8fd2', skyHor: '#dff0f7', sunDisc: '#fff6d8', sunSize: 0.012, sat: 1.12, vig: 0.24, shadowExt: 30, aurora: 0, gain: '#fff4e0',
    waterDeep: '#2e6f8e', waterShal: '#7fc4d8', glint: '#fff3cf' },
  gold: { az: 118, el: 38, sky: '#cfe0d8', ground: '#77813f', hemi: 0.88, sun: '#ffd9a0', sunI: 1.3, fog: '#e8dcc4', fogNear: 30, fogFar: 165,
    skyTop: '#4f7fc0', skyHor: '#ffdfae', sunDisc: '#fff3cf', sunSize: 0.013, sat: 1.08, vig: 0.25, shadowExt: 30, aurora: 0, gain: '#ffe9c4',
    waterDeep: '#2e6f8e', waterShal: '#7fc4d8', glint: '#ffe9b0' },
};
const mixHex = (a, b, u) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
};
export const goldK = (f) => smooth(ramp(f, 1673, 1745));
// exposure choreography: a hush of dim on the stunned beat, a lift
// of light as the true arrow lands and the crowd erupts.
const dipK = (f) => {
  let d = 1;
  if (f >= 1028 && f < 1080) d = 0.94 + 0.06 * smooth(ramp(f, 1048, 1080));
  if (f >= IMP4 && f < 1620) d = Math.max(d, 1.045 - 0.045 * smooth(ramp(f, 1580, 1620)));
  return d;
};
export const lightFor = (S, f) => {
  const base = LIGHTS[S.light] || LIGHTS.day, G = LIGHTS.gold, u = goldK(f);
  const out = { ...base };
  if (u > 0.001) {
    for (const k of ['hemi', 'sunI', 'sat', 'vig', 'sunSize']) out[k] = lerp(base[k], G[k], u);
    for (const k of ['sky', 'ground', 'sun', 'fog', 'skyTop', 'skyHor', 'sunDisc', 'gain', 'waterDeep', 'waterShal', 'glint']) out[k] = mixHex(base[k], G[k], u);
  }
  const d = dipK(f);
  out.sunI = out.sunI * d; out.hemi = out.hemi * (0.35 + 0.65 * d);
  return out;
};

// ---------- generic keyframe track (smoothed steps between keys) ----------
const track = (keys) => (f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, v0] = keys[i - 1], [f1, v1] = keys[i];
      return lerp(v0, v1, smooth(clamp((f - f0) / (f1 - f0))));
    }
  }
  return keys[keys.length - 1][1];
};
const win = (f, a, b, peak = 1) => smooth(ramp(f, a, a + 12)) * (1 - smooth(ramp(f, b - 12, b))) * peak;

// ---------- performance tracks: draw, aim, bell, crowd ----------
// bow draw 0..1 (string pulled). Releases snap back in 3 frames.
export const drawK = (f) => {
  let d = 0;
  d = Math.max(d, (1 - smooth(ramp(f, 105, 132))));                                            // open: drawn at f0, lowered in fair
  d = Math.max(d, smooth(ramp(f, 372, 394)) * (1 - ramp(f, REL1, REL1 + 3)));                  // tie: draw → release 1
  d = Math.max(d, smooth(ramp(f, 690, 745)) * (1 - smooth(ramp(f, 756, 800))) * 0.92);         // listen: rises, holds
  d = Math.max(d, win(f, 862, 909, 0.3));                                                      // silence: partial, straining
  d = Math.max(d, smooth(ramp(f, 912, 940)) * (1 - ramp(f, REL2, REL2 + 3)));                  // miss: draw → release 2
  d = Math.max(d, smooth(ramp(f, 962, 990)) * (1 - ramp(f, REL3, REL3 + 3)));                  // miss: draw → release 3
  d = Math.max(d, smooth(ramp(f, 1455, 1480)) * (1 - ramp(f, REL4, REL4 + 3)));                // retie→hit2: draw → release 4
  return clamp(d, 0, 1);
};
// bow raised to aim (vs hanging at his side)
export const aimK = (f) => {
  let a = 0;
  a = Math.max(a, 1 - smooth(ramp(f, 105, 132)));
  a = Math.max(a, win(f, 356, 486));
  a = Math.max(a, win(f, 672, 762));
  a = Math.max(a, win(f, 848, 1032, 0.75));
  a = Math.max(a, win(f, 1446, 1584));
  return clamp(a, 0, 1);
};
// tiny-bell swing energy: wind sway + ring impulses
export const bellK = (f) => {
  let e = 0.05 + 0.03 * Math.sin(f * 0.11);
  e += 0.30 * smooth(ramp(f, 545, 585)) * (1 - smooth(ramp(f, 610, 652))); // L6 gust
  for (const [t0, amp] of [[IMP1, 0.75], [1512, 0.5], [BELL_ON, 0.3], [IMP4, 1.0]])
    if (f >= t0) e += amp * Math.exp(-(f - t0) / 30);
  return e;
};
// target boss wobble after impacts
export const targetWob = (f) => {
  let w = 0;
  for (const [t0, amp] of [[IMP1, 0.5], [IMP2, 0.35], [IMP4, 0.6]])
    if (f >= t0 && f <= t0 + 48) w += amp * Math.sin((f - t0) * 1.5) * Math.exp(-(f - t0) / 11);
  return w;
};
export const cheerK = (f) => Math.max(win(f, 466, 522), win(f, 1582, 1668));
export const clapK = (f) => Math.max(win(f, 478, 520), win(f, 1590, 1662));
export const blindfoldOn = (f) => f < BLIND_OFF || f >= BLIND_ON2;

// ---------- positions ----------
export const boyPosAt = (f) => {
  const id = shotAt(f).id;
  if (id === 'restore') return { x: 0.35, z: -4.75, ph: 0, mode: 'stand' };
  if (id === 'hookboard') return { x: -0.95, z: -4.5, ph: 0, mode: 'stand' };
  if (id === 'aftermath') return { x: 0.3, z: 5.2, ph: 0, mode: 'stand' };
  return { x: 0, z: 6, ph: 0, mode: 'stand' };
};
export const youthPosAt = (f) => {
  const id = shotAt(f).id;
  if (id === 'bet') {
    const u = smooth(ramp(f, 196, 252)), dist = 3.32 * u;
    return { x: lerp(2.4, 1.7, u), z: lerp(8.6, 5.35, u), ph: stridePh(0, dist, 0.78), mode: f < 252 ? 'stroll' : 'stand' };
  }
  if (id === 'steal' && f >= 802) {
    const u = smooth(ramp(f, 802, 833)), dist = 2.73 * u;
    return { x: lerp(0.85, 1.5, u), z: lerp(-4.85, -2.2, u), ph: stridePh(0, dist, 0.78), mode: u < 1 ? 'stroll' : 'stand' };
  }
  if (id === 'steal') return { x: 0.85, z: -4.85, ph: 0, mode: 'stand' };
  if (id === 'restore') return { x: 1.15, z: -5.0, ph: 0, mode: 'stand' };
  if (id === 'line') return { x: 1.3, z: 5.5, ph: 0, mode: 'stand' };
  return { x: 1.7, z: 5.35, ph: 0, mode: 'stand' };
};
// bow state for main.js (3D prop): follows the boy
export const bowStateAt = (f) => {
  const b = boyPosAt(f);
  const aim = aimK(f), draw = drawK(f);
  if (aim > 0.03) return { visible: true, x: b.x - 0.30, y: lerp(0.86, 1.05, aim), z: b.z - 0.30, yaw: Math.PI, draw, aim };
  return { visible: true, x: b.x - 0.36, y: 0.8, z: b.z - 0.14, yaw: Math.PI * 0.92, draw: 0, aim: 0 };
};
// arrows: nock → flight (real arc, pitch from the path derivative) → stuck
function flightAt(f, f0, f1, p0, p1, arcH, drop = 0) {
  const pos = (u) => { const p = lerp3(p0, p1, u); p[1] += Math.sin(u * Math.PI) * arcH - u * u * drop; return p; };
  const u = clamp((f - f0) / (f1 - f0), 0, 1);
  const p = pos(u), qq = pos(Math.min(1, u + 0.03));
  return { mode: 'fly', x: p[0], y: p[1], z: p[2], pitch: Math.atan2(qq[1] - p[1], -(qq[2] - p[2])), yaw: Math.PI, vib: 0 };
}
const NOCK = { x: -0.27, y: 1.24, z: 5.62, pitch: -0.02, yaw: Math.PI, vib: 0 };
const stuckAt = (x, y, z, pitch, t0, f) => ({ mode: 'stuck', x, y, z, pitch, yaw: Math.PI, vib: f < t0 + 42 ? Math.sin((f - t0) * 1.9) * Math.exp(-(f - t0) / 9) : 0 });
export const arrowStateAt = (f) => {
  const out = [];
  // A1 — nocked from frame 0 (bow drawn), centre hit
  if (f < REL1) out.push({ mode: 'nock', ...NOCK });
  else if (f < IMP1) out.push(flightAt(f, REL1, IMP1, [-0.27, 1.24, 5.55], [0.03, 1.28, -5.76], 0.34));
  else out.push(stuckAt(0.03, 1.28, -5.76, -0.05, IMP1, f));
  // A2 — edge hit
  if (f < 909) out.push({ mode: 'hide', ...NOCK });
  else if (f < REL2) out.push({ mode: 'nock', ...NOCK });
  else if (f < IMP2) out.push(flightAt(f, REL2, IMP2, [-0.27, 1.24, 5.55], [0.52, 1.5, -5.76], 0.3));
  else out.push(stuckAt(0.52, 1.5, -5.76, -0.1, IMP2, f));
  // A3 — falls short into the mud
  if (f < 973) out.push({ mode: 'hide', ...NOCK });
  else if (f < REL3) out.push({ mode: 'nock', ...NOCK });
  else if (f < IMP3) out.push(flightAt(f, REL3, IMP3, [-0.27, 1.24, 5.55], [0.85, 0.32, -2.3], 0.42, 0.85));
  else out.push({ mode: 'mud', x: 0.85, y: 0.32, z: -2.3, pitch: -0.8, yaw: Math.PI, vib: f < IMP3 + 24 ? Math.sin((f - IMP3) * 1.7) * Math.exp(-(f - IMP3) / 7) : 0 });
  // A4 — the true arrow after the bell is restored
  if (f < 1450) out.push({ mode: 'hide', ...NOCK });
  else if (f < REL4) out.push({ mode: 'nock', ...NOCK });
  else if (f < IMP4) out.push(flightAt(f, REL4, IMP4, [-0.27, 1.24, 5.55], [-0.1, 1.21, -5.76], 0.34));
  else out.push(stuckAt(-0.1, 1.21, -5.76, -0.04, IMP4, f));
  return out;
};
// tiny bell: at the centre / hidden in the pocket / in the youth's hand
export const bellStateAt = (f) => {
  const swing = bellK(f);
  if (f < BELL_OFF) return { mode: 'target', swing, x: 0, y: 1.27, z: -5.7 };
  if (f < BELL_HAND) return { mode: 'pocket', swing: 0, x: 0, y: -10, z: 0 };
  if (f < BELL_ON) { const yp = youthPosAt(f); return { mode: 'hand', swing: swing * 0.4, x: yp.x - 0.38, y: 1.12, z: yp.z - 0.34 }; }
  return { mode: 'target', swing, x: 0, y: 1.27, z: -5.7 };
};

// ---------- camera: v4 action rig ----------
const arrowPosAt = (f) => {
  const fl = arrowStateAt(f).find((x) => x.mode === 'fly');
  return fl ? [fl.x, fl.y, fl.z] : [0, 1.27, -5.76];
};
// smooth phase-blend helper for the raw tracking cameras: each phase
// holds until its fEnd, blending over the last 14 frames
function blendPose(f, phases) {
  let cur = phases[0];
  for (let i = 1; i < phases.length; i++) {
    const [fe, pos, look, fov] = phases[i];
    if (f <= fe) {
      const u = smooth(ramp(f, fe - 16, fe));
      return { pos: lerp3(cur[1], pos, u), look: lerp3(cur[2], look, u), fov: lerp(cur[3], fov, u), roll: 0 };
    }
    cur = phases[i];
  }
  return { pos: cur[1], look: cur[2], fov: cur[3], roll: 0 };
}
const BOY_LOOK = [0, 1.3, 6];
const RIG_BY_ID = {
  open: { raw: keysCam({ keys: [
    { f: 0, pos: [1.3, 1.18, 3.3], look: [0, 1.32, 6.0], fov: 37 },
    { f: 104, pos: [1.05, 1.32, 3.8], look: [0, 1.34, 6.0], fov: 34.5, ease: 'surge' }] }) },
  fair: { raw: keysCam({ keys: [
    { f: 105, pos: [6.2, 2.8, 12.5], look: [0, 1.0, 3.0], fov: 43 },
    { f: 192, pos: [4.6, 2.3, 10.2], look: [0, 1.0, 2.0], fov: 43, ease: 'surge' }] }) },
  bet: { raw: keysCam({ keys: [
    { f: 193, pos: [5.0, 1.9, 12.6], look: [2.4, 1.35, 8.6], fov: 40 },
    { f: 240, pos: [3.9, 1.75, 10.3], look: [1.75, 1.35, 5.9], fov: 37, ease: 'surge' },
    { f: 327, pos: [3.0, 1.62, 8.3], look: [1.7, 1.36, 5.6], fov: 35, ease: 'surge' }] }) },
  tie: { raw: keysCam({ keys: [
    { f: 328, pos: [1.3, 1.52, 3.55], look: [0, 1.35, 6.0], fov: 36 },
    { f: 407, pos: [1.18, 1.5, 3.8], look: [0, 1.35, 6.0], fov: 35, ease: 'surge' }] }) },
  hit1: { raw: (f) => {
    if (f < IMP1) { const ap = arrowPosAt(f); return { pos: [3.05, 1.55, ap[2] + 1.6], look: ap, fov: 36, roll: 0 }; }
    if (f < 478) { const u = smooth(ramp(f, IMP1, 478)); const ap = arrowPosAt(IMP1 - 1); return { pos: lerp3([3.05, 1.55, ap[2] + 1.6], [1.9, 1.55, -2.7], u), look: lerp3(ap, [0, 1.27, -5.9], u), fov: lerp(36, 34, u), roll: 0 }; }
    const u = smooth(ramp(f, 478, 505));
    return { pos: lerp3([1.9, 1.55, -2.7], [2.3, 1.65, 1.6], u), look: lerp3([0, 1.27, -5.9], [3.35, 1.35, 1.9], u), fov: 34, roll: 0 };
  } },
  bell: { cut: 'whip', blend: 10, raw: keysCam({ keys: [
    { f: 520, pos: [0.55, 1.4, -1.65], look: [0, 1.27, -5.85], fov: 34 },
    { f: 653, pos: [0.45, 1.38, -1.85], look: [0, 1.27, -5.85], fov: 33, ease: 'surge' }] }) },
  listen: { raw: keysCam({ keys: [
    { f: 654, pos: [1.55, 1.5, 3.15], look: [0, 1.36, 6.0], fov: 36 },
    { f: 755, pos: [1.3, 1.48, 3.5], look: [0, 1.36, 6.0], fov: 34, ease: 'surge' }] }) },
  steal: { raw: keysCam({ keys: [
    { f: 756, pos: [2.4, 1.6, -3.4], look: [-0.1, 1.2, -5.9], fov: 37 },
    { f: 833, pos: [2.15, 1.55, -3.6], look: [-0.15, 1.2, -5.9], fov: 37, ease: 'surge' }] }) },
  silence: { raw: keysCam({ keys: [
    { f: 834, pos: [1.18, 1.48, 3.72], look: [0, 1.37, 6.0], fov: 34 },
    { f: 908, pos: [1.08, 1.47, 3.85], look: [0, 1.37, 6.0], fov: 34, ease: 'surge' }] }) },
  miss: { raw: (f) => {
    if (f >= REL2 && f < IMP2) { const ap = arrowPosAt(f); return { pos: [3.05, 1.55, ap[2] + 1.4], look: ap, fov: 36, roll: 0 }; }
    if (f < REL2) return blendPose(f, [[928, [2.7, 1.6, 3.9], BOY_LOOK, 36], [REL2, [3.05, 1.55, 6.95], [-0.27, 1.24, 5.55], 36]]);
    return blendPose(f, [
      [IMP2, [3.05, 1.55, -4.36], [0.52, 1.5, -5.76], 36],
      [988, [2.7, 1.6, 3.9], BOY_LOOK, 36],
      [1004, [2.7, 1.6, 3.9], BOY_LOOK, 36],
      [1018, [2.6, 1.45, 0.6], [0.7, 0.5, -2.0], 37],
      [1027, [2.6, 1.45, 0.6], [0.7, 0.5, -2.0], 37]]);
  } },
  stunned: { raw: keysCam({ keys: [
    { f: 1028, pos: [5.0, 2.4, 4.8], look: [2.6, 1.25, 0.6], fov: 42 },
    { f: 1111, pos: [3.7, 1.85, 2.4], look: [2.9, 1.3, 0.9], fov: 37, ease: 'surge' }] }) },
  laugh: { raw: keysCam({ keys: [
    { f: 1112, pos: [1.3, 1.52, 3.7], look: [0, 1.36, 6.0], fov: 35 },
    { f: 1191, pos: [1.15, 1.5, 3.95], look: [0, 1.36, 6.0], fov: 35, ease: 'surge' }] }) },
  line: { raw: pushInCam({ subject: [0, 1.37, 6.0], dir: [0.58, 0.81], d0: 3.5, d1: 3.0, h0: 0.3, h1: 0.22, a: 1192, b: 1311, fov0: 37, fov1: 34 }) },
  restore: { raw: keysCam({ keys: [
    { f: 1312, pos: [2.0, 1.62, -2.5], look: [0.3, 1.2, -5.85], fov: 38 },
    { f: 1360, pos: [1.7, 1.55, -2.9], look: [0.15, 1.22, -5.85], fov: 36, ease: 'surge' },
    { f: 1407, pos: [1.25, 1.47, -3.55], look: [0.05, 1.24, -5.85], fov: 35, ease: 'surge' }] }) },
  retie: { raw: keysCam({ keys: [
    { f: 1408, pos: [1.65, 1.57, 3.05], look: [0, 1.33, 6.0], fov: 37 },
    { f: 1491, pos: [1.4, 1.53, 3.4], look: [0, 1.33, 6.0], fov: 35, ease: 'surge' }] }) },
  hit2: { raw: (f) => {
    if (f < 1546) { const u = smooth(ramp(f, 1492, 1546)); return { pos: lerp3([1.5, 1.52, 3.3], [1.42, 1.5, 3.45], u), look: [0, 1.36, 6.0], fov: 35, roll: 0 }; }
    if (f < 1562) { const u = smooth(ramp(f, 1546, 1562)); const ap = arrowPosAt(1562); const tp = [3.05, 1.55, ap[2] + 1.3]; return { pos: lerp3([1.42, 1.5, 3.45], tp, u), look: lerp3([0, 1.36, 6.0], ap, u), fov: 35, roll: 0 }; }
    if (f < IMP4) { const ap = arrowPosAt(f); return { pos: [3.05, 1.55, ap[2] + 1.3], look: ap, fov: 35, roll: 0 }; }
    return { pos: [1.85, 1.55, -2.65], look: [0, 1.26, -5.88], fov: 35, roll: 0 };
  } },
  payoff: { raw: keysCam({ keys: [
    { f: 1580, pos: [5.6, 2.7, 10.5], look: [1.2, 1.2, 4.2], fov: 43 },
    { f: 1672, pos: [4.3, 2.1, 8.6], look: [1.6, 1.25, 4.8], fov: 38, ease: 'surge' }] }) },
  aftermath: { raw: keysCam({ keys: [
    { f: 1673, pos: [4.8, 2.5, 10.8], look: [0, 1.05, 1.5], fov: 42 },
    { f: 1770, pos: [4.2, 2.2, 9.4], look: [0, 1.05, 1.5], fov: 42, ease: 'surge' }] }) },
  hookboard: { raw: keysCam({ keys: [
    { f: 1771, pos: [0.35, 2.1, -0.6], look: [-1.28, 2.32, -11.2], fov: 42 },
    { f: 1887, pos: [0.25, 2.12, -0.35], look: [-1.28, 2.32, -11.2], fov: 42, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: IMP1, a: 0.2 }, { f: IMP2, a: 0.14 }, { f: IMP3, a: 0.1 }, { f: IMP4, a: 0.24 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor((RIG_BY_ID[s.id].blend || 0) / 2), b: s.a + Math.ceil((RIG_BY_ID[s.id].blend || 0) / 2) })),
  // AUTHORED WHIP ZONES: the v4 arrow-tracking segments — the camera
  // rides the arrow at arrow speed (0.5–0.75 m/f) and whips back.
  // These are declared transitions, reported here openly rather than
  // flattened: miss A2 track + return, miss mud swing, hit2 surge +
  // A4 track.
  whips: [...RIG.declared.whips, { a: 946, b: 990 }, { a: 1000, b: 1020 }, { a: 1544, b: 1579 }],
  samples: RIG.samples,
};
const FOCUS = {
  open: () => [0, 1.3, 6], fair: () => [0, 1.0, 1.5],
  bet: (f) => { const p = youthPosAt(f); return [p.x, 1.3, p.z]; },
  tie: () => [0, 1.3, 6], hit1: () => [0, 1.27, -5.8], bell: () => [0, 1.27, -5.85],
  listen: () => [0, 1.35, 6],
  steal: (f) => { const p = youthPosAt(f); return [p.x, 1.1, p.z]; },
  silence: () => [0, 1.35, 6], miss: () => [0, 1.2, 0], stunned: () => [2.8, 1.3, 0.8],
  laugh: () => [0, 1.35, 6], line: () => [0, 1.35, 6], restore: () => [0, 1.25, -5.8],
  retie: () => [0, 1.3, 6], hit2: () => [0, 1.27, -5.8], payoff: () => [1.8, 1.2, 3.5],
  aftermath: () => [0, 1.0, 1.5], hookboard: () => [-1.35, 2.45, -11.2],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);
const CINF = { open: 2.6, fair: 5.0, bet: 2.6, tie: 2.2, hit1: 2.2, bell: 1.6, listen: 2.2, steal: 1.8, silence: 1.8, miss: 2.4, stunned: 3.0, laugh: 1.9, line: 1.7, restore: 2.0, retie: 2.2, hit2: 2.4, payoff: 4.0, aftermath: 6.0, hookboard: 3.2 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1776, 1802)) : 0,
    bellK: bellK(f),
    goldK: goldK(f),
    wobK: targetWob(f),
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.08, blastRate: 0, sparkRate: (f >= 1600 && f <= 1665) ? 0.5 : 0, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours
// flat and saturated (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  boy: { jacket: '#c2452d', pants: '#4a3626', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  youth: { jacket: '#6d2a7a', pants: '#e6dcc4', boots: '#2a1a10', hat: 'turban', turban: '#e8b23a', skin: '#fbf7ef', moustache: '#2a201a' },
  crowd0: { jacket: '#7a4a2b', pants: '#3c4653', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
  crowd1: { jacket: '#31577f', pants: '#54443a', boots: '#241a12', hat: 'hair', hair: '#171310', skin: '#fbf7ef' },
  crowd2: { jacket: '#5d7031', pants: '#4a3626', boots: '#241a12', hat: 'cap', cap: '#8a3b2a', skin: '#fbf7ef' },
  crowd3: { jacket: '#8a5a24', pants: '#39424e', boots: '#241a12', hat: 'hair', hair: '#100c0a', skin: '#fbf7ef', moustache: '#2a201a' },
  crowd4: { jacket: '#6b5a44', pants: '#46392c', boots: '#241a12', hat: 'hair', hair: '#cfc8bd', skin: '#fbf7ef', moustache: '#b8b3a4', bigMoustache: true },
  crowd5: { jacket: '#74455e', pants: '#333f4d', boots: '#241a12', hat: 'hair', hair: '#1d1410', skin: '#fbf7ef' },
};
const CROWD = [
  { seed: 61, x: -3.4, z: 3.2 }, { seed: 67, x: 3.4, z: 3.4 }, { seed: 71, x: -3.4, z: 0.2 },
  { seed: 79, x: 3.4, z: 0.4 }, { seed: 83, x: -3.3, z: -2.6 }, { seed: 89, x: 3.3, z: -2.4 },
];
// Emotion morphs at story beats (body.js emoTrack).
const emoBoy = emoTrack(T.faceP, 'determined', [
  [105, 'smile', 8], [328, 'determined', 8], [470, 'proud', 8], [654, 'thinking', 8], [834, 'nervous', 8],
  [975, 'shock', 5], [1028, 'nervous', 8], [1112, 'laugh', 8], [1192, 'smile', 8], [1312, 'smile', 8],
  [1408, 'determined', 8], [1580, 'proud', 8], [1673, 'smile', 8], [1771, 'smile', 8],
]);
const emoYouth = emoTrack(T.faceP, 'smug', [
  [756, 'nervous', 8], [834, 'smug', 8], [975, 'relief', 8], [1112, 'shock', 6], [1192, 'nervous', 8],
  [1312, 'sad', 9], [1408, 'nervous', 8], [1580, 'sad', 9], [1673, 'relief', 9], [1771, 'relief', 8],
]);
const emoCrowd = emoTrack(T.faceP, 'smile', [
  [471, 'laugh', 8], [560, 'smile', 8], [975, 'shock', 6], [1112, 'smile', 8], [1580, 'laugh', 8], [1673, 'smile', 8],
]);
// Continuous life per character (body.js lifeAt).
const lifeBoy = lifeAt({ seed: 31 }), lifeYouth = lifeAt({ seed: 51 });
const lifeCrowd = CROWD.map((c) => lifeAt({ seed: c.seed }));
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
const noBlush = (P) => { const P2 = { ...P, cheek: Math.max(P.cheek ?? 0, 0.55) }; P2.blush = 0; P2.openL = Math.min(1, (P2.openL ?? 0.85) * 1.45); P2.openR = Math.min(1, (P2.openR ?? 0.85) * 1.45); return P2; };
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// dialogue gesture: the boy's free (right) hand talks with the voice —
// stresses on घंटी (f1271), आवाज़ (f1284), चलाता (f1297).
const gestBoy = gestureAt([{ a: 1243, b: 1310, beats: [1271, 1284, 1297], base: 0.14, amp: 0.5 }]);

// the blindfold band, drawn on the boy's card while worn: deep-red
// cloth with fold shading and a side knot with tails, over the eyes
function drawBlindfold(p) {
  const g = p.g, hc = T.headCenter(31), ey = hc - 6, cx = 300;
  g.save();
  g.fillStyle = '#7a2e2e';
  g.beginPath(); g.roundRect(cx - 98, ey - 27, 196, 52, 16); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath(); g.roundRect(cx - 98, ey + 8, 196, 17, 8); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.20)';
  g.beginPath(); g.roundRect(cx - 98, ey - 27, 196, 10, 5); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const fx of [-52, 6, 58]) { g.beginPath(); g.roundRect(cx + fx, ey - 25, 5, 48, 2); g.fill(); }
  g.fillStyle = '#5f2222';
  g.beginPath(); g.arc(cx + 102, ey + 2, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7a2e2e';
  g.beginPath(); g.moveTo(cx + 100, ey + 12); g.lineTo(cx + 122, ey + 62); g.lineTo(cx + 104, ey + 66); g.lineTo(cx + 92, ey + 20); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx + 94, ey + 14); g.lineTo(cx + 100, ey + 70); g.lineTo(cx + 86, ey + 68); g.lineTo(cx + 84, ey + 18); g.closePath(); g.fill();
  g.restore();
}

export const castAt = (f) => {
  const S = shotAt(f), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    out.push({ id, x, y: 0, z, r: extra.r || 0.32, ground: 0,
      actor: (Tm) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + '0',
        draw: (p) => { Tm.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
        x, y: 0, z, ground: 0, tint: tintFor(), ...extra }) });
  };
  const BP = noBlush(emoBoy.at(f)), YP = noBlush(emoYouth.at(f)), CP = noBlush(emoCrowd.at(f));
  const b = boyPosAt(f), yn = youthPosAt(f);
  const boyStd = (opts, extra = {}) => std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, blink: blinkAt(f, 31), seed: 31, mode: b.mode, phase: q(b.ph, 2), ...opts }, b.x, b.z,
    { yaw: 0.1, s: 0.82, r: 0.3, overlay: blindfoldOn(f) ? drawBlindfold : null, ...extra });
  const youthStd = (opts, extra = {}) => std('youth', OUTFITS.youth, { expr: 'smile', exprP: YP, blink: blinkAt(f, 51), seed: 51, mode: yn.mode, phase: q(yn.ph, 2), ...opts }, yn.x, yn.z,
    { yaw: -0.15, s: 1.0, ...extra });
  const crowdStd = (i, opts = {}, extra = {}) => {
    const c = CROWD[i], side = c.x < 0 ? 1 : -1;
    const ch = cheerK(f), cl = clapK(f);
    let arms = {};
    if (cl > 0.03) { const k = q((0.5 + 0.22 * Math.sin(f * 0.85 + c.seed)) * cl, 2); arms = { prop: ['point', q(0.45 + k * 0.4, 2)], propL: ['point', q(0.45 + k * 0.4, 2)] }; }
    else if (ch > 0.03) arms = { prop: ['point', q(0.85 * ch, 2)], propL: ['point', q(0.8 * ch, 2)] };
    std('crowd' + c.seed, OUTFITS['crowd' + i], { expr: 'smile', exprP: CP, blink: blinkAt(f, c.seed), seed: c.seed, mode: 'stand',
      ...arms, ...H2(lifeCrowd[i], f, c.seed, { look: side * -0.2 }), ...opts }, extra.x ?? c.x, extra.z ?? c.z, { yaw: side * 0.3, s: 0.97, ...extra });
  };
  const crowdSet = (ids) => ids.forEach((i) => crowdStd(i));
  // the boy's arm language, shared across shots
  const draw = drawK(f), aim = aimK(f);
  const tieK = Math.max(win(f, 343, 372), win(f, 1428, 1452));
  const liftK = win(f, 1156, 1182);
  const boyArms = () => {
    if (tieK > 0.03 || liftK > 0.03) { const k = q(0.82 * Math.max(tieK, liftK), 2); return { prop: ['point', k], propL: ['point', q(k * 0.92, 2)] }; }
    if (aim > 0.03) return { propL: ['point', 0.6], prop: ['point', q(0.62 - 0.28 * draw, 2)] };
    return {};
  };

  switch (S.id) {
    case 'open': {
      // frame 0: BIG, mid-action — bow at FULL DRAW, blindfold on,
      // chin up, listening down the lane. He holds it all line.
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -2, look: -0.2, lookY: -0.05, facing: 0.15 }) }, { yaw: 0.15 });
      break;
    }
    case 'fair': {
      crowdSet([0, 2, 3, 4, 5]);
      // a bettor in the east row pats his EMPTY pockets and shrugs (L2)
      crowdStd(1, { prop: ['point', 0.22], propL: ['point', 0.22], ...H2(lifeCrowd[1], f, 67, { ht: 2.5, look: 0.2, lookY: 0.3 }) });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -1, look: 0.15 }) }, { yaw: -0.1 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 1, look: 0.2 }) });
      break;
    }
    case 'bet': {
      // the youth strides in swinging a coin pouch, jabs a finger
      // at the boy as he lays the big bet; the boy stays calm.
      const pouch = f >= 262 ? { prop: ['coin', q(0.4 + 0.3 * win(f, 262, 327), 2)] } : {};
      youthStd({ ...pouch, ...H2(lifeYouth, f, 51, { ht: -1.5, look: -0.25, facing: -0.1 }) }, { yaw: -0.2 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -1, look: 0.3 }) }, { yaw: 0.1 });
      break;
    }
    case 'tie': {
      // hands rise to tie the band (f343–372), then the draw climbs
      // (f372–394) and the first arrow is loosed at f396.
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -2.5, look: -0.15, lookY: 0.05, facing: 0.1 }) }, { yaw: 0.05 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 0, look: -0.3 }) }, { yaw: -0.25 });
      break;
    }
    case 'hit1': {
      crowdSet([0, 1, 2, 3]);
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -1.5, look: -0.2 }) }, { yaw: 0.1 });
      break;
    }
    case 'bell': break; // pure insert: boss centre, the bell, arrow A1
    case 'listen': {
      crowdSet([1, 3]);
      // head cocked hard toward the target, draw rising on the sound
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -6, look: -0.3, lookY: 0, facing: -0.15 }) }, { yaw: -0.15 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 1, look: -0.2 }) }, { yaw: -0.2 });
      break;
    }
    case 'steal': {
      // tight on the youth's hand: reach (f772+), bell unhooked at
      // f800, pocketed, and he slips away south by f833.
      const reach = f < BELL_OFF ? { prop: ['point', q(0.8 * win(f, 772, 826), 2)], propL: ['point', 0.2] } : { prop: ['point', 0.15] };
      youthStd({ ...reach, ...H2(lifeYouth, f, 51, { ht: 3, look: 0.25, lookY: 0.25, facing: 0.2 }) }, { yaw: 0.3 });
      break;
    }
    case 'silence': {
      // face huge, head turning slowly, hunting for a sound that
      // is not there; the bow half-rises and stalls.
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -7, look: q(0.18 * Math.sin(f * 0.045), 2), lookY: 0.05, facing: -0.1 }) }, { yaw: 0 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 1, look: -0.25 }) }, { yaw: -0.2 });
      break;
    }
    case 'miss': {
      crowdSet([2, 5]);
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -3, look: -0.2, facing: 0.05 }) }, { yaw: 0.1 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 0, look: -0.3 }) }, { yaw: -0.2 });
      break;
    }
    case 'stunned': {
      crowdSet([0, 1, 2, 3, 4, 5]);
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 1, look: -0.2 }) }, { yaw: -0.2 });
      break;
    }
    case 'laugh': {
      // the laugh breaks at f1137; both hands lift the band off
      // (f1156–1182); by the line he is bare-eyed and grinning.
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -3, look: 0.15, facing: 0.1 }) }, { yaw: 0.15 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 2, look: -0.3 }) }, { yaw: -0.25 });
      break;
    }
    case 'line': {
      // THE LINE, performed: his mouth is driven by the stem
      // (speak.js); his right hand gestures on the stress words;
      // the bow hangs in his left; the youth listens — mouth shut.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...BP, cheek: Math.max(BP.cheek ?? 0, 0.55) }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      boyStd({ exprP: speakP, prop: ['point', q(gestBoy(f).k, 2)], propL: ['point', 0.34],
        headTilt: q((sp.nod || 0) + micro(f, 31) - 1, 1), look: q(0.2, 2), lookY: q(0, 2), facing: q(0.15, 2),
        squash: 0, tilt: q(lifeBoy(f).tilt + lifeBoy(f).sway, 1), breath: Math.round(lifeBoy(f).breath / 6) * 6 }, { yaw: 0.25 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 1.5 + nodAt(f, 1266, 10, 0.4), look: -0.35, facing: -0.2 }) }, { yaw: -0.3 });
      break;
    }
    case 'restore': {
      // at the target: the youth fishes the bell out (f1335), holds
      // it up sheepishly, and their hands re-tie it at the centre.
      youthStd({ prop: ['point', q(0.68 * win(f, 1328, 1392) + 0.08, 2)], propL: ['point', 0.25], ...H2(lifeYouth, f, 51, { ht: 3, look: -0.25, lookY: 0.2, facing: -0.15 }) }, { yaw: -0.35 });
      boyStd({ prop: ['point', q(0.55 * win(f, 1352, 1407) + 0.1, 2)], propL: ['point', 0.3], ...H2(lifeBoy, f, 31, { ht: -1, look: 0.3, facing: 0.2 }) }, { yaw: 0.3 });
      break;
    }
    case 'retie': {
      crowdSet([0, 1]);
      // band re-tied (f1428–1452), then the draw climbs again
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -2.5, look: -0.15, lookY: 0.05, facing: 0.1 }) }, { yaw: 0.05 });
      break;
    }
    case 'hit2': {
      // he hears the bell (f1512), smiles under the band, and
      // looses at f1556 — the camera rides the arrow home.
      boyStd({ ...boyArms(), ...H2(lifeBoy, f, 31, { ht: -4, look: -0.25, facing: 0.05 }) }, { yaw: 0 });
      break;
    }
    case 'payoff': {
      crowdSet([0, 1, 2, 3, 4, 5]);
      // the youth counts out the coins, shoulders slumped
      youthStd({ prop: ['coin', q(0.75 * win(f, 1612, 1662), 2)], propL: ['point', 0.3], ...H2(lifeYouth, f, 51, { ht: 3.5, look: -0.1, lookY: 0.3 }) }, { yaw: -0.25 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -1.5, look: 0.25 }) }, { yaw: 0.2 });
      break;
    }
    case 'aftermath': {
      crowdSet([0, 1, 2, 3, 4, 5]);
      // a villager waves off a fresh bet — never again
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -1, look: -0.2, facing: -0.2 }) }, { yaw: -0.3 });
      youthStd({ ...H2(lifeYouth, f, 51, { ht: 2, look: 0.15 }) }, { yaw: -0.2 });
      break;
    }
    case 'hookboard': {
      // finale: the boy points up at the hook board; the youth and
      // the elder look up with him. Nobody speaks (END RULE).
      boyStd({ prop: ['point', 0.88], propL: ['point', 0.3], ...H2(lifeBoy, f, 31, { ht: -4, look: -0.1, lookY: -0.25, facing: 0.1 }) }, { yaw: 0.35 });
      crowdStd(4, { ...H2(lifeCrowd[4], f, 83, { look: 0.15, lookY: -0.25 }) }, { x: -1.35, z: -5.6, yaw: 0.3 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, Tm) => castAt(f).map((c) => c.actor(Tm));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-0.65, 0.65, -6.45, -5.55, { h: 1.9, id: 'target' }),
  SOL.aabb(-10.3, -6.9, 9.2, 11.8, { h: 3, id: 'stallW' }), SOL.aabb(6.9, 10.3, 9.2, 11.8, { h: 3, id: 'stallE' }),
  SOL.aabb(-2.1, 2.1, 12.1, 14.9, { h: 3, id: 'stallB' }),
  SOL.aabb(-12.2, -8.6, 0.4, 3.6, { h: 2.6, id: 'tentW' }), SOL.aabb(8.6, 12.2, 0.4, 3.6, { h: 2.6, id: 'tentE' }),
  SOL.circle(-3.8, 7.5, 0.09, { h: 2.6, id: 'poleSW' }), SOL.circle(3.8, 7.5, 0.09, { h: 2.6, id: 'poleSE' }),
  SOL.circle(-3.8, -4.2, 0.09, { h: 2.6, id: 'poleNW' }), SOL.circle(3.8, -4.2, 0.09, { h: 2.6, id: 'poleNE' }),
  SOL.circle(-9, -6, 0.5, { h: 4.5, id: 'treeW' }), SOL.circle(9.5, -7, 0.55, { h: 4.5, id: 'treeE' }),
  SOL.circle(-10, 4, 0.5, { h: 4, id: 'treeW2' }), SOL.circle(10.5, 5, 0.5, { h: 4, id: 'treeE2' }),
  SOL.circle(-2.25, -11.3, 0.07, { h: 2.8, id: 'boardPostL' }), SOL.circle(-0.45, -11.3, 0.07, { h: 2.8, id: 'boardPostR' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: '' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  arrowStateAt(f).forEach((a, i) => {
    if (a.mode === 'stuck') items.push({ id: 'arrow' + (i + 1), y: a.y, ground: a.y, maxHover: 0.06 });
    if (a.mode === 'mud') items.push({ id: 'arrow' + (i + 1), y: 0.04, ground: 0, maxHover: 0.06 });
  });
  const bl = bellStateAt(f);
  if (bl.mode === 'target') items.push({ id: 'bell', y: bl.y, ground: bl.y, maxHover: 0.06 });
  return items;
};
