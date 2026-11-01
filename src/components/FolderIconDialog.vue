<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Search } from 'lucide-vue-next';
import { t, type MessageKey } from '~/modules/i18n';
import {
  EMOJI_ICON_CATEGORIES,
  firstGrapheme,
  filterLucideIds,
  isLucideFolderIcon,
  lucideIdFromValue,
  toLucideFolderIcon,
} from '~/modules/bookmarks/folder-icons';
import FolderGlyph from './FolderGlyph.vue';
import LucideIconPreview from './LucideIconPreview.vue';

const props = defineProps<{
  open: boolean;
  folderTitle: string;
  currentIcon?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [icon: string | null];
}>();

type TabId = 'emoji' | 'lucide';

const EMOJI_CAT_MSG: Record<string, MessageKey> = {
  work: 'iconDialog.catWork',
  tech: 'iconDialog.catTech',
  media: 'iconDialog.catMedia',
  life: 'iconDialog.catLife',
  travel: 'iconDialog.catTravel',
  nature: 'iconDialog.catNature',
  food: 'iconDialog.catFood',
  smile: 'iconDialog.catSmile',
  symbols: 'iconDialog.catSymbols',
};

const tab = ref<TabId>('emoji');
const selected = ref('');
const custom = ref('');
const lucideQuery = ref('');
const dialog = ref<HTMLDialogElement | null>(null);

const lucideIds = computed(() => filterLucideIds(lucideQuery.value));

watch(
  () => props.open,
  (v) => {
    if (v) {
      selected.value = props.currentIcon ?? '';
      custom.value = '';
      lucideQuery.value = '';
      if (props.currentIcon && isLucideFolderIcon(props.currentIcon)) {
        tab.value = 'lucide';
        lucideQuery.value = lucideIdFromValue(props.currentIcon);
      } else {
        tab.value = 'emoji';
      }
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

function pickEmoji(icon: string) {
  selected.value = icon;
  custom.value = '';
}

function pickLucide(id: string) {
  selected.value = toLucideFolderIcon(id);
  custom.value = '';
}

function onCustomInput() {
  const v = firstGrapheme(custom.value);
  custom.value = v;
  if (v) selected.value = v;
}

function onReset() {
  emit('submit', null);
}

function onSubmit() {
  emit('submit', selected.value.trim() || null);
}

function isEmojiSelected(icon: string) {
  return selected.value === icon;
}

function isLucideSelected(id: string) {
  return selected.value === toLucideFolderIcon(id);
}
</script>

<template>
  <dialog
    ref="dialog"
    class="bmm-dialog bmm-icon-dialog"
    @close="emit('close')"
  >
    <form class="bmm-dialog-body" @submit.prevent="onSubmit">
      <header class="bmm-icon-dialog-head">
        <div>
          <h3>{{ t('iconDialog.title') }}</h3>
          <p class="bmm-dialog-message">{{ folderTitle }}</p>
        </div>
        <div class="bmm-icon-dialog-preview" :title="selected || undefined">
          <FolderGlyph :icon="selected || null" :size="18" />
        </div>
      </header>

      <div class="bmm-icon-tabs" role="tablist" :aria-label="t('iconDialog.title')">
        <button
          type="button"
          class="bmm-icon-tab"
          role="tab"
          :aria-selected="tab === 'emoji'"
          :class="{ active: tab === 'emoji' }"
          @click="tab = 'emoji'"
        >
          {{ t('iconDialog.tabEmoji') }}
        </button>
        <button
          type="button"
          class="bmm-icon-tab"
          role="tab"
          :aria-selected="tab === 'lucide'"
          :class="{ active: tab === 'lucide' }"
          @click="tab = 'lucide'"
        >
          {{ t('iconDialog.tabLucide') }}
        </button>
      </div>

      <div v-show="tab === 'emoji'" class="bmm-icon-pane" role="tabpanel">
        <div class="bmm-icon-scroll">
          <section
            v-for="cat in EMOJI_ICON_CATEGORIES"
            :key="cat.id"
            class="bmm-icon-section"
          >
            <h4 class="bmm-icon-section-title">
              {{ t(EMOJI_CAT_MSG[cat.id] ?? 'iconDialog.tabEmoji') }}
            </h4>
            <div class="bmm-icon-grid" role="listbox">
              <button
                v-for="icon in cat.emojis"
                :key="`${cat.id}-${icon}`"
                type="button"
                class="bmm-icon-opt"
                role="option"
                :aria-selected="isEmojiSelected(icon)"
                :class="{ selected: isEmojiSelected(icon) }"
                @click="pickEmoji(icon)"
              >
                {{ icon }}
              </button>
            </div>
          </section>
        </div>

        <div class="bmm-field">
          <label>{{ t('iconDialog.custom') }}</label>
          <input
            v-model="custom"
            type="text"
            maxlength="16"
            :placeholder="t('iconDialog.customPh')"
            @input="onCustomInput"
          />
        </div>
      </div>

      <div v-show="tab === 'lucide'" class="bmm-icon-pane" role="tabpanel">
        <label class="bmm-icon-search">
          <Search :size="14" />
          <input
            v-model="lucideQuery"
            type="search"
            :placeholder="t('iconDialog.searchLucide')"
          />
        </label>
        <p class="bmm-icon-hint">
          {{
            lucideQuery.trim()
              ? t('iconDialog.lucideMatches', { count: lucideIds.length })
              : t('iconDialog.lucidePopular')
          }}
        </p>
        <div class="bmm-icon-scroll">
          <div class="bmm-icon-grid lucide" role="listbox">
            <button
              v-for="id in lucideIds"
              :key="id"
              type="button"
              class="bmm-icon-opt lucide"
              role="option"
              :title="id"
              :aria-label="id"
              :aria-selected="isLucideSelected(id)"
              :class="{ selected: isLucideSelected(id) }"
              @click="pickLucide(id)"
            >
              <LucideIconPreview :id="id" :size="16" />
            </button>
          </div>
        </div>
      </div>

      <div class="bmm-dialog-actions">
        <button type="button" class="bmm-btn" @click="onReset">
          {{ t('iconDialog.reset') }}
        </button>
        <button type="button" class="bmm-btn" @click="emit('close')">
          {{ t('iconDialog.cancel') }}
        </button>
        <button type="submit" class="bmm-btn bmm-btn-primary">
          {{ t('iconDialog.ok') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
