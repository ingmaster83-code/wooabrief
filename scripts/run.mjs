import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { collect, loadSeen, saveSeen, linkHash } from './collect.mjs';
import { writeDigest, writeNews, writeGuide } from './generate.mjs';

/**
 * 한 번 실행 = 글 최대 1편 발행 (GitHub Actions가 30분마다 호출)
 *  1) 오늘 일일 요약(digest)이 아직 없으면 → 요약 글
 *  2) 그 외에는 뉴스 집중 분석(news) ↔ 용어·제도 해설(guide)을 번갈아 발행
 *     - 뉴스 글에서 나온 용어는 해설 대기열에 들어가 우선 작성됨
 *  3) 하루 최대 편수(MAX_POSTS_PER_DAY)를 넘으면 쉬어감
 */
const DRY = process.argv.includes('--dry');
const MAX_PER_DAY = Number(process.env.MAX_POSTS_PER_DAY || 40);
const DIGEST_FROM_HOUR = 7; // KST 이후에 일일 요약 발행
const MIN_ITEMS_DIGEST = 3;
const MIN_BODY_CHARS = 700;
const POSTS_DIR = new URL('../src/content/posts/', import.meta.url);
const STATE_PATH = new URL('../data/state.json', import.meta.url);

const sources = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'));
const kw = JSON.parse(readFileSync(new URL('./keywords.json', import.meta.url), 'utf8'));
const CATS = Object.keys(sources);
const CAT_SLUG = { 부동산: 'realestate', 보험: 'insurance' };

const state = existsSync(STATE_PATH)
  ? JSON.parse(readFileSync(STATE_PATH, 'utf8'))
  : { lastKind: null, done: [], queue: [] };
state.done ||= []; state.queue ||= [];
const norm = (s) => s.replace(/\s+/g, '').toLowerCase();
const saveState = () => writeFileSync(STATE_PATH, JSON.stringify(state, null, 1));

// ── 시간(KST) ────────────────────────────────────────────
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600 * 1000);
const ymd = kst.toISOString().slice(0, 10);
const hhmm = kst.toISOString().slice(11, 16).replace(':', '');
const dateLabel = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;

// ── 기존 글 정보 ─────────────────────────────────────────
const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
const todayCount = files.filter((f) => f.startsWith(ymd)).length;
const existingTitles = new Set(
  files.map((f) => (readFileSync(new URL(f, POSTS_DIR), 'utf8').match(/^title: (.*)$/m)?.[1] ?? '')).filter(Boolean).map((t) => norm(t)),
);
const todayGuidesByCat = (cat) =>
  files.filter((f) => f.startsWith(ymd) && f.includes(`-${CAT_SLUG[cat]}-guide`)).length;

// ── 유틸 ─────────────────────────────────────────────────
function scoreItem(it, cat) {
  const hay = it.title + ' ' + it.summary;
  let s = 0;
  for (const k of kw.hot[cat]) {
    if (it.title.includes(k)) s += 2;
    else if (hay.includes(k)) s += 1;
  }
  return s;
}
const esc = (s) => JSON.stringify(s);

function publish({ cat, kind, slug, post, sourceItems = [], extraTags = [] }) {
  if (post.body.length < MIN_BODY_CHARS) throw new Error(`본문이 너무 짧음(${post.body.length}자)`);
  if (existingTitles.has(norm(post.title))) throw new Error('제목 중복');
  const tags = [...new Set([...post.tags, ...extraTags])].slice(0, 7);
  const srcYaml = sourceItems.length
    ? '\n' + sourceItems.map((it) => `  - { title: ${esc(it.title)}, link: ${esc(it.link)}, publisher: ${esc(it.publisher)} }`).join('\n')
    : ' []';
  const md =
    `---\ntitle: ${esc(post.title)}\ndescription: ${esc(post.description)}\ndate: ${now.toISOString()}\ncategory: ${cat}\nkind: ${kind}\ntags: ${JSON.stringify(tags)}\nsources:${srcYaml}\n---\n\n${post.body}\n`;
  writeFileSync(new URL(`${slug}.md`, POSTS_DIR), md);
  existingTitles.add(norm(post.title));
  console.log(`[발행:${kind}] (${cat}) ${post.title}`);
}

function enqueueTerms(cat, terms, fromSlug) {
  for (const t of terms) {
    const key = norm(t);
    if (state.done.includes(key) || state.queue.some((q) => norm(q.topic) === key)) continue;
    state.queue.push({ topic: t, category: cat, from: fromSlug });
    console.log(`   + 해설 대기열: ${t}`);
  }
}

