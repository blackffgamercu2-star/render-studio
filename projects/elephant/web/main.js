import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, heroPosAt, BOAT, WATER_Y, BIG_BAL, SMALL_BAL } from './story.js';
import { WORDS } from './words.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const envMap = FX.detailEnv(renderer);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });

// ---------- ink / normal-depth contract ----------
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 }, aur: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, aur, time; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- text-board helper ----------
const textBoard = (lines, w, h, bg, fg, font = 900, fit = null) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  if (fit && fit.fsMul) fs *= fit.fsMul;
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
  lines.forEach((l, i) => {
    let fy;
    if (fit && fit.pitch && lines.length > 1) fy = 0.5 + (i - (lines.length - 1) / 2) * fit.pitch;
    else fy = lines.length === 1 ? 0.52 : (i + 0.5) / lines.length;
    if (fit && fit.dy) fy += fit.dy;
    g.fillText(l, c.width / 2, c.height * fy);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
const addBoardOccluder = (board, w, h, key) => {
  const occ = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ndMat);
  occ.position.copy(board.position); occ.rotation.copy(board.rotation);
  occ.userData.isOccluder = true; occ.userData.boardKey = key; board.parent.add(occ); return occ;
};

const MAT = {
  grass: texM(P.grass(6), 30, 30, '#7fae56'), sand: texM(M4.sandV4(15), 10, 10),
  dirt: texM(P.dirt(7), 2, 16, '#8a6844'), stone: texM(M4.stoneV4(8), 6, 4, '#a89a83'),
  ghat: texM(M4.stoneV4(9, { courses: 4 }), 8, 3, '#9a9184'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6, { base: '#6d4c2e', dark: '#402a16' }), 1, 2),
  woodPlank: texM(M4.woodV4(11, { planks: 3 }), 2, 1), woodPlank2: texM(M4.woodV4(17, { planks: 3, base: '#7a5a34' }), 2, 1),
  rail: toon({ color: '#8d949c' }), iron: toon({ color: '#3f4247' }),
  brass: toon({ color: '#c99635' }), white: toon({ color: '#f2ede0' }), dark: toon({ color: '#2c2620' }),
  roofR: toon({ color: '#b3543a' }), roofB: toon({ color: '#4a6a9e' }), roofG: toon({ color: '#5d7a3a' }),
  wallA: toon({ color: '#e8dcc0' }), wallB: toon({ color: '#d9b48f' }), wallC: toon({ color: '#cfe0d8' }), wallD: toon({ color: '#e6c9c9' }),
  leaf: toon({ color: '#4a7d32' }), leaf2: toon({ color: '#5d9440' }), trunk: texM(M4.woodV4(6), 1, 2, '#8a6844'),
  palace: texM(M4.stoneV4(14, { courses: 5, lig: 62 }), 8, 3, '#cbb693'),
  dome: toon({ color: '#2f7d8c' }), gold: toon({ color: '#e8b93c' }),
  rope: toon({ color: '#a07a4c' }), stonePile: texM(M4.stoneV4(21, { courses: 3, lig: 48 }), 1, 1),
};

