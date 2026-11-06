---
name: code-review
description: Review rules for this repository. Use when reviewing a pull request, above all when the diff adds or widens a suppression for one of the code quality gates.
---

# Code review

`bun run check` is the gate: biome, tsc, the tests, the web build, clippy, fallow.

## Every new suppression states its reason

Flag any added or widened suppression that does not say why, in the diff itself.

| tool | what counts as a suppression |
| --- | --- |
| biome | `biome-ignore`, a `!` entry under `files.includes`, a rule set to `off` or `warn` |
| tsc | `@ts-expect-error`, `@ts-ignore`, a loosened compiler option |
| clippy | `#[allow(...)]`, `#![allow(...)]` |
| fallow | `ignorePatterns`, `overrides`, `health.ignore`, `thresholdOverrides`, `duplicates.ignore`, `ignoreDependencies` |

A reason is a comment on the suppression, or the schema's own `reason` field where it has one, and it says why the rule is wrong about this code. That the check failed is not a reason. Vendored or generated code is a reason only when the diff says where the code came from.

Ask for the narrowest scope that works: one line over one file, one file over a directory glob, a named rule over a blanket off.
