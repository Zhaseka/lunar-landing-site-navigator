"""LOLA gridded elevation models: loading and sampling by latitude/longitude.

Heights are metres above the 1737.4 km reference sphere (DN * 0.5).
  ldem_80s_80m   polar stereographic, 80-90 S, 80 m/px
  ldem_60s_240m  polar stereographic, 60-90 S, 240 m/px
  ldem_16        simple cylindrical, global, 16 px/deg
"""
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.ndimage import map_coordinates

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
R_M = 1737400.0


def _label(name):
    txt = (RAW / f"{name}.lbl").read_text(errors="ignore")
    def num(key):
        m = re.search(rf"^\s*{key}\s*=\s*'?(-?[\d.]+)", txt, re.M)
        return float(m.group(1)) if m else None
    return {k: num(k) for k in ("LINES", "LINE_SAMPLES", "SCALING_FACTOR", "MAP_SCALE", "MAP_RESOLUTION",
                                "LINE_PROJECTION_OFFSET", "SAMPLE_PROJECTION_OFFSET", "CENTER_LONGITUDE",
                                "CENTER_LATITUDE", "MAXIMUM_LATITUDE", "MINIMUM_LATITUDE",
                                "WESTERNMOST_LONGITUDE", "EASTERNMOST_LONGITUDE")}


class Grid:
    def __init__(self, name):
        self.name = name
        self.lbl = _label(name)
        lines, samples = int(self.lbl["LINES"]), int(self.lbl["LINE_SAMPLES"])
        raw = np.memmap(RAW / f"{name}.img", dtype="<i2", mode="r", shape=(lines, samples))
        self.h = np.asarray(raw, dtype=np.float32) * np.float32(self.lbl["SCALING_FACTOR"])
        self.polar = self.lbl["MAP_SCALE"] is not None and self.lbl["CENTER_LATITUDE"] == -90

    def line_sample(self, lat, lon):
        """0-based fractional (line, sample) for arrays of lat/lon in degrees."""
        L = self.lbl
        if self.polar:
            # South polar stereographic (LOLA convention, verified against
            # known features in pipeline/check_dem.py)
            rho = 2 * R_M * np.tan(np.radians(45 + lat / 2))
            lam = np.radians(lon - L["CENTER_LONGITUDE"])
            x = rho * np.sin(lam)
            y = rho * np.cos(lam)
            sample = L["SAMPLE_PROJECTION_OFFSET"] + x / L["MAP_SCALE"]
            line = L["LINE_PROJECTION_OFFSET"] - y / L["MAP_SCALE"]
            return line, sample
        res = L["MAP_RESOLUTION"]
        lon360 = np.mod(lon, 360.0)
        sample = L["SAMPLE_PROJECTION_OFFSET"] + (lon360 - L["CENTER_LONGITUDE"]) * res
        line = L["LINE_PROJECTION_OFFSET"] - lat * res
        return line, sample

    def covers(self, lat):
        return lat <= self.lbl["MAXIMUM_LATITUDE"] if self.polar else np.ones_like(lat, dtype=bool)

    def sample(self, lat, lon):
        line, samp = self.line_sample(lat, lon)
        mode = "nearest" if self.polar else "wrap"
        return map_coordinates(self.h, [line, samp], order=1, mode=mode)


@lru_cache(maxsize=None)
def grid(name):
    return Grid(name)


def height(lat, lon):
    """Best-available LOLA height (m) at arrays of lat/lon: 80 m, then 240 m, then global."""
    lat = np.asarray(lat, dtype=np.float64)
    lon = np.asarray(lon, dtype=np.float64)
    out = grid("ldem_16").sample(lat, lon)
    for name, limit in (("ldem_60s_240m", -60.5), ("ldem_80s_80m", -80.2)):
        m = lat <= limit
        if m.any():
            out[m] = grid(name).sample(lat[m], lon[m])
    return out
