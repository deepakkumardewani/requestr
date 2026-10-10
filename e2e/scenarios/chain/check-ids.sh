#!/usr/bin/env bash
# Verifies the scenario IDs in e2e/scenarios/chain/*.feature.md match the IDs defined in
# agent_docs/chain-e2e/SPEC.md (table rows starting with "| CHN-..."), each exactly once.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
id_re='CHN-[A-Z]+(-[A-Z]+)?-[0-9]+[a-z]?'
fail() { echo "FAILED: $1" >&2; exit 1; }
spec_file="$root/agent_docs/chain-e2e/SPEC.md"
# The SPEC was committed in 6eacd89 but is absent from the working tree; read it from git history.
spec_rev="6eacd89"
if [ ! -f "$spec_file" ] && git -C "$root" cat-file -e "$spec_rev:agent_docs/chain-e2e/SPEC.md" 2>/dev/null; then
  spec_file="$(mktemp)"; trap 'rm -f "$spec_file"' EXIT
  git -C "$root" show "$spec_rev:agent_docs/chain-e2e/SPEC.md" > "$spec_file"
fi
# agent_docs/ is gitignored, so the SPEC is legitimately absent on fresh clones/CI: skip, don't fail.
if [ ! -f "$spec_file" ]; then
  echo "SKIPPED: SPEC not found at $spec_file (agent_docs/ is gitignored; restore the chain-e2e SPEC to run this check)" >&2
  exit 0
fi
spec_ids=$(grep -oE "^\| ${id_re}" "$spec_file" | sed 's/^| //' | sort || true)
feat_ids=$(grep -hoE "^## Scenario: \[${id_re}\]" "$root"/e2e/scenarios/chain/*.feature.md | sed -E 's/^## Scenario: \[(.*)\]/\1/' | sort || true)

dup_spec=$(echo "$spec_ids" | uniq -d); dup_feat=$(echo "$feat_ids" | uniq -d)
missing=$(comm -23 <(echo "$spec_ids" | uniq) <(echo "$feat_ids" | uniq))
extra=$(comm -13 <(echo "$spec_ids" | uniq) <(echo "$feat_ids" | uniq))

echo "SPEC ids: $(echo "$spec_ids" | wc -l | tr -d ' ')  feature ids: $(echo "$feat_ids" | wc -l | tr -d ' ')"
[ -n "$spec_ids" ] || fail "no CHN IDs found in $spec_file"
[ -n "$feat_ids" ] || fail "no scenario IDs found in e2e/scenarios/chain/*.feature.md"
status=0
[ -n "$dup_spec" ] && { echo "Duplicate in SPEC: $dup_spec"; status=1; }
[ -n "$dup_feat" ] && { echo "Duplicate in features: $dup_feat"; status=1; }
[ -n "$missing" ] && { echo "In SPEC, missing from features: $missing"; status=1; }
[ -n "$extra" ] && { echo "In features, not in SPEC: $extra"; status=1; }
[ $status -eq 0 ] && echo "OK: ID sets match"
exit $status
