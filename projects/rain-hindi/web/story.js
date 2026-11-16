// Shot plan for "वो किसान जिसने बारिश बेच दी" (batch-5 topic 5, HI) —
// timed to the ACTUAL Hindi voice stem (59.651 s, 30 fps, TOTAL 1790), clause
// timings from faster-whisper small hi + segment clause map (work/timing.json).
// 22 clauses (CL = clause start frames, index 0 = C1):
// C1 बारिश नहीं हुई थी, खेत फट रहे थे, और राजा परेशान था
// C2 तभी एक ग़रीब किसान महल में एक ऐसा प्रस्ताव लेकर आया जो पहले किसी ने नहीं दिया था
// C3 मैं आपको कल की बारिश बेचूँगा, महाराज। सौ सोने के सिक्के
// C4 और अगर कल सूरज डूबने तक बारिश नहीं हुई, तो मैं आपको दोगुने पैसे वापस दूँगा
// C5 मंत्री हँस पड़े
// C6 राजा ने आँखें सिकोड़ लीं। तुम बारिश नहीं बेच सकते। बारिश आसमान की है
// C7 तो आसमान को मुझसे सहमत होना होगा, किसान ने कहा
// C8 और परेशान राजा ने पैसे दे दिए
// C9 उस शाम किसान ने दुआ नहीं माँगी। उसने देखा
// C10 उसने चींटियों को लंबी कतारों में पहाड़ी पर चढ़ते देखा
// C11 उसने हवा को मुड़ते और हवा को भारी होते देखा
// C12 उसने बादलों को पहाड़ियों पर काले घिरते देखा
// C13 वह मुस्कुराया। आसमान ने वादा कर ही दिया था
// C14 अगले दिन बारिश मूसलाधार बरसी
// C15 खेतों ने पानी पिया, नदियाँ भर गईं, और पूरा राज्य झूम उठा
// C16 राजा ने किसान को बुलाकर उसका राज़ पूछा
// C17 किसान ने झुककर कहा, मैंने आपको बारिश नहीं बेची, महाराज
// C18 मैंने आसमान का वादा बेचा। चींटियों ने बताया। हवा ने बताया। बारिश कभी मेरी थी ही नहीं
// C19 राजा पेट पकड़कर हँसा — और फिर भी उसे दोगुने पैसे दे दिए
// C20 तो कल, उसने कहा, मुझे धूप बेच देना
// C21 पर कल मिलिए उस औरत से जिसने राजा को एक ऐसी हाँड़ी बेच दी जो खाना ख़ुद ही पका देती है
// C22 भला बिना आग के हाँड़ी खाना कैसे पकाती है?
// QUALITY RULES (locked): shots change ONLY at clause boundaries; camera TRACKS
// the voice-named subject every beat, never freezes, never drifts; costumes by
// role (king = royal maroon + gold, 3D crown; farmer = poor, worn dusty clothes,
// cloth head-wrap; ministers = rich dress); PHYSICS: the gold pouch rests ON the
// table / travels hand-to-hand with a weight sag + settle (never floats); ants
// march UPHILL in a line on the hill slope, feet on the ground; rain falls with
// gravity and stops at the ground (puddles grow); the crown slips ON the king's
// head when he laughs.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1790, DECK = 0;
// Clause start frames C1..C22 (+ end sentinel) — from work/timing.json (ASR).
export const CL = [0, 69, 177, 263, 361, 395, 499, 570, 620, 688, 760, 835, 906, 976, 1021, 1116, 1179, 1260, 1403, 1483, 1544, 1720, 1790];
const c0 = (i) => CL[i - 1];            // start frame of clause i (1-based)
const c1 = (i) => CL[i] - 1;            // last frame of clause i

