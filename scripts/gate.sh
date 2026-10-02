#!/usr/bin/env bash
# The only definition of green. Fails fast in a fixed order. On success appends one line to LEDGER.md
# (this script is the only writer of LEDGER.md). Run from anywhere: scripts/gate.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TMP="$(mktemp -d)"
LOCK="${TMPDIR:-/tmp}/nostos-gate.lock"
if ! mkdir "$LOCK" 2>/dev/null; then echo "GATE FAIL: another gate run holds $LOCK (never run two backend test processes at once)"; exit 1; fi
trap 'rmdir "$LOCK" 2>/dev/null; rm -rf "$TMP"' EXIT
fail() { echo "GATE FAIL: $1"; exit 1; }
step() { echo "== gate: $1"; }

step "disk (5 GB free)"
avail_kb=$(df -Pk /System/Volumes/Data | awk 'NR==2 {print $4}')
[ "$avail_kb" -ge 5242880 ] || fail "under 5 GB free on /System/Volumes/Data (${avail_kb} KB)"

step "repo hygiene"
git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' | grep -q . && fail "a .env file is tracked"
git ls-files | grep -qE '(^|/)node_modules/' && fail "node_modules is tracked"
while IFS= read -r f; do
  [ -f "$f" ] || continue
  size=$(wc -c < "$f")
  [ "$size" -le 5242880 ] || fail "tracked file over 5 MB: $f"
done < <(git ls-files)

step "backend typecheck"
(cd backend && pnpm -s typecheck) || fail "backend typecheck"
step "backend lint"
(cd backend && pnpm -s lint) || fail "backend lint"
step "backend test (single process)"
(cd backend && pnpm test) > "$TMP/backend.txt" 2>&1 || { tail -40 "$TMP/backend.txt"; fail "backend tests"; }
tail -8 "$TMP/backend.txt"
BACKEND_TESTS=$(sed 's/\x1b\[[0-9;]*m//g' "$TMP/backend.txt" | awk '/^ *Tests /{for(i=1;i<=NF;i++) if($i=="passed"){print $(i-1)}}' | tail -1)

step "mobile check"
(cd mobile && npm run check) > "$TMP/mobile.txt" 2>&1 || { tail -40 "$TMP/mobile.txt"; fail "mobile check"; }
tail -6 "$TMP/mobile.txt"
MOBILE_TESTS=$(awk '/^Tests:/{for(i=1;i<=NF;i++) if($i=="passed,"||$i=="passed"){print $(i-1)}}' "$TMP/mobile.txt" | tail -1)
step "contract sync"
(cd mobile && npx jest src/api/__tests__/contracts-sync.test.ts --silent) >/dev/null 2>&1 || fail "contract-sync test"

step "invariants suite"
INV=backend/tests/integration/invariants.test.ts
[ -f "$INV" ] || fail "$INV is missing"
grep -nE '\.(skip|todo|only)\b|\b(xit|xdescribe|fit|fdescribe)\(' "$INV" && fail "invariants suite has skipped or focused tests"
(cd backend && pnpm vitest run tests/integration/invariants.test.ts --reporter=verbose) > "$TMP/inv.txt" 2>&1 || { tail -40 "$TMP/inv.txt"; fail "invariants suite"; }
while IFS= read -r rule; do
  [ -n "$rule" ] || continue
  grep -q "✓.* $rule" "$TMP/inv.txt" || fail "invariant '$rule' has no passing test (see scripts/invariants-required.txt)"
done < scripts/invariants-required.txt

step "dependency ledger"
node scripts/check-deps.mjs || fail "dependency ledger"

printf '%s | %s | backend %s | mobile %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(git rev-parse --short HEAD)" "${BACKEND_TESTS:-?}" "${MOBILE_TESTS:-?}" >> LEDGER.md
echo "GATE OK: backend ${BACKEND_TESTS:-?} tests, mobile ${MOBILE_TESTS:-?} tests"
