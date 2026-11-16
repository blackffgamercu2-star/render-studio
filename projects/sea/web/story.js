// Shot plan for "The Man Who Promised to Drink the Sea" (batch-5 topic 4, EN) —
// timed to the ACTUAL voice stem (60.17 s, 30 fps, TOTAL 1805), clause
// timings from faster-whisper alignment (match_ratio 1.000, 234/234 tokens):
// C01 0-152 sailor's bet, drink the sea dry | C02 170-203 court roars |
// C03 218-261 king wipes tears | C04 275-389 Done: 100 gold or dungeon |
// C05 409-465 noon, city gathers at the shore | C06 481-579 water's edge:
// scoops ONE cup (f525-546), drinks it (f567-572) |
// C07 591-635 puts the cup down (f594-612), folds arms |
// C08 652-687 "Well? Drink!" | C09 706-721 sailor smiled |
// C10 741-805 stop the rivers | C11 805-898 rivers keep pouring in |
// C12 911-997 block every river, finish by sunset | C13 1019-1050 king stared |
// C14 1067-1204 SEVEN rivers (seven f1072-1081) | C15 1217-1249 no army |
// C16 1258-1288 no dam | C17 1302-1363 king laughed (f1307-1316), paid
// the hundred gold coins (paid f1329-1336, coins f1349-1363) |
// C18 1382-1445 won without another drop | C19 1459-1496 never promised to
// drink the sea | C20 1509-1586 promised to drink it DRY, rivers made it
// impossible | C21 1609-1678 farmer sold something bigger | C22 1678-1726
// sold the king the rain itself | C23 1751-1801 how do you sell rain that
// hasn't fallen yet? (board holds to f1804)
// QUALITY RULES: shots change ONLY at clause boundaries; camera TRACKS the
// voice-named subject (never frozen, never aimless drift); characters act in
// place (planted feet, no walk-glide); costumes by role. PHYSICS (2026-11-15):
// the CUP rests ON the sand, rises WITH the hand, lands exactly at its spot
// and stays; the gold POUCH is handed king->sailor with a weight dip, then
// set down ON the sand and stays; the seven rivers flow into the sea.
// World: palace court x=0 (facade z=-3.2, throne z=-2.2), shore x=+16
// (sand z -6..+4, sea z<-6, seven rivers x=13..19 flowing north into the sea).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1805, DECK = 0;
export const SHOTS = [
  { id: 'court', a: 0, b: 408, light: 'day' },
  { id: 'shore', a: 409, b: 650, light: 'day' },
  { id: 'demand', a: 651, b: 740, light: 'day' },
  { id: 'rivers', a: 741, b: 1050, light: 'day' },
  { id: 'seven', a: 1051, b: 1301, light: 'day' },
  { id: 'pay', a: 1302, b: 1586, light: 'day' },
  { id: 'hook', a: 1587, b: 1804, light: 'day' },
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
  if (S.id === 'hook') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 1650, 1804)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const THRONE = [0, 0, -2.2];
export const SAILC = [-1.05, 0, 0.75];          // sailor in court
export const KINGFRONT = [0.35, 0, -0.9];
export const TR = [2.35, 0, -0.2];
export const MATH = [-2.6, 0, -0.9];
export const SAIL = [16.0, 0, -2.2];            // sailor at the water's edge
export const KINGSH = [17.9, 0, -0.9];          // king at the shore
export const TRSH = [19.6, 0, -1.6];
export const CROWD1 = [13.0, 0, 2.6];
export const CROWD2 = [18.6, 0, 2.4];
export const CROWD3 = [19.4, 0, -0.2];
export const CROWD4 = [12.8, 0, -0.5];
export const FARMH = [14.6, 0, -0.6];           // farmer steps forward (hook)
export const CUPREST = [15.15, 0, -2.0];        // cup's resting spot ON the sand
export const POUCHREST = [15.5, 0, -1.55];      // pouch's resting spot ON the sand
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];

