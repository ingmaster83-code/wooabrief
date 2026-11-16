import { readdirSync, readFileSync } from 'node:fs';

/**
 * 빌드할 때 글 본문 속 키워드를 같은 사이트의 '용어·제도 해설' 글로 자동 연결한다.
 *  - AI가 주소를 지어내지 않도록, 실제 존재하는 글의 태그(키워드)만 앵커로 쓴다
 *  - 같은 분야 해설 글만 대상, 글마다 최대 MAX_LINKS개, 같은 대상은 1번만
 *  - 제목·표·코드·이미 있는 링크 안에서는 걸지 않는다
 */
const POSTS_DIR = new URL('../src/content/posts/', import.meta.url);
const MAX_LINKS = 4;
const MIN_PHRASE = 4;
const SKIP = new Set(['heading', 'link', 'linkReference', 'code', 'inlineCode', 'table', 'html']);

function loadTargets() {
  const targets = [];
  for (const f of readdirSync(POSTS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const raw = readFileSync(new URL(f, POSTS_DIR), 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    if (!/^kind: guide\s*$/m.test(fm)) continue;
    const category = fm.match(/^category: (.+?)\s*$/m)?.[1];
    // 앵커는 해설 글의 '주제어(topic)'만 쓴다 (연관 태그까지 쓰면 엉뚱한 글로 연결됨)
    let topic = '';
    try { topic = JSON.parse(fm.match(/^topic: (".*")\s*$/m)?.[1] ?? '""'); } catch {}
    const phrases = new Set();
    const p = topic.trim();
    if (p.length >= MIN_PHRASE) { phrases.add(p); phrases.add(p.replace(/\s+/g, '')); }
    if (phrases.size) targets.push({ id: f.replace(/\.md$/, ''), category, phrases: [...phrases] });
  }
  return targets;
}

export default function remarkInternalLinks() {
  const targets = loadTargets();
  return (tree, file) => {
    const path = String(file.path || file.history?.[0] || '').replace(/\\/g, '/');
    const selfId = path.split('/').pop()?.replace(/\.md$/, '');
    const raw = String(file.value ?? '');
    const category = raw.match(/^category: (.+?)\s*$/m)?.[1];
    const used = new Set();
    let count = 0;

    const cands = targets
      .filter((t) => t.id !== selfId && (!category || t.category === category))
      .map((t) => ({ ...t, phrases: [...t.phrases].sort((a, b) => b.length - a.length) }));

    function walk(node) {
      if (!node.children || SKIP.has(node.type)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'text' && count < MAX_LINKS) {
          const hit = findHit(child.value);
          if (hit) {
            const { start, end, target } = hit;
            const before = child.value.slice(0, start);
            const mid = child.value.slice(start, end);
            const after = child.value.slice(end);
            const repl = [];
            if (before) repl.push({ type: 'text', value: before });
            repl.push({ type: 'link', url: `/posts/${target.id}/`, title: null, children: [{ type: 'text', value: mid }] });
            if (after) repl.push({ type: 'text', value: after });
            node.children.splice(i, 1, ...repl);
            used.add(target.id);
            count++;
            i += repl.length - 1;
          }
        } else if (child.children) {
          walk(child);
        }
      }
    }

    function findHit(text) {
      let best = null;
      for (const t of cands) {
        if (used.has(t.id)) continue;
        for (const p of t.phrases) {
          const idx = text.indexOf(p);
          if (idx >= 0 && (!best || idx < best.start)) best = { start: idx, end: idx + p.length, target: t };
          if (idx >= 0) break;
        }
      }
      return best;
    }

    walk(tree);
  };
}
