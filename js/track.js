// Career as a night race. A procedurally modelled open-wheel car runs along a precomputed
// racing line. The scroll is the throttle: it sets where the car is, and the motion that
// produces drives the suspension (pitch/roll/heave), steering, brake heat, plank sparks,
// gears and the g-meter.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 1 scene unit = 1 m
const W = 12;                    // track width
const UP = new THREE.Vector3(0, 1, 0);
const LIME = 0xff1e27, GOLD = 0xe8b84a, CREAM = 0xf2f1e9, BG = 0x07080a;

const PATH = [
  [0, 0, 0], [30, 0, -40], [85, 1, -45], [120, 1.8, -85], [105, 1.5, -135], [55, 0.6, -150],
  [20, 0, -195], [45, 0.6, -245], [105, 1.8, -255], [150, 1.2, -220], [195, 0.6, -250], [215, 0, -310], [190, 0, -360],
];
const T_START = 0.012, T_END = 0.975;

// vehicle
const VMAX = 95;                 // ~340 km/h, scales downforce squat and gears
const WHEELBASE = 3.6, WHEEL_R = 0.36;
const DT = 1 / 120;
const GEAR_TOPS = [0, 24, 34, 44, 54, 64, 74, 84, 96];

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = THREE.MathUtils.clamp;

/* =========================================================
   Textures (all procedural)
   ========================================================= */
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function tex(c, { srgb = true, repeat = false, nearest = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.anisotropy = aniso;
  return t;
}
function normalFromHeight(h, S, strength) {
  return canvas(S, S, (x) => {
    const img = x.createImageData(S, S);
    const at = (i, j) => h[((j + S) % S) * S + ((i + S) % S)];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const nx = (at(i - 1, j) - at(i + 1, j)) * strength, ny = (at(i, j - 1) - at(i, j + 1)) * strength;
      const l = Math.hypot(nx, ny, 1), k = (j * S + i) * 4;
      img.data[k] = (nx / l * 0.5 + 0.5) * 255;
      img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255;
      img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  });
}

// asphalt: aggregate grain albedo, roughness and normal; optional painted track-limit lines
function asphalt(lines) {
  const S = 512, h = new Float32Array(S * S);
  const albedo = document.createElement('canvas'); albedo.width = albedo.height = S;
  const rough = document.createElement('canvas'); rough.width = rough.height = S;
  const ax = albedo.getContext('2d'), rx = rough.getContext('2d');
  const ai = ax.createImageData(S, S), ri = rx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const g = Math.random(), stone = Math.random() < 0.07 ? Math.random() : 0;
    h[i] = g * 0.5 + stone * 0.8;
    const u = (i % S) / S;
    const line = lines && ((u > 0.012 && u < 0.03) || (u > 0.97 && u < 0.988));
    const v = line ? 0.78 + g * 0.06 : 0.11 + g * 0.06 + stone * 0.16;
    ai.data[i * 4] = v * 255; ai.data[i * 4 + 1] = v * 255; ai.data[i * 4 + 2] = v * 0.96 * 255; ai.data[i * 4 + 3] = 255;
    const r = line ? 0.5 : 0.78 + g * 0.18 - stone * 0.25;
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = r * 255; ri.data[i * 4 + 3] = 255;
  }
  ax.putImageData(ai, 0, 0); rx.putImageData(ri, 0, 0);
  return {
    map: tex(albedo, { repeat: true, aniso: 16 }),
    roughnessMap: tex(rough, { srgb: false, repeat: true, aniso: 16 }),
    normalMap: tex(normalFromHeight(h, S, 1.6), { srgb: false, repeat: true, aniso: 16 }),
  };
}

function carbonTexture() {
  return tex(canvas(256, 256, (x, w) => {
    const c = 16;
    for (let j = 0; j < w / c; j++) for (let i = 0; i < w / c; i++) {
      const dir = ((i + j) >> 1) % 2;
      const g = dir ? x.createLinearGradient(i * c, 0, i * c + c, 0) : x.createLinearGradient(0, j * c, 0, j * c + c);
      g.addColorStop(0, '#0b0c0d'); g.addColorStop(0.5, '#2a2d30'); g.addColorStop(1, '#0b0c0d');
      x.fillStyle = g; x.fillRect(i * c, j * c, c, c);
    }
  }), { repeat: true });
}

// paint livery: u runs around the body (0.25 = top, 0.75 = belly), v runs nose -> tail
function liveryTexture() {
  return tex(canvas(512, 512, (x, w, h) => {
    x.fillStyle = '#ff1e27'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0e121a'; x.fillRect(0.56 * w, 0, 0.38 * w, h);
    x.fillStyle = '#f2f1e9'; x.fillRect(0.535 * w, 0, 0.012 * w, h); x.fillRect(0.94 * w, 0, 0.012 * w, h);
    // dark spine stripe along the top
    x.fillStyle = '#0e121a'; x.fillRect(0.235 * w, 0, 0.03 * w, h);
  }));
}

function tyreSidewall() {
  return tex(canvas(512, 512, (x, S) => {
    const c = S / 2;
    x.fillStyle = '#121212'; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#ff1e27'; x.lineWidth = 10;
    x.beginPath(); x.arc(c, c, c * 0.83, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#e9e9e2'; x.font = '700 30px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const label = 'MA RACING  ·  SOFT  ·  ';
    const str = label + label;
    for (let i = 0; i < str.length; i++) {
      x.save(); x.translate(c, c); x.rotate((i / str.length) * Math.PI * 2); x.translate(0, -c * 0.92); x.fillText(str[i], 0, 0); x.restore();
    }
  }));
}

function wheelCover() {
  return tex(canvas(256, 256, (x, S) => {
    const c = S / 2;
    const g = x.createRadialGradient(c, c, 10, c, c, c);
    g.addColorStop(0, '#2b2e30'); g.addColorStop(1, '#0d0e0f');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#ff1e27'; x.lineWidth = 6; x.beginPath(); x.arc(c, c, c - 8, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#3a3e42';
    for (let i = 0; i < 5; i++) {
      x.save(); x.translate(c, c); x.rotate((i / 5) * Math.PI * 2); x.fillRect(-6, 22, 12, c - 40); x.restore();
    }
    x.fillStyle = '#ff1e27'; x.beginPath(); x.arc(c, c, 16, 0, Math.PI * 2); x.fill();
  }));
}

function helmetTexture() {
  return tex(canvas(512, 256, (x, w, h) => {
    x.fillStyle = '#ff1e27'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0e121a'; x.fillRect(0, h * 0.62, w, h * 0.38);
    x.fillStyle = '#f2f1e9'; x.fillRect(0, h * 0.6, w, h * 0.025);
    // visor on the front (u â‰ˆ 0.25)
    x.fillStyle = '#05060a'; x.fillRect(w * 0.1, h * 0.4, w * 0.3, h * 0.16);
    x.fillStyle = 'rgba(160,190,255,0.35)'; x.fillRect(w * 0.12, h * 0.41, w * 0.26, h * 0.03);
  }));
}

function decal(text, color, font, w = 512, h = 160) {
  return tex(canvas(w, h, (x) => {
    x.fillStyle = color; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 6);
  }));
}

