// main.js — "Everyone Blamed the Wrong Man" (50s, 1500 frames @30fps)
// Locked car-match style: the 4 approved frames extended into motion.
// Beat map from the N1 stem's actual line timings (words.js):
//   B1 highway driving   L1-L2   f0    -266   (0.00-8.87s)
//   B2 suburb "enough"   L3-L4   f267  -473   (8.90-15.80s)
//   B3 crash chain       L5-L7   f474  -879   (15.80-29.33s)
//   B4 blame + dashcam   L8-L11  f880  -1347  (29.33-44.93s)
//   B5 hook board        L12     f1348 -1499  (44.93-50.00s)
import * as THREE from 'three';
import { loadAssets, applyEnv, SkyDome, SuvVehicle, prepareCar, collectWheels, spinWheels } from './kit.js';
import { buildScene1, buildScene2, buildScene3, buildScene4 } from './scenes.js';
import { WORDS, LINES } from './words.js';

const W = 1080, H = 1920, FPS = 30, TOTAL = 1500;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const wordStart = (txt, line) => {
  const w = WORDS.find((x) => x.w === txt && (!line || Math.abs(x.s - line.s) < 3 || (x.s >= line.s && x.s <= line.e)));
  return w ? w.s : 0;
};

// ---------- caption chunks (reference style: short phrases, word-timed) ----------
const CHUNKS = [];
{
  const WF = WORDS.filter((w) => w.w !== '—');
  let cur = [];
  const flush = () => { if (cur.length) { CHUNKS.push(cur); cur = []; } };
  WF.forEach((w, i) => {
    cur.push(w);
    const next = WF[i + 1];
    const endSentence = /[.!?]$/.test(w.w.replace(/["”]$/, ''));
    const gap = next ? next.s - w.e : 99;
    if (endSentence || cur.length >= 3 || gap > 0.2 || !next) flush();
  });
  for (const ch of CHUNKS) {
    ch.text = ch.map((x) => x.w).join(' ');
    ch.s = ch[0].s;
    const idx = CHUNKS.indexOf(ch);
    ch.e = 0; // filled below
  }
  CHUNKS.forEach((ch, i) => {
    const next = CHUNKS[i + 1];
    const lineEnd = LINES.find((l) => ch.s >= l.s && ch.s < l.e);
    ch.e = next && next.s < (lineEnd ? lineEnd.e : 99) ? next.s : (lineEnd ? lineEnd.e + 0.15 : ch[ch.length - 1].e + 0.3);
  });
}

// ---------- overlay (captions / dashcam frame / hook board) ----------
const ovCanvas = document.createElement('canvas'); ovCanvas.width = W; ovCanvas.height = H;
const ov = ovCanvas.getContext('2d');
const ovTex = new THREE.CanvasTexture(ovCanvas); ovTex.colorSpace = THREE.SRGBColorSpace;
const ovScene = new THREE.Scene();
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, toneMapped: false })));

