# ADR 0006: Preset enums over free-form CSS inputs for coupled layout values

- Status: accepted (2026-09-12)
- Deciders: human + agent session
- Applies to: `settings.ts` (styling typography, textShorten.viewsText), `features/grid-styling.ts`, `features/meta-icons.ts`, GUI `VideoItemTab.svelte`

## Context

The video-item styling settings started as free-form CSS inputs: `titleFontSize`,
`titleLineHeight`, `metaFontSize`, `metaLineHeight`, `metaPaddingTop` (rem strings),
`titleMarginLeft/Right` (arbitrary CSS lengths), and `textShorten.viewsText` (free text).
Three failure classes traced back to that shape:

1. **Broken layout invariants.** `font-size` and `line-height` are not independent —
   `-webkit-line-clamp` reserves `line-height × maxLines`, and `forceEqualHeight` computes
   `min-height: calc(lineHeight * maxLines)`. A user pairing a large font-size with a small
   line-height clipped text vertically (the "text size looks broken" reports). Free-form
   input made pathological pairs the default state space.
2. **Asymmetric margins.** Separate left/right margin inputs broke the visual symmetry of
   centered titles (`titleAlign: center` centered within a container that was itself
   asymmetrically indented — "alignment looks off" reports).
3. **Ambiguous word replacement.** `viewsText` free text duplicated what the locale already
   knows ("Aufrufe" / "views") and could hold arbitrary strings that shift the meta row
   layout per item.

Meanwhile the codebase already had a proven counter-pattern: `avatar.size`, `menuButton.size`,
`guide.width` are enum presets with fixed, tested value maps — none of them ever produced a
layout break.

## Decision

1. **Coupled values become enum presets with fixed value maps** — never separate free-form
   fields. Typography switches to `titleSize`/`metaSize` (XS–XL), each mapping to a
   `{fontSize, lineHeight}` pair where `lineHeight ≥ fontSize` at every preset; `metaSpacing`
   becomes a 3-step enum (tight/normal/relaxed).
2. **Margins that YouTube positions natively are removed as settings** (`titleMargin*`), not
   preset-ized. The same rule already removed `menuButton.margin` in the V1 menu rework.
3. **Locale-owned text comes from `LOCALE_PATTERNS`, not settings** — `viewsText` is replaced
   by a `viewsWordMode` enum (`none | locale`); the word itself is per-locale data.
4. **Migration is never throwing**: `loadSettings` maps stored rem strings onto the nearest
   preset by font-size (rem-format only; other units fall back to medium/normal) and deletes
   the legacy keys once. Default values map losslessly (medium/normal).
5. New visual capabilities follow the same pattern: meta icons (eye/clock) expose
   `sizeEm` presets and boolean gates; the dim graduation exposes a `progressSteps` enum
   (off/quarter/third/half) whose buckets are computed, never free-form.

**Rule of thumb:** a CSS value that participates in a layout invariant (clamp, min-height,
symmetry, native positioning) is a preset enum with a tested value map — or it is not a
setting at all.

## Consequences

**Positive:**

- The pathological pair class is structurally impossible; validators check enum membership
  instead of regex-format, and the `forceEqualHeight` calc consumes the same map as the
  CSS rule (single source of truth in `grid-styling.ts`).
- GUI fields shrink from 7 rem inputs to 3 selects with the pair values in the option
  labels; misconfiguration becomes un-selectable.
- Enum-based features (icons, dim steps) get bucket-wise CSS emission with exact-match
  marker selectors — no float formatting in selectors.

**Negative:**

- Users lose arbitrary rem fine-tuning; the nearest-preset migration visibly snaps
  non-default values. Accepted trade-off (the failure class outweighs the tuning freedom).
- Preset maps need tests asserting the invariants (pair coupling, ascending order) —
  added to `grid-styling.test.ts`.
- Adding a new size step touches the map + GUI labels + migration snapshot.

## References

- Implementation: `src/lib/core/settings.ts` (migration), `src/lib/core/features/grid-styling.ts`
  (`TITLE_SIZE_MAP`, `META_SIZE_MAP`, `META_SPACING_MAP`), `src/lib/core/locale.ts`
  (`viewsWord`), `src/lib/core/features/meta-icons.ts` (`ICON_*` constants)
- Architecture docs: [grid-styling.md](../architecture/grid-styling.md),
  [text-shorten.md](../architecture/text-shorten.md), [dim-watched.md](../architecture/dim-watched.md)
- Prior art in-repo: `AVATAR_SIZE_MAP`/`MENU_BUTTON_SIZE_MAP` (grid-styling.ts),
  `GuideWidthPreset` (settings.ts)
