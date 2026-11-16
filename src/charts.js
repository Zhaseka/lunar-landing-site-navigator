// Canvas renderers: sky plot, visibility timeline, compact comparison strip.

const C = {
  sky0: '#05070A', sky1: '#0D1621', grid: 'rgba(233,234,230,0.08)', gridStrong: 'rgba(233,234,230,0.22)',
  text: '#B3B6B0', textStrong: '#E9EAE6', ground0: '#4F5257', ground1: '#24272D', rim: '#BDBFB9',
  sun: '#FFC24D', earth: '#7AA2FF', both: '#B7E0A0', none: '#252A34',
};

export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: canvas.clientWidth, h: canvas.clientHeight };
}

// Elevation scale that magnifies angles near the horizon
const K = 1.5;
const f = (e) => Math.asinh(e / K);

function circularMeanAz(azs, weights) {
  let x = 0, y = 0;
  for (let i = 0; i < azs.length; i++) {
    const w = weights ? weights[i] : 1;
    x += Math.cos((azs[i] * Math.PI) / 180) * w; y += Math.sin((azs[i] * Math.PI) / 180) * w;
  }
  if (Math.hypot(x, y) < 1e-6) return 180;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const CARDINALS = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];

export function drawSkyPlot(canvas, a, cursor) {
  const { ctx, w, h } = fitCanvas(canvas);
  const padL = 44, padR = 12, padT = 14, padB = 30;
  const pw = w - padL - padR, ph = h - padT - padB;

  // Centre the panorama on Earth if it is ever up, otherwise on the Sun's mean bearing
  if (a._center == null) {
    const anyEarth = a.earthEl.some((e) => e > -3);
    a._center = anyEarth ? circularMeanAz(a.earthAz) : circularMeanAz(a.sunAz, a.sunEl.map((e) => Math.max(0, e + 5)));
    let maxE = 2;
    for (let i = 0; i < a.sunEl.length; i++) { if (a.sunVis[i] > 0) maxE = Math.max(maxE, a.sunEl[i]); }
    for (let i = 0; i < a.earthEl.length; i++) { if (a.earthVis[i] > 0) maxE = Math.max(maxE, a.earthEl[i]); }
    for (const s of a.mask.samples) maxE = Math.max(maxE, s);
    a._eHi = Math.min(90, maxE + 2);
  }
  const center = a._center;
  const lo = f(-4), hi = f(a._eHi);
  const X = (az) => padL + ((((az - center + 180) % 360) + 360) % 360) / 360 * pw;
  const Y = (e) => padT + (1 - (f(e) - lo) / (hi - lo)) * ph;

  // Sky
  const g = ctx.createLinearGradient(0, padT, 0, Y(0));
  g.addColorStop(0, C.sky0); g.addColorStop(1, C.sky1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  // Elevation grid
  ctx.font = '11px Archivo, system-ui, sans-serif';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  let lastY = -1e9;
  for (const e of [90, 60, 45, 30, 20, 10, 5, 3, 2, 1, 0, -1, -2, -4]) {
    if (e > a._eHi) continue;
    const y = Y(e);
    if (Math.abs(y - lastY) < 16) continue;
    lastY = y;
    ctx.strokeStyle = e === 0 ? C.gridStrong : C.grid;
    ctx.setLineDash(e === 0 ? [4, 4] : []);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = C.text; ctx.fillText(`${e}°`, padL - 6, y);
  }
  ctx.setLineDash([]);

  // Azimuth ticks
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const [az, label] of CARDINALS) {
    const x = X(az);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); ctx.stroke();
    ctx.fillStyle = label.length === 1 ? C.textStrong : C.text;
    ctx.fillText(label, x, padT + ph + 8);
  }

  // Paths (drawn before terrain so the ground occludes the hidden parts)
  const n = a.times.length;
  const step = Math.max(1, Math.floor(n / 1400));
  const drawPath = (els, azs, vis, color) => {
    for (let i = 0; i < n; i += step) {
      const e = els[i];
      if (e < -4) continue;
      ctx.globalAlpha = vis[i] > 0.5 ? 0.9 : 0.22;
      ctx.fillStyle = color;
      ctx.fillRect(X(azs[i]) - 1, Y(e) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  };
  drawPath(a.sunEl, a.sunAz, a.sunVis, C.sun);
  drawPath(a.earthEl, a.earthAz, a.earthVis, C.earth);

  // Terrain
  const gg = ctx.createLinearGradient(0, Y(a._eHi * 0.3), 0, padT + ph);
  gg.addColorStop(0, C.ground0); gg.addColorStop(1, C.ground1);
  ctx.beginPath();
  ctx.moveTo(padL, padT + ph);
  for (let px = 0; px <= pw; px += 2) {
    const az = center - 180 + (px / pw) * 360;
    ctx.lineTo(padL + px, Y(a.mask(az)));
  }
  ctx.lineTo(padL + pw, padT + ph); ctx.closePath();
  ctx.globalAlpha = 0.86; ctx.fillStyle = gg; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let px = 0; px <= pw; px += 2) {
    const az = center - 180 + (px / pw) * 360;
    const y = Y(a.mask(az));
    px === 0 ? ctx.moveTo(padL + px, y) : ctx.lineTo(padL + px, y);
  }
  ctx.strokeStyle = C.rim; ctx.lineWidth = 1.25; ctx.stroke(); ctx.lineWidth = 1;

  // Current bodies
  const body = (el, az, vis, color, r) => {
    if (el < -4.5) return;
    const x = X(az), y = Y(el);
    if (vis > 0.5) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, color + '66'); glow.addColorStop(1, color + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    }
  };
  body(a.earthEl[cursor], a.earthAz[cursor], a.earthVis[cursor], C.earth, 7);
  body(a.sunEl[cursor], a.sunAz[cursor], a.sunVis[cursor], C.sun, 6);

  // Off-scale note for bodies far below the horizon
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.text;
  const below = [];
  if (a.sunEl[cursor] < -4.5) below.push(`Sun ${a.sunEl[cursor].toFixed(0)}°`);
  if (a.earthEl[cursor] < -4.5) below.push(`Earth ${a.earthEl[cursor].toFixed(0)}°`);
  if (below.length) ctx.fillText(`Below the plot: ${below.join(', ')}`, padL + 8, padT + ph - 8);
}