function drawCaptionText(text, cx, cy, size, fill = '#ffffff', maxW = 990) {
  ov.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  let s = size;
  while (ov.measureText(text).width > maxW && s > 40) { s -= 4; ov.font = `900 ${s}px Arial, Helvetica, sans-serif`; }
  ov.textAlign = 'center'; ov.textBaseline = 'middle'; ov.lineJoin = 'round';
  ov.lineWidth = Math.round(s * 0.21); ov.strokeStyle = '#000000';
  ov.strokeText(text, cx, cy);
  ov.fillStyle = fill; ov.fillText(text, cx, cy);
}
const L12 = LINES[11];
const SO_T = wordStart('So', L12);
function drawOverlay(t, beat) {
  ov.clearRect(0, 0, W, H);
  if (beat === 5) {
    // hook board over the dimmed aftermath — narration only, no captions
    ov.fillStyle = 'rgba(4,10,20,0.55)'; ov.fillRect(0, 0, W, H);
    const bx = 70, by = 520, bw = W - 140, bh = 800;
    ov.fillStyle = '#0d1b2e';
    ov.strokeStyle = '#f0b400'; ov.lineWidth = 10;
    ov.beginPath(); ov.roundRect(bx, by, bw, bh, 36); ov.fill(); ov.stroke();
    ov.textAlign = 'center'; ov.textBaseline = 'middle';
    const fit = (text, size, maxW) => {
      let s = size;
      ov.font = `900 ${s}px Arial, Helvetica, sans-serif`;
      while (ov.measureText(text).width > maxW && s > 30) { s -= 3; ov.font = `900 ${s}px Arial, Helvetica, sans-serif`; }
      return s;
    };
    const a1 = clamp((t - L12.s - 0.1) / 0.5);
    ov.globalAlpha = a1;
    ov.fillStyle = '#ffffff';
    fit('The man everyone blamed', 74, bw - 70);
    ov.fillText('The man everyone blamed', W / 2, by + 150);
    fit('was the only one', 74, bw - 70);
    ov.fillText('was the only one', W / 2, by + 250);
    fit('who stopped.', 74, bw - 70);
    ov.fillText('who stopped.', W / 2, by + 350);
    ov.globalAlpha = 1;
    const a2 = clamp((t - SO_T - 0.05) / 0.5);
    if (a2 > 0) {
      ov.globalAlpha = a2;
      drawCaptionText('WHO REALLY', W / 2, by + 540, 118, '#f0b400', 860);
      drawCaptionText('CAUSED THE CRASH?', W / 2, by + 680, 118, '#f0b400', 860);
      ov.globalAlpha = 1;
    }
    ovTex.needsUpdate = true;
    return;
  }
  if (beat === 4 && t >= 37.35 && t <= 44.85) {
    // dashcam inset frame + label (the inset picture itself is a
    // scissored 3D pass in renderFrame)
    const fade = clamp(Math.min((t - 37.35) / 0.35, (44.85 - t) / 0.35));
    ov.globalAlpha = fade;
    const ix = Math.round(W * 0.545), iy = Math.round(H * 0.055), iw = Math.round(W * 0.425), ih = Math.round(H * 0.30);
    ov.strokeStyle = '#ffffff'; ov.lineWidth = 7;
    ov.beginPath(); ov.roundRect(ix, iy, iw, ih, 18); ov.stroke();
    ov.fillStyle = 'rgba(6,12,20,0.85)';
    ov.beginPath(); ov.roundRect(ix, iy, 190, 52, [18, 0, 18, 0]); ov.fill();
    ov.fillStyle = '#ff3333';
    ov.beginPath(); ov.arc(ix + 28, iy + 26, 10, 0, Math.PI * 2); ov.fill();
    ov.fillStyle = '#ffffff'; ov.font = '900 30px Arial';
    ov.textAlign = 'left'; ov.textBaseline = 'middle';
    ov.fillText('DASHCAM', ix + 48, iy + 28);
    ov.font = '700 26px Arial'; ov.textAlign = 'right';
    ov.fillText('REPLAY', ix + iw - 16, iy + ih - 24);
    ov.globalAlpha = 1;
  }
  const ch = CHUNKS.find((c) => t >= c.s && t < c.e);
  if (ch) drawCaptionText(ch.text, W / 2, Math.round(H * 0.713), 88);
  ovTex.needsUpdate = true;
}

// ---------- dashcam replay mini-scene ----------
function buildDashScene(A) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#d3e4f4', '#46503c', 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffedd0', 2.4); sun.position.set(6, 9, -4); scene.add(sun);
  scene.add(SkyDome());
  const map = A.asphalt.map.clone(); map.needsUpdate = true;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(24, 120), new THREE.MeshStandardMaterial({
    map, color: '#bcbcb7', roughness: 1,
  }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -30); scene.add(road);
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(40, 120),
    new THREE.MeshStandardMaterial({ color: '#3e8f1d', roughness: 1 }));
  verge.position.set(26, -0.01, -30); verge.rotation.x = -Math.PI / 2; scene.add(verge);
  const blueG = new THREE.Group();
  blueG.position.set(-2.4, 0, -8.5); blueG.rotation.set(0, Math.PI + 0.1, 0); blueG.scale.setScalar(1.6);
  if (A.suv) blueG.add(SuvVehicle(A.suv, { paint: '#83c2f7', variant: 'blue' }));
  scene.add(blueG);
  const redG = new THREE.Group();
  const red = A.car.clone(true); prepareCar(red, '#ff2015', 0.22);
  redG.add(red); redG.rotation.set(0, -Math.PI / 2 - 0.25, 0);
  scene.add(redG);
  const wheels = collectWheels(red);
  const cam = new THREE.PerspectiveCamera(58, 0.425 / 0.30, 0.1, 300);
  cam.position.set(1.8, 1.5, 4.2); cam.lookAt(-0.6, 0.9, -8);
  const api = {
    // tau: seconds into the replay (loops every ~3.6s)
    update(tau) {
      const k = clamp(tau / 1.9); // dart across
      const e = 1 - Math.pow(1 - k, 2);
      redG.position.set(lerp(8.5, -9.5, e), 0, lerp(-11.5, -6.0, e));
      redG.rotation.y = -Math.PI / 2 - 0.25 + 0.35 * e;
      spinWheels(wheels, -e * 22);
      const brake = clamp((tau - 1.75) / 0.3);
      blueG.rotation.x = 0.04 * brake * (tau < 2.6 ? 1 : Math.max(0, 1 - (tau - 2.6)));
      blueG.position.y = -0.04 * brake;
    },
  };
  return { scene, cam, api };
}

