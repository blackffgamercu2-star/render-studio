import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, TABLE, STAIR_N, stairPos } from './story.js';
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
// the lamp's own light — follows the lamp wherever the rope takes it
const lampLight = new THREE.PointLight(0xffb45e, 60, 36, 1.6); scene.add(lampLight);
// a small steady lantern on the keeper's table (ground-floor practical)
const tableLight = new THREE.PointLight(0xffa64e, 7, 9, 1.8); tableLight.position.set(TABLE.x + 0.4, 1.35, TABLE.z + 0.2); scene.add(tableLight);

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

// ---------- painted tower canvas: stone with two red bands ----------
const towerCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ddd6c4'; g.fillRect(0, 0, 512, 512);
  // stone noise + block seams
  for (let i = 0; i < 5200; i++) { g.fillStyle = `rgba(90,80,60,${0.04 + Math.random() * 0.07})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2.4, 1.6); }
  for (let i = 0; i < 3600; i++) { g.fillStyle = `rgba(255,252,240,${0.05 + Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 1.4); }
  g.fillStyle = 'rgba(90,80,60,0.28)';
  for (let y = 42; y < 512; y += 52) g.fillRect(0, y, 512, 2);
  for (let x = 30; x < 512; x += 86) g.fillRect(x, 0, 2, 512);
  // two broad red bands (v: canvas y 150-215 and 330-395)
  for (const [y0, y1] of [[150, 215], [330, 395]]) {
    g.fillStyle = '#9c3540'; g.fillRect(0, y0, 512, y1 - y0);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(40,16,16,${0.05 + Math.random() * 0.08})`; g.fillRect(Math.random() * 512, y0 + Math.random() * (y1 - y0), 2.2, 1.5); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,220,200,${0.04 + Math.random() * 0.05})`; g.fillRect(Math.random() * 512, y0 + Math.random() * (y1 - y0), 2, 1.2); }
    g.fillStyle = 'rgba(30,20,14,0.5)'; g.fillRect(0, y0, 512, 3); g.fillRect(0, y1 - 3, 512, 3);
  }
  // weather streaks under the bands
  for (let i = 0; i < 60; i++) { const x = Math.random() * 512; g.fillStyle = `rgba(70,60,45,${0.05 + Math.random() * 0.06})`; g.fillRect(x, 215 + Math.random() * 30, 2.5, 26 + Math.random() * 40); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();

const MAT = {
  tower: toon({ map: towerCanvas }),
  rock: texM(M4.stoneV4(21), 5, 3, '#8d929c'), shelf: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 14, 10, '#787c83'), rockDk: texM(M4.stoneV4(23), 4, 2, '#62676f'),
  stoneIn: texM(M4.stoneV4(8), 6, 4, '#a89a83'), step: texM(M4.stoneV4(8), 1, 1, '#a89a83'), stoneFloor: texM(M4.stoneV4(9), 6, 6, '#978a74'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  brass: toon({ color: '#c99635' }), brassDk: toon({ color: '#8a6420' }),
  iron: toon({ color: '#3f4247' }), rope: toon({ color: '#9a7c50' }),
  dark: toon({ color: '#2c2620' }), white: toon({ color: '#f2ede0' }),
  red: toon({ color: '#9c3540' }), stoneSack: toon({ color: '#7d7a72' }),
  flame: new THREE.MeshBasicMaterial({ color: '#ff8500' }),
  chim: new THREE.MeshBasicMaterial({ color: '#ffe9c0', transparent: true, opacity: 0.10, depthWrite: false }),
  glass: M4.glassMatV4(envMap, 0.4),
};

// ============================================================
//  EXTERIOR — tower on its rocky point, the sea, a passing ship
// ============================================================
const extG = new THREE.Group(); scene.add(extG);
let water = null, ship = null, beamG = null, beamGlow = null;
const winGlows = [];
{
  const g = extG;
  water = FX.makeWater({ size: 340, seg: 72, deep: 0x0a2438, shallow: 0x1d4e5f, sky: 0x2c4258, amp: 0.3, spark: 0.5 });
  water.position.set(0, -0.55, -70); water.userData.ndSkip = true; g.add(water);
  // the rocky point: a broad stone shelf (top y=0) + scattered boulders
  const shelf = add(new THREE.CylinderGeometry(19, 23, 1.4, 26), MAT.shelf, 0, -0.7, 2, g, { cast: false });
  shelf.scale.set(1, 1, 1.25);
  const rockSpots = [[-9, -3, 2.6], [10.5, -5, 3.2], [-12, 6, 2.2], [12, 7.5, 2.4], [-7.5, 13.5, 1.5], [8.5, 14.5, 1.7], [14, -1, 1.9], [-14.5, -1, 1.8]];
  for (const [x, z, s] of rockSpots) {
    const r = add(new THREE.IcosahedronGeometry(s, 0), MAT.rockDk, x, s * 0.22, z, g, { cast: false });
    r.scale.y = 0.62; r.rotation.set(x * 0.7, z * 1.3, x * 0.3);
  }
  // the tower: tapered, banded, with gallery + glass lamp room + dome
  add(new THREE.CylinderGeometry(3.9, 5.0, 13.2, 26), MAT.tower, 0, 6.6, 0, g);
  add(new THREE.CylinderGeometry(5.35, 5.6, 0.7, 26), MAT.rockDk, 0, 0.35, 0, g, { cast: false });  // plinth
  add(new THREE.CylinderGeometry(4.35, 4.35, 0.32, 26), MAT.iron, 0, 13.36, 0, g);                  // gallery deck
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; add(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 5), MAT.iron, Math.cos(a) * 4.2, 13.95, Math.sin(a) * 4.2, g, { cast: false }); }
  const rail = add(new THREE.TorusGeometry(4.2, 0.045, 6, 40), MAT.iron, 0, 14.38, 0, g, { cast: false }); rail.rotation.x = Math.PI / 2;
  const glassRoom = add(new THREE.CylinderGeometry(2.3, 2.3, 2.2, 18, 1, true), MAT.glass, 0, 14.6, 0, g, { cast: false });
  glassRoom.userData.ndSkip = true;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(tbox(0.09, 2.2, 0.09, 1), MAT.iron, Math.cos(a) * 2.3, 14.6, Math.sin(a) * 2.3, g, { cast: false }); }
  add(new THREE.CylinderGeometry(2.55, 2.55, 0.22, 18), MAT.red, 0, 13.6, 0, g, { cast: false });
  const dome = add(new THREE.ConeGeometry(2.75, 1.5, 18), MAT.red, 0, 16.45, 0, g);
  add(new THREE.SphereGeometry(0.17, 10, 8), MAT.brass, 0, 17.35, 0, g, { cast: false });
  // door on +z with a warm lantern beside it + stone step
  add(tbox(1.15, 2.3, 0.16, 1), MAT.dark, 0, 1.15, 4.86, g, { cast: false });
  add(tbox(1.5, 0.18, 0.7, 1), MAT.rockDk, 0, 0.09, 5.15, g, { cast: false });
  const doorGlow = softGlow(1.1, '#ffb45e', 0.4); doorGlow.position.set(0.95, 1.9, 5.1); g.add(doorGlow); winGlows.push(doorGlow);
  add(new THREE.SphereGeometry(0.09, 8, 6), MAT.flame, 0.95, 1.9, 5.02, g, { cast: false });
  // lit windows spiralling up the tower
  for (const [wx, wy, wz] of [[1.9, 4.4, 4.35], [-3.6, 7.6, 2.6], [0.9, 10.6, 4.05]]) {
    add(tbox(0.42, 0.6, 0.08, 1), MAT.flame, wx, wy, wz, g, { cast: false }).lookAt(wx * 2, wy, wz * 2);
    const wg = softGlow(0.85, '#ffb45e', 0.3); wg.position.set(wx * 1.04, wy, wz * 1.04); g.add(wg); winGlows.push(wg);
  }
  // crates + barrel by the door, coiled rope
  const cr = FX.crate(1.05); cr.position.set(2.6, 0.53, 5.6); cr.rotation.y = 0.5; g.add(cr);
  const br = FX.barrel(0.4, 0.95); br.position.set(3.6, 0.48, 5.1); g.add(br);
  const coil = add(new THREE.TorusGeometry(0.42, 0.11, 7, 20), MAT.rope, -2.4, 0.1, 5.4, g, { cast: false }); coil.rotation.x = Math.PI / 2;
  // ---- the rotating beam: two cones from the lamp room, dust-bright ----
  beamG = new THREE.Group(); beamG.position.set(0, 14.6, 0); g.add(beamG);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.10, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  for (const s of [1, -1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 30, 18, 1, true), beamMat);
    cone.rotation.z = s * Math.PI / 2; cone.position.x = s * 15;
    cone.userData.ndSkip = true; beamG.add(cone);
  }
  beamGlow = softGlow(5.2, '#ffcf8a', 0.5); beamGlow.position.set(0, 14.6, 0); g.add(beamGlow);
  // ---- the ship: hull, mast, sail, one lantern — passes the rocks ----
  ship = new THREE.Group();
  const hull = add(tbox(4.6, 0.9, 1.5, 2), MAT.dark, 0, 0.45, 0, ship);
  add(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 7), MAT.woodDk, 0.2, 2.9, 0, ship, { cast: false });
  const sail = add(new THREE.PlaneGeometry(2.6, 3.0), toon({ color: '#cfd6cf', side: THREE.DoubleSide }), 0.25, 2.9, 0.06, ship, { cast: false });
  sail.geometry.translate(0, -0.4, 0);
  const shipLamp = softGlow(1.3, '#ffb45e', 0.55); shipLamp.position.set(-1.9, 1.6, 0); ship.add(shipLamp);
  add(new THREE.SphereGeometry(0.09, 8, 6), MAT.flame, -1.9, 1.6, 0, ship, { cast: false });
  ship.position.set(-24, -0.5, -26); ship.rotation.y = Math.PI / 2 - 0.25; g.add(ship);
  // board posts + crossbar (transform mirrored in boards.json)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ============================================================
