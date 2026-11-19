import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, SIGN_POS, HOOK_POS } from './story.js';
import { WORDS } from './words.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const envMap = FX.detailEnv(renderer);
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
// shop practicals: the hanging bulb over the counter + the back-room bulb
const lampA = new THREE.PointLight(0xffc06a, 26, 15, 1.8); lampA.position.set(0.25, 2.45, 1.6); scene.add(lampA);
const lampB = new THREE.PointLight(0xffb45e, 16, 12, 1.8); lampB.position.set(0.3, 2.5, -3.2); scene.add(lampB);
const lampSpot = new THREE.SpotLight(0xffd9a0, 0, 16, 0.5, 0.7, 1.2); lampSpot.position.set(0.25, 2.5, 1.6); scene.add(lampSpot); scene.add(lampSpot.target);
lampSpot.target.position.set(0.25, 1.05, 1.5);

// ---------- text-board helper ----------
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
const plasterCanvas = (seed, base, blotch) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 52;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, blotch); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.05 + rnd() * 0.08; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 1800; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,240,210,0.06)' : 'rgba(60,36,14,0.07)'; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  g.strokeStyle = 'rgba(70,44,20,0.20)'; g.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    let x = rnd() * 512, y = rnd() * 160; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 30; y += 26 + rnd() * 22; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const dirtCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#9a7a4e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 36;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    const dark = rnd() > 0.45;
    gr.addColorStop(0, dark ? 'rgba(52,34,16,0.5)' : 'rgba(224,190,140,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.06 + rnd() * 0.09; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,232,190,0.07)' : 'rgba(28,16,6,0.09)'; g.fillRect(rnd() * 512, rnd() * 512, 2.4, 2.4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// boondi laddu skin: dense orange-gold granules with ghee sheen spots
const ladduCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#c4741a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 1.6 + rnd() * 2.6;
    const cols = ['#d98a26', '#a85f14', '#e89b32', '#8f4f0e', '#cf7f1e'];
    g.fillStyle = cols[(rnd() * cols.length) | 0];
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,226,160,0.13)'; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 0.9 + rnd() * 1.1, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const awningCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#b23a26' : '#f0dfc0'; g.fillRect(i * 64, 0, 64, 128); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(60,30,10,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 128, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const MAT = {
  plaster: toon({ map: plasterCanvas(8, '#bd9668', 'rgba(255,220,170,1)'), color: '#dcc09a' }),
  plasterDk: toon({ map: plasterCanvas(9, '#9c7748', 'rgba(230,190,140,1)'), color: '#bd9a6c' }),
  floor: toon({ map: dirtCanvas(77), color: '#b08e5e' }),
  dirt: toon({ map: dirtCanvas(191), color: '#b08e5e' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.32, metalness: 0.9, envMap, envMapIntensity: 1.0 }),
  ironDk: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.5 }),
  glass: M4.glassMatV4(envMap, 0.4),
  laddu: toon({ map: ladduCanvas(31), color: '#eed9bd' }),
  laddu2: toon({ map: ladduCanvas(47), color: '#f0e0c8' }),
  dark: toon({ color: '#241207' }),
  holeDark: new THREE.MeshBasicMaterial({ color: 0x120802 }),
  skin: toon({ color: '#e8b184' }),
  sleeve: toon({ color: '#c2456e' }),
  curtain: toon({ color: '#a8324f' }),
  awning: toon({ map: awningCanvas }),
  slate: toon({ color: '#33383e' }),
  chalk: new THREE.MeshBasicMaterial({ color: 0xf4f1e6 }),
  leaf: toon({ color: '#4d7a32' }),
};

