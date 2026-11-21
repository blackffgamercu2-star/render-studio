import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ============================================================================
// Noise core — ADAPTED from proceduralterrains (MIT, Copyright (c) 2026 ZyFou)
// src/engine/terrain/noise/cpuNoise.js: Dave-Hoskins hash12, QUINTIC value
// noise, and rotated-domain FBM (rotate 0.80/0.60 per octave to kill axial
// alignment). JS port follows their CPU evaluator; v1 used a sin-hash +
// cubic smoothstep noise — this is the repo technique replacing it.
// ============================================================================
function fract(v) { return v - Math.floor(v); }
export function hash12(px, py) {
  let x = fract(px * 0.1031), y = fract(py * 0.1031);
  const z = x;
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d;
  return fract((x + y) * (z + d));
}
export function vnoise(px, py) { // quintic interpolation (PT cpuNoise vnoise2)
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash12(ix, iy), b = hash12(ix + 1, iy), c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// Rotated-domain FBM (PT ROT2 = mat2(0.80,-0.60,0.60,0.80) per octave;
// the same rotation trick The Book of Shaders ch.13 uses in GLSL to reduce
// axial bias — pattern learned there, code from the PT port).
export function fbm(px, py, oct = 4) {
  let s = 0, amp = 0.5, x = px, y = py, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x, y); norm += amp;
    const nx = 0.80 * x + 0.60 * y, ny = -0.60 * x + 0.80 * y;
    x = nx * 2.02; y = ny * 2.02; amp *= 0.5;
  }
  return s / norm; // 0..1
}
// Ridged multifractal (threejs-worldgen WORLDGEN.md: mountains = 1-|noise|,
// squared, octaves weighted by the previous octave).
export function ridged(px, py, oct = 4) {
  let s = 0, amp = 0.55, x = px, y = py, norm = 0, w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(2 * vnoise(x, y) - 1); n *= n;
    s += amp * w * n; norm += amp * w; w = Math.min(1, n * 1.6);
    const nx = 0.80 * x + 0.60 * y, ny = -0.60 * x + 0.80 * y;
    x = nx * 2.13; y = ny * 2.13; amp *= 0.5;
  }
  return s / norm; // 0..1
}
// Domain warp (worldgen climate fields are domain-warped so nothing lines up).
export function warp(x, z, amt = 14, scale = 0.011) {
  return [x + amt * (fbm(x * scale + 31.7, z * scale + 11.3, 3) - 0.5) * 2,
          z + amt * (fbm(x * scale + 3.1, z * scale + 47.9, 3) - 0.5) * 2];
}
// Seeded RNG — LCG from open-3d-skills starter kit.js (MIT, exploraX), adapted.
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
// Canvas texture — pattern from open-3d-skills kit.js canvasTex() (MIT), adapted.
export function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
// Ashima / Ian McEwan 2D simplex noise GLSL — MIT (Copyright (c) 2011 Ashima
// Arts), as printed in The Book of Shaders ch.11 (11/2d-snoise.frag).
export const GLSL_SNOISE = /* glsl */`
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x - floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbmG(vec2 st){ // BoS ch.13 structure: octaves with rotation (pattern learned)
  float v = 0.0; float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for(int i=0;i<5;i++){ v += a * (snoise(st)*0.5+0.5); st = rot * st * 2.02; a *= 0.5; }
  return v;
}`;

// ---------- page bootstrap: seek mode (?t=, ?flash=) or live RAF (v1 harness) ----------
export function boot(setup) {
  const params = new URLSearchParams(location.search);
  const seekT = params.has('t') ? parseFloat(params.get('t')) : null;
  const flash = params.get('flash') === '1';
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 700);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.35;
  const api = setup(scene, camera, renderer, { flash }) || {};
  const update = api.update || (() => {});
  if (seekT !== null) {
    update(seekT);
    renderer.render(scene, camera);
    window.__ready = true;
  } else {
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => { update(clock.getElapsedTime()); renderer.render(scene, camera); });
    window.__ready = true;
  }
  return { scene, camera, renderer };
}

