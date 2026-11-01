import {
  collectAllSites,
  createBookmark,
  findNodeById,
  getBookmarkTree,
  isBookmark,
  isFolder,
  moveBookmark,
  normalizeUrlKey,
  removeBookmark,
  removeBookmarkTree,
} from './chrome-api';
import { getSiteMeta, patchSiteMeta, pruneRemovedSites } from './overlay';
import type { BookmarkOverlay, SiteItem, SortDir, SortMode } from './types';
import {
  FOLDER_ALL,
  FOLDER_HOME,
  TAG_FAVORITES,
  TAG_MOST,
  TAG_RECENT,
} from './types';

function compareDefault(a: SiteItem, b: SiteItem): number {
  if (a.parentId !== b.parentId) return a.parentId.localeCompare(b.parentId);
  if (a.index !== b.index) return a.index - b.index;
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function sortSitesByMode(
  sites: SiteItem[],
  overlay: BookmarkOverlay,
  sortMode: SortMode,
  sortDir: SortDir,
): SiteItem[] {
  const list = [...sites];
  const dir = sortDir === 'asc' ? 1 : -1;

  switch (sortMode) {
    case 'frequency':
      list.sort((a, b) => {
        const d =
          getSiteMeta(overlay, a.id).visitCount -
          getSiteMeta(overlay, b.id).visitCount;
        // Stable tie-break: index / title — avoids shuffle when counts are equal
        if (d !== 0) return d * dir;
        return compareDefault(a, b);
      });
      break;
    case 'alpha':
      list.sort((a, b) => {
        const d = a.title.localeCompare(b.title, undefined, {
          sensitivity: 'base',
        });
        return d !== 0 ? d * dir : compareDefault(a, b);
      });
      break;
    case 'added':
      list.sort((a, b) => {
        const d = (a.dateAdded ?? 0) - (b.dateAdded ?? 0);
        return d !== 0 ? d * dir : compareDefault(a, b);
      });
      break;
    case 'default':
    default:
      list.sort(compareDefault);
      if (dir < 0) list.reverse();
      break;
  }

  return list;
}

export function filterAndSortSites(
  sites: SiteItem[],
  overlay: BookmarkOverlay,
  opts: {
    folderId: string;
    /** 选中目录时：本目录 + 子目录下所有书签 */
    folderScopeIds?: Set<string>;
    tagId: string;
    search: string;
    /** Skip sort while arranging / probing mid-flight */
    skipSort?: boolean;
    sortMode?: SortMode;
    sortDir?: SortDir;
  },
): SiteItem[] {
  if (opts.folderId === FOLDER_HOME) return [];

  let list = sites;

  if (opts.folderId !== FOLDER_ALL) {
    const scope = opts.folderScopeIds;
    list = list.filter((s) =>
      scope ? scope.has(s.parentId) : s.parentId === opts.folderId,
    );
  }

  const q = opts.search.trim().toLowerCase();
  if (q) {
    list = list.filter((s) => {
      const meta = getSiteMeta(overlay, s.id);
      return (
        s.title.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q) ||
        (meta.description ?? '').toLowerCase().includes(q)
      );
    });
  }

  if (opts.folderId === FOLDER_ALL) {
    if (opts.tagId === TAG_FAVORITES) {
      list = list.filter((s) => getSiteMeta(overlay, s.id).favorited);
    } else if (opts.tagId === TAG_RECENT) {
      list = list.filter((s) => getSiteMeta(overlay, s.id).lastVisitedAt);
    }
  }

  if (opts.skipSort) return list;

  const mode = opts.sortMode ?? overlay.sortMode ?? 'default';
  const dir =
    opts.sortDir ??
    overlay.sortDir ??
    (mode === 'frequency' || mode === 'added' ? 'desc' : 'asc');

  // Smart tab「最常访问」always ranks by visit count
  if (opts.tagId === TAG_MOST) {
    return sortSitesByMode(list, overlay, 'frequency', 'desc');
  }
  if (opts.tagId === TAG_RECENT && mode === 'default') {
    return [...list].sort((a, b) => {
      const d =
        (getSiteMeta(overlay, b.id).lastVisitedAt ?? 0) -
        (getSiteMeta(overlay, a.id).lastVisitedAt ?? 0);
      return d !== 0 ? d : compareDefault(a, b);
    });
  }

  return sortSitesByMode(list, overlay, mode, dir);
}

export function recordVisit(
  overlay: BookmarkOverlay,
  siteId: string,
): BookmarkOverlay {
  const meta = getSiteMeta(overlay, siteId);
  return patchSiteMeta(overlay, siteId, {
    visitCount: meta.visitCount + 1,
    lastVisitedAt: Date.now(),
  });
}

export function toggleFavorite(
  overlay: BookmarkOverlay,
  siteId: string,
): BookmarkOverlay {
  const meta = getSiteMeta(overlay, siteId);
  return patchSiteMeta(overlay, siteId, { favorited: !meta.favorited });
}

export async function previewDedupeByUrl(): Promise<{
  groupCount: number;
  removeCount: number;
}> {
  const tree = await getBookmarkTree();
  const sites = collectAllSites(tree);
  const byUrl = new Map<string, number>();
  for (const s of sites) {
    const key = normalizeUrlKey(s.url);
    byUrl.set(key, (byUrl.get(key) ?? 0) + 1);
  }
  let groupCount = 0;
  let removeCount = 0;
  for (const n of byUrl.values()) {
    if (n < 2) continue;
    groupCount += 1;
    removeCount += n - 1;
  }
  return { groupCount, removeCount };
}