/* =========================================================
   Geometry helpers
   ========================================================= */
// smooth bodywork from superellipse cross-sections: [z, halfWidth, halfHeight, yCentre, exponent, xCentre]
function loft(sections, seg = 32) {
  const pos = [], uv = [], idx = [];
  const S = sections.length;
  sections.forEach(([z, hw, hh, yc, n, xc = 0], si) => {
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(xc + hw * Math.sign(c) * Math.abs(c) ** (2 / n), yc + hh * Math.sign(s) * Math.abs(s) ** (2 / n), z);
      uv.push(k / seg, si / (S - 1));
    }
  });
  for (let si = 0; si < S - 1; si++) for (let k = 0; k < seg; k++) {
    const a = si * (seg + 1) + k, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// inverted (downforce) cambered aerofoil, leading edge at the origin, chord towards -z, span along x
function airfoil(chord, span, thick = 0.12, camber = -0.07) {
  const N = 20, up = [], lo = [];
  for (let i = 0; i <= N; i++) {
    const x = (1 - Math.cos((i / N) * Math.PI)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = camber * 4 * x * (1 - x);
    up.push(new THREE.Vector2(x * chord, (yc + yt) * chord));
    lo.push(new THREE.Vector2(x * chord, (yc - yt) * chord));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape([...up, ...lo.reverse().slice(1, -1)]), { depth: span, bevelEnabled: false });
  g.translate(0, 0, -span / 2);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function rod(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

function tyreGeometry(r, w) {
  const rin = r * 0.64, h = w / 2, f = Math.min(0.07, h * 0.45);
  const pts = [new THREE.Vector2(rin, -h * 0.9), new THREE.Vector2(r - f * 1.5, -h)];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(r - f + Math.cos(a) * f, -h + f + Math.sin(a) * f)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(r - f + Math.cos(a) * f, h - f + Math.sin(a) * f)); }
  pts.push(new THREE.Vector2(r - f * 1.5, h), new THREE.Vector2(rin, h * 0.9));
  const g = new THREE.LatheGeometry(pts, 64);
  g.rotateZ(Math.PI / 2);
  return g;
}

/* =========================================================
   The car (built facing +z, +x is the car's left, ground at y = 0)
   ========================================================= */
function buildCar() {
  const carbonMap = carbonTexture();
  carbonMap.repeat.set(3, 3);
  const paint = new THREE.MeshPhysicalMaterial({ map: liveryTexture(), metalness: 0.1, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.32 });
  const carbon = new THREE.MeshPhysicalMaterial({ map: carbonMap, metalness: 0.3, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 0.3 });
  const satinBlack = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.6, metalness: 0.2 });
  const limePaint = new THREE.MeshPhysicalMaterial({ color: 0xff1e27, metalness: 0.15, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.35 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const titanium = new THREE.MeshStandardMaterial({ color: 0x8b8f93, metalness: 0.9, roughness: 0.35 });

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();     // pitch / roll / heave about the centre of mass
  bodyPivot.position.y = 0.3;
  const body = new THREE.Group();
  body.position.y = -0.3;
  bodyPivot.add(body);
  root.add(bodyPivot);

  const add = (mesh, parent = body) => { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  // monocoque: nose -> cockpit -> airbox -> tail
  add(new THREE.Mesh(loft([
    [2.97, 0.05, 0.04, 0.22, 2.4], [2.75, 0.11, 0.07, 0.24, 2.6], [2.35, 0.16, 0.11, 0.3, 2.8], [1.85, 0.21, 0.15, 0.38, 3],
    [1.35, 0.27, 0.21, 0.45, 3.2], [0.9, 0.33, 0.26, 0.5, 3.4], [0.4, 0.37, 0.28, 0.5, 3.6], [-0.1, 0.4, 0.3, 0.52, 3.6],
    [-0.45, 0.36, 0.4, 0.62, 3], [-0.95, 0.3, 0.33, 0.58, 3], [-1.55, 0.22, 0.24, 0.5, 2.8], [-2.05, 0.14, 0.16, 0.43, 2.6],
    [-2.4, 0.08, 0.1, 0.41, 2.4], [-2.56, 0.02, 0.03, 0.41, 2.2],
  ]), paint));
  // sidepods
  [1, -1].forEach((sd) => {
    add(new THREE.Mesh(loft([
      [0.5, 0.2, 0.15, 0.37, 3.4, 0.56 * sd], [0.42, 0.23, 0.18, 0.37, 3.6, 0.57 * sd], [0, 0.26, 0.18, 0.36, 3.6, 0.58 * sd],
      [-0.6, 0.22, 0.15, 0.32, 3.2, 0.54 * sd], [-1.2, 0.14, 0.1, 0.26, 3, 0.46 * sd], [-1.65, 0.04, 0.04, 0.22, 2.4, 0.38 * sd],
    ]), paint));
    const inlet = add(new THREE.Mesh(new THREE.CircleGeometry(1, 32), satinBlack));
    inlet.scale.set(0.19, 0.14, 1);
    inlet.position.set(0.56 * sd, 0.37, 0.505);
    // mirrors
    add(rod(new THREE.Vector3(0.36 * sd, 0.62, 0.62), new THREE.Vector3(0.44 * sd, 0.72, 0.6), 0.012, carbon));
    const mirror = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), paint));
    mirror.position.set(0.46 * sd, 0.73, 0.6);
    // side decal
    const d = add(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.15), new THREE.MeshStandardMaterial({
      map: decal('MOHD AADIL', '#121410', '900 92px "Big Shoulders Display", Impact, sans-serif'), transparent: true, roughness: 0.4, depthWrite: false,
    })));
    d.position.set(0.305 * sd, 0.66, -0.95);
    d.rotation.y = (sd * Math.PI) / 2;
    d.castShadow = false;
  });

  // floor, plank, diffuser
  const floor = add(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.03, 3.3), carbon));
  floor.position.set(0, 0.07, -0.35);
  [1, -1].forEach((sd) => { const e = add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 2.3), carbon)); e.position.set(0.83 * sd, 0.08, -0.55); });
  const plank = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 2.6), new THREE.MeshStandardMaterial({ color: 0x8a7552, roughness: 0.8 })));
  plank.position.set(0, 0.05, -0.4);
  const diff = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.6), carbon));
  diff.position.set(0, 0.15, -2.2); diff.rotation.x = -0.28;
  for (let i = 0; i < 4; i++) { const f = add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.18, 0.55), carbon)); f.position.set(-0.3 + i * 0.2, 0.2, -2.18); }

  // cockpit, driver, halo, airbox intake
  const opening = add(new THREE.Mesh(new THREE.CircleGeometry(1, 40), satinBlack));
  opening.scale.set(0.27, 0.44, 1); opening.rotation.x = -Math.PI / 2; opening.position.set(0, 0.787, 0.32);
  const helmet = add(new THREE.Mesh(new THREE.SphereGeometry(0.145, 32, 20), new THREE.MeshPhysicalMaterial({ map: helmetTexture(), clearcoat: 1, roughness: 0.3 })));
  helmet.position.set(0, 0.86, 0.26);
  const haloCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.28, 0.7, 0.05), new THREE.Vector3(0.31, 0.86, 0.33), new THREE.Vector3(0, 0.94, 0.62),
    new THREE.Vector3(-0.31, 0.86, 0.33), new THREE.Vector3(-0.28, 0.7, 0.05),
  ]);
  add(new THREE.Mesh(new THREE.TubeGeometry(haloCurve, 40, 0.032, 10), carbon));
  add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.94, 0.62), new THREE.Vector3(0, 0.84, 0.78), new THREE.Vector3(0, 0.69, 0.86),
  ]), 12, 0.03, 8), carbon));
  const intake = add(new THREE.Mesh(new THREE.CircleGeometry(1, 32), satinBlack));
  intake.scale.set(0.13, 0.11, 1); intake.position.set(0, 0.92, -0.28); intake.rotation.x = -0.35;
  const num = add(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshStandardMaterial({
    map: decal('25', '#121410', '900 140px "Big Shoulders Display", Impact, sans-serif', 256, 160), transparent: true, depthWrite: false,
  })));
  num.position.set(0, 0.497, 2.0); num.rotation.x = -Math.PI / 2 + 0.235; num.castShadow = false;

  // front wing: four elements + endplates
  [[0.34, 3.14, 0.09, 0.04, carbon], [0.22, 2.9, 0.14, 0.24, carbon], [0.15, 2.76, 0.2, 0.45, limePaint], [0.11, 2.66, 0.26, 0.66, limePaint]]
    .forEach(([c, z, y, aoa, m]) => { const e = add(new THREE.Mesh(airfoil(c, 1.9), m)); e.position.set(0, y, z); e.rotation.x = aoa; });
  [1, -1].forEach((sd) => { const p = add(new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.3, 0.6), carbon)); p.position.set(0.96 * sd, 0.2, 2.86); });

  // rear wing, beam wing, endplates, pylon, rain light
  [[0.32, -2.28, 0.9, 0.14, carbon], [0.2, -2.52, 1.0, 0.5, limePaint], [0.18, -2.3, 0.46, 0.2, carbon]]
    .forEach(([c, z, y, aoa, m], i) => { const e = add(new THREE.Mesh(airfoil(c, i === 2 ? 0.8 : 1.02), m)); e.position.set(0, y, z); e.rotation.x = aoa; });
  [1, -1].forEach((sd) => { const p = add(new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.6, 0.6), carbon)); p.position.set(0.52 * sd, 0.76, -2.48); });
  const pylon = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.1), carbon));
  pylon.position.set(0, 0.68, -2.35);
  const rainMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.01, 0.01) });
  const rain = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.03), rainMat));
  rain.position.set(0, 0.4, -2.62);
  const exhaust = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.16, 16, 1, true), titanium));
  exhaust.rotation.x = Math.PI / 2; exhaust.position.set(0, 0.52, -2.5);
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 0.15) });
  const exGlow = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), glowMat);
  exGlow.position.set(0, 0.52, -2.57); exGlow.rotation.y = Math.PI;
  body.add(exGlow);

  // wheels: front 305 mm, rear 405 mm wide, 720 mm diameter
  const sidewall = tyreSidewall(), cover = wheelCover();
  const wheels = [];
  [[0.85, 1.75, 0.305, true], [-0.85, 1.75, 0.305, true], [0.8, -1.85, 0.405, false], [-0.8, -1.85, 0.405, false]].forEach(([x, z, w, front]) => {
    const steer = new THREE.Group();
    steer.position.set(x, WHEEL_R, z);
    const spin = new THREE.Group();
    steer.add(spin);
    add(new THREE.Mesh(tyreGeometry(WHEEL_R, w), rubber), spin);
    const out = Math.sign(x);
    const sw = add(new THREE.Mesh(new THREE.RingGeometry(WHEEL_R * 0.64, WHEEL_R - 0.015, 64), new THREE.MeshStandardMaterial({ map: sidewall, roughness: 0.85 })), spin);
    sw.position.x = out * (w / 2 + 0.001); sw.rotation.y = out * Math.PI / 2;
    const cv = add(new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R * 0.64, 48), new THREE.MeshStandardMaterial({ map: cover, metalness: 0.6, roughness: 0.35 })), spin);
    cv.position.x = out * (w / 2 - 0.02); cv.rotation.y = out * Math.PI / 2;
    const inner = add(new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R * 0.64, 32), satinBlack), spin);
    inner.position.x = -out * (w / 2 - 0.02); inner.rotation.y = -out * Math.PI / 2;
    // brake disc, glows with temperature
    const discMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.6, emissive: 0xff5a10, emissiveIntensity: 0 });
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.17, 32), discMat);
    disc.position.x = -out * (w / 2 + 0.03); disc.rotation.y = -out * Math.PI / 2;
    steer.add(disc);
    root.add(steer);
    wheels.push({ steer, spin, front, discMat });
  });

  // suspension: wishbones and push rods (move with the body; wheel travel is millimetres)
  [[1.75, 0.72], [-1.85, 0.66]].forEach(([z, hubX]) => {
    [1, -1].forEach((sd) => {
      const hubU = new THREE.Vector3(hubX * sd, 0.46, z), hubL = new THREE.Vector3(hubX * sd, 0.27, z);
      [[0.22, 0.44, 0.17], [0.18, 0.26, 0.2]].forEach(([cx, cy, dz], k) => {
        const hub = k ? hubL : hubU;
        add(rod(new THREE.Vector3(cx * sd, cy, z + dz), hub, 0.016, carbon));
        add(rod(new THREE.Vector3(cx * sd, cy, z - dz), hub, 0.016, carbon));
      });
      add(rod(new THREE.Vector3(0.2 * sd, 0.3, z + 0.05), new THREE.Vector3((hubX - 0.04) * sd, 0.43, z), 0.014, carbon));
    });
  });

  const plankEnd = new THREE.Object3D();
  plankEnd.position.set(0, 0.03, -1.6);
  body.add(plankEnd);

  return { root, bodyPivot, wheels, rainMat, glowMat, plankEnd };
}

