import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, BOARD_POS, BOARD_RY } from './story.js';
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
// the chandelier's warm practical — motivated by the fixture itself
const chandLight = new THREE.PointLight(0xffd9a0, 1.1, 14, 1.6); chandLight.position.set(0, 4.6, -3); scene.add(chandLight);

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
  marble: texM(P.marble(10), 9, 9),
  marbleDark: texM(P.marble(14), 3, 3, '#b9c2cc'),
  wood: texM(P.planks(4), 2, 2),
  woodDark: texM(P.planks(6), 2, 2, '#9a7a58'),
  stone: texM(P.stone(8), 2, 2),
  plaster: texM(P.plaster(8, 42), 6, 2),
  carpet: texM(P.weave(21, [352, 62, 30]), 2, 7),
  velvet: texM(P.weave(23, [350, 68, 32]), 1, 1),
  sofa: texM(P.weave(25, [340, 30, 32]), 2, 1),
  safeMetal: texM(P.panelMetal(41, 222), 1, 1),
  brass: toon({ color: '#c9a24e', roughness: 0.45, metalness: 0.55 }),
  brassDark: toon({ color: '#8a6c2e', roughness: 0.5, metalness: 0.5 }),
  iron: toon({ color: '#2e2c30', roughness: 0.6, metalness: 0.4 }),
  cream: toon({ color: '#efe3c8', roughness: 1 }),
  leaf: toon({ color: '#4d7a35', roughness: 1 }),
  leaf2: toon({ color: '#639347', roughness: 1 }),
  paper: toon({ color: '#f6efdd', roughness: 1 }),
  glassCase: FX.glassMat(0xbfe0ea, 0.30),
  diaMat: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.15, roughness: 0.05, transparent: true, opacity: 0.96, flatShading: true, envMapIntensity: 2.9 }),
  diaMatCopy: new THREE.MeshStandardMaterial({ color: '#dfeefc', metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.9, flatShading: true, envMapIntensity: 1.7 }),
};

// ---------- the diamond: a real brilliant cut, built from its parts ----------
// crown frustum (table + crown facets) over an 8-facet pavilion cone —
// flatShading makes every facet read separately; glint sprites ride it.
const makeDiamond = (mat, s = 1) => {
  const g = new THREE.Group();
  const crown = add(new THREE.CylinderGeometry(0.085 * s, 0.15 * s, 0.055 * s, 8), mat, 0, 0.028 * s, 0, g);
  const pav = add(new THREE.CylinderGeometry(0.15 * s, 0.012 * s, 0.115 * s, 8), mat, 0, -0.057 * s, 0, g);
  crown.rotation.y = Math.PI / 8; pav.rotation.y = Math.PI / 8;
  return g;
};
const makeGlints = (parent, s = 1) => {
  const out = [];
  for (const [x, y, z, sc] of [[0.1, 0.05, 0.1, 0.26], [-0.11, 0.02, 0.06, 0.19], [0.02, 0.09, -0.08, 0.15]]) {
    const gl = FX.glint(sc * s); gl.position.set(x * s, y * s, z * s); gl.userData.baseScale = sc * s; gl.userData.ndSkip = true; parent.add(gl); out.push(gl);
  }
  return out;
};
const bottleProfile = [[0, 0], [0.15, 0], [0.165, 0.03], [0.165, 0.3], [0.1, 0.42], [0.052, 0.47], [0.052, 0.62], [0.068, 0.64], [0.068, 0.68], [0, 0.68]].map(([x, y]) => new THREE.Vector2(x, y));
const makeBottle = (tint, label = '#e8dcc0') => {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.LatheGeometry(bottleProfile, 16), FX.glassMat(tint, 0.55));
  glass.castShadow = true; g.add(glass);
  add(new THREE.CylinderGeometry(0.168, 0.168, 0.15, 16, 1, true), toon({ color: label, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.17, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.045, 0.048, 0.07, 10), toon({ color: '#c8a878', roughness: 1 }), 0, 0.68, 0, g);
  const gl = FX.glint(0.3); gl.position.set(0.1, 0.42, 0.12); gl.userData.ndSkip = true; g.add(gl);
  return g;
};

