import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, BELL, PEG, LOTA } from './story.js';
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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};
const blobSprite = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (const [bx, by, br] of [[70, 70, 46], [128, 58, 58], [186, 70, 44], [104, 78, 40], [156, 78, 42]]) {
    const grd = g.createRadialGradient(bx, by, 2, bx, by, br);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false }));
  s.scale.set(scale, scale / 2, 1); s.userData.ndSkip = true; return s;
};

// ---------- materials ----------
const MAT = {
  plaza: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 10, 10, '#d8c9a8'),
  dirt: texM(M4.groundDetail(P.stone(48, 30, 4, 44), 97, { dots: 700 }), 8, 8, '#b49a6e'),
  stone: texM(M4.stoneV4(8), 3, 2, '#cbbda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2, '#e8d9b8'),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.34, metalness: 0.92, envMap, envMapIntensity: 1.25 }),
  brassDk: new THREE.MeshStandardMaterial({ color: 0x8a5f1c, roughness: 0.46, metalness: 0.9, envMap, envMapIntensity: 1.0 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.7, envMap, envMapIntensity: 0.7 }),
  ropeDry: toon({ color: '#9a7648' }), ropeWet: toon({ color: '#4c3a24' }),
  leaf: toon({ color: '#4a7a34' }), leafDk: toon({ color: '#38602a' }),
  marigold: toon({ color: '#e8861e' }), marigold2: toon({ color: '#f2b21e' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
  water: new THREE.MeshBasicMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0 }),
};

