// Shot plan for "The Grain That Ate the Kingdom" (batch-4 topic 4, EN) —
// timed to the ACTUAL voice stem (66.25 s, 30 fps, TOTAL 1988), clause
// timings from faster-whisper alignment (match_ratio 0.955, 221/221 tokens):
// C01 0-143 hook | C02 157-177 bowed | C03 185-303 the ask (square 1) |
// C04 313-359 two/four | C05 370-446 double every square |
// C06 461-593 king laughed, bring the chessboard | C07 606-716 first row
// counted (One f680, two f689, four f706, eight f712) |
// C08 731-803 square 20, sacks empty | C09 818-922 square 30, treasurer
// shaking, cart | C10 937-1075 square 40, granaries bare |
// C11 1093-1154 mathematician whispered | C12 1175-1296 more than kingdom |
// C13 1312-1348 more than the whole world | C14 1367-1423 stared at grain |
// C15 1440-1463 bowed low | C16 1480-1558 small thing doubled |
// C17 1573-1689 bag of gold | C18 1712-1811 gardener order |
// C19 1817-1908 rope of sand | C20 1925-1976 how do you tie sand?
// QUALITY RULES: shots change ONLY at clause boundaries; camera TRACKS the
// voice-named subject (never frozen, never aimless drift); characters act in
// place (planted feet, no walk-glide); costumes by role. PHYSICS (2026-11-15):
// the chessboard sits FLUSH on the table, grains/piles land ON their squares
// and stay, sacks sit with weight (sag + contact shadow), the gold bag moves
// hand-to-hand and dips as the farmer takes its weight.
// World: palace court x=0 (facade z=-3.2, throne z=-2.2, table [0.55,0,0.5]),
// granary yard x=+16 (granary front z=-4.4, cart x=13).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1988, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 156, light: 'day' },
  { id: 'ask', a: 157, b: 460, light: 'day' },
  { id: 'laugh', a: 461, b: 605, light: 'day' },
  { id: 'row1', a: 606, b: 730, light: 'day' },
  { id: 'sq20', a: 731, b: 817, light: 'day' },
  { id: 'sq30', a: 818, b: 936, light: 'day' },
  { id: 'sq40', a: 937, b: 1092, light: 'day' },
  { id: 'whisper', a: 1093, b: 1366, light: 'day' },
  { id: 'stare', a: 1367, b: 1439, light: 'day' },
  { id: 'farmerline', a: 1440, b: 1572, light: 'day' },
  { id: 'gold', a: 1573, b: 1711, light: 'day' },
  { id: 'hook2', a: 1712, b: 1987, light: 'day' },
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
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
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
  if (S.id === 'hook2') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 1817, 1987)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const THRONE = [0, 0, -2.2];
export const FARM = [-1.05, 0, 0.75];
export const KINGFRONT = [0.35, 0, -0.9];
export const TR = [2.35, 0, -0.2];
export const MATH = [-2.6, 0, -0.9];
export const SV1 = [2.25, 0, 2.0];
export const SV2 = [3.95, 0, -0.35];
export const GARD = [2.2, 0, 0.9];
export const BOARD = { c: [0.55, 0.5], top: 0.81 };
export const MOUND = [3.1, 0, 2.6];
export const CART = [13.0, 0, 0.4];
export const YTR = [14.8, 0, 1.7];
export const YSV1 = [15.1, 0, -2.1];
export const YSV2 = [13.95, 0, 1.05];
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];
// frames at which squares 1..8 receive their grains/piles (voice-synced)
export const SQF = [282, 318, 346, 712, 717, 721, 725, 729];

