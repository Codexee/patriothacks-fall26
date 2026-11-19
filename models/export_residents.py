"""Write prototypes/hollow-twin-poc/public/results/checkfirst.json (contract: CheckFirstFile in
prototypes/hollow-twin-poc/src/site/contracts.ts) from the residents-only results.

Reads: out/dark_residents_results.json (TRAIN/DEV), out/dark_residents_final.json (FINAL TEST),
       out/dark_final.json (v2 with weather and grid inputs, FINAL TEST, for reference only)
Run: uv run python export_residents.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import common as C

DEST = C.REPO / "prototypes" / "hollow-twin-poc" / "public" / "results" / "checkfirst.json"

# Every kept input: (feature, plain name, Hollow equivalent).
INPUTS = [
    ("out_prev1h", "Homes reporting no power in the area, 1 hour before the event start",
     "Number of homes in the section that reported no power in the last hour"),
    ("out_max_prev6h", "Most homes reporting no power in the area, in the 6 hours before the event start",
     "Largest number of homes in the section that reported no power in the last 6 hours"),
    ("month", "Month of the event start", "Month on the Hollow calendar"),
    ("hod", "Hour of day of the event start", "Hour on the residents' clocks"),
    ("ba_past_events", "Number of earlier outage events in the region", "Number of earlier blackouts in the district"),
    ("ba_past_mean_hours", "Mean length of earlier outage events in the region", "Mean length of earlier blackouts in the district"),
    ("ba_hours_since_last", "Hours since the region's last outage event ended", "Hours since the district's last blackout ended"),
    ("past_events", "Number of earlier events with a known outcome for the area", "Number of earlier blackouts the section lived through"),
    ("past_dark_mean", "Mean dark hours of the area in earlier events (the history baseline)", "Mean hours the section stayed dark in earlier blackouts"),
    ("past_dark_max", "Most dark hours of the area in one earlier event", "Longest time the section stayed dark in one earlier blackout"),
    ("past_dark_share", "Share of earlier events in which the area had at least 1 dark hour", "Share of earlier blackouts in which the section went dark"),
    ("customers", "Estimated electricity customers in the area (EIA-861, 2012: each utility's count split evenly over the counties it serves)", "Number of homes in the section (count of rooms)"),
    ("pop", "Population of the area", "Head count of the section"),
    ("svi", "CDC Social Vulnerability Index, overall percentile (2010)", "Depth and vulnerability of the section's level"),
    ("svi_t1", "SVI theme 1: income, jobs and education", "Vulnerability of the level: income and work"),
    ("svi_t2", "SVI theme 2: age, disability and single parents", "Vulnerability of the level: elderly, disabled, single parents"),
    ("svi_t3", "SVI theme 3: minority status and language", "Vulnerability of the level: language and minority status"),
    ("svi_t4", "SVI theme 4: housing type and transport", "Vulnerability of the level: crowded housing and access"),
    ("utilities", "Number of electric utilities that serve the area", "Number of repair crews that serve the section"),
    ("ba_is_*", "Which region the area belongs to (one 0/1 column per training region, 36 regions)",
     "Which district the section belongs to"),
]
PLAIN = {f: p for f, p, _ in INPUTS}

EXCLUDED = [
    "Weather at the event start (temperature, dew point, pressure, wind, rain, 24 h extremes): residents of the Hollow have no weather.",
    "Weather forecasts: residents have no forecast.",
    "Grid-operator data from EIA-930 (demand against the day-ahead forecast and against the 30-day peak, share of power imported, share from gas, 6 h changes in generation): the Directorate does not give residents grid figures.",
    "HHS emPOWER (people on powered medical equipment): our copy is a 2026 snapshot, so it was not known before the 2015-2024 events. It is a fair Hollow input (residents can report it), but it cannot be tested on this history.",
]


def row(metric, model, history, chance, better="higher"):
    return {"metric": metric, "model": round(model, 4), "history": None if history is None else round(history, 4),
            "chance": None if chance is None else round(chance, 4), "better": better}


M_SP = "Within-event Spearman (rank agreement between predicted and actual dark hours, across the areas of one event; 0 = chance)"
M_TK = "Top-10 overlap (share of the 10 longest-dark areas that the model also ranks in its top 10)"
M_MAE = "Mean absolute error of dark hours per area (h)"


def main() -> None:
    r = json.loads((C.OUT / "dark_residents_results.json").read_text())
    f = json.loads((C.OUT / "dark_residents_final.json").read_text())
    v2 = json.loads((C.OUT / "dark_final.json").read_text())
    dv = r["dev"]
    imp, region = [], 0.0
    for i in r["importance"]:
        if i["feature"].startswith("ba_is_"):
            region += i["share"]
        else:
            imp.append({"feature": PLAIN[i["feature"]], "share": round(i["share"], 4)})
    imp.append({"feature": PLAIN["ba_is_*"], "share": round(region, 4)})
    imp = sorted(imp, key=lambda x: -x["share"])[:10]
    x = f["example"]
    cfg = r["config"]
    out = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "name": "Check-first model (residents-only)",
        "task": "In an outage event, rank the areas of the region by how many hours each will stay dark, so that crews and neighbors check the longest-dark areas first.",
        "method": (f"LightGBM regression on log1p(dark hours), {cfg['rounds']} trees, {cfg['num_leaves']} leaves, "
                   f"at least {cfg['min_child_samples']} rows per leaf; one row per area per event; inputs known at the event start"),
        "inputs": [{"name": f_, "plain": p, "hollowEquivalent": h} for f_, p, h in INPUTS],
        "excluded": EXCLUDED,
        "periods": {"train": "July 2015 to December 2020 (events that ended before 2021)",
                    "dev": "2021 to 2022 (used to choose the inputs)",
                    "test": "2023 to 2024 (scored once, after every choice was frozen)"},
        "test": {"events": f["events"], "areaEvents": f["countyEvents"], "rows": [
            row(M_SP, f["withinEventSpearman"]["mean"], f["historyWithinEventSpearman"]["mean"], 0.0),
            row(M_TK, f["top10Overlap"]["mean"], f["historyTop10Overlap"]["mean"], f["top10Chance"]["mean"]),
            row(M_MAE, f["maeHours"]["mean"], f["historyMaeHours"]["mean"], None, "lower")]},
        "dev": {"events": dv["events"], "areaEvents": dv["countyEvents"], "rows": [
            row(M_SP, dv["withinEventSpearman"], dv["baselineWithinEventSpearman"], 0.0),
            row(M_TK, dv["top10Overlap"], dv["baselineTop10Overlap"], dv["top10Chance"]),
            row(M_MAE, dv["maeHours"], dv["baselineMaeHours"], None, "lower")]},
        "comparison": {"label": "The v2 model with weather and grid-operator inputs (not usable in the Hollow), same FINAL TEST", "rows": [
            row(M_SP, v2["withinEventSpearman"], v2["baselineWithinEventSpearman"], 0.0),
            row(M_TK, v2["top10Overlap"], v2["baselineTop10Overlap"], v2["top10Chance"]),
            row(M_MAE, v2["maeHours"], v2["baselineMaeHours"], None, "lower")]},
        "importance": imp,
        "example": {"event": (f"Hurricane Beryl, Texas (ERCOT region, {x['areas']} counties, {x['darkAreas']} went dark). "
                              f"The model's top 10 held {round(x['top10Overlap'] * 10)} of the 10 longest-dark counties; the history baseline held {round(x['historyTop10Overlap'] * 10)}."),
                    "date": x["start"][:10],
                    "topAreas": [{"name": a["name"], "predictedHours": a["predictedHours"], "actualHours": a["actualHours"]}
                                 for a in x["topAreas"]]},
        "limits": [
            f"95% intervals on FINAL TEST (2,000 bootstrap resamples of events): within-event Spearman {f['withinEventSpearman']['lo']:.3f} to {f['withinEventSpearman']['hi']:.3f} "
            f"(history {f['historyWithinEventSpearman']['lo']:.3f} to {f['historyWithinEventSpearman']['hi']:.3f}); top-10 overlap {f['top10Overlap']['lo']:.3f} to {f['top10Overlap']['hi']:.3f} "
            f"(history {f['historyTop10Overlap']['lo']:.3f} to {f['historyTop10Overlap']['hi']:.3f}).",
            "The model ranks areas. Its hour values are much too low in large events (in Hurricane Beryl, Brazoria County: 4.1 h predicted, 165 h actual). Use the order, not the hours.",
            f"Predicting 0 hours everywhere has a lower mean error ({f['zeroMaeHours']['mean']:.2f} h) than the model ({f['maeHours']['mean']:.2f} h), because most areas have no dark hour. The error metric does not measure the ranking.",
            "The data is real US outages (EAGLE-I county outage reports, 2015-2024). The Hollow inputs are stand-ins: reported outages for residents' reports, CDC SVI for depth, counties for sections, balancing-authority regions for districts.",
            "Month and hour may carry storm-season information. The Hollow has no storms, so part of what the model learned from the calendar may not carry over.",
            "Events are defined from outage reports (at least a set share of the region's customers out). The model does not predict whether an event starts, only which areas stay dark longest once it has started.",
            "In Hurricane Beryl the model missed Harris County, the longest-dark county (176 h): the outage reports showed only 214 of about 1.8 million customers out 1 hour before the event start, so the model predicted 0 h. The model is only as good as the residents' reports.",
            "Removing weather and grid inputs did not lower the score: those inputs have one value per event, so they cannot rank areas inside one event by themselves.",
        ],
        "source": {"label": "EAGLE-I county outages (ORNL), CDC SVI, Census, EIA-861",
                   "detail": "Model and scores: models/train_dark_residents.py and models/final_test_residents.py; full write-up in models/RESULTS_RESIDENTS.md.",
                   "url": "https://doi.org/10.6084/m9.figshare.24237376"},
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {DEST} ({DEST.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
