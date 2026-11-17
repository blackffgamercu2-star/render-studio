import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, STALL, RING, SON, COTE, PLATFORM_Y, HOUSE } from './story.js';
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
// warm practicals: the stall lantern, the porch lamp
const stallLight = new THREE.PointLight(0xffb45e, 6, 10, 1.8); stallLight.position.set(STALL.x + 1.2, 2.2, STALL.z + 0.6); scene.add(stallLight);
const porchLight = new THREE.PointLight(0xffa64e, 7, 11, 1.8); porchLight.position.set(HOUSE.x - 1.0, 2.3, HOUSE.z - 2.9); scene.add(porchLight);

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

// ---------- painted canvases ----------
const stripesCanvas = (() => {   // finish-line banner: red/white stripes
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2ede0' : '#b03a30'; g.fillRect(i * 32, 0, 32, 64); }
  g.fillStyle = 'rgba(60,30,10,0.16)'; for (let i = 0; i < 300; i++) g.fillRect(Math.random() * 256, Math.random() * 64, 2, 1.4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const fieldsCanvas = (() => {   // patchwork fields seen from the pigeon's sky
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const cols = ['#7d9b3f', '#a8b356', '#c2a44e', '#6d8a3a', '#b98d45', '#8fae4a', '#97793a', '#759544'];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(x * 64, y * 64, 64, 64);
    g.fillStyle = 'rgba(70,50,20,0.20)';
    for (let r = 8; r < 64; r += 11) g.fillRect(x * 64, y * 64 + r, 64, 1.6);
  }
  g.strokeStyle = '#8a6a3c'; g.lineWidth = 7; g.beginPath();   // the road home
  g.moveTo(20, 500); g.bezierCurveTo(150, 380, 220, 330, 300, 210); g.bezierCurveTo(360, 120, 420, 90, 500, 10); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();

const MAT = {
  earth: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1400 }), 16, 16, '#9a7c50'),
  grass: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 77, { dots: 1600 }), 18, 18, '#7d9b4a'),
  dirt: texM(M4.sandV4(15), 10, 2, '#b08c58'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  stone: texM(M4.stoneV4(21), 3, 2, '#9a938a'),
  plaster: texM(M4.stoneV4(31), 2, 2, '#e3d3ae'), plaster2: texM(M4.stoneV4(33), 2, 2, '#d8bf96'),
  roof: texM(M4.woodV4(9), 3, 1, '#8a4a34'), roofDk: texM(M4.woodV4(11), 3, 1, '#6d4a3a'),
  brass: toon({ color: '#c99635' }), brassDk: toon({ color: '#8a6420' }),
  gold: FX.goldMaterial(), iron: toon({ color: '#3f4247' }),
  dark: toon({ color: '#2c2620' }), white: toon({ color: '#f2ede0' }),
  paper: toon({ color: '#efe6cf' }), red: toon({ color: '#b03a30' }),
  clothRed: toon({ color: '#a03a30', side: THREE.DoubleSide }), clothTeal: toon({ color: '#2e6d6a', side: THREE.DoubleSide }),
  leaf: toon({ color: '#5d7d33' }), leafDk: toon({ color: '#49662a' }),
  pigBody: toon({ color: '#8b99b3' }), pigWing: toon({ color: '#7787a0', side: THREE.DoubleSide }),
  pigNeck: toon({ color: '#3f8a6d' }), pigTail: toon({ color: '#4a5a75' }),
  flame: new THREE.MeshBasicMaterial({ color: '#ff8500' }),
  glass: M4.glassMatV4(envMap, 0.4),
  fields: new THREE.MeshBasicMaterial({ map: fieldsCanvas }),
  banner: new THREE.MeshBasicMaterial({ map: stripesCanvas, side: THREE.DoubleSide }),
};