// Sky dome v2: gradient + Mie-style forward glow around the sun + a subtle
// domain-warped FBM cloud band. Glow term is a cheap single-scatter
// approximation learned from threejs-worldgen sky/scattering.ts (Rayleigh
// blue-dominant + Mie forward scattering, g≈0.76) — re-implemented, not ported.
export function skyDome(sunDir = new THREE.Vector3(0.45, 0.62, 0.28), top = 0x2a63c8, mid = 0x9ec9ee, bot = 0xe9f3fa) {
  const geo = new THREE.SphereGeometry(320, 28, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      cTop: { value: new THREE.Color(top) }, cMid: { value: new THREE.Color(mid) }, cBot: { value: new THREE.Color(bot) },
      uSun: { value: sunDir.clone().normalize() }, uTime: { value: 0 }
    },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 cTop,cMid,cBot; uniform vec3 uSun; uniform float uTime; varying vec3 vP;
      ${GLSL_SNOISE}
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 c = h > 0.12 ? mix(cMid, cTop, smoothstep(0.12, 0.65, h)) : mix(cBot, cMid, smoothstep(-0.08, 0.12, h));
        float mu = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.85, 0.6) * pow(mu, 220.0) * 1.4;            // sun disc
        c += vec3(1.0, 0.88, 0.66) * pow(mu, 8.0) * 0.16;           // Mie forward glow
        float cl = fbmG(d.xz / max(0.28, h + 0.35) * 1.6 + vec2(uTime*0.004, 0.0)); // BoS double-fbm cloud band
        float cmask = smoothstep(0.58, 0.78, cl) * smoothstep(0.02, 0.20, h) * 0.35;
        c = mix(c, vec3(1.02), cmask);
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -10;
  return { mesh: m, update(t) { mat.uniforms.uTime.value = t; } };
}

export function sunLight(x, y, z, intensity = 2.6, shadowSize = 2048) {
  const l = new THREE.DirectionalLight(0xfff2dd, intensity);
  l.position.set(x, y, z); l.castShadow = true;
  l.shadow.mapSize.set(shadowSize, shadowSize);
  l.shadow.camera.left = -18; l.shadow.camera.right = 18; l.shadow.camera.top = 18; l.shadow.camera.bottom = -18;
  l.shadow.camera.far = 140; l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02;
  return l;
}
export function shadowGround(size, color, y = 0) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(size, 40), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.position.y = y; g.receiveShadow = true; return g;
}
export function label(text) {
  const d = document.createElement('div'); d.className = 'hud'; d.textContent = text; document.body.appendChild(d);
}
// onBeforeCompile wind-sway patch — adapted from threejs-game-skills
// aaa-graphics-builder references/shader-cookbook.md (c) (MIT): phase from the
// instance translation, displacement proportional to height above the base,
// customProgramCacheKey set (without it the injection can be silently dropped)
// and uniforms driven through a shared object so seek-mode renders see t.
export function windPatch(material, { amp = 0.08, freq = 1.5, key = 'wind-sway', phaseFrom = 'instance', flatH = false } = {}) {
  const shared = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTimeW = shared;
    shader.vertexShader = 'uniform float uTimeW;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       ${phaseFrom === 'instance'
         ? `#ifdef USE_INSTANCING
              float phW = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
            #else
              float phW = 0.0;
            #endif`
         : `float phW = position.x * 1.7 + position.z * 2.3;`}
       float hW = ${flatH ? '1.0' : 'max(position.y, 0.0)'};
       transformed.x += sin(uTimeW * ${freq.toFixed(2)} + phW) * ${amp.toFixed(3)} * hW;
       transformed.z += cos(uTimeW * ${(freq * 0.73).toFixed(2)} + phW) * ${(amp * 0.6).toFixed(3)} * hW;`
    );
  };
  material.customProgramCacheKey = () => key;
  return { update(t) { shared.value = t; } };
}
