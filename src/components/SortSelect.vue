<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ArrowDownAZ,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  List,
  TrendingUp,
} from 'lucide-vue-next';
import type { SortDir, SortMode } from '~/modules/bookmarks/types';
import { t } from '~/modules/i18n';
import type { MessageKey } from '~/modules/i18n';
import I18nText from './I18nText.vue';

const props = defineProps<{
  sortMode: SortMode;
  sortDir: SortDir;
}>();

const emit = defineEmits<{
  'update:sortMode': [SortMode];
  'update:sortDir': [SortDir];
}>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

const OPTIONS: {
  id: SortMode;
  msg: MessageKey;
  icon: typeof List;
}[] = [
  { id: 'default', msg: 'sort.default', icon: List },
  { id: 'frequency', msg: 'sort.frequency', icon: TrendingUp },
  { id: 'alpha', msg: 'sort.alpha', icon: ArrowDownAZ },
  { id: 'added', msg: 'sort.added', icon: Calendar },
];

const activeOption = computed(
  () => OPTIONS.find((o) => o.id === props.sortMode) ?? OPTIONS[0]!,
);

function toggle() {
  open.value = !open.value;
}

function pick(mode: SortMode) {
  emit('update:sortMode', mode);
  open.value = false;
}

function toggleDir() {
  emit('update:sortDir', props.sortDir === 'asc' ? 'desc' : 'asc');
}

function onDocPointer(e: PointerEvent) {
  if (!open.value || !rootEl.value) return;
  if (!rootEl.value.contains(e.target as Node)) open.value = false;
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) open.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onKey, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true);
  document.removeEventListener('keydown', onKey, true);
});
</script>

<template>
  <div
    ref="rootEl"
    class="bmm-sort"
    :class="{ open }"
  >
    <button
      type="button"
      class="bmm-sort-trigger"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :title="t('sort.label')"
      @click="toggle"
    >
      <span class="bmm-sort-trigger-label">
        <I18nText msg="sort.prefix" align="start" />
        <I18nText :msg="activeOption.msg" align="start" />
      </span>
      <ChevronDown :size="12" class="bmm-sort-chevron" />
    </button>

    <button
      type="button"
      class="bmm-sort-dir"
      :class="{ desc: sortDir === 'desc' }"
      :title="
        sortDir === 'asc' ? t('sort.dirAsc') : t('sort.dirDesc')
      "
      :aria-label="
        sortDir === 'asc' ? t('sort.dirAsc') : t('sort.dirDesc')
      "
      @click="toggleDir"
    >
      <ArrowUpDown :size="14" />
    </button>

    <div
      v-if="open"
      class="bmm-sort-menu"
      role="listbox"
      :aria-label="t('sort.label')"
    >
      <button
        v-for="opt in OPTIONS"
        :key="opt.id"
        type="button"
        role="option"
        class="bmm-sort-option"
        :class="{ selected: sortMode === opt.id }"
        :aria-selected="sortMode === opt.id"
        @click="pick(opt.id)"
      >
        <component :is="opt.icon" :size="14" class="bmm-sort-option-icon" />
        <span class="bmm-sort-option-label">
          <I18nText :msg="opt.msg" align="start" />
        </span>
        <Check
          v-if="sortMode === opt.id"
          :size="14"
          class="bmm-sort-check"
        />
      </button>
    </div>
  </div>
</template>
