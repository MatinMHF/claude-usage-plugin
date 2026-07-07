#!/usr/bin/env node
// PostToolUse hook. Claude Code runs this AFTER every tool call (wired with
// matcher "*") — file reads, writes, shell commands, sub-agent spawns, and
// anything else Claude executes. Its only job is to report the current Claude
// account usage: it reads the official rate_limits capture the statusLine keeps
// fresh (official.js) and hands Claude a short usage line as additional context.
//
// It applies NO restrictions and blocks nothing — it always exits 0 and never
// throws, so it can't disrupt a session. It just makes Claude aware of the
// 5-hour and weekly usage after each operation.
import { readOfficialLimits, statuslineCaptureExists } from "./official.js";

function done(context) {
  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: context,
        },
      })
    );
  }
  process.exit(0);
}

async function main() {
  // Drain stdin (PostToolUse sends a JSON payload, sometimes large) so we never
  // block the parent; we don't need its contents.
  process.stdin.setEncoding("utf8");
  for await (const _chunk of process.stdin) {
    /* discard */
  }

  if (!statuslineCaptureExists()) return done(null);
  const limits = readOfficialLimits();
  if (!limits) return done(null);

  const p5 = limits.five_hour?.used_percentage;
  const p7 = limits.seven_day?.used_percentage;
  if (typeof p5 !== "number" && typeof p7 !== "number") return done(null);

  const parts = [];
  if (typeof p5 === "number") parts.push(`5h ${Math.round(p5)}%`);
  if (typeof p7 === "number") parts.push(`7d ${Math.round(p7)}%`);
  const suffix = limits.stale ? " (stale)" : "";
  return done(`Claude usage \u2014 ${parts.join(" \u00b7 ")}${suffix}`);
}

main().catch(() => process.exit(0));
