<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  createBookmark,
  getBookmarkTree,
  getRootFolders,
  toFolderTree,
} from '~/modules/bookmarks/chrome-api';
import { flattenFolderOptions } from '~/modules/bookmarks/chrome-api';
import { applyTheme, loadOverlay } from '~/modules/bookmarks/overlay';
import type { FolderNode } from '~/modules/bookmarks/types';
import { setLocale, t } from '~/modules/i18n';
import SelectMenu from '~/components/SelectMenu.vue';

const title = ref('');
const url = ref('');
const parentId = ref('1');
const folders = ref<FolderNode[]>([]);
const status = ref('');
const saving = ref(false);

const folderOptions = computed(() => flattenFolderOptions(folders.value));

async function loadFolders() {
  const tree = await getBookmarkTree();
  folders.value = getRootFolders(tree).map(toFolderTree);
  const opts = flattenFolderOptions(folders.value);
  if (!opts.some((o) => o.value === parentId.value)) {
    parentId.value = opts[0]?.value ?? '1';
  }
}

async function save() {
  if (!url.value.trim() || saving.value) return;
  saving.value = true;
  try {
    await createBookmark({
      parentId: parentId.value,
      title: title.value.trim() || url.value.trim(),
      url: url.value.trim(),
    });
    status.value = t('popup.saved');
    window.setTimeout(() => window.close(), 600);
  } catch (e) {
    status.value = e instanceof Error ? e.message : t('popup.saveFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const overlay = await loadOverlay();
  applyTheme(overlay.theme, overlay.accent ?? 'neutral');
  setLocale(overlay.locale ?? 'zh');

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  title.value = tab?.title ?? '';
  url.value = tab?.url ?? '';
  await loadFolders();
});
</script>

<template>
  <div class="bmm-popup">
    <strong style="font-size: 0.875rem">{{ t('popup.title') }}</strong>

    <div class="bmm-field">
      <label>{{ t('popup.titleLabel') }}</label>
      <input v-model="title" type="text" />
    </div>
    <div class="bmm-field">
      <label>{{ t('popup.urlLabel') }}</label>
      <input v-model="url" type="url" />
    </div>
    <div class="bmm-field">
      <label>{{ t('popup.folderLabel') }}</label>
      <SelectMenu
        v-model="parentId"
        searchable
        :options="folderOptions"
        :placeholder="t('siteDialog.folderPh')"
      />
    </div>

    <button
      type="button"
      class="bmm-btn bmm-btn-primary"
      style="width: 100%"
      :disabled="saving || !url"
      @click="save"
    >
      {{ saving ? t('popup.saving') : t('popup.save') }}
    </button>
    <div
      v-if="status"
      style="font-size: 0.75rem; color: var(--muted-foreground); text-align: center"
    >
      {{ status }}
    </div>
  </div>
</template>