// ============================================================
//  WORLD — one sunlit valley: station + track A (south), the HILL,
//  track B at its foot, fields + ditch, town + clock tower (north).
// ============================================================
// ============================================================
//  WORLD — one sunlit river ghat: palace backdrop (north), paved
//  courtyard, stone ghat steps descending to the river (south),
//  a planked boat on the water, jetty + hook board across the bay.
//  Hero props are REAL-PART builds (Abid correction 1):
//   ELEPHANT — segmented body/head/ears/trunk(curl)/tusks/legs+
//     toenails/tail-tuft, wrinkle-textured grey skin, heavy walk.
//   BOAT — individual hull planks + ribs + gunwale + rope coil +
//     mooring rope + gangplank; sinks/rises with load; the painted
//     waterline mark is a bright unlit band on the hull.
//   BALANCES — palace balance (beam SNAPS) + small balance.
//   STONES — irregular textured rocks in woven baskets / piles.
// ============================================================
const worldG = new THREE.Group(); scene.add(worldG);
let eleG = null, eleLegs = [], eleEars = [], eleTrunkSegs = [], eleTail = null, eleBody = null;
let boatG = null, boatMark = null, plankG = null, stoneGroups = [], rippleRings = [];
let bigBeamL = null, bigBeamR = null, bigPanL = null, bigPanR = null;
let smallBeam = null, numBoards = [], pileG = null, waterMat = null, waterTex = null;
const makeTree = (x, z, s = 1, parent = worldG) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.3 * s, 7), MAT.trunk, 0, 0.65 * s, 0, g, { cast: false });
  add(new THREE.SphereGeometry(1.05 * s, 10, 8), MAT.leaf, 0, 1.95 * s, 0, g, { cast: false });
  add(new THREE.SphereGeometry(0.75 * s, 9, 7), MAT.leaf2, 0.55 * s, 1.55 * s, 0.3 * s, g, { cast: false });
  add(new THREE.SphereGeometry(0.65 * s, 9, 7), MAT.leaf2, -0.5 * s, 1.6 * s, -0.25 * s, g, { cast: false });
  return g;
};
const makeHouse = (x, z, w, h, d, wallM, roofM, parent = worldG) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(tbox(w, h, d, 2), wallM, 0, h / 2, 0, g, { cast: false });
  const roof = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.08, h * 0.55, 4), roofM, 0, h + h * 0.27, 0, g, { cast: false });
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, d / w);
  add(tbox(0.7, 1.3, 0.1, 1), MAT.dark, 0, 0.65, -d / 2 - 0.03, g, { cast: false });
  return g;
};
const strut = (parent, a, b, r, mat) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 7), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};
// elephant skin: grey hide with wrinkle arcs + speckle (seeded, deterministic)
const eleSkinCanvas = () => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  let sd = 1234567; const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#9aa0a6'); gr.addColorStop(0.6, '#878d94'); gr.addColorStop(1, '#767c84');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '52,56,62' : '210,214,218'},${0.04 + rnd() * 0.08})`; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  g.strokeStyle = 'rgba(52,56,62,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 46; i++) { const x = rnd() * 512, y = rnd() * 512, r = 14 + rnd() * 42; g.beginPath(); g.arc(x, y, r, rnd() * 3, rnd() * 2 + 1.2); g.stroke(); }
  g.strokeStyle = 'rgba(230,233,236,0.18)';
  for (let i = 0; i < 30; i++) { const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 30; g.beginPath(); g.arc(x, y, r, rnd() * 3, rnd() * 2 + 1); g.stroke(); }
  return c;
};
const rockGeo = (s, seed) => { const geo = new THREE.DodecahedronGeometry(s, 0); geo.scale(1, 0.78, 0.9); return geo; };
const makeStone = (parent, x, y, z, s, seed = 1) => {
  const m = add(rockGeo(s), MAT.stonePile, x, y, z, parent, { cast: true });
  m.rotation.set(seed * 1.3 % 3, seed * 2.1 % 3, seed * 0.7 % 3); return m;
};
const makeBasket = (parent, x, y, z, s = 1, stones = true) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.34, 10, 1, true), texM(P.weave(9, [36, 48, 36]), 3, 1));
  wall.position.y = 0.17; wall.castShadow = true; g.add(wall);
  add(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 10), MAT.woodDk, 0, 0.02, 0, g, { cast: false });
  const rim = add(new THREE.TorusGeometry(0.34, 0.03, 6, 14), MAT.woodDk, 0, 0.34, 0, g, { cast: false }); rim.rotation.x = Math.PI / 2;
  if (stones) { makeStone(g, -0.1, 0.36, 0.02, 0.15, 3); makeStone(g, 0.12, 0.37, -0.04, 0.13, 5); makeStone(g, 0.01, 0.42, 0.05, 0.12, 7); }
  return g;
};
// a balance scale: post + beam group (two halves for the big one) + chains + pans
const makeBalance = (parent, x, y, z, s, big) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  add(tbox(1.5, 0.18, 0.7, 1), MAT.stone, 0, 0.09, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.07, 0.1, 2.5, 8), MAT.woodDk, 0, 1.4, 0, g, { cast: false });
  add(new THREE.SphereGeometry(0.11, 8, 7), MAT.brass, 0, 2.68, 0, g, { cast: false });
  const beamY = 2.62;
  const mkHalf = (dir) => {
    const bg = new THREE.Group(); bg.position.set(0, beamY, 0); g.add(bg);
    const beam = add(box(1.85, 0.09, 0.09), MAT.wood, dir * 0.92, 0, 0, bg, { cast: false });
    const panG = new THREE.Group(); panG.position.set(dir * 1.8, 0, 0); bg.add(panG);
    for (const a of [-0.3, 0.3]) strut(panG, [0, 0, a * 0.4], [a, -0.85, 0], 0.012, MAT.iron);
    strut(panG, [0, 0, 0], [0, -0.85, 0], 0.012, MAT.iron);
    const pan = add(new THREE.CylinderGeometry(0.52, 0.16, 0.16, 12), MAT.brass, 0, -0.92, 0, panG, { cast: false });
    return { bg, panG };
  };
  const L = mkHalf(-1), R = mkHalf(1);
  return { g, beamL: L.bg, beamR: R.bg, panL: L.panG, panR: R.panG };
};
let bigBal = null, smallBal = null;
{
  const g = worldG;
  // ground: grass banks + paved courtyard + sand shore
  const ground = flat(add(new THREE.PlaneGeometry(700, 240), MAT.grass, 0, -0.02, -112, g, { cast: false })); ground.receiveShadow = true;
  add(box(26, 0.06, 9), MAT.ghat, 0, 0.0, -0.6, g, { cast: false }); // paved courtyard before the steps
  add(box(30, 0.05, 3.4), MAT.sand, 0, -0.62, 6.4, g, { cast: false }); // shore strip at the water edge
  // ---- GHAT: 5 worn stone steps down to the water, side walls, posts + rope ----
  for (let i = 0; i < 5; i++) {
    const st = add(tbox(14, 0.16, 0.92, 2), i % 2 ? MAT.ghat : MAT.stone, 0, -0.08 - i * 0.15, 3.65 + i * 0.86, g, { cast: false });
    st.receiveShadow = true;
  }
  for (const sx of [-7.2, 7.2]) { add(tbox(0.5, 1.1, 4.6, 2), MAT.stone, sx, -0.3, 5.4, g, { cast: false }); }
  for (const [px, pz] of [[-6.6, 3.4], [6.6, 3.4], [-6.6, 7.3], [6.6, 7.3]]) {
    add(new THREE.CylinderGeometry(0.09, 0.11, 1.15, 8), MAT.woodDk, px, 0.35, pz, g, { cast: false });
    add(new THREE.SphereGeometry(0.12, 8, 7), MAT.brass, px, 0.95, pz, g, { cast: false });
  }
  strut(g, [-6.6, 0.82, 3.4], [-6.6, 0.55, 7.3], 0.03, MAT.rope);
  strut(g, [6.6, 0.82, 3.4], [6.6, 0.55, 7.3], 0.03, MAT.rope);
  // ---- WATER: layered river — textured plane (offset animates), foam at steps + shore ----
  waterTex = P.tex((() => { const c = document.createElement('canvas'); c.width = c.height = 256; const q = c.getContext('2d'); const gr = q.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a7d9e'); gr.addColorStop(1, '#1a5f80'); q.fillStyle = gr; q.fillRect(0, 0, 256, 256); let sd = 99; const rr = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; }; for (let i = 0; i < 90; i++) { q.strokeStyle = `rgba(190,235,250,${0.10 + rr() * 0.16})`; q.lineWidth = 1.5 + rr() * 1.5; const y = rr() * 256, x = rr() * 200, len = 20 + rr() * 46; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + len / 2, y + 3, x + len, y); q.stroke(); } for (let i = 0; i < 40; i++) { q.strokeStyle = `rgba(10,50,70,${0.12})`; q.lineWidth = 2; const y = rr() * 256, x = rr() * 200; q.beginPath(); q.moveTo(x, y); q.lineTo(x + 24 + rr() * 30, y); q.stroke(); } return c; })(), 14, 14);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterMat = toon({ map: waterTex });
  const water = flat(add(new THREE.PlaneGeometry(700, 300), waterMat, 0, WATER_Y, 157, g, { cast: false }));
  water.receiveShadow = true; water.userData.ndSkip = true;
  const foamM = new THREE.MeshBasicMaterial({ map: P.tex(M4.foamCanvas(21), 10, 1), transparent: true, depthWrite: false, fog: true });
  const foam = flat(add(new THREE.PlaneGeometry(30, 1.1), foamM, 0, WATER_Y + 0.02, 7.9, g, { cast: false })); foam.userData.ndSkip = true;
  // ---- PALACE backdrop (north): facade, arches, dome, minarets, flag ----
  const pal = new THREE.Group(); pal.position.set(0, 0, -10.5); g.add(pal);
  add(tbox(22, 4.6, 1.2, 3), MAT.palace, 0, 2.3, 0, pal, { cast: false });
  add(box(23, 0.5, 1.8), MAT.stone, 0, 4.85, 0, pal, { cast: false });
  for (const ax of [-7, -3.5, 0, 3.5, 7]) {
    add(box(1.7, 3.0, 0.3), MAT.dark, ax, 1.7, 0.65, pal, { cast: false });
    const arch = add(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 12, 1, false, 0, Math.PI), MAT.dark, ax, 3.2, 0.65, pal, { cast: false }); arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2;
    add(box(0.5, 0.8, 0.2), MAT.gold, ax, 3.9, 0.68, pal, { cast: false });
  }
  const dome = add(new THREE.SphereGeometry(2.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.dome, 0, 5.6, 0, pal, { cast: false });
  add(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 7), MAT.gold, 0, 8.0, 0, pal, { cast: false });
  add(new THREE.SphereGeometry(0.22, 8, 7), MAT.gold, 0, 8.6, 0, pal, { cast: false });
  for (const mx of [-10.5, 10.5]) {
    add(new THREE.CylinderGeometry(0.55, 0.7, 6.4, 10), MAT.palace, mx, 3.2, 0, pal, { cast: false });
    add(new THREE.ConeGeometry(0.85, 1.6, 10), MAT.dome, mx, 7.2, 0, pal, { cast: false });
  }
  add(box(1.3, 0.75, 0.06), MAT.roofR, 0.68, 8.3, 0, pal, { cast: false }); // flag
  // side houses + trees
  makeHouse(-13.5, -3, 4.2, 2.7, 3.2, MAT.wallB, MAT.roofB);
  makeHouse(13.5, -3.5, 4.6, 2.9, 3.4, MAT.wallC, MAT.roofG);
  makeHouse(16.5, 3.5, 4.0, 2.6, 3.0, MAT.wallD, MAT.roofR);
  for (const [x, z, s] of [[-9.5, -6, 1.3], [9.5, -6.5, 1.4], [-12, 6, 1.1], [12.5, 7.5, 1.2], [-16, -8, 1.5], [18, -9, 1.3], [-11, 14, 1.2], [14, 16, 1.1]]) makeTree(x, z, s);
  // ---- stone pile on the bank (the weighing stones) + spare baskets ----
  for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.55 * (i % 3); makeStone(g, -5.4 + Math.cos(a) * rr, 0.13 + (i > 5 ? 0.22 : 0), 4.7 + Math.sin(a) * rr * 0.7, 0.21 + (i % 4) * 0.035, i + 2); }
  makeBasket(g, -6.3, 0, 5.6, 1); makeBasket(g, -4.5, 0, 6.1, 1); makeBasket(g, 5.9, 0, 5.6, 1, false);
  // ---- BIG palace balance (west courtyard) ----
  bigBal = makeBalance(g, BIG_BAL.x, 0, BIG_BAL.z, 1.15, true);
  makeStone(bigBal.panL, 0, -0.78, 0, 0.3, 4); // a stone load sits in the left pan
  // ---- SMALL balance on its stone table (east) + counting slate ----
  add(tbox(1.7, SMALL_BAL.tableY, 1.1, 1), MAT.stone, SMALL_BAL.x, SMALL_BAL.tableY / 2, SMALL_BAL.z, g, { cast: false });
  smallBal = makeBalance(g, SMALL_BAL.x, SMALL_BAL.tableY, SMALL_BAL.z, 0.52, false);
  makeStone(smallBal.panL, 0, -0.78, 0, 0.3, 6); // the stone being weighed
  for (let i = 0; i < 3; i++) { const cw = add(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 10), MAT.brass, 0, -0.82 + i * 0.075, 0, smallBal.panR, { cast: false }); }
  // weighed-stone pile beside the small balance (grows in L12-L14)
  pileG = new THREE.Group(); pileG.position.set(3.1, 0, 3.3); g.add(pileG);
  for (let i = 0; i < 8; i++) { const a = i * 2.7, rr = 0.4 * (i % 3); makeStone(pileG, Math.cos(a) * rr, 0.14 + (i > 4 ? 0.26 : 0), Math.sin(a) * rr * 0.7, 0.26 + (i % 3) * 0.04, i + 11); }
  // ---- JETTY (for the L17 hook-board shot) ----
  const jet = new THREE.Group(); jet.position.set(2.7, 0, 28.0); g.add(jet);
  add(tbox(3.0, 0.14, 4.2, 2), MAT.woodPlank, 0, 0.08, 0, jet, { cast: false });
  for (const [px, pz] of [[-1.3, -1.9], [1.3, -1.9], [-1.3, 1.9], [1.3, 1.9]]) add(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 7), MAT.woodDk, px, -0.3, pz, jet, { cast: false });
  // board posts in the water at BOARD_POS
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) { add(new THREE.CylinderGeometry(0.07, 0.08, 3.6, 7), MAT.woodDk, px, 1.2, BOARD_POS[2], g, { cast: false }); add(new THREE.SphereGeometry(0.17, 9, 7), new THREE.MeshBasicMaterial({ color: '#ffe9b0' }), px, 3.1, BOARD_POS[2], g, { cast: false }); }

  // ================= ELEPHANT (segmented real-part build) =================
  eleG = new THREE.Group(); g.add(eleG);
  const skinM = texM(eleSkinCanvas(), 2, 1), skinDk = texM(eleSkinCanvas(), 1, 1, '#d6d9dd');
  eleBody = new THREE.Group(); eleBody.position.y = 0; eleG.add(eleBody);
  const bodyM = add(new THREE.SphereGeometry(1, 20, 14), skinM, 0, 1.62, 0, eleBody); bodyM.scale.set(1.72, 1.14, 1.02);
  const bellyM = add(new THREE.SphereGeometry(1, 16, 10), skinDk, -0.1, 1.42, 0, eleBody); bellyM.scale.set(1.5, 0.95, 0.82);
  add(new THREE.SphereGeometry(0.5, 12, 9), skinM, -1.35, 2.15, 0, eleBody).scale.set(1.1, 0.8, 0.9); // shoulder hump
  // head group
  const headG = new THREE.Group(); headG.position.set(1.78, 1.95, 0); eleBody.add(headG);
  add(new THREE.SphereGeometry(0.8, 18, 13), skinM, 0, 0, 0, headG).scale.set(1.02, 1.05, 0.94);
  add(new THREE.SphereGeometry(0.52, 12, 9), skinM, 0.28, 0.34, 0, headG).scale.set(1, 0.8, 0.9); // forehead dome
  for (const s of [-1, 1]) { // eyes + tusks
    add(new THREE.SphereGeometry(0.055, 8, 7), MAT.dark, 0.62, 0.12, s * 0.52, headG, { cast: false });
    const tusk = add(new THREE.ConeGeometry(0.07, 0.55, 8), MAT.white, 0.72, -0.5, s * 0.3, headG, { cast: false });
    tusk.rotation.z = 2.55; tusk.rotation.y = s * 0.25;
  }
  // ears: flattened spheres on pivots (independent flap in worldState)
  eleEars = [];
  for (const s of [-1, 1]) {
    const earP = new THREE.Group(); earP.position.set(-0.25, 0.25, s * 0.62); headG.add(earP);
    const ear = add(new THREE.SphereGeometry(0.55, 12, 9), skinDk, -0.05, -0.22, s * 0.08, earP); ear.scale.set(0.92, 1.08, 0.2);
    eleEars.push(earP);
  }
  // trunk: chained segment pivots, each a tapered cylinder — curls as one curve
  eleTrunkSegs = [];
  let tp = new THREE.Group(); tp.position.set(0.68, -0.28, 0); headG.add(tp);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(); if (i > 0) seg.position.set(0, -0.26, 0); tp.add(seg);
    const r0 = 0.21 - i * 0.024;
    const cyl = add(new THREE.CylinderGeometry(r0 * 0.82, r0, 0.3, 10), skinM, 0, -0.14, 0, seg, { cast: false });
    // wrinkle rings on each segment
    eleTrunkSegs.push(seg); tp = seg;
  }
  add(new THREE.SphereGeometry(0.075, 8, 7), skinDk, 0, -0.3, 0, tp, { cast: false }); // trunk tip
  // legs: hip pivots, column + foot + 3 toenails each
  eleLegs = [];
  for (const [lx, lz] of [[1.05, 0.55], [1.05, -0.55], [-1.05, 0.55], [-1.05, -0.55]]) {
    const hip = new THREE.Group(); hip.position.set(lx, 1.15, lz); eleBody.add(hip);
    add(new THREE.CylinderGeometry(0.21, 0.24, 1.0, 10), skinM, 0, -0.5, 0, hip);
    add(new THREE.CylinderGeometry(0.27, 0.29, 0.22, 10), skinDk, 0, -1.02, 0, hip);
    for (let tn = -1; tn <= 1; tn++) add(new THREE.SphereGeometry(0.055, 7, 6), MAT.white, 0.2, -1.1, tn * 0.13, hip, { cast: false });
    eleLegs.push(hip);
  }
  // tail: pivot + thin segments + tuft
  eleTail = new THREE.Group(); eleTail.position.set(-1.78, 2.2, 0); eleBody.add(eleTail);
  add(new THREE.CylinderGeometry(0.045, 0.03, 1.0, 7), skinM, 0, -0.5, 0, eleTail, { cast: false });
  for (const tx of [-0.035, 0, 0.035]) { const tu = add(new THREE.ConeGeometry(0.028, 0.24, 5), MAT.woodDk, tx, -1.08, 0, eleTail, { cast: false }); tu.rotation.x = Math.PI; tu.rotation.z = tx * 3; } // tail tuft = 3 thin hair strands, not a solid dart
  const eleShadowTex = P.tex(P.radial('20,14,30', 0.6));
  const eleShadow = flat(add(new THREE.PlaneGeometry(4.6, 2.9), new THREE.MeshBasicMaterial({ map: eleShadowTex, transparent: true, depthWrite: false, fog: true, opacity: 0.55 }), 0, 0.03, 0, eleG, { cast: false }));
  eleShadow.userData.ndSkip = true; eleShadow.renderOrder = 1;

  // ================= BOAT (planked hull, ribs, gunwale, ropes) =================
  boatG = new THREE.Group(); boatG.position.set(BOAT.x, 0, BOAT.z); g.add(boatG);
  const hullMats = [MAT.woodPlank, MAT.woodPlank2];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) { // 5 individual planks per side, flaring outward as they rise
      const pl = add(box(BOAT.len - Math.abs(i - 2) * 0.22, 0.23, 0.08), hullMats[(i + (s > 0 ? 1 : 0)) % 2], 0, -0.52 + i * 0.235, s * (1.02 + i * 0.075), boatG, { cast: true });
      pl.rotation.x = s * -0.16;
    }
    add(box(BOAT.len + 0.15, 0.13, 0.16), MAT.woodDk, 0, 0.72, s * 1.42, boatG, { cast: true }); // gunwale rail
    for (let rI = -2; rI <= 2; rI++) { // ribs inside the hull
      add(box(0.09, 1.1, 0.07), MAT.woodDk, rI * 1.35, 0.05, s * 1.18, boatG, { cast: false }).rotation.x = s * -0.16;
    }
  }
  add(box(BOAT.len - 0.4, 0.1, 2.1), MAT.woodDk, 0, -0.58, 0, boatG, { cast: false }); // hull floor (elephant stands here)
  for (const e of [-1, 1]) { // bow/stern decks + upturned end posts
    add(box(1.1, 0.09, 2.3), MAT.woodPlank, e * (BOAT.len / 2 - 0.5), 0.62, 0, boatG, { cast: false });
    const post = add(box(0.16, 0.85, 0.16), MAT.woodDk, e * (BOAT.len / 2 + 0.12), 0.85, 0, boatG, { cast: false }); post.rotation.z = -e * 0.35;
  }
  for (let i = 0; i < 3; i++) { const coil = add(new THREE.TorusGeometry(0.3 - i * 0.05, 0.045, 6, 14), MAT.rope, -BOAT.len / 2 + 0.65, 0.7 + i * 0.07, 0.6, boatG, { cast: false }); coil.rotation.x = Math.PI / 2; } // rope coil
  strut(boatG, [BOAT.len / 2 - 0.2, 0.8, -0.8], [BOAT.len / 2 + 1.6, 2.6, -3.4], 0.028, MAT.rope); // mooring rope toward the ghat post (world end approx)
  // the PAINTED WATERLINE MARK: bright unlit band on the ghat-side hull — unmissable
  boatMark = new THREE.Group(); boatG.add(boatMark);
  const markPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.17), new THREE.MeshBasicMaterial({ color: '#ffd21f', fog: true }));
  markPlane.position.set(0.4, 0.32, -1.415); markPlane.rotation.y = Math.PI; markPlane.userData.ndSkip = true; boatMark.add(markPlane);
  const markTop = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.045), new THREE.MeshBasicMaterial({ color: '#d42f2f', fog: true }));
  markTop.position.set(0.4, 0.425, -1.415); markTop.rotation.y = Math.PI; markTop.userData.ndSkip = true; boatMark.add(markTop);
  const markBot = markTop.clone(); markBot.position.y = 0.215; boatMark.add(markBot);
  // stones inside the boat (appear with stoneK) + baskets on the stern deck
  stoneGroups = [];
  for (let i = 0; i < 7; i++) { const sg = new THREE.Group(); sg.position.set(-2.4 + (i % 4) * 0.85, -0.32 + Math.floor(i / 4) * 0.3, -0.5 + (i % 2) * 0.9); boatG.add(sg); makeStone(sg, 0, 0.18, 0, 0.3, i + 21); makeBasket(sg, 0.55, 0, 0.2, 0.9); stoneGroups.push(sg); }
  // reflection smear + ripple rings on the water under the boat
  const refl = flat(add(new THREE.PlaneGeometry(8.6, 3.6), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, depthWrite: false, fog: true, opacity: 0.4, color: '#3a4a55' }), BOAT.x, WATER_Y + 0.015, BOAT.z, g, { cast: false }));
  refl.userData.ndSkip = true;
  rippleRings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 40), new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.3, depthWrite: false, fog: true, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(BOAT.x, WATER_Y + 0.02 + i * 0.002, BOAT.z); ring.userData.ndSkip = true; ring.userData.ph = i / 3;
    g.add(ring); rippleRings.push(ring);
  }
  // ---- GANGPLANK: cleated plank from the steps to the boat ----
  plankG = new THREE.Group(); g.add(plankG);
  const pl = add(tbox(3.4, 0.09, 0.95, 1), MAT.woodPlank2, 0, 0, 0, plankG, { cast: true });
  for (let i = 0; i < 5; i++) add(box(0.09, 0.05, 0.95), MAT.woodDk, -1.4 + i * 0.7, 0.07, 0, plankG, { cast: false });
  for (const s of [-1, 1]) add(box(3.4, 0.07, 0.07), MAT.woodDk, 0, 0.1, s * 0.47, plankG, { cast: false });
}

