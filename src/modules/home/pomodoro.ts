/** Pomodoro durations (seconds). */
export const POMO_FOCUS_SEC = 25 * 60;
export const POMO_SHORT_BREAK_SEC = 5 * 60;
export const POMO_LONG_BREAK_SEC = 15 * 60;

export type PomoPhase = 'focus' | 'shortBreak' | 'longBreak';

export type PomoPersisted = {
  phase: PomoPhase;
  /** Remaining ms when last written (paused or running). */
  remainingMs: number;
  /** Epoch ms when the current run segment ends; null if paused. */
  endsAt: number | null;
  running: boolean;
  /** Completed focus rounds this session (increments when a focus timer finishes). */
  focusDone: number;
  sound: boolean;
  /** Custom focus length from a todo; null = default 25m. */
  focusOverrideMs: number | null;
  /** Todo currently driving the focus timer, if any. */
  linkedTodoId: string | null;
};

export const POMO_STORAGE_KEY = 'bmm.pomodoro.v1';

export const DEFAULT_POMO: PomoPersisted = {
  phase: 'focus',
  remainingMs: POMO_FOCUS_SEC * 1000,
  endsAt: null,
  running: false,
  focusDone: 0,
  sound: false,
  focusOverrideMs: null,
  linkedTodoId: null,
};

export function phaseDurationMs(
  phase: PomoPhase,
  state?: Pick<PomoPersisted, 'focusOverrideMs'>,
): number {
  switch (phase) {
    case 'focus':
      if (
        state?.focusOverrideMs != null &&
        state.focusOverrideMs > 0
      ) {
        return state.focusOverrideMs;
      }
      return POMO_FOCUS_SEC * 1000;
    case 'shortBreak':
      return POMO_SHORT_BREAK_SEC * 1000;
    case 'longBreak':
      return POMO_LONG_BREAK_SEC * 1000;
  }
}

export function formatPomoClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function liveRemainingMs(state: PomoPersisted, now = Date.now()): number {
  if (state.running && state.endsAt != null) {
    return Math.max(0, state.endsAt - now);
  }
  return Math.max(0, state.remainingMs);
}

export function normalizePomo(raw: unknown): PomoPersisted {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_POMO };
  const o = raw as Partial<PomoPersisted>;
  const phase: PomoPhase =
    o.phase === 'shortBreak' || o.phase === 'longBreak' || o.phase === 'focus'
      ? o.phase
      : 'focus';
  const focusOverrideMs =
    typeof o.focusOverrideMs === 'number' && o.focusOverrideMs > 0
      ? o.focusOverrideMs
      : null;
  const linkedTodoId =
    typeof o.linkedTodoId === 'string' && o.linkedTodoId
      ? o.linkedTodoId
      : null;
  return {
    phase,
    remainingMs:
      typeof o.remainingMs === 'number' && o.remainingMs >= 0
        ? o.remainingMs
        : phaseDurationMs(phase, { focusOverrideMs }),
    endsAt: typeof o.endsAt === 'number' ? o.endsAt : null,
    running: Boolean(o.running) && typeof o.endsAt === 'number',
    focusDone:
      typeof o.focusDone === 'number' && o.focusDone >= 0
        ? Math.min(99, Math.floor(o.focusDone))
        : 0,
    sound: Boolean(o.sound),
    focusOverrideMs,
    linkedTodoId,
  };
}

/** Manual skip order only — phases do not auto-chain on complete. */
export function cyclePhase(phase: PomoPhase): PomoPhase {
  switch (phase) {
    case 'focus':
      return 'shortBreak';
    case 'shortBreak':
      return 'longBreak';
    case 'longBreak':
      return 'focus';
  }
}

export async function loadPomoState(): Promise<PomoPersisted> {
  const raw = await browser.storage.local.get(POMO_STORAGE_KEY);
  return normalizePomo(raw[POMO_STORAGE_KEY]);
}

export async function savePomoState(state: PomoPersisted): Promise<void> {
  await browser.storage.local.set({
    [POMO_STORAGE_KEY]: { ...state },
  });
}

export function subscribePomo(
  onChange: (state: PomoPersisted) => void,
): () => void {
  const handler = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area !== 'local' || !(POMO_STORAGE_KEY in changes)) return;
    onChange(normalizePomo(changes[POMO_STORAGE_KEY]?.newValue));
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}

/** Soft chime via Web Audio (no asset file). Needs a prior user gesture to unlock. */
let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new Ctx();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/** Call from a click handler so Chrome allows audio later. */
export async function unlockPomoAudio(): Promise<void> {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

export async function playPomoChime(): Promise<void> {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;
    const notes = [660, 880];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = notes[i]!;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = now + i * 0.16;
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    }
  } catch {
    /* ignore */
  }
}
