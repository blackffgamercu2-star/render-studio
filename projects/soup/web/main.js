import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, dynAt, SPLASHES, POTC, SURF, BENCH, CHESS, SIGNP } from './story.js';

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

// ---------- text-board helper ----------
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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad2 = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad2.addColorStop(0, 'rgba(255,255,255,0.9)'); grad2.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad2.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad2; g.fillRect(0, 0, 64, 64);
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
  iron: toon({ color: '#4a4a50' }), ironDk: toon({ color: '#2e2e33' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  white: toon({ color: '#f7f3e6' }),
  cushion: toon({ color: '#8c2432' }),
  canopy: toon({ color: '#7a1f2b' }),
  dark: toon({ color: '#33302c' }),
  stoneGrey: toon({ color: '#8f8a80' }),
  saltM: toon({ color: '#f7f3e6' }),
  onionM: toon({ color: '#e8d8e8' }),
  carrotM: toon({ color: '#e8862a' }),
  greenM: toon({ color: '#4a6a34' }),
  redM: toon({ color: '#c23b2e' }),
  shadowSoft: new THREE.MeshBasicMaterial({ color: 0x1a2410, transparent: true, opacity: 0.34, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(340, 240), MAT.grass, 0, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(90, 7), MAT.dirt, 0, -0.012, 3.4, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(9.5, 24), MAT.dirt, 0, -0.008, 0.2, g, { cast: false }));   // the village square
  flat(add(new THREE.CircleGeometry(6, 18), MAT.dirt, 32, -0.008, -2, g, { cast: false }));      // court ground
  for (const [hx, hz, ry] of [[-9, -13, 0.2], [9, -14, -0.3], [20, -12, 0.4], [26, -13, -0.2], [-24, -13, 0.1], [-40, -12, -0.4]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9], [-24, -10, 1.1]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= VILLAGE SQUARE (x=0, facade z=-4.6) =================
let doorPanel;
{
  const g = world;
  add(tbox(13, 5.6, 0.35, 2), MAT.plaster, 0, 2.8, -4.85, g, { cast: false });
  const roof = add(tbox(13.8, 0.14, 3.2, 2), MAT.thatch, 0, 5.52, -3.6, g, { cast: false }); roof.rotation.x = 0.1;
  // three doorways; the middle one (x=-1.6) has a real hinged panel
  for (const dx of [-4.4, 1.4]) add(tbox(1.15, 2.05, 0.1, 2), MAT.dark, dx, 1.02, -4.62, g, { cast: false });
  add(tbox(1.3, 2.2, 0.12, 2), MAT.woodDk, -1.6, 1.1, -4.66, g, { cast: false });            // door frame
  add(tbox(1.06, 2.02, 0.06, 2), MAT.dark, -1.6, 1.01, -4.64, g, { cast: false });           // dark opening behind the panel
  const hinge = new THREE.Group(); hinge.position.set(-2.13, 0, -4.58); g.add(hinge);
  doorPanel = add(tbox(1.06, 2.02, 0.07, 2), MAT.wood, 0.53, 1.01, 0, hinge);
  doorPanel.userData.hinge = hinge;
  for (const wx of [-6.2, 3.6, 5.6]) {
    add(tbox(0.95, 0.95, 0.1, 2), MAT.dark, wx, 2.6, -4.62, g, { cast: false });
    add(tbox(0.95, 0.08, 0.5, 2), MAT.woodDk, wx, 2.08, -4.5, g, { cast: false });
  }
  // crates + barrel at the square's west edge; a well east
  const c1 = FX.crate(1.15); c1.position.set(-5.6, 0.55, 0.4); g.add(c1);
  const b1 = FX.barrel(0.52, 1.25); b1.position.set(-4.5, 0.62, 0.2); g.add(b1);
  add(new THREE.CylinderGeometry(0.85, 0.95, 0.75, 12, 1, true), MAT.stoneDk, 5.6, 0.37, -2.6, g, { cast: false });
  flat(add(new THREE.CircleGeometry(0.8, 14), MAT.dark, 5.6, 0.72, -2.6, g, { cast: false }));
  // a shade tree east of the square
  add(new THREE.CylinderGeometry(0.3, 0.44, 2.9, 8), MAT.woodDk, 7.6, 1.45, -5.4, g, { cast: false });
  const can = add(new THREE.SphereGeometry(2.3, 10, 8), MAT.leaf, 7.6, 3.9, -5.4, g, { cast: false }); can.scale.y = 0.72; can.userData.ndSkip = true;
}
// ---- THE GREAT POT on its stone ring over the fire ----
// Pot group origin at ground; body r=0.62; rim world y = 0.24+0.97 = 1.21;
// soup surface disc at world y = SURF (0.88). The pot's flat base ring
// rests ON the stones (contact), stones rest ON the ground.
let soupDisc, fireGlow;
const potGroup = new THREE.Group(); potGroup.position.set(POTC[0], 0.24, POTC[2]); world.add(potGroup);
{
  const g = world;
  // stone ring (the pot sits on these) + fire logs under the pot
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const st = add(new THREE.SphereGeometry(0.17, 8, 6), MAT.stoneDk, Math.cos(a) * 0.52, 0.1, -1.2 + Math.sin(a) * 0.52, g);
    st.scale.y = 0.75;
  }
  flat(add(new THREE.CircleGeometry(0.85, 16), MAT.shadowSoft, 0, 0.015, -1.2, g, { cast: false }));  // ash/contact patch under pot+fire
  for (const [ry, off] of [[0.4, 0], [1.5, 0.1], [2.6, -0.08]]) {
    const log = add(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 7), MAT.woodDk, off, 0.09, -1.2, g);
    log.rotation.z = Math.PI / 2; log.rotation.y = ry;
  }
  const body = add(new THREE.SphereGeometry(0.62, 18, 12), MAT.iron, 0, 0.446, 0, potGroup); body.scale.y = 0.82;
  add(new THREE.CylinderGeometry(0.33, 0.42, 0.19, 14), MAT.iron, 0, 0.88, 0, potGroup);
  const rim = add(new THREE.TorusGeometry(0.335, 0.045, 8, 18), MAT.ironDk, 0, 0.97, 0, potGroup); rim.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const h = add(new THREE.TorusGeometry(0.16, 0.03, 8, 14, Math.PI), MAT.ironDk, s * 0.57, 0.55, 0, potGroup);
    h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  soupDisc = flat(add(new THREE.CircleGeometry(0.4, 18), toon({ color: '#33566e' }), 0, 0.64, 0, potGroup, { cast: false }));
  soupDisc.rotation.x = -Math.PI / 2;
  fireGlow = softGlow(1.2, 0xff9a4a, 0.0); fireGlow.position.set(0, 0.32, -1.2); g.add(fireGlow);
}
// ---- dynamic props (positions from story dynAt) ----
const mkDyn = (build) => { const grp = new THREE.Group(); build(grp); grp.visible = false; world.add(grp); return grp; };
const dynStone = mkDyn((g) => { const m = add(new THREE.SphereGeometry(0.13, 12, 9), MAT.stoneGrey, 0, 0, 0, g); m.scale.y = 0.78; });
const dynSalt = mkDyn((g) => { add(new THREE.ConeGeometry(0.13, 0.12, 10), MAT.saltM, 0, 0, 0, g); });
const dynOnions = mkDyn((g) => {
  add(new THREE.SphereGeometry(0.085, 10, 8), MAT.onionM, -0.09, 0, 0, g);
  add(new THREE.SphereGeometry(0.08, 10, 8), MAT.onionM, 0.09, 0.02, 0.03, g);
  add(new THREE.ConeGeometry(0.025, 0.07, 6), MAT.sackDk, -0.09, 0.1, 0, g);
});
const dynCarrots = mkDyn((g) => {
  for (const dx of [-0.09, 0, 0.09]) {
    const c = add(new THREE.ConeGeometry(0.045, 0.24, 8), MAT.carrotM, dx, -0.04, 0, g); c.rotation.x = Math.PI;
    add(new THREE.ConeGeometry(0.03, 0.1, 6), MAT.greenM, dx, 0.12, 0, g);
  }
});
const mkSack = () => mkDyn((g) => {
  const b = add(new THREE.SphereGeometry(0.15, 10, 8), MAT.sack, 0, -0.03, 0, g); b.scale.y = 0.85;
  add(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 8), MAT.sackDk, 0, 0.11, 0, g);
});
const dynPotSack = mkSack(), dynBeanSack = mkSack();
const dynChicken = mkDyn((g) => {
  const b = add(new THREE.SphereGeometry(0.16, 12, 9), MAT.white, 0, 0, 0, g); b.scale.set(1.15, 0.9, 0.9);
  add(new THREE.SphereGeometry(0.075, 10, 8), MAT.white, 0.17, 0.1, 0, g);
  add(box(0.05, 0.03, 0.06), MAT.redM, 0.17, 0.18, 0, g);
  const t = add(new THREE.ConeGeometry(0.07, 0.16, 7), MAT.white, -0.17, 0.08, 0, g); t.rotation.z = 0.9;
});
const dynLadle = mkDyn((g) => {
  const cup = add(new THREE.SphereGeometry(0.095, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MAT.wood, 0, 0, 0, g);
  cup.scale.y = 0.75;
  const handle = add(new THREE.CylinderGeometry(0.026, 0.03, 0.85, 7), MAT.woodDk, 0, 0.42, 0, g);
  handle.rotation.z = 0.0;
  const grip = new THREE.Group(); grip.add(handle); grip.rotation.z = 0.45; g.add(grip);
  handle.position.set(0.19, 0.4, 0);
});
// ================= KING'S COURT (x=+32) =================
{
  const g = world, cx = 32;
  add(tbox(9, 4.5, 0.4, 2), MAT.stoneDk, cx, 2.25, -7.0, g, { cast: false });
  add(tbox(9.8, 0.5, 1.1, 2), MAT.stone, cx, 4.7, -7.0, g, { cast: false });
  for (const px of [28.5, 35.5]) add(new THREE.CylinderGeometry(0.32, 0.38, 6.4, 10), MAT.stoneDk, px, 3.2, -5.5, g, { cast: false });
  add(tbox(6, 0.15, 3.5, 2), MAT.canopy, cx, 3.6, -5.0, g, { cast: false });
  for (const px of [29.5, 34.5]) add(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), MAT.woodDk, px, 1.8, -4.0, g, { cast: false });
  add(tbox(3.2, 0.5, 1.0, 2), MAT.woodDk, BENCH[0], 0.9, BENCH[2], g, { cast: false });
  add(tbox(3.2, 1.0, 0.15, 2), MAT.woodDk, BENCH[0], 1.6, BENCH[2] - 0.45, g, { cast: false });
  add(tbox(3.2, 0.65, 0.1, 2), MAT.woodDk, BENCH[0], 0.32, BENCH[2] + 0.52, g, { cast: false });
  add(tbox(3.0, 0.12, 0.9, 2), MAT.cushion, BENCH[0], 1.2, BENCH[2], g, { cast: false });
  add(tbox(4.6, 0.22, 1.4, 2), MAT.stone, cx, 0.11, -4.2, g, { cast: false });
  add(tbox(5.4, 0.22, 1.4, 2), MAT.stoneDk, cx, 0.11, -2.9, g, { cast: false });
  // the chessboard on its low table — ONE grain of rice on the first square
  const chkC = document.createElement('canvas'); chkC.width = chkC.height = 256;
  const cg = chkC.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { cg.fillStyle = (i + j) % 2 ? '#4a3220' : '#e8d8b0'; cg.fillRect(i * 32, j * 32, 32, 32); }
  const chkT = new THREE.CanvasTexture(chkC); chkT.colorSpace = THREE.SRGBColorSpace;
  add(tbox(1.15, 0.07, 1.15, 2), MAT.woodDk, CHESS[0], 0.56, CHESS[2], g, { cast: false });
  const boardTop = add(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshBasicMaterial({ map: chkT, fog: true }), CHESS[0], 0.6, CHESS[2], g, { cast: false });
  boardTop.rotation.x = -Math.PI / 2; boardTop.userData.ndSkip = true;
  for (const [lx, lz] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]])
    add(box(0.08, 0.53, 0.08), MAT.woodDk, CHESS[0] + lx, 0.26, CHESS[2] + lz, g, { cast: false });
  const grain = add(new THREE.SphereGeometry(0.032, 8, 6), MAT.white, CHESS[0] - 0.46, 0.63, CHESS[2] - 0.46, g, { cast: false });
  grain.scale.set(1, 0.6, 1.7);
  // the king's grain sacks (the storehouse that will empty)
  for (const [sx, sz, s] of [[33.9, -2.5, 1], [34.5, -2.9, 0.85], [34.15, -2.7, 0.7], [29.2, -5.1, 0.9]]) {
    const sk = add(new THREE.SphereGeometry(0.42 * s, 10, 8), MAT.sack, sx, 0.3 * s, sz, g, { cast: false });
    sk.scale.y = 0.78;
    add(new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 0.12 * s, 8), MAT.sackDk, sx, 0.62 * s, sz, g, { cast: false });
  }
  // signpost for the hook board
  add(box(0.12, 4.1, 0.12), MAT.woodDk, 27.2, 2.05, -2.0, g, { cast: false });
  add(box(0.12, 4.1, 0.12), MAT.woodDk, 29.6, 2.05, -2.0, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['A FEAST FROM ONE STONE!'], 3.4, 0.9, '#7a3b12', '#ffd76a'); boardTitle.position.set(0, 4.25, -4.32); world.add(boardTitle);
