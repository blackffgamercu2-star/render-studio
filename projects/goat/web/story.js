// Shot plan for "The Shepherd Who Sold the Same Goat Twice" (batch-5 topic 2, EN) —
// timed to the ACTUAL voice stem (63.81 s, 30 fps, TOTAL 1915), clause
// timings from faster-whisper alignment (base model, 19 clauses):
// C1 0-126 hook "sold the same goat twice" | C2 138-273 sale 1: white goat,
// 50 coins | C3 286-397 tied outside the inn, dinner | C4 415-504 night:
// crept back, untied, led home | C5 519-572 "something no one expected" |
// C6 585-696 dye pot: white goat dyed black head to tail | C7 711-787
// morning: a different animal | C8 787-904 sunrise market, black goat |
// C9 917-1017 merchant buys black goat, 50 coins | C10 1033-1135 "beautiful
// black goat" | C11 1147-1262 led to the river, water ran over | C12
// 1268-1383 black came off in clouds, white goat blinking | C13 1396-1478
// merchant stormed back shouting | C14 1491-1522 shepherd only smiled |
// C15 1535-1579 "You bought a white goat and a black goat" | C16 1587-1672
// "No refunds on washed goats" | C17 1692-1765 "sold something you can't
// even touch" | C18 1773-1836 "sold a rich merchant his own echo" | C19
// 1852-1900 "How do you sell a voice that isn't yours?"
// QUALITY RULES: shots change ONLY at clause boundaries; camera TRACKS the
// voice-named subject every beat (biggest/centred), never freezes, never
// drifts; characters act in place — travel only across shot cuts; costumes
// by role (shepherd = worn simple clothes + cap, merchant = rich robe +
// gold sash + top hat, townsfolk plain).
// PHYSICS RULES (owner, 2026-11-15, TOP priority): every prop rests flush
// ON its surface with contact shadow (coin pouch + coin stacks ON the stall
// table, dye pot ON the yard ground, hay bale ON the ground, goat's four
// feet ON the ground at all times, goat tied to the post by a rope drawn
// from its neck to the post side); the merchant's coin is drawn AT his
// hand (bodyFront 'coin' prop); the dye washes off ONLY while the washing
// is spoken (f1268-1383: coat lerps black->white, dye clouds shrink and
// fade, splash bursts at the goat's feet); nothing falls/drifts/hangs;
// the goat never glides — it stands planted and moves only across cuts.
// World: THREE areas in one stage — market+inn x=-17, shepherd's yard x=0,
// river x=+17; back walls z=-3.45 (market/yard), open bank at the river.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';

