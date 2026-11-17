import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, STONE_HOME, TABLE, OVEN } from './story.js';

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
const breadCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f2e0b8'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(190,140,70,${0.08 + Math.random() * 0.14})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(150,90,30,${0.25 + Math.random() * 0.3})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const patchCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 63);
  grd.addColorStop(0, 'rgba(255,246,214,1)'); grd.addColorStop(0.45, 'rgba(255,214,130,0.55)'); grd.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MAT = {
  plaza: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 10, 10, '#cfc4ae'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  gold: toon({ map: goldCanvas }), goldTrim: toon({ color: '#f0bc4a' }),
  blackPot: new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.46, metalness: 0.3, envMap, envMapIntensity: 0.9 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.1, metalness: 1.0, envMap, envMapIntensity: 1.6, side: THREE.DoubleSide }),
  food: toon({ map: foodCanvas }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.3, metalness: 0.55, envMap, envMapIntensity: 1.6 }),
  brassDark: toon({ color: '#8a6a2a' }),
  blackStone: texM(M4.stoneV4(9), 2, 2, '#4a4a52'),
  stoneTop: texM(M4.stoneV4(11), 2, 2, '#55555e'),
  brick: texM(M4.stoneV4(6), 2, 2, '#9a5a3c'),
  crackMat: toon({ color: '#14100c' }),
  bread: toon({ map: breadCanvas }),
  loaf: toon({ map: breadCanvas, color: '#e8b45a' }),
  crimson: toon({ color: '#7a1f2e' }), teal: toon({ color: '#1f4a4a' }),
  cloth: toon({ color: '#8a6f42' }), leaf: toon({ color: '#4a7a34' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
};

// ---------- the village bakery courtyard ----------
const world = new THREE.Group(); scene.add(world);
const banners = [];
const bunting = [];
{
  const g = world;
  const plaza = flat(add(new THREE.CircleGeometry(30, 48), MAT.plaza, 0, 0, 2, g, { cast: false }));
  plaza.scale.set(1.15, 1, 1);
  // bakery facade (north, z=-14): warm plaster wall, stone trim, columns
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
  // THE OVEN (west end of the facade): a brick beehive oven with a dark
  // mouth, a chimney, and the crack straight down its middle — the crack
  // the whole story turns on. Built from real parts, never a flat fill.
  const ovenG = new THREE.Group(); ovenG.position.set(OVEN.x, 0, OVEN.z); g.add(ovenG);
  add(tbox(3.4, 1.1, 1.6, 2), MAT.brick, 0, 0.55, 0, ovenG, { cast: false });
  const dome = add(new THREE.SphereGeometry(1.5, 20, 14), MAT.brick, 0, 1.05, 0, ovenG, { cast: false });
  dome.scale.set(1.15, 0.85, 0.6);
  add(new THREE.CylinderGeometry(0.28, 0.34, 1.3, 10), MAT.brick, 0.9, 2.6, -0.2, ovenG, { cast: false });
  add(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), MAT.stoneDk, 0.9, 3.28, -0.2, ovenG, { cast: false });
  const mouth = add(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 16, 1, false, 0, Math.PI), MAT.crackMat, 0, 0.62, 0.82, ovenG, { cast: false });
  mouth.rotation.x = Math.PI / 2; mouth.rotation.z = Math.PI / 2;
  add(tbox(1.5, 0.18, 0.5, 2), MAT.stoneDk, 0, 0.09, 0.85, ovenG, { cast: false });
  // the crack: a jagged dark seam running straight down the dome's face
  const crackPts = [[-0.12, 2.25], [0.1, 1.85], [-0.08, 1.45], [0.12, 1.05], [-0.05, 0.65]];
  for (let i = 0; i < crackPts.length - 1; i++) {
    const [x0, y0] = crackPts[i], [x1, y1] = crackPts[i + 1];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0);
    const seg = add(tbox(0.09, len + 0.08, 0.06, 1), MAT.crackMat, mx, my, 0.86, ovenG, { cast: false });
    seg.rotation.z = Math.atan2(x1 - x0, y1 - y0);
  }
  // fallen brick chunks at the oven's base (the crack's first debris)
  add(tbox(0.34, 0.22, 0.3, 1), MAT.brick, -1.1, 0.11, 0.9, ovenG, { cast: false }).rotation.y = 0.4;
  add(tbox(0.28, 0.18, 0.26, 1), MAT.brick, 1.2, 0.09, 1.0, ovenG, { cast: false }).rotation.y = -0.5;
  // festival banners on poles + bunting strung across the courtyard
  for (const bx of [-6.2, 6.2]) {
    const pole = add(new THREE.CylinderGeometry(0.05, 0.06, 5.6, 7), MAT.woodDk, bx, 2.8, -12.9, g, { cast: false });
    const ban = add(new THREE.PlaneGeometry(1.15, 2.6), bx < 0 ? MAT.crimson : MAT.teal, bx, 3.6, -12.82, g, { cast: false });
    ban.userData.phase = bx; banners.push(ban);
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.goldTrim, bx, 5.68, -12.9, g, { cast: false });
  }
  const flagCols = ['#c23a4a', '#e8a83a', '#3a7a4a', '#3a6a9a', '#e8e0c8'];
  const tri = (s) => {
    const sh = new THREE.Shape(); sh.moveTo(-s / 2, 0); sh.lineTo(s / 2, 0); sh.lineTo(0, -s * 1.1); sh.closePath();
    return new THREE.ShapeGeometry(sh);
  };
  for (let i = 0; i < 13; i++) {
    const u = i / 12, fx = -9 + u * 18, fy = 4.9 - Math.sin(u * Math.PI) * 0.7;
    const fl = new THREE.Mesh(tri(0.5), new THREE.MeshBasicMaterial({ color: flagCols[i % flagCols.length], side: THREE.DoubleSide, fog: true }));
    fl.position.set(fx, fy, -9.5); fl.userData.baseRx = 0; fl.userData.phase = i * 0.9; g.add(fl); bunting.push(fl);
  }
  // side walls (low, warm stone) + corner planters with shrubs
  add(tbox(1.4, 2.6, 26, 3), MAT.stone, -16.7, 1.3, -1, g, { cast: false });
  add(tbox(1.4, 2.6, 26, 3), MAT.stone, 16.7, 1.3, -1, g, { cast: false });
  for (const [px, pz] of [[-14.6, 8.5], [14.6, 8.5], [-14.6, -8], [14.6, -8]]) {
    add(tbox(1.3, 0.6, 1.3, 2), MAT.stoneDk, px, 0.3, pz, g, { cast: false });
    const bush = add(new THREE.SphereGeometry(0.62, 10, 8), MAT.leaf, px, 0.95, pz, g, { cast: false }); bush.scale.y = 0.8;
  }
  // the bread table (east): low wooden table, flour sacks resting ON it
  add(tbox(1.7, 0.09, 1.0, 2), MAT.wood, TABLE.x, 0.74, TABLE.z, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), MAT.woodDk, TABLE.x + lx, 0.37, TABLE.z + lz, g, { cast: false });
  const sack2 = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.cloth, TABLE.x - 0.45, 0.93, TABLE.z + 0.15, g, { cast: false }); sack2.scale.y = 0.85;
  const sack3 = add(new THREE.SphereGeometry(0.19, 10, 8), MAT.cloth, TABLE.x + 0.4, 0.92, TABLE.z - 0.18, g, { cast: false }); sack3.scale.y = 0.85;
  // flour sacks + a dough basket resting on the ground by the oven
  for (const [sx, sz, ry] of [[-3.6, -11.2, 0.3], [-3.1, -10.6, -0.4]]) {
    const sk = add(new THREE.SphereGeometry(0.26, 10, 8), MAT.cloth, sx, 0.22, sz, g, { cast: false }); sk.scale.y = 0.85; sk.rotation.y = ry;
  }
  add(new THREE.CylinderGeometry(0.34, 0.28, 0.3, 12), MAT.woodDk, -2.6, 0.15, -10.8, g, { cast: false });
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ---------- THE STONE, THE PLATE, THE BREAD (hero props, built from real parts) ----------
// The flat black stone: a dark per-stone slab (it drinks the heat), dragged
// from the oven and resting ON the courtyard ground — never floating.
// The wide brass plate: real metal with a moving sheen — polished, tilted
// to bend the sunlight down onto the stone. The flatbreads bake on the
// stone top; the golden loaves wait in their basket on the bread table.
const stoneG = new THREE.Group(); world.add(stoneG);
add(tbox(1.7, 0.28, 1.2, 2), MAT.blackStone, 0, 0, 0, stoneG, { cast: false });
add(tbox(1.66, 0.03, 1.16, 2), MAT.stoneTop, 0, 0.145, 0, stoneG, { cast: false });
for (const [px, pz] of [[-0.7, -0.45], [0.72, 0.4], [0.3, -0.5]]) {
  const peb = add(new THREE.SphereGeometry(0.05, 8, 6), MAT.stoneTop, px, 0.17, pz, stoneG, { cast: false }); peb.scale.y = 0.5;
}
// the sun patch: a soft-edged bright disc lying ON the stone top
const patchDisc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 28),
  new THREE.MeshBasicMaterial({ map: patchCanvas, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
patchDisc.rotation.x = -Math.PI / 2; patchDisc.userData.ndSkip = true; patchDisc.visible = false; world.add(patchDisc);
const patchGlow = softGlow(1.6, '#ffd98a', 0); patchGlow.visible = false; world.add(patchGlow);
// the brass plate group (mesh origin = disc centre; worldState lifts it so
// its bottom edge sits exactly ON the ground whenever it rests)
const plateG = new THREE.Group(); world.add(plateG);
add(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 28), MAT.brass, 0, 0, 0, plateG);
add(new THREE.TorusGeometry(0.55, 0.022, 8, 28), MAT.brassDark, 0, 0, 0, plateG).rotation.x = Math.PI / 2;
add(new THREE.SphereGeometry(0.06, 10, 8), MAT.brassDark, 0, 0.05, 0, plateG);
const plateGlint = softGlow(0.9, '#fff3cf', 0); plateGlint.position.set(0.12, 0.06, 0.12); plateG.add(plateGlint);
// sun-ray cones (the focus): soft additive shafts from the plate down to
// the burning patch — brightest at the source, never a hard wedge
const rayMat = new THREE.MeshBasicMaterial({ color: 0xffdf9e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const rays = [];
for (const off of [[0, 0], [0.35, 0.2], [-0.3, 0.28]]) {
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.6, 1, 12, 1, true), rayMat);
  cone.userData.ndSkip = true; cone.userData.off = off; world.add(cone); rays.push(cone);
}
// the flatbreads: three dough discs that land on the stone, puff, brown
const PALE = new THREE.Color('#f2e0b8'), GOLDEN = new THREE.Color('#b97a28');
const breadMat = MAT.bread;
const breadMeshes = [];
for (let i = 0; i < 3; i++) {
  const m = add(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), breadMat, 0, 0, 0, world, { cast: false });
  m.visible = false; breadMeshes.push(m);
}
// the basket of golden loaves, resting ON the bread table in the feast beat
const loafBasketG = new THREE.Group(); loafBasketG.position.set(TABLE.x, 0.93, TABLE.z); world.add(loafBasketG);
add(new THREE.CylinderGeometry(0.42, 0.34, 0.3, 12), MAT.woodDk, 0, 0, 0, loafBasketG, { cast: false });
for (const [lx, lz, ry] of [[-0.16, -0.1, 0.3], [0.14, -0.14, -0.4], [0.02, 0.12, 0.1], [-0.2, 0.14, 0.8], [0.2, 0.1, -0.9]]) {
  const lf = add(new THREE.SphereGeometry(0.16, 12, 9), MAT.loaf, lx, 0.2, lz, loafBasketG, { cast: false });
  lf.scale.set(1.4, 0.7, 0.85); lf.rotation.y = ry;
}
loafBasketG.visible = false;
const loafGlint = softGlow(0.7, '#ffe9a8', 0); loafGlint.position.set(0.05, 0.3, 0.05); loafBasketG.add(loafGlint);
// the drag rope: baker's hands to the stone's near edge, visible only
// while the stone is being dragged — it is what sells the pull
const ropeMat = new THREE.MeshBasicMaterial({ color: 0x8a6a3a });
const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), ropeMat);
rope.visible = false; rope.userData.ndSkip = true; world.add(rope);

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE BAKER WHO ', ' BAKED BREAD ', ' WITHOUT AN OVEN '], 4.6, 1.5, '#4a2c10', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.5, 'boardTitle');
const boardHook = textBoard(['     BUT TOMORROW...     ', '   HOW DO YOU COUNT   ', '   EVERY STAR IN THE SKY,   ', '   IN A SINGLE NIGHT?   '], 4.6, 1.5, '#2e1a3a', '#ffd76a', 900, { pitch: 0.19, dy: 0.01 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: courtyard dust motes + pot steam + heat shimmer + clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 3, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const dragDustEmit = smoke.addEmitter(-2.8, 0.35, -1.4, { rate: 0, color: 0xd8c8a8, opacity: 0.22, scale: 0.8, grow: 1.6, life: 1.4, vy: 0.25, wind: 0.1 });
const steamEmit = smoke.addEmitter(STONE_HOME.x, 0.95, STONE_HOME.z, { rate: 0, color: 0xffffff, opacity: 0.24, scale: 0.72, grow: 1.7, life: 1.7, vy: 0.9, wind: 0.18 });
const shimmerEmit = smoke.addEmitter(STONE_HOME.x, 0.8, STONE_HOME.z, { rate: 0, color: 0xfff2cc, opacity: 0.05, scale: 0.42, grow: 1.3, life: 1.1, vy: 1.35, wind: 0.05 });
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
    dragDustEmit.rate = pr.dustRate * 3;
    steamEmit.rate = pr.steamRate * 3.2;
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
  // THE STONE: dragged in along the ground, then resting ON the courtyard
  // ground (its slab centre rides 0.14 above the ground — half its thickness)
  stoneG.position.set(Ws.stoneX, Ws.stoneY + 0.14, Ws.stoneZ);
  // the drag rope spans the baker's hands to the stone while it moves
  if (Ws.stoneMoving) {
    const dx = Ws.stoneX - Ws.bakerX, dz = Ws.stoneZ - Ws.bakerZ, dl = Math.hypot(dx, dz) || 1;
    const ax = Ws.bakerX + dx / dl * 0.45, az = Ws.bakerZ + dz / dl * 0.45;
    const bx = Ws.stoneX - dx / dl * 0.8, bz = Ws.stoneZ - dz / dl * 0.8;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, 1.0 - 0.25, bz - az);
    rope.visible = true;
    rope.position.set(mx, (1.0 + 0.25) / 2, mz);
    rope.scale.set(1, len, 1);
    _va.set(bx - ax, 0.25 - 1.0, bz - az).normalize();
    rope.quaternion.setFromUnitVectors(_up, _va);
  } else rope.visible = false;
  // THE BRASS PLATE: leaning / held / tilted to the sun. Mesh origin is the
  // disc centre, so a resting plate is lifted by r*sin(tilt) — its bottom
  // edge sits exactly ON the ground, never sunk, never floating.
  const plateLift = (Ws.plateHeld || 0) ? 0 : 0.55 * Math.sin(Ws.plateTilt || 0);
  plateG.position.set(Ws.plateX, Ws.plateY + plateLift, Ws.plateZ);
  plateG.rotation.x = -(Ws.plateTilt || 0);
  plateGlint.material.opacity = (Ws.plateGlint || 0) * 0.9;
  plateGlint.visible = (Ws.plateGlint || 0) > 0.02;
  // the sun patch: soft-edged bright disc lying ON the stone top, brightest
  // at its centre, fading softly — never a hard light wedge
  const pk = Ws.patchK || 0;
  patchDisc.visible = pk > 0.01;
  if (patchDisc.visible) {
    patchDisc.position.set(Ws.stoneX, Ws.stoneY + 0.30, Ws.stoneZ);
    patchDisc.material.opacity = pk * 0.6;
    const ps = 0.6 + pk * 0.5; patchDisc.scale.set(ps, ps, 1);
  }
  patchGlow.material.opacity = pk * 0.35; patchGlow.visible = pk > 0.02;
  if (patchGlow.visible) patchGlow.position.set(Ws.stoneX, Ws.stoneY + 0.6, Ws.stoneZ);
  // the flatbreads: laid one by one on the stone, puffing, then browning
  const brY = [Ws.breadY0, Ws.breadY1, Ws.breadY2];
  const brX = [Ws.breadX0, Ws.breadX1, Ws.breadX2], brZ = [Ws.breadZ0, Ws.breadZ1, Ws.breadZ2];
  const puffK = (f >= 900 && f <= 925) ? Math.sin((f - 900) / 25 * Math.PI) : 0;
  breadMeshes.forEach((m, i) => {
    const k = Math.max(0, Math.min(1, (Ws.breadK || 0) - i));
    m.visible = k > 0.01;
    if (!m.visible) return;
    m.position.set(brX[i], brY[i] + 0.03, brZ[i]);
    const s = 0.4 + 0.6 * k;
    m.scale.set(s, 1 + 0.35 * puffK, s);
  });
  breadMat.color.copy(PALE).lerp(GOLDEN, Ws.brownK || 0);
  // the basket of golden loaves, resting ON the bread table
  const lk = Ws.loafK || 0;
  loafBasketG.visible = lk > 0.01;
  if (loafBasketG.visible) { const s = 0.6 + 0.4 * lk; loafBasketG.scale.set(s, s, s); }
  loafGlint.material.opacity = (Ws.plateGlint || 0) * 0.8;
  loafGlint.visible = (Ws.plateGlint || 0) > 0.05;
  // sun rays converge from the plate down to the burning patch (soft
  // shafts, brightest at the source, widening as they fall — additive)
  // NOTE: the ray cones stay OFF — additive cone silhouettes read as hard
  // light wedges (banned: lighthouse lesson). The focused sunlight is
  // carried by the bright patch + glow on the stone instead.
  rayMat.opacity = 0;
  const patchPos = _vb.set(Ws.stoneX, Ws.stoneY + 0.3, Ws.stoneZ);
  for (const cone of rays) {
    cone.visible = false;
    if (!cone.visible) continue;
    const off = cone.userData.off;
    _va.set(Ws.plateX, Ws.plateY + 0.2, Ws.plateZ).addScaledVector(skyU.sunDir.value, 2.5); _va.x += off[0]; _va.z += off[1];
    cone.position.copy(_va).add(patchPos).multiplyScalar(0.5);
    const len = _va.distanceTo(patchPos);
    cone.scale.set(1, len, 1);
    cone.quaternion.setFromUnitVectors(_up, _va.sub(patchPos).normalize().negate());
  }
  // festival banners + bunting sway in gusts (never a uniform wave)
  banners.forEach((b, i) => { b.rotation.y = Math.sin(f * 0.021 + i * 1.7 + Math.sin(f * 0.006 + i) * 1.3) * 0.13; });
  bunting.forEach((fl, i) => { fl.rotation.x = Math.sin(f * 0.03 + fl.userData.phase + Math.sin(f * 0.008 + i) * 1.1) * 0.22; });
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
