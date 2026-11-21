// RUN 3 time warp: new-stem frames -> old story frames (see build_warp.py).
// CUT SNAP: RIG.camAt linearly interpolates its smoothed samples, so a
// fractional old frame just below a hard cut would smear the cut (the
// camera would slide through the teleport for one frame). warpF therefore
// snaps any value in (cut-1, cut) up to the cut frame — the new shot
// starts at most one new frame early, which the jerk gate's cut pad covers.
import { RIG_META } from './story.js';
const CUTS = RIG_META.hardCuts;
export const WARP = [[0.0, 0.0], [42.0, 40.29], [98.34, 88.83], [184.08, 160.35], [250.11, 227.82], [309.21, 290.01], [405.06, 374.4], [560.67, 548.25], [636.0, 621.24], [685.95, 668.4], [765.99, 749.61], [769.8, 752.34], [811.8, 801.03], [898.89, 891.0], [941.4, 945.39], [983.22, 987.66], [1043.34, 1044.36], [1064.4, 1069.86], [1089.15, 1091.85], [1156.2, 1151.04], [1193.91, 1183.8], [1225.8, 1217.19], [1268.88, 1258.83], [1301.4, 1297.8], [1328.4, 1327.86], [1399.8, 1396.41], [1457.31, 1455.87], [1509.0, 1519.71], [1524.6, 1542.54], [1597.89, 1639.17], [1800.0, 1800.0]];
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
export const unwarpF = (fo) => {
  const W = WARP;
  if (fo <= W[0][1]) return W[0][0] + (fo - W[0][1]) * (W[1][0] - W[0][0]) / (W[1][1] - W[0][1]);
  for (let i = 0; i < W.length - 1; i++) {
    const [x0, y0] = W[i], [x1, y1] = W[i + 1];
    if (fo <= y1) return x0 + (fo - y0) * (x1 - x0) / (y1 - y0);
  }
  const [x0, y0] = W[W.length - 2], [x1, y1] = W[W.length - 1];
  return x1 + (fo - y1) * (x1 - x0) / (y1 - y0);
};
