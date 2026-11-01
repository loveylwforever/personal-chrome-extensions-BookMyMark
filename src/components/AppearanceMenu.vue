<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Check, Monitor, Moon, Palette, Pipette, Sun } from 'lucide-vue-next';
import {
  accentPreviewColors,
  COLOR_PRESETS,
  isHexColor,
  normalizeHex,
  type ThemePref,
} from '~/modules/bookmarks/appearance';
import type { ThemeMode } from '~/modules/bookmarks/types';
import { t, type MessageKey } from '~/modules/i18n';
import I18nText from './I18nText.vue';

const props = defineProps<{
  themePref: ThemePref;
  theme: ThemeMode;
  accent: string;
}>();

const emit = defineEmits<{
  'update:themePref': [ThemePref];
  'update:accent': [string];
}>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const customInput = ref<HTMLInputElement | null>(null);

const customHex = computed(() =>
  isHexColor(props.accent) ? normalizeHex(props.accent) : '#8ab4f8',
);

const isCustom = computed(() => isHexColor(props.accent));

const modes: { id: ThemePref; icon: typeof Sun; label: MessageKey }[] = [
  { id: 'light', icon: Sun, label: 'appearance.light' },
  { id: 'dark', icon: Moon, label: 'appearance.dark' },
  { id: 'system', icon: Monitor, label: 'appearance.system' },
];

function swatchStyle(accent: string) {
  const c = accentPreviewColors(props.theme, accent);
  return {
    background: `conic-gradient(
      ${c.top} 0deg 180deg,
      ${c.bottomLeft} 180deg 270deg,
      ${c.bottomRight} 270deg 360deg
    )`,
  };
}

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onDocPointer(e: PointerEvent) {
  if (!open.value || !rootEl.value) return;
  if (!rootEl.value.contains(e.target as Node)) close();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close();
}

function pickPreset(id: string) {
  emit('update:accent', id);
}

function openCustomPicker() {
  customInput.value?.click();
}

function onCustomInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  if (isHexColor(value)) emit('update:accent', normalizeHex(value));
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
  <div ref="rootEl" class="bmm-appearance" :class="{ open }">
    <button
      type="button"
      class="bmm-btn bmm-btn-icon bmm-btn-theme"
      :title="t('appearance.title')"
      :aria-label="t('appearance.title')"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <Palette :size="18" :stroke-width="2.25" />
    </button>

    <div
      v-if="open"
      class="bmm-appearance-panel"
      role="dialog"
      :aria-label="t('appearance.title')"
    >
      <div class="bmm-appearance-title">
        <I18nText msg="appearance.title" />
      </div>

      <div class="bmm-appearance-modes" role="radiogroup">
        <button
          v-for="mode in modes"
          :key="mode.id"
          type="button"
          class="bmm-appearance-mode"
          :class="{ active: themePref === mode.id }"
          role="radio"
          :aria-checked="themePref === mode.id"
          @click="emit('update:themePref', mode.id)"
        >
          <Check v-if="themePref === mode.id" :size="13" class="bmm-appearance-check" />
          <component :is="mode.icon" v-else :size="14" />
          <span>{{ t(mode.label) }}</span>
        </button>
      </div>

      <div class="bmm-appearance-grid" role="listbox" :aria-label="t('appearance.colors')">
        <button
          v-for="preset in COLOR_PRESETS"
          :key="preset.id"
          type="button"
          class="bmm-appearance-swatch"
          :class="{ active: accent === preset.id }"
          role="option"
          :aria-selected="accent === preset.id"
          :title="preset.id"
          @click="pickPreset(preset.id)"
        >
          <span class="bmm-appearance-circle" :style="swatchStyle(preset.id)" />
          <span v-if="accent === preset.id" class="bmm-appearance-swatch-check">
            <Check :size="11" :stroke-width="3" />
          </span>
        </button>

        <button
          type="button"
          class="bmm-appearance-swatch"
          :class="{ active: isCustom }"
          role="option"
          :aria-selected="isCustom"
          :title="t('appearance.custom')"
          @click="openCustomPicker"
        >
          <span
            class="bmm-appearance-circle bmm-appearance-custom"
            :style="{ background: customHex }"
          >
            <Pipette :size="14" />
          </span>
          <span v-if="isCustom" class="bmm-appearance-swatch-check">
            <Check :size="11" :stroke-width="3" />
          </span>
          <input
            ref="customInput"
            class="bmm-appearance-color-input"
            type="color"
            :value="customHex"
            @input="onCustomInput"
          />
        </button>
      </div>
    </div>
  </div>
</template>
