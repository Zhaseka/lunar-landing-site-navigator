"""Export Sun and Earth positions relative to the Moon, hourly 2026-2030.

Positions come from JPL DE421 through Skyfield, as apparent positions seen from
the Moon's centre (light time and aberration applied), rotated into the Moon's
Mean-Earth / polar-axis frame (MOON_ME_DE421) with the NAIF lunar
orientation kernels. That frame is the one LOLA elevation models use, so
directions here line up with the terrain horizons.

Output public/data/ephem.bin: little-endian float32 records of
  [sun_x, sun_y, sun_z (unit vector), earth_x, earth_y, earth_z (km)]
and public/data/ephem.json with the time grid.
"""
import json
from pathlib import Path

import numpy as np
from skyfield.api import Loader
from skyfield.planetarylib import PlanetaryConstants

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data"
START = (2026, 1, 1)
YEARS = 5
STEP_H = 1

load = Loader(str(RAW))
ts = load.timescale()
eph = load("de421.bsp")
pc = PlanetaryConstants()
pc.read_text(load("moon_080317.tf"))
pc.read_text(load("pck00008.tpc"))
pc.read_binary(load("moon_pa_de421_1900-2050.bpc"))
FRAME = pc.build_frame_named("MOON_ME_DE421")
moon, sun, earth = eph["moon"], eph["sun"], eph["earth"]


def vectors(t):
    """Apparent Sun unit vector and Earth vector (km) in MOON_ME at times t."""
    obs = moon.at(t)
    s = obs.observe(sun).apparent().frame_xyz(FRAME).km
    e = obs.observe(earth).apparent().frame_xyz(FRAME).km
    s = s / np.linalg.norm(s, axis=0)
    return s, e


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = int(YEARS * 365.25 * 24 / STEP_H) + 1
    hours = np.arange(n) * STEP_H
    t = ts.utc(START[0], START[1], START[2], hours)
    recs = np.empty((n, 6), dtype=np.float32)
    chunk = 5000
    for i in range(0, n, chunk):
        s, e = vectors(t[i:i + chunk])
        recs[i:i + chunk, 0:3] = s.T
        recs[i:i + chunk, 3:6] = e.T
    recs.astype("<f4").tofile(OUT / "ephem.bin")
    meta = {
        "start": f"{START[0]:04d}-{START[1]:02d}-{START[2]:02d}T00:00:00Z",
        "stepHours": STEP_H, "count": n, "fields": ["sunX", "sunY", "sunZ", "earthXkm", "earthYkm", "earthZkm"],
        "frame": "MOON_ME_DE421", "source": "JPL DE421 via Skyfield; NAIF moon_pa_de421_1900-2050.bpc, moon_080317.tf",
    }
    (OUT / "ephem.json").write_text(json.dumps(meta, indent=2))
    print(f"wrote {n} records, {recs.nbytes / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
