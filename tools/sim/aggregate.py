#!/usr/bin/env python3
"""Aggregate streaming NDJSON session results: python3 aggregate.py 'r5_*.ndjson'"""
import json, sys, glob, statistics as st, math
files = glob.glob(sys.argv[1] if len(sys.argv) > 1 else '*.ndjson')
by = {}
for f in files:
    for line in open(f):
        line = line.strip()
        if not line: continue
        r = json.loads(line)
        by.setdefault(r['tactic'], []).append(r)
med = st.median
hdr = f"{'tactic':<11}{'n':>5}{'win%':>6}{'wins':>6}{'depth':>7}{'deaths':>7}{'runes':>6}{'mem':>8}{'zlv':>5}{'plv':>5}{'prest':>6}{'⚜':>6}{'grt':>5}{'zig':>5}{'ctr':>5}"
print(hdr); print('-' * len(hdr))
for name, o in sorted(by.items()):
    g = lambda k: [x.get(k, 0) for x in o]
    wins = g('wins'); n = len(o)
    print(f"{name:<11}{n:>5}{sum(1 for w in wins if w>0)/n*100:>6.0f}{sum(wins)/n:>6.2f}"
          f"{med(g('depth')):>7.0f}{med(g('deaths')):>7.0f}{med(g('runes')):>6.0f}{med(g('mem')):>8.0f}"
          f"{med(g('zlv')):>5.0f}{med(g('plv')):>5.0f}{sum(g('prestiges'))/n:>6.2f}{med(g('legends')):>6.0f}"
          f"{med(g('greats')):>5.0f}{med(g('zig')):>5.0f}{med(g('contracts')):>5.0f}")

# per-day dynamics when byDay snapshots are present
sample = next((x for o in by.values() for x in o if x.get('byDay')), None)
if sample:
    days = len(sample['byDay'])
    print()
    print('=== per-day dynamics: wins that day (median) / cumulative prestiges (mean) / NG level (median) ===')
    print(f"{'tactic':<11}" + ''.join(f"{'d'+str(d+1):>14}" for d in range(days)))
    for name, o in sorted(by.items()):
        oo = [x for x in o if x.get('byDay')]
        if not oo: continue
        row = f"{name:<11}"
        for d in range(days):
            dw = med([x['byDay'][d]['wins'] - (x['byDay'][d-1]['wins'] if d else 0) for x in oo])
            dp = sum(x['byDay'][d]['prest'] for x in oo) / len(oo)
            dn = med([x['byDay'][d]['ng'] for x in oo])
            row += f"{dw:>5.1f}/{dp:>4.1f}/{dn:>2.0f}"
        print(row)

# 95% confidence half-width on the mean (CRN sizing aid)
def ci(vals):
    n=len(vals)
    if n<2: return 0.0
    sd=st.pstdev(vals)
    return 1.96*sd/math.sqrt(n)
print()
print("=== 95% CI half-width on mean wins (lower = fewer sessions needed) ===")
for name, o in sorted(by.items()):
    w=[x.get('wins',0) for x in o]
    m=sum(w)/len(w)
    h=ci(w)
    rel=(h/m*100) if m else 0
    print(f"{name:<11} n={len(o):>3}  mean {m:>7.1f}  ±{h:>6.1f}  ({rel:>4.0f}% rel)")
