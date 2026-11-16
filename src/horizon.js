// Local horizon masks: the elevation (deg) of the visible skyline in each
// azimuth direction.
//
// The Moon has no atmosphere, so there is no refraction: a body is visible
// only when it is geometrically above the terrain. Two models:
//
//   terrain  measured: computed offline from LOLA elevation models
//            (pipeline/build_horizons.py: 720 rays, 200 km, exact lunar
//            curvature) and loaded from public/data/horizons.json.
//   flat     a smooth sphere seen from a 2 m lander mast: the horizon dips
//            sqrt(2h/R) ~ 0.087 deg below level in every direction.
//
// Custom coordinates have no precomputed LOLA horizon, so they use the
// smooth-sphere model and the interface says so.

import { MOON_RADIUS_KM } from './ephemeris.js';

const MAST_HEIGHT_KM = 0.002;
export const GEOMETRIC_DIP = -Math.sqrt((2 * MAST_HEIGHT_KM) / MOON_RADIUS_KM) * (180 / Math.PI);

let LOLA = null;
export function setLolaHorizons(data) { LOLA = data; cache.clear(); }
export const lolaInfo = (site) => (LOLA && LOLA.sites[site.id]) || null;
export const hasLola = (site) => !!lolaInfo(site);
export const lolaMeta = () => LOLA;

const cache = new Map();

export function horizonMask(site, mode = 'terrain') {
  const info = mode === 'terrain' ? lolaInfo(site) : null;
  const key = `${site.id}|${info ? 'lola' : 'flat'}`;
  if (cache.has(key)) return cache.get(key);
  const samples = info ? Float32Array.from(info.el) : new Float32Array(360).fill(GEOMETRIC_DIP);
  const n = samples.length, step = 360 / n;
  const mask = (az) => {
    const a = (((az % 360) + 360) % 360) / step;
    const i = Math.floor(a), t = a - i;
    return samples[i % n] * (1 - t) + samples[(i + 1) % n] * t;
  };
  mask.samples = samples;
  mask.source = info ? 'lola' : 'flat';
  cache.set(key, mask);
  return mask;
}