// ---------- THE SWEET SHOP ----------
// Layout: street/plaza at +Z, facade z=6.2, counter centre z=1.5 with the
// tray at (0.25, ~1.1, 1.5); partition wall z=-0.1 (doorway x -3.3..-2.3,
// channel opening at x 0.02..0.48, y 0.17..0.67); back room z -0.1..-6.5;
// back wall z=-6.5 with the crack at (1.7, 1.55).
const world = new THREE.Group(); scene.add(world);
const bulbGlows = [];
let crackGlow;
{
  const g = world;
  MAT.dirt.map.repeat.set(16, 16); const ground = flat(add(new THREE.CircleGeometry(70, 40), MAT.dirt, 0, -0.02, 10, g, { cast: false }));
  ground.scale.set(1.3, 1, 1);
  // shop floor plinth
  MAT.floor.map.repeat.set(6, 8); add(tbox(9.6, 0.1, 13.6, 3), MAT.floor, 0, -0.05, -0.2, g, { cast: false });
  // ---- facade: pillars, beam, awning, neighbouring shop silhouettes ----
  add(tbox(0.38, 4.8, 0.38, 2), MAT.plaster, -3.3, 2.4, 6.2, g, { cast: false });
  add(tbox(0.38, 4.8, 0.38, 2), MAT.plaster, 3.3, 2.4, 6.2, g, { cast: false });
  add(tbox(7.4, 0.65, 0.4, 2), MAT.plasterDk, 0, 4.85, 6.2, g, { cast: false });
  const awn = add(new THREE.PlaneGeometry(7.6, 1.9), MAT.awning, 0, 4.15, 7.05, g, { cast: false });
  awn.rotation.x = -0.62; awn.material.side = THREE.DoubleSide;
  add(tbox(6.5, 3.6, 0.3, 3), MAT.plasterDk, -7.6, 1.8, 6.4, g, { cast: false });
  add(tbox(6.5, 4.4, 0.3, 3), MAT.plasterDk, 7.8, 2.2, 6.6, g, { cast: false });
  // ---- side + back walls ----
  add(tbox(0.3, 3.9, 13.2, 3), MAT.plaster, -4.65, 1.95, -0.2, g, { cast: false });
  add(tbox(0.3, 3.9, 13.2, 3), MAT.plaster, 4.65, 1.95, -0.2, g, { cast: false });
  add(tbox(9.6, 3.9, 0.3, 3), MAT.plasterDk, 0, 1.95, -6.65, g, { cast: false });
  add(tbox(9.6, 0.35, 13.6, 3), MAT.plasterDk, 0, 3.95, -0.2, g, { cast: false });
  // the crack in the back wall: jagged dark slit + daylight glow behind it
  const crack = add(box(0.12, 0.85, 0.06), MAT.dark, 1.15, 1.5, -6.83, g, { cast: false });
  crack.rotation.z = 0.16;
  const crack2 = add(box(0.09, 0.4, 0.06), MAT.dark, 1.23, 1.07, -6.83, g, { cast: false });
  crack2.rotation.z = -0.5;
  crackGlow = softGlow(1.5, '#ffe9b0', 0.5); crackGlow.position.set(1.17, 1.45, -6.95); g.add(crackGlow);
  // ---- partition wall (z=0.2) with doorway + channel opening ----
  add(tbox(1.3, 3.4, 0.24, 2), MAT.plaster, -3.95, 1.7, -0.1, g, { cast: false });           // left of doorway
  add(tbox(2.32, 3.4, 0.24, 2), MAT.plaster, -1.14, 1.7, -0.1, g, { cast: false });          // doorway -> channel opening
  add(tbox(1.0, 1.1, 0.24, 2), MAT.plaster, -2.8, 2.85, -0.1, g, { cast: false });           // doorway lintel
  add(tbox(0.46, 0.17, 0.24, 2), MAT.plaster, 0.25, 0.085, -0.1, g, { cast: false });        // below opening
  add(tbox(0.46, 2.73, 0.24, 2), MAT.plaster, 0.25, 2.035, -0.1, g, { cast: false });        // above opening
  add(tbox(4.12, 3.4, 0.24, 2), MAT.plaster, 2.54, 1.7, -0.1, g, { cast: false });           // right segment
  // doorway curtain strips
  for (let i = 0; i < 4; i++) {
    const strip = add(box(0.22, 2.1, 0.03), MAT.curtain, -3.22 + i * 0.28, 1.28, -0.1, g, { cast: false });
    strip.geometry.translate(0, -1.05, 0); strip.position.y = 2.33; strip.userData.curtain = i;
    (world.userData.curtains ||= []).push(strip);
  }
  // shelves with mithai jars on the shop side of the partition
  for (const sy of [2.15, 2.72]) {
    add(tbox(3.6, 0.07, 0.4, 2), MAT.woodDk, 0.6, sy, 0.18, g, { cast: false });
    for (let i = 0; i < 4; i++) {
      const jx = -0.9 + i * 1.0 + (sy > 2 ? 0.3 : 0);
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 10), MAT.glass, jx, sy + 0.25, 0.18, g, { cast: false });
      add(new THREE.CylinderGeometry(0.13, 0.14, 0.3, 9), i % 2 ? MAT.laddu : MAT.laddu2, jx, sy + 0.2, 0.18, g, { cast: false });
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10), MAT.brass, jx, sy + 0.49, 0.18, g, { cast: false });
    }
  }
  // ---- the counter (hollow: front + sides + top with the HOLE) ----
  add(tbox(4.9, 1.0, 0.12, 2), MAT.wood, 0, 0.5, 2.08, g, { cast: false });                 // front panel
  add(tbox(0.12, 1.0, 1.35, 2), MAT.wood, -2.44, 0.5, 1.45, g, { cast: false });
  add(tbox(0.12, 1.0, 1.35, 2), MAT.wood, 2.44, 0.5, 1.45, g, { cast: false });
  // top slab around the hole at (0.25, 1.5) r=0.15
  add(tbox(2.6, 0.09, 1.5, 2), MAT.woodDk, -1.2, 1.045, 1.45, g, { cast: false });
  add(tbox(2.1, 0.09, 1.5, 2), MAT.woodDk, 1.45, 1.045, 1.45, g, { cast: false });
  add(tbox(0.3, 0.09, 0.65, 2), MAT.woodDk, 0.25, 1.045, 1.025, g, { cast: false });
  add(tbox(0.3, 0.09, 0.55, 2), MAT.woodDk, 0.25, 1.045, 1.925, g, { cast: false });
  const holeTube = add(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 14, 1, true), MAT.holeDark, 0.25, 0.98, 1.5, g, { cast: false });
  holeTube.material = MAT.holeDark; holeTube.userData.ndSkip = true;
  const holeDisc = add(new THREE.CircleGeometry(0.15, 14), MAT.holeDark, 0.25, 0.9, 1.5, g, { cast: false });
  holeDisc.rotation.x = -Math.PI / 2; holeDisc.userData.ndSkip = true;
  // the diagonal channel trough inside the counter: partition opening -> hole
  const trough = new THREE.Group(); trough.position.set(0.25, 0.4, 0.12); trough.rotation.x = -0.5; g.add(trough);
  add(tbox(0.4, 0.04, 1.0, 2), MAT.woodDk, 0, 0, 0.55, trough, { cast: false });
  add(tbox(0.04, 0.16, 1.0, 2), MAT.wood, -0.2, 0.08, 0.55, trough, { cast: false });
  add(tbox(0.04, 0.16, 1.0, 2), MAT.wood, 0.2, 0.08, 0.55, trough, { cast: false });
  // ---- tarazu (weighing scale) + cash box on the counter ----
  const scaleG = new THREE.Group(); scaleG.position.set(-1.5, 1.09, 1.5); g.add(scaleG);
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 10), MAT.brass, 0, 0.03, 0, scaleG, { cast: false });
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8), MAT.brass, 0, 0.34, 0, scaleG, { cast: false });
  const beam = add(tbox(0.95, 0.035, 0.035, 1), MAT.brass, 0, 0.66, 0, scaleG, { cast: false }); beam.rotation.z = 0.05;
  for (const sx of [-0.44, 0.44]) {
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 4), MAT.ironDk, sx, 0.55, 0, scaleG, { cast: false });
    const pan = add(new THREE.CylinderGeometry(0.15, 0.1, 0.045, 12), MAT.brass, sx, 0.44, 0, scaleG, { cast: false });
    if (sx < 0) { const ld = add(new THREE.SphereGeometry(0.07, 9, 7), MAT.laddu, sx, 0.5, 0, scaleG, { cast: false }); ld.scale.y = 0.85; }
  }
  add(tbox(0.55, 0.22, 0.4, 2), MAT.woodDk, 1.65, 1.2, 1.65, g, { cast: false });
  add(tbox(0.57, 0.04, 0.42, 2), MAT.woodDk, 1.65, 1.33, 1.65, g, { cast: false });
  // ---- kadhai on a stove, shop front-left (steam source) ----
  const stove = new THREE.Group(); stove.position.set(-3.55, 0, 3.6); g.add(stove);
  add(tbox(0.9, 0.55, 0.9, 2), MAT.plasterDk, 0, 0.28, 0, stove, { cast: false });
  const kadhai = add(new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), MAT.ironDk, 0, 0.78, 0, stove, { cast: false });
  kadhai.scale.y = 0.75;
  const syrup = add(new THREE.CircleGeometry(0.4, 14), toon({ color: '#e8a33c' }), 0, 0.72, 0, stove, { cast: false });
  syrup.rotation.x = -Math.PI / 2;
  // ---- wife's corner in the back room: low table, dough, basket ----
  const wtab = new THREE.Group(); wtab.position.set(1.05, 0, -2.5); g.add(wtab);
  add(tbox(1.5, 0.07, 0.85, 2), MAT.wood, 0, 0.44, 0, wtab, { cast: false });
  for (const [lx, lz] of [[-0.65, -0.32], [0.65, -0.32], [-0.65, 0.32], [0.65, 0.32]])
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 6), MAT.woodDk, lx, 0.22, lz, wtab, { cast: false });
  const dough = add(new THREE.SphereGeometry(0.21, 10, 8), toon({ color: '#f0dfba' }), -0.35, 0.55, 0, wtab, { cast: false }); dough.scale.y = 0.6;
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), MAT.wood, 0.28, 0.52, 0.1, wtab, { cast: false }).rotation.z = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const ld = add(new THREE.SphereGeometry(0.075, 9, 7), MAT.laddu, 0.05 + i * 0.16, 0.55, -0.22, wtab, { cast: false }); ld.scale.y = 0.88;
  }
  const basket = new THREE.Group(); basket.position.set(0.15, 0, -3.3); g.add(basket);
  add(new THREE.CylinderGeometry(0.34, 0.26, 0.3, 12, 1, true), MAT.wood, 0, 0.15, 0, basket, { cast: false }).material.side = THREE.DoubleSide;
  add(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12), MAT.woodDk, 0, 0.02, 0, basket, { cast: false });
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, rr = i < 4 ? 0.13 : 0.0;
    const ld = add(new THREE.SphereGeometry(0.08, 9, 7), i % 2 ? MAT.laddu : MAT.laddu2, Math.cos(a) * rr, i < 4 ? 0.3 : 0.4, Math.sin(a) * rr, basket, { cast: false }); ld.scale.y = 0.88;
  }
  // floor cushion where the wife sits
  const cush = add(new THREE.CylinderGeometry(0.42, 0.46, 0.09, 12), MAT.curtain, 0.55, 0.05, -1.5, g, { cast: false });
  // ---- hanging bulbs (practicals) ----
  const mkBulb = (x, y, z, ceilY) => {
    add(new THREE.CylinderGeometry(0.012, 0.012, ceilY - y, 4), MAT.dark, x, (ceilY + y) / 2, z, g, { cast: false });
    const bulb = add(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), x, y, z, g, { cast: false });
    bulb.userData.ndSkip = true;
    const gl = softGlow(1.35, '#ffc06a', 0.5); gl.position.set(x, y, z); g.add(gl); bulbGlows.push(gl);
    const poolTexC = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const gg = c.getContext('2d'); const gr = gg.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,205,130,0.85)'); gr.addColorStop(1, 'rgba(255,205,130,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: poolTexC, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.06, z); pool.userData.ndSkip = true; g.add(pool);
  };
  mkBulb(0.25, 2.5, 1.6, 3.85);
  mkBulb(0.3, 2.55, -3.2, 3.85);
  // distant trees behind the back wall / street silhouettes
  const tree = (x, z, s) => {
    add(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 1.4 * s, 7), MAT.woodDk, x, 0.7 * s, z, g, { cast: false });
    const fol = add(new THREE.SphereGeometry(0.85 * s, 10, 8), MAT.leaf, x, 1.9 * s, z, g, { cast: false }); fol.scale.y = 0.85;
  };
  tree(-7.5, -9, 1.4); tree(6.8, -9.5, 1.1); tree(-9, 12, 1.2);
}

