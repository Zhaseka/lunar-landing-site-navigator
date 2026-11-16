// South-pole illumination map: share of 2027 each point sees the Sun, Earth,
// or both, from pipeline/build_illumination.py (LOLA horizons + JPL DE421).
import { fitCanvas } from './charts.js';
import { fmtLat, fmtLon } from './sites.js';

const R_KM = 1737.4;
const LAYERS = {
  sun: { idx: 1, stops: [[0, [8, 10, 14]], [0.35, [120, 70, 10]], [0.75, [255, 194, 77]], [1, [255, 244, 214]]], label: 'sunlight' },
  earth: { idx: 2, stops: [[0, [8, 10, 14]], [0.4, [30, 60, 140]], [0.8, [122, 162, 255]], [1, [226, 236, 255]]], label: 'Earth in view' },
  both: { idx: 3, stops: [[0, [8, 10, 14]], [0.3, [30, 90, 50]], [0.65, [158, 230, 168]], [1, [236, 255, 238]]], label: 'Sun and Earth together' },
};

function ramp(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return c0.map((c, j) => c + (c1[j] - c) * k);
    }
  }
  return stops[stops.length - 1][1];
}

// Stereographic (south pole) <-> lat/lon, matching the pipeline
const toLatLon = (xKm, yKm) => {
  const rho = Math.hypot(xKm, yKm);
  return { lat: (2 * Math.atan(rho / (2 * R_KM)) - Math.PI / 2) * 180 / Math.PI, lon: Math.atan2(xKm, yKm) * 180 / Math.PI };
};
const toXY = (lat, lon) => {
  const rho = 2 * R_KM * Math.tan(((45 + lat / 2) * Math.PI) / 180);
  return { x: rho * Math.sin((lon * Math.PI) / 180), y: rho * Math.cos((lon * Math.PI) / 180) };
};

