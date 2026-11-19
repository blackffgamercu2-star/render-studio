// Shot plan for "कोहरे में रस्सी-घंटी वाला रतन" — fog-hindi.
// Salted Mine V3 style + "v4" ACTION CAMERA + Library v6 body
// (life/emo/gesture/grip/stride) + FULL UPGRADE (2026-11-19): real
// layered fog, ONE morning sun, characters with volume + emotion,
// speaking = moving, real object physics (cart weight, the stuck
// wheel, rope tension). END RULE: the only performed line is L12
// (mid-film); the last quarter is narration only, all mouths shut.
// Voice stem: voice_build.wav — Rishav voice clone (Chatterbox
// local), speed-fitted, 63.978875 s, 30 fps, TOTAL 1919. Line
// timings from timing.json (faster-whisper small char-mapped onto
// the script — see ../align.py). Scene changes ONLY at line
// boundaries. ONE set: a village path running SOUTH (gate, z=13.2)
// to NORTH (mandi, z=-11.5 post) across a plank bridge over the
// river (deck z 1.6..-5.6, y 0.55; river band z -1.4..-4.6). The
// guide rope runs at x=-0.5 from the gate post to the mandi post,
// with brass bells and knot codes tied along it.
// GRADE: Monsoon Grey while the fog holds, blending to a warm
// morning breakthrough (clearK) as the fog lifts at L16. Boards and
// captions are never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1919, DECK = 0;
export const SHOTS = [
  { id: 'hand', a: 0, b: 129, light: 'fog' },
  { id: 'bridge', a: 130, b: 250, light: 'fog' },
  { id: 'declare', a: 251, b: 373, light: 'fog' },
  { id: 'bet', a: 374, b: 501, light: 'fog' },
  { id: 'morning', a: 502, b: 611, light: 'fog' },
  { id: 'grip', a: 612, b: 700, light: 'fog' },
  { id: 'ropeway', a: 701, b: 823, light: 'fog' },
  { id: 'bells', a: 824, b: 889, light: 'fog' },
  { id: 'code', a: 890, b: 1014, light: 'fog' },
  { id: 'walk', a: 1015, b: 1119, light: 'fog' },
  { id: 'queue', a: 1120, b: 1232, light: 'fog' },
  { id: 'line', a: 1233, b: 1356, light: 'fog' },
  { id: 'stuck', a: 1357, b: 1434, light: 'fog' },
  { id: 'bellsring', a: 1435, b: 1492, light: 'fog' },
  { id: 'free', a: 1493, b: 1592, light: 'fog' },
  { id: 'reveal', a: 1593, b: 1699, light: 'fog' },
  { id: 'proverb', a: 1700, b: 1822, light: 'fog' },
  { id: 'hookboard', a: 1823, b: 1918, light: 'fog' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const lerp3 = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)];

