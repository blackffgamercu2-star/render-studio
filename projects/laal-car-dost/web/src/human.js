import * as THREE from 'three';
import { canvasTex, rng } from './common.js';

// ============================================================================
// HUMAN v2 — construction/gait rules learned from wolffe three.js-skills
// (MIT) character-model + character-walking, re-implemented for WebGL:
//  * dimensions first as real-metre constants (also open-3d-skills workflow)
//  * joints are Groups; limb meshes hang BELOW the joint so rotation swings
//    them from the top (character-model's core structure)
//  * gait phase advances with DISTANCE TRAVELLED (constant stride length),
//    not with raw time: phase = distance * (2pi / strideLength)
//  * swing amplitude scales with speed: amp = 0.85 * min(1, speed/runSpeed)
//  * arms and legs in opposite phase; the TRAILING leg gets extra knee bend
//    (up to +0.45 rad in their model) so the foot clears the ground
//  * horizontal speed is SET, never accelerated (character-walking rule 1)
// Torso is a LATHE profile (open-3d-skills kit.js lathe pattern, MIT) instead
// of v1's barrel capsule; shirt carries a canvas-drawn knit texture
// (open-3d canvasTex pattern).
// ============================================================================
const DIM = { height: 1.78, legLen: 0.86, hipY: 0.99, shoulderY: 1.47, headR: 0.112, stride: 1.5, runSpeed: 3.8 };

function knitTexture(base = '#f2f2f2') {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 1.6, 1);
    }
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,0.045)'; g.fillRect(0, y, w, 1); }
  }, { repeat: [3, 3] });
}

