**English** | [فارسی](README.fa.md)

# claude-usage-plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![Version](https://img.shields.io/badge/version-2.1.0-blue)](package.json)

A **Claude Code plugin** with one job: report your Claude account's **5-hour**
and **weekly** usage — the **official** numbers Claude Code itself shows in its
status bar, not an estimate. It applies **no restrictions**. There is no
threshold, no deny logic, nothing is ever blocked. It only reads and reports.

## Table of Contents

- [How it works](#how-it-works)
- [Tools](#tools)
  - [check\_usage](#check_usage)
  - [check\_data\_status](#check_data_status)
- [Requirements](#requirements)
- [Install](#install)
  - [One-time statusLine setup](#one-time-statusline-setup-required-for-the-official-numbers)
  - [Optional: PostToolUse hook](#optional-posttooluse-hook)
- [Design notes](#design-notes)
- [License](#license)

## How it works

Claude Code (v2.1.80+, Pro/Max) pipes a JSON payload containing
`rate_limits.{five_hour,seven_day}` — each with an official `used_percentage`
and `resets_at` — to whatever command is registered as its **statusLine** hook,
on every status-bar render. This plugin has three components:

- **`capture-statusline.js`** — the statusLine hook. On each render it stashes
  the official `rate_limits` to `~/.usage-guardian-mcp/statusline-latest.json`
  and prints the status line (e.g. `Opus 4.8 · 5h 86% · 7d 80%`). No network
  calls, never throws, never blanks your status bar.
- **`index.js`** — the MCP server. It reads that capture back and exposes it as
  two zero-argument tools.
- **`usage-hook.js`** — an optional PostToolUse hook. Runs after every tool
  call and injects a short usage summary into Claude's context.

No network calls, no session cookies, no scraping — the data comes from Claude
Code itself.

> **Why the statusLine and not a timer?** The official `rate_limits` are only
> delivered to a statusLine command. A background timer has no way to fetch
> them, so it could only ever *estimate* usage from local token counts. To match
> the number Claude Code shows, the plugin uses the statusLine. It refreshes on
> every render (sub-second while you're active) — more often than any polling
> interval would.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `check_usage` | none | `{"usage_percent": 86, "resets_at": "...", "seven_day_percent": 80, "seven_day_resets_at": "...", "stale": false}` — `usage_percent`/`resets_at` are the 5-hour window; `seven_day_*` are the weekly window. |
| `check_data_status` | none | `{"authenticated": true}` or `{"authenticated": false}` — is a capture available and fresh (updated within the last 10 minutes)? |

Structured errors instead of silent failures:

- `{"error": "statusline_not_configured"}` — the statusLine hook isn't wired up yet (see setup below).
- `{"error": "rate_limits_unavailable"}` — a capture exists but Claude Code isn't reporting `rate_limits` (requires v2.1.80+ on a Pro/Max plan).

### `check_usage`

Reads `~/.usage-guardian-mcp/statusline-latest.json` written by the statusLine
hook and returns a single JSON object:

```json
{
  "usage_percent": 86,
  "resets_at": "2025-07-07T18:00:00.000Z",
  "seven_day_percent": 80,
  "seven_day_resets_at": "2025-07-13T00:00:00.000Z",
  "stale": false
}
```

`stale: true` means the capture is older than 10 minutes — no active session
has refreshed it recently.

### `check_data_status`

A cheap readiness poll: returns `{"authenticated": true}` when a capture exists
and is fresh, `{"authenticated": false}` otherwise. Useful to run before
`check_usage` to avoid noisy errors.

## Requirements

- [Node.js](https://nodejs.org) 18 or later
- Claude Code v2.1.80+ on a **Pro or Max plan** (older versions / other plans
  don't include `rate_limits` in the statusLine payload)

## Install

```bash
# 1. Clone and install dependencies
git clone https://github.com/MatinMHF/claude-usage-plugin.git
cd claude-usage-plugin
npm install

# 2. Register the MCP server with Claude Code
claude mcp add claude-usage-plugin -s user -- node /path/to/claude-usage-plugin/index.js
```

Or add it manually to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "claude-usage-plugin": {
      "command": "node",
      "args": ["/path/to/claude-usage-plugin/index.js"]
    }
  }
}
```

### One-time statusLine setup (required for the official numbers)

The MCP server only *reads* the capture; the statusLine hook keeps it fresh.
Because Claude Code feeds official `rate_limits` only to a statusLine command —
and statusLine isn't a plugin-contributed component — add this once to your
`~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/path/to/claude-usage-plugin/capture-statusline.js\""
  }
}
```

> **Windows users:** use **forward slashes** in the path —
> `C:/Users/you/claude-usage-plugin/capture-statusline.js` — Claude Code
> parses this string with POSIX-style word-splitting where backslashes get
> mangled.

**Already using a statusLine?** Don't replace it — chain stdin to both commands,
or fold the `captureStatusline()` call from `official.js` into your existing
script.

Restart Claude Code, send one message so the hook fires, then `check_usage`
reports your live official numbers.

### Optional: PostToolUse hook

`usage-hook.js` is a PostToolUse hook that injects a short usage line
(`Claude usage — 5h 86% · 7d 80%`) into Claude's context after every tool
call. To enable it, add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/path/to/claude-usage-plugin/usage-hook.js\""
          }
        ]
      }
    ]
  }
}
```

This hook applies **no restrictions** and never blocks a tool call — it always
exits 0. It is purely informational.

## Design notes

- **Official, not estimated.** The numbers are Claude Code's own `rate_limits`,
  the same data that appears in the status bar.
- **No restrictions.** The plugin only records and reports — no thresholds, no
  blocks, no side effects.
- **Minimal tokens.** Two zero-argument tools returning compact JSON; the
  statusLine hook is harness-only and adds nothing to the model's context.
- **No network calls.** `index.js` only reads a local JSON file. No cookies,
  no scraping, no Cloudflare challenges.
- **Atomic writes.** The capture is written to a pid-unique temp file and
  renamed into place, so a concurrent read never sees a half-written file.
- **Never blanks the status bar.** Capture and formatting failures are
  swallowed silently inside `capture-statusline.js`.

## License

[MIT](LICENSE)