const HERO = {
  court: (f) => f < 210 ? [-1.05, 1.0, 0.75] : [0, 1.3, -1.55],
  shore: () => [16.0, 1.1, -2.2],
  demand: (f) => f < 700 ? [17.9, 1.3, -0.9] : [16.0, 1.1, -2.2],
  rivers: () => [16.0, 0.8, -4.0],
  seven: () => [16.0, 2.2, -4.0],
  pay: () => [16.35, 0.9, -2.05],
  hook: (f) => f < 1751 ? [14.6, 1.05, -0.6] : [16.0, 3.85, -4.25],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject.
const CAMS = {
  court: [
    { f: 0, pos: [8.6, 3.8, 12.6], look: [0, 2.4, -3.0], fov: 46 },
    { f: 55, pos: [5.2, 2.7, 7.2], look: [0, 2.3, -2.9], fov: 43, ease: 'surge' },
    { f: 150, pos: [3.6, 2.1, 5.4], look: [-0.4, 1.3, -1.4], fov: 40, ease: 'surge' },
    { f: 210, pos: [2.4, 1.9, 3.6], look: [0, 1.3, -1.8], fov: 38, ease: 'surge' },
    { f: 300, pos: [2.5, 2.1, 3.9], look: [0.35, 0.95, 0.1], fov: 38, ease: 'surge' },
    { f: 408, pos: [2.6, 2.2, 4.1], look: [0.4, 0.9, 0.2], fov: 38 },
  ],
  shore: [
    { f: 409, pos: [2.6, 2.2, 4.1], look: [0.4, 0.9, 0.2], fov: 38 },
    { f: 470, pos: [8.5, 2.8, 7.0], look: [12.5, 1.2, -1.5], fov: 42, ease: 'surge' },
    { f: 520, pos: [13.6, 2.3, 4.6], look: [16, 1.2, -2.2], fov: 40, ease: 'surge' },
    { f: 579, pos: [14.7, 1.7, 2.4], look: [15.95, 1.25, -2.2], fov: 36, ease: 'surge' },
    { f: 615, pos: [14.9, 1.6, 2.2], look: [15.4, 0.55, -2.05], fov: 35, ease: 'surge' },
    { f: 650, pos: [15.3, 1.9, 3.1], look: [16, 1.0, -2.0], fov: 37 },
  ],
  demand: [
    { f: 651, pos: [15.3, 1.9, 3.1], look: [16, 1.0, -2.0], fov: 37 },
    { f: 672, pos: [17.4, 1.9, 2.6], look: [17.85, 1.25, -0.95], fov: 37, ease: 'surge' },
    { f: 706, pos: [16.6, 1.7, 2.4], look: [16, 1.3, -2.2], fov: 36, ease: 'surge' },
    { f: 740, pos: [16.4, 1.75, 2.6], look: [16, 1.25, -2.1], fov: 36 },
  ],
  rivers: [
    { f: 741, pos: [16.4, 1.75, 2.6], look: [16, 1.25, -2.1], fov: 36 },
    { f: 800, pos: [14.2, 3.0, 7.2], look: [16, 0.9, -4.0], fov: 42, ease: 'surge' },
    { f: 900, pos: [14.8, 2.9, 6.6], look: [16, 0.7, -4.6], fov: 42, ease: 'surge' },
    { f: 997, pos: [15.4, 2.6, 5.6], look: [16, 0.9, -4.2], fov: 41, ease: 'surge' },
    { f: 1050, pos: [15.8, 2.4, 5.0], look: [16.6, 1.1, -2.6], fov: 40 },
  ],
  seven: [
    { f: 1051, pos: [15.8, 2.4, 5.0], look: [16.6, 1.1, -2.6], fov: 40 },
    { f: 1090, pos: [12.6, 2.7, 6.6], look: [16, 2.1, -4.0], fov: 42, ease: 'surge' },
    { f: 1160, pos: [14.2, 2.6, 5.8], look: [16, 1.6, -4.0], fov: 41, ease: 'surge' },
    { f: 1217, pos: [15.6, 2.2, 4.4], look: [16, 1.0, -2.8], fov: 40, ease: 'surge' },
    { f: 1301, pos: [15.9, 2.1, 4.2], look: [16.1, 1.0, -2.5], fov: 40 },
  ],
  pay: [
    { f: 1302, pos: [15.9, 2.1, 4.2], look: [16.1, 1.0, -2.5], fov: 40 },
    { f: 1325, pos: [17.6, 2.3, 4.0], look: [17.7, 1.2, -1.0], fov: 38, ease: 'surge' },
    { f: 1363, pos: [16.8, 2.2, 3.8], look: [16.9, 1.0, -1.6], fov: 40, ease: 'surge' },
    { f: 1445, pos: [16.0, 2.1, 3.6], look: [16, 1.0, -2.0], fov: 38, ease: 'surge' },
    { f: 1586, pos: [15.9, 2.0, 3.3], look: [16, 1.1, -2.1], fov: 37 },
  ],
  hook: [
    { f: 1587, pos: [15.9, 2.0, 3.3], look: [16, 1.1, -2.1], fov: 37 },
    { f: 1640, pos: [14.9, 2.1, 4.2], look: [14.7, 1.2, -0.6], fov: 38, ease: 'surge' },
    { f: 1726, pos: [15.1, 2.2, 4.8], look: [15.2, 1.6, -1.6], fov: 39, ease: 'surge' },
    { f: 1751, pos: [15.0, 2.5, 6.6], look: [16, 3.2, -4.25], fov: 42, ease: 'surge' },
    { f: 1804, pos: [15.0, 2.5, 6.6], look: [16, 3.2, -4.25], fov: 42 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (S.id === 'shore' && f >= 520 && f <= 650) cinf = 3.2;
  if (S.id === 'pay' && f >= 1320 && f <= 1420) cinf = 3.4;
  if (S.id === 'hook' && f >= 1751) cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardSeven: 0, boardHook: 0, drinkK: 0, pointK: 0, kingPointK: 0, payPointK: 0 };
  if (S.id === 'court') W.boardTitle = 1 - smooth(ramp(f, 58, 78));   // fade while the camera is still wide on the board
  if (S.id === 'seven') W.boardSeven = smooth(ramp(f, 1088, 1105)) * (1 - smooth(ramp(f, 1160, 1178)));   // only while the camera holds the board fully in frame
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1751, 1771));   // NO fade-out: holds 1.0 to the last frame
  // the drink: arm rises as he scoops (f520-545), cup at the mouth f545-575,
  // arm lowers f575-600 as the cup goes back down to the sand.
  if (S.id === 'shore') W.drinkK = smooth(ramp(f, 520, 545)) * (1 - smooth(ramp(f, 575, 600)));
  // sailor points at the rivers while he names them
  if (S.id === 'rivers') W.pointK = smooth(ramp(f, 741, 770)) * (1 - smooth(ramp(f, 1010, 1040)));
  if (S.id === 'seven') W.pointK = smooth(ramp(f, 1051, 1075)) * (1 - smooth(ramp(f, 1100, 1130)));
  if (S.id === 'demand') W.kingPointK = smooth(ramp(f, 652, 670)) * (1 - smooth(ramp(f, 700, 730)));
  if (S.id === 'pay') W.payPointK = smooth(ramp(f, 1302, 1320)) * (1 - smooth(ramp(f, 1360, 1390)));
  return W;
};
// THE CUP — physics: rests ON the sand at CUPREST; rises WITH the hand
// (f520-545 scoop, mouth f545-575 with a tip, lowers f575-600), lands back
// exactly on its spot f600-615 and STAYS. Never floats, never slides.
export const cupAt = (f) => {
  const rest = [...CUPREST], hand = [15.8, 0.95, -2.1], mouth = [16.0, 1.42, -2.05];
  let p, tilt = 0;
  if (f < 520) p = rest;
  else if (f < 545) p = lerp3(rest, hand, smooth(ramp(f, 520, 545)));
  else if (f < 575) { p = lerp3(hand, mouth, smooth(ramp(f, 545, 575))); tilt = 0.9 * smooth(ramp(f, 555, 575)); }
  else if (f < 600) { p = lerp3(mouth, hand, smooth(ramp(f, 575, 600))); tilt = 0.9 * (1 - smooth(ramp(f, 575, 600))); }
  else if (f < 615) p = lerp3(hand, rest, smooth(ramp(f, 600, 615)));
  else p = rest;
  return { p, tilt, s: 1 };
};
// THE GOLD POUCH — king's hand (f1302-1320) -> sailor's hands (f1320-1363,
// "paid ... gold coins") with a small weight dip as the sailor takes it
// (f1370-1400), then set down ON the sand f1400-1420 and STAYS.
export const pouchAt = (f) => {
  if (f < 1302) return null;
  let p;
  if (f < 1320) p = [17.55, 0.5, -0.95];
  else if (f < 1363) p = lerp3([17.55, 0.5, -0.95], [16.35, 0.62, -2.05], smooth(ramp(f, 1320, 1363)));
  else if (f < 1400) p = [16.35, 0.62 - 0.03 * smooth(ramp(f, 1370, 1400)), -2.05];
  else if (f < 1420) p = lerp3([16.35, 0.59, -2.05], [...POUCHREST], smooth(ramp(f, 1400, 1420)));
  else p = [...POUCHREST];
  return { p, s: 0.9 };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.3, dustRate: (S.id === 'court' ? 0.08 : 0.22), splashRate: 0 };
};

