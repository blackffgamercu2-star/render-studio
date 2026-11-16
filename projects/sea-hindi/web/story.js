// Shot plan for "वो आदमी जिसने समंदर पीने का वादा किया" (batch-5 topic 4, HI) —
// timed to the ACTUAL Hindi voice stem (64.051 s, 30 fps, TOTAL 1922).
// Clause timings from faster-whisper ASR (hi) on the stem itself —
// sea-hindi/work/timing.json (27 clauses C01..C08c, word-end boundaries).
// QUALITY RULES (locked): shots change ONLY at clause boundaries; camera
// TRACKS the voice-named subject every beat (biggest/centred), never freezes,
// never drifts; characters act in place — no walk-glide; costumes by role
// (king = crown + royal robe, sailor = navy cap + navy jacket + white pants,
// farmer = worn poor clothes, courtiers = rich court dress, guards = red).
// PHYSICS (Abid 2026-11-15): the CUP travels with the sailor's hand —
// hand-low -> scoop at the water's edge -> mouth (drink + tilt) -> hand-low
// -> placed DOWN on the sand where it lands and STAYS (base flush, contact
// shadow). The gold POUCH rests on the offering table, then hand-to-hand
// king -> sailor -> held low at his side. Nothing floats, nothing drifts.
// World: palace court x=0 (throne z=-2.2, offering table [1.15,-0.7]),
// shore x=-24 (sand + sea), rivers x=+18 (seven ribbons into a sea strip),
// farm x=+18 foreground (hook: the farmer who sold the rain).
// C01 0-193 the bet · C02a-d 194-455 the laugh + terms · C03a-c 456-704 the cup
// C04a-b 705-749 "Drink!" · C05a-e 750-1081 stop the rivers · C06a-d 1082-1372 seven rivers
// C07a-d 1373-1713 the payment · C08a-c 1714-1921 the rain hook
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1922, DECK = 0;
export const SHOTS = [
  { id: 'bet', a: 0, b: 193, light: 'dusk' },
  { id: 'laugh', a: 194, b: 455, light: 'day' },
  { id: 'shore', a: 456, b: 704, light: 'day' },
  { id: 'shout', a: 705, b: 749, light: 'day' },
  { id: 'rivers', a: 750, b: 1081, light: 'day' },
  { id: 'seven', a: 1082, b: 1372, light: 'day' },
  { id: 'pay', a: 1373, b: 1713, light: 'day' },
  { id: 'hook', a: 1714, b: 1921, light: 'rain' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#14425e', waterShal: '#2e7ea6', glint: '#ffe9c0' };
export const LIGHTS = {
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  rain: { az: 100, el: 25, sky: '#8a94a3', ground: '#5c5a4a', hemi: 1.0, sun: '#cfd6dd', sunI: 1.4, fog: '#b9bfc4', fogNear: 40, fogFar: 300,
    skyTop: '#5a6a7d', skyHor: '#c9ccd2', sunDisc: '#e8ecf0', sunSize: 0.002, sat: 1.0, vig: 0.26, shadowExt: 18, aurora: 0, gain: '#e8ecf2', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const THRONE = [0, 0, -2.2];
export const SAILOR = [1.7, 0, -0.3];
export const TABLE = [1.15, 0.78, -0.7];      // offering table top centre (pouch rests here)
export const COURT_L = [-2.7, 0, -1.0];
export const COURT_R = [3.0, 0, -1.2];
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];
// shore (x=-24): sand disc centre [-24,0,0.5], sea plane z<-1
export const SAILOR_SHORE = [-24, 0, 0.8];
export const KING_SHORE = [-25.9, 0, -0.7];
export const CROWD_SHORE = [[-26.2, 0, 1.6], [-25.4, 0, 2.6], [-22.8, 0, -1.6]];
// rivers (x=+18): ribbons x 13.5..22.5, z -14..-6.5, flowing into sea strip z -16.5..-4.5
export const SAILOR_RIVER = [15.0, 0, -0.5];
export const KING_RIVER = [17.2, 0, -0.2];
export const COURT_RIVER = [19.5, 0, -0.6];
// farm hook (x=+18 foreground)
export const FARMER = [16.2, 0, 0.8];
export const KING_FARM = [18.6, 0, -0.6];

const HERO = {
  bet: () => [0.6, 1.3, -1.4],
  laugh: () => [0, 1.35, -2.2],
  shore: () => [-24, 1.1, 0.6],
  shout: () => [-25.9, 1.3, -0.7],
  rivers: () => [15.0, 1.2, -0.5],
  seven: () => [18, 1.0, -9],
  pay: () => [1.1, 1.0, -0.7],
  hook: (f) => f >= 1837 ? [17.6, 3.3, -3.3] : [16.2, 1.1, 0.8],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Shots change ONLY at clause boundaries; inside a shot a key lands exactly
// on each clause boundary and the camera surges to the clause's subject.
// Cross-location changes (court <-> shore <-> rivers) are jump cuts AT the
// clause boundary (batch-3 crows-hindi precedent — no cross-stage flights).
const CAMS = {
  bet: [
    { f: 0, pos: [8.6, 3.8, 12.6], look: [0, 1.9, -3.0], fov: 46 },
    { f: 70, pos: [4.6, 2.5, 6.2], look: [0.4, 1.5, -1.6], fov: 42, ease: 'surge' },
    { f: 144, pos: [2.2, 1.9, 3.2], look: [0.8, 1.2, -1.0], fov: 37, ease: 'surge' },
    { f: 193, pos: [2.2, 1.9, 3.2], look: [0.8, 1.2, -1.0], fov: 37 },
  ],
  laugh: [
    { f: 194, pos: [2.2, 1.9, 3.2], look: [0.8, 1.2, -1.0], fov: 37 },
    { f: 238, pos: [-2.0, 2.0, 3.4], look: [0.1, 1.3, -2.1], fov: 38, ease: 'surge' },
    { f: 292, pos: [-2.2, 2.0, 3.8], look: [0.1, 1.32, -2.15], fov: 39, ease: 'surge' },
    { f: 328, pos: [2.3, 2.5, 3.0], look: [0.9, 2.0, -2.2], fov: 42, ease: 'surge' },
    { f: 334, pos: [2.6, 2.6, 4.6], look: [0, 3.0, -3.05], fov: 42, ease: 'surge' },
    { f: 448, pos: [2.6, 2.6, 4.6], look: [0, 3.0, -3.05], fov: 42 },
    { f: 455, pos: [2.3, 2.5, 3.0], look: [0.9, 2.0, -2.2], fov: 42 },
  ],
  shore: [
    { f: 456, pos: [-19.5, 2.8, 5.2], look: [-24, 1.2, -0.5], fov: 44 },
    { f: 534, pos: [-21.8, 2.2, 3.6], look: [-23.9, 1.1, 0.6], fov: 40, ease: 'surge' },
    { f: 540, pos: [-21.6, 2.3, 4.4], look: [-24, 2.6, -2.9], fov: 42, ease: 'surge' },
    { f: 582, pos: [-21.6, 2.3, 4.4], look: [-24, 2.6, -2.9], fov: 42 },
    { f: 590, pos: [-22.4, 2.0, 4.0], look: [-24.0, 0.9, -0.5], fov: 40, ease: 'surge' },
    { f: 612, pos: [-22.4, 2.0, 4.0], look: [-24.0, 0.9, -0.5], fov: 40 },
    { f: 628, pos: [-21.6, 1.8, 3.4], look: [-23.9, 1.2, 0.85], fov: 40, ease: 'surge' },
    { f: 644, pos: [-21.6, 1.8, 3.4], look: [-23.9, 1.2, 0.85], fov: 40 },
    { f: 658, pos: [-21.8, 2.0, 4.0], look: [-23.7, 0.9, 1.1], fov: 40, ease: 'surge' },
    { f: 704, pos: [-21.8, 2.0, 4.0], look: [-23.7, 0.9, 1.1], fov: 40 },
  ],
  shout: [
    { f: 705, pos: [-21.0, 2.2, 4.6], look: [-25.0, 1.2, -0.2], fov: 40 },
    { f: 737, pos: [-21.4, 2.1, 4.2], look: [-25.2, 1.25, -0.3], fov: 39, ease: 'surge' },
    { f: 749, pos: [-21.4, 2.1, 4.2], look: [-25.2, 1.25, -0.3], fov: 39 },
  ],
  rivers: [
    { f: 750, pos: [11.0, 3.6, 7.5], look: [18, 1.0, -9], fov: 47 },
    { f: 782, pos: [12.2, 3.0, 5.6], look: [17.0, 1.2, -4.0], fov: 43, ease: 'surge' },
    { f: 818, pos: [13.0, 2.6, 4.0], look: [15.6, 1.2, -2.5], fov: 41, ease: 'surge' },
    { f: 824, pos: [13.4, 2.8, 4.6], look: [17.8, 2.4, -5.5], fov: 43, ease: 'surge' },
    { f: 842, pos: [13.4, 2.8, 4.6], look: [17.8, 2.4, -5.5], fov: 43 },
    { f: 850, pos: [12.8, 2.8, 4.8], look: [17.2, 1.0, -7.0], fov: 42, ease: 'surge' },
    { f: 947, pos: [13.2, 2.6, 4.2], look: [17.6, 1.1, -8.0], fov: 41, ease: 'surge' },
    { f: 1081, pos: [13.6, 2.6, 4.4], look: [17.8, 1.2, -8.5], fov: 41 },
  ],
  seven: [
    { f: 1082, pos: [10.5, 3.8, 8.5], look: [18, 1.2, -10], fov: 48 },
    { f: 1133, pos: [12.0, 3.2, 6.2], look: [18, 1.0, -10], fov: 45, ease: 'surge' },
    { f: 1140, pos: [12.5, 3.2, 5.8], look: [18, 2.6, -9.0], fov: 45, ease: 'surge' },
    { f: 1254, pos: [12.5, 3.2, 5.8], look: [18, 2.6, -9.0], fov: 45 },
    { f: 1267, pos: [13.0, 2.8, 5.0], look: [18, 1.0, -9.0], fov: 43, ease: 'surge' },
    { f: 1316, pos: [13.4, 2.6, 4.6], look: [18, 0.9, -9.5], fov: 42, ease: 'surge' },
    { f: 1372, pos: [13.8, 2.6, 4.8], look: [18, 1.0, -9.5], fov: 42 },
  ],
  pay: [
    { f: 1373, pos: [2.7, 1.9, 3.6], look: [0.9, 1.1, -0.9], fov: 38 },
    { f: 1380, pos: [2.6, 2.6, 4.6], look: [0, 3.0, -3.05], fov: 42, ease: 'surge' },
    { f: 1436, pos: [2.6, 2.6, 4.6], look: [0, 3.0, -3.05], fov: 42 },
    { f: 1445, pos: [2.6, 1.85, 3.2], look: [1.3, 1.0, -0.5], fov: 37, ease: 'surge' },
    { f: 1532, pos: [2.5, 1.9, 3.4], look: [1.2, 1.05, -0.6], fov: 37, ease: 'surge' },
    { f: 1586, pos: [2.7, 1.85, 3.4], look: [1.0, 1.1, -0.8], fov: 38, ease: 'surge' },
    { f: 1713, pos: [2.7, 1.8, 3.2], look: [1.3, 1.0, -0.55], fov: 37 },
  ],
  hook: [
    { f: 1714, pos: [12.6, 2.8, 6.6], look: [17.2, 1.4, -0.5], fov: 44 },
    { f: 1784, pos: [13.6, 2.5, 5.6], look: [17.4, 1.4, -0.8], fov: 42, ease: 'surge' },
    { f: 1837, pos: [14.2, 2.3, 5.4], look: [17.2, 1.9, -2.2], fov: 42, ease: 'surge' },
    { f: 1921, pos: [14.4, 2.3, 5.6], look: [17.4, 2.1, -2.4], fov: 41, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['shore', 'pay'].includes(S.id)) cinf = 3.4;
  if (S.id === 'hook' && f >= 1837) cinf = 3.6;
  if (['seven'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
// CUP keyframes (ASR: "प्याला भरा" 598-615, "पी गया" 629-641, "रख दिया" 662-679):
// hand-low 456-597 -> scoop at the water's edge 598-612 -> mouth 612-628 ->
// drink + tilt 628-644 -> lower 644-658 -> placed on the sand 658-674 -> rests.
const CUP_HAND = [-23.62, 1.02, 1.0];
const CUP_MOUTH = [-23.68, 1.42, 0.95];
const CUP_SCOOP = [-24.0, 0.15, -1.0];
const CUP_REST = [-23.4, 0, 1.4];
const POUCH_REST = [1.15, 0.78, -0.7];
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardBet: 0, boardCup: 0, boardRivers: 0, boardSeven: 0, boardPay: 0, boardHook: 0,
    cupPos: [...CUP_HAND], cupTilt: 0, cupVis: 0, goldPos: [...POUCH_REST] };
  if (S.id === 'bet') W.boardTitle = 1 - smooth(ramp(f, 44, 58));
  if (S.id === 'laugh') W.boardBet = smooth(ramp(f, 336, 348)) * (1 - smooth(ramp(f, 436, 448)));
  if (S.id === 'shore') {
    W.boardCup = smooth(ramp(f, 542, 554)) * (1 - smooth(ramp(f, 570, 582)));
    W.cupVis = 1;
  }
  if (S.id === 'shout') W.cupVis = 1;
  if (S.id === 'rivers') W.boardRivers = smooth(ramp(f, 826, 834)) * (1 - smooth(ramp(f, 842, 848)));
  if (S.id === 'seven') W.boardSeven = smooth(ramp(f, 1142, 1154)) * (1 - smooth(ramp(f, 1242, 1254)));
  if (S.id === 'pay') W.boardPay = smooth(ramp(f, 1382, 1394)) * (1 - smooth(ramp(f, 1424, 1436)));
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1845, 1870));   // NO fade-out: holds 1.0 to the last frame
  // ---- cup: travels with the hand; the final place-down is hand-guided ----
  if (f >= 456) {
    W.cupVis = 1;
    let p;
    if (f < 598) p = [CUP_HAND[0], CUP_HAND[1] + 0.01 * Math.sin(f * 0.2), CUP_HAND[2]];
    else if (f < 612) p = lerp3(CUP_HAND, CUP_SCOOP, smooth(ramp(f, 598, 612)));
    else if (f < 628) p = lerp3(CUP_SCOOP, CUP_MOUTH, smooth(ramp(f, 612, 628)));
    else if (f < 644) p = [...CUP_MOUTH];
    else if (f < 658) p = lerp3(CUP_MOUTH, CUP_HAND, smooth(ramp(f, 644, 658)));
    else if (f < 674) p = lerp3(CUP_HAND, CUP_REST, smooth(ramp(f, 658, 674)));
    else p = [...CUP_REST];
    W.cupPos = p.map((v) => +v.toFixed(3));
    W.cupTilt = +(0.85 * smooth(ramp(f, 628, 636)) * (1 - smooth(ramp(f, 644, 652)))).toFixed(3);
  }
  // ---- gold pouch: rests on the offering table -> king's hand (1400-1418) ->
  // hand-to-hand to the sailor (1418-1440) -> held low at his side (1440-1462)
  if (f >= 1373) {
    const t1 = smooth(ramp(f, 1400, 1418)), t2 = smooth(ramp(f, 1418, 1440)), t3 = smooth(ramp(f, 1440, 1462));
    let p = lerp3(POUCH_REST, [0.55, 1.15, -1.35], t1);
    p = lerp3(p, [1.35, 1.0, -0.45], t2);
    p = lerp3(p, [1.6, 0.55, -0.35], t3);
    W.goldPos = p.map((v) => +v.toFixed(3));
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return {
    smokeRate: S.id === 'bet' || S.id === 'laugh' || S.id === 'pay' ? 0.3 : 0.08,
    dustRate: S.id === 'hook' ? 0.5 : 0.08,      // rain mist over the farm
    sprayRate: (S.id === 'shore' || S.id === 'shout') ? 0.25 : 0.05,
    splashRate: 0,
  };
};

// ---------- actors ----------
// COSTUMES BY ROLE — king: crimson royal robe + gold crown + grey moustache,
// stout. Sailor: navy cap + navy jacket + white pants. Farmer: worn beige/brown
// poor clothes. Treasurer/courtier: rich court dress. Townspeople: worn work
// clothes. Guards: red uniform + shako.
const TINT = { dusk: '#ffd9a3', day: '#ffffff', rain: '#dfe6ec' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  sailor: { jacket: '#2e4a6e', pants: '#e8e4d8', boots: '#2e2118', hat: 'cap', cap: '#2e4a6e', skin: '#c98a5a' },
  farmer: { jacket: '#a08b6d', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#3a2a1a', skin: '#c98a5a' },
  courtierL: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
  courtierR: { jacket: '#6e4a3a', pants: '#33243d', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  townA: { jacket: '#8a7a63', pants: '#5d4c36', boots: '#3d2f1f', hat: 'hair', hair: '#241a12', skin: '#b57a48' },
  townB: { jacket: '#6e7a3a', pants: '#54492c', boots: '#3d2f1f', hat: 'hair', hair: '#2a2016', skin: '#c98a5a' },
  townC: { jacket: '#7a6a8a', pants: '#4a3a52', boots: '#2e2118', hat: 'hair', hair: '#3a2a1a', skin: '#e8b08a' },
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
    case 'bet': {
      out.push(kingSit('stern'));
      const k = bowK(f, 8, 26, 34, 42);
      out.push(RW(T, OUTFITS.sailor, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...bowOpts(k) }, BP(SAILOR, k), { tint, yaw: -0.45 }));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'neutral', 72, COURT_R, { yaw: -0.2 }));
      guards();
      break;
    }
    case 'laugh': {
      const pk = q(smooth(ramp(f, 300, 308)) * (1 - smooth(ramp(f, 440, 448))), 2);
      out.push(RW(T, OUTFITS.king, { expr: 'laugh', mode: 'sit', blink: blinkAt(f, 31), seed: 31, prop: f >= 292 ? ['point', pk] : undefined }, [...THRONE], { tint, yaw: 0 }));
      out.push(st(OUTFITS.sailor, 'grin', 41, SAILOR, { yaw: -0.45 }));
      out.push(st(OUTFITS.courtierL, 'laugh', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'grin', 72, COURT_R, { yaw: -0.2 }));
      guards('grin', 'grin');
      break;
    }
    case 'shore': {
      // sailor drinks at the water's edge (cup is a 3D prop at his hand/mouth)
      const expr = f >= 612 && f < 658 ? 'smile' : f >= 658 ? 'grin' : 'neutral';
      out.push(st(OUTFITS.sailor, expr, 41, SAILOR_SHORE, { yaw: 0.35 }));
      out.push(st(OUTFITS.king, f >= 641 ? 'stern' : 'neutral', 31, KING_SHORE, { yaw: -0.5 }));
      out.push(st(OUTFITS.townA, 'neutral', 51, CROWD_SHORE[0], { yaw: -0.3 }));
      out.push(st(OUTFITS.townB, f >= 612 ? 'grin' : 'neutral', 52, CROWD_SHORE[1], { yaw: 0.3 }));
      out.push(st(OUTFITS.townC, 'neutral', 53, CROWD_SHORE[2], { yaw: 0.2 }));
      break;
    }
    case 'shout': {
      const pk = q(smooth(ramp(f, 737, 743)) * (1 - smooth(ramp(f, 746, 749))), 2);
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', pk] }, KING_SHORE, { tint, yaw: -0.5 }));
      out.push(st(OUTFITS.sailor, 'neutral', 41, SAILOR_SHORE, { yaw: 0.35 }));
      out.push(st(OUTFITS.townA, 'nervous', 51, CROWD_SHORE[0], { yaw: -0.3 }));
      break;
    }
    case 'rivers': {
      // sailor points at the seven rivers from C05c on
      const pk = q(smooth(ramp(f, 818, 834)) * (1 - smooth(ramp(f, 1060, 1081))), 2);
      out.push(RW(T, OUTFITS.sailor, { expr: f < 818 ? 'smile' : 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: f >= 818 ? ['point', pk] : undefined }, SAILOR_RIVER, { tint, yaw: 0.3 }));
      out.push(st(OUTFITS.king, f >= 947 ? 'shock' : 'stern', 31, KING_RIVER, { yaw: -0.4 }));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_RIVER, { yaw: 0.2 }));
      break;
    }
    case 'seven': {
      out.push(st(OUTFITS.king, 'shock', 31, KING_RIVER, { yaw: -0.4 }));
      out.push(st(OUTFITS.sailor, 'grin', 41, SAILOR_RIVER, { yaw: 0.3 }));
      out.push(st(OUTFITS.courtierL, 'shock', 71, COURT_RIVER, { yaw: 0.2 }));
      break;
    }
    case 'pay': {
      const wv = f >= 1400 && f <= 1430 ? q(0.5 + 0.5 * Math.sin(f * 0.25), 2) : 0;
      out.push(RW(T, OUTFITS.king, { expr: f < 1445 ? 'smile' : 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, wave: wv }, [0.55, 0, -1.15], { tint, yaw: 0.5 }));
      out.push(st(OUTFITS.sailor, 'grin', 41, [1.55, 0, -0.45], { yaw: -0.5 }));
      out.push(st(OUTFITS.courtierL, 'grin', 71, COURT_L, { yaw: 0.2 }));
      guards('grin', 'grin');
      break;
    }
    case 'hook': {
      const pk = q(smooth(ramp(f, 1790, 1806)) * (1 - smooth(ramp(f, 1820, 1836))), 2);
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: f >= 1784 && f < 1837 ? ['point', pk] : undefined }, KING_FARM, { tint, yaw: -0.55 }));
      out.push(st(OUTFITS.farmer, f >= 1837 ? 'dazed' : 'nervous', 91, FARMER, { yaw: 0.45 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
