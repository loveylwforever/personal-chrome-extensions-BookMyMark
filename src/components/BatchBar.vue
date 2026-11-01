<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FolderNode } from '~/modules/bookmarks/types';
import { flattenFolderOptions } from '~/modules/bookmarks/chrome-api';
import { t } from '~/modules/i18n';
import I18nText from './I18nText.vue';
import SelectMenu from './SelectMenu.vue';

const props = defineProps<{
  count: number;
  folders: FolderNode[];
}>();

const emit = defineEmits<{
  selectAll: [];
  clear: [];
  move: [parentId: string];
  resetVisits: [];
  remove: [];
  exit: [];
}>();

const moveValue = ref('');

const folderOptions = computed(() => flattenFolderOptions(props.folders));

function onMove(id: string) {
  moveValue.value = id;
  if (!id) return;
  emit('move', id);
  moveValue.value = '';
}
</script>

<template>
  <div class="bmm-rail bmm-rail-batch">
    <span class="bmm-rail-pill">
      <I18nText msg="batch.pill" align="start" />
    </span>
    <span class="bmm-rail-meta">
      <I18nText msg="batch.selected" :params="{ count }" />
    </span>

    <div class="bmm-rail-actions">
      <button type="button" class="bmm-btn" @click="emit('selectAll')">
        <I18nText msg="batch.selectAll" />
      </button>
      <button type="button" class="bmm-btn" @click="emit('clear')">
        <I18nText msg="batch.clearSelection" />
      </button>

      <SelectMenu
        :model-value="moveValue"
        size="sm"
        searchable
        :placeholder="t('batch.moveTo')"
        :options="folderOptions"
        @update:model-value="onMove"
      />

      <button type="button" class="bmm-btn" @click="emit('resetVisits')">
        <I18nText msg="batch.resetVisits" />
      </button>
      <button
        type="button"
        class="bmm-btn bmm-btn-danger"
        @click="emit('remove')"
      >
        <I18nText msg="batch.delete" />
      </button>
    </div>

    <button
      type="button"
      class="bmm-btn bmm-rail-exit"
      @click="emit('exit')"
    >
      <I18nText msg="batch.exit" />
    </button>
  </div>
</template>
