# ![YouTube UI Tweaks icon](https://cdn.jsdelivr.net/gh/JanGaida/youtube-ui-tweaks@main/src/assets/icon.svg =44x44) YouTube UI Tweaks

> Fine-grained, runtime-based control over the YouTube UI — sidebar, masthead, grid metadata, chip bars, ads, and more. Everything is configurable in an in-page settings panel and applies live, without reloading.

[![⚡ Install via Tampermonkey](https://img.shields.io/badge/%E2%9A%A1_Install_via-Tampermonkey-00485B?style=for-the-badge)](https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js)

[![Version](https://img.shields.io/github/package-json/v/JanGaida/youtube-ui-tweaks)](https://github.com/JanGaida/youtube-ui-tweaks/releases)
[![Last commit](https://img.shields.io/github/last-commit/JanGaida/youtube-ui-tweaks)](https://github.com/JanGaida/youtube-ui-tweaks/commits/main)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Type: Tampermonkey](https://img.shields.io/badge/Type-Tampermonkey-00485B.svg)](https://www.tampermonkey.net/)
[![CI](https://github.com/JanGaida/youtube-ui-tweaks/actions/workflows/ci.yml/badge.svg)](https://github.com/JanGaida/youtube-ui-tweaks/actions/workflows/ci.yml)

A Tampermonkey userscript built with Svelte 5 that lets you reshape YouTube to your taste — hide what you never use, compact what you read at a glance, and keep the rest native. All tweaks apply through scoped CSS (`.yt-tweaks-*` prefix) and targeted DOM mutations, designed to coexist with other extensions and scripts.

## Features

### Video Grid Items

- **Styling** — title & metadata font-size/line-height presets, meta spacing, alignment, title max-lines, equal-height enforcement
- **Views shortening** — `1.234.567 → 1,2M`, rounding mode (round/truncate), decimals, custom suffixes (k/M/B/T), optional views word
- **Date shortening** — `vor 4 Jahren → 4Y` with per-unit suffixes, optional eye/clock icons in front of views/dates
- **Channel icon** — hide, resize (20–64 px), right margin
- **Menu button** — hide the 3-dot button, or resize it
- **Auto-sync badge** — hide the "auto-synced" badge, or integrate its icon into the metadata row with a custom divider
- **Hide elements** — verified badge (extensible hide group)
- **Dim watched** — fade thumbnails/text of partially or fully watched videos, with configurable intensity steps
- **Preview delay** — delay the hover video-preview by 0–10 s (adds on top of YouTube's native delay)

### Masthead (Top Bar)

- Hamburger menu, search bar, and notification button visibility
- Up to 8 **custom buttons** (History, Subscriptions, Playlists, Watch later, Liked videos, My videos, Downloads, Settings) — place them left/right, reorder by drag-and-drop
- Spacing + alignment controls, hover opacity, animation speed

### Guide Sidebar

- Visibility modes: native, hide-override, hide-forced
- Width presets (compact/default/large), collapsed-mode text hiding
- **Reorder and hide entries and whole groups** via drag-and-drop, plus global "Show more" control

### Chip Bars

- Home filter chips and watch-page related chips: custom active/inactive colors (presets or hex), layout modes (native carousel, wrapping stack — watch only —, or hide)

### Startpage & Watch Page

- Grid column-count override for home/subscriptions/channel pages (1–10 or custom)
- Watch page: hide member button, like/dislike, share/save/download buttons, click-to-fold description with line-count

### Ads & Promotions

- Hide the Premium banner, promo shelves, surveys, playables, and member-only content — each individually toggleable

### System

- Global kill-switch (restores the page to its native state)
- Anonymize mode (blurs metadata, avatars, and thumbnails for clean screenshots)
- Resizable, draggable settings panel with per-category scroll memory
- Panel language (Deutsch/English), logging verbosity, live status stats

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Download the latest [`youtube-ui-tweaks.user.js`](https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js) from the **Releases** page
3. Open the downloaded file in your browser — Tampermonkey will prompt to install it
4. Open [youtube.com](https://www.youtube.com/) — your tweaks apply automatically
5. Open the settings panel via the Tampermonkey menu command (labeled _Einstellungen_ on German YouTube, _Settings_ otherwise)

Tampermonkey auto-updates: the userscript's `updateURL` points at the latest GitHub Release, so new versions install themselves.

## Building from Source

Requires Node.js.

```bash
git clone https://github.com/JanGaida/youtube-ui-tweaks.git
cd youtube-ui-tweaks
npm install
npm run build      # → dist/youtube-ui-tweaks.user.js
```

Install the built `dist/youtube-ui-tweaks.user.js` in Tampermonkey.

## Development

```bash
npm run check       # svelte-check + tsc typecheck (includes tests)
npm test            # vitest unit + fixture tests
npm run test:e2e    # Playwright E2E (Firefox, against captured fixtures)
npm run docs:check   # architecture-docs gate
npm run format      # prettier
```

> **Note on fixtures:** the E2E suite runs against captured YouTube DOM fixtures that are deliberately **not committed** (they contain real captured page data). Fixture-based tests skip automatically when the fixtures are absent — clone, develop, and run the unit suite anywhere; capture your own fixtures with `npm run build:dev` to run the full suite locally.

## Compatibility

- Designed to work alongside other YouTube extensions and scripts — scoped CSS (`.yt-tweaks-*` prefix) and targeted DOM mutations only
- Works with YouTube's Trusted Types CSP (no `innerHTML` injection — Svelte compiles to imperative DOM APIs)
- Runs at `document-start` to prevent flash-of-unstyled-content (CSS injects before page render)

## Settings Persistence

All settings are stored via Tampermonkey's `GM_setValue`/`GM_getValue` under the key `ytTweaksSettings`. Panel position is stored separately under `ytTweaksPanelPos`, and the active category + scroll position under `ytTweaksPanelUi`. Settings survive browser restarts and script updates, and can be exported/imported as JSON from the panel.

## Tech Stack

[Svelte 5](https://svelte.dev/) (Runes) + [TypeScript](https://www.typescriptlang.org/), bundled by [Vite](https://vitejs.dev/) + [vite-plugin-monkey](https://github.com/adamlui/vite-plugin-monkey) into a single-file userscript. Unit-tested with [Vitest](https://vitest.dev/), E2E-tested with [Playwright](https://playwright.dev/).

## Contributing

Development setup, architecture, and conventions are documented in [CONTEXT.md](CONTEXT.md) and [docs/architecture/](docs/architecture/INDEX.md).

## License

[GPL-3.0](LICENSE) © 2026 Jan Gaida
