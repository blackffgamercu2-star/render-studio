// Shot plan for "हवा ख़रीदने वाला आदमी" — wind-hindi — v4 UPGRADE
// (2026-11-19): PICTURE-ONLY rebuild on the existing stem. Beat map,
// clause timings, boards, story content and scene order are UNCHANGED
// from the Batch 8 build (timing.json / words.json / speakdata.js are
// the same files). What changed:
//   * CAMERA = Abid's "v4" ACTION camera (waterrun-hindi / fireless-
//     hindi pattern): velocity keyed to the subject, fast eased
//     push-ins concentrated in ~12–18 frames at action starts (subject
//     scale ×2–3), tracking at subject speed, impact kicks on the
//     place / gust / handover beats, whip reframes ≤6f at clause
//     boundaries, NO slow drift, NO static holds, front / front
//     three-quarter only — never behind the cards.
//   * R2 FRAMING: the merchant is BIG from frame 0 (front track, head
//     ~45% of width, mid-action at his coin table) before a fast
//     pull-back reveals the harbour + title board; object inserts
//     (sail pile, coin pouch, needle & torn sail) fill the frame;
//     reaction faces punch to ~65–71%; the FINAL frame is a CHARACTER
//     BEAT + hook board together (old sailor foreground right, head
//     ~20%, pointing up at the board; the whole board panel inside
//     the frame with margins, full opacity to the last frame) — the
//     old board-only wide is gone.
//   * ANIMATION UPGRADE v1+v2 (kit body.js = Library v6): continuous
//     life on every figure (lifeAt breath / weight-shift / sway),
//     emotion morphs at beats (emoTrack), dialogue gesture
//     (gestureAt), stride phase from distance travelled (stridePh —
//     feet plant, no glide), PHYSICAL GRIPS (gripAt + carryDip: both
//     hands on the sail bundles while they are carried, settle dips
//     on the places), cheek shading on the faces (exprP cheek) with
//     brow morphs, and a head/hair spring term while characters move.
//   * Dialogue (L16, the old sailor's line) is still PERFORMED with
//     speak.js lip-sync, camera holding on the speaker. NOTE: the
//     line sits at f1401–1521 (84–91% of the film) because the STEM
//     puts it there — it cannot move without re-timing the stem,
//     which is forbidden. The final segment after it (hookq + hook)
//     is narration + board only, mouths shut: the END RULE holds for
//     the ending itself.
// Voice stem: 55.811 s, 30 fps, TOTAL 1674. Scene changes ONLY at
// clause (script-line) boundaries:
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
//   L17 hookq     लेकिन कल... घड़ी... रुकी हुई थी?  (hook board + hero, held full)
// GRADE (FILTER_VFX_LIGHTING pack): Sea Glass throughout; the hook
// beat warms toward dusk INSIDE the same sea family — grade changes
// ONLY on clause boundaries. Boards/text never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { emoTrack, lifeAt, gripAt, gestureAt, stridePh, carryDip } from './body.js';
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

// ---------- cast walks (UNCHANGED staging — the beat map) ----------
const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const B = (id) => F(id).a, E = (id) => F(id).b;
const S1_KEYS = [
  [0, -1.6, 3.2], [B('buying') + 52, -1.6, 3.2], [B('buying') + 84, -0.6, -2.6], [B('buying') + 118, -4.9, -1.5], [B('buying') + 138, -4.9, -1.5],
  [B('buying') + 158, -0.6, -2.6], [E('buying'), -1.6, 3.2], [B('rent'), -1.6, 3.2], [B('rent') + 18, -1.0, 2.2], [B('rent') + 62, -1.0, 2.2],
  [B('rent') + 94, 2.8, -6.4], [E('rent'), 2.8, -6.4], [B('sewing') + 14, 2.8, -6.4], [B('sewing') + 30, 0.6, -2.4],
  [E('sewing'), 0.6, -2.4], [B('tag'), -4.6, -3.9], [1673, -4.6, -3.9],
];
const S2_KEYS = [
  [0, -3.6, 0.8], [B('hoard') + 16, -3.6, 0.8], [B('hoard') + 62, -5.0, -1.1], [B('hoard') + 78, -5.0, -1.1],
  [B('wind') + 20, -3.6, 0.8], [B('rent'), -3.6, 0.8], [B('rent') + 14, -5.2, -1.0], [B('rent') + 20, -5.2, -1.0],
  [B('rent') + 48, -1.78, 2.05], [B('rent') + 60, -1.78, 2.05], [E('rent'), -3.6, 0.8], [B('sewing') + 2, -3.6, 0.8],
  [B('sewing') + 16, 1.9, -3.1], [E('sewing'), 1.9, -3.1], [B('tag'), -0.15, -2.55], [1673, -0.15, -2.55],
];
const S3_KEYS = [[0, 1.7, 0.6], [B('sewing') + 24, -0.9, -3.3], [E('sewing'), -0.9, -3.3], [B('tag'), -3.6, -4.1], [1673, -3.6, -4.1]];
export const s1At = (f) => { const [x, z] = walkKeys(S1_KEYS, f); return { x, z }; };
export const s2At = (f) => { const [x, z] = walkKeys(S2_KEYS, f); return { x, z }; };
export const s3At = (f) => { const [x, z] = walkKeys(S3_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const s1Mode = (f) => strolling(f, [[B('buying') + 52, B('buying') + 118], [B('buying') + 138, E('buying')], [B('rent'), B('rent') + 18], [B('rent') + 62, B('rent') + 94], [B('sewing') + 14, B('sewing') + 30]]) ? 'stroll' : (shotAt(f).id === 'sewing' ? 'sit' : 'stand');
export const s2Mode = (f) => strolling(f, [[B('hoard') + 16, B('hoard') + 62], [B('hoard') + 78, B('wind') + 20], [B('rent'), B('rent') + 14], [B('rent') + 20, B('rent') + 48], [B('rent') + 60, E('rent')], [B('sewing') + 2, B('sewing') + 16]]) ? 'stroll' : (shotAt(f).id === 'sewing' ? 'sit' : 'stand');
// stride phase from DISTANCE travelled along the walk path (sampled
// from walkKeys itself) — feet plant with the ground, no glide.
const makeStride = (keys, atFn, stride = 1.05) => {
  const cum = new Float32Array(TOTAL);
  let px = atFn(0).x, pz = atFn(0).z, d = 0;
  for (let f = 1; f < TOTAL; f++) { const p = atFn(f); d += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; cum[f] = d; }
  return (f) => stridePh(0, cum[clamp(Math.round(f), 0, TOTAL - 1)], stride);
};
const s1Ph = makeStride(S1_KEYS, s1At), s2Ph = makeStride(S2_KEYS, s2At), s3Ph = makeStride(S3_KEYS, s3At);
export const oldAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'sailaway') { const bp = boatAt(f); return { x: bp.x + 1.35, z: bp.z + 0.1, y: 0.36, aboard: 1 }; }
  // v4: for the hook beats the old sailor steps SOUTH toward camera
  // (foreground right, pointing up at the board) — the R2 final frame.
  if (S.id === 'hookq' || S.id === 'hook') return { x: 4.0, z: 0.6, y: 0, aboard: 0 };
  if (S.id === 'tag' || S.id === 'dialogue') return { x: 1.4, z: -3.9, y: 0, aboard: 0 };
  if (['sewing', 'empty'].includes(S.id)) { const bp = boatAt(f); return { x: bp.x + 1.35, z: bp.z + 0.1, y: 0.36, aboard: 1 }; }
  return { x: SEAT.x, z: SEAT.z, y: SEAT.top, aboard: 0 };
};
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
const merchPh = makeStride(MERCH_KEYS, merchantAt);

