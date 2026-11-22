import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, BOARD_POS, BOARD_RY, flockAt } from './story.js';
import { warpF } from './timewarp.js';
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
scene.environment = envMap;
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
// the hearth fire's warm practical — motivated by the pot fires
const chandLight = new THREE.PointLight(0xffa050, 1.15, 13, 1.6); chandLight.position.set(-3.8, 1.5, -8.0); scene.add(chandLight);

// ---------- text-board helper ----------
const textBoard = (lines, w, h, bg, fg, font = 900, fit = null) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  if (fit && fit.fsMul) fs *= fit.fsMul;
  g.font = `${font} ${fs}px Arial`;
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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- canvas textures (procedural, from paint.js) ----------
const MAT = {
  stone: texM(P.stone(8), 9, 7),
  stoneDark: texM(P.stone(11), 3, 3, '#b8ab94'),
  wood: texM(P.planks(4), 2, 2),
  woodDark: texM(P.planks(6), 2, 2, '#9a7a58'),
  plaster: texM(P.plaster(8, 42), 6, 2),
  clothRed: texM(P.weave(21, [352, 62, 30]), 2, 6),
  clothCream: texM(P.weave(23, [40, 30, 80]), 1, 4),
  copper: new THREE.MeshStandardMaterial({ color: '#b0662f', roughness: 0.34, metalness: 0.78, envMapIntensity: 1.5 }),
  copperDark: new THREE.MeshStandardMaterial({ color: '#7e451f', roughness: 0.45, metalness: 0.7, envMapIntensity: 1.1 }),
  brass: toon({ color: '#c9a24e', roughness: 0.45, metalness: 0.55 }),
  brassDark: toon({ color: '#8a6c2e', roughness: 0.5, metalness: 0.5 }),
  iron: toon({ color: '#2e2c30', roughness: 0.6, metalness: 0.4 }),
  cream: toon({ color: '#efe3c8', roughness: 1 }),
  leaf: toon({ color: '#4d7a35', roughness: 1 }),
  leaf2: toon({ color: '#639347', roughness: 1 }),
  grass: texM(P.grass(6), 26, 26),
  dirt: texM(P.dirt(7), 10, 10),
  roofTex: texM(P.roof(9), 2, 2),
  wool: toon({ color: '#f2e8d5', roughness: 1 }),
  wool2: toon({ color: '#e7dbc2', roughness: 1 }),
  wool3: toon({ color: '#f7efdd', roughness: 1 }),
  sheepDark: toon({ color: '#77573a', roughness: 0.95 }),
  wolfGrey: toon({ color: '#83868b', roughness: 1 }),
  wolfDark: toon({ color: '#4c4a4c', roughness: 0.95 }),
  chalk: toon({ color: '#ffffff', roughness: 0.9 }),
  troughWater: toon({ color: '#17707e', roughness: 0.35 }),
  dishWhite: toon({ color: '#f6f1e2', roughness: 0.55 }),
  food: toon({ color: '#c98a3a', roughness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e8b93c', roughness: 0.25, metalness: 0.9, envMapIntensity: 2.0 }),
  chiliRed: new THREE.MeshStandardMaterial({ color: '#c22418', roughness: 0.22, metalness: 0.05, envMapIntensity: 1.6 }),
  chiliStem: toon({ color: '#4d7a35', roughness: 0.8 }),
};

// ---------- flock geometry (merged: 4 draw calls per sheep) ----------
const mergeGeos = (parts) => {
  const pos = [], nor = [], uv = [];
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const { geo, m } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(w.x, w.y, w.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
};
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
  new THREE.Vector3(sx, sy, sz));
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, hh, n = 8) => new THREE.CylinderGeometry(rt, rb, hh, n);
const bx = (w2, h2, d2) => new THREE.BoxGeometry(w2, h2, d2);

// one sheep: wool body (merged), dark legs (merged), a head group on
// a neck pivot (dips to graze), and the chalk stripe (toggled by the
// story's flock model — it appears the frame the sheep passes the
// boy's chalk at the gate).
const WOOLS = ['wool', 'wool2', 'wool3'];
const makeSheep = (i) => {
  const g = new THREE.Group();
  const woolMat = MAT[WOOLS[i % 3]];
  const body = new THREE.Mesh(mergeGeos([
    { geo: sph(1), m: M4(0, 0.56, 0, 0, 0, 0, 0.33, 0.285, 0.45) },
    { geo: sph(0.09), m: M4(0, 0.68, -0.44) },
  ]), woolMat);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const legs = new THREE.Mesh(mergeGeos([
    { geo: cyl(0.035, 0.03, 0.36), m: M4(-0.16, 0.18, 0.24) },
    { geo: cyl(0.035, 0.03, 0.36), m: M4(0.16, 0.18, 0.24) },
    { geo: cyl(0.035, 0.03, 0.36), m: M4(-0.16, 0.18, -0.24) },
    { geo: cyl(0.035, 0.03, 0.36), m: M4(0.16, 0.18, -0.24) },
  ]), MAT.sheepDark);
  legs.receiveShadow = true; g.add(legs);
  const headG = new THREE.Group(); headG.position.set(0, 0.62, 0.42); g.add(headG);
  const head = new THREE.Mesh(mergeGeos([
    { geo: sph(1), m: M4(0, 0.02, 0.02, 0, 0, 0, 0.105, 0.11, 0.125) },
    { geo: bx(0.11, 0.09, 0.15), m: M4(0, -0.03, 0.13) },
    { geo: bx(0.14, 0.035, 0.06), m: M4(-0.12, 0.07, -0.01, 0, 0, 0.5) },
    { geo: bx(0.14, 0.035, 0.06), m: M4(0.12, 0.07, -0.01, 0, 0, -0.5) },
  ]), MAT.sheepDark);
  head.castShadow = true; headG.add(head);
  const stripe = new THREE.Mesh(sph(1, 12, 8), MAT.chalk);
  stripe.scale.set(0.30, 0.055, 0.21); stripe.position.set(0, 0.80, 0.02); stripe.visible = false; g.add(stripe);
  g.userData = { stripe, headG };
  return g;
};
// the wolf: a grey body + grey head (long snout, pointed ears, bushy
// tail) UNDER a cream sheepskin shell. Pre-reveal the shell covers
// the body; the too-long grey snout and the bushy tail are the tells.
// On the reveal the shell group slides off and drops beside it.
const makeWolf = () => {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(mergeGeos([
    { geo: cyl(0.04, 0.035, 0.42), m: M4(-0.17, 0.21, 0.27) },
    { geo: cyl(0.04, 0.035, 0.42), m: M4(0.17, 0.21, 0.27) },
    { geo: cyl(0.04, 0.035, 0.42), m: M4(-0.17, 0.21, -0.27) },
    { geo: cyl(0.04, 0.035, 0.42), m: M4(0.17, 0.21, -0.27) },
  ]), MAT.wolfDark);
  legs.receiveShadow = true; g.add(legs);
  const body = new THREE.Mesh(mergeGeos([
    { geo: sph(1), m: M4(0, 0.62, 0, 0, 0, 0, 0.36, 0.31, 0.52) },
    { geo: new THREE.ConeGeometry(0.09, 0.46, 8), m: M4(0, 0.66, -0.62, -1.15, 0, 0) },
  ]), MAT.wolfGrey);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const headG = new THREE.Group(); headG.position.set(0, 0.72, 0.48); g.add(headG);
  const head = new THREE.Mesh(mergeGeos([
    { geo: sph(1), m: M4(0, 0.02, 0, 0, 0, 0, 0.115, 0.115, 0.13) },
    { geo: bx(0.12, 0.09, 0.24), m: M4(0, -0.045, 0.16) },
    { geo: new THREE.ConeGeometry(0.05, 0.15, 6), m: M4(-0.085, 0.15, -0.02, 0, 0, 0.18) },
    { geo: new THREE.ConeGeometry(0.05, 0.15, 6), m: M4(0.085, 0.15, -0.02, 0, 0, -0.18) },
  ]), MAT.wolfGrey);
  head.castShadow = true; headG.add(head);
  const shell = new THREE.Group(); g.add(shell);
  const shellBody = new THREE.Mesh(mergeGeos([
    { geo: sph(1), m: M4(0, 0.645, 0, 0, 0, 0, 0.378, 0.328, 0.538) },
    { geo: sph(0.1), m: M4(0, 0.78, -0.5) },
  ]), MAT.wool);
  shellBody.castShadow = true; shellBody.receiveShadow = true; shell.add(shellBody);
  const shellHead = new THREE.Mesh(mergeGeos([
    { geo: sph(1), m: M4(0, 0.74, 0.47, 0, 0, 0, 0.145, 0.145, 0.155) },
    { geo: bx(0.15, 0.04, 0.07), m: M4(-0.14, 0.8, 0.44, 0, 0, 0.5) },
    { geo: bx(0.15, 0.04, 0.07), m: M4(0.14, 0.8, 0.44, 0, 0, -0.5) },
  ]), MAT.wool2);
  shellHead.castShadow = true; shell.add(shellHead);
  g.userData = { headG, shell };
  return g;
};

// ---------- WORLD: the hillside + sheep pen + gate (ONE set) ----------
const world = new THREE.Group(); scene.add(world);
{ // meadow ground, the worn dirt lane to the hill, trampled pen earth
  flat(add(new THREE.PlaneGeometry(120, 90), MAT.grass, 0, 0, -4, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(11.5, 1.7), MAT.dirt, 7.3, 0.012, -2.8, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(8.4, 7.9), MAT.dirt, -2, 0.006, -3.25, world, { cast: false }));
}
// --- backdrop hills + trees (the hillside the flock comes down) ---
{
  const hillAt = (x, z, sx, sy, sz, mat) => { const m = add(sph(1, 18, 12), mat, x, -sy * 0.25, z, world, { cast: false }); m.scale.set(sx, sy, sz); return m; };
  hillAt(-16, -27, 22, 7, 12, MAT.leaf2); hillAt(6, -31, 26, 9, 13, MAT.leaf);
  hillAt(25, -23, 18, 6, 10, MAT.leaf2); hillAt(-31, -9, 16, 5.5, 10, MAT.leaf);
  const treeAt = (x, z, s = 1) => {
    add(cyl(0.16 * s, 0.24 * s, 1.6 * s, 8), MAT.woodDark, x, 0.8 * s, z, world);
    const c1 = add(sph(1.15 * s, 12, 9), MAT.leaf, x, 2.3 * s, z, world); c1.scale.y = 0.85;
    const c2 = add(sph(0.85 * s, 11, 8), MAT.leaf2, x + 0.7 * s, 1.9 * s, z + 0.3, world); c2.scale.y = 0.85;
    const c3 = add(sph(0.7 * s, 10, 8), MAT.leaf, x - 0.65 * s, 2.7 * s, z - 0.2, world); c3.scale.y = 0.9;
  };
  treeAt(-7.6, -8.2); treeAt(9.8, -6.4); treeAt(11.5, 1.5); treeAt(13.5, -6.2, 1.15); treeAt(-9.5, -2, 0.9);
  for (const [rx2, rz2, rs] of [[-8.6, 0.8, 0.55], [5.9, -6.9, 0.45], [12.6, -0.6, 0.6], [-4.2, 3.4, 0.4]]) {
    const b1 = add(sph(rs, 10, 8), MAT.leaf2, rx2, rs * 0.55, rz2, world); b1.scale.y = 0.72;
    const b2 = add(sph(rs * 0.7, 9, 7), MAT.leaf, rx2 + rs * 0.6, rs * 0.4, rz2 + rs * 0.3, world); b2.scale.y = 0.72;
  }
}
// --- the pen: post-and-rail fence, a broken stretch on the north
// side (the wolf's way in), and the narrow GATE in the east fence ---
let gatePanel;
{
  const post = (x, z, h = 1.05) => add(bx(0.09, h, 0.09), MAT.woodDark, x, h / 2, z, world);
  const rail = (x, z, len, ry, y) => { const r = add(bx(len, 0.075, 0.05), MAT.wood, x, y, z, world, { cast: false }); r.rotation.y = ry; return r; };
  const runX = (x0, x1, z) => { // a fence run along x at fixed z
    rail((x0 + x1) / 2, z, Math.abs(x1 - x0), 0, 0.58); rail((x0 + x1) / 2, z, Math.abs(x1 - x0), 0, 0.92);
    for (let x = x0; x <= x1 + 0.01; x += 1.05) post(x, z);
  };
  const runZ = (x, z0, z1) => {
    rail(x, (z0 + z1) / 2, Math.abs(z1 - z0), Math.PI / 2, 0.58); rail(x, (z0 + z1) / 2, Math.abs(z1 - z0), Math.PI / 2, 0.92);
    for (let z = z0; z <= z1 + 0.01; z += 1.05) post(x, z);
  };
  runX(-6.2, -5.95, -7); runX(-5.15, 2.2, -7);            // north, with the broken gap x[-5.95,-5.15]
  const fallen = rail(-5.55, -6.82, 0.95, 0.35, 0.3); fallen.rotation.z = 0.16; // the slipped rail
  runX(-6.2, 2.2, 0.5);                                   // south
  runZ(-6, -7, 0.5);                                      // west
  runZ(2, -7, -3.4); runZ(2, -2.2, 0.5);                  // east, either side of the gate
  post(2, -3.4, 1.3); post(2, -2.2, 1.3);                 // the gate posts
  add(sph(0.07, 8, 6), MAT.woodDark, 2, 1.34, -3.4, world, { cast: false });
  add(sph(0.07, 8, 6), MAT.woodDark, 2, 1.34, -2.2, world, { cast: false });
  // the gate panel itself, hinged on the north post — worldState swings it
  gatePanel = new THREE.Group(); gatePanel.position.set(2, 0, -3.4); world.add(gatePanel);
  const gp = (w2, h2, d2, mat, x, y, z) => add(bx(w2, h2, d2), mat, x, y, z, gatePanel, { cast: false });
  gp(0.05, 0.075, 1.2, MAT.wood, 0, 0.58, 0.6); gp(0.05, 0.075, 1.2, MAT.wood, 0, 0.92, 0.6);
  gp(0.05, 1.0, 0.07, MAT.woodDark, 0, 0.5, 0.06); gp(0.05, 1.0, 0.07, MAT.woodDark, 0, 0.5, 1.14);
  gp(0.04, 0.06, 1.15, MAT.woodDark, 0, 0.75, 0.6).rotation.x = 0.0;
  // a water trough inside the pen's west wall
  const tg = new THREE.Group(); tg.position.set(-5.35, 0, -0.55); world.add(tg);
  add(bx(1.5, 0.34, 0.5), MAT.woodDark, 0, 0.17, 0, tg);
  const tw = flat(add(new THREE.PlaneGeometry(1.36, 0.37), MAT.troughWater, 0, 0.3, 0, tg, { cast: false }));
}
// --- the village corner: two huts south-west ---
{
  const hutAt = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
    add(tbox(1.7, 1.5, 1.6, 2), MAT.plaster, 0, 0.75, 0, g, { cast: false });
    const roof = add(new THREE.ConeGeometry(1.55, 0.95, 4), MAT.roofTex, 0, 1.98, 0, g, { cast: false }); roof.rotation.y = Math.PI / 4;
    add(bx(0.55, 0.95, 0.06), MAT.woodDark, 0, 0.48, 0.82, g, { cast: false });
    const win = add(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ color: '#ffe9bd', fog: true }), 0.55, 0.95, 0.82, g, { cast: false }); win.userData.ndSkip = true;
  };
  hutAt(-8.5, 5.1, 0.25); hutAt(-6.2, 7.4, -0.2);
}
// --- the flock: 100 sheep + the wolf, built once, posed per frame
// by the story's flock model (worldState) ---
const sheepGroups = [];
{
  for (let i = 0; i < 100; i++) { const s = makeSheep(i); s.scale.setScalar(0.72); world.add(s); sheepGroups.push(s); }
  const w = makeWolf(); w.scale.setScalar(0.84); world.add(w); sheepGroups.push(w);
}
// --- the final hook board on its easel ---
const boardPlane = textBoard(['HE COUNTED', 'ONE TOO MANY'], 2.2, 0.78, '#f3e9d2', '#3a2a18', 900, { fsMul: 0.60 });
{
  const [bx, by, bz] = BOARD_POS;
  const eg = new THREE.Group(); eg.position.set(bx, 0, bz); eg.rotation.y = BOARD_RY; world.add(eg);
  for (const s of [-1, 1]) {
    const leg = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.72, 0.7, 0.1, eg); leg.rotation.x = 0.18;
    const leg2 = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.72, 0.7, -0.28, eg); leg2.rotation.x = -0.3;
  }
  add(box(1.7, 0.06, 0.06), MAT.woodDark, 0, 0.52, 0.16, eg);
  boardPlane.position.set(bx, by, bz); boardPlane.rotation.y = BOARD_RY; boardPlane.rotation.x = -0.05;
  world.add(boardPlane); addBoardOccluder(boardPlane, 2.2, 0.78, 'boardK');
}

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
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 },
  gradeAmt: { value: 0.85 }, gradeExp: { value: 1.0 } }; // CINEMATIC GRADE (charfix r2): ACES filmic + split tone
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash, gradeAmt, gradeExp; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  vec3 acesFit(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
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
    // CINEMATIC GRADE (charfix round 2, Abid 2026-11-22: "colour filter
    // cinematic lage"): ACES-fit filmic S-curve (soft shoulder, toe),
    // then SPLIT TONE — teal into the shadows, warm gold into the
    // highlights (the teal-orange film look; skin sits in the warm
    // mids and is protected). Applied HERE, in the ink pass, so it
    // covers world + character cards; captions are composited AFTER
    // this pass (capScene) and are never graded. Vignette stays last.
    vec3 gc = acesFit(c * gradeExp);
    float gl2 = dot(gc, vec3(.299,.587,.114));
    gc += vec3(-.014,.010,.018) * (1. - smoothstep(0., .5, gl2));
    gc *= mix(vec3(1.), vec3(1.07, 1.0, .90), smoothstep(.5, 1., gl2));
    c = mix(c, gc, gradeAmt);
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.));
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  float vigf(vec2 uv){ vec2 q = uv - vec2(.5); return 1. - .34 * smoothstep(.38, 1.02, length(q) * 1.42); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb * vigf(vUv), 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3) * vigf(vUv), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- word-by-word captions (the template's signature) ----------
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
  if (i >= 0) word = WORDS[i].w;
  if (word === capKey) return;
  capKey = word;
  capG.clearRect(0, 0, W, H);
  if (word) {
    capG.font = '900 74px Arial, Helvetica, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.79);
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
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardPlane.material.opacity = Ws.boardK ?? 0; boardPlane.visible = (Ws.boardK ?? 0) > 0.01;
  chandLight.intensity = 0; // daylight set: the kitchen practical stays off
  // the gate swings with the homecoming streams (and the wolf's exit)
  const go = Ws.gateOpen || 0;
  gatePanel.rotation.y = -1.85 * go * (0.92 + 0.08 * Math.sin(f * 0.11));
  // the flock, posed by the story's model
  const fl = flockAt(f);
  for (let i = 0; i < fl.length; i++) {
    const sd = fl[i], g = sheepGroups[i];
    if (!g) continue;
    const bob = sd.mv ? Math.abs(Math.sin(f * 0.32 + i * 1.3)) * 0.035 : Math.sin(f * 0.05 + i * 2.1) * 0.006;
    g.position.set(sd.x, bob, sd.z);
    g.rotation.y = sd.ry;
    const bs = (sd.wolf ? 0.84 : 0.72) * (sd.s || 1); if (Math.abs(g.scale.x - bs) > 0.001) g.scale.setScalar(bs);
    if (g.userData.stripe) g.userData.stripe.visible = !!sd.stripe;
    if (g.userData.headG) g.userData.headG.rotation.x = sd.wolf ? 0.06 : sd.graze * 0.42;
    if (sd.wolf && g.userData.shell) {
      const k = Ws.wolfFleece || 0;
      g.userData.shell.position.set(0.62 * k, -0.5 * k * k, -0.3 * k);
      g.userData.shell.rotation.set(0.5 * k, 0, 1.85 * k);
    }
  }
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
window.renderFrame = (fNew) => {
  // identity warp: this film is built natively on its own stem, so
  // picture frames == stem frames (timewarp.js is the identity map).
  const f = warpF(fNew);
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
  drawCaption(fNew);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
