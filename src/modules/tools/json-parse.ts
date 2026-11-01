/**
 * Parse JSON that may be wrapped or nested as escaped strings.
 * Standard JSON.parse only understands one encoding layer; pasted logs often
 * have `\"` / `\\n` inside string fields that are themselves JSON.
 */

const MAX_LAYERS = 8;
const MAX_DEPTH = 10;

export type ParsedJson =
  | { ok: true; value: unknown; changed: boolean }
  | { ok: false; error: string };

const ESCAPE_CHARS: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

function strip(text: string): string {
  let s = text.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  return s;
}

function isStructured(value: unknown): boolean {
  return Array.isArray(value) || (!!value && typeof value === 'object');
}

function tryNative(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Decode one layer of JSON string escapes. Invalid sequences are left intact. */
export function decodeJsonEscapes(body: string): string | null {
  if (!body.includes('\\')) return null;
  let out = '';
  let changed = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) {
      out += '\\';
      break;
    }
    if (next === 'u') {
      const hex = body.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        out += '\\';
        continue;
      }
      let unit = `\\u${hex}`;
      let jump = 5;
      const code = Number.parseInt(hex, 16);
      if (code >= 0xd800 && code <= 0xdbff && body.slice(i + 6, i + 8) === '\\u') {
        const hex2 = body.slice(i + 8, i + 12);
        if (/^[0-9a-fA-F]{4}$/.test(hex2)) {
          unit += `\\u${hex2}`;
          jump = 11;
        }
      }
      const decoded = tryNative(`"${unit}"`);
      if (!decoded.ok || typeof decoded.value !== 'string') {
        out += '\\';
        continue;
      }
      out += decoded.value;
      i += jump;
      changed = true;
      continue;
    }
    const mapped = ESCAPE_CHARS[next];
    if (mapped === undefined) {
      out += '\\';
      continue;
    }
    out += mapped;
    i += 1;
    changed = true;
  }
  return changed ? out : null;
}

function peel(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"')) {
    const parsed = tryNative(trimmed);
    if (parsed.ok && typeof parsed.value === 'string' && parsed.value !== trimmed) {
      return parsed.value;
    }
  }
  return decodeJsonEscapes(trimmed);
}

function parseRaw(text: string): { value: unknown; peeled: boolean } | { error: string } {
  let cur = strip(text);
  if (!cur) return { value: null, peeled: false };
  let peeled = false;
  let lastError = 'Invalid JSON';
  for (let layer = 0; layer <= MAX_LAYERS; layer++) {
    const hit = tryNative(cur);
    if (hit.ok) {
      if (typeof hit.value === 'string') {
        const inner = hit.value.trim();
        const nested =
          inner.startsWith('{') ||
          inner.startsWith('[') ||
          (inner.startsWith('"') && /[{[]/.test(inner));
        if (nested && inner !== cur) {
          cur = inner;
          peeled = true;
          continue;
        }
      }
      return { value: hit.value, peeled };
    }
    lastError = hit.error;
    const next = peel(cur);
    if (!next || next === cur) return { error: lastError };
    cur = next;
    peeled = true;
  }
  return { error: lastError };
}

function looksLikeEncodedJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    return true;
  }
  return (
    trimmed.startsWith('\\{') ||
    trimmed.startsWith('\\[') ||
    trimmed.startsWith('\\"') ||
    /\\+"\s*[{[]/.test(trimmed)
  );
}

function expandString(
  text: string,
  depth: number,
): { value: unknown; changed: boolean } {
  if (depth > MAX_DEPTH || !looksLikeEncodedJson(text)) {
    return { value: text, changed: false };
  }
  const trimmed = text.trim();
  const parsed = parseRaw(trimmed);
  if ('value' in parsed && isStructured(parsed.value)) {
    const inner = expandValue(parsed.value, depth + 1);
    return { value: inner.value, changed: true };
  }
  if (!text.includes('\\')) return { value: text, changed: false };

  let decoded = decodeJsonEscapes(text);
  for (let i = 0; decoded && decoded !== text && i < MAX_LAYERS; i++) {
    const parsedLayer = parseRaw(decoded);
    if ('value' in parsedLayer && isStructured(parsedLayer.value)) {
      const inner = expandValue(parsedLayer.value, depth + 1);
      return { value: inner.value, changed: true };
    }
    const next = decodeJsonEscapes(decoded);
    if (!next || next === decoded) break;
    decoded = next;
  }
  return { value: text, changed: false };
}

function expandValue(
  value: unknown,
  depth: number,
): { value: unknown; changed: boolean } {
  if (depth > MAX_DEPTH) return { value, changed: false };
  if (typeof value === 'string') return expandString(value, depth);
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const child = expandValue(item, depth + 1);
      if (child.changed) changed = true;
      return child.value;
    });
    return { value: changed ? next : value, changed };
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const expanded = expandValue(child, depth + 1);
      if (expanded.changed) changed = true;
      out[key] = expanded.value;
    }
    return { value: changed ? out : value, changed };
  }
  return { value, changed: false };
}

export function parseJsonText(text: string): ParsedJson {
  const trimmed = strip(text);
  if (!trimmed) return { ok: true, value: null, changed: false };
  const parsed = parseRaw(trimmed);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const expanded = expandValue(parsed.value, 0);
  return {
    ok: true,
    value: expanded.value,
    changed: parsed.peeled || expanded.changed,
  };
}

export function unescapeJsonText(text: string): string {
  const trimmed = strip(text);
  if (!trimmed) return '';
  const parsed = parseJsonText(trimmed);
  if (parsed.ok) {
    if (!parsed.changed) throw new Error('No escapes to remove');
    if (typeof parsed.value === 'string') return parsed.value;
    return JSON.stringify(parsed.value, null, 2);
  }
  const decoded = decodeJsonEscapes(trimmed);
  if (decoded && decoded !== trimmed) return decoded;
  throw new Error(parsed.error);
}
