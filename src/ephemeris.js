// Lunar ephemeris for the browser.
//
// Sun and Earth directions as seen from a point on the Moon, built from
// Jean Meeus, "Astronomical Algorithms" (2nd ed.):
//   ch. 22  nutation (low precision)
//   ch. 25  solar coordinates (low precision, ~0.01 deg)
//   ch. 47  position of the Moon (main periodic terms, ~10 arcsec in longitude)
//   ch. 53  ephemeris for physical observations of the Moon (optical libration)
//
// Physical libration (< 0.04 deg) is not applied. Results are validated
// against Meeus' worked examples in tests/ephemeris.test.mjs and on the
// Data & method section of the site.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const norm360 = (d) => ((d % 360) + 360) % 360;

export const MOON_RADIUS_KM = 1737.4;
export const AU_KM = 149597870.7;
export const SUN_RADIUS_KM = 696000;
export const EARTH_RADIUS_KM = 6371;
const I_INCL = 1.54242; // inclination of the lunar equator to the ecliptic
const DELTA_T_S = 69; // TT - UT, seconds (fixed; good to ~1 s for 2020-2030)

export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Julian centuries of TT since J2000.0
function centuries(jdUT) {
  return (jdUT + DELTA_T_S / 86400 - 2451545.0) / 36525;
}

// Meeus table 47.A: D, M, M', F, Σl (1e-6 deg), Σr (1e-3 km)
const TABLE_LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968], [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733], [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751], [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0], [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0], [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0], [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165], [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752],
];

// Meeus table 47.B: D, M, M', F, Σb (1e-6 deg)
const TABLE_B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794], [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107], [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833],
];

// Geocentric Moon: geometric ecliptic longitude/latitude (deg) and distance (km)
export function moonPosition(T) {
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + (T ** 3) / 538841 - (T ** 4) / 65194000);
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + (T ** 3) / 545868 - (T ** 4) / 113065000);
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + (T ** 3) / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + (T ** 3) / 69699 - (T ** 4) / 14712000);
  const F = norm360(93.272095 + 483202.0175233 * T - 0.0036539 * T * T - (T ** 3) / 3526000 + (T ** 4) / 863310000);
  const A1 = norm360(119.75 + 131.849 * T);
  const A2 = norm360(53.09 + 479264.29 * T);
  const A3 = norm360(313.45 + 481266.484 * T);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;

  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, cl, cr] of TABLE_LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sl += cl * e * sin(arg);
    sr += cr * e * cos(arg);
  }
  for (const [d, m, mp, f, cb] of TABLE_B) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sb += cb * e * sin(arg);
  }
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);

  return { lon: norm360(Lp + sl / 1e6), lat: sb / 1e6, distKm: 385000.56 + sr / 1000, F };
}

// Nutation in longitude (deg), Meeus ch. 22 low precision
export function nutationLon(T) {
  const omega = 125.04452 - 1934.136261 * T;
  const Ls = 280.4665 + 36000.7698 * T;
  const Lm = 218.3165 + 481267.8813 * T;
  const dpsi = -17.2 * sin(omega) - 1.32 * sin(2 * Ls) - 0.23 * sin(2 * Lm) + 0.21 * sin(2 * omega);
  return { dpsi: dpsi / 3600, omega: norm360(omega) };
}

// Apparent geocentric Sun: ecliptic longitude (deg) and distance (km)
export function sunPosition(T) {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M)
    + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const trueLon = L0 + C;
  const nu = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(nu));
  const omega = 125.04 - 1934.136 * T;
  return { lon: norm360(trueLon - 0.00569 - 0.00478 * sin(omega)), distKm: R * AU_KM };
}

// Optical libration formula (Meeus 53.1) for a body at ecliptic (lambda, beta)
function selenographic(lambda, beta, dpsi, omega, F) {
  const W = lambda - dpsi - omega;
  const A = Math.atan2(sin(W) * cos(beta) * cos(I_INCL) - sin(beta) * sin(I_INCL), cos(W) * cos(beta)) * RAD;
  const lon = A - F;
  const lat = Math.asin(-sin(W) * cos(beta) * sin(I_INCL) - sin(beta) * cos(I_INCL)) * RAD;
  return { lon: ((lon + 540) % 360) - 180, lat };
}

