#!/usr/bin/env python3
"""Show the shape of the Orb curve, not its total.

The target is 3-4 Orbs a day and the game delivers about 23. A total cannot say why.
A steady oversupply is a difficulty problem; a curve that doubles every few days is a
compounding one, and the two want opposite fixes. So this prints the trajectory, the
day the target band is crossed, and the growth factor between the first and last third
of the run.

Usage: python3 tools/sim/trace_report.py 'results/*.ndjson'
"""
import sys, glob, json, collections

TARGET_LO, TARGET_HI = 3.0, 4.0


def band(v):
    """A one-glyph reading of a day's rate against the target band."""
    if v < TARGET_LO:
        return '.'
    if v <= TARGET_HI:
        return '='
    if v <= TARGET_HI * 3:
        return '+'
    if v <= TARGET_HI * 10:
        return '#'
    return '@'


def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else 'results/*.ndjson'
    by_tactic = collections.defaultdict(list)
    for fn in glob.glob(pattern):
        for line in open(fn):
            line = line.strip()
            if not line.startswith('{'):
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if 'perDay' in r:
                by_tactic[r['tactic']].append(r)
            elif 'byDay' in r and r.get('byDay'):
                # Rows straight from the balance sim. Its artifacts already carry the
                # per-day series, so the trajectory needs no new workflow on the default
                # branch -- and a workflow file on master would trip the Pages deploy
                # that watches it. byDay counts are cumulative; deltas here.
                pw = pp = 0
                per, pre = [], []
                for d in r['byDay']:
                    per.append(d['wins'] - pw); pw = d['wins']
                    pre.append(d.get('prest', 0) - pp); pp = d.get('prest', 0)
                by_tactic[r.get('tactic', '?')].append({
                    'tactic': r.get('tactic', '?'), 'perDay': per, 'prestPerDay': pre,
                    'ng': [d.get('ng', 0) for d in r['byDay']],
                    'bar': [d.get('bar', 0) for d in r['byDay']],
                    'rate': [d.get('rate', 0) for d in r['byDay']],
                })
    if not by_tactic:
        print(f'no trace rows matched {pattern!r}')
        return 1

    print(f'target band {TARGET_LO:.0f}-{TARGET_HI:.0f} Orbs/day   '
          f'. below   = in band   + up to 3x   # up to 10x   @ beyond')
    for tactic in sorted(by_tactic):
        rows = by_tactic[tactic]
        days = min(len(r['perDay']) for r in rows)
        mean = [sum(r['perDay'][d] for r in rows) / len(rows) for d in range(days)]
        print(f'\n=== {tactic} ===  {len(rows)} seeds, {days} days')
        print('  ' + ''.join(band(v) for v in mean))
        # Where the band is left for good. This used to require EVERY later day to sit
        # above the band, which one quiet day anywhere in the tail defeats: a run
        # averaging 6.8 Orbs a day over its last ten days was reported as staying
        # inside a 3-4 band because day 60 happened to yield one. Judge a smoothed
        # rate, since a single day is noise and the band is a statement about pace.
        win = max(3, days // 10)
        roll = [sum(mean[max(0, d - win + 1):d + 1]) / len(mean[max(0, d - win + 1):d + 1])
                for d in range(days)]
        left = None
        for d in range(days):
            if all(roll[k] > TARGET_HI for k in range(d, days)):
                left = d + 1
                break
        print('  day 1-10 : ' + ' '.join(f'{v:.0f}' for v in mean[:10]))
        if days > 10:
            print('  last  10 : ' + ' '.join(f'{v:.0f}' for v in mean[-10:]))
        tail = sum(mean[-max(3, days // 10):]) / max(3, days // 10)
        if left:
            print(f'  leaves the target band for good on day {left}  '
                  f'(tail {tail:.1f}/day)')
        else:
            print(f'  stays within the target band  (tail {tail:.1f}/day)')
        third = max(1, days // 3)
        early = sum(mean[:third]) / third
        late = sum(mean[-third:]) / third
        if early > 0:
            growth = late / early
            shape = ('COMPOUNDING — the curve grows, so the fault is in the loop that '
                     'feeds itself, not in a constant' if growth >= 3 else
                     'steady — the rate is roughly flat, so the fault is a constant set '
                     'too generously' if growth <= 1.5 else 'mixed')
            print(f'  first third {early:.1f}/day, last third {late:.1f}/day '
                  f'({growth:.1f}x) -> {shape}')
        # what the game itself believed the rate was, and what bar it set
        if rows[0].get('rate'):
            r0 = rows[0]
            print(f'  the account\'s own smoothed rate ended at {r0["rate"][-1]}, '
                  f'prestige bar at {r0["bar"][-1]}, NG+{r0["ng"][-1]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
