/* global gsap, ScrollTrigger, Lenis */
gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const trackState = { progress: 0 };
const finePointer =window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------
   Text splitting
   --------------------------------------------------------- */
function splitWords(el) {
  const out = document.createDocumentFragment();
  const walk = (node, parent) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { parent.appendChild(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          outer.className = 'sw';
          const inner = document.createElement('span');
          inner.textContent = part;
          outer.appendChild(inner);
          parent.appendChild(outer);
        });
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const clone = n.cloneNode(false);
        parent.appendChild(clone);
        walk(n, clone);
      }
    });
  };
  walk(el, out);
  el.textContent = '';
  el.appendChild(out);
  return $$('.sw > span', el);
}

// chars are grouped per word so lines only break between words
function splitChars(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  const chars = [];
  words.forEach((w, i) => {
    const word = document.createElement('span');
    word.className = 'chw';
    [...w].forEach((c) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      word.appendChild(s);
      chars.push(s);
    });
    el.appendChild(word);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return chars;
}

function splitStatement(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  return words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'word';
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    return s;
  });
}

/* ---------------------------------------------------------
   Smooth scroll
   --------------------------------------------------------- */
let lenis = null;
if (!reducedMotion && typeof Lenis !== 'undefined') {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
window.scrollTo(0, 0);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
}

/* ---------------------------------------------------------
   Cursor
   --------------------------------------------------------- */
function initCursor() {
  if (!finePointer) return;
  const cursor = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    cursor.classList.remove('is-hidden');
  });
  document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));

  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
  });

  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button');
    if (labelled && !(link && labelled.contains(link) && link !== labelled && link.closest('[data-magnetic]'))) {
      label.textContent = labelled.dataset.cursor;
      cursor.classList.add('is-label');
      cursor.classList.remove('is-hover');
    } else if (link) {
      cursor.classList.add('is-hover');
      cursor.classList.remove('is-label');
    } else {
      cursor.classList.remove('is-hover', 'is-label');
    }
  });
}

/* ---------------------------------------------------------
   Magnetic elements
   --------------------------------------------------------- */
function initMagnetic() {
  if (!finePointer) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.45);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------------------------------------------------------
   Nav, menu, anchors, clock
   --------------------------------------------------------- */
function initNav() {
  const nav = $('.nav'), burger = $('.nav__burger');
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    $('.menu').setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2 && id !== '#') return;
      e.preventDefault();
      setMenu(false);
      scrollToTarget(id === '#' ? '#top' : id);
    });
  });

  let last = 0;
  const onScroll = (y) => {
    if (document.body.classList.contains('menu-open')) return;
    nav.classList.toggle('is-hidden', y > 300 && y > last);
    last = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else window.addEventListener('scroll', () => onScroll(scrollY), { passive: true });
}

