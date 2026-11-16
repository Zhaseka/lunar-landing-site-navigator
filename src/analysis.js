// Scenario analysis: samples Sun/Earth visibility at a site over a time
// window and derives the planning metrics shown in the navigator.
import { lunarGeometry, skyAt } from './ephemeris.js';
import { horizonMask } from './horizon.js';

export const SYNODIC_DAYS = 29.530589;
const HOUR = 3600e3;

const geomCache = new Map();
// Site-independent geometry, shared by every site compared on the same window
export function geometrySeries(start, days, stepMin) {
  const key = `${start.getTime()}|${days}|${stepMin}`;
  if (geomCache.has(key)) return geomCache.get(key);
  const n = Math.ceil((days * 1440) / stepMin) + 1;
  const times = new Float64Array(n);
  const geoms = new Array(n);
  for (let i = 0; i < n; i++) {
    times[i] = start.getTime() + i * stepMin * 60e3;
    geoms[i] = lunarGeometry(new Date(times[i]));
  }
  const series = { times, geoms, stepMin, n };
  if (geomCache.size > 12) geomCache.clear();
  geomCache.set(key, series);
  return series;
}

// Fraction of a disc of angular radius r whose centre is `d` deg above the skyline
function discFraction(d, r) {
  if (d >= r) return 1;
  if (d <= -r) return 0;
  const x = d / r; // area of a circular segment, normalised
  return 0.5 + (x * Math.sqrt(1 - x * x) + Math.asin(x)) / Math.PI;
}

export function analyse(site, start, { days = SYNODIC_DAYS, stepMin = 30, horizon = 'terrain' } = {}) {
  const series = geometrySeries(start, days, stepMin);
  const mask = horizonMask(site, horizon);
  const { n, times, geoms } = series;
  const sunEl = new Float32Array(n), sunAz = new Float32Array(n), sunVis = new Float32Array(n);
  const earthEl = new Float32Array(n), earthAz = new Float32Array(n), earthVis = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const s = skyAt(site, new Date(times[i]), geoms[i]);
    sunEl[i] = s.sun.el; sunAz[i] = s.sun.az;
    earthEl[i] = s.earth.el; earthAz[i] = s.earth.az;
    sunVis[i] = discFraction(s.sun.el - mask(s.sun.az), s.sun.radius);
    earthVis[i] = discFraction(s.earth.el - mask(s.earth.az), s.earth.radius);
  }
  return { site, start, days, stepMin, horizon, times, sunEl, sunAz, sunVis, earthEl, earthAz, earthVis, mask, metrics: metricsFor({ times, sunEl, sunVis, earthEl, earthVis, stepMin }) };
}

function runs(arr, pred) {
  const out = [];
  let s = -1;
  for (let i = 0; i < arr.length; i++) {
    if (pred(arr[i], i)) { if (s < 0) s = i; } else if (s >= 0) { out.push([s, i - 1]); s = -1; }
  }
  if (s >= 0) out.push([s, arr.length - 1]);
  return out;
}

function metricsFor({ times, sunEl, sunVis, earthVis, stepMin }) {
  const n = times.length;
  let sunlit = 0, earthUp = 0, both = 0, maxSun = -90, energy = 0;
  for (let i = 0; i < n; i++) {
    const lit = sunVis[i] > 0.5, up = earthVis[i] > 0.5;
    if (lit) sunlit++;
    if (up) earthUp++;
    if (lit && up) both++;
    if (sunVis[i] > 0) maxSun = Math.max(maxSun, sunEl[i]);
    // Relative energy for a vertical, sun-tracking array (polar landers):
    // proportional to visible disc fraction times cos(elevation).
    energy += sunVis[i] * Math.cos((sunEl[i] * Math.PI) / 180);
  }
  const hrs = (k) => (k * stepMin) / 60;
  const dark = runs(sunVis, (v) => v <= 0.5);
  const noEarth = runs(earthVis, (v) => v <= 0.5);
  const longest = (rs) => rs.reduce((m, [a, b]) => Math.max(m, b - a + 1), 0);

  return {
    sunlitPct: (sunlit / n) * 100,
    earthPct: (earthUp / n) * 100,
    bothPct: (both / n) * 100,
    maxSunEl: maxSun,
    longestDarkH: hrs(longest(dark)),
    longestNoEarthH: hrs(longest(noEarth)),
    energyIndex: (energy / n) * 100,
  };
}

// State and next transition from sample index i
export function stateAt(a, i) {
  const lit = a.sunVis[i] > 0.5;
  const up = a.earthVis[i] > 0.5;
  const next = (arr, now) => {
    for (let j = i + 1; j < arr.length; j++) if ((arr[j] > 0.5) !== now) return (a.times[j] - a.times[i]) / HOUR;
    return null; // no change within the window
  };
  return {
    lit, up,
    sunEl: a.sunEl[i], sunAz: a.sunAz[i], earthEl: a.earthEl[i], earthAz: a.earthAz[i],
    sunVis: a.sunVis[i], earthVis: a.earthVis[i],
    nextSunChangeH: next(a.sunVis, lit), nextEarthChangeH: next(a.earthVis, up),
  };
}

export function verdict(m) {
  const power = m.sunlitPct >= 65 && m.longestDarkH < 120 ? 'good' : m.sunlitPct >= 40 ? 'fair' : 'poor';
  const comms = m.earthPct >= 90 ? 'good' : m.earthPct >= 40 ? 'fair' : 'poor';
  return { power, comms };
}

export function fmtDuration(h) {
  if (h == null) return 'Beyond span';
  if (h === 0) return 'None';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  const total = Math.round(h);
  return `${Math.floor(total / 24)} d ${total % 24} h`;
}