// ---------- THE TRAY (pedestal + dish + laddu mound) — lifts as one ----------
const trayG = new THREE.Group(); trayG.position.set(0.25, 1.09, 1.5); world.add(trayG);
{
  add(new THREE.CylinderGeometry(0.13, 0.2, 0.09, 12), MAT.brass, 0, 0.045, 0, trayG, { cast: false });
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.06 + 0.52 * Math.pow(t, 0.8), 0.02 + 0.13 * t * t)); }
  const dish = add(new THREE.LatheGeometry(pts, 22), MAT.steel, 0, 0.08, 0, trayG, { cast: false });
  dish.material.side = THREE.DoubleSide;
  add(new THREE.TorusGeometry(0.58, 0.022, 8, 26), MAT.brass, 0, 0.235, 0, trayG, { cast: false }).rotation.x = Math.PI / 2;
  // the mound: individual boondi-textured spheres, rings + crown
  let sd = 19; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const ladduAt = (x, y, z, r, m) => { const s = add(new THREE.SphereGeometry(r, 10, 8), m || (rnd() > 0.35 ? MAT.laddu : MAT.laddu2), x, y, z, trayG, { cast: false }); s.scale.y = 0.88; return s; };
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ladduAt(Math.cos(a) * 0.4, 0.27, Math.sin(a) * 0.4, 0.105); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.4; ladduAt(Math.cos(a) * 0.27, 0.36, Math.sin(a) * 0.27, 0.1); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.2; ladduAt(Math.cos(a) * 0.14, 0.45, Math.sin(a) * 0.14, 0.095); }
  ladduAt(0, 0.27, 0, 0.105);
  ladduAt(0, 0.53, 0, 0.095);
  // pistachio flecks on the crown laddu
  for (let i = 0; i < 5; i++) { const fl = add(box(0.03, 0.008, 0.012), MAT.leaf, (rnd() - 0.5) * 0.08, 0.615, (rnd() - 0.5) * 0.08, trayG, { cast: false }); fl.rotation.y = rnd() * 3; }
}
// the refill payoff: one fresh laddu that pops onto the mound + its glint
const popLaddu = add(new THREE.SphereGeometry(0.095, 10, 8), MAT.laddu, 0.25, 1.09 + 0.62, 1.5, world, { cast: false });
popLaddu.scale.setScalar(0.001); popLaddu.visible = false;
const popGlint = softGlow(0.5, '#fff3cf', 0); popGlint.position.set(0.25, 1.78, 1.5); world.add(popGlint);

