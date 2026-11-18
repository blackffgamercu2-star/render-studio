// Shot plan for "बिना आग के खाना पकाने वाली औरत" — fireless-hindi.
// Salted Mine V3 style/animation + Abid's "v4" ACTION CAMERA (camera
// moves with every movement, fast push-in/tracking, impact kicks, no
// slow drift) + the ANIMATION UPGRADE (2026-11-18): continuous life
// (body.js lifeAt breathing/weight-shift on EVERY figure), emotion
// morphs at beats (body.js emoTrack), dialogue gesture (gestureAt),
// and PHYSICAL GRIPS (gripAt + toon v6 propL / carry / 'thali' /
// 'cloth'): Kamla carries the degchi two-handed and sets it down with
// a settle; her hand stays ON each thali while its tilt changes; the
// sarpanch's pagdi comes off his head into his hand, drapes over the
// thali under his pressing hand, and lifts off in his hand again.
// Voice stem: Google AI Studio Puck (series voice), 52.771 s, 30 fps,
// TOTAL 1583; line timings from timing.json (faster-whisper small,
// char-mapped onto the script — see ../align.py; tail 46/47 mapped).
// Scene changes ONLY at line boundaries (two clause sub-splits: the
// performed quote inside L7, and the crowd clause inside L10).
// ONE set: a village chowk at midday — the black degchi on its stand
// at the centre, a ring of 8 polished thalis on stands around it
// angled like mirrors, the crowd on the south arc, huts/trees north,
// the hook board on the south edge at z=10.5.
// GRADE: Sunny Pop; the cloudy beat blends toward the grey 'cloudy'
// twin by cloudK. Boards/text never graded.
// TWO performed lines (speak.js lip-sync, camera holds the speaker):
// the sarpanch's mocking shout (L7 quote, f562-612) and Kamla's
// closing line (L17, f1388-1493). Every other mouth stays shut.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1583, DECK = 0;
export const SHOTS = [
  { id: 'intro', a: 0, b: 85, light: 'day' },
  { id: 'nofire', a: 86, b: 142, light: 'day' },
  { id: 'belief', a: 143, b: 203, light: 'day' },
  { id: 'bet', a: 204, b: 310, light: 'day' },
  { id: 'ritual', a: 311, b: 448, light: 'day' },
  { id: 'cloudy', a: 449, b: 530, light: 'day' },
  { id: 'mockA', a: 531, b: 561, light: 'day' },
  { id: 'mockB', a: 562, b: 613, light: 'day' },
  { id: 'fixing', a: 614, b: 703, light: 'day' },
  { id: 'sunburst', a: 704, b: 800, light: 'day' },
  { id: 'boilA', a: 801, b: 844, light: 'day' },
  { id: 'boilB', a: 845, b: 888, light: 'day' },
  { id: 'pagdi', a: 889, b: 905, light: 'day' },
  { id: 'pagdiB', a: 906, b: 961, light: 'day' },
  { id: 'half', a: 962, b: 1036, light: 'day' },
  { id: 'reveal', a: 1037, b: 1137, light: 'day' },
  { id: 'focus', a: 1138, b: 1234, light: 'day' },
  { id: 'off', a: 1235, b: 1251, light: 'day' },
  { id: 'offB', a: 1252, b: 1284, light: 'day' },
  { id: 'offC', a: 1285, b: 1326, light: 'day' },
  { id: 'ask', a: 1327, b: 1387, light: 'day' },
  { id: 'line', a: 1388, b: 1493, light: 'day' },
  { id: 'hookboard', a: 1494, b: 1582, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const lerp3 = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)];

// ---------- lights / mood grades ----------
export const LIGHTS = {
  day: { az: 118, el: 38, sky: '#bcd9ea', ground: '#5f7050', hemi: 0.8, sun: '#fff1d4', sunI: 1.24, fog: '#cfe4ef', fogNear: 30, fogFar: 170,
    skyTop: '#3f8fd2', skyHor: '#d7ecf7', sunDisc: '#fff7dd', sunSize: 0.012, sat: 1.12, vig: 0.26, shadowExt: 30, aurora: 0, gain: '#fff4e0',
    waterDeep: '#175d7a', waterShal: '#2f96b4', glint: '#fff3cf' },
  cloudy: { az: 118, el: 38, sky: '#a7bcc7', ground: '#55614e', hemi: 0.6, sun: '#e9e5da', sunI: 0.5, fog: '#bfccd2', fogNear: 24, fogFar: 140,
    skyTop: '#7593a5', skyHor: '#c2ced3', sunDisc: '#f2eee2', sunSize: 0.02, sat: 0.9, vig: 0.3, shadowExt: 30, aurora: 0, gain: '#e9edec',
    waterDeep: '#175d7a', waterShal: '#2f96b4', glint: '#e8e4da' },
};
const mixHex = (a, b, u) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
};
// cloud cover: rolls in over the bet morning (L6), holds through the
// mockery and the fixing, then BREAKS at the sunburst (L9).
export const cloudK = (f) => {
  const up = smooth(ramp(f, 455, 495));
  const dn = smooth(ramp(f, 712, 748));
  return clamp(up * (1 - dn));
};
export const lightFor = (S, f) => {
  const base = LIGHTS[S.light];
  const u = S.light === 'day' ? cloudK(f) : 0;
  if (u <= 0.001) return { ...base };
  const C = LIGHTS.cloudy, out = { ...base };
  for (const k of ['hemi', 'sunI', 'fogNear', 'fogFar', 'sat', 'vig', 'sunSize']) out[k] = lerp(base[k], C[k], u);
  for (const k of ['sky', 'ground', 'sun', 'fog', 'skyTop', 'skyHor', 'sunDisc', 'gain']) out[k] = mixHex(base[k], C[k], u);
  return out;
};

// ---------- staging constants ----------
export const BOARD_POS = [0.8, 2.0, 10.5];
export const SIGN_POS = BOARD_POS;
export const DEGCHI_POS = [0, 0, 0];
export const THALI_POS = Array.from({ length: 8 }, (_, i) => {
  const a = i * Math.PI / 4;
  return [1.7 * Math.sin(a), 1.7 * Math.cos(a)];
});
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

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

