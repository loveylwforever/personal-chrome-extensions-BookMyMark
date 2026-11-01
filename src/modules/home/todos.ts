/** Home todos + schedule geometry (15-minute steps, wall-clock). */

export const TODO_STORAGE_KEY = 'bmm.todos.v1';
export const TODO_DURATION_STEP_MIN = 15;
export const TODO_DURATION_MIN = 15;
export const TODO_DURATION_MAX = 8 * 60; // 8h cap per item
export const TODO_DEFAULT_DURATION_MIN = 60;

/** Warm, restrained presets (avoid purple-on-white bias). */
export const TODO_COLOR_PRESETS = [
  '#C45C3A',
  '#C47A3A',
  '#B89B5E',
  '#5B8C5A',
  '#3D7EA6',
  '#5A7A8B',
  '#8B6B5A',
  '#6B5B4A',
] as const;

export type TodoItem = {
  id: string;
  title: string;
  /** minutes, multiple of 15, min 15 */
  durationMin: number;
  /** epoch ms; Gantt placement */
  startAt: number;
  color: string;
  done: boolean;
  order: number;
  createdAt: number;
};

export type TodosPersisted = {
  version: 1;
  items: TodoItem[];
  /** Oldest items were dropped to stay within the storage cap. */
  rolled?: boolean;
};

export type DayColumn = {
  key: string;
  date: Date;
  year: number;
  month: number;
  day: number;
  isToday: boolean;
  isMonthStart: boolean;
};

export type HourBar = {
  todoId: string;
  title: string;
  color: string;
  startAt: number;
  endAt: number;
  progress: number;
  done: boolean;
  /** Hour-mode: fractional hour offsets within the expanded day (0–24) */
  hourLeft: number;
  hourWidth: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function todoEndAt(todo: Pick<TodoItem, 'startAt' | 'durationMin'>): number {
  return todo.startAt + todo.durationMin * 60_000;
}

export function snapToQuarterHour(ms: number, mode: 'ceil' | 'floor' = 'ceil'): number {
  const step = TODO_DURATION_STEP_MIN * 60_000;
  if (mode === 'floor') return Math.floor(ms / step) * step;
  return Math.ceil(ms / step) * step;
}

export function clampDuration(min: number): number {
  const stepped =
    Math.round(min / TODO_DURATION_STEP_MIN) * TODO_DURATION_STEP_MIN;
  return Math.min(
    TODO_DURATION_MAX,
    Math.max(TODO_DURATION_MIN, stepped || TODO_DURATION_MIN),
  );
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive day range: first day of (nowMonth - 6) … last day of (nowMonth + 6). */
export function scheduleRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 7, 0); // last day of +6 months
  return { start: startOfLocalDay(start), end: startOfLocalDay(end) };
}

export function buildDayColumns(now = new Date()): DayColumn[] {
  const { start, end } = scheduleRange(now);
  const today = startOfLocalDay(now);
  const cols: DayColumn[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    cols.push({
      key: dayKey(d),
      date: new Date(d),
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      isToday: d.getTime() === today.getTime(),
      isMonthStart: d.getDate() === 1,
    });
  }
  return cols;
}

export function todoProgress(
  todo: Pick<TodoItem, 'startAt' | 'durationMin' | 'done'>,
  now = Date.now(),
): number {
  if (todo.done) return 1;
  const end = todoEndAt(todo);
  if (now <= todo.startAt) return 0;
  if (now >= end) return 1;
  return (now - todo.startAt) / (end - todo.startAt);
}

export type TodoStatus = 'upcoming' | 'active' | 'overdue' | 'done';

export function todoStatus(
  todo: TodoItem,
  now = Date.now(),
): TodoStatus {
  if (todo.done) return 'done';
  const end = todoEndAt(todo);
  if (now < todo.startAt) return 'upcoming';
  if (now < end) return 'active';
  return 'overdue';
}

