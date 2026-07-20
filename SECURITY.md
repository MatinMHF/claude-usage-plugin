# Security Policy

## Supported Versions

This project is small and does not maintain multiple release branches.
Security fixes are applied to the latest version only.

| Version | Supported |
| --- | --- |
| latest (`main`) | ✅ |
| older releases | ❌ |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for a security vulnerability.

Report it privately by [opening a draft security
advisory](../../security/advisories/new) on this repository. That report is
visible only to the maintainer. Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (a minimal repro is very helpful)
- Any suggested mitigation, if you have one

You should receive an acknowledgment within a few days. Once a fix is
available, we'll coordinate on disclosure timing with you before any public
write-up.

## Scope and known considerations

This plugin runs locally inside Claude Code and reports usage figures that
Claude Code already holds. Things worth knowing:

- It makes **no network calls** of its own. If you find it sending data
  anywhere, that is a vulnerability — please report it.
- It reads local Claude Code state to produce its figures. Anything that
  causes it to read or expose more than the usage numbers it documents is in
  scope.
- Its MCP tools take no arguments, so there is no user-supplied input to
  inject through. A way to make either tool act on attacker-controlled input
  would be in scope.

Usage figures themselves are not secret, but they are yours — a way to make
this plugin leak them off the machine is worth reporting.