// ---------- world tracks (single source of truth) ----------
// steam over the degchi: a daily wisp, DEAD under the clouds, bursting
// back with the sun, halved by the pagdi, surging when it lifts.
export const steamK = track([[0, 0.3], [85, 0.35], [142, 0.4], [310, 0.45], [448, 0.4], [475, 0.06], [703, 0.07], [728, 0.22], [748, 0.9], [772, 1], [961, 1], [988, 0.5], [1036, 0.45], [1137, 0.5], [1234, 0.55], [1264, 0.5], [1290, 1], [1326, 0.95], [1387, 0.85], [1493, 0.8], [1582, 0.6]]);
// sun-focus beams thali -> degchi: faint on a normal morning, GONE
// under cloud, full blaze for the reveal.
export const beamK = track([[0, 0.12], [448, 0.18], [500, 0], [800, 0], [845, 0.3], [1036, 0.35], [1062, 1], [1137, 1], [1234, 0.8], [1290, 0.9], [1387, 0.35], [1493, 0.3], [1582, 0.15]]);
// the pagdi ON thali #1: draped f936-944, lifted off f1264-1272.
export const pagdiK = track([[0, 0], [935, 0], [944, 1], [1263, 1], [1272, 0], [1582, 0]]);
// the 3D degchi exists on its stand from the moment Kamla's hands
// finish setting it down (f58) — before that it lives in her hands.
export const degchiK = (f) => (f >= 58 ? 1 : 0);
// Kamla's two-hand carry of the degchi: held from frame 0, the place
// runs f40-58 with a weight settle after contact.
export const kamlaGrip = gripAt([{ f0: 0, dur: 2, type: 'lift' }, { f0: 40, dur: 18, type: 'place', settle: 9 }]);
// per-thali working tilt (1 = full mirror angle). Kamla SETS #7 and
// #0 during the morning ritual (they start slack), RE-corrects #0
// under the clouds, and #1 sags while the pagdi smothers it.
export const thaliTiltAt = (f) => {
  const t = [1, 1, 1, 1, 1, 1, 1, 1];
  t[7] = f < 340 ? 0.25 : lerp(0.25, 1, smooth(ramp(f, 340, 368)));
  t[0] = f < 403 ? 0.3 : lerp(0.3, 1, smooth(ramp(f, 403, 431)));
  if (f >= 614 && f <= 703) t[0] = f < 646 ? lerp(1, 0.8, smooth(ramp(f, 614, 640))) : lerp(0.8, 1, smooth(ramp(f, 646, 674)));
  t[1] = 1 - 0.45 * pagdiK(f);
  return t;
};

// ---------- movement tracks ----------
// a walk segment -> pos + planted phase (feet plant, no glide)
const leg = (f, a, b, x0, z0, x1, z1, stride = 1.15) => {
  if (f < a || f > b) return null;
  const u = clamp((f - a) / (b - a));
  const x = lerp(x0, x1, u), z = lerp(z0, z1, u);
  return { x, z, ph: stridePh(x0, x, stride), mode: 'stroll' };
};
const stand = (x, z) => ({ x, z, ph: 0, mode: 'stand' });
// Kamla's day: carries the degchi in and sets it down, works the
// thali ring, waits out the clouds, fixes a thali, watches the sun
// return, demonstrates the secret, applauds, answers, and kneels
// before the hook board.
export const kamlaAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'intro': {
      return leg(f, 0, 40, -3.4, 1.0, -1.05, 0.42) || leg(f, 59, 68, -1.05, 0.42, -1.85, 0.75)
        || leg(f, 69, 80, -1.85, 0.75, -1.75, 1.85)
        || (f <= 58 ? stand(-1.05, 0.42) : stand(-1.75, 1.85));
    }
    case 'nofire': return stand(-0.35, -0.95);
    case 'belief': return stand(-1.75, 1.85);
    case 'bet': return stand(-1.8, 1.9);
    case 'ritual': {
      return leg(f, 311, 329, -1.75, 1.85, -1.58, 1.58) || leg(f, 369, 396, -1.58, 1.58, 0.09, 2.22)
        || leg(f, 434, 448, 0.09, 2.22, -0.9, 2.05)
        || (f <= 368 ? stand(-1.58, 1.58) : f <= 433 ? stand(0.09, 2.22) : stand(-0.9, 2.05));
    }
    case 'cloudy': return stand(-0.95, 2.0);
    case 'mockA': case 'mockB': return stand(-1.05, 2.0);
    case 'fixing': return leg(f, 681, 703, 0.09, 2.22, -0.7, 2.1) || stand(0.09, 2.22);
    case 'sunburst': return stand(-0.7, 2.1);
    case 'boilA': case 'boilB': return stand(-0.85, 1.7);
    case 'pagdi': case 'pagdiB': case 'half': return stand(-1.7, 1.95);
    case 'reveal': return stand(0.95, 2.25);
    case 'focus': return stand(-0.9, 2.05);
    case 'off': case 'offB': case 'offC': return stand(-1.0, 1.85);
    case 'ask': return stand(-0.85, 1.6);
    case 'line': return stand(-0.5, 1.45);
    case 'hookboard': return { x: 0.0, z: 13.2, ph: 0, mode: 'kneel' };
    default: return stand(-1.75, 1.85);
  }
};
// The sarpanch: bets from the crowd, mocks, steps in to smother a
// thali with his pagdi, and comes humbly to ask at the end.
export const sarpanchAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'bet': return leg(f, 204, 228, 1.7, 3.5, 1.3, 2.65, 1.2) || stand(1.3, 2.65);
    case 'pagdi': case 'pagdiB': {
      return leg(f, 889, 905, 1.7, 3.5, 1.74, 1.74, 1.2) || leg(f, 946, 961, 1.74, 1.74, 1.9, 2.7, 1.2)
        || stand(1.74, 1.74);
    }
    case 'half': return stand(1.9, 2.7);
    case 'reveal': case 'focus': return stand(1.9, 2.9);
    case 'off': case 'offB': case 'offC': {
      return leg(f, 1235, 1252, 1.8, 3.0, 1.74, 1.74, 1.2) || leg(f, 1291, 1310, 1.74, 1.74, 1.8, 3.0, 1.2)
        || (f <= 1290 ? stand(1.74, 1.74) : stand(1.8, 3.0));
    }
    case 'ask': return leg(f, 1327, 1345, 1.8, 3.0, 0.55, 2.25, 1.2) || stand(0.55, 2.25);
    case 'line': return stand(0.8, 2.35);
    case 'hookboard': return stand(3.6, 12.6);
    default: return stand(1.7, 3.5);
  }
};
// the crowd arc (south side of the chowk)
export const vilAAt = () => stand(-0.9, 3.8);
export const vilBAt = () => stand(-2.3, 4.25);
export const vilCAt = () => stand(3.15, 4.05);
export const vilDAt = () => stand(0.35, 4.55);
export const CROWD_SHOTS = ['belief', 'bet', 'cloudy', 'mockA', 'mockB', 'boilB', 'focus', 'off', 'offB', 'offC', 'ask', 'line'];

