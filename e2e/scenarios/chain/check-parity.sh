#!/usr/bin/env bash
# Verifies Gherkin <-> Playwright parity: every `## Scenario: [ID]` in e2e/scenarios/chain/*.feature.md
# has exactly one test titled `[ID] ...` in e2e/qa/chain-e2e-*.spec.ts (plus the single CHN-BUG-19 test
# in e2e/qa/chaining-ui-overhaul.spec.ts), and every such test title maps back to a Gherkin scenario.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
id_re='CHN-[A-Z]+(-[A-Z]+)?-[0-9]+[a-z]?'

feat_ids=$(grep -hoE "^## Scenario: \[${id_re}\]" "$root"/e2e/scenarios/chain/*.feature.md | sed -E 's/^## Scenario: \[(.*)\]/\1/' | sort)

# `--list` resolves parameterised (loop-generated) titles that a source grep cannot see.
list_titles() {
  (cd "$root" && PLAYWRIGHT_TEST_BASE_URL="${PLAYWRIGHT_TEST_BASE_URL:-http://127.0.0.1:3000}" \
    bunx playwright test "$@" --list 2>&1 | grep -E '^\s+\[chromium\] › ' | sed -E 's/^.* › //')
}
spec_titles=$(list_titles e2e/qa/chain-e2e-*.spec.ts)
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
