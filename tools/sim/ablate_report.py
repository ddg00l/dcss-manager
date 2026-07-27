#!/usr/bin/env python3
"""Summarise decision-ablation NDJSON: how much does each choice actually change?

Reads rows produced by tools/sim/ablate.mjs (one per variant per shard), merges
shards, and prints a table per axis plus the headline number: the SPREAD, i.e.
best variant / worst variant. A spread near 1.0 means the decision is a placebo
-- the player is being asked to choose between options that do the same thing.

Also flags a hard stall: winsLast10d == 0 means the account stopped progressing
entirely before the run ended, which no cumulative total would reveal.

Usage: python3 tools/sim/ablate_report.py 'results/*.ndjson'
"""
import sys, glob, json, collections

PLACEBO = 1.15   # below this spread, a decision is not worth the UI it occupies
TARGET = 1.5     # a decision worth presenting should move outcomes at least this much


def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else 'results/*.ndjson'
    rows = collections.defaultdict(list)
    for fn in glob.glob(pattern):
        for line in open(fn):
            line = line.strip()
            if not line.startswith('{'):
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if 'axis' in r and 'label' in r:
                rows[r['axis']].append(r)
    if not rows:
        print(f'no ablation rows matched {pattern!r}')
        return 1

    for axis in sorted(rows):
        # merge shards: mean per label, weighted by the sessions each row covers
        by_label = collections.defaultdict(list)
        for r in rows[axis]:
            by_label[r['label']].append(r)
        print(f'\n=== {axis} ===')
        print('%-12s %8s %8s %8s %8s %12s' %
              ('variant', 'wins', 'prest', 'depth', 'deaths', 'wins_last10d'))
        means = {}
        for label, rs in by_label.items():
            tot = sum(r.get('sessions', 1) for r in rs) or 1
            wavg = lambda k: sum(r.get(k, 0) * r.get('sessions', 1) for r in rs) / tot
            tails = [r['winsLast10d'] for r in rs if r.get('winsLast10d') is not None]
            tail = sum(tails) / len(tails) if tails else None
            means[label] = wavg('wins')
            print('%-12s %8.1f %8.1f %8.1f %8.1f %12s' %
                  (label, wavg('wins'), wavg('prestiges'), wavg('depth'), wavg('deaths'),
                   '-' if tail is None else ('%.2f%s' % (tail, '  STALLED' if tail == 0 else ''))))
        lo, hi = min(means.values()), max(means.values())
        best = max(means, key=means.get)
        if lo <= 0:
            # a variant scored zero: the spread is unbounded, but with few seeds
            # this is usually noise rather than a real cliff -- say so plainly
            print(f'spread unbounded (worst variant scored 0 wins; best: {best})'
                  f'  -> check seed count before trusting this')
            continue
        spread = hi / lo
        verdict = ('PLACEBO — not worth a UI control' if spread < PLACEBO
                   else 'weak' if spread < TARGET else 'meaningful')
        print(f'spread {spread:.2f}x  (best: {best})  -> {verdict}')

    print(f'\nthresholds: <{PLACEBO}x placebo, <{TARGET}x weak, else meaningful')
    return 0


if __name__ == '__main__':
    sys.exit(main())
