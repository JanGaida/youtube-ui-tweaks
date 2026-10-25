# Architecture: GUI Navigation

> Navigation model for the YouTube UI Tweaks settings panel — two-level category
> sidebar with scroll-spy + flat sections. Replaces the old tab/accordion/group
> hierarchy. Diagrams depict relationships, structure, and boundaries — no
> implementation details.

## Section Layout (Balanced Masonry)

```mermaid
flowchart TB
  Content["Content (scroll container)"]
  Action["masonry action (section-masonry.ts)"]
  Packer["layoutMasonry (Shortest-Column-Packing)"]
  Content --> Action
  Action -->|"measures card heights"| Packer
  Packer -->|"places each card in the shortest column"| Cards["Section cards (absolute, no DOM move)"]
  Action -->|"ResizeObserver (panel resize, card height)"| Packer
  Action -->|"MutationObserver (tab switch)"| Packer
  Cards -->|"balanced"| Order["Column heights differ by <= ~1 card height"]
```

- Column count derives from the content width alone (MIN_COLUMN = 420px) — the
  panel is user-resizable, so viewport media queries do not apply.
- Cards are absolutely positioned (width/left/top inline); DOM order is
  preserved — scroll-spy, drag-and-drop, and Svelte reactivity stay intact.
- Replaces CSS multi-column: the sequential column balancer overflowed the
  right column by >1 card when card-height variance is high; the JS packer
  targets the shortest column instead, keeping columns balanced.
- Single-section categories (about, startpage, watch-page) span the full
  width (single-card full-width case in layoutMasonry).
- The action dedupes its rAF callbacks (one pending layout rAF) — repeated
  resize events within a frame trigger one measurement pass.
- Unit-tested pure function (`layoutMasonry`) — node env, no DOM.

## Navigation Hierarchy (2 levels, was 4)

```mermaid
flowchart TB
  subgraph Sidebar["CategorySidebar (left, two-level)"]
    CatBtns["Category Buttons (9)"]
    SecBtns["Section Buttons of active category"]
  end

  subgraph Content["Content (scroll container)"]
    Sections["Flat Sections (always visible)"]
  end

  CatBtns -->|switchCategory| Content
  SecBtns -->|click: scrollToSection| Sections
  Sections -->|scroll position| ScrollSpy
  ScrollSpy -->|activeSectionId| SecBtns
  ScrollSpy["ScrollSpy (IntersectionObserver)"]
```

## Component Structure

```mermaid
flowchart LR
  subgraph App["App.svelte"]
    SidebarComp["CategorySidebar.svelte"]
    Tabs["Tab Components"]
  end

  subgraph Nav["navigation/"]
    Cats["categories.ts"]
    Spy["scrollSpy.svelte.ts"]
  end

  subgraph Comps["components/"]
    Section["Section.svelte"]
    Field["Field / Switch / Select / Segmented / Stepper / TextInput"]
    Sub["Subsection.svelte"]
  end

  Cats --> SidebarComp
  Spy --> App
  Tabs --> Section
  Section --> Field
  Section --> Sub
```

## 9 Categories → Sections

```mermaid
  flowchart TB
  subgraph "video-item"
    S1[Styling]
    S2[Views]
    S3[Date]
    S4[Avatar]
    S5[Menu-Icon]
    S6[Auto-Sync Badge]
    S7[Hide YT Elements]
    S8[Watched Videos]
    S9[Preview Delay]
  end

  subgraph "menubar"
    M1[Masthead left]
    M2[Search Bar]
    M3[Masthead right]
    M4[Custom Buttons]
    M5[Styling]
  end

  subgraph "guide-sidebar"
    G1[Behavior]
    G2[Expanded]
    G3[Collapsed]
    G4[Group Order + Groups (main, subscriptions, myYouTube, moreFromYT, discover, system)]
    G5[Show More]
  end

  subgraph "feed-chips"
    C1[Start-Chips - active + inactive chip color (home)]
    C2[Watch-Page Chips - active + inactive chip color (watch sidebar)]
  end

  subgraph "startpage"
    SP1[Grid Columns]
  end

  subgraph "watch-page"
    W1[Watch Layout]
  end

  subgraph "ads-promotions"
    A1[Promo Hide]
    A2[Shelves]
    A3[Survey]
  end

  subgraph "system"
    T1[Tweaks]
    P1[Panel]
    P2[Logging]
    P3[Status]
  end

  subgraph "about"
    AB1[About]
  end
```

