# Architecture: Filter-Chips Features

> Homepage + watch-page filter-chip color override (active + inactive). Pure CSS — no DOM
> mutation. Overrides the background color of YouTube's filter chips. The category
> ("Filter-Chips") contains two independent features with separate settings: the homepage
> filter-chip bar (`feed-chips`, page: home) and the watch-page related-video sidebar chip bar
> (`watch-chips`, page: watch). Diagrams depict relationships, structure, and boundaries — no
> implementation details.

## Component Structure

```mermaid
flowchart TB
  subgraph GUI["gui/"]
    Tab["FeedChipsTab.svelte"]
    Nav["categories.ts"]
  end

  subgraph Store["stores/"]
    S["settings store"]
    V["validation store"]
  end

  subgraph Core["core/ (framework-free)"]
    FC["feed-chips.ts feature (home)"]
    WC["watch-chips.ts feature (watch)"]
    FC -->|css| YTStyle["&lt;style&gt; (registry-driven)"]
    WC -->|css| YTStyle
    FC -->|validate| V
    WC -->|validate| V
  end

  Tab -->|setByPath| S
  S -->|settings via ctx| FC
  S -->|settings via ctx| WC
  S -->|revalidate| V
  Nav --> Tab
```

## Color Resolution (Enum + Custom Hex)

```mermaid
flowchart LR
  Mode["activeColor / inactiveColor (enum)"]
  Mode -->|default| None["no override (YT-native)"]
  Mode -->|"red/blue/green/purple/orange"| RolePresets["preset map BY ROLE<br/>active: bright variant<br/>inactive: darker variant (~43%)"]
  Mode -->|custom| Hex["activeColorHex / inactiveColorHex"]
  Hex -->|validated by regex| Valid["#rgb | #rrggbb | #rrggbbaa"]
  Valid -->|invalid| Err["validation error → invalid class"]
  Valid -->|valid| CSS["CSS background-color"]
  RolePresets --> CSS
```

- The two roles resolve the SAME preset name to different shades: the active chip gets the
  bright variant (e.g. red `#b30024`), the inactive chip the darker sibling (e.g. red
  `#4e0010`) — a deliberate active/inactive brightness gradient instead of two equal colors.
- Each feature keeps its own copies of the two preset maps (feed-chips and watch-chips mirror
  each other 1:1).

## CSS Application (Selector Targets)

```mermaid
flowchart TB
  subgraph DOM["YouTube chip-bar (iron-selector#chips)"]
    Active["yt-chip-cloud-chip-renderer[selected] .ytChipShapeChip"]
    Inactive["yt-chip-cloud-chip-renderer:not([selected]):not(.iron-selected) .ytChipShapeChip"]
  end

  subgraph WatchDOM["Watch-page related chip-bar (yt-related-chip-cloud-renderer)"]
    WActive["scoped: yt-related-chip-cloud-renderer ...[selected] .ytChipShapeChip"]
    WInactive["scoped: yt-related-chip-cloud-renderer ...:not([selected]) .ytChipShapeChip"]
  end

  ActiveColor["home active color → background-color + color:#fff"]
  InactiveColor["home inactive color → background-color only"]
  WActiveColor["watch active color → background-color + color:#fff"]
  WInactiveColor["watch inactive color → background-color only"]

  ActiveColor --> Active
  InactiveColor --> Inactive
  WActiveColor --> WActive
  WInactiveColor --> WInactive
```

## Scope Boundaries

```mermaid
flowchart TB
  subgraph Supported["Supported (pure CSS)"]
    A1[Home active chip color - enum preset]
    A2[Home active chip color - custom hex]
    A3[Home inactive chip color - enum preset]
    A4[Home inactive chip color - custom hex]
    W1[Watch active chip color - enum preset]
    W2[Watch active chip color - custom hex]
    W3[Watch inactive chip color - enum preset]
    W4[Watch inactive chip color - custom hex]
    L1[Watch layout - collapse - YT-native carousel]
    L2[Watch layout - stack - wrapping flex list]
    L3[Layout hide - watch + home - bar removed entirely]
    L4[Home layout - collapse only - no stack: the home chip bar is a 0-height overlay whose wrapped content overlaps the grid]
  end

  subgraph Removed["Removed (earlier iteration — discarded)"]
    B1[Pin/Move icons - DOM mutation]
    B2[Chip reorder - DOM move]
    B3[Custom chips - clone dead, not feasible]
    B4[Cross-session replay - session-bound token]
  end
```

## References

- Features: `src/lib/core/features/feed-chips.ts`, `src/lib/core/features/watch-chips.ts`
- Shared helper: `src/lib/core/features/chip-layout.ts` (not a feature — consumed by watch-chips)
- Settings: `src/lib/core/settings.ts`
- GUI: `src/lib/gui/tabs/FeedChipsTab.svelte`
- Tests: `src/lib/core/__tests__/feed-chips.test.ts`, `src/lib/core/__tests__/watch-chips.test.ts`, `src/lib/core/__tests__/chip-layout.test.ts`

Verified: 2026-10-25 — against `src/lib/core/features/feed-chips.ts`, `src/lib/core/features/watch-chips.ts` (re-checked 2026-10-25: per-role preset maps ACTIVE_PRESETS/INACTIVE_PRESETS replace the shared COLOR_PRESETS — active red #b30024, inactive red #4e0010, other hues derived by the same ~70%/43% brightness factors), `src/lib/core/features/chip-layout.ts`, `src/lib/core/settings.ts` (`ChipLayout = collapse|stack|hide`, home excludes `stack`), `src/lib/gui/tabs/FeedChipsTab.svelte` ($derived option arrays) @ working tree (re-checked 2026-10-25 after the ADR 0007 defaults change: DEFAULT_SETTINGS now ships both chip features enabled with the red presets (active `#b30024` / inactive `#4e0010`) and layouts home "collapse" / watch "stack"; a new one-time migration normalizes a saved `feedChips.layout: "stack"` to `"collapse"` — CSS model + selectors unchanged; settings.ts comment-only re-pass, no behavior change)
