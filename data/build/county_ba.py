"""County -> balancing area (BA) weights from EIA-861 2024.

Method: each utility's customers in a state (Sales_Ult_Cust, bundled + delivery rows) are split
evenly across the counties it serves in that state (Service_Territory). A county's share for a BA
is the sum over its utilities. EIA-861 has no customer counts per county, so the even split is an
approximation; it is written in data/README.md.

Output: out/county_ba.parquet  (fips, ba, share, primary)
        out/county_ba_unmatched.csv  (EIA-861 county names with no Census FIPS)
Run: uv run python build/county_ba.py
"""
from __future__ import annotations

import re
from pathlib import Path

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "raw", ROOT / "out"

SUFFIXES = r"( county| parish| borough| census area| city and borough| municipality| municipio)$"


def norm(name: str) -> str:
    s = str(name).lower().strip()
    s = s.replace("saint ", "st ").replace("st. ", "st ").replace("ste. ", "ste ")
    s = s.replace("ñ", "n").replace("-", " ")
    s = re.sub(r"[.'’]", "", s)
    s = re.sub(SUFFIXES, "", s)
    return re.sub(r"\s+", "", s)  # no spaces: "De Soto" == "DeSoto"


def census_fips() -> pd.DataFrame:
    c = pd.read_csv(RAW / "census" / "co-est2024-alldata.csv", encoding="latin-1",
                    usecols=["SUMLEV", "STATE", "COUNTY", "STNAME", "CTYNAME", "POPESTIMATE2024"])
    c = c[c.SUMLEV == 50].copy()
    c["fips"] = c.STATE.astype(str).str.zfill(2) + c.COUNTY.astype(str).str.zfill(3)
    states = {
        "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO",
        "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA",
        "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
        "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA",
        "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
        "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
        "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
        "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
        "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
        "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"}
    c["state"] = c.STNAME.map(states)
    c["key"] = c.CTYNAME.map(norm)
    # Virginia and others: "Richmond city" and "Richmond County" both exist. Keep "city" in the key for cities.
    is_city = c.CTYNAME.str.lower().str.endswith(" city") & (c.state.isin(["VA", "MD", "MO", "NV"]))
    c.loc[is_city, "key"] = c.loc[is_city, "CTYNAME"].map(lambda n: re.sub(r"[\s.]", "", n.lower()))
    return c[["fips", "state", "key", "CTYNAME", "POPESTIMATE2024"]]


def main() -> None:
    terr = pd.read_excel(RAW / "eia861" / "Service_Territory_2024.xlsx", "Counties_States")
    terr = terr.rename(columns={"Utility Number": "utility", "State": "state", "County": "county"})
    terr["key"] = terr.county.map(norm)

    # Wires-only utilities (most of ERCOT, e.g. CenterPoint) are in Delivery_Companies, not Sales_Ult_Cust.
    sales = pd.concat([
        pd.read_excel(RAW / "eia861" / "Sales_Ult_Cust_2024.xlsx", "States", header=2),
        pd.read_excel(RAW / "eia861" / "Delivery_Companies_2024.xlsx", "Delivery Companies", header=2),
    ])
    sales = sales.rename(columns={"Utility Number": "utility", "State": "state", "BA Code": "ba",
                                  "Service Type": "service", "Count.4": "customers"})
    sales = sales[sales.service.isin(["Bundled", "Delivery"])]
    sales["customers"] = pd.to_numeric(sales.customers, errors="coerce").fillna(0)
    sales = sales[sales.customers > 0].groupby(["utility", "state", "ba"], as_index=False).customers.sum()

    fips = census_fips()
    t = terr.merge(fips[["fips", "state", "key"]], on=["state", "key"], how="left")
    # Retry unmatched names as "<name> city" (Virginia and similar independent cities)
    miss = t.fips.isna()
    retry = t[miss].drop(columns="fips").assign(key=lambda d: d.key + "city").merge(
        fips[["fips", "state", "key"]], on=["state", "key"], how="left")
    t.loc[miss, "fips"] = retry.fips.values
    unmatched = t[t.fips.isna()][["state", "county"]].drop_duplicates()
    unmatched.to_csv(OUT / "county_ba_unmatched.csv", index=False)
    t = t.dropna(subset=["fips"])

    n = t.groupby(["utility", "state"]).fips.nunique().rename("n_counties").reset_index()
    w = (t[["utility", "state", "fips"]].drop_duplicates()
         .merge(n, on=["utility", "state"]).merge(sales, on=["utility", "state"]))
    w["cust"] = w.customers / w.n_counties
    cb = w.groupby(["fips", "ba"], as_index=False).cust.sum()
    cb["share"] = cb.cust / cb.groupby("fips").cust.transform("sum")
    cb["primary"] = cb.groupby("fips").share.transform("max") == cb.share
    cb = cb.drop(columns="cust").sort_values(["fips", "share"], ascending=[True, False])

    OUT.mkdir(exist_ok=True)
    duckdb.from_df(cb).write_parquet(str(OUT / "county_ba.parquet"))
    print(f"counties with a BA: {cb.fips.nunique()} of {len(fips)}; BAs: {cb.ba.nunique()}; "
          f"unmatched EIA-861 names: {len(unmatched)}")


if __name__ == "__main__":
    main()
