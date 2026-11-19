"""DEV design study for warn_full (8 documented variants). Fits on TRAIN, threshold on TRAIN,
scores DEV (2021-2022) only. The chosen design goes into DESIGN in train_warn.py by hand.

Writes: out/dev_variants.json
Run: uv run python dev_variants.py
"""
from __future__ import annotations

import json
import time

import common as C
import warn_lib as W

CFG = [dict(num_leaves=15, min_child_samples=500, scale_pos_weight=1.0)]
V1_FULL = C.GRID + C.WX
NO_OUTS = [f for f in C.VARIANTS["warn_full"] if f not in C.OUTS]
DESIGNS = {
    "A_v1_features": {"feats": V1_FULL},
    "B_v2_features": {},
    "C_v2_trail72h": {"trail": True},
    "D_v2_monotone": {"monotone": True},
    "E_v2_trail_monotone": {"trail": True, "monotone": True},
    "F_v2_target24h": {"target": "y24"},
    "G_v2_size_weights": {"weights": "size"},
    "H_v2_without_reported_outages": {"feats": NO_OUTS},
}
KEYS = ("testEvents", "warned6h", "warned12h", "warned24h", "recall12h", "peopleRecall12h", "custHoursRecall12h",
        "medianLeadHours", "falseAlarmsPerBaYear", "aucPr")


def main() -> None:
    t0 = time.time()
    d = W.Data()
    res = {"note": "DEV = 2021-2022. Fitting and thresholds on TRAIN only. Model: warn_full, one fixed configuration.",
           "config": CFG[0], "variants": {}}
    for name, design in DESIGNS.items():
        model, feats, best, _, oof, p = W.fit(d, "warn_full", design, CFG)
        thr = d.threshold(oof, p[d.p_train.rows])
        dev = d.evaluate(d.p_dev, p[d.p_dev.rows], thr)
        oofb = d.evaluate(d.p_oof, oof, thr, d.train_starts)
        leads = dev.pop("event_leads"); oofb.pop("event_leads")
        res["variants"][name] = {"design": {k: v for k, v in design.items() if k != "feats"},
                                 "features": feats, "rounds": best["rounds"], "cvAp": best["ap"], "threshold": thr,
                                 "dev": {k: dev[k] for k in KEYS}, "devGroups": dev["groups"],
                                 "trainOof": {k: oofb[k] for k in KEYS},
                                 "named": {e: leads.get(e) for e in d.named}}
        r = res["variants"][name]["dev"]
        print(f"{name}: cvAP {best['ap']:.4f} rounds {best['rounds']} thr {thr:.4f} | DEV w12 {r['warned12h']}/{r['testEvents']} "
              f"fa {r['falseAlarmsPerBaYear']:.2f} ap {r['aucPr']:.4f} people {r['peopleRecall12h']:.3f} | named "
              f"{[leads.get(e) for e in d.named]}  [{time.time()-t0:.0f}s]", flush=True)
    rules = W.rules(d)
    res["rules"] = {}
    for n, (s, desc, cfg, thr) in rules.items():
        dev = d.evaluate(d.p_dev, s[d.p_dev.rows], thr)
        leads = dev.pop("event_leads")
        res["rules"][n] = {"threshold": thr, "dev": {k: dev[k] for k in KEYS}, "named": {e: leads.get(e) for e in d.named}}
        r = res["rules"][n]["dev"]
        print(f"{n}: DEV w12 {r['warned12h']} fa {r['falseAlarmsPerBaYear']:.2f} people {r['peopleRecall12h']:.3f} named "
              f"{[leads.get(e) for e in d.named]}", flush=True)
    (C.OUT / "dev_variants.json").write_text(json.dumps(res, indent=1))
    print(f"done in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
