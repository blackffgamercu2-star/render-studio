// Shot plan for "वो बर्तन जिसने बच्चे को जन्म दिया" (batch-3 topic 2, HI) —
// timed to the ACTUAL Hindi voice stem (61.13 s, 30 fps, TOTAL 1834), clause
// timings from faster-whisper alignment (pot-hindi-voice/words.json +
// timing.json, 259 words mapped 1:1 in script order):
// L1 0-219 borrowed pot, tiny pot, "gave birth", believed | L2a 219-297 big
// copper pot for a wedding | L2b 297-358 lent the finest pot | L2c 358-460
// returned it, small pot beside it | L3 460-507 "यह क्या है?" | L4a 507-531
// "खुशख़बरी!" | L4b 531-590 "माँ बन गया" | L4c 590-631 "छोटा वाला भी
// तुम्हारा ही है" | L5a 631-673 laughed | L5b 673-710 "जन्म देने वाला
// बर्तन!" | L5c 710-779 kept baby pot like a treasure | L6a 779-847 came
// again, smiling | L6b 847-919 "सोने का बर्तन उधार ले सकता हूँ?" | L6c
// 919-943 "बस एक दिन के लिए" | L7 943-989 handed it over happily |
// L8a 989-1043 empty-handed | L8b 1043-1072 "मुझे अफ़सोस है" | L8c
// 1072-1121 "सोने का बर्तन... मर गया" | L9a 1121-1148 "मर गया?" | L9b
// 1148-1174 neighbour shouted | L9c 1174-1214 "बर्तन कभी मरते हैं?" |
// L10a 1214-1262 "अगर बर्तन जन्म दे सकता है" | L10b 1262-1295 "तो बर्तन मर
// भी सकता है" | L11a 1295-1330 went to the judge | L11b 1330-1372 judge
// smiled | L11c 1372-1399 "यह सही कह रहा है" | L11d 1399-1456 "बच्चे वाला
// बर्तन मान लिया" | L11e 1456-1490 "मौत भी माननी होगी" | L11f 1490-1516
// "फ़ैसला हो गया" | L12a 1516-1595 rented a donkey | L12b 1595-1655 sat in
// its shadow | L12c 1655-1706 owner pointed at the ground | L12d
// 1706-1763 "यह छाँव मेरी है। इसकी कीमत दो।" | L12e 1763-1833 "भला छाँव
// की कीमत कैसे चुकाई जाती है?"
// QUALITY RULES (owner, batch-3): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — no walk-glide; costumes by role (simple
// village clothes; judge = robe + white turban); hero pots BIG in frame.
// World: neighbour's courtyard x=0 (house facade z=-3.2, pot shelf),
// wedding pavilion x=-16, borrower's hut x=+16, judge's court x=+32,
// donkey roadside x=-32 (tree + signpost board).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1834, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 219, light: 'day' },
  { id: 'wedding', a: 220, b: 358, light: 'day' },
  { id: 'return', a: 359, b: 460, light: 'day' },
  { id: 'baby', a: 461, b: 779, light: 'day' },
  { id: 'borrow', a: 780, b: 989, light: 'day' },
  { id: 'empty', a: 990, b: 1295, light: 'dusk' },
  { id: 'judge', a: 1296, b: 1516, light: 'day' },
  { id: 'hook2', a: 1517, b: 1833, light: 'day' },
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
  if (S.id === 'empty') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 990, 1055)));
  if (S.id === 'judge') return blendLight(LIGHTS.dusk, LIGHTS.day, smooth(ramp(f, 1296, 1365)));
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
export const DONKEY = [-32, 0, -2.5];
export const SIGNP = [-32, 3.4, -2.0];    // hook board on its signpost

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
// FIX vs EN (f0420): the return-shot close-up cut the borrower half out of
// frame — the Hindi return keys pull back and centre on x=0 so BOTH men
// and both pots stay fully in frame.
const CAMS = {
  hook: [
    { f: 0, pos: [7.5, 3.6, 11.0], look: [0, 1.8, -2.6], fov: 46 },
    { f: 60, pos: [4.2, 2.4, 5.6], look: [0.3, 1.3, -2.2], fov: 42, ease: 'surge' },
    { f: 118, pos: [2.6, 1.9, 3.8], look: [0.7, 1.0, -1.9], fov: 38, ease: 'surge' },
    { f: 169, pos: [2.3, 1.8, 3.4], look: [0.7, 1.0, -1.9], fov: 37, ease: 'surge' },
    { f: 219, pos: [2.2, 1.75, 3.2], look: [0.7, 1.0, -1.9], fov: 36, ease: 'surge' },
  ],
  wedding: [
    { f: 220, pos: [2.2, 1.75, 3.2], look: [0.7, 1.0, -1.9], fov: 36 },
    { f: 260, pos: [-11, 2.2, 3.5], look: [-16, 1.4, -3.8], fov: 40, ease: 'surge' },
    { f: 297, pos: [-13.1, 2.1, 2.3], look: [-15.2, 1.15, -2.9], fov: 40, ease: 'surge' },
    { f: 358, pos: [-13.3, 2.05, 2.0], look: [-15.2, 1.1, -2.9], fov: 39, ease: 'surge' },
  ],
  return: [
    { f: 359, pos: [-13.8, 1.85, 1.2], look: [-16, 1.1, -3.5], fov: 36 },
    { f: 395, pos: [4.6, 2.3, 6.0], look: [0, 1.2, -1.8], fov: 42, ease: 'surge' },
    { f: 415, pos: [3.4, 2.0, 4.6], look: [0, 1.25, -1.7], fov: 39, ease: 'surge' },
    { f: 460, pos: [3.2, 1.95, 4.3], look: [0, 1.2, -1.7], fov: 38, ease: 'surge' },
  ],
  baby: [
    { f: 461, pos: [3.2, 1.95, 4.3], look: [0, 1.2, -1.7], fov: 38 },
    { f: 485, pos: [3.5, 2.2, 6.5], look: [0, 2.2, -2.8], fov: 44, ease: 'surge' },
    { f: 531, pos: [3.4, 2.15, 6.3], look: [0, 2.3, -2.8], fov: 43, ease: 'surge' },
    { f: 561, pos: [3.35, 2.12, 6.2], look: [0, 2.28, -2.8], fov: 43, ease: 'surge' },
    { f: 590, pos: [2.6, 1.8, 3.6], look: [-0.7, 1.1, -1.7], fov: 38, ease: 'surge' },
    { f: 631, pos: [2.5, 1.8, 3.5], look: [-0.7, 1.05, -1.7], fov: 37, ease: 'surge' },
    { f: 673, pos: [2.45, 1.78, 3.4], look: [-0.7, 1.05, -1.7], fov: 37, ease: 'surge' },
    { f: 710, pos: [2.4, 1.75, 3.3], look: [-0.7, 1.05, -1.7], fov: 37, ease: 'surge' },
    { f: 779, pos: [2.4, 1.75, 3.3], look: [-0.7, 1.05, -1.7], fov: 37, ease: 'surge' },
  ],
  borrow: [
    { f: 780, pos: [2.4, 1.75, 3.3], look: [-0.7, 1.05, -1.7], fov: 37 },
    { f: 820, pos: [3.2, 2.3, 6.2], look: [0, 2.3, -2.8], fov: 44, ease: 'surge' },
    { f: 847, pos: [3.1, 2.25, 6.0], look: [0, 2.25, -2.8], fov: 43, ease: 'surge' },
    { f: 919, pos: [4.6, 2.3, 6.2], look: [0.2, 1.25, -1.9], fov: 42, ease: 'surge' },
    { f: 943, pos: [2.6, 2.2, 6.4], look: [0.1, 1.2, -1.8], fov: 42, ease: 'surge' },
    { f: 989, pos: [2.4, 2.1, 6.1], look: [0.1, 1.2, -1.8], fov: 41, ease: 'surge' },
  ],
  empty: [
    { f: 990, pos: [2.5, 1.8, 3.6], look: [-0.5, 1.1, -1.8], fov: 37 },
    { f: 1043, pos: [3.0, 2.0, 4.8], look: [0.5, 1.1, -1.6], fov: 39, ease: 'surge' },
    { f: 1072, pos: [3.4, 2.3, 6.3], look: [0, 2.3, -2.8], fov: 44, ease: 'surge' },
    { f: 1121, pos: [3.2, 2.2, 6.0], look: [0, 2.2, -2.8], fov: 43, ease: 'surge' },
    { f: 1148, pos: [2.7, 1.8, 3.5], look: [-0.8, 1.2, -1.7], fov: 37, ease: 'surge' },
    { f: 1174, pos: [2.7, 1.8, 3.5], look: [-0.8, 1.2, -1.7], fov: 37, ease: 'surge' },
    { f: 1214, pos: [2.7, 1.8, 3.5], look: [-0.8, 1.15, -1.7], fov: 37, ease: 'surge' },
    { f: 1262, pos: [2.6, 1.75, 3.3], look: [-0.8, 1.15, -1.7], fov: 36, ease: 'surge' },
    { f: 1295, pos: [2.6, 1.75, 3.3], look: [-0.8, 1.15, -1.7], fov: 36, ease: 'surge' },
  ],
  judge: [
    { f: 1296, pos: [2.6, 1.75, 3.3], look: [-0.8, 1.15, -1.7], fov: 36 },
    { f: 1330, pos: [26, 2.4, 5.5], look: [32, 1.5, -3.5], fov: 40, ease: 'surge' },
    { f: 1372, pos: [28.6, 2.7, 4.2], look: [32, 1.3, -4.0], fov: 44, ease: 'surge' },
    { f: 1399, pos: [28.8, 2.6, 3.9], look: [32, 1.3, -4.0], fov: 43, ease: 'surge' },
    { f: 1456, pos: [29.0, 2.55, 3.6], look: [32, 1.3, -4.0], fov: 42, ease: 'surge' },
    { f: 1490, pos: [29.1, 2.5, 3.4], look: [32, 1.3, -4.0], fov: 42, ease: 'surge' },
    { f: 1516, pos: [29.2, 2.5, 3.3], look: [32, 1.3, -4.0], fov: 41, ease: 'surge' },
  ],
  hook2: [
    { f: 1517, pos: [29.2, 2.5, 3.3], look: [32, 1.3, -4.0], fov: 41 },
    { f: 1595, pos: [10, 4.0, 9.0], look: [-20, 1.5, -3], fov: 42, ease: 'surge' },
    { f: 1655, pos: [-24, 3.2, 6.5], look: [-32, 1.2, -1.8], fov: 42, ease: 'surge' },
    { f: 1706, pos: [-24.5, 3.0, 6.0], look: [-32, 1.2, -1.8], fov: 41, ease: 'surge' },
    { f: 1763, pos: [-28.0, 2.3, 3.8], look: [-32, 2.6, -2.0], fov: 40, ease: 'surge' },
    { f: 1833, pos: [-28.2, 2.25, 3.4], look: [-32, 2.9, -2.0], fov: 36, ease: 'surge' },
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
  if (S.id === 'baby') W.boardBirth = smooth(ramp(f, 531, 543)) * (1 - smooth(ramp(f, 548, 560)));
  if (S.id === 'borrow') W.boardVessel = smooth(ramp(f, 847, 859)) * (1 - smooth(ramp(f, 907, 919)));
  if (S.id === 'empty') W.boardDied = smooth(ramp(f, 1072, 1084)) * (1 - smooth(ramp(f, 1109, 1121)));
  if (S.id === 'hook2') W.boardHook = smooth(ramp(f, 1763, 1775));   // holds to the last frame — NO fade-out
  W.potBabyK = 1 - smooth(ramp(f, 710, 718));   // neighbour picks the baby pot up like a treasure
  W.vesselK = 1 - smooth(ramp(f, 943, 955));    // golden vessel leaves the shelf when handed over
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
      out.push(st(OUTFITS.neighbour, f < 184 ? 'neutral' : 'grin', 52, [-0.9, 0, -1.6], { yaw: -0.35 }));
      break;
    }
    case 'wedding': {
      out.push(st(OUTFITS.borrower, 'grin', 51, [-14.4, 0, -2.3], { yaw: -0.3 }));
      out.push(st(OUTFITS.neighbour, 'grin', 52, [-17.0, 0, -2.4], { yaw: 0.3 }));
      out.push(st(OUTFITS.guest, 'smile', 53, [-17.8, 0, -3.0], { yaw: 0.15 }));
      break;
    }
    case 'return': {
      const k = q(0.9 * smooth(ramp(f, 375, 405)), 2);
      out.push(RW(T, OUTFITS.borrower, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['pot', k] }, [0.9, 0, -1.2], { tint, yaw: 0.35 }));
      out.push(st(OUTFITS.neighbour, 'neutral', 52, [-0.9, 0, -1.6], { yaw: -0.35 }));
      break;
    }
    case 'baby': {
      const point = f < 590 ? { prop: ['point', 1] } : {};
      out.push(RW(T, OUTFITS.borrower, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...point }, [0.9, 0, -1.2], { tint, yaw: 0.35 }));
      const nExpr = f < 507 ? 'neutral' : f < 631 ? 'shock' : 'laugh';
      const nProp = f >= 710 ? { prop: ['babypot', 0.95] } : {};
      out.push(RW(T, OUTFITS.neighbour, { expr: nExpr, mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...nProp }, [-0.9, 0, -1.6], { tint, yaw: -0.35 }));
      break;
    }
    case 'borrow': {
      out.push(st(OUTFITS.borrower, f < 919 ? 'nervous' : 'grin', 51, [0.9, 0, -1.2], { yaw: 0.35 }));
      const nProp = f >= 943 ? { prop: ['vessel', 0.9] } : {};
      out.push(RW(T, OUTFITS.neighbour, { expr: f < 943 ? 'neutral' : 'grin', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...nProp }, [-0.9, 0, -1.6], { tint, yaw: -0.35 }));
      break;
    }
    case 'empty': {
      out.push(st(OUTFITS.borrower, f < 1043 ? 'nervous' : 'pained', 51, [0.9, 0, -1.2], { yaw: 0.35 }));
      out.push(st(OUTFITS.neighbour, f < 1121 ? 'stern' : 'shock', 52, [-0.9, 0, -1.6], { yaw: -0.35 }));
      break;
    }
    case 'judge': {
      // men flank the judge ON the dais (y=0.22 step top) — the old staging
      // put the borrower on the sightline and hid the judge behind him.
      out.push(st(OUTFITS.judge, f < 1330 ? 'neutral' : 'smile', 71, [32, 0.22, -4.0], { yaw: 0 }));
      out.push(st(OUTFITS.borrower, 'grin', 51, [30.6, 0.22, -3.6], { yaw: 0.3 }));
      out.push(st(OUTFITS.neighbour, f < 1490 ? 'neutral' : 'dazed', 52, [33.4, 0.22, -3.6], { yaw: -0.3 }));
      break;
    }
    case 'hook2': {
      out.push(donkey(T, tint, DONKEY, { yaw: 0.2 }));
      out.push(RW(T, OUTFITS.traveller, { expr: f < 1706 ? 'neutral' : 'nervous', mode: 'sit', blink: blinkAt(f, 81), seed: 81 }, [-30.6, 0, -1.2], { tint, yaw: 0.4 }));
      const oProp = f >= 1655 ? { prop: ['point', 1] } : {};
      out.push(RW(T, OUTFITS.owner, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 82), seed: 82, ...oProp }, [-33.6, 0, -0.6], { tint, yaw: -0.4 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  // gold glint burst as the neighbour lifts the baby pot like a treasure
  if (f >= 710 && f <= 726) out.push({ key: 'gold_' + q((f - 710) / 16, 2), draw: (p) => T.fxBurst(p, q((f - 710) / 16, 2), '#ffe066', 9, 26, 140), x: POTBABY[0], y: 0.9, z: POTBABY[2], blob: false, shadow: false });
  return out;
};
