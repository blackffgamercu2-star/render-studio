import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { M, gust } from './motion.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, PLATFORM, HUT, SIGNAL, TREES, GRAIN_PILE, TRACK_Z, PEACOCK_HOME, trainFrontAt, peacockMode } from './story.js';

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

// ---------- canvases: grass, grain, feather eye-spot ----------
const grassCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#6f9a44'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${110 + Math.random() * 70 | 0},${40 + Math.random() * 40 | 0},${0.25 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 3 + Math.random() * 4);
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 ? '#e8e36a' : '#e8a0c8'; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 2.5, 0, 7); g.fill(); }
  return c;   // raw canvas — texM()/P.tex() wraps it into a texture
})();
const grainCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d9a441'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,240,190,${0.25 + Math.random() * 0.45})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
  for (let i = 0; i < 260; i++) { g.fillStyle = i % 3 ? '#8a5a14' : '#f6c453'; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 3.2, 2, Math.random() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const featherCanvas = (() => {
  // One peacock tail feather, drawn from real parts: gold shaft, green
  // vane, and the eye-spot — gold ring, teal, dark blue, black pupil.
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 512);
  // vane: tapered shape, base at bottom centre, tip at top
  const vane = new Path2D();
  vane.moveTo(128, 500);
  vane.bezierCurveTo(52, 420, 44, 260, 78, 130);
  vane.bezierCurveTo(96, 70, 112, 40, 128, 18);
  vane.bezierCurveTo(144, 40, 160, 70, 178, 130);
  vane.bezierCurveTo(212, 260, 204, 420, 128, 500);
  const vg = g.createLinearGradient(0, 500, 0, 20);
  vg.addColorStop(0, '#3a6a2a'); vg.addColorStop(0.55, '#2f7a3a'); vg.addColorStop(0.85, '#7ac74f'); vg.addColorStop(1, '#c9a13a');
  g.fillStyle = vg; g.fill(vane);
  // barbs: fine diagonal strokes on the vane
  g.strokeStyle = 'rgba(20,60,20,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = 90 + i * 15;
    g.beginPath(); g.moveTo(128, y); g.lineTo(128 - 62 + (i % 3) * 6, y + 26); g.stroke();
    g.beginPath(); g.moveTo(128, y); g.lineTo(128 + 62 - (i % 3) * 6, y + 26); g.stroke();
  }
  // eye-spot near the tip
  const eye = (rx_, ry_, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(128, 118, rx_, ry_, 0, 0, 7); g.fill(); };
  eye(66, 82, '#d9a441'); eye(52, 66, '#2e7ea6'); eye(38, 48, '#1c3a7a'); eye(20, 26, '#0a1428');
  g.strokeStyle = '#ffe9a0'; g.lineWidth = 4; g.beginPath(); g.ellipse(128, 118, 58, 74, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  // shaft
  g.strokeStyle = '#c9a13a'; g.lineWidth = 6; g.beginPath(); g.moveTo(128, 505); g.lineTo(128, 24); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();

// ---------- materials ----------
const MAT = {
  grass: texM(grassCanvas, 12, 12, '#ffffff'),
  ballast: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 14, 2, '#8a7a68'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  locoRed: texM(M4.carPaintV4('#a32a22', 5), 1, 1),
  locoCream: toon({ color: '#f1e6cf' }),
  locoBlack: new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.5, metalness: 0.4, envMap, envMapIntensity: 0.7 }),
  wagonBrown: texM(M4.woodV4(7), 1, 2, '#8a6a42'),
  steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.32, metalness: 0.9, envMap, envMapIntensity: 1.1 }),
  sleeper: texM(M4.woodV4(6), 1, 1, '#5a4632'),
  grain: toon({ map: grainCanvas }),
  grainDot: toon({ color: '#d9a441' }),
  peacockBlue: new THREE.MeshStandardMaterial({ color: 0x1c4fd8, roughness: 0.42, metalness: 0.22, envMap, envMapIntensity: 0.85 }),
  peacockNeck: new THREE.MeshStandardMaterial({ color: 0x2456e0, roughness: 0.4, metalness: 0.25, envMap, envMapIntensity: 0.9 }),
  goldBeak: new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.35, metalness: 0.7, envMap, envMapIntensity: 1.0 }),
  darkLeg: toon({ color: '#3a3230' }),
  leaf: toon({ color: '#4a7a34' }), leafLt: toon({ color: '#6a9a44' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
  yellowLine: toon({ color: '#e8c33a' }),
  roofRed: toon({ color: '#a34a2a' }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.12, metalness: 0.1, envMap, envMapIntensity: 1.2, transparent: true, opacity: 0.55 }),
  feather: toon({ map: featherCanvas, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide }),
};

