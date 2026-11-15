// Shot plan for "The Cloth Only Fools Can't See" (batch-4 topic 2, EN) —
// timed to the ACTUAL voice stem (72.33 s, 30 fps, TOTAL 2170), clause
// timings from faster-whisper alignment (match_ratio 0.982, 24 clauses):
// C1 0-146 hook | C2 160-189 bow | C3 203-358 the pitch | C4 377-408 eyes
// lit up | C5 424-508 gold+silk order | C6 525-655 ten days at empty looms |
// C7 677-730 minister sent | C8 746-812 the stare | C9 812-874 "Am I a
// fool?" | C10 889-946 "Magnificent colours!" | C11 983-1009 minister 2 |
// C12 1020-1078 same panic, same praise | C13 1100-1147 king himself |
// C14 1162-1240 "Am I the fool?" | C15 1255-1324 "My finest cloth ever!" |
// C16 1342-1433 the dressing | C17 1445-1478 the parade | C18 1493-1523
// crowd praised | C19 1540-1572 nobody dared | C20 1589-1726 the boy
// shouts | C21 1742-1799 froze... then laughed | C22 1818-1906 walked on |
// C23 1927-2098 the traveller tease | C24 2115-2158 stone -> soup?
// QUALITY RULES (owner, batch-4): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes, never drifts; characters act in place — travel only via
// foot-locked march (king's parade: step phase locked to distance);
// costumes by role (king = royal robe + crown, weavers = craftsmen caps,
// ministers = court dress + sash, boy/father = plain townsfolk).
// PHYSICS RULES (owner, 2026-11-15, TOP priority): every prop rests flush
// ON its surface with contact shadow (pedestal gold/silk, bench pouch);
// the handed-over coin is drawn AT the weaver's hand; one coin slips at
// the looms and falls with gravity (t^2), lands flat and STOPS; weaving
// hands track the empty loom frame; dressing hands stay ON the king's
// shoulder line; the boy sits ON his father's shoulders (astride sit
// pose, seat at the father's shoulder height — no hover).
// World: THREE areas in one stage — throne court x=-17, weaving room
// x=0, city street x=+17; back walls z=-3.45.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';

