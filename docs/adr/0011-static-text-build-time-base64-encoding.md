# ADR 0011: Build-time Base64 encoding for static text literals that must not surface as raw text

- Status: accepted (2026-10-31)
- Deciders: human + agent session
- Applies to: `vite.config.ts` (`__CHANGELOG_B64__` reference pattern), `src/lib/core/encoding.ts`,
  `src/lib/gui/about-changelog.ts`, `src/lib/gui/i18n.svelte.ts` (candidate),
  `docs/architecture/*`, `npm run test`, `npm run docs:check`
- Builds on: [ADR 0010](0010-about-tab-changelog-embedded-at-build-time.md)

## Context

`npm run build` produces a minified but still readable `.user.js`. Minification removes
whitespace and shortens identifiers, but leaves **string literals untouched**. As a
result, the output visibly contains:

- multi-line text with newline breaks (embedded Markdown, CSS templates, inline SVG
  paths built as template literals);
- single-line but text-dense blocks (translations, help text, error messages) that
  stand out in the compiled code and are trivially grep-able.

ADR 0010 solves this for `CHANGELOG.md` by reading the file at build time,
normalizing newlines, embedding it as a Vite `define` (`__CHANGELOG_B64__`) in
Base64, and decoding it at runtime with `atob` plus `TextDecoder`. Until now that
flow was coupled to the changelog parser: the decode step lived as `decodeChangelog`
in `src/lib/gui/about-changelog.ts`, even though its logic is fully generic.

A related, empirical pitfall observed on the Tampermonkey toolchain is that a plain
text embed is not "invisible" to users: anyone opening the installed `.user.js`
sees the whole raw block, including newlines, which is exactly the "dense code" look
the build is meant to avoid. Base64 keeps the bundle a single compact, non-readable
literal — a curious decoder can still recover it (Base64 is not confidentiality),
but casual inspection no longer surfaces the raw text.

The problem statement is therefore: there is no repository-wide contract stating
which static texts may remain as raw literals and which must be encoded, and there
is no reusable decode location. As the code grows, new raw text blocks silently
appear.

## Decision

1. **General rule (normative):**
    - Any static text that is (a) longer than a short phrase, or (b) contains
      newlines or template-literal breaks, or (c) would read as a dense block in
      the compiled output, **must not** appear as a raw string literal in `src/`.
    - Short identifiers, CSS selector strings, log tags, and enum values stay raw:
      debuggability and grep-ability take precedence there.
2. **Unified mechanism:** build-time Base64 through Vite, decoded at runtime by
   `decodeText` from `src/lib/core/encoding.ts`. No new `@grant`, no CSP exposure,
   no runtime fetch. Base64 is **not** confidentiality (ADR 0010) — the only goal
   is that the output contains no raw, easily scannable text block.
3. **Extraction of the decode logic** into `src/lib/core/encoding.ts`:
    ```ts
    export function decodeText(encoded: string): string {
        const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
    }
    ```
    `decodeChangelog` becomes a thin alias so the existing
    `src/lib/gui/__tests__/about-changelog.test.ts` and the new
    `src/lib/core/__tests__/encoding.test.ts` stay valid.
4. **Build interface — two permitted forms**, documented per component:
    - **Form A (single file / define)** — like the changelog: read the file, normalize
      CRLF to LF, embed as `Buffer.from(..., "utf-8").toString("base64")` through a
      Vite `define` (`__X_B64__`).
    - **Form B (large structured data)** — move raw data to
      `src/lib/data/<name>.md` or `.txt` and import it through a Vite plugin loader.
      `src/` then carries only the import, never the content. Form B is the default
      for new text blocks that contain newlines.
5. **Candidate inventory** (prioritized, each as its own PR):
    - P1 `CHANGELOG.md` — already done (ADR 0010).
    - P2 `src/lib/gui/i18n.svelte.ts` — **do not** encode wholesale: its keys are
      compile-time typed (`keyof typeof TRANSLATIONS.en`). Instead evaluate extracting
      values as a JSON asset plus a generated type; extend this ADR only if that
      evaluation is positive (bundle size, type safety, and runtime decode cost).
    - P3 Long template literals / multi-line CSS or help text — search `src/` for
      multi-line template literals and move matches to Form B.
    - P4 Inline SVG raw data — stays as files under `src/assets`; no action unless it
      lands as an inline multi-line literal in TypeScript.
6. **Architecture / docs duty:** new encodable texts must be referenced in the
   component doc's "Data flow" section and here; all referenced paths must exist
   (enforced by `npm run docs:check`).
7. **Tests:** every new embedded source gets a round-trip test (base64-encode in the
   test, then `decodeText`), analogous to `src/lib/gui/__tests__/about-changelog.test.ts`.

## Consequences

**Positive:**

- One unified, documented contract instead of a single-use changelog trick; no new
  permission grants or CSP exposure.
- Raw, conspicuous text blocks disappear from the output; the changelog flow stays
  valid and tested.
- Decode logic exists once, is reusable, and is unit-testable in the node env.

**Negative:**

- Each encoded source adds ~33% (Base64 overhead) to the bundle — apply strictly
  and selectively.
- Runtime decode cost (`atob` + `TextDecoder`) per source; consider lazy decoding
  for large payloads.
- The rule must be maintained; over-engineering trivial strings is a real risk.

## Non-goals

- Obfuscation or encryption of logic or secrets (secrets must not ship in the
  bundle at all).
- Translating changelog contents.

## References

- Implementation: `vite.config.ts` (define pattern), `src/lib/core/encoding.ts` (generic
  decoder), `src/lib/gui/about-changelog.ts` (`decodeChangelog` alias),
  `src/lib/gui/tabs/AboutTab.svelte` (runtime decode/parse/render site),
  `src/lib/core/__tests__/encoding.test.ts`,
  `src/lib/gui/__tests__/about-changelog.test.ts`
- Release contract: [ADR 0008](0008-release-please-automation-contract.md) — change log,
  `@version` header and release asset are produced in the same merge, which is what
  keeps the embedded changelog consistent with the installed header
- Build-time embedding precedent: [ADR 0010](0010-about-tab-changelog-embedded-at-build-time.md)
- Docs gate: `scripts/check-docs.mjs`
- Rule of thumb: the output shows what was shipped in this build — build-time data
  beats runtime fetching for content that is already static per release, and the
  same rule applies to any static text that must not stand out in the bundle.
