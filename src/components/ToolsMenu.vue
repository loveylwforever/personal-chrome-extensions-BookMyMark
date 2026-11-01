<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Braces, ChevronDown, Link2, Wrench } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import I18nText from './I18nText.vue';
import ToolsDialog from './ToolsDialog.vue';
import type { ToolTab } from '~/modules/tools/cache';

const menuOpen = ref(false);
const dialogOpen = ref(false);
const tab = ref<ToolTab>('json');
const rootEl = ref<HTMLElement | null>(null);

function openTool(next: ToolTab) {
  tab.value = next;
  menuOpen.value = false;
  dialogOpen.value = true;
}

function onDocPointer(e: PointerEvent) {
  if (!menuOpen.value || !rootEl.value?.contains(e.target as Node)) {
    menuOpen.value = false;
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false;
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
  <div ref="rootEl" class="bmm-tools-menu" :class="{ open: menuOpen }">
    <button
      type="button"
      class="bmm-btn bmm-tools-trigger"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :title="t('toolbar.tools')"
      @click="menuOpen = !menuOpen"
    >
      <Wrench :size="14" />
      <I18nText msg="toolbar.tools" />
      <ChevronDown :size="12" class="bmm-tools-chevron" />
    </button>

    <div
      v-if="menuOpen"
      class="bmm-tools-dropdown"
      role="menu"
      :aria-label="t('toolbar.tools')"
    >
      <button type="button" class="bmm-magic-item" role="menuitem" @click="openTool('json')">
        <Braces :size="14" />
        <I18nText msg="tools.json" align="start" />
      </button>
      <button type="button" class="bmm-magic-item" role="menuitem" @click="openTool('url')">
        <Link2 :size="14" />
        <I18nText msg="tools.url" align="start" />
      </button>
    </div>

    <ToolsDialog :open="dialogOpen" :tab="tab" @close="dialogOpen = false" />
  </div>
</template>