export const FPS = 30, TOTAL = 1915, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 137, light: 'day' },
  { id: 'sale1', a: 138, b: 285, light: 'day' },
  { id: 'inn', a: 286, b: 414, light: 'lamp' },
  { id: 'night', a: 415, b: 518, light: 'night' },
  { id: 'dye', a: 519, b: 710, light: 'night' },
  { id: 'morning', a: 711, b: 786, light: 'dawn' },
  { id: 'sale2', a: 787, b: 1032, light: 'day' },
  { id: 'praise', a: 1033, b: 1146, light: 'day' },
  { id: 'river', a: 1147, b: 1395, light: 'day' },
  { id: 'storm', a: 1396, b: 1490, light: 'day' },
  { id: 'smile', a: 1491, b: 1586, light: 'day' },
  { id: 'punch', a: 1587, b: 1691, light: 'day' },
  { id: 'hook2', a: 1692, b: 1914, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#1d4a66', waterShal: '#3d84a8', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  lamp: { az: 70, el: 34, sky: '#8a6a4c', ground: '#3c2c1e', hemi: 0.95, sun: '#ffc37a', sunI: 2.0, fog: '#caa27a', fogNear: 30, fogFar: 210,
    skyTop: '#3c3a55', skyHor: '#caa27a', sunDisc: '#ffe9c0', sunSize: 0.0026, sat: 1.05, vig: 0.3, shadowExt: 14, aurora: 0, gain: '#ffe2b8', ...WATER },
  night: { az: 210, el: 38, sky: '#2c3550', ground: '#1c1a26', hemi: 0.78, sun: '#9fb4e8', sunI: 1.1, fog: '#2a2f45', fogNear: 26, fogFar: 200,
    skyTop: '#141a30', skyHor: '#3a3a58', sunDisc: '#e8ecff', sunSize: 0.0022, sat: 1.0, vig: 0.34, shadowExt: 12, aurora: 0, gain: '#c9cfe8', ...WATER },
  dawn: { az: 95, el: 30, sky: '#c9a58e', ground: '#5a4a3c', hemi: 1.05, sun: '#ffb37a', sunI: 2.0, fog: '#e0c2a8', fogNear: 34, fogFar: 260,
    skyTop: '#7a90c0', skyHor: '#f2c9a0', sunDisc: '#ffe9c0', sunSize: 0.0032, sat: 1.05, vig: 0.24, shadowExt: 15, aurora: 0, gain: '#ffe8d0', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
// MARKET (x=-17): stall table + inn door + hitching post.
export const STALL = [-14.2, 0, -1.6];          // stall table (top y 0.95)
export const POST = [-19.6, 0, -0.9];           // hitching post outside the inn
export const GOAT_MKT = [-15.0, 0, 0.3];       // goat sale spot
export const SHEP_MKT = [-16.1, 0, 0.9];       // shepherd stands close in, facing the merchant across the goat
export const MERCH_MKT = [-14.0, 0, 0.5];
export const GOAT_TIED = [-18.7, 0, -0.7];     // goat tied to the post
export const MERCH_INN = [-20.4, 0, -0.5];     // merchant at the inn door
// YARD (x=0): hut + dye pot + hay.
export const DYE_POT = [-0.9, 0, -0.9];         // dye pot sits ON the ground
export const GOAT_YARD = [-0.9, 0, 0.35];
export const SHEP_YARD = [-1.7, 0, 0.55];
export const MERCH_YARD = [1.3, 0, 0.6];
export const SHEP_HOOK2 = [2.6, 0, 1.1];     // final tease: shepherd steps front-right, grinning at the merchant
// RIVER (x=+17): bank z<0, water z 0..8.
export const GOAT_RIVER = [17.6, 0, 0.9];      // goat standing at the water's edge
export const MERCH_RIVER = [15.9, 0, -0.3];
export const CROWD_MKT = [[-12.4, 0, -2.0], [-21.2, 0, -1.6]];

/** Coat blackness: 0 = white, 1 = black. Dyeing f600-696 (C6), washing
 *  off f1268-1383 (C12) — exactly while the voice speaks those actions. */
export const blackKAt = (f) => {
  if (f < 600) return 0;
  if (f < 696) return (f - 600) / 96;
  if (f < 1268) return 1;
  if (f < 1383) return 1 - (f - 1268) / 115;
  return 0;
};
/** Dye-cloud strength during the wash (1 at wash start, 0 when clean). */
export const washCloudAt = (f) => (f >= 1268 && f <= 1383 ? 1 - (f - 1268) / 115 : 0);
/** Is the goat tied to the post? Rope drawn until the shepherd unties it. */
export const tiedAt = (f) => f >= 286 && f < 470;

/** Goat position per shot (moves only across cuts — never glides). */
export const goatPosAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'inn' || S.id === 'night') return GOAT_TIED;
  if (S.id === 'dye' || S.id === 'morning') return GOAT_YARD;
  if (S.id === 'river') return GOAT_RIVER;
  if (S.id === 'storm' || S.id === 'smile' || S.id === 'punch' || S.id === 'hook2') return GOAT_YARD;
  return GOAT_MKT;
};

