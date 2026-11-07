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
