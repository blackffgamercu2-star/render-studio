// Kitebottle — "The Boy Who Heard the Wind Sing" (Ricks Clips style demo).
// three.js set + toon2.js canvas characters, measured Ricks grammar:
// camera glides + push-in creep, 6-7f impact kicks, reactions 0-3f BEFORE
// their word, characters animated on ones, 3-tone clouds, glinted glass,
// coloured shadows + contact blobs, planted feet, exact grips, speaking =
// mouth + head/body sway on the same beats. Everything is a pure function
// of the frame number (chunk-safe rendering). Scene changes ONLY at line
// boundaries. END RULE: performed dialogue = L4 (Kabir) + L8 (Dev) only,
// mid-film; the final line is narration over the hook board, mouths shut.
import * as THREE from './lib/three.module.js';
import { drawCharacter } from './toon2.js';
import { WORDS } from './words.js';
import { TIMING } from './timing.js';
import { SPEAK } from './speakdata.js';

export const FPS = 30;
export const TOTAL = TIMING.total_frames;
const PH = TIMING.phrases;
export const L = (n) => PH[n - 1];
// global word index ranges per line (words.js is script-verbatim, in order)
const lineWordIdx = (() => {
  const out = []; let gi = 0;
  for (const p of PH) { const n = p.text.split(/\s+/).filter(Boolean).length; out.push([gi, gi + n - 1]); gi += n; }
  return out;
})();
export const wordFrame = (line, wordIdx) => {
  const [a] = lineWordIdx[line - 1];
  const w = WORDS[a + wordIdx];
  return w ? Math.round(w.s * FPS) : L(line).f0;
};
export const findWordFrame = (line, word) => {
  const [a, b] = lineWordIdx[line - 1];
  for (let i = a; i <= b; i++) if (WORDS[i] && WORDS[i].w.toLowerCase().replace(/[^a-z]/g, '') === word) return Math.round(WORDS[i].s * FPS);
  return L(line).f0;
};

// ---------- tiny math helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
const ramp = (f, a, b) => sstep((f - a) / Math.max(1, b - a));
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- renderer / scene (the approved storyboard look) ----------
const INK = 0x2b1a26;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1080, 1920); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd7e7f8, 26, 60);
const camera = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.1, 120);

const hemi = new THREE.HemisphereLight(0xbcd6ff, 0xb49a78, 1.05); scene.add(hemi);
scene.add(new THREE.AmbientLight(0xffe8c8, 0.25));
const sun = new THREE.DirectionalLight(0xfff3e0, 2.3);
sun.position.set(7.5, 8.5, 3.0); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -6, near: 1, far: 30 });
sun.shadow.bias = -0.0005;
scene.add(sun);

function ctex(w, h, fn, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// sky + sun glow
const skyTex = ctex(64, 1024, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2e7cd6'); gr.addColorStop(0.55, '#79aee8'); gr.addColorStop(1, '#d7e7f8');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const sky = new THREE.Mesh(new THREE.PlaneGeometry(80, 42), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
sky.position.set(0, 9, -16); scene.add(sky);
const glowTex = ctex(256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,246,214,0.9)'); gr.addColorStop(0.4, 'rgba(255,240,200,0.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
}, false);
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false }));
glow.position.set(4.5, 7.5, -12); glow.scale.set(9, 9, 1); scene.add(glow);

// clouds: 3 tones, lavender underside, flat bottom, NO outline
const CLOUD_DAY = { lit: '#fbf8f1', mid: '#e1e5f3', shade: '#c3cbe9' };
function cloudTex(seed) {
  return ctex(1024, 512, (g) => {
    const r = mulberry(seed * 7919 + 17), W = 1024, base = 400;
    const U = (a, b) => a + r() * (b - a);
    const n = 6 + Math.floor(r() * 4), lobes = [];
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, rad = (60 + 110 * Math.pow(Math.sin(Math.PI * t), 0.8)) * U(0.75, 1.15); lobes.push({ x: 150 + t * 724 + U(-30, 30), y: base - rad * U(0.35, 0.65), r: rad }); }
    for (let i = 0; i < Math.floor(n / 2); i++) { const t = U(0.25, 0.75), rad = U(60, 110); lobes.push({ x: 150 + t * 724, y: base - 150 - rad * U(0.3, 0.7), r: rad }); }
    const layer = (dx, dy, k, col, blur) => { g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = col; g.beginPath(); for (const l of lobes) { const x = l.x + dx * l.r, y = l.y + dy * l.r; g.moveTo(x + l.r * k, y); g.arc(x, y, l.r * k, 0, Math.PI * 2); } g.fill(); g.restore(); };
    layer(0, 0, 1.0, CLOUD_DAY.shade, 6);
    layer(-0.04, -0.12, 0.9, CLOUD_DAY.mid, 8);
    layer(-0.1, -0.26, 0.72, CLOUD_DAY.lit, 10);
    g.globalCompositeOperation = 'destination-in';
    const m = g.createLinearGradient(0, base - 18, 0, base + 6);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, W, 512); g.globalCompositeOperation = 'source-over';
  });
}
const clouds = [];
function addCloud(seed, x, y, z, w, op = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex(seed), transparent: true, depthWrite: false, opacity: op, fog: false }));
  s.position.set(x, y, z); s.scale.set(w, w / 2, 1); s.userData.x0 = x; scene.add(s); clouds.push(s); return s;
}
addCloud(3, 1.6, 6.9, -10, 6.6);
addCloud(8, -3.1, 7.2, -10.5, 4.8);
addCloud(5, 0.2, 7.9, -11, 3.2, 0.92);
addCloud(11, 4.4, 7.6, -11.5, 4.2, 0.9);

// ground + path
const grassTex = ctex(1024, 1024, (g, w, h) => {
  const r = mulberry(42);
  g.fillStyle = '#77b058'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = ['#69a34c', '#86c168', '#5d9844', '#7fb85e'][i % 4]; g.lineWidth = 2.4;
    const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 7, y - 6 - r() * 9); g.stroke();
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(190,170,90,0.07)'; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 90, 24 + r() * 50, r() * 3, 0, Math.PI * 2); g.fill(); }
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(5, 3);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(48, 32), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 2); ground.receiveShadow = true; scene.add(ground);
const pathTex = ctex(512, 512, (g, w, h) => {
  const r = mulberry(9);
  g.fillStyle = '#cbb27f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { g.fillStyle = ['#bda26e', '#dbc491', '#c2a878'][i % 3]; g.fillRect(r() * w, r() * h, 3.4, 2.2); }
});
const pathM = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 7), new THREE.MeshStandardMaterial({ map: pathTex, roughness: 1 }));
pathM.rotation.x = -Math.PI / 2; pathM.rotation.z = 0.05; pathM.position.set(0.05, 0.012, 1.7); pathM.receiveShadow = true; scene.add(pathM);

// contact blob (coloured shadow — blue-violet, never black)
const blobTex = ctex(256, 128, (g) => {
  const gr = g.createRadialGradient(128, 64, 6, 128, 64, 120);
  gr.addColorStop(0, 'rgba(43,40,96,0.52)'); gr.addColorStop(0.65, 'rgba(43,40,96,0.28)'); gr.addColorStop(1, 'rgba(43,40,96,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
}, false);
function makeBlob(w, d, op) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: op }));
  m.rotation.x = -Math.PI / 2; scene.add(m); return m;
}

