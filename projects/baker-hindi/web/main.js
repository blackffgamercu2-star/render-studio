import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, PLATFORM, OVEN, TABLE, STONE_START } from './story.js';

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

// ---------- materials ----------
const goldCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#8a5a14'); gr.addColorStop(0.35, '#d9a441'); gr.addColorStop(0.52, '#ffe9a0'); gr.addColorStop(0.62, '#f6c453'); gr.addColorStop(1, '#9c6b1e');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(255,240,200,${0.03 + Math.random() * 0.05})`; g.lineWidth = 1;
    const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (Math.random() - 0.5) * 6); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const breadCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, '#f2c877'); gr.addColorStop(0.6, '#d99a3e'); gr.addColorStop(1, '#8a5420');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(122,66,16,${0.15 + Math.random() * 0.3})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,236,180,${0.3 + Math.random() * 0.4})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MAT = {
  plaza: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 10, 10, '#cfc4ae'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  gold: toon({ map: goldCanvas }), goldTrim: toon({ color: '#f0bc4a' }),
  blackStone: new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.55, metalness: 0.12, envMap, envMapIntensity: 0.7 }),
  blackStoneTop: texM(M4.stoneV4(11), 2, 2, '#3a3a42'),
  brass: new THREE.MeshStandardMaterial({ color: 0xe8b93c, roughness: 0.16, metalness: 1.0, envMap, envMapIntensity: 1.7, side: THREE.DoubleSide }),
  bread: toon({ map: breadCanvas }),
  dough: toon({ color: '#e8d5a8' }),
  clay: texM(M4.stoneV4(5), 2, 2, '#b06a42'),
  clayDk: toon({ color: '#7a3a20' }),
  crimson: toon({ color: '#7a1f2e' }), teal: toon({ color: '#1f4a4a' }),
  cloth: toon({ color: '#8a6f42' }), leaf: toon({ color: '#4a7a34' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
};

// ---------- the palace courtyard ----------
const world = new THREE.Group(); scene.add(world);
const banners = [];
{
  const g = world;
  const plaza = flat(add(new THREE.CircleGeometry(30, 48), MAT.plaza, 0, 0, 2, g, { cast: false }));
  plaza.scale.set(1.15, 1, 1);
  const ring = flat(add(new THREE.RingGeometry(1.62, 1.86, 40), MAT.stoneDk, PLATFORM.x, 0.012, PLATFORM.z, g, { cast: false }));
  // the black stone slab rests ON the courtyard ground here (top = story
  // PLATFORM.top = 0.24); the slab itself is a dynamic prop in the stone
  // group below, dragged in from the oven — no plinth under it.
  // palace facade (north, z=-14): wall, columns, arch, steps, banners
  add(tbox(36, 7.5, 1.6, 3), MAT.stone, 0, 3.75, -14.6, g, { cast: false });
  add(tbox(36, 0.7, 2.2, 3), MAT.stoneDk, 0, 7.85, -14.6, g, { cast: false });
  for (const cx of [-12, -8, -4, 4, 8, 12]) {
    add(new THREE.CylinderGeometry(0.35, 0.4, 4.4, 12), MAT.stone, cx, 2.2, -13.2, g, { cast: false });
    add(tbox(0.95, 0.28, 0.95, 2), MAT.stoneDk, cx, 4.55, -13.2, g, { cast: false });
    add(tbox(1.0, 0.3, 1.0, 2), MAT.stoneDk, cx, 0.15, -13.2, g, { cast: false });
  }
  const archT = add(new THREE.TorusGeometry(2.5, 0.42, 10, 24, Math.PI), MAT.stoneDk, 0, 4.4, -13.4, g, { cast: false });
  add(tbox(7.6, 0.5, 1.1, 2), MAT.stoneDk, 0, 0.25, -12.6, g, { cast: false });
  add(tbox(9.4, 0.24, 1.5, 2), MAT.stoneDk, 0, 0.12, -11.9, g, { cast: false });
  for (const bx of [-6.2, 6.2]) {
    const pole = add(new THREE.CylinderGeometry(0.05, 0.06, 5.6, 7), MAT.woodDk, bx, 2.8, -12.9, g, { cast: false });
    const ban = add(new THREE.PlaneGeometry(1.15, 2.6), bx < 0 ? MAT.crimson : MAT.teal, bx, 3.6, -12.82, g, { cast: false });
    ban.userData.phase = bx; banners.push(ban);
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.goldTrim, bx, 5.68, -12.9, g, { cast: false });
  }
  // side walls (low, warm stone) + corner planters with shrubs
  add(tbox(1.4, 2.6, 26, 3), MAT.stone, -16.7, 1.3, -1, g, { cast: false });
  add(tbox(1.4, 2.6, 26, 3), MAT.stone, 16.7, 1.3, -1, g, { cast: false });
  for (const [px, pz] of [[-14.6, 8.5], [14.6, 8.5], [-14.6, -8], [14.6, -8]]) {
    add(tbox(1.3, 0.6, 1.3, 2), MAT.stoneDk, px, 0.3, pz, g, { cast: false });
    const bush = add(new THREE.SphereGeometry(0.62, 10, 8), MAT.leaf, px, 0.95, pz, g, { cast: false }); bush.scale.y = 0.8;
  }
  // the baker's clay oven (west): a domed clay oven with a dark mouth and
  // a jagged CRACK splitting it down the middle — the festival-morning
  // disaster. Wood pile + dough baskets beside it.
  const oven = new THREE.Group(); oven.position.set(OVEN.x, 0, OVEN.z); oven.rotation.y = OVEN.ry; g.add(oven);
  add(new THREE.CylinderGeometry(1.05, 1.15, 0.5, 20), MAT.clayDk, 0, 0.25, 0, oven, { cast: false });
  const dome = add(new THREE.SphereGeometry(1.0, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), MAT.clay, 0, 0.5, 0, oven, { cast: false });
  dome.scale.set(1, 0.85, 1);
  add(new THREE.SphereGeometry(0.34, 12, 8), MAT.dark, 0, 0.62, 0.86, oven, { cast: false }).scale.set(1, 0.9, 0.5);
  // the crack: a dark jagged band down the dome's face, hugging the dome
  // curve (z follows the sphere so no segment floats or sinks)
  const crackPts = [[-0.12, 1.32], [0.05, 1.05], [-0.08, 0.82], [0.1, 0.58], [-0.04, 0.38]];
  for (let i = 0; i < crackPts.length - 1; i++) {
    const [x0, y0] = crackPts[i], [x1, y1] = crackPts[i + 1];
    const ym = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0);
    const zm = 0.99 * Math.sqrt(Math.max(0, 1 - ((ym - 0.5) / 0.85) ** 2));
    const seg = add(tbox(0.07, len, 0.06, 2), MAT.dark, (x0 + x1) / 2, ym, zm, oven, { cast: false });
    seg.rotation.z = Math.atan2(x1 - x0, y1 - y0);
  }
  add(new THREE.SphereGeometry(0.1, 8, 6), MAT.goldTrim, 0, 1.38, 0, oven, { cast: false });
  for (const [wx, wz] of [[-1.5, 0.4], [-1.35, 0.7], [-1.6, 0.1]]) {
    const log = add(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 7), MAT.woodDk, wx, 0.12, wz, oven, { cast: false });
    log.rotation.z = Math.PI / 2; log.rotation.y = 0.4;
  }
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 9), MAT.wood, 1.35, 0.2, 0.5, oven, { cast: false });
  add(new THREE.SphereGeometry(0.26, 12, 8), MAT.dough, 1.35, 0.46, 0.5, oven, { cast: false }).scale.y = 0.6;
  // the dough table (east): low table + dough basket resting on it
  add(tbox(1.7, 0.09, 1.0, 2), MAT.wood, TABLE.x, 0.74, TABLE.z, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), MAT.woodDk, TABLE.x + lx, 0.37, TABLE.z + lz, g, { cast: false });
  const sack2 = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.cloth, TABLE.x - 0.45, 0.93, TABLE.z + 0.15, g, { cast: false }); sack2.scale.y = 0.85;
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ---------- THE BLACK STONE (hero prop) ----------
// A flat black slab, dragged in from the oven and resting ON the courtyard
// ground (top = PLATFORM.top = 0.24). Per-stone detail texture on top,
// dark sides; the bread bakes ON it. The polished BRASS PLATE is a real
// metal disc the baker holds and angles to throw sunlight onto the stone;
// the sun PATCH is a soft-edged additive glow on the stone (brightest at
// centre, soft falloff — never a hard wedge).
const stoneG = new THREE.Group(); world.add(stoneG);
const stoneSlab = add(tbox(2.4, 0.24, 1.6, 2), MAT.blackStone, 0, 0.12, 0, stoneG);
const stoneTop = add(new THREE.PlaneGeometry(2.34, 1.54), MAT.blackStoneTop, 0, 0.242, 0, stoneG, { cast: false });
stoneTop.rotation.x = -Math.PI / 2;
const sunPatch = softGlow(1.5, '#ffdf9e', 0); sunPatch.position.set(0, 0.26, 0); stoneG.add(sunPatch);
const plateG = new THREE.Group(); world.add(plateG);
const plateDisc = add(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 28), MAT.brass, 0, 0, 0, plateG);
add(new THREE.TorusGeometry(0.55, 0.03, 8, 28), MAT.goldTrim, 0, 0, 0, plateG).rotation.x = Math.PI / 2;
add(new THREE.SphereGeometry(0.07, 10, 8), MAT.goldTrim, 0, 0.05, 0, plateG);
const plateGlint = softGlow(0.9, '#fff3cf', 0); plateGlint.position.set(0.12, 0.08, 0.12); plateG.add(plateGlint);
// three loaves: flat rounds with a crust-gradient top, baked ON the stone
const loafG = new THREE.Group(); world.add(loafG);
const loaves = [];
for (let i = 0; i < 3; i++) {
  const lg = new THREE.Group(); loafG.add(lg);
  const body = add(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 20), MAT.bread, 0, 0, 0, lg);
  add(new THREE.TorusGeometry(0.34, 0.025, 6, 20), MAT.bread, 0, 0.06, 0, lg).rotation.x = Math.PI / 2;
  const glint = softGlow(0.5, '#ffe9a8', 0); glint.position.set(0.08, 0.12, 0.06); lg.add(glint);
  loaves.push({ g: lg, glint });
}
// sun-ray cones (the focus beat): soft additive shafts from the sun to the
// brass plate and down onto the stone
const rayMat = new THREE.MeshBasicMaterial({ color: 0xffdf9e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const rays = [];
for (const off of [[0, 0], [0.35, 0.2], [-0.3, 0.28]]) {
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.8, 1, 12, 1, true), rayMat);
  cone.userData.ndSkip = true; cone.userData.off = off; world.add(cone); rays.push(cone);
}

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard(['वो नानबाई जिसने', 'बिना भट्ठी के', 'रोटी सेंकी'], 4.6, 1.2, '#4a2c10', '#ffe9a8', 900, { fsMul: 0.8, pitch: 0.24, dy: 0.02 });
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['पर एक लड़के ने आसमान के', 'सारे तारे गिन लिए —', 'सब के सब, एक ही रात में।', 'भला तारे कैसे गिने जाते हैं?'], 4.6, 1.5, '#1a2340', '#ffd76a', 900, { pitch: 0.21, fsMul: 0.93 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: courtyard dust motes + pot steam + heat shimmer + clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 3, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const steamEmit = smoke.addEmitter(PLATFORM.x, 0.45, PLATFORM.z, { rate: 0, color: 0xffffff, opacity: 0.24, scale: 0.72, grow: 1.7, life: 1.7, vy: 0.9, wind: 0.18 });
const shimmerEmit = smoke.addEmitter(PLATFORM.x, 0.35, PLATFORM.z, { rate: 0, color: 0xfff2cc, opacity: 0.05, scale: 0.42, grow: 1.3, life: 1.1, vy: 1.35, wind: 0.05 });
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
    dustEmit.rate = pr.smokeRate * 3;
    steamEmit.rate = pr.steamRate * 3.2;
    shimmerEmit.rate = pr.shimmerRate * 1.7;
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) { o.userData.boardVisible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; o.visible = false; } });
  // THE STONE rides the story: dragged slowly from the oven (heavy, on
  // the ground the whole way), then resting at the courtyard centre; the
  // bread bakes ON it and the brass plate angles sunlight onto it
  stoneG.position.set(Ws.stoneX, 0, Ws.stoneZ);
  const pk = Ws.sunPatchK || 0;
  sunPatch.material.opacity = pk * 0.55;
  sunPatch.visible = pk > 0.02;
  // the brass plate: held at the baker's hands while polishing/angling,
  // then set down leaning on the stone's edge (bottom edge on the ground)
  plateG.visible = (Ws.plateK || 0) > 0.01;
  if (plateG.visible) {
    plateG.position.set(Ws.plateX, Ws.plateY, Ws.plateZ);
    plateG.rotation.set(Ws.plateRX || 0, Ws.plateRY || 0, 0);
    plateGlint.material.opacity = (Ws.plateGlint || 0) * 0.9;
    plateGlint.visible = (Ws.plateGlint || 0) > 0.02;
  }
  // the loaves: each drops onto the stone with gravity (story-side bounce),
  // puffs as it bakes, then rests ON the stone top
  for (let i = 0; i < 3; i++) {
    const L = loaves[i], st = Ws.loaves[i];
    L.g.visible = st.k > 0.01;
    if (!L.g.visible) continue;
    L.g.position.set(st.x, st.y, st.z);
    const puff = 1 + (st.puff || 0) * 0.28;
    L.g.scale.set(puff, 1 + (st.puff || 0) * 0.5, puff);
    L.glint.material.opacity = (st.glint || 0) * 0.85;
    L.glint.visible = (st.glint || 0) > 0.02;
  }
  // sun rays converge on the plate, then onto the stone (soft shafts,
  // brightest at the source, widening as they fall — never a hard wedge)
  const rk = Ws.raysK || 0;
  rayMat.opacity = rk * 0.04;
  const stonePos = _vb.set(Ws.stoneX, 0.3, Ws.stoneZ);
  for (const cone of rays) {
    cone.visible = rk > 0.01;
    if (!cone.visible) continue;
    const off = cone.userData.off;
    _va.copy(skyU.sunDir.value).multiplyScalar(8).add(stonePos); _va.x += off[0]; _va.z += off[1];
    cone.position.copy(_va).add(stonePos).multiplyScalar(0.5);
    const len = _va.distanceTo(stonePos);
    cone.scale.set(1, len, 1);
    cone.quaternion.setFromUnitVectors(_up, _va.sub(stonePos).normalize().negate());
  }
  // facade banners sway in gusts (never a uniform wave)
  banners.forEach((b, i) => { b.rotation.y = Math.sin(f * 0.021 + i * 1.7 + Math.sin(f * 0.006 + i) * 1.3) * 0.13; });
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
