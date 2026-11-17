# PROTOTYPE: transformers.js 2.17 (bundled with gliner@0.0.19) expects BPE merges as "a b" strings, not [a, b] pairs.
import json, sys
for p in sys.argv[1:]:
    t = json.load(open(p))
    m = t["model"].get("merges", [])
    if m and isinstance(m[0], list):
        t["model"]["merges"] = [" ".join(x) for x in m]
        json.dump(t, open(p, "w"), ensure_ascii=False)
        print("fixed", p)
