<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  ArrowLeftRight,
  Braces,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Copy,
  Dices,
  Download,
  Eraser,
  FoldVertical,
  History,
  Link2,
  Minimize2,
  Minus,
  Plus,
  Quote,
  Search,
  Sparkles,
  TextQuote,
  Trash2,
  UnfoldVertical,
  X,
} from 'lucide-vue-next';
import { t, type MessageKey } from '~/modules/i18n';
import I18nText from './I18nText.vue';
import JsonTreeView from './JsonTreeView.vue';
import { downloadTextFile } from '~/modules/bookmarks/netscape';
import {
  compressJson,
  escapeJson,
  buildToolsCache,
  clampJsonHistoryLimit,
  formatByteSize,
  historyPreview,
  isSameJsonContent,
  jsonHistoryByteSize,
  loadToolsCache,
  MAX_JSON_HISTORY_LIMIT,
  MIN_JSON_HISTORY_LIMIT,
  parseJson,
  saveToolsCache,
  searchJsonFieldPaths,
  textByteSize,
  trimJsonHistory,
  unescapeJson,
  clearJsonHistoryCache,
  type ToolTab,
} from '~/modules/tools/cache';
import {
  diagnoseJson,
  type JsonDiag,
} from '~/modules/tools/json-diag';
import { applyJsonEditorKeydown } from '~/modules/tools/json-editor';
import {
  DEFAULT_JSON_GEN,
  generateRandomJson,
  type JsonGenCoverage,
  type JsonGenOptions,
  type JsonGenSize,
} from '~/modules/tools/json-random';

const TIP_MSG: Record<Exclude<JsonDiag['tipKey'], ''>, MessageKey> = {
  end: 'tools.jsonTip.end',
  trailingComma: 'tools.jsonTip.trailingComma',
  singleQuote: 'tools.jsonTip.singleQuote',
  propertyName: 'tools.jsonTip.propertyName',
  after: 'tools.jsonTip.after',
  token: 'tools.jsonTip.token',
};

const props = defineProps<{ open: boolean; tab: ToolTab }>();
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const jsonLeft = ref('');
const jsonRight = ref('');
const jsonHistory = ref<string[]>([]);
const jsonHistoryLimit = ref(10);
const jsonDiag = ref<JsonDiag | null>(null);
const jsonSearch = ref('');
const jsonTa = ref<HTMLTextAreaElement | null>(null);
const jsonGutter = ref<HTMLElement | null>(null);
const randomOpen = ref(false);
const randomRoot = ref<HTMLElement | null>(null);
const historyOpen = ref(false);
const historyRoot = ref<HTMLElement | null>(null);
const historyHelpOpen = ref(false);
const historyHelpShownOnce = ref(false);
let historyHelpTimer: ReturnType<typeof setTimeout> | null = null;
const jsonTreeRef = ref<{
  expandAll: () => void;
  collapseAll: () => void;
  stepExpand: () => void;
  stepCollapse: () => void;
} | null>(null);
const treeHasSelection = ref(false);
const genOpts = ref<JsonGenOptions>({
  ...DEFAULT_JSON_GEN,
  coverage: { ...DEFAULT_JSON_GEN.coverage },
});
const urlInput = ref('');
const urlOutput = ref('');
const urlError = ref('');
const toast = ref('');
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let ready = false;

const title = computed(() =>
  props.tab === 'json' ? t('tools.json') : t('tools.url'),
);

const jsonSearchHits = computed(() => {
  if (jsonDiag.value || !jsonSearch.value.trim()) return [];
  return searchJsonFieldPaths(jsonLeft.value, jsonSearch.value);
});

const jsonParsed = computed(() => {
  if (jsonDiag.value) return null;
  const parsed = parseJson(jsonLeft.value);
  return parsed.ok ? parsed.value : null;
});

const jsonLineCount = computed(() => {
  const text = jsonLeft.value;
  if (!text) return 1;
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') n++;
  return n;
});

const jsonHistoryCacheBytes = computed(() =>
  jsonHistoryByteSize(jsonHistory.value),
);

const jsonHistoryCacheSize = computed(() =>
  formatByteSize(jsonHistoryCacheBytes.value),
);