// ---------- flying birds (distant birds, ambience only) ----------
const circleAt = (f, i, cx, cz, r = 6, h = 9.5) => {
  const a = f * 0.008 + i * 0.9;
  return { p: [cx + r * Math.cos(a), h + Math.sin(f * 0.05 + i) * 0.8, cz + r * Math.sin(a)], yaw: a + Math.PI / 2, flap: f * 0.9 + i * 1.7, s: 1 };
};
export const flyCrowsAt = (f) => {
  const S = shotAt(f);
  const cx = S.id === 'court' ? 0 : 16;
  const out = [];
  for (let i = 0; i < 7; i++) out.push(circleAt(f, i, cx, -3, 5, 10));
  return out;
};

// ---------- actors ----------
const TINT = { day: '#ffffff', dusk: '#ffd9a3' };
const tintFor = (S, f) => S.id === 'hook' && f > 1700 ? TINT.dusk : TINT.day;
// COSTUMES BY ROLE — king: crimson royal robe + gold crown. Sailor: navy
// jacket, white trousers, white sailor cap, sun-tanned skin. Treasurer: teal
// court robe + turban. Mathematician: plum robe, grey hair + grey moustache.
// Crowd: plain tunics. Farmer: worn beige + dull cap.
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  sailor: { jacket: '#1e4a6e', pants: '#e8e4d8', boots: '#3a2a1a', hat: 'cap', cap: '#eef2f5', skin: '#c98a5a' },
  treasurer: { jacket: '#2e6e5a', pants: '#223d33', boots: '#2e2118', hat: 'turban', skin: '#e8b08a', dress: '#2e6e5a' },
  mathematician: { jacket: '#4a3a5e', pants: '#2e2438', boots: '#241a12', hat: 'hair', hair: '#cfc8bd', moustache: '#cfc8bd', skin: '#eed9bd', dress: '#4a3a5e' },
  servant1: { jacket: '#9a8a72', pants: '#5e4f3a', boots: '#4a3a28', hat: 'cap', cap: '#6e5a41', skin: '#c98a5a' },
  servant2: { jacket: '#8a7a64', pants: '#54482f', boots: '#4a3a28', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  gardener: { jacket: '#5d7048', pants: '#54482f', boots: '#4a3a28', hat: 'cap', cap: '#4a5a38', skin: '#c98a5a' },
  farmer: { jacket: '#8a6f4d', pants: '#6e5a41', boots: '#4a3a28', hat: 'cap', cap: '#7a6248', skin: '#c98a5a' },
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
  const W = worldAt(f);
  const kingSit = (expr, seed = 31, extra = {}) => RW(T, OUTFITS.king, { expr, mode: 'sit', blink: blinkAt(f, seed), seed }, [...THRONE], { tint, yaw: 0, ...extra });
  const guards = (glExpr = 'stern', grExpr = 'stern') => {
    out.push(st(OUTFITS.guardL, glExpr, 61, GLP, { yaw: 0.15 }));
    out.push(st(OUTFITS.guardR, grExpr, 62, GRP, { yaw: -0.15 }));
  };
  const sailorBow = (a, b, c, d, expr = 'neutral', extra = {}) => {
    const k = bowK(f, a, b, c, d);
    return RW(T, OUTFITS.sailor, { expr, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...bowOpts(k) }, BP(SAILC, k), { tint, yaw: 0.45, ...extra });
  };
  switch (S.id) {
    case 'court': {
      if (f < 275) out.push(kingSit(f < 170 ? 'stern' : (f < 262 ? 'laugh' : 'grin')));
      else {
        const pk = ptK(f, 285, 305, 360, 389);
        out.push(RW(T, OUTFITS.king, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', pk] }, [0, 0, -1.55], { tint, yaw: 0.1 }));
      }
      if (f < 60) out.push(sailorBow(18, 48, 52, 58, 'neutral'));
      else {
        const pk = ptK(f, 110, 130, 140, 155);
        out.push(RW(T, OUTFITS.sailor, { expr: f < 275 ? 'neutral' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', pk] }, SAILC, { tint, yaw: 0.45 }));
      }
      out.push(st(OUTFITS.treasurer, f < 170 ? 'neutral' : 'grin', 51, TR, { yaw: -0.25 }));
      out.push(st(OUTFITS.mathematician, 'neutral', 52, MATH, { yaw: 0.25 }));
      guards(f < 170 ? 'stern' : 'grin', f < 170 ? 'stern' : 'grin');
      break;
    }
    case 'shore': {
      out.push(RW(T, OUTFITS.sailor, { expr: f < 579 ? 'neutral' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['cup', q(W.drinkK, 2)] }, SAIL, { tint, yaw: 0.45 }));
      out.push(st(OUTFITS.king, 'stern', 31, KINGSH, { yaw: -0.35 }));
      out.push(st(OUTFITS.treasurer, 'neutral', 51, TRSH, { yaw: -0.3 }));
      out.push(st(OUTFITS.servant1, 'neutral', 71, CROWD1, { yaw: 0.4 }));
      out.push(st(OUTFITS.servant2, 'neutral', 72, CROWD2, { yaw: -0.3 }));
      out.push(st(OUTFITS.gardener, 'neutral', 81, CROWD3, { yaw: -0.5 }));
      out.push(st(OUTFITS.farmer, 'neutral', 82, CROWD4, { yaw: 0.5 }));
      break;
    }
    case 'demand': {
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', q(W.kingPointK, 2)] }, KINGSH, { tint, yaw: -0.35 }));
      out.push(st(OUTFITS.sailor, 'smile', 41, SAIL, { yaw: 0.45 }));
      out.push(st(OUTFITS.treasurer, 'nervous', 51, TRSH, { yaw: -0.3 }));
      out.push(st(OUTFITS.servant1, 'neutral', 71, CROWD1, { yaw: 0.4 }));
      break;
    }
    case 'rivers': {
      out.push(RW(T, OUTFITS.sailor, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', q(W.pointK, 2)] }, SAIL, { tint, yaw: 0.45 }));
      out.push(st(OUTFITS.king, 'stern', 31, KINGSH, { yaw: -0.35 }));
      out.push(st(OUTFITS.treasurer, 'nervous', 51, TRSH, { yaw: -0.3 }));
      out.push(st(OUTFITS.servant1, 'neutral', 71, CROWD1, { yaw: 0.4 }));
      out.push(st(OUTFITS.servant2, 'neutral', 72, CROWD2, { yaw: -0.3 }));
      break;
    }
    case 'seven': {
      out.push(RW(T, OUTFITS.sailor, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', q(W.pointK, 2)] }, SAIL, { tint, yaw: 0.45 }));
      out.push(st(OUTFITS.king, f < 1217 ? 'stern' : 'shock', 31, KINGSH, { yaw: -0.35 }));
      out.push(st(OUTFITS.treasurer, 'dazed', 51, TRSH, { yaw: -0.3 }));
      out.push(st(OUTFITS.servant1, 'dazed', 71, CROWD1, { yaw: 0.4 }));
      out.push(st(OUTFITS.servant2, 'dazed', 72, CROWD2, { yaw: -0.3 }));
      break;
    }
    case 'pay': {
      const kp = q(W.payPointK, 2);
      out.push(RW(T, OUTFITS.king, { expr: f < 1320 ? 'laugh' : 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', kp] }, KINGSH, { tint, yaw: -0.35 }));
      out.push(st(OUTFITS.sailor, f < 1363 ? 'neutral' : 'relief', 41, SAIL, { yaw: 0.45 }));
      out.push(st(OUTFITS.treasurer, 'smile', 51, TRSH, { yaw: -0.3 }));
      out.push(st(OUTFITS.servant1, 'smile', 71, CROWD1, { yaw: 0.4 }));
      break;
    }
    case 'hook': {
      out.push(st(OUTFITS.farmer, f < 1726 ? 'nervous' : 'dazed', 82, FARMH, { yaw: 0.5 }));
      out.push(st(OUTFITS.king, 'stern', 31, KINGSH, { yaw: -0.35 }));
      out.push(st(OUTFITS.sailor, 'smile', 41, SAIL, { yaw: 0.45 }));
      out.push(st(OUTFITS.treasurer, 'neutral', 51, TRSH, { yaw: -0.3 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
