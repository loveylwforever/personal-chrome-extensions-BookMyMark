import type { Locale } from '~/modules/i18n/messages';

/** Virtual folder / smart-filter ids */
export const FOLDER_HOME = '__home__';
export const FOLDER_ALL = '__all_folders__';
export const TAG_ALL = '__all__';
export const TAG_FAVORITES = '__favorites__';
export const TAG_MOST = '__most_visited__';
export const TAG_RECENT = '__recent__';

export function isVirtualFolderId(id: string): boolean {
  return id === FOLDER_HOME || id === FOLDER_ALL;
}

export type ViewMode = 'compact' | 'list' | 'expanded';
export type ThemeMode = 'light' | 'dark';
export type ThemePref = 'light' | 'dark' | 'system';
export type { Locale };
/** How the main bookmark list is ordered */
export type SortMode = 'default' | 'frequency' | 'alpha' | 'added';
export type SortDir = 'asc' | 'desc';

export interface SiteMeta {
  visitCount: number;
  lastVisitedAt?: number;
  favorited?: boolean;
  description?: string;
}

export interface BookmarkOverlay {
  version: 1;
  siteMeta: Record<string, SiteMeta>;
  folderIcons: Record<string, string>;
  viewMode: ViewMode;
  /** Resolved light/dark currently applied */
  theme: ThemeMode;
  /** User preference; missing → treat as theme (legacy) */
  themePref?: ThemePref;
  /** Color preset id or #hex; missing → neutral */
  accent?: string;
  /** UI language; missing → detect from browser on load */
  locale?: Locale;
  activeFolderId?: string;
  /** Smart filter when viewing 全部目录 */
  activeTagId?: string;
  expandedFolderIds: string[];
  /** Sidebar width in px; missing → default */
  sidebarWidthPx?: number;
  /** List sort rule; missing → default */
  sortMode?: SortMode;
  /** Sort direction; missing → sensible default per mode */
  sortDir?: SortDir;
}

export interface FolderNode {
  id: string;
  title: string;
  parentId?: string;
  children: FolderNode[];
  bookmarkCount: number;
  index: number;
}

export interface SiteItem {
  id: string;
  title: string;
  url: string;
  parentId: string;
  index: number;
  dateAdded?: number;
}
