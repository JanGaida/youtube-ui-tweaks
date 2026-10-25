# Architecture: Guide-Entries Feature

> Hide + reorder YouTube's own guide sidebar entries (and whole entry groups/sections) via
> DOM moves — analogous to the masthead custom buttons, but applied to YT's guide. Also
> controls the "Mehr anzeigen" expander. Active globally (`*`). Diagrams depict
> relationships, structure, and boundaries — no implementation details.

## Component Structure

```mermaid
flowchart TB
  subgraph GUI["gui/"]
    Tab["GuideSidebarTab.svelte<br/>(per-entry switches + drag-and-drop order)"]
    Nav["categories.ts (+guide-sidebar)"]
  end

  subgraph Store["stores/"]
    S["settings store"]
  end

  subgraph Core["core/ (framework-free)"]
    FEAT["guide-entries.ts feature"]
    Groups["guide-groups.ts<br/>(6 group defs + section detection)"]
    FEAT -->|detectGroupForSection / getGroupForEntry| Groups
    FEAT -->|run: hide + reorder + expander pass| DOM["guide DOM<br/>(ytd-guide-section-renderer)"]
    FEAT -->|restore: unhide entries + sections| DOM
  end

  Tab -->|setByPath| S
  S -->|settings via ctx| FEAT
  Nav --> Tab
```

## Entry Detection (4 Strategies)

YT uses heterogeneous hrefs, so an entry key resolves through four strategies in order:

```mermaid
flowchart TB
  Entry["ytd-guide-entry-renderer<br/>(excludes #expander-item / #collapser-item / role=button)"]
  Entry --> H{"1. hostname match"}
  H -->|"studio / music / kids.youtube.com"| Ext["myVideos / ytMusic / ytKids"]
  H -->|miss| P{"2. path match"}
  P -->|"/" or "/feed/..." etc.| Path["home, subscriptions, history, ...<br/>(17 known keys via GUIDE_ENTRY_KEYS)"]
  P -->|miss| T{"3. title match"}
  T -->|Shorts has no href - localized titles only| Title["shorts, music, moviesShows, live<br/>(de/en only — locale-dependent fallback)"]
  T -->|miss| S4{"4. parent-section match"}
  S4 -->|"under /feed/you section + /@user href"| Chan["myChannel (user-specific)"]
  S4 -->|no match| Null["null → untracked, left alone"]
```

Shorts has no href in the fixture — only `title="Shorts"`. `myChannel` is user-specific
(`/@user`). The title strategy is YT-localized and only reliable for de/en; path matching
is the primary strategy.

## Run Pipeline

```mermaid
flowchart TB
  Gate{"settings hash unchanged<br/>AND tracked DOM still live?"}
  Gate -->|yes| Skip["early return (idempotent)"]
  Gate -->|no| Reset["restore previously hidden entries,<br/>sections, expander markers"]
  Reset --> G1["1. group hide — section with detected group<br/>+ groups.hidden[id] → display:none<br/>(data-yt-tweaks-guide-section-hidden)"]
  G1 --> G2["2. entry hide — entries.hidden[key] →<br/>display:none (data-yt-tweaks-guide-hidden)"]
  G2 --> G3["3. empty-section hide — all direct entries<br/>in #items hidden → hide the section"]
  G3 --> G4["4. Mehr anzeigen expander —<br/>showMoreDefault → click-expand<br/>showMoreButton=false → hide buttons"]
  G4 --> G5["5. section reorder — groups.order within<br/>#guide-renderer #sections (appendChild)"]
  G5 --> G6["6. entry reorder — stable sort per container<br/>(tracked by order rank, untracked keep position)"]
```

- **Group model** (guide-groups.ts): 6 groups — main, subscriptions, myYouTube,
  moreFromYT, discover, system — each detected via a signature entry (specific groups
  before generic ones to avoid false matches). Detected sections carry
  `data-yt-tweaks-guide-group`.
- **Entry reorder** ("movable unit" rule, Bug 2): the unit is the entry itself or its
  enclosing wrapper (e.g. `ytd-guide-downloads-entry-renderer`), found by climbing to the
  direct child of `#items`/`#section-items`/`#expanded`. Wrapper entries sort together
  with flat siblings; non-tracked units (e.g. the expander) keep their relative position
  via stable sort.
- **Expander flags are independent**: `showMoreDefault` controls the expanded state,
  `showMoreButton` the button's visibility — both active means expanded + button hidden.
  Titles are YT-localized ("Mehr anzeigen"/"Weniger anzeigen" vs "Show more"/"Show less",
  keyed off `ctx.locale`).

## Idempotency + SPA Liveness

```mermaid
flowchart LR
  Hash["hash: hidden keys + entry order +<br/>group hidden + group order + expander flags"]
  Live["appliedStateIsLive: every tracked<br/>hidden el/section still isConnected"]
  Hash -->|settings unchanged| Check{"live?"}
  Live --> Check
  Check -->|yes| Skip2["early return"]
  Check -->|"no — Polymer re-rendered<br/>fresh unhidden nodes on SPA nav"| Reapply["re-apply full pipeline"]
```

A settings-only hash cannot detect that Polymer re-rendered the guide with fresh,
unhidden nodes; the DOM-liveness check (`isConnected` on tracked elements) can.

**Restore**: un-hides tracked entries/sections and clears expander markers. The reorder
is NOT reverted — Polymer renders fresh nodes in native order on SPA navigation.

## Scope Boundaries

```mermaid
flowchart TB
  subgraph Supported["Supported (global)"]
    A1[Hide individual entries - 17 tracked keys]
    A2[Reorder entries per container - stable, wrapper-aware]
    A3[Hide whole groups - 6 groups incl. section title]
    A4[Reorder groups within #sections]
    A5[Mehr anzeigen auto-expand + button hide]
    A6[Empty-section cleanup after per-entry hide]
  end

  subgraph NotSupported["Deliberately not supported"]
    B1[Mini-guide entries - 0 entries, disable-upgrade, hidden - out of scope]
    B2[Custom guide entries - no cloning, only YT's own entries]
    B3[Title-match beyond de/en - locale-dependent anchor, path match is primary]
    B4[Channel-list entries under Abos - no stable key, user-specific hrefs]
    B5[Reorder revert on restore - Polymer re-renders fresh nodes anyway]
  end
```

## References

- Feature: `src/lib/core/features/guide-entries.ts`
- Helper: `src/lib/core/features/guide-groups.ts` (not a registered feature — group defs + section detection)
- Settings: `src/lib/core/settings.ts` (`GuideSettings.entries` — hidden map + order + groups)
- GUI: `src/lib/gui/tabs/GuideSidebarTab.svelte`
- Tests: `src/lib/core/__tests__/guide-entries.fixture.test.ts` (fixture-skipped), `src/lib/core/__tests__/guide-group-diag.test.ts`, `src/lib/core/__tests__/guide-migration.test.ts`

Verified: 2026-10-24 — against `src/lib/core/features/guide-entries.ts`, `src/lib/core/features/guide-groups.ts`, `src/lib/core/settings.ts` (GuideSettings.entries nested slice), `src/lib/gui/tabs/GuideSidebarTab.svelte` @ working tree (re-checked 2026-10-25 after the ADR 0007 defaults change: DEFAULT_SETTINGS.guide.entries now ships curated non-empty order arrays — all 18 entry keys + all 6 group ids verified against GUIDE_ENTRY_KEYS/GUIDE_GROUPS; resolver logic unchanged; settings.ts comment-only re-pass, no behavior change)
