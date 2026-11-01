<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useBookmarks } from '~/composables/useBookmarks';
import Toolbar from './Toolbar.vue';
import Sidebar from './Sidebar.vue';
import FolderTabs from './FolderTabs.vue';
import SiteCardGrid from './SiteCardGrid.vue';
import ViewSwitcher from './ViewSwitcher.vue';
import SortSelect from './SortSelect.vue';
import BatchBar from './BatchBar.vue';
import SiteDialog from './SiteDialog.vue';
import FolderDialog from './FolderDialog.vue';
import FolderIconDialog from './FolderIconDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import HomeView from './HomeView.vue';
import type { FolderNode, SiteItem } from '~/modules/bookmarks/types';
import { FOLDER_HOME, isVirtualFolderId } from '~/modules/bookmarks/types';
import {
  SIDEBAR_WIDTH_DEFAULT,
  clampSidebarWidth,
  toIdList,
} from '~/modules/bookmarks/overlay';
import { t } from '~/modules/i18n';
import I18nText from './I18nText.vue';

const {
  search,
  loading,
  batchMode,
  selectedIds,
  statusMessage,
  folderTrees,
  activeFolderId,
  activeTagId,
  viewMode,
  sortMode,
  sortDir,
  theme,
  themePref,
  accent,
  locale,
  activeFolderTitle,
  childFolders,
  visibleSites,
  arrangeKind,
  arrangeGroups,
  arranging,
  exitArrange,
  probing,
  probeMode,
  probeDone,
  probeTotal,
  probeDeadCount,
  exitProbe,
  siteAliveState,
  runProbe,
  totalBookmarkCount,
  overlay,
  selectFolder,
  selectTag,
  changeViewMode,
  changeSortMode,
  changeSortDir,
  changeThemePref,
  changeAccent,
  changeLocale,
  openSite,
  openAllInFolder,
  toggleSiteFavorite,
  createSite,
  editSite,
  deleteSite,
  createFolder,
  renameFolder,
  deleteFolder,
  changeFolderIcon,
  onDropSiteToFolder,
  onReorderFolder,
  onReorderSite,
  toggleSelect,
  selectAllVisible,
  clearSelection,
  batchMove,
  batchDelete,
  batchResetVisits,
  runDedupe,
  getDedupePreview,
  runArrangeByDomain,
  runArrangeByName,
  runImport,
  runExport,
  runClearAll,
  getSiteMeta,
  folderPathFor,
  patchOverlay,
} = useBookmarks();

function arrangeGroupTitle(group: {
  label: string;
  residual?: boolean;
}): string {
  if (group.residual) return t('arrange.other');
  return group.label;
}

const siteDialogOpen = ref(false);
const siteDialogMode = ref<'create' | 'edit'>('create');
const editingSite = ref<SiteItem | null>(null);

const folderDialogOpen = ref(false);
const folderDialogMode = ref<'create' | 'rename'>('create');
const editingFolder = ref<FolderNode | null>(null);
const folderCreateParentId = ref<string | null>(null);

const iconDialogOpen = ref(false);
const iconFolder = ref<FolderNode | null>(null);

const clearDialog = ref<HTMLDialogElement | null>(null);
const clearConfirm = ref('');

/** Live width while dragging; falls back to persisted overlay value */
const sidebarWidthPx = ref(SIDEBAR_WIDTH_DEFAULT);

watch(
  () => overlay.value.sidebarWidthPx,
  (w) => {
    if (typeof w === 'number') sidebarWidthPx.value = clampSidebarWidth(w);
  },
  { immediate: true },
);

async function commitSidebarWidth(px: number) {
  const next = clampSidebarWidth(px);
  sidebarWidthPx.value = next;
  await patchOverlay((o) =>
    o.sidebarWidthPx === next ? o : { ...o, sidebarWidthPx: next },
  );
}

type DeleteTarget =
  | { kind: 'site'; site: SiteItem }
  | { kind: 'folder'; folder: FolderNode };

