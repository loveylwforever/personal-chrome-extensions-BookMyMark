import lucideIconNodes from './lucide-icon-nodes.json';

export const LUCIDE_PREFIX = 'lucide:';

export type LucideIconNode = [string, Record<string, string | number>];

export type EmojiIconCategory = {
  id: string;
  emojis: readonly string[];
};

/** Expanded emoji presets for folder icons. */
export const EMOJI_ICON_CATEGORIES: readonly EmojiIconCategory[] = [
  {
    id: 'work',
    emojis: [
      '📁', '📂', '💼', '🗂️', '📎', '📌', '📍', '🗒️', '📝', '📋',
      '📊', '📈', '📉', '🧾', '✉️', '📧', '📨', '📩', '📤', '📥',
      '🗓️', '📅', '⏰', '⏱️', '⌛', '🔔', '🏷️', '📦', '🗃️', '🗄️',
    ],
  },
  {
    id: 'tech',
    emojis: [
      '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📱', '📲', '☎️', '📞', '🔋',
      '🔌', '💾', '💿', '📀', '🧮', '🛰️', '📡', '🛜', '🌐', '🔗',
      '🔒', '🔓', '🔐', '🔑', '🛡️', '⚙️', '🛠️', '🔧', '🪛', '⚗️',
      '🧪', '🧬', '🔬', '🔭', '🧰', '🧲', '💡', '🔦', '🕯️', '🚀',
    ],
  },
  {
    id: 'media',
    emojis: [
      '🎨', '🖼️', '🎬', '🎥', '📹', '📷', '📸', '🎞️', '📽️', '🎭',
      '🎪', '🎤', '🎧', '🎵', '🎶', '🎼', '🎹', '🥁', '🎸', '🎺',
      '🎷', '🎻', '📻', '📺', '🕹️', '🎮', '👾', '🎰', '🧩', '🎯',
    ],
  },
  {
    id: 'life',
    emojis: [
      '🏠', '🏡', '🏢', '🏫', '🏥', '🏦', '🏪', '🏬', '🏭', '🏗️',
      '🛏️', '🛋️', '🚪', '🪟', '🪞', '🛒', '🛍️', '🎁', '🎈', '🎉',
      '🎊', '🎀', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '⚽', '🏀',
      '🎾', '🏐', '🎱', '🏓', '🏸', '🥊', '🧘', '🏃', '🚴', '🏊',
    ],
  },
  {
    id: 'travel',
    emojis: [
      '✈️', '🛫', '🛬', '🛩️', '🚁', '🚂', '🚆', '🚇', '🚊', '🚌',
      '🚗', '🚕', '🚙', '🚚', '🚢', '⛴️', '⛵', '🛶', '🗺️', '🧭',
      '🧳', '⛺', '🏔️', '🌋', '🏖️', '🏝️', '🗽', '🗼', '🏰', '⛩️',
      '🕌', '🛕', '🏯', '🌁', '🌃', '🌆', '🌅', '🌄', '🌌', '🌉',
    ],
  },
  {
    id: 'nature',
    emojis: [
      '🌱', '🌲', '🌳', '🌴', '🌵', '🌿', '☘️', '🍀', '🍁', '🍂',
      '🍃', '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷',
      '☀️', '🌤️', '⛅', '🌧️', '⛈️', '❄️', '🌈', '🔥', '💧', '🌊',
      '🌍', '🌎', '🌏', '🌑', '🌕', '⭐', '🌟', '✨', '⚡', '☁️',
    ],
  },
  {
    id: 'food',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒',
      '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🌶️', '🌽', '🥕',
      '🍞', '🧀', '🍳', '🥞', '🧇', '🥓', '🍔', '🍟', '🍕', '🌭',
      '🥪', '🌮', '🍣', '🍜', '🍝', '🍲', '🥗', '🍿', '🍩', '🍪',
      '🎂', '🍰', '🧁', '🍦', '☕', '🍵', '🧃', '🥤', '🍺', '🍷',
    ],
  },
  {
    id: 'smile',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉',
      '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛',
      '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪',
      '😴', '😷', '🤒', '🤕', '🤢', '🥵', '🥶', '🥴', '🤯', '🤠',
      '🥳', '😎', '🤓', '🧐', '😕', '😟', '😮', '😯', '😲', '😳',
      '🥺', '😢', '😭', '😱', '😖', '😞', '😓', '😩', '😫', '🥱',
    ],
  },
  {
    id: 'symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✅', '❌',
      '⭕', '❗', '❓', '‼️', '⁉️', '💯', '💢', '💤', '💠', '♻️',
      '⚠️', '🚫', '🔞', '🆕', '🆙', '🆒', '🆓', '🆗', '🆔', '🆚',
      '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶',
      '🔷', '🔸', '🔹', '🔺', '🔻', '♠️', '♥️', '♦️', '♣️', '🃏',
      '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗',
    ],
  },
] as const;

