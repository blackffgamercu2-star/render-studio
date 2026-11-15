// Shot plan for "गधे की छाँव की कीमत" (batch-3 topic 3, HI) —
// timed to the ACTUAL Hindi voice stem (51.891 s, 30 fps, TOTAL 1557), clause
// timings from faster-whisper base hi, segment-to-clause map (35 segs -> 36 clauses) (36 clauses):
// C1 0-62 एक मुसाफ़िर ने एक दिन के लिए गधा किराए पर लि
// C2 62-133 और दोपहर को वह उसकी छाँव में बैठकर आराम करने
// C3 133-178 मालिक ने ज़मीन की ओर इशारा किया
// C4 178-205 यह छाँव मेरी है
// C5 205-229 इसकी कीमत दो
// C6 229-300 मुसाफ़िर ने गधे के पैसे दिए थे — छाँव के लिए
// C7 300-332 लेकिन मालिक अड़ा रहा
// C8 332-369 मैंने तुम्हें गधा दिया था
// C9 369-400 छाँव कीमत में नहीं थी
// C10 400-433 छाँव का एक सिक्का दो
// C11 433-463 दोनों झगड़ते रहे
// C12 463-500 और पूरा बाज़ार इकट्ठा हो गया
// C13 500-539 फिर दोनों क़ाज़ी के पास गए
// C14 539-586 क़ाज़ी ने कहा, गधे को यहाँ लाओ
// C15 586-614 गधा लाया गया
// C16 614-653 क़ाज़ी मुसाफ़िर की ओर मुड़ा
// C17 653-685 मुझे एक सिक्का दो
// C18 685-723 मुसाफ़िर ने सिक्का दे दिया
// C19 723-780 क़ाज़ी ने उसे तेज़ धूप में ऊपर उठाया
// C20 780-817 ताकि उसकी छाँव ज़मीन पर पड़े
// C21 817-829 लो
// C22 829-869 क़ाज़ी ने मालिक से कहा
// C23 869-893 यह तुम्हारी कीमत है
// C24 893-924 सिक्के की छाँव ले लो
// C25 924-1010 मालिक ने हाथ बढ़ाया — और हवा के सिवा कुछ भी 
// C26 1010-1037 सिक्के की छाँव
// C27 1037-1064 क़ाज़ी ने कहा
// C28 1064-1096 गधे की छाँव की कीमत है
// C29 1096-1130 जैसा का तैसा
// C30 1130-1164 पूरा बाज़ार हँस पड़ा
// C31 1172-1223 मुसाफ़िर अपने गधे पर चढ़ा और चल दिया
// C32 1233-1252 बिल्कुल मुफ़्त
// C33 1261-1342 लेकिन राज्य का सबसे अजीब चोर कभी कुछ चुराता 
// C34 1350-1411 वह हर चीज़ का इल्ज़ाम एक बिल्ली पर लगा देता 
// C35 1418-1477 और अदालत में उस बिल्ली को तराज़ू पर तौला गया
// C36 1487-1553 भला एक बिल्ली आदमी को दोषी कैसे साबित कर सकत
// QUALITY RULES (owner, batch-3): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — travel only via foot-locked march (walk());
// costumes by role; judge = purple robe + white cloth wrap.
// World: market square x=0 (road z~0.5), judge's court x=-16 (bench z=-5.2),
// cat-on-scales in the court for the hook. The donkey is a 3D mesh
// (donkeyPosAt / donkeyYawAt / donkeyWalkAt in main.js); it teleports ONLY at shot
// boundaries (market -> court entrance at court start) and walks in during C15.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1557, DECK = 0;
export const SHOTS = [
  { id: 'rent', a: 0, b: 133, light: 'day' },
  { id: 'demand', a: 134, b: 229, light: 'day' },
  { id: 'argue', a: 230, b: 433, light: 'day' },
  { id: 'market', a: 434, b: 539, light: 'day' },
  { id: 'court', a: 540, b: 683, light: 'court' },
  { id: 'coinsun', a: 684, b: 816, light: 'coinsun' },
  { id: 'verdict', a: 817, b: 1128, light: 'coinsun' },
  { id: 'laugh', a: 1129, b: 1252, light: 'court' },
  { id: 'hook', a: 1253, b: 1556, light: 'court' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 150, aurora: 0, gain: '#ffffff', ...WATER },
  court: { az: 100, el: 35, sky: '#c8b490', ground: '#5c4a34', hemi: 1.1, sun: '#ffd9a0', sunI: 2.1, fog: '#d8c8a0', fogNear: 40, fogFar: 320,
    skyTop: '#5a6a94', skyHor: '#ffe0b0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, vig: 0.22, shadowExt: 150, aurora: 0, gain: '#ffedd2', ...WATER },
  coinsun: { az: 200, el: 50, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.3, sun: '#fff8e0', sunI: 2.5, fog: '#d8dcc8', fogNear: 46, fogFar: 380,
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
  if (S.id === 'hook') return blendLight(LIGHTS.court, LIGHTS.day, smooth(ramp(f, 1276, 1422)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const MARKET = [0, 0, 0.5];
export const COURT = [-16, 0, -5.2];
export const DONKEY_HOME = [-3.0, 0, -0.6];  // market, west of the action, facing +x (head toward the actors)
export const DONKEY_GATE = [-12.2, 0, -1.2];   // court entrance (teleport at f481)
export const DONKEY_COURT = [-17.5, 0, -4.0];  // beside the judge's bench (west), clear of the coin-shadow sightline
export const DONKEY_RIDE = [-7.5, 0, -1.2];    // where the ride-away ends
export const SCALE = [-12.6, 0, -4.8];         // cat-on-scales (hook shot) — clear of the ride-away path
export const COINSHADOW = [-14.0, 0.01, -4.0]; // decal: shadow of the judge's coin (south of the dais edge, on open floor)
export const JUDGEP = [-16, 0, -6.0];
export const BENCHP = [-16, 0, -5.0];

/** Donkey position. Teleport ONLY at the market->court shot boundary. */
export const donkeyPosAt = (f) => kf3([
  [0, DONKEY_HOME], [539, DONKEY_HOME], [540, DONKEY_GATE], [586, DONKEY_GATE],
  [614, DONKEY_COURT], [1195, DONKEY_COURT], [1252, DONKEY_RIDE],
], f);
/** Donkey yaw (model built facing +x). Turns slowly to face east while the
 *  judge talks (f614-683), so the ride-away needs no spin. */
export const donkeyYawAt = (f) => kf([
  [0, 0], [586, 0], [614, 2.60], [683, 6.283], [1252, 6.10],
], f);
/** Walk phase locked to distance actually travelled (walk-in 5.99 m,
 *  ride-away 10.39 m). Returns {phase, moving, bob}. */
export const donkeyWalkAt = (f) => {
  const dIn = smooth(ramp(f, 586, 614)) * 5.99;
  const dRide = smooth(ramp(f, 1196, 1252)) * 10.39;
  const d = dIn + dRide;
  const moving = (f >= 586 && f <= 614) || (f >= 1196 && f <= 1252);
  return { phase: (d / 0.9) % 1, moving, bob: moving ? Math.abs(Math.sin(d / 0.9 * Math.PI)) * 0.035 : 0 };
};

const HERO = {
  rent: (f) => (f < 62 ? [-1.5, 1.0, 0.3] : [-2.25, 0.7, -1.6]),
  demand: () => [-1.0, 1.1, 0.8],
  argue: () => [0.0, 1.0, 0.7],
  market: () => [1.5, 1.0, 0.5],
  court: (f) => (f < 586 ? [-16, 1.3, -5.5] : [-17.5, 1.0, -4.0]),
  coinsun: (f) => (f < 780 ? [-15.4, 1.5, -5.3] : [-14.0, 0.4, -4.0]),
  verdict: (f) => (f < 923 ? [-15.8, 1.3, -5.4] : [-14.0, 0.5, -4.0]),
  laugh: (f) => (f < 1172 ? [-14.5, 1.0, -3.0] : donkeyPosAt(f)),
  hook: (f) => (f < 1418 ? [-12.6, 1.0, -4.8] : [-13.4, 2.3, -3.0]),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Between clauses inside one shot
// a key lands exactly on the clause boundary frame.
const CAMS = {
  rent: [
    { f: 0, pos: [5.5, 3.2, 8.5], look: [-1.5, 1.2, -0.5], fov: 46 },
    { f: 62, pos: [3.0, 2.0, 2.0], look: [-2.3, 0.7, -1.6], fov: 40, ease: 'surge' },
    { f: 133, pos: [1.6, 1.8, 1.6], look: [-2.3, 0.7, -1.6], fov: 38, ease: 'surge' },
  ],
  demand: [
    { f: 134, pos: [1.6, 1.8, 1.6], look: [-2.3, 0.7, -1.6], fov: 38 },
    { f: 179, pos: [2.6, 2.0, 3.6], look: [-0.9, 1.1, 0.2], fov: 40, ease: 'surge' },
    { f: 229, pos: [3.2, 2.2, 4.4], look: [-0.2, 1.0, 0.3], fov: 42 },
  ],
  argue: [
    { f: 230, pos: [3.2, 2.2, 4.4], look: [-0.2, 1.0, 0.3], fov: 42 },
    { f: 288, pos: [3.0, 2.1, 4.2], look: [-0.2, 1.0, 0.3], fov: 41, ease: 'surge' },
    { f: 367, pos: [2.4, 2.0, 3.6], look: [-0.2, 1.05, 0.3], fov: 40, ease: 'surge' },
    { f: 433, pos: [2.2, 2.0, 3.4], look: [-0.2, 1.0, 0.3], fov: 40 },
  ],
  market: [
    { f: 434, pos: [2.2, 2.0, 3.4], look: [-0.2, 1.0, 0.3], fov: 40 },
    { f: 483, pos: [5.5, 3.0, 7.5], look: [-0.5, 1.0, -0.5], fov: 44, ease: 'surge' },
    { f: 539, pos: [2.0, 2.6, 6.5], look: [-6, 1.2, -3.0], fov: 42, ease: 'surge' },
  ],
  court: [
    { f: 540, pos: [2.0, 2.6, 6.5], look: [-6, 1.2, -3.0], fov: 42 },
    { f: 585, pos: [-7.0, 3.0, 3.0], look: [-14.0, 1.2, -3.5], fov: 46, ease: 'surge' },
    { f: 614, pos: [-8.5, 3.0, 2.0], look: [-15.0, 1.2, -4.0], fov: 44, ease: 'surge' },
    { f: 683, pos: [-9.5, 2.8, 1.0], look: [-15.5, 1.2, -4.5], fov: 42 },
  ],
  coinsun: [
    { f: 684, pos: [-9.5, 2.8, 1.0], look: [-15.5, 1.2, -4.5], fov: 42 },
    { f: 723, pos: [-11.5, 2.3, -0.3], look: [-15.5, 1.3, -5.4], fov: 46, ease: 'surge' },
    { f: 779, pos: [-12.2, 2.1, -1.2], look: [-15.6, 1.4, -5.5], fov: 44, ease: 'surge' },
    { f: 816, pos: [-12.6, 2.0, -1.8], look: [-14.6, 0.6, -4.6], fov: 44, ease: 'surge' },
  ],
  verdict: [
    { f: 817, pos: [-12.6, 2.0, -1.8], look: [-14.6, 0.7, -4.8], fov: 44 },
    { f: 863, pos: [-12.8, 1.9, -1.3], look: [-14.5, 0.9, -4.7], fov: 44, ease: 'surge' },
    { f: 923, pos: [-13.0, 1.8, -1.0], look: [-13.3, 0.5, -4.3], fov: 44, ease: 'surge' },
    { f: 1010, pos: [-12.6, 2.0, -0.8], look: [-13.3, 0.8, -4.6], fov: 44, ease: 'surge' },
    { f: 1096, pos: [-12.8, 1.9, -1.0], look: [-15.3, 1.2, -5.4], fov: 44 },
    { f: 1128, pos: [-12.5, 1.9, -0.8], look: [-15.2, 1.2, -5.2], fov: 44 },
  ],
  laugh: [
    { f: 1129, pos: [-12.5, 1.9, -0.8], look: [-15.2, 1.2, -5.2], fov: 44 },
    { f: 1164, pos: [-11.5, 2.2, 1.0], look: [-16.0, 1.1, -4.0], fov: 40, ease: 'surge' },
    { f: 1196, pos: [-12.0, 2.1, 0.8], look: [-16.5, 1.0, -3.8], fov: 40, ease: 'surge' },
    { f: 1252, pos: [-8.5, 2.1, 2.2], look: [-8.0, 1.0, -1.4], fov: 40, ease: 'surge' },
  ],
  hook: [
    { f: 1253, pos: [-8.5, 2.1, 2.2], look: [-9.5, 1.0, -1.6], fov: 40 },
    { f: 1318, pos: [-11.0, 2.3, 1.8], look: [-13.5, 1.1, -3.0], fov: 40, ease: 'surge' },
    { f: 1414, pos: [-10.5, 2.2, 1.5], look: [-12.8, 1.0, -4.6], fov: 44, ease: 'surge' },
    { f: 1486, pos: [-7.0, 2.0, 2.8], look: [-13.4, 1.9, -3.0], fov: 36, ease: 'surge' },
    { f: 1556, pos: [-7.0, 2.0, 2.8], look: [-13.4, 2.0, -3.0], fov: 35, ease: 'surge' },
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
  const W = { boardTitle: 0, boardHook: 0, coinShadow: 0, scaleDip: 0, goldK: 0 };
  if (S.id === 'rent') W.boardTitle = 1 - smooth(ramp(f, 40, 46));
  if (S.id === 'coinsun') W.coinShadow = smooth(ramp(f, 780, 802));
  if (S.id === 'verdict') W.coinShadow = 1 - smooth(ramp(f, 1080, 1096));
  if (S.id === 'hook') {
    W.boardHook = smooth(ramp(f, 1489, 1513));
    W.scaleDip = f >= 1418 ? q(0.5 + 0.5 * Math.sin((f - 1418) * 0.12), 2) * 0.35 : 0;
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
const CROWD_COURT = [[-13.0, 0, 1.5], [-11.0, 0, -4.5], [-18.5, 0, -2.0], [-19.5, 0, -5.5]];
const crowdAt = (T, tint, f, spots, expr, yawBase = 0) => {
  const outs = [OUTFITS.crowd1, OUTFITS.crowd2, OUTFITS.crowd3, OUTFITS.crowd4];
  return spots.map((p, i) => RW(T, outs[i], { expr, mode: 'stand', blink: blinkAt(f, 71 + i), seed: 71 + i }, p, { tint, yaw: yawBase + (i % 2 ? 0.3 : -0.3) }));
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'rent': {
      // C1: traveller stands BESIDE his donkey (east of its head, screen-right
      // of the body — never in front of it, so the whole donkey stays
      // visible); C2 (f62+): he walks to the donkey's shadow and sits down
      // in it (foot-locked march, then sit). The march path passes north
      // of the donkey's head (z≈-1.3 at the head's x), clear of it.
      if (f < 62) out.push(st(OUTFITS.traveller, 'neutral', 51, [-0.9, 0, -0.1], { yaw: -0.5 }));
      else if (f < 107) {
        const p = kf3([[62, [-0.9, 0, -0.1]], [107, [-2.25, 0, -1.6]]], f);
        out.push(RW(T, OUTFITS.traveller, { expr: 'neutral', mode: 'march', phase: q(((f - 62) * 2.0 / 30 / 1.6) % 1, 3), blink: blinkAt(f, 51), seed: 51 }, p, { tint, yaw: -0.9 }));
      } else out.push(RW(T, OUTFITS.traveller, { expr: 'relief', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, [-2.25, 0, -1.6], { tint, yaw: -0.4 }));
      break;
    }
    case 'demand': {
      out.push(RW(T, OUTFITS.traveller, { expr: 'nervous', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, [-2.25, 0, -1.6], { tint, yaw: -0.4 }));
      const pk = f < 176 ? q(smooth(ramp(f, 133, 151)), 2) : q(1 - smooth(ramp(f, 205, 229)), 2);
      out.push(RW(T, OUTFITS.owner, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...(pk > 0.02 ? { prop: ['point', pk] } : {}) }, [-0.6, 0, 0.4], { tint, yaw: 0.5 }));
      break;
    }
    case 'argue': {
      out.push(st(OUTFITS.traveller, f < 332 ? 'nervous' : 'stern', 51, [0.2, 0, 0.2], { yaw: 0.6 }));
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
      out.push(st(OUTFITS.traveller, 'nervous', 51, [-15.2, 0, -3.4], { yaw: 0.4 }));
      out.push(st(OUTFITS.owner, 'stern', 52, [-13.2, 0, -4.6], { yaw: -0.4 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, 'neutral', 0.2));
      break;
    }
    case 'coinsun': {
      const ck = q(smooth(ramp(f, 723, 756)) * (1 - smooth(ramp(f, 802, 816))), 2);
      out.push(RW(T, OUTFITS.judge, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...(ck > 0.02 ? { prop: ['coin', ck] } : {}) }, JUDGEP, { tint, yaw: 0 }));
      out.push(RW(T, OUTFITS.traveller, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...(f >= 685 && f <= 723 ? { prop: ['coin', q(smooth(ramp(f, 685, 699)) * (1 - smooth(ramp(f, 709, 723))), 2)] } : {}) }, [-15.2, 0, -3.4], { tint, yaw: 0.4 }));
      out.push(st(OUTFITS.owner, 'nervous', 52, [-13.2, 0, -4.6], { yaw: -0.4 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, 'neutral', 0.2));
      break;
    }
    case 'verdict': {
      out.push(RW(T, OUTFITS.judge, { expr: f >= 1096 ? 'grin' : 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, JUDGEP, { tint, yaw: 0 }));
      out.push(st(OUTFITS.traveller, f >= 1096 ? 'relief' : 'nervous', 51, [-15.2, 0, -3.4], { yaw: 0.4 }));
      // C27: the owner reaches down and grabs nothing but air — deep bow.
      const rk = bowK(f, 864, 890, 915, 930);
      out.push(RW(T, OUTFITS.owner, { expr: f >= 923 && f < 1010 ? 'shock' : 'dazed', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...bowOpts(rk) }, BP([-13.2, 0, -4.6], rk), { tint, yaw: -0.4 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, f >= 1096 ? 'laugh' : 'neutral', 0.2));
      break;
    }
    case 'laugh': {
      out.push(st(OUTFITS.judge, 'grin', 41, JUDGEP, { yaw: 0 }));
      out.push(...crowdAt(T, tint, f, CROWD_COURT, 'laugh', 0.2));
      out.push(st(OUTFITS.owner, 'dazed', 52, [-13.2, 0, -4.6], { yaw: -0.4 }));
      // C33: the traveller climbs onto his donkey and rides away — free.
      if (f < 1172) out.push(st(OUTFITS.traveller, 'grin', 51, [-15.2, 0, -3.4], { yaw: 0.4 }));
      else {
        const dp = donkeyPosAt(f);
        const p = kf3([[1172, [-15.2, 0, -3.4]], [1196, [dp[0], 1.05, dp[2]]]], f);
        const riding = f >= 1196;
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