// ---------- geography ----------
export const ROPE_X = -0.5;
export const GATE_Z = 13.2, MANDI_POST_Z = -11.5;
export const BOARD_POS = [0.1, 2.0, -12.6];
export const SIGN_POS = BOARD_POS;
// bridge deck height profile along z (0 on land, 0.55 on the deck)
export const deckY = (z) => {
  if (z >= 3.2) return 0;
  if (z >= 1.6) return 0.55 * smooth((3.2 - z) / 1.6);
  if (z >= -5.6) return 0.55;
  if (z >= -7.2) return 0.55 * (1 - smooth((-5.6 - z) / 1.6));
  return 0;
};
// rope furniture: bells (single + the two triple clusters: the
// teaching cluster on the approach and the bridge-edge cluster) and
// knot codes tied into the rope.
export const ROPE_MARKS = [
  { z: 9.5, type: 'bell' },
  { z: 6.6, type: 'knot1' },
  { z: 5.9, type: 'knot2' },
  { z: 4.9, type: 'bells3' },
  { z: 2.6, type: 'bell' },
  { z: 0.6, type: 'knot2' },
  { z: -6.3, type: 'bells3' },
  { z: -7.6, type: 'knot1' },
  { z: -8.6, type: 'bell' },
];
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// ---------- lights / mood grades ----------
// ONE sun all film (morning, east, low): az/el NEVER change — only
// intensity, fog reach and colour move, and only on clause bounds.
export const LIGHTS = {
  fog: { az: 104, el: 21, sky: '#aebfc6', ground: '#5c6658', hemi: 0.62, sun: '#e9e4d8', sunI: 0.55, fog: '#c3ced2', fogNear: 7, fogFar: 36,
    skyTop: '#7e97a3', skyHor: '#ccd6d9', sunDisc: '#e0dbcd', sunSize: 0.007, sat: 0.88, vig: 0.3, shadowExt: 26, aurora: 0, gain: '#e9edec',
    waterDeep: '#2c4a55', waterShal: '#5d7d84', glint: '#e8e4da' },
  warm: { az: 104, el: 21, sky: '#cfe0d8', ground: '#5f7050', hemi: 0.78, sun: '#ffdf9e', sunI: 1.18, fog: '#e6dbc2', fogNear: 26, fogFar: 150,
    skyTop: '#4f96c8', skyHor: '#ffe3b0', sunDisc: '#fff3cf', sunSize: 0.012, sat: 1.1, vig: 0.26, shadowExt: 26, aurora: 0, gain: '#fff0d0',
    waterDeep: '#175d7a', waterShal: '#3d9db4', glint: '#ffe9b0' },
};
const mixHex = (a, b, u) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
};
// the fog itself: thick all morning, thinning a touch on the bridge
// so the queue reads, then LIFTING across L16 (the word 'छँटा' f1603).
export const fogK = (f) => {
  const base = f < 1015 ? 0.97 : 0.86;
  const lift = smooth(ramp(f, 1600, 1662));
  return lerp(base, 0.12, lift);
};
export const clearK = (f) => smooth(ramp(f, 1598, 1665));
// exposure choreography: a breath of dim as the wheel drops (the
// world holds its breath), recovering as it frees.
const dipK = (f) => {
  const d1 = smooth(ramp(f, 1410, 1418)) * (1 - smooth(ramp(f, 1426, 1448)));
  return 1 - 0.16 * d1;
};
export const lightFor = (S, f) => {
  const base = LIGHTS[S.light], W = LIGHTS.warm, u = clearK(f);
  const out = { ...base };
  if (u > 0.001) {
    for (const k of ['hemi', 'sunI', 'sat', 'vig', 'sunSize']) out[k] = lerp(base[k], W[k], u);
    for (const k of ['sky', 'ground', 'sun', 'skyTop', 'skyHor', 'sunDisc', 'gain', 'waterDeep', 'waterShal', 'glint']) out[k] = mixHex(base[k], W[k], u);
  }
  // fog reach is driven by fogK (density), not just the grade blend
  const fk = fogK(f);
  out.fog = mixHex(out.fog, LIGHTS.fog.fog, 0) // keep grade fog colour
  out.fogNear = lerp(lerp(26, 7, fk), 26, u * 0.85);
  out.fogFar = lerp(lerp(150, 36, fk), 150, u * 0.85);
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

// ---------- the crossing: master movement tracks ----------
// Ratan leads; the queue reference is cart A's centre. Pace while
// rolling ~0.035 m/f; the whole line halts when the wheel drops
// (f1415) and rolls again when it frees (f1516).
export const zRatan = track([[0, 12.3], [1014, 12.3], [1015, 7.3], [1119, 3.65], [1232, -0.3], [1356, -4.6], [1415, -6.7], [1445, -7.0], [1515, -7.0], [1592, -9.55], [1699, -11.2], [1918, -11.2]]);
export const zCartA = track([[0, 10.6], [1014, 10.6], [1015, 10.6], [1119, 6.95], [1232, 3.0], [1356, -1.3], [1415, -3.4], [1516, -3.4], [1592, -6.05], [1699, -8.9], [1790, -12.9], [1918, -12.9]]);
// cart B has its own track: parked deeper in the village before the
// crossing (clear of the opening camera), +4.45 behind cart A while
// rolling, then rolling on to the mandi edge after arrival so it
// never blocks the hook-board shot.
export const zCartB = track([[0, 17.2], [1014, 17.2], [1015, 15.05], [1119, 11.4], [1232, 7.45], [1356, 3.15], [1415, 1.05], [1516, 1.05], [1592, -1.6], [1699, -4.45], [1760, -7.4], [1822, -11.8], [1918, -11.8]]);
// after delivery the carts are pulled ASIDE to the stalls (during
// the proverb shot) so the hook-board finale is clear.
export const xCartA = track([[0, 0.05], [1699, 0.05], [1790, -2.6], [1918, -2.6]]);
export const xCartB = track([[0, 0.08], [1699, 0.08], [1822, 2.9], [1918, 2.9]]);
const moving = (zFn) => (f) => Math.abs(zFn(f) - zFn(Math.max(0, f - 1))) > 0.002;
// the stuck wheel: drops into the plank gap f1412-1421, held, then
// POPS out f1500-1512 with a settle wobble after.
export const dropK = (f) => {
  if (f < 1412) return 0;
  if (f < 1421) return smooth((f - 1412) / 9);
  if (f < 1500) return 1;
  if (f < 1512) return 1 - smooth((f - 1500) / 12);
  return 0;
};
export const wobK = (f) => {
  if (f < 1506 || f > 1545) return 0;
  const t = f - 1506;
  return Math.sin(t * 0.85) * Math.exp(-t / 7) * (f < 1512 ? (f - 1506) / 6 : 1);
};
// bell energy: idle sway, teaching touches, passing ticks, and the
// great clang when the stuck cart jolts the rope (L14).
export const bellK = track([[0, 0.06], [870, 0.06], [878, 0.34], [892, 0.08], [1000, 0.22], [1014, 0.1], [1119, 0.16], [1356, 0.14], [1415, 0.3], [1435, 0.55], [1470, 1], [1492, 0.3], [1510, 0.42], [1540, 0.15], [1699, 0.12], [1918, 0.08]]);

// ---------- per-actor staging ----------
const stand = (x, z) => ({ x, z, ph: 0, mode: 'stand' });
const walkZ = (zFn, x) => (f) => {
  const z = zFn(f);
  return moving(zFn)(f) ? { x, z, ph: stridePh(12.3, z, 1.15), mode: 'stroll' } : stand(x, z);
};
const ratanWalk = walkZ(zRatan, 0.05), cartAWalk = walkZ(zCartA, 0.05);
export const ratanAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'hand': case 'declare': return stand(0.05, 12.3);
    case 'bet': return stand(-0.75, 12.15);
    case 'morning': return stand(0.05, 12.3);
    case 'grip': return stand(-0.02, 12.78);
    case 'ropeway': return stand(0.05, 12.3); // off-frame start; the rope is the actor here
    case 'bells': case 'code': return stand(0.02, 5.62);
    case 'walk': case 'queue': case 'line': return ratanWalk(f);
    case 'stuck': return stand(0.05, zRatan(f)); // far ahead, off-camera north
    case 'bellsring': case 'free': return stand(0.05, zRatan(f));
    case 'reveal': return ratanWalk(f);
    case 'proverb': return stand(0.02, -11.15);
    case 'hookboard': return { x: -0.55, z: -8.6, ph: 0, mode: 'kneel' };
    default: return stand(0.05, 12.3);
  }
};
export const boyAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'bridge': return stand(-0.12, -3.0); // last year, on the deck
    case 'morning': return stand(0.68, 12.75);
    case 'walk': case 'queue': case 'line': case 'stuck': case 'bellsring': case 'free': case 'reveal': {
      const r = ratanWalk(f);
      return { x: 0.66, z: r.z + 0.5, ph: r.ph, mode: r.mode };
    }
    case 'proverb': return stand(0.72, -10.6);
    case 'hookboard': return stand(0.85, -10.9);
    default: return stand(0.68, 12.75);
  }
};
export const sonAt = (f) => {
  const S = shotAt(f).id;
  switch (S) {
    case 'bet': {
      if (f < 428) { const u = clamp((f - 374) / 54); const x = lerp(2.6, 1.5, u), z = lerp(13.6, 12.4, u); return { x, z, ph: stridePh(2.6, x, 1.2), mode: 'stroll' }; }
      return stand(1.5, 12.4);
    }
    case 'morning': return stand(2.2, 13.8);
    case 'declare': return stand(2.3, 13.6);
    case 'reveal': case 'proverb': return stand(0.88, -11.45);
    case 'hookboard': return stand(1.15, -11.6);
    default: return stand(2.2, 13.8);
  }
};
// cart pullers walk at the handles, 1.25 m in front (north) of their
// cart; cart B and its puller and the rear man follow cart A's track.
export const pullerAAt = (f) => { const c = cartAWalk(f); return { x: 0.02, z: c.z - 1.3, ph: c.ph, mode: c.mode }; };
export const cartBAt = (f) => { const z = zCartB(f); const mv = moving(zCartB)(f); return { x: 0.08, z, ph: stridePh(15.05, z, 1.15), mode: mv ? 'stroll' : 'stand' }; };
export const pullerBAt = (f) => { const c = cartBAt(f); return { x: 0.0, z: c.z - 1.3, ph: c.ph, mode: c.mode }; };
export const manCAt = (f) => { const z = zCartA(f) + 7.1; const mv = moving(zCartA)(f); return { x: -0.05, z, ph: stridePh(12.3, z, 1.15), mode: mv ? 'stroll' : 'stand' }; };
export const cartAAt = (f) => {
  const z = zCartA(f);
  return { x: xCartA(f), z, y: deckY(z), spin: (10.6 - z) / 0.44, drop: dropK(f), wob: wobK(f) };
};
export const cartBState = (f) => {
  const z = zCartB(f);
  return { x: xCartB(f), z, y: deckY(z), spin: (15.05 - z) / 0.44, drop: 0, wob: wobK(f) * 0.4 };
};
export const QUEUE_SHOTS = ['walk', 'queue', 'line', 'stuck', 'bellsring', 'free', 'reveal'];

