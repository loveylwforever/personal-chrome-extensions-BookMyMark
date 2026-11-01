<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import JsonTreeNode from './JsonTreeNode.vue';
import {
  ancestorJsonPaths,
  collectExpandablePaths,
  descendantExpandablePaths,
  jsonPathDepth,
  searchJsonFieldPathsFromValue,
} from '~/modules/tools/json-tree';

const props = defineProps<{
  value: unknown;
  query: string;
}>();

const emit = defineEmits<{
  select: [path: string | null];
}>();

const collapsed = ref(new Set<string>());
const selectedPath = ref<string | null>(null);

const isRootArray = computed(() => Array.isArray(props.value));
const isRootObject = computed(
  () => props.value !== null && typeof props.value === 'object' && !Array.isArray(props.value),
);
const rootSelected = computed(() => selectedPath.value === '');
const rootOpen = computed(() => (isRootArray.value ? '[' : '{'));
const rootClose = computed(() => (isRootArray.value ? ']' : '}'));

const rootNodes = computed(() => {
  if (isRootArray.value) {
    return (props.value as unknown[]).map((item, index) => ({
      key: index,
      path: `[${index}]`,
      arrayIndex: index as number | undefined,
      nodeKey: undefined as string | undefined,
      value: item,
    }));
  }
  if (isRootObject.value) {
    return Object.entries(props.value as Record<string, unknown>).map(([key, child]) => ({
      key,
      path: key,
      arrayIndex: undefined as number | undefined,
      nodeKey: key as string | undefined,
      value: child,
    }));
  }
  return [];
});

function toggle(path: string) {
  const next = new Set(collapsed.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  collapsed.value = next;
}

function select(path: string) {
  selectedPath.value = path;
  emit('select', path);
}

function expandAll() {
  collapsed.value = new Set();
}

function collapseAll() {
  collapsed.value = new Set(
    collectExpandablePaths(props.value).filter((p) => p !== ''),
  );
}

/** Expand or collapse one depth layer under the selection. */
function stepLayer(expand: boolean) {
  if (selectedPath.value == null) return;
  const base = selectedPath.value;
  const next = new Set(collapsed.value);

  if (expand && base && next.has(base)) {
    next.delete(base);
    collapsed.value = next;
    return;
  }

  const descendants = descendantExpandablePaths(props.value, base);
  const targets = expand
    ? descendants.filter((p) => next.has(p))
    : descendants.filter((p) => !next.has(p));

  if (!targets.length) {
    if (!expand && base && !next.has(base)) {
      next.add(base);
      collapsed.value = next;
    }
    return;
  }

  const baseDepth = jsonPathDepth(base);
  const edge = expand
    ? Math.min(...targets.map((p) => jsonPathDepth(p) - baseDepth))
    : Math.max(...targets.map((p) => jsonPathDepth(p) - baseDepth));

  for (const p of targets) {
    if (jsonPathDepth(p) - baseDepth !== edge) continue;
    if (expand) next.delete(p);
    else next.add(p);
  }
  collapsed.value = next;
}

function stepExpand() {
  stepLayer(true);
}

function stepCollapse() {
  stepLayer(false);
}

watch(
  () => props.value,
  () => {
    selectedPath.value = null;
    emit('select', null);
  },
);

watch(
  () => props.query,
  (query) => {
    const q = query.trim();
    if (!q) return;
    const hits = searchJsonFieldPathsFromValue(props.value, q);
    const next = new Set(collapsed.value);
    for (const hit of hits) {
      next.delete(hit);
      for (const path of ancestorJsonPaths(hit)) next.delete(path);
    }
    collapsed.value = next;
  },
);

defineExpose({
  expandAll,
  collapseAll,
  stepExpand,
  stepCollapse,
});
</script>

<template>
  <div class="bmm-json-tree-root">
    <div
      v-if="isRootObject || isRootArray"
      class="bmm-json-branch bmm-json-root-branch"
    >
      <div
        class="bmm-json-row"
        :class="{ selected: rootSelected }"
        @click="select('')"
      >
        <span class="bmm-json-dot-slot">
          <span class="bmm-json-bracket">{{ rootOpen }}</span>
        </span>
        <span class="bmm-json-gap-slot" aria-hidden="true" />
      </div>
      <div v-if="rootNodes.length" class="bmm-json-children">
        <JsonTreeNode
          v-for="(node, index) in rootNodes"
          :key="node.key"
          :path="node.path"
          :node-key="node.nodeKey"
          :array-index="node.arrayIndex"
          :value="node.value"
          :query="query"
          :collapsed="collapsed"
          :selected-path="selectedPath"
          :is-last="index === rootNodes.length - 1"
          @toggle="toggle"
          @select="select"
        />
      </div>
      <div class="bmm-json-row bmm-json-close">
        <span class="bmm-json-dot-slot">
          <span class="bmm-json-bracket">{{ rootClose }}</span>
        </span>
        <span class="bmm-json-gap-slot" aria-hidden="true" />
      </div>
    </div>

    <div v-else class="bmm-json-row">
      <span class="bmm-json-dot-slot" aria-hidden="true" />
      <span class="bmm-json-gap-slot" aria-hidden="true" />
      <span class="bmm-json-body">
        <span
          class="bmm-json-value"
          :class="value === null ? 'kind-null' : `kind-${typeof value}`"
        >
          {{ value === null ? 'null' : String(value) }}
        </span>
      </span>
    </div>
  </div>
</template>
