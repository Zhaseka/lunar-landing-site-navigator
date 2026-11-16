"""Year-long illumination and Earth-visibility map of the lunar south pole.

Grid: N x N points on the LOLA 80 m polar stereographic map, centred on the
pole. For every point:
  1. Terrain horizon: N_AZ rays out to MAX_KM over LOLA 80 m heights, with
     exact lunar curvature, seen from a 2 m mast.
  2. Sun and Earth: apparent positions from JPL DE421 (public/data/ephem.bin)
     every STEP_H hours through YEAR, turned into local elevation and bearing.
  3. Counts the share of time the Sun's centre and Earth's centre are above
     the horizon, and both at once.

Output public/data/illumination.bin (uint8 arrays: hillshade, sunlit %,
Earth %, both %, each N*N, row-major from the top of the map) and
illumination.json (grid geometry). Runs in parallel across CPU cores.

Usage: pipeline/.venv/bin/python pipeline/build_illumination.py [--n 200] [--test]
"""
import argparse
import json
import os
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DATA = ROOT / "public" / "data"
R = 1737400.0
MAST = 2.0
SCALE = 80.0           # m per LOLA pixel
L0 = S0 = 3799.5       # projection offsets (ldem_80s_80m.lbl)
N_AZ = 180             # every 2 deg of bearing
D = np.geomspace(100.0, 100_000.0, 150)   # ray sample distances, m
YEAR = 2027
STEP_H = 4

_dem = None


def dem():
    global _dem
    if _dem is None:
        _dem = np.memmap(RAW / "ldem_80s_80m.img", dtype="<i2", mode="r", shape=(7600, 7600))
    return _dem


def heights(x, y):
    """LOLA height (m) at stereographic x, y (m). x east-ish, y per lola.py."""
    line = L0 - y / SCALE
    samp = S0 + x / SCALE
    return map_coordinates(dem(), [line, samp], order=1, mode="nearest") * 0.5


def up_vectors(x, y):
    """Outward unit normals of the sphere at stereographic x, y (south pole)."""
    rho = np.hypot(x, y)
    lat = 2 * np.arctan(rho / (2 * R)) - np.pi / 2
    lon = np.arctan2(x, y)
    return np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=-1), lat, lon


def horizons(x, y):
    """Horizon elevation (deg) for points (P,) at N_AZ bearings -> (P, N_AZ)."""
    th = np.radians(np.arange(N_AZ) * 360.0 / N_AZ)
    dx = np.sin(th)[None, :, None] * D[None, None, :]
    dy = np.cos(th)[None, :, None] * D[None, None, :]
    hx = heights((x[:, None, None] + dx).ravel(), (y[:, None, None] + dy).ravel()).reshape(len(x), N_AZ, len(D))
    h0 = heights(x, y)
    ho = R + h0 + MAST
    ht = R + hx
    delta = D / R
    el = np.arctan2(ht * np.cos(delta) - ho[:, None, None], ht * np.sin(delta))
    return np.degrees(el.max(axis=2)), h0


def load_ephem():
    meta = json.loads((DATA / "ephem.json").read_text())
    rec = np.fromfile(DATA / "ephem.bin", dtype="<f4").reshape(-1, 6).astype(np.float64)
    t0 = np.datetime64(meta["start"].replace("Z", ""))
    start = int((np.datetime64(f"{YEAR}-01-01T00:00") - t0) / np.timedelta64(1, "h"))
    end = int((np.datetime64(f"{YEAR + 1}-01-01T00:00") - t0) / np.timedelta64(1, "h"))
    sel = rec[start:end:STEP_H]
    return sel[:, 0:3], sel[:, 3:6]


