<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown, Download, Ellipsis, Trash2, Upload } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import I18nText from './I18nText.vue';

const emit = defineEmits<{
  import: [];
  export: [];
  clear: [];
}>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onImport() {
  close();
  emit('import');
}

function onExport() {
  close();
  emit('export');
}

function onClear() {
  close();
  emit('clear');
}

function onDocPointer(e: PointerEvent) {
  if (!open.value || !rootEl.value) return;
  if (!rootEl.value.contains(e.target as Node)) close();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close();
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
    class="bmm-more"
    :class="{ open }"
  >
    <button
      type="button"
      class="bmm-btn bmm-more-trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      :title="t('toolbar.more')"
      @click="toggle"
    >
      <Ellipsis :size="14" />
      <I18nText msg="toolbar.more" />
      <ChevronDown :size="12" class="bmm-more-chevron" />
    </button>

    <div
      v-if="open"
      class="bmm-more-menu"
      role="menu"
      :aria-label="t('toolbar.more')"
    >
      <button
        type="button"
        class="bmm-magic-item"
        role="menuitem"
        @click="onImport"
      >
        <Upload :size="14" />
        <I18nText msg="toolbar.import" align="start" />
      </button>
      <button
        type="button"
        class="bmm-magic-item"
        role="menuitem"
        @click="onExport"
      >
        <Download :size="14" />
        <I18nText msg="toolbar.export" align="start" />
      </button>
      <button
        type="button"
        class="bmm-magic-item danger"
        role="menuitem"
        @click="onClear"
      >
        <Trash2 :size="14" />
        <I18nText msg="toolbar.clear" align="start" />
      </button>
    </div>
  </div>
</template>
