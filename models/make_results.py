"""Generate the evaluation report from the same results used by the browser."""
import json

import pandas as pd

import common as C

ORDER = ["warn_grid", "warn_full", "rule_forecast_error", "rule_hand", "warn_full_fx"]


def number(value, digits=2):
    return "—" if pd.isna(value) else f"{value:.{digits}f}"


def table(headers, rows):
    def line(items):
        return "| " + " | ".join(map(str, items)) + " |"
    return "\n".join([line(headers), line(["---"] * len(headers)), *[line(row) for row in rows]])


def score_table(models, period, season=None):
    rows = []
    for name in ORDER:
        result = models[name][period]
        if season:
            result = result["seasons"][season]
        rows.append([name, result["testEvents"], result["warnedAny"], result["warned12h"],
                     number(100 * result["recall12h"], 1), number(result["medianLeadHours"], 1),
                     result["falseEpisodes"], number(result["falseAlarmsPerBaYear"]), number(result["aucPr"], 4)])
    return table(["Method", "Events", "Any lead", "≥12 h", "Recall ≥12 h (%)", "Median lead (h)",
                  "False episodes", "False / BA-year", "PR-AUC"], rows)


def main():
    warn = json.loads((C.OUT / "warn_results.json").read_text())
    dark = json.loads((C.OUT / "dark_results.json").read_text())
    exports = json.loads((C.OUT / "export_info.json").read_text())
    events = pd.read_csv(C.OUT / "warn_events.csv", parse_dates=["start"])
    models = warn["models"]
    full = models["warn_full"]["test"]
    rule_names = ["rule_forecast_error", "rule_hand"]
    wins = []
    details = []
    for name in rule_names:
        rule = models[name]["test"]
        wins.append(full["warned12h"] > rule["warned12h"] and
                    full["falseAlarmsPerBaYear"] <= rule["falseAlarmsPerBaYear"])
        details.append(f"`{name}` warned {rule['warned12h']} with {rule['falseAlarmsPerBaYear']:.2f} false alarms per BA-year.")
    gate = "passed" if all(wins) else "failed"
    parts = [
        "# Outage model results",
        f"**The warning model {gate} the two-baseline test.** On {len(events):,} held-out events, "
        f"`warn_full` warned {full['warned12h']} at least 12 hours ahead ({full['recall12h']:.1%}). "
        f"It produced {full['falseAlarmsPerBaYear']:.2f} false alarms per balancing area (BA) per year. "
        + " ".join(details),
        "The project requires more events warned at least 12 hours ahead at the same or fewer false alarms than each baseline. "
        "All methods used thresholds chosen before the test period.",
        "## Warning performance",
        f"Training used {warn['trainRows']:,} BA-hours before {C.SPLIT} UTC ({warn['trainPosShare']:.2%} positive). "
        f"The event library contains {warn['trainEvents']:,} earlier events. The test period runs from {C.SPLIT} "
        f"through {warn['dataEnd']} UTC and contains {warn['testRows']:,} eligible hours ({warn['testPosShare']:.2%} positive). "
        f"Of {len(events):,} test events, {warn['testEventsScorable12h']} had an eligible observation 12–72 hours before onset.",
        score_table(models, "test"),
        "Median lead uses the earliest alert among events with any warning. PR-AUC is hourly average precision. "
        "It ranks warnings across all thresholds. A missing baseline score ranks below every available score.",
    ]
    for season, title in (("winter", "Winter (December–February)"), ("summer", "Summer (June–August)"),
                          ("other", "March–May and September–November")):
        parts.extend([f"### {title}", score_table(models, "test", season)])
    parts += [
        "### Texas and Winter Storm Elliott",
        "Each cell gives hours from the earliest eligible warning to the event start. A dash means the method missed the event. "
        "The Elliott rows include every BA event starting December 23–25, 2022 UTC. The dates alone do not establish storm attribution.",
    ]
    names = []
    primary_replays = []
    for e in events.sort_values(["start", "ba"]).itertuples():
        if e.ba == "ERCO" and e.start.strftime("%Y-%m") == "2021-02":
            storm = "Texas freeze (Uri)"
        elif pd.Timestamp("2022-12-23") <= e.start < pd.Timestamp("2022-12-26"):
            storm = "Winter Storm Elliott period"
        else:
            continue
        if storm.startswith("Texas") or (e.ba == "TVA" and storm.startswith("Winter")):
            outcome = ("issued no warning" if pd.isna(e.lead_warn_full)
                       else f"warned {e.lead_warn_full:g} hours before onset")
            primary_replays.append(f"For {e.ba} on {e.start:%B %d, %Y}, `warn_full` {outcome}.")
        names.append([storm, e.event_id, e.start.strftime("%Y-%m-%d %H:%M"),
                      *[number(getattr(e, f"lead_{n}"), 0) for n in ORDER]])
    if primary_replays:
        parts.append(" ".join(primary_replays))
    parts += [table(["Event", "BA event ID", "Start (UTC)", *ORDER], names),
              "The full event ledger includes every held-out event, including misses. [Per-event results](out/warn_events.csv)",
              "### Training and alert rules",
              "A positive hour precedes an event start by up to 48 hours. An event begins when at least 1% of BA customers "
              "have lost power for four consecutive hours. The library merges qualifying runs separated by up to 12 hours. "
              "Scoring excludes the event, the next 48 hours and hours without a complete label horizon. "
              "Coverage uses each BA’s first and last reported outage in each year and joins adjacent windows. "
              "The training features start in July 2015. The label check against the event library found "
              f"{warn['labelRowsDifferFromTable']} disagreements.",
              f"LightGBM used expanding annual validation folds in {', '.join(map(str, warn['valYears']))}. "
              "Each fit dropped the last 48 training hours before the next period. Mean validation average precision selected "
              "among 100, 200 and 300 trees and positive-class weights of 1 and 10. The candidates paired 7 leaves with a "
              "minimum of 2,000 rows per leaf, or 15 leaves with a minimum of 500 or 5,000. The learning rate was 0.05. "
              "The warning models omit BA identity. The grid inputs are demand error, recent peaks, interchange, "
              "fuel and generation changes, hour and month. The full model adds station weather and trailing summaries.",
              "Starting at high training-score quantiles, threshold selection lowered the threshold until either the validation "
              "predictions or the final fit on training hours exceeded six false episodes per BA-year. It retained the last passing "
              "threshold. An alert episode joins alerts less than 24 hours apart. It counts as false if none of its alerts has an "
              "event start in the next 48 hours. An event counts as warned when any alert falls in the preceding 72 hours. "
              "These windows differ by design. One BA-year equals 8,766 eligible hours. Seasonal rates use eligible hours in that "
              "season, the month of event onset and the month of the episode’s first alert.",
              "The forecast-error rule uses (demand − forecast) / forecast. The hand rule adds maximum 24-hour forecast error "
              "(clipped to ±1 and divided by 0.1), demand divided by its trailing 30-day peak, and absolute temperature anomaly "
              "divided by 10. Missing hand-rule components contribute zero. Training event recall selected the two weights.",
              table(["Method", "Selected settings", "Threshold", "Validation false / BA-year", "Fitted training false / BA-year"],
                    [[n, ", ".join(f"{k}={v}" for k, v in models[n]["config"].items()) or "threshold only",
                      f"{models[n]['threshold']:.8g}", number(models[n]["train_oof"]["falseAlarmsPerBaYear"]),
                      number(models[n]["trainFalseRate"])] for n in ORDER]),
              "#### Predictions from training-year validation folds", score_table(models, "train_oof")]
    fx = models["warn_full_fx"]["test"]
    parts += ["### Future weather experiment",
              f"The report-only variant uses the next 24 hours of observed weather as a stand-in for a forecast. It warned "
              f"{fx['warned12h']} events at 12 hours, a change of {fx['warned12h'] - full['warned12h']:+d}. PR-AUC changed by "
              f"{fx['aucPr'] - full['aucPr']:+.4f} and false alarms by "
              f"{fx['falseAlarmsPerBaYear'] - full['falseAlarmsPerBaYear']:+.3f} per BA-year. "
              "Only past and current observations enter the exported warning models.",
              "## County dark hours",
              f"The county model predicts the number of event hours with at least 10% of county customers reported out. "
              f"The pipeline generated {dark['countyEventRows']:,} county-event rows. "
              f"The outage files support targets for {dark['observedRows']:,} rows across {dark['observedEvents']:,} "
              f"of {dark['allEvents']:,} library events.",
              "Each county belongs to its primary BA in the shared crosswalk. The eight historic Connecticut counties belong to ISO New England. "
              "Some BAs have no primary counties. EAGLE-I’s modeled customer counts define the 10% threshold. The target includes both "
              "ends of the event and counts distinct hours. A county needs a denominator and an outage record in each endpoint year to "
              "contribute to evaluation. A missing county-hour within that coverage counts as zero reported outages.",
              "At onset, the model uses the last completed grid and weather hour, the preceding six hours of reported county outages, "
              "the start month and hour, BA identity, and BA and county histories from completed events. An EIA hour is timestamped "
              "at its beginning, so the row ending at onset carries the previous hour’s timestamp. Earlier held-out outcomes can enter "
              "the history for a later event after the earlier event ends. History requires a county outage report by the earlier event’s end.",
              "County population, the Social Vulnerability Index (SVI) and its four theme ranks use the 2010 CDC county file. "
              "The model treats SVI ranks as missing before April 2015, following the date of the CDC documentation. "
              "Utility count uses distinct utilities reporting service in 2012. The county customer estimate divides each utility’s state "
              "total evenly across its reported counties. These historical estimates keep later county characteristics out of the model. "
              "A missing match remains missing. The committed county reference makes training repeatable offline. "
              "[CDC county data](https://svi.cdc.gov/Documents/Data/2010/csv/states_counties/SVI_2010_US_county.csv) · "
              "[CDC methodology](https://svi.cdc.gov/map25/data/docs/SVI-2010-Documentation-H.pdf) · "
              "[EIA 2012 archive](https://www.eia.gov/electricity/data/eia861/archive/zip/f8612012.zip)",
              "Expanding training-year folds selected regression settings by mean absolute error (MAE). Candidates used 7 or 15 leaves, "
              "minimum leaf sizes of 50 or 200, and 100, 200 or 300 trees. The learning rate was 0.05. "
              f"The selected settings were {', '.join(f'{k}={v}' for k,v in dark['config'].items())}. "
              "The history baseline uses the county’s mean observed dark hours in earlier events, with zero for a first event. "
              "The evaluator and replay files floor negative estimates at zero. The exported regression trees return the raw sum of leaves.",
              table(["Period", "County-events", "Events", "Model MAE (h)", "History MAE (h)", "Zero MAE (h)",
                     "Model Spearman", "History Spearman", "Model within-event Spearman", "History within-event Spearman"],
                    [[title, b["countyEvents"], b["events"], number(b["maeHours"]), number(b["baselineMaeHours"]),
                      number(b["zeroMaeHours"]), number(b["spearman"], 3), number(b["baselineSpearman"], 3),
                      number(b["withinEventSpearman"], 3), number(b["baselineWithinEventSpearman"], 3)]
                     for title, b in (("Test", dark["test"]), ("Training validation", dark["train_oof"]))]),
              "Spearman correlation measures rank agreement. The within-event column averages correlations across BA events "
              "with at least five counties and variation in both rankings."]
    t = dark["test"]
    parts.append(f"On the test years the model’s MAE was {abs(t['maeHours'] - t['baselineMaeHours']):.2f} hours "
                 f"{'higher' if t['maeHours'] > t['baselineMaeHours'] else 'lower'} than the history baseline.")
    equity = dark["equity"]
    delta, paired = equity["q4MinusQ1"], equity["withinEventQ4MinusQ1"]
    parts += ["## Observed dark hours by vulnerability",
              f"The equity comparison covers all years. It groups {equity['countyEvents']:,} observed county-events across "
              f"{equity['events']:,} BA events with a 2022 SVI rank. Quartile 4 contains counties above the 75th national "
              "percentile. Each county-event has equal weight. The 95% intervals use 2,000 bootstrap samples of whole BA events.",
              table(["National SVI quartile", "County-events", "Mean dark hours", "95% interval (h)"],
                    [[q["quartile"], q["countyEvents"], number(q["meanDarkHours"]), f"{q['lo']:.2f}–{q['hi']:.2f}"]
                     for q in equity["quartiles"]]),
              f"The most vulnerable quartile averaged {delta['mean']:+.2f} hours relative to the least vulnerable quartile "
              f"(95% interval {delta['lo']:.2f} to {delta['hi']:.2f}). Within the {paired['events']} BA events containing "
              f"both quartiles, the equal-event mean difference was {paired['mean']:+.2f} hours "
              f"({paired['lo']:.2f} to {paired['hi']:.2f}). These are observed differences. Storm location, event length and "
              "reporting coverage can affect them. A single storm can also cause several BA events.",
              "## Reproduction and limits",
              "Run `models/run_all.sh` with the shared data mounted. Each browser model includes 200 Python predictions for "
              "comparison with the browser evaluator. The model files store LightGBM’s numeric split trees unchanged.",
              table(["Browser model", "Trees", "Bytes", "Maximum tree-walk difference"],
                    [[n, exports[n]["trees"], exports[n]["bytes"], f"{exports[n]['parityMaxDiff']:.2g}"]
                     for n in ("warn_grid", "warn_full", "dark")]),
              f"The shared BA prediction file contains {warn['featureRows']:,} rows. Masked hours have null scores in the "
              "labelled period. Post-coverage estimates have no measured outcomes. Eligible training validation rows use "
              "out-of-fold predictions. Other training predictions can be in-sample. Held-out rows use the final training fit.",
              "The grid and weather archives may include revisions and reporting delays. EAGLE-I records positive outage reports, "
              "so a silent hour can mean either no outage or incomplete reporting. BA boundaries use the 2024 crosswalk across all years. "
              "Event attribution uses weighted county shares, while the county model uses only primary assignments. Dark hours end "
              "at the BA event boundary. These tests measure retrospective performance and do not establish a live warning service’s reliability.",
              "Machine-readable results include every candidate setting, unrounded scores and additional regression diagnostics. "
              "[Warning results](out/warn_results.json) · [County results](out/dark_results.json) · [Export checks](out/export_info.json)"]
    (C.HERE / "RESULTS.md").write_text("\n\n".join(parts) + "\n")
    print("RESULTS.md written")


if __name__ == "__main__":
    main()
