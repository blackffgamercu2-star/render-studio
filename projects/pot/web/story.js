// Shot plan for "The Pot That Gave Birth" (batch-3 topic 2, EN) —
// timed to the ACTUAL voice stem (57.29 s, 30 fps, TOTAL 1719), clause
// timings from faster-whisper alignment (match_ratio 0.952, 12 lines):
// C1 0-98 borrowed a pot, tiny pot beside it | C2 107-182 "gave birth",
// believed him | C3 194-243 big copper pot for a wedding | C4 257-311
// neighbour lent the finest pot | C5 325-399 returned it, small pot
// beside it | C6 408-438 "What's this?" | C7 452-545 "had a baby... the
// little one is yours" | C8 562-684 laughed, kept baby pot like treasure |
// C9 707-834 "may I borrow your golden vessel?" | C10 834-880 handed it
// over happily | C11 895-1019 empty-handed... "vessel died" | C12 1037-1110
// "Died? Vessels don't die!" | C13 1128-1195 "if a pot can give birth, a
// pot can also die" | C14 1214-1416 judge: "He is right... Case closed" |
// C15 1440-1710 donkey-shadow hook: "How do you pay for a shadow?"
// QUALITY RULES (owner, batch-3): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — no walk-glide; costumes by role (simple
// village clothes; judge = robe + white turban); hero pots BIG in frame.
// World: neighbour's courtyard x=0 (house facade z=-3.2, pot shelf),
// wedding pavilion x=-16, borrower's hut x=+16, judge's court x=+32,
// donkey roadside x=-32 (tree + signpost board).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1719, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 193, light: 'day' },
  { id: 'wedding', a: 194, b: 311, light: 'day' },
  { id: 'return', a: 312, b: 451, light: 'day' },
  { id: 'baby', a: 452, b: 684, light: 'day' },
  { id: 'borrow', a: 685, b: 894, light: 'day' },
  { id: 'empty', a: 895, b: 1110, light: 'dusk' },
  { id: 'judge', a: 1111, b: 1439, light: 'day' },
  { id: 'hook2', a: 1440, b: 1718, light: 'day' },
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
  lamp: { az: 70, el: 34, sky: '#8a6a4c', ground: '#3c2c1e', hemi: 0.88, sun: '#ffc37a', sunI: 1.9, fog: '#caa27a', fogNear: 30, fogFar: 210,
    skyTop: '#3c3a55', skyHor: '#caa27a', sunDisc: '#ffe9c0', sunSize: 0.0026, sat: 1.05, vig: 0.3, shadowExt: 14, aurora: 0, gain: '#ffe2b8', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
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
  if (S.id === 'empty') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 895, 960)));
  if (S.id === 'judge') return blendLight(LIGHTS.dusk, LIGHTS.day, smooth(ramp(f, 1111, 1180)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const FACADE = [0, 0, -3.2];
export const POTBIG = [0.35, 0, -2.2];    // big copper pot (returned pot)
export const POTBABY = [1.05, 0, -1.7];   // the baby pot
export const VESSELP = [-0.9, 1.05, -2.6]; // golden vessel on the shelf
export const WED = [-16, 0, -3.5];        // finest pot on its pedestal
export const HUT = [16, 0, -1.6];
export const BENCH = [32, 0, -4.6];       // judge's bench
export const DONKEY = [-32.4, 0, -3.0];
export const SIGNP = [-34.5, 3.4, -2.0];    // hook board on its signpost (west of the action)

const HERO = {
  hook: () => [0.7, 1.0, -1.9],
  wedding: () => [-16, 1.2, -3.5],
  return: () => [0.4, 1.0, -2.0],
  baby: () => [0.8, 0.9, -1.8],
  borrow: () => [-0.5, 1.2, -2.2],
  empty: () => [0.5, 1.0, -1.6],
  judge: () => [32, 1.4, -4.2],
  hook2: () => [-31, 1.0, -2.2],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Between clauses inside one shot
// a key lands exactly on the clause boundary frame.
const CAMS = {
  hook: [
    { f: 0, pos: [7.5, 3.6, 11.0], look: [0, 1.8, -2.6], fov: 46 },
    { f: 55, pos: [4.2, 2.4, 5.6], look: [0.3, 1.3, -2.2], fov: 42, ease: 'surge' },
    { f: 107, pos: [2.6, 1.9, 3.8], look: [0.7, 1.0, -1.9], fov: 38, ease: 'surge' },
    { f: 150, pos: [2.3, 1.8, 3.4], look: [0.7, 1.0, -1.9], fov: 37, ease: 'surge' },
    { f: 193, pos: [2.2, 1.75, 3.2], look: [0.7, 1.0, -1.9], fov: 36, ease: 'surge' },
  ],
  wedding: [
    { f: 194, pos: [2.2, 1.75, 3.2], look: [0.7, 1.0, -1.9], fov: 36 },
    { f: 240, pos: [-11, 2.2, 3.5], look: [-16, 1.4, -3.8], fov: 40, ease: 'surge' },
    { f: 280, pos: [-12.5, 2.1, 3.0], look: [-16, 1.1, -3.5], fov: 42, ease: 'surge' },
    { f: 311, pos: [-12.8, 2.0, 2.7], look: [-16, 1.1, -3.5], fov: 41, ease: 'surge' },
  ],
  return: [
    { f: 312, pos: [-13.8, 1.85, 1.2], look: [-16, 1.1, -3.5], fov: 36 },
    { f: 350, pos: [4.5, 2.2, 5.5], look: [0.5, 1.1, -2.0], fov: 40, ease: 'surge' },
    { f: 408, pos: [3.1, 1.85, 3.9], look: [-0.2, 1.15, -1.9], fov: 37, ease: 'surge' },
    { f: 451, pos: [2.9, 1.8, 3.6], look: [-0.2, 1.15, -1.9], fov: 36, ease: 'surge' },
  ],
  baby: [
    { f: 452, pos: [2.6, 1.75, 3.2], look: [-0.5, 1.2, -2.0], fov: 36 },
    { f: 470, pos: [3.5, 2.2, 6.5], look: [0, 2.2, -2.8], fov: 44, ease: 'surge' },
    { f: 545, pos: [3.3, 2.1, 6.2], look: [0, 2.0, -2.8], fov: 43, ease: 'surge' },
    { f: 600, pos: [2.6, 1.8, 3.6], look: [-0.7, 1.1, -1.7], fov: 38, ease: 'surge' },
    { f: 684, pos: [2.4, 1.75, 3.3], look: [-0.7, 1.05, -1.7], fov: 37, ease: 'surge' },
  ],
  borrow: [
    { f: 685, pos: [2.4, 1.75, 3.3], look: [-0.7, 1.05, -1.7], fov: 37 },
    { f: 720, pos: [3.2, 2.3, 6.2], look: [0, 2.3, -2.8], fov: 44, ease: 'surge' },
    { f: 810, pos: [3.0, 2.2, 5.9], look: [0, 2.2, -2.8], fov: 43, ease: 'surge' },
    { f: 850, pos: [2.6, 1.85, 3.8], look: [-0.5, 1.15, -1.8], fov: 38, ease: 'surge' },
    { f: 894, pos: [2.5, 1.8, 3.6], look: [-0.5, 1.1, -1.8], fov: 37, ease: 'surge' },
  ],
  empty: [
    { f: 895, pos: [2.5, 1.8, 3.6], look: [-0.5, 1.1, -1.8], fov: 37 },
    { f: 950, pos: [3.0, 2.0, 4.8], look: [0.5, 1.1, -1.6], fov: 39, ease: 'surge' },
    { f: 985, pos: [3.4, 2.3, 6.3], look: [0, 2.3, -2.8], fov: 44, ease: 'surge' },
    { f: 1040, pos: [3.2, 2.2, 6.0], look: [0, 2.2, -2.8], fov: 43, ease: 'surge' },
    { f: 1075, pos: [2.7, 1.8, 3.5], look: [-0.8, 1.2, -1.7], fov: 37, ease: 'surge' },
    { f: 1110, pos: [2.6, 1.75, 3.3], look: [-0.8, 1.15, -1.7], fov: 36, ease: 'surge' },
  ],
  judge: [
    { f: 1111, pos: [2.6, 1.75, 3.3], look: [-0.8, 1.15, -1.7], fov: 36 },
    { f: 1145, pos: [14, 6.5, 6.0], look: [26, 0.5, -2.0], fov: 40, ease: 'surge' },
    { f: 1180, pos: [26, 2.4, 5.5], look: [32, 1.5, -3.5], fov: 40, ease: 'surge' },
    { f: 1234, pos: [28.0, 2.5, 5.0], look: [32, 1.4, -4.0], fov: 42, ease: 'surge' },
    { f: 1300, pos: [29.0, 2.6, 6.5], look: [32, 1.5, -4.4], fov: 44, ease: 'surge' },
    { f: 1400, pos: [28.8, 2.6, 6.8], look: [32, 1.5, -4.4], fov: 45, ease: 'surge' },
    { f: 1439, pos: [28.9, 2.6, 6.7], look: [32, 1.5, -4.4], fov: 44, ease: 'surge' },
  ],
  hook2: [
    { f: 1440, pos: [30.5, 1.8, 1.5], look: [31.9, 1.35, -4.2], fov: 35 },
    { f: 1500, pos: [10, 5.0, 9.0], look: [-20, 1.5, -3], fov: 42, ease: 'surge' },
    { f: 1550, pos: [-26, 3.0, 5.0], look: [-31, 1.3, -2.5], fov: 40, ease: 'surge' },
    { f: 1600, pos: [-27.5, 2.2, 4.5], look: [-30.8, 1.0, -2.0], fov: 40, ease: 'surge' },
    { f: 1669, pos: [-32.5, 2.5, 5.5], look: [-34.5, 3.2, -2.0], fov: 40, ease: 'surge' },
    { f: 1718, pos: [-32.8, 2.45, 5.2], look: [-34.5, 3.3, -2.0], fov: 38, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['baby', 'borrow', 'empty', 'judge'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook2') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardBirth: 0, boardVessel: 0, boardDied: 0, boardHook: 0, potBabyK: 1, vesselK: 1 };
  if (S.id === 'baby') W.boardBirth = smooth(ramp(f, 470, 482)) * (1 - smooth(ramp(f, 548, 560)));
  if (S.id === 'borrow') W.boardVessel = smooth(ramp(f, 730, 742)) * (1 - smooth(ramp(f, 798, 810)));
  if (S.id === 'empty') W.boardDied = smooth(ramp(f, 985, 997)) * (1 - smooth(ramp(f, 1038, 1050)));
  if (S.id === 'hook2') W.boardHook = smooth(ramp(f, 1669, 1681));   // holds to the last frame — NO fade-out
  W.potBabyK = 1 - smooth(ramp(f, 644, 652));   // neighbour picks the baby pot up like a treasure
  W.vesselK = 1 - smooth(ramp(f, 834, 846));    // golden vessel leaves the shelf when handed over
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'lamp' ? 0.22 : 0.35), dustRate: 0.1, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { dusk: '#ffd9a3', lamp: '#ffcf96', day: '#ffffff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — borrower & neighbour: simple village clothes (different
// colours so the two men never blur); judge: dark robe + white turban;
// wedding guest: festive maroon dress, still simple.
export const OUTFITS = {
  borrower: { jacket: '#a8895a', pants: '#6e5a41', boots: '#4a3a28', hat: 'cap', cap: '#d9c9a8', skin: '#c98a5a' },
  neighbour: { jacket: '#7a8a5a', pants: '#4a5240', boots: '#3a2e22', hat: 'cap', cap: '#e8dcc4', skin: '#e8b08a' },
  guest: { jacket: '#b03a5a', dress: '#b03a5a', pants: '#5a2a3a', boots: '#3a2a22', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  judge: { jacket: '#3a2e4a', dress: '#3a2e4a', pants: '#2a2238', boots: '#1c1a17', hat: 'turban', turban: '#f7f3e6', skin: '#c98a5a', moustache: true },
  traveller: { jacket: '#8a6a4a', pants: '#5a4632', boots: '#3a2e22', hat: 'cap', cap: '#c9b896', skin: '#e8b08a' },
  owner: { jacket: '#6a5a7a', pants: '#3a3444', boots: '#2a2622', hat: 'cap', cap: '#d9c9a8', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
// The donkey is a card animal (kit donkeyCard), standing planted at the roadside.
const donkey = (T, tint, pos, extra = {}) => ({ key: 'donkey-stand', draw: (p) => T.donkeyCard(p, {}), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], tint, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'hook': {
      out.push(st(OUTFITS.borrower, 'grin', 51, [0.9, 0, -1.2], { yaw: 0.35 }));
      out.push(st(OUTFITS.neighbour, f < 155 ? 'neutral' : 'grin', 52, [-0.9, 0, -1.6], { yaw: -0.35 }));
      break;
    }
    case 'wedding': {
      // Men flank the finest pot — nobody stands in front of it.
      out.push(st(OUTFITS.borrower, 'grin', 51, [-14.6, 0, -2.4], { yaw: -0.3 }));
      out.push(st(OUTFITS.neighbour, 'grin', 52, [-17.0, 0, -3.4], { yaw: 0.3 }));
      out.push(st(OUTFITS.guest, 'smile', 53, [-15.2, 0, -4.6], { yaw: 0.15 }));
      break;
    }
    case 'return': {
      const k = q(0.9 * smooth(ramp(f, 325, 360)), 2);
      out.push(RW(T, OUTFITS.borrower, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['pot', k] }, [0.9, 0, -1.2], { tint, yaw: 0.35 }));
      out.push(st(OUTFITS.neighbour, f < 408 ? 'neutral' : 'shock', 52, [-0.9, 0, -1.6], { yaw: -0.35 }));
      break;
    }
    case 'baby': {
      const point = f < 562 ? { prop: ['point', 1] } : {};
      out.push(RW(T, OUTFITS.borrower, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...point }, [0.9, 0, -1.2], { tint, yaw: 0.35 }));
      const nExpr = f < 562 ? 'neutral' : 'laugh';
      const nProp = f >= 644 ? { prop: ['babypot', 0.95] } : {};
      out.push(RW(T, OUTFITS.neighbour, { expr: nExpr, mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...nProp }, [-0.9, 0, -1.6], { tint, yaw: -0.35 }));
      break;
    }
    case 'borrow': {
      out.push(st(OUTFITS.borrower, f < 765 ? 'nervous' : 'grin', 51, [0.9, 0, -1.2], { yaw: 0.35 }));
      const nProp = f >= 834 ? { prop: ['vessel', 0.9] } : {};
      out.push(RW(T, OUTFITS.neighbour, { expr: f < 834 ? 'neutral' : 'grin', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...nProp }, [-0.9, 0, -1.6], { tint, yaw: -0.35 }));
      break;
    }
    case 'empty': {
      out.push(st(OUTFITS.borrower, f < 958 ? 'nervous' : 'pained', 51, [0.9, 0, -1.2], { yaw: 0.35 }));
      out.push(st(OUTFITS.neighbour, f < 1037 ? 'stern' : 'shock', 52, [-0.9, 0, -1.6], { yaw: -0.35 }));
      break;
    }
    case 'judge': {
      // Men flank the bench — the judge stays visible between them.
      out.push(st(OUTFITS.judge, f < 1248 ? 'neutral' : 'smile', 71, [32, 0, -4.6], { yaw: 0 }));
      out.push(st(OUTFITS.borrower, 'grin', 51, [31.0, 0, -2.0], { yaw: 0.3 }));
      out.push(st(OUTFITS.neighbour, f < 1346 ? 'neutral' : 'dazed', 52, [33.0, 0, -2.0], { yaw: -0.3 }));
      break;
    }
    case 'hook2': {
      out.push(donkey(T, tint, DONKEY, { yaw: 0.2, s: 1.3 }));
      out.push(RW(T, OUTFITS.traveller, { expr: f < 1600 ? 'neutral' : 'nervous', mode: 'sit', blink: blinkAt(f, 81), seed: 81 }, [-30.6, 0, -0.8], { tint, yaw: 0.4 }));
      const oProp = f >= 1572 ? { prop: ['point', 1] } : {};
      out.push(RW(T, OUTFITS.owner, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 82), seed: 82, ...oProp }, [-29.8, 0, -1.8], { tint, yaw: -0.4 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
