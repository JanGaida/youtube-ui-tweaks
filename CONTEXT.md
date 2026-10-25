# CONTEXT — Developer Guide

> Know-how & development flow for new agents sessions and contributors.
> End-user-facing doc: see [README.md](README.md).

## What This Is

A Tampermonkey userscript that tweaks the YouTube UI across many surfaces: video-grid metadata (typography presets, avatars, menu buttons), text shortening (view counts, relative dates), ads/promo/survey hiding, guide sidebar (visibility, width, entry/group reordering), masthead (custom buttons, spacing), chip bars, startpage grid columns, watch-page layout, dimming of watched videos, preview delay, and an anonymize layer. All configurable via an in-page settings panel (`GM_registerMenuCommand`, 9 categories).

Built with **Svelte 5 (Runes) + TypeScript**, bundled by **Vite + vite-plugin-monkey** into a single `.user.js`.

## Stack & Tooling

| Layer              | Tool                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Svelte 5 (Runes — `$state`, `$derived`, `$props`, `$effect`)                                                              |
| Language           | TypeScript (strict via `@tsconfig/svelte`)                                                                                |
| Bundler            | Vite 8                                                                                                                    |
| Userscript wrapper | vite-plugin-monkey 8                                                                                                      |
| Typecheck          | `svelte-check` + `tsc` (combined in `npm run check`; includes the test files via `tsconfig.json`)                         |
| Docs gate          | `npm run docs:check` — `scripts/check-docs.mjs` (coverage, references, Verified footers)                                  |
| Format             | Prettier (4-space, double-quote) — `npm run format` / `format:check`                                                      |
| Test               | Vitest 4 (pure-logic `node` env + DOM/fixture `jsdom` env, ~373 tests in 29 files) — `npm run test`                       |
| E2E                | Playwright (Firefox — Zielplatform) against hosted fixtures + live-YouTube capture task — `npm run test:e2e` (local-only) |

### Commands

```bash
npm install        # install deps
npm run check      # svelte-check + tsc — typecheck gate (must be green before commit; includes tests)
npm test           # vitest run — pure-logic + jsdom fixture tests (~373 tests, 29 files)
npm run test:e2e   # playwright test — E2E against locally hosted fixtures (needs `npm run build`)
npm run test:e2e:ui # playwright --ui — interactive E2E debugging (time-travel, watch mode)
npm run docs:check # architecture-docs gate (feature coverage, reference paths, Verified footers)
npm run build      # production build (capture stripped, minified) → dist/youtube-ui-tweaks.user.js
npm run build:dev  # dev build (fixture-capture tooling included, unminified) → dist/youtube-ui-tweaks.dev.user.js
npm run format     # prettier --write . (4-space auto-fix)
npm run format:check # prettier --check . (CI gate)
npm run dev        # vite dev server (HMR — not useful for userscript testing, see Dev Workflow below)
```

**Build output**: prod → `dist/youtube-ui-tweaks.user.js`, dev → `dist/youtube-ui-tweaks.dev.user.js` (distinct name so E2E `dev` mode provably tests the dev artifact). The file you install in Tampermonkey is the prod build. The userscript header (metadata block) is generated from `vite.config.ts` `monkey.userscript` block, NOT hand-written.

## Project Structure

