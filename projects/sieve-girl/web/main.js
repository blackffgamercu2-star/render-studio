import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, BOARD_POS, BOARD_RY, sieveAt, STONE_POS, DIP_POS, CLAY_POS, STOOL_POS } from './story.js';
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
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, hh, n = 8) => new THREE.CylinderGeometry(rt, rb, hh, n);

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

// ---------- canvas textures (procedural, from paint.js) ----------
const MAT = {
  stone: texM(P.stone(8), 9, 7),
  stoneDark: texM(P.stone(11), 3, 3, '#b8ab94'),
  wood: texM(P.planks(4), 2, 2),
  woodDark: texM(P.planks(6), 2, 2, '#9a7a58'),
  plaster: texM(P.plaster(8, 42), 6, 2),
  clothRed: texM(P.weave(21, [352, 62, 30]), 2, 6),
  wicker: texM(P.weave(31, [196, 164, 92]), 6, 2, '#c9a05e'),
  brass: new THREE.MeshStandardMaterial({ color: '#c9a24e', roughness: 0.32, metalness: 0.85, envMapIntensity: 1.6 }),
  cream: toon({ color: '#efe3c8', roughness: 1 }),
  leaf: toon({ color: '#4d7a35', roughness: 1 }),
  leaf2: toon({ color: '#639347', roughness: 1 }),
  grass: texM(P.grass(6), 26, 26),
  dirt: texM(P.dirt(7), 10, 10),
  dirtDark: texM(P.dirt(12), 4, 4, '#9a7a58'),
  roofTex: texM(P.roof(9), 2, 2),
  clayPot: toon({ color: '#a85f36', roughness: 0.9 }),
  clayPot2: toon({ color: '#8a5a34', roughness: 0.9 }),
  clayPot3: toon({ color: '#bb7444', roughness: 0.9 }),
  clayWet: toon({ color: '#8a7a63', roughness: 0.65 }),
};
const CLAY_WET = new THREE.Color('#8a7a63'), CLAY_DRY = new THREE.Color('#b09a78');

// ---------- a clay pot (real parts: belly, neck, rim) ----------
const makePot = (mat, s = 1) => {
  const g = new THREE.Group();
  const belly = add(sph(0.30 * s, 14, 11), mat, 0, 0.26 * s, 0, g); belly.scale.set(1, 0.88, 1);
  add(cyl(0.17 * s, 0.21 * s, 0.14 * s, 12), mat, 0, 0.52 * s, 0, g);
  const rim = add(new THREE.TorusGeometry(0.185 * s, 0.032 * s, 7, 16), mat, 0, 0.59 * s, 0, g); rim.rotation.x = Math.PI / 2;
  return g;
};

