const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

const CACHE_TTL_MS = 5 * 60 * 1000;

export type NetRegion = 'cn' | 'global';

type Endpoint = {
  url: string;
  parse: (body: string) => string;
};

function extractIpv4(text: string): string {
  const match = text.match(
    /(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)/,
  );
  return match?.[0] ?? '';
}

const ENDPOINTS: Record<NetRegion, Endpoint[]> = {
  cn: [
    { url: 'https://ip.3322.net/', parse: (body) => body.trim() },
    { url: 'https://myip.ipip.net/', parse: extractIpv4 },
    { url: 'https://ddns.oray.com/checkip', parse: extractIpv4 },
    {
      url: 'https://whois.pconline.com.cn/ipJson.jsp?json=true',
      parse: (body) => {
        try {
          return String((JSON.parse(body.trim()) as { ip?: unknown }).ip ?? '');
        } catch {
          return extractIpv4(body);
        }
      },
    },
  ],
  global: [
    {
      url: 'https://api.ipify.org?format=json',
      parse: (body) => String((JSON.parse(body) as { ip?: unknown }).ip ?? ''),
    },
    { url: 'https://ipv4.icanhazip.com/', parse: (body) => body.trim() },
    { url: 'https://ifconfig.me/ip', parse: (body) => body.trim() },
  ],
};

const cache = new Map<NetRegion, { ip: string; at: number }>();
const inflight = new Map<NetRegion, Promise<string>>();

function isIpv4(value: string): boolean {
  return IPV4.test(value.trim());
}

/** Lightweight default: mainland China timezone / zh-CN → domestic sources. */
export function guessNetRegion(): NetRegion {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Kashgar)/i.test(tz)) {
      return 'cn';
    }
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const lang = (navigator.language || '').toLowerCase();
    if (lang === 'zh-cn' || lang === 'zh-hans' || lang.startsWith('zh-hans-')) {
      return 'cn';
    }
  }
  return 'global';
}

async function fetchFrom(endpoint: Endpoint, signal?: AbortSignal): Promise<string> {
  const res = await fetch(endpoint.url, {
    method: 'GET',
    cache: 'no-store',
    signal,
    headers: { Accept: 'text/plain, application/json, */*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ip = endpoint.parse(await res.text()).trim();
  if (!isIpv4(ip)) throw new Error('invalid ipv4');
  return ip;
}

export async function fetchPublicIp(options: {
  region: NetRegion;
  force?: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const { region, force = false, signal } = options;
  const now = Date.now();
  const hit = cache.get(region);
  if (!force && hit && now - hit.at < CACHE_TTL_MS) return hit.ip;

  const pending = inflight.get(region);
  if (!force && pending) return pending;

  const task = (async () => {
    let lastError: unknown;
    for (const endpoint of ENDPOINTS[region]) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const ip = await fetchFrom(endpoint, signal);
        cache.set(region, { ip, at: Date.now() });
        return ip;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('ip lookup failed');
  })();

  inflight.set(region, task);
  try {
    return await task;
  } finally {
    inflight.delete(region);
  }
}
