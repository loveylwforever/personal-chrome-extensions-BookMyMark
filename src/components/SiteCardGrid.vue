<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { SiteItem, SiteMeta, ViewMode } from '~/modules/bookmarks/types';
import SiteCard from './SiteCard.vue';

const SITE_MIME = 'text/bmm-site';

const props = withDefaults(
  defineProps<{
    sites: SiteItem[];
    viewMode: ViewMode;
    batchMode: boolean;
    selectedIds: Set<string>;
    getSiteMeta: (id: string) => SiteMeta;
    folderPathFor: (parentId: string) => string;
    siteAliveState: (id: string) => boolean | null;
    /** When false, drag-to-sidebar still works; in-grid reorder is disabled */
    reorderable?: boolean;
    /** Changing this resets the grid scroll to the top */
    scrollKey?: string;
  }>(),
  { reorderable: true },
);

const emit = defineEmits<{
  open: [SiteItem];
  edit: [SiteItem];
  remove: [SiteItem];
  favorite: [string];
  select: [string];
  /** beforeId: insert before this sibling; null = append at end */
  drop: [siteId: string, parentId: string, beforeId: string | null];
}>();

const gridEl = ref<HTMLElement | null>(null);
const dragId = ref<string | null>(null);
const indicator = ref<{
  targetId: string | null;
  mode: 'before' | 'after';
  axis: 'h' | 'v';
  top: number;
  left: number;
  length: number;
} | null>(null);

watch(
  () => props.scrollKey,
  async (key, prev) => {
    if (key === undefined || key === prev) return;
    await nextTick();
    const el = gridEl.value;
    if (el) el.scrollTop = 0;
  },
);

function hasSiteDrag(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes(SITE_MIME);
}

function clearIndicator() {
  indicator.value = null;
}

function cardEl(e: DragEvent): HTMLElement | null {
  const t = e.currentTarget as HTMLElement | null;
  return t?.closest?.('.bmm-card') ?? t;
}

function modeForCard(e: DragEvent, card: HTMLElement): 'before' | 'after' {
  const rect = card.getBoundingClientRect();
  if (props.viewMode === 'list') {
    return e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
  }
  return e.clientX - rect.left < rect.width / 2 ? 'before' : 'after';
}

function setIndicatorForCard(
  e: DragEvent,
  site: SiteItem,
  card: HTMLElement,
  mode: 'before' | 'after',
) {
  const grid = gridEl.value;
  if (!grid) return;
  const cRect = card.getBoundingClientRect();
  const gRect = grid.getBoundingClientRect();

  if (props.viewMode === 'list') {
    const edgeY = mode === 'before' ? cRect.top : cRect.bottom;
    indicator.value = {
      targetId: site.id,
      mode,
      axis: 'h',
      top: edgeY - gRect.top + grid.scrollTop,
      left: cRect.left - gRect.left + grid.scrollLeft,
      length: cRect.width,
    };
  } else {
    const edgeX = mode === 'before' ? cRect.left : cRect.right;
    indicator.value = {
      targetId: site.id,
      mode,
      axis: 'v',
      top: cRect.top - gRect.top + grid.scrollTop,
      left: edgeX - gRect.left + grid.scrollLeft,
      length: cRect.height,
    };
  }
}

/** Line after the last card (append) */
function setIndicatorAfterLast() {
  const grid = gridEl.value;
  const last = props.sites[props.sites.length - 1];
  if (!grid || !last) return;
  const card = grid.querySelector(
    `.bmm-card[data-site-id="${CSS.escape(last.id)}"]`,
  ) as HTMLElement | null;
  if (!card) return;

  const cRect = card.getBoundingClientRect();
  const gRect = grid.getBoundingClientRect();
  if (props.viewMode === 'list') {
    indicator.value = {
      targetId: last.id,
      mode: 'after',
      axis: 'h',
      top: cRect.bottom - gRect.top + grid.scrollTop,
      left: cRect.left - gRect.left + grid.scrollLeft,
      length: cRect.width,
    };
  } else {
    indicator.value = {
      targetId: last.id,
      mode: 'after',
      axis: 'v',
      top: cRect.top - gRect.top + grid.scrollTop,
      left: cRect.right - gRect.left + grid.scrollLeft,
      length: cRect.height,
    };
  }
}

function onDragStart(e: DragEvent, siteId: string) {
  dragId.value = siteId;
  clearIndicator();
  e.dataTransfer?.setData(SITE_MIME, siteId);
  e.dataTransfer!.effectAllowed = 'move';
}

function onDragEnd() {
  dragId.value = null;
  clearIndicator();
}

