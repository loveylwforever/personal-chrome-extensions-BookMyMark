<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import {
  DEFAULT_POMO,
  cyclePhase,
  formatPomoClock,
  liveRemainingMs,
  loadPomoState,
  phaseDurationMs,
  playPomoChime,
  savePomoState,
  subscribePomo,
  unlockPomoAudio,
  type PomoPersisted,
  type PomoPhase,
} from '~/modules/home/pomodoro';

const emit = defineEmits<{
  change: [
    state: {
      phase: PomoPhase;
      running: boolean;
      linkedTodoId: string | null;
    },
  ];
}>();

const state = ref<PomoPersisted>({ ...DEFAULT_POMO });
const now = ref(Date.now());
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let unsubStorage: (() => void) | null = null;
let localRev = 0;
let acked = 0;
let epoch = 0;
let completing = false;

const remainingMs = computed(() => liveRemainingMs(state.value, now.value));
const totalMs = computed(() =>
  phaseDurationMs(state.value.phase, state.value),
);
const progress = computed(() => {
  const total = totalMs.value;
  if (total <= 0) return 0;
  return 1 - remainingMs.value / total;
});
const clock = computed(() => formatPomoClock(remainingMs.value));

const phaseLabel = computed(() => {
  switch (state.value.phase) {
    case 'focus':
      return t('home.pomoFocus');
    case 'shortBreak':
      return t('home.pomoShort');
    case 'longBreak':
      return t('home.pomoLong');
  }
});

const ringStyle = computed(() => {
  const pct = Math.round(progress.value * 1000) / 10;
  return {
    background: `conic-gradient(var(--primary) ${pct}%, color-mix(in oklab, var(--border) 70%, transparent) 0)`,
  };
});

function emitChange() {
  emit('change', {
    phase: state.value.phase,
    running: state.value.running,
    linkedTodoId: state.value.linkedTodoId,
  });
}

function pomoSame(a: PomoPersisted, b: PomoPersisted): boolean {
  return (
    a.phase === b.phase &&
    a.remainingMs === b.remainingMs &&
    a.endsAt === b.endsAt &&
    a.running === b.running &&
    a.focusDone === b.focusDone &&
    a.sound === b.sound &&
    a.focusOverrideMs === b.focusOverrideMs &&
    a.linkedTodoId === b.linkedTodoId
  );
}

function clearFocusLink() {
  return {
    focusOverrideMs: null as number | null,
    linkedTodoId: null as string | null,
  };
}

async function withLock(task: () => Promise<void>) {
  if (navigator.locks?.request) {
    await navigator.locks.request('bmm.pomodoro', task);
    return;
  }
  await task();
}

function adopt(next: PomoPersisted) {
  if (pomoSame(state.value, next)) return;
  state.value = next;
  now.value = Date.now();
  emitChange();
  armTick();
}

function applyRemote(next: PomoPersisted) {
  epoch += 1;
  if (localRev !== acked) return;
  adopt(next);
}

/** Writes under a lock so two tabs cannot both finish the same round. */
async function commit(
  mutate: (fresh: PomoPersisted, nowMs: number) => PomoPersisted,
) {
  localRev += 1;
  const rev = localRev;
  try {
    await withLock(async () => {
      const nowMs = Date.now();
      const next = mutate(await loadPomoState(), nowMs);
      await savePomoState(next);
      if (localRev !== rev) return;
      acked = rev;
      adopt(next);
    });
  } catch {
    if (localRev === rev) {
      acked = rev;
      void refreshFromStorage();
    }
  }
}

function completedFrom(fresh: PomoPersisted): PomoPersisted {
  const duration = phaseDurationMs(fresh.phase, { focusOverrideMs: null });
  return {
    ...fresh,
    ...clearFocusLink(),
    focusDone:
      fresh.phase === 'focus' ? fresh.focusDone + 1 : fresh.focusDone,
    remainingMs: duration,
    endsAt: null,
    running: false,
  };
}

