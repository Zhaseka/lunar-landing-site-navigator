"""Verify the polar DEM orientation: known craters must be pits.

For each crater, the floor (centre) must sit well below the mean height of a
ring at ~0.6 crater radii. Tries the four axis-sign conventions and reports
which one makes every crater a pit; lola.py uses that convention.
"""
import numpy as np
import lola

# name, lat, lon (east), diameter km  (IAU Gazetteer of Planetary Nomenclature)
CRATERS = [
    ("Shackleton", -89.67, 129.78, 21),
    ("Shoemaker", -88.14, 44.91, 51),
    ("Faustini", -87.18, 77.0, 39),
    ("Haworth", -87.45, -5.0, 51),
    ("de Gerlache", -88.5, -87.1, 32),
]


def depth(g, lat, lon, dkm, sx, sy):
    L = g.lbl
    def ls(la, lo):
        rho = 2 * lola.R_M * np.tan(np.radians(45 + la / 2))
        lam = np.radians(lo)
        x, y = rho * np.sin(lam), rho * np.cos(lam)
        return L["LINE_PROJECTION_OFFSET"] + sy * y / L["MAP_SCALE"], L["SAMPLE_PROJECTION_OFFSET"] + sx * x / L["MAP_SCALE"]
    from scipy.ndimage import map_coordinates
    l0, s0 = ls(np.array([lat]), np.array([lon]))
    centre = map_coordinates(g.h, [l0, s0], order=1)[0]
    r_px = dkm * 1000 * 0.6 / 2 / L["MAP_SCALE"] * 2  # 0.6 radius in px
    ang = np.linspace(0, 2 * np.pi, 72, endpoint=False)
    ring = map_coordinates(g.h, [l0 + r_px * np.sin(ang), s0 + r_px * np.cos(ang)], order=1).mean()
    return centre - ring


g = lola.grid("ldem_80s_80m")
best = None
for sx in (1, -1):
    for sy in (1, -1):
        d = [depth(g, la, lo, dk, sx, sy) for _, la, lo, dk in CRATERS]
        ok = all(x < -1000 for x in d)
        print(f"sample sign {sx:+d}, line sign {sy:+d}: " + ", ".join(f"{n} {x:+.0f} m" for (n, *_), x in zip(CRATERS, d)), "<- all pits" if ok else "")
        if ok:
            best = (sx, sy)
print("convention:", best)

# The adopted convention in lola.py must agree
la = np.array([c[1] for c in CRATERS]); lo = np.array([c[2] for c in CRATERS])
print("lola.height at crater centres (m):", np.round(lola.height(la, lo)))