const HERO = {
  hook: () => [-1.05, 1.0, 0.75],
  ask: (f) => f < 300 ? [-1.05, 1.0, 0.75] : [0.55, 0.85, 0.5],
  laugh: () => [0, 1.3, -1.55],
  row1: () => [0.55, 0.82, 1.0],
  sq20: () => [3.1, 0.5, 2.6],
  sq30: () => [14.8, 1.1, 1.7],
  sq40: () => [16, 1.4, -3.6],
  whisper: () => [-2.35, 1.1, -0.4],
  stare: () => [0.1, 0.83, 1.02],
  farmerline: () => [-1.05, 1.0, 0.75],
  gold: () => [-0.2, 0.9, -0.2],
  hook2: (f) => f < 1908 ? [2.2, 1.05, 0.9] : [0.3, 3.4, -3.0],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject.
const CAMS = {
  hook: [
    { f: 0, pos: [8.6, 3.8, 12.6], look: [0, 2.4, -3.0], fov: 46 },
    { f: 55, pos: [5.2, 2.7, 7.2], look: [0, 2.3, -2.9], fov: 43, ease: 'surge' },
    { f: 100, pos: [3.6, 2.1, 5.4], look: [-0.4, 1.3, -1.4], fov: 40, ease: 'surge' },
    { f: 156, pos: [2.6, 1.8, 4.2], look: [-0.6, 1.15, -0.9], fov: 38 },
  ],
  ask: [
    { f: 157, pos: [2.6, 1.8, 4.2], look: [-0.6, 1.15, -0.9], fov: 38 },
    { f: 200, pos: [0.5, 1.55, 3.5], look: [-0.95, 1.02, 0.65], fov: 38, ease: 'surge' },
    { f: 300, pos: [0.3, 2.0, 2.6], look: [0.5, 0.8, 0.5], fov: 36, ease: 'surge' },
    { f: 360, pos: [0.35, 2.2, 2.3], look: [0.45, 0.8, 0.55], fov: 34, ease: 'surge' },
    { f: 446, pos: [2.6, 2.2, 4.1], look: [0.4, 0.9, 0.2], fov: 38, ease: 'surge' },
    { f: 460, pos: [2.5, 2.1, 3.95], look: [0.4, 0.92, 0.2], fov: 38 },
  ],
  laugh: [
    { f: 461, pos: [2.5, 2.1, 3.95], look: [0.4, 0.92, 0.2], fov: 38 },
    { f: 505, pos: [2.2, 1.9, 3.4], look: [0, 1.3, -1.8], fov: 38, ease: 'surge' },
    { f: 605, pos: [2.3, 1.85, 3.5], look: [0.1, 1.25, -1.7], fov: 37 },
  ],
  row1: [
    { f: 606, pos: [2.3, 1.85, 3.5], look: [0.1, 1.25, -1.7], fov: 37 },
    { f: 645, pos: [-0.35, 2.1, 2.2], look: [0.25, 0.8, 0.85], fov: 33, ease: 'surge' },
    { f: 695, pos: [1.15, 2.05, 2.25], look: [0.85, 0.8, 0.9], fov: 33, ease: 'surge' },
    { f: 730, pos: [1.15, 1.5, 2.45], look: [0.6, 0.85, 0.6], fov: 34 },
  ],
  sq20: [
    { f: 731, pos: [1.15, 1.5, 2.45], look: [0.6, 0.85, 0.6], fov: 34 },
    { f: 758, pos: [5.2, 2.3, 5.9], look: [3.0, 0.3, 2.2], fov: 40, ease: 'surge' },
    { f: 817, pos: [4.9, 2.1, 5.6], look: [3.0, 0.35, 2.2], fov: 40 },
  ],
  sq30: [
    { f: 818, pos: [4.9, 2.1, 5.6], look: [3.0, 0.35, 2.2], fov: 40 },
    { f: 872, pos: [10, 2.6, 6.5], look: [14, 1.0, -0.5], fov: 42, ease: 'surge' },
    { f: 936, pos: [11.6, 1.9, 4.6], look: [14.3, 1.0, 0.6], fov: 38 },
  ],
  sq40: [
    { f: 937, pos: [11.6, 1.9, 4.6], look: [14.3, 1.0, 0.6], fov: 38 },
    { f: 990, pos: [10.5, 2.6, 7.5], look: [16, 1.7, -3.9], fov: 42, ease: 'surge' },
    { f: 1092, pos: [11.8, 2.2, 5.6], look: [16, 1.6, -4.0], fov: 40 },
  ],
  whisper: [
    { f: 1093, pos: [11.8, 2.2, 5.6], look: [16, 1.6, -4.0], fov: 40 },
    { f: 1135, pos: [2.5, 2.2, 5.5], look: [-0.6, 1.2, -1.2], fov: 42, ease: 'surge' },
    { f: 1180, pos: [-0.9, 1.8, 5.2], look: [-1.05, 1.05, -1.25], fov: 42, ease: 'surge' },
    { f: 1296, pos: [-0.85, 1.85, 5.3], look: [-1.05, 1.08, -1.25], fov: 41 },
    { f: 1312, pos: [-1.2, 2.2, 7.2], look: [-0.3, 3.1, -3.0], fov: 41, ease: 'surge' },
    { f: 1366, pos: [-1.1, 2.15, 7.0], look: [-0.3, 3.0, -3.0], fov: 40 },
  ],
  stare: [
    { f: 1367, pos: [-1.1, 2.15, 7.0], look: [-0.3, 3.0, -3.0], fov: 40 },
    { f: 1402, pos: [0.32, 1.35, 1.95], look: [0.03, 0.81, 1.02], fov: 30, ease: 'surge' },
    { f: 1439, pos: [0.28, 1.3, 1.85], look: [0.03, 0.81, 1.02], fov: 30 },
  ],
  farmerline: [
    { f: 1440, pos: [0.28, 1.3, 1.85], look: [0.03, 0.81, 1.02], fov: 30 },
    { f: 1475, pos: [0.6, 1.6, 3.6], look: [-0.9, 1.0, 0.6], fov: 37, ease: 'surge' },
    { f: 1572, pos: [0.7, 1.55, 3.5], look: [-0.85, 1.05, 0.6], fov: 37 },
  ],
  gold: [
    { f: 1573, pos: [0.7, 1.55, 3.5], look: [-0.85, 1.05, 0.6], fov: 37 },
    { f: 1625, pos: [0.2, 1.8, 5.2], look: [-0.55, 0.8, -0.4], fov: 40, ease: 'surge' },
    { f: 1711, pos: [0.1, 1.7, 4.9], look: [-0.5, 0.75, -0.3], fov: 39 },
  ],
  hook2: [
    { f: 1712, pos: [0.1, 1.7, 4.9], look: [-0.5, 0.75, -0.3], fov: 39 },
    { f: 1785, pos: [3.3, 1.9, 4.7], look: [1.3, 1.1, -0.5], fov: 39, ease: 'surge' },
    { f: 1908, pos: [3.7, 2.2, 5.7], look: [0.9, 2.0, -2.3], fov: 41, ease: 'surge' },
    { f: 1987, pos: [3.4, 2.3, 6.3], look: [0.7, 2.5, -2.8], fov: 40 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['row1', 'stare'].includes(S.id)) cinf = 3.2;
  if (S.id === 'gold') cinf = 3.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardBare: 0, boardWorld: 0, boardHook: 0, moundK: 0, pourK: 0, tipK: 0, cartK: 0, boardFill: 0 };
  if (S.id === 'hook') W.boardTitle = 1 - smooth(ramp(f, 58, 78));
  if (f >= 731) W.moundK = smooth(ramp(f, 745, 800));
  if (S.id === 'sq20') {
    W.pourK = smooth(ramp(f, 740, 750)) * (1 - smooth(ramp(f, 794, 804)));
    W.tipK = smooth(ramp(f, 738, 758)) * (1 - smooth(ramp(f, 796, 816)) * 0.4);
  } else if (f > 817) W.tipK = 0.6;
  if (f >= 818) W.cartK = clamp((f - 830) / 18, 0, 5);
  if (f >= 370) W.boardFill = smooth(ramp(f, 400, 446));
  if (S.id === 'sq40') W.boardBare = smooth(ramp(f, 962, 985)) * (1 - smooth(ramp(f, 1062, 1085)));
  if (S.id === 'whisper') W.boardWorld = smooth(ramp(f, 1314, 1332)) * (1 - smooth(ramp(f, 1348, 1366)));
  if (S.id === 'hook2') W.boardHook = smooth(ramp(f, 1927, 1947));   // NO fade-out: holds 1.0 to the last frame
  return W;
};
// The gold bag, hand to hand: king's hand -> midpoint -> farmer's hands,
// then a small dip as the farmer takes the weight. null = not present.
export const bagAt = (f) => {
  if (f < 1573 || f > 1711) return null;
  let p;
  if (f < 1600) p = [0.02, 0.42, -0.5];
  else if (f < 1655) p = lerp3([0.02, 0.42, -0.5], [-0.35, 0.54, -0.1], smooth(ramp(f, 1600, 1655)));
  else if (f < 1690) p = lerp3([-0.35, 0.54, -0.1], [-0.7, 0.42, 0.3], smooth(ramp(f, 1655, 1690)));
  else p = lerp3([-0.7, 0.42, 0.3], [-0.7, 0.34, 0.3], smooth(ramp(f, 1690, 1711)));
  return { p, s: 1.15 };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.3, dustRate: (S.id === 'sq30' || S.id === 'sq40') ? 0.22 : 0.08, splashRate: 0 };
};

