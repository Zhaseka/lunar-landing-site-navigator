"""Fetch the public NASA/JPL data this site is built on into data/raw/.

  LOLA gridded elevation models (PDS Geosciences Node, LRO-L-LOLA-3-RDR-V1):
    ldem_80s_80m   80-90 S polar stereographic, 80 m/px      (~230 MB)
    ldem_60s_240m  60-90 S polar stereographic, 240 m/px     (~230 MB)
    ldem_16        global simple cylindrical, 16 px/deg      (~ 33 MB)
  JPL / NAIF kernels (via Skyfield's loader):
    de421.bsp, moon_pa_de421_1900-2050.bpc, moon_080317.tf, pck00008.tpc

Usage: pipeline/.venv/bin/python pipeline/download.py
"""
import subprocess
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
PDS = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr"
DEMS = [
    f"{PDS}/polar/img/ldem_80s_80m.lbl", f"{PDS}/polar/img/ldem_80s_80m.img",
    f"{PDS}/polar/img/ldem_60s_240m.lbl", f"{PDS}/polar/img/ldem_60s_240m.img",
    f"{PDS}/cylindrical/img/ldem_16.lbl", f"{PDS}/cylindrical/img/ldem_16.img",
]


def fetch(url: str) -> None:
    dest = RAW / url.rsplit("/", 1)[1]
    if dest.exists() and dest.stat().st_size > 0:
        print("have", dest.name, flush=True)
        return
    print("get ", url, flush=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    # curl uses the system trust store (Python's bundled one fails on some Macs)
    subprocess.run(["curl", "-fL", "--retry", "3", "-C", "-", "-sS", "-o", str(tmp), url], check=True)
    tmp.replace(dest)
    print("done", dest.name, dest.stat().st_size // 1_000_000, "MB", flush=True)


def kernels() -> None:
    from skyfield.api import Loader
    load = Loader(str(RAW))
    for name in ("de421.bsp", "moon_080317.tf", "pck00008.tpc", "moon_pa_de421_1900-2050.bpc"):
        load(name)
        print("have", name, flush=True)


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    kernels()
    for u in DEMS:
        fetch(u)
    print("ALL DONE")
