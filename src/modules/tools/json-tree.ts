export function isExpandableJson(value: unknown): boolean {
  return Array.isArray(value) || (!!value && typeof value === 'object');
}

export function formatJsonPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

export function keyMatchesQuery(key: string | undefined, query: string): boolean {
  if (!key || !query.trim()) return false;
  return key.toLowerCase().includes(query.trim().toLowerCase());
}

function childPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return parent ? `${parent}[${key}]` : `[${key}]`;
  return parent ? `${parent}.${key}` : key;
}

function walkJsonFields(
  value: unknown,
  path: string,
  query: string,
  out: string[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkJsonFields(item, `${path}[${index}]`, query, out);
    });
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (key.toLowerCase().includes(query)) out.push(next);
    walkJsonFields(child, next, query, out);
  }
}

export function searchJsonFieldPathsFromValue(value: unknown, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: string[] = [];
  walkJsonFields(value, '', q, out);
  return out;
}

/** Ancestor paths for auto-expand on search, e.g. `user.items[0].id` → `user`, `user.items`, `user.items[0]`. */
export function ancestorJsonPaths(path: string): string[] {
  if (!path) return [];
  const parts: string[] = [];
  let buffer = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i]!;
    if (ch === '.') {
      if (buffer) parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  if (buffer) parts.push(buffer);

  const out: string[] = [];
  let cur = '';
  for (const part of parts) {
    cur = cur ? `${cur}.${part}` : part;
    out.push(cur);
    const arrayParent = cur.replace(/\[\d+\]$/, '');
    if (arrayParent && arrayParent !== cur) out.push(arrayParent);
  }
  return [...new Set(out)].slice(0, -1);
}

/** Nesting depth (`''` = 0, `a` = 1, `a.b[0]` = 3). */
export function jsonPathDepth(path: string): number {
  if (!path) return 0;
  let depth = 0;
  let i = 0;
  while (i < path.length) {
    if (path[i] === '.') {
      i++;
      continue;
    }
    if (path[i] === '[') {
      depth++;
      while (i < path.length && path[i] !== ']') i++;
      i++;
      continue;
    }
    depth++;
    while (i < path.length && path[i] !== '.' && path[i] !== '[') i++;
  }
  return depth;
}

export function valueAtJsonPath(root: unknown, path: string): unknown {
  if (!path) return root;
  let cur: unknown = root;
  let i = 0;
  while (i < path.length && cur != null) {
    if (path[i] === '.') {
      i++;
      continue;
    }
    if (path[i] === '[') {
      const end = path.indexOf(']', i);
      if (end < 0) return undefined;
      const index = Number(path.slice(i + 1, end));
      if (!Array.isArray(cur) || !Number.isInteger(index)) return undefined;
      cur = cur[index];
      i = end + 1;
      continue;
    }
    let end = i;
    while (end < path.length && path[end] !== '.' && path[end] !== '[') end++;
    const key = path.slice(i, end);
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
    i = end;
  }
  return cur;
}

/** All expandable paths (includes root as `''` when expandable). */
export function collectExpandablePaths(value: unknown, path = ''): string[] {
  const out: string[] = [];
  const walk = (v: unknown, p: string) => {
    if (!isExpandableJson(v)) return;
    out.push(p);
    if (Array.isArray(v)) {
      v.forEach((item, index) => walk(item, childPath(p, index)));
      return;
    }
    for (const [key, child] of Object.entries(v as Record<string, unknown>)) {
      walk(child, childPath(p, key));
    }
  };
  walk(value, path);
  return out;
}

/** Expandable descendants under a path (excludes the path itself). */
export function descendantExpandablePaths(root: unknown, path: string): string[] {
  const value = valueAtJsonPath(root, path);
  if (!isExpandableJson(value)) return [];
  return collectExpandablePaths(value, path).slice(1);
}
