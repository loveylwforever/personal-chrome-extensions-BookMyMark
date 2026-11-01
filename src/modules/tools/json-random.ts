export type JsonGenSize = 'S' | 'M' | 'L';

export interface JsonGenCoverage {
  string: boolean;
  number: boolean;
  boolean: boolean;
  null: boolean;
  array: boolean;
  object: boolean;
}

export interface JsonGenOptions {
  size: JsonGenSize;
  /** Nesting depth, clamped to 1–6 */
  maxDepth: number;
  coverage: JsonGenCoverage;
  root: 'object' | 'array' | 'auto';
}

export const DEFAULT_JSON_GEN: JsonGenOptions = {
  size: 'M',
  maxDepth: 3,
  coverage: {
    string: true,
    number: true,
    boolean: true,
    null: true,
    array: true,
    object: true,
  },
  root: 'object',
};

type Kind = keyof JsonGenCoverage;

interface SizeProfile {
  maxNodes: number;
  maxKeys: number;
  maxArr: number;
  strMax: number;
}

const SIZE_PROFILE: Record<JsonGenSize, SizeProfile> = {
  S: { maxNodes: 16, maxKeys: 3, maxArr: 3, strMax: 10 },
  M: { maxNodes: 48, maxKeys: 5, maxArr: 5, strMax: 18 },
  L: { maxNodes: 120, maxKeys: 8, maxArr: 8, strMax: 28 },
};

const KEYS = [
  'id',
  'name',
  'title',
  'type',
  'status',
  'value',
  'count',
  'enabled',
  'meta',
  'data',
  'items',
  'tags',
  'user',
  'email',
  'url',
  'score',
  'createdAt',
  'updatedAt',
  'config',
  'payload',
  'extra',
  'label',
  'code',
  'amount',
];

const WORDS = [
  'alpha',
  'bravo',
  'cairo',
  'delta',
  'echo',
  'flux',
  'glyph',
  'helix',
  'ion',
  'jade',
  'kite',
  'lunar',
  'moss',
  'nova',
  'orbit',
  'prism',
  'quartz',
  'raven',
  'sol',
  'tide',
];

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

function pick<T>(arr: readonly T[]): T {
  return arr[rand(arr.length)]!;
}

function enabledKinds(cov: JsonGenCoverage): Kind[] {
  return (Object.keys(cov) as Kind[]).filter((k) => cov[k]);
}

function leafKinds(cov: JsonGenCoverage): Kind[] {
  return (['string', 'number', 'boolean', 'null'] as Kind[]).filter((k) => cov[k]);
}

function containerKinds(cov: JsonGenCoverage): Kind[] {
  return (['object', 'array'] as Kind[]).filter((k) => cov[k]);
}

function makeKey(used: Set<string>): string {
  for (let i = 0; i < 12; i++) {
    const base = pick(KEYS);
    const key = i < 6 ? base : `${base}_${rand(90) + 10}`;
    if (!used.has(key)) {
      used.add(key);
      return key;
    }
  }
  const key = `k_${used.size}_${rand(999)}`;
  used.add(key);
  return key;
}

function makeString(maxLen: number): string {
  const parts = 1 + rand(Math.min(3, Math.max(1, Math.ceil(maxLen / 6))));
  let out = '';
  for (let i = 0; i < parts; i++) {
    if (i) out += ' ';
    out += pick(WORDS);
  }
  return out.slice(0, maxLen);
}

function makeNumber(): number {
  const mode = rand(4);
  if (mode === 0) return rand(1000);
  if (mode === 1) return rand(100) + Math.round(Math.random() * 100) / 100;
  if (mode === 2) return -rand(200);
  return rand(2) ? Number((Math.random() * 1e6).toFixed(0)) : Number(Math.random().toFixed(4));
}

function makeLeaf(kind: Kind, strMax: number): unknown {
  switch (kind) {
    case 'string':
      return makeString(strMax);
    case 'number':
      return makeNumber();
    case 'boolean':
      return Math.random() < 0.5;
    case 'null':
      return null;
    default:
      return makeString(strMax);
  }
}

interface Ctx {
  profile: SizeProfile;
  maxDepth: number;
  coverage: JsonGenCoverage;
  budget: { left: number };
  pending: Kind[];
}

function takePending(ctx: Ctx, allowed: Kind[]): Kind | null {
  const idx = ctx.pending.findIndex((k) => allowed.includes(k));
  if (idx < 0) return null;
  return ctx.pending.splice(idx, 1)[0]!;
}

