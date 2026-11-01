<script setup lang="ts">
import { computed } from 'vue';
import { Folder } from 'lucide-vue-next';
import {
  getLucideIconNodes,
  isLucideFolderIcon,
  lucideIdFromValue,
} from '~/modules/bookmarks/folder-icons';
import LucideIconPreview from './LucideIconPreview.vue';

const props = withDefaults(
  defineProps<{
    icon?: string | null;
    size?: number;
  }>(),
  { size: 14 },
);

const lucideId = computed(() => {
  if (!props.icon || !isLucideFolderIcon(props.icon)) return null;
  const id = lucideIdFromValue(props.icon);
  return getLucideIconNodes(id) ? id : null;
});

const emoji = computed(() => {
  if (!props.icon || isLucideFolderIcon(props.icon)) return null;
  return props.icon;
});
</script>

<template>
  <LucideIconPreview
    v-if="lucideId"
    :id="lucideId"
    :size="size"
    :stroke-width="2"
  />
  <span
    v-else-if="emoji"
    class="bmm-folder-emoji"
    aria-hidden="true"
  >{{ emoji }}</span>
  <Folder v-else class="bmm-folder-icon" :size="size" />
</template>
