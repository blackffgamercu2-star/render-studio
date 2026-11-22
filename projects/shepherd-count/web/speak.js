// ============================================================
// SPEAK v4 — dialogue performance system.
// In this series the narration is voice-over, but QUOTED dialogue is
// performed by the character on screen: the mouth is driven by the
// voice itself (per-frame RMS envelope of the stem inside the beat),
// boosted on word onsets, closing in the gaps between words, with
// round-O narrowing on rounded vowels, head nods on stressed words
// and live eyebrows on every onset. Non-speakers keep closed mouths.
//
// Pipeline: an offline tool (project's speakgen) decodes the stem,
// builds the tracks with the functions below and bakes them as
// compact encoded strings (speakdata). At runtime the story reads
// SPEAK.at(f) and folds it into the actor's FACEP via applySpeak().
// Pure functions — no three.js, no DOM — so the gates can verify the
// tracks in Node (speakCheck).
// ============================================================

/** Per-frame RMS envelope of PCM samples (float -1..1), at fps. */
export function rmsEnvelope(samples, { sampleRate = 24000, fps = 30 } = {}) {
  const per = Math.round(sampleRate / fps), n = Math.floor(samples.length / per);
  const env = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0; const base = f * per;
    for (let i = 0; i < per; i++) { const v = samples[base + i]; sum += v * v; }
    env[f] = Math.sqrt(sum / per);
  }
  return env;
}

/** Attack/release smoothing (fast attack so onsets stay crisp). */
export function smoothEnv(env, { attack = 0.5, release = 0.62 } = {}) {
  const out = new Float32Array(env.length);
  let cur = 0;
  for (let f = 0; f < env.length; f++) {
    const v = env[f];
    cur = v > cur ? cur + (v - cur) * (1 - attack) : cur + (v - cur) * (1 - release);
    out[f] = cur;
  }
  return out;
}

const NO_ROUND = new Set(['of', 'on', 'one', 'other', 'others', 'everyone', 'once', 'kilometers', 'kilometer', 'done', 'come', 'some']);
/** Rounded-vowel word? (mouth narrows toward an O while it is spoken) */
export const isRoundWord = (w) => {
  const t = String(w).toLowerCase().replace(/[^a-z]/g, '');
  if (!t || NO_ROUND.has(t)) return false;
  return /o|ou|oo/.test(t);
};

/**
 * Build the baked performance tracks for a whole video.
 *   env:      smoothed RMS envelope (per frame)
 *   words:    ASR words [{ w, s, e }] in SECONDS
 *   segments: dialogue segments in FRAMES [[f0, f1], ...] (inclusive)
 *   stressed: lowercase word texts that get a head nod on their onset
 * Returns { open, mw, nod, brow, active } Float32Arrays (length = env.length).
 * Outside segments everything is 0 / inactive — mouths stay closed.
 */
export function buildMouthTrack({ env, words, segments, stressed = [], total = env.length }) {
  const open = new Float32Array(total), mw = new Float32Array(total);
  const nod = new Float32Array(total), brow = new Float32Array(total), active = new Uint8Array(total);
  const prox = new Float32Array(total).fill(1); // word-proximity factor: real pauses close the mouth
  const wf = words.map((W) => ({ t: String(W.w).toLowerCase().replace(/[^a-z]/g, ''), f0: Math.round(W.s * 30), f1: Math.round(W.e * 30) }));
  const stressSet = new Set(stressed.map((s) => s.toLowerCase()));
  for (const [s0, s1] of segments) {
    let peak = 0;
    for (let f = s0; f <= s1 && f < total; f++) peak = Math.max(peak, env[f] || 0);
    if (peak <= 0.001) continue;
    const gate = peak * 0.13, span = Math.max(0.02, peak * 0.94 - gate);
    const segWords = wf.filter((W) => W.f1 >= s0 && W.f0 <= s1);
    for (let f = s0; f <= s1 && f < total; f++) {
      active[f] = 1;
      const raw = env[f] || 0;
      let v = Math.min(1, Math.max(0, (raw - gate) / span));
      v = Math.pow(v, 0.8);
      if (raw > gate) v = Math.max(v, 0.17); // voiced floor: never a slit while sound plays
      const W = segWords.find((w) => f >= w.f0 && f <= w.f1);
      if (W && f - W.f0 <= 2) v = Math.min(1, v * 1.3 + 0.13); // onset boost
      open[f] = v;
      mw[f] = W && isRoundWord(W.t) ? 0.5 : 0.95;
      // distance to the nearest word span: inside = full voice, 1-2 frames
      // out = partial (mouth travelling shut), 3+ = a real pause → closed,
      // even if the envelope still rings (release smear / breath tail).
      let dist = 1e9;
      for (const w of segWords) dist = Math.min(dist, f < w.f0 ? w.f0 - f : f > w.f1 ? f - w.f1 : 0);
      prox[f] = dist === 0 ? 1 : dist <= 2 ? 0.55 : 0.18;
    }
    // word onsets: eyebrow pulse (every word) + nod (stressed words)
    for (const W of segWords) {
      for (let k = 0; k < 4; k++) { const f = W.f0 + k; if (f < total) brow[f] = Math.max(brow[f], 1 - k / 4); }
      if (stressSet.has(W.t)) for (let k = 0; k < 8; k++) { const f = W.f0 + k; if (f < total) nod[f] = Math.max(nod[f], 0.058 * Math.sin(Math.PI * k / 7)); }
    }
  }
  // gentle smoothing of open/mw inside segments (kills 1-frame flutter,
  // keeps onsets: forward pass only takes max with decayed previous),
  // then the word-proximity factor is applied LAST so pauses stay closed.
  let prevO = 0, prevM = 0.95;
  for (let f = 0; f < total; f++) {
    if (!active[f]) { prevO = 0; continue; }
    open[f] = Math.max(open[f], prevO * 0.55); prevO = open[f];
    mw[f] = prevM + (mw[f] - prevM) * 0.5; prevM = mw[f];
    open[f] *= prox[f];
  }
  return { open, mw, nod, brow, active };
}