export const SHOTS = [
  { id: 'field', a: c0(1), b: c1(1), light: 'drought' },
  { id: 'court', a: c0(2), b: c1(8), light: 'court' },
  { id: 'watch', a: c0(9), b: c1(13), light: 'eve' },
  { id: 'rain', a: c0(14), b: c1(15), light: 'storm' },
  { id: 'court2', a: c0(16), b: c1(20), light: 'court' },
  { id: 'hook', a: c0(21), b: c1(22), light: 'eve' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- staging ----------
export const KINGP = [-16, 0.3, -5.9];            // on the dais, before the throne
export const KING_YAW = 0.12, KING_S = 1.06;
export const FARM_FIELD = [1.2, 0, -0.8];         // farmer in his cracked field
export const FARM_COURT = [-13.9, 0, -3.7];       // farmer before the dais
export const FARM_RAIN = [0.6, 0, -0.6];          // farmer standing in the rain
export const FARM_HOME = [2.3, 0, -1.5];          // farmer back home (hook shot)
export const HILL = [-4.5, 0, -9];                 // ant hill mound (cone r=3.2 h=1.6), WEST of the signposts
export const ANT_A = [-3.2, 0.06, -6.9];           // ant line base (hill foot)
export const ANT_B = [-4.5, 1.52, -9.0];           // ant line top (hill crest)
export const TABLE = [-14.1, 0.67, -4.3];         // low table before the dais; top y=0.67
export const kingAt = (f) => ({ pos: KINGP, yaw: KING_YAW, s: KING_S });

// ---------- the gold pouches (hand-to-hand physics) ----------
// Pouch 1: rests ON the table -> king hands it over at C8 -> farmer carries it.
// Pouch 2 (the double payment): rests ON the table from C16 -> handed over at C19.
const POUCH1_REST = [-13.45, 0.85, -4.1];
const POUCH2_REST = [-13.45, 0.85, -4.1];
const KINGHAND = [-15.35, 1.04, -4.72];
const MID1 = [-14.55, 0.95, -4.15];
const FARM_HAND = [-13.52, 1.06, -3.66];          // farmer's raised hand (court)
const FARM_HAND2 = [-14.28, 1.06, -3.66];         // farmer's other hand (court)
const handInField = (base) => [base[0] + 0.38, 0.97, base[2] + 0.06];
const handInField2 = (base) => [base[0] - 0.38, 0.97, base[2] + 0.06];
const arc = (f, h0, rest, mid, hand, dur = 38) => {
  const arr = h0 + dur;
  if (f < h0) return { p: rest, sq: 1, tilt: 0 };
  if (f < arr) {
    const p = kf3([[h0, rest], [h0 + 11, KINGHAND], [h0 + 24, mid], [arr, hand]], f);
    return { p, sq: 1 - 0.05 * Math.sin(ramp(f, h0 + 11, arr) * Math.PI), tilt: 0.1 * Math.sin(ramp(f, h0, arr) * Math.PI) };
  }
  const u = clamp((f - arr) / 18);
  const dip = f < arr + 18 ? Math.sin(u * Math.PI) : 0;
  return { p: [hand[0], hand[1] - 0.06 * dip + 0.008 * Math.sin(f * 0.09), hand[2]], sq: 1 - 0.1 * dip, tilt: 0.05 * dip };
};
export const bagAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'court' && f >= c0(8)) return arc(f, c0(8) + 2, POUCH1_REST, MID1, FARM_HAND);
  if (S.id === 'court') return { p: POUCH1_REST, sq: 1, tilt: 0 };
  if (S.id === 'watch') return { p: handInField(FARM_FIELD), sq: 1, tilt: 0.04 };
  if (S.id === 'rain') return { p: handInField(FARM_RAIN), sq: 1, tilt: 0.04 };
  if (S.id === 'court2') return { p: handInField(FARM_COURT), sq: 1, tilt: 0.04 };
  if (S.id === 'hook') return { p: handInField(FARM_HOME), sq: 1, tilt: 0.04 };
  return { p: POUCH1_REST, sq: 1, tilt: 0 };
};
export const bag2At = (f) => {
  const S = shotAt(f);
  if (S.id === 'court2' && f >= c0(19)) return arc(f, c0(19) + 2, POUCH2_REST, MID1, FARM_HAND2);
  if (S.id === 'court2') return { p: POUCH2_REST, sq: 1, tilt: 0 };
  if (S.id === 'hook') return { p: handInField2(FARM_HOME), sq: 1, tilt: 0.04 };
  return null; // pouch 2 does not exist yet (hidden)
};

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  drought: { az: 235, el: 38, sky: '#e8c898', ground: '#6b563c', hemi: 1.15, sun: '#ffd9a0', sunI: 2.3, fog: '#e0c8a0', fogNear: 44, fogFar: 360,
    skyTop: '#7a86b0', skyHor: '#f2d9a8', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.06, vig: 0.2, shadowExt: 150, aurora: 0, gain: '#ffe8d2', ...WATER },
  eve: { az: 235, el: 20, sky: '#e8b48a', ground: '#5f5240', hemi: 1.05, sun: '#ffb877', sunI: 2.0, fog: '#e0c2a0', fogNear: 44, fogFar: 360,
    skyTop: '#6a5a9e', skyHor: '#ffd9a8', sunDisc: '#ffdfae', sunSize: 0.004, sat: 1.06, vig: 0.2, shadowExt: 150, aurora: 0, gain: '#ffe8d2', ...WATER },
  court: { az: 130, el: 30, sky: '#d8b490', ground: '#5c4a34', hemi: 1.08, sun: '#ffcf96', sunI: 2.0, fog: '#dcc49c', fogNear: 40, fogFar: 320,
    skyTop: '#565a8c', skyHor: '#ffdfae', sunDisc: '#fff0c8', sunSize: 0.0032, sat: 1.06, vig: 0.23, shadowExt: 150, aurora: 0, gain: '#ffedd0', ...WATER },
  storm: { az: 200, el: 42, sky: '#8a94a8', ground: '#4a4a52', hemi: 1.0, sun: '#b8c4d8', sunI: 1.35, fog: '#7a8296', fogNear: 38, fogFar: 300,
    skyTop: '#2e3448', skyHor: '#6a7288', sunDisc: '#c8d2e0', sunSize: 0.002, sat: 1.0, vig: 0.3, shadowExt: 150, aurora: 0, gain: '#c8d2e8', ...WATER },
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
  if (S.id === 'watch') return blendLight(LIGHTS.drought, LIGHTS.eve, smooth(ramp(f, c0(9), c0(11))));
  if (S.id === 'rain') return blendLight(LIGHTS.eve, LIGHTS.storm, smooth(ramp(f, c0(14), c0(14) + 24)));
  if (S.id === 'court2') return blendLight(LIGHTS.storm, LIGHTS.court, smooth(ramp(f, c0(16), c0(16) + 24)));
  if (S.id === 'hook') return blendLight(LIGHTS.court, LIGHTS.eve, smooth(ramp(f, c0(21), c0(21) + 30)));
  return { ...LIGHTS[S.light] };
};

