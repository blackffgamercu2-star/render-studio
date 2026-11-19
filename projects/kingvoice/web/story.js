// Shot plan for "The King Who Lost His Voice" — kingvoice.
// *** v4 UPGRADE (2026-11-19): picture-only rebuild on the existing stem.
// The old Library-v4 smooth-tracking cameras (slow pushInCam glides over
// whole shots) are replaced by the v4 ACTION CAMERA (valleyfly/fireless
// grammar): dense keysCam moves — fast eased punch-ins at action starts
// (subject scale x2-3 in ~12-18 frames), tracking at subject speed,
// declared impact kicks, no slow drift, no static holds, camera never
// behind the card characters. Rig smoothing tightened to sigma 1.7 /
// radius 5 (valleyfly) so authored speed survives to the screen.
// ANIMATION UPGRADE v1+v2 via kit body.js: lifeAt continuous life
// (breath / weight-shift tilt / sway) on every actor, emoTrack emotion
// morphs at beats, gestureAt dialogue gesture, stridePh distance-based
// leg phase (no glide), gripAt physical two-hand grip (the fool holds
// the speech scroll while he whispers — finger-wrap armPose + carryDip
// weight), jumpTrack startle flinch at the biscuit slip, cheek shading
// tied to the expression morphs. STYLE = Salted Mine V3: WHITE heads
// (#fbf7ef, no card tint), word-by-word captions (main.js + words.js).
// R2 final: the king stands in the foreground of the hook shot, pointing
// up at the board — board + character beat together, board ~84% wide,
// fully inside frame, full opacity to the literal last frame.
// Stem, beat map, clause timings, boards and mix are UNCHANGED.
// Voice stem: 57.771 s, 30 fps, TOTAL 1734; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1  0.00- 5.70 L1  morning, king opens his mouth — nothing comes out.
//   S2  5.70-10.30 L2  a day of shouting at the hunt stole his voice.
//   S3 10.30-15.40 L3  ten thousand guests in the square, treaty depends.
//   S4 15.40-20.30 L4  only the fool smiling — he knows about the parrot.
//   S5 20.30-24.60 L5  six years the parrot copied the king's voice.
//   S6 24.60-28.90 L6  the fool bows low and lays out his little plan.
//   S7 28.90-32.30 L7  DIALOGUE "A king needs a voice, Majesty..."
//   S8 32.30-36.30 L8  the king steps onto the balcony, moves his lips.
//   S9 36.30-42.60 L9  fool whispers, parrot thunders the speech.
//   S10 42.60-46.90 L10 the crowd roars, the treaty is signed.
//   S11 46.90-50.90 L11 the royal voice slips — it demands a biscuit.
//   S12 50.90-54.00 L12 hook question (board fades in).
//   S13 54.00-57.77 hook board held at FULL opacity to the last frame.
// GRADE (FILTER_VFX_LIGHTING pack): Royal Gold throughout (deep warm
// amber, glints only on metal); hook blends to dusk. Boards NEVER graded.
// Signature VFX: gold glints on the crown/parrot perch, sound rings from
// the parrot's thunder, dust motes in the throne-room sun.
// END RULE: the one performed dialogue (L7) sits at 49-55% of the stem —
// mid-story. After it, nobody is shown speaking: the king only MIMES on
// the balcony (the voice is the parrot's), the final stretch is
// narration + hook board, and every mouth is closed in the final frame.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { lifeAt, emoTrack, gestureAt, gripAt, stridePh, jumpTrack, carryDip, gazeTrack, winkTrack } from './body.js';
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
// The king moves his lips SILENTLY on the balcony (the voice is the
// parrot's, not his): a gentle open/close cycle, NOT speak-driven.
const mimeFace = (f) => {
  const u = 0.5 + 0.5 * Math.sin((f - 971) * 0.21);
  return { expr: 'neutral', exprP: { ...T.faceP('neutral'), mOpen: 0.12 + 0.3 * u, mW: 0.85 }, headTilt: 0, clothShade: true };
};