// ---------- the wife's hand rig: partition opening -> channel -> hole -> tray ----------
const handRig = new THREE.Group(); world.add(handRig);
const handLaddu = add(new THREE.SphereGeometry(0.085, 10, 8), MAT.laddu, 0, 0.1, 0.02, handRig, { cast: false });
{
  const arm = add(new THREE.CylinderGeometry(0.045, 0.055, 0.52, 8), MAT.skin, 0, -0.2, -0.1, handRig, { cast: false });
  arm.rotation.x = 0.5;
  const cuff = add(new THREE.CylinderGeometry(0.062, 0.07, 0.12, 8), MAT.sleeve, 0, -0.36, -0.2, handRig, { cast: false });
  cuff.rotation.x = 0.5;
  const hand = add(new THREE.SphereGeometry(0.062, 9, 7), MAT.skin, 0, 0.02, 0.03, handRig, { cast: false });
  hand.scale.set(1, 0.7, 1.25);
  handRig.visible = false;
}
const HAND_PATH = [[0.25, 0.42, 0.0], [0.25, 0.58, 0.6], [0.25, 0.82, 1.15], [0.25, 0.99, 1.46], [0.25, 1.30, 1.52]];

// ---------- the neighbour's tally slate (chalk groups appear with tallyK) ----------
const tallyG = new THREE.Group(); tallyG.position.set(3.05, 0.62, 3.3); tallyG.rotation.set(-0.5, -0.5, 0); world.add(tallyG);
const tallyMarks = [];
{
  add(tbox(0.62, 0.45, 0.04, 1), MAT.woodDk, 0, 0, 0, tallyG, { cast: false });
  add(box(0.56, 0.39, 0.045), MAT.slate, 0, 0, 0.004, tallyG, { cast: false }).userData.ndSkip = true;
  for (let grp = 0; grp < 8; grp++) {
    const mg = new THREE.Group(); mg.position.set(-0.21 + (grp % 4) * 0.14, grp < 4 ? 0.09 : -0.09, 0.03); tallyG.add(mg);
    for (let k = 0; k < 4; k++) {
      const mk = add(box(0.014, 0.11, 0.006), MAT.chalk, -0.036 + k * 0.024, 0, 0, mg, { cast: false }); mk.userData.ndSkip = true;
    }
    const diag = add(box(0.11, 0.014, 0.006), MAT.chalk, 0, 0, 0.002, mg, { cast: false });
    diag.rotation.z = -0.5; diag.userData.ndSkip = true;
    mg.visible = false; tallyMarks.push(mg);
  }
  const leg = add(tbox(0.05, 0.62, 0.05, 1), MAT.woodDk, 0, -0.42, -0.06, tallyG, { cast: false }); leg.rotation.x = 0.3;
}

