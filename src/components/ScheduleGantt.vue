<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { Download } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import {
  TODO_STORAGE_LIMIT_BYTES,
  buildDayColumns,
  clearTodoRollover,
  dayKey,
  layoutHourBars,
  loadTodos,
  readTodoStorageStatus,
  sortTodosForList,
  startOfLocalDay,
  subscribeTodoStorage,
  subscribeTodos,
  todoEndAt,
  todoProgress,
  type TodoItem,
  type TodoStorageStatus,
} from '~/modules/home/todos';

const props = defineProps<{
  items: TodoItem[];
}>();

const DAY_PX = 40;
const HOUR_PX = 28;
const ROW_H = 28;
const DAY_MS = 86_400_000;

const expandedKey = ref<string | null>(null);
const scroller = ref<HTMLElement | null>(null);
const now = ref(Date.now());
const storageStatus = ref<TodoStorageStatus>({
  bytes: 0,
  limit: TODO_STORAGE_LIMIT_BYTES,
  trimmed: 0,
  warn: false,
});
const warnDismissed = ref(false);
let tickTimer: ReturnType<typeof setInterval> | null = null;
let resizeObs: ResizeObserver | null = null;
let unsubStorage: (() => void) | null = null;
let unsubTodos: (() => void) | null = null;
let placedToday = false;

const columns = computed(() => buildDayColumns(new Date(now.value)));

/** Open todos first (by start), then done — one row each. */
const rows = computed(() => {
  const { open, done } = sortTodosForList(props.items);
  return [...open, ...done];
});

const lanesHeight = computed(() => Math.max(ROW_H, rows.value.length * ROW_H));

const expandedDay = computed(() => {
  if (!expandedKey.value) return null;
  return columns.value.find((c) => c.key === expandedKey.value) ?? null;
});

const trackWidthPx = computed(() => {
  let w = 0;
  for (const c of columns.value) w += colWidth(c.key);
  return w;
});

function colWidth(key: string): number {
  return expandedKey.value === key ? 24 * HOUR_PX : DAY_PX;
}

function colOffset(key: string): number {
  let x = 0;
  for (const c of columns.value) {
    if (c.key === key) return x;
    x += colWidth(c.key);
  }
  return 0;
}

function dayFraction(ms: number): number {
  const start = startOfLocalDay(new Date(ms)).getTime();
  return Math.min(1, Math.max(0, (ms - start) / DAY_MS));
}

function barLeftWidth(startAt: number, endAt: number): { left: number; width: number } {
  const startKey = dayKey(new Date(startAt));
  const endKey = dayKey(new Date(Math.max(startAt, endAt - 1)));
  const left =
    colOffset(startKey) + dayFraction(startAt) * colWidth(startKey);
  const right =
    colOffset(endKey) + dayFraction(endAt) * colWidth(endKey);
  return { left, width: Math.max(8, right - left) };
}

function rowBarStyle(todo: TodoItem) {
  if (expandedDay.value) {
    const hours = layoutHourBars([todo], expandedDay.value.date, now.value);
    const bar = hours[0];
    if (!bar || !expandedKey.value) return { display: 'none' };
    const base = colOffset(expandedKey.value);
    return {
      left: `${base + bar.hourLeft * HOUR_PX}px`,
      width: `${Math.max(6, bar.hourWidth * HOUR_PX)}px`,
      background: todo.color,
    };
  }
  const end = todoEndAt(todo);
  const { left, width } = barLeftWidth(todo.startAt, end);
  return {
    left: `${left}px`,
    width: `${width}px`,
    background: todo.color,
  };
}

function todayLineLeft(): number {
  const key = dayKey(new Date(now.value));
  return colOffset(key) + dayFraction(now.value) * colWidth(key);
}

function monthSpanWidth(year: number, month: number): number {
  return columns.value
    .filter((c) => c.year === year && c.month === month)
    .reduce((s, c) => s + colWidth(c.key), 0);
}

function toggleDay(key: string) {
  expandedKey.value = expandedKey.value === key ? null : key;
}

function monthLabel(col: { year: number; month: number }) {
  return t('home.ganttMonth', {
    year: col.year,
    month: col.month + 1,
  });
}

function formatBarTip(todo: TodoItem) {
  const end = todoEndAt(todo);
  const fmt = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return `${todo.title || t('home.todoTitlePh')} · ${fmt(todo.startAt)} – ${fmt(end)}`;
}

function scrollToToday(smooth = false) {
  const el = scroller.value;
  if (!el || el.clientWidth <= 0) return false;
  const key = dayKey(new Date(now.value));
  const center = colOffset(key) + colWidth(key) / 2;
  const left = Math.max(0, center - el.clientWidth / 2);
  if (smooth) el.scrollTo({ left, behavior: 'smooth' });
  else el.scrollLeft = left;
  return true;
}

function placeTodayOnce() {
  if (placedToday) return;
  if (!scrollToToday()) return;
  placedToday = true;
  resizeObs?.disconnect();
  resizeObs = null;
}

function onStorage(next: TodoStorageStatus) {
  if (next.trimmed > storageStatus.value.trimmed) warnDismissed.value = false;
  storageStatus.value = next;
}

