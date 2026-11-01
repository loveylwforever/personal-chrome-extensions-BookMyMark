import { searchJsonFieldPathsFromValue } from './json-tree';
import { parseJsonText, unescapeJsonText } from './json-parse';

export type ToolTab = 'json' | 'url';

export interface ToolsCache {
  version: 2;
  jsonLeft: string;
  jsonHistory: string[];
  jsonHistoryLimit: number;
  urlInput: string;
  urlOutput: string;
}

export const DEFAULT_JSON_HISTORY_LIMIT = 10;
export const MIN_JSON_HISTORY_LIMIT = 1;
export const MAX_JSON_HISTORY_LIMIT = 100;

const STORAGE_KEY = 'bookmymark.tools';

const EMPTY: ToolsCache = {
  version: 2,
  jsonLeft: '',
  jsonHistory: [],
  jsonHistoryLimit: DEFAULT_JSON_HISTORY_LIMIT,
  urlInput: '',
  urlOutput: '',
};

export function clampJsonHistoryLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_JSON_HISTORY_LIMIT;
  return Math.min(
    MAX_JSON_HISTORY_LIMIT,
    Math.max(MIN_JSON_HISTORY_LIMIT, Math.floor(value)),
  );
}

export function trimJsonHistory(history: string[], limit: number): string[] {
  return history.slice(0, clampJsonHistoryLimit(limit));
}

/** Compact form for equality: ignores whitespace and extra escape layers. */
export function normalizeJsonForCompare(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const parsed = parseJsonText(trimmed);
  if (!parsed.ok) return trimmed;
  return JSON.stringify(parsed.value);
}

export function isSameJsonContent(a: string, b: string): boolean {
  return normalizeJsonForCompare(a) === normalizeJsonForCompare(b);
}

export function pushJsonHistory(
  history: string[],
  text: string,
  limit: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return trimJsonHistory(history, limit);

  const key = normalizeJsonForCompare(trimmed);
  const existingIdx = history.findIndex(
    (item) => normalizeJsonForCompare(item) === key,
  );
  if (existingIdx === 0) return trimJsonHistory(history, limit);
  if (existingIdx > 0) {
    const existing = history[existingIdx]!;
    const rest = history.filter((_, i) => i !== existingIdx);
    return trimJsonHistory([existing, ...rest], limit);
  }
  return trimJsonHistory([trimmed, ...history], limit);
}

function sanitizeHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function migrateToolsCache(value: Partial<ToolsCache> & { version?: number }): ToolsCache {
  const jsonLeft = typeof value.jsonLeft === 'string' ? value.jsonLeft : '';
  const urlInput = typeof value.urlInput === 'string' ? value.urlInput : '';
  const urlOutput = typeof value.urlOutput === 'string' ? value.urlOutput : '';

  if (value.version === 2) {
    const limit = clampJsonHistoryLimit(
      typeof value.jsonHistoryLimit === 'number'
        ? value.jsonHistoryLimit
        : DEFAULT_JSON_HISTORY_LIMIT,
    );
    const history = trimJsonHistory(sanitizeHistory(value.jsonHistory), limit);
    const jsonHistory =
      history.length === 0 && jsonLeft.trim() ? [jsonLeft.trim()] : history;
    return {
      version: 2,
      jsonLeft,
      jsonHistory,
      jsonHistoryLimit: limit,
      urlInput,
      urlOutput,
    };
  }

  const trimmed = jsonLeft.trim();
  return {
    version: 2,
    jsonLeft,
    jsonHistory: trimmed ? [trimmed] : [],
    jsonHistoryLimit: DEFAULT_JSON_HISTORY_LIMIT,
    urlInput,
    urlOutput,
  };
}

export async function loadToolsCache(): Promise<ToolsCache> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const value = raw[STORAGE_KEY] as Partial<ToolsCache> & { version?: number } | undefined;
  if (!value?.version) return { ...EMPTY };
  return migrateToolsCache(value);
}

export async function saveToolsCache(cache: ToolsCache): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: cache });
}

/** Wipe stored JSON snippets only. Does not touch the editor, URL fields, or bookmark overlay (visit counts). */
export async function clearJsonHistoryCache(): Promise<ToolsCache> {
  const current = await loadToolsCache();
  const next: ToolsCache = {
    ...current,
    jsonHistory: [],
  };
  await saveToolsCache(next);
  return next;
}

export function buildToolsCache(input: {
  jsonLeft: string;
  jsonHistory: string[];
  jsonHistoryLimit: number;
  urlInput: string;
  urlOutput: string;
}): ToolsCache {
  const limit = clampJsonHistoryLimit(input.jsonHistoryLimit);
  return {
    version: 2,
    jsonLeft: input.jsonLeft,
    jsonHistory: pushJsonHistory(input.jsonHistory, input.jsonLeft, limit),
    jsonHistoryLimit: limit,
    urlInput: input.urlInput,
    urlOutput: input.urlOutput,
  };
}

export function textByteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function jsonHistoryByteSize(history: readonly string[]): number {
  let total = 0;
  for (const item of history) total += textByteSize(item);
  return total;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function historyPreview(text: string, max = 72): string {
  const oneLine = text.trim().replace(/\s+/g, ' ');
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

export function prettyJson(
  text: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: '' };
  const parsed = parseJsonText(trimmed);
  if (!parsed.ok) return parsed;
  return { ok: true, value: JSON.stringify(parsed.value, null, 2) };
}

export function compressJson(text: string): string {
  const parsed = parseJsonText(text.trim());
  if (!parsed.ok) throw new Error(parsed.error);
  return JSON.stringify(parsed.value);
}

export function escapeJson(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

export function unescapeJson(text: string): string {
  return unescapeJsonText(text);
}

export function parseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = parseJsonText(trimmed);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value };
}

/** Find JSON field paths whose key matches query (case-insensitive). */
export function searchJsonFieldPaths(text: string, query: string): string[] {
  const parsed = parseJson(text);
  if (!parsed.ok) return [];
  return searchJsonFieldPathsFromValue(parsed.value, query);
}
