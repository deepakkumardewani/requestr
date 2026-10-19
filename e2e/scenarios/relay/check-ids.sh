#!/usr/bin/env bash
# Verifies the scenario IDs in e2e/scenarios/relay/*.feature.md are unique and that each feature
# file's IDs match the `[REL-...]` test titles in the spec of the same basename
# (e2e/qa/relay/<name>.spec.ts). A feature without a spec yet is reported as pending, not failed,
# so scenarios can be written ahead of the phase that implements them.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
id_re='REL-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]+[a-z]?'
status=0
all_feat_ids=""

for feature in "$root"/e2e/scenarios/relay/*.feature.md; do
  name="$(basename "$feature" .feature.md)"
  spec="$root/e2e/qa/relay/$name.spec.ts"
  feat_ids=$(grep -oE "^## Scenario: \[${id_re}\]" "$feature" | sed -E 's/^## Scenario: \[(.*)\]/\1/' | sort || true)
  all_feat_ids+="${feat_ids}"$'\n'

  if [ ! -f "$spec" ]; then
    echo "PENDING: $name ($(echo "$feat_ids" | wc -l | tr -d ' ') scenarios, no spec yet)"
    continue
  fi

  test_ids=$(grep -oE "test(\.[a-z]+)?\(\s*[\"'\`]\[${id_re}\]" "$spec" | grep -oE "${id_re}" | sort || true)
  dup_test=$(echo "$test_ids" | uniq -d)
  missing=$(comm -23 <(echo "$feat_ids" | uniq) <(echo "$test_ids" | uniq))
  extra=$(comm -13 <(echo "$feat_ids" | uniq) <(echo "$test_ids" | uniq))

  echo "$name: feature ids: $(echo "$feat_ids" | wc -l | tr -d ' ')  test ids: $(echo "$test_ids" | grep -c . || true)"
  [ -n "$dup_test" ] && { echo "  Duplicate test ids: $dup_test"; status=1; }
  [ -n "$missing" ] && { echo "  In feature, missing from spec: $missing"; status=1; }
  [ -n "$extra" ] && { echo "  In spec, not in feature: $extra"; status=1; }
done

dup_feat=$(echo "$all_feat_ids" | grep . | sort | uniq -d || true)
[ -n "$dup_feat" ] && { echo "Duplicate scenario ids across features: $dup_feat"; status=1; }
[ $status -eq 0 ] && echo "OK: scenario IDs consistent"
exit $status
