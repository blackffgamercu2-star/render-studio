import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, BOARD_RY } from './story.js';
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
// Day fair: one warm sun. Practicals: boxLight = the boy's little oil lamp
// inside the book-box (interior set); shaftLight = the sun shaft spot that
// pours through the listening holes onto the boy.
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);
const boxLight = new THREE.PointLight(0xffb45e, 0, 9, 1.8); boxLight.position.set(30.8, 0.6, -30.7); scene.add(boxLight);
const shaftLight = new THREE.SpotLight(0xffd9a0, 0, 12, 0.5, 0.7, 1.1); shaftLight.position.set(30.1, 1.9, -28.8); scene.add(shaftLight); scene.add(shaftLight.target);
shaftLight.target.position.set(29.8, 0.3, -30.3);

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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- painted canvases ----------
const dirtCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#9a7648'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 36;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    const dark = rnd() > 0.45;
    gr.addColorStop(0, dark ? 'rgba(80,52,22,0.5)' : 'rgba(232,196,138,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.06 + rnd() * 0.09; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,236,200,0.07)' : 'rgba(40,24,8,0.09)'; g.fillRect(rnd() * 512, rnd() * 512, 2.4, 2.4); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(80,54,24,0.25)'; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 2 + rnd() * 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// golden page edges: fine horizontal leaf lines, warm gradient, one sheen band
const pageEdgeCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, '#caa14e'); gr.addColorStop(0.42, '#f4d67c'); gr.addColorStop(0.55, '#ffeeb0'); gr.addColorStop(0.68, '#eec964'); gr.addColorStop(1, '#b98c3a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  for (let y = 3; y < 512; y += 3) { g.fillStyle = `rgba(120,84,20,${0.10 + rnd() * 0.13})`; g.fillRect(0, y, 256, 1); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,246,200,${0.05 + rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
// an open page face: cream paper, ruled story lines (abstract), a small
// painted sun medallion — decoration only, no readable words
const pageFaceCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#f2e5c2'; g.fillRect(0, 0, 256, 384);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(160,118,52,${0.04 + rnd() * 0.05})`; g.fillRect(rnd() * 256, rnd() * 384, 3, 3); }
  g.strokeStyle = 'rgba(146,104,44,0.8)'; g.lineWidth = 3; g.strokeRect(12, 12, 232, 360);
  g.strokeStyle = 'rgba(90,60,30,0.5)'; g.lineWidth = 2;
  for (let r = 0; r < 8; r++) { const y = 128 + r * 28; g.beginPath(); g.moveTo(34, y); g.lineTo(34 + 150 + rnd() * 40, y); g.stroke(); }
  g.fillStyle = '#d99a26'; g.beginPath(); g.arc(128, 66, 26, 0, 7); g.fill();
  g.strokeStyle = '#b97c1c'; g.lineWidth = 3;
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 32, 66 + Math.sin(a) * 32); g.lineTo(128 + Math.cos(a) * 42, 66 + Math.sin(a) * 42); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
// the great cover: deep maroon, gold border + corner flourishes + medallion
const coverCanvas = () => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 640;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 640);
  gr.addColorStop(0, '#7c2430'); gr.addColorStop(0.5, '#93292f'); gr.addColorStop(1, '#6d1f28');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(40,8,10,${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * 512, rnd() * 640, 3, 3); }
  g.strokeStyle = '#e8bc58'; g.lineWidth = 10; g.strokeRect(26, 26, 460, 588);
  g.lineWidth = 3; g.strokeRect(48, 48, 416, 544);
  for (const [cx, cy] of [[48, 48], [464, 48], [48, 592], [464, 592]]) {
    g.fillStyle = '#e8bc58'; g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.fill();
    g.fillStyle = '#93292f'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
  }
  g.fillStyle = '#f0c95e'; g.beginPath(); g.arc(256, 268, 74, 0, 7); g.fill();
  g.fillStyle = '#c9962e'; g.beginPath(); g.arc(256, 268, 58, 0, 7); g.fill();
  g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(256, 268, 40, 0, 7); g.fill();
  g.strokeStyle = '#f0c95e'; g.lineWidth = 7;
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(256 + Math.cos(a) * 84, 268 + Math.sin(a) * 84); g.lineTo(256 + Math.cos(a) * 104, 268 + Math.sin(a) * 104); g.stroke(); }
  g.fillStyle = '#f0c95e';
  g.beginPath(); g.moveTo(150, 440); g.lineTo(256, 404); g.lineTo(362, 440); g.lineTo(362, 520); g.lineTo(256, 486); g.lineTo(150, 520); g.closePath(); g.fill();
  g.fillStyle = '#93292f'; g.fillRect(252, 408, 8, 76);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
