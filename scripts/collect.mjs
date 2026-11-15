import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true });
const SEEN_PATH = new URL('../data/seen.json', import.meta.url);
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

const stripHtml = (s = '') =>
  String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const text = (v) => (typeof v === 'object' && v !== null ? (v['#text'] ?? '') : (v ?? ''));
const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16);

export function loadSeen() {
  return existsSync(SEEN_PATH) ? JSON.parse(readFileSync(SEEN_PATH, 'utf8')) : {};
}
export function saveSeen(seen) {
  // 30일 지난 기록은 정리
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const k of Object.keys(seen)) if (seen[k] < cutoff) delete seen[k];
  writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 0));
}

async function fetchFeed(src) {
  const res = await fetch(src.url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; infoblog-bot/0.1)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${src.publisher} HTTP ${res.status}`);
  const xml = await res.text();
  const items = parser.parse(xml)?.rss?.channel?.item ?? [];
  return (Array.isArray(items) ? items : [items]).map((it) => ({
    title: stripHtml(text(it.title)),
    link: String(text(it.link)).trim(),
    // 본문 전체가 아닌 짧은 요약문만 사용 (저작권 안전)
    summary: stripHtml(text(it.description)).slice(0, 220),
    publishedAt: Date.parse(text(it.pubDate)) || Date.now(),
    publisher: src.publisher,
  }));
}

/** 카테고리별 신규 기사 목록 수집 (중복·오래된 기사·키워드 불일치 제외) */
export async function collect(sourcesByCat, seen) {
  const out = {};
  for (const [cat, sources] of Object.entries(sourcesByCat)) {
    const bucket = [];
    for (const src of sources) {
      try {
        const items = await fetchFeed(src);
        for (const it of items) {
          if (!it.title || !it.link) continue;
          if (Date.now() - it.publishedAt > MAX_AGE_MS) continue;
          if (src.keywords && !src.keywords.some((k) => (it.title + it.summary).includes(k))) continue;
          if (seen[hash(it.link)]) continue;
          bucket.push(it);
        }
      } catch (e) {
        console.warn(`[collect] ${cat}/${src.publisher} 실패: ${e.message}`);
      }
    }
    // 같은 링크·거의 같은 제목 중복 제거
    const uniq = new Map();
    for (const it of bucket) {
      const key = it.title.replace(/[\s\[\]\(\)'"‘’“”·…,.]/g, '').slice(0, 18);
      if (!uniq.has(key)) uniq.set(key, it);
    }
    out[cat] = [...uniq.values()].sort((a, b) => b.publishedAt - a.publishedAt);
  }
  return out;
}

export const linkHash = hash;