// ---------- carried props (contact beats live here — UNCHANGED) ----------
export const bundleAAt = (f) => {
  const by = F('buying'), hd = F('hoard');
  const carry = (who, a, b, placeEnd, slot) => {
    const T = PILE_POS[slot];
    if (f < a - 14 || f > placeEnd) return null;
    const w = who(f);
    if (f < a) return { x: w.x + 0.4, y: 0.29, z: w.z + 0.5, k: 1 };
    if (f <= b) return { x: w.x + 0.15, y: 0.95, z: w.z + 0.3, k: 1 };
    const u = smooth(ramp(f, b, placeEnd));
    return { x: lerp(w.x + 0.15, T.x, u), y: lerp(0.95, T.y, u), z: lerp(w.z + 0.3, T.z, u), k: 1 };
  };
  return carry(s1At, by.a + 52, by.a + 118, by.a + 138, 0) || carry(s2At, hd.a + 16, hd.a + 62, hd.a + 78, 6) || { x: 0, y: -5, z: 0, k: 0 };
};
export const bundleBAt = (f) => {
  const rt = F('rent');
  if (f < rt.a + 20 || f > rt.b) return { x: 0, y: -5, z: 0, k: 0 };
  if (f <= rt.a + 44) { const w = s2At(f); return { x: w.x + 0.15, y: 0.95, z: w.z + 0.3, k: 1 }; }
  if (f <= rt.a + 54) { const a = s2At(rt.a + 44), b2 = s1At(rt.a + 54), u = smooth(ramp(f, rt.a + 44, rt.a + 54));
    return { x: lerp(a.x + 0.15, b2.x + 0.15, u), y: 0.95 + Math.sin(u * Math.PI) * 0.06, z: lerp(a.z + 0.3, b2.z + 0.3, u), k: 1 }; }
  const w = s1At(f); return { x: w.x + 0.15, y: 0.95, z: w.z + 0.3, k: 1 };
};
export const stackCountAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'drone' || S === 'calm') return 0;
  if (S === 'buying') return f >= B('buying') + 138 ? 1 : 0;
  if (S === 'hoard') return f >= B('hoard') + 78 ? 7 : 6;
  if (S === 'rent') return f >= B('rent') + 10 ? 6 : 7;
  return 6;
};
export const coinAt = (f) => {
  const by = F('buying'), rt = F('rent');
  const hand = (w) => ({ x: w.x + 0.15, y: 1.0, z: w.z + 0.3, k: 1, glint: 0.4 });
  const hop = (a, b, W0, W1) => { const u = smooth(ramp(f, a, b)); return { x: lerp(W0.x, W1.x, u), y: lerp(W0.y, W1.y, u) + Math.sin(u * Math.PI) * 0.1, z: lerp(W0.z, W1.z, u), k: 1, glint: Math.sin(u * Math.PI) }; };
  if (f >= by.a + 40 && f <= by.b) {
    if (f < by.a + 118) return hand(merchantAt(f));
    if (f <= by.a + 130) return hop(by.a + 118, by.a + 130, hand(merchantAt(by.a + 118)), hand(s1At(by.a + 130)));
    const h = hand(s1At(f)); h.k = 1 - ramp(f, by.b - 8, by.b); return h;
  }
  if (f >= rt.a + 18 && f <= rt.b) {
    if (f < rt.a + 30) return hand(s1At(f));
    if (f <= rt.a + 44) return hop(rt.a + 30, rt.a + 44, hand(s1At(rt.a + 30)), hand(merchantAt(rt.a + 44)));
    const h = hand(merchantAt(f)); h.k = 1 - ramp(f, rt.b - 10, rt.b); return h;
  }
  return { x: 0, y: -5, z: 0, k: 0, glint: 0 };
};

