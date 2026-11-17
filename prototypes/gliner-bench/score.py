# PROTOTYPE: score results.json against a hand-written answer key (model-only items; rules cover emails/phones/account numbers).
import json
KEY = {
 'short': ['Dana Whitfield', 'Fairfax'],
 'medium': ['Northgate Federal Credit Union', 'Marcus Ellery', '4127 Lindell Road', 'Harbor Fitness', 'Priya', 'Inova'],
 'long': ['Colfax Commons', 'Ruth Okafor', 'Daniel', 'Glen Hartley', 'Brightline Residential', 'Elena', 'Mount Vernon Hospital', 'Alexandria', '123-45-6789', 'Capital Ridge'],
}
RULES = ['@', '555-0148', '004417829915', '7731']  # structured items the regex layer owns
for r in json.load(open('results.json')):
    if 'prompts' not in r: print(f"{r['model']:5} {r['dtype']:6} {r['ep']:6} -> ERROR"); continue
    hit = tot = 0; miss = []; fp = []; bonus = []
    for name, keys in KEY.items():
        ents = r['prompts'][name]['ents']; spans = [e.split(':', 1)[1].rsplit('(', 1)[0].strip('"') for e in ents]
        for k in keys:
            tot += 1
            if any(k in s or s in k for s in spans): hit += 1
            else: miss.append(k)
        for s in spans:
            if any(x in s for x in RULES): bonus.append(s)
            elif not any(k in s or s in k for k in keys): fp.append(s)
    worst = max(p['p95'] for p in r['prompts'].values())
    print(f"{r['model']:5} {r['dtype']:6} {r['ep']:6} thr={str(r['threads']):3} th={r['th']}  recall {hit}/{tot}  long-p95 {worst:5.0f}ms  load {r['loadMs']:4.0f}ms  missed={miss}  extra={fp}  rules-items-also-found={bonus}")