// ---------- the jungle station ----------
const world = new THREE.Group(); scene.add(world);
const treeGroups = [];
{
  const g = world;
  // grass ground
  const ground = flat(add(new THREE.CircleGeometry(34, 48), MAT.grass, 0, 0, 2, g, { cast: false }));
  ground.scale.set(1.15, 1, 1);
  // ballast bed + sleepers + two steel rails along x (track z = 2.0)
  add(tbox(64, 0.12, 3.6, 3), MAT.ballast, -12, 0.06, TRACK_Z, g, { cast: false });
  const sleeperGeo = box(0.24, 0.07, 2.6);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, MAT.sleeper, 72);
  { const d = new THREE.Object3D(); for (let i = 0; i < 72; i++) { d.position.set(-44 + i * 0.9, 0.15, TRACK_Z); d.updateMatrix(); sleepers.setMatrixAt(i, d.matrix); } }
  sleepers.castShadow = false; sleepers.receiveShadow = true; g.add(sleepers);
  for (const rz of [1.2, 2.8]) add(tbox(64, 0.12, 0.09, 3), MAT.steel, -12, 0.24, rz, g, { cast: false });
  // platform (top y=0.9, light paving) + yellow safety line + edge
  add(tbox(20, 0.9, 3.0, 3), MAT.plaster, PLATFORM.x, PLATFORM.top / 2, PLATFORM.z, g, { cast: false });
  add(tbox(20, 0.04, 0.18, 3), MAT.yellowLine, PLATFORM.x, PLATFORM.top + 0.02, 4.78, g, { cast: false });
  add(tbox(20, 0.12, 0.3, 3), MAT.stoneDk, PLATFORM.x, PLATFORM.top - 0.06, 4.62, g, { cast: false });
  // station hut (on the platform): plaster walls, sloped roof, door,
  // window, and the "जंगल स्टेशन" sign over the door
  add(tbox(2.8, 2.2, 2.2, 2), MAT.plaster, HUT.x, PLATFORM.top + 1.1, HUT.z, g, { cast: false });
  const roof = add(tbox(3.3, 0.1, 2.8, 2), MAT.roofRed, HUT.x, PLATFORM.top + 2.32, HUT.z, g, { cast: false }); roof.rotation.x = 0.1;
  add(tbox(0.9, 1.5, 0.08, 2), MAT.woodDk, HUT.x - 0.5, PLATFORM.top + 0.75, HUT.z - 1.12, g, { cast: false });
  add(tbox(0.8, 0.8, 0.06, 2), MAT.glass, HUT.x + 0.75, PLATFORM.top + 1.35, HUT.z - 1.12, g, { cast: false });
  const hutSign = textBoard(['जंगल स्टेशन'], 2.2, 0.55, '#1d3a1a', '#ffe9a8', 900, { fsMul: 0.9 });
  hutSign.position.set(HUT.x, PLATFORM.top + 2.05, HUT.z - 1.16); world.add(hutSign);
  // green signal (the story's "सिग्नल हरा है"): post + arm + green lamp
  add(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 7), MAT.woodDk, SIGNAL.x, 1.1, SIGNAL.z, g, { cast: false });
  add(tbox(0.7, 0.16, 0.06, 2), MAT.locoRed, SIGNAL.x - 0.3, 2.15, SIGNAL.z, g, { cast: false });
  // lamp posts on the platform edge
  for (const lx of [-9, 9]) {
    add(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 7), MAT.woodDk, lx, PLATFORM.top + 1.3, 4.9, g, { cast: false });
    add(new THREE.SphereGeometry(0.14, 10, 8), MAT.locoCream, lx, PLATFORM.top + 2.68, 4.9, g, { cast: false });
  }
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 4.2, BOARD_POS[2], g, { cast: false }); // top rail: above the hook board top (4.05) — at 3.9 it clipped line 1
  // jungle trees (trunk + layered foliage) + bushes + grass tufts
  for (let i = 0; i < TREES.length; i++) {
    const [tx, tz] = TREES[i];
    const tg = new THREE.Group(); tg.position.set(tx, 0, tz); tg.userData.seed = i + 1; g.add(tg); treeGroups.push(tg);
    add(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 7), MAT.woodDk, 0, 1.2, 0, tg, { cast: false });
    const f1 = add(new THREE.SphereGeometry(1.25, 12, 10), MAT.leaf, 0, 3.1, 0, tg, { cast: false }); f1.scale.y = 0.85;
    const f2 = add(new THREE.SphereGeometry(0.85, 10, 8), MAT.leafLt, 0.7, 2.5, 0.3, tg, { cast: false }); f2.scale.y = 0.8;
    const f3 = add(new THREE.SphereGeometry(0.7, 10, 8), MAT.leaf, -0.65, 2.6, -0.25, tg, { cast: false }); f3.scale.y = 0.8;
  }
  for (const [bx, bz, s] of [[-11, 4.4, 0.8], [5.5, -3.2, 0.9], [12, 4.6, 0.7], [-5, -4.5, 0.8], [8, 9.5, 0.9]]) {
    const bush = add(new THREE.SphereGeometry(0.55 * s, 10, 8), MAT.leaf, bx, 0.42 * s, bz, g, { cast: false }); bush.scale.y = 0.75;
  }
  // (grass tufts removed: the small cones read as black spikes on the
  // lawn at drone height — trees + bushes carry the jungle already)
}

