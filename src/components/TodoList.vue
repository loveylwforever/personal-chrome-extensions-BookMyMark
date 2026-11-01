<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  Check,
  ChevronDown,
  Plus,
  Timer,
  Trash2,
} from 'lucide-vue-next';
import { t } from '~/modules/i18n';
import {
  TODO_COLOR_PRESETS,
  createTodo,
  formatDurationLabel,
  loadTodos,
  mergeTodos,
  saveTodos,
  sortTodosForList,
  subscribeTodos,
  todoStatus,
  type TodoItem,
  type TodosPersisted,
} from '~/modules/home/todos';
import DatetimePicker from './DatetimePicker.vue';
import DurationStepper from './DurationStepper.vue';

const props = withDefaults(
  defineProps<{
    linkedTodoId?: string | null;
    pomoRunning?: boolean;
  }>(),
  {
    linkedTodoId: null,
    pomoRunning: false,
  },
);

const emit = defineEmits<{
  change: [items: TodoItem[]];
  startPomo: [todo: TodoItem];
}>();

const store = ref<TodosPersisted>({ version: 1, items: [] });
const showDone = ref(false);
const now = ref(Date.now());
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let unsubStorage: (() => void) | null = null;
let rev = 0;
let acked = 0;
let epoch = 0;
let writing = false;
let writeAgain = false;

const sorted = computed(() => sortTodosForList(store.value.items));
const openItems = computed(() => sorted.value.open);
const doneItems = computed(() => sorted.value.done);

function flushChange() {
  changeTimer = null;
  emit('change', store.value.items);
}

function snapshot(): TodosPersisted {
  return {
    version: 1,
    items: store.value.items.map((it) => ({ ...it })),
  };
}

function applyRemote(next: TodosPersisted) {
  epoch += 1;
  if (rev !== acked) return;
  if (todosEqual(store.value.items, next.items)) return;
  store.value = next;
  emit('change', store.value.items);
}

async function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (writing) {
    writeAgain = true;
    return;
  }
  if (rev === acked) return;
  writing = true;
  const r = rev;
  const data = snapshot();
  try {
    await saveTodos(data);
    if (rev === r) acked = r;
  } finally {
    writing = false;
    if (writeAgain || rev !== acked) {
      writeAgain = false;
      void flushPersist();
    }
  }
}

function schedulePersist(immediate = false) {
  rev += 1;
  if (changeTimer) clearTimeout(changeTimer);
  if (immediate) {
    changeTimer = null;
    emit('change', store.value.items);
  } else {
    changeTimer = setTimeout(flushChange, 80);
  }
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  if (immediate) {
    void flushPersist();
    return;
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushPersist();
  }, 160);
}

function onPageHide() {
  void flushPersist();
}

function onHidden() {
  if (document.visibilityState === 'hidden') void flushPersist();
}

function patch(id: string, next: Partial<TodoItem>, immediate = true) {
  store.value = {
    ...store.value,
    items: store.value.items.map((it) =>
      it.id === id ? { ...it, ...next } : it,
    ),
  };
  schedulePersist(immediate);
}

function addTodo() {
  const order =
    store.value.items.reduce((m, it) => Math.max(m, it.order), -1) + 1;
  const item = createTodo({ order, title: '' });
  store.value = {
    ...store.value,
    items: [...store.value.items, item],
  };
  schedulePersist(true);
}

function removeTodo(id: string) {
  store.value = {
    ...store.value,
    items: store.value.items.filter((it) => it.id !== id),
  };
  schedulePersist(true);
}

function onDuration(id: string, durationMin: number) {
  patch(id, { durationMin });
}

function onStart(id: string, ms: number) {
  patch(id, { startAt: ms });
}

function onTitle(id: string, e: Event) {
  const v = (e.target as HTMLInputElement).value;
  patch(id, { title: v }, false);
}

function cycleColor(id: string) {
  const it = store.value.items.find((x) => x.id === id);
  if (!it) return;
  const idx = TODO_COLOR_PRESETS.findIndex((c) => c === it.color);
  const next =
    TODO_COLOR_PRESETS[((idx < 0 ? 0 : idx) + 1) % TODO_COLOR_PRESETS.length]!;
  patch(id, { color: next });
}

function toggleDone(id: string) {
  const it = store.value.items.find((x) => x.id === id);
  if (!it) return;
  patch(id, { done: !it.done });
}

function onStartPomo(todo: TodoItem) {
  emit('startPomo', todo);
}

function statusLabel(todo: TodoItem) {
  switch (todoStatus(todo, now.value)) {
    case 'active':
      return t('home.todoActive');
    case 'overdue':
      return t('home.todoOverdue');
    case 'done':
      return t('home.todoDone');
    default:
      return '';
  }
}

