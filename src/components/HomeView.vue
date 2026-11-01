<script setup lang="ts">
import { ref } from 'vue';
import type { PomoPhase } from '~/modules/home/pomodoro';
import type { TodoItem } from '~/modules/home/todos';
import PomodoroCard from './PomodoroCard.vue';
import DeskPet from './DeskPet.vue';
import TodoList from './TodoList.vue';
import ScheduleGantt from './ScheduleGantt.vue';

const pomoPhase = ref<PomoPhase>('focus');
const pomoRunning = ref(false);
const linkedTodoId = ref<string | null>(null);
const todos = ref<TodoItem[]>([]);
const pomoRef = ref<InstanceType<typeof PomodoroCard> | null>(null);

function onPomoChange(payload: {
  phase: PomoPhase;
  running: boolean;
  linkedTodoId: string | null;
}) {
  pomoPhase.value = payload.phase;
  pomoRunning.value = payload.running;
  linkedTodoId.value = payload.linkedTodoId;
}

function onTodosChange(items: TodoItem[]) {
  todos.value = items;
}

async function onStartPomo(todo: TodoItem) {
  await pomoRef.value?.startFocusForDuration(
    todo.durationMin * 60_000,
    todo.id,
  );
}
</script>

<template>
  <div class="bmm-home">
    <div class="bmm-home-stage">
      <div class="bmm-home-top">
        <TodoList
          class="bmm-home-todos"
          :linked-todo-id="linkedTodoId"
          :pomo-running="pomoRunning"
          @change="onTodosChange"
          @start-pomo="onStartPomo"
        />
        <aside class="bmm-home-side">
          <PomodoroCard
            ref="pomoRef"
            class="bmm-home-pomo"
            @change="onPomoChange"
          />
        </aside>
      </div>

      <div class="bmm-home-bottom">
        <ScheduleGantt class="bmm-home-gantt" :items="todos" />
        <DeskPet
          class="bmm-home-pet"
          :pomo-phase="pomoPhase"
          :pomo-running="pomoRunning"
        />
      </div>
    </div>
  </div>
</template>
