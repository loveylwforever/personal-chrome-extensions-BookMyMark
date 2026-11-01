<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import {
  Coffee,
  Plus,
  Search,
} from 'lucide-vue-next';
import type { Locale, ThemeMode, ThemePref } from '~/modules/bookmarks/types';
import { locale, t } from '~/modules/i18n';
import AppearanceMenu from './AppearanceMenu.vue';
import ClockCard from './ClockCard.vue';
import I18nText from './I18nText.vue';
import IpCard from './IpCard.vue';
import LocaleSelect from './LocaleSelect.vue';
import MagicMenu from './MagicMenu.vue';
import MoreMenu from './MoreMenu.vue';
import ToolsMenu from './ToolsMenu.vue';

const TIP_URL = 'https://www.laima.ltd/tip';

const props = defineProps<{
  search: string;
  theme: ThemeMode;
  themePref: ThemePref;
  accent: string;
  locale: Locale;
}>();

const emit = defineEmits<{
  'update:search': [string];
  add: [];
  dedupe: [];
  arrangeDomain: [];
  arrangeName: [];
  probe: [];
  import: [];
  export: [];
  clear: [];
  'update:themePref': [ThemePref];
  'update:accent': [string];
  'update:locale': [Locale];
}>();

const searchInput = ref<HTMLInputElement | null>(null);
const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
const searchKeyHint = isMac ? 'Meta+K' : 'Control+K';
const searchKeyLabel = isMac ? '⌘K' : 'Ctrl+K';

function focusSearch() {
  const el = searchInput.value;
  if (!el) return;
  el.focus();
  el.select();
}

function isTypingTarget(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function onDocKeydown(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
  if (e.key.toLowerCase() !== 'k') return;
  if (document.querySelector('dialog[open]')) return;

  const target = e.target;
  if (isTypingTarget(target) && target !== searchInput.value) return;

  e.preventDefault();
  focusSearch();
}

onMounted(() => {
  document.addEventListener('keydown', onDocKeydown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown, true);
});
</script>

<template>
  <header class="bmm-toolbar">
    <div class="bmm-toolbar-brand">
      <div class="bmm-toolbar-title">BookMyMark</div>
      <a
        class="bmm-toolbar-tip"
        :href="TIP_URL"
        target="_blank"
        rel="noopener noreferrer"
        :title="t('toolbar.tip')"
        :aria-label="t('toolbar.tip')"
      >
        <Coffee :size="15" />
      </a>
      <ToolsMenu />
      <IpCard />
    </div>

    <div class="bmm-toolbar-center">
      <ClockCard />
    </div>

    <div class="bmm-toolbar-end">
      <label class="bmm-search">
        <Search :size="14" />
        <input
          ref="searchInput"
          :value="props.search"
          type="search"
          :placeholder="t('toolbar.search')"
          :aria-keyshortcuts="searchKeyHint"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
        <kbd v-if="!props.search" class="bmm-search-kbd" aria-hidden="true">{{ searchKeyLabel }}</kbd>
      </label>

      <LocaleSelect
        :model-value="locale"
        @update:model-value="emit('update:locale', $event)"
      />

      <AppearanceMenu
        :theme-pref="themePref"
        :theme="theme"
        :accent="accent"
        @update:theme-pref="emit('update:themePref', $event)"
        @update:accent="emit('update:accent', $event)"
      />

      <MagicMenu
        @dedupe="emit('dedupe')"
        @arrange-domain="emit('arrangeDomain')"
        @arrange-name="emit('arrangeName')"
        @probe="emit('probe')"
      />

      <MoreMenu
        @import="emit('import')"
        @export="emit('export')"
        @clear="emit('clear')"
      />

      <button type="button" class="bmm-btn bmm-btn-primary" @click="emit('add')">
        <Plus :size="14" />
        <I18nText msg="toolbar.add" />
      </button>
    </div>
  </header>
</template>
