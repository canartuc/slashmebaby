# AI-Assisted Contributions

Short version: AI assistance is welcome here, with disclosure. AI-generated code that you can't explain or didn't test is not.

## Context

This project itself was largely built with AI coding agents (Claude Code) under human direction. Using AI to write code for SlashMeBaby is normal, and you will not be treated differently for disclosing it. What matters is that a human who understands the change stands behind it.

## Rules for pull requests

1. **Disclose it.** If AI tools helped produce the change, say so in the PR description: which tools, and roughly what they did (e.g. "Claude Code wrote the first draft of the cache logic and its tests; I reworked the eviction path by hand"). The PR template has a checkbox for this.
2. **Understand every line you submit.** You must be able to explain and defend any part of the diff in review. Reviewers may ask comprehension questions ("why does this guard check the length before parsing?") and expect real answers.
3. **Run the gates yourself.** Type-check, lint, unit tests, e2e tests, coverage, all locally, before opening the PR (see [CONTRIBUTING.md](CONTRIBUTING.md)). "The agent said the tests pass" doesn't count.

PRs that fail these (code the contributor can't explain, or clearly never ran) get closed. Fully autonomous "drive-by" AI PRs, where no human has read or understood the change, are rejected regardless of whether the code happens to work.

## Licensing and copyright

You, the human contributor, own the responsibility for what you submit. By opening a PR you assert that the contribution can be licensed under this project's MIT license: no pasted proprietary code and no output you know reproduces incompatibly-licensed material. "An AI generated it" does not shift that responsibility anywhere.

## Issues and bug reports

Same rule. If an AI tool drafted your bug report, reproduce the bug yourself before filing it. AI-hallucinated bug reports and speculative "vulnerability" reports waste more time than they save, and will be closed without much ceremony.
