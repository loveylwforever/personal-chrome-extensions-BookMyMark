<script setup lang="ts">
import { computed } from 'vue';
import { LayoutGrid, List, Rows3 } from 'lucide-vue-next';
import type { ViewMode } from '~/modules/bookmarks/types';
import { t } from '~/modules/i18n';

defineProps<{
  modelValue: ViewMode;
}>();

const emit = defineEmits<{
  'update:modelValue': [ViewMode];
}>();

const modes = computed(() => [
  { id: 'compact' as const, label: t('view.compact'), icon: LayoutGrid },
  { id: 'list' as const, label: t('view.list'), icon: List },
  { id: 'expanded' as const, label: t('view.expanded'), icon: Rows3 },
]);
</script>

<template>
  <div class="bmm-view-switch" role="group" :aria-label="t('view.switch')">
    <button
      v-for="m in modes"
      :key="m.id"
      type="button"
      :class="{ active: modelValue === m.id }"
      :title="m.label"
      @click="emit('update:modelValue', m.id)"
    >
      <component :is="m.icon" :size="14" />
    </button>
  </div>
</template>
