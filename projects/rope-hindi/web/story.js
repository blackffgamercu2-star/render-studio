// Shot plan for "रेत की रस्सी" (batch-4 topic 5, HI) —
// timed to the ACTUAL Hindi voice stem (61.051 s, 30 fps, TOTAL 1832), clause
// timings from faster-whisper small hi + skeleton clause map (work/timing.json).
// 29 clauses (CL = clause start frames, index 0 = C1):
// C1 राजा ने एक माली को हुक्म दिया · C2 सुबह तक रेत की रस्सी बनाओ, वरना सिर कटेगा
// C3 माली ने एक साँस में हाँ कर दी · C4 राजा को चालाकी में हारना पसंद नहीं था
// C5 एक शाम उसने अपने बूढ़े माली को बुलाया और कहा · C6 सूरज निकलने तक रेत से बुनी रस्सी लेकर आओ
// C7 नाकाम हुए — तो सिर धड़ से अलग · C8 दरबार इंतज़ार करता रहा कि बूढ़ा गिड़गिड़ाएगा
// C9 लेकिन वह शांति से झुका · C10 हो जाएगा, महाराज
// C11 मुझे शाही भंडार से सिर्फ़ एक छोटी सी चीज़ चाहिए · C12 नाम लो!
// C13 पिछले साल की रेत की रस्सी, महाराज · C14 जो आपके दादा के जुलाहों ने बनाई थी
// C15 मैं सिर्फ़ एक माली हूँ · C16 मुझे उनका नमूना हूबहू नक़ल करना होगा, वरना रस्सी टिकेगी नहीं
// C17 राजा की मुस्कान जम गई · C18 ऐसी कोई रस्सी थी ही नहीं। कभी थी ही नहीं
// C19 आप नामुमकिन माँग रहे हैं, माली ने नरमी से कहा · C20 और मैं सिर्फ़ यह पूछ रहा हूँ कि यह पहले कैसे बना था
// C21 राजा घूरता रहा · C22 फिर इतना हँसा कि उसका मुकुट फिसल गया
// C23 बूढ़े लोमड़! ये सोने की थैली लो · C24 और अपना हुक्म भी वापस लेते जाओ
// C25 वह नामुमकिन हुक्म उसी रात मर गया · C26 एक विनम्र सवाल से मारा गया
// C27 लेकिन कल मिलिए उस लड़के से जिसने राजा के विशाल हाथी को तौल दिया
// C28 बिना तराज़ू के, बिना मशीन के, सिर्फ़ एक नाव और पत्थरों के ढेर से
// C29 भला बिना तराज़ू के हाथी को तौला कैसे जाता है?
// QUALITY RULES (locked): shots change ONLY at clause boundaries; camera TRACKS
// the voice-named subject every beat, never freezes, never drifts; costumes by
// role (king = royal maroon + gold, 3D crown; gardener = old worn work clothes,
// grey moustache); PHYSICS: sand grains fall with gravity and land on the pile;
// the gold bag travels hand-to-hand with a weight sag + settle; the crown slips
// ON the king's head (tilt/slide, always in contact) when he laughs.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1832, DECK = 0;
// Clause start frames C1..C29 (+ end sentinel) — from work/timing.json (ASR).
export const CL = [0, 79, 130, 182, 258, 316, 424, 455, 528, 575, 604, 668, 701, 760, 812, 844, 952, 1006, 1077, 1157, 1239, 1272, 1333, 1382, 1459, 1508, 1555, 1657, 1762, 1832];
const c0 = (i) => CL[i - 1];            // start frame of clause i (1-based)
const c1 = (i) => CL[i] - 1;            // last frame of clause i