/** Shown first on the Lucide tab before searching. */
export const LUCIDE_POPULAR_IDS = [
  'folder', 'folder-open', 'folder-heart', 'folder-git-2', 'folder-code', 'folder-cog', 'folders',
  'bookmark', 'bookmark-check', 'bookmark-plus', 'book-marked', 'book-open', 'book-open-text', 'library',
  'notebook', 'notebook-pen', 'sticky-note', 'file', 'file-text', 'files', 'clipboard', 'clipboard-list',
  'list', 'list-todo', 'list-checks', 'layout-grid', 'layout-dashboard', 'panels-top-left', 'app-window',
  'box', 'package', 'archive', 'inbox', 'mail', 'mails', 'send', 'message-square', 'messages-square',
  'phone', 'smartphone', 'tablet', 'monitor', 'laptop', 'keyboard', 'cpu', 'hard-drive', 'database', 'server',
  'cloud', 'cloud-download', 'cloud-upload', 'wifi', 'globe', 'earth', 'map', 'map-pin', 'map-pinned',
  'compass', 'navigation', 'house', 'building-2', 'building', 'store', 'briefcase', 'wallet', 'credit-card',
  'landmark', 'graduation-cap', 'school', 'pencil', 'pen-line', 'highlighter', 'eraser', 'scissors',
  'paintbrush', 'palette', 'image', 'images', 'camera', 'video', 'film', 'clapperboard', 'music',
  'headphones', 'mic', 'radio', 'tv', 'gamepad-2', 'puzzle', 'dice-5', 'trophy', 'medal', 'award', 'flag',
  'star', 'heart', 'sparkles', 'zap', 'flame', 'sun', 'moon', 'cloud-sun', 'umbrella', 'droplets', 'leaf',
  'flower-2', 'tree-pine', 'mountain', 'waves', 'fish', 'bird', 'cat', 'dog', 'coffee', 'cup-soda',
  'utensils', 'pizza', 'cake', 'apple', 'carrot', 'shopping-bag', 'shopping-cart', 'gift', 'party-popper',
  'plane', 'car', 'bike', 'ship', 'train-front', 'bus', 'rocket', 'timer', 'clock', 'calendar',
  'calendar-days', 'alarm-clock', 'bell', 'bell-ring', 'search', 'list-filter', 'settings', 'settings-2',
  'sliders-horizontal', 'wrench', 'hammer', 'cog', 'lock', 'lock-keyhole', 'key', 'key-round', 'shield',
  'shield-check', 'eye', 'eye-off', 'user', 'users', 'user-round', 'contact', 'id-card', 'badge-check',
  'circle-check', 'circle-alert', 'triangle-alert', 'info', 'lightbulb', 'brain', 'bot', 'code', 'code-xml',
  'terminal', 'braces', 'binary', 'git-branch', 'git-merge', 'github', 'gitlab', 'chrome', 'figma', 'layers',
  'component', 'blocks', 'workflow', 'chart-column', 'chart-line', 'chart-pie', 'activity', 'trending-up',
  'trending-down', 'percent', 'hash', 'at-sign', 'link', 'link-2', 'paperclip', 'pin', 'tag', 'tags',
  'qr-code', 'printer', 'download', 'upload', 'share-2', 'external-link', 'refresh-cw', 'rotate-cw',
  'play', 'pause', 'volume-2', 'battery-charging', 'plug', 'bluetooth', 'usb', 'cable', 'router', 'antenna',
  'satellite-dish', 'radar', 'crosshair', 'focus', 'aperture', 'atom', 'dna', 'microscope', 'flask-conical',
  'test-tube', 'pill', 'syringe', 'stethoscope', 'heart-pulse', 'dumbbell', 'footprints', 'accessibility',
  'baby', 'smile', 'laugh', 'annoyed', 'frown', 'meh', 'ghost', 'skull', 'swords', 'tent', 'backpack',
  'luggage', 'ticket', 'drama', 'podcast', 'rss', 'newspaper', 'scroll-text', 'signature', 'stamp', 'scale',
  'gavel', 'hospital', 'hotel', 'factory', 'warehouse', 'truck', 'sailboat', 'anchor', 'fuel', 'traffic-cone',
  'construction', 'door-open', 'sofa', 'bath', 'lamp', 'fan', 'thermometer', 'gauge', 'watch', 'hourglass',
  'history', 'megaphone', 'speaker', 'captions', 'languages', 'message-circle', 'mail-open', 'coins',
  'banknote', 'piggy-bank', 'receipt', 'calculator', 'kanban', 'goal', 'target', 'crown', 'gem',
  'thumbs-up', 'thumbs-down', 'wand-sparkles', 'rabbit', 'squirrel', 'turtle', 'bug', 'paw-print', 'bone',
  'toy-brick', 'cuboid', 'drafting-compass', 'ruler', 'paint-bucket', 'brush', 'pen-tool', 'route',
  'signpost', 'telescope', 'binoculars', 'zoom-in', 'zoom-out', 'hand-heart', 'heart-handshake', 'handshake',
  'sparkle', 'sprout', 'trees', 'cooking-pot', 'chef-hat', 'wine', 'beer', 'cookie', 'salad', 'soup',
  'sandwich', 'hamburger', 'egg', 'wheat', 'anvil',
] as const;

const NODES = lucideIconNodes as unknown as Record<string, LucideIconNode[]>;
const LUCIDE_FOLDER_ICON_IDS = Object.keys(NODES).sort();
const LUCIDE_ID_SET = new Set<string>(LUCIDE_FOLDER_ICON_IDS);

export function isLucideFolderIcon(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(LUCIDE_PREFIX));
}

export function lucideIdFromValue(value: string): string {
  return value.slice(LUCIDE_PREFIX.length);
}

export function toLucideFolderIcon(id: string): string {
  return `${LUCIDE_PREFIX}${id}`;
}

export function isKnownLucideId(id: string): boolean {
  return id in NODES || LUCIDE_ID_SET.has(id);
}

export function getLucideIconNodes(id: string): LucideIconNode[] | null {
  return NODES[id] ?? null;
}

export function firstGrapheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return [...seg.segment(trimmed)][0]?.segment ?? trimmed.slice(0, 8);
    }
  } catch {
    /* ignore */
  }
  return [...trimmed][0] ?? '';
}

export function filterLucideIds(query: string, limit = 200): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...new Set(LUCIDE_POPULAR_IDS.filter((id) => id in NODES))].slice(0, limit);
  }
  const out: string[] = [];
  for (const id of LUCIDE_FOLDER_ICON_IDS) {
    if (!(id in NODES) || !id.includes(q)) continue;
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}