const jsonHistoryStats = computed(() =>
  t('tools.jsonHistoryStoredWithSize', {
    count: jsonHistory.value.length,
    size: jsonHistoryCacheSize.value,
  }),
);

const jsonErrTip = computed(() => {
  const key = jsonDiag.value?.tipKey;
  if (!key) return '';
  return t(TIP_MSG[key]);
});

const COVER_LABELS: { key: keyof JsonGenCoverage; label: string }[] = [
  { key: 'object', label: '{}' },
  { key: 'array', label: '[]' },
  { key: 'string', label: 'str' },
  { key: 'number', label: 'num' },
  { key: 'boolean', label: 'bool' },
  { key: 'null', label: 'null' },
];

const SIZE_MSG: Record<JsonGenSize, MessageKey> = {
  S: 'tools.jsonRandomSizeS',
  M: 'tools.jsonRandomSizeM',
  L: 'tools.jsonRandomSizeL',
};

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await hydrate();
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

watch(
  () =>
    [
      jsonLeft.value,
      jsonHistoryLimit.value,
      urlInput.value,
      urlOutput.value,
    ] as const,
  () => {
    if (!ready || !props.open) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void flushCache();
    }, 280);
  },
);

watch(
  () => [jsonDiag.value, jsonLeft.value, jsonParsed.value] as const,
  () => {
    if (jsonDiag.value || jsonParsed.value === null || !jsonLeft.value.trim()) {
      treeHasSelection.value = false;
    }
  },
);

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  if (toastTimer) clearTimeout(toastTimer);
  if (historyHelpTimer) clearTimeout(historyHelpTimer);
  document.removeEventListener('pointerdown', onRandomPointer, true);
  document.removeEventListener('pointerdown', onHistoryPointer, true);
});

function showHistoryHelp() {
  if (historyHelpTimer) clearTimeout(historyHelpTimer);
  // Native title tip is ~1s; first show uses half (500ms), later shows are instant.
  const delay = historyHelpShownOnce.value ? 0 : 500;
  historyHelpTimer = setTimeout(() => {
    historyHelpOpen.value = true;
    historyHelpShownOnce.value = true;
    historyHelpTimer = null;
  }, delay);
}

function hideHistoryHelp() {
  if (historyHelpTimer) {
    clearTimeout(historyHelpTimer);
    historyHelpTimer = null;
  }
  historyHelpOpen.value = false;
}

function closeFloatingPanels() {
  randomOpen.value = false;
  historyOpen.value = false;
  document.removeEventListener('pointerdown', onRandomPointer, true);
  document.removeEventListener('pointerdown', onHistoryPointer, true);
}

function onRandomPointer(e: PointerEvent) {
  if (!randomOpen.value || !randomRoot.value) return;
  if (!randomRoot.value.contains(e.target as Node)) randomOpen.value = false;
}

function onHistoryPointer(e: PointerEvent) {
  if (!historyOpen.value || !historyRoot.value) return;
  if (!historyRoot.value.contains(e.target as Node)) historyOpen.value = false;
}

function toggleRandomPanel() {
  historyOpen.value = false;
  document.removeEventListener('pointerdown', onHistoryPointer, true);
  randomOpen.value = !randomOpen.value;
  if (randomOpen.value) {
    document.addEventListener('pointerdown', onRandomPointer, true);
  } else {
    document.removeEventListener('pointerdown', onRandomPointer, true);
  }
}

function toggleHistoryPanel() {
  randomOpen.value = false;
  document.removeEventListener('pointerdown', onRandomPointer, true);
  historyOpen.value = !historyOpen.value;
  if (historyOpen.value) {
    document.addEventListener('pointerdown', onHistoryPointer, true);
  } else {
    document.removeEventListener('pointerdown', onHistoryPointer, true);
  }
}

function isHistoryActive(text: string): boolean {
  return isSameJsonContent(jsonLeft.value, text);
}

function restoreHistory(index: number) {
  const item = jsonHistory.value[index];
  if (!item) return;
  patchLeft(item);
  closeFloatingPanels();
  showToast(t('tools.jsonHistoryRestored'));
}

function setGenSize(size: JsonGenSize) {
  genOpts.value = { ...genOpts.value, size };
}

function setGenDepth(depth: number) {
  genOpts.value = { ...genOpts.value, maxDepth: depth };
}

