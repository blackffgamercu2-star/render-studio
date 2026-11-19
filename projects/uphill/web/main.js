import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, LOCK, LOCK_RISE, MILL, TABLE, PRIEST_HOUSE, HUT1, HUT2, BANK_Z, boatAt, boat2At, waterLevelAt, gateNorthAt, gateWestAt } from './story.js';
import { WORDS } from './words.js';

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

const MAT = {
  bank: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 12, 8, '#a8aeac'),
  bankWet: texM(M4.groundDetail(P.stone(66, 40, 5, 52), 191, { dots: 900 }), 6, 3, '#7a8084'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c8c0ae'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a39c8a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  sand: texM(M4.sandV4(15), 6, 6, '#c9b48a'),
  sail: toon({ color: '#e7dfc8' }),
  hullA: toon({ color: '#7a3a26' }), hullB: toon({ color: '#2e4a5e' }),
  cloth: toon({ color: '#e8e0cc' }), rope: toon({ color: '#9a7c50' }),
  gold: toon({ color: '#e8b64c' }), dark: toon({ color: '#33302c' }), white: toon({ color: '#f7f3e6' }),
  leaf: toon({ color: '#4a7a34' }),
  chamberWater: toon({ color: '#35565c', transparent: true, opacity: 0.9 }),
  sluiceWater: toon({ color: '#cfe8e8', transparent: true, opacity: 0.0 }),
  net: toon({ color: '#8a7a5a' }),
};

