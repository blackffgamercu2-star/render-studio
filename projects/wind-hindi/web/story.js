// Shot plan for "हवा ख़रीदने वाला आदमी" — wind-hindi (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 8 H1 (Kahani Me Twist). ONE set: a harbour
// quay — godown (west), merchant's coin table (east), board posts centre,
// four boats on the sea beyond the quay edge. A stranger buys EVERY sail
// in a windless spell ("he bought the wind"), rents them back at sky-high
// prices when the wind returns; the old sailor whose torn sail was
// refused mends it and sails free; everyone sews their own; the godown
// pile finds no takers.
// Voice stem: 55.811 s, 30 fps, TOTAL 1674; timings from faster-whisper
// small word alignment (words.json / timing.json — timings only, Hindi
// spellings garbled). Scene changes ONLY at clause (script-line)
// boundaries:
//   L1  drone     एक आदमी ने सच में हवा ख़रीद ली...बेच दी।
//   L2  calm      उस साल बंदरगाह पर हफ़्तों हवा बंद रही। + कमाई ठप
//   L4  buying    अजनबी सौदागर...पाल खरीदने लगा। + सस्ते में बेच दिए
//   L6  hoard     उसने सारे पैसे लगाकर...सारे पाल खरीद लिए।
//   L7  wind      फिर एक सुबह...तेज़ हवा लौट आई।
//   L8  bare      अब नाविकों को काम पर जाना था, मगर पाल किसी के पास नहीं था।
//   L9  price     सौदागर ने किराया आसमान पर रख दिया...
//   L10 rent      नाविकों को अपने ही पाल किराए पर लेने पड़े।
//   L11 oldman    सिर्फ़ एक बूढ़ा नाविक उसके पास नहीं गया...
//   L12 sailaway  बूढ़े ने वही फटा पाल सी लिया और मुफ़्त में निकल गया।
//   L13 sewing    बाकी नाविकों ने भी पुराने कपड़ों से पाल सीने शुरू कर दिए।
//   L14 empty     हफ़्ते भर में गोदाम के पालों का कोई किराएदार नहीं बचा।
//   L15 tag       तब बूढ़े नाविक ने कहा।            (narration tag — mouth CLOSED)
//   L16 dialogue  "उसने हमारे पाल खरीदे थे, दोस्तों। हवा उसने कभी खरीदी ही नहीं।"
//   L17 hookq     लेकिन कल... घड़ी... रुकी हुई थी?  (hook board, held full)
// GRADE (FILTER_VFX_LIGHTING pack): Sea Glass throughout; the hook beat
// warms toward dusk INSIDE the same sea family — grade changes ONLY on
// clause boundaries. Signature VFX: limp vs bellied cloth sails (the
// wind itself is the plot), pennant/flag flutter, water sparkle rising
// with the wind, bow spray + wake on the sail-away.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
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

export const FPS = 30, TOTAL = 1674, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
// [drone, calm, buying, hoard, wind, bare, price, rent, oldman, sailaway, sewing, empty, tag, dialogue, hookq, hook]
export const BND = [0, 133, 274, 464, 561, 628, 731, 850, 917, 1081, 1159, 1270, 1357, 1401, 1521, 1605, 1674];
const IDS = ['drone', 'calm', 'buying', 'hoard', 'wind', 'bare', 'price', 'rent', 'oldman', 'sailaway', 'sewing', 'empty', 'tag', 'dialogue', 'hookq', 'hook'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'sea' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);

