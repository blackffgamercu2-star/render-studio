// Shot plan for "वो लड़का जिसने हाथी को तौल दिया" (batch-5 topic 1, HI) —
// timed to the ACTUAL Hindi voice stem (62.371 s, 30 fps, TOTAL 1871).
// Clause timings from faster-whisper (small, hi) word timestamps on the
// stem itself (elephant-hindi-voice/words.json); the tail 48.5–62.34 s
// (dropped by the full pass) filled by a slice transcribe (words_tail.json).
// QUALITY RULES (owner, batch-2/3/4/5): shots change ONLY at clause
// boundaries; camera TRACKS the voice-named subject every beat
// (biggest/centred), never freezes, never drifts; characters act in
// place — no walk-glide; costumes by role (king = crown + royal robe,
// boy = poor barefoot clothes, soldiers = red uniform + shako).
// PHYSICS RULES (Abid 2026-11-15, TOP priority): the boat SINKS with
// weight (elephant aboard / stones loaded) and floats back up empty —
// the elephant aboard is a CHILD of the boat so it sinks WITH it, feet
// always ON the deck; the chalk mark is painted on the hull EXACTLY at
// the waterline while the elephant is aboard, and the boat sinks back to
// that SAME mark as the stones load; each stone FALLS with gravity
// (easeIn) from just above the deck and LANDS on the deck and stays;
// the bank pile rests ON the ground / the layer below. Nothing floats,
// nothing detaches.
// World: palace court x=0 (facade z=-3.2, throne z=-2.2), river x=+16 —
// the trick plays at the river; the court appears for the wise-men /
// laugh beats. Water surface y=-0.02; boat deck local y=0, hull bottom
// -0.55; boatY 0.55 empty, 0.18 loaded (waterline at local y -0.20 =
// the chalk mark).
// C01 0-54 सबने कहा — ये हो ही नहीं सकता।
// C02 54-123 राजा का हाथी दस घोड़ों से भी भारी था
// C03 123-221 और पूरे राज्य में कोई तराज़ू इतना बड़ा नहीं था कि उसे तौल सके।
// C04 222-274 शाही ज्ञानी सिर हिलाकर रह गए।
// C05 275-330 लोहारों ने कंधे उचका दिए।
// C06 331-481 तभी एक नंगे पाँव लड़का आगे आया और बोला, "मुझे एक नाव, पत्थरों का ढेर और एक दोपहर दे दीजिए।"
// C07 482-517 दरबार हँस पड़ा।
// C08 525-560 राजा सबसे ज़ोर से हँसा।
// C09 561-605 पर लड़के ने बहस नहीं की।
// C10 615-724 वह विशाल हाथी को नदी तक ले गया और एक बड़ी लकड़ी की नाव पर चढ़ा दिया।
// C11 725-775 नाव पानी में नीचे धँस गई।
// C12 776-886 लड़के ने चाक उठाकर नाव के किनारे पानी की लकीर पर निशान लगा दिया।
// C13 887-985 फिर वह हाथी को उतार लाया, और नाव फिर ऊपर तैरने लगी।
// C14 986-1037 "अब," उसने कहा, "पत्थर लाइए।"
// C15 1072-1115 एक-एक करके सिपाही नाव में पत्थर भरने लगे।
// C16 1116-1177 नाव नीचे धँसती गई... और धँसती गई...
// C17 1178-1257 जब तक पानी फिर उसी चाक के निशान को छू नहीं गया।
// C18 1258-1409 लड़का मुस्कुराया। "पत्थरों का वज़न हाथी के बराबर है। पत्थर तौल लो — और हाथी तुल गया।"
// C19 1410-1455 राजा घूरता रह गया।
// C20 1459-1507 फिर उसने पत्थर तौलने का हुक्म दिया: दो हज़ार किलो।
// C21 1516-1661 लड़के ने बिना तराज़ू के हाथी तौल दिया था — सिर्फ़ एक नाव और एक निशान से।
// C22 1668-1712 पर अगली चाल तो इससे भी अजीब थी।
// C23 1713-1809 एक गड़रिये ने एक ही बकरी एक ही व्यापारी को — दो बार बेच दी।
// C24 1818-1870 भला एक बकरी दो बार कैसे बिकती है?
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf } from './motion.js';

