/** DNS “ping”: short wait — either we get an IP or we don’t. */
const TIMEOUT_MS = 2_500;
const CONCURRENCY = 8;

const DOH_ENDPOINTS = [
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve',
] as const;

function isHttpUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

function isIpLiteral(host: string): boolean {
  // IPv4
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6 (URL hostname may be bare or already unbracketed)
  if (host.includes(':')) return true;
  return false;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

interface DohAnswer {
  name?: string;
  type?: number;
  data?: string;
}

interface DohJson {
  Status?: number;
  Answer?: DohAnswer[];
}

/** True if DNS answer contains an A (1) or AAAA (28) record → we “pinged” an IP. */
function hasAddressRecord(data: DohJson): boolean {
  return (data.Answer ?? []).some((a) => a.type === 1 || a.type === 28);
}

async function dohLookup(
  endpoint: string,
  hostname: string,
  type: 'A' | 'AAAA',
  signal: AbortSignal,
): Promise<DohJson> {
  const url = new URL(endpoint);
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', type);
  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  return (await res.json()) as DohJson;
}

/**
 * DNS ping: resolve hostname → IP.
 * Success with A/AAAA = alive; NXDOMAIN / no address = dead.
 */
async function dnsPingHost(
  hostname: string,
  outerSignal?: AbortSignal,
): Promise<'alive' | 'dead'> {
  const host = hostname.replace(/\.$/, '').toLowerCase();
  if (!host) return 'dead';
  if (host === 'localhost') return 'alive';
  if (isIpLiteral(host)) return 'alive';

  let sawReachableResolver = false;

  for (const endpoint of DOH_ENDPOINTS) {
    const local = new AbortController();
    const onOuter = () => local.abort();
    outerSignal?.addEventListener('abort', onOuter);
    const timer = setTimeout(() => local.abort(), TIMEOUT_MS);
    try {
      const a = await dohLookup(endpoint, host, 'A', local.signal);
      sawReachableResolver = true;
      // 0 = NOERROR
      if (a.Status === 0 && hasAddressRecord(a)) return 'alive';
      if (a.Status === 0) {
        const aaaa = await dohLookup(endpoint, host, 'AAAA', local.signal);
        if (aaaa.Status === 0 && hasAddressRecord(aaaa)) return 'alive';
      }
      // 3 = NXDOMAIN — name does not exist
      if (a.Status === 3) return 'dead';
      // NOERROR but no address (parked / empty) → dead for our purpose
      if (a.Status === 0) return 'dead';
    } catch (err) {
      if (outerSignal?.aborted) throw err;
      if (isAbortError(err) && !outerSignal?.aborted) {
        // this resolver timed out — try next
        continue;
      }
      // resolver unreachable — try next
      continue;
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener('abort', onOuter);
    }
  }

  // Could not reach any DoH resolver → do not mass-mark bookmarks dead
  if (!sawReachableResolver) return 'alive';
  return 'dead';
}

export interface ProbeSiteInput {
  id: string;
  url: string;
}

export interface ProbeProgress {
  done: number;
  total: number;
  results: Record<string, boolean>;
  deadCount: number;
}

/**
 * DNS-ping many bookmark hosts with limited concurrency.
 */
export async function probeSites(
  sites: ProbeSiteInput[],
  opts: {
    signal?: AbortSignal;
    concurrency?: number;
    onProgress?: (p: ProbeProgress) => void;
  } = {},
): Promise<{
  results: Record<string, boolean>;
  deadIds: string[];
  checked: number;
  skipped: number;
}> {
  const list = sites.filter((s) => isHttpUrl(s.url));
  const skipped = sites.length - list.length;
  const total = list.length;
  const results: Record<string, boolean> = {};
  let done = 0;
  const concurrency = Math.max(1, opts.concurrency ?? CONCURRENCY);

  // Same registrable host → one DNS lookup (big speed win)
  const hostCache = new Map<string, Promise<'alive' | 'dead'>>();

  function pingCached(hostname: string): Promise<'alive' | 'dead'> {
    const key = hostname.replace(/\.$/, '').toLowerCase();
    let p = hostCache.get(key);
    if (!p) {
      p = dnsPingHost(key, opts.signal);
      hostCache.set(key, p);
    }
    return p;
  }

  const report = () => {
    const deadCount = Object.values(results).filter((v) => v === false).length;
    opts.onProgress?.({
      done,
      total,
      results: { ...results },
      deadCount,
    });
  };

  report();
  if (total === 0) {
    return { results, deadIds: [], checked: 0, skipped };
  }

  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const i = cursor++;
      const site = list[i]!;
      try {
        const hostname = new URL(site.url).hostname;
        const result = await pingCached(hostname);
        results[site.id] = result === 'alive';
      } catch (err) {
        if (opts.signal?.aborted) throw err;
        results[site.id] = true;
      }
      done++;
      report();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, () => worker()),
  );

  const deadIds = Object.entries(results)
    .filter(([, alive]) => !alive)
    .map(([id]) => id);

  return { results, deadIds, checked: total, skipped };
}

export { isHttpUrl };