// ---------- boats' sails (the wind made visible — UNCHANGED) ----------
export const boatsAt = (f) => {
  const S = shotAt(f).id, wind = windKAt(f), limp = 1 - wind;
  const bought = !['drone', 'calm', 'buying'].includes(S);
  const home = ['empty', 'tag', 'dialogue', 'hookq', 'hook'].includes(S);
  const rented = ['oldman', 'sailaway', 'sewing', 'empty', 'tag', 'dialogue', 'hookq', 'hook'].includes(S);
  const mendDone = f >= B('sailaway') + Math.round((E('sailaway') - B('sailaway')) * 0.25);
  return [
    { k: 1, limp: S === 'sailaway' ? Math.min(limp, 0.1) : limp, kind: mendDone ? 'patched' : 'torn', heel: S === 'sailaway' ? 0.05 : wind * 0.02 },
    { k: bought ? (home ? 1 : 0) : 1, limp, kind: home ? 'home' : 'plain', heel: wind * 0.03 },
    { k: bought ? (home ? 1 : 0) : 1, limp, kind: home ? 'home' : 'plain', heel: wind * 0.03 },
    { k: bought ? (rented ? 1 : 0) : 1, limp, kind: 'plain', heel: wind * 0.03 },
  ];
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: (f) => (f < 70 ? (() => { const m = merchantAt(f); return [m.x, 1.4, m.z]; })() : BOARD_POS),
  calm: (f) => (f < 206 ? (() => { const w = s1At(f); return [w.x, 1.35, w.z]; })() : [SEAT.x, 1.0, SEAT.z]),
  buying: (f) => (f < 392 ? (() => { const w = s1At(f); return [w.x, 1.1, w.z]; })() : [STACK.x + 0.6, 1.1, STACK.z]),
  hoard: () => [STACK.x + 1.0, 1.2, STACK.z],
  wind: () => [0.5, 2.2, -25],
  bare: (f) => (f < 690 ? (() => { const w = s1At(f); return [w.x, 1.4, w.z]; })() : [SEAT.x, 1.0, SEAT.z]),
  price: () => { const m = merchantAt(800); return [m.x, 1.4, m.z]; },
  rent: () => [-0.4, 1.1, 1.6],
  oldman: () => [SEAT.x, 1.0, SEAT.z],
  sailaway: (f) => { const bp = boatAt(f); return [bp.x, 1.2, bp.z]; },
  sewing: () => [0.4, 0.8, -2.9],
  empty: () => [STACK.x + 1, 1.3, STACK.z],
  tag: (f) => { const o = oldAt(f); return [o.x, 1.4, o.z]; },
  dialogue: (f) => { const o = oldAt(f); return [o.x, 1.45, o.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: v4 ACTION LEVEL — every shot travels ----------
// Head-width maths (card head ~0.53 m wide in world): fraction of the
// frame width = 0.53 / (2 * d * tan(fov/2) * 0.5625). Push-ins are
// concentrated in ~14 frames at action starts (keysCam 'surge'
// segments); tracking raws follow the movement tracks analytically.
// Camera is ALWAYS in front of the cards (south side, +z of them).
const KP = (f, subj, dx, dz, h, lookY, fov, ease) => {
  const s = subj(f);
  return { f, pos: [s.x + dx, h, s.z + dz], look: [s.x, lookY, s.z], fov, ...(ease ? { ease } : {}) };
};
const RIG_BY_ID = {
  // drone -> v4 OPENING: the merchant BIG from frame 0 (front
  // three-quarter track at his coin table, head ~45%, counting the
  // morning's coins mid-action), a slight push to ~52%, then a FAST
  // pull-back (f56–96) that reveals the harbour, the becalmed boats
  // and the TITLE BOARD as it fades in — the drone establishing move
  // compressed into the back half of the shot.
  drone: { cut: 'hard', raw: keysCam({ keys: [
    KP(0, merchantAt, -1.55, 2.55, 1.52, 1.42, 38),
    KP(52, merchantAt, -1.35, 2.2, 1.48, 1.44, 36, 'surge'),
    { f: 96, pos: [2.2, 2.6, 10.6], look: [-0.4, 1.9, -3.4], fov: 42, ease: 'surge' },
    { f: 132, pos: [4.6, 3.0, 12.4], look: [-0.6, 1.8, -3.6], fov: 43, ease: 'surge' }] }) },
  // calm: PUNCH onto sailor1's stalled, worried face (40% -> ~68% in
  // 14f), hold the beat, then a fast reframe at the L3 clause (f206)
  // to the old sailor mending under the limp sails.
  calm: { cut: 'hard', raw: keysCam({ keys: [
    KP(133, s1At, 1.5, 2.9, 1.62, 1.38, 39),
    KP(147, s1At, 1.05, 2.05, 1.56, 1.42, 35, 'surge'),
    KP(203, s1At, 0.98, 1.95, 1.55, 1.42, 35, 'surge'),
    { f: 220, pos: [6.1, 1.5, -4.6], look: [3.6, 0.95, -7.9], fov: 37, ease: 'surge' },
    { f: 273, pos: [5.7, 1.42, -4.95], look: [3.6, 0.98, -7.9], fov: 35, ease: 'surge' }] }) },
  // buying: front track WITH the merchant's stride to the stack,
  // ride sailor1's carry, then PUNCH to the stack for the PLACE
  // (kick at f412) and the coin hop — bundle and pouch fill the frame.
  buying: { cut: 'hard', raw: keysCam({ keys: [
    KP(274, merchantAt, -1.6, 2.7, 1.6, 1.4, 38),
    KP(318, merchantAt, -1.35, 2.3, 1.55, 1.42, 36, 'surge'),
    KP(360, s1At, 1.5, 2.5, 1.5, 1.15, 37, 'smooth'),
    { f: 398, pos: [-4.95, 1.52, 2.95], look: [-5.38, 0.93, -2.0], fov: 36, ease: 'surge' },
    { f: 412, pos: [-5.05, 1.51, 2.8], look: [-5.41, 0.92, -2.02], fov: 35 },
    { f: 430, pos: [-5.2, 1.5, 2.7], look: [-5.43, 0.92, -2.05], fov: 35, ease: 'surge' },
    { f: 463, pos: [-1.7, 1.6, 2.6], look: [-3.4, 1.25, -0.9], fov: 37, ease: 'surge' }] }) },
  // hoard: open on the sail PILE insert (the bought sails fill the
  // frame), track the merchant's money walk, punch back to the pile
  // for the last place (kick at f542).
  hoard: { cut: 'hard', raw: keysCam({ keys: [
    KP(464, merchantAt, -1.5, 2.5, 1.58, 1.4, 37, 'smooth'),
    KP(505, merchantAt, -1.5, 2.5, 1.58, 1.4, 37, 'smooth'),
    KP(528, merchantAt, -1.3, 2.15, 1.52, 1.42, 35, 'surge'),
    { f: 548, pos: [-3.4, 1.5, 1.5], look: [-5.7, 1.05, -2.2], fov: 36, ease: 'surge' },
    { f: 560, pos: [-2.9, 1.7, 2.3], look: [-5.8, 1.1, -2.3], fov: 38, ease: 'surge' }] }) },
  // wind: tight on the godown PENNANT snapping alive, whip-pan out
  // to the bellied sails (kick on the gust, f581), push to B1's sail.
  wind: { cut: 'hard', raw: keysCam({ keys: [
    { f: 561, pos: [-4.4, 2.9, -1.2], look: [-6.9, 3.05, -4.9], fov: 38 },
    { f: 575, pos: [-4.7, 2.85, -1.5], look: [-6.9, 3.05, -4.9], fov: 37, ease: 'surge' },
    { f: 596, pos: [6.4, 2.9, -6.2], look: [-2.0, 1.9, -22.5], fov: 42, ease: 'surge' },
    { f: 627, pos: [4.6, 2.6, -8.6], look: [-4.5, 1.9, -21.8], fov: 39, ease: 'surge' }] }) },
  // bare: PUNCH onto sailor1's shocked face (38% -> ~70% in 14f) —
  // no sails, no work — then reframe to the old sailor, still calmly
  // mending his torn sail (the contrast the next beat pays off).
  bare: { cut: 'hard', raw: keysCam({ keys: [
    KP(628, s1At, 1.65, 3.1, 1.66, 1.4, 39),
    KP(642, s1At, 1.02, 1.95, 1.57, 1.44, 34, 'surge'),
    KP(688, s1At, 0.95, 1.88, 1.56, 1.44, 34, 'surge'),
    { f: 704, pos: [6.0, 1.45, -4.7], look: [3.6, 0.95, -7.9], fov: 36, ease: 'surge' },
    { f: 730, pos: [5.65, 1.38, -5.0], look: [3.6, 0.98, -7.9], fov: 34, ease: 'surge' }] }) },
  // price: the merchant names his rent — punch onto his stern face
  // (40% -> ~68%), a beat on the coin pouch, then swing to the
  // sailors' shocked faces for the landing.
  price: { cut: 'hard', raw: keysCam({ keys: [
    KP(731, merchantAt, 1.5, 2.8, 1.64, 1.42, 38),
    KP(745, merchantAt, 1.02, 1.95, 1.57, 1.45, 34, 'surge'),
    KP(800, merchantAt, 0.95, 1.88, 1.56, 1.45, 34, 'surge'),
    KP(822, s1At, 1.3, 2.4, 1.6, 1.4, 37, 'surge'),
    KP(850, s1At, 1.05, 2.0, 1.57, 1.43, 35, 'surge') ] }) },
  // rent: track sailor2's fetch from the pile, WHIP (clause-internal
  // action beat) to the HANDOVER close — hands + bundle fill the
  // frame (kick at f899) — then track sailor1 down to the quay edge.
  rent: { cut: 'hard', raw: keysCam({ keys: [
    { f: 851, pos: [-3.0, 1.55, 1.9], look: [-5.5, 1.05, -1.9], fov: 37 },
    KP(878, s2At, 1.45, 2.45, 1.52, 1.15, 37, 'smooth'),
    { f: 899, pos: [0.6, 1.5, 5.3], look: [-1.35, 1.05, 2.2], fov: 35, ease: 'surge' },
    KP(916, s1At, 1.5, 2.6, 1.55, 1.2, 37, 'surge') ] }) },
  // oldman: the INSERT first — needle, thread and the torn sail fill
  // the frame in his hands — then a punch up to his determined face
  // and a slow-by-his-standard push as the mend grows.
  oldman: { cut: 'hard', raw: keysCam({ keys: [
    { f: 917, pos: [5.15, 1.06, -5.3], look: [3.62, 0.62, -7.9], fov: 36 },
    { f: 945, pos: [5.35, 1.3, -5.15], look: [3.6, 1.05, -7.9], fov: 35, ease: 'surge' },
    { f: 975, pos: [5.15, 1.38, -5.35], look: [3.6, 1.12, -7.9], fov: 34, ease: 'surge' },
    { f: 1080, pos: [5.3, 1.42, -5.2], look: [3.6, 1.1, -7.9], fov: 34, ease: 'surge' }] }) },
  // sailaway: CLOSE on the boat as the patched sail fills (kick at
  // f1107, the catch), then a tracking pull as she runs free — the
  // camera rides the quay line at her speed before letting her go.
  sailaway: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1081, pos: [9.6, 2.2, -10.6], look: [5.4, 1.15, -17.4], fov: 38 },
    { f: 1112, pos: [9.0, 2.1, -11.6], look: [4.6, 1.1, -20.5], fov: 37, ease: 'surge' },
    { f: 1158, pos: [7.6, 2.3, -13.2], look: [1.6, 1.05, -31.5], fov: 38, ease: 'surge' }] }) },
  // sewing: a low ARC track around the sewing circle — the camera
  // travels past each working face, needles bobbing, never still.
  sewing: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1159, pos: [3.9, 1.35, 1.6], look: [0.2, 0.8, -2.9], fov: 38 },
    { f: 1195, pos: [3.3, 1.28, -0.4], look: [0.3, 0.8, -2.9], fov: 37, ease: 'smooth' },
    { f: 1230, pos: [1.8, 1.3, -0.15], look: [0.2, 0.82, -2.95], fov: 37, ease: 'smooth' },
    { f: 1269, pos: [2.6, 1.38, 0.9], look: [0.3, 0.85, -2.9], fov: 36, ease: 'surge' }] }) },
  // empty: open on the unwanted PILE (insert), track the merchant
  // arriving to an empty godown, punch to his nervous face with the
  // pile looming behind him.
  empty: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1270, pos: [-3.1, 1.6, 1.8], look: [-5.9, 1.1, -2.3], fov: 38 },
    KP(1318, merchantAt, -1.55, 2.6, 1.6, 1.4, 37, 'smooth'),
    KP(1342, merchantAt, -1.15, 2.05, 1.56, 1.43, 35, 'surge'),
    KP(1356, merchantAt, -1.08, 1.98, 1.55, 1.43, 35, 'surge') ] }) },
  // tag: the old sailor rises to speak — a tight push (mouth CLOSED;
  // this is the narration tag), the sailors' heads turning to him.
  tag: { cut: 'hard', raw: pushInCam({ subject: oldPos, a: B('tag'), b: E('tag'), d0: 3.1, d1: 2.55, h0: 1.56, h1: 1.5, lookOff: [0, 1.42, 0], fov0: 35, fov1: 32,
    dir: () => [0.5, 0.82] }) },
  // dialogue: THE LINE, performed — a WHIP entry onto the old
  // sailor, then the push tightens (face ~52% -> ~70%) and HOLDS on
  // the speaker for the whole line; listeners stay soft behind him.
  dialogue: { cut: 'whip', blend: 6, raw: pushInCam({ subject: oldPos, a: B('dialogue'), b: E('dialogue'), d0: 2.95, d1: 2.3, h0: 1.58, h1: 1.52, lookOff: [0, 1.45, 0], fov0: 33, fov1: 29,
    dir: () => [0.45, 0.85] }) },
  // hookq + hook: the R2 FINAL — character beat + hook board
  // TOGETHER. The old sailor stands foreground RIGHT (head ~20%),
  // pointing up at the board; the sailors watch mid-frame left; the
  // WHOLE board panel sits inside the frame with margins (~85%
  // width) and holds at full opacity through the literal last frame.
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: B('hookq'), pos: [6.5, 2.95, 7.2], look: [0.15, 2.6, -5.55], fov: 42 },
    { f: E('hookq'), pos: [5.95, 2.9, 6.35], look: [0.1, 2.64, -5.62], fov: 41, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [5.95, 2.9, 6.35], look: [0.1, 2.64, -5.62], fov: 41 },
    { f: E('hook'), pos: [5.8, 2.92, 6.1], look: [0.08, 2.66, -5.65], fov: 40, ease: 'surge' }] }) },
};
function oldPos(f) { const o = oldAt(f); return [o.x, o.y || 0, o.z]; }
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: B('buying') + 138, a: 0.3 }, { f: B('hoard') + 78, a: 0.26 }, { f: B('wind') + 20, a: 0.35 }, { f: B('rent') + 48, a: 0.22 }, { f: B('sailaway') + 26, a: 0.28 }],
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
  if (['drone', 'wind', 'calm'].includes(S.id)) cinf = 1.6;
  if (['price', 'dialogue', 'oldman', 'bare', 'tag'].includes(S.id)) cinf = 3.4;
  if (S.id === 'hookq' || S.id === 'hook') cinf = 1.3;   // hero AND board both readable
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
  // the title board rides the opening pull-back reveal (f72–126)
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 72, 90)) * (1 - smooth(ramp(f, 110, 128)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, B('hookq') + 40, B('hookq') + 64));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: S.id === 'sailaway' && f > B('sailaway') + 26 ? 0.85 : 0, shimmerRate: 0, windK: windKAt(f) };
};
export const fxAt = () => [];

