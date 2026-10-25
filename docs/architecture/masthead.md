# Architecture: Masthead (Topbar) Features

> Topbar (`ytd-masthead`) tweaks, category "Menubar": one category, two features sharing
> the `styling.masthead` settings slice and one super-switch. `masthead-css` is the pure-CSS
> feature (hide buttons, search styling, hover opacity); `masthead-buttons` is the DOM-pass
> feature (custom shortcut bars, empty-notification hiding). Both apply globally (`*`) —
> the masthead exists on every page. Diagrams depict relationships, structure, and
> boundaries — no implementation details.

## Component Structure

```mermaid
flowchart TB
  subgraph GUI["gui/"]
    Tab["MenubarTab.svelte (5 sections)"]
    Nav["categories.ts (+menubar)"]
  end

  subgraph Store["stores/"]
    S["settings store"]
  end

  subgraph Core["core/ (framework-free)"]
    CSSF["masthead-css.ts feature"]
    BTF["masthead-buttons.ts feature"]
    MH["masthead.ts (DOM pass helper)"]
    Icons["mastheadIcons.ts (SVG ?raw imports)"]
    BTF -->|run: hideMasthead| MH
    BTF -->|restore: restoreMasthead| MH
    MH -->|button defs| Icons
    MH -->|settings button → openSettings| Panel["app/panel.ts"]
    CSSF -->|css: hide + search + opacity rules| YTStyle["&lt;style&gt; (registry-driven)"]
    MH -->|inject bars, marker data-yt-tweaks-masthead| DOM["ytd-masthead #container DOM"]
  end

  Tab -->|setByPath| S
  S -->|settings via ctx| CSSF
  S -->|settings via ctx| BTF
  Nav --> Tab
```

## CSS vs DOM-Pass Split

```mermaid
flowchart LR
  subgraph PureCSS["masthead-css (re-render-safe !important)"]
    C1[hide Create → #buttons &gt; ytd-button-renderer:first-child]
    C2[hide mic → #voice-search-button]
    C3[hide search button + re-round input → .ytSearchboxComponentSearchButton / #search-button-narrow]
    C4[hide hamburger icon → #guide-button]
    C5[hide notification always → ytd-notification-topbar-button-renderer]
    C6[search width → #center yt-searchbox flex vw]
    C7[idle opacity → #container, hover/focus-within → 1]
    C8[rightBarAlign=buttons → #end min-width: 0]
  end

  subgraph JSPass["masthead-buttons (idempotent hash)"]
    J1[custom button bars → #yt-tweaks-leftbar / #yt-tweaks-rightbar]
    J2[notification hide-when-empty → title-prefix detection]
  end

  PureCSS --> YTDOM["ytd-masthead"]
  JSPass --> YTDOM
```

**Why the split**: everything targetable by a stable selector is pure CSS. The two DOM
cases need JS: custom buttons must be built from scratch (icons via Vite `?raw` SVG
imports, locale-aware labels), and empty-notification detection reads `document.title`
(prefix `(N) `) — far more reliable than scraping the badge DOM, which Polymer re-renders
asynchronously.

**Hamburger vs guide pane**: `hideHamburger` hides only the `#guide-button` icon — the
guide pane itself is the guide-sidebar features' scope. When both are active, guide
conflict resolution handles the dead toggle path (see guide-sidebar.md).

## Custom Button Bars

```mermaid
flowchart TB
  subgraph Container["ytd-masthead #container (flex, space-between)"]
    Start["#start (logo)"]
    Left["#yt-tweaks-leftbar<br/>(insertBefore #center)"]
    Center["#center (search)"]
    Right["#yt-tweaks-rightbar<br/>(insertBefore #end)"]
    End["#end (Create/Avatar)"]
  end

  Order["resolveButtonOrder(styling.masthead.buttonOrder)"] --> Left
  Order --> Right
  Pos["per-button position: none | left | right"] --> Left
  Pos --> Right
  Align["leftBarAlign / rightBarAlign<br/>(logo|center|search / search|center|buttons)"] -->|"margin auto trick"| Left
  Align -->|"margin auto trick"| Right
```

- **Buttons**: history, subscriptions, playlists, watchLater, likedVideos, myVideos,
  downloads, settings — each `none | left | right`. Labels are locale-aware (de/en) via
  `PageCtx.locale`; the locale is part of the idempotency hash so a content-language switch
  re-renders labels.
