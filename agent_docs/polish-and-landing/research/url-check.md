| URL | Status | Checked | Manual verification needed |
|---|---|---|---|
| https://learning.postman.com/docs/getting-started/installation/installation-and-updates | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/getting-started/basics/about-postman-agent/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/use/send-requests/protocols/protocols | HEAD 200 | 2026-11-07 | no |
| https://www.postman.com/pricing/ | HEAD 200 | 2026-11-07 | no |
| https://insomnia.rest/download | HEAD 200 | 2026-11-07 | no |
| https://insomnia.rest/ | HEAD 200 | 2026-11-07 | no |
| https://konghq.com/blog/engineering/why-kong-insomnia-is-developers-preferred-api-client | HEAD 200 | 2026-11-07 | no |
| https://insomnia.rest/pricing/ | HEAD 200 | 2026-11-07 | no |
| https://github.com/Kong/insomnia/blob/develop/README.md | HEAD 200 | 2026-11-07 | no |

Reconciliation (cross-verify pass, no table pipes below):
- All claims in postman.md and insomnia.md were re-checked against the fetched page text on 2026-11-07 (pricing figures, protocol lists, Scratch Pad, Desktop Agent CORS text, Git Sync, mock quotas). All matched.
- Stale in current landing data: Insomnia protocols omit SOAP (pricing page lists a SOAP client); Postman protocols omit MCP and AI requests; Postman Solo/Team prices are annual-billed.
- Unverified (must not be shown as fact): Insomnia desktop "not subject to browser CORS" (no official source; allowlist page has no CORS text); Insomnia Pro/Enterprise billing period behind the $12/$45 figures (toggle on page); Postman SSE support; Postman changelog claims (not fetched).
- Requestr claims: every code path exists on disk; gRPC, MQTT, SOAP and SSE are absent from src/ so no such claim is made.
- No vendor blocked scripted fetches, so no manual verification was required; the flag column is retained per AC-28.

## P5b URL check (2026-11-07)

| URL | Status | Checked | Manual verification needed |
|---|---|---|---|
| https://learning.postman.com/docs/postman-flows/gs/flows-overview/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/collections/running-collections/intro-to-collection-runs/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/agent-mode/overview/ | HEAD 200 | 2026-11-07 | no |
| https://www.postman.com/pricing/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/getting-started/importing-and-exporting/exporting-data/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/sending-requests/create-requests/generate-code-snippets/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/overview/ | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/getting-started/installation/installation-and-updates | HEAD 200 | 2026-11-07 | no |
| https://insomnia.rest/pricing/ | HEAD 200 | 2026-11-07 | no |
| https://docs.insomnia.rest/insomnia/collection-runner | HEAD 200 | 2026-11-07 | no |
| https://insomnia.rest/ | HEAD 200 | 2026-11-07 | no |
| https://docs.insomnia.rest/insomnia/generate-code-snippet | HEAD 200 | 2026-11-07 | no |
| https://docs.insomnia.rest/insomnia/import-export-data | HEAD 200 | 2026-11-07 | no |
| https://github.com/Kong/insomnia/blob/develop/LICENSE | HEAD 200 | 2026-11-07 | no |
| https://learning.postman.com/docs/getting-started/first-steps/get-started/ | not used (404 on 2026-11-07, never cited) | 2026-11-07 | no |

P5b reconciliation (cross-verify pass, no table pipes below):
- Every claim in the P5b rows of postman.md and insomnia.md was re-read against fetched page text on 2026-11-07. Stale prior claim found: Postman Free AI credits are 100 on the pricing page, not 50 as in the earlier row; the P5b figure wins.
- No vendor blocked scripted fetches (all HEAD 200), so no manual verification was required; the column is kept per AC-28.
- Requestr P5b rows: every code path exists on disk except src/components/landing/data/speedProof.ts, which TB5.6 creates. The 9 code generation languages are cURL plus the 8 generate* functions in codeGenerators.ts.
- extraSources: none are planned; the generate-code-snippets (Postman) and import-export-data (Insomnia) URLs are the only secondary proofs and both returned 200.
- Unverified (must not be shown as fact): Postman open-source status, Insomnia AI usage limits, Insomnia visual-workflow absence, Insomnia export formats.
- Final last-check date for COMPARISON_CHECKED_ON: 2026-11-07.