function setGenRoot(root: JsonGenOptions['root']) {
  genOpts.value = { ...genOpts.value, root };
}

function toggleCover(key: keyof JsonGenCoverage) {
  const coverage = { ...genOpts.value.coverage, [key]: !genOpts.value.coverage[key] };
  if (!Object.values(coverage).some(Boolean)) coverage.string = true;
  genOpts.value = { ...genOpts.value, coverage };
}

function runRandomJson() {
  const text = generateRandomJson(genOpts.value);
  patchLeft(text);
  closeFloatingPanels();
  showToast(t('tools.jsonRandomDone'));
}

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function showToast(msg: string) {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = '';
  }, 1800);
}

function flushCache() {
  const cache = buildToolsCache({
    jsonLeft: jsonLeft.value,
    jsonHistory: jsonHistory.value,
    jsonHistoryLimit: jsonHistoryLimit.value,
    urlInput: urlInput.value,
    urlOutput: urlOutput.value,
  });
  jsonHistory.value = cache.jsonHistory;
  jsonHistoryLimit.value = cache.jsonHistoryLimit;
  return saveToolsCache(cache);
}

function persist() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  return flushCache();
}

async function hydrate() {
  ready = false;
  const cache = await loadToolsCache();
  jsonLeft.value = cache.jsonLeft;
  jsonHistory.value = cache.jsonHistory;
  jsonHistoryLimit.value = cache.jsonHistoryLimit;
  urlInput.value = cache.urlInput;
  urlOutput.value = cache.urlOutput;
  refreshParse();
  ready = true;
}

function onClose() {
  void persist();
  toast.value = '';
  closeFloatingPanels();
  emit('close');
}

function refreshParse() {
  const result = diagnoseJson(jsonLeft.value);
  if (result.ok) {
    jsonDiag.value = null;
    jsonRight.value = result.pretty;
  } else {
    jsonDiag.value = result.diag;
    jsonRight.value = '';
  }
}

function patchLeft(next: string) {
  jsonLeft.value = next;
  refreshParse();
}

function syncJsonGutter() {
  if (jsonGutter.value && jsonTa.value) {
    jsonGutter.value.scrollTop = jsonTa.value.scrollTop;
  }
}

function onJsonKeydown(e: KeyboardEvent) {
  const el = jsonTa.value;
  if (!el) return;
  const patch = applyJsonEditorKeydown(
    e,
    el.value,
    el.selectionStart ?? 0,
    el.selectionEnd ?? 0,
  );
  if (!patch) return;
  e.preventDefault();
  jsonLeft.value = patch.text;
  refreshParse();
  void nextTick(() => {
    el.selectionStart = patch.selectionStart;
    el.selectionEnd = patch.selectionEnd;
    syncJsonGutter();
  });
}

function jumpToJsonError() {
  const diag = jsonDiag.value;
  const el = jsonTa.value;
  if (!el || diag?.position == null) return;
  const pos = diag.position;
  const from = Math.max(0, pos);
  const to = Math.min(jsonLeft.value.length, pos + 1);
  el.focus();
  el.setSelectionRange(from, Math.max(from + 1, to));
  const styles = getComputedStyle(el);
  const lh = Number.parseFloat(styles.lineHeight) || 18;
  const pad = Number.parseFloat(styles.paddingTop) || 0;
  const line = diag.line ?? 1;
  el.scrollTop = Math.max(0, pad + (line - 1) * lh - el.clientHeight * 0.35);
  syncJsonGutter();
}

function runFormat() {
  const result = diagnoseJson(jsonLeft.value);
  if (!result.ok) {
    jsonDiag.value = result.diag;
    jsonRight.value = '';
    void nextTick(() => jumpToJsonError());
    return;
  }
  patchLeft(result.pretty);
}

function runCompress() {
  try {
    patchLeft(compressJson(jsonLeft.value));
  } catch {
    refreshParse();
    void nextTick(() => jumpToJsonError());
  }
}

function runEscape() {
  try {
    patchLeft(escapeJson(jsonLeft.value));
  } catch (e) {
    jsonDiag.value = {
      message: err(e),
      position: null,
      line: null,
      column: null,
      lineText: '',
      snippet: '',
      tipKey: '',
    };
    jsonRight.value = '';
  }
}

