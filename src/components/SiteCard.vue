<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { getFaviconUrl, letterFromTitle } from '~/modules/bookmarks/favicon';
import type { SiteItem, SiteMeta, ViewMode } from '~/modules/bookmarks/types';
import { GripVertical, Pencil, Star, Trash2 } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import I18nText from './I18nText.vue';

const props = defineProps<{
  site: SiteItem;
  meta: SiteMeta;
  viewMode: ViewMode;
  batchMode: boolean;
  selected: boolean;
  dragging?: boolean;
  folderPath?: string;
  /**
   * Probe result: `false` = dead (show stamp), `true` = alive,
   * `null`/`undefined` = not in probe mode / not checked yet.
   */
  alive?: boolean | null;
}>();

const emit = defineEmits<{
  open: [];
  edit: [];
  remove: [];
  favorite: [];
  select: [];
  dragStart: [DragEvent];
  dragOver: [DragEvent];
  dragLeave: [DragEvent];
  drop: [DragEvent];
  dragEnd: [];
}>();

const imgFailed = ref(false);
const faviconSize = computed(() => (props.viewMode === 'expanded' ? 48 : 32));
const favicon = computed(() =>
  getFaviconUrl(props.site.url, faviconSize.value),
);

const urlLabel = computed(() => {
  try {
    const u = new URL(props.site.url);
    return u.host + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return props.site.url;
  }
});

const descriptionText = computed(
  () => props.meta.description?.trim() || '',
);

watch(
  () => props.site.url,
  () => {
    imgFailed.value = false;
  },
);

onMounted(() => {
  imgFailed.value = false;
});
</script>

<template>
  <article
    class="bmm-card"
    :class="{
      selected,
      batch: batchMode,
      compact: viewMode === 'compact',
      list: viewMode === 'list',
      expanded: viewMode === 'expanded',
      dead: alive === false,
      dragging,
    }"
    draggable="true"
    @click="batchMode ? emit('select') : emit('open')"
    @dragstart="emit('dragStart', $event)"
    @dragover.prevent="emit('dragOver', $event)"
    @dragleave="emit('dragLeave', $event)"
    @drop.prevent="emit('drop', $event)"
    @dragend="emit('dragEnd')"
  >
    <div
      v-if="alive === false"
      class="bmm-dead-stamp"
      aria-hidden="true"
    >
      <span class="bmm-dead-stamp-seal">
        <span class="bmm-dead-stamp-text">{{ t('probe.stamp') }}</span>
      </span>
    </div>

    <button
      type="button"
      class="bmm-card-grip"
      :title="t('card.drag')"
      :aria-label="t('card.drag')"
      @click.stop
    >
      <GripVertical :size="14" />
    </button>

    <label
      v-if="batchMode"
      class="bmm-card-check"
      @click.stop
    >
      <input
        type="checkbox"
        :checked="selected"
        @change="emit('select')"
      />
    </label>

    <!-- 详情：上内容区 + 下操作区 -->
    <template v-if="viewMode === 'expanded'">
      <div class="bmm-card-expanded">
        <div class="bmm-card-body-zone">
          <div class="bmm-card-expanded-top">
            <img
              v-if="!imgFailed"
              class="bmm-favicon"
              :src="favicon"
              alt=""
              width="48"
              height="48"
              loading="lazy"
              decoding="async"
              draggable="false"
              @error="imgFailed = true"
            />
            <div v-else class="bmm-favicon-fallback">
              {{ letterFromTitle(site.title) }}
            </div>
            <div class="bmm-card-title">{{ site.title }}</div>
          </div>

          <div class="bmm-card-expanded-fields">
            <button
              type="button"
              class="bmm-card-url-link"
              :title="site.url"
              @click.stop="emit('open')"
            >
              {{ urlLabel }}
            </button>

            <p
              class="bmm-card-field"
              :class="{ empty: !descriptionText }"
            >
              <span class="bmm-card-field-label">
                <I18nText msg="card.desc" align="start" />
              </span>
              <span class="bmm-card-field-value">
                {{ descriptionText || t('card.noDesc') }}
              </span>
            </p>

            <p class="bmm-card-field">
              <span class="bmm-card-field-label">
                <I18nText msg="card.visits" align="start" />
              </span>
              <span class="bmm-card-field-value">
                <I18nText
                  msg="card.visitsCount"
                  align="start"
                  :params="{ count: meta.visitCount ?? 0 }"
                />
              </span>
            </p>

            <p class="bmm-card-field">
              <span class="bmm-card-field-label">
                <I18nText msg="card.folder" align="start" />
              </span>
              <span class="bmm-card-field-value">
                {{ folderPath || t('card.unknownFolder') }}
              </span>
            </p>
          </div>
        </div>

        <div class="bmm-card-action-zone" @click.stop>
          <button
            type="button"
            class="bmm-card-chip"
            :class="{ active: meta.favorited }"
            @click="emit('favorite')"
          >
            <Star :size="13" :fill="meta.favorited ? 'currentColor' : 'none'" />
            <I18nText msg="card.favorite" align="start" />
          </button>
          <button
            type="button"
            class="bmm-card-chip"
            @click="emit('edit')"
          >
            <Pencil :size="13" />
            <I18nText msg="card.edit" align="start" />
          </button>
          <button
            type="button"
            class="bmm-card-chip danger"
            @click="emit('remove')"
          >
            <Trash2 :size="13" />
            <I18nText msg="card.delete" align="start" />
          </button>
        </div>
      </div>
    </template>

    <!-- 紧凑 / 列表：横向紧凑行 -->
    <template v-else>
      <img
        v-if="!imgFailed"
        class="bmm-favicon"
        :src="favicon"
        alt=""
        width="32"
        height="32"
        loading="lazy"
        decoding="async"
        draggable="false"
        @error="imgFailed = true"
      />
      <div v-else class="bmm-favicon-fallback">
        {{ letterFromTitle(site.title) }}
      </div>

      <div class="bmm-card-body">
        <div class="bmm-card-title">{{ site.title }}</div>
        <div class="bmm-card-url">{{ site.url }}</div>
      </div>

      <div class="bmm-card-actions" @click.stop>
        <button
          type="button"
          class="bmm-icon-btn"
          :class="{ active: meta.favorited }"
          :title="t('card.favorite')"
          @click="emit('favorite')"
        >
          <Star :size="12" :fill="meta.favorited ? 'currentColor' : 'none'" />
        </button>
        <button
          type="button"
          class="bmm-icon-btn"
          :title="t('card.edit')"
          @click="emit('edit')"
        >
          <Pencil :size="12" />
        </button>
        <button
          type="button"
          class="bmm-icon-btn"
          :title="t('card.delete')"
          @click="emit('remove')"
        >
          <Trash2 :size="12" />
        </button>
      </div>
    </template>
  </article>
</template>
