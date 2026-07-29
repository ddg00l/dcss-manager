#!/usr/bin/env python3
"""Emit the CI shard matrix, giving heavy tactics more shards.

A GitHub job is killed at 6 hours. Simulation cost tracks simulated ACTIONS, not
calendar days, so the productive tactics are also the expensive ones -- measured
on a 90-day run at 6 sessions per shard:

    shardwhale a  230 min      whale a/b  158 min
    abyssal a     180 min      afk  a/b    53 min

shardwhale earns its cost honestly: 7661 Orbs and 11201 summons per session
against active's 5434 and 1475. But 230 minutes leaves little headroom, and the
economy is still being tuned upward, so the heavy tactics are the ones that will
hit the ceiling first -- and a job killed at 6 hours takes its whole shard's
data with it.

Heavy tactics therefore split across four shards running half the sessions each:
the same total sample per tactic, roughly half the wall time per job. Splitting
rather than trimming keeps the statistics intact, which matters because this
session repeatedly drew wrong conclusions from thin samples.

Each shard gets its own SEED_BASE so shards explore different accounts instead
of duplicating work (they used to silently run identical seeds).

Usage: python3 tools/sim/shard_plan.py [sessions]   -> compact JSON for a matrix
"""
import json
import sys

TACTICS = [
    'afk', 'lazy', 'active', 'rush_slots', 'keystoner', 'whale', 'smith',
    'speedrun', 'shardwhale', 'treasurer', 'abyssal', 'miser', 'completionist',
    'berserker',
]

# Measured to run long on a 90-day sweep. Keep this list honest: add a tactic
# when its job time approaches half the 6-hour ceiling, not by intuition.
HEAVY = {'shardwhale', 'abyssal', 'whale', 'completionist'}

SHARD_NAMES = ['a', 'b', 'c', 'd']
SEED_STRIDE = 500


def plan(sessions):
    out = []
    for tac in TACTICS:
        n = 4 if tac in HEAVY else 2
        # halve the per-shard sessions for a 4-way split so the total per tactic
        # is unchanged; never drop below 1
        per = max(1, sessions // 2) if n == 4 else sessions
        for i in range(n):
            out.append({
                'tactic': tac,
                'shard': SHARD_NAMES[i],
                'seedBase': i * SEED_STRIDE,
                'sessions': per,
            })
    return out


if __name__ == '__main__':
    sessions = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    print(json.dumps(plan(sessions), separators=(',', ':')))