const deleteConfirmOpen = ref(false);
const deleteTarget = ref<DeleteTarget | null>(null);
const dedupeConfirmOpen = ref(false);
const dedupePreview = ref({ groupCount: 0, removeCount: 0 });

const deleteConfirmTitle = computed(() => {
  if (deleteTarget.value?.kind === 'folder') return t('confirm.deleteFolderTitle');
  return t('confirm.deleteSiteTitle');
});

const deleteConfirmMessage = computed(() => {
  const target = deleteTarget.value;
  if (!target) return '';
  if (target.kind === 'folder') {
    return t('confirm.deleteFolderMsg', { name: target.folder.title });
  }
  return t('confirm.deleteSiteMsg', { name: target.site.title });
});

const dedupeConfirmMessage = computed(() =>
  t('confirm.dedupeMsg', {
    count: dedupePreview.value.removeCount,
    groups: dedupePreview.value.groupCount,
  }),
);

const clearPhrase = computed(() => t('clear.phrase'));

const defaultParentId = computed(() => {
  if (!isVirtualFolderId(activeFolderId.value)) return activeFolderId.value;
  return folderTrees.value[0]?.id ?? '1';
});

const folderDialogParentId = computed(() => {
  if (folderDialogMode.value === 'create' && folderCreateParentId.value) {
    return folderCreateParentId.value;
  }
  return defaultParentId.value;
});

async function toggleExpand(id: string) {
  await patchOverlay((o) => {
    const ids = new Set(toIdList(o.expandedFolderIds));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return { ...o, expandedFolderIds: [...ids] };
  });
}

function openCreateSite() {
  editingSite.value = null;
  siteDialogMode.value = 'create';
  siteDialogOpen.value = true;
}

function openEditSite(site: SiteItem) {
  editingSite.value = site;
  siteDialogMode.value = 'edit';
  siteDialogOpen.value = true;
}

async function onSiteSubmit(payload: {
  title: string;
  url: string;
  parentId: string;
  description?: string;
}) {
  if (siteDialogMode.value === 'create') {
    await createSite(payload);
  } else if (editingSite.value) {
    await editSite(editingSite.value.id, payload);
  }
  siteDialogOpen.value = false;
}

function openCreateFolder(parentId?: string) {
  editingFolder.value = null;
  folderDialogMode.value = 'create';
  folderCreateParentId.value = parentId ?? null;
  folderDialogOpen.value = true;
}

function openCreateChildFolder(folder: FolderNode) {
  openCreateFolder(folder.id);
}

function openRenameFolder(folder: FolderNode) {
  editingFolder.value = folder;
  folderDialogMode.value = 'rename';
  folderCreateParentId.value = null;
  folderDialogOpen.value = true;
}

function openChangeIcon(folder: FolderNode) {
  iconFolder.value = folder;
  iconDialogOpen.value = true;
}

async function onIconSubmit(icon: string | null) {
  if (iconFolder.value) {
    await changeFolderIcon(iconFolder.value.id, icon);
  }
  iconDialogOpen.value = false;
  iconFolder.value = null;
}

async function ensureExpanded(folderId: string) {
  await patchOverlay((o) => {
    const ids = new Set(toIdList(o.expandedFolderIds));
    if (ids.has(folderId)) return o;
    ids.add(folderId);
    return { ...o, expandedFolderIds: [...ids] };
  });
}

async function onFolderSubmit(payload: { title: string; parentId: string }) {
  if (folderDialogMode.value === 'create') {
    await createFolder(payload.title, payload.parentId);
    await ensureExpanded(payload.parentId);
  } else if (editingFolder.value) {
    await renameFolder(editingFolder.value.id, payload.title);
  }
  folderCreateParentId.value = null;
  folderDialogOpen.value = false;
}

async function onDeleteFolder(folder: FolderNode) {
  deleteTarget.value = { kind: 'folder', folder };
  deleteConfirmOpen.value = true;
}

