import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, splashAt, POT, SIGNP } from './story.js';

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
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
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
  copper: toon({ color: '#b87333' }), copperDk: toon({ color: '#8a5a24' }), copperBright: toon({ color: '#d99a55' }),
  iron: toon({ color: '#3f444a' }), ironDk: toon({ color: '#2b2f33' }),
  white: toon({ color: '#f7f3e6' }),
  cushion: toon({ color: '#8c2432' }),
  canopy: toon({ color: '#b03a5a' }), canopyGold: toon({ color: '#e8c45a' }),
  dark: toon({ color: '#33302c' }),
  stoneGrey: toon({ color: '#98928a' }), stoneLite: toon({ color: '#b5afa6' }),
  onion: toon({ color: '#e9d9ec' }), onionDk: toon({ color: '#c9a8cc' }),
  carrot: toon({ color: '#e8862a' }), green: toon({ color: '#5d9a3a' }),
  potato: toon({ color: '#a9825a' }),
  hen: toon({ color: '#f7f3e6' }),
  bowlWood: toon({ color: '#7a4b2a' }),
  salt: toon({ color: '#ffffff' }),
  shadowSoft: new THREE.MeshBasicMaterial({ color: 0x1a2410, transparent: true, opacity: 0.32, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(340, 240), MAT.grass, 0, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(90, 7), MAT.dirt, 0, -0.012, 3.4, g, { cast: false }));       // the village road
  flat(add(new THREE.CircleGeometry(11, 26), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));      // the village square (chauk)
  flat(add(new THREE.CircleGeometry(5.5, 18), MAT.dirt, -16, -0.008, -2, g, { cast: false }));     // door A ground
  flat(add(new THREE.CircleGeometry(5.5, 18), MAT.dirt, 16, -0.008, -2, g, { cast: false }));      // door B ground
  flat(add(new THREE.CircleGeometry(6, 18), MAT.dirt, 32, -0.008, -2, g, { cast: false }));        // court ground
  // distant huts + trees (depth for the east/west flights)
  for (const [hx, hz, ry] of [[-9, -14, 0.2], [10, -15, -0.3], [22, -13, 0.4], [-26, -13, 0.1], [-42, -12, -0.4], [44, -13, 0.3]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-12, -10, 1], [13.5, -11, 1.2], [24, -10, 0.9], [-25, -11, 1.1]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ---- pot builder: squashed sphere body + neck + rim + side handles ----
const makePot = (r, mat, matDk) => {
  const g = new THREE.Group();
  const body = add(new THREE.SphereGeometry(r, 18, 12), mat, 0, r * 0.72, 0, g); body.scale.y = 0.82;
  add(new THREE.CylinderGeometry(r * 0.52, r * 0.68, r * 0.3, 14), mat, 0, r * 1.42, 0, g);
  const rim = add(new THREE.TorusGeometry(r * 0.54, r * 0.07, 8, 18), matDk, 0, r * 1.56, 0, g); rim.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const h = add(new THREE.TorusGeometry(r * 0.26, r * 0.05, 8, 14, Math.PI), matDk, s * r * 0.92, r * 0.9, 0, g);
    h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  return g;
};
// ================= THE VILLAGE SQUARE (x=0) =================
let cauldron, soupDisc, stoneMesh, onion1, onion2, carrotG, potatoG, beanG, chickenM, saltStream, pourStream, ladleG;
const SOUP_Y = 1.30;   // liquid surface height inside the cauldron (world)
{
  const g = world;
  // long facade behind the square (two houses), thatch roof
  add(tbox(13.5, 3.1, 0.35, 2), MAT.plaster, 0, 1.55, -4.9, g, { cast: false });
  const roof = add(tbox(14.2, 0.14, 5.4, 2), MAT.thatch, 0, 3.35, -3.1, g, { cast: false }); roof.rotation.x = 0.1;
  add(tbox(1.2, 2.0, 0.1, 2), MAT.dark, -3.4, 1.0, -4.7, g, { cast: false });   // door L
  add(tbox(1.2, 2.0, 0.1, 2), MAT.dark, 3.4, 1.0, -4.7, g, { cast: false });    // door R
  add(tbox(0.9, 0.9, 0.1, 2), MAT.dark, -0.2, 1.9, -4.7, g, { cast: false });   // window C
  add(tbox(0.9, 0.9, 0.1, 2), MAT.dark, -5.6, 1.8, -4.7, g, { cast: false });   // window L
  add(tbox(0.9, 0.9, 0.1, 2), MAT.dark, 5.6, 1.8, -4.7, g, { cast: false });    // window R
  // tree east of the square + crates/barrels west
  add(new THREE.CylinderGeometry(0.3, 0.44, 2.8, 8), MAT.woodDk, 6.8, 1.4, -3.4, g, { cast: false });
  const can = add(new THREE.SphereGeometry(2.2, 10, 8), MAT.leaf, 6.8, 3.7, -3.4, g, { cast: false }); can.scale.y = 0.72; can.userData.ndSkip = true;
  const c1 = FX.crate(1.15); c1.position.set(-5.8, 0.55, 0.4); g.add(c1);
  const c2 = FX.crate(0.95); c2.position.set(-5.65, 1.55, 0.45); c2.rotation.y = 0.4; g.add(c2);
  const b1 = FX.barrel(0.52, 1.25); b1.position.set(-4.6, 0.62, 0.2); g.add(b1);
  // ---- the fire pit: 3 hearth stones + logs, cauldron resting ON the stones ----
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.5;
    const st = add(new THREE.SphereGeometry(0.30, 10, 8), MAT.stoneDk, POT[0] + Math.cos(a) * 0.58, 0.13, POT[2] + Math.sin(a) * 0.58, g);
    st.scale.y = 0.75;
  }
  for (let i = 0; i < 3; i++) {
    const log = add(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 7), MAT.woodDk, POT[0], 0.10, POT[2], g, { cast: false });
    log.rotation.z = Math.PI / 2; log.rotation.y = i * Math.PI / 3;
  }
  flat(add(new THREE.CircleGeometry(1.25, 20), MAT.shadowSoft, POT[0], 0.012, POT[2], g, { cast: false }));
  // THE cauldron — big iron pot, group origin at its base, resting on the stones
  cauldron = makePot(0.8, MAT.iron, MAT.ironDk); cauldron.position.set(POT[0], 0.30, POT[2]); g.add(cauldron);
  // the liquid surface (water first, rich soup later — colour driven by soupK)
  soupDisc = flat(add(new THREE.CircleGeometry(0.52, 20), new THREE.MeshToonMaterial({ gradientMap: grad, color: '#7fa8bd' }), POT[0], SOUP_Y, POT[2], g, { cast: false }));
  soupDisc.visible = false;
  // ---- the smooth stone (3D twin for the drop + the fish-out) ----
  stoneMesh = add(new THREE.SphereGeometry(0.17, 14, 10), MAT.stoneGrey, 0, -99, 0, g);
  stoneMesh.scale.set(1, 0.78, 0.9); stoneMesh.visible = false;
  const sheen = add(new THREE.SphereGeometry(0.09, 10, 8), MAT.stoneLite, -0.05, 0.07, 0.03, stoneMesh, { cast: false }); sheen.scale.set(1, 0.5, 0.8);
  // ---- ingredient drop meshes (appear at the hand-off, fall INTO the pot) ----
  onion1 = add(new THREE.SphereGeometry(0.105, 12, 10), MAT.onion, 0, -99, 0, g); onion1.visible = false;
  onion2 = add(new THREE.SphereGeometry(0.105, 12, 10), MAT.onionDk, 0, -99, 0, g); onion2.visible = false;
  carrotG = new THREE.Group(); g.add(carrotG);
  for (const dx of [-0.09, 0, 0.09]) {
    const c = add(new THREE.ConeGeometry(0.05, 0.34, 9), MAT.carrot, dx, 0, 0, carrotG); c.rotation.x = Math.PI; // tip down
    add(new THREE.SphereGeometry(0.045, 8, 6), MAT.green, dx, 0.20, 0, carrotG, { cast: false });
  }
  carrotG.visible = false;
  potatoG = new THREE.Group(); g.add(potatoG);
  for (const [dx, dz] of [[-0.10, 0.02], [0.09, -0.03], [0, 0.10]]) {
    const p = add(new THREE.SphereGeometry(0.10, 10, 8), MAT.potato, dx, 0, dz, potatoG); p.scale.y = 0.85;
  }
  potatoG.visible = false;
  beanG = new THREE.Group(); g.add(beanG);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const b = add(new THREE.SphereGeometry(0.045, 8, 6), MAT.green, Math.cos(a) * 0.09, (i % 3) * 0.05, Math.sin(a) * 0.09, beanG, { cast: false });
    b.scale.set(1, 1.9, 1);
  }
  beanG.visible = false;
  // the chicken (plucked, ready for the pot): body + neck + drumsticks
  chickenM = new THREE.Group(); g.add(chickenM);
  const cbody = add(new THREE.SphereGeometry(0.21, 12, 10), MAT.hen, 0, 0, 0, chickenM); cbody.scale.set(1, 0.9, 1.25);
  add(new THREE.SphereGeometry(0.09, 10, 8), MAT.hen, 0, 0.10, 0.24, chickenM, { cast: false });
  for (const s of [-1, 1]) {
    const leg = add(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 7), MAT.hen, s * 0.10, -0.05, -0.22, chickenM, { cast: false });
    leg.rotation.x = 0.9;
    add(new THREE.SphereGeometry(0.045, 8, 6), MAT.white, s * 0.10, -0.10, -0.33, chickenM, { cast: false });
  }
  chickenM.visible = false;
  // salt pour stream (thin white fall of salt from the tipped bowl)
  saltStream = add(new THREE.CylinderGeometry(0.012, 0.02, 1, 7), MAT.salt, 0, -99, 0, g, { cast: false });
  saltStream.visible = false;
  // water pour stream (bucket -> pot, setup shot)
  pourStream = add(new THREE.CylinderGeometry(0.03, 0.045, 1, 8), toon({ color: '#a8dcf5' }), 0, -99, 0, g, { cast: false });
  pourStream.visible = false;
  // the ladle: long handle + brass cup, pivot at the handle's top end
  ladleG = new THREE.Group(); g.add(ladleG);
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 7), MAT.wood, 0, -0.575, 0, ladleG, { cast: false });
  const cup = add(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MAT.gold, 0, -1.15, 0, ladleG, { cast: false });
  cup.rotation.x = Math.PI;
  ladleG.visible = false;
  // feast bowls resting on the ground (contact shadows beneath)
  for (const [bx, bz] of [[-2.3, 0.6], [2.4, 0.7], [0.4, 1.9]]) {
    const bw = add(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MAT.bowlWood, bx, 0.17, bz, g, { cast: false });
    bw.rotation.x = Math.PI;
    flat(add(new THREE.CircleGeometry(0.15, 14), MAT.shadowSoft, bx, 0.013, bz, g, { cast: false }));
  }
}
// ================= DOOR HOUSES (wander beats, x=-16 / x=+16) =================
for (const hx of [-16, 16]) {
  const g = world;
  add(tbox(7.5, 3.1, 0.35, 2), MAT.plaster, hx, 1.55, -3.7, g, { cast: false });
  const roof = add(tbox(8.2, 0.14, 5.2, 2), MAT.thatch, hx, 3.35, -1.7, g, { cast: false }); roof.rotation.x = 0.1;
  add(tbox(1.2, 2.0, 0.1, 2), MAT.dark, hx, 1.0, -3.5, g, { cast: false });        // the door that stays shut
  add(tbox(2.2, 0.16, 0.9, 2), MAT.stone, hx, 0.08, -3.1, g, { cast: false });      // doorstep
  add(tbox(0.9, 0.9, 0.1, 2), MAT.dark, hx + 2.2, 1.8, -3.5, g, { cast: false });    // window
  const hp = makePot(0.3, MAT.copper, MAT.copperDk); hp.position.set(hx + 1.9, 0, -0.7); g.add(hp);
}
// ================= THE KING'S COURT (hook, x=+32) =================
{
  const g = world, cx = 32;
  add(tbox(9, 4.5, 0.4, 2), MAT.stoneDk, cx, 2.25, -7.0, g, { cast: false });
  add(tbox(9.8, 0.5, 1.1, 2), MAT.stone, cx, 4.7, -7.0, g, { cast: false });
  for (const px of [28.5, 35.5]) add(new THREE.CylinderGeometry(0.32, 0.38, 6.4, 10), MAT.stoneDk, px, 3.2, -5.5, g, { cast: false });
  add(tbox(6, 0.15, 3.5, 2), MAT.canopy, cx, 3.6, -5.0, g, { cast: false });
  for (const px of [29.5, 34.5]) add(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), MAT.woodDk, px, 1.8, -4.0, g, { cast: false });
  // the throne bench: seat + back + red cushion
  add(tbox(3.2, 0.5, 1.0, 2), MAT.woodDk, cx, 0.9, -4.6, g, { cast: false });
  add(tbox(3.2, 1.0, 0.15, 2), MAT.woodDk, cx, 1.6, -5.05, g, { cast: false });
  add(tbox(3.0, 0.12, 0.9, 2), MAT.cushion, cx, 1.2, -4.6, g, { cast: false });
  add(tbox(4.6, 0.22, 1.4, 2), MAT.stone, cx, 0.11, -4.2, g, { cast: false });   // dais step
  add(tbox(5.4, 0.22, 1.4, 2), MAT.stoneDk, cx, 0.11, -2.9, g, { cast: false }); // lower step
  // the chess table between farmer and king: board + ONE grain of rice
  add(tbox(1.5, 0.08, 1.1, 2), MAT.wood, cx - 1.5, 0.78, -3.3, g, { cast: false });
  for (const [lx, lz] of [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]]) add(box(0.09, 0.76, 0.09), MAT.woodDk, cx - 1.5 + lx, 0.38, -3.3 + lz, g, { cast: false });
  const chkC = document.createElement('canvas'); chkC.width = chkC.height = 256;
  const cg = chkC.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { cg.fillStyle = (i + j) % 2 ? '#5a3a22' : '#e8dcc0'; cg.fillRect(i * 32, j * 32, 32, 32); }
  const chkT = new THREE.CanvasTexture(chkC); chkT.colorSpace = THREE.SRGBColorSpace;
  const board = add(new THREE.BoxGeometry(0.92, 0.05, 0.92), new THREE.MeshToonMaterial({ gradientMap: grad, map: chkT }), cx - 1.5, 0.85, -3.3, g, { cast: false });
  board.rotation.y = 0.12;
  const grain = add(new THREE.SphereGeometry(0.028, 8, 6), MAT.white, cx - 1.86, 0.90, -3.62, g, { cast: false });
  grain.scale.set(1, 0.7, 1.8);
  // a sack of rice beside the table (it will NOT be enough)
  const sack = add(new THREE.SphereGeometry(0.34, 10, 8), toon({ color: '#c9a24d' }), cx - 2.6, 0.26, -2.9, g, { cast: false });
  sack.scale.y = 0.85;
  // signpost for the hook board
  add(box(0.12, 3.4, 0.12), MAT.woodDk, 30.7, 1.7, -2.0, g, { cast: false });
  add(box(0.12, 3.4, 0.12), MAT.woodDk, 33.3, 1.7, -2.0, g, { cast: false });
  add(tbox(2.9, 0.14, 0.14, 2), MAT.woodDk, 32, 2.2, -2.0, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['पत्थर का सूप!'], 2.6, 0.95, '#7a3b12', '#ffd76a'); boardTitle.position.set(0, 4.35, -4.55); world.add(boardTitle);
