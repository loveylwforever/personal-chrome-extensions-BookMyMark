export interface JsonEditorPatch {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

const INDENT = '  ';

export function isInJsonString(text: string, pos: number): boolean {
  let inString = false;
  for (let i = 0; i < pos; i++) {
    if (text[i] === '\\' && inString) {
      i++;
      continue;
    }
    if (text[i] === '"') inString = !inString;
  }
  return inString;
}

function lineStart(text: string, pos: number): number {
  let i = pos;
  while (i > 0 && text[i - 1] !== '\n') i--;
  return i;
}

function lineIndent(text: string, pos: number): string {
  const start = lineStart(text, pos);
  const m = text.slice(start, pos).match(/^(\s*)/);
  return m?.[1] ?? '';
}

function lastNonWsBefore(text: string, pos: number): string {
  for (let i = pos - 1; i >= 0; i--) {
    const c = text[i];
    if (!c || c === ' ' || c === '\t' || c === '\n') continue;
    return c;
  }
  return '';
}

function closerOnSameLineAfter(text: string, pos: number): boolean {
  const lineEnd = text.indexOf('\n', pos);
  const end = lineEnd === -1 ? text.length : lineEnd;
  return /^\s*[}\]]/.test(text.slice(pos, end));
}

function insertText(
  text: string,
  start: number,
  end: number,
  insert: string,
): JsonEditorPatch {
  const next = text.slice(0, start) + insert + text.slice(end);
  const cursor = start + insert.length;
  return { text: next, selectionStart: cursor, selectionEnd: cursor };
}

function insertWithCursor(
  text: string,
  start: number,
  end: number,
  insert: string,
  cursorOffset: number,
): JsonEditorPatch {
  const next = text.slice(0, start) + insert + text.slice(end);
  const cursor = start + cursorOffset;
  return { text: next, selectionStart: cursor, selectionEnd: cursor };
}

function emptyBlock(text: string, start: number, end: number, open: '{' | '['): JsonEditorPatch {
  const close = open === '{' ? '}' : ']';
  const indent = lineIndent(text, start);
  const insert = `${open}\n${indent}${INDENT}\n${indent}${close}`;
  const cursorOffset = 1 + 1 + indent.length + INDENT.length;
  return insertWithCursor(text, start, end, insert, cursorOffset);
}

function trySkipCloser(
  text: string,
  start: number,
  end: number,
  closer: '}' | ']' | '"',
): JsonEditorPatch | null {
  if (start !== end || text[start] !== closer) return null;
  const next = start + 1;
  return { text, selectionStart: next, selectionEnd: next };
}

function tryDeleteEmptyPair(text: string, pos: number): JsonEditorPatch | null {
  if (pos <= 0 || pos >= text.length) return null;
  const open = text[pos - 1];
  const close = text[pos];
  if (!open || !close) return null;
  const pairs: Record<string, string> = { '{': '}', '[': ']', '"': '"' };
  if (pairs[open] !== close) return null;
  if (open === '"' && isInJsonString(text, pos - 1)) return null;
  const next = text.slice(0, pos - 1) + text.slice(pos + 1);
  const cursor = pos - 1;
  return { text: next, selectionStart: cursor, selectionEnd: cursor };
}

function tryDeleteEmptyBlock(text: string, pos: number): JsonEditorPatch | null {
  const ls = lineStart(text, pos);
  const le = text.indexOf('\n', pos);
  const lineEnd = le === -1 ? text.length : le;
  const line = text.slice(ls, lineEnd);
  if (line.trim() !== '' || ls === 0 || le === -1) return null;

  const prevLineEnd = ls - 1;
  const prevLineStart = lineStart(text, prevLineEnd);
  const prevLine = text.slice(prevLineStart, prevLineEnd);
  const openMatch = prevLine.match(/([{\[])\s*$/);
  if (!openMatch?.[1]) return null;
  const openChar = openMatch[1];

  const nextLineStart = le + 1;
  const nextLineEnd = text.indexOf('\n', nextLineStart);
  const nextLine = text.slice(nextLineStart, nextLineEnd === -1 ? text.length : nextLineEnd);
  const closeMatch = nextLine.match(/^\s*([}\]])/);
  const closeChar = closeMatch?.[1];
  if (!closeChar || (openChar === '{' && closeChar !== '}') || (openChar === '[' && closeChar !== ']')) {
    return null;
  }

  const openIdx = prevLineStart + prevLine.lastIndexOf(openChar);
  const closeIdx = nextLineStart + nextLine.indexOf(closeChar);
  const next = text.slice(0, openIdx) + text.slice(closeIdx + 1);
  return { text: next, selectionStart: openIdx, selectionEnd: openIdx };
}

function indentSelection(text: string, start: number, end: number): JsonEditorPatch {
  const blockStart = lineStart(text, start);
  const before = text.slice(0, blockStart);
  const selected = text.slice(blockStart, end);
  const after = text.slice(end);
  const lines = selected.split('\n');
  const indented = lines.map((line) => INDENT + line).join('\n');
  const next = before + indented + after;
  const lineCount = lines.length;
  return {
    text: next,
    selectionStart: start + INDENT.length,
    selectionEnd: end + INDENT.length * lineCount,
  };
}

function handleEnter(text: string, start: number, end: number): JsonEditorPatch {
  const base = lineIndent(text, start);
  let insert = `\n${base}`;
  let cursorOffset = insert.length;

  const prev = lastNonWsBefore(text, start);
  if (prev === '{' || prev === '[') {
    insert += INDENT;
    cursorOffset = insert.length;
  }

  if (closerOnSameLineAfter(text, start)) {
    insert += `\n${base}`;
  }

  return insertWithCursor(text, start, end, insert, cursorOffset);
}

/** Keydown handler for JSON textarea — returns a patch when the default action should be prevented. */
export function applyJsonEditorKeydown(
  e: KeyboardEvent,
  text: string,
  start: number,
  end: number,
): JsonEditorPatch | null {
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return null;

  const key = e.key;

  if (key === 'Tab') {
    if (start !== end) return indentSelection(text, start, end);
    return insertText(text, start, end, INDENT);
  }

  if (key === 'Enter') {
    return handleEnter(text, start, end);
  }

  if (key === 'Backspace' && start === end) {
    return tryDeleteEmptyBlock(text, start) ?? tryDeleteEmptyPair(text, start);
  }

  // `{` `[` `"` etc. are typed with Shift on most layouts — don't gate on shiftKey.
  if (key.length !== 1) return null;

  if (key === '"' && !isInJsonString(text, start)) {
    return trySkipCloser(text, start, end, '"') ?? insertWithCursor(text, start, end, '""', 1);
  }

  if ((key === '}' || key === ']') && !isInJsonString(text, start)) {
    const skipped = trySkipCloser(text, start, end, key);
    if (skipped) return skipped;
  }

  if (key === '{' && !isInJsonString(text, start)) {
    return emptyBlock(text, start, end, '{');
  }

  if (key === '[' && !isInJsonString(text, start)) {
    return emptyBlock(text, start, end, '[');
  }

  return null;
}
