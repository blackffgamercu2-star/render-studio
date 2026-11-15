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
// ================= THE MOON WELL (x=+16) =================
let moonDisc, moonGlow;
{
  const g = world, wx = WELL[0], wz = WELL[2];
  // stone well: open cylinder + rim + dark water
  const wall = add(new THREE.CylinderGeometry(0.95, 1.05, 1.1, 14, 1, true), MAT.stone, wx, 0.55, wz, g, { cast: false });
  wall.material = MAT.stone;
  add(new THREE.TorusGeometry(0.98, 0.09, 8, 18), MAT.stoneDk, wx, 1.1, wz, g, { cast: false }).rotation.x = Math.PI / 2;
  const water = add(new THREE.CircleGeometry(0.88, 18), new THREE.MeshBasicMaterial({ color: 0x1a2438, transparent: false, opacity: 1, fog: true }), wx, 0.62, wz, g, { cast: false });
  water.rotation.x = -Math.PI / 2; water.userData.ndSkip = true;
  moonDisc = add(new THREE.CircleGeometry(0.6, 24), MAT.moonDisc, wx, 0.64, wz, g, { cast: false });
  moonDisc.rotation.x = -Math.PI / 2; moonDisc.userData.ndSkip = true;
  moonGlow = softGlow(2.6, 0xdfe8ff, 0); moonGlow.position.set(wx, 1.6, wz); g.add(moonGlow);
  // wooden A-frame + little roof + rope + bucket
  for (const px of [-0.95, 0.95]) {
    const post = add(new THREE.CylinderGeometry(0.07, 0.08, 2.2, 7), MAT.woodDk, wx + px, 1.1, wz, g, { cast: false });
    post.rotation.z = px > 0 ? -0.18 : 0.18;
  }
  add(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 7), MAT.woodDk, wx, 2.25, wz, g, { cast: false }).rotation.z = Math.PI / 2;
  const roofL = add(tbox(1.5, 0.08, 1.3, 2), MAT.thatch, wx - 0.62, 2.62, wz, g, { cast: false }); roofL.rotation.z = 0.42;
  const roofR = add(tbox(1.5, 0.08, 1.3, 2), MAT.thatch, wx + 0.62, 2.62, wz, g, { cast: false }); roofR.rotation.z = -0.42;
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), MAT.woodDk, wx, 1.95, wz, g, { cast: false });
  add(tbox(0.3, 0.28, 0.3, 2), MAT.wood, wx, 1.6, wz, g, { cast: false });   // bucket hangs above the rim — never blocks the moon
  // hook-board frame behind the well (holds boardMoon) — top beam clears the board
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
  const glint = FX.glint(0.35); glint.position.set(0, 0.6, 0.2); glint.userData.ndSkip = true; g.add(glint);
  g.scale.setScalar(0.001);
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardCrows = textBoard(['HOW MANY', 'CROWS?'], 3.2, 1.1, '#2e1a3a', '#ffd76a'); boardCrows.position.set(0, 4.3, -3.12); world.add(boardCrows);
const boardNumber = textBoard(['95,463 CROWS'], 2.8, 0.8, '#1f2a44', '#ffd76a'); boardNumber.position.set(0.6, 4.3, -3.12); world.add(boardNumber);
const boardMoon = textBoard(['THE MAN WHO SOLD', 'THE MOON'], 3.4, 1.0, '#1a2340', '#ffe9a8'); boardMoon.position.set(16, 3.6, -3.4); world.add(boardMoon);

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
  setB(boardCrows, Ws.boardCrows || 0); setB(boardNumber, Ws.boardNumber || 0); setB(boardMoon, Ws.boardMoon || 0);
  const gk = Ws.goldK || 0;
  goldBag.scale.setScalar(Math.max(0.001, gk));
  goldBag.visible = gk > 0.01;
  const mk = Ws.moonK || 0;
  MAT.moonDisc.opacity = mk;
  moonDisc.visible = mk > 0.01;
  moonGlow.material.opacity = mk * 0.22;
  moonGlow.visible = mk > 0.01;
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