export function buildHuman(opts = {}) {
  const knit = knitTexture();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.58, metalness: 0.0 });
  const skinShade = new THREE.MeshStandardMaterial({ color: 0xb87a4e, roughness: 0.68 });
  const shirt = new THREE.MeshStandardMaterial({ color: opts.shirt || 0x2e6db4, roughness: 0.94, map: knit, bumpMap: knit, bumpScale: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants || 0x35424e, roughness: 0.9, map: knit, bumpMap: knit, bumpScale: 0.4 });
  const shoeM = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.55 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.5 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12 });
  const irisM = new THREE.MeshStandardMaterial({ color: 0x3a2413, roughness: 0.08 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.08 });
  const lipM = new THREE.MeshStandardMaterial({ color: 0x9c4a3c, roughness: 0.55 });

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const HIPS_Y = DIM.hipY;

  function capsule(r, len, mat) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
    m.castShadow = true; return m;
  }
  function ball(r, mat, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
    m.scale.set(sx, sy, sz); m.castShadow = true; return m;
  }

  // ---- pelvis + torso: lathe profile (hips -> waist -> chest -> neck) ----
  const pelvis = ball(0.145, pants, 1.12, 0.78, 0.86); pelvis.position.y = HIPS_Y; body.add(pelvis);
  const torso = new THREE.Group(); torso.position.y = HIPS_Y + 0.02; body.add(torso);
  const profile = [
    [0.02, 0.00], [0.128, 0.01], [0.152, 0.08], [0.138, 0.17], [0.118, 0.25],
    [0.128, 0.33], [0.152, 0.41], [0.148, 0.47], [0.105, 0.52], [0.055, 0.55]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const chest = new THREE.Mesh(new THREE.LatheGeometry(profile, 22), shirt);
  chest.scale.set(1.16, 1, 0.80); chest.castShadow = true; torso.add(chest);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.015, 8, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: knit }));
  collar.rotation.x = Math.PI / 2 - 0.2; collar.position.set(0, 0.545, 0.004); torso.add(collar);

  // ---- neck + head (face construction carried from v1, it eye-checked well) ----
  const neckG = new THREE.Group(); neckG.position.y = 0.55; torso.add(neckG);
  const neck = capsule(0.045, 0.05, skinShade); neck.position.y = 0.03; neckG.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.075; neckG.add(headG);
  const skull = ball(0.112, skin, 0.94, 1.12, 0.98); skull.position.y = 0.115; headG.add(skull);
  const jaw = ball(0.088, skin, 0.92, 0.82, 0.9); jaw.position.set(0, 0.035, 0.012); headG.add(jaw);
  const chin = ball(0.027, skin); chin.position.set(0, 0.0, 0.066); headG.add(chin);
  for (const s of [-1, 1]) { const e = ball(0.026, skinShade, 0.5, 1, 0.75); e.position.set(s * 0.104, 0.10, 0); headG.add(e); }
  const nose = capsule(0.016, 0.028, skin); nose.rotation.x = Math.PI / 2 - 0.35; nose.position.set(0, 0.088, 0.115); headG.add(nose);
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * 0.043, 0.128, 0.098); headG.add(eg);
    eg.add(ball(0.0175, whiteM, 1, 0.82, 0.55));
    const iris = ball(0.0095, irisM, 1, 1, 0.4); iris.position.z = 0.0085; eg.add(iris);
    const pup = ball(0.0048, darkM, 1, 1, 0.4); pup.position.z = 0.0125; eg.add(pup);
    const glint = ball(0.0028, whiteM); glint.position.set(0.004, 0.005, 0.015); eg.add(glint);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.008, 0.01), hairM);
    brow.position.set(s * 0.001, 0.026, 0.006); brow.rotation.z = -s * 0.10; brow.castShadow = true; eg.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.006, 8, 18, Math.PI * 0.85), lipM);
  mouth.position.set(0, 0.038, 0.102); mouth.rotation.z = Math.PI + Math.PI * 0.075; mouth.rotation.x = -0.15; headG.add(mouth);
  const lipLow = ball(0.016, lipM, 1.1, 0.4, 0.5); lipLow.position.set(0, 0.020, 0.096); headG.add(lipLow);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.121, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM);
  hairCap.scale.set(0.97, 1.13, 1.0); hairCap.position.set(0, 0.125, -0.008); hairCap.rotation.x = -0.22; hairCap.castShadow = true; headG.add(hairCap);
  const hairBack = ball(0.105, hairM, 0.95, 1.02, 0.95); hairBack.position.set(0, 0.128, -0.032); headG.add(hairBack);
  for (let i = -2; i <= 2; i++) { const f = ball(0.015, hairM, 1, 1.4, 0.7); f.position.set(i * 0.032, 0.212, 0.088 - Math.abs(i) * 0.008); headG.add(f); }

  // ---- arms: shoulder Group, meshes hang below (character-model structure) ----
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(side * 0.205, 0.475, 0); torso.add(sh);
    const pad = ball(0.066, shirt); sh.add(pad);
    const up = capsule(0.047, 0.19, shirt); up.position.y = -0.145; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    const fo = capsule(0.040, 0.18, skin); fo.position.y = -0.135; el.add(fo);
    const sleeve = capsule(0.05, 0.03, shirt); sleeve.position.y = -0.03; el.add(sleeve);
    const hand = ball(0.040, skin, 0.78, 1.1, 0.9); hand.position.y = -0.295; el.add(hand);
    // fingers: 4 small capsules + thumb (new in v2 — v1 hands were plain balls)
    for (let f = 0; f < 4; f++) {
      const fg = capsule(0.0075, 0.028, skin);
      fg.position.set(-0.020 + f * 0.0135, -0.345, 0.004); el.add(fg);
    }
    const thumb = capsule(0.008, 0.02, skin);
    thumb.position.set(-side * 0.034, -0.315, 0.012); thumb.rotation.z = side * 0.7; el.add(thumb);
    return { sh, el };
  }
  const armL = arm(-1), armR = arm(1);

  // ---- legs: hip Group -> thigh hangs below -> knee Group -> shin ----
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.092, HIPS_Y - 0.01, 0); body.add(hip);
    const th = capsule(0.066, 0.30, pants); th.position.y = -0.215; hip.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    const sh2 = capsule(0.048, 0.29, pants); sh2.position.y = -0.20; knee.add(sh2);
    const sock = capsule(0.042, 0.03, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.9 })); sock.position.y = -0.375; knee.add(sock);
    const foot = new THREE.Group(); foot.position.y = -0.435; knee.add(foot);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.055, 0.225), shoeM);
    shoe.position.set(0, -0.028, 0.045); shoe.castShadow = true; foot.add(shoe);
    const toe = ball(0.042, shoeM, 1, 0.62, 1); toe.position.set(0, -0.032, 0.14); foot.add(toe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.26), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
    sole.position.set(0, -0.052, 0.05); foot.add(sole);
    return { hip, knee, foot };
  }
  const legL = leg(-1), legR = leg(1);

  // Gait (character-model rules): phase from distance, amplitude from speed,
  // trailing-leg knee clearance, arms counter-phase, two bobs per cycle.
  function update(t, speed = 1.35) {
    const phase = t * speed * (Math.PI * 2 / DIM.stride);
    const amp = 0.85 * Math.min(1, speed / DIM.runSpeed) + 0.12;
    const sL = Math.sin(phase), sR = Math.sin(phase + Math.PI);
    legL.hip.rotation.x = sL * amp * 0.72; legR.hip.rotation.x = sR * amp * 0.72;
    const kneeFor = (ph) => {
      const swing = Math.pow(Math.max(0, Math.sin(ph - 0.7)), 1.6) * 0.95;       // swing-through bend
      const trail = Math.max(0, -Math.sin(ph - 0.25)) * 0.38;                    // trailing clearance (their +0.45 rule, scaled)
      return 0.04 + swing + trail;
    };
    legL.knee.rotation.x = kneeFor(phase); legR.knee.rotation.x = kneeFor(phase + Math.PI);
    legL.foot.rotation.x = -legL.hip.rotation.x * 0.5 - legL.knee.rotation.x * 0.30 + Math.sin(phase) * 0.10;
    legR.foot.rotation.x = -legR.hip.rotation.x * 0.5 - legR.knee.rotation.x * 0.30 + Math.sin(phase + Math.PI) * 0.10;
    armL.sh.rotation.x = sR * amp * 0.62; armR.sh.rotation.x = sL * amp * 0.62;
    armL.sh.rotation.z = 0.07; armR.sh.rotation.z = -0.07;
    armL.el.rotation.x = -0.30 - Math.max(0, sL) * 0.22; armR.el.rotation.x = -0.30 - Math.max(0, sR) * 0.22;
    body.position.y = Math.abs(Math.sin(phase)) * 0.030;
    body.rotation.z = Math.sin(phase) * 0.032; body.rotation.y = Math.sin(phase) * 0.055;
    torso.rotation.x = 0.07 + Math.sin(phase * 2) * 0.010;
    headG.rotation.y = Math.sin(phase * 0.5) * 0.05; headG.rotation.x = -Math.abs(Math.sin(phase)) * 0.03;
    neckG.rotation.z = -Math.sin(phase) * 0.02;
  }
  update(0);
  return { group: root, update };
}
