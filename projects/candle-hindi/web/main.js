import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, TABLE_POS } from './story.js';
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
// a cylinder stretched between two points (tube segments, rope)
const tubeSeg = (a, b, r, mat, parent) => {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 7), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  m.castShadow = false; m.receiveShadow = true; parent.add(m); return m;
};

// ---------- sky (seen only through the door/window gaps) ----------
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
// sun = directional key (warm day shaft / pale night shape light).
// Practicals: candleLight (the flame itself — THE key at night),
// lampLight the hanging lantern, doorLamp by the doorway.
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);
const lampLight = new THREE.PointLight(0xffb45e, 12, 22, 1.8); lampLight.position.set(-0.6, 2.75, -4.6); scene.add(lampLight);
const doorLamp = new THREE.PointLight(0xffa64e, 7, 15, 1.8); doorLamp.position.set(-3.4, 2.2, -7.9); scene.add(doorLamp);

// ---------- text-board helper ----------
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

// ---------- painted canvases ----------
const dirtCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 36;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    const dark = rnd() > 0.45;
    gr.addColorStop(0, dark ? 'rgba(52,34,16,0.5)' : 'rgba(214,178,128,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.06 + rnd() * 0.09; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,232,190,0.07)' : 'rgba(28,16,6,0.09)'; g.fillRect(rnd() * 512, rnd() * 512, 2.4, 2.4); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(60,40,20,0.25)'; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 2 + rnd() * 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const mudCanvas = (seed, base) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 46;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(70,44,20,0.20)' : 'rgba(255,226,170,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(226,192,120,${0.10 + rnd() * 0.14})`; g.lineWidth = 1.4;
    const x = rnd() * 512, y = rnd() * 512, a = rnd() * 3.14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke();
  }
  for (let i = 0; i < 700; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,230,190,0.05)' : 'rgba(30,18,8,0.06)'; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const MAT = {
  dirt: toon({ map: dirtCanvas(191), color: '#a0805e' }),
  dirtLight: toon({ map: dirtCanvas(77), color: '#b89a72' }),
  mud: toon({ map: mudCanvas(5, '#a97e4e'), color: '#b28a58' }),
  mudDk: toon({ map: mudCanvas(6, '#8a6538'), color: '#a37c4e' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  ironDk: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.5 }),
  lampGlass: new THREE.MeshBasicMaterial({ color: 0xffc36a }),
  dark: toon({ color: '#33302c' }),
  clothRed: toon({ color: '#7a1f1f' }), clothGold: toon({ color: '#b8862e' }), clothDk: toon({ color: '#571313' }),
  bookCover: toon({ color: '#6a2a1e' }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 0.9 }),
  clay: toon({ color: '#9a5a34' }), clayDk: toon({ color: '#7c4526' }),
  wax: toon({ color: '#e6d7b8' }),
  oilSurf: new THREE.MeshStandardMaterial({ color: 0xd9a83c, roughness: 0.15, metalness: 0.1, envMap, envMapIntensity: 1.2 }),
  tube: new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.6, metalness: 0.25, envMap, envMapIntensity: 0.4 }),
  flameOut: new THREE.MeshBasicMaterial({ color: 0xff8c1f, transparent: true, opacity: 0.8, fog: false }),
  flameIn: new THREE.MeshBasicMaterial({ color: 0xffd76a, fog: false }),
  nightWin: new THREE.MeshBasicMaterial({ color: 0x27354f, fog: false }),
};