// ---------- WORLD: the grand hotel lobby (ONE set, daylight) ----------
const CASE_POS = [0, 0, -3];
const world = new THREE.Group(); scene.add(world);
{ // marble floor + the red carpet runner to the case
  flat(add(new THREE.PlaneGeometry(64, 48), MAT.marble, 0, 0, -2, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(2.7, 13.5), MAT.carpet, 0, 0.012, 2.6, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(7.5, 7.5), MAT.carpet, 0, 0.011, -3, world, { cast: false }));
}
// --- walls: back + side returns, wainscot, tall bright windows ---
{
  add(tbox(30, 7.4, 0.35, 3), MAT.plaster, 0, 3.7, -12.2, world, { cast: false });
  add(box(30, 1.15, 0.42), MAT.woodDark, 0, 0.57, -12.15, world, { cast: false });
  add(box(30, 0.14, 0.44), MAT.brassDark, 0, 1.2, -12.15, world, { cast: false });
  const side = (sx) => {
    add(tbox(0.35, 7.4, 17, 3), MAT.plaster, sx * 13.2, 3.7, -4.5, world, { cast: false });
    add(box(0.42, 1.15, 17), MAT.woodDark, sx * 13.15, 0.57, -4.5, world, { cast: false });
  };
  side(-1); side(1);
  const winMat = new THREE.MeshBasicMaterial({ color: '#fff3cf', fog: true });
  const window_ = (x) => {
    const g = new THREE.Group(); g.position.set(x, 3.6, -12.0); world.add(g);
    const gl = add(new THREE.PlaneGeometry(2.5, 4.6), winMat, 0, 0, 0, g, { cast: false }); gl.userData.ndSkip = true;
    add(box(2.7, 0.14, 0.1), MAT.woodDark, 0, 2.36, 0.03, g, { cast: false });
    add(box(2.7, 0.14, 0.1), MAT.woodDark, 0, -2.36, 0.03, g, { cast: false });
    add(box(0.14, 4.8, 0.1), MAT.woodDark, -1.32, 0, 0.03, g, { cast: false });
    add(box(0.14, 4.8, 0.1), MAT.woodDark, 1.32, 0, 0.03, g, { cast: false });
    add(box(0.09, 4.6, 0.08), MAT.woodDark, 0, 0, 0.03, g, { cast: false });
    add(box(2.5, 0.09, 0.08), MAT.woodDark, 0, 0.4, 0.03, g, { cast: false });
    add(new THREE.TorusGeometry(1.32, 0.09, 6, 14, Math.PI), MAT.woodDark, 0, 2.36, 0.03, g, { cast: false });
  };
  window_(-8.6); window_(8.6); window_(-4.4); window_(4.4);
  for (const x of [-6.5, 6.5, -10.8, 10.8]) {
    add(box(1.7, 3.4, 0.06), MAT.plaster, x, 2.9, -12.0, world, { cast: false });
    add(box(1.86, 0.1, 0.05), MAT.brassDark, x, 4.65, -11.99, world, { cast: false });
    add(box(1.86, 0.1, 0.05), MAT.brassDark, x, 1.15, -11.99, world, { cast: false });
  }
}
// --- columns: shaft + base + capital, marble ---
{
  const col = (x, z) => {
    add(box(1.15, 0.5, 1.15), MAT.marbleDark, x, 0.25, z, world);
    add(new THREE.CylinderGeometry(0.4, 0.46, 5.6, 14), MAT.marble, x, 3.3, z, world);
    add(box(1.1, 0.42, 1.1), MAT.marbleDark, x, 6.3, z, world);
    const r1 = add(new THREE.TorusGeometry(0.44, 0.05, 8, 18), MAT.brass, x, 5.9, z, world); r1.rotation.x = Math.PI / 2;
    const r2 = add(new THREE.TorusGeometry(0.47, 0.05, 8, 18), MAT.brass, x, 0.62, z, world); r2.rotation.x = Math.PI / 2;
  };
  col(-6.2, -0.5); col(6.2, -0.5); col(-6.2, -8.6); col(6.2, -8.6);
}
// --- mezzanine rail + stairs (back-left) for crane depth ---
{
  add(box(13.5, 0.18, 1.5), MAT.woodDark, -4.6, 3.28, -11.2, world, { cast: false });
  for (let i = 0; i < 12; i++) add(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6), MAT.brassDark, -10.6 + i * 1.05, 2.85, -10.55, world, { cast: false });
  const rail = add(new THREE.CylinderGeometry(0.06, 0.06, 13.2, 8), MAT.wood, -4.6, 3.42, -10.55, world, { cast: false }); rail.rotation.z = Math.PI / 2;
  for (let i = 0; i < 7; i++) add(box(2.0, 0.22, 0.6), MAT.marbleDark, -11.3, 0.11 + i * 0.46, -7.6 - i * 0.55, world);
}
// --- THE DISPLAY CASE: pedestal, velvet cushion, glass, brass frame ---
const diaCaseG = new THREE.Group(); scene.add(diaCaseG);
let caseGlints = [];
{
  const [cx, , cz] = CASE_POS;
  add(new THREE.CylinderGeometry(0.95, 1.15, 0.18, 8), MAT.marbleDark, cx, 0.09, cz, world);
  add(new THREE.CylinderGeometry(0.62, 0.8, 0.78, 8), MAT.stone, cx, 0.57, cz, world);
  add(new THREE.CylinderGeometry(0.78, 0.66, 0.1, 8), MAT.brassDark, cx, 1.0, cz, world);
  const cush = add(new THREE.SphereGeometry(0.34, 12, 9), MAT.velvet, cx, 1.13, cz, world); cush.scale.set(1.15, 0.42, 1.15);
  const trim = add(new THREE.TorusGeometry(0.36, 0.028, 8, 20), MAT.brass, cx, 1.1, cz, world); trim.rotation.x = Math.PI / 2;
  world.add(diaCaseG); diaCaseG.position.set(cx, 1.33, cz);
  diaCaseG.add(makeDiamond(MAT.diaMat, 1));
  caseGlints = makeGlints(diaCaseG, 1);
  const glassG = new THREE.Group(); glassG.position.set(cx, 0, cz); world.add(glassG);
  const pane = (w, h, x, y, z, ry) => { const p = add(new THREE.PlaneGeometry(w, h), MAT.glassCase, x, y, z, glassG, { cast: false }); p.rotation.y = ry; p.userData.ndSkip = true; return p; };
  pane(1.06, 0.78, 0, 1.44, 0.53, 0); pane(1.06, 0.78, 0, 1.44, -0.53, Math.PI);
  pane(1.06, 0.78, 0.53, 1.44, 0, Math.PI / 2); pane(1.06, 0.78, -0.53, 1.44, 0, -Math.PI / 2);
  const top = add(new THREE.PlaneGeometry(1.06, 1.06), MAT.glassCase, 0, 1.84, 0, glassG, { cast: false }); top.rotation.x = -Math.PI / 2; top.userData.ndSkip = true;
  for (const [bx, bz] of [[0.54, 0.54], [0.54, -0.54], [-0.54, 0.54], [-0.54, -0.54]])
    add(box(0.05, 0.84, 0.05), MAT.brass, bx, 1.44, bz, glassG);
  for (const y of [1.03, 1.85]) {
    add(box(1.13, 0.05, 0.05), MAT.brass, 0, y, 0.54, glassG); add(box(1.13, 0.05, 0.05), MAT.brass, 0, y, -0.54, glassG);
    const r1 = add(box(1.13, 0.05, 0.05), MAT.brass, 0.54, y, 0, glassG); r1.rotation.y = Math.PI / 2;
    const r2 = add(box(1.13, 0.05, 0.05), MAT.brass, -0.54, y, 0, glassG); r2.rotation.y = Math.PI / 2;
  }
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (const [gx, gy, len] of [[-0.18, 1.5, 0.52], [0.22, 1.34, 0.34]]) {
    const s = add(new THREE.PlaneGeometry(0.035, len), glintMat, gx, gy, 0.545, glassG, { cast: false });
    s.rotation.z = 0.65; s.userData.ndSkip = true;
  }
  const post = (x, z) => { add(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), MAT.brass, x, 0.48, z, world);
    add(new THREE.SphereGeometry(0.06, 8, 6), MAT.brass, x, 0.98, z, world);
    add(new THREE.CylinderGeometry(0.16, 0.19, 0.05, 10), MAT.brassDark, x, 0.025, z, world); };
  post(-1.35, -1.65); post(1.35, -1.65); post(-1.35, -4.35); post(1.35, -4.35);
  const rope = (x0, z0, x1, z1) => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, 0.95, z0), new THREE.Vector3((x0 + x1) / 2, 0.78, (z0 + z1) / 2), new THREE.Vector3(x1, 0.95, z1));
    add(new THREE.TubeGeometry(curve, 10, 0.032, 6), MAT.velvet, 0, 0, 0, world);
  };
  rope(-1.35, -1.65, 1.35, -1.65); rope(-1.35, -4.35, 1.35, -4.35); rope(-1.35, -1.65, -1.35, -4.35); rope(1.35, -1.65, 1.35, -4.35);
}
// --- reception desk: counter, marble top, bell, ledger, key board ---
{
  const dx = -5.6, dz = -9.9;
  add(tbox(4.6, 1.12, 0.8, 2), MAT.wood, dx, 0.56, dz, world);
  add(box(4.9, 0.07, 1.05), MAT.marble, dx, 1.16, dz, world);
  add(box(4.6, 0.1, 0.7), MAT.woodDark, dx, 0.05, dz, world);
  for (let i = 0; i < 5; i++) add(box(0.06, 0.9, 0.06), MAT.brassDark, dx - 2.0 + i * 1.0, 0.56, dz + 0.42, world, { cast: false });
  add(new THREE.CylinderGeometry(0.11, 0.13, 0.03, 12), MAT.brassDark, dx + 1.5, 1.21, dz + 0.15, world);
  add(new THREE.SphereGeometry(0.095, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.brass, dx + 1.5, 1.22, dz + 0.15, world);
  add(new THREE.SphereGeometry(0.025, 8, 6), MAT.brassDark, dx + 1.5, 1.33, dz + 0.15, world);
  const led = new THREE.Group(); led.position.set(dx - 1.2, 1.2, dz + 0.1); led.rotation.y = 0.3; world.add(led);
  add(box(0.62, 0.025, 0.44), MAT.paper, 0, 0, 0, led);
  const pg = add(box(0.3, 0.015, 0.42), MAT.paper, -0.15, 0.03, 0, led); pg.rotation.z = 0.28;
  add(box(0.64, 0.02, 0.46), MAT.velvet, 0, -0.02, 0, led);
  add(box(2.2, 1.5, 0.06), MAT.woodDark, dx, 2.6, -11.95, world, { cast: false });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    const kx = dx - 0.85 + c * 0.42, ky = 3.1 - r * 0.45;
    add(new THREE.SphereGeometry(0.022, 6, 5), MAT.brass, kx, ky, -11.9, world, { cast: false });
    if ((r * 5 + c) % 3 !== 2) add(box(0.035, 0.13, 0.015), MAT.brass, kx, ky - 0.09, -11.9, world, { cast: false });
  }
  add(new THREE.CylinderGeometry(0.09, 0.12, 0.03, 10), MAT.brassDark, dx + 2.0, 1.21, dz - 0.1, world);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6), MAT.brass, dx + 2.0, 1.38, dz - 0.1, world);
  add(new THREE.CylinderGeometry(0.09, 0.17, 0.16, 12, 1, true), toon({ color: '#3f7a52', roughness: 0.7, side: THREE.DoubleSide }), dx + 2.0, 1.58, dz - 0.1, world);
  const lg = softGlow(0.5, 0xffd9a0, 0.4); lg.position.set(dx + 2.0, 1.52, dz - 0.1); world.add(lg);
}
// --- THE SAFE: riveted steel body, hinged door, dial, spoked handle ---
const SAFE_POS = [6.1, 0, -10.6];
const safeDoorG = new THREE.Group(); scene.add(safeDoorG);
const diaSafeG = new THREE.Group(); scene.add(diaSafeG);
let safeGlints = [];
{
  const [sx, , sz] = SAFE_POS;
  add(box(3.4, 4.4, 0.25), MAT.woodDark, sx, 2.2, sz - 0.75, world, { cast: false });
  add(box(3.7, 0.16, 0.3), MAT.brassDark, sx, 4.45, sz - 0.75, world, { cast: false });
  add(tbox(1.7, 2.1, 1.15, 2), MAT.safeMetal, sx, 1.12, sz, world);
  add(box(1.86, 0.14, 1.3), MAT.iron, sx, 0.07, sz, world);
  add(box(1.86, 0.12, 1.3), MAT.iron, sx, 2.22, sz, world);
  add(box(1.44, 1.8, 0.05), MAT.iron, sx, 1.12, sz - 0.5, world, { cast: false });
  add(box(1.44, 0.05, 0.9), MAT.velvet, sx, 0.62, sz - 0.05, world, { cast: false });
  world.add(diaSafeG); diaSafeG.position.set(sx, 0.78, sz - 0.02);
  diaSafeG.add(makeDiamond(MAT.diaMatCopy, 0.92));
  safeGlints = makeGlints(diaSafeG, 0.9);
  const note = add(new THREE.PlaneGeometry(0.3, 0.2), MAT.paper, sx + 0.42, 0.72, sz + 0.18, world, { cast: false });
  note.rotation.set(-0.5, 0.2, 0.1); note.userData.ndSkip = true;
  diaSafeG.userData.note = note;
  world.add(safeDoorG); safeDoorG.position.set(sx + 0.78, 1.12, sz + 0.62);
  add(tbox(1.56, 1.94, 0.13, 2), MAT.safeMetal, -0.78, 0, 0, safeDoorG);
  add(box(1.3, 1.68, 0.03), MAT.iron, -0.78, 0, 0.08, safeDoorG, { cast: false });
  for (const hy of [-0.7, 0, 0.7]) add(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 10), MAT.iron, -0.02, hy, 0, safeDoorG);
  for (const [rxx, ryy] of [[-0.12, 0.85], [-0.78, 0.9], [-1.44, 0.85], [-0.12, -0.85], [-0.78, -0.9], [-1.44, -0.85], [-0.12, 0], [-1.44, 0]])
    add(new THREE.SphereGeometry(0.032, 8, 6), MAT.brassDark, rxx, ryy, 0.1, safeDoorG, { cast: false });
  const dial = new THREE.Group(); dial.position.set(-0.5, 0.42, 0.12); safeDoorG.add(dial);
  const d1 = add(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 20), MAT.brassDark, 0, 0, 0, dial); d1.rotation.x = Math.PI / 2;
  const d2 = add(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 16), MAT.brass, 0, 0, 0.02, dial); d2.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const tk = add(box(0.014, i % 3 ? 0.035 : 0.055, 0.012), MAT.cream, -0.5 + Math.cos(a) * 0.165, 0.42 + Math.sin(a) * 0.165, 0.1, safeDoorG, { cast: false }); tk.rotation.z = a + Math.PI / 2; }
  add(box(0.02, 0.07, 0.02), MAT.brass, -0.5, 0.63, 0.12, safeDoorG, { cast: false });
  const hub = new THREE.Group(); hub.position.set(-1.06, -0.28, 0.13); safeDoorG.add(hub);
  add(new THREE.TorusGeometry(0.17, 0.028, 8, 20), MAT.brass, 0, 0, 0, hub);
  for (let i = 0; i < 3; i++) { const sp = add(box(0.03, 0.32, 0.03), MAT.brass, 0, 0, 0, hub); sp.rotation.z = i * Math.PI / 3; }
  const hb = add(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 10), MAT.brassDark, 0, 0, 0, hub); hb.rotation.x = Math.PI / 2;
  safeDoorG.userData.hub = hub; safeDoorG.userData.dial = dial;
}
// --- THE GREAT CLOCK: rim, painted face, moving hands, pendulum ---
const CLOCK_POS = [0, 4.8, -11.95];
let hourHand, minHand, pendulum;
{
  const [kx, ky, kz] = CLOCK_POS;
  const case_ = add(new THREE.CylinderGeometry(1.18, 1.18, 0.16, 28), MAT.woodDark, kx, ky, kz, world, { cast: false });
  case_.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(1.12, 0.07, 10, 32), MAT.brass, kx, ky, kz + 0.09, world, { cast: false });
  const fc = document.createElement('canvas'); fc.width = fc.height = 512;
  const g = fc.getContext('2d');
  g.fillStyle = '#f7efdb'; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
  g.strokeStyle = '#8a6c2e'; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 238, 0, 7); g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, big = i % 5 === 0;
    g.strokeStyle = '#3a2c1c'; g.lineWidth = big ? 9 : 3;
    g.beginPath(); g.moveTo(256 + Math.cos(a) * (big ? 208 : 218), 256 + Math.sin(a) * (big ? 208 : 218));
    g.lineTo(256 + Math.cos(a) * 228, 256 + Math.sin(a) * 228); g.stroke();
  }
  g.fillStyle = '#3a2c1c'; g.font = '900 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('XII', 256, 92); g.fillText('VI', 256, 424); g.fillText('IX', 88, 258); g.fillText('III', 424, 258);
  g.font = '700 30px Georgia, serif'; g.fillStyle = '#8a6c2e'; g.fillText('GRAND', 256, 168);
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = 4;
  const face = add(new THREE.CircleGeometry(1.1, 28), new THREE.MeshBasicMaterial({ map: ft, fog: true }), kx, ky, kz + 0.09, world, { cast: false });
  face.userData.ndSkip = true;
  const handMat = toon({ color: '#2c2118', roughness: 0.6 });
  const mkHand = (w, len) => {
    const geo = new THREE.BoxGeometry(w, len, 0.02); geo.translate(0, len / 2 - 0.08, 0);
    const m = new THREE.Mesh(geo, handMat); m.position.set(kx, ky, kz + 0.13); m.castShadow = false; world.add(m); return m;
  };
  hourHand = mkHand(0.075, 0.58); minHand = mkHand(0.05, 0.92);
  add(new THREE.SphereGeometry(0.06, 10, 8), MAT.brass, kx, ky, kz + 0.14, world, { cast: false });
  add(tbox(0.9, 1.7, 0.22, 2), MAT.wood, kx, ky - 2.15, kz - 0.02, world, { cast: false });
  const pgl = add(new THREE.PlaneGeometry(0.62, 1.4), MAT.glassCase, kx, ky - 2.15, kz + 0.1, world, { cast: false }); pgl.userData.ndSkip = true;
  pendulum = new THREE.Group(); pendulum.position.set(kx, ky - 1.45, kz + 0.02); world.add(pendulum);
  add(new THREE.CylinderGeometry(0.018, 0.018, 1.15, 6), MAT.brassDark, 0, -0.57, 0, pendulum, { cast: false });
  const pb = add(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 16), MAT.brass, 0, -1.12, 0, pendulum, { cast: false }); pb.rotation.x = Math.PI / 2;
}
// --- chandelier: rod, brass rings, candles, crystal drops ---
{
  const cg = new THREE.Group(); cg.position.set(0, 0, -3); world.add(cg);
  add(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), MAT.brassDark, 0, 6.9, 0, cg, { cast: false });
  const ringM = add(new THREE.TorusGeometry(1.05, 0.055, 10, 28), MAT.brass, 0, 6.05, 0, cg, { cast: false }); ringM.rotation.x = Math.PI / 2;
  const ring2 = add(new THREE.TorusGeometry(0.6, 0.04, 8, 20), MAT.brass, 0, 6.5, 0, cg, { cast: false }); ring2.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 1.05, z = Math.sin(a) * 1.05;
    add(new THREE.CylinderGeometry(0.028, 0.04, 0.22, 8), MAT.cream, x, 6.2, z, cg, { cast: false });
    const fl = softGlow(0.42, 0xffc37a, 0.55); fl.position.set(x, 6.38, z); cg.add(fl);
    const bulb = add(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe2a8', fog: true }), x, 6.36, z, cg, { cast: false }); bulb.userData.ndSkip = true;
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = Math.cos(a) * 0.82, z = Math.sin(a) * 0.82;
    add(new THREE.OctahedronGeometry(0.05), MAT.diaMat, x, 5.82, z, cg, { cast: false });
  }
  const halo = softGlow(2.6, 0xffd9a0, 0.16); halo.position.set(0, 6.1, 0); cg.add(halo);
}
// --- tables with REAL bottles, chairs, sofa, plants, the grand doorway ---
{
  const table = (x, z, bottles) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); world.add(tg);
    add(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 18), MAT.wood, 0, 0.78, 0, tg);
    const tr = add(new THREE.TorusGeometry(0.58, 0.02, 8, 22), MAT.brassDark, 0, 0.78, 0, tg); tr.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 10), MAT.woodDark, 0, 0.5, 0, tg);
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 12), MAT.woodDark, 0, 0.26, 0, tg);
    add(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 14), MAT.woodDark, 0, 0.03, 0, tg);
    bottles.forEach(([bx, bz, tint], i) => { const b = makeBottle(tint); b.position.set(bx, 0.81, bz); b.rotation.y = i * 1.3; tg.add(b); });
    add(new THREE.CylinderGeometry(0.07, 0.1, 0.025, 10), MAT.brassDark, -0.3, 0.82, -0.25, tg);
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), MAT.brass, -0.3, 0.93, -0.25, tg);
    add(new THREE.CylinderGeometry(0.07, 0.13, 0.13, 12, 1, true), toon({ color: '#e8b4b8', roughness: 0.8, side: THREE.DoubleSide }), -0.3, 1.08, -0.25, tg, { cast: false });
    return tg;
  };
  table(3.9, -5.6, [[0.18, 0.1, 0x5a7a3a], [-0.05, -0.2, 0x7a3a2e]]);
  table(-3.7, 2.9, [[0.1, 0.15, 0x3a5a7a]]);
  const chair = (x, z, ry) => {
    const cg2 = new THREE.Group(); cg2.position.set(x, 0, z); cg2.rotation.y = ry; world.add(cg2);
    add(box(0.52, 0.05, 0.5), MAT.wood, 0, 0.48, 0, cg2);
    add(box(0.52, 0.62, 0.05), MAT.wood, 0, 0.82, -0.24, cg2);
    add(box(0.44, 0.08, 0.04), MAT.velvet, 0, 0.95, -0.22, cg2, { cast: false });
    for (const [lx, lz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]])
      add(new THREE.CylinderGeometry(0.025, 0.03, 0.48, 8), MAT.woodDark, lx, 0.24, lz, cg2);
  };
  chair(3.9, -4.4, Math.PI); chair(4.9, -5.9, -Math.PI / 2); chair(-4.6, 2.9, Math.PI / 2); chair(-3.7, 4.1, 0);
  const sg = new THREE.Group(); sg.position.set(6.4, 0, 3.2); sg.rotation.y = -Math.PI / 2 - 0.25; world.add(sg);
  add(box(2.3, 0.42, 0.95), MAT.sofa, 0, 0.32, 0, sg);
  add(box(2.3, 0.75, 0.24), MAT.sofa, 0, 0.85, -0.38, sg);
  add(box(0.24, 0.62, 0.95), MAT.sofa, -1.05, 0.62, 0, sg);
  add(box(0.24, 0.62, 0.95), MAT.sofa, 1.05, 0.62, 0, sg);
  add(box(1.0, 0.16, 0.8), MAT.velvet, -0.52, 0.58, 0.02, sg);
  add(box(1.0, 0.16, 0.8), MAT.velvet, 0.52, 0.58, 0.02, sg);
  for (const [lx, lz] of [[-1.0, -0.35], [1.0, -0.35], [-1.0, 0.35], [1.0, 0.35]])
    add(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 8), MAT.woodDark, lx, 0.07, lz, sg);
  const palm = (x, z) => {
    add(new THREE.CylinderGeometry(0.3, 0.38, 0.55, 12), toon({ color: '#8a4a30', roughness: 1 }), x, 0.28, z, world);
    add(new THREE.CylinderGeometry(0.05, 0.08, 1.3, 8), MAT.woodDark, x, 1.1, z, world);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const lf = add(new THREE.SphereGeometry(0.85, 8, 6), i % 2 ? MAT.leaf : MAT.leaf2, x + Math.cos(a) * 0.5, 1.95 + (i % 3) * 0.12, z + Math.sin(a) * 0.5, world, { cast: false });
      lf.scale.set(1, 0.28, 0.45); lf.rotation.y = -a;
    }
  };
  palm(-4.6, 9.2); palm(4.6, 9.2); palm(-11.5, -6); palm(11.5, -6);
  add(box(3.4, 4.6, 0.3), MAT.woodDark, 0, 2.3, 11.8, world, { cast: false });
  const doorGlow = add(new THREE.PlaneGeometry(2.7, 4.0), new THREE.MeshBasicMaterial({ color: '#ffedb8', fog: true }), 0, 2.0, 11.6, world, { cast: false });
  doorGlow.userData.ndSkip = true;
  add(box(0.12, 4.0, 0.12), MAT.brassDark, 0, 2.0, 11.55, world, { cast: false });
}
// --- gala bunting: swagged ropes + pennants across the lobby ---
{
  const swag = (x0, x1, z, y) => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, y, z), new THREE.Vector3((x0 + x1) / 2, y - 0.55, z), new THREE.Vector3(x1, y, z));
    add(new THREE.TubeGeometry(curve, 12, 0.02, 6), MAT.brassDark, 0, 0, 0, world, { cast: false });
    for (let i = 1; i < 8; i++) {
      const p = curve.getPoint(i / 8);
      const tri = add(new THREE.ConeGeometry(0.09, 0.24, 4), toon({ color: i % 2 ? '#c8552e' : '#e8c85a', roughness: 1 }), p.x, p.y - 0.13, p.z, world, { cast: false });
      tri.rotation.x = Math.PI; tri.scale.z = 0.3;
    }
  };
  swag(-6.2, 6.2, -0.5, 5.6); swag(-6.2, 6.2, -8.6, 5.6);
}
// --- DYNAMIC PROPS: the porter's cart, the glass copy, the carry box ---
const cartG = new THREE.Group(); scene.add(cartG);
{
  add(box(1.15, 0.05, 0.72), MAT.wood, 0, 0.86, 0, cartG);
  add(box(1.05, 0.04, 0.62), MAT.woodDark, 0, 0.34, 0, cartG);
  for (const [lx, lz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]])
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.84, 8), MAT.iron, lx, 0.44, lz, cartG);
  const handle = add(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), MAT.iron, -0.66, 0.92, 0, cartG); handle.rotation.x = Math.PI / 2;
  const h1 = add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), MAT.iron, -0.6, 0.82, -0.36, cartG); h1.rotation.z = 0.5;
  const h2 = add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), MAT.iron, -0.6, 0.82, 0.36, cartG); h2.rotation.z = 0.5;
  for (const wz of [-0.38, 0.38]) {
    add(new THREE.TorusGeometry(0.17, 0.03, 8, 16), MAT.iron, 0.42, 0.17, wz, cartG);
    for (let i = 0; i < 3; i++) { const sp = add(box(0.02, 0.3, 0.02), MAT.iron, 0.42, 0.17, wz, cartG, { cast: false }); sp.rotation.x = i * Math.PI / 3; }
  }
  const cloth = add(new THREE.SphereGeometry(0.3, 10, 8), texM(P.weave(31, [215, 16, 60]), 1, 1), -0.3, 0.9, -0.22, cartG);
  cloth.scale.set(0.85, 0.3, 0.7);
  const pb1 = makeBottle(0x8a97a8, '#d8d2c2'); pb1.scale.setScalar(0.55); pb1.position.set(-0.35, 0.89, -0.18); cartG.add(pb1);
  const pb2 = makeBottle(0xa8895a, '#e2d8ba'); pb2.scale.setScalar(0.45); pb2.position.set(-0.42, 0.89, 0.12); cartG.add(pb2);
  const bucket = add(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 12, 1, true), toon({ color: '#7a8288', roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), 0.3, 0.47, 0, cartG, { cast: false });
}
const diaCopyG = new THREE.Group(); scene.add(diaCopyG);
let copyGlints = [];
{
  diaCopyG.add(makeDiamond(MAT.diaMatCopy, 0.95));
  copyGlints = makeGlints(diaCopyG, 0.9);
}
const carryG = new THREE.Group(); scene.add(carryG);
{
  add(box(0.44, 0.13, 0.34), MAT.velvet, 0, 0, 0, carryG);
  add(box(0.46, 0.05, 0.36), MAT.velvet, 0, 0.09, 0, carryG);
  add(box(0.47, 0.02, 0.37), MAT.brass, 0, 0.045, 0, carryG, { cast: false });
  const innerDia = makeDiamond(MAT.diaMat, 0.8); innerDia.position.y = 0.1; carryG.add(innerDia);
  makeGlints(carryG, 0.8).forEach((g) => { g.position.y += 0.12; });
}
// --- the final hook board on its easel ---
const boardPlane = textBoard(['FURNITURE SEES', 'EVERYTHING'], 1.9, 0.78, '#f3e9d2', '#3a2a18', 900, { fsMul: 0.52 });
{
  const [bx, by, bz] = BOARD_POS;
  const eg = new THREE.Group(); eg.position.set(bx, 0, bz); eg.rotation.y = BOARD_RY; world.add(eg);
  for (const s of [-1, 1]) {
    const leg = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.62, 0.7, 0.1, eg); leg.rotation.x = 0.18;
    const leg2 = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.62, 0.7, -0.28, eg); leg2.rotation.x = -0.3;
  }
  add(box(1.5, 0.06, 0.06), MAT.woodDark, 0, 0.52, 0.16, eg);
  boardPlane.position.set(bx, by, bz); boardPlane.rotation.y = BOARD_RY; boardPlane.rotation.x = -0.05;
  world.add(boardPlane); addBoardOccluder(boardPlane, 1.9, 0.78, 'boardK');
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
  // the chandelier breathes very slightly — a living practical, not a flicker
  chandLight.intensity = 1.05 + 0.1 * Math.sin(f * 0.05);
  const pulse = (arr, k, ph) => arr.forEach((gl, i) => {
    const s = 0.45 + 0.55 * Math.abs(Math.sin(f * 0.16 + i * 2.1 + ph));
    gl.material.opacity = k * s; gl.scale.setScalar(gl.userData.baseScale * (0.8 + 0.4 * s));
  });
  diaCaseG.visible = Ws.diaCase > 0;
  if (diaCaseG.visible) { diaCaseG.rotation.y = f * 0.004; pulse(caseGlints, Ws.glintK, 0); }
  diaCopyG.visible = !!Ws.diaCopy;
  if (Ws.diaCopy) { diaCopyG.position.set(Ws.diaCopy.x, Ws.diaCopy.y, Ws.diaCopy.z); diaCopyG.rotation.y = Ws.diaCopy.ry || 0; pulse(copyGlints, Ws.glintK, 1.3); }
  diaSafeG.visible = Ws.diaSafe > 0;
  if (diaSafeG.userData.note) diaSafeG.userData.note.visible = Ws.diaSafe > 0;
  if (diaSafeG.visible) pulse(safeGlints, Math.max(0.4, Ws.glintK), 2.6);
  safeDoorG.rotation.y = (Ws.safeOpen || 0) * 1.8;
  if (safeDoorG.userData.hub) safeDoorG.userData.hub.rotation.z = Ws.hubSpin || 0;
  if (safeDoorG.userData.dial) safeDoorG.userData.dial.rotation.z = Ws.dialSpin || 0;
  hourHand.rotation.z = -(Ws.clockH || 0);
  minHand.rotation.z = -(Ws.clockM || 0);
  pendulum.rotation.z = Math.sin(f * 0.075) * 0.3;
  if (Ws.cart) { cartG.visible = true; cartG.position.set(Ws.cart.x, 0, Ws.cart.z); cartG.rotation.y = Ws.cart.ry || 0; }
  else cartG.visible = false;
  carryG.visible = !!Ws.carry;
  if (Ws.carry) { carryG.position.set(Ws.carry.x, Ws.carry.y, Ws.carry.z); carryG.rotation.y = Ws.carry.ry || 0; }
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
