<p align="center">
  <b>English</b> | <a href="README.fa.md">فارسی</a>
</p>

# claude-usage-plugin

A minimal [Claude Code](https://claude.com/claude-code) plugin with one job:
report your Claude account's **5-hour** and **weekly** usage — the **official**
numbers Claude Code itself shows, not an estimate.

It **applies no restrictions**. There is no threshold, no deny logic, and
nothing is ever blocked. The plugin only reads and reports, over two
zero-argument [MCP](https://modelcontextprotocol.io) tools. No network calls,
no session cookies, no scraping — the data comes from Claude Code itself.

## Table of Contents

- [Why this exists](#why-this-exists)
- [How it works](#how-it-works)
- [Tools](#tools)
  - [check\_usage](#check_usage)
  - [check\_data\_status](#check_data_status)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Install the plugin](#install-the-plugin)
  - [Configure the statusLine hook](#configure-the-statusline-hook)
- [Usage](#usage)
  - [Example session](#example-session)
- [Design notes](#design-notes)
- [Contributing](#contributing)
- [License](#license)

## Why this exists

Claude Code already knows your exact rate-limit usage, but it only paints it
onto the status bar — there's no built-in way for the model, or you, to *query*
it. `claude-usage-plugin` is for cases where you want to ask, mid-session, "how
much of my 5-hour and weekly windows have I burned?" and get back the same
official number the status bar shows:

- the **5-hour** window's used percentage and reset time,
- the **weekly** (7-day) window's used percentage and reset time,

using nothing but data Claude Code already hands out — no API keys, no scraping,
no estimation from local token counts.

## How it works

Claude Code (v2.1.80+, Pro/Max) pipes a JSON payload containing
`rate_limits.{five_hour,seven_day}` — each with an official `used_percentage`
and `resets_at` — to whatever command is registered as its **statusLine** hook,
on every status-bar render. This plugin splits that into a writer and a reader:

- **`capture-statusline.js`** — the statusLine hook. On each render it stashes
  the official `rate_limits` to `~/.usage-guardian-mcp/statusline-latest.json`
  and prints the status line (e.g. `Opus 4.8 · 5h 86% · 7d 80%`). No network,
  never throws, never blanks your status bar.
- **`index.js`** — the MCP server. It reads that capture back and exposes it as
  two zero-argument tools.

> **Why the statusLine and not a timer?** The official `rate_limits` are only
> delivered to a statusLine command. A background timer has no way to fetch
> them, so it could only ever *estimate* usage from local token counts. To match
> the number Claude Code shows, the plugin piggybacks on the statusLine — which
> refreshes on every render (sub-second while you're active), more often than a
> 10-second poll would.

## Tools

| Tool | Input | Destructive? |
| --- | --- | --- |
| `check_usage` | none | No |
| `check_data_status` | none | No |

### `check_usage`

No input. Returns the current usage as text:

```json
{
  "usage_percent": 86,
  "resets_at": "2026-07-06T18:00:00.000Z",
  "seven_day_percent": 80,
  "seven_day_resets_at": "2026-07-11T00:00:00.000Z",
  "stale": false
}
```

`usage_percent` / `resets_at` are the **5-hour** window; `seven_day_*` are the
**weekly** window. `stale` is `true` when the capture is older than 10 minutes.

Instead of failing silently, it returns structured errors:

- `{"error": "statusline_not_configured"}` — the statusLine hook isn't wired up
  yet (see [Configure the statusLine hook](#configure-the-statusline-hook)).
- `{"error": "rate_limits_unavailable"}` — a capture exists but Claude Code
  isn't reporting `rate_limits` (needs v2.1.80+ on a Pro/Max plan).

### `check_data_status`

No input. Returns `{"authenticated": true}` when a capture is available and
fresh (updated within the last 10 minutes), or `{"authenticated": false}`
otherwise. Useful as a quick liveness check before calling `check_usage`.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Claude Code](https://claude.com/claude-code) v2.1.80+ on a **Pro** or **Max**
  plan — older versions and other plans don't include `rate_limits` in the
  statusLine payload

### Install the plugin

```bash
git clone https://github.com/MatinMHF/claude-usage-plugin.git
cd claude-usage-plugin
npm install
```

Then register it with Claude Code as a local marketplace and install it:

```bash
claude plugin marketplace add /path/to/claude-usage-plugin
claude plugin install claude-usage-plugin@claude-usage-plugin-local
```

### Configure the statusLine hook

The MCP server only *reads* the capture; the statusLine hook is what keeps it
fresh. Because Claude Code feeds official `rate_limits` only to a statusLine
command — and statusLine isn't a plugin-contributed component — add this once to
your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"C:/path/to/claude-usage-plugin/capture-statusline.js\""
  }
}
```

Use **forward slashes** in the path on Windows — Claude Code parses this string
with POSIX-style word-splitting, where backslashes get mangled.

> **Already using a statusLine?** Don't replace it — chain stdin to both
> commands, or fold the `captureStatusline()` call from `official.js` into your
> existing script.

Restart Claude Code, send one message so the hook fires, then `check_usage`
reports your live official numbers.

## Usage

### Example session

A typical session once the plugin is installed and the statusLine hook is wired
up:

1. **"Is my usage data available yet?"** → calls `check_data_status`, returns
   `{"authenticated": true}` once the hook has fired at least once
2. **"How much of my usage have I burned?"** → calls `check_usage`, returns the
   5-hour and weekly percentages plus their reset times

Because there are no arguments and no restrictions, that's the whole surface:
ask, and the plugin reports.

## Design notes

- **Official, not estimated.** The numbers are Claude Code's own `rate_limits`.
- **No restrictions.** The plugin only records and reports — nothing is blocked.
- **Minimal tokens.** Two zero-argument tools returning text; the statusLine
  hook is harness-only and adds nothing to the model's context.
- **No network calls.** `index.js` only reads a local JSON file.
- **Atomic writes.** The capture is written to a pid-unique temp file and
  renamed into place, so a concurrent read never sees a half-written file.
- **Never blanks the status bar.** Capture and formatting failures are
  swallowed, so the hook can't break your prompt.

## Contributing

Issues and pull requests are welcome. This project is small on purpose — keep
changes minimal and dependency-light, and preserve the "read and report, never
restrict" contract.

## License

MIT