```
src/
├── main.ts                      # Boot sequence (@run-at document-start)
├── app.css                      # Empty (panel styles in gui/panel.css)
├── vite-env.d.ts                # Ambient types (GM_* globals)
├── assets/
│   ├── icon.svg                 # Userscript icon (referenced via jsdelivr in vite.config)
│   └── masthead-icons/          # 8 custom-button SVGs (history, subscriptions, playlists, ...)
└── lib/
    ├── app/panel.ts             # openSettings/closeSettings — panel orchestration (mount/unmount)
    ├── core/                     # Framework-free logic (pure TS, no DOM framework)
    │   ├── log.ts                # Logger (LOG_LEVELS, setLogLevel, log, isDebugEnabled)
    │   ├── settings.ts           # DEFAULT_SETTINGS + types + GM_setValue/getValue persistence + migrations
    │   ├── locale.ts             # LOCALE_PATTERNS (content-matching regex, de/en) + detectLocale
    │   ├── css.ts                # CSS generation + injection (STYLE_ID, applyCSS)
    │   ├── text.ts               # View/date shortening (formatViewsNumber, shortenText, runTextShorten)
    │   ├── ads.ts                # Ads restore helpers (member-only detection)
    │   ├── badge.ts              # Auto-sync badge DOM pass (integrate/restore)
    │   ├── masthead.ts           # Masthead custom-button injection (hideMasthead(settings, locale))
    │   ├── mastheadIcons.ts      # SVG icon strings for custom masthead buttons
    │   ├── page.ts               # PageCtx (detectPage + initPageContext + recomputePageCtx + SPA listeners)
    │   ├── registry.ts           # FeatureRegistry: runAll/css/live-apply/restoreAll dispatch
    │   ├── observer.ts           # MutationObserver + 200ms throttle + live-apply scheduling + restoreAndRunAll
    │   ├── feature.types.ts      # Feature/PageBehavior contracts
    │   ├── system-toggle.ts      # Kill-switch (system.tweaksEnabled)
    │   ├── anonymize.ts          # Blur layer (system.anonymize, own <style>)
    │   ├── guide-sidebar-state.ts # FSM for guide-sidebar visibility (hide-override/hide-forced)
    │   ├── features/             # 19 feature files + index.ts (registerAllFeatures — 16 features)
    │   │   ├── index.ts          # registerAllFeatures() + getComposedDefaults()
    │   │   ├── grid-styling.ts   # Title/meta typography presets, avatar, menu button
    │   │   ├── auto-sync-badge.ts # Badge integrate/hide modes
    │   │   ├── dim-watched.ts    # Watched-video dimming (buckets)
    │   │   ├── preview-delay.ts  # Hover-preview delay (pointerenter gate)
    │   │   ├── text-shorten.ts   # Registry wrapper for text.ts
    │   │   ├── hide-elements.ts  # Verified-badge hide (aria-label anchor)
    │   │   ├── ads-hide.ts       # Three gated groups: promo / shelves / survey
    │   │   ├── masthead-css.ts   # Masthead visibility + spacing CSS
    │   │   ├── masthead-buttons.ts # Custom buttons injection (locale-aware labels)
    │   │   ├── guide-visibility.ts # Guide pane visibility modes
    │   │   ├── guide-styling.ts  # Guide width presets
    │   │   ├── guide-entries.ts  # Entry/group reorder + hide (idempotency incl. DOM liveness)
    │   │   ├── feed-chips.ts     # Home chip colors
    │   │   ├── watch-chips.ts    # Watch sidebar chip colors + layout
    │   │   ├── startpage-grid.ts # Grid column-count override
    │   │   ├── watch-page.ts     # Watch-page hides + description click-fold
    │   │   ├── chip-layout.ts    # (helper — stack-layout CSS, not a feature)
    │   │   ├── guide-groups.ts   # (helper — guide section grouping, not a feature)
    │   │   └── meta-icons.ts     # (helper — eye/clock icon CSS, not a feature)
    │   ├── __tests__/            # 29 vitest files + fixture-harness.ts + setup.ts
    │   └── __fixtures__/         # Captured YouTube DOM (gitignored — privacy, see Fixture Capture)
    ├── dev/
    │   ├── capture.ts           # Fixture-capture tooling (dev build only, __DEV_CAPTURE__-gated)
    │   └── CaptureProgress.svelte
    ├── stores/
    │   ├── settings.svelte.ts    # Runes store ($state<Settings>) — single source of truth
    │   └── validation.svelte.ts  # Reactive validation state
    └── gui/                       # Svelte 5 components
        ├── App.svelte            # Panel root: header/drag/esc/backdrop/9 categories + focus trap + resize handles
        ├── i18n.svelte.ts        # TRANSLATIONS (de/en, 443 keys each) + reactive t() via $derived
        ├── icons.ts              # SVG path strings (CAT_ICONS + SUB_ICONS)
        ├── panel.css             # All .yt-tweaks-* classes (global)
        ├── types.ts              # Shared GUI types (SelectOption, DebugStats)
        ├── components/            # Reusable UI primitives
        │   ├── Icon.svelte        # Declarative SVG (Trusted-Types-safe, no {@html})
        │   ├── Field.svelte       # labeledInlineField (label + slot)
        │   ├── TextInput.svelte   # text input + rem-validation (invalid rem never persists)
        │   ├── Select.svelte      # custom dropdown (fixed popout, separate reposition/scroll rAF ids)
        │   ├── Segmented.svelte   # segmented control (single tab stop)
        │   ├── Switch.svelte      # toggle (track/thumb/input, accessible name)
        │   ├── Stepper.svelte     # −[n]+ pill bound to numeric path (long-press cleaned on destroy)
        │   ├── DraggableRow.svelte # drag row (grip button, ArrowUp/Down keyboard reorder)
        │   ├── Section.svelte     # flat titled section (no collapse)
        │   ├── Subsection.svelte  # titled sub-region within a Section
        │   └── CategorySidebar.svelte  # two-level nav: categories + section buttons (scroll-spy)
        ├── navigation/            # Navigation infrastructure
        │   ├── categories.ts      # 9 category definitions (id → sections → label/icon)
        │   ├── scrollSpy.svelte.ts # IntersectionObserver-based scroll-spy (reactive)
        │   └── section-masonry.ts  # Balanced-masonry layout (pure layoutMasonry, rAF dedupe)
        └── tabs/                  # One tab per category
            ├── VideoItemTab.svelte     # Video-Item: styling/views/date/avatar/menu-icon/badge/hide/dim/preview-delay
            ├── MenubarTab.svelte       # Menubar: search/left(hamburger)/right/custom-buttons/styling
            ├── GuideSidebarTab.svelte  # Guide-Sidebar: visibility/styling/entry-hide-sort/groups
            ├── FeedChipsTab.svelte     # Feed-Chips: enable/active-color/layout
            ├── StartpageTab.svelte     # Startpage: grid-column-count override (home/abo/channel)
            ├── WatchPageTab.svelte     # Watch-Page: member/like-dislike/share/save/download hide + description QoL
            ├── AdsPromotionsTab.svelte # Ads & Promotions: 3 gated groups (promo/shelves/survey)
            ├── SystemTab.svelte        # System: tweaks/panel/logging/status
            └── AboutTab.svelte         # Static version/author/github/changelog
```

