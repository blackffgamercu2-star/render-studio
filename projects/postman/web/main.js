import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, heroPosAt, hillY } from './story.js';
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
  grass: texM(P.grass(6), 30, 30, '#7fae56'), hill: texM(P.grass(11), 24, 8, '#8fbc5e'),
  dirt: texM(P.dirt(7), 2, 16, '#8a6844'), stone: texM(M4.stoneV4(8), 6, 4, '#a89a83'),
  plat: texM(M4.stoneV4(9), 20, 4, '#9a9184'), ballast: texM(M4.stoneV4(21), 48, 3, '#7d7a72'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  rail: toon({ color: '#8d949c' }), iron: toon({ color: '#3f4247' }),
  brass: toon({ color: '#c99635' }), white: toon({ color: '#f2ede0' }), dark: toon({ color: '#2c2620' }),
  loco: toon({ color: '#31572c' }), locoCab: toon({ color: '#274a24' }), boiler: toon({ color: '#3a3f45' }),
  coachA: toon({ color: '#1f6f7a' }), coachB: toon({ color: '#8c3b4a' }), coachC: toon({ color: '#3f7d4e' }),
  goods: toon({ color: '#6e5136' }), goodsLoco: toon({ color: '#4a3b2c' }),
  roofR: toon({ color: '#b3543a' }), roofB: toon({ color: '#4a6a9e' }), roofG: toon({ color: '#5d7a3a' }),
  wallA: toon({ color: '#e8dcc0' }), wallB: toon({ color: '#d9b48f' }), wallC: toon({ color: '#cfe0d8' }), wallD: toon({ color: '#e6c9c9' }),
  leaf: toon({ color: '#4a7d32' }), leaf2: toon({ color: '#5d9440' }), trunk: texM(M4.woodV4(6), 1, 2, '#8a6844'),
  bag: toon({ color: '#7a4a26' }), bagDk: toon({ color: '#5f3a1e' }), letter: toon({ color: '#f3e3bb' }),
  tower: texM(M4.stoneV4(8), 3, 8, '#b0a58e'), clockFace: new THREE.MeshBasicMaterial({ color: '#fdf6e0' }),
  winLit: new THREE.MeshBasicMaterial({ color: '#ffe9b0' }), field1: toon({ color: '#86b95c' }), field2: toon({ color: '#a8c95e' }), field3: toon({ color: '#79ad52' }),
  ditch: toon({ color: '#5f4630' }), street: texM(M4.stoneV4(9), 24, 8, '#a39a8a'),
};

