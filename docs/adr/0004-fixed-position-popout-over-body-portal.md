# ADR 0004: position:fixed popout over document.body portal

- Status: accepted (2026-08, re-verified 2026-09-09)
- Deciders: human + agent session
- Applies to: `gui/components/Select.svelte` (custom dropdown)

## Context

The settings panel content area (`.yt-tweaks-content`) is a scroll container
(`overflow-y: auto`). A dropdown popout rendered inline inside it is clipped by the scroll
boundary. The plan (D1) specified a Svelte portal to `document.body` to escape the clipping.

Two facts invalidated the plan's mechanism:

1. **No stable portal**: Svelte 5.56 has no stable `svelte:portal` element; a manual portal
   (re-parenting via DOM APIs) fights Svelte's ownership model and re-adds cleanup complexity.
2. **YT-CSS-context risk**: a popout re-parented to `document.body` leaves the panel's CSS
   context and enters YouTube's page CSS — on youtube.com, page CSS is hostile territory
   (global rules could restyle the portaled popout). The panel itself is `position: fixed`
   with only a transient intro `transform: scale()` (0.16 s, no `fill-mode: forwards`) — so a
   `position: fixed` **child inside the panel** uses the viewport as its containing block and
   already escapes `.yt-tweaks-content`'s clip.

## Decision

Render the popout as an **inline child of the panel** (no portal), positioned with
`position: fixed`:

1. Coordinates derive from the trigger's `getBoundingClientRect()`.
2. `scroll`/`resize` listeners (passive, rAF-throttled) reposition while open.
3. Close on `Esc` / click-outside.

The deviation from plan D1 is recorded here and in `dropdown.md` (Deviation-from-plan note).

## Consequences

**Positive:**

- Stays inside the panel's CSS context — no exposure to YouTube page CSS (avoids the R4 risk
  from the dropdown design plan).
- No portal machinery: no manual re-parenting, no ownership/cleanup edge cases.
- Svelte reactivity keeps working on the popout (it remains a normal child).

**Negative:**

- Reposition listeners are our responsibility (portal would inherit body-level scroll for
  free — but the panel is the only scroll container that matters, so the cost is two passive
  listeners).
- The `position: fixed` trick depends on the panel never gaining a **persistent** transform —
  if someone adds one, the popout silently re-anchors to the panel. This constraint must be
  kept documented (it is: dropdown.md + this ADR).

## References

- Implementation: `src/lib/gui/components/Select.svelte`
- Architecture doc: [dropdown.md](../architecture/dropdown.md) (Popout Clipping Solution section)
- Plan (superseded mechanism): `docs/plans/switch-redesign.md` lineage — dropdown design plan D1