const boardFeast = textBoard(['सब कुछ सिर्फ़', 'एक पत्थर से!'], 2.8, 1.1, '#7a3b12', '#ffd76a'); boardFeast.position.set(0, 4.35, -4.55); world.add(boardFeast);
const boardWorks = textBoard(['यह हर बार', 'काम करता है!'], 2.6, 1.1, '#2e4a2e', '#ffe9a8'); boardWorks.position.set(0, 4.35, -4.55); world.add(boardWorks);
const boardHook = textBoard(['एक चावल का दाना…', 'पूरा भंडार ख़ाली?'], 2.9, 1.1, '#2e4a2e', '#ffe9a8'); boardHook.position.set(SIGNP[0], SIGNP[1], SIGNP[2]); world.add(boardHook);
// ND occluders behind the text boards: invisible in the colour pass (colorWrite
// off), but present in the normal-depth pass so backdrop edges behind a board
// cannot ghost through its text. Each is sized EXACTLY as its board and sits
// 0.12 behind it, so its ND silhouette projects a hair inside the board's rim
// and the ink edge it generates lands on the board's own face. Visibility is
// toggled with its board in worldState — an always-on occluder would ink a
// floating rectangle whenever its board is off.
const mkOcc = (b, w, h) => {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  o.position.copy(b.position); o.position.z -= 0.12; o.visible = false; world.add(o); return o;
};
const occTitle = mkOcc(boardTitle, 2.6, 0.95);
const occFeast = mkOcc(boardFeast, 2.8, 1.1);
const occWorks = mkOcc(boardWorks, 2.6, 1.1);
const occHook = mkOcc(boardHook, 2.9, 1.1);