// ---------- boards ----------
const boardHook = textBoard(['But tomorrow… the', 'fisherman who caught the', 'moon in his own net?'], 4.6, 1.5, '#14202f', '#ffd9a0', 900, { pitch: 0.21, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); worldG.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');
add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, 0, 0.9, 0, boardHook, { cast: false });
// counting slate boards for L13 (toggled by worldAt numIdx)
numBoards = ['120', '240', '360'].map((t, i) => {
  const nb = textBoard([t], 1.05, 0.72, '#20301c', '#ffe9a0', 900);
  nb.position.set(3.9, 1.32, 1.02); worldG.add(nb);
  add(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 7), MAT.woodDk, 3.9, 0.5, 1.06, worldG, { cast: false });
  nb.userData.ndSkip = true; return nb;
});

// ---------- FX: sunlit dust motes at the hero + daylight clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1, 0, { rate: 0, color: 0xe8dcc0, opacity: 0.15, scale: 0.35, grow: 1.2, life: 1.8, vy: 0.22, wind: 0.1 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 58, opacity: 0.85, color: 0xffffff, drift: 0.4, rim: 0xfff3d6, shadow: true, shadowColor: 0x8d9cc9, shadowOpacity: 0.30 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    const hp = heroPosAt(fxF);
    dustEmit.rate = pr.moteRate * 3; dustEmit.x = hp[0]; dustEmit.y = hp[1]; dustEmit.z = hp[2];
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(scale = 1) {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post (ink/dof contract) ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;
      if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.));
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- word-by-word captions ----------
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = H;
const capG = capCanvas.getContext('2d');
const capTex = new THREE.CanvasTexture(capCanvas); capTex.colorSpace = THREE.SRGBColorSpace;
const capScene = fs(new THREE.MeshBasicMaterial({ map: capTex, transparent: true, toneMapped: false }));
let capKey = null;
const drawCaption = (f) => {
  const t = f / 30;
  let i = -1;
  for (let k = 0; k < WORDS.length; k++) { if (t >= WORDS[k].s) i = k; else break; }
  let word = '';
  if (i >= 0) {
    const gap = t - WORDS[i].e;
    const next = WORDS[i + 1];
    if (!(gap > 0.34 && (!next || next.s - t > 0.05))) word = WORDS[i].w;
  }
  if (word === capKey) return;
  capKey = word;
  capG.clearRect(0, 0, W, H);
  if (word) {
    capG.font = '900 74px Arial, Helvetica, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.76);
    capG.strokeText(word, W / 2, y);
    capG.fillStyle = '#ffffff';
    capG.fillText(word, W / 2, y);
  }
  capTex.needsUpdate = true;
};

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  boardHook.material.opacity = Ws.boardHook || 0; boardHook.visible = (Ws.boardHook || 0) > 0.01;
  if (waterTex) { waterTex.offset.set((f * 0.0009) % 1, (f * 0.00045) % 1); }
  if (eleG) {
    eleG.position.set(Ws.eleX || 0, Ws.eleY || 0, Ws.eleZ || 0);
    eleG.rotation.y = -(Ws.eleYaw || 0);
    const mv = Ws.eleMoving || 0, ph = (Ws.elePhase || 0) * Math.PI * 2;
    eleLegs.forEach((leg, i) => { leg.rotation.z = mv ? Math.sin(ph + [0, Math.PI, Math.PI, 0][i]) * 0.30 : 0; });
    if (eleBody) {
      eleBody.position.y = mv ? Math.abs(Math.sin(ph)) * 0.045 : 0.012 * Math.sin(f * 0.045);
      eleBody.rotation.x = mv ? Math.sin(ph) * 0.016 : 0.006 * Math.sin(f * 0.03);
      eleBody.rotation.z = mv ? Math.sin(ph * 0.5) * 0.008 : 0;
    }
    eleEars.forEach((ear, i) => { ear.rotation.y = (i ? -1 : 1) * (0.10 + 0.07 * Math.sin(f * 0.055 + i * 2.1) + (mv ? 0.05 * Math.abs(Math.sin(ph)) : 0)); });
    eleTrunkSegs.forEach((seg, i) => { seg.rotation.z = 0.07 + (Ws.trunk || 0.3) * 0.17 * (i / 4) + 0.02 * Math.sin(f * 0.04 + i); seg.rotation.x = 0.03 * Math.sin(f * 0.03 + i * 0.7); });
    if (eleTail) eleTail.rotation.x = 0.16 * Math.sin(f * 0.05);
  }
  if (boatG) {
    boatG.position.y = -(Ws.sink || 0);
    const S = shotAt(f).id;
    boatG.rotation.x = (S === 'l09' || S === 'l10') ? 0.014 * Math.sin(f * 0.22) : 0.004 * Math.sin(f * 0.05);
    if (boatMark) boatMark.visible = (Ws.markK || 0) > 0;
    stoneGroups.forEach((sg, i) => { sg.visible = (i / stoneGroups.length) < (Ws.stoneK || 0); });
    rippleRings.forEach((ring) => { const u = (f / 110 + ring.userData.ph) % 1; ring.scale.set(1 + u * 2.6, 1 + u * 1.15, 1); ring.material.opacity = 0.30 * (1 - u); });
    if (plankG) {
      const A = new THREE.Vector3(0.4, -0.28, 7.45), Bp = new THREE.Vector3(0.9, BOAT.deckY - (Ws.sink || 0) + 0.05, 9.85);
      const mid = A.clone().add(Bp).multiplyScalar(0.5), dir = Bp.clone().sub(A);
      plankG.position.copy(mid);
      plankG.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
    }
  }
  if (bigBal) {
    const k = Ws.snapK || 0;
    bigBal.beamL.rotation.z = 0.58 * k; bigBal.beamR.rotation.z = -0.58 * k;
    bigBal.beamL.position.y = 2.62 - 0.14 * k; bigBal.beamR.position.y = 2.62 - 0.14 * k;
  }
  if (smallBal) { smallBal.beamL.rotation.z = Ws.smallTilt || 0; smallBal.beamR.rotation.z = Ws.smallTilt || 0; }
  numBoards.forEach((nb, i) => { nb.visible = (Ws.numIdx || 0) === i + 1; });
  if (pileG) { const pk = Ws.pileK || 0; pileG.visible = pk > 0.01; pileG.scale.set(0.4 + 0.6 * pk, 0.3 + 0.7 * pk, 0.4 + 0.6 * pk); }
}function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}
const swapForNd = (on) => {
  scene.traverse((o) => {
    if (on) {
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; return; }
      if (o.userData.ndSkip || o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (!o.isMesh) return;
      o.userData.mat0 = o.material;
      o.material = o.userData.nd || ndMat;
    } else {
      if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
      if (o.isMesh && o.userData.mat0 !== undefined) { o.material = o.userData.mat0; delete o.userData.mat0; }
    }
  });
};
window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const Ws = worldAt(f); worldState(Ws, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  drawCaption(f);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
