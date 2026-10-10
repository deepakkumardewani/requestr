#!/usr/bin/env bash
# Verifies Gherkin <-> Playwright parity: every `## Scenario: [ID]` in e2e/scenarios/chain/*.feature.md
# has exactly one test titled `[ID] ...` in e2e/qa/chain-e2e-*.spec.ts (plus the single CHN-BUG-19 test
# in e2e/qa/chaining-ui-overhaul.spec.ts), and every such test title maps back to a Gherkin scenario.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
id_re='CHN-[A-Z]+(-[A-Z]+)?-[0-9]+[a-z]?'

feat_ids=$(grep -hoE "^## Scenario: \[${id_re}\]" "$root"/e2e/scenarios/chain/*.feature.md | sed -E 's/^## Scenario: \[(.*)\]/\1/' | sort || true)

fail() { echo "FAILED: $1" >&2; [ -n "${2:-}" ] && echo "$2" >&2; exit 1; }

command -v bunx >/dev/null 2>&1 || fail "bunx not found on PATH (PATH=$PATH)"
# An explicitly supplied base URL must be reachable: `--list` never contacts it, so a typo would
# otherwise pass silently and the parity result would not reflect the environment the suite runs in.
if [ -n "${PLAYWRIGHT_TEST_BASE_URL:-}" ]; then
  hostport=$(echo "$PLAYWRIGHT_TEST_BASE_URL" | sed -E 's#^[a-z]+://([^/]+).*#\1#')
  host=${hostport%%:*}; port=${hostport##*:}; [ "$port" = "$hostport" ] && port=80
  (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null || fail "PLAYWRIGHT_TEST_BASE_URL not reachable ($PLAYWRIGHT_TEST_BASE_URL)"
fi
[ -n "$feat_ids" ] || fail "no '## Scenario: [ID]' headings found in e2e/scenarios/chain/*.feature.md"

# `--list` resolves parameterised (loop-generated) titles that a source grep cannot see.
# Playwright's own failure output is captured and shown, instead of dying under `set -e`.
list_titles() {
  local out
  out=$(cd "$root" && PLAYWRIGHT_TEST_BASE_URL="${PLAYWRIGHT_TEST_BASE_URL:-http://127.0.0.1:3000}" \
    bunx playwright test "$@" --list 2>&1) || fail "playwright --list $*" "$out"
  echo "$out" | grep -E '^\s+\[chromium\] › ' | sed -E 's/^.* › //' || true
}
spec_titles=$(list_titles e2e/qa/chain-e2e-*.spec.ts)
[ -n "$spec_titles" ] || fail "no chromium test titles listed for e2e/qa/chain-e2e-*.spec.ts"
overhaul_titles=$(list_titles e2e/qa/chaining-ui-overhaul.spec.ts -g 'CHN-BUG-19' | grep -E '^\[CHN-BUG-19\]' || true)
all_titles=$(printf '%s\n%s\n' "$spec_titles" "$overhaul_titles" | grep .)
test_ids=$(echo "$all_titles" | grep -oE "^\[${id_re}\]" | tr -d '[]' | sort)
untagged=$(echo "$all_titles" | grep -vE "^\[${id_re}\] " || true)

dup_test=$(echo "$test_ids" | uniq -d)
missing=$(comm -23 <(echo "$feat_ids" | uniq) <(echo "$test_ids" | uniq))
unknown=$(comm -13 <(echo "$feat_ids" | uniq) <(echo "$test_ids" | uniq))

echo "Gherkin IDs: $(echo "$feat_ids" | grep -c .)  test IDs: $(echo "$test_ids" | grep -c .)  missing: $(echo "$missing" | grep -c .)  duplicated: $(echo "$dup_test" | grep -c .)  unknown: $(echo "$unknown" | grep -c .)"
status=0
[ -n "$missing" ] && { echo "Gherkin ID with no test: $missing"; status=1; }
[ -n "$dup_test" ] && { echo "Gherkin ID with more than one test: $dup_test"; status=1; }
[ -n "$unknown" ] && { echo "Test ID with no Gherkin scenario: $unknown"; status=1; }
[ -n "$untagged" ] && { echo "Test without an [ID] title prefix:"; echo "$untagged"; status=1; }
[ $status -eq 0 ] && echo "OK: Gherkin and tests are in parity"
exit $status