// ---------- cast: ANIMATION UPGRADE v1+v2 performance ----------
// Emotion morphs at story beats (body.js emoTrack over the v6 face
// params; cheek shading rides every face so the skin reacts with the
// expression, brow shapes morph with it).
const withCheek = (P) => ({ ...P, cheek: 0.5, blush: 0 });
const emoMerchant = emoTrack(T.faceP, 'smug', [
  [274, 'smile', 8], [464, 'smug', 8], [561, 'smile', 8], [628, 'smug', 8], [731, 'stern', 8],
  [851, 'smug', 8], [917, 'smile', 8], [1270, 'nervous', 9], [1357, 'nervous', 8], [1521, 'smile', 8],
]);
const emoS1 = emoTrack(T.faceP, 'neutral', [
  [133, 'sad', 9], [274, 'neutral', 8], [464, 'smile', 8], [561, 'smile', 8], [628, 'shock', 6],
  [731, 'shock', 6], [851, 'nervous', 8], [917, 'relief', 8], [1159, 'smile', 8], [1401, 'smile', 8],
]);
const emoS2 = emoTrack(T.faceP, 'neutral', [
  [133, 'sad', 9], [464, 'neutral', 8], [561, 'smile', 8], [628, 'nervous', 8], [731, 'shock', 6],
  [851, 'neutral', 8], [1159, 'smile', 8], [1401, 'smile', 8],
]);
const emoS3 = emoTrack(T.faceP, 'neutral', [
  [561, 'smile', 8], [1159, 'smile', 8], [1401, 'smile', 8],
]);
const emoOld = emoTrack(T.faceP, 'smile', [
  [133, 'determined', 8], [628, 'smile', 8], [917, 'determined', 8], [1081, 'proud', 8],
  [1159, 'smile', 8], [1357, 'proud', 8], [1521, 'proud', 8],
]);
// Continuous life per character (body.js lifeAt).
const lifeMerchant = lifeAt({ seed: 41 }), lifeS1 = lifeAt({ seed: 31 }), lifeS2 = lifeAt({ seed: 51 }),
  lifeS3 = lifeAt({ seed: 52 }), lifeOld = lifeAt({ seed: 61 });
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
// head/body fragment: life (breath/tilt/sway) + a HAIR/HEAD SPRING
// term that swells while the character is moving (headTilt drives
// the whole head group — cap and hair ride it) + directed gaze.
const H2 = (life, f, seed, o = {}) => {
  const mv = o.moving ? 1 : 0.22;
  return {
    headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway + mv * 1.5 * Math.sin(f * 0.31 + seed * 2.1), 1),
    look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
    squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
    breath: Math.round(life(f).breath / 6) * 6,
  };
};
// PHYSICAL GRIPS (body.js gripAt): both hands + a weight settle ride
// the SAME frames as the 3D bundle tracks above.
//  s1 buying carry: hands on f326, place f392–412 (settle after)
//  s2 hoard carry:  hands on f480, place f526–542
//  s2 rent fetch:   hands on f871, handover f895–905
//  s1 rent carry:   takes it f905, carries to the quay edge
const gripS1 = gripAt([{ f0: 312, dur: 14, type: 'lift' }, { f0: 392, dur: 20, type: 'place', settle: 9 }, { f0: 898, dur: 8, type: 'lift' }]);
const gripS2 = gripAt([{ f0: 466, dur: 14, type: 'lift' }, { f0: 526, dur: 16, type: 'place', settle: 9 }, { f0: 862, dur: 10, type: 'lift' }, { f0: 895, dur: 10, type: 'place', settle: 6 }]);
// dialogue gesture: the old sailor's free hand talks with the voice
// (stresses on पाल / हवा / ख़रीदी / नहीं inside the performed line).
const gestOld = gestureAt([{ a: 1401, b: 1520, beats: [1413, 1448, 1479, 1506], base: 0.42, amp: 0.16 }]);
const sewK = (f, seed) => q(0.55 + 0.17 * Math.sin(f * 0.55 + seed), 2);

