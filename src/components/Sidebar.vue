<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderPlus,
  Globe,
  House,
  Image,
  MoreHorizontal,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-vue-next';
import {
  collectFolderScopeIds,
  findFolder,
} from '~/modules/bookmarks/chrome-api';
import type { FolderNode } from '~/modules/bookmarks/types';
import { FOLDER_ALL, FOLDER_HOME } from '~/modules/bookmarks/types';
import { toIdList, clampSidebarWidth } from '~/modules/bookmarks/overlay';
import { t, type MessageKey } from '~/modules/i18n';
import I18nText from './I18nText.vue';
import FolderGlyph from './FolderGlyph.vue';

const FOLDER_MIME = 'text/bmm-folder';
const SITE_MIME = 'text/bmm-site';

type DropMode = 'before' | 'after' | 'into';
type FolderActionId =
  | 'openAll'
  | 'addChild'
  | 'changeIcon'
  | 'rename'
  | 'delete';

/** Shared by ⋯ menu and context menu (same DOM) */
const FOLDER_MENU_ITEMS: {
  id: FolderActionId;
  msg: MessageKey;
  icon: LucideIcon;
  danger?: boolean;
}[] = [
  { id: 'openAll', msg: 'sidebar.openAll', icon: ExternalLink },
  { id: 'addChild', msg: 'sidebar.addChild', icon: FolderPlus },
  { id: 'changeIcon', msg: 'sidebar.changeIcon', icon: Image },
  { id: 'rename', msg: 'sidebar.rename', icon: Pencil },
  { id: 'delete', msg: 'sidebar.delete', icon: Trash2, danger: true },
];

const props = defineProps<{
  folders: FolderNode[];
  activeFolderId: string;
  totalCount: number;
  expandedIds: string[];
  folderIcons: Record<string, string>;
  widthPx: number;
}>();

const emit = defineEmits<{
  select: [string];
  toggleExpand: [string];
  dropSite: [siteId: string, folderId: string];
  reorderFolder: [folderId: string, targetId: string, mode: DropMode];
  addFolder: [];
  addChildFolder: [FolderNode];
  changeIcon: [FolderNode];
  renameFolder: [FolderNode];
  deleteFolder: [FolderNode];
  openAll: [FolderNode];
  'update:widthPx': [number];
  widthCommit: [number];
}>();

/** 按展开状态拍平，避免递归 SFC 在 Vite 下解析失败 */
const flatFolders = computed(() => {
  const out: { node: FolderNode; depth: number }[] = [];
  const expanded = new Set(toIdList(props.expandedIds));

  const walk = (nodes: FolderNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ node, depth });
      if (expanded.has(node.id) && node.children.length > 0) {
        walk(node.children, depth + 1);
      }
    }
  };

  walk(props.folders ?? [], 0);
  return out;
});

const menuForId = ref<string | null>(null);
const sidebarEl = ref<HTMLElement | null>(null);
const resizing = ref(false);

const dragFolderId = ref<string | null>(null);
const siteDropId = ref<string | null>(null);
const folderDrop = ref<{
  targetId: string;
  mode: DropMode;
  lineTop: number;
  lineLeft: number;
} | null>(null);

let resizeStartX = 0;
let resizeStartW = 0;

function hasType(e: DragEvent, type: string) {
  return Array.from(e.dataTransfer?.types ?? []).includes(type);
}

function isInvalidFolderDrop(
  dragId: string,
  target: FolderNode,
  mode: DropMode,
): boolean {
  if (dragId === target.id) return true;
  const dragNode = findFolder(props.folders, dragId);
  if (!dragNode) return true;
  const scope = collectFolderScopeIds(dragNode);
  if (mode === 'into') return scope.has(target.id);
  const newParentId = target.parentId;
  return !!newParentId && scope.has(newParentId);
}

function dropModeForY(e: DragEvent, row: HTMLElement): DropMode {
  const rect = row.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const h = rect.height || 1;
  const ratio = y / h;
  if (ratio < 0.28) return 'before';
  if (ratio > 0.72) return 'after';
  return 'into';
}

function lineMetrics(
  row: HTMLElement,
  mode: 'before' | 'after',
  depth: number,
): { lineTop: number; lineLeft: number } {
  const sidebar = sidebarEl.value;
  if (!sidebar) return { lineTop: 0, lineLeft: 0 };
  const sRect = sidebar.getBoundingClientRect();
  const rRect = row.getBoundingClientRect();
  // Snap to the insert edge so the line matches the real drop slot
  const edgeY = mode === 'before' ? rRect.top : rRect.bottom;
  return {
    lineTop: edgeY - sRect.top + sidebar.scrollTop,
    lineLeft: 0.35 + depth * 0.7,
  };
}

function clearFolderDrop() {
  folderDrop.value = null;
  siteDropId.value = null;
}

