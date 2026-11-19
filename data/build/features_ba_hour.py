"""BA-hour feature table for the Before (warning) model.

One row per balancing area per UTC hour. Inputs use only the past and the present (no future
observations), except the columns prefixed `fx_`, which use the next 24 h of observed weather as a
stand-in for a weather forecast. The model is trained with and without them; the results say which.

Label: `y48` = an event (data/out/events.parquet) starts within the next 48 h. Hours inside an event,
and the 48 h after it ends, are marked `in_event` so the model is not scored on them.

Output: raw/derived/ba_hour_features.parquet (large, git-ignored)
Run: uv run python build/features_ba_hour.py
"""
from __future__ import annotations

from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT, DERIVED = ROOT / "raw", ROOT / "out", ROOT / "raw" / "derived"


def num(col: str) -> str:
    return f"try_cast(replace(\"{col}\", ',', '') AS DOUBLE)"


def main() -> None:
    con = duckdb.connect()
    con.execute("SET memory_limit='14GB'")
    DERIVED.mkdir(parents=True, exist_ok=True)

    # 1. EIA-930, all files, columns by name (later files have more fuel columns).
    con.execute(f"""
        CREATE TABLE eia AS
        SELECT "Balancing Authority" AS ba,
               strptime("UTC Time at End of Hour", '%m/%d/%Y %I:%M:%S %p') - INTERVAL 1 HOUR AS hour,
               {num('Demand Forecast (MW)')} AS forecast,
               coalesce({num('Demand (MW) (Adjusted)')}, {num('Demand (MW)')}) AS demand,
               coalesce({num('Net Generation (MW) (Adjusted)')}, {num('Net Generation (MW)')}) AS netgen,
               coalesce({num('Total Interchange (MW) (Adjusted)')}, {num('Total Interchange (MW)')}) AS interchange,
               {num('Net Generation (MW) from Natural Gas')} AS gen_gas,
               {num('Net Generation (MW) from Coal')} AS gen_coal,
               {num('Net Generation (MW) from Nuclear')} AS gen_nuclear,
               {num('Net Generation (MW) from Wind')} AS gen_wind,
               {num('Net Generation (MW) from Solar')} AS gen_solar
        FROM read_csv('{RAW}/eia930/*.csv', union_by_name=true, all_varchar=true, header=true)
        WHERE "Balancing Authority" IS NOT NULL""")

    # 2. Weather: ISD-Lite fixed-width rows, weighted mean over each BA's stations.
    con.execute(f"""
        CREATE TABLE isd AS
        SELECT regexp_extract(filename, '([0-9]+-[0-9]+)-[0-9]{{4}}\\.gz', 1) AS station,
               make_timestamp(try_cast(substr(line,1,4) AS INT), try_cast(substr(line,6,2) AS INT),
                              try_cast(substr(line,9,2) AS INT), try_cast(substr(line,12,2) AS INT), 0, 0) AS hour,
               nullif(try_cast(trim(substr(line,14,6)) AS DOUBLE), -9999) / 10 AS temp_c,
               nullif(try_cast(trim(substr(line,20,6)) AS DOUBLE), -9999) / 10 AS dew_c,
               nullif(try_cast(trim(substr(line,26,6)) AS DOUBLE), -9999) / 10 AS slp_hpa,
               nullif(try_cast(trim(substr(line,38,6)) AS DOUBLE), -9999) / 10 AS wind_ms,
               nullif(try_cast(trim(substr(line,50,6)) AS DOUBLE), -9999) / 10 AS precip_mm
        FROM read_csv('{RAW}/isd/*.gz', columns={{'line':'VARCHAR'}}, header=false, delim='\\x01',
                      filename=true, compression='gzip')""")
    con.execute(f"""
        CREATE TABLE wx AS
        SELECT s.ba, i.hour,
               sum(i.temp_c*s.weight)/sum(CASE WHEN i.temp_c IS NOT NULL THEN s.weight END) AS temp_c,
               sum(i.dew_c*s.weight)/sum(CASE WHEN i.dew_c IS NOT NULL THEN s.weight END) AS dew_c,
               min(i.slp_hpa) AS slp_min_hpa,
               max(i.wind_ms) AS wind_max_ms,
               max(i.precip_mm) AS precip_max_mm
        FROM isd i JOIN (SELECT ba, usaf || '-' || wban AS station, weight
                         FROM read_csv('{OUT}/ba_stations.csv', all_varchar=false, types={{'usaf':'VARCHAR','wban':'VARCHAR'}})) s
          USING (station)
        GROUP BY s.ba, i.hour""")

    # 2b. Outages already reported (EAGLE-I), lagged one hour in the features below.
    con.execute(f"""
        CREATE TABLE outs AS SELECT ba, hour, frac FROM '{DERIVED}/ba_hour_out.parquet'""")
    con.execute("""
        CREATE TABLE nat AS
        SELECT hour, sum(out) / (SELECT sum(c) FROM (SELECT max(out / nullif(frac, 0)) AS c
                                                    FROM read_parquet('""" + str(DERIVED) + """/ba_hour_out.parquet') GROUP BY ba)) AS nat_frac
        FROM read_parquet('""" + str(DERIVED) + """/ba_hour_out.parquet') GROUP BY hour""")

    # 3. Join, derive features, label.
    con.execute(f"""
        CREATE TABLE f AS
        WITH base AS (
          SELECT e.*, w.temp_c, w.dew_c, w.slp_min_hpa, w.wind_max_ms, w.precip_max_mm,
                 coalesce(o.frac, 0) AS own_frac_now, coalesce(n.nat_frac, 0) AS nat_frac_now
          FROM eia e LEFT JOIN wx w USING (ba, hour) LEFT JOIN outs o USING (ba, hour) LEFT JOIN nat n USING (hour)),
        win AS (
          SELECT *,
            (demand - forecast) / nullif(forecast, 0) AS fc_err,
            demand / nullif(max(demand) OVER w30, 0) AS demand_vs_30d_peak,
            interchange / nullif(demand, 0) AS import_share,
            gen_gas / nullif(netgen, 0) AS gas_share,
            (netgen - lag(netgen, 6) OVER wh) / nullif(lag(netgen, 6) OVER wh, 0) AS netgen_chg_6h,
            (gen_gas - lag(gen_gas, 6) OVER wh) / nullif(lag(gen_gas, 6) OVER wh, 0) AS gas_chg_6h,
            max((demand - forecast) / nullif(forecast, 0)) OVER w24 AS fc_err_max_24h,
            temp_c - avg(temp_c) OVER w30 AS temp_anom_30d,
            min(temp_c) OVER w24 AS temp_min_24h,
            max(temp_c) OVER w24 AS temp_max_24h,
            max(wind_max_ms) OVER w24 AS wind_max_24h,
            sum(precip_max_mm) OVER w24 AS precip_24h,
            slp_min_hpa - lag(slp_min_hpa, 12) OVER wh AS slp_chg_12h,
            -- v2: adequacy against the BA's own records (past only), and the day-ahead demand forecast
            -- for the next 12 h (EIA-930 forecasts are filed the day before; 12 h keeps a margin).
            demand / nullif(max(demand) OVER wexp, 0) AS demand_vs_record,
            max(forecast) OVER fc12 / nullif(max(demand) OVER wexp, 0) AS fc12_vs_record,
            max(forecast) OVER fc12 / nullif(max(demand) OVER w365, 0) AS fc12_vs_365d_peak,
            max(forecast) OVER fc12 / nullif(max(demand) OVER w30, 0) AS fc12_vs_30d_peak,
            max(forecast) OVER fc12 / nullif(max(demand) OVER wmon, 0) AS fc12_vs_month_record,
            demand / nullif(max(demand) OVER wmon, 0) AS demand_vs_month_record,
            (temp_c - avg(temp_c) OVER wmon) / nullif(stddev_samp(temp_c) OVER wmon, 0) AS temp_z_month,
            temp_c - min(temp_c) OVER wexp AS temp_above_record_low,
            max(temp_c) OVER wexp - temp_c AS temp_below_record_high,
            (wind_max_ms - avg(wind_max_ms) OVER wmon) / nullif(stddev_samp(wind_max_ms) OVER wmon, 0) AS wind_z_month,
            -- outages already reported, one hour old (not available to the live page)
            lag(own_frac_now, 1) OVER wh AS out_own_lag1,
            lag(own_frac_now, 1) OVER wh - lag(own_frac_now, 7) OVER wh AS out_own_chg_6h,
            lag(nat_frac_now, 1) OVER wh AS out_nat_lag1,
            lag(nat_frac_now, 1) OVER wh - lag(nat_frac_now, 13) OVER wh AS out_nat_chg_12h,
            -- fx_: observed future weather as a stand-in for a weather forecast (24 h and 48 h)
            max(wind_max_ms) OVER fx48 AS fx_wind_max_48h,
            min(temp_c) OVER fx48 AS fx_temp_min_48h,
            max(temp_c) OVER fx48 AS fx_temp_max_48h,
            sum(precip_max_mm) OVER fx48 AS fx_precip_48h,
            (min(temp_c) OVER fx48 - avg(temp_c) OVER wmon) / nullif(stddev_samp(temp_c) OVER wmon, 0) AS fx_temp_min_48h_z,
            (max(temp_c) OVER fx48 - avg(temp_c) OVER wmon) / nullif(stddev_samp(temp_c) OVER wmon, 0) AS fx_temp_max_48h_z,
            (max(wind_max_ms) OVER fx48 - avg(wind_max_ms) OVER wmon) / nullif(stddev_samp(wind_max_ms) OVER wmon, 0) AS fx_wind_max_48h_z,
            min(temp_c) OVER fx48 - min(temp_c) OVER wexp AS fx_temp_min_48h_above_record,
            min(slp_min_hpa) OVER fx48 AS fx_slp_min_48h,
            -- fx_: the next 24 h of observed weather, as a stand-in for a forecast
            max(wind_max_ms) OVER fx24 AS fx_wind_max_24h,
            min(temp_c) OVER fx24 AS fx_temp_min_24h,
            max(temp_c) OVER fx24 AS fx_temp_max_24h,
            sum(precip_max_mm) OVER fx24 AS fx_precip_24h,
            hour(hour) AS hod, dayofyear(hour) AS doy, month(hour) AS month
          FROM base
          WINDOW wh AS (PARTITION BY ba ORDER BY hour),
                 w24 AS (PARTITION BY ba ORDER BY hour RANGE BETWEEN INTERVAL 23 HOUR PRECEDING AND CURRENT ROW),
                 w30 AS (PARTITION BY ba ORDER BY hour RANGE BETWEEN INTERVAL 30 DAY PRECEDING AND CURRENT ROW),
                 fx24 AS (PARTITION BY ba ORDER BY hour RANGE BETWEEN INTERVAL 1 HOUR FOLLOWING AND INTERVAL 24 HOUR FOLLOWING),
                 fx48 AS (PARTITION BY ba ORDER BY hour RANGE BETWEEN INTERVAL 1 HOUR FOLLOWING AND INTERVAL 48 HOUR FOLLOWING),
                 fc12 AS (PARTITION BY ba ORDER BY hour RANGE BETWEEN INTERVAL 1 HOUR FOLLOWING AND INTERVAL 12 HOUR FOLLOWING),
                 wexp AS (PARTITION BY ba ORDER BY hour ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),
                 w365 AS (PARTITION BY ba ORDER BY hour RANGE BETWEEN INTERVAL 365 DAY PRECEDING AND INTERVAL 1 HOUR PRECEDING),
                 wmon AS (PARTITION BY ba, month(hour) ORDER BY hour ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))
        SELECT w.* EXCLUDE (own_frac_now, nat_frac_now),
          EXISTS (SELECT 1 FROM '{OUT}/events.parquet' ev
                  WHERE ev.ba = w.ba AND ev.start > w.hour AND ev.start <= w.hour + INTERVAL 48 HOUR) AS y48,
          EXISTS (SELECT 1 FROM '{OUT}/events.parquet' ev
                  WHERE ev.ba = w.ba AND w.hour >= ev.start AND w.hour <= ev.stop + INTERVAL 48 HOUR) AS in_event
        FROM win w""")
    con.execute(f"COPY (SELECT * FROM f ORDER BY ba, hour) TO '{DERIVED}/ba_hour_features.parquet' (FORMAT parquet)")
    n, pos, bas = con.execute("SELECT count(*), sum(y48::INT), count(DISTINCT ba) FROM f").fetchone()
    print(f"rows {n:,}  BAs {bas}  positive hours {pos:,}  ({pos / n:.2%})")


if __name__ == "__main__":
    main()
