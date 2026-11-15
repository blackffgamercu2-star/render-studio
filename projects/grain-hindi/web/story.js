// Shot plan for "एक दाना जिसने राज्य खा लिया" (batch-4 topic 4, HI) —
// timed to the ACTUAL Hindi voice stem (58.531 s, 30 fps, TOTAL 1756).
// Clause timings from faster-whisper ASR (hi) on the stem itself —
// grain-hindi-voice/timing.json (27 clauses C01..C11c, word-start boundaries).
// QUALITY RULES (locked): shots change ONLY at clause boundaries; camera
// TRACKS the voice-named subject every beat (biggest/centred), never freezes,
// never drifts; characters act in place — no walk-glide; costumes by role
// (king = crown + royal robe, farmer = worn poor clothes, treasurer = green
// court robe + turban, mathematician = indigo robe, pale, gardener = worn
// work clothes). PHYSICS (Abid 2026-11-15): the chessboard sits FLUSH on the
// table; grain piles DROP onto their squares (gravity t^2) and rest there;
// sacks sit on floor/cart bed with weight; the gold bag travels hand-to-hand.
// World: palace court x=0 (throne z=-2.2, table+board at [0.8,-1.0]),
// granary x=-16, garden x=+16.
// C01 0-144 hook · C02a-f 145-428 the ask · C03a-c 429-549 the laugh
// C04a-b 550-661 the count · C05 662-729 square 20 · C06a-b 730-837 square 30
// C07 838-983 square 40 · C08a-c 984-1206 the mathematician · C09a 1207-1275
// the stare · C09b-c 1276-1404 the moral · C10a-b 1405-1529 the gold bag
// C11a-c 1530-1755 the sand-rope hook
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1756, DECK = 0;
export const SHOTS = [
  { id: 'hookQ', a: 0, b: 144, light: 'dusk' },
  { id: 'ask', a: 145, b: 428, light: 'day' },
  { id: 'laugh', a: 429, b: 549, light: 'day' },
  { id: 'count', a: 550, b: 661, light: 'day' },
  { id: 'sacks', a: 662, b: 729, light: 'day' },
  { id: 'cart', a: 730, b: 837, light: 'day' },
  { id: 'bare', a: 838, b: 983, light: 'day' },
  { id: 'math', a: 984, b: 1206, light: 'day' },
  { id: 'stare', a: 1207, b: 1275, light: 'day' },
  { id: 'moral', a: 1276, b: 1404, light: 'day' },
  { id: 'gold', a: 1405, b: 1529, light: 'day' },
  { id: 'hook', a: 1530, b: 1755, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const THRONE = [0, 0, -2.2];
export const FARMER = [1.7, 0, -0.3];
export const TABLE = [0.8, 0.88, -1.0];       // chessboard top centre
export const MATH = [-1.35, 0, -0.85];
export const COURT_L = [-2.7, 0, -1.0];
export const COURT_R = [3.0, 0, -1.2];
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];
export const TREAS_GRAN = [-16.8, 0, -2.0];
export const WORK_GRAN = [-14.9, 0, -2.3];
export const TREAS_CART = [-13.9, 0, 2.1];
export const WORK_CART = [-11.5, 0, 2.0];
export const TREAS_BARE = [-16.2, 0, -1.0];
export const GARDENER = [15.2, 0, -0.5];
export const KING_GARDEN = [17.4, 0, -1.8];
export const SAND = [16.4, 0.4, 0.5];

const HERO = {
  hookQ: () => [0.6, 1.3, -1.4],
  ask: () => [1.2, 1.1, -0.6],
  laugh: () => [0, 1.35, -2.2],
  count: () => [0.8, 1.2, -1.4],
  sacks: () => [-16, 1.2, -4.2],
  cart: () => [-12.8, 0.9, 1.2],
  bare: () => [-16, 1.3, -4.3],
  math: () => [-1.35, 1.2, -0.85],
  stare: () => [0.51, 0.89, -1.29],
  moral: () => [1.7, 1.1, -0.3],
  gold: () => [1.1, 1.0, -0.7],
  hook: (f) => f >= 1702 ? [16, 3.3, -3.3] : [15.2, 1.1, -0.5],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Shots change ONLY at clause boundaries; inside a shot a key lands exactly
// on each clause boundary and the camera surges to the clause's subject.
// Cross-location changes (court <-> granary <-> garden) are jump cuts AT the
// clause boundary (batch-3 crows-hindi precedent — no cross-stage flights).
const CAMS = {
  hookQ: [
    { f: 0, pos: [8.6, 3.8, 12.6], look: [0, 1.9, -3.0], fov: 46 },
    { f: 70, pos: [4.6, 2.5, 6.2], look: [0.4, 1.5, -1.6], fov: 42, ease: 'surge' },
    { f: 144, pos: [2.2, 1.9, 3.2], look: [0.8, 1.2, -1.0], fov: 37, ease: 'surge' },
  ],
  ask: [
    { f: 145, pos: [2.2, 1.9, 3.2], look: [0.8, 1.2, -1.0], fov: 37 },
    { f: 183, pos: [2.6, 1.9, 3.4], look: [1.7, 1.1, -0.3], fov: 38, ease: 'surge' },
    { f: 230, pos: [2.2, 2.0, 2.2], look: [0.8, 0.9, -1.0], fov: 38, ease: 'surge' },
    { f: 313, pos: [1.9, 1.9, 1.6], look: [0.8, 0.9, -1.0], fov: 37, ease: 'surge' },
    { f: 361, pos: [1.7, 1.85, 1.3], look: [0.8, 0.9, -1.0], fov: 36, ease: 'surge' },
    { f: 428, pos: [1.8, 1.9, 1.8], look: [0.9, 1.0, -0.9], fov: 37 },
  ],
  laugh: [
    { f: 429, pos: [-2.0, 2.0, 3.4], look: [0.1, 1.3, -2.1], fov: 38 },
    { f: 457, pos: [-2.2, 2.0, 3.8], look: [0.1, 1.32, -2.15], fov: 39, ease: 'surge' },
    { f: 534, pos: [1.9, 1.9, 1.7], look: [0.8, 0.9, -1.0], fov: 37, ease: 'surge' },
    { f: 549, pos: [2.3, 2.5, 3.0], look: [0.9, 2.0, -2.2], fov: 42 },
  ],
  count: [
    { f: 550, pos: [2.3, 2.5, 3.0], look: [0.9, 2.0, -2.2], fov: 42 },
    { f: 590, pos: [2.05, 2.35, 2.3], look: [0.88, 1.95, -2.1], fov: 40, ease: 'surge' },
    { f: 613, pos: [1.45, 1.95, 1.0], look: [0.6, 1.18, -1.35], fov: 37, ease: 'surge' },
    { f: 650, pos: [1.35, 1.9, 0.7], look: [0.58, 1.12, -1.32], fov: 36, ease: 'surge' },
    { f: 661, pos: [1.7, 2.0, 1.4], look: [0.8, 1.25, -1.45], fov: 38 },
  ],
  sacks: [
    { f: 662, pos: [-13.4, 2.7, 4.2], look: [-16, 1.6, -4.0], fov: 44 },
    { f: 696, pos: [-14.2, 2.5, 3.2], look: [-16, 1.45, -4.2], fov: 42, ease: 'surge' },
    { f: 729, pos: [-14.8, 2.4, 2.6], look: [-16, 1.35, -4.2], fov: 41 },
  ],
  cart: [
    { f: 730, pos: [-10.6, 2.2, 4.6], look: [-12.9, 0.9, 0.9], fov: 42 },
    { f: 796, pos: [-11.2, 2.0, 4.0], look: [-13.2, 0.9, 1.2], fov: 40, ease: 'surge' },
    { f: 837, pos: [-11.8, 1.9, 3.4], look: [-13.4, 0.95, 1.3], fov: 39 },
  ],
  bare: [
    { f: 838, pos: [-16, 3.0, 7.2], look: [-16, 1.8, -4.2], fov: 46 },
    { f: 910, pos: [-16, 2.7, 5.4], look: [-16, 1.6, -4.3], fov: 44, ease: 'surge' },
    { f: 983, pos: [-16, 2.5, 4.6], look: [-16, 1.5, -4.3], fov: 43 },
  ],
  math: [
    { f: 984, pos: [3.4, 2.0, 4.4], look: [-0.4, 1.3, -1.6], fov: 40 },
    { f: 1060, pos: [2.9, 1.95, 3.8], look: [-0.7, 1.25, -1.3], fov: 39, ease: 'surge' },
    { f: 1168, pos: [2.6, 1.9, 3.4], look: [-0.5, 1.3, -1.5], fov: 38, ease: 'surge' },
    { f: 1206, pos: [2.5, 1.85, 3.2], look: [-0.4, 1.3, -1.6], fov: 38 },
  ],
  stare: [
    { f: 1207, pos: [1.9, 1.8, 1.6], look: [0.55, 0.95, -1.2], fov: 37 },
    { f: 1240, pos: [1.5, 1.6, 0.8], look: [0.52, 0.9, -1.26], fov: 35, ease: 'surge' },
    { f: 1275, pos: [1.35, 1.55, 0.55], look: [0.51, 0.89, -1.28], fov: 34 },
  ],
  moral: [
    { f: 1276, pos: [2.8, 1.9, 3.6], look: [1.5, 1.1, -0.4], fov: 38 },
    { f: 1313, pos: [2.6, 1.85, 3.2], look: [1.6, 1.1, -0.35], fov: 37, ease: 'surge' },
    { f: 1404, pos: [2.5, 1.8, 3.0], look: [1.6, 1.05, -0.35], fov: 37 },
  ],
  gold: [
    { f: 1405, pos: [2.7, 1.85, 3.4], look: [0.9, 1.05, -0.9], fov: 38 },
    { f: 1435, pos: [2.5, 1.8, 3.0], look: [1.1, 1.0, -0.7], fov: 37, ease: 'surge' },
    { f: 1464, pos: [2.6, 1.85, 3.2], look: [1.2, 1.0, -0.6], fov: 37, ease: 'surge' },
    { f: 1529, pos: [2.7, 1.8, 3.2], look: [1.3, 1.0, -0.55], fov: 37 },
  ],
  hook: [
    { f: 1530, pos: [12.6, 2.4, 5.6], look: [16.2, 1.3, -1.0], fov: 44 },
    { f: 1598, pos: [13.2, 2.2, 4.8], look: [16.3, 1.3, -0.9], fov: 42, ease: 'surge' },
    { f: 1702, pos: [14.4, 2.1, 4.9], look: [15.55, 2.3, -2.3], fov: 42, ease: 'surge' },
    { f: 1755, pos: [14.8, 2.1, 5.1], look: [15.55, 2.5, -2.5], fov: 40, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['count', 'stare', 'gold'].includes(S.id)) cinf = 3.4;
  if (S.id === 'hook' && f >= 1702) cinf = 3.6;
  if (['sacks', 'bare'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
// Piles land on squares 1-8 during C04a (the first row, counted off in
// seconds) and on squares 9-16 during C04b (the spoken count runs over the
// first four while row 2 fills). pileAt[i] = first frame pile i exists.
const PILE_AT = [556, 562, 568, 574, 580, 586, 592, 598, 616, 622, 628, 634, 640, 646, 652, 658];
const SACK_N = 17;
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardCount: 0, boardSacks: 0, boardBare: 0, boardMath: 0, boardHook: 0,
    pileAt: PILE_AT, heapK: 0, spillK: 0, sackFull: [], cartK: 0, doorK: 0, goldPos: [0.28, 0.83, -0.5] };
  if (S.id === 'hookQ') W.boardTitle = 1 - smooth(ramp(f, 60, 78));
  if (S.id === 'count') W.boardCount = smooth(ramp(f, 556, 568)) * (1 - smooth(ramp(f, 584, 596)));
  if (S.id === 'sacks') W.boardSacks = smooth(ramp(f, 668, 680)) * (1 - smooth(ramp(f, 692, 704)));
  if (S.id === 'bare') W.boardBare = smooth(ramp(f, 850, 864)) * (1 - smooth(ramp(f, 972, 983)));
  if (S.id === 'math') W.boardMath = smooth(ramp(f, 1168, 1182)) * (1 - smooth(ramp(f, 1196, 1206)));
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1702, 1728));   // NO fade-out: holds 1.0 to the last frame
  // heaps: court mounds grow as the count outgrows the board (count tail ->
  // sacks), the granary spill heap grows while sacks are emptied for the cart
  W.heapK = smooth(ramp(f, 636, 760));
  W.spillK = smooth(ramp(f, 690, 800));
  // granary sacks empty in stagger: at square 20 (662-729) the front/mid
  // sacks sag to ~0.45; by square 40 (838-983) EVERY sack is flat (~0.18)
  for (let i = 0; i < SACK_N; i++) {
    let full = 1;
    if (f >= 662) full = 1 - 0.55 * smooth(ramp(f, 662 + i * 3, 712 + i * 3));
    if (f >= 838) full = Math.min(full, 1 - 0.82 * smooth(ramp(f, 845 + i * 2, 905 + i * 2)));
    W.sackFull.push(+full.toFixed(3));
  }
  // cart is loaded sack by sack during C06a (730-795), then stays loaded
  if (f >= 730) W.cartK = clamp((f - 730) / 60, 0, 1);
  // granary doors swing open as we arrive at square 20 (the grain is being
  // carried OUT) and stay open — at square 40 the store stands open and bare
  if (f >= 662) W.doorK = smooth(ramp(f, 664, 694));
  // gold bag: rests on the table corner -> king's hand (1412-1432) ->
  // hand-to-hand to the farmer (1432-1458) -> held low at his side (weighted)
  if (f >= 1405) {
    const t1 = smooth(ramp(f, 1412, 1432)), t2 = smooth(ramp(f, 1432, 1458)), t3 = smooth(ramp(f, 1458, 1480));
    let p = lerp3([0.28, 0.83, -0.5], [0.82, 1.04, -1.28], t1);
    p = lerp3(p, [1.36, 0.94, -0.72], t2);
    p = lerp3(p, [1.64, 0.52, -0.3], t3);
    W.goldPos = p.map((v) => +v.toFixed(3));
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const granary = ['sacks', 'cart', 'bare'].includes(S.id);
  return { smokeRate: 0.3, dustRate: granary ? 0.4 : 0.08, splashRate: 0 };
};

// ---------- actors ----------
// COSTUMES BY ROLE — king: crimson royal robe + gold crown + grey moustache,
// stout. Farmer: worn beige/brown poor clothes. Treasurer: deep-green court
// robe + turban. Mathematician: indigo robe + cap, PALE skin (he turns white
// in the story). Worker: worn grey-brown. Gardener: olive work clothes.
// Courtiers: purple/brown court dress. Guards: red uniform + shako.
const TINT = { dusk: '#ffd9a3', day: '#ffffff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  farmer: { jacket: '#a08b6d', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#3a2a1a', skin: '#c98a5a' },
  treasurer: { jacket: '#2e6e4e', pants: '#22344a', boots: '#2e2118', hat: 'turban', skin: '#c98a5a', dress: '#2e6e4e' },
  mathematician: { jacket: '#4a3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#2e2440', skin: '#ecc9a0' },
  worker: { jacket: '#8a7a63', pants: '#5d4c36', boots: '#3d2f1f', hat: 'hair', hair: '#241a12', skin: '#b57a48' },
  gardener: { jacket: '#6e7a3a', pants: '#54492c', boots: '#3d2f1f', hat: 'hair', hair: '#2a2016', skin: '#c98a5a' },
  courtierL: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
  courtierR: { jacket: '#6e4a3a', pants: '#33243d', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const kingSit = (expr, seed = 31, extra = {}) => RW(T, OUTFITS.king, { expr, mode: 'sit', blink: blinkAt(f, seed), seed }, [...THRONE], { tint, yaw: 0, ...extra });
  const guards = (glExpr = 'stern', grExpr = 'stern') => {
    out.push(st(OUTFITS.guardL, glExpr, 61, GLP, { yaw: 0.15 }));
    out.push(st(OUTFITS.guardR, grExpr, 62, GRP, { yaw: -0.15 }));
  };
  switch (S.id) {
    case 'hookQ': {
      out.push(kingSit('stern'));
      out.push(st(OUTFITS.farmer, 'neutral', 41, FARMER, { yaw: -0.45 }));
      out.push(st(OUTFITS.mathematician, 'neutral', 43, MATH, { yaw: 0.3 }));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'neutral', 72, COURT_R, { yaw: -0.2 }));
      guards();
      break;
    }
    case 'ask': {
      out.push(kingSit(f < 230 ? 'neutral' : 'stern'));
      const k = bowK(f, 150, 168, 176, 183);
      out.push(RW(T, OUTFITS.farmer, { expr: f < 183 ? 'neutral' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...bowOpts(k) }, BP(FARMER, k), { tint, yaw: -0.45 }));
      out.push(st(OUTFITS.mathematician, 'neutral', 43, MATH, { yaw: 0.3 }));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_L, { yaw: 0.2 }));
      guards();
      break;
    }
    case 'laugh': {
      const pk = q(smooth(ramp(f, 536, 544)) * (1 - smooth(ramp(f, 545, 549))), 2);
      out.push(RW(T, OUTFITS.king, { expr: 'laugh', mode: 'sit', blink: blinkAt(f, 31), seed: 31, prop: f >= 534 ? ['point', pk] : undefined }, [...THRONE], { tint, yaw: 0 }));
      out.push(st(OUTFITS.farmer, 'grin', 41, FARMER, { yaw: -0.45 }));
      out.push(st(OUTFITS.courtierL, 'laugh', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'grin', 72, COURT_R, { yaw: -0.2 }));
      guards('grin', 'grin');
      break;
    }
    case 'count': {
      out.push(kingSit('stern'));
      out.push(st(OUTFITS.farmer, 'grin', 41, FARMER, { yaw: -0.45 }));
      out.push(st(OUTFITS.mathematician, 'neutral', 43, MATH, { yaw: 0.3 }));
      break;
    }
    case 'sacks': {
      out.push(st(OUTFITS.treasurer, 'nervous', 44, TREAS_GRAN, { yaw: 0.25 }));
      out.push(st(OUTFITS.worker, 'neutral', 45, WORK_GRAN, { yaw: -0.3 }));
      break;
    }
    case 'cart': {
      // the treasurer's hands tremble (whole-card micro-roll) while he speaks
      const tremble = f >= 730 && f <= 800 ? q(0.022 * Math.sin(f * 1.9), 3) : 0;
      out.push(RW(T, OUTFITS.treasurer, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 44), seed: 44 }, TREAS_CART, { tint, yaw: -0.35, roll: tremble }));
      out.push(st(OUTFITS.worker, 'neutral', 45, WORK_CART, { yaw: 0.4 }));
      break;
    }
    case 'bare': {
      out.push(st(OUTFITS.treasurer, 'dazed', 44, TREAS_BARE, { yaw: 0 }));
      out.push(st(OUTFITS.worker, 'shock', 45, [-14.2, 0, -1.8], { yaw: -0.2 }));
      break;
    }
    case 'math': {
      out.push(kingSit(f < 1060 ? 'neutral' : 'shock'));
      // the mathematician leans in and whispers to the king from C08a on
      const wk = f >= 984 ? 0.55 : 0;
      out.push(RW(T, OUTFITS.mathematician, { expr: f < 1060 ? 'nervous' : 'shock', mode: 'stand', blink: blinkAt(f, 43), seed: 43, headTilt: q(9 * wk + 3, 1) }, MATH, { tint, yaw: 0.55 }));
      out.push(st(OUTFITS.farmer, 'neutral', 41, FARMER, { yaw: -0.45 }));
      out.push(st(OUTFITS.courtierL, f >= 1168 ? 'shock' : 'neutral', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, f >= 1168 ? 'shock' : 'neutral', 72, COURT_R, { yaw: -0.2 }));
      guards();
      break;
    }
    case 'stare': {
      // the king stands at the table, leaning over square one
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: q(13, 1) }, [0.1, 0, -1.55], { tint, yaw: 0.3 }));
      out.push(st(OUTFITS.farmer, 'neutral', 41, FARMER, { yaw: -0.45 }));
      break;
    }
    case 'moral': {
      out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, [0.1, 0, -1.55], { tint, yaw: 0.3 }));
      const k = 1.5 * bowK(f, 1280, 1302, 1332, 1358);
      out.push(RW(T, OUTFITS.farmer, { expr: f < 1313 ? 'neutral' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...bowOpts(k) }, BP(FARMER, k), { tint, yaw: -0.45 }));
      break;
    }
    case 'gold': {
      const wv = f >= 1406 && f <= 1440 ? q(0.5 + 0.5 * Math.sin(f * 0.25), 2) : 0;
      out.push(RW(T, OUTFITS.king, { expr: f < 1464 ? 'smile' : 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, wave: wv }, [0.55, 0, -1.15], { tint, yaw: 0.5 }));
      out.push(st(OUTFITS.farmer, 'grin', 41, [1.55, 0, -0.45], { yaw: -0.5 }));
      out.push(st(OUTFITS.courtierL, 'grin', 71, COURT_L, { yaw: 0.2 }));
      guards('grin', 'grin');
      break;
    }
    case 'hook': {
      const pk = q(smooth(ramp(f, 1610, 1626)) * (1 - smooth(ramp(f, 1670, 1700))), 2);
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: f >= 1598 && f < 1702 ? ['point', pk] : undefined }, KING_GARDEN, { tint, yaw: -0.55 }));
      out.push(st(OUTFITS.gardener, f >= 1702 ? 'dazed' : 'nervous', 91, GARDENER, { yaw: 0.45 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
