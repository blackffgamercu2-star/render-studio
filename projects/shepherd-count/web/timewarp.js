// Identity time warp — this film is built NATIVELY on its own N1 stem
// (picture keyed directly to the new timing), so there is no retime.
// The file exists so the shared *61 gate scripts (which import
// warpF/unwarpF/WARP from every project) run unchanged: slope is 1.0
// everywhere, so their retime compensation is a no-op and the RAW
// limits are the verdict.
export const WARP = [[0, 0], [1799, 1799]];
export const warpF = (f) => f;
export const unwarpF = (f) => f;
