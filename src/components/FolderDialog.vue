<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FolderNode } from '~/modules/bookmarks/types';
import { flattenFolderOptions } from '~/modules/bookmarks/chrome-api';
import { t } from '~/modules/i18n';
import SelectMenu from './SelectMenu.vue';

const props = defineProps<{
  open: boolean;
  mode: 'create' | 'rename';
  folders: FolderNode[];
  initialTitle?: string;
  defaultParentId: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [{ title: string; parentId: string }];
}>();

const title = ref('');
const parentId = ref('');
const dialog = ref<HTMLDialogElement | null>(null);

const folderOptions = computed(() => flattenFolderOptions(props.folders));

watch(
  () => props.open,
  (v) => {
    if (v) {
      title.value = props.initialTitle ?? '';
      parentId.value = props.defaultParentId;
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

function onSubmit() {
  if (!title.value.trim()) return;
  emit('submit', { title: title.value.trim(), parentId: parentId.value });
}
</script>

<template>
  <dialog ref="dialog" class="bmm-dialog" @close="emit('close')">
    <form class="bmm-dialog-body" @submit.prevent="onSubmit">
      <h3>
        {{
          mode === 'create'
            ? t('folderDialog.create')
            : t('folderDialog.rename')
        }}
      </h3>
      <div class="bmm-field">
        <label>{{ t('folderDialog.name') }}</label>
        <input v-model="title" type="text" required autofocus />
      </div>
      <div v-if="mode === 'create'" class="bmm-field">
        <label>{{ t('folderDialog.parent') }}</label>
        <SelectMenu
          v-model="parentId"
          searchable
          :options="folderOptions"
          :placeholder="t('folderDialog.parentPh')"
        />
      </div>
      <div class="bmm-dialog-actions">
        <button type="button" class="bmm-btn" @click="emit('close')">
          {{ t('folderDialog.cancel') }}
        </button>
        <button type="submit" class="bmm-btn bmm-btn-primary">
          {{ t('folderDialog.ok') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
