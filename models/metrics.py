"""Write app/public/models/metrics.json (Metrics in app/src/contracts.ts, plus the optional v2 keys
"dev", "importance" and "split").

"models" and "dark" hold FINAL TEST (2023-2024) numbers. "dev" holds the same shape for DEV (2021-2022).
Run: uv run python metrics.py   (after final_test.py)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import common as C

ORDER = ["warn_grid", "warn_full", "warn_fcst", "rule_forecast_error", "rule_hand", "rule_record"]
KEYS = ("testEvents", "warned12h", "recall12h", "medianLeadHours", "falseAlarmsPerBaYear", "aucPr")


def dark_block(b):
    return None if not b else {"testCountyEvents": b["countyEvents"], "maeHours": b["maeHours"],
                               "baselineMaeHours": b["baselineMaeHours"], "spearman": b["spearman"]}


def main() -> None:
    w = json.loads((C.OUT / "warn_results.json").read_text())
    f = json.loads((C.OUT / "warn_final.json").read_text())
    d = json.loads((C.OUT / "dark_results.json").read_text())
    df_ = json.loads((C.OUT / "dark_final.json").read_text())
    eq = d["equity"]
    m = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
         "trainYears": [2015, 2020], "testYears": [2023, 2024],
         "models": {n: {k: f["models"][n]["test"][k] for k in KEYS} for n in ORDER},
         "dark": dark_block(df_),
         "equity": [{k: q[k] for k in ("quartile", "meanDarkHours", "lo", "hi")} for q in eq["quartiles"]],
         "dev": {"trainYears": [2015, 2020], "testYears": [2021, 2022],
                 "models": {n: {k: w["models"][n]["dev"][k] for k in KEYS} for n in ORDER},
                 "dark": dark_block(d["dev"])},
         "importance": {**{n: w["models"][n]["importance"] for n in ("warn_grid", "warn_full", "warn_fcst")},
                        "dark": d["importance"]},
         "split": {"train": ["2015-07-01", "2020-12-31"], "dev": ["2021-01-01", "2022-12-31"], "test": ["2023-01-01", "2024-12-31"]},
         "labels": {"warn_fcst": C.FCST_LABEL}}
    C.APP_MODELS.mkdir(parents=True, exist_ok=True)
    (C.APP_MODELS / "metrics.json").write_text(json.dumps(m, indent=1))
    print("metrics.json written")


if __name__ == "__main__":
    main()