// house (from the approved storyboard)
const plasterTex = ctex(1024, 512, (g, w, h) => {
  const r = mulberry(4);
  g.fillStyle = '#f2dfba'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(190,150,90,${0.015 + r() * 0.03})`; g.fillRect(r() * w, r() * h, 12 + r() * 26, 2 + r() * 4); }
  g.fillStyle = 'rgba(120,90,60,0.13)'; g.fillRect(0, h - 46, w, 46);
});
const roofTex = ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#c65b3f'; g.fillRect(0, 0, w, h);
  for (let y = 26; y < h; y += 52) for (let x = 0; x < w; x += 46) {
    g.strokeStyle = 'rgba(120,40,25,0.4)'; g.lineWidth = 5;
    g.beginPath(); g.arc(x + ((y / 52) % 2) * 23, y, 23, 0.15, Math.PI - 0.15); g.stroke();
    g.strokeStyle = 'rgba(255,200,150,0.16)'; g.lineWidth = 3;
    g.beginPath(); g.arc(x + ((y / 52) % 2) * 23, y - 5, 23, 0.15, Math.PI - 0.15); g.stroke();
  }
});
function inkEdges(mesh, op = 0.5) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 24), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: op }));
  mesh.add(e); return mesh;
}
const house = new THREE.Group(); scene.add(house);
const wall = inkEdges(new THREE.Mesh(new THREE.BoxGeometry(11.5, 3.6, 0.4), new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95 })), 0.45);
wall.position.set(-1.0, 1.8, -4.6); wall.castShadow = true; wall.receiveShadow = true; house.add(wall);
const roofTexSloped = roofTex.clone(); roofTexSloped.wrapS = roofTexSloped.wrapT = THREE.RepeatWrapping; roofTexSloped.repeat.set(3, 1); roofTexSloped.needsUpdate = true;
const slopeLen = Math.hypot(6.2, 1.1), slopeAng = Math.atan2(1.1, 6.2);
for (const s of [-1, 1]) {
  const panel = inkEdges(new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.25, 0.09, 1.7), new THREE.MeshStandardMaterial({ map: roofTexSloped, roughness: 1 })), 0.5);
  panel.position.set(-1 + s * 3.1, 4.15, -4.6); panel.rotation.z = -s * slopeAng; panel.castShadow = true; house.add(panel);
}
const gableShape = new THREE.Shape(); gableShape.moveTo(-6.2, 0); gableShape.lineTo(6.2, 0); gableShape.lineTo(0, 1.1); gableShape.closePath();
for (const gz of [-3.84, -5.36]) {
  const gable = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95, side: THREE.DoubleSide }));
  gable.position.set(-1.0, 3.6, gz); house.add(gable);
}
function glassTexture(flip) {
  return ctex(512, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#8d9cdb'); gr.addColorStop(1, '#5761a8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const p = g.createRadialGradient(120, 130, 10, 120, 130, 190);
    p.addColorStop(0, 'rgba(169,194,210,0.42)'); p.addColorStop(1, 'rgba(169,194,210,0)');
    g.fillStyle = p; g.fillRect(0, 0, w, h);
    g.save(); if (flip) { g.translate(w, 0); g.scale(-1, 1); }
    g.fillStyle = 'rgba(232,183,195,0.88)'; g.fillRect(w * 0.68, 0, w * 0.32, h);
    g.fillStyle = 'rgba(190,130,150,0.45)';
    for (let x = w * 0.72; x < w; x += 26) g.fillRect(x, 0, 7, h);
    g.restore();
    const glint = (x, y, len, wid) => {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
      const lg = g.createLinearGradient(-len / 2, 0, len / 2, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(-len / 2, -wid / 2, len, wid); g.restore();
    };
    glint(150, 190, 330, 34); glint(310, 360, 185, 24);
  });
}
function addWindow(x, y, w, h, flip) {
  const grp = new THREE.Group(); grp.position.set(x, y, -4.36);
  const frame = inkEdges(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.12), new THREE.MeshStandardMaterial({ color: 0xfbf8f1, roughness: 0.8 })), 0.55);
  grp.add(frame);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glassTexture(flip) }));
  glass.position.z = 0.075; grp.add(glass);
  const mullMat = new THREE.MeshStandardMaterial({ color: 0xfbf8f1, roughness: 0.8 });
  const mv = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.03), mullMat); mv.position.z = 0.09; grp.add(mv);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.03), mullMat); mh.position.z = 0.09; grp.add(mh);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.44, 0.1, 0.22), mullMat); sill.position.set(0, -h / 2 - 0.18, 0.03); grp.add(sill);
  house.add(grp); return grp;
}
addWindow(-1.95, 2.75, 1.35, 1.6, false);
addWindow(1.95, 3.05, 1.05, 1.3, true);
const found = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.35, 0.55), new THREE.MeshStandardMaterial({ color: 0xd9c096, roughness: 1 }));
found.position.set(-1.0, 0.17, -4.55); house.add(found);
const houseBlob = makeBlob(9.5, 0.85, 0.5); houseBlob.position.set(-1.0, 0.02, -4.05);
for (const [x, y, z, r] of [[-2.7, 0.42, -4.0, 0.62], [3.0, 0.36, -4.0, 0.55], [-3.6, 0.3, -3.5, 0.45]]) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), new THREE.MeshStandardMaterial({ color: 0x4f9e4d, roughness: 1 }));
  b.scale.y = 0.75; b.position.set(x, y, z); b.castShadow = true; scene.add(b);
}
const tuftTex = ctex(128, 128, (g) => {
  const r = mulberry(3); g.strokeStyle = '#4e8f3e'; g.lineCap = 'round';
  for (let i = 0; i < 16; i++) { g.lineWidth = 4 + r() * 3; const x = 14 + r() * 100; g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + (r() - 0.5) * 22, 70, x + (r() - 0.5) * 44, 18 + r() * 40); g.stroke(); }
});
const tufts = [];
for (const [x, z, s] of [[-2.0, 2.7, 0.55], [2.4, 3.0, 0.62], [-2.7, 1.6, 0.45], [3.1, 1.3, 0.4], [1.9, 3.6, 0.5], [-3.4, 3.2, 0.5], [4.2, 2.2, 0.45]]) {
  const t = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.8), new THREE.MeshBasicMaterial({ map: tuftTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  t.position.set(x, s * 0.36, z); t.userData.ph = x * 1.7 + z; scene.add(t); tufts.push(t);
}

// ---------- the pond (Kabir's kite lands here) ----------
// Style rule: water = sky colour + warm light blobs, NO mirrored reflections.
const POND = new THREE.Vector3(1.55, 0, 3.9);
const pondTex = ctex(512, 512, (g, w, h) => {
  const r = mulberry(21);
  g.fillStyle = '#7fb2d9'; g.fillRect(0, 0, w, h);
  const vg = g.createRadialGradient(256, 256, 60, 256, 256, 300);
  vg.addColorStop(0, 'rgba(255,255,255,0.10)'); vg.addColorStop(1, 'rgba(30,60,110,0.25)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { // warm light blobs
    const x = 90 + r() * 330, y = 90 + r() * 330, rad = 22 + r() * 46;
    const b = g.createRadialGradient(x, y, 2, x, y, rad);
    b.addColorStop(0, 'rgba(255,233,176,0.5)'); b.addColorStop(1, 'rgba(255,233,176,0)');
    g.fillStyle = b; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(80 + r() * 350, 80 + r() * 350, 20 + r() * 40, 6 + r() * 9, r() * 3, 0, Math.PI * 2); g.stroke(); }
});
const pond = new THREE.Mesh(new THREE.CircleGeometry(1.65, 36), new THREE.MeshStandardMaterial({ map: pondTex, roughness: 0.6 }));
pond.rotation.x = -Math.PI / 2; pond.position.set(POND.x, 0.025, POND.z); pond.receiveShadow = true; scene.add(pond);
const pondRim = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 36), new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 1 }));
pondRim.rotation.x = -Math.PI / 2; pondRim.position.set(POND.x, 0.018, POND.z); pondRim.receiveShadow = true; scene.add(pondRim);
// ripple rings (pure function of frame)
const rippleTex = ctex(128, 128, (g) => {
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 7;
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
}, false);
const ripples = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rippleTex, transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(POND.x, 0.045, POND.z); scene.add(m); ripples.push(m);
}
// splash droplets
const dropTex = ctex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(190,220,245,0.7)'); gr.addColorStop(1, 'rgba(190,220,245,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
}, false);
const drops = [];
for (let i = 0; i < 12; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTex, transparent: true, opacity: 0, depthWrite: false }));
  s.scale.set(0.16, 0.16, 1); scene.add(s); drops.push(s);
}

// ---------- contest flag ----------
const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }));
flagPole.position.set(-2.9, 1.7, 1.8); flagPole.castShadow = true; scene.add(flagPole);
const flagTex = ctex(256, 160, (g, w, h) => {
  const n = 4, s = w / (n * 2);
  for (let y = 0; y < n; y++) for (let x = 0; x < n * 2; x++) { g.fillStyle = (x + y) % 2 ? '#20242c' : '#f4f1e6'; g.fillRect(x * s, y * s, s, s); }
  g.strokeStyle = '#2b1a26'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
});
const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.6, 8, 3), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
flag.geometry.translate(0.475, 0, 0);
flag.position.set(-2.9, 3.15, 1.8); scene.add(flag);
const flagBase = flag.geometry.attributes.position.array.slice();

// ---------- glass bottles (painted glass recipe, two 45° glints) ----------
function makeBottle(scale = 1) {
  const grp = new THREE.Group();
  const pts = [];
  const prof = [[0.0, -0.31], [0.12, -0.31], [0.145, -0.25], [0.15, -0.04], [0.14, 0.05], [0.085, 0.14], [0.052, 0.19], [0.05, 0.28], [0.065, 0.30], [0.065, 0.33], [0.0, 0.33]];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 28);
  const bottleTex = ctex(256, 256, (g, w, h) => {
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, '#96a5dd'); vg.addColorStop(0.55, '#7b7ea0'); vg.addColorStop(1, '#5d66a8');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    const hg = g.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(40,40,90,0.22)'); hg.addColorStop(0.3, 'rgba(40,40,90,0)');
    hg.addColorStop(0.72, 'rgba(255,255,255,0.10)'); hg.addColorStop(1, 'rgba(40,40,90,0.22)');
    g.fillStyle = hg; g.fillRect(0, 0, w, h);
  });
  grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: bottleTex })));
  const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  hull.scale.set(1.05, 1.02, 1.05); grp.add(hull);
  const streakTex = ctex(64, 256, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  }, false);
  const glint = (x, y, z, len, op) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.035, len), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    p.position.set(x, y, z); p.rotation.z = Math.PI / 4; grp.add(p); return p;
  };
  grp.userData.glints = [glint(0.045, 0.03, 0.168, 0.30, 0.55), glint(-0.05, -0.16, 0.158, 0.17, 0.45)];
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.3, depthWrite: false, color: 0xa9c2d2 }));
  patch.position.set(-0.06, 0.06, 0.163); grp.add(patch);
  grp.scale.setScalar(scale);
  scene.add(grp);
  return grp;
}
const handBottle = makeBottle(1.0);
const skyBottle = makeBottle(1.15);

// ---------- kites + strings ----------
function makeKite(color, cross) {
  const grp = new THREE.Group();
  const kiteTex = ctex(256, 320, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.beginPath(); g.moveTo(w / 2, 6); g.lineTo(w - 8, h * 0.42); g.lineTo(w / 2, h - 6); g.lineTo(8, h * 0.42); g.closePath();
    g.fillStyle = color; g.fill(); g.lineWidth = 10; g.strokeStyle = '#2b1a26'; g.stroke();
    g.strokeStyle = cross; g.lineWidth = 12;
    g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.moveTo(12, h * 0.42); g.lineTo(w - 12, h * 0.42); g.stroke();
  });
  const k = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.84), new THREE.MeshBasicMaterial({ map: kiteTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, fog: false }));
  grp.add(k);
  const bowTex = ctex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.fillStyle = '#f2c14e';
    g.beginPath(); g.moveTo(32, 32); g.lineTo(4, 10); g.lineTo(4, 54); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(32, 32); g.lineTo(60, 10); g.lineTo(60, 54); g.closePath(); g.fill();
  });
  grp.userData.bows = [];
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: bowTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, fog: false }));
    grp.add(b); grp.userData.bows.push(b);
  }
  scene.add(grp);
  return grp;
}
const devKite = makeKite('#e4572e', 'rgba(255,255,255,0.85)');
const kabKite = makeKite('#3f9e4d', 'rgba(255,246,200,0.9)');
function makeString(n = 5) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3a2b33, transparent: true, opacity: 0.85 }));
  line.frustumCulled = false; scene.add(line); return line;
}
const devString = makeString(5), kabString = makeString(4);
function setString(line, pts) {
  const a = line.geometry.attributes.position;
  for (let i = 0; i < pts.length; i++) a.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
  a.needsUpdate = true;
}
// music notes (the bottle's song) — flat 2D sprites, style-true FX
const noteTex = ctex(128, 128, (g) => {
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#fff6da'; g.strokeStyle = '#2b1a26'; g.lineWidth = 5;
  g.beginPath(); g.ellipse(42, 96, 20, 14, -0.4, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(60, 90); g.lineTo(60, 26); g.lineWidth = 7; g.stroke();
  g.beginPath(); g.moveTo(60, 26); g.quadraticCurveTo(92, 34, 88, 62); g.quadraticCurveTo(80, 44, 60, 44); g.closePath();
  g.fillStyle = '#fff6da'; g.fill(); g.stroke();
});
const notes = [];
for (let i = 0; i < 18; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(s); notes.push(s);
}
// wind streaks
const streakTexW = ctex(256, 32, (g, w, h) => {
  const lg = g.createLinearGradient(0, 0, w, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.75)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
}, false);
const streaks = [];
for (let i = 0; i < 6; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: streakTexW, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  s.scale.set(1.6, 0.09, 1); scene.add(s); streaks.push(s);
}
// gold glint burst (the win)
const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, fog: false, color: 0xffd76a }));
star.scale.set(1.6, 1.6, 1); scene.add(star);

// ---------- the hook board (END RULE: narration only over this) ----------
export const BOARD_POS = [0.15, -3.2];
const boardGroup = new THREE.Group(); scene.add(boardGroup);
{
  const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.3, 0.09), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }));
  post1.position.set(-1.32, 1.35, 0); boardGroup.add(post1);
  const post2 = post1.clone(); post2.position.x = 1.32; boardGroup.add(post2);
  const boardTex = ctex(1024, 470, (g, w, h) => {
    g.fillStyle = '#2a1a0c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffe9a8'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
    g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = "900 92px Arial, sans-serif";
    g.fillText('But tomorrow…', w / 2, h * 0.24);
    g.font = "900 74px Arial, sans-serif";
    g.fillText('the boy who tied a bell', w / 2, h * 0.55);
    g.fillText('to a cloud?', w / 2, h * 0.82);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.38), new THREE.MeshBasicMaterial({ map: boardTex, transparent: true, fog: true }));
  board.position.set(0, 2.45, 0.06); board.name = 'hookBoard'; boardGroup.add(board);
  boardGroup.userData.board = board;
  boardGroup.position.set(BOARD_POS[0], 0, BOARD_POS[1]);
}

// ---------- character cards (toon2 painter, redrawn on pose change) ----------
const CARD_H = 2.72, CARD_W = CARD_H * 760 / 1200;
class CharCard {
  constructor() {
    this.cv = document.createElement('canvas');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: false, alphaTest: 0.35 }));
    this.mesh.position.y = 1.33;
    scene.add(this.mesh);
    this.blob = makeBlob(1.25, 0.46, 0.85);
    this.key = ''; this.anchors = { grip: null, spool: null };
  }
  setPose(opts) {
    const key = JSON.stringify(opts);
    if (key === this.key) return;
    this.key = key;
    const d = drawCharacter(opts);
    // downscale 1520x2400 -> 1140x1800 (texture memory), same look at our sizes
    this.cv.width = 1140; this.cv.height = 1800;
    const g = this.cv.getContext('2d');
    g.clearRect(0, 0, 1140, 1800);
    g.drawImage(d.canvas, 0, 0, 1140, 1800);
    this.tex.needsUpdate = true;
    this.anchors = { grip: d.grip, spool: d.spool };
  }
  anchorWorld(which) {
    const u = this.anchors[which]; if (!u) return null;
    const p = this.mesh.position;
    return new THREE.Vector3(p.x + (u[0] - 380) / 760 * CARD_W, p.y + (600 - u[1]) / 1200 * CARD_H, p.z + 0.02);
  }
  mouthWorld() {
    const p = this.mesh.position;
    return new THREE.Vector3(p.x + 0.02, p.y + (600 - 280) / 1200 * CARD_H, p.z + 0.05);
  }
  setPos(x, z, scale = 1, flip = 1) {
    this.mesh.position.x = x; this.mesh.position.z = z;
    this.mesh.scale.set(scale * flip, scale, 1);
    this.blob.position.set(x - 0.11 * flip, 0.021, z + 0.17);
    this.blob.scale.set(scale, scale, 1);
  }
}
const hero = new CharCard(), kabir = new CharCard(), kid1 = new CharCard(), kid2 = new CharCard();

const HERO_BASE = { skin: '#ffdfba', skinShade: 'rgba(216,164,120,0.55)', shirt: '#e8862e', belt: '#3a2a20', hair: '#4a2e20', hairStyle: 'sweep', faceDir: 1, seed: 11 };
const KAB_BASE = { skin: '#fef9f6', skinShade: 'rgba(190,196,235,0.55)', shirt: '#6a4fa3', belt: '#2c1e3a', hair: '#241722', hairStyle: 'tuft', faceDir: -1, seed: 23 };
const KID1_BASE = { skin: '#f2c894', skinShade: 'rgba(200,150,100,0.5)', shirt: '#2e8f86', belt: '#33302c', hair: '#2c1a10', hairStyle: 'tuft', faceDir: -1, seed: 31 };
const KID2_BASE = { skin: '#ffe3c2', skinShade: 'rgba(216,164,120,0.5)', shirt: '#c23b4e', belt: '#33302c', hair: '#59331c', hairStyle: 'sweep', faceDir: 1, seed: 47 };

// blink schedule (deterministic, per character)
function blinkFrames(seed, total) {
  const set = new Set(); let f = 20 + Math.floor(hash(seed) * 40);
  while (f < total - 10) { set.add(f); set.add(f + 1); f += 55 + Math.floor(hash(f * 0.37 + seed) * 75); }
  return set;
}
const BLINKS = { hero: blinkFrames(3, TOTAL), kabir: blinkFrames(7, TOTAL), kid1: blinkFrames(13, TOTAL), kid2: blinkFrames(17, TOTAL) };
const eyesFor = (who, eyes, f) => (BLINKS[who].has(f) && (eyes === 'deadpan' || eyes === 'half')) ? 'blink' : eyes;

// ---------- frame anchors (reactions land 0-3f BEFORE their word) ----------
const F = {
  humStart: findWordFrame(6, 'hum') - 3,
  drum: findWordFrame(4, 'drum'),
  earcup: wordFrame(7, 1) - 2,
  truth: findWordFrame(15, 'truth'),
  pond: findWordFrame(17, 'pond'),
  won: findWordFrame(16, 'won'),
  died: findWordFrame(10, 'died'),
  highBlow: findWordFrame(12, 'high'),
};
export const ANCHORS = F;
window.__anchors = F;

// ---------- shots (boundaries ONLY at line starts) ----------
const SHOTS = [
  { id: 'wide', a: 1, b: 1 }, { id: 'tie', a: 2, b: 3 }, { id: 'kabirCU', a: 4, b: 4 },
  { id: 'climb', a: 5, b: 6 }, { id: 'earcup', a: 7, b: 7 }, { id: 'devCU', a: 8, b: 8 },
  { id: 'sky', a: 9, b: 10 }, { id: 'analogy', a: 11, b: 13 }, { id: 'boast', a: 14, b: 15 },
  { id: 'contest', a: 16, b: 17 }, { id: 'board', a: 18, b: 18 },
];
for (const s of SHOTS) { s.f0 = L(s.a).f0; s.f1 = L(s.b).f1; }
export const shotAt = (f) => SHOTS.find((s) => f >= s.f0 && f <= s.f1) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);

// ---------- camera: keys + smootherstep glides + push-in creep + kicks ----------
const K = (f, pos, look, fov) => ({ f, pos, look, fov });
const CAMKEYS = {
  wide: (s) => [K(s.f0, [0.15, 2.4, 10.8], [-0.1, 1.95, 0], 36), K(s.f1, [0.02, 2.32, 10.15], [-0.1, 1.95, 0], 36)],
  tie: (s) => [K(s.f0, [-0.3, 2.0, 5.6], [-0.5, 1.8, 0], 34), K(s.f1, [-0.38, 1.94, 5.05], [-0.5, 1.78, 0], 34)],
  kabirCU: (s) => [K(s.f0, [0.68, 2.04, 4.05], [0.62, 2.04, 0.55], 33), K(s.f1, [0.65, 2.02, 3.75], [0.62, 2.02, 0.55], 33)],
  climb: (s) => [K(s.f0, [-0.15, 2.25, 7.8], [-0.5, 2.1, 0], 35), K(L(6).f0, [-0.2, 2.3, 7.5], [-0.8, 2.9, -1.5], 35), K(s.f1, [-0.22, 2.35, 7.3], [-1.0, 3.6, -3], 35)],
  earcup: (s) => [K(s.f0, [0.7, 2.06, 4.15], [0.62, 2.04, 0.55], 33), K(s.f1, [0.67, 2.04, 3.85], [0.62, 2.02, 0.55], 33)],
  devCU: (s) => [K(s.f0, [-0.48, 2.04, 3.95], [-0.55, 2.02, 0], 33), K(s.f1, [-0.5, 2.02, 3.65], [-0.55, 2.01, 0], 33)],
  sky: (s) => [K(s.f0, [-0.3, 1.45, 9.2], [-1.2, 4.8, -6], 38), K(L(10).f0, [-0.1, 1.45, 9.2], [-0.2, 4.6, -6], 38), K(s.f1, [0.1, 1.5, 9.2], [0.9, 4.3, -6], 38)],
  analogy: (s) => [K(s.f0, [-0.28, 2.02, 5.7], [-0.5, 1.86, 0], 34), K(L(12).f0, [-0.44, 1.99, 4.3], [-0.53, 1.96, 0], 33), K(L(13).f0, [-0.4, 2.0, 4.6], [-0.5, 2.0, 0], 34), K(s.f1, [-0.24, 2.08, 5.9], [-0.42, 2.05, 0], 34)],
  boast: (s) => [K(s.f0, [0.42, 2.02, 5.3], [0.42, 1.92, 0.4], 34), K(s.f1, [0.48, 2.0, 4.85], [0.44, 1.94, 0.4], 34)],
  contest: (s) => [K(s.f0, [0.2, 2.55, 11.6], [0, 2.25, 0], 37), K(L(17).f0, [0.35, 2.45, 11.9], [0.45, 1.6, 1.2], 37), K(s.f1, [0.45, 2.35, 11.4], [0.55, 1.5, 1.4], 37)],
  board: (s) => [K(s.f0, [0.15, 2.1, 10.2], [0.15, 2.0, -3.2], 34), K(s.f1, [0.15, 2.05, 9.8], [0.15, 2.0, -3.2], 34)],
};
const KICKS = [
  { f: F.drum, amp: 0.5 }, { f: F.humStart, amp: 0.35 }, { f: F.won, amp: 0.6 }, { f: F.pond, amp: 1.0 },
];
function kickAt(f) {
  let dy = 0, roll = 0;
  for (const k of KICKS) {
    const d = f - k.f;
    if (d >= 0 && d <= 6) { const s = (d % 2 ? -1 : 1) * (1 - d / 7); dy += s * 0.028 * k.amp; roll += s * 0.0035 * k.amp; }
  }
  return { dy, roll };
}
export function camAt(f) {
  const s = shotAt(f), keys = CAMKEYS[s.id](s);
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 1; i < keys.length; i++) { if (f <= keys[i].f) { a = keys[i - 1]; b = keys[i]; break; } if (i === keys.length - 1) { a = b = keys[i]; } }
  if (f <= a.f) { a = b = keys[0]; }
  const u = a === b ? 0 : sstep((f - a.f) / Math.max(1, b.f - a.f));
  const pos = a.pos.map((v, i) => lerp(v, b.pos[i], u));
  const look = a.look.map((v, i) => lerp(v, b.look[i], u));
  const fov = lerp(a.fov, b.fov, u);
  // push-in creep under every hold: ~0.12%/f toward the look point
  const creep = Math.pow(1 - 0.0012, Math.max(0, f - s.f0));
  for (let i = 0; i < 3; i++) pos[i] = look[i] + (pos[i] - look[i]) * creep;
  const kick = kickAt(f);
  pos[1] += kick.dy;
  return { pos, look, fov, roll: kick.roll, shot: s.id };
}

// ---------- wind + hum envelopes (pure functions of f) ----------
export function windK(f) {
  let w = 0.3 + 0.12 * Math.sin(f * 0.011) + 0.08 * Math.sin(f * 0.0043 + 2);
  if (f >= L(9).f0 && f < L(11).f0) w += 0.25 * ramp(f, L(9).f0, L(9).f1);
  if (f >= L(16).f0) w += 0.45 * ramp(f, L(16).f0, L(16).f0 + 40);
  return clamp(w, 0.08, 1);
}
export function humK(f) {
  if (f < F.humStart) return 0;
  if (f < L(7).f0) return 0.4 * ramp(f, F.humStart, L(6).f1);
  if (f < L(9).f0) return 0.4;
  if (f < L(10).f0) return lerp(0.4, 1.0, ramp(f, L(9).f0, L(9).f1));
  if (f < L(11).f0) return f < F.died - 40 ? 1.0 : lerp(1.0, 0, ramp(f, F.died - 40, F.died + 10));
  if (f < L(12).f0) return 0;
  if (f < L(13).f0) return f < F.highBlow ? 0.35 : 0.75;
  if (f < L(14).f0) return 0.8;
  if (f < L(16).f0) return 0.3;
  if (f < L(17).f0) return f < F.won - 30 ? 0.55 : 1.0;
  if (f < L(18).f0) return f < F.pond + 40 ? 0.7 : 0.5;
  return lerp(0.5, 0, ramp(f, L(18).f0, L(18).f0 + 20));
}
export function pitchK(f) {
  if (f < L(9).f0) return 0.25;
  if (f < L(10).f0) return lerp(0.25, 1.0, ramp(f, L(9).f0, L(9).f1));
  if (f < L(11).f0) return lerp(1.0, 0.1, ramp(f, L(10).f0, F.died + 10));
  if (f < L(13).f0) return f < F.highBlow ? 0.2 : 0.85;
  if (f < L(16).f0) return 0.7;
  return 0.95;
}
const inSeg = (who, f) => SPEAK.segs.find((s) => s.who === who && f >= s.f0 && f <= s.f1);
const mouthFor = (f, closed) => {
  const e = SPEAK.env[f] || 0;
  return e < 0.12 ? closed : e < 0.38 ? 'small' : e < 0.68 ? 'openO' : 'teeth';
};
const q05 = (v) => Math.round(v * 2) / 2;

// ---------- pose resolvers ----------
function heroPose(f) {
  const s = shotAt(f).id, seg = inSeg('dev', f);
  const base = { ...HERO_BASE };
  if (s === 'kabirCU' || s === 'earcup') return null;
  if (s === 'wide') return { o: { ...base, lean: 2, headTilt: 4, faceShift: 0.06, eyes: eyesFor('hero', 'deadpan', f), brows: 'skeptic', mouth: 'dash', armR: 'grip', armL: 'spool' }, x: -0.55, z: 0, sc: 1 };
  if (s === 'tie') return { o: { ...base, lean: 6, headTilt: 7, faceShift: 0.04, eyes: eyesFor('hero', 'deadpan', f), brows: 'calm', mouth: 'dash', armR: 'grip', armL: 'tieL' }, x: -0.55, z: 0, sc: 1 };
  if (s === 'climb') {
    const up = f >= L(6).f0;
    return { o: { ...base, lean: 3, headTilt: up ? -5 : -2, faceShift: 0.03, eyes: eyesFor('hero', 'deadpan', f), brows: up ? 'calm' : 'raised', mouth: up ? 'dash' : 'teeth', mouthScale: 0.75, armR: 'gesture2', armL: 'spool' }, x: -0.55, z: 0, sc: 1 };
  }
  if (s === 'devCU') {
    if (seg) return { o: { ...base, lean: q05(3 + Math.sin(f * 0.33) * 0.8 + (SPEAK.env[f] || 0) * 1.2), headTilt: q05(2 + Math.sin(f * 0.21) * 1.2), faceShift: 0.05, eyes: 'deadpan', brows: 'calm', mouth: mouthFor(f, 'dash'), mouthScale: 0.85, armR: 'gesture1', armL: 'downL' }, x: -0.55, z: 0, sc: 1, speak: true };
    return { o: { ...base, lean: 2, headTilt: 3, faceShift: 0.05, eyes: eyesFor('hero', 'deadpan', f), brows: 'calm', mouth: 'teeth', mouthScale: 0.7, armR: 'gesture1', armL: 'downL' }, x: -0.55, z: 0, sc: 1 };
  }
  if (s === 'sky') return { o: { ...base, lean: 2, headTilt: -6, faceShift: 0.03, eyes: 'deadpan', brows: 'calm', mouth: 'dash', armR: 'gesture2', armL: 'spool' }, x: -0.55, z: 0.3, sc: 1 };
  if (s === 'analogy') {
    if (f < L(13).f0) return { o: { ...base, lean: 4, headTilt: 3, faceShift: 0.05, eyes: eyesFor('hero', 'deadpan', f), brows: 'calm', mouth: 'pursed', mouthScale: f >= F.highBlow ? 1.25 : 1.0, armR: 'grip', armL: 'downL' }, x: -0.55, z: 0, sc: 1, blow: true };
    return { o: { ...base, lean: 2, headTilt: -3, faceShift: 0.04, eyes: eyesFor('hero', 'deadpan', f), brows: 'raised', mouth: 'dash', armR: 'gesture2', armL: 'spool' }, x: -0.55, z: 0, sc: 1 };
  }
  if (s === 'boast') return { o: { ...base, lean: 2, headTilt: 3, faceShift: 0.05, eyes: 'deadpan', brows: 'skeptic', mouth: 'dash', armR: 'grip', armL: 'spool' }, x: -1.55, z: 0.95, sc: 0.92 };
  if (s === 'contest') {
    const won = f >= F.won - 2;
    return { o: { ...base, lean: 3, headTilt: -3, faceShift: 0.04, eyes: won ? 'happy' : eyesFor('hero', 'deadpan', f), brows: 'raised', mouth: won ? 'teeth' : 'dash', mouthScale: 0.85, armR: 'gesture2', armL: 'spool' }, x: -0.7, z: 0.2, sc: 1 };
  }
  return { o: { ...base, lean: 1, headTilt: 2, faceShift: 0.04, eyes: eyesFor('hero', 'deadpan', f), brows: 'calm', mouth: 'dash', armR: 'downR', armL: 'downL' }, x: -0.95, z: -0.6, sc: 0.62 };
}
function kabirPose(f) {
  const s = shotAt(f).id, seg = inSeg('kabir', f);
  const base = { ...KAB_BASE };
  if (s === 'devCU') return null;
  if (s === 'wide') return { o: { ...base, lean: -5, headTilt: -6, faceShift: -0.06, eyes: 'laugh', brows: 'raised', mouth: 'open', armR: 'belly', armL: 'point' }, x: 0.62, z: 0.55, sc: 0.96 };
  if (s === 'tie') return { o: { ...base, lean: -4, headTilt: -4, faceShift: -0.05, eyes: eyesFor('kabir', 'deadpan', f), brows: 'skeptic', mouth: 'teeth', mouthScale: 0.8, armR: 'hipR', armL: 'downL' }, x: 1.05, z: 1.1, sc: 0.95 };
  if (s === 'kabirCU') {
    if (seg) return { o: { ...base, lean: q05(-4 + Math.sin(f * 0.36 + 1) * 0.9 + (SPEAK.env[f] || 0)), headTilt: q05(-5 + Math.sin(f * 0.24) * 1.3), faceShift: -0.06, eyes: f < L(4).f0 + (L(4).f1 - L(4).f0) * 0.4 ? 'laugh' : 'deadpan', brows: 'raised', mouth: mouthFor(f, 'flat'), mouthScale: 0.95, armR: 'belly', armL: 'point' }, x: 0.62, z: 0.55, sc: 1, speak: true };
    return { o: { ...base, lean: -5, headTilt: -6, faceShift: -0.06, eyes: 'laugh', brows: 'raised', mouth: 'open', armR: 'belly', armL: 'point' }, x: 0.62, z: 0.55, sc: 1 };
  }
  if (s === 'climb') return { o: { ...base, lean: -4, headTilt: -5, faceShift: -0.05, eyes: 'laugh', brows: 'raised', mouth: 'teeth', mouthScale: 0.9, armR: 'belly', armL: 'point' }, x: 0.62, z: 0.55, sc: 0.96 };
  if (s === 'earcup') {
    if (f < F.earcup) return { o: { ...base, lean: -5, headTilt: -6, faceShift: -0.06, eyes: 'laugh', brows: 'raised', mouth: 'open', armR: 'belly', armL: 'point' }, x: 0.62, z: 0.55, sc: 1 };
    return { o: { ...base, lean: -3, headTilt: -8, faceShift: -0.07, eyes: eyesFor('kabir', 'deadpan', f), brows: 'skeptic', mouth: 'teeth', mouthScale: 0.85, armR: 'earcupR', armL: 'downL' }, x: 0.62, z: 0.55, sc: 1 };
  }
  if (s === 'sky') return { o: { ...base, lean: -3, headTilt: -6, faceShift: -0.05, eyes: 'deadpan', brows: 'skeptic', mouth: 'teeth', mouthScale: 0.8, armR: 'downR', armL: 'point' }, x: 0.85, z: 0.75, sc: 0.96 };
  if (s === 'analogy') {
    if (f < L(12).f0) return { o: { ...base, lean: -2, headTilt: -3, faceShift: -0.04, eyes: eyesFor('kabir', 'deadpan', f), brows: 'raised', mouth: 'dash', armR: 'shrugR', armL: 'shrugL' }, x: 0.95, z: 0.9, sc: 0.95 };
    return { o: { ...base, lean: -5, headTilt: -6, faceShift: -0.06, eyes: 'laugh', brows: 'raised', mouth: 'teeth', mouthScale: 0.9, armR: 'belly', armL: 'point' }, x: 0.95, z: 0.9, sc: 0.95 };
  }
  if (s === 'boast') {
    if (f >= L(15).f0 && f >= F.truth - 2) return { o: { ...base, lean: -8, headTilt: -9, faceShift: -0.07, eyes: 'shock', brows: 'raised', mouth: 'wavy', armR: 'coverR', armL: 'downL' }, x: 0.62, z: 0.55, sc: 1 };
    const grin = f >= L(15).f0 ? 1.0 : 0.85;
    return { o: { ...base, lean: -3, headTilt: -4, faceShift: -0.05, eyes: eyesFor('kabir', 'deadpan', f), brows: 'stern', mouth: 'teeth', mouthScale: grin, armR: 'hipR', armL: 'downL' }, x: 0.62, z: 0.55, sc: 1 };
  }
  if (s === 'contest') {
    if (f >= L(17).f0 && f >= F.pond - 2) {
      if (f > F.pond + 55) return { o: { ...base, lean: -2, headTilt: -4, faceShift: -0.05, eyes: eyesFor('kabir', 'half', f), brows: 'calm', mouth: 'wavy', armR: 'shrugR', armL: 'shrugL' }, x: 0.75, z: 0.6, sc: 0.97 };
      return { o: { ...base, lean: -7, headTilt: -8, faceShift: -0.06, eyes: 'shock', brows: 'raised', mouth: 'openO', mouthScale: 0.8, armR: 'coverR', armL: 'downL' }, x: 0.75, z: 0.6, sc: 0.97 };
    }
    return { o: { ...base, lean: 4, headTilt: -4, faceShift: -0.04, eyes: eyesFor('kabir', 'deadpan', f), brows: 'stern', mouth: 'flat', armR: 'downR', armL: 'spool' }, x: 0.75, z: 0.6, sc: 0.97 };
  }
  return { o: { ...base, lean: -2, headTilt: -4, faceShift: -0.05, eyes: eyesFor('kabir', 'half', f), brows: 'calm', mouth: 'wavy', armR: 'shrugR', armL: 'downL' }, x: 1.2, z: -0.6, sc: 0.62 };
}
function kidPose(which, f) {
  const s = shotAt(f).id;
  if (s !== 'wide' && s !== 'contest') return null;
  if (which === 1) {
    if (s === 'contest') return { o: { ...KID1_BASE, lean: -3, headTilt: -4, faceShift: -0.04, eyes: 'happy', brows: 'raised', mouth: 'open', mouthScale: 0.9, armR: 'upR', armL: 'downL' }, x: -1.8, z: 1.3, sc: 0.8 };
    return { o: { ...KID1_BASE, lean: -4, headTilt: -5, faceShift: -0.05, eyes: 'laugh', brows: 'raised', mouth: 'open', mouthScale: 0.9, armR: 'belly', armL: 'downL' }, x: -1.8, z: 1.3, sc: 0.8 };
  }
  if (s === 'contest') return { o: { ...KID2_BASE, lean: 3, headTilt: 4, faceShift: 0.04, eyes: 'happy', brows: 'raised', mouth: 'teeth', mouthScale: 0.9, armR: 'gesture2', armL: 'downL' }, x: 1.85, z: 1.5, sc: 0.78 };
  return { o: { ...KID2_BASE, lean: 3, headTilt: 5, faceShift: 0.05, eyes: 'laugh', brows: 'raised', mouth: 'teeth', mouthScale: 0.9, armR: 'gesture2', armL: 'downL' }, x: 1.85, z: 1.5, sc: 0.78 };
}
function applyChar(card, pose, f, phase) {
  if (!pose) { card.mesh.visible = false; card.blob.visible = false; return; }
  card.mesh.visible = true; card.blob.visible = true;
  card.setPose(pose.o);
  card.setPos(pose.x, pose.z, pose.sc, 1);
  const sway = pose.speak ? 0.010 : 0.005;
  card.mesh.rotation.z = Math.sin(f * 0.21 + phase) * sway + (pose.speak ? (SPEAK.env[f] || 0) * 0.008 * Math.sin(f * 0.9 + phase) : 0);
  card.mesh.position.y = CARD_H / 2 * pose.sc - 0.03 + Math.abs(Math.sin(f * 0.16 + phase)) * (pose.speak ? 0.012 : 0.006);
}

// ---------- kite state (pure functions of f) ----------
function devKitePos(f) {
  const wk = windK(f);
  let p;
  if (f < L(5).f0) p = { x: -2.7, y: 6.6, z: -10 };
  else if (f < L(6).f1) { const u = ramp(f, L(5).f0, L(6).f0 + 20); p = { x: lerp(-2.7, -1.7, u), y: lerp(6.6, 7.7, u), z: -10 }; }
  else if (f < L(10).f0) p = { x: -1.7, y: 7.7, z: -10 };
  else if (f < L(16).f0) { const u = sstep(ramp(f, L(10).f0, L(10).f1)); p = { x: lerp(-1.7, 0.9, u), y: lerp(7.7, 6.7, u) - Math.sin(u * Math.PI) * 0.5, z: -10 }; }
  else if (f < L(17).f0) { const u = ramp(f, L(16).f0, L(16).f0 + 50); p = { x: lerp(0.9, -1.3, u), y: lerp(6.7, 8.7, u), z: -10 }; }
  else p = { x: -1.3, y: f >= L(18).f0 ? 8.2 : 8.7, z: -10 };
  const amp = 0.35 + wk * 0.85;
  p.x += Math.sin(f * 0.021) * 0.22 * amp;
  p.y += Math.sin(f * 0.033 + 1) * 0.14 * amp;
  return p;
}
function kabKitePos(f) {
  if (f < L(16).f0) return null;
  const dive0 = F.pond - 26;
  if (f < dive0) {
    const sag = f < L(17).f0 ? 0 : ramp(f, L(17).f0, dive0);
    return { x: 2.0 + Math.sin(f * 0.017) * 0.12, y: lerp(6.2, 5.2, sag), z: -9.5, rz: 0.3 + Math.sin(f * 0.04) * 0.08, rx: 0, sunk: false };
  }
  if (f < F.pond) {
    const u = ramp(f, dive0, F.pond), ue = u * u;
    return { x: lerp(2.0, POND.x, ue) + Math.sin(u * 9) * (1 - u) * 0.7, y: lerp(5.2, 0.35, ue * ue), z: lerp(-9.5, POND.z, ue), rz: 0.3 + u * 6.5, rx: -u * 0.8, sunk: false };
  }
  return { x: POND.x - 0.15, y: 0.1, z: POND.z - 0.1, rz: 0.55, rx: -1.15, sunk: true };
}
function skyBottlePos(f) {
  const hp = heroPose(f); if (!hp) return null;
  const spool = new THREE.Vector3(
    hp.x + (108 - 380) / 760 * CARD_W * hp.sc,
    CARD_H / 2 * hp.sc - 0.03 + (600 - 742) / 1200 * CARD_H * hp.sc,
    hp.z + 0.02);
  const kp = devKitePos(f);
  return new THREE.Vector3(lerp(spool.x, kp.x, 0.76), lerp(spool.y, kp.y, 0.76) - 0.36, lerp(spool.z, kp.z, 0.76));
}
// note spawn events (deterministic)
const noteEvents = [];
for (let f = 0; f < TOTAL; f++) {
  const h = humK(f);
  if (h > 0.08 && hash(f * 1.31) < h * 0.45) noteEvents.push({ f, hand: f >= L(12).f0 && f < L(13).f0, p: pitchK(f), slot: noteEvents.length % 18 });
}
const noteSlots = Array.from({ length: 18 }, () => []);
for (const e of noteEvents) noteSlots[e.slot].push(e);

// ---------- caption overlay (word-by-word, low-centre) ----------
const capCanvas = document.createElement('canvas'); capCanvas.width = 1080; capCanvas.height = 1920;
const capCtx = capCanvas.getContext('2d');
const capTex = new THREE.CanvasTexture(capCanvas); capTex.colorSpace = THREE.SRGBColorSpace;
const capScene = new THREE.Scene();
const capCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
capScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { map: { value: capTex } }, transparent: true, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = texture2D(map, vUv); }',
})));
function drawCaption(f) {
  const t = f / FPS;
  capCtx.clearRect(0, 0, 1080, 1920);
  const dip = Math.sin(Math.PI * ramp(f, L(16).f0 - 2, L(16).f0 + 10));
  if (dip > 0.01) { capCtx.fillStyle = `rgba(255,252,240,${(dip * 0.85).toFixed(3)})`; capCtx.fillRect(0, 0, 1080, 1920); }
  let cur = null;
  for (const w of WORDS) { if (w.s <= t) cur = w; else break; }
  if (cur && t - cur.e <= 0.6) {
    capCtx.font = '900 76px Arial, sans-serif'; capCtx.textAlign = 'center'; capCtx.textBaseline = 'middle';
    capCtx.lineWidth = 15; capCtx.strokeStyle = '#2b1a26'; capCtx.lineJoin = 'round';
    capCtx.shadowColor = 'rgba(20,10,30,0.35)'; capCtx.shadowBlur = 10; capCtx.shadowOffsetY = 4;
    capCtx.strokeText(cur.w, 540, 1425);
    capCtx.fillStyle = '#ffffff'; capCtx.fillText(cur.w, 540, 1425);
    capCtx.shadowColor = 'transparent'; capCtx.shadowBlur = 0; capCtx.shadowOffsetY = 0;
  }
  capTex.needsUpdate = true;
}

// ---------- per-frame render ----------
window.__probeData = null;
window.renderFrame = (f) => {
  const cam = camAt(f);
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
  camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  camera.fov = cam.fov; camera.updateProjectionMatrix();

  // morning light for the contest (hidden under the white dip)
  const lk = ramp(f, L(16).f0, L(16).f0 + 10);
  sun.position.set(lerp(6, 5.5, lk), lerp(10, 9.5, lk), lerp(5, 4.5, lk));
  renderer.toneMappingExposure = lerp(1.12, 1.17, lk);
  hemi.intensity = lerp(1.05, 1.12, lk);

  const hp = heroPose(f), kp = kabirPose(f);
  applyChar(hero, hp, f, 0); applyChar(kabir, kp, f, 2.1);
  applyChar(kid1, kidPose(1, f), f, 4.2); applyChar(kid2, kidPose(2, f), f, 5.7);

  // clouds drift + grass sway + flag wave
  clouds.forEach((c, i) => { c.position.x = c.userData.x0 + Math.sin(f * 0.002 + c.userData.seed * 7) * 0.3; });
  tufts.forEach((t) => { t.rotation.z = Math.sin(f * 0.09 + t.userData.ph) * 0.06 * (0.5 + windK(f)); t.rotation.x = Math.sin(f * 0.07 + t.userData.ph * 2) * 0.03; });
  {
    const pos = flag.geometry.attributes.position, wk = windK(f);
    for (let i = 0; i < pos.count; i++) {
      const x = flagBase[i * 3];
      pos.setZ(i, Math.sin(x * 4 - f * 0.35) * 0.06 * wk * (x / 0.95));
    }
    pos.needsUpdate = true;
  }

  // Dev's kite + tail bows
  const dk = devKitePos(f), wk = windK(f);
  devKite.position.set(dk.x, dk.y, dk.z);
  devKite.rotation.set(Math.sin(f * 0.04) * 0.06, Math.sin(f * 0.03) * 0.1, Math.sin(f * 0.05) * 0.12 * (0.35 + wk));
  devKite.userData.bows.forEach((b, i) => {
    b.position.set(Math.sin(f * 0.07 + i * 1.3) * 0.09, -0.62 - i * 0.38, 0);
    b.rotation.z = Math.sin(f * 0.06 + i) * 0.3;
  });
  // Kabir's kite
  const kk = kabKitePos(f);
  kabKite.visible = !!kk;
  if (kk) {
    kabKite.position.set(kk.x, kk.y, kk.z);
    kabKite.rotation.set(kk.rx, 0, kk.rz);
    kabKite.userData.bows.forEach((b, i) => { b.position.set(Math.sin(f * 0.05 + i) * 0.07, -0.6 - i * 0.36, 0); b.rotation.z = Math.sin(f * 0.05 + i * 2) * 0.25; });
  }
  // strings + bottles
  const spoolPt = (hp && hp.o.armL === 'spool' && hero.mesh.visible) ? hero.anchorWorld('spool') : null;
  const gripPt = (hp && hp.o.armR === 'grip' && hero.mesh.visible) ? hero.anchorWorld('grip') : null;
  const onString = !!spoolPt && f >= L(5).f0;
  devString.visible = !!spoolPt;
  if (spoolPt) {
    const kv = new THREE.Vector3(dk.x, dk.y, dk.z);
    const attach = spoolPt.clone().lerp(kv, 0.76);
    const mid = spoolPt.clone().lerp(kv, 0.3); mid.y -= (1 - wk) * 0.35 + 0.08;
    const near = spoolPt.clone().lerp(kv, 0.85);
    setString(devString, [spoolPt, mid, onString ? attach : spoolPt.clone().lerp(kv, 0.76), near, kv]);
  }
  skyBottle.visible = onString;
  if (onString) {
    const bp = skyBottlePos(f);
    skyBottle.position.copy(bp);
    skyBottle.rotation.z = Math.sin(f * 0.045) * 0.18 * (0.4 + wk);
    skyBottle.userData.glints.forEach((g, i) => { g.material.opacity = (i ? 0.45 : 0.55) + humK(f) * 0.4; });
  }
  const blowing = hp && hp.blow;
  handBottle.visible = !!gripPt || !!blowing;
  if (blowing) {
    const mp = hero.mouthWorld();
    handBottle.position.set(mp.x + 0.13, mp.y - 0.13, mp.z + 0.03);
    handBottle.rotation.set(0.2, 0, -0.55);
  } else if (gripPt) {
    handBottle.position.set(gripPt.x - 0.02, gripPt.y - 0.24, gripPt.z + 0.01);
    handBottle.rotation.set(0, 0, 0.06);
  }
  kabString.visible = !!kk && kp && kp.o.armL === 'spool' && kabir.mesh.visible;
  if (kabString.visible) {
    const sp = kabir.anchorWorld('spool');
    const kv = new THREE.Vector3(kk.x, kk.y, kk.z);
    const mid = sp.clone().lerp(kv, 0.5); mid.y -= kk.sunk ? 0.9 : 0.25;
    const near = sp.clone().lerp(kv, 0.82);
    setString(kabString, [sp, mid, near, kv]);
  }

  // music notes
  for (let i = 0; i < notes.length; i++) {
    const s = notes[i]; let ev = null;
    for (const e of noteSlots[i]) { if (e.f <= f && f - e.f < 36) ev = e; if (e.f > f) break; }
    if (!ev) { s.material.opacity = 0; continue; }
    const age = f - ev.f, u = age / 36;
    const src = ev.hand ? handBottle.position : (skyBottlePos(ev.f) || new THREE.Vector3());
    s.position.set(src.x + 0.12 + Math.sin(age * 0.2 + ev.f) * 0.08, src.y + 0.3 + u * 0.85, src.z + 0.15);
    const sc = 0.13 + ev.p * 0.11;
    s.scale.set(sc, sc, 1);
    s.material.opacity = Math.sin(Math.PI * u) * 0.95;
  }
  // wind streaks
  streaks.forEach((s, i) => {
    const P = 80 + hash(i * 7.3) * 70, age = (f + hash(i * 13.7) * 400) % P, u = age / P;
    if (wk > 0.4 && u < 0.7) {
      s.position.set(lerp(-7, 7, u / 0.7), 3.2 + hash(i * 3.1) * 3.4, -6 - hash(i * 5.9) * 3);
      s.material.opacity = Math.sin(Math.PI * (u / 0.7)) * 0.3 * wk;
    } else s.material.opacity = 0;
  });
  // splash + ripples
  drops.forEach((d, j) => {
    const age = f - F.pond;
    if (age < 0 || age > 20) { d.material.opacity = 0; return; }
    const vx = (hash(j * 3.3) - 0.5) * 0.055, vy = 0.10 + hash(j * 7.1) * 0.07, vz = (hash(j * 5.7) - 0.5) * 0.045;
    d.position.set(POND.x + vx * age, 0.25 + vy * age - 0.0045 * age * age, POND.z + vz * age);
    d.material.opacity = 0.9 * (1 - age / 20);
  });
  ripples.forEach((r, i) => {
    if (i < 3) {
      const age = f - (F.pond + i * 7);
      if (age < 0 || age > 34) { r.material.opacity = 0; return; }
      const u = age / 34, sc = 0.3 + u * 2.4;
      r.scale.set(sc, sc, 1); r.material.opacity = 0.75 * (1 - u);
    } else {
      const cyc = f % 90;
      if (cyc < 30) { const u = cyc / 30, sc = 0.25 + u * 0.85; r.position.set(POND.x + 0.4, 0.045, POND.z - 0.3); r.scale.set(sc, sc, 1); r.material.opacity = 0.22 * (1 - u); }
      else r.material.opacity = 0;
    }
  });
  // win glint
  {
    const age = f - F.won;
    if (age >= 0 && age <= 25) {
      star.position.set(dk.x + 0.35, dk.y + 0.45, dk.z + 0.6);
      const sc = 1.6 * (0.5 + age / 25); star.scale.set(sc, sc, 1);
      star.material.opacity = 0.8 * (1 - age / 25);
    } else star.material.opacity = 0;
  }
  // hook board rises only for the final line
  const bk = ramp(f, L(18).f0, L(18).f0 + 26);
  boardGroup.visible = f >= L(18).f0 - 1;
  boardGroup.position.y = -2.5 * (1 - (1 - Math.pow(1 - bk, 3)));

  renderer.clear();
  renderer.render(scene, camera);
  drawCaption(f);
  renderer.autoClear = false;
  renderer.render(capScene, capCam);
  renderer.autoClear = true;
  window.__probeData = { f, shot: cam.shot, cam: cam.pos.map((v) => +v.toFixed(3)), look: cam.look.map((v) => +v.toFixed(3)) };
};
window.__boardBBox = () => {
  const b = boardGroup.userData.board;
  b.updateWorldMatrix(true, false);
  const hw = b.geometry.parameters.width / 2, hh = b.geometry.parameters.height / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => {
    const v = new THREE.Vector3(x, y, 0).applyMatrix4(b.matrixWorld).project(camera);
    return { x: +((v.x * 0.5 + 0.5) * 1080).toFixed(1), y: +((0.5 - v.y * 0.5) * 1920).toFixed(1), behind: v.z > 1 };
  });
};
window.TOTAL_FRAMES = TOTAL;
window.ready = true;