/**
 * Fold one frame of performance into an actor's FACEP set.
 *   base: the actor's current expression params (faceP/Emotion output)
 *   s:    { open, active, mw, brow } for this frame
 * Not active → expression untouched (mouth as scripted: closed/grin).
 * Active + silent → mouth firmly closed (no teeth, no grin curve).
 * Active + voiced → mouth opens with the voice; teeth/tongue off so
 * the shape reads as speech, expression curve damped toward neutral.
 */
export function applySpeak(base, s) {
  const P = { ...base };
  if (s.brow > 0.03) { const b = -2.2 * s.brow; P.browInL += b; P.browOutL += b; P.browInR += b; P.browOutR += b; }
  if (!s.active) return P;
  if (s.open < 0.06) { P.mOpen = 0; P.teeth = 0; P.tongue = 0; P.wave = 0; P.curve = Math.max(-0.1, Math.min(P.curve, 0.15)); return P; }
  P.mOpen = s.open; P.mW = s.mw ?? P.mW;
  P.teeth = 0; P.tongue = 0; P.wave = 0; P.lickT = 0;
  P.curve = P.curve * 0.25;
  return P;
}

/**
 * Deterministic gate: per dialogue segment, the mouth must be OPEN on
 * the strong majority of voiced frames (frames inside ASR word spans)
 * and CLOSED on the strong majority of pause frames (inside the
 * segment but ≥2 frames away from any word span).
 */
export function speakCheck(open, words, segments, { openThresh = 0.25, closedThresh = 0.08 } = {}) {
  const wf = words.map((W) => [Math.round(W.s * 30), Math.round(W.e * 30)]);
  return segments.map(([s0, s1]) => {
    let voiced = 0, voicedOpen = 0, pause = 0, pauseClosed = 0;
    for (let f = s0; f <= s1; f++) {
      const inWord = wf.some(([a, b]) => f >= a && f <= b);
      const nearWord = wf.some(([a, b]) => f >= a - 2 && f <= b + 2);
      if (inWord) { voiced++; if ((open[f] || 0) >= openThresh) voicedOpen++; }
      else if (!nearWord) { pause++; if ((open[f] || 0) < closedThresh) pauseClosed++; }
    }
    return {
      seg: [s0, s1], voiced, voicedOpen, openPct: voiced ? +(100 * voicedOpen / voiced).toFixed(1) : null,
      pause, pauseClosed, closedPct: pause ? +(100 * pauseClosed / pause).toFixed(1) : null,
    };
  });
}

/** Compact bake: 0..1 floats → 2-digit-per-frame strings (and back). */
export const encodeTrack = (arr) => { let s = ''; for (let i = 0; i < arr.length; i++) s += String(Math.max(0, Math.min(99, Math.round(arr[i] * 99)))).padStart(2, '0'); return s; };
export const decodeTrack = (str) => { const out = new Float32Array(str.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(str.slice(i * 2, i * 2 + 2), 10) / 99; return out; };

/** Runtime reader over baked data: SPEAK.at(f) → { open, active, mw, brow, nod }. */
export function makeSpeakPlayer(data) {
  const open = decodeTrack(data.open), mw = decodeTrack(data.mw), nod = decodeTrack(data.nod), brow = decodeTrack(data.brow), active = decodeTrack(data.active);
  return { at: (f) => ({ open: open[f] || 0, mw: mw[f] ?? 0.95, nod: nod[f] || 0, brow: brow[f] || 0, active: (active[f] || 0) > 0.5 }) };
}
