"""Reference values from the JPL Horizons API for validating the site.

For a few sites and dates, asks Horizons (ssd.jpl.nasa.gov/api/horizons.api)
for the apparent, airless azimuth and elevation of the Sun and Earth as seen
from a point on the lunar surface. The site recomputes the same quantities from
its own data and shows the difference (src/validation.js, npm test).

Output: public/data/validation.json
"""
import json
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "validation.json"
API = "https://ssd.jpl.nasa.gov/api/horizons.api"

SITES = {  # id: (lat, lon east) - Shackleton ridge uses the LOLA-picked point
    "shackleton-ridge": None,
    "malapert-a": (-80.13, 1.44),
    "apollo-11": (0.674, 23.473),
    "chang-e-4": (-45.444, 177.588),
}
TIMES = ["2026-12-01 00:00", "2027-03-15 12:00", "2027-07-04 06:00", "2028-01-20 18:00"]
TARGETS = {"sun": "10", "earth": "399"}


def query(target, lat, lon):
    params = {
        "format": "json", "COMMAND": f"'{target}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'coord@301'", "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon % 360:.5f},{lat:.5f},0'", "TIME_TYPE": "'UT'",
        "TLIST": " ".join(f"'{t}'" for t in TIMES), "QUANTITIES": "'4'", "ANG_FORMAT": "'DEG'",
        "EXTRA_PREC": "'YES'", "APPARENT": "'AIRLESS'", "CSV_FORMAT": "'YES'",
    }
    url = API + "?" + urllib.parse.urlencode(params, safe="'")
    out = subprocess.run(["curl", "-fsS", url], check=True, capture_output=True, text=True).stdout
    text = json.loads(out)["result"]
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    vals = []
    for r in rows:
        cols = [c.strip() for c in r.split(",")]
        nums = [c for c in cols[1:] if c and c.lstrip("-").replace(".", "", 1).isdigit()]
        vals.append((float(nums[-2]), float(nums[-1])))  # azimuth, elevation
    return vals


def main():
    hz = json.loads((ROOT / "public" / "data" / "horizons.json").read_text())
    cases = []
    for sid, ll in SITES.items():
        lat, lon = ll if ll else (hz["sites"][sid]["lat"], hz["sites"][sid]["lon"])
        for body, code in TARGETS.items():
            for t, (az, el) in zip(TIMES, query(code, lat, lon)):
                cases.append({"site": sid, "lat": lat, "lon": lon, "body": body, "utc": t.replace(" ", "T") + ":00Z", "az": az, "el": el})
                print(f"{sid:17s} {body:5s} {t}  az {az:9.4f}  el {el:8.4f}")
    OUT.write_text(json.dumps({"source": "JPL Horizons API, apparent airless az/el, lunar geodetic site, alt 0", "cases": cases}, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
