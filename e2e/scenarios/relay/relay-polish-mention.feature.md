# Relay Polish: Mention Menu

Tests for the @ (mention) menu in the Relay composer, covering opening/closing, filtering, selection, keyboard navigation, and network isolation.

## Scenario: [REL-POL-MENTION-01] @ at the start and after a space opens the menu; mid-word a@b does not

Typing @ at the beginning of the input or after a space opens the mention menu.
Typing @ mid-word (e.g., `a@b`) does not open the menu.

## Scenario: [REL-POL-MENTION-02] Current tab is first with the tab name and breadcrumb; with no tab open it is disabled with "No tab open"

When a tab is open, the current tab row appears first with its name and breadcrumb.
When no tab is open, the row is disabled and shows "No tab open".

## Scenario: [REL-POL-MENTION-03] typing "get" narrows rows; Arrow keys plus Enter or Tab select

Typing filters the mention results. Arrow Down/Up navigates the rows.
Pressing Enter or Tab selects the active row.

## Scenario: [REL-POL-MENTION-04] Esc closes the menu and leaves the typed text

Pressing Escape closes the mention menu. The typed text before @ and after @ (if typed) remains.

## Scenario: [REL-POL-MENTION-05] selecting a request inserts "@Name " and one pill; selecting it again adds no second pill

Selecting a request inserts `@<RequestName> ` and creates a composer pill.
Selecting the same request again (if opened) does not create a second pill.

## Scenario: [REL-POL-MENTION-06] after Send the /api/relay/chat body contains that request's description

After sending a message with a mentioned request, the request (kind, id, label) is carried as the user message's `metadata.attachments` in the POST body sent to `/api/relay/chat`; `context.chips` stays empty.

## Scenario: [REL-POL-MENTION-07] deleting the token text does not detach the pill; the pill X strips the token

Deleting the `@Name` text does not remove the pill. Clicking the X on the pill removes it.

## Scenario: [REL-POL-MENTION-08] the menu is as wide as the composer box at 320, 400 and 480px and never overflows the viewport

At viewport widths 320px, 400px, and 480px, the mention menu does not overflow the viewport and matches the composer width.

## Scenario: [REL-POL-MENTION-09] opening, typing, filtering and selecting produce zero /api/relay/* or other-host requests until Send

Network monitoring confirms no network calls to `/api/relay/*` or other hosts are made while opening, typing, filtering, or selecting—only on Send.

## Scenario: [REL-POL-MENTION-10] opening the slash menu closes the mention menu and the reverse

Opening the slash menu (`/`) closes a visible mention menu.
Opening the mention menu (`@`) closes a visible slash menu.

## Scenario: [REL-POL-MENTION-11] with 200 seeded requests only a window of rows is in the DOM and the list scrolls through them with no truncation footer

With 200+ seeded requests, virtualization keeps only a window of rows in the DOM.
There is no truncation footer; scrolling the list swaps in later rows while the DOM stays windowed.

## Scenario: [REL-POL-MENTION-12] a query with no match shows the no-results row

When typing a query that matches no requests, a no-results row is shown.

## Scenario: [REL-POL-MENTION-13] the menu is role=listbox, the textarea keeps focus and aria-activedescendant follows the active row

The menu has role=listbox. The textarea retains focus while the menu is open.
The textarea's aria-activedescendant attribute follows the active row id.

## Scenario: [REL-POL-MENTION-14] attaching writes names and ids only to rq_relay_recent and survives a reload

Mentioning a request records its name and id in `rq_relay_recent` (IndexedDB).
This persists after a reload.