// ---------- build worlds ----------
let S = null;
init();
async function init() {
  try {
    const A = await loadAssets('assets/');
    const s1 = buildScene1(A); applyEnv(s1.scene, renderer, A.env, { fog: '#a9cdec', near: s1.fog.near, far: s1.fog.far, intensity: s1.fog.intensity });
    const s2 = buildScene2(A); applyEnv(s2.scene, renderer, A.env, { fog: '#a9cdec', near: s2.fog.near, far: s2.fog.far, intensity: s2.fog.intensity });
    const s3 = buildScene3(A); applyEnv(s3.scene, renderer, A.env, { fog: '#a9cdec', near: s3.fog.near, far: s3.fog.far, intensity: s3.fog.intensity });
    const s4 = buildScene4(A); applyEnv(s4.scene, renderer, A.env, { fog: '#a9cdec', near: s4.fog.near, far: s4.fog.far, intensity: s4.fog.intensity });
    const dash = buildDashScene(A); applyEnv(dash.scene, renderer, A.env, { fog: '#a9cdec', near: 15, far: 80, intensity: 0.8 });
    S = { s1, s2, s3, s4, dash };
    window.renderFrame(0);
    window.ready = true;
  } catch (e) {
    window.err = String(e && e.message ? e.message : e);
    console.log('ERR ' + window.err);
  }
}

const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 400);
function setCam(px, py, pz, lx, ly, lz, fov) {
  cam.position.set(px, py, pz); cam.fov = fov;
  cam.lookAt(lx, ly, lz); cam.updateProjectionMatrix();
}
const TODAY_T = wordStart('Today,', LINES[2]);

