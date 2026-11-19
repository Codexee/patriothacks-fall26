"""Event library from EAGLE-I + the county -> BA map.

Steps
1. Each EAGLE-I year file (15-min, by county) -> hourly max customers out per county
   (raw/derived/county_hour_<year>.parquet, git-ignored).
2. BA-hour share of customers out = sum(county out x county share) / sum(county customers x share).
   County customers come from EAGLE-I's MCC.csv (modeled customer counts).
3. An event = a BA's share out >= THRESH for >= MIN_HOURS hours in a row. Events closer than
   MERGE_GAP hours merge. Rule fixed before any training (spec: "1% of a BA's customers, 4 h+").

Outputs (out/ is committed and small; raw/derived/ is git-ignored)
  out/events.parquet + out/events.json   one row per event
  raw/derived/ba_hour_out.parquet       BA-hour share out (large; git-ignored; training labels come from this)
Run: uv run python build/labels.py [years...]   (default: every EAGLE-I file present)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "raw", ROOT / "out"
DERIVED = RAW / "derived"

THRESH = 0.01      # 1% of the BA's customers
MIN_HOURS = 4
MERGE_GAP = 12     # hours

# Connecticut: Census 2022+ uses planning regions; EAGLE-I uses the old counties. All of CT is ISO-NE.
CT_OLD = ["09001", "09003", "09005", "09007", "09009", "09011", "09013", "09015"]


def county_hour(con: duckdb.DuckDBPyConnection, year: int) -> Path:
    src = RAW / "eaglei" / f"eaglei_outages_{year}.csv"
    dst = DERIVED / f"county_hour_{year}.parquet"
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        return dst
    DERIVED.mkdir(parents=True, exist_ok=True)
    con.execute(f"""
        COPY (
          -- Read by position: the header differs by year (2023 calls the count "sum"; 2024 adds total_customers).
          SELECT lpad(column0, 5, '0') AS fips,
                 date_trunc('hour', CAST(column4 AS TIMESTAMP)) AS hour,
                 max(try_cast(column3 AS DOUBLE)) AS out
          FROM read_csv('{src}', header=false, skip=1, all_varchar=true, null_padding=true)
          WHERE try_cast(column3 AS DOUBLE) > 0
          GROUP BY ALL
        ) TO '{dst}' (FORMAT parquet)""")
    print(f"county-hour {year}: {con.execute(f"SELECT count(*) FROM '{dst}'").fetchone()[0]:,} rows", flush=True)
    return dst


def main() -> None:
    years = [int(y) for y in sys.argv[1:]] or sorted(
        int(p.stem.split("_")[-1]) for p in (RAW / "eaglei").glob("eaglei_outages_*.csv"))
    con = duckdb.connect()
    con.execute("SET memory_limit='12GB'")

    ba930 = {r[0] for r in con.execute(f"""
        SELECT DISTINCT "Balancing Authority" FROM read_csv('{RAW}/eia930/EIA930_BALANCE_2021_Jan_Jun.csv', all_varchar=true)""").fetchall()}
    con.execute(f"CREATE TABLE cba AS SELECT fips, ba, share FROM '{OUT}/county_ba.parquet'")
    con.execute("INSERT INTO cba SELECT unnest(?), 'ISNE', 1.0", [CT_OLD])
    con.execute("DELETE FROM cba WHERE ba NOT IN (SELECT unnest(?))", [sorted(ba930)])
    con.execute(f"""CREATE TABLE mcc AS SELECT lpad(CAST(County_FIPS AS VARCHAR),5,'0') AS fips, Customers AS customers
                    FROM read_csv('{RAW}/eaglei/MCC.csv', header=true)""")
    con.execute("""CREATE TABLE ba_cust AS SELECT ba, sum(customers*share) AS customers
                   FROM cba JOIN mcc USING (fips) GROUP BY ba""")

    files = [str(county_hour(con, y)) for y in years]
    con.execute(f"""
        CREATE TABLE ba_hour AS
        SELECT ba, hour, sum(least(out, coalesce(m.customers, out))*share) AS out  -- cap at the county's customers
        FROM read_parquet({files}) JOIN cba USING (fips) LEFT JOIN mcc m USING (fips)
        GROUP BY ba, hour""")
    con.execute("""
        CREATE TABLE ba_hour_frac AS
        SELECT h.ba, h.hour, h.out, h.out / c.customers AS frac
        FROM ba_hour h JOIN ba_cust c USING (ba)""")
    con.execute(f"COPY (SELECT * FROM ba_hour_frac ORDER BY ba, hour) TO '{DERIVED}/ba_hour_out.parquet' (FORMAT parquet)")

    # Runs of consecutive hours at or above THRESH, then merge runs closer than MERGE_GAP.
    con.execute(f"""
        CREATE TABLE runs AS
        WITH above AS (
          SELECT ba, hour, out, frac,
                 hour - to_hours(CAST(row_number() OVER (PARTITION BY ba ORDER BY hour) AS BIGINT)) AS grp
          FROM ba_hour_frac WHERE frac >= {THRESH})
        SELECT ba, min(hour) AS start, max(hour) AS stop, count(*) AS hours,
               max(frac) AS peak_frac, max(out) AS peak_out
        FROM above GROUP BY ba, grp HAVING count(*) >= {MIN_HOURS}""")
    con.execute(f"""
        CREATE TABLE events AS
        WITH ordered AS (
          SELECT *, CASE WHEN start - lag(stop) OVER (PARTITION BY ba ORDER BY start) <= INTERVAL {MERGE_GAP} HOUR
                         THEN 0 ELSE 1 END AS new_ev
          FROM runs),
        numbered AS (SELECT *, sum(new_ev) OVER (PARTITION BY ba ORDER BY start) AS ev FROM ordered)
        SELECT ba || '-' || strftime(min(start), '%Y%m%d%H') AS event_id, ba,
               min(start) AS start, max(stop) AS stop, sum(hours) AS hours_above,
               max(peak_frac) AS peak_frac, max(peak_out) AS peak_customers_out
        FROM numbered GROUP BY ba, ev ORDER BY start""")
    con.execute(f"COPY events TO '{OUT}/events.parquet' (FORMAT parquet)")
    rows = con.execute("SELECT * FROM events").df()
    rows["start"] = rows.start.astype(str)
    rows["stop"] = rows.stop.astype(str)
    (OUT / "events.json").write_text(json.dumps({
        "rule": {"threshold_share_of_ba_customers": THRESH, "min_hours": MIN_HOURS, "merge_gap_hours": MERGE_GAP},
        "years": years, "count": len(rows), "events": rows.to_dict(orient="records")}, indent=1))
    print(f"events: {len(rows)} in {rows.ba.nunique()} BAs, years {years[0]}-{years[-1]}")
    print(rows.groupby(rows.start.str[:4]).size().to_string())


if __name__ == "__main__":
    main()