// ---------- flying birds (distant palace birds, ambience only) ----------
const circleAt = (f, i, cx, cz, r = 6, h = 9.5) => {
  const a = f * 0.008 + i * 0.9;
  return { p: [cx + r * Math.cos(a), h + Math.sin(f * 0.05 + i) * 0.8, cz + r * Math.sin(a)], yaw: a + Math.PI / 2, flap: f * 0.9 + i * 1.7, s: 1 };
};
export const flyCrowsAt = (f) => {
  const S = shotAt(f);
  const cx = (S.id === 'sq30' || S.id === 'sq40') ? 16 : 0;
  const out = [];
  for (let i = 0; i < 7; i++) out.push(circleAt(f, i, cx, -3, 5, 10));
  return out;
};

// ---------- actors ----------
const TINT = { day: '#ffffff', dusk: '#ffd9a3' };
const tintFor = (S, f) => S.id === 'hook2' && f > 1900 ? TINT.dusk : TINT.day;
// COSTUMES BY ROLE — king: crimson royal robe + gold crown. Farmer: poor
// simple clothes (worn beige + dull cap). Treasurer: teal court robe +
// turban. Mathematician: plum robe, grey hair + grey moustache, PALE skin.
// Servants: plain tunics. Gardener: green work clothes + cap.
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  farmer: { jacket: '#8a6f4d', pants: '#6e5a41', boots: '#4a3a28', hat: 'cap', cap: '#7a6248', skin: '#c98a5a' },
  treasurer: { jacket: '#2e6e5a', pants: '#223d33', boots: '#2e2118', hat: 'turban', skin: '#e8b08a', dress: '#2e6e5a' },
  mathematician: { jacket: '#4a3a5e', pants: '#2e2438', boots: '#241a12', hat: 'hair', hair: '#cfc8bd', moustache: '#cfc8bd', skin: '#eed9bd', dress: '#4a3a5e' },
  servant1: { jacket: '#9a8a72', pants: '#5e4f3a', boots: '#4a3a28', hat: 'cap', cap: '#6e5a41', skin: '#c98a5a' },
  servant2: { jacket: '#8a7a64', pants: '#54482f', boots: '#4a3a28', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  gardener: { jacket: '#5d7048', pants: '#54482f', boots: '#4a3a28', hat: 'cap', cap: '#4a5a38', skin: '#c98a5a' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];
const ptK = (f, a, b, c, d) => q(smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d))), 2);

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const kingSit = (expr, seed = 31, extra = {}) => RW(T, OUTFITS.king, { expr, mode: 'sit', blink: blinkAt(f, seed), seed }, [...THRONE], { tint, yaw: 0, ...extra });
  const guards = (glExpr = 'stern', grExpr = 'stern') => {
    out.push(st(OUTFITS.guardL, glExpr, 61, GLP, { yaw: 0.15 }));
    out.push(st(OUTFITS.guardR, grExpr, 62, GRP, { yaw: -0.15 }));
  };
  const farmerBow = (a, b, c, d, expr = 'neutral', extra = {}) => {
    const k = bowK(f, a, b, c, d);
    return RW(T, OUTFITS.farmer, { expr, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...bowOpts(k) }, BP(FARM, k), { tint, yaw: 0.45, ...extra });
  };
  switch (S.id) {
    case 'hook': {
      out.push(kingSit('stern'));
      out.push(farmerBow(18, 48, 120, 150, 'neutral'));
      out.push(st(OUTFITS.treasurer, 'neutral', 51, TR, { yaw: -0.25 }));
      out.push(st(OUTFITS.mathematician, 'neutral', 52, MATH, { yaw: 0.25 }));
      guards();
      break;
    }
    case 'ask': {
      out.push(kingSit('neutral'));
      if (f < 210) out.push(farmerBow(160, 176, 186, 202, 'neutral'));
      else {
        const pk = ptK(f, 255, 275, 430, 455);
        out.push(RW(T, OUTFITS.farmer, { expr: f < 370 ? 'neutral' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', pk] }, FARM, { tint, yaw: 0.45 }));
      }
      out.push(st(OUTFITS.servant1, 'neutral', 71, [1.95, 0, 1.5], { yaw: -0.5 }));
      out.push(st(OUTFITS.treasurer, 'neutral', 51, TR, { yaw: -0.25 }));
      guards();
      break;
    }
    case 'laugh': {
      const pk = ptK(f, 540, 560, 585, 605);
      out.push(RW(T, OUTFITS.king, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', pk] }, [0, 0, -1.55], { tint, yaw: 0.1 }));
      out.push(st(OUTFITS.farmer, 'smile', 41, FARM, { yaw: 0.45 }));
      out.push(st(OUTFITS.treasurer, 'grin', 51, TR, { yaw: -0.25 }));
      guards('grin', 'grin');
      break;
    }
    case 'row1': {
      out.push(st(OUTFITS.farmer, 'neutral', 41, FARM, { yaw: 0.45 }));
      out.push(RW(T, OUTFITS.servant1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71, headTilt: 6 }, [2.15, 0, 1.55], { tint, yaw: -0.6 }));
      break;
    }
    case 'sq20': {
      const W = worldAt(f);
      out.push(RW(T, OUTFITS.servant1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', q(W.tipK, 2)] }, SV1, { tint, yaw: -0.35 }));
      out.push(st(OUTFITS.servant2, 'neutral', 72, SV2, { yaw: 0.3 }));
      out.push(st(OUTFITS.treasurer, 'nervous', 51, TR, { yaw: -0.25 }));
      break;
    }
    case 'sq30': {
      const shake = q(Math.sin(f * 0.55) * 0.016, 3);
      out.push(RW(T, OUTFITS.treasurer, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, YTR, { tint, yaw: -0.3, roll: shake }));
      const lk = q(0.5 + 0.5 * Math.sin(f * 0.11), 2);
      out.push(RW(T, OUTFITS.servant1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', lk] }, YSV1, { tint, yaw: 0.3 }));
      out.push(RW(T, OUTFITS.servant2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 72), seed: 72, prop: ['point', q(1 - lk, 2)] }, YSV2, { tint, yaw: -0.4 }));
      break;
    }
    case 'sq40': {
      out.push(st(OUTFITS.servant1, 'dazed', 71, [16.9, 0, -2.9], { yaw: -0.3 }));
      out.push(st(OUTFITS.treasurer, 'dazed', 51, YTR, { yaw: -0.3 }));
      break;
    }
    case 'whisper': {
      const lean = smooth(ramp(f, 1150, 1200)) * (1 - smooth(ramp(f, 1300, 1340)));
      const mp = [MATH[0] + lean * 0.8, q(-0.05 * lean, 3), MATH[2] + lean * 0.3];
      out.push(RW(T, OUTFITS.mathematician, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 52), seed: 52, headTilt: q(lean * 10, 1) }, mp, { tint, yaw: 0.55 }));
      out.push(kingSit(f < 1312 ? 'stern' : 'shock'));
      out.push(st(OUTFITS.treasurer, 'nervous', 51, TR, { yaw: -0.25 }));
      break;
    }
    case 'stare': {
      break;   // camera is on the board — the court is out of frame
    }
    case 'farmerline': {
      out.push(kingSit(f < 1480 ? 'neutral' : 'smile'));
      if (f < 1480) out.push(farmerBow(1442, 1452, 1458, 1472, 'neutral'));
      else out.push(st(OUTFITS.farmer, 'smile_closed', 41, FARM, { yaw: 0.45 }));
      break;
    }
    case 'gold': {
      const kp = ptK(f, 1595, 1615, 1695, 1711);
      out.push(RW(T, OUTFITS.king, { expr: f < 1640 ? 'grin' : 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', kp] }, KINGFRONT, { tint, yaw: 0.3 }));
      const dip = q(-0.035 * smooth(ramp(f, 1660, 1690)), 3);
      out.push(RW(T, OUTFITS.farmer, { expr: f < 1655 ? 'nervous' : 'relief', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', kp] }, [FARM[0], dip, FARM[2]], { tint, yaw: 0.6 }));
      out.push(st(OUTFITS.treasurer, 'smile', 51, TR, { yaw: -0.25 }));
      guards();
      break;
    }
    case 'hook2': {
      const pk = ptK(f, 1830, 1855, 1895, 1915);
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', pk] }, KINGFRONT, { tint, yaw: 0.45 }));
      out.push(st(OUTFITS.gardener, f < 1817 ? 'neutral' : (f < 1925 ? 'nervous' : 'dazed'), 81, GARD, { yaw: -0.5 }));
      guards();
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
