// "वो आदमी जिसने गधे को बोलना सिखाने का वादा किया" — Hindi trick batch 3, topic 1.
// Timed DIRECTLY to the Hindi stem (59.29 s, 30 fps, TOTAL 1779) from the
// faster-whisper small (hi) word timings (donkey-hindi-voice/words.json,
// match_ratio 0.604 — Whisper Hindi spelling is rough, timings are clean).
// Every shot starts on a clause boundary; every camera key lands on the word
// that names its subject. Camera Law: the camera TRACKS the voice-named
// subject, holds with a slow push-in, never freezes, never drifts aimlessly.
// Clause map (frames = s*30):
//  L1 hook 0-172: promise 0 | king-agreed 102 | celebrate 136
//  L2 promise 173-305: दरबार-आगे 192 | महाराज 219 | एक-साल-दीजिए 237 | गधा-बोलने-लगेगा 262
//  L3 threat 306-568: सन्नाटा 305 | राजा-झुका 355 | एक-साल 384 | अगर-गधा-बोला 404 |
//    सोने-से-भर 438 | अगर-नहीं-बोला 477 | उँगली-गले 505 | सिर-जाएगा 541
//  L4 home 569-686: सलाम 568 | सोना-लिया 620 | घर-चल-दिया 638 | सीटी 665
//  L5 wife 687-804: बीवी-सफ़ेद 695 | तुम-पागल 743 | गधा-बोल-सकता 774
//  L6 laugh 805-1080: हँस-पड़ा 811 | कुछ-भी 824 | राजा-मर 877 | गधा-मर 908 |
//    या-मैं 931 | अगर-कुछ-न-हुआ 950 | साल-लंबा 1005 | शायद-गधा 1044
//  L7 soldiers 1081-1246: साल-बीत 1089 | सिपाही 1111 | झुककर-कहा 1140 |
//    महाराज-सुनिए 1172 | गधा-पहली-आवाज़ 1200
//  L8 bray 1247-1461: गधा-रेंका 1253 | (bray 1283) | दरबार-हँसा 1304 |
//    राजा-हँसते-रोने 1350 | माफ़-कर-दिया 1393 | एक-साल-और 1430
//  L9 hookpot 1462-1778: अगले-गाँव 1469 | बर्तन-उधार 1493 | वापस-किया 1546 |
//    कसम-खाई 1601 | पड़ोसी-मान-लिया 1674 | सोना-उधार 1711 | फिर-क्या-हुआ 1761
// Set: the royal court (throne before the treasury facade, origin), the poor
// man's hut (village hut x=18.6), the next village hall (east, x=25).
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1779, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 172, light: 'golden' },
  { id: 'promise', a: 173, b: 305, light: 'golden' },
  { id: 'threat', a: 306, b: 568, light: 'golden' },
  { id: 'home', a: 569, b: 686, light: 'golden' },
  { id: 'wife', a: 687, b: 804, light: 'golden' },
  { id: 'laugh', a: 805, b: 1080, light: 'golden' },
  { id: 'soldiers', a: 1081, b: 1246, light: 'golden' },
  { id: 'bray', a: 1247, b: 1461, light: 'golden' },
  { id: 'hookpot', a: 1462, b: 1778, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 100, el: 21, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.14, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
  night: { az: 210, el: 38, sky: '#2c3a55', ground: '#1c221c', hemi: 0.62, sun: '#bcd2ff', sunI: 1.15, fog: '#1a2438', fogNear: 34, fogFar: 260,
    skyTop: '#131f38', skyHor: '#2c3c5c', sunDisc: '#dfe9ff', sunSize: 0.0022, sat: 0.94, vig: 0.32, shadowExt: 16, aurora: 0, gain: '#cfe0ff', ...WATER },
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
  if (S.id === 'hookpot') return blendLight(LIGHTS.golden, LIGHTS.day, smooth(ramp(f, 1462, 1560)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const KING = [0, 0.72, -1.2];           // standing ON the throne seat (seat top y=0.72)
export const MAN_COURT = [1.4, 0, 0.6];
export const DONKEY = [-1.1, 0, 1.2];
export const GUARD_L = [-2.7, 0, -0.55], GUARD_R = [2.7, 0, -0.55];
export const HOME_MAN = [18.2, 0, -2.6], HOME_WIFE = [16.9, 0, -2.8];
export const POT_MAN = [22.5, 0, -1.0], POT_NEIGH = [24.9, 0, -2.3], POT = [23.6, 0, -1.6];

// ---------- the donkey (custom Pen card, side profile; ground y=975) ----------
// Fur with gradient shading + ink outline = volume, not cardboard. Bray lifts
// the head (p.rot around the neck base) and opens the mouth.
const epts = (cx, cy, rx, ry, a0 = 0, a1 = 360, rot = 0, n = 40) => {
  const pts = [], r = rot * Math.PI / 180;
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};
const donkeyCard = (p, o = {}) => {
  const { bray = 0 } = o;
  const light = -2.094, thick = 2.1, ow = 5.5;
  const fur = '#8a7a66', furSh = '#5f5346', furLt = '#a08a70', dark = '#6e5f4c';
  const ground = 975;
  // far legs (darker, planted)
  p.stroke([[212, 800], [206, ground - 4]], 16, dark);
  p.stroke([[414, 800], [420, ground - 4]], 16, dark);
  // tail: up with a flick while braying
  const wag = Math.sin(bray * 9) * 8 * bray;
  p.stroke([[132, 706], [92, 640], [82 + wag, 566]], 15, fur);
  p.dot(82 + wag, 560, 11, dark);
  // body — shaded ellipse = volume
  const bp = epts(300, 755, 178, 90);
  p.shadedFill(bp, fur, furSh, light, 170, 0.4); p.inkRing(bp, ow, thick);
  p.clip(bp, () => { p.ell(300, 792, 118, 52, furLt, 0); p.ell(252, 716, 88, 44, dark, 0); });
  p.inkRing(bp, ow, thick);
  // near legs, planted
  p.stroke([[180, 806], [174, ground - 4]], 18, fur);
  p.stroke([[398, 806], [404, ground - 4]], 18, fur);
  for (const [fx, fy] of [[174, ground - 2], [404, ground - 2], [206, ground - 2], [420, ground - 2]])
    p.ell(fx + 6, fy, 15, 7, '#3a2c1e', 2.4);
  // neck
  p.stroke([[408, 724], [452, 642]], 62, fur);
  p.stroke([[396, 716], [432, 648]], 10, dark); // mane edge
  // ---- head (rotates up with the bray) ----
  p.rot = bray > 0 ? [-0.5 * bray, 400, 700] : null;
  const hp = epts(466, 612, 62, 55);
  p.shadedFill(hp, fur, furSh, light, 60, 0.35); p.inkRing(hp, ow * 0.8, thick);
  // long ears
  p.ell(428, 516, 15, 60, fur, ow * 0.6, 0, 360, -0.12);
  p.ell(462, 502, 15, 64, fur, ow * 0.6, 0, 360, 0.1);
  p.ell(428, 522, 6, 38, dark, 0, 0, 360, -0.12);
  p.ell(462, 508, 6, 40, dark, 0, 0, 360, 0.1);
  // muzzle + nose + eye
  p.ell(516, 638, 48, 30, furLt, ow * 0.7);
  p.dot(556, 630, 10, '#241726');
  p.dot(482, 598, 7, '#241726'); p.dot(484, 595, 2.4, '#ffffff');
  // open mouth while braying
  if (bray > 0.02) p.ell(522, 664, 13 + 9 * bray, 7 + 13 * bray, '#5a1e28', 2);
  p.rot = null;
};

// ---------- hero / cameras ----------
const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return [0, 1.8, -0.8];
    case 'promise': return [MAN_COURT[0], 1.1, MAN_COURT[2]];
    case 'threat': return [0, 2.2, -1.2];
    case 'home': return [HOME_MAN[0], 1.2, HOME_MAN[2]];
    case 'wife': return [HOME_WIFE[0], 1.3, HOME_WIFE[2]];
    case 'laugh': return [HOME_MAN[0], 1.25, HOME_MAN[2]];
    case 'soldiers': return f < 1200 ? [MAN_COURT[0], 1.1, MAN_COURT[2]] : [DONKEY[0], 0.9, DONKEY[2]];
    case 'bray': return f < 1304 ? [DONKEY[0], 0.9, DONKEY[2]] : f < 1393 ? [0, 2.1, -1.2] : [MAN_COURT[0], 1.15, MAN_COURT[2]];
    case 'hookpot': return f < 1674 ? [POT[0], 0.6, POT[2]] : f < 1740 ? [POT_NEIGH[0], 1.25, POT_NEIGH[2]] : [23.6, 1.5, -2.6];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// Camera keys land on clause words; every shot's first key repeats the
// previous shot's last key (continuous flight, no cuts).
const CAMS = {
  hook: [
    { f: 0, pos: [5.8, 2.6, 7.4], look: [-0.5, 1.55, -1.0], fov: 47 },
    { f: 102, pos: [3.8, 2.1, 4.6], look: [0, 2.05, -1.2], fov: 41, ease: 'surge' },
    { f: 136, pos: [3.4, 1.9, 4.2], look: [1.4, 1.15, 0.6], fov: 40, ease: 'surge' },
    { f: 172, pos: [3.1, 1.85, 3.9], look: [1.2, 1.15, 0.6], fov: 39 },
  ],
  promise: [
    { f: 173, pos: [3.1, 1.85, 3.9], look: [1.2, 1.15, 0.6], fov: 39 },
    { f: 192, pos: [3.0, 1.85, 3.6], look: [1.4, 1.1, 0.6], fov: 39, ease: 'surge' },
    { f: 219, pos: [2.6, 1.75, 3.0], look: [1.4, 1.3, 0.6], fov: 36, ease: 'surge' },
    { f: 262, pos: [2.0, 1.7, 3.2], look: [0.1, 1.0, 0.9], fov: 38, ease: 'surge' },
    { f: 305, pos: [2.4, 1.8, 3.4], look: [0.7, 1.15, 0.7], fov: 38 },
  ],
  threat: [
    { f: 306, pos: [2.4, 1.8, 3.4], look: [0.7, 1.15, 0.7], fov: 38 },
    { f: 355, pos: [2.6, 1.9, 3.6], look: [0, 2.1, -1.2], fov: 38, ease: 'surge' },
    { f: 384, pos: [2.0, 1.7, 2.6], look: [0, 2.15, -1.2], fov: 35, ease: 'surge' },
    { f: 404, pos: [1.8, 1.65, 2.4], look: [0, 2.1, -1.2], fov: 34 },
    { f: 477, pos: [1.6, 1.6, 2.2], look: [0, 2.05, -1.2], fov: 34, ease: 'surge' },
    { f: 505, pos: [1.4, 1.55, 2.0], look: [0, 2.0, -1.2], fov: 33, ease: 'surge' },
    { f: 541, pos: [1.5, 1.6, 2.2], look: [0, 2.05, -1.2], fov: 34, ease: 'surge' },
    { f: 568, pos: [1.6, 1.65, 2.4], look: [0, 2.1, -1.2], fov: 35 },
  ],
  home: [
    { f: 569, pos: [1.6, 1.65, 2.4], look: [0, 2.1, -1.2], fov: 35 },
    { f: 620, pos: [22.5, 3.0, 3.0], look: [18.6, 1.4, -3.0], fov: 44, ease: 'surge' },
    { f: 650, pos: [20.0, 2.0, 0.6], look: [18.2, 1.15, -2.6], fov: 39, ease: 'surge' },
    { f: 665, pos: [19.4, 1.85, 0.2], look: [18.2, 1.25, -2.6], fov: 37, ease: 'surge' },
    { f: 686, pos: [19.2, 1.85, 0.4], look: [18.2, 1.25, -2.6], fov: 37 },
  ],
  wife: [
    { f: 687, pos: [19.2, 1.85, 0.4], look: [18.2, 1.25, -2.6], fov: 37 },
    { f: 700, pos: [18.6, 1.9, 0.8], look: [16.9, 1.25, -2.8], fov: 38, ease: 'surge' },
    { f: 743, pos: [17.8, 1.8, 0.4], look: [16.9, 1.35, -2.8], fov: 35, ease: 'surge' },
    { f: 774, pos: [17.4, 1.75, 0.1], look: [16.9, 1.3, -2.8], fov: 34 },
    { f: 804, pos: [17.6, 1.8, 0.3], look: [17.4, 1.25, -2.7], fov: 36 },
  ],
  laugh: [
    { f: 805, pos: [17.6, 1.8, 0.3], look: [17.4, 1.25, -2.7], fov: 36 },
    { f: 830, pos: [19.0, 1.9, 1.0], look: [18.2, 1.2, -2.6], fov: 38, ease: 'surge' },
    { f: 877, pos: [19.4, 1.85, 0.7], look: [18.2, 1.35, -2.6], fov: 37, ease: 'surge' },
    { f: 907, pos: [18.8, 1.85, 1.1], look: [17.9, 1.2, -2.6], fov: 38, ease: 'surge' },
    { f: 931, pos: [19.6, 1.8, 0.5], look: [18.2, 1.3, -2.6], fov: 36, ease: 'surge' },
    { f: 1005, pos: [19.2, 1.85, 0.8], look: [18.2, 1.25, -2.6], fov: 37 },
    { f: 1044, pos: [18.6, 1.8, 0.6], look: [18.2, 1.3, -2.6], fov: 36, ease: 'surge' },
    { f: 1080, pos: [18.8, 1.85, 0.8], look: [18.2, 1.25, -2.6], fov: 37 },
  ],
  soldiers: [
    { f: 1081, pos: [20.4, 1.85, 0.6], look: [19.7, 1.25, -3.1], fov: 37 },
    { f: 1111, pos: [6.0, 2.6, 7.5], look: [0, 1.2, -0.5], fov: 44, ease: 'surge' },
    { f: 1140, pos: [3.6, 2.0, 4.6], look: [1.4, 1.1, 0.6], fov: 40, ease: 'surge' },
    { f: 1172, pos: [2.8, 1.85, 3.8], look: [0.7, 1.3, -0.2], fov: 38, ease: 'surge' },
    { f: 1200, pos: [1.6, 1.7, 3.6], look: [-1.1, 1.0, 1.2], fov: 37, ease: 'surge' },
    { f: 1246, pos: [1.8, 1.75, 3.8], look: [-1.1, 1.0, 1.2], fov: 38 },
  ],
  bray: [
    { f: 1247, pos: [1.8, 1.75, 3.8], look: [-1.1, 1.0, 1.2], fov: 38 },
    { f: 1253, pos: [0.6, 1.6, 4.4], look: [-1.1, 1.0, 1.2], fov: 38, ease: 'surge' },
    { f: 1283, pos: [2.2, 2.1, 6.6], look: [-2.0, 1.0, 0.7], fov: 50, ease: 'surge' }, // widen to hold donkey + ही-हॉ! board together
    { f: 1304, pos: [2.3, 2.1, 6.4], look: [-1.95, 1.05, 0.65], fov: 49 }, // hold while the board fades; swing to the court after it is gone
    { f: 1330, pos: [3.4, 2.1, 5.2], look: [0, 1.3, -0.5], fov: 42, ease: 'surge' },
    { f: 1350, pos: [2.2, 1.8, 3.4], look: [0, 2.1, -1.2], fov: 37, ease: 'surge' },
    { f: 1393, pos: [2.8, 1.9, 4.0], look: [1.4, 1.15, 0.6], fov: 38, ease: 'surge' },
    { f: 1430, pos: [2.4, 1.85, 3.6], look: [0.5, 1.3, -0.2], fov: 38 },
    { f: 1461, pos: [2.6, 1.9, 3.8], look: [0.4, 1.3, -0.3], fov: 39 },
  ],
  hookpot: [
    { f: 1462, pos: [2.6, 1.9, 3.8], look: [0.4, 1.3, -0.3], fov: 39 },
    { f: 1520, pos: [18.0, 2.8, 4.5], look: [23.4, 1.4, -1.8], fov: 44, ease: 'surge' },
    { f: 1546, pos: [20.8, 2.0, 2.2], look: [23.6, 0.6, -1.6], fov: 40, ease: 'surge' },
    { f: 1601, pos: [21.4, 1.9, 1.6], look: [22.5, 1.2, -1.0], fov: 38, ease: 'surge' },
    { f: 1674, pos: [22.6, 1.9, 1.2], look: [24.9, 1.25, -2.3], fov: 38, ease: 'surge' },
    { f: 1711, pos: [21.8, 1.85, 1.4], look: [23.2, 1.1, -1.4], fov: 37, ease: 'surge' },
    { f: 1740, pos: [21.2, 1.7, 1.6], look: [26.5, 1.5, -2.6], fov: 37, ease: 'surge' }, // board sits east of both men, clear of them
    { f: 1778, pos: [21.0, 1.7, 1.8], look: [26.5, 1.5, -2.6], fov: 36 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 5;
  if (S.id === 'threat' || S.id === 'wife') cinf = 4;
  if (S.id === 'bray' && f < 1304) cinf = 4;
  if (S.id === 'hookpot' && f >= 1740) cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTreasury: 0, boardBray: 0, boardHook: 0, gateOpen: 0, lockK: 0, lockRot: 0, bags: 0, coatK: 0, capK: 0, ringK: 0, goldK: 0.15, coinK: 0, cartX: 0 };
  // court name board: only while the wide opening shot holds it fully in frame
  if (S.id === 'hook') W.boardTreasury = 1 - smooth(ramp(f, 22, 32));
  // ही-हॉ! board: up for the bray, gone before the camera swings to the laughing court
  if (S.id === 'bray') W.boardBray = smooth(ramp(f, 1285, 1295)) * (1 - smooth(ramp(f, 1292, 1302)));
  // hook board: rises on "फिर क्या हुआ?" and HOLDS to the final frame (no fade-out)
  if (S.id === 'hookpot') W.boardHook = smooth(ramp(f, 1740, 1758));
  // gold glow inside the court when the king promises it
  if (S.id === 'threat' && f >= 404) W.goldK = 0.5;
  if (S.id === 'bray') W.goldK = 0.3;
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.3, dustRate: S.id === 'hook' || S.id === 'bray' ? 0.5 : 0.12 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3', night: '#aebedd' };
const tintFor = (S, f) => {
  if (S.id === 'hookpot') return hexLerp('#ffd9a3', '#ffffff', smooth(ramp(f, 1462, 1560)));
  return TINT[S.light] || '#ffffff';
};
export const OUTFITS = {
  // ग़रीब आदमी: worn simple clothes (faded kurta, patched)
  poorMan: { jacket: '#7a6a52', pants: '#5a4a38', boots: '#3a2c1e', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  // बीवी: simple sari/dress, plain hair
  wife: { jacket: '#8a5a48', pants: '#6e4a3a', boots: '#4a3a28', hat: 'hair', hair: '#1c1410', skin: '#e8b08a', dress: '#a8445a' },
  // बर्तन उधार लेने वाला: plain villager
  borrower: { jacket: '#5d6a4a', pants: '#4a3a28', boots: '#2e2118', hat: 'hair', hair: '#3b2a20', skin: '#c98a5a' },
  // पड़ोसी: plain villager, different colours
  neighbour: { jacket: '#6a5a7a', pants: '#3a3230', boots: '#2e2118', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  guard: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#b57a4e', belt: true, pagdi: '#a52a24' },
  guard2: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#d9a878', belt: true, pagdi: '#a52a24' },
};
const propPt = (k) => [435.5 + 45.7 * k, 311.7 + 203.6 * k];
const drawFigure = (T, o, opts, extra) => (p) => {
  if (extra.spear) {
    p.stroke([[424, 84], [424, 974]], 7.5, '#6d4a2a');
    p.poly([[424, 26], [411, 90], [437, 90]], '#b9c1c9', 4);
  }
  T.bodyFront(p, o, opts);
  if (extra.ring) {
    const pt = opts.prop ? propPt(opts.prop[1]) : (opts.wave ? [184, 645] : [416, 645]);
    p.ell(pt[0], pt[1], 16, 16, '#d9a441', 5);
    p.ell(pt[0], pt[1], 8.5, 8.5, '#a02318', 3);
  }
  if (extra.pagdi) {
    const cy = extra.pagdi;
    p.ell(300, cy - 2, 105, 49, o.pagdi, 6);
    p.arc(300, cy + 4, 97, 41, 195, 345, 5, '#7c1d18');
    p.arc(300, cy - 14, 99, 44, 200, 340, 4, '#c8453c');
    p.dot(398, cy - 16, 15, o.pagdi);
    p.poly([[398, cy - 30], [424, cy + 26], [392, cy + 20]], o.pagdi, 4);
  }
};
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts) + (extra.ring ? 'R' : '') + (extra.spear ? 'S' : '') + (extra.pagdi || ''),
  draw: drawFigure(T, o, opts, extra),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const manAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.poorMan, { expr, mode: 'stand', blink: blinkAt(f, 72), seed: 72, headTilt: idleTilt(f, 72), ...opts }, pos, { tag: 'man', out: { tint, ...out } });
const wifeAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.wife, { expr, mode: 'stand', blink: blinkAt(f, 75), seed: 75, headTilt: idleTilt(f, 75), ...opts }, pos, { tag: 'wfe', out: { tint, ...out } });
const guardAt = (T, tint, f, which, expr, pos, opts = {}, out = {}) => A(T, which === 1 ? OUTFITS.guard : OUTFITS.guard2, { expr, mode: 'stand', blink: blinkAt(f, which === 1 ? 73 : 74), seed: which === 1 ? 73 : 74, headTilt: idleTilt(f, which === 1 ? 73 : 74), ...opts }, pos, { tag: 'grd' + which, spear: opts.spear !== false, pagdi: which === 1 ? 231 : 222, out: { tint, ...out } });
const kingAt = (T, tint, f, expr, pos, opts = {}, out = {}) => ({
  key: 'king' + JSON.stringify({ expr, ...opts }),
  draw: (p) => T.romanFront(p, 'king', { expr, blink: blinkAt(f, 77), seed: 77, ...opts }),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], tint, ...out,
});
const donkeyAt = (f, tint, pos, bray, out = {}) => ({
  key: 'donkey' + q(bray, 2),
  draw: (p) => donkeyCard(p, { bray }),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], tint, s: 1.25, yaw: 0.15, ...out,
});
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const guards = (lExpr, rExpr, lOpts = {}, rOpts = {}, lOut = {}, rOut = {}, lPos = GUARD_L, rPos = GUARD_R) => {
    out.push(guardAt(T, tint, f, 1, lExpr, lPos, lOpts, { yaw: 0.35, ...lOut }));
    out.push(guardAt(T, tint, f, 2, rExpr, rPos, rOpts, { yaw: -0.35, ...rOut }));
  };
  const king = (expr, opts = {}, outX = {}) => out.push(kingAt(T, tint, f, expr, KING, opts, { yaw: 0, ...outX }));
  const donkey = (bray) => out.push(donkeyAt(f, tint, DONKEY, bray));
  switch (S.id) {
    case 'hook': {
      king(f < 102 ? 'stern' : 'neutral');
      out.push(manAt(T, tint, f, f < 136 ? 'nervous' : 'grin', MAN_COURT, {}, { yaw: -0.2 }));
      donkey(0);
      guards('stern', 'stern');
      break;
    }
    case 'promise': {
      // the poor man steps forward toward the king as the voice names him
      const p = kf3([[173, [1.4, 0, 1.25]], [219, [1.4, 0, 0.6]]], f);
      const marching = f < 219;
      out.push(A(T, OUTFITS.poorMan, { expr: 'nervous', mode: marching ? 'march' : 'stand', phase: q((f * 0.09) % 1, 2), blink: blinkAt(f, 72), seed: 72 }, p, { tag: 'man', out: { tint, yaw: -0.1 } }));
      king('neutral');
      donkey(0);
      guards('stern', 'stern');
      break;
    }
    case 'threat': {
      // the king leans forward, stern throughout — the voice carries the threat
      const lean = q(9 * smooth(ramp(f, 355, 384)), 1);
      king('stern', { headTilt: lean });
      out.push(manAt(T, tint, f, 'nervous', MAN_COURT, { headTilt: q(6, 1) }, { yaw: -0.2 }));
      donkey(0);
      guards('stern', 'stern');
      break;
    }
    case 'home': {
      // home at last: the man whistles, gold coin raised in his hand
      const whistling = f >= 665;
      out.push(manAt(T, tint, f, whistling ? 'whistle' : 'grin', HOME_MAN, whistling ? {} : { prop: ['coin', 0.9] }, { yaw: 0.3 }));
      break;
    }
    case 'wife': {
      out.push(wifeAt(T, tint, f, f < 743 ? 'shock' : 'nervous', HOME_WIFE, { headTilt: q(5, 1) }, { yaw: 0.4 }));
      out.push(manAt(T, tint, f, 'neutral', HOME_MAN, {}, { yaw: -0.3 }));
      break;
    }
    case 'laugh': {
      out.push(manAt(T, tint, f, 'laugh', HOME_MAN, { headTilt: q(-4, 1) }, { yaw: 0.2 }));
      out.push(wifeAt(T, tint, f, f < 950 ? 'nervous' : 'neutral', HOME_WIFE, {}, { yaw: 0.4 }));
      break;
    }
    case 'soldiers': {
      // the soldiers march in from the gate and flank the man; he bows
      const marchIn = (post, seed, target, f0, f1) => {
        if (f < f1) {
          const total = Math.hypot(target[0] - post[0], target[2] - post[2]);
          const dist = smooth(ramp(f, f0, f1)) * total;
          const p = kf3([[f0, post], [f1, target]], f);
          const moving = f > f0 && f < f1;
          return guardAt(T, tint, f, seed, 'stern', p, { mode: moving ? 'march' : 'stand', phase: q((dist / 1.6) % 1, 3), spear: true }, { yaw: -0.4 });
        }
        return guardAt(T, tint, f, seed, 'stern', target, { spear: true }, { yaw: -0.4 });
      };
      out.push(marchIn(GUARD_L, 1, [-3.1, 0, 1.2], 1089, 1132));
      out.push(marchIn(GUARD_R, 2, [2.9, 0, 1.2], 1095, 1138));
      const bow = bowK(f, 1140, 1160, 1172, 1190);
      out.push(A(T, OUTFITS.poorMan, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 72), seed: 72, headTilt: q(16 * bow + idleTilt(f, 72) * (1 - bow), 1) }, MAN_COURT, { tag: 'man', out: { tint, yaw: -0.1 } }));
      king('stern');
      donkey(0);
      break;
    }
    case 'bray': {
      // the donkey rears its head and brays on the pause; the court erupts
      const bray = q(smooth(ramp(f, 1253, 1283)) * (1 - smooth(ramp(f, 1304, 1330))), 2);
      donkey(bray);
      king(f < 1350 ? 'stern' : 'laugh', { headTilt: f >= 1350 ? q(-5, 1) : 0 });
      out.push(manAt(T, tint, f, f < 1393 ? 'nervous' : 'relief', MAN_COURT, f >= 1393 ? { wave: 0.5 } : {}, { yaw: -0.2 }));
      guards(f < 1304 ? 'stern' : 'laugh', f < 1304 ? 'stern' : 'laugh');
      break;
    }
    case 'hookpot': {
      // next village: the borrower swears the pot gave birth; the neighbour listens
      out.push(A(T, OUTFITS.borrower, { expr: f < 1601 ? 'neutral' : f < 1711 ? 'grin' : 'nervous', mode: 'stand', blink: blinkAt(f, 81), seed: 81, ...(f >= 1601 && f < 1674 ? { wave: 0.55 } : {}) }, POT_MAN, { tag: 'brw', out: { tint, yaw: 0.35 } }));
      out.push(A(T, OUTFITS.neighbour, { expr: f < 1674 ? 'neutral' : f < 1711 ? 'grin' : 'nervous', mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: idleTilt(f, 82) }, POT_NEIGH, { tag: 'ngh', out: { tint, yaw: -0.4 } }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 140), x, y, z, blob: false, shadow: false });
  // gold glint as the man raises the coin at home
  if (f >= 620 && f <= 636) burst('gold_' + q((f - 620) / 16, 2), HOME_MAN[0] + 0.5, 1.35, HOME_MAN[2], q((f - 620) / 16, 2));
  // the bray: starburst at the donkey's raised head
  if (f >= 1260 && f <= 1300) burst('bray_' + q((f - 1260) / 40, 2), DONKEY[0] + 0.55, 1.25, DONKEY[2], q((f - 1260) / 40, 2));
  // copper glint on the pot as it is returned
  if (f >= 1546 && f <= 1562) burst('pot_' + q((f - 1546) / 16, 2), POT[0], 0.7, POT[2], q((f - 1546) / 16, 2));
  return out;
};
