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


SPLIT_GAP = 0.45   # one gap holding this share of the range reads as two modes

# What each control is FOR, and the spread its own metric must show. Judging all
# of them by Orbs per day is what flattened the game: four different decisions
# competing in one number can only be equalised. The Orb spread is now an
# anti-goal for these axes -- different paths, not different speeds.
AXIS_METRIC = {
    'caution': ('fallenDepth', 'avg depth at death', 2.0),
    'route':   ('runeKinds', 'kinds of rune brought home', 2.0),
    'spend':   ('gearHome', 'gear delivered to the armoury', 2.0),
    'tree':    ('wins', 'Orbs (the tree IS about tempo)', 3.0),
    'attention': ('wins', 'Orbs (attention IS about tempo)', 2.0),
    'ascend':  ('wins', 'Orbs', 1.5),
}
ORB_DIVERGENCE_CAP = 1.3   # non-tempo axes should not differ much in Orbs


def bimodality_report(rows):
    """Do accounts cluster around the mean, or split into fast and stalled modes?

    A mean cannot answer this and actively hides it: the same constant was
    measured producing 70 Orbs on one seed and 2482 on another, which averages to
    a healthy-looking number describing an outcome no account actually had. So
    pool every seed of the axis, sort, and look for a dominant gap. If one gap
    holds most of the range, the loop is bistable and the mean is a fiction.
    """
    pooled = []
    for r in rows:
        pooled.extend(r.get('winsPerSeed') or [])
    pooled.sort()
    n = len(pooled)
    if n < 4:
        return
    stalled = sum(1 for w in pooled if w == 0)
    span = pooled[-1] - pooled[0]
    gaps = [(pooled[i + 1] - pooled[i], i) for i in range(n - 1)]
    width, idx = max(gaps)
    share = (width / span) if span > 0 else 0.0
    print('  seeds: ' + ' '.join(str(int(w)) for w in pooled))
    if stalled:
        print(f'  {stalled}/{n} seeds took no Orb at all')
    if share >= SPLIT_GAP:
        below, above = pooled[:idx + 1], pooled[idx + 1:]
        print(f'  BIMODAL: {len(below)} seeds <= {int(below[-1])}, '
              f'{len(above)} seeds >= {int(above[0])} — one gap holds '
              f'{share * 100:.0f}% of the range; the mean describes no real account')
    else:
        print(f'  unimodal (largest gap holds {share * 100:.0f}% of the range)')


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
        bimodality_report(rows[axis])
        # judge the axis in its own metric first
        key, label, want = AXIS_METRIC.get(axis, ('wins', 'Orbs', 1.5))
        own = {}
        for lbl, rs in by_label.items():
            tot = sum(r.get('sessions', 1) for r in rs) or 1
            own[lbl] = sum(r.get(key, 0) * r.get('sessions', 1) for r in rs) / tot
        if own and min(own.values()) > 0:
            sp = max(own.values()) / min(own.values())
            verdict = 'MEANINGFUL' if sp >= want else 'too flat'
            print('  own metric (%s): %s  spread %.2fx  (need %.1fx) -> %s'
                  % (label, '/'.join('%s %.2f' % (k, v) for k, v in own.items()), sp, want, verdict))
        lo, hi = min(means.values()), max(means.values())
        best = max(means, key=means.get)
        if key != 'wins' and lo > 0 and hi / lo > ORB_DIVERGENCE_CAP:
            print('  NOTE: %.2fx spread in Orbs too -- this control should change WHAT you get, '
                  'not how fast' % (hi / lo))
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
