// Reference values from Meeus, "Astronomical Algorithms" (2nd ed.) worked
// examples. Shared by the test script and the Data & method section.
import { moonPosition, sunPosition, lunarGeometry } from './ephemeris.js';

const DELTA_T_S = 69;
// A Date whose internal TT matches the given Julian Ephemeris Day exactly
const dateFromJDE = (jde) => new Date((jde - 2440587.5) * 86400000 - DELTA_T_S * 1000);
const T = (jde) => (jde - 2451545.0) / 36525;

export const VALIDATION_CASES = [
  { label: 'Moon ecliptic longitude, 1992-04-12 (47.a)', ref: 133.162655, tol: 0.01, unit: 'deg',
    fn: () => moonPosition(T(2448724.5)).lon },
  { label: 'Moon ecliptic latitude, 1992-04-12 (47.a)', ref: -3.229126, tol: 0.01, unit: 'deg',
    fn: () => moonPosition(T(2448724.5)).lat },
  { label: 'Earth-Moon distance, 1992-04-12 (47.a)', ref: 368409.7, tol: 20, unit: 'km',
    fn: () => moonPosition(T(2448724.5)).distKm },
  { label: 'Sun apparent longitude, 1992-10-13 (25.a)', ref: 199.90988, tol: 0.01, unit: 'deg',
    fn: () => sunPosition(T(2448908.5)).lon },
  { label: 'Sub-Earth longitude (libration), 1992-04-12 (53.a)', ref: -1.206, tol: 0.05, unit: 'deg',
    fn: () => lunarGeometry(dateFromJDE(2448724.5)).subEarth.lon },
  { label: 'Sub-Earth latitude (libration), 1992-04-12 (53.a)', ref: 4.194, tol: 0.05, unit: 'deg',
    fn: () => lunarGeometry(dateFromJDE(2448724.5)).subEarth.lat },
  { label: 'Sub-solar longitude, 1992-04-12 (53.a)', ref: 67.89, tol: 0.1, unit: 'deg',
    fn: () => lunarGeometry(dateFromJDE(2448724.5)).subSolar.lon },
  { label: 'Sub-solar latitude, 1992-04-12 (53.a)', ref: 1.46, tol: 0.1, unit: 'deg',
    fn: () => lunarGeometry(dateFromJDE(2448724.5)).subSolar.lat },
];

export function runValidation() {
  return VALIDATION_CASES.map((c) => ({ ...c, ours: c.fn() }));
}

// JPL Horizons API reference az/el (public/data/validation.json) against the
// site's own JPL-DE421-based calculation. One row per site and body: the
// largest angular difference over the dates checked, in arcseconds.
export function runHorizonsValidation(ref, { skyAt, lunarGeometry }) {
  if (!ref) return [];
  const names = { 'shackleton-ridge': 'Shackleton–de Gerlache ridge', 'malapert-a': 'Malapert A', 'apollo-11': 'Tranquility Base', 'chang-e-4': 'Von Kármán crater' };
  const groups = new Map();
  for (const c of ref.cases) {
    const d = new Date(c.utc);
    const ours = skyAt({ lat: c.lat, lon: c.lon }, d, lunarGeometry(d))[c.body];
    let dAz = Math.abs(ours.az - c.az) % 360; if (dAz > 180) dAz = 360 - dAz;
    const sep = Math.hypot(ours.el - c.el, dAz * Math.cos((c.el * Math.PI) / 180)) * 3600;
    const key = `${c.site}|${c.body}`;
    const g = groups.get(key) || { label: `${c.body === 'sun' ? 'Sun' : 'Earth'} position at ${names[c.site] || c.site}`, max: 0, n: 0 };
    g.max = Math.max(g.max, sep); g.n++;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, tol: 10, ok: g.max <= 10 }));
}
