import type { FolderNode, SiteItem } from './types';

export async function getBookmarkTree(): Promise<Browser.bookmarks.BookmarkTreeNode[]> {
  return browser.bookmarks.getTree();
}

export async function createBookmark(
  details: Browser.bookmarks.CreateDetails,
): Promise<Browser.bookmarks.BookmarkTreeNode> {
  return browser.bookmarks.create(details);
}

export async function updateBookmark(
  id: string,
  changes: { title?: string; url?: string },
): Promise<Browser.bookmarks.BookmarkTreeNode> {
  return browser.bookmarks.update(id, changes);
}

export async function moveBookmark(
  id: string,
  destination: { parentId?: string; index?: number },
): Promise<Browser.bookmarks.BookmarkTreeNode> {
  return browser.bookmarks.move(id, destination);
}

export async function removeBookmark(id: string): Promise<void> {
  return browser.bookmarks.remove(id);
}

export async function removeBookmarkTree(id: string): Promise<void> {
  return browser.bookmarks.removeTree(id);
}

export function isFolder(node: Browser.bookmarks.BookmarkTreeNode): boolean {
  return node.url == null;
}

export function isBookmark(node: Browser.bookmarks.BookmarkTreeNode): boolean {
  return typeof node.url === 'string' && node.url.length > 0;
}

/** Chrome root children: bookmarks bar / other / mobile */
export function getRootFolders(
  tree: Browser.bookmarks.BookmarkTreeNode[],
): Browser.bookmarks.BookmarkTreeNode[] {
  const root = tree[0];
  return (root?.children ?? []).filter(isFolder);
}

function countDirectBookmarks(node: Browser.bookmarks.BookmarkTreeNode): number {
  return (node.children ?? []).filter(isBookmark).length;
}

export function toFolderTree(node: Browser.bookmarks.BookmarkTreeNode): FolderNode {
  const children = (node.children ?? [])
    .filter(isFolder)
    .map(toFolderTree)
    .sort((a, b) => a.index - b.index);
  const direct = countDirectBookmarks(node);
  const nested = children.reduce((sum, child) => sum + child.bookmarkCount, 0);
  return {
    id: node.id,
    title: node.title || '未命名文件夹',
    parentId: node.parentId,
    children,
    bookmarkCount: direct + nested,
    index: node.index ?? 0,
  };
}

/** Flat folder options for SelectMenu (path labels) */
export function flattenFolderOptions(
  nodes: FolderNode[],
  prefix = '',
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const n of nodes) {
    const label = prefix ? `${prefix} / ${n.title}` : n.title;
    out.push({ value: n.id, label });
    out.push(...flattenFolderOptions(n.children, label));
  }
  return out;
}

export function findFolder(
  nodes: FolderNode[],
  id: string,
): FolderNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findFolder(n.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/** 目录自身 + 全部子孙目录 id，用于「全部」展示范围 */
export function collectFolderScopeIds(node: FolderNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectFolderScopeIds(child)) ids.add(id);
  }
  return ids;
}

/** 目录面包屑，如「书签栏 / 前端 / 动效」；找不到时返回空串 */
export function getFolderPath(nodes: FolderNode[], id: string): string {
  const walk = (list: FolderNode[], prefix: string): string | undefined => {
    for (const n of list) {
      const title = prefix ? `${prefix} / ${n.title}` : n.title;
      if (n.id === id) return title;
      const hit = walk(n.children, title);
      if (hit) return hit;
    }
    return undefined;
  };
  return walk(nodes, '') ?? '';
}

export function collectAllSites(
  tree: Browser.bookmarks.BookmarkTreeNode[],
): SiteItem[] {
  const sites: SiteItem[] = [];
  const walk = (nodes: Browser.bookmarks.BookmarkTreeNode[]) => {
    for (const n of nodes) {
      if (isBookmark(n) && n.parentId) {
        sites.push({
          id: n.id,
          title: n.title || n.url || '未命名',
          url: n.url!,
          parentId: n.parentId,
          index: n.index ?? 0,
          dateAdded: n.dateAdded,
        });
      }
      if (n.children) walk(n.children);
    }
  };
  walk(tree);
  return sites;
}

export function findNodeById(
  tree: Browser.bookmarks.BookmarkTreeNode[],
  id: string,
): Browser.bookmarks.BookmarkTreeNode | undefined {
  for (const n of tree) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNodeById(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * Dedupe / import identity key.
 * Only applies host/protocol case-folding — path, query, and hash stay intact
 * so wiki/SPA doc ids in the fragment (or path) are not treated as duplicates.
 */
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url.trim());
    u.protocol = u.protocol.toLowerCase();
    u.username = '';
    u.password = '';
    u.hostname = u.hostname.toLowerCase();
    return u.href;
  } catch {
    return url.trim();
  }
}
