// Reference-inspired pieces: scroll-filled statement text, a wireframe globe
// of the landing sites, and a drag-to-compare horizon slider.
import { analyse } from './analysis.js';
import { drawSkyPlot, fitCanvas } from './charts.js';

// ---- Statement: words fill in as the section scrolls past -----------------
export function initReveal(el, section, { reducedMotion }) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = words.map((w) => `<span aria-hidden="true">${w}</span>`).join(' ');
  const spans = [...el.children];
  if (reducedMotion) { spans.forEach((s) => s.classList.add('on')); return; }
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = section.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    const n = Math.round(p * 1.25 * spans.length);
    spans.forEach((s, i) => s.classList.toggle('on', i < n));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// ---- Wireframe globe with labelled sites ------------------------------------
const D = Math.PI / 180;
const v3 = (lat, lon) => [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function initWire(canvas, sites, { reducedMotion }) {
  const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random() * 0.62, Math.random()]);
  const short = (s) => (s.mission.split(',')[0]).replace(' candidate region', '').replace(' target region', '');
  let lon0 = 20, visible = true;

  const draw = () => {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w * 0.46, h * 0.95);
    const cx = w / 2, cy = h + R * 0.28;
    const c = v3(-62, lon0), e = [-Math.sin(lon0 * D), Math.cos(lon0 * D), 0];
    const n = [c[1] * e[2] - c[2] * e[1], c[2] * e[0] - c[0] * e[2], c[0] * e[1] - c[1] * e[0]];
    const P = (lat, lon) => { const v = v3(lat, lon); return [cx + dot(v, e) * R, cy - dot(v, n) * R, dot(v, c)]; };

    for (const [x, y, s] of stars) {
      ctx.fillStyle = `rgba(17,17,17,${0.25 + s * 0.6})`;
      const sz = 1 + s * 2.5; ctx.fillRect(x * w, y * h, sz, sz);
    }
    const line = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0, z0] = pts[i - 1], [x1, y1, z1] = pts[i];
        if (z0 < 0 && z1 < 0) continue;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    };
    ctx.strokeStyle = 'rgba(63,120,255,0.75)'; ctx.lineWidth = 1;
    for (let lat = -75; lat <= 75; lat += 15) line(Array.from({ length: 121 }, (_, i) => P(lat, i * 3)));
    for (let lon = 0; lon < 360; lon += 30) line(Array.from({ length: 61 }, (_, i) => P(-90 + i * 3, lon)));
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(63,120,255,0.9)'; ctx.stroke();

    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
    for (const s of sites) {
      const [x, y, z] = P(s.lat, s.lon);
      if (z < 0.05 || y > h - 4) continue;
      ctx.fillStyle = '#111'; ctx.fillRect(x - 3, y - 3, 6, 6);
      const label = short(s).toUpperCase();
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(231,230,227,0.85)'; ctx.fillRect(x + 7, y - 7, tw + 8, 14);
      ctx.fillStyle = '#111'; ctx.fillText(label, x + 11, y);
    }
  };
  new ResizeObserver(draw).observe(canvas);
  if (reducedMotion) return;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
  let last = performance.now();
  const loop = (t) => {
    if (visible) { lon0 += (t - last) * 0.004; draw(); }
    last = t; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---- Drag comparison: smooth sphere vs LOLA terrain ---------------------
export function initSlider(root, site) {
  const start = new Date(); start.setUTCMinutes(0, 0, 0);
  const terrain = analyse(site, start, { horizon: 'terrain' });
  const flat = analyse(site, start, { horizon: 'flat' });
  // Pick a moment where the two models disagree about the Sun
  let idx = 0;
  for (let i = 0; i < terrain.times.length; i++) if ((terrain.sunVis[i] > 0.5) !== (flat.sunVis[i] > 0.5)) { idx = i; break; }
  const a = root.querySelector('[data-slider-a]'), b = root.querySelector('[data-slider-b]');
  const clip = root.querySelector('[data-slider-clip]'), handle = root.querySelector('[data-slider-handle]');
  const range = root.querySelector('[data-slider-range]');
  const draw = () => {
    drawSkyPlot(b, terrain, idx);
    flat._center = terrain._center; flat._eHi = terrain._eHi;
    drawSkyPlot(a, flat, idx);
  };
  const set = (v) => { root.style.setProperty('--x', `${v}%`); };
  range.addEventListener('input', () => set(range.value));
  set(range.value);
  new ResizeObserver(draw).observe(a);
  const cap = document.querySelector('[data-slider-cap]');
  const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(terrain.times[idx]));
  const lostH = ((flat.metrics.sunlitPct - terrain.metrics.sunlitPct) / 100) * terrain.days * 24;
  cap.textContent = `${site.name} (${site.mission}), ${when} UTC. Over the next lunar day the surrounding massifs cost ${Math.max(0, lostH).toFixed(0)} hours of sunlight compared with a smooth Moon. Drag to compare.`;
  void clip; void handle; void fitCanvas;
}