// ---------- boards ----------
const boardSign = textBoard(['मिठाई की दुकान'], 5.2, 1.05, '#3a2410', '#ffe9a8');
boardSign.position.set(...SIGN_POS); world.add(boardSign); addBoardOccluder(boardSign, 5.2, 1.05, 'signK');
// the hook board: a standing trader's board in the plaza, legs + frame
const hookG = new THREE.Group(); hookG.position.set(HOOK_POS[0], 0, HOOK_POS[2]); world.add(hookG);
{
  add(tbox(5.0, 0.12, 0.1, 2), MAT.woodDk, 0, HOOK_POS[1] + 1.42, 0, hookG, { cast: false });
  add(tbox(5.0, 0.12, 0.1, 2), MAT.woodDk, 0, HOOK_POS[1] - 1.42, 0, hookG, { cast: false });
  add(tbox(0.12, 2.9, 0.1, 2), MAT.woodDk, -2.44, HOOK_POS[1], 0, hookG, { cast: false });
  add(tbox(0.12, 2.9, 0.1, 2), MAT.woodDk, 2.44, HOOK_POS[1], 0, hookG, { cast: false });
  for (const lx of [-1.9, 1.9]) {
    const leg = add(tbox(0.12, 1.1, 0.12, 2), MAT.woodDk, lx, 0.4, -0.3, hookG, { cast: false }); leg.rotation.x = 0.5;
  }
}
const boardHook = textBoard(['लेकिन कल...', 'वह आदमी जो अपनी ही', 'परछाई बेच आया?'], 4.8, 2.7, '#3a2410', '#ffe9a8', 900, { pitch: 0.20, dy: 0.01, fsMul: 0.58 });
boardHook.position.set(0, HOOK_POS[1], 0); hookG.add(boardHook); addBoardOccluder(boardHook, 4.8, 2.7, 'hookK');