## Architecture

### Two-Part Split

The codebase has two clearly separated concerns:

1. **Core** (`lib/core/`): Framework-free DOM mutation logic — CSS injection, text shortening, ads hiding, MutationObserver. Runs at `document-start` (before `document.body` exists). No Svelte, no framework.

2. **GUI** (`lib/gui/`): Svelte 5 settings panel. Mounted **lazily** when the user opens settings via `GM_registerMenuCommand` — never at `document-start`.

### Boot Sequence (`main.ts`)

```
@run-at document-start
  │
  ├─ registerAllFeatures()     # 16 features register BEFORE CSS (registry generates the CSS)
  ├─ store.load()              # Load settings from GM_getValue (try/catch → defaults)
  ├─ initPageContext(settings, callback)  # PageCtx + SPA listeners (yt-navigate-finish, popstate)
  ├─ detectLocale()            # YouTube content language (document.documentElement.lang)
  ├─ setLogLevel()             # Apply debug.logLevel
  └─ applyCSS()                # Inject <style> immediately (before page renders — avoids FOUC)
       │                        (skipped when system.tweaksEnabled === false)
       ▼
   DOMContentLoaded
        │
        ├─ recomputePageCtx()   # Re-detect page + locale (documentElement.lang may have been absent at boot)
        ├─ runAll()             # Initial feature dispatch
        ├─ startObserver()      # MutationObserver on #content (200ms THROTTLE, leading+trailing)
        └─ if debug.autoOpen → setTimeout(openSettings, 300)
             │
             ▼
       openSettings() (lazy, via GM menu or autoOpen)
         │
         ├─ create <div> in document.body
         ├─ mount(App, { target })   # Svelte 5 mount
         └─ onClose → unmount()       # Cleanup on close
```

