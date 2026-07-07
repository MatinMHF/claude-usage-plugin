#!/usr/bin/env node
// The statusLine hook itself. Claude Code invokes this command on every
// render (sub-second while a session is active) and pipes a session JSON to
// its stdin. We stash the official `rate_limits` block for the MCP server to
// read back later, and print the line Claude Code displays as the status bar.
//
// Wire it up in Claude Code's settings.json:
//   "statusLine": {
//     "type": "command",
//     "command": "node /path/to/claude-usage-plugin/capture-statusline.js"
//   }
//
// Must be fast and never throw — a crash here would blank the user's status
// bar, and if the user already has a statusLine command they like, chain to
// it instead of replacing it (see README).
import { captureStatusline, formatStatusline } from "./official.js";

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  payload = {};
}

let capture = null;
try {
  capture = captureStatusline(payload);
} catch {
  // A capture write failure must not blank the status bar.
}

let line = "claude-usage-plugin";
try {
  line = formatStatusline(payload, capture);
} catch {
  // Never let a formatting edge case blank the bar either.
}
process.stdout.write(line);