// ---------- the riverbank + lock ----------
const world = new THREE.Group(); scene.add(world);
let water = null;
const flags = [];
{
  const g = world;
  // the river (shader water; colours follow the grade in worldState)
  water = FX.makeWater({ size: 200, seg: 72, deep: 0x2e4a52, shallow: 0x5d8288, sky: 0xc3ccd0, amp: 0.3, spark: 0.5 });
  water.position.set(0, -0.35, -62); water.userData.ndSkip = true; g.add(water);
  // the bank: a broad stone slab, top at y=0, river beyond z=BANK_Z
  add(tbox(48, 0.8, 29, 3), MAT.bank, 0, -0.4, 2.5, g, { cast: false });
  add(tbox(48, 0.22, 0.5, 2), MAT.stoneDk, 0, -0.11, BANK_Z + 0.25, g, { cast: false });   // bank edge rim
  // wet sheen strip along the river edge (the creeping water's mark)
  const wet = flat(add(new THREE.PlaneGeometry(48, 2.2), MAT.bankWet, 0, 0.012, BANK_Z + 1.4, g, { cast: false }));
  // mooring bollards + crates/barrels along the bank
  for (let bx = -20; bx <= 20; bx += 5) add(new THREE.CylinderGeometry(0.16, 0.19, 0.55, 9), MAT.woodDk, bx, 0.1, BANK_Z + 0.8, g, { cast: false });
  for (const [cx, cz] of [[-18, 8], [18, 10], [-16, -8], [19, -6]]) {
    const cr = FX.crate(1.15); cr.position.set(cx, 0.58, cz); cr.rotation.y = cx * 0.7; g.add(cr);
    const br = FX.barrel(0.42, 1.0); br.position.set(cx + 1.1, 0.5, cz + 0.4); g.add(br);
  }
  // ---- the lock: stone chamber, stepped buttresses, gates ----
  // north wall (river side) in two segments with the entrance gap x -12..-8
  add(tbox(2, 6, 0.8, 2), MAT.stone, -13, 3, LOCK.z0 - 0.2, g, { cast: false });
  add(tbox(2, 6, 0.8, 2), MAT.stone, -7, 3, LOCK.z0 - 0.2, g, { cast: false });
  // stepped buttresses on the north wall (the staircase silhouette)
  add(tbox(0.9, 3.2, 1.1, 1), MAT.stoneDk, -13.6, 1.6, LOCK.z0 - 0.6, g, { cast: false });
  add(tbox(0.9, 4.4, 1.1, 1), MAT.stoneDk, -11.4, 2.2, LOCK.z0 - 0.6, g, { cast: false });
  add(tbox(0.9, 5.6, 1.1, 1), MAT.stoneDk, -8.6, 2.8, LOCK.z0 - 0.6, g, { cast: false });
  // west wall in two segments with the exit gap z -10.5..-7.5
  add(tbox(0.8, 6, 1.5, 2), MAT.stone, LOCK.x0 - 0.2, 3, -11.25, g, { cast: false });
  add(tbox(0.8, 6, 1.5, 2), MAT.stone, LOCK.x0 - 0.2, 3, -6.75, g, { cast: false });
  // east wall (solid)
  add(tbox(0.8, 6, 6, 2), MAT.stone, LOCK.x1 - 0.2, 3, LOCK.cz, g, { cast: false });
  // south parapet (low, h 1.0 — the camera sees the rising boat over it)
  add(tbox(8, 1.0, 0.8, 2), MAT.stoneDk, LOCK.cx, 0.5, LOCK.z1 - 0.2, g, { cast: false });
  // chamber floor
  add(tbox(8, 0.4, 6, 2), MAT.stoneDk, LOCK.cx, LOCK.floorY - 0.2, LOCK.cz, g, { cast: false });
  // the upper canal (west, water at y=4.4) — stone channel + water plane
  add(tbox(8, 0.8, 6, 2), MAT.stone, -18, LOCK_RISE - 0.4, LOCK.cz, g, { cast: false });
  add(tbox(8, 1.2, 0.5, 1), MAT.stoneDk, -18, LOCK_RISE + 0.2, LOCK.z0 - 0.2, g, { cast: false });
  add(tbox(8, 1.2, 0.5, 1), MAT.stoneDk, -18, LOCK_RISE + 0.2, LOCK.z1 - 0.2, g, { cast: false });
  // the town: mill house, priest's house, two huts
  const millHut = PR.buildHut({ w: 4.8, d: 3.8, h: 2.7, wall: 'planks', seed: 23, envMap });
  millHut.group.position.set(MILL.x, 0, MILL.z); millHut.group.rotation.y = Math.PI / 2; g.add(millHut.group);
  const priestHut = PR.buildHut({ w: 4.6, d: 3.6, h: 2.6, wall: 'plaster', seed: 31, envMap });
  priestHut.group.position.set(PRIEST_HOUSE.x, 0, PRIEST_HOUSE.z); priestHut.group.rotation.y = -Math.PI / 2; g.add(priestHut.group);
  const hut1 = PR.buildHut({ w: 4.2, d: 3.4, h: 2.5, wall: 'plaster', seed: 41, envMap });
  hut1.group.position.set(HUT1.x, 0, HUT1.z); hut1.group.rotation.y = 0.3; g.add(hut1.group);
  const hut2 = PR.buildHut({ w: 4.0, d: 3.2, h: 2.4, wall: 'stone', seed: 47, envMap });
  hut2.group.position.set(HUT2.x, 0, HUT2.z); hut2.group.rotation.y = -0.4; g.add(hut2.group);
  // the miller's supper table + lamp
  add(tbox(1.7, 0.09, 1.0, 2), MAT.wood, TABLE.x, 0.74, TABLE.z, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), MAT.woodDk, TABLE.x + lx, 0.37, TABLE.z + lz, g, { cast: false });
  add(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 10), MAT.cloth, TABLE.x - 0.4, 0.84, TABLE.z, g, { cast: false }); // bread bowl
  add(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 8), MAT.dark, TABLE.x + 0.7, 0.93, TABLE.z - 0.2, g, { cast: false }); // jug
  const lampPole = add(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), MAT.woodDk, TABLE.x - 0.9, 1.1, TABLE.z - 0.4, g, { cast: false });
  const lamp = add(new THREE.SphereGeometry(0.16, 10, 8), toon({ color: '#ffbe78' }), TABLE.x - 0.9, 2.25, TABLE.z - 0.4, g, { cast: false });
  const lampGlow = softGlow(2.2, '#ffb45e', 0.55); lampGlow.position.set(TABLE.x - 0.9, 2.25, TABLE.z - 0.4); g.add(lampGlow);
  // fishermen's dropped nets at the river edge
  for (const [nx, nz] of [[6, -10.5], [-1, -10.5]]) {
    const net = add(new THREE.SphereGeometry(0.55, 10, 8), MAT.net, nx, 0.12, nz, g, { cast: false });
    net.scale.set(1.3, 0.25, 1.1);
    add(new THREE.TorusGeometry(0.3, 0.04, 6, 14), MAT.rope, nx + 0.5, 0.1, nz + 0.4, g, { cast: false }).rotation.x = Math.PI / 2;
  }
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}
// ---- lock gates (animated panels) ----
// north gate (entrance, gap x -12..-8 at z=-12): two 2.0-wide panels,
// hinged at the gap edges, swinging open into the chamber (south)
const gateN1 = new THREE.Group(); gateN1.position.set(-12, 0, LOCK.z0); world.add(gateN1);
const gateN1Panel = add(tbox(2.0, 5.4, 0.22, 2), MAT.woodDk, 1.0, 2.7, 0, gateN1);
const gateN2 = new THREE.Group(); gateN2.position.set(-8, 0, LOCK.z0); world.add(gateN2);
const gateN2Panel = add(tbox(2.0, 5.4, 0.22, 2), MAT.woodDk, -1.0, 2.7, 0, gateN2);
// west gate (exit, gap z -10.5..-7.5 at x=-14): two 1.5-wide panels
const gateW1 = new THREE.Group(); gateW1.position.set(LOCK.x0, 0, -10.5); world.add(gateW1);
const gateW1Panel = add(tbox(0.22, 5.4, 1.5, 2), MAT.woodDk, 0, 2.7, 0.75, gateW1);
const gateW2 = new THREE.Group(); gateW2.position.set(LOCK.x0, 0, -7.5); world.add(gateW2);
const gateW2Panel = add(tbox(0.22, 5.4, 1.5, 2), MAT.woodDk, 0, 2.7, -0.75, gateW2);
// ---- chamber water + sluice pour + upper canal water ----
const chamberWater = flat(add(new THREE.PlaneGeometry(7.6, 5.6), MAT.chamberWater, LOCK.cx, 0, LOCK.cz, world, { cast: false }));
chamberWater.userData.ndSkip = true;
const canalWater = flat(add(new THREE.PlaneGeometry(7.6, 5.6), MAT.chamberWater, -18, LOCK_RISE + 0.02, LOCK.cz, world, { cast: false }));
canalWater.userData.ndSkip = true;
const sluice = add(new THREE.PlaneGeometry(1.4, 5.2), MAT.sluiceWater, -12, 2.6, LOCK.z0 - 0.7, world, { cast: false });
sluice.userData.ndSkip = true;
// the creeping water: a soft-edged raised sheet that carries the second
// boat up as the water creeps (L2) — without it the boat floats in air
const creepSwellTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g2 = c.getContext('2d');
  const grd = g2.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(93,130,136,0.95)'); grd.addColorStop(0.6, 'rgba(93,130,136,0.75)'); grd.addColorStop(1, 'rgba(93,130,136,0)');
  g2.fillStyle = grd; g2.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
