"""PROTOTYPE — run the Claude attacker loop on sample photos and print a report (never prints the key)."""
import json, sys, time
from pathlib import Path
from PIL import Image
import attackers as A, pinpoint as P

names = sys.argv[1:]
rows = {l.split("\t")[0]: l.split("\t") for l in open("samples/truth.tsv").read().splitlines()}
rows["zurich_streetview"] = ["zurich_streetview", "47.3830", "8.5035"]
out = Path("runs/claude"); out.mkdir(parents=True, exist_ok=True)
for n in names:
    f = Path("samples") / (n + (".webp" if n == "zurich_streetview" else ".jpg"))
    truth = (float(rows[n][1]), float(rows[n][2]))
    c0, t = A.cost_usd(), time.time()
    r = P.protect_vlm(Image.open(f), truth, 1.0, A.claude_attack, final_fn=lambda im: A.claude_attack(im, web_search=True))
    rec = {"photo": n, "steps": [], "pixels_unchanged": r.pixels_unchanged, "passed": r.passed,
           "cost_usd": round(A.cost_usd() - c0, 3), "seconds": round(time.time() - t)}
    for i, s in enumerate(r.steps):
        g = s.guess
        rec["steps"].append({"step": s.label, "place": g.place, "km": round(g.km_from_truth, 2),
                             "clues": [d for _, _, d in g.clues]})
        (s.overlay or s.image).save(out / f"{n}_{i}.jpg")
    print(json.dumps(rec, indent=1), flush=True)
print("TOTAL", json.dumps({k: v for k, v in A.USAGE.items()}), "cost_usd", round(A.cost_usd(), 3))
