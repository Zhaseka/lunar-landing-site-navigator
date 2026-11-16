# Space Apps submission: LunarWindow

## Project Name

LunarWindow: See the Sky Before You Land

## Summary (about 190 words)

Near the Moon's south pole the Sun never climbs more than a couple of degrees,
and Earth sits on the horizon. A few hundred metres of terrain or a two-week
launch slip can decide whether a lander has power and a direct radio link.
Existing tools such as Quickmap, Moon Trek and JPL Horizons are built for
specialists. LunarWindow answers the planning question in seconds.

Pick any of 24 curated sites or click any spot on the Moon, then choose a date.
LunarWindow shows when the lander will have sunlight and when it can see Earth,
measured against the real terrain horizon from NASA's LOLA laser altimeter and
Sun/Earth positions from JPL's DE421 ephemeris. Those positions agree with JPL
Horizons to within 0.12 arcseconds.

Each landing report gives a plain-language verdict, countdowns to sunset and
Earthset, the longest night and the longest radio silence. It also includes an
operating-windows table with CSV/JSON export, a 3D view of the LOLA terrain lit
by the real Sun, a ±3 km scan for brighter spots, and a calendar of every
landing date in the year. The tool serves mission planners, educators and the
public.

## Project Demonstration

[Upload a 30-second video or a deck of up to 7 slides, then paste the public link here.]

## Project

https://lunarwindow-mauve.vercel.app

## Project Details

**What it does**
- **Landing report** for any site and date, looking 14, 30, 60 or 90 days ahead
  from a 0 to 20 m panel or antenna height:
  - a plain-language verdict (Good, Marginal or Poor);
  - countdowns to sunset and Earthset;
  - share of days with sunlight, with Earth in view, and with both;
  - the longest night, the longest radio silence, and average power for a
    sun-tracking vertical panel.
- **Live view:** the real LOLA skyline with the Sun, Earth (at its real phase)
  and the lander at the chosen moment.
- **Timeline** with playback, showing when there is light and radio contact.
- **Operating windows:** exact opening and closing times (UTC) for power, comms
  and both, with solar energy per window. They can be exported as CSV or JSON for
  planners.
- **3D view:** 20 × 20 km of LOLA terrain lit by the real Sun, with shadows.
- **Neighbourhood scan:** sunlight over a ±3 km grid for a whole year. Example:
  Malapert Massif goes from 73% to 81% sunlight 2.5 km east, which adds about
  30 days of power a year.
- **Launch-slip calendar:** every landing date of the year, with the best and
  worst dates.
- **Comparison:** up to 4 site-and-date scenarios side by side.
- **Maps:** year-long sunlight, Earth-visibility and combined maps of the south
  pole, plus a whole-Moon map. Any point can be clicked and checked.
- **Sites:** 24 curated sites (Apollo, CLPS missions, other agencies' landers and
  the 9 Artemis III candidate regions), or any latitude and longitude.

**How it works**
- **Ephemerides:** the Sun and Earth from JPL DE421, computed with Skyfield and
  rotated into the Moon's Mean-Earth/polar-axis frame with the NAIF lunar kernels,
  so physical libration is included.
- **Terrain horizons:** 720 rays (every 0.5°) out to 200 km over LOLA
  elevation: 80 m/px near the pole, 240 m/px to 60°S, 64 px/deg elsewhere. Lunar
  curvature is exact and there is no refraction.
- **Visibility:** the visible fraction of the solar disc. Earth counts as visible
  when its centre clears the terrain.
- **Validation:** checked against the JPL Horizons API at 4 sites over 30 days.
  The largest elevation error is 0.12 arcseconds.
- **Artemis III points:** NASA publishes regions, not points, so LunarWindow
  picks the best-lit point with a slope of 8° or less inside each region. These
  are labelled as auto-picked, not official landing sites.
- **Architecture:** a Python pipeline (Skyfield, NumPy, SciPy, FastAPI) does the
  preprocessing. The web app uses React, TypeScript, Vite, Tailwind and three.js.
  Catalogue data and compact LOLA grids (400 m polar, 4 px/deg global) ship with
  the app, so it runs entirely in the browser with no server.

**Benefits and impact**
When hardware or launch schedules slip, planners can re-evaluate alternative
dates and nearby points in seconds instead of working through several
specialist tools. The plain-language verdicts let students and the public see
why the lunar south pole is so hard, and why a few hundred metres or a few days
change everything.

**What makes it creative**
- A neighbourhood scan that answers "could a few hundred metres do better?"
- A calendar showing every possible landing date in a year.
- A live horizon scene built from real terrain and real ephemerides.
- One tool that serves both expert data exports and plain-language explanations.

**Limits, stated in the app**
- The 80–240 m terrain smooths boulders, so horizons within a few hundred metres
  are approximate.
- Relay satellites are not modelled.
- Artemis III points are auto-picked, not official landing sites.

**AI use**
Parts of the code were written with an AI coding assistant, Claude by Anthropic.
The layout of the report screen started from an AI-generated sketch on 21st.dev.
All science data comes from NASA and JPL. No AI-generated images and no NASA
branding are used.

## Use of Super Intelligence (SI)

Select the options for **code** generated with SI tools, and for **design or
layout**, if that is a listed option, because of the 21st.dev AI sketch. Do
**not** select image, video or audio: the maps are rendered from LOLA data.

## NASA Data

| Link Text | Link Url |
| --- | --- |
| LOLA Gridded Elevation Models (LRO, PDS Geosciences Node) | https://pds-geosciences.wustl.edu/missions/lro/lola.htm |
| JPL DE421 Planetary Ephemeris (NAIF) | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/ |
| NAIF Lunar Orientation Kernels | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/ |
| JPL Horizons System | https://ssd.jpl.nasa.gov/horizons/ |
| NASA NSSDCA Lunar Artifacts (landing coordinates) | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html |
| NASA Artemis III Landing Regions Update | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ |
| Space Apps Challenge: Lunar Landing Site Navigator | https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/ |

## Space Agency Partner & Other Data

| Link Text | Link Url |
| --- | --- |
| IAU Gazetteer of Planetary Nomenclature (USGS) | https://planetarynames.wr.usgs.gov/ |
| Skyfield astronomy library | https://rhodesmill.org/skyfield/ |
| NumPy | https://numpy.org/ |
| SciPy | https://scipy.org/ |
| FastAPI | https://fastapi.tiangolo.com/ |
| React | https://react.dev/ |
| Vite | https://vite.dev/ |
| Tailwind CSS | https://tailwindcss.com/ |
| three.js | https://threejs.org/ |
| Motion (animation library) | https://motion.dev/ |
| Lucide icons | https://lucide.dev/ |
| Radix UI | https://www.radix-ui.com/ |
| 21st.dev UI components and AI sketch | https://21st.dev/ |
| Google Fonts: Chakra Petch, Zen Kaku Gothic New, Inter, JetBrains Mono | https://fonts.google.com/ |
| Claude by Anthropic (AI coding assistant) | https://www.anthropic.com/claude |
