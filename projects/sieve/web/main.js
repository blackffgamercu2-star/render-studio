import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, PLATFORM, WAX_TABLE, RIVER, BANK } from './story.js';

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
const sieveCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8a6420'); gr.addColorStop(0.4, '#c9a24d'); gr.addColorStop(0.55, '#f0d48a'); gr.addColorStop(1, '#9c7a28');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(40,26,8,0.85)';
  for (let y = 14; y < 256; y += 22) for (let x = 11 + ((y / 22) % 2) * 11; x < 256; x += 22) { g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const foodCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcbc'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,250,235,${0.25 + Math.random() * 0.4})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
  for (let i = 0; i < 130; i++) { g.fillStyle = i % 3 ? '#c96a28' : '#5d7a2e'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MAT = {
  plaza: texM(M4.groundDetail(M4.sandV4(15), 191, { dots: 1200 }), 10, 10, '#cbb98f'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  gold: toon({ map: goldCanvas }), goldTrim: toon({ color: '#f0bc4a' }),
  brass: new THREE.MeshStandardMaterial({ map: sieveCanvas, roughness: 0.32, metalness: 0.9, envMap, envMapIntensity: 1.2, side: THREE.DoubleSide }),
  brassPlain: new THREE.MeshStandardMaterial({ color: 0xc9a24d, roughness: 0.28, metalness: 1.0, envMap, envMapIntensity: 1.2 }),
  waxGold: toon({ color: '#e8b93c' }),
  // held water: calm deep-blue surface, NOT glass (the glass texture's white
  // streaks + glare read as milk in the small bowl; low specular keeps it blue)
  // held water: flat matte blue (no specular/glass — both read milky-white in the small bowl)
  waterIn: new THREE.MeshBasicMaterial({ color: 0x1f6a8a, transparent: true, opacity: 0.95 }),
  clay: toon({ color: '#8a5a3a' }),
  sand: texM(M4.sandV4(17), 4, 4, '#d8c49a'),
  blackPot: new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.46, metalness: 0.3, envMap, envMapIntensity: 0.9 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.1, metalness: 1.0, envMap, envMapIntensity: 1.6, side: THREE.DoubleSide }),
  food: toon({ map: foodCanvas }),
  crimson: toon({ color: '#7a1f2e' }), teal: toon({ color: '#1f4a4a' }),
  cloth: toon({ color: '#8a6f42' }), leaf: toon({ color: '#4a7a34' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
};

// ---------- the dry village + river ----------
const world = new THREE.Group(); scene.add(world);
const palms = [];
{
  const g = world;
  const plaza = flat(add(new THREE.CircleGeometry(30, 48), MAT.plaza, 0, 0, 2, g, { cast: false }));
  plaza.scale.set(1.15, 1, 1);
  const ring = flat(add(new THREE.RingGeometry(1.62, 1.86, 40), MAT.stoneDk, PLATFORM.x, 0.012, PLATFORM.z, g, { cast: false }));
  // the platform: a real stone drum the sieve is set down ON (top = story PLATFORM.top)
  add(new THREE.CylinderGeometry(PLATFORM.r, PLATFORM.r + 0.12, PLATFORM.top, 28), MAT.stone, PLATFORM.x, PLATFORM.top / 2, PLATFORM.z, g, { cast: false });
  add(new THREE.TorusGeometry(PLATFORM.r + 0.02, 0.035, 8, 36), MAT.stoneDk, PLATFORM.x, PLATFORM.top - 0.02, PLATFORM.z, g, { cast: false }).rotation.x = Math.PI / 2;
  // low mud-brick walls (west + east) — the square's edges
  add(tbox(1.4, 2.6, 20, 3), MAT.plaster, -16.7, 1.3, 2, g, { cast: false });
  add(tbox(1.4, 2.6, 20, 3), MAT.plaster, 16.7, 1.3, 2, g, { cast: false });
  // three village huts (props.js, real parts: plinth, walls, posts, gable, roof, door, window)
  for (const [hx, hz, ry, seed] of [[-11, 3, 0.3, 15], [11.5, 4, -0.4, 21], [10.5, -6.5, 2.6, 27]]) {
    const hut = PR.buildHut({ seed, envMap });
    hut.group.position.set(hx, 0, hz); hut.group.rotation.y = ry; g.add(hut.group);
  }
  // two palms by the river (sway in gusts — see worldState)
  for (const [px, pz, seed] of [[-12, -6, 13], [12, -7, 19]]) {
    const palm = PR.buildPalm({ seed, envMap });
    palm.group.position.set(px, 0, pz); g.add(palm.group); palms.push(palm.group);
  }
  // the river: shader water (living swells + golden sparkle) + sand banks fore + far
  const waterMesh = FX.makeWater({ size: 24, seg: 48, deep: 0x0f3a52, shallow: 0x1f6a8a, sky: 0x9fd0e8, amp: 0.16, spark: 0.7 });
  waterMesh.scale.set(1.6, 0.42, 1); waterMesh.position.set(0, RIVER.y, RIVER.cz); world.add(waterMesh);
  world.userData.waterMesh = waterMesh;
  add(tbox(39, 0.03, 3.4, 3), MAT.sand, 0, 0.015, -9.9, g, { cast: false });
  // far bank: a low ridge that hides the water plane's far edge from every
  // north-looking camera (the ink pass dotted that long straight edge)
  add(tbox(40, 0.5, 3.0, 3), MAT.sand, 0, 0.25, -21.8, g, { cast: false });
  for (const [bx, bz, br] of [[-8, -21.8, 0.55], [2, -22.0, 0.45], [9, -21.6, 0.5]]) {
    const bush = add(new THREE.SphereGeometry(br, 10, 8), MAT.leaf, bx, 0.5 + br * 0.55, bz, g, { cast: false }); bush.scale.y = 0.8;
  }
  // reeds at the water's edge
  for (const [rx, rz] of [[-8, -11.2], [-4, -11.4], [3, -11.2], [7, -11.4], [11, -11.2]]) {
    for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.03, 0.045, 0.55 + i * 0.08, 5), MAT.leaf, rx + i * 0.12 - 0.12, 0.3, rz + (i % 2) * 0.14, g, { cast: false });
  }
  // the wax table (west): low wooden table the sieve + wax pot rest ON
  add(tbox(1.7, 0.09, 1.0, 2), MAT.wood, WAX_TABLE.x, 0.74, WAX_TABLE.z, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), MAT.woodDk, WAX_TABLE.x + lx, 0.37, WAX_TABLE.z + lz, g, { cast: false });
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ---------- THE SIEVE (hero prop, built from real parts) ----------
// A brass bowl with a perforated wall (dot-grid brass texture), a rolled
// rim and two handles. The golden wax skin is a disc that grows with waxK;
// the held water is a glass disc + foam ring that appears with waterK.
// Group origin = bowl bottom, so sieve y IS the surface it rests on.
const sieveG = new THREE.Group(); world.add(sieveG);
add(new THREE.CylinderGeometry(0.34, 0.26, 0.22, 24, 1, true), MAT.brass, 0, 0.11, 0, sieveG);
add(new THREE.CircleGeometry(0.26, 24), MAT.brass, 0, 0.005, 0, sieveG).rotation.x = -Math.PI / 2;
add(new THREE.TorusGeometry(0.34, 0.03, 8, 28), MAT.brassPlain, 0, 0.22, 0, sieveG).rotation.x = Math.PI / 2;
for (const s of [-1, 1]) {
  const hd = add(new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI), MAT.brassPlain, s * 0.35, 0.16, 0, sieveG);
  hd.rotation.z = s * Math.PI / 2;
}
const waxDiscMat = new THREE.MeshToonMaterial({ gradientMap: grad, color: '#e8b93c', transparent: true, opacity: 0 });
const waxDisc = add(new THREE.CircleGeometry(0.315, 24), waxDiscMat, 0, 0.13, 0, sieveG, { cast: false });
waxDisc.rotation.x = -Math.PI / 2;
const waterDisc = add(new THREE.CircleGeometry(0.305, 24), MAT.waterIn.clone(), 0, 0.19, 0, sieveG, { cast: false });
waterDisc.rotation.x = -Math.PI / 2; waterDisc.material.opacity = 0;
const foamRing = add(new THREE.TorusGeometry(0.29, 0.014, 6, 28), new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0, depthWrite: false }), 0, 0.19, 0, sieveG, { cast: false });
foamRing.rotation.x = Math.PI / 2;
const sieveGlint = softGlow(0.3, '#fff3cf', 0); sieveGlint.position.set(0.1, 0.32, 0.1); sieveG.add(sieveGlint);
// the wax pot: small clay pot with a golden wax cap, resting on the wax table
const waxpotG = new THREE.Group(); waxpotG.position.set(-5.1, 0.78, 5.8); world.add(waxpotG);
add(new THREE.CylinderGeometry(0.13, 0.16, 0.22, 14), MAT.clay, 0, 0.11, 0, waxpotG);
add(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 14), MAT.clay, 0, 0.23, 0, waxpotG);
add(new THREE.CircleGeometry(0.12, 14), MAT.waxGold, 0, 0.245, 0, waxpotG, { cast: false }).rotation.x = -Math.PI / 2;

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE WOMAN WHO ', ' CARRIED WATER ', ' IN A SIEVE '], 4.6, 1.5, '#3a2410', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.5, 'boardTitle');
const boardHook = textBoard([' BUT TOMORROW... ', ' HOW DO YOU CATCH ', ' A FISH WITHOUT ', ' CATCHING IT? '], 4.6, 1.5, '#2e1a3a', '#ffd76a', 900, { pitch: 0.2, dy: 0.01 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: village dust motes + river splash + ripples + clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 3, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const splashes = new FX.Splashes(scene, 200); splashes.points.userData.ndSkip = true;
const wake = new FX.Wake(scene, 24); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; p.m.position.y = 0.1; }); // rings ride just above the raised water (0.08)
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.22, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  splashes.life.fill(-1); for (let k = 0; k < splashes.max; k++) splashes.pos[k * 3 + 1] = -999;
  wake.pool.forEach((p) => { p.life = -1; p.m.visible = false; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    dustEmit.rate = pr.smokeRate * 3;
    if (fxF === 805) { splashes.burst(0.5, 0.1, -11.9, { n: 40, power: 5 }); wake.drop(0.5, -11.9, 0.3); }
    if (fxF === 815) wake.drop(0.5, -11.9, 0.25);
    if (fxF === 835) wake.drop(0.5, -11.9, 0.35);
    smoke.update(t, dt);
    splashes.update(t, dt);
    wake.update(t, dt);
    fxClouds.update(t, dt);
    const wm = world.userData.waterMesh; if (wm) wm.userData.update(t);
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
  scene.traverse((o) => { if (o.userData.isOccluder) { o.userData.boardVisible = (Ws[o.userData.boardKey] || 0) > 0.01; o.visible = false; } });
  // THE SIEVE rides the story: resting on the wax table, carried in her
  // hands, dipped in the river, lifted full, set down on the platform.
  // Its base is the group origin, so y IS the surface it rests on.
  sieveG.position.set(Ws.sieveX, Ws.sieveY, Ws.sieveZ);
  waxDisc.material.opacity = (Ws.waxK || 0) * (1 - (Ws.waterK || 0) * 0.85) * 0.95;
  waxDisc.visible = (Ws.waxK || 0) > 0.02;
  waterDisc.material.opacity = (Ws.waterK || 0) * 0.9;
  waterDisc.visible = (Ws.waterK || 0) > 0.02;
  foamRing.material.opacity = (Ws.waterK || 0) * 0.5;
  foamRing.visible = (Ws.waterK || 0) > 0.03;
  sieveGlint.material.opacity = (Ws.sieveGlint || 0) * 0.9;
  sieveGlint.visible = (Ws.sieveGlint || 0) > 0.02;
  // palms sway in gusts (never a uniform wave)
  palms.forEach((p, i) => { p.rotation.z = Math.sin(f * 0.021 + i * 1.7 + Math.sin(f * 0.006 + i) * 1.3) * 0.02; });
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