// ============================================================
//  SQUARE — the village betting ring: bookmaker's stall, the
//  roped champion ring, benches, bunting, the hook-board posts
// ============================================================
const sqG = new THREE.Group(); scene.add(sqG);
const lampGlows = [];
{
  const g = sqG;
  const ground = flat(add(new THREE.CircleGeometry(46, 36), MAT.earth, 0, -0.02, 2, g, { cast: false }));
  // grass fringe ring beyond the packed earth
  const fringe = flat(add(new THREE.RingGeometry(30, 60, 30), MAT.grass, 0, -0.04, 2, g, { cast: false }));
  fringe.material = fringe.material.clone(); fringe.material.side = THREE.DoubleSide;
  // ---- the bookmaker's stall: posts, counter, striped awning, sign ----
  const sx = STALL.x, sz = STALL.z;
  for (const [px, pz] of [[-1.5, -0.5], [1.5, -0.5], [-1.5, 0.7], [1.5, 0.7]])
    add(new THREE.CylinderGeometry(0.07, 0.08, 2.9, 7), MAT.woodDk, sx + px, 1.45, sz + pz, g, { cast: false });
  add(tbox(3.1, 0.95, 0.85, 2), MAT.wood, sx, 0.48, sz + 0.35, g);                       // counter
  add(tbox(3.3, 0.07, 1.05, 2), MAT.woodDk, sx, 0.99, sz + 0.35, g, { cast: false });    // counter top
  const awn = add(new THREE.PlaneGeometry(3.9, 2.2), MAT.clothRed, sx, 2.95, sz + 0.1, g, { cast: false });
  awn.rotation.x = -0.5; awn.material = awn.material.clone(); awn.material.side = THREE.DoubleSide;
  add(tbox(3.9, 0.09, 0.09, 2), MAT.woodDk, sx, 3.32, sz - 0.85, g, { cast: false });
  const sign = textBoard(['BETS'], 2.3, 0.58, '#3a2a18', '#ffd9a0'); sign.position.set(sx, 2.62, sz + 0.78); g.add(sign);
  // on the counter: the great ledger, the closing bell, coin stacks, slips
  const ledger = add(tbox(0.62, 0.09, 0.45, 1), MAT.paper, sx - 0.7, 1.07, sz + 0.35, g, { cast: false }); ledger.rotation.y = 0.24;
  add(tbox(0.66, 0.03, 0.49, 1), MAT.red, sx - 0.7, 1.02, sz + 0.35, g, { cast: false }).rotation.y = 0.24;
  add(new THREE.SphereGeometry(0.09, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), MAT.brass, sx + 0.15, 1.03, sz + 0.3, g, { cast: false });  // bell dome
  add(new THREE.SphereGeometry(0.028, 7, 6), MAT.brassDk, sx + 0.15, 1.14, sz + 0.3, g, { cast: false });
  for (let s = 0; s < 3; s++) for (let i = 0; i < 4 - s; i++)
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 10), MAT.gold, sx + 0.62 + s * 0.14, 1.04 + i * 0.019, sz + 0.42, g, { cast: false });
  for (let i = 0; i < 3; i++) { const sl = add(tbox(0.2, 0.012, 0.3, 1), MAT.paper, sx - 0.15 + i * 0.16, 1.035 + i * 0.004, sz + 0.55, g, { cast: false }); sl.rotation.y = i * 0.4 - 0.3; }
  const pouch = add(new THREE.SphereGeometry(0.16, 10, 8), toon({ color: '#7a4a22' }), sx - 1.15, 1.1, sz + 0.5, g, { cast: false }); pouch.scale.y = 0.82;
  // the stall lantern (practical) + glow
  add(new THREE.SphereGeometry(0.075, 8, 6), MAT.flame, sx + 1.2, 2.2, sz + 0.6, g, { cast: false });
  const sg = softGlow(0.95, '#ffb45e', 0.4); sg.position.set(sx + 1.2, 2.2, sz + 0.65); g.add(sg); lampGlows.push(sg);
  // ---- the roped champion ring ----
  for (const [px, pz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]])
    add(new THREE.CylinderGeometry(0.06, 0.07, 1.05, 7), MAT.woodDk, RING.x + px, 0.52, RING.z + pz, g, { cast: false });
  for (const hh of [0.55, 0.92]) for (const side of [-1.3, 1.3]) {
    const r1 = add(new THREE.CylinderGeometry(0.022, 0.022, 2.6, 5), MAT.red, RING.x, hh, RING.z + side, g, { cast: false }); r1.rotation.z = Math.PI / 2;
    const r2 = add(new THREE.CylinderGeometry(0.022, 0.022, 2.6, 5), MAT.red, RING.x + side, hh, RING.z, g, { cast: false }); r2.rotation.x = Math.PI / 2;
  }
  flat(add(new THREE.CircleGeometry(1.75, 20), MAT.dirt, RING.x, 0.005, RING.z, g, { cast: false }));
  // ---- benches, crates, barrels, trees ----
  for (const bx of [-4.6, 4.8]) {
    add(tbox(2.6, 0.09, 0.45, 2), MAT.wood, bx, 0.46, 4.6, g, { cast: false });
    for (const lx of [-1.1, 1.1]) add(tbox(0.12, 0.46, 0.4, 1), MAT.woodDk, bx + lx, 0.23, 4.6, g, { cast: false });
  }
  const cr = FX.crate(0.95); cr.position.set(4.4, 0.48, -2.9); cr.rotation.y = 0.4; g.add(cr);
  const br = FX.barrel(0.38, 0.9); br.position.set(5.3, 0.45, -2.2); g.add(br);
  const cr2 = FX.crate(0.8); cr2.position.set(-5.2, 0.4, -3.4); cr2.rotation.y = -0.3; g.add(cr2);
  for (const [tx, tz, ts] of [[-9, 6, 1.2], [9.5, 7, 1.4], [-11, -4, 1.1], [11, -5, 1.25], [0, -12, 1.5]]) {
    add(new THREE.CylinderGeometry(0.14 * ts, 0.2 * ts, 1.6 * ts, 7), MAT.woodDk, tx, 0.8 * ts, tz, g, { cast: false });
    const c1 = add(new THREE.SphereGeometry(1.5 * ts, 10, 8), MAT.leaf, tx, 2.3 * ts, tz, g, { cast: false }); c1.scale.y = 0.85;
    const c2 = add(new THREE.SphereGeometry(1.05 * ts, 9, 7), MAT.leafDk, tx + 0.8 * ts, 1.8 * ts, tz + 0.3, g, { cast: false });
  }
  // lantern poles
  for (const [lx, lz] of [[-5.6, 2.6], [6.0, -0.6]]) {
    add(new THREE.CylinderGeometry(0.06, 0.08, 3.1, 7), MAT.woodDk, lx, 1.55, lz, g, { cast: false });
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.flame, lx, 3.15, lz, g, { cast: false });
    const lg = softGlow(1.05, '#ffb45e', 0.34); lg.position.set(lx, 3.15, lz); g.add(lg); lampGlows.push(lg);
  }
  // bunting between the poles over the square (with its string)
  for (const [x0, z0, x1, z1] of [[-5.6, 2.6, 6.0, -0.6], [-5.6, 2.6, sx - 1.5, sz - 0.5]]) {
    for (let seg = 0; seg < 4; seg++) {
      const ua = seg / 4, ub = (seg + 1) / 4;
      const pa = [x0 + (x1 - x0) * ua, 3.08 - Math.sin(ua * Math.PI) * 0.35, z0 + (z1 - z0) * ua];
      const pb = [x0 + (x1 - x0) * ub, 3.08 - Math.sin(ub * Math.PI) * 0.35, z0 + (z1 - z0) * ub];
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
      const str = add(new THREE.CylinderGeometry(0.014, 0.014, len, 4), MAT.dark, (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2, g, { cast: false });
      str.lookAt(pb[0], pb[1], pb[2]); str.rotateX(Math.PI / 2);
    }
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const u = i / n, px = x0 + (x1 - x0) * u, pz = z0 + (z1 - z0) * u, py = 3.05 - Math.sin(u * Math.PI) * 0.35;
      if (i > 0 && i < n) {
        const flag = add(new THREE.ConeGeometry(0.11, 0.3, 3), i % 2 ? MAT.clothRed : MAT.clothTeal, px, py - 0.12, pz, g, { cast: false });
        flag.rotation.x = Math.PI; flag.scale.z = 0.3;
      }
    }
  }
  // hook-board posts OUTSIDE the panel span (panel half-width 2.3) + crossbar
  for (const px of [BOARD_POS[0] - 2.55, BOARD_POS[0] + 2.55]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(5.4, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ============================================================
//  RACECOURSE — grass, dirt track, fences, finish post + banner,
//  a low grandstand, the tree line
// ============================================================
const courseG = new THREE.Group(); scene.add(courseG);
{
  const g = courseG;
  flat(add(new THREE.CircleGeometry(70, 30), MAT.grass, 0, -0.03, 0, g, { cast: false }));
  add(tbox(64, 0.04, 5.4, 4), MAT.dirt, 0, 0.0, 0, g, { cast: false });                 // the track strip
  for (const fz of [-3.1, 3.4]) {
    for (let x = -22; x <= 22; x += 4) add(new THREE.CylinderGeometry(0.05, 0.06, 1.05, 6), MAT.white, x, 0.52, fz, g, { cast: false });
    for (const ry of [0.55, 0.95]) { const rail = add(tbox(45, 0.07, 0.07, 4), MAT.white, 0, ry, fz, g, { cast: false }); }
  }
  // finish post pair + striped banner (x = 4)
  for (const pz of [-2.9, 2.9]) add(new THREE.CylinderGeometry(0.09, 0.1, 3.1, 8), MAT.white, 4, 1.55, pz, g, { cast: false });
  add(new THREE.SphereGeometry(0.14, 9, 7), MAT.red, 4, 3.2, -2.9, g, { cast: false });
  add(new THREE.SphereGeometry(0.14, 9, 7), MAT.red, 4, 3.2, 2.9, g, { cast: false });
  const banner = add(new THREE.PlaneGeometry(5.8, 0.62), MAT.banner, 4, 2.85, 0, g, { cast: false });
  banner.rotation.y = Math.PI / 2;
  // grandstand: stepped benches under a long roof, far side
  for (let s = 0; s < 3; s++) add(tbox(16, 0.5, 1.1, 2), MAT.wood, -2, 0.25 + s * 0.55, -9.5 - s * 1.05, g, { cast: false });
  for (const px of [-9, -2, 5]) add(new THREE.CylinderGeometry(0.08, 0.09, 3.6, 7), MAT.woodDk, px, 1.8, -13.4, g, { cast: false });
  const standRoof = add(tbox(17.5, 0.1, 3.4, 2), MAT.roofDk, -2, 3.7, -11.6, g, { cast: false }); standRoof.rotation.x = 0.16;
  // tree line + hedges
  for (let x = -24; x <= 24; x += 6) {
    const ts = 1 + ((x * 37) % 10) / 22;
    add(new THREE.CylinderGeometry(0.13 * ts, 0.18 * ts, 1.5 * ts, 7), MAT.woodDk, x, 0.75 * ts, -17.5, g, { cast: false });
    const c1 = add(new THREE.SphereGeometry(1.6 * ts, 10, 8), MAT.leafDk, x, 2.4 * ts, -17.5, g, { cast: false }); c1.scale.y = 0.85;
  }
  add(tbox(30, 0.8, 0.8, 3), MAT.leafDk, -4, 0.4, 8.5, g, { cast: false });
  add(tbox(20, 0.7, 0.8, 3), MAT.leaf, 14, 0.35, 9.5, g, { cast: false });
}

// ============================================================
//  HORSES — painted low-poly runners (body, neck, head, legs that
//  gallop, tail, blanket). Legs pivot at shoulder/hip.
// ============================================================
const makeHorse = (coat, blanket, s = 1) => {
  const g = new THREE.Group();
  const cm = toon({ color: coat });
  const body = add(new THREE.SphereGeometry(0.62, 14, 10), cm, 0, 1.18, 0, g); body.scale.set(1.55, 0.88, 0.72);
  const neck = add(tbox(0.34, 0.78, 0.3, 1), cm, 0.82, 1.52, 0, g, { cast: false }); neck.rotation.z = -0.6;
  const headG = new THREE.Group(); headG.position.set(1.08, 1.82, 0); g.add(headG);
  const skull = add(tbox(0.52, 0.24, 0.26, 1), cm, 0.14, -0.02, 0, headG, { cast: false }); skull.rotation.z = -0.35;
  add(new THREE.ConeGeometry(0.07, 0.2, 6), cm, -0.08, 0.2, 0.09, headG, { cast: false });
  add(new THREE.ConeGeometry(0.07, 0.2, 6), cm, -0.08, 0.2, -0.09, headG, { cast: false });
  const mane = add(tbox(0.5, 0.62, 0.07, 1), MAT.dark, 0.68, 1.58, 0, g, { cast: false }); mane.rotation.z = -0.6;
  const tail = add(new THREE.ConeGeometry(0.11, 0.72, 7), MAT.dark, -1.0, 1.32, 0, g, { cast: false }); tail.rotation.z = 0.7;
  add(tbox(0.52, 0.1, 0.56, 1), toon({ color: blanket }), 0.05, 1.62, 0, g, { cast: false });   // saddle blanket
  const legs = [];
  for (const [lx, lz] of [[0.62, 0.26], [0.62, -0.26], [-0.62, 0.26], [-0.62, -0.26]]) {
    const piv = new THREE.Group(); piv.position.set(lx, 1.05, lz); g.add(piv);
    add(new THREE.CylinderGeometry(0.075, 0.055, 1.05, 7), cm, 0, -0.52, 0, piv, { cast: false });
    add(tbox(0.16, 0.07, 0.11, 1), MAT.dark, 0.03, -1.05, 0, piv, { cast: false });
    legs.push(piv);
  }
  g.scale.setScalar(s);
  g.userData.legs = legs; g.userData.headG = headG;
  return g;
};
const horses = [
  makeHorse('#6d4526', '#b03a30', 1.0),     // sleek bay, red blanket
  makeHorse('#33302c', '#2e6d6a', 1.03),    // black, teal blanket
  makeHorse('#8d8578', '#c99635', 0.86),    // the scrawny grey nobody backed
];
horses.forEach((h) => { h.visible = false; courseG.add(h); });
const poseHorse = (h, x, z, phase, amp = 1) => {
  h.position.set(x, Math.abs(Math.sin(phase)) * 0.09 * amp, z);
  const L = h.userData.legs;
  L[0].rotation.z = Math.sin(phase) * 0.62 * amp; L[3].rotation.z = Math.sin(phase) * 0.62 * amp;
  L[1].rotation.z = Math.sin(phase + Math.PI) * 0.62 * amp; L[2].rotation.z = Math.sin(phase + Math.PI) * 0.62 * amp;
  h.userData.headG.rotation.z = Math.sin(phase * 0.5) * 0.05 * amp;
};
// the lone horseman on the road (L14's "two days by road" made visible)
const riderG = makeHorse('#5d4630', '#5d2432', 0.92);
{
  const rider = new THREE.Group();
  const torso = add(tbox(0.3, 0.55, 0.24, 1), toon({ color: '#4a3a5e' }), 0, 0.32, 0, rider, { cast: false });
  const hd = add(new THREE.SphereGeometry(0.16, 10, 8), toon({ color: '#e8c39a' }), 0, 0.78, 0, rider, { cast: false });
  add(new THREE.CylinderGeometry(0.17, 0.19, 0.07, 10), MAT.dark, 0, 0.9, 0, rider, { cast: false });
  rider.position.set(0.05, 1.78, 0); riderG.add(rider);
  riderG.visible = false;
}

// ============================================================
//  STREET + THE GAMBLER'S HOUSE — lane of cottages, the house at
//  the end with its porch, ladder, roof platform and DOVECOTE;
//  the road dropping away toward the distant city.
// ============================================================
const homeG = new THREE.Group(); scene.add(homeG);
homeG.add(riderG);
{
  const g = homeG;
  flat(add(new THREE.CircleGeometry(60, 30), MAT.grass, 0, -0.04, 8, g, { cast: false }));
  add(tbox(5.2, 0.04, 34, 4), MAT.dirt, 0.4, 0.0, 2, g, { cast: false });               // the lane
  // the road away: a long dirt strip falling toward the horizon (+x, +z)
  const road = add(tbox(46, 0.04, 3.4, 4), MAT.dirt, 24, -0.01, 26, g, { cast: false }); road.rotation.y = -0.5;
  // cottages along the lane
  const cottage = (x, z, ry, mat, roofMat) => {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
    add(tbox(3.4, 2.5, 3.0, 2), mat, 0, 1.25, 0, c);
    const rf = add(tbox(3.9, 0.12, 2.2, 2), roofMat, -0.95, 2.95, 0, c, { cast: false }); rf.rotation.z = 0.62;
    const rf2 = add(tbox(3.9, 0.12, 2.2, 2), roofMat, 0.95, 2.95, 0, c, { cast: false }); rf2.rotation.z = -0.62;
    add(tbox(1.9, 1.35, 0.14, 1), roofMat, 0, 3.1, 1.45, c, { cast: false }).rotation.x = 0;  // gable hint
    add(tbox(0.85, 1.7, 0.12, 1), MAT.dark, 0, 0.85, 1.53, c, { cast: false });
    for (const wx of [-1.05, 1.05]) {
      add(tbox(0.62, 0.72, 0.1, 1), MAT.flame, wx, 1.55, 1.52, c, { cast: false });
      add(tbox(0.72, 0.08, 0.12, 1), MAT.woodDk, wx, 1.94, 1.52, c, { cast: false });
    }
    return c;
  };
  cottage(-5.6, 1.5, 0.5, MAT.plaster, MAT.roof);
  cottage(-6.2, 8.5, 0.35, MAT.plaster2, MAT.roofDk);
  cottage(6.0, 4.5, -0.5, MAT.plaster2, MAT.roof);
  cottage(6.4, 11.0, -0.35, MAT.plaster, MAT.roofDk);
  // street lamps
  for (const [lx, lz] of [[-2.6, 5.5], [3.4, 10.5]]) {
    add(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 7), MAT.woodDk, lx, 1.6, lz, g, { cast: false });
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.flame, lx, 3.3, lz, g, { cast: false });
    const lg = softGlow(1.1, '#ffb45e', 0.36); lg.position.set(lx, 3.3, lz); g.add(lg); lampGlows.push(lg);
  }
  // ---- THE HOUSE (front face z = HOUSE.z - 2.3 = 15.5) ----
  const hx = HOUSE.x, hz = HOUSE.z;
  add(tbox(5.6, 3.2, 4.6, 2), MAT.plaster, hx, 1.6, hz, g);
  add(tbox(5.9, 0.22, 4.9, 2), MAT.stone, hx, 0.11, hz, g, { cast: false });              // stone footing
  const r1 = add(tbox(6.1, 0.13, 2.9, 2), MAT.roof, hx - 1.28, 3.95, hz, g); r1.rotation.z = 0.6;
  const r2 = add(tbox(6.1, 0.13, 2.9, 2), MAT.roof, hx + 1.28, 3.95, hz, g); r2.rotation.z = -0.6;
  add(tbox(6.0, 0.16, 0.3, 2), MAT.roofDk, hx, 4.62, hz, g, { cast: false });            // ridge beam
  for (const gx of [hx - 2.79, hx + 2.79]) {                                            // gable ends
    const tri = add(new THREE.CylinderGeometry(0.01, 2.35, 1.5, 3, 1), MAT.plaster2, gx, 3.95, hz, g, { cast: false });
    tri.rotation.z = Math.PI / 2; tri.rotation.y = Math.PI / 2; tri.scale.set(1, 1, 0.66);
  }
  // door + porch (door at hx - 1.0, front z 15.5)
  add(tbox(1.05, 2.15, 0.14, 1), MAT.dark, hx - 1.0, 1.08, hz - 2.32, g, { cast: false });
  add(new THREE.SphereGeometry(0.045, 8, 6), MAT.brass, hx - 0.62, 1.05, hz - 2.42, g, { cast: false });
  const porchRoof = add(tbox(1.9, 0.09, 1.15, 2), MAT.roofDk, hx - 1.0, 2.42, hz - 2.85, g, { cast: false }); porchRoof.rotation.x = 0.18;
  for (const px of [hx - 1.85, hx - 0.15]) add(new THREE.CylinderGeometry(0.05, 0.06, 2.35, 6), MAT.woodDk, px, 1.17, hz - 3.3, g, { cast: false });
  add(new THREE.SphereGeometry(0.08, 8, 6), MAT.flame, hx - 1.0, 2.25, hz - 2.62, g, { cast: false });   // porch lamp
  const pg = softGlow(1.15, '#ffb45e', 0.42); pg.position.set(hx - 1.0, 2.25, hz - 2.7); g.add(pg); lampGlows.push(pg);
  // windows with warm glass
  for (const wx of [hx + 0.9, hx + 2.0]) {
    add(tbox(0.7, 0.85, 0.1, 1), MAT.flame, wx, 1.7, hz - 2.32, g, { cast: false });
    add(tbox(0.8, 0.09, 0.12, 1), MAT.woodDk, wx, 2.16, hz - 2.32, g, { cast: false });
    add(tbox(0.8, 0.09, 0.12, 1), MAT.woodDk, wx, 1.24, hz - 2.32, g, { cast: false });
  }
  // the roof platform (dormer deck) the men stand on to reach the cote
  add(tbox(2.1, 0.12, 1.3, 2), MAT.wood, COTE.x, PLATFORM_Y - 0.06, COTE.z - 0.55, g, { cast: false });
  for (const px of [COTE.x - 0.8, COTE.x + 0.8]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 6), MAT.iron, px, PLATFORM_Y + 0.4, COTE.z - 1.15, g, { cast: false });
  add(new THREE.CylinderGeometry(0.035, 0.035, 1.65, 6), MAT.iron, COTE.x, PLATFORM_Y + 0.8, COTE.z - 1.15, g, { cast: false }).rotation.z = Math.PI / 2;
  // the ladder from the garden to the platform
  const lad = new THREE.Group(); lad.position.set(COTE.x + 1.35, 0, COTE.z - 1.5); lad.rotation.x = -0.32; g.add(lad);
  for (const lx of [-0.26, 0.26]) add(new THREE.CylinderGeometry(0.04, 0.04, 4.3, 6), MAT.woodDk, lx, 2.15, 0, lad, { cast: false });
  for (let i = 0; i < 8; i++) { const rung = add(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 6), MAT.wood, 0, 0.4 + i * 0.52, 0, lad, { cast: false }); rung.rotation.z = Math.PI / 2; }
  // ---- THE DOVECOTE on its post above the platform ----
  add(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 7), MAT.woodDk, COTE.x, PLATFORM_Y + 0.5, COTE.z, g, { cast: false });
  add(tbox(1.15, 0.95, 0.85, 2), MAT.wood, COTE.x, COTE.y, COTE.z, g);
  const coteRoof = add(new THREE.ConeGeometry(0.95, 0.5, 4), MAT.roofDk, COTE.x, COTE.y + 0.72, COTE.z, g, { cast: false }); coteRoof.rotation.y = Math.PI / 4;
  for (let i = 0; i < 3; i++) {   // arched holes on the front face (-z)
    const ax = COTE.x - 0.34 + i * 0.34;
    add(new THREE.CircleGeometry(0.105, 12), MAT.dark, ax, COTE.y + 0.12, COTE.z - 0.435, g, { cast: false }).rotation.y = Math.PI;
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 6), MAT.woodDk, ax, COTE.y - 0.12, COTE.z - 0.55, g, { cast: false }).rotation.x = Math.PI / 2;
  }
  add(tbox(1.2, 0.05, 0.3, 1), MAT.woodDk, COTE.x, COTE.y - 0.32, COTE.z - 0.55, g, { cast: false });   // perch ledge
  // garden fence pickets in front of the house (pickets only — long rails
  // crossed the porch two-shots and blocked the actors)
  for (let x = -8.6; x <= 2.4; x += 1.1) if (Math.abs(x - (hx - 1.0)) > 0.8) add(tbox(0.09, 0.85, 0.06, 1), MAT.wood, x, 0.42, 13.9, g, { cast: false });
}

