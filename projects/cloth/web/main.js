import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, COIN_DROP } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const MW = {
  dark: toon({ color: '#3c3a38' }),
  gold: toon({ color: '#c9a227' }),
};

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
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
// soft radial glow sprite (NO hard cross — lamp light, not a sparkle)
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- the set ----------
const MAT = {
  floor: texM(P.stone(64, 40, 5, 58), 8, 8, '#b3a58e'),
  cobble: texM(P.stone(71, 44, 8, 52), 7, 3, '#a89a84'),
  plaster: texM(P.plaster(71, 36), 4, 2, '#dcc7a0'),
  plasterDk: texM(P.plaster(71, 36), 4, 2, '#b39d78'),
  wallCool: texM(P.plaster(73, 30), 4, 2, '#c4bda9'),
  marble: texM(P.marble(10), 2, 1, '#ddd6c4'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  terra: toon({ color: '#b06a3e' }), terraDk: toon({ color: '#8a4f2c' }),
  cream: toon({ color: '#f2e8cf' }),
  gold: toon({ color: '#d9a92c' }), goldDk: toon({ color: '#a87c26' }),
  crimson: toon({ color: '#8c2430' }), crimsonDk: toon({ color: '#671a24' }),
  leaf: toon({ color: '#4a6a34' }),
  jarGreen: toon({ color: '#5d7a4a' }), jarBlue: toon({ color: '#5a6e8a' }),
  sack: toon({ color: '#c9a24d' }),
  dark: toon({ color: '#33302c' }),
  rug: toon({ color: '#7c3a34' }), rugDk: toon({ color: '#5e2c28' }),
  silkMag: texM(P.weave(21, [335, 62, 44]), 1, 1), silkGold: texM(P.weave(22, [43, 72, 44]), 1, 1),
  banner: texM(P.weave(31, [350, 58, 36]), 1, 2),
  winDark: toon({ color: '#2e3440' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  // one ground for the whole stage + area carpets/strips
  flat(add(new THREE.PlaneGeometry(110, 70), MAT.floor, 2, -0.03, 2, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(11, 7.5), MAT.rug, -17, -0.012, -0.5, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(7, 3.6), MAT.rugDk, 0, -0.014, -1.8, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(26, 10), MAT.cobble, 17, -0.018, -0.4, g, { cast: false }));

  // ================= THRONE COURT (x = -17) =================
  add(tbox(21, 6.4, 0.4, 4), MAT.plaster, -17, 3.2, -3.45, g, { cast: false });
  for (const px of [-26.6, -21.5, -12.5, -7.4]) add(tbox(0.55, 6.4, 0.55, 3), MAT.plasterDk, px, 3.2, -3.3, g, { cast: false });
  add(tbox(21, 0.35, 0.1, 3), MAT.woodDk, -17, 5.6, -3.22, g, { cast: false });
  for (const bx of [-21.5, -12.5]) {
    const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.9), MAT.banner);
    bn.position.set(bx, 3.35, -3.2); bn.userData.ndSkip = true; g.add(bn);
  }
  // dais + step
  add(tbox(5.6, 0.18, 3.4, 3), MAT.marble, -17, 0.09, -2.3, g, { cast: false });
  add(tbox(4.6, 0.4, 2.6, 3), MAT.marble, -17, 0.37, -2.45, g, { cast: false });
  // throne (king stands on the dais in front of it, z=-2.3)
  add(box(1.5, 0.5, 1.0), MAT.crimsonDk, -17, 0.8, -3.0, g, { cast: false });
  add(box(1.42, 0.13, 0.95), MAT.crimson, -17, 1.11, -3.0, g, { cast: false });
  add(box(1.5, 2.2, 0.16), MAT.woodDk, -17, 2.15, -3.42, g, { cast: false });
  add(box(1.3, 1.9, 0.06), MAT.crimson, -17, 2.1, -3.32, g, { cast: false });
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.11, 10, 8), MAT.gold, -17 + s * 0.66, 3.32, -3.42, g, { cast: false });
    add(box(0.13, 0.55, 0.13), MAT.woodDk, -17 + s * 0.68, 1.32, -2.95, g, { cast: false });
    add(box(0.15, 0.09, 0.85), MAT.woodDk, -17 + s * 0.68, 1.62, -2.95, g, { cast: false });
  }
  add(new THREE.SphereGeometry(0.14, 10, 8), MAT.gold, -17, 3.42, -3.42, g, { cast: false });
  // pedestal table: the gold + silk rest ON it (top y = 0.82)
  add(tbox(2.3, 0.1, 1.15, 2), MAT.wood, -17, 0.77, -0.55, g, { cast: false });
  for (const [lx, lz] of [[-1.0, -0.45], [1.0, -0.45], [-1.0, 0.45], [1.0, 0.45]]) add(box(0.12, 0.72, 0.12), MAT.woodDk, -17 + lx, 0.36, -0.55 + lz, g, { cast: false });
  add(tbox(1.9, 0.06, 0.85, 2), MAT.woodDk, -17, 0.22, -0.55, g, { cast: false });
  const coinStack = (x, z, n) => { for (let i = 0; i < n; i++) add(new THREE.CylinderGeometry(0.095, 0.095, 0.032, 12), i % 2 ? MAT.gold : MAT.goldDk, x, 0.836 + i * 0.032, z, g, { cast: false }); };
  coinStack(-17.58, -0.72, 4); coinStack(-17.38, -0.42, 3); coinStack(-17.62, -0.38, 2);
  const heap = add(new THREE.SphereGeometry(0.16, 10, 7), MAT.gold, -17.45, 0.85, -0.58, g, { cast: false }); heap.scale.y = 0.45;
  const silk1 = add(box(0.66, 0.15, 0.32), MAT.silkMag, -16.42, 0.895, -0.68, g, { cast: false }); silk1.rotation.y = 0.16;
  const silk2 = add(box(0.66, 0.15, 0.32), MAT.silkGold, -16.42, 0.895, -0.28, g, { cast: false }); silk2.rotation.y = -0.1;
  const silk3 = add(box(0.6, 0.13, 0.3), MAT.silkMag, -16.45, 1.03, -0.48, g, { cast: false }); silk3.rotation.y = 0.42;

  // ================= WEAVING ROOM (x = 0) =================
  add(tbox(21, 5.8, 0.4, 4), MAT.wallCool, 0, 2.9, -3.45, g, { cast: false });
  add(tbox(21, 0.3, 0.08, 4), MAT.woodDk, 0, 0.15, -3.22, g, { cast: false });
  // window (daylight) left
  const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: 0xffe9bb, fog: true }));
  winGlow.position.set(-6.3, 3.0, -3.22); winGlow.userData.ndSkip = true; g.add(winGlow);
  add(tbox(2.0, 0.13, 0.1, 2), MAT.woodDk, -6.3, 4.16, -3.18, g, { cast: false });
  add(tbox(2.0, 0.13, 0.1, 2), MAT.woodDk, -6.3, 1.84, -3.18, g, { cast: false });
  add(tbox(0.13, 2.45, 0.1, 2), MAT.woodDk, -7.25, 3.0, -3.18, g, { cast: false });
  add(tbox(0.13, 2.45, 0.1, 2), MAT.woodDk, -5.35, 3.0, -3.18, g, { cast: false });
  add(tbox(0.08, 2.2, 0.06, 2), MAT.woodDk, -6.3, 3.0, -3.18, g, { cast: false });
  const winGlowS = softGlow(3.0, 0xffd9a0, 0.13); winGlowS.position.set(-6.3, 3.0, -2.8); g.add(winGlowS);
  // shelves with jars, right wall of the room
  for (const sy of [2.4, 3.2]) add(tbox(3.4, 0.09, 0.55, 2), MAT.wood, 6.9, sy, -3.1, g, { cast: false });
  const jar = (x, y, r, h, mat) => { add(new THREE.CylinderGeometry(r, r * 1.05, h, 12), mat, x, y + h / 2, -3.1, g, { cast: false }); add(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.06, 12), MAT.woodDk, x, y + h + 0.03, -3.1, g, { cast: false }); };
  jar(5.6, 2.45, 0.17, 0.42, MAT.terra); jar(6.15, 2.45, 0.15, 0.36, MAT.jarGreen); jar(6.65, 2.45, 0.18, 0.46, MAT.cream);
  jar(7.2, 2.45, 0.14, 0.34, MAT.jarBlue); jar(7.7, 2.45, 0.16, 0.4, MAT.terraDk);
  jar(5.7, 3.25, 0.16, 0.4, MAT.jarBlue); jar(6.3, 3.25, 0.18, 0.44, MAT.cream); jar(6.9, 3.25, 0.15, 0.36, MAT.jarGreen);
  // THE LOOMS — bare wooden frames (EMPTY: that is the joke). Posts,
  // beams and a front roller, all feet flush on the floor.
  const buildLoom = (x) => {
    for (const sx of [-0.85, 0.85]) for (const sz of [-2.05, -1.35])
      add(box(0.13, 1.5, 0.13), MAT.woodDk, x + sx, 0.75, sz, g, { cast: false });
    for (const sz of [-2.05, -1.35]) add(box(1.95, 0.14, 0.14), MAT.wood, x, 1.52, sz, g, { cast: false });
    add(box(1.82, 0.1, 0.1), MAT.wood, x, 0.32, -1.35, g, { cast: false });
    add(box(1.82, 0.1, 0.1), MAT.wood, x, 0.32, -2.05, g, { cast: false });
    const roller = add(new THREE.CylinderGeometry(0.055, 0.055, 1.8, 10), MAT.woodDk, x, 1.02, -1.35, g, { cast: false });
    roller.rotation.z = Math.PI / 2;
    for (const sx of [-0.85, 0.85]) add(box(0.1, 0.08, 0.78), MAT.wood, x + sx, 1.06, -1.7, g, { cast: false });
  };
  buildLoom(-1.7); buildLoom(1.7);
  // side ledge on loom A — the slipped coin rests here (top y = 1.025)
  add(box(0.5, 0.05, 0.5), MAT.wood, -2.8, 1.0, -1.55, g, { cast: false });
  const brace = add(box(0.07, 0.6, 0.07), MAT.woodDk, -2.62, 0.72, -1.5, g, { cast: false }); brace.rotation.z = 0.5;
  // work bench along the wall: pouch + coins + silk rest ON it (top 0.565)
  add(tbox(4.4, 0.09, 0.8, 2), MAT.wood, 0, 0.52, -3.0, g, { cast: false });
  for (const [lx, lz] of [[-2.0, -0.3], [2.0, -0.3], [-2.0, 0.3], [2.0, 0.3]]) add(box(0.11, 0.48, 0.11), MAT.woodDk, lx, 0.24, -3.0 + lz, g, { cast: false });
  const pouch = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.sack, -0.7, 0.68, -3.0, g, { cast: false }); pouch.scale.y = 0.82;
  add(new THREE.CylinderGeometry(0.07, 0.1, 0.1, 8), MAT.sack, -0.7, 0.83, -3.0, g, { cast: false });
  const pouch2 = add(new THREE.SphereGeometry(0.17, 10, 8), MAT.sack, 1.35, 0.65, -3.05, g, { cast: false }); pouch2.scale.y = 0.82;
  const bCoin = (x, z, n) => { for (let i = 0; i < n; i++) add(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), i % 2 ? MAT.gold : MAT.goldDk, x, 0.58 + i * 0.03, z, g, { cast: false }); };
  bCoin(-0.22, -2.9, 3); bCoin(-0.05, -3.08, 2);
  const bSilk = add(box(0.6, 0.14, 0.3), MAT.silkMag, 0.55, 0.635, -3.0, g, { cast: false }); bSilk.rotation.y = 0.2;
  // stool
  add(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12), MAT.wood, 3.6, 0.45, -0.6, g, { cast: false });
  for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) add(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 7), MAT.woodDk, 3.6 + lx, 0.21, -0.6 + lz, g, { cast: false });

  // ================= CITY STREET (x = +17) =================
  const houseCols = ['#e3d3ac', '#d8c2b2', '#b9c4cc', '#e0b7a4'];
  const houseX = [10.5, 14.8, 19.1, 23.4], houseH = [4.6, 5.3, 4.9, 5.6];
  houseX.forEach((hx, i) => {
    const h = houseH[i], mat = texM(P.plaster(80 + i, 30 + i * 4), 2, 2, houseCols[i]);
    add(tbox(4.1, h, 0.5, 3), mat, hx, h / 2, -3.6, g, { cast: false });
    const roof = add(tbox(4.5, 0.16, 1.2, 2), MAT.terraDk, hx, h + 0.1, -3.45, g, { cast: false }); roof.rotation.x = 0.06;
    if (i % 2 === 0) add(box(0.4, 0.7, 0.4), MAT.terraDk, hx + 1.2, h + 0.5, -3.6, g, { cast: false });
    for (const wx of [-1.1, 1.1]) for (const wy of [2.7, 3.8]) {
      if (wy > h - 0.7) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.0), MAT.winDark);
      win.position.set(hx + wx, wy, -3.33); win.userData.ndSkip = true; g.add(win);
      add(tbox(0.86, 0.07, 0.05, 2), MAT.woodDk, hx + wx, wy + 0.54, -3.32, g, { cast: false });
    }
    add(box(0.98, 1.95, 0.09), MAT.woodDk, hx, 0.98, -3.32, g, { cast: false });
    add(box(1.3, 0.12, 0.5), MAT.cobble, hx, 0.06, -3.1, g, { cast: false });
    if (i === 1 || i === 2) {
      const awn = add(box(1.7, 0.06, 0.85), i === 1 ? MAT.crimson : MAT.leaf, hx, 2.3, -3.05, g, { cast: false });
      awn.rotation.x = -0.42;
    }
  });
  // market stall, right end of the street
  for (const [sx, sz] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) add(box(0.09, 2.3, 0.09), MAT.woodDk, 23.8 + sx, 1.15, -2.2 + sz, g, { cast: false });
  const canopy = add(box(2.9, 0.07, 2.1), MAT.crimson, 23.8, 2.36, -2.2, g, { cast: false }); canopy.rotation.z = 0.04;
  add(tbox(2.4, 0.09, 1.5, 2), MAT.wood, 23.8, 0.95, -2.2, g, { cast: false });
  const crate1 = FX.crate(0.95); crate1.position.set(22.9, 0.48, -1.5); g.add(crate1);
  const barrel1 = FX.barrel(0.42, 1.05); barrel1.position.set(24.9, 0.53, -2.9); g.add(barrel1);
  const apples = add(new THREE.SphereGeometry(0.3, 9, 7), MAT.crimson, 23.5, 1.1, -2.3, g, { cast: false }); apples.scale.y = 0.55;
}
// ---- the slipped coin (position driven by worldAt coinY) ----
const coinMesh = add(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 14), MAT.gold, COIN_DROP[0], 1.04, COIN_DROP[1], world, { cast: true });
const pedGlint = FX.glint(0.5); pedGlint.position.set(-17.45, 1.05, -0.55); pedGlint.userData.ndSkip = true; world.add(pedGlint);
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['THE CLOTH ONLY FOOLS', "CAN'T SEE"], 3.4, 1.0, '#4a2c14', '#ffd76a'); boardTitle.position.set(-17, 4.35, -3.12); world.add(boardTitle);
const boardPayoff = textBoard(['THE KING HAS', 'NO CLOTHES ON!'], 2.6, 1.0, '#7a1f1f', '#ffe9a8'); boardPayoff.position.set(18.2, 3.62, -3.14); world.add(boardPayoff);
const boardHook = textBoard(['HOW CAN A STONE', 'BECOME SOUP?'], 2.4, 0.95, '#1f2a44', '#ffd76a'); boardHook.position.set(23.4, 4.9, -3.08); world.add(boardHook);

// ---------- FX: haze + window dust ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(-17, 2.6, -1.0, { rate: 0.10, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-6.3, 2.8, -2.7, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardPayoff, Ws.boardPayoff || 0); setB(boardHook, Ws.boardHook || 0);
  // the slipped coin: ledge -> gravity fall -> floor, exactly where story.js puts it
  coinMesh.position.set(COIN_DROP[0], Ws.coinY ?? 1.04, COIN_DROP[1]);
  pedGlint.material.opacity = 0.3;
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