async function exportBackup() {
  const stored = await loadTodos();
  const payload = {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    items: stored.items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `bookmymark-todos-${day}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (stored.rolled) {
    await clearTodoRollover();
    warnDismissed.value = true;
  }
}

onMounted(() => {
  unsubStorage = subscribeTodoStorage(onStorage);
  unsubTodos = subscribeTodos(() => {
    void readTodoStorageStatus();
  });
  void readTodoStorageStatus();
  placeTodayOnce();
  if (!placedToday && scroller.value) {
    resizeObs = new ResizeObserver(() => placeTodayOnce());
    resizeObs.observe(scroller.value);
  }
  tickTimer = setInterval(() => {
    now.value = Date.now();
  }, 60_000);
});

onBeforeUnmount(() => {
  resizeObs?.disconnect();
  unsubStorage?.();
  unsubTodos?.();
  if (tickTimer) clearInterval(tickTimer);
});

watch(expandedKey, async () => {
  await nextTick();
  if (!expandedKey.value || !scroller.value) return;
  const el = scroller.value.querySelector(
    `[data-day="${expandedKey.value}"]`,
  ) as HTMLElement | null;
  el?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
});
</script>

<template>
  <section class="bmm-gantt" :aria-label="t('home.ganttTitle')">
    <header class="bmm-gantt-head">
      <div class="bmm-gantt-heading">
        <h2 class="bmm-gantt-title">{{ t('home.ganttTitle') }}</h2>
        <button
          type="button"
          class="bmm-btn bmm-gantt-export"
          :title="t('home.ganttExport')"
          @click="exportBackup"
        >
          <Download :size="13" />
          {{ t('home.ganttExport') }}
        </button>
      </div>
      <div class="bmm-gantt-actions">
        <button
          v-if="expandedKey"
          type="button"
          class="bmm-btn"
          @click="expandedKey = null"
        >
          {{ t('home.ganttBackDays') }}
        </button>
        <button type="button" class="bmm-btn" @click="scrollToToday(true)">
          {{ t('home.ganttToday') }}
        </button>
      </div>
    </header>

    <div
      v-if="storageStatus.warn && !warnDismissed"
      class="bmm-gantt-warn"
      role="status"
    >
      <p>{{ t('home.ganttStorageWarn') }}</p>
      <button type="button" class="bmm-btn" @click="warnDismissed = true">
        {{ t('home.ganttStorageDismiss') }}
      </button>
    </div>

    <div class="bmm-gantt-body">
      <div class="bmm-gantt-labels">
        <div class="bmm-gantt-label-head" aria-hidden="true" />
        <div
          class="bmm-gantt-label-list"
          :style="rows.length ? { minHeight: `${lanesHeight}px` } : undefined"
        >
          <div
            v-for="todo in rows"
            :key="todo.id"
            class="bmm-gantt-label-row"
            :class="{ done: todo.done }"
            :style="{ height: `${ROW_H}px` }"
            :title="todo.title || t('home.todoTitlePh')"
          >
            <span class="bmm-gantt-label-dot" :style="{ background: todo.color }" />
            <span class="bmm-gantt-label-text">{{
              todo.title || t('home.todoTitlePh')
            }}</span>
          </div>
          <p v-if="!rows.length" class="bmm-gantt-label-empty">
            {{ t('home.ganttEmpty') }}
          </p>
        </div>
      </div>

      <div ref="scroller" class="bmm-gantt-scroll">
        <div class="bmm-gantt-track" :style="{ width: `${trackWidthPx}px` }">
          <div class="bmm-gantt-months">
            <div
              v-for="col in columns.filter((c) => c.isMonthStart)"
              :key="`m-${col.key}`"
              class="bmm-gantt-month"
              :style="{
                left: `${colOffset(col.key)}px`,
                width: `${monthSpanWidth(col.year, col.month)}px`,
              }"
            >
              {{ monthLabel(col) }}
            </div>
          </div>

          <div class="bmm-gantt-days">
            <button
              v-for="col in columns"
              :key="col.key"
              type="button"
              class="bmm-gantt-day"
              :class="{
                today: col.isToday,
                expanded: expandedKey === col.key,
                weekend: col.date.getDay() === 0 || col.date.getDay() === 6,
              }"
              :data-day="col.key"
              :style="{ width: `${colWidth(col.key)}px` }"
              :title="
                expandedKey === col.key
                  ? t('home.ganttCollapseDay')
                  : t('home.ganttExpandDay')
              "
              @click="toggleDay(col.key)"
            >
              <template v-if="expandedKey === col.key">
                <span
                  v-for="h in 24"
                  :key="h"
                  class="bmm-gantt-hour-tick"
                  :style="{ width: `${HOUR_PX}px` }"
                >
                  {{ h - 1 }}
                </span>
              </template>
              <span v-else class="bmm-gantt-day-num">{{ col.day }}</span>
            </button>
          </div>

          <div
            class="bmm-gantt-lanes"
            :style="{ minHeight: `${Math.max(lanesHeight, ROW_H * 4)}px` }"
          >
            <div
              class="bmm-gantt-today-line"
              :style="{ left: `${todayLineLeft()}px` }"
            />

            <div
              v-for="(todo, idx) in rows"
              :key="todo.id"
              class="bmm-gantt-lane"
              :class="{ done: todo.done }"
              :style="{ top: `${idx * ROW_H}px`, height: `${ROW_H}px` }"
            >
              <div
                class="bmm-gantt-bar"
                :class="{ done: todo.done }"
                :style="rowBarStyle(todo)"
                :title="formatBarTip(todo)"
              >
                <span
                  class="bmm-gantt-bar-progress"
                  :style="{
                    width: `${Math.round(todoProgress(todo, now) * 100)}%`,
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