// ============================================================
//  SKY — patchwork fields far below, warm clouds (L13)
// ============================================================
const skyG = new THREE.Group(); scene.add(skyG);
{
  const fields = flat(add(new THREE.PlaneGeometry(420, 420), MAT.fields, 0, -26, 0, skyG, { cast: false }));
  fields.userData.ndSkip = true;
}

// ============================================================
//  PIGEONS — readable little birds: plump body, iridescent neck,
//  fan tail, wings that FLAP in flight and fold at rest, and the
//  brass CAPSULE on the leg (the whole trick, made visible).
// ============================================================
const makePigeon = (capsule = false) => {
  const g = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.16, 12, 9), MAT.pigBody, 0, 0, 0, g, { cast: false }); body.scale.set(1, 0.85, 1.45);
  const neck = add(new THREE.SphereGeometry(0.085, 10, 8), MAT.pigNeck, 0, 0.09, 0.19, g, { cast: false });
  const head = add(new THREE.SphereGeometry(0.07, 10, 8), MAT.pigBody, 0, 0.15, 0.26, g, { cast: false });
  const beak = add(new THREE.ConeGeometry(0.022, 0.07, 6), MAT.brassDk, 0, 0.14, 0.35, g, { cast: false }); beak.rotation.x = Math.PI / 2;
  const tail = add(tbox(0.2, 0.02, 0.24, 1), MAT.pigTail, 0, 0.03, -0.3, g, { cast: false }); tail.rotation.x = 0.35;
  const wings = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.1, 0.09, 0.02); g.add(piv);
    const wgeo = new THREE.CircleGeometry(0.3, 12); wgeo.scale(1.15, 0.52, 1);   // soft ellipse wing, not a plank
    const w = add(wgeo, MAT.pigWing, s * 0.3, 0, -0.03, piv, { cast: false });
    w.rotation.x = -Math.PI / 2 + 0.12;
    wings.push(piv);
  }
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 5), MAT.red, s * 0.05, -0.16, 0.05, g, { cast: false });
  if (capsule) {
    const cap = add(new THREE.CylinderGeometry(0.04, 0.04, 0.13, 8), MAT.brass, 0.05, -0.13, 0.05, g, { cast: false });
    cap.rotation.z = 0.4;
    add(new THREE.TorusGeometry(0.042, 0.009, 5, 10), MAT.brassDk, 0.05, -0.1, 0.05, g, { cast: false });
  }
  g.userData.wings = wings;
  return g;
};
const posePigeon = (p, flap, t) => {
  const [wl, wr] = p.userData.wings;
  if (flap > 0.02) {
    const a = Math.sin(t * 26) * 0.95 * flap;
    wl.rotation.z = -a - 0.15; wr.rotation.z = a + 0.15;
    wl.scale.setScalar(1); wr.scale.setScalar(1);
  } else { wl.rotation.z = 0.5; wr.rotation.z = -0.5; wl.scale.setScalar(0.62); wr.scale.setScalar(0.62); }   // folded DOWN along the body (signs opposite the flight stroke)
  p.position.y += 0;   // position owned by caller
};
// the flying pigeon (scene root: course release, sky flight, home landing)
const pigFly = makePigeon(true); pigFly.visible = false; scene.add(pigFly);
// perched pigeons at the cote (one wears the capsule — the L8 insert)
const cotePigeons = [];
{
  const p1 = makePigeon(true); p1.position.set(COTE.x - 0.34, COTE.y - 0.06, COTE.z - 0.72); p1.rotation.y = Math.PI + 0.9; homeG.add(p1); cotePigeons.push(p1);
  const p2 = makePigeon(false); p2.position.set(COTE.x + 0.3, COTE.y - 0.18, COTE.z - 0.6); p2.rotation.y = Math.PI - 0.3; homeG.add(p2); cotePigeons.push(p2);
  const p3 = makePigeon(false); p3.position.set(COTE.x + 0.05, COTE.y + 1.05, COTE.z); p3.rotation.y = 0.6; homeG.add(p3); cotePigeons.push(p3);
  cotePigeons.forEach((p) => { p.userData.baseY = p.position.y; });
}

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardHook = textBoard(['But tomorrow… the man', 'who could call', 'the clouds?'], 4.6, 1.5, '#14202f', '#ffd9a0', 900, { pitch: 0.21, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); sqG.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: golden dust motes in the low sun + warm clouds ----------
const smoke = new FX.Smoke(scene, 200); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 2, 0, { rate: 0, color: 0xffd9a8, opacity: 0.15, scale: 0.32, grow: 1.1, life: 2.8, vy: 0.1, wind: 0.05 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.16, color: 0xffe0b8, drift: 0.4 });
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
    dustEmit.rate = pr.dustRate * 3;
    dustEmit.x = Ws.set === 'street' ? 0 : 0; dustEmit.z = Ws.set === 'street' ? 8 : 0;
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
  const t = f / 30;
  sqG.visible = Ws.set === 'square';
  courseG.visible = Ws.set === 'course';
  homeG.visible = Ws.set === 'street';
  skyG.visible = Ws.set === 'sky';
  stallLight.visible = sqG.visible;
  porchLight.visible = homeG.visible;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  boardHook.material.opacity = Ws.boardHook || 0; boardHook.visible = (Ws.boardHook || 0) > 0.01;
  // ---- horses on the course ----
  const Hh = Ws.horses;
  horses.forEach((h, i) => {
    h.visible = !!Hh && Hh.mode !== 'off';
    if (h.visible) poseHorse(h, Hh.xs[i], i === 1 ? -0.9 : (i === 2 ? 0.9 : 0), t * (Hh.mode === 'race' ? 9.5 : 3.2) + i * 2.1, Hh.mode === 'race' ? 1 : 0.4);
  });
  // ---- the horseman on the road (street set) ----
  riderG.visible = !!Ws.rider;
  if (Ws.rider) {
    poseHorse(riderG, 0, 0, t * 3.4, 0.35);   // sets position (bob) + legs
    riderG.position.x = Ws.rider.x; riderG.position.z = Ws.rider.z;
    riderG.rotation.y = Math.PI / 2 - 0.46;   // heads down-road (-x travel, road angled)
  }
  // ---- the flying pigeon ----
  const Pg = Ws.pig;
  pigFly.visible = !!Pg && Pg.mode !== 'off';
  if (pigFly.visible) {
    pigFly.position.set(Pg.pos[0], Pg.pos[1], Pg.pos[2]);
    pigFly.rotation.set(0, Pg.yaw || 0, Pg.bank || 0);
    posePigeon(pigFly, Pg.flap || 0, t);
  }
  cotePigeons.forEach((p, i) => { posePigeon(p, 0, t + i * 1.7); p.position.y = p.userData.baseY + Math.sin(t * 2.1 + i * 2.4) * 0.008; });
  lampGlows.forEach((gl, i) => { gl.material.opacity = (0.34 + (i % 3) * 0.04) * (0.88 + 0.12 * Math.sin(f * 0.3 + i * 2.3)); });
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
