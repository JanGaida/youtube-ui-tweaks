# ADR 0010: About-tab changelog embedded at build time (no runtime fetch)

- Status: accepted (2026-10-26)
- Deciders: human + agent session
- Applies to: `vite.config.ts` (`__CHANGELOG__` define), `src/vite-env.d.ts`, `src/lib/gui/about-changelog.ts`, `src/lib/gui/tabs/AboutTab.svelte`

## Context

The About tab rendered the hardcoded template line `v{VERSION} — Initial release` — after the
first release that line was perpetually wrong (version + a claim that stopped being true the
moment release 1.1.0 existed). The candidate shown to users (and the actual bug report) was a
changelog that reaches the panel through the real release pipeline
([ADR 0008](0008-release-please-automation-contract.md): release-please writes
`CHANGELOG.md`, the release workflow attaches the built `.user.js`).

The runtime-fetch alternative — reading `CHANGELOG.md` from
`raw.githubusercontent.com`/jsDelivr in the injected script — was evaluated and rejected.
The panel would need `GM_xmlhttpRequest` (a new permission grant the script otherwise does
not need), would depend on network reachability inside the YouTube page context, and would
render changelog text fetched at runtime inside an origin the script must never trust more
of (injection surface, `@html`-adjacent rendering).

A related empirical pitfall (observed on Tampermonkey 5.5.0 / Firefox): the top-level
`GM_info.version` is typed `version?: string` in the Tampermonkey documentation (optional)
and was observed to report the **script-handler (TM extension) version** while
`GM_info.script.version` — the REQUIRED field — carried the actual header `@version`.
The About tab therefore prefers `GM_info.script.version` and falls back to the top-level
value only for handlers that expose no `script` object (e.g. the e2e polyfill stub).
This explained the earlier "ghost install 5.5.0" report: the panel showed the extension
version against an embedded changelog of 1.1.1, which is exactly what the mismatch note
is designed to make visible.

## Decision

1. **`CHANGELOG.md` is embedded at build time**: `vite.config.ts` reads the file, normalizes
   newlines (CRLF → LF — platform variance must not leak into the bundle) and injects it
   BASE64-ENCODED through a Vite `define` (`__CHANGELOG_B64__`), next to the existing
   `__DEV_CAPTURE__` define. Base64 keeps the bundle a single compact, non-readable literal —
   a plain-text embed would surface the raw markdown block to anyone opening the userscript.
2. **The About tab decodes and parses the embedded entries** via the pure module
   `src/lib/gui/about-changelog.ts` (`decodeChangelog`: atob + TextDecoder, node-env
   unit-tested roundtrip): each release-please section as version/date/group/bullets,
   markdown links and bold markers flattened to plain text.
3. **Entries are keyed by the installed `GM_info.script.version`** (the GM_info field
   carrying the header `@version` — `GM_info.version` is handler-dependent, see Context);
   a foreign/placeholder version (e.g. the e2e GM_info stub) falls back to the newest entry,
   and a visible mismatch note (`about.changelogMismatch`) surfaces that the running copy
   does not match the build — installs like the observed "ghost 5.5.0" install can no longer
   display unexplained text.
4. **The full history stays out of the bundle logic but one link deep**: a static
   "Full changelog on GitHub" link points at `CHANGELOG.md` on `main` — the GitHub-reference
   part happens in the browser, where a plain `<a>` needs no grant and no fetch by the script.
5. **Version diagnostics are unconditional at boot, level-gated only in the panel**: the boot
   log (`main.ts`, raw `console.info` like the other boot messages) carries a picked-fields
   GM_info snapshot (`script.version`, top-level `version`, stored `script.header`, install
   URLs); the About tab logs the full serialized GM_info snapshot on open, debug-gated
   (ADR 0005). Boot must be unconditional because the default settings level is `silent` —
   a level-gated-only diagnostic would never fire where the version question is asked.

**Rule of thumb:** the About tab shows what was shipped in this build — build-time data beats
runtime fetching for content that is already static per release.

## Consequences

**Positive:**

- The "v X — Initial release" lie is structurally impossible: the rendered text is the real
  changelog section of the built header version (release PR merges both in one commit —
  ADR 0008 contract).
- No new `@grant`, no CSP exposure, offline-capable; the changelog cannot diverge from the
  installed version because both travel in the same release asset.
- A stale install is self-diagnosing: version fallback + mismatch note instead of silently
  plausible text.

**Negative:**

- The bundle grows by the CHANGELOG.md content (base64 ≈ +33 % over raw text; ~3 KB today,
  grows monotonically with releases); acceptable for a userscript, worth revisiting if the
  file ever becomes large.
- Base64 is NOT confidentiality — casual "raw text in my script" is avoided, a curious
  decoder still reads it by design (the changelog is public in the repo anyway).
- The parser is coupled to the release-please format — a changelog written by hand in another
  shape yields empty/fallback rendering; format changes would need parser updates (covered by
  the unit test).

## References

- Implementation: `vite.config.ts` (define), `src/lib/gui/about-changelog.ts` (parser),
  `src/lib/gui/tabs/AboutTab.svelte` (rendering), `src/lib/gui/__tests__/about-changelog.test.ts`
- Release contract: [ADR 0008](0008-release-please-automation-contract.md) — CHANGELOG.md,
  `@version` header and release asset are produced by the same merge, which is what keeps
  the embedded changelog consistent with the header