- **Navigation**: a custom button clicks YT's own guide link
  (`a.yt-simple-endpoint[href=...]`) — Polymer SPA navigation — with `window.location.href`
  as fallback. The settings button opens the tweaks panel (`openSettings`) instead.
- **Why separate bars, not `#start`/`#buttons`**: inserting into YT's flex slots collided
  with the Create button and Polymer re-render loops. The bars are light-DOM flex children
  of `#container`, positioned by insertion order + the margin-auto trick against
  `space-between`.
- **Idempotency**: hash over button positions + order + spacings + aligns + locale; bars
  are never removed, only `display:none` when empty — otherwise the existence check in
  the early return would re-inject in a loop.

## Empty-Notification Hide

```mermaid
sequenceDiagram
  participant Run as hideMasthead (run)
  participant Title as document.title
  participant Bell as ytd-notification-topbar-button-renderer

  Note over Run: hideNotification == "empty" → register once
  Run->>Run: addEventListener yt-navigate-finish + popstate
  Run->>Title: regex ^\(\d+\)\s
  alt no (N) prefix → empty
    Run->>Bell: set data-yt-tweaks-notif-empty (CSS hides)
  else (N) prefix present
    Run->>Bell: remove attr (un-hide)
  end
  Note over Run, Bell: re-evaluated ONLY on SPA nav (path change) — a mid-page re-eval would hide the bell while the notification popup is open (title clears when the user reads)
```

## Scope Boundaries

```mermaid
flowchart TB
  subgraph Supported["Supported (global, all pages)"]
    A1[Hide Create / mic / search / hamburger / notification always - CSS]
    A2[Search width vw + idle hover-opacity of the top row - CSS]
    A3[Custom left/right shortcut bars with order + align + spacing - DOM]
    A4[Settings shortcut button opening the tweaks panel]
    A5[Notification hide-when-empty via title prefix]
  end

  subgraph NotSupported["Deliberately not supported"]
    B1[Modifying YT's own #start/#buttons children - Polymer re-render loops]
    B2[Badge-DOM scraping for notification detection - async/unreliable]
    B3[Guide pane visibility - guide-sidebar features scope]
    B4[Custom SVG upload - icons are fixed assets under src/assets/masthead-icons]
    B5[Mid-page bell re-evaluation - breaks the open notification popup]
  end
```

## References

- Features: `src/lib/core/features/masthead-css.ts`, `src/lib/core/features/masthead-buttons.ts`
- Helper: `src/lib/core/masthead.ts` (DOM pass — not a feature, consumed by masthead-buttons)
- Icons: `src/lib/core/mastheadIcons.ts` (SVGs from `src/assets/masthead-icons/history.svg` etc.)
- Settings: `src/lib/core/settings.ts` (`MastheadSettings`)
- Panel hook: `src/lib/app/panel.ts` (`openSettings`)
- GUI: `src/lib/gui/tabs/MenubarTab.svelte`
- Tests: `src/lib/core/__tests__/masthead-migration.test.ts` (settings migration; DOM run manually verified against the masthead fixture)

Verified: 2026-10-24 — against `src/lib/core/features/masthead-css.ts`, `src/lib/core/features/masthead-buttons.ts`, `src/lib/core/masthead.ts`, `src/lib/core/mastheadIcons.ts`, `src/lib/core/settings.ts`, `src/lib/gui/tabs/MenubarTab.svelte` @ working tree (re-checked 2026-10-25: `src/assets/masthead-icons/settings.svg` path data replaced with the correct Material `auto_fix_high` 24px silhouette — the previous path was corrupted (coordinates outside the 0 0 24 24 viewBox); structure unchanged: single-path SVG, parsed by `parseSvg`; re-checked 2026-10-25 after the ADR 0007 defaults change: DEFAULT_SETTINGS.styling.masthead now ships the curated baseline — hideCreateButton/hideMicButton/hideSearchButton true, searchWidthPct 30, history/subscriptions/watchLater "left", settings "right", reordered buttonOrder, rem spacings 1.3/0.25/1.3 — bar construction/align/hash logic unchanged; settings.ts comment-only re-pass, no behavior change)
