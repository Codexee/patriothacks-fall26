#!/usr/bin/env bash
# Rerun every model step. Usage: models/run_all.sh   (BDA_SPLIT=2019-01-01 for a temporary split)
set -euo pipefail
cd "$(dirname "$0")"
uv run python train_warn.py
uv run python train_dark.py
uv run python export.py
uv run python metrics.py
uv run python make_results.py
uv run python publish.py
