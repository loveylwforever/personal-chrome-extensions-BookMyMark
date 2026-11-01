<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import {
  TODO_DURATION_STEP_MIN,
  snapToQuarterHour,
} from '~/modules/home/todos';

const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [ms: number];
}>();

const open = ref(false);
const placed = ref(false);
const openMenu = ref<'hour' | 'minute' | null>(null);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const pop = ref<HTMLElement | null>(null);
const hourMenu = ref<HTMLElement | null>(null);
const minuteMenu = ref<HTMLElement | null>(null);
const popPos = ref({ top: '0px', left: '0px' });
const viewYear = ref(0);
const viewMonth = ref(0); // 0–11

const valueDate = computed(() => new Date(props.modelValue));

const displayLabel = computed(() => {
  const d = valueDate.value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
});

const hour = computed(() => valueDate.value.getHours());
const minute = computed(() => {
  const m = valueDate.value.getMinutes();
  return Math.round(m / TODO_DURATION_STEP_MIN) * TODO_DURATION_STEP_MIN % 60;
});

const monthTitle = computed(() =>
  t('home.ganttMonth', { year: viewYear.value, month: viewMonth.value + 1 }),
);

const weekdayLabels = computed(() => [
  t('home.calDow0'),
  t('home.calDow1'),
  t('home.calDow2'),
  t('home.calDow3'),
  t('home.calDow4'),
  t('home.calDow5'),
  t('home.calDow6'),
]);

type DayCell = {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  ts: number;
};

const cells = computed((): DayCell[] => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const startPad = (first.getDay() + 6) % 7; // Mon-first
  const gridStart = new Date(viewYear.value, viewMonth.value, 1 - startPad);
  const today = new Date();
  const sel = valueDate.value;
  const out: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    const inMonth = d.getMonth() === viewMonth.value;
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      day: d.getDate(),
      inMonth,
      isToday:
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate(),
      isSelected:
        d.getFullYear() === sel.getFullYear() &&
        d.getMonth() === sel.getMonth() &&
        d.getDate() === sel.getDate(),
      ts: d.getTime(),
    });
  }
  return out;
});

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from(
  { length: 60 / TODO_DURATION_STEP_MIN },
  (_, i) => i * TODO_DURATION_STEP_MIN,
);

function syncViewFromValue() {
  const d = valueDate.value;
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}

function emitAt(y: number, m: number, day: number, h: number, min: number) {
  const raw = new Date(y, m, day, h, min, 0, 0).getTime();
  emit('update:modelValue', snapToQuarterHour(raw, 'floor'));
}

function pickDay(cell: DayCell) {
  const d = new Date(cell.ts);
  emitAt(d.getFullYear(), d.getMonth(), d.getDate(), hour.value, minute.value);
  if (!cell.inMonth) {
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
  }
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function setHour(h: number) {
  const d = valueDate.value;
  emitAt(d.getFullYear(), d.getMonth(), d.getDate(), h, minute.value);
  openMenu.value = null;
}

function setMinute(m: number) {
  const d = valueDate.value;
  emitAt(d.getFullYear(), d.getMonth(), d.getDate(), hour.value, m);
  openMenu.value = null;
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewYear.value -= 1;
    viewMonth.value = 11;
  } else {
    viewMonth.value -= 1;
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewYear.value += 1;
    viewMonth.value = 0;
  } else {
    viewMonth.value += 1;
  }
}

function goToday() {
  const n = new Date();
  viewYear.value = n.getFullYear();
  viewMonth.value = n.getMonth();
  emitAt(
    n.getFullYear(),
    n.getMonth(),
    n.getDate(),
    hour.value,
    minute.value,
  );
}

