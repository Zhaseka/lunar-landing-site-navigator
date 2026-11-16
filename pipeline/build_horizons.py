"""Terrain horizons from LOLA for every curated site.

For each site: 720 rays (every 0.5 deg of azimuth) out to 200 km. Along each
ray the terrain height is sampled from the best available LOLA model and turned
into an elevation angle seen from the site, with exact lunar curvature and no
refraction (the Moon has no atmosphere). The horizon in that direction is the
maximum angle along the ray.

Regional targets (approx: true in src/sites.js) are moved to the highest LOLA
point within a few km of the published region centre, standing in for the
ridge or plateau top that a mission would choose. That point is reported.

Output: public/data/horizons.json
"""
import json
import re
from pathlib import Path

import numpy as np

import lola

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "horizons.json"
R = lola.R_M
MAST_M = 2.0
N_AZ = 720
MAX_KM = 200.0
N_D = 900
SEARCH_KM = {"shackleton-ridge": 3.0, "mons-mouton": 6.0}


def read_sites():
    """Pull id/lat/lon/approx from src/sites.js so the two never drift."""
    js = (ROOT / "src" / "sites.js").read_text()
    sites = []
    for block in re.findall(r"\{\s*id: '([^']+)'.*?lat: (-?[\d.]+), lon: (-?[\d.]+)(, approx: true)?", js, re.S):
        sites.append({"id": block[0], "lat": float(block[1]), "lon": float(block[2]), "approx": bool(block[3])})
    return sites


def destination(lat, lon, az_deg, d_m):
    """Great-circle destination points: arrays broadcast over az x distance."""
    p1, l1 = np.radians(lat), np.radians(lon)
    th = np.radians(az_deg)[:, None]
    dl = (d_m / R)[None, :]
    p2 = np.arcsin(np.sin(p1) * np.cos(dl) + np.cos(p1) * np.sin(dl) * np.cos(th))
    l2 = l1 + np.arctan2(np.sin(th) * np.sin(dl) * np.cos(p1), np.cos(dl) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), (np.degrees(l2) + 540) % 360 - 180


def highest_nearby(lat, lon, km):
    az = np.arange(0, 360, 5.0)
    d = np.linspace(0, km * 1000, 60)
    la, lo = destination(lat, lon, az, d)
    h = lola.height(la.ravel(), lo.ravel())
    i = int(np.argmax(h))
    return float(la.ravel()[i]), float(lo.ravel()[i])


def horizon(lat, lon, mast=MAST_M):
    az = np.arange(N_AZ) * (360.0 / N_AZ)
    d = np.geomspace(60.0, MAX_KM * 1000, N_D)
    la, lo = destination(lat, lon, az, d)
    ht = lola.height(la.ravel(), lo.ravel()).reshape(la.shape) + R
    h0 = float(lola.height(np.array([lat]), np.array([lon]))[0])
    ho = R + h0 + mast
    delta = (d / R)[None, :]
    el = np.degrees(np.arctan2(ht * np.cos(delta) - ho, ht * np.sin(delta)))
    return h0, el.max(axis=1)


def main():
    out = {"azStepDeg": 360.0 / N_AZ, "mastM": MAST_M, "rangeKm": MAX_KM,
           "source": "LOLA LDEM 80 m (80-90 S), 240 m (60-90 S), 16 px/deg global; PDS Geosciences Node", "sites": {}}
    for s in read_sites():
        lat, lon, picked = s["lat"], s["lon"], None
        if s["approx"] and s["id"] in SEARCH_KM:
            lat, lon = highest_nearby(lat, lon, SEARCH_KM[s["id"]])
            picked = f"highest LOLA point within {SEARCH_KM[s['id']]:g} km of the region centre"
        h0, el = horizon(lat, lon)
        out["sites"][s["id"]] = {"lat": round(lat, 4), "lon": round(lon, 4), "heightM": round(h0), "picked": picked,
                                 "el": [round(float(x), 3) for x in el]}
        print(f"{s['id']:18s} {lat:9.4f} {lon:9.4f}  h={h0:7.0f} m  horizon min {el.min():6.2f}  max {el.max():6.2f}  mean {el.mean():6.2f}")
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print("wrote", OUT, f"{OUT.stat().st_size / 1000:.0f} kB")


if __name__ == "__main__":
    main()
