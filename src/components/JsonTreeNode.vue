<script setup lang="ts">
import { computed } from 'vue';
import JsonTreeNode from './JsonTreeNode.vue';
import {
  formatJsonPrimitive,
  isExpandableJson,
  keyMatchesQuery,
} from '~/modules/tools/json-tree';

const props = withDefaults(
  defineProps<{
    path: string;
    nodeKey?: string;
    arrayIndex?: number;
    value: unknown;
    query: string;
    collapsed: ReadonlySet<string>;
    selectedPath: string | null;
    isLast?: boolean;
  }>(),
  { isLast: true },
);

const emit = defineEmits<{
  toggle: [path: string];
  select: [path: string];
}>();

const expandable = computed(() => isExpandableJson(props.value));
const folded = computed(() => props.collapsed.has(props.path));
const selected = computed(() => props.selectedPath === props.path);
const hit = computed(() => keyMatchesQuery(props.nodeKey, props.query));

const objectEntries = computed(() => {
  if (!props.value || typeof props.value !== 'object' || Array.isArray(props.value)) {
    return [];
  }
  return Object.entries(props.value as Record<string, unknown>);
});

const arrayItems = computed(() => {
  return Array.isArray(props.value) ? props.value : [];
});

const preview = computed(() => {
  if (Array.isArray(props.value)) {
    return props.value.length ? `[…] ${props.value.length}` : '[]';
  }
  if (props.value && typeof props.value === 'object') {
    const len = Object.keys(props.value as Record<string, unknown>).length;
    return len ? `{…} ${len}` : '{}';
  }
  return '';
});

const closeBracket = computed(() => (Array.isArray(props.value) ? ']' : '}'));
const openBracket = computed(() => (Array.isArray(props.value) ? '[' : '{'));
const indexLabel = computed(() =>
  props.arrayIndex === undefined ? '' : `[${props.arrayIndex}]`,
);

function onToggle(e: MouseEvent) {
  e.stopPropagation();
  emit('toggle', props.path);
}
</script>

<template>
  <div v-if="expandable" class="bmm-json-branch">
    <div
      class="bmm-json-row"
      :class="{ selected }"
      @click="emit('select', path)"
    >
      <span class="bmm-json-dot-slot">
        <button
          type="button"
          class="bmm-json-dot"
          :class="{ collapsed: folded }"
          :aria-expanded="!folded"
          :aria-label="indexLabel || nodeKey || path"
          @click="onToggle"
          @dblclick.prevent.stop
          @mousedown.prevent
        >{{ folded ? '+' : '−' }}</button>
      </span>
      <span class="bmm-json-gap-slot" aria-hidden="true" />
      <span class="bmm-json-body">
        <template v-if="nodeKey !== undefined">
          <span class="bmm-json-key" :class="{ hit }">"{{ nodeKey }}"</span>
          <span class="bmm-json-colon">:</span>
        </template>
        <span v-if="folded" class="bmm-json-preview">{{ preview }}</span>
        <span v-else class="bmm-json-bracket">{{ openBracket }}</span>
        <span v-if="folded && !isLast" class="bmm-json-comma">,</span>
      </span>
      <span v-if="indexLabel" class="bmm-json-meta">{{ indexLabel }}</span>
    </div>

    <div v-if="!folded" class="bmm-json-children">
      <template v-if="Array.isArray(value)">
        <JsonTreeNode
          v-for="(item, index) in arrayItems"
          :key="`${path}[${index}]`"
          :path="`${path}[${index}]`"
          :array-index="index"
          :value="item"
          :query="query"
          :collapsed="collapsed"
          :selected-path="selectedPath"
          :is-last="index === arrayItems.length - 1"
          @toggle="emit('toggle', $event)"
          @select="emit('select', $event)"
        />
      </template>
      <template v-else>
        <JsonTreeNode
          v-for="([childKey, childValue], index) in objectEntries"
          :key="`${path}.${childKey}`"
          :path="path ? `${path}.${childKey}` : childKey"
          :node-key="childKey"
          :value="childValue"
          :query="query"
          :collapsed="collapsed"
          :selected-path="selectedPath"
          :is-last="index === objectEntries.length - 1"
          @toggle="emit('toggle', $event)"
          @select="emit('select', $event)"
        />
      </template>
    </div>

    <div v-if="!folded" class="bmm-json-row bmm-json-close">
      <span class="bmm-json-dot-slot bmm-json-dot-slot-close">
        <span class="bmm-json-bracket">{{ closeBracket }}</span>
        <span v-if="!isLast" class="bmm-json-comma">,</span>
      </span>
      <span class="bmm-json-gap-slot" aria-hidden="true" />
    </div>
  </div>

  <div
    v-else
    class="bmm-json-row"
    :class="{ selected }"
    @click="emit('select', path)"
  >
    <span class="bmm-json-dot-slot" aria-hidden="true" />
    <span class="bmm-json-gap-slot" aria-hidden="true" />
    <span class="bmm-json-body">
      <template v-if="nodeKey !== undefined">
        <span class="bmm-json-key" :class="{ hit }">"{{ nodeKey }}"</span>
        <span class="bmm-json-colon">:</span>
      </template>
      <span
        class="bmm-json-value"
        :class="value === null ? 'kind-null' : `kind-${typeof value}`"
      >{{ formatJsonPrimitive(value) }}</span>
      <span v-if="!isLast" class="bmm-json-comma">,</span>
    </span>
    <span v-if="indexLabel" class="bmm-json-meta">{{ indexLabel }}</span>
  </div>
</template>
