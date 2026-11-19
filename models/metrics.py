"""Write app/public/models/metrics.json (Metrics in app/src/contracts.ts) from out/*.json.

Run: uv run python metrics.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import common as C


def main() -> None:
    w = json.loads((C.OUT / "warn_results.json").read_text())
    d = json.loads((C.OUT / "dark_results.json").read_text())
    split_year = C.from_h(C.SPLIT_H).year
    end_year = int(w["dataEnd"][:4])
    models = {}
    for name in ("warn_grid", "warn_full", "rule_forecast_error", "rule_hand"):
        t = w["models"][name]["test"]
        models[name] = {k: t[k] for k in ("testEvents", "warned12h", "recall12h", "medianLeadHours",
                                         "falseAlarmsPerBaYear", "aucPr")}
    t = d["test"]
    m = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
         "trainYears": [2015, split_year - 1], "testYears": [split_year, end_year], "models": models,
         "dark": None if not t else {"testCountyEvents": t["countyEvents"], "maeHours": t["maeHours"],
                                     "baselineMaeHours": t["baselineMaeHours"], "spearman": t["spearman"]},
         "equity": [{k: q[k] for k in ("quartile", "meanDarkHours", "lo", "hi")} for q in d["equity"]["quartiles"]]}
    C.APP_MODELS.mkdir(parents=True, exist_ok=True)
    (C.APP_MODELS / "metrics.json").write_text(json.dumps(m, indent=1))
    print("metrics.json written")


if __name__ == "__main__":
    main()