const boardSalt = textBoard(['JUST A LITTLE SALT!'], 3.0, 0.82, '#4a2c14', '#ffd76a'); boardSalt.position.set(0, 3.42, -4.32); world.add(boardSalt);
const boardOnion = textBoard(['BETTER WITH AN ONION!'], 3.0, 0.82, '#3c4a2e', '#ffe9a8'); boardOnion.position.set(0, 3.42, -4.32); world.add(boardOnion);
const boardCarrot = textBoard(['FIT FOR A KING!'], 3.0, 0.82, '#7a3b12', '#ffd76a'); boardCarrot.position.set(0, 3.42, -4.32); world.add(boardCarrot);
const boardFeast = textBoard(['ALL FROM A STONE?!'], 3.0, 0.82, '#5a2a3a', '#ffe9a8'); boardFeast.position.set(0, 3.42, -4.32); world.add(boardFeast);
const boardHook = textBoard(['ONE TINY GRAIN…', 'EMPTIED THE', 'STOREHOUSE?'], 2.4, 1.35, '#2e4a2e', '#ffe9a8'); boardHook.position.set(SIGNP[0], SIGNP[1], SIGNP[2]); world.add(boardHook);
// ND occluder behind the hook board: invisible in the colour pass, but present
// in the normal-depth pass so court edges behind the board cannot ghost through it.
// Sized EXACTLY as the board (2.4x1.35): sitting 0.12 behind it, its ND silhouette
// projects a hair inside the board's rim, so the ink edge it generates lands on the
// board's own dark face instead of drawing a floating rectangle in the sky around it.
const hookOcc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
hookOcc.position.set(SIGNP[0], SIGNP[1], SIGNP[2] - 0.12); world.add(hookOcc);

