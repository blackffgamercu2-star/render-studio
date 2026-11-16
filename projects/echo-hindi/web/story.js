// Shot plan for "वो आदमी जिसने अपनी गूँज बेच दी" (batch-5 topic 3, HI) — timed
// to the ACTUAL Hindi voice stem (69.49 s, 30 fps, TOTAL 2085), clause timings
// from faster-whisper alignment (echo-hindi-voice/timing.json — CB[] hand-
// verified on ASR word timestamps, CB[14] = TOTAL).
// Clauses: 1 hook summary | 2 poor man by the valley | 3 merchant shouts,
// valley answers | 4 "कौन है जो मेरा मज़ाक उड़ा रहा है?" | 5 the pitch —
// "my servant" for 100 gold coins | 6 merchant pays | 7 "क्या मैं अमीर
// बनूँगा?" echo "अमीर..." | 8 "क्या मेरे जहाज़ लौटेंगे?" + clap "बिल्कुल
// सही नौकर!" | 9 "मेरा सोना किसने चुराया?" echo "सोना..." | 10 "चोर का नाम
// बताओ!" echo "नाम..." | 11 smile dies, demands money back | 12 punchline —
// "You paid a hundred coins for your own voice." | 13 sailor hook (drink
// the whole sea by sunset).
// QUALITY RULES (locked): shots change ONLY at clause boundaries; camera
// TRACKS the voice-named subject (biggest/centred), never freezes, never
// drifts; characters act in place — no walk-glide; costumes by role.
// PHYSICS RULES (Abid 2026-11-15, top priority): the coin pouch rests ON
// the flat rock with a contact shadow; it is carried in the hand (card
// prop), set DOWN on the rock, picked UP again with the hand — never
// floating; the echo is visualised as expanding rings from the cliff face
// exactly when the valley answers; feet stay planted on valley ground.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 2085, DECK = 0;
// Clause start frames, hand-verified on ASR word timestamps.
const CB = [0, 117, 253, 412, 514, 787, 833, 1003, 1216, 1385, 1512, 1627, 1871, 2085];
const cS = (i) => CB[i - 1];            // clause i first frame (1-based)
const cE = (i) => CB[i] - 1;            // clause i last frame
const cL = (i) => CB[i] - CB[i - 1];    // clause i length
const at = (i, t) => cS(i) + Math.round(t * cL(i));  // frame at fraction t of clause i