// ── 작업들 ───────────────────────────────────────────────
async function tryDigest(collected) {
  if (kst.getUTCHours() < DIGEST_FROM_HOUR) return false;
  for (const cat of CATS) {
    const slug = `${ymd}-${CAT_SLUG[cat]}`; // 기존 일일 요약 파일명 규칙 유지
    if (existsSync(new URL(`${slug}.md`, POSTS_DIR))) continue;
    const items = collected[cat].slice(0, 12);
    if (items.length < MIN_ITEMS_DIGEST) continue;
    const post = await writeDigest(cat, items, dateLabel, kw.hot[cat]);
    publish({ cat, kind: 'digest', slug, post, sourceItems: items });
    // 요약은 기사 '사용 처리'를 하지 않는다 (같은 기사로 집중 분석 글을 따로 씀)
    state.lastKind = 'digest';
    enqueueTerms(cat, post.terms, slug);
    return true;
  }
  return false;
}

async function tryNews(collected, seen) {
  // 가장 키워드 점수가 높은 기사를 시드로 고른다
  let best = null;
  for (const cat of CATS) {
    for (const it of collected[cat]) {
      const s = scoreItem(it, cat);
      if (s >= 2 && (!best || s > best.s)) best = { cat, it, s };
    }
  }
  if (!best) return false;
  const { cat, it: seed } = best;
  const seedKeys = kw.hot[cat].filter((k) => (seed.title + seed.summary).includes(k));
  const related = collected[cat]
    .filter((x) => x !== seed && seedKeys.some((k) => x.title.includes(k)))
    .slice(0, 3);
  const items = [seed, ...related];
  const slug = `${ymd}-${hhmm}-${CAT_SLUG[cat]}-news`;
  const post = await writeNews(cat, items, dateLabel, seedKeys.slice(0, 5));
  publish({ cat, kind: 'news', slug, post, sourceItems: items, extraTags: seedKeys.slice(0, 2) });
  items.forEach((x) => (seen[linkHash(x.link)] = Date.now()));
  state.lastKind = 'news';
  enqueueTerms(cat, post.terms, slug);
  return true;
}

async function tryGuide() {
  // 1순위: 뉴스에서 나온 용어, 2순위: 미리 정리한 주제 목록
  let pick = state.queue.shift();
  if (!pick) {
    const order = [...CATS].sort((a, b) => todayGuidesByCat(a) - todayGuidesByCat(b));
    for (const cat of order) {
      const topic = kw.seeds[cat].find((t) => !state.done.includes(norm(t)));
      if (topic) { pick = { topic, category: cat }; break; }
    }
  }
  if (!pick) return false;
  const cat = pick.category;
  state.done.push(norm(pick.topic));
  const slug = `${ymd}-${hhmm}-${CAT_SLUG[cat]}-guide`;
  const related = kw.hot[cat].filter((k) => !pick.topic.includes(k)).sort(() => Math.random() - 0.5).slice(0, 4);
  try {
    const post = await writeGuide(cat, pick.topic, related);
    publish({ cat, kind: 'guide', slug, post, extraTags: [pick.topic] });
  } catch (e) {
    state.done = state.done.filter((k) => k !== norm(pick.topic)); // 실패하면 다시 시도할 수 있게 되돌림
    if (pick.from) state.queue.unshift(pick);
    throw e;
  }
  state.lastKind = 'guide';
  return true;
}

// ── 실행 ─────────────────────────────────────────────────
if (todayCount >= MAX_PER_DAY) {
  console.log(`오늘 ${todayCount}편 발행 — 일일 한도(${MAX_PER_DAY}) 도달, 쉬어감`);
  process.exit(0);
}

const seen = loadSeen();
const collected = await collect(sources, seen);
for (const cat of CATS) console.log(`[${cat}] 신규 기사 ${collected[cat].length}건`);

if (DRY) {
  for (const cat of CATS) {
    collected[cat].map((it) => ({ it, s: scoreItem(it, cat) })).sort((a, b) => b.s - a.s).slice(0, 5)
      .forEach(({ it, s }) => console.log(`   [${s}점] (${it.publisher}) ${it.title}`));
  }
  console.log(`대기열 ${state.queue.length}개, 완료 주제 ${state.done.length}개, 오늘 ${todayCount}/${MAX_PER_DAY}편`);
  process.exit(0);
}

let published = false;
try {
  if (await tryDigest(collected)) published = true;
  else {
    const guideFirst = state.lastKind === 'news';
    const order = guideFirst ? ['guide', 'news'] : ['news', 'guide'];
    for (const job of order) {
      try {
        if (job === 'guide' ? await tryGuide() : await tryNews(collected, seen)) { published = true; break; }
      } catch (e) {
        console.error(`[${job}] 실패: ${e.message}`);
      }
    }
  }
} catch (e) {
  console.error(`실패: ${e.message}`);
}

if (published) { saveSeen(seen); saveState(); }
else console.log('이번 회차에는 발행할 글이 없음');
