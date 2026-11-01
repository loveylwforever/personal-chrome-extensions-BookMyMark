import type { ThemeMode } from './types';

export type ThemePref = 'light' | 'dark' | 'system';

export interface ColorPreset {
  id: string;
  /** OKLCH hue 0–360 */
  hue: number;
  /** Base chroma seed */
  chroma: number;
}

/** Chrome-like NTP color seeds (approx.). First is default / closest to current UI. */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { id: 'neutral', hue: 90, chroma: 0.012 },
  { id: 'slate', hue: 250, chroma: 0.03 },
  { id: 'sky', hue: 230, chroma: 0.06 },
  { id: 'blue', hue: 255, chroma: 0.08 },
  { id: 'indigo', hue: 275, chroma: 0.08 },
  { id: 'zinc', hue: 260, chroma: 0.015 },
  { id: 'teal', hue: 185, chroma: 0.07 },
  { id: 'green', hue: 150, chroma: 0.08 },
  { id: 'sage', hue: 135, chroma: 0.05 },
  { id: 'olive', hue: 110, chroma: 0.06 },
  { id: 'orange', hue: 55, chroma: 0.1 },
  { id: 'copper', hue: 40, chroma: 0.08 },
  { id: 'rose', hue: 12, chroma: 0.08 },
  { id: 'plum', hue: 330, chroma: 0.07 },
  { id: 'purple', hue: 300, chroma: 0.09 },
] as const;

export const DEFAULT_ACCENT = 'neutral';

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function detectSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveThemePref(pref: ThemePref): ThemeMode {
  return pref === 'system' ? detectSystemTheme() : pref;
}

export function isPresetId(id: string): boolean {
  return COLOR_PRESETS.some((p) => p.id === id);
}

export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/** Expand #rgb → #rrggbb */
export function normalizeHex(hex: string): string {
  const h = hex.trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase();
  }
  return h.toLowerCase();
}

function hexToHueChroma(hex: string): { hue: number; chroma: number } {
  const n = normalizeHex(hex).slice(1);
  const r = Number.parseInt(n.slice(0, 2), 16) / 255;
  const g = Number.parseInt(n.slice(2, 4), 16) / 255;
  const b = Number.parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * lightness - 1));
  return { hue, chroma: Math.min(0.14, 0.02 + sat * 0.12) };
}

export function resolveAccent(accent: string): { hue: number; chroma: number } {
  const preset = COLOR_PRESETS.find((p) => p.id === accent);
  if (preset) return { hue: preset.hue, chroma: preset.chroma };
  if (isHexColor(accent)) return hexToHueChroma(accent);
  return { hue: 90, chroma: 0.012 };
}

function oklch(l: number, c: number, h: number, a?: number): string {
  const chroma = Math.max(0, c);
  if (a === undefined) return `oklch(${l} ${chroma} ${h})`;
  return `oklch(${l} ${chroma} ${h} / ${a})`;
}

export type AppearanceTokens = Record<string, string>;

