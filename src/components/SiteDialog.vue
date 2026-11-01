<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FolderNode, SiteItem, SiteMeta } from '~/modules/bookmarks/types';
import { flattenFolderOptions } from '~/modules/bookmarks/chrome-api';
import { t } from '~/modules/i18n';
import SelectMenu from './SelectMenu.vue';

const props = defineProps<{
  open: boolean;
  mode: 'create' | 'edit';
  folders: FolderNode[];
  initial?: Partial<SiteItem & SiteMeta & { parentId: string }>;
  defaultParentId: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [
    {
      title: string;
      url: string;
      parentId: string;
      description?: string;
    },
  ];
}>();

const title = ref('');
const url = ref('');
const parentId = ref('');
const description = ref('');
const dialog = ref<HTMLDialogElement | null>(null);

const folderOptions = computed(() => flattenFolderOptions(props.folders));

watch(
  () => props.open,
  (v) => {
    if (v) {
      title.value = props.initial?.title ?? '';
      url.value = props.initial?.url ?? '';
      parentId.value = props.initial?.parentId ?? props.defaultParentId;
      description.value = props.initial?.description ?? '';
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

function onSubmit() {
  if (!url.value.trim()) return;
  emit('submit', {
    title: title.value.trim() || url.value.trim(),
    url: url.value.trim(),
    parentId: parentId.value,
    description: description.value.trim() || undefined,
  });
}
</script>

<template>
  <dialog ref="dialog" class="bmm-dialog" @close="emit('close')">
    <form class="bmm-dialog-body" @submit.prevent="onSubmit">
      <h3>
        {{
          mode === 'create' ? t('siteDialog.create') : t('siteDialog.edit')
        }}
      </h3>

      <div class="bmm-field">
        <label>{{ t('siteDialog.title') }}</label>
        <input
          v-model="title"
          type="text"
          :placeholder="t('siteDialog.titlePh')"
        />
      </div>
      <div class="bmm-field">
        <label>{{ t('siteDialog.url') }}</label>
        <input v-model="url" type="url" required placeholder="https://" />
      </div>
      <div class="bmm-field">
        <label>{{ t('siteDialog.folder') }}</label>
        <SelectMenu
          v-model="parentId"
          searchable
          :options="folderOptions"
          :placeholder="t('siteDialog.folderPh')"
        />
      </div>
      <div class="bmm-field">
        <label>{{ t('siteDialog.desc') }}</label>
        <textarea
          v-model="description"
          :placeholder="t('siteDialog.descPh')"
        />
      </div>

      <div class="bmm-dialog-actions">
        <button type="button" class="bmm-btn" @click="emit('close')">
          {{ t('siteDialog.cancel') }}
        </button>
        <button type="submit" class="bmm-btn bmm-btn-primary">
          {{ t('siteDialog.save') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
