import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, PLATFORM, POND, PEBBLES, BANK_TOP } from './story.js';

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
const foodCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcbc'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,250,235,${0.25 + Math.random() * 0.4})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
  for (let i = 0; i < 130; i++) { g.fillStyle = i % 3 ? '#c96a28' : '#5d7a2e'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const waterCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 512);
  gr.addColorStop(0, '#0a1226'); gr.addColorStop(0.5, '#060a18'); gr.addColorStop(1, '#0e1a3a');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  // the sky, held in the water: seeded star dots + one soft moon-path streak
  let seed = 777001; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 130; k++) {
    const x = rnd() * 512, y = rnd() * 512, r = 0.8 + rnd() * 2.1;
    g.fillStyle = `rgba(${210 + Math.floor(rnd() * 45)},${225 + Math.floor(rnd() * 30)},255,${0.35 + rnd() * 0.6})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const mg = g.createLinearGradient(200, 0, 320, 0);
  mg.addColorStop(0, 'rgba(246,239,220,0)'); mg.addColorStop(0.5, 'rgba(246,239,220,0.16)'); mg.addColorStop(1, 'rgba(246,239,220,0)');
  g.fillStyle = mg; g.fillRect(200, 0, 120, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const MAT = {
  plaza: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 10, 10, '#8a8296'),
  stone: texM(M4.stoneV4(8), 3, 2, '#6a6278'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#4a4356'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  gold: toon({ map: goldCanvas }), goldTrim: toon({ color: '#f0bc4a' }),
  blackPot: new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.46, metalness: 0.3, envMap, envMapIntensity: 0.9 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.1, metalness: 1.0, envMap, envMapIntensity: 1.6, side: THREE.DoubleSide }),
  food: toon({ map: foodCanvas }),
  water: toon({ map: waterCanvas }), pebble: toon({ color: '#8a8578' }),
  crimson: toon({ color: '#7a1f2e' }), teal: toon({ color: '#1f4a4a' }),
  cloth: toon({ color: '#8a6f42' }), leaf: toon({ color: '#4a7a34' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
};

// ---------- the palace courtyard ----------
const world = new THREE.Group(); scene.add(world);
const banners = []; const lanternGlows = [];
{
  const g = world;
  const plaza = flat(add(new THREE.CircleGeometry(30, 48), MAT.plaza, 0, 0, 2, g, { cast: false }));
  plaza.scale.set(1.15, 1, 1);
  const ring = flat(add(new THREE.RingGeometry(1.62, 1.86, 40), MAT.stoneDk, PLATFORM.x, 0.012, PLATFORM.z, g, { cast: false }));
  // the platform: a real stone drum the pot rests ON (top = story PLATFORM.top)
  add(new THREE.CylinderGeometry(PLATFORM.r, PLATFORM.r + 0.12, PLATFORM.top, 28), MAT.plaza, PLATFORM.x, PLATFORM.top / 2, PLATFORM.z, g, { cast: false });
  add(new THREE.TorusGeometry(PLATFORM.r + 0.02, 0.035, 8, 36), MAT.stoneDk, PLATFORM.x, PLATFORM.top - 0.02, PLATFORM.z, g, { cast: false }).rotation.x = Math.PI / 2;
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
  // THE PALACE POND (hero prop): stone bank ring + black still water that
  // will hold the whole sky. Water disc is an ellipse (rx 3.0, rz 2.0).
  const pondG = new THREE.Group(); g.add(pondG);
  const bankRing = flat(add(new THREE.RingGeometry(0.97, 1.14, 48), MAT.stoneDk, POND.x, BANK_TOP - 0.01, POND.z, pondG, { cast: false }));
  bankRing.scale.set(POND.rx, POND.rz, 1);
  const waterMesh = flat(add(new THREE.CircleGeometry(1, 48), MAT.water, POND.x, 0.06, POND.z, pondG, { cast: false }));
  waterMesh.scale.set(POND.rx, POND.rz, 1);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    const bx = POND.x + Math.cos(a) * POND.rx * 1.06, bz = POND.z + Math.sin(a) * POND.rz * 1.06;
    const st = add(tbox(0.34, 0.12, 0.24, 2), MAT.stoneDk, bx, BANK_TOP + 0.02, bz, pondG, { cast: false });
    st.rotation.y = -a;
  }
  // court lanterns: practical warm lights (Night Lamp pools) flanking the pond
  for (const [lx, lz] of [[-8.5, 4.5], [8.5, 4.5]]) {
    add(new THREE.CylinderGeometry(0.05, 0.07, 2.3, 7), MAT.woodDk, lx, 1.15, lz, g, { cast: false });
    add(tbox(0.34, 0.42, 0.34, 2), MAT.goldTrim, lx, 2.45, lz, g, { cast: false });
    const lg = softGlow(1.6, '#ffb45e', 0.5); lg.position.set(lx, 2.45, lz); g.add(lg); lanternGlows.push(lg);
    const pool = softGlow(2.4, '#ff9a3c', 0.12); pool.position.set(lx, 0.35, lz); g.add(pool); lanternGlows.push(pool);
  }
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ---------- THE POND STARS + GOLD (hero props, built from real parts) ----------
// Star reflections: soft glints floating ON the water surface, pulsing with
// the shimmer — never above the water, never covering the boy.
const pondGlints = [];
{
  let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, rr = 0.15 + rnd() * 0.7;
    const gx = POND.x + Math.cos(a) * POND.rx * rr, gz = POND.z + Math.sin(a) * POND.rz * rr;
    const gl = softGlow(0.16 + rnd() * 0.12, '#dfe9ff', 0); gl.position.set(gx, 0.16, gz); world.add(gl); pondGlints.push(gl);
  }
}
// Ripple rings on the water: faint expanding rings, brightest at the centre.
const ripples = [];
for (let i = 0; i < 2; i++) {
  const rm = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.52, 40), new THREE.MeshBasicMaterial({ color: 0x9fb8e8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }));
  rm.rotation.x = -Math.PI / 2; rm.position.set(POND.x, 0.09, POND.z); rm.userData.ndSkip = true; world.add(rm); ripples.push(rm);
}
// The counted pebbles: 12 real stones resting ON the bank in a neat row.
const pebbleMeshes = PEBBLES.map(([px, pz]) => {
  const pm = add(new THREE.SphereGeometry(0.09, 10, 8), MAT.pebble, px, BANK_TOP + 0.06, pz, world, { cast: false });
  pm.scale.y = 0.7; pm.visible = false; return pm;
});
// The gold: a hundred coins piled on the dais (metallic gradient + sheen),
// then carried away in a sack.
const goldPileG = new THREE.Group(); goldPileG.position.set(PLATFORM.x, PLATFORM.top, PLATFORM.z); world.add(goldPileG);
{
  let seed = 987654; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, rr = rnd() * 0.55;
    const coin = add(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 14), MAT.gold, Math.cos(a) * rr, 0.02 + (i % 3) * 0.035, Math.sin(a) * rr, goldPileG, { cast: false });
    coin.rotation.y = rnd() * Math.PI;
  }
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.1, 10), MAT.gold, 0, 0.05, 0, goldPileG, { cast: false });
}
const sackG = new THREE.Group(); world.add(sackG);
const sackBody = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.cloth, 0, 0, 0, sackG); sackBody.scale.y = 0.85;
add(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 7), MAT.cloth, 0, 0.2, 0, sackG);
const sackGlint = softGlow(0.55, '#ffe9a8', 0); sackGlint.position.set(0.05, 0.15, 0.05); sackG.add(sackGlint);
// Sky stars: fixed points high above the courtyard (night is never pure black).
const skyStars = (() => {
  let seed = 424242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = 220, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, e = 0.25 + rnd() * 1.1, r = 420;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false }));
  pts.userData.ndSkip = true; scene.add(pts); return pts;
})();

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE BOY WHO ', ' COUNTED ALL ', ' THE STARS '], 4.6, 1.5, '#101736', '#ffe9a8', 900, { pitch: 0.27, dy: 0, fsMul: 0.88 });
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.5, 'boardTitle');
const boardHook = textBoard(['     BUT TOMORROW...     ', '    THE MAN WHO BOUGHT    ', '   THE WIND ITSELF — AND   ', '  SOLD IT BACK TO SAILORS  ', '  HOW DO YOU BUY WIND YOU  ', '      CANNOT HOLD?      '], 4.6, 1.6, '#1a1430', '#ffd76a', 900, { pitch: 0.14, dy: 0.01 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.6, 'boardHook');

// ---------- FX: courtyard dust motes + pot steam + heat shimmer + clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 3, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const steamEmit = smoke.addEmitter(POND.x, 1.0, POND.z, { rate: 0.3, color: 0xffe9a8, opacity: 0.15, scale: 0.3, grow: 1.1, life: 2.6, vy: 0.12, wind: 0.15 });
const shimmerEmit = smoke.addEmitter(POND.x, 0.3, POND.z, { rate: 0, color: 0xfff2cc, opacity: 0.05, scale: 0.42, grow: 1.3, life: 1.1, vy: 1.35, wind: 0.05 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.12, color: 0x8a9ac8, drift: 0.5 });
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
    steamEmit.rate = 0.3 + pr.shimmerRate * 0.8;   // fireflies always drift in the lamplight
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
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // THE POND holds the sky: star glints fade in with the reflections and
  // pulse softly; the water shimmers; ripples breathe on the surface.
  const sk = Ws.starK || 0, shim = Ws.shimmerK || 0;
  pondGlints.forEach((gl, i) => {
    gl.material.opacity = sk * (0.22 + 0.28 * Math.abs(Math.sin(f * 0.07 + i * 1.3)));
    gl.visible = sk > 0.02;
  });
  waterCanvas.offset.x = (f * 0.0004) % 1; waterCanvas.offset.y = (f * 0.0002) % 1;
  ripples.forEach((rm, i) => {
    const ph = ((f / 30 + i * 0.9) % 1.8) / 1.8;
    rm.scale.setScalar(0.6 + ph * 3.0);
    rm.material.opacity = sk * 0.12 * (1 - ph);
    rm.visible = sk > 0.02;
  });
  // The counted pebbles appear one by one, each resting ON the bank.
  pebbleMeshes.forEach((pm, i) => { pm.visible = i < (Ws.pebbleK || 0); });
  // The gold pile settles onto the dais, then the sack carries it away.
  const gk = Ws.goldK || 0;
  goldPileG.visible = gk > 0.01;
  goldPileG.position.y = PLATFORM.top - (1 - gk) * 0.06;
  goldPileG.scale.setScalar(0.85 + 0.15 * gk);
  // the gold sack travels from the dais to the boy's hands
  sackG.visible = (Ws.sackK || 0) > 0.01;
  if (sackG.visible) {
    sackG.position.set(Ws.sackX, Ws.sackY, Ws.sackZ);
    sackGlint.material.opacity = (Ws.glintK || 0) * 0.8;
    sackGlint.visible = (Ws.glintK || 0) > 0.05;
  }
  // lantern flames flicker gently (never a hard pop)
  lanternGlows.forEach((lg, i) => { lg.material.opacity = (i % 2 ? 0.16 : 0.5) * (1 + 0.08 * Math.sin(f * 0.09 + i * 2)); });
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
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
