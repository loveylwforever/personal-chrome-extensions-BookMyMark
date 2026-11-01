<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Check, ChevronDown, Search } from 'lucide-vue-next';
import { t } from '~/modules/i18n';

export interface SelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SelectOption[];
    placeholder?: string;
    /** sm: batch bar; md: dialog fields */
    size?: 'sm' | 'md';
    disabled?: boolean;
    /** 下拉内搜索过滤 */
    searchable?: boolean;
    searchPlaceholder?: string;
  }>(),
  {
    placeholder: undefined,
    size: 'md',
    disabled: false,
    searchable: false,
    searchPlaceholder: undefined,
  },
);

const emit = defineEmits<{
  'update:modelValue': [string];
}>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);
const activeIndex = ref(-1);
const query = ref('');

const selected = computed(() =>
  props.options.find((o) => o.value === props.modelValue),
);

const displayLabel = computed(
  () => selected.value?.label ?? props.placeholder ?? t('select.placeholder'),
);

const searchPh = computed(
  () => props.searchPlaceholder ?? t('select.searchFolder'),
);

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!props.searchable || !q) return props.options;
  return props.options.filter((o) => o.label.toLowerCase().includes(q));
});

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    query.value = '';
    syncActiveToSelected();
    void nextTick(() => {
      if (props.searchable) searchEl.value?.focus();
      scrollActiveIntoView();
    });
  }
}

function close() {
  open.value = false;
  activeIndex.value = -1;
  query.value = '';
}

function pick(value: string) {
  emit('update:modelValue', value);
  close();
}

function syncActiveToSelected() {
  const idx = filteredOptions.value.findIndex(
    (o) => o.value === props.modelValue,
  );
  activeIndex.value = idx >= 0 ? idx : filteredOptions.value.length ? 0 : -1;
}

function scrollActiveIntoView() {
  const el = listEl.value?.querySelector<HTMLElement>('[data-active="true"]');
  el?.scrollIntoView({ block: 'nearest' });
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!filteredOptions.value.length) return;
    activeIndex.value = Math.min(
      filteredOptions.value.length - 1,
      Math.max(0, activeIndex.value) + 1,
    );
    void nextTick(scrollActiveIntoView);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!filteredOptions.value.length) return;
    activeIndex.value = Math.max(0, activeIndex.value - 1);
    void nextTick(scrollActiveIntoView);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const opt = filteredOptions.value[activeIndex.value];
    if (opt) pick(opt.value);
  }
}

function onDocPointer(e: PointerEvent) {
  if (!open.value || !rootEl.value) return;
  if (!rootEl.value.contains(e.target as Node)) close();
}

watch(query, () => {
  if (!open.value) return;
  activeIndex.value = filteredOptions.value.length ? 0 : -1;
  void nextTick(scrollActiveIntoView);
});

watch(
  () => props.options,
  () => {
    if (open.value && activeIndex.value >= filteredOptions.value.length) {
      activeIndex.value = Math.max(0, filteredOptions.value.length - 1);
    }
  },
);

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true);
});
</script>

<template>
  <div
    ref="rootEl"
    class="bmm-select"
    :class="[`size-${size}`, { open, disabled, empty: !selected }]"
  >
    <button
      type="button"
      class="bmm-select-trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="bmm-select-label">{{ displayLabel }}</span>
      <ChevronDown :size="size === 'sm' ? 12 : 14" class="bmm-select-chevron" />
    </button>

    <div
      v-if="open"
      class="bmm-select-panel"
      role="listbox"
      @keydown="onKeydown"
    >
      <label
        v-if="searchable"
        class="bmm-select-search"
        @click.stop
      >
        <Search :size="14" aria-hidden="true" />
        <input
          ref="searchEl"
          v-model="query"
          type="search"
          :placeholder="searchPh"
          autocomplete="off"
          @keydown="onKeydown"
        />
      </label>

      <div ref="listEl" class="bmm-select-list">
        <div
          v-if="!filteredOptions.length"
          class="bmm-select-empty"
        >
          {{ query.trim() ? t('select.noMatch') : t('select.empty') }}
        </div>
        <button
          v-for="(opt, i) in filteredOptions"
          :key="opt.value"
          type="button"
          class="bmm-select-option"
          role="option"
          :aria-selected="opt.value === modelValue"
          :data-active="i === activeIndex"
          :class="{
            selected: opt.value === modelValue,
            active: i === activeIndex,
          }"
          @mouseenter="activeIndex = i"
          @click="pick(opt.value)"
        >
          <span class="bmm-select-option-label">{{ opt.label }}</span>
          <Check
            v-if="opt.value === modelValue"
            :size="14"
            class="bmm-select-check"
          />
        </button>
      </div>
    </div>
  </div>
</template>
