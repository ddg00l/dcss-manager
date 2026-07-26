#!/bin/sh
# Work-stealing pool: fine-grained chunks keep every core busy until the global
# tail, instead of a few heavy per-tactic shards idling the CPU at the end.
# usage: ./run-pool.sh <outdir> [days=1] [sessions-per-tactic=125] [chunk=5]
OUT=${1:?usage: run-pool.sh <outdir> [days] [per-tactic] [chunk]}
DAYS=${2:-1}; PER=${3:-125}; CHUNK=${4:-5}
SD=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
for t in afk lazy active rush_slots keystoner whale smith speedrun; do
  i=0; left=$PER
  while [ "$left" -gt 0 ]; do
    n=$CHUNK; [ "$left" -lt "$CHUNK" ] && n=$left
    echo "$t $n $DAYS $OUT/${t}_$i.ndjson"
    i=$((i+1)); left=$((left-n))
  done
done | xargs -P "$(sysctl -n hw.ncpu 2>/dev/null || nproc)" -L1 sh -c \
  'node "'"$SD"'/worker.mjs" "$0" "$1" "$2" > "$3" 2>/dev/null'
echo "done: $(cat "$OUT"/*.ndjson | wc -l | tr -d ' ') sessions in $OUT"