function onFolderDragStart(e: DragEvent, node: FolderNode) {
  const t = e.target as HTMLElement | null;
  if (t?.closest('.bmm-folder-more, .bmm-folder-menu, .bmm-folder-chevron')) {
    e.preventDefault();
    return;
  }
  dragFolderId.value = node.id;
  e.dataTransfer?.setData(FOLDER_MIME, node.id);
  e.dataTransfer!.effectAllowed = 'move';
  closeMenu();
}

function onFolderDragEnd() {
  dragFolderId.value = null;
  clearFolderDrop();
}

function onRowDragOver(e: DragEvent, node: FolderNode, depth: number) {
  if (hasType(e, FOLDER_MIME)) {
    const dragId = dragFolderId.value;
    if (!dragId) return;
    const row = e.currentTarget as HTMLElement;
    const mode = dropModeForY(e, row);
    if (isInvalidFolderDrop(dragId, node, mode)) {
      clearFolderDrop();
      return;
    }
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    siteDropId.value = null;
    if (mode === 'into') {
      folderDrop.value = {
        targetId: node.id,
        mode,
        lineTop: 0,
        lineLeft: 0,
      };
      return;
    }
    const { lineTop, lineLeft } = lineMetrics(row, mode, depth);
    folderDrop.value = { targetId: node.id, mode, lineTop, lineLeft };
    return;
  }

  if (hasType(e, SITE_MIME)) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    folderDrop.value = null;
    siteDropId.value = node.id;
  }
}

function onRowDragLeave(e: DragEvent, node: FolderNode) {
  const row = e.currentTarget as HTMLElement;
  const next = e.relatedTarget as Node | null;
  if (next && row.contains(next)) return;
  if (folderDrop.value?.targetId === node.id) folderDrop.value = null;
  if (siteDropId.value === node.id) siteDropId.value = null;
}

function onRowDrop(e: DragEvent, node: FolderNode) {
  e.preventDefault();
  const folderId = e.dataTransfer?.getData(FOLDER_MIME);
  if (folderId) {
    const mode =
      folderDrop.value?.targetId === node.id
        ? folderDrop.value.mode
        : dropModeForY(e, e.currentTarget as HTMLElement);
    const ok = !isInvalidFolderDrop(folderId, node, mode);
    clearFolderDrop();
    dragFolderId.value = null;
    if (ok) emit('reorderFolder', folderId, node.id, mode);
    return;
  }
  const siteId = e.dataTransfer?.getData(SITE_MIME);
  clearFolderDrop();
  if (siteId) emit('dropSite', siteId, node.id);
}

function onResizePointerDown(e: PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  resizing.value = true;
  resizeStartX = e.clientX;
  resizeStartW = props.widthPx;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  document.body.classList.add('bmm-resizing-sidebar');
}

function onResizePointerMove(e: PointerEvent) {
  if (!resizing.value) return;
  const next = clampSidebarWidth(resizeStartW + (e.clientX - resizeStartX));
  emit('update:widthPx', next);
}

function onResizePointerUp(e: PointerEvent) {
  if (!resizing.value) return;
  resizing.value = false;
  document.body.classList.remove('bmm-resizing-sidebar');
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* already released */
  }
  emit('widthCommit', clampSidebarWidth(props.widthPx));
}

function openMenu(id: string) {
  menuForId.value = id;
}

function toggleMenu(e: MouseEvent, id: string) {
  e.stopPropagation();
  menuForId.value = menuForId.value === id ? null : id;
}

function onContextMenu(e: MouseEvent, id: string) {
  e.preventDefault();
  e.stopPropagation();
  openMenu(id);
}

function closeMenu() {
  menuForId.value = null;
}

function runFolderAction(id: FolderActionId, node: FolderNode) {
  closeMenu();
  switch (id) {
    case 'openAll':
      emit('openAll', node);
      break;
    case 'addChild':
      emit('addChildFolder', node);
      break;
    case 'changeIcon':
      emit('changeIcon', node);
      break;
    case 'rename':
      emit('renameFolder', node);
      break;
    case 'delete':
      emit('deleteFolder', node);
      break;
  }
}

function onDocPointer(e: PointerEvent) {
  if (!menuForId.value || !sidebarEl.value) return;
  const row = sidebarEl.value.querySelector('.bmm-folder-row.menu-open');
  if (!row?.contains(e.target as Node)) closeMenu();
}

function onRowFocusOut(e: FocusEvent) {
  if (!menuForId.value) return;
  const row = e.currentTarget as HTMLElement;
  const next = e.relatedTarget as Node | null;
  if (next && row.contains(next)) return;
  requestAnimationFrame(() => {
    if (!menuForId.value) return;
    const active = document.activeElement;
    if (!active || !row.contains(active)) closeMenu();
  });
}

function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuForId.value) closeMenu();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onDocKeydown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true);
  document.removeEventListener('keydown', onDocKeydown, true);
  document.body.classList.remove('bmm-resizing-sidebar');
});
</script>