function initClock() {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const els = $$('.js-clock');
  const tick = () => { const s = `${fmt.format(new Date())} IST`; els.forEach((el) => { el.textContent = s; }); };
  tick();
  setInterval(tick, 1000);
  $$('.js-year').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

/* ---------------------------------------------------------
   Marquee (speeds up with scroll velocity)
   --------------------------------------------------------- */
function initMarquee() {
  const tween = gsap.to('.js-marquee', { xPercent: -50, ease: 'none', duration: 30, repeat: -1 });
  if (!lenis) return;
  lenis.on('scroll', ({ velocity }) => {
    gsap.to(tween, { timeScale: 1 + Math.min(Math.abs(velocity) * 0.25, 6), duration: 0.2, overwrite: true });
    gsap.to(tween, { timeScale: 1, duration: 1.2, delay: 0.2, ease: 'power2.out' });
  });
}

/* ---------------------------------------------------------
   Scroll-driven sections
   --------------------------------------------------------- */
function initScroll() {
  // hero parallax out
  gsap.to('.hero__portrait-inner', {
    yPercent: 10, scale: 0.9, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__bgtext', {
    yPercent: -40, opacity: 0.2, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to(['.hero__left', '.hero__right', '.hero__signature'], {
    y: -80, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: '30% top', end: '80% top', scrub: true },
  });

  // split headings
  $$('[data-split]').forEach((el) => {
    if (el.closest('.hero')) return;
    const words = splitWords(el);
    gsap.from(words, {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  // statement word-by-word light up
  const st = $('.js-statement');
  const words = splitStatement(st);
  gsap.to(words, {
    opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: st, start: 'top 80%', end: 'bottom 50%', scrub: true },
  });

  // generic reveals
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    onEnter: (els) => gsap.fromTo(els, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.07, overwrite: true }),
  });
  gsap.set('[data-reveal]', { opacity: 0 });

  // counters
  $$('.js-num').forEach((el) => {
    const to = Number(el.dataset.to), pad = Number(el.dataset.pad || 0);
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(obj, {
        v: to, duration: 2, ease: 'power3.out',
        onUpdate: () => { el.textContent = String(Math.round(obj.v)).padStart(pad, '0'); },
      }),
    });
  });

  // stats panel slides up over the previous section
  gsap.from('.stats', {
    borderRadius: '80px 80px 0 0', ease: 'none',
    scrollTrigger: { trigger: '.stats', start: 'top bottom', end: 'top 30%', scrub: true },
  });

  // horizontal season
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const track = $('.js-season-track'), intro = $('.season__intro');
    const bar = $('.js-season-bar'), round = $('.js-season-round');
    const cards = $$('.race', track);
    const dist = () => Math.max(0, track.scrollWidth - (innerWidth - intro.offsetWidth) + 24);

    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.season', start: 'top top', end: () => `+=${dist()}`,
        pin: '.season__pin', scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => {
          bar.style.transform = `scaleX(${self.progress})`;
          const idx = Math.min(cards.length, Math.floor(self.progress * cards.length) + 1);
          round.textContent = `R${String(idx).padStart(2, '0')}`;
        },
      },
    });

    cards.forEach((card) => {
      gsap.fromTo($('.race__num', card), { x: 120 }, {
        x: -60, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
      gsap.from(card, {
        rotate: 4, yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'left 55%', scrub: true },
      });
    });
  });

  // career race track: pin the section and feed scroll progress to the 3D scene
  if (document.documentElement.classList.contains('has-webgl')) {
    document.documentElement.classList.add('has-track');
    ScrollTrigger.create({
      trigger: '.career', start: 'top top', end: () => `+=${innerHeight * 7}`,
      pin: '.career__pin', anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => { trackState.progress = self.progress; },
    });
  } else {
    gsap.from('.lap', { y: 50, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.laps', start: 'top 85%' } });
  }

  // contact big text
  const lines = $$('.contact__line');
  lines.forEach((line) => {
    const chars = splitChars(line);
    gsap.from(chars, {
      yPercent: 100, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.025,
      scrollTrigger: { trigger: line, start: 'top 90%' },
    });
    chars.forEach((c) => c.addEventListener('pointerenter', () => {
      c.classList.add('is-on');
      setTimeout(() => c.classList.remove('is-on'), 650);
    }));
  });

  // footer signature write-on
  gsap.fromTo('.footer__sign', { clipPath: 'inset(0 100% 0 0)' }, {
    clipPath: 'inset(0 0% 0 0)', ease: 'none',
    scrollTrigger: { trigger: '.footer', start: 'top 95%', end: 'bottom bottom', scrub: true },
  });
}

/* ---------------------------------------------------------
   Hero mouse parallax
   --------------------------------------------------------- */
function initHeroParallax() {
  if (!finePointer) return;
  const bx = gsap.quickTo('.js-hero-word', 'x', { duration: 1.2, ease: 'power3.out' });
  const by = gsap.quickTo('.js-hero-word', 'y', { duration: 1.2, ease: 'power3.out' });
  const gx = gsap.quickTo('.hero__glow', 'x', { duration: 1.6, ease: 'power3.out' });
  const gy = gsap.quickTo('.hero__glow', 'y', { duration: 1.6, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    bx(nx * -40); by(ny * -20);
    gx(nx * 120); gy(ny * 80);
  });
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
async function boot() {
  initCursor();
  initNav();
  initClock();

  const heroWordChars = splitChars($('.js-hero-word'));
  const heroTitleWords = splitWords($('.hero__title'));
  gsap.set(heroWordChars, { yPercent: 110 });
  gsap.set(heroTitleWords, { yPercent: 110 });
  gsap.set(['.nav', '.hero__right', '.hero__left .eyebrow', '.hero__scroll'], { opacity: 0 });

  // loader counter
  const countEl = $('.js-count'), barEl = $('.loader__bar span');
  const counter = { v: 0 };
  const loaderIn = gsap.timeline()
    .to('.loader__line > span', { y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 })
    .to(counter, {
      v: 100, duration: 2.4, ease: 'power2.inOut',
      onUpdate: () => {
        countEl.textContent = Math.round(counter.v);
        barEl.style.transform = `scaleX(${counter.v / 100})`;
      },
    }, 0.1);

  // WebGL scenes
  let hero = null;
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  try {
    const { initHero } = await import('./hero.js');
    hero = initHero($('.js-hero-canvas'), 'assets/aadil-cutout.webp', { gsap });
    document.documentElement.classList.add('has-webgl');
  } catch (err) {
    console.warn('WebGL hero unavailable, using image fallback.', err);
  }

  const timeout = new Promise((r) => setTimeout(r, 5000));
  await Promise.race([Promise.all([fontsReady, hero ? hero.ready : Promise.resolve()]), timeout]);
  await loaderIn.then();

  fontsReady.then(async () => {
    try {
      const [{ initGarage }, { initMedal }, { initTrack }] = await Promise.all([import('./garage.js'), import('./medal.js'), import('./track.js')]);
      initGarage($('.js-garage'));
      initMedal($('.js-medal'));
      if (document.documentElement.classList.contains('has-track')) initTrack($('.js-track'), trackState);
    } catch (err) {
      console.warn('3D sections unavailable.', err);
    }
  });

  initMagnetic();
  initMarquee();
  initScroll();
  initHeroParallax();

  // loader out + hero intro
  const tl = gsap.timeline({
    onComplete: () => {
      document.body.classList.remove('is-loading');
      $('.loader').remove();
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
    },
  });
  tl.to('.loader__line > span', { yPercent: -105, duration: 0.6, ease: 'power3.in', stagger: 0.05 })
    .to('.loader__row', { opacity: 0, duration: 0.3 }, '<')
    .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
    .add(() => { if (hero) hero.intro(2.2); else gsap.from('.hero__img', { opacity: 0, y: 60, duration: 1.4, ease: 'expo.out' }); }, '-=0.6')
    .to(heroWordChars, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05 }, '-=0.5')
    .to(heroTitleWords, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.05 }, '-=1.0')
    .to(['.nav', '.hero__right', '.hero__left .eyebrow', '.hero__scroll'], { opacity: 1, duration: 0.8, stagger: 0.08 }, '-=1.0')
    .to('.hero__signature', { clipPath: 'inset(0 0% 0 0)', duration: 1.8, ease: 'power2.inOut' }, '-=0.4');
}

boot();

