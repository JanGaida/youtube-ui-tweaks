# ADR 0005: `isDebugEnabled()` guards over unguarded hot-path log arguments

- Status: accepted (2026-09-09)
- Deciders: human + agent session
- Applies to: `observer.ts` (runAll debug status), `text.ts` (per-element shorten), `features/startpage-grid.ts` (per-tick run)

## Context

The logger (`log.ts`) filters inside `_emit`: every `log.debug(...)` below `LOG_LEVEL` is
discarded there. But the filter only protects the **console call** — call sites still build
their arguments unconditionally:

- `observer.ts:runAll()` executed two full-document `querySelectorAll` (marker counts) plus a
  `performance.now()` timing string **on every MutationObserver tick** (throttled to 200 ms),
  even though the values feed only the discarded debug message.
- `text.ts:shortenText()` interpolated an original→shortened string **per shortened element** —
  the hottest path in the script, since feed items shorten continuously during scroll.
- `startpage-grid` (the only feature `run` without an idempotency early-return) rebuilt two
  template strings per tick.

With `LOG_LEVEL=info` (the default) this is pure allocation + DOM-query waste in exactly the
paths that run most often.

## Decision

Hot paths guard debug-only work with `isDebugEnabled()` (exported from `log.ts`) **before**
building strings or running debug-only queries:

1. `isDebugEnabled()` returns `LOG_LEVELS.debug >= LOG_LEVEL` — a cheap boolean, no
   string/allocation cost.
2. Any debug-only side work (status counts, timing, interpolation) goes **inside** the guard.
3. `_emit`'s internal level filter stays as defense-in-depth — cold call sites (boot,
   hash-gated idempotent runs like `guide-entries`, preset-gated like `guide-styling`) may
   call `log.debug(...)` directly without a guard.

**Rule of thumb:** does the code run per observer tick, per element, or per scroll event?
→ guard. Does it run once at boot or behind an idempotency early-return? → direct call.

## Consequences

**Positive:**

- Zero-cost debug logging when off: no string building, no debug-only `querySelectorAll`,
  no GC pressure in the observer tick and the per-element shorten path.
- The guard is self-documenting: `if (isDebugEnabled())` marks debug-only side effects
  explicitly, including debug-only _work_ (queries), not just messages.
- Cold sites stay terse — no blanket guard discipline imposed where the cost is nil.

**Negative:**

- Call-site verbosity at hot sites (one extra line per debug cluster).
- Discipline required: new hot-path debug code must remember the guard. Mitigations: this
  ADR as the review reference, and the rule of thumb above (tick/element/scroll → guard).

## References

- Implementation: `src/lib/core/log.ts` (`isDebugEnabled`), `src/lib/core/observer.ts`
  (`runAll`), `src/lib/core/text.ts` (`shortenText`), `src/lib/core/features/startpage-grid.ts`
- Architecture doc: [feature-registry.md](../architecture/feature-registry.md) (dispatch
  triggers that constitute the hot paths)
