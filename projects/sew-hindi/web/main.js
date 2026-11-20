import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, castAt, worldAt, fxAt, fxProfileAt, BOARD_POS, jarStateAt, needleAt } from './story.js';
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

// ---------- painted canvases ----------
const grassCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#4d6d33'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 380; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 8 + rnd() * 40;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(30,48,16,0.35)' : 'rgba(150,180,95,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.08 + rnd() * 0.1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 5200; i++) {
    g.strokeStyle = `rgba(${36 + rnd() * 55 | 0},${80 + rnd() * 55 | 0},${26 + rnd() * 26 | 0},${0.25 + rnd() * 0.3})`;
    g.lineWidth = 1.3;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 5); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const mudCanvas = (seed, base) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 46;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(70,44,20,0.20)' : 'rgba(255,226,170,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(226,192,120,${0.10 + rnd() * 0.14})`; g.lineWidth = 1.4;
    const x = rnd() * 512, y = rnd() * 512, a = rnd() * 3.14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const thatchCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#4a3418'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * 512, y = rnd() * 512, l = 14 + rnd() * 30;
    g.strokeStyle = `rgba(${190 + rnd() * 50 | 0},${140 + rnd() * 40 | 0},${60 + rnd() * 30 | 0},${0.16 + rnd() * 0.2})`;
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + l); g.stroke();
  }
  for (let r = 0; r < 4; r++) { g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(0, r * 128 + 118, 512, 10); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const juteCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#b59a68'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) {
    g.fillStyle = `rgba(90,66,32,${0.10 + rnd() * 0.12})`; g.fillRect(0, i, 256, 1.6);
    g.fillStyle = `rgba(240,220,170,${0.08 + rnd() * 0.1})`; g.fillRect(i, 0, 1.6, 256);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(70,50,22,0.12)' : 'rgba(250,235,190,0.1)'; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// the wedding dress: deep red silk, gold-and-pink floral embroidery
const dressCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#7e1f2e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 200; i++) { // silk sheen blotches
    const x = rnd() * 512, y = rnd() * 512, r = 14 + rnd() * 50;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(50,8,16,0.25)' : 'rgba(255,120,130,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const flower = (x, y, s, col) => {
    g.fillStyle = col;
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.62, s * 0.5, 0, 7); g.fill(); }
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(x, y, s * 0.34, 0, 7); g.fill();
    g.fillStyle = '#3d7d3a'; g.beginPath(); g.ellipse(x + s * 1.15, y + s * 0.7, s * 0.55, s * 0.22, 0.7, 0, 7); g.fill();
  };
  for (let ry = 0; ry < 4; ry++) for (let rx2 = 0; rx2 < 4; rx2++) {
    flower(64 + rx2 * 128 + (ry % 2) * 34, 64 + ry * 128, 15 + rnd() * 5, ['#e8b93c', '#e88bb0', '#f0d060'][((rx2 + ry) % 3)]);
  }
  g.fillStyle = '#e8b93c'; g.fillRect(0, 0, 512, 14); g.fillRect(0, 498, 512, 14); g.fillRect(0, 0, 14, 512); g.fillRect(498, 0, 14, 512);
  g.fillStyle = '#f4e3b2'; g.fillRect(0, 20, 512, 4); g.fillRect(0, 488, 512, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const MAT = {
  grass: toon({ map: grassCanvas(191), color: '#7d9a68' }),
  mud: toon({ map: mudCanvas(5, '#a97e4e'), color: '#b28a58' }),
  mudDk: toon({ map: mudCanvas(6, '#8a6538'), color: '#a37c4e' }),
  floorIn: toon({ map: mudCanvas(9, '#7d5a34'), color: '#8f6c42' }),
  plaster: toon({ map: mudCanvas(7, '#9a7a52'), color: '#a8875e' }),
  plasterIn: toon({ map: mudCanvas(8, '#8a6a44'), color: '#96754c' }),
  path: toon({ map: mudCanvas(31, '#9a7a4a'), color: '#b08e5c' }),
  thatch: toon({ map: thatchCanvas(3), color: '#a8843e' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plank: texM(M4.woodV4(11), 1, 1, '#9a7c58'), plankDk: texM(M4.woodV4(13), 1, 1, '#7d6244'),
  leaf: toon({ color: '#46683c' }), leafDk: toon({ color: '#334f2e' }),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  stone: toon({ color: '#7d8a80' }), stoneDk: toon({ color: '#5d6a62' }),
  dark: toon({ color: '#33302c' }),
  rope: toon({ color: '#7d6242' }),
  jute: toon({ map: juteCanvas(17), color: '#c8ab76' }),
  dress: toon({ map: dressCanvas(23), color: '#e8c8c8' }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.32, envMap, envMapIntensity: 1.1 }),
  iron: toon({ color: '#2e2a26' }),
  steel: new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.95, roughness: 0.25, envMap, envMapIntensity: 1.3 }),
  clay: toon({ color: '#9a5f3d' }), clayDk: toon({ color: '#7c4a2e' }),
  clothRed: toon({ color: '#b3392e' }), clothBlue: toon({ color: '#2f5d8a' }), clothGold: toon({ color: '#d9a441' }), clothGreen: toon({ color: '#3f7d5a' }),
  glass: new THREE.MeshStandardMaterial({ color: 0xd8ecd8, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0, envMap, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }),
};

// ---------- THE SET: Munni's hut + courtyard + lane ----------
// Interior z -3.2..1.2 (floor), window in the BACK wall (x -2.15..
// -1.05, y 0.95..2.0), door in the EAST wall (gap z -0.05..1.0).
// The south side is open (veranda) — interior cameras live there.
// Courtyard to the south, tailor's stall east, neem tree west.
const world = new THREE.Group(); scene.add(world);
let doorPanel, jarG, jarFlies, jarGlow, jarHalo, jarLight, leakSlit, coverCloth, needleG, needleGlint, threadLine, rowGlows = [], miniJarB, miniJarG;
const JAR_FLOOR = { x: 0.95, z: -1.15 }, COVER_LAND = { x: 0.42, z: -0.72 };
{
  const g = world;
  // ---- ground: courtyard dirt with grass at the edges
  MAT.mud.map.repeat.set(16, 16);
  flat(add(new THREE.PlaneGeometry(170, 170), MAT.mud, 0, -0.04, 8, g, { cast: false }));
  MAT.grass.map.repeat.set(20, 20);
  const gr1 = flat(add(new THREE.PlaneGeometry(170, 60), MAT.grass, 0, -0.06, 62, g, { cast: false }));
  const gr2 = flat(add(new THREE.PlaneGeometry(60, 170), MAT.grass, -52, -0.06, 0, g, { cast: false }));
  const gr3 = flat(add(new THREE.PlaneGeometry(60, 170), MAT.grass, 52, -0.06, 0, g, { cast: false }));
  // interior floor (darker packed earth) + the lane path south
  MAT.floorIn.map.repeat.set(3, 2);
  flat(add(new THREE.PlaneGeometry(6.9, 4.5), MAT.floorIn, 0, 0.002, -1.0, g, { cast: false }));
  MAT.path.map.repeat.set(1.5, 8);
  flat(add(new THREE.PlaneGeometry(3.2, 15), MAT.path, 0.6, 0.004, 8.6, g, { cast: false }));
  // Munni's woven mat
  const mat1 = flat(add(new THREE.PlaneGeometry(1.5, 1.5), MAT.jute, 0.35, 0.012, -1.45, g, { cast: false }));
  // ---- hut walls (plaster), thickness 0.18, height 2.6
  const wall = (w, h, d, x, y, z, m = MAT.plaster) => add(tbox(w, h, d, 2), m, x, y, z, g, { cast: false });
  wall(1.25, 2.6, 0.18, -2.775, 1.3, -3.29);            // back wall L of window
  wall(4.45, 2.6, 0.18, 1.175, 1.3, -3.29);             // back wall R of window
  wall(1.1, 0.6, 0.18, -1.6, 2.3, -3.29);               // window lintel
  wall(1.1, 0.95, 0.18, -1.6, 0.475, -3.29);            // window sill
  wall(0.18, 2.6, 4.4, -3.49, 1.3, -1.0);               // west wall
  wall(0.18, 2.6, 3.15, 3.49, 1.3, -1.625);             // east wall S of door
  wall(0.18, 2.6, 0.2, 3.49, 1.3, 1.1);                 // east wall N sliver
  wall(0.18, 0.5, 1.05, 3.49, 2.35, 0.475);             // door lintel
  // window frame + bars
  add(box(1.16, 0.07, 0.24), MAT.woodDk, -1.6, 2.02, -3.29, g, { cast: false });
  add(box(1.16, 0.07, 0.24), MAT.woodDk, -1.6, 0.93, -3.29, g, { cast: false });
  add(box(0.07, 1.16, 0.24), MAT.woodDk, -2.17, 1.47, -3.29, g, { cast: false });
  add(box(0.07, 1.16, 0.24), MAT.woodDk, -1.03, 1.47, -3.29, g, { cast: false });
  add(box(0.045, 1.05, 0.1), MAT.woodDk, -1.6, 1.47, -3.29, g, { cast: false });
  // ---- roof: two thatch slabs, ridge along x at z=-1.0
  const rN = add(tbox(7.6, 0.12, 3.1, 2), MAT.thatch, 0, 3.15, -2.35, g, { cast: false }); rN.rotation.x = 0.42;
  const rS = add(tbox(7.6, 0.12, 3.1, 2), MAT.thatch, 0, 3.15, 0.35, g, { cast: false }); rS.rotation.x = -0.42;
  add(tbox(7.6, 0.14, 0.2, 2), MAT.woodDk, 0, 3.62, -1.0, g, { cast: false }); // ridge beam
  // ---- the door panel, hinged at the south jamb (z=1.0)
  const dg = new THREE.Group(); dg.position.set(3.49, 0, 1.0); g.add(dg);
  doorPanel = add(tbox(0.06, 2.05, 1.02, 2), MAT.wood, 0, 1.03, -0.51, dg, { cast: false });
  add(box(0.09, 0.09, 0.3), MAT.iron, -0.05, 1.05, -0.85, dg, { cast: false }); // handle
  doorPanel.userData.doorGroup = dg;
  // ---- interior props: charpai cot, clay pots, stool, basket
  const cot = new THREE.Group(); cot.position.set(-2.6, 0, -1.7); cot.rotation.y = Math.PI / 2; g.add(cot);
  add(tbox(1.9, 0.09, 0.8, 2), MAT.jute, 0, 0.42, 0, cot, { cast: false });
  for (const [lx, lz] of [[-0.85, -0.32], [0.85, -0.32], [-0.85, 0.32], [0.85, 0.32]]) add(box(0.07, 0.42, 0.07), MAT.woodDk, lx, 0.21, lz, cot, { cast: false });
  add(tbox(1.9, 0.3, 0.06, 2), MAT.woodDk, 0, 0.55, -0.4, cot, { cast: false });
  const pot = (x, z, s, m) => { const p = add(new THREE.SphereGeometry(0.24 * s, 10, 8), m, x, 0.2 * s, z, g, { cast: false }); p.scale.set(1, 1.05, 1); add(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.1 * s, 9), m, x, 0.44 * s, z, g, { cast: false }); };
  pot(2.85, -2.75, 1.15, MAT.clay); pot(2.4, -2.9, 0.85, MAT.clayDk); pot(-3.0, -2.85, 0.95, MAT.clay);
  add(tbox(0.5, 0.35, 0.5, 2), MAT.woodDk, -2.9, 0.18, 0.6, g, { cast: false }); // stool/crate
  const basket = add(new THREE.CylinderGeometry(0.26, 0.2, 0.3, 10, 1, true), MAT.jute, 1.9, 0.15, -2.8, g, { cast: false });
  // hanging bundle from the ridge beam
  const bundle = add(new THREE.SphereGeometry(0.17, 8, 7), MAT.clothGold, -1.2, 2.75, -1.0, g, { cast: false }); bundle.scale.set(1, 1.25, 1);
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5), MAT.rope, -1.2, 3.1, -1.0, g, { cast: false });
  // ---- the wedding dress on her lap + needle + thread
  const dress = add(box(0.68, 0.05, 0.55), MAT.dress, 0.35, 0.31, -1.16, g, { cast: false }); dress.rotation.x = -0.38;
  needleG = new THREE.Group(); needleG.position.set(0.34, 0.40, -1.05); g.add(needleG);
  const ndl = add(new THREE.CylinderGeometry(0.006, 0.0015, 0.11, 6), MAT.steel, 0, 0, 0, needleG, { cast: false });
  ndl.rotation.z = 0.5; ndl.rotation.x = -0.4;
  const glintTex = P.tex(P.radial('255,244,200', 0.9));
  needleGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  needleGlint.scale.set(0.16, 0.16, 1); needleGlint.position.set(0.03, 0.05, 0.01); needleGlint.userData.ndSkip = true; needleG.add(needleGlint);
  const threadGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  threadLine = new THREE.Line(threadGeo, new THREE.LineBasicMaterial({ color: 0xe8e0c8, transparent: true, opacity: 0.9 }));
  threadLine.userData.ndSkip = true; g.add(threadLine);
  // ---- THE FIREFLY JAR (hero prop): glass, cork, living lights
  jarG = new THREE.Group(); g.add(jarG);
  const glass = add(new THREE.CylinderGeometry(0.105, 0.115, 0.24, 18, 1, true), MAT.glass, 0, 0.12, 0, jarG, { cast: false });
  glass.renderOrder = 3;
  add(new THREE.CylinderGeometry(0.115, 0.115, 0.015, 18), MAT.glass, 0, 0.008, 0, jarG, { cast: false }).renderOrder = 3;
  add(new THREE.TorusGeometry(0.1, 0.012, 8, 20), MAT.glass, 0, 0.24, 0, jarG, { cast: false }).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.072, 0.078, 0.05, 12), MAT.wood, 0, 0.265, 0, jarG, { cast: false }); // cork
  const flyGeo = new THREE.BufferGeometry();
  {
    const pts = []; let sd = 99; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.082; pts.push(Math.cos(a) * r, 0.03 + rnd() * 0.17, Math.sin(a) * r); }
    flyGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const glowTex = P.tex(P.radial('190,255,140', 0.85));
  jarFlies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: 0xd9ff9e, size: 0.045, map: glowTex, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  jarFlies.userData.ndSkip = true; jarFlies.renderOrder = 4; jarG.add(jarFlies);
  jarGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  jarGlow.scale.set(0.85, 0.85, 1); jarGlow.position.set(0, 0.14, 0); jarGlow.userData.ndSkip = true; jarGlow.renderOrder = 5; jarG.add(jarGlow);
  jarHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  jarHalo.scale.set(1.9, 1.9, 1); jarHalo.position.set(0, 0.2, 0); jarHalo.userData.ndSkip = true; jarHalo.renderOrder = 5; jarG.add(jarHalo);
  leakSlit = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  leakSlit.scale.set(0.55, 0.09, 1); leakSlit.position.set(0, 0.03, 0.1); leakSlit.userData.ndSkip = true; leakSlit.renderOrder = 5; jarG.add(leakSlit);
  jarLight = new THREE.PointLight(0xaee86a, 0, 7, 1.6); jarLight.position.set(0, 0.3, 0); jarG.add(jarLight);
  // ---- the cover cloth (flies off at the lift, lands crumpled)
  coverCloth = add(new THREE.SphereGeometry(0.23, 12, 9), MAT.clothRed, JAR_FLOOR.x, 0.12, JAR_FLOOR.z, g, { cast: true });
  { // crumple: jittered verts + flat shading so it reads as cloth, not a pot
    const pa = coverCloth.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const n = Math.sin(i * 12.9898) * 43758.5453, r = n - Math.floor(n), n2 = Math.sin(i * 78.233) * 12543.21, r2 = n2 - Math.floor(n2);
      pa.setXYZ(i, pa.getX(i) * (1 + (r - 0.5) * 0.16), pa.getY(i) * (1 + (r2 - 0.5) * 0.13), pa.getZ(i) * (1 + (r2 - 0.5) * 0.16));
    }
    coverCloth.geometry.computeVertexNormals();
    coverCloth.material = MAT.clothRed.clone(); coverCloth.material.flatShading = true;
  }
  coverCloth.scale.set(1, 0.78, 1);
  // ---- courtyard: jars row on a plank (finale), fence, stall, trees
  add(tbox(3.6, 0.07, 0.4, 2), MAT.plankDk, 0, 0.05, 1.78, g, { cast: false });
  const rowTex = P.tex(P.radial('190,255,140', 0.85));
  for (let i = 0; i < 5; i++) {
    const jx = -1.5 + i * 0.75;
    add(new THREE.CylinderGeometry(0.07, 0.075, 0.16, 12, 1, true), MAT.glass, jx, 0.17, 1.78, g, { cast: false }).renderOrder = 3;
    add(new THREE.CylinderGeometry(0.05, 0.055, 0.035, 10), MAT.wood, jx, 0.27, 1.78, g, { cast: false });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: rowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    spr.scale.set(0.5, 0.5, 1); spr.position.set(jx, 0.18, 1.78); spr.userData.ndSkip = true; spr.renderOrder = 5; g.add(spr); rowGlows.push(spr);
  }
  // mini jars carried in the teach shot (Bhola + girlA)
  const mkMiniJar = () => {
    const mg = new THREE.Group(); g.add(mg);
    add(new THREE.CylinderGeometry(0.07, 0.075, 0.16, 12, 1, true), MAT.glass, 0, 0, 0, mg, { cast: false }).renderOrder = 3;
    add(new THREE.CylinderGeometry(0.05, 0.055, 0.035, 10), MAT.wood, 0, 0.1, 0, mg, { cast: false });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: rowTex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    spr.scale.set(0.45, 0.45, 1); spr.userData.ndSkip = true; spr.renderOrder = 5; mg.add(spr);
    mg.visible = false; return mg;
  };
  miniJarB = mkMiniJar(); miniJarG = mkMiniJar();
  // low mud fence along the lane, with a gap at the path
  const fence = (x0, x1, z) => { const len = x1 - x0; add(tbox(len, 0.55, 0.25, 2), MAT.mudDk, (x0 + x1) / 2, 0.27, z, g, { cast: false }); };
  fence(-9, -1.2, 9.5); fence(2.4, 9, 9.5);
  // tailor's stall (Bhola's father's): crate, pole, hanging cloths
  add(tbox(1.1, 0.55, 1.1, 2), MAT.woodDk, 4.35, 0.28, 5.2, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 7), MAT.woodDk, 3.85, 1.25, 4.7, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 7), MAT.woodDk, 4.9, 1.25, 4.7, g, { cast: false });
  const beam = add(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 7), MAT.woodDk, 4.37, 2.45, 4.7, g, { cast: false }); beam.rotation.z = Math.PI / 2;
  const hang = (x, m, w = 0.42) => { const h = add(new THREE.PlaneGeometry(w, 0.85), m, x, 2.0, 4.7, g, { cast: false }); h.material = m; };
  hang(4.05, MAT.clothBlue); hang(4.4, MAT.clothGold); hang(4.72, MAT.clothGreen);
  for (let i = 0; i < 3; i++) { const roll = add(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 9), [MAT.clothRed, MAT.clothBlue, MAT.clothGold][i], 4.1 + i * 0.28, 0.62, 5.2, g, { cast: false }); roll.rotation.z = Math.PI / 2; roll.rotation.y = 0.3; }
  // ---- trees
  const tree = (x, z, s = 1) => {
    const trunk = add(new THREE.CylinderGeometry(0.3 * s, 0.48 * s, 3.4 * s, 9), MAT.trunk, x, 1.7 * s, z, g, { cast: false }); trunk.rotation.z = 0.05;
    for (const [bx, by, bz, rz, ln] of [[0.6, 3.9, 0.2, -0.7, 1.6], [-0.7, 4.0, -0.3, 0.8, 1.5], [0.1, 4.1, 0.9, 0.2, 1.3]]) {
      const br = add(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, ln * s, 6), MAT.trunk, x + bx * s, by * s, z + bz * s, g, { cast: false }); br.rotation.z = rz;
    }
    for (const [fx, fy, fz, fr, dk] of [[0.2, 4.9, -0.1, 2.3, 0], [-1.4, 4.4, 0.3, 1.7, 1], [1.7, 4.5, -0.4, 1.8, 1], [0, 5.6, 0.8, 1.6, 0], [-0.9, 5.2, -1.1, 1.5, 0]]) {
      const fol = add(new THREE.SphereGeometry(fr * s, 10, 8), dk ? MAT.leafDk : MAT.leaf, x + fx * s, fy * s, z + fz * s, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
    }
  };
  tree(-4.5, 3.5, 1.1); tree(8.5, -1.5, 0.95); tree(-8, -6, 1.0); tree(11, 8, 1.05);
  // distant neighbour huts (depth silhouettes)
  const farHut = (x, z, ry, s = 1) => {
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; hg.scale.setScalar(s); g.add(hg);
    add(tbox(4.2, 2.9, 3.4, 2), MAT.mudDk, 0, 1.45, 0, hg, { cast: false });
    const r1 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, -1.15, 3.35, 0, hg, { cast: false }); r1.rotation.z = 0.5;
    const r2 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, 1.15, 3.35, 0, hg, { cast: false }); r2.rotation.z = -0.5;
  };
  farHut(-9.5, 13, 0.5, 0.95); farHut(10.5, 14, -0.4, 0.9); farHut(-13, 2, 0.9, 0.85);
  // scattered stones
  let sd2 = 47; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const sx = -16 + rnd2() * 32, sz = -8 + rnd2() * 24;
    if (Math.abs(sx) < 3.6 && sz > -4 && sz < 3) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.15, 7, 5), MAT.stoneDk, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
}
// The hook board: next story's question, standing at the veranda
// edge facing south (toward the courtyard and the camera). Its
// transform is mirrored in boards.json — keep in sync. Painted in
// the proven safe regime for Devanagari conjuncts (fsMul 0.8 ->
// fs ~51 px, measured). It rises at the final shot and HOLDS at
// full opacity to the literal final frame.
const boardHook = textBoard(['लेकिन कल...', 'वह लड़का जो आँख बंद करके', 'निशाना मार देता था?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.22, dy: 0.032, fsMul: 0.8 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.6, 0.09, 2), MAT.woodDk, -0.75, 1.0, 1.47, world, { cast: false });
add(tbox(0.09, 2.6, 0.09, 2), MAT.woodDk, 0.95, 1.0, 1.47, world, { cast: false });

// ---------- FX: night dust motes, drifting clouds, wild fireflies ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteOpts = { color: 0xcfd8ea, opacity: 0.05, scale: 0.5, grow: 1.1, life: 5.5, vy: 0.03, wind: 0.05, vx: 0.02 };
const moteEmitters = [
  smoke.addEmitter(0.4, 0.6, -1.4, { ...moteOpts }),           // interior dust in the moon shaft
  smoke.addEmitter(0, 0.8, 4.5, { ...moteOpts, scale: 0.7 }),   // courtyard dust
];
const fxClouds = new FX.Clouds(scene, { count: 6, y: 58, opacity: 0.16, color: 0x8a97b0, drift: 0.3 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) m.userData.baseOp = m.material.opacity; }); });
// wild fireflies wandering the courtyard dark (not the jar's)
const wildFlies = (() => {
  const geo = new THREE.BufferGeometry();
  const pts = []; let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const bases = [];
  for (let i = 0; i < 14; i++) { const bx = -6 + rnd() * 12, by = 0.4 + rnd() * 1.1, bz = 2 + rnd() * 7; bases.push([bx, by, bz]); pts.push(bx, by, bz); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfff8e, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  p.userData.ndSkip = true; p.renderOrder = 4; p.userData.bases = bases; scene.add(p); return p;
})();
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30;
    const pr = fxProfileAt(fxF);
    for (const e of moteEmitters) e.rate = (pr.moteRate || 0) * 2.2;
    smoke.update(t, dt); fxClouds.update(t, dt);
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
  const t = f / 30;
  skyU.time.value = t;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.hookK ?? 1; boardHook.visible = (Ws.hookK ?? 1) > 0.01;
  // ---- the door swings in as Bhola bursts through (f946-964)
  doorPanel.userData.doorGroup.rotation.y = -(Ws.doorK ?? 0) * 1.9;
  // ---- THE JAR: position from story; glow = brightest at source
  const js = jarStateAt(f), jk = Ws.jarK ?? 0.2, cov = Ws.coverOn ?? 1, burst = Ws.burstK ?? 0;
  jarG.position.set(js.x, js.y, js.z);
  jarFlies.material.opacity = (0.06 + 0.94 * jk) * (0.82 + 0.18 * Math.sin(t * 11));
  jarFlies.material.size = 0.06 + 0.012 * Math.sin(t * 7.3);
  jarFlies.rotation.y = t * 0.4;
  jarGlow.material.opacity = jk * (cov > 0.5 ? 0.08 : 0.38) * (1 + burst * 0.9);
  jarHalo.material.opacity = jk * 0.1 * (1 - cov * 0.7) * (1 + burst * 0.7);
  leakSlit.material.opacity = cov > 0.5 ? jk * (0.5 + 0.3 * Math.sin(t * 5.2)) : 0; // the leak breathes
  jarLight.intensity = jk * (1 - cov * 0.78) * 3.6;
  // ---- the cover cloth: on the jar, then ripped off in one jerk
  const p = 1 - cov;
  if (p <= 0) { coverCloth.position.set(JAR_FLOOR.x, 0.12, JAR_FLOOR.z); coverCloth.rotation.set(0, 0, 0); coverCloth.scale.set(1, 0.78, 1); }
  else {
    const e = 1 - Math.pow(1 - p, 2);
    coverCloth.position.set(JAR_FLOOR.x + (COVER_LAND.x - JAR_FLOOR.x) * e, 0.12 + Math.sin(p * Math.PI) * 0.55 - p * 0.08, JAR_FLOOR.z + (COVER_LAND.z - JAR_FLOOR.z) * e);
    coverCloth.rotation.set(p * 0.7, 0, p * 2.2);
    coverCloth.scale.set(1, 0.78 - 0.34 * p, 1);
  }
  // ---- needle + thread: stitch rhythm, frozen dead at L14
  const nd = needleAt(f);
  needleG.position.y = 0.40 + nd.bob * 0.05;
  needleGlint.material.opacity = nd.glint * 0.95;
  const tp = threadLine.geometry.attributes.position;
  tp.setXYZ(0, 0.36, 0.445, -1.02); tp.setXYZ(1, 0.37, 0.40 - nd.bob * 0.02, -1.08); tp.setXYZ(2, 0.38, 0.375, -1.13);
  tp.needsUpdate = true;
  // ---- finale jars glow as the girls fill them; carried minis
  for (const spr of rowGlows) spr.material.opacity = (Ws.dawnK ?? 0) * 0.55;
  const teach = shotAt(f).id === 'teach';
  const placeMini = (grp, who) => {
    if (!teach) { grp.visible = false; return; }
    const a = castAt(f).find((c) => c.id === who);
    if (!a) { grp.visible = false; return; }
    const dx = camera.position.x - a.x, dz = camera.position.z - a.z, dl = Math.hypot(dx, dz) || 1;
    grp.visible = true;
    grp.position.set(a.x + dx / dl * 0.3, (a.ground ?? 0) + 0.72 * (who === 'bhola' ? 0.84 : 0.8), a.z + dz / dl * 0.3);
  };
  placeMini(miniJarB, 'bhola'); placeMini(miniJarG, 'girlA');
  // ---- wild fireflies drift on slow sine fields, gone by dawn
  {
    const pos = wildFlies.geometry.attributes.position, bases = wildFlies.userData.bases;
    for (let i = 0; i < bases.length; i++) {
      pos.setXYZ(i, bases[i][0] + Math.sin(t * 0.31 + i * 1.7) * 0.55, bases[i][1] + Math.sin(t * 0.47 + i * 2.3) * 0.16, bases[i][2] + Math.cos(t * 0.26 + i) * 0.5);
    }
    pos.needsUpdate = true;
    wildFlies.material.opacity = (1 - (Ws.dawnK ?? 0)) * (0.32 + 0.2 * Math.sin(t * 2.1));
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
    if (a.blob !== false && (a.y - (a.ground ?? 0)) < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
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