// ---------- THE TRAIN (hero prop, built from real parts) ----------
// Loco (nose at local x=0, body extends to -6) + open goods wagon with a
// grain mound + a rear box wagon. The cab has a REAL window cutout on the
// south wall: the driver card sits inside at z=2.0 and shows through it.
const trainG = new THREE.Group(); world.add(trainG);
const wheelGroups = [];
const makeWheel = (x, z, parent) => {
  const wg = new THREE.Group(); wg.position.set(x, 0.42, z); parent.add(wg);
  const wh = add(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), MAT.locoBlack, 0, 0, 0, wg);
  wh.rotation.x = Math.PI / 2;
  const spoke = add(box(0.72, 0.07, 0.05), MAT.steel, 0, 0, 0.07, wg, { cast: false });
  wheelGroups.push(wg);
  return wg;
};
{
  const t = trainG;
  // boiler front: red body, black roof, cream stripe, chimney, headlamp
  add(tbox(2.6, 1.3, 1.7, 2), MAT.locoRed, -1.3, 1.25, 0, t);
  add(tbox(2.6, 0.1, 1.75, 2), MAT.locoBlack, -1.3, 1.95, 0, t);
  add(tbox(2.6, 0.18, 1.72, 2), MAT.locoCream, -1.3, 0.95, 0, t);
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 10), MAT.locoBlack, -0.8, 2.3, 0, t);
  add(new THREE.CylinderGeometry(0.2, 0.16, 0.12, 10), MAT.locoBlack, -0.8, 2.68, 0, t);
  const lamp = add(new THREE.SphereGeometry(0.14, 10, 8), MAT.locoCream, 0.02, 1.45, 0, t, { cast: false });
  const headGlow = softGlow(1.5, '#fff2b8', 0.85); headGlow.position.set(0.15, 1.45, 0); t.add(headGlow);
  // cowcatcher: angled wedge at the nose, low over the rails
  const cow = add(tbox(0.7, 0.5, 1.6, 2), MAT.locoBlack, 0.15, 0.35, 0, t); cow.rotation.z = -0.5;
  // cab (x -2.5..-6): floor, north wall solid, roof, rear wall; south
  // wall built as sill + two pillars + lintel = a real window opening
  // (x -3.3..-4.7, y 1.15..1.95) the driver shows through.
  add(tbox(3.5, 0.12, 1.7, 2), MAT.locoRed, -4.25, 0.56, 0, t);
  add(tbox(3.5, 1.45, 0.1, 2), MAT.locoRed, -4.25, 1.32, -0.8, t);
  add(tbox(3.5, 0.12, 1.75, 2), MAT.locoBlack, -4.25, 2.11, 0, t);
  add(tbox(0.1, 1.45, 1.7, 2), MAT.locoRed, -5.95, 1.32, 0, t);
  add(tbox(3.5, 0.55, 0.1, 2), MAT.locoRed, -4.25, 0.88, 0.8, t);            // sill
  add(tbox(0.8, 0.8, 0.1, 2), MAT.locoRed, -2.9, 1.55, 0.8, t);             // pillar R
  add(tbox(1.3, 0.8, 0.1, 2), MAT.locoRed, -5.35, 1.55, 0.8, t);            // pillar L
  add(tbox(3.5, 0.12, 0.1, 2), MAT.locoRed, -4.25, 2.0, 0.8, t);            // lintel
  add(tbox(0.5, 0.5, 0.06, 2), MAT.glass, -2.9, 1.55, 0.82, t, { cast: false }); // small cab side glass
  // wheels (spin with distance travelled)
  for (const wx of [-0.9, -2.8, -4.7]) { makeWheel(wx, 0.78, t); makeWheel(wx, -0.78, t); }
  // goods wagon (open top, grain mound inside): x -6.5..-11.5
  add(tbox(5, 0.14, 1.7, 2), MAT.wagonBrown, -9, 0.62, 0, t);
  add(tbox(5, 0.9, 0.1, 2), MAT.wagonBrown, -9, 1.1, 0.8, t);
  add(tbox(5, 0.9, 0.1, 2), MAT.wagonBrown, -9, 1.1, -0.8, t);
  add(tbox(0.1, 0.9, 1.7, 2), MAT.wagonBrown, -6.55, 1.1, 0, t);
  add(tbox(0.1, 0.9, 1.7, 2), MAT.wagonBrown, -11.45, 1.1, 0, t);
  const mound = add(new THREE.SphereGeometry(1.9, 14, 8), MAT.grain, -9, 1.35, 0, t, { cast: false });
  mound.scale.set(1.25, 0.32, 0.4);
  for (const wx of [-7.6, -10.4]) { makeWheel(wx, 0.78, t); makeWheel(wx, -0.78, t); }
  // rear box wagon: x -12..-16.5
  add(tbox(4.5, 1.7, 1.7, 2), MAT.wagonBrown, -14.25, 1.45, 0, t);
  add(tbox(4.5, 0.12, 1.75, 2), MAT.locoBlack, -14.25, 2.35, 0, t);
  for (const wx of [-13, -15.5]) { makeWheel(wx, 0.78, t); makeWheel(wx, -0.78, t); }
}
// signal lamp (green) + glow
const signalLamp = add(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0x2fd84a }), SIGNAL.x, 2.02, SIGNAL.z, world, { cast: false });
const signalGlow = softGlow(0.9, '#7dff8a', 0.7); signalGlow.position.set(SIGNAL.x, 2.02, SIGNAL.z); world.add(signalGlow);

