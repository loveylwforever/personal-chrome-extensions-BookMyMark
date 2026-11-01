<script setup lang="ts">
import type { FolderNode } from '~/modules/bookmarks/types';
import {
  FOLDER_ALL,
  TAG_ALL,
  TAG_FAVORITES,
  TAG_MOST,
  TAG_RECENT,
} from '~/modules/bookmarks/types';
import type { MessageKey } from '~/modules/i18n';
import I18nText from './I18nText.vue';

defineProps<{
  activeFolderId: string;
  activeFilterId: string;
  childFolders: FolderNode[];
}>();

const emit = defineEmits<{
  selectFilter: [string];
  selectFolder: [string];
  dropSite: [siteId: string, folderId: string];
}>();

const smartTabs: { id: string; msg: MessageKey }[] = [
  { id: TAG_ALL, msg: 'tabs.all' },
  { id: TAG_FAVORITES, msg: 'tabs.favorites' },
  { id: TAG_MOST, msg: 'tabs.most' },
  { id: TAG_RECENT, msg: 'tabs.recent' },
];

function onDrop(e: DragEvent, folderId: string) {
  e.preventDefault();
  const siteId = e.dataTransfer?.getData('text/bmm-site');
  if (siteId) emit('dropSite', siteId, folderId);
}
</script>

<template>
  <div v-if="activeFolderId === FOLDER_ALL" class="bmm-tabs">
    <button
      v-for="tab in smartTabs"
      :key="tab.id"
      type="button"
      class="bmm-tab"
      :class="{ active: activeFilterId === tab.id }"
      @click="emit('selectFilter', tab.id)"
    >
      <I18nText :msg="tab.msg" />
    </button>
  </div>

  <div v-else-if="childFolders.length" class="bmm-tabs">
    <button
      type="button"
      class="bmm-tab active"
      @click="emit('selectFolder', activeFolderId)"
    >
      <I18nText msg="tabs.all" />
    </button>
    <button
      v-for="child in childFolders"
      :key="child.id"
      type="button"
      class="bmm-tab"
      @click="emit('selectFolder', child.id)"
      @dragover.prevent
      @drop="onDrop($event, child.id)"
    >
      {{ child.title }}
      <span v-if="child.bookmarkCount" class="bmm-tab-count">
        {{ child.bookmarkCount }}
      </span>
    </button>
  </div>
</template>
