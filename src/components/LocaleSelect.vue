<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import type { Locale } from '~/modules/bookmarks/types';
import { LOCALE_OPTIONS, localeNativeName, t } from '~/modules/i18n';

const props = defineProps<{
  modelValue: Locale;
}>();

const emit = defineEmits<{
  'update:modelValue': [Locale];
}>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function pick(id: Locale) {
  emit('update:modelValue', id);
  open.value = false;
}

function onDocPointer(e: PointerEvent) {
  if (!open.value || !rootEl.value) return;
  if (!rootEl.value.contains(e.target as Node)) open.value = false;
}

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
    class="bmm-lang"
    :class="{ open }"
  >
    <button
      type="button"
      class="bmm-lang-trigger"
      :title="t('toolbar.language')"
      :aria-label="t('toolbar.language')"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="bmm-lang-current">{{ localeNativeName(modelValue) }}</span>
      <ChevronDown :size="12" class="bmm-lang-chevron" />
    </button>

    <div
      v-if="open"
      class="bmm-lang-menu"
      role="listbox"
      :aria-label="t('toolbar.language')"
    >
      <button
        v-for="opt in LOCALE_OPTIONS"
        :key="opt.id"
        type="button"
        role="option"
        :aria-selected="modelValue === opt.id"
        :class="{ selected: modelValue === opt.id }"
        @click="pick(opt.id)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