function runUnescape() {
  try {
    jsonLeft.value = unescapeJson(jsonLeft.value);
    refreshParse();
  } catch (e) {
    jsonDiag.value = {
      message: err(e),
      position: null,
      line: null,
      column: null,
      lineText: '',
      snippet: '',
      tipKey: '',
    };
  }
}

function urlSource(): string | null {
  const source = urlInput.value;
  if (!source.trim()) {
    urlError.value = '';
    showToast(t('tools.urlEmpty'));
    return null;
  }
  return source;
}

function runEncode() {
  const source = urlSource();
  if (!source) return;
  const encoded = encodeURIComponent(source);
  urlError.value = '';
  urlOutput.value = encoded;
  showToast(t(encoded === source ? 'tools.urlUnchanged' : 'tools.urlEncoded'));
}

function runDecode() {
  const source = urlSource();
  if (!source) return;
  try {
    const decoded = decodeURIComponent(source.replace(/\+/g, ' '));
    urlError.value = '';
    urlOutput.value = decoded;
    showToast(t(decoded === source ? 'tools.urlUnchanged' : 'tools.urlDecoded'));
  } catch (e) {
    urlError.value = err(e) || t('tools.urlError');
  }
}

function swapUrl() {
  const nextIn = urlOutput.value;
  const nextOut = urlInput.value;
  urlInput.value = nextIn;
  urlOutput.value = nextOut;
  urlError.value = '';
  showToast(t('tools.urlSwapped'));
}

async function copyText(text: string) {
  if (!text.trim()) {
    showToast(t('tools.urlEmpty'));
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('tools.copied'));
  } catch {
    /* ignore */
  }
}

async function onClearJsonCache() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  jsonHistory.value = [];
  const next = await clearJsonHistoryCache();
  jsonHistory.value = next.jsonHistory;
  jsonHistoryLimit.value = next.jsonHistoryLimit;
  showToast(t('tools.jsonCacheCleared'));
}

function setHistoryLimit(next: number) {
  const clamped = clampJsonHistoryLimit(next);
  if (clamped === jsonHistoryLimit.value) return;
  jsonHistoryLimit.value = clamped;
  jsonHistory.value = trimJsonHistory(jsonHistory.value, clamped);
  void persist();
}

function stepHistoryLimit(delta: number) {
  setHistoryLimit(jsonHistoryLimit.value + delta);
}

function onTreeSelect(path: string | null) {
  treeHasSelection.value = path != null;
}

function callTree(
  action: 'expandAll' | 'collapseAll' | 'stepExpand' | 'stepCollapse',
) {
  if (
    (action === 'stepExpand' || action === 'stepCollapse') &&
    !treeHasSelection.value
  ) {
    showToast(t('tools.jsonStepNeedSelect'));
    return;
  }
  jsonTreeRef.value?.[action]();
}

function downloadJsonTree() {
  if (jsonDiag.value || jsonParsed.value === null || !jsonLeft.value.trim()) return;
  const pretty = jsonRight.value || JSON.stringify(jsonParsed.value, null, 2);
  downloadTextFile('bookmymark.json', `${pretty}\n`);
  showToast(t('tools.jsonDownloaded'));
}

async function onClear() {
  if (props.tab === 'json') {
    jsonLeft.value = '';
    jsonRight.value = '';
    jsonDiag.value = null;
    jsonSearch.value = '';
  } else {
    urlInput.value = '';
    urlOutput.value = '';
    urlError.value = '';
  }
  toast.value = '';
  await persist();
}
</script>

