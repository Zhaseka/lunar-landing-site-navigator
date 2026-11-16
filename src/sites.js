// Curated landing sites. Selenographic latitude/longitude in degrees,
// east-positive longitude. `approx: true` marks a regional target where the
// exact point is not public or still being chosen; the coordinate is a
// representative point in that region.
//
// `terrain` is legacy input for the old modelled horizon; terrain horizons
// now come from LOLA (public/data/horizons.json, pipeline/build_horizons.py).
//   rough   overall horizon relief amplitude in degrees
//   features  named terrain blocks on the horizon {az, width, height}

export const SITES = [
  {
    id: 'shackleton-ridge', name: 'Shackleton–de Gerlache ridge', group: 'South pole',
    lat: -89.45, lon: -137.3, approx: true,
    mission: 'Artemis III candidate region',
    note: 'A rim-top ridge that sees the Sun for most of the year, beside permanently shadowed crater floors.',
    terrain: { rough: 0.8, heightKm: 0.6, features: [{ az: 40, width: 30, height: 1.3 }] },
  },
  {
    id: 'mons-mouton', name: 'Mons Mouton', group: 'South pole',
    lat: -85.4, lon: 31.5, approx: true,
    mission: 'VIPER and IM-2 target region',
    note: 'A broad plateau near the pole; high ground with long sunlit periods but steep surroundings.',
    terrain: { rough: 1.0, heightKm: 0.3, features: [{ az: 160, width: 50, height: 1.6 }] },
  },
  {
    id: 'malapert-a', name: 'Malapert A', group: 'South pole',
    lat: -80.13, lon: 1.44,
    mission: 'IM-1 Odysseus, Feb 2024',
    note: 'First US landing since Apollo. Earth stays low on the northern horizon.',
    terrain: { rough: 1.3, features: [{ az: 180, width: 60, height: 2.4 }, { az: 330, width: 25, height: 0.9 }] },
  },
  {
    id: 'shiv-shakti', name: 'Shiv Shakti point', group: 'South polar region',
    lat: -69.373, lon: 32.319,
    mission: 'Chandrayaan-3 Vikram, Aug 2023',
    note: 'India’s landing at high southern latitude, timed for a full lunar day of sunlight.',
    terrain: { rough: 0.6, features: [] },
  },
  {
    id: 'chang-e-4', name: 'Von Kármán crater', group: 'Far side',
    lat: -45.444, lon: 177.588,
    mission: 'Chang’e 4, Jan 2019',
    note: 'On the far side Earth never rises. Every message goes through a relay satellite.',
    terrain: { rough: 0.5, features: [{ az: 270, width: 40, height: 1.2 }] },
  },
  {
    id: 'slim', name: 'Shioli crater', group: 'Near side',
    lat: -13.316, lon: 25.251,
    mission: 'JAXA SLIM, Jan 2024',
    note: 'A precision landing on a sloped crater wall.',
    terrain: { rough: 0.5, features: [{ az: 90, width: 50, height: 1.4 }] },
  },
  {
    id: 'apollo-11', name: 'Tranquility Base', group: 'Apollo',
    lat: 0.674, lon: 23.473,
    mission: 'Apollo 11, Jul 1969',
    note: 'Flat mare plain near the equator. Earth sits almost overhead and never sets.',
    terrain: { rough: 0.25, features: [] },
  },
  {
    id: 'apollo-15', name: 'Hadley–Apennine', group: 'Apollo',
    lat: 26.132, lon: 3.634,
    mission: 'Apollo 15, Jul 1971',
    note: 'A valley between mountains; the Apennine front rises to the south-east.',
    terrain: { rough: 0.7, features: [{ az: 120, width: 70, height: 3.5 }, { az: 270, width: 30, height: 1.2 }] },
  },
  {
    id: 'apollo-17', name: 'Taurus–Littrow', group: 'Apollo',
    lat: 20.191, lon: 30.772,
    mission: 'Apollo 17, Dec 1972',
    note: 'A deep valley ringed by massifs, so the local horizon is high in several directions.',
    terrain: { rough: 0.8, features: [{ az: 10, width: 40, height: 4.5 }, { az: 190, width: 45, height: 5.5 }] },
  },
  {
    id: 'blue-ghost-1', name: 'Mare Crisium', group: 'Near side',
    lat: 18.56, lon: 61.81,
    mission: 'Blue Ghost M1, Mar 2025',
    note: 'Near the eastern limb; libration rocks Earth noticeably across the sky.',
    terrain: { rough: 0.3, features: [] },
  },
];

export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));

export function customSite(lat, lon) {
  return {
    id: `custom:${lat.toFixed(3)},${lon.toFixed(3)}`, name: `Custom ${fmtLat(lat)}, ${fmtLon(lon)}`,
    group: 'Custom', lat, lon, custom: true, mission: 'Your coordinates',
    note: 'Custom point. No LOLA horizon is precomputed here, so the skyline is a smooth sphere: real terrain can only hide more of the sky.',
    terrain: { rough: Math.abs(lat) > 75 ? 1.0 : 0.4, features: [] },
  };
}

export const fmtLat = (v) => `${Math.abs(v).toFixed(2)}°${v < 0 ? 'S' : 'N'}`;
export const fmtLon = (v) => `${Math.abs(v).toFixed(2)}°${v < 0 ? 'W' : 'E'}`;
