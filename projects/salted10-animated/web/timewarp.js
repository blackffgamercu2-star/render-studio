// SALTED10-ANIMATED time warp: new 10-line film frames -> old story
// frames (see build_warp10.py for the line->segment map). The map
// REORDERS the approved film's segments; jumps land on line-start
// frames (hard cuts on voice clauses). CUT SNAP kept from run 3: a
// fractional old frame just below a rig hard cut snaps up to the cut.
import { RIG_META } from './story.js';
const CUTS = RIG_META.hardCuts;
export const NEW_TOTAL = 1578;
export const WARP = [[0, 290], [147, 373], [148, 160], [290, 289], [291, 465], [398, 559], [399, 0], [546, 159], [547, 374], [689, 464], [690, 560], [828, 722], [829, 723], [946, 883], [947, 884], [1000, 945], [1107, 1043], [1108, 1259], [1259, 1508], [1260, 1509], [1275, 1530], [1361, 1652], [1577, 1799]];
export const warpF = (f) => {
  const W = WARP;
  let y;
  if (f <= W[0][0]) y = W[0][1] + (f - W[0][0]) * (W[1][1] - W[0][1]) / (W[1][0] - W[0][0]);
  else {
    y = null;
    for (let i = 0; i < W.length - 1; i++) {
      const [x0, y0] = W[i], [x1, y1] = W[i + 1];
      if (f <= x1) { y = y0 + (f - x0) * (y1 - y0) / (x1 - x0); break; }
    }
    if (y === null) {
      const [x0, y0] = W[W.length - 2], [x1, y1] = W[W.length - 1];
      y = y1 + (f - x1) * (y1 - y0) / (x1 - x0);
    }
  }
  for (const c of CUTS) if (y > c - 1 && y < c) { y = c; break; }
  return y;
};
// nearest-frame lookup inverse (the map is not monotonic): INV[fo] is
// the new frame whose warped image is closest to old frame fo. Exact
// (<1 frame) for every old frame the film actually shows.
const INV = (() => {
  const img = [];
  for (let f = 0; f < NEW_TOTAL; f++) img.push(warpF(f));
  const inv = new Array(1800);
  for (let fo = 0; fo < 1800; fo++) {
    let best = 0, bd = Infinity;
    for (let f = 0; f < NEW_TOTAL; f++) {
      const d = Math.abs(img[f] - fo);
      if (d < bd) { bd = d; best = f; }
    }
    inv[fo] = best;
  }
  return inv;
})();
export const unwarpF = (fo) => INV[Math.max(0, Math.min(1799, Math.round(fo)))];