// ---------- THE PEACOCK (hero animal, built from real parts) ----------
// Blue body, long neck + crested head + gold beak, thin legs planted on
// the sleepers, and the great tail: 13 real feathers with eye-spots that
// fan open (fanK 0..1) in the plane facing the train.
const peacockG = new THREE.Group(); peacockG.scale.setScalar(0.62); world.add(peacockG);
const featherGeo = new THREE.PlaneGeometry(0.34, 2.0); featherGeo.translate(0, 1.0, 0);
const feathers = [];
let neckG, legL, legR, tailGlint, peacockBlob;
{
  const p = peacockG;
  const body = add(new THREE.SphereGeometry(0.42, 20, 14), MAT.peacockBlue, 0, 0.55, 0, p);
  body.scale.set(0.95, 0.8, 1.35);
  const breast = add(new THREE.SphereGeometry(0.3, 14, 10), MAT.peacockNeck, 0, 0.5, 0.32, p, { cast: false });
  breast.scale.set(0.9, 0.9, 0.7);
  neckG = new THREE.Group(); neckG.position.set(0, 0.72, 0.4); p.add(neckG);
  const neck = add(new THREE.CylinderGeometry(0.085, 0.11, 0.55, 10), MAT.peacockNeck, 0, 0.24, 0.05, neckG);
  neck.rotation.x = 0.3;
  const head = add(new THREE.SphereGeometry(0.16, 14, 10), MAT.peacockBlue, 0, 0.52, 0.16, neckG);
  const beak = add(new THREE.ConeGeometry(0.06, 0.22, 8), MAT.goldBeak, 0, 0.5, 0.36, neckG, { cast: false });
  beak.rotation.x = Math.PI / 2;
  for (const [cx, tilt] of [[-0.05, -0.35], [0, 0], [0.05, 0.35]]) {
    const cr = add(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), MAT.darkLeg, cx, 0.68, 0.12, neckG, { cast: false });
    cr.rotation.z = tilt;
    add(new THREE.SphereGeometry(0.03, 6, 5), MAT.peacockNeck, cx + tilt * 0.05, 0.79, 0.12, neckG, { cast: false });
  }
  // eyes: tiny dark beads with a white glint dot
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.028, 6, 5), MAT.dark, s * 0.1, 0.55, 0.28, neckG, { cast: false });
  }
  // legs: hip groups so the walk swing pivots at the hip
  const mkLeg = (x) => {
    const lg = new THREE.Group(); lg.position.set(x, 0.38, 0.02); p.add(lg);
    add(new THREE.CylinderGeometry(0.035, 0.03, 0.34, 6), MAT.darkLeg, 0, -0.17, 0, lg, { cast: false });
    add(box(0.14, 0.03, 0.2), MAT.darkLeg, 0, -0.35, 0.04, lg, { cast: false });
    return lg;
  };
  legL = mkLeg(-0.12); legR = mkLeg(0.12);
  // tail fan: feathers radiate from the rear of the body
  const fanG = new THREE.Group(); fanG.position.set(0, 0.62, -0.42); p.add(fanG);
  for (let i = 0; i < 13; i++) {
    const fm = new THREE.Mesh(featherGeo, MAT.feather);
    fm.castShadow = true; fanG.add(fm); feathers.push(fm);
  }
  tailGlint = softGlow(1.7, '#fff3cf', 0); tailGlint.position.set(0, 1.4, -0.5); p.add(tailGlint);
  // contact shadow blob under the bird (follows its x)
  const blobTex = P.tex(P.radial('20,14,30', 0.6));
  peacockBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
  peacockBlob.rotation.x = -Math.PI / 2; peacockBlob.userData.ndSkip = true; peacockBlob.renderOrder = 1;
  scene.add(peacockBlob);
}

