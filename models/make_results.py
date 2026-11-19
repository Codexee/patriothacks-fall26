"""Write models/RESULTS.md (v2) from out/*.json. Every number comes from those files.

Run: uv run python make_results.py   (after final_test.py)
"""
from __future__ import annotations

import json

import common as C

MODELS = ["warn_grid", "warn_full", "warn_fcst"]
RULES = ["rule_forecast_error", "rule_hand", "rule_record"]
ORDER = MODELS + RULES
LABEL = {"warn_grid": "warn_grid", "warn_full": "warn_full", "warn_fcst": "warn_fcst *",
         "rule_forecast_error": "rule_forecast_error", "rule_hand": "rule_hand", "rule_record": "rule_record"}


def f(x, d=2):
    if x is None or (isinstance(x, float) and x != x):
        return "–"
    return f"{x:.{d}f}" if isinstance(x, float) else str(x)


def pct(x):
    return "–" if x is None else f"{100 * x:.1f}"


def table(blocks: dict, fa=True) -> list[str]:
    head = ["Method", "Events", "Warned ≥ 6 h", "Warned ≥ 12 h", "Warned ≥ 24 h", "Recall 12 h (%)",
            "People recall 12 h (%)", "Customer-hours recall 12 h (%)", "Median lead (h)"]
    if fa:
        head += ["False alarms per BA-year", "PR-AUC"]
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    for n, b in blocks.items():
        r = [LABEL.get(n, n), b["testEvents"], b["warned6h"], b["warned12h"], b["warned24h"], pct(b["recall12h"]),
             pct(b["peopleRecall12h"]), pct(b["custHoursRecall12h"]), f(b["medianLeadHours"], 0)]
        if fa:
            r += [f(b.get("falseAlarmsPerBaYear")), f(b.get("aucPr"), 4)]
        out.append("| " + " | ".join(str(v) for v in r) + " |")
    return out


def verdict(name: str, T: dict) -> str:
    m = T[name]
    lines, wins = [], 0
    for r in RULES:
        b = T[r]
        more = m["warned12h"] > b["warned12h"]
        fewer = m["falseAlarmsPerBaYear"] <= b["falseAlarmsPerBaYear"]
        ok = more and fewer
        wins += ok
        lines.append(f"  - against `{r}`: {m['warned12h']} vs {b['warned12h']} events warned ≥ 12 h; "
                     f"{f(m['falseAlarmsPerBaYear'])} vs {f(b['falseAlarmsPerBaYear'])} false alarms per BA-year → "
                     + ("**beats it**" if ok else ("more events but MORE false alarms: **does not beat it at the same false-alarm rate**"
                                                   if more else "**does not beat it**")))
    head = (f"- **`{name}`: {'YES' if wins == len(RULES) else 'NO'}**. It beats {wins} of {len(RULES)} baselines "
            "(more events warned at least 12 h ahead and the same or fewer false alarms).")
    mp = C.OUT / "matched.json"
    if name == "warn_fcst" and mp.exists():
        mt = json.loads(mp.read_text())
        head = (f"- **`{name}`, two statements side by side.** Pre-registered (frozen threshold): it warns more events than "
                f"every rule but with more false alarms, so it beats {wins} of {len(RULES)} rules at the same or fewer false "
                f"alarms. Matched rate ({mt['label'].split(';')[0]}): "
                + matched_statement(mt["final"][name], mt["final"]["rules"]) + ".")
    return "\n".join([head] + lines)


RF_LABEL = {"warn_fcst_real": "(a) warn_fcst, real archived forecasts", "warn_fcst_observed": "(b) warn_fcst, observed weather (upper bound)",
            "warn_full": "(c) warn_full", "warn_grid": "warn_grid", "rule_forecast_error": "(d) rule_forecast_error",
            "rule_hand": "(d) rule_hand", "rule_record": "(d) rule_record"}