const HERO = {
  field: () => FARM_FIELD,
  court: (f) => (f < c0(5) ? FARM_COURT : (f < c0(6) ? KINGP : (f < c0(7) ? KINGP : FARM_COURT))),
  watch: (f) => (f < c0(10) ? FARM_FIELD : (f < c0(11) ? [-4.0, 0.9, -8.0] : (f < c0(12) ? [-3.0, 3.5, -7.5] : (f < c0(13) ? [-4.0, 6.0, -9.5] : FARM_FIELD)))),
  rain: () => FARM_RAIN,
  court2: (f) => (f < c0(17) ? KINGP : (f < c0(19) ? FARM_COURT : KINGP)),
  hook: (f) => (f < c0(22) ? FARM_HOME : [4.4, 2.3, -3.2]),
};
export const heroPosAt = (f) => {
  const h = HERO[shotAt(f).id](f);
  return [h[0], h[1] ?? 1.0, h[2]];
};

// ---------- cameras ----------
// Continuous flight: every shot's first key repeats the previous shot's last
// key; inside a shot a key lands on each clause boundary, surging TO the
// clause's subject. Field at x≈1, court at x=-16.
const CAMS = {
  field: [
    { f: c0(1), pos: [5.6, 3.0, 6.2], look: [1.0, 1.4, -2.0], fov: 44 },
    { f: c1(1), pos: [5.2, 2.9, 5.9], look: [1.1, 1.2, -1.2], fov: 43, ease: 'surge' },
  ],
  court: [
    { f: c0(2), pos: [5.2, 2.9, 5.9], look: [1.1, 1.2, -1.2], fov: 43 },
    { f: c0(3), pos: [-6.5, 2.8, 2.5], look: [-13.5, 1.2, -4.2], fov: 44, ease: 'surge' },
    { f: c0(4), pos: [-10.6, 2.2, -0.6], look: [-15.6, 1.35, -5.6], fov: 42, ease: 'surge' },
    { f: c0(5), pos: [-11.0, 2.1, -0.9], look: [-14.2, 1.0, -4.0], fov: 42, ease: 'surge' },
    { f: c0(6), pos: [-12.9, 2.1, -2.0], look: [-15.9, 1.55, -5.85], fov: 37, ease: 'surge' },
    { f: c0(7), pos: [-11.7, 1.9, -1.0], look: [-13.9, 1.0, -3.7], fov: 40, ease: 'surge' },
    { f: c0(8), pos: [-11.5, 2.0, -0.8], look: [-14.2, 1.0, -3.9], fov: 41, ease: 'surge' },
    { f: c1(8), pos: [-11.3, 2.0, -0.7], look: [-14.0, 1.0, -3.8], fov: 41, ease: 'surge' },
  ],
  watch: [
    { f: c0(9), pos: [-11.3, 2.0, -0.7], look: [-14.0, 1.0, -3.8], fov: 41 },
    { f: c0(9) + 20, pos: [5.2, 2.6, 5.2], look: [1.4, 1.1, -1.2], fov: 43, ease: 'surge' },
    { f: c0(10), pos: [-2.5, 1.2, -2.0], look: [-4.2, 1.0, -8.5], fov: 36, ease: 'surge' },
    { f: c0(11), pos: [-1.5, 3.0, 0.4], look: [-3.5, 3.5, -7.5], fov: 40, ease: 'surge' },
    { f: c0(12), pos: [-0.5, 3.0, 1.2], look: [-4.0, 6.0, -9.5], fov: 38, ease: 'surge' },
    { f: c0(13), pos: [5.4, 2.4, 3.4], look: [1.3, 1.1, -0.9], fov: 40, ease: 'surge' },
    { f: c1(13), pos: [5.0, 2.4, 3.6], look: [1.3, 1.15, -0.9], fov: 39, ease: 'surge' },
  ],
  rain: [
    { f: c0(14), pos: [5.0, 2.4, 3.6], look: [1.3, 1.15, -0.9], fov: 39 },
    { f: c0(14) + 18, pos: [4.4, 2.2, 3.0], look: [0.7, 1.0, -0.7], fov: 38, ease: 'surge' },
    { f: c0(15), pos: [6.2, 3.0, 5.0], look: [0.8, 0.9, -1.0], fov: 44, ease: 'surge' },
    { f: c1(15), pos: [6.0, 2.9, 4.8], look: [0.8, 0.9, -1.0], fov: 44, ease: 'surge' },
  ],
  court2: [
    { f: c0(16), pos: [6.0, 2.9, 4.8], look: [0.8, 0.9, -1.0], fov: 44 },
    { f: c0(17), pos: [-10.9, 2.1, -0.7], look: [-14.2, 1.0, -4.0], fov: 42, ease: 'surge' },
    { f: c0(18), pos: [-11.8, 1.9, -1.1], look: [-13.9, 1.0, -3.7], fov: 41, ease: 'surge' },
    { f: c0(19), pos: [-12.8, 2.05, -1.9], look: [-15.9, 1.5, -5.85], fov: 38, ease: 'surge' },
    { f: c0(20), pos: [-11.9, 2.0, -1.2], look: [-14.7, 0.95, -4.3], fov: 42, ease: 'surge' },
    { f: c1(20), pos: [-11.6, 2.0, -1.0], look: [-14.4, 1.0, -4.0], fov: 41, ease: 'surge' },
  ],
  hook: [
    { f: c0(21), pos: [-11.6, 2.0, -1.0], look: [-14.4, 1.0, -4.0], fov: 41 },
    { f: c0(21) + 20, pos: [4.8, 2.3, 1.8], look: [2.2, 1.1, -1.4], fov: 40, ease: 'surge' },
    { f: 1627, pos: [4.3, 2.2, 1.5], look: [2.3, 1.1, -1.5], fov: 39, ease: 'surge' },  // C21 spoken end (timing.json); the 93f pause drifts to the board
    { f: c0(22), pos: [1.35, 2.05, 2.5], look: [4.4, 2.25, -3.2], fov: 37, ease: 'surge' },
    { f: c1(22), pos: [1.35, 2.05, 2.5], look: [4.4, 2.25, -3.2], fov: 37, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['court', 'court2'].includes(S.id) && f >= c0(6) && f < c0(7)) cinf = 3.6;
  if (S.id === 'watch' && f >= c0(10) && f < c0(11)) cinf = 3.4;
  if (S.id === 'rain') cinf = 3.6;
  if (S.id === 'hook') cinf = 3.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardHook: 0, crown: 0, crownSlip: 0, rainT: 0, cloudDark: 0, puddle: 0, ants: 0, sandT: -1, pileGrow: 0 };
  if (S.id === 'field') W.boardTitle = 1 - smooth(ramp(f, c0(1) + 40, c0(1) + 62));
  if (['court', 'court2'].includes(S.id)) W.crown = 1;
  if (S.id === 'court2') {
    const s0 = c0(19) + Math.round((c1(19) - c0(19)) * 0.55); // "पेट पकड़कर हँसा" lands mid-C19
    W.crownSlip = kf([[s0, 0], [s0 + 13, 1.18], [s0 + 23, 0.9], [s0 + 33, 1.0]], f);
  }
  if (S.id === 'watch') {
    W.ants = smooth(ramp(f, c0(10) - 6, c0(10) + 10)) * (1 - smooth(ramp(f, c0(13), c0(13) + 20)));
    W.cloudDark = smooth(ramp(f, c0(12), c0(12) + 40));
  }
  if (S.id === 'rain') {
    W.rainT = smooth(ramp(f, c0(14), c0(14) + 24));
    W.cloudDark = 1;
    W.puddle = smooth(ramp(f, c0(15), c0(15) + 40));
  }
  if (S.id === 'court2') { W.cloudDark = 1 - smooth(ramp(f, c0(16), c0(16) + 24)); W.puddle = 1; }
  if (S.id === 'hook') { W.cloudDark = 0; W.puddle = 1; W.boardHook = smooth(ramp(f, c0(22) + 2, c0(22) + 26)); }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return {
    smokeRate: S.id === 'watch' ? 0.3 : (S.id === 'rain' ? 0.1 : 0.25),
    dustRate: S.id === 'watch' && f >= c0(11) && f < c0(12) ? 0.5 : 0.12,
    splashRate: 0,
  };
};