// ---------- grain shower + settled pile ----------
// Deterministic particles: grain shook loose by the braking falls with
// real gravity from the wagon line and lands ON the sleepers (y=0.22),
// where it stays as scattered grain; the pile grows at GRAIN_PILE.
const GRAIN_N = 130;
const grainParts = [];
{
  let s = 1234567;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0, s / 4294967296);
  for (let i = 0; i < GRAIN_N; i++) {
    grainParts.push({ x0: -11 + rnd() * 10.5, z0: 1.3 + rnd() * 1.6, y0: 1.6 + rnd() * 1.1, t0: 914 + rnd() * 28, g: 0.010 + rnd() * 0.004, s: 0.8 + rnd() * 0.5 });
  }
}
const grainMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 5), MAT.grainDot, GRAIN_N);
grainMesh.castShadow = false; grainMesh.frustumCulled = false; scene.add(grainMesh);
const grainDummy = new THREE.Object3D();
const pileMesh = add(new THREE.SphereGeometry(1, 14, 8), MAT.grain, GRAIN_PILE.x, 0.22, GRAIN_PILE.z, world, { cast: false });
pileMesh.scale.set(0.001, 0.001, 0.001);

// ---------- brake ground-ring (flat on the ballast, under the wheels) ----------
const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32),
  new THREE.MeshBasicMaterial({ color: 0xe8dcc4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
ringMesh.rotation.x = -Math.PI / 2; ringMesh.userData.ndSkip = true; scene.add(ringMesh);

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard(['वो मोर जिसने', 'ट्रेन रोक दी'], 4.6, 1.2, '#1d3a1a', '#ffe9a8', 900, { fsMul: 0.85, pitch: 0.40, dy: 0.02 });
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['पर एक औरत छलनी में', 'पानी घर ले आई —', 'एक बूँद भी नहीं गिरी।', 'भला छलनी में पानी', 'कैसे ले जाया जाता है?'], 4.6, 1.9, '#2e1a3a', '#ffd76a', 900, { pitch: 0.165, fsMul: 0.82 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.9, 'boardHook');

// ---------- FX: chimney smoke + brake dust + drifting clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const chimneyEmit = smoke.addEmitter(-40, 2.75, TRACK_Z, { rate: 0, color: 0xd8d8d8, opacity: 0.3, scale: 0.6, grow: 1.8, life: 1.6, vy: 1.1, wind: 0.35 });
const dustEmit = smoke.addEmitter(-3, 0.5, TRACK_Z, { rate: 0, color: 0xd8c8a8, opacity: 0.22, scale: 0.7, grow: 1.9, life: 1.2, vy: 0.5, wind: 0.5 });
const moteEmit = smoke.addEmitter(0, 1.2, 4, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
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
    const tx = trainFrontAt(fxF);
    chimneyEmit.x = tx - 0.8; chimneyEmit.y = 2.75; chimneyEmit.z = TRACK_Z;
    dustEmit.x = tx - 3; dustEmit.y = 0.5; dustEmit.z = TRACK_Z;
    chimneyEmit.rate = pr.smokeRate * 3.2;
    dustEmit.rate = pr.dustRate * 3.5;
    moteEmit.rate = 0.15;
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
  // THE TRAIN rides the story: approaches, brakes from f716, stops f872
  trainG.position.set(Ws.trainX, 0, TRACK_Z);
  const wheelAngle = -((Ws.trainX + 40) / 0.42);
  for (const wg of wheelGroups) wg.rotation.z = wheelAngle;
  // signal lamp: bright green while the cab beat runs
  signalLamp.material.color.setHex(0x2fd84a);
  signalGlow.material.opacity = 0.35 + 0.45 * (Ws.signalK || 0);
  // THE PEACOCK: position + turn + tail fan + peck + walk swing
  peacockG.position.set(Ws.peacockX, Ws.peacockY, Ws.peacockZ);
  peacockG.rotation.y = Ws.peacockRy;
  peacockBlob.position.set(Ws.peacockX, 0.19, Ws.peacockZ);
  const fanK = Ws.fanK || 0, peckK = Ws.peckK || 0;
  for (let i = 0; i < feathers.length; i++) {
    const a = -1.15 + (2.3 * i) / (feathers.length - 1);
    _fold.set(Math.sin(a) * 0.28, -0.12, -1).normalize();
    _fan.set(Math.sin(a), Math.cos(a), 0.06).normalize();
    _dir.copy(_fold).lerp(_fan, M.smooth(fanK)).normalize();
    feathers[i].quaternion.setFromUnitVectors(_up, _dir);
  }
  neckG.rotation.x = 0.3 + peckK * (0.55 * (0.5 + 0.5 * Math.sin(f * 0.55)) + 0.15);
  const walking = peacockMode(f) === 'stroll';
  const sw = walking ? Math.sin(f * 0.4) * 0.45 : 0;
  legL.rotation.x = sw; legR.rotation.x = -sw;
  tailGlint.material.opacity = (Ws.glintK || 0) * 0.7;
  tailGlint.visible = (Ws.glintK || 0) > 0.02;
  // grain shower (gravity: falls, lands, stays) + settled pile
  const shower = Ws.grainShowerK || 0, pileK = Ws.grainPileK || 0;
  grainMesh.visible = f >= 914;
  if (grainMesh.visible) {
    for (let i = 0; i < GRAIN_N; i++) {
      const gp = grainParts[i];
      const dt = Math.max(0, f - gp.t0);
      let y = gp.y0 - 0.5 * gp.g * dt * dt;
      if (y < 0.22) y = 0.22;
      grainDummy.position.set(gp.x0 + Math.min(dt * 0.008, 0.3), y, gp.z0);
      grainDummy.scale.setScalar(f < gp.t0 ? 0 : gp.s);   // not yet fallen = still in the wagon, invisible
      grainDummy.updateMatrix();
      grainMesh.setMatrixAt(i, grainDummy.matrix);
    }
    grainMesh.instanceMatrix.needsUpdate = true;
  }
  pileMesh.visible = pileK > 0.01;
  if (pileMesh.visible) pileMesh.scale.set(0.55 * pileK, 0.16 * pileK, 0.45 * pileK);
  // brake ground-ring: flat on the ballast under the loco wheels
  const dk = Ws.dustK || 0;
  ringMesh.visible = dk > 0.01;
  if (ringMesh.visible) {
    ringMesh.position.set(Ws.trainX - 3, 0.32, TRACK_Z);
    ringMesh.scale.setScalar(1 + dk * 0.9);
    ringMesh.material.opacity = dk * 0.45;
  }
  // trees sway in gusts (never a uniform wave)
  for (const tg of treeGroups) tg.rotation.z = Math.sin(f * 0.008 + tg.userData.seed * 1.7) * 0.025 * gust(f / 30, tg.userData.seed);
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
