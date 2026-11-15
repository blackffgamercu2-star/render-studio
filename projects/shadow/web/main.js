import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, donkeyPosAt, donkeyYawAt, donkeyWalkAt, COINSHADOW, SCALE } from './story.js';

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
// the forged order: parchment letter WITH the king's red wax seal
const letterBoard = (lines, w, h) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = '#e8d9ae'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#4a2c14'; g.lineWidth = 12; g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.fillStyle = '#4a2c14'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `900 ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (i + 0.5) / lines.length));
  const sx = c.width * 0.87, sy = c.height * 0.115, sr = c.height * 0.065;   // wax seal, top-right clear of the text
  g.fillStyle = '#b3392e'; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  g.strokeStyle = '#7e271e'; g.lineWidth = 6; g.beginPath(); g.arc(sx, sy, sr * 0.62, 0, 7); g.stroke();
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
  white: toon({ color: '#f7f3e6' }),
  cushion: toon({ color: '#8c2432' }),
  dark: toon({ color: '#33302c' }),
  donkey: toon({ color: '#8a7a68' }), donkeyDk: toon({ color: '#6e5f4e' }), donkeyBelly: toon({ color: '#a89880' }),
  mane: toon({ color: '#4a3a2a' }), saddleRed: toon({ color: '#8c2432' }), blanket: toon({ color: '#c9a24d' }),
  awnA: toon({ color: '#b3392e' }), awnB: toon({ color: '#f3e3bb' }),
  fruitO: toon({ color: '#d88a2e' }), fruitR: toon({ color: '#b3392e' }), fruitG: toon({ color: '#5d8142' }),
  catOrange: toon({ color: '#c98a4a' }), catCream: toon({ color: '#e8d9ae' }), catDk: toon({ color: '#8a5a2e' }),
  brass: toon({ color: '#c9a227' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(64, 7), MAT.dirt, 10, -0.012, 3.4, g, { cast: false }));       // the road (east)
  flat(add(new THREE.PlaneGeometry(16, 5), MAT.dirt, -10, -0.011, -1.5, g, { cast: false }));     // court approach (west)
  flat(add(new THREE.CircleGeometry(8.5, 22), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));      // market square
  // distant huts + trees
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [20, -12, 0.4], [26, -13, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= MARKET STALLS =================
const mkStall = (x, z, ry) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  for (const [px, pz] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 7), MAT.woodDk, px, 1.0, pz, g, { cast: false });
  for (let i = 0; i < 5; i++) add(tbox(0.52, 0.06, 1.8, 2), i % 2 ? MAT.awnA : MAT.awnB, -1.04 + i * 0.52, 2.05, 0, g, { cast: false });
  add(tbox(2.4, 0.9, 1.2, 2), MAT.wood, 0, 0.45, 0, g, { cast: false });
  // goods on the counter: fruit + pots
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.11, 9, 7), MAT.fruitO, -0.8 + i * 0.28, 0.98, -0.25, g, { cast: false });
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.1, 9, 7), MAT.fruitR, -0.5 + i * 0.3, 0.97, 0.28, g, { cast: false });
  add(new THREE.SphereGeometry(0.16, 9, 7), MAT.fruitG, 0.85, 1.02, 0.1, g, { cast: false });
  add(new THREE.CylinderGeometry(0.14, 0.11, 0.3, 10), MAT.sackDk, 0.55, 1.05, -0.3, g, { cast: false });
  return g;
};
mkStall(4.6, -2.6, 0.15);
mkStall(-4.8, -2.2, -0.2);
// ================= JUDGE'S COURT (x=-16) =================
{
  const g = world, cx = -16;
  flat(add(new THREE.PlaneGeometry(11, 9), MAT.stone, cx, -0.005, -5.4, g, { cast: false }));
  add(tbox(10.5, 4.2, 0.4, 2), MAT.stoneDk, cx, 2.1, -8.7, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx - 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx + 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(11, 0.35, 6.4, 2), MAT.woodDk, cx, 4.35, -6.2, g, { cast: false });
  const lampGlow = softGlow(1.9, 0xffc98a, 0.16); lampGlow.position.set(cx - 3.4, 2.3, -8.3); g.add(lampGlow);
  // the judge's bench + dais
  add(tbox(4.4, 0.3, 2.2, 2), MAT.stoneDk, cx, 0.15, -5.6, g, { cast: false });
  add(tbox(3.4, 0.12, 1.15, 2), MAT.wood, cx, 0.74, -5.0, g, { cast: false });
  for (const [lx, lz] of [[-1.5, -0.45], [1.5, -0.45], [-1.5, 0.45], [1.5, 0.45]]) add(box(0.12, 0.72, 0.12), MAT.woodDk, cx + lx, 0.36, -5.0 + lz, g, { cast: false });
  // scroll + seal on the bench
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), MAT.white, cx - 1.1, 0.84, -5.0, g, { cast: false }).rotation.z = Math.PI / 2;
  add(new THREE.SphereGeometry(0.09, 8, 6), MAT.cushion, cx + 1.15, 0.85, -5.0, g, { cast: false });
}
// ================= HOOK SIGNPOST (court, board at [-13.4,2.3,-3.0]) =================
{
  const g = world;
  for (const px of [-14.9, -11.9]) add(new THREE.CylinderGeometry(0.07, 0.08, 2.9, 8), MAT.woodDk, px, 1.45, -3.0, g, { cast: false });
  add(tbox(3.2, 0.12, 0.12, 2), MAT.woodDk, -13.4, 2.8, -3.0, g, { cast: false });
}
// ================= THE DONKEY (built facing +x) =================
let donkey, donkeyBody, legFL, legFR, legRL, legRR, tailMesh;
{
  donkey = new THREE.Group(); world.add(donkey);
  donkeyBody = new THREE.Group(); donkey.add(donkeyBody);
  const body = add(new THREE.SphereGeometry(0.55, 14, 10), MAT.donkey, 0, 0.95, 0, donkeyBody);
  body.scale.set(1.5, 0.95, 0.78);
  const belly = add(new THREE.SphereGeometry(0.5, 12, 8), MAT.donkeyBelly, 0, 0.82, 0, donkeyBody);
  belly.scale.set(1.35, 0.7, 0.68);
  // neck + head
  const neck = add(new THREE.CylinderGeometry(0.17, 0.22, 0.72, 10), MAT.donkey, 0.6, 1.28, 0, donkeyBody);
  neck.rotation.z = -0.55;
  const maneN = add(tbox(0.62, 0.09, 0.09, 2), MAT.mane, 0.5, 1.42, 0, donkeyBody);
  maneN.rotation.z = -0.55;
  const head = add(new THREE.SphereGeometry(0.28, 12, 10), MAT.donkey, 1.0, 1.55, 0, donkeyBody);
  head.scale.set(1.45, 0.8, 0.65);
  add(tbox(0.24, 0.16, 0.18, 2), MAT.donkeyDk, 1.28, 1.46, 0, donkeyBody);
  // long ears, seated on the head top (shorter + thicker than v1 — no stick look)
  for (const ez of [-0.11, 0.11]) {
    const ear = add(tbox(0.09, 0.3, 0.06, 2), MAT.donkeyDk, 0.95, 1.82, ez, donkeyBody);
    ear.rotation.z = -0.12; ear.rotation.x = ez > 0 ? -0.22 : 0.22;
    add(tbox(0.04, 0.22, 0.02, 2), MAT.donkeyBelly, 0.96, 1.81, ez * 1.15, donkeyBody);
  }
  // saddle blanket + traveller's bundle (FIX 2026-11-15: the bundle sat high
  // and round on the saddle and read as a floating yellow blob — sunk onto
  // the blanket and flattened so it reads as a strapped pack)
  add(tbox(0.75, 0.07, 0.85, 2), MAT.saddleRed, 0, 1.44, 0, donkeyBody);
  const bundle = add(new THREE.SphereGeometry(0.26, 10, 8), MAT.blanket, 0.05, 1.44, 0, donkeyBody);
  bundle.scale.set(1.15, 0.6, 0.85);
  // tail
  tailMesh = new THREE.Group(); tailMesh.position.set(-0.82, 1.0, 0); donkeyBody.add(tailMesh);
  const tt = add(new THREE.CylinderGeometry(0.035, 0.03, 0.55, 7), MAT.donkeyDk, -0.1, -0.26, 0, tailMesh);
  tt.rotation.z = 0.3;
  add(new THREE.SphereGeometry(0.09, 8, 6), MAT.mane, -0.19, -0.52, 0, tailMesh);
  // legs (pivot at hip; swing = rotation.z)
  const mkLeg = (lx, lz) => {
    const piv = new THREE.Group(); piv.position.set(lx, 0.85, lz); donkey.add(piv);
    add(new THREE.CylinderGeometry(0.075, 0.06, 0.8, 8), MAT.donkey, 0, -0.4, 0, piv);
    add(tbox(0.13, 0.09, 0.13, 2), MAT.donkeyDk, 0, -0.8, 0, piv);
    return piv;
  };
  legFL = mkLeg(0.55, 0.28); legFR = mkLeg(0.55, -0.28);
  legRL = mkLeg(-0.55, 0.28); legRR = mkLeg(-0.55, -0.28);
  // soft blob shadow under the donkey
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.25), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, depthWrite: false, fog: true }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.02, 0); blob.userData.ndSkip = true; donkey.add(blob);
}
// ================= BALANCE SCALE + CAT (hook shot, at SCALE) =================
let scaleBeam, scaleGroup;
{
  const g = new THREE.Group(); g.position.set(SCALE[0], 0, SCALE[2]); world.add(g); scaleGroup = g;
  add(new THREE.CylinderGeometry(0.4, 0.5, 0.12, 12), MAT.stoneDk, 0, 0.06, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.06, 1.15, 8), MAT.woodDk, 0, 0.65, 0, g, { cast: false });
  scaleBeam = new THREE.Group(); scaleBeam.position.set(0, 1.22, 0); g.add(scaleBeam);
  add(tbox(1.7, 0.07, 0.07, 2), MAT.woodDk, 0, 0, 0, scaleBeam, { cast: false });
  const mkPan = (sx) => {
    const pan = new THREE.Group(); pan.position.set(sx, -0.05, 0); scaleBeam.add(pan);
    for (const a of [0, 2.1, 4.2]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), MAT.steelDk, Math.cos(a) * 0.14, -0.21, Math.sin(a) * 0.14, pan, { cast: false });
    add(new THREE.CylinderGeometry(0.34, 0.26, 0.07, 14), MAT.brass, 0, -0.45, 0, pan, { cast: false });
    return pan;
  };
  const panL = mkPan(-0.72), panR = mkPan(0.72);
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10), MAT.brass, 0, -0.34, 0, panR, { cast: false });  // brass weight
  // THE CAT, sitting on the left pan
  const cat = new THREE.Group(); cat.position.set(-0.72, -0.42, 0); cat.rotation.y = 0.15; scaleBeam.add(cat);
  const cb = add(new THREE.SphereGeometry(0.2, 12, 10), MAT.catOrange, 0, 0.2, 0, cat); cb.scale.set(1, 1.15, 0.9);
  const chest = add(new THREE.SphereGeometry(0.13, 12, 10), MAT.catCream, 0, 0.14, 0.1, cat, { cast: false }); chest.scale.set(0.8, 1, 0.5);
  add(new THREE.SphereGeometry(0.15, 12, 10), MAT.catOrange, 0, 0.48, 0, cat);
  for (const ex of [-0.08, 0.08]) add(new THREE.ConeGeometry(0.05, 0.12, 6), MAT.catOrange, ex, 0.62, 0, cat, { cast: false });
  const ctail = add(new THREE.TorusGeometry(0.16, 0.035, 6, 12, Math.PI * 1.2), MAT.catOrange, 0.1, 0.06, 0.14, cat, { cast: false });
  ctail.rotation.x = Math.PI / 2 - 0.3; ctail.rotation.z = 0.4;
}
// ================= COIN-SHADOW DECAL (the judge's coin, held up in the sun) =================
let coinShadow;
{
  coinShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ map: P.tex(P.radialHard('10,8,12', 0.9)), transparent: true, opacity: 0, depthWrite: false, fog: true })); // hard-edged dark ellipse: the soft radial dissolved into the wood grain
  coinShadow.rotation.x = -Math.PI / 2; coinShadow.position.set(COINSHADOW[0], COINSHADOW[1], COINSHADOW[2]);
  coinShadow.userData.ndSkip = true; coinShadow.visible = false; world.add(coinShadow);
}