// ---------- FX: bulb dust motes + kadhai steam ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0.25, 2.1, 1.6, { rate: 0.4, color: 0xffe2b8, opacity: 0.06, scale: 0.5, grow: 1.2, life: 3.2, vy: 0.04, wind: 0.04 });
const steamEmit = smoke.addEmitter(-3.55, 0.95, 3.6, { rate: 0, color: 0xf6f2ea, opacity: 0.13, scale: 0.55, grow: 1.9, life: 2.4, vy: 0.42, wind: 0.06 });
let fxF = -1;
const fxReset = () => { smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; }); };
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    moteEmit.rate = pr.moteRate * 3;
    steamEmit.rate = (pr.steamRate || 0) * 3;
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
  float vigf(vec2 uv){ vec2 q = uv - vec2(.5); return 1. - .34 * smoothstep(.38, 1.02, length(q) * 1.42); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb * vigf(vUv), 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3) * vigf(vUv), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- word-by-word captions (Salted Mine V3 signature) ----------
// One word at a time, bold white with thick black stroke, centred, baseline
// ~79% of frame height, synced to words.js. Caption TEXT is the script's
// Devanagari verbatim; long words shrink to fit the frame width.
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
    let fs2 = 84;
    capG.font = `900 ${fs2}px 'Noto Sans Devanagari', Arial, sans-serif`;
    const wdt = capG.measureText(word).width;
    if (wdt > W * 0.9) { fs2 = Math.max(40, Math.floor(fs2 * W * 0.9 / wdt)); capG.font = `900 ${fs2}px 'Noto Sans Devanagari', Arial, sans-serif`; }
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = Math.max(10, fs2 * 0.21); capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.79);
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
const catmull = (pts, u) => {
  const n = pts.length - 1, x = Math.max(0, Math.min(1, u)) * n, i = Math.min(n - 1, Math.floor(x)), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
};
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardSign.material.opacity = Ws.signK ?? 1; boardSign.visible = (Ws.signK ?? 1) > 0.01;
  boardHook.material.opacity = Ws.hookK ?? 0; boardHook.visible = (Ws.hookK ?? 0) > 0.01;
  hookG.visible = boardHook.visible;
  const flick = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  lampA.intensity = 22 * (Ws.lampK ?? 1) * flick;
  lampB.intensity = 16 * (Ws.lampK ?? 1) * (2 - flick) * 0.6 + 5 * (Ws.lampK ?? 1);
  lampSpot.intensity = (Ws.lampK ?? 1) * 24 * flick;
  bulbGlows.forEach((gl, i) => { gl.material.opacity = 0.36 * (Ws.lampK ?? 1) * (0.9 + 0.1 * Math.sin(f * 0.3 + i * 2.1)); });
  crackGlow.material.opacity = 0.38 + 0.18 * Math.abs(Math.sin(f * 0.05));
  (world.userData.curtains || []).forEach((s, i) => { s.rotation.x = 0.05 * Math.sin(f * 0.06 + i * 1.3) + (Ws.curtainK || 0) * 0.35; });
  // the tray lift (reveal beat): the whole tray rises off the hole
  const tk = Ws.trayK || 0;
  trayG.position.y = 1.09 + tk * 0.42;
  trayG.rotation.z = (Ws.trayTilt || 0) * tk;
  trayG.rotation.x = -0.07 * tk;
  // the wife's hand travelling the hidden channel
  const ht = Ws.handT ?? -1;
  handRig.visible = ht >= 0;
  if (ht >= 0) {
    const p = catmull(HAND_PATH, ht);
    handRig.position.set(p[0], p[1], p[2]);
    const p2 = catmull(HAND_PATH, Math.min(1, ht + 0.04));
    handRig.rotation.x = Math.atan2(p2[1] - p[1], Math.hypot(p2[0] - p[0], p2[2] - p[2]) + 0.001) * 0.4;
    handLaddu.visible = (Ws.handLaddu ?? 1) > 0.5;
  }
  // refill payoff pop on the mound
  const pk = Ws.popK || 0;
  popLaddu.visible = pk > 0.01;
  popGlint.position.y = 1.78 + tk * 0.42;
  if (popLaddu.visible) {
    const s = Math.min(1, pk * 1.15);
    popLaddu.scale.set(s, s * 0.88, s);
    popLaddu.position.y = 1.09 + 0.62 + tk * 0.42 + (1 - Math.min(1, pk)) * 0.1;
    popGlint.material.opacity = pk * (0.3 + 0.45 * Math.abs(Math.sin(f * 0.22)));
  } else popGlint.material.opacity = 0;
  // tally marks accumulate on the neighbour's slate
  const nMarks = Math.round((Ws.tallyK || 0) * tallyMarks.length);
  tallyMarks.forEach((mg, i) => { mg.visible = i < nMarks; });
  tallyG.visible = (Ws.tallyK || 0) > 0.001 || (Ws.slateK || 0) > 0;
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
