#!/usr/bin/env bash
# Gate, then commit everything as one task. Commits only when the gate is green. Usage: scripts/commit-task.sh "phase N: what"
set -euo pipefail
cd "$(dirname "$0")/.."
if scripts/gate.sh > /tmp/nostos-gate-last.txt 2>&1; then
  tail -1 /tmp/nostos-gate-last.txt
  git add -A
  git -c user.name=Charles -c user.email=cjforever789@gmail.com commit -q -m "$1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
  echo "committed: $1"
else
  grep -E "GATE FAIL|×|FAIL|error" /tmp/nostos-gate-last.txt | head -15
  echo "NOT COMMITTED: gate is red"
  exit 1
fi
