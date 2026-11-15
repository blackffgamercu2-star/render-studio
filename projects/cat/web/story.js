// Shot plan for "The Cat That Ate the Butter" (batch-3 topic 4, EN) —
// timed to the ACTUAL voice stem (56.09 s, 30 fps, TOTAL 1683), clause
// timings from faster-whisper alignment (match_ratio 0.995, 22 clauses):
// C1 0-102 hook: butter kept disappearing | C2 116-160 weighed the cat |
// C3 166-202 cat proved servant guilty | C4 222-291 pot a little emptier |
// C5 298-387 "Master, the cat ate it." | C6 399-481 pot empty, kilo gone |
// C7 501-572 "The cat was hungry." | C8 588-611 master said nothing |
// C9 622-704 picked up cat, scales, needle | C10 715-756 Exactly one kilo.
// C11 764-826 turned to servant | C12 840-911 "if this is the cat..."
// C13 929-986 servant speechless | C14 1001-1081 "where is the cat?"
// C15 1100-1129 fell to his knees | C16 1140-1247 cat jumped down, licked,
//   walked away | C17 1263-1314 pot stayed full | C18 1322-1376 never blamed
//   the cat again | C19 1396-1515 cleverest answer, king's question |
// C20 1535-1582 "How many crows live in my kingdom?" | C21 1595-1626
//   answered in one second | C22 1634-1667 And he was right. How?
// QUALITY RULES (owner, batch-3): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — travel only via foot-locked walk (cat step
// phase locked to distance) or a jump arc; costumes by role; master =
// rich householder, servant = simple worn clothes. World: ONE kitchen —
// table x=0 (butter pot + dial scales), back wall z=-3.2.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, walk } from './motion.js';

export const FPS = 30, TOTAL = 1683, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 221, light: 'lamp' },
  { id: 'morning', a: 222, b: 398, light: 'lamp' },
  { id: 'empty', a: 399, b: 587, light: 'lamp' },
  { id: 'silence', a: 588, b: 714, light: 'lamp' },
  { id: 'kilo', a: 715, b: 763, light: 'lamp' },
  { id: 'turn', a: 764, b: 928, light: 'lamp' },
  { id: 'shock', a: 929, b: 1000, light: 'lamp' },
  { id: 'question2', a: 1001, b: 1099, light: 'lamp' },
  { id: 'knees', a: 1100, b: 1262, light: 'lamp' },
  { id: 'moral', a: 1263, b: 1395, light: 'lamp' },
  { id: 'hook2', a: 1396, b: 1682, light: 'day' },
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
  if (S.id === 'hook2') return blendLight(LIGHTS.lamp, LIGHTS.day, smooth(ramp(f, 1420, 1500)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const TABLE = [0, 0, -1.2];
export const POT = [-0.85, 0.78, -1.2];       // butter pot on the table
export const SCALES = [0.85, 0.78, -1.2];     // dial scales on the table
export const SCALE_TOP = 1.02;                // platform top (cat's feet when weighed)
export const CAT_TABLE = [-0.15, 0.78, -0.9]; // cat sitting on the table
export const CAT_SCALES = [0.85, SCALE_TOP, -1.2];
export const CAT_FLOOR = [1.15, 0, -0.2];     // where the cat lands
export const CAT_AWAY = [2.6, 0, 0.9];        // where the cat walks to
export const CAT_MORAL = [0.9, 0, 0.1];       // cat sitting, innocent, in moral + hook2
export const MASTER_HOME = [1.9, 0, 0.5];
export const SERVANT_HOME = [-2.1, 0, 0.5];

/** Cat position through the film. Hop (C9) and jump-down (C16) are spline
 *  arcs inside their shots; the walk-away is foot-locked via walk(). */
export const catPosAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'silence') {
    if (f < 655) return [...CAT_TABLE];
    return kf3([[655, CAT_TABLE, 'smooth', [[0.35, 2.0, -1.0]]], [688, CAT_SCALES]], f);
  }
  if (S.id === 'knees') {
    if (f < 1150) return [...CAT_SCALES];
    if (f < 1175) return kf3([[1150, CAT_SCALES, 'smooth', [[1.0, 1.7, -0.7]]], [1175, CAT_FLOOR]], f);
    if (f < 1210) return [...CAT_FLOOR];
    const w = walk(f, 1210, 1.5, 0.45);
    const dir = [CAT_AWAY[0] - CAT_FLOOR[0], CAT_AWAY[2] - CAT_FLOOR[2]];
    const len = Math.hypot(...dir), d = Math.min(w.dist, len);
    return [CAT_FLOOR[0] + dir[0] / len * d, 0, CAT_FLOOR[2] + dir[1] / len * d];
  }
  if (['kilo', 'turn', 'shock', 'question2'].includes(S.id)) return [...CAT_SCALES];
  if (['moral', 'hook2'].includes(S.id)) return [...CAT_MORAL];
  return [...CAT_TABLE];
};
/** Cat walk phase (0..1) — only meaningful during the C16 walk-away. */
export const catStepAt = (f) => (shotAt(f).id === 'knees' && f >= 1210 ? walk(f, 1210, 1.5, 0.45).phase : 0);
/** Is the cat mid-hop / mid-jump (airborne, standing pose)? */
export const catAirAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'silence') return f >= 655 && f <= 688;
  if (S.id === 'knees') return f >= 1150 && f <= 1175;
  return false;
};
/** Is the cat licking its paws (C16, sitting on the floor)? */
export const catLickAt = (f) => shotAt(f).id === 'knees' && f >= 1180 && f <= 1210;

