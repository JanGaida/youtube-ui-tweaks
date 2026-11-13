# ADR 0012: Structured logging with correlation context, ring buffer and privacy rules

- Status: accepted (2026-11-13)
- Deciders: human + agent session
- Applies to: `src/lib/core/log.ts` and every log call site

## Context

The original logger emitted every level through `console.log`, had no timestamp or correlation
context, logged raw page text (channel names in metadata rows), warned per element on hot paths,
and wrote boot diagnostics through raw `console.*` calls that ignored the configured level.
Feature failures were logged without a phase, feature id or normalized error, and repeated on
every observer tick. Debugging a cross-feature or SPA-navigation problem therefore required
reading the source instead of reading the log.

Separately, the project deliberately keeps logging silent by default (ADR 0007) and treats
captured YouTube DOM and user preferences as private (fixtures are gitignored).

## Decision

1. **Level semantics:** `debug < info < warn < error < silent`. Each level maps to the matching
   console method (`console.debug/info/warn/error`), so DevTools level filters, error counters
   and stack linking work. `silent` suppresses everything emitted through the logger.
2. **Record shape:** every record carries `ts` (local `HH:MM:SS.mmm`), monotonic `seq`, `level`,
   `scope`, `message`, `ctx`, and optional structured `data`.
3. **Correlation:** a per-page-load `sessionId`, a `runId` per observer pass, and a `navSeq` per
   SPA navigation change. `withLogContext()` applies the context to synchronous work and restores
   it in a `finally` block.
4. **Scope catalog:** `SCOPES` constants plus the `LogScope` union. Free-form scope strings are
   rejected by the type checker. Feature-specific scopes (formerly `guide-*`) collapse into
   `guide` with a `feature` field in `data`.
5. **Noise control:** `warnOnce(scope, key, ...)` for expected, repeated conditions (missing locale
   patterns, optional DOM). Feature errors are counted per `(feature, phase)`: the first failure
   and every 50th are `error`, intermediate repeats are `debug` ("suppressed").
6. **Error normalization:** `toErrorInfo()` produces `{ name, message, stack, cause }` and truncates
   long stacks. `normalizeData()` converts DOM nodes to `{ node }` and Errors to `{ error }`, so the
   ring buffer never retains elements.
7. **Bounded ring buffer:** the last 500 records that actually passed the level filter are retained
   in memory. `getRecentLogs()` returns a copy. Nothing is persisted or transmitted.
8. **Privacy:** logs must not contain `textContent`, `document.title`, settings objects, GM storage
   contents, or URLs with query strings. Use tags, lengths, counters and keys instead.
9. **Boot order:** the persisted `debug.logLevel` is read before feature registration and settings
   load, so boot/migration logs honour the stored level. Boot diagnostics use the logger only.
10. **Debug report:** the System tab copies a JSON report of retained records plus a sanitized meta
    block (version, page, content/GUI locale, level, session id, truncated user agent). No settings,
    no page text.

## Consequences

**Positive:**

- DevTools severity filters and stack traces work for errors.
- A session can be correlated end-to-end (`sessionId` → `navSeq` → `runId` → feature).
- Hot paths stay quiet: repeated warnings and feature failures cannot flood the console.
- Logs and the copied report are shareable without leaking page content or settings.
- Memory is bounded and the logger never retains DOM nodes.

**Negative:**

- Call sites must pass structured `data` and use the scope catalog; the type checker enforces
  scopes but not data shape.
- `console.debug` is hidden under Chrome's default level filter (visible in Firefox, the target
  browser, or after enabling "Verbose").
- The ring buffer costs a small amount of memory (bounded by 500 records + truncated stacks).
- The log format is effectively a public debugging interface; changes require doc updates.

## Alternatives considered

- **Keep `console.log` plus string messages** — rejected: loses severity, filtering and stack
  linking, which is the core debugging problem.
- **Persist logs to GM storage** — rejected: privacy, size and quota risk; the ring is session-only.
- **Ship telemetry to a backend** — rejected: no backend, privacy, and ToS concerns.
- **Always-on debug logging** — rejected: console noise and hot-path cost; silent remains the default.
- **Record filtered-out records in the ring** — rejected: contradicts the silent contract and adds
  overhead on hot paths.

## References

- Implementation: `src/lib/core/log.ts`
- Hot-path guards: [ADR 0005](0005-isdebugenabled-guard-over-unguarded-log-args.md)
- Silent default: [ADR 0007](0007-curated-opinionated-defaults.md)
- Architecture: [system-overview.md](../architecture/system-overview.md),
  [testing.md](../architecture/testing.md)
