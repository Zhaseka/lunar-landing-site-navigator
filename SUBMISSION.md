# Space Apps submission: text to paste

## Project Name

Lunar Landing Site Navigator: Sunlight and Earth-Link Planner

## Summary (about 170 words)

Landing near the Moon's south pole is a timing problem. The Sun never rises more
than about 1.6° there, and Earth sits near the horizon, so a shift of a few
hundred metres or a two-week launch slip can cost a lander its power or its
direct radio link to Earth. Lunar Landing Site Navigator is a web tool for
comparing landing sites and dates quickly. For any curated site and any date
between 2026 and 2030, it shows where the Sun and Earth sit against that site's
real terrain horizon. It also gives time to the next sunset and Earthset, the
share of time in sunlight, the share of time with Earth in view, and the
longest dark period. Up to four sites can be compared over the same time span.
Sun and Earth positions come from JPL's DE421 ephemeris and match JPL Horizons
to within 2.5 arcseconds. Horizons are ray-traced over NASA LOLA elevation maps.
A year-long illumination map of the south pole shows where the light is. A short
story section explains to students and the public why the pole is hard.

## Project Demonstration

[Upload a 30-second video or a deck of up to 7 slides, then paste the public link here.]

## Project

https://lunar-landing-site-navigator-nine.vercel.app

## Project Details

**What it does**
- Navigator: pick one of 10 sites (the Shackleton–de Gerlache ridge, Mons
  Mouton, Malapert A from IM-1, Chandrayaan-3, Chang'e 4, SLIM, Apollo 11, 15 and
  17, and Blue Ghost 1) or enter your own coordinates. Choose a date and a span:
  a 14-day mission, one lunar day, or a full year.
- Sky plot: the Sun's and Earth's paths against the site's real skyline.
- Timeline: when the site has sunlight, an Earth link, or both. It can be
  scrubbed or played back.
- Live readouts: Sun and Earth elevation and bearing, time to the next
  sunset/sunrise and Earthset/Earthrise, and a plain-language verdict on power
  and communications.
- Comparison: up to four sites over the same span. Scenarios are stored in the
  URL, so a link can be shared.
- Light map: a 60 × 60 km south-pole map with 40,000 points, each with its own
  LOLA horizon. It shows the share of 2027 with sunlight, with Earth in view, and
  with both. It finds the permanently shadowed floors of Shackleton, Haworth and
  Shoemaker, and the best-lit ridge (88%), without being told where they are.
- Story: four steps on why the pole is hard, ending with a computed chart of how
  much sunlight a 14-day mission gets depending on its start date.

**How it works**
- A Python pipeline (Skyfield, NumPy, SciPy) downloads public NASA/JPL data.
- It exports apparent Sun and Earth vectors from JPL DE421 in the Moon's
  Mean-Earth body-fixed frame, using the NAIF lunar orientation kernels. Physical
  libration is included. There is one record per hour for 2026–2030.
- It ray-traces terrain horizons over the LOLA gridded elevation models: 80 m
  near the pole, 240 m to 60°S, and 16 px/deg globally. Each horizon uses 720
  bearings out to 200 km, with exact lunar curvature and no refraction.
- The browser loads about 1.2 MB of results. The front end is vanilla
  JavaScript, Vite and three.js, and computes every scenario on the device, with
  no server.
- Validation: the site queries the JPL Horizons API reference values for four
  sites on four dates and shows the comparison live. The largest difference is
  2.5 arcseconds. The DEM orientation was checked against five known polar craters.

**Benefits and impact**
Mission planners can re-evaluate sites in seconds when schedules slip. Educators
and the public can see why polar landing is hard. The map makes the point
visually: one 300 m step off the best ridge drops sunlight from 88% to 42% of the
year.

**What we considered**
- Airless horizons, with no refraction.
- Earth parallax from the lander's position, up to 0.26°.
- The Moon's real orientation and libration.
- Accessibility: keyboard navigation, screen-reader text and reduced motion.
- Known limits, stated openly on the site: custom coordinates use a
  smooth-sphere horizon, and Artemis III regions use an automatically picked high
  point rather than an official landing point.

**AI use**
The code, data-pipeline scripts and website text were written with help from an
AI assistant, Claude by Anthropic. This is noted on the site. All science data
comes from NASA and JPL. No AI-generated images are used, and no NASA branding
is used.

## Use of Super Intelligence (SI)

Select the options for **code** and **text/writing** created with SI tools
(chatbots or large language models). Do **not** select image, video or audio:
the Moon images are NASA's.

## NASA Data

| Link Text | Link Url |
| --- | --- |
| LOLA Gridded Elevation Models (LRO, PDS Geosciences Node) | https://pds-geosciences.wustl.edu/missions/lro/lola.htm |
| JPL DE421 Planetary Ephemeris (NAIF) | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/ |
| NAIF Lunar Orientation Kernels (moon_pa_de421, moon_080317) | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/ |
| JPL Horizons System | https://ssd.jpl.nasa.gov/horizons/ |
| NASA SVS CGI Moon Kit (LROC color and LOLA textures) | https://svs.gsfc.nasa.gov/4720 |
| Space Apps Challenge: Lunar Landing Site Navigator | https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/ |

## Space Agency Partner & Other Data

| Link Text | Link Url |
| --- | --- |
| Skyfield astronomy library (MIT) | https://rhodesmill.org/skyfield/ |
| NumPy (BSD) | https://numpy.org/ |
| SciPy (BSD) | https://scipy.org/ |
| three.js (MIT) | https://threejs.org/ |
| Vite (MIT) | https://vite.dev/ |
| Google Fonts: Inter Tight, Newsreader, JetBrains Mono (OFL) | https://fonts.google.com/ |
| Meeus, Astronomical Algorithms (fallback formulas) | https://openlibrary.org/search?q=astronomical+algorithms+meeus |
| Landing-site coordinates (mission reports) | https://en.wikipedia.org/wiki/List_of_artificial_objects_on_the_Moon |
| Claude by Anthropic (AI assistant for code and text) | https://www.anthropic.com/claude |