// ---------- focus (DOF target per shot) ----------
const FOCUS = {
  intro: (f) => { const k = kamlaAt(f); return [k.x, 1.1, k.z]; },
  nofire: () => [0, 0.62, 0],
  belief: () => [-0.9, 1.58, 3.8],
  bet: (f) => { const s = sarpanchAt(f); return [s.x, 1.55, s.z]; },
  ritual: (f) => { const k = kamlaAt(f); return [k.x, 0.85, k.z]; },
  cloudy: () => [-0.3, 0.9, 0.9],
  mockA: () => [-0.4, 1.5, 3.9],
  mockB: () => [1.7, 1.56, 3.5],
  fixing: () => [0.05, 0.72, 1.85],
  sunburst: (f) => (f < 738 ? [-0.7, 1.5, 2.1] : [0, 0.66, 0]),
  boilA: () => [0, 0.66, 0],
  boilB: () => [-0.75, 1.55, 3.85],
  pagdi: (f) => (f < 906 ? [1.85, 1.4, 2.7] : [1.45, 0.7, 1.35]),
  pagdiB: () => [1.45, 0.7, 1.35],
  half: () => [0.55, 0.6, 0.55],
  reveal: (f) => (f < 1080 ? [0.3, 0.7, 1.6] : [0, 0.64, 0]),
  focus: () => [0, 0.72, 0],
  off: (f) => (f < 1296 ? [1.6, 0.9, 1.8] : [0.2, 1.45, 3.8]),
  offB: () => [1.6, 0.9, 1.8],
  offC: () => [0.2, 1.45, 3.8],
  ask: () => [0.0, 1.48, 1.9],
  line: () => [-0.5, 1.58, 1.45],
  hookboard: () => [0.8, 1.95, 10.5],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: v4 ACTION LEVEL — every shot travels ----------
// Head-width maths (card head ~0.61 m): % = 0.61 / (2*d*tan(fov/2)*0.5625).
// Push-ins are eased key moves concentrated in ~15 frames at action
// starts; tracking raws follow the movement tracks analytically.
const RIG_BY_ID = {
  // intro: FRONT three-quarter tracking as Kamla carries the degchi
  // in — she is BIG from frame 0 (head ~46%), mid-stride, the pot in
  // both hands; the push tightens to ~61% as she reaches the stand.
  intro: { cut: 'hard', raw: (f) => {
    const k = kamlaAt(f), u = smooth(ramp(f, 0, 15));
    const d = lerp(3.3, 2.6, u);
    return { pos: [k.x - d * 0.34, lerp(1.55, 1.38, u), k.z + d * 0.94], look: [k.x + 0.15, 1.05, k.z], fov: lerp(39, 36, u), roll: 0 };
  } },
  // nofire: the INSERT — the black degchi fills ~87% of the width,
  // steam curling off it, and NO fire beneath: the mystery in one shot.
  nofire: { cut: 'hard', raw: keysCam({ keys: [
    { f: 86, pos: [0.35, 1.0, 3.4], look: [-0.1, 0.7, -0.2], fov: 38 },
    { f: 100, pos: [0.2, 0.88, 2.6], look: [-0.08, 0.68, -0.1], fov: 35, ease: 'surge' },
    { f: 142, pos: [0.12, 0.85, 2.35], look: [-0.05, 0.68, 0], fov: 34, ease: 'surge' }] }) },
  // belief: a FAST punch from the crowd group onto the elder's
  // wondering face (38% -> 71% inside 15 frames).
  belief: { cut: 'hard', raw: keysCam({ keys: [
    { f: 143, pos: [-2.2, 1.7, 7.6], look: [-0.7, 1.45, 3.9], fov: 40 },
    { f: 158, pos: [-1.5, 1.66, 6.6], look: [-0.9, 1.58, 3.8], fov: 37, ease: 'surge' },
    { f: 203, pos: [-1.44, 1.64, 6.45], look: [-0.9, 1.58, 3.8], fov: 36, ease: 'surge' }] }) },
  // bet: the sarpanch strides out of the crowd and the camera pushes
  // with him — face 30% -> 69% as he lays the bet, pointing at Kamla.
  bet: { cut: 'hard', raw: keysCam({ keys: [
    { f: 204, pos: [3.6, 1.8, 7.4], look: [1.55, 1.4, 3.1], fov: 41 },
    { f: 232, pos: [2.2, 1.62, 5.4], look: [1.32, 1.55, 2.68], fov: 36, ease: 'smooth' },
    { f: 262, pos: [1.85, 1.6, 5.05], look: [1.3, 1.58, 2.65], fov: 34, ease: 'surge' },
    { f: 310, pos: [1.8, 1.58, 4.95], look: [1.3, 1.58, 2.65], fov: 34, ease: 'surge' }] }) },
  // ritual: a low arc tracking Kamla's hands around the south thalis
  // — each tilt happens under her hand, centre frame.
  ritual: { cut: 'hard', raw: keysCam({ keys: [
    { f: 311, pos: [2.3, 1.25, 0.15], look: [-1.46, 0.95, 1.46], fov: 40 },
    { f: 356, pos: [1.5, 1.3, -0.75], look: [-1.2, 0.92, 1.6], fov: 41, ease: 'smooth' },
    { f: 380, pos: [-0.5, 1.32, -1.5], look: [-0.5, 0.95, 1.95], fov: 40, ease: 'smooth' },
    { f: 404, pos: [-2.05, 1.2, -0.95], look: [0.06, 1.0, 2.04], fov: 40, ease: 'smooth' },
    { f: 448, pos: [-2.23, 1.15, -1.12], look: [0.06, 1.0, 2.04], fov: 41, ease: 'surge' }] }) },
  // cloudy: the camera PULLS BACK fast as the light dies — Kamla, the
  // cold pot and the waiting crowd in one grey wide.
  cloudy: { cut: 'hard', raw: keysCam({ keys: [
    { f: 449, pos: [-0.7, 1.5, 4.6], look: [-0.3, 1.0, 1.2], fov: 38 },
    { f: 490, pos: [-1.3, 1.9, 7.8], look: [-0.2, 0.9, 0.8], fov: 40, ease: 'surge' },
    { f: 530, pos: [-1.5, 2.0, 8.6], look: [-0.1, 0.9, 0.6], fov: 41, ease: 'surge' }] }) },
  // mockA: the crowd cracks up (narration tag) — a fast lateral slide.
  mockA: { cut: 'hard', raw: keysCam({ keys: [
    { f: 531, pos: [-2.6, 1.66, 8.2], look: [-0.5, 1.45, 3.9], fov: 40 },
    { f: 561, pos: [-1.4, 1.6, 7.7], look: [0.2, 1.45, 3.8], fov: 38, ease: 'surge' }] }) },
  // mockB: WHIP onto the sarpanch as the quote starts — he PERFORMS
  // the shout close (face ~70%), gesturing, the crowd laughing behind.
  mockB: { cut: 'whip', blend: 6, raw: keysCam({ keys: [
    { f: 562, pos: [2.35, 1.62, 5.95], look: [1.7, 1.56, 3.5], fov: 35 },
    { f: 580, pos: [2.3, 1.6, 5.8], look: [1.7, 1.57, 3.5], fov: 34, ease: 'surge' },
    { f: 613, pos: [2.28, 1.6, 5.7], look: [1.7, 1.57, 3.5], fov: 34, ease: 'surge' }] }) },
  // fixing: low front three-quarter on Kamla's hands at thali #0 —
  // her hand rides the rim while the tilt corrects; she glances up.
  fixing: { cut: 'hard', raw: keysCam({ keys: [
    { f: 614, pos: [-2.0, 1.22, -0.9], look: [0.06, 1.0, 2.04], fov: 40 },
    { f: 660, pos: [-2.18, 1.17, -1.05], look: [0.06, 1.0, 2.04], fov: 41, ease: 'smooth' },
    { f: 703, pos: [-2.23, 1.15, -1.12], look: [0.06, 1.0, 2.04], fov: 41, ease: 'surge' }] }) },
  // sunburst: starts on Kamla's upturned face as the clouds break,
  // then DIVES to the degchi as the steam BURSTS (KICK at f748) and
  // pushes to 79% on the pot.
  sunburst: { cut: 'hard', raw: keysCam({ keys: [
    { f: 704, pos: [-1.15, 1.6, 4.9], look: [-0.7, 1.5, 2.1], fov: 38 },
    { f: 738, pos: [-0.9, 1.35, 4.3], look: [-0.35, 1.0, 0.9], fov: 37, ease: 'smooth' },
    { f: 752, pos: [-0.45, 0.95, 2.6], look: [0, 0.66, 0], fov: 35, ease: 'surge' },
    { f: 800, pos: [-0.3, 0.9, 2.2], look: [0, 0.68, 0], fov: 34, ease: 'surge' }] }) },
  // boilA: the pot at full boil fills the frame — steam and bubbles.
  boilA: { cut: 'hard', raw: keysCam({ keys: [
    { f: 801, pos: [-0.3, 0.92, 2.3], look: [0, 0.66, 0], fov: 35 },
    { f: 844, pos: [-0.22, 0.88, 2.0], look: [0, 0.68, 0], fov: 34, ease: 'surge' }] }) },
  // boilB: clause cut — a 15-frame PUNCH onto the crowd's shocked
  // faces (38% -> 71%): mouths open all down the arc.
  boilB: { cut: 'hard', raw: keysCam({ keys: [
    { f: 845, pos: [-1.75, 1.66, 7.5], look: [-0.45, 1.5, 3.9], fov: 39 },
    { f: 860, pos: [-1.3, 1.6, 6.3], look: [-0.55, 1.55, 3.85], fov: 35, ease: 'surge' },
    { f: 888, pos: [-1.24, 1.59, 6.15], look: [-0.55, 1.55, 3.85], fov: 34, ease: 'surge' }] }) },
  // pagdi: tracks the sarpanch in from the crowd and lands front
  // three-quarter CLOSE on the drape — his hand presses the cloth
  // onto the thali, centre frame (KICK at the slap, f940).
  pagdi: { cut: 'hard', raw: keysCam({ keys: [
    { f: 889, pos: [3.4, 1.7, 6.8], look: [1.8, 1.35, 3.1], fov: 40 },
    { f: 905, pos: [3.05, 1.55, 5.1], look: [1.85, 1.3, 2.6], fov: 38, ease: 'surge' }] }) },
  // pagdiB: the drape, from the north — he and thali #1 solved into
  // one frame (head upper, thali lower, hand on the cloth).
  pagdiB: { cut: 'hard', raw: keysCam({ keys: [
    { f: 906, pos: [0.95, 1.22, -1.95], look: [1.6, 0.93, 1.62], fov: 41 },
    { f: 940, pos: [0.78, 1.15, -2.22], look: [1.59, 0.9, 1.59], fov: 41, ease: 'surge' },
    { f: 961, pos: [0.85, 1.2, -2.0], look: [1.6, 0.95, 1.65], fov: 40, ease: 'surge' }] }) },
  // half: the covered thali and the degchi in one frame — the steam
  // between them visibly THIN. Front three-quarter push.
  half: { cut: 'hard', raw: keysCam({ keys: [
    { f: 962, pos: [2.2, 1.05, 3.6], look: [0.7, 0.6, 0.7], fov: 37 },
    { f: 990, pos: [1.7, 0.95, 3.0], look: [0.55, 0.6, 0.55], fov: 35, ease: 'surge' },
    { f: 1036, pos: [1.55, 0.92, 2.8], look: [0.55, 0.6, 0.55], fov: 34, ease: 'surge' }] }) },
  // reveal: the camera rides thali #0's beam down to the degchi —
  // every beam in the ring converging on the black pot.
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1037, pos: [1.4, 1.3, 4.6], look: [0.3, 0.7, 1.6], fov: 38 },
    { f: 1080, pos: [0.7, 0.95, 3.1], look: [0.1, 0.62, 0.6], fov: 36, ease: 'surge' },
    { f: 1137, pos: [0.45, 0.85, 2.3], look: [0, 0.64, 0], fov: 35, ease: 'surge' }] }) },
  // focus: a travelling arc around the blazing ring — dozens of
  // suns landing on one pot; the crowd in awe behind.
  focus: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1138, pos: [-3.4, 1.7, 5.6], look: [0, 0.7, 0.3], fov: 40 },
    { f: 1186, pos: [0.2, 1.55, 6.0], look: [0, 0.72, 0], fov: 38, ease: 'smooth' },
    { f: 1234, pos: [3.2, 1.7, 5.4], look: [0.1, 0.7, 0.2], fov: 40, ease: 'surge' }] }) },
  // off: stays on the sarpanch's hands for the lift, then slides
  // FAST to the applauding crowd as the steam surges (KICK f1268).
  off: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1235, pos: [3.0, 1.45, 5.2], look: [1.75, 0.95, 1.85], fov: 37 },
    { f: 1251, pos: [2.8, 1.4, 4.7], look: [1.8, 0.98, 2.0], fov: 36, ease: 'surge' }] }) },
  offB: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1252, pos: [0.85, 1.18, -1.95], look: [1.58, 0.92, 1.9], fov: 40 },
    { f: 1272, pos: [0.74, 1.15, -1.86], look: [1.55, 0.9, 1.95], fov: 40, ease: 'surge' },
    { f: 1284, pos: [0.8, 1.18, -1.8], look: [1.58, 0.92, 1.95], fov: 40, ease: 'surge' }] }) },
  offC: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1285, pos: [0.7, 1.62, 7.8], look: [0.25, 1.42, 3.65], fov: 38 },
    { f: 1326, pos: [0.2, 1.58, 7.2], look: [0.3, 1.42, 3.7], fov: 37, ease: 'surge' }] }) },
  // ask: a two-shot that pushes in as the sarpanch bows his head
  // and asks — Kamla turning to answer.
  ask: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1327, pos: [1.7, 1.66, 5.6], look: [0.1, 1.45, 1.9], fov: 39 },
    { f: 1360, pos: [1.35, 1.6, 4.9], look: [-0.05, 1.48, 1.85], fov: 36, ease: 'surge' },
    { f: 1387, pos: [1.25, 1.58, 4.7], look: [-0.05, 1.48, 1.85], fov: 35, ease: 'surge' }] }) },
  // line: THE LINE, performed — push-in on Kamla as she answers,
  // face 51% -> 69%; the sarpanch listens at the edge, mouth shut.
  line: { cut: 'hard', raw: pushInCam({ subject: () => [-0.5, 0, 1.45], a: 1388, b: 1493, d0: 3.3, d1: 2.5, h0: 1.62, h1: 1.57, lookOff: [0, 1.58, 0], fov0: 37, fov1: 34,
    dir: () => [0.3, 0.95] }) },
  // hookboard: the film ends on a CHARACTER BEAT — Kamla kneels in
  // the foreground pointing up at the hook board (86% of frame
  // width, whole panel inside with margins, full opacity to the end).
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1494, pos: [1.25, 2.05, 20.4], look: [0.8, 1.92, 10.5], fov: 47 },
    { f: 1582, pos: [1.15, 1.98, 19.6], look: [0.8, 1.95, 10.5], fov: 46, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 748, a: 0.3 }, { f: 940, a: 0.13 }, { f: 1268, a: 0.13 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { intro: 1.8, nofire: 2.6, belief: 2.6, bet: 2.6, ritual: 2.0, cloudy: 1.6, mockA: 2.2, mockB: 3.0, fixing: 2.4, sunburst: 2.2, boilA: 2.8, boilB: 2.6, pagdi: 2.2, pagdiB: 2.2, half: 2.4, reveal: 2.4, focus: 1.6, off: 2.2, offB: 2.2, offC: 2.2, ask: 2.6, line: 3.2, hookboard: 1.3 };
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
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1499, 1523)) : 0,
    steamK: steamK(f),
    cloudK: cloudK(f),
    beamK: beamK(f),
    pagdiK: pagdiK(f),
    degchiK: degchiK(f),
    lampK: 0,
  };
};
export const fxProfileAt = (f) => {
  const bk = beamK(f);
  const glint = bk * (0.55 + 0.45 * Math.pow(Math.abs(Math.sin(f * 0.35)), 3));
  return { moteRate: 0.05, blastRate: 0, sparkRate: glint, steamRate: steamK(f) * 2.4, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours
// flat and saturated (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  kamla: { jacket: '#8e2434', dress: '#c2263f', sash: '#e8b93c', pants: '#7a1f2b', boots: '#3a2410', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  sarpanch: { jacket: '#e8dcc0', pants: '#8a6f4d', boots: '#2a1c10', hat: 'turban', turban: '#e2543e', skin: '#fbf7ef', moustache: '#2a201a' },
  sarpanchBare: { jacket: '#e8dcc0', pants: '#8a6f4d', boots: '#2a1c10', hat: 'hair', hair: '#241a12', turban: '#e2543e', skin: '#fbf7ef', moustache: '#2a201a' },
  vilA: { jacket: '#cfc8b8', pants: '#5a5348', boots: '#241a12', hat: 'hair', hair: '#e9e7e1', skin: '#fbf7ef', moustache: '#e9e7e1', bigMoustache: true },
  vilB: { jacket: '#7a2c4c', dress: '#a03a5e', pants: '#4a2436', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  vilC: { jacket: '#2f6db3', pants: '#33424a', boots: '#1c1712', hat: 'cap', cap: '#e8b93c', skin: '#fbf7ef' },
  vilD: { jacket: '#4a7d3a', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef', moustache: '#2a201a' },
};
// the elder's round glasses, drawn over the face card (card space
// 600x1000; head centre from T.headCenter(seed), eyes ~ +/-46 around 300)
const drawGlasses = (p) => {
  const hc = T.headCenter(71);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};

// ---------- HEAD + BODY PERFORMANCE (the animation upgrade) ----------
// Emotion morphs at story beats (body.js emoTrack).
const emoKamla = emoTrack(T.faceP, 'smile', [
  [86, 'wonder', 8], [143, 'smile', 8], [204, 'nervous', 8], [311, 'determined', 8], [449, 'sad', 9],
  [614, 'determined', 8], [704, 'wonder', 8], [801, 'proud', 8], [889, 'nervous', 8], [962, 'sad', 8],
  [1037, 'wonder', 8], [1138, 'proud', 8], [1235, 'smile', 8], [1388, 'proud', 8], [1494, 'grin', 8],
]);
const emoSarp = emoTrack(T.faceP, 'smug', [
  [204, 'laugh', 8], [311, 'smug', 8], [531, 'laugh', 7], [704, 'smug', 8], [845, 'shock', 6],
  [889, 'smug', 8], [962, 'proud', 8], [1037, 'wonder', 8], [1235, 'nervous', 8], [1290, 'relief', 8],
  [1327, 'sad', 9], [1388, 'relief', 8], [1494, 'smile', 8],
]);
const emoVilA = emoTrack(T.faceP, 'wonder', [
  [204, 'thinking', 8], [449, 'smile', 8], [531, 'laugh', 7], [704, 'smile', 8], [845, 'shock', 6],
  [1037, 'wonder', 8], [1235, 'laugh', 7], [1327, 'smile', 8],
]);
const emoVilB = emoTrack(T.faceP, 'smile', [
  [531, 'laugh', 7], [845, 'shock', 6], [1037, 'wonder', 8], [1235, 'grin', 8],
]);
const emoVilC = emoTrack(T.faceP, 'grin', [
  [531, 'laugh', 7], [845, 'shock', 6], [1235, 'grin', 8],
]);
const emoVilD = emoTrack(T.faceP, 'smile', [
  [531, 'laugh', 7], [845, 'shock', 6], [1235, 'smile', 8],
]);
// Continuous life per character (body.js lifeAt): breathing phase,
// weight-shift tilt, micro sway — nobody stands like a post.
const lifeKamla = lifeAt({ seed: 21 }), lifeSarp = lifeAt({ seed: 51 }), lifeVilA = lifeAt({ seed: 71 }),
  lifeVilB = lifeAt({ seed: 81 }), lifeVilC = lifeAt({ seed: 61 }), lifeVilD = lifeAt({ seed: 91 });
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
// head/body opts fragment: life (breath/tilt/sway) + directed gaze.
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
const noBlush = (P) => { P.blush = 0; P.openL = Math.min(1, (P.openL ?? 0.85) * 1.45); P.openR = Math.min(1, (P.openR ?? 0.85) * 1.45); return P; };
// a working hand: rises, lands ON the rim, holds while the tilt
// changes, lifts away. Returns null outside [a, b].
const kamlaPose = poseWindows([
  { a: 332, b: 370, mode: 'kneel', inF: 8, outF: 8 },
  { a: 399, b: 435, mode: 'kneel', inF: 8, outF: 8 },
  { a: 608, b: 680, mode: 'kneel', inF: 8, outF: 8 },
]);
const pressK = (f, a, b, kOn = 0.88, kOff = 0.3) => {
  if (f < a || f > b) return null;
  const up = smooth(ramp(f, a, a + 10)), dn = smooth(ramp(f, b - 8, b));
  return q(kOff + (kOn - kOff) * Math.min(up, 1 - dn), 2);
};
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// dialogue gesture: the free hand talks with the voice (stresses on
// the content words: आसमान/वाली/छुट्टी — आग/मैं/धूप/इकट्ठा).
const gestSarp = gestureAt([{ a: 562, b: 612, beats: [573, 584, 595], base: 0.4, amp: 0.2 }]);
const gestKamla = gestureAt([{ a: 1388, b: 1493, beats: [1400, 1431, 1450, 1469], base: 0.42, amp: 0.15 }]);

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: extra.r || 0.32, ground: extra.ground ?? (extra.y || 0),
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground ?? (extra.y || 0), tint, ...extra }) });
  const k = kamlaAt(f), s = sarpanchAt(f);
  const KP = noBlush(emoKamla.at(f)), SP = noBlush(emoSarp.at(f));
  const AP = noBlush(emoVilA.at(f)), BP2 = noBlush(emoVilB.at(f)), CP = noBlush(emoVilC.at(f)), DP = noBlush(emoVilD.at(f));
  const laughBob = (seed) => 1.7 * Math.abs(Math.sin(f * 0.45 + seed));
  const crowd = (laughing = false, board = false) => {
    const P = board ? { A: [-4.9, 11.9], B: [-3.3, 12.3], C: [5.2, 12.2], D: [-1.8, 12.5] }
      : { A: [vilAAt().x, vilAAt().z], B: [vilBAt().x, vilBAt().z], C: [vilCAt().x, vilCAt().z], D: [vilDAt().x, vilDAt().z] };
    std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
      ...H2(lifeVilA, f, 71, { ht: -2 + (laughing ? laughBob(71) : 0), look: -0.2, lookY: -0.1, facing: -0.2 }) }, P.A[0], P.A[1], { yaw: -0.2, overlay: drawGlasses });
    std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP2, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
      ...H2(lifeVilB, f, 81, { ht: -2 + (laughing ? laughBob(81) : 0), look: 0.25, lookY: -0.1, facing: 0.25 }) }, P.B[0], P.B[1], { yaw: 0.25 });
    std('vilC', OUTFITS.vilC, { expr: 'grin', exprP: CP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
      ...H2(lifeVilC, f, 61, { ht: -2 + (laughing ? laughBob(61) : 0), look: 0, lookY: -0.1, facing: 0 }) }, P.C[0], P.C[1], { yaw: 0 });
    std('vilD', OUTFITS.vilD, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 91), seed: 91,
      ...H2(lifeVilD, f, 91, { ht: -2 + (laughing ? laughBob(91) : 0), look: -0.3, lookY: -0.1, facing: -0.3 }) }, P.D[0], P.D[1], { yaw: -0.3 });
  };
  const kamlaStd = (opts, extra = {}) => std('kamla', OUTFITS.kamla, { expr: 'smile', exprP: KP, blink: blinkAt(f, 21), seed: 21, ...opts }, k.x, k.z, { y: 0, ground: 0, ...extra });
  const sarpStd = (opts, extra = {}) => std('sarpanch', (extra.bare ? OUTFITS.sarpanchBare : OUTFITS.sarpanch),
    { expr: 'smile', exprP: SP, blink: blinkAt(f, 51), seed: 51, ...opts }, s.x, s.z, { y: 0, ground: 0, ...extra });

  switch (S.id) {
    case 'intro': {
      // THE CARRY: two hands on the degchi (toon v6 carry), the pot
      // lowering with weight f40-58 and a settle dip as it lands; she
      // then steps back empty-handed.
      const g = kamlaGrip(f);
      const carrying = f <= 58;
      kamlaStd({ mode: k.mode, phase: q(k.ph, 2), carry: carrying ? q(g.k, 2) : null,
        ...H2(lifeKamla, f, 21, { ht: f >= 40 && f <= 62 ? 3 : -1.5, look: 0.2, lookY: f >= 40 && f <= 62 ? 0.5 : 0.05, facing: 0.2, squash: g.squash }) },
        { yaw: 0.15 });
      break;
    }
    case 'nofire': {
      // behind the pot, gazing down at the steam that should not be
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: 2.5, look: 0.1, lookY: 0.4, facing: 0.1 }) }, { yaw: 0.05 });
      break;
    }
    case 'belief': {
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: -1.5, look: 0.3, lookY: 0, facing: 0.3 }) }, { yaw: 0.25 });
      crowd();
      break;
    }
    case 'bet': {
      // he strides out and points the bet at her; she stands her ground
      const swing = f >= 232 ? q(kf([[232, 0.5], [244, 0.12], [262, 0.2], [280, 0.45], [310, 0.45]], f), 2) : 0.5;
      sarpStd({ mode: s.mode, phase: q(s.ph, 2), prop: f >= 232 ? ['point', swing] : null,
        ...H2(lifeSarp, f, 51, { ht: -2.5, look: -0.45, lookY: -0.15, facing: -0.4 }) }, { yaw: -0.35 });
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: -1, look: 0.5, lookY: 0, facing: 0.4 }) }, { yaw: 0.35 });
      crowd();
      break;
    }
    case 'ritual': {
      // THE RITUAL, hands on: her right hand rides thali #7's rim
      // while its tilt rises (f330-368), then thali #0's (f397-433).
      let prop = null, propL = null;
      const p7 = pressK(f, 330, 368), p0 = pressK(f, 397, 433);
      if (p7 !== null) prop = ['push', p7]; else if (p0 !== null) propL = ['push', p0];
      const working = prop !== null || propL !== null;
      const pose = kamlaPose(f);
      kamlaStd({ mode: pose.mode !== 'stand' ? pose.mode : k.mode, squash: pose.squash, phase: q(k.ph, 2), prop, propL,
        ...H2(lifeKamla, f, 21, { ht: working ? 3.5 : -1.5, look: working ? 0.45 : 0.15, lookY: working ? 0.55 : 0.05, facing: working ? 0.4 : 0.15 }) },
        { yaw: working ? 0.35 : 0.1 });
      break;
    }
    case 'cloudy': {
      // grey wide: Kamla under the dead sky, the crowd waiting
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: -3, look: 0.1, lookY: -0.55, facing: 0.1 }) }, { yaw: 0.05 });
      sarpStd({ mode: 'stand', ...H2(lifeSarp, f, 51, { ht: -2, look: -0.3, lookY: -0.2, facing: -0.3 }) }, { yaw: -0.25 });
      crowd();
      break;
    }
    case 'mockA': {
      // the whole chowk cracks up (narration tag — mouths are faces
      // only; the PERFORMED shout gets its own shot)
      crowd(true);
      sarpStd({ mode: 'stand', ...H2(lifeSarp, f, 51, { ht: -2 + laughBob(51), look: -0.3, lookY: -0.15, facing: -0.3 }) }, { yaw: -0.25 });
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: 2, look: 0.45, lookY: 0.15, facing: 0.4 }) }, { yaw: 0.35 });
      break;
    }
    case 'mockB': {
      // THE SHOUT, performed: his mouth is driven by the stem itself
      // (speak.js); his free hand gestures with the voice; the crowd
      // laughs behind him, mouths shut; Kamla takes it, silent.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...SP, cheek: 0 }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('sarpanch', OUTFITS.sarpanch, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        prop: ['point', q(gestSarp(f).k, 2)],
        headTilt: q((sp.nod || 0) + micro(f, 51) - 2, 1), look: q(-0.3, 2), lookY: q(-0.1, 2), facing: q(-0.3, 2),
        squash: 0, tilt: q(lifeSarp(f).tilt + 1.2 * Math.sin(f * 0.11), 1), breath: Math.round(lifeSarp(f).breath / 6) * 6 },
        s.x, s.z, { y: 0, ground: 0, yaw: -0.25 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...H2(lifeVilA, f, 71, { ht: -2 + laughBob(71), look: 0.3, lookY: -0.1, facing: 0.3 }) }, vilAAt().x, vilAAt().z, { yaw: 0.25, overlay: drawGlasses });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP2, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...H2(lifeVilB, f, 81, { ht: -2 + laughBob(81), look: 0.4, lookY: -0.1, facing: 0.35 }) }, vilBAt().x, vilBAt().z, { yaw: 0.3 });
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: 2, look: 0.5, lookY: 0.1, facing: 0.45 }) }, { yaw: 0.4 });
      break;
    }
    case 'fixing': {
      // under the clouds she re-angles thali #0 — hand ON the rim
      // while the tilt dips and recovers — glancing up at the sky.
      const pk = pressK(f, 610, 678);
      const pose = kamlaPose(f);
      kamlaStd({ mode: pose.mode !== 'stand' ? pose.mode : k.mode, squash: pose.squash, phase: q(k.ph, 2), propL: pk !== null ? ['push', pk] : null,
        ...H2(lifeKamla, f, 21, { ht: pk !== null ? 3.5 : -2, look: 0.35, lookY: q(kf([[614, 0.5], [655, 0.5], [668, -0.55], [690, -0.55], [703, 0.1]], f), 2), facing: 0.3 }) },
        { yaw: 0.3 });
      break;
    }
    case 'sunburst': {
      // face upturned to the breaking clouds, then turning to the pot
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: f < 745 ? -3.5 : -1.5, look: 0.15, lookY: f < 745 ? -0.6 : 0.25, facing: 0.15 }) }, { yaw: 0.1 });
      break;
    }
    case 'boilA': break; // the pot alone, at full boil
    case 'boilB': {
      // mouths open all down the arc
      crowd();
      sarpStd({ mode: 'stand', ...H2(lifeSarp, f, 51, { ht: -3, look: -0.3, lookY: -0.1, facing: -0.3 }) }, { yaw: -0.25 });
      kamlaStd({ mode: 'stand', prop: ['point', 0.55], ...H2(lifeKamla, f, 21, { ht: -2, look: 0.3, lookY: 0, facing: 0.3 }) }, { yaw: 0.25 });
      break;
    }
    case 'pagdi': case 'pagdiB': {
      // THE PAGDI BEAT, all grips: he walks in wearing it, takes it
      // off INTO his hand (f906-918, turban gone from f913), bends
      // and drapes it over thali #1 — hand pressing down as the 3D
      // cloth settles (f919-945) — then steps back bare-headed.
      const bare = f >= 913;
      let prop = null;
      if (f >= 906 && f < 913) prop = ['point', q(kf([[906, 0.45], [913, 0.08]], f), 2)];
      else if (f >= 913 && f < 919) prop = ['cloth', q(kf([[913, 0.08], [919, 0.3]], f), 2)];
      else if (f >= 919 && f < 939) prop = ['cloth', q(kf([[919, 0.3], [939, 0.92]], f), 2)];
      else if (f >= 939 && f <= 950) prop = ['point', q(kf([[939, 0.92], [945, 0.9], [950, 0.5]], f), 2)];
      sarpStd({ mode: s.mode, phase: q(s.ph, 2), prop,
        ...H2(lifeSarp, f, 51, { ht: f >= 919 && f <= 950 ? 3.5 : -2, look: -0.2, lookY: f >= 919 && f <= 950 ? 0.55 : -0.05, facing: -0.2,
          tilt: q(kf([[919, 0], [930, 5], [945, 5], [955, 0]], f), 1) }) }, { yaw: -0.15, bare });
      kamlaStd({ mode: 'stand', prop: ['point', 0.45], ...H2(lifeKamla, f, 21, { ht: 1, look: 0.55, lookY: 0.1, facing: 0.45 }) }, { yaw: 0.4 });
      break;
    }
    case 'half': {
      // he stands proud by the smothered thali; she watches the steam die
      sarpStd({ mode: 'stand', prop: ['point', 0.4], ...H2(lifeSarp, f, 51, { ht: -2.5, look: -0.3, lookY: -0.1, facing: -0.3 }) }, { yaw: -0.25, bare: true });
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: 2, look: 0.5, lookY: 0.25, facing: 0.45 }) }, { yaw: 0.4 });
      break;
    }
    case 'reveal': {
      // she shows it: point at the thali, then along its beam to the pot
      const atPot = f >= 1090;
      kamlaStd({ mode: 'stand', prop: ['point', atPot ? 0.35 : 0.3],
        ...H2(lifeKamla, f, 21, { ht: 1.5, look: atPot ? -0.45 : -0.2, lookY: 0.45, facing: atPot ? -0.4 : -0.2 }) }, { yaw: atPot ? -0.35 : -0.15 });
      sarpStd({ mode: 'stand', ...H2(lifeSarp, f, 51, { ht: -2, look: -0.5, lookY: 0.2, facing: -0.45 }) }, { yaw: -0.4, bare: true });
      break;
    }
    case 'focus': {
      kamlaStd({ mode: 'stand', prop: ['point', 0.5], ...H2(lifeKamla, f, 21, { ht: -2, look: 0.2, lookY: 0, facing: 0.2 }) }, { yaw: 0.15 });
      sarpStd({ mode: 'stand', ...H2(lifeSarp, f, 51, { ht: -2.5, look: -0.4, lookY: 0.1, facing: -0.35 }) }, { yaw: -0.3, bare: true });
      crowd();
      break;
    }
    case 'off': case 'offB': case 'offC': {
      // THE LIFT-OFF: his hand goes down bare, grips the cloth
      // (f1253-1267), lifts it away IN his hand (f1268-1283) and the
      // pagdi is back on his head by f1284 — while the crowd erupts.
      let prop = null;
      if (f >= 1253 && f < 1268) prop = ['point', q(kf([[1253, 0.4], [1266, 0.88]], f), 2)];
      else if (f >= 1268 && f < 1284) prop = ['cloth', q(kf([[1268, 0.85], [1283, 0.12]], f), 2)];
      else if (f >= 1284 && f <= 1290) prop = ['point', q(kf([[1284, 0.1], [1290, 0.45]], f), 2)];
      sarpStd({ mode: s.mode, phase: q(s.ph, 2), prop,
        ...H2(lifeSarp, f, 51, { ht: f >= 1253 && f <= 1283 ? 3 : -2, look: -0.2, lookY: f >= 1253 && f <= 1283 ? 0.5 : -0.05, facing: -0.2,
          tilt: q(kf([[1253, 0], [1262, 4], [1272, 4], [1282, 0]], f), 1) }) }, { yaw: -0.15, bare: f < 1284 });
      // applause from the surge (f1268): waving arms + bobbing heads
      const clap = f >= 1268;
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: clap ? ['point', 0.3] : null,
        ...H2(lifeVilA, f, 71, { ht: -2 + (clap ? laughBob(71) : 0), look: -0.2, lookY: -0.1, facing: -0.2 }) }, vilAAt().x, vilAAt().z, { yaw: -0.2, overlay: drawGlasses });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP2, mode: 'stand', blink: blinkAt(f, 81), seed: 81, wave: clap ? q(Math.sin(f * 0.45 + 81), 2) : undefined,
        ...H2(lifeVilB, f, 81, { ht: -2 + (clap ? laughBob(81) : 0), look: 0.25, lookY: -0.1, facing: 0.25 }) }, vilBAt().x, vilBAt().z, { yaw: 0.25 });
      std('vilC', OUTFITS.vilC, { expr: 'grin', exprP: CP, mode: 'stand', blink: blinkAt(f, 61), seed: 61, wave: clap ? q(Math.sin(f * 0.45 + 61), 2) : undefined,
        ...H2(lifeVilC, f, 61, { ht: -2 + (clap ? laughBob(61) : 0), look: 0, lookY: -0.1, facing: 0 }) }, vilCAt().x, vilCAt().z, { yaw: 0 });
      std('vilD', OUTFITS.vilD, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: clap ? ['point', 0.35] : null,
        ...H2(lifeVilD, f, 91, { ht: -2 + (clap ? laughBob(91) : 0), look: -0.3, lookY: -0.1, facing: -0.3 }) }, vilDAt().x, vilDAt().z, { yaw: -0.3 });
      kamlaStd({ mode: 'stand', wave: clap ? q(Math.sin(f * 0.45 + 21), 2) : undefined,
        ...H2(lifeKamla, f, 21, { ht: -2 + (clap ? laughBob(21) : 0), look: 0.4, lookY: 0, facing: 0.35 }) }, { yaw: 0.3 });
      break;
    }
    case 'ask': {
      // humbled: he bows his head and folds his hands low to ask
      sarpStd({ mode: s.mode, phase: q(s.ph, 2), prop: f >= 1346 ? ['point', 0.55] : null,
        ...H2(lifeSarp, f, 51, { ht: q(kf([[1345, -2], [1355, 3], [1368, 3], [1378, -1]], f), 1), look: 0.4, lookY: 0.2, facing: 0.35,
          tilt: q(kf([[1345, 0], [1355, 6], [1368, 6], [1378, 0]], f), 1) }) }, { yaw: 0.3 });
      kamlaStd({ mode: 'stand', ...H2(lifeKamla, f, 21, { ht: -1.5, look: 0.5, lookY: 0, facing: 0.4 }) }, { yaw: 0.35 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...H2(lifeVilA, f, 71, { ht: -2, look: -0.2, lookY: -0.1, facing: -0.2 }) }, vilAAt().x, vilAAt().z, { yaw: -0.2, overlay: drawGlasses });
      std('vilD', OUTFITS.vilD, { expr: 'smile', exprP: DP, mode: 'stand', blink: blinkAt(f, 91), seed: 91,
        ...H2(lifeVilD, f, 91, { ht: -2, look: -0.3, lookY: -0.1, facing: -0.3 }) }, vilDAt().x, vilDAt().z, { yaw: -0.3 });
      break;
    }
    case 'line': {
      // THE LINE, performed: Kamla's mouth is driven by the stem;
      // her LEFT hand gestures with the voice (body.js gestureAt);
      // her body sways on lifeAt; the sarpanch listens, mouth shut.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...KP, cheek: 0 }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('kamla', OUTFITS.kamla, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 21), seed: 21,
        propL: ['point', q(gestKamla(f).k, 2)],
        headTilt: q((sp.nod || 0) + micro(f, 21) - 1, 1), look: q(0.05, 2), lookY: q(0.02, 2), facing: q(0.05, 2),
        squash: 0, tilt: q(lifeKamla(f).tilt + lifeKamla(f).sway, 1), breath: Math.round(lifeKamla(f).breath / 6) * 6 },
        k.x, k.z, { y: 0, ground: 0, yaw: 0.05 });
      sarpStd({ mode: 'stand', ...H2(lifeSarp, f, 51, { ht: -1.5 + nodAt(f, 1440, 10, 0.5), look: 0.45, lookY: 0.05, facing: 0.4 }) }, { yaw: 0.35 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: AP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...H2(lifeVilA, f, 71, { ht: -1.5, look: -0.35, lookY: 0, facing: -0.3 }) }, vilAAt().x, vilAAt().z, { yaw: -0.3, overlay: drawGlasses });
      break;
    }
    case 'hookboard': {
      // the film ends on a CHARACTER BEAT — Kamla kneels in the
      // foreground pointing up at the hook board as it rises behind
      // her; her head stays below the board's text band.
      kamlaStd({ mode: 'kneel', prop: ['point', 0.32], exprP: KP,
        ...H2(lifeKamla, f, 21, { ht: -2.5, look: 0.45, lookY: -0.35, facing: 0.45 }) }, { yaw: 0.5 });
      sarpStd({ mode: 'stand', ...H2(lifeSarp, f, 51, { ht: -2.5, look: -0.4, lookY: -0.4, facing: -0.4 }) }, { yaw: -0.35 });
      crowd(false, true);
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.circle(-13, -4, 0.55, { h: 4.5, id: 'treeW' }),
  SOL.circle(13, -5, 0.55, { h: 4.5, id: 'treeE' }),
  SOL.circle(-8, -15.5, 0.5, { h: 4, id: 'treeN' }),
  SOL.aabb(-11, -6.8, -19, -15.8, { h: 3, id: 'hutN1' }),
  SOL.aabb(5.5, 9.7, -19, -15.8, { h: 3, id: 'hutN2' }),
  SOL.aabb(-13.5, -9.3, 15.5, 19.5, { h: 3, id: 'hutS1' }),
  SOL.aabb(9, 13.2, 15.5, 19.5, { h: 3, id: 'hutS2' }),
  SOL.circle(-6.5, -6, 0.85, { h: 1.1, id: 'well' }),
  SOL.circle(-0.85, 10.58, 0.07, { h: 2, id: 'boardPostL' }),
  SOL.circle(2.45, 10.58, 0.07, { h: 2, id: 'boardPostR' }),
  SOL.circle(0, 0, 0.42, { h: 0.45, id: 'degchiStand' }),
  ...THALI_POS.map(([x, z], i) => SOL.circle(x, z, 0.13, { h: 0.5, id: 'thali' + i })),
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
  return items;
};
