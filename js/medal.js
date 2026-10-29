// Gold medal hanging from a satin ribbon, simulated with position-based (Verlet) physics.
// The ribbon is a cloth grid pinned above the frame; the medal is a rigid body built from
// weighted particles (mass placed for a disc's moment of inertia) and coupled two-way to
// the ribbon through the bail. Hover brushes it, a mouse drag lets you swing it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// scale: 1 unit â‰ˆ 2.2 cm, so a 7 cm medal has R = 1.6 and gravity is 9.8 m/sÂ² â‰ˆ 445 u/sÂ²
const R = 1.6, THICK = 0.2;
const G = 445;
const RIB_W = 1.1, RIB_LEN = 4.6, COLS = 7, ROWS = 26;
const BAR_Y = R + 0.55;          // bail bar height above the medal centre (medal space)
const H = 1 / 240, ITER = 12;    // fixed sub-step and solver iterations
const RIBBON_MASS = 10, MEDAL_MASS = 60; // grams: a satin lanyard vs a solid medal

function faceTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const cx = S / 2;

  // base: brushed radial gold
  const g = x.createRadialGradient(cx * 0.8, cx * 0.7, 40, cx, cx, cx);
  g.addColorStop(0, '#fff1b8'); g.addColorStop(0.45, '#e8b84a'); g.addColorStop(1, '#9c6b12');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    x.strokeStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    x.beginPath(); x.arc(cx, cx, Math.random() * cx, 0, Math.PI * 2); x.stroke();
  }

  const engrave = (draw) => {
    x.save(); x.translate(3, 4); x.fillStyle = 'rgba(80,50,0,.55)'; x.strokeStyle = 'rgba(80,50,0,.55)'; draw(); x.restore();
    x.save(); x.fillStyle = '#ffe9a3'; x.strokeStyle = '#ffe9a3'; draw(); x.restore();
  };

  // rims
  engrave(() => { x.lineWidth = 14; x.beginPath(); x.arc(cx, cx, cx - 40, 0, Math.PI * 2); x.stroke(); });
  engrave(() => { x.lineWidth = 4; x.beginPath(); x.arc(cx, cx, cx - 170, 0, Math.PI * 2); x.stroke(); });

  // circular text
  const ring = '  DATA SCIENCE USING PYTHON  âœ¦  MICROSOFT PARTNER PROGRAM  âœ¦';
  x.font = '600 46px "JetBrains Mono", monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const rr = cx - 105;
  const step = (Math.PI * 2) / ring.length;
  engrave(() => {
    for (let i = 0; i < ring.length; i++) {
      x.save();
      x.translate(cx, cx);
      x.rotate(i * step - Math.PI / 2);
      x.translate(0, -rr);
      x.fillText(ring[i], 0, 0);
      x.restore();
    }
  });

  // star
  const star = (r1, r2, y) => {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? r2 : r1, a = (i * Math.PI) / 5 - Math.PI / 2;
      x.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    x.closePath(); x.fill();
  };
  engrave(() => star(70, 30, cx - 170));

  engrave(() => {
    x.font = '900 230px "Big Shoulders Display", Impact, sans-serif';
    x.fillText('GOLD', cx, cx + 10);
    x.font = '600 52px "JetBrains Mono", monospace';
    x.fillText('MOHD AADIL', cx, cx + 175);
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// satin ribbon: lime body, dark centre stripe, cream pinstripes, gold selvedge
function ribbonTexture() {
  const W = 512, Hh = 512, c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const x = c.getContext('2d');
  const band = (a, b, col) => { x.fillStyle = col; x.fillRect(a * W, 0, (b - a) * W, Hh); };
  band(0, 1, '#b30d14');
  band(0, 0.05, '#b8871f'); band(0.95, 1, '#b8871f');
  band(0.05, 0.065, '#f2f1e9'); band(0.935, 0.95, '#f2f1e9');
  band(0.36, 0.64, '#151810');
  band(0.385, 0.395, '#f2f1e9'); band(0.605, 0.615, '#f2f1e9');
  band(0.47, 0.53, '#ff1e27');
  // fine lengthwise fibre variation
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    x.fillRect(Math.random() * W, Math.random() * Hh, 1, 6 + Math.random() * 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// satin weave normal map: long warp floats with staggered weft tie-downs
function weaveNormal() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S);
  const h = (i, j) => {
    i = (i + S) % S; j = (j + S) % S;
    const col = Math.floor(i / 4), rowPos = (j + col * 5) % 16;
    const thread = Math.sin(((i % 4) / 4) * Math.PI);           // rounded warp threads
    const tie = rowPos < 3 ? Math.sin((rowPos / 3) * Math.PI) : 0; // weft dips
    return thread * 0.8 - tie * 0.6;
  };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const nx = (h(i - 1, j) - h(i + 1, j)) * 1.5, ny = (h(i, j - 1) - h(i, j + 1)) * 1.5;
    const len = Math.hypot(nx, ny, 1);
    const k = (j * S + i) * 4;
    img.data[k] = ((nx / len) * 0.5 + 0.5) * 255;
    img.data[k + 1] = ((ny / len) * 0.5 + 0.5) * 255;
    img.data[k + 2] = ((1 / len) * 0.5 + 0.5) * 255;
    img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------------------------------------------------------
   Particle system
   --------------------------------------------------------- */
class Sim {
  constructor(n) {
    this.n = n;
    this.x = new Float32Array(n * 3);
    this.p = new Float32Array(n * 3);
    this.w = new Float32Array(n);       // inverse mass
    this.damp = new Float32Array(n);
    this.c = [];                        // [i, j, rest, stiffness, isTether]
  }
  set(i, v, mass, damp) {
    this.x.set([v.x, v.y, v.z], i * 3);
    this.p.set([v.x, v.y, v.z], i * 3);
    this.w[i] = mass > 0 ? 1 / mass : 0;
    this.damp[i] = damp;
  }
  get(i, out) { return out.set(this.x[i * 3], this.x[i * 3 + 1], this.x[i * 3 + 2]); }
  dist(i, j) {
    const a = i * 3, b = j * 3;
    return Math.hypot(this.x[b] - this.x[a], this.x[b + 1] - this.x[a + 1], this.x[b + 2] - this.x[a + 2]);
  }
  link(i, j, stiffness = 1, tether = false, rest = this.dist(i, j)) {
    this.c.push([i, j, rest, stiffness, tether]);
  }
  integrate(h, accel) {
    const { x, p, w, damp } = this;
    const h2 = h * h;
    for (let i = 0; i < this.n; i++) {
      if (w[i] === 0) continue;
      const k = i * 3, d = damp[i];
      const a = accel(i);
      for (let e = 0; e < 3; e++) {
        const cur = x[k + e];
        x[k + e] = cur + (cur - p[k + e]) * d + a[e] * h2;
        p[k + e] = cur;
      }
    }
  }
  solve() {
    const { x, w } = this;
    for (const [i, j, rest, s, tether] of this.c) {
      const a = i * 3, b = j * 3;
      const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 1e-7 || (tether && d <= rest)) continue;
      const ws = w[i] + w[j];
      if (ws === 0) continue;
      const k = ((d - rest) / (d * ws)) * s;
      x[a] += dx * k * w[i]; x[a + 1] += dy * k * w[i]; x[a + 2] += dz * k * w[i];
      x[b] -= dx * k * w[j]; x[b + 1] -= dy * k * w[j]; x[b + 2] -= dz * k * w[j];
    }
  }
  nudge(i, dvx, dvy, dvz, h) {          // add velocity (Verlet: shift the previous position)
    if (this.w[i] === 0) return;
    const k = i * 3;
    this.p[k] -= dvx * h; this.p[k + 1] -= dvy * h; this.p[k + 2] -= dvz * h;
  }
}

export function initMedal(container) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, -1.2, 10.5);
  camera.lookAt(0, -1.2, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 7);
  key.target.position.set(0, -1.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -5, near: 1, far: 25 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff1e27, 0.6);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  /* ---------- particles ---------- */
  const NR = COLS * ROWS;
  const M = { B: NR, TOP: NR + 1, BOT: NR + 2, RIGHT: NR + 3, LEFT: NR + 4, FRONT: NR + 5, BACK: NR + 6 };
  const sim = new Sim(NR + 7);
  const seg = RIB_LEN / (ROWS - 1);
  const ribIdx = (r, c) => r * COLS + c;
  const ribMass = RIBBON_MASS / NR;

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = new THREE.Vector3((c / (COLS - 1) - 0.5) * RIB_W, RIB_LEN - r * seg, 0);
    sim.set(ribIdx(r, c), v, r === 0 ? 0 : ribMass, 0.9965);
  }
  // medal: rim masses at R/âˆš2 reproduce a disc's inertia (I = Â½mRÂ² about the axis, Â¼mRÂ² across)
  const mc = new THREE.Vector3(0, -BAR_Y, 0), rr = R / Math.SQRT2;
  const rimMass = MEDAL_MASS * 0.85 / 4, mdamp = 0.9993;
  sim.set(M.B, mc, MEDAL_MASS * 0.11, mdamp);
  sim.set(M.TOP, mc.clone().add(new THREE.Vector3(0, rr, 0)), rimMass, mdamp);
  sim.set(M.BOT, mc.clone().add(new THREE.Vector3(0, -rr, 0)), rimMass, mdamp);
  sim.set(M.RIGHT, mc.clone().add(new THREE.Vector3(rr, 0, 0)), rimMass, mdamp);
  sim.set(M.LEFT, mc.clone().add(new THREE.Vector3(-rr, 0, 0)), rimMass, mdamp);
  sim.set(M.FRONT, mc.clone().add(new THREE.Vector3(0, 0, 0.45)), MEDAL_MASS * 0.02, mdamp);
  sim.set(M.BACK, mc.clone().add(new THREE.Vector3(0, 0, -0.45)), MEDAL_MASS * 0.02, mdamp);
  const medalIds = Object.values(M);

  // ribbon constraints: stretch, shear, bend, plus long-range tethers so heavy loads can't stretch it
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = ribIdx(r, c);
    if (c < COLS - 1) sim.link(i, ribIdx(r, c + 1));
    if (r < ROWS - 1) sim.link(i, ribIdx(r + 1, c));
    if (r < ROWS - 1 && c < COLS - 1) { sim.link(i, ribIdx(r + 1, c + 1), 0.9); sim.link(ribIdx(r, c + 1), ribIdx(r + 1, c), 0.9); }
    if (r < ROWS - 2) sim.link(i, ribIdx(r + 2, c), 0.12);      // soft lengthwise bend
    if (c < COLS - 2) sim.link(i, ribIdx(r, c + 2), 0.5);       // stiffer across the width
    if (r > 0) sim.link(ribIdx(0, c), i, 1, true, r * seg);
  }
  // medal rigid body: every pair locked
  for (let a = 0; a < medalIds.length; a++) for (let b = a + 1; b < medalIds.length; b++) sim.link(medalIds[a], medalIds[b]);
  // bail: the ribbon's last row is clamped to the medal frame
  for (let c = 0; c < COLS; c++) {
    const i = ribIdx(ROWS - 1, c);
    [M.B, M.TOP, M.FRONT, M.BACK, M.LEFT, M.RIGHT].forEach((m) => sim.link(i, m));
  }
  sim.link(ribIdx(0, (COLS - 1) / 2), M.B, 1, true, RIB_LEN + BAR_Y);

  /* ---------- meshes ---------- */
  const tex = faceTexture();
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 3, metalness: 1, roughness: 0.28 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 1, roughness: 0.22 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0ad45, metalness: 1, roughness: 0.25 });

  const geo = new THREE.CylinderGeometry(R, R, THICK, 128, 1);
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position, uvs = geo.attributes.uv;
  for (const grp of geo.groups.slice(1)) {
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const v = geo.index.getX(i);
      const front = pos.getZ(v) > 0;
      uvs.setXY(v, ((front ? 1 : -1) * pos.getX(v)) / (2 * R) + 0.5, pos.getY(v) / (2 * R) + 0.5);
    }
  }
  uvs.needsUpdate = true;
  const coin = new THREE.Mesh(geo, [sideMat, faceMat, faceMat.clone()]);
  coin.castShadow = coin.receiveShadow = true;

  const medal = new THREE.Group();
  medal.matrixAutoUpdate = false;
  medal.add(coin);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 16, 48), gold);
  ring1.position.y = R + 0.12;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 16, 48), gold);
  ring2.rotation.y = Math.PI / 2;
  ring2.position.y = R + 0.36;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, RIB_W + 0.26, 20), gold);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = BAR_Y;
  [ring1, ring2, bar].forEach((m) => { m.castShadow = m.receiveShadow = true; medal.add(m); });

  const ribbonMat = new THREE.MeshPhysicalMaterial({
    map: ribbonTexture(), normalMap: weaveNormal(), normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.55, metalness: 0, sheen: 0.7, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x8fa800),
    envMapIntensity: 0.6,
    side: THREE.DoubleSide,
  });
  ribbonMat.map.repeat.set(1, 3);
  ribbonMat.normalMap.repeat.set(5, 22);
  // ribbon folded around the bail bar
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, RIB_W, 24, 1, true), ribbonMat);
  sleeve.rotation.z = Math.PI / 2;
  sleeve.position.y = BAR_Y;
  sleeve.castShadow = true;
  medal.add(sleeve);
  scene.add(medal);

  const ribGeo = new THREE.PlaneGeometry(RIB_W, RIB_LEN, COLS - 1, ROWS - 1);
  const ribbon = new THREE.Mesh(ribGeo, ribbonMat);
  ribbon.castShadow = ribbon.receiveShadow = true;
  ribbon.frustumCulled = false;
  scene.add(ribbon);

  /* ---------- medal frame from particles ---------- */
  const fB = new THREE.Vector3(), fX = new THREE.Vector3(), fY = new THREE.Vector3(), fZ = new THREE.Vector3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  const frameM = new THREE.Matrix4(), frameInv = new THREE.Matrix4();
  function frame() {
    sim.get(M.B, fB);
    fX.subVectors(sim.get(M.RIGHT, va), sim.get(M.LEFT, vb)).normalize();
    fY.subVectors(sim.get(M.TOP, va), sim.get(M.BOT, vb));
    fY.addScaledVector(fX, -fY.dot(fX)).normalize();
    fZ.crossVectors(fX, fY);
    frameM.makeBasis(fX, fY, fZ).setPosition(fB);
  }

  // keep the ribbon out of the disc (it would otherwise pass through on big swings)
  const pr = new THREE.Vector3();
  function collide() {
    const half = THICK / 2 + 0.03;
    for (let r = 1; r < ROWS - 3; r++) for (let c = 0; c < COLS; c++) {
      const i = ribIdx(r, c);
      sim.get(i, pr).sub(fB);
      const n = pr.dot(fZ);
      if (Math.abs(n) >= half) continue;
      const lx = pr.dot(fX), ly = pr.dot(fY);
      if (lx * lx + ly * ly > (R + 0.03) ** 2) continue;
      const push = (n >= 0 ? half : -half) - n;
      const k = i * 3;
      const wr = sim.w[i], wm = sim.w[M.B], ws = wr + wm;
      sim.x[k] += fZ.x * push * (wr / ws); sim.x[k + 1] += fZ.y * push * (wr / ws); sim.x[k + 2] += fZ.z * push * (wr / ws);
      const b = M.B * 3;
      sim.x[b] -= fZ.x * push * (wm / ws); sim.x[b + 1] -= fZ.y * push * (wm / ws); sim.x[b + 2] -= fZ.z * push * (wm / ws);
    }
  }

  /* ---------- interaction ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ptr = { inside: false, world: new THREE.Vector3(), last: new THREE.Vector3(), vel: new THREE.Vector3(), has: false };
  let hover = null;          // hit point on the medal
  let grab = null;           // { local, depthZ }
  const grabTarget = new THREE.Vector3();

  function pointerWorld(e, z = 0) {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -z;
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }
  container.addEventListener('pointermove', (e) => {
    const p = pointerWorld(e, grab ? grab.depthZ : 0);
    if (p) ptr.world.copy(p);
    ptr.inside = true;
    const hit = raycaster.intersectObject(coin, false)[0];
    hover = hit ? hit.point.clone() : null;
    container.style.cursor = grab ? 'grabbing' : hover ? 'grab' : '';
  });
  container.addEventListener('pointerleave', () => { ptr.inside = false; hover = null; });
  container.addEventListener('pointerdown', (e) => {
    pointerWorld(e);
    const hit = raycaster.intersectObject(coin, false)[0];
    if (!hit) return;
    frame();
    frameInv.copy(frameM).invert();
    if (e.pointerType === 'mouse') {
      grab = { local: hit.point.clone().applyMatrix4(frameInv), depthZ: hit.point.z };
      ptr.world.copy(hit.point);
      container.setPointerCapture(e.pointerId);
    } else {
      // tap: flick the touched side of the medal backwards
      medalIds.forEach((m) => {
        sim.get(m, va);
        const wgt = Math.exp(-va.distanceToSquared(hit.point) / (R * R));
        sim.nudge(m, 0, 0, -22 * wgt, H);
      });
    }
  });
  const release = () => { grab = null; container.style.cursor = ''; };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);
  container.style.touchAction = 'pan-y';

  function applyGrab() {
    if (!grab) return;
    frame();
    const gp = va.copy(grab.local).applyMatrix4(frameM);
    grabTarget.copy(ptr.world).sub(gp);
    const len = grabTarget.length();
    if (len > 2.5) grabTarget.multiplyScalar(2.5 / len);
    // spread the pull over the body, strongest near the grabbed point -> produces torque
    let sum = 0;
    const wts = medalIds.map((m) => { const w = Math.exp(-sim.get(m, vb).distanceToSquared(gp) / (R * R * 0.6)); sum += w; return w; });
    medalIds.forEach((m, k) => {
      const s = (wts[k] / sum) * 0.35 * medalIds.length * 0.25;
      const i = m * 3;
      sim.x[i] += grabTarget.x * s; sim.x[i + 1] += grabTarget.y * s; sim.x[i + 2] += grabTarget.z * s;
    });
  }

  function applyHover() {
    if (grab || !ptr.inside) return;
    const sp = ptr.vel.length();
    if (sp < 0.5) return;
    const vx = THREE.MathUtils.clamp(ptr.vel.x, -40, 40), vy = THREE.MathUtils.clamp(ptr.vel.y, -40, 40);
    if (hover) {
      // brushing the medal: carry it along the stroke and push it back from the screen
      medalIds.forEach((m) => {
        const w = Math.exp(-sim.get(m, va).distanceToSquared(hover) / (R * R * 0.8));
        sim.nudge(m, vx * 0.16 * w, vy * 0.1 * w, -Math.min(sp, 40) * 0.07 * w, H);
      });
    }
    // brushing the ribbon
    const ray = raycaster.ray;
    for (let i = COLS; i < NR; i++) {
      sim.get(i, va);
      const d2 = ray.distanceSqToPoint(va);
      if (d2 > 0.16) continue;
      const f = 1 - d2 / 0.16;
      sim.nudge(i, vx * 0.5 * f, vy * 0.3 * f, -Math.min(sp, 40) * 0.2 * f, H);
    }
  }

  /* ---------- environment forces ---------- */
  const acc = [0, 0, 0];
  let wind = 0, time = 0, pseudoY = 0;
  const accel = (i) => {
    acc[0] = 0; acc[1] = -G + pseudoY; acc[2] = 0;
    if (i < NR) {
      // faint air movement on the light fabric only
      const ph = time * 0.9 + i * 0.013;
      acc[0] = wind * (Math.sin(ph) * 0.6 + Math.sin(ph * 2.3) * 0.25);
      acc[2] = wind * Math.sin(ph * 1.4 + 1.1) * 0.5;
    }
    return acc;
  };

  // settle into the hanging pose before the first frame
  wind = 0;
  for (let s = 0; s < 600; s++) { sim.integrate(H, accel); for (let k = 0; k < ITER; k++) sim.solve(); frame(); collide(); }
  wind = 14;

  function resize() {
    const r = container.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = false, nudged = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !nudged) {
      nudged = true; // a small entrance sway, as if the cabinet door just opened
      medalIds.forEach((m) => sim.nudge(m, 3, 0, -5 * (m === M.RIGHT ? 1 : m === M.LEFT ? -1 : 0), H));
    }
  }, { rootMargin: '100px' }).observe(container);

  // page scroll moves the pin: its acceleration shows up as an inertial force on the medal
  let lastScroll = window.scrollY, scrollVel = 0;
  const pxToWorld = () => (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, container.clientHeight);

  const ribPos = ribGeo.attributes.position;
  const clock = new THREE.Clock();
  let accum = 0;

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    if (!visible) { lastScroll = window.scrollY; return; }
    time += dt;

    const sv = (window.scrollY - lastScroll) / Math.max(dt, 1e-4);
    lastScroll = window.scrollY;
    const sa = (sv - scrollVel) / Math.max(dt, 1e-4);
    scrollVel = sv;
    pseudoY = THREE.MathUtils.clamp(-sa * pxToWorld() * 0.35, -G * 0.8, G * 0.8);

    ptr.vel.subVectors(ptr.world, ptr.last).divideScalar(Math.max(dt, 1e-4));
    if (!ptr.has) { ptr.vel.set(0, 0, 0); ptr.has = true; }
    ptr.last.copy(ptr.world);

    accum += dt;
    let steps = 0;
    while (accum >= H && steps < 10) {
      if (steps === 0) applyHover();
      sim.integrate(H, accel);
      for (let k = 0; k < ITER; k++) { sim.solve(); applyGrab(); }
      frame();
      collide();
      accum -= H; steps++;
    }
    if (steps === 10) accum = 0;

    frame();
    medal.matrix.copy(frameM);
    medal.matrixWorldNeedsUpdate = true;
    for (let i = 0; i < NR; i++) ribPos.setXYZ(i, sim.x[i * 3], sim.x[i * 3 + 1], sim.x[i * 3 + 2]);
    ribPos.needsUpdate = true;
    ribGeo.computeVertexNormals();

    renderer.render(scene, camera);
  }
  tick();
}