// ---------- FX: haze + steam + splashes + fire ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.3, color: 0xffffff, opacity: 0.03, scale: 1.6, grow: 1.2, life: 2.6, vy: 0.1, wind: -0.5 });
const steamEmit = smoke.addEmitter(POTC[0], 1.45, POTC[2], { rate: 0, color: 0xffffff, opacity: 0.09, scale: 0.34, grow: 1.1, life: 1.2, vy: 0.6, wind: 0.25 });
const splashes = new FX.Splashes(scene, 200); splashes.points.userData.ndSkip = true;
const fire = new FX.Fire(scene, { x: POTC[0], y: 0.1, z: POTC[2], scale: 0.42, rate: 13, max: 26 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  splashes.life.fill(-1);
  fire.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire.acc = 0;
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), dn = dynAt(fxF);
    hazeEmit.rate = pr.smokeRate;
    steamEmit.rate = (pr.steamRate || 0) * 9;
    fire.on = dn.fireK > 0.03;
    for (const s of SPLASHES) if (s.f === fxF) splashes.burst(POTC[0], SURF + 0.03, POTC[2], { n: s.n, power: s.power });
    smoke.update(t, dt);
    splashes.update(t, dt);
    fire.update(t, dt);
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
const waterCol = new THREE.Color('#33566e'), soupCol = new THREE.Color('#b06a28'), tmpCol = new THREE.Color();
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardSalt, Ws.boardSalt || 0); setB(boardOnion, Ws.boardOnion || 0);
  setB(boardCarrot, Ws.boardCarrot || 0); setB(boardFeast, Ws.boardFeast || 0); setB(boardHook, Ws.boardHook || 0);
  const D = dynAt(f);
  const put = (mesh, d) => { mesh.visible = !!d.vis; if (d.vis) mesh.position.set(d.pos[0], d.pos[1], d.pos[2]); };
  put(dynStone, D.stone); put(dynSalt, D.salt); put(dynOnions, D.onions); put(dynCarrots, D.carrots); put(dynChicken, D.chicken);
  put(dynPotSack, D.potSack); dynPotSack.rotation.z = D.potSack.tilt || 0;
  put(dynBeanSack, D.beanSack); dynBeanSack.rotation.z = D.beanSack.tilt || 0;
  dynLadle.visible = !!D.ladle.vis;
  if (D.ladle.vis) { dynLadle.position.set(...D.ladle.pos); dynLadle.rotation.set(D.ladle.rx || 0, 0, D.ladle.rz || 0); }
  tmpCol.lerpColors(waterCol, soupCol, D.soupK || 0);
  soupDisc.material.color.copy(tmpCol);
  if (doorPanel) doorPanel.userData.hinge.rotation.y = -(D.doorK || 0) * 1.85;
  fireGlow.material.opacity = (D.fireK || 0) * 0.06;
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
