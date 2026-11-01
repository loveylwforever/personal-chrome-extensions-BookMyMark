import { parseJsonText } from './json-parse';

export interface JsonDiag {
  /** Raw engine message */
  message: string;
  /** 0-based index into the original (untrimmed) text, or null */
  position: number | null;
  /** 1-based line */
  line: number | null;
  /** 1-based column */
  column: number | null;
  /** The line text containing the error */
  lineText: string;
  /** Compact snippet with a caret line for display */
  snippet: string;
  /** Short tip key suffix under tools.jsonTip.* or empty */
  tipKey:
    | 'end'
    | 'trailingComma'
    | 'singleQuote'
    | 'propertyName'
    | 'after'
    | 'token'
    | '';
}

export type JsonDiagnoseResult =
  | { ok: true; value: unknown; pretty: string }
  | { ok: false; diag: JsonDiag };

function offsetToLineCol(text: string, offset: number): {
  line: number;
  column: number;
  lineText: string;
  lineStart: number;
} {
  const safe = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < safe; i++) {
    if (text[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  const lineEnd = text.indexOf('\n', lineStart);
  const lineText = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  return {
    line,
    column: safe - lineStart + 1,
    lineText,
    lineStart,
  };
}

function buildSnippet(lineText: string, column: number): string {
  const max = 72;
  let start = 0;
  let shown = lineText;
  let col = column;
  if (lineText.length > max) {
    start = Math.max(0, column - 1 - 28);
    shown = (start > 0 ? '…' : '') + lineText.slice(start, start + max);
    if (start + max < lineText.length) shown += '…';
    col = column - start + (start > 0 ? 1 : 0);
  }
  const caretPad = Math.max(0, col - 1);
  return `${shown}\n${' '.repeat(caretPad)}^`;
}

function classifyTip(message: string, text: string, position: number | null): JsonDiag['tipKey'] {
  const m = message.toLowerCase();
  if (position !== null) {
    const around = text.slice(Math.max(0, position - 3), Math.min(text.length, position + 2));
    if (/,\s*[}\]]/.test(around)) return 'trailingComma';
  }
  if (m.includes('unexpected end')) return 'end';
  if (m.includes("expected ',' or '}'") || m.includes("expected ',' or ']'")) return 'end';
  if (/unexpected token\s+'/i.test(message)) return 'singleQuote';
  if (m.includes('expected property name') || m.includes('expected double-quoted property name')) {
    return 'propertyName';
  }
  if (m.includes('after json') || m.includes('non-whitespace character after')) {
    return 'after';
  }
  if (m.includes('unexpected token')) return 'token';
  return '';
}

function parsePosition(message: string, textLen: number): number | null {
  const match = message.match(/position\s+(\d+)/i);
  if (match) return Number(match[1]);
  if (/unexpected end of json input/i.test(message)) return textLen;
  return null;
}

/** Diagnose JSON text; positions map to the original string (leading whitespace adjusted). */
export function diagnoseJson(text: string): JsonDiagnoseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, value: null, pretty: '' };
  }

  const lead = text.length - text.trimStart().length;
  const parsed = parseJsonText(text);
  if (parsed.ok) {
    return {
      ok: true,
      value: parsed.value,
      pretty: trimmed ? JSON.stringify(parsed.value, null, 2) : '',
    };
  }

  try {
    JSON.parse(trimmed);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const trimmedPos = parsePosition(message, trimmed.length);
    const position =
      trimmedPos === null ? null : Math.min(text.length, trimmedPos + lead);
    const tipKey = classifyTip(message, text, position);

    if (position === null) {
      return {
        ok: false,
        diag: {
          message,
          position: null,
          line: null,
          column: null,
          lineText: '',
          snippet: '',
          tipKey,
        },
      };
    }

    const { line, column, lineText } = offsetToLineCol(text, position);
    return {
      ok: false,
      diag: {
        message,
        position,
        line,
        column,
        lineText,
        snippet: buildSnippet(lineText, column),
        tipKey,
      },
    };
  }

  return {
    ok: false,
    diag: {
      message: parsed.error,
      position: null,
      line: null,
      column: null,
      lineText: '',
      snippet: '',
      tipKey: '',
    },
  };
}