window.renderFrame = (f) => {
  if (!S) return false;
  const t = f / FPS;
  let beat = 1;
  if (f >= 1348) beat = 5; else if (f >= 880) beat = 4; else if (f >= 474) beat = 3; else if (f >= 267) beat = 2;
  const shake = (amp, freq = 31) => Math.sin(t * freq) * amp + Math.sin(t * freq * 1.7 + 1.3) * amp * 0.6;
  let scene;
  if (beat === 1) {
    scene = S.s1.scene;
    renderer.toneMappingExposure = S.s1.exposure;
    const bt = t; // 0..8.87
    const scroll = bt * 10.5;
    const weave = bt < 4.98 ? 0 : Math.sin(clamp((bt - 4.98) / 3.4) * Math.PI) * 0.5;
    S.s1.api.drive(scroll, weave, Math.sin(bt * 2.2) * 0.02);
    const push = sstep(bt / 8.87) * 0.10 + (bt > 8.2 ? (bt - 8.2) * 0.05 : 0);
    const dir = new THREE.Vector3(0.96 - -3.41, 1.24 - 1.31, 0.56 - -1.87).multiplyScalar(push);
    setCam(-3.41 + dir.x + shake(0.012), 1.31 + dir.y + shake(0.009, 23), -1.87 + dir.z,
      0.96, 1.24, 0.56, 86);
  } else if (beat === 2) {
    scene = S.s2.scene;
    renderer.toneMappingExposure = S.s2.exposure;
    const bt = t - 8.9;
    const k = sstep(clamp(bt / 6.5));
    const headDown = 1 - sstep(clamp((t - (TODAY_T - 0.25)) / 0.55));
    const stepK = sstep(clamp((t - LINES[3].s) / (LINES[3].e - LINES[3].s)));
    S.s2.api.setHero(headDown, stepK, Math.sin(t * 1.6) * 0.004);
    setCam(lerp(0, 0, k) + shake(0.01), lerp(2.55, 2.02, k), lerp(13.6, 11, k),
      0, lerp(1.85, 2.02, k), 0, 50);
  } else if (beat === 3) {
    scene = S.s3.scene;
    renderer.toneMappingExposure = S.s3.exposure;
    const redK = easeOut(clamp((t - 16.1) / 2.5));
    const blueK = clamp((t - 15.9) / 5.4);
    const brakeEnv = clamp((t - 21.05) / 0.55);
    const brakeK = brakeEnv * (t < 23.5 ? 1 : Math.max(0.25, 1 - (t - 23.5) * 0.5)) + Math.sin(Math.max(0, t - 21.1) * 22) * 0.18 * Math.max(0, 1 - Math.max(0, t - 21.1) * 1.4) * brakeEnv;
    const stumbleK = clamp((t - 22.9) / 1.6);
    const diveK = clamp((t - 25.35) / 2.9);
    const pullK = sstep(clamp((t - 26.8) / 1.4));
    S.s3.api.setState({ redK, blueK, brakeK: clamp(brakeK), stumbleK, diveK, pullK });
    // camera: start wide, track the SUV, IMPACT KICK at the brake, pan to the dive, settle locked
    const wide = 1 - sstep(clamp((t - 15.8) / 3.5));
    let fov = 60, shX = shake(0.008), shY = shake(0.006, 27);
    const kick = clamp((t - 21.1) / 0.13) - clamp((t - 21.45) / 0.5);
    fov -= 7 * clamp(kick);
    if (t > 21.1 && t < 21.9) { const d = (t - 21.1) / 0.8; shX += shake(0.05 * (1 - d), 47); shY += shake(0.04 * (1 - d), 53); }
    const panK = sstep(clamp((t - 24.6) / 3.6));
    const lx = lerp(lerp(-0.4, -1.1, wide), 0.15, panK);
    setCam(lerp(0.6, 1.5, wide) + shX, lerp(1.75, 2.35, wide) + shY, lerp(9.8, 12.8, wide),
      lx, lerp(0.95, 1.05, wide), lerp(-4, -5.5, wide), fov);
  } else {
    scene = S.s4.scene;
    renderer.toneMappingExposure = S.s4.exposure;
    if (beat === 4) {
      const yaw = Math.sin((t - 29.4) * 2.6) * 0.3 * clamp((t - 29.6) / 1.2) * (t < 34.2 ? 1 : Math.max(0, 1 - (t - 34.2)));
      const laugh = clamp((t - 30.8) / 2.6) * (t < 37 ? 1 : 0.35);
      const led = t > 34.4 && t < 41.5 ? 2.6 + Math.sin(t * 9) * 1.2 : 0.4;
      S.s4.api.setState({ greenHeadYaw: yaw, yellowLaugh: laugh, ledI: led });
      if (t < 34.35) {
        const k = sstep(clamp((t - 29.33) / 4.7));
        setCam(lerp(0.4, 0.52, k) + shake(0.008), lerp(1.6, 1.58, k), lerp(8.6, 8.15, k), -0.3, 0.9, -4, 60);
      } else if (t < 37.35) {
        const k = sstep(clamp((t - 34.35) / 2.6));
        setCam(lerp(0.52, -0.05, k), lerp(1.58, 1.8, k), lerp(8.15, 6.2, k),
          lerp(-0.3, -0.4, k), lerp(0.9, 1.85, k), lerp(-4, -3.6, k), lerp(60, 54, k));
      } else {
        const k = sstep(clamp((t - 41.3) / 3.2));
        setCam(lerp(-0.05, 0.45, k) + shake(0.008), lerp(1.8, 1.5, k), lerp(6.2, 7.3, k),
          lerp(-0.4, 0.45, k), lerp(1.85, 1.05, k), lerp(-3.6, 3.9, k), lerp(54, 58, k));
      }
    } else {
      // beat 5: locked aftermath framing, very slow push; board is overlay
      S.s4.api.setState({ greenHeadYaw: 0.25, yellowLaugh: 0, ledI: 0.4 });
      const k = clamp((t - 44.93) / 5.07);
      setCam(0.4, 1.6, lerp(8.6, 8.3, k), -0.3, 0.9, -4, 60);
    }
  }
  // main pass
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, H);
  renderer.render(scene, cam);
  // dashcam inset pass
  if (beat === 4 && t >= 37.35 && t <= 44.85) {
    const ix = Math.round(W * 0.545), iw = Math.round(W * 0.425), ih = Math.round(H * 0.30);
    const iyBottom = H - Math.round(H * 0.055) - ih;
    S.dash.api.update((t - 37.35) % 3.6);
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setScissor(ix, iyBottom, iw, ih);
    renderer.setViewport(ix, iyBottom, iw, ih);
    renderer.clearDepth();
    renderer.render(S.dash.scene, S.dash.cam);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
    renderer.setViewport(0, 0, W, H);
  }
  // overlay pass (captions / inset frame / hook board)
  drawOverlay(t, beat);
  renderer.autoClear = false;
  renderer.render(ovScene, fsCam);
  renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
