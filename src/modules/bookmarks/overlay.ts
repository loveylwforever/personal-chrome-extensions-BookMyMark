import type {
  BookmarkOverlay,
  Locale,
  SiteMeta,
  SortDir,
  SortMode,
  ThemeMode,
  ThemePref,
  ViewMode,
} from './types';
import { FOLDER_HOME, TAG_ALL } from './types';
import { detectBrowserLocale, isLocale } from '~/modules/i18n';
import {
  applyAppearance,
  DEFAULT_ACCENT,
  detectSystemTheme,
  isHexColor,
  isPresetId,
  isThemePref,
  normalizeHex,
  resolveThemePref,
} from './appearance';

export {
  applyAppearance,
  detectSystemTheme,
  resolveThemePref,
} from './appearance';

/** @deprecated use applyAppearance(theme, accent) */
export function applyTheme(theme: ThemeMode, accent = DEFAULT_ACCENT): void {
  applyAppearance(theme, accent);
}

const STORAGE_KEY = 'bookmymark.overlay';

function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : detectBrowserLocale();
}

const SORT_MODES: SortMode[] = ['default', 'frequency', 'alpha', 'added'];

export function normalizeSortMode(value: unknown): SortMode {
  return SORT_MODES.includes(value as SortMode)
    ? (value as SortMode)
    : 'default';
}

export function normalizeSortDir(value: unknown): SortDir {
  return value === 'asc' || value === 'desc' ? value : 'asc';
}

/** Sensible direction when switching sort mode */
export function defaultSortDirFor(mode: SortMode): SortDir {
  if (mode === 'frequency' || mode === 'added') return 'desc';
  return 'asc';
}

/** chrome.storage 里可能不是真正的数组，统一收成 string[] */
export function toIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string');
  }
  return [];
}

export function normalizeAccent(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_ACCENT;
  const v = value.trim();
  if (isPresetId(v)) return v;
  if (isHexColor(v)) return normalizeHex(v);
  return DEFAULT_ACCENT;
}

export function normalizeThemePref(
  value: unknown,
  legacyTheme?: unknown,
): ThemePref {
  if (isThemePref(value)) return value;
  if (legacyTheme === 'light' || legacyTheme === 'dark') return legacyTheme;
  return 'system';
}

export const SIDEBAR_WIDTH_DEFAULT = 240;
export const SIDEBAR_WIDTH_MIN = 180;
export const SIDEBAR_WIDTH_MAX = 420;

export function clampSidebarWidth(px: number): number {
  return Math.min(
    SIDEBAR_WIDTH_MAX,
    Math.max(SIDEBAR_WIDTH_MIN, Math.round(px)),
  );
}

export function createEmptyOverlay(): BookmarkOverlay {
  const themePref: ThemePref = 'system';
  return {
    version: 1,
    siteMeta: {},
    folderIcons: {},
    viewMode: 'compact',
    themePref,
    theme: resolveThemePref(themePref),
    accent: DEFAULT_ACCENT,
    locale: detectBrowserLocale(),
    activeFolderId: FOLDER_HOME,
    activeTagId: TAG_ALL,
    expandedFolderIds: ['1', '2'],
    sidebarWidthPx: SIDEBAR_WIDTH_DEFAULT,
    sortMode: 'default',
    sortDir: 'asc',
  };
}

export function emptySiteMeta(): SiteMeta {
  return { visitCount: 0 };
}

export function getSiteMeta(
  overlay: BookmarkOverlay,
  siteId: string,
): SiteMeta {
  return overlay.siteMeta[siteId] ?? emptySiteMeta();
}