/** Hour bars for one local calendar day (0–24). */
export function layoutHourBars(
  items: TodoItem[],
  day: Date,
  now = Date.now(),
): HourBar[] {
  const dayStart = startOfLocalDay(day).getTime();
  const dayEnd = dayStart + DAY_MS;
  return items
    .map((t) => {
      const end = todoEndAt(t);
      const clipStart = Math.max(t.startAt, dayStart);
      const clipEnd = Math.min(end, dayEnd);
      if (clipEnd <= clipStart) return null;
      return {
        todoId: t.id,
        title: t.title,
        color: t.color,
        startAt: t.startAt,
        endAt: end,
        progress: todoProgress(t, now),
        done: t.done,
        hourLeft: (clipStart - dayStart) / 3_600_000,
        hourWidth: Math.max(0.25, (clipEnd - clipStart) / 3_600_000),
      } satisfies HourBar;
    })
    .filter((b): b is HourBar => b != null);
}

function newId(): string {
  return `todo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createTodo(
  partial: Partial<Pick<TodoItem, 'title' | 'durationMin' | 'startAt' | 'color'>> & {
    order: number;
  },
  now = Date.now(),
): TodoItem {
  const colorIndex = partial.order % TODO_COLOR_PRESETS.length;
  return {
    id: newId(),
    title: partial.title?.trim() ?? '',
    durationMin: clampDuration(partial.durationMin ?? TODO_DEFAULT_DURATION_MIN),
    startAt: partial.startAt ?? snapToQuarterHour(now, 'ceil'),
    color: partial.color ?? TODO_COLOR_PRESETS[colorIndex]!,
    done: false,
    order: partial.order,
    createdAt: now,
  };
}

export function normalizeTodo(raw: unknown, fallbackOrder = 0): TodoItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<TodoItem>;
  if (typeof o.id !== 'string' || !o.id) return null;
  const color =
    typeof o.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(o.color)
      ? o.color
      : TODO_COLOR_PRESETS[fallbackOrder % TODO_COLOR_PRESETS.length]!;
  return {
    id: o.id,
    title: typeof o.title === 'string' ? o.title : '',
    durationMin: clampDuration(
      typeof o.durationMin === 'number' ? o.durationMin : TODO_DEFAULT_DURATION_MIN,
    ),
    startAt:
      typeof o.startAt === 'number' && Number.isFinite(o.startAt)
        ? o.startAt
        : snapToQuarterHour(Date.now(), 'ceil'),
    color,
    done: Boolean(o.done),
    order: typeof o.order === 'number' ? o.order : fallbackOrder,
    createdAt:
      typeof o.createdAt === 'number' && Number.isFinite(o.createdAt)
        ? o.createdAt
        : Date.now(),
  };
}

export function normalizeTodos(raw: unknown): TodosPersisted {
  if (!raw || typeof raw !== 'object') return { version: 1, items: [] };
  const o = raw as Partial<TodosPersisted>;
  const list = Array.isArray(o.items) ? o.items : [];
  const items: TodoItem[] = [];
  for (let i = 0; i < list.length; i++) {
    const t = normalizeTodo(list[i], i);
    if (t) items.push(t);
  }
  items.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  return { version: 1, items, rolled: Boolean(o.rolled) };
}

/** Local edits win on the same id; remote-only rows are kept. */
export function mergeTodos(
  remote: TodosPersisted,
  local: TodosPersisted,
): TodosPersisted {
  const map = new Map(remote.items.map((it) => [it.id, it]));
  for (const it of local.items) map.set(it.id, it);
  return {
    ...normalizeTodos({ version: 1, items: [...map.values()] }),
    rolled: Boolean(remote.rolled || local.rolled),
  };
}

export const TODO_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const TODO_STORAGE_WARN_RATIO = 0.9;

export type TodoStorageStatus = {
  bytes: number;
  limit: number;
  trimmed: number;
  warn: boolean;
};

let storageStatus: TodoStorageStatus = {
  bytes: 0,
  limit: TODO_STORAGE_LIMIT_BYTES,
  trimmed: 0,
  warn: false,
};
const storageListeners = new Set<(status: TodoStorageStatus) => void>();

function publishStorage(next: TodoStorageStatus) {
  storageStatus = next;
  for (const listener of storageListeners) listener(next);
}

export function subscribeTodoStorage(
  onChange: (status: TodoStorageStatus) => void,
): () => void {
  onChange(storageStatus);
  storageListeners.add(onChange);
  return () => storageListeners.delete(onChange);
}

function estimateTodosBytes(state: TodosPersisted): number {
  const json = JSON.stringify({
    version: 1,
    items: state.items,
    rolled: Boolean(state.rolled),
  });
  return new TextEncoder().encode(json).length + TODO_STORAGE_KEY.length;
}

function fitTodos(state: TodosPersisted): { state: TodosPersisted; trimmed: number } {
  const newestFirst = [...state.items].sort(
    (a, b) => b.createdAt - a.createdAt || b.startAt - a.startAt,
  );
  let lo = 0;
  let hi = newestFirst.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = { version: 1 as const, items: newestFirst.slice(0, mid) };
    if (estimateTodosBytes(candidate) <= TODO_STORAGE_LIMIT_BYTES) lo = mid;
    else hi = mid - 1;
  }
  let keep = lo;
  if (keep === 0 && newestFirst.length > 0) keep = 1;
  return {
    state: {
      version: 1,
      items: newestFirst.slice(0, keep),
      rolled: state.rolled,
    },
    trimmed: newestFirst.length - keep,
  };
}

async function measureTodoBytes(fallback: TodosPersisted): Promise<number> {
  try {
    return await browser.storage.local.getBytesInUse(TODO_STORAGE_KEY);
  } catch {
    return estimateTodosBytes(fallback);
  }
}

function statusFor(
  state: TodosPersisted,
  bytes: number,
  trimmed: number,
): TodoStorageStatus {
  return {
    bytes,
    limit: TODO_STORAGE_LIMIT_BYTES,
    trimmed,
    warn:
      trimmed > 0 ||
      Boolean(state.rolled) ||
      bytes >= TODO_STORAGE_LIMIT_BYTES * TODO_STORAGE_WARN_RATIO,
  };
}

export async function loadTodos(): Promise<TodosPersisted> {
  const raw = await browser.storage.local.get(TODO_STORAGE_KEY);
  return normalizeTodos(raw[TODO_STORAGE_KEY]);
}

async function peekRolled(): Promise<boolean> {
  const raw = await browser.storage.local.get(TODO_STORAGE_KEY);
  const value = raw[TODO_STORAGE_KEY] as { rolled?: boolean } | undefined;
  return Boolean(value?.rolled);
}

export async function saveTodos(state: TodosPersisted): Promise<void> {
  const fitted = fitTodos(state);
  const rolled =
    fitted.trimmed > 0 ||
    (state.rolled === false ? false : await peekRolled());
  const payload: TodosPersisted = {
    version: 1,
    items: fitted.state.items.map((it) => ({ ...it })),
    rolled,
  };
  await browser.storage.local.set({ [TODO_STORAGE_KEY]: payload });
  const bytes = await measureTodoBytes(payload);
  publishStorage(statusFor(payload, bytes, fitted.trimmed));
}

export async function readTodoStorageStatus(): Promise<TodoStorageStatus> {
  const stored = await loadTodos();
  const bytes = await measureTodoBytes(stored);
  const next = statusFor(stored, bytes, 0);
  publishStorage(next);
  return next;
}

export async function clearTodoRollover(): Promise<void> {
  const stored = await loadTodos();
  if (!stored.rolled) return;
  await saveTodos({ ...stored, rolled: false });
}

export function subscribeTodos(
  onChange: (state: TodosPersisted) => void,
): () => void {
  const handler = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area !== 'local' || !(TODO_STORAGE_KEY in changes)) return;
    onChange(normalizeTodos(changes[TODO_STORAGE_KEY]?.newValue));
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}

export function formatDurationLabel(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function sortTodosForList(items: TodoItem[]): {
  open: TodoItem[];
  done: TodoItem[];
} {
  const open = items
    .filter((t) => !t.done)
    .sort((a, b) => a.startAt - b.startAt || a.order - b.order);
  const done = items
    .filter((t) => t.done)
    .sort((a, b) => b.startAt - a.startAt || b.order - a.order);
  return { open, done };
}
