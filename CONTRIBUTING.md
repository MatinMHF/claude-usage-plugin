# Contributing

Thanks for your interest in this project. It is deliberately small — a
Claude Code plugin that reports your account's official 5-hour and weekly
usage through two zero-argument MCP tools, with no network calls of its own.
Contributions are welcome as long as they keep it that way.

## Guiding principles

- **Stay minimal.** A handful of readable files beats a framework. If a
  change adds a dependency, explain in the PR why a few lines wouldn't do.
- **No network calls.** The plugin reports numbers Claude Code already has
  locally. Anything that phones home is out of scope.
- **No telemetry, no usage data leaving the machine.** Same reason.

## Reporting bugs and requesting features

Open an issue using the templates. For bugs, the most useful details are your
OS, Node.js version, Claude Code version, and what the plugin reported versus
what you expected.

Please do not report security vulnerabilities in a public issue — see
[SECURITY.md](SECURITY.md).

## Making a change

1. Fork the repository and create a branch off `main`.
2. Make your change. Match the surrounding style: plain modern JavaScript,
   no build step, no transpiler.
3. Test it against a real Claude Code install — register the plugin, invoke
   both tools, and confirm the reported figures match what Claude Code shows.
   There is no automated test suite, so say what you ran in the PR.
4. Update the README (and `README.fa.md`, if you can) when behavior changes.
5. Open a pull request using the template.

## Commit messages

A short imperative subject line, and a body explaining *why* when the reason
isn't obvious from the diff.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you agree to abide by it.
