# P3 Settings audit and decisions (T3.1)

Reviewed: `src/components/settings/*`, `src/app/settings/{page,SettingsPageClient,constants}`, live page at `/settings` (1440x900, seeded app, light and dark). Before screenshots: `agent_docs/polish-and-landing/qa/p3/before/` (8 tabs x 2 themes, plus `shortcuts-1280x720-dark.png` and `clear-history-dialog-dark.png`). Baseline for AC-22.

## Findings per tab

| Tab | Findings |
|---|---|
| General | Mixes features, chain concurrency and a "Data Management" card (Clear History + Restart Tour). Restart Tour is not data. "Restart Tour" label is hardcoded English, not in `messages/*`. No language row (lives in its own tab). |
| Global | Title "Global" says nothing. Content is default Base URL + default headers applied to HTTP/GraphQL requests. All copy is hardcoded English (not in messages). |
| Appearance | "Accent Color" heading hardcoded English. No reduced-motion control. |
| Proxy & SSL | Copy via messages; labels fine. Offers a follow-redirects row (existing, out of scope for new settings). |
| Shortcuts | Single column `max-w-lg`; 1440x900 and 1280x720 both scroll vertically (see `before/shortcuts-*`). Needs two-column grid. |
| Language | A whole tab for one Select. Hardcoded English title/description. Folds into General. |
| Data | Only backup export/import. Clear-history is elsewhere, so Data does not hold all data actions. |
| Relay | Clear row says "Clear all Relay history" / button "Clear history" (same button text as General's "Clear History"). Disabled-by-flag state is simply a hidden tab. |
| Shell | `SettingsNav` fixed `w-52`; sections come from `SETTINGS_SECTIONS` in `constants.ts` (hash/persisted section handling in `useSettingsSectionStore`). |

## Decision 1: Global tab (FR-18)

Rename, do not merge. The content (default base URL and headers for outgoing requests) does not belong in General or Proxy. Nav label and heading become **"Request defaults"** with the one-line purpose: "Base URL and headers added to every HTTP and GraphQL request." Section id stays `global`, so the old `#global` hash and persisted value keep working with no redirect. Strings move into `messages/*` (en in T3.4, fr/ja in T3.13).

## Decision 2: Clear-history scope (FR-19)

Label scope explicitly and de-duplicate by location:
- The **Data** tab becomes the single home for request data: Backup export/import plus a "Request history" card.
- General's "Data Management" card is removed. Restart Tour stays in General as a "Help" row (button "Restart tour").
- Relay tab keeps its own action for Relay conversations only.

Labels and dialog copy (en; every string distinct):

| Location | Row label | Button | Dialog title | Dialog body | Confirm button |
|---|---|---|---|---|---|
| Data tab | Request history | Clear request history | Clear request history? | This permanently deletes every entry in your request history on this device. Saved requests, collections and environments are not affected. This cannot be undone. | Clear request history |
| Relay tab | Relay conversations | Clear Relay conversations | Clear Relay conversations? | This permanently deletes every Relay conversation and the changes recorded with it on this device. Your requests, collections and environments are not affected. This cannot be undone. | Clear Relay conversations |

Test ids stay (`clear-history-btn`, `confirm-clear-history-btn`, `relay-clear-history-btn`, `relay-clear-history-confirm`).

## Decision 3: New settings design (FR-21)

1. **Ask before closing unsaved tabs**: boolean `confirmCloseUnsavedTabs`, default `true` (today's behavior), General "Tabs" card. `useCloseTabGuard` skips the prompt only when `false`, for single, others and all closes. Persisted-shape change: ASK FIRST in T3.6; load merges defaults so legacy state works.
2. **Reduced motion**: `reducedMotion: "system" | "on" | "off"`, default `system`, Appearance card with a three-option Select. Extend existing `useReducedMotion` (same signature) to combine the OS media query with the override and set `data-reduced-motion="on|off"` on `<html>`; `globals.css` respects it. System sets no attribute.
3. **Third setting: none added** (see T3.8 line below). No UI-only setting beyond these has a justified user need; timeout, follow-redirects and send-on-enter stay excluded.

Third setting: none added.

## Decision 4 inputs: copy list (FR-22)

Rules: sentence case, label plus one-line description, no vendor names, all strings in `messages/{en,fr,ja}/settings.json`.

- General: Language (row: "Language" / "Display language for the app."), Features, Chain execution, Tabs ("Ask before closing unsaved tabs" / "Show a confirmation before closing a tab with unsaved changes."), Help ("Restart tour" / "Replay the product tour.").
- Appearance: "Theme", "Accent color" (move hardcoded heading to messages), "Reduce motion" ("Follow system" / "Always reduce" / "Never reduce"; description "Limit animations. Follow system uses your OS setting.").
- Request defaults: "Base URL", "Default headers" (existing text trimmed to: "Added to every request. A header set on the request itself wins.").
- Proxy & SSL, Shortcuts, Data, Relay: labels and descriptions only; Relay behavior untouched.
- Shortcuts: two-column grid with a named breakpoint constant.

## Final tab set

General (includes Language), Request defaults (id `global`), Appearance, Proxy & SSL, Shortcuts, Data, Relay (only when Relay is enabled). Language tab removed; `#language` and a persisted `language` section value resolve to General.