// ---------- focus (DOF target per shot) ----------
const FOCUS = {
  hand: (f) => { const r = ratanAt(f); return [r.x, 1.5, r.z]; },
  bridge: (f) => { const b = boyAt(f); return [b.x, deckY(b.z) + 1.05, b.z]; },
  declare: (f) => { const r = ratanAt(f); return [r.x, 1.52, r.z]; },
  bet: (f) => { const s = sonAt(f); return [s.x, 1.5, s.z]; },
  morning: () => [0, 1.1, 8.5],
  grip: () => [-0.45, 1.12, 13.2],
  ropeway: (f) => [-0.5, 1.15, lerp(8, -6, clamp((f - 701) / 122))],
  bells: () => [-0.45, 1.15, 5.3],
  code: (f) => [-0.5, 1.13, f < 925 ? 6.55 : f < 950 ? 5.9 : 4.9],
  walk: (f) => { const r = ratanAt(f); return [r.x, deckY(r.z) + 1.45, r.z]; },
  queue: (f) => { const c = cartAAt(f); return [c.x, c.y + 0.8, c.z]; },
  line: (f) => { const r = ratanAt(f); return [r.x, deckY(r.z) + 1.5, r.z]; },
  stuck: (f) => { const c = cartAAt(f); return [c.x + 0.45, c.y + 0.45, c.z]; },
  bellsring: (f) => { const r = ratanAt(f); return [r.x, deckY(r.z) + 1.5, r.z]; },
  free: (f) => { const c = cartAAt(f); return [c.x, c.y + 0.6, c.z]; },
  reveal: (f) => (f < 1640 ? [0, 1.2, -8.5] : [0.88, 1.5, -11.45]),
  proverb: () => [0.45, 1.45, -11.3],
  hookboard: () => [0.1, 1.95, -12.6],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: v4 ACTION LEVEL — every shot travels ----------
// Head-width maths (card head ~0.61 m): % = 0.61 / (2*d*tan(fov/2)*0.5625).
const RIG_BY_ID = {
  // hand: Ratan BIG from frame 0 (head ~46%), low angle, his right
  // hand raised into the fog toward camera — he cannot see it. The
  // push tightens to ~56% as the line lands.
  hand: { cut: 'hard', raw: (f) => {
    const r = ratanAt(f), u = smooth(ramp(f, 0, 16));
    const d = lerp(3.3, 2.85, u);
    return { pos: [r.x + d * 0.36, 1.28, r.z + d * 0.93], look: [r.x - 0.05, 1.38, r.z], fov: lerp(38, 35, u), roll: 0 };
  } },
  // bridge: low on the deck, pushing along the planks at the boy as
  // he slips (f214-243) and catches the rope — river below the gaps.
  bridge: { cut: 'hard', raw: keysCam({ keys: [
    { f: 130, pos: [1.55, 1.2, 2.7], look: [-0.2, 0.95, -3.0], fov: 40 },
    { f: 205, pos: [1.15, 1.08, 0.7], look: [-0.15, 1.0, -3.0], fov: 38, ease: 'smooth' },
    { f: 250, pos: [0.95, 1.02, -0.55], look: [-0.12, 1.05, -3.0], fov: 37, ease: 'surge' }] }) },
  // declare: a 15-frame PUNCH onto Ratan's determined face (38% ->
  // 64%) as he makes the promise, pointing across the river.
  declare: { cut: 'hard', raw: keysCam({ keys: [
    { f: 251, pos: [2.3, 1.7, 16.6], look: [0.1, 1.45, 12.3], fov: 40 },
    { f: 266, pos: [1.35, 1.58, 14.95], look: [0.05, 1.52, 12.3], fov: 36, ease: 'surge' },
    { f: 373, pos: [1.25, 1.56, 14.8], look: [0.05, 1.52, 12.3], fov: 35, ease: 'surge' }] }) },
  // bet: the son strides out of the gate crowd; the camera pushes
  // WITH him — face 30% -> 63% as he lays the bet, jabbing a point.
  bet: { cut: 'hard', raw: keysCam({ keys: [
    { f: 374, pos: [4.3, 1.85, 17.6], look: [2.2, 1.4, 13.2], fov: 41 },
    { f: 428, pos: [3.0, 1.66, 15.6], look: [1.55, 1.5, 12.5], fov: 37, ease: 'smooth' },
    { f: 470, pos: [2.55, 1.6, 15.0], look: [1.5, 1.52, 12.4], fov: 35, ease: 'surge' },
    { f: 501, pos: [2.5, 1.59, 14.9], look: [1.5, 1.52, 12.4], fov: 35, ease: 'surge' }] }) },
  // morning: the whole queue as fog silhouettes at the gate — a
  // slow push from high south-east; nobody can see anybody.
  morning: { cut: 'hard', raw: keysCam({ keys: [
    { f: 502, pos: [6.6, 3.5, 20.6], look: [0, 1.0, 9.0], fov: 42 },
    { f: 611, pos: [5.7, 3.05, 19.1], look: [0, 1.05, 8.6], fov: 41, ease: 'surge' }] }) },
  // grip: THE INSERT — the gate post, the old rope's end and
  // Ratan's hand closing on it fill the frame (~90% span).
  grip: { cut: 'hard', raw: keysCam({ keys: [
    { f: 612, pos: [0.95, 1.34, 14.5], look: [-0.45, 1.12, 13.2], fov: 37 },
    { f: 662, pos: [0.86, 1.3, 14.32], look: [-0.46, 1.12, 13.2], fov: 36, ease: 'surge' },
    { f: 700, pos: [0.84, 1.29, 14.26], look: [-0.46, 1.12, 13.2], fov: 36, ease: 'surge' }] }) },
  // ropeway: the camera RIDES the rope — gate post, over the
  // bridge, out toward a mandi that the fog refuses to show.
  ropeway: { cut: 'hard', raw: keysCam({ keys: [
    { f: 701, pos: [0.7, 1.75, 13.7], look: [-0.5, 1.1, 8.0], fov: 44 },
    { f: 742, pos: [0.5, 1.62, 8.6], look: [-0.5, 1.08, 3.0], fov: 44, ease: 'smooth' },
    { f: 778, pos: [0.45, 1.8, 2.6], look: [-0.5, 1.25, -3.0], fov: 44, ease: 'smooth' },
    { f: 823, pos: [0.4, 1.95, -3.4], look: [-0.4, 1.2, -9.0], fov: 43, ease: 'surge' }] }) },
  // bells: INSERT on the teaching stretch — brass bells and knots
  // fill the frame; Ratan's hand slides in and touches a bell.
  bells: { cut: 'hard', raw: keysCam({ keys: [
    { f: 824, pos: [1.08, 1.38, 7.35], look: [-0.45, 1.15, 5.45], fov: 37 },
    { f: 889, pos: [0.92, 1.32, 6.95], look: [-0.46, 1.15, 5.4], fov: 36, ease: 'surge' }] }) },
  // code: the camera slides along the rope as his hand counts —
  // one knot, two knots, three bells, then the flat palm: STOP.
  code: { cut: 'hard', raw: keysCam({ keys: [
    { f: 890, pos: [1.02, 1.32, 7.65], look: [-0.5, 1.12, 6.55], fov: 37 },
    { f: 928, pos: [0.97, 1.31, 7.05], look: [-0.5, 1.12, 5.9], fov: 37, ease: 'smooth' },
    { f: 978, pos: [0.92, 1.33, 6.25], look: [-0.5, 1.15, 4.9], fov: 37, ease: 'smooth' },
    { f: 1014, pos: [0.9, 1.33, 6.1], look: [-0.48, 1.16, 4.95], fov: 36, ease: 'surge' }] }) },
  // walk: front three-quarter TRACKING — Ratan eyes shut, left
  // hand sliding on the rope, the boy at his side; the camera
  // retreats north at exactly their pace.
  walk: { cut: 'hard', raw: (f) => {
    const r = ratanAt(f), dy = deckY(r.z);
    return { pos: [r.x + 1.15, dy + 1.52, r.z - 3.15], look: [r.x - 0.1, dy + 1.32, r.z], fov: 38, roll: 0 };
  } },
  // queue: high front three-quarter — the whole blind line strung
  // along the rope, carts behind men, fog between the layers.
  queue: { cut: 'hard', raw: (f) => {
    const r = ratanAt(f);
    return { pos: [r.x + 3.5, deckY(r.z) + 2.7, r.z - 4.6], look: [-0.1, 1.0, r.z + 3.6], fov: 44, roll: 0 };
  } },
  // line: THE LINE, performed while walking — push-in on Ratan
  // (51% -> 69%) as he answers the boy; his mouth is the stem's.
  line: { cut: 'hard', raw: pushInCam({ subject: (f) => { const r = ratanAt(f); return [r.x, deckY(r.z), r.z]; }, a: 1233, b: 1356, d0: 3.15, d1: 2.4, h0: 1.56, h1: 1.52, lookOff: [0, 1.52, 0], fov0: 37, fov1: 34,
    dir: () => [0.38, -0.92] }) },
  // stuck: low and EAST of cart A, aimed at the east wheel — it
  // rolls toward camera, then DROPS into the plank gap (KICK
  // f1415) and the cart lurches onto the dropped side.
  stuck: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1357, pos: [3.35, 1.78, -0.1], look: [0.3, 0.62, -2.2], fov: 40 },
    { f: 1408, pos: [3.0, 1.56, -1.05], look: [0.55, 0.42, -3.3], fov: 39, ease: 'smooth' },
    { f: 1434, pos: [2.92, 1.5, -1.2], look: [0.58, 0.4, -3.42], fov: 39, ease: 'surge' }] }) },
  // bellsring: WHIP back to Ratan at the far edge — the bells
  // beside him still shaking; he freezes mid-step, hand up.
  bellsring: { cut: 'whip', blend: 6, raw: keysCam({ keys: [
    { f: 1435, pos: [1.3, 1.62, -3.85], look: [0.0, 1.48, -6.85], fov: 36 },
    { f: 1462, pos: [1.18, 1.6, -4.15], look: [0.02, 1.5, -6.92], fov: 34, ease: 'surge' },
    { f: 1492, pos: [1.14, 1.59, -4.28], look: [0.02, 1.5, -6.95], fov: 34, ease: 'surge' }] }) },
  // free: the men heave at the wheel together — it POPS out
  // (f1506), the cart levels, dust puffs, and the line rolls on.
  free: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1493, pos: [2.65, 1.55, 0.7], look: [0, 0.62, -3.4], fov: 41 },
    { f: 1545, pos: [2.45, 1.5, 0.1], look: [0, 0.66, -3.9], fov: 40, ease: 'smooth' },
    { f: 1592, pos: [2.3, 1.46, -0.7], look: [0, 0.7, -4.4], fov: 40, ease: 'surge' }] }) },
  // reveal: with the queue off the bridge as the fog LIFTS — then
  // a punch onto the son at the mandi post, rope in his own hands.
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1593, pos: [2.85, 2.25, -1.4], look: [0, 1.1, -8.2], fov: 42 },
    { f: 1652, pos: [2.2, 1.82, -7.5], look: [0.6, 1.45, -11.4], fov: 38, ease: 'smooth' },
    { f: 1699, pos: [1.72, 1.66, -9.15], look: [0.88, 1.5, -11.45], fov: 35, ease: 'surge' }] }) },
  // proverb: a warm two-shot at the mandi post — the saying is
  // born; the son bows his head, Ratan's hand rests on the rope.
  proverb: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1700, pos: [1.85, 1.64, -7.85], look: [0.4, 1.45, -11.3], fov: 38 },
    { f: 1822, pos: [1.62, 1.59, -8.55], look: [0.42, 1.46, -11.32], fov: 37, ease: 'surge' }] }) },
  // hookboard: the film ends on a CHARACTER BEAT — Ratan kneels in
  // the foreground pointing up at the hook board (86% of frame
  // width, whole panel inside with margins, full opacity to the
  // literal last frame), the son and boy beside him, mouths shut.
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1823, pos: [0.55, 2.02, -1.75], look: [0.1, 1.94, -12.6], fov: 44 },
    { f: 1918, pos: [0.5, 1.98, -2.35], look: [0.1, 1.95, -12.6], fov: 43, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1415, a: 0.3 }, { f: 1506, a: 0.16 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { hand: 2.6, bridge: 2.4, declare: 3.0, bet: 2.8, morning: 1.5, grip: 3.2, ropeway: 1.8, bells: 3.2, code: 3.2, walk: 2.8, queue: 1.7, line: 3.2, stuck: 2.4, bellsring: 3.0, free: 2.2, reveal: 2.4, proverb: 2.8, hookboard: 1.3 };
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
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1828, 1852)) : 0,
    fogK: fogK(f),
    clearK: clearK(f),
    bellK: bellK(f),
    dropK: dropK(f),
    wobK: wobK(f),
    lampK: clearK(f),
  };
};
export const fxProfileAt = (f) => {
  const fk = fogK(f);
  return { moteRate: 0.05 + fk * 0.55, blastRate: 0, sparkRate: clearK(f) * 0.5, steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours
// flat and saturated (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  ratan: { jacket: '#b3a284', pants: '#7d6c4e', boots: '#3a2410', hat: 'hair', hair: '#a8a294', skin: '#fbf7ef', moustache: '#b8b3a4', bigMoustache: true },
  son: { jacket: '#2f6db3', pants: '#33424a', boots: '#1c1712', hat: 'cap', cap: '#b3392e', skin: '#fbf7ef' },
  boy: { jacket: '#e8b93c', pants: '#5a4632', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  pullerA: { jacket: '#4a7d3a', pants: '#3c3a40', boots: '#241a12', hat: 'turban', turban: '#e8e3d5', skin: '#fbf7ef', moustache: '#2a201a' },
  pullerB: { jacket: '#b35c2f', pants: '#4a3626', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  manC: { jacket: '#7a2c4c', pants: '#4a2436', boots: '#241a12', hat: 'cap', cap: '#3a6db3', skin: '#fbf7ef', moustache: '#2a201a' },
  mandiA: { jacket: '#cfc8b8', pants: '#5a5348', boots: '#241a12', hat: 'hair', hair: '#3a2c1c', skin: '#fbf7ef', moustache: '#2a201a' },
  mandiB: { jacket: '#8e2434', dress: '#c2263f', pants: '#7a1f2b', boots: '#3a2410', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
};
// Emotion morphs at story beats (body.js emoTrack).
const emoRatan = emoTrack(T.faceP, 'thinking', [
  [130, 'thinking', 8], [251, 'determined', 8], [374, 'stern', 8], [502, 'neutral', 8], [612, 'determined', 8],
  [824, 'proud', 8], [1015, 'neutral', 8], [1233, 'smile', 8], [1357, 'neutral', 8], [1435, 'shock', 5],
  [1493, 'nervous', 8], [1540, 'relief', 8], [1593, 'smile', 8], [1700, 'proud', 8], [1823, 'grin', 8],
]);
const emoSon = emoTrack(T.faceP, 'smug', [
  [502, 'smug', 8], [1593, 'shock', 6], [1612, 'nervous', 8], [1660, 'sad', 9], [1700, 'sad', 9], [1760, 'relief', 9], [1823, 'smile', 8],
]);
const emoBoy = emoTrack(T.faceP, 'wonder', [
  [130, 'nervous', 8], [214, 'shock', 5], [240, 'relief', 8], [1015, 'wonder', 8], [1233, 'wonder', 8],
  [1330, 'smile', 8], [1435, 'shock', 5], [1540, 'relief', 8], [1700, 'smile', 8],
]);
const emoPullA = emoTrack(T.faceP, 'neutral', [
  [1357, 'nervous', 8], [1412, 'nervous', 5], [1493, 'determined', 8], [1540, 'relief', 8],
]);
const emoPullB = emoTrack(T.faceP, 'neutral', [[1493, 'determined', 8], [1540, 'relief', 8]]);
const emoManC = emoTrack(T.faceP, 'neutral', [[1493, 'determined', 8], [1540, 'smile', 8]]);
// Continuous life per character (body.js lifeAt).
const lifeRatan = lifeAt({ seed: 21 }), lifeSon = lifeAt({ seed: 51 }), lifeBoy = lifeAt({ seed: 31 }),
  lifePA = lifeAt({ seed: 61 }), lifePB = lifeAt({ seed: 71 }), lifePC = lifeAt({ seed: 81 }),
  lifeMA = lifeAt({ seed: 91 }), lifeMB = lifeAt({ seed: 101 });
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
// dialogue gesture: Ratan's free (right) hand talks with the voice —
// stresses on रस्सी (f1295), बोलती (f1308), सुनता (f1338).
const gestRatan = gestureAt([{ a: 1233, b: 1355, beats: [1295, 1308, 1338], base: 0.42, amp: 0.18 }]);
// the teaching hand: counts along the rope in the code insert.
const countK = (f, a, b) => (f < a || f > b ? null : q(0.55 + 0.35 * Math.min(smooth(ramp(f, a, a + 8)), 1 - smooth(ramp(f, b - 6, b))), 2));

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    const gy = deckY(z);
    out.push({ id, x, y: extra.y ?? gy, z, r: extra.r || 0.32, ground: extra.ground ?? gy,
      actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? gy),
        draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
        x, y: extra.y ?? gy, z, ground: extra.ground ?? gy, tint, ...extra }) });
  };
  const r = ratanAt(f), b = boyAt(f), sn = sonAt(f);
  const RP = noBlush(emoRatan.at(f)), SP2 = noBlush(emoSon.at(f)), BP = noBlush(emoBoy.at(f));
  const PAP = noBlush(emoPullA.at(f)), PBP = noBlush(emoPullB.at(f)), PCP = noBlush(emoManC.at(f));
  const ratanStd = (opts, extra = {}) => std('ratan', OUTFITS.ratan, { expr: 'smile', exprP: RP, blink: blinkAt(f, 20), seed: 21, ...opts }, r.x, r.z, { yaw: 0.1, ...extra });
  const boyStd = (opts, extra = {}) => std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, blink: blinkAt(f, 31), seed: 31, ...opts }, b.x, b.z, { yaw: 0, s: 0.8, ...extra });
  const sonStd = (opts, extra = {}) => std('son', OUTFITS.son, { expr: 'smile', exprP: SP2, blink: blinkAt(f, 51), seed: 51, ...opts }, sn.x, sn.z, { yaw: -0.15, ...extra });
  const queueCast = () => {
    const pa = pullerAAt(f), pb = pullerBAt(f), mc = manCAt(f);
    // pullers lean on the cart handles with BOTH hands; the rear man
    // holds the rope with his left hand like everyone else.
    std('pullerA', OUTFITS.pullerA, { expr: 'neutral', exprP: PAP, mode: pa.mode, phase: q(pa.ph, 2), blink: blinkAt(f, 61), seed: 61,
      prop: ['point', 0.55], propL: ['point', 0.55], ...H2(lifePA, f, 61, { ht: 2.5, look: -0.1, lookY: 0.3, facing: -0.05 }) }, pa.x, pa.z, { yaw: 0 });
    std('pullerB', OUTFITS.pullerB, { expr: 'neutral', exprP: PBP, mode: pb.mode, phase: q(pb.ph, 2), blink: blinkAt(f, 71), seed: 71,
      prop: ['point', 0.55], propL: ['point', 0.55], ...H2(lifePB, f, 71, { ht: 2.5, look: 0.1, lookY: 0.3, facing: 0.05 }) }, pb.x, pb.z, { yaw: 0 });
    std('manC', OUTFITS.manC, { expr: 'neutral', exprP: PCP, mode: mc.mode, phase: q(mc.ph, 2), blink: blinkAt(f, 81), seed: 81,
      propL: ['point', 0.85], ...H2(lifePC, f, 81, { ht: -1, look: -0.25, lookY: 0, facing: -0.2 }) }, mc.x, mc.z, { yaw: -0.1 });
  };
  const mandiCast = () => {
    std('mandiA', OUTFITS.mandiA, { expr: 'smile', exprP: noBlush(T.faceP('smile')), mode: 'stand', blink: blinkAt(f, 91), seed: 91,
      ...H2(lifeMA, f, 91, { ht: -1.5, look: 0.2, lookY: 0, facing: 0.15 }) }, -3.4, -13.7, { yaw: 0.2 });
    std('mandiB', OUTFITS.mandiB, { expr: 'smile', exprP: noBlush(T.faceP('smile')), mode: 'stand', blink: blinkAt(f, 101), seed: 101,
      ...H2(lifeMB, f, 101, { ht: -1.5, look: -0.2, lookY: 0, facing: -0.15 }) }, 3.5, -13.8, { yaw: -0.2 });
  };

  switch (S.id) {
    case 'hand': {
      // frame 0: BIG, mid-action — right hand raised into the fog
      // toward camera (he is testing what he cannot see), face
      // wondering; the hand stays up the whole line.
      ratanStd({ mode: 'stand', prop: ['point', q(0.82 + 0.1 * Math.sin(f * 0.05), 2)],
        ...H2(lifeRatan, f, 21, { ht: -2, look: 0.3, lookY: -0.15, facing: 0.25 }) }, { yaw: 0.2 });
      break;
    }
    case 'bridge': {
      // LAST YEAR: the boy crosses alone, slips on the wet planks
      // (f214-243) — tilt + squash + flail — and CATCHES the rope.
      const slip = f >= 214 && f <= 243;
      const rec = f > 243;
      boyStd({ mode: 'stand', propL: rec || slip ? ['point', 0.9] : null,
        prop: slip ? ['point', 0.95] : null,
        ...H2(lifeBoy, f, 31, { ht: slip ? 4 : -1, look: -0.3, lookY: slip ? 0.3 : 0.05, facing: -0.25,
          tilt: q(kf([[214, 0], [222, 7], [230, -4], [238, 2], [243, 0]], f), 1),
          squash: q(kf([[214, 0], [224, 0.16], [236, 0.05], [243, 0]], f), 2) }) }, { yaw: -0.2 });
      break;
    }
    case 'declare': {
      ratanStd({ mode: 'stand', prop: f >= 300 ? ['point', 0.5] : null,
        ...H2(lifeRatan, f, 21, { ht: -2.5, look: -0.2, lookY: -0.1, facing: -0.15 }) }, { yaw: -0.1 });
      sonStd({ mode: 'stand', ...H2(lifeSon, f, 51, { ht: -1.5, look: -0.4, lookY: 0, facing: -0.35 }) }, { yaw: -0.3 });
      break;
    }
    case 'bet': {
      sonStd({ mode: sn.mode, phase: q(sn.ph, 2), prop: f >= 428 ? ['point', q(kf([[428, 0.3], [445, 0.62], [470, 0.5], [501, 0.55]], f), 2)] : null,
        ...H2(lifeSon, f, 51, { ht: -2.5, look: -0.45, lookY: -0.1, facing: -0.4 }) }, { yaw: -0.35 });
      ratanStd({ mode: 'stand', ...H2(lifeRatan, f, 21, { ht: -1, look: 0.5, lookY: 0, facing: 0.4 }) }, { yaw: 0.35 });
      break;
    }
    case 'morning': {
      // the blind morning: the whole queue feels its way into
      // formation at the gate, fog swallowing everyone past 6 m.
      ratanStd({ mode: 'stand', ...H2(lifeRatan, f, 21, { ht: -2, look: 0.2, lookY: -0.05, facing: 0.15 }) }, { yaw: 0.1 });
      boyStd({ mode: 'stand', ...H2(lifeBoy, f, 31, { ht: -1.5, look: -0.3, lookY: 0, facing: -0.25 }) }, { yaw: -0.2 });
      sonStd({ mode: 'stand', prop: ['point', 0.4], ...H2(lifeSon, f, 51, { ht: -2, look: -0.35, lookY: -0.05, facing: -0.3 }) }, { yaw: -0.25 });
      std('pullerA', OUTFITS.pullerA, { expr: 'neutral', exprP: PAP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        prop: ['point', 0.55], propL: ['point', 0.55], ...H2(lifePA, f, 61, { ht: 2, look: 0, lookY: 0.25, facing: 0 }) }, 0.02, 9.25, { yaw: 0 });
      std('pullerB', OUTFITS.pullerB, { expr: 'neutral', exprP: PBP, mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        prop: ['point', 0.55], propL: ['point', 0.55], ...H2(lifePB, f, 71, { ht: 2, look: 0, lookY: 0.25, facing: 0 }) }, 0.0, 13.85, { yaw: 0 });
      std('manC', OUTFITS.manC, { expr: 'neutral', exprP: PCP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...H2(lifePC, f, 81, { ht: -1.5, look: 0.2, lookY: 0, facing: 0.15 }) }, -0.05, 17.7, { yaw: 0.1 });
      break;
    }
    case 'grip': {
      // his LEFT hand finds the rope's end at the post and closes
      // on it (the close lands on 'पकड़' f685-692) — then holds.
      const gk = f < 679 ? 0.45 : q(0.45 + 0.5 * smooth(ramp(f, 679, 692)), 2);
      ratanStd({ mode: 'stand', propL: ['point', gk],
        ...H2(lifeRatan, f, 21, { ht: 2.5, look: -0.35, lookY: 0.35, facing: -0.3 }) }, { yaw: -0.3 });
      break;
    }
    case 'ropeway': break; // the rope, the bells and the fog only
    case 'bells': {
      // his hand slides along the rope and STOPS on a bell
      // ('घंटियाँ' f871) — the bell swings under his fingers.
      const tk = countK(f, 862, 884);
      ratanStd({ mode: 'stand', propL: tk !== null ? ['point', tk] : ['point', 0.6],
        ...H2(lifeRatan, f, 21, { ht: 2, look: -0.4, lookY: 0.3, facing: -0.35 }) }, { yaw: -0.3 });
      break;
    }
    case 'code': {
      // counting: knot one (f895-915), knot two (f930-950), the
      // three bells (f955-975), then the flat palm — STOP.
      let propL = ['point', 0.6], prop = null;
      const k1 = countK(f, 893, 916), k2 = countK(f, 928, 951), k3 = countK(f, 953, 976);
      if (k1 !== null) propL = ['point', k1]; else if (k2 !== null) propL = ['point', k2]; else if (k3 !== null) propL = ['point', k3];
      if (f >= 980) prop = ['point', q(0.55 + 0.4 * smooth(ramp(f, 980, 992)), 2)];
      ratanStd({ mode: 'stand', propL, prop,
        ...H2(lifeRatan, f, 21, { ht: 2, look: -0.4, lookY: 0.3, facing: -0.35 }) }, { yaw: -0.3 });
      break;
    }
    case 'walk': {
      // EYES SHUT (blink held at 1 = lids down), left hand sliding
      // on the rope, head cocked toward the bells; the boy watches
      // him, wide-eyed, holding on with both hands.
      ratanStd({ mode: r.mode, phase: q(r.ph, 2), blink: 1, propL: ['point', 0.85],
        ...H2(lifeRatan, f, 21, { ht: -3.5, look: -0.4, lookY: -0.05, facing: -0.35 }) }, { yaw: -0.3 });
      boyStd({ mode: b.mode, phase: q(b.ph, 2), propL: ['point', 0.8],
        ...H2(lifeBoy, f, 31, { ht: -2, look: -0.45, lookY: -0.05, facing: -0.4 }) }, { yaw: -0.35 });
      queueCast();
      break;
    }
    case 'queue': {
      ratanStd({ mode: r.mode, phase: q(r.ph, 2), blink: 1, propL: ['point', 0.85],
        ...H2(lifeRatan, f, 21, { ht: -3.5, look: -0.4, lookY: -0.05, facing: -0.35 }) }, { yaw: -0.3 });
      boyStd({ mode: b.mode, phase: q(b.ph, 2), propL: ['point', 0.8],
        ...H2(lifeBoy, f, 31, { ht: -2, look: -0.45, lookY: -0.05, facing: -0.4 }) }, { yaw: -0.35 });
      queueCast();
      break;
    }
    case 'line': {
      // THE LINE, performed WHILE WALKING: his mouth is driven by
      // the stem (speak.js); his right hand gestures on the stress
      // words; his left stays on the rope; the boy listens and
      // nods (f1330) — mouth shut, always.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...RP, cheek: Math.max(RP.cheek ?? 0, 0.55) }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('ratan', OUTFITS.ratan, { expr: 'smile', exprP: speakP, mode: r.mode, phase: q(r.ph, 2), blink: blinkAt(f, 20), seed: 21,
        prop: ['point', q(gestRatan(f).k, 2)], propL: ['point', 0.85],
        headTilt: q((sp.nod || 0) + micro(f, 21) - 1.5, 1), look: q(0.3, 2), lookY: q(0.02, 2), facing: q(0.28, 2),
        squash: 0, tilt: q(lifeRatan(f).tilt + lifeRatan(f).sway, 1), breath: Math.round(lifeRatan(f).breath / 6) * 6 },
        r.x, r.z, { yaw: 0.25 });
      boyStd({ mode: b.mode, phase: q(b.ph, 2), propL: ['point', 0.8],
        ...H2(lifeBoy, f, 31, { ht: -2 + nodAt(f, 1330, 10, 0.5), look: -0.5, lookY: -0.05, facing: -0.45 }) }, { yaw: -0.4 });
      queueCast();
      break;
    }
    case 'stuck': {
      // all strain, no travel: puller A hauls on the handles, the
      // boy stares at the dropped wheel, Ratan is off-frame north.
      const pa = pullerAAt(f);
      std('pullerA', OUTFITS.pullerA, { expr: 'neutral', exprP: PAP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        prop: ['point', 0.8], propL: ['point', 0.8],
        ...H2(lifePA, f, 61, { ht: 3.5, look: -0.1, lookY: 0.4, facing: -0.05, tilt: q(kf([[1357, 0], [1412, 2], [1421, 6], [1434, 5]], f), 1) }) }, pa.x, pa.z, { yaw: 0 });
      boyStd({ mode: 'stand', ...H2(lifeBoy, f, 31, { ht: 2, look: -0.2, lookY: 0.35, facing: -0.15 }) }, { yaw: -0.1 });
      break;
    }
    case 'bellsring': {
      // he FREEZES mid-step as the clang reaches him, then turns
      // his head back toward the cart, palm rising: stop.
      const frozen = f >= 1442;
      ratanStd({ mode: frozen ? 'stand' : r.mode, phase: q(r.ph, 2), prop: f >= 1452 ? ['point', q(0.4 + 0.5 * smooth(ramp(f, 1452, 1464)), 2)] : null,
        ...H2(lifeRatan, f, 21, { ht: -3, look: q(kf([[1435, -0.4], [1450, 0.55], [1492, 0.55]], f), 2), lookY: -0.1, facing: q(kf([[1435, -0.35], [1450, 0.4], [1492, 0.4]], f), 2) }) },
        { yaw: q(kf([[1435, -0.3], [1450, 0.35], [1492, 0.35]], f), 2) });
      boyStd({ mode: 'stand', ...H2(lifeBoy, f, 31, { ht: -2.5, look: 0.3, lookY: -0.1, facing: 0.25 }) }, { yaw: 0.2 });
      break;
    }
    case 'free': {
      // puller A + man C heave at the wheel together (their hands
      // go down f1493-1506), it pops, everyone straightens with
      // relief and the line rolls again.
      const heave = f >= 1493 && f <= 1512;
      const pa = pullerAAt(f), mc = manCAt(f);
      std('pullerA', OUTFITS.pullerA, { expr: 'neutral', exprP: PAP, mode: pa.mode, phase: q(pa.ph, 2), blink: blinkAt(f, 61), seed: 61,
        prop: ['point', heave ? 0.9 : 0.55], propL: ['point', heave ? 0.9 : 0.55],
        ...H2(lifePA, f, 61, { ht: heave ? 4.5 : 2.5, look: -0.1, lookY: heave ? 0.5 : 0.3, facing: -0.05, tilt: heave ? 5 : 0 }) }, pa.x, pa.z, { yaw: 0 });
      std('manC', OUTFITS.manC, { expr: 'neutral', exprP: PCP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        prop: ['point', heave ? 0.9 : 0.4], propL: ['point', heave ? 0.9 : 0.4],
        ...H2(lifePC, f, 81, { ht: heave ? 4.5 : -1, look: -0.2, lookY: heave ? 0.5 : 0, facing: -0.15, tilt: heave ? 5 : 0 }) },
        0.95, zCartA(f) + 0.4, { yaw: -0.5 });
      ratanStd({ mode: 'stand', ...H2(lifeRatan, f, 21, { ht: -2, look: 0.45, lookY: 0.1, facing: 0.4 }) }, { yaw: 0.35 });
      boyStd({ mode: b.mode === 'stroll' ? 'stroll' : 'stand', phase: q(b.ph, 2), propL: ['point', 0.8],
        ...H2(lifeBoy, f, 31, { ht: -2, look: -0.3, lookY: 0, facing: -0.25 }) }, { yaw: -0.2 });
      break;
    }
    case 'reveal': {
      ratanStd({ mode: r.mode, phase: q(r.ph, 2), propL: ['point', 0.85],
        ...H2(lifeRatan, f, 21, { ht: -2, look: 0.1, lookY: -0.05, facing: 0.08 }) }, { yaw: 0.05 });
      boyStd({ mode: b.mode, phase: q(b.ph, 2), propL: ['point', 0.8],
        ...H2(lifeBoy, f, 31, { ht: -2.5, look: 0.2, lookY: -0.1, facing: 0.15 }) }, { yaw: 0.1 });
      sonStd({ mode: 'stand', propL: ['point', 0.85],
        ...H2(lifeSon, f, 51, { ht: -2.5, look: -0.3, lookY: -0.05, facing: -0.25 }) }, { yaw: -0.2 });
      queueCast();
      mandiCast();
      break;
    }
    case 'proverb': {
      // the saying is born: Ratan calm and proud, his hand resting
      // on the rope between them; the son bows his head (f1760).
      ratanStd({ mode: 'stand', propL: ['point', 0.8],
        ...H2(lifeRatan, f, 21, { ht: -1.5, look: 0.35, lookY: 0, facing: 0.3 }) }, { yaw: 0.25 });
      sonStd({ mode: 'stand', propL: ['point', 0.7],
        ...H2(lifeSon, f, 51, { ht: q(kf([[1700, -2], [1752, -2], [1762, 2.5], [1778, 2.5], [1790, -1]], f), 1), look: 0.3, lookY: q(kf([[1700, 0], [1752, 0], [1762, 0.35], [1778, 0.35], [1790, 0.05]], f), 2), facing: 0.25,
          tilt: q(kf([[1700, 0], [1752, 0], [1762, 4], [1778, 4], [1790, 0]], f), 1) }) }, { yaw: 0.2 });
      boyStd({ mode: 'stand', ...H2(lifeBoy, f, 31, { ht: -2, look: -0.3, lookY: 0, facing: -0.25 }) }, { yaw: -0.2 });
      mandiCast();
      break;
    }
    case 'hookboard': {
      // the film ends on a CHARACTER BEAT — Ratan kneels in the
      // foreground pointing up at the hook board as it rises
      // behind him; his head stays below the board's text band.
      ratanStd({ mode: 'kneel', prop: ['point', 0.32],
        ...H2(lifeRatan, f, 21, { ht: -2.5, look: 0.45, lookY: -0.35, facing: 0.45 }) }, { yaw: 0.5 });
      sonStd({ mode: 'stand', ...H2(lifeSon, f, 51, { ht: -2.5, look: -0.4, lookY: -0.4, facing: -0.4 }) }, { yaw: -0.35 });
      boyStd({ mode: 'stand', ...H2(lifeBoy, f, 31, { ht: -2.5, look: -0.45, lookY: -0.35, facing: -0.45 }) }, { yaw: -0.4 });
      mandiCast();
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.circle(-1.3, 13.2, 0.09, { h: 2.2, id: 'gatePostL' }),
  SOL.circle(1.5, 13.2, 0.09, { h: 2.2, id: 'gatePostR' }),
  SOL.circle(-0.5, 13.2, 0.07, { h: 1.6, id: 'ropePostGate' }),
  SOL.circle(-0.5, -11.5, 0.07, { h: 1.6, id: 'ropePostMandi' }),
  SOL.circle(-1.15, 1.6, 0.07, { h: 1.8, id: 'bridgePostS1' }),
  SOL.circle(1.35, 1.6, 0.07, { h: 1.8, id: 'bridgePostS2' }),
  SOL.circle(-1.15, -5.6, 0.07, { h: 1.8, id: 'bridgePostN1' }),
  SOL.circle(1.35, -5.6, 0.07, { h: 1.8, id: 'bridgePostN2' }),
  SOL.circle(-13, 6, 0.55, { h: 4.5, id: 'treeW' }),
  SOL.circle(12, -2, 0.55, { h: 4.5, id: 'treeE' }),
  SOL.circle(-9, -14, 0.5, { h: 4, id: 'treeN' }),
  SOL.aabb(-12, -8, 15, 19.5, { h: 3, id: 'hutS1' }),
  SOL.aabb(8, 12.2, 15, 19.5, { h: 3, id: 'hutS2' }),
  SOL.aabb(-5.6, -2.2, -17.5, -14.2, { h: 2.8, id: 'stallW' }),
  SOL.aabb(2.2, 5.6, -17.5, -14.2, { h: 2.8, id: 'stallE' }),
  SOL.circle(-0.75, -12.7, 0.07, { h: 2, id: 'boardPostL' }),
  SOL.circle(0.95, -12.7, 0.07, { h: 2, id: 'boardPostR' }),
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
