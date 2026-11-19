import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, SHED, TABLE, QUAY_Z, FARBANK_Z, CABLE_X, boatAt } from './story.js';
import { WORDS } from './words.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const envMap = FX.detailEnv(renderer);   // LIBRARY v3: PMREM env so prop sheen moves with the camera
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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- sail-cloth canvases ----------
const sailCanvas = (kind) => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = kind === 'torn' || kind === 'patched' ? '#ddd3ba' : kind === 'home' ? '#d8c49a' : '#e7dfc8';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,105,70,${0.04 + Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,252,240,${0.05 + Math.random() * 0.07})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
  for (const y of [62, 126, 190]) { g.fillStyle = 'rgba(105,90,58,0.55)'; g.fillRect(0, y, 256, 2.4); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y + 3, 256, 1.4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const MAT = {
  quay: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 12, 8, '#bfb49c'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  sand: texM(M4.sandV4(15), 6, 6, '#d9c49a'),
  grass: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 77, { dots: 900 }), 10, 4, '#7a8a4e'),
  sail: toon({ map: sailCanvas('plain') }),
  hullA: toon({ color: '#7a3a26' }), hullB: toon({ color: '#2e4a5e' }), hullC: toon({ color: '#5d6a2e' }), hullD: toon({ color: '#6e2a3a' }),
  cloth: toon({ color: '#8a6f42' }), rope: toon({ color: '#9a7c50' }),
  gold: toon({ color: '#e8b64c' }), dark: toon({ color: '#33302c' }), white: toon({ color: '#f7f3e6' }),
  iron: toon({ color: '#4a4d52' }), goatCream: toon({ color: '#e8ddc4' }), goatDark: toon({ color: '#6a5138' }),
  leaf: toon({ color: '#4a7a34' }),
};

