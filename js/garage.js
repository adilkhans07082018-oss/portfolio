// Tech stack sphere: text sprites on a Fibonacci sphere around a wireframe core.
import * as THREE from 'three';

const TECH = [
  'WordPress', 'Elementor', 'Shopify', 'HTML5', 'CSS3', 'JavaScript', 'Photoshop', 'Illustrator',
  'CorelDraw', 'Figma', 'Lightroom', 'Premiere Pro', 'Linux', 'Windows', 'cPanel', 'DNS & Hosting',
  'SSL Setup', 'Localhost', 'SEO Basics', 'Email Mktg', 'Social Ads', 'Content Mgt', 'Antigravity', 'ChatGPT',
  'Claude', 'Gemini', 'Google Flow', 'Photography',
];
const HOT = new Set(['WordPress', 'Shopify', 'Figma', 'Photoshop', 'HTML5', 'Antigravity', 'Photography']);

function makeLabel(text, hot) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `900 64px "Big Shoulders Display", "Arial Narrow", sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text.toUpperCase()).width) + 48;
  c.width = w; c.height = 96;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = hot ? '#00d2ff' : '#f2f1e9';
  ctx.fillText(text.toUpperCase(), 24, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return { tex, aspect: w / 96 };
}

export function initGarage(container) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const root = new THREE.Group();
  scene.add(root);

  const R = 2.7;
  const core = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.35, 1)),
    new THREE.LineBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.35 })
  );
  root.add(core);
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R * 0.98, 3)),
    new THREE.LineBasicMaterial({ color: 0xf2f1e9, transparent: true, opacity: 0.04 })
  );
  root.add(shell);

  // orbit ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.12, 0.006, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2.3;
  scene.add(ring);

  // labels on fibonacci sphere
  const N = TECH.length;
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
  const sprites = [];

  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    const pos = new THREE.Vector3(Math.cos(theta) * r * R, y * R, Math.sin(theta) * r * R);

    const { tex, aspect } = makeLabel(TECH[i], HOT.has(TECH[i]));
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    const h = 0.38;
    sp.scale.set(h * aspect, h, 1);
    sp.userData = { basePos: pos.clone() };
    root.add(sp);
    sprites.push(sp);
  }

  // drag interaction
  let isDown = false, px = 0, py = 0, vx = 0.0015, vy = 0.004;
  let qStart = new THREE.Quaternion();

  container.addEventListener('pointerdown', (e) => {
    isDown = true;
    px = e.clientX; py = e.clientY;
    qStart.copy(root.quaternion);
    container.setPointerCapture?.(e.pointerId);
  });
  window.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    vx = dx * 0.004; vy = dy * 0.004;
    px = e.clientX; py = e.clientY;
    const axis = new THREE.Vector3(dy, dx, 0).normalize();
    const angle = Math.hypot(dx, dy) * 0.006;
    if (angle > 0.0001) {
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      root.quaternion.premultiply(q);
    }
  });
  const up = () => { isDown = false; };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // visibility: only animate when in view
  let inView = false;
  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }, { threshold: 0.1 });
  io.observe(container);

  const forward = new THREE.Vector3();
  const spPos = new THREE.Vector3();

  function tick() {
    requestAnimationFrame(tick);
    if (!inView) return;

    if (!isDown) {
      // auto drift
      vx *= 0.95; vy *= 0.95;
      const ax = 0.0025 + vx, ay = 0.0012 + vy;
      root.rotation.y += ax;
      root.rotation.x += ay;
    }
    core.rotation.y -= 0.004;
    ring.rotation.z += 0.0015;

    // fade labels on the backside of the sphere
    camera.getWorldDirection(forward);
    sprites.forEach((sp) => {
      sp.getWorldPosition(spPos);
      const dot = spPos.dot(camera.position);
      const d = THREE.MathUtils.clamp((spPos.z + R * 0.2) / (R * 1.2), 0, 1);
      sp.material.opacity = 0.2 + d * 0.8;
      const s = 0.85 + d * 0.25;
      sp.scale.y = 0.38 * s;
      sp.scale.x = sp.scale.y * (sp.material.map.image.width / sp.material.map.image.height);
    });

    renderer.render(scene, camera);
  }
  tick();
}