// ---------- lights / mood grades (Sea Glass family) ----------
export const LIGHTS = {
  sea: { az: 218, el: 33, sky: '#bfe0d8', ground: '#4a6a66', hemi: 1.06, sun: '#fff2cf', sunI: 2.35, fog: '#c2e0d6', fogNear: 48, fogFar: 340,
    skyTop: '#2e7ea6', skyHor: '#d2ecd9', sunDisc: '#fff6d8', sunSize: 0.0042, sat: 1.07, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#eafaf2',
    waterDeep: '#14586b', waterShal: '#35a3a5', glint: '#d9fff2' },
  dusk: { az: 246, el: 14, sky: '#c9a184', ground: '#4c5648', hemi: 0.94, sun: '#ffab5e', sunI: 2.0, fog: '#cfb49a', fogNear: 44, fogFar: 310,
    skyTop: '#2c4a72', skyHor: '#f0b57e', sunDisc: '#ffbe78', sunSize: 0.003, sat: 1.04, vig: 0.29, shadowExt: 24, aurora: 0, gain: '#f2ddba',
    waterDeep: '#173f57', waterShal: '#2e7ea6', glint: '#ffe9c0' },
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
  if (S.id === 'hookq') return blendLight(LIGHTS.sea, LIGHTS.dusk, smooth(ramp(f, F('hookq').a, F('hookq').a + 55)));
  if (S.id === 'hook') return { ...LIGHTS.dusk };
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const GODOWN = { x: -9.5, z: -3 };
export const STACK = { x: -6.2, z: -2.4 };
export const TABLE = { x: 5.2, z: 4.6 };
export const QUAY_Z = -15;
export const SEAT = { x: 3.6, z: -7.9, top: 0.18 };
const PILE_SPOTS = [[0, 0], [0.15, 1.05], [-0.1, -1.0], [0.05, 0.5], [-0.05, -0.5], [0.1, 0.95], [0, -0.95]];
export const PILE_POS = PILE_SPOTS.map((sp, i) => ({
  x: STACK.x + (1 - (i % 3)) * 0.95 + sp[0] * 0.2, y: 0.3 + Math.floor(i / 3) * 0.56, z: STACK.z + sp[1] * 0.35,
}));
export const stackTopY = (count) => (count <= 0 ? 0 : PILE_POS[count - 1].y + 0.29);

// ---------- the wind itself (the plot's engine) ----------
export const windKAt = (f) => {
  const w = F('wind');
  if (f < w.a) return 0;
  return smooth(ramp(f, w.a + 8, w.a + 62)) * (shotAt(f).id === 'hook' || shotAt(f).id === 'hookq' ? 0.85 : 1);
};

// ---------- cast walks ----------
const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const B = (id) => F(id).a, E = (id) => F(id).b;
// sailor1: home -> stack (buying trip) -> home; -> quay edge with the
// rented sail (rent) -> sewing circle -> dialogue group
const S1_KEYS = [
  [0, -1.6, 3.2], [B('buying') + 52, -1.6, 3.2], [B('buying') + 84, -0.6, -2.6], [B('buying') + 118, -4.9, -1.5], [B('buying') + 138, -4.9, -1.5],
  [B('buying') + 158, -0.6, -2.6], [E('buying'), -1.6, 3.2], [B('rent'), -1.6, 3.2], [B('rent') + 18, -1.0, 2.2], [B('rent') + 62, -1.0, 2.2],
  [B('rent') + 94, 2.8, -6.4], [E('rent'), 2.8, -6.4], [B('sewing') + 14, 2.8, -6.4], [B('sewing') + 30, 0.6, -2.4],
  [E('sewing'), 0.6, -2.4], [B('tag'), -2.2, -3.3], [1673, -2.2, -3.3],
];
// sailor2: home -> stack (hoard trip) -> home; stack -> sailor1 (rent
// bundle) happens inside the rent shot; then sewing + dialogue group
const S2_KEYS = [
  [0, -3.6, 0.8], [B('hoard') + 16, -3.6, 0.8], [B('hoard') + 62, -5.0, -1.1], [B('hoard') + 78, -5.0, -1.1],
  [B('wind') + 20, -3.6, 0.8], [B('rent'), -3.6, 0.8], [B('rent') + 14, -5.2, -1.0], [B('rent') + 20, -5.2, -1.0],
  [B('rent') + 48, -1.78, 2.05], [B('rent') + 60, -1.78, 2.05], [E('rent'), -3.6, 0.8], [B('sewing') + 2, -3.6, 0.8],
  [B('sewing') + 16, 1.9, -3.1], [E('sewing'), 1.9, -3.1], [B('tag'), -0.7, -2.7], [1673, -0.7, -2.7],
];
const S3_KEYS = [[0, 1.7, 0.6], [B('sewing') + 24, -0.9, -3.3], [E('sewing'), -0.9, -3.3], [B('tag'), -3.6, -4.1], [1673, -3.6, -4.1]];
export const s1At = (f) => { const [x, z] = walkKeys(S1_KEYS, f); return { x, z }; };
export const s2At = (f) => { const [x, z] = walkKeys(S2_KEYS, f); return { x, z }; };
export const s3At = (f) => { const [x, z] = walkKeys(S3_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const s1Mode = (f) => strolling(f, [[B('buying') + 52, B('buying') + 118], [B('buying') + 138, E('buying')], [B('rent'), B('rent') + 18], [B('rent') + 62, B('rent') + 94], [B('sewing') + 14, B('sewing') + 30]]) ? 'stroll' : (shotAt(f).id === 'sewing' ? 'sit' : 'stand');
export const s2Mode = (f) => strolling(f, [[B('hoard') + 16, B('hoard') + 62], [B('hoard') + 78, B('wind') + 20], [B('rent'), B('rent') + 14], [B('rent') + 20, B('rent') + 48], [B('rent') + 60, E('rent')], [B('sewing') + 2, B('sewing') + 16]]) ? 'stroll' : (shotAt(f).id === 'sewing' ? 'sit' : 'stand');
// the old sailor: on his seat (mending) until the sail-away; aboard B0
// while she sails; back on the quay standing for tag + dialogue
export const oldAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'sailaway') { const bp = boatAt(f); return { x: bp.x + 1.35, z: bp.z + 0.1, y: 0.36, aboard: 1 }; }
  if (S.id === 'tag' || S.id === 'dialogue' || S.id === 'hookq' || S.id === 'hook') return { x: 1.4, z: -3.9, y: 0, aboard: 0 };
  if (['sewing', 'empty'].includes(S.id)) { const bp = boatAt(f); return { x: bp.x + 1.35, z: bp.z + 0.1, y: 0.36, aboard: 1 }; }
  return { x: SEAT.x, z: SEAT.z, y: SEAT.top, aboard: 0 };
};
// B0's path: moored off the quay edge -> out to sea on the sail-away
export const boatAt = (f) => {
  const S = F('sailaway');
  if (f < S.a) return { x: 5.2, z: -17.5, ry: 0 };
  if (f > S.b) return { x: 1.2, z: -33, ry: -0.18 };
  const u = smooth(ramp(f, S.a + 26, S.b - 6));
  return { x: lerp(5.2, 1.2, u) + Math.sin(u * Math.PI) * 0.8, z: lerp(-17.5, -33, u), ry: lerp(0, -0.18, u) };
};
const MERCH_KEYS = [
  [0, 4.3, 3.3], [B('buying') + 10, 4.3, 3.3], [B('buying') + 44, -4.4, -0.4], [E('buying'), -4.4, -0.4], [B('hoard') + 12, -4.2, -3.2],
  [B('hoard') + 52, 4.3, 3.3], [B('price'), 2.7, 1.7], [B('rent') + 6, 2.7, 1.7], [B('rent') + 24, -0.2, 2.4],
  [B('rent') + 58, -0.2, 2.4], [E('rent'), 4.3, 3.3], [B('empty'), 4.3, 3.3], [B('empty') + 34, -3.4, 0.6], [1673, -3.4, 0.6],
];
export const merchantAt = (f) => { const [x, z] = walkKeys(MERCH_KEYS, f); return { x, z }; };
export const merchantMode = (f) => strolling(f, [[B('buying') + 10, B('buying') + 44], [B('hoard'), B('hoard') + 52], [B('rent') + 6, B('rent') + 24], [B('rent') + 58, E('rent')], [B('empty'), B('empty') + 34]]) ? 'stroll' : 'stand';

// ---------- carried props (contact beats live here) ----------
// bundleA: buying trip in sailor1's hands, placed ON the stack; second
// trip in sailor2's hands during hoard. While carried it rides at the
// carrier's chest; at the place frames it settles onto the stack top.
export const bundleAAt = (f) => {
  const by = F('buying'), hd = F('hoard');
  const carry = (who, a, b, placeEnd, slot) => {
    const T = PILE_POS[slot];
    if (f < a - 14 || f > placeEnd) return null;
    const w = who(f);
    if (f < a) return { x: w.x + 0.4, y: 0.29, z: w.z + 0.5, k: 1 };            // resting at the carrier's feet
    if (f <= b) return { x: w.x + 0.15, y: 0.95, z: w.z + 0.3, k: 1 };          // in his hands
    const u = smooth(ramp(f, b, placeEnd));                                     // the place: hands -> pile slot
    return { x: lerp(w.x + 0.15, T.x, u), y: lerp(0.95, T.y, u), z: lerp(w.z + 0.3, T.z, u), k: 1 };
  };
  return carry(s1At, by.a + 52, by.a + 118, by.a + 138, 0) || carry(s2At, hd.a + 16, hd.a + 62, hd.a + 78, 6) || { x: 0, y: -5, z: 0, k: 0 };
};
// bundleB: the rented sail — stack -> sailor2 -> handed to sailor1, who
// carries it down to the quay edge (his boat gets it off-screen)
export const bundleBAt = (f) => {
  const rt = F('rent');
  if (f < rt.a + 20 || f > rt.b) return { x: 0, y: -5, z: 0, k: 0 };
  if (f <= rt.a + 44) { const w = s2At(f); return { x: w.x + 0.15, y: 0.95, z: w.z + 0.3, k: 1 }; }
  if (f <= rt.a + 54) { const a = s2At(rt.a + 44), b2 = s1At(rt.a + 54), u = smooth(ramp(f, rt.a + 44, rt.a + 54));
    return { x: lerp(a.x + 0.15, b2.x + 0.15, u), y: 0.95 + Math.sin(u * Math.PI) * 0.06, z: lerp(a.z + 0.3, b2.z + 0.3, u), k: 1 }; }
  const w = s1At(f); return { x: w.x + 0.15, y: 0.95, z: w.z + 0.3, k: 1 };   // handed over, carried to the quay edge
};
// stackCount: how many bought sails stand in the godown pile
export const stackCountAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'drone' || S === 'calm') return 0;
  if (S === 'buying') return f >= B('buying') + 138 ? 1 : 0;
  if (S === 'hoard') return f >= B('hoard') + 78 ? 7 : 6;
  if (S === 'rent') return f >= B('rent') + 10 ? 6 : 7;
  return 6;
};
// the coin pouch: merchant pays the sailors (buying), a sailor pays the
// merchant back (rent) — the pouch travels hand to hand, never floats
export const coinAt = (f) => {
  const by = F('buying'), rt = F('rent');
  const hand = (w) => ({ x: w.x + 0.15, y: 1.0, z: w.z + 0.3, k: 1, glint: 0.4 });
  const hop = (a, b, W0, W1) => { const u = smooth(ramp(f, a, b)); return { x: lerp(W0.x, W1.x, u), y: lerp(W0.y, W1.y, u) + Math.sin(u * Math.PI) * 0.1, z: lerp(W0.z, W1.z, u), k: 1, glint: Math.sin(u * Math.PI) }; };
  // buying: the pouch rides in the merchant's hand to the stack, hops to
  // sailor1's hand at the place, and goes home in sailor1's hand
  if (f >= by.a + 40 && f <= by.b) {
    if (f < by.a + 118) return hand(merchantAt(f));
    if (f <= by.a + 130) return hop(by.a + 118, by.a + 130, hand(merchantAt(by.a + 118)), hand(s1At(by.a + 130)));
    const h = hand(s1At(f)); h.k = 1 - ramp(f, by.b - 8, by.b); return h;
  }
  // rent: sailor1 brings the pouch, hops it to the merchant, who carries
  // it back to his table and sets it down (fade at the table)
  if (f >= rt.a + 18 && f <= rt.b) {
    if (f < rt.a + 30) return hand(s1At(f));
    if (f <= rt.a + 44) return hop(rt.a + 30, rt.a + 44, hand(s1At(rt.a + 30)), hand(merchantAt(rt.a + 44)));
    const h = hand(merchantAt(f)); h.k = 1 - ramp(f, rt.b - 10, rt.b); return h;
  }
  return { x: 0, y: -5, z: 0, k: 0, glint: 0 };
};

