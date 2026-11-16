// Loads the NASA/JPL-derived data built by pipeline/ (see README):
//   data/ephem.bin + ephem.json  JPL DE421 Sun/Earth vectors, hourly 2026-2030
//   data/horizons.json            LOLA terrain horizons for curated sites
//   data/validation.json          JPL Horizons reference az/el for checks
import { setRealEphemeris } from './ephemeris.js';
import { setLolaHorizons } from './horizon.js';
import { SITE_BY_ID } from './sites.js';

export let VALIDATION = null;

export async function loadRealData(base = `${import.meta.env?.BASE_URL ?? '/'}data/`) {
  const get = (f, kind) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r[kind](); });
  const results = await Promise.allSettled([get('ephem.json', 'json'), get('ephem.bin', 'arrayBuffer'), get('horizons.json', 'json'), get('validation.json', 'json')]);
  const [meta, bin, hz, val] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  if (meta && bin) setRealEphemeris(meta, bin);
  if (hz) applyHorizons(hz);
  VALIDATION = val;
  const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
  if (failed.length) console.warn('Real data not loaded, falling back:', failed.join('; '));
  return { ephemeris: !!(meta && bin), horizons: !!hz, validation: !!val };
}

// Regional targets move to the LOLA-picked point used for their horizon
export function applyHorizons(hz) {
  setLolaHorizons(hz);
  for (const [id, h] of Object.entries(hz.sites)) {
    const s = SITE_BY_ID[id];
    if (!s) continue;
    s.heightM = h.heightM;
    if (h.picked) { s.lat = h.lat; s.lon = h.lon; s.picked = h.picked; }
  }
}