<template>
  <div
    class="bmm-sidebar-shell"
    :class="{ resizing }"
    :style="{ width: `${widthPx}px` }"
  >
    <aside ref="sidebarEl" class="bmm-sidebar">
      <div
        v-if="folderDrop && folderDrop.mode !== 'into'"
        class="bmm-folder-drop-line"
        :style="{
          top: `${folderDrop.lineTop}px`,
          left: `${folderDrop.lineLeft}rem`,
        }"
      />

      <div class="bmm-sidebar-section" style="display: flex; align-items: center">
        <span><I18nText msg="sidebar.folders" align="start" /></span>
        <button
          type="button"
          class="bmm-btn"
          style="margin-left: auto; height: 1.5rem; padding: 0 0.4rem"
          :title="t('sidebar.newFolder')"
          @click="emit('addFolder')"
        >
          <FolderPlus :size="14" />
        </button>
      </div>

      <div
        class="bmm-folder-row"
        :class="{ active: activeFolderId === FOLDER_HOME }"
      >
        <button
          type="button"
          class="bmm-folder-main"
          @click="emit('select', FOLDER_HOME)"
        >
          <span class="bmm-folder-chevron spacer" />
          <House :size="14" class="bmm-folder-icon" />
          <span class="bmm-folder-title">
            <I18nText msg="sidebar.home" align="start" />
          </span>
        </button>
      </div>

      <div
        class="bmm-folder-row"
        :class="{ active: activeFolderId === FOLDER_ALL }"
      >
        <button
          type="button"
          class="bmm-folder-main"
          @click="emit('select', FOLDER_ALL)"
        >
          <span class="bmm-folder-chevron spacer" />
          <Globe :size="14" class="bmm-folder-icon" />
          <span class="bmm-folder-title">
            <I18nText msg="sidebar.allFolders" align="start" />
          </span>
          <span class="bmm-folder-meta">
            <span class="bmm-folder-count">{{ totalCount }}</span>
          </span>
        </button>
      </div>

      <div
        v-for="{ node, depth } in flatFolders"
        :key="node.id"
        class="bmm-folder-row"
        :class="{
          active: activeFolderId === node.id,
          'menu-open': menuForId === node.id,
          dragging: dragFolderId === node.id,
          'drop-target':
            siteDropId === node.id ||
            (folderDrop?.targetId === node.id && folderDrop.mode === 'into'),
        }"
        :style="{ paddingLeft: `${0.35 + depth * 0.7}rem` }"
        draggable="true"
        @dragstart="onFolderDragStart($event, node)"
        @dragend="onFolderDragEnd"
        @dragover="onRowDragOver($event, node, depth)"
        @dragleave="onRowDragLeave($event, node)"
        @drop="onRowDrop($event, node)"
        @contextmenu="onContextMenu($event, node.id)"
        @focusout="onRowFocusOut"
      >
        <button
          type="button"
          class="bmm-folder-main"
          @click="emit('select', node.id)"
        >
          <span
            v-if="node.children.length"
            class="bmm-folder-chevron"
            @click.stop="emit('toggleExpand', node.id)"
          >
            <ChevronDown
              v-if="toIdList(expandedIds).includes(node.id)"
              :size="14"
            />
            <ChevronRight v-else :size="14" />
          </span>
          <span v-else class="bmm-folder-chevron spacer" />
          <FolderGlyph :icon="folderIcons[node.id]" :size="14" />
          <span class="bmm-folder-title">{{ node.title }}</span>
          <span class="bmm-folder-meta">
            <span class="bmm-folder-count">{{ node.bookmarkCount }}</span>
            <button
              type="button"
              class="bmm-folder-more"
              :title="t('sidebar.more')"
              :aria-label="t('sidebar.moreAria')"
              aria-haspopup="menu"
              :aria-expanded="menuForId === node.id"
              @click="toggleMenu($event, node.id)"
            >
              <MoreHorizontal :size="14" />
            </button>
          </span>
        </button>

        <div
          v-if="menuForId === node.id"
          class="bmm-folder-menu"
          role="menu"
        >
          <button
            v-for="item in FOLDER_MENU_ITEMS"
            :key="item.id"
            type="button"
            role="menuitem"
            :class="{ danger: item.danger }"
            @click="runFolderAction(item.id, node)"
          >
            <component :is="item.icon" :size="13" />
            <I18nText :msg="item.msg" align="start" />
          </button>
        </div>
      </div>
    </aside>

    <div
      class="bmm-sidebar-resize"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('sidebar.resize')"
      :title="t('sidebar.resize')"
      @pointerdown="onResizePointerDown"
      @pointermove="onResizePointerMove"
      @pointerup="onResizePointerUp"
      @pointercancel="onResizePointerUp"
    />
  </div>
</template>
