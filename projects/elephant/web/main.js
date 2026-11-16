import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, flyCrowsAt, THRONE, GOLDBAG, WELL } from './story.js';

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
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldBright: toon({ color: '#f0bc4a' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  steel: toon({ color: '#565d66' }), steelDk: toon({ color: '#33373d' }),
  crimson: toon({ color: '#7a1f2e' }), crimsonDk: toon({ color: '#5d1622' }),
  royal: toon({ color: '#3a2a5e' }),
  crow: toon({ color: '#17161c' }), crowBeak: toon({ color: '#3a3a40' }),
  white: toon({ color: '#f7f3e6' }), wax: toon({ color: '#e8ddc4' }),
  cushion: toon({ color: '#8c2432' }),
  dark: toon({ color: '#33302c' }),
  moonDisc: new THREE.MeshBasicMaterial({ color: 0xf4f0ff, transparent: true, opacity: 0, fog: true }),
  glowWarm: new THREE.MeshBasicMaterial({ color: 0xffc37a, transparent: true, opacity: 0, fog: true }),
  goldGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(64, 7), MAT.dirt, 10, -0.012, 3.4, g, { cast: false }));       // the road
  flat(add(new THREE.CircleGeometry(8.5, 22), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));      // palace courtyard
  flat(add(new THREE.CircleGeometry(7, 20), MAT.dirt, 16, -0.006, -2, g, { cast: false }));       // well clearing
  flat(add(new THREE.CircleGeometry(9, 20), MAT.dirt, -16, -0.006, -5, g, { cast: false }));      // grove clearing
  // distant huts + trees (depth for the eastward flight)
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [20, -12, 0.4], [26, -13, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9], [-24, -11, 1.1], [30, -12, 1]]) {
  // NORTHERN HILL RIDGE (z -24..-30): a continuous tree-covered ridge so the
  // cameras never see the bare ground plane grazing into the sky — that seam
  // read as a thick black band in daylight (ink edge on the grazing depth).
  for (const [hx, hz, hr, hs] of [[-30, -27, 12, 0.3], [-18, -25, 11, 0.34], [-6, -28, 13, 0.3], [6, -25, 11, 0.36], [18, -28, 12, 0.3], [30, -25, 11, 0.34], [42, -27, 12, 0.3]]) {
    const hill = add(new THREE.SphereGeometry(hr, 12, 8), MAT.leaf, hx, -0.8, hz, g, { cast: false });
    hill.scale.y = hs; hill.userData.ndSkip = true;
  }
  for (const [tx, tz, ts] of [[-22, -20, 1.1], [-8, -19, 1.3], [10, -20, 1.0], [24, -19, 1.2], [36, -21, 1.0]]) {
    add(new THREE.CylinderGeometry(0.3 * ts, 0.44 * ts, 2.8 * ts, 8), MAT.woodDk, tx, 1.4 * ts, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * ts, 10, 8), MAT.leaf2, tx, 3.6 * ts, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= THE PALACE COURT (facade z=-3.2, throne z=-2.2) =================
{
  const g = world;
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, -4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, 4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(16.1, 0.4, 0.7, 2), MAT.stone, 0, 5.05, -3.45, g, { cast: false });
  add(tbox(2.4, 2.35, 0.5, 2), MAT.stoneDk, 0, 3.72, -3.45, g, { cast: false });   // lintel over the doorway (no sky-hole)
  for (const sx of [-5.9, 5.9]) {   // palace towers
    add(new THREE.CylinderGeometry(1.05, 1.2, 6.0, 10), MAT.stone, sx, 3.0, -3.45, g, { cast: false });
    add(new THREE.ConeGeometry(1.5, 1.3, 10), MAT.crimson, sx, 6.6, -3.45, g, { cast: false });
    add(new THREE.SphereGeometry(0.18, 8, 6), MAT.goldBright, sx, 7.45, -3.45, g, { cast: false });
  }
  // the great doorway: dark recess + closed double doors with gold trim
  add(tbox(2.3, 2.6, 0.1, 2), MAT.dark, 0, 1.3, -3.85, g, { cast: false });
  add(tbox(1.1, 2.5, 0.08, 2), MAT.woodDk, -0.56, 1.25, -3.78, g, { cast: false });
  add(tbox(1.1, 2.5, 0.08, 2), MAT.woodDk, 0.56, 1.25, -3.78, g, { cast: false });
  add(tbox(0.08, 2.5, 0.04, 2), MAT.gold, 0, 1.25, -3.72, g, { cast: false });
  for (const dy of [0.6, 1.25, 1.9]) for (const dx of [-0.56, 0.56]) add(new THREE.SphereGeometry(0.05, 8, 6), MAT.goldBright, dx, dy, -3.7, g, { cast: false });
  // red carpet from the doorway to the courtyard
  flat(add(new THREE.PlaneGeometry(2.2, 5.4), MAT.crimson, 0, -0.004, -0.6, g, { cast: false }));
  add(tbox(2.2, 0.06, 0.3, 2), MAT.gold, 0, 0.03, 2.05, g, { cast: false });
  // ---- THE THRONE (dais behind the king's card; seat + tall back + arms) ----
  add(tbox(3.4, 0.14, 1.1, 2), MAT.stoneDk, 0, 0.07, -2.75, g, { cast: false });
  add(tbox(2.8, 0.14, 0.9, 2), MAT.stone, 0, 0.21, -2.7, g, { cast: false });
  add(tbox(1.0, 0.3, 0.7, 2), MAT.royal, 0, 0.45, -2.6, g, { cast: false });          // seat
  add(tbox(1.0, 1.7, 0.18, 2), MAT.royal, 0, 1.35, -2.92, g, { cast: false });         // tall back
  add(tbox(1.06, 0.14, 0.2, 2), MAT.gold, 0, 2.22, -2.92, g, { cast: false });         // gold crest rail
  add(new THREE.SphereGeometry(0.12, 8, 6), MAT.goldBright, 0, 2.36, -2.92, g, { cast: false });
  for (const ax of [-0.58, 0.58]) {
    add(tbox(0.14, 0.5, 0.6, 2), MAT.royal, ax, 0.85, -2.6, g, { cast: false });       // armrests
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.goldBright, ax, 1.14, -2.6, g, { cast: false });
  }
  add(tbox(0.9, 0.1, 0.55, 2), MAT.cushion, 0, 0.64, -2.6, g, { cast: false });        // red cushion
  // guards' spears planted at their posts
  for (const sx of [-2.62, 2.62]) {
    add(new THREE.CylinderGeometry(0.03, 0.035, 2.7, 7), MAT.woodDk, sx, 1.35, -1.9, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.34, 8), MAT.steel, sx, 2.85, -1.9, g, { cast: false });
  }
  // banners flanking the throne
  for (const bx of [-1.6, 1.6]) {
    add(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 7), MAT.gold, bx, 1.3, -3.1, g, { cast: false });
    const ban = add(tbox(0.55, 1.3, 0.04, 2), MAT.crimson, bx, 1.85, -3.08, g, { cast: false });
    add(new THREE.ConeGeometry(0.28, 0.3, 4), MAT.goldBright, bx, 2.68, -3.1, g, { cast: false }).rotation.y = Math.PI / 4;
  }
}
// ================= THE CROW GROVE (x=-16) — big trees full of crows =================
const PERCHED = [
  [-5.9, 7.4, -3.45, 0.5], [5.9, 7.4, -3.45, -0.5],
  [-3.0, 5.35, -3.4, 0.2], [3.0, 5.35, -3.4, -0.2],
  [-17.5, 0.75, -3.6, 0.8], [-16.6, 0.75, -3.9, -1.2],
  [-14.6, 4.85, -8.0, -1.2],
  [-13, 4.35, -3.8, 0],
  [-16, 4.35, 3.0, 0], [-11.8, 4.55, -1.5, -1.0],
];
// cylinder strut between two points (grove branches)
const strut = (a, b, r, mat, parent = world) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, len, 6), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};
{
  const g = world;
  for (const [tx, tz, s] of [[-19, -8, 1.1], [-13, -8.5, 1.0], [-16, -1.5, 1.0]]) {
    add(new THREE.CylinderGeometry(0.34 * s, 0.5 * s, 3.4 * s, 8), MAT.woodDk, tx, 1.7 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.4 * s, 10, 8), MAT.leaf, tx, 4.4 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
    const can2 = add(new THREE.SphereGeometry(1.4 * s, 10, 8), MAT.leaf2, tx + 1.2 * s, 3.6 * s, tz + 0.6 * s, g, { cast: false });
    can2.scale.y = 0.7; can2.userData.ndSkip = true;
    const can3 = add(new THREE.SphereGeometry(1.2 * s, 10, 8), MAT.leaf, tx - 1.3 * s, 3.9 * s, tz - 0.5 * s, g, { cast: false });
    can3.scale.y = 0.7; can3.userData.ndSkip = true;
  }
  // deliberate outward branches — each ends in a perched crow, clear of the foliage
  // (a crow half-buried in an ndSkip canopy renders as a hollow outline)
  strut([-18.2, 3.4, -7.8], [-14.6, 4.7, -8.0], 0.06, MAT.woodDk);
  strut([-13, 3.0, -7.6], [-13, 4.2, -3.8], 0.06, MAT.woodDk);
  strut([-16, 3.0, -0.8], [-16, 4.2, 3.0], 0.06, MAT.woodDk);
  strut([-15.2, 3.2, -1.6], [-11.8, 4.4, -1.5], 0.06, MAT.woodDk);
  // fallen log + bushes in the grove
  const log = add(new THREE.CylinderGeometry(0.32, 0.36, 2.4, 8), MAT.woodDk, -17.5, 0.32, -3.6, g, { cast: false });
  log.rotation.z = Math.PI / 2; log.rotation.y = 0.4;
  for (const [bx, bz, s] of [[-19.5, -4, 0.8], [-13, -3.5, 0.7], [-15, -8.8, 0.9]]) {
    const b = add(new THREE.SphereGeometry(0.9 * s, 8, 6), MAT.leaf2, bx, 0.5 * s, bz, g, { cast: false });
    b.scale.y = 0.6; b.userData.ndSkip = true;
  }
}
// ================= THE RIVER (x=+16) — boat, elephant, stones, chalk =================
let boatG, chalkMark, elephG, trunkG, ripple1, ripple2, pileG;
let boatStones = [];
{
  const g = world, wx = WELL[0], wz = WELL[2];
  // river water: a NARROW northern strip (z -8..-3.6); the bank south of it
  // is dry dirt/grass, so the boy, king, soldiers and the waiting elephant
  // all stand on solid ground, never in the water
  const water = add(new THREE.PlaneGeometry(30, 4.4), new THREE.MeshBasicMaterial({ color: 0x2e6a8c, fog: true }), 17, 0.02, -5.8, g, { cast: false });
  water.rotation.x = -Math.PI / 2; water.userData.ndSkip = true;
  // wooden jetty planks spanning the bank edge out to the boat
  add(tbox(1.6, 0.08, 1.4, 2), MAT.wood, 15.5, 0.05, -3.9, g, { cast: false });
  // ---- THE BOAT (group origin at the waterline; hull centre y 0, deck top +0.355) ----
  boatG = new THREE.Group(); boatG.position.set(wx, 0.25, wz); g.add(boatG);
  add(tbox(3.6, 0.7, 1.4, 2), MAT.wood, 0, 0, 0, boatG, { cast: false });                 // hull
  add(tbox(3.4, 0.07, 1.2, 2), MAT.woodDk, 0, 0.32, 0, boatG, { cast: false });            // deck
  add(tbox(3.6, 0.12, 0.08, 2), MAT.woodDk, 0, 0.38, 0.66, boatG, { cast: false });        // gunwales
  add(tbox(3.6, 0.12, 0.08, 2), MAT.woodDk, 0, 0.38, -0.66, boatG, { cast: false });
  const prow = add(new THREE.ConeGeometry(0.5, 0.9, 4), MAT.woodDk, 2.05, 0.05, 0, boatG, { cast: false });
  prow.rotation.z = -Math.PI / 2; prow.rotation.y = Math.PI / 4;
  const stern = add(new THREE.ConeGeometry(0.5, 0.9, 4), MAT.woodDk, -2.05, 0.05, 0, boatG, { cast: false });
  stern.rotation.z = Math.PI / 2; stern.rotation.y = Math.PI / 4;
  add(tbox(0.3, 0.06, 1.1, 2), MAT.woodDk, -0.9, 0.2, 0, boatG, { cast: false });          // benches
  add(tbox(0.3, 0.06, 1.1, 2), MAT.woodDk, 0.9, 0.2, 0, boatG, { cast: false });
  // chalk mark on the SOUTH side of the hull at the sunk waterline (rel y 0.07);
  // geometry shifted so scale.x draws it left-to-right as the boy marks it
  const chalkGeo = new THREE.BoxGeometry(0.55, 0.07, 0.03); chalkGeo.translate(0.275, 0, 0);
  chalkMark = new THREE.Mesh(chalkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }));
  chalkMark.position.set(-1.72, 0.07, 0.72);   // west end of the hull — clear of the elephant chalkMark.userData.ndSkip = true; chalkMark.visible = false;
  boatG.add(chalkMark);
  // stones that load into the boat: rest ON the deck, scale in one by one
  const stoneMat = toon({ color: '#7a7a72' });
  const stoneXZ = [[-1.2, -0.25], [-0.7, 0.25], [-0.2, -0.25], [0.3, 0.25], [0.8, -0.25], [1.2, 0.25]];
  for (let i = 0; i < 6; i++) {
    const sm = new THREE.Mesh(new THREE.SphereGeometry(0.17 + (i % 3) * 0.02, 10, 8), stoneMat);
    sm.position.set(stoneXZ[i][0], 0.535, stoneXZ[i][1]); sm.castShadow = true; sm.visible = false;
    sm.scale.setScalar(0.001); boatG.add(sm); boatStones.push(sm);
  }
  // ---- THE ELEPHANT (3D, side profile facing +x, feet at local y 0) ----
  const elephMat = toon({ color: '#8a8f96' }), elephDk = toon({ color: '#6a6f76' }), ivory = toon({ color: '#e8ddc4' });
  elephG = new THREE.Group(); g.add(elephG);
  const ebody = add(new THREE.SphereGeometry(1.0, 14, 10), elephMat, 0, 1.55, 0, elephG, { cast: false }); ebody.scale.set(1.5, 1.05, 0.95);
  add(new THREE.SphereGeometry(0.62, 12, 10), elephMat, 1.35, 1.85, 0, elephG, { cast: false });
  for (const ez of [-0.5, 0.5]) {
    const ear = add(new THREE.SphereGeometry(0.45, 10, 8), elephDk, 1.05, 1.95, ez, elephG, { cast: false });
    ear.scale.set(0.3, 1, 0.9);
  }
  for (const [lx, lz] of [[0.75, 0.45], [0.75, -0.45], [-0.75, 0.45], [-0.75, -0.45]])
    add(new THREE.CylinderGeometry(0.22, 0.24, 1.1, 8), elephDk, lx, 0.55, lz, elephG, { cast: false });
  trunkG = new THREE.Group(); trunkG.position.set(1.85, 1.9, 0); elephG.add(trunkG);
  const t1 = add(new THREE.CylinderGeometry(0.17, 0.15, 0.6, 8), elephMat, 0.15, -0.25, 0, trunkG, { cast: false }); t1.rotation.z = 0.25;
  const t2 = add(new THREE.CylinderGeometry(0.15, 0.12, 0.55, 8), elephMat, 0.35, -0.7, 0, trunkG, { cast: false }); t2.rotation.z = 0.45;
  const t3 = add(new THREE.CylinderGeometry(0.12, 0.09, 0.5, 8), elephMat, 0.5, -1.1, 0, trunkG, { cast: false }); t3.rotation.z = 0.15;
  for (const tz of [-0.28, 0.28]) {
    const tusk = add(new THREE.ConeGeometry(0.07, 0.4, 8), ivory, 1.85, 1.5, tz, elephG, { cast: false });
    tusk.rotation.z = -Math.PI / 2;
  }
  const tail = add(new THREE.CylinderGeometry(0.05, 0.03, 0.7, 6), elephDk, -1.5, 1.3, 0, elephG, { cast: false }); tail.rotation.z = 0.3;
  for (const ez of [-0.58, 0.58]) add(new THREE.SphereGeometry(0.06, 6, 5), MAT.dark, 1.62, 2.0, ez, elephG, { cast: false });
  // ---- stone pile on the bank (appears when the boy calls for stones) ----
  pileG = new THREE.Group(); pileG.position.set(12.0, 0, 0.8); pileG.visible = false; g.add(pileG);
  const pileXZ = [[0, 0, 0.26], [0.45, 0.1, 0.22], [-0.4, 0.15, 0.2], [0.15, -0.35, 0.2], [-0.2, -0.3, 0.18], [0.3, 0.35, 0.18], [-0.5, -0.2, 0.16], [0.05, 0.05, 0.24]];
  for (const [px, pz, pr] of pileXZ) add(new THREE.SphereGeometry(pr, 10, 8), stoneMat, px, pr, pz, pileG, { cast: false });
  // ripple rings on the water around the boat
  const ripMat = () => new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0, fog: true, side: THREE.DoubleSide });
  ripple1 = add(new THREE.RingGeometry(1.6, 1.72, 28), ripMat(), wx, 0.04, wz, g, { cast: false });
  ripple1.rotation.x = -Math.PI / 2; ripple1.userData.ndSkip = true;
  ripple2 = add(new THREE.RingGeometry(1.6, 1.72, 28), ripMat(), wx, 0.04, wz, g, { cast: false });
  ripple2.rotation.x = -Math.PI / 2; ripple2.userData.ndSkip = true;
  // board frame behind the river (holds the title / payoff boards)
  for (const px of [-1.9, 1.9]) add(new THREE.CylinderGeometry(0.06, 0.07, 4.5, 7), MAT.woodDk, wx + px, 2.25, -3.4, g, { cast: false });
  add(tbox(4.1, 0.12, 0.12, 2), MAT.woodDk, wx, 4.35, -3.4, g, { cast: false });
}
// ================= DISTANT GROVE (x=+32 backdrop) =================
{
  const g = world;
  for (const [tx, tz, s] of [[30, -8, 1.3], [34, -6, 1.1], [32, -12, 1.4], [27, -5, 0.9]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
  for (const [hx, hz, ry] of [[29, -13, 0.2], [35, -12, -0.3]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
}
// ---- the bag of gold (appears at the minister's feet in the gold beat) ----
let goldBag;
{
  const g = new THREE.Group(); g.position.set(GOLDBAG[0], 0, GOLDBAG[2]); world.add(g); goldBag = g;
  const sack = add(new THREE.SphereGeometry(0.34, 10, 8), MAT.sack, 0, 0.24, 0, g, { cast: false }); sack.scale.y = 0.78;
  add(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 8), MAT.sackDk, 0, 0.52, 0, g, { cast: false });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), MAT.goldBright, Math.cos(a) * 0.42, 0.03, Math.sin(a) * 0.42, g, { cast: false });
  }
  const glint = FX.glint(0.18); glint.position.set(0.14, 0.42, 0.26); glint.userData.ndSkip = true; g.add(glint);
  g.scale.setScalar(0.001);
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
// NOTE: the longest line of each board is space-padded — textBoard's font
// size derives from the longest line, and this Chromium's fallback font
// advances ~0.66em per cap, wider than the formula assumes; unpadded, the
// longest line bled off the canvas edges (seen in stills review).
const boardTitle = textBoard([' THE BOY WHO WEIGHED ', 'THE ELEPHANT'], 3.4, 1.1, '#1a2340', '#ffe9a8'); boardTitle.position.set(16, 3.6, -3.4); world.add(boardTitle);
const boardPayoff = textBoard(['2000 KILOS'], 3.4, 1.1, '#1a2a3a', '#ffd76a'); boardPayoff.position.set(16, 3.6, -3.4); world.add(boardPayoff);   // same frame as the title board — above the elephant/characters, never occluded
// hook board: the palace wall's top beam (y 5.05, front face z -3.10) overlaps
// the board's top strip (board top y 5.00 at z -3.12) and shaved line 1's glyph
// tops in stills review — so its text block is shrunk slightly, tightened and
// shifted down inside the board (fit params; other boards use the default fit).
const boardHook = textBoard([' HOW DO YOU SELL ', 'ONE GOAT', 'TWO TIMES?'], 3.4, 1.7, '#2e1a3a', '#ffd76a', 900, { fsMul: 0.88, pitch: 0.295, dy: 0.028 }); boardHook.position.set(0, 4.15, -3.12); world.add(boardHook);

// ---------- crows (3D birds: black body, head, beak, tail, flapping wings) ----------
const crowMat = MAT.crow, beakMat = MAT.crowBeak;
const mkCrow = (withWings) => {
  const grp = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.16, 10, 8), crowMat, 0, 0, 0, grp, { cast: false }); body.scale.set(1, 0.85, 1.5);
  add(new THREE.SphereGeometry(0.09, 8, 6), crowMat, 0, 0.1, 0.2, grp, { cast: false });
  const beak = add(new THREE.ConeGeometry(0.035, 0.13, 6), beakMat, 0, 0.09, 0.32, grp, { cast: false }); beak.rotation.x = Math.PI / 2;
  const tail = add(box(0.09, 0.02, 0.24), crowMat, 0, 0.03, -0.26, grp, { cast: false }); tail.rotation.x = -0.18;
  let wingL = null, wingR = null;
  if (withWings) {
    wingL = new THREE.Group(); wingL.position.set(-0.1, 0.05, 0); grp.add(wingL);
    const wl = add(box(0.34, 0.015, 0.16), crowMat, -0.17, 0, 0, wingL, { cast: false });
    wingR = new THREE.Group(); wingR.position.set(0.1, 0.05, 0); grp.add(wingR);
    const wr = add(box(0.34, 0.015, 0.16), crowMat, 0.17, 0, 0, wingR, { cast: false });
  }
  return { grp, wingL, wingR };
};
const perchedCrows = PERCHED.map(([x, y, z, yaw]) => {
  const c = mkCrow(false); c.grp.position.set(x, y, z); c.grp.rotation.y = yaw; c.grp.scale.setScalar(1.15); world.add(c.grp); return c;
});
const flyingCrows = Array.from({ length: 7 }, () => {
  const c = mkCrow(true); c.grp.scale.setScalar(1.35); world.add(c.grp); return c;
});

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-16, 1.6, -5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardPayoff, Ws.boardPayoff || 0); setB(boardHook, Ws.boardHook || 0);
  const gk = Ws.payK || 0;
  goldBag.scale.setScalar(Math.max(0.001, gk));
  goldBag.visible = gk > 0.01;
  // boat ride + elephant + stones + chalk — contact-checked in story.js
  const by = Ws.boatY ?? 0.25;
  boatG.position.y = by;
  boatG.rotation.z = Math.sin(f * 0.03) * 0.004;   // gentle water bob, never drifting
  elephG.position.set(Ws.elephX ?? 13.4, Ws.elephY ?? 0, Ws.elephZ ?? -1.0);
  trunkG.rotation.z = Math.sin(f * 0.05) * 0.06;
  const ck = Ws.chalkK || 0;
  chalkMark.visible = ck > 0.01;
  chalkMark.scale.x = Math.max(0.001, ck);
  for (let i = 0; i < 6; i++) {
    const sm = boatStones[i], k = Ws['stone' + i] || 0;
    sm.visible = k > 0.01;
    sm.scale.setScalar(Math.max(0.001, k));
    sm.position.y = 0.355 + 0.18 * k;   // stone settles ON the deck as it appears
  }
  const pk = Ws.pileK || 0;
  pileG.visible = pk > 0.01;
  pileG.scale.setScalar(Math.max(0.001, pk));
  // ripples expand and fade around the boat when the elephant boards / leaves
  const setRip = (mesh, k) => {
    mesh.visible = k > 0.005 && k < 0.995;
    mesh.material.opacity = (1 - k) * 0.55;
    const s = 0.25 + k * 1.05; mesh.scale.set(s, s, s);
  };
  setRip(ripple1, Ws.rippleK || 0); setRip(ripple2, Ws.rippleK ? Math.max(0, Ws.rippleK - 0.15) : 0);
  // flying crows from the story's flight plan
  const flies = flyCrowsAt(f);
  flies.forEach((c, i) => {
    const m = flyingCrows[i];
    m.grp.position.set(c.p[0], c.p[1], c.p[2]);
    m.grp.rotation.y = c.yaw;
    const flap = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(c.flap));
    if (m.wingL) m.wingL.rotation.z = flap;
    if (m.wingR) m.wingR.rotation.z = -flap;
  });
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