// ---------- THE MONEYLENDER'S ROOM ----------
// Back wall z=-8.5 (doorway gap x -4.4..-2.6), side walls x=+-7.5, the
// tall candle table at TABLE_POS (1.3,-3.4), charpai left, shelf right.
const world = new THREE.Group(); scene.add(world);
const lanternGlows = [];
const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const gg = c.getContext('2d'); const gr = gg.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,205,130,0.85)'); gr.addColorStop(1, 'rgba(255,205,130,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const lanternPools = [];
const makeLantern = (parent, x, y, z, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  add(box(0.2, 0.05, 0.2), MAT.ironDk, 0, 0.14, 0, g, { cast: false });
  add(box(0.15, 0.24, 0.15), MAT.lampGlass, 0, 0, 0, g, { cast: false });
  add(box(0.21, 0.04, 0.21), MAT.ironDk, 0, -0.14, 0, g, { cast: false });
  const gl = softGlow(1.6, '#ffb45e', 0.4); g.add(gl); lanternGlows.push(gl);
  return g;
};
{
  const g = world;
  MAT.dirt.map.repeat.set(14, 14);
  const ground = flat(add(new THREE.CircleGeometry(60, 36), MAT.dirt, 0, -0.02, -2, g, { cast: false }));
  ground.scale.set(1.25, 1, 1);
  MAT.dirtLight.map.repeat.set(5, 5);
  flat(add(new THREE.PlaneGeometry(13, 10), MAT.dirtLight, 0, 0.005, -3.6, g, { cast: false }));
  // ---- walls: back (two spans + lintel over the doorway), sides, beams
  add(tbox(4.1, 3.6, 0.3, 2), MAT.mud, -6.45, 1.8, -8.5, g, { cast: false });
  add(tbox(10.1, 3.6, 0.3, 2), MAT.mud, 2.45, 1.8, -8.5, g, { cast: false });
  add(tbox(1.8, 1.15, 0.3, 2), MAT.mud, -3.5, 3.02, -8.5, g, { cast: false });
  add(tbox(0.3, 3.6, 12.5, 2), MAT.mudDk, -7.5, 1.8, -2.4, g, { cast: false });
  add(tbox(0.3, 3.6, 12.5, 2), MAT.mudDk, 7.5, 1.8, -2.4, g, { cast: false });
  for (const bx of [-4.5, -1.5, 1.5, 4.5]) add(tbox(0.22, 0.24, 12.6, 2), MAT.woodDk, bx, 3.62, -2.4, g, { cast: false });
  // the open door panel, swung inside against the wall
  const door = add(tbox(1.7, 2.42, 0.07, 2), MAT.wood, -4.62, 1.21, -7.4, g, { cast: false }); door.rotation.y = 0.5;
  // a window on the right wall: night-blue pane + bars (bright by day)
  add(box(0.06, 1.15, 1.3), MAT.woodDk, 7.32, 1.95, -4.6, g, { cast: false });
  const winPane = add(box(0.04, 1.0, 1.15), MAT.nightWin, 7.3, 1.95, -4.6, g, { cast: false }); winPane.userData.ndSkip = true;
  for (const bz of [-4.95, -4.6, -4.25]) add(box(0.05, 1.0, 0.045), MAT.woodDk, 7.28, 1.95, bz, g, { cast: false });
  // ---- hanging lantern centre-room + door lantern
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.85, 4), MAT.dark, -0.6, 3.2, -4.6, g, { cast: false });
  makeLantern(g, -0.6, 2.68, -4.6, 1.05);
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lp.rotation.x = -Math.PI / 2; lp.position.set(-0.6, 0.025, -4.6); lp.userData.ndSkip = true; g.add(lp); lanternPools.push(lp);
  makeLantern(g, -3.35, 2.3, -7.95, 0.9);
  // ---- charpai (left) with a folded blanket
  const cp = new THREE.Group(); cp.position.set(-3.9, 0, -4.9); cp.rotation.y = 0.45; g.add(cp);
  add(tbox(2.0, 0.09, 0.85, 2), MAT.wood, 0, 0.42, 0, cp, { cast: false });
  for (const [lx, lz] of [[-0.9, -0.34], [0.9, -0.34], [-0.9, 0.34], [0.9, 0.34]])
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 6), MAT.woodDk, lx, 0.21, lz, cp, { cast: false });
  add(tbox(0.8, 0.09, 0.7, 2), MAT.clothRed, -0.5, 0.51, 0, cp, { cast: false });
  // ---- shelf on the back wall: clay pots, coin sacks, a strongbox
  add(tbox(2.6, 0.06, 0.5, 2), MAT.wood, 4.3, 1.95, -8.2, g, { cast: false });
  add(tbox(2.6, 0.06, 0.5, 2), MAT.wood, 4.3, 1.15, -8.2, g, { cast: false });
  const potA = add(new THREE.SphereGeometry(0.3, 10, 8), MAT.clay, 3.5, 2.2, -8.2, g, { cast: false }); potA.scale.set(1, 0.85, 1);
  const potB = add(new THREE.SphereGeometry(0.23, 10, 8), MAT.clayDk, 4.15, 2.15, -8.2, g, { cast: false }); potB.scale.set(1, 0.85, 1);
  add(tbox(0.55, 0.38, 0.4, 2), MAT.woodDk, 5.15, 1.37, -8.2, g, { cast: false });
  add(box(0.57, 0.06, 0.42), MAT.ironDk, 5.15, 1.58, -8.2, g, { cast: false });
  for (const [sx, sz, ss] of [[-1.9, -6.9, 1], [-1.35, -7.05, 0.8], [5.9, -6.6, 0.9]]) {
    const sack = add(new THREE.SphereGeometry(0.34 * ss, 9, 7), MAT.clothGold, sx, 0.24 * ss, sz, g, { cast: false }); sack.scale.set(1, 0.78, 1);
    add(new THREE.CylinderGeometry(0.09 * ss, 0.13 * ss, 0.12, 7), MAT.clothGold, sx, 0.48 * ss, sz, g, { cast: false });
  }
  // stacked crates + barrel (the household goods moved on the day)
  add(tbox(0.85, 0.62, 0.7, 2), MAT.wood, -5.6, 0.31, -7.6, g, { cast: false });
  add(tbox(0.7, 0.5, 0.6, 2), MAT.woodDk, -5.55, 0.87, -7.55, g, { cast: false });
  add(new THREE.CylinderGeometry(0.34, 0.3, 0.85, 10), MAT.wood, -6.35, 0.43, -6.7, g, { cast: false });
  // ---- the rope barrier in front of the candle table (none may approach)
  for (const px of [0.05, 2.55]) add(new THREE.CylinderGeometry(0.045, 0.055, 0.78, 7), MAT.woodDk, px, 0.39, -2.15, g, { cast: false });
  tubeSeg(new THREE.Vector3(0.05, 0.74, -2.15), new THREE.Vector3(1.3, 0.6, -2.08), 0.022, MAT.clothRed, g);
  tubeSeg(new THREE.Vector3(1.3, 0.6, -2.08), new THREE.Vector3(2.55, 0.74, -2.15), 0.022, MAT.clothRed, g);
}
// ---------- THE TALL TABLE + CANDLE + TUBE + OIL POT ----------
// tableG carries the top, legs, candle, bowl and the tube's UPPER segment;
// on the moving day the whole group shifts (worldAt.tableX) and the tube
// snaps at its mid joint. The oil pot and the tube's LOWER segment stay.
const tableG = new THREE.Group(); tableG.position.set(TABLE_POS[0], 0, TABLE_POS[1]); world.add(tableG);
{
  const g = tableG;
  add(tbox(1.6, 0.07, 1.0, 2), MAT.wood, 0, 1.06, 0, g, { cast: false });
  for (const [lx, lz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.06, 1.03, 7), MAT.woodDk, lx, 0.52, lz, g, { cast: false });
  // the cloth drape on the front edge — it hides the tube's top run
  add(tbox(1.6, 0.24, 0.03, 2), MAT.clothDk, 0, 0.94, 0.51, g, { cast: false });
  // brass candle holder + the eternal candle (wax never melts: full height)
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 12), MAT.brass, 0, 1.12, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.035, 0.05, 0.1, 8), MAT.brass, 0, 1.18, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.055, 0.062, 0.34, 10), MAT.wax, 0, 1.38, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 4), MAT.dark, 0, 1.57, 0, g, { cast: false });
  // the coin bowl on the table's right corner + a small stack of coins
  add(new THREE.CylinderGeometry(0.15, 0.1, 0.08, 12), MAT.brass, 0.58, 1.13, 0.26, g, { cast: false });
  for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.042, 0.042, 0.011, 10), MAT.brass, 0.53 + i * 0.05, 1.175, 0.24 + (i % 2) * 0.045, g, { cast: false });
  // the account ledger on the table's left corner
  add(tbox(0.42, 0.04, 0.3, 2), MAT.bookCover, -0.5, 1.11, -0.22, g, { cast: false });
}
// the flame: outer + inner teardrops and a warm glow — the room's key
// practical. Driven per-frame by worldAt (flameK / blowK).
const flameG = new THREE.Group(); flameG.position.set(0, 1.6, 0); tableG.add(flameG);
const flameOut = add(new THREE.SphereGeometry(0.045, 8, 8), MAT.flameOut, 0, 0.05, 0, flameG, { cast: false });
flameOut.scale.set(1, 1.95, 1); flameOut.userData.ndSkip = true;
const flameIn = add(new THREE.SphereGeometry(0.024, 8, 8), MAT.flameIn, 0, 0.028, 0, flameG, { cast: false });
flameIn.scale.set(1, 1.9, 1); flameIn.userData.ndSkip = true;
const flameGlow = softGlow(1.05, '#ffb45e', 0.42); flameGlow.position.set(0, 0.06, 0); flameG.add(flameGlow);
const candleLight = new THREE.PointLight(0xffa64e, 10, 15, 1.7); candleLight.position.set(0, 1.88, 0); tableG.add(candleLight);
const flamePool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
flamePool.rotation.x = -Math.PI / 2; flamePool.position.set(0, 0.03, 0); flamePool.scale.setScalar(0.67); flamePool.userData.ndSkip = true; tableG.add(flamePool);
// the oil pot under the table (stays behind when the table moves)
const potG = new THREE.Group(); potG.position.set(TABLE_POS[0], 0, TABLE_POS[1]); world.add(potG);
{
  const pot = add(new THREE.SphereGeometry(0.29, 12, 9), MAT.clayDk, 0, 0.22, 0, potG, { cast: false }); pot.scale.set(1, 0.85, 1);
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 10), MAT.clayDk, 0, 0.47, 0, potG, { cast: false });
  const oil = add(new THREE.CircleGeometry(0.15, 12), MAT.oilSurf, 0, 0.5, 0, potG, { cast: false }); oil.rotation.x = -Math.PI / 2; oil.userData.ndSkip = true;
}
// THE TUBE: lower segment pot -> joint (static), upper segment joint ->
// candle base (child of tableG, pivots at the joint so it can droop when
// snapped). Joint at world (TABLE_POS[0]-0.18, 0.58, TABLE_POS[1]).
const tubeLowPivot = new THREE.Group(); tubeLowPivot.position.set(TABLE_POS[0] + 0.02, 0.5, TABLE_POS[1]); world.add(tubeLowPivot);
tubeSeg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.2, 0.08, 0), 0.021, MAT.tube, tubeLowPivot);
const tubeUpPivot = new THREE.Group(); tubeUpPivot.position.set(-0.18, 0.58, 0); tableG.add(tubeUpPivot);
tubeSeg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.44, 0), 0.021, MAT.tube, tubeUpPivot);
tubeSeg(new THREE.Vector3(0.02, 0.44, 0), new THREE.Vector3(0.18, 0.52, 0), 0.021, MAT.tube, tubeUpPivot);
// ---------- boards ----------
// The hook board stands before the back wall; its transform is mirrored
// in boards.json — keep in sync. Position set ONCE here; posts stand
// OUTSIDE the panel span (panel half-width 1.95, posts at +-2.08).
const boardHook = textBoard(['लेकिन कल...', 'वह किताब जो खुद', 'बोलकर पढ़ती थी?'], 3.9, 1.6, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.26, dy: 0.03 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.6, 'hookK');
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, BOARD_POS[0] - 2.08, 0.6, BOARD_POS[2] - 0.08, world, { cast: false });
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, BOARD_POS[0] + 2.08, 0.6, BOARD_POS[2] - 0.08, world, { cast: false });
// ---------- FX: dust motes in the lantern light + oil glint + death puff ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(-0.6, 2.5, -4.6, { rate: 0.4, color: 0xffd9a0, opacity: 0.07, scale: 0.4, grow: 1.2, life: 3.4, vy: -0.03, wind: 0.05 });
const blastEmit = smoke.addEmitter(0, 1.6, -30, { rate: 0, color: 0x9a8a76, opacity: 0.3, scale: 0.7, grow: 1.8, life: 1.6, vy: 0.35, wind: 0.1 });
const sparkEmit = smoke.addEmitter(1.3, 0.6, -3.4, { rate: 0, color: 0xffd76a, opacity: 0.6, scale: 0.26, grow: 0.6, life: 0.8, vy: 0.1, wind: 0.02 });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    moteEmit.rate = pr.moteRate * 3;
    blastEmit.rate = pr.blastRate * 3; blastEmit.x = Ws.blastX; blastEmit.y = Ws.blastY; blastEmit.z = Ws.blastZ;
    sparkEmit.rate = pr.sparkRate * 3; sparkEmit.x = Ws.oilX; sparkEmit.y = Ws.oilY; sparkEmit.z = Ws.oilZ;
    smoke.update(t, dt);
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

