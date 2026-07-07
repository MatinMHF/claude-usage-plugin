// Reader/writer for the official Claude Code statusline `rate_limits` capture.
//
// Claude Code (v2.1.80+, Pro/Max) pipes a session JSON to the command registered
// as its `statusLine` hook on stdin; that JSON carries `rate_limits.{five_hour,
// seven_day}` with an official `used_percentage` (0-100) and `resets_at` (Unix
// epoch seconds). `capture-statusline.js` captures that block to
// `~/.usage-guardian-mcp/statusline-latest.json`; this module reads it back.
//
// No network calls anywhere in this file. This is what lets claude-usage-plugin
// avoid the Cloudflare bot-check that blocks scraping claude.ai directly (see
// README) — the data comes from Claude Code itself, not from the website.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

// How long a capture stays "fresh". Claude Code refreshes the statusline
// frequently while a session is active; if the capture is older than this,
// no session has driven a refresh recently and the numbers may lag.
export const OFFICIAL_TTL_SECONDS = 600;

export function defaultStatuslinePath() {
  return path.join(homedir(), ".usage-guardian-mcp", "statusline-latest.json");
}

// Coerce a finite real epoch to an integer, else null. JSON permits
// NaN/Infinity, which would otherwise poison comparisons.
function finiteInt(value) {
  if (typeof value === "boolean" || typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

// Sanitize an official used_percentage (0-100), guarding a known leak where
// used_percentage can carry the resets_at epoch instead of a real percentage.
function cleanPct(value) {
  if (typeof value === "boolean" || typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  if (value > 100) return value <= 101 ? 100 : null;
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readWindow(raw, nowEpoch) {
  if (!isPlainObject(raw)) return null;
  const epoch = finiteInt(raw.resets_at);
  let pct = cleanPct(raw.used_percentage);
  // At or past the reset time the window has rolled over: the captured
  // percentage is for an expired window and no longer reflects the live limit.
  if (epoch !== null && nowEpoch !== null && nowEpoch >= epoch) pct = null;
  return { used_percentage: pct, resets_at_epoch: epoch };
}

// Returns { five_hour, seven_day, captured_at_epoch, stale } or null if
// unavailable/unusable. Each window is { used_percentage, resets_at_epoch }
// or null when that window is absent.
export function readOfficialLimits(filePath = defaultStatuslinePath(), nowEpoch = Math.floor(Date.now() / 1000)) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
  if (!isPlainObject(payload)) return null;

  const rateLimits = payload.rate_limits;
  if (!isPlainObject(rateLimits)) return null;

  const captured = finiteInt(payload.captured_at_epoch);
  const stale = nowEpoch !== null && captured !== null && nowEpoch - captured > OFFICIAL_TTL_SECONDS;

  return {
    five_hour: readWindow(rateLimits.five_hour, nowEpoch),
    seven_day: readWindow(rateLimits.seven_day, nowEpoch),
    captured_at_epoch: captured,
    stale: Boolean(stale),
  };
}

// Persists the official rate_limits from a statusline stdin payload. Returns
// the written capture, or null when the payload has no rate_limits (free tier
// or older Claude Code) — but still writes a tombstone in that case so a plan
// downgrade clears any prior official data instead of serving it forever.
// Writes atomically (pid-unique temp + rename) so a concurrent reader never
// sees a half-written file.
export function captureStatusline(stdinPayload, filePath = defaultStatuslinePath(), nowEpoch = Math.floor(Date.now() / 1000)) {
  const payload = isPlainObject(stdinPayload) ? stdinPayload : {};
  const rateLimits = payload.rate_limits;
  const hasOfficial = isPlainObject(rateLimits) && Object.keys(rateLimits).length > 0;
  const capture = {
    captured_at_epoch: nowEpoch,
    rate_limits: hasOfficial ? rateLimits : null,
  };

  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(capture));
  renameSync(tmp, filePath);
  return hasOfficial ? capture : null;
}

// Renders the one-line status bar text Claude Code displays for this hook.
export function formatStatusline(stdinPayload, capture) {
  const parts = [];
  const model = isPlainObject(stdinPayload) ? stdinPayload.model : null;
  const name = isPlainObject(model) ? model.display_name : null;
  if (name) parts.push(String(name));

  const rateLimits = capture ? capture.rate_limits : null;
  if (isPlainObject(rateLimits)) {
    for (const [label, key] of [["5h", "five_hour"], ["7d", "seven_day"]]) {
      const w = rateLimits[key];
      const pct = isPlainObject(w) ? cleanPct(w.used_percentage) : null;
      if (pct !== null) parts.push(`${label} ${Math.round(pct)}%`);
    }
  }
  return parts.length ? parts.join(" \u00b7 ") : "claude-usage-plugin";
}

export function statuslineCaptureExists(filePath = defaultStatuslinePath()) {
  return existsSync(filePath);
}