export const FPS = 30, TOTAL = 1871, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 221, light: 'day' },
  { id: 'court', a: 222, b: 481, light: 'day' },
  { id: 'laugh', a: 482, b: 605, light: 'day' },
  { id: 'board', a: 606, b: 775, light: 'day' },
  { id: 'mark', a: 776, b: 886, light: 'day' },
  { id: 'unload', a: 887, b: 1037, light: 'day' },
  { id: 'load', a: 1038, b: 1257, light: 'day' },
  { id: 'weigh', a: 1258, b: 1507, light: 'day' },
  { id: 'hookq', a: 1508, b: 1870, light: 'day' },
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
export const RIVER = [16, 0, -1.6];
export const ELEBANK = [13.8, 0, -0.8];       // elephant ashore, west of the boat
export const BOY = [14.3, 0, 0.6];            // the boy on the south bank
export const BOYM = [15.0, 0, -0.3];          // the boy at the hull, chalking the mark
export const KINGR = [17.6, 0, 0.4];          // the king on the south bank
export const GUARDL = [12.6, 0, 0.9];         // soldiers by the stone pile
export const GUARDR = [13.9, 0, 1.3];
export const THRONE = [0, 0, -2.2];
export const COURT_L = [-2.7, 0, -1.0];
export const COURT_R = [-1.2, 0, -1.5];
export const SMITH = [1.8, 0, -1.2];
export const BOYC = [2.7, 0, -0.5];           // the boy at court
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];

