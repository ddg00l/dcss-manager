#!/bin/sh
# Work-stealing pool: fine-grained chunks keep every core busy until the global
# tail, instead of a few heavy per-tactic shards idling the CPU at the end.
# usage: ./run-pool.sh <outdir> [days=1] [sessions-per-tactic=125] [chunk=5]
OUT=${1:?usage: run-pool.sh <outdir> [days] [per-tactic] [chunk]}
DAYS=${2:-1}; PER=${3:-125}; CHUNK=${4:-5}
SD=$(cd "$(dirname "$0")" && pwd)
# prefer bun (~1.5x faster, byte-identical results) when available
RT=node; command -v bun >/dev/null 2>&1 && RT=bun
[ -x "$HOME/.bun/bin/bun" ] && RT="$HOME/.bun/bin/bun"
echo "runtime: $RT" >&2
mkdir -p "$OUT"
for t in afk lazy active rush_slots keystoner whale smith speedrun shardwhale; do
  i=0; left=$PER
  while [ "$left" -gt 0 ]; do
    n=$CHUNK; [ "$left" -lt "$CHUNK" ] && n=$left
    echo "$t $n $DAYS $OUT/${t}_$i.ndjson $((i*100))"
    i=$((i+1)); left=$((left-n))
  done
done | xargs -P "$(sysctl -n hw.ncpu 2>/dev/null || nproc)" -L1 sh -c \
  'SEED_BASE="$4" "'"$RT"'" "'"$SD"'/worker.mjs" "$0" "$1" "$2" > "$3" 2>/dev/null'
echo "done: $(cat "$OUT"/*.ndjson | wc -l | tr -d ' ') sessions in $OUT"
