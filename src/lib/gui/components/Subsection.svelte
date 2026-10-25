<script lang="ts">
    /** Subsection within a Group: a titled sub-region with a top divider wrapping its content. */
    import type { Snippet } from "svelte";

    let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div class="yt-tweaks-ds-subsection">
    <div class="yt-tweaks-ds-subsection-title">{title}</div>
    <div class="yt-tweaks-ds-subsection-body">
        {@render children?.()}
    </div>
</div>