def visibility(args):
    """Worker: for a chunk of points, % of time Sun / Earth / both are up."""
    x, y = args
    sun, earth = load_ephem()
    hz, h0 = horizons(x, y)
    up, _, _ = up_vectors(x, y)
    # Local frame at each point: grid-x and grid-y directions projected onto the tangent plane.
    # Stereographic x grows with body +Y, y with body +X (see lola.py / check_dem.py).
    ex = np.array([0.0, 1.0, 0.0]) - up[:, 1:2] * up
    ey = np.array([1.0, 0.0, 0.0]) - up[:, 0:1] * up
    ex /= np.linalg.norm(ex, axis=1, keepdims=True)
    ey /= np.linalg.norm(ey, axis=1, keepdims=True)
    pos = up * (R + h0[:, None]) / 1000.0  # km

    def up_frac(dirs):
        el = np.degrees(np.arcsin(np.clip(dirs @ up.T, -1, 1)))        # (T, P)
        bx, by = dirs @ ex.T, dirs @ ey.T
        az = np.degrees(np.arctan2(bx, by)) % 360.0
        k = az / (360.0 / N_AZ)
        i0 = np.floor(k).astype(int) % N_AZ
        t = k - np.floor(k)
        P = np.arange(len(x))[None, :]
        mask = hz[P, i0] * (1 - t) + hz[P, (i0 + 1) % N_AZ] * t
        return el > mask

    sun_up = up_frac(sun)
    edir = earth[:, None, :] - pos[None, :, :]                          # (T, P, 3)
    edir /= np.linalg.norm(edir, axis=2, keepdims=True)
    el = np.degrees(np.arcsin(np.clip(np.einsum("tpk,pk->tp", edir, up), -1, 1)))
    bx, by = np.einsum("tpk,pk->tp", edir, ex), np.einsum("tpk,pk->tp", edir, ey)
    az = np.degrees(np.arctan2(bx, by)) % 360.0
    k = az / (360.0 / N_AZ)
    i0 = np.floor(k).astype(int) % N_AZ
    t = k - np.floor(k)
    P = np.arange(len(x))[None, :]
    earth_up = el > hz[P, i0] * (1 - t) + hz[P, (i0 + 1) % N_AZ] * t
    return (sun_up.mean(0) * 100, earth_up.mean(0) * 100, (sun_up & earth_up).mean(0) * 100)


def hillshade(x, y, n):
    """Simple hillshade from LOLA, light from grid-left, for the map backdrop."""
    h = heights(x, y).reshape(n, n)
    step = abs(x[1] - x[0])
    gy, gx = np.gradient(h, step)
    shade = (-gx * 0.7 + gy * 0.3) / np.sqrt(1 + gx ** 2 + gy ** 2)
    return np.clip(128 + shade * 400, 0, 255).astype(np.uint8), h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--half-km", type=float, default=30.0)
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()
    n, half = a.n, a.half_km * 1000
    xs = np.linspace(-half, half, n)
    ys = np.linspace(half, -half, n)  # top row first
    X, Y = np.meshgrid(xs, ys)
    x, y = X.ravel(), Y.ravel()
    if a.test:  # a few named points, quickly
        return test_points()
    chunks = [(x[i:i + 200], y[i:i + 200]) for i in range(0, len(x), 200)]
    t0 = time.time()
    with Pool(os.cpu_count()) as pool:
        res = pool.map(visibility, chunks)
    sun = np.concatenate([r[0] for r in res]); earth = np.concatenate([r[1] for r in res]); both = np.concatenate([r[2] for r in res])
    shade, h = hillshade(x, y, n)
    print(f"computed {len(x)} points in {time.time() - t0:.0f} s")
    out = np.concatenate([shade.ravel(), np.round(sun).astype(np.uint8), np.round(earth).astype(np.uint8), np.round(both).astype(np.uint8)])
    out.tofile(DATA / "illumination.bin")
    meta = {"n": n, "halfKm": a.half_km, "year": YEAR, "stepHours": STEP_H, "azimuths": N_AZ, "rangeKm": D[-1] / 1000,
            "layers": ["hillshade", "sunPct", "earthPct", "bothPct"], "projection": "south polar stereographic, x grows toward 90E, y toward 0E, rows top-down from +y",
            "heightMin": float(h.min()), "heightMax": float(h.max()),
            "source": "LOLA LDEM 80 m (PDS) horizons; JPL DE421 Sun/Earth via Skyfield"}
    (DATA / "illumination.json").write_text(json.dumps(meta, indent=1))
    print(f"sunlit: max {sun.max():.1f}%  mean {sun.mean():.1f}%  | earth max {earth.max():.1f}%  | both max {both.max():.1f}%")
    i = int(np.argmax(sun))
    print(f"best-lit point: x {x[i] / 1000:.2f} km, y {y[i] / 1000:.2f} km, sunlit {sun[i]:.1f}%, earth {earth[i]:.1f}%")


def test_points():
    """Known places: Shackleton floor (permanent shadow), connecting ridge (well lit)."""
    def xy(lat, lon):
        rho = 2 * R * np.tan(np.radians(45 + lat / 2))
        return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))
    hz = json.loads((DATA / "horizons.json").read_text())["sites"]["shackleton-ridge"]
    pts = {"Shackleton floor": (-89.67, 129.78), "Ridge (LOLA-picked)": (hz["lat"], hz["lon"]), "Haworth floor": (-87.45, -5.0), "Shoemaker floor": (-88.14, 44.91)}
    xs, ys = zip(*(xy(*v) for v in pts.values()))
    t0 = time.time()
    s, e, b = visibility((np.array(xs), np.array(ys)))
    for k, si, ei, bi in zip(pts, s, e, b):
        print(f"{k:22s} sunlit {si:5.1f}%   earth {ei:5.1f}%   both {bi:5.1f}%")
    print(f"{time.time() - t0:.1f} s for {len(xs)} points")


if __name__ == "__main__":
    main()
