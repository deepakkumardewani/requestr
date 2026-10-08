#!/usr/bin/env bash
# Verifies the scenario IDs in e2e/scenarios/chain/*.feature.md match the IDs defined in
# agent_docs/chain-e2e/SPEC.md (table rows starting with "| CHN-..."), each exactly once.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
id_re='CHN-[A-Z]+(-[A-Z]+)?-[0-9]+[a-z]?'
spec_ids=$(grep -oE "^\| ${id_re}" "$root/agent_docs/chain-e2e/SPEC.md" | sed 's/^| //' | sort)
feat_ids=$(grep -hoE "^## Scenario: \[${id_re}\]" "$root"/e2e/scenarios/chain/*.feature.md | sed -E 's/^## Scenario: \[(.*)\]/\1/' | sort)

dup_spec=$(echo "$spec_ids" | uniq -d); dup_feat=$(echo "$feat_ids" | uniq -d)
missing=$(comm -23 <(echo "$spec_ids" | uniq) <(echo "$feat_ids" | uniq))
extra=$(comm -13 <(echo "$spec_ids" | uniq) <(echo "$feat_ids" | uniq))

echo "SPEC ids: $(echo "$spec_ids" | wc -l | tr -d ' ')  feature ids: $(echo "$feat_ids" | wc -l | tr -d ' ')"
status=0
[ -n "$dup_spec" ] && { echo "Duplicate in SPEC: $dup_spec"; status=1; }
[ -n "$dup_feat" ] && { echo "Duplicate in features: $dup_feat"; status=1; }
[ -n "$missing" ] && { echo "In SPEC, missing from features: $missing"; status=1; }
[ -n "$extra" ] && { echo "In features, not in SPEC: $extra"; status=1; }
[ $status -eq 0 ] && echo "OK: ID sets match"
exit $status