export const SHOTS = [
  { id: 'hook', a: CB[0], b: CB[1] - 1, light: 'day' },
  { id: 'valley', a: CB[1], b: CB[2] - 1, light: 'day' },
  { id: 'shout', a: CB[2], b: CB[4] - 1, light: 'day' },
  { id: 'pitch', a: CB[4], b: CB[6] - 1, light: 'day' },
  { id: 'test1', a: CB[6], b: CB[7] - 1, light: 'day' },
  { id: 'test2', a: CB[7], b: CB[8] - 1, light: 'day' },
  { id: 'goldq', a: CB[8], b: CB[9] - 1, light: 'day' },
  { id: 'nameq', a: CB[9], b: CB[10] - 1, light: 'day' },
  { id: 'return', a: CB[10], b: CB[11] - 1, light: 'day' },
  { id: 'punch', a: CB[11], b: CB[12] - 1, light: 'day' },
  { id: 'hook2', a: CB[12], b: TOTAL - 1, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#1d3a52', waterShal: '#2c5a7d', glint: '#ffe9c0' };
export const LIGHTS = {
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const POT = [0, 0, -1.0];          // unused (kept for main.js compat)
export const SIGNP = [32, 3.4, -2.0];     // hook board on its signpost (shore)
export const ROCK = [0.35, 0, -1.7];      // flat rock the pouch rests on
export const ROCK_TOP = 0.22;              // top surface of the flat rock (low slab — stays out of foreground sightlines)
export const CLIFF = [0, 2.6, -5.4];      // cliff face centre — echo rings live here
const POOR = [-1.7, 0, -0.9];             // poor man's station (west)
const MERCH = [1.5, 0, -0.9];             // merchant's station (east)
const LEDGE = [0.2, 0, -2.4];             // valley edge — merchant shouts at the cliff from here
const SERV1 = [2.7, 0, -2.1];
const SERV2 = [0.5, 0, -2.3];
const SAILOR = [32.3, 0, -3.6];           // shore — directly below the hook board, clear of both signposts

const HERO = {
  hook: () => [-1.2, 1.1, -0.9],
  valley: () => [-1.7, 1.2, -0.9],
  shout: (f) => f < cS(4) ? [1.5, 1.3, -0.9] : [1.5, 1.4, -0.9],
  pitch: (f) => f < cS(6) ? [-1.7, 1.2, -0.9] : [0.35, 0.8, -1.7],
  test1: () => [0.2, 1.3, -2.4],
  test2: () => [0.2, 1.3, -2.4],
  goldq: () => [0.2, 1.3, -2.4],
  nameq: () => [0.2, 1.3, -2.4],
  return: () => [-1.2, 1.2, -0.9],
  punch: () => [-1.7, 1.2, -0.9],
  hook2: () => [32.3, 1.2, -3.6],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- event frames ----------
// Pouch handover (clause 6, 46 frames): merchant lowers the pouch onto the
// flat rock, it RESTS there, then the poor man lifts it with his hand.
const POUCH_DOWN = at(6, 0.30), POUCH_UP = at(6, 0.72);
// Echo answers — rings start the frame the valley speaks:
// c3 valley shouts back | c7 "अमीर..." | c8 "लौटेंगे..." | c9 "सोना..." | c10 "नाम..."
const ECHO_PULSES = [
  [at(3, 0.55), 26], [at(7, 0.62), 26], [at(8, 0.52), 26], [at(9, 0.68), 24], [at(10, 0.62), 24],
];

// ---------- cameras ----------
// First key of each shot repeats the previous shot's last key (continuous
// flight); inside a shot a key lands exactly on every clause boundary and
// the camera surges TO the clause's named subject.
const CAMS = {
  hook: [
    { f: CB[0], pos: [5.8, 3.0, 8.6], look: [-0.8, 1.5, -1.2], fov: 44 },
    { f: at(1, 0.45), pos: [4.4, 2.6, 6.8], look: [-1.2, 1.6, -1.0], fov: 42, ease: 'surge' },
    { f: CB[1] - 1, pos: [3.2, 2.2, 4.6], look: [-1.2, 1.3, -1.0], fov: 38, ease: 'surge' },
  ],
  valley: [
    { f: CB[1], pos: [3.2, 2.2, 4.6], look: [-1.2, 1.3, -1.0], fov: 38 },
    { f: at(2, 0.4), pos: [-4.2, 2.4, 4.6], look: [-1.7, 1.3, -0.9], fov: 42, ease: 'surge' },
    { f: CB[2] - 1, pos: [-3.6, 2.2, 4.2], look: [-1.7, 1.25, -0.9], fov: 40, ease: 'surge' },
  ],
  shout: [
    { f: CB[2], pos: [-3.6, 2.2, 4.2], look: [-1.7, 1.25, -0.9], fov: 40 },
    { f: at(3, 0.35), pos: [4.6, 2.5, 5.2], look: [1.5, 1.5, -1.6], fov: 42, ease: 'surge' },
    { f: at(3, 0.6), pos: [3.4, 2.6, 4.6], look: [0, 2.4, -5.4], fov: 40, ease: 'surge' },
    { f: CB[3], pos: [3.2, 2.4, 4.4], look: [1.2, 1.4, -1.2], fov: 39, ease: 'surge' },
    { f: at(4, 0.5), pos: [3.0, 2.2, 4.0], look: [1.5, 1.5, -0.9], fov: 39, ease: 'surge' },
    { f: CB[4] - 1, pos: [2.8, 2.15, 3.8], look: [1.5, 1.5, -0.9], fov: 38, ease: 'surge' },
  ],
  pitch: [
    { f: CB[4], pos: [2.8, 2.15, 3.8], look: [1.5, 1.5, -0.9], fov: 38 },
    { f: at(5, 0.3), pos: [-3.8, 2.3, 4.4], look: [-1.7, 1.3, -0.9], fov: 41, ease: 'surge' },
    { f: at(5, 0.7), pos: [-3.0, 2.1, 3.8], look: [-1.7, 1.4, -0.9], fov: 40, ease: 'surge' },
    { f: CB[5], pos: [-2.8, 2.05, 3.6], look: [-1.6, 1.35, -0.9], fov: 39, ease: 'surge' },
    { f: at(6, 0.3), pos: [3.6, 2.6, 5.2], look: [0.3, 0.9, -1.6], fov: 43, ease: 'surge' },
    { f: CB[6] - 1, pos: [3.8, 2.7, 5.8], look: [0.3, 0.9, -1.6], fov: 44, ease: 'surge' },
  ],
  test1: [
    { f: CB[6], pos: [3.8, 2.7, 5.8], look: [0.3, 0.9, -1.6], fov: 44 },
    { f: at(7, 0.3), pos: [3.6, 2.5, 4.8], look: [0.2, 1.5, -2.4], fov: 42, ease: 'surge' },
    { f: at(7, 0.65), pos: [2.8, 2.6, 4.4], look: [0, 2.3, -5.4], fov: 40, ease: 'surge' },
    { f: CB[7] - 1, pos: [3.0, 2.4, 4.2], look: [0.6, 1.5, -1.6], fov: 39, ease: 'surge' },
  ],
  test2: [
    { f: CB[7], pos: [3.0, 2.4, 4.2], look: [0.6, 1.5, -1.6], fov: 39 },
    { f: at(8, 0.3), pos: [3.6, 2.5, 4.8], look: [0.2, 1.5, -2.4], fov: 42, ease: 'surge' },
    { f: at(8, 0.55), pos: [2.8, 2.6, 4.4], look: [0, 2.3, -5.4], fov: 40, ease: 'surge' },
    { f: at(8, 0.85), pos: [3.2, 2.3, 4.4], look: [1.0, 1.4, -1.0], fov: 39, ease: 'surge' },
    { f: CB[8] - 1, pos: [3.1, 2.25, 4.2], look: [1.0, 1.4, -1.0], fov: 38, ease: 'surge' },
  ],
  goldq: [
    { f: CB[8], pos: [3.1, 2.25, 4.2], look: [1.0, 1.4, -1.0], fov: 38 },
    { f: at(9, 0.3), pos: [3.0, 2.2, 4.0], look: [0.4, 1.5, -2.2], fov: 39, ease: 'surge' },
    { f: at(9, 0.7), pos: [2.8, 2.6, 4.4], look: [0, 2.3, -5.4], fov: 40, ease: 'surge' },
    { f: CB[9] - 1, pos: [3.0, 2.4, 4.2], look: [0.4, 1.5, -2.0], fov: 39, ease: 'surge' },
  ],
  nameq: [
    { f: CB[9], pos: [3.0, 2.4, 4.2], look: [0.4, 1.5, -2.0], fov: 39 },
    { f: at(10, 0.3), pos: [3.4, 2.5, 4.6], look: [0.3, 1.6, -2.4], fov: 40, ease: 'surge' },
    { f: at(10, 0.65), pos: [2.8, 2.6, 4.4], look: [0, 2.3, -5.4], fov: 40, ease: 'surge' },
    { f: at(10, 0.9), pos: [-2.8, 2.2, 3.6], look: [0.6, 1.5, -2.2], fov: 38, ease: 'surge' },
    { f: CB[10] - 1, pos: [-2.8, 2.2, 3.6], look: [0.6, 1.5, -2.2], fov: 38, ease: 'surge' },
  ],
  return: [
    { f: CB[10], pos: [-2.8, 2.2, 3.6], look: [0.6, 1.5, -2.2], fov: 38 },
    { f: at(11, 0.4), pos: [-2.6, 2.2, 4.2], look: [-0.6, 1.3, -1.0], fov: 40, ease: 'surge' },
    { f: CB[11] - 1, pos: [-3.0, 2.3, 4.6], look: [-1.2, 1.3, -1.0], fov: 40, ease: 'surge' },
  ],
  punch: [
    { f: CB[11], pos: [-3.0, 2.3, 4.6], look: [-1.2, 1.3, -1.0], fov: 40 },
    { f: at(12, 0.3), pos: [-3.2, 2.3, 4.8], look: [-1.7, 1.4, -0.9], fov: 40, ease: 'surge' },
    { f: at(12, 0.55), pos: [3.4, 2.4, 6.6], look: [0, 3.0, -3.2], fov: 45, ease: 'surge' },
    { f: CB[12] - 1, pos: [3.3, 2.35, 6.4], look: [0, 2.9, -3.2], fov: 44, ease: 'surge' },
  ],
  hook2: [
    { f: CB[12], pos: [3.3, 2.35, 6.4], look: [0, 2.9, -3.2], fov: 44 },
    { f: at(13, 0.3), pos: [26.2, 2.7, 5.2], look: [32.3, 1.45, -3.6], fov: 42, ease: 'surge' },
    { f: at(13, 0.62), pos: [28.4, 2.45, 4.6], look: [32.2, 1.6, -3.5], fov: 40, ease: 'surge' },
    { f: at(13, 0.8), pos: [28.1, 2.5, 5.4], look: [32, 2.8, -2.2], fov: 41, ease: 'surge' },
    { f: TOTAL - 1, pos: [28.0, 2.45, 5.1], look: [32, 2.85, -2.2], fov: 39, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['pitch', 'test1', 'test2', 'goldq', 'nameq', 'punch'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook2') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardTitle: 0, boardPayoff: 0, boardHook: 0,
    pouchP: [ROCK[0], ROCK_TOP + 0.13, ROCK[2]], pouchV: 0,
  };
  // boards
  if (S.id === 'hook') W.boardTitle = smooth(ramp(f, cS(1) + 8, cS(1) + 20)) * (1 - smooth(ramp(f, at(1, 0.30), at(1, 0.42))));
  if (S.id === 'punch' && f >= at(12, 0.5)) W.boardPayoff = smooth(ramp(f, at(12, 0.5), at(12, 0.62)));
  if (S.id === 'hook2') W.boardHook = smooth(ramp(f, at(13, 0.82), at(13, 0.82) + 10));   // holds to the last frame — NO fade-out
  // the coin pouch: rests ON the flat rock between DOWN and UP
  if (f >= POUCH_DOWN && f <= POUCH_UP) W.pouchV = 1;
  return W;
};
export const splashAt = (f) => [];   // no splashes in this story
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.35, dustRate: S.id === 'hook2' ? 0.04 : 0.08, steamRate: 0, fireRate: 0, splashRate: 0 };
};

// ---------- actors ----------
// COSTUMES BY ROLE — poor man: worn simple clothes + cap; merchant: rich
// purple-red + GOLD turban + moustache; servants: plain grey-brown; sailor:
// navy jacket + white cap.
export const OUTFITS = {
  poor: { jacket: '#7a6a4a', pants: '#4a3a2a', boots: '#3a2e22', hat: 'cap', cap: '#b8a888', skin: '#c98a5a' },
  merchant: { jacket: '#6a2a4a', dress: '#6a2a4a', pants: '#3a1a2a', boots: '#2a1a12', hat: 'turban', turban: '#e8b64c', skin: '#e8b08a', moustache: true, sash: '#e8b64c' },
  servant1: { jacket: '#6a5a4a', pants: '#4a4238', boots: '#2a2622', hat: 'cap', cap: '#9a8a72', skin: '#c98a5a' },
  servant2: { jacket: '#5a5a48', pants: '#3a3a2e', boots: '#2a2622', hat: 'cap', cap: '#8a7a62', skin: '#e8b08a' },
  sailor: { jacket: '#2e5a8c', pants: '#e8e2d2', boots: '#3a2e22', hat: 'cap', cap: '#f7f3e6', skin: '#e8b08a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const withProp = (T, tint, f) => (o, expr, seed, pos, prop, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed, prop }, pos, { tint, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = '#ffffff', out = [];
  const st = stand(T, tint, f), wp = withProp(T, tint, f);
  switch (S.id) {
    case 'hook': {
      const k = q(kf([[cS(1), 0.55], [at(1, 0.45), 0.18], [cE(1), 0.3]], f), 2);
      out.push(wp(OUTFITS.poor, 'grin', 61, POOR, ['point', k], { yaw: 0.3 }));
      break;
    }
    case 'valley': {
      out.push(st(OUTFITS.poor, 'neutral', 61, POOR, { yaw: 0.3 }));
      break;
    }
    case 'shout': {
      if (f < cS(4)) {
        // merchant shouting at his servants; the valley shouts back
        out.push(wp(OUTFITS.merchant, 'shock', 62, MERCH, ['point', 0.9], { yaw: -0.3 }));
        out.push(st(OUTFITS.servant1, 'nervous', 63, SERV1, { yaw: 0.2 }));
        out.push(st(OUTFITS.servant2, 'nervous', 64, SERV2, { yaw: -0.2 }));
        out.push(st(OUTFITS.poor, 'neutral', 61, [-2.4, 0, -0.4], { yaw: 0.3 }));
      } else {
        // merchant stopped: "कौन है जो मेरा मज़ाक उड़ा रहा है?"
        out.push(st(OUTFITS.merchant, 'stern', 62, MERCH, { yaw: -0.3 }));
        out.push(st(OUTFITS.servant1, 'neutral', 63, SERV1, { yaw: 0.2 }));
        out.push(st(OUTFITS.servant2, 'neutral', 64, SERV2, { yaw: -0.2 }));
        out.push(st(OUTFITS.poor, 'neutral', 61, [-2.4, 0, -0.4], { yaw: 0.3 }));
      }
      break;
    }
    case 'pitch': {
      if (f < cS(6)) {
        // the poor man bows and pitches his "servant"
        out.push(st(OUTFITS.poor, 'nervous', 61, POOR, { yaw: 0.3 }));
        out.push(st(OUTFITS.merchant, 'neutral', 62, MERCH, { yaw: -0.3 }));
      } else if (f < POUCH_DOWN) {
        // merchant lowers the pouch toward the flat rock
        const k = q(kf([[cS(6), 0.5], [POUCH_DOWN, 0.95]], f), 2);
        out.push(wp(OUTFITS.merchant, 'grin', 62, [1.3, 0, -1.3], ['pouch', k], { yaw: -0.3 }));
        out.push(st(OUTFITS.poor, 'neutral', 61, [-0.7, 0, -1.5], { yaw: 0.3 }));
      } else if (f <= POUCH_UP) {
        // pouch RESTS on the rock; both look at it
        out.push(st(OUTFITS.merchant, 'grin', 62, [1.3, 0, -1.3], { yaw: -0.3 }));
        out.push(st(OUTFITS.poor, 'neutral', 61, [-0.7, 0, -1.5], { yaw: 0.3 }));
      } else {
        // poor man lifts the pouch WITH his hand, then pockets it
        const k = q(kf([[POUCH_UP, 0.95], [cE(6), 0.3]], f), 2);
        out.push(wp(OUTFITS.poor, 'grin', 61, [-0.7, 0, -1.5], ['pouch', k], { yaw: 0.3 }));
        out.push(st(OUTFITS.merchant, 'grin', 62, [1.3, 0, -1.3], { yaw: -0.3 }));
      }
      break;
    }
    case 'test1': {
      out.push(st(OUTFITS.poor, 'neutral', 61, [-2.3, 0, -0.5], { yaw: 0.3 }));
      if (f < at(7, 0.62)) out.push(wp(OUTFITS.merchant, 'shock', 62, LEDGE, ['point', 0.9], { yaw: 0 }));
      else out.push(st(OUTFITS.merchant, 'grin', 62, LEDGE, { yaw: 0 }));
      break;
    }
    case 'test2': {
      out.push(st(OUTFITS.poor, 'smile', 61, [-2.3, 0, -0.5], { yaw: 0.3 }));
      if (f < at(8, 0.52)) out.push(wp(OUTFITS.merchant, 'shock', 62, LEDGE, ['point', 0.9], { yaw: 0 }));
      else if (f < at(8, 0.85)) out.push(st(OUTFITS.merchant, 'grin', 62, LEDGE, { yaw: 0 }));
      else out.push(st(OUTFITS.merchant, 'laugh', 62, LEDGE, { yaw: 0 }));   // claps: "बिल्कुल सही नौकर!"
      break;
    }
    case 'goldq': {
      out.push(st(OUTFITS.poor, 'neutral', 61, [-2.3, 0, -0.5], { yaw: 0.3 }));
      if (f < at(9, 0.68)) out.push(wp(OUTFITS.merchant, 'shock', 62, LEDGE, ['point', 0.9], { yaw: 0 }));
      else out.push(st(OUTFITS.merchant, 'stern', 62, LEDGE, { yaw: 0 }));
      break;
    }
    case 'nameq': {
      out.push(st(OUTFITS.poor, 'neutral', 61, [-2.3, 0, -0.5], { yaw: 0.3 }));
      if (f < at(10, 0.62)) out.push(wp(OUTFITS.merchant, 'shock', 62, LEDGE, ['point', 0.95], { yaw: 0 }));
      else if (f < at(10, 0.9)) out.push(st(OUTFITS.merchant, 'pained', 62, LEDGE, { yaw: 0 }));
      else out.push(st(OUTFITS.merchant, 'dazed', 62, LEDGE, { yaw: 0 }));   // smile dies
      break;
    }
    case 'return': {
      out.push(st(OUTFITS.merchant, 'stern', 62, [1.2, 0, -1.0], { yaw: -0.3 }));
      out.push(st(OUTFITS.poor, 'neutral', 61, POOR, { yaw: 0.3 }));
      break;
    }
    case 'punch': {
      // poor man spreads his hands: "You paid a hundred coins for your own voice."
      out.push(st(OUTFITS.poor, 'smile', 61, POOR, { yaw: 0.3 }));
      out.push(st(OUTFITS.merchant, 'pained', 62, [1.2, 0, -1.0], { yaw: -0.3 }));
      break;
    }
    case 'hook2': {
      out.push(wp(OUTFITS.sailor, f < at(13, 0.7) ? 'grin' : 'nervous', 72, SAILOR, ['point', 0.7], { yaw: 0.3 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  // echo rings: expanding rings from the cliff face, exactly when the valley answers.
  // fxRing is drawn at canvas (300,300) = 1.519 world units above the card's
  // mesh origin (at s=2), so the mesh sits low and the RINGS land on the cliff.
  const RING_S = 2.0, RING_Y = CLIFF[1] - 1.519 * RING_S;
  ECHO_PULSES.forEach(([start, dur], i) => {
    if (f >= start && f <= start + dur) {
      const t = q((f - start) / dur, 2);
      out.push({ key: 'ring_' + i + '_' + t, draw: (p) => T.fxRing(p, t), x: CLIFF[0], y: RING_Y, z: CLIFF[2], s: RING_S, alpha: 0.9, blob: false, shadow: false });
    }
  });
  // joy burst over the merchant as he claps "बिल्कुल सही नौकर!" (fxBurst centre
  // sits 1.63 above the mesh origin, so y=0.7 puts it at head height)
  if (f >= at(8, 0.85) && f <= at(8, 0.85) + 14) out.push({ key: 'joy_' + q((f - at(8, 0.85)) / 14, 2), draw: (p) => T.fxBurst(p, q((f - at(8, 0.85)) / 14, 2), '#ffd76a', 9, 24, 130), x: LEDGE[0], y: 0.7, z: LEDGE[2], blob: false, shadow: false });
  return out;
};
