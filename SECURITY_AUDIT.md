# Security verification snapshot — 2026-10-06

Branch: `codex/security-performance`. This is a partial local assessment, not a completed penetration test or a security certification. Production and the remote Supabase schema were not modified.

## Dependency findings

`npm audit --omit=dev --json` reported no known production dependency advisories. This does not establish that application code is vulnerability-free.

The full audit initially reported seven affected packages: five high and two moderate. The moderate advisory [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) affects `postcss-selector-parser` before 7.1.6. An exact npm override now selects the patched 7.1.6 for Tailwind and `postcss-nested`. Tailwind remains on version 3; the lockfile changes only the parser package.

Before/after production builds generated the same nine files with identical SHA-256 hashes, including CSS and JavaScript. The full regression suite also passed after this change.

**Open:** five high audit entries remain (`braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss`). These are propagation through the development dependency tree of [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), not five independently reproduced application exploits. The advisory lists no patched `braces` version at this date. Deeply nested untrusted glob patterns can exhaust its stack. HarmoniGrid uses these packages for trusted source-file discovery during compilation; it does not pass account compositions to them. Keep untrusted glob patterns out of the build/watch pipeline. A dependency migration or upstream patch remains necessary to remove this residual dependency risk; do not use `npm audit fix --force` without checking the UI and build behavior.

## Local evidence

- `npm test`: editor, playback/theory contracts, history, preservation, FREE availability, account/project handling, OAuth helpers and 26,369 musical checks passed.
- `tests/security-boundaries.mjs`: 45 checks passed. Injection-like musical fields, prototype keys, circular/deep objects, oversized UTF-8 documents and excessive repeats are rejected before replacing editor state. International and literal text content remains intact. These tests do not execute a browser DOM or prove every HTML sink safe.
- PostgreSQL/PGlite fixtures: 27 ownership/RLS/revision checks, 18 quota/rate/rollback checks and 13 FREE measure-limit checks passed. They exercise migrations 001–004 locally, not deployed Supabase configuration or concurrent connections.
- `tests/strix-budget.mjs`: simulated requests verify cumulative reservations, output limits, fixed provider/model, streamed provider usage, restart persistence, incomplete-request handling and exclusion of credentials from receipts. No paid requests occur in these tests.

## Strix status and limitations

Strix 1.7.0 and the Docker sandbox were prepared on an isolated Colima profile. The target is a temporary source copy, excluding credentials, Git metadata, scan artifacts and personal documents. Only the host relay receives the real OpenAI key; the scanner receives a temporary local token. Production, Vercel, remote Supabase, Google, real accounts and denial-of-service testing are outside the scan scope.

The first scan received valid OpenAI responses but did not complete. Subsequent incomplete provider requests consumed conservative reservations and blocked another request within the user's US$5 authorization. The scan was interrupted; no Strix vulnerability finding has been confirmed. Do not infer safety from the empty findings file.

The relay reserves before dispatch, keeps reservations for uncertain/failed calls, and settles completed calls only from provider token usage. Its cumulative internal cutoff is US$4.90; Strix also has a US$4 estimated threshold. Neither the ledger nor Strix's estimate is an invoice. Do not delete/reset the ledger to retry. New runs stop on exhausted budget or unconfirmed consumption to prevent retry loops. Reconcile unresolved calls before deciding whether the scan can continue under the same authorization.

Outstanding: completed Strix assessment, real OAuth/accounts/device isolation, real-phone tests, concurrent backend load, remaining dependency risk and full pedagogical review. No new remote migration was introduced in this snapshot.
