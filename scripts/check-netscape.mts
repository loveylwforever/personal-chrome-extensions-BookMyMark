/**
 * Self-check for Netscape bookmark HTML parse/serialize.
 * Run: node --experimental-strip-types scripts/check-netscape.mts
 */
import {
  parseNetscapeBookmarks,
  serializeNetscapeBookmarks,
} from '../src/modules/bookmarks/netscape.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>书签栏</H3>
    <DL><p>
        <DT><H3>工作</H3>
        <DL><p>
            <DT><A HREF="https://example.com/a">Example A</A>
            <DT><H3>文档</H3>
            <DL><p>
                <DT><A HREF="https://example.com/b">Example B</A>
            </DL><p>
        </DL><p>
    </DL><p>
</DL><p>
`;

const parsed = parseNetscapeBookmarks(sample);
const bar = parsed.children[0];
assert(bar?.name === '书签栏', 'root folder name');
assert(bar?.children[0]?.name === '工作', 'work folder');
assert(bar?.children[0]?.bookmarks[0]?.url === 'https://example.com/a', 'bookmark a');
assert(
  bar?.children[0]?.children[0]?.bookmarks[0]?.url === 'https://example.com/b',
  'nested bookmark',
);

const html = serializeNetscapeBookmarks([
  {
    name: '书签栏',
    bookmarks: [{ title: 'Home', url: 'https://example.com' }],
    children: [],
  },
]);
assert(html.includes('NETSCAPE-Bookmark-file-1'), 'doctype');
assert(html.includes('https://example.com'), 'exported url');

console.log('netscape check ok');
