# dim-watched — Architecture

Desaturates + fades watched grid videos, graduated by watch progress (bucket-quantized
marker values, pure CSS per bucket). Diagrams depict relationships, structure, and
boundaries — no implementation details.

## Component Structure

```mermaid
flowchart TB
  subgraph Core["core/"]
    DW["features/dim-watched.ts<br/>dimWatchedFeature"]
    REG["registry.ts"]
  end
  subgraph GUI["gui/"]
    TAB["tabs/VideoItemTab.svelte<br/>section: dim-watched"]
  end
  subgraph YouTubeDOM["YouTube grid DOM"]
    ITEM["ytd-rich-item-renderer"]
    PBAR[".ytThumbnailOverlayProgressBarHost<br/>(watched indicator)"]
    SEG[".ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment<br/>inline width: NN%"]
    THUMB[".ytThumbnailViewModelHost"]
    META[".ytLockupViewModelMetadata"]
  end

  TAB -->|"setByPath brightness / progressSteps / hoverReveal"| DW
  REG -->|"dispatch run + css"| DW
  DW -->|"run: readProgressPct + quantizeProgress"| SEG
  DW -->|"marker data-yt-tweaks-dim=dimmed-BUCKET"| ITEM
  DW -->|"css: grayscale + opacity per bucket"| THUMB
  DW -->|"css: opacity per bucket"| META
  PBAR -->|"presence = watched"| ITEM
```

## Progress Quantization (ADR 0006: enum steps, computed buckets)

```mermaid
flowchart TB
  P["progressSteps: off | quarter | third | half"]
  W["inline width NN%<br/>from progress-bar segment"]
  Q["quantizeProgress<br/>floor(NN / step) × step"]
  Q -->|"bucket 0"| SKIP["marker skip<br/>(no veil)"]
  Q -->|"bucket 25/33/50/66/75/100"| MARK["marker dimmed-BUCKET"]
  B["brightness preset<br/>(subtle..strong = full-veil endpoint)"]
  MARK --> LERP["lerpOpacity<br/>1 - bucket/100 × (1 - fullOpacity)"]
  B --> LERP
  LERP -->|"thumb opacity + grayscale(bucket/100)"| CSS["bucket-scoped CSS rules"]
  LERP -->|"text opacity"| CSS
```

- `progressSteps: off` = legacy behavior: every watched item gets the full veil
  (marker `dimmed-100`).
- Downward quantization (D1): a 49%-watched video at "half" gets no veil; 56% at "quarter"
  lands in the 50 bucket. Exact multiples are guarded by an epsilon (float step sizes,
  third = 33.333…) and the final value floored to stable integers (33/66/100).
- `stepIntensity` (bug #5 fix) bends the bucket factor curve: `factor = (bucket/100)^exp`
  with exp 1 (subtle) / 0.5 (medium) / 0.34 (strong). Linear scaling made the 25% bucket
  nearly invisible (25% of the veil); medium raises it to 50%, strong to ~62%. The 100%
  bucket always keeps the exact brightness-preset endpoint. Emitted values are rounded to
  3 decimals (no float noise in CSS).
- The DOM pass is idempotent per item via the marker attribute (ADR 0001): progress is
  read once per rendered item; Polymer re-renders replace the nodes, re-running the pass.
- `hoverReveal` emits the transition + reveal rules per bucket (`:hover` OR
  `:has(.ytSpecTouchFeedbackShapeHovered)` — the JS-driven hover class survives the
  mini-player overlay).

## Scope Boundaries

```mermaid
flowchart TB
  subgraph Supported["Supported (dim-watched)"]
    S1[Brightness presets subtle/light/medium/strong - full-veil endpoints]
    S2[Progress graduation off/quarter/third/half - enum, ADR 0006]
    S3[Step intensity subtle/medium/strong - bucket curve exponent, bug #5 fix]
    S4[Hover reveal incl. mini-player overlay case]
    S5[Grid pages: home, subscriptions, channel]
  end
  subgraph NotSupported["Deliberately not supported"]
    N1[Free-form opacity/percentage inputs - enum steps only, ADR 0006]
    N2[Live progress re-evaluation while watching - render-time snapshot only]
    N3[Watch page + search - no grid items with progress bars]
    N4[Per-bucket brightness overrides - one preset, scaled by bucket factor]
  end
```

## References

- Feature: `src/lib/core/features/dim-watched.ts`
- Settings: `src/lib/core/settings.ts` (`DimWatchedSettings`, `DEFAULT_SETTINGS.dimWatched`)
- GUI: `src/lib/gui/tabs/VideoItemTab.svelte` (section `dim-watched`)
- Tests: `src/lib/core/__tests__/dim-watched.test.ts`,
  `src/lib/core/__tests__/dim-watched.fixture.test.ts` (subscriptions fixture with real
  progress percentages 10/24/56/81/100)
- Decision records: [ADR 0001 — marker attribute over inline style](../adr/0001-marker-attribute-over-inline-style.md),
  [ADR 0006 — preset enums over free-form CSS inputs](../adr/0006-preset-enums-over-freeform-css-inputs.md)
- DOM fixture: `src/lib/core/__fixtures__/subscriptions-grid-item.fixture.html` (captured 2026-08-23)

Verified: 2026-10-19 — against `src/lib/core/features/dim-watched.ts` (buckets, stepIntensity exponents 1/0.5/0.34, `data-yt-tweaks-dim` marker, liveApplyKeys), `src/lib/core/settings.ts` (`DimWatchedSettings`), `src/lib/gui/tabs/VideoItemTab.svelte` (section `dim-watched`) @ working tree (re-checked 2026-10-24 after the meta-split change: dim-watched feature + settings slice untouched; re-checked 2026-10-25 after the wording pass: VideoItemTab lost only Field `desc` props — brightness/progressSteps/stepIntensity/hoverReveal paths unchanged; re-checked 2026-10-25 after the ADR 0007 defaults change: DEFAULT_SETTINGS.dimWatched now ships enabled true, hoverReveal true, progressSteps "third" — bucket math + CSS emission unchanged; settings.ts comment-only re-pass, no behavior change)