// striped stall canopy
const stripeCanvas = (a, b) => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 32, 0, 32, 256); }
  let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(60,40,16,${0.03 + rnd() * 0.04})`; g.fillRect(rnd() * 256, rnd() * 256, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// the showman's rug: bordered pattern bands
const rugCanvas = () => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#8e2323'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#a83232'; g.fillRect(26, 26, 460, 268);
  g.strokeStyle = '#e8bc58'; g.lineWidth = 5; g.strokeRect(26, 26, 460, 268);
  g.strokeStyle = '#274b63'; g.lineWidth = 10; g.strokeRect(52, 52, 408, 216);
  g.fillStyle = '#e8bc58';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const x = 92 + i * 66, y = 88 + j * 48;
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-11, -11, 22, 22); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
// inner wall of the box: dark teak panels + gold pinstripes (interior set)
const innerWallCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#4a2c16'; g.fillRect(0, 0, 512, 512);
  for (let p = 0; p < 4; p++) {
    g.fillStyle = `rgba(${30 + rnd() * 22 | 0},${16 + rnd() * 12 | 0},6,0.25)`; g.fillRect(p * 128, 0, 128, 512);
    g.fillStyle = '#2c1a0a'; g.fillRect(p * 128, 0, 3, 512);
    g.fillStyle = 'rgba(232,188,88,0.5)'; g.fillRect(p * 128 + 6, 0, 1.6, 512);
  }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(20,10,4,${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * 512, rnd() * 512, 2.4, 2.4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const MAT = {
  dirt: toon({ map: dirtCanvas(191), color: '#dbb877' }),
  dirtLight: toon({ map: dirtCanvas(77), color: '#e8cc96' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  leaf: toon({ color: '#3e7a34' }), leafDk: toon({ color: '#2c5c28' }),
  cover: toon({ map: coverCanvas(), color: '#ffffff' }),
  coverPlain: toon({ color: '#7e2630' }),
  pageEdge: toon({ map: pageEdgeCanvas(11), color: '#ffffff' }),
  pageFace: toon({ map: pageFaceCanvas(23), color: '#ffffff', side: THREE.DoubleSide }),
  innerWall: toon({ map: innerWallCanvas(7), color: '#a87c50' }),
  innerDark: toon({ color: '#4a2c16' }),
  ironDk: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.5 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 0.9 }),
  dark: toon({ color: '#33302c' }),
  holeGlow: new THREE.MeshBasicMaterial({ color: 0xffe9b0 }),
  rug: toon({ map: rugCanvas(), color: '#ffffff' }),
  canopyA: toon({ map: stripeCanvas('#c23b2e', '#f2e3c2'), color: '#ffffff' }),
  canopyB: toon({ map: stripeCanvas('#1f7a6a', '#f2e3c2'), color: '#ffffff' }),
  canopyC: toon({ map: stripeCanvas('#274b63', '#e8bc58'), color: '#ffffff' }),
  clothRed: toon({ color: '#a83232' }), clothTeal: toon({ color: '#1f7a6a' }),
  clothOrange: toon({ color: '#d97c26' }), clothPink: toon({ color: '#c25e8e' }),
  paper: toon({ color: '#efe6cc' }),
  clay: toon({ color: '#9a5a34' }),
  bookRed: toon({ color: '#8e2f35' }), bookTeal: toon({ color: '#1f6a5e' }),
  bookBlue: toon({ color: '#2c4a7c' }), bookGold: toon({ color: '#c9962e' }),
};

// ---------- THE FAIRGROUND ----------
// The giant book stands centre at (0,-6) on a low platform, front cover
// toward +z. Stalls flank it, bunting crosses overhead, a ferris wheel
// turns far behind-left, tents and a big tree fill the back. The cutaway
// INTERIOR of the box lives far away at (30,-30) — same construction,
// room enough for the camera: panelled walls, the listening holes in the
// front wall, the boy's corner with his little books.
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  MAT.dirt.map.repeat.set(20, 20);
  const ground = flat(add(new THREE.CircleGeometry(90, 40), MAT.dirt, 0, -0.02, 0, g, { cast: false }));
  ground.scale.set(1.25, 1, 1);
  MAT.dirtLight.map.repeat.set(6, 6);
  flat(add(new THREE.PlaneGeometry(20, 16), MAT.dirtLight, 0, 0.005, -5, g, { cast: false }));
  // the showman's rug in front of the book
  add(tbox(3.6, 0.035, 2.3, 2), MAT.rug, 0, 0.018, -3.8, g, { cast: false });
  // ---- a fair stall (table, posts, striped canopy, goods) ----
  const stall = (x, z, ry, mat, seed) => {
    const sg = new THREE.Group(); sg.position.set(x, 0, z); sg.rotation.y = ry; g.add(sg);
    add(tbox(2.4, 0.07, 1.1, 2), MAT.wood, 0, 0.78, 0, sg, { cast: false });
    for (const [lx, lz] of [[-1.05, -0.42], [1.05, -0.42], [-1.05, 0.42], [1.05, 0.42]])
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.78, 6), MAT.woodDk, lx, 0.39, lz, sg, { cast: false });
    for (const [px, pz] of [[-1.25, -0.55], [1.25, -0.55], [-1.25, 0.55], [1.25, 0.55]])
      add(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), MAT.woodDk, px, 1.25, pz, sg, { cast: false });
    const can = add(tbox(2.9, 0.05, 1.5, 2), mat, 0, 2.56, 0, sg, { cast: false }); can.rotation.z = 0.05;
    let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 5; i++) { const pot = add(new THREE.SphereGeometry(0.13 + rnd() * 0.07, 9, 7), MAT.clay, -0.95 + i * 0.48, 0.9, (rnd() - 0.5) * 0.5, sg, { cast: false }); pot.scale.set(1, 0.82, 1); }
    for (let i = 0; i < 3; i++) add(tbox(0.42, 0.3, 0.42, 2), MAT.wood, -0.7 + i * 0.7, 0.15, 0.75, sg, { cast: false });
    return sg;
  };
  stall(-5.6, -10.5, 0.5, MAT.canopyA, 21);
  stall(5.9, -10, -0.5, MAT.canopyB, 33);
  stall(-10.5, -4.5, 0.95, MAT.canopyC, 47);
  stall(10.8, -3.5, -0.95, MAT.canopyA, 59);
  // ---- tents at the back ----
  const tent = (x, z, mat) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); g.add(tg);
    add(new THREE.CylinderGeometry(1.9, 2.1, 1.9, 12, 1, true), mat, 0, 0.95, 0, tg, { cast: false });
    add(new THREE.ConeGeometry(2.3, 1.7, 12), mat, 0, 2.75, 0, tg, { cast: false });
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), MAT.woodDk, 0, 4.1, 0, tg, { cast: false });
  };
  tent(-13, -20, MAT.canopyB); tent(13.5, -19, MAT.canopyA); tent(4, -24, MAT.canopyC);
  // ---- the big tree, right-back ----
  const trunk = add(new THREE.CylinderGeometry(0.34, 0.52, 3.8, 9), MAT.trunk, 8.2, 1.9, -15, g, { cast: false }); trunk.rotation.z = -0.05;
  for (const [fx, fy, fz, fr, dk] of [[8.0, 5.4, -15.2, 2.6, 0], [6.4, 4.8, -14.6, 1.9, 1], [9.9, 4.9, -15.6, 2.0, 1], [8.2, 6.4, -14.4, 1.8, 0], [7.0, 5.9, -16.4, 1.6, 0]]) {
    const fol = add(new THREE.SphereGeometry(fr, 10, 8), dk ? MAT.leafDk : MAT.leaf, fx, fy, fz, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
  }
  const trunk2 = add(new THREE.CylinderGeometry(0.26, 0.4, 3.2, 9), MAT.trunk, -8.6, 1.6, -17, g, { cast: false });
  for (const [fx, fy, fz, fr, dk] of [[-8.5, 4.6, -17.2, 2.2, 0], [-9.9, 4.1, -16.6, 1.6, 1], [-7.2, 4.2, -17.6, 1.7, 1]]) {
    const fol = add(new THREE.SphereGeometry(fr, 10, 8), dk ? MAT.leafDk : MAT.leaf, fx, fy, fz, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
  }
  // ---- bunting: sagging strings of triangle flags between tall poles ----
  const flagMats = ['#c23b2e', '#1f7a6a', '#d97c26', '#c25e8e', '#c9962e'].map((c) => toon({ color: c, side: THREE.DoubleSide }));
  const bunting = (x0, z0, x1, z1, topY) => {
    add(new THREE.CylinderGeometry(0.05, 0.07, topY, 7), MAT.woodDk, x0, topY / 2, z0, g, { cast: false });
    add(new THREE.CylinderGeometry(0.05, 0.07, topY, 7), MAT.woodDk, x1, topY / 2, z1, g, { cast: false });
    const N = 13;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N, sag = Math.sin(u * Math.PI) * 0.55;
      const px = x0 + (x1 - x0) * u, pz = z0 + (z1 - z0) * u, py = topY - sag;
      const shp = new THREE.Shape(); shp.moveTo(-0.14, 0); shp.lineTo(0.14, 0); shp.lineTo(0, -0.34); shp.closePath();
      const fl = new THREE.Mesh(new THREE.ShapeGeometry(shp), flagMats[i % flagMats.length]);
      fl.position.set(px, py, pz); fl.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      fl.userData.ndSkip = false; g.add(fl);
    }
  };
  bunting(-6.8, -8.6, 6.8, -8.6, 4.6);
  bunting(-6.8, -8.6, -6.8, 0.5, 4.6);
  bunting(6.8, -8.6, 6.8, 0.5, 4.6);
  // ---- scattered stones + grass tufts off the actor paths ----
  let sd2 = 31; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const sx = -14 + rnd2() * 28, sz = -18 + rnd2() * 24;
    if (Math.hypot(sx, sz + 5) < 5.5) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.13, 7, 5), MAT.innerDark, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  for (let i = 0; i < 30; i++) {
    const sx = -14 + rnd2() * 28, sz = -18 + rnd2() * 24;
    if (Math.hypot(sx, sz + 5) < 5) continue;
    const tu = add(new THREE.ConeGeometry(0.09, 0.34 + rnd2() * 0.2, 5), MAT.leafDk, sx, 0.17, sz, g, { cast: false }); tu.rotation.z = (rnd2() - 0.5) * 0.3;
  }
}
// ---------- the ferris wheel (far back-left, turns slowly) ----------
const wheelG = new THREE.Group(); wheelG.position.set(-16, 0, -38); world.add(wheelG);
const wheelSpin = new THREE.Group(); wheelSpin.position.set(0, 7.4, 0); wheelG.add(wheelSpin);
const wheelCabins = [];
{
  add(new THREE.CylinderGeometry(0.16, 0.2, 7.4, 8), MAT.woodDk, -1.8, 3.7, 0, wheelG, { cast: false }).rotation.z = 0.24;
  add(new THREE.CylinderGeometry(0.16, 0.2, 7.4, 8), MAT.woodDk, 1.8, 3.7, 0, wheelG, { cast: false }).rotation.z = -0.24;
  const rim = add(new THREE.TorusGeometry(6, 0.14, 8, 36), MAT.ironDk, 0, 0, 0, wheelSpin, { cast: false });
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2;
    const sp = add(new THREE.CylinderGeometry(0.06, 0.06, 11.6, 6), MAT.woodDk, 0, 0, 0, wheelSpin, { cast: false });
    sp.rotation.z = a + Math.PI / 2; sp.position.set(0, 0, 0);
    sp.geometry.translate(0, 0, 0);
    const cab = new THREE.Group(); cab.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 0); wheelSpin.add(cab);
    add(tbox(0.9, 0.8, 0.7, 2), k % 2 ? MAT.canopyA : MAT.canopyB, 0, -0.75, 0, cab, { cast: false });
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 5), MAT.ironDk, 0, -0.15, 0, cab, { cast: false });
    wheelCabins.push(cab);
  }
  add(new THREE.SphereGeometry(0.34, 10, 8), MAT.brass, 0, 0, 0.2, wheelSpin, { cast: false });
}


// ---------- THE GIANT BOOK (a hollow box in disguise) ----------
// Built from real parts: platform, back board with a hinged DOOR, page
// block with golden edges, an open page face, spine side, side wall with
// listening holes, top board, and the great front cover on its own hinge
// pivot (coverK). The whole group shakes on shakeK (the sneeze).
export const BOOK_POS = [0, 0, -6];
const bookG = new THREE.Group(); bookG.position.set(...BOOK_POS); world.add(bookG);
const coverPivot = new THREE.Group(); coverPivot.position.set(-0.84, 0.14, 0.36); bookG.add(coverPivot);
const doorPivot = new THREE.Group(); doorPivot.position.set(-0.38, 0.14, -0.4); bookG.add(doorPivot);
{
  const g = bookG;
  // low wooden platform the book stands on
  add(tbox(2.3, 0.14, 1.35, 2), MAT.wood, 0, 0.07, 0, g, { cast: false });
  add(tbox(2.5, 0.05, 1.5, 2), MAT.woodDk, 0, 0.025, 0, g, { cast: false });
  // back board, built AROUND the door opening (x -0.38..0.38, y 0.14..1.5)
  add(tbox(0.5, 2.06, 0.07, 2), MAT.coverPlain, -0.63, 1.17, -0.4, g, { cast: false });
  add(tbox(0.5, 2.06, 0.07, 2), MAT.coverPlain, 0.63, 1.17, -0.4, g, { cast: false });
  add(tbox(1.76, 0.7, 0.07, 2), MAT.coverPlain, 0, 1.85, -0.4, g, { cast: false });   // reaches the lid — no light slit above the door
  // gold trim frame on the back
  add(box(1.8, 0.05, 0.03), MAT.brass, 0, 2.16, -0.44, g, { cast: false });
  add(box(1.8, 0.05, 0.03), MAT.brass, 0, 0.18, -0.44, g, { cast: false });
  // the DOOR itself: panel + frame + knob + hinges (opens on doorK)
  add(tbox(0.76, 1.36, 0.055, 2), MAT.wood, 0.38, 0.82, 0, doorPivot, { cast: false });
  add(box(0.6, 0.05, 0.02), MAT.brass, 0.38, 1.42, -0.045, doorPivot, { cast: false });
  add(box(0.6, 0.05, 0.02), MAT.brass, 0.38, 0.24, -0.045, doorPivot, { cast: false });
  const knob = add(new THREE.SphereGeometry(0.05, 10, 8), MAT.brass, 0.68, 0.82, -0.06, doorPivot, { cast: false });
  for (const hy of [0.35, 1.3]) add(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8), MAT.ironDk, -0.36, hy, -0.42, g, { cast: false });
  // page block: golden edges all round (kept forward — the hollow cavity
  // behind it, between block and back board, is where the boy hides)
  add(tbox(1.5, 1.88, 0.4, 2), MAT.pageEdge, 0, 1.12, 0.02, g, { cast: false });
  // the open page face on the front of the block (seen when the cover opens)
  const pf = add(new THREE.PlaneGeometry(1.34, 1.74), MAT.pageFace, 0, 1.12, 0.23, g, { cast: false });
  pf.userData.nd = ndMat;
  // spine (left) + right side wall with the listening holes
  add(tbox(0.09, 2.06, 0.8, 2), MAT.coverPlain, -0.85, 1.17, -0.02, g, { cast: false });
  add(tbox(0.09, 2.06, 0.8, 2), MAT.coverPlain, 0.85, 1.17, -0.02, g, { cast: false });
  for (let i = 0; i < 3; i++) {
    const hole = add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), MAT.dark, 0.9, 1.05 + i * 0.22, -0.02, g, { cast: false });
    hole.rotation.z = Math.PI / 2;
  }
  // top board
  add(tbox(1.79, 0.08, 0.84, 2), MAT.coverPlain, 0, 2.24, -0.02, g, { cast: false });
  add(box(1.84, 0.04, 0.05), MAT.brass, 0, 2.29, 0.4, g, { cast: false });
  // the cavity's front wall (the hollow's dark inside face, behind the boy)
  add(tbox(1.56, 1.94, 0.03, 2), MAT.innerDark, 0, 1.14, -0.17, g, { cast: false });
  // a few of the boy's little books left inside the cavity, low by the door
  add(tbox(0.3, 0.07, 0.22, 2), MAT.bookRed, -0.45, 0.18, -0.3, g, { cast: false }).rotation.y = 0.3;
  add(tbox(0.26, 0.06, 0.2, 2), MAT.bookTeal, -0.43, 0.25, -0.3, g, { cast: false }).rotation.y = 0.1;
  add(tbox(0.28, 0.06, 0.21, 2), MAT.bookBlue, 0.42, 0.18, -0.3, g, { cast: false }).rotation.y = -0.25;
  // THE GREAT COVER on its hinge pivot (opens on coverK)
  const cov = add(tbox(1.66, 2.02, 0.06, 2), MAT.cover, 0.83, 1.03, 0, coverPivot, { cast: false });
  add(box(0.05, 2.02, 0.09), MAT.brass, 0.02, 1.03, 0, coverPivot, { cast: false });
  // the showman's money bowl + low stool on the rug
  const bowl = add(new THREE.CylinderGeometry(0.19, 0.12, 0.1, 12), MAT.brass, 1.15, 0.05, -3.6, world, { cast: false });
  for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 10), MAT.brass, 1.09 + i * 0.065, 0.105, -3.62 + (i % 2) * 0.05, world, { cast: false });
  add(tbox(0.55, 0.09, 0.4, 2), MAT.wood, -1.25, 0.28, -3.7, world, { cast: false });
  for (const [lx, lz] of [[-0.22, -0.14], [0.22, -0.14], [-0.22, 0.14], [0.22, 0.14]])
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 6), MAT.woodDk, -1.25 + lx, 0.12, -3.7 + lz, world, { cast: false });
}
// ---------- THE INTERIOR (cutaway set at (30,-30)) ----------
// Inside the "book": panelled walls, the front wall pierced by listening
// holes (bright discs + light shafts), the boy's reading corner — a mat,
// a stack of little story books, an open book on a stand, his oil lamp.
const INT_POS = [30, 0, -30];
{
  const g = new THREE.Group(); g.position.set(...INT_POS); world.add(g);
  add(tbox(3.6, 0.08, 3.0, 2), MAT.woodDk, 0, 0.04, 0, g, { cast: false });
  // back wall (the inside of the great cover, behind the boy)
  add(tbox(3.6, 2.4, 0.08, 2), MAT.innerWall, 0, 1.2, -1.5, g, { cast: false });
  // side walls
  add(tbox(0.08, 2.4, 3.0, 2), MAT.innerWall, -1.8, 1.2, 0, g, { cast: false });
  add(tbox(0.08, 2.4, 3.0, 2), MAT.pageEdge, 1.8, 1.2, 0, g, { cast: false });
  // ceiling
  add(tbox(3.6, 0.08, 3.0, 2), MAT.innerDark, 0, 2.42, 0, g, { cast: false });
  // front wall (crowd side) with the listening holes: bright discs + rims
  add(tbox(3.6, 2.4, 0.08, 2), MAT.innerWall, 0, 1.2, 1.5, g, { cast: false });
  for (const [hx, hy] of [[-0.5, 1.15], [-0.18, 1.32], [0.14, 1.12], [0.44, 1.3]]) {
    const disc = add(new THREE.CircleGeometry(0.055, 12), MAT.holeGlow, hx, hy, 1.45, g, { cast: false });
    disc.rotation.y = Math.PI; disc.userData.ndSkip = true;
    const rim = add(new THREE.TorusGeometry(0.07, 0.016, 6, 14), MAT.brass, hx, hy, 1.44, g, { cast: false });
  }
  // light shafts from the holes down to the reading corner (additive cones)
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.10, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  for (const [hx, hy] of [[-0.5, 1.15], [-0.18, 1.32], [0.14, 1.12], [0.44, 1.3]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 2.3, 10, 1, true), shaftMat);
    cone.position.set(hx - 0.12, hy - 0.55, 0.72); cone.rotation.x = 0.5; cone.rotation.z = 0.12;
    cone.userData.ndSkip = true; g.add(cone);
  }
  // the boy's mat + book stack + open book on its stand + oil lamp
  add(tbox(1.3, 0.03, 1.1, 2), MAT.rug, -0.35, 0.1, -0.55, g, { cast: false });
  const stack = [[0.42, 0.16, MAT.bookRed, 0.2], [0.38, 0.23, MAT.bookTeal, -0.12], [0.4, 0.3, MAT.bookBlue, 0.32], [0.34, 0.37, MAT.bookGold, 0.05]];
  for (const [w2, y2, m2, r2] of stack) { const bk = add(tbox(w2, 0.065, 0.3, 2), m2, 0.62, y2, -0.95, g, { cast: false }); bk.rotation.y = r2; }
  add(tbox(0.5, 0.05, 0.36, 2), MAT.wood, -0.3, 0.42, -0.28, g, { cast: false }).rotation.x = -0.28;
  const ob = add(new THREE.PlaneGeometry(0.46, 0.32), MAT.pageFace, -0.3, 0.5, -0.24, g, { cast: false });
  ob.rotation.x = -0.62; ob.userData.nd = ndMat;
  // oil lamp: brass base + glass + glow
  add(new THREE.CylinderGeometry(0.09, 0.12, 0.05, 10), MAT.brass, 0.95, 0.11, -0.85, g, { cast: false });
  add(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc36a }), 0.95, 0.2, -0.85, g, { cast: false }).userData.ndSkip = true;
  const lg = softGlow(1.1, '#ffb45e', 0.4); lg.position.set(0.95, 0.24, -0.85); g.add(lg);
}
// ---------- boards ----------
// The hook board: next story's question, standing left of the book. Its
// transform is mirrored in boards.json — keep in sync. Posts stand OUTSIDE
// the panel span (panel half-width 1.95 -> posts at +/-2.08). It fades in
// at the start of the final shot and HOLDS at full opacity to the last frame.
const boardHook = textBoard(['लेकिन कल...', 'वह आदमी जो बादलों', 'को बुला सकता था?'], 3.9, 1.6, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.21, dy: 0.01 });
boardHook.position.set(...BOARD_POS); boardHook.rotation.y = BOARD_RY; world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.6, 'hookK');
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, BOARD_POS[0] - 2.08, 0.62, BOARD_POS[2] - 0.08, world, { cast: false });
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, BOARD_POS[0] + 2.08, 0.62, BOARD_POS[2] - 0.08, world, { cast: false });
// ---------- FX: fair dust motes + gold page sparkles + interior dust ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 2.2, -4.6, { rate: 0.4, color: 0xffe2b0, opacity: 0.08, scale: 0.4, grow: 1.2, life: 3.4, vy: 0.03, wind: 0.06 });
const sparkEmit = smoke.addEmitter(0, 1.3, -5.6, { rate: 0, color: 0xffe9a8, opacity: 0.6, scale: 0.3, grow: 0.7, life: 1.0, vy: 0.5, wind: 0.05 });
const boxDustEmit = smoke.addEmitter(29.9, 1.2, -29.2, { rate: 0, color: 0xffd9a0, opacity: 0.12, scale: 0.3, grow: 1.0, life: 2.6, vy: -0.02, wind: 0.02 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 70, opacity: 0.55, color: 0xffffff, drift: 0.5 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    moteEmit.rate = pr.moteRate * 3;
    sparkEmit.rate = pr.sparkRate * 3; sparkEmit.x = Ws.blastX; sparkEmit.y = Ws.blastY; sparkEmit.z = Ws.blastZ;
    boxDustEmit.rate = (pr.boxDustRate || 0) * 3;
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

// ---------- word-by-word captions (the reference's signature) ----------
// Screen-space overlay rendered AFTER the dof pass: one word at a time,
// bold white with a thick black stroke, centred, baseline ~79% of frame
// height, timed from the char-mapped script words (web/words.js).
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
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.hookK ?? 1; boardHook.visible = (Ws.hookK ?? 1) > 0.01;
  // the great cover swings on its hinge; the back door on its own
  coverPivot.rotation.y = -(0.16 + 0.62 * (Ws.coverK ?? 0));
  doorPivot.rotation.y = 1.9 * (Ws.doorK ?? 0);
  // the sneeze shake: the whole book-box judders on its platform
  const sh = Ws.shakeK ?? 0;
  bookG.rotation.z = sh * 0.022 * Math.sin(f * 2.3);
  bookG.rotation.x = sh * 0.012 * Math.sin(f * 3.1 + 1);
  bookG.position.y = sh * 0.02 * Math.abs(Math.sin(f * 2.3));
  // the ferris wheel turns, cabins hang plumb
  const wa = Ws.wheelA ?? 0;
  wheelSpin.rotation.z = wa;
  wheelCabins.forEach((cab) => { cab.rotation.z = -wa; });
  // interior practicals
  const flick = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  boxLight.intensity = 14 * (Ws.boxK ?? 0) * flick;
  shaftLight.intensity = 260 * (Ws.boxK ?? 0);
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