export async function loadOverlay(): Promise<BookmarkOverlay> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const value = raw[STORAGE_KEY] as BookmarkOverlay | undefined;
  if (!value || value.version !== 1) return createEmptyOverlay();
  const themePref = normalizeThemePref(value.themePref, value.theme);
  const theme = resolveThemePref(themePref);
  const accent = normalizeAccent(value.accent);
  const sidebarWidthPx = clampSidebarWidth(
    typeof value.sidebarWidthPx === 'number'
      ? value.sidebarWidthPx
      : SIDEBAR_WIDTH_DEFAULT,
  );
  return {
    version: 1,
    siteMeta: sanitizeSiteMeta(value.siteMeta ?? {}),
    folderIcons: value.folderIcons ?? {},
    viewMode: value.viewMode ?? 'compact',
    themePref,
    theme,
    accent,
    locale: normalizeLocale(value.locale),
    activeFolderId: value.activeFolderId ?? FOLDER_HOME,
    activeTagId: value.activeTagId ?? TAG_ALL,
    expandedFolderIds: toIdList(value.expandedFolderIds),
    sidebarWidthPx,
    sortMode: normalizeSortMode(value.sortMode),
    sortDir: normalizeSortDir(
      value.sortDir ?? defaultSortDirFor(normalizeSortMode(value.sortMode)),
    ),
  };
}

function sanitizeSiteMeta(
  raw: Record<string, SiteMeta>,
): Record<string, SiteMeta> {
  const out: Record<string, SiteMeta> = {};
  for (const [id, meta] of Object.entries(raw)) {
    out[id] = {
      visitCount: meta.visitCount ?? 0,
      lastVisitedAt: meta.lastVisitedAt,
      favorited: meta.favorited,
      description: meta.description,
    };
  }
  return out;
}

export async function saveOverlay(overlay: BookmarkOverlay): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: overlay });
}

export function patchSiteMeta(
  overlay: BookmarkOverlay,
  siteId: string,
  patch: Partial<SiteMeta>,
): BookmarkOverlay {
  const prev = getSiteMeta(overlay, siteId);
  return {
    ...overlay,
    siteMeta: {
      ...overlay.siteMeta,
      [siteId]: { ...prev, ...patch },
    },
  };
}

export function setViewMode(
  overlay: BookmarkOverlay,
  viewMode: ViewMode,
): BookmarkOverlay {
  return { ...overlay, viewMode };
}

export function setSortMode(
  overlay: BookmarkOverlay,
  sortMode: SortMode,
  sortDir?: SortDir,
): BookmarkOverlay {
  return {
    ...overlay,
    sortMode,
    sortDir: sortDir ?? defaultSortDirFor(sortMode),
  };
}

export function setSortDir(
  overlay: BookmarkOverlay,
  sortDir: SortDir,
): BookmarkOverlay {
  return { ...overlay, sortDir };
}

export function setThemePref(
  overlay: BookmarkOverlay,
  themePref: ThemePref,
): BookmarkOverlay {
  return {
    ...overlay,
    themePref,
    theme: resolveThemePref(themePref),
  };
}

export function setAccent(
  overlay: BookmarkOverlay,
  accent: string,
): BookmarkOverlay {
  return { ...overlay, accent: normalizeAccent(accent) };
}

export function setTheme(
  overlay: BookmarkOverlay,
  theme: ThemeMode,
): BookmarkOverlay {
  return { ...overlay, theme, themePref: theme };
}

export function setLocale(
  overlay: BookmarkOverlay,
  locale: Locale,
): BookmarkOverlay {
  return { ...overlay, locale };
}

export function setFolderIcon(
  overlay: BookmarkOverlay,
  folderId: string,
  icon: string | null,
): BookmarkOverlay {
  const folderIcons = { ...overlay.folderIcons };
  if (!icon) delete folderIcons[folderId];
  else folderIcons[folderId] = icon;
  return { ...overlay, folderIcons };
}

export function setActive(
  overlay: BookmarkOverlay,
  activeFolderId: string,
  activeTagId: string,
): BookmarkOverlay {
  return { ...overlay, activeFolderId, activeTagId };
}

export function pruneRemovedSites(
  overlay: BookmarkOverlay,
  existingIds: Set<string>,
): BookmarkOverlay {
  const siteMeta: Record<string, SiteMeta> = {};
  for (const [id, meta] of Object.entries(overlay.siteMeta)) {
    if (existingIds.has(id)) siteMeta[id] = meta;
  }
  return { ...overlay, siteMeta };
}
