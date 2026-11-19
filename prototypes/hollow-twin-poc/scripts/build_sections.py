"""Build the Hollow's 400 sections (50 levels x 8) from the real US counties.

Spec: .plans/hollow-real-data-spec.md, workstream 3. Writes src/data/real/sections.ts (contract: SectionData).

Usage (from prototypes/hollow-twin-poc):
  uv run --project <repo>/data python scripts/build_sections.py \
      <repo>/app/public/data/v1/counties.json \
      <repo>/data/raw/census/co-est2024-alldata.csv \
      src/data/real/sections.ts

Rules
- Level: the existing `level` field of counties.json (1..50, from the CDC SVI rank; 1 = least vulnerable).
  Counties with no level (8 old Connecticut counties and Valdez-Cordova, AK, which SVI 2022 does not list) are left out.
- Split of a level into 8 sections: sort the level's counties by SVI (low to high, ties by FIPS) and lay their
  populations end to end. Cut that line at 1/8, 2/8, ... of the level's population. Section c gets the counties
  between cut c and cut c+1. A county that crosses a cut is divided at the cut: each part takes its share of the
  county's population and power-dependent residents. So every section of a level has exactly the same population,
  and column 0 holds the level's least vulnerable counties.
- share = section population / population of all counties with a level (sums to 1).
- svi = population-weighted mean SVI of the section's county parts.
- dme = sum of HHS emPOWER power-dependent residents of the parts (rounded; null in the source counts as 0).
- growthPerYear = (sum of 2024 estimates / sum of 2020 estimates) ** (1/4) - 1, over the parts (Census co-est2024).
- counties: the 5 largest parts, largest first (pop = the part in this section). countyCount = all parts.
"""
import csv
import json
import sys
from collections import defaultdict

LEVELS = 50
COLS = 8
KEEP = 5


def load_census(path):
    """FIPS -> (name, pop2020, pop2024) for county rows (SUMLEV 050)."""
    out = {}
    with open(path, encoding="latin-1", newline="") as f:
        for r in csv.DictReader(f):
            if r["SUMLEV"] != "050":
                continue
            out[r["STATE"] + r["COUNTY"]] = (r["CTYNAME"], int(r["POPESTIMATE2020"]), int(r["POPESTIMATE2024"]))
    return out