export const FPS = 30, TOTAL = 2170, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 159, light: 'lamp' },
  { id: 'pitch', a: 160, b: 376, light: 'lamp' },
  { id: 'gold', a: 377, b: 524, light: 'lamp' },
  { id: 'looms', a: 525, b: 676, light: 'loom' },
  { id: 'minister1', a: 677, b: 982, light: 'loom' },
  { id: 'minister2', a: 983, b: 1099, light: 'loom' },
  { id: 'kingcheck', a: 1100, b: 1341, light: 'loom' },
  { id: 'dressing', a: 1342, b: 1444, light: 'loom' },
  { id: 'parade', a: 1445, b: 1588, light: 'day' },
  { id: 'boy', a: 1589, b: 1741, light: 'day' },
  { id: 'laugh', a: 1742, b: 1926, light: 'day' },
  { id: 'hook2', a: 1927, b: 2169, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  lamp: { az: 70, el: 34, sky: '#8a6a4c', ground: '#3c2c1e', hemi: 0.95, sun: '#ffc37a', sunI: 2.0, fog: '#caa27a', fogNear: 30, fogFar: 210,
    skyTop: '#3c3a55', skyHor: '#caa27a', sunDisc: '#ffe9c0', sunSize: 0.0026, sat: 1.05, vig: 0.3, shadowExt: 14, aurora: 0, gain: '#ffe2b8', ...WATER },
  loom: { az: 105, el: 40, sky: '#b6c3cf', ground: '#4c4438', hemi: 1.1, sun: '#ffe9c4', sunI: 2.1, fog: '#c9bda6', fogNear: 34, fogFar: 240,
    skyTop: '#54749c', skyHor: '#e8dfc8', sunDisc: '#fff3da', sunSize: 0.0028, sat: 1.04, vig: 0.24, shadowExt: 15, aurora: 0, gain: '#fff1d6', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const KING_DAIS = [-17, 0.55, -2.3];
export const PED = [-17, 0, -0.55];            // pedestal table (gold + silk on top, y 0.82)
export const WA_COURT = [-17.9, 0, 0.55], WB_COURT = [-16.1, 0, 0.55];
export const LOOM_A = [-1.7, 0, -1.7], LOOM_B = [1.7, 0, -1.7];
export const WA_LOOM = [-1.7, 0, -0.45], WB_LOOM = [1.7, 0, -0.45];
export const MIN_SPOT = [0.55, 0, -0.45];      // ministers inspect loom A from here
export const KING_LOOM = [0, 0, 0.75];
export const KING_DRESS = [0, 0, -0.55];
export const WA_DRESS = [-1.22, 0, -0.6], WB_DRESS = [1.22, 0, -0.6];
export const FATHER = [18.9, 0, 1.0];
export const BOY_Y = 1.30;                     // boy card base: seat lands on father's shoulders
export const COIN_DROP = [-2.8, -1.55];        // x,z of the slipped coin (falls from loom A's side ledge)
export const COIN_LEDGE_Y = 1.04, COIN_FLOOR_Y = 0.015;

/** The king's street journey: foot-locked march (phase from distance). */
const STREET_Z = -0.7, STREET_X0 = 14.9, STRIDE = 0.55;
const distAt = (f) => {
  let d = 0;
  d += clamp((f - 1445) / 30, 0, 143 / 30) * 0.55;          // parade (S9)
  d += clamp((f - 1818) / 30, 0, 108 / 30) * 0.55;          // walked on (S11)
  d += Math.max(0, (f - 1927) / 30) * 0.35;                  // away (S12)
  return d;
};
export const kingStreet = (f) => {
  const d = distAt(f);
  const walking = (f >= 1445 && f <= 1588) || (f >= 1818 && f <= 1926) || f >= 1927;
  return { x: STREET_X0 + d, z: STREET_Z, phase: (d / (2 * STRIDE)) % 1, walking };
};

/** Weaving mime: hand key for the 'push' prop — sweeps the loom frame. */
const weaveK = (f, ph) => q(0.46 + 0.30 * Math.sin((f + ph) * 0.285), 2);
/** The slipped coin: rests on the loom ledge, falls (gravity t^2) at
 *  f600, one tiny hop, then STAYS on the floor. Returns centre height. */
export const coinYAt = (f) => {
  if (f < 600) return COIN_LEDGE_Y;
  if (f < 614) { const u = (f - 600) / 14; return lerp(COIN_LEDGE_Y, COIN_FLOOR_Y, u * u); }
  if (f < 620) { const u = (f - 614) / 6; return COIN_FLOOR_Y + 0.028 * Math.sin(u * Math.PI); }
  return COIN_FLOOR_Y;
};

const HERO = {
  hook: () => [-17, 1.5, -1.4],
  pitch: (f) => (f < 300 ? [-17.9, 1.1, 0.55] : [-17.2, 1.3, -0.8]),
  gold: (f) => (f < 424 ? [-17, 1.7, -2.5] : [-17.5, 1.0, -0.2]),
  looms: (f) => (f < 600 ? [-1.7, 1.05, -0.6] : [-2.8, 0.5, -1.55]),
  minister1: (f) => (f < 812 ? [-0.9, 1.05, -1.6] : [0.55, 1.15, -0.45]),
  minister2: () => [0.55, 1.15, -0.45],
  kingcheck: () => [0, 1.25, 0.75],
  dressing: () => [0, 1.25, -0.55],
  parade: (f) => { const k = kingStreet(f); return [k.x, 1.2, k.z]; },
  boy: (f) => (f < 1655 ? [17.6, 1.3, -0.2] : [18.9, 1.85, 1.28]),
  laugh: (f) => { const k = kingStreet(f); return [k.x, 1.2, k.z]; },
  hook2: (f) => (f < 2098 ? [19.6, 1.2, -0.7] : [23.4, 4.9, -3.08]),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Scene changes cut AT clause boundaries (new area, new framing); inside
// a shot the camera surges TO the clause subject at each clause boundary
// and settles into a slow push-in. Boards fade in only AFTER the camera
// has settled on their framing (see worldAt).
const CAMS = {
  hook: [
    { f: 0, pos: [-11.2, 3.5, 10.8], look: [-16.7, 1.9, -2.2], fov: 47 },
    { f: 60, pos: [-12.6, 3.0, 8.2], look: [-16.9, 1.7, -1.8], fov: 44, ease: 'surge' },
    { f: 146, pos: [-13.4, 2.8, 7.4], look: [-17, 1.6, -1.6], fov: 43, ease: 'surge' },
    { f: 159, pos: [-13.5, 2.78, 7.3], look: [-17, 1.6, -1.6], fov: 43 },
  ],
  pitch: [
    { f: 160, pos: [-14.4, 2.2, 5.6], look: [-17.8, 1.15, 0.3], fov: 42 },
    { f: 203, pos: [-15.0, 2.3, 6.0], look: [-18.0, 1.2, 0.3], fov: 41, ease: 'surge' },
    { f: 300, pos: [-14.8, 2.35, 6.6], look: [-17.7, 1.3, -0.5], fov: 42, ease: 'surge' },
    { f: 376, pos: [-14.7, 2.33, 6.5], look: [-17.7, 1.3, -0.5], fov: 42 },
  ],
  gold: [
    { f: 377, pos: [-13.8, 2.5, 6.2], look: [-17, 1.5, -2.2], fov: 43 },
    { f: 424, pos: [-14.6, 2.2, 5.2], look: [-17.2, 1.1, -0.5], fov: 42, ease: 'surge' },
    { f: 470, pos: [-15.4, 1.9, 4.4], look: [-17.5, 0.95, -0.3], fov: 40, ease: 'surge' },
    { f: 524, pos: [-15.5, 1.88, 4.35], look: [-17.5, 0.95, -0.3], fov: 40 },
  ],
  looms: [
    { f: 525, pos: [5.6, 2.9, 7.6], look: [-0.4, 1.2, -2.0], fov: 46 },
    { f: 590, pos: [3.4, 2.2, 5.4], look: [-1.5, 1.05, -2.0], fov: 42, ease: 'surge' },
    { f: 640, pos: [2.6, 1.9, 4.6], look: [-2.4, 0.7, -1.8], fov: 40, ease: 'surge' },
    { f: 676, pos: [2.55, 1.88, 4.55], look: [-2.4, 0.7, -1.8], fov: 40 },
  ],
  minister1: [
    { f: 677, pos: [4.8, 2.6, 6.8], look: [-0.6, 1.2, -1.6], fov: 44 },
    { f: 746, pos: [3.2, 2.1, 4.9], look: [-0.9, 1.05, -1.7], fov: 41, ease: 'surge' },
    { f: 812, pos: [2.7, 2.0, 4.3], look: [0.1, 1.15, -0.7], fov: 40, ease: 'surge' },
    { f: 889, pos: [3.0, 2.05, 4.6], look: [-0.5, 1.1, -1.2], fov: 41, ease: 'surge' },
    { f: 982, pos: [3.05, 2.03, 4.55], look: [-0.5, 1.1, -1.2], fov: 41 },
  ],
  minister2: [
    { f: 983, pos: [4.6, 2.5, 6.6], look: [-0.5, 1.2, -1.6], fov: 44 },
    { f: 1020, pos: [2.8, 2.0, 4.4], look: [0.0, 1.1, -0.8], fov: 40, ease: 'surge' },
    { f: 1099, pos: [2.85, 1.98, 4.35], look: [0.0, 1.1, -0.8], fov: 40 },
  ],
  kingcheck: [
    { f: 1100, pos: [5.2, 2.8, 7.4], look: [-0.2, 1.25, -1.4], fov: 45 },
    { f: 1162, pos: [3.6, 2.3, 5.6], look: [0, 1.25, 0.2], fov: 42, ease: 'surge' },
    { f: 1255, pos: [3.2, 2.35, 5.2], look: [0, 1.3, 0.2], fov: 42, ease: 'surge' },
    { f: 1341, pos: [3.15, 2.33, 5.15], look: [0, 1.3, 0.2], fov: 42 },
  ],
  dressing: [
    { f: 1342, pos: [4.4, 2.5, 6.4], look: [0, 1.2, -0.5], fov: 43 },
    { f: 1390, pos: [3.4, 2.2, 5.2], look: [0, 1.25, -0.55], fov: 41, ease: 'surge' },
    { f: 1444, pos: [3.35, 2.18, 5.15], look: [0, 1.25, -0.55], fov: 41 },
  ],
  parade: [
    { f: 1445, pos: [10.8, 2.9, 7.8], look: [15.6, 1.3, -1.2], fov: 45 },
    { f: 1493, pos: [12.2, 2.4, 6.2], look: [16.2, 1.2, -1.0], fov: 43, ease: 'surge' },
    { f: 1540, pos: [13.4, 2.2, 5.6], look: [16.9, 1.15, -0.9], fov: 42, ease: 'surge' },
    { f: 1588, pos: [14.2, 2.18, 5.4], look: [17.3, 1.15, -0.85], fov: 42 },
  ],
  boy: [
    { f: 1589, pos: [17.8, 2.5, 7.6], look: [18.3, 1.5, 0.2], fov: 42 },
    { f: 1660, pos: [19.3, 2.35, 6.7], look: [18.85, 1.75, 0.4], fov: 41, ease: 'surge' },
    { f: 1700, pos: [19.6, 2.3, 6.6], look: [18.9, 1.8, 0.6], fov: 40, ease: 'surge' },
    { f: 1741, pos: [19.65, 2.29, 6.55], look: [18.9, 1.8, 0.6], fov: 40 },
  ],
  laugh: [
    { f: 1742, pos: [15.2, 2.4, 6.4], look: [17.9, 1.3, -0.4], fov: 43 },
    { f: 1800, pos: [16.4, 2.3, 6.0], look: [18.6, 1.25, -0.6], fov: 42, ease: 'surge' },
    { f: 1906, pos: [17.6, 2.25, 5.8], look: [19.6, 1.2, -0.8], fov: 42, ease: 'surge' },
    { f: 1926, pos: [17.8, 2.24, 5.75], look: [19.8, 1.2, -0.8], fov: 42 },
  ],
  hook2: [
    { f: 1927, pos: [17.8, 2.24, 5.75], look: [19.8, 1.2, -0.8], fov: 42 },
    { f: 2000, pos: [16.6, 2.5, 6.6], look: [20.4, 1.6, -1.2], fov: 43, ease: 'surge' },
    { f: 2098, pos: [17.8, 2.9, 6.3], look: [22.9, 4.2, -2.9], fov: 42, ease: 'surge' },
    { f: 2169, pos: [19.6, 3.6, 5.4], look: [23.35, 4.75, -3.05], fov: 40 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['gold', 'minister1', 'minister2', 'boy'].includes(S.id)) cinf = 3.4;
  if (S.id === 'hook2' && f >= 2098) cinf = 2.5;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardPayoff: 0, boardHook: 0, coinY: coinYAt(f) };
  if (S.id === 'hook') W.boardTitle = 1 - smooth(ramp(f, 20, 34));
  if (S.id === 'boy') W.boardPayoff = smooth(ramp(f, 1662, 1685)) * (1 - smooth(ramp(f, 1718, 1741)));
  if (S.id === 'hook2') W.boardHook = smooth(ramp(f, 2098, 2128));
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  if (S.light === 'lamp') return { smokeRate: 0.10, dustRate: 0.05, splashRate: 0 };
  if (S.light === 'loom') return { smokeRate: 0.04, dustRate: 0.16, splashRate: 0 };
  return { smokeRate: 0.0, dustRate: 0.06, splashRate: 0 };
};

// ---------- actors ----------
// COSTUMES BY ROLE — king: romanFront 'king' outfit (red robe, gold trim,
// fur collar, crown, short beard); parade king: same crown+beard over a
// plain white under-tunic (the "invisible cloth" = nothing royal left).
// Weavers: craftsmen (caps, earthy jackets). Ministers: court dress +
// gold sash (old minister white hair, second in a top hat). Father + boy:
// plain townsfolk; boy uses the kid build.
export const KING = { tunic: '#a51f24', cape: '#5e1220', skin: '#f5c9a0', beard: '#4a2c18', beardShort: true, crown: true, collar: '#f6efdd', trim: '#e8b64c' };
export const KING_UNDER = { tunic: '#ece5d4', skin: '#f5c9a0', beard: '#4a2c18', beardShort: true, crown: true };
export const WEAVER_A = { jacket: '#8a5d3b', pants: '#5a4632', boots: '#3a2c1c', hat: 'cap', cap: '#c2733a', skin: '#f5c9a0' };
export const WEAVER_B = { jacket: '#3f6a6f', pants: '#463f33', boots: '#2e241a', hat: 'cap', cap: '#5b4a8a', skin: '#c98a5a' };
export const MIN_OLD = { jacket: '#4a3a5e', pants: '#2e2a3a', boots: '#241a12', hat: 'hair', hair: '#e8e4da', skin: '#f3d6bb', sash: '#c9a227' };
export const MIN_2 = { jacket: '#274a5e', pants: '#22303a', boots: '#1e1a14', hat: 'tophat', skin: '#e8b08a', sash: '#c9a227' };
export const FATHER_O = { jacket: '#5d8a3a', pants: '#4a3b28', boots: '#33261a', hat: 'hair', hair: '#3a2a1a', skin: '#e8b08a' };
export const BOY_O = { build: 'kid', jacket: '#c25a3a', pants: '#5a6e8a', boots: '#4a3423', hat: 'hair', hair: '#2b211c', skin: '#f5c9a0' };
export const CROWD = [
  { jacket: '#4f7fb8', pants: '#3a3f4a', boots: '#2a2118', hat: 'hair', hair: '#5a3b2a', skin: '#f5c9a0' },
  { jacket: '#d9a441', pants: '#5a4632', boots: '#33261a', hat: 'cap', cap: '#7a4a2a', skin: '#e8b08a' },
  { build: 'stout', jacket: '#7a4a6e', pants: '#40303c', boots: '#241a12', hat: 'hair', hair: '#1e1714', skin: '#c98a5a' },
  { jacket: '#54687e', pants: '#37424e', boots: '#2a2118', hat: 'hair', hair: '#241a14', skin: '#ecd0b6' },
  { jacket: '#8a6a3c', pants: '#4f3d24', boots: '#33261a', hat: 'cap', cap: '#4f7fb8', skin: '#f5c9a0' },
];
export const CROWD_POS = [[14.6, 0, -2.3], [16.2, 0, -2.35], [17.8, 0, -2.3], [19.4, 0, -2.35], [21.0, 0, -2.3]];
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const RK = (T, o, opts, pos, extra = {}) => ({ key: 'rom' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.romanFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const kingAt = (T, f, outfit, opts, pos, extra = {}) => RK(T, outfit, { blink: blinkAt(f, 31), seed: 31, ...opts }, pos, { tint: '#ffffff', ...extra });
const crowdAt = (T, f, expr, pointIdx = -1) => CROWD_POS.map((pos, i) => {
  const opts = { expr: Array.isArray(expr) ? expr[i % expr.length] : expr, mode: 'stand', blink: blinkAt(f, 61 + i * 7), seed: 61 + i * 7 };
  if (i === pointIdx) opts.prop = ['point', 0.85];
  return RW(T, CROWD[i], opts, pos, { tint: '#ffffff', yaw: i % 2 ? -0.22 : 0.22 });
});

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = '#ffffff', out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'hook': {
      out.push(kingAt(T, f, KING, { expr: f < 100 ? 'neutral' : 'grin' }, KING_DAIS, { yaw: 0 }));
      out.push(st(WEAVER_A, 'grin', 41, WA_COURT, { yaw: 0.35 }));
      out.push(st(WEAVER_B, 'neutral', 43, WB_COURT, { yaw: -0.35 }));
      out.push(st(MIN_OLD, 'grin', 51, [-20.3, 0, -1.2], { yaw: 0.4 }));
      out.push(st(MIN_2, 'grin', 53, [-13.7, 0, -1.2], { yaw: -0.4 }));
      break;
    }
    case 'pitch': {
      // C2: both weavers bow deep; C3: weaver A pitches, arm sweeping the air
      const bow = q(17 * smooth(ramp(f, 160, 178)) * (1 - smooth(ramp(f, 205, 232))), 1);
      const bowH = q(24 * smooth(ramp(f, 160, 178)) * (1 - smooth(ramp(f, 205, 232))), 1);
      out.push(kingAt(T, f, KING, { expr: 'neutral', headTilt: 5 }, KING_DAIS, {}));
      out.push(RW(T, WEAVER_A, { expr: f < 232 ? 'neutral' : 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, tilt: bow, headTilt: bowH, ...(f >= 232 ? { prop: ['point', q(0.85 * smooth(ramp(f, 232, 258)), 2)] } : {}) }, WA_COURT, { tint, yaw: 0.35 }));
      out.push(RW(T, WEAVER_B, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43, tilt: bow, headTilt: bowH }, WB_COURT, { tint, yaw: -0.35 }));
      out.push(st(MIN_OLD, 'neutral', 51, [-20.3, 0, -1.2], { yaw: 0.4 }));
      out.push(st(MIN_2, 'neutral', 53, [-13.7, 0, -1.2], { yaw: -0.4 }));
      break;
    }
    case 'gold': {
      // C4: the king's eyes light up. C5: he points the order; weaver A's
      // raised hand HOLDS the gold coin (drawn at the hand), weaver B's
      // hand rests over the silk bolts — the handover beat.
      out.push(kingAt(T, f, KING, { expr: 'grin', ...(f >= 424 ? { R: 'point' } : {}) }, KING_DAIS, {}));
      out.push(RW(T, WEAVER_A, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...(f >= 440 ? { prop: ['coin', 0.55] } : {}) }, WA_COURT, { tint, yaw: 0.35 }));
      out.push(RW(T, WEAVER_B, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 43), seed: 43, ...(f >= 450 ? { prop: ['push', 0.5] } : {}) }, WB_COURT, { tint, yaw: -0.35 }));
      break;
    }
    case 'looms': {
      // Ten days of weaving AIR: hands sweep the empty loom frames; at
      // f600 a coin slips (see worldAt coinY) and weaver A glances down.
      const glance = q(11 * smooth(ramp(f, 612, 626)) * (1 - smooth(ramp(f, 640, 656))), 1);
      out.push(RW(T, WEAVER_A, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['push', weaveK(f, 0)], headTilt: glance }, WA_LOOM, { tint, yaw: 0.12 }));
      out.push(RW(T, WEAVER_B, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43, prop: ['push', weaveK(f, 11)] }, WB_LOOM, { tint, yaw: -0.12 }));
      break;
    }
    case 'minister1': {
      // Old minister: arrives (C7), leans in and stares (C8), recoils —
      // "Am I a fool?" (C9), then beams and points his praise (C10).
      const lean = f >= 746 && f < 812 ? { tilt: 6, headTilt: 13 } : {};
      const mo = f < 746 ? { expr: 'neutral' } : f < 812 ? { expr: 'nervous', ...lean } : f < 889 ? { expr: 'shock' } : { expr: 'grin', prop: ['point', 0.85] };
      out.push(RW(T, MIN_OLD, { mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...mo }, MIN_SPOT, { tint, yaw: -0.55 }));
      out.push(RW(T, WEAVER_A, { expr: f < 889 ? 'neutral' : 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['push', weaveK(f, 0)] }, WA_LOOM, { tint, yaw: 0.12 }));
      out.push(RW(T, WEAVER_B, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, WB_LOOM, { tint, yaw: -0.12 }));
      break;
    }
    case 'minister2': {
      const mo = f < 1020 ? { expr: 'neutral' } : f < 1050 ? { expr: 'nervous', tilt: 5, headTilt: 11 } : { expr: 'grin', prop: ['point', 0.85] };
      out.push(RW(T, MIN_2, { mode: 'stand', blink: blinkAt(f, 53), seed: 53, ...mo }, MIN_SPOT, { tint, yaw: -0.55 }));
      out.push(RW(T, WEAVER_A, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['push', weaveK(f, 0)] }, WA_LOOM, { tint, yaw: 0.12 }));
      out.push(RW(T, WEAVER_B, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, WB_LOOM, { tint, yaw: -0.12 }));
      break;
    }
    case 'kingcheck': {
      // The king himself: stares (C13), stomach turns (C14), then ROARS
      // his delight with both arms up (C15).
      const ko = f < 1162 ? { expr: 'neutral', headTilt: 4 } : f < 1255 ? { expr: 'shock', headTilt: 8 } : { expr: 'grin', headTilt: -6, L: 'up', R: 'up' };
      out.push(kingAt(T, f, KING, ko, KING_LOOM, {}));
      out.push(RW(T, WEAVER_A, { expr: f < 1255 ? 'nervous' : 'relief', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, WA_LOOM, { tint, yaw: 0.12 }));
      out.push(RW(T, WEAVER_B, { expr: f < 1255 ? 'nervous' : 'grin', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, WB_LOOM, { tint, yaw: -0.12 }));
      break;
    }
    case 'dressing': {
      // The mime: both weavers' hands ride the king's shoulder line —
      // high at the shoulders, then smoothing down the "cloth". Weaver B
      // is flipped so his working hand is the one at the king.
      const k = q(0.30 + 0.25 * smooth(ramp(f, 1408, 1436)) + 0.04 * Math.sin(f * 0.3), 2);
      out.push(kingAt(T, f, KING, { expr: f < 1400 ? 'neutral' : 'grin' }, KING_DRESS, {}));
      out.push(RW(T, WEAVER_A, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['push', k] }, WA_DRESS, { tint, yaw: 0.3 }));
      out.push(RW(T, WEAVER_B, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 43), seed: 43, prop: ['push', k] }, WB_DRESS, { tint, yaw: -0.3, flip: true }));
      break;
    }
    case 'parade': {
      const k = kingStreet(f);
      out.push(kingAt(T, f, KING_UNDER, { expr: 'stern', headTilt: -6, step: q(k.phase, 3), bob: q(0.02 * Math.abs(Math.sin(2 * Math.PI * k.phase)), 3) }, [k.x, 0, k.z], {}));
      out.push(...crowdAt(T, f, 'grin', f >= 1493 ? 1 : -1));
      out.push(st(FATHER_O, 'grin', 57, FATHER, { yaw: -0.3 }));
      out.push(RW(T, BOY_O, { expr: 'grin', mode: 'sit', blink: blinkAt(f, 59), seed: 59 }, [FATHER[0], BOY_Y, FATHER[2] + 0.28], { tint, yaw: -0.2, s: 0.62, blob: false }));
      break;
    }
    case 'boy': {
      const k = kingStreet(f);
      out.push(kingAt(T, f, KING_UNDER, { expr: 'stern', headTilt: -6 }, [k.x, 0, k.z], {}));
      out.push(...crowdAt(T, f, f < 1698 ? 'grin' : 'shock'));
      out.push(st(FATHER_O, f < 1700 ? 'grin' : 'shock', 57, FATHER, { yaw: -0.3 }));
      out.push(RW(T, BOY_O, { expr: f < 1698 ? 'grin' : 'laugh', mode: 'sit', blink: blinkAt(f, 59), seed: 59 }, [FATHER[0], BOY_Y, FATHER[2] + 0.28], { tint, yaw: -0.2, s: 0.62, blob: false }));
      break;
    }
    case 'laugh': {
      const k = kingStreet(f);
      const ko = k.walking && f >= 1818 ? { step: q(k.phase, 3), bob: q(0.02 * Math.abs(Math.sin(2 * Math.PI * k.phase)), 3) } : {};
      out.push(kingAt(T, f, KING_UNDER, { expr: 'stern', headTilt: -8, ...ko }, [k.x, 0, k.z], {}));
      out.push(...crowdAt(T, f, f < 1771 ? 'shock' : 'laugh'));
      out.push(st(FATHER_O, f < 1771 ? 'shock' : 'laugh', 57, FATHER, { yaw: -0.3 }));
      out.push(RW(T, BOY_O, { expr: f < 1771 ? 'shock' : 'laugh', mode: 'sit', blink: blinkAt(f, 59), seed: 59 }, [FATHER[0], BOY_Y, FATHER[2] + 0.28], { tint, yaw: -0.2, s: 0.62, blob: false }));
      break;
    }
    case 'hook2': {
      const k = kingStreet(f);
      out.push(kingAt(T, f, KING_UNDER, { expr: 'stern', headTilt: -8, step: q(k.phase, 3), bob: q(0.02 * Math.abs(Math.sin(2 * Math.PI * k.phase)), 3) }, [k.x, 0, k.z], {}));
      out.push(...crowdAt(T, f, 'grin'));
      out.push(st(FATHER_O, 'grin', 57, FATHER, { yaw: -0.3 }));
      out.push(RW(T, BOY_O, { expr: 'grin', mode: 'sit', blink: blinkAt(f, 59), seed: 59 }, [FATHER[0], BOY_Y, FATHER[2] + 0.28], { tint, yaw: -0.2, s: 0.62, blob: false }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  // The boy's shout: one clean starburst at his head, f1698-1724.
  if (shotAt(f).id === 'boy' && f >= 1698 && f <= 1724) {
    const t = q((f - 1698) / 26, 2);
    return [{ key: 'burst' + t, draw: (p) => T.fxBurst(p, t, '#fff3b0'), x: FATHER[0] - 0.42, y: 1.30, z: FATHER[2] + 0.28, ground: 0, s: 0.5, tint: '#ffffff', blob: false, shadow: false }];
  }
  return [];
};
