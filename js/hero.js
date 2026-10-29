// Hero portrait: WebGL shader with a cursor-driven "reveal" trail.
// Under the cursor the photo melts into a lime halftone / telemetry layer,
// a nod to the helmet-reveal on landonorris.com.
import * as THREE from 'three';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform sampler2D uTrail;
  uniform vec2 uRes;      // canvas size, css px
  uniform vec2 uMouse;    // -1..1 parallax
  uniform float uTime;
  uniform float uIntro;   // 0 -> 1 on load
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 px = vUv * uRes;
    float trail = texture2D(uTrail, vUv).r;

    // liquid displacement inside the trail
    float n1 = noise(vUv * 9.0 + uTime * 0.6);
    float n2 = noise(vUv * 9.0 - uTime * 0.6 + 4.0);
    vec2 disp = (vec2(n1, n2) - 0.5) * trail * 0.035;
    vec2 uv = vUv + disp + uMouse * vec2(-0.006, 0.004);

    vec4 tex = texture2D(uTex, uv);
    float a = tex.a;

    // base grade: crisp mono with a faint warm lift
    float l = lum(tex.rgb);
    l = smoothstep(0.02, 0.95, l);
    vec3 base = mix(vec3(0.055, 0.06, 0.045), vec3(0.96, 0.95, 0.91), l);

    // halftone layer sampled per cell
    float cell = 7.0;
    vec2 g = px / cell;
    vec2 cc = (floor(g) + 0.5) * cell / uRes + disp;
    vec4 ct = texture2D(uTex, cc + uMouse * vec2(-0.006, 0.004));
    float cl = lum(ct.rgb);
    float r = mix(0.1, 0.62, pow(cl, 0.85));
    float d = length(fract(g) - 0.5);
    float dotm = smoothstep(r, r - 0.12, d);
    vec3 lime = vec3(0.824, 1.0, 0.0);
    vec3 olive = vec3(0.09, 0.1, 0.07);
    vec3 half_ = mix(olive, lime, dotm);
    // scanline + grid telemetry
    float scan = step(0.5, fract(px.y / 3.0)) * 0.08;
    half_ += scan * lime;
    float ra = smoothstep(0.25, 0.75, ct.a);

    // reveal mask with a noisy, living edge
    float edgeN = noise(px * 0.012 + uTime * 0.35);
    float m = smoothstep(0.18, 0.55, trail + (edgeN - 0.5) * 0.35 * trail);

    // intro wipe from the bottom with a halftone leading edge
    float y = vUv.y + (noise(vec2(vUv.x * 7.0, uTime * 0.2)) - 0.5) * 0.08;
    float front = uIntro * 1.4 - 0.2;
    float vis = 1.0 - smoothstep(front - 0.02, front, y);
    float band = smoothstep(front - 0.28, front - 0.02, y) * vis;
    m = max(m, band * (1.0 - smoothstep(0.95, 1.0, uIntro)));

    vec3 col = mix(base, half_, m);
    float alpha = mix(a, ra, m) * vis;

    // rim light where the trail touches the silhouette edge
    float rim = smoothstep(0.0, 0.5, a) * (1.0 - smoothstep(0.5, 1.0, a));
    col += lime * rim * m * 0.6;

    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

export function initHero(container, imgSrc, { gsap }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // trail is painted into a small 2D canvas and uploaded as a texture
  const trail = document.createElement('canvas');
  const tctx = trail.getContext('2d');
  const trailTex = new THREE.CanvasTexture(trail);
  trailTex.minFilter = THREE.LinearFilter;

  const uniforms = {
    uTex: { value: null },
    uTrail: { value: trailTex },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uIntro: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, blending: THREE.NoBlending, depthTest: false });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const ready = new Promise((resolve) => {
    new THREE.TextureLoader().load(imgSrc, (t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      uniforms.uTex.value = t;
      resolve();
    });
  });

  let W = 1, H = 1, scale = 0.25;
  function resize() {
    const r = container.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    uniforms.uRes.value.set(W, H);
    trail.width = Math.round(W * scale);
    trail.height = Math.round(H * scale);
  }
  resize();
  window.addEventListener('resize', resize);

  // pointer state (container-local, css px)
  const pointer = { x: -999, y: -999, px: -999, py: -999, inside: false, nx: 0, ny: 0 };
  const smooth = { nx: 0, ny: 0 };
  const isTouch = !window.matchMedia('(hover: hover)').matches;

  window.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.inside = pointer.x > -80 && pointer.y > -80 && pointer.x < r.width + 80 && pointer.y < r.height + 80;
    pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ny = (e.clientY / window.innerHeight) * 2 - 1;
  });

  function paint(x, y, radius, strength) {
    const g = tctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(255,255,255,${strength})`);
    g.addColorStop(0.55, `rgba(255,255,255,${strength * 0.55})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    tctx.fillStyle = g;
    tctx.beginPath();
    tctx.arc(x, y, radius, 0, Math.PI * 2);
    tctx.fill();
  }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(container);

  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    if (visible) {
      // fade previous trail
      tctx.globalCompositeOperation = 'source-over';
      tctx.fillStyle = 'rgba(0,0,0,0.055)';
      tctx.fillRect(0, 0, trail.width, trail.height);

      let x = pointer.x, y = pointer.y, active = pointer.inside;
      if (isTouch) {
        // wandering reveal on touch devices
        x = W * (0.5 + 0.28 * Math.sin(t * 0.7));
        y = H * (0.35 + 0.18 * Math.sin(t * 1.1 + 1.3));
        active = true;
      }
      if (active) {
        const base = Math.min(W, H) * 0.16 * scale;
        const dx = x - pointer.px, dy = y - pointer.py;
        const dist = Math.hypot(dx, dy);
        const steps = pointer.px < -900 ? 1 : Math.min(24, Math.ceil(dist / 8));
        const radius = base + Math.min(dist * 0.12, 30) * scale;
        for (let i = 1; i <= steps; i++) {
          const k = i / steps;
          const sx = pointer.px < -900 ? x : pointer.px + dx * k;
          const sy = pointer.py < -900 ? y : pointer.py + dy * k;
          paint(sx * scale, sy * scale, radius, 0.35);
        }
        pointer.px = x; pointer.py = y;
      } else {
        pointer.px = pointer.py = -999;
      }
      trailTex.needsUpdate = true;

      smooth.nx += (pointer.nx - smooth.nx) * 0.06;
      smooth.ny += (pointer.ny - smooth.ny) * 0.06;
      uniforms.uMouse.value.set(smooth.nx, smooth.ny);

      if (uniforms.uTex.value) renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  }
  tick();

  return {
    ready,
    intro(duration = 2.2, delay = 0) {
      return gsap.to(uniforms.uIntro, { value: 1, duration, delay, ease: 'power2.inOut' });
    },
  };
}
