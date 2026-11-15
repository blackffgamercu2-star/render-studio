// Shot plan for "वो आदमी जिसने राजा को चाँद बेच दिया" (batch-4 topic 1, HI) —
// timed to the ACTUAL Hindi voice stem (57.851 s, 30 fps, TOTAL 1736).
// Clause timings from faster-whisper (small, hi) word timestamps on the
// stem itself (moon-hindi-voice/words.json); the full pass dropped
// 10.92–14.62 s (C04 tail + C05), filled by a sample-cut slice
// transcribe (words_gap.json) — C05 starts at आज, 13.12 s → f394.
// QUALITY RULES (owner, batch-2/3/4): shots change ONLY at clause
// boundaries; camera TRACKS the voice-named subject every beat
// (biggest/centred), never freezes, never drifts; characters act in
// place — no walk-glide; costumes by role (king = crown + royal robe,
// trickster = clever commoner's worn clothes).
// PHYSICS RULES (Abid 2026-11-15, TOP priority): every prop rests flush
// ON its surface with contact — the coin bag and the signed paper sit ON
// the stone ledge by the well (they only appear/disappear at shot cuts);
// the bucket lowers on its rope until its bottom MEETS the water
// (bucketY 0.87 → bottom exactly at the 0.72 water surface), settles,
// and lifts again WITH water inside; falls accelerate (easeIn), land
// and STOP. Nothing floats, nothing detaches.
// World: palace court x=0 (facade z=-3.2, throne z=-2.2), moon well
// x=+16 — the whole trick plays at the well; the court appears once,
// for the "पूरे दरबार को बताना" beat.
// C01 0-112 एक चतुर ठग ने राजा को उसी का चाँद बेच दिया — पचास सोने के सिक्कों में।
// C02 113-186 और राजा कभी पैसे वापस माँग ही नहीं सका।
// C03 187-301 एक चाँदनी रात, वह राजा को महल के कुएँ पास ले गया और नीचे इशारा किया।
// C04 302-393 "वहाँ देखिए, महाराज — चाँद ख़ुद आपके कुएँ में गिरा पड़ा है।"
// C05 394-438 "आज रात यह उसी का होगा जो इसे ख़रीद ले।"
// C06 439-537 राजा पानी में चमकती गोल थाली को घूरता रहा।
// C07 538-560 "कितने में?"
// C08 561-595 "पचास सोने के सिक्के।"
// C09 596-681 "और इस काग़ज़ पर दस्तख़त कर दीजिए — इस कुएँ का चाँद आपका।"
// C10 682-745 राजा ने पैसे दिए और बच्चे की तरह सो गया।
// C11 746-825 लेकिन सुबह होते ही वह कुएँ की ओर दौड़ा — पानी ख़ाली था!
// C12 826-891 उसने ठग को कॉलर से खींचा। "मेरा चाँद कहाँ है?!"
// C13 892-972 ठग झुककर बोला, "आपने रात का चाँद ख़रीदा है, महाराज।"
// C14 973-1057 "वह कुएँ में सिर्फ़ अंधेरे के बाद आता है। आज रात देख लीजिए।"
// C15 1058-1134 उस रात फिर वही थाली चमक उठी। राजा मुस्कुराया —
// C16 1135-1194 और अपना चाँद निकालने के लिए बाल्टी उठा ली।
// C17 1195-1261 पानी हिला... और चाँद सौ टुकड़ों में बिखर गया।
// C18 1262-1300 "आपने ख़ुद तोड़ दिया, महाराज।"
// C19 1301-1353 "टूटी चीज़ के पैसे वापस नहीं मिलते।"
// C20 1354-1399 राजा ने मुँह खोला — और बंद कर लिया।
// C21 1400-1518 ठग को सज़ा देने का मतलब था पूरे दरबार को बताना कि उसने कुएँ में चाँद ख़रीदा था।
// C22 1519-1668 लेकिन अगले ठग और भी बदतर थे — दो जुलाहों ने राजा को ऐसा शाही कपड़ा बेचा जो किसी को दिखता ही नहीं था।
// C23 1669-1735 भला जो कपड़ा है ही नहीं, वह बिकता कैसे है?
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf } from './motion.js';

