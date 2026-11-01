<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  Eraser,
  Globe,
  Layers,
  Sparkles,
  Type,
} from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import I18nText from './I18nText.vue';

const emit = defineEmits<{
  dedupe: [];
  arrangeDomain: [];
  arrangeName: [];
  probe: [];
}>();

const open = ref(false);
const arrangeOpen = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
  if (!open.value) arrangeOpen.value = false;
}

function close() {
  open.value = false;
  arrangeOpen.value = false;
}

function onDedupe() {
  close();
  emit('dedupe');
}

function onArrangeDomain() {
  close();
  emit('arrangeDomain');
}

function onArrangeName() {
  close();
  emit('arrangeName');
}

function onProbe() {
  close();
  emit('probe');
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
    class="bmm-magic"
    :class="{ open }"
  >
    <button
      type="button"
      class="bmm-btn bmm-magic-trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <Sparkles :size="14" />
      <I18nText msg="toolbar.magic" />
      <ChevronDown :size="12" class="bmm-magic-chevron" />
    </button>

    <div
      v-if="open"
      class="bmm-magic-menu"
      role="menu"
      :aria-label="t('toolbar.magic')"
    >
      <button
        type="button"
        class="bmm-magic-item"
        role="menuitem"
        @click="onDedupe"
      >
        <Eraser :size="14" />
        <I18nText msg="toolbar.magicDedupe" align="start" />
      </button>

      <div
        class="bmm-magic-flyout"
        :class="{ open: arrangeOpen }"
        @pointerenter="arrangeOpen = true"
        @pointerleave="arrangeOpen = false"
      >
        <button
          type="button"
          class="bmm-magic-item bmm-magic-parent"
          role="menuitem"
          aria-haspopup="menu"
          :aria-expanded="arrangeOpen"
          @click="arrangeOpen = !arrangeOpen"
        >
          <Layers :size="14" />
          <I18nText msg="toolbar.magicArrange" align="start" />
          <ChevronLeft :size="13" class="bmm-magic-sub-chevron" />
        </button>

        <div
          v-show="arrangeOpen"
          class="bmm-magic-submenu"
          role="menu"
          :aria-label="t('toolbar.magicArrange')"
        >
          <button
            type="button"
            class="bmm-magic-item"
            role="menuitem"
            @click="onArrangeDomain"
          >
            <Globe :size="14" />
            <span class="bmm-magic-item-text">
              <I18nText msg="toolbar.magicByDomain" align="start" />
              <span class="bmm-magic-hint">{{ t('toolbar.magicByDomainHint') }}</span>
            </span>
          </button>
          <button
            type="button"
            class="bmm-magic-item"
            role="menuitem"
            @click="onArrangeName"
          >
            <Type :size="14" />
            <span class="bmm-magic-item-text">
              <I18nText msg="toolbar.magicByName" align="start" />
              <span class="bmm-magic-hint">{{ t('toolbar.magicByNameHint') }}</span>
            </span>
          </button>
        </div>
      </div>

      <button
        type="button"
        class="bmm-magic-item"
        role="menuitem"
        @click="onProbe"
      >
        <Activity :size="14" />
        <I18nText msg="toolbar.magicProbe" align="start" />
      </button>
    </div>
  </div>
</template>