function onDeleteSite(site: SiteItem) {
  deleteTarget.value = { kind: 'site', site };
  deleteConfirmOpen.value = true;
}

function closeDeleteConfirm() {
  deleteConfirmOpen.value = false;
  deleteTarget.value = null;
}

async function confirmDelete() {
  const target = deleteTarget.value;
  closeDeleteConfirm();
  if (!target) return;
  if (target.kind === 'folder') await deleteFolder(target.folder.id);
  else await deleteSite(target.site.id);
}

function onCardDrop(
  siteId: string,
  parentId: string,
  beforeId: string | null,
) {
  void onReorderSite(siteId, parentId, beforeId);
}

function requestClear() {
  clearConfirm.value = '';
  clearDialog.value?.showModal();
}

async function requestDedupe() {
  const preview = await getDedupePreview();
  if (preview.removeCount <= 0) {
    await runDedupe();
    return;
  }
  dedupePreview.value = preview;
  dedupeConfirmOpen.value = true;
}

function closeDedupeConfirm() {
  dedupeConfirmOpen.value = false;
}

async function confirmDedupe() {
  dedupeConfirmOpen.value = false;
  await runDedupe();
}

async function confirmClear() {
  if (clearConfirm.value !== clearPhrase.value) return;
  clearDialog.value?.close();
  await runClearAll();
}

const siteInitial = computed(() => {
  if (!editingSite.value) return undefined;
  const meta = getSiteMeta(editingSite.value.id);
  return {
    ...editingSite.value,
    ...meta,
  };
});
</script>