The GM menu label is locale-aware: `Einstellungen` on German YouTube, `Settings` otherwise.

### Data Flow: Store ↔ Observer

```
store.settings ($state<Settings>)  ──┐
  ▲                                  │ setCurrentSettings() + updatePageCtxSettings()
  │ save()/reset()/setByPath()       ▼
  │                            observer.currentSettings (display ref)
  │                                  │
  ▼                                  ▼
GUI components                registry.runAll(PageCtx) — feature dispatch
(read via $derived)           (registry reads currentSettings + currentLocale)
```

The store is the **single source of truth**. GUI mutations (`setByPath`) call `setCurrentSettings()` to sync the observer's reference, then `scheduleLiveApply()` (registry-level **150ms DEBOUNCE** — batches rapid input; key matching is prefix-based, so `"guide.entries.hidden.<id>"` matches the registered key `"guide.entries.hidden"`). The observer's MutationObserver pass uses a **200ms THROTTLE** (leading+trailing edge — a pure trailing debounce would never fire during continuous scrolling). Wholesale settings replacement (`reset()`/`importJson()`) flushes the debounce and calls `restoreAndRunAll()` — a full restore of every feature's DOM mutations, then re-apply from the new settings. The observer never owns state — it reads what the store provides.

### i18n (`gui/i18n.svelte.ts`)

