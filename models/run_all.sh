#!/usr/bin/env bash
# Rerun every model step (v2). TRAIN < 2021, DEV 2021-2022, FINAL TEST 2023-2024 (constants in common.py).
# final_test.py is the only step that scores 2023-2024; it uses the frozen models and thresholds.
set -euo pipefail
cd "$(dirname "$0")"
uv run python dev_variants.py      # DEV design study (documents the choice of DESIGN in train_warn.py)
uv run python train_warn.py        # fit on TRAIN, thresholds on TRAIN, score DEV
uv run python train_dark.py        # fit on TRAIN, objective study on DEV, equity on all events
uv run python export.py            # app/public/models/*.json with parity rows
uv run python final_test.py        # FINAL TEST, once, frozen models
uv run python metrics.py           # app/public/models/metrics.json
uv run python make_results.py      # RESULTS.md
uv run python publish.py           # verify and copy the three shared files to BDA_SHARED
