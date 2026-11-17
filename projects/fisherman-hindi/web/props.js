// props.js — LIBRARY v3 realistic hero-prop builders (Detail Standard)
// Every prop is built from its REAL parts: a car has a floor pan, sculpted
// body, fenders, door seams, a dashboard with dials, seats with piping, a
// folding soft-top, treaded tyres on spoked rims, chrome bumpers, lamps with
// lenses + glints and a rear number plate — never a flat coloured block.
// Materials follow the Detail Standard: coded canvas textures everywhere,
// metal = texture + envMap (pass opts.envMap in; the sheen band then MOVES
// as the camera moves), NO flat emissive fills. All randomness is seeded
// (mulberry32) — renders are deterministic, Math.random is never used here.
// Contract (a main.js is written against these exact returns):
//   buildCar(o)        -> { group, spinWheels, steerWheels, setRoof, setGlow, setGlint, dims, collider }
//   buildStoneWall(o)  -> { group, collider }
//   buildHut(o)        -> { group, collider }
//   buildPalm(o)       -> { group, collider }
//   buildCart(o)       -> { group, collider }
//   buildCliffRocks(o) -> { group, colliders }
//   buildTurtle(o)     -> { group, head, mouth, flippers, setYawn, dims, collider }
// Local axes for vehicles/actors: +x = forward (nose), z = sides, y = up,
// ground at y = 0. Every mesh casts + receives shadow unless it is glass,
// a lens, a sprite or a contact-shadow plane.
import * as THREE from 'three';
import * as FX from './fx.js';
import * as P from './paint.js';
import * as MAT4 from './materials.js';

