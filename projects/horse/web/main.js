import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, horseAt } from './story.js';
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
      gl_FragColor = vec4(c, 1.); }`,
}));
sky.userData.ndSkip = true; scene.add(sky);

// ---------- lights ----------
// sun + hemi come from story lightFor per frame; the three point lights are
// PRACTICALS: the buyer's stable lantern, the dealer's shed lantern, and
// the seventh buyer's hand lantern (position from worldAt each frame).
scene.fog = new THREE.Fog('#ffffff', 40, 600);
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);
const lampStable = new THREE.PointLight(0xffb45e, 0, 17, 1.8); lampStable.position.set(-12.4, 2.6, 3.6); scene.add(lampStable);
const lampDealer = new THREE.PointLight(0xffb45e, 0, 16, 1.8); lampDealer.position.set(8.5, 2.85, 15.0); scene.add(lampDealer);
const lampHand = new THREE.PointLight(0xffc06a, 0, 9, 1.8); scene.add(lampHand);

// ---------- text-board helper ----------
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

// ---------- painted canvases ----------
const dirtCanvas = (seed, base = '#8a6a44') => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 36;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    const dark = rnd() > 0.45;
    gr.addColorStop(0, dark ? 'rgba(52,34,16,0.5)' : 'rgba(214,178,128,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.06 + rnd() * 0.09; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,232,190,0.07)' : 'rgba(28,16,6,0.09)'; g.fillRect(rnd() * 512, rnd() * 512, 2.4, 2.4); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(60,40,20,0.25)'; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 2 + rnd() * 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const grassCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#5d7d33'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 380; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 8 + rnd() * 40;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    const dark = rnd() > 0.5;
    gr.addColorStop(0, dark ? 'rgba(38,58,18,0.55)' : 'rgba(168,196,96,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.07 + rnd() * 0.1; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 5200; i++) {
    g.strokeStyle = rnd() > 0.5 ? 'rgba(190,220,120,0.16)' : 'rgba(30,48,14,0.18)'; g.lineWidth = 1.4;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const coatCanvas = (() => {
  // chestnut horse coat: warm gradient + painted shading streaks + speckle
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = 97; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#b57a42'); gr.addColorStop(0.5, '#a06a34'); gr.addColorStop(1, '#86562a');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    g.strokeStyle = `rgba(255,205,150,${0.03 + rnd() * 0.05})`; g.lineWidth = 1.2;
    const y = rnd() * 512; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (rnd() - 0.5) * 10); g.stroke();
  }
  for (let i = 0; i < 1500; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,214,170,0.05)' : 'rgba(40,20,8,0.06)'; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const awningCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let x = 0; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? '#f3e3bb' : '#b3392e'; g.fillRect(x, 0, 32, 256); }
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(60,30,10,0.05)'; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const blanketCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a02c22'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#e8b93c'; g.fillRect(0, 30, 256, 14); g.fillRect(0, 212, 256, 14);
  g.fillStyle = '#31517a'; g.fillRect(0, 108, 256, 40);
  g.fillStyle = '#f3e3bb'; for (let x = 16; x < 256; x += 32) { g.beginPath(); g.arc(x, 128, 7, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
const sackCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let sd = 47; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#96793f'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) { g.fillStyle = (y / 3) % 2 ? 'rgba(60,40,14,0.10)' : 'rgba(255,230,180,0.07)'; g.fillRect(0, y, 256, 1.6); }
  for (let x = 0; x < 256; x += 3) { g.fillStyle = (x / 3) % 2 ? 'rgba(60,40,14,0.08)' : 'rgba(255,230,180,0.05)'; g.fillRect(x, 0, 1.6, 256); }
  g.strokeStyle = 'rgba(46,28,8,0.55)'; g.lineWidth = 2; g.setLineDash([7, 5]);
  g.beginPath(); g.moveTo(0, 42); g.lineTo(256, 42); g.stroke(); g.setLineDash([]);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();

const MAT = {
  dirt: toon({ map: dirtCanvas(191), color: '#b08e5e' }),
  road: toon({ map: dirtCanvas(77, '#9a7c50'), color: '#c2a06c' }),
  grass: toon({ map: grassCanvas(31), color: '#9db877' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  roof: toon({ color: '#6e4630' }),
  hay: toon({ color: '#d9b45e' }),
  leaf: toon({ color: '#59863c' }), leafDk: toon({ color: '#40642a' }),
  trunk: texM(M4.woodV4(8), 1, 2),
  coat: toon({ map: coatCanvas, color: '#e2ac76' }),
  coatDk: toon({ color: '#5d3a1e' }),
  muzzle: toon({ color: '#d9b48c' }),
  hoof: toon({ color: '#2e2620' }),
  eye: new THREE.MeshBasicMaterial({ color: 0x14100c }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8f979e, roughness: 0.38, metalness: 0.85, envMap, envMapIntensity: 0.9 }),
  ironDk: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.5 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 1.0 }),
  sack: toon({ map: sackCanvas, color: '#c9a86a' }),
  rope: toon({ color: '#8a6a42' }),
  leather: toon({ color: '#4c3016' }),
  blanket: toon({ map: blanketCanvas }),
  awning: toon({ map: awningCanvas, side: THREE.DoubleSide }),
  lampGlass: new THREE.MeshBasicMaterial({ color: 0xffc36a }),
  carrot: toon({ color: '#e07b2a' }), carrotTop: toon({ color: '#4a7a34' }),
  hill: toon({ color: '#7d9a58' }), hillDk: toon({ color: '#5d7a44' }),
};

// ---------- THE SET: market yard, dealer's field, two stables ----------
const world = new THREE.Group(); scene.add(world);
const lanternGlows = [];
const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const gg = c.getContext('2d'); const gr = gg.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,205,130,0.85)'); gr.addColorStop(1, 'rgba(255,205,130,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const lightPool = (x, z, s = 4.4, op = 0.16) => {
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lp.rotation.x = -Math.PI / 2; lp.position.set(x, 0.03, z); lp.userData.ndSkip = true; world.add(lp); return lp;
};
const mkLantern = (x, y, z, parent = world) => {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 4), MAT.ironDk, 0, 0.32, 0, g, { cast: false });
  add(box(0.15, 0.05, 0.15), MAT.ironDk, 0, 0.05, 0, g, { cast: false });
  add(box(0.12, 0.19, 0.12), MAT.lampGlass, 0, -0.08, 0, g, { cast: false });
  add(box(0.16, 0.04, 0.16), MAT.ironDk, 0, -0.2, 0, g, { cast: false });
  const gl = softGlow(1.4, '#ffb45e', 0.5); gl.position.set(0, -0.08, 0); g.add(gl); lanternGlows.push(gl);
  return g;
};
{
  const g = world;
  MAT.dirt.map.repeat.set(16, 16);
  const ground = flat(add(new THREE.CircleGeometry(70, 40), MAT.dirt, 0, -0.02, 14, g, { cast: false }));
  ground.scale.set(1.3, 1, 1);
  // the dealer's grass field behind the fence
  MAT.grass.map.repeat.set(11, 4);
  flat(add(new THREE.PlaneGeometry(46, 17), MAT.grass, 1, 0.004, 17.6, g, { cast: false }));
  // the road: from the buyer's stable front, east to the dealer's gate
  MAT.road.map.repeat.set(13, 1);
  flat(add(new THREE.PlaneGeometry(42, 3.6), MAT.road, -4, 0.012, 0.55, g, { cast: false }));

  // ----- fence line z=9 with the gate gap x[-0.4, 2.6] -----
  const fenceRun = (x0, x1) => {
    add(tbox(x1 - x0, 0.09, 0.07, 2), MAT.wood, (x0 + x1) / 2, 1.02, 9.02, g, { cast: false });
    add(tbox(x1 - x0, 0.09, 0.07, 2), MAT.woodDk, (x0 + x1) / 2, 0.55, 9.02, g, { cast: false });
    for (let x = x0 + 0.4; x < x1; x += 2.1) add(tbox(0.14, 1.35, 0.14, 2), MAT.woodDk, x, 0.67, 9.02, g, { cast: false });
  };
  fenceRun(-14, -0.4); fenceRun(2.6, 16);
  add(tbox(0.2, 1.7, 0.2, 2), MAT.woodDk, -0.4, 0.85, 9.02, g, { cast: false });
  add(tbox(0.2, 1.7, 0.2, 2), MAT.woodDk, 2.6, 0.85, 9.02, g, { cast: false });

  // ----- the hook board on its two posts at the gate -----
  add(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), MAT.woodDk, -1.05, 1.8, 8.6, g, { cast: false });
  add(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), MAT.woodDk, 3.25, 1.8, 8.6, g, { cast: false });

  // ----- the buyer's stable (-13, 3): plank walls, loose door, lantern --
  const st = new THREE.Group(); g.add(st);
  add(tbox(7.5, 3.4, 0.35, 3), MAT.wood, -13.25, 1.7, 6.55, st, { cast: false });
  add(tbox(0.35, 3.2, 6.1, 3), MAT.woodDk, -16.8, 1.6, 3.45, st, { cast: false });
  add(tbox(0.35, 3.2, 6.1, 3), MAT.woodDk, -9.05, 1.6, 3.45, st, { cast: false });
  add(tbox(4.4, 3.2, 0.35, 3), MAT.wood, -14.8, 1.6, 0.55, st, { cast: false });
  add(tbox(3.3, 0.55, 0.35, 2), MAT.woodDk, -10.95, 3.02, 0.55, st, { cast: false });
  const roofL = add(tbox(4.6, 0.12, 7.6, 2), MAT.roof, -15.1, 3.85, 3.5, st, { cast: false }); roofL.rotation.z = 0.32;
  const roofR = add(tbox(4.6, 0.12, 7.6, 2), MAT.roof, -11.4, 3.85, 3.5, st, { cast: false }); roofR.rotation.z = -0.32;
  add(tbox(0.24, 0.24, 7.6, 2), MAT.woodDk, -13.25, 4.18, 3.5, st, { cast: false });
  // hay inside: bales + a loose pile the horse never touched on the nights
  add(tbox(1.1, 0.62, 0.7, 2), MAT.hay, -15.7, 0.31, 5.3, st, { cast: false });
  add(tbox(0.95, 0.55, 0.65, 2), MAT.hay, -15.5, 0.28, 3.6, st, { cast: false });
  const pile = add(new THREE.SphereGeometry(0.55, 10, 7), MAT.hay, -14.6, 0.1, 4.6, st, { cast: false }); pile.scale.set(1.2, 0.38, 1.1);
  add(tbox(1.4, 0.5, 0.6, 2), MAT.woodDk, -11.6, 0.25, 5.6, st, { cast: false }); // feed trough
  mkLantern(-12.4, 2.95, 3.6, st);
  lightPool(-12.4, 3.6, 5.2, 0.15);

  // ----- the dealer's shed in his field (8.5, 15) -----
  const sh = new THREE.Group(); g.add(sh);
  add(tbox(6.2, 3.6, 0.35, 3), MAT.wood, 8.5, 1.8, 17.55, sh, { cast: false });
  add(tbox(0.35, 3.4, 4.4, 3), MAT.woodDk, 5.6, 1.7, 15.4, sh, { cast: false });
  add(tbox(0.35, 3.4, 4.4, 3), MAT.woodDk, 11.4, 1.7, 15.4, sh, { cast: false });
  add(tbox(6.2, 0.42, 0.35, 2), MAT.woodDk, 8.5, 3.32, 13.5, sh, { cast: false });
  const shRoof = add(tbox(7.0, 0.12, 5.6, 2), MAT.roof, 8.5, 3.95, 15.5, sh, { cast: false }); shRoof.rotation.x = 0.16;
  add(tbox(1.15, 0.62, 0.72, 2), MAT.hay, 6.6, 0.31, 16.6, sh, { cast: false });
  add(tbox(1.5, 0.45, 0.62, 2), MAT.woodDk, 10.2, 0.23, 14.4, sh, { cast: false }); // trough
  mkLantern(8.5, 3.25, 15.0, sh);
  lightPool(8.5, 15.0, 5.4, 0.15);

  // ----- the field tree -----
  add(new THREE.CylinderGeometry(0.3, 0.46, 3.4, 9), MAT.trunk, -6.5, 1.7, 14, g, { cast: false });
  const fol1 = add(new THREE.SphereGeometry(1.7, 11, 9), MAT.leaf, -6.5, 4.3, 14, g, { cast: false }); fol1.scale.set(1.15, 0.85, 1.1);
  const fol2 = add(new THREE.SphereGeometry(1.25, 10, 8), MAT.leafDk, -7.6, 3.7, 14.4, g, { cast: false });
  const fol3 = add(new THREE.SphereGeometry(1.15, 10, 8), MAT.leaf, -5.5, 3.8, 13.5, g, { cast: false });

  // ----- market stalls -----
  const mkStall = (x, z, ry) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
    for (const [px, pz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]])
      add(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), MAT.woodDk, px, 1.25, pz, s, { cast: false });
    add(tbox(2.9, 0.1, 1.7, 2), MAT.wood, 0, 1.02, 0, s, { cast: false });
    const awn = add(new THREE.PlaneGeometry(3.3, 2.2), MAT.awning, 0, 2.62, 0, s, { cast: false });
    awn.rotation.x = -0.42; awn.material = MAT.awning;
    add(tbox(0.7, 0.7, 0.7, 2), MAT.wood, -0.8, 0.35, 0.2, s, { cast: false });
    const sk = add(new THREE.SphereGeometry(0.3, 9, 7), MAT.sack, 0.75, 0.2, 0.3, s, { cast: false }); sk.scale.set(1, 0.72, 1);
    add(new THREE.CylinderGeometry(0.3, 0.27, 0.85, 11), MAT.wood, 1.65, 0.43, -0.5, s, { cast: false });
    return s;
  };
  mkStall(-8, 5.8, 0.3);
  mkStall(10.5, 4.5, -0.4);
  // loose dressing: crates, a barrel, sacks near the fence
  add(tbox(0.85, 0.85, 0.85, 2), MAT.wood, -4.6, 0.43, 7.4, g, { cast: false });
  add(tbox(0.68, 0.68, 0.68, 2), MAT.woodDk, -4.55, 1.19, 7.35, g, { cast: false });
  add(new THREE.CylinderGeometry(0.33, 0.29, 0.92, 12), MAT.wood, 5.4, 0.46, 6.6, g, { cast: false });
  const sk3 = add(new THREE.SphereGeometry(0.3, 9, 7), MAT.sack, -5.5, 0.2, 6.9, g, { cast: false }); sk3.scale.set(1, 0.72, 1);

  // ----- distance: hills + two farmhouses, painted silhouettes -----
  const h1 = add(new THREE.SphereGeometry(17, 12, 9), MAT.hill, -24, -3, 46, g, { cast: false }); h1.scale.set(1.1, 0.5, 1);
  const h2 = add(new THREE.SphereGeometry(19, 12, 9), MAT.hillDk, 20, -3.5, 52, g, { cast: false }); h2.scale.set(1.2, 0.48, 1);
  const h3 = add(new THREE.SphereGeometry(24, 12, 9), MAT.hill, 0, -5, 66, g, { cast: false }); h3.scale.set(1.3, 0.5, 1);
  const farm = (x, z, s) => {
    const fg = new THREE.Group(); fg.position.set(x, 0, z); fg.scale.setScalar(s); g.add(fg);
    add(tbox(3.2, 2.0, 2.4, 2), MAT.wood, 0, 1.0, 0, fg, { cast: false });
    const rf = add(tbox(3.7, 0.14, 2.9, 2), MAT.roof, 0, 2.35, 0, fg, { cast: false }); rf.rotation.z = 0.0;
    add(tbox(0.9, 1.3, 0.1, 2), MAT.woodDk, 0, 0.65, 1.22, fg, { cast: false });
  };
  farm(-19, 27, 1.1); farm(17.5, 30, 0.9);
}

// ---------- the loose stable door (hinged at x=-12.45) + its padlock ----
// The lock insert's whole point: this door was never forced — the padlock
// hangs unbroken on the hasp while the door itself hangs loose.
const doorG = new THREE.Group(); doorG.position.set(-12.45, 0, 0.6); world.add(doorG);
{
  add(tbox(2.15, 2.7, 0.09, 2), MAT.wood, 1.075, 1.35, 0, doorG, { cast: false });
  add(tbox(2.15, 0.16, 0.12, 2), MAT.woodDk, 1.075, 2.25, 0, doorG, { cast: false });
  add(tbox(2.15, 0.16, 0.12, 2), MAT.woodDk, 1.075, 0.5, 0, doorG, { cast: false });
  const diag = add(tbox(2.3, 0.15, 0.12, 2), MAT.woodDk, 1.075, 1.37, 0, doorG, { cast: false }); diag.rotation.z = 0.62;
  // the padlock on the hasp at the door's free edge
  add(box(0.07, 0.3, 0.05), MAT.ironDk, 2.02, 1.2, -0.07, doorG, { cast: false });
  add(box(0.2, 0.26, 0.09), MAT.steel, 2.02, 0.98, -0.08, doorG, { cast: false });
  const shackle = add(new THREE.TorusGeometry(0.075, 0.02, 6, 12, Math.PI), MAT.steel, 2.02, 1.13, -0.08, doorG, { cast: false });
  shackle.rotation.z = 0;
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 8), MAT.brass, 2.02, 0.97, -0.13, doorG, { cast: false }).rotation.x = Math.PI / 2;
}

// ---------- boards ----------
// The hook board: the next story's question, painted on the gate board.
// Always in the world; opacity is worldAt's boardHook (fade in on hookq,
// FULL through the literal final frame). Boards are never graded — the
// texture colours are chosen to read in the dusk grade as-is.
const boardHook = textBoard(['THE NIGHT WATCHMAN WHO', 'SLEPT ALL NIGHT —', 'AND CAUGHT EVERY THIEF?'], 4.0, 1.7, '#2e3a5a', '#ffe9a8', 900, { pitch: 0.27, dy: 0.01, fsMul: 0.94 });
boardHook.position.set(...BOARD_POS); boardHook.rotation.y = Math.PI; world.add(boardHook);
addBoardOccluder(boardHook, 4.0, 1.7, 'boardHook');

// ---------- THE HORSE (built character, forward = +x local) ----------
// Body, chest, rump, neck + head on a pivot (headK lowers it to graze /
// eat), ears, mane, tail on a sway pivot, and four two-segment legs whose
// pivots are driven by the DISTANCE-based gait phase from story.horseAt —
// feet cycle with ground speed and freeze when the horse stands.
const horseG = new THREE.Group(); world.add(horseG);
const horseBody = new THREE.Group(); horseG.add(horseBody);
const horseParts = { legs: [], ears: [] };
{
  const b = horseBody;
  const body = add(new THREE.SphereGeometry(0.6, 16, 12), MAT.coat, 0, 1.12, 0, b); body.scale.set(1.5, 0.95, 0.82);
  const chest = add(new THREE.SphereGeometry(0.5, 13, 10), MAT.coat, 0.52, 1.13, 0, b); chest.scale.set(1, 0.98, 0.84);
  const rump = add(new THREE.SphereGeometry(0.52, 13, 10), MAT.coat, -0.52, 1.15, 0, b); rump.scale.set(1, 0.96, 0.85);
  // neck + head on the neck pivot (front-top of the chest)
  const neckG = new THREE.Group(); neckG.position.set(0.72, 1.3, 0); b.add(neckG); horseParts.neckG = neckG;
  const neck = add(new THREE.CylinderGeometry(0.155, 0.27, 0.88, 11), MAT.coat, 0.26, 0.3, 0, neckG); neck.rotation.z = -0.62;
  const maneN = add(tbox(0.85, 0.2, 0.05, 2), MAT.coatDk, 0.02, 0.44, 0, neckG); maneN.rotation.z = -0.62;
  const headG = new THREE.Group(); headG.position.set(0.52, 0.62, 0); neckG.add(headG); horseParts.headG = headG;
  const skull = add(new THREE.SphereGeometry(0.29, 13, 10), MAT.coat, 0, 0, 0, headG); skull.scale.set(1.3, 0.8, 0.64);
  const muzzle = add(tbox(0.36, 0.21, 0.21, 2), MAT.muzzle, 0.38, -0.07, 0, headG);
  add(new THREE.SphereGeometry(0.045, 8, 6), MAT.hoof, 0.52, -0.1, 0.055, headG, { cast: false });
  add(new THREE.SphereGeometry(0.045, 8, 6), MAT.hoof, 0.52, -0.1, -0.055, headG, { cast: false });
  for (const ez of [-0.16, 0.16]) {
    add(new THREE.SphereGeometry(0.038, 8, 6), MAT.eye, 0.16, 0.07, ez, headG, { cast: false });
    const ear = add(new THREE.ConeGeometry(0.045, 0.2, 7), MAT.coat, -0.14, 0.26, ez * 0.72, headG);
    ear.rotation.z = 0.25; ear.rotation.x = ez > 0 ? -0.2 : 0.2; horseParts.ears.push(ear);
  }
  const tuft = add(tbox(0.2, 0.16, 0.06, 2), MAT.coatDk, -0.05, 0.24, 0, headG); tuft.rotation.z = 0.4;
  // bridle: band over the muzzle + cheek band (leather, no bit cruelty)
  const band1 = add(new THREE.TorusGeometry(0.135, 0.016, 6, 14), MAT.leather, 0.36, -0.06, 0, headG, { cast: false }); band1.rotation.y = Math.PI / 2;
  const band2 = add(new THREE.TorusGeometry(0.21, 0.015, 6, 14), MAT.leather, 0.02, 0.02, 0, headG, { cast: false }); band2.rotation.y = Math.PI / 2;
  // tail on its sway pivot
  const tailG = new THREE.Group(); tailG.position.set(-0.98, 1.34, 0); b.add(tailG); horseParts.tailG = tailG;
  const t1 = add(new THREE.CylinderGeometry(0.05, 0.035, 0.55, 7), MAT.coatDk, -0.08, -0.26, 0, tailG); t1.rotation.z = 0.28;
  const t2 = add(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 7), MAT.coatDk, -0.17, -0.62, 0, tailG); t2.rotation.z = 0.12;
  // saddle + blanket (the sale dressing; story toggles via saddleK)
  const saddleG = new THREE.Group(); b.add(saddleG); horseParts.saddleG = saddleG;
  add(tbox(0.88, 0.06, 0.94, 2), MAT.blanket, 0.02, 1.6, 0, saddleG, { cast: false });
  add(tbox(0.48, 0.09, 0.4, 2), MAT.leather, 0.02, 1.63, 0, saddleG, { cast: false });
  add(tbox(0.09, 0.09, 0.36, 2), MAT.leather, -0.235, 1.685, 0, saddleG, { cast: false });
  const stir = add(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5), MAT.leather, 0.05, 1.42, 0.3, saddleG, { cast: false });
  const stir2 = add(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5), MAT.leather, 0.05, 1.42, -0.3, saddleG, { cast: false });
  void stir; void stir2;
  // legs: hip pivot -> upper -> shin pivot -> shin + hoof
  const mkLeg = (lx, lz) => {
    const piv = new THREE.Group(); piv.position.set(lx, 0.98, lz); horseG.add(piv);
    add(new THREE.CylinderGeometry(0.088, 0.06, 0.52, 9), MAT.coat, 0, -0.26, 0, piv);
    const shinG = new THREE.Group(); shinG.position.set(0, -0.52, 0); piv.add(shinG);
    add(new THREE.CylinderGeometry(0.052, 0.038, 0.42, 8), MAT.coat, 0, -0.2, 0, shinG);
    add(tbox(0.17, 0.09, 0.13, 2), MAT.hoof, 0.03, -0.43, 0, shinG);
    return { piv, shinG };
  };
  horseParts.legs = [mkLeg(0.52, 0.26), mkLeg(0.52, -0.26), mkLeg(-0.52, 0.26), mkLeg(-0.52, -0.26)];
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.7), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, depthWrite: false, fog: true }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.02, 0); blob.userData.ndSkip = true; blob.renderOrder = 1; horseG.add(blob);
  horseParts.blob = blob;
}

// ---------- the loose rope (waved at the dealer in the dawn beat) -------
const ropeG = new THREE.Group(); world.add(ropeG);
{
  const coil = add(new THREE.TorusGeometry(0.15, 0.03, 7, 16), MAT.rope, 0, 0, 0, ropeG, { cast: false }); coil.rotation.x = 0.4;
  const hang = add(new THREE.TorusGeometry(0.3, 0.028, 7, 16, Math.PI * 0.9), MAT.rope, 0.02, -0.28, 0, ropeG, { cast: false }); hang.rotation.z = Math.PI * 1.05;
  add(new THREE.CylinderGeometry(0.026, 0.026, 0.34, 6), MAT.rope, 0.2, -0.62, 0, ropeG, { cast: false }).rotation.z = 0.15;
}

// ---------- the special treat: a bunch of carrots in the dealer's hand --
const treatG = new THREE.Group(); treatG.position.set(6.95, 0.98, 13.0); world.add(treatG);
{
  for (let i = 0; i < 3; i++) {
    const cg = new THREE.Group(); cg.position.set((i - 1) * 0.07, 0, (i % 2) * 0.05); cg.rotation.z = 0.5 + i * 0.18; treatG.add(cg);
    add(new THREE.ConeGeometry(0.045, 0.34, 8), MAT.carrot, 0, -0.14, 0, cg, { cast: false }).rotation.x = Math.PI;
    add(new THREE.SphereGeometry(0.05, 7, 6), MAT.carrotTop, 0, 0.06, 0, cg, { cast: false });
  }
}

// ---------- the seventh buyer's hand lantern (mesh; light is lampHand) --
const handLanternG = new THREE.Group(); world.add(handLanternG);
{
  add(box(0.13, 0.04, 0.13), MAT.ironDk, 0, 0.1, 0, handLanternG, { cast: false });
  add(box(0.11, 0.17, 0.11), MAT.lampGlass, 0, 0, 0, handLanternG, { cast: false });
  add(box(0.14, 0.03, 0.14), MAT.ironDk, 0, -0.1, 0, handLanternG, { cast: false });
  const gl = softGlow(1.1, '#ffc06a', 0.5); handLanternG.add(gl); lanternGlows.push(gl);
}

// ---------- FX: market dust motes + hoof dust + clouds ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 2.2, 4, { rate: 0.4, color: 0xffe2b8, opacity: 0.06, scale: 0.5, grow: 1.2, life: 3.2, vy: 0.05, wind: 0.05 });
const dustEmit = smoke.addEmitter(0, 0.3, 5, { rate: 0, color: 0xcbb59a, opacity: 0.3, scale: 0.8, grow: 1.8, life: 1.6, vy: 0.35, wind: 0.2 });
const sparkEmit = smoke.addEmitter(0, 1.8, -30, { rate: 0, color: 0xffd76a, opacity: 0.5, scale: 0.34, grow: 0.7, life: 1.1, vy: 0.7, wind: 0.1 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 52, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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
    dustEmit.rate = pr.blastRate * 3; dustEmit.x = Ws.blastX; dustEmit.y = Ws.blastY; dustEmit.z = Ws.blastZ;
    sparkEmit.rate = 0;
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

// ---------- word-by-word captions (the reference's signature) ----------
// Screen-space overlay rendered AFTER the dof pass: one word at a time,
// bold white with a thick black stroke, centred, baseline ~79% of frame
// height, timed from words.json (web/words.js). The word holds until the
// next word starts.
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
    capG.font = '900 74px Arial, Helvetica, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.boardHook ?? 0; boardHook.visible = (Ws.boardHook ?? 0) > 0.01;
  // practicals: brightest at source, warm pools; hand lantern rides along
  const flick = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  lampStable.intensity = 26 * (Ws.lampStable ?? 0) * flick;
  lampDealer.intensity = 26 * (Ws.lampDealer ?? 0) * (2 - flick) * 0.8;
  lampHand.intensity = 13 * (Ws.lampHand ?? 0) * flick;
  lampHand.position.set(Ws.lampHX ?? 0, Ws.lampHY ?? 1, Ws.lampHZ ?? 0);
  handLanternG.visible = (Ws.lampHand ?? 0) > 0.01;
  handLanternG.position.set(Ws.lampHX ?? 0, (Ws.lampHY ?? 1) - 0.28, Ws.lampHZ ?? 0);
  lanternGlows.forEach((gl, i) => { gl.material.opacity = 0.36 * (Ws.lampK ?? 0) * (0.9 + 0.1 * Math.sin(f * 0.3 + i * 2.1)); });
  // the loose door on its hinge
  doorG.rotation.y = (Ws.doorK || 0) * 1.9;
  // the waved rope + the treat
  ropeG.visible = (Ws.ropeK || 0) > 0.01;
  if (ropeG.visible) {
    ropeG.position.set(Ws.ropeX, Ws.ropeY + Math.sin(f * 0.32) * 0.05, Ws.ropeZ);
    ropeG.rotation.z = Math.sin(f * 0.32) * 0.16;
  }
  treatG.visible = (Ws.treatK || 0) > 0.01;
  treatG.children.forEach((cg) => { cg.visible = true; });
  // ---------- the horse ----------
  const Hh = horseAt(f);
  horseG.visible = Hh.k > 0.01;
  if (horseG.visible) {
    const Hp = horseAt(Math.max(0, f - 1));
    const speed = Math.min(1, Math.abs(Hh.phase - Hp.phase) / 0.55);
    horseG.position.set(Hh.x, 0, Hh.z);
    horseG.rotation.y = Hh.yaw - Math.PI / 2;
    // body: trot bob (2 beats per cycle) + idle breathing when standing
    horseBody.position.y = speed * 0.045 * Math.abs(Math.sin(Hh.phase)) + (1 - speed) * 0.008 * Math.sin(f * 0.045);
    horseBody.rotation.z = speed * 0.02 * Math.sin(Hh.phase);
    horseBody.rotation.x = speed * 0.015 * Math.sin(Hh.phase + 1.2);
    // legs: diagonal pairs (FL+RR / FR+RL); swing follows ground speed,
    // the shin folds as the leg swings through — feet stay planted in stance
    const offs = [0, Math.PI, Math.PI, 0];
    horseParts.legs.forEach((leg, i) => {
      const sw = Math.sin(Hh.phase + offs[i]);
      leg.piv.rotation.z = speed * 0.52 * sw;
      leg.shinG.rotation.z = -speed * 0.65 * Math.max(0, Math.sin(Hh.phase + offs[i] - 0.75));
    });
    // neck/head: headK 0 = proud, 1 = down at the grass / the treat
    horseParts.neckG.rotation.z = -Hh.headK * 0.92;
    horseParts.headG.rotation.z = Hh.headK * 0.35 + (1 - speed) * 0.03 * Math.sin(f * 0.06 + 2);
    horseParts.tailG.rotation.x = 0.16 * Math.sin(f * 0.055) + speed * 0.1 * Math.sin(Hh.phase * 0.5);
    horseParts.tailG.rotation.z = 0.08 * Math.sin(f * 0.021 + 1);
    horseParts.ears.forEach((ear, i) => { ear.rotation.z = 0.25 + 0.14 * Math.max(0, Math.sin(f * 0.11 + i * 2.7)) * (Math.sin(f * 0.013 + i * 1.9) > 0.92 ? 1 : 0.15); });
    horseParts.saddleG.visible = (Hh.saddleK || 0) > 0.5;
  }
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
