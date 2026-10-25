# Architecture Documentation — Index

> Entry point for all architecture docs. Read order: `system-overview.md` →
> `feature-registry.md` → the component docs. Every agent session working on a component
> MUST read its doc first (see AGENTS.md) and keep it in sync during Phase 9 (Verify).
> Methodology + template + gate source live in skill `arch-docs` — this directory holds
> the project instances.

## Reading Order

| #   | Doc                                        | Answers                                                                   | Level (C4)                 |
| --- | ------------------------------------------ | ------------------------------------------------------------------------- | -------------------------- |
| 1   | [system-overview.md](system-overview.md)   | What does the userscript consist of, how does it boot, who talks to whom? | 1–2 (context, container)   |
| 2   | [feature-registry.md](feature-registry.md) | How are tweaks structured, dispatched, and restored?                      | 2–3 (container, component) |
| 3   | [testing.md](testing.md)                   | How is the system verified at each layer?                                 | cross-cutting              |
| 4   | [system-toggles.md](system-toggles.md)     | How do the kill-switch and anonymize layer behave?                        | cross-cutting              |
| 5   | [gui-navigation.md](gui-navigation.md)     | How is the settings panel structured and navigated?                       | 3 (component)              |
| 6   | [dropdown.md](dropdown.md)                 | How does the custom Select work (clipping, a11y, portal)?                 | 3 (component)              |
| 7   | feature docs (below)                       | How does each feature work?                                               | 3–4 (component, code)      |

## Feature Coverage

Every feature in `src/lib/core/features/index.ts` (registration order) must have a row.
`docs:check` fails when a registered feature is missing here or a doc link is broken.

| Feature id         | Doc                                      | Status                                        |
| ------------------ | ---------------------------------------- | --------------------------------------------- |
| `grid-styling`     | [grid-styling.md](grid-styling.md)       | documented                                    |
| `auto-sync-badge`  | [auto-sync-badge.md](auto-sync-badge.md) | documented                                    |
| `dim-watched`      | [dim-watched.md](dim-watched.md)         | documented                                    |
| `preview-delay`    | [preview-delay.md](preview-delay.md)     | documented                                    |
| `text-shorten`     | [text-shorten.md](text-shorten.md)       | documented                                    |
| `meta-split`       | [grid-styling.md](grid-styling.md)       | documented (shared doc with grid-styling)     |
| `hide-elements`    | [hide-elements.md](hide-elements.md)     | documented                                    |
| `ads-hide`         | [ads-hide.md](ads-hide.md)               | documented                                    |
| `masthead-css`     | [masthead.md](masthead.md)               | documented (shared doc with masthead-buttons) |
| `masthead-buttons` | [masthead.md](masthead.md)               | documented (shared doc with masthead-css)     |
| `guide-visibility` | [guide-sidebar.md](guide-sidebar.md)     | documented (shared doc with guide-styling)    |
| `guide-styling`    | [guide-sidebar.md](guide-sidebar.md)     | documented (shared doc with guide-visibility) |
| `guide-entries`    | [guide-entries.md](guide-entries.md)     | documented                                    |
| `feed-chips`       | [feed-chips.md](feed-chips.md)           | documented                                    |
| `watch-chips`      | [feed-chips.md](feed-chips.md)           | documented (shared doc with feed-chips)       |
| `startpage-grid`   | [startpage-grid.md](startpage-grid.md)   | documented                                    |
| `watch-page`       | [watch-page.md](watch-page.md)           | documented                                    |

Helper modules that are NOT features (no registry entry, consumed by features):

| Module                                      | Consumed by              |
| ------------------------------------------- | ------------------------ |
| `features/chip-layout.ts`                   | `watch-chips`            |
| `features/guide-groups.ts`                  | `guide-entries`          |
| `core/guide-sidebar-state.ts`               | `guide-visibility` (FSM) |
| `core/mastheadIcons.ts`, `core/masthead.ts` | `masthead-buttons`       |

## Architecture Decision Records

Cross-cutting decisions live in [docs/adr/](../adr/). Feature docs link them instead of
duplicating rationale.

| ADR                                                                 | Decision                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| [0001](../adr/0001-marker-attribute-over-inline-style.md)           | Marker attribute over inline style (re-render-safety)         |
| [0002](../adr/0002-document-delegation-over-element-listeners.md)   | Document-level delegated listeners over per-element listeners |
| [0003](../adr/0003-fixture-based-testing.md)                        | Fixture-based testing (capture vs. E2E separation)            |
| [0004](../adr/0004-fixed-position-popout-over-body-portal.md)       | `position:fixed` popout over `document.body` portal           |
| [0005](../adr/0005-isdebugenabled-guard-over-unguarded-log-args.md) | `isDebugEnabled()` guards over unguarded hot-path log args    |
| [0006](../adr/0006-preset-enums-over-freeform-css-inputs.md)        | Preset enums over free-form CSS inputs (layout invariants)    |
| [0007](../adr/0007-curated-opinionated-defaults.md)                 | Curated opinionated defaults over YT-native opt-in defaults   |

## Diagram Conventions (Legend)

Notation follows the C4 model review checklist (c4model.com/diagrams/checklist):

- **Title**: every doc section heading names what the diagram answers.
- **Node labels**: real file/component/DOM-selector names from `src/` — grep-verified before
  writing, never invented. YouTube DOM selectors (`ytd-*`, `#yt-tweaks-css`,
  `[data-yt-tweaks-hidden]`) are part of the architecture: the YouTube DOM is the unstable
  interface this userscript codes against.
- **Arrows**: labeled with the relationship intent (`setByPath`, `css: ...`, `run: ...`).
- **Content**: diagrams + prose only — no embedded code snippets.
- **Line styles**: solid = direct call/data flow; dotted (`-.->`) = production/consumption
  across a boundary (e.g. fixtures produced by capture, consumed by tests).
- **Subgraphs**: group by directory (`gui/`, `stores/`, `core/`) or by page scope.
- **Scope Boundaries**: every feature doc has a `Supported` / `Deliberately not supported`
  block — the anti-feature-creep contract for future sessions.
- **Line breaks in labels**: use `<br/>` (Mermaid portability) — never `\n`.
- **Language**: English. German UI strings (aria-labels like "Teilen") are quoted verbatim
  where they are the locale-dependent anchor.
- **Verified footer**: every doc ends with `Verified: YYYY-MM-DD — against ...` stating
  which code it was checked against. Stale = re-verify when touching the component.
