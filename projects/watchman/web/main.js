import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, BOARD_RY, BED, WINDOW, WIRES, WIRE_Y, DOOR, GUARDS, baleAt, sackAt } from './story.js';
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
// the hanging lantern above the bedroll — the room's warm heart
const hangLight = new THREE.PointLight(0xffb45e, 30, 22, 1.7); hangLight.position.set(0.7, 3.05, 1.15); scene.add(hangLight);
// the watchman's own floor lantern, burning low until he lifts it
const floorLight = new THREE.PointLight(0xffa64e, 6, 10, 1.8); floorLight.position.set(2.35, 0.55, 1.95); scene.add(floorLight);

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

const MAT = {
  floor: texM(M4.woodV4(11), 9, 6, '#7d6a52'), wall: texM(M4.woodV4(6), 7, 2, '#77593a'), wallSide: texM(M4.woodV4(7), 5, 2, '#6e5334'),
  beam: texM(M4.woodV4(9), 1, 2, '#5d4630'), shelf: texM(M4.woodV4(4), 2, 1, '#7d5f3d'), roof: texM(M4.woodV4(13), 8, 3, '#4c3a26'),
  brass: toon({ color: '#c99635' }), brassDk: toon({ color: '#8a6420' }),
  iron: toon({ color: '#3f4247' }), rope: toon({ color: '#9a7c50' }), wire: toon({ color: '#9aa2ac' }),
  dark: toon({ color: '#2c2620' }), white: toon({ color: '#f2ede0' }),
  blanket: toon({ color: '#4e4258' }), blanket2: toon({ color: '#5d4f6e' }), pillow: toon({ color: '#cfc4ae' }),
  sack: toon({ color: '#8a6b42' }), sack2: toon({ color: '#a08348' }), sack3: toon({ color: '#6e5133' }),
  chest: texM(M4.woodV4(6), 1, 1, '#4e3822'), silver: toon({ color: '#b9c1cc' }),
  flame: new THREE.MeshBasicMaterial({ color: '#ff8500' }),
  chim: new THREE.MeshBasicMaterial({ color: '#ffe9c0', transparent: true, opacity: 0.10, depthWrite: false }),
  moonPane: new THREE.MeshBasicMaterial({ color: '#aebfe0', transparent: true, opacity: 0.85 }),
  glass: M4.glassMatV4(envMap, 0.4),
};
const SILKS = ['#7a2d4e', '#1f5f5b', '#8a6d1f', '#4a2d6e', '#7d2a2a', '#28518a'];