function placePop() {
  const btn = trigger.value;
  const el = pop.value;
  if (!btn || !el || !open.value) return;
  const r = btn.getBoundingClientRect();
  const margin = 8;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = r.right - w;
  left = Math.min(Math.max(margin, left), window.innerWidth - margin - w);
  const below = r.bottom + 6;
  const above = r.top - 6 - h;
  const top =
    below + h <= window.innerHeight - margin || above < margin ? below : above;
  popPos.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` };
}

function flipMenu(menu: HTMLElement | null) {
  if (!menu) return;
  const btn = menu.previousElementSibling;
  if (!(btn instanceof HTMLElement)) return;
  const spaceBelow = window.innerHeight - btn.getBoundingClientRect().bottom;
  const openUp = spaceBelow < menu.offsetHeight + 10;
  menu.style.top = openUp ? 'auto' : '';
  menu.style.bottom = openUp ? 'calc(100% + 0.22rem)' : '';
}

async function toggleMenu(which: 'hour' | 'minute') {
  openMenu.value = openMenu.value === which ? null : which;
  await nextTick();
  const menu = which === 'hour' ? hourMenu.value : minuteMenu.value;
  flipMenu(menu);
  menu?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}

async function toggle() {
  openMenu.value = null;
  if (open.value) {
    open.value = false;
    placed.value = false;
    return;
  }
  open.value = true;
  placed.value = false;
  syncViewFromValue();
  await nextTick();
  placePop();
  placed.value = true;
}

function onDocPointer(e: PointerEvent) {
  if (!open.value) return;
  const target = e.target as Node;
  if (root.value?.contains(target) || pop.value?.contains(target)) return;
  open.value = false;
  placed.value = false;
  openMenu.value = null;
}

function onReposition() {
  if (open.value) placePop();
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.value) return;
  if (openMenu.value) {
    openMenu.value = null;
    return;
  }
  open.value = false;
  placed.value = false;
}

onMounted(() => {
  syncViewFromValue();
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onKey);
  document.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true);
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('scroll', onReposition, true);
  window.removeEventListener('resize', onReposition);
});

watch(
  () => props.modelValue,
  () => {
    if (!open.value) syncViewFromValue();
  },
);
</script>

<template>
  <div ref="root" class="bmm-dtp" :class="{ open }">
    <button
      ref="trigger"
      type="button"
      class="bmm-dtp-trigger"
      :title="t('home.todoStart')"
      :aria-label="t('home.todoStart')"
      :aria-expanded="open"
      @click="toggle"
    >
      <CalendarDays :size="13" stroke-width="2.2" />
      <span>{{ displayLabel }}</span>
    </button>

    <Teleport to="body">
    <div
      v-if="open"
      ref="pop"
      class="bmm-dtp-pop"
      :class="{ placed }"
      :style="popPos"
      role="dialog"
      :aria-label="t('home.todoStart')"
    >
      <div class="bmm-dtp-body">
        <div class="bmm-dtp-cal">
          <header class="bmm-dtp-cal-head">
            <button type="button" class="bmm-dtp-nav" @click="prevMonth">
              <ChevronLeft :size="14" />
            </button>
            <span class="bmm-dtp-month">{{ monthTitle }}</span>
            <button type="button" class="bmm-dtp-nav" @click="nextMonth">
              <ChevronRight :size="14" />
            </button>
          </header>
          <div class="bmm-dtp-dows">
            <span v-for="w in weekdayLabels" :key="w">{{ w }}</span>
          </div>
          <div class="bmm-dtp-grid">
            <button
              v-for="cell in cells"
              :key="cell.key"
              type="button"
              class="bmm-dtp-day"
              :class="{
                muted: !cell.inMonth,
                today: cell.isToday,
                selected: cell.isSelected,
              }"
              @click="pickDay(cell)"
            >
              {{ cell.day }}
            </button>
          </div>
        </div>

        <div class="bmm-dtp-time">
          <div class="bmm-dtp-field">
            <span class="bmm-dtp-field-label">{{ t('home.calHour') }}</span>
            <div class="bmm-dtp-dd" :class="{ open: openMenu === 'hour' }">
              <button
                type="button"
                class="bmm-dtp-dd-btn"
                :aria-expanded="openMenu === 'hour'"
                @click.stop="toggleMenu('hour')"
              >
                <span>{{ pad2(hour) }}</span>
                <ChevronDown :size="13" />
              </button>
              <div
                v-if="openMenu === 'hour'"
                ref="hourMenu"
                class="bmm-dtp-dd-menu"
                role="listbox"
              >
                <button
                  v-for="h in hours"
                  :key="h"
                  type="button"
                  class="bmm-dtp-dd-opt"
                  :class="{ selected: h === hour }"
                  role="option"
                  :aria-selected="h === hour"
                  @click="setHour(h)"
                >
                  {{ pad2(h) }}
                </button>
              </div>
            </div>
          </div>

          <div class="bmm-dtp-field">
            <span class="bmm-dtp-field-label">{{ t('home.calMinute') }}</span>
            <div class="bmm-dtp-dd" :class="{ open: openMenu === 'minute' }">
              <button
                type="button"
                class="bmm-dtp-dd-btn"
                :aria-expanded="openMenu === 'minute'"
                @click.stop="toggleMenu('minute')"
              >
                <span>{{ pad2(minute) }}</span>
                <ChevronDown :size="13" />
              </button>
              <div
                v-if="openMenu === 'minute'"
                ref="minuteMenu"
                class="bmm-dtp-dd-menu"
                role="listbox"
              >
                <button
                  v-for="m in minutes"
                  :key="m"
                  type="button"
                  class="bmm-dtp-dd-opt"
                  :class="{ selected: m === minute }"
                  role="option"
                  :aria-selected="m === minute"
                  @click="setMinute(m)"
                >
                  {{ pad2(m) }}
                </button>
              </div>
            </div>
          </div>

          <button type="button" class="bmm-btn bmm-dtp-today" @click="goToday">
            {{ t('home.ganttToday') }}
          </button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>
