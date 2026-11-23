# Chain blocks

The chain canvas is built from eleven block types, grouped by role. Shortcuts for the canvas are in [`SHORTCUTS.md`](SHORTCUTS.md).

**Primitives**

- **HTTP Request** (`api`) — create and send an HTTP request
- **Start** (`start`) — define the inputs this chain accepts

**Logic**

- **Condition** (`condition`) — branch data based on an expression
- **Delay** (`delay`) — wait for a specified amount of time
- **Display** (`display`) — extract and pass data from a source response
- **Evaluate** (`evaluate`) — run custom JavaScript against upstream data
- **Validate** (`validate`) — validate a response against a JSON Schema
- **Merge** (`merge`) — join parallel branches back into one path
- **Loop** (`loop`) — iterate over an array from an upstream response
- **Collect** (`collect`) — gather iteration results into an array
- **Sub-chain** (`subchain`) — run another chain and bind its inputs

Add any block from the canvas block menu (`⌘/Ctrl`+`Shift`+`K` or `/`), or drag a connection off an existing node's handle.

## Canvas workflow

- **Add blocks** — right-click the empty pane, use the block menu, or drag a connection off a handle and drop it on empty space to add and connect a block in one step.
- **Add API dialog** — search requests (all words must match), filter by method, select several requests at once, and add them in one undoable step. Create a **New request** from a blank draft or a pasted cURL command without leaving the dialog.
- **Select and move** — left-drag the pane to draw a marquee selection; middle-drag pans. Arrow keys nudge the selection by one grid step (`Shift` + arrow moves ten); a quick burst of presses is a single undo entry. Nudge works only while the canvas has focus.
- **Snap to grid** — toggle snapping from the canvas controls; the choice persists across reloads.
- **Align and distribute** — pick two or more nodes to align them from the selection menu; distribute needs three or more.
- **Find and fit** — `⌘/Ctrl`+`F` opens Find node while the canvas has focus (the browser's own find is untouched elsewhere). `F` fits the selection when nodes are selected, otherwise everything.
- **Clear all nodes** — available from the header overflow menu and fully undoable, alongside Clear edges.
- **Run Log** — a collapsible dock that lists runs, a filterable step timeline and a response/error detail pane; columns and height are resizable and persist.
- **Footer tips** — contextual hints can be hidden with "Hide tips" and restored from the `?` overlay. Unresolved-variable warnings always stay visible.
