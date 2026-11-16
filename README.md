# Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 entry for the
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge.

Pick a lunar landing site and a date to see where the Sun and Earth sit against
the local horizon. The tool shows when a lander has sunlight for power and a line
of sight to Earth for direct communication, and lets you compare sites over the
same time span.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # checks against JPL Horizons and Meeus reference values
npm run build    # static site in dist/, deployable to any static host
```

## Data pipeline (NASA / JPL)

The browser never downloads raw data. A Python pipeline turns public NASA/JPL
data into small files in `public/data/` (about 1.2 MB in total):

| Step | Script | Output |
| --- | --- | --- |
| Download about 520 MB: LOLA LDEM 80 m and 240 m south-polar maps, LOLA 16 px/deg global map, JPL DE421, NAIF lunar orientation kernels | `pipeline/download.py` | `data/raw/` (not committed) |
| Check the DEM orientation against five known polar craters | `pipeline/check_dem.py` | console |
| Apparent Sun and Earth vectors in the Moon's MOON_ME frame, hourly for 2026–2030 (Skyfield + DE421) | `pipeline/export_ephemeris.py` | `ephem.bin`, `ephem.json` |
| Terrain horizon per site: 720 rays, 200 km, lunar curvature, 2 m mast; Artemis regions use their highest LOLA point | `pipeline/build_horizons.py` | `horizons.json` |
| Reference Sun and Earth azimuth/elevation from the JPL Horizons API | `pipeline/validate_horizons.py` | `validation.json` |
| South-pole map, 200 × 200 points over 60 × 60 km: a LOLA horizon at every point (180 bearings, 100 km), Sun and Earth every 4 h through 2027, takes about 1 min on 8 cores | `pipeline/build_illumination.py` | `illumination.bin`, `illumination.json` |

```bash
uv venv pipeline/.venv --python 3.12
uv pip install --python pipeline/.venv/bin/python skyfield numpy scipy
pipeline/.venv/bin/python pipeline/download.py
pipeline/.venv/bin/python pipeline/export_ephemeris.py
pipeline/.venv/bin/python pipeline/build_horizons.py
pipeline/.venv/bin/python pipeline/validate_horizons.py
pipeline/.venv/bin/python pipeline/build_illumination.py
npm test
```

Accuracy: across 4 sites and 4 dates, the site's Sun and Earth positions match JPL
Horizons to within 2.5 arcseconds. `npm test` and the Data & method section both
re-check this.

## How it works in the browser

- `src/realdata.js` loads `public/data/` before the app starts.
- `src/ephemeris.js`, `lunarGeometry()`: JPL DE421 vectors with hourly
  interpolation. For dates outside 2026–2030 it falls back to Meeus' formulas
  (about 0.04° accuracy).
- `src/horizon.js`, `horizonMask()`: LOLA horizons for the curated sites. Custom
  coordinates get a smooth-sphere horizon, and the site labels it.
- `src/analysis.js` computes the metrics. `src/charts.js`, `src/globe.js`,
  `src/hero.js` and `src/story.js` draw the views.

Scenario state is kept in the URL (`#navigator?site=…&t=…&span=…&h=…&cmp=…`), so you
can share a link to any comparison.

## AI assistance

The code, data-pipeline scripts and site text were written with help from Claude
(Anthropic), an AI assistant. All science data comes from NASA and JPL; no
AI-generated images are used.

Live site: https://lunar-landing-site-navigator-nine.vercel.app
