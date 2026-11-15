import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { collect, loadSeen, saveSeen, linkHash } from './collect.mjs';
import { writePost } from './generate.mjs';

const DRY = process.argv.includes('--dry'); // 수집 결과만 보고 글은 쓰지 않음
const MIN_ITEMS = 3; // 새 기사가 이보다 적으면 그 분야는 오늘 건너뜀
const MAX_ITEMS = 12; // 모델에 넘기는 최대 기사 수
const POSTS_DIR = new URL('../src/content/posts/', import.meta.url);

const sources = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'));
const seen = loadSeen();

// 한국 시간 기준 날짜
const kst = new Date(Date.now() + 9 * 3600 * 1000);
const ymd = kst.toISOString().slice(0, 10);
const dateLabel = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
const CAT_SLUG = { 부동산: 'realestate', 보험: 'insurance' };

const collected = await collect(sources, seen);

for (const [cat, all] of Object.entries(collected)) {
  console.log(`[${cat}] 신규 기사 ${all.length}건`);
  if (DRY) { all.slice(0, 5).forEach((it) => console.log(`   - (${it.publisher}) ${it.title}`)); continue; }

  const file = new URL(`${ymd}-${CAT_SLUG[cat]}.md`, POSTS_DIR);
  if (existsSync(file)) { console.log(`   이미 오늘 글이 있어 건너뜀`); continue; }
  if (all.length < MIN_ITEMS) { console.log(`   기사가 부족해 건너뜀 (최소 ${MIN_ITEMS}건)`); continue; }

  const items = all.slice(0, MAX_ITEMS);
  try {
    const post = await writePost(cat, items, dateLabel);
    const esc = (s) => JSON.stringify(s); // YAML 안전한 문자열
    const sourcesYaml = items
      .map((it) => `  - { title: ${esc(it.title)}, link: ${esc(it.link)}, publisher: ${esc(it.publisher)} }`)
      .join('\n');
    const md = `---\ntitle: ${esc(post.title)}\ndescription: ${esc(post.description)}\ndate: ${ymd}\ncategory: ${cat}\nsources:\n${sourcesYaml}\n---\n\n${post.body}\n`;
    writeFileSync(file, md);
    items.forEach((it) => (seen[linkHash(it.link)] = Date.now()));
    console.log(`   발행: ${post.title}`);
  } catch (e) {
    console.error(`   [${cat}] 글 작성 실패: ${e.message}`);
    process.exitCode = 1;
  }
}

if (!DRY) saveSeen(seen);
