import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  collectAllSites,
  createBookmark,
  collectFolderScopeIds,
  findFolder,
  findNodeById,
  getBookmarkTree,
  getFolderPath,
  getRootFolders,
  moveBookmark,
  normalizeUrlKey,
  removeBookmark,
  removeBookmarkTree,
  toFolderTree,
  updateBookmark,
} from '~/modules/bookmarks/chrome-api';
import {
  applyTheme,
  createEmptyOverlay,
  getSiteMeta,
  loadOverlay,
  patchSiteMeta,
  pruneRemovedSites,
  saveOverlay,
  setActive,
  setLocale as setOverlayLocale,
  setFolderIcon,
  SIDEBAR_WIDTH_DEFAULT,
  setThemePref,
  setAccent,
  setViewMode,
  setSortMode,
  setSortDir,
  defaultSortDirFor,
  toIdList,
} from '~/modules/bookmarks/overlay';
import {
  DEFAULT_ACCENT,
  resolveThemePref,
  type ThemePref,
} from '~/modules/bookmarks/appearance';
import {
  locale as localeRef,
  setLocale,
  t,
} from '~/modules/i18n';
import type {
  BookmarkOverlay,
  Locale,
  SiteItem,
  SortDir,
  SortMode,
  ViewMode,
} from '~/modules/bookmarks/types';
import { FOLDER_ALL, FOLDER_HOME, TAG_ALL, isVirtualFolderId } from '~/modules/bookmarks/types';
import {
  clearAllUserBookmarks,
  dedupeSitesByUrl,
  previewDedupeByUrl,
  exportTreeToSites,
  filterAndSortSites,
  getDefaultImportParentId,
  importParsedTree,
  moveSiteToFolder,
  recordVisit,
  reorderSite,
  toggleFavorite,
} from '~/modules/bookmarks/ops';
import { groupByDomain, groupByName } from '~/modules/bookmarks/arrange';
import type { ArrangeGroup, ArrangeKind } from '~/modules/bookmarks/arrange';
import { probeSites, isHttpUrl } from '~/modules/bookmarks/probe';
import {
  downloadTextFile,
  parseNetscapeBookmarks,
  pickHtmlFile,
  serializeNetscapeBookmarks,
} from '~/modules/bookmarks/netscape';