// ============================================================
//  THE WAREHOUSE — one interior set (group at origin, never moved)
// ============================================================
const setG = new THREE.Group(); scene.add(setG);
const bells = [];       // every bell in the room: { group, glow, phase }
let heroWire = null, heroGlint = null, shaftMesh = null, ropeG = null, baleG = null, sackG = null;
let floorGlow = null, hangGlow = null, moonGlow = null;
const guardGlows = [];
const guardFlames = [];
const makeBell = (x, y, z, parent, mode = 'stake') => {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  // every bell is visibly RIGGED: a slim stake driven into the floor, or a
  // drop cord from the door lintel — nothing floats.
  if (mode === 'cord') add(new THREE.CylinderGeometry(0.014, 0.014, 0.92, 6), MAT.rope, 0, 0.52, 0, g, { cast: false });
  else add(new THREE.CylinderGeometry(0.02, 0.024, y + 0.04, 6), MAT.dark, 0, -y / 2 - 0.02, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 6), MAT.iron, 0, 0.05, 0, g, { cast: false });
  const body = add(new THREE.SphereGeometry(0.088, 10, 8, 0, Math.PI * 2, 0, 1.95), MAT.brass, 0, -0.05, 0, g, { cast: false });
  body.scale.y = 1.15;
  add(new THREE.SphereGeometry(0.028, 8, 6), MAT.brassDk, 0, -0.155, 0, g, { cast: false });
  const glow = softGlow(0.62, '#ffca7a', 0); glow.position.set(0, -0.05, 0); g.add(glow);
  bells.push({ group: g, glow, phase: bells.length * 1.7 });
  return g;
};
{
  const g = setG;
  // floor + walls (structure never casts — the moonlight leaks in softly,
  // the lanterns do the real lighting work)
  const fl = add(tbox(30, 0.1, 19, 3), MAT.floor, 0, -0.05, 0, g, { cast: false });
  add(tbox(28.5, 7.6, 0.3, 3), MAT.wall, 0, 3.8, -8.15, g, { cast: false });
  add(tbox(0.3, 7.6, 17, 3), MAT.wallSide, -13.65, 3.8, 0, g, { cast: false });
  add(tbox(0.3, 7.6, 17, 3), MAT.wallSide, 13.65, 3.8, 0, g, { cast: false });
  // timber posts + wall beams
  for (const px of [-12, -8, -4, 0, 4, 8, 12]) {
    add(tbox(0.34, 7.6, 0.34, 2), MAT.beam, px, 3.8, -7.95, g, { cast: false });
    add(tbox(0.34, 7.6, 0.34, 2), MAT.beam, px, 3.8, 7.95, g, { cast: false });
  }
  for (const pz of [-6, -2, 2, 6]) {
    add(tbox(0.34, 7.6, 0.34, 2), MAT.beam, -13.45, 3.8, pz, g, { cast: false });
    add(tbox(0.34, 7.6, 0.34, 2), MAT.beam, 13.45, 3.8, pz, g, { cast: false });
  }
  add(tbox(28.5, 0.4, 0.4, 3), MAT.beam, 0, 7.3, -7.95, g, { cast: false });
  add(tbox(28.5, 0.4, 0.4, 3), MAT.beam, 0, 7.3, 7.95, g, { cast: false });
  // roof: two slopes + trusses + ridge
  for (const s of [1, -1]) {
    const roof = add(tbox(28.5, 0.14, 9.6, 3), MAT.roof, 0, 8.05, s * 4.35, g, { cast: false });
    roof.rotation.x = s * 0.185;
  }
  add(tbox(28.5, 0.34, 0.34, 3), MAT.beam, 0, 8.62, 0, g, { cast: false });
  for (const tx of [-10, -5, 0, 5, 10]) add(tbox(0.3, 0.3, 16.4, 3), MAT.beam, tx, 7.55, 0, g, { cast: false });
  // ---- the roof window on the west wall + its moon shaft + the rope ----
  add(tbox(0.14, 1.7, 1.5, 1), MAT.dark, WINDOW.x - 0.18, WINDOW.y, WINDOW.z, g, { cast: false });
  const pane = add(new THREE.PlaneGeometry(1.3, 1.5), MAT.moonPane, WINDOW.x - 0.1, WINDOW.y, WINDOW.z, g, { cast: false });
  pane.rotation.y = Math.PI / 2; pane.userData.ndSkip = true;
  add(tbox(0.1, 1.56, 0.09, 1), MAT.beam, WINDOW.x - 0.06, WINDOW.y, WINDOW.z, g, { cast: false });
  add(tbox(0.1, 0.09, 1.36, 1), MAT.beam, WINDOW.x - 0.06, WINDOW.y, WINDOW.z, g, { cast: false });
  moonGlow = softGlow(2.6, '#b9cdf2', 0.5); moonGlow.position.set(WINDOW.x - 0.5, WINDOW.y, WINDOW.z); g.add(moonGlow);
  // NO hard-edged light wedge and no glow-blob (both banned looks): the
  // moon shaft is told by the window glow, the moon-blue rim light and
  // the dust motes drifting inside the beam — nothing else.
  ropeG = new THREE.Group(); ropeG.position.set(WINDOW.x, WINDOW.y - 0.75, WINDOW.z); g.add(ropeG);
  add(new THREE.CylinderGeometry(0.032, 0.032, 4.35, 7), MAT.rope, 0, -2.17, 0, ropeG, { cast: false });
  add(new THREE.SphereGeometry(0.06, 8, 6), MAT.rope, 0, -4.35, 0, ropeG, { cast: false });
  // ---- shelf units with the treasure ----
  const silkBale = (parent, x, y, z, ci) => {
    const b = add(new THREE.CylinderGeometry(0.26, 0.26, 0.98, 12), toon({ color: SILKS[ci % SILKS.length] }), x, y, z, parent);
    b.rotation.z = Math.PI / 2;
    for (const dx of [-0.3, 0.3]) add(tbox(0.07, 0.55, 0.55, 1), MAT.dark, x + dx, y, z, parent, { cast: false });
    return b;
  };
  const spiceSack = (parent, x, y, z, mat, powder) => {
    const s = add(new THREE.SphereGeometry(0.34, 11, 9), mat, x, y, z, parent);
    s.scale.set(1, 0.82, 1);
    if (powder) { const d = flat(add(new THREE.CircleGeometry(0.2, 12), toon({ color: powder }), x, y + 0.27, z, parent, { cast: false })); d.userData.ndSkip = false; }
    else add(new THREE.ConeGeometry(0.09, 0.16, 8), mat, x, y + 0.32, z, parent, { cast: false });
    return s;
  };
  const silverChest = (parent, x, y, z) => {
    add(tbox(0.84, 0.44, 0.52, 1), MAT.chest, x, y, z, parent);
    add(tbox(0.88, 0.1, 0.56, 1), MAT.iron, x, y + 0.1, z, parent, { cast: false });
    add(tbox(0.88, 0.08, 0.56, 1), MAT.iron, x, y - 0.14, z, parent, { cast: false });
    add(tbox(0.16, 0.2, 0.06, 1), MAT.silver, x, y + 0.02, z + 0.27, parent, { cast: false });
  };
  const shelfUnit = (x, z, ry, kind, seed) => {
    const u = new THREE.Group(); u.position.set(x, 0, z); u.rotation.y = ry; g.add(u);
    for (const sx of [-1.62, 1.62]) add(tbox(0.14, 3.2, 1.1, 1), MAT.beam, sx, 1.6, 0, u, { cast: false });
    for (const by of [0.28, 1.32, 2.36]) {
      add(tbox(3.4, 0.09, 1.1, 2), MAT.shelf, 0, by, 0, u, { cast: false });
      for (let k = 0; k < 3; k++) {
        const gx = -1.05 + k * 1.05, gz = (k % 2 ? -0.2 : 0.18);
        if (kind === 'silk') silkBale(u, gx, by + 0.31, gz, seed + k);
        else if (kind === 'spice') spiceSack(u, gx, by + 0.3, gz, [MAT.sack, MAT.sack2, MAT.sack3][(seed + k) % 3], k === 1 ? ['#c8542a', '#d9a441', '#7d8a2a'][(seed + k) % 3] : null);
        else silverChest(u, gx, by + 0.27, gz);
      }
    }
    add(tbox(3.4, 0.12, 1.1, 2), MAT.shelf, 0, 3.22, 0, u, { cast: false });
    return u;
  };
  const KINDS = ['silk', 'spice', 'silver'];
  [-9.9, -6.2, -2.5, 1.2, 4.9, 8.6].forEach((x, i) => shelfUnit(x, -6.6, 0, KINDS[i % 3], i * 2 + 1));
  [-8.0, -4.3, -0.6, 3.1, 6.8, 10.5].forEach((x, i) => shelfUnit(x, 6.6, Math.PI, KINDS[(i + 1) % 3], i * 3 + 2));
  // loose treasure on the floor by the shelves: chests, sacks, a crate stack
  silverChest(g, -11.6, 0.24, -5.2); silverChest(g, -11.5, 0.68, -5.25);
  spiceSack(g, 11.8, 0.28, -5.4, MAT.sack2, '#c8542a'); spiceSack(g, 11.0, 0.28, -5.7, MAT.sack, null);
  const cr1 = FX.crate(1.05); cr1.position.set(12.2, 0.53, 3.9); cr1.rotation.y = 0.4; g.add(cr1);
  const br1 = FX.barrel(0.4, 0.95); br1.position.set(-12.4, 0.48, 4.6); g.add(br1);
  // ---- the bedroll, pillow and floor lantern at the centre ----
  add(tbox(2.9, 0.12, 1.3, 2), MAT.blanket, 0.7, 0.06, 1.15, g, { cast: false });
  add(tbox(2.5, 0.05, 1.05, 2), MAT.blanket2, 0.62, 0.145, 1.15, g, { cast: false });
  add(tbox(0.55, 0.16, 0.5, 1), MAT.pillow, -0.1, 0.1, 1.45, g, { cast: false });
  add(new THREE.CylinderGeometry(0.13, 0.16, 0.07, 10), MAT.iron, 2.35, 0.2, 1.95, g, { cast: false });
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10, 1, true), MAT.chim, 2.35, 0.38, 1.95, g, { cast: false }).userData.ndSkip = true;
  add(new THREE.SphereGeometry(0.055, 8, 6), MAT.flame, 2.35, 0.36, 1.95, g, { cast: false });
  add(new THREE.ConeGeometry(0.13, 0.09, 10), MAT.iron, 2.35, 0.58, 1.95, g, { cast: false });
  floorGlow = softGlow(1.15, '#ffb45e', 0.3); floorGlow.position.set(2.35, 0.42, 1.95); g.add(floorGlow);
  // ---- hanging lanterns along the aisle ----
  for (const hx of [-9, -3, 0.7, 3, 9]) {
    add(new THREE.CylinderGeometry(0.018, 0.018, 3.9, 6), MAT.iron, hx, 5.6, 1.15, g, { cast: false });
    add(new THREE.CylinderGeometry(0.11, 0.14, 0.07, 9), MAT.iron, hx, 3.68, 1.15, g, { cast: false });
    add(new THREE.SphereGeometry(0.075, 9, 7), MAT.flame, hx, 3.52, 1.15, g, { cast: false });
    add(new THREE.ConeGeometry(0.15, 0.11, 9), MAT.iron, hx, 3.78, 1.15, g, { cast: false });
    const gl = softGlow(1.35, '#ffb45e', 0.38); gl.position.set(hx, 3.52, 1.15); g.add(gl);
    if (hx === 0.7) hangGlow = gl;
  }
  // the guards' lanterns (memory beat) — flames + glows at their hands
  for (const gd of GUARDS) {
    const fl2 = add(new THREE.SphereGeometry(0.06, 8, 6), MAT.flame, gd.x + 0.48, 1.02, gd.z + 0.3, g, { cast: false });
    fl2.visible = false; guardFlames.push(fl2);
    const gl = softGlow(1.25, '#ffb45e', 0.5); gl.position.set(gd.x + 0.48, 1.05, gd.z + 0.3); g.add(gl);
    guardGlows.push(gl);
  }
  // ---- the tripwire web + every bell it talks to ----
  for (const wdef of WIRES) {
    if (wdef.along === 'z') {
      const len = wdef.x1 - wdef.x0;
      const wgeo = add(new THREE.CylinderGeometry(0.012, 0.012, len, 6), MAT.wire, (wdef.x0 + wdef.x1) / 2, WIRE_Y, wdef.z, g, { cast: false });
      wgeo.rotation.z = Math.PI / 2;
      makeBell(wdef.x0 + 0.3, 0.58, wdef.z + 0.15, g);
      makeBell(wdef.x1 - 0.3, 0.58, wdef.z + 0.15, g);
    } else {
      const len = wdef.z1 - wdef.z0;
      const wgeo = add(new THREE.CylinderGeometry(0.012, 0.012, len, 6), MAT.wire, wdef.x, WIRE_Y, (wdef.z0 + wdef.z1) / 2, g, { cast: false });
      wgeo.rotation.x = Math.PI / 2;
      if (wdef.hero) { heroWire = wgeo; heroWire.position.y = WIRE_Y; }
      makeBell(wdef.x, 0.58, wdef.z0 + 0.18, g);
      makeBell(wdef.x, 0.58, wdef.z1 - 0.18, g);
      // the hero wire carries one more bell mid-span, on its own stake at
      // the thieves' crossing point — the payoff insert's subject.
      if (wdef.hero) makeBell(wdef.x, 0.62, -2.6, g);
    }
  }
  // bells under the back shelves + over the great east door
  for (const bx of [-9, -5, -1, 3, 7]) makeBell(bx, 0.55, -5.7, g);
  makeBell(DOOR.x - 0.05, 2.66, DOOR.z - 0.85, g, 'cord');
  makeBell(DOOR.x - 0.05, 2.66, DOOR.z + 0.85, g, 'cord');
  heroGlint = softGlow(0.85, '#ffe9b0', 0); heroGlint.position.set(-6, 0.55, -2.55); g.add(heroGlint);
  // the east double door (behind the board wall)
  add(tbox(0.16, 3.4, 1.7, 2), MAT.beam, DOOR.x + 0.2, 1.7, DOOR.z - 0.9, g, { cast: false });
  add(tbox(0.16, 3.4, 1.7, 2), MAT.beam, DOOR.x + 0.2, 1.7, DOOR.z + 0.9, g, { cast: false });
  add(tbox(0.2, 0.3, 3.6, 2), MAT.beam, DOOR.x + 0.2, 3.55, DOOR.z, g, { cast: false });
  // ---- dynamic props: the silk bale + the memory sack ----
  baleG = new THREE.Group(); scene.add(baleG);
  const bb = add(new THREE.CylinderGeometry(0.27, 0.27, 1.0, 12), toon({ color: '#1f5f5b' }), 0, 0, 0, baleG);
  bb.rotation.z = Math.PI / 2;
  for (const dx of [-0.3, 0.3]) add(tbox(0.07, 0.57, 0.57, 1), MAT.dark, dx, 0, 0, baleG, { cast: false });
  sackG = new THREE.Group(); scene.add(sackG);
  const sk = add(new THREE.SphereGeometry(0.36, 11, 9), MAT.sack, 0, 0, 0, sackG); sk.scale.set(1, 0.85, 1);
  add(new THREE.ConeGeometry(0.1, 0.18, 8), MAT.sack, 0, 0.36, 0, sackG, { cast: false });
}