export const OUTFITS = {
  merchant: { jacket: '#6e2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef', moustache: '#241a12' },
  sailor1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#a34a3a', skin: '#fbf7ef' },
  sailor2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef', moustache: '#241a12' },
  sailor3: { jacket: '#8a6f42', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#2c1a10', skin: '#fbf7ef' },
  old: { jacket: '#3f6a6f', pants: '#4a3a28', boots: '#241a12', hat: 'hair', hair: '#e8e4da', skin: '#fbf7ef', moustache: '#e8e4da' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = S.id === 'hook' || S.id === 'hookq' ? '#f2ddc4' : '#ffffff', out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  const m = merchantAt(f), s1 = s1At(f), s2 = s2At(f), s3 = s3At(f), od = oldAt(f);
  const MP = withCheek(emoMerchant.at(f)), P1 = withCheek(emoS1.at(f)), P2 = withCheek(emoS2.at(f)),
    P3 = withCheek(emoS3.at(f)), PO = withCheek(emoOld.at(f));
  const mMode = merchantMode(f), s1m = s1Mode(f), s2m = s2Mode(f);
  // grip states (hands + squash ride the bundle tracks)
  const g1 = gripS1(f), g2 = gripS2(f);
  const carry1 = (S.id === 'buying' && f >= 326 && f <= 412) || (S.id === 'rent' && f >= 905);
  const carry2 = (S.id === 'hoard' && f >= 480 && f <= 542) || (S.id === 'rent' && f >= 871 && f <= 905);
  const hands = (g, carry) => carry ? { prop: ['push', q(g.k, 2)], propL: ['push', q(g.k, 2)] } : {};
  const coinM = (S.id === 'buying' && f >= 314 && f < 392) || (S.id === 'rent' && f >= 895) ? { prop: ['coin', 0.8] } : {};
  const coin1 = (S.id === 'buying' && f >= 404) || (S.id === 'rent' && f >= 869 && f < 895) ? { prop: ['coin', 0.8] } : {};
  const M_ = { expr: 'smile', exprP: MP, mode: mMode, phase: q(merchPh(f), 2), blink: blinkAt(f, 41), seed: 41, clothShade: true,
    ...H2(lifeMerchant, f, 41, { moving: mMode === 'stroll', squash: 0, ht: -1, look: 0.15, facing: 0.1 }), ...coinM };
  const S1_ = { expr: 'smile', exprP: P1, mode: s1m, phase: q(s1Ph(f), 2), blink: blinkAt(f, 31), seed: 31, clothShade: true,
    ...H2(lifeS1, f, 31, { moving: s1m === 'stroll', squash: Math.max(g1.squash, carry1 ? carryDip(f, 0.55) : 0), ht: -1, look: 0.15, facing: 0.1 }),
    ...(carry1 ? hands(g1, true) : coin1) };
  const S2_ = { expr: 'smile', exprP: P2, mode: s2m, phase: q(s2Ph(f), 2), blink: blinkAt(f, 51), seed: 51, clothShade: true,
    ...H2(lifeS2, f, 51, { moving: s2m === 'stroll', squash: Math.max(g2.squash, carry2 ? carryDip(f, 0.55) : 0), ht: -1, look: 0.1, facing: 0.1 }),
    ...(carry2 ? hands(g2, true) : {}) };
  const S3_ = { expr: 'smile', exprP: P3, mode: shotAt(f).id === 'sewing' ? 'sit' : 'stand', phase: q(s3Ph(f), 2), blink: blinkAt(f, 52), seed: 52, clothShade: true,
    ...H2(lifeS3, f, 52, { ht: -1, look: 0.1, facing: 0.05 }) };
  const OLD_ = { expr: 'smile', exprP: PO, mode: 'sit', blink: blinkAt(f, 61), seed: 61, clothShade: true,
    ...H2(lifeOld, f, 61, { ht: 2, look: 0.1, lookY: 0.3, facing: 0.1 }) };
  switch (S.id) {
    case 'drone': {
      std('merchant', OUTFITS.merchant, { ...M_, prop: ['count', q(0.5 + 0.2 * Math.sin(f * 0.4), 2)] }, m.x, m.z, { yaw: -0.5 });
      std('sailor1', OUTFITS.sailor1, { ...S1_ }, s1.x, s1.z, { yaw: 0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.3 });
      std('old', OUTFITS.old, { ...OLD_, prop: ['sew', sewK(f, 61)] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'calm': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, ...H2(lifeS1, f, 31, { ht: 1.5, look: -0.3, lookY: -0.2, facing: -0.2 }) }, s1.x, s1.z, { yaw: 0.5 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.4 });
      std('sailor3', OUTFITS.sailor3, { ...S3_ }, s3.x, s3.z, { yaw: -0.3 });
      std('old', OUTFITS.old, { ...OLD_, prop: ['sew', sewK(f, 61)] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'buying': {
      std('sailor1', OUTFITS.sailor1, { ...S1_ }, s1.x, s1.z, { yaw: 0.55 });
      std('merchant', OUTFITS.merchant, { ...M_ }, m.x, m.z, { yaw: -0.55 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.35 });
      break;
    }
    case 'hoard': {
      std('merchant', OUTFITS.merchant, { ...M_, prop: M_.prop || ['point', 0.6] }, m.x, m.z, { yaw: -0.7 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.5 });
      std('sailor1', OUTFITS.sailor1, { ...S1_ }, s1.x, s1.z, { yaw: 0.4 });
      break;
    }
    case 'wind': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, ...H2(lifeS1, f, 31, { ht: -2.5, look: -0.4, lookY: -0.35, facing: -0.3 }) }, s1.x, s1.z, { yaw: 0.5 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, ...H2(lifeS2, f, 51, { ht: -2.5, look: -0.4, lookY: -0.35, facing: -0.3 }) }, s2.x, s2.z, { yaw: 0.4 });
      std('sailor3', OUTFITS.sailor3, { ...S3_, ...H2(lifeS3, f, 52, { ht: -2.5, look: -0.4, lookY: -0.35, facing: -0.3 }) }, s3.x, s3.z, { yaw: -0.2 });
      std('old', OUTFITS.old, { ...OLD_, ...H2(lifeOld, f, 61, { ht: -2, look: -0.3, lookY: -0.3, facing: -0.2 }) }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'bare': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, ...H2(lifeS1, f, 31, { ht: -0.5, look: 0.3, lookY: -0.1, facing: 0.25 }) }, s1.x, s1.z, { yaw: 0.6 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.45 });
      std('old', OUTFITS.old, { ...OLD_, prop: ['sew', sewK(f, 61)] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.4 });
      break;
    }
    case 'price': {
      std('merchant', OUTFITS.merchant, { ...M_, prop: ['point', 0.8] }, m.x, m.z, { yaw: -0.6 });
      std('sailor1', OUTFITS.sailor1, { ...S1_ }, s1.x, s1.z, { yaw: 0.6 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.5 });
      break;
    }
    case 'rent': {
      std('sailor1', OUTFITS.sailor1, { ...S1_ }, s1.x, s1.z, { yaw: 0.55 });
      std('sailor2', OUTFITS.sailor2, { ...S2_ }, s2.x, s2.z, { yaw: 0.4 });
      std('merchant', OUTFITS.merchant, { ...M_ }, m.x, m.z, { yaw: -0.55 });
      break;
    }
    case 'oldman': {
      std('old', OUTFITS.old, { ...OLD_, ...H2(lifeOld, f, 61, { ht: 3.5, look: 0.2, lookY: 0.5, facing: 0.15 }), prop: ['sew', sewK(f, 61)] }, od.x, od.z, { y: od.y, ground: od.y, yaw: -0.35 });
      std('sailor3', OUTFITS.sailor3, { ...S3_ }, s3.x, s3.z, { yaw: -0.3 });
      break;
    }
    case 'sailaway': {
      std('old', OUTFITS.old, { expr: 'smile', exprP: PO, mode: 'stand', blink: blinkAt(f, 61), seed: 61, clothShade: true,
        ...H2(lifeOld, f, 61, { ht: -2, look: 0.3, lookY: -0.1, facing: 0.25 }) }, od.x, od.z, { y: od.y, ground: od.y, blob: false, yaw: 0.3 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, wave: q(Math.sin(f * 0.4 + 31), 2) }, s1.x, s1.z, { yaw: 0.5 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, wave: q(Math.sin(f * 0.4 + 51), 2) }, s2.x, s2.z, { yaw: 0.4 });
      break;
    }
    case 'sewing': {
      std('sailor1', OUTFITS.sailor1, { ...S1_, mode: 'sit', prop: ['sew', sewK(f, 31)] }, s1.x, s1.z, { yaw: 0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, mode: 'sit', prop: ['sew', sewK(f, 51)] }, s2.x, s2.z, { yaw: -0.3 });
      std('sailor3', OUTFITS.sailor3, { ...S3_, prop: ['sew', sewK(f, 52)] }, s3.x, s3.z, { yaw: 0.2 });
      std('old', OUTFITS.old, { expr: 'smile', exprP: PO, mode: 'stand', blink: blinkAt(f, 61), seed: 61, clothShade: true,
        ...H2(lifeOld, f, 61, { ht: -1.5, look: 0.2, facing: 0.2 }) }, od.x, od.z, { y: od.y, ground: od.y, blob: false, yaw: 0.3 });
      break;
    }
    case 'empty': {
      std('merchant', OUTFITS.merchant, { ...M_, ...H2(lifeMerchant, f, 41, { moving: mMode === 'stroll', ht: 1.5, look: -0.3, lookY: 0.1, facing: -0.25 }) }, m.x, m.z, { yaw: -0.7 });
      std('old', OUTFITS.old, { expr: 'smile', exprP: PO, mode: 'stand', blink: blinkAt(f, 61), seed: 61, clothShade: true,
        ...H2(lifeOld, f, 61, { ht: -1.5, look: 0.2, facing: 0.2 }) }, od.x, od.z, { y: od.y, ground: od.y, blob: false, yaw: 0.3 });
      break;
    }
    case 'tag': {
      // narration tag — the old sailor rises and turns to the group;
      // his mouth stays CLOSED (the line is voice-over until L16)
      std('old', OUTFITS.old, { expr: 'smile', exprP: PO, mode: 'stand', blink: blinkAt(f, 61), seed: 61, clothShade: true,
        ...H2(lifeOld, f, 61, { ht: -1, look: 0.35, lookY: 0, facing: 0.3 }) }, od.x, od.z, { y: 0, ground: 0, yaw: 0.45 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, mode: 'stand', ...H2(lifeS1, f, 31, { ht: -1, look: 0.5, facing: 0.4 }) }, s1.x, s1.z, { yaw: -0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, mode: 'stand', ...H2(lifeS2, f, 51, { ht: -1, look: 0.5, facing: 0.4 }) }, s2.x, s2.z, { yaw: -0.3 });
      std('sailor3', OUTFITS.sailor3, { ...S3_, mode: 'stand', ...H2(lifeS3, f, 52, { ht: -1, look: 0.5, facing: 0.4 }) }, s3.x, s3.z, { yaw: -0.2 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the old sailor PERFORMS his line — mouth
      // driven by the stem inside the speak segment, closed outside
      // it; his free hand gestures with the voice; the sailors only
      // listen (their mouths never open).
      const sp = speakFace('proud', f);
      std('old', OUTFITS.old, { mode: 'stand', blink: blinkAt(f, 61), seed: 61, clothShade: true,
        expr: sp.expr, exprP: sp.exprP, headTilt: sp.headTilt, look: 0.12, lookY: 0, facing: 0.1,
        propL: ['point', q(gestOld(f).k, 2)],
        tilt: q(lifeOld(f).tilt + lifeOld(f).sway, 1), breath: Math.round(lifeOld(f).breath / 6) * 6 }, od.x, od.z, { y: 0, ground: 0, yaw: 0.45 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, mode: 'stand', ...H2(lifeS1, f, 31, { ht: -1.5, look: 0.5, facing: 0.4 }) }, s1.x, s1.z, { yaw: -0.4 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, mode: 'stand', ...H2(lifeS2, f, 51, { ht: -1.5, look: 0.5, facing: 0.4 }) }, s2.x, s2.z, { yaw: -0.3 });
      break;
    }
    case 'hookq': case 'hook': {
      // the R2 final beat: the old sailor in the FOREGROUND (right),
      // pointing up at the hook board, mouth CLOSED (narration only);
      // the sailors watch the board mid-frame left.
      std('old', OUTFITS.old, { expr: 'smile', exprP: PO, mode: 'stand', blink: blinkAt(f, 61), seed: 61, clothShade: true,
        prop: ['point', 0.3], ...H2(lifeOld, f, 61, { ht: -2.5, look: -0.45, lookY: -0.4, facing: -0.4 }) }, od.x, od.z, { y: 0, ground: 0, yaw: -0.5 });
      std('sailor1', OUTFITS.sailor1, { ...S1_, mode: 'stand', ...H2(lifeS1, f, 31, { ht: -2, look: -0.3, lookY: -0.35, facing: -0.25 }) }, s1.x, s1.z, { yaw: -0.3 });
      std('sailor2', OUTFITS.sailor2, { ...S2_, mode: 'stand', ...H2(lifeS2, f, 51, { ht: -2, look: -0.3, lookY: -0.35, facing: -0.25 }) }, s2.x, s2.z, { yaw: -0.25 });
      std('sailor3', OUTFITS.sailor3, { ...S3_, mode: 'stand', ...H2(lifeS3, f, 52, { ht: -2, look: -0.3, lookY: -0.35, facing: -0.25 }) }, s3.x, s3.z, { yaw: -0.2 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (UNCHANGED) ----------
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
  const by = F('buying'), hd = F('hoard');
  if (f >= by.a + 38 && f <= by.a + 51) items.push({ id: 'bundleA', y: ba.y - 0.29, ground: 0, maxHover: 0.04 });
  if (f >= by.a + 136 && f <= by.a + 138) items.push({ id: 'bundleA', y: ba.y - 0.29, ground: PILE_POS[0].y - 0.29, maxHover: 0.04 });
  if (f >= hd.a + 76 && f <= hd.a + 78) items.push({ id: 'bundleA', y: ba.y - 0.29, ground: PILE_POS[6].y - 0.29, maxHover: 0.04 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
