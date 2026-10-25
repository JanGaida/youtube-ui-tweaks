<h1 align="center"><a name="youtube-ui-tweaks-icon"><img src="https://cdn.jsdelivr.net/gh/JanGaida/youtube-ui-tweaks@main/src/assets/icon.svg" width="32" alt="YouTube UI Tweaks icon" align="texttop"></a> YouTube UI Tweaks</h1>

> Fine-grained, runtime-based control over the YouTube UI — sidebar, masthead, grid metadata, chip bars, ads, and more. Everything is configurable in an in-page settings panel and applies live, without reloading.

<div align="center">

[![Version](https://img.shields.io/github/package-json/v/JanGaida/youtube-ui-tweaks)](https://github.com/JanGaida/youtube-ui-tweaks/releases)
[![Last commit](https://img.shields.io/github/last-commit/JanGaida/youtube-ui-tweaks)](https://github.com/JanGaida/youtube-ui-tweaks/commits/main)
[![CI](https://github.com/JanGaida/youtube-ui-tweaks/actions/workflows/ci.yml/badge.svg)](https://github.com/JanGaida/youtube-ui-tweaks/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![⚡ Install via Tampermonkey](https://img.shields.io/badge/%E2%9A%A1_Install_via-Tampermonkey-00485B.svg)](https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js)

</div>

A Tampermonkey userscript built with Svelte 5 that lets you reshape YouTube to your taste — hide what you never use, compact what you read at a glance, and keep the rest native. All tweaks apply through scoped CSS (`.yt-tweaks-*` prefix) and targeted DOM mutations, designed to coexist with other extensions and scripts.

## ✨ Features

<details>
<summary><strong>Scannable video grids</strong> — compact titles & metadata, shortened views & dates</summary>

- **Styling** — title & metadata font-size/line-height presets, meta spacing, alignment, title max-lines, equal-height enforcement
- **Views shortening** — `1.234.567 → 1,2M`, rounding mode (round/truncate), decimals, custom suffixes (k/M/B/T), optional views word
- **Date shortening** — `vor 4 Jahren → 4Y` with per-unit suffixes, optional eye/clock icons in front of views/dates
- **Channel icon** — hide, resize (20–64 px), right margin
- **Menu button** — hide the 3-dot button, or resize it
- **Auto-sync badge** — hide the "auto-synced" badge, or integrate its icon into the metadata row with a custom divider
- **Hide elements** — verified badge (extensible hide group)
- **Dim watched** — fade thumbnails/text of partially or fully watched videos, with configurable intensity steps
- **Preview delay** — delay the hover video-preview by 0–10 s (adds on top of YouTube's native delay)

</details>

<details>
<summary><strong>Your masthead, your buttons</strong> — hide native controls, add up to 8 custom ones</summary>

- Hamburger menu, search bar, and notification button visibility
- Up to 8 **custom buttons** (History, Subscriptions, Playlists, Watch later, Liked videos, My videos, Downloads, Settings) — place them left/right, reorder by drag-and-drop
- Spacing + alignment controls, hover opacity, animation speed

</details>

<details>
<summary><strong>A sidebar with only what you use</strong> — reorder, hide, resize</summary>

- Visibility modes: native, hide-override, hide-forced
- Width presets (compact/default/large), collapsed-mode text hiding
- **Reorder and hide entries and whole groups** via drag-and-drop, plus global "Show more" control

</details>

<details>
<summary><strong>Chip bars your way</strong> — recolor, reflow, or hide them</summary>

- Home filter chips and watch-page related chips: custom active/inactive colors (presets or hex), layout modes (native carousel, wrapping stack — watch only —, or hide)

</details>

<details>
<summary><strong>Clutter-free start & watch pages</strong> — grid density, foldable description, hidden distraction buttons</summary>

- Grid column-count override for home/subscriptions/channel pages (1–10 or custom)
- Watch page: hide member button, like/dislike, share/save/download buttons, click-to-fold description with line-count

</details>

<details>
<summary><strong>Just videos, no promo noise</strong> — Premium banner, surveys & promo shelves gone</summary>

- Hide the Premium banner, promo shelves, surveys, playables, and member-only content — each individually toggleable

</details>

<details>
<summary><strong>You stay in control</strong> — kill-switch, anonymize mode, draggable settings panel</summary>

- Global kill-switch (restores the page to its native state)
- Anonymize mode (blurs metadata, avatars, and thumbnails for clean screenshots)
- Resizable, draggable settings panel with per-category scroll memory
- Panel language (Deutsch/English), logging verbosity, live status stats

</details>

## 📥 Installation

[![⚡ Quick install via Tampermonkey](https://img.shields.io/badge/%E2%9A%A1_Quick_install_via-Tampermonkey-00485B.svg?style=for-the-badge)](https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js)

One click — Tampermonkey ([the only prerequisite](https://www.tampermonkey.net/)) picks up the script from the latest GitHub release and prompts to install. Updates install themselves automatically via the userscript's `updateURL`. Afterwards, open the settings panel from the Tampermonkey menu command (labeled _Einstellungen_ on German YouTube, _Settings_ otherwise).

## 🔨 Building from Source

Requires Node.js.

```bash
git clone https://github.com/JanGaida/youtube-ui-tweaks.git
cd youtube-ui-tweaks
npm install
npm run build      # → dist/youtube-ui-tweaks.user.js
```

Install the built `dist/youtube-ui-tweaks.user.js` in Tampermonkey.

## 🧪 Development

```bash
npm run check       # svelte-check + tsc typecheck (includes tests)
npm test            # vitest unit + fixture tests
npm run test:e2e    # Playwright E2E (Firefox, against captured fixtures)
npm run docs:check  # architecture-docs gate
npm run format      # prettier
```

## 📸 Capturing Fixtures

The fixture and E2E suites run against real YouTube DOM snapshots that are **deliberately not committed** (they contain personal page data). Capture your own set locally:

1. Build the dev script: `npm run build:dev` → `dist/youtube-ui-tweaks.dev.user.js` (capture tooling included)
2. Install it in Tampermonkey, replacing the production script
3. Log into YouTube — auth-gated fixtures (subscriptions, member-only) need a session
4. Tampermonkey menu → **Capture All Fixtures** — the batch navigates to each preset page (home, subscriptions, channel, search, masthead, guide-full, guide-mini, member-only) and auto-downloads every `.fixture.html`
5. Move the downloads into `src/lib/core/__fixtures__/`
6. `npm test` — the fixture tests now run against your captures

> ! Capture runs against live youtube.com and is deliberately manual — CI never captures (YouTube withholds data from automation-driven browsers). Recapture when fixture tests go red after a YouTube DOM change. Full details: [CONTEXT.md — Fixture Capture](CONTEXT.md#fixture-capture-dev-only)

## 🧩 Compatibility

- Designed to work alongside other YouTube extensions and scripts — scoped CSS (`.yt-tweaks-*` prefix) and targeted DOM mutations only
- Works with YouTube's Trusted Types CSP (no `innerHTML` injection — Svelte compiles to imperative DOM APIs)
- Runs at `document-start` to prevent flash-of-unstyled-content (CSS injects before page render)

## 💾 Settings Persistence

All settings are stored via Tampermonkey's `GM_setValue`/`GM_getValue` under the key `ytTweaksSettings`. Panel position is stored separately under `ytTweaksPanelPos`, and the active category + scroll position under `ytTweaksPanelUi`. Settings survive browser restarts and script updates, and can be exported/imported as JSON from the panel.

## 🏗️ Tech Stack

| Tool                                                                | Purpose                                                                                     | License    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| [Svelte 5](https://svelte.dev/) (Runes)                             | Settings-panel UI — compiles to imperative DOM APIs, satisfying YouTube's Trusted Types CSP | MIT        |
| [TypeScript](https://www.typescriptlang.org/)                       | Type safety across the whole codebase                                                       | Apache-2.0 |
| [Vite](https://vitejs.dev/)                                         | Bundler & dev server                                                                        | MIT        |
| [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) | Bundles everything into a single-file userscript incl. the Tampermonkey metadata header     | MIT        |
| [Vitest](https://vitest.dev/)                                       | Unit + fixture tests                                                                        | MIT        |
| [Playwright](https://playwright.dev/)                               | E2E tests (Firefox) against captured DOM fixtures                                           | Apache-2.0 |

## 🤝 Contributing

Development setup, architecture, and conventions are documented in [CONTEXT.md](CONTEXT.md) and [docs/architecture/](docs/architecture/INDEX.md).

## ⚖️ License

[GPL-3.0](LICENSE) © 2026 Jan Gaida
