"""Export the three models to app/public/models/<name>.json (ModelFile in contracts/README.md).

Each file holds LightGBM's dump_model()["tree_info"] unchanged and 200 parity rows. This script
also walks the dumped trees in plain Python, with the rules the TypeScript evaluator must follow,
and stops if any parity row differs from LightGBM by more than 1e-9.

Rules for one split node (LightGBM numerical decision):
  1. If x is missing (null/NaN) and missing_type is not "NaN", use x = 0.
  2. If (missing_type is "Zero" and x is 0) or (missing_type is "NaN" and x is missing):
     go left when default_left is true, else right.
  3. Otherwise go left when x <= threshold, else right.
Output: binary -> 1 / (1 + exp(-sum of leaf values)); regression -> sum of leaf values.

Run: uv run python export.py
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone

import lightgbm as lgb
import numpy as np
import pandas as pd

import common as C

N_PARITY = 200
MAX_BYTES = 3_000_000


def leaf(node: dict, x: list) -> float:
    while "leaf_value" not in node:
        v = x[node["split_feature"]]
        miss = v is None or (isinstance(v, float) and math.isnan(v))
        mt = node["missing_type"]
        assert node["decision_type"] == "<=", node["decision_type"]
        if miss and mt != "NaN":
            v, miss = 0.0, False
        if (mt == "Zero" and abs(v) <= 1e-35) or (mt == "NaN" and miss):
            left = node["default_left"]
        else:
            left = v <= node["threshold"]
        node = node["left_child"] if left else node["right_child"]
    return node["leaf_value"]


def walk(trees: list, x: list, objective: str) -> float:
    s = sum(leaf(t["tree_structure"], x) for t in trees)
    return 1.0 / (1.0 + math.exp(-s)) if objective == "binary" else s


def export(name: str, objective: str, feats: list[str], threshold: float | None, X: np.ndarray, version: str) -> dict:
    booster = lgb.Booster(model_file=str(C.ART / f"{name}.txt"))
    assert booster.feature_name() == feats, (booster.feature_name(), feats)
    trees = booster.dump_model()["tree_info"]
    p = booster.predict(X)
    parity = [{"x": [None if np.isnan(v) else float(v) for v in row], "p": float(pi)} for row, pi in zip(X, p)]
    worst = max(abs(walk(trees, r["x"], objective) - r["p"]) for r in parity)
    assert worst < 1e-9, f"{name}: tree walk differs from LightGBM by {worst}"
    doc = {"name": name, "version": version, "objective": objective, "features": feats,
           "threshold": threshold, "trees": trees, "parity": parity}
    path = C.APP_MODELS / f"{name}.json"
    path.write_text(json.dumps(doc, separators=(",", ":"), allow_nan=False))
    size = path.stat().st_size
    assert size < MAX_BYTES, f"{name}: {size} bytes"
    print(f"{name}: {len(trees)} trees, {size/1e6:.2f} MB, parity max difference {worst:.1e}, "
          f"rows with a missing value {sum(any(v is None for v in r['x']) for r in parity)}")
    return {"trees": len(trees), "bytes": size, "parityMaxDiff": worst}


def main() -> None:
    C.APP_MODELS.mkdir(parents=True, exist_ok=True)
    version = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    warn = json.loads((C.OUT / "warn_results.json").read_text())
    rng = np.random.default_rng(C.SEED)
    df = C.load_features()
    pool = np.flatnonzero(df.scored.values & (df.h.values >= C.SPLIT_H))
    if len(pool) < N_PARITY:
        pool = np.flatnonzero(df.scored.values)
    info = {}
    for name in ("warn_grid", "warn_full"):
        feats = C.VARIANTS[name]
        # Half random test rows, half rows with a missing value, so both paths are tested.
        miss = pool[np.isnan(df[feats].values[pool]).any(1)]
        rows = np.r_[rng.choice(pool, N_PARITY - min(N_PARITY // 2, len(miss)), replace=False),
                     rng.choice(miss, min(N_PARITY // 2, len(miss)), replace=False)]
        info[name] = export(name, "binary", feats, warn["models"][name]["threshold"],
                            df[feats].values[rows].astype(float), version)
    dark = json.loads((C.OUT / "dark_results.json").read_text())
    ce = pd.read_parquet(C.ART / "county_event.parquet")
    feats = dark["features"]
    pool = np.flatnonzero(ce.start_h.values >= C.SPLIT_H)
    if len(pool) < N_PARITY:
        pool = np.arange(len(ce))
    rows = rng.choice(pool, N_PARITY, replace=False)
    info["dark"] = export("dark", "regression", feats, None, ce[feats].values[rows].astype(float), version)
    (C.OUT / "export_info.json").write_text(json.dumps({"version": version, **info}, indent=1))


if __name__ == "__main__":
    main()