// ---------- WORLD: the village square + river bank (ONE set) ----------
const world = new THREE.Group(); scene.add(world);
let waterMesh, deepBase;
{ // base ground, the dirt bank, the path, the RIVER
  flat(add(new THREE.PlaneGeometry(150, 58), MAT.grass, 0, -0.03, 22.8, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(44, 3.4), MAT.dirt, 0, 0.0, -4.9, world, { cast: false }));       // the bank strip
  flat(add(new THREE.PlaneGeometry(15, 12), MAT.dirt, -1.5, -0.015, 1.5, world, { cast: false }));  // the worn village path
  for (let bx = -17; bx <= 17; bx += 2.1) add(sph(0.30, 9, 7), MAT.stoneDark, bx, -0.16, -6.35, world, { cast: false }); // bank edging stones
  deepBase = flat(add(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: '#062a36', fog: true }), 0, -1.7, -51, world, { cast: false }));
  deepBase.userData.ndSkip = true;
  waterMesh = FX.makeWaterCine({ size: 84, seg: 88, spark: 1.0, deep: 0x04344a, shallow: 0x0e5d7a, sky: 0xa8d4e6 });
  waterMesh.position.set(0, -0.25, -48); waterMesh.castShadow = false; waterMesh.receiveShadow = false;
  world.add(waterMesh);
}
// --- boats on the river + gulls over the water ---
let boatA, boatB; const gulls = [];
{
  const boatAt = (x, z, s, hullCol) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = 0.5; world.add(g);
    add(box(2.6 * s, 0.5 * s, 0.9 * s), toon({ color: hullCol, roughness: 0.9 }), 0, 0.1 * s, 0, g);
    const bow = add(box(0.8 * s, 0.42 * s, 0.7 * s), toon({ color: hullCol, roughness: 0.9 }), 1.55 * s, 0.14 * s, 0, g); bow.rotation.z = 0.35;
    add(cyl(0.05 * s, 0.06 * s, 2.6 * s, 6), MAT.woodDark, -0.2 * s, 1.5 * s, 0, g, { cast: false });
    const sail = add(new THREE.ConeGeometry(0.55 * s, 1.5 * s, 4), MAT.cream, -0.2 * s, 1.15 * s, 0, g, { cast: false }); sail.scale.z = 0.3;
    return g;
  };
  boatA = boatAt(-5.5, -9.5, 1, '#8a5a34'); boatB = boatAt(11.5, -11.5, 0.8, '#5d7a8a');
  const gullAt = (cx, cz, r, h, ph) => {
    const g = new THREE.Group(); world.add(g);
    const wmat = new THREE.MeshBasicMaterial({ color: '#f4f7f5', fog: true, side: THREE.DoubleSide });
    const wl = add(new THREE.PlaneGeometry(0.62, 0.16), wmat, -0.31, 0, 0, g, { cast: false });
    const wr = add(new THREE.PlaneGeometry(0.62, 0.16), wmat, 0.31, 0, 0, g, { cast: false });
    wl.userData.ndSkip = wr.userData.ndSkip = true;
    g.userData = { cx, cz, r, h, ph, wl, wr };
    gulls.push(g); return g;
  };
  gullAt(-3, -12, 6, 4.6, 0); gullAt(6, -14, 8, 5.4, 2.2); gullAt(0, -10, 4.5, 3.9, 4.4);
}
// --- the dipping stone + splash rings at the water's edge ---
let ring1, ring2;
{
  add(cyl(0.55, 0.68, 0.24, 10), MAT.stone, DIP_POS.x, 0.0, DIP_POS.z, world);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: '#dff2e8', transparent: true, opacity: 0, fog: true, side: THREE.DoubleSide, depthWrite: false });
  ring1 = flat(add(new THREE.RingGeometry(0.34, 0.46, 24), ringMat(), DIP_POS.x, -0.14, DIP_POS.z, world, { cast: false }));
  ring2 = flat(add(new THREE.RingGeometry(0.34, 0.44, 24), ringMat(), DIP_POS.x, -0.13, DIP_POS.z, world, { cast: false }));
  ring1.userData.ndSkip = ring2.userData.ndSkip = true;
}
// --- the clay patch on the bank ---
{
  flat(add(new THREE.CircleGeometry(0.9, 18), MAT.dirtDark, CLAY_POS.x, 0.012, CLAY_POS.z, world, { cast: false }));
  for (const [lx, lz, s] of [[-0.3, 0.15, 0.16], [0.25, -0.2, 0.13], [0.05, 0.35, 0.11]]) {
    const lump = add(sph(s, 9, 7), MAT.clayWet, CLAY_POS.x + lx, s * 0.5, CLAY_POS.z + lz, world, { cast: false }); lump.scale.y = 0.7;
  }
}
// --- the flat work stone ---
{
  add(cyl(0.95, 1.12, 0.52, 9), MAT.stone, STONE_POS.x, 0.26, STONE_POS.z, world);
  flat(add(new THREE.CircleGeometry(0.8, 14), MAT.stoneDark, STONE_POS.x, 0.53, STONE_POS.z, world, { cast: false }));
}
// --- THE SIEVE (3D): woven lathe bowl + clay lining + leaves ---
let sieveG, clayDisc; const leafMeshes = [];
{
  sieveG = new THREE.Group(); world.add(sieveG);
  const prof = [[0.01, 0.0], [0.16, 0.01], [0.26, 0.03], [0.31, 0.065], [0.34, 0.095]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), new THREE.MeshToonMaterial({ gradientMap: grad, map: MAT.wicker.map, color: '#c9a05e', side: THREE.DoubleSide }));
  bowl.castShadow = true; bowl.receiveShadow = true; sieveG.add(bowl);
  const rim = add(new THREE.TorusGeometry(0.34, 0.02, 7, 22), MAT.woodDark, 0, 0.095, 0, sieveG); rim.rotation.x = Math.PI / 2;
  clayDisc = flat(add(new THREE.CircleGeometry(0.27, 20), MAT.clayWet, 0, 0.058, 0, sieveG, { cast: false }));
  for (let i = 0; i < 3; i++) {
    const lf = flat(add(new THREE.CircleGeometry(0.115, 12), i % 2 ? MAT.leaf2 : MAT.leaf, [-0.09, 0.095, 0][i], 0.066 + i * 0.003, [-0.045, 0.03, 0.08][i], sieveG, { cast: false }));
    lf.scale.set(1.5, 0.8, 1); lf.rotation.z = i * 1.1;
    leafMeshes.push(lf);
  }
}
// --- the potter's stall, west: posts, awning, counter of pots ---
{
  const g = new THREE.Group(); g.position.set(-6.2, 0, 0.85); world.add(g);
  for (const [px, pz] of [[-1.8, -0.65], [1.8, -0.65], [-1.8, 0.65], [1.8, 0.65]]) add(cyl(0.055, 0.065, 2.3, 7), MAT.woodDark, px, 1.15, pz, g);
  const awn = add(box(4.1, 0.07, 1.8), MAT.clothRed, 0, 2.36, 0, g, { cast: false }); awn.rotation.x = 0.13;
  add(box(3.6, 0.1, 1.15), MAT.wood, 0, 0.82, 0, g);
  for (const [lx, lz] of [[-1.65, -0.45], [1.65, -0.45], [-1.65, 0.45], [1.65, 0.45]]) add(box(0.11, 0.78, 0.11), MAT.woodDark, lx, 0.39, lz, g);
  // rows of fired pots on the counter + a low shelf of more
  const potSpots = [[-1.3, -0.15, 0.9], [-0.55, 0.18, 1.1], [0.25, -0.12, 0.8], [1.05, 0.15, 1.0], [1.5, -0.2, 0.7]];
  potSpots.forEach(([px, pz, s], i) => { const p = makePot([MAT.clayPot, MAT.clayPot2, MAT.clayPot3][i % 3], s); p.position.set(px, 0.87, pz); g.add(p); });
  add(box(3.2, 0.08, 0.6), MAT.wood, 0, 0.34, 0.42, g, { cast: false });
  [[-1.1, 0.42, 0.75], [-0.2, 0.42, 0.9], [0.8, 0.42, 0.7]].forEach(([px, pz, s], i) => { const p = makePot([MAT.clayPot2, MAT.clayPot3, MAT.clayPot][i % 3], s); p.position.set(px, 0.38, pz); g.add(p); });
  // a water barrel beside the stall's east end (world -3.9, 1.35)
  add(cyl(0.34, 0.3, 0.95, 10), MAT.woodDark, 2.3, 0.475, 0.5, g);
  flat(add(new THREE.CircleGeometry(0.29, 14), toon({ color: '#0d4a56', roughness: 0.3 }), 2.3, 0.96, 0.5, g, { cast: false }));
}
// --- the prize pot on its stool beside the stall ---
let prizePot, prizeBand;
{
  add(box(0.5, 0.55, 0.5), MAT.wood, STOOL_POS.x, 0.275, STOOL_POS.z, world);
  prizePot = makePot(MAT.clayPot, 1.25); prizePot.position.set(STOOL_POS.x, 0.55, STOOL_POS.z); world.add(prizePot);
  prizeBand = add(new THREE.TorusGeometry(0.30, 0.02, 6, 18), MAT.brass, STOOL_POS.x, 0.55 + 0.33, STOOL_POS.z, world, { cast: false }); prizeBand.rotation.x = Math.PI / 2;
}
// --- the leak puddle at the potter's feet ---
let puddle;
{
  puddle = flat(add(new THREE.CircleGeometry(0.55, 18), new THREE.MeshStandardMaterial({ color: '#46626e', roughness: 0.12, metalness: 0.1 }), -4.9, 0.012, -0.15, world, { cast: false }));
  puddle.visible = false;
}
// --- the girl's hut, east: plaster walls, roof, the cracked pot ---
{
  const g = new THREE.Group(); g.position.set(7.6, 0, 0.8); world.add(g);
  add(tbox(3.2, 2.5, 2.8, 2), MAT.plaster, 0, 1.25, 0, g, { cast: false });
  const roof = add(new THREE.ConeGeometry(2.6, 1.35, 4), MAT.roofTex, 0, 3.17, 0, g, { cast: false }); roof.rotation.y = Math.PI / 4;
  add(box(0.07, 1.35, 0.75), MAT.woodDark, -1.62, 0.68, -0.4, g, { cast: false });   // the door, west face
  const win = add(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ color: '#ffe9bd', fog: true }), -1.62, 1.55, 0.55, g, { cast: false });
  win.rotation.y = -Math.PI / 2; win.userData.ndSkip = true;
  // the cracked family pot: two halves split on the ground by the door
  const h1 = add(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI), MAT.clayPot2, -2.1, 0.1, -1.75, g); h1.rotation.set(0.4, 0.3, 1.9);
  const h2 = add(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI), MAT.clayPot2, -1.72, 0.08, -1.6, g); h2.rotation.set(-0.3, 2.6, -1.7);
}
// --- village houses along the south edge (backdrop) + trees ---
{
  const houseAt = (x, z, ry, w = 3.4) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
    add(tbox(w, 2.5, 2.6, 2), MAT.plaster, 0, 1.25, 0, g, { cast: false });
    const roof = add(new THREE.ConeGeometry(w * 0.72, 1.3, 4), MAT.roofTex, 0, 3.15, 0, g, { cast: false }); roof.rotation.y = Math.PI / 4;
    add(box(0.7, 1.3, 0.07), MAT.woodDark, -0.6, 0.65, 1.32, g, { cast: false });
    const win = add(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ color: '#ffe9bd', fog: true }), 0.75, 1.5, 1.32, g, { cast: false }); win.userData.ndSkip = true;
  };
  houseAt(-9.5, 12, 0.15); houseAt(-2.5, 13, -0.1, 4.2); houseAt(12.5, 12.2, -0.15, 3.6);
  const treeAt = (x, z, s = 1) => {
    add(cyl(0.16 * s, 0.24 * s, 1.6 * s, 8), MAT.woodDark, x, 0.8 * s, z, world, { cast: false });
    const c1 = add(sph(1.15 * s, 12, 9), MAT.leaf, x, 2.3 * s, z, world, { cast: false }); c1.scale.y = 0.85;
    const c2 = add(sph(0.85 * s, 11, 8), MAT.leaf2, x + 0.7 * s, 1.9 * s, z + 0.3, world, { cast: false }); c2.scale.y = 0.85;
  };
  treeAt(-11.5, -3.5, 1.1); treeAt(12.5, 4.5); treeAt(-13.5, 5.5, 0.95); treeAt(14.5, -2.5, 0.9); treeAt(-15, 0.5, 1.05);
}
// --- the final hook board on its easel ---
const boardPlane = textBoard(['A SIEVE', 'THAT HELD WATER'], 2.2, 0.78, '#f3e9d2', '#3a2a18', 900, { fsMul: 0.60 });
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
    // CINEMATIC GRADE (charfix round 2): ACES-fit filmic S-curve, then
    // SPLIT TONE — teal into the shadows, warm gold into the highlights.
    // Captions are composited AFTER this pass and are never graded.
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
  if (waterMesh) waterMesh.userData.update(f / 30);
  // boats bob, gulls circle the river
  boatA.position.y = Math.sin(f * 0.045) * 0.05 - 0.18; boatA.rotation.z = Math.sin(f * 0.038) * 0.02;
  boatB.position.y = Math.sin(f * 0.05 + 2) * 0.05 - 0.18; boatB.rotation.z = Math.sin(f * 0.041 + 1) * 0.02;
  for (const g of gulls) {
    const u = g.userData, a = f * 0.006 + u.ph;
    g.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(f * 0.03 + u.ph) * 0.2, u.cz + Math.sin(a) * u.r * 0.5);
    g.rotation.y = -a - Math.PI / 2;
    const flap = Math.sin(f * 0.55 + u.ph * 3) * 0.55;
    u.wl.rotation.y = flap; u.wr.rotation.y = -flap;
  }
  // THE SIEVE (3D): resting on the bank / on the work stone, its
  // clay lining smeared on, leaves pressed in, clay drying pale
  const SA = sieveAt(f);
  sieveG.visible = SA.mode !== 'girl';
  if (SA.mode === 'stone') sieveG.position.set(STONE_POS.x + 0.55, STONE_POS.topY, STONE_POS.z + 0.1);
  else if (SA.mode === 'ground') sieveG.position.set(SA.x, 0.02, SA.z);
  clayDisc.visible = SA.clayK > 0.01;
  clayDisc.scale.setScalar(Math.max(SA.clayK, 0.001));
  MAT.clayWet.color.copy(CLAY_WET).lerp(CLAY_DRY, SA.dryK);
  leafMeshes.forEach((lf, i) => {
    const k = Math.min(Math.max(SA.leafStage - i, 0), 1);
    lf.visible = k > 0.02;
    lf.scale.set(1.5 * Math.max(k, 0.001), 0.8 * Math.max(k, 0.001), 1);
  });
  // splash rings at the dipping stone
  const sk = Ws.splashK || 0;
  ring1.material.opacity = sk * 0.65; ring1.scale.setScalar(0.7 + sk * 1.7);
  ring2.material.opacity = Math.max(0, sk - 0.35) * 0.8; ring2.scale.setScalar(0.7 + Math.max(0, sk - 0.35) * 2.2);
  // the prize pot waits on its stool until the potter snatches it up
  prizePot.visible = prizeBand.visible = (Ws.potK ?? 1) > 0.5;
  // the leak puddle spreads at his feet
  puddle.visible = (Ws.puddleK || 0) > 0.01;
  puddle.scale.setScalar(Math.max(Ws.puddleK || 0, 0.001));
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