export async function dedupeSitesByUrl(
  overlay: BookmarkOverlay,
): Promise<{ overlay: BookmarkOverlay; removed: number }> {
  const tree = await getBookmarkTree();
  const sites = collectAllSites(tree);
  const byUrl = new Map<string, SiteItem[]>();
  for (const s of sites) {
    const key = normalizeUrlKey(s.url);
    const list = byUrl.get(key) ?? [];
    list.push(s);
    byUrl.set(key, list);
  }

  let next = overlay;
  let removed = 0;
  for (const group of byUrl.values()) {
    if (group.length < 2) continue;
    const [keep, ...dupes] = group;
    const keepMeta = getSiteMeta(next, keep!.id);
    let visitCount = keepMeta.visitCount;
    let lastVisitedAt = keepMeta.lastVisitedAt;
    let favorited = keepMeta.favorited;
    let description = keepMeta.description;

    for (const d of dupes) {
      const m = getSiteMeta(next, d.id);
      visitCount += m.visitCount;
      if ((m.lastVisitedAt ?? 0) > (lastVisitedAt ?? 0)) {
        lastVisitedAt = m.lastVisitedAt;
      }
      if (m.favorited) favorited = true;
      if (!description && m.description) description = m.description;
      await removeBookmark(d.id);
      removed += 1;
    }

    next = patchSiteMeta(next, keep!.id, {
      visitCount,
      lastVisitedAt,
      favorited,
      description,
    });
    for (const d of dupes) {
      const { [d.id]: _, ...rest } = next.siteMeta;
      next = { ...next, siteMeta: rest };
    }
  }

  const remaining = new Set((await collectFreshIds()).values());
  return { overlay: pruneRemovedSites(next, remaining), removed };
}

async function collectFreshIds(): Promise<Set<string>> {
  const tree = await getBookmarkTree();
  return new Set(collectAllSites(tree).map((s) => s.id));
}

export async function moveSiteToFolder(
  overlay: BookmarkOverlay,
  siteId: string,
  parentId: string,
  index?: number,
): Promise<BookmarkOverlay> {
  await moveBookmark(siteId, { parentId, index });
  return overlay;
}

export async function reorderSite(
  siteId: string,
  parentId: string,
  index: number,
): Promise<void> {
  await moveBookmark(siteId, { parentId, index });
}

export async function importParsedTree(
  root: ParsedFolder,
  targetParentId: string,
  existingUrls: Set<string>,
): Promise<number> {
  let added = 0;

  const importFolder = async (
    folder: ParsedFolder,
    parentId: string,
  ): Promise<void> => {
    for (const bm of folder.bookmarks) {
      const key = normalizeUrlKey(bm.url);
      if (existingUrls.has(key)) continue;
      await createBookmark({
        parentId,
        title: bm.title,
        url: bm.url,
      });
      existingUrls.add(key);
      added += 1;
    }
    for (const child of folder.children) {
      const created = await createBookmark({
        parentId,
        title: child.name,
      });
      await importFolder(child, created.id!);
    }
  };

  // Unwrap chrome wrapper roots into target
  const wrappers = new Set([
    '书签栏',
    '其他书签',
    '手机书签',
    'Bookmarks Bar',
    'Bookmarks bar',
    'Other Bookmarks',
    'Mobile Bookmarks',
  ]);

  let folders = [...root.children];
  if (folders.length > 0 && folders.every((f) => wrappers.has(f.name))) {
    for (const wrap of folders) {
      await importFolder(wrap, targetParentId);
    }
  } else {
    await importFolder(root, targetParentId);
  }

  return added;
}

export interface ParsedFolder {
  name: string;
  bookmarks: { title: string; url: string }[];
  children: ParsedFolder[];
}

export async function clearAllUserBookmarks(): Promise<void> {
  const tree = await getBookmarkTree();
  const roots = tree[0]?.children ?? [];
  for (const root of roots) {
    for (const child of [...(root.children ?? [])]) {
      if (isFolder(child)) await removeBookmarkTree(child.id);
      else if (isBookmark(child)) await removeBookmark(child.id);
    }
  }
}

export async function exportTreeToSites(
  tree: Browser.bookmarks.BookmarkTreeNode[],
): Promise<{ folders: ExportFolder[] }> {
  const roots = tree[0]?.children ?? [];
  const folders: ExportFolder[] = [];

  const walk = (
    node: Browser.bookmarks.BookmarkTreeNode,
  ): ExportFolder => {
    const bookmarks = (node.children ?? [])
      .filter(isBookmark)
      .map((c) => ({ title: c.title || c.url || '', url: c.url! }));
    const children = (node.children ?? []).filter(isFolder).map(walk);
    return { name: node.title || '未命名', bookmarks, children };
  };

  for (const root of roots) {
    folders.push(walk(root));
  }
  return { folders };
}

export interface ExportFolder {
  name: string;
  bookmarks: { title: string; url: string }[];
  children: ExportFolder[];
}

export function getDefaultImportParentId(
  tree: Browser.bookmarks.BookmarkTreeNode[],
): string {
  // Prefer bookmarks bar (usually id "1")
  const bar = findNodeById(tree, '1');
  if (bar) return bar.id;
  return tree[0]?.children?.[0]?.id ?? '1';
}
