# ADR 0003: Fixture-based testing — capture in real browser, E2E against local fixtures

- Status: accepted (2026-08, re-verified 2026-09-09)
- Deciders: human + agent session
- Applies to: whole test architecture (`testing.md`, `e2e/`, `__fixtures__/`, `dev/capture.ts`)

## Context

The userscript's primary maintenance risk is **YouTube DOM drift**: selectors and aria-labels
(`ytd-*` custom elements, locale-dependent strings like "Teilen") rot silently when YouTube
ships changes. Tests must therefore run against **real YouTube DOM**, but:

1. YouTube's bot detection silently withholds grid data from automation-controlled browsers
   (Playwright-driven pages render a skeleton shell) — E2E against live youtube.com is
   infeasible for content-dependent tests.
2. Live-YouTube CI runs need cookies/logins, violate ToS risk limits, and are non-deterministic.
3. jsdom cannot execute Polymer or shadow DOM — full-page simulation is impossible.

## Decision

Split verification into a **capture** step (manual, real browser) and an **execution** step
(automated, local fixtures):

1. **Capture** (dev build only, gated by `__DEV_CAPTURE__`): a Tampermonkey menu command
   ("Capture All Fixtures") navigates the real Firefox via YouTube SPA navigation and
   auto-downloads DOM snapshots as `*.fixture.html` into `src/lib/core/__fixtures__/`.
   Never automated, never in CI.
2. **Execution** (CI-safe): Vitest runs selector/feature transforms against the captured
   fixtures (jsdom); Playwright E2E injects polyfill + built userscript into a local
   fixture server (`http :4174`) — no live YouTube, no cookies.

## Consequences

**Positive:**

- Selector regressions surface as red fixture tests the moment a recapture happens after a
  YouTube change — test rot becomes visible instead of silent.
- CI is fully local: no cookies, no bot detection, deterministic, fast.
- Fixtures double as documentation of the YouTube DOM contract per feature.

**Negative:**

- Fixtures are **point-in-time snapshots** — they go stale between YouTube changes until
  someone recaptures manually. The staleness is inherent and accepted (tests fail loudly on
  drift, which is the trigger to recapture).
- jsdom cannot cross shadow boundaries: selectors inside shadow DOM are marked
  `shadowBoundary: true` in fixture meta and verified manually (~20–30% of selectors).
- Fixture capture requires a human with a real Firefox — the one manual step in the chain.

## References

- Architecture doc: [testing.md](../architecture/testing.md)
- Capture tooling: `src/lib/dev/capture.ts`, `e2e/` (config: `playwright.config.ts`)
- CONTEXT.md "Fixture Capture (dev-only)" section (workflow)