/* =========================================================
   Track pieces
   ========================================================= */
// strip across the track: cols = [[lateral offset, height], ...] (left is +).
// swapUV puts distance along the track in u (for vertical boards whose artwork runs lengthwise).
function profileStrip(F, cols, vScale, absBottom = null, swapUV = false, flip = false) {
  const nc = cols.length, pos = [], uv = [], idx = [];
  F.forEach((fr, i) => {
    cols.forEach(([off, y], c) => {
      const yy = absBottom !== null && c === 0 ? absBottom : fr.p.y + y;
      pos.push(fr.p.x + fr.l.x * off, yy, fr.p.z + fr.l.z * off);
      if (swapUV) uv.push(fr.s / vScale, c / (nc - 1));
      else uv.push(c / (nc - 1), fr.s / vScale);
    });
    if (i < F.length - 1) for (let c = 0; c < nc - 1; c++) {
      const a = i * nc + c, b = a + nc;
      if (flip) idx.push(a, b, a + 1, a + 1, b, b + 1);
      else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function labelSprite(text, color, h = 6) {
  const font = '900 200px "Big Shoulders Display", Impact, sans-serif';
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const w = Math.ceil(m.measureText(text).width) + 40;
  const t = tex(canvas(w, 220, (x) => {
    x.font = font; x.textBaseline = 'middle'; x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 18;
    x.fillText(text, 20, 118);
  }));
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set((h * w) / 220, h, 1);
  sp.userData = { w: (h * w) / 220, h };
  return sp;
}

function frameAt(curve, t, L) {
  const p = curve.getPointAt(t), f = curve.getTangentAt(t);
  return { p, f, l: new THREE.Vector3().crossVectors(UP, f).normalize(), s: t * L };
}

function buildGate(curve, L, t, { year, tag, color, index }) {
  const g = new THREE.Group();
  const fr = frameAt(curve, t, L);
  g.position.copy(fr.p);
  g.lookAt(fr.p.clone().add(fr.f));
  const hex = `#${new THREE.Color(color).getHexString()}`;
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a3d36, roughness: 0.4, metalness: 0.8, emissive: color, emissiveIntensity: 0 });
  const span = W + 3;
  [-1, 1].forEach((side) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), frame);
    pillar.position.set((side * span) / 2, 4, 0);
    pillar.castShadow = true;
    g.add(pillar);
  });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(span + 0.6, 0.35, 0.6), frame);
  truss.position.set(0, 9.05, 0);
  truss.castShadow = true;
  g.add(truss);
  const signTex = tex(canvas(1024, 112, (x, w, h) => {
    x.fillStyle = hex; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0e0f0b'; x.font = '600 46px "JetBrains Mono", monospace'; x.textBaseline = 'middle';
    x.fillText(`S${String(index + 1).padStart(2, '0')}`, 28, h / 2 + 2);
    x.textAlign = 'right'; x.fillText(tag.toUpperCase(), w - 28, h / 2 + 2);
    x.textAlign = 'center'; x.font = '900 80px "Big Shoulders Display", Impact, sans-serif';
    x.fillText(year.toUpperCase(), w / 2, h / 2 + 4);
  }));
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
  signMat.color.setScalar(0.6);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(span + 0.5, (span + 0.5) * (112 / 1024)), signMat);
  sign.position.set(0, 8.2, 0);
  sign.rotation.y = Math.PI;
  g.add(sign);
  const label = labelSprite(year.toUpperCase(), hex, 7);
  label.position.set(0, 14, 0);
  g.add(label);
  return { group: g, frame, signMat, label, t };
}