function chooseKind(ctx: Ctx, depth: number, preferContainer: boolean): Kind {
  const leaves = leafKinds(ctx.coverage);
  const containers = containerKinds(ctx.coverage);
  const canNest = depth < ctx.maxDepth && ctx.budget.left > 1;

  const allowed: Kind[] = [
    ...leaves,
    ...(canNest && preferContainer ? containers : []),
    ...(canNest ? containers : []),
  ];
  const unique = [...new Set(allowed.length ? allowed : leaves.length ? leaves : (['string'] as Kind[]))];

  const pending = takePending(ctx, unique);
  if (pending) return pending;

  if (canNest && preferContainer && containers.length) {
    return pick(containers);
  }
  if (canNest && containers.length && Math.random() < 0.45) {
    return pick(containers);
  }
  return pick(leaves.length ? leaves : unique);
}

function genNode(ctx: Ctx, depth: number): unknown {
  ctx.budget.left -= 1;
  const preferContainer = depth === 0 || ctx.budget.left > ctx.profile.maxNodes * 0.35;
  const kind = chooseKind(ctx, depth, preferContainer);

  if (kind === 'object') {
    const used = new Set<string>();
    const n = 1 + rand(ctx.profile.maxKeys);
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < n && ctx.budget.left > 0; i++) {
      obj[makeKey(used)] = genNode(ctx, depth + 1);
    }
    return obj;
  }

  if (kind === 'array') {
    const n = 1 + rand(ctx.profile.maxArr);
    const arr: unknown[] = [];
    for (let i = 0; i < n && ctx.budget.left > 0; i++) {
      arr.push(genNode(ctx, depth + 1));
    }
    return arr;
  }

  return makeLeaf(kind, ctx.profile.strMax);
}

function resolveRoot(opts: JsonGenOptions): 'object' | 'array' {
  if (opts.root === 'object' && opts.coverage.object) return 'object';
  if (opts.root === 'array' && opts.coverage.array) return 'array';
  if (opts.coverage.object) return 'object';
  if (opts.coverage.array) return 'array';
  return 'object';
}

/** Generate a random JSON value, then pretty-print. */
export function generateRandomJson(options: Partial<JsonGenOptions> = {}): string {
  const opts: JsonGenOptions = {
    ...DEFAULT_JSON_GEN,
    ...options,
    coverage: { ...DEFAULT_JSON_GEN.coverage, ...options.coverage },
  };
  opts.maxDepth = Math.max(1, Math.min(6, Math.round(opts.maxDepth) || 1));

  const kinds = enabledKinds(opts.coverage);
  if (!kinds.length) {
    opts.coverage.string = true;
    opts.coverage.object = true;
  }

  const profile = SIZE_PROFILE[opts.size];
  const root = resolveRoot(opts);
  const pending = enabledKinds(opts.coverage).filter((k) => k !== root);

  const ctx: Ctx = {
    profile,
    maxDepth: opts.maxDepth,
    coverage: opts.coverage,
    budget: { left: profile.maxNodes },
    pending: [...pending].sort(() => Math.random() - 0.5),
  };

  // Force root container for stable tree shape.
  ctx.budget.left -= 1;
  let value: unknown;
  if (root === 'array') {
    const n = Math.max(2, 1 + rand(profile.maxArr));
    value = Array.from({ length: n }, () =>
      ctx.budget.left > 0 ? genNode(ctx, 1) : makeLeaf(pick(leafKinds(opts.coverage) || ['string']), profile.strMax),
    );
  } else {
    const used = new Set<string>();
    const n = Math.max(2, 1 + rand(profile.maxKeys));
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < n && ctx.budget.left > 0; i++) {
      obj[makeKey(used)] = genNode(ctx, 1);
    }
    // Ensure remaining coverage kinds appear at least once on the root.
    while (ctx.pending.length && ctx.budget.left > 0) {
      const k = ctx.pending.shift()!;
      const key = makeKey(used);
      if ((k === 'object' || k === 'array') && opts.maxDepth > 1) {
        ctx.pending.unshift(k);
        obj[key] = genNode(ctx, 1);
      } else if (k === 'object' || k === 'array') {
        // Can't nest further — skip container kinds.
        continue;
      } else {
        ctx.budget.left -= 1;
        obj[key] = makeLeaf(k, profile.strMax);
      }
    }
    value = obj;
  }

  return JSON.stringify(value, null, 2);
}