const HERO = {
  hook: () => [13.8, 1.6, -0.8],
  court: () => [0, 1.35, -2.2],
  laugh: () => [0, 1.35, -2.2],
  board: () => [16, 1.6, -1.6],
  mark: () => [16, 0.5, -1.6],
  unload: () => [14.5, 1.2, -0.8],
  load: () => [15, 0.8, -1.2],
  weigh: () => [14.9, 1.0, 0.9],
  hookq: () => [16, 2.6, -3.0],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Shots cut ONLY at clause boundaries. Inside a shot the camera surges TO
// the clause subject and settles into a slow push-in; a key lands exactly
// on each internal clause boundary. Boards share one anchor above the
// river (16, 3.55, -3.3): whenever a board is up, the camera sits ON that
// axis, steady, so the board is always fully framed (boardverify gate).
const CAMS = {
  hook: [
    { f: 0, pos: [16, 3.2, 12.5], look: [15.0, 2.2, -2.2], fov: 44 },
    { f: 40, pos: [16, 2.9, 9.0], look: [15.8, 2.4, -2.6], fov: 41, ease: 'surge' },
    { f: 47, pos: [16, 2.9, 9.0], look: [15.8, 2.4, -2.6], fov: 41 },
    { f: 70, pos: [15.5, 2.6, 9.5], look: [14.2, 1.5, -0.7], fov: 40, ease: 'surge' },
    { f: 123, pos: [15.0, 2.4, 8.6], look: [14.0, 1.5, -0.7], fov: 39, ease: 'surge' },
    { f: 221, pos: [14.8, 2.3, 8.2], look: [14.0, 1.4, -0.7], fov: 39 },
  ],
  court: [
    { f: 222, pos: [3.2, 1.9, 4.2], look: [0, 1.3, -2.2], fov: 38 },
    { f: 275, pos: [4.5, 2.0, 3.6], look: [1.8, 1.2, -1.2], fov: 38, ease: 'surge' },
    { f: 331, pos: [5.5, 2.4, 6.5], look: [1.35, 1.2, -1.4], fov: 42, ease: 'surge' },
    { f: 481, pos: [5.3, 2.3, 6.2], look: [1.35, 1.2, -1.4], fov: 41 },
  ],
  laugh: [
    { f: 482, pos: [3.2, 1.9, 4.2], look: [0, 1.3, -2.2], fov: 38 },
    { f: 525, pos: [1.5, 1.8, 3.2], look: [0, 1.4, -2.2], fov: 36, ease: 'surge' },
    { f: 561, pos: [4.6, 2.1, 5.2], look: [1.8, 1.2, -1.0], fov: 40, ease: 'surge' },
    { f: 605, pos: [4.4, 2.05, 5.0], look: [1.8, 1.2, -1.0], fov: 40 },
  ],
  board: [
    { f: 606, pos: [11.0, 3.0, 10.0], look: [16.0, 1.4, -1.6], fov: 42 },
    { f: 660, pos: [11.8, 2.8, 9.4], look: [16.2, 1.4, -1.6], fov: 41, ease: 'surge' },
    { f: 725, pos: [12.6, 2.6, 8.6], look: [16.3, 1.2, -1.6], fov: 40, ease: 'surge' },
    { f: 775, pos: [12.8, 2.6, 8.2], look: [16.3, 1.1, -1.6], fov: 40 },
  ],
  mark: [
    { f: 776, pos: [13.2, 2.0, 5.2], look: [15.8, 0.9, -0.9], fov: 38 },
    { f: 830, pos: [13.5, 1.9, 4.8], look: [15.9, 0.8, -0.9], fov: 37, ease: 'surge' },
    { f: 886, pos: [13.6, 1.9, 4.6], look: [15.9, 0.8, -0.9], fov: 37 },
  ],
  unload: [
    { f: 887, pos: [12.0, 2.6, 7.0], look: [14.5, 1.2, -0.8], fov: 41 },
    { f: 950, pos: [15.2, 2.4, 7.6], look: [14.8, 1.1, -0.8], fov: 41, ease: 'surge' },
    { f: 986, pos: [14.8, 2.2, 6.4], look: [14.4, 1.1, 0.6], fov: 39, ease: 'surge' },
    { f: 1037, pos: [14.6, 2.15, 6.0], look: [14.4, 1.1, 0.6], fov: 39 },
  ],
  load: [
    { f: 1038, pos: [12.8, 2.0, 4.4], look: [13.6, 1.0, 0.6], fov: 39 },
    { f: 1100, pos: [15.2, 2.4, 6.4], look: [16.2, 1.0, -1.4], fov: 40, ease: 'surge' },
    { f: 1178, pos: [16.2, 2.2, 5.6], look: [16.3, 0.5, -1.6], fov: 39, ease: 'surge' },
    { f: 1257, pos: [16.4, 2.2, 5.4], look: [16.3, 0.5, -1.6], fov: 39 },
  ],
  weigh: [
    { f: 1258, pos: [13.4, 2.0, 4.2], look: [14.9, 1.0, 0.9], fov: 38 },
    { f: 1330, pos: [13.8, 1.95, 3.8], look: [14.9, 1.0, 0.9], fov: 37, ease: 'surge' },
    { f: 1410, pos: [15.5, 1.9, 3.6], look: [17.6, 1.3, 0.4], fov: 37, ease: 'surge' },
    { f: 1507, pos: [15.3, 1.9, 3.4], look: [17.6, 1.3, 0.4], fov: 37 },
  ],
  hookq: [
    { f: 1508, pos: [16.0, 2.5, 5.4], look: [16, 2.7, -3.0], fov: 40 },
    { f: 1550, pos: [16.0, 2.5, 5.4], look: [16, 2.7, -3.0], fov: 40 },
    { f: 1600, pos: [14.4, 2.1, 4.4], look: [15.2, 1.2, -0.4], fov: 39, ease: 'surge' },
    { f: 1668, pos: [16.0, 2.5, 5.4], look: [16, 2.7, -3.0], fov: 40, ease: 'surge' },
    { f: 1870, pos: [16.0, 2.55, 5.6], look: [16, 2.65, -3.0], fov: 40 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['board'].includes(S.id)) cinf = 3.6;
  if (['mark', 'load'].includes(S.id)) cinf = 3.2;
  if (['hook', 'weigh', 'hookq'].includes(S.id)) cinf = 3.8;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
// Boat draft: 0.55 empty, 0.18 loaded (elephant aboard C11, stones C15-17).
// The sink during C11 is easeIn (gravity takes the heavy boat down) with
// a small settle dip; the rise after unloading is a smooth surge; the
// stone-load sink steps down as the 8 stones land, ending exactly at
// 0.18 — the chalk-mark waterline again.
const BOAT_KEYS = [
  [0, 0.55], [724, 0.55], [775, 0.18, 'easeIn'],
  [790, 0.15], [810, 0.18],
  [887, 0.18], [950, 0.55, 'surge'],
  [1038, 0.55], [1100, 0.50], [1150, 0.42], [1200, 0.33], [1257, 0.18],
  [1870, 0.18],
];
// one stone lands every ~25 frames across C15-C17; each drop is 10
// frames, easeIn (falls, lands, STOPS — no bounce, no drift).
const DROP_STARTS = [1080, 1105, 1130, 1155, 1180, 1205, 1225, 1245];
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardWeight: 0, boardHook: 0,
    boatY: kf(BOAT_KEYS, f), chalkK: 0, eleBoat: 0, eleBank: 0, scaleK: S.id === 'weigh' ? 1 : 0,
    stoneDrop: DROP_STARTS.map((s) => M.easeIn(ramp(f, s, s + 10))), rippleK: 0 };
  if (S.id === 'hook') W.boardTitle = 1 - smooth(ramp(f, 40, 46));
  // "दो हज़ार किलो" is spoken in C21 (f1515-1539, hookq shot): the board
  // flashes exactly with the words, then fades before the camera leaves
  // the board axis at f1550, so it is always fully framed while up.
  if (S.id === 'hookq') W.boardWeight = smooth(ramp(f, 1512, 1524)) * (1 - smooth(ramp(f, 1536, 1548)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1715, 1735));   // NO fade-out: holds 1.0 to the last frame
  // the chalk mark: painted while "निशान लगा दिया" is spoken (C12),
  // then it STAYS on the hull for the rest of the video.
  if (f >= 850) W.chalkK = smooth(ramp(f, 850, 870));
  // the elephant: aboard the boat in 'board'/'mark', ashore otherwise
  // (in court/laugh shots the river is off-frame, so either is fine).
  if (['board', 'mark'].includes(S.id)) W.eleBoat = 1;
  else if (['hook', 'unload', 'load', 'weigh', 'hookq'].includes(S.id)) W.eleBank = 1;
  // ripples while the boat sinks: under the elephant (C11) and under the stones (C15-17)
  const r1 = smooth(ramp(f, 724, 745)) * (1 - smooth(ramp(f, 780, 830)));
  const r2 = 0.7 * smooth(ramp(f, 1080, 1110)) * (1 - smooth(ramp(f, 1240, 1280)));
  W.rippleK = Math.max(r1, r2);
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
// moustache, stout. Boy: poor barefoot lad — worn earth-tone clothes,
// boots in skin tone so his feet read BARE. Soldiers: red uniform +
// shako. Wise men: court dress. Blacksmith: dark work clothes + cap.
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  boy: { jacket: '#7a6a44', pants: '#4a3a28', boots: '#c98a5a', hat: 'hair', hair: '#1f150c', skin: '#c98a5a' },
  courtierL: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
  courtierR: { jacket: '#3a4a6e', pants: '#2a2a3d', boots: '#241a12', hat: 'cap', cap: '#4a3a4a', skin: '#d8a878' },
  smith: { jacket: '#3d3a38', pants: '#2e2a26', boots: '#241a12', hat: 'cap', cap: '#2e2a26', skin: '#b98a62' },
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
      out.push(st(OUTFITS.boy, 'smile', 91, BOY, { yaw: 0.45, s: 0.82 }));
      out.push(st(OUTFITS.king, f < 54 ? 'stern' : 'neutral', 31, KINGR, { yaw: -0.45 }));
      break;
    }
    case 'court': {
      out.push(kingSit(f < 331 ? 'stern' : 'neutral'));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'neutral', 72, COURT_R, { yaw: -0.2 }));
      if (f >= 275) out.push(st(OUTFITS.smith, 'neutral', 61, SMITH, { yaw: -0.3 }));
      if (f >= 331) out.push(st(OUTFITS.boy, 'grin', 91, BOYC, { yaw: -0.3, s: 0.82 }));
      break;
    }
    case 'laugh': {
      out.push(kingSit('laugh'));
      out.push(st(OUTFITS.courtierL, 'laugh', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'laugh', 72, COURT_R, { yaw: -0.2 }));
      out.push(st(OUTFITS.smith, 'laugh', 61, SMITH, { yaw: -0.3 }));
      out.push(st(OUTFITS.boy, f < 561 ? 'smile' : 'smile_closed', 91, BOYC, { yaw: -0.3, s: 0.82 }));
      break;
    }
    case 'board': {
      out.push(st(OUTFITS.boy, 'smile', 91, BOY, { yaw: 0.45, s: 0.82 }));
      out.push(st(OUTFITS.king, 'neutral', 31, KINGR, { yaw: -0.45 }));
      break;
    }
    case 'mark': {
      // C12: the boy POINTS at the hull where the chalk mark appears
      const pk = q(smooth(ramp(f, 820, 850)) * (1 - smooth(ramp(f, 872, 886))), 2);
      out.push(RW(T, OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: pk > 0.01 ? ['point', pk] : null }, BOYM, { tint, yaw: 0.45, s: 0.82 }));
      out.push(st(OUTFITS.king, 'neutral', 31, KINGR, { yaw: -0.45 }));
      break;
    }
    case 'unload': {
      // C14: "पत्थर लाइए" — the boy gestures toward the stone pile
      const pk = f >= 986 ? q(smooth(ramp(f, 990, 1010)), 2) : 0;
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: pk > 0.01 ? ['point', pk] : null }, BOY, { tint, yaw: 0.45, s: 0.82 }));
      out.push(st(OUTFITS.king, 'neutral', 31, KINGR, { yaw: -0.45 }));
      out.push(st(OUTFITS.guardL, 'stern', 61, GUARDL, { yaw: 0.15 }));
      out.push(st(OUTFITS.guardR, 'stern', 62, GUARDR, { yaw: -0.15 }));
      break;
    }
    case 'load': {
      // the king leans in, watching the water climb back to the chalk mark
      const lk = 0.35;
      out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(lk) }, BP(KINGR, lk), { tint, yaw: -0.45 }));
      out.push(st(OUTFITS.boy, 'smile', 91, BOY, { yaw: 0.45, s: 0.82 }));
      out.push(st(OUTFITS.guardL, 'neutral', 61, GUARDL, { yaw: 0.15 }));
      out.push(st(OUTFITS.guardR, 'neutral', 62, GUARDR, { yaw: -0.15 }));
      break;
    }
    case 'weigh': {
      out.push(st(OUTFITS.boy, 'grin', 91, BOY, { yaw: 0.45, s: 0.82 }));
      out.push(st(OUTFITS.king, f < 1410 ? 'neutral' : 'shock', 31, KINGR, { yaw: -0.45 }));
      out.push(st(OUTFITS.guardL, 'neutral', 61, GUARDL, { yaw: 0.15 }));
      break;
    }
    case 'hookq': {
      out.push(st(OUTFITS.boy, 'grin', 91, BOY, { yaw: 0.45, s: 0.82 }));
      out.push(st(OUTFITS.king, 'dazed', 31, KINGR, { yaw: -0.45 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