## Panel A11y (Keyboard Support)

- **Modal focus trap**: Tab/Shift+Tab cycle within the panel (without it, Tab escapes
  into YouTube's DOM); Escape closes; panel drag stays a deliberate mouse gesture.
- **Keyboard resize**: the 8 resize handles are focusable buttons with
  `a11y.resize*` aria-labels (i18n); arrow keys resize by a step.
- **Keyboard drag-and-drop**: the DraggableRow grip is a focusable button —
  ArrowUp/ArrowDown reorder rows.
- **Accessible names**: Switch/TextInput/Stepper carry accessible names;
  the Segmented container is no longer a second tab stop.

## Data Flow: Scroll-Spy

```mermaid
sequenceDiagram
  participant User
  participant Content as Content (scroll)
  participant Spy as ScrollSpy
  participant Sidebar as Section Buttons

  User->>Content: scrolls
  Content->>Spy: IntersectionObserver callback
  Spy->>Spy: pick topmost intersecting section (rAF debounced)
  Spy->>Sidebar: activeSectionId updates (reactive)
  Note over Sidebar: .active stays a state hook — no visual highlight<br/>(deliberately removed; only the category button is highlighted)

  User->>Sidebar: clicks a section button
  Sidebar->>Content: scrollIntoView(smooth, block:start)
  Content->>Spy: new intersection triggers
```

## Two-Level Sidebar Layout

```mermaid
flowchart TB
  subgraph Sidebar["Sidebar (vertical)"]
    direction TB
    Cat1["Category: video-item"]
    Sub1["  └ Styling (active)
  └ Views
  └ Date
  └ Avatar
  └ Menu-Icon
  └ Auto-Sync Badge"]
    Cat2["Category: menubar"]
    Cat3["Category: ads-promotions"]
    Cat4["Category: system"]
    Cat5["Category: about"]
    Iconbar["Iconbar: export / import / reset / github"]
  end

  Cat1 --> Sub1
  Cat2 -.->|sections appear when active| empty
  Iconbar
```

## What Was Removed (Old Model)

| Old Component           | Replaced By                          | Reason                                                             |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Accordion.svelte        | Section.svelte (no collapse)         | Single-open policy was manual overhead                             |
| AccordionGroup.svelte   | — (removed)                          | Context-based single-open scope not needed                         |
| accordionGroupRegistry  | ScrollSpy (IntersectionObserver)     | Global string-ID registry was fragile                              |
| Group.svelte            | Section.svelte (with toggleKey)      | Collapse + toggle merged into flat section header                  |
| TABS (App.svelte)       | CATEGORIES (categories.ts)           | Region-based categories, future-proof                              |
| scrollToSubsection      | scrollToSection (direct, no timeout) | No 240ms transition wait — sections always visible                 |
| switchTab setTimeout(0) | switchCategory (sync)                | No mount-race — no auto-open needed                                |
| PillNav.svelte          | Section buttons in CategorySidebar   | Horizontal pills don't scale (overflow); sidebar scales vertically |

## References

- Navigation: `src/lib/gui/navigation/categories.ts`, `src/lib/gui/navigation/scrollSpy.svelte.ts`
- Masonry: `src/lib/gui/navigation/section-masonry.ts` (pure: `layoutMasonry`)
- Components: `src/lib/gui/components/CategorySidebar.svelte`, `src/lib/gui/components/Section.svelte`
- App shell: `src/lib/gui/App.svelte`

Verified: 2026-10-25 — against `src/lib/gui/navigation/categories.ts` (9 categories; video-item: 9 sections incl. preview-delay; ads-promotions: 3 sections; watch-page: 1 section), `src/lib/gui/navigation/section-masonry.ts` (rAF coalescing), `src/lib/gui/App.svelte` (focus trap, keyboard resize, a11y.resize* labels), `src/lib/gui/components/CategorySidebar.svelte` + `src/lib/gui/panel.css` (re-checked 2026-10-25: section-sub-btn `.active` carries no visual highlight anymore — red border + white text removed, category-button `.active` unchanged; scroll-spy `.active` state hook retained) @ working tree
