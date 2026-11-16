import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, GOAT_RIVER, DYE_POT, STALL, POST } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const MW = {
  dark: toon({ color: '#3c3a38' }),
  gold: toon({ color: '#c9a227' }),
};

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
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
// soft radial glow sprite (NO hard cross — lamp light, not a sparkle)
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- the set ----------
const MAT = {
  floor: texM(P.stone(64, 40, 5, 58), 8, 8, '#b3a58e'),
  cobble: texM(P.stone(71, 44, 8, 52), 7, 3, '#a89a84'),
  plaster: texM(P.plaster(71, 36), 4, 2, '#dcc7a0'),
  plasterDk: texM(P.plaster(71, 36), 4, 2, '#b39d78'),
  wallCool: texM(P.plaster(73, 30), 4, 2, '#c4bda9'),
  marble: texM(P.marble(10), 2, 1, '#ddd6c4'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  terra: toon({ color: '#b06a3e' }), terraDk: toon({ color: '#8a4f2c' }),
  cream: toon({ color: '#f2e8cf' }),
  gold: toon({ color: '#d9a92c' }), goldDk: toon({ color: '#a87c26' }),
  crimson: toon({ color: '#8c2430' }), crimsonDk: toon({ color: '#671a24' }),
  leaf: toon({ color: '#4a6a34' }),
  jarGreen: toon({ color: '#5d7a4a' }), jarBlue: toon({ color: '#5a6e8a' }),
  sack: toon({ color: '#c9a24d' }),
  dark: toon({ color: '#33302c' }),
  grass: toon({ color: '#5d7a44' }), grassDk: toon({ color: '#47603a' }),
  water: toon({ color: '#2e7ea6' }), waterLt: toon({ color: '#bfe3f2' }),
  reed: toon({ color: '#4a6a34' }),
  hay: toon({ color: '#c9a24d' }),
  earth: toon({ color: '#8a7a5a' }),
  dyeDark: toon({ color: '#1a1512' }),
  stone: toon({ color: '#9a938a' }),
  winDark: toon({ color: '#2e3440' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  // one ground for the whole stage
  flat(add(new THREE.PlaneGeometry(110, 70), MAT.floor, 2, -0.03, 2, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(26, 10), MAT.cobble, -17, -0.018, -0.4, g, { cast: false }));

  // ================= MARKET + INN (x = -17) =================
  add(tbox(21, 6.4, 0.4, 4), MAT.plaster, -17, 3.2, -3.45, g, { cast: false });
  for (const px of [-26.6, -21.5, -12.5, -7.4]) add(tbox(0.55, 6.4, 0.55, 3), MAT.plasterDk, px, 3.2, -3.3, g, { cast: false });
  add(tbox(21, 0.35, 0.1, 3), MAT.woodDk, -17, 5.6, -3.22, g, { cast: false });
  // inn door (left) + warm window + INN sign
  add(box(1.15, 2.3, 0.12), MAT.woodDk, -21.5, 1.15, -3.2, g, { cast: false });
  add(box(0.95, 2.1, 0.06), MAT.wood, -21.5, 1.05, -3.12, g, { cast: false });
  add(new THREE.SphereGeometry(0.05, 8, 6), MAT.gold, -21.1, 1.05, -3.06, g, { cast: false });
  const innGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshBasicMaterial({ color: 0xffe9bb, fog: true }));
  innGlow.position.set(-23.6, 2.8, -3.22); innGlow.userData.ndSkip = true; g.add(innGlow);
  add(tbox(1.3, 0.1, 0.08, 2), MAT.woodDk, -23.6, 3.5, -3.18, g, { cast: false });
  add(tbox(1.3, 0.1, 0.08, 2), MAT.woodDk, -23.6, 2.1, -3.18, g, { cast: false });
  const innSign = textBoard(['INN'], 1.2, 0.5, '#4a2c14', '#ffd76a'); innSign.position.set(-21.5, 2.95, -3.1); g.add(innSign);
  // house fronts (right side of the market wall)
  for (const [hx, h, col] of [[-12.6, 4.6, '#e3d3ac'], [-9.2, 5.2, '#d8c2b2']]) {
    add(tbox(3.4, h, 0.4, 3), texM(P.plaster(80, 30), 2, 2, col), hx, h / 2, -3.3, g, { cast: false });
    const roof = add(tbox(3.8, 0.16, 1.0, 2), MAT.terraDk, hx, h + 0.1, -3.2, g, { cast: false }); roof.rotation.x = 0.06;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.0), MAT.winDark);
    win.position.set(hx - 0.8, 3.0, -3.05); win.userData.ndSkip = true; g.add(win);
    add(box(0.9, 1.9, 0.09), MAT.woodDk, hx + 0.8, 0.95, -3.08, g, { cast: false });
  }
  // hitching post outside the inn — the goat is tied HERE (post base ON the ground)
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 10), MAT.stone, POST[0], 0.06, POST[2], g, { cast: false });
  add(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 8), MAT.woodDk, POST[0], 0.75, POST[2], g, { cast: false });
  const cross = add(box(0.7, 0.09, 0.09), MAT.woodDk, POST[0], 1.2, POST[2], g, { cast: false }); cross.rotation.y = 0.4;
  add(new THREE.SphereGeometry(0.11, 8, 6), MAT.wood, POST[0], 1.54, POST[2], g, { cast: false });
  // market stall: posts + canopy + table; goods rest ON the table (top y 0.95)
  for (const [sx, sz] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) add(box(0.09, 2.3, 0.09), MAT.woodDk, STALL[0] + sx, 1.15, STALL[2] + sz, g, { cast: false });
  const canopy = add(box(2.9, 0.07, 2.1), MAT.crimson, STALL[0], 2.36, STALL[2], g, { cast: false }); canopy.rotation.z = 0.04;
  add(tbox(2.4, 0.09, 1.5, 2), MAT.wood, STALL[0], 0.95, STALL[2], g, { cast: false });
  for (const [lx, lz] of [[-1.05, -0.6], [1.05, -0.6], [-1.05, 0.6], [1.05, 0.6]]) add(box(0.11, 0.9, 0.11), MAT.woodDk, STALL[0] + lx, 0.45, STALL[2] + lz, g, { cast: false });
  const apples = add(new THREE.SphereGeometry(0.3, 9, 7), MAT.crimson, STALL[0] + 0.55, 1.12, STALL[2] + 0.1, g, { cast: false }); apples.scale.y = 0.55;
  const apples2 = add(new THREE.SphereGeometry(0.22, 9, 7), MAT.crimson, STALL[0] + 0.85, 1.08, STALL[2] - 0.3, g, { cast: false }); apples2.scale.y = 0.6;
  // coin pouch + coin stacks ON the stall table (the fifty silver coins)
  const pouch = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.sack, STALL[0] - 0.6, 1.1, STALL[2] - 0.1, g, { cast: false }); pouch.scale.y = 0.82;
  add(new THREE.CylinderGeometry(0.07, 0.1, 0.1, 8), MAT.sack, STALL[0] - 0.6, 1.25, STALL[2] - 0.1, g, { cast: false });
  const coinStack = (x, z, n) => { for (let i = 0; i < n; i++) add(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 12), i % 2 ? MAT.gold : MAT.goldDk, x, 1.01 + i * 0.03, z, g, { cast: false }); };
  coinStack(STALL[0] - 0.15, STALL[2] + 0.35, 4); coinStack(STALL[0] + 0.05, STALL[2] + 0.5, 3);
  const crate1 = FX.crate(0.95); crate1.position.set(-12.6, 0.48, -0.9); g.add(crate1);
  const barrel1 = FX.barrel(0.42, 1.05); barrel1.position.set(-12.2, 0.53, -2.9); g.add(barrel1);

  // ================= SHEPHERD'S YARD (x = 0) =================
  add(tbox(21, 5.8, 0.4, 4), MAT.wallCool, 0, 2.9, -3.45, g, { cast: false });
  add(tbox(21, 0.3, 0.08, 4), MAT.woodDk, 0, 0.15, -3.22, g, { cast: false });
  flat(add(new THREE.CircleGeometry(9, 26), MAT.grass, 0, -0.02, 0.5, g, { cast: false }));
  // hut (right side): walls + pitched roof + door + warm window
  add(tbox(4.4, 2.6, 1.2, 3), MAT.plaster, 3.4, 1.3, -2.8, g, { cast: false });
  const roofL = add(tbox(4.8, 0.14, 1.1, 2), MAT.terraDk, 3.4, 2.95, -2.55, g, { cast: false }); roofL.rotation.x = 0.5;
  const roofR = add(tbox(4.8, 0.14, 1.1, 2), MAT.terraDk, 3.4, 2.95, -3.05, g, { cast: false }); roofR.rotation.x = -0.5;
  add(box(0.95, 1.85, 0.1), MAT.woodDk, 3.4, 0.93, -2.16, g, { cast: false });
  const hutGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), new THREE.MeshBasicMaterial({ color: 0xffe9bb, fog: true }));
  hutGlow.position.set(4.9, 1.7, -2.16); hutGlow.userData.ndSkip = true; g.add(hutGlow);
  // fence along the back (left of the hut — behind the actors, never occluding feet)
  for (let i = 0; i < 5; i++) add(box(0.12, 1.0, 0.12), MAT.woodDk, -5.4 + i * 1.5, 0.5, -2.6, g, { cast: false });
  add(box(6.2, 0.09, 0.07), MAT.wood, -2.4, 0.85, -2.6, g, { cast: false });
  add(box(6.2, 0.09, 0.07), MAT.wood, -2.4, 0.5, -2.6, g, { cast: false });
  // THE DYE POT — squat pot sitting ON the ground, black dye surface inside
  add(new THREE.CylinderGeometry(0.42, 0.34, 0.55, 14), MAT.terraDk, DYE_POT[0], 0.275, DYE_POT[2], g, { cast: false });
  add(new THREE.CylinderGeometry(0.45, 0.42, 0.07, 14), MAT.dark, DYE_POT[0], 0.55, DYE_POT[2], g, { cast: false });
  flat(add(new THREE.CircleGeometry(0.36, 16), MAT.dyeDark, DYE_POT[0], 0.56, DYE_POT[2], g, { cast: false }));
  const stick = add(new THREE.CylinderGeometry(0.03, 0.035, 0.9, 7), MAT.woodDk, DYE_POT[0] + 0.42, 0.45, DYE_POT[2] + 0.1, g, { cast: false }); stick.rotation.z = 0.5;
  // hay bales ON the ground, tucked against the hut wall (right side —
  // clear of the yard cameras' foreground)
  const hay1 = add(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 12), MAT.hay, 4.6, 0.5, -1.6, g, { cast: false }); hay1.rotation.z = Math.PI / 2;
  const hay2 = add(new THREE.CylinderGeometry(0.36, 0.36, 0.9, 12), MAT.hay, 5.3, 0.36, -0.9, g, { cast: false }); hay2.rotation.z = Math.PI / 2; hay2.rotation.y = 0.4;
  // lamp post (night light) — pole planted, lamp + glow at the top
  add(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), MAT.dark, -3.8, 1.3, -2.2, g, { cast: false });
  add(box(0.3, 0.34, 0.3), MAT.goldDk, -3.8, 2.7, -2.2, g, { cast: false });
  const lampGlow = softGlow(2.6, 0xffd9a0, 0.22); lampGlow.position.set(-3.8, 2.7, -2.1); g.add(lampGlow);

  // ================= RIVER (x = +17) =================
  // bank: grass disc, low earth bank wall at the back, two trees
  flat(add(new THREE.CircleGeometry(10, 26), MAT.grass, 17, -0.025, -0.5, g, { cast: false }));
  add(tbox(20, 1.2, 0.5, 3), MAT.earth, 17, 0.6, -3.6, g, { cast: false });
  const tree = (x, z, s) => {
    add(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.6 * s, 8), MAT.woodDk, x, 0.8 * s, z, g, { cast: false });
    add(new THREE.ConeGeometry(1.1 * s, 2.2 * s, 9), MAT.leaf, x, 2.4 * s, z, g, { cast: false });
    add(new THREE.ConeGeometry(0.8 * s, 1.6 * s, 9), MAT.leaf, x, 3.4 * s, z, g, { cast: false });
  };
  tree(11.2, -2.8, 1.0); tree(22.8, -2.6, 1.15);
  // water: flat stylised plane (FX.makeWater's shader renders black in
  // SwiftShader, so a plain toon plane + light streaks instead)
  flat(add(new THREE.PlaneGeometry(14, 8), MAT.water, 17, 0.02, 4, g, { cast: false }));
  for (const [gx, gz, gl] of [[14.5, 3.0, 0.3], [18.5, 5.2, -0.2], [20.5, 2.2, 0.5], [15.8, 6.4, 0.1]]) {
    const st = add(box(1.9, 0.02, 0.13), MAT.waterLt, gx, 0.045, gz, g, { cast: false }); st.rotation.y = gl;
  }
  // reeds at the water's edge + stones on the bank
  for (const [rx_, rz_] of [[13.2, 0.3], [13.7, 0.1], [21.4, 0.4], [21.9, 0.1], [14.1, 0.5]]) {
    add(new THREE.CylinderGeometry(0.025, 0.035, 1.15, 6), MAT.reed, rx_, 0.57, rz_, g, { cast: false });
  }
  for (const [sx, sz, sr] of [[15.2, -0.9, 0.32], [20.2, -1.1, 0.4], [13.8, -1.4, 0.26]]) {
    const st = add(new THREE.SphereGeometry(sr, 8, 6), MAT.stone, sx, 0.05, sz, g, { cast: false }); st.scale.y = 0.55;
  }
  // the merchant's wash bucket, ON the bank beside the goat
  add(new THREE.CylinderGeometry(0.22, 0.18, 0.45, 12), MAT.woodDk, 16.3, 0.225, 0.4, g, { cast: false });
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), MAT.water, 16.3, 0.44, 0.4, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['HE SOLD THE SAME', 'GOAT TWICE'], 3.4, 1.0, '#4a2c14', '#ffd76a'); boardTitle.position.set(-17, 4.35, -3.12); world.add(boardTitle);
const boardPayoff = textBoard(['NO REFUNDS ON', 'WASHED GOATS.'], 2.8, 1.0, '#7a1f1f', '#ffe9a8'); boardPayoff.position.set(0, 3.7, -3.1); world.add(boardPayoff);
const boardHook = textBoard(['HOW DO YOU SELL', "A VOICE THAT ISN'T YOURS?"], 3.2, 0.95, '#1f2a44', '#ffd76a'); boardHook.position.set(0, 4.9, -3.05); world.add(boardHook);

// ---------- FX: haze + window dust + river splashes ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(-17, 2.6, -1.0, { rate: 0.10, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(0, 2.8, -2.7, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const splashes = new FX.Splashes(scene, 160); splashes.points.userData.ndSkip = true;
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  splashes.life.fill(-1);
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    if (Ws.washK > 0 && fxF % 13 === 0) splashes.burst(GOAT_RIVER[0], 0.18, GOAT_RIVER[2], { n: 16, power: 3.4 });
    smoke.update(t, dt);
    splashes.update(t, dt);
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardPayoff, Ws.boardPayoff || 0); setB(boardHook, Ws.boardHook || 0);
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