const HERO = {
  hook: () => [-0.5, 1.0, -1.2],
  morning: (f) => (f < 298 ? [-0.15, 1.1, -0.9] : [-1.2, 1.1, 0.2]),
  empty: () => [-0.85, 1.0, -1.2],
  silence: (f) => (f < 655 ? [-0.15, 1.1, -0.9] : [0.85, 1.15, -1.2]),
  kilo: () => [0.85, 1.15, -1.2],
  turn: (f) => (f < 840 ? [1.4, 1.2, 0.3] : [0, 1.2, 0.15]),
  shock: () => [-1.4, 1.2, 0.3],
  question2: (f) => (f < 1040 ? [1.4, 1.2, 0.3] : [0.85, 1.15, -1.2]),
  knees: (f) => catPosAt(f).map((v, i) => v + [0, 0.45, 0][i]),
  moral: () => [-0.85, 1.0, -1.2],
  hook2: (f) => (f < 1520 ? [0.9, 0.4, 0.1] : [0, 3.3, -3.12]),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Between clauses inside one shot
// a key lands exactly on the clause boundary frame. Boards fade in only
// AFTER the camera has settled on their framing (see worldAt).
const CAMS = {
  hook: [
    { f: 0, pos: [7.5, 3.6, 11.5], look: [0, 1.6, -2.5], fov: 46 },
    { f: 55, pos: [5.2, 2.7, 7.0], look: [-0.2, 1.2, -1.3], fov: 42, ease: 'surge' },
    { f: 116, pos: [4.6, 2.4, 6.0], look: [0.6, 1.1, -0.7], fov: 40, ease: 'surge' },
    { f: 166, pos: [4.0, 2.2, 5.2], look: [0.5, 1.05, -0.8], fov: 39, ease: 'surge' },
    { f: 221, pos: [3.8, 2.15, 5.0], look: [0.5, 1.05, -0.8], fov: 39 },
  ],
  morning: [
    { f: 222, pos: [3.8, 2.15, 5.0], look: [0.5, 1.05, -0.8], fov: 39 },
    { f: 260, pos: [4.2, 2.3, 5.6], look: [-0.6, 1.0, -1.1], fov: 41, ease: 'surge' },
    { f: 298, pos: [3.9, 2.3, 6.2], look: [-1.1, 1.1, 0.15], fov: 44, ease: 'surge' },
    { f: 360, pos: [3.4, 2.2, 6.0], look: [-1.0, 1.1, 0.0], fov: 44, ease: 'surge' },
    { f: 398, pos: [3.3, 2.15, 5.9], look: [-1.0, 1.1, 0.0], fov: 44 },
  ],
  empty: [
    { f: 399, pos: [3.3, 2.15, 5.9], look: [-1.9, 1.15, 0.4], fov: 41 },
    { f: 440, pos: [2.6, 2.0, 4.2], look: [-0.7, 1.0, -1.1], fov: 40, ease: 'surge' },
    { f: 501, pos: [3.0, 2.1, 5.0], look: [-1.4, 1.1, 0.3], fov: 41, ease: 'surge' },
    { f: 560, pos: [2.6, 2.0, 4.8], look: [-1.7, 1.15, 0.4], fov: 40, ease: 'surge' },
    { f: 587, pos: [2.5, 1.98, 4.7], look: [-1.7, 1.15, 0.4], fov: 40 },
  ],
  silence: [
    { f: 588, pos: [2.5, 1.98, 4.7], look: [-1.7, 1.15, 0.4], fov: 40 },
    { f: 622, pos: [3.4, 2.2, 5.2], look: [0.6, 1.1, -0.9], fov: 41, ease: 'surge' },
    { f: 668, pos: [2.8, 2.0, 4.4], look: [0.85, 1.1, -1.2], fov: 39, ease: 'surge' },
    { f: 714, pos: [2.7, 1.98, 4.3], look: [0.85, 1.05, -1.2], fov: 39 },
  ],
  kilo: [
    { f: 715, pos: [2.7, 1.98, 4.3], look: [0.85, 1.05, -1.2], fov: 39 },
    { f: 730, pos: [0.85, 2.3, 4.4], look: [0, 1.6, -2.2], fov: 48, ease: 'surge' },
    { f: 763, pos: [0.85, 2.28, 4.3], look: [0, 1.6, -2.2], fov: 48 },
  ],
  turn: [
    { f: 764, pos: [0.85, 2.28, 4.3], look: [0, 1.6, -2.2], fov: 48 },
    { f: 800, pos: [0.8, 2.2, 7.0], look: [0.9, 1.2, 0.2], fov: 46, ease: 'surge' },
    { f: 840, pos: [0.8, 2.1, 7.2], look: [0.05, 1.15, 0.0], fov: 48, ease: 'surge' },
    { f: 900, pos: [0.7, 2.05, 7.1], look: [0.05, 1.15, 0.0], fov: 48, ease: 'surge' },
    { f: 928, pos: [0.65, 2.04, 7.0], look: [0.05, 1.15, 0.0], fov: 48 },
  ],
  shock: [
    { f: 929, pos: [0.15, 2.04, 6.4], look: [0, 1.15, 0.0], fov: 46 },
    { f: 960, pos: [0.6, 2.0, 5.6], look: [-1.0, 1.2, 0.3], fov: 43, ease: 'surge' },
    { f: 1000, pos: [0.5, 1.98, 5.5], look: [-1.0, 1.2, 0.3], fov: 43 },
  ],
  question2: [
    { f: 1001, pos: [0.5, 1.98, 5.5], look: [-1.0, 1.2, 0.3], fov: 43 },
    { f: 1035, pos: [1.2, 2.1, 6.0], look: [0.9, 1.2, -0.3], fov: 44, ease: 'surge' },
    { f: 1070, pos: [-1.2, 1.6, 1.8], look: [0.85, 1.1, -1.2], fov: 41, ease: 'surge' },
    { f: 1099, pos: [-1.1, 1.58, 1.7], look: [0.85, 1.1, -1.2], fov: 41 },
  ],
  knees: [
    { f: 1100, pos: [-1.1, 1.58, 1.7], look: [0.85, 1.1, -1.2], fov: 41 },
    { f: 1130, pos: [0.4, 2.0, 5.6], look: [-1.0, 0.9, 0.4], fov: 44, ease: 'surge' },
    { f: 1160, pos: [1.8, 1.9, 4.6], look: [1.15, 0.5, -0.2], fov: 41, ease: 'surge' },
    { f: 1210, pos: [2.6, 1.7, 3.6], look: [1.9, 0.4, 0.4], fov: 40, ease: 'surge' },
    { f: 1262, pos: [3.4, 1.8, 4.2], look: [2.6, 0.5, 0.9], fov: 40, ease: 'surge' },
  ],
  moral: [
    { f: 1263, pos: [3.4, 1.8, 4.2], look: [2.6, 0.5, 0.9], fov: 40 },
    { f: 1300, pos: [0.5, 2.7, 9.4], look: [-0.1, 1.1, -0.8], fov: 50, ease: 'surge' },
    { f: 1360, pos: [2.2, 2.0, 4.6], look: [-0.7, 1.0, -1.1], fov: 41, ease: 'surge' },
    { f: 1395, pos: [2.1, 1.98, 4.5], look: [-0.7, 1.0, -1.1], fov: 41 },
  ],
  hook2: [
    { f: 1396, pos: [2.1, 1.98, 4.5], look: [-0.7, 1.0, -1.1], fov: 41 },
    { f: 1450, pos: [2.6, 1.6, 3.0], look: [0.9, 0.45, 0.1], fov: 40, ease: 'surge' },
    { f: 1520, pos: [0, 3.15, 3.4], look: [0, 3.3, -3.12], fov: 38, ease: 'surge' },
    { f: 1682, pos: [0, 3.1, 3.3], look: [0, 3.3, -3.12], fov: 37 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['kilo', 'silence', 'question2'].includes(S.id)) cinf = 3.4;
  if (S.id === 'hook2' && f >= 1520) cinf = 2.5;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardKilo: 0, boardHook: 0, butterK: 0, needleK: 0 };
  if (S.id === 'hook') { W.boardTitle = 1 - smooth(ramp(f, 18, 30)); W.butterK = 0.5; }
  if (S.id === 'morning') W.butterK = 0.35;
  if (S.id === 'kilo') {
    W.boardKilo = smooth(ramp(f, 730, 740)) * (1 - smooth(ramp(f, 755, 763)));
    W.needleK = 1;
  }
  if (S.id === 'hook2') {
    W.boardHook = smooth(ramp(f, 1540, 1555));
    W.butterK = 1;
  }
  if (S.id === 'moral') W.butterK = 1;
  if (f >= 718 && f < 1155) W.needleK = smooth(ramp(f, 718, 748));
  if (f >= 1155) W.needleK = 1 - smooth(ramp(f, 1155, 1175));
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.12, dustRate: S.id === 'hook2' ? 0.14 : 0.08, splashRate: 0 };
};