// ---------- the temple courtyard ----------
const world = new THREE.Group(); scene.add(world);
const garlands = [];
{
  const g = world;
  const plaza = flat(add(new THREE.CircleGeometry(30, 48), MAT.plaza, 0, 0, 4, g, { cast: false }));
  plaza.scale.set(1.15, 1, 1);
  // temple platform (top 0.55) + steps down to the courtyard
  add(tbox(15, 0.55, 6.4, 3), MAT.stone, 0, 0.275, -10.6, g, { cast: false });
  add(tbox(6.4, 0.18, 1.0, 2), MAT.stoneDk, 0, 0.09, -6.9, g, { cast: false });
  add(tbox(6.4, 0.18, 1.0, 2), MAT.stoneDk, 0, 0.27, -7.35, g, { cast: false });
  add(tbox(6.4, 0.19, 1.0, 2), MAT.stoneDk, 0, 0.46, -7.8, g, { cast: false });
  // sanctum back wall + side wings + roof slab + shikhara
  add(tbox(11, 4.6, 1.2, 3), MAT.plaster, 0, 2.85, -13.6, g, { cast: false });
  add(tbox(1.2, 3.4, 5.4, 3), MAT.stone, -5.2, 2.25, -11.2, g, { cast: false });
  add(tbox(1.2, 3.4, 5.4, 3), MAT.stone, 5.2, 2.25, -11.2, g, { cast: false });
  add(tbox(12.4, 0.5, 7.2, 3), MAT.stoneDk, 0, 5.35, -11.4, g, { cast: false });
  const shik = add(new THREE.ConeGeometry(2.5, 2.6, 4), MAT.stoneDk, 0, 6.9, -11.6, g, { cast: false });
  shik.rotation.y = Math.PI / 4; shik.scale.set(1, 1, 0.72);
  add(new THREE.SphereGeometry(0.22, 10, 8), MAT.brass, 0, 8.35, -11.6, g, { cast: false });
  // dark sanctum doorway + arch
  add(tbox(2.2, 3.1, 0.3, 2), MAT.dark, 0, 2.1, -12.95, g, { cast: false });
  add(new THREE.TorusGeometry(1.35, 0.2, 8, 20, Math.PI), MAT.stoneDk, 0, 3.62, -12.9, g, { cast: false });
  // porch pillars
  for (const px of [-3.4, 3.4]) {
    add(new THREE.CylinderGeometry(0.3, 0.36, 4.6, 12), MAT.stone, px, 2.85, -8.6, g, { cast: false });
    add(tbox(0.85, 0.26, 0.85, 2), MAT.stoneDk, px, 5.05, -8.6, g, { cast: false });
    add(tbox(0.9, 0.3, 0.9, 2), MAT.stoneDk, px, 0.7, -8.6, g, { cast: false });
  }
  // marigold garland strung between the pillars (sways gently)
  const gar = new THREE.Group(); g.add(gar);
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, gx = -3.4 + u * 6.8, gy = 4.62 - Math.sin(u * Math.PI) * 0.5;
    const fl = add(new THREE.SphereGeometry(0.085, 7, 6), i % 2 ? MAT.marigold : MAT.marigold2, gx, gy, -8.55, gar, { cast: false });
    fl.scale.y = 0.85;
  }
  garlands.push(gar);
  // brass lamps flanking the steps
  for (const lx of [-2.6, 2.6]) {
    add(new THREE.CylinderGeometry(0.09, 0.16, 0.62, 9), MAT.brassDk, lx, 0.31, -6.2, g, { cast: false });
    const fl = softGlow(0.5, '#ffca7a', 0.0); fl.position.set(lx, 0.72, -6.2); g.add(fl); fl.userData.lampGlow = true;
  }
  // trees + bushes (soft foliage, no colliders)
  const tree = (tx, tz, s) => {
    add(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.4 * s, 8), MAT.woodDk, tx, 1.2 * s, tz, g, { cast: false });
    for (const [ox, oy, oz, r] of [[0, 3.1, 0, 1.25], [-0.8, 2.6, 0.3, 0.9], [0.85, 2.7, -0.2, 0.95], [0.1, 3.8, 0.4, 0.85]]) {
      const c = add(new THREE.SphereGeometry(r * s, 10, 8), MAT.leaf, tx + ox * s, oy * s, tz + oz * s, g, { cast: false }); c.scale.y = 0.82;
    }
  };
  tree(-9.5, -4.5, 1.15); tree(10.5, -1, 0.95); tree(-11, 5.5, 0.85);
  const bush = (bx, bz, s) => {
    for (const [ox, oy, oz, r] of [[0, 0.42, 0, 0.62], [-0.5, 0.32, 0.15, 0.45], [0.5, 0.36, -0.1, 0.5], [0.1, 0.62, 0.2, 0.42]]) {
      const c = add(new THREE.SphereGeometry(r * s, 9, 7), (ox + oz) > 0.2 ? MAT.leaf : MAT.leafDk, bx + ox * s, oy * s, bz + oz * s, g, { cast: false }); c.scale.y = 0.8;
    }
  };
  bush(-4.6, 0.8, 1.25); bush(-5.9, 0.2, 0.9); bush(5.6, 2.8, 1.0); bush(6.8, -4.2, 0.9); bush(-7.2, -3.4, 1.0);
  // low boundary wall segments (sides)
  add(tbox(1.1, 1.5, 22, 3), MAT.stone, -13.5, 0.75, -1, g, { cast: false });
  add(tbox(1.1, 1.5, 22, 3), MAT.stone, 13.5, 0.75, -1, g, { cast: false });
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ---------- THE BELL (hero prop, built from real parts) ----------
// Frame: two stone posts + a heavy wooden beam. The bell hangs from the
// beam on a short link; profile by lathe — mouth rim, sound-bow bulge,
// waist, shoulder, crown loop.
const bellFrame = new THREE.Group(); world.add(bellFrame);
for (const px of [-1.15, 1.15]) {
  add(tbox(0.55, 3.1, 0.55, 2), MAT.stone, px, 1.55, BELL.z, bellFrame, { cast: false });
  add(tbox(0.75, 0.22, 0.75, 2), MAT.stoneDk, px, 3.2, BELL.z, bellFrame, { cast: false });
  add(tbox(0.8, 0.24, 0.8, 2), MAT.stoneDk, px, 0.12, BELL.z, bellFrame, { cast: false });
}
add(tbox(3.1, 0.34, 0.5, 2), MAT.woodDk, 0, 3.32, BELL.z, bellFrame, { cast: false });
const bellG = new THREE.Group(); bellG.position.set(BELL.x, BELL.hangY, BELL.z); world.add(bellG);
{
  const pts = [];
  const prof = [[0.02, -1.0], [0.3, -1.0], [0.52, -0.99], [0.58, -0.97], [0.6, -0.9], [0.575, -0.8], [0.47, -0.62], [0.435, -0.45], [0.44, -0.3], [0.4, -0.16], [0.33, -0.06], [0.2, -0.015], [0.1, 0.0]];
  for (const [px, py] of prof) pts.push(new THREE.Vector2(px, py));
  const body = add(new THREE.LatheGeometry(pts, 28), MAT.brass, 0, 0, 0, bellG);
  body.material.side = THREE.DoubleSide;
  add(new THREE.TorusGeometry(0.585, 0.035, 8, 28), MAT.brassDk, 0, -0.93, 0, bellG).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.47, 0.02, 6, 24), MAT.brassDk, 0, -0.55, 0, bellG).rotation.x = Math.PI / 2;
  const mouth = add(new THREE.CircleGeometry(0.52, 24), MAT.dark, 0, -0.985, 0, bellG, { cast: false });
  mouth.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.11, 0.035, 6, 14), MAT.iron, 0, 0.06, 0, bellG);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), MAT.iron, 0, 0.2, 0, bellG);
  // the clapper ball, hanging still inside (seen through the mouth)
  add(new THREE.SphereGeometry(0.09, 10, 8), MAT.iron, 0, -0.78, 0, bellG, { cast: false });
}
const bellGlint = softGlow(1.15, '#ffe9b0', 0); bellGlint.position.set(0.3, BELL.hangY - 0.55, BELL.z + 0.35); world.add(bellGlint);