<template>
  <dialog
    ref="dialog"
    class="bmm-dialog bmm-tools-dialog"
    :aria-label="title"
    @close="onClose"
  >
    <div class="bmm-tools-shell">
      <Transition name="bmm-toast">
        <div v-if="toast" class="bmm-toast bmm-tools-toast" role="status">
          {{ toast }}
        </div>
      </Transition>

      <header class="bmm-tools-head">
        <h3 class="bmm-tools-title">
          <Braces v-if="tab === 'json'" :size="16" />
          <Link2 v-else :size="16" />
          {{ title }}
        </h3>
        <div class="bmm-tools-head-actions">
          <div v-if="tab === 'json'" class="bmm-tools-history-cfg">
            <div
              class="bmm-tools-history-help-wrap"
              @pointerenter="showHistoryHelp"
              @pointerleave="hideHistoryHelp"
            >
              <button
                type="button"
                class="bmm-tools-history-help"
                :aria-label="t('tools.jsonHistoryHelp')"
                :aria-describedby="historyHelpOpen ? 'bmm-json-history-help-tip' : undefined"
              >
                <CircleHelp :size="14" />
              </button>
              <div
                v-show="historyHelpOpen"
                id="bmm-json-history-help-tip"
                class="bmm-tools-history-help-tip"
                role="tooltip"
              >
                {{ t('tools.jsonHistoryHelp') }}
              </div>
            </div>
            <label class="bmm-tools-history-label">
              <span>{{ t('tools.jsonHistoryKeep') }}</span>
              <div
                class="bmm-tools-history-stepper"
                role="group"
                :aria-label="t('tools.jsonHistoryKeep')"
              >
                <button
                  type="button"
                  class="bmm-tools-history-step"
                  :disabled="jsonHistoryLimit <= MIN_JSON_HISTORY_LIMIT"
                  :aria-label="t('tools.jsonHistoryLess')"
                  @click="stepHistoryLimit(-1)"
                >
                  <Minus :size="12" />
                </button>
                <span class="bmm-tools-history-value">{{ jsonHistoryLimit }}</span>
                <button
                  type="button"
                  class="bmm-tools-history-step"
                  :disabled="jsonHistoryLimit >= MAX_JSON_HISTORY_LIMIT"
                  :aria-label="t('tools.jsonHistoryMore')"
                  @click="stepHistoryLimit(1)"
                >
                  <Plus :size="12" />
                </button>
              </div>
              <span>{{ t('tools.jsonHistoryUnit') }}</span>
            </label>
            <button
              type="button"
              class="bmm-btn"
              :title="t('tools.jsonClearCache')"
              :disabled="!jsonHistory.length"
              @click="onClearJsonCache"
            >
              <Trash2 :size="13" />
              <I18nText msg="tools.jsonClearCache" />
            </button>
          </div>
          <button
            type="button"
            class="bmm-btn bmm-btn-icon"
            :title="t('tools.close')"
            :aria-label="t('tools.close')"
            @click="onClose"
          >
            <X :size="15" />
          </button>
        </div>
      </header>

      <section v-if="tab === 'json'" class="bmm-tools-body">
        <div class="bmm-tools-actions">
          <button type="button" class="bmm-btn" @click="runFormat">
            <Sparkles :size="13" />
            <I18nText msg="tools.jsonFormat" />
          </button>
          <button type="button" class="bmm-btn" @click="runCompress">
            <Minimize2 :size="13" />
            <I18nText msg="tools.jsonCompress" />
          </button>
          <button type="button" class="bmm-btn" @click="runEscape">
            <Quote :size="13" />
            <I18nText msg="tools.jsonEscape" />
          </button>
          <button type="button" class="bmm-btn" @click="runUnescape">
            <TextQuote :size="13" />
            <I18nText msg="tools.jsonUnescape" />
          </button>
          <div ref="randomRoot" class="bmm-json-random">
            <button
              type="button"
              class="bmm-btn"
              :aria-expanded="randomOpen"
              aria-haspopup="dialog"
              @click="toggleRandomPanel"
            >
              <Dices :size="13" />
              <I18nText msg="tools.jsonRandom" />
            </button>
            <div
              v-if="randomOpen"
              class="bmm-json-random-panel"
              role="dialog"
              :aria-label="t('tools.jsonRandom')"
            >
              <div class="bmm-json-random-row">
                <span class="bmm-json-random-label">{{ t('tools.jsonRandomSize') }}</span>
                <div class="bmm-json-random-seg">
                  <button
                    v-for="s in (['S', 'M', 'L'] as const)"
                    :key="s"
                    type="button"
                    :class="{ active: genOpts.size === s }"
                    @click="setGenSize(s)"
                  >
                    {{ t(SIZE_MSG[s]) }}
                  </button>
                </div>
              </div>
              <div class="bmm-json-random-row">
                <span class="bmm-json-random-label">
                  {{ t('tools.jsonRandomDepth') }}
                  <em>{{ genOpts.maxDepth }}</em>
                </span>
                <input
                  class="bmm-json-random-range"
                  type="range"
                  min="1"
                  max="6"
                  step="1"
                  :value="genOpts.maxDepth"
                  @input="setGenDepth(Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <div class="bmm-json-random-row">
                <span class="bmm-json-random-label">{{ t('tools.jsonRandomRoot') }}</span>
                <div class="bmm-json-random-seg">
                  <button
                    type="button"
                    :class="{ active: genOpts.root === 'object' }"
                    @click="setGenRoot('object')"
                  >
                    {{ t('tools.jsonRandomRootObj') }}
                  </button>
                  <button
                    type="button"
                    :class="{ active: genOpts.root === 'array' }"
                    @click="setGenRoot('array')"
                  >
                    {{ t('tools.jsonRandomRootArr') }}
                  </button>
                  <button
                    type="button"
                    :class="{ active: genOpts.root === 'auto' }"
                    @click="setGenRoot('auto')"
                  >
                    {{ t('tools.jsonRandomRootAuto') }}
                  </button>
                </div>
              </div>
              <div class="bmm-json-random-row col">
                <span class="bmm-json-random-label">{{ t('tools.jsonRandomCover') }}</span>
                <div class="bmm-json-random-chips">
                  <button
                    v-for="item in COVER_LABELS"
                    :key="item.key"
                    type="button"
                    class="bmm-json-random-chip"
                    :class="{ on: genOpts.coverage[item.key] }"
                    @click="toggleCover(item.key)"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="bmm-btn bmm-btn-primary bmm-json-random-run"
                @click="runRandomJson"
              >
                <Dices :size="13" />
                <I18nText msg="tools.jsonRandomRun" />
              </button>
            </div>
          </div>
          <button type="button" class="bmm-btn" @click="copyText(jsonRight || jsonLeft)">
            <Copy :size="13" />
            <I18nText msg="tools.copy" />
          </button>
          <button
            type="button"
            class="bmm-btn bmm-btn-danger"
            :title="t('tools.clear')"
            @click="onClear"
          >
            <Eraser :size="13" />
            <I18nText msg="tools.clear" />
          </button>
        </div>

        <div class="bmm-tools-panes">
          <div class="bmm-tools-pane">
            <div class="bmm-tools-pane-head">
              <span class="bmm-tools-pane-label">
                <I18nText msg="tools.jsonEdit" />
              </span>
              <div ref="historyRoot" class="bmm-tools-history-menu">
                <button
                  type="button"
                  class="bmm-tools-history-trigger"
                  :class="{ open: historyOpen, empty: !jsonHistory.length }"
                  :aria-expanded="historyOpen"
                  aria-haspopup="dialog"
                  :disabled="!jsonHistory.length"
                  :title="t('tools.jsonHistoryView')"
                  @click="toggleHistoryPanel"
                >
                  <History :size="12" />
                  <span>{{ jsonHistoryStats }}</span>
                  <ChevronDown :size="12" class="bmm-tools-history-chevron" />
                </button>
                <div
                  v-if="historyOpen"
                  class="bmm-tools-history-panel"
                  role="dialog"
                  :aria-label="t('tools.jsonHistoryView')"
                >
                  <div class="bmm-tools-history-panel-head">
                    <span>{{ t('tools.jsonHistoryView') }}</span>
                    <span class="bmm-tools-history-panel-meta">{{ jsonHistoryStats }}</span>
                  </div>
                  <ul v-if="jsonHistory.length" class="bmm-tools-history-list">
                    <li v-for="(item, index) in jsonHistory" :key="index">
                      <button
                        type="button"
                        class="bmm-tools-history-item"
                        :class="{ active: isHistoryActive(item) }"
                        @click="restoreHistory(index)"
                      >
                        <span class="bmm-tools-history-item-main">
                          <span class="bmm-tools-history-item-index">#{{ index + 1 }}</span>
                          <span class="bmm-tools-history-item-preview">{{ historyPreview(item) }}</span>
                        </span>
                        <span class="bmm-tools-history-item-meta">
                          <span
                            v-if="isHistoryActive(item)"
                            class="bmm-tools-history-item-tag"
                          >{{ t('tools.jsonHistoryCurrent') }}</span>
                          <span class="bmm-tools-history-item-size">
                            {{ formatByteSize(textByteSize(item)) }}
                          </span>
                        </span>
                      </button>
                    </li>
                  </ul>
                  <p v-else class="bmm-tools-history-empty">
                    {{ t('tools.jsonHistoryEmpty') }}
                  </p>
                </div>
              </div>
            </div>
            <div
              class="bmm-json-editor"
              :class="{ error: !!jsonDiag }"
            >
              <button
                v-if="jsonDiag"
                type="button"
                class="bmm-json-editor-banner"
                @click="jumpToJsonError"
              >
                <CircleAlert :size="14" />
                <span class="bmm-json-editor-banner-text">
                  <strong>{{ t('tools.jsonInvalid') }}</strong>
                  <template v-if="jsonDiag.line != null && jsonDiag.column != null">
                    · {{ t('tools.jsonErrAt', { line: jsonDiag.line, col: jsonDiag.column }) }}
                  </template>
                </span>
                <span v-if="jsonDiag.position != null" class="bmm-json-editor-jump">
                  {{ t('tools.jsonErrJump') }}
                </span>
              </button>
              <div class="bmm-json-editor-body">
                <div ref="jsonGutter" class="bmm-json-gutter" aria-hidden="true">
                  <span
                    v-for="n in jsonLineCount"
                    :key="n"
                    class="bmm-json-gutter-line"
                    :class="{ bad: jsonDiag?.line === n }"
                  >{{ n }}</span>
                </div>
                <textarea
                  ref="jsonTa"
                  v-model="jsonLeft"
                  class="bmm-tools-textarea bmm-json-editor-ta"
                  spellcheck="false"
                  :placeholder="t('tools.jsonPh')"
                  @keydown="onJsonKeydown"
                  @input="refreshParse"
                  @scroll="syncJsonGutter"
                />
              </div>
            </div>
          </div>
          <div class="bmm-tools-pane">
            <div class="bmm-tools-pane-head">
              <span class="bmm-tools-pane-label">
                <I18nText msg="tools.jsonParse" />
                <span
                  v-if="!jsonDiag && jsonSearch.trim() && !jsonSearchHits.length"
                  class="bmm-tools-meta"
                >
                  {{ t('tools.jsonSearchEmpty') }}
                </span>
                <span v-else-if="!jsonDiag && jsonSearchHits.length" class="bmm-tools-meta">
                  {{ t('tools.jsonSearchCount', { count: jsonSearchHits.length }) }}
                </span>
              </span>
              <div
                v-if="!jsonDiag && jsonParsed !== null && jsonLeft.trim()"
                class="bmm-json-tree-actions"
              >
                <button
                  type="button"
                  class="bmm-btn"
                  :title="t('tools.jsonExpandAll')"
                  @click="callTree('expandAll')"
                >
                  <UnfoldVertical :size="13" />
                  <I18nText msg="tools.jsonExpandAll" />
                </button>
                <button
                  type="button"
                  class="bmm-btn"
                  :title="t('tools.jsonCollapseAll')"
                  @click="callTree('collapseAll')"
                >
                  <FoldVertical :size="13" />
                  <I18nText msg="tools.jsonCollapseAll" />
                </button>
                <button
                  type="button"
                  class="bmm-btn"
                  :title="t('tools.jsonStepExpand')"
                  :disabled="!treeHasSelection"
                  @click="callTree('stepExpand')"
                >
                  <Plus :size="13" />
                  <I18nText msg="tools.jsonStepExpand" />
                </button>
                <button
                  type="button"
                  class="bmm-btn"
                  :title="t('tools.jsonStepCollapse')"
                  :disabled="!treeHasSelection"
                  @click="callTree('stepCollapse')"
                >
                  <Minus :size="13" />
                  <I18nText msg="tools.jsonStepCollapse" />
                </button>
                <button
                  type="button"
                  class="bmm-btn"
                  :title="t('tools.jsonDownload')"
                  @click="downloadJsonTree"
                >
                  <Download :size="13" />
                  <I18nText msg="tools.jsonDownload" />
                </button>
              </div>
              <label v-if="!jsonDiag" class="bmm-tools-search">
                <Search :size="13" />
                <input
                  v-model="jsonSearch"
                  type="search"
                  :placeholder="t('tools.jsonSearchPh')"
                />
              </label>
            </div>
            <div
              class="bmm-tools-json-view"
              :class="{ error: !!jsonDiag }"
            >
              <JsonTreeView
                v-if="!jsonDiag && jsonParsed !== null && jsonLeft.trim()"
                ref="jsonTreeRef"
                :value="jsonParsed"
                :query="jsonSearch"
                @select="onTreeSelect"
              />
              <div v-else-if="jsonDiag" class="bmm-json-err-panel">
                <div class="bmm-json-err-title">
                  <CircleAlert :size="18" />
                  <span>{{ t('tools.jsonInvalid') }}</span>
                </div>
                <div v-if="jsonDiag.line != null" class="bmm-json-err-loc">
                  <span class="bmm-json-err-badge">
                    {{ t('tools.jsonErrAt', { line: jsonDiag.line, col: jsonDiag.column ?? 1 }) }}
                  </span>
                  <span
                    v-if="jsonDiag.position != null"
                    class="bmm-json-err-badge muted"
                  >
                    {{ t('tools.jsonErrPos', { pos: jsonDiag.position }) }}
                  </span>
                  <button
                    v-if="jsonDiag.position != null"
                    type="button"
                    class="bmm-btn bmm-json-err-jump-btn"
                    @click="jumpToJsonError"
                  >
                    {{ t('tools.jsonErrJump') }}
                  </button>
                </div>
                <div class="bmm-json-err-block">
                  <div class="bmm-json-err-label">{{ t('tools.jsonErrReason') }}</div>
                  <p class="bmm-json-err-msg">{{ jsonDiag.message }}</p>
                  <p v-if="jsonErrTip" class="bmm-json-err-tip">{{ jsonErrTip }}</p>
                </div>
                <div v-if="jsonDiag.snippet" class="bmm-json-err-block">
                  <div class="bmm-json-err-label">{{ t('tools.jsonErrNear') }}</div>
                  <pre class="bmm-json-err-snippet">{{ jsonDiag.snippet }}</pre>
                </div>
              </div>
              <pre v-else class="bmm-tools-json-empty muted">{{ t('tools.jsonParsePh') }}</pre>
            </div>
            <ul v-if="jsonSearchHits.length" class="bmm-tools-json-hits">
              <li v-for="path in jsonSearchHits" :key="path">{{ path }}</li>
            </ul>
          </div>
        </div>
      </section>

      <section v-else class="bmm-tools-body">
        <div class="bmm-tools-panes stacked">
          <label class="bmm-tools-pane">
            <span class="bmm-tools-pane-label">
              <I18nText msg="tools.urlInput" />
            </span>
            <textarea
              v-model="urlInput"
              class="bmm-tools-textarea"
              spellcheck="false"
              :placeholder="t('tools.urlPh')"
            />
          </label>
          <label class="bmm-tools-pane">
            <span class="bmm-tools-pane-label">
              <I18nText msg="tools.urlOutput" />
              <span v-if="urlError" class="bmm-tools-err">{{ urlError }}</span>
            </span>
            <textarea
              class="bmm-tools-textarea"
              :class="{ error: !!urlError }"
              :value="urlOutput"
              readonly
              spellcheck="false"
              :placeholder="t('tools.urlOutPh')"
            />
          </label>
        </div>

        <div class="bmm-tools-url-footer">
          <button
            type="button"
            class="bmm-btn bmm-btn-danger"
            :title="t('tools.clear')"
            @click="onClear"
          >
            <Eraser :size="13" />
            <I18nText msg="tools.clear" />
          </button>
          <button type="button" class="bmm-btn" :title="t('tools.urlSwap')" @click="swapUrl">
            <ArrowLeftRight :size="13" />
            <I18nText msg="tools.urlSwap" />
          </button>
          <button type="button" class="bmm-btn" @click="copyText(urlOutput)">
            <Copy :size="13" />
            <I18nText msg="tools.copy" />
          </button>
          <button type="button" class="bmm-btn bmm-btn-primary" @click="runEncode">
            <I18nText msg="tools.urlEncode" />
          </button>
          <button type="button" class="bmm-btn bmm-btn-primary" @click="runDecode">
            <I18nText msg="tools.urlDecode" />
          </button>
        </div>
      </section>
    </div>
  </dialog>
</template>
