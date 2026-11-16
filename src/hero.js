// Hero: a photoreal Moon (NASA LRO textures) lit by the Sun's real current
// direction, seen from below the south pole, inside an inset card.
import * as THREE from 'three';
import { lunarGeometry, skyAt } from './ephemeris.js';
import { horizonMask } from './horizon.js';
import { SITE_BY_ID } from './sites.js';
import { createMoon, createStars, toThree } from './moon3d.js';

const SITE = SITE_BY_ID['shackleton-ridge'];

export function startHero(canvas, liveEl, card, { reducedMotion }) {
  const live = () => {
    const now = new Date();
    const s = skyAt(SITE, now, lunarGeometry(now));
    const mask = horizonMask(SITE, 'terrain');
    const sunVis = s.sun.el > mask(s.sun.az), earthVis = s.earth.el > mask(s.earth.az);
    const fmt = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}°`;
    liveEl.innerHTML = `Sun <b class="sun-ink">${fmt(s.sun.el)}</b>, ${sunVis ? 'in view' : 'behind terrain'}.<br>Earth <b class="earth-ink">${fmt(s.earth.el)}</b>, ${earthVis ? 'in view' : 'below the skyline'}.`;
  };
  live();
  setInterval(live, 60000);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { canvas.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x05070a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const moon = createMoon({ hi: true });
  scene.add(moon.group, createStars());

  const geom = lunarGeometry(new Date());
  moon.setSun(geom.subSolar);
  // Look up at the south polar region, with the terminator crossing the view
  const baseLon = geom.subSolar.lon - 80;
  const place = (lonOffset) => {
    camera.position.copy(toThree(-38, baseLon + lonOffset, 3.3));
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  };
  place(0);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 44 : 30;
    // Push the Moon low in the frame so its limb arcs across the card
    camera.setViewOffset(w, h, 0, -h * (w < 700 ? 0.3 : 0.44), w, h);
    camera.updateProjectionMatrix();
    render();
  };
  const render = () => renderer.render(scene, camera);
  new ResizeObserver(resize).observe(canvas);
  THREE.DefaultLoadingManager.onLoad = render;

  // Helix-style: the card eases inward as you scroll away
  let scrollP = 0;
  const onScroll = () => {
    const p = window.scrollY / Math.max(1, window.innerHeight);
    scrollP = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
    if (!reducedMotion) card.style.setProperty('--p', scrollP.toFixed(3));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (reducedMotion) { resize(); return; }
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  const t0 = performance.now();
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const t = (performance.now() - t0) / 1000;
    place(t * 0.8 + scrollP * 25);
    render();
  });
}
