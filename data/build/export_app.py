"""Write the app's static data (the contract in contracts/README.md) to app/public/data/v1/.

  counties.json            one row per county: names, population, vulnerability, level, BA
  counties-10m.json        us-atlas TopoJSON (copied)
  events.json              the event library (+ warning results when the models have run)
  events/<id>.json         hourly replay for one event: BA risk line + county outage shares
  evidence.csv             events.json as CSV (the download)

Model outputs are optional. If <shared>/ba_hour_pred.parquet or county_event_pred.parquet (written
by models/) are missing, the risk and prediction fields are null and "stub": true is set.

Run: uv run python build/export_app.py [--replays N]   (default: top 40 events by customers out + heroes)
"""
from __future__ import annotations

import csv
import json
import shutil
import sys
from pathlib import Path

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT, DERIVED = ROOT / "raw", ROOT / "out", ROOT / "raw" / "derived"
APP = ROOT.parent / "app" / "public" / "data" / "v1"
TRAIN_END = "2021-01-01"           # train < this, test >= this (spec)
ALERT_THRESHOLD_FILE = DERIVED / "warn_threshold.json"   # written by models/: {"p_full": x, "p_grid": y}

STATE = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
         "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
         "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
         "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
         "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
         "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"}

HEROES = {  # event ids are matched by BA + date window after the library is built
    "texas2021": ("ERCO", "2021-02-13", "2021-02-17", "Texas winter storm (Uri), Feb 2021"),
    "elliott2022": ("TVA", "2022-12-22", "2022-12-25", "Winter Storm Elliott, Dec 2022"),
    "irma2017": ("FPL", "2017-09-08", "2017-09-11", "Hurricane Irma, Sep 2017"),
}


