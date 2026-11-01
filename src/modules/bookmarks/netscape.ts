import type { ExportFolder, ParsedFolder } from './ops';

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
  const m = attrs.match(re);
  if (m?.[1] != null) return decodeEntities(m[1]);
  const re2 = new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i');
  const m2 = attrs.match(re2);
  return m2?.[1] != null ? decodeEntities(m2[1]) : null;
}

export function parseNetscapeBookmarks(html: string): ParsedFolder {
  const root: ParsedFolder = { name: 'root', bookmarks: [], children: [] };
  const stack: ParsedFolder[] = [root];

  const re =
    /<\/?DL\b[^>]*>|<\/?DT\b[^>]*>|<H3\b([^>]*)>([\s\S]*?)<\/H3>|<A\b([^>]*)>([\s\S]*?)<\/A>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const token = match[0];
    const lower = token.toLowerCase();

    if (lower.startsWith('<dl')) continue;
    if (lower.startsWith('</dl')) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (lower.startsWith('<dt') || lower.startsWith('</dt')) continue;

    if (lower.startsWith('<h3')) {
      const name =
        decodeEntities((match[2] || '').replace(/<[^>]+>/g, '').trim()) ||
        '未命名文件夹';
      const folder: ParsedFolder = { name, bookmarks: [], children: [] };
      stack[stack.length - 1]!.children.push(folder);
      stack.push(folder);
      continue;
    }

    if (lower.startsWith('<a')) {
      const href = getAttr(match[3] || '', 'HREF');
      if (!href || /^javascript:/i.test(href) || /^place:/i.test(href)) continue;
      const title =
        decodeEntities((match[4] || '').replace(/<[^>]+>/g, '').trim()) || href;
      stack[stack.length - 1]!.bookmarks.push({ title, url: href });
    }
  }

  return root;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBookmark(
  site: { title: string; url: string },
  indent: number,
): string {
  const pad = ' '.repeat(indent);
  const addDate = Math.floor(Date.now() / 1000);
  return `${pad}<DT><A HREF="${escapeHtml(site.url)}" ADD_DATE="${addDate}">${escapeHtml(site.title || site.url)}</A>`;
}

function renderFolder(folder: ExportFolder, indent: number): string[] {
  const pad = ' '.repeat(indent);
  const now = Math.floor(Date.now() / 1000);
  const lines: string[] = [
    `${pad}<DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escapeHtml(folder.name)}</H3>`,
    `${pad}<DL><p>`,
  ];
  for (const bm of folder.bookmarks) {
    lines.push(renderBookmark(bm, indent + 4));
  }
  for (const child of folder.children) {
    lines.push(...renderFolder(child, indent + 4));
  }
  lines.push(`${pad}</DL><p>`);
  return lines;
}

export function serializeNetscapeBookmarks(folders: ExportFolder[]): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const folder of folders) {
    lines.push(...renderFolder(folder, 4));
  }
  lines.push('</DL><p>');
  return `${lines.join('\n')}\n`;
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickHtmlFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve(await file.text());
    };
    input.click();
  });
}
