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
    # Composition, not count. Counting kinds of rune could not price the roads:
    # each road carries four rune branches, so the COUNT is identical however
    # different the runes are. What a road decides is the CHARACTER of the haul --
    # steel from the Mines and the Vaults against enchantment from the Elven Halls
    # and the Tomb -- and that is a difference a single number can hold.
    'route':   ('jewelShare', 'share of jewellery in the haul', 2.0),
    'tempo':   ('wins', 'Orbs (the short road IS about tempo)', 1.5),
    'spend':   ('gearHome', 'gear delivered to the armoury', 2.0),
    'tree':    ('wins', 'Orbs (the tree IS about tempo)', 3.0),
    'attention': ('wins', 'Orbs (attention IS about tempo)', 2.0),
    'ascend':  ('wins', 'Orbs', 1.5),
}
TEMPO_CAP = 1.5   # non-tempo axes should not differ much in time-to-first-Orb

# Orbs-per-window is not a usable tempo measure for a non-tempo axis. An account
# that crosses the three-Orb prestige threshold inside the window compounds and one
# that misses it by a day does not, so the same road measured 2 Orbs on one seed and
# 15 on the next -- a 7x swing from variance, not from the decision under test. Days
# to the first Orb has no threshold in it, so that is what guards these axes now.


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


def duplicate_report(by_label):
    """Two variants that return identical numbers are not two variants.

    This axis has now shipped three measurements that were decided by the harness
    rather than by the game, and each was caught only because the numbers looked too
    tidy to be true: `keystones` was byte-identical to `balanced`, the specialist
    builds were capped at two expedition slots while the slots build took the whole
    chain, and a standing order that ran continuously quietly overrode every considered
    tree strategy so all eight converged. Noticing that is not a skill worth relying
    on. The tool should say it.
    """
    seen = {}
    for label, rs in by_label.items():
        key = tuple(sorted(w for r in rs for w in (r.get('winsPerSeed') or [])))
        if not key:
            continue
        if key in seen:
            print(f'  IDENTICAL: {seen[key]!r} and {label!r} returned the same numbers on '
                  f'every seed — they are one variant under two names, not a comparison')
        else:
            seen[key] = label


def volatility_report(by_label):
    """A variant whose own seeds disagree more than the variants disagree with each
    other is not measuring a strategy, it is measuring luck."""
    for label, rs in by_label.items():
        per = sorted(w for r in rs for w in (r.get('winsPerSeed') or []))
        if len(per) < 3 or per[0] <= 0:
            continue
        swing = per[-1] / per[0]
        if swing >= 4:
            print(f'  VOLATILE: {label} ranges {int(per[0])}..{int(per[-1])} ({swing:.1f}x) '
                  f'across its own seeds — its mean is not a property of the strategy')


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
        print('%-12s %8s %8s %8s %8s %12s %8s %8s %8s' %
              ('variant', 'wins', 'prest', 'depth', 'deaths', 'wins_last10d',
               'martial', 'jewel', 'cons'))
        means = {}
        for label, rs in by_label.items():
            tot = sum(r.get('sessions', 1) for r in rs) or 1
            wavg = lambda k: sum(r.get(k, 0) * r.get('sessions', 1) for r in rs) / tot
            tails = [r['winsLast10d'] for r in rs if r.get('winsLast10d') is not None]
            tail = sum(tails) / len(tails) if tails else None
            means[label] = wavg('wins')
            print('%-12s %8.1f %8.1f %8.1f %8.1f %12s %8.0f %8.0f %8.0f' %
                  (label, wavg('wins'), wavg('prestiges'), wavg('depth'), wavg('deaths'),
                   '-' if tail is None else ('%.2f%s' % (tail, '  STALLED' if tail == 0 else '')),
                   wavg('martialHome'), wavg('jewelHome'), wavg('consFound')))
        duplicate_report(by_label)
        volatility_report(by_label)
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
        if key != 'wins':
            fo = {}
            for lbl, rs in by_label.items():
                tot = sum(r.get('sessions', 1) for r in rs) or 1
                fo[lbl] = sum(r.get('firstOrbDay', 0) * r.get('sessions', 1) for r in rs) / tot
            if fo and min(fo.values()) > 0:
                sp = max(fo.values()) / min(fo.values())
                print('  tempo (days to the first Orb): %s  spread %.2fx  (cap %.1fx) -> %s'
                      % ('/'.join('%s %.1f' % (k, v) for k, v in fo.items()), sp, TEMPO_CAP,
                         'ok' if sp <= TEMPO_CAP else 'TOO DIVERGENT — this control is '
                         'changing how fast, not what'))
            # the Wild Road is defined by reagents rather than by gear, and no single
            # share can separate three characters at once -- report it alongside
            cons = {}
            for lbl, rs in by_label.items():
                tot = sum(r.get('sessions', 1) for r in rs) or 1
                cons[lbl] = sum(r.get('consFound', 0) * r.get('sessions', 1) for r in rs) / tot
            if cons and min(cons.values()) > 0:
                print('  reagents brought home: %s  spread %.2fx'
                      % ('/'.join('%s %.0f' % (k, v) for k, v in cons.items()),
                         max(cons.values()) / min(cons.values())))
        if lo <= 0:
            # a variant scored zero: the spread is unbounded, but with few seeds
            # this is usually noise rather than a real cliff -- say so plainly
            print(f'spread unbounded (worst variant scored 0 wins; best: {best})'
                  f'  -> check seed count before trusting this')
            continue
        spread = hi / lo
        if key != 'wins':
            # Judge the axis by the thing it is FOR. The headline used to be the Orb
            # spread for every axis, which reported the route as "PLACEBO — not worth
            # a UI control" on the very run where it passed its own criterion at
            # 2.16x: the roads yield different hauls at the same speed, so a flat Orb
            # number there is the goal, not the failure. Printing the wrong verdict in
            # the loudest line is how a correct result gets thrown away.
            print(f'Orbs {spread:.2f}x apart — for this axis that is the GOAL, not the '
                  f'verdict; judge it on the own-metric line above')
            continue
        verdict = ('PLACEBO — not worth a UI control' if spread < PLACEBO
                   else 'weak' if spread < TARGET else 'meaningful')
        print(f'spread {spread:.2f}x  (best: {best})  -> {verdict}')

    print(f'\nthresholds: <{PLACEBO}x placebo, <{TARGET}x weak, else meaningful')
    return 0


if __name__ == '__main__':
    sys.exit(main())