// ---------- animation upgrade v1+v2 (kit body.js) ----------
// Continuous life per actor (breath phase + weight-shift tilt + sway).
const LIFE = {
  king: lifeAt({ seed: 41 }), fool: lifeAt({ seed: 31 }),
  court1: lifeAt({ seed: 51 }), court2: lifeAt({ seed: 52 }),
  guard1: lifeAt({ seed: 61 }), guard2: lifeAt({ seed: 62 }),
};
const lifeOpts = (fn, f, amp = 1) => {
  const L = fn(f);
  return { breath: L.breath, tilt: q(L.tilt * amp, 2), headTilt: q((L.tilt * 0.35 + L.sway * 0.4) * amp, 2) };
};
// Emotion morphs at story beats (smootherstep blends between faces).
const kingEmo = emoTrack(T.faceP, 'shock', [
  [0, 'shock', 1], [80, 'pained', 18],              // morning: shock -> pain
  [269, 'stern', 22],                              // square: composed again
  [900, 'thinking', 18], [952, 'smile_closed', 20], // dialogue: the plan dawns on him
  [1289, 'relief', 22],                            // cheer: it worked
  [1577, 'smile_closed', 20],                      // hook: content, watching
]);
const foolEmo = emoTrack(T.faceP, 'grin', [
  [0, 'grin', 1],
  [1547, 'shock', 6], [1562, 'nervous', 12],       // biscuit slip: his trick slipped!
]);
const kingFace = (f) => ({ ...kingEmo.at(f), cheek: 0.45 });
const foolFace = (f) => ({ ...foolEmo.at(f), cheek: 0.45 });
// The fool glances from the king toward the curtain (the parrot) as the
// narration names it (f479 "knew", f500 "parrot").
const foolGaze = gazeTrack([
  { f: 415, look: -0.3, lookY: 0, facing: -0.15, tilt: 0 },
  { f: 479, look: 0.42, lookY: -0.18, facing: 0.3, tilt: 2.5, ramp: 12 },
]);
// A sly wink as the plan lands (end of the plan shot).
const foolWink = winkTrack([{ a: 806, b: 824 }]);
const foolFaceW = (f) => {
  const wk = foolWink(f);
  const base = foolFace(f);
  return wk > 0 ? T.blendFaceP(base, { ...T.faceP('wink'), cheek: 0.45 }, wk) : base;
};
// Dialogue gesture: the fool's free hand talks with the voice (emphasis
// pulses on the stressed words: king / Majesty / Nobody / own).
const foolGesture = gestureAt([{ a: 845, b: 970, beats: [850, 882, 907, 951], base: 0.5, amp: 0.18 }]);
// The fool's two-hand grip on the speech scroll while he whispers (S9):
// lift at the shot start, hold (with weight), place at the shot end.
// The SAME k drives the armPose hands, the scroll overlay and the dip —
// hand and object move in the same frames.
const scrollGrip = gripAt([
  { f0: 1096, dur: 14, type: 'lift' },
  { f0: 1270, dur: 14, type: 'place' },
]);
// Startle flinch when the royal voice demands a biscuit (f1547).
const foolFlinch = jumpTrack([{ f0: 1547, dur: 11, h: 0.15, back: 5 }]);