// ---------- word-by-word captions (the reference's signature) ----------
// Screen-space overlay rendered AFTER the dof pass: one word at a time,
// bold white with a thick black stroke, centred, baseline ~79% of frame
// height, timed from the char-mapped script words (web/words.js).
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
    capG.font = '900 74px "Noto Sans Devanagari", Arial, sans-serif';
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
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.hookK ?? 1; boardHook.visible = (Ws.hookK ?? 1) > 0.01;
  // the table shift (moving day) + the snapped tube's droop
  tableG.position.x = TABLE_POS[0] + (Ws.tableX || 0);
  tubeUpPivot.rotation.z = -0.38 * (Ws.snapK || 0);
  tubeLowPivot.rotation.z = 0.22 * (Ws.snapK || 0);
  // THE FLAME: brightest at source, soft flicker; bends under a blow,
  // dies with the snap. Its light + pool + glow follow flameK.
  const fk = Ws.flameK ?? 1;
  const flick = 0.9 + 0.1 * Math.sin(f * 0.42) * Math.sin(f * 0.17 + 1.3);
  flameG.visible = fk > 0.02;
  flameG.scale.set(1 + 0.1 * (Ws.blowK || 0), Math.max(0.05, fk) * flick, 1);
  flameG.rotation.z = -0.65 * (Ws.blowK || 0);
  flameGlow.material.opacity = 0.42 * fk * flick;
  candleLight.intensity = 10 * fk * flick;
  flamePool.material.opacity = 0.13 * fk * flick;
  const lf = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  lampLight.intensity = 11 * (Ws.lampK ?? 1) * lf;
  doorLamp.intensity = 7 * (Ws.lampK ?? 1) * (2 - lf) * 0.6;
  lanternGlows.forEach((gl, i) => { gl.material.opacity = 0.36 * (Ws.lampK ?? 1) * (0.9 + 0.1 * Math.sin(f * 0.3 + i * 2.1)); });
  lanternPools.forEach((lp) => { lp.material.opacity = 0.13 * (Ws.lampK ?? 1) * lf; });
  MAT.nightWin.color.set(Ws.winCol || '#27354f');
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
  drawCaption(f);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