def counties(con) -> pd.DataFrame:
    topo = json.loads((RAW / "shapes" / "counties-10m.json").read_text())
    base = pd.DataFrame([{"fips": g["id"], "name": g["properties"]["name"]}
                         for g in topo["objects"]["counties"]["geometries"] if g["id"][:2] in STATE])
    base["state"] = base.fips.str[:2].map(STATE)

    pop = pd.read_csv(RAW / "census" / "co-est2024-alldata.csv", encoding="latin-1",
                      usecols=["SUMLEV", "STATE", "COUNTY", "POPESTIMATE2024"])
    pop = pop[pop.SUMLEV == 50]
    pop["fips"] = pop.STATE.astype(str).str.zfill(2) + pop.COUNTY.astype(str).str.zfill(3)

    svi = pd.read_csv(RAW / "svi" / "SVI_2022_US_county.csv", dtype={"FIPS": str}, usecols=["FIPS", "RPL_THEMES", "E_TOTPOP"])
    svi = svi.rename(columns={"FIPS": "fips", "RPL_THEMES": "svi", "E_TOTPOP": "svi_pop"})
    svi.loc[svi.svi < 0, "svi"] = None

    emp = pd.DataFrame(json.loads((RAW / "empower" / "empower_county.json").read_text()))
    emp = emp.rename(columns={"FIPS_Code": "fips", "Power_Dependent_Devices_DME": "dme", "Medicare_Benes": "medicare"})
    emp = emp[["fips", "dme", "medicare"]].drop_duplicates("fips")

    mcc = con.execute(f"""SELECT lpad(CAST(County_FIPS AS VARCHAR),5,'0') AS fips, Customers AS customers
                          FROM read_csv('{RAW}/eaglei/MCC.csv', header=true)""").df()
    ba = con.execute(f"SELECT fips, ba FROM '{OUT}/county_ba.parquet' WHERE \"primary\"").df().drop_duplicates("fips")

    c = (base.merge(pop[["fips", "POPESTIMATE2024"]], on="fips", how="left").merge(svi, on="fips", how="left")
         .merge(emp, on="fips", how="left").merge(mcc, on="fips", how="left").merge(ba, on="fips", how="left"))
    c["pop"] = c.POPESTIMATE2024.fillna(c.svi_pop)
    c.loc[c.ba.isna() & (c.state == "CT"), "ba"] = "ISNE"  # old CT counties (see data/README.md)
    # Hollow level 1 (surface, least vulnerable) .. 50 (deepest, most vulnerable), from the SVI percentile.
    c["level"] = (c.svi * 50).apply(lambda v: None if pd.isna(v) else int(min(50, max(1, -(-v // 1)))))
    return c[["fips", "name", "state", "pop", "svi", "level", "customers", "dme", "medicare", "ba"]]


def nn(v):
    """JSON-safe number: NaN -> None, whole floats -> int."""
    if v is None or pd.isna(v):
        return None
    return int(v) if float(v).is_integer() else round(float(v), 4)


def main() -> None:
    n_replays = int(sys.argv[sys.argv.index("--replays") + 1]) if "--replays" in sys.argv else 40
    con = duckdb.connect()
    APP.mkdir(parents=True, exist_ok=True)
    (APP / "events").mkdir(exist_ok=True)

    c = counties(con)
    (APP / "counties.json").write_text(json.dumps(
        [{k: (v if isinstance(v, str) else nn(v)) for k, v in r.items()} for r in c.to_dict(orient="records")],
        separators=(",", ":")))
    shutil.copy(RAW / "shapes" / "counties-10m.json", APP / "counties-10m.json")
    con.register("counties", c)

    ev = con.execute(f"SELECT * FROM '{OUT}/events.parquet' ORDER BY start").df()
    have_pred = (DERIVED / "ba_hour_pred.parquet").exists()
    have_dark = (DERIVED / "county_event_pred.parquet").exists()
    thr = json.loads(ALERT_THRESHOLD_FILE.read_text()) if ALERT_THRESHOLD_FILE.exists() else {}

    hero_of = {}
    for slug, (ba, lo, hi, title) in HEROES.items():
        m = ev[(ev.ba == ba) & (ev.start >= lo) & (ev.start <= hi)]
        if len(m):
            hero_of[m.sort_values("peak_customers_out").iloc[-1].event_id] = (slug, title)

    files = sorted(str(p) for p in DERIVED.glob("county_hour_*.parquet"))
    con.execute(f"CREATE VIEW ch AS SELECT * FROM read_parquet({files})")
    replay_ids = set(ev.sort_values("peak_customers_out", ascending=False).head(n_replays).event_id) | set(hero_of)

    rows = []
    for e in ev.itertuples():
        lead, first_alert = None, None
        if have_pred and "p_full" in thr:
            r = con.execute(f"""SELECT min(hour) FROM '{DERIVED}/ba_hour_pred.parquet'
                                WHERE ba = ? AND hour >= ? - INTERVAL 72 HOUR AND hour < ? AND p_full >= ?""",
                            [e.ba, e.start, e.start, thr["p_full"]]).fetchone()[0]
            if r is not None:
                first_alert, lead = str(r), int((e.start - r).total_seconds() // 3600)
        slug, title = hero_of.get(e.event_id, (None, None))
        rows.append({"id": e.event_id, "ba": e.ba, "start": str(e.start), "stop": str(e.stop),
                     "hoursAbove": int(e.hours_above), "peakFrac": round(float(e.peak_frac), 4),
                     "peakCustomersOut": int(e.peak_customers_out),
                     "split": "train" if str(e.start) < TRAIN_END else "test",
                     "hero": slug, "title": title, "hasReplay": e.event_id in replay_ids,
                     "firstAlert": first_alert, "leadHours": lead})

        if e.event_id not in replay_ids:
            continue
        t0 = e.start - pd.Timedelta(hours=72)
        t1 = min(e.stop + pd.Timedelta(hours=24), e.start + pd.Timedelta(days=11))
        hours = pd.date_range(t0, t1, freq="h")
        idx = {h: i for i, h in enumerate(hours)}
        co = con.execute("""
            SELECT ch.fips, ch.hour, least(1.0, ch.out / c.customers) AS frac
            FROM ch JOIN counties c USING (fips)
            WHERE ch.hour BETWEEN ? AND ? AND c.customers > 0
              AND ch.fips IN (SELECT fips FROM ch JOIN counties c2 USING (fips)
                              WHERE hour BETWEEN ? AND ? AND c2.customers > 0
                              GROUP BY fips HAVING max(out / c2.customers) >= 0.02)""", [t0, t1, t0, t1]).df()
        dark = {}
        if have_dark:
            dark = {r[0]: r[1] for r in con.execute(
                f"SELECT fips, pred_dark_hours FROM '{DERIVED}/county_event_pred.parquet' WHERE event_id = ?",
                [e.event_id]).fetchall()}
        cl = []
        for fips, g in co.groupby("fips"):
            arr = [0] * len(hours)
            for h, f in zip(g.hour, g.frac):
                arr[idx[h]] = int(round(f * 100))
            cl.append({"fips": fips, "out": arr, "darkHours": int(sum(1 for v in arr if v >= 10)),
                       "predDarkHours": nn(dark.get(fips))})
        risk = None
        if have_pred:
            p = con.execute(f"""SELECT hour, p_full FROM '{DERIVED}/ba_hour_pred.parquet'
                                WHERE ba = ? AND hour BETWEEN ? AND ?""", [e.ba, t0, t1]).df()
            risk = [None] * len(hours)
            for h, v in zip(p.hour, p.p_full):
                risk[idx[h]] = nn(v)
        (APP / "events" / f"{e.event_id}.json").write_text(json.dumps({
            "id": e.event_id, "ba": e.ba, "t0": str(t0), "hours": len(hours), "eventStartIndex": 72,
            "risk": risk, "alertThreshold": thr.get("p_full"), "counties": cl,
            "stub": not (have_pred and have_dark)}, separators=(",", ":")))

    meta = json.loads((OUT / "events.json").read_text())
    (APP / "events.json").write_text(json.dumps({
        "rule": meta["rule"], "years": [meta["years"][0], meta["years"][-1]], "trainEnd": TRAIN_END,
        "count": len(rows), "stub": not have_pred, "events": rows}, separators=(",", ":")))
    with open(APP / "evidence.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    size = sum(p.stat().st_size for p in APP.rglob("*") if p.is_file()) / 1e6
    print(f"counties {len(c)}  events {len(rows)}  replays {len(replay_ids)}  heroes {list(hero_of.values())}  {size:.1f} MB")


if __name__ == "__main__":
    main()