// ---------- THE HAMMER LEVER + ROPE + PEG ----------
// A wooden see-saw arm on its own stone pivot post east of the bell
// frame. Striker ball on the long west end (resting just under the
// bell's rim), tail on the east end; the cotton rope ties the tail down
// to a ground peg. Dry rope shrinks -> tail pulled down -> striker
// rises into the sound bow.
const PIVOT = { x: 1.85, y: 1.95, z: BELL.z };
add(tbox(0.46, PIVOT.y - 0.12, 0.46, 2), MAT.stone, PIVOT.x, (PIVOT.y - 0.12) / 2, PIVOT.z, world, { cast: false });
add(tbox(0.6, 0.15, 0.6, 2), MAT.stoneDk, PIVOT.x, PIVOT.y - 0.05, PIVOT.z, world, { cast: false });
add(new THREE.CylinderGeometry(0.05, 0.05, 0.58, 8), MAT.iron, PIVOT.x, PIVOT.y, PIVOT.z, world).rotation.x = Math.PI / 2;
const hammerG = new THREE.Group(); hammerG.position.set(PIVOT.x, PIVOT.y, PIVOT.z); world.add(hammerG);
{
  const arm = add(tbox(2.1, 0.11, 0.13, 2), MAT.wood, -0.27, 0, 0, hammerG);
  add(new THREE.SphereGeometry(0.095, 10, 8), MAT.woodDk, -1.3, 0.01, 0, hammerG);
  add(new THREE.SphereGeometry(0.07, 8, 7), MAT.iron, 0.72, -0.02, 0, hammerG, { cast: false });
  add(new THREE.TorusGeometry(0.055, 0.018, 6, 12), MAT.ropeDry, 0.75, -0.05, 0, hammerG, { cast: false });
}
// the peg (खूँटा): a stout iron-bound stake, rope tied at its head
add(new THREE.CylinderGeometry(0.055, 0.085, 0.34, 8), MAT.woodDk, PEG.x, 0.17, PEG.z, world, { cast: false });
add(new THREE.TorusGeometry(0.075, 0.02, 6, 12), MAT.iron, PEG.x, 0.3, PEG.z, world, { cast: false }).rotation.x = Math.PI / 2;
// the rope: 14 segment cylinders along a sagging quadratic bezier
const ROPE_SEGS = 14;
const ropeSegs = [];
const ropeGeo = new THREE.CylinderGeometry(0.021, 0.021, 1, 6);
for (let i = 0; i < ROPE_SEGS; i++) { const s = new THREE.Mesh(ropeGeo, MAT.ropeDry); s.castShadow = true; s.receiveShadow = true; world.add(s); ropeSegs.push(s); }
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pd = new THREE.Vector3(), _up2 = new THREE.Vector3(0, 1, 0);
const bezPt = (t, out) => {
  const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
  out.set(a * _p0.x + b * _p1.x + c * _p2.x, a * _p0.y + b * _p1.y + c * _p2.y, a * _p0.z + b * _p1.z + c * _p2.z);
  return out;
};
function layoutRope(ang, sag) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  _p0.set(PIVOT.x + 0.75 * ca, PIVOT.y - 0.75 * sa - 0.04, PIVOT.z);
  _p2.set(PEG.x, 0.32, PEG.z);
  _p1.copy(_p0).add(_p2).multiplyScalar(0.5); _p1.y -= sag; _p1.x += 0.06;
  let prev = null;
  for (let i = 0; i < ROPE_SEGS; i++) {
    const t0 = i / ROPE_SEGS, t1 = (i + 1) / ROPE_SEGS;
    bezPt(t0, _pa); bezPt(t1, _pb);
    const s = ropeSegs[i];
    s.position.copy(_pa).add(_pb).multiplyScalar(0.5);
    _pd.copy(_pb).sub(_pa);
    const len = _pd.length();
    s.scale.set(1, len * 1.06, 1);
    s.quaternion.setFromUnitVectors(_up2, _pd.normalize());
  }
}
// drips falling from the rope's low point while it is wet
const drips = [];
for (let i = 0; i < 3; i++) {
  const d = add(new THREE.SphereGeometry(0.028, 7, 6), new THREE.MeshBasicMaterial({ color: 0xaadcf2, transparent: true, opacity: 0 }), 0, -5, 0, world, { cast: false });
  d.userData.ndSkip = true; d.scale.y = 1.5; drips.push(d);
}
// the priest's brass lota on its stone block by the peg (evening reset)
add(tbox(0.52, 0.3, 0.52, 2), MAT.stoneDk, LOTA.x, 0.15, LOTA.z, world, { cast: false });
const lotaG = new THREE.Group(); lotaG.position.set(LOTA.x, 0.3, LOTA.z); world.add(lotaG);
{
  const body = add(new THREE.SphereGeometry(0.19, 14, 10), MAT.brass, 0, 0.13, 0, lotaG); body.scale.y = 0.88;
  add(new THREE.CylinderGeometry(0.075, 0.11, 0.1, 10), MAT.brass, 0, 0.32, 0, lotaG);
  add(new THREE.TorusGeometry(0.075, 0.016, 6, 14), MAT.brassDk, 0, 0.37, 0, lotaG).rotation.x = Math.PI / 2;
}
const pourStream = add(new THREE.CylinderGeometry(0.016, 0.026, 1, 6), MAT.water, 0, -5, 0, world, { cast: false });
pourStream.userData.ndSkip = true;
const pourSplash = softGlow(0.4, '#bfe6f5', 0); pourSplash.position.set(3.78, 0.4, -0.68); world.add(pourSplash);

