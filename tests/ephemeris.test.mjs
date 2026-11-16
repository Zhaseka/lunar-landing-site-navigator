// Checks the ephemeris against Meeus' worked examples. Run: npm test
import { moonPosition, sunPosition, lunarGeometry, skyAt } from '../src/ephemeris.js';
import { VALIDATION_CASES, runValidation, runHorizonsValidation } from '../src/validation.js';
import { setRealEphemeris } from '../src/ephemeris.js';
import { applyHorizons } from '../src/realdata.js';
import { analyse } from '../src/analysis.js';
import { SITE_BY_ID } from '../src/sites.js';
import fs from 'node:fs';

let failed = 0;
for (const r of runValidation()) {
  const ok = Math.abs(r.ours - r.ref) <= r.tol;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(44)} ours ${r.ours.toFixed(4).padStart(12)}  ref ${String(r.ref).padStart(12)}  tol ${r.tol}`);
}

// Sanity: at the south pole the Sun never climbs above ~1.6 deg
const pole = { lat: -89.9, lon: 0 };
let maxEl = -90;
for (let h = 0; h < 24 * 365; h += 6) {
  const d = new Date(Date.UTC(2027, 0, 1) + h * 3600e3);
  maxEl = Math.max(maxEl, skyAt(pole, d).sun.el);
}
const poleOk = maxEl > 1.3 && maxEl < 1.8;
if (!poleOk) failed++;
console.log(`${poleOk ? 'PASS' : 'FAIL'}  Max solar elevation at -89.9 deg over 2027     ${maxEl.toFixed(3)} deg (expect ~1.5-1.7)`);

// Sanity: Chang'e 4 site on the far side never sees Earth
const ce4 = { lat: -45.444, lon: 177.588 };
let maxE = -90;
for (let h = 0; h < 24 * 60; h += 3) maxE = Math.max(maxE, skyAt(ce4, new Date(Date.UTC(2027, 0, 1) + h * 3600e3)).earth.el);
const ceOk = maxE < 0;
if (!ceOk) failed++;
console.log(`${ceOk ? 'PASS' : 'FAIL'}  Chang'e 4 far-side site: Earth max elevation   ${maxE.toFixed(2)} deg (expect < 0)`);

// --- Real NASA/JPL data path ---------------------------------------------
const D = new URL('../public/data/', import.meta.url);
setRealEphemeris(JSON.parse(fs.readFileSync(new URL('ephem.json', D))), fs.readFileSync(new URL('ephem.bin', D)).buffer.slice(0));
applyHorizons(JSON.parse(fs.readFileSync(new URL('horizons.json', D))));
for (const r of runHorizonsValidation(JSON.parse(fs.readFileSync(new URL('validation.json', D))), { skyAt, lunarGeometry })) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  JPL Horizons: ${r.label.padEnd(40)} max ${r.max.toFixed(2)}" over ${r.n} dates (tol ${r.tol}")`);
}
const ridge = analyse(SITE_BY_ID['shackleton-ridge'], new Date(Date.UTC(2027, 0, 1)), { days: 365.25, stepMin: 120 });
const ridgeOk = ridge.metrics.sunlitPct > 60 && ridge.metrics.sunlitPct < 98;
if (!ridgeOk) failed++;
console.log(`${ridgeOk ? 'PASS' : 'FAIL'}  Shackleton ridge, LOLA horizon, 2027 sunlit     ${ridge.metrics.sunlitPct.toFixed(1)}% (expect 60-98%)`);

void moonPosition; void sunPosition; void lunarGeometry; void VALIDATION_CASES;
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
