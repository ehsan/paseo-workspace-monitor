# Workspace drawer

Monitor top-level agents and terminals from an existing workspace in Paseo's right Explorer drawer while keeping a different workspace open in the main area.

Press ⌘K and choose **Open Workspace Monitor in right drawer**, or choose **Workspace Monitor** from the Explorer's plus menu. Search for a workspace, select it, and choose an agent or terminal. Children of a parent in the same workspace are excluded from this bar; cross-workspace handoffs remain visible. Agent views show conversation history, follow live updates, and send messages to that existing agent. Use **Load earlier messages** for older history and **Switch workspace** to change the target.

The picker separates pinned workspaces and groups the rest under collapsible project headings. The current workspace stays in its normal position with a highlighted, disabled row; it cannot be opened in the monitor. It shows workspace labels and animates working indicators. Desktop and browser clients read Paseo's saved project/workspace order without modifying it, updating while the picker is open. This uses Paseo 0.11.1's app-local storage format; mobile or unavailable storage falls back to alphabetical project/workspace order and most-recently-pinned first. Search expands matching project sections.

Project rows and their workspaces share the same left alignment. Each project initially shows 20 workspaces; **Show more** reveals the remainder and **Show less** restores the limit. Search shows all matching workspaces without truncation. Hovering a project header reveals its collapse chevron in place of the icon; the Pinned header reveals a chevron after its label.

On desktop/browser, working rings and visible label badges borrow their colors from the rendered left sidebar. Labels not currently rendered there use neutral theme colors. This read-only integration depends on Paseo's sidebar storage keys and UI selectors until an official sidebar API is available.

Pinned is collapsible and its rows show the project initial icon from the visible native sidebar. Associated PRs show their number, merged/closed state, and passed/failed/running check summary when the workspace supplies it. Working badges use Paseo's dot, faint track, rotating quarter-arc, and 900 ms period.

The picker matches the native sidebar's row spacing, typography, surface color, and project icons where available. Agent tabs, active activity summaries, and pending checks share the animated working ring. User messages use right-aligned rounded bubbles without author/time headers; assistant replies and collapsible activity summaries sit directly on the chat surface.

Picker titles are 14 px with a 20 px line height; metadata and section labels are 12 px. Workspace rows are 36 px without metadata and 52 px with metadata, separated by 2 px. Project headers are 40 px with a 4 px gap below; expanded groups add 12 px below their list. Labels share the metadata line and use 6 px horizontal padding with a leading optical offset.

Terminal views are read-only snapshots of the latest 500 lines, refreshed every second. **Pause** stops automatic output refresh; **Resume** continues it. **Jump to latest** returns to the bottom after scrolling back. The terminal list refreshes every two seconds. Input and commands stay in the main workspace, available through **Open workspace**.

Requires Paseo 0.11.1 or later on the daemon and client. No tokens or external services are configured by this plugin. It uses the selected host's existing Paseo connection to read workspace and agent metadata, list terminals, capture terminal output, fetch conversation history, and send your messages. Sending a message runs the selected agent with its existing provider and permissions.

Assistant replies render Markdown headings, lists, emphasis, links, tables, and code blocks with a Copy action. Consecutive tool calls and thinking collapse into activity summaries. Expand a summary and an action to inspect its output, or choose **View raw data** for the original payload. **Activity off** hides routine activity while preserving failures. **Jump to latest** returns to the newest messages after scrolling back.

Finished action groups use a neutral completed count, including when a tool failed. Failed tool calls appear red inside the expanded group. A completed count means the actions finished, not that every action succeeded.

The bar lists available top-level agents and workspace terminals, not the app's exact open tabs or their order. Files, browser tabs, and other native tab types are not listed. This is a custom monitor, not the native workspace UI. Changes remains available as another Explorer tab; the plugin cannot remove the built-in tab. Images appear as text descriptions rather than loaded remote content; HTML is displayed as text. Permission requests must be reviewed using **Open in main**. Workspace and selected monitor items are remembered for the current app session and reset when the plugin reloads or the app restarts.
