<script lang="ts">
    /**
     * DraggableRow: a Field-like row with a drag-handle icon + HTML5 drag-and-drop reordering.
     *
     * Renders a drag-handle (grip icon) before the label, then the children snippet (the control).
     * On dragstart sets the item id; on dragover computes the drop position (before/after the
     * target) and shows a visual drop-indicator (a 2px red line above or below the row).
     * On drop calls the `onReorder(draggedId, targetId, position)` callback.
     *
     * Used by MenubarTab.svelte (custom-button fields) and GuideSidebarTab.svelte (guide
     * groups + entries) for drag-and-drop reordering. The parent owns the ordered list of
     * ids and the reorder handlers (mutating the store).
     *
     * A11y: the grip BUTTON is focusable; ArrowUp/ArrowDown on it moves the row one slot
     * (keyboard equivalent of the drag gesture) via the `onKeyboardMove` callback.
     */
    import type { Snippet } from "svelte";
    import Icon from "./Icon.svelte";
    import { t } from "../i18n.svelte";

    let {
        id,
        label,
        children,
        onReorder,
        onKeyboardMove,
        dragType = "entry",
        disabled = false,
    }: {
        /** Stable id of this row (used as drag payload + drop target key). */
        id: string;
        /** Field label (rendered after the drag-handle). */
        label: string;
        /** The control snippet (Select/Switch/etc.). */
        children?: Snippet;
        /** Callback fired on drop: (draggedId, targetId, "before" | "after"). */
        onReorder: (draggedId: string, targetId: string, position: "before" | "after") => void;
        /** Callback fired on Alt+ArrowUp/ArrowDown: (rowId, -1 | 1). */
        onKeyboardMove?: (id: string, dir: -1 | 1) => void;
        /** Drag payload type prefix — rows only accept drops of the same type ("entry" | "group"). */
        dragType?: "entry" | "group";
        /** When true, the row is not draggable and children are dimmed (group-hidden case). */
        disabled?: boolean;
    } = $props();

    // * DnD state (local per row).
    let dragging = $state(false);
    let dragOver = $state(false);
    let dropPosition = $state<"before" | "after" | null>(null);

    function onDragStart(e: DragEvent): void {
        if (!e.dataTransfer || disabled) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", `${dragType}:${id}`);
        dragging = true;
    }

    function onDragEnd(): void {
        dragging = false;
        dragOver = false;
        dropPosition = null;
    }

    function onDragOver(e: DragEvent): void {
        // * preventDefault is required so the drop event fires.
        e.preventDefault();
        if (!e.dataTransfer) return;
        e.dataTransfer.dropEffect = "move";
        // * Drop position from the mouse-Y relative to the row midpoint: upper half → before,
        //   lower half → after.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        dropPosition = e.clientY < midpoint ? "before" : "after";
        dragOver = true;
    }

    function onDragLeave(e: DragEvent): void {
        // * dragleave also fires when the pointer moves onto the row's CHILDREN (label,
        //   control) — only clear the indicator when the pointer actually left the row,
        //   otherwise the indicator flickers on every child crossing.
        const related = e.relatedTarget as Node | null;
        if (related && (e.currentTarget as HTMLElement).contains(related)) return;
        dragOver = false;
        dropPosition = null;
    }

    function onDrop(e: DragEvent): void {
        e.preventDefault();
        const raw = e.dataTransfer?.getData("text/plain") ?? "";
        // * Only accept drops of the same dragType (group-vs-entry separation).
        const prefix = `${dragType}:`;
        if (!raw.startsWith(prefix)) return;
        const draggedId = raw.slice(prefix.length);
        if (draggedId && draggedId !== id && dropPosition) {
            onReorder(draggedId, id, dropPosition);
        }
        dragOver = false;
        dropPosition = null;
    }

    // * Keyboard reorder (a11y): ArrowUp/ArrowDown on the grip BUTTON moves the row one
    //   slot (the grip is the keyboard-equivalent of the drag gesture).
    function onGripKeydown(e: KeyboardEvent): void {
        if (disabled || !onKeyboardMove) return;
        if (e.key === "ArrowUp") {
            e.preventDefault();
            onKeyboardMove(id, -1);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onKeyboardMove(id, 1);
        }
    }

    // * Drag-handle icon (Material "drag_indicator" — three vertical dots / grip).
    const GRIP_PATH =
        "M9 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM18 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z";
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- * The ROW is the deliberate drag gesture (HTML5 drag API, mouse-only). The keyboard
     equivalent lives on the grip BUTTON below (ArrowUp/ArrowDown) — so the row div itself
     stays non-interactive and needs no tab stop. -->
<div
    class="yt-tweaks-dnd-row"
    class:dragging
    class:drag-over={dragOver}
    class:disabled
    draggable={!disabled}
    ondragstart={onDragStart}
    ondragend={onDragEnd}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
>
    {#if dropPosition === "before"}<div class="yt-tweaks-dnd-indicator"></div>{/if}
    <button
        type="button"
        class="yt-tweaks-dnd-handle"
        title={t("field.dragHandle")}
        aria-label={`${t("field.dragHandle")} — ${label}`}
        aria-keyshortcuts="ArrowUp ArrowDown"
        {disabled}
        onkeydown={onGripKeydown}
    >
        <Icon path={GRIP_PATH} size={16} />
    </button>
    <span class="yt-tweaks-field-label">{label}</span>
    {@render children?.()}
    {#if dropPosition === "after"}<div class="yt-tweaks-dnd-indicator"></div>{/if}
</div>

<style>
    .yt-tweaks-dnd-row.disabled {
        opacity: 0.5;
        pointer-events: none;
    }
</style>