// ---------- boards (transform mirrored in boards.json — keep in sync) ----------
// Position set ONCE on the board itself; its parent (setG) sits at the
// origin, so there is no second offset. Posts stand OUTSIDE the panel span.
const boardHook = textBoard(['But tomorrow… the shepherd', 'who counted a thousand sheep', 'without counting', 'a single one?'], 4.2, 1.45, '#14202f', '#ffd9a0', 900, { pitch: 0.185, dy: 0.005, fsMul: 1.0 });
boardHook.position.set(...BOARD_POS); boardHook.rotation.y = BOARD_RY; setG.add(boardHook); addBoardOccluder(boardHook, 4.2, 1.45, 'boardHook');
for (const pz of [BOARD_POS[2] - 2.35, BOARD_POS[2] + 2.35]) add(new THREE.CylinderGeometry(0.07, 0.08, 3.8, 8), MAT.beam, BOARD_POS[0], 1.9, pz, setG, { cast: false });
add(tbox(0.12, 0.12, 5.4, 2), MAT.beam, BOARD_POS[0], 3.78, BOARD_POS[2], setG, { cast: false });

// ---------- FX: lantern-light dust motes + moon-shaft dust ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0.7, 2.8, 1.15, { rate: 0, color: 0xffd9a8, opacity: 0.15, scale: 0.3, grow: 0.2, life: 2.8, vy: 0.1, wind: 0.03 });
const shaftEmit = smoke.addEmitter(-10.6, 3.0, -1.5, { rate: 0, color: 0xbccdf0, opacity: 0.055, scale: 0.22, grow: 0.12, life: 3.0, vy: -0.12, wind: 0.1 });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    moteEmit.rate = pr.moteRate * 3;
    shaftEmit.rate = pr.shaftRate * 3;
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
  const mem = shotAt(f).id === 'memory';
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  boardHook.material.opacity = Ws.boardHook || 0; boardHook.visible = (Ws.boardHook || 0) > 0.01;
  guardGlows.forEach((gl) => { gl.visible = mem; gl.material.opacity = mem ? 0.5 * (0.88 + 0.12 * Math.sin(f * 0.3 + gl.position.x)) : 0; });
  guardFlames.forEach((fl2) => { fl2.visible = mem; });
  // lantern practicals breathe; the floor lantern lifts with lampK
  const flick = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  hangLight.intensity = 30 * flick;
  if (hangGlow) hangGlow.material.opacity = 0.38 * flick;
  floorLight.intensity = (4 + 14 * (Ws.lampK || 0)) * flick;
  if (floorGlow) floorGlow.material.opacity = (0.22 + 0.4 * (Ws.lampK || 0)) * flick;
  if (moonGlow) moonGlow.material.opacity = 0.45 + 0.08 * Math.sin(f * 0.05);
  if (shaftMesh) shaftMesh.material.opacity = 0.13 * (Ws.shaftK || 0);
  if (ropeG) ropeG.rotation.x = 0.02 * Math.sin(f * 0.045);
  // the bells answer the wire
  const bk = Ws.bellK || 0;
  for (const b of bells) {
    b.group.rotation.x = Math.sin(f * 2.2 + b.phase) * 0.55 * bk;
    b.group.rotation.z = Math.cos(f * 1.9 + b.phase * 1.3) * 0.4 * bk;
    b.glow.material.opacity = 0.55 * bk * (0.7 + 0.3 * Math.sin(f * 3 + b.phase * 2));
  }
  if (heroWire) heroWire.position.y = WIRE_Y + Math.sin(f * 2.4) * 0.018 * (Ws.wireK || 0);
  if (heroGlint) heroGlint.material.opacity = 0.65 * (Ws.wireK || 0) * (0.6 + 0.4 * Math.sin(f * 2.4));
  // dynamic props follow the story
  const bp = baleAt(f);
  baleG.visible = bp.k > 0; baleG.position.set(bp.x, bp.y, bp.z); baleG.rotation.y = 0.2;
  const sp = sackAt(f);
  sackG.visible = sp.k > 0; sackG.position.set(sp.x, sp.y, sp.z);
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

