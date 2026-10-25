# ADR 0008: Release-please automation contract — bump targets, marker rule, PR-update rule, in-workflow assets

- Status: accepted (2026-10-25)
- Deciders: human + agent session
- Applies to: `release-please-config.json`, `.release-please-manifest.json`, `vite.config.ts` (userscript header), `.github/workflows/release-please.yml`, `.prettierignore`

## Context

The GitHub release pipeline (changelog + version bumps + `.user.js` release asset) is driven by
`googleapis/release-please-action@v4` with `release-type: simple`. Setting it up surfaced four
non-obvious engine behaviors, each confirmed against the release-please source or empirically:

1. **`simple` bumps neither `package.json` nor the userscript header.** The `simple` release type
   manages `.release-please-manifest.json` (and optionally `version.txt`) — nothing else.
2. **The `generic` extra-file updater is marker-based.** It only rewrites a version on lines
   containing `x-release-please-version` (inline, same line — verified empirically against
   `src/updaters/generic.ts` of release-please 17.3.0); it does not blind-replace old version
   strings anywhere in the file.
3. **Open release PRs are updated by changelog-body comparison only.** When the candidate PR
   body equals the existing PR body, release-please skips the branch update entirely
   (`manifest.ts:1100`, `maybeUpdateExistingPullRequest`) — even when the candidate's file
   changes differ. A `ci:`/`chore:` commit therefore never lands in an open release PR.
4. **Releases published by `release-please` (via `GITHUB_TOKEN`) do not trigger other
   workflows.** GitHub's recursion guard suppresses workflow runs for events created by
   `GITHUB_TOKEN` — a separate `on: release` asset workflow never fires for automated releases.

## Decision

1. **Bump targets are explicit extra-files**: `package.json` via a `json` updater with
   `jsonpath: "$.version"`, and `vite.config.ts` via the `generic` updater — the userscript
   header line carries an inline marker: `version: "1.1.0", // x-release-please-version`.
   The Generic updater is the single writer of that line; manual version edits only set the
   value, never remove the marker.
2. **Commits touching release-managed files use changelog-visible types (`feat`/`fix`).**
   `ci:`/`chore:`/`docs:` commits are invisible to the PR-body comparison and never update an
   open release PR. Version or marker changes riding on an invisible type silently miss the
   pending release (observed: PR #2 merged without the `vite.config.ts` bump).
3. **The release asset is built and attached inside the release-please workflow** (second job,
   gated on the `release_created`/`tag_name` outputs, `gh release upload` on the tag) — there
   is no separate `on: release` workflow.
4. **Release-please-owned files are excluded from the format gate**: `CHANGELOG.md` and
   `.release-please-manifest.json` are listed in `.prettierignore` — their formatting follows
   the release-please writer, not Prettier (`tabWidth: 4`).

**Rule of thumb:** the release-please PR body is the pipeline's change detector — if a commit
matters for a pending release, it must change the changelog.

## Consequences

**Positive:**

- One merge of the release PR yields a fully consistent release: tag, GitHub Release,
  changelog, `package.json`, userscript `@version`, and the attached `.user.js` all agree.
- The About tab (`GM_info.version`) always reports the real installed version — no manual
  sync between `vite.config.ts`, `package.json`, and the release.
- The format gate stays green on release PRs (bot-written files are ignored by design).

**Negative:**

- The marker comment must stay on the `version:` line of `vite.config.ts` — losing it silently
  breaks header bumps (the updater then matches nothing).
- The pipeline's PRs must not be merged while relevant `ci:`-typed commits are pending on
  main — either wait for the next release or type the commit `fix`/`feat`.
- `simple`-type versioning means the npm-style `package.json` version is a mirror, not the
  driver; the manifest file remains the release-please source of truth.

## References

- Config: `release-please-config.json` (extra-files: json updater + generic updater),
  `.release-please-manifest.json` (source of truth), `vite.config.ts` (marker line)
- Workflow: `.github/workflows/release-please.yml` (release-please job + `release-assets` job
  with `gh release upload`, gated on `release_created`)
- Format-gate exclusions: `.prettierignore` (`CHANGELOG.md`, `.release-please-manifest.json`)
- Engine evidence: release-please 17.3.0 `src/updaters/generic.ts` (marker regex),
  `src/strategies/base.ts` (`case 'generic'` → `Generic` updater), `src/manifest.ts:1100`
  (body-compare skip); GitHub docs on `GITHUB_TOKEN`-triggered events
- Prior ADR: [ADR 0005](0005-isdebugenabled-guard-over-unguarded-log-args.md) — the same
  "guard at the hot path" philosophy applied to logging
