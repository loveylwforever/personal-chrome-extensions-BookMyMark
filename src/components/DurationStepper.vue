<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown, Minus, Plus } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import {
  TODO_DURATION_MAX,
  TODO_DURATION_MIN,
  TODO_DURATION_STEP_MIN,
  clampDuration,
  formatDurationLabel,
} from '~/modules/home/todos';

const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [min: number];
}>();

const OPTIONS = Array.from(
  {
    length:
      (TODO_DURATION_MAX - TODO_DURATION_MIN) / TODO_DURATION_STEP_MIN + 1,
  },
  (_, i) => TODO_DURATION_MIN + i * TODO_DURATION_STEP_MIN,
);

const open = ref(false);
const placed = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const menuPos = ref({ top: '0px', left: '0px' });

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdSign = 0;
let holdTicks = 0;

function apply(next: number) {
  const clamped = clampDuration(next);
  if (clamped === props.modelValue) return false;
  emit('update:modelValue', clamped);
  return true;
}

function stepSize(ticks: number) {
  if (ticks < 8) return TODO_DURATION_STEP_MIN;
  if (ticks < 18) return TODO_DURATION_STEP_MIN * 2;
  return TODO_DURATION_STEP_MIN * 4;
}

function step(sign: number, ticks: number) {
  return apply(props.modelValue + sign * stepSize(ticks));
}

function stopHold() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
  holdSign = 0;
}

function startHold(sign: number, e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  open.value = false;
  placed.value = false;
  stopHold();
  holdSign = sign;
  holdTicks = 0;
  if (!step(sign, 0)) return;
  const arm = () => {
    if (!holdSign) return;
    holdTicks += 1;
    if (!step(holdSign, holdTicks)) return;
    holdTimer = setTimeout(arm, holdTicks < 8 ? 64 : 36);
  };
  holdTimer = setTimeout(arm, 260);
}

function placeMenu() {
  const btn = trigger.value;
  const el = menu.value;
  if (!btn || !el) return;
  const r = btn.getBoundingClientRect();
  const margin = 8;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = r.left + (r.width - w) / 2;
  left = Math.min(Math.max(margin, left), window.innerWidth - margin - w);
  const below = r.bottom + 4;
  const above = r.top - 4 - h;
  const top =
    below + h <= window.innerHeight - margin || above < margin ? below : above;
  menuPos.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` };
}

async function toggleMenu() {
  if (open.value) {
    open.value = false;
    placed.value = false;
    return;
  }
  open.value = true;
  placed.value = false;
  await nextTick();
  placeMenu();
  placed.value = true;
  menu.value?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}

function pick(min: number) {
  apply(min);
  open.value = false;
  placed.value = false;
}

function onDocPointer(e: PointerEvent) {
  if (!open.value) return;
  const target = e.target as Node;
  if (root.value?.contains(target) || menu.value?.contains(target)) return;
  open.value = false;
  placed.value = false;
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.value) return;
  open.value = false;
  placed.value = false;
}

function onReposition() {
  if (open.value) placeMenu();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onKey);
  document.addEventListener('scroll', onReposition, true);
  window.addEventListener('pointerup', stopHold);
  window.addEventListener('pointercancel', stopHold);
  window.addEventListener('resize', onReposition);
});

onBeforeUnmount(() => {
  stopHold();
  document.removeEventListener('pointerdown', onDocPointer, true);
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('scroll', onReposition, true);
  window.removeEventListener('pointerup', stopHold);
  window.removeEventListener('pointercancel', stopHold);
  window.removeEventListener('resize', onReposition);
});
</script>

<template>
  <div ref="root" class="bmm-todo-duration" :title="t('home.todoDuration')">
    <button
      type="button"
      class="bmm-todo-step"
      :aria-label="t('home.todoDurationLess')"
      @pointerdown="startHold(-1, $event)"
    >
      <Minus :size="12" />
    </button>

    <button
      ref="trigger"
      type="button"
      class="bmm-dur-btn"
      :class="{ open }"
      :aria-expanded="open"
      :aria-label="t('home.todoDuration')"
      @click="toggleMenu"
    >
      <span>{{ formatDurationLabel(modelValue) }}</span>
      <ChevronDown :size="12" />
    </button>

    <button
      type="button"
      class="bmm-todo-step"
      :aria-label="t('home.todoDurationMore')"
      @pointerdown="startHold(1, $event)"
    >
      <Plus :size="12" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menu"
        class="bmm-dur-menu"
        :class="{ placed }"
        :style="menuPos"
        role="listbox"
        :aria-label="t('home.todoDuration')"
      >
        <button
          v-for="min in OPTIONS"
          :key="min"
          type="button"
          class="bmm-dur-opt"
          :class="{ selected: min === modelValue }"
          role="option"
          :aria-selected="min === modelValue"
          @click="pick(min)"
        >
          {{ formatDurationLabel(min) }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
