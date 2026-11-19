"""Rebuild the small, offline county reference from two public source files.

uv run --project models --with python-calamine python models/reference/prepare.py SVI_2010_US_county.csv f8612012.zip
"""
import hashlib
import re
import sys
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pandas as pd


def key(name):
    name = name.lower().replace("saint ", "st ").replace("ñ", "n")
    name = re.sub(r" (county|parish|city and borough|borough|census area|municipality|municipio)$", "", name)
    return re.sub(r"[\s.'’-]", "", name)


def main(svi_path, eia_path):
    for path, expected in [
        (svi_path, "1e0e1bbdd03c873858c86d8cc9d60560e57f66c2ee49775d8237436777dba2d2"),
        (eia_path, "a50a3e90afd8886aa38243ea12a334c11e1fdb87cc24719176fbfdf3ee909edd"),
    ]:
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f"Unexpected source file: {path}")

    ref = pd.read_csv(svi_path, dtype={"FIPS": str}, na_values=-999).rename(columns={
        "FIPS": "fips", "ST": "state", "TOTPOP": "pop", "R_PL_THEMES": "svi",
        **{f"R_PL_THEME{i}": f"svi_t{i}" for i in range(1, 5)},
    })
    ref["county"] = ref.LOCATION.str.rsplit(", ", n=1).str[0].map(key)
    with ZipFile(eia_path) as z:
        territory = pd.read_excel(BytesIO(z.read("service_territory_2012.xls")), engine="calamine")
        sales = pd.read_excel(BytesIO(z.read("Sales_Ult_Cust_2012.xlsx")), engine="calamine", header=2)
    territory = territory.rename(columns={"Utility Number": "utility", "State": "state", "County": "county"})
    territory = territory[["utility", "state", "county"]].dropna().copy()
    territory["county"] = territory.county.map(key)
    territory = territory.drop_duplicates()
    territory = territory.merge(ref[["state", "county", "fips"]], how="left", validate="many_to_one")
    utilities = territory.groupby("fips").utility.nunique().rename("utilities")
    # EIA reports customers per utility-state. Distribute the reported count over
    # every listed county before dropping unmatched names.
    sales = sales.rename(columns={"Utility Number": "utility", "State": "state", "Count.4": "customers"})
    sales = sales[sales.SERVICE_TYPE.isin(["Bundled", "Delivery"])]
    sales["customers"] = pd.to_numeric(sales.customers, errors="coerce")
    totals = sales.groupby(["utility", "state"]).customers.sum(min_count=1)
    territory = territory.join(totals, on=["utility", "state"])
    territory["estimate"] = territory.customers / territory.groupby(["utility", "state"]).county.transform("size")
    customers = territory.groupby("fips").estimate.sum(min_count=1).rename("customers")
    cols = ["fips", "pop", "svi", "svi_t1", "svi_t2", "svi_t3", "svi_t4"]
    out = ref[cols].set_index("fips").join([utilities, customers]).sort_index()
    out.loc[out.customers <= 0, "customers"] = float("nan")
    out.to_parquet(Path(__file__).with_name("county_2010_2012.parquet"))


if __name__ == "__main__":
    main(*map(Path, sys.argv[1:]))
