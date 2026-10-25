<script lang="ts">
    /**
     * Stepper: a mini-stepper pill (−[n]+) bound to a numeric store dot-path.
     *
     * Layout: single pill styled with the exact proportions of the dropdown trigger
     * (170px wide, radius 6, padding 4px/8px, font-size 13px) — the two controls look
     * like siblings. The pill holds `−` / value / `+` and (if given) the unit as a muted
     * suffix segment, all inside the 170px — the unit never widens the control. Buttons
     * allow exact ±1 steps (long-press accelerates), the text field exact entry. Both
     * stay in sync via the reactive store value.
     *
     * Number field is `type=text inputmode=numeric` (no native spin-buttons). Typing
     * writes the raw number LIVE but UN-clamped (clamping mid-type would truncate
     * multi-digit entry); the value is clamped to `[min, max]` on blur/Enter AND on
     * panel close (App.svelte force-blurs the active element before saving — an ESC
     * close would otherwise persist an out-of-range value). NaN is never written.
     * `.invalid` flagging only happens for paths that HAVE a feature validator —
     * Stepper paths (gui.*, system.anonymizeBlur, masthead widths) have none; the
     * clamp is the only guard there.
     */
    import { onDestroy } from "svelte";
    import { store } from "../../stores/settings.svelte";
    import { validation } from "../../stores/validation.svelte";
    import { t } from "../i18n.svelte";

    let {
        path,
        min = 0,
        max = 100,
        step = 1,
        unit = "",
        disabled = false,
        label = "",
    }: {
        path: string;
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
        disabled?: boolean;
        label?: string;
    } = $props();

    const currentValue = $derived(Number(store.getByPath(path)) || 0);
    const error = $derived(validation.getError(path));
    const isInvalid = $derived(!!error);
    const atMin = $derived(currentValue <= min);
    const atMax = $derived(currentValue >= max);

    function clamp(v: number): number {
        return Math.max(min, Math.min(max, v));
    }

    function commit(v: number): void {
        if (Number.isNaN(v)) return; // * leave invalid-state as-is; store untouched
        store.setByPath(path, clamp(v));
    }

    function stepBy(dir: number): void {
        store.setByPath(path, clamp(currentValue + dir * step));
    }

    function onNumberInput(e: Event): void {
        const input = e.target as HTMLInputElement;
        const v = Number(input.value);
        if (Number.isNaN(v)) return; // * mid-entry; wait for blur/Enter to clamp
        store.setByPath(path, v); // * live, but un-clamped — validation flags out-of-range
    }

    function onNumberBlur(e: Event): void {
        const input = e.target as HTMLInputElement;
        commit(Number(input.value));
        // * reflect clamped value back into the field
        input.value = String(currentValue);
    }

    function onNumberKeydown(e: KeyboardEvent): void {
        const input = e.target as HTMLInputElement;
        if (e.key === "Enter") {
            e.preventDefault();
            input.blur();
        } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            stepBy(1);
        } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            stepBy(-1);
        }
    }

    // * Long-press acceleration: first step immediately, then after HOLD_DELAY auto-repeat
    //   with growing increments (ACCEL). Pointer-events drive start/stop; stops on
    //   pointerup/leave/cancel. Active stop-fns are tracked component-side so an unmount
    //   mid-press (category switch / panel close) tears the repeat chain down — otherwise
    //   the detached timer chain would keep calling stepBy forever.
    const ACCEL = [1, 1, 1, 2, 2, 3, 5, 8, 12];
    const HOLD_DELAY = 450; // ms until auto-repeat begins
    const HOLD_RATE = 70; // ms between repeats
    const activeStops = new Set<() => void>();

    onDestroy(() => {
        for (const stop of activeStops) stop();
        activeStops.clear();
    });

    function onStepPointerDown(e: PointerEvent): void {
        if (disabled) return;
        e.preventDefault();
        const btn = e.currentTarget as HTMLButtonElement;
        const dir = Number(btn.dataset.dir);
        let count = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let repeater: ReturnType<typeof setTimeout> | null = null;

        const tick = (): void => {
            const inc = ACCEL[Math.min(count, ACCEL.length - 1)];
            stepBy(dir * inc);
            count++;
            repeater = setTimeout(tick, HOLD_RATE);
        };
        const stop = (): void => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            if (repeater) {
                clearTimeout(repeater);
                repeater = null;
            }
            btn.removeEventListener("pointerup", stop);
            btn.removeEventListener("pointerleave", stop);
            btn.removeEventListener("pointercancel", stop);
            activeStops.delete(stop);
        };
        activeStops.add(stop);

        stepBy(dir); // immediate single step
        timer = setTimeout(() => {
            if (!timer) return;
            timer = null;
            tick();
        }, HOLD_DELAY);
        btn.addEventListener("pointerup", stop);
        btn.addEventListener("pointerleave", stop);
        btn.addEventListener("pointercancel", stop);
    }
</script>

<div class="yt-tweaks-stepper" class:disabled>
    <button
        class="yt-tweaks-step-btn"
        type="button"
        data-dir="-1"
        disabled={disabled || atMin}
        aria-label={t("field.stepDecrement")}
        onpointerdown={onStepPointerDown}>−</button
    >
    <input
        class="yt-tweaks-stepper-num"
        type="text"
        inputmode="numeric"
        {min}
        {max}
        {step}
        value={currentValue}
        {disabled}
        class:invalid={isInvalid}
        aria-label={label || t("field.stepperValue")}
        title={error?.message ?? ""}
        oninput={onNumberInput}
        onkeydown={onNumberKeydown}
        onblur={onNumberBlur}
    />
    <button
        class="yt-tweaks-step-btn"
        type="button"
        data-dir="1"
        disabled={disabled || atMax}
        aria-label={t("field.stepIncrement")}
        onpointerdown={onStepPointerDown}>+</button
    >
    {#if unit}<span class="yt-tweaks-stepper-unit">{unit}</span>{/if}
</div>