export const FPS = 30, TOTAL = 1736, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 186, light: 'moonlit' },
  { id: 'lead', a: 187, b: 438, light: 'moonlit' },
  { id: 'stare', a: 439, b: 595, light: 'moonlit' },
  { id: 'sign', a: 596, b: 745, light: 'moonlit' },
  { id: 'dawn', a: 746, b: 891, light: 'dawn' },
  { id: 'defence', a: 892, b: 1057, light: 'morning' },
  { id: 'bucket', a: 1058, b: 1194, light: 'moonlit' },
  { id: 'shatter', a: 1195, b: 1261, light: 'moonlit' },
  { id: 'verdict', a: 1262, b: 1353, light: 'moonlit' },
  { id: 'court', a: 1354, b: 1518, light: 'day' },
  { id: 'hookq', a: 1519, b: 1735, light: 'moonlit' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  moonlit: { az: 200, el: 32, sky: '#8a7a9e', ground: '#3a3444', hemi: 0.92, sun: '#cdd8ff', sunI: 1.7, fog: '#9a8aa8', fogNear: 40, fogFar: 320,
    skyTop: '#2a2a55', skyHor: '#c9a0c0', sunDisc: '#f4f0ff', sunSize: 0.004, sat: 1.0, vig: 0.3, shadowExt: 18, aurora: 0, gain: '#e8e2f2', ...WATER },
  dawn: { az: 96, el: 11, sky: '#d8a06a', ground: '#4a4038', hemi: 0.98, sun: '#ffb763', sunI: 1.9, fog: '#e0b890', fogNear: 40, fogFar: 320,
    skyTop: '#6a76a8', skyHor: '#ffc890', sunDisc: '#ffe9c0', sunSize: 0.0036, sat: 1.04, vig: 0.26, shadowExt: 18, aurora: 0, gain: '#ffe4c4', ...WATER },
  morning: { az: 112, el: 27, sky: '#c8b490', ground: '#55503e', hemi: 1.12, sun: '#ffd9a0', sunI: 2.1, fog: '#d8c8a8', fogNear: 44, fogFar: 340,
    skyTop: '#5f87c6', skyHor: '#ffe0b0', sunDisc: '#fff0cd', sunSize: 0.0032, sat: 1.05, vig: 0.2, shadowExt: 18, aurora: 0, gain: '#fff2dc', ...WATER },
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
  if (S.id === 'dawn') return blendLight(LIGHTS.moonlit, LIGHTS.dawn, smooth(ramp(f, 750, 835)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const WELL = [16, 0, -1.6];
export const TRICK = [14.55, 0, -0.55];       // the trickster, west of the well
export const KINGW = [17.45, 0, -0.75];       // the king, east of the well
export const KINGRIM = [17.15, 0, -1.15];     // the king leaning over the rim
export const TRICKG = [15.3, 0, -0.3];        // collar-grab pair
export const KINGG = [16.95, 0, -0.3];
export const SLAB = [16.1, 0.745, -0.05];     // stone ledge: bag + paper rest here
export const THRONE = [0, 0, -2.2];
export const COURT_L = [-2.7, 0, -1.0];
export const TRICKC = [2.7, 0, -0.5];         // trickster at court (verdict beat)
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];

const HERO = {
  hook: () => [16, 2.6, -3.0],
  lead: () => [15.2, 1.1, -0.6],
  stare: () => [16, 0.8, -1.6],
  sign: () => [16.1, 0.9, -0.05],
  dawn: () => [16, 0.9, -1.2],
  defence: () => [15.3, 1.1, -0.4],
  bucket: () => [16.3, 1.2, -1.5],
  shatter: () => [16, 0.75, -1.6],
  verdict: () => [16, 2.6, -3.0],
  court: () => [0, 1.35, -2.2],
  hookq: () => [16, 2.6, -3.0],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Shots cut ONLY at clause boundaries. Inside a shot the camera surges TO
// the clause subject and settles into a slow push-in; a key lands exactly
// on each internal clause boundary. Boards share one anchor above the
// well (16, 3.55, -3.3): whenever a board fades, the camera sits ON that
// axis, steady, so the board is always fully framed (boardverify gate).
const CAMS = {
  hook: [
    { f: 0, pos: [16, 3.0, 10.6], look: [16, 2.4, -2.6], fov: 44 },
    { f: 92, pos: [16, 2.6, 6.6], look: [16, 2.5, -2.8], fov: 40, ease: 'surge' },
    { f: 150, pos: [15.9, 2.45, 5.6], look: [16, 2.45, -2.8], fov: 39 },
    { f: 186, pos: [15.0, 2.1, 4.6], look: [15.9, 1.5, -1.4], fov: 38, ease: 'surge' },
  ],
  lead: [
    { f: 187, pos: [12.6, 2.0, 4.4], look: [15.3, 1.15, -0.7], fov: 40 },
    { f: 260, pos: [13.2, 2.0, 4.2], look: [15.5, 1.1, -0.7], fov: 39, ease: 'surge' },
    { f: 302, pos: [14.6, 3.2, 3.8], look: [16, 1.2, -1.6], fov: 38, ease: 'surge' },
    { f: 340, pos: [15.0, 4.7, 3.2], look: [16, 0.8, -1.6], fov: 37, ease: 'surge' },
    { f: 394, pos: [14.2, 2.6, 4.2], look: [15.8, 1.2, -1.0], fov: 38, ease: 'surge' },
    { f: 438, pos: [14.6, 2.3, 4.0], look: [15.9, 1.15, -1.0], fov: 38 },
  ],
  stare: [
    { f: 439, pos: [15.0, 4.8, 3.0], look: [16, 0.75, -1.6], fov: 36 },
    { f: 500, pos: [15.2, 4.5, 3.2], look: [16, 0.75, -1.6], fov: 36, ease: 'surge' },
    { f: 538, pos: [15.4, 1.8, 2.8], look: [17.2, 1.35, -0.9], fov: 36, ease: 'surge' },
    { f: 561, pos: [16.0, 2.35, 4.8], look: [16, 2.6, -2.9], fov: 40, ease: 'surge' },
    { f: 595, pos: [16.0, 2.3, 4.4], look: [16, 2.6, -2.9], fov: 39 },
  ],
  sign: [
    { f: 596, pos: [13.1, 1.85, 4.4], look: [15.0, 1.15, -0.5], fov: 38 },
    { f: 645, pos: [13.4, 1.8, 4.0], look: [15.2, 1.1, -0.45], fov: 37, ease: 'surge' },
    { f: 682, pos: [14.2, 1.95, 3.9], look: [16.2, 1.0, -0.3], fov: 38, ease: 'surge' },
    { f: 745, pos: [14.5, 1.9, 3.6], look: [16.35, 1.05, -0.4], fov: 37 },
  ],
  dawn: [
    { f: 746, pos: [14.8, 4.5, 3.4], look: [16, 0.8, -1.6], fov: 38 },
    { f: 800, pos: [15.1, 4.2, 3.2], look: [16, 0.8, -1.6], fov: 37, ease: 'surge' },
    { f: 826, pos: [13.7, 1.9, 4.7], look: [15.95, 1.25, -0.3], fov: 39, ease: 'surge' },
    { f: 891, pos: [14.0, 1.85, 4.4], look: [15.95, 1.2, -0.3], fov: 38 },
  ],
  defence: [
    { f: 892, pos: [13.7, 1.8, 3.6], look: [15.2, 1.1, -0.4], fov: 38 },
    { f: 940, pos: [13.9, 1.75, 3.3], look: [15.3, 1.05, -0.4], fov: 37, ease: 'surge' },
    { f: 973, pos: [13.2, 2.0, 4.6], look: [15.6, 1.15, -0.8], fov: 39, ease: 'surge' },
    { f: 1057, pos: [13.6, 1.95, 4.2], look: [15.8, 1.1, -0.9], fov: 38 },
  ],
  bucket: [
    { f: 1058, pos: [14.8, 4.6, 3.2], look: [16, 0.8, -1.6], fov: 37 },
    { f: 1110, pos: [15.0, 4.3, 3.2], look: [16, 0.8, -1.6], fov: 37, ease: 'surge' },
    { f: 1135, pos: [14.5, 2.1, 3.8], look: [16.5, 1.4, -1.4], fov: 38, ease: 'surge' },
    { f: 1194, pos: [14.9, 2.5, 3.4], look: [16.3, 1.0, -1.6], fov: 38, ease: 'surge' },
  ],
  shatter: [
    { f: 1195, pos: [15.0, 4.4, 3.2], look: [16, 0.8, -1.6], fov: 37 },
    { f: 1230, pos: [15.2, 4.2, 3.2], look: [16, 0.78, -1.6], fov: 37, ease: 'surge' },
    { f: 1261, pos: [15.4, 3.6, 3.6], look: [16, 1.2, -1.8], fov: 38, ease: 'surge' },
  ],
  verdict: [
    { f: 1262, pos: [16.0, 2.5, 5.4], look: [16, 2.7, -3.0], fov: 40 },
    { f: 1301, pos: [16.0, 2.5, 5.2], look: [16, 2.7, -3.0], fov: 40 },
    { f: 1353, pos: [16.0, 2.45, 5.0], look: [16, 2.65, -3.0], fov: 39 },
  ],
  court: [
    { f: 1354, pos: [3.2, 1.9, 4.2], look: [0, 1.3, -2.2], fov: 38 },
    { f: 1380, pos: [2.9, 1.85, 3.8], look: [0, 1.3, -2.2], fov: 37, ease: 'surge' },
    { f: 1400, pos: [5.4, 2.3, 6.4], look: [0.6, 1.4, -1.6], fov: 42, ease: 'surge' },
    { f: 1460, pos: [5.0, 2.2, 6.0], look: [0.6, 1.35, -1.6], fov: 41, ease: 'surge' },
    { f: 1518, pos: [4.6, 2.1, 5.6], look: [0.7, 1.3, -1.5], fov: 40 },
  ],
  hookq: [
    { f: 1519, pos: [13.4, 2.0, 4.4], look: [15.6, 1.2, -0.8], fov: 39 },
    { f: 1600, pos: [14.6, 2.25, 4.8], look: [16, 2.0, -2.2], fov: 40, ease: 'surge' },
    { f: 1669, pos: [16.0, 2.55, 5.3], look: [16, 2.7, -3.0], fov: 40, ease: 'surge' },
    { f: 1735, pos: [16.0, 2.6, 5.7], look: [16, 2.65, -3.0], fov: 40 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['stare', 'shatter', 'bucket'].includes(S.id)) cinf = 3.6;
  if (S.id === 'sign') cinf = 3.2;
  if (['hook', 'verdict', 'hookq'].includes(S.id)) cinf = 3.8;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
// Bucket track: hangs at 1.85 (bottom 1.70, clear of the rim); the king
// takes it up a touch (2.02), it dips, then LOWERS — the last segment is
// easeIn (gravity takes it) until bucketY 0.87, where its bottom is
// EXACTLY the water surface (0.72). Settle dip to 0.80 (submerged lip),
// hold, then a smooth heavy lift back to the beam, now carrying water.
const BUCKET_KEYS = [
  [0, 1.85], [1135, 1.85], [1165, 2.02, 'surge'], [1188, 1.96], [1208, 0.87, 'easeIn'],
  [1224, 0.80], [1258, 0.80], [1330, 1.85, 'surge'], [1735, 1.85],
];
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardPrice: 0, boardShatter: 0, boardVerdict: 0, boardHook: 0,
    goldK: 0, paperK: 0, moonK: 0, shatterK: 0, splashK: 0, rippleK: 0, bucketY: kf(BUCKET_KEYS, f), bucketWet: 0 };
  if (S.id === 'hook') W.boardTitle = 1 - smooth(ramp(f, 128, 150));
  if (S.id === 'stare') W.boardPrice = smooth(ramp(f, 566, 580)) * (1 - smooth(ramp(f, 588, 595)));
  if (S.id === 'verdict') {
    W.boardShatter = smooth(ramp(f, 1266, 1280)) * (1 - smooth(ramp(f, 1294, 1306)));
    W.boardVerdict = smooth(ramp(f, 1308, 1322));   // holds to the shot cut at 1353
  }
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1672, 1692));   // NO fade-out: holds 1.0 to the last frame
  if (S.id === 'sign') { W.goldK = 1; if (f >= 682) W.paperK = 1; }
  // the moon's reflection: present on both nights, GONE at dawn/morning
  if (['hook', 'lead', 'stare', 'sign'].includes(S.id)) W.moonK = 1;
  if (S.id === 'bucket') W.moonK = smooth(ramp(f, 1062, 1098));
  if (['shatter', 'verdict', 'hookq'].includes(S.id)) W.moonK = 1;
  // the shatter: breaks as the bucket's splash spreads (C17), stays broken
  if (f >= 1195) W.shatterK = smooth(ramp(f, 1212, 1248));
  if (f >= 1206) {
    W.splashK = smooth(ramp(f, 1206, 1214)) * (1 - smooth(ramp(f, 1252, 1272)));
    W.rippleK = clamp((f - 1206) / 55);
  }
  if (f >= 1250) W.bucketWet = 1;   // filled while submerged; visible on the lift
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'moonlit' ? 0.16 : 0.3), dustRate: 0.08, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { moonlit: '#d8dcff', dawn: '#ffd9b0', morning: '#ffe8c8', day: '#ffffff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — king: crimson royal robe + gold crown + grey
// moustache, stout. Trickster: clever commoner — olive worn jacket,
// plain hair, no finery. Courtiers: purple court dress. Guards: red
// uniform + shako.
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  trick: { jacket: '#54683c', pants: '#4a3a28', boots: '#33261a', hat: 'hair', hair: '#1f150c', skin: '#c98a5a' },
  courtierL: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
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
  switch (S.id) {
    case 'hook': {
      out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
      out.push(st(OUTFITS.king, f < 113 ? 'stern' : 'neutral', 31, KINGW, { yaw: -0.45 }));
      break;
    }
    case 'lead': {
      // C04: the trickster POINTS down into the well (arm angle follows pk)
      const pk = q(smooth(ramp(f, 318, 352)) * (1 - smooth(ramp(f, 380, 394))), 2);
      out.push(RW(T, OUTFITS.trick, { expr: f < 302 ? 'smile' : 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: pk > 0.01 ? ['point', pk] : null }, TRICK, { tint, yaw: 0.45 }));
      const lk = bowK(f, 310, 340, 420, 438) * 0.35;   // the king leans to look where he points
      out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(lk) }, BP(KINGW, lk), { tint, yaw: -0.45 }));
      break;
    }
    case 'stare': {
      if (f < 538) {
        const lk = 0.55;   // leaning over the rim, staring at the shining plate
        out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(lk) }, BP(KINGRIM, lk), { tint, yaw: -0.6 }));
        out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
      } else if (f < 561) {
        out.push(st(OUTFITS.king, 'stern', 31, KINGW, { yaw: -0.45 }));   // "कितने में?"
        out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
      } else {
        out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
        out.push(st(OUTFITS.king, 'neutral', 31, KINGW, { yaw: -0.45 }));
      }
      break;
    }
    case 'sign': {
      if (f < 682) {
        // the trickster holds the paper UP toward the king (letter prop)
        out.push(RW(T, OUTFITS.trick, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['letter', 0.55] }, TRICK, { tint, yaw: 0.45 }));
        out.push(st(OUTFITS.king, 'neutral', 31, KINGW, { yaw: -0.45 }));
      } else {
        // the king pays: coin in his extended hand; the signed paper now
        // RESTS on the ledge beside the coin bag (worldAt.paperK/goldK)
        out.push(RW(T, OUTFITS.king, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['coin', 0.55] }, KINGW, { tint, yaw: -0.45 }));
        out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
      }
      break;
    }
    case 'dawn': {
      if (f < 826) {
        const lk = 0.6;   // leaning over the EMPTY water
        out.push(RW(T, OUTFITS.king, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(lk) }, BP(KINGRIM, lk), { tint, yaw: -0.6 }));
      } else {
        // collar grab: face to face, the king leaning IN, trickster back
        out.push(st(OUTFITS.king, 'stern', 31, KINGG, { yaw: -0.3 }));
        out.push(RW(T, OUTFITS.trick, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, TRICKG, { tint, yaw: 0.3, roll: 0.05 }));
      }
      break;
    }
    case 'defence': {
      const bk = bowK(f, 900, 928, 958, 982);
      out.push(RW(T, OUTFITS.trick, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91, ...bowOpts(bk) }, BP(TRICKG, bk), { tint, yaw: 0.3 }));
      out.push(st(OUTFITS.king, f < 973 ? 'stern' : 'neutral', 31, KINGG, { yaw: -0.3 }));
      break;
    }
    case 'bucket': {
      const lk = bowK(f, 1062, 1090, 1120, 1134) * 0.4;   // king peers in: the plate is back
      out.push(RW(T, OUTFITS.king, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(lk) }, BP(KINGRIM, lk), { tint, yaw: -0.6 }));
      out.push(st(OUTFITS.trick, 'smile', 91, TRICK, { yaw: 0.45 }));
      break;
    }
    case 'shatter': {
      out.push(st(OUTFITS.king, 'shock', 31, KINGRIM, { yaw: -0.6 }));
      out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
      break;
    }
    case 'verdict': {
      out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
      out.push(st(OUTFITS.king, 'dazed', 31, KINGRIM, { yaw: -0.6 }));
      break;
    }
    case 'court': {
      // the king on his throne, courtiers around — the people he can
      // NEVER tell. Mouth opens (shock) then closes (dazed) at C20/C21.
      out.push(kingSit(f < 1372 ? 'shock' : 'dazed'));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.trick, 'grin', 91, TRICKC, { yaw: -0.3 }));
      out.push(st(OUTFITS.guardL, 'stern', 61, GLP, { yaw: 0.15 }));
      out.push(st(OUTFITS.guardR, 'stern', 62, GRP, { yaw: -0.15 }));
      break;
    }
    case 'hookq': {
      out.push(st(OUTFITS.trick, 'grin', 91, TRICK, { yaw: 0.45 }));
      out.push(st(OUTFITS.king, 'dazed', 31, KINGRIM, { yaw: -0.6 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
