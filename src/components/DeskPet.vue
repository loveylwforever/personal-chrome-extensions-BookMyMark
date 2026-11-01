<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '~/modules/i18n';
import {
  createPetState,
  petMoodFromPomo,
  reducePet,
  type PetFsmState,
  type PetMood,
} from '~/modules/home/pet-fsm';
import type { PomoPhase } from '~/modules/home/pomodoro';

const props = defineProps<{
  pomoPhase: PomoPhase;
  pomoRunning: boolean;
}>();

const state = ref<PetFsmState>(createPetState());
let tickTimer: ReturnType<typeof setInterval> | null = null;

const pomoMood = computed(() =>
  petMoodFromPomo({ phase: props.pomoPhase, running: props.pomoRunning }),
);

const mood = computed(() => state.value.mood);
const eyesClosed = computed(
  () =>
    state.value.blink ||
    state.value.mood === 'sleep' ||
    state.value.mood === 'sleepy',
);

const tip = computed(() => {
  switch (mood.value) {
    case 'focus':
      return t('home.petFocus');
    case 'rest':
      return t('home.petRest');
    case 'happy':
      return t('home.petHappy');
    case 'sleepy':
      return t('home.petSleepy');
    case 'sleep':
      return t('home.petSleep');
    default:
      return t('home.petIdle');
  }
});

function sync(event: 'tick' | 'click' | 'pointer' | 'pomo') {
  state.value = reducePet(state.value, event, {
    pomoMood: pomoMood.value,
  });
}

function onClick() {
  sync('click');
}

function onPointer() {
  sync('pointer');
}

watch(
  () => [props.pomoPhase, props.pomoRunning] as const,
  () => sync('pomo'),
);

onMounted(() => {
  sync('pomo');
  tickTimer = setInterval(() => sync('tick'), 200);
});

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
});

function moodClass(m: PetMood) {
  return `mood-${m}`;
}
</script>

<template>
  <button
    type="button"
    class="bmm-pet"
    :class="[moodClass(mood), { blink: state.blink }]"
    :title="tip"
    :aria-label="tip"
    @click="onClick"
    @pointermove="onPointer"
  >
    <span class="bmm-pet-shadow" aria-hidden="true" />
    <svg
      class="bmm-pet-svg"
      viewBox="0 0 120 110"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <!-- onigiri body + clear face (no big page overlay) -->
      <ellipse class="bmm-pet-glow" cx="60" cy="98" rx="32" ry="5.5" />
      <!-- soft animal ears (pivot at base, mood-driven) -->
      <g class="bmm-pet-ear-wrap bmm-pet-ear-l" aria-hidden="true">
        <path
          class="bmm-pet-ear"
          d="M37 44c-9-5-13-18-6-27 5-7 14-5 16 3 2 7-1 17-10 24z"
        />
        <path
          class="bmm-pet-ear-inner"
          d="M38.5 40c-5-3-7.5-11-3.5-16 3-4 8-2.5 9 2.5 1 4.5-1 10-5.5 13.5z"
        />
      </g>
      <g class="bmm-pet-ear-wrap bmm-pet-ear-r" aria-hidden="true">
        <path
          class="bmm-pet-ear"
          d="M83 44c9-5 13-18 6-27-5-7-14-5-16 3-2 7 1 17 10 24z"
        />
        <path
          class="bmm-pet-ear-inner"
          d="M81.5 40c5-3 7.5-11 3.5-16-3-4-8-2.5-9 2.5-1 4.5 1 10 5.5 13.5z"
        />
      </g>
      <!-- rice-ball / onigiri silhouette -->
      <path
        class="bmm-pet-body"
        d="M28 78c0-28 14-52 32-52s32 24 32 52c0 8-6 14-14 14H42c-8 0-14-6-14-14z"
      />
      <!-- cheeks -->
      <circle class="bmm-pet-cheek" cx="42" cy="64" r="4.8" />
      <circle class="bmm-pet-cheek" cx="78" cy="64" r="4.8" />
      <!-- eyes -->
      <g v-if="!eyesClosed" class="bmm-pet-eyes">
        <ellipse class="bmm-pet-eye" cx="48" cy="56" rx="4.2" ry="5" />
        <ellipse class="bmm-pet-eye" cx="72" cy="56" rx="4.2" ry="5" />
        <circle class="bmm-pet-shine" cx="49.5" cy="54.5" r="1.25" />
        <circle class="bmm-pet-shine" cx="73.5" cy="54.5" r="1.25" />
      </g>
      <g v-else class="bmm-pet-eyes closed">
        <path class="bmm-pet-lid" d="M43 56q5 4 10 0" />
        <path class="bmm-pet-lid" d="M67 56q5 4 10 0" />
      </g>
      <!-- mouth -->
      <path
        v-if="mood === 'happy' || mood === 'rest'"
        class="bmm-pet-mouth"
        d="M54 68q6 6 12 0"
      />
      <path
        v-else-if="mood === 'focus'"
        class="bmm-pet-mouth"
        d="M56 70h8"
      />
      <path
        v-else-if="mood === 'sleep' || mood === 'sleepy'"
        class="bmm-pet-mouth"
        d="M56 69q4 2 8 0"
      />
      <path
        v-else
        class="bmm-pet-mouth"
        d="M55 69q5 3 10 0"
      />
      <!-- tiny nori / bookmark tip at bottom -->
      <path class="bmm-pet-stripe" d="M55 84h10v11l-5-3.2L55 95z" />
      <g v-if="mood === 'sleep' || mood === 'sleepy'" class="bmm-pet-zzz">
        <text x="88" y="40" class="z1">z</text>
        <text x="96" y="30" class="z2">z</text>
      </g>
    </svg>
    <span class="bmm-pet-caption">{{ tip }}</span>
  </button>
</template>
