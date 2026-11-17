import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, PLATFORM, SHELTER, BENCH, trainXAt } from './story.js';

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
const srnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

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

// ---------- materials ----------
const grainCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d9a441'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,240,190,${0.25 + Math.random() * 0.4})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
  for (let i = 0; i < 200; i++) { g.fillStyle = '#8a5a14'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const eyeCanvas = (() => {
  // one peacock tail feather: teal-green vane + the staring eye
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, '#1d7a5a'); gr.addColorStop(0.5, '#2fae7e'); gr.addColorStop(1, '#1d7a5a');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(20,90,60,${0.2 + Math.random() * 0.25})`; g.lineWidth = 1; const x = 10 + Math.random() * 108; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 8, 256); g.stroke(); }
  const eye = (cx, cy, r) => {
    g.fillStyle = '#c9a13a'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = '#1d5fa8'; g.beginPath(); g.arc(cx, cy, r * 0.62, 0, 7); g.fill();
    g.fillStyle = '#123a5e'; g.beginPath(); g.arc(cx, cy, r * 0.34, 0, 7); g.fill();
    g.fillStyle = '#e8f4ff'; g.beginPath(); g.arc(cx - r * 0.12, cy - r * 0.14, r * 0.1, 0, 7); g.fill();
  };
  eye(64, 52, 30);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MAT = {
  grass: texM(M4.groundDetail(P.grass(11, 9), 191, { dots: 1200 }), 14, 14, '#7a9a4a'),
  ballast: texM(M4.stoneV4(12), 8, 2, '#8a8378'),
  sleeper: texM(M4.woodV4(7), 1, 1, '#6a4a2e'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  leaf: toon({ color: '#3f7a2e' }), leafDk: toon({ color: '#2c5a22' }), trunk: toon({ color: '#6a4a2e' }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.32, metalness: 0.9, envMap, envMapIntensity: 1.2 }),
  blackMetal: new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.5, metalness: 0.6, envMap, envMapIntensity: 0.9 }),
  locoRed: new THREE.MeshStandardMaterial({ map: P.tex(M4.carPaintV4('#8a2432', 5)), roughness: 0.38, metalness: 0.45, envMap, envMapIntensity: 1.1 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.3, metalness: 0.9, envMap, envMapIntensity: 1.4 }),
  glass: M4.glassMatV4(envMap, 0.55),
  grain: toon({ map: grainCanvas }),
  peacockBlue: toon({ color: '#1f5fa8' }), peacockGreen: toon({ color: '#1d7a5a' }),
  feather: new THREE.MeshToonMaterial({ gradientMap: grad, map: eyeCanvas, side: THREE.DoubleSide }),
  beak: toon({ color: '#3a2a1c' }), dark: toon({ color: '#33302c' }),
  white: toon({ color: '#f7f3e6' }), cream: toon({ color: '#e8dcc0' }),
};

// ---------- the jungle railway station ----------
const world = new THREE.Group(); scene.add(world);
const foliage = [];   // swaying tree crowns (gusts, never a uniform wave)
const buildTree = (x, z, s, seed) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); world.add(g);
  add(new THREE.CylinderGeometry(0.22, 0.34, 2.6, 8), MAT.trunk, 0, 1.3, 0, g, { cast: false });
  const crown = new THREE.Group(); crown.position.y = 3.1; g.add(crown);
  const c1 = add(new THREE.SphereGeometry(1.5, 12, 9), MAT.leaf, 0, 0.4, 0, crown, { cast: false }); c1.scale.y = 0.85;
  const c2 = add(new THREE.SphereGeometry(1.0, 10, 8), MAT.leafDk, 0.9, -0.1, 0.4, crown, { cast: false });
  const c3 = add(new THREE.SphereGeometry(0.85, 10, 8), MAT.leaf, -0.85, 0.1, -0.3, crown, { cast: false });
  crown.userData.phase = seed; foliage.push(crown);
  return g;
};
{
  const g = world;
  const ground = flat(add(new THREE.CircleGeometry(42, 48), MAT.grass, 0, 0, 2, g, { cast: false }));
  ground.scale.set(1.15, 1, 1);
  // ballast bed + sleepers + rails (the track runs along X at z=0)
  add(tbox(64, 0.12, 2.6, 4), MAT.ballast, 0, 0.06, 0, g, { cast: false });
  for (let x = -31; x <= 31; x += 1.5) add(tbox(0.26, 0.07, 2.0, 1), MAT.sleeper, x, 0.15, 0, g, { cast: false });
  for (const rz of [-0.75, 0.75]) add(tbox(64, 0.1, 0.13, 4), MAT.steel, 0, 0.24, rz, g, { cast: false });
  // the platform (top = story PLATFORM.top): stone slab + edge
  add(tbox(24, PLATFORM.top, 3.2, 4), MAT.stone, PLATFORM.x, PLATFORM.top / 2, PLATFORM.z, g, { cast: false });
  add(tbox(24, 0.06, 3.24, 4), MAT.stoneDk, PLATFORM.x, PLATFORM.top + 0.01, PLATFORM.z, g, { cast: false });
  add(tbox(24, 0.02, 0.28, 2), toon({ color: '#e8c33a' }), PLATFORM.x, PLATFORM.top + 0.05, 2.32, g, { cast: false }); // safety line
  // shelter (west end): posts + slanted roof + back panel
  const sh = new THREE.Group(); sh.position.set(SHELTER.x, 0, SHELTER.z); g.add(sh);
  for (const [lx, lz] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]])
    add(new THREE.CylinderGeometry(0.06, 0.07, 2.4, 7), MAT.woodDk, lx, 1.2, lz, sh, { cast: false });
  const roof = add(tbox(3.6, 0.09, 2.2, 2), MAT.woodDk, 0, 2.5, 0, sh, { cast: false }); roof.rotation.x = 0.08;
  add(tbox(3.2, 1.1, 0.08, 2), MAT.wood, 0, 1.7, -0.85, sh, { cast: false });
  // bench (east end)
  add(tbox(1.8, 0.09, 0.55, 2), MAT.wood, BENCH.x, 0.5 + PLATFORM.top, BENCH.z, g, { cast: false });
  add(tbox(1.8, 0.55, 0.08, 2), MAT.wood, BENCH.x, 0.85 + PLATFORM.top, BENCH.z + 0.26, g, { cast: false });
  for (const lx of [-0.8, 0.8]) add(tbox(0.09, 0.5, 0.5, 1), MAT.woodDk, BENCH.x + lx, 0.25 + PLATFORM.top, BENCH.z, g, { cast: false });
  // station sign: "JUNGLE HALT" on a post at the platform's WEST end
  // (kept clear of the peacock's track position so nothing occludes it)
  add(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 7), MAT.woodDk, -9.5, 1.1 + PLATFORM.top, 4.9, g, { cast: false });
  const sign = textBoard([' JUNGLE ', ' HALT '], 1.6, 0.9, '#1e3d24', '#ffe9a8');
  sign.position.set(-9.5, 2.0 + PLATFORM.top, 4.9); world.add(sign); addBoardOccluder(sign, 1.6, 0.9, 'always');
  // jungle: trees north + south, bushes near the track
  for (const [x, z, s, sd] of [[-11, -9, 1.2, 3], [-6, -11, 1.5, 7], [3, -10, 1.3, 11], [9, -9, 1.1, 15], [13, -11, 1.4, 19], [-13, 11.5, 1.3, 23], [-7, 12.5, 1.5, 27], [12, 14, 1.2, 31], [14, 11, 1.1, 39]]) buildTree(x, z, s, sd);
  for (const [bx, bz] of [[-6, -4.5], [6, -4.8], [-11, -5], [11, -5.2]]) {
    const b = add(new THREE.SphereGeometry(0.62, 10, 8), MAT.leafDk, bx, 0.42, bz, g, { cast: false }); b.scale.y = 0.75;
  }
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ---------- THE TRAIN (hero prop, built from real parts) ----------
// Loco local coords: front at x=0, boiler to -3.4, cab -3.4..-5.6, wagon
// -6.0..-10.4 (open-top goods wagon with a grain heap). The group rides
// story trainX; wheels spin from trainDist. The driver stands on the cab
// footplate (top y 0.9) at local x -5.2, z +1.3, outside the cab wall.
const trainG = new THREE.Group(); world.add(trainG);
const wheels = [];
const makeWheel = (x, z) => {
  const wg = new THREE.Group(); wg.position.set(x, 0.45, z); trainG.add(wg);
  const w = add(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 18), MAT.blackMetal, 0, 0, 0, wg);
  w.rotation.x = Math.PI / 2;
  add(tbox(0.7, 0.09, 0.16, 1), MAT.steel, 0, 0, 0, wg, { cast: false });
  wheels.push(wg); return wg;
};
{
  const boiler = add(new THREE.CylinderGeometry(0.75, 0.75, 3.4, 20), MAT.blackMetal, -1.7, 1.6, 0, trainG);
  boiler.rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.78, 0.78, 0.18, 20), MAT.blackMetal, -0.05, 1.6, 0, trainG).rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.16, 0.24, 0.9, 10), MAT.blackMetal, -0.6, 2.8, 0, trainG); // chimney
  add(new THREE.SphereGeometry(0.42, 12, 8), MAT.brass, -1.6, 2.5, 0, trainG).scale.y = 0.7; // steam dome
  add(new THREE.SphereGeometry(0.3, 12, 8), MAT.brass, -2.6, 2.45, 0, trainG).scale.y = 0.7;
  // chassis frame under the boiler
  add(tbox(5.6, 0.35, 1.7, 2), MAT.blackMetal, -2.8, 0.68, 0, trainG, { cast: false });
  // cowcatcher wedge at the front
  const cow = add(tbox(0.9, 0.9, 1.7, 1), MAT.locoRed, 0.25, 0.55, 0, trainG); cow.rotation.z = -0.5;
  // cab: red walls, glass windows, roof, footplate the driver stands on
  // (roof 3.4 clears the driver's head at 0.9 + 2.25 = 3.15)
  add(tbox(2.2, 2.5, 2.0, 2), MAT.locoRed, -4.5, 2.1, 0, trainG);
  add(tbox(2.4, 0.12, 2.3, 2), MAT.blackMetal, -4.5, 3.4, 0, trainG);
  for (const sz of [-1.02, 1.02]) {
    const win = add(new THREE.PlaneGeometry(0.9, 0.7), MAT.glass, -4.5, 2.3, sz, trainG, { cast: false });
    if (sz < 0) win.rotation.y = Math.PI;
  }
  add(tbox(2.4, 0.1, 1.3, 2), MAT.steel, -4.5, 0.85, 0.85, trainG, { cast: false }); // footplate (south, driver stands here)
  add(tbox(2.4, 0.1, 1.15, 2), MAT.steel, -4.5, 0.85, -0.75, trainG, { cast: false });
  // headlamp + warm glow
  add(new THREE.SphereGeometry(0.16, 10, 8), MAT.brass, 0.05, 2.3, 0, trainG);
  const lamp = softGlow(1.1, '#ffe9a8', 0.55); lamp.position.set(0.3, 2.3, 0); trainG.add(lamp);
  // goods wagon: open-top box + grain heap inside
  add(tbox(4.4, 0.12, 2.0, 2), MAT.woodDk, -8.2, 0.95, 0, trainG, { cast: false });
  add(tbox(4.4, 1.0, 0.12, 2), MAT.wood, -8.2, 1.5, 1.0, trainG, { cast: false });
  add(tbox(4.4, 1.0, 0.12, 2), MAT.wood, -8.2, 1.5, -1.0, trainG, { cast: false });
  add(tbox(0.12, 1.0, 2.0, 2), MAT.wood, -6.05, 1.5, 0, trainG, { cast: false });
  add(tbox(0.12, 1.0, 2.0, 2), MAT.wood, -10.35, 1.5, 0, trainG, { cast: false });
  const heap = add(new THREE.SphereGeometry(1.5, 14, 8), MAT.grain, -8.2, 1.85, 0, trainG, { cast: false }); heap.scale.set(1.35, 0.32, 0.6);
  // wheels: loco 3 axles + cab axle + wagon 2 axles (radius 0.45, on rails)
  for (const [wx, wz] of [[-0.8, 0.85], [-0.8, -0.85], [-2.4, 0.85], [-2.4, -0.85], [-4.0, 0.85], [-4.0, -0.85], [-5.2, 0.85], [-5.2, -0.85], [-7.2, 0.85], [-7.2, -0.85], [-9.6, 0.85], [-9.6, -0.85]]) makeWheel(wx, wz);
}

// ---------- THE PEACOCK (hero prop, built from real parts) ----------
// Faces -x (toward the approaching train). Body + neck + head + crest,
// legs planted on the track, and a 9-feather tail fan: folded = a train
// trailing behind, fanned = a wall of staring eyes behind the body.
const peaG = new THREE.Group(); world.add(peaG);
const peaBlobTex = P.tex(P.radial('20,14,30', 0.6));
const peaBlob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ map: peaBlobTex, transparent: true, depthWrite: false, fog: true }));
peaBlob.rotation.x = -Math.PI / 2; peaBlob.position.y = 0.02; peaBlob.userData.ndSkip = true; peaG.add(peaBlob);
const peaBody = add(new THREE.SphereGeometry(0.5, 20, 14), MAT.peacockBlue, 0, 0.62, 0, peaG);
peaBody.scale.set(1.25, 0.8, 0.8);
const wingL = add(new THREE.SphereGeometry(0.3, 12, 8), MAT.peacockGreen, -0.05, 0.62, 0.42, peaG, { cast: false }); wingL.scale.set(1.4, 0.9, 0.25);
const wingR = add(new THREE.SphereGeometry(0.3, 12, 8), MAT.peacockGreen, -0.05, 0.62, -0.42, peaG, { cast: false }); wingR.scale.set(1.4, 0.9, 0.25);
const legL = add(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 6), MAT.dark, -0.08, 0.17, 0.13, peaG, { cast: false });
const legR = add(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 6), MAT.dark, -0.08, 0.17, -0.13, peaG, { cast: false });
for (const fz of [0.13, -0.13]) add(tbox(0.16, 0.03, 0.1, 1), MAT.dark, -0.12, 0.015, fz, peaG, { cast: false });
// head group pivots at the neck base so pecking dips the head
const headG = new THREE.Group(); headG.position.set(-0.3, 0.78, 0); peaG.add(headG);
const neck = add(new THREE.CylinderGeometry(0.11, 0.14, 0.55, 10), MAT.peacockBlue, -0.18, 0.2, 0, headG);
neck.rotation.z = 0.45;
add(new THREE.SphereGeometry(0.16, 14, 10), MAT.peacockBlue, -0.42, 0.42, 0, headG);
const beak = add(new THREE.ConeGeometry(0.06, 0.22, 8), MAT.beak, -0.62, 0.4, 0, headG);
beak.rotation.z = Math.PI / 2;
for (const ez of [0.13, -0.13]) add(new THREE.SphereGeometry(0.035, 8, 6), MAT.dark, -0.48, 0.47, ez, headG, { cast: false });
for (const cz of [-0.05, 0, 0.05]) {
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), MAT.dark, -0.4, 0.66, cz, headG, { cast: false });
  add(new THREE.SphereGeometry(0.035, 8, 6), MAT.peacockGreen, -0.4, 0.78, cz, headG, { cast: false });
}
// tail fan: 9 eye feathers on pivots at the rear of the body
const fanPivot = new THREE.Group(); fanPivot.position.set(0.45, 0.75, 0); peaG.add(fanPivot);
const feathers = [];
for (let i = 0; i < 9; i++) {
  const fg = new THREE.Group(); fanPivot.add(fg);
  const geo = new THREE.PlaneGeometry(0.34, 1.6); geo.translate(0, 0.8, 0);
  const fm = new THREE.Mesh(geo, MAT.feather); fm.castShadow = true; fg.add(fm);
  feathers.push(fg);
}
const fanGlint = softGlow(1.4, '#cfe8ff', 0); fanGlint.position.set(0.6, 1.5, 0); peaG.add(fanGlint);
// grain shower: 42 golden grains shaken loose from the wagon, falling
// with gravity, one small bounce, then lying scattered on the track.
const GRAIN_N = 42;
const grainParts = [];
{
  const r = srnd(77);
  for (let i = 0; i < GRAIN_N; i++) {
    const m = add(new THREE.SphereGeometry(0.06, 6, 5), MAT.grain, 0, -10, 0, world, { cast: false });
    m.visible = false;
    grainParts.push({ m, t0: 860 + (i % 13) * 6 + Math.floor(r() * 5), x0: -9.3 + (i % 7) * 0.2 + r() * 0.15, z0: 0.8 + (i % 9) * 0.07 }); // z 0.8..1.36: south of the wagon wall, camera side, so the shower reads
  }
}
const pile = add(new THREE.SphereGeometry(0.55, 14, 8), MAT.grain, -6.7, 0.12, 1.1, world, { cast: false });
pile.scale.set(1.6, 0.3, 1.1); pile.visible = false;

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE PEACOCK WHO ', ' STOPPED A TRAIN '], 4.6, 1.2, '#1e3d24', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['     BUT TOMORROW...     ', '    HOW DO YOU CARRY    ', '   WATER IN A SIEVE?   '], 4.6, 1.2, '#2e1a3a', '#ffd76a', 900, { pitch: 0.28, dy: 0.01 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.2, 'boardHook');

// ---------- FX: pollen motes + chimney steam + brake dust + clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 3, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const steamEmit = smoke.addEmitter(-34, 3.2, 0, { rate: 0, color: 0xffffff, opacity: 0.22, scale: 0.6, grow: 1.6, life: 1.4, vy: 1.1, wind: 0.15 });
const brakeEmit = smoke.addEmitter(-4, 0.35, 0.8, { rate: 0, color: 0xcbb89a, opacity: 0.3, scale: 0.7, grow: 1.8, life: 1.6, vy: 0.5, wind: 0.3 });
const grainEmit = smoke.addEmitter(-9, 2.1, 1.3, { rate: 0, color: 0xd9a441, opacity: 0.35, scale: 0.7, grow: 1.4, life: 1.2, vy: 0.3, wind: 0.2 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.22, color: 0xf4f6fa, drift: 0.5 });
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
    dustEmit.rate = pr.smokeRate * 3;
    steamEmit.rate = fxF < 345 ? 2.5 : 0.3;
    steamEmit.x = trainXAt(fxF) - 0.6;
    brakeEmit.rate = pr.steamRate * 8;
    brakeEmit.x = trainXAt(fxF) - 1.5; brakeEmit.z = 0.8;
    grainEmit.rate = (pr.grainRate || 0) * 8;
    grainEmit.x = trainXAt(fxF) - 6.0; grainEmit.z = 1.3;
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
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3(), _fold = new THREE.Vector3(), _fan = new THREE.Vector3();
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) { o.userData.boardVisible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; o.visible = false; } });
  // THE TRAIN rides the story: approaches, brakes, stops at -3.2
  trainG.position.x = Ws.trainX;
  const wAng = -Ws.trainDist / 0.45;
  for (const wg of wheels) wg.rotation.z = wAng;
  // THE PEACOCK: position, tail fan, peck, walk
  peaG.position.set(Ws.peaX, 0, Ws.peaZ);
  const fanK = Ws.fanK || 0;
  for (let i = 0; i < 9; i++) {
    const a = (-65 + i * 16.25) * Math.PI / 180;
    _fan.set(0.25, Math.cos(a), Math.sin(a)).normalize();
    _fold.set(1, -0.1, (i - 4) * 0.05).normalize();
    _dir.copy(_fold).lerp(_fan, fanK).normalize();
    feathers[i].quaternion.setFromUnitVectors(_up, _dir);
  }
  const walkK = (f >= 1002 && f <= 1085) ? 1 : 0;
  const peckK = Ws.peckK || 0;
  headG.rotation.z = peckK * (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(f * 0.45)));
  legL.rotation.x = walkK * Math.sin(f * 0.3) * 0.4;
  legR.rotation.x = -walkK * Math.sin(f * 0.3) * 0.4;
  peaBody.position.y = 0.62 + walkK * Math.abs(Math.sin(f * 0.3)) * 0.02;
  fanGlint.material.opacity = (Ws.glintK || 0) * 0.85;
  fanGlint.visible = (Ws.glintK || 0) > 0.02;
  // GRAIN SHOWER: deterministic fall per particle — accelerates, lands,
  // one small bounce, then lies scattered on the track.
  const T_LAND = 0.664;
  for (const gp of grainParts) {
    const dt = (f - gp.t0) / 30;
    if (dt < 0) { gp.m.visible = false; continue; }
    gp.m.visible = true;
    if (dt < T_LAND) {
      gp.m.position.set(gp.x0 + 3.0 * dt, 2.3 - 4.9 * dt * dt, gp.z0);
    } else {
      const dt2 = dt - T_LAND;
      const y = 0.14 + Math.max(0, 1.1 * dt2 - 4.9 * dt2 * dt2);
      gp.m.position.set(gp.x0 + 3.0 * T_LAND + 0.35 * Math.min(dt2, 0.25), y, gp.z0);
    }
  }
  // the grain pile grows where the shower landed
  const pk = Ws.pileK || 0;
  pile.visible = pk > 0.01;
  pile.scale.set(1.6 * Math.max(pk, 0.01), 0.3 * Math.max(pk, 0.01), 1.1 * Math.max(pk, 0.01));
  // jungle crowns sway in gusts (never a uniform wave)
  foliage.forEach((c) => { c.rotation.z = Math.sin(f * 0.015 + c.userData.phase) * 0.02; });
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
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; o.visible = !!o.userData.boardVisible; return; }
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
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