const HERO = {
  hook: () => [-16.2, 1.4, -0.6],
  sale1: (f) => (f < 230 ? [-15.0, 1.0, 0.3] : [-15.9, 1.1, 0.8]),
  inn: () => [-18.7, 1.0, -0.7],
  night: (f) => (f < 470 ? [-18.7, 1.0, -0.7] : [-19.6, 1.2, -0.8]),
  dye: (f) => (f < 600 ? [-0.9, 1.0, -0.9] : [-0.9, 1.0, 0.35]),
  morning: () => [-0.9, 1.0, 0.35],
  sale2: (f) => (f < 917 ? [-15.0, 1.0, 0.3] : [-14.2, 1.1, 0.5]),
  praise: () => [-14.4, 1.1, 0.4],
  river: (f) => (f < 1268 ? [17.6, 1.0, 0.9] : [17.6, 1.0, 0.9]),
  storm: () => [1.3, 1.2, 0.6],
  smile: () => [-1.7, 1.2, 0.55],
  punch: () => [-0.9, 1.0, 0.35],
  hook2: (f) => (f < 1852 ? [-0.9, 1.0, 0.35] : [0, 4.9, -3.05]),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Scene changes cut AT clause boundaries; inside a shot the camera surges
// TO the clause subject at each clause boundary and settles into a slow
// push-in. Boards fade in only AFTER the camera has settled (see worldAt).
const CAMS = {
  hook: [
    { f: 0, pos: [-11.4, 3.5, 10.6], look: [-16.6, 1.9, -1.6], fov: 47 },
    { f: 60, pos: [-12.6, 3.0, 8.2], look: [-16.4, 1.7, -1.0], fov: 44, ease: 'surge' },
    { f: 126, pos: [-13.2, 2.9, 7.6], look: [-16.2, 1.6, -0.7], fov: 43, ease: 'surge' },
    { f: 137, pos: [-13.3, 2.88, 7.5], look: [-16.2, 1.6, -0.7], fov: 43 },
  ],
  sale1: [
    { f: 138, pos: [-12.2, 2.7, 8.0], look: [-15.05, 1.25, 0.5], fov: 44 },
    { f: 203, pos: [-12.6, 2.5, 7.4], look: [-15.05, 1.15, 0.5], fov: 43, ease: 'surge' },
    { f: 230, pos: [-12.9, 2.4, 7.0], look: [-15.05, 1.1, 0.5], fov: 43, ease: 'surge' },
    { f: 285, pos: [-12.95, 2.38, 6.95], look: [-15.05, 1.1, 0.5], fov: 43 },
  ],
  inn: [
    { f: 286, pos: [-13.6, 2.9, 6.6], look: [-19.0, 1.5, -0.9], fov: 45 },
    { f: 340, pos: [-14.8, 2.4, 5.4], look: [-18.9, 1.2, -0.85], fov: 42, ease: 'surge' },
    { f: 397, pos: [-15.2, 2.3, 5.1], look: [-18.8, 1.1, -0.8], fov: 41, ease: 'surge' },
    { f: 414, pos: [-15.25, 2.28, 5.05], look: [-18.8, 1.1, -0.8], fov: 41 },
  ],
  night: [
    { f: 415, pos: [-13.8, 2.8, 6.4], look: [-18.9, 1.4, -0.9], fov: 44 },
    { f: 460, pos: [-15.0, 2.4, 5.4], look: [-19.0, 1.2, -0.85], fov: 42, ease: 'surge' },
    { f: 504, pos: [-15.4, 2.3, 5.1], look: [-19.1, 1.15, -0.85], fov: 41, ease: 'surge' },
    { f: 518, pos: [-15.45, 2.28, 5.05], look: [-19.1, 1.15, -0.85], fov: 41 },
  ],
  dye: [
    { f: 519, pos: [5.6, 2.9, 7.4], look: [-1.3, 1.3, -0.3], fov: 45 },
    { f: 585, pos: [3.6, 2.3, 5.8], look: [-1.35, 1.1, -0.1], fov: 42, ease: 'surge' },
    { f: 640, pos: [3.0, 2.1, 5.6], look: [-1.35, 1.05, 0.0], fov: 42, ease: 'surge' },
    { f: 710, pos: [2.95, 2.08, 5.55], look: [-1.35, 1.05, 0.0], fov: 42 },
  ],
  morning: [
    { f: 711, pos: [5.0, 2.7, 7.0], look: [-1.3, 1.35, 0.2], fov: 44 },
    { f: 750, pos: [3.8, 2.2, 5.8], look: [-1.3, 1.15, 0.3], fov: 42, ease: 'surge' },
    { f: 786, pos: [3.75, 2.18, 5.75], look: [-1.3, 1.15, 0.3], fov: 42 },
  ],
  sale2: [
    { f: 787, pos: [-12.2, 2.7, 8.0], look: [-15.05, 1.25, 0.5], fov: 44 },
    { f: 850, pos: [-12.6, 2.5, 7.4], look: [-15.05, 1.15, 0.5], fov: 43, ease: 'surge' },
    { f: 917, pos: [-12.9, 2.4, 7.0], look: [-15.05, 1.1, 0.4], fov: 43, ease: 'surge' },
    { f: 980, pos: [-13.1, 2.35, 6.8], look: [-15.05, 1.05, 0.4], fov: 43, ease: 'surge' },
    { f: 1032, pos: [-13.15, 2.33, 6.75], look: [-15.05, 1.05, 0.4], fov: 43 },
  ],
  praise: [
    { f: 1033, pos: [-12.2, 2.5, 6.2], look: [-14.9, 1.2, 0.35], fov: 43 },
    { f: 1080, pos: [-12.9, 2.2, 5.2], look: [-14.9, 1.1, 0.35], fov: 41, ease: 'surge' },
    { f: 1146, pos: [-13.0, 2.18, 5.15], look: [-14.9, 1.1, 0.35], fov: 41 },
  ],
  river: [
    { f: 1147, pos: [11.8, 3.0, 8.2], look: [16.6, 1.3, 0.4], fov: 45 },
    { f: 1200, pos: [12.6, 2.6, 7.2], look: [16.7, 1.15, 0.5], fov: 44, ease: 'surge' },
    { f: 1268, pos: [13.0, 2.5, 6.8], look: [16.75, 1.1, 0.6], fov: 43, ease: 'surge' },
    { f: 1330, pos: [13.2, 2.4, 6.6], look: [16.75, 1.05, 0.65], fov: 43, ease: 'surge' },
    { f: 1395, pos: [13.25, 2.38, 6.55], look: [16.75, 1.05, 0.65], fov: 43 },
  ],
  storm: [
    { f: 1396, pos: [5.6, 2.8, 8.0], look: [-0.2, 1.3, 0.4], fov: 45 },
    { f: 1440, pos: [4.6, 2.4, 6.8], look: [-0.2, 1.2, 0.45], fov: 44, ease: 'surge' },
    { f: 1490, pos: [4.55, 2.38, 6.75], look: [-0.2, 1.2, 0.45], fov: 44 },
  ],
  smile: [
    { f: 1491, pos: [4.8, 2.5, 6.4], look: [-1.2, 1.3, 0.4], fov: 43 },
    { f: 1535, pos: [3.6, 2.2, 5.3], look: [-1.6, 1.2, 0.45], fov: 41, ease: 'surge' },
    { f: 1586, pos: [3.55, 2.18, 5.25], look: [-1.6, 1.2, 0.45], fov: 41 },
  ],
  punch: [
    { f: 1587, pos: [2.6, 3.1, 9.2], look: [0, 2.7, -2.0], fov: 44 },
    { f: 1630, pos: [2.2, 3.05, 9.4], look: [0, 2.7, -2.0], fov: 44, ease: 'surge' },
    { f: 1691, pos: [2.15, 3.03, 9.35], look: [0, 2.7, -2.0], fov: 44 },
  ],
  hook2: [
    { f: 1692, pos: [5.0, 3.0, 8.6], look: [0, 2.6, -1.8], fov: 44 },
    { f: 1773, pos: [5.2, 3.1, 9.0], look: [0, 2.9, -2.2], fov: 44, ease: 'surge' },
    { f: 1852, pos: [5.6, 3.2, 9.8], look: [0, 3.3, -2.6], fov: 45, ease: 'surge' },
    { f: 1914, pos: [5.8, 3.25, 10.0], look: [0, 3.35, -2.65], fov: 45 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['praise', 'river', 'morning', 'smile'].includes(S.id)) cinf = 3.4;
  if (S.id === 'hook2' && f >= 1852) cinf = 2.5;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardPayoff: 0, boardHook: 0, washK: 0 };
  if (S.id === 'hook') W.boardTitle = 1 - smooth(ramp(f, 20, 40));
  if (S.id === 'punch') W.boardPayoff = smooth(ramp(f, 1600, 1625)) * (1 - smooth(ramp(f, 1675, 1691)));
  if (S.id === 'hook2') W.boardHook = smooth(ramp(f, 1852, 1880));
  if (S.id === 'river' && f >= 1268 && f <= 1383) W.washK = smooth(ramp(f, 1268, 1290)) * (1 - smooth(ramp(f, 1360, 1383)));
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  if (S.light === 'night') return { smokeRate: 0.05, dustRate: 0.02, splashRate: 0 };
  if (S.light === 'lamp') return { smokeRate: 0.10, dustRate: 0.05, splashRate: 0 };
  if (S.light === 'dawn') return { smokeRate: 0.02, dustRate: 0.10, splashRate: 0 };
  return { smokeRate: 0.0, dustRate: 0.06, splashRate: 0 };
};

// ---------- goat card ----------
// Four-legged goat, Pen/plum style, canvas 600x1000, feet at y=975, faces +x.
// opts: blackK (0 white .. 1 black), tied (rope to the post), wash (0..1
// dye-cloud strength while the river washes the dye off), blink (0/1).
const ellPtsL = (cx, cy, rx, ry, rot = 0, n = 40) => {
  const r = rot * Math.PI / 180, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};
const curveL = (a, k, b, n = 10) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * k[0] + t * t * b[0], u * u * a[1] + 2 * u * t * k[1] + t * t * b[1]]);
  }
  return pts;
};
export const goatCard = (p, o = {}, T) => {
  const { blackK = 0, tied = false, wash = 0, blink = 0 } = o;
  const WHITE = '#f6f1e4', BLACK = '#2b2724';
  const coat = T.mix(WHITE, BLACK, blackK);
  const coatSh = T.mul(coat, [0.72, 0.70, 0.74]);
  const coatDk = T.mul(coat, [0.58, 0.56, 0.60]);
  const hornC = '#c9a06a', hornDk = '#8a6a3c';
  const light = -2.094, thick = T.thickAngle(light), ow = 5.5;
  const ground = 975;
  // far legs (darker, slight offset back)
  p.stroke([[215, 800], [212, ground - 4]], 15, coatDk);
  p.stroke([[415, 800], [418, ground - 4]], 15, coatDk);
  // tail: short, flicked up
  p.stroke(curveL([128, 700], [92, 650], [84, 586]), 15, coat);
  p.dot(82, 582, 9, coatDk);
  // body
  const bp = ellPtsL(300, 742, 188, 94);
  p.shadedFill(bp, coat, coatSh, light, 170, 0.4); p.inkRing(bp, ow, thick);
  // blotches appear as the dye spreads (mid-transition only)
  if (blackK > 0.02 && blackK < 0.98) {
    p.clip(bp, () => {
      const spots = [[230, 700, 66, 46], [330, 770, 72, 44], [400, 710, 56, 40], [180, 770, 48, 36], [300, 700, 58, 38]];
      spots.forEach(([sx, sy, srx, sry], i) => { if (blackK > i / 5) p.ell(sx, sy, srx, sry, BLACK, 0); });
    });
    p.inkRing(bp, ow, thick);
  }
  // near legs — planted, feet flat ON the ground line
  p.stroke([[178, 806], [174, ground - 4]], 18, coat);
  p.stroke([[398, 806], [402, ground - 4]], 18, coat);
  for (const [fx, fy] of [[174, ground - 2], [402, ground - 2], [212, ground - 2], [418, ground - 2]]) {
    p.ell(fx + 7, fy, 15, 7, coatDk, 2.4); // hooves
  }
  // neck + head
  p.stroke(curveL([428, 720], [452, 668], [462, 622]), 34, coat); // neck
  const hp = ellPtsL(478, 612, 62, 55, -0.12);
  p.shadedFill(hp, coat, coatSh, light, 60, 0.35); p.inkRing(hp, ow * 0.8, thick);
  // muzzle
  p.ell(524, 636, 46, 27, coat, ow * 0.7);
  p.dot(556, 630, 10, '#241726'); // nose
  p.stroke([[540, 644], [528, 656]], 3, '#241726'); // mouth line
  // beard tuft under the chin
  p.poly([[498, 662], [522, 660], [512, 692]], coatDk, 2);
  // horns: curved back over the head
  p.line(curveL([448, 566], [420, 516], [396, 522]), hornC, 13);
  p.line(curveL([470, 560], [448, 508], [424, 512]), hornC, 13);
  p.dot(396, 522, 5, hornDk); p.dot(424, 512, 5, hornDk);
  // ear
  p.ell(436, 592, 26, 14, coatDk, ow * 0.6, 0, 360, -0.5);
  // eye (blinks shut)
  if (blink) p.stroke([[486, 600], [512, 600]], 5, '#241726');
  else { p.dot(499, 598, 8, '#241726'); p.dot(502, 595, 2.8, '#ffffff'); }
  // rope to the hitching post (post stands to the goat's left in-world):
  // drapes DOWN from the neck, runs along the ground to the post side.
  if (tied) {
    p.stroke(curveL([452, 668], [420, 790], [330, 905]), 7, '#8a6a3c');
    p.stroke([[330, 905], [200, 922], [52, 888]], 7, '#8a6a3c');
    p.dot(452, 668, 9, '#6d5136');
  }
  // river wash: white splash arcs at the feet + dark dye clouds drifting off
  if (wash > 0) {
    p.arc(180, 962, 46, 20, -180, 0, 6, '#e8f4f8');
    p.arc(400, 962, 52, 22, -180, 0, 6, '#e8f4f8');
    const a = (0.55 * wash).toFixed(2);
    p.ell(250, 700, 70 * wash + 20, 44 * wash + 12, `rgba(30,28,26,${a})`, 0);
    p.ell(360, 780, 60 * wash + 16, 40 * wash + 10, `rgba(30,28,26,${a})`, 0);
    p.ell(320, 640, 46 * wash + 12, 30 * wash + 8, `rgba(30,28,26,${a})`, 0);
  }
};