/** Build CSS custom properties for the UI shell from mode + seed. */
export function buildAppearanceTokens(
  mode: ThemeMode,
  accent: string,
): AppearanceTokens {
  const { hue: h, chroma: baseC } = resolveAccent(accent);
  const c = baseC;

  if (mode === 'light') {
    return {
      background: oklch(0.965, c * 0.45, h),
      foreground: oklch(0.24, c * 0.35, h),
      card: oklch(0.99, c * 0.25, h, 0.68),
      'card-solid': oklch(0.985, c * 0.3, h),
      muted: oklch(0.94, c * 0.35, h, 0.72),
      'muted-foreground': oklch(0.48, c * 0.3, h),
      border: oklch(0.4, c * 0.25, h, 0.12),
      'border-soft': oklch(0.4, c * 0.25, h, 0.08),
      primary: oklch(0.4, Math.max(0.04, c * 1.35), h),
      'primary-foreground': oklch(0.98, c * 0.2, h),
      ring: oklch(0.4, c * 0.8, h, 0.28),
      danger: oklch(0.52, 0.14, 25),
      favorite: oklch(0.55, Math.max(0.05, c * 1.1), h),
      glass: oklch(0.99, c * 0.3, h, 0.62),
      'glass-strong': oklch(0.995, c * 0.25, h, 0.86),
      'glass-overlay': oklch(0.985, c * 0.3, h),
      'glass-muted': oklch(0.96, c * 0.35, h, 0.55),
      'ambient-1': oklch(0.92, c * 0.7, h, 0.55),
      'ambient-2': oklch(0.94, c * 0.5, (h + 20) % 360, 0.45),
      'ambient-3': oklch(0.93, c * 0.55, (h + 340) % 360, 0.4),
    };
  }

  return {
    background: oklch(0.2, c * 0.35, h),
    foreground: oklch(0.93, c * 0.2, h),
    card: oklch(0.26, c * 0.3, h, 0.52),
    'card-solid': oklch(0.25, c * 0.3, h),
    muted: oklch(0.3, c * 0.3, h, 0.55),
    'muted-foreground': oklch(0.72, c * 0.2, h),
    border: oklch(1, 0, 0, 0.11),
    'border-soft': oklch(1, 0, 0, 0.07),
    primary: oklch(0.78, Math.max(0.04, c * 1.15), h),
    'primary-foreground': oklch(0.18, c * 0.25, h),
    ring: oklch(0.75, c * 0.7, h, 0.3),
    danger: oklch(0.68, 0.12, 25),
    favorite: oklch(0.78, Math.max(0.05, c * 1.05), h),
    glass: oklch(0.28, c * 0.3, h, 0.55),
    'glass-strong': oklch(0.3, c * 0.28, h, 0.82),
    'glass-overlay': oklch(0.26, c * 0.3, h),
    'glass-muted': oklch(0.24, c * 0.3, h, 0.5),
    'ambient-1': oklch(0.3, c * 0.55, h, 0.45),
    'ambient-2': oklch(0.28, c * 0.4, (h + 20) % 360, 0.4),
    'ambient-3': oklch(0.26, c * 0.45, (h + 340) % 360, 0.35),
  };
}

/** Three swatch colors for the Chrome-like circle preview. */
export function accentPreviewColors(
  mode: ThemeMode,
  accent: string,
): { top: string; bottomLeft: string; bottomRight: string } {
  const { hue: h, chroma: c } = resolveAccent(accent);
  if (mode === 'light') {
    return {
      top: oklch(0.78, Math.max(0.03, c * 0.9), h),
      bottomLeft: oklch(0.42, Math.max(0.05, c * 1.3), h),
      bottomRight: oklch(0.9, c * 0.35, h),
    };
  }
  return {
    top: oklch(0.55, Math.max(0.04, c * 0.95), h),
    bottomLeft: oklch(0.32, Math.max(0.03, c * 0.7), h),
    bottomRight: oklch(0.72, Math.max(0.04, c * 1.05), h),
  };
}

const TOKEN_KEYS = [
  'background',
  'foreground',
  'card',
  'card-solid',
  'muted',
  'muted-foreground',
  'border',
  'border-soft',
  'primary',
  'primary-foreground',
  'ring',
  'danger',
  'favorite',
  'glass',
  'glass-strong',
  'glass-overlay',
  'glass-muted',
  'ambient-1',
  'ambient-2',
  'ambient-3',
] as const;

/** Instant theme + accent apply; suppress transitions for one frame. */
export function applyAppearance(mode: ThemeMode, accent: string): void {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.dataset.theme = mode;
  root.dataset.accent = isPresetId(accent) ? accent : 'custom';
  const tokens = buildAppearanceTokens(mode, accent);
  for (const key of TOKEN_KEYS) {
    const value = tokens[key];
    if (value) root.style.setProperty(`--${key}`, value);
  }
  void root.offsetHeight;
  requestAnimationFrame(() => {
    root.classList.remove('theme-switching');
  });
}
