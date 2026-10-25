# Architecture: System Toggles + Anonymize Layer

> Toggle architecture for the global kill-switch (`system.tweaksEnabled`) and the anonymize
> layer (`system.anonymize`). Both live in the settings JSON, are UI-controllable in the System
> tab (prod + dev), and have dev-only TM-menu entries. Diagrams depict relationships, structure,
> and boundaries — no implementation details.

## Component Structure

```mermaid
flowchart LR
  subgraph GUI["GUI (SystemTab.svelte)"]
    Switch["Switch (onChange)"]
  end

  subgraph Core["core/"]
    SysToggle["system-toggle.ts<br/>(setTweaksEnabled, applyToggleState)"]
    Anon["anonymize.ts<br/>(setAnonymize, applyAnonymize)"]
    Observer["observer.ts"]
    CSS["css.ts (applyCSS)"]
    Registry["registry.ts (restoreAll)"]
  end

  subgraph Store["stores/"]
    Settings["settings.svelte.ts<br/>(single source of truth)"]
  end

  subgraph Boot["main.ts (dev-only TM-menu)"]
    TM["GM_registerMenuCommand"]
  end

  Switch -->|onChange: enabled| SysToggle
  Switch -->|onChange: enabled| Anon
  TM -->|click: setTweaksEnabled| SysToggle
  TM -->|click: setAnonymize| Anon

  SysToggle -->|setByPath + save| Settings
  SysToggle -->|enabled=true| CSS
  SysToggle -->|enabled=true| Observer
  SysToggle -->|enabled=true| Registry
  SysToggle -->|enabled=false| Observer
  SysToggle -->|enabled=false| Registry
  SysToggle -->|enabled=false| CSS2["remove #yt-tweaks-css"]

  Anon -->|setByPath + save| Settings
  Anon -->|enabled=true| Style["mount #yt-tweaks-anonymize-css<br/>(blur from system.anonymizeBlur,<br/>fallback DEFAULT_SETTINGS.system.anonymizeBlur)"]
  Anon -->|enabled=false| Style2["remove #yt-tweaks-anonymize-css"]
```

## Kill-Switch Disable Sequence (restoreAll)

```mermaid
sequenceDiagram
  participant User
  participant Switch as SystemTab Switch
  participant SysToggle as system-toggle.ts
  participant Obs as observer.ts
  participant Reg as registry.ts (restoreAll)
  participant DOM as DOM

  User->>Switch: toggle OFF (system.tweaksEnabled)
  Switch->>SysToggle: onChange(false) → setTweaksEnabled(false)
  SysToggle->>SysToggle: store.setByPath + store.save (persist)
  SysToggle->>Obs: stopObserver()
  SysToggle->>DOM: remove #yt-tweaks-css (style element)
  SysToggle->>Reg: restoreAll()
  Reg->>Reg: dedup restore fns across all features
  Reg->>DOM: restoreText (data-yt-tweaked-original)
  Reg->>DOM: restoreAds (data-yt-tweaks-hidden)
  Reg->>DOM: restoreAutoSyncBadge (badge clones + markers)
  Reg->>DOM: restoreMasthead (injected buttons + markers)
  Reg->>DOM: restoreDimWatched (data-yt-tweaks-dim)
  Reg->>DOM: guideStylingRestore + guideVisibilityRestore + guideEntriesRestore
  Note over Obs: stopObserver ALSO cancels the pending throttle pass<br/>(a mutation queued just before the flip must not fire after restoreAll)
  note over DOM: #yt-tweaks-anonymize-css NOT touched (independent)
```

**Defense-in-depth kill-switch gating**: `observer.runOnce`/`runAll` additionally check
`system.tweaksEnabled` themselves — a pass scheduled before `setTweaksEnabled(false)`
(idle callback, throttle trailing edge, live-apply timer racing the toggle) returns early
instead of re-mutating the already-restored "clean" DOM.

**Wholesale settings replacement (reset/importJson)**: the store flushes the live-apply
debounce and calls the observer's `restoreAndRunAll(settings)` — a conservative
whole-state reset (restore EVERY feature's mutations, then re-apply CSS + re-run all
features from the new settings), because there is no per-key diff for a replaced
settings object.

## Independence: Anonymize survives kill-switch-off

```mermaid
flowchart TB
  subgraph Toggles["Two independent toggles"]
    Kill["system.tweaksEnabled<br/>(observer + CSS + mutations)"]
    Anon["system.anonymize<br/>(blur style only)"]
  end

  Kill -->|off: removes| TweakCSS["#yt-tweaks-css"]
  Kill -.->|off: does NOT remove| AnonCSS["#yt-tweaks-anonymize-css"]
  Anon -->|on: mounts| AnonCSS
  Anon -->|off: removes| AnonCSS
```

## Scope Boundaries

```mermaid
flowchart TB
  subgraph Supported["Supported"]
    S1[Global kill-switch — stop observer, remove CSS, restore all DOM mutations]
    S2[Anonymize layer — independent blur style, own style element]
    S3[Dev-only TM-menu entries (build:dev, __DEV_CAPTURE__-gated)]
  end
  subgraph NotSupported["Deliberately not supported"]
    N1[Per-feature kill-switches — one global switch only]
    N2[Anonymize coupling to kill-switch — independent by design]
  end
```

## References

- Toggle logic: `src/lib/core/system-toggle.ts`, `src/lib/core/anonymize.ts`
- Registry restore: `src/lib/core/registry.ts` (`restoreAll`)
- Kill-switch gating + whole-state reset: `src/lib/core/observer.ts` (`restoreAndRunAll`, tweaksEnabled checks in `runOnce`/`runAll`)
- Store reset/import path: `src/lib/stores/settings.svelte.ts` (`reset`, `importJson`)
- Boot wiring: `src/main.ts`
- Related doc: [feature-registry.md](feature-registry.md)

Verified: 2026-10-19 — against `src/lib/core/system-toggle.ts`, `src/lib/core/anonymize.ts` (blur fallback `DEFAULT_SETTINGS.system.anonymizeBlur`), `src/lib/core/observer.ts`, `src/lib/stores/settings.svelte.ts`, `src/main.ts` @ working tree (re-verified after kill-switch gating + restoreAndRunAll changes; re-checked 2026-10-25 after the ADR 0007 defaults change: anonymize.ts blur-fallback comment now points at the curated DEFAULT_SETTINGS.system.anonymizeBlur (4) instead of a hard-coded 12 — mount/blur logic unchanged)
