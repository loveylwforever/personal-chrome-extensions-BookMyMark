export type PetMood = 'idle' | 'focus' | 'rest' | 'happy' | 'sleepy' | 'sleep';

export type PetEvent = 'tick' | 'click' | 'pointer' | 'pomo';

export type PetFsmState = {
  mood: PetMood;
  /** Epoch ms of last user interaction (click / pointer). */
  lastInteractAt: number;
  /** Epoch ms when sleepy/sleep entered. */
  moodSince: number;
  blink: boolean;
};

const IDLE_TO_SLEEPY_MS = 45_000;
const SLEEPY_TO_SLEEP_MS = 20_000;
const HAPPY_MS = 1600;
const BLINK_EVERY_MS = 4200;

export function createPetState(now = Date.now()): PetFsmState {
  return {
    mood: 'idle',
    lastInteractAt: now,
    moodSince: now,
    blink: false,
  };
}

export function reducePet(
  state: PetFsmState,
  event: PetEvent,
  opts: { now?: number; pomoMood?: PetMood | null },
): PetFsmState {
  const now = opts.now ?? Date.now();
  const pomoMood = opts.pomoMood ?? null;

  if (event === 'click') {
    return {
      ...state,
      mood: 'happy',
      lastInteractAt: now,
      moodSince: now,
      blink: false,
    };
  }

  if (event === 'pointer') {
    if (state.mood === 'sleep' || state.mood === 'sleepy') {
      return {
        ...state,
        mood: pomoMood === 'focus' || pomoMood === 'rest' ? pomoMood : 'idle',
        lastInteractAt: now,
        moodSince: now,
        blink: false,
      };
    }
    return { ...state, lastInteractAt: now };
  }

  if (event === 'pomo') {
    if (state.mood === 'happy') return state;
    if (state.mood === 'sleep' || state.mood === 'sleepy') return state;
    if (pomoMood === 'focus' || pomoMood === 'rest') {
      return { ...state, mood: pomoMood, moodSince: now, blink: false };
    }
    return {
      ...state,
      mood: 'idle',
      moodSince: now,
      blink: false,
    };
  }

  // tick
  if (state.mood === 'happy' && now - state.moodSince >= HAPPY_MS) {
    const next =
      pomoMood === 'focus' || pomoMood === 'rest' ? pomoMood : 'idle';
    return { ...state, mood: next, moodSince: now, blink: false };
  }

  const idleFor = now - state.lastInteractAt;
  if (
    state.mood !== 'happy' &&
    state.mood !== 'sleep' &&
    state.mood !== 'sleepy' &&
    idleFor >= IDLE_TO_SLEEPY_MS
  ) {
    return { ...state, mood: 'sleepy', moodSince: now, blink: false };
  }

  if (
    state.mood === 'sleepy' &&
    now - state.moodSince >= SLEEPY_TO_SLEEP_MS
  ) {
    return { ...state, mood: 'sleep', moodSince: now, blink: false };
  }

  const blink =
    state.mood !== 'sleep' &&
    state.mood !== 'sleepy' &&
    Math.floor(now / BLINK_EVERY_MS) % 7 === 0 &&
    Math.floor(now / 200) % 2 === 0;

  return { ...state, blink };
}

export function petMoodFromPomo(opts: {
  phase: 'focus' | 'shortBreak' | 'longBreak';
  running: boolean;
}): PetMood | null {
  if (!opts.running) return null;
  if (opts.phase === 'focus') return 'focus';
  return 'rest';
}
