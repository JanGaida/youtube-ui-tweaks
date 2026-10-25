<script lang="ts">
    // ─────────────────────────────────────────────────────────────────────────────
    // MARK: CaptureProgress — dev-only overlay showing batch capture status
    // ─────────────────────────────────────────────────────────────────────────────
    // * Svelte 5 runes-based component. Mounted in document.body (survives YouTube SPA nav —
    //   body is not wiped by SPA route changes, unlike #content).
    // * Owns its reactive state internally. The parent (capture.ts CaptureOverlay) calls the
    //   exported imperative methods (update/done) which mutate the internal $state — Svelte
    //   re-renders live. This avoids $bindable-from-non-Svelte-module reactivity concerns.

    import type { FixtureTypePreset } from "./capture";
    import { untrack } from "svelte";

    /** Status of a single preset in the capture batch. */
    export interface PresetStatus {
        id: string;
        label: string;
        state: "pending" | "navigating" | "capturing" | "ok" | "fail";
        filename: string | null;
    }

    /** Presets passed at mount time (FIXTURE_PRESETS from capture.ts). */
    let { presets, onClose }: { presets: FixtureTypePreset[]; onClose: () => void } = $props();

    // * Internal reactive state — owned by this component. CaptureOverlay mutates via the
    //   exported imperative API below. presets is captured once at mount (FIXTURE_PRESETS is
    //   constant — untrack silences the "captures initial value" svelte-check warning).
    let statuses = $state<PresetStatus[]>(
        // eslint-disable-next-line svelte/no-unnecessary-untrack -- intentional one-time capture
        untrack(() => presets.map((p) => ({ id: p.id, label: p.label, state: "pending" as const, filename: null }))),
    );
    let doneFlag = $state(false);

    const ICONS: Record<PresetStatus["state"], string> = {
        pending: "⏳",
        navigating: "🔄",
        capturing: "💾",
        ok: "✅",
        fail: "❌",
    };

    let completed = $derived(statuses.filter((s) => s.state === "ok" || s.state === "fail").length);
    let progressPct = $derived(statuses.length > 0 ? Math.round((completed / statuses.length) * 100) : 0);
    let okCount = $derived(statuses.filter((s) => s.state === "ok").length);
    let allOk = $derived(doneFlag && okCount === statuses.length);

    // ─── Imperative API (called by CaptureOverlay in capture.ts) ───
    export function update(id: string, state: PresetStatus["state"], filename: string | null = null): void {
        const entry = statuses.find((s) => s.id === id);
        if (!entry) return;
        entry.state = state;
        if (filename !== null) entry.filename = filename;
    }
    export function done(): void {
        doneFlag = true;
    }
</script>

<div
    style="position:fixed;top:16px;right:16px;z-index:2147483647;width:360px;max-width:95vw;background:#0f0f0f;color:#f1f1f1;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.6);font-family:Roboto,Arial,sans-serif;font-size:13px;overflow:hidden;"
>
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#212121;">
        <span style="font-weight:600;font-size:14px;">{allOk ? "Capture fertig" : "Capture All"}</span>
        {#if doneFlag}
            <button
                style="background:transparent;border:0;color:#f1f1f1;font-size:16px;cursor:pointer;padding:2px 6px;border-radius:6px;"
                onclick={onClose}
                title="Schließen"
            >
                ✕
            </button>
        {/if}
    </div>

    <!-- Progress bar -->
    <div style="padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:#aaa;font-size:12px;">{completed}/{statuses.length} erledigt</span>
            <span style="color:#aaa;font-size:12px;">{progressPct}%</span>
        </div>
        <div style="height:6px;background:#303030;border-radius:3px;overflow:hidden;">
            <div
                style="height:100%;background:{allOk
                    ? '#3ea6ff'
                    : doneFlag
                      ? '#f5a623'
                      : '#3ea6ff'};border-radius:3px;transition:width 0.3s ease;width:{progressPct}%;"
            ></div>
        </div>
    </div>

    <!-- Per-preset status list -->
    <div style="padding:0 16px 8px;">
        {#each statuses as s (s.id)}
            <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;">
                <span style="font-size:14px;flex-shrink:0;">{ICONS[s.state]}</span>
                <span style="flex:1;color:{s.state === 'fail' ? '#f5a623' : '#f1f1f1'};">{s.label}</span>
                <span
                    style="color:#777;font-size:11px;text-align:right;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                >
                    {#if s.state === "ok" && s.filename}
                        {s.filename}
                    {:else if s.state === "fail"}
                        keine Treffer
                    {:else if s.state === "navigating"}
                        navigiere…
                    {:else if s.state === "capturing"}
                        capture…
                    {:else}
                        —
                    {/if}
                </span>
            </div>
        {/each}
    </div>

    <!-- Instructions (after done) -->
    {#if doneFlag}
        <div
            style="padding:12px 16px;background:#212121;border-top:1px solid #303030;font-size:12px;color:#aaa;line-height:1.6;"
        >
            {#if allOk}
                <div style="font-weight:600;color:#3ea6ff;margin-bottom:4px;">Nächste Schritte:</div>
                1. Downloads aus Firefox nach<code style="color:#f1f1f1;">src/lib/core/__fixtures__/</code> verschieben
                (überschreiben)<br />
                2. <code style="color:#f1f1f1;">npm run build</code><br />
                3. <code style="color:#f1f1f1;">npm run test</code>
            {:else}
                <div style="font-weight:600;color:#f5a623;margin-bottom:4px;">
                    {okCount}/{statuses.length} OK — FEHLT-Fixtures prüfen:
                </div>
                • Downloads nach<code style="color:#f1f1f1;">__fixtures__/</code> verschieben<br />
                • DevTools-Konsole: "keine Treffer" = YT-DOM geändert, "SPA-Nav-Fehler" = kein Link gefunden<br />
                • Fehlende ggf. einzeln nachcapturen<br />
                • <code style="color:#f1f1f1;">npm run build && npm run test</code>
            {/if}
        </div>
    {/if}
</div>