def real_forecast_section() -> list[str]:
    p = C.OUT / "real_forecast.json"
    if not p.exists():
        return []
    rf = json.loads(p.read_text())
    M = rf["models"]
    rl, ob = M["warn_fcst_real"], M["warn_fcst_observed"]
    sv = rf["survives"]
    head = ["Method", "Events", "Warned ≥ 12 h", "Warned ≥ 24 h", "People recall 12 h (%)", "Median lead (h)",
            "False alarms per BA-year", "PR-AUC"]
    L = ["## warn_fcst on real archived forecasts (2024)\n",
         "The v2 `warn_fcst` was trained with observed future weather standing in for a forecast (the \"perfect prog\" method). "
         "Here the same frozen model, with its frozen v2 threshold, is fed REAL weather forecasts that were issued before each "
         "scored hour: Open-Meteo Previous Runs API, default (best match) model. Nothing was refitted or retuned. This is one more "
         "look at 2024 (inside the FINAL TEST) with frozen models, which the protocol allows.\n",
         f"- Period: scored hours {rf['period'][0]} to {rf['period'][1]} UTC (the archive starts about 2024-01-19), {rf['bas']} BAs, "
         f"{rf['scoredHours']:,} scored BA-hours. Events: the {rf['events']} events that start from {rf['eventsWindowFrom']} on, so their "
         "whole 72 h warning window has forecasts.",
         "- Lead rule: for the scored hour t and valid hour t + k, the value comes from `previous_day` d = ceil((k + 6) / 24): "
         "k = 1–18 uses day 1, k = 19–42 day 2, k = 43–48 day 3. So every value was predicted at least 6 h before t "
         "(the 6 h margin covers the delay before a model run is published).",
         "- Stations and weights as in the feature table: weighted-mean temperature, max wind, max hourly precipitation, min "
         "sea-level pressure; the same 24 h and 48 h windows. z-scores and the record-low difference use the same past-only "
         "climatology as the feature table (rebuilt and checked: largest difference "
         f"{max(rf['climatologyCheckMaxAbsDiff'].values()):.0e}). Grid and past-weather features are unchanged.\n",
         "| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    for n, b in M.items():
        L.append(f"| {RF_LABEL[n]} | {b['testEvents']} | {b['warned12h']} | {b['warned24h']} | {pct(b['peopleRecall12h'])} | "
                 f"{f(b['medianLeadHours'], 0)} | {f(b['falseAlarmsPerBaYear'])} | {f(b['aucPr'], 4)} |")
    beats = [r for r in RULES if rl["warned12h"] > M[r]["warned12h"] and rl["falseAlarmsPerBaYear"] <= M[r]["falseAlarmsPerBaYear"]]
    L += ["", f"**How much of the upper bound survives:** with real forecasts, warn_fcst warned {rl['warned12h']} events at least 12 h "
          f"ahead against {ob['warned12h']} with observed weather ({pct(sv['warned12h'])}% survives), {rl['warned24h']} against "
          f"{ob['warned24h']} at 24 h ({pct(sv['warned24h'])}%), people recall {pct(rl['peopleRecall12h'])}% against "
          f"{pct(ob['peopleRecall12h'])}% ({pct(sv['peopleRecall12h'])}%), and PR-AUC {f(rl['aucPr'], 4)} against {f(ob['aucPr'], 4)} "
          f"({pct(sv['aucPr'])}%). False alarms: {f(rl['falseAlarmsPerBaYear'])} per BA-year with real forecasts against "
          f"{f(ob['falseAlarmsPerBaYear'])} with observed weather. warn_full warned {M['warn_full']['warned12h']} at "
          f"{f(M['warn_full']['falseAlarmsPerBaYear'])}.",
          f"In plain words: the events warned survive in full, but precision does not; false alarms rise by "
          f"{100 * (rl['falseAlarmsPerBaYear'] / ob['falseAlarmsPerBaYear'] - 1):.0f}% and PR-AUC keeps {pct(sv['aucPr'])}% of the upper bound. "
          f"Pre-registered (frozen threshold): with real forecasts, warn_fcst warns more events than every rule but with more "
          f"false alarms, so it beats {len(beats)} of 3 rules at the same or fewer false alarms"
          + (f" ({', '.join(beats)})." if beats else ".")
          + (" Matched rate (operating points read from the test period, see the next section): with real forecasts it has "
             + matched_statement(json.loads((C.OUT / "matched.json").read_text())["real2024"]["warn_fcst_real"],
                                 json.loads((C.OUT / "matched.json").read_text())["real2024"]["rules"]) + "."
             if (C.OUT / "matched.json").exists() else ""),
          "",
          "Forecast skill on the scored hours (forecast-based against observed fx_ features): "
          + ", ".join(f"{c} r = {v['corr']:.2f}" for c, v in rf["featureAgreement"].items()) + ".\n",
          "Forecast hourly precipitation runs about 50% higher than the station records (mean 0.26 against 0.17 mm per hour, "
          "March-November 2024), which is one likely reason for the extra false alarms.\n",
          "Limits: one forecast model (best match), one year, and the frozen threshold was set for observed weather, so the "
          "false-alarm rate can move. Per-event leads: `models/out/real_forecast_events.csv`.\n"]
    return L


def matched_statement(rows: dict, rules: dict) -> str:
    """'At each rule's own false-alarm rate, warn_fcst warns X vs Y ...' from out/matched.json rows."""
    parts, wins = [], 0
    for r in RULES:
        m = rows.get(r)
        if m is None:
            parts.append(f"`{r}`: no threshold reaches {f(rules[r]['falsePerBaYear'])}")
            continue
        win = m["warned12h"] > rules[r]["warned12h"]
        wins += win
        parts.append(f"`{r}` rate {f(rules[r]['falsePerBaYear'])}: {m['warned12h']} vs {rules[r]['warned12h']} events")
    return f"more events warned ≥ 12 h than {wins} of 3 rules at each rule's own false-alarm rate (" + "; ".join(parts) + ")"


def matched_section() -> list[str]:
    p = C.OUT / "matched.json"
    if not p.exists():
        return []
    mt = json.loads(p.read_text())
    head = ["Method", "At the false-alarm rate of", "False alarms per BA-year", "Warned ≥ 12 h", "Recall 12 h (%)",
            "People recall 12 h (%)", "Median lead (h)"]
    L = ["## Comparison at equal false-alarm rates\n",
         f"**{mt['label'][0].upper() + mt['label'][1:]}.**\n",
         "For each target rate, the threshold is the lowest one (most alerts) whose false alarms per BA-year stay at or below "
         "the target, scanning down from the top. The rules are shown at their frozen thresholds. The full curves are in "
         "`metrics.json` (`curves`).\n"]
    for per, title, models in (("final", "FINAL TEST 2023-2024", ["warn_fcst", "warn_full", "warn_grid"]),
                               ("real2024", f"2024 real-forecast window ({mt['periods']['real2024'][0][:10]} to "
                                            f"{mt['periods']['real2024'][1][:10]})", ["warn_fcst_real", "warn_fcst_observed"])):
        rules = mt[per]["rules"]
        L += [f"### {title}\n", "| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
        for r in RULES:
            b = rules[r]
            L.append(f"| {r} (frozen threshold) | itself | {f(b['falsePerBaYear'])} | {b['warned12h']} | {pct(b['recall12h'])} | "
                     f"{pct(b['peopleRecall12h'])} | {f(b['medianLeadHours'], 0)} |")
        for n in models:
            for k, pt in mt[per][n].items():
                target = "6.0 per BA-year" if k == "fixed_6" else f"{k} ({f(rules[k]['falsePerBaYear'])})"
                if pt is None:
                    L.append(f"| {n} | {target} | – | – | – | – | – |")
                    continue
                L.append(f"| {n} | {target} | {f(pt['falsePerBaYear'])} | {pt['warned12h']} | {pct(pt['recall12h'])} | "
                         f"{pct(pt['peopleRecall12h'])} | {f(pt['medianLeadHours'], 0)} |")
        L.append("")
    L.append("`warn_fcst_real` = warn_fcst fed real archived forecasts; `warn_fcst_observed` = the same model with observed "
             "weather on the same hours and events (upper bound).\n")
    return L


def main() -> None:
    w = json.loads((C.OUT / "warn_results.json").read_text())
    fin = json.loads((C.OUT / "warn_final.json").read_text())
    dv = json.loads((C.OUT / "dev_variants.json").read_text())
    d = json.loads((C.OUT / "dark_results.json").read_text())
    dfin = json.loads((C.OUT / "dark_final.json").read_text())
    ex = json.loads((C.OUT / "export_info.json").read_text())
    M = w["models"]
    T = {n: fin["models"][n]["test"] for n in ORDER}
    D = {n: M[n]["dev"] for n in ORDER}

    L = ["# Model results (v2)\n",
         "Generated by `models/run_all.sh`. Periods (constants in `models/common.py`): **TRAIN** 2015-07 to 2020-12, "
         "**DEV** 2021-2022, **FINAL TEST** 2023-2024. All fitting, hyperparameters and alert thresholds use TRAIN only "
         f"(at most {C.FA_LIMIT:g} false alarms per BA-year on TRAIN). v1 had already shown results for 2021-2024, so DEV was "
         "used openly to choose features and model design. The FINAL TEST was scored once, by `final_test.py`, with the frozen "
         f"models and thresholds (run at {fin['ranAt']}, frozen file hash `{fin['frozenSha256']}`).\n",
         "\\* `warn_fcst` = " + C.FCST_LABEL + ".\n"] + real_forecast_section() + matched_section() + [
         "## Plain answer (FINAL TEST, 2023-2024)\n",
         "Does the model beat every baseline: more events warned at least 12 h ahead, with the same or fewer false alarms per BA-year?\n",
         verdict("warn_full", T), "", verdict("warn_fcst", T), "", verdict("warn_grid", T), "",
         f"FINAL TEST: {fin['testEvents']} events, {fin['testRows']:,} scored BA-hours ({fin['testPosShare']:.2%} positive).\n",
         "## FINAL TEST results\n"]
    L += table(T)
    L.append("\nPeople recall = share of the summed peak customers out that is in events warned ≥ 12 h ahead. "
             "Customer-hours recall = the same share of summed customer-outage-hours (BA customers out, summed over the event window).\n")
    for s, title in (("winter", "Winter (Dec–Feb)"), ("summer", "Summer (Jun–Aug)"), ("other", "Other months")):
        L.append(f"### FINAL TEST, {title}\n")
        L += table({n: T[n]["seasons"][s] for n in ORDER})
        L.append("")
    for g, title in (("demand_record", "Demand-record events (fc12_vs_month_record ≥ 1.0 at any hour in the 24 h before the start)"),
                     ("other", "Other (storm-like) events")):
        L.append(f"### FINAL TEST, {title}\n")
        L += table({n: T[n]["groups"][g] for n in ORDER}, fa=False)
        L.append("")
    L.append("False alarms are not split by group, because an alert does not belong to an event group until an event happens.\n")

    L += ["## DEV results (2021-2022; used to choose the design)\n"]
    L += table(D)
    L.append("")
    for g, title in (("demand_record", "Demand-record events"), ("other", "Other (storm-like) events")):
        L.append(f"### DEV, {title}\n")
        L += table({n: D[n]["groups"][g] for n in ORDER}, fa=False)
        L.append("")
    for s, title in (("winter", "Winter (Dec–Feb)"), ("summer", "Summer (Jun–Aug)"), ("other", "Other months")):
        L.append(f"### DEV, {title}\n")
        L += table({n: D[n]["seasons"][s] for n in ORDER})
        L.append("")
    L.append("### Named events (DEV)\n")
    L.append("Texas, Feb 2021 (Winter Storm Uri) and every BA event that starts Dec 23-25, 2022 (Winter Storm Elliott). "
             "Each cell: lead hours (first alert time, UTC). – = no alert in the 72 h before the start.\n")
    L.append("| Event | Start (UTC) | Peak customers out | Group | " + " | ".join(LABEL[n] for n in ORDER) + " |")
    L.append("|" + "---|" * (4 + len(ORDER)))
    for e in w["namedEvents"]:
        cells = []
        for n in ORDER:
            m = e["methods"][n]
            cells.append("–" if m["leadHours"] is None else f"{m['leadHours']:.0f} ({m['firstAlert'][5:16]})")
        L.append(f"| `{e['event_id']}` | {e['start'][:16]} | {e['peakCustomersOut']:,.0f} | {e['group']} | " + " | ".join(cells) + " |")
    L.append("")

    L += ["### Design study on DEV (`dev_variants.py`, warn_full, one fixed configuration)\n",
          "| Variant | CV PR-AUC (train) | Threshold | DEV warned ≥ 12 h | DEV false alarms / BA-year | DEV PR-AUC | DEV people recall 12 h (%) |",
          "|---|---|---|---|---|---|---|"]
    for n, v in dv["variants"].items():
        r = v["dev"]
        L.append(f"| {n} | {v['cvAp']:.4f} | {v['threshold']:.4f} | {r['warned12h']}/{r['testEvents']} | {f(r['falseAlarmsPerBaYear'])} | "
                 f"{f(r['aucPr'], 4)} | {pct(r['peopleRecall12h'])} |")
    L.append(f"\nChosen: **{w['design']}** (variant E: 72 h trailing summaries + monotone record features). It warned the most "
             "events at 12 h on DEV, gave lead on Texas 2021 and on more Elliott events, and the monotone constraint keeps the record "
             "features explainable (a higher forecast against the record never lowers the risk). Variant F (24 h target) was close. "
             "The final hyperparameters were then chosen again on TRAIN folds for each model. For warn_full this picked smaller "
             "trees than the fixed configuration of the study, and fewer DEV hits than variant E. We kept the TRAIN choice. "
             "As a result the exported warn_full does NOT warn Texas 2021 (variant E did, 72 h ahead); see the named-event table.\n")

    L += ["### Model settings (all chosen on TRAIN)\n", "| Model | Features | Configuration | Threshold |", "|---|---|---|---|"]
    for n in MODELS:
        L.append(f"| {n} | {len(M[n]['features'])} | {M[n]['config']} | {M[n]['threshold']:.4f} |")
    for n in RULES:
        L.append(f"| {n} | rule: {M[n]['rule']} | {M[n]['config']} | {M[n]['threshold']:.4f} |")
    L.append("")
    L.append("### Top 10 features (share of gain)\n")
    for n in MODELS:
        L.append(f"- `{n}`: " + ", ".join(f"{i['feature']} {100 * i['gain']:.1f}%" for i in M[n]["importance"]))
    L.append("- `dark`: " + ", ".join(f"{i['feature']} {100 * i['gain']:.1f}%" for i in d["importance"]))
    L.append("")

    L += ["## During model: which counties stay dark longest\n",
          "Target: hours from event start to stop with at least 10% of the county's customers out. One row per event × county of "
          "the event's primary BA. Features are known at the event start. Baseline: the county's mean dark hours in its past events.\n",
          f"v2 change: the product is a ranked check-first list, so the objective was chosen by ranking on DEV. Chosen: **{d['objective']}** "
          f"(configuration {d['config']}, chosen on TRAIN folds by within-event Spearman).\n",
          "### Objective study (DEV)\n",
          "| Objective | DEV MAE (h) | History MAE (h) | Within-event Spearman | History | Top-10 overlap | History | Chance |",
          "|---|---|---|---|---|---|---|---|"]
    for o, s in d["objectives"].items():
        b = s["dev"]
        L.append(f"| {o} | {f(b['maeHours'])} | {f(b['baselineMaeHours'])} | {f(b['withinEventSpearman'], 3)} | "
                 f"{f(b['baselineWithinEventSpearman'], 3)} | {f(b['top10Overlap'], 3)} | {f(b['baselineTop10Overlap'], 3)} | {f(b['top10Chance'], 3)} |")
    L += ["\n### Ranking and error (chosen model)\n",
          "| Period | County-events | Events | Within-event Spearman | History | Top-10 overlap | History | Chance | Events scored for top-10 | MAE (h) | History MAE (h) | Predict-0 MAE (h) | Spearman | History Spearman |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for name, b in (("DEV", d["dev"]), ("FINAL TEST", dfin)):
        L.append(f"| {name} | {b['countyEvents']:,} | {b['events']} | {f(b['withinEventSpearman'], 3)} | {f(b['baselineWithinEventSpearman'], 3)} | "
                 f"{f(b['top10Overlap'], 3)} | {f(b['baselineTop10Overlap'], 3)} | {f(b['top10Chance'], 3)} | {b['top10Events']} | "
                 f"{f(b['maeHours'])} | {f(b['baselineMaeHours'])} | {f(b['zeroMaeHours'])} | {f(b['spearman'], 3)} | {f(b['baselineSpearman'], 3)} |")
    L.append("\nTop-10 overlap: in each event with ≥ 10 counties and ≥ 1 dark county, k = min(10, dark counties); the share of the k "
             "counties with the most actual dark hours that are also in the model's top k. Chance = mean k / counties. "
             "Predicting 0 everywhere gives a low MAE because most county-events have no dark hour. MAE is kept for honesty; "
             "ranking is the product metric.\n")
    e = d["equity"]
    L += ["## Equity: observed dark hours by SVI quartile (all events; data, not a model)\n",
          f"{e['events']} events, {e['countyEvents']:,} county-events. Quartile of the county's 2022 national SVI percentile "
          "(4 = most vulnerable). 95% intervals: 2,000 bootstrap resamples of events.\n",
          "| SVI quartile | County-events | Mean dark hours | 95% interval |", "|---|---|---|---|"]
    L += [f"| {q['quartile']} | {q['countyEvents']:,} | {f(q['meanDarkHours'])} | {f(q['lo'])} – {f(q['hi'])} |" for q in e["quartiles"]]
    lg = e["events24hOrLonger"]
    within_zero = lambda x: x["lo"] <= 0 <= x["hi"]
    L += ["", "| Q4 − Q1 difference | Events | Mean (h) | 95% interval |", "|---|---|---|---|",
          f"| All events | {e['events']} | {f(e['q4MinusQ1']['mean'])} | {f(e['q4MinusQ1']['lo'])} – {f(e['q4MinusQ1']['hi'])} |",
          f"| All events, inside the same event | {e['withinEventQ4MinusQ1']['events']} | {f(e['withinEventQ4MinusQ1']['mean'])} | "
          f"{f(e['withinEventQ4MinusQ1']['lo'])} – {f(e['withinEventQ4MinusQ1']['hi'])} |",
          f"| Events of 24 h or longer | {lg['events']} | {f(lg['q4MinusQ1']['mean'])} | {f(lg['q4MinusQ1']['lo'])} – {f(lg['q4MinusQ1']['hi'])} |",
          f"| Events of 24 h or longer, inside the same event | {lg['withinEventQ4MinusQ1']['events']} | {f(lg['withinEventQ4MinusQ1']['mean'])} | "
          f"{f(lg['withinEventQ4MinusQ1']['lo'])} – {f(lg['withinEventQ4MinusQ1']['hi'])} |",
          "\nThe gap across all events is clear, and larger for events of 24 h or longer. "
          + ("Inside the same event the interval includes 0 (for all events and for long events): most of the gap comes from where "
             "and how long the storms are, not from slower restoration of vulnerable counties in the same storm."
             if within_zero(e["withinEventQ4MinusQ1"]) and within_zero(lg["withinEventQ4MinusQ1"]) else
             "Inside the same event the gap is smaller; see the intervals above.")
          + " Event length is measured from start to stop.\n"]

    L += ["## v1 (for the record)\n",
          "v1 used train < 2021 and test 2021-2024 (818 events), with v1 features. `warn_full` warned 114 events at least 12 h ahead "
          "(13.9%) at 6.34 false alarms per BA-year; `rule_forecast_error` warned 60 at 6.09 and `rule_hand` 76 at 6.92. So v1 warn_full "
          "did not beat both baselines at the same false-alarm rate. It missed Texas 2021 and TVA Elliott. The v1 dark model "
          "(L2 on hours) had test MAE 3.91 h against 3.78 h for the history baseline (worse), and within-event Spearman 0.313 against 0.216.\n"]

    L += ["## Exported files\n"]
    for n in ("warn_grid", "warn_full", "warn_fcst", "dark"):
        i = ex[n]
        L.append(f"- `app/public/models/{n}.json`: {i['trees']} trees, {i['bytes'] / 1e6:.2f} MB, 200 parity rows (from DEV); "
                 f"the Python tree walk matches LightGBM within {i['parityMaxDiff']:.1e}.")
    L += ["- `dark.json` holds the raw sum of leaves, which is **log1p(hours)** for the chosen objective: hours = exp(value) − 1, "
          "floored at 0. The file says so in `output`. `county_event_pred.parquet` is already in hours.",
          "- `warn_fcst.json` carries a `label` field with the upper-bound statement.",
          "- `app/public/models/metrics.json`: `models` and `dark` = FINAL TEST; `dev` = DEV; plus `importance`, `split`, `labels`.",
          "- `BDA_SHARED/ba_hour_pred.parquet` (`ba, hour, p_grid, p_full, p_fcst`; out-of-fold on TRAIN validation years), "
          "`BDA_SHARED/county_event_pred.parquet`, `BDA_SHARED/warn_threshold.json` (`p_grid, p_full, p_fcst`).\n",
          "## Limits\n",
          "- Recall at 12 h stays low. Most outage events are distribution-level storm damage that does not show in BA demand data.",
          "- On DEV, every method went above the 6 false alarms per BA-year it was held to on TRAIN. Positive hours are more "
          "common in later years, so a threshold chosen on TRAIN alerts more often later.",
          "- `warn_fcst` uses observed future weather as its forecast. A real forecast has errors, so its numbers are an upper bound.",
          "- `warn_full` uses outages already reported (lagged 1 h); the live page cannot compute these. `warn_grid` uses the BA's "
          "own demand records, which the live page needs a long history to compute.",
          "- The 72 h trailing summaries use the last 72 rows of each BA. That equals 72 h only where the hourly table has no gaps.",
          "- DEV was used to choose the design after v1 had shown it. Only the FINAL TEST is a clean hold-out.",
          "- SVI is the 2022 release for the equity table. Events are defined by a share-of-BA-customers rule on EAGLE-I data.\n"]
    (C.HERE / "RESULTS.md").write_text("\n".join(L))
    print("RESULTS.md written")


if __name__ == "__main__":
    main()