//  INTERIOR — the hollow shaft: stairs, floors, the rope and lamp
// ============================================================
const intG = new THREE.Group(); scene.add(intG);
let lampG = null, flameMesh = null, lampGlow = null, ropeMesh = null, cwG = null, cwRope = null, tableGlow = null;
{
  const g = intG;
  const wall = add(new THREE.CylinderGeometry(4.2, 4.2, 15.4, 26, 1, true), texM(M4.stoneV4(8), 12, 7, '#a89a83'), 0, 7.7, 0, g, { cast: false });
  wall.material = wall.material.clone(); wall.material.side = THREE.BackSide;
  flat(add(new THREE.CircleGeometry(4.2, 26), MAT.stoneFloor, 0, 0.02, 0, g, { cast: false }));
  // top floor: wooden annulus with a centre well the lamp rises through
  const tf = flat(add(new THREE.RingGeometry(1.25, 4.2, 26), MAT.wood, 0, 11.9, 0, g, { cast: false }));
  tf.material = tf.material.clone(); tf.material.side = THREE.DoubleSide;
  const railT = add(new THREE.TorusGeometry(1.25, 0.04, 6, 26), MAT.iron, 0, 12.55, 0, g, { cast: false }); railT.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 5), MAT.iron, Math.cos(a) * 1.25, 12.22, Math.sin(a) * 1.25, g, { cast: false }); }
  // lamp chamber glass (seen from inside) + dark dome + the great beam
  const chamber = add(new THREE.CylinderGeometry(2.3, 2.3, 2.4, 18, 1, true), MAT.glass, 0, 13.8, 0, g, { cast: false });
  chamber.userData.ndSkip = true;
  add(new THREE.ConeGeometry(2.9, 1.6, 18), MAT.dark, 0, 15.9, 0, g, { cast: false });
  add(tbox(5.2, 0.24, 0.34, 2), MAT.woodDk, 0, 15.0, 0, g, { cast: false });   // the beam
  const wheel = add(new THREE.TorusGeometry(0.34, 0.07, 8, 20), MAT.iron, 0, 14.72, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), MAT.woodDk, 0, 14.86, 0, g, { cast: false }).rotation.x = Math.PI / 2;
  const wheel2 = add(new THREE.TorusGeometry(0.26, 0.06, 8, 18), MAT.iron, 0.15, 14.78, -0.95, g, { cast: false });
  // spiral stair: 27 stone steps climbing the wall to the top floor
  for (let i = 0; i < STAIR_N; i++) {
    const p = stairPos(i);
    const st = add(box(1.15, 0.1, 0.55), MAT.woodDk, Math.cos(p.th) * 3.82, p.y - 0.05, Math.sin(p.th) * 3.82, g, { cast: false });
    st.rotation.y = -p.th - Math.PI / 2;
    if (i % 3 === 0) { const br = add(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 5), MAT.iron, p.x * 0.86, p.y + 0.4, p.z * 0.86, g, { cast: false }); }
  }
  // the cradle the lamp rests on at the ground
  add(new THREE.CylinderGeometry(0.52, 0.58, 0.14, 14), MAT.woodDk, 0, 0.07, 0, g, { cast: false });
  const cradleRing = add(new THREE.TorusGeometry(0.46, 0.05, 7, 20), MAT.iron, 0, 0.52, 0, g, { cast: false }); cradleRing.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const leg = add(tbox(0.09, 0.52, 0.09, 1), MAT.woodDk, Math.cos(a) * 0.42, 0.26, Math.sin(a) * 0.42, g, { cast: false }); leg.rotation.z = Math.cos(a) * 0.18; leg.rotation.x = -Math.sin(a) * 0.18; }
  // keeper's work table: oil can, trimming tools, cloth, a small lantern
  add(tbox(1.7, 0.09, 1.0, 2), MAT.wood, TABLE.x, 0.74, TABLE.z, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), MAT.woodDk, TABLE.x + lx, 0.37, TABLE.z + lz, g, { cast: false });
  add(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 9), MAT.brassDk, TABLE.x - 0.45, 0.94, TABLE.z - 0.15, g, { cast: false });   // oil can
  add(new THREE.CylinderGeometry(0.03, 0.05, 0.22, 6), MAT.brass, TABLE.x - 0.38, 1.12, TABLE.z - 0.1, g, { cast: false }).rotation.z = -0.5;
  add(tbox(0.34, 0.03, 0.26, 1), MAT.white, TABLE.x + 0.15, 0.8, TABLE.z + 0.12, g, { cast: false });                            // cleaning cloth
  add(new THREE.SphereGeometry(0.075, 8, 6), MAT.flame, TABLE.x + 0.55, 1.02, TABLE.z + 0.2, g, { cast: false });                 // table lantern flame
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 8), MAT.iron, TABLE.x + 0.55, 0.82, TABLE.z + 0.2, g, { cast: false });
  tableGlow = softGlow(0.95, '#ffb45e', 0.4); tableGlow.position.set(TABLE.x + 0.55, 1.05, TABLE.z + 0.2); g.add(tableGlow);
  // oil drum in the work corner
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 14), MAT.iron, -1.9, 0.48, -0.35, g, { cast: false });
  const drumRim = add(new THREE.TorusGeometry(0.42, 0.03, 6, 18), MAT.brassDk, -1.9, 0.8, -0.35, g, { cast: false }); drumRim.rotation.x = Math.PI / 2;
  // wall sconces: two small lanterns washing the shaft with warm pools
  for (const a of [2.4, 5.5]) {
    const sx = Math.cos(a) * 4.05, sz = Math.sin(a) * 4.05;
    add(new THREE.SphereGeometry(0.08, 8, 6), MAT.flame, sx, 3.4, sz, g, { cast: false });
    const sg = softGlow(1.15, '#ffa64e', 0.3); sg.position.set(sx * 0.96, 3.4, sz * 0.96); g.add(sg); winGlows.push(sg);
  }
  // ---- THE LAMP (lives at scene root: exterior sees it through the glass) ----
  lampG = new THREE.Group(); scene.add(lampG);
  add(new THREE.CylinderGeometry(0.36, 0.4, 0.13, 14), MAT.brassDk, 0, -0.5, 0, lampG);            // base
  add(new THREE.CylinderGeometry(0.27, 0.3, 0.34, 14), MAT.brass, 0, -0.28, 0, lampG);             // oil tank
  const chim = add(new THREE.CylinderGeometry(0.185, 0.225, 0.52, 14, 1, true), MAT.chim, 0, 0.14, 0, lampG, { cast: false });
  chim.userData.ndSkip = true;
  flameMesh = add(new THREE.SphereGeometry(0.095, 10, 8), MAT.flame, 0, 0.02, 0, lampG, { cast: false });
  flameMesh.scale.set(1, 1.8, 1);
  add(new THREE.ConeGeometry(0.3, 0.2, 14), MAT.brassDk, 0, 0.5, 0, lampG, { cast: false });        // cap
  const lring = add(new THREE.TorusGeometry(0.09, 0.028, 6, 14), MAT.iron, 0, 0.66, 0, lampG, { cast: false });
  lampGlow = softGlow(1.6, '#ffbf6e', 0.45); lampGlow.position.set(0, 0.1, 0); lampG.add(lampGlow);
  // ---- ropes + counterweight (interior only) ----
  ropeMesh = add(new THREE.CylinderGeometry(0.045, 0.045, 1, 7), MAT.rope, 0, 7, 0, g, { cast: false });
  cwG = new THREE.Group(); g.add(cwG);
  const cw1 = add(new THREE.SphereGeometry(0.3, 10, 8), MAT.stoneSack, 0, 0, 0, cwG); cw1.scale.y = 0.85;
  const cw2 = add(new THREE.SphereGeometry(0.22, 9, 7), MAT.stoneSack, 0.12, -0.3, 0.08, cwG); cw2.scale.y = 0.85;
  add(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 7), MAT.rope, 0, 0.32, 0, cwG, { cast: false });
  cwG.position.set(0.15, 3, -0.95);
  cwRope = add(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), MAT.rope, 0.15, 9, -0.95, g, { cast: false });
}

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardHook = textBoard(['But tomorrow… the man', 'who sold the same horse', 'seven times?'], 4.6, 1.5, '#14202f', '#ffd9a0', 900, { pitch: 0.21, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); extG.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: lamp-beam dust motes (in) + sea spray (out) + night clouds ----------
const smoke = new FX.Smoke(scene, 200); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 3, 0, { rate: 0, color: 0xffd9a8, opacity: 0.16, scale: 0.3, grow: 1.1, life: 2.6, vy: 0.14, wind: 0.04 });
const sprayEmit = smoke.addEmitter(9, 0.4, 15, { rate: 0, color: 0xdfe9f2, opacity: 0.22, scale: 0.55, grow: 1.6, life: 1.1, vy: 0.9, wind: 0.25 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 58, opacity: 0.13, color: 0x93a7c9, drift: 0.4 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    moteEmit.rate = pr.moteRate * 3;
    moteEmit.y = Ws.lampY + 0.4;   // motes drift around the lamp, inside its light
    sprayEmit.rate = pr.sprayRate * 3;
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

// ---------- V3 word-by-word captions (the reference's signature) ----------
// Screen-space overlay rendered AFTER the dof pass: one word at a time,
// bold white with a thick black stroke, centred, baseline ~76% of frame
// height, timed from words.js (faster-whisper timings, script-verbatim
// text). The word holds until the next word starts and blanks in the gaps
// between phrases.
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
    // blank in real pauses (>0.34 s after the word ends, before the next)
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
  const int = (Ws.intK || 0) > 0;
  intG.visible = int; extG.visible = !int;
  tableLight.visible = int;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  boardHook.material.opacity = Ws.boardHook || 0; boardHook.visible = (Ws.boardHook || 0) > 0.01;
  // water follows the grade
  if (water) {
    water.material.uniforms.uDeep.value.set(L.waterDeep); water.material.uniforms.uShallow.value.set(L.waterShal);
    water.material.uniforms.uAmp.value = 0.3; water.material.uniforms.uSpark.value = 0.45;
    water.userData.update(f / 30);
  }
  // ---- the lamp: rides its rope; flame + light + glow follow lampK ----
  const flick = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  const lk = (Ws.lampK || 0) * flick;
  lampG.position.set(0, Ws.lampY, 0);
  flameMesh.visible = (Ws.lampK || 0) > 0.02;
  flameMesh.scale.set(1, 1.8 * Math.max(0.1, Ws.lampK || 0), 1);
  lampGlow.material.opacity = 0.34 * lk;
  lampLight.position.set(0, Ws.lampY + 0.5, 0);
  lampLight.intensity = 22 * lk;
  // ropes: from the top beam down to the lamp ring / counterweight top
  const topY = 15.0, lampTopY = Ws.lampY + 0.66;
  ropeMesh.scale.y = Math.max(0.05, topY - lampTopY);
  ropeMesh.position.y = (topY + lampTopY) / 2;
  cwG.position.y = Ws.cwY;
  const cwTopY = Ws.cwY + 0.42;
  cwRope.scale.y = Math.max(0.05, topY - cwTopY);
  cwRope.position.y = (topY + cwTopY) / 2;
  // ---- exterior life: beam sweep, ship, window glows ----
  if (beamG) {
    beamG.visible = (Ws.beamK || 0) > 0;
    beamG.rotation.y = f * 0.021;
    beamGlow.material.opacity = 0.5 * (Ws.beamK || 0) * (0.85 + 0.15 * Math.sin(f * 0.021 * 2));
  }
  if (ship) {
    ship.visible = (Ws.shipK || 0) > 0;
    if (ship.visible) { ship.position.x = Ws.shipX; ship.position.y = -0.5 + Math.sin(f * 0.05) * 0.07; ship.rotation.z = Math.sin(f * 0.04) * 0.02; }
  }
  winGlows.forEach((gl, i) => { gl.material.opacity = (i === 0 ? 0.4 : 0.3) * (0.88 + 0.12 * Math.sin(f * 0.3 + i * 2.3)); });
  if (tableGlow) tableGlow.material.opacity = 0.4 * (0.9 + 0.1 * Math.sin(f * 0.33 + 0.8));
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
