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


def export(name: str, objective: str, feats: list[str], threshold: float | None, X: np.ndarray, version: str,
           extra: dict | None = None) -> dict:
    booster = lgb.Booster(model_file=str(C.ART / f"{name}.txt"))
    assert booster.feature_name() == feats, (booster.feature_name(), feats)
    trees = booster.dump_model()["tree_info"]
    # "regression" files hold the raw sum of leaves. For the dark model that sum is log(hours) when
    # it was trained with a count objective; `output` in the file says how to turn it into hours.
    p = booster.predict(X, raw_score=(objective == "regression"))
    parity = [{"x": [None if np.isnan(v) else float(v) for v in row], "p": float(pi)} for row, pi in zip(X, p)]
    worst = max(abs(walk(trees, r["x"], objective) - r["p"]) for r in parity)
    assert worst < 1e-9, f"{name}: tree walk differs from LightGBM by {worst}"
    doc = {"name": name, "version": version, "objective": objective, "features": feats,
           "threshold": threshold, "trees": trees, "parity": parity, **(extra or {})}
    path = C.APP_MODELS / f"{name}.json"
    payload = json.dumps(doc, separators=(",", ":"), allow_nan=False).encode()
    size = len(payload)
    assert size < MAX_BYTES, f"{name}: {size} bytes"
    path.write_bytes(payload)
    print(f"{name}: {len(trees)} trees, {size/1e6:.2f} MB, parity max difference {worst:.1e}, "
          f"rows with a missing value {sum(any(v is None for v in r['x']) for r in parity)}")
    return {"trees": len(trees), "bytes": size, "parityMaxDiff": worst}


def main() -> None:
    C.APP_MODELS.mkdir(parents=True, exist_ok=True)
    version = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    warn = json.loads((C.OUT / "warn_results.json").read_text())
    rng = np.random.default_rng(C.SEED)
    df = C.load_features()
    pool = np.flatnonzero(df.scored.values & (df.h.values >= C.TRAIN_END_H) & (df.h.values < C.DEV_END_H))
    if len(pool) < N_PARITY:
        pool = np.flatnonzero(df.scored.values)
    info = {}
    for name in ("warn_grid", "warn_full", "warn_fcst"):
        feats = warn["models"][name]["features"]
        # Half random test rows, half rows with a missing value, so both paths are tested.
        miss = pool[np.isnan(df[feats].values[pool]).any(1)]
        missing_rows = rng.choice(miss, min(N_PARITY // 2, len(miss)), replace=False)
        other_rows = rng.choice(np.setdiff1d(pool, missing_rows), N_PARITY - len(missing_rows), replace=False)
        rows = np.r_[other_rows, missing_rows]
        extra = {"label": C.FCST_LABEL} if name == "warn_fcst" else None
        info[name] = export(name, "binary", feats, warn["models"][name]["threshold"],
                            df[feats].values[rows].astype(float), version, extra)
    dark = json.loads((C.OUT / "dark_results.json").read_text())
    ce = pd.read_parquet(C.ART / "county_event.parquet")
    feats = dark["features"]
    pool = np.flatnonzero((ce.start_h.values >= C.TRAIN_END_H) & (ce.start_h.values < C.DEV_END_H))
    if len(pool) < N_PARITY:
        pool = np.arange(len(ce))
    rows = rng.choice(pool, N_PARITY, replace=False)
    out = {"l2": "hours", "log1p": "log1p_hours", "poisson": "log_hours", "tweedie": "log_hours"}[dark["objective"]]
    info["dark"] = export("dark", "regression", feats, None,
                          ce.iloc[rows][feats].to_numpy(dtype=float, na_value=np.nan), version,
                          {"output": out, "trainedObjective": dark["objective"]})
    (C.OUT / "export_info.json").write_text(json.dumps({"version": version, **info}, indent=1))


if __name__ == "__main__":
    main()