// ============================================================
//  WORLD — one sunlit valley: station + track A (south), the HILL,
//  track B at its foot, fields + ditch, town + clock tower (north).
// ============================================================
const worldG = new THREE.Group(); scene.add(worldG);
const trainWheels = [];
let trainG = null, goodsG = null, towerMin = null, towerHour = null, bellMesh = null;
const makeTree = (x, z, s = 1, parent = worldG) => {
  const g = new THREE.Group(); g.position.set(x, hillY(z), z); parent.add(g);
  add(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.3 * s, 7), MAT.trunk, 0, 0.65 * s, 0, g, { cast: false });
  add(new THREE.SphereGeometry(1.05 * s, 10, 8), MAT.leaf, 0, 1.95 * s, 0, g, { cast: false });
  add(new THREE.SphereGeometry(0.75 * s, 9, 7), MAT.leaf2, 0.55 * s, 1.55 * s, 0.3 * s, g, { cast: false });
  add(new THREE.SphereGeometry(0.65 * s, 9, 7), MAT.leaf2, -0.5 * s, 1.6 * s, -0.25 * s, g, { cast: false });
  return g;
};
const makeHouse = (x, z, w, h, d, wallM, roofM, parent = worldG) => {
  const g = new THREE.Group(); g.position.set(x, hillY(z) > 0 ? hillY(z) : 0, z); parent.add(g);
  add(tbox(w, h, d, 2), wallM, 0, h / 2, 0, g, { cast: false });
  const roof = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.08, h * 0.55, 4), roofM, 0, h + h * 0.27, 0, g, { cast: false });
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, d / w);
  add(tbox(0.7, 1.3, 0.1, 1), MAT.dark, 0, 0.65, -d / 2 - 0.03, g, { cast: false });
  add(tbox(0.62, 0.62, 0.08, 1), MAT.winLit, w * 0.28, h * 0.62, -d / 2 - 0.03, g, { cast: false });
  add(tbox(0.62, 0.62, 0.08, 1), MAT.winLit, -w * 0.28, h * 0.62, -d / 2 - 0.03, g, { cast: false });
  return g;
};
const makeTrack = (z) => {
  const g = new THREE.Group(); worldG.add(g);
  add(box(150, 0.06, 3.4), MAT.ballast, 0, 0.03, z, g, { cast: false });
  for (let x = -72; x <= 72; x += 1.8) add(box(0.5, 0.07, 2.3), MAT.woodDk, x, 0.08, z, g, { cast: false });
  for (const dz of [-0.75, 0.75]) add(box(150, 0.12, 0.14), MAT.rail, 0, 0.16, z + dz, g, { cast: false });
  return g;
};
const makeWheel = (r, parent, x, z) => {
  const geo = new THREE.CylinderGeometry(r, r, 0.16, 18); geo.rotateX(Math.PI / 2);
  const w = add(geo, MAT.iron, x, r, z, parent, { cast: false });
  const hubGeo = new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.2, 10); hubGeo.rotateX(Math.PI / 2);
  add(hubGeo, MAT.brass, x, r, z, parent, { cast: false });
  trainWheels.push(w); return w;
};
const makeLoco = (bodyM, cabM, parent) => {
  const g = new THREE.Group(); parent.add(g);
  add(box(5.8, 0.45, 2.2), MAT.goods, 0, 0.72, 0, g, { cast: false });
  const boilerGeo = new THREE.CylinderGeometry(0.92, 0.92, 3.7, 18); boilerGeo.rotateZ(Math.PI / 2);
  add(boilerGeo, MAT.boiler, 0.65, 1.98, 0, g, { cast: false });
  add(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.brass, 0.35, 2.85, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.2, 0.3, 0.95, 10), MAT.iron, 2.15, 3.2, 0, g, { cast: false });
  add(box(1.9, 2.35, 2.3), cabM, -1.95, 1.95, 0, g, { cast: false });
  add(box(2.3, 0.18, 2.7), MAT.dark, -1.95, 3.2, 0, g, { cast: false });
  for (const sz of [-1.17, 1.17]) add(new THREE.PlaneGeometry(0.85, 0.85), MAT.winLit, -1.95, 2.45, sz, g, { cast: false }).rotation.y = sz > 0 ? 0 : Math.PI;
  add(box(0.5, 0.5, 0.6), MAT.brass, 2.62, 2.5, 0, g, { cast: false });
  for (const wx of [-1.7, 0.05, 1.75]) for (const wz of [-1.02, 1.02]) makeWheel(0.62, g, wx, wz);
  for (const wz of [-1.02, 1.02]) makeWheel(0.4, g, 2.6, wz);
  return g;
};
{
  const g = worldG;
  // ground + hill
  const ground = flat(add(new THREE.PlaneGeometry(700, 500), MAT.grass, 0, 0, 40, g, { cast: false }));
  ground.receiveShadow = true;
  const hillGeo = new THREE.PlaneGeometry(150, 22, 1, 44); hillGeo.rotateX(-Math.PI / 2);
  { const pos = hillGeo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, hillY(pos.getZ(i) + 19)); hillGeo.computeVertexNormals(); }
  const hill = add(hillGeo, MAT.hill, 0, 0.02, 19, g, { cast: false }); hill.receiveShadow = true;
  // Ramu's dirt path: a ribbon following his route over the hill
  {
    const pts = [[5.5, 3.4], [8, 2.7], [10.8, 2.2], [14, 1.4], [19.6, 0.6], [24, 0.0], [28.6, -0.8], [34.5, -0.8], [38.4, -0.3], [43.5, 0.2]];
    const verts = [], idx = [];
    pts.forEach(([z, x], i) => {
      const y = hillY(z) + 0.045;
      verts.push(x - 0.85, y, z, x + 0.85, y, z);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    pg.setIndex(idx); pg.computeVertexNormals();
    const uv = new Float32Array((verts.length / 3) * 2); pg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const path = new THREE.Mesh(pg, MAT.dirt); path.receiveShadow = true; path.userData.ndSkip = false; g.add(path);
  }
  // tracks + platform + crossing
  makeTrack(0); makeTrack(32);
  add(box(20, 0.24, 3.6), MAT.plat, 0, 0.0, 3.6, g, { cast: false });
  add(box(20, 0.05, 0.3), MAT.white, 0, 0.13, 2.0, g, { cast: false });
  add(box(3.4, 0.07, 3.2), MAT.wood, 0, 0.1, 32, g, { cast: false });
  for (const sx of [-3.6, 3.6]) { add(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 7), MAT.iron, sx, 1.3, 33.8, g, { cast: false }); add(box(0.7, 0.5, 0.08), MAT.roofR, sx, 2.5, 33.8, g, { cast: false }); }
  // station building + platform clock pole (the noon pressure)
  makeHouse(-4.5, 9.2, 5.2, 3.0, 3.4, MAT.wallA, MAT.roofR);
  add(tbox(3.4, 0.7, 0.1, 1), MAT.white, -4.5, 2.2, 7.4, g, { cast: false });
  add(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 7), MAT.iron, -5.5, 1.7, 6.8, g, { cast: false });
  const pClock = add(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 20), MAT.iron, -5.5, 3.3, 6.8, g, { cast: false }); pClock.rotation.x = Math.PI / 2;
  const pFace = add(new THREE.CircleGeometry(0.5, 20), MAT.clockFace, -5.5, 3.3, 6.74, g, { cast: false }); pFace.rotation.y = Math.PI;
  add(box(0.07, 0.4, 0.03), MAT.dark, -5.5, 3.42, 6.72, g, { cast: false }).rotation.z = -0.5;
  add(box(0.07, 0.32, 0.03), MAT.dark, -5.5, 3.38, 6.72, g, { cast: false }).rotation.z = 2.6;
  // village houses + trees (south slope foot)
  makeHouse(-13.5, 13.5, 4.2, 2.7, 3.2, MAT.wallB, MAT.roofB);
  makeHouse(-11, 11.5, 4.6, 2.9, 3.4, MAT.wallC, MAT.roofG);
  makeHouse(16.5, 9.5, 4.0, 2.6, 3.0, MAT.wallD, MAT.roofR);
  // the left mailbag on the platform, letter on top
  const bagG = new THREE.Group(); bagG.position.set(-4.5, 0.12, 3.8); g.add(bagG);
  const bagBody = add(new THREE.SphereGeometry(0.52, 12, 9), MAT.bag, 0, 0.42, 0, bagG, { cast: false }); bagBody.scale.set(1, 0.92, 0.78);
  add(box(0.8, 0.16, 0.55), MAT.bagDk, 0, 0.82, 0, bagG, { cast: false }).rotation.z = 0.16;
  add(box(0.55, 0.06, 0.38), MAT.letter, 0.08, 0.95, 0.05, bagG, { cast: false }).rotation.z = 0.3;
  add(new THREE.TorusGeometry(0.3, 0.05, 6, 14), MAT.bagDk, 0, 0.9, 0, bagG, { cast: false }).rotation.x = 0.4;
  // fields + ditch + hedges
  add(box(64, 0.04, 3.6), MAT.field1, 0, 0.02, 35.2, g, { cast: false });
  add(box(64, 0.04, 4.4), MAT.field2, 0, 0.02, 41.6, g, { cast: false });
  add(box(64, 0.04, 2.2), MAT.field3, 0, 0.02, 44.9, g, { cast: false });
  add(box(20, 0.5, 1.05), MAT.ditch, -0.3, -0.28, 38.4, g, { cast: false });
  for (let x = -26; x <= 26; x += 3.4) { const b = add(new THREE.SphereGeometry(0.5, 8, 6), MAT.leaf, x, 0.3, 33.6, g, { cast: false }); b.scale.y = 0.7; }
  // town street + houses + clock tower
  add(box(34, 0.09, 9.5), MAT.street, 1, 0.0, 49, g, { cast: false });
  makeHouse(-7.5, 52.8, 4.6, 3.0, 3.2, MAT.wallB, MAT.roofB);
  makeHouse(8.6, 54.5, 4.0, 2.7, 3.0, MAT.wallC, MAT.roofR);
  makeHouse(12.5, 52.8, 4.4, 2.9, 3.2, MAT.wallA, MAT.roofG);
  makeHouse(-8, 44.9, 4.2, 2.7, 3.0, MAT.wallD, MAT.roofG);
  const tw = new THREE.Group(); tw.position.set(7, 0, 50); g.add(tw);
  add(tbox(2.7, 11, 2.7, 2), MAT.tower, 0, 5.5, 0, tw, { cast: false });
  add(box(3.3, 0.5, 3.3), MAT.stone, 0, 11.2, 0, tw, { cast: false });
  const twRoof = add(new THREE.ConeGeometry(2.5, 2.2, 4), MAT.roofR, 0, 12.5, 0, tw, { cast: false }); twRoof.rotation.y = Math.PI / 4;
  add(box(1.3, 1.7, 0.1), MAT.dark, 0, 10.9, -1.36, tw, { cast: false });
  const rim = add(new THREE.TorusGeometry(1.02, 0.07, 8, 26), MAT.iron, 0, 9.3, -1.38, tw, { cast: false });
  const face = add(new THREE.CircleGeometry(1.0, 26), MAT.clockFace, 0, 9.3, -1.37, tw, { cast: false }); face.rotation.y = Math.PI;
  towerHour = new THREE.Group(); towerHour.position.set(0, 9.3, -1.42); tw.add(towerHour);
  add(box(0.1, 0.58, 0.03), MAT.dark, 0, 0.26, 0, towerHour, { cast: false });
  towerMin = new THREE.Group(); towerMin.position.set(0, 9.3, -1.45); tw.add(towerMin);
  add(box(0.08, 0.88, 0.03), MAT.dark, 0, 0.4, 0, towerMin, { cast: false });
  bellMesh = add(new THREE.ConeGeometry(0.42, 0.6, 10), MAT.brass, 0, 10.75, -1.1, tw, { cast: false });
  // trees scattered (hill, fields, town)
  for (const [x, z, s] of [[-9, 14, 1.2], [8, 16, 1.4], [-13, 27, 1.1], [10, 26, 1.3], [16, 8, 1.2], [-16, 20, 1.5], [20, 36, 1.2], [-14, 40, 1.1], [15, 46, 1.0], [-12, 48, 1.2], [22, 18, 1.3], [-20, 30, 1.2]]) makeTree(x, z, s);
  // ---- passenger train (loco + 3 coaches) ----
  trainG = new THREE.Group(); g.add(trainG);
  makeLoco(MAT.loco, MAT.locoCab, trainG);
  const coachMats = [MAT.coachA, MAT.coachB, MAT.coachC];
  for (let i = 0; i < 3; i++) {
    const cg = new THREE.Group(); cg.position.set(-5.6 - i * 5.3, 0, 0); trainG.add(cg);
    add(box(4.9, 2.2, 2.4), coachMats[i], 0, 1.95, 0, cg, { cast: false });
    add(box(5.2, 0.2, 2.7), MAT.dark, 0, 3.15, 0, cg, { cast: false });
    for (const sz of [-1.22, 1.22]) { const st = add(box(4.3, 0.7, 0.06), MAT.winLit, 0, 2.35, sz, cg, { cast: false }); st.userData.ndSkip = true; }
    for (const wx of [-1.6, 1.6]) for (const wz of [-1.02, 1.02]) makeWheel(0.45, cg, wx, wz);
  }
  // ---- goods train (stationary, blocks track B at the crossing) ----
  goodsG = new THREE.Group(); goodsG.position.set(0, 0, 32); g.add(goodsG);
  for (let i = 0; i < 4; i++) {
    const wg = new THREE.Group(); wg.position.set(15.5 + i * 4.4, 0, 0); goodsG.add(wg);
    add(box(4.0, 1.5, 2.3), MAT.goods, 0, 1.35, 0, wg, { cast: false });
    const cr = FX.crate(0.9); cr.position.set(-0.8, 2.5, 0.3); wg.add(cr);
    const cr2 = FX.crate(0.75); cr2.position.set(0.8, 2.42, -0.4); wg.add(cr2);
    const br = FX.barrel(0.36, 0.85); br.position.set(0.1, 2.5, 0.7); wg.add(br);
    for (const wx of [-1.4, 1.4]) for (const wz of [-1.02, 1.02]) { const geo = new THREE.CylinderGeometry(0.45, 0.45, 0.16, 14); geo.rotateX(Math.PI / 2); add(geo, MAT.iron, wx, 0.45, wz, wg, { cast: false }); }
  }
  const gl = new THREE.Group(); gl.position.set(35.5, 0, 0); goodsG.add(gl);
  makeLoco(MAT.goodsLoco, MAT.goodsLoco, gl);
  // board posts + crossbar at BOARD_POS
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) { add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false }); add(new THREE.SphereGeometry(0.17, 9, 7), MAT.winLit, px, 3.48, BOARD_POS[2], g, { cast: false }); }
}

// ---------- boards ----------
const boardHook = textBoard(['But tomorrow… the old', 'woman who carried a whole', 'river home in one small pot?'], 4.6, 1.5, '#14202f', '#ffd9a0', 900, { pitch: 0.21, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); worldG.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');
add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, 0, 0.9, 0, boardHook, { cast: false });

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
  if (trainG) {
    trainG.visible = (Ws.trainK || 0) > 0;
    trainG.position.set(Ws.trainX || 0, 0, Ws.trainZ || 0);
    const spin = -((Ws.trainX || 0) % (Math.PI * 2 * 0.62)) / 0.62;
    trainWheels.forEach((w) => { w.rotation.z = spin; });
  }
  if (goodsG) goodsG.visible = (Ws.goodsK || 0) > 0.01;
  if (towerMin) towerMin.rotation.z = -(0.25 + (Ws.clockK || 0) * 0.75) * Math.PI * 2 * 0.24;
  if (towerHour) towerHour.rotation.z = -(0.92 + (Ws.clockK || 0) * 0.06);
  if (bellMesh) bellMesh.rotation.z = Math.sin(f * 0.3) * 0.45 * (Ws.bellK || 0);
}
function drawActors(list, cam) {
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