export const FPS = 30, TOTAL = 1734, DECK = 0;
// Shot boundaries (frames) — from ASR word timings (words.json):
// L1 0-132 L2 133-268 L3 269-414 L4 415-555 L5 556-710 L6 711-844
// L7 845-970 L8 971-1092 L9 1093-1288 L10 1289-1427 L11 1428-1576
// L12 1577-1725 (hook line; board held through f1733).
export const SHOTS = [
  { id: 'morning', a: 0, b: 132, light: 'royalgold' },
  { id: 'hunt', a: 133, b: 268, light: 'royalgold' },
  { id: 'square', a: 269, b: 414, light: 'royalgold' },
  { id: 'fool', a: 415, b: 555, light: 'royalgold' },
  { id: 'parrot', a: 556, b: 710, light: 'royalgold' },
  { id: 'plan', a: 711, b: 844, light: 'royalgold' },
  { id: 'dialogue', a: 845, b: 970, light: 'royalgold' },
  { id: 'balcony', a: 971, b: 1092, light: 'royalgold' },
  { id: 'whisper', a: 1093, b: 1288, light: 'royalgold' },
  { id: 'cheer', a: 1289, b: 1427, light: 'royalgold' },
  { id: 'biscuit', a: 1428, b: 1576, light: 'royalgold' },
  { id: 'hookq', a: 1577, b: 1650, light: 'royalgold' },
  { id: 'hook', a: 1651, b: 1733, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
const WTR = { waterDeep: '#6a5136', waterShal: '#a8834a', glint: '#ffe9c0' };
export const LIGHTS = {
  royalgold: { az: 122, el: 42, sky: '#c9a86a', ground: '#6a5638', hemi: 1.05, sun: '#ffcf8a', sunI: 2.5, fog: '#ecd3a0', fogNear: 45, fogFar: 320,
    skyTop: '#3f6fb4', skyHor: '#f7dc9e', sunDisc: '#fff0c0', sunSize: 0.0036, sat: 1.1, vig: 0.22, shadowExt: 22, aurora: 0, gain: '#ffedca', ...WTR },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.92, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.05, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba', ...WTR },
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
  if (S.id === 'hookq') return blendLight(LIGHTS.royalgold, LIGHTS.dusk, smooth(ramp(f, 1577, 1630)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
// Throne room: facade north (z=-14), throne at z=-12.2, curtain z=-12.7,
// parrot perch behind the right drape. Treaty table east. Board gantry
// centre. Terrace edge z=+8, steps down to the square (y=-2.5, z 10..34).
export const BOARD_POS = [0, 3.1, -5];
export const THRONE = { x: 0, z: -12.2 };
export const PERCH = [2.1, 1.55, -12.45];
export const TABLE = { x: 4.6, z: 3.5 };
export const TERRACE = { z: 8 };
// R2 final staging: in the hook shots the king stands on the terrace in
// the camera's foreground (the cut from the biscuit shot hides the move),
// pointing up at the hook board behind him.
export const HOOK_KING = { x: 1.7, z: 3.4 };

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// King: at the throne through the dialogue; then a brisk royal stride
// (march) from just south of the board to the terrace edge in the balcony
// shot (the cut hides the jump from the throne — same as pot's actors).
const KING_KEYS = [
  [0, 0, -11.0], [970, 0, -11.0],
  [971, 0, -6.0], [1092, 0, 7.6], [1733, 0, 7.6],
];
const FOOL_KEYS = [
  [0, 2.6, -10.5], [710, 2.6, -10.5],
  [711, 2.6, -10.5], [770, 1.3, -10.0], [970, 1.3, -10.0],
  [1093, 2.0, -11.9], [1733, 2.0, -11.9],
];
const C1_KEYS = [
  [0, 3.2, 4.8], [1733, 3.2, 4.8],
];
export const kingAt = (f) => { const [x, z] = walkKeys(KING_KEYS, f); return { x, z }; };
export const foolAt = (f) => { const [x, z] = walkKeys(FOOL_KEYS, f); return { x, z }; };
export const c1At = (f) => { const [x, z] = walkKeys(C1_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const kingMode = (f) => strolling(f, [[971, 1092]]) ? 'march' : 'stand';
export const foolMode = (f) => strolling(f, [[711, 770]]) ? 'stroll' : 'stand';
// Distance-based stride phase (feet plant with the ground — no glide):
// phase comes from the distance actually travelled along the walk path.
export const kingPhase = (f) => stridePh(-6, kingAt(f).z, 1.05);
export const foolPhase = (f) => { const w = foolAt(f); return stridePh(0, Math.hypot(w.x - 2.6, w.z + 10.5), 0.95); };

// ---------- parrot / quill / biscuit animation ----------
// Parrot beak: 0 closed .. 1 wide open. Mimic chatter in S5, thunder in
// S9 (with sound rings), biscuit held in S11.
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const parrotAt = (f) => {
  const S = shotAt(f);
  let beak = 0, bob = 0, headTilt = 0;
  if (S.id === 'parrot') { // mimicking the king: rapid chatter
    beak = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(f * 0.55));
    bob = 0.5 + 0.5 * Math.sin(f * 0.35);
    headTilt = 0.12 * Math.sin(f * 0.11);
  } else if (S.id === 'whisper') { // thundering the speech
    beak = segMax(f, [[1093, 1113, 1250, 1288, 1]]);
    bob = 0.6 + 0.4 * Math.sin(f * 0.5);
    headTilt = -0.08;
  } else if (S.id === 'biscuit') {
    beak = 0.35; bob = 0.2; headTilt = 0.15;
  } else if (S.id === 'fool') {
    beak = 0.1; bob = 0.15; // a green flash behind the curtain gap
  }
  return { beak, bob, headTilt };
};
export const ringsAt = (f) => segMax(f, [[1103, 1123, 1240, 1288, 1]]);
export const quillAt = (f) => {
  // the quill signs the treaty across the cheer shot, then the wax seal
  // stamps at the very end of it.
  const u = smooth(ramp(f, 1340, 1410));
  return { x: TABLE.x - 0.25 + u * 0.5, y: 0.82 + Math.sin(u * Math.PI * 6) * 0.02, z: TABLE.z - 0.1, k: ramp(f, 1310, 1330), sealK: smooth(ramp(f, 1405, 1427)) };
};
export const biscuitAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'biscuit') return { k: 1 }; // in the parrot's beak
  return { k: 0 };
};

// ---------- hero / focus ----------
const FOCUS = {
  morning: () => { const k = kingAt(80); return [k.x, 1.3, k.z]; },
  hunt: () => { const k = kingAt(200); return [k.x, 1.3, k.z]; },
  square: () => [0, -0.5, 12],
  fool: () => { const w = foolAt(480); return [w.x, 1.35, w.z]; },
  parrot: () => [PERCH[0], PERCH[1] + 0.2, PERCH[2]],
  plan: () => { const w = foolAt(770); return [w.x, 1.3, w.z]; },
  dialogue: () => { const w = foolAt(900); return [w.x, 1.45, w.z]; },
  balcony: () => { const k = kingAt(1030); return [k.x, 1.4, k.z]; },
  whisper: () => [2.0, 1.5, -12.3],
  cheer: () => [0, 0, 10],
  biscuit: () => [PERCH[0], PERCH[1] + 0.2, PERCH[2]],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: v4 ACTION RIG — every move keyed to the subject ----------
// Dense keysCam authoring (valleyfly grammar): fast eased punch-ins at
// action starts ('easeInOut' arrival keys), tracking at subject speed,
// micro-push holds instead of static frames, declared kicks on impacts.
// Head-size math: card head ~0.74 world units wide; fraction of frame
// width = 0.74 / (2 * dist * tan(fov/2) * 0.5625).
const IO = 'easeInOut';
const RIG_BY_ID = {
  // MORNING: hero BIG from frame 0 (head ~38%), approach, then a fast
  // punch-in as the king opens his mouth (f58-73, head -> ~75%); the
  // silence lands with a kick at f92 ("nothing", 3.06 s).
  morning: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [1.35, 1.5, -7.75], look: [0, 1.38, -11], fov: 35 },
    { f: 58, pos: [1.28, 1.47, -7.95], look: [0, 1.39, -11], fov: 34.5, ease: IO },
    { f: 66, pos: [1.15, 1.44, -8.45], look: [0, 1.4, -11], fov: 33.5, ease: IO },
    { f: 73, pos: [1.05, 1.42, -8.85], look: [0, 1.4, -11], fov: 33, ease: IO },
    { f: 132, pos: [1.02, 1.42, -8.8], look: [0, 1.4, -11], fov: 33, ease: IO }] }) },
  // HUNT: push-in on the pained king as "stolen his voice" lands
  // (f182-205, head 33% -> ~68%).
  hunt: { cut: 'hard', raw: keysCam({ keys: [
    { f: 133, pos: [2.6, 1.7, -5.6], look: [0, 1.3, -11], fov: 38 },
    { f: 182, pos: [1.9, 1.55, -7.5], look: [0, 1.35, -11], fov: 35, ease: IO },
    { f: 205, pos: [1.6, 1.52, -8.1], look: [0, 1.38, -11], fov: 33, ease: IO },
    { f: 268, pos: [1.55, 1.52, -8.0], look: [0, 1.38, -11], fov: 33, ease: IO }] }) },
  // SQUARE: high wide over the ten thousand, then a DIVE down to the
  // king on the terrace as "depended on that speech" lands; the title
  // board (f372-412) stays centred behind him, fully in frame.
  square: { cut: 'hard', raw: keysCam({ keys: [
    { f: 269, pos: [5.5, 4.2, 24.5], look: [0, 1.4, 5], fov: 44 },
    { f: 340, pos: [3.4, 3.2, 20.5], look: [0.1, 1.6, 4], fov: 42, ease: IO },
    { f: 385, pos: [1.6, 2.6, 16.4], look: [0.05, 1.85, 1], fov: 40, ease: IO },
    { f: 414, pos: [1.2, 2.3, 13.8], look: [0, 1.95, -0.5], fov: 38, ease: IO }] }) },
  // FOOL: punch-in on the grin ("smiling", f448) to a ~76% reaction
  // close-up; his gaze swings to the curtain as the parrot is named.
  fool: { cut: 'hard', raw: keysCam({ keys: [
    { f: 415, pos: [5.3, 1.65, -5.9], look: [2.6, 1.35, -10.5], fov: 38 },
    { f: 448, pos: [4.15, 1.53, -7.75], look: [2.6, 1.4, -10.5], fov: 34, ease: IO },
    { f: 466, pos: [3.78, 1.5, -8.55], look: [2.6, 1.42, -10.5], fov: 33, ease: IO },
    { f: 555, pos: [3.7, 1.5, -8.65], look: [2.6, 1.42, -10.5], fov: 33, ease: IO }] }) },
  // PARROT: start on the fool, fast reframe to the parrot insert
  // (f556-585), then push-ins as the mimicry builds (insert -> ~91%).
  parrot: { cut: 'hard', raw: keysCam({ keys: [
    { f: 556, pos: [4.6, 1.8, -8.6], look: [2.6, 1.35, -10.5], fov: 38 },
    { f: 585, pos: [3.6, 1.9, -10.6], look: [2.1, 1.8, -12.45], fov: 36, ease: IO },
    { f: 640, pos: [3.3, 1.88, -11.0], look: [2.1, 1.82, -12.45], fov: 35, ease: IO },
    { f: 710, pos: [3.15, 1.85, -11.2], look: [2.1, 1.82, -12.45], fov: 34, ease: IO }] }) },
  // PLAN: two-shot push-in; the look dips WITH the bow (f724-796),
  // then settles on the fool as he points out the plan (wink at f806).
  plan: { cut: 'hard', raw: keysCam({ keys: [
    { f: 711, pos: [5.6, 2.0, -5.6], look: [1.2, 1.2, -10.6], fov: 40 },
    { f: 760, pos: [4.6, 1.75, -6.8], look: [1.2, 1.1, -10.5], fov: 37, ease: IO },
    { f: 800, pos: [4.1, 1.7, -7.4], look: [1.3, 1.3, -10.2], fov: 35, ease: IO },
    { f: 844, pos: [3.9, 1.65, -7.7], look: [1.3, 1.35, -10.1], fov: 34, ease: IO }] }) },
  // DIALOGUE: fast punch-in (13 frames) to the speaking face ~69%,
  // then the camera HOLDS on the speaker (micro-push only).
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: 845, pos: [4.0, 1.66, -7.3], look: [1.3, 1.4, -10], fov: 35 },
    { f: 852, pos: [3.55, 1.61, -7.95], look: [1.3, 1.43, -10], fov: 34.5, ease: IO },
    { f: 858, pos: [3.2, 1.58, -8.6], look: [1.3, 1.45, -10], fov: 34, ease: IO },
    { f: 970, pos: [3.12, 1.57, -8.68], look: [1.3, 1.45, -10], fov: 33.5, ease: IO }] }) },
  // BALCONY: front three-quarter TRACKING at the king's march speed —
  // the camera retreats ahead of him, head ~41% the whole way.
  balcony: { cut: 'hard', raw: keysCam({ keys: [
    { f: 971, pos: [1.7, 1.5, -1.8], look: [0, 1.35, -6], fov: 38 },
    { f: 1030, pos: [1.65, 1.45, 4.6], look: [0, 1.35, 0.9], fov: 36, ease: IO },
    { f: 1092, pos: [1.6, 1.5, 11.8], look: [0, 1.4, 7.4], fov: 34, ease: IO }] }) },
  // WHISPER: close on the fool whispering over his scroll, punch to
  // the parrot as the thunder starts (kick at f1103), build closer.
  whisper: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1093, pos: [4.8, 2.1, -7.6], look: [2.0, 1.45, -12.1], fov: 37 },
    { f: 1190, pos: [4.2, 2.0, -8.4], look: [2.05, 1.55, -12.25], fov: 35, ease: IO },
    { f: 1288, pos: [3.7, 2.0, -9.4], look: [2.1, 1.55, -12.4], fov: 34, ease: IO }] }) },
  // CHEER: crowd wide, swing toward the terrace, then a fast dive
  // (17 frames) to the treaty-table insert for the signing; the wax
  // seal stamps with a kick at f1410.
  cheer: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1289, pos: [3.4, 1.9, 20.5], look: [0, 1.5, 7.6], fov: 42 },
    { f: 1320, pos: [5.8, 3.0, 16.5], look: [2.5, 1.0, 5.5], fov: 40, ease: IO },
    { f: 1356, pos: [6.2, 1.75, 8.4], look: [4.6, 0.84, 3.55], fov: 36, ease: IO },
    { f: 1427, pos: [6.0, 1.7, 8.1], look: [4.6, 0.83, 3.5], fov: 34, ease: IO }] }) },
  // BISCUIT: parrot close as it "speaks"; at the word "biscuit"
  // (f1547) a 14-frame punch to the fool's horrified face (~72%) —
  // his flinch (jumpTrack) and a kick land on the same frame.
  biscuit: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1428, pos: [3.6, 1.9, -10.4], look: [2.1, 1.8, -12.45], fov: 36 },
    { f: 1538, pos: [3.5, 1.88, -10.55], look: [2.08, 1.78, -12.42], fov: 35, ease: IO },
    { f: 1552, pos: [3.6, 1.72, -10.6], look: [2.0, 1.5, -11.95], fov: 34, ease: IO },
    { f: 1576, pos: [3.8, 1.78, -10.3], look: [2.05, 1.55, -12.1], fov: 35, ease: IO }] }) },
  // HOOK: one continuous push-in across hookq+hook (blend entry). The
  // board ends ~84% of frame width, centred, fully inside with margins;
  // the king stands in the lower foreground (head ~34%) pointing up.
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1577, pos: [2.4, 2.8, 9.6], look: [0, 2.95, -5], fov: 40 },
    { f: 1650, pos: [2.15, 2.7, 9.2], look: [0, 2.97, -5], fov: 39, ease: IO }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1651, pos: [2.15, 2.7, 9.2], look: [0, 2.97, -5], fov: 39 },
    { f: 1733, pos: [1.95, 2.65, 8.95], look: [0, 3.0, -5], fov: 38, ease: IO }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 92, a: 0.05 }, { f: 1103, a: 0.10 }, { f: 1410, a: 0.10 }, { f: 1547, a: 0.12 }],
  sigma: 1.7, smoothRadius: 5, fovSigma: 1.1,
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
  if (['square', 'hookq'].includes(S.id)) cinf = 1.4;
  if (['morning', 'dialogue', 'parrot', 'biscuit'].includes(S.id)) cinf = 3.6;
  if (S.id === 'whisper') cinf = 2.2;   // two-shot: fool + parrot both stay readable
  if (S.id === 'hook') cinf = 1.6;   // v4: board AND foreground king both stay readable
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), p = parrotAt(f), ql = quillAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    parrotBeak: p.beak, parrotBob: p.bob, parrotTilt: p.headTilt,
    ringsK: ringsAt(f),
    quillX: ql.x, quillY: ql.y, quillZ: ql.z, quillK: ql.k, sealK: ql.sealK,
    biscuitK: biscuitAt(f).k,
    dustK: 0.05,
  };
  if (S.id === 'square') W.boardTitle = smooth(ramp(f, 372, 386)) * (1 - smooth(ramp(f, 398, 412)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1600, 1624));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: 0, grey: 0, ringsRate: ringsAt(f) };
};
export const fxAt = () => [];

