<h1 align="center"><a name="youtube-ui-tweaks-icon"><img src="https://cdn.jsdelivr.net/gh/JanGaida/youtube-ui-tweaks@main/src/assets/icon.svg" width="32" alt="YouTube UI Tweaks icon" align="texttop"></a> YouTube UI Tweaks</h1>

> Fine-grained, runtime-based control over the YouTube UI — sidebar, masthead, grid metadata, chip bars, ads, and more. Everything is configurable in an in-page settings panel and applies live, without reloading.

<div align="center">

[![Version](https://img.shields.io/github/package-json/v/JanGaida/youtube-ui-tweaks)](https://github.com/JanGaida/youtube-ui-tweaks/releases)
[![Last commit](https://img.shields.io/github/last-commit/JanGaida/youtube-ui-tweaks)](https://github.com/JanGaida/youtube-ui-tweaks/commits/main)
[![CI](https://github.com/JanGaida/youtube-ui-tweaks/actions/workflows/ci.yml/badge.svg)](https://github.com/JanGaida/youtube-ui-tweaks/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![⚡ Install via Tampermonkey](https://img.shields.io/badge/%E2%9A%A1_Install_via-Tampermonkey-00485B.svg)](https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js)

</div>

A Tampermonkey userscript built with Svelte 5 that reshapes YouTube to your taste — hide what you never use, compact what you scan, keep the rest native. Tweaks use scoped CSS (`.yt-tweaks-*`) and targeted DOM mutations, designed to coexist with other extensions.

## ✨ Features

<details>
<summary><strong>Scannable video grids</strong> — compact titles & metadata, shortened views & dates</summary>

- **Styling** — title/metadata size + line-height presets, spacing, alignment, max lines, equal heights
- **Meta layout** — native flow or split (names / views + date)
- **Views** — `1,234,567 → 1.2M`; rounding, decimals, suffixes, optional word
- **Dates** — `4 years ago → 4Y`; per-unit suffixes, optional eye/clock icons
- **Channel icon** — hide, resize (20–64 px), margin
- **Menu button** — hide or resize the 3-dot button
- **Auto-sync badge** — hide, or integrate into the metadata row with a custom divider
- **Hide elements** — verified badge (extensible group)
- **Dim watched** — fade thumbnails/text by watch progress and intensity
- **Preview delay** — add 0–10 s to YouTube's native hover delay

</details>

<details>
<summary><strong>Your masthead, your buttons</strong> — hide native controls, add up to 8 custom ones</summary>

- Hide hamburger icon, create button, notification, search/mic button; search width 20–80 vw
- 8 custom buttons (History, Subscriptions, Playlists, Watch later, Liked videos, My videos, Downloads, Settings) — left/right, drag to reorder
- Spacing/alignment, idle opacity, animation speed

</details>

<details>
<summary><strong>A sidebar with only what you use</strong> — reorder, hide, resize</summary>

- Modes: native, collapsed (expandable), always hidden
- Width presets (compact/default/large), icons-only mini-guide
- Drag to reorder/hide entries and groups; global "Show more" toggle

</details>

<details>
<summary><strong>Chip bars your way</strong> — recolor, reflow, or hide them</summary>

- Colors: active/inactive presets or hex
- Layout: native carousel, wrapping stack (watch only), or hidden

</details>

<details>
<summary><strong>Clutter-free start & watch pages</strong> — grid density, foldable description, hidden distraction buttons</summary>

- Grid columns 1–10 or custom (home, subscriptions, channel)
- Watch page: hide member, like/dislike, share/save/download; click-to-fold description with line count

</details>

<details>
<summary><strong>Just videos, no promo noise</strong> — Premium banner, surveys & promo shelves gone</summary>

- **Promo** — Premium banner, big-screen ads, member-only
- **Shelves** — Discover, Shorts, gaming, dynamic gaming, Playables, Continue Watching
- **Survey** — inline rating survey

</details>

<details>
<summary><strong>You stay in control</strong> — kill-switch, anonymize mode, draggable settings panel</summary>

- Kill-switch restores YouTube's native state; settings export/import as JSON
- Anonymize blurs titles, metadata, thumbnails, avatars, comments, and video
- Resizable, draggable panel with scroll memory
- German/English UI, log level, live stats, About tab with changelog

</details>

## 📥 Installation

[![⚡ Quick install via Tampermonkey](https://img.shields.io/badge/%E2%9A%A1_Quick_install_via-Tampermonkey-00485B.svg?style=for-the-badge)](https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js)

First install [Tampermonkey](https://www.tampermonkey.net/), then use the button above. Open the panel from its menu (_Einstellungen_ / _Settings_); updates are automatic via `updateURL`. No telemetry, no network requests — everything runs locally.

## 🔨 Building from Source

Requires [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
git clone https://github.com/JanGaida/youtube-ui-tweaks.git
cd youtube-ui-tweaks
npm install
npm run build
npm run install:prod
```

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

Development setup, tests, fixture capture, and conventions: [CONTEXT.md](CONTEXT.md) and [docs/architecture/](docs/architecture/INDEX.md). Release history: [CHANGELOG.md](CHANGELOG.md).

## ⚖️ License

[GPL-3.0](LICENSE) © 2026 Jan Gaida
