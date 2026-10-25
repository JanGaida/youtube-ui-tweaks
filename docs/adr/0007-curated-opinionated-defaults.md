# ADR 0007: Curated opinionated defaults over YT-native opt-in defaults

- Status: accepted (2026-10-25)
- Deciders: human + agent session
- Applies to: `settings.ts` (`DEFAULT_SETTINGS`), `log.ts` (silent level), GUI `SystemTab.svelte`

## Context

`DEFAULT_SETTINGS` shipped a YT-native, opt-in baseline: every visual/behavioral tweak off,
native layout values, `logLevel: info`. The author's actual daily setup diverged from the
defaults on ~50 fields — every fresh install (and every "Zurücksetzen"/reset) had to
re-configure the same curated set by hand, and the defaults showed none of the script's
capabilities.

The panel's `deepMergeSettings` semantics already guarantee that saved values win over
defaults, so changing defaults can never silently re-style an existing installation — the
change is scoped to fresh installs and resets by construction.

Along the way, the desired config contained two latent defects that defaults alone cannot
express and that hurt every user with a hand-edited settings import:

1. `styling.titleMaxLines` saved as a number (`3`) — the field is a STRING enum
   (`"1".."4"`, `"99"`); a number breaks the strict-equality check in `grid-styling.ts`
   and matches no GUI option (display ≠ effect).
2. `feedChips.layout: "stack"` — the home chip bar has no `stack` support by type
   (`Exclude<ChipLayout, "stack">`; the home bar is a 0-height overlay whose wrapped
   chips overlap the grid). A saved `"stack"` is silently ignored and matches no GUI option.

## Decision

1. **`DEFAULT_SETTINGS` becomes the author's curated setup** (ADR 0007 baseline): split
   meta rows with centered title/meta, 3-line titles + forceEqualHeight, hidden avatar,
   meta icons (eye/clock) on, ads/promo/survey/verified-badge hiding on, dim-watched on
   (third steps + hover reveal), preview delay 1250ms, guide hidden (280px preset,
   auto-expanded), red chips on home+watch (active `#b30024` / inactive `#4e0010`),
   7-column startpage, watch-page action-button hiding, curated masthead buttons, and
   the author's panel geometry. One deliberate exception: the `*Hex` custom-color seed
   values keep their neutral legacy values — they are inert while the color mode is a
   preset and are not part of the curated look.
2. **Logging is silent by default**: a new `silent` severity (4, above `error`) is added
   to the log-level enum; `debug.logLevel` defaults to `silent`. End users get a clean
   console; developers flip the Debug tab to `debug`.
3. **Invalid saved values are normalized by migration, not by defaults**: `loadSettings`
   maps a saved numeric `titleMaxLines` to its string and a saved `feedChips.layout:
"stack"` to `"collapse"` — once, robustly, for every user with a corrupted import.

**Rule of thumb:** defaults describe the intended experience, not the vendor's status quo;
saved settings always win; malformed saved values get a one-time migration instead of
silently doing nothing.

## Consequences

**Positive:**

- Fresh installs show the full curated experience immediately; reset restores the
  author's intended baseline instead of a blank slate.
- Console silence out of the box (no info noise for end users).
- The number/`"stack"` corruption class is fixed for every affected install.

**Negative:**

- New users who expect a native YouTube first-run experience see a heavily re-styled
  one; the kill-switch (`system.tweaksEnabled`) and per-feature toggles are the escape
  hatch, but the first impression is opinionated.
- Default-coupled tests must state their assumptions explicitly (neutralize the curated
  slice) instead of relying on the old native baseline — done in one pass for
  `feed-chips`/`watch-chips`/`dim-watched`/`grid-styling`/`ads-hide`/migration suites.
- Any future "default flip" discussion must weigh every affected feature at once (this
  ADR is the single record of the why — feature docs link here, no per-doc rationale).

## References

- Implementation: `src/lib/core/settings.ts` (`DEFAULT_SETTINGS`, `titleMaxLines`
  number→string migration, `feedChips.layout` stack→collapse migration),
  `src/lib/core/log.ts` (`silent` severity), `src/lib/gui/tabs/SystemTab.svelte`
  (log-level option), `src/lib/gui/i18n.svelte.ts` (`optdesc.logSilent`)
- Test baseline: `src/lib/core/__tests__/feed-chips.test.ts`, `watch-chips.test.ts`,
  `dim-watched.test.ts`, `grid-styling.test.ts`, `ads-hide.test.ts`,
  `video-item-migration.test.ts`, `guide-migration.test.ts`,
  `masthead-migration.test.ts`, `meta-split.test.ts` (curated-default assertions)
- Prior ADR: [ADR 0006](0006-preset-enums-over-freeform-css-inputs.md) — the enum
  presets this baseline selects values from