export async function initIllumination(root, { sites, onPick }) {
  const canvas = root.querySelector('[data-illum]');
  let meta, bytes;
  try {
    const base = `${import.meta.env?.BASE_URL ?? '/'}data/`;
    [meta, bytes] = await Promise.all([
      fetch(base + 'illumination.json').then((r) => r.json()),
      fetch(base + 'illumination.bin').then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
    ]);
  } catch {
    root.querySelector('[data-illum-readout]').innerHTML = '<p class="ro-main">The map data did not load.</p>';
    return;
  }
  const n = meta.n, half = meta.halfKm, px = (2 * half) / (n - 1);
  const layer = (i) => bytes.subarray(i * n * n, (i + 1) * n * n);
  const shade = layer(0);
  let current = 'sun';
  let cursor = null; // {i, j}

  // Pre-render each layer at native resolution
  const images = {};
  for (const [key, L] of Object.entries(LAYERS)) {
    const v = layer(L.idx);
    const off = document.createElement('canvas'); off.width = n; off.height = n;
    const ctx = off.getContext('2d'); const img = ctx.createImageData(n, n);
    for (let k = 0; k < n * n; k++) {
      const s = shade[k] / 255;
      const c = ramp(L.stops, v[k] / 100);
      const lightK = v[k] === 0 ? 0.22 + 0.5 * s : 0.45 + 0.75 * s; // terrain shows through, even in shadow
      img.data[k * 4] = Math.min(255, c[0] * lightK + (v[k] === 0 ? 14 * s : 0));
      img.data[k * 4 + 1] = Math.min(255, c[1] * lightK + (v[k] === 0 ? 16 * s : 0));
      img.data[k * 4 + 2] = Math.min(255, c[2] * lightK + (v[k] === 0 ? 22 * s : 0));
      img.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    images[key] = off;
  }

  // Markers: curated sites inside the map, Shackleton crater, the pole, and the best point
  const inside = (p) => Math.abs(p.x) <= half && Math.abs(p.y) <= half;
  const sunL = layer(1);
  let best = 0; for (let k = 1; k < n * n; k++) if (sunL[k] > sunL[best]) best = k;
  const bestXY = { x: -half + (best % n) * px, y: half - Math.floor(best / n) * px };
  const marks = [
    ...sites.map((s) => ({ ...toXY(s.lat, s.lon), label: s.name, site: s })).filter(inside),
    { ...toXY(-89.67, 129.78), label: 'Shackleton crater', feature: true },
    { x: 0, y: 0, label: 'South pole', feature: true },
    { ...bestXY, label: `Best-lit pixel, ${sunL[best]}%`, feature: true, best: true },
  ];

  const geom = () => {
    const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
    const size = Math.min(w, h);
    return { size, ox: (w - size) / 2, oy: (h - size) / 2 };
  };
  const toPx = (x, y) => { const g = geom(); return [g.ox + ((x + half) / (2 * half)) * g.size, g.oy + ((half - y) / (2 * half)) * g.size]; };

  const draw = () => {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const g = geom();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(images[current], g.ox, g.oy, g.size, g.size);

    // Scale bar: 10 km
    const bar = (10 / (2 * half)) * g.size;
    ctx.fillStyle = 'rgba(244,243,238,.9)';
    ctx.fillRect(g.ox + 16, g.oy + g.size - 22, bar, 2);
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'bottom';
    ctx.fillText('10 KM', g.ox + 16, g.oy + g.size - 27);

    // Markers
    ctx.textBaseline = 'middle';
    for (const m of marks) {
      const [x, y] = toPx(m.x, m.y);
      ctx.strokeStyle = m.best ? '#FFC24D' : '#F4F3EE'; ctx.lineWidth = 1.5;
      if (m.feature && !m.best) { ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, m.best ? 9 : 6, 0, Math.PI * 2); ctx.stroke(); }
      // Skip the best-pixel label when a named site is right next to it
      if (m.best && marks.some((o) => o.site && Math.hypot(o.x - m.x, o.y - m.y) < 2)) continue;
      const label = m.label.toUpperCase();
      const tw = ctx.measureText(label).width;
      const lx = x + tw + 22 > g.ox + g.size ? x - tw - 18 : x + 10;
      ctx.fillStyle = 'rgba(5,7,10,.72)'; ctx.fillRect(lx - 4, y - 8, tw + 8, 16);
      ctx.fillStyle = m.best ? '#FFC24D' : '#F4F3EE'; ctx.fillText(label, lx, y);
    }

    if (cursor) {
      const [x, y] = toPx(-half + cursor.j * px, half - cursor.i * px);
      ctx.strokeStyle = '#F4F3EE'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x - 11, y); ctx.moveTo(x + 11, y); ctx.lineTo(x + 15, y);
      ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 11); ctx.moveTo(x, y + 11); ctx.lineTo(x, y + 15); ctx.stroke();
    }
    drawRamp();
  };

  const rampCanvas = root.querySelector('[data-illum-ramp]');
  const drawRamp = () => {
    const { ctx, w, h } = fitCanvas(rampCanvas);
    for (let x = 0; x < w; x++) { const c = ramp(LAYERS[current].stops, x / (w - 1)); ctx.fillStyle = `rgb(${c.map(Math.round).join(',')})`; ctx.fillRect(x, 0, 1, h); }
  };

  const out = root.querySelector('[data-illum-readout]');
  const readout = () => {
    if (!cursor) return;
    const k = cursor.i * n + cursor.j;
    const x = -half + cursor.j * px, y = half - cursor.i * px;
    const ll = toLatLon(x, y);
    const s = layer(1)[k], e = layer(2)[k], b = layer(3)[k];
    const verdict = s === 0 ? 'Permanent shadow: no sunlight all year.' : s >= 70 ? 'Well lit: a strong candidate for a solar-powered lander.' : s >= 40 ? 'Lit about half the time.' : 'Mostly in shadow.';
    out.innerHTML = `<p class="mono">${fmtLat(ll.lat)}, ${fmtLon(ll.lon)}, ${Math.hypot(x, y).toFixed(1)} km from the pole</p>
      <p class="ro-main"><span class="sun-ink">${s}%</span> sunlight <span class="ro-days">(${Math.round(s * 3.65)} days)</span></p>
      <p class="ro-sub"><span class="earth-ink">${e}%</span> Earth in view, ${b}% both</p>
      <p class="ro-sub">${verdict}</p>`;
    canvas.setAttribute('aria-label', `Illumination map. Selected point ${fmtLat(ll.lat)}, ${fmtLon(ll.lon)}: ${s}% sunlight, ${e}% Earth in view, ${b}% both in 2027.`);
  };

  const fromEvent = (ev) => {
    const r = canvas.getBoundingClientRect(), g = geom();
    const fx = (ev.clientX - r.left - g.ox) / g.size, fy = (ev.clientY - r.top - g.oy) / g.size;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    return { i: Math.round(fy * (n - 1)), j: Math.round(fx * (n - 1)) };
  };
  canvas.addEventListener('pointermove', (ev) => { const c = fromEvent(ev); if (c) { cursor = c; readout(); draw(); } });
  canvas.addEventListener('pointerdown', (ev) => { const c = fromEvent(ev); if (c) { cursor = c; readout(); draw(); } });
  canvas.addEventListener('keydown', (ev) => {
    const step = ev.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [-step, 0], ArrowDown: [step, 0] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    cursor = cursor || { i: n >> 1, j: n >> 1 };
    cursor = { i: Math.max(0, Math.min(n - 1, cursor.i + d[0])), j: Math.max(0, Math.min(n - 1, cursor.j + d[1])) };
    readout(); draw();
  });
  canvas.addEventListener('focus', () => { if (!cursor) { cursor = { i: Math.floor(best / n), j: best % n }; readout(); draw(); } });

  root.querySelectorAll('input[name="illum-layer"]').forEach((r) => r.addEventListener('change', () => { if (r.checked) { current = r.value; draw(); } }));

  // Site list beneath: jump to the navigator, or put the cursor on a point
  const list = root.querySelector('[data-illum-sites]');
  list.innerHTML = '';
  for (const m of marks) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'illum-site';
    const k = Math.round((half - m.y) / px) * n + Math.round((m.x + half) / px);
    btn.innerHTML = `<span>${m.label}</span><span class="mono">${layer(1)[k]}% sun, ${layer(2)[k]}% Earth</span>`;
    btn.addEventListener('click', () => {
      cursor = { i: Math.round((half - m.y) / px), j: Math.round((m.x + half) / px) }; readout(); draw();
      if (m.site && onPick) onPick(m.site);
    });
    if (m.site) btn.title = 'Show here and open in the navigator';
    li.append(btn); list.append(li);
  }

  new ResizeObserver(draw).observe(canvas);
  draw();
}