// ================= SUNBEAM + COIN GLINT (the judge's coin, held up in the sun) =================
// FIX 2026-11-15 (defect 2): the gag had no visible beam and no visible
// coin shadow. A crossed pair of soft gradient shafts rises from the raised
// coin toward the sun, plus a warm glint sprite on the coin itself; both
// fade in/out with the coin-shadow decal (worldAt coinShadow).
const beamTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 256, 0, 0); // bright at the coin (bottom), fading up toward the sun
  v.addColorStop(0, 'rgba(255,244,214,0.95)'); v.addColorStop(0.6, 'rgba(255,244,214,0.4)'); v.addColorStop(1, 'rgba(255,244,214,0)');
  g.fillStyle = v; g.fillRect(0, 0, 128, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.25, 'rgba(0,0,0,1)'); h.addColorStop(0.75, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h; g.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const beamGroup = new THREE.Group();
{
  const coinPos = new THREE.Vector3(-15.85, 1.78, -6.15); // the judge's raised hand (card +x, crown height)
  const beamDir = new THREE.Vector3(-0.604, 0.766, -0.220).normalize(); // toward the coinsun sun (az 200, el 50)
  const beamLen = 2.2; // ends just under the court roof (y 4.35)
  beamGroup.position.copy(coinPos).addScaledVector(beamDir, beamLen / 2);
  beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
  for (const rot of [0, Math.PI / 2]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, beamLen), beamMat);
    m.rotation.y = rot; // spin around the beam axis: crossed shafts, readable from any side
    m.userData.ndSkip = true;
    beamGroup.add(m);
  }
  beamGroup.visible = false;
  world.add(beamGroup);
}
const coinGlow = softGlow(1.0, 0xffd97a, 0.5);
coinGlow.position.set(-15.85, 1.78, -6.15);
coinGlow.userData.ndSkip = true;
coinGlow.visible = false;
world.add(coinGlow);

// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardHook = textBoard(['HOW CAN A CAT', 'PROVE A MAN GUILTY?'], 3.0, 0.85, '#2e3a5a', '#ffe9a8'); boardHook.position.set(-13.4, 2.3, -3.0); world.add(boardHook);

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
      e = max(e, smoothstep(.03, .08, (ds - d)/d));
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
  setB(boardHook, Ws.boardHook || 0);
  coinShadow.material.opacity = (Ws.coinShadow || 0) * 0.9; coinShadow.visible = (Ws.coinShadow || 0) > 0.01;
  const bs = Ws.coinShadow || 0;
  beamMat.opacity = bs * 0.45; beamGroup.visible = bs > 0.01;
  coinGlow.material.opacity = bs * 0.5; coinGlow.visible = bs > 0.01;
  scaleBeam.rotation.z = (Ws.scaleDip || 0) * 0.12;
  if (scaleGroup) scaleGroup.visible = (Ws.scale || 0) > 0.01;
  const dp = donkeyPosAt(f);
  donkey.position.set(dp[0], 0, dp[2]);
  donkey.rotation.y = donkeyYawAt(f);
  const wk = donkeyWalkAt(f);
  donkeyBody.position.y = wk.bob;
  const ph = wk.phase * Math.PI * 2;
  if (wk.moving) {
    legFL.rotation.z = Math.sin(ph) * 0.45; legRR.rotation.z = Math.sin(ph) * 0.45;
    legFR.rotation.z = Math.sin(ph + Math.PI) * 0.45; legRL.rotation.z = Math.sin(ph + Math.PI) * 0.45;
  } else { legFL.rotation.z = legFR.rotation.z = legRL.rotation.z = legRR.rotation.z = 0; }
  tailMesh.rotation.x = Math.sin(f * 0.12) * 0.12;
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
