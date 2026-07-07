#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { defaultStatuslinePath, readOfficialLimits, statuslineCaptureExists } from "./official.js";

// This server reports Claude Code's OFFICIAL account usage — the same
// rate_limits Claude Code shows in its status bar — read from a small local
// capture that the statusLine hook (capture-statusline.js) keeps fresh. No
// network calls, no estimation, no restrictions.
const STATUSLINE_PATH = defaultStatuslinePath();

function jsonResult(obj, isError = false) {
  const result = { content: [{ type: "text", text: JSON.stringify(obj) }] };
  if (isError) result.isError = true;
  return result;
}

function notConfiguredResult() {
  return jsonResult(
    {
      error: "statusline_not_configured",
      fix: "No official usage capture found. Register capture-statusline.js as the Claude Code statusLine hook (one-time setup — see README), then send at least one message so it captures data.",
    },
    true
  );
}

function rateLimitsUnavailableResult() {
  return jsonResult(
    {
      error: "rate_limits_unavailable",
      fix: "The statusLine hook is capturing, but Claude Code isn't reporting rate_limits. This requires Claude Code v2.1.80+ on a Pro/Max plan.",
    },
    true
  );
}

function toIso(epoch) {
  return epoch === null || epoch === undefined ? null : new Date(epoch * 1000).toISOString();
}

const server = new McpServer({
  name: "claude-usage-plugin",
  version: "2.1.0",
});

server.registerTool(
  "check_usage",
  {
    title: "Check Claude usage",
    description:
      "Read the current Claude account usage from Claude Code's own official rate_limits data, " +
      "captured locally via a statusLine hook (no network calls). Returns " +
      '{"usage_percent": <5h window %>, "resets_at": <ISO time>, "seven_day_percent": <%>, ' +
      '"seven_day_resets_at": <ISO time>, "stale": <bool>}. ' +
      "usage_percent/resets_at are the 5-hour window; seven_day_* are the weekly window. No arguments.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async () => {
    if (!statuslineCaptureExists(STATUSLINE_PATH)) return notConfiguredResult();
    const limits = readOfficialLimits(STATUSLINE_PATH);
    if (!limits) return notConfiguredResult();
    if (!limits.five_hour && !limits.seven_day) return rateLimitsUnavailableResult();

    return jsonResult({
      usage_percent: limits.five_hour?.used_percentage ?? null,
      resets_at: toIso(limits.five_hour?.resets_at_epoch),
      seven_day_percent: limits.seven_day?.used_percentage ?? null,
      seven_day_resets_at: toIso(limits.seven_day?.resets_at_epoch),
      stale: limits.stale,
    });
  }
);

server.registerTool(
  "check_data_status",
  {
    title: "Check usage data freshness",
    description:
      "Cheap poll: is official usage data available and fresh (captured within the last 10 minutes)? " +
      'Returns {"authenticated": true|false}. Use before check_usage. No arguments.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async () => {
    if (!statuslineCaptureExists(STATUSLINE_PATH)) return notConfiguredResult();
    const limits = readOfficialLimits(STATUSLINE_PATH);
    if (!limits || (!limits.five_hour && !limits.seven_day)) return jsonResult({ authenticated: false });
    return jsonResult({ authenticated: !limits.stale });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