// ---------- actors ----------
// COSTUMES BY ROLE — shepherd: worn earthy tunic + cap (simple, poor);
// merchant: rich purple robe + gold sash + top hat; townsfolk: plain.
export const SHEPHERD = { jacket: '#7a5c3a', pants: '#4a3b28', boots: '#33261a', hat: 'cap', cap: '#5a4632', skin: '#e8b08a' };
export const MERCHANT = { jacket: '#5e2a6e', pants: '#2e2a3a', boots: '#241a12', hat: 'tophat', skin: '#f5c9a0', sash: '#c9a227' };
export const CROWD = [
  { jacket: '#4f7fb8', pants: '#3a3f4a', boots: '#2a2118', hat: 'hair', hair: '#5a3b2a', skin: '#f5c9a0' },
  { jacket: '#d9a441', pants: '#5a4632', boots: '#33261a', hat: 'cap', cap: '#7a4a2a', skin: '#e8b08a' },
];
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const crowdAt = (T, f, expr) => CROWD_MKT.map((pos, i) => {
  const opts = { expr: Array.isArray(expr) ? expr[i % expr.length] : expr, mode: 'stand', blink: blinkAt(f, 61 + i * 7), seed: 61 + i * 7 };
  return RW(T, CROWD[i], opts, pos, { tint: '#ffffff', yaw: i % 2 ? -0.22 : 0.22 });
});
const goatAt = (T, f, pos, extra = {}) => {
  const bk = q(blackKAt(f), 2), w = q(washCloudAt(f), 2), td = tiedAt(f);
  const key = `goat${bk}|${td ? 1 : 0}|${w}|${blinkAt(f, 77)}`;
  return {
    key, draw: (p) => goatCard(p, { blackK: bk, tied: td, wash: w, blink: blinkAt(f, 77) }, T),
    x: pos[0], y: pos[1], z: pos[2], ground: 0, s: 0.85, tint: '#ffffff', ...extra,
  };
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = '#ffffff', out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'hook': {
      out.push(st(SHEPHERD, 'grin', 41, SHEP_MKT, { yaw: 0.3 }));
      out.push(goatAt(T, f, GOAT_MKT, { yaw: 0 }));
      out.push(st(MERCHANT, 'neutral', 51, MERCH_MKT, { yaw: -0.3 }));
      out.push(...crowdAt(T, f, 'grin'));
      break;
    }
    case 'sale1': {
      // C2: shepherd shows the white goat; merchant counts out 50 coins
      // (coin drawn AT his hand), then the shepherd holds the coin.
      out.push(RW(T, SHEPHERD, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...(f >= 230 ? { prop: ['coin', 0.55] } : {}) }, SHEP_MKT, { tint, yaw: 0.3 }));
      out.push(goatAt(T, f, GOAT_MKT, { yaw: 0 }));
      out.push(RW(T, MERCHANT, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...(f < 230 ? { prop: ['coin', 0.55] } : { prop: ['point', 0.85] }) }, MERCH_MKT, { tint, yaw: -0.3 }));
      out.push(...crowdAt(T, f, 'grin'));
      break;
    }
    case 'inn': {
      // C3: merchant ties the goat to the post (rope drawn in the goat
      // card) and turns to the inn door for dinner.
      out.push(st(MERCHANT, 'grin', 51, MERCH_INN, { yaw: -0.5 }));
      out.push(goatAt(T, f, GOAT_TIED, { yaw: 0.15 }));
      break;
    }
    case 'night': {
      // C4: the shepherd creeps back at night, crouches at the post and
      // unties the rope (rope gone from f470); the goat stays planted.
      const crouch = f < 460 ? { tilt: 8, headTilt: 12 } : { tilt: 3, headTilt: 5 };
      out.push(RW(T, SHEPHERD, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...crouch, ...(f >= 430 ? { prop: ['push', q(0.3 + 0.2 * Math.sin(f * 0.3), 2)] } : {}) }, [-19.9, 0, -0.1], { tint, yaw: 0.5 }));
      out.push(goatAt(T, f, GOAT_TIED, { yaw: 0.15 }));
      break;
    }
    case 'dye': {
      // C5-C6: "something no one expected" — the shepherd dips his hand
      // in the dye pot (pot sits ON the ground at DYE_POT) and dyes the
      // goat black, head to tail (coat lerps with blackKAt).
      const dyeK = q(0.3 + 0.25 * Math.sin(f * 0.28) + 0.15 * smooth(ramp(f, 585, 620)), 2);
      out.push(RW(T, SHEPHERD, { expr: f < 585 ? 'neutral' : 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['push', dyeK] }, SHEP_YARD, { tint, yaw: 0.4 }));
      out.push(goatAt(T, f, GOAT_YARD, { yaw: -0.1 }));
      break;
    }
    case 'morning': {
      // C7: by morning the goat is black — a different animal.
      out.push(st(SHEPHERD, 'grin', 41, SHEP_YARD, { yaw: 0.4 }));
      out.push(goatAt(T, f, GOAT_YARD, { yaw: -0.1 }));
      break;
    }
    case 'sale2': {
      // C8-C9: sunrise market, the black goat; the merchant loves it and
      // buys it for fifty silver coins (coin AT his hand, then shepherd's).
      out.push(RW(T, SHEPHERD, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...(f >= 980 ? { prop: ['coin', 0.55] } : {}) }, SHEP_MKT, { tint, yaw: 0.3 }));
      out.push(goatAt(T, f, GOAT_MKT, { yaw: 0 }));
      const mo = f < 917 ? { expr: 'neutral' } : f < 950 ? { expr: 'nervous', headTilt: 6 } : { expr: 'grin', prop: f < 980 ? ['coin', 0.55] : ['point', 0.85] };
      out.push(RW(T, MERCHANT, { mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...mo }, MERCH_MKT, { tint, yaw: -0.3 }));
      out.push(...crowdAt(T, f, 'grin'));
      break;
    }
    case 'praise': {
      // C10: "A beautiful black goat" — the merchant beams and points.
      out.push(st(SHEPHERD, 'grin', 41, SHEP_MKT, { yaw: 0.3 }));
      out.push(goatAt(T, f, GOAT_MKT, { yaw: 0 }));
      out.push(RW(T, MERCHANT, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.85] }, MERCH_MKT, { tint, yaw: -0.3 }));
      break;
    }
    case 'river': {
      // C11-C12: the merchant leads the goat to the river and washes it;
      // the black comes off in clouds (coat lerps back to white, dye
      // clouds + splash bursts) and the white goat stands blinking.
      const lead = f < 1268 ? { prop: ['point', 0.7] } : {};
      out.push(RW(T, MERCHANT, { expr: f < 1268 ? 'neutral' : 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...lead }, MERCH_RIVER, { tint, yaw: 0.35 }));
      out.push(goatAt(T, f, GOAT_RIVER, { yaw: 0.1 }));
      break;
    }
    case 'storm': {
      // C13: the merchant storms back, shouting for his money — one arm
      // thrown up (bodyFront 'wave'), shock face.
      out.push(RW(T, MERCHANT, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51, wave: 1 }, MERCH_YARD, { tint, yaw: -0.4 }));
      out.push(st(SHEPHERD, 'neutral', 41, SHEP_YARD, { yaw: 0.4 }));
      out.push(goatAt(T, f, GOAT_YARD, { yaw: -0.1 }));
      break;
    }
    case 'smile': {
      // C14-C15: the shepherd only smiles. "You bought a white goat and
      // a black goat."
      out.push(st(SHEPHERD, 'grin', 41, SHEP_YARD, { yaw: 0.4 }));
      out.push(RW(T, MERCHANT, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt: 5 }, MERCH_YARD, { tint, yaw: -0.4 }));
      out.push(goatAt(T, f, GOAT_YARD, { yaw: -0.1 }));
      break;
    }
    case 'punch': {
      // C16: "No refunds on washed goats." — payoff board up.
      out.push(st(SHEPHERD, 'grin', 41, SHEP_YARD, { yaw: 0.4 }));
      out.push(RW(T, MERCHANT, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, MERCH_YARD, { tint, yaw: -0.4 }));
      out.push(goatAt(T, f, GOAT_YARD, { yaw: -0.1 }));
      break;
    }
    case 'hook2': {
      // C17-C19: the tease — a man sold a rich merchant his own echo.
      // The shepherd steps front-right (in frame with the merchant and
      // the white goat) so the voice-named "one man" is on screen.
      out.push(st(SHEPHERD, 'grin', 41, SHEP_HOOK2, { yaw: -0.3 }));
      out.push(st(MERCHANT, 'neutral', 51, MERCH_YARD, { yaw: -0.4 }));
      out.push(goatAt(T, f, GOAT_YARD, { yaw: -0.1 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  // No card FX: the wash is sold by the goat card's own foot-splash arcs
  // + dye clouds (goatCard, wash>0) and the 3D Splashes bursts in main.js.
  // (T.fxSplash draws a full-card wave — far too big for the goat's feet.)
  return [];
};