// ---------- the river landing ----------
const world = new THREE.Group(); scene.add(world);
const flags = [];
let water = null;
{
  const g = world;
  // the river (shader water; colours follow the grade in worldState)
  water = FX.makeWater({ size: 200, seg: 72, deep: 0x14586b, shallow: 0x35a3a5, sky: 0xcfeeda, amp: 0.3, spark: 0.6 });
  water.position.set(0, -0.32, -114.8); water.userData.ndSkip = true; g.add(water);
  // the quay: a broad stone slab, its top at y=0, the river beyond z=QUAY_Z
  add(tbox(46, 0.8, 31, 3), MAT.quay, 0, -0.4, QUAY_Z + 15.5, g, { cast: false });
  add(tbox(46, 0.22, 0.5, 2), MAT.stoneDk, 0, -0.11, QUAY_Z + 0.25, g, { cast: false });   // quay edge rim
  for (let bx = -20; bx <= 20; bx += 5) add(new THREE.CylinderGeometry(0.16, 0.19, 0.55, 9), MAT.woodDk, bx, 0.1, QUAY_Z + 0.8, g, { cast: false }); // mooring bollards
  // sand strip + crates/barrels along the back of the quay (landing clutter)
  const sand = flat(add(new THREE.CircleGeometry(9, 36), MAT.sand, -6, 0.012, 10.5, g, { cast: false })); sand.scale.set(0.95, 1, 0.5);
  for (const [cx, cz] of [[-14.5, 6.5], [13.8, 7.5], [-15.5, -6], [15, -5]]) {
    const cr = FX.crate(1.15); cr.position.set(cx, 0.58, cz); cr.rotation.y = cx * 0.7; g.add(cr);
    const br = FX.barrel(0.42, 1.0); br.position.set(cx + 1.1, 0.5, cz + 0.4); g.add(br);
  }
  // the landing shed (west): door facing the plaza (+x)
  const hut = PR.buildHut({ w: 4.8, d: 3.8, h: 2.7, wall: 'planks', seed: 23, envMap });
  hut.group.position.set(SHED.x, 0, SHED.z); hut.group.rotation.y = Math.PI / 2; g.add(hut.group);
  add(tbox(0.14, 3.4, 0.14, 1), MAT.woodDk, SHED.x + 2.6, 1.7, SHED.z - 2.2, g, { cast: false });
  const flag1 = add(new THREE.PlaneGeometry(1.05, 0.62, 10, 4), toon({ color: '#c9862e', side: THREE.DoubleSide }), SHED.x + 2.6, 3.15, SHED.z - 1.85, g, { cast: false });
  flag1.geometry.translate(0.52, 0, 0); FX.clothInit(flag1, { amp: 0.16, freq: 3.4, speed: 7 }); flags.push(flag1);
  // merchant's coin table (east)
  add(tbox(1.7, 0.09, 1.0, 2), MAT.wood, TABLE.x, 0.74, TABLE.z, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), MAT.woodDk, TABLE.x + lx, 0.37, TABLE.z + lz, g, { cast: false });
  const sack2 = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.cloth, TABLE.x - 0.45, 0.93, TABLE.z + 0.15, g, { cast: false }); sack2.scale.y = 0.85;
  for (let i = 0; i < 5; i++) { const cn = add(new THREE.CylinderGeometry(0.075, 0.075, 0.028, 12), MAT.gold, TABLE.x + 0.35 + (i % 2) * 0.17, 0.8 + Math.floor(i / 2) * 0.03, TABLE.z - 0.18, g, { cast: false }); }
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
  // ---- the far bank: land rising out of the river, two huts + palms ----
  add(tbox(64, 0.55, 9, 3), MAT.grass, 0, -0.22, FARBANK_Z, g, { cast: false });
  add(tbox(64, 0.22, 0.6, 2), MAT.stoneDk, 0, -0.05, FARBANK_Z + 4.6, g, { cast: false });
  for (const [hx, hz, seed] of [[-12, FARBANK_Z, 31], [10, FARBANK_Z + 0.6, 47]]) {
    const fh = PR.buildHut({ w: 4.2, d: 3.4, h: 2.5, wall: 'planks', seed, envMap });
    fh.group.position.set(hx, 0.05, hz); fh.group.rotation.y = seed * 0.05; g.add(fh.group);
  }
  for (const [px, pz] of [[-18, FARBANK_Z + 1], [17, FARBANK_Z - 1], [2, FARBANK_Z + 1.5]]) {
    const palm = PR.buildPalm({ h: 4.6, seed: px * 3 + 7, envMap });
    palm.group.position.set(px, 0.05, pz); g.add(palm.group);
  }
  // ---- the iron cable: sunk deep, tied fast to both banks ----
  // runs along z at CABLE_X, just under the water surface; visible only on
  // the reveal shots (cableK). A short rope hangs from B0's bow to it.
  const cable = add(new THREE.CylinderGeometry(0.055, 0.055, 38, 8), MAT.iron, CABLE_X, -0.14, -32, g, { cast: false });
  cable.rotation.x = Math.PI / 2; cable.userData.isCable = true;
  const rope = add(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), MAT.rope, 0, 0, 0, g, { cast: false });
  rope.userData.isRope = true;
  world.userData.cable = cable; world.userData.rope = rope;
}
// grain sacks + goats ride B0's deck during the cargo crossing
const makeSack = () => {
  const grp = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.26, 10, 8), MAT.cloth, 0, 0, 0, grp); body.scale.y = 0.8;
  add(new THREE.CylinderGeometry(0.06, 0.09, 0.14, 7), MAT.cloth, 0, 0.24, 0, grp);
  return grp;
};
const makeGoat = () => {
  const grp = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.24, 12, 9), MAT.goatCream, 0, 0.42, 0, grp); body.scale.set(1.5, 0.85, 0.8);
  const head = add(tbox(0.16, 0.2, 0.22, 1), MAT.goatCream, 0.38, 0.62, 0, grp);
  add(tbox(0.1, 0.08, 0.12, 1), MAT.goatDark, 0.5, 0.58, 0, grp);   // snout
  for (const s of [-1, 1]) {
    const horn = add(new THREE.ConeGeometry(0.035, 0.16, 6), MAT.goatDark, 0.36, 0.76, s * 0.07, grp);
    horn.rotation.z = -0.5;
    add(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 6), MAT.goatDark, 0.28 * s > 0 ? 0.28 : -0.28, 0.15, s * 0.12, grp);
  }
  add(tbox(0.08, 0.06, 0.08, 1), MAT.goatDark, -0.4, 0.5, 0, grp);  // tail
  return grp;
};
const deckSacks = [makeSack(), makeSack(), makeSack()];
deckSacks.forEach((s) => world.add(s));
const deckGoats = [makeGoat(), makeGoat()];
deckGoats.forEach((s) => world.add(s));
// the coin pouch (passenger pays) + the gold bag (merchant's offer)
const sackG = new THREE.Group(); world.add(sackG);
const sackBody = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.cloth, 0, 0, 0, sackG); sackBody.scale.y = 0.85;
add(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 7), MAT.cloth, 0, 0.2, 0, sackG);
const sackGlint = softGlow(0.55, '#ffe9a8', 0); sackGlint.position.set(0.05, 0.15, 0.05); sackG.add(sackGlint);
const goldG = new THREE.Group(); world.add(goldG);
const goldBody = add(new THREE.SphereGeometry(0.24, 10, 8), MAT.gold, 0, 0, 0, goldG); goldBody.scale.y = 0.85;
add(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 7), MAT.cloth, 0, 0.22, 0, goldG);
const goldGlint = softGlow(0.7, '#ffe9a8', 0); goldGlint.position.set(0.05, 0.15, 0.05); goldG.add(goldGlint);

