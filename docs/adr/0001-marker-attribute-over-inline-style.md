# ADR 0001: Marker attribute over inline style for DOM mutations

- Status: accepted (2026-08-23, re-verified 2026-09-09)
- Deciders: human + agent session
- Applies to: `watch-page` (share/save hiding), `ads-hide` (member-only), all `run` behaviors

## Context

YouTube's SPA is built on Polymer. Re-renders of a custom element re-apply Polymer's style
bindings and **clobber inline styles** set by external scripts: `el.style.display = "none"`
disappears on the next re-render, and the MutationObserver only re-hides it after its
throttle window — a visible flicker, or worse, dead state if the observer missed the mutation.

DOM mutations made by our `run` behaviors must survive arbitrary Polymer re-renders.

## Decision

Never hide or mark elements via inline styles. Instead:

1. The `run` pass sets a **marker attribute** on the matching element
   (e.g. `data-yt-tweaks-watch-hidden` on the `yt-button-view-model`, `data-yt-tweaks-hidden`
   on ads, `data-yt-tweaked="1"` on text-shortened nodes).
2. A **CSS attribute-selector rule** (injected via `#yt-tweaks-css`) produces the visual
   effect: `yt-button-view-model[data-yt-tweaks-watch-hidden] { display: none }`.
3. `restore()` removes the marker attributes — the DOM returns to YouTube's original state.

## Consequences

**Positive:**

- Polymer re-renders preserve attributes; the visual effect is re-applied by pure CSS
  without any observer involvement. Flicker-free.
- Restore is trivial, global, and verifiable: "are there any `data-yt-tweaks-*` attributes
  left?" is a single `querySelectorAll` — the kill-switch relies on this (see
  `restoreAll` in the registry).
- Marker attributes double as debugging anchors in DevTools.

**Negative:**

- Two artifacts per mutation (attribute + CSS rule) instead of one inline style — slightly
  more code per feature.
- Attribute names are a shared namespace; new markers must follow the `data-yt-tweaks-*` /
  `data-yt-tweaked-*` convention and be unique per feature.

## References

- Pattern usage: `src/lib/core/features/watch-page.ts`, `src/lib/core/ads.ts`
- Architecture docs: [watch-page.md](../architecture/watch-page.md),
  [ads-hide.md](../architecture/ads-hide.md), [feature-registry.md](../architecture/feature-registry.md)