// grey cloud bank for the cloudy day (fades in over the sunny sky)
const cloudBank = [];
for (const [cx, cy, cz, cs] of [[-14, 30, -30, 46], [10, 33, -36, 55], [26, 29, -24, 40], [-30, 32, -20, 42], [0, 36, -44, 60]]) {
  const s = blobSprite(cs, '#8d97a3', 0); s.position.set(cx, cy, cz); world.add(s); cloudBank.push(s);
}

// ---------- boards ----------
const boardTitle = textBoard(['बिना छुए बजने', 'वाली घंटी'], 4.6, 1.2, '#3a1c10', '#ffe9a8', 900, { fsMul: 0.76, pitch: 0.38, dy: 0.05 });
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['लेकिन कल... वह कुआँ', 'जो कुछ भी डालो, सुबह', 'दोगुना करके लौटा देता था', '— उसका राज़ क्या था?'], 4.6, 1.7, '#2e1a3a', '#ffd76a', 900, { pitch: 0.20, dy: 0.01 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.7, 'boardHook');

// ---------- FX: courtyard dust + rope drying wisps + noon heat shimmer ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 2, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const wispEmit = smoke.addEmitter(3.25, 0.85, -1.4, { rate: 0, color: 0xffffff, opacity: 0.16, scale: 0.4, grow: 1.5, life: 1.5, vy: 0.55, wind: 0.1 });
const shimmerEmit = smoke.addEmitter(0, 2.4, BELL.z, { rate: 0, color: 0xfff2cc, opacity: 0.05, scale: 0.5, grow: 1.3, life: 1.1, vy: 1.3, wind: 0.05 });
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
    wispEmit.rate = pr.steamRate * 3.2;
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

