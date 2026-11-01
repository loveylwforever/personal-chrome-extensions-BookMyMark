<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Check, Copy, Globe, MapPin, RefreshCw } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import {
  fetchPublicIp,
  guessNetRegion,
  type NetRegion,
} from '~/modules/tools/public-ip';

type Status = 'loading' | 'ready' | 'error';

const region = ref<NetRegion>(guessNetRegion());
const status = ref<Status>('loading');
const ip = ref('');
const copied = ref(false);
const refreshing = ref(false);

let copyTimer: ReturnType<typeof setTimeout> | null = null;
let abort: AbortController | null = null;

const regionTip = computed(() =>
  region.value === 'cn' ? t('toolbar.ipUseGlobal') : t('toolbar.ipUseCn'),
);

const copyTip = computed(() => {
  if (status.value === 'error') return t('toolbar.ipRetry');
  if (status.value !== 'ready') return t('toolbar.ipLoading');
  return t('toolbar.ipCopy');
});

async function load(force = false) {
  abort?.abort();
  abort = new AbortController();
  if (force || status.value === 'ready') refreshing.value = true;
  else status.value = 'loading';

  try {
    ip.value = await fetchPublicIp({
      region: region.value,
      force,
      signal: abort.signal,
    });
    status.value = 'ready';
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
    status.value = 'error';
    ip.value = '';
  } finally {
    refreshing.value = false;
  }
}

async function copyIp() {
  if (status.value === 'error') {
    void load(true);
    return;
  }
  if (status.value !== 'ready' || !ip.value) return;
  try {
    await navigator.clipboard.writeText(ip.value);
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 1400);
  } catch {
    /* ignore */
  }
}

function toggleRegion() {
  region.value = region.value === 'cn' ? 'global' : 'cn';
  void load(true);
}

onMounted(() => {
  void load();
});

onBeforeUnmount(() => {
  abort?.abort();
  if (copyTimer) clearTimeout(copyTimer);
});
</script>

<template>
  <div
    class="bmm-ip-card"
    :class="{
      loading: status === 'loading',
      error: status === 'error',
      copied,
      refreshing,
      cn: region === 'cn',
      global: region === 'global',
    }"
  >
    <span class="bmm-ip-card-glow" aria-hidden="true" />
    <button
      type="button"
      class="bmm-ip-card-mark"
      :title="regionTip"
      :aria-label="regionTip"
      :disabled="status === 'loading'"
      @click="toggleRegion"
    >
      <MapPin v-if="region === 'cn'" :size="12" stroke-width="2.1" />
      <Globe v-else :size="12" stroke-width="2.1" />
    </button>
    <button
      type="button"
      class="bmm-ip-card-main"
      :disabled="status === 'loading'"
      :title="copyTip"
      :aria-label="
        status === 'ready'
          ? `${t('toolbar.ip')}: ${ip}`
          : status === 'error'
            ? t('toolbar.ipError')
            : t('toolbar.ipLoading')
      "
      @click="copyIp"
    >
      <span class="bmm-ip-card-text">
        <span class="bmm-ip-card-label">{{ t('toolbar.ip') }}</span>
        <span v-if="status === 'ready'" class="bmm-ip-card-value">{{ ip }}</span>
        <span v-else-if="status === 'error'" class="bmm-ip-card-value muted">
          {{ t('toolbar.ipError') }}
        </span>
        <span v-else class="bmm-ip-card-value muted bmm-ip-card-skeleton">····</span>
      </span>
      <span class="bmm-ip-card-action" aria-hidden="true">
        <Check v-if="copied" :size="12" stroke-width="2.4" class="bmm-ip-card-check" />
        <RefreshCw
          v-else-if="status === 'error' || refreshing || status === 'loading'"
          :size="12"
          stroke-width="2.2"
          class="bmm-ip-card-spin"
        />
        <Copy v-else :size="12" stroke-width="2.1" />
      </span>
    </button>
  </div>
</template>