def main(counties_path, census_path, out_path):
    counties = json.load(open(counties_path))
    census = load_census(census_path)
    used = [c for c in counties if c.get("level") and c.get("pop") and c.get("svi") is not None]
    dropped = [c for c in counties if c not in used]
    no_census = [c["fips"] for c in used if c["fips"] not in census]
    if no_census:
        raise SystemExit(f"counties with a level but no Census row: {no_census}")
    total = sum(c["pop"] for c in used)

    by_level = defaultdict(list)
    for c in used:
        by_level[c["level"]].append(c)
    assert sorted(by_level) == list(range(1, LEVELS + 1))

    rows = []
    for level in range(1, LEVELS + 1):
        cs = sorted(by_level[level], key=lambda c: (c["svi"], c["fips"]))
        lpop = sum(c["pop"] for c in cs)
        cuts = [lpop * k / COLS for k in range(COLS + 1)]
        parts = [[] for _ in range(COLS)]  # (county, fraction of the county in this section)
        start = 0.0
        for c in cs:
            end = start + c["pop"]
            for col in range(COLS):
                lo, hi = max(start, cuts[col]), min(end, cuts[col + 1])
                if hi > lo:
                    parts[col].append((c, (hi - lo) / c["pop"]))
            start = end
        for col in range(COLS):
            ps = parts[col]
            pop = sum(c["pop"] * f for c, f in ps)
            p20 = sum(census[c["fips"]][1] * f for c, f in ps)
            p24 = sum(census[c["fips"]][2] * f for c, f in ps)
            listed = sorted(ps, key=lambda p: (-p[0]["pop"] * p[1], p[0]["fips"]))
            rows.append({
                "share": pop / total,
                "svi": sum(c["svi"] * c["pop"] * f for c, f in ps) / pop,
                "dme": round(sum((c["dme"] or 0) * f for c, f in ps)),
                "growthPerYear": (p24 / p20) ** 0.25 - 1,
                "countyCount": len(ps),
                "counties": [
                    {"fips": c["fips"], "name": census[c["fips"]][0], "state": c["state"],
                     "svi": c["svi"], "pop": round(c["pop"] * f)}
                    for c, f in listed[:KEEP]
                ],
            })

    assert len(rows) == LEVELS * COLS
    assert abs(sum(r["share"] for r in rows) - 1) < 1e-9

    def fmt(r):
        cs = ", ".join(
            f'{{ fips: "{c["fips"]}", name: {json.dumps(c["name"], ensure_ascii=False)}, state: "{c["state"]}", '
            f'svi: {c["svi"]}, pop: {c["pop"]} }}'
            for c in r["counties"]
        )
        return (f'    {{ share: {r["share"]:.8f}, svi: {r["svi"]:.4f}, dme: {r["dme"]}, '
                f'growthPerYear: {r["growthPerYear"]:.5f}, countyCount: {r["countyCount"]}, counties: [{cs}] }},')

    detail = (
        f"{len(used):,} US counties (pop {total:,}), placed on levels 1-50 by CDC SVI 2022 rank (1 = least vulnerable). "
        "Each level is cut into 8 sections of equal population (counties sorted by SVI; a county that crosses a cut is "
        "divided). Power-dependent residents: HHS emPOWER. Growth: Census county estimates 2020-2024. "
        "The engine rescales each share to its own total population."
    )
    lines = [
        "// Generated by scripts/build_sections.py. Do not edit by hand.",
        "// 400 rows: level 1 col 0..7, then level 2, ... Each section = real US counties (see the script for the rules).",
        "import type { SectionData, SectionRow } from './index.ts';",
        "",
        "/** A SectionRow plus the number of county parts in the section (the `counties` list keeps only the 5 largest). */",
        "export type SectionRowWithCount = SectionRow & { countyCount: number };",
        "",
        "const rows: SectionRowWithCount[] = [",
        *[fmt(r) for r in rows],
        "];",
        "",
        "export const sections: (SectionData & { rows: SectionRowWithCount[] }) | null = {",
        "  rows,",
        "  source: {",
        "    label: 'Real US counties: CDC SVI, HHS emPOWER, Census',",
        f"    detail: {json.dumps(detail)},",
        "    url: 'https://www.atsdr.cdc.gov/place-health/php/svi/index.html',",
        "  },",
        "};",
        "",
    ]
    with open(out_path, "w") as f:
        f.write("\n".join(lines))

    # Report
    guess_total = sum(round(2000 + 4000 * (l - 1) / 49) for l in range(1, 51)) * COLS
    print(f"counties used {len(used)}, dropped {len(dropped)}: {[c['fips'] + ' ' + c['name'] for c in dropped]}")
    print(f"population {total:,}; dme total {sum(r['dme'] for r in rows):,}")
    g = [r["growthPerYear"] for r in rows]
    print(f"growthPerYear min {min(g):+.4f} max {max(g):+.4f}")
    print(f"guess total {guess_total:,}")
    print("level  counties  realPop  people/section(rescaled)  guess  svi  dme/section  growth")
    for level in range(1, LEVELS + 1):
        rs = rows[(level - 1) * COLS: level * COLS]
        share = sum(r["share"] for r in rs)
        print(f"{level:5d} {len(by_level[level]):9d} {round(share * total):9,d} {round(share * guess_total / COLS):8,d} "
              f"{round(2000 + 4000 * (level - 1) / 49):6,d} {sum(r['svi'] for r in rs) / COLS:.3f} "
              f"{round(sum(r['dme'] for r in rs) / COLS):6,d} {sum(r['growthPerYear'] for r in rs) / COLS:+.4f}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