// ---------- word-by-word captions (Salted Mine V3 style) ----------
// Screen-space overlay rendered AFTER the dof pass (so captions are
// never graded or blurred): one word at a time, bold white with a thick
// black stroke, centred, baseline ~77% of frame height, timed from
// web/words.js (script-verbatim Devanagari mapped onto faster-whisper
// timings by align_captions.py). The word holds until the next word
// starts; boards are in-world props in the upper/centre frame and are
// never covered by the caption line.
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
    capG.font = '900 74px "Noto Sans Devanagari", Arial, Helvetica, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.77);
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
const _va = new THREE.Vector3();
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // the bell swings on its link; the hammer lever turns on its pin
  bellG.rotation.z = Ws.bellAng || 0;
  bellG.rotation.x = (Ws.bellAng || 0) * 0.35;
  hammerG.rotation.z = -(Ws.hammerAng || 0);
  layoutRope(Ws.hammerAng || 0, Ws.ropeSag ?? 0.3);
  const wet = Ws.wetK || 0;
  const ropeMat = wet > 0.5 ? MAT.ropeWet : MAT.ropeDry;
  ropeSegs.forEach((s) => { s.material = ropeMat; });
  bellGlint.material.opacity = (Ws.glintK || 0) * 0.85;
  bellGlint.visible = (Ws.glintK || 0) > 0.02;
  // drips: three drops cycle from the rope's low point while it is wet
  const dripK = Ws.dripK || 0;
  drips.forEach((d, i) => {
    const ph = ((f * 1.0 + i * 41) % 67) / 67;
    const on = dripK > 0.05 && ph < 0.55;
    d.visible = on;
    if (on) {
      const u = ph / 0.55;
      d.position.set(3.14 + i * 0.13, 0.8 - u * u * 0.78, -1.32 + i * 0.09);
      d.material.opacity = dripK * 0.85 * (1 - u * 0.4);
    }
  });
  // evening: the lota tilts and pours onto the rope by the peg
  const pour = Ws.pourK || 0;
  lotaG.rotation.z = -pour * 0.85;
  lotaG.position.y = 0.3 + pour * 0.06;
  MAT.water.opacity = pour * 0.75;
  if (pour > 0.03) {
    pourStream.visible = true;
    pourStream.position.set(3.66, 0.6, -0.66);
    pourStream.scale.set(1, 0.52, 1);
    pourStream.rotation.z = 0.5;
  } else pourStream.visible = false;
  pourSplash.material.opacity = pour * 0.5;
  pourSplash.visible = pour > 0.03;
  // grey cloud bank for the cloudy day
  const ck = Ws.cloudK || 0;
  cloudBank.forEach((s, i) => { s.material.opacity = ck * 0.82; s.visible = ck > 0.02; s.position.x += Math.sin(f * 0.002 + i * 2.1) * 0.002; });
  // garland sways in gusts (never a uniform wave)
  garlands.forEach((gr, i) => { gr.rotation.x = Math.sin(f * 0.02 + i * 1.7 + Math.sin(f * 0.006 + i) * 1.3) * 0.05; });
  // lamp flames wake up in the evening grades
  const lampK = Ws.lampK || 0;
  scene.traverse((o) => { if (o.userData.lampGlow) { o.material.opacity = lampK * 0.75; o.visible = lampK > 0.02; } });
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
