// Shot plan for "पत्थर का सूप" (batch-4 topic 3, HI) — timed to the ACTUAL
// Hindi voice stem (63.89 s, 30 fps, TOTAL 1917), clause timings from
// faster-whisper alignment (soup-hindi-voice/timing.json; CB[] below is
// patched from it — CB[i] = first frame of clause i+1, CB[25] = TOTAL).
// Clauses: 1 hook summary | 2 wander door A | 3 no bread | 4 sits, fire,
// water | 5 STONE DROP | 6 woman asks | 7 "पत्थर का सूप!" | 8 "थोड़ा नमक" |
// 9 SALT pour | 10 farmer leans | 11 "प्याज़ पड़े तो…" | 12 ONIONS drop |
// 13 "बिल्कुल सही" | 14 "गाजर पड़ जाएँ…" | 15 CARROTS drop | 16 POTATOES |
// 17 BEANS | 18 CHICKEN | 19 village gathers, he stirs | 20 he serves |
// 21 feast | 22 "सब कुछ सिर्फ़ एक पत्थर से!" | 23 STONE OUT + pocket |
// 24 "यह हर बार काम करता है" | 25 rice-grain hook (king's court).
// QUALITY RULES (locked): shots change ONLY at clause boundaries; camera
// TRACKS the voice-named subject (biggest/centred), never freezes, never
// drifts; characters act in place — no walk-glide; costumes by role.
// PHYSICS RULES (Abid 2026-11-15, top priority): the cauldron rests ON its
// hearth stones with a contact shadow; every ingredient is carried in the
// hand (card prop), handed off to a 3D twin that FALLS with gravity INTO
// the pot (splash at entry, sinks, never hovers beside the pot); the ladle
// dips INTO the soup and rests ON the rim; the stone rises WITH his hand
// out of the pot and is pocketed.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1917, DECK = 0;
// Clause start frames patched from soup-hindi-voice/timing.json (faster-whisper
// base word timestamps, boundaries hand-verified on ASR content words).
const CB = [0, 133, 179, 231, 337, 398, 467, 560, 621, 649, 706, 758, 793, 846, 918, 943, 965, 985, 1043, 1187, 1285, 1352, 1407, 1525, 1630, 1917];
const cS = (i) => CB[i - 1];            // clause i first frame (1-based)
const cE = (i) => CB[i] - 1;            // clause i last frame
const cL = (i) => CB[i] - CB[i - 1];    // clause i length
const at = (i, t) => cS(i) + Math.round(t * cL(i));  // frame at fraction t of clause i

