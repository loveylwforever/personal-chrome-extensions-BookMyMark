<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { locale, t, type Locale } from '~/modules/i18n';

const BCP47: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ru: 'ru-RU',
  fr: 'fr-FR',
  hi: 'hi-IN',
};

const now = ref(new Date());

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function tick() {
  now.value = new Date();
}

function stop() {
  if (timeoutId != null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function start() {
  stop();
  tick();
  const delay = 1000 - (Date.now() % 1000);
  timeoutId = setTimeout(() => {
    tick();
    intervalId = setInterval(tick, 1000);
  }, delay);
}

const bcp47 = computed(() => BCP47[locale.value] ?? 'en-US');

const dayNum = computed(() => pad(now.value.getDate()));

const yearMonth = computed(() => {
  const d = now.value;
  if (locale.value === 'zh') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }
  return new Intl.DateTimeFormat(bcp47.value, {
    year: 'numeric',
    month: 'short',
  }).format(d);
});

const weekday = computed(() =>
  new Intl.DateTimeFormat(bcp47.value, { weekday: 'short' }).format(now.value),
);

const timeParts = computed(() => {
  const d = now.value;
  return {
    hh: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  };
});

const fullLabel = computed(() => {
  const d = now.value;
  const date = new Intl.DateTimeFormat(bcp47.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(d);
  const time = `${timeParts.value.hh}:${timeParts.value.mm}:${timeParts.value.ss}`;
  return `${t('toolbar.clock')}: ${date} ${time}`;
});

watch(locale, () => {
  tick();
});

onMounted(start);
onBeforeUnmount(stop);
</script>

<template>
  <div
    class="bmm-clock-card"
    role="timer"
    :aria-live="'off'"
    :aria-label="fullLabel"
    :title="fullLabel"
  >
    <span class="bmm-clock-cal" aria-hidden="true">
      <span class="bmm-clock-day">{{ dayNum }}</span>
      <span class="bmm-clock-meta">
        <span class="bmm-clock-ym">{{ yearMonth }}</span>
        <span class="bmm-clock-wd">{{ weekday }}</span>
      </span>
    </span>
    <span class="bmm-clock-rail" aria-hidden="true" />
    <span class="bmm-clock-time" aria-hidden="true">
      <span>{{ timeParts.hh }}</span>
      <span class="bmm-clock-colon">:</span>
      <span>{{ timeParts.mm }}</span>
      <span class="bmm-clock-colon">:</span>
      <span class="bmm-clock-sec">{{ timeParts.ss }}</span>
    </span>
  </div>
</template>