async function completeIfDue() {
  if (completing || localRev !== acked) return;
  if (!state.value.running || state.value.endsAt == null) return;
  if (state.value.endsAt > Date.now()) return;
  completing = true;
  try {
    await withLock(async () => {
      const fresh = await loadPomoState();
      if (!fresh.running || fresh.endsAt == null || fresh.endsAt > Date.now()) {
        if (localRev === acked) adopt(fresh);
        return;
      }
      const next = completedFrom(fresh);
      await savePomoState(next);
      if (localRev === acked) adopt(next);
      if (fresh.sound) void playPomoChime();
    });
  } finally {
    completing = false;
  }
}

function nextPaintDelay(s: PomoPersisted): number {
  if (!s.running || s.endsAt == null) return 1000;
  const left = s.endsAt - Date.now();
  if (left <= 0) return 200;
  const rem = left % 1000;
  return rem < 40 ? 1000 : rem;
}

function onTick() {
  now.value = Date.now();
  if (state.value.running && liveRemainingMs(state.value, now.value) <= 0) {
    void completeIfDue();
  }
}

function stopTick() {
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = null;
}

function armTick() {
  stopTick();
  tickTimer = setTimeout(() => {
    tickTimer = null;
    onTick();
    armTick();
  }, nextPaintDelay(state.value));
}

async function toggleRun() {
  await unlockPomoAudio();
  await commit((fresh, nowMs) => {
    if (fresh.running && fresh.endsAt != null) {
      return {
        ...fresh,
        running: false,
        remainingMs: Math.max(0, fresh.endsAt - nowMs),
        endsAt: null,
      };
    }
    const total = phaseDurationMs(fresh.phase, fresh);
    const left = liveRemainingMs(fresh, nowMs) || total;
    return {
      ...fresh,
      running: true,
      remainingMs: left,
      endsAt: nowMs + left,
    };
  });
}

function resetPhase() {
  void commit((fresh) => ({
    ...fresh,
    running: false,
    remainingMs: phaseDurationMs(fresh.phase, fresh),
    endsAt: null,
  }));
}

/** Advance to the next phase tab and land paused (manual only). */
function skipPhase() {
  void commit((fresh) => {
    const phase = cyclePhase(fresh.phase);
    return {
      ...fresh,
      ...clearFocusLink(),
      phase,
      remainingMs: phaseDurationMs(phase, { focusOverrideMs: null }),
      endsAt: null,
      running: false,
    };
  });
}

/** Manual tab switch: stop the timer and load a fresh duration for that phase. */
function setPhase(phase: PomoPhase) {
  void commit((fresh) => ({
    ...fresh,
    ...clearFocusLink(),
    phase,
    remainingMs: phaseDurationMs(phase, { focusOverrideMs: null }),
    endsAt: null,
    running: false,
  }));
}

/**
 * Start (or pause if same linked todo already running) a focus timer
 * lasting `durationMs`, optionally linked to a todo id.
 */
async function startFocusForDuration(
  durationMs: number,
  todoId: string | null = null,
): Promise<void> {
  await unlockPomoAudio();
  const ms = Math.max(15_000, Math.round(durationMs));
  await commit((fresh, nowMs) => {
    if (
      todoId &&
      fresh.linkedTodoId === todoId &&
      fresh.phase === 'focus' &&
      fresh.running &&
      fresh.endsAt != null
    ) {
      return {
        ...fresh,
        running: false,
        remainingMs: Math.max(0, fresh.endsAt - nowMs),
        endsAt: null,
      };
    }
    return {
      ...fresh,
      phase: 'focus',
      focusOverrideMs: ms,
      linkedTodoId: todoId,
      remainingMs: ms,
      endsAt: nowMs + ms,
      running: true,
    };
  });
}

async function toggleSound() {
  await unlockPomoAudio();
  let turnedOn = false;
  await commit((fresh) => {
    turnedOn = !fresh.sound;
    return { ...fresh, sound: turnedOn };
  });
  if (turnedOn) void playPomoChime();
}

