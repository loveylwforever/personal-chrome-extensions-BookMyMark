<script setup lang="ts">
import { computed } from 'vue';
import { getLucideIconNodes } from '~/modules/bookmarks/folder-icons';

const props = withDefaults(
  defineProps<{
    id: string;
    size?: number;
    strokeWidth?: number;
  }>(),
  { size: 16, strokeWidth: 2 },
);

const nodes = computed(() => getLucideIconNodes(props.id));
</script>

<template>
  <svg
    v-if="nodes"
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="bmm-lucide-svg"
    aria-hidden="true"
  >
    <component
      :is="tag"
      v-for="([tag, attrs], index) in nodes"
      :key="index"
      v-bind="attrs"
    />
  </svg>
  <span v-else class="bmm-icon-opt-fallback" aria-hidden="true">·</span>
</template>
