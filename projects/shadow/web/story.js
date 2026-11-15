// Shot plan for "The Shadow of the Donkey" (batch-3 topic 3, EN) —
// timed to the ACTUAL voice stem (46.17 s, 30 fps, TOTAL 1386), clause
// timings from faster-whisper alignment (38 clauses):
// C1 0-46 rent donkey | C2 52-102 sat in shadow | C3 117-142 owner points |
// C4 149-171 shadow is mine | C5 175-190 pay for it | C6 199-229 paid for donkey |
// C7 237-248 not the shade | C8 258-281 owner stubborn | C9 294-316 rented you donkey |
// C10 325-354 shadow never in price | C11 366-390 one coin for shadow |
// C12 403-412 they argued | C13 412-445 market gathered | C14 462-480 went to judge |
// C15 493-506 judge said | C16 510-531 bring donkey | C17 541-565 donkey brought in |
// C18 573-600 judge turns | C19 610-627 give me one coin | C20 640-671 handed over coin |
// C21 681-721 held it up in sun | C22 727-756 shadow fell on ground | C23 771-774 There |
// C24 779-804 said judge to owner | C25 815-829 here is your payment |
// C26 838-864 take shadow of coin | C27 864-930 reached down, grabbed air |
// C28 943-961 shadow of the coin | C29 966-975 said the judge |
// C30 983-1018 price of shadow of donkey | C31 1030-1047 Fair is fair |
// C32 1060-1089 market roared | C33 1105-1159 climbed on, rode away | C34 1167-1172 free |
// C35 1188-1246 strangest thief | C36 1254-1284 blamed a cat |
// C37 1298-1326 cat weighed in court | C38 1338-1371 how can a cat prove a man guilty?
// QUALITY RULES (owner, batch-3): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — travel only via foot-locked march (walk());
// costumes by role; judge = purple robe + white cloth wrap.
// World: market square x=0 (road z~0.5), judge's court x=-16 (bench z=-5.2),
// cat-on-scales in the court for the hook. The donkey is a 3D animal
// (donkeyPosAt / donkeyYawAt / donkeyWalkAt); it teleports ONLY at shot
// boundaries (market -> court entrance at f481) and walks in during C17.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1386, DECK = 0;
export const SHOTS = [
  { id: 'rent', a: 0, b: 115, light: 'day' },
  { id: 'demand', a: 116, b: 197, light: 'day' },
  { id: 'argue', a: 198, b: 390, light: 'day' },
  { id: 'market', a: 391, b: 480, light: 'day' },
  { id: 'court', a: 481, b: 627, light: 'court' },
  { id: 'coinsun', a: 628, b: 756, light: 'coinsun' },
  { id: 'verdict', a: 757, b: 1047, light: 'coinsun' },
  { id: 'laugh', a: 1048, b: 1172, light: 'court' },
  { id: 'hook', a: 1173, b: 1385, light: 'court' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 10000, fogFar: 20000,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 150, aurora: 0, gain: '#ffffff', ...WATER },
  court: { az: 100, el: 35, sky: '#c8b490', ground: '#5c4a34', hemi: 1.1, sun: '#ffd9a0', sunI: 2.1, fog: '#d8c8a0', fogNear: 10000, fogFar: 20000,
    skyTop: '#5a6a94', skyHor: '#ffe0b0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, vig: 0.22, shadowExt: 150, aurora: 0, gain: '#ffedd2', ...WATER },
  coinsun: { az: 200, el: 50, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.3, sun: '#fff8e0', sunI: 2.5, fog: '#d8dcc8', fogNear: 10000, fogFar: 20000,
    skyTop: '#5f97d6', skyHor: '#f4f2dc', sunDisc: '#fffbe8', sunSize: 0.004, sat: 1.05, vig: 0.16, shadowExt: 150, aurora: 0, gain: '#ffffff', ...WATER },
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
  if (S.id === 'hook') return blendLight(LIGHTS.court, LIGHTS.day, smooth(ramp(f, 1200, 1300)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const MARKET = [0, 0, 0.5];
export const COURT = [-16, 0, -5.2];
export const DONKEY_HOME = [-3.0, 0, -0.6];  // market, west of the action, facing +x (head toward the actors)
export const DONKEY_GATE = [-12.2, 0, -1.2];   // court entrance (teleport at f481)
export const DONKEY_COURT = [-16.0, 0, -2.2];  // west end of the court, north side — clear of the judge sightline and the coin shadow
export const DONKEY_RIDE = [-7.5, 0, -1.2];    // where the ride-away ends
export const SCALE = [-13.2, 0, -2.8];         // cat-on-scales (hook shot)
export const COINSHADOW = [-15.27, 0.81, -5.30]; // decal: shadow of the judge's coin, ON THE BENCH TOP (slab top y=0.80) — the dais spots never read: the bench top occludes the dais north of it from the low west camera, and the east strip sits at the frame edge behind a leg; bright wood + centre-frame = the shadow finally reads
export const JUDGEP = [-16, 0, -6.0];
export const BENCHP = [-16, 0, -5.0];

/** Donkey position. Teleport ONLY at the f480->481 shot boundary. */
export const donkeyPosAt = (f) => kf3([
  [0, DONKEY_HOME], [480, DONKEY_HOME], [481, DONKEY_GATE], [540, DONKEY_GATE],
  [565, DONKEY_COURT], [1129, DONKEY_COURT], [1172, DONKEY_RIDE],
], f);
/** Donkey yaw (model built facing +x). Turns slowly to face east while the
 *  judge talks (f565-627), so the ride-away needs no spin. */
export const donkeyYawAt = (f) => kf([
  [0, 0], [540, 0], [565, 2.60], [627, 6.283], [1172, 6.10],
], f);
/** Walk phase locked to distance actually travelled (walk-in 3.93 m,
 *  ride-away 8.56 m). Returns {phase, moving, bob}. */
export const donkeyWalkAt = (f) => {
  const dIn = smooth(ramp(f, 541, 565)) * 3.93;
  const dRide = smooth(ramp(f, 1130, 1172)) * 8.56;
  const d = dIn + dRide;
  const moving = (f >= 541 && f <= 565) || (f >= 1130 && f <= 1172);
  return { phase: (d / 0.9) % 1, moving, bob: moving ? Math.abs(Math.sin(d / 0.9 * Math.PI)) * 0.035 : 0 };
};

const HERO = {
  rent: (f) => (f < 52 ? [-3.8, 1.0, -0.6] : [-2.25, 0.7, -1.6]),
  demand: () => [-1.0, 1.1, 0.8],
  argue: () => [0.0, 1.0, 0.7],
  market: () => [1.5, 1.0, 0.5],
  court: (f) => (f < 541 ? [-16, 1.3, -5.5] : [-16.0, 1.0, -2.2]),
  coinsun: (f) => (f < 727 ? [-15.4, 1.5, -5.3] : [-15.27, 0.81, -5.30]),
  verdict: (f) => (f < 864 ? [-15.8, 1.3, -5.4] : [-15.27, 0.81, -5.30]),
  laugh: (f) => (f < 1105 ? [-14.5, 1.0, -3.0] : donkeyPosAt(f)),
  hook: (f) => (f < 1298 ? [-13.2, 1.0, -2.8] : [-13.4, 2.3, -3.0]),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Between clauses inside one shot
// a key lands exactly on the clause boundary frame.
const CAMS = {
  rent: [
    // FIX 2026-11-15 (defect 1): the traveller used to stand at (-1.8,0.6),
    // directly in front of the donkey's head, hiding its body. He now stands
    // WEST of the donkey's tail (-4.6,-0.6) so both read fully, side by side;
    // the camera pulls a touch wider to hold them both.
    { f: 0, pos: [6.0, 3.2, 9.0], look: [-2.9, 1.0, -0.9], fov: 46 },
    { f: 52, pos: [3.2, 2.6, 5.4], look: [-3.1, 0.9, -1.1], fov: 44, ease: 'surge' },
    { f: 115, pos: [2.6, 2.4, 4.8], look: [-2.6, 0.8, -1.3], fov: 42, ease: 'surge' },
  ],
  demand: [
    { f: 116, pos: [2.6, 2.4, 4.8], look: [-2.6, 0.8, -1.3], fov: 42 },
    { f: 150, pos: [2.6, 2.0, 3.6], look: [-0.9, 1.1, 0.2], fov: 40, ease: 'surge' },
    { f: 197, pos: [2.2, 1.9, 3.2], look: [-1.0, 1.05, 0.1], fov: 38 },
  ],
  argue: [
    { f: 198, pos: [2.2, 1.9, 3.2], look: [-1.0, 1.05, 0.1], fov: 38 },
    { f: 240, pos: [2.6, 2.0, 3.8], look: [-0.2, 1.0, 0.3], fov: 42, ease: 'surge' },
    { f: 316, pos: [2.4, 1.9, 3.6], look: [-0.2, 1.0, 0.3], fov: 42, ease: 'surge' },
    { f: 390, pos: [2.6, 2.0, 3.8], look: [-0.2, 1.0, 0.3], fov: 42 },
  ],
  market: [
    { f: 391, pos: [2.6, 2.0, 3.8], look: [-0.2, 1.0, 0.3], fov: 42 },
    { f: 430, pos: [5.5, 3.0, 7.5], look: [-0.5, 1.0, -0.5], fov: 44, ease: 'surge' },
    { f: 480, pos: [2.0, 2.6, 6.5], look: [-6, 1.2, -3.0], fov: 42, ease: 'surge' },
  ],
  court: [
    { f: 481, pos: [2.0, 2.6, 6.5], look: [-6, 1.2, -3.0], fov: 42 },
    { f: 530, pos: [-9.0, 2.4, -1.0], look: [-15.5, 1.2, -4.5], fov: 44, ease: 'surge' },
    { f: 565, pos: [-9.5, 2.3, -0.5], look: [-15.2, 1.0, -2.8], fov: 44, ease: 'surge' },
    { f: 627, pos: [-10.0, 2.2, -0.8], look: [-15.8, 1.2, -5.0], fov: 42 },
  ],
  coinsun: [
    { f: 628, pos: [-10.0, 2.2, -0.8], look: [-15.8, 1.2, -5.0], fov: 42 },
    { f: 680, pos: [-10.5, 2.1, -1.2], look: [-16.0, 1.4, -5.2], fov: 40, ease: 'surge' },
    // FIX 2026-11-15 (defect 2, round 2): the first fix used a high SE
    // camera — from up there the sightline to the raised coin runs straight
    // through the signpost crossbar, so the coin vanished, and the judge
    // read small behind the bench. These keys come in LOW and CLOSE from the
    // west (the men have stepped aside, so the foreground is clear): the
    // judge is ~60% of frame height, the coin clears the crossbar, the beam
    // reads side-on, and the dais-top shadow sits lower-right in frame.
    { f: 705, pos: [-12.5, 2.2, -2.0], look: [-15.2, 1.1, -5.3], fov: 42, ease: 'surge' },
    { f: 721, pos: [-12.7, 2.15, -2.2], look: [-15.3, 1.15, -5.35], fov: 41, ease: 'surge' },
    { f: 756, pos: [-12.5, 2.2, -2.0], look: [-15.3, 1.05, -5.35], fov: 41, ease: 'surge' },
  ],
  verdict: [
    { f: 757, pos: [-12.5, 2.2, -2.0], look: [-15.3, 1.05, -5.35], fov: 41 },
    { f: 800, pos: [-10.3, 2.2, -0.8], look: [-15.8, 1.2, -5.0], fov: 39, ease: 'surge' },
    { f: 864, pos: [-10.0, 2.2, -0.5], look: [-14.2, 0.8, -4.2], fov: 38, ease: 'surge' },
    { f: 930, pos: [-10.3, 2.2, -0.8], look: [-15.8, 1.3, -5.2], fov: 39, ease: 'surge' },
    { f: 1018, pos: [-10.0, 2.2, -0.5], look: [-15.8, 1.2, -5.0], fov: 38 },
    { f: 1047, pos: [-9.8, 2.3, -0.2], look: [-15.2, 1.1, -4.6], fov: 39 },
  ],
  laugh: [
    { f: 1048, pos: [-9.8, 2.3, -0.2], look: [-15.2, 1.1, -4.6], fov: 39 },
    { f: 1090, pos: [-11.5, 2.2, 1.0], look: [-15.5, 1.1, -4.5], fov: 40, ease: 'surge' },
    { f: 1130, pos: [-11.0, 2.0, 0.6], look: [-15.0, 1.0, -2.4], fov: 39, ease: 'surge' },
    { f: 1172, pos: [-8.5, 2.1, 2.2], look: [-9.5, 1.0, -1.6], fov: 40, ease: 'surge' },
  ],
  hook: [
    { f: 1173, pos: [-8.5, 2.1, 2.2], look: [-9.5, 1.0, -1.6], fov: 40 },
    { f: 1230, pos: [-11.0, 2.3, 1.8], look: [-13.5, 1.1, -3.0], fov: 40, ease: 'surge' },
    { f: 1290, pos: [-11.8, 1.9, 0.6], look: [-13.4, 1.0, -2.8], fov: 38, ease: 'surge' },
    { f: 1338, pos: [-7.0, 2.0, 2.8], look: [-13.4, 1.9, -3.0], fov: 36, ease: 'surge' },
    { f: 1385, pos: [-7.0, 2.0, 2.8], look: [-13.4, 2.0, -3.0], fov: 35, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['coinsun', 'verdict'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardHook: 0, coinShadow: 0, scaleDip: 0, goldK: 0, scale: 0 };
  if (S.id === 'coinsun') W.coinShadow = smooth(ramp(f, 727, 745));
  if (S.id === 'verdict') W.coinShadow = 1 - smooth(ramp(f, 1000, 1030));
  if (S.id === 'hook') {
    W.scale = 1; // the balance scale + cat exist only in the hook (the cat is introduced there)
    W.boardHook = smooth(ramp(f, 1340, 1352));
    W.scaleDip = f >= 1298 ? q(0.5 + 0.5 * Math.sin((f - 1298) * 0.12), 2) * 0.35 : 0;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'coinsun' ? 0.3 : 0.35), dustRate: 0.1, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', court: '#ffdfb0', coinsun: '#fff3d8' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — traveller: dusty travel clothes + cloth head-wrap;
// owner: plain village clothes; judge: purple robe + white cloth wrap;
// crowd: simple village clothes, varied.
export const OUTFITS = {
  traveller: { jacket: '#8a6a3f', pants: '#5d4a33', boots: '#3a2a1a', hat: 'cap', cap: '#b0924f', skin: '#c98a5a' },
  owner: { jacket: '#a08b6d', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  judge: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#f7f3e6', skin: '#e8b08a' },
  crowd1: { jacket: '#7a6a8a', pants: '#4a3a52', boots: '#2e2118', hat: 'hair', hair: '#1a1210', skin: '#c98a5a' },
  crowd2: { jacket: '#6a7a4a', pants: '#44502e', boots: '#2e2118', hat: 'cap', cap: '#8a7a5a', skin: '#e8b08a' },
  crowd3: { jacket: '#a05a3a', pants: '#6e3a28', boots: '#3a2a1a', hat: 'hair', hair: '#3a2a1a', skin: '#c98a5a' },
  crowd4: { jacket: '#4a6a7a', pants: '#2e4250', boots: '#241a12', hat: 'cap', cap: '#d8c9a0', skin: '#e8b08a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];

const CROWD_MARKET = [[1.8, 0, 1.8], [2.6, 0, -0.8], [0.8, 0, -2.2], [-3.6, 0, 1.8]];
const CROWD_COURT = [[-13.5, 0, -6.5, 1.57], [-12.8, 0, -5.5, 1.57], [-18.5, 0, -2.0, 0.2], [-18.0, 0, -4.0, 0.2]];
const crowdAt = (T, tint, f, spots, expr, yawBase = 0) => {
  const outs = [OUTFITS.crowd1, OUTFITS.crowd2, OUTFITS.crowd3, OUTFITS.crowd4];
  return spots.map((p, i) => RW(T, outs[i], { expr, mode: 'stand', blink: blinkAt(f, 71 + i), seed: 71 + i }, [p[0], p[1], p[2]], { tint, yaw: p[3] ?? (yawBase + (i % 2 ? 0.3 : -0.3)) }));
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'rent': {
      // C1: traveller stands WEST of the donkey's tail (not in front of it),
      // so the whole donkey reads; C2 (f52+): he walks north of the donkey
      // to its shadow and sits down in it (foot-locked march, then sit).
      if (f < 52) out.push(st(OUTFITS.traveller, 'neutral', 51, [-4.6, 0, -0.6], { yaw: 0.4 }));
      else if (f < 85) {
        const p = kf3([[52, [-4.6, 0, -0.6]], [68, [-4.2, 0, -1.9]], [85, [-2.25, 0, -1.6]]], f);
        out.push(RW(T, OUTFITS.traveller, { expr: 'neutral', mode: 'march', phase: q(((f - 52) * 2.0 / 30 / 1.6) % 1, 3), blink: blinkAt(f, 51), seed: 51 }, p, { tint, yaw: -0.6 }));
      } else out.push(RW(T, OUTFITS.traveller, { expr: 'relief', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, [-2.25, 0, -1.6], { tint, yaw: -0.4 }));
      break;
    }
    case 'demand': {
      out.push(RW(T, OUTFITS.traveller, { expr: 'nervous', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, [-2.25, 0, -1.6], { tint, yaw: -0.4 }));
      const pk = f < 142 ? q(smooth(ramp(f, 117, 128)), 2) : q(1 - smooth(ramp(f, 175, 190)), 2);
      out.push(RW(T, OUTFITS.owner, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...(pk > 0.02 ? { prop: ['point', pk] } : {}) }, [-0.6, 0, 0.4], { tint, yaw: 0.5 }));
      break;
    }
    case 'argue': {
      out.push(st(OUTFITS.traveller, f < 294 ? 'nervous' : 'stern', 51, [0.2, 0, 0.2], { yaw: 0.6 }));
      out.push(st(OUTFITS.owner, 'stern', 52, [-0.6, 0, 0.4], { yaw: -0.5 }));
      break;
    }
    case 'market': {
      out.push(st(OUTFITS.traveller, 'stern', 51, [0.2, 0, 0.2], { yaw: 0.6 }));
      out.push(st(OUTFITS.owner, 'stern', 52, [-0.6, 0, 0.4], { yaw: -0.5 }));
      out.push(...crowdAt(T, tint, f, CROWD_MARKET, 'neutral', 0.4));
      break;
    }
    case 'court': {
      out.push(st(OUTFITS.judge, 'stern', 41, JUDGEP, { yaw: 0 }));
      out.push(st(OUTFITS.traveller, 'nervous', 51, [-14.4, 0, -3.4], { yaw: 0.4 }));
      out.push(st(OUTFITS.owner, 'stern', 52, [-13.4, 0, -3.0], { yaw: -0.4 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, 'neutral', 0.2));
      break;
    }
    case 'coinsun': {
      const ck = q(smooth(ramp(f, 681, 705)) * (1 - smooth(ramp(f, 745, 756))), 2);
      out.push(RW(T, OUTFITS.judge, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...(ck > 0.02 ? { prop: ['coinhigh', ck] } : {}) }, JUDGEP, { tint, yaw: 0 }));
      // FIX 2026-11-15 (defect 2): once the coin is handed over (f672) the
      // two men step aside — traveller back to his donkey's side, owner to
      // the south court — so the judge + coin + beam + shadow own the frame.
      // Foot-locked marches; both are back in place in the verdict shot.
      const stepAside = (from, to, a, b, expr) => {
        if (f < a) return st(expr === 'traveller' ? OUTFITS.traveller : OUTFITS.owner, 'nervous', expr === 'traveller' ? 51 : 52, from, { yaw: expr === 'traveller' ? 0.4 : -0.4 });
        if (f < b) {
          const p = kf3([[a, from], [b, to]], f);
          return RW(T, expr === 'traveller' ? OUTFITS.traveller : OUTFITS.owner, { expr: 'nervous', mode: 'march', phase: q(((f - a) * 2.0 / 30 / 1.6) % 1, 3), blink: blinkAt(f, expr === 'traveller' ? 51 : 52), seed: expr === 'traveller' ? 51 : 52 }, p, { tint, yaw: -0.6 });
        }
        return st(expr === 'traveller' ? OUTFITS.traveller : OUTFITS.owner, 'nervous', expr === 'traveller' ? 51 : 52, to, { yaw: 0.4 });
      };
      if (f < 672) out.push(RW(T, OUTFITS.traveller, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...(f >= 640 && f <= 671 ? { prop: ['coin', q(smooth(ramp(f, 640, 652)) * (1 - smooth(ramp(f, 660, 671))), 2)] } : {}) }, [-14.4, 0, -3.4], { tint, yaw: 0.4 }));
      else out.push(stepAside([-14.4, 0, -3.4], [-16.3, 0, -1.2], 672, 721, 'traveller'));
      if (f < 672) out.push(st(OUTFITS.owner, 'nervous', 52, [-13.4, 0, -3.0], { yaw: -0.4 }));
      else out.push(stepAside([-13.4, 0, -3.0], [-14.8, 0, -1.0], 672, 721, 'owner'));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, 'neutral', 0.2));
      break;
    }
    case 'verdict': {
      out.push(RW(T, OUTFITS.judge, { expr: f >= 1030 ? 'grin' : 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, JUDGEP, { tint, yaw: 0 }));
      // The two men walk back from their coin-up aside spots (f757-800),
      // then stand in their verdict places for the bow and the payoff.
      const back = (o, seed, from, to) => {
        if (f < 800) {
          const p = kf3([[757, from], [800, to]], f);
          return RW(T, o, { expr: 'nervous', mode: 'march', phase: q(((f - 757) * 2.0 / 30 / 1.6) % 1, 3), blink: blinkAt(f, seed), seed }, p, { tint, yaw: 0.6 });
        }
        return st(o, seed === 51 ? (f >= 1030 ? 'relief' : 'nervous') : 'nervous', seed, to, { yaw: seed === 51 ? 0.4 : -0.4 });
      };
      out.push(back(OUTFITS.traveller, 51, [-16.3, 0, -1.2], [-14.4, 0, -3.4]));
      const rk = bowK(f, 864, 890, 915, 930);
      if (f < 800) out.push(back(OUTFITS.owner, 52, [-14.8, 0, -1.0], [-13.4, 0, -3.0]));
      else out.push(RW(T, OUTFITS.owner, { expr: f >= 864 && f < 930 ? 'shock' : 'dazed', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...bowOpts(rk) }, BP([-13.4, 0, -3.0], rk), { tint, yaw: -0.4 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, f >= 1030 ? 'laugh' : 'neutral', 0.2));
      break;
    }
    case 'laugh': {
      out.push(st(OUTFITS.judge, 'grin', 41, JUDGEP, { yaw: 0 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, 'laugh', 0.2));
      out.push(st(OUTFITS.owner, 'dazed', 52, [-13.4, 0, -3.0], { yaw: -0.4 }));
      // C33: the traveller climbs onto his donkey and rides away — free.
      if (f < 1105) out.push(st(OUTFITS.traveller, 'grin', 51, [-14.4, 0, -3.4], { yaw: 0.4 }));
      else {
        const dp = donkeyPosAt(f);
        const p = kf3([[1105, [-14.4, 0, -3.4]], [1130, [dp[0], 1.05, dp[2]]]], f);
        const riding = f >= 1130;
        const rp = riding ? [dp[0], 1.05, dp[2]] : p;
        out.push(RW(T, OUTFITS.traveller, { expr: 'grin', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, rp, { tint, yaw: riding ? -0.18 : 0.4 }));
      }
      break;
    }
    case 'hook': {
      out.push(st(OUTFITS.judge, 'stern', 41, JUDGEP, { yaw: 0 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, 'neutral', 0.2));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