// ---------- actors ----------
const TINT = { drought: '#ffd9b0', court: '#ffdfb0', eve: '#ffd9b0', storm: '#b8c4d8' };
const tintFor = (S, f) => S.id === 'rain' ? TINT.storm : (TINT[S.light] || '#ffffff');
// COSTUMES BY ROLE — king: royal maroon robe + gold trim, dark beard, 3D crown;
// farmer: POOR man, worn dusty kurta, cloth head-wrap, grey-streaked moustache;
// ministers: rich noble dress; guard: steel cap.
export const OUTFITS = {
  king: { jacket: '#7e1f2e', pants: '#3d2438', boots: '#2a1a12', hat: 'hair', hair: '#2a1c12', skin: '#e8b08a', moustache: '#33241a' },
  farmer: { jacket: '#9a7d4f', pants: '#6b543a', boots: '#3a2a1a', hat: 'cap', cap: '#7a5c38', skin: '#c98a5a', moustache: '#4a3826' },
  court1: { jacket: '#5d4a7a', pants: '#3a2e4a', boots: '#241a12', hat: 'cap', cap: '#c9b98a', skin: '#e8b08a' },
  court2: { jacket: '#3f5a52', pants: '#2c3d38', boots: '#241a12', hat: 'hair', hair: '#1a1210', skin: '#c98a5a' },
  guard: { jacket: '#6e3a2e', pants: '#453028', boots: '#241a12', hat: 'cap', cap: '#8d949c', skin: '#e8b08a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(pos[1] - 0.07 * k, 3), pos[2]];
const armK = (f, a, b, c, d, kmax = 1) => q(kmax * (smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)))), 2);

