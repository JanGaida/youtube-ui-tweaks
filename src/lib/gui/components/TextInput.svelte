<script lang="ts">
    /**
     * TextInput: binds to a store dot-path, with validation and dirty tracking.
     *
     * Validation is feature-driven via the ValidationStore (registry.validateSettings). When a
     * feature registers a validator covering this path, its error drives the `invalid` class.
     * For rem-valued fields (`rem=true` — spacing/margin settings that are interpolated into
     * generated CSS/inline styles), the rem-format rule applies: an invalid value is NEVER
     * written to the store (CSS injection guard) and the field snaps back on blur.
     * Validity state is reflected via the `valid`/`invalid` CSS classes.
     */
    import { store, isRemValid } from "../../stores/settings.svelte";
    import { validation } from "../../stores/validation.svelte";

    let {
        path,
        rem = false,
    }: {
        path: string;
        rem?: boolean;
    } = $props();

    let dirty = $state(false);

    // * Live value from the store
    const currentValue = $derived(store.getByPath(path) as string);

    // * Validation: prefer feature-driven ValidationStore error; fall back to the rem rule
    //   (rem-flagged paths have no feature validator).
    const featureError = $derived(validation.getError(path));
    const valid = $derived(dirty ? (featureError ? false : rem ? isRemValid(currentValue, rem) : true) : null);

    function onInput(e: Event): void {
        const input = e.target as HTMLInputElement;
        const v = input.value.trim();
        dirty = true;
        // * Never persist an invalid rem value — these fields are interpolated into
        //   generated CSS/inline styles; garbage must not reach the DOM.
        if (rem && !isRemValid(v, true)) return;
        store.setByPath(path, v);
    }

    function onBlur(e: Event): void {
        // * Snap the field back to the persisted value (a rejected rem input was never
        //   written — without this the field would keep showing the invalid text).
        (e.target as HTMLInputElement).value = String(store.getByPath(path) ?? "");
    }
</script>

<input
    type="text"
    value={currentValue}
    aria-label={path}
    class={[valid === false ? "invalid" : "", valid === true ? "valid" : ""].join(" ").trim()}
    title={featureError?.message ?? ""}
    oninput={onInput}
    onblur={onBlur}
/>
