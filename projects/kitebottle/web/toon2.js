// Canvas character painter built to the MEASURED Ricks Clips spec
// (extracted skill references/reports/characters.md):
//  head = superellipse, H/W 0.94, crown n=1.70 (slightly pointed), jaw n=2.26 (fuller),
//  egg -0.125 (chin taper), +9% bulge on the facing side, plum ink #2b1a26 weighted to
//  the bottom, soft crescent shading on the side away from the light, NO blush,
//  NO eye catchlights. Eyes 0.26W apart, brows 0.17W at -0.20W, mouth at +0.19W,
//  interior #54212a. Body 3.5 head-heights: torso 1.1HH, legs 1.4HH, arms/legs single
//  ink strokes ~0.05W, hands = filled ink dots 0.11W, feet = round-cap strokes.
export const INK = '#2b1a26';
const WINE = '#54212a';

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Superellipse head outline points (canvas coords). s<0 = crown, s>0 = jaw.
export function headPoints(cx, cy, a, b, tiltDeg, faceDir) {
  const pts = []; const tilt = tiltDeg * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < 96; i++) {
    const t = i / 96 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const n = s < 0 ? 1.70 : 2.26;
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    x *= (1 - 0.125 * y);                       // chin taper
    if (Math.sign(x) === faceDir) x *= 1.09;    // facing-side bulge
    const px = x * a, py = y * b;
    pts.push([cx + px * ct - py * st, cy + px * st + py * ct]);
  }
  return pts;
}
function pathFrom(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function rotAround(x, y, cx, cy, deg) { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }

// opts: skin, shirt, belt, hair, hairStyle 'sweep'|'tuft', faceDir +1|-1,
// lean (deg, upper body around hips), headTilt (deg), faceShift (x W units),
// eyes 'deadpan'|'laugh'|'half'|'blink'|'shock'|'happy', brows 'calm'|'raised'|'skeptic'|'stern',
// mouth 'dash'|'small'|'teeth'|'open'|'openO'|'wavy'|'pursed'|'flat', mouthScale, armR, armL (mode strings)
export function drawCharacter(o) {
  const S = 2, CW = 1520, CH = 2400;
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d'); g.scale(S, S); // draw in 760x1200 units
  const W = 340, a = W / 2, b = W * 0.94 / 2;         // head half-extents (W=340 units here: full width 340)
  const HCX = 380, HCY = 215;                          // head centre (760-wide canvas units)
  const HIPX = 380, HIPY = 702;
  const ink = INK;
  const rnd = mulberry(o.seed || 7);
  void rnd;

  // ---------- legs + feet (unrotated, planted) ----------
  g.strokeStyle = ink; g.lineCap = 'round';
  g.lineWidth = 19; // 0.055W
  g.beginPath(); g.moveTo(336, HIPY); g.quadraticCurveTo(320, 950, 304, 1160); g.stroke();
  g.beginPath(); g.moveTo(424, HIPY); g.quadraticCurveTo(440, 950, 456, 1160); g.stroke();
  g.lineWidth = 23; // feet ~0.07W thick, 0.2W long, pointing outward
  g.beginPath(); g.moveTo(304, 1162); g.lineTo(238, 1172); g.stroke();
  g.beginPath(); g.moveTo(456, 1162); g.lineTo(522, 1172); g.stroke();

  // ---------- upper body group (lean around hips) ----------
  g.save(); g.translate(HIPX, HIPY); g.rotate((o.lean || 0) * Math.PI / 180); g.translate(-HIPX, -HIPY);

  // torso: bean, 1.1HH tall, ~0.8W wide
  const tT = 350, tB = HIPY, tW = 272;
  g.beginPath();
  g.moveTo(HCX - tW / 2 + 18, tT + 26);
  g.bezierCurveTo(HCX - tW / 2 - 14, tT + 90, HCX - tW / 2 - 6, tB - 120, HCX - tW / 2 + 26, tB - 14);
  g.quadraticCurveTo(HCX, tB + 10, HCX + tW / 2 - 26, tB - 14);
  g.bezierCurveTo(HCX + tW / 2 + 6, tB - 120, HCX + tW / 2 + 14, tT + 90, HCX + tW / 2 - 18, tT + 26);
  g.quadraticCurveTo(HCX, tT - 14, HCX - tW / 2 + 18, tT + 26);
  g.closePath();
  g.fillStyle = o.shirt; g.fill();
  g.save(); g.clip(); // torso shading: soft shade from the side away from the sun (sun = screen right)
  const tg = g.createLinearGradient(HCX - tW / 2, 0, HCX + tW / 2, 0);
  tg.addColorStop(0, 'rgba(46,32,96,0.28)'); tg.addColorStop(0.45, 'rgba(46,32,96,0)');
  tg.addColorStop(1, 'rgba(255,238,196,0.20)');
  g.fillStyle = tg; g.fillRect(HCX - tW / 2 - 20, tT - 20, tW + 40, tB - tT + 40);
  g.restore();
  g.lineWidth = 5; g.strokeStyle = ink; g.stroke();
  // belt + buckle
  g.fillStyle = o.belt || '#3a2a20'; g.fillRect(HCX - tW / 2 + 8, tB - 40, tW - 16, 34);
  g.fillStyle = '#e8b64c'; g.fillRect(HCX - 17, tB - 36, 34, 26);
  g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(HCX - 17, tB - 36, 34, 26);
  // collar tick
  g.beginPath(); g.moveTo(HCX - 20, tT + 16); g.lineTo(HCX, tT + 40); g.lineTo(HCX + 20, tT + 16);
  g.lineWidth = 5; g.strokeStyle = ink; g.stroke();

  // ---------- arms (single ink strokes) + ink-dot hands ----------
  const SH = { L: [HCX - 128, 398], R: [HCX + 128, 398] };
  const armTo = (sh, elbow, hand) => {
    g.beginPath(); g.moveTo(sh[0], sh[1]); g.quadraticCurveTo(elbow[0], elbow[1], hand[0], hand[1]);
    g.lineWidth = 17; g.strokeStyle = ink; g.stroke();
    g.beginPath(); g.arc(hand[0], hand[1], 19, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
    return hand;
  };
  const ARMS = {
    grip:     { sh: 'R', el: [605, 345], hd: [640, 300] },
    downR:    { sh: 'R', el: [540, 540], hd: [512, 668] },
    downL:    { sh: 'L', el: [220, 540], hd: [248, 668] },
    gesture1: { sh: 'R', el: [578, 478], hd: [548, 508] },
    gesture2: { sh: 'R', el: [592, 418], hd: [578, 382] },
    point:    { sh: 'L', el: [290, 450], hd: [230, 490] },
    belly:    { sh: 'R', el: [560, 540], hd: [452, 596] },
    spool:    { sh: 'L', el: [198, 528], hd: [150, 640] },
    earcupR:  { sh: 'R', el: [606, 306], hd: [578, 228] },
    shrugR:   { sh: 'R', el: [614, 472], hd: [602, 392] },
    shrugL:   { sh: 'L', el: [146, 472], hd: [158, 392] },
    hipR:     { sh: 'R', el: [578, 522], hd: [524, 650] },
    tieL:     { sh: 'L', el: [402, 424], hd: [566, 312] },
    upR:      { sh: 'R', el: [592, 330], hd: [618, 186] },
    coverR:   { sh: 'R', el: [566, 430], hd: [452, 316] },
  };
  let gripPt = null, spoolPt = null;
  for (const side of ['L', 'R']) {
    const mode = side === 'L' ? o.armL : o.armR; if (!mode) continue;
    const A = ARMS[mode]; const hd = armTo(SH[A.sh], A.el, A.hd);
    if (mode === 'grip') gripPt = hd;
    if (mode === 'spool') { spoolPt = hd; // little wooden spool in the dot hand
      g.beginPath(); g.arc(hd[0], hd[1], 15, 0, Math.PI * 2); g.fillStyle = '#8a5a33'; g.fill();
      g.lineWidth = 3.5; g.strokeStyle = ink; g.stroke();
      g.beginPath(); g.arc(hd[0], hd[1], 6, 0, Math.PI * 2); g.fillStyle = '#5d3a1e'; g.fill();
    }
  }

  // ---------- head ----------
  const fd = o.faceDir || 1;
  const pts = headPoints(HCX, HCY, a, b, o.headTilt || 0, fd);
  // weighted ink underlay: scaled up + pushed down -> thick at the bottom, thin at the crown
  const under = headPoints(HCX, HCY + 5, a * 1.045, b * 1.045, o.headTilt || 0, fd);
  pathFrom(g, under); g.fillStyle = ink; g.fill();
  pathFrom(g, pts); g.fillStyle = o.skin; g.fill();
  // soft crescent shading, side away from the light (light from screen right)
  g.save(); pathFrom(g, pts); g.clip();
  const cg = g.createLinearGradient(HCX - a, 0, HCX + a * 0.35, 0);
  const tint = o.skinShade || 'rgba(216,164,120,0.55)';
  cg.addColorStop(0, tint); cg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = cg; g.fillRect(HCX - a - 8, HCY - b - 8, a * 2 + 16, b * 2 + 16);
  const wg = g.createLinearGradient(HCX + a, 0, HCX - a * 0.2, 0);
  wg.addColorStop(0, 'rgba(255,240,200,0.20)'); wg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = wg; g.fillRect(HCX - a - 8, HCY - b - 8, a * 2 + 16, b * 2 + 16);
  g.restore();
  pathFrom(g, pts); g.lineWidth = 4.5; g.strokeStyle = ink; g.stroke();

  // hair (clipped to the skull, sits low, follows the crown)
  g.save(); pathFrom(g, pts); g.clip();
  g.fillStyle = o.hair;
  g.beginPath();
  g.moveTo(HCX - a - 6, HCY - b * 0.18);
  g.bezierCurveTo(HCX - a * 0.7, HCY - b * 1.12, HCX + a * 0.7, HCY - b * 1.12, HCX + a + 6, HCY - b * 0.18);
  g.bezierCurveTo(HCX + a * 0.55, HCY - b * 0.52, HCX + a * 0.2, HCY - b * 0.38, HCX, HCY - b * 0.50);
  g.bezierCurveTo(HCX - a * 0.3, HCY - b * 0.62, HCX - a * 0.6, HCY - b * 0.40, HCX - a - 6, HCY - b * 0.18);
  g.closePath(); g.fill();
  g.restore();
  if (o.hairStyle === 'tuft') { // three tufts poking out of the crown
    g.fillStyle = o.hair;
    for (const [dx, dy, r] of [[-52, -b - 2, -0.5], [0, -b - 12, 0], [52, -b - 2, 0.5]]) {
      g.save(); g.translate(HCX + dx, HCY + dy); g.rotate(r * 0.4);
      g.beginPath(); g.moveTo(-13, 6); g.quadraticCurveTo(0, -34, 13, 6); g.closePath(); g.fill(); g.restore();
    }
  }

  // ---------- face (features shift toward the facing side) ----------
  const fx = (o.faceShift || 0) * W;
  const ey = HCY, exOff = 0.13 * W;
  const eyeY = ey, browY = HCY - 0.20 * W, mouthY = HCY + 0.19 * W;
  g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = 'round';
  const drawEye = (ex, kind) => {
    if (kind === 'deadpan' || kind === 'half') {
      const h = kind === 'deadpan' ? 15 : 6;
      g.beginPath(); g.moveTo(ex - 31, eyeY - 4); g.lineTo(ex + 31, eyeY - 4); g.lineWidth = 6; g.stroke();
      g.beginPath(); g.ellipse(ex, eyeY - 2, 31, h, 0, 0, Math.PI); g.fillStyle = ink; g.fill();
    } else if (kind === 'blink') {
      g.lineWidth = 6.5;
      g.beginPath(); g.moveTo(ex - 28, eyeY - 2); g.quadraticCurveTo(ex, eyeY + 9, ex + 28, eyeY - 2); g.stroke();
    } else if (kind === 'happy') {
      g.lineWidth = 7;
      g.beginPath(); g.moveTo(ex - 27, eyeY + 6); g.quadraticCurveTo(ex, eyeY - 26, ex + 27, eyeY + 6); g.stroke();
    } else if (kind === 'shock') {
      g.beginPath(); g.ellipse(ex, eyeY, 27, 31, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
      g.beginPath(); g.arc(ex, eyeY + 4, 6.5, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
    } else if (kind === 'laugh') {
      const s = ex < HCX + fx ? 1 : -1; // > for the left eye, < for the right eye
      g.lineWidth = 7.5;
      g.beginPath(); g.moveTo(ex - 24 * s, eyeY - 20); g.lineTo(ex + 20 * s, eyeY); g.lineTo(ex - 24 * s, eyeY + 20); g.stroke();
    }
  };
  drawEye(HCX + fx - exOff, o.eyes); drawEye(HCX + fx + exOff, o.eyes);
  // brows: tapered strokes 0.17W at -0.20W
  const brow = (bx, lift, ang) => {
    g.save(); g.translate(bx, browY - lift); g.rotate(ang);
    g.beginPath(); g.moveTo(-29, 0); g.lineTo(29, 0); g.lineWidth = 8.5; g.stroke(); g.restore();
  };
  if (o.brows === 'raised') { brow(HCX + fx - exOff, 10, -0.06); brow(HCX + fx + exOff, 10, 0.06); }
  else if (o.brows === 'skeptic') { brow(HCX + fx - exOff * fd, 2, 0.03 * fd); brow(HCX + fx + exOff * fd, 13, -0.10 * fd); }
  else if (o.brows === 'stern') { brow(HCX + fx - exOff, -4, 0.30); brow(HCX + fx + exOff, -4, -0.30); }
  else { brow(HCX + fx - exOff, 3, -0.03); brow(HCX + fx + exOff, 3, 0.03); }
  // mouths
  const mx = HCX + fx, ms = o.mouthScale || 1;
  g.fillStyle = WINE;
  if (o.mouth === 'dash') {
    g.save(); g.translate(mx, mouthY); g.rotate(-0.1); g.fillStyle = ink; g.fillRect(-21, -3, 42, 6); g.restore();
  } else if (o.mouth === 'flat') {
    g.save(); g.translate(mx, mouthY); g.fillStyle = ink; g.fillRect(-24, -3, 48, 6); g.restore();
  } else if (o.mouth === 'wavy') {
    g.lineWidth = 6; g.strokeStyle = ink;
    g.beginPath(); g.moveTo(mx - 34, mouthY);
    for (let k = 1; k <= 4; k++) g.quadraticCurveTo(mx - 34 + k * 17 - 8.5, mouthY + (k % 2 ? -10 : 10), mx - 34 + k * 17, mouthY);
    g.stroke();
  } else if (o.mouth === 'pursed') {
    g.beginPath(); g.ellipse(mx, mouthY, 11 * ms, 13 * ms, 0, 0, Math.PI * 2); g.fillStyle = WINE; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = ink; g.stroke();
  } else if (o.mouth === 'small') {
    g.beginPath(); g.ellipse(mx, mouthY, 16 * ms, 11 * ms, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(mx, mouthY, 16 * ms, 11 * ms, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#fff'; g.fillRect(mx - 16 * ms, mouthY - 11 * ms, 32 * ms, 6 * ms);
    g.fillStyle = '#c65b6b'; g.beginPath(); g.ellipse(mx, mouthY + 8 * ms, 9 * ms, 4.5 * ms, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.beginPath(); g.ellipse(mx, mouthY, 16 * ms, 11 * ms, 0, 0, Math.PI * 2); g.lineWidth = 3.5; g.strokeStyle = ink; g.stroke();
  } else { // 'teeth' grin, 'open' laugh, 'openO' round speaking mouth: D, teeth box + dividers, tongue
    const dims = o.mouth === 'open' ? [118, 76, 0.34] : o.mouth === 'openO' ? [96, 100, 0.18] : [82, 48, 0.34];
    const mw = dims[0] * ms, mh = dims[1] * ms;
    g.beginPath();
    g.moveTo(mx - mw / 2, mouthY - mh * 0.32);
    g.lineTo(mx + mw / 2, mouthY - mh * 0.32);
    g.bezierCurveTo(mx + mw / 2, mouthY + mh * 0.62, mx - mw / 2, mouthY + mh * 0.62, mx - mw / 2, mouthY - mh * 0.32);
    g.closePath(); g.fillStyle = WINE; g.fill();
    g.save(); g.clip();
    const th = mh * dims[2];
    g.fillStyle = '#fff'; g.fillRect(mx - mw / 2 + 3, mouthY - mh * 0.32, mw - 6, th);
    g.strokeStyle = ink; g.lineWidth = 3;
    for (const d of [-mw / 6, mw / 6]) { g.beginPath(); g.moveTo(mx + d, mouthY - mh * 0.32); g.lineTo(mx + d, mouthY - mh * 0.32 + th); g.stroke(); }
    g.beginPath(); g.moveTo(mx - mw / 2 + 3, mouthY - mh * 0.32 + th); g.lineTo(mx + mw / 2 - 3, mouthY - mh * 0.32 + th); g.stroke();
    g.fillStyle = '#d1707f'; g.beginPath(); g.ellipse(mx, mouthY + mh * 0.52, mw * 0.26, mh * 0.16, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.beginPath();
    g.moveTo(mx - mw / 2, mouthY - mh * 0.32);
    g.lineTo(mx + mw / 2, mouthY - mh * 0.32);
    g.bezierCurveTo(mx + mw / 2, mouthY + mh * 0.62, mx - mw / 2, mouthY + mh * 0.62, mx - mw / 2, mouthY - mh * 0.32);
    g.closePath(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
  }
  g.restore(); // end upper-body lean group

  // world-space anchors, back through the lean rotation
  const back = (p) => p ? rotAround(p[0], p[1], HIPX, HIPY, o.lean || 0) : null;
  return { canvas: cv, grip: back(gripPt), spool: back(spoolPt), W: 760, H: 1200 };
}