// ---------- seeded RNG (mulberry32) — deterministic renders ----------
function RNG(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- small shared helpers ----------
const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1, ...o });
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return [c, c.getContext('2d')]; }
function ctex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
function put(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function bev(parent, w, h, d, mat, x = 0, y = 0, z = 0, bevel) {
  const m = FX.bevelBox(w, h, d, { mat, bevel });
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function strut(parent, a, b, r, mat) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.25, len, 7), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function shadowify(root) { root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
// soft radial glow sprite (lamp light — a soft disc, never FX.glint's hard cross)
function softGlowSprite(scale, color) {
  const [c, g] = cnv(64);
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); return s;
}
// hex colour helpers for the car-paint gradient
function hexRGB(hex) { const n = parseInt(String(hex).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixRGB(rgb, target, amt) { return rgb.map((v, i) => Math.round(v + (target[i] - v) * amt)); }
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

// ---------- in-module canvas textures ----------
// car paint: metallic gradient derived from the paint colour + fine flake
// noise + subtle brushed streaks (richer descendant of v1's goldCanvas)
function carPaintCanvas(paint, seed) {
  const [c, g] = cnv(512), r = RNG(seed * 911 + 3);
  const base = hexRGB(paint);
  const pale = mixRGB(base, [255, 246, 205], 0.72), light = mixRGB(base, [255, 255, 255], 0.42);
  const dark = mixRGB(base, [30, 18, 4], 0.38), deep = mixRGB(base, [12, 8, 2], 0.6);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, rgba(deep, 1)); gr.addColorStop(0.28, rgba(base, 1)); gr.addColorStop(0.47, rgba(pale, 1));
  gr.addColorStop(0.58, rgba(light, 1)); gr.addColorStop(0.76, rgba(base, 1)); gr.addColorStop(1, rgba(dark, 1));
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) { // brushed streaks, running along the panel
    g.strokeStyle = `rgba(255,242,205,${0.025 + r() * 0.05})`; g.lineWidth = 1;
    const y = r() * 512; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (r() - 0.5) * 7); g.stroke();
  }
  for (let i = 0; i < 5200; i++) { // metallic flake: tiny bright/dark specks that catch the env light
    g.fillStyle = r() < 0.6 ? `rgba(255,248,215,${0.05 + r() * 0.13})` : `rgba(40,24,4,${0.05 + r() * 0.1})`;
    g.fillRect(r() * 512, r() * 512, 1.4, 1.4);
  }
  return c;
}
// tyre tread: blocky chevron blocks + a centre groove (wraps the circumference)
function treadCanvas(seed) {
  const [c, g] = cnv(512, 256), r = RNG(seed * 577 + 9);
  g.fillStyle = '#1d1e23'; g.fillRect(0, 0, 512, 256);
  const cols = 16, rows = 4, bw = 512 / cols, bh = 256 / rows;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = col * bw + (row % 2) * bw * 0.5, y = row * bh;
    g.fillStyle = `rgb(${44 + r() * 8},${46 + r() * 8},${54 + r() * 8})`;
    g.fillRect(x + 3, y + 5, bw - 7, bh - 10);
    g.strokeStyle = 'rgba(140,148,160,0.35)'; g.lineWidth = 3; // chevron siping
    g.beginPath(); g.moveTo(x + 8, y + bh * 0.3); g.lineTo(x + bw * 0.5, y + bh * 0.55); g.lineTo(x + 8, y + bh * 0.8); g.stroke();
    g.beginPath(); g.moveTo(x + bw - 8, y + bh * 0.3); g.lineTo(x + bw * 0.5, y + bh * 0.55); g.lineTo(x + bw - 8, y + bh * 0.8); g.stroke();
  }
  g.fillStyle = 'rgba(8,8,10,0.85)'; g.fillRect(0, 124, 512, 8); // centre groove
  return c;
}
// tyre sidewall: dark rubber, a raised bead ring + moulded lettering bumps
function sidewallCanvas(seed) {
  const [c, g] = cnv(256), r = RNG(seed * 349 + 21);
  g.fillStyle = '#23242a'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(70,74,84,0.8)'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(12,12,14,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 82, 0, 7); g.stroke();
  g.fillStyle = 'rgba(120,126,138,0.5)';
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; g.beginPath(); g.arc(128 + Math.cos(a) * 89, 128 + Math.sin(a) * 89, 2.2, 0, 7); g.fill(); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.14})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
  return c;
}
// dashboard face: three dials (rings, ticks, needles) on a dark panel
function dialCanvas(seed) {
  const [c, g] = cnv(512, 192), r = RNG(seed * 271 + 5);
  const gr = g.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, '#2c2620'); gr.addColorStop(0.5, '#1d1a16'); gr.addColorStop(1, '#12100e');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 192);
  [106, 256, 406].forEach((cx, di) => {
    g.fillStyle = '#0d0f12'; g.beginPath(); g.arc(cx, 96, 64, 0, 7); g.fill();
    g.strokeStyle = '#cfd6dd'; g.lineWidth = 6; g.beginPath(); g.arc(cx, 96, 62, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(240,244,248,0.85)'; g.lineWidth = 3;
    for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + i * Math.PI * 1.5 / 10; g.beginPath(); g.moveTo(cx + Math.cos(a) * 48, 96 + Math.sin(a) * 48); g.lineTo(cx + Math.cos(a) * 56, 96 + Math.sin(a) * 56); g.stroke(); }
    g.strokeStyle = di === 2 ? '#c23a2e' : '#e8b23a'; g.beginPath(); g.arc(cx, 96, 62, Math.PI * 1.9, Math.PI * 2.25); g.stroke(); // red zone on the last dial
    const na = Math.PI * (0.8 + r() * 1.1);
    g.strokeStyle = '#e84a30'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, 96); g.lineTo(cx + Math.cos(na) * 44, 96 + Math.sin(na) * 44); g.stroke();
    g.fillStyle = '#cfd6dd'; g.beginPath(); g.arc(cx, 96, 7, 0, 7); g.fill();
  });
  g.fillStyle = 'rgba(255,220,150,0.9)';
  for (const x of [176, 336]) { g.beginPath(); g.arc(x, 150, 5, 0, 7); g.fill(); } // tell-tale lamps
  return c;
}
// turtle shell: hex scutes (v1 shellCanvas, seeded instead of Math.random)
function shellCanvas(seed) {
  const [c, g] = cnv(512, 256), r = RNG(seed * 613 + 31);
  g.fillStyle = '#66713a'; g.fillRect(0, 0, 512, 256);
  const hex = (x, y, rad, fill, line) => {
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = line; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,250,210,0.20)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.22, 0, 7); g.fill();
  };
  for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++)
    hex(col * 54 + (row % 2) * 27, row * 52 + 8, 25, row % 2 ? '#5a6834' : '#707c40', '#46522a');
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(40,48,20,${r() * 0.16})`; g.fillRect(r() * 512, r() * 256, 3, 3); }
  return c;
}
// turtle skin: olive with darker blotches + pale speckle
function skinCanvas(seed) {
  const [c, g] = cnv(256), r = RNG(seed * 449 + 13);
  g.fillStyle = '#7d8a4a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(70,82,36,${0.12 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 5 + r() * 16, 4 + r() * 10, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(226,232,180,${0.1 + r() * 0.22})`; g.beginPath(); g.arc(r() * 256, r() * 256, 1 + r() * 2.2, 0, 7); g.fill(); }
  return c;
}
// palm trunk: horizontal growth rings + vertical grain streaks
function ringCanvas(seed) {
  const [c, g] = cnv(256, 512), r = RNG(seed * 197 + 41);
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, '#6b4e2e'); gr.addColorStop(0.5, '#86643c'); gr.addColorStop(1, '#5d4226');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  for (let y = 20; y < 512; y += 42 + r() * 10) { // a ring: dark groove + lit lip under it
    g.fillStyle = 'rgba(38,24,10,0.75)'; g.fillRect(0, y, 256, 6);
    g.fillStyle = 'rgba(255,226,170,0.28)'; g.fillRect(0, y + 6, 256, 3);
  }
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(40,26,12,${0.1 + r() * 0.16})`; g.lineWidth = 1 + r() * 2; const x = r() * 256; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, 170, x - 6, 340, x + r() * 8 - 4, 512); g.stroke(); }
  return c;
}

// ============================================================
// 1. THE GOLDEN CONVERTIBLE — hero car, upgraded from the v1 island-car
// build to the Detail Standard (same footprint: 4.34 x 1.84, wheels
// r 0.36 at x ±1.45 / z ±0.84, wheel centres y 0.36).
// ============================================================
export function buildCar(o = {}) {
  const envMap = o.envMap || null;
  const paint = o.paint || '#c9971f';
  const seed = o.seed ?? 7;
  const plate = o.plate || 'KIRI-1';
  const group = new THREE.Group(); group.name = 'GoldenConvertible'; group.rotation.order = 'YXZ';

  // ----- materials -----
  // v4 paint: layered metallic canvas + CLEARCOAT physical material — the
  // sheen band is a real env reflection that shifts as the car turns.
  const paintTexV4 = ctex(MAT4.carPaintV4(paint, seed));
  const paintMat = new THREE.MeshPhysicalMaterial({ map: paintTexV4, roughness: 0.3, metalness: 0.72, clearcoat: 0.85, clearcoatRoughness: 0.26, envMap, envMapIntensity: 1.25 });
  const paintDkMat = std({ map: paintTexV4, color: 0xa89a80, roughness: 0.4, metalness: 0.85, envMap, envMapIntensity: 0.9 });
  const fenderMat = std({ map: paintMat.map, roughness: 0.36, metalness: 0.85, envMap, envMapIntensity: 1.1, side: THREE.DoubleSide });
  const chromeMat = std({ map: FX.metalTexture({ base: '#c9ced6', seed: seed + 2, panels: 2, rivets: false, rust: 0 }), roughness: 0.26, metalness: 0.95, envMap, envMapIntensity: 1.05 });
  const darkMetalMat = std({ map: FX.metalTexture({ base: '#3a3f45', seed: seed + 3, panels: 2, rivets: false, rust: 0.05 }), roughness: 0.5, metalness: 0.8, envMap, envMapIntensity: 0.7 });
  const rimMat = std({ map: FX.metalTexture({ base: '#cfa14e', seed: seed + 4, panels: 2, rivets: false, rust: 0 }), roughness: 0.3, metalness: 1.0, envMap, envMapIntensity: 1.1 });
  const interiorMat = std({ color: 0x24262c, roughness: 0.92, metalness: 0.05 });
  const dashMat = std({ map: ctex(MAT4.woodV4(seed + 6, { base: '#4a3220', dark: '#2a1a0c', planks: 2 })), roughness: 0.6, metalness: 0.1 });
  const leatherMat = std({ map: FX.grainTexture({ base: '#7a3b26', dark: '#48200f', seed: seed + 1, planks: 3 }), roughness: 0.82, metalness: 0.02 });
  const leatherLtMat = std({ color: 0x9a5136, roughness: 0.85, metalness: 0.02 });
  const seamMat = std({ color: 0x191008, roughness: 0.9, metalness: 0.05 });
  const treadMat = std({ map: ctex(treadCanvas(seed), 4, 1), roughness: 0.94, metalness: 0.0 });
  const sidewallMat = std({ map: ctex(sidewallCanvas(seed)), roughness: 0.92, metalness: 0.0 });
  const fabricMat = std({ map: P.tex(P.weave(seed + 5, [222, 10, 28]), 2, 2), roughness: 0.96, metalness: 0.0 });
  const glassMatCar = MAT4.glassMatV4(envMap, 0.5); // v4 glass: tint gradient + reflection streak
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff6da, transparent: true, opacity: 0.4 });
  const redMat = std({ color: 0xa8232a, roughness: 0.32, metalness: 0.1, envMap, envMapIntensity: 0.8 });

  // ----- ground contact -----
  const shadow = FX.contactShadow(5.1, 2.7, { opacity: 0.8 }); shadow.position.y = 0.012; group.add(shadow);

  // ----- body shell: floor pan, main body, tapered hood, nose, rear deck -----
  bev(group, 4.3, 0.22, 1.78, paintMat, 0, 0.4, 0);                       // floor pan
  bev(group, 4.34, 0.52, 1.84, paintMat, 0, 0.66, 0);                    // main body
  const hood = bev(group, 1.45, 0.3, 1.58, paintMat, 1.32, 0.99, 0); hood.rotation.z = -0.05; // tapered hood
  const nose = bev(group, 0.55, 0.4, 1.52, paintMat, 2.02, 0.76, 0); nose.rotation.z = -0.1;  // sloped nose panel
  bev(group, 1.25, 0.28, 1.7, paintMat, -1.38, 0.97, 0);                 // rear deck
  const cap = put(group, new THREE.CylinderGeometry(0.06, 0.06, 0.025, 12), chromeMat, -1.15, 1.125, 0.45); // fuel cap

  // ----- fenders (half-cylinder shells over each wheel) + running boards -----
  for (const [wx, wz] of [[1.45, 0.84], [1.45, -0.84], [-1.45, 0.84], [-1.45, -0.84]]) {
    const fg = new THREE.CylinderGeometry(0.46, 0.46, 0.32, 18, 1, true, 0, Math.PI);
    fg.rotateZ(Math.PI / 2); fg.rotateY(Math.PI / 2); // axis -> Z, arc -> top half
    put(group, fg, fenderMat, wx, 0.38, Math.sign(wz) * 0.86);
  }
  for (const s of [-1, 1]) bev(group, 1.85, 0.05, 0.26, darkMetalMat, 0, 0.44, s * 1.0, 0.02); // running boards

  // ----- doors: panel + seam lines + chrome trim strip + handle + hinges -----
  for (const s of [-1, 1]) {
    bev(group, 1.35, 0.5, 0.05, paintMat, -0.15, 0.68, s * 0.945, 0.015);
    put(group, new THREE.BoxGeometry(1.39, 0.025, 0.02), seamMat, -0.15, 0.945, s * 0.972);
    put(group, new THREE.BoxGeometry(1.39, 0.025, 0.02), seamMat, -0.15, 0.415, s * 0.972);
    put(group, new THREE.BoxGeometry(0.025, 0.53, 0.02), seamMat, 0.535, 0.68, s * 0.972);
    put(group, new THREE.BoxGeometry(0.025, 0.53, 0.02), seamMat, -0.835, 0.68, s * 0.972);
    put(group, new THREE.BoxGeometry(1.9, 0.045, 0.025), chromeMat, 0.05, 0.56, s * 0.965); // side trim strip
    put(group, new THREE.BoxGeometry(0.22, 0.05, 0.04), chromeMat, 0.22, 0.8, s * 0.985);   // door handle
    for (const hy of [0.55, 0.82]) put(group, new THREE.SphereGeometry(0.022, 8, 6), chromeMat, 0.5, hy, s * 0.97); // hinges
  }

  // ----- cockpit: tub, dashboard with dials, steering, two piped seats -----
  bev(group, 1.75, 0.24, 1.6, interiorMat, -0.25, 0.9, 0);               // cockpit tub
  const dash = bev(group, 0.18, 0.3, 1.52, dashMat, 0.52, 1.03, 0); dash.rotation.z = -0.18;
  const dials = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.24), std({ map: ctex(dialCanvas(seed)), roughness: 0.55, metalness: 0.2, envMap, envMapIntensity: 0.5 }));
  dials.position.set(0.425, 1.05, 0); dials.rotation.y = -Math.PI / 2; dials.receiveShadow = true; group.add(dials);
  for (const s of [-1, 1]) {
    const zz = s * 0.42;
    put(group, new THREE.BoxGeometry(0.55, 0.06, 0.5), interiorMat, -0.28, 0.93, zz);      // seat base
    bev(group, 0.62, 0.16, 0.58, leatherMat, -0.28, 1.02, zz);                             // cushion
    const back = bev(group, 0.16, 0.52, 0.58, leatherMat, -0.6, 1.16, zz); back.rotation.z = 0.16; // backrest
    const head = bev(group, 0.13, 0.18, 0.34, leatherMat, -0.7, 1.48, zz); head.rotation.z = 0.16; // headrest
    put(group, new THREE.BoxGeometry(0.03, 0.035, 0.56), leatherLtMat, 0.02, 1.09, zz);    // cushion piping (front edge)
    put(group, new THREE.BoxGeometry(0.03, 0.48, 0.025), leatherLtMat, -0.6, 1.16, zz - 0.28); // backrest piping
    put(group, new THREE.BoxGeometry(0.03, 0.48, 0.025), leatherLtMat, -0.6, 1.16, zz + 0.28);
  }
  // steering wheel (torus + 3 spokes + hub) on a column, driver's side z = -0.42
  strut(group, [0.34, 0.94, -0.42], [0.18, 1.12, -0.42], 0.025, darkMetalMat);
  const swheel = new THREE.Group(); swheel.position.set(0.16, 1.14, -0.42); swheel.rotation.z = -0.35; group.add(swheel);
  const rim = put(swheel, new THREE.TorusGeometry(0.2, 0.028, 8, 20), std({ color: 0x2a2019, roughness: 0.6 }), 0, 0, 0); rim.rotation.y = Math.PI / 2;
  put(swheel, new THREE.BoxGeometry(0.025, 0.37, 0.045), darkMetalMat, 0, 0, 0);
  put(swheel, new THREE.BoxGeometry(0.025, 0.045, 0.37), darkMetalMat, 0, 0, 0);
  const spoke3 = put(swheel, new THREE.BoxGeometry(0.025, 0.37, 0.045), darkMetalMat, 0, 0, 0); spoke3.rotation.x = 0.8;
  const hubGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10); hubGeo.rotateZ(Math.PI / 2);
  put(swheel, hubGeo, chromeMat, 0, 0, 0);

  // ----- windshield: raked frame + glass + mirrors on the posts -----
  const shield = new THREE.Group(); shield.position.set(0.52, 0.98, 0); shield.rotation.z = 0.32; group.add(shield);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), glassMatCar);
  glass.position.set(0, 0.31, 0); glass.rotation.y = Math.PI / 2; shield.add(glass);
  for (const s of [-1, 1]) put(shield, new THREE.BoxGeometry(0.05, 0.68, 0.05), paintDkMat, 0, 0.31, s * 0.74);
  put(shield, new THREE.BoxGeometry(0.05, 0.06, 1.53), paintDkMat, 0, 0.64, 0);  // top rail
  put(shield, new THREE.BoxGeometry(0.06, 0.07, 1.53), paintDkMat, 0, 0, 0);    // bottom rail
  put(shield, new THREE.BoxGeometry(0.03, 0.62, 0.03), paintDkMat, 0, 0.31, 0); // centre divider
  for (const s of [-1, 1]) { // mirrors: chrome stalk + mirror box + glass face
    strut(group, [0.45, 1.35, s * 0.75], [0.42, 1.48, s * 0.92], 0.018, chromeMat);
    bev(group, 0.05, 0.15, 0.24, chromeMat, 0.42, 1.5, s * 0.95, 0.015);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.11), std({ color: 0xdfe9ee, roughness: 0.08, metalness: 0.9, envMap, envMapIntensity: 1.2 }));
    face.position.set(0.39, 1.5, s * 0.95); face.rotation.y = -Math.PI / 2; group.add(face);
  }

  // ----- folding soft-top on a rear pivot (setRoof: 0 = up, 1 = folded) -----
  const roofPivot = new THREE.Group(); roofPivot.position.set(-0.98, 1.06, 0); group.add(roofPivot);
  bev(roofPivot, 1.85, 0.09, 1.68, fabricMat, 0.72, 0.38, 0, 0.03);      // canopy
  for (const rx of [0.1, 0.72, 1.34]) put(roofPivot, new THREE.BoxGeometry(0.04, 0.02, 1.66), seamMat, rx, 0.435, 0); // canopy seams
  put(roofPivot, new THREE.BoxGeometry(0.06, 0.06, 1.66), darkMetalMat, 1.62, 0.36, 0); // front bow
  for (const s of [-1, 1]) { const st = bev(roofPivot, 0.8, 0.05, 0.05, darkMetalMat, 0.34, 0.18, s * 0.78, 0.02); st.rotation.z = 0.5; } // struts

  // ----- wheels: STEER pivot -> SPIN group (axle along local Z) -----
  const spins = [], steers = [];
  for (const [wx, wz] of [[1.45, 0.84], [1.45, -0.84], [-1.45, 0.84], [-1.45, -0.84]]) {
    const outer = Math.sign(wz);
    const pivot = new THREE.Group(); pivot.position.set(wx, 0.36, wz); group.add(pivot);
    if (wx > 0) steers.push(pivot);
    const spin = new THREE.Group(); pivot.add(spin); spins.push(spin);
    const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 26); tyreGeo.rotateX(Math.PI / 2); // axle -> Z at geometry level
    put(spin, tyreGeo, [treadMat, sidewallMat, sidewallMat], 0, 0, 0);
    const discGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 18); discGeo.rotateX(Math.PI / 2);
    put(spin, discGeo, darkMetalMat, 0, 0, 0);                            // brake disc
    const rimGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.25, 18); rimGeo.rotateX(Math.PI / 2);
    put(spin, rimGeo, rimMat, 0, 0, 0);                                   // rim barrel
    for (let i = 0; i < 5; i++) {                                         // 5 spokes on the outer face
      const a = i / 5 * Math.PI * 2;
      const sp = put(spin, new THREE.BoxGeometry(0.32, 0.065, 0.055), rimMat, Math.cos(a) * 0.08, Math.sin(a) * 0.08, outer * 0.1);
      sp.rotation.z = a;
    }
    const dome = put(spin, new THREE.SphereGeometry(0.085, 12, 8), chromeMat, 0, 0, outer * 0.14); dome.scale.z = 0.65; // hub dome
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; put(spin, new THREE.SphereGeometry(0.018, 6, 5), darkMetalMat, Math.cos(a) * 0.055, Math.sin(a) * 0.055, outer * 0.155); } // lug dots
  }

  // ----- front + rear detail: grille + slats, bumpers, lamps, exhaust, plate -----
  put(group, new THREE.BoxGeometry(0.07, 0.24, 0.92), darkMetalMat, 2.2, 0.55, 0); // grille shell
  for (let i = 0; i < 7; i++) put(group, new THREE.BoxGeometry(0.025, 0.2, 0.045), chromeMat, 2.245, 0.55, -0.36 + i * 0.12); // grille slats
  bev(group, 0.14, 0.13, 1.92, chromeMat, 2.22, 0.34, 0, 0.04);          // front bumper
  bev(group, 0.14, 0.13, 1.92, chromeMat, -2.22, 0.34, 0, 0.04);         // rear bumper
  for (const s of [-1, 1]) put(group, new THREE.BoxGeometry(0.06, 0.18, 0.12), darkMetalMat, 2.3, 0.36, s * 0.6); // bumper guards
  const glowSprites = [];
  for (const s of [-1, 1]) {
    const bucketGeo = new THREE.CylinderGeometry(0.105, 0.118, 0.09, 14); bucketGeo.rotateZ(Math.PI / 2);
    put(group, bucketGeo, chromeMat, 2.16, 0.8, s * 0.62);               // headlight bucket
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.092, 14), lensMat);
    lens.position.set(2.215, 0.8, s * 0.62); lens.rotation.y = Math.PI / 2; group.add(lens);
    const gl = FX.glint(0.42); gl.position.set(2.24, 0.88, s * 0.62); group.add(gl);
    const glow = softGlowSprite(1.15, 0xffd76a); glow.position.set(2.48, 0.8, s * 0.62); group.add(glow); glowSprites.push(glow);
    put(group, new THREE.BoxGeometry(0.03, 0.13, 0.26), chromeMat, -2.17, 0.78, s * 0.66); // taillight rim
    bev(group, 0.06, 0.1, 0.22, redMat, -2.2, 0.78, s * 0.66, 0.02);      // taillight
  }
  const exhGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8); exhGeo.rotateZ(Math.PI / 2);
  put(group, exhGeo, darkMetalMat, -2.26, 0.27, 0.5);                    // exhaust pipe
  const tipGeo = new THREE.CylinderGeometry(0.043, 0.043, 0.05, 8); tipGeo.rotateZ(Math.PI / 2);
  put(group, tipGeo, chromeMat, -2.37, 0.27, 0.5);                       // exhaust tip
  const plateG = FX.numberPlate(plate, { envMap });                      // rear number plate (faces -x)
  plateG.position.set(-2.22, 0.62, 0); plateG.rotation.y = -Math.PI / 2; shadowify(plateG); group.add(plateG);
  const hoodGlint = FX.glint(0.55); hoodGlint.position.set(1.35, 1.22, 0.3); hoodGlint.material.opacity = 0; group.add(hoodGlint);

  // ----- contract -----
  const spinWheels = (rotRad) => { for (const s of spins) s.rotation.z = -rotRad; };
  const steerWheels = (rad) => { for (const p of steers) p.rotation.y = rad; };
  const setRoof = (k) => { const u = THREE.MathUtils.clamp(k, 0, 1); roofPivot.rotation.z = u * 2.85; roofPivot.position.y = 1.06 + 0.18 * u; };
  const setGlow = (k) => { const u = THREE.MathUtils.clamp(k, 0, 1); lensMat.opacity = 0.4 + 0.6 * u; for (const s of glowSprites) s.material.opacity = u * 0.7; };
  const setGlint = (k) => { const u = THREE.MathUtils.clamp(k, 0, 1); hoodGlint.material.opacity = u * 0.95; hoodGlint.scale.setScalar(0.55 + 0.5 * u); };
  setRoof(0); setGlow(0); setGlint(0);
  return {
    group, spinWheels, steerWheels, setRoof, setGlow, setGlint,
    dims: { len: 4.34, wid: 1.84, wheelR: 0.36 },
    collider: { type: 'obb', hx: 2.24, hz: 0.99, h: 1.5 },
  };
}

// ============================================================
// 2. STONE WALL — individual stones in courses over a mortar backing,
// cap stones on top. Jitter is seeded, so the wall is stable per seed.
// ============================================================
export function buildStoneWall(o = {}) {
  const len = o.len ?? 6;
  const h = o.h ?? 1.2;
  const envMap = o.envMap || null;
  const seed = o.seed ?? 11;
  const r = RNG(seed * 733 + 5);
  const group = new THREE.Group(); group.name = 'StoneWall';
  const shadow = FX.contactShadow(len + 0.7, 1.15, { opacity: 0.65 }); shadow.position.y = 0.012; group.add(shadow);
  const mortarMat = std({ color: 0x3c362e, roughness: 1, metalness: 0 });
  put(group, new THREE.BoxGeometry(len, h, 0.46), mortarMat, 0, h / 2, 0); // mortar backing (shows in the gaps)
  const stoneMatA = std({ map: ctex(MAT4.stoneV4(seed, { courses: 5 })), roughness: 0.95, metalness: 0.02, envMap, envMapIntensity: 0.25 });
  const stoneMatB = std({ map: ctex(MAT4.stoneV4(seed + 1, { courses: 5, lig: 51 })), roughness: 0.95, metalness: 0.02, envMap, envMapIntensity: 0.25 });
  bev(group, len + 0.15, 0.16, 0.7, stoneMatA, 0, 0.08, 0, 0.03);          // base plinth course
  const rows = Math.max(2, Math.round(h / 0.3)), courseH = h / rows;
  for (let row = 0; row < rows; row++) {
    let x = -len / 2 - (row % 2 ? 0.3 : 0);
    while (x < len / 2 - 0.25) {
      let wStone = 0.55 + r() * 0.5;
      if (x + wStone > len / 2) wStone = len / 2 - x;
      if (wStone < 0.18) break;
      const st = bev(group, wStone - 0.05, courseH - 0.05, 0.6, (row + Math.round(x * 10)) % 2 ? stoneMatA : stoneMatB,
        x + wStone / 2, row * courseH + courseH / 2, (r() - 0.5) * 0.03, 0.025);
      st.rotation.y = (r() - 0.5) * 0.03; st.rotation.z = (r() - 0.5) * 0.015;
      x += wStone + 0.02;
    }
  }
  const nCap = Math.max(2, Math.ceil(len / 0.85)), wCap = len / nCap;     // cap stones
  for (let i = 0; i < nCap; i++) {
    const cp = bev(group, wCap - 0.06, 0.13, 0.74, i % 2 ? stoneMatB : stoneMatA, -len / 2 + wCap * (i + 0.5), h + 0.065, (r() - 0.5) * 0.02, 0.03);
    cp.rotation.y = (r() - 0.5) * 0.02;
  }
  return { group, collider: { type: 'aabb', hx: len / 2, hz: 0.35, h } };
}

// ============================================================
// 3. HUT — plinth, walls (plaster / planks / stone), gables, pitched
// roof with ridge beam, framed door + windows, stone step.
// Door + main window face +z. Collider height includes the roof.
// ============================================================
export function buildHut(o = {}) {
  const w = o.w ?? 2.9, d = o.d ?? 2.4, h = o.h ?? 1.8;
  const seed = o.seed ?? 15;
  const wall = o.wall || 'plaster';
  const envMap = o.envMap || null;
  const group = new THREE.Group(); group.name = 'Hut';
  const shadow = FX.contactShadow(w + 0.9, d + 1.0, { opacity: 0.65 }); shadow.position.set(0, 0.012, 0.15); group.add(shadow);

  let wallMat;
  if (wall === 'planks') wallMat = std({ map: ctex(MAT4.woodV4(seed, { planks: 6 })), roughness: 0.95, metalness: 0.02 });
  else if (wall === 'stone') wallMat = std({ map: P.tex(P.stone(seed, 36, 10, 55), 2, 1), roughness: 0.95, metalness: 0.02 });
  else wallMat = std({ map: P.tex(P.plaster(seed, 36), 2, 2), roughness: 0.95, metalness: 0.02 });
  const woodMat = std({ map: ctex(MAT4.woodV4(seed + 2, { planks: 3, base: '#6d4c2e', dark: '#402a16' })), roughness: 0.9, metalness: 0.02 });
  const roofMat = std({ map: ctex(MAT4.woodV4(seed + 3, { planks: 6, base: '#a8894f', dark: '#6e5626' })), roughness: 1, metalness: 0 });
  const stoneMat = std({ map: ctex(MAT4.stoneV4(seed + 4, { courses: 3 })), roughness: 0.95, metalness: 0.02, envMap, envMapIntensity: 0.2 });
  const darkGlassMat = std({ color: 0x1c2733, roughness: 0.18, metalness: 0.4, envMap, envMapIntensity: 0.7 });
  const brassMat = std({ color: 0xc9a24d, roughness: 0.3, metalness: 1, envMap, envMapIntensity: 1 });

  bev(group, w + 0.24, 0.18, d + 0.24, stoneMat, 0, 0.09, 0, 0.03);       // foundation plinth
  bev(group, w, h, d, wallMat, 0, h / 2, 0);                              // walls
  for (const sx of [-1, 1]) for (const sz of [-1, 1])                     // corner posts
    bev(group, 0.14, h, 0.14, woodMat, sx * w / 2, h / 2, sz * d / 2, 0.03);

  const roofH = 1.0;
  { // gable triangles (front + back, under the roof)
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, roofH); sh.closePath();
    const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false });
    for (const zz of [d / 2 - 0.08, -d / 2]) { const gm = new THREE.Mesh(gg, wallMat); gm.position.set(0, h, zz); gm.castShadow = true; gm.receiveShadow = true; group.add(gm); }
  }
  const run = d / 2 + 0.35, slopeLen = Math.sqrt(run * run + roofH * roofH) + 0.15, ang = Math.atan2(roofH, run);
  const panelN = bev(group, w + 0.55, 0.09, slopeLen, roofMat, 0, h + roofH / 2 + 0.05, -run / 2, 0.03); panelN.rotation.x = -ang;
  const panelS = bev(group, w + 0.55, 0.09, slopeLen, roofMat, 0, h + roofH / 2 + 0.05, run / 2, 0.03); panelS.rotation.x = ang;
  const ridgeGeo = new THREE.CylinderGeometry(0.06, 0.06, w + 0.6, 8); ridgeGeo.rotateZ(Math.PI / 2);
  put(group, ridgeGeo, woodMat, 0, h + roofH + 0.06, 0);                  // ridge beam

  // door (+z face): frame posts + lintel, plank door, knob, hinges
  for (const s of [-1, 1]) bev(group, 0.09, 1.3, 0.09, woodMat, s * 0.4, 0.65, d / 2 + 0.03, 0.02);
  bev(group, 0.89, 0.09, 0.09, woodMat, 0, 1.32, d / 2 + 0.03, 0.02);
  bev(group, 0.7, 1.24, 0.07, woodMat, 0, 0.62, d / 2 + 0.045, 0.015);
  for (const lx of [-0.12, 0.12]) put(group, new THREE.BoxGeometry(0.025, 1.18, 0.015), std({ color: 0x2a1a0c, roughness: 0.9 }), lx, 0.62, d / 2 + 0.085); // door plank seams
  put(group, new THREE.SphereGeometry(0.035, 8, 6), brassMat, 0.24, 0.65, d / 2 + 0.1); // knob
  for (const hy of [0.35, 0.95]) put(group, new THREE.BoxGeometry(0.14, 0.05, 0.02), darkMetalish(), -0.28, hy, d / 2 + 0.085); // hinges
  function darkMetalish() { return std({ color: 0x2e3134, roughness: 0.5, metalness: 0.8, envMap, envMapIntensity: 0.5 }); }

  // front window: frame + dark glass inset + mullion cross + sill
  bev(group, 0.62, 0.62, 0.07, woodMat, -0.85, 1.15, d / 2 + 0.02, 0.02);
  const winGlass = put(group, new THREE.BoxGeometry(0.48, 0.48, 0.03), darkGlassMat, -0.85, 1.15, d / 2 + 0.05); winGlass.castShadow = false;
  put(group, new THREE.BoxGeometry(0.04, 0.48, 0.02), woodMat, -0.85, 1.15, d / 2 + 0.075);
  put(group, new THREE.BoxGeometry(0.48, 0.04, 0.02), woodMat, -0.85, 1.15, d / 2 + 0.075);
  bev(group, 0.7, 0.07, 0.14, woodMat, -0.85, 0.8, d / 2 + 0.05, 0.02);    // sill
  // side window (+x face)
  bev(group, 0.07, 0.62, 0.62, woodMat, w / 2 + 0.02, 1.15, 0, 0.02);
  const winGlass2 = put(group, new THREE.BoxGeometry(0.03, 0.48, 0.48), darkGlassMat, w / 2 + 0.05, 1.15, 0); winGlass2.castShadow = false;
  put(group, new THREE.BoxGeometry(0.02, 0.48, 0.04), woodMat, w / 2 + 0.075, 1.15, 0);
  put(group, new THREE.BoxGeometry(0.02, 0.04, 0.48), woodMat, w / 2 + 0.075, 1.15, 0);

  bev(group, 0.95, 0.15, 0.42, stoneMat, 0, 0.075, d / 2 + 0.28, 0.03);   // stone step
  return { group, collider: { type: 'aabb', hx: w / 2, hz: d / 2, h: h + 1.2 } };
}

// ============================================================
// 4. PALM — trunk of segments laid END-TO-END along a bending
// direction (the v1 fix: stacked offsets zigzagged apart), ring
// texture, 7 fronds, 3 coconuts, a skirt of dead fronds.
// ============================================================
export function buildPalm(o = {}) {
  const h = o.h ?? 4.1;
  const seed = o.seed ?? 13;
  const lean = o.lean ?? 0.16;
  const r = RNG(seed * 389 + 7);
  const s = h / 4.1;
  const group = new THREE.Group(); group.name = 'Palm';
  group.rotation.y = r() * Math.PI * 2; // seeded facing — lean direction varies per palm
  const shadow = FX.contactShadow(1.7 * s, 1.7 * s, { opacity: 0.55 }); shadow.position.y = 0.012; group.add(shadow);
  const trunkMat = std({ map: P.tex(ringCanvas(seed), 1, 1), roughness: 0.95, metalness: 0 });
  const leafMatA = std({ color: 0x4a7a34, roughness: 0.9, metalness: 0 });
  const leafMatB = std({ color: 0x5d9042, roughness: 0.9, metalness: 0 });
  const deadMat = std({ color: 0x8a6f3a, roughness: 1, metalness: 0 });
  const nutMat = std({ color: 0x7a5a30, roughness: 0.85, metalness: 0 });

  put(group, new THREE.CylinderGeometry(0.2 * s, 0.27 * s, 0.28, 9), trunkMat, 0, 0.1, 0); // root flare
  const p = new THREE.Vector3(0, 0, 0), dir = new THREE.Vector3(0, 1, 0);
  const leanV = new THREE.Vector3(lean, 0, lean * 0.45);
  const N = 6, segLen = (h * 1.05) / N;
  for (let i = 0; i < N; i++) {
    const rBot = (0.175 - i * 0.013) * s, rTop = (0.162 - i * 0.013) * s;
    const seg = put(group, new THREE.CylinderGeometry(rTop, rBot, segLen, 8), trunkMat, 0, 0, 0);
    seg.position.copy(p).addScaledVector(dir, segLen / 2);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    p.addScaledVector(dir, segLen);
    dir.addScaledVector(leanV, 0.34).normalize();
  }
  // crown: 7 fronds (flattened cones, two greens) + dead-frond skirt + coconuts
  for (let i = 0; i < 7; i++) {
    const fr = new THREE.Group(); fr.position.set(p.x, p.y + 0.1 * s, p.z); fr.rotation.y = i / 7 * Math.PI * 2 + r() * 0.3; group.add(fr);
    const leaf = put(fr, new THREE.ConeGeometry(0.17 * s, 2.1 * s, 4), i % 2 ? leafMatA : leafMatB, 0.9 * s, -0.2 * s, 0);
    leaf.rotation.z = -1.95; leaf.scale.z = 0.22;
  }
  for (let i = 0; i < 3; i++) {
    const fr = new THREE.Group(); fr.position.set(p.x, p.y - 0.05 * s, p.z); fr.rotation.y = i / 3 * Math.PI * 2 + 0.6; group.add(fr);
    const leaf = put(fr, new THREE.ConeGeometry(0.13 * s, 1.1 * s, 4), deadMat, 0.42 * s, -0.3 * s, 0);
    leaf.rotation.z = -2.55; leaf.scale.z = 0.25;
  }
  for (let i = 0; i < 3; i++)
    put(group, new THREE.SphereGeometry(0.105 * s, 9, 7), nutMat, p.x + Math.cos(i * 2.2) * 0.16 * s, p.y - 0.06 * s, p.z + Math.sin(i * 2.2) * 0.16 * s);
  return { group, collider: { type: 'circle', r: 0.22, h } };
}

// ============================================================
// 5. COCONUT CART — plank bed + side/end rails on corner posts, two
// spoked wheels on an axle, support legs, pull handles with a cross
// bar, a pile of 9 coconuts and a thatch shade on a pole.
// Forward = +x (handles), wheels at z ±0.60, bed top y ≈ 0.73.
// ============================================================
export function buildCart(o = {}) {
  const envMap = o.envMap || null;
  const seed = o.seed ?? 19;
  const group = new THREE.Group(); group.name = 'CoconutCart';
  const shadow = FX.contactShadow(2.4, 1.7, { opacity: 0.6 }); shadow.position.set(0.25, 0.012, 0); group.add(shadow);
  const woodMat = std({ map: ctex(MAT4.woodV4(seed, { planks: 4 })), roughness: 0.92, metalness: 0.02 });
  const woodDkMat = std({ map: ctex(MAT4.woodV4(seed + 2, { planks: 3, base: '#6d4c2e', dark: '#402a16' })), roughness: 0.9, metalness: 0.02 });
  const seamMat = std({ color: 0x2a1a0c, roughness: 0.95, metalness: 0 });
  const thatchMat = std({ map: P.tex(P.weave(seed + 3, [38, 38, 42]), 2, 2), roughness: 1, metalness: 0 });
  const nutMatA = std({ color: 0x6a7a3a, roughness: 0.8, metalness: 0 });
  const nutMatB = std({ color: 0x7a5a30, roughness: 0.8, metalness: 0 });
  const wheelMat = std({ map: ctex(MAT4.woodV4(seed + 4, { planks: 3, base: '#5d4126', dark: '#33220f' })), roughness: 0.85, metalness: 0.05, envMap, envMapIntensity: 0.3 });
  const hubMat = std({ color: 0x9a7c34, roughness: 0.35, metalness: 1, envMap, envMapIntensity: 1 });

  bev(group, 1.7, 0.13, 1.05, woodMat, 0, 0.66, 0, 0.03);                 // plank bed
  for (const lz of [-0.25, 0, 0.25]) put(group, new THREE.BoxGeometry(1.68, 0.014, 0.02), seamMat, 0, 0.73, lz); // bed slat seams
  for (const s of [-1, 1]) bev(group, 1.7, 0.3, 0.06, woodDkMat, 0, 0.5, s * 0.52, 0.02);  // side rails
  for (const s of [-1, 1]) bev(group, 0.06, 0.3, 1.05, woodDkMat, s * 0.82, 0.5, 0, 0.02); // end rails
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bev(group, 0.07, 0.42, 0.07, woodDkMat, sx * 0.8, 0.52, sz * 0.5, 0.02); // corner posts

  const axleGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.25, 8); axleGeo.rotateX(Math.PI / 2);
  put(group, axleGeo, woodDkMat, 0, 0.44, 0);                             // axle
  for (const s of [-1, 1]) {
    const wheel = FX.spokedWheel(0.44, { mat: wheelMat, hubMat, spokes: 6, envMap });
    wheel.position.set(0, 0.44, s * 0.6); shadowify(wheel); group.add(wheel);
  }
  for (const s of [-1, 1]) strut(group, [-0.65, 0.6, s * 0.32], [-0.88, 0.02, s * 0.38], 0.035, woodDkMat); // rear support legs
  for (const s of [-1, 1]) {
    strut(group, [0.8, 0.64, s * 0.34], [1.68, 0.3, s * 0.4], 0.032, woodMat);   // pull handles
    strut(group, [1.05, 0.55, s * 0.36], [1.12, 0.02, s * 0.37], 0.03, woodDkMat); // front support legs
  }
  strut(group, [1.68, 0.3, -0.4], [1.68, 0.3, 0.4], 0.028, woodMat);      // handle cross bar

  for (let i = 0; i < 9; i++) {                                           // the coconut pile
    const a = i / 9 * Math.PI * 2, rr = 0.32 * (i % 3 === 2 ? 0.4 : 1);
    put(group, new THREE.SphereGeometry(0.115, 10, 8), i % 2 ? nutMatA : nutMatB,
      Math.cos(a) * rr, 0.84 + (i % 3 === 2 ? 0.16 : 0), Math.sin(a) * rr * 0.6);
  }
  put(group, new THREE.CylinderGeometry(0.04, 0.045, 1.15, 7), woodDkMat, -0.6, 1.28, 0); // shade pole
  const shade = put(group, new THREE.ConeGeometry(1.15, 0.35, 9), thatchMat, -0.6, 1.92, 0); shade.scale.z = 0.7; // thatch shade
  return { group, collider: { type: 'obb', hx: 0.95, hz: 0.62, h: 1.1 } };
}

// ============================================================
// 6. CLIFF ROCKS — flattened dodecahedrons with stone texture,
// seeded rotation, one circle collider per rock (group origin = 0,
// dx/dz carry each rock's local offset). Pebble scatter has no
// colliders. Default cluster echoes the v1 Eagle Cliff stack.
// ============================================================
export function buildCliffRocks(o = {}) {
  const seed = o.seed ?? 23;
  const r = RNG(seed * 521 + 17);
  const rocks = o.rocks || [
    { x: 0, z: -1.5, s: 1.6 }, { x: 1.5, z: 1.0, s: 1.9 }, { x: -2.2, z: 1.8, s: 1.1 },
    { x: 2.6, z: -2.6, s: 1.4 }, { x: 0.9, z: -0.2, s: 1.2 }, { x: -3.4, z: -3.0, s: 0.9 },
  ];
  const group = new THREE.Group(); group.name = 'CliffRocks';
  const rockMatA = std({ map: P.tex(P.stone(seed, 30, 10, 46), 2, 2), roughness: 0.97, metalness: 0.01 });
  const rockMatB = std({ map: P.tex(P.stone(seed + 3, 30, 10, 38), 2, 2), roughness: 0.97, metalness: 0.01 });
  const colliders = [];
  rocks.forEach((rk, i) => {
    const sh = FX.contactShadow(rk.s * 2.3, rk.s * 2.3, { opacity: 0.55 }); sh.position.set(rk.x, 0.012, rk.z); group.add(sh);
    const m = put(group, new THREE.DodecahedronGeometry(rk.s, 0), i % 2 ? rockMatB : rockMatA, rk.x, rk.s * 0.52, rk.z);
    m.scale.y = 0.75;
    m.rotation.set(r() * 0.9, r() * Math.PI * 2, r() * 0.6);
    colliders.push({ type: 'circle', dx: rk.x, dz: rk.z, r: rk.s * 0.95, h: rk.s * 1.12 });
  });
  for (let i = 0; i < 6; i++) { // pebble scatter (no colliders)
    const a = r() * Math.PI * 2, dist = 3 + r() * 1.6, ps = 0.12 + r() * 0.18;
    const m = put(group, new THREE.DodecahedronGeometry(ps, 0), i % 2 ? rockMatA : rockMatB, Math.cos(a) * dist, ps * 0.4, Math.sin(a) * dist);
    m.scale.y = 0.7; m.rotation.set(r() * 3, r() * 3, r() * 3);
  }
  return { group, colliders };
}

// ============================================================
// 7. TURTLE — domed hex-scute shell, rim, plastron, neck + head with
// eyes and an animatable mouth, four flipper pivots, a tail.
// setYawn(k): mouth opens (scale.y 0.25 -> 1.75, the v1 recipe) and
// the head dips as it opens. Flippers carry userData.ph phase offsets.
// ============================================================
export function buildTurtle(o = {}) {
  const seed = o.seed ?? 29;
  const group = new THREE.Group(); group.name = 'Turtle'; group.rotation.order = 'YXZ';
  const shadow = FX.contactShadow(1.8, 1.6, { opacity: 0.75 }); shadow.position.y = 0.012; group.add(shadow);
  const shellMat = std({ map: ctex(shellCanvas(seed)), roughness: 0.65, metalness: 0.05 });
  const shellDkMat = std({ color: 0x4c5a2c, roughness: 0.8, metalness: 0.02 });
  const plastronMat = std({ color: 0xb9ac7d, roughness: 0.9, metalness: 0 });
  const skinMat = std({ map: ctex(skinCanvas(seed)), roughness: 0.85, metalness: 0 });
  const darkMat = std({ color: 0x22201a, roughness: 0.5, metalness: 0.05 });

  const shell = put(group, new THREE.SphereGeometry(0.62, 22, 15), shellMat, 0, 0.4, 0);
  shell.scale.set(1.18, 0.55, 0.98);                                      // domed shell
  const rim = put(group, new THREE.TorusGeometry(0.6, 0.085, 8, 24), shellDkMat, 0, 0.29, 0);
  rim.rotation.x = Math.PI / 2; rim.scale.set(1.18, 0.98, 1);             // shell rim
  const plas = put(group, new THREE.CylinderGeometry(0.56, 0.63, 0.16, 18), plastronMat, 0, 0.22, 0);
  plas.scale.set(1.15, 1, 0.95);                                          // plastron (belly plate)
  for (let i = 0; i < 5; i++) {                                           // spine scute bumps along the dome
    const bx = -0.36 + i * 0.18;
    const bump = put(group, new THREE.SphereGeometry(0.075, 8, 6), shellDkMat, bx, 0.4 + Math.sqrt(Math.max(0, 1 - (bx / 0.73) * (bx / 0.73))) * 0.33, 0);
    bump.scale.set(1.2, 0.5, 0.9);
  }
  const tail = put(group, new THREE.ConeGeometry(0.06, 0.22, 7), skinMat, -0.74, 0.26, 0); tail.rotation.z = 1.25;

  // head group on a neck
  const head = new THREE.Group(); head.position.set(0.62, 0.4, 0); group.add(head);
  const neck = put(head, new THREE.CylinderGeometry(0.085, 0.1, 0.32, 9), skinMat, 0.1, -0.03, 0); neck.rotation.z = -1.15;
  const skull = put(head, new THREE.SphereGeometry(0.135, 13, 10), skinMat, 0.27, 0.02, 0); skull.scale.set(1.15, 0.9, 0.9);
  for (const s of [-1, 1]) put(head, new THREE.SphereGeometry(0.021, 7, 6), darkMat, 0.345, 0.075, s * 0.078); // eyes
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: 0x2c2418 }));
  mouth.position.set(0.395, -0.035, 0); mouth.rotation.y = Math.PI / 2; head.add(mouth);

  // four flipper pivots (v1 positions + phase offsets)
  const flippers = [];
  for (const [fx, fz, ph] of [[0.4, 0.52, 0], [0.4, -0.52, Math.PI], [-0.42, 0.48, Math.PI], [-0.42, -0.48, 0]]) {
    const fg = new THREE.Group(); fg.position.set(fx, 0.15, fz); fg.userData.ph = ph; group.add(fg);
    bev(fg, 0.37, 0.07, 0.23, shellDkMat, 0.1, -0.03, fz > 0 ? 0.08 : -0.08, 0.025);
    flippers.push(fg);
  }

  const setYawn = (k) => {
    const u = THREE.MathUtils.clamp(k, 0, 1);
    mouth.scale.set(1, 0.25 + u * 1.5, 1);
    head.rotation.z = -0.06 - u * 0.22;
  };
  setYawn(0);
  return {
    group, head, mouth, flippers, setYawn,
    dims: { len: 1.8, wid: 1.24, shellR: 0.62 },
    collider: { type: 'circle', r: 0.78, h: 0.75 },
  };
}