function onDragOver(e: DragEvent, site: SiteItem) {
  if (!props.reorderable || !dragId.value || !hasSiteDrag(e)) return;
  // Allow hovering the dragged card's after-edge only when it's not useful;
  // skipping self avoids noisy indicator, but last-card-after needs other cards.
  if (dragId.value === site.id) {
    clearIndicator();
    return;
  }
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  const card = cardEl(e);
  if (!card) return;
  const mode = modeForCard(e, card);
  setIndicatorForCard(e, site, card, mode);
}

function onDragLeave(e: DragEvent, site: SiteItem) {
  const card = cardEl(e);
  if (!card) return;
  const next = e.relatedTarget as Node | null;
  if (next && card.contains(next)) return;
  if (indicator.value?.targetId === site.id) clearIndicator();
}

function onGridDragOver(e: DragEvent) {
  if (!props.reorderable || !dragId.value || !hasSiteDrag(e) || !props.sites.length)
    return;
  const overCard = (e.target as HTMLElement | null)?.closest?.('.bmm-card');
  if (overCard) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  setIndicatorAfterLast();
}

/**
 * Insert before `beforeId`; null = append after last same-parent sibling
 * in the current list (and folder).
 */
function resolveBeforeId(
  target: SiteItem,
  mode: 'before' | 'after',
  movedId: string,
): string | null {
  if (mode === 'before') return target.id === movedId ? null : target.id;
  const idx = props.sites.findIndex((s) => s.id === target.id);
  if (idx < 0) return null;
  for (let i = idx + 1; i < props.sites.length; i++) {
    const s = props.sites[i]!;
    if (s.id === movedId) continue;
    if (s.parentId !== target.parentId) continue;
    return s.id;
  }
  return null;
}

function commitDrop(
  movedId: string,
  target: SiteItem,
  mode: 'before' | 'after',
) {
  if (movedId === target.id && mode === 'before') return;
  emit(
    'drop',
    movedId,
    target.parentId,
    resolveBeforeId(target, mode, movedId),
  );
}

function onDrop(e: DragEvent, target: SiteItem) {
  e.preventDefault();
  if (!props.reorderable) {
    clearIndicator();
    dragId.value = null;
    return;
  }
  const movedId = e.dataTransfer?.getData(SITE_MIME) || dragId.value;
  const card = cardEl(e);
  const mode = card
    ? modeForCard(e, card)
    : indicator.value?.targetId === target.id
      ? indicator.value.mode
      : 'before';
  clearIndicator();
  dragId.value = null;
  if (!movedId) return;
  commitDrop(movedId, target, mode);
}

function onGridDrop(e: DragEvent) {
  const overCard = (e.target as HTMLElement | null)?.closest?.('.bmm-card');
  if (overCard) return;
  e.preventDefault();
  if (!props.reorderable) {
    clearIndicator();
    dragId.value = null;
    return;
  }
  const movedId = e.dataTransfer?.getData(SITE_MIME) || dragId.value;
  const last = props.sites[props.sites.length - 1];
  clearIndicator();
  dragId.value = null;
  if (!movedId || !last || movedId === last.id) return;
  commitDrop(movedId, last, 'after');
}
</script>

<template>
  <div
    ref="gridEl"
    class="bmm-grid"
    :class="viewMode"
    @dragover="onGridDragOver"
    @drop="onGridDrop"
  >
    <div
      v-if="indicator"
      class="bmm-card-drop-line"
      :class="indicator.axis"
      :style="
        indicator.axis === 'h'
          ? {
              top: `${indicator.top}px`,
              left: `${indicator.left}px`,
              width: `${indicator.length}px`,
            }
          : {
              top: `${indicator.top}px`,
              left: `${indicator.left}px`,
              height: `${indicator.length}px`,
            }
      "
    />

    <SiteCard
      v-for="site in sites"
      :key="site.id"
      v-memo="[
        site.title,
        site.url,
        site.parentId,
        site.index,
        viewMode,
        batchMode,
        selectedIds.has(site.id),
        getSiteMeta(site.id).favorited,
        getSiteMeta(site.id).visitCount,
        getSiteMeta(site.id).description,
        folderPathFor(site.parentId),
        siteAliveState(site.id),
        dragId === site.id,
      ]"
      :data-site-id="site.id"
      :site="site"
      :meta="getSiteMeta(site.id)"
      :view-mode="viewMode"
      :batch-mode="batchMode"
      :selected="selectedIds.has(site.id)"
      :dragging="dragId === site.id"
      :folder-path="folderPathFor(site.parentId)"
      :alive="siteAliveState(site.id)"
      @open="emit('open', site)"
      @edit="emit('edit', site)"
      @remove="emit('remove', site)"
      @favorite="emit('favorite', site.id)"
      @select="emit('select', site.id)"
      @drag-start="onDragStart($event, site.id)"
      @drag-over="onDragOver($event, site)"
      @drag-leave="onDragLeave($event, site)"
      @drop="onDrop($event, site)"
      @drag-end="onDragEnd"
    />
  </div>
</template>
