import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, fxBurstsAt, BOARD_POS, CLIFF_SIGN, CARTP, DITCHP, CHICKP, CHICKC, chickPosAt, BASKETS, FISHBOAT, FISHBOAT_YAW, PALMS, HUTS, ROCKS, WALL, WRECK, E, ET, rampY } from './story.js';

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
const strut = (a, b, r, mat, parent = scene) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, len, 6), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};

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
// boards write their own ND occluder (sized exactly to the board) so scene
// lines can never bleed through the text in the ink pass (batch-4 lesson)
const addBoardOccluder = (board, w, h, key) => {
  const occ = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ndMat);
  occ.position.copy(board.position); occ.rotation.copy(board.rotation);
  occ.userData.isOccluder = true; occ.userData.boardKey = key; board.parent.add(occ); return occ;
};
// soft radial glow sprite (NO hard cross — lamp light, not a sparkle)
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
  for (let i = 0; i < 260; i++) { // brushed-metal streaks
    g.strokeStyle = `rgba(255,240,200,${0.03 + Math.random() * 0.05})`; g.lineWidth = 1;
    const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (Math.random() - 0.5) * 6); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const shellCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#66713a'; g.fillRect(0, 0, 512, 256);
  const hex = (x, y, r, fill, line) => {
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = line; g.lineWidth = 3; g.stroke();
  };
  for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++)
    hex(col * 54 + (row % 2) * 27, row * 52 + 8, 25, row % 2 ? '#5a6834' : '#707c40', '#46522a');
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(40,48,20,${Math.random() * 0.16})`; g.fillRect(Math.random() * 512, Math.random() * 256, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
})();
const MAT = {
  // LIBRARY v4 ground: fine noise + patch variation over the painted bases
  // (groundDetail), a real sand painter (ripples + shell specks) and a real
  // asphalt painter (aggregate, centre wear, dusty edges, cracks).
  grass: texM(M4.groundDetail(P.grass(61), 161, { dots: 3000 }), 16, 16, '#7fae4c'),
  sand: texM(M4.sandV4(41), 12, 12, '#e8d9ae'),
  dirt: texM(M4.groundDetail(P.dirt(35), 171), 8, 8, '#b49a72'),
  asphalt: texM(M4.asphaltV4(77), 1, 1, '#a8a8b2'),
  rock: texM(M4.groundDetail(P.stone(78, 30, 8, 40), 181, { dots: 1800 }), 2, 2, '#9a948a'),
  stone: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 3, 2, '#c9c2b2'), stoneDk: texM(M4.groundDetail(P.stone(65, 40, 6, 46), 195, { dots: 1200 }), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  weave: texM(P.weave(83, '#8a6f42'), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a7a34' }), leaf2: toon({ color: '#5d9042' }),
  goldCar: toon({ map: goldCanvas }), goldTrim: toon({ color: '#f0bc4a' }), goldDk: toon({ color: '#b57f22' }),
  chrome: toon({ color: '#cfd6dd' }), darkMetal: toon({ color: '#3a3f45' }),
  tyre: toon({ color: '#23242a' }), leather: toon({ color: '#7a2e22' }), canvasTop: toon({ color: '#3a3f4a' }),
  glass: M4.glassMatV4(envMap, 0.45), // v4 glass: tint gradient + reflection streak
  lens: new THREE.MeshBasicMaterial({ color: 0xfff6da, transparent: true, opacity: 0.4, fog: true }),
  shell: toon({ map: shellCanvas }), shellDk: toon({ color: '#4c5a2c' }), turtleSkin: toon({ color: '#7d8a4a' }),
  white: toon({ color: '#f7f3e6' }), red: toon({ color: '#b3392e' }), orange: toon({ color: '#e8912d' }),
  dark: toon({ color: '#33302c' }), coconut: toon({ color: '#6a7a3a' }), coconut2: toon({ color: '#7a5a30' }),
  gull: toon({ color: '#eef2f4' }), gullWing: toon({ color: '#c9d4da' }),
  crimson: toon({ color: '#7a1f2e' }),
};
MAT.glass.userData = {};

// ---------- the island ----------
const world = new THREE.Group(); scene.add(world);
let water, foamTex, foamMat;
const ribbon = (aIn, aOut, bIn, bOut, y0, y1, mat, th0 = 0, th1 = 360, step = 3) => {
  // vertical skirt ribbon around the island ellipse (a,b), y0 top -> y1 bottom
  const pos = [], uv = [], idx = [];
  let n = 0;
  for (let th = th0; th <= th1; th += step) {
    const c = Math.cos(rx(th)), s = Math.sin(rx(th));
    pos.push(aIn * c, y0, bIn * s, aOut * c, y1, bOut * s);
    uv.push(th / 6, 0, th / 6, 1);
    if (n > 0) { const k = (n - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }   // outward normals: far rim invisible from inside, lit from the sea
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; world.add(m); return m;
};
const roadRibbon = (halfW, y, mat, vRep = 1) => {
  const pos = [], uv = [], idx = [];
  let n = 0, dist = 0, prev = null;
  for (let th = 0; th <= 360; th += 2) {
    const p = E(th), t = ET(th);
    const nx = t[1], nz = -t[0]; // road normal (perp to heading)
    if (prev) dist += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
    pos.push(p[0] - nx * halfW, y, p[1] - nz * halfW, p[0] + nx * halfW, y, p[1] + nz * halfW);
    uv.push(dist / 3, 0, dist / 3, vRep);
    if (n > 0) { const k = (n - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; world.add(m); return m;
};
{
  const g = world;
  const grassD = flat(add(new THREE.CircleGeometry(1, 56), MAT.grass, 0, 0, 0, g, { cast: false })); grassD.scale.set(31, 24.5, 1);
  const sandD = flat(add(new THREE.CircleGeometry(1, 56), MAT.sand, 0, -0.05, 0, g, { cast: false })); sandD.scale.set(34, 27, 1);
  // island skirt (rock) with two gaps: the jetty shore (78-102 deg) and the cliff cove (352-14 deg)
  ribbon(34, 34.7, 27, 27.7, -0.02, -1.32, MAT.rock, 14, 78);
  ribbon(34, 34.7, 27, 27.7, -0.02, -1.32, MAT.rock, 102, 352);
  // the sea (v4: sparkle glints riding the swell)
  water = FX.makeWater({ size: 800, seg: 72, deep: 0x1d6a8a, shallow: 0x46b2d8, sky: 0xcfeef8, amp: 0.3, spark: 0.8 });
  water.position.y = -1.2; g.add(water);
  // v4 shore foam: a foam-textured band hugging the skirt slope at the
  // waterline (same arcs as the skirt — jetty + cliff-cove gaps kept);
  // the texture drifts slowly and the opacity breathes in worldState.
  foamTex = P.tex(M4.foamCanvas(21), 1, 1);
  foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.5, depthWrite: false, fog: true });
  for (const [t0, t1] of [[14, 78], [102, 352]]) {
    const fm = ribbon(34.47, 34.74, 27.44, 27.72, -0.75, -1.25, foamMat, t0, t1);
    fm.userData.ndSkip = true; fm.renderOrder = 2; fm.receiveShadow = false;
  }
  // the ring road + sand shoulders + centre dashes
  roadRibbon(2.45, 0.008, MAT.sand);
  roadRibbon(1.8, 0.016, MAT.asphalt);
  for (let th = 0; th < 360; th += 6) {
    const p = E(th), t = ET(th);
    const dash = add(box(0.95, 0.014, 0.15), MAT.white, p[0], 0.024, p[1], g, { cast: false });
    dash.rotation.y = Math.atan2(-t[1], t[0]);
  }
  // the cliff shore ramp (mirrors story.rampY: flat to x=32.8, down to -1.15 at 35.2)
  const rampM = add(box(3.9, 0.16, 6.8), MAT.sand, 34.0, -0.68, -2.0, g, { cast: false });
  rampM.rotation.z = -0.435;
  const rampTop = add(box(1.6, 0.1, 6.8), MAT.sand, 32.3, -0.06, -2.0, g, { cast: false });
}
// ---------- palms & huts (LIBRARY v3 props at story positions) ----------
PALMS.forEach(([x, z, ps], i) => {
  const b = PR.buildPalm({ h: 4.1 * ps, seed: 100 + i * 7, lean: 0.1 + ((x * 7 + z * 13) % 5) * 0.03, envMap });
  b.group.position.set(x, 0, z); b.group.rotation.y = x * 1.7 + z; world.add(b.group);
});
HUTS.forEach((h) => {
  const b = PR.buildHut({ w: 2.9 * h.s, d: 2.4 * h.s, h: 1.8 * h.s, seed: 40 + Math.round(h.x * 3 + h.z), wall: h.wall, envMap });
  b.group.position.set(h.x, 0, h.z); b.group.rotation.y = h.ry; world.add(b.group);
});
// ---------- harbour ----------
const boats = [];
const mkBoat = (x, y, z, ry, hullCol, beached = false) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; world.add(g);
  const hullMat = toon({ color: hullCol });
  add(new THREE.BoxGeometry(2.5, 0.55, 1.05), hullMat, 0, 0.1, 0, g, { cast: false });
  const bow = add(new THREE.ConeGeometry(0.52, 1.0, 4), hullMat, 1.72, 0.1, 0, g, { cast: false }); bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.55);
  add(new THREE.BoxGeometry(2.2, 0.1, 0.85), MAT.woodDk, -0.1, 0.42, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.045, 0.05, 2.3, 7), MAT.woodDk, 0.1, 1.5, 0, g, { cast: false });
  const sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0, 1.85); sailShape.lineTo(1.15, 0.15); sailShape.lineTo(0, 0);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshBasicMaterial({ map: FX.sailTexture({}), side: THREE.DoubleSide, fog: true }));
  sail.position.set(0.16, 0.55, 0); sail.userData.ndSkip = true; g.add(sail);
  g.userData.y0 = y; g.userData.beached = beached;
  if (beached) { g.rotation.z = 0.1; }
  boats.push(g); return g;
};
{
  const g = world;
  flat(add(new THREE.CircleGeometry(6.5, 22), MAT.dirt, 2, 0.006, 13, g, { cast: false }));   // harbour apron
  // rental hut + sign
  const rentSign = textBoard(['CAR RENTALS'], 1.8, 0.55, '#173f3a', '#ffe9a8');
  rentSign.position.set(-4.1, 2.15, 12.9); rentSign.rotation.y = 0.5; g.add(rentSign);
  addBoardOccluder(rentSign, 1.8, 0.55, 'always');   // no ink bleed through prop signs either
  // jetty over the water + posts
  add(tbox(2.3, 0.14, 9.5, 2), MAT.wood, 0, 0.1, 25.4, g, { cast: false });
  for (const [px, pz] of [[-1, 21.4], [1, 21.4], [-1, 25.4], [1, 25.4], [-1, 29.4], [1, 29.4]])
    add(new THREE.CylinderGeometry(0.09, 0.1, 1.6, 7), MAT.woodDk, px, -0.6, pz, g, { cast: false });
  mkBoat(3.1, -1.02, 26.8, 0.4, '#b3392e'); mkBoat(-3.5, -1.02, 28.6, -0.35, '#2a6a8a');
  // crates & barrels by the hut
  add(tbox(0.7, 0.7, 0.7, 2), MAT.wood, -7.6, 0.35, 13.6, g, { cast: false });
  add(tbox(0.6, 0.6, 0.6, 2), MAT.woodDk, -7.5, 1.0, 13.5, g, { cast: false });
  add(new THREE.CylinderGeometry(0.34, 0.38, 0.85, 10), MAT.woodDk, -8.4, 0.43, 12.6, g, { cast: false });
  // the sea wall along the jetty plaza (LIBRARY v3 prop, story WALL)
  const wallB = PR.buildStoneWall({ len: WALL.len, h: WALL.h, envMap, seed: 77 });
  wallB.group.position.set(WALL.x, 0, WALL.z); wallB.group.rotation.y = WALL.ry; g.add(wallB.group);
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 1.8, BOARD_POS[0] + 1.8]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(3.9, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.82, BOARD_POS[2], g, { cast: false });
}
// ---------- fishermen / village / wedding / cliff dressing ----------
{
  const g = world;
  // fishermen: beached boat + draped net + baskets
  const fish = [E(156)[0] * 0.865, E(156)[1] * 0.865], out = [fish[0], fish[1]];
  const bl = Math.hypot(out[0], out[1]); out[0] /= bl; out[1] /= bl;
  const ft = ET(156);   // beached boat offset along the shore, off the camera radial
  mkBoat(FISHBOAT[0], 0.02, FISHBOAT[1], FISHBOAT_YAW, '#5d7a8a', true);
  const net = add(new THREE.PlaneGeometry(2.3, 1.5, 6, 4), MAT.weave, fish[0] + 1.6, 0.32, fish[1] - 1.2, g, { cast: false });
  net.rotation.set(-0.5, 0.4, 0.15);
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 9), MAT.wood, BASKETS[0][0], 0.2, BASKETS[0][1], g, { cast: false });
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 9), MAT.woodDk, BASKETS[1][0], 0.2, BASKETS[1][1], g, { cast: false });
  // village huts: placed from story HUTS in the props section above
  // coconut cart (LIBRARY v3 prop) at CARTP
  const cartB = PR.buildCart({ envMap, seed: 19 });
  cartB.group.position.set(CARTP[0], 0, CARTP[1]); cartB.group.rotation.y = 0.7; g.add(cartB.group);
  // wedding arch + the ditch (a real pit: floor + two slopes)
  const arch = new THREE.Group(); arch.position.set(E(295)[0] * 0.82, 0, E(295)[1] * 0.82); arch.rotation.y = 0.9; g.add(arch);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 7), MAT.woodDk, s * 1.3, 1.3, 0, arch, { cast: false });
  add(tbox(2.9, 0.5, 0.06, 2), MAT.crimson, 0, 2.25, 0, arch, { cast: false });
  add(tbox(2.9, 0.16, 0.06, 2), MAT.goldTrim, 0, 1.95, 0, arch, { cast: false });
  const ditch = new THREE.Group(); ditch.position.set(DITCHP[0], 0, DITCHP[1]); const dt = ET(295); ditch.rotation.y = Math.atan2(-dt[1], dt[0]); g.add(ditch);
  const dFloor = flat(add(new THREE.PlaneGeometry(7.5, 1.5), MAT.dirt, 0, -0.47, 0, ditch, { cast: false }));
  const dS1 = add(new THREE.PlaneGeometry(7.5, 1.15), MAT.dirt, 0, -0.24, 1.13, ditch, { cast: false }); dS1.rotation.x = -0.72;
  const dS2 = add(new THREE.PlaneGeometry(7.5, 1.15), MAT.dirt, 0, -0.24, -1.13, ditch, { cast: false }); dS2.rotation.x = 0.72 + Math.PI;
  // chicken patch (dirt) at CHICKP
  flat(add(new THREE.CircleGeometry(3, 16), MAT.dirt, CHICKP[0], 0.02, CHICKP[1], g, { cast: false }));
  // Eagle Cliff: LIBRARY v3 rock stack (story ROCKS) + the warning sign
  const rocksB = PR.buildCliffRocks({ seed: 23, rocks: ROCKS }); g.add(rocksB.group);
  // THE WRECK: the chief's boat, smashed on the cove rocks 90 years ago —
  // a static, tilted hull with a snapped mast (it never bobs: it is aground)
  const wreck = new THREE.Group(); wreck.position.set(WRECK.x, -1.02, WRECK.z); wreck.rotation.set(0.12, WRECK.ry, 0.38); g.add(wreck);
  const wreckMat = toon({ color: '#6a4a34' });
  add(new THREE.BoxGeometry(2.5, 0.55, 1.05), wreckMat, 0, 0.1, 0, wreck, { cast: false });
  const wbow = add(new THREE.ConeGeometry(0.52, 1.0, 4), wreckMat, 1.72, 0.1, 0, wreck, { cast: false }); wbow.rotation.z = -Math.PI / 2; wbow.rotation.y = Math.PI / 4; wbow.scale.set(1, 1, 0.55);
  add(new THREE.BoxGeometry(2.2, 0.1, 0.85), MAT.woodDk, -0.1, 0.42, 0, wreck, { cast: false });
  const wmast = add(new THREE.CylinderGeometry(0.045, 0.05, 1.15, 7), MAT.woodDk, 0.1, 0.95, 0, wreck, { cast: false }); wmast.rotation.z = 0.62;
  const wplank = add(new THREE.BoxGeometry(1.3, 0.07, 0.3), MAT.wood, -1.15, 0.5, 0.3, wreck, { cast: false }); wplank.rotation.set(0.2, 0.4, -0.5);
  // the submerged rock shelf the chief is trapped on (his footing at the waterline)
  const trapRock = add(new THREE.CylinderGeometry(0.55, 0.7, 0.14, 7), MAT.rock, 35.35, -1.2, -3.5, g, { cast: false });
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 7), MAT.woodDk, CLIFF_SIGN[0] + s * -0.553, 0.95, CLIFF_SIGN[1] + s * 0.606, g, { cast: false });   // posts at the rotated board's ends
  const cliffSignB = textBoard(['EAGLE CLIFF', 'GO SLOW!'], 1.8, 0.95, '#7a2a1e', '#ffe9a8');
  cliffSignB.position.set(CLIFF_SIGN[0], 1.62, CLIFF_SIGN[1]); cliffSignB.rotation.y = -2.31; g.add(cliffSignB);
  addBoardOccluder(cliffSignB, 1.8, 0.95, 'always');
}

// ---------- THE GOLDEN CONVERTIBLE (LIBRARY v3 hero prop) ----------
const car = PR.buildCar({ envMap, plate: 'KIRI-1', seed: 7 });
const carG = car.group; world.add(carG);
// ---------- the second queued car (blue, roof up) ----------
const car2 = PR.buildCar({ envMap, plate: 'KIRI-2', seed: 11, paint: '#46689c' });
const car2G = car2.group; world.add(car2G);
// ---------- THE TURTLE (LIBRARY v3 prop) ----------
const turt = PR.buildTurtle({ seed: 29 });
const turtleG = turt.group; world.add(turtleG);
const flippers = turt.flippers;
// ---------- THE BRASS BADGE (pinned on the shell in the badge beat) ----------
// A real little prop: stamped brass disc (materials metal + gold stamp),
// seated ON the dome at local (-0.02, z 0.16) — dome height there is
// 0.729, tilted to the surface normal (0.152 rad toward +z). It is a
// child of the turtle group, so it rides every era/scale with contact.
const badgeMat = new THREE.MeshStandardMaterial({ map: P.tex(FX.goldStampTexture({})), metalness: 0.85, roughness: 0.34, envMap, envMapIntensity: 1.25 });
const badgeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), badgeMat);
badgeMesh.position.set(-0.02, 0.726, 0.16); badgeMesh.rotation.x = 0.152; badgeMesh.castShadow = true;
turtleG.add(badgeMesh);
const badgeGlint = softGlow(0.5, '#ffe9a8', 0);
badgeGlint.position.set(-0.02, 0.78, 0.16); badgeGlint.userData.ndSkip = true;
turtleG.add(badgeGlint);
// ---------- ropes (rescue rope + trap rope, rebuilt per frame) ----------
const ropeMat = toon({ color: '#8a6f42' });
const mkRopeSegs = (n) => {
  const segs = [];
  for (let i = 0; i < n; i++) { const m = add(new THREE.CylinderGeometry(0.021, 0.024, 1, 5), ropeMat, 0, -9, 0, world, { cast: false }); m.visible = false; segs.push(m); }
  return segs;
};
const ropeSegs = mkRopeSegs(16), trapSegs = mkRopeSegs(8);
const _qa = new THREE.Vector3(), _qb = new THREE.Vector3(), _qc = new THREE.Vector3(), _qd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const quadPt = (A, C, B, t, out) => {
  const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
  out.set(A[0] * a + C[0] * b + B[0] * c, A[1] * a + C[1] * b + B[1] * c, A[2] * a + C[2] * b + B[2] * c);
  return out;
};
const laySeg = (m, P0, P1) => {
  _qd.subVectors(P1, P0);
  const len = Math.max(0.001, _qd.length());
  m.position.copy(P0).addScaledVector(_qd, 0.5);
  m.quaternion.setFromUnitVectors(_up, _qd.normalize());
  m.scale.set(1, len, 1);
  m.visible = true;
};
// two quadratic spans A->M->B with a sagging control point per span
const setRope = (segs, A, M, B, sag, on) => {
  if (!on) { segs.forEach((m) => { m.visible = false; }); return; }
  const cA = [(A[0] + M[0]) / 2, (A[1] + M[1]) / 2 - sag, (A[2] + M[2]) / 2];
  const cB = [(M[0] + B[0]) / 2, (M[1] + B[1]) / 2 - sag, (M[2] + B[2]) / 2];
  const half = segs.length / 2;
  for (let i = 0; i < segs.length; i++) {
    const span = i < half ? 0 : 1, j = i % half, t0 = j / half, t1 = (j + 1) / half;
    if (span === 0) { quadPt(A, cA, M, t0, _qa); quadPt(A, cA, M, t1, _qb); }
    else { quadPt(M, cB, B, t0, _qa); quadPt(M, cB, B, t1, _qb); }
    laySeg(segs[i], _qa, _qb);
  }
};
const setRope1 = (segs, A, B, sag, on) => {
  if (!on) { segs.forEach((m) => { m.visible = false; }); return; }
  const c = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - sag, (A[2] + B[2]) / 2];
  for (let i = 0; i < segs.length; i++) {
    quadPt(A, c, B, i / segs.length, _qa); quadPt(A, c, B, (i + 1) / segs.length, _qb);
    laySeg(segs[i], _qa, _qb);
  }
};
// ---------- chickens + feathers + dust bursts ----------
const chickens = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group(); world.add(g);
  const body = add(new THREE.SphereGeometry(0.16, 10, 8), MAT.white, 0, 0.17, 0, g, { cast: false }); body.scale.set(1, 0.92, 1.2);
  add(new THREE.SphereGeometry(0.095, 8, 7), MAT.white, 0, 0.33, 0.13, g, { cast: false });
  const beak = add(new THREE.ConeGeometry(0.035, 0.09, 6), MAT.orange, 0, 0.32, 0.24, g, { cast: false }); beak.rotation.x = Math.PI / 2;
  add(box(0.05, 0.05, 0.03), MAT.red, 0, 0.43, 0.12, g, { cast: false });
  const tail = add(new THREE.ConeGeometry(0.07, 0.2, 5), MAT.white, 0, 0.26, -0.17, g, { cast: false }); tail.rotation.x = -0.8;
  for (const s of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.set(s * 0.13, 0.22, 0); g.add(wg);
    add(box(0.02, 0.16, 0.2), MAT.white, s * 0.02, -0.05, 0, wg, { cast: false });
    g.userData['wing' + (s < 0 ? 'L' : 'R')] = wg;
  }
  g.userData.i = i; chickens.push(g);
}
const feathers = [];
{
  const fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: true });
  for (let i = 0; i < 14; i++) {
    const m = add(new THREE.PlaneGeometry(0.1, 0.055), fm, CHICKC[0], 0.3, CHICKC[1], world, { cast: false });
    m.userData.ndSkip = true; m.userData.a = i / 14 * Math.PI * 2 + 0.4; m.userData.r = 0.4 + (i % 5) * 0.35; m.userData.h = 0.5 + (i % 4) * 0.22;
    feathers.push(m);
  }
}
const CHICK_DA = chickens.map((g, i) => { const a = chickPosAt(i, 0), b = chickPosAt(i, 1); return Math.atan2(b[0] - a[0], b[1] - a[1]); });
const bursts = [];
const mkBurst = (key) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xd9c49a, transparent: true, opacity: 0, fog: true });
  const parts = [];
  for (let i = 0; i < 10; i++) {
    const m = add(new THREE.SphereGeometry(0.05 + (i % 3) * 0.02, 6, 5), mat, 0, -5, 0, world, { cast: false });
    m.userData.ndSkip = true; m.userData.a = i / 10 * Math.PI * 2 + 0.3; m.userData.h = 0.35 + (i % 4) * 0.14; m.userData.r = 0.3 + (i % 3) * 0.22;
    parts.push(m);
  }
  bursts.push({ key, parts, mat });
};
mkBurst('dustChicken'); mkBurst('dustSeller'); mkBurst('dustBand'); mkBurst('dustBrake');
// ---------- gulls (white crows) ----------
const mkGull = () => {
  const grp = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.16, 10, 8), MAT.gull, 0, 0, 0, grp, { cast: false }); body.scale.set(1, 0.85, 1.5);
  add(new THREE.SphereGeometry(0.09, 8, 6), MAT.gull, 0, 0.1, 0.2, grp, { cast: false });
  const beak = add(new THREE.ConeGeometry(0.032, 0.13, 6), MAT.orange, 0, 0.09, 0.32, grp, { cast: false }); beak.rotation.x = Math.PI / 2;
  const wingL = new THREE.Group(); wingL.position.set(-0.1, 0.05, 0); grp.add(wingL);
  add(box(0.4, 0.015, 0.17), MAT.gullWing, -0.2, 0, 0, wingL, { cast: false });
  const wingR = new THREE.Group(); wingR.position.set(0.1, 0.05, 0); grp.add(wingR);
  add(box(0.4, 0.015, 0.17), MAT.gullWing, 0.2, 0, 0, wingR, { cast: false });
  grp.scale.setScalar(1.5); world.add(grp);
  return { grp, wingL, wingR };
};
const gulls = Array.from({ length: 5 }, () => mkGull());
// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
// Longest lines space-padded: textBoard's font size derives from the
// longest line and this Chromium's fallback font advances ~0.66em/cap.
const boardTitle = textBoard([' WHY EVERYONE STOPS ', ' FOR THE TURTLE '], 3.9, 1.2, '#173a2e', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 3.9, 1.2, 'boardTitle');
const boardEra = textBoard(['  90 YEARS AGO  '], 3.9, 1.2, '#3a2a18', '#ffd76a');
boardEra.position.set(...BOARD_POS); world.add(boardEra); addBoardOccluder(boardEra, 3.9, 1.2, 'boardEra');
const boardHook = textBoard(['       BUT TOMORROW...        ', '      HOW CAN A POT COOK      ', '      A WHOLE MEAL WITH       ', '    NOBODY IN THE KITCHEN?    '], 3.9, 1.35, '#2e1a3a', '#ffd76a', 900, { pitch: 0.21, dy: 0.02 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.35, 'boardHook');

// ---------- FX: sea mist + dust motes + clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const mistEmit = smoke.addEmitter(0, 0.6, 24, { rate: 0.3, color: 0xffffff, opacity: 0.045, scale: 2.4, grow: 1.3, life: 3.0, vy: 0.08, wind: -0.4 });
const dustEmit = smoke.addEmitter(CHICKC[0], 1.2, CHICKC[1], { rate: 0, color: 0xffe2b8, opacity: 0.09, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.15, wind: 0.15 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.22, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
// storm rain over the cove (fx Rain: layered drops, lit softly, no beam)
const rain = new FX.Rain(scene, { count: 650, area: 62, height: 34, cx: 27, cz: -4, y: -1.2, opacity: 0.75 });
rain.points.userData.ndSkip = true; rain.points.visible = false;
// splashes + wake for the rescue. Splashes' kill-plane sits at local
// y=0, so the points object is lifted +1.15 and burst heights are given
// in world y minus 1.15 (the sea surface is at -1.2). Wake rings ride
// at y 0.12 by default — dropped to the sea surface here.
const splash = new FX.Splashes(scene, 300);
splash.points.userData.ndSkip = true; splash.points.position.y = 1.15;
const wake = new FX.Wake(scene, 40);
wake.pool.forEach((p) => { p.m.userData.ndSkip = true; p.m.position.y = -1.08; });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  splash.life.fill(-1);
  wake.pool.forEach((p) => { p.life = -1; p.m.visible = false; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    mistEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    rain.update(t);
    const bursts = fxBurstsAt(fxF);
    for (const s of bursts.splash) splash.burst(s[0], s[1] - 1.15, s[2], { power: s[3] });
    if (bursts.wake) wake.trail(bursts.wake[0], bursts.wake[1], dt, bursts.wake[2]);
    splash.update(t, dt);
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
const BURST_POS = {
  dustChicken: () => [CHICKC[0], 0.15, CHICKC[1]],
  dustSeller: () => [CARTP[0] + 0.4, 0.15, CARTP[1] - 1.1],
  dustBand: () => [DITCHP[0], -0.3, DITCHP[1]],
  dustBrake: () => { const hd = [Math.cos(carG.rotation.y), -Math.sin(carG.rotation.y)]; return [carG.position.x + hd[0] * 2.3, 0.12, carG.position.z + hd[1] * 2.3]; },
};
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  if (foamTex) { foamTex.offset.x = f * 0.002; foamMat.opacity = 0.46 + 0.13 * Math.sin(f * 0.045) + (Ws.foamBoost || 0); }
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardEra, Ws.boardEra || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // the car (LIBRARY v3: wheels spin+steer, roof folds, glow + glint via the builder)
  carG.visible = (Ws.carOn || 0) > 0.01;
  carG.position.set(Ws.carX, 0, Ws.carZ);
  carG.rotation.y = Ws.carYaw; carG.rotation.z = -(Ws.carPitch || 0);
  carG.rotation.x = Ws.carShake ? Math.sin(f * 2.3) * 0.008 : 0;   // leaning on the horn
  car.spinWheels(Ws.wheelRot || 0);
  car.steerWheels(Ws.carSteer || 0);
  car.setRoof(Ws.roofK || 0);
  car.setGlow(Ws.glowK || 0);
  car.setGlint(Ws.glintK || 0);
  // the second queued car (static, roof up)
  car2G.visible = (Ws.car2On || 0) > 0.01;
  if (car2G.visible) {
    car2G.position.set(Ws.car2X, 0, Ws.car2Z);
    car2G.rotation.y = Ws.car2Yaw;
    car2.setRoof(0);
  }
  // the turtle (LIBRARY v3 prop: flippers paddle, head dips, mouth yawns;
  // v4 turtle-badge: era scale + swim state come from the story, and the
  // brass badge rides the shell once pinned)
  turtleG.visible = (Ws.turtleOn || 0) > 0.01;
  if (turtleG.visible) {
    const swimming = (Ws.turtleSwim || 0) > 0.01;
    const sc = Ws.turtleScale || 1;
    turtleG.scale.setScalar(sc);
    const ph = swimming ? f * 0.055 : (Ws.turtleStep || 0);
    turtleG.position.set(Ws.turtleX, Ws.turtleY + (swimming ? 0 : Math.abs(Math.sin(ph)) * 0.018 * sc), Ws.turtleZ);
    turtleG.rotation.y = Ws.turtleYaw;
    turtleG.rotation.z = swimming ? Math.sin(f * 0.05) * 0.03 : Math.atan((rampY(Ws.turtleX + 0.6) - rampY(Ws.turtleX - 0.6)) / 1.2) + Math.sin(ph) * 0.02;
    flippers.forEach((fg) => { fg.rotation.y = Math.sin(ph + fg.userData.ph) * (swimming ? 0.4 : 0.55); fg.rotation.z = Math.cos(ph + fg.userData.ph) * 0.16; });
    turt.head.rotation.z = -0.06 - (Ws.turtleYawn || 0) * 0.22;
    turt.setYawn(Ws.turtleYawn || 0);
    badgeMesh.visible = (Ws.badgeOn || 0) > 0.01;
    const bg = (Ws.badgeOn || 0) > 0.01 ? (Ws.badgeGlint || 0) : 0;
    badgeGlint.material.opacity = bg * 0.85; badgeGlint.visible = bg > 0.02;
  }
  // ropes: the rescue rope (wreck -> mouth -> beach) + the trap rope
  setRope(ropeSegs, Ws.ropeA, Ws.ropeM, Ws.ropeB, Ws.ropeSag || 0.1, (Ws.ropeOn || 0) > 0.01);
  setRope1(trapSegs, Ws.trapA, Ws.trapB, 0.03, (Ws.trapOn || 0) > 0.01);
  // storm rain over the cove
  rain.points.visible = (Ws.rainK || 0) > 0.01;
  if (rain.points.visible) rain.uniforms.uOpacity.value = 0.75 * (Ws.rainK || 0);
  // chickens: not part of this story (kept inert; story never enables them)
  const chickOn = (Ws.chickensOn || 0) > 0.01;
  chickens.forEach((g, i) => {
    g.visible = chickOn;
    if (!chickOn) return;
    const k = Ws.chickenK || 0;
    const [px, pz] = chickPosAt(i, k);   // LIBRARY v3: one path for render + collision gate
    const hop = k > 0 && k < 1 ? Math.max(0, Math.sin(k * Math.PI * 3 - i * 0.7)) * 0.17 : 0;
    g.position.set(px, hop, pz);
    g.rotation.y = CHICK_DA[i];
    g.rotation.x = k < 0.03 ? 0.12 + 0.09 * Math.sin(f * 0.21 + i * 1.7) : 0;
    const flap = k > 0 && k < 1 ? Math.sin(f * 1.35 + i * 2.0) * 0.75 : 0.1;
    g.userData.wingL.rotation.z = flap; g.userData.wingR.rotation.z = -flap;
  });
  // feathers flutter out and settle
  const fk = Ws.featherK || 0;
  feathers.forEach((m) => {
    m.visible = fk > 0.005 && fk < 0.995;
    m.material.opacity = (1 - fk) * 0.9;
    m.position.set(CHICKC[0] + Math.cos(m.userData.a) * m.userData.r * (0.4 + fk * 1.7),
      0.25 + Math.sin(fk * Math.PI) * m.userData.h - fk * fk * 0.35 + Math.sin(f * 0.6 + m.userData.a * 7) * 0.03,
      CHICKC[1] + Math.sin(m.userData.a) * m.userData.r * (0.4 + fk * 1.7));
    m.rotation.set(f * 0.11 + m.userData.a * 5, m.userData.a, f * 0.07);
  });
  // dust bursts (parametric arcs, land and stop)
  for (const b of bursts) {
    const k = Ws[b.key] || 0, on = k > 0.01 && k < 0.99, bp = BURST_POS[b.key]();
    b.mat.opacity = on ? (1 - k) * 0.5 : 0;
    for (const p of b.parts) {
      p.visible = on;
      if (!on) continue;
      const rr = 0.15 + p.userData.r * k * 1.6;
      p.position.set(bp[0] + Math.cos(p.userData.a) * rr, bp[1] + 1.35 * k * (1 - k) * p.userData.h + 0.03, bp[2] + Math.sin(p.userData.a) * rr);
    }
  }
  // boats bob at anchor; the beached one stays put
  boats.forEach((b, i) => {
    if (b.userData.beached) return;
    b.position.y = b.userData.y0 + Math.sin(f * 0.021 + i * 1.7) * 0.045;
    b.rotation.z = Math.sin(f * 0.017 + i) * 0.02;
    b.rotation.x = Math.cos(f * 0.019 + i * 2.1) * 0.015;
  });
  // gulls circle the harbour and the cliff
  gulls.forEach((gl, i) => {
    const cliff = i >= 3, cx = cliff ? 24 : 0, cz = cliff ? -2 : 21, cr = cliff ? 7.5 : 9.5, cy = cliff ? 11 : 13.5;
    const a = f * 0.0075 * (i % 2 ? -1 : 1) + i * 1.93;
    gl.grp.position.set(cx + Math.cos(a) * cr, cy + Math.sin(f * 0.013 + i * 2.4) * 0.7, cz + Math.sin(a) * cr);
    gl.grp.rotation.y = Math.atan2(Math.cos(a) * (i % 2 ? -1 : 1), -Math.sin(a) * (i % 2 ? -1 : 1)) + (i % 2 ? Math.PI : 0);
    const flap = 0.25 + 0.55 * Math.sin(f * 0.32 + i * 1.3);
    gl.wingL.rotation.z = flap; gl.wingR.rotation.z = -flap;
  });
  water.userData.update(f / 30);
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
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; return; }   // occluders ARE the ND for boards
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