export function useBookmarks() {
  const tree = ref<Browser.bookmarks.BookmarkTreeNode[]>([]);
  const overlay = ref<BookmarkOverlay>(createEmptyOverlay());
  const search = ref('');
  const loading = ref(true);
  const arrangeKind = ref<ArrangeKind>('none');
  const batchMode = ref(false);
  const probeMode = ref(false);
  const probing = ref(false);
  const probeDone = ref(0);
  const probeTotal = ref(0);
  /** siteId → alive; absent = not yet probed */
  const siteAlive = ref<Record<string, boolean>>({});
  let probeAbort: AbortController | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const selectedIds = ref<Set<string>>(new Set());
  const statusMessage = ref('');

  const folderTrees = computed(() =>
    getRootFolders(tree.value).map(toFolderTree),
  );

  const allSites = computed(() => collectAllSites(tree.value));

  const activeFolderId = computed(
    () => overlay.value.activeFolderId ?? FOLDER_HOME,
  );
  const activeTagId = computed(() => overlay.value.activeTagId ?? TAG_ALL);
  const viewMode = computed(() => overlay.value.viewMode);
  const theme = computed(() => overlay.value.theme ?? 'dark');
  const themePref = computed<ThemePref>(
    () => overlay.value.themePref ?? overlay.value.theme ?? 'system',
  );
  const accent = computed(() => overlay.value.accent ?? DEFAULT_ACCENT);

  const locale = computed(() => overlay.value.locale ?? localeRef.value);

  const activeFolderTitle = computed(() => {
    if (activeFolderId.value === FOLDER_HOME) return t('sidebar.home');
    if (activeFolderId.value === FOLDER_ALL) return t('sidebar.allFolders');
    return (
      findFolder(folderTrees.value, activeFolderId.value)?.title ??
      t('main.folderFallback')
    );
  });

  const childFolders = computed(() => {
    if (isVirtualFolderId(activeFolderId.value)) return [];
    const node = findFolder(folderTrees.value, activeFolderId.value);
    return node?.children ?? [];
  });

  const activeFolderScopeIds = computed(() => {
    if (isVirtualFolderId(activeFolderId.value)) return undefined;
    const node = findFolder(folderTrees.value, activeFolderId.value);
    if (!node) return new Set([activeFolderId.value]);
    return collectFolderScopeIds(node);
  });

  const baseVisibleSites = computed(() =>
    filterAndSortSites(allSites.value, overlay.value, {
      folderId: activeFolderId.value,
      folderScopeIds: activeFolderScopeIds.value,
      tagId: activeTagId.value,
      search: search.value,
      skipSort: arrangeKind.value !== 'none' || probing.value,
      sortMode: overlay.value.sortMode ?? 'default',
      sortDir: overlay.value.sortDir ?? 'asc',
    }),
  );

  const sortMode = computed(() => overlay.value.sortMode ?? 'default');
  const sortDir = computed(() => overlay.value.sortDir ?? 'asc');

  async function changeSortMode(mode: SortMode) {
    await persist((o) => setSortMode(o, mode, defaultSortDirFor(mode)));
  }

  async function changeSortDir(dir: SortDir) {
    await persist((o) => setSortDir(o, dir));
  }

  const arrangeGroups = computed((): ArrangeGroup[] => {
    if (arrangeKind.value === 'domain') {
      return groupByDomain(baseVisibleSites.value);
    }
    if (arrangeKind.value === 'name') {
      return groupByName(baseVisibleSites.value);
    }
    return [];
  });

  const visibleSites = computed(() => {
    if (arrangeKind.value !== 'none') {
      return arrangeGroups.value.flatMap((g) => g.sites);
    }
    const base = baseVisibleSites.value;
    if (probeMode.value && !probing.value) {
      return base.filter((s) => siteAlive.value[s.id] === false);
    }
    return base;
  });

  const arranging = computed(() => arrangeKind.value !== 'none');
  const probeDeadCount = computed(
    () => Object.values(siteAlive.value).filter((v) => v === false).length,
  );

  function exitArrange() {
    arrangeKind.value = 'none';
  }

  function exitProbe() {
    if (probeAbort) {
      probeAbort.abort();
      probeAbort = null;
    }
    probeMode.value = false;
    probing.value = false;
    probeDone.value = 0;
    probeTotal.value = 0;
    siteAlive.value = {};
  }

  /** `true` alive, `false` dead, `null` not probed yet */
  function siteAliveState(id: string): boolean | null {
    if (!probeMode.value) return null;
    const v = siteAlive.value[id];
    return v === undefined ? null : v;
  }

  const totalBookmarkCount = computed(() => allSites.value.length);

  /** Serialize overlay writes — concurrent persist used to drop visit bumps. */
  let overlayWrite: Promise<void> = Promise.resolve();

  function writeOverlay(
    job: (prev: BookmarkOverlay) => BookmarkOverlay | Promise<BookmarkOverlay>,
  ): Promise<void> {
    const run = overlayWrite.then(async () => {
      const next = await job(overlay.value);
      overlay.value = next;
      await saveOverlay(next);
    });
    overlayWrite = run.catch(() => undefined);
    return run;
  }

  function persist(update: (prev: BookmarkOverlay) => BookmarkOverlay): Promise<void> {
    return writeOverlay(update);
  }

  async function refreshTree() {
    tree.value = await getBookmarkTree();
    const ids = new Set(allSites.value.map((s) => s.id));
    const rootIds = getRootFolders(tree.value).map((n) => n.id);
    await persist((prev) => {
      const expanded = new Set(toIdList(prev.expandedFolderIds));
      let changed = false;
      for (const id of rootIds) {
        if (!expanded.has(id)) {
          expanded.add(id);
          changed = true;
        }
      }
      const withExpanded = changed
        ? { ...prev, expandedFolderIds: [...expanded] }
        : prev;
      return pruneRemovedSites(withExpanded, ids);
    });
  }

  function flash(msg: string) {
    statusMessage.value = msg;
    window.setTimeout(() => {
      if (statusMessage.value === msg) statusMessage.value = '';
    }, 2200);
  }

  async function selectFolder(folderId: string) {
    exitArrange();
    exitProbe();
    selectedIds.value = new Set();

    await persist((prev) => {
      if (!isVirtualFolderId(folderId)) {
        const node = findFolder(folderTrees.value, folderId);
        const expanded = new Set(toIdList(prev.expandedFolderIds));
        const isActive = (prev.activeFolderId ?? FOLDER_HOME) === folderId;
        const isExpanded = expanded.has(folderId);

        // 再次点击已选中的父目录：收起子目录
        if (node?.children.length && isActive && isExpanded) {
          expanded.delete(folderId);
          return { ...prev, expandedFolderIds: [...expanded] };
        }
      }

      let next = setActive(prev, folderId, TAG_ALL);
      if (!isVirtualFolderId(folderId)) {
        const expanded = new Set(toIdList(next.expandedFolderIds));
        let cur = findFolder(folderTrees.value, folderId);
        while (cur) {
          expanded.add(cur.id);
          cur = cur.parentId
            ? findFolder(folderTrees.value, cur.parentId)
            : undefined;
        }
        next = { ...next, expandedFolderIds: [...expanded] };
      }
      return next;
    });
  }

  async function selectTag(tagId: string) {
    exitArrange();
    exitProbe();
    selectedIds.value = new Set();
    await persist((o) => setActive(o, o.activeFolderId ?? FOLDER_HOME, tagId));
  }

  async function changeViewMode(mode: ViewMode) {
    await persist((o) => setViewMode(o, mode));
  }

  async function changeThemePref(pref: ThemePref) {
    await persist((o) => {
      const next = setThemePref(o, pref);
      applyTheme(next.theme, next.accent ?? DEFAULT_ACCENT);
      return next;
    });
  }

  async function changeAccent(nextAccent: string) {
    await persist((o) => {
      const next = setAccent(o, nextAccent);
      applyTheme(next.theme, next.accent ?? DEFAULT_ACCENT);
      return next;
    });
  }

  async function changeLocale(next: Locale) {
    setLocale(next);
    await persist((o) => setOverlayLocale(o, next));
  }

  async function changeFolderIcon(folderId: string, icon: string | null) {
    await persist((o) => setFolderIcon(o, folderId, icon));
  }

  async function openSite(site: SiteItem) {
    // Do not lock order — visit bump must keep frequency / current sort rule applied
    await persist((o) => recordVisit(o, site.id));
    await browser.tabs.create({ url: site.url });
  }

  async function openAllInFolder(folderId: string) {
    const node = findFolder(folderTrees.value, folderId);
    if (!node) return;
    const scope = collectFolderScopeIds(node);
    const sites = allSites.value
      .filter((s) => scope.has(s.parentId))
      .sort((a, b) => a.index - b.index);
    if (!sites.length) {
      flash(t('toast.openAllEmpty'));
      return;
    }
    for (let i = 0; i < sites.length; i++) {
      await browser.tabs.create({ url: sites[i]!.url, active: i === 0 });
    }
    flash(t('toast.openAllDone', { count: sites.length }));
  }

  async function toggleSiteFavorite(siteId: string) {
    await persist((o) => toggleFavorite(o, siteId));
  }

  async function createSite(input: {
    title: string;
    url: string;
    parentId: string;
    description?: string;
  }) {
    const created = await createBookmark({
      parentId: input.parentId,
      title: input.title,
      url: input.url,
    });
    if (input.description) {
      await persist((o) =>
        patchSiteMeta(o, created.id!, {
          description: input.description,
        }),
      );
    }
    await refreshTree();
    flash(t('toast.added'));
  }

  async function editSite(
    id: string,
    changes: {
      title: string;
      url: string;
      description?: string;
      parentId?: string;
    },
  ) {
    await updateBookmark(id, { title: changes.title, url: changes.url });
    await writeOverlay(async (prev) => {
      let next = prev;
      if (changes.parentId) {
        const current = allSites.value.find((s) => s.id === id);
        if (current && current.parentId !== changes.parentId) {
          next = await moveSiteToFolder(next, id, changes.parentId);
        }
      }
      return patchSiteMeta(next, id, {
        description: changes.description,
      });
    });
    await refreshTree();
    flash(t('toast.saved'));
  }

  async function deleteSite(id: string) {
    await removeBookmark(id);
    await persist((o) => {
      const { [id]: _, ...rest } = o.siteMeta;
      return { ...o, siteMeta: rest };
    });
    await refreshTree();
  }

  async function createFolder(title: string, parentId: string) {
    await createBookmark({ parentId, title });
    await refreshTree();
    flash(t('toast.folderCreated'));
  }

  async function renameFolder(id: string, title: string) {
    await updateBookmark(id, { title });
    await refreshTree();
  }

  async function deleteFolder(id: string) {
    await removeBookmarkTree(id);
    await persist((o) => {
      const { [id]: _icon, ...folderIcons } = o.folderIcons;
      let next = { ...o, folderIcons };
      if ((o.activeFolderId ?? FOLDER_ALL) === id) {
        next = setActive(next, FOLDER_ALL, TAG_ALL);
      }
      return next;
    });
    await refreshTree();
  }

  async function onDropSiteToFolder(siteId: string, folderId: string) {
    await writeOverlay((o) => moveSiteToFolder(o, siteId, folderId));
    await refreshTree();
  }

  async function onReorderFolder(
    folderId: string,
    targetId: string,
    mode: 'before' | 'after' | 'into',
  ) {
    const target = findNodeById(tree.value, targetId);
    if (!target) return;

    let parentId: string;
    let beforeId: string | null = null;

    if (mode === 'into') {
      parentId = targetId;
    } else {
      parentId = target.parentId || '0';
      if (mode === 'before') {
        beforeId = targetId;
      } else {
        const parent = findNodeById(tree.value, parentId);
        const kids = parent?.children ?? [];
        const at = kids.findIndex((c) => c.id === targetId);
        const next = at >= 0 ? kids[at + 1] : undefined;
        beforeId =
          next && next.id !== folderId
            ? next.id
            : next
              ? (kids[at + 2]?.id ?? null)
              : null;
      }
    }

    const moved = findNodeById(tree.value, folderId);
    const parent = findNodeById(tree.value, parentId);
    const children = (parent?.children ?? []).filter((c) => c.id !== folderId);
    let index = children.length;
    if (beforeId) {
      const at = children.findIndex((c) => c.id === beforeId);
      if (at >= 0) index = at;
    }
    // Same Chrome same-parent downward quirk as site reorder
    const oldIndex = moved?.index;
    if (
      moved?.parentId === parentId &&
      typeof oldIndex === 'number' &&
      oldIndex < index
    ) {
      index += 1;
    }

    await moveBookmark(folderId, { parentId, index });
    // Nesting into a folder → keep it expanded so the move is visible
    await persist((o) => {
      const expanded = new Set(toIdList(o.expandedFolderIds));
      if (!expanded.has(parentId) && parentId !== '0') {
        expanded.add(parentId);
        return { ...o, expandedFolderIds: [...expanded] };
      }
      return o;
    });
    await refreshTree();
  }

  async function onReorderSite(
    siteId: string,
    parentId: string,
    beforeId: string | null,
  ) {
    // Chrome index is among ALL children (bookmarks + folders), not bookmarks only
    const parent = findNodeById(tree.value, parentId);
    const moved = findNodeById(tree.value, siteId);
    const children = (parent?.children ?? []).filter((c) => c.id !== siteId);
    let index = children.length;
    if (beforeId) {
      const at = children.findIndex((c) => c.id === beforeId);
      if (at >= 0) index = at;
    }
    // Same-parent move to a higher slot: Chrome treats `index` as pre-removal.
    // Without +1, "append after last" lands one slot early.
    const oldIndex = moved?.index;
    if (
      moved?.parentId === parentId &&
      typeof oldIndex === 'number' &&
      oldIndex < index
    ) {
      index += 1;
    }
    await reorderSite(siteId, parentId, index);
    await refreshTree();
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  }

  function selectAllVisible() {
    selectedIds.value = new Set(visibleSites.value.map((s) => s.id));
  }

  function clearSelection() {
    selectedIds.value = new Set();
  }

  async function batchMove(parentId: string) {
    await writeOverlay(async (prev) => {
      let next = prev;
      for (const id of selectedIds.value) {
        next = await moveSiteToFolder(next, id, parentId);
      }
      return next;
    });
    clearSelection();
    batchMode.value = false;
    await refreshTree();
    flash(t('toast.batchMoved'));
  }

  async function batchDelete() {
    const ids = [...selectedIds.value];
    for (const id of ids) {
      await removeBookmark(id);
    }
    await persist((o) => {
      const siteMeta = { ...o.siteMeta };
      for (const id of ids) delete siteMeta[id];
      return { ...o, siteMeta };
    });
    clearSelection();
    batchMode.value = false;
    await refreshTree();
    flash(t('toast.batchDeleted'));
  }

  async function batchResetVisits() {
    const ids = [...selectedIds.value];
    await persist((o) => {
      let next = o;
      for (const id of ids) {
        next = patchSiteMeta(next, id, {
          visitCount: 0,
          lastVisitedAt: undefined,
        });
      }
      return next;
    });
    flash(t('toast.visitsReset'));
  }

  async function runDedupe() {
    await writeOverlay(async (o) => {
      const { overlay: next, removed } = await dedupeSitesByUrl(o);
      flash(
        removed > 0
          ? t('toast.deduped', { count: removed })
          : t('toast.dedupeEmpty'),
      );
      return next;
    });
    await refreshTree();
  }

  async function getDedupePreview() {
    return previewDedupeByUrl();
  }

  function runArrangeByDomain() {
    exitProbe();
    const arranged = groupByDomain(baseVisibleSites.value);
    if (arranged.length === 0) {
      flash(t('toast.arrangedDomainEmpty'));
      return;
    }
    arrangeKind.value = 'domain';
    const count = arranged.reduce((n, g) => n + g.sites.length, 0);
    flash(t('toast.arrangedDomain', { count, groups: arranged.length }));
  }

  function runArrangeByName() {
    exitProbe();
    const groups = groupByName(baseVisibleSites.value);
    const clustered = groups.filter((g) => !g.residual);
    if (clustered.length === 0) {
      flash(t('toast.arrangedNameEmpty'));
      return;
    }
    arrangeKind.value = 'name';
    const count = clustered.reduce((n, g) => n + g.sites.length, 0);
    flash(t('toast.arrangedName', { count, groups: clustered.length }));
  }

  async function runProbe() {
    exitArrange();
    if (probeAbort) probeAbort.abort();
    const ac = new AbortController();
    probeAbort = ac;

    const targets = baseVisibleSites.value
      .filter((s) => isHttpUrl(s.url))
      .map((s) => ({
        id: s.id,
        url: s.url,
      }));
    if (targets.length === 0) {
      flash(t('toast.probeEmpty'));
      return;
    }

    probeMode.value = true;
    probing.value = true;
    siteAlive.value = {};
    probeDone.value = 0;
    probeTotal.value = targets.length;

    try {
      const result = await probeSites(targets, {
        signal: ac.signal,
        onProgress: (p) => {
          probeDone.value = p.done;
          probeTotal.value = p.total;
          siteAlive.value = p.results;
        },
      });
      if (ac.signal.aborted) return;
      probing.value = false;
      siteAlive.value = result.results;
      if (result.deadIds.length === 0) {
        flash(t('toast.probeAllAlive', { count: result.checked }));
        return;
      }
      flash(
        t('toast.probeDone', {
          dead: result.deadIds.length,
          checked: result.checked,
        }),
      );
    } catch (err) {
      if (ac.signal.aborted) return;
      probing.value = false;
      flash(t('toast.probeFailed'));
      console.error('[BookMyMark] probe failed', err);
    } finally {
      if (probeAbort === ac) probeAbort = null;
    }
  }

  async function runImport() {
    const html = await pickHtmlFile();
    if (!html) return;
    const parsed = parseNetscapeBookmarks(html);
    const existing = new Set(
      allSites.value.map((s) => s.url).map(normalizeUrlKey),
    );
    const parentId = getDefaultImportParentId(tree.value);
    const added = await importParsedTree(parsed, parentId, existing);
    await refreshTree();
    flash(t('toast.importDone', { count: added }));
  }

  async function runExport() {
    const { folders } = await exportTreeToSites(tree.value);
    const html = serializeNetscapeBookmarks(folders);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`bookmymark-${stamp}.html`, html);
    flash(t('toast.exported'));
  }

  async function runClearAll() {
    await clearAllUserBookmarks();
    await persist((o) => {
      const next = {
        ...createEmptyOverlay(),
        themePref: o.themePref,
        theme: o.theme,
        accent: o.accent,
        locale: o.locale,
        sidebarWidthPx: o.sidebarWidthPx ?? SIDEBAR_WIDTH_DEFAULT,
      };
      applyTheme(next.theme, next.accent);
      setLocale(next.locale ?? 'zh');
      return next;
    });
    await refreshTree();
    flash(t('toast.cleared'));
  }

  function folderPathFor(parentId: string): string {
    return getFolderPath(folderTrees.value, parentId) || t('card.unknownFolder');
  }

  function onBookmarkChanged() {
    if (refreshTimer != null) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refreshTree();
    }, 180);
  }

  onMounted(async () => {
    overlay.value = await loadOverlay();
    applyTheme(overlay.value.theme, overlay.value.accent ?? DEFAULT_ACCENT);
    setLocale(overlay.value.locale ?? localeRef.value);
    await refreshTree();
    loading.value = false;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => {
      if ((overlay.value.themePref ?? 'system') !== 'system') return;
      const resolved = resolveThemePref('system');
      if (resolved === overlay.value.theme) return;
      void persist((o) => {
        if ((o.themePref ?? 'system') !== 'system' || o.theme === resolved) return o;
        const next = { ...o, theme: resolved };
        applyTheme(resolved, next.accent ?? DEFAULT_ACCENT);
        return next;
      });
    };
    mq.addEventListener('change', onScheme);
    schemeCleanup = () => mq.removeEventListener('change', onScheme);

    browser.bookmarks.onCreated.addListener(onBookmarkChanged);
    browser.bookmarks.onRemoved.addListener(onBookmarkChanged);
    browser.bookmarks.onChanged.addListener(onBookmarkChanged);
    browser.bookmarks.onMoved.addListener(onBookmarkChanged);
  });

  let schemeCleanup: (() => void) | null = null;

  onUnmounted(() => {
    if (refreshTimer != null) clearTimeout(refreshTimer);
    if (probeAbort) probeAbort.abort();
    schemeCleanup?.();
    browser.bookmarks.onCreated.removeListener(onBookmarkChanged);
    browser.bookmarks.onRemoved.removeListener(onBookmarkChanged);
    browser.bookmarks.onChanged.removeListener(onBookmarkChanged);
    browser.bookmarks.onMoved.removeListener(onBookmarkChanged);
  });

  watch(search, () => {
    exitArrange();
    exitProbe();
    clearSelection();
  });

  return {
    overlay,
    search,
    loading,
    batchMode,
    selectedIds,
    statusMessage,
    folderTrees,
    activeFolderId,
    activeTagId,
    viewMode,
    sortMode,
    sortDir,
    theme,
    themePref,
    accent,
    locale,
    activeFolderTitle,
    childFolders,
    visibleSites,
    arrangeKind,
    arrangeGroups,
    arranging,
    exitArrange,
    probeMode,
    probing,
    probeDone,
    probeTotal,
    probeDeadCount,
    exitProbe,
    siteAliveState,
    runProbe,
    totalBookmarkCount,
    selectFolder,
    selectTag,
    changeViewMode,
    changeSortMode,
    changeSortDir,
    changeThemePref,
    changeAccent,
    changeLocale,
    openSite,
    openAllInFolder,
    toggleSiteFavorite,
    createSite,
    editSite,
    deleteSite,
    createFolder,
    renameFolder,
    deleteFolder,
    changeFolderIcon,
    onDropSiteToFolder,
    onReorderFolder,
    onReorderSite,
    toggleSelect,
    selectAllVisible,
    clearSelection,
    batchMove,
    batchDelete,
    batchResetVisits,
    runDedupe,
    getDedupePreview,
    runArrangeByDomain,
    runArrangeByName,
    runImport,
    runExport,
    runClearAll,
    getSiteMeta: (id: string) => getSiteMeta(overlay.value, id),
    folderPathFor,
    patchOverlay: persist,
  };
}