<template>
  <div class="bmm-host">
    <Transition name="bmm-toast">
      <div v-if="statusMessage" class="bmm-toast" role="status">
        {{ statusMessage }}
      </div>
    </Transition>

    <Toolbar
      :search="search"
      :theme="theme"
      :theme-pref="themePref"
      :accent="accent"
      :locale="locale"
      @update:search="search = $event"
      @add="openCreateSite"
      @dedupe="requestDedupe()"
      @arrange-domain="runArrangeByDomain()"
      @arrange-name="runArrangeByName()"
      @probe="runProbe()"
      @import="runImport()"
      @export="runExport()"
      @clear="requestClear"
      @update:theme-pref="changeThemePref"
      @update:accent="changeAccent"
      @update:locale="changeLocale"
    />

    <div class="bmm-body">
      <Sidebar
        :folders="folderTrees"
        :active-folder-id="activeFolderId"
        :total-count="totalBookmarkCount"
        :expanded-ids="overlay.expandedFolderIds"
        :folder-icons="overlay.folderIcons"
        :width-px="sidebarWidthPx"
        @update:width-px="sidebarWidthPx = $event"
        @width-commit="commitSidebarWidth"
        @select="selectFolder"
        @toggle-expand="toggleExpand"
        @drop-site="(siteId, folderId) => onDropSiteToFolder(siteId, folderId)"
        @reorder-folder="onReorderFolder"
        @add-folder="openCreateFolder()"
        @add-child-folder="openCreateChildFolder"
        @change-icon="openChangeIcon"
        @rename-folder="openRenameFolder"
        @delete-folder="onDeleteFolder"
        @open-all="(folder) => openAllInFolder(folder.id)"
      />

      <main class="bmm-main" :class="{ home: activeFolderId === FOLDER_HOME }">
        <HomeView v-show="activeFolderId === FOLDER_HOME" />
        <template v-if="activeFolderId !== FOLDER_HOME">
        <div class="bmm-main-header">
          <div class="bmm-main-title">{{ activeFolderTitle }}</div>
          <button
            type="button"
            class="bmm-btn"
            @click="batchMode = !batchMode"
          >
            <I18nText
              :msg="batchMode ? 'main.batchCancel' : 'main.batch'"
              :reserve="['main.batch', 'main.batchCancel']"
            />
          </button>
          <SortSelect
            :sort-mode="sortMode"
            :sort-dir="sortDir"
            @update:sort-mode="changeSortMode"
            @update:sort-dir="changeSortDir"
          />
          <ViewSwitcher
            :model-value="viewMode"
            @update:model-value="changeViewMode"
          />
        </div>

        <FolderTabs
          :active-folder-id="activeFolderId"
          :active-filter-id="activeTagId"
          :child-folders="childFolders"
          @select-filter="selectTag"
          @select-folder="selectFolder"
          @drop-site="(siteId, folderId) => onDropSiteToFolder(siteId, folderId)"
        />

        <div
          v-if="batchMode || arranging || probeMode"
          class="bmm-rails"
          :class="{
            dual:
              [batchMode, arranging, probeMode].filter(Boolean).length > 1,
          }"
        >
          <BatchBar
            v-if="batchMode"
            :count="selectedIds.size"
            :folders="folderTrees"
            @select-all="selectAllVisible"
            @clear="clearSelection"
            @move="batchMove"
            @reset-visits="batchResetVisits"
            @remove="batchDelete"
            @exit="
              batchMode = false;
              clearSelection();
            "
          />

          <div
            v-if="arranging"
            class="bmm-rail bmm-rail-arrange"
          >
            <span class="bmm-rail-pill">
              <I18nText
                :msg="
                  arrangeKind === 'domain'
                    ? 'arrange.pillDomain'
                    : 'arrange.pillName'
                "
                align="start"
              />
            </span>
            <span class="bmm-rail-meta">
              {{
                t('arrange.summary', {
                  groups: arrangeGroups.filter((g) => !g.residual).length,
                  count: visibleSites.length,
                })
              }}
            </span>
            <button
              type="button"
              class="bmm-btn bmm-rail-exit"
              @click="exitArrange()"
            >
              <I18nText msg="arrange.exit" />
            </button>
          </div>

          <div
            v-if="probeMode"
            class="bmm-rail bmm-rail-probe"
          >
            <span class="bmm-rail-pill" :class="{ scanning: probing }">
              <I18nText
                :msg="probing ? 'probe.pillScanning' : 'probe.pill'"
                align="start"
              />
            </span>
            <span class="bmm-rail-meta">
              <template v-if="probing">
                {{
                  t('probe.progress', {
                    done: probeDone,
                    total: probeTotal,
                  })
                }}
                ·
                {{ t('probe.summary', { count: probeDeadCount }) }}
              </template>
              <template v-else>
                {{ t('probe.summary', { count: probeDeadCount }) }}
              </template>
            </span>
            <span class="bmm-rail-hint">{{ t('probe.hint') }}</span>
            <button
              type="button"
              class="bmm-btn bmm-rail-exit"
              @click="exitProbe()"
            >
              <I18nText msg="probe.exit" />
            </button>
          </div>
        </div>

        <div v-if="loading" class="bmm-empty">{{ t('main.loading') }}</div>

        <div v-else-if="visibleSites.length === 0" class="bmm-empty">
          <template v-if="probeMode && !probing">
            <p>{{ t('probe.emptyDone') }}</p>
            <button type="button" class="bmm-btn" @click="exitProbe()">
              <I18nText msg="probe.exit" />
            </button>
          </template>
          <template v-else>
            <p>{{ t('main.empty') }}</p>
            <button type="button" class="bmm-btn bmm-btn-primary" @click="openCreateSite">
              <I18nText msg="main.addSite" />
            </button>
            <button type="button" class="bmm-btn" @click="runImport()">
              <I18nText msg="main.importHtml" />
            </button>
          </template>
        </div>

        <div v-else-if="arranging" class="bmm-arrange">
          <section
            v-for="group in arrangeGroups"
            :key="group.id"
            class="bmm-arrange-section"
          >
            <header class="bmm-arrange-head">
              <span v-if="!group.residual" class="bmm-arrange-tag">
                <I18nText
                  :msg="
                    arrangeKind === 'domain'
                      ? 'arrange.domainPrefix'
                      : 'arrange.namePrefix'
                  "
                  align="start"
                />
              </span>
              <h3
                class="bmm-arrange-label"
                :class="{ residual: group.residual }"
                :title="arrangeGroupTitle(group)"
              >
                {{ arrangeGroupTitle(group) }}
              </h3>
              <span class="bmm-arrange-count">{{ group.sites.length }}</span>
            </header>

            <SiteCardGrid
              :sites="group.sites"
              :view-mode="viewMode"
              :batch-mode="batchMode"
              :selected-ids="selectedIds"
              :get-site-meta="getSiteMeta"
              :folder-path-for="folderPathFor"
              :site-alive-state="siteAliveState"
              :scroll-key="`${activeFolderId}:${activeTagId}`"
              :reorderable="false"
              @open="openSite"
              @edit="openEditSite"
              @remove="onDeleteSite"
              @favorite="toggleSiteFavorite"
              @select="toggleSelect"
              @drop="onCardDrop"
            />
          </section>
        </div>

        <SiteCardGrid
          v-else
          :sites="visibleSites"
          :view-mode="viewMode"
          :batch-mode="batchMode"
          :selected-ids="selectedIds"
          :get-site-meta="getSiteMeta"
          :folder-path-for="folderPathFor"
          :site-alive-state="siteAliveState"
          :scroll-key="`${activeFolderId}:${activeTagId}`"
          :reorderable="sortMode === 'default' && !probeMode"
          @open="openSite"
          @edit="openEditSite"
          @remove="onDeleteSite"
          @favorite="toggleSiteFavorite"
          @select="toggleSelect"
          @drop="onCardDrop"
        />
        </template>
      </main>
    </div>

    <SiteDialog
      :open="siteDialogOpen"
      :mode="siteDialogMode"
      :folders="folderTrees"
      :initial="siteInitial"
      :default-parent-id="defaultParentId"
      @close="siteDialogOpen = false"
      @submit="onSiteSubmit"
    />

    <FolderDialog
      :open="folderDialogOpen"
      :mode="folderDialogMode"
      :folders="folderTrees"
      :initial-title="editingFolder?.title"
      :default-parent-id="folderDialogParentId"
      @close="
        folderDialogOpen = false;
        folderCreateParentId = null;
      "
      @submit="onFolderSubmit"
    />

    <FolderIconDialog
      :open="iconDialogOpen"
      :folder-title="iconFolder?.title ?? ''"
      :current-icon="iconFolder ? overlay.folderIcons[iconFolder.id] : undefined"
      @close="
        iconDialogOpen = false;
        iconFolder = null;
      "
      @submit="onIconSubmit"
    />

    <ConfirmDialog
      :open="deleteConfirmOpen"
      :title="deleteConfirmTitle"
      :message="deleteConfirmMessage"
      @close="closeDeleteConfirm"
      @confirm="confirmDelete"
    />

    <ConfirmDialog
      :open="dedupeConfirmOpen"
      :title="t('confirm.dedupeTitle')"
      :message="dedupeConfirmMessage"
      :confirm-label="t('confirm.dedupe')"
      @close="closeDedupeConfirm"
      @confirm="confirmDedupe"
    />

    <dialog ref="clearDialog" class="bmm-dialog">
      <form class="bmm-dialog-body" @submit.prevent="confirmClear">
        <h3>{{ t('clear.title') }}</h3>
        <p style="margin: 0; font-size: 0.8125rem; color: var(--muted-foreground)">
          {{ t('clear.body', { phrase: clearPhrase }) }}
        </p>
        <div class="bmm-field">
          <label>{{ t('clear.phraseLabel') }}</label>
          <input v-model="clearConfirm" type="text" />
        </div>
        <div class="bmm-dialog-actions">
          <button type="button" class="bmm-btn" @click="clearDialog?.close()">
            {{ t('clear.cancel') }}
          </button>
          <button
            type="submit"
            class="bmm-btn bmm-btn-danger"
            :disabled="clearConfirm !== clearPhrase"
          >
            {{ t('clear.confirm') }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>