// ---------- the fool's speech scroll (card-space overlay, S9) ----------
// Drawn in the fool's own card so hand and parchment move in the same
// frames: the parchment unrolls as gripAt's k rises; the two rolled
// ends sit exactly under the armPose hands.
const scrollOv = (k) => (p) => {
  if (k < 0.04) return;
  const hw = 106 * k, cy = 602, hh = 36;
  p.poly([[300 - hw, cy - hh], [300 + hw, cy - hh], [300 + hw, cy + hh], [300 - hw, cy + hh]], '#f3e3bb', 3);
  p.ell(300 - hw, cy, 10, hh + 4, '#d9c48f', 3);
  p.ell(300 + hw, cy, 10, hh + 4, '#d9c48f', 3);
  if (k > 0.5) { // ink lines of the speech text
    for (let i = -1; i <= 1; i++) p.line([[300 - hw * 0.72, cy + i * 15], [300 + hw * 0.72, cy + i * 15]], '#8a6f42', 3.4, false);
  }
};
const scrollHands = (k) => {
  const lx = lerp(222, 300 - 106 * k, k), rx = lerp(378, 300 + 106 * k, k), hy = lerp(652, 606, k);
  return {
    armPose: {
      L: { hand: [q(lx, 1), q(hy, 1)], grip: q(0.9 * k, 2), front: true },
      R: { hand: [q(rx, 1), q(hy, 1)], grip: q(0.9 * k, 2), front: true },
    },
  };
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { royalgold: '#ffffff', dusk: '#ffffff' };   // V3: no card tint in any light
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#8a2432', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#fbf7ef' },
  fool: { jacket: '#7a2a6e', pants: '#2c4a6e', boots: '#241a12', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef' },
  court1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef' },
  court2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef', moustache: '#241a12' },
  guard: { jacket: '#5a2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'shako', skin: '#fbf7ef' },
};
const CROWD_JACKETS = ['#7a4a2a', '#2c4a6e', '#4a6a3a', '#8a2432', '#6a4a7a', '#3a6a5a', '#9a5a3a', '#5a5a5a'];
const CROWD_SKINS = ['#fbf7ef'];
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts) + (extra.ovKey || ''), draw: (p) => { T.bodyFront(p, o, opts); if (extra.ovDraw) extra.ovDraw(p); }, x: x + (extra.dx || 0), y: extra.y ?? 0, z, ground: 0, tint, ...extra }) });
  const crowd = (id, idx, x, z, j, sk, cheer) => {
    const o = { jacket: j, pants: '#33302c', boots: '#1c1712', hat: 'hair', hair: '#1c1410', skin: sk };
    const ph = q((f * 0.011 + idx * 0.13) % 1, 2);
    const opts = { expr: cheer ? 'laugh' : 'neutral', mode: 'stand', blink: blinkAt(f, 70 + idx), seed: 70 + idx, phase: ph,
      breath: f + (70 + idx) * 41, tilt: q(0.8 * Math.sin(f * 0.011 + (70 + idx) * 2.3), 2) };
    out.push({ id, x, y: -2.5, z, r: 0.32, ground: -2.5,
      actor: (T) => ({ key: 'crowd' + id + (cheer ? 'c' : '') + Math.floor(ph * 4) + ':' + (f % 24), draw: (p) => T.bodyFront(p, o, opts), x, y: -2.5, z, ground: -2.5, tint, yaw: 0 }) });
  };
  const k = kingAt(f), w = foolAt(f), c1 = c1At(f);
  const kBase = { expr: 'stern', exprP: kingFace(f), mode: kingMode(f), phase: q(kingPhase(f), 2), blink: blinkAt(f, 44), seed: 41, ...lifeOpts(LIFE.king, f) };
  const wBase = { expr: 'grin', exprP: foolFaceW(f), mode: foolMode(f), phase: q(foolPhase(f), 2), blink: blinkAt(f, 31), seed: 31, ...lifeOpts(LIFE.fool, f) };
  switch (S.id) {
    case 'morning': {
      // the king opens his mouth — and nothing comes out (shock, then pain)
      std('king', OUTFITS.king, { ...kBase, headTilt: q((f >= 50 ? 0.1 : 0) + (lifeOpts(LIFE.king, f).headTilt || 0), 2) }, k.x, k.z, { yaw: 0.1 });
      std('guard1', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...lifeOpts(LIFE.guard1, f, 0.5) }, -3, -11.5, {});
      std('guard2', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62, ...lifeOpts(LIFE.guard2, f, 0.5) }, 3, -11.5, {});
      break;
    }
    case 'hunt': {
      std('king', OUTFITS.king, { ...kBase, headTilt: q(0.16 + (lifeOpts(LIFE.king, f).headTilt || 0), 2) }, k.x, k.z, { yaw: -0.25 });
      std('court1', OUTFITS.court1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...lifeOpts(LIFE.court1, f) }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'square': {
      std('king', OUTFITS.king, { ...kBase }, 0, 7.6, {});
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
        const x = -12 + i * 3 + (r % 2 ? 1.5 : 0), z = 13 + r * 3;
        crowd(`c${r}${i}`, r * 9 + i, x, z, CROWD_JACKETS[(r * 9 + i) % 8], CROWD_SKINS[(r * 9 + i) % 1], false);
      }
      break;
    }
    case 'fool': {
      const G = foolGaze(f);
      std('fool', OUTFITS.fool, { ...wBase, prop: ['point', 0.5], look: q(G.look, 2), lookY: q(G.lookY, 2), facing: q(G.facing, 2) }, w.x, w.z, { yaw: -0.5 });
      std('king', OUTFITS.king, { ...kBase }, k.x, k.z, { yaw: 0.5 });
      break;
    }
    case 'parrot': {
      std('fool', OUTFITS.fool, { ...wBase, look: 0.35, lookY: -0.15 }, w.x, w.z, { yaw: -0.4 });
      break;
    }
    case 'plan': {
      const bowK = smooth(ramp(f, 724, 748)) * (1 - smooth(ramp(f, 772, 796)));
      std('fool', OUTFITS.fool, { ...wBase, headTilt: q(bowK * 0.38 + (lifeOpts(LIFE.fool, f).headTilt || 0), 2), prop: f >= 796 ? ['point', 0.85] : null }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { ...kBase }, k.x, k.z, { yaw: -0.55 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the fool PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; his free
      // hand gestures with the voice; the king only listens (his mouth
      // never opens: narration stays voice-over).
      const G = foolGesture(f);
      std('fool', OUTFITS.fool, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, prop: G.on ? ['point', q(G.k, 2)] : null, ...lifeOpts(LIFE.fool, f), ...speakFace('grin', f) }, w.x, w.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { ...kBase, look: 0.3 }, k.x, k.z, { yaw: -0.5 });
      break;
    }
    case 'balcony': {
      // the king steps onto the terrace and moves his lips SILENTLY —
      // mimeFace oscillates his mouth gently; the voice is the parrot's.
      std('king', OUTFITS.king, { mode: kingMode(f), phase: q(kingPhase(f), 2), blink: blinkAt(f, 44), seed: 41, ...lifeOpts(LIFE.king, f), ...mimeFace(f) }, k.x, k.z, {});
      std('court1', OUTFITS.court1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...lifeOpts(LIFE.court1, f) }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'whisper': {
      // the fool whispers the speech from his scroll — two-hand grip
      // (armPose finger-wraps + the scroll overlay in his own card),
      // weight dip while he holds it; head leaned toward the parrot.
      const G = scrollGrip(f);
      const dip = Math.max(G.squash, G.holding ? carryDip(f, 0.3) : 0);
      std('fool', OUTFITS.fool, { ...wBase, headTilt: q(0.12 + (lifeOpts(LIFE.fool, f).headTilt || 0), 2), look: 0.3, squash: q(dip, 3), ...(G.k > 0.02 ? scrollHands(G.k) : {}) }, w.x, w.z,
        { yaw: 0.4, ovKey: 'scroll' + q(G.k, 2), ovDraw: scrollOv(G.k) });
      break;
    }
    case 'cheer': {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
        const x = -12 + i * 3 + (r % 2 ? 1.5 : 0), z = 13 + r * 3;
        crowd(`c${r}${i}`, r * 9 + i, x, z, CROWD_JACKETS[(r * 9 + i) % 8], CROWD_SKINS[(r * 9 + i) % 1], f >= 1289 && f < 1340);
      }
      std('king', OUTFITS.king, { ...kBase }, 0, 7.6, {});
      std('court1', OUTFITS.court1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: f >= 1340 ? ['point', 0.45] : null, ...lifeOpts(LIFE.court1, f) }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'biscuit': {
      // the fool is right beside the parrot when the voice slips — his
      // horrified reaction (emoTrack shock -> nervous + jumpTrack
      // flinch at f1547) is the payoff beat of the shot.
      const J = foolFlinch(f);
      std('fool', OUTFITS.fool, { ...wBase, squash: q(Math.max(J.squash, wBase.squash || 0), 3), headTilt: q((lifeOpts(LIFE.fool, f).headTilt || 0) - J.lean * 0.02, 2) }, w.x, w.z, { yaw: 0.4, y: q(J.y, 3), dx: 0 });
      std('court1', OUTFITS.court1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...lifeOpts(LIFE.court1, f) }, c1.x, c1.z, { yaw: -0.3 });
      std('court2', OUTFITS.court2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...lifeOpts(LIFE.court2, f) }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'hookq': case 'hook': {
      // R2 final: character beat + hook board TOGETHER — the king in
      // the foreground pointing up at the board, mouth closed (the
      // ending is narration + board only; nobody speaks).
      std('king', OUTFITS.king, { ...kBase, prop: ['point', 0.35], look: -0.25, lookY: 0.3 }, HOOK_KING.x, HOOK_KING.z, { yaw: 0.18 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 14, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 14, { h: 2.6, id: 'wallE' }),
  SOL.obb(THRONE.x, THRONE.z, 0, 0.9, 0.7, { h: 1.6, id: 'throne' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.aabb(-16, -2, 7.6, 8.4, { h: 1.1, id: 'balustradeW' }),
  SOL.aabb(2, 16, 7.6, 8.4, { h: 1.1, id: 'balustradeE' }),
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
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
