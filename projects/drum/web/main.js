import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, DRUM_POS, CURTAIN, STOOL_POS, HIDE_POS } from './story.js';

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
// the lamp's warm pool (Night Lamp grade: warmth lives ONLY here)
const lampLight = new THREE.PointLight(0xffa64d, 0, 13, 1.4); scene.add(lampLight);

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
// boards write their own ND occluder (sized exactly to the board) so scene
// lines can never bleed through the text in the ink pass (batch-4 lesson)
const addBoardOccluder = (board, w, h, key) => {
  const occ = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ndMat);
  occ.position.copy(board.position); occ.rotation.copy(board.rotation);
  occ.userData.isOccluder = true; occ.userData.boardKey = key; board.parent.add(occ); return occ;
};
// soft radial glow sprite (NO hard cross — lamp light, not a sparkle)
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- scene materials (LIBRARY v4 canvas textures) ----------
const leatherCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a878'; g.fillRect(0, 0, 512, 512);
  const rg = g.createRadialGradient(256, 256, 40, 256, 256, 250);
  rg.addColorStop(0, 'rgba(255,240,210,0.35)'); rg.addColorStop(0.75, 'rgba(120,84,40,0.10)'); rg.addColorStop(1, 'rgba(90,60,26,0.4)');
  g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(105,74,36,${Math.random() * 0.13})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2.5, 2.5); }
  g.strokeStyle = 'rgba(96,64,30,0.55)'; g.lineWidth = 5;
  g.beginPath(); g.arc(256, 256, 228, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(96,64,30,0.3)'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(256, 256, 206, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
const furCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ddd5c2'; g.fillRect(0, 0, 256, 256);
  for (const [x, y, r, col] of [[60, 70, 42, '#b9ac93'], [185, 150, 52, '#c4b797'], [120, 205, 34, '#a99c80'], [205, 45, 30, '#bfb198']]) {
    g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r, r * 0.72, 0.5, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(90,78,58,${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();
const saltCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e6da'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.5})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6); }
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(150,146,132,${Math.random() * 0.25})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MAT = {
  stone: texM(M4.groundDetail(M4.stoneV4(64), 191, { dots: 1200 }), 3, 2, '#b9c0cc'),
  stoneDk: texM(M4.groundDetail(M4.stoneV4(65), 195, { dots: 1200 }), 3, 2, '#98a0ae'),
  wood: texM(M4.woodV4(66), 1, 2), woodDk: texM(M4.woodV4(67), 1, 2, '#a8845e'),
  ground: texM(M4.groundDetail(P.grass(61), 161, { dots: 2200 }), 18, 18, '#55644e'),
  dirt: texM(M4.groundDetail(P.dirt(35), 171), 10, 10, '#8a7a64'),
  leather: toon({ map: leatherCanvas }),
  drumShell: texM(M4.woodV4(71), 3, 1, '#a5713d'),
  fur: toon({ map: furCanvas }), furDk: toon({ color: '#8a7c64' }),
  horn: toon({ color: '#cfc4a8' }), hoof: toon({ color: '#3a332a' }),
  cloth: texM(P.weave(91, '#7a2436'), 2, 2), clothDk: toon({ color: '#5d1a28' }),
  salt: toon({ map: saltCanvas }),
  darkMetal: toon({ color: '#3a3f45' }), brass: toon({ color: '#c9a24a' }),
  leafDk: toon({ color: '#2c4430' }),
};

// ---------- the fort ----------
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  const groundD = flat(add(new THREE.CircleGeometry(70, 40), MAT.ground, 0, -0.02, 0, g, { cast: false })); groundD.receiveShadow = true;
  const court = flat(add(new THREE.CircleGeometry(8.6, 28), MAT.dirt, 0, 0.005, -1.5, g, { cast: false })); court.scale.set(1.25, 1, 1);
  // hall floor slab
  add(tbox(9.6, 0.1, 7.0, 2), MAT.stoneDk, 0, 0.05, 6.9, g, { cast: false });
  // south rampart + walkway + towers + crenellations
  add(tbox(20, 3.1, 1.1, 2), MAT.stone, 0, 1.55, -6.6, g, { cast: false });
  add(tbox(20, 0.18, 1.7, 2), MAT.stoneDk, 0, 3.19, -6.6, g, { cast: false });
  for (let x = -9.4; x <= 9.4; x += 1.57) add(box(0.8, 0.55, 1.0), MAT.stone, x, 3.55, -6.85, g, { cast: false });
  for (const sx of [-8.5, 8.5]) {
    add(new THREE.CylinderGeometry(1.7, 1.9, 4.6, 10), MAT.stone, sx, 2.3, -6.6, g, { cast: false });
    add(new THREE.CylinderGeometry(1.95, 1.95, 0.35, 10), MAT.stoneDk, sx, 4.75, -6.6, g, { cast: false });
    const cone = add(new THREE.ConeGeometry(2.0, 1.5, 10), MAT.clothDk, sx, 5.65, -6.6, g, { cast: false }); cone.castShadow = false;
  }
  // side curtain walls of the fort
  add(tbox(1.1, 3.4, 17.5, 2), MAT.stone, -9.6, 1.7, 1.9, g, { cast: false });
  add(tbox(1.1, 3.4, 17.5, 2), MAT.stone, 9.6, 1.7, 1.9, g, { cast: false });
  add(tbox(20, 4.4, 1.0, 2), MAT.stone, 0, 2.2, 11.1, g, { cast: false });
  // ---- the drum hall ----
  add(tbox(0.3, 3.6, 6.8, 2), MAT.stone, -4.65, 1.8, 6.9, g, { cast: false });                 // left wall
  add(tbox(0.3, 3.6, 0.55, 2), MAT.stone, 4.65, 1.8, 3.775, g, { cast: false });               // right wall (front of door)
  add(tbox(0.3, 3.6, 5.15, 2), MAT.stone, 4.65, 1.8, 7.725, g, { cast: false });               // right wall (behind door)
  add(tbox(0.3, 1.3, 1.1, 2), MAT.stone, 4.65, 2.95, 4.6, g, { cast: false });                 // door lintel
  add(tbox(9.6, 3.6, 0.3, 2), MAT.stone, 0, 1.8, 10.45, g, { cast: false });                   // back wall
  const door = add(tbox(0.07, 2.15, 1.02, 2), MAT.woodDk, 4.42, 1.08, 5.32, g, { cast: false }); // side door, ajar
  door.rotation.y = -0.5;
  for (const px of [-3.2, 3.2]) {                                                              // front pillars
    add(new THREE.CylinderGeometry(0.26, 0.3, 3.4, 9), MAT.stone, px, 1.7, 3.7, g, { cast: false });
    add(box(0.72, 0.22, 0.72), MAT.stoneDk, px, 3.5, 3.7, g, { cast: false });
    add(box(0.66, 0.18, 0.66), MAT.stoneDk, px, 0.09, 3.7, g, { cast: false });
  }
  add(tbox(9.6, 0.3, 0.4, 2), MAT.woodDk, 0, 3.62, 3.7, g, { cast: false });                    // front beam
  for (const bz of [5.2, 6.6, 8.0, 9.4]) add(tbox(9.6, 0.2, 0.26, 2), MAT.woodDk, 0, 3.6, bz, g, { cast: false }); // roof beams
  const roof = add(tbox(9.6, 0.12, 3.6, 2), MAT.woodDk, 0, 3.78, 8.55, g, { cast: false }); roof.rotation.x = 0.045; // roof over the back half only
  // hillside rocks + two dark cypress silhouettes outside the walls
  const rocksB = PR.buildCliffRocks({ seed: 43, rocks: [{ x: -14, z: -2, s: 1.8 }, { x: 13.5, z: 3, s: 2.2 }, { x: -12.5, z: 8, s: 1.4 }, { x: 15, z: -5, s: 1.6 }] });
  g.add(rocksB.group);
  for (const [tx, tz] of [[-12.8, -4.5], [12.6, 7.5]]) {
    add(new THREE.CylinderGeometry(0.09, 0.13, 1.1, 6), MAT.woodDk, tx, 0.55, tz, g, { cast: false });
    const cone = add(new THREE.ConeGeometry(0.85, 3.4, 8), MAT.leafDk, tx, 2.7, tz, g, { cast: false }); cone.castShadow = false;
  }
  // lamp stool (story STOOL_POS)
  add(box(0.44, 0.07, 0.44), MAT.wood, STOOL_POS[0], 0.55, STOOL_POS[1], g, { cast: false });
  for (const [ox, oz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]])
    add(box(0.06, 0.55, 0.06), MAT.woodDk, STOOL_POS[0] + ox, 0.27, STOOL_POS[1] + oz, g, { cast: false });
}
// ---------- THE GREAT WAR DRUM ----------
const drumG = new THREE.Group(); drumG.position.set(DRUM_POS[0], 0, DRUM_POS[1]); world.add(drumG);
let drumHeadR, drumRipple;
{
  for (const sx of [-0.98, 0.98]) {   // A-frame stands
    const legA = add(box(0.14, 1.15, 0.14), MAT.woodDk, sx, 0.55, -0.42, drumG, { cast: false }); legA.rotation.x = 0.38;
    const legB = add(box(0.14, 1.15, 0.14), MAT.woodDk, sx, 0.55, 0.42, drumG, { cast: false }); legB.rotation.x = -0.38;
    add(box(0.12, 0.12, 1.05), MAT.woodDk, sx, 0.28, 0, drumG, { cast: false });
  }
  const axle = add(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 8), MAT.darkMetal, 0, 0.98, 0, drumG, { cast: false });
  axle.rotation.z = Math.PI / 2;
  const shell = add(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 20, 1, true), MAT.drumShell, 0, 0.98, 0, drumG, { cast: false });
  shell.rotation.z = Math.PI / 2;
  for (const sx of [-0.85, 0.85]) {
    const rim = add(new THREE.TorusGeometry(0.95, 0.055, 8, 24), MAT.woodDk, sx, 0.98, 0, drumG, { cast: false });
    rim.rotation.y = Math.PI / 2;
    const head = add(new THREE.CircleGeometry(0.93, 24), MAT.leather, sx * 1.001, 0.98, 0, drumG, { cast: false });
    head.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (sx > 0) drumHeadR = head;
  }
  drumRipple = add(new THREE.TorusGeometry(0.55, 0.02, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, fog: true }), 0.9, 0.98, 0, drumG, { cast: false });
  drumRipple.rotation.y = Math.PI / 2; drumRipple.userData.ndSkip = true;
}
// ---------- the curtain (cloth over the salt nook) ----------
const curtainG = new THREE.Group(); curtainG.position.set(CURTAIN.x, 0, CURTAIN.z); world.add(curtainG);
{
  const rod = add(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 7), MAT.darkMetal, 0, 2.72, 0, curtainG, { cast: false });
  rod.rotation.z = Math.PI / 2;
  const cloth = add(new THREE.PlaneGeometry(2.1, 2.6, 12, 1), MAT.cloth, 0, 1.4, 0, curtainG, { cast: false });
  cloth.geometry.translate(0, -1.3, 0); cloth.position.y = 2.7;
  curtainG.userData.cloth = cloth;
  add(box(2.2, 0.07, 0.07), MAT.brass, 0, 0.12, 0, curtainG, { cast: false });   // weighted hem bar
}
// ---------- the salt block (dynamic) ----------
const saltG = new THREE.Group(); world.add(saltG);
{
  add(box(0.52, 0.34, 0.4), MAT.salt, 0, 0, 0, saltG, { cast: false });
  const chunk = add(box(0.26, 0.16, 0.22), MAT.salt, 0.08, 0.25, 0.03, saltG, { cast: false }); chunk.rotation.y = 0.4;
}
// ---------- the lamp (dynamic: stool -> hand -> floor) ----------
const lampG = new THREE.Group(); world.add(lampG);
let lampGlow, lampFlame, lampPool;
{
  add(new THREE.CylinderGeometry(0.11, 0.14, 0.04, 10), MAT.brass, 0, 0.02, 0, lampG, { cast: false });
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), MAT.brass, 0, 0.12, 0, lampG, { cast: false });
  const glass = add(new THREE.CylinderGeometry(0.075, 0.09, 0.17, 9), new THREE.MeshBasicMaterial({ color: 0xffc37a, transparent: true, opacity: 0.35, fog: true }), 0, 0.27, 0, lampG, { cast: false });
  glass.userData.ndSkip = true;
  lampFlame = add(new THREE.SphereGeometry(0.042, 8, 7), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: true }), 0, 0.26, 0, lampG, { cast: false });
  lampFlame.userData.ndSkip = true; lampFlame.scale.set(0.8, 1.5, 0.8);
  add(new THREE.TorusGeometry(0.07, 0.012, 6, 14), MAT.brass, 0, 0.42, 0, lampG, { cast: false });
  lampGlow = softGlow(1.7, 0xffb45e, 0.5); lampGlow.position.set(0, 0.27, 0); lampG.add(lampGlow);
  lampPool = flat(add(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,180,94', 0.55)), transparent: true, opacity: 0, depthWrite: false, fog: true }), 0, 0, 0, world, { cast: false }));
  lampPool.userData.ndSkip = true; lampPool.renderOrder = 1;
}
// ---------- THE GOAT (fort mascot, dynamic) ----------
const goatG = new THREE.Group(); world.add(goatG);
const goatParts = {};
{
  const body = add(new THREE.SphereGeometry(0.44, 14, 11), MAT.fur, 0, 0.62, 0, goatG, { cast: false });
  body.scale.set(1.18, 0.85, 0.78);
  goatParts.body = body;
  const headG = new THREE.Group(); headG.position.set(0.48, 0.78, 0); goatG.add(headG); goatParts.head = headG;
  const skull = add(new THREE.SphereGeometry(0.21, 12, 10), MAT.fur, 0.05, 0.02, 0, headG, { cast: false }); skull.scale.set(1.15, 0.95, 0.8);
  const snout = add(box(0.22, 0.15, 0.16), MAT.fur, 0.24, -0.05, 0, headG, { cast: false });
  add(box(0.05, 0.035, 0.07), MAT.hoof, 0.35, -0.08, 0, headG, { cast: false });   // nose
  for (const s of [-1, 1]) {
    const horn = add(new THREE.ConeGeometry(0.045, 0.3, 7), MAT.horn, -0.06, 0.2, s * 0.1, headG, { cast: false });
    horn.rotation.z = -0.7; horn.rotation.x = s * 0.25;
    const ear = add(new THREE.ConeGeometry(0.055, 0.2, 6), MAT.furDk, 0.0, 0.06, s * 0.2, headG, { cast: false });
    ear.rotation.x = s * 1.25; ear.userData.side = s;
    headG.userData['ear' + (s < 0 ? 'L' : 'R')] = ear;
    const eye = add(new THREE.SphereGeometry(0.028, 6, 6), MAT.hoof, 0.16, 0.07, s * 0.15, headG, { cast: false }); eye.castShadow = false;
  }
  const beard = add(new THREE.ConeGeometry(0.05, 0.18, 6), MAT.furDk, 0.22, -0.2, 0, headG, { cast: false }); beard.rotation.z = 0.5;
  goatParts.legs = [];
  for (const [lx, lz] of [[0.3, 0.17], [0.3, -0.17], [-0.32, 0.17], [-0.32, -0.17]]) {
    const leg = new THREE.Group(); leg.position.set(lx, 0.52, lz); goatG.add(leg);
    add(new THREE.CylinderGeometry(0.045, 0.038, 0.46, 7), MAT.fur, 0, -0.24, 0, leg, { cast: false });
    add(box(0.11, 0.07, 0.08), MAT.hoof, 0.015, -0.485, 0, leg, { cast: false });
    goatParts.legs.push(leg);
  }
  const tail = add(new THREE.ConeGeometry(0.05, 0.24, 6), MAT.furDk, -0.52, 0.78, 0, goatG, { cast: false });
  tail.rotation.z = 0.7; goatParts.tail = tail;
}
// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE DRUM THAT ', 'PLAYED ITSELF'], 3.9, 1.2, '#1d2a4a', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); boardTitle.rotation.y = Math.PI; world.add(boardTitle); addBoardOccluder(boardTitle, 3.9, 1.2, 'boardTitle');
const boardHook = textBoard([' BUT TOMORROW... ', ' HOW DID ONE PEACOCK ', ' STOP A WHOLE TRAIN? '], 4.3, 1.6, '#2e1a3a', '#ffd76a');
boardHook.position.set(...BOARD_POS); boardHook.rotation.y = Math.PI; world.add(boardHook); addBoardOccluder(boardHook, 4.3, 1.6, 'boardHook');
for (const px of [BOARD_POS[0] - 2.35, BOARD_POS[0] + 2.35]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.6, 7), MAT.woodDk, px, 1.8, BOARD_POS[2], world, { cast: false });
add(tbox(5.0, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.55, BOARD_POS[2], world, { cast: false });


// ---------- FX: night mist + lamp dust motes + dim moonlit clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const mistEmit = smoke.addEmitter(0, 0.6, -2.5, { rate: 0.3, color: 0x8fa5cc, opacity: 0.05, scale: 2.6, grow: 1.3, life: 3.0, vy: 0.08, wind: -0.4 });
const dustEmit = smoke.addEmitter(HIDE_POS[0], 1.2, HIDE_POS[1], { rate: 0, color: 0xffe2b8, opacity: 0.10, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.15, wind: 0.15 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 90, opacity: 0.10, color: 0x8fa3cc, drift: 0.5 });
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
    mistEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};
