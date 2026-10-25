# ADR 0002: Document-level delegated listeners over per-element listeners

- Status: accepted (2026-08-27, re-verified 2026-09-09)
- Deciders: human + agent session
- Applies to: `watch-page` (description click-fold)

## Context

The description click-fold feature needs to react to clicks on `#description` on the watch
page. The first implementation attached a click listener directly to the `#description`
element and marked it with an attribute to avoid double-binding.

Polymer re-renders `#description` (expand/collapse, metadata updates). When it does, the
marked element — and its listener with it — is **replaced wholesale**. The listener vanished
together with the marker: clicks were dead in the expanded state until the MutationObserver
re-ran the pass. The timing window was unreliable and untestable.

## Decision

Bind **once, at the document level, in the capture phase**, and decide inside the handler
whether the event target is relevant:

1. One `document.addEventListener("click", handler, { capture: true })` — `document` is
   never replaced by Polymer.
2. The handler filters: exclude interactive targets
   (`target.closest('a, button, tp-yt-paper-button, [role=button]')`), then require the
   target to be inside `ytd-watch-metadata #description`.
3. Re-install is a no-op via a live `descFoldListener` reference (observer re-runs are safe);
   `restore()` removes the single document listener and clears the reference.

## Consequences

**Positive:**

- Re-render-immune: no re-bind logic, no timing window, no dead-click state.
- Exactly one global listener instead of one per description box.
- Idempotent install — safe against observer re-runs without marker bookkeeping.

**Negative:**

- The handler runs for **every** click on the page (capture phase) — acceptable because the
  filter is two `closest()` calls; measured cost is negligible.
- Listener lifetime is the whole tab session while the feature is active (scoped to watch
  page via feature dispatch) — acceptable for a userscript.

## References

- Implementation: `src/lib/core/features/watch-page.ts`
- Architecture doc: [watch-page.md](../architecture/watch-page.md) (Description Click-Fold section)