// ---------- boats ----------
// hull + mast + yard + cloth sail. The sail plane hangs from the yard;
// story drives per-boat: sailK (0 = bare mast), limp (1 = hanging dead,
// 0 = bellied full of wind), kind, heel. Rowing boats carry oars instead.
const makeBoat = (hullMat, sailMat) => {
  const grp = new THREE.Group();
  const hull = add(tbox(2.9, 0.62, 1.15, 2), hullMat, 0, 0.32, 0, grp);
  const bow = add(new THREE.CylinderGeometry(0.58, 0.58, 0.62, 3, 1), hullMat, 1.72, 0.32, 0, grp);
  bow.rotation.y = Math.PI; bow.scale.set(1, 1, 0.99);
  add(tbox(3.1, 0.1, 1.3, 2), MAT.woodDk, 0, 0.66, 0, grp);                       // gunwale
  add(tbox(0.5, 0.34, 0.9, 1), MAT.wood, -1.1, 0.8, 0, grp, { cast: false });     // stern box
  add(new THREE.CylinderGeometry(0.055, 0.075, 3.6, 8), MAT.woodDk, 0.1, 2.4, 0, grp); // mast
  const yard = add(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 7), MAT.woodDk, 0.1, 3.95, 0, grp); yard.rotation.x = Math.PI / 2;
  const sailGeo = new THREE.PlaneGeometry(2.05, 2.5, 12, 10); sailGeo.translate(0, -1.25, 0);
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.material.side = THREE.DoubleSide; sail.castShadow = true;
  sail.position.set(0.1, 3.92, 0); grp.add(sail);
  FX.clothInit(sail, { amp: 0.2, freq: 2.6, speed: 6 });
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.6), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, opacity: 0.5, color: 0x06222b, depthWrite: false }));
  wl.rotation.x = -Math.PI / 2; wl.position.set(0.2, 0.05, 0); wl.userData.ndSkip = true; wl.renderOrder = 1; grp.add(wl);
  const pen = add(new THREE.PlaneGeometry(0.62, 0.3, 8, 3), toon({ color: '#c23b2e', side: THREE.DoubleSide }), 0.42, 4.32, 0, grp, { cast: false });
  pen.geometry.translate(0.31, 0, 0); FX.clothInit(pen, { amp: 0.1, freq: 3.6, speed: 8 }); flags.push(pen);
  grp.userData.sail = sail; grp.userData.pennant = pen;
  world.add(grp);
  return grp;
};
const makeOar = (side) => {
  const grp = new THREE.Group();
  const shaft = add(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 7), MAT.wood, 0, 0, 0, grp, { cast: false });
  shaft.rotation.x = Math.PI / 2;
  const blade = add(tbox(0.16, 0.02, 0.55, 1), MAT.woodDk, 0, 0, 1.35, grp, { cast: false });
  grp.position.set(0.2, 0.75, side * 0.62);
  return grp;
};
const boats = [
  { g: makeBoat(MAT.hullD, MAT.sail), home: [5.2, -17.5] },     // B0: the ferryman's boat
  { g: makeBoat(MAT.hullA, MAT.sail), home: [-3.0, -20.5] },    // B1 rowing boat
  { g: makeBoat(MAT.hullB, MAT.sail), home: [-8.0, -25.0] },    // B2 rowing boat
  { g: makeBoat(MAT.hullC, MAT.sail), home: [-10, -44] },       // B3 far-bank mooring
];
boats.forEach((b, i) => { b.g.position.set(b.home[0], -0.3, b.home[1]); b.g.rotation.y = i === 0 ? 0.12 : (i - 1.5) * 0.22; });
// oars on the two rowing boats (dipping when oarK is on)
const oars = [];
for (const bi of [1, 2]) {
  for (const side of [-1, 1]) {
    const o = makeOar(side);
    boats[bi].g.add(o); oars.push({ o, bi, side, phase: bi * 1.3 + (side > 0 ? 0.7 : 0) });
  }
}

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard(['The Ferryman', 'Who Rowed Without Oars'], 4.6, 1.3, '#0f323e', '#d8f4f0', 900, { fsMul: 0.62, pitch: 0.36, dy: 0.03 });
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.3, 'boardTitle');
const boardHook = textBoard(['But tomorrow… an inn', 'where nobody ever paid —', 'not one coin, not ever.', 'How did it survive?'], 4.6, 1.5, '#0d2a38', '#aee9e2', 900, { pitch: 0.20, dy: 0.01, fsMul: 0.92 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: river dust/spray, clouds, wake ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 2, { rate: 0.15, color: 0xd8f4ea, opacity: 0.06, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const sprayEmit = smoke.addEmitter(5.2, 0.4, -18.6, { rate: 0, color: 0xffffff, opacity: 0.3, scale: 0.5, grow: 1.5, life: 0.9, vy: 0.8, wind: 0.3 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.22, color: 0xf4fafa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const wake = new FX.Wake(scene, 40); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  wake.pool.forEach((p) => { p.life = -1; p.m.visible = false; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    dustEmit.rate = pr.smokeRate * 3;
    sprayEmit.rate = pr.steamRate * 3.2;
    const bp = boatAt(fxF);
    sprayEmit.x = bp.x + 1.9; sprayEmit.z = bp.z; sprayEmit.y = 0.35;
    if (pr.steamRate > 0.05) wake.trail(bp.x - 1.6, bp.z, dt, 1.15);
    smoke.update(t, dt);
    fxClouds.update(t, dt * (1 + (pr.windK || 0) * 2.2));
    wake.update(t, dt);
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

// ---------- V3 word-by-word captions ----------
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
  const L = lightFor(shotAt(f), f);
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // water follows the grade + the current (calm glass -> lively sparkle)
  if (water) {
    water.material.uniforms.uDeep.value.set(L.waterDeep); water.material.uniforms.uShallow.value.set(L.waterShal);
    water.material.uniforms.uAmp.value = 0.22 + (Ws.windK || 0) * 0.38;
    water.material.uniforms.uSpark.value = 0.25 + (Ws.windK || 0) * 0.75;
    water.userData.update(f / 30);
  }
  // the iron cable + the rope from B0's bow hang into the reveal only
  const cable = world.userData.cable, rope = world.userData.rope;
  cable.visible = (Ws.cableK || 0) > 0.01;
  const bp0 = boatAt(f);
  rope.visible = (Ws.cableK || 0) > 0.01;
  if (rope.visible) rope.position.set(bp0.x + 1.55, 0.05, bp0.z);
  // grain sacks + goats ride B0's deck on the cargo crossing
  const deckY = -0.3 + 0.66;   // boat deck top in world space (boat y=-0.3, deck +0.66)
  deckSacks.forEach((s, i) => {
    s.visible = (Ws.sackK || 0) > 0.01;
    if (s.visible) { const offs = [[0.9, -0.3], [0.9, 0.35], [0.2, 0.0]]; s.position.set(bp0.x + offs[i][0], deckY + 0.18, bp0.z + offs[i][1]); s.rotation.y = i * 1.1; }
  });
  deckGoats.forEach((s, i) => {
    s.visible = (Ws.goatK || 0) > 0.01;
    if (s.visible) { const offs = [[-0.4, -0.35], [-0.4, 0.35]]; s.position.set(bp0.x + offs[i][0], deckY + 0.02, bp0.z + offs[i][1]); s.rotation.y = Math.PI / 2 + (bp0.ry || 0); }
  });
  // coin pouch + gold bag ride the story
  const place = (grp, X, Y, Z, K) => { grp.visible = (K || 0) > 0.01; if (grp.visible) grp.position.set(X, Y, Z); };
  place(sackG, Ws.coinX, Ws.coinY, Ws.coinZ, Ws.coinK);
  place(goldG, Ws.goldX, Ws.goldY, Ws.goldZ, Ws.goldK);
  sackGlint.material.opacity = (Ws.coinGlint || 0) * 0.8; sackGlint.visible = (Ws.coinGlint || 0) > 0.05;
  goldGlint.material.opacity = (Ws.goldGlint || 0) * 0.8; goldGlint.visible = (Ws.goldGlint || 0) > 0.05;
  // boats: bob on the swell; sails limp or bellied by the current; B0 crosses
  const t = f / 30;
  boats.forEach((b, i) => {
    const st = Ws.boats[i];
    const bp = i === 0 ? boatAt(f) : { x: b.home[0], z: b.home[1] };
    b.g.position.set(bp.x, -0.3 + Math.sin(t * 0.9 + i * 1.7) * 0.05 * (1 + (Ws.windK || 0)), bp.z);
    b.g.rotation.z = Math.sin(t * 0.7 + i * 2.1) * 0.012 + (st.heel || 0);
    b.g.rotation.x = Math.sin(t * 0.55 + i) * 0.008;
    if (i === 0) b.g.rotation.y = 0.12 + (bp.ry || 0);
    const sail = b.g.userData.sail;
    sail.visible = (st.k || 0) > 0.01;
    if (sail.visible) {
      const limp = st.limp ?? 1;
      sail.material = MAT.sail;
      sail.userData.amp = 0.05 + (1 - limp) * 0.24;
      sail.userData.speed = 2 + (1 - limp) * 5;
      sail.rotation.x = limp * 0.16;                       // dead cloth hangs and folds
      sail.scale.set(1, 1 - limp * 0.06, 1);
      FX.clothWave(sail, t + i * 2.3);
    }
    const pen = b.g.userData.pennant;
    pen.userData.amp = 0.03 + (Ws.windK || 0) * 0.12;
    pen.userData.speed = 3 + (Ws.windK || 0) * 7;
    pen.rotation.x = (1 - (Ws.windK || 0)) * 0.5;          // pennants droop in the calm
    FX.clothWave(pen, t + i);
  });
  // oars dip in rhythm while the rowers strain
  for (const { o, phase } of oars) {
    o.visible = (Ws.oarK || 0) > 0.01;
    if (o.visible) o.rotation.x = Math.sin(t * 2.4 + phase) * 0.38 - 0.15;
  }
  // landing flag: droops in the calm, snaps when the current picks up
  for (const fl of flags) {
    if (fl.geometry.parameters && fl.geometry.parameters.width > 1) {
      fl.userData.amp = 0.03 + (Ws.windK || 0) * 0.17;
      fl.userData.speed = 3 + (Ws.windK || 0) * 6;
      fl.rotation.x = (1 - (Ws.windK || 0)) * 0.42;
      FX.clothWave(fl, t);
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