// beam dust shaken loose on each boom: parametric falling dust (deterministic)
const DUST_N = 16;
const dustParts = [];
for (let i = 0; i < DUST_N; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffe0ae, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  m.userData.ndSkip = true; scene.add(m);
  dustParts.push({ m, ox: (Math.sin(i * 12.9898) * 43758.5453 % 1) * 1.6, oz: (Math.sin(i * 78.233) * 12543.21 % 1) * 1.2, ph: (i % 7) / 7 });
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
let prevGoat = null;
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // drum: the struck head vibrates + a ripple ring blooms on each boom
  const hit = Ws.drumHit || 0;
  drumHeadR.position.x = 0.851 + Math.sin(f * 2.6) * 0.02 * hit;
  drumRipple.material.opacity = 0.3 * hit;
  drumRipple.scale.setScalar(1 + 0.55 * (1 - hit));
  drumG.rotation.x = Math.sin(f * 2.6 + 1) * 0.006 * hit;
  // curtain sway (cloth v2 spring in the night draught)
  curtainG.rotation.z = 0.045 * Math.sin(f * 0.021) + 0.018 * Math.sin(f * 0.13);
  curtainG.rotation.x = 0.012 * Math.sin(f * 0.017 + 2);
  // salt block follows its story state
  saltG.visible = (Ws.saltOn || 0) > 0.01;
  saltG.position.set(Ws.saltX || 0, (Ws.saltY || 0) + 0.17, Ws.saltZ || 0);
  saltG.rotation.y = (Ws.saltCarried || 0) * 0.35; saltG.rotation.z = (Ws.saltCarried || 0) * 0.12;
  // lamp: position, flicker, warm pool — the ONLY warm light in the fort
  const flick = 1 + 0.06 * Math.sin(f * 0.9) + 0.045 * Math.sin(f * 0.37 + 1.7);
  const lk = (Ws.lampK || 0) * flick;
  lampG.position.set(Ws.lampX || 0, Ws.lampY || 0, Ws.lampZ || 0);
  lampG.visible = (Ws.lampK || 0) > 0.01;
  lampGlow.material.opacity = 0.55 * Math.min(1, lk);
  lampGlow.scale.setScalar(1.5 + 0.7 * Math.min(1, lk));
  lampFlame.visible = (Ws.lampK || 0) > 0.02;
  lampLight.intensity = 30 * lk; lampLight.position.set((Ws.lampX || 0), (Ws.lampY || 0) + 0.3, (Ws.lampZ || 0));
  lampPool.position.set(Ws.lampX || 0, 0.03, Ws.lampZ || 0);
  lampPool.material.opacity = 0.34 * Math.min(1, lk);
  lampPool.scale.setScalar(1.6 + 1.6 * Math.min(1, lk));
  // the goat: butt lunge (head CONTACTS the drumhead), lick, stepping legs
  goatG.visible = (Ws.goatOn || 0) > 0.01;
  if (goatG.visible) {
    const butt = Ws.goatButt || 0, lick = Ws.goatLick || 0;
    const moving = prevGoat ? Math.hypot((Ws.goatX || 0) - prevGoat.x, (Ws.goatZ || 0) - prevGoat.z) : 0;
    const bob = moving > 0.004 ? Math.abs(Math.sin((Ws.goatStep || 0) * Math.PI * 2)) * 0.025 : 0;
    goatG.position.set((Ws.goatX || 0) - 0.24 * butt, bob, (Ws.goatZ || 0) + 0.05 * butt);
    goatG.rotation.y = Ws.goatYaw || 0;
    goatParts.head.rotation.y = 0.62 * butt;
    goatParts.head.rotation.z = -0.34 * butt - 0.5 * lick + 0.06 * Math.sin(f * 0.55) * lick;
    goatParts.head.position.x = 0.48 + 0.1 * lick;
    const swing = moving > 0.004 ? Math.sin((Ws.goatStep || 0) * Math.PI * 2) * 0.5 : 0;
    goatParts.legs.forEach((leg, i) => { leg.rotation.z = (i % 2 === 0 ? swing : -swing); });
    goatParts.tail.rotation.x = Math.sin(f * 0.3) * 0.22;
    const earF = 0.25 * butt;
    goatParts.head.userData.earL.rotation.x = -1.25 - earF; goatParts.head.userData.earR.rotation.x = 1.25 + earF;
    prevGoat = { x: Ws.goatX || 0, z: Ws.goatZ || 0 };
  }
  // beam dust falls on each boom
  const dk = Ws.dustFall || 0;
  for (const p of dustParts) {
    if (dk <= 0.01) { p.m.visible = false; continue; }
    p.m.visible = true;
    const u = (dk + p.ph * 0.35) % 1;
    p.m.position.set(DRUM_POS[0] + p.ox * (0.5 + u), 3.45 - 3.2 * u * u, DRUM_POS[1] + p.oz);
    p.m.material.opacity = 0.5 * (1 - u) * Math.min(1, dk * 2);
    p.m.lookAt(camera.position);
  }
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
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; return; }   // occluders ARE the ND for boards
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