// ---------- boats' sails (the wind made visible) ----------
export const boatsAt = (f) => {
  const S = shotAt(f).id, wind = windKAt(f), limp = 1 - wind;
  const bought = !['drone', 'calm', 'buying'].includes(S);
  const home = ['empty', 'tag', 'dialogue', 'hookq', 'hook'].includes(S);
  const rented = ['oldman', 'sailaway', 'sewing', 'empty', 'tag', 'dialogue', 'hookq', 'hook'].includes(S);
  const mendDone = f >= B('sailaway') + Math.round((E('sailaway') - B('sailaway')) * 0.25);
  return [
    { k: 1, limp: S === 'sailaway' ? Math.min(limp, 0.1) : limp, kind: mendDone ? 'patched' : 'torn', heel: S === 'sailaway' ? 0.05 : wind * 0.02 }, // B0 the old man's
    { k: bought ? (home ? 1 : 0) : 1, limp, kind: home ? 'home' : 'plain', heel: wind * 0.03 },   // B1
    { k: bought ? (home ? 1 : 0) : 1, limp, kind: home ? 'home' : 'plain', heel: wind * 0.03 },   // B2
    { k: bought ? (rented ? 1 : 0) : 1, limp, kind: 'plain', heel: wind * 0.03 },                  // B3 (the rented one)
  ];
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.4, -4],
  calm: () => [-2, 1.2, -12],
  buying: () => { const w = s1At(400); return [w.x + 1.2, 1.1, w.z]; },
  hoard: () => [STACK.x + 1.4, 1.2, STACK.z],
  wind: () => [0.5, 2.2, -25],
  bare: () => { const w = s1At(700); return [w.x, 1.3, w.z]; },
  price: () => { const m = merchantAt(820); return [m.x, 1.35, m.z]; },
  rent: () => [-0.4, 1.1, 1.6],
  oldman: () => [SEAT.x, 1.0, SEAT.z],
  sailaway: () => { const bp = boatAt(1050); return [bp.x, 1.2, bp.z]; },
  sewing: () => [0.4, 0.8, -2.9],
  empty: () => [STACK.x + 1, 1.3, STACK.z],
  tag: () => { const o = oldAt(1430); return [o.x, 1.4, o.z]; },
  dialogue: () => { const o = oldAt(1500); return [o.x, 1.45, o.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const s1Pos = (f) => { const w = s1At(f); return [w.x, 0, w.z]; };
const s2Pos = (f) => { const w = s2At(f); return [w.x, 0, w.z]; };
const oldPos = (f) => { const o = oldAt(f); return [o.x, o.y || 0, o.z]; };
const boatPos = (f) => { const bp = boatAt(f); return [bp.x, 0, bp.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[16, 10.5, 17.5], [11, 6.5, 14.5], [8, 4.2, 13], [6.8, 2.9, 12.2]],
    [[0, 2.8, -6], [-0.5, 2.0, -5], [-0.8, 1.4, -3.5], [-0.8, 1.2, -2.5]], B('drone'), E('drone'), 44, 40) },
  calm: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('calm'), pos: [8.8, 2.9, 10.5], look: [-1.5, 1.2, -13], fov: 44 },
    { f: E('calm'), pos: [8.0, 2.7, 9.6], look: [-1.8, 1.1, -13], fov: 41, ease: 'surge' }] }) },
  buying: { cut: 'hard', raw: pushInCam({ subject: s1Pos, a: B('buying'), b: E('buying'), d0: 6.4, d1: 5.2, h0: 1.7, h1: 1.55, lookOff: [0, 1.25, 0], fov0: 40, fov1: 35,
    dir: () => [0.66, 0.75] }) },
  hoard: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hoard'), pos: [1.8, 2.6, 6.8], look: [-5.6, 1.1, -2.2], fov: 42 },
    { f: E('hoard'), pos: [1.2, 2.4, 6.2], look: [-5.8, 1.1, -2.3], fov: 38, ease: 'surge' }] }) },
  wind: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('wind'), pos: [10.5, 3.8, 6.5], look: [-1, 2.4, -22], fov: 46 },
    { f: E('wind'), pos: [9.4, 3.4, 5.2], look: [0, 2.2, -23], fov: 40, ease: 'surge' }] }) },
  bare: { cut: 'hard', raw: pushInCam({ subject: s1Pos, a: B('bare'), b: E('bare'), d0: 5.4, d1: 4.2, h0: 1.8, h1: 1.6, lookOff: [0, 1.5, 0], fov0: 38, fov1: 33,
    dir: () => [0.5, 0.82] }) },
  price: { cut: 'hard', raw: pushInCam({ subject: (f) => { const m = merchantAt(f); return [m.x, 0, m.z]; }, a: B('price'), b: E('price'), d0: 4.6, d1: 3.4, h0: 1.6, h1: 1.5, lookOff: [0, 1.4, 0], fov0: 36, fov1: 30,
    dir: () => [0.55, 0.8] }) },
  rent: { cut: 'hard', raw: staticTrackCam({ pos: [3.6, 2.3, 9.6], subject: () => [-0.4, 0, 1.6], lookOff: [0, 1.1, 0], fov: 38 }) },
  oldman: { cut: 'hard', raw: pushInCam({ subject: () => [SEAT.x, SEAT.top, SEAT.z], a: B('oldman'), b: E('oldman'), d0: 4.8, d1: 3.6, h0: 1.35, h1: 1.2, lookOff: [0, 0.85, 0], fov0: 38, fov1: 32,
    dir: () => [0.58, 0.78] }) },
  sailaway: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('sailaway'), pos: [10.8, 3.0, -6.5], look: [5.0, 1.0, -17.5], fov: 40 },
    { f: B('sailaway') + 34, pos: [10.2, 2.9, -7.5], look: [3.2, 1.0, -24.5], fov: 38 },
    { f: E('sailaway'), pos: [8.8, 3.1, -9.5], look: [1.4, 1.0, -32], fov: 36, ease: 'io' }] }) },
  sewing: { cut: 'hard', raw: pushInCam({ subject: () => [0.4, 0, -2.9], a: B('sewing'), b: E('sewing'), d0: 5.6, d1: 4.4, h0: 1.5, h1: 1.25, lookOff: [0, 0.8, 0], fov0: 38, fov1: 33,
    dir: () => [0.6, 0.78] }) },
  empty: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('empty'), pos: [3.4, 2.8, 7.6], look: [-5.4, 1.2, -2.2], fov: 42 },
    { f: E('empty'), pos: [2.8, 2.6, 6.9], look: [-5.6, 1.2, -2.3], fov: 39, ease: 'surge' }] }) },
  tag: { cut: 'hard', raw: pushInCam({ subject: oldPos, a: B('tag'), b: E('tag'), d0: 4.2, d1: 3.2, h0: 1.55, h1: 1.45, lookOff: [0, 1.4, 0], fov0: 36, fov1: 31,
    dir: () => [0.5, 0.82] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: oldPos, a: B('dialogue'), b: E('dialogue'), d0: 3.3, d1: 2.7, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: B('hookq'), pos: [5.4, 3.9, 7.6], look: [0.1, 2.75, -5.9], fov: 40 },
    { f: E('hookq'), pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37 },
    { f: E('hook'), pos: [5.0, 3.95, 7.2], look: [0.02, 2.8, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: B('buying') + 138, a: 0.03 }, { f: B('wind') + 20, a: 0.035 }],
  sigma: 2.3, fovSigma: 1.6,
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
  if (['drone', 'hookq', 'wind', 'calm'].includes(S.id)) cinf = 1.4;
  if (['price', 'dialogue', 'oldman', 'bare'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), ba = bundleAAt(f), bb = bundleBAt(f), cn = coinAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    windK: windKAt(f), stackCount: stackCountAt(f), boats: boatsAt(f),
    bunAX: ba.x, bunAY: ba.y, bunAZ: ba.z, bunAK: ba.k,
    bunBX: bb.x, bunBY: bb.y, bunBZ: bb.z, bunBK: bb.k,
    coinX: cn.x, coinY: cn.y, coinZ: cn.z, coinK: cn.k, coinGlint: cn.glint || 0,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 28, 45)) * (1 - smooth(ramp(f, 66, 84)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, B('hookq') + 44, B('hookq') + 68));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: S.id === 'sailaway' && f > B('sailaway') + 26 ? 0.85 : 0, shimmerRate: 0, windK: windKAt(f) };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { sea: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => S.id === 'hook' || S.id === 'hookq' ? TINT.dusk : TINT.sea;
export const OUTFITS = {
  merchant: { jacket: '#6e2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a', moustache: '#241a12' },
  sailor1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#a34a3a', skin: '#a06a3c' },
  sailor2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#8a5a34', moustache: '#241a12' },
  sailor3: { jacket: '#8a6f42', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#2c1a10', skin: '#c98a5a' },
  old: { jacket: '#3f6a6f', pants: '#4a3a28', boots: '#241a12', hat: 'hair', hair: '#e8e4da', skin: '#d9b48f', moustache: '#e8e4da' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  const m = merchantAt(f), s1 = s1At(f), s2 = s2At(f), s3 = s3At(f), od = oldAt(f);
  const M_ = { expr: 'stern', mode: merchantMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 41), seed: 41 };
  const S1_ = { expr: 'neutral', mode: s1Mode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 };
  const S2_ = { expr: 'neutral', mode: s2Mode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51 };
  const S3_ = { expr: 'neutral', mode: shotAt(f).id === 'sewing' ? 'sit' : 'stand', blink: blinkAt(f, 52), seed: 52 };
  const OLD_ = { expr: 'smile', mode: 'sit', blink: blinkAt(f, 61), seed: 61 };
  switch (S.id) {
    case 'drone': {
      std('merchant', OUTFITS.merchant, { ...M_ }, m.x, m.z, { yaw: -0.5 });
      std('sailor1', OUTFITS.sailor1, { ...S1_ }, s1.x, s1.z, { yaw: 0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.3 });
      std('old', OUTFITS.old, { ...OLD_, prop: ['sew', 0.5] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'calm': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: 'neutral', headTilt: 0.1 }, s1.x, s1.z, { yaw: 0.5 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, expr: 'neutral' }, s2.x, s2.z, { yaw: 0.4 });
      std('sailor3', OUTFITS.sailor3, { ...S3_ }, s3.x, s3.z, { yaw: -0.3 });
      std('old', OUTFITS.old, { ...OLD_, prop: ['sew', 0.5] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'buying': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: f > B('buying') + 130 ? 'smile' : 'neutral' }, s1.x, s1.z, { yaw: 0.55 });
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'smile' }, m.x, m.z, { yaw: -0.55 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.35 });
      break;
    }
    case 'hoard': {
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'smile', prop: ['point', 0.6] }, m.x, m.z, { yaw: -0.7 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, expr: 'neutral' }, s2.x, s2.z, { yaw: 0.5 });
      std('sailor1', OUTFITS.sailor1, { ...S1_ }, s1.x, s1.z, { yaw: 0.4 });
      break;
    }
    case 'wind': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: 'smile' }, s1.x, s1.z, { yaw: 0.5 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, expr: 'smile' }, s2.x, s2.z, { yaw: 0.4 });
      std('sailor3', OUTFITS.sailor3, { ...S3_, expr: 'smile' }, s3.x, s3.z, { yaw: -0.2 });
      std('old', OUTFITS.old, { ...OLD_, expr: 'smile' }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'bare': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: 'shock', headTilt: -0.06 }, s1.x, s1.z, { yaw: 0.6 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, expr: 'nervous' }, s2.x, s2.z, { yaw: 0.45 });
      std('old', OUTFITS.old, { ...OLD_, prop: ['sew', 0.55] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'price': {
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'stern', prop: ['point', 0.8] }, m.x, m.z, { yaw: -0.6 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: 'shock' }, s1.x, s1.z, { yaw: 0.6 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, expr: 'shock' }, s2.x, s2.z, { yaw: 0.5 });
      break;
    }
    case 'rent': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: f < B('rent') + 44 ? 'nervous' : 'relief' }, s1.x, s1.z, { yaw: 0.55 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.4 });
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'smile' }, m.x, m.z, { yaw: -0.55 });
      break;
    }
    case 'oldman': {
      // the old sailor mends the torn sail the merchant refused — needle
      // moving ('sew' prop), head bowed over the cloth
      std('old', OUTFITS.old, { ...OLD_, expr: 'neutral', headTilt: 0.14, prop: ['sew', 0.65] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.35 });
      std('sailor3', OUTFITS.sailor3, { ...S3_ }, s3.x, s3.z, { yaw: -0.3 });
      break;
    }
    case 'sailaway': {
      std('old', OUTFITS.old, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, od.x, od.z, { y: od.y, ground: od.y, blob: false, yaw: 0.3 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: 'smile' }, s1.x, s1.z, { yaw: 0.5 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, expr: 'smile' }, s2.x, s2.z, { yaw: 0.4 });
      break;
    }
    case 'sewing': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, expr: 'smile', prop: ['sew', 0.6] }, s1.x, s1.z, { yaw: 0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, expr: 'smile', prop: ['sew', 0.5] }, s2.x, s2.z, { yaw: -0.3 });
      std('sailor3', OUTFITS.sailor3, { ...S3_, expr: 'smile', prop: ['sew', 0.55] }, s3.x, s3.z, { yaw: 0.2 });
      std('old', OUTFITS.old, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, od.x, od.z, { y: od.y, ground: od.y, blob: false, yaw: 0.3 });
      break;
    }
    case 'empty': {
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'nervous', headTilt: 0.08 }, m.x, m.z, { yaw: -0.7 });
      std('old', OUTFITS.old, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, od.x, od.z, { y: od.y, ground: od.y, blob: false, yaw: 0.3 });
      break;
    }
    case 'tag': {
      // narration tag — the old sailor rises and turns to the group;
      // his mouth stays CLOSED (the line is voice-over until L16)
      std('old', OUTFITS.old, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, od.x, od.z, { y: 0, ground: 0, yaw: 0.45 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, mode: 'stand' }, s1.x, s1.z, { yaw: -0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, mode: 'stand' }, s2.x, s2.z, { yaw: -0.3 });
      std('sailor3', OUTFITS.sailor3, { ...S3_, mode: 'stand' }, s3.x, s3.z, { yaw: -0.2 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the old sailor PERFORMS his line — mouth
      // driven by the stem inside the speak segment, closed outside it;
      // the sailors only listen (their mouths never open).
      std('old', OUTFITS.old, { mode: 'stand', blink: blinkAt(f, 61), seed: 61, look: 0.12, ...speakFace('smile', f) }, od.x, od.z, { y: 0, ground: 0, yaw: 0.45 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, mode: 'stand', expr: 'smile' }, s1.x, s1.z, { yaw: -0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, mode: 'stand', expr: 'smile' }, s2.x, s2.z, { yaw: -0.3 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(GODOWN.x - 1.9, GODOWN.x + 1.9, GODOWN.z - 2.4, GODOWN.z + 2.4, { h: 3.9, id: 'godown' }),
  SOL.circle(STACK.x, STACK.z, 1.05, { h: 1.9, id: 'stack' }),
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
  const ba = bundleAAt(f), bb = bundleBAt(f);
  // a carried bundle is transitional (in hands) — unchecked, like a
  // fall; at its place frames it rests exactly on the stack top
  const by = F('buying'), hd = F('hoard');
  if (f >= by.a + 38 && f <= by.a + 51) items.push({ id: 'bundleA', y: ba.y - 0.29, ground: 0, maxHover: 0.04 });
  if (f >= by.a + 136 && f <= by.a + 138) items.push({ id: 'bundleA', y: ba.y - 0.29, ground: PILE_POS[0].y - 0.29, maxHover: 0.04 });
  if (f >= hd.a + 76 && f <= hd.a + 78) items.push({ id: 'bundleA', y: ba.y - 0.29, ground: PILE_POS[6].y - 0.29, maxHover: 0.04 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
