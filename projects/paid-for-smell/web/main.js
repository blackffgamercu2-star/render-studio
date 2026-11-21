import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, BOARD_POS, breadAt, bagAt } from './story.js';
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
// the cook-fire under the pot — the one practical, motivated by the stove
const fireLight = new THREE.PointLight(0xff8f3e, 1.4, 3.5, 1.8); fireLight.position.set(-2.4, 0.35, -2.78); scene.add(fireLight);

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

// ---------- canvas textures ----------
const dirtCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#9a7a4e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 36;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    const dark = rnd() > 0.45;
    gr.addColorStop(0, dark ? 'rgba(52,34,16,0.5)' : 'rgba(224,192,140,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.06 + rnd() * 0.09; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,232,190,0.07)' : 'rgba(28,16,6,0.09)'; g.fillRect(rnd() * 512, rnd() * 512, 2.4, 2.4); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(60,40,20,0.25)'; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 2 + rnd() * 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const stripeCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3e6cf' : '#c8552e'; g.fillRect(i * 32, 0, 32, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const MAT = {
  dirt: texM(dirtCanvas(7), 16, 16),
  wood: toon({ color: '#7a5a34', roughness: 1 }),
  woodDark: toon({ color: '#54391e', roughness: 1 }),
  woodLight: toon({ color: '#a97e4c', roughness: 1 }),
  stone: toon({ color: '#8d8578', roughness: 1 }),
  iron: toon({ color: '#2e2c30', roughness: 0.6, metalness: 0.4 }),
  stew: new THREE.MeshStandardMaterial({ color: '#96622a', roughness: 0.3, metalness: 0.05 }),
  cream: toon({ color: '#efe3c8', roughness: 1 }),
  roofRed: toon({ color: '#a34a2c', roughness: 1 }),
  leaf: toon({ color: '#4d7a35', roughness: 1 }),
  leaf2: toon({ color: '#639347', roughness: 1 }),
  cloth: toon({ color: '#d8cfc0', roughness: 1 }),
  burlap: toon({ color: '#9a7c4c', roughness: 1 }),
  crust: toon({ color: '#cf9a55', roughness: 0.9 }),
  crustTop: toon({ color: '#e3b96f', roughness: 0.9 }),
  awning: toon({ map: stripeCanvas, roughness: 1 }),
  daisWood: toon({ color: '#8a6136', roughness: 1 }),
  drape: toon({ color: '#7a2e35', roughness: 1 }),
};

// ---------- WORLD: one daylight village square ----------
const world = new THREE.Group(); scene.add(world);
{ // ground — packed earth with a worn lighter square at the centre
  const gnd = flat(add(new THREE.PlaneGeometry(240, 240), MAT.dirt, 0, 0, 0, world, { cast: false }));
  gnd.material = MAT.dirt;
  const sq = flat(add(new THREE.CircleGeometry(30, 40), toon({ color: '#b08e5c', roughness: 1 }), 0.4, 0.012, 1.2, world, { cast: false }));
  sq.receiveShadow = true;
  // distant hills ring
  for (let i = 0; i < 6; i++) {
    const a = 3.1 + i * 0.55, R = 95 + (i % 3) * 18;
    const hill = add(new THREE.SphereGeometry(38 + (i % 4) * 9, 12, 8), toon({ color: i % 2 ? '#7d8f5a' : '#6d814f', roughness: 1 }),
      Math.cos(a) * R, -16, Math.sin(a) * R - 20, world, { cast: false });
    hill.scale.y = 0.42;
  }
}
// --- the eatery stall (back-left): posts, striped awning, counter, jars ---
{
  const post = (x, z) => add(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 7), MAT.woodDark, x, 1.7, z, world);
  post(-4.9, -2.0); post(-0.1, -2.0); post(-4.9, -5.9); post(-0.1, -5.9);
  const awn = add(box(5.4, 0.08, 4.6), MAT.awning, -2.5, 3.32, -3.95, world); awn.rotation.x = 0.16;
  add(box(5.2, 2.7, 0.06), toon({ color: '#6e4630', roughness: 1 }), -2.5, 1.85, -5.95, world, { cast: false }); // stall back wall
  add(box(5.0, 1.05, 0.7), MAT.wood, -2.5, 0.525, -4.65, world);            // counter
  add(box(5.2, 0.08, 0.9), MAT.woodLight, -2.5, 1.09, -4.65, world);       // counter top
  add(box(4.6, 0.5, 0.5), MAT.woodDark, -2.5, 0.25, -5.5, world);          // back shelf base
  // jars + small pots on the counter — the rich man's stock
  const jar = (x, z, s, col) => { const j = add(new THREE.SphereGeometry(0.21 * s, 10, 8), toon({ color: col, roughness: 0.7 }), x, 1.32, z, world); j.scale.y = 1.15;
    add(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.05, 8), MAT.woodDark, x, 1.58 * s > 1.5 ? 1.56 : 1.56, z, world); };
  jar(-4.3, -4.6, 1, '#b5533c'); jar(-3.8, -4.75, 0.8, '#c98d4e'); jar(-1.2, -4.6, 1.1, '#7a8a4a'); jar(-0.7, -4.8, 0.75, '#b5533c');
  const miniPot = (x, z) => { add(new THREE.CylinderGeometry(0.19, 0.15, 0.24, 10), MAT.iron, x, 1.25, z, world);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), MAT.woodDark, x, 1.39, z, world); };
  miniPot(-3.1, -4.55); miniPot(-1.85, -4.7);
  // crates + sacks beside the stall
  add(box(0.62, 0.62, 0.62), MAT.woodLight, -5.6, 0.31, -3.4, world);
  add(box(0.55, 0.55, 0.55), MAT.wood, -5.55, 0.9, -3.45, world).rotation.y = 0.4;
  const sk = add(new THREE.SphereGeometry(0.42, 10, 8), MAT.burlap, -5.7, 0.3, -4.6, world); sk.scale.set(1, 0.78, 1);
}
// --- the great pot on its stone stove (the "theft" set piece) ---
let fireGlow;
{
  add(box(1.05, 0.55, 1.05), MAT.stone, -2.4, 0.275, -3.2, world);
  add(box(0.5, 0.34, 0.06), toon({ color: '#1c1410', roughness: 1 }), -2.4, 0.24, -2.66, world, { cast: false }); // fire mouth
  const pot = add(new THREE.CylinderGeometry(0.44, 0.36, 0.52, 14), MAT.iron, -2.4, 0.81, -3.2, world);
  add(new THREE.TorusGeometry(0.44, 0.045, 8, 18), MAT.iron, -2.4, 1.07, -3.2, world).rotation.x = Math.PI / 2;
  const stew = flat(add(new THREE.CircleGeometry(0.4, 16), MAT.stew, -2.4, 1.05, -3.2, world, { cast: false }));
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), MAT.woodLight, -2.05, 1.25, -3.45, world).rotation.z = 0.7; // ladle handle
  fireGlow = softGlow(0.85, 0xff9a4e, 0.5); fireGlow.position.set(-2.4, 0.3, -2.55); world.add(fireGlow);
}
// --- the bench the traveller eats on ---
{
  add(box(1.7, 0.09, 0.5), MAT.wood, 0.5, 0.52, -2.35, world);
  add(box(0.12, 0.5, 0.44), MAT.woodDark, -0.2, 0.26, -2.35, world);
  add(box(0.12, 0.5, 0.44), MAT.woodDark, 1.2, 0.26, -2.35, world);
}
// --- the judge's dais (front-right): platform, steps, canopy, drapes ---
{
  add(box(4.4, 0.38, 3.4), MAT.daisWood, 2.2, 0.19, 8.8, world);
  add(box(2.4, 0.19, 0.6), MAT.daisWood, 2.2, 0.095, 6.85, world);         // step
  const post = (x, z) => add(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 7), MAT.woodDark, x, 0.38 + 1.55, z, world);
  post(0.2, 7.4); post(4.2, 7.4); post(0.2, 10.2); post(4.2, 10.2);
  add(box(4.9, 0.09, 3.9), MAT.drape, 2.2, 3.55, 8.8, world);              // canopy roof
  add(box(4.4, 0.5, 0.06), MAT.drape, 2.2, 3.25, 10.55, world, { cast: false }); // back drape
  add(box(0.06, 0.5, 3.4), MAT.drape, 0.05, 3.25, 8.8, world, { cast: false });
  add(box(0.06, 0.5, 3.4), MAT.drape, 4.35, 3.25, 8.8, world, { cast: false });
}
// --- houses, tree, cart, well (square dressing) ---
{
  const house = (x, z, w, col) => {
    add(box(w, 3.1, 3.4), toon({ color: col, roughness: 1 }), x, 1.55, z, world);
    const roof = add(new THREE.ConeGeometry(w * 0.78, 1.7, 4), MAT.roofRed, x, 3.95, z, world);
    roof.rotation.y = Math.PI / 4; roof.scale.z = 0.72;
    add(box(0.8, 1.5, 0.06), MAT.woodDark, x, 0.75, z + 1.72, world, { cast: false });
  };
  house(-8, -14, 5.4, '#e8d9b8'); house(3.5, -14.5, 5.8, '#dfc9a0'); house(10.5, -13.2, 4.6, '#e8d9b8');
  const trunk = add(new THREE.CylinderGeometry(0.3, 0.44, 2.6, 8), MAT.woodDark, 6.5, 1.3, -4, world);
  add(new THREE.SphereGeometry(1.9, 10, 8), MAT.leaf, 6.5, 4.1, -4, world);
  add(new THREE.SphereGeometry(1.4, 10, 8), MAT.leaf2, 5.4, 3.4, -3.4, world);
  add(new THREE.SphereGeometry(1.3, 10, 8), MAT.leaf2, 7.6, 3.5, -4.5, world);
  // cart
  const cart = new THREE.Group(); cart.position.set(-7.5, 0, 1.5); cart.rotation.y = 0.5; world.add(cart);
  add(box(2.2, 0.14, 1.3), MAT.wood, 0, 0.85, 0, cart);
  add(box(2.2, 0.4, 0.08), MAT.wood, 0, 1.1, 0.65, cart); add(box(2.2, 0.4, 0.08), MAT.wood, 0, 1.1, -0.65, cart);
  const wheel = (x) => { const w = add(new THREE.TorusGeometry(0.52, 0.07, 8, 16), MAT.woodDark, x, 0.52, 0.72, cart); return w; };
  wheel(-0.8); wheel(0.8);
  const wheel2 = (x) => add(new THREE.TorusGeometry(0.52, 0.07, 8, 16), MAT.woodDark, x, 0.52, -0.72, cart);
  wheel2(-0.8); wheel2(0.8);
  add(box(1.4, 0.1, 0.9), MAT.burlap, 0.1, 1.05, 0, cart);
  // well
  add(new THREE.CylinderGeometry(0.8, 0.85, 0.9, 12, 1, true), MAT.stone, -5.5, 0.45, -8, world);
  add(new THREE.TorusGeometry(0.8, 0.06, 8, 16), MAT.stone, -5.5, 0.92, -8, world).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), MAT.woodDark, -6.25, 0.95, -8, world);
  add(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), MAT.woodDark, -4.75, 0.95, -8, world);
  const wr = add(new THREE.ConeGeometry(1.25, 0.6, 4), MAT.roofRed, -5.5, 2.15, -8, world); wr.rotation.y = Math.PI / 4;
}
// --- court backdrop: houses + trees behind the dais, so shots looking
// at the court have a living village behind it, not empty sky ---
{
  const houseB = (x, z, w, col) => {
    add(box(w, 3.4, 3.6), toon({ color: col, roughness: 1 }), x, 1.7, z, world, { cast: false });
    const roof = add(new THREE.ConeGeometry(w * 0.78, 1.8, 4), MAT.roofRed, x, 4.3, z, world, { cast: false });
    roof.rotation.y = Math.PI / 4; roof.scale.z = 0.72;
  };
  houseB(-6.5, 22.5, 5.6, '#e8d9b8'); houseB(3.0, 24.0, 6.0, '#dfc9a0'); houseB(11.5, 22.0, 4.8, '#e8d9b8');
  const treeB = (x, z, s) => {
    add(new THREE.CylinderGeometry(0.26 * s, 0.4 * s, 2.4 * s, 8), MAT.woodDark, x, 1.2 * s, z, world, { cast: false });
    add(new THREE.SphereGeometry(1.7 * s, 10, 8), MAT.leaf, x, 3.6 * s, z, world, { cast: false });
    add(new THREE.SphereGeometry(1.25 * s, 10, 8), MAT.leaf2, x - 1.0 * s, 2.9 * s, z + 0.3, world, { cast: false });
  };
  treeB(-3.2, 20.5, 1.1); treeB(7.8, 20.0, 0.95); treeB(15.5, 24.5, 1.2); treeB(-11.5, 24.0, 1.0);
}
// --- the hook board on its stand (blank wood until the last line) ---
const boardPlane = textBoard(['SOUND PAYS', 'FOR A SMELL'], 1.7, 0.72, '#4a3220', '#ffe9a8', 900, { fsMul: 0.62 });
{
  add(box(0.09, 1.15, 0.09), MAT.woodDark, BOARD_POS[0] - 0.55, 0.42, BOARD_POS[2], world);
  add(box(0.09, 1.15, 0.09), MAT.woodDark, BOARD_POS[0] + 0.55, 0.42, BOARD_POS[2], world);
  add(box(1.62, 0.84, 0.07), MAT.woodDark, BOARD_POS[0], BOARD_POS[1], BOARD_POS[2] - 0.045, world);
  boardPlane.position.set(BOARD_POS[0], BOARD_POS[1], BOARD_POS[2]);
  world.add(boardPlane); addBoardOccluder(boardPlane, 1.7, 0.72, 'boardK');
}
// --- hand props: the bread, the empty cloth, the coin bag ---
const breadG = new THREE.Group(); scene.add(breadG);
{
  const loaf = add(new THREE.SphereGeometry(0.3, 12, 9), MAT.crust, 0, 0, 0, breadG); loaf.scale.set(1.25, 0.42, 0.9);
  for (let i = -1; i <= 1; i++) { const s = add(box(0.16, 0.015, 0.04), MAT.crustTop, i * 0.15, 0.115, 0, breadG, { cast: false }); s.rotation.y = 0.5; s.rotation.z = 0.12; }
}
const clothG = new THREE.Group(); scene.add(clothG);
{
  const c = add(new THREE.SphereGeometry(0.3, 10, 8), MAT.cloth, 0, 0, 0, clothG); c.scale.set(1.25, 0.42, 0.9);
  const c2 = add(new THREE.SphereGeometry(0.22, 10, 8), MAT.cloth, 0.1, 0.05, 0.05, clothG, { cast: false }); c2.scale.set(1.1, 0.4, 0.85);
}
clothG.position.set(-0.9, 0.98, -2.08);
const bagG = new THREE.Group(); scene.add(bagG);
{
  const b = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.burlap, 0, -0.1, 0, bagG); b.scale.set(1, 1.15, 1);
  add(new THREE.CylinderGeometry(0.075, 0.11, 0.14, 8), MAT.burlap, 0, 0.16, 0, bagG);
  add(new THREE.TorusGeometry(0.085, 0.022, 6, 12), MAT.woodDark, 0, 0.11, 0, bagG).rotation.x = Math.PI / 2;
}
// --- steam: a deterministic curling column over the pot + a wisp that
// reaches the bread (the visible "theft") ---
const steamSprites = [];
for (let i = 0; i < 18; i++) { const s = softGlow(1, 0xcdd6e0, 0); s.material.blending = THREE.NormalBlending; scene.add(s); steamSprites.push(s); }
const breadWisp = softGlow(0.7, 0xcdd6e0, 0); breadWisp.material.blending = THREE.NormalBlending; scene.add(breadWisp);

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
  // cook-fire flicker
  const flick = 0.9 + 0.1 * Math.sin(f * 0.4) * Math.sin(f * 0.17 + 1.3);
  fireLight.intensity = 1.4 * flick;
  fireGlow.material.opacity = 0.24 * flick;
  // steam column over the pot, curling as it rises
  const sk = Ws.steamK || 0;
  steamSprites.forEach((s, i) => {
    const ph = ((f * 0.0075) + i / steamSprites.length) % 1;
    s.visible = sk > 0.01;
    if (!s.visible) return;
    s.position.set(-2.4 + Math.sin(ph * 5.2 + i * 1.7) * 0.10 * (0.35 + ph) + ((i % 3) - 1) * 0.34 * ph, 1.12 + ph * 1.3, -3.2 + Math.cos(ph * 4.1 + i) * 0.07 + ((i % 2) * 2 - 1) * 0.20 * ph);
    s.scale.setScalar(0.34 + ph * 0.8);
    s.material.opacity = sk * 0.62 * Math.sin(ph * Math.PI);
  });
  // a thin wisp bends from the pot mouth to the bread — the visible theft
  const B = breadAt(f);
  breadWisp.visible = sk > 0.01 && B.k > 0.01 && B.y > 1.2;
  if (breadWisp.visible) {
    breadWisp.position.set((B.x + -2.4) / 2, (B.y + 1.1) / 2, (B.z + -3.2) / 2);
    breadWisp.scale.set(1.5, 0.5, 1);
    breadWisp.material.opacity = sk * 0.6;
  }
  breadG.visible = B.k > 0.01;
  if (breadG.visible) { breadG.position.set(B.x, B.y, B.z); breadG.rotation.set(0, 0.3, B.rz || 0); }
  clothG.visible = (Ws.clothK || 0) > 0.01;
  const BG = bagAt(f);
  bagG.visible = BG.k > 0.01;
  if (bagG.visible) bagG.position.set(BG.x, BG.y, BG.z);
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