// ---------- FX: haze + steam + fire + splashes ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const steamEmit = smoke.addEmitter(POT[0], 2.1, POT[2], { rate: 0, color: 0xffffff, opacity: 0.13, scale: 0.55, grow: 1.5, life: 1.6, vy: 0.55, wind: 0.1 });
const dustEmit = smoke.addEmitter(-16, 1.6, -3.5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
const fire = new FX.Fire(scene, { x: POT[0], y: 0.16, z: POT[2], scale: 0.55, rate: 0 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const splashes = new FX.Splashes(scene, 300); splashes.points.userData.ndSkip = true;
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fire.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire.acc = 0;
  splashes.life.fill(-1);
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate; steamEmit.rate = pr.steamRate || 0;
    fire.rate = pr.fireRate || 0;
    for (const s of splashAt(fxF)) splashes.burst(s[0], s[1], s[2], { n: s[3] || 26, power: s[4] || 4 });
    smoke.update(t, dt);
    fire.update(t, dt);
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
const SOUP_WATER = new THREE.Color('#7fa8bd'), SOUP_RICH = new THREE.Color('#c97a2e'), SOUP_TMP = new THREE.Color();
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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardFeast, Ws.boardFeast || 0); setB(boardWorks, Ws.boardWorks || 0); setB(boardHook, Ws.boardHook || 0);
  occTitle.visible = boardTitle.visible; occFeast.visible = boardFeast.visible; occWorks.visible = boardWorks.visible; occHook.visible = boardHook.visible;
  // liquid: visible once water is poured; colour deepens into soup with soupK
  soupDisc.visible = (Ws.waterK || 0) > 0.01;
  if (soupDisc.visible) { SOUP_TMP.lerpColors(SOUP_WATER, SOUP_RICH, Ws.soupK || 0); soupDisc.material.color.copy(SOUP_TMP); }
  const put = (mesh, P, V) => { mesh.visible = !!V; if (V) mesh.position.set(P[0], P[1], P[2]); };
  put(stoneMesh, Ws.stoneP, Ws.stoneV); put(onion1, Ws.on1P, Ws.on1V); put(onion2, Ws.on2P, Ws.on2V);
  put(carrotG, Ws.carP, Ws.carV); put(potatoG, Ws.tatP, Ws.tatV); put(beanG, Ws.beanP, Ws.beanV);
  put(chickenM, Ws.chkP, Ws.chkV); if (Ws.chkV) chickenM.rotation.z = Ws.chkRz || 0;
  put(ladleG, Ws.ladP, Ws.ladV); if (Ws.ladV) ladleG.rotation.set(Ws.ladR[0], Ws.ladR[1], Ws.ladR[2]);
  // pour streams: unit cylinders stretched between two points
  const stream = (mesh, k, x0, y0, z0, x1, y1, z1) => {
    if (!(k > 0.01)) { mesh.visible = false; return; }
    mesh.visible = true;
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.scale.set(1, len, 1);
    mesh.rotation.z = Math.atan2(x1 - x0, y0 - y1);
    mesh.rotation.x = Math.atan2(z0 - z1, y0 - y1);
  };
  stream(pourStream, Ws.pourK || 0, -1.05, 1.29, POT[2] + 0.13, POT[0] - 0.05, SOUP_Y + 0.04, POT[2] + 0.2);
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