- `TRANSLATIONS: Record<"de" | "en", Record<string, string>>` — 443 keys per language (de/en key sets identical)
- Key structure: `cat.*` (category labels), `sec.*` (section titles + `.desc` descriptions), `field.*` (field labels), `opt.*`/`optdesc.*` (select options + descriptions), `subsec.*` (in-section sub-groups), `a11y.*` (accessible names — incl. the 8 `a11y.resize*` labels for the focusable resize-handle buttons), `ads.*`, `about.*`, `btn.*`, `msg.*`, `close.title`
- `t(key)` is reactive: reads `gui.locale` setting via internal `$derived` → labels update instantly on locale switch (no remount)
- `resolveGuiLocale("auto")` → `detectLocale()` (YouTube content language); unknown → `en` fallback
- `gui.locale` values: `"auto"` (default) | `"de"` | `"en"`
- **Content-matching** (`LOCALE_PATTERNS` in `locale.ts`) is **separate** from GUI i18n — adding a GUI language does NOT add content-matching patterns. See [Open Work](#open-work).

## Critical Constraints

### Trusted Types CSP (YouTube)

YouTube enforces `require-trusted-types-for 'script'` — `innerHTML` sinks are blocked. Implications:

- **Svelte 5 is safe**: compiles templates to imperative DOM API calls (`createElement`, `appendChild`, `textContent`) — no `innerHTML` in our component code.
- **Never use `{@html}`** in Svelte components — it would use the `innerHTML` sink.
- **Icons**: `Icon.svelte` builds SVG declaratively (`<svg><path d={...} /></svg>`), not via string injection.
- **CSS**: `applyCSS()` uses `el.textContent = css` (safe), not `innerHTML`.
- **Panel CSS**: imported via `import "./panel.css"` — Vite injects via `textContent`.

If you add a component that needs raw HTML, find a declarative alternative. The `{@html}` helper exists in the Svelte runtime (dead code for us) but is never invoked.

### `@run-at document-start`

CSS must inject before YouTube renders to avoid FOUC. At `document-start`, `document.head` may be `null` — `applyCSS()` falls back to `document.documentElement`. The GUI (`mount(App)`) must NOT run at `document-start` (no `document.body` yet) — it mounts lazily when settings open.

### GM_* Globals

`GM_getValue`, `GM_setValue`, `GM_registerMenuCommand` are Tampermonkey-provided globals. Types are declared in `src/vite-env.d.ts` (vite-plugin-monkey's own client types aren't resolvable via triple-slash — no `./client` exports map). The `@grant` directives in `vite.config.ts` must match what the code uses.

## Dev Workflow

### Making a Change

1. **Typecheck gate**: `npm run check` must be green. Run after every module change.
2. **Build**: `npm run build` → `dist/youtube-ui-tweaks.user.js`.
3. **Test in Tampermonkey**: Install/update the built userscript, open YouTube, open settings via Tampermonkey menu command "Einstellungen" (or via `debug.autoOpen` setting for dev convenience).
4. **HMR (`npm run dev`) is NOT useful** for userscript logic — the dev server serves a normal web page, not the YouTube context. Use it only for isolated GUI component development, not for testing the core/observer logic.

### Enabling `debug.autoOpen`

For rapid iteration: open settings once, go to System → Panel → toggle Auto-Öffnen, Save. Next page load auto-opens the panel after 300ms. Disable before release.

### Adding a New Setting

1. Add field to `DEFAULT_SETTINGS` + interface in `src/lib/core/settings.ts`
2. Add UI control in the relevant tab (`tabs/*.svelte`) inside a `Section.svelte` — bind via `store.setByPath(path, value)`. If it's a new section, also add a `SectionDef` entry to the category in `navigation/categories.ts` + an i18n `sec.*` key.
3. If it affects CSS: handled automatically by `generateCSS()` (reads the setting)
4. If it affects DOM mutations: add the settings path to the feature's `liveApplyKeys` (`src/lib/core/features/<name>.ts`) — prefix-matched by the registry's live-apply
5. Add i18n key to `TRANSLATIONS` (both `de` and `en` — run key-drift check)
6. `npm run check` + `npm run build`

### Adding a GUI Translation Language

1. Add locale code to `TRANSLATIONS` in `i18n.svelte.ts` (e.g. `"fr": { ... }`) — copy all 443 keys from `en`, translate values
2. Update `GuiLocale` type: `"de" | "en"` → add `"fr"`
3. Add to `getLocaleOptions()` in `i18n.svelte.ts`
4. Update `resolveGuiLocale()` if the language should be auto-detected from YouTube content language
5. Run key-drift check: compare key sets between all languages (see [Verification](#verification))

### Adding Content-Matching (LOCALE_PATTERNS)

Separate from GUI i18n. Requires verifying the actual YouTube UI strings in that language (open YouTube with language set to `fr`, inspect the view-count/date text). Add regex patterns to `LOCALE_PATTERNS[locale]` in `locale.ts`. Update `detectLocale()` fallback if needed.

## Testing

Two test layers via Vitest (29 test files, ~373 tests), plus a Playwright E2E layer, plus manual verification for the rest.

- **Pure-logic tests** (`node` env): `formatViewsNumber`, `detectPage`, CSS string builders, registry dispatch. No DOM.
- **DOM/fixture tests** (`jsdom` env, per-file `// @vitest-environment jsdom`): run selectors and feature transforms against captured YouTube DOM snippets in `src/lib/core/__fixtures__/`. Guard selector regressions (YT DOM changes → test rot). Fixtures are **gitignored** (privacy — see [Fixture Capture](#fixture-capture-dev-only)), so these suites wrap themselves in `describe.skipIf(!fixtureExists(...))` (helper: `__tests__/fixture-harness.ts`) and skip green on a fresh clone.
- **Typecheck includes tests**: `tsconfig.json` includes `src/**/*.ts` (the test files live under `src/`), so `npm run check` type-checks the test suite too.
- **E2E tests** (Playwright, Firefox — target platform): inject the built userscript + GM polyfill into a browser loading the hosted fixtures, then assert CSS injection, text-shorten re-run via MutationObserver, ads-hide CSS rules, anonymize, and panel mount/interaction. Run via `npm run test:e2e` (needs `npm run build` first; local-only — CI has no fixtures). Config: `playwright.config.ts`. Tests: `e2e/tests/*.spec.ts` (smoke, css-injection, text-shorten, ads-hide, anonymize, panel-interaction). Helpers: `e2e/helpers/`.
- **Manual**: observer firing, throttle/debounce timing, visual rendering/layout.

### E2E Architecture (Playwright)

```
e2e/
├── global-setup.ts        # Starts fixture server (http, FIXTURE_SERVER_PORT from helpers/fixture-server.ts = 4174) before tests
├── global-teardown.ts     # Stops fixture server after tests
├── helpers/
│   ├── gm-polyfill.ts     # GM_getValue/setValue/addStyle/registerMenuCommand polyfill (addInitScript)
│   ├── userscript.ts      # Loads dist/*.user.js, injects polyfill + userscript (polyfill via addInitScript,
│   │                      #   userscript via evaluate after load — see file for the document-start rationale)
│   └── fixture-server.ts  # node:http server wrapping __fixtures__/*.fixture.html as renderable docs
│                          #   (single-sources FIXTURE_SERVER_PORT)
└── tests/                 # E2E specs (smoke, css-injection, text-shorten, ads-hide, anonymize, panel-interaction)
```

**Why userscript is injected after load, not via addInitScript**: the userscript was written for Tampermonkey's `@run-at document-start` and assumes `document.documentElement` exists. Playwright's `addInitScript` runs earlier (pre-document-start), so injecting the userscript there crashes `detectLocale` (null documentElement). The polyfill is `addInitScript` (persists across reloads, guards against null document); the userscript is `page.evaluate` after `page.goto`. This loses FOUC-avoidance (irrelevant for static fixtures).

**Why `alert()` is no-op'd in the polyfill**: the disable/enable toggle menu command calls `alert()`, which opens a native modal that blocks Playwright. The polyfill overrides `window.alert` to no-op (test-only; Tampermonkey shows real dialogs).

**Capture vs E2E separation**: E2E tests never touch live YouTube (local fixtures, no cookies, no ToS risk). Fixture capture runs in the real Firefox via Tampermonkey (dev build only) — never automated via Playwright, because YouTube's bot detection blocks Playwright-driven page loads (grid data fetch is silently withheld, leaving a skeleton shell). One config: `playwright.config.ts` (E2E, local fixtures).

### Fixture Capture (dev-only)

**Privacy decision:** fixtures are real captured YouTube DOM (including personal subscription data) — they are **deliberately gitignored and never published** (see `.gitignore`). Consequences: fixture-based tests skip via `describe.skipIf(!fixtureExists(...))` on a fresh clone, CI runs without them, and the docs gate (`scripts/check-docs.mjs`, project hook 3 `GLOBALLY_IGNORED_PATH_RE`) downgrades `__fixtures__` doc references to warnings instead of failing.

Fixtures are real YouTube DOM snippets (HTML + computed styles + shadow-boundary markers) stored in `src/lib/core/__fixtures__/`. The capture tooling is **integrated into the userscript** and only present in `build:dev` (gated by the `__DEV_CAPTURE__` compile-time flag; stripped in production builds).

**Capturing a fixture:**

1. `npm run build:dev` → install the resulting `dist/youtube-ui-tweaks.dev.user.js` in Tampermonkey.
2. Open YouTube, navigate to a page with the target element (e.g. the homepage for a grid item).
3. Open settings (Tampermonkey menu → "Einstellungen") → System category → "Fixture Capture (dev)" group (only visible in dev build).
4. Select a fixture type from the dropdown → click "Capture & Download". The `.fixture.html` file auto-downloads.
5. Move the file into `src/lib/core/__fixtures__/`. Review/trim if needed.
6. `npm run test` — the fixture tests run against the new file.

**Quick capture** (no panel): Tampermonkey menu → "Capture Fixture (quick)" captures a home-grid-item immediately.

**Capture All** (one-click, all fixtures): Tampermonkey menu → **"Capture All Fixtures"** sequentially navigates to each preset's page (home, subscriptions, channel, search, masthead, guide-full, guide-mini, member-only) and auto-downloads every `.fixture.html`. After the run, move the downloads from your Firefox download folder into `src/lib/core/__fixtures__/` (overwrite existing files).

! Playwright-driven capture was tried and abandoned — YouTube's bot detection silently withholds grid data when the browser is automation-controlled (the page renders only a skeleton shell). Capture must run in a real Firefox via Tampermonkey.

```bash
npm run build:dev        # dev build (capture tooling + "Capture All" menu entry present)
# load dist/youtube-ui-tweaks.dev.user.js into Tampermonkey in your real Firefox
# Tampermonkey menu → "Capture All Fixtures" → move downloads into __fixtures__/
npm run build            # restore prod build
npm test                 # vitest fixture tests run against the new captures
```

! Fixture capture touches live youtube.com — run manually, never in CI. For auth-gated fixtures (subscriptions, member-only), ensure you're logged into YouTube in the real Firefox first.

**Recapture when:** a fixture test goes red (YouTube changed its DOM) or a new feature needs a new fixture type (add a preset in `src/lib/dev/capture.ts`).

**Missing fixtures** (referenced by feature code but not yet captured):

| Fixture     | YT page                                   | Captures                                                      | Feature code                  |
| ----------- | ----------------------------------------- | ------------------------------------------------------------- | ----------------------------- |
| `badge-row` | Home/subscriptions (grid item with badge) | `.ytContentMetadataViewModelMetadataRow`, `.ytBadgeShapeIcon` | `features/auto-sync-badge.ts` |

**Synthetic fixture** (hand-built, NOT captured — committed to the same gitignored `__fixtures__/` dir):

| Fixture             | Source                                         | Covers                                                                                                                                                          | Feature code             |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `lockup-meta-split` | User-reported LIVE DOM 2026-10-24 (Fall 1/2/3) | Current ONE-row lockup metadata (names + views + date mixed) — the 2026-08-23 home capture has SEPARATE rows per part and can no longer exercise the split pass | `features/meta-split.ts` |

`guide-full`/`guide-mini` are captured; the earlier `home-promo-shelf`/`home-discover-shelf` presets are no longer referenced by feature code (the promo/discover shelves are hidden via CSS `:has()` selectors that don't need a fixture). To capture `badge-row`: add a preset in `src/lib/dev/capture.ts`, run "Capture All Fixtures" (or capture individually via the panel).

**jsdom limit:** jsdom has limited shadow-DOM support. Selectors ending in shadow DOM are marked `shadowBoundary: true` in the fixture meta; tests for those should be skipped with a `// * shadow-dom: manually verified` comment. ~70-80% of selectors are light-DOM-testable.

## Verification

### Typecheck

```bash
npm run check   # 0 errors, 0 warnings required
```

`tsconfig.json` sets `noEmit` — REQUIRED: without it `tsc` emits a stale `vite.config.js`/`vitest.config.js` next to the `.ts` originals, and Vite loads the stale `.js` with priority, silently ignoring config edits (this actually happened once — a emitted `vite.config.js` shadowed `vite.config.ts`). The test files under `src/lib/core/__tests__/` are included in this gate via the `src/**/*.ts` include pattern.

### Build

```bash
npm run build   # dist/youtube-ui-tweaks.user.js must have correct userscript header
```

### i18n Key-Drift Check

The `TRANSLATIONS.de` and `.en` key sets must be identical (443 keys each). Quick check (counts keys line-by-line inside the `de: {` / `en: {` blocks):

```bash
node -e "const c=require('fs').readFileSync('src/lib/gui/i18n.svelte.ts','utf8').split('\n');const grab=(m)=>{const i=c.findIndex(l=>l.trim()===m);const ks=[];for(let j=i+1;j<c.length;j++){if(/^\s{4}\},?\s*$/.test(c[j]))break;const k=c[j].match(/^\s*\"([a-zA-Z0-9_.-]+)\":/);if(k)ks.push(k[1]);}return ks;};const d=grab('de: {'),e=grab('en: {');console.log('de:',d.length,'en:',e.length);console.log('missing in en:',d.filter(k=>!e.includes(k)));console.log('missing in de:',e.filter(k=>!d.includes(k)));"
```

### Trusted Types Check

Grep the built userscript for `innerHTML` — should only show Svelte runtime dead code (never invoked) and string comparisons, not actual sinks:

```bash
# In dist/youtube-ui-tweaks.user.js: search for innerHTML — verify context is safe
```

## Conventions

- **Comments**: Better Comments tags — `!` important, `?` question, `TODO`, `FIXME`, `MARK:`, `//` dead code only. See `AGENTS.md` for full tag list.
- **CSS classes**: `.yt-tweaks-*` prefix, global (not scoped) in `panel.css`.
- **Settings paths**: dot-notation (`"styling.titleFontSize"`) — used by `store.setByPath` / `getByPath`.
- **No comments unless necessary** — code should be self-explanatory; comments explain _why_, not _what_.

## Release Workflow

- **Dev branch (local)**: work on a dev branch; keep the repo green with the gates below.
- **Merge to main**: squash-merge dev → main with a **Conventional Commits** message (`feat:`, `fix:`, `docs:`, `chore:`, ...).
- **Release automation**: `release-please` (`.github/workflows/release-please.yml` + `release-please-config.json`) watches main and maintains a release PR ("chore(main): release X.Y.Z") containing `CHANGELOG.md` + version bumps in **`package.json` AND `vite.config.ts`** (userscript `@version` header — kept in sync via the generic updater in `extra-files`).
- **Merging the release PR** creates the git tag `vX.Y.Z` + the GitHub Release, which triggers `.github/workflows/release.yml`: it builds the prod userscript and attaches `dist/youtube-ui-tweaks.user.js` to the Release.
- **Auto-update**: the userscript's `updateURL`/`downloadURL` point at `github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js` — Tampermonkey picks up every new Release without URL changes.
- **CI** (`.github/workflows/ci.yml`): runs `check` / `test` / `docs:check` / `format:check` / `build` on every push/PR to main — **no E2E** (fixtures are deliberately absent from the repo, fixture tests skip).

## Open Work

| Item                                   | Location                     | Note                                                                                                                                                                                                     |
| -------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content-matching locales (fr/es/da/nl) | `locale.ts` `TODO[locale]`   | Requires verifying YouTube UI strings per language — open by decision (needs live verification per language)                                                                                             |
| Missing fixture: `badge-row`           | `__fixtures__/`              | Referenced by `features/auto-sync-badge.ts` but not yet captured; fixture tests for it skip. See [Fixture Capture](#fixture-capture-dev-only) for the manual workflow.                                   |
| Fixtures deliberately unpublished      | `.gitignore`                 | Captured YouTube DOM includes personal data — tests skip when absent; docs gate tolerates references (hook 3). Re-capture locally after cloning. By decision, NOT an open item to "fix".                 |
| Verify release-please `extra-files`    | `release-please-config.json` | Confirm the generic updater actually bumps `vite.config.ts`'s `@version` on the FIRST real release (untested — no release has happened yet).                                                             |
| First publish-day checklist            | GitHub                       | Create the GitHub repo (`JanGaida/youtube-ui-tweaks`), push `main` (repo currently has no commits/remote), verify CI runs green, merge the first release PR and verify the asset + auto-update URL work. |
| video-items bug fix                    | (author-planned)             | Separate session planned by the author — details tracked outside this doc.                                                                                                                               |

Recently closed (do NOT reopen): `updateURL`/`downloadURL` set (GitHub Releases, see Release Workflow); `vite.config.ts` description typos fixed; tests included in the typecheck gate (`tsconfig.json` + `noEmit`); panel a11y keyboard support implemented (modal focus trap, keyboard resize on focusable handles, DraggableRow ArrowUp/Down reorder, accessible names via `a11y.*` i18n keys); guide-group sections use `.desc` i18n keys; ESLint removed (gates: check / test / docs:check / format:check / build).

## License

GPL-3.0 — see [LICENSE](LICENSE). The `@license` directive in `vite.config.ts` userscript block must stay `GPL-3.0` to match.