// Colour for a sample in a combined strip
function stateColor(sv, ev) {
  const s = sv > 0.5, e = ev > 0.5;
  return s && e ? C.both : s ? C.sun : e ? C.earth : C.none;
}

const fmtTick = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });

export function drawTimeline(canvas, a, cursor) {
  const { ctx, w, h } = fitCanvas(canvas);
  const n = a.times.length;
  const lanes = [
    { label: 'Sun', y: 2, arr: a.sunVis, color: C.sun },
    { label: 'Earth', y: 20, arr: a.earthVis, color: C.earth },
    { label: 'Both', y: 38, color: C.both, both: true },
  ];
  const lh = 14, padL = 44, pw = w - padL;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '11px Archivo, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  for (const L of lanes) {
    ctx.fillStyle = C.text; ctx.fillText(L.label, padL - 8, L.y + lh / 2);
    ctx.fillStyle = C.none; ctx.fillRect(padL, L.y, pw, lh);
    ctx.fillStyle = L.color;
    let runStart = -1;
    for (let i = 0; i <= n; i++) {
      const on = i < n && (L.both ? a.sunVis[i] > 0.5 && a.earthVis[i] > 0.5 : L.arr[i] > 0.5);
      if (on && runStart < 0) runStart = i;
      if (!on && runStart >= 0) {
        const x0 = padL + (runStart / (n - 1)) * pw, x1 = padL + (Math.min(i, n - 1) / (n - 1)) * pw;
        ctx.fillRect(x0, L.y, Math.max(1, x1 - x0), lh);
        runStart = -1;
      }
    }
  }
  // Date ticks
  const t0 = a.times[0], t1 = a.times[n - 1], span = t1 - t0;
  const year = span > 60 * 86400e3;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = C.text;
  const d = new Date(t0);
  d.setUTCHours(0, 0, 0, 0);
  if (year) d.setUTCDate(1);
  const stepDays = span > 60 * 86400e3 ? null : span > 20 * 86400e3 ? 4 : 2;
  let lastX = -1e9;
  while (d.getTime() <= t1) {
    if (d.getTime() >= t0) {
      const x = padL + ((d.getTime() - t0) / span) * pw;
      if (x - lastX > 48) {
        ctx.fillStyle = 'rgba(233,234,230,0.25)'; ctx.fillRect(x, 54, 1, 5);
        ctx.fillStyle = C.text; ctx.fillText(year ? fmtMonth.format(d) : fmtTick.format(d), x, 61);
        lastX = x;
      }
    }
    if (year) d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCDate(d.getUTCDate() + stepDays);
  }
  // Cursor
  const cx = padL + (cursor / (n - 1)) * pw;
  ctx.fillStyle = C.textStrong; ctx.fillRect(cx - 1, 0, 2, 54);
  ctx.beginPath(); ctx.moveTo(cx - 5, 0); ctx.lineTo(cx + 5, 0); ctx.lineTo(cx, 6); ctx.closePath(); ctx.fill();
  return { padL };
}

export function drawMiniStrip(canvas, a) {
  const { ctx, w, h } = fitCanvas(canvas);
  const n = a.times.length;
  for (let px = 0; px < w; px++) {
    const i = Math.min(n - 1, Math.floor((px / w) * n));
    ctx.fillStyle = stateColor(a.sunVis[i], a.earthVis[i]);
    ctx.fillRect(px, 0, 1, h);
  }
}
