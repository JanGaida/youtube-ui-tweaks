<script lang="ts">
    /**
     * Declarative SVG icon (Trusted-Types-safe — no raw HTML sink).
     *
     * Feather-style: 24x24 viewBox, stroke via `currentColor`. With `filled=true` it uses fill via
     * `currentColor` and no stroke (for solid icons like the GitHub logo).
     */
    let {
        path,
        size = 16,
        strokeWidth = "2",
        filled = false,
        class: cls = "",
    }: {
        path: string;
        size?: number;
        strokeWidth?: string;
        filled?: boolean;
        class?: string;
    } = $props();
</script>

<svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={cls}
>
    <path d={path} />
</svg>
