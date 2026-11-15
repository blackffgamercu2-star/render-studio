// Shot plan for "राज्य में कितने कौवे हैं?" (batch-3 topic 5, HI) —
// timed to the ACTUAL Hindi voice stem (54.371 s, 30 fps, TOTAL 1631), clause
// timings from faster-whisper alignment (match_ratio 0.523, boundaries
// corrected via difflib token mapping). EN clause structure reused 1:1;
// every frame literal below is the EN frame mapped through the HI clause
// boundary anchor map (piecewise-linear on clause f0/f1).
// QUALITY RULES (owner, batch-2/3): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — no walk-glide; costumes by role (king = crown +
// royal robe, minister = turban + long robe, courtiers = court dress,
// moon-seller = worn poor clothes); crows clearly readable as black birds.
// World: palace court x=0 (facade z=-3.2, throne z=-2.2), crow grove x=-16,
// moon well x=+16.
// C01 0-110 राजा ने अपने सबसे चतुर मंत्री से पूछा: "मेरे राज्य में कितने
// C02 114-185 मंत्री ने एक सेकंड में जवाब दिया — और वह सही था।
// C03 194-271 राजा ऊबा हुआ था, और ऊबा हुआ राजा ख़तरनाक होता है।
// C04 271-426 इसलिए उसने अपने सबसे चतुर मंत्री को बुलाया और कहा, "बताओ — म
// C05 426-478 अभी जवाब दो, वरना अपनी कुर्सी खो दोगे।"
// C06 478-521 दरबार की साँसें रुक गईं।
// C07 521-569 कौवों को कोई कैसे गिन सकता है?
// C08 569-634 लेकिन मंत्री ने पलक तक नहीं झपकाई।
// C09 641-694 "पचानवे हज़ार, चार सौ तिरसठ, महाराज।"
// C10 700-729 राजा ने भौंहें चढ़ाईं।
// C11 735-776 "और अगर मैं गिनूँ और ज़्यादा निकलें?"
// C12 779-841 "तो कुछ कौवे पड़ोसी राज्य से मिलने आए होंगे, महाराज।"
// C13 841-873 "और अगर कम निकलें?"
// C14 878-956 "तो हमारे कुछ कौवे अपने रिश्तेदारों से मिलने गए होंगे, महारा
// C15 962-1022 राजा घूरता रहा... फिर ज़ोर से हँस पड़ा।
// C16 1022-1115 उसने मंत्री के कंधे पर हाथ मारा और उसे सोने की थैली दे दी।
// C17 1118-1207 क्योंकि सबसे चतुर जवाब हमेशा सच्चा नंबर नहीं होता —
// C18 1207-1277 वह जवाब होता है जो कभी ग़लत नहीं हो सकता।
// C19 1277-1388 लेकिन कल मिलिए उस आदमी से जिसने राजा को चाँद ही बेच दिया।
// C20 1388-1516 उसने कुएँ की ओर इशारा किया और कहा, "वहाँ रहा, महाराज। सिर्फ़
// C21 1516-1569 और राजा ने पैसे दे दिए।
// C22 1569-1630 भला एक राजा अपना ही चाँद क्यों खरीदेगा?
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1631, DECK = 0;
export const SHOTS = [
  { id: 'hookQ', a: 0, b: 114, light: 'dusk' },
  { id: 'answer', a: 115, b: 193, light: 'dusk' },
  { id: 'bored', a: 194, b: 271, light: 'dusk' },
  { id: 'summon', a: 272, b: 478, light: 'dusk' },
  { id: 'breath', a: 479, b: 569, light: 'day' },
  { id: 'blink', a: 570, b: 641, light: 'dusk' },
  { id: 'number', a: 642, b: 700, light: 'dusk' },
  { id: 'frown', a: 701, b: 779, light: 'dusk' },
  { id: 'visiting', a: 780, b: 840, light: 'day' },
  { id: 'fewer', a: 841, b: 878, light: 'dusk' },
  { id: 'relatives', a: 879, b: 962, light: 'day' },
  { id: 'laugh', a: 963, b: 1022, light: 'dusk' },
  { id: 'gold', a: 1023, b: 1118, light: 'dusk' },
  { id: 'moral', a: 1119, b: 1277, light: 'dusk' },
  { id: 'moon', a: 1278, b: 1388, light: 'moonlit' },
  { id: 'well', a: 1389, b: 1569, light: 'moonlit' },
  { id: 'hook', a: 1570, b: 1630, light: 'moonlit' },
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
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  moonlit: { az: 200, el: 32, sky: '#8a7a9e', ground: '#3a3444', hemi: 0.92, sun: '#cdd8ff', sunI: 1.7, fog: '#9a8aa8', fogNear: 40, fogFar: 320,
    skyTop: '#2a2a55', skyHor: '#c9a0c0', sunDisc: '#f4f0ff', sunSize: 0.004, sat: 1.0, vig: 0.3, shadowExt: 18, aurora: 0, gain: '#e8e2f2', ...WATER },
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
  if (S.id === 'moon') return blendLight(LIGHTS.dusk, LIGHTS.moonlit, smooth(ramp(f, 1282, 1388)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const THRONE = [0, 0, -2.2];
export const MINISTER = [1.7, 0, -0.4];
export const COURT_L = [-2.7, 0, -1.0];
export const COURT_R = [3.0, 0, -1.2];
export const GROVE = [-16, 0, -5];
export const WELL = [16, 0, -1.6];
export const SELLER = [15.0, 0, -0.5];
export const KINGWELL = [17.2, 0, -0.9];
export const GOLDBAG = [1.05, 0, -0.95];   // the bag of gold, at the minister's feet
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];   // guard posts

const HERO = {
  hookQ: () => [0, 1.35, -2.2],
  answer: () => [1.7, 1.1, -0.4],
  bored: () => [0, 1.35, -2.2],
  summon: () => [0.9, 1.2, -1.2],
  breath: () => [-16, 3.2, -5],
  blink: () => [1.7, 1.1, -0.4],
  number: () => [0.8, 1.6, -2.2],
  frown: () => [0, 1.35, -2.2],
  visiting: () => [-15, 6, -6],
  fewer: () => [0, 1.35, -2.2],
  relatives: () => [-18, 7, -8],
  laugh: () => [0, 1.35, -2.2],
  gold: () => [1.4, 1.1, -0.6],
  moral: () => [1.2, 1.15, -0.6],
  moon: () => [15, 1.0, -1.0],
  well: () => [16, 0.9, -1.6],
  hook: () => [16, 3.3, -3.3],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Between clauses inside one shot
// a key lands exactly on the clause boundary frame.
const CAMS = {
  hookQ: [
    { f: 0, pos: [8.6, 3.8, 12.6], look: [0, 1.9, -3.0], fov: 46 },
    { f: 62, pos: [4.8, 2.55, 6.0], look: [0, 1.6, -3.0], fov: 42, ease: 'surge' },
    { f: 114, pos: [1.6, 1.7, 1.3], look: [0, 1.35, -2.2], fov: 36, ease: 'surge' },
  ],
  answer: [
    { f: 115, pos: [1.6, 1.7, 1.3], look: [0, 1.35, -2.2], fov: 36 },
    { f: 154, pos: [3.4, 2.0, 4.6], look: [1.7, 1.1, -0.4], fov: 40, ease: 'surge' },
    { f: 193, pos: [3.0, 1.9, 4.2], look: [1.7, 1.12, -0.4], fov: 39 },
  ],
  bored: [
    { f: 194, pos: [3.0, 1.9, 4.2], look: [1.7, 1.12, -0.4], fov: 39 },
    { f: 241, pos: [4.2, 2.2, 5.2], look: [0, 1.3, -2.2], fov: 40, ease: 'surge' },
    { f: 271, pos: [3.6, 2.0, 4.6], look: [0, 1.25, -2.2], fov: 38 },
  ],
  summon: [
    { f: 272, pos: [3.6, 2.0, 4.6], look: [0, 1.25, -2.2], fov: 38 },
    { f: 330, pos: [2.8, 1.9, 4.4], look: [0.6, 1.2, -1.4], fov: 39, ease: 'surge' },
    { f: 426, pos: [2.2, 1.8, 3.8], look: [0.9, 1.15, -1.0], fov: 38, ease: 'surge' },
    { f: 478, pos: [2.6, 1.85, 4.2], look: [1.2, 1.1, -0.6], fov: 38 },
  ],
  breath: [
    { f: 479, pos: [-4.0, 4.5, 9.0], look: [-16, 4.0, -6], fov: 48 },
    { f: 521, pos: [-5.0, 4.2, 8.0], look: [-16, 3.8, -6], fov: 46, ease: 'surge' },
    { f: 569, pos: [-6.0, 4.0, 7.0], look: [-16, 3.6, -5.5], fov: 45 },
  ],
  blink: [
    { f: 570, pos: [5.4, 2.2, 5.0], look: [1.7, 1.1, -0.4], fov: 40 },
    { f: 605, pos: [4.9, 2.0, 4.0], look: [1.7, 1.1, -0.4], fov: 38, ease: 'surge' },
    { f: 641, pos: [4.6, 1.9, 3.6], look: [1.7, 1.1, -0.4], fov: 37 },
  ],
  number: [
    { f: 642, pos: [4.6, 1.9, 3.6], look: [1.7, 1.1, -0.4], fov: 37 },
    { f: 672, pos: [3.6, 2.1, 5.4], look: [0.9, 2.6, -2.6], fov: 38, ease: 'surge' },
    { f: 700, pos: [3.1, 1.95, 4.7], look: [0.8, 2.5, -2.5], fov: 36, ease: 'surge' },
  ],
  frown: [
    { f: 701, pos: [3.1, 1.95, 4.7], look: [0.8, 2.5, -2.5], fov: 36 },
    { f: 737, pos: [3.2, 1.9, 4.0], look: [0, 1.3, -2.2], fov: 38, ease: 'surge' },
    { f: 779, pos: [2.8, 1.85, 3.6], look: [0, 1.25, -2.2], fov: 37 },
  ],
  visiting: [
    { f: 780, pos: [-5.0, 4.5, 8.5], look: [-15, 4.2, -6], fov: 46 },
    { f: 810, pos: [-6.0, 4.2, 7.5], look: [-15.5, 4.0, -5.5], fov: 45, ease: 'surge' },
    { f: 840, pos: [-7.0, 4.0, 6.5], look: [-16, 3.8, -5.5], fov: 44 },
  ],
  fewer: [
    { f: 841, pos: [3.2, 2.0, 4.6], look: [0, 1.3, -2.2], fov: 38 },
    { f: 860, pos: [2.8, 1.9, 4.2], look: [0.6, 1.25, -1.6], fov: 38, ease: 'surge' },
    { f: 878, pos: [2.5, 1.85, 3.9], look: [0.8, 1.2, -1.2], fov: 37 },
  ],
  relatives: [
    { f: 879, pos: [-4.5, 4.5, 9.0], look: [-18, 5.0, -7], fov: 48 },
    { f: 920, pos: [-5.5, 4.2, 8.0], look: [-19, 5.2, -7], fov: 47, ease: 'surge' },
    { f: 962, pos: [-6.5, 4.0, 7.0], look: [-20, 5.5, -7.5], fov: 46 },
  ],
  laugh: [
    { f: 963, pos: [3.4, 2.0, 4.6], look: [0.6, 1.3, -1.2], fov: 38 },
    { f: 992, pos: [3.0, 1.9, 4.2], look: [0.6, 1.3, -1.8], fov: 38, ease: 'surge' },
    { f: 1022, pos: [2.7, 1.85, 3.8], look: [0.6, 1.28, -1.8], fov: 37 },
  ],
  gold: [
    { f: 1023, pos: [2.7, 1.85, 3.8], look: [0.6, 1.28, -1.8], fov: 37 },
    { f: 1070, pos: [3.4, 1.9, 3.8], look: [1.4, 1.1, -0.6], fov: 37, ease: 'surge' },
    { f: 1118, pos: [3.1, 1.8, 3.4], look: [1.4, 1.05, -0.7], fov: 36 },
  ],
  moral: [
    { f: 1119, pos: [3.1, 1.8, 3.4], look: [1.4, 1.05, -0.7], fov: 36 },
    { f: 1162, pos: [2.8, 1.9, 4.0], look: [1.2, 1.2, -0.8], fov: 38, ease: 'surge' },
    { f: 1207, pos: [2.6, 1.85, 3.8], look: [1.2, 1.15, -0.8], fov: 37 },
    { f: 1277, pos: [2.5, 1.8, 3.6], look: [1.3, 1.1, -0.7], fov: 37 },
  ],
  moon: [
    { f: 1278, pos: [11.0, 2.6, 6.8], look: [16.1, 1.3, -1.0], fov: 46 },
    { f: 1337, pos: [11.5, 2.4, 6.0], look: [16.1, 1.3, -1.0], fov: 45, ease: 'surge' },
    { f: 1388, pos: [12.0, 2.2, 5.2], look: [16.1, 1.3, -1.0], fov: 44 },
  ],
  well: [
    { f: 1389, pos: [13.8, 2.0, 3.6], look: [16, 1.3, -1.8], fov: 40 },
    { f: 1448, pos: [15.0, 5.2, 4.8], look: [16.2, 1.0, -1.8], fov: 38, ease: 'surge' },
    { f: 1516, pos: [15.4, 4.6, 6.0], look: [16.2, 1.6, -2.2], fov: 37, ease: 'surge' },
    { f: 1569, pos: [15.8, 2.6, 6.8], look: [16.1, 2.8, -3.0], fov: 40 },
  ],
  hook: [
    { f: 1570, pos: [15.8, 2.6, 6.8], look: [16.1, 2.8, -3.0], fov: 40 },
    { f: 1601, pos: [16, 3.0, 9.0], look: [16, 2.8, -2.8], fov: 37, ease: 'surge' },
    { f: 1630, pos: [16, 3.2, 10.5], look: [16, 2.6, -2.5], fov: 38, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['number', 'well', 'hook', 'moon'].includes(S.id)) cinf = 3.6;
  if (S.id === 'gold') cinf = 3.2;
  if (['breath', 'visiting', 'relatives'].includes(S.id)) cinf = 2.5;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardCrows: 0, boardNumber: 0, boardMoon: 0, goldK: 0, moonK: 0 };
  if (S.id === 'hookQ') W.boardCrows = 1 - smooth(ramp(f, 56, 70));
  if (S.id === 'number') W.boardNumber = smooth(ramp(f, 662, 670)) * (1 - smooth(ramp(f, 693, 699)));
  if (S.id === 'gold' || S.id === 'moral') W.goldK = S.id === 'gold' ? smooth(ramp(f, 1033, 1070)) : 1;
  if (S.id === 'moon') W.moonK = smooth(ramp(f, 1310, 1378));
  if (S.id === 'well' || S.id === 'hook') W.moonK = 1;
  if (S.id === 'hook') W.boardMoon = smooth(ramp(f, 1569, 1593));   // NO fade-out: holds 1.0 to the last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'moonlit' ? 0.18 : 0.35), dustRate: 0.1, splashRate: 0 };
};

// ---------- flying crows ----------
// 7 crows. Default: circling above the current scene centre. During
// 'visiting' they fly IN from the east sky to the grove; during 'relatives'
// they fly OUT west and rise. All paths deterministic, feet-free (birds).
const CROW_N = 7;
// Circle radius by scene: tight (3) over the grove so birds stay in the
// narrow 9:16 frame, wide (6) over the court where only wide shots see sky.
const circleAt = (f, i, cx, cz, r = 6, h = 7.5) => {
  const a = f * 0.008 + i * 0.9;
  return { p: [cx + r * Math.cos(a), h + Math.sin(f * 0.05 + i) * 0.8, cz + r * Math.sin(a)], yaw: a + Math.PI / 2, flap: f * 0.9 + i * 1.7, s: 1 };
};
export const flyCrowsAt = (f) => {
  const S = shotAt(f);
  const out = [];
  for (let i = 0; i < CROW_N; i++) {
    if (S.id === 'visiting') {
      // compact flock flies in from the east sky to the grove
      const t = smooth(ramp(f, 746 + i * 3, 817));
      out.push({ p: lerp3([4 + i * 1.2, 10 + i * 0.4, -9 + i * 1.0], [-14 - i * 0.5, 7 + i * 0.3, -5 + i * 0.6], t), yaw: -Math.PI / 2, flap: f * 0.9 + i * 1.7, s: 1 });
    } else if (S.id === 'relatives') {
      const t = smooth(ramp(f, 874 + i * 3, 960));
      out.push({ p: lerp3([-14 - i * 0.5, 7 + i * 0.3, -5 + i * 0.6], [-32 - i * 1.5, 10 + i * 0.5, -9 + i * 1.0], t), yaw: -Math.PI / 2, flap: f * 0.9 + i * 1.7, s: 1 });
    } else if (S.id === 'breath') {
      out.push(circleAt(f, i, -16, -5, 3, 8.5));
    } else if (S.id === 'moon' || S.id === 'well' || S.id === 'hook') {
      // one crow crosses the moonlit sky above the well, the rest circle high
      if (i === 0) {
        const t = smooth(ramp(f, 1277, 1630));
        out.push({ p: lerp3([6, 9, -8], [26, 10, -6], t), yaw: -Math.PI / 2, flap: f * 0.9, s: 1 });
      } else out.push(circleAt(f, i, 16, -2, 4, 8));
    } else {
      out.push(circleAt(f, i, 0, -2, 6, 9));
    }
  }
  return out;
};

// ---------- actors ----------
const TINT = { dusk: '#ffd9a3', day: '#ffffff', moonlit: '#d8dcff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — king: crimson royal robe + gold crown + grey moustache,
// stout build, seated on the throne (stands beside the minister for the gold
// beat). Minister: deep-blue long robe + cream turban. Courtiers: purple
// court dress. Guards: red uniform + shako. Moon-seller: worn poor clothes.
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  minister: { jacket: '#2e5a8c', pants: '#22344a', boots: '#2e2118', hat: 'turban', skin: '#c98a5a', dress: '#2e5a8c' },
  courtierL: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
  courtierR: { jacket: '#6e4a3a', pants: '#33243d', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
  seller: { jacket: '#a08b6d', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#3a2a1a', skin: '#c98a5a' },
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
    case 'hookQ': {
      out.push(kingSit('stern'));
      out.push(st(OUTFITS.minister, 'neutral', 41, MINISTER, { yaw: -0.2 }));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'neutral', 72, COURT_R, { yaw: -0.2 }));
      guards();
      break;
    }
    case 'answer': {
      out.push(kingSit('neutral'));
      const k = bowK(f, 133, 154, 180, 193) * 0.4;
      out.push(RW(T, OUTFITS.minister, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...bowOpts(k) }, BP(MINISTER, k), { tint, yaw: -0.2 }));
      out.push(st(OUTFITS.courtierL, 'neutral', 71, COURT_L, { yaw: 0.2 }));
      guards();
      break;
    }
    case 'bored': {
      out.push(kingSit('dazed'));
      out.push(st(OUTFITS.minister, 'neutral', 41, MINISTER, { yaw: -0.2 }));
      out.push(st(OUTFITS.courtierR, 'neutral', 72, COURT_R, { yaw: -0.2 }));
      break;
    }
    case 'summon': {
      out.push(kingSit('stern'));
      const bk = bowK(f, 426, 434, 475, 478);
      out.push(RW(T, OUTFITS.minister, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...bowOpts(bk) }, BP(MINISTER, bk), { tint, yaw: -0.2 }));
      out.push(st(OUTFITS.courtierL, 'nervous', 71, COURT_L, { yaw: 0.2 }));
      guards();
      break;
    }
    case 'breath': case 'visiting': case 'relatives': {
      // camera is on the grove / sky — the court is out of frame; crows are 3D
      break;
    }
    case 'blink': {
      out.push(st(OUTFITS.minister, 'neutral', 41, MINISTER, { yaw: -0.2 }));
      out.push(kingSit('stern'));
      break;
    }
    case 'number': {
      out.push(kingSit('stern'));
      out.push(st(OUTFITS.minister, 'grin', 41, MINISTER, { yaw: -0.2 }));
      out.push(st(OUTFITS.courtierL, 'shock', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'shock', 72, COURT_R, { yaw: -0.2 }));
      guards();
      break;
    }
    case 'frown': {
      out.push(kingSit('stern'));
      out.push(st(OUTFITS.minister, 'neutral', 41, MINISTER, { yaw: -0.2 }));
      break;
    }
    case 'fewer': {
      out.push(kingSit('stern'));
      out.push(st(OUTFITS.minister, 'neutral', 41, MINISTER, { yaw: -0.2 }));
      out.push(st(OUTFITS.courtierL, 'shock', 71, COURT_L, { yaw: 0.2 }));
      break;
    }
    case 'laugh': {
      out.push(kingSit('laugh'));
      out.push(st(OUTFITS.minister, 'smile', 41, MINISTER, { yaw: -0.2 }));
      out.push(st(OUTFITS.courtierL, 'laugh', 71, COURT_L, { yaw: 0.2 }));
      out.push(st(OUTFITS.courtierR, 'grin', 72, COURT_R, { yaw: -0.2 }));
      guards('grin', 'grin');
      break;
    }
    case 'gold': {
      // the king stands beside the minister and claps his shoulder (wave arm)
      const wv = f >= 1024 && f <= 1095 ? q(0.5 + 0.5 * Math.sin(f * 0.25), 2) : 0;
      out.push(RW(T, OUTFITS.king, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 31), seed: 31, wave: wv }, [0.9, 0, -0.5], { tint, yaw: 0.35 }));
      out.push(st(OUTFITS.minister, 'grin', 41, MINISTER, { yaw: -0.2 }));
      out.push(st(OUTFITS.courtierL, 'grin', 71, COURT_L, { yaw: 0.2 }));
      break;
    }
    case 'moral': {
      out.push(RW(T, OUTFITS.king, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, [0.9, 0, -0.5], { tint, yaw: 0.35 }));
      out.push(st(OUTFITS.minister, 'smile', 41, MINISTER, { yaw: -0.2 }));
      out.push(st(OUTFITS.courtierR, 'neutral', 72, COURT_R, { yaw: -0.2 }));
      break;
    }
    case 'moon': {
      out.push(st(OUTFITS.seller, f < 1388 ? 'nervous' : 'grin', 91, SELLER, { yaw: 0.4 }));
      out.push(st(OUTFITS.king, 'neutral', 31, KINGWELL, { yaw: -0.5 }));
      break;
    }
    case 'well': {
      const pk = q(smooth(ramp(f, 1399, 1436)) * (1 - smooth(ramp(f, 1496, 1539))), 2);
      out.push(RW(T, OUTFITS.seller, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['point', pk] }, SELLER, { tint, yaw: 0.4 }));
      out.push(st(OUTFITS.king, f < 1516 ? 'neutral' : 'grin', 31, KINGWELL, { yaw: -0.5 }));
      break;
    }
    case 'hook': {
      out.push(st(OUTFITS.seller, 'grin', 91, SELLER, { yaw: 0.4 }));
      out.push(st(OUTFITS.king, 'dazed', 31, KINGWELL, { yaw: -0.5 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