export const SHOTS = [
  { id: 'garden', a: c0(1), b: c1(3), light: 'eve' },
  { id: 'court', a: c0(4), b: c1(7), light: 'court' },
  { id: 'plea', a: c0(8), b: c1(12), light: 'court' },
  { id: 'ask', a: c0(13), b: c1(16), light: 'court' },
  { id: 'frozen', a: c0(17), b: c1(18), light: 'court' },
  { id: 'soft', a: c0(19), b: c1(20), light: 'court' },
  { id: 'laugh', a: c0(21), b: c1(24), light: 'court' },
  { id: 'night', a: c0(25), b: c1(26), light: 'court' },
  { id: 'hook', a: c0(27), b: c1(29), light: 'eve' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- staging ----------
export const KINGP = [-16, 0.3, -5.9];            // on the dais, before the throne
export const KING_YAW = 0.12, KING_S = 1.06;
export const GARD = [0.8, 0, -0.45];              // gardener in his garden
export const PILE_POS = [1.7, 0, -0.5];           // the sand pile (garden)
export const SAND_EMIT = [1.30, 1.42, -0.32];     // his raised hand, above the pile's west slope
export const GARD_COURT = [-13.9, 0, -3.7];       // gardener before the dais
export const GARD_HOME = [2.3, 0, -1.5];          // gardener back home (hook shot)
export const kingAt = (f) => ({ pos: KINGP, yaw: KING_YAW, s: KING_S });
/** Gardener's night walk home: court -> garden, foot-locked laden march.
 *  Starts at the night shot boundary (teleport-in mid-path is NOT used: he
 *  begins at the court steps and the walk spans night+hook C27-C28). */
export const gardenerNightPos = (f) => kf3([
  [c0(25), [-9.8, 0, -2.2]], [c0(26), [-6.4, 0, -1.6]], [c0(27), [-3.6, 0, -1.1]],
  [c0(28), [0.6, 0, -1.3]], [c1(28), GARD_HOME],
], f);
export const nightWalkAt = (f) => {
  const a = c0(25), b = c1(28);
  if (f < a || f > b) return { phase: 0, moving: false, bob: 0 };
  // distance along the path (segment lengths summed ≈ 4.5+4.6+4.2+1.75 ≈ 15.1 m
  // over the whole span — laden pace; phase locked to the kf3 travel itself:
  const p0 = gardenerNightPos(f), p1 = gardenerNightPos(Math.min(f + 1, b));
  const dNow = gardenerNightPos(a);
  let d = 0, prev = dNow;
  for (let g = a; g <= f; g += 6) { const p = gardenerNightPos(g); d += Math.hypot(p[0] - prev[0], p[2] - prev[2]); prev = p; }
  d += Math.hypot(p0[0] - prev[0], p0[2] - prev[2]);
  const moving = f > a + 2 && f < b - 2 && Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.0005;
  return { phase: (d / 1.35) % 1, moving, bob: moving ? Math.abs(Math.sin(d / 1.35 * Math.PI)) * 0.03 : 0 };
};

// ---------- the gold bag (hand-to-hand physics) ----------
const BAG_REST = [-14.95, 0.48, -5.0];            // resting ON the dais carpet beside the king
const BAG_KINGHAND = [-15.35, 1.04, -4.72];
const BAG_MID = [-14.55, 0.82, -4.15];            // sag point between the two men
const BAG_GARDHAND = [-13.52, 1.06, -3.66];       // at his raised hand: beside the torso silhouette, camera-side (centred/behind = disc pokes through card, f1400)
export const bagAt = (f) => {
  const h0 = c0(23) + 4;                          // king reaches for the bag
  const arr = h0 + 48;                            // bag lands in the gardener's hands
  if (f < h0) return { p: BAG_REST, sq: 1, tilt: 0 };
  if (f < arr) {
    const p = kf3([[h0, BAG_REST], [h0 + 14, BAG_KINGHAND], [h0 + 30, BAG_MID], [arr, BAG_GARDHAND]], f);
    return { p, sq: 1 - 0.05 * Math.sin(ramp(f, h0 + 14, arr) * Math.PI), tilt: 0.1 * Math.sin(ramp(f, h0, arr) * Math.PI) };
  }
  const S = shotAt(f);
  if (S.id === 'laugh') {
    // held: weight settle dip just after the catch, then a steady laden hold
    const u = clamp((f - arr) / 18);
    const dip = f < arr + 18 ? Math.sin(u * Math.PI) : 0;
    return { p: [BAG_GARDHAND[0], BAG_GARDHAND[1] - 0.06 * dip + 0.008 * Math.sin(f * 0.09), BAG_GARDHAND[2]], sq: 1 - 0.1 * dip, tilt: 0.05 * dip };
  }
  if (S.id === 'night' || S.id === 'hook') {
    if (f >= c0(27) && shotAt(f).id === 'hook' && f > c1(28)) {
      return { p: [GARD_HOME[0] + 0.38, 0.97, GARD_HOME[2] + 0.06], sq: 1, tilt: 0.04 };
    }
    const gp = gardenerNightPos(f), wk = nightWalkAt(f);
    return { p: [gp[0] + 0.38, 0.97 + wk.bob, gp[2] + 0.06], sq: 1, tilt: 0.09 * Math.sin(wk.phase * Math.PI * 2) };
  }
  return { p: BAG_GARDHAND, sq: 1, tilt: 0 };
};

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  eve: { az: 235, el: 20, sky: '#e8b48a', ground: '#5f5240', hemi: 1.05, sun: '#ffb877', sunI: 2.0, fog: '#e0c2a0', fogNear: 44, fogFar: 360,
    skyTop: '#6a5a9e', skyHor: '#ffd9a8', sunDisc: '#ffdfae', sunSize: 0.004, sat: 1.06, vig: 0.2, shadowExt: 150, aurora: 0, gain: '#ffe8d2', ...WATER },
  court: { az: 130, el: 30, sky: '#d8b490', ground: '#5c4a34', hemi: 1.08, sun: '#ffcf96', sunI: 2.0, fog: '#dcc49c', fogNear: 40, fogFar: 320,
    skyTop: '#565a8c', skyHor: '#ffdfae', sunDisc: '#fff0c8', sunSize: 0.0032, sat: 1.06, vig: 0.23, shadowExt: 150, aurora: 0, gain: '#ffedd0', ...WATER },
  night: { az: 305, el: 38, sky: '#33406e', ground: '#232838', hemi: 0.52, sun: '#aebfff', sunI: 0.65, fog: '#2a3350', fogNear: 38, fogFar: 300,
    skyTop: '#141c38', skyHor: '#4a557e', sunDisc: '#dfe8ff', sunSize: 0.0028, sat: 1.0, vig: 0.3, shadowExt: 150, aurora: 0, gain: '#c8d2ee', ...WATER },
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
  if (S.id === 'night') return blendLight(LIGHTS.court, LIGHTS.night, smooth(ramp(f, c0(25) + 6, c0(26))));
  if (S.id === 'hook') return blendLight(LIGHTS.night, LIGHTS.eve, smooth(ramp(f, c0(28), c1(29))) * 0.45);
  return { ...LIGHTS[S.light] };
};

const HERO = {
  garden: (f) => (f < c0(2) ? [0.6, 1.6, -2.2] : [1.55, 0.7, -0.5]),
  court: (f) => (f < c0(6) ? KINGP : GARD_COURT),
  plea: (f) => (f < c0(12) ? GARD_COURT : KINGP),
  ask: () => GARD_COURT,
  frozen: () => KINGP,
  soft: (f) => (f < c0(20) ? GARD_COURT : KINGP),
  laugh: (f) => (f < c0(23) ? KINGP : [-14.4, 0.9, -4.2]),
  night: (f) => gardenerNightPos(f),
  hook: (f) => (f < c0(29) ? gardenerNightPos(f) : [4.4, 2.2, -3.2]),
};
export const heroPosAt = (f) => {
  const h = HERO[shotAt(f).id](f);
  return [h[0], h[1] ?? 1.0, h[2]];
};

// ---------- cameras ----------
// Continuous flight: every shot's first key repeats the previous shot's last
// key; inside a shot a key lands on each clause boundary, surging TO the
// clause's subject. Garden at x≈0.8, court at x=-16.
const CAMS = {
  garden: [
    { f: c0(1), pos: [5.6, 3.1, 6.8], look: [0.7, 1.45, -1.7], fov: 46 },
    { f: c0(2), pos: [5.15, 2.85, 6.2], look: [0.75, 1.4, -1.65], fov: 45, ease: 'surge' },
    { f: c0(2) + 26, pos: [3.1, 1.7, 2.6], look: [1.45, 0.75, -0.5], fov: 40, ease: 'surge' },
    { f: c1(3), pos: [2.7, 1.8, 2.9], look: [0.85, 1.05, -0.5], fov: 40, ease: 'surge' },
  ],
  court: [
    { f: c0(4), pos: [2.7, 1.8, 2.9], look: [0.85, 1.05, -0.5], fov: 40 },
    { f: c0(5), pos: [-6.5, 2.8, 2.5], look: [-13.5, 1.2, -4.2], fov: 44, ease: 'surge' },
    { f: c0(6), pos: [-10.6, 2.2, -0.6], look: [-15.6, 1.35, -5.6], fov: 42, ease: 'surge' },
    { f: c1(7), pos: [-11.4, 2.0, -1.2], look: [-14.6, 1.0, -4.4], fov: 42, ease: 'surge' },
  ],
  plea: [
    { f: c0(8), pos: [-11.4, 2.0, -1.2], look: [-14.6, 1.0, -4.4], fov: 42 },
    { f: c0(9), pos: [-10.9, 2.1, -0.7], look: [-14.2, 1.0, -4.0], fov: 42, ease: 'surge' },
    { f: c0(10), pos: [-11.6, 1.9, -1.0], look: [-13.9, 0.95, -3.7], fov: 40, ease: 'surge' },
    { f: c0(12), pos: [-12.4, 2.0, -1.6], look: [-15.8, 1.5, -5.8], fov: 40, ease: 'surge' },
    { f: c1(12), pos: [-12.7, 2.0, -1.8], look: [-15.9, 1.5, -5.85], fov: 39 },
  ],
  ask: [
    { f: c0(13), pos: [-12.7, 2.0, -1.8], look: [-15.9, 1.5, -5.85], fov: 39 },
    { f: c0(14), pos: [-11.8, 1.9, -1.1], look: [-13.9, 1.0, -3.7], fov: 41, ease: 'surge' },
    { f: c0(16), pos: [-11.5, 1.9, -0.9], look: [-13.95, 1.05, -3.7], fov: 40, ease: 'surge' },
    { f: c1(16), pos: [-11.9, 2.0, -1.3], look: [-14.8, 1.2, -4.6], fov: 41, ease: 'surge' },
  ],
  frozen: [
    { f: c0(17), pos: [-11.9, 2.0, -1.3], look: [-14.8, 1.2, -4.6], fov: 41 },
    { f: c0(18), pos: [-12.9, 2.1, -2.0], look: [-15.9, 1.55, -5.85], fov: 37, ease: 'surge' },
    { f: c1(18), pos: [-13.2, 2.1, -2.2], look: [-16.0, 1.55, -5.9], fov: 36 },
  ],
  soft: [
    { f: c0(19), pos: [-13.2, 2.1, -2.2], look: [-16.0, 1.55, -5.9], fov: 36 },
    { f: c0(20), pos: [-11.7, 1.9, -1.0], look: [-13.9, 1.0, -3.7], fov: 40, ease: 'surge' },
    { f: c1(20), pos: [-12.1, 2.0, -1.4], look: [-14.9, 1.25, -4.7], fov: 40, ease: 'surge' },
  ],
  laugh: [
    { f: c0(21), pos: [-12.1, 2.0, -1.4], look: [-14.9, 1.25, -4.7], fov: 40 },
    { f: c0(22), pos: [-12.8, 2.05, -1.9], look: [-15.9, 1.5, -5.85], fov: 38, ease: 'surge' },
    { f: c0(23), pos: [-11.9, 2.0, -1.2], look: [-14.7, 0.95, -4.3], fov: 42, ease: 'surge' },
    { f: c1(24), pos: [-11.5, 2.1, -0.8], look: [-14.2, 1.0, -3.9], fov: 41, ease: 'surge' },
  ],
  night: [
    { f: c0(25), pos: [-11.5, 2.1, -0.8], look: [-14.2, 1.0, -3.9], fov: 41 },
    { f: c0(26), pos: [-10.4, 2.2, 0.6], look: [-9.5, 1.0, -2.0], fov: 42, ease: 'surge' },
    { f: c1(26), pos: [-7.6, 2.2, 1.6], look: [-5.6, 1.0, -1.4], fov: 42, ease: 'surge' },
  ],
  hook: [
    { f: c0(27), pos: [-7.6, 2.2, 1.6], look: [-5.6, 1.0, -1.4], fov: 42 },
    { f: c0(28), pos: [-2.6, 2.1, 2.6], look: [0.2, 1.0, -1.3], fov: 42, ease: 'surge' },
    { f: c0(29), pos: [1.5, 2.05, 2.3], look: [4.4, 2.2, -3.2], fov: 38, ease: 'surge' },
    { f: c1(29), pos: [1.35, 2.05, 2.5], look: [4.4, 2.25, -3.2], fov: 37, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['frozen', 'laugh'].includes(S.id)) cinf = 3.6;
  if (S.id === 'garden' && f >= c0(2)) cinf = 3.4;
  if (S.id === 'hook') cinf = 3.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
const POUR_START = () => c0(2) + 8;
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardHook: 0, sandT: -1, pileGrow: 0, crown: 0, crownSlip: 0 };
  if (S.id === 'garden') {
    W.boardTitle = 1 - smooth(ramp(f, c0(2), c0(2) + 7));
    const ps = POUR_START();
    if (f >= ps && f <= ps + 120) W.sandT = (f - ps) / 30;
    W.pileGrow = smooth(ramp(f, ps + 15, ps + 85));
  }
  if (['court', 'plea', 'ask', 'frozen', 'soft', 'laugh'].includes(S.id)) W.crown = 1;
  if (S.id === 'laugh') {
    const s0 = c0(22) + Math.round((c1(22) - c0(22)) * 0.55); // "मुकुट फिसल गया" lands mid-C22
    W.crownSlip = kf([[s0, 0], [s0 + 13, 1.18], [s0 + 23, 0.9], [s0 + 33, 1.0]], f);
  }
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, c0(29) + 2, c0(29) + 26));
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: S.id === 'night' || S.id === 'hook' ? 0.15 : 0.3, dustRate: 0.12, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { eve: '#ffd9b0', court: '#ffdfb0', night: '#aebfe8' };
const tintFor = (S, f) => S.id === 'night' || (S.id === 'hook' && f < c0(29)) ? TINT.night : (TINT[S.light] || '#ffffff');
// COSTUMES BY ROLE — king: royal maroon robe + gold trim tones, dark beard;
// gardener: OLD man, worn dusty work clothes, cloth cap, grey moustache;
// courtiers: muted noble clothes; guard: steel cap.
export const OUTFITS = {
  king: { jacket: '#7e1f2e', pants: '#3d2438', boots: '#2a1a12', hat: 'hair', hair: '#2a1c12', skin: '#e8b08a', moustache: '#33241a' },
  gardener: { jacket: '#8a7355', pants: '#5d4a33', boots: '#3a2a1a', hat: 'cap', cap: '#a08b6d', skin: '#c98a5a', moustache: '#d8d2c2' },
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
const courtCast = (T, tint, f, kingExpr, gardExpr, opts = {}) => {
  const out = [];
  const kk = opts.kingProp ? { prop: opts.kingProp } : {};
  out.push(RW(T, OUTFITS.king, { expr: kingExpr, mode: 'stand', blink: opts.kingBlink ?? blinkAt(f, 41), seed: 41, ...kk }, KINGP, { tint, yaw: KING_YAW, s: KING_S }));
  const gk = opts.gardProp ? { prop: opts.gardProp } : {};
  const gpos = opts.gardBow ? BP(GARD_COURT, opts.gardBow) : GARD_COURT;
  const gopts = opts.gardBow ? { ...gk, ...bowOpts(opts.gardBow) } : gk;
  out.push(RW(T, OUTFITS.gardener, { expr: gardExpr, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...gopts }, gpos, { tint, yaw: -0.35 }));
  out.push(RW(T, OUTFITS.court1, { expr: opts.courtExpr || 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, COURTIERS[0], { tint, yaw: 0.35 }));
  out.push(RW(T, OUTFITS.court2, { expr: opts.courtExpr || 'neutral', mode: 'stand', blink: blinkAt(f, 72), seed: 72 }, COURTIERS[1], { tint, yaw: -0.3 }));
  out.push(RW(T, OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 73), seed: 73 }, [-12.1, 0, -6.3], { tint, yaw: 0.2 }));
  return out;
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'garden': {
      // C1: the gardener at his pile as the order is narrated. C2: he lifts a
      // handful of sand and lets it POUR through his fingers back onto the
      // pile (grains in main.js, timed to worldAt sandT). C3: a calm nod —
      // he said yes in one breath.
      const ps = POUR_START();
      const pk = f < ps - 6 ? 0 : q(0.55 * (smooth(ramp(f, ps - 6, ps + 6)) * (1 - smooth(ramp(f, ps + 72, ps + 90)))), 2);
      const nod = bowK(f, c0(3) + 4, c0(3) + 16, c0(3) + 30, c0(3) + 44);
      const expr = f >= c0(3) ? 'smile_closed' : 'neutral';
      out.push(RW(T, OUTFITS.gardener, { expr, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...(pk > 0.02 ? { prop: ['sand', pk] } : {}), ...bowOpts(nod) }, BP(GARD, nod), { tint, yaw: 0.18 }));
      break;
    }
    case 'court': {
      // C4 narration over the court; C5 the king summons + points; C6-C7 the
      // order itself — king stern, gardener nervous under the threat.
      const pk = armK(f, c0(5) + 6, c0(5) + 20, c0(7) + 6, c0(7) + 22);
      out.push(...courtCast(T, tint, f, 'stern', f < c0(5) ? 'neutral' : 'nervous', { kingProp: pk > 0.02 ? ['point', pk] : null }));
      break;
    }
    case 'plea': {
      // C8 the court waits for begging; C9 he BOWS calmly instead; C10-C11 the
      // quiet request (hand raised gently); C12 the king snaps "नाम लो!"
      const bk = bowK(f, c0(9) + 2, c0(9) + 14, c0(10) + 8, c0(10) + 22);
      const gk = armK(f, c0(10) + 4, c0(10) + 16, c0(12), c0(12) + 10, 0.6);
      const kk = armK(f, c0(12) + 2, c0(12) + 10, c1(12) - 8, c1(12));
      out.push(...courtCast(T, tint, f, f >= c0(12) ? 'stern' : 'neutral', f >= c0(10) ? 'smile_closed' : 'nervous',
        { gardBow: bk, gardProp: gk > 0.02 ? ['push', gk] : null, kingProp: kk > 0.02 ? ['point', kk] : null, courtExpr: f < c0(9) ? 'neutral' : 'dazed' }));
      break;
    }
    case 'ask': {
      // C13-C16 the impossible request, explained calmly; the king listens,
      // his stern face slowly losing ground.
      out.push(...courtCast(T, tint, f, f >= c0(16) ? 'nervous' : 'stern', 'smile_closed', {}));
      break;
    }
    case 'frozen': {
      // C17: the king's grin FREEZES (no blink — held smile, wide eyes).
      // C18: it drains away — no such rope ever existed.
      out.push(...courtCast(T, tint, f, f < c0(18) ? 'grin' : 'shock', 'neutral', { kingBlink: f < c0(18) ? 0 : blinkAt(f, 41), courtExpr: 'dazed' }));
      break;
    }
    case 'soft': {
      // C19-C20 the gardener's gentle logic; the king has no answer.
      out.push(...courtCast(T, tint, f, 'nervous', 'smile_closed', {}));
      break;
    }
    case 'laugh': {
      // C21 the stare. C22 the laugh bursts out — crown slips mid-clause.
      // C23 the king holds out the gold bag (bag mesh travels hand-to-hand);
      // the gardener reaches, catches its weight, C24 bows his thanks.
      const h0 = c0(23) + 4, arr = h0 + 48;
      const kk = armK(f, h0 - 6, h0 + 8, arr + 6, arr + 20);
      const gk = armK(f, h0 + 26, arr, c0(24) + 26, c1(24) - 6);
      const bk = bowK(f, c0(24) + 10, c0(24) + 24, c1(24) - 14, c1(24));
      const kingExpr = f < c0(22) ? 'stern' : (f < c0(23) ? 'laugh' : 'grin');
      const gardExpr = f < h0 + 30 ? 'shock' : 'grin';
      out.push(...courtCast(T, tint, f, kingExpr, gardExpr,
        { kingProp: kk > 0.02 ? ['push', kk] : null, gardProp: gk > 0.02 ? ['push', gk] : null, gardBow: bk, courtExpr: f >= c0(22) ? 'laugh' : 'neutral' }));
      break;
    }
    case 'night': {
      // The order dies that night: the gardener walks home under the moon,
      // gold bag heavy in his hand (bag mesh follows in main.js via bagAt).
      const gp = gardenerNightPos(f), wk = nightWalkAt(f);
      out.push(RW(T, OUTFITS.gardener, { expr: 'smile_closed', mode: wk.moving ? 'march' : 'stand', phase: q(wk.phase, 3), blink: blinkAt(f, 51), seed: 51 }, [gp[0], wk.bob, gp[2]], { tint, yaw: 0.5 }));
      break;
    }
    case 'hook': {
      // He arrives home during C27-C28 and stands by the signpost, bag in
      // hand, as tomorrow's question rises on the board (C29).
      if (f <= c1(28)) {
        const gp = gardenerNightPos(f), wk = nightWalkAt(f);
        out.push(RW(T, OUTFITS.gardener, { expr: 'smile_closed', mode: wk.moving ? 'march' : 'stand', phase: q(wk.phase, 3), blink: blinkAt(f, 51), seed: 51 }, [gp[0], wk.bob, gp[2]], { tint, yaw: 0.5 }));
      } else {
        out.push(st(OUTFITS.gardener, 'smile_closed', 51, GARD_HOME, { yaw: 0.45 }));
      }
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