function checkerLine(curve, L, t) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, W / 8), new THREE.MeshStandardMaterial({
    map: tex(canvas(16, 2, (x) => {
      for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#e8e8e2'; x.fillRect(i, j, 1, 1); }
    }), { nearest: true }), roughness: 0.6,
  }));
  const fr = frameAt(curve, t, L);
  m.position.copy(fr.p).add(new THREE.Vector3(0, 0.02, 0));
  m.lookAt(fr.p.clone().add(fr.f));
  m.rotateX(-Math.PI / 2);
  m.receiveShadow = true;
  return m;
}

/* =========================================================
   Scene
   ========================================================= */
export function initTrack(container, state) {
  const section = container.closest('.career');
  const laps = [...section.querySelectorAll('.lap')];
  const marks = [...section.querySelectorAll('.minimap__marks span')];
  const bar = section.querySelector('.js-track-bar');
  const hud = {
    sector: section.querySelector('.js-hud-sector'), speed: section.querySelector('.js-hud-speed'),
    gear: section.querySelector('.js-hud-gear'), rpm: section.querySelector('.js-hud-rpm'), g: section.querySelector('.js-hud-g'),
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const DPR = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 40, 260);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 3000);

  // night sky with city glow on the horizon
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    // linear values: a faint sodium-orange city glow fading to a near-black sky
    fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 c = mix(vec3(0.012,0.010,0.007), vec3(0.0012,0.0014,0.002), pow(h, 0.35)); gl_FragColor = vec4(c, 1.0); }',
  })));

  scene.add(new THREE.HemisphereLight(0x8a9bb5, 0x0a0b08, 0.18));
  // floodlight key: follows the car so shadows stay sharp where it matters
  const key = new THREE.DirectionalLight(0xfff0dc, 1.7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 120 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const curve = new THREE.CatmullRomCurve3(PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const L = curve.getLength();

  // centreline frames for the track surfaces
  const NS = 1400;
  const F = [];
  for (let i = 0; i <= NS; i++) F.push(frameAt(curve, i / NS, L));

  // ground: dark grass
  const grassH = new Float32Array(256 * 256).map(() => Math.random());
  const grassMap = tex(canvas(256, 256, (x) => {
    const img = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) { const v = grassH[i]; img.data.set([14 + v * 10, 20 + v * 14, 10 + v * 6, 255], i * 4); }
    x.putImageData(img, 0, 0);
  }), { repeat: true });
  grassMap.repeat.set(400, 400);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1, envMapIntensity: 0.05 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  scene.add(ground);

  // road
  const road = asphalt(true);
  const roadMat = new THREE.MeshStandardMaterial({ ...road, roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.12 });
  const roadMesh = new THREE.Mesh(profileStrip(F, [[W / 2, 0], [-W / 2, 0]], W), roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // raised kerbs (sawtooth-ish profile), paved run-off, walls with LED boards, catch fencing
  const kerbMap = tex(canvas(2, 2, (x) => { x.fillStyle = '#ff1e27'; x.fillRect(0, 0, 2, 1); x.fillStyle = '#ecebe4'; x.fillRect(0, 1, 2, 1); }), { repeat: true, nearest: true });
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbMap, color: 0xb8b8b0, roughness: 0.6, envMapIntensity: 0.12, side: THREE.DoubleSide });
  const runoff = asphalt(false);
  const runoffMat = new THREE.MeshStandardMaterial({ ...runoff, color: 0x6d7266, roughness: 1, envMapIntensity: 0.15, side: THREE.DoubleSide });
  const adItems = [['MOHD AADIL', '#ff1e27'], ['WEB DEVELOPER', '#f2f1e9'], ['WORDPRESS & SHOPIFY', '#ff1e27'], ['CREATIVE DESIGN', '#f2f1e9']];
  const adFont = '900 84px "Big Shoulders Display", Impact, sans-serif', adGap = 90;
  const adMeasure = document.createElement('canvas').getContext('2d');
  adMeasure.font = adFont;
  const adW = Math.ceil(adItems.reduce((sum, [t]) => sum + adMeasure.measureText(t).width + adGap, 0));
  const ads = tex(canvas(adW, 128, (x, w, h) => {
    x.fillStyle = '#0c0d0a'; x.fillRect(0, 0, w, h);
    x.font = adFont; x.textBaseline = 'middle';
    let px = adGap / 2;
    adItems.forEach(([t, c]) => { x.fillStyle = c; x.fillText(t, px, h / 2 + 4); px += x.measureText(t).width + adGap; });
  }), { repeat: true });
  const wallMat = new THREE.MeshStandardMaterial({ map: ads, emissiveMap: ads, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.6, envMapIntensity: 0.15 });
  const wallBackMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8, side: THREE.BackSide });
  const fenceAlpha = tex(canvas(64, 64, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#fff'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
  }), { srgb: false, repeat: true });
  fenceAlpha.repeat.set(14, 14);
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9a9d96, metalness: 0.7, roughness: 0.4, alphaMap: fenceAlpha, alphaTest: 0.4, side: THREE.DoubleSide });

  [1, -1].forEach((sd) => {
    const o = (v) => v * sd;
    const kerb = new THREE.Mesh(profileStrip(F, [[o(W / 2), 0], [o(W / 2 + 0.35), 0.05], [o(W / 2 + 0.8), 0.08], [o(W / 2 + 1.2), 0.02]], 3), kerbMat);
    kerb.receiveShadow = kerb.castShadow = true;
    const ro = new THREE.Mesh(profileStrip(F, [[o(W / 2 + 1.2), 0.01], [o(W / 2 + 7), 0.01]], 12), runoffMat);
    ro.receiveShadow = true;
    // LED boards face the track and read left-to-right on both sides; their backs are plain
    const wallGeo = profileStrip(F, [[o(W / 2 + 7), 0], [o(W / 2 + 7), 1.05]], 32 * sd, null, true, sd > 0);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    const wallBack = new THREE.Mesh(wallGeo, wallBackMat);
    // plain skirt from the ground up to track level, so the boards sit on top of it
    const skirt = new THREE.Mesh(profileStrip(F, [[o(W / 2 + 7), 0], [o(W / 2 + 7), 0]], 10, -0.6), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9, side: THREE.DoubleSide }));
    const fence = new THREE.Mesh(profileStrip(F, [[o(W / 2 + 7.1), 1.05], [o(W / 2 + 7.1), 4.2]], 3.2), fenceMat);
    scene.add(kerb, ro, wall, wallBack, skirt, fence);
  });

  scene.add(checkerLine(curve, L, T_START), checkerLine(curve, L, T_END));

  // floodlight towers
  const TOWERS = Math.floor(L / 30) * 2;
  const towerGeo = new THREE.CylinderGeometry(0.15, 0.22, 14, 8); towerGeo.translate(0, 7, 0);
  const headGeo = new THREE.BoxGeometry(2.2, 0.6, 0.5); headGeo.translate(0, 14.2, 0);
  const towers = new THREE.InstancedMesh(towerGeo, new THREE.MeshStandardMaterial({ color: 0x3a3c38, metalness: 0.7, roughness: 0.5 }), TOWERS);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.7, 4.2) });
  const heads = new THREE.InstancedMesh(headGeo, headMat, TOWERS);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < TOWERS; i++) {
    const fr = frameAt(curve, Math.min(0.999, (Math.floor(i / 2) + 0.5) / (TOWERS / 2)), L);
    const sd = i % 2 ? 1 : -1;
    dummy.position.copy(fr.p).addScaledVector(fr.l, sd * (W / 2 + 9.5));
    dummy.position.y = -0.6;
    dummy.lookAt(fr.p.x, -0.6, fr.p.z);
    dummy.updateMatrix();
    towers.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
  }
  towers.castShadow = true;
  scene.add(towers, heads);

  // city: instanced blocks with procedurally lit windows (world-space, so they never stretch)
  const samples = curve.getSpacedPoints(300);
  const box3 = new THREE.Box3().setFromPoints(samples);
  const center = box3.getCenter(new THREE.Vector3());
  const size = box3.getSize(new THREE.Vector3());
  const BLOCKS = 300;
  const blockGeo = new THREE.BoxGeometry(1, 1, 1); blockGeo.translate(0, 0.5, 0);
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.75, metalness: 0.2, envMapIntensity: 0.2 });
  blockMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp = vec4(transformed, 1.0); vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
        #endif
        vWP = (modelMatrix * wp).xyz; vWN = normalize(mat3(modelMatrix) * wn);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (abs(vWN.y) < 0.5 && vWP.y > 1.0) {
          vec2 q = vec2((vWP.x + vWP.z) / 2.4, vWP.y / 3.2);
          vec2 f = fract(q), cell = floor(q);
          float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.75);
          float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          vec3 wc = mix(vec3(1.0, 0.76, 0.42), vec3(0.7, 0.85, 1.0), step(0.9, h));
          // far away, fade the window grid to its average glow instead of aliasing into stripes
          float aa = clamp(1.0 - 1.6 * max(fwidth(q.x), fwidth(q.y)), 0.0, 1.0);
          float lit = mix(0.035, win * step(0.7, h), aa);
          totalEmissiveRadiance += wc * lit * 1.6;
        }`);
  };
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, BLOCKS);
  let placed = 0, guard = 0;
  while (placed < BLOCKS && guard++ < 8000) {
    const x = center.x + (Math.random() - 0.5) * (size.x + 320);
    const z = center.z + (Math.random() - 0.5) * (size.z + 320);
    let near = Infinity;
    for (const s of samples) near = Math.min(near, (s.x - x) ** 2 + (s.z - z) ** 2);
    if (near < 32 * 32) continue;
    const d = Math.sqrt(near);
    dummy.position.set(x, -0.6, z);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.set(8 + Math.random() * 16, 6 + Math.random() ** 2.5 * (d < 70 ? 24 : 90), 8 + Math.random() * 16);
    dummy.updateMatrix();
    blocks.setMatrixAt(placed++, dummy.matrix);
  }
  blocks.count = placed;
  scene.add(blocks);

  // start gantry with five pairs of red lights
  const startFr = frameAt(curve, T_START + 14 / L, L);
  const gantry = new THREE.Group();
  gantry.position.copy(startFr.p);
  gantry.lookAt(startFr.p.clone().add(startFr.f));
  const steel = new THREE.MeshStandardMaterial({ color: 0x2c2e2a, metalness: 0.8, roughness: 0.45 });
  [-1, 1].forEach((sd) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 0.4), steel); p.position.set(sd * (W / 2 + 1.5), 3.75, 0); gantry.add(p); });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 3.4, 0.4, 0.4), steel);
  beam.position.y = 7.3; gantry.add(beam);
  const bulbs = [];
  for (let i = 0; i < 5; i++) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 }));
    pod.position.set((i - 2) * 0.8, 6.55, -0.2);
    gantry.add(pod);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.01, 0.01) });
    [0.22, -0.22].forEach((dy) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat); b.position.set((i - 2) * 0.8, 6.55 + dy, -0.36); gantry.add(b); });
    bulbs.push(mat);
  }
  scene.add(gantry);

  // checkpoint gates from the DOM milestones
  const gates = laps.map((lap, index) => {
    const gate = buildGate(curve, L, Number(lap.dataset.t), {
      year: lap.querySelector('.lap__year').textContent.trim(),
      tag: lap.querySelector('.lap__tag').textContent.trim(),
      color: lap.classList.contains('lap--gold') ? GOLD : LIME,
      index,
    });
    scene.add(gate.group);
    return gate;
  });
  const span = T_END - T_START;
  marks.forEach((m, i) => { if (gates[i]) m.style.left = `${((gates[i].t - T_START) / span) * 100}%`; });

  /* ---------- racing line + speed envelope ---------- */
  const NL = 2000;
  const cP = [], cL = [];
  for (let i = 0; i <= NL; i++) { const fr = frameAt(curve, i / NL, L); cP.push(fr.p); cL.push(fr.l); }
  const ds = L / NL;
  const kappa = new Float32Array(NL + 1);
  for (let i = 1; i < NL; i++) {
    const t0 = curve.getTangentAt((i - 1) / NL), t1 = curve.getTangentAt((i + 1) / NL);
    kappa[i] = t1.sub(t0).dot(cL[i]) / (2 * ds);
  }
  const smooth = (a, win) => {
    const n = a.length, out = new Float32Array(n), pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
    for (let i = 0; i < n; i++) { const lo = Math.max(0, i - win), hi = Math.min(n - 1, i + win); out[i] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1); }
    return out;
  };
  // apex the inside of each corner, drift wide on exit
  const kS = smooth(kappa, 60);
  const lim = W / 2 - 1.7;
  let off = kS.map((k) => clamp(k * 150, -lim, lim));
  off = smooth(off, 90);
  const LP = new Float32Array((NL + 1) * 3), LH = new Float32Array((NL + 1) * 3), LK = new Float32Array(NL + 1), cum = new Float32Array(NL + 1);
  const rp = [];
  for (let i = 0; i <= NL; i++) { const p = cP[i].clone().addScaledVector(cL[i], off[i]); rp.push(p); LP.set([p.x, p.y, p.z], i * 3); }
  const lineHeads = [];
  for (let i = 0; i <= NL; i++) {
    const a = rp[Math.max(0, i - 1)], b = rp[Math.min(NL, i + 1)];
    const h = new THREE.Vector3().subVectors(b, a).normalize();
    lineHeads.push(h); LH.set([h.x, h.y, h.z], i * 3);
    if (i) cum[i] = cum[i - 1] + rp[i].distanceTo(rp[i - 1]);
  }
  for (let i = 1; i < NL; i++) {
    const lv = new THREE.Vector3().crossVectors(UP, lineHeads[i]).normalize();
    LK[i] = new THREE.Vector3().subVectors(lineHeads[i + 1], lineHeads[i - 1]).dot(lv) / Math.max(1e-4, cum[i + 1] - cum[i - 1]);
  }
  const LKs = smooth(LK, 14);
  const SL = cum[NL];

  const S_START = cum[Math.round(T_START * NL)], S_END = cum[Math.round(T_END * NL)];
  const ln = { p: new THREE.Vector3(), h: new THREE.Vector3(), k: 0, t: 0 };
  function sampleLine(s) {
    s = clamp(s, 0, SL);
    let lo = 0, hi = NL;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const k = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    ln.p.set(lerp(LP[lo * 3], LP[hi * 3], k), lerp(LP[lo * 3 + 1], LP[hi * 3 + 1], k), lerp(LP[lo * 3 + 2], LP[hi * 3 + 2], k));
    ln.h.set(lerp(LH[lo * 3], LH[hi * 3], k), lerp(LH[lo * 3 + 1], LH[hi * 3 + 1], k), lerp(LH[lo * 3 + 2], LH[hi * 3 + 2], k)).normalize();
    ln.k = lerp(LKs[lo], LKs[hi], k);
    ln.t = (lo + k) / NL;
    return ln;
  }

  /* ---------- car + sparks ---------- */
  const car = buildCar();
  scene.add(car.root);

  const SPARKS = 600;
  const spPos = new Float32Array(SPARKS * 3), spVel = new Float32Array(SPARKS * 3);
  const spLife = new Float32Array(SPARKS), spMax = new Float32Array(SPARKS), spFloor = new Float32Array(SPARKS);
  const spA = new Float32Array(SPARKS), spSize = new Float32Array(SPARKS);
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  spGeo.setAttribute('aA', new THREE.BufferAttribute(spA, 1));
  spGeo.setAttribute('aSize', new THREE.BufferAttribute(spSize, 1));
  const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial({
    vertexShader: `attribute float aA; attribute float aSize; varying float vA;
      void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * 260.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA;
        vec3 c = mix(vec3(3.0, 0.8, 0.15), vec3(4.0, 3.2, 1.6), vA); gl_FragColor = vec4(c * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  let spCursor = 0;
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function emitSparks(n, origin, vel, floorY) {
    for (let k = 0; k < n; k++) {
      const i = spCursor; spCursor = (spCursor + 1) % SPARKS;
      spPos[i * 3] = origin.x + (Math.random() - 0.5) * 0.3; spPos[i * 3 + 1] = origin.y; spPos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.3;
      spVel[i * 3] = vel.x * (0.7 + Math.random() * 0.2) + (Math.random() - 0.5) * 4;
      spVel[i * 3 + 1] = 0.8 + Math.random() * 3.5;
      spVel[i * 3 + 2] = vel.z * (0.7 + Math.random() * 0.2) + (Math.random() - 0.5) * 4;
      spMax[i] = spLife[i] = 0.2 + Math.random() * 0.45;
      spFloor[i] = floorY;
      spSize[i] = 0.05 + Math.random() * 0.08;
    }
  }
  function updateSparks(dt) {
    for (let i = 0; i < SPARKS; i++) {
      if (spLife[i] <= 0) { spA[i] = 0; continue; }
      spLife[i] -= dt;
      spVel[i * 3 + 1] -= 9.81 * dt;
      spVel[i * 3] *= 1 - 1.5 * dt; spVel[i * 3 + 2] *= 1 - 1.5 * dt;   // air drag on tiny particles
      spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
      if (spPos[i * 3 + 1] < spFloor[i]) { spPos[i * 3 + 1] = spFloor[i]; spVel[i * 3 + 1] *= -0.35; }
      spA[i] = Math.max(0, spLife[i] / spMax[i]);
    }
    spGeo.attributes.position.needsUpdate = true;
    spGeo.attributes.aA.needsUpdate = true;
    spGeo.attributes.aSize.needsUpdate = true;
  }

  /* ---------- post-processing ---------- */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  // only genuinely bright sources (lamps, LEDs, brake glow, sparks) bloom
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const aerialPos = new THREE.Vector3();
  function resize() {
    const r = container.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    composer.setPixelRatio(DPR);
    composer.setSize(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    const half = Math.tan(THREE.MathUtils.degToRad(25));
    const dist = (Math.max(size.z, size.x / camera.aspect) / 2 / half) * 1.15;
    aerialPos.set(center.x, dist * 0.9, center.z + dist * 0.45);
  }
  resize();
  window.addEventListener('resize', resize);

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  container.addEventListener('pointerleave', () => { mouse.x = mouse.y = 0; });

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(container);

  /* ---------- vehicle state ---------- */
  const veh = {
    s: S_START, v: 0, aLong: 0, aLat: 0, steer: 0, slip: 0, brakeHeat: 0, wheelAngle: 0,
    pitch: 0, pitchV: 0, roll: 0, rollV: 0, heave: 0, heaveV: 0, gSmooth: 0, rpm: 0,
  };
  // the scroll is the throttle: the car's position follows the scroll target through a
  // critically damped spring, so it never runs ahead, never lags far behind and stops when
  // you stop. Speed, g-forces and everything downstream are derived from that motion.
  const FOLLOW = 7;                      // rad/s, settles in ~0.6 s

  function stepVehicle(sTarget, h) {
    const here = sampleLine(veh.s);
    const a = FOLLOW * FOLLOW * (sTarget - veh.s) - 2 * FOLLOW * veh.v;
    veh.v += a * h;
    veh.s = clamp(veh.s + veh.v * h, 0, SL);
    if (Math.abs(sTarget - veh.s) < 0.02 && Math.abs(veh.v) < 0.05) { veh.v = 0; veh.s = sTarget; }
    const u = Math.abs(veh.v);
    // loads felt by the chassis, limited to what a real car can generate (~5 g)
    veh.aLong = clamp(a, -50, 35);       // along the car's nose
    veh.braking = Math.sign(a) !== Math.sign(veh.v) && Math.abs(a) > 12 && u > 3;
    veh.aLat = clamp(veh.v * veh.v * here.k, -45, 45);
    if (veh.braking) veh.brakeHeat += Math.min(Math.abs(a), 50) * Math.min(u, VMAX) * h * 0.00045;
    veh.brakeHeat *= Math.exp(-h * 0.5);

    // suspension: pitch, roll and heave as stiff, lightly damped springs
    const w = 2 * Math.PI * 2.4, z = 0.42;
    const bump = Math.sin(veh.s * 0.21) * Math.sin(veh.s * 0.057 + 1.3);
    const targets = [
      -veh.aLong * 0.00045,
      veh.aLat * 0.0004,
      -0.028 * (veh.v / VMAX) ** 2 - (bump > 0.35 ? 0.012 : 0),
    ];
    const keys = [['pitch', 'pitchV'], ['roll', 'rollV'], ['heave', 'heaveV']];
    keys.forEach(([x, xv], i) => {
      veh[xv] += (w * w * (targets[i] - veh[x]) - 2 * z * w * veh[xv]) * h;
      veh[x] += veh[xv] * h;
    });
    // kinematic steer (bicycle model) and a hint of oversteer on power/lateral load
    const steerT = clamp(Math.atan(WHEELBASE * here.k), -0.38, 0.38);
    veh.steer += (steerT - veh.steer) * Math.min(1, h * 10);
    veh.slip += (clamp(veh.aLat * 0.0011, -0.05, 0.05) - veh.slip) * Math.min(1, h * 4);
    veh.wheelAngle += (veh.v * h) / WHEEL_R;
    return bump;
  }

  let active = -2;
  function setActive(i) {
    if (i === active) return;
    active = i;
    laps.forEach((lap, k) => lap.classList.toggle('is-active', k === i));
    marks.forEach((m, k) => m.classList.toggle('is-passed', k <= i));
    gates.forEach((g, k) => { g.frame.emissiveIntensity = k <= i ? 0.35 : 0; g.signMat.color.setScalar(k <= i ? 1.6 : 0.6); g.passed = k <= i; });
    hud.sector.textContent = `${String(Math.max(0, i + 1)).padStart(2, '0')}/${String(gates.length).padStart(2, '0')}`;
  }
  setActive(-1);

  // camera offsets are sprung relative to the car, so the rig keeps up at 300+ km/h but still swings in corners
  const startP = sampleLine(S_START).p.clone();
  const camOff = new THREE.Vector3().subVectors(aerialPos, startP), camVel = new THREE.Vector3();
  const lookOff = new THREE.Vector3().subVectors(center, startP);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), fwd = new THREE.Vector3(), left = new THREE.Vector3();
  const clock = new THREE.Clock();
  let acc = 0, time = 0, last = { speed: '', gear: '', g: '' };

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!visible) return;
    time += dt;

    const p = state.progress;
    const sTarget = lerp(S_START, S_END, clamp((p - 0.05) / 0.9, 0, 1));

    // start lights: come on one by one as the scroll begins, go out when the car launches
    const lightsOn = p < 0.05 ? Math.floor(clamp(p / 0.045, 0, 1) * 5.999) : 0;
    bulbs.forEach((m, i) => m.color.setRGB(i < lightsOn ? 5 : 0.08, i < lightsOn ? 0.12 : 0.01, i < lightsOn ? 0.06 : 0.01));

    acc += dt;
    let bump = 0;
    while (acc >= DT) { bump = stepVehicle(sTarget, DT); acc -= DT; }

    // place the car on the racing line
    const ln2 = sampleLine(veh.s);
    // overview while the car sits on the grid and once it has taken the flag â€” driven by where
    // the car is, so the camera never lifts away while the car is still mid-lap
    const carFrac = clamp((ln2.t - T_START) / (T_END - T_START), 0, 1);
    const aerial = Math.min(1, 1 - smoothstep(0.0, 0.08, carFrac) + smoothstep(0.93, 0.995, carFrac));
    const ease = aerial * aerial * (3 - 2 * aerial);
    car.root.position.copy(ln2.p);
    fwd.copy(ln2.h);
    car.root.lookAt(tmpV.copy(ln2.p).add(fwd));
    car.root.rotateY(veh.slip);
    car.bodyPivot.position.y = 0.3 + veh.heave;
    car.bodyPivot.rotation.set(veh.pitch, 0, veh.roll);
    car.wheels.forEach((w) => {
      if (w.front) w.steer.rotation.y = veh.steer;
      w.spin.rotation.x = veh.wheelAngle;
      w.discMat.emissiveIntensity = clamp(veh.brakeHeat, 0, 1.4) * 3;
    });
    car.rainMat.color.setRGB(veh.braking && Math.floor(time * 8) % 2 ? 5 : 0.25, 0.01, 0.01);
    car.glowMat.color.setRGB(1.2 + Math.abs(veh.v) / VMAX * 2.5, 0.35 + Math.abs(veh.v) / VMAX * 0.6, 0.08);

    // sparks from the plank over bumps at high speed
    const u = Math.abs(veh.v);
    if (u > 34) {
      const rate = (u - 34) * (bump > 0.35 ? 12 : 0.8);
      const n = Math.floor(rate * dt + Math.random());
      if (n > 0) {
        car.root.updateMatrixWorld(true);
        car.plankEnd.getWorldPosition(tmpW);
        emitSparks(Math.min(n, 30), tmpW, tmpV.copy(fwd).multiplyScalar(veh.v), ln2.p.y + 0.01);
      }
    }
    updateSparks(dt);

    // floodlight key follows the car
    key.position.copy(ln2.p).add(tmpV.set(-14, 26, 10));
    key.target.position.copy(ln2.p);

    // camera: spring-damped chase rig blended with the aerial overview
    mouse.sx += (mouse.x - mouse.sx) * 0.05;
    mouse.sy += (mouse.y - mouse.sy) * 0.05;
    left.crossVectors(UP, fwd).normalize();
    const portrait = camera.aspect < 1;
    tPos.copy(ln2.p).addScaledVector(fwd, portrait ? -12 : -11).addScaledVector(UP, (portrait ? 5.5 : 3.6) - mouse.sy * 1.2)
      .addScaledVector(left, -mouse.sx * 3.5 + (portrait ? 0 : 2.2));
    tLook.copy(ln2.p).addScaledVector(fwd, portrait ? 3 : 9).addScaledVector(UP, portrait ? -1.5 : 1.0)
      .addScaledVector(left, portrait ? 0 : 5);
    tPos.lerp(aerialPos, ease);
    tLook.lerp(center, ease);
    const K = 42, C = 2 * Math.sqrt(K) * 0.85;
    tPos.sub(ln2.p);
    tLook.sub(ln2.p);
    camVel.addScaledVector(tmpV.subVectors(tPos, camOff), K * dt).addScaledVector(camVel, -C * dt);
    camOff.addScaledVector(camVel, dt);
    lookOff.lerp(tLook, Math.min(1, dt * 7));
    camPos.copy(ln2.p).add(camOff);
    camLook.copy(ln2.p).add(lookOff);
    camera.position.copy(camPos);
    const shake = (u / VMAX) ** 2 * 0.03 * (1 - ease);
    camera.position.x += Math.sin(time * 41) * shake;
    camera.position.y += Math.sin(time * 57 + 1) * shake;
    camera.lookAt(camLook);
    camera.fov = lerp(48 + (u / VMAX) * 12, 50, ease);
    camera.updateProjectionMatrix();

    gates.forEach((g) => {
      const sc = lerp(1, 3.2, ease);
      g.label.scale.set(g.label.userData.w * sc, g.label.userData.h * sc, 1);
      g.label.position.y = lerp(14, 22, ease);
      const near = smoothstep(40, 120, camera.position.distanceTo(g.group.position));
      g.label.material.opacity = Math.max(near, ease) * (g.passed ? 1 : 0.6);
    });
    scene.fog.near = lerp(45, 500, ease);
    scene.fog.far = lerp(280, 1400, ease);
    bloom.strength = lerp(0.5, 0.75, ease);
    section.style.setProperty('--aerial', aerial.toFixed(3));

    // milestones + HUD
    let idx = -1;
    gates.forEach((g, i) => { if (ln2.t >= g.t - 0.014) idx = i; });
    setActive(idx);
    bar.style.transform = `scaleX(${clamp((ln2.t - T_START) / span, 0, 1)})`;

    const kmh = String(Math.min(349, Math.round(u * 3.6))).padStart(3, '0');
    let gear = 'N', rpm = 0;
    if (veh.v < -0.4) { gear = 'R'; rpm = 5000 + u * 120; }
    else if (u > 0.4) {
      let gi = 1; while (gi < 8 && u > GEAR_TOPS[gi]) gi++;
      gear = String(gi);
      rpm = 4200 + ((u - GEAR_TOPS[gi - 1]) / (GEAR_TOPS[gi] - GEAR_TOPS[gi - 1])) * 8300;
    }
    veh.rpm += (rpm - veh.rpm) * Math.min(1, dt * 12);
    veh.gSmooth += (Math.hypot(veh.aLong, veh.aLat) / 9.81 - veh.gSmooth) * Math.min(1, dt * 6);
    const gTxt = veh.gSmooth.toFixed(1);
    if (kmh !== last.speed) { hud.speed.textContent = kmh; last.speed = kmh; }
    if (gear !== last.gear) { hud.gear.textContent = gear; last.gear = gear; }
    if (gTxt !== last.g) { hud.g.textContent = gTxt; last.g = gTxt; }
    hud.rpm.style.clipPath = `inset(0 ${(100 - clamp(veh.rpm / 13000, 0, 1) * 100).toFixed(1)}% 0 0)`;

    composer.render();
  }
  tick();
}

