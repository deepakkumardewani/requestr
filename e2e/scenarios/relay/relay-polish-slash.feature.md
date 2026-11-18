# Relay Polish: Slash actions

Tests for the `/` slash command menu, target-aware mention flow, clear confirm, filtering, keyboard/a11y, and localized descriptions and prompts.

## Scenario: [REL-POL-SLASH-01] typing / lists 15 commands in the six groups Understand, Build, Test, Run, Share, Chat in order

Typing `/` opens the slash menu with all 15 commands grouped and ordered per the product spec.

## Scenario: [REL-POL-SLASH-02] typing /ru shows only /run; typing a word from a description also filters

Prefix filtering narrows to matching command ids; description text also matches (e.g. a word from a command description).

## Scenario: [REL-POL-SLASH-03] /run with nothing attached opens the mention menu with the hint "Pick a request to run" and Current tab pinned

Selecting `/run` without a request attached opens the mention menu, shows the run hint, and pins the Current tab section.

## Scenario: [REL-POL-SLASH-04] picking Current tab attaches a pill, leaves /run ready, and sends nothing

Picking the current tab from the slash-driven mention menu attaches a pill, keeps `/run` in the composer, and does not POST to chat.

## Scenario: [REL-POL-SLASH-05] /run with a request already attached inserts the command pill without opening the menu

With a request already attached, selecting `/run` fills the run prompt and does not open the mention menu.

## Scenario: [REL-POL-SLASH-06] /clear and /import never open the mention menu

Selecting `/clear` or `/import` never opens the mention menu (confirm or filled prompt instead).

## Scenario: [REL-POL-SLASH-07] /clear on a non-empty chat shows the confirm and clearing resets the thread

On a thread with messages, `/clear` shows the confirm dialog; confirming clears visible messages.

## Scenario: [REL-POL-SLASH-08] the grouped menu has no horizontal scroll at 320px and keyboard navigation keeps focus in the textarea

At 320px dock width the slash menu does not scroll horizontally; Arrow keys navigate while focus stays in the composer textarea.

## Scenario: [REL-POL-SLASH-09] selecting /new inserts a command pill whose promptKey text is sent and a scripted ask_user reply asks which collection

Selecting `/new` fills the new-request prompt; sending yields a scripted `ask_user` about which collection to use.

## Scenario: [REL-POL-SLASH-10] slash descriptions and prompts render in fr and ja

Slash command descriptions in the menu and filled prompts after selection use French and Japanese translations when the app locale is fr or ja.