function todosEqual(a: TodoItem[], b: TodoItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.title !== y.title ||
      x.durationMin !== y.durationMin ||
      x.startAt !== y.startAt ||
      x.color !== y.color ||
      x.done !== y.done ||
      x.order !== y.order
    ) {
      return false;
    }
  }
  return true;
}

onMounted(async () => {
  unsubStorage = subscribeTodos(applyRemote);
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onHidden);
  const seen = epoch;
  const remote = await loadTodos();
  if (rev !== acked) {
    store.value = mergeTodos(remote, store.value);
    emit('change', store.value.items);
    void flushPersist();
  } else if (seen === epoch) {
    store.value = remote;
    emit('change', store.value.items);
  }
  tickTimer = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (persistTimer) clearTimeout(persistTimer);
  if (changeTimer) clearTimeout(changeTimer);
  if (tickTimer) clearInterval(tickTimer);
  unsubStorage?.();
  window.removeEventListener('pagehide', onPageHide);
  document.removeEventListener('visibilitychange', onHidden);
  emit('change', store.value.items);
  void flushPersist();
});
</script>

<template>
  <section class="bmm-todos" :aria-label="t('home.todoTitle')">
    <header class="bmm-todos-head">
      <h2 class="bmm-todos-title">{{ t('home.todoTitle') }}</h2>
      <button type="button" class="bmm-btn bmm-btn-primary bmm-todos-add" @click="addTodo">
        <Plus :size="14" />
        {{ t('home.todoAdd') }}
      </button>
    </header>

    <ul v-if="openItems.length" class="bmm-todos-list">
      <li
        v-for="todo in openItems"
        :key="todo.id"
        class="bmm-todo-row"
        :class="{
          linked: props.linkedTodoId === todo.id,
          running: props.linkedTodoId === todo.id && props.pomoRunning,
          [`st-${todoStatus(todo, now)}`]: true,
        }"
      >
        <button
          type="button"
          class="bmm-todo-check"
          :title="t('home.todoMarkDone')"
          :aria-label="t('home.todoMarkDone')"
          @click="toggleDone(todo.id)"
        >
          <span class="bmm-todo-check-box" />
        </button>

        <button
          type="button"
          class="bmm-todo-swatch"
          :style="{ background: todo.color }"
          :title="t('home.todoColor')"
          :aria-label="t('home.todoColor')"
          @click="cycleColor(todo.id)"
        />

        <input
          class="bmm-todo-title"
          type="text"
          :value="todo.title"
          :placeholder="t('home.todoTitlePh')"
          @input="onTitle(todo.id, $event)"
        />

        <DurationStepper
          :model-value="todo.durationMin"
          @update:model-value="onDuration(todo.id, $event)"
        />

        <DatetimePicker
          :model-value="todo.startAt"
          @update:model-value="onStart(todo.id, $event)"
        />

        <span
          v-if="statusLabel(todo)"
          class="bmm-todo-badge"
          :data-st="todoStatus(todo, now)"
        >
          {{ statusLabel(todo) }}
        </span>

        <button
          type="button"
          class="bmm-btn bmm-todo-pomo"
          :class="{ on: props.linkedTodoId === todo.id && props.pomoRunning }"
          :title="t('home.todoStartPomo')"
          :aria-label="t('home.todoStartPomo')"
          @click="onStartPomo(todo)"
        >
          <Timer :size="14" />
        </button>

        <button
          type="button"
          class="bmm-icon-btn bmm-todo-del"
          :title="t('home.todoDelete')"
          :aria-label="t('home.todoDelete')"
          @click="removeTodo(todo.id)"
        >
          <Trash2 :size="14" />
        </button>
      </li>
    </ul>

    <p v-else class="bmm-todos-empty">{{ t('home.todoEmpty') }}</p>

    <div v-if="doneItems.length" class="bmm-todos-done">
      <button
        type="button"
        class="bmm-todos-done-toggle"
        :aria-expanded="showDone"
        @click="showDone = !showDone"
      >
        <ChevronDown :size="14" :class="{ open: showDone }" />
        {{ t('home.todoDoneCount', { count: doneItems.length }) }}
      </button>
      <ul v-if="showDone" class="bmm-todos-list done">
        <li v-for="todo in doneItems" :key="todo.id" class="bmm-todo-row done">
          <button
            type="button"
            class="bmm-todo-check checked"
            :title="t('home.todoMarkOpen')"
            @click="toggleDone(todo.id)"
          >
            <Check :size="12" stroke-width="2.6" />
          </button>
          <span class="bmm-todo-swatch static" :style="{ background: todo.color }" />
          <span class="bmm-todo-title muted">{{ todo.title || t('home.todoTitlePh') }}</span>
          <span class="bmm-todo-duration-val muted">{{ formatDurationLabel(todo.durationMin) }}</span>
          <button
            type="button"
            class="bmm-icon-btn bmm-todo-del"
            :title="t('home.todoDelete')"
            @click="removeTodo(todo.id)"
          >
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
