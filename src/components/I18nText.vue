<script setup lang="ts">
import { computed } from 'vue';
import {
  t,
  tLocale,
  type MessageKey,
} from '~/modules/i18n';

const props = withDefaults(
  defineProps<{
    msg: MessageKey;
    params?: Record<string, string | number>;
    /** Extra keys whose zh/en text also reserve width (e.g. toggle labels) */
    reserve?: MessageKey[];
    /**
     * center: balanced padding inside reserved width (toolbar / pills)
     * start: flush next to an icon (menus / chips)
     */
    align?: 'center' | 'start';
  }>(),
  { align: 'center' },
);

const visible = computed(() => t(props.msg, props.params));

const sizers = computed(() => {
  const keys = [props.msg, ...(props.reserve ?? [])];
  const out: string[] = [];
  for (const key of keys) {
    out.push(tLocale('zh', key, props.params));
    out.push(tLocale('en', key, props.params));
  }
  return [...new Set(out)];
});
</script>

<template>
  <span class="bmm-i18n-slot" :data-align="align">
    <span
      v-for="(s, i) in sizers"
      :key="i"
      class="bmm-i18n-sizer"
      aria-hidden="true"
    >{{ s }}</span>
    <span class="bmm-i18n-text">{{ visible }}</span>
  </span>
</template>
