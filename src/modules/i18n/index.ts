import { ref } from 'vue';
import {
  isLocale,
  messages,
  type Locale,
  type MessageKey,
} from './messages';

export type { Locale, MessageKey };
export { isLocale };

const BROWSER_PREFIX: { prefix: string; locale: Locale }[] = [
  { prefix: 'zh', locale: 'zh' },
  { prefix: 'ja', locale: 'ja' },
  { prefix: 'ko', locale: 'ko' },
  { prefix: 'ru', locale: 'ru' },
  { prefix: 'fr', locale: 'fr' },
  { prefix: 'hi', locale: 'hi' },
];

export function detectBrowserLocale(): Locale {
  const candidates =
    typeof navigator !== 'undefined'
      ? [navigator.language, ...(navigator.languages ?? [])]
      : [];
  for (const raw of candidates) {
    const lang = (raw || '').toLowerCase();
    for (const { prefix, locale } of BROWSER_PREFIX) {
      if (lang === prefix || lang.startsWith(`${prefix}-`)) return locale;
    }
  }
  return 'en';
}

export const locale = ref<Locale>(detectBrowserLocale());

export function setLocale(next: Locale) {
  locale.value = next;
}

export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  return tLocale(locale.value, key, params);
}

export function tLocale(
  loc: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const dict = messages[loc] ?? messages.en;
  let text = dict[key] ?? messages.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Native language names for the language switcher */
export const LOCALE_OPTIONS: { id: Locale; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'ru', label: 'Русский' },
  { id: 'fr', label: 'Français' },
  { id: 'hi', label: 'हिन्दी' },
];

export function localeNativeName(current: Locale = locale.value): string {
  return LOCALE_OPTIONS.find((o) => o.id === current)?.label ?? current;
}