async function refreshFromStorage() {
  if (localRev !== acked) return;
  const fresh = await loadPomoState();
  if (localRev !== acked) return;
  now.value = Date.now();
  adopt(fresh);
  armTick();
  if (fresh.running && liveRemainingMs(fresh, now.value) <= 0) void completeIfDue();
}

function onVisible() {
  if (document.visibilityState !== 'visible') return;
  void refreshFromStorage();
}

defineExpose({
  startFocusForDuration,
});

onMounted(async () => {
  unsubStorage = subscribePomo(applyRemote);
  document.addEventListener('visibilitychange', onVisible);
  const seen = epoch;
  const remote = await loadPomoState();
  now.value = Date.now();
  if (localRev === acked && seen === epoch) {
    state.value = remote;
    emitChange();
    if (remote.running && liveRemainingMs(remote, now.value) <= 0) {
      void completeIfDue();
    }
  }
  armTick();
});

onBeforeUnmount(() => {
  stopTick();
  unsubStorage?.();
  document.removeEventListener('visibilitychange', onVisible);
});
</script>

<template>
  <section class="bmm-pomo" :data-phase="state.phase" :aria-label="t('home.pomoTitle')">
    <header class="bmm-pomo-head">
      <h2 class="bmm-pomo-title">{{ t('home.pomoTitle') }}</h2>
      <button
        type="button"
        class="bmm-pomo-sound"
        :class="{ on: state.sound }"
        :title="t('home.pomoSound')"
        :aria-pressed="state.sound"
        @click="toggleSound"
      >
        {{ state.sound ? t('home.pomoSoundOn') : t('home.pomoSoundOff') }}
      </button>
    </header>

    <div class="bmm-pomo-phases" role="tablist">
      <button
        type="button"
        class="bmm-pomo-phase"
        role="tab"
        :aria-selected="state.phase === 'focus'"
        :class="{ active: state.phase === 'focus' }"
        @click="setPhase('focus')"
      >
        {{ t('home.pomoFocus') }}
      </button>
      <button
        type="button"
        class="bmm-pomo-phase"
        role="tab"
        :aria-selected="state.phase === 'shortBreak'"
        :class="{ active: state.phase === 'shortBreak' }"
        @click="setPhase('shortBreak')"
      >
        {{ t('home.pomoShort') }}
      </button>
      <button
        type="button"
        class="bmm-pomo-phase"
        role="tab"
        :aria-selected="state.phase === 'longBreak'"
        :class="{ active: state.phase === 'longBreak' }"
        @click="setPhase('longBreak')"
      >
        {{ t('home.pomoLong') }}
      </button>
    </div>

    <div class="bmm-pomo-ring-wrap">
      <div class="bmm-pomo-ring" :style="ringStyle">
        <div class="bmm-pomo-ring-inner">
          <span class="bmm-pomo-phase-label">{{ phaseLabel }}</span>
          <span class="bmm-pomo-clock" aria-live="polite">{{ clock }}</span>
          <span class="bmm-pomo-meta">
            {{ t('home.pomoRounds', { count: state.focusDone }) }}
          </span>
        </div>
      </div>
    </div>

    <div class="bmm-pomo-actions">
      <button
        type="button"
        class="bmm-btn bmm-btn-primary bmm-pomo-primary"
        @click="toggleRun"
      >
        <Pause v-if="state.running" :size="16" />
        <Play v-else :size="16" />
        {{ state.running ? t('home.pomoPause') : t('home.pomoStart') }}
      </button>
      <button type="button" class="bmm-btn" :title="t('home.pomoSkip')" @click="skipPhase">
        <SkipForward :size="15" />
      </button>
      <button type="button" class="bmm-btn" :title="t('home.pomoReset')" @click="resetPhase">
        <RotateCcw :size="15" />
      </button>
    </div>
  </section>
</template>