// --- JPL DE421 ephemeris (precomputed by pipeline/export_ephemeris.py) ------
// Hourly apparent Sun unit vectors and Earth vectors (km) in the Moon's
// Mean-Earth/polar-axis frame, 2026-2030. Linear interpolation between hours
// is good to ~2 arcsec. Outside that range the Meeus model below is used.
let REAL = null;
export function setRealEphemeris(meta, buffer) {
  REAL = { t0: Date.parse(meta.start), step: meta.stepHours * 3600e3, n: meta.count, f: new Float32Array(buffer), meta };
}
export const realEphemerisRange = () => (REAL ? [new Date(REAL.t0), new Date(REAL.t0 + (REAL.n - 1) * REAL.step)] : null);

const toLatLon = (v) => {
  const r = Math.hypot(v[0], v[1], v[2]);
  return { lat: Math.asin(v[2] / r) * RAD, lon: Math.atan2(v[1], v[0]) * RAD };
};

function jplGeometry(date) {
  const x = (date.getTime() - REAL.t0) / REAL.step;
  if (!(x >= 0 && x <= REAL.n - 1)) return null;
  const i = Math.min(REAL.n - 2, Math.floor(x)), t = x - i, f = REAL.f, a = i * 6, b = a + 6;
  const lerp = (k) => f[a + k] * (1 - t) + f[b + k] * t;
  const s = [lerp(0), lerp(1), lerp(2)];
  const sl = Math.hypot(s[0], s[1], s[2]);
  const sunVec = [s[0] / sl, s[1] / sl, s[2] / sl];
  const earthVec = [lerp(3), lerp(4), lerp(5)];
  return {
    source: 'jpl', sunVec, earthVec,
    earthDistKm: Math.hypot(earthVec[0], earthVec[1], earthVec[2]), sunDistKm: AU_KM,
    subSolar: toLatLon(sunVec), subEarth: toLatLon(earthVec),
  };
}

// Sub-Earth and sub-solar points (and, from JPL data, direction vectors) for
// a UTC Date. JPL DE421 when available for the date, else Meeus.
export function lunarGeometry(date) {
  if (REAL) { const g = jplGeometry(date); if (g) return g; }
  return meeusGeometry(date);
}

export function meeusGeometry(date) {
  const T = centuries(julianDay(date));
  const moon = moonPosition(T);
  const { dpsi, omega } = nutationLon(T);
  const sun = sunPosition(T);
  const lambda = moon.lon + dpsi; // apparent

  const subEarth = selenographic(lambda, moon.lat, dpsi, omega, moon.F);

  // Heliocentric direction of the Moon, for the sub-solar point
  const ratio = moon.distKm / sun.distKm;
  const lamH = sun.lon + 180 + ratio * RAD * cos(moon.lat) * sin(sun.lon - lambda);
  const betH = ratio * moon.lat;
  const subSolar = selenographic(lamH, betH, dpsi, omega, moon.F);

  return { source: 'meeus', T, moon, sun, subEarth, subSolar, earthDistKm: moon.distKm, sunDistKm: sun.distKm };
}

// --- Local sky at a lunar site ---------------------------------------------

function vec(latDeg, lonDeg) {
  return [cos(latDeg) * cos(lonDeg), cos(latDeg) * sin(lonDeg), sin(latDeg)];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Topocentric elevation/azimuth (deg) of the Sun and Earth at a site.
// Azimuth is measured from local north, through east. The Sun is treated as
// infinitely distant; the Earth direction includes topocentric parallax
// (up to ~0.26 deg), which matters near the horizon.
export function skyAt(site, date, geom = lunarGeometry(date)) {
  const lat = Math.max(-89.9999, Math.min(89.9999, site.lat));
  const lon = site.lon;
  const up = vec(lat, lon);
  const east = [-sin(lon), cos(lon), 0];
  const north = [-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat)];

  const toAltAz = (d) => {
    const el = Math.asin(Math.max(-1, Math.min(1, dot(d, up)))) * RAD;
    const az = norm360(Math.atan2(dot(d, east), dot(d, north)) * RAD);
    return { el, az };
  };

  const sunDir = geom.sunVec || vec(geom.subSolar.lat, geom.subSolar.lon);
  const ePos = geom.earthVec || vec(geom.subEarth.lat, geom.subEarth.lon).map((c) => c * geom.earthDistKm);
  const obs = up.map((c) => c * MOON_RADIUS_KM);
  const rel = [ePos[0] - obs[0], ePos[1] - obs[1], ePos[2] - obs[2]];
  const relLen = Math.hypot(...rel);
  const earthDir = rel.map((c) => c / relLen);

  return {
    sun: { ...toAltAz(sunDir), radius: Math.asin(SUN_RADIUS_KM / geom.sunDistKm) * RAD },
    earth: { ...toAltAz(earthDir), radius: Math.asin(EARTH_RADIUS_KM / relLen) * RAD },
  };
}