export const SHOTS = [
  { id: 'hook', a: CB[0], b: CB[1] - 1, light: 'day' },
  { id: 'wander', a: CB[1], b: CB[3] - 1, light: 'day' },
  { id: 'setup', a: CB[3], b: CB[5] - 1, light: 'day' },
  { id: 'woman', a: CB[5], b: CB[9] - 1, light: 'day' },
  { id: 'farmer', a: CB[9], b: CB[12] - 1, light: 'day' },
  { id: 'more', a: CB[12], b: CB[18] - 1, light: 'day' },
  { id: 'gather', a: CB[18], b: CB[19] - 1, light: 'day' },
  { id: 'feast', a: CB[19], b: CB[22] - 1, light: 'day' },
  { id: 'stoneout', a: CB[22], b: CB[24] - 1, light: 'day' },
  { id: 'hook2', a: CB[24], b: TOTAL - 1, light: 'day' },
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
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const POT = [0, 0, -1.0];          // the cauldron, centre of the square
export const SIGNP = [32, 3.4, -2.0];     // hook board on its signpost (court)
const SOUP_Y = 1.30;                      // liquid surface inside the cauldron
const TRAV = [-1.6, 0, -1.0];             // the traveller's station, west of the pot
const WOMAN = [1.75, 0, -0.8];
const FARMER = [-1.35, 0, -2.5];
const CARROTW = [1.6, 0, -2.35];
const POTATOM = [-1.75, 0, 0.35];
const BEANSG = [1.85, 0, 0.3];
const PRIEST = [-2.35, 0, -2.1];

const HERO = {
  hook: () => [-1.2, 1.1, -0.9],
  wander: (f) => f < cS(3) ? [-16.8, 1.1, -2.2] : [15.2, 1.1, -2.2],
  setup: () => [0, 1.2, -1.0],
  woman: () => [0.6, 1.2, -0.9],
  farmer: () => [-0.9, 1.2, -1.9],
  more: () => [0, 1.2, -1.2],
  gather: () => [0, 1.2, -1.0],
  feast: () => [0, 1.2, -0.9],
  stoneout: () => [-1.2, 1.2, -0.95],
  hook2: () => [31.3, 1.2, -3.3],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- event frames (single source of truth for drops/pours) ----------
const FIRE_START = at(4, 0.18);
const POUR_S = at(4, 0.52), POUR_E = POUR_S + 26;
const STONE_DROP = at(5, 0.38), STONE_DUR = 11;
const SALT_S = at(9, 0.30), SALT_E = SALT_S + 16;
const ON1_DROP = at(12, 0.22), ON_DUR = 10, ON2_DROP = ON1_DROP + 15;
const CAR_DROP = at(15, 0.30), CAR_DUR = 11;
const TAT_DROP = at(16, 0.30), TAT_DUR = 11;
const BEAN_DROP = at(17, 0.30), BEAN_DUR = 9;
const CHK_DROP = at(18, 0.35), CHK_DUR = 13;
const RISE_S = at(23, 0.22), RISE_E = RISE_S + 16, POCKET_E = RISE_E + 22;
const entry = (drop, dur) => drop + dur;   // frame the item breaks the surface
// soup richness 0..1 — steps up as each ingredient lands
const SOUP_KEYS = [[0, 0], [entry(SALT_S, 8), 0.15], [entry(ON2_DROP, ON_DUR), 0.3], [entry(CAR_DROP, CAR_DUR), 0.45],
  [entry(TAT_DROP, TAT_DUR), 0.6], [entry(BEAN_DROP, BEAN_DUR), 0.75], [entry(CHK_DROP, CHK_DUR), 1.0]];
// splash bursts: [frame, [x, y, z, n, power]]
const SPLASHES = [
  [POUR_S + 3, [POT[0], SOUP_Y + 0.08, POT[2] + 0.2, 20, 3.5]],
  [entry(STONE_DROP, STONE_DUR), [POT[0], SOUP_Y + 0.08, POT[2] + 0.25, 28, 4.6]],
  [SALT_S + 9, [POT[0] + 0.1, SOUP_Y + 0.08, POT[2] + 0.25, 10, 2.2]],
  [entry(ON1_DROP, ON_DUR), [POT[0] - 0.12, SOUP_Y + 0.08, POT[2] + 0.26, 16, 3.4]],
  [entry(ON2_DROP, ON_DUR), [POT[0] + 0.14, SOUP_Y + 0.08, POT[2] + 0.22, 16, 3.4]],
  [entry(CAR_DROP, CAR_DUR), [POT[0] + 0.02, SOUP_Y + 0.08, POT[2] + 0.26, 20, 3.8]],
  [entry(TAT_DROP, TAT_DUR), [POT[0] - 0.06, SOUP_Y + 0.08, POT[2] + 0.24, 22, 4.0]],
  [entry(BEAN_DROP, BEAN_DUR), [POT[0] + 0.08, SOUP_Y + 0.08, POT[2] + 0.28, 14, 2.8]],
  [entry(CHK_DROP, CHK_DUR), [POT[0] - 0.02, SOUP_Y + 0.08, POT[2] + 0.25, 32, 5.0]],
  [RISE_S + 2, [POT[0] - 0.08, SOUP_Y + 0.08, POT[2] + 0.22, 12, 2.6]],
];
const SPLASH_MAP = new Map(SPLASHES);
export const splashAt = (f) => SPLASH_MAP.has(f) ? [SPLASH_MAP.get(f)] : [];

// ---------- cameras ----------
// First key of each shot repeats the previous shot's last key (continuous
// flight); inside a shot a key lands exactly on every clause boundary and
// the camera surges TO the clause's named subject.
const CAMS = {
  hook: [
    { f: CB[0], pos: [6.5, 3.4, 9.5], look: [0, 1.6, -1.6], fov: 46 },
    { f: at(1, 0.42), pos: [5.2, 2.9, 7.9], look: [-0.35, 1.95, -2.2], fov: 43, ease: 'surge' },
    { f: CB[1] - 1, pos: [3.1, 2.05, 4.2], look: [-1.35, 1.2, -0.85], fov: 38, ease: 'surge' },
  ],
  wander: [
    { f: CB[1], pos: [3.1, 2.05, 4.2], look: [-1.35, 1.2, -0.85], fov: 38 },
    { f: at(2, 0.35), pos: [-11.5, 2.5, 5.0], look: [-16.4, 1.35, -2.4], fov: 42, ease: 'surge' },
    { f: CB[2] - 1, pos: [-12.2, 2.3, 4.4], look: [-16.5, 1.3, -2.4], fov: 40, ease: 'surge' },
    { f: CB[2], pos: [-12.2, 2.3, 4.4], look: [-16.5, 1.3, -2.4], fov: 40 },
    { f: at(3, 0.4), pos: [11.0, 2.6, 6.0], look: [15.6, 1.3, -2.4], fov: 42, ease: 'surge' },
    { f: CB[3] - 1, pos: [12.0, 2.35, 4.6], look: [15.4, 1.3, -2.4], fov: 40, ease: 'surge' },
  ],
  setup: [
    { f: CB[3], pos: [12.0, 2.35, 4.6], look: [15.4, 1.3, -2.4], fov: 40 },
    { f: at(4, 0.3), pos: [5.0, 2.7, 6.2], look: [-0.7, 1.0, -1.0], fov: 43, ease: 'surge' },
    { f: POUR_S, pos: [3.5, 2.25, 4.4], look: [-0.35, 1.25, -1.0], fov: 40, ease: 'surge' },
    { f: CB[4], pos: [3.3, 2.15, 4.1], look: [-0.3, 1.25, -1.0], fov: 39, ease: 'surge' },
    { f: STONE_DROP, pos: [3.1, 2.6, 5.0], look: [-0.55, 1.3, -0.95], fov: 38, ease: 'surge' },
    { f: CB[5] - 1, pos: [3.0, 2.55, 4.8], look: [-0.55, 1.28, -0.95], fov: 38, ease: 'surge' },
  ],
  woman: [
    { f: CB[5], pos: [3.0, 2.55, 4.8], look: [-0.55, 1.28, -0.95], fov: 38 },
    { f: at(6, 0.4), pos: [4.3, 2.3, 5.0], look: [0.95, 1.25, -0.85], fov: 41, ease: 'surge' },
    { f: CB[6], pos: [4.2, 2.25, 4.8], look: [0.95, 1.25, -0.85], fov: 40, ease: 'surge' },
    { f: at(7, 0.45), pos: [3.3, 2.3, 6.6], look: [0, 2.95, -3.0], fov: 45, ease: 'surge' },
    { f: CB[7], pos: [3.2, 2.25, 6.3], look: [0, 2.9, -3.0], fov: 44, ease: 'surge' },
    { f: at(8, 0.5), pos: [3.4, 2.1, 4.4], look: [-1.3, 1.25, -1.0], fov: 39, ease: 'surge' },
    { f: CB[8], pos: [3.3, 2.05, 4.2], look: [-1.3, 1.25, -1.0], fov: 38, ease: 'surge' },
    { f: SALT_S, pos: [3.5, 2.3, 5.4], look: [0.7, 1.3, -0.9], fov: 41, ease: 'surge' },
    { f: CB[9] - 1, pos: [3.4, 2.25, 5.2], look: [0.7, 1.3, -0.9], fov: 40, ease: 'surge' },
  ],
  farmer: [
    { f: CB[9], pos: [3.4, 2.25, 5.2], look: [0.7, 1.3, -0.9], fov: 40 },
    { f: at(10, 0.4), pos: [-3.4, 2.3, 4.4], look: [-1.25, 1.3, -2.3], fov: 41, ease: 'surge' },
    { f: CB[10], pos: [-3.3, 2.25, 4.2], look: [-1.25, 1.3, -2.3], fov: 40, ease: 'surge' },
    { f: at(11, 0.5), pos: [-3.1, 2.2, 4.0], look: [-1.3, 1.3, -2.3], fov: 40, ease: 'surge' },
    { f: CB[11], pos: [-3.0, 2.15, 3.9], look: [-1.3, 1.3, -2.3], fov: 39, ease: 'surge' },
    { f: ON1_DROP, pos: [-2.9, 2.65, 4.1], look: [-0.3, 1.3, -1.2], fov: 38, ease: 'surge' },
    { f: CB[12] - 1, pos: [-2.8, 2.6, 3.9], look: [-0.3, 1.3, -1.2], fov: 37, ease: 'surge' },
  ],
  more: [
    { f: CB[12], pos: [-2.8, 2.6, 3.9], look: [-0.3, 1.3, -1.2], fov: 37 },
    { f: at(13, 0.5), pos: [3.0, 2.1, 4.6], look: [-1.3, 1.25, -1.1], fov: 39, ease: 'surge' },
    { f: CB[13], pos: [2.9, 2.05, 4.4], look: [-1.3, 1.25, -1.1], fov: 38, ease: 'surge' },
    { f: at(14, 0.5), pos: [2.7, 2.0, 4.1], look: [-1.4, 1.25, -1.05], fov: 38, ease: 'surge' },
    { f: CB[14], pos: [2.6, 1.95, 3.9], look: [-1.4, 1.25, -1.05], fov: 37, ease: 'surge' },
    { f: CAR_DROP, pos: [2.9, 2.75, 4.6], look: [0.1, 1.35, -1.1], fov: 38, ease: 'surge' },
    { f: CB[15], pos: [2.8, 2.7, 4.4], look: [0.1, 1.35, -1.1], fov: 37, ease: 'surge' },
    { f: TAT_DROP, pos: [-3.5, 2.7, 4.5], look: [-0.7, 1.3, -0.6], fov: 38, ease: 'surge' },
    { f: CB[16], pos: [-3.4, 2.65, 4.3], look: [-0.7, 1.3, -0.6], fov: 37, ease: 'surge' },
    { f: BEAN_DROP, pos: [3.7, 2.7, 4.3], look: [0.8, 1.3, -0.5], fov: 38, ease: 'surge' },
    { f: CB[17], pos: [3.6, 2.65, 4.1], look: [0.8, 1.3, -0.5], fov: 37, ease: 'surge' },
    { f: CHK_DROP, pos: [3.8, 2.85, 5.0], look: [-0.6, 1.35, -1.3], fov: 39, ease: 'surge' },
    { f: CB[18] - 1, pos: [3.7, 2.8, 4.8], look: [-0.6, 1.35, -1.3], fov: 38, ease: 'surge' },
  ],
  gather: [
    { f: CB[18], pos: [3.7, 2.8, 4.8], look: [-0.6, 1.35, -1.3], fov: 38 },
    { f: at(19, 0.35), pos: [5.8, 3.1, 7.8], look: [0, 1.35, -1.3], fov: 45, ease: 'surge' },
    { f: CB[19] - 1, pos: [4.6, 2.6, 6.0], look: [-0.3, 1.3, -1.05], fov: 41, ease: 'surge' },
  ],
  feast: [
    { f: CB[19], pos: [4.6, 2.6, 6.0], look: [-0.3, 1.3, -1.05], fov: 41 },
    { f: at(20, 0.5), pos: [4.4, 2.4, 5.7], look: [0, 1.3, -0.9], fov: 40, ease: 'surge' },
    { f: CB[20], pos: [4.3, 2.35, 5.5], look: [0, 1.3, -0.9], fov: 39, ease: 'surge' },
    { f: at(21, 0.5), pos: [4.1, 2.3, 5.3], look: [0.2, 1.25, -0.8], fov: 39, ease: 'surge' },
    { f: CB[21], pos: [4.0, 2.25, 5.1], look: [0.2, 1.25, -0.8], fov: 38, ease: 'surge' },
    { f: at(22, 0.4), pos: [3.7, 2.35, 6.7], look: [0, 2.7, -2.7], fov: 45, ease: 'surge' },
    { f: CB[22] - 1, pos: [3.6, 2.3, 6.4], look: [0, 2.65, -2.7], fov: 44, ease: 'surge' },
  ],
  stoneout: [
    { f: CB[22], pos: [3.6, 2.3, 6.4], look: [0, 2.65, -2.7], fov: 44 },
    { f: at(23, 0.3), pos: [2.9, 2.55, 4.2], look: [-0.5, 1.3, -0.95], fov: 38, ease: 'surge' },
    { f: CB[23], pos: [2.8, 2.5, 4.0], look: [-0.5, 1.3, -0.95], fov: 37, ease: 'surge' },
    { f: at(24, 0.45), pos: [3.2, 2.5, 7.0], look: [0, 2.8, -3.1], fov: 45, ease: 'surge' },
    { f: CB[24] - 1, pos: [3.1, 2.45, 6.8], look: [0, 2.75, -3.1], fov: 45, ease: 'surge' },
  ],
  hook2: [
    { f: CB[24], pos: [3.1, 2.45, 6.8], look: [0, 2.75, -3.1], fov: 45 },
    { f: at(25, 0.3), pos: [26.2, 2.7, 5.2], look: [31.6, 1.45, -3.5], fov: 42, ease: 'surge' },
    { f: at(25, 0.62), pos: [28.4, 2.45, 4.6], look: [31.4, 1.6, -3.2], fov: 40, ease: 'surge' },
    { f: at(25, 0.8), pos: [28.1, 2.5, 5.4], look: [32, 2.8, -2.2], fov: 41, ease: 'surge' },
    { f: TOTAL - 1, pos: [28.0, 2.45, 5.1], look: [32, 2.85, -2.2], fov: 39, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['setup', 'woman', 'farmer', 'more', 'stoneout'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook2') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
// A carried item hands off to its 3D twin: the twin appears at the drop
// frame above the pot rim on the carrier's side, falls with gravity
// (y eases as t^2), breaks the surface at drop+dur, sinks a little, hides.
const fallTrack = (f, drop, dur, from, to, sink = 0.16) => {
  if (f < drop || f > drop + dur + 7) return { p: [0, -99, 0], v: 0 };
  const t = clamp((f - drop) / dur);
  if (t < 1) return { p: [lerp(from[0], to[0], smooth(t)), lerp(from[1], to[1], t * t), lerp(from[2], to[2], smooth(t))], v: 1 };
  const s = clamp((f - drop - dur) / 7);
  return { p: [to[0], to[1] - sink * s, to[2]], v: s < 1 ? 1 : 0 };
};
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardTitle: 0, boardFeast: 0, boardWorks: 0, boardHook: 0,
    waterK: 0, soupK: 0, saltK: 0, pourK: 0,
    stoneP: [0, -99, 0], stoneV: 0, on1P: [0, -99, 0], on1V: 0, on2P: [0, -99, 0], on2V: 0,
    carP: [0, -99, 0], carV: 0, tatP: [0, -99, 0], tatV: 0, beanP: [0, -99, 0], beanV: 0,
    chkP: [0, -99, 0], chkV: 0, chkRz: 0, ladP: [0.66, 1.56, -0.72], ladR: [0.45, 0, -0.62], ladV: 0,
  };
  // boards
  if (S.id === 'hook') W.boardTitle = smooth(ramp(f, cS(1) + 8, cS(1) + 20)) * (1 - smooth(ramp(f, at(1, 0.30), at(1, 0.42))));
  if (S.id === 'woman' && f >= cS(7)) W.boardTitle = smooth(ramp(f, at(7, 0.5), at(7, 0.62))) * (1 - smooth(ramp(f, cE(7) - 5, cE(7) + 1)));
  if (S.id === 'feast' && f >= cS(22)) W.boardFeast = smooth(ramp(f, at(22, 0.45), at(22, 0.6)));
  if (S.id === 'stoneout' && f >= cS(24)) W.boardWorks = smooth(ramp(f, at(24, 0.42), at(24, 0.55)));
  if (S.id === 'hook2') W.boardHook = smooth(ramp(f, at(25, 0.82), at(25, 0.82) + 10));   // holds to the last frame — NO fade-out
  // water + soup
  W.waterK = (S.id === 'hook' || f >= POUR_S) ? 1 : 0;
  W.soupK = kf(SOUP_KEYS, f);
  W.pourK = (f >= POUR_S && f <= POUR_E) ? 1 : 0;
  W.saltK = (f >= SALT_S && f <= SALT_E) ? 1 : 0;
  // the stone: the drop (setup) …
  const sd = fallTrack(f, STONE_DROP, STONE_DUR, [-0.8, 1.7, -0.9], [POT[0], SOUP_Y - 0.16, POT[2] + 0.25], 0.14);
  if (sd.v) { W.stoneP = sd.p; W.stoneV = 1; }
  // … and the fish-out (stoneout): rises WITH his hand, dries, pockets
  if (f >= RISE_S && f <= POCKET_E) {
    W.stoneV = 1;
    if (f <= RISE_E) { const t = M.easeOut((f - RISE_S) / (RISE_E - RISE_S)); W.stoneP = lerp3([-0.08, SOUP_Y - 0.14, -0.78], [-1.02, 1.60, -0.88], t); }
    else if (f <= RISE_E + 12) W.stoneP = [-1.02, 1.60, -0.88];
    else { const t = smooth(clamp((f - RISE_E - 12) / 6)); W.stoneP = lerp3([-1.02, 1.60, -0.88], [-1.48, 1.02, -0.86], t); if (f > RISE_E + 18) W.stoneV = 0; }   // stone reaches his waist and is IN the pocket — gone
  }
  // ingredients
  const o1 = fallTrack(f, ON1_DROP, ON_DUR, [-0.5, 1.74, -1.32], [-0.12, SOUP_Y - 0.14, -0.74]);
  if (o1.v) { W.on1P = o1.p; W.on1V = 1; }
  const o2 = fallTrack(f, ON2_DROP, ON_DUR, [-0.38, 1.8, -1.42], [0.14, SOUP_Y - 0.14, -0.78]);
  if (o2.v) { W.on2P = o2.p; W.on2V = 1; }
  const ca = fallTrack(f, CAR_DROP, CAR_DUR, [0.48, 1.76, -1.34], [0.02, SOUP_Y - 0.13, -0.74]);
  if (ca.v) { W.carP = ca.p; W.carV = 1; }
  const ta = fallTrack(f, TAT_DROP, TAT_DUR, [-0.48, 1.72, -0.56], [-0.06, SOUP_Y - 0.13, -0.76]);
  if (ta.v) { W.tatP = ta.p; W.tatV = 1; }
  const be = fallTrack(f, BEAN_DROP, BEAN_DUR, [0.52, 1.8, -0.58], [0.08, SOUP_Y - 0.1, -0.72], 0.12);
  if (be.v) { W.beanP = be.p; W.beanV = 1; }
  const ch = fallTrack(f, CHK_DROP, CHK_DUR, [-0.56, 1.86, -1.3], [-0.02, SOUP_Y - 0.1, -0.75], 0.18);
  if (ch.v) { W.chkP = ch.p; W.chkV = 1; W.chkRz = 0.85 * clamp((f - CHK_DROP) / CHK_DUR); }
  // the ladle: rests ON the rim, dips IN to stir, tilts to serve
  const rest = { p: [0.66, 1.56, -0.72], r: [0.45, 0, -0.62] };
  if (f >= STONE_DROP && f < cS(19)) { W.ladV = 1; W.ladP = rest.p; W.ladR = rest.r; }
  if (S.id === 'gather') {
    W.ladV = 1; W.ladP = [-1.08, 1.54, -0.9];
    W.ladR = [0.16 * Math.sin(f * 2 * Math.PI / 46 + 1.2), 0, 1.33 + 0.14 * Math.sin(f * 2 * Math.PI / 46)];
  }
  if (S.id === 'feast' && f < cS(21)) {
    // serve clause: dip … pour to the front bowls … dip … pour again
    const L = cL(20), u = (f - cS(20)) / L;
    W.ladV = 1;
    if (u < 0.34) { W.ladP = [-1.08, 1.54, -0.9]; W.ladR = [0.1 * Math.sin(f * 2 * Math.PI / 40), 0, 1.33 + 0.1 * Math.sin(f * 2 * Math.PI / 40)]; }
    else if (u < 0.58) { const t = smooth(ramp(f, cS(20) + 0.36 * L, cS(20) + 0.44 * L)) * (1 - smooth(ramp(f, cS(20) + 0.52 * L, cS(20) + 0.58 * L))); W.ladP = lerp3([-1.08, 1.54, -0.9], [0.3, 1.66, -0.6], t); W.ladR = lerp3([0, 0, 1.3], [0.45, 0, -1.15], t); }
    else if (u < 0.72) { W.ladP = [-1.08, 1.54, -0.9]; W.ladR = [0.1 * Math.sin(f * 2 * Math.PI / 40), 0, 1.33]; }
    else { const t = smooth(ramp(f, cS(20) + 0.74 * L, cS(20) + 0.82 * L)) * (1 - smooth(ramp(f, cS(20) + 0.9 * L, cS(20) + 0.97 * L))); W.ladP = lerp3([-1.08, 1.54, -0.9], [-0.3, 1.66, -0.6], t); W.ladR = lerp3([0, 0, 1.3], [0.5, 0, -1.5], t); }
  }
  if ((S.id === 'feast' && f >= cS(21)) || S.id === 'stoneout') { W.ladV = 1; W.ladP = rest.p; W.ladR = rest.r; }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const fireRate = (S.id === 'hook' || f >= FIRE_START) && S.id !== 'hook2' ? 20 : 0;
  let steamRate = 0;
  if (f >= entry(CHK_DROP, CHK_DUR)) steamRate = 13;
  if (S.id === 'feast') steamRate = 17;
  if (S.id === 'stoneout') steamRate = 9;
  if (S.id === 'hook2' || S.id === 'wander') steamRate = 0;
  return { smokeRate: 0.35, dustRate: S.id === 'wander' ? 0.12 : 0.06, steamRate, fireRate, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { dusk: '#ffd9a3', lamp: '#ffcf96', day: '#ffffff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — traveller: worn simple clothes + cap; villagers in
// village dress (each a different colour); priest: cream + white turban;
// king: royal red + GOLD turban; poor farmer: plain worn clothes.
export const OUTFITS = {
  traveller: { jacket: '#8a6a4a', pants: '#5a4632', boots: '#3a2e22', hat: 'cap', cap: '#c9b896', skin: '#e8b08a' },
  woman: { jacket: '#b03a5a', dress: '#b03a5a', pants: '#5a2a3a', boots: '#3a2a22', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  farmer: { jacket: '#7a8a5a', pants: '#4a5240', boots: '#3a2e22', hat: 'cap', cap: '#e8dcc4', skin: '#c98a5a' },
  carrotW: { jacket: '#c96a2a', dress: '#c96a2a', pants: '#5a3a22', boots: '#3a2a22', hat: 'hair', hair: '#1c1410', skin: '#e8b08a' },
  potatoM: { jacket: '#6a5a7a', pants: '#3a3444', boots: '#2a2622', hat: 'cap', cap: '#d9c9a8', skin: '#c98a5a' },
  beansG: { jacket: '#3a7a8c', dress: '#3a7a8c', pants: '#2a4a54', boots: '#2a2622', hat: 'hair', hair: '#241a12', skin: '#f0c09a' },
  priest: { jacket: '#e8e0cc', dress: '#e8e0cc', pants: '#c9bfa5', boots: '#6a5a41', hat: 'turban', turban: '#f7f3e6', skin: '#c98a5a' },
  villager2: { jacket: '#5a7a9a', pants: '#3a4a5a', boots: '#2a2622', hat: 'cap', cap: '#c9b896', skin: '#e8b08a' },
  villager3: { jacket: '#7a9a4a', dress: '#7a9a4a', pants: '#44542e', boots: '#3a2e22', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  housewife: { jacket: '#8c5a7a', dress: '#8c5a7a', pants: '#4a3244', boots: '#3a2a22', hat: 'hair', hair: '#1c1410', skin: '#e8b08a' },
  king: { jacket: '#8c2432', dress: '#8c2432', pants: '#5a1622', boots: '#2a1a12', hat: 'turban', turban: '#e8b64c', skin: '#e8b08a', moustache: true },
  poorFarmer: { jacket: '#a8895a', pants: '#6e5a41', boots: '#4a3a28', hat: 'cap', cap: '#d9c9a8', skin: '#c98a5a' },
  minister: { jacket: '#3a2e4a', dress: '#3a2e4a', pants: '#2a2238', boots: '#1c1a17', hat: 'turban', turban: '#f7f3e6', skin: '#c98a5a', moustache: true },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const withProp = (T, tint, f) => (o, expr, seed, pos, prop, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed, prop }, pos, { tint, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f), wp = withProp(T, tint, f);
  switch (S.id) {
    case 'hook': {
      const k = q(kf([[cS(1), 0.55], [at(1, 0.45), 0.18], [cE(1), 0.3]], f), 2);
      out.push(wp(OUTFITS.traveller, 'grin', 61, TRAV, ['stone', k], { yaw: 0.3 }));
      break;
    }
    case 'wander': {
      if (f < cS(3)) {
        out.push(wp(OUTFITS.traveller, 'nervous', 61, [-17.4, 0, -1.5], ['bowl', 0.55], { yaw: 0.25 }));
        out.push(st(OUTFITS.housewife, 'stern', 62, [-16, 0, -3.15], { yaw: -0.1 }));
      } else {
        out.push(wp(OUTFITS.traveller, 'pained', 61, [14.6, 0, -1.5], ['bowl', 0.55], { yaw: -0.25 }));
        out.push(st(OUTFITS.housewife, 'stern', 63, [16, 0, -3.15], { yaw: 0.1 }));
      }
      break;
    }
    case 'setup': {
      if (f < POUR_S - 14) {
        out.push(RW(T, OUTFITS.traveller, { expr: 'neutral', mode: 'sit', blink: blinkAt(f, 61), seed: 61 }, [-1.5, 0, -0.95], { tint, yaw: 0.35 }));
      } else if (f < STONE_DROP) {
        const k = q(f >= POUR_S && f <= POUR_E ? kf([[POUR_S, 0.4], [POUR_S + 8, 0.88], [POUR_E, 0.88], [POUR_E + 8, 0.5]], f) : 0.45, 2);
        const prop = f >= POUR_E + 8 ? ['stone', q(kf([[POUR_E + 8, 0.25], [STONE_DROP, 0.95]], f), 2)] : ['bucket', k];
        out.push(wp(OUTFITS.traveller, 'neutral', 61, TRAV, prop, { yaw: 0.3 }));
      } else {
        out.push(st(OUTFITS.traveller, 'grin', 61, TRAV, { yaw: 0.3 }));
      }
      break;
    }
    case 'woman': {
      const tExpr = f >= cS(7) ? 'grin' : 'neutral';
      if (f >= cS(8) && f < cS(9)) out.push(wp(OUTFITS.traveller, 'grin', 61, TRAV, ['point', 0.8], { yaw: 0.3 }));
      else out.push(st(OUTFITS.traveller, tExpr, 61, TRAV, { yaw: 0.3 }));
      const wExpr = f < cS(7) ? 'neutral' : 'smile';
      if (f >= cS(9)) {
        const k = q(kf([[cS(9), 0.3], [SALT_S, 0.55], [SALT_S + 6, 0.97], [SALT_E, 0.97], [SALT_E + 10, 0.45]], f), 2);
        out.push(wp(OUTFITS.woman, 'smile', 64, WOMAN, ['saltbowl', k], { yaw: -0.3 }));
      } else out.push(st(OUTFITS.woman, wExpr, 64, WOMAN, { yaw: -0.3 }));
      break;
    }
    case 'farmer': {
      out.push(st(OUTFITS.traveller, 'grin', 61, TRAV, { yaw: 0.35 }));
      const fExpr = f < cS(11) ? 'neutral' : 'grin';
      if (f >= cS(12) && f < ON2_DROP) {
        const k = q(kf([[cS(12), 0.3], [ON1_DROP, 0.92]], f), 2);
        out.push(wp(OUTFITS.farmer, 'grin', 65, FARMER, ['onions', k], { yaw: 0.3 }));
      } else out.push(st(OUTFITS.farmer, fExpr, 65, FARMER, { yaw: 0.3 }));
      out.push(st(OUTFITS.woman, 'smile', 64, WOMAN, { yaw: -0.3 }));
      break;
    }
    case 'more': {
      if (f >= cS(13) && f < cS(14)) out.push(wp(OUTFITS.traveller, 'grin', 61, TRAV, ['point', 0.8], { yaw: 0.3 }));
      else out.push(st(OUTFITS.traveller, 'grin', 61, TRAV, { yaw: 0.3 }));
      out.push(st(OUTFITS.woman, 'smile', 64, WOMAN, { yaw: -0.3 }));
      out.push(st(OUTFITS.farmer, 'smile', 65, FARMER, { yaw: 0.3 }));
      if (f >= cS(15) && f < CAR_DROP) out.push(wp(OUTFITS.carrotW, 'smile', 66, CARROTW, ['carrots', q(kf([[cS(15), 0.3], [CAR_DROP, 0.92]], f), 2)], { yaw: -0.25 }));
      else out.push(st(OUTFITS.carrotW, 'smile', 66, CARROTW, { yaw: -0.25 }));
      if (f >= cS(16) && f < TAT_DROP) out.push(wp(OUTFITS.potatoM, 'neutral', 67, POTATOM, ['potatoes', q(kf([[cS(16), 0.3], [TAT_DROP, 0.92]], f), 2)], { yaw: 0.25 }));
      else out.push(st(OUTFITS.potatoM, 'neutral', 67, POTATOM, { yaw: 0.25 }));
      if (f >= cS(17) && f < BEAN_DROP) out.push(wp(OUTFITS.beansG, 'smile', 68, BEANSG, ['beans', q(kf([[cS(17), 0.3], [BEAN_DROP, 0.92]], f), 2)], { yaw: -0.25, s: 0.92 }));
      else out.push(st(OUTFITS.beansG, 'smile', 68, BEANSG, { yaw: -0.25, s: 0.92 }));
      if (f >= cS(18) && f < CHK_DROP) out.push(wp(OUTFITS.priest, 'neutral', 69, PRIEST, ['chicken', q(kf([[cS(18), 0.35], [CHK_DROP, 0.85]], f), 2)], { yaw: 0.25 }));
      else out.push(st(OUTFITS.priest, 'neutral', 69, PRIEST, { yaw: 0.25 }));
      break;
    }
    case 'gather': {
      out.push(st(OUTFITS.traveller, 'grin', 61, TRAV, { yaw: 0.3 }));
      out.push(wp(OUTFITS.woman, 'smile', 64, WOMAN, ['bowl', 0.4], { yaw: -0.3 }));
      out.push(wp(OUTFITS.farmer, 'smile', 65, FARMER, ['bowl', 0.4], { yaw: 0.3 }));
      out.push(wp(OUTFITS.carrotW, 'smile', 66, CARROTW, ['bowl', 0.4], { yaw: -0.25 }));
      out.push(wp(OUTFITS.potatoM, 'smile', 67, POTATOM, ['bowl', 0.4], { yaw: 0.25 }));
      out.push(wp(OUTFITS.beansG, 'smile', 68, BEANSG, ['bowl', 0.4], { yaw: -0.25, s: 0.92 }));
      out.push(wp(OUTFITS.priest, 'smile', 69, PRIEST, ['bowl', 0.4], { yaw: 0.25 }));
      out.push(wp(OUTFITS.villager2, 'smile', 70, [-0.8, 0, -3.1], ['bowl', 0.4], { yaw: 0.1 }));
      out.push(wp(OUTFITS.villager3, 'smile', 71, [0.9, 0, -3.15], ['bowl', 0.4], { yaw: -0.1 }));
      break;
    }
    case 'feast': {
      out.push(st(OUTFITS.traveller, 'grin', 61, TRAV, { yaw: 0.3 }));
      const eating = f >= cS(21);
      const bk = eating ? 0.18 : 0.4;
      out.push(wp(OUTFITS.woman, eating ? 'smile' : 'smile', 64, WOMAN, ['bowl', bk], { yaw: -0.3 }));
      out.push(wp(OUTFITS.farmer, eating ? 'lick' : 'smile', 65, FARMER, ['bowl', bk], { yaw: 0.3 }));
      out.push(wp(OUTFITS.carrotW, eating ? 'laugh' : 'smile', 66, CARROTW, ['bowl', bk], { yaw: -0.25 }));
      out.push(wp(OUTFITS.potatoM, eating ? 'smile' : 'smile', 67, POTATOM, ['bowl', bk], { yaw: 0.25 }));
      out.push(wp(OUTFITS.beansG, eating ? 'laugh' : 'smile', 68, BEANSG, ['bowl', bk], { yaw: -0.25, s: 0.92 }));
      out.push(wp(OUTFITS.priest, eating ? 'smile' : 'smile', 69, PRIEST, ['bowl', bk], { yaw: 0.25 }));
      out.push(wp(OUTFITS.villager2, eating ? 'smile' : 'smile', 70, [-0.8, 0, -3.1], ['bowl', bk], { yaw: 0.1 }));
      out.push(wp(OUTFITS.villager3, eating ? 'laugh' : 'smile', 71, [0.9, 0, -3.15], ['bowl', bk], { yaw: -0.1 }));
      if (f >= cS(22)) { /* board carries the line; faces laugh */ }
      break;
    }
    case 'stoneout': {
      if (f >= RISE_S && f < RISE_E + 12) out.push(wp(OUTFITS.traveller, 'grin', 61, TRAV, ['point', 0.85], { yaw: 0.3 }));
      else if (f >= RISE_E + 12 && f < POCKET_E + 6) out.push(wp(OUTFITS.traveller, 'grin', 61, TRAV, ['point', 0.85], { yaw: 0.3 }));
      else out.push(st(OUTFITS.traveller, 'grin', 61, TRAV, { yaw: 0.3 }));
      out.push(st(OUTFITS.woman, 'smile', 64, WOMAN, { yaw: -0.3 }));
      out.push(st(OUTFITS.farmer, 'laugh', 65, FARMER, { yaw: 0.3 }));
      out.push(st(OUTFITS.priest, 'smile', 69, PRIEST, { yaw: 0.25 }));
      break;
    }
    case 'hook2': {
      out.push(wp(OUTFITS.poorFarmer, f < at(25, 0.7) ? 'nervous' : 'neutral', 72, [30.3, 0, -3.0], ['point', 0.7], { yaw: 0.3 }));
      out.push(st(OUTFITS.king, f < at(25, 0.7) ? 'stern' : 'shock', 73, [32, 0.22, -4.0], { yaw: 0 }));
      out.push(st(OUTFITS.minister, 'neutral', 74, [33.7, 0.22, -3.6], { yaw: -0.3 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  // dry-stone sparkle as he rubs the stone dry at his chest
  if (f >= RISE_E + 2 && f <= RISE_E + 12) out.push({ key: 'dry_' + q((f - RISE_E - 2) / 10, 2), draw: (p) => T.fxBurst(p, q((f - RISE_E - 2) / 10, 2), '#ffe066', 8, 20, 110), x: -1.02, y: 1.62, z: -0.8, blob: false, shadow: false });
  // joy burst over the pot as the feast line lands
  if (f >= cS(22) + 4 && f <= cS(22) + 18) out.push({ key: 'joy_' + q((f - cS(22) - 4) / 14, 2), draw: (p) => T.fxBurst(p, q((f - cS(22) - 4) / 14, 2), '#ffd76a', 9, 24, 130), x: POT[0], y: 1.9, z: POT[2], blob: false, shadow: false });
  return out;
};
