import type { SiteItem } from './types';

export type ArrangeKind = 'none' | 'domain' | 'name';

export interface ArrangeGroup {
  id: string;
  /** Display title: domain host, or name-cluster representative */
  label: string;
  sites: SiteItem[];
  /** Leftover singletons that did not form a cluster */
  residual?: boolean;
}

/** Multi-part public suffixes we care about for bookmark hosts. */
const MULTI_TLDS = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.cn',
  'net.cn',
  'org.cn',
  'gov.cn',
  'com.au',
  'net.au',
  'org.au',
  'co.jp',
  'ne.jp',
  'or.jp',
  'co.kr',
  'com.tw',
  'com.hk',
  'com.sg',
  'co.nz',
  'com.br',
  'com.mx',
]);

/**
 * Registrable-ish domain: strip www, collapse subdomains
 * (docs.google.com → google.com, map.baidu.com → baidu.com).
 */
export function domainKey(url: string): string {
  try {
    let host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('.')) host = host.slice(0, -1);
    host = host.replace(/^www\./, '');
    if (!host || host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return host;
    }
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) return host;
    const last2 = parts.slice(-2).join('.');
    if (MULTI_TLDS.has(last2) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return last2;
  } catch {
    return '';
  }
}

function sortSitesInGroup(list: SiteItem[]): SiteItem[] {
  return [...list].sort(
    (a, b) =>
      a.title.localeCompare(b.title, 'zh-CN', { sensitivity: 'base' }) ||
      a.index - b.index,
  );
}

/**
 * Group by registrable domain; only domains with ≥2 sites.
 */
export function groupByDomain(sites: SiteItem[]): ArrangeGroup[] {
  const byHost = new Map<string, SiteItem[]>();
  for (const s of sites) {
    const host = domainKey(s.url);
    if (!host) continue;
    const list = byHost.get(host);
    if (list) list.push(s);
    else byHost.set(host, [s]);
  }

  return [...byHost.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([host, list]) => ({
      id: `domain:${host}`,
      label: host,
      sites: sortSitesInGroup(list),
    }));
}

/** Compact title for comparison: NFKC, lower, drop spaces/punct. */
function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function charBigrams(s: string): Set<string> {
  if (!s) return new Set();
  if (s.length === 1) return new Set([s]);
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function wordTokens(title: string): Set<string> {
  const parts = title
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
  return new Set(parts);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const x of smaller) if (larger.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function titleSimilarity(
  normA: string,
  normB: string,
  gramsA: Set<string>,
  gramsB: Set<string>,
  wordsA: Set<string>,
  wordsB: Set<string>,
): number {
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const [shorter, longer] =
    normA.length <= normB.length ? [normA, normB] : [normB, normA];
  if (shorter.length >= 2 && longer.startsWith(shorter)) {
    return 0.85 + 0.15 * (shorter.length / longer.length);
  }

  const gramScore = jaccard(gramsA, gramsB);
  const wordScore =
    wordsA.size > 0 && wordsB.size > 0 ? jaccard(wordsA, wordsB) : 0;
  return Math.max(gramScore, wordScore);
}

/** Shared prefix across titles (trimmed); empty if too short / useless. */
function sharedTitlePrefix(titles: string[]): string {
  if (titles.length === 0) return '';
  const trimmed = titles.map((t) => t.trim());
  let prefix = trimmed[0] ?? '';
  for (let i = 1; i < trimmed.length; i++) {
    const t = trimmed[i]!;
    let n = 0;
    const max = Math.min(prefix.length, t.length);
    while (n < max && prefix[n] === t[n]) n++;
    prefix = prefix.slice(0, n);
    if (!prefix) break;
  }
  // Drop trailing partial word / punctuation crumbs
  prefix = prefix.replace(/[\s\p{P}\p{S}]+$/u, '').trim();
  if (prefix.length < 2) return '';
  // Avoid using almost-full single-title as "shared" when others diverge early
  return prefix;
}

/** Representative label for a name cluster. */
function nameClusterLabel(sites: SiteItem[]): string {
  if (sites.length === 0) return '';
  if (sites.length === 1) return sites[0]!.title.trim() || '?';

  const shared = sharedTitlePrefix(sites.map((s) => s.title));
  if (shared.length >= 2) return shared;

  const shortest = [...sites].sort(
    (a, b) =>
      a.title.trim().length - b.title.trim().length ||
      a.title.localeCompare(b.title, 'zh-CN'),
  )[0]!;
  return shortest.title.trim() || '?';
}

/**
 * Cluster by title similarity; multi-item clusters first, singletons → residual.
 */
export function groupByName(sites: SiteItem[]): ArrangeGroup[] {
  const n = sites.length;
  if (n === 0) return [];
  if (n === 1) {
    return [
      {
        id: `name:${sites[0]!.id}`,
        label: nameClusterLabel(sites),
        sites: sites.slice(),
      },
    ];
  }

  type Row = {
    site: SiteItem;
    norm: string;
    grams: Set<string>;
    words: Set<string>;
  };

  const rows: Row[] = sites.map((site) => {
    const norm = normalizeTitle(site.title);
    return {
      site,
      norm,
      grams: charBigrams(norm),
      words: wordTokens(site.title),
    };
  });

  rows.sort(
    (a, b) =>
      a.norm.localeCompare(b.norm, 'zh-CN') ||
      a.site.title.localeCompare(b.site.title, 'zh-CN') ||
      a.site.index - b.site.index,
  );

  const parent = Uint32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    let c = i;
    while (c !== r) {
      const next = parent[c]!;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const WINDOW = 48;
  const THRESH = 0.42;

  for (let i = 0; i < n; i++) {
    const a = rows[i]!;
    for (let j = i + 1; j < n && j <= i + WINDOW; j++) {
      const b = rows[j]!;
      if (a.norm && b.norm && a.norm[0] !== b.norm[0] && j > i + 8) {
        break;
      }
      if (
        titleSimilarity(a.norm, b.norm, a.grams, b.grams, a.words, b.words) >=
        THRESH
      ) {
        union(i, j);
      }
    }
  }

  const clusters = new Map<number, SiteItem[]>();
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    const root = find(i);
    let list = clusters.get(root);
    if (!list) {
      list = [];
      clusters.set(root, list);
      order.push(root);
    }
    list.push(rows[i]!.site);
  }

  const multi: ArrangeGroup[] = [];
  const singles: SiteItem[] = [];

  for (const root of order) {
    const list = sortSitesInGroup(clusters.get(root)!);
    if (list.length >= 2) {
      const label = nameClusterLabel(list);
      multi.push({
        id: `name:${root}:${label}`,
        label,
        sites: list,
      });
    } else {
      singles.push(...list);
    }
  }

  multi.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

  if (singles.length > 0) {
    multi.push({
      id: 'name:__other__',
      label: '',
      sites: sortSitesInGroup(singles),
      residual: true,
    });
  }

  return multi;
}