// ---------- actors ----------
// COSTUMES BY ROLE — master: rich householder (plum robe, top hat, gold
// trim read); servant: plain worn clothes (ochre tunic, no hat, bare head).
export const OUTFITS = {
  master: { jacket: '#7a3b4f', pants: '#33242e', boots: '#241a12', hat: 'tophat', skin: '#e8b08a' },
  servant: { jacket: '#8a7a5c', pants: '#5a4a38', boots: '#3a2c1c', hat: 'hair', hair: '#3a2a1a', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const CAT = (T, f, pos, extra = {}) => {
  const sit = !catAirAt(f) && !(shotAt(f).id === 'knees' && f >= 1210);
  const opts = { sit, step: q(catStepAt(f), 3), lick: catLickAt(f) ? 1 : 0, blink: blinkAt(f, 77) };
  return { key: 'cat' + JSON.stringify(opts), draw: (p) => T.catCard(p, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], s: 0.65, tint: '#ffffff', yaw: -0.5, ...extra };
};
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = '#ffffff', out = [];
  const st = stand(T, tint, f);
  const catP = catPosAt(f);
  const masterYaw = (y) => ({ yaw: y });
  switch (S.id) {
    case 'hook': {
      out.push(st(OUTFITS.master, f < 116 ? 'neutral' : 'stern', 41, MASTER_HOME, masterYaw(-0.5)));
      out.push(CAT(T, f, catP, { yaw: 0.3 }));
      break;
    }
    case 'morning': {
      out.push(st(OUTFITS.master, 'neutral', 41, MASTER_HOME, masterYaw(-0.4)));
      out.push(st(OUTFITS.servant, 'nervous', 55, SERVANT_HOME, { yaw: 0.5 }));
      out.push(CAT(T, f, catP, { yaw: 0.3 }));
      break;
    }
    case 'empty': {
      out.push(st(OUTFITS.master, 'stern', 41, MASTER_HOME, masterYaw(-0.4)));
      out.push(st(OUTFITS.servant, 'nervous', 55, [-1.7, 0, 0.5], { yaw: 0.6, headTilt: 8 }));
      out.push(CAT(T, f, catP, { yaw: 0.3 }));
      break;
    }
    case 'silence': {
      const reach = q(0.15 + 0.75 * smooth(ramp(f, 640, 672)) * (1 - smooth(ramp(f, 690, 710))), 2);
      out.push(RW(T, OUTFITS.master, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['push', reach] }, MASTER_HOME, { tint, yaw: -0.55 }));
      out.push(st(OUTFITS.servant, 'nervous', 55, SERVANT_HOME, { yaw: 0.4 }));
      out.push(CAT(T, f, catP, { yaw: -0.2 }));
      break;
    }
    case 'kilo': {
      // both men stand behind the table, flanking the scales — neither
      // blocks the front-center camera's view of the dial.
      out.push(st(OUTFITS.master, 'neutral', 41, [1.25, 0, -2.2], masterYaw(-0.2)));
      out.push(st(OUTFITS.servant, 'nervous', 55, [-1.4, 0, -2.2], { yaw: 0.2 }));
      out.push(CAT(T, f, catP, { yaw: -0.2 }));
      break;
    }
    case 'turn': {
      const yaw = lerp(-0.55, -1.2, smooth(ramp(f, 764, 826)));
      out.push(RW(T, OUTFITS.master, { expr: f < 840 ? 'neutral' : 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, [1.4, 0, 0.3], { tint, yaw: q(yaw, 2) }));
      out.push(st(OUTFITS.servant, 'nervous', 55, [-1.3, 0, 0.3], { yaw: 0.7 }));
      out.push(CAT(T, f, catP, { yaw: -0.2 }));
      break;
    }
    case 'shock': {
      out.push(st(OUTFITS.master, 'stern', 41, [1.4, 0, 0.3], { yaw: -1.1 }));
      out.push(st(OUTFITS.servant, 'shock', 55, [-1.3, 0, 0.3], { yaw: 0.7 }));
      out.push(CAT(T, f, catP, { yaw: -0.2 }));
      break;
    }
    case 'question2': {
      out.push(st(OUTFITS.master, 'stern', 41, [1.4, 0, 0.3], { yaw: -1.1 }));
      out.push(st(OUTFITS.servant, 'shock', 55, [-1.3, 0, 0.3], { yaw: 0.7 }));
      out.push(CAT(T, f, catP, { yaw: -0.2 }));
      break;
    }
    case 'knees': {
      // master stands well clear of the low cat-tracking camera (his head
      // was cropping at the top edge); the beat is the servant + the cat.
      out.push(st(OUTFITS.master, 'stern', 41, [2.8, 0, 1.4], masterYaw(-0.5)));
      // servant on his knees: sit mode + bowed head reads as kneeling.
      const bow = q(18 * smooth(ramp(f, 1100, 1129)), 1);
      out.push(RW(T, OUTFITS.servant, { expr: 'shock', mode: f < 1100 ? 'stand' : 'sit', blink: blinkAt(f, 55), seed: 55, headTilt: bow }, [-1.2, 0, 0.4], { tint, yaw: 0.6 }));
      out.push(CAT(T, f, catP, { yaw: -0.9 }));
      break;
    }
    case 'moral': {
      out.push(st(OUTFITS.master, 'grin', 41, MASTER_HOME, masterYaw(-0.4)));
      out.push(st(OUTFITS.servant, 'relief', 55, [-1.9, 0, 0.5], { yaw: 0.5 }));
      out.push(CAT(T, f, catP, { yaw: 0.6 }));
      break;
    }
    case 'hook2': {
      out.push(CAT(T, f, catP, { yaw: 0.6 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
