import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, cablePoint, flyAt, wheelAt } from './story.js';
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

const MAT = {
  grass: texM(M4.groundDetail(P.grass(6), 191, { dots: 1500, blades: 900 }), 34, 34, '#93b25e'),
  dirt: texM(M4.groundDetail(P.dirt(7), 77, { dots: 900 }), 2, 26, '#b08c5a'),
  stone: texM(M4.stoneV4(21), 3, 2, '#8d929c'), stoneDk: texM(M4.stoneV4(23), 2, 2, '#6d7278'),
  rock: texM(M4.groundDetail(P.stone(31, 38, 6, 60), 193, { dots: 900 }), 2, 2, '#9aa0a6'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  leaf: texM(M4.groundDetail(P.grass(11), 55, { dots: 700 }), 2, 2, '#5d8f3e'), leafDk: texM(M4.groundDetail(P.grass(13), 56, { dots: 700 }), 2, 2, '#4c7a34'),
  plaster: toon({ color: '#e3cfa3' }), plaster2: toon({ color: '#d9b98c' }),
  roof: toon({ color: '#8a4a32' }), roofDk: toon({ color: '#6e3a28' }),
  steel: toon({ color: '#43484f' }), steelLt: toon({ color: '#7d848c' }),
  water: toon({ color: '#3d7a94' }), waterLt: toon({ color: '#5b9ab2' }),
  sack: toon({ color: '#d8c49a' }), glow: new THREE.MeshBasicMaterial({ color: '#ffd98a', fog: true }),
  dark: toon({ color: '#2e2622' }),
};

// ============================================================
//  THE VALLEY — two cliff plateaus, the gorge + river + bridge far
//  below, the cable A-frames, the shop, cottages, the pine, rocks
// ============================================================
const setG = new THREE.Group(); scene.add(setG);
const fenceRun = (x0, z0, x1, z1, h = 0.95) => {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const n = Math.max(2, Math.round(len / 1.7));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    add(new THREE.CylinderGeometry(0.05, 0.06, h, 6), MAT.woodDk, x0 + dx * t, h / 2, z0 + dz * t, setG, { cast: false });
  }
  for (const ry of [h - 0.12, h * 0.52]) {
    const rail = add(box(0.055, 0.075, len), MAT.wood, (x0 + x1) / 2, ry, (z0 + z1) / 2, setG, { cast: false });
    rail.rotation.y = ang;
  }
};
const gableRoof = (x, y, z, w, d, mat) => {
  for (const s of [-1, 1]) {
    const r = add(box(w, 0.14, d * 0.62), mat, x, y, z + s * d * 0.21, setG);
    r.rotation.x = s * 0.62;
  }
  add(box(w, 0.16, 0.3), MAT.woodDk, x, y + d * 0.155, z, setG, { cast: false });
};
const cottage = (x, z, w, wallMat, roofMat) => {
  add(tbox(w, 2.2, 2.3, 2), wallMat, x, 1.1, z, setG);
  gableRoof(x, 2.62, z, w + 0.5, 2.9, roofMat);
  add(box(0.8, 1.5, 0.06), MAT.dark, x - w * 0.22, 0.75, z + 1.16, setG, { cast: false });
  const win = add(box(0.72, 0.72, 0.05), MAT.glow, x + w * 0.24, 1.42, z + 1.16, setG, { cast: false });
  win.userData.ndSkip = true;
};
let wheelSpin = null, wheelGrp = null, strapMesh = null, glintMesh = null, shadowBlob = null;
{
  const g = setG;
  // ---- plateaus + gorge ----
  add(tbox(76, 26, 44, 6), MAT.rock, 0, -13.01, 29, g, { cast: false });            // home cliff
  flat(add(new THREE.PlaneGeometry(76, 44), MAT.grass, 0, 0.006, 29, g, { cast: false }));
  add(tbox(76, 26, 48, 6), MAT.rock, 0, -13.01, -34, g, { cast: false });           // far cliff
  flat(add(new THREE.PlaneGeometry(76, 48), MAT.grass, 0, 0.006, -34, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(76, 17.5), MAT.stoneDk, 0, -25, -1.5, g, { cast: false }));   // gorge floor
  const river = flat(add(new THREE.PlaneGeometry(76, 4.6), MAT.water, 0, -24.8, -1.5, g, { cast: false }));
  river.receiveShadow = false;
  flat(add(new THREE.PlaneGeometry(30, 1.1), MAT.waterLt, -8, -24.76, -1.9, g, { cast: false }));
  for (const [sx, sz, ss] of [[-20, -6, 1.6], [14, 4, 2.0], [-26, 3, 1.2], [22, -7, 1.4], [6, -8.5, 0.9], [-6, 5.5, 1.1]]) {
    const st = add(new THREE.IcosahedronGeometry(ss, 1), MAT.rock, sx, -25 + ss * 0.4, sz, g, { cast: false }); st.scale.y = 0.7;
  }
  // ---- the bridge far below (the two-hour way across) ----
  add(box(2.4, 0.25, 10), MAT.wood, -11, -23.35, -1.5, g);
  for (const s of [-1, 1]) {
    add(box(0.09, 0.55, 10), MAT.woodDk, -11 + s * 1.15, -22.95, -1.5, g, { cast: false });
    for (const pz of [-5.9, 2.9]) add(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6), MAT.woodDk, -11 + s * 1.1, -24.4, pz, g, { cast: false });
  }
  // ---- dirt paths ----
  flat(add(new THREE.PlaneGeometry(3.2, 24), MAT.dirt, 2.2, 0.012, 25, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(2.8, 10), MAT.dirt, 1.7, 0.012, -17.5, g, { cast: false }));
  // ---- anchor A-frames + winches ----
  const anchorFrame = (z) => {
    for (const s of [-1, 1]) {
      const pole = add(new THREE.CylinderGeometry(0.09, 0.12, 9.6, 7), MAT.woodDk, 3.1, 4.3, z + s * 1.15, g);
      pole.rotation.x = s * 0.135;
    }
    const arm = add(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 7), MAT.woodDk, 2.65, 8.58, z, g);
    arm.rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), MAT.steel, 2.2, 8.42, z, g, { cast: false });
    const winch = add(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 10), MAT.wood, 3.6, 0.42, z + (z > 0 ? 1.7 : -1.7), g);
    winch.rotation.x = Math.PI / 2;
  };
  anchorFrame(10.5); anchorFrame(-13.5);
  // ---- the cable (static) + its sun-glint segment ----
  const cablePts = [];
  for (let i = 0; i <= 24; i++) { const p = cablePoint(i / 24); cablePts.push(new THREE.Vector3(p[0], p[1], p[2])); }
  const cableCurve = new THREE.CatmullRomCurve3(cablePts);
  add(new THREE.TubeGeometry(cableCurve, 48, 0.024, 6), MAT.steel, 0, 0, 0, g, { cast: false });
  const glintPts = [];
  for (let i = 0; i <= 5; i++) { const p = cablePoint(0.44 + (i / 5) * 0.09); glintPts.push(new THREE.Vector3(p[0], p[1], p[2])); }
  glintMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(glintPts), 10, 0.034, 6),
    new THREE.MeshBasicMaterial({ color: '#fff3c8', transparent: true, opacity: 0, fog: false }));
  glintMesh.userData.ndSkip = true; g.add(glintMesh);
  // ---- the wheel rig (trolley wheel + strap, posed per frame) ----
  wheelGrp = new THREE.Group(); scene.add(wheelGrp);
  wheelSpin = new THREE.Group(); wheelGrp.add(wheelSpin);
  const rim = add(new THREE.TorusGeometry(0.17, 0.05, 8, 18), MAT.steel, 0, 0, 0, wheelSpin);
  rim.rotation.y = Math.PI / 2;
  add(new THREE.SphereGeometry(0.07, 8, 6), MAT.steelLt, 0, 0, 0, wheelSpin, { cast: false });
  for (const s of [-1, 1]) add(box(0.03, 0.3, 0.05), MAT.steel, s * 0.055, -0.12, 0, wheelGrp, { cast: false });
  strapMesh = add(new THREE.CylinderGeometry(0.028, 0.028, 1, 6), MAT.dark, 0, 0, 0, scene, { cast: false });
  // ---- far cliff: the shop ----
  add(tbox(4.6, 2.9, 2.6, 2), MAT.plaster, 0.4, 1.45, -20.2, g);
  gableRoof(0.4, 3.3, -20.2, 5.2, 3.3, MAT.roof);
  add(box(0.95, 1.9, 0.06), MAT.dark, 0.4, 0.95, -18.88, g, { cast: false });
  for (const wx of [-0.9, 1.7]) { const win = add(box(0.7, 0.7, 0.05), MAT.glow, wx, 1.55, -18.88, g, { cast: false }); win.userData.ndSkip = true; }
  add(box(0.85, 0.42, 0.85), MAT.wood, 5.6, 0.21, -17.6, g, { cast: false });   // traders' sitting crates
  add(box(0.85, 0.42, 0.85), MAT.wood, 6.5, 0.21, -19.3, g, { cast: false });
  const barrel1 = FX.barrel(0.5, 1.05); barrel1.position.set(3.1, 0.53, -19.6); g.add(barrel1);
  // ---- far cottages (the children's windows) ----
  cottage(-5.6, -19.3, 2.9, MAT.plaster2, MAT.roofDk);
  cottage(-2.9, -19.9, 2.5, MAT.plaster, MAT.roof);
  // ---- home cottages + village dressing ----
  cottage(-6.5, 27.5, 3.4, MAT.plaster, MAT.roof);
  cottage(8.5, 29.5, 3.0, MAT.plaster2, MAT.roofDk);
  const crate1 = FX.crate(0.9); crate1.position.set(-3.4, 0.45, 16.2); g.add(crate1);
  const crate2 = FX.crate(0.65); crate2.position.set(-3.35, 1.23, 16.25); g.add(crate2);
  // flour sacks (Marta's bet)
  const sack1 = add(new THREE.SphereGeometry(0.5, 10, 8), MAT.sack, -0.5, 0.3, 13.9, g); sack1.scale.set(0.85, 0.68, 0.85);
  const sack2 = add(new THREE.SphereGeometry(0.42, 10, 8), MAT.sack, -1.0, 0.24, 14.35, g); sack2.scale.set(0.85, 0.62, 0.85);
  add(new THREE.TorusGeometry(0.16, 0.035, 6, 12), MAT.woodDk, -0.5, 0.62, 13.9, g, { cast: false });
  // ---- the pine (the grandson's lookout) ----
  add(new THREE.CylinderGeometry(0.2, 0.32, 7.2, 8), MAT.woodDk, -4.5, 3.6, 12.5, g);
  const branch = add(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6), MAT.woodDk, -4.15, 4.44, 12.5, g, { cast: false });
  branch.rotation.z = Math.PI / 2 - 0.08;
  for (const [bx, by, bz, br, bm] of [[-4.5, 6.5, 12.5, 1.6, MAT.leaf], [-5.4, 5.5, 12.2, 1.1, MAT.leafDk], [-3.6, 5.6, 12.9, 1.05, MAT.leaf], [-4.6, 7.5, 12.6, 1.2, MAT.leafDk]]) {
    const blob = add(new THREE.IcosahedronGeometry(br, 1), bm, bx, by, bz, g); blob.scale.y = 0.82;
  }
  // ---- rocks: the boy's shout rock + the far landing rock ----
  const shoutRock = add(new THREE.IcosahedronGeometry(1.15, 1), MAT.rock, 5.8, 0.05, 11.8, g);
  shoutRock.scale.set(1.25, 0.5, 1.05);
  add(new THREE.CylinderGeometry(0.95, 1.12, 0.55, 9), MAT.rock, 1.6, 0.275, -15.2, g);
  const rk2 = add(new THREE.IcosahedronGeometry(0.4, 1), MAT.rock, 0.75, 0.14, -14.6, g); rk2.scale.y = 0.65;
  // ---- trees + fences + scattered stones ----
  const treeAt = (x, z, s) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); tg.scale.setScalar(s); g.add(tg);
    add(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 7), MAT.woodDk, 0, 0.8, 0, tg);
    const c1 = add(new THREE.IcosahedronGeometry(1.25, 1), MAT.leaf, 0, 2.3, 0, tg); c1.scale.y = 0.85;
    const c2 = add(new THREE.IcosahedronGeometry(0.85, 1), MAT.leafDk, 0.7, 1.8, 0.3, tg); c2.scale.y = 0.85;
    const c3 = add(new THREE.IcosahedronGeometry(0.7, 1), MAT.leaf, -0.75, 1.9, -0.2, tg); c3.scale.y = 0.85;
  };
  treeAt(-11, 18, 1.15); treeAt(12, 14, 1.25); treeAt(-14, -16, 1.2); treeAt(13, -22, 1.1); treeAt(-16, 30, 1.3); treeAt(17, 26, 1.0); treeAt(10.5, -15.5, 0.95);
  fenceRun(-20, 7.6, -2, 7.6); fenceRun(8, 7.6, 20, 7.6);
  fenceRun(-20, -10.7, -3, -10.7); fenceRun(7, -10.7, 20, -10.7);
  for (const [sx, sz, ss] of [[-2.8, 18, 0.16], [4.4, 20.5, 0.2], [-6.2, -14.5, 0.15], [5.2, -18.5, 0.18], [-1.8, -24, 0.15]]) {
    const st = add(new THREE.IcosahedronGeometry(ss, 0), MAT.stoneDk, sx, ss * 0.4, sz, g, { cast: false }); st.scale.y = 0.65;
  }
  // board posts + crossbar (OUTSIDE the panel span; transform mirrored in boards.json)
  for (const px of [BOARD_POS[0] - 2.55, BOARD_POS[0] + 2.55]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(5.4, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.92, BOARD_POS[2], g, { cast: false });
  // the flyer's racing shadow (shadow beat)
  shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, depthWrite: false, fog: true, opacity: 0.55 }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.userData.ndSkip = true; shadowBlob.renderOrder = 1; shadowBlob.visible = false; scene.add(shadowBlob);
}