const creepSwell = flat(add(new THREE.PlaneGeometry(6.5, 5), new THREE.MeshBasicMaterial({ map: creepSwellTex, transparent: true, opacity: 0, depthWrite: false }), 0, -5, 0, world, { cast: false }));
creepSwell.userData.ndSkip = true; creepSwell.renderOrder = 1;
// ---- the miller's wiping cloth (in his hands on the truth beat) ----
const cloth = add(new THREE.PlaneGeometry(0.4, 0.28), toon({ color: '#f2ead8', side: THREE.DoubleSide }), 0, -5, 0, world, { cast: false });
cloth.userData.ndSkip = true;

// ---------- boats ----------
// hull + mast + yard + cloth sail + crates (loaded). Story drives
// per-boat position from worldAt.
const makeBoat = (hullMat, loaded) => {
  const grp = new THREE.Group();
  const hull = add(tbox(2.9, 0.62, 1.15, 2), hullMat, 0, 0.32, 0, grp);
  const bow = add(new THREE.CylinderGeometry(0.58, 0.58, 0.62, 3, 1), hullMat, 1.72, 0.32, 0, grp);
  bow.rotation.y = Math.PI; bow.scale.set(1, 1, 0.99);
  add(tbox(3.1, 0.1, 1.3, 2), MAT.woodDk, 0, 0.66, 0, grp);                       // gunwale
  add(new THREE.CylinderGeometry(0.055, 0.075, 3.6, 8), MAT.woodDk, 0.1, 2.4, 0, grp); // mast
  const yard = add(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 7), MAT.woodDk, 0.1, 3.95, 0, grp); yard.rotation.x = Math.PI / 2;
  const sailGeo = new THREE.PlaneGeometry(2.05, 2.5, 12, 10); sailGeo.translate(0, -1.25, 0);
  const sail = new THREE.Mesh(sailGeo, MAT.sail);
  sail.material.side = THREE.DoubleSide; sail.castShadow = true;
  sail.position.set(0.1, 3.92, 0); grp.add(sail);
  FX.clothInit(sail, { amp: 0.2, freq: 2.6, speed: 6 });
  if (loaded) {
    const cr1 = FX.crate(0.7); cr1.position.set(-0.8, 0.95, 0); grp.add(cr1);
    const cr2 = FX.crate(0.6); cr2.position.set(0.4, 0.9, 0.2); grp.add(cr2);
    const br = FX.barrel(0.3, 0.7); br.position.set(1.0, 1.0, -0.2); grp.add(br);
  }
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.6), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, opacity: 0.5, color: 0x06222b, depthWrite: false }));
  wl.rotation.x = -Math.PI / 2; wl.position.set(0.2, 0.05, 0); wl.userData.ndSkip = true; wl.renderOrder = 1; grp.add(wl);
  const pen = add(new THREE.PlaneGeometry(0.62, 0.3, 8, 3), toon({ color: '#c23b2e', side: THREE.DoubleSide }), 0.15, 4.05, 0, grp, { cast: false });
  pen.geometry.translate(0.31, 0, 0); FX.clothInit(pen, { amp: 0.1, freq: 3.6, speed: 8 }); flags.push(pen);
  grp.userData.sail = sail; grp.userData.pennant = pen;
  world.add(grp);
  return grp;
};
const boats = [
  { g: makeBoat(MAT.hullA, true) },    // hero boat (enters the lock)
  { g: makeBoat(MAT.hullB, true) },    // second loaded boat (creeps up the slope)
];

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard(['The Night the River', 'Flowed Uphill'], 4.6, 1.3, '#1c2f3a', '#d8e8e8', 900, { fsMul: 0.62, pitch: 0.36, dy: 0.03 });
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.3, 'boardTitle');
const boardHook = textBoard(['But tomorrow… the king', 'who woke up on the biggest', 'day of his life — with', 'no voice at all?'], 4.6, 1.5, '#1c2f3a', '#e8f0f0', 900, { pitch: 0.20, dy: 0.01, fsMul: 0.92 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: mist, clouds, wake ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 2, { rate: 0.15, color: 0xd8e8e8, opacity: 0.06, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const mistEmit = smoke.addEmitter(-2, 0.6, -14, { rate: 0.3, color: 0xcfe0e0, opacity: 0.12, scale: 1.4, grow: 1.6, life: 3.2, vy: 0.05, wind: 0.2 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.22, color: 0xe8ecec, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const wake = new FX.Wake(scene, 40); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  wake.pool.forEach((p) => { p.life = -1; p.m.visible = false; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    dustEmit.rate = pr.smokeRate * 3;
    mistEmit.rate = 0.9;
    const bp = boatAt(fxF);
    if (pr.splashRate > 0.05) wake.trail(bp.x - 1.6, bp.z, dt, 1.15);
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    wake.update(t, dt);
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

// ---------- V3 word-by-word captions ----------
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
  if (i >= 0) {
    const gap = t - WORDS[i].e;
    const next = WORDS[i + 1];
    if (!(gap > 0.34 && (!next || next.s - t > 0.05))) word = WORDS[i].w;
  }
  if (word === capKey) return;
  capKey = word;
  capG.clearRect(0, 0, W, H);
  if (word) {
    capG.font = '900 74px Arial, Helvetica, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.76);
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
  const L = lightFor(shotAt(f), f);
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // river follows the grade
  if (water) {
    water.material.uniforms.uDeep.value.set(L.waterDeep); water.material.uniforms.uShallow.value.set(L.waterShal);
    water.material.uniforms.uAmp.value = 0.22;
    water.material.uniforms.uSpark.value = 0.3;
    water.userData.update(f / 30);
  }
  // the chamber water rises with the lock; the sluice pours while it fills
  chamberWater.position.y = (Ws.waterLevel || 0) + 0.02;
  // the creeping water sheet rises with the second boat (L2) so it never floats
  const b2k = THREE.MathUtils.clamp(((Ws.boat2Y || 0) + 0.3) / 0.65, 0, 1);
  creepSwell.visible = b2k > 0.02;
  if (creepSwell.visible) { creepSwell.position.set(Ws.boat2X, Ws.boat2Y - 0.02, Ws.boat2Z); creepSwell.material.opacity = b2k * 0.85; }
  MAT.sluiceWater.opacity = (Ws.sluiceK || 0) * 0.75;
  sluice.visible = (Ws.sluiceK || 0) > 0.02;
  // lock gates: north (entrance) open until the boat is in, west (exit)
  // closed until the boat sails out on the higher water
  const gn = gateNorthAt(f), gw = gateWestAt(f);
  gateN1.rotation.y = (1 - gn) * 0 + gn * 1.75;
  gateN2.rotation.y = -gn * 1.75;
  gateW1.rotation.y = -gw * 1.75;
  gateW2.rotation.y = gw * 1.75;
  // the wiping cloth rides in the miller's hands on the truth beat
  cloth.visible = (Ws.clothK || 0) > 0.01;
  if (cloth.visible) { cloth.position.set(Ws.clothX, Ws.clothY, Ws.clothZ); cloth.rotation.y = Math.sin(f / 30 * 3) * 0.3; }
  // boats: bob on the swell; the hero boat rides the chamber water
  const t = f / 30;
  const placeBoat = (b, X, Y, Z, RY) => {
    b.g.position.set(X, Y + Math.sin(t * 0.9) * 0.04, Z);
    b.g.rotation.y = RY;
    b.g.rotation.z = Math.sin(t * 0.7) * 0.012;
    const sail = b.g.userData.sail;
    sail.userData.amp = 0.08; sail.userData.speed = 3;
    FX.clothWave(sail, t);
    const pen = b.g.userData.pennant;
    pen.userData.amp = 0.05; pen.userData.speed = 4;
    FX.clothWave(pen, t);
  };
  placeBoat(boats[0], Ws.boatX, Ws.boatY, Ws.boatZ, Ws.boatRy);
  placeBoat(boats[1], Ws.boat2X, Ws.boat2Y, Ws.boat2Z, Ws.boat2Ry);
  for (const fl of flags) {
    if (fl.geometry.parameters && fl.geometry.parameters.width > 1) {
      fl.userData.amp = 0.06; fl.userData.speed = 4;
      FX.clothWave(fl, t);
    }
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