const COURTIERS = [[-18.7, 0, -3.6], [-11.3, 0, -4.7]];
const courtCast = (T, tint, f, kingExpr, farmExpr, opts = {}) => {
  const out = [];
  const kk = opts.kingProp ? { prop: opts.kingProp } : {};
  out.push(RW(T, OUTFITS.king, { expr: kingExpr, mode: 'stand', blink: opts.kingBlink ?? blinkAt(f, 41), seed: 41, ...kk }, KINGP, { tint, yaw: KING_YAW, s: KING_S }));
  const gk = opts.farmProp ? { prop: opts.farmProp } : {};
  const gpos = opts.farmBow ? BP(FARM_COURT, opts.farmBow) : FARM_COURT;
  const gopts = opts.farmBow ? { ...gk, ...bowOpts(opts.farmBow) } : gk;
  out.push(RW(T, OUTFITS.farmer, { expr: farmExpr, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...gopts }, gpos, { tint, yaw: -0.35 }));
  out.push(RW(T, OUTFITS.court1, { expr: opts.courtExpr || 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, COURTIERS[0], { tint, yaw: 0.35 }));
  out.push(RW(T, OUTFITS.court2, { expr: opts.courtExpr || 'neutral', mode: 'stand', blink: blinkAt(f, 72), seed: 72 }, COURTIERS[1], { tint, yaw: -0.3 }));
  out.push(RW(T, OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 73), seed: 73 }, [-12.1, 0, -6.3], { tint, yaw: 0.2 }));
  return out;
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'field': {
      // C1: the drought — the farmer stands in his cracked field, looking up
      // at a hard empty sky. Title board up.
      out.push(st(OUTFITS.farmer, 'pained', 51, FARM_FIELD, { yaw: 0.18 }));
      break;
    }
    case 'court': {
      // C2 the farmer arrives with his offer; C3-C4 the offer itself — king
      // listens, ministers scoff; C5 the ministers LAUGH; C6 the king narrows
      // his eyes and refuses; C7 the farmer's calm reply; C8 the king pays —
      // the pouch travels hand-to-hand (bag mesh, main.js via bagAt).
      const pk = armK(f, c0(8) + 2, c0(8) + 16, c0(8) + 40, c0(8) + 56);
      const fk = armK(f, c0(8) + 26, c0(8) + 48, c1(8) - 10, c1(8));
      const kingExpr = f < c0(5) ? 'neutral' : (f < c0(6) ? 'stern' : (f < c0(8) ? 'stern' : 'relief'));
      const farmExpr = f < c0(3) ? 'neutral' : (f < c0(5) ? 'smile_closed' : (f < c0(7) ? 'nervous' : 'smile_closed'));
      out.push(...courtCast(T, tint, f, kingExpr, farmExpr,
        { kingProp: pk > 0.02 ? ['push', pk] : null, farmProp: fk > 0.02 ? ['push', fk] : null,
          courtExpr: f >= c0(5) && f < c0(6) ? 'laugh' : 'neutral' }));
      break;
    }
    case 'watch': {
      // C9 he does not pray — he WATCHES (hand shading eyes at C10-C12);
      // C10 the ants march uphill; C11 the wind turns; C12 the clouds gather;
      // C13 he SMILES — the sky has already promised.
      const shade = armK(f, c0(10) + 2, c0(10) + 14, c0(13), c0(13) + 14, 0.7);
      const expr = f >= c0(13) ? 'smile' : 'neutral';
      out.push(RW(T, OUTFITS.farmer, { expr, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...(shade > 0.02 ? { prop: ['push', shade] } : {}) }, FARM_FIELD, { tint, yaw: 0.18 }));
      break;
    }
    case 'rain': {
      // C14 the rain pours — the farmer stands in it, arms open to the sky,
      // pouch in hand; C15 the fields drink, the kingdom cheers.
      const arms = armK(f, c0(14) + 6, c0(14) + 26, c0(15) + 20, c1(15) - 6, 0.8);
      out.push(RW(T, OUTFITS.farmer, { expr: f >= c0(15) ? 'laugh' : 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...(arms > 0.02 ? { prop: ['push', arms] } : {}) }, FARM_RAIN, { tint, yaw: 0.15 }));
      break;
    }
    case 'court2': {
      // C16 the king demands the secret; C17 the farmer BOWS and speaks;
      // C18 the explanation — ants, wind, the sky's promise; C19 the king
      // laughs till his belly aches and pays DOUBLE (pouch 2 travels);
      // C20 "sell me the sunshine."
      const bk = bowK(f, c0(17) + 2, c0(17) + 14, c0(18), c0(18) + 12);
      const pk = armK(f, c0(19) + 2, c0(19) + 16, c0(19) + 40, c0(19) + 56);
      const fk = armK(f, c0(19) + 26, c0(19) + 48, c1(19) - 10, c1(19));
      const kingExpr = f < c0(19) ? 'stern' : (f < c0(20) ? 'laugh' : 'grin');
      out.push(...courtCast(T, tint, f, kingExpr, f >= c0(17) ? 'smile_closed' : 'neutral',
        { farmBow: bk, kingProp: pk > 0.02 ? ['push', pk] : null, farmProp: fk > 0.02 ? ['push', fk] : null,
          courtExpr: f >= c0(19) ? 'laugh' : 'neutral' }));
      break;
    }
    case 'hook': {
      // C21-C22: home again, pouch in hand, as tomorrow's question rises
      // on the board (C22).
      out.push(st(OUTFITS.farmer, 'smile_closed', 51, FARM_HOME, { yaw: 0.45 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