// ---------- boards (transform mirrored in boards.json — keep in sync) ----------
const boardHook = textBoard(['But tomorrow… the woman', 'who cooked without', 'any fire?'], 4.6, 1.5, '#274a26', '#ffe9a8', 900, { pitch: 0.21, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); scene.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');
const signOpen = textBoard(['OPEN'], 0.95, 0.5, '#5d3a1e', '#ffe9a8', 900);
signOpen.position.set(0.4, 1.62, -18.86); scene.add(signOpen);

// ---------- FX: dawn motes + dust at the launch / landing rocks ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(2.2, 6.0, 0, { rate: 0, color: 0xfff2b0, opacity: 0.15, scale: 0.26, grow: 1.1, life: 2.6, vy: 0.05, wind: -0.35 });
const dustEmitA = smoke.addEmitter(2.2, 0.3, 10.9, { rate: 0, color: 0xd8c49a, opacity: 0.32, scale: 0.5, grow: 1.8, life: 1.1, vy: 0.5, wind: 0.1 });
const dustEmitB = smoke.addEmitter(1.6, 0.8, -15.2, { rate: 0, color: 0xd8c49a, opacity: 0.32, scale: 0.5, grow: 1.8, life: 1.1, vy: 0.5, wind: 0.1 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.55, color: 0xffe6c4, drift: 0.5 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Wd = worldAt(fxF);
    moteEmit.rate = pr.moteRate * 3;
    dustEmitA.rate = dustEmitB.rate = Wd.dustK * 30;
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
const _wa = new THREE.Vector3(), _wb = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  boardHook.material.opacity = Ws.boardHook || 0; boardHook.visible = (Ws.boardHook || 0) > 0.01;
  // the sun glint crawling on the cable (glint beat)
  glintMesh.material.opacity = (Ws.glintK || 0) * 0.95;
  glintMesh.visible = (Ws.glintK || 0) > 0.02;
  // the wheel + strap rig follows the flight model
  const S = shotAt(f), fl = flyAt(f), wh = wheelAt(f);
  wheelGrp.position.set(wh.pos[0], wh.pos[1] + 0.19, wh.pos[2]);
  wheelSpin.rotation.x = wh.mode === 'cable' && fl.air ? -(wh.u || 0) * 148 : 0;
  if (fl.air && wh.mode === 'cable') {
    strapMesh.visible = true;
    _wa.set(wh.pos[0], wh.pos[1] + 0.02, wh.pos[2]);
    _wb.set(fl.pos[0], fl.pos[1] + 2.34, fl.pos[2]);
    const len = _wa.distanceTo(_wb);
    strapMesh.position.copy(_wa).add(_wb).multiplyScalar(0.5);
    strapMesh.scale.set(1, len, 1);
    strapMesh.quaternion.setFromUnitVectors(_up, _wb.sub(_wa).normalize());
  } else strapMesh.visible = false;
  // his racing shadow sweeps the far plateau in the shadow beat
  if (S.id === 'shadow' && fl.air && fl.pos[2] < -10.2) {
    shadowBlob.visible = true;
    shadowBlob.position.set(fl.pos[0], 0.03, fl.pos[2]);
    const bs = 1.5 + fl.pos[1] * 0.12; shadowBlob.scale.set(bs, bs * 0.72, 1);
  } else shadowBlob.visible = false;
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
