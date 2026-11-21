import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, BOARD_POS, BOARD_RY } from './story.js';
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
scene.environment = envMap;
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
// the hearth fire's warm practical — motivated by the pot fires
const chandLight = new THREE.PointLight(0xffa050, 1.15, 13, 1.6); chandLight.position.set(-3.8, 1.5, -8.0); scene.add(chandLight);

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

// ---------- canvas textures (procedural, from paint.js) ----------
const MAT = {
  stone: texM(P.stone(8), 9, 7),
  stoneDark: texM(P.stone(11), 3, 3, '#b8ab94'),
  wood: texM(P.planks(4), 2, 2),
  woodDark: texM(P.planks(6), 2, 2, '#9a7a58'),
  plaster: texM(P.plaster(8, 42), 6, 2),
  clothRed: texM(P.weave(21, [352, 62, 30]), 2, 6),
  clothCream: texM(P.weave(23, [40, 30, 80]), 1, 4),
  copper: new THREE.MeshStandardMaterial({ color: '#b0662f', roughness: 0.34, metalness: 0.78, envMapIntensity: 1.5 }),
  copperDark: new THREE.MeshStandardMaterial({ color: '#7e451f', roughness: 0.45, metalness: 0.7, envMapIntensity: 1.1 }),
  brass: toon({ color: '#c9a24e', roughness: 0.45, metalness: 0.55 }),
  brassDark: toon({ color: '#8a6c2e', roughness: 0.5, metalness: 0.5 }),
  iron: toon({ color: '#2e2c30', roughness: 0.6, metalness: 0.4 }),
  cream: toon({ color: '#efe3c8', roughness: 1 }),
  leaf: toon({ color: '#4d7a35', roughness: 1 }),
  leaf2: toon({ color: '#639347', roughness: 1 }),
  dishWhite: toon({ color: '#f6f1e2', roughness: 0.55 }),
  food: toon({ color: '#c98a3a', roughness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e8b93c', roughness: 0.25, metalness: 0.9, envMapIntensity: 2.0 }),
  chiliRed: new THREE.MeshStandardMaterial({ color: '#c22418', roughness: 0.22, metalness: 0.05, envMapIntensity: 1.6 }),
  chiliStem: toon({ color: '#4d7a35', roughness: 0.8 }),
};
// the spoon's ghee: pale gold → fierce red as oilK rises (worldState lerps)
const oilMat = new THREE.MeshStandardMaterial({ color: '#e8c96a', roughness: 0.15, metalness: 0.1, envMapIntensity: 1.8, emissive: '#431200', emissiveIntensity: 0.25 });
const OIL_PALE = new THREE.Color('#e8c96a'), OIL_RED = new THREE.Color('#c22e12');

// a dried chili with real parts: a LATHE body (plump shoulder curving
// to a point, slightly wrinkled profile) + stem — glossy red so the
// light rolls off it. (Two-cone version read as a toy traffic cone in
// the macro proof; the lathe profile is the fix.)
const makeChili = (s = 1) => {
  const g = new THREE.Group();
  const prof = [[0.001, 0], [0.020, 0.028], [0.037, 0.075], [0.047, 0.125], [0.044, 0.170], [0.031, 0.208], [0.013, 0.232], [0.004, 0.24]]
    .map(([r, y]) => new THREE.Vector2(r * s, y * s));
  const body = add(new THREE.LatheGeometry(prof, 14), MAT.chiliRed, 0, 0, 0, g);
  body.rotation.z = Math.PI / 2 + 0.22; body.position.set(0.1 * s, 0.055 * s, 0);
  const stem = add(new THREE.CylinderGeometry(0.011 * s, 0.019 * s, 0.07 * s, 8), MAT.chiliStem, -0.135 * s, 0.085 * s, 0, g);
  stem.rotation.z = 0.95;
  return g;
};
// a served dish: bowl + food mound + the red glint of the drop
const makeDish = (s = 1) => {
  const g = new THREE.Group();
  add(new THREE.CylinderGeometry(0.16 * s, 0.09 * s, 0.07 * s, 14), MAT.dishWhite, 0, 0.035 * s, 0, g);
  const mound = add(new THREE.SphereGeometry(0.125 * s, 12, 8), MAT.food, 0, 0.07 * s, 0, g); mound.scale.y = 0.55;
  add(new THREE.SphereGeometry(0.022 * s, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2e16' }), 0.03 * s, 0.145 * s, 0.02 * s, g, { cast: false });
  return g;
};

// ---------- WORLD: the royal kitchen + feast courtyard (ONE set) ----------
const world = new THREE.Group(); scene.add(world);
const TABLES_X = [-4.6, -1.6, 1.4, 4.4];
{ // stone courtyard floor + a worn carpet lane down the centre aisle
  flat(add(new THREE.PlaneGeometry(64, 48), MAT.stone, 0, 0, -2, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(2.2, 12.5), MAT.clothRed, 0, 0.012, 0.8, world, { cast: false }));
}
// --- north wall: the kitchen's back, with three bright arched windows ---
{
  add(tbox(30, 7.4, 0.35, 3), MAT.plaster, 0, 3.7, -10.4, world, { cast: false });
  add(box(30, 1.15, 0.42), MAT.woodDark, 0, 0.57, -10.35, world, { cast: false });
  const winMat = new THREE.MeshBasicMaterial({ color: '#fff3cf', fog: true });
  const window_ = (x) => {
    const g = new THREE.Group(); g.position.set(x, 3.9, -10.2); world.add(g);
    const gl = add(new THREE.PlaneGeometry(2.3, 4.2), winMat, 0, 0, 0, g, { cast: false }); gl.userData.ndSkip = true;
    add(box(2.5, 0.14, 0.1), MAT.woodDark, 0, 2.16, 0.03, g, { cast: false });
    add(box(2.5, 0.14, 0.1), MAT.woodDark, 0, -2.16, 0.03, g, { cast: false });
    add(box(0.14, 4.4, 0.1), MAT.woodDark, -1.22, 0, 0.03, g, { cast: false });
    add(box(0.14, 4.4, 0.1), MAT.woodDark, 1.22, 0, 0.03, g, { cast: false });
    add(new THREE.TorusGeometry(1.22, 0.09, 6, 14, Math.PI), MAT.woodDark, 0, 2.16, 0.03, g, { cast: false });
  };
  window_(-6.4); window_(0); window_(6.4);
  // a long wooden shelf of spice jars along the back wall
  add(box(11, 0.09, 0.5), MAT.wood, -1.5, 2.2, -10.05, world, { cast: false });
  const jarCols = ['#c96a2e', '#a83a2a', '#d9a441', '#5d8a3a', '#8a5aa0', '#c9b458'];
  for (let i = 0; i < 12; i++) {
    const jx = -6.6 + i * 0.95;
    add(new THREE.CylinderGeometry(0.17, 0.19, 0.52, 10), toon({ color: jarCols[i % 6], roughness: 0.7 }), jx, 2.51, -10.05, world, { cast: false });
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10), MAT.woodDark, jx, 2.8, -10.05, world, { cast: false });
  }
}
// --- the hearth line: counter + three copper pots on fires ---
const steamPuffs = [];
{
  add(tbox(10.5, 1.05, 1.0, 2), MAT.stoneDark, -2.25, 0.525, -8.4, world);
  add(box(10.7, 0.08, 1.15), MAT.woodDark, -2.25, 1.09, -8.4, world, { cast: false });
  const potAt = (x) => {
    const g = new THREE.Group(); g.position.set(x, 1.13, -8.4); world.add(g);
    add(new THREE.CylinderGeometry(0.52, 0.4, 0.16, 14), MAT.iron, 0, 0.02, 0, g); // fire stand
    const glow = softGlow(0.85, 0xff7a26, 0.55); glow.position.set(0, 0.12, 0); g.add(glow);
    const body = add(new THREE.SphereGeometry(0.52, 18, 12), MAT.copper, 0, 0.48, 0, g); body.scale.y = 0.82;
    const rim = add(new THREE.TorusGeometry(0.5, 0.045, 8, 20), MAT.copperDark, 0, 0.78, 0, g); rim.rotation.x = Math.PI / 2;
    const lid = add(new THREE.SphereGeometry(0.44, 16, 10), MAT.copper, 0, 0.8, 0, g); lid.scale.y = 0.42;
    add(new THREE.SphereGeometry(0.07, 10, 8), MAT.brassDark, 0, 1.0, 0, g);
    for (const s of [-1, 1]) { const h = add(new THREE.TorusGeometry(0.13, 0.03, 6, 12), MAT.copperDark, s * 0.55, 0.52, 0, g); h.rotation.z = s * 0.5; }
    for (let i = 0; i < 2; i++) {
      const puff = softGlow(0.7, 0xffffff, 0.3); puff.position.set(x, 2.2, -8.4); puff.userData.base = [x, -8.4]; puff.userData.ph = i * 0.53 + x;
      world.add(puff); steamPuffs.push(puff);
    }
  };
  potAt(-5.6); potAt(-3.8); potAt(-2.0);
  // hanging ladles + a stack of firewood at the west end
  for (let i = 0; i < 3; i++) {
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), MAT.iron, -6.9 + i * 0.35, 1.95, -9.9, world, { cast: false });
    add(new THREE.SphereGeometry(0.11, 10, 6), MAT.copperDark, -6.9 + i * 0.35, 1.58, -9.9, world, { cast: false });
  }
  for (let i = 0; i < 4; i++) { const log = add(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), MAT.woodDark, -7.6, 0.12 + (i > 1 ? 0.17 : 0), -8.3 + (i % 2) * 0.2, world); log.rotation.z = Math.PI / 2; }
}
// --- the serving pass: counter, the spoon on its burner, dish stacks ---
let spoonOil, chiliSpoonG, spoonSteam;
{
  add(tbox(2.4, 1.0, 0.7, 2), MAT.stoneDark, 2.3, 0.5, -6.4, world);
  add(box(2.6, 0.07, 0.85), MAT.wood, 2.3, 1.03, -6.4, world, { cast: false });
  // the burner: a squat iron ring with a living flame glow
  const bg = new THREE.Group(); bg.position.set(2.42, 1.06, -6.15); world.add(bg);
  add(new THREE.CylinderGeometry(0.13, 0.16, 0.09, 12), MAT.iron, 0, 0, 0, bg);
  const flame = softGlow(0.34, 0xff8c2e, 0.75); flame.position.set(0, 0.1, 0); bg.add(flame); spoonSteam = flame;
  // THE SPOON: handle + shallow bowl, holding the ghee (and, from the
  // frying beat on, the chili itself)
  const sg = new THREE.Group(); sg.position.set(2.42, 1.17, -6.15); sg.rotation.z = -0.06; world.add(sg);
  const handle = add(box(0.5, 0.025, 0.05), MAT.brassDark, -0.3, 0.01, 0, sg); handle.rotation.y = 0.5;
  add(new THREE.SphereGeometry(0.13, 14, 8), MAT.brass, 0.08, 0, 0, sg).scale.set(1.3, 0.3, 1);
  const rim = add(new THREE.TorusGeometry(0.128, 0.011, 8, 20), MAT.brass, 0.08, 0.032, 0, sg); rim.rotation.x = Math.PI / 2; rim.scale.set(1.3, 1, 1);
  spoonOil = add(new THREE.CircleGeometry(0.105, 14), oilMat, 0.08, 0.028, 0, sg, { cast: false }); spoonOil.rotation.x = -Math.PI / 2;
  chiliSpoonG = makeChili(0.85); chiliSpoonG.position.set(0.08, 0.045, 0); chiliSpoonG.rotation.y = 0.7; sg.add(chiliSpoonG);
  // stacks of clean dishes waiting at the pass
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.17, 0.13, 0.03, 14), MAT.dishWhite, 1.45, 1.09 + i * 0.032, -6.5, world, { cast: false });
  for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.07, 0.05, 0.12, 10), MAT.brass, 3.15, 1.12 + i * 0.005, -6.55, world, { cast: false });
}
// --- the spice chest on its stand (lid opens on the disaster beat) ---
let chestLid, chiliChestG;
{
  const g = new THREE.Group(); g.position.set(5.4, 0, -7.4); world.add(g);
  for (const [lx, lz] of [[-0.34, -0.2], [0.34, -0.2], [-0.34, 0.2], [0.34, 0.2]]) add(box(0.07, 0.55, 0.07), MAT.woodDark, lx, 0.275, lz, g);
  add(box(0.85, 0.06, 0.55), MAT.wood, 0, 0.58, 0, g);
  add(box(0.8, 0.42, 0.52), MAT.woodDark, 0, 0.82, 0, g); // chest body
  add(box(0.84, 0.07, 0.56), MAT.brassDark, 0, 0.68, 0, g, { cast: false }); // brass bands
  add(box(0.84, 0.07, 0.56), MAT.brassDark, 0, 0.97, 0, g, { cast: false });
  add(box(0.1, 0.14, 0.04), MAT.brass, 0, 0.82, 0.28, g, { cast: false }); // clasp
  chestLid = new THREE.Group(); chestLid.position.set(0, 1.03, -0.26); g.add(chestLid);
  add(box(0.8, 0.07, 0.52), MAT.woodDark, 0, 0.035, 0.26, chestLid);
  add(box(0.84, 0.05, 0.1), MAT.brassDark, 0, 0.03, 0.5, chestLid, { cast: false });
  // inside: empty jars on their sides — and ONE chili
  // (the two fallen spice jars that flanked the chili are removed:
  // at macro range they read as plain bricks competing with the
  // pepper — proof f428 v2. The lone chili owns the chest top now.)
  chiliChestG = makeChili(1.15); chiliChestG.position.set(0.02, 1.07, 0.02); chiliChestG.rotation.y = -0.4; g.add(chiliChestG);
  // (no glint sprite on the chest chili — at macro range the star
  // sprite read as a white cross pasted on the pepper; the glossy
  // lathe body carries the moment on its own.)
}
// --- the feast: four long tables, 25 covers each = 100, exactly ---
const servedDishes = [];
{
  // feast STOOLS (seat + legs, no back): the tall chair backs kept
  // photobombing the seated guests' close-ups (proof f1200/f1260 —
  // faces hidden behind back panels); a stool can never occlude.
  const chairAt = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
    add(box(0.46, 0.05, 0.44), MAT.wood, 0, 0.46, 0, g);
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) add(box(0.05, 0.46, 0.05), MAT.woodDark, lx, 0.23, lz, g);
  };
  for (const cx of TABLES_X) {
    add(box(1.6, 0.09, 5.9), MAT.wood, cx, 0.9, -0.5, world);
    flat(add(new THREE.PlaneGeometry(0.8, 5.7), MAT.clothCream, cx, 0.95, -0.5, world, { cast: false }));
    for (const [lx, lz] of [[-0.7, -3.2], [0.7, -3.2], [-0.7, 2.2], [0.7, 2.2]]) add(box(0.09, 0.9, 0.09), MAT.woodDark, cx + lx, 0.45, -0.5 + lz + 0.5, world);
    // 25 covers: 12 down each side + 1 at the head
    const spots = [];
    for (let i = 0; i < 12; i++) { const z = -3.05 + i * 0.465; spots.push([cx - 0.45, z]); spots.push([cx + 0.45, z]); }
    spots.push([cx, 2.32]);
    for (const [sx, sz] of spots) {
      add(new THREE.CylinderGeometry(0.15, 0.11, 0.025, 14), MAT.dishWhite, sx, 0.96, sz, world, { cast: false });
      add(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 10), MAT.brass, sx + 0.17, 0.99, sz + 0.1, world, { cast: false });
      const d = makeDish(0.92); d.position.set(sx, 0.95, sz); d.visible = false; world.add(d); servedDishes.push(d);
    }
  }
  // the serving fill runs EAST table first: the s09 drone starts over
  // the east tables, so the first dropped dishes must be visible there
  servedDishes.reverse();
  // chairs at the four seats the camera watches in the payoff
  chairAt(-2.85, 2.2, Math.PI / 2); chairAt(-0.35, 2.2, -Math.PI / 2);
  chairAt(0.15, 2.2, Math.PI / 2); chairAt(2.65, 2.2, -Math.PI / 2);
}
// --- the king's dais + throne + head table (south head of the feast) ---
{
  add(tbox(3.6, 0.35, 2.4, 2), MAT.stoneDark, 0, 0.175, 7.3, world);
  flat(add(new THREE.PlaneGeometry(3.3, 2.1), MAT.clothRed, 0, 0.36, 7.3, world, { cast: false }));
  const th = new THREE.Group(); th.position.set(0, 0.35, 7.85); world.add(th);
  add(box(0.95, 0.09, 0.85), MAT.clothRed, 0, 0.5, 0, th);
  add(box(0.95, 1.5, 0.1), MAT.clothRed, 0, 1.2, -0.42, th);
  add(box(1.05, 0.12, 0.14), MAT.gold, 0, 1.98, -0.42, th, { cast: false });
  add(new THREE.SphereGeometry(0.09, 10, 8), MAT.gold, 0, 2.1, -0.42, th, { cast: false });
  for (const s of [-1, 1]) add(box(0.1, 0.55, 0.8), MAT.woodDark, s * 0.52, 0.27, 0, th);
  // the king's own table + cover, in front of the throne
  add(box(1.7, 0.07, 0.7), MAT.wood, 0, 0.78, 6.55, world);
  for (const [lx, lz] of [[-0.75, -0.25], [0.75, -0.25], [-0.75, 0.25], [0.75, 0.25]]) add(box(0.07, 0.43, 0.07), MAT.woodDark, lx, 0.56, 6.55 + lz, world);
  add(new THREE.CylinderGeometry(0.16, 0.12, 0.025, 14), MAT.dishWhite, 0, 0.83, 6.55, world, { cast: false });
  const kd = makeDish(1.0); kd.position.set(0, 0.82, 6.55); world.add(kd);
  add(new THREE.CylinderGeometry(0.055, 0.04, 0.16, 10), MAT.gold, 0.35, 0.9, 6.5, world, { cast: false });
}
// --- south facade (the payoff backdrop): arches + banners ---
{
  add(tbox(30, 8.2, 0.35, 3), MAT.plaster, 0, 4.1, 11.6, world, { cast: false });
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffe9bd', fog: true });
  for (const x of [-5.5, 0, 5.5]) {
    const gl = add(new THREE.PlaneGeometry(2.6, 5.2), winMat, x, 3.4, 11.4, world, { cast: false }); gl.userData.ndSkip = true; gl.rotation.y = Math.PI;
    add(box(2.8, 0.16, 0.1), MAT.woodDark, x, 6.05, 11.38, world, { cast: false });
    add(new THREE.TorusGeometry(1.4, 0.1, 6, 14, Math.PI), MAT.woodDark, x, 6.05, 11.38, world, { cast: false });
  }
  for (const x of [-3.4, 3.4]) {
    const bn = add(new THREE.PlaneGeometry(0.95, 3.4), MAT.clothRed, x, 5.6, 11.36, world, { cast: false }); bn.rotation.y = Math.PI;
    add(box(1.05, 0.09, 0.06), MAT.gold, x, 3.85, 11.36, world, { cast: false });
  }
  // side returns + courtyard trees
  for (const sx of [-1, 1]) add(tbox(0.35, 6.4, 24, 3), MAT.plaster, sx * 11.8, 3.2, 0.5, world, { cast: false });
  const treeAt = (x, z, s = 1) => {
    add(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.6 * s, 8), MAT.woodDark, x, 0.8 * s, z, world);
    const c1 = add(new THREE.SphereGeometry(1.15 * s, 12, 9), MAT.leaf, x, 2.3 * s, z, world); c1.scale.y = 0.85;
    const c2 = add(new THREE.SphereGeometry(0.85 * s, 11, 8), MAT.leaf2, x + 0.7 * s, 1.9 * s, z + 0.3, world); c2.scale.y = 0.85;
    const c3 = add(new THREE.SphereGeometry(0.7 * s, 10, 8), MAT.leaf, x - 0.65 * s, 2.7 * s, z - 0.2, world); c3.scale.y = 0.9;
  };
  treeAt(-8.5, 3); treeAt(8.5, 3); treeAt(-8.5, -5); treeAt(8.5, -5); treeAt(-9.6, 8.6, 1.2); treeAt(9.6, 8.6, 1.2);
}
// --- carried trays, the drop bead, the gold chain ---
const makeTray = () => {
  const g = new THREE.Group();
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), MAT.brass, 0, 0, 0, g);
  const d = makeDish(1.0); d.position.set(0, 0.02, 0); g.add(d);
  g.visible = false; scene.add(g); return g;
};
const trayAG = makeTray(), trayBG = makeTray();
const dropG = new THREE.Group(); scene.add(dropG);
{
  const bead = add(new THREE.SphereGeometry(0.038, 10, 8), new THREE.MeshStandardMaterial({ color: '#d42a12', roughness: 0.12, metalness: 0.05, envMapIntensity: 2.2, emissive: '#5a0e00', emissiveIntensity: 0.5 }), 0, 0, 0, dropG, { cast: false });
  bead.scale.y = 1.35;
  const gl = softGlow(0.16, 0xff5a30, 0.8); dropG.add(gl);
  dropG.visible = false;
}
const chainG = new THREE.Group(); scene.add(chainG);
{
  const loop = add(new THREE.TorusGeometry(0.105, 0.02, 8, 22), MAT.gold, 0, 0, 0, chainG, { cast: false }); loop.rotation.x = 1.35;
  add(new THREE.OctahedronGeometry(0.045), MAT.gold, 0, -0.13, 0.045, chainG, { cast: false });
  const gl = FX.glint(0.2); gl.position.set(0.05, 0.03, 0.05); gl.userData.ndSkip = true; gl.userData.baseScale = 0.2; chainG.add(gl); chainG.userData.glint = gl;
  chainG.visible = false;
}
// --- the final hook board on its easel ---
const boardPlane = textBoard(['ONE CHILI', 'A HUNDRED DISHES'], 2.2, 0.78, '#f3e9d2', '#3a2a18', 900, { fsMul: 0.5 });
{
  const [bx, by, bz] = BOARD_POS;
  const eg = new THREE.Group(); eg.position.set(bx, 0, bz); eg.rotation.y = BOARD_RY; world.add(eg);
  for (const s of [-1, 1]) {
    const leg = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.72, 0.7, 0.1, eg); leg.rotation.x = 0.18;
    const leg2 = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.72, 0.7, -0.28, eg); leg2.rotation.x = -0.3;
  }
  add(box(1.7, 0.06, 0.06), MAT.woodDark, 0, 0.52, 0.16, eg);
  boardPlane.position.set(bx, by, bz); boardPlane.rotation.y = BOARD_RY; boardPlane.rotation.x = -0.05;
  world.add(boardPlane); addBoardOccluder(boardPlane, 2.2, 0.78, 'boardK');
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
  // the hearth fire breathes — a living practical, not a flicker
  chandLight.intensity = 1.15 + 0.22 * Math.sin(f * 0.11) + 0.13 * Math.sin(f * 0.043 + 2);
  if (spoonSteam) spoonSteam.material.opacity = 0.55 + 0.3 * Math.sin(f * 0.23) + 0.35 * (Ws.oilK || 0);
  // pot steam: soft puffs rising and thinning on a loop
  for (const puff of steamPuffs) {
    const u = ((f * 0.008 + puff.userData.ph) % 1 + 1) % 1;
    puff.position.set(puff.userData.base[0] + Math.sin(f * 0.02 + puff.userData.ph * 7) * 0.08, 2.05 + u * 1.1, puff.userData.base[1]);
    puff.material.opacity = 0.26 * (1 - u) * (0.7 + 0.3 * Math.sin(f * 0.05 + puff.userData.ph * 9));
    puff.scale.setScalar(0.55 + u * 0.85);
  }
  // the chest: lid swings open, the lone chili waits inside
  chestLid.rotation.x = -(Ws.chestOpen || 0) * 1.85;
  chiliChestG.visible = (Ws.chiliChest ?? 1) > 0;
  if (chiliChestG.userData.glint) chiliChestG.userData.glint.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(f * 0.09));
  // the spoon: chili aboard from the frying beat; the ghee turns red
  chiliSpoonG.visible = (Ws.chiliSpoon ?? 0) > 0;
  oilMat.color.copy(OIL_PALE).lerp(OIL_RED, Ws.oilK || 0);
  oilMat.emissiveIntensity = 0.25 + 0.75 * (Ws.oilK || 0);
  // the hundred dishes fill, cover by cover
  const sn = Ws.servedN || 0;
  for (let i = 0; i < servedDishes.length; i++) servedDishes[i].visible = i < sn;
  // the drop itself
  if (Ws.drop) { dropG.visible = true; dropG.position.set(Ws.drop.x, Ws.drop.y, Ws.drop.z); dropG.scale.setScalar(Ws.drop.s || 1); }
  else dropG.visible = false;
  // carried trays ride their servants' hands
  if (Ws.trayA) { trayAG.visible = true; trayAG.position.set(Ws.trayA.x, Ws.trayA.y, Ws.trayA.z); } else trayAG.visible = false;
  if (Ws.trayB) { trayBG.visible = true; trayBG.position.set(Ws.trayB.x, Ws.trayB.y, Ws.trayB.z); } else trayBG.visible = false;
  // the gold chain travels from the king's hands to the boy's neck
  if (Ws.chain) {
    chainG.visible = true; chainG.position.set(Ws.chain.x, Ws.chain.y, Ws.chain.z); chainG.rotation.y = Ws.chain.ry || 0;
    if (chainG.userData.glint) chainG.userData.glint.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(f * 0.13));
  } else chainG.visible = false;
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
