const API_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';

// 종류별 최소 본문 길이(공백 포함). 이보다 짧으면 한 번 더 보강 요청
export const MIN_CHARS = { digest: 1500, news: 2200, guide: 3200 };

const COMMON_RULES = `당신은 한국의 부동산·보험 분야를 쉽게, 그리고 깊이 있게 풀어 설명하는 전문 블로그 에디터입니다.
독자는 일반 직장인·가계 의사결정자이며, 이 글 하나로 궁금증이 해결되기를 바랍니다. 얕은 요약이 아니라 "읽고 나면 실제로 무엇을 해야 하는지 아는" 글을 씁니다.

[사실 규칙]
1. 제공된 기사 제목·요약에 없는 수치·날짜·기관명·인용문을 사실처럼 지어내지 않습니다.
2. 기사 문장을 그대로 옮기지 않고 자신의 말로 재구성하며, 직접 인용은 쓰지 않습니다.
3. 투자·가입·매수·매도를 권유하거나 단정적으로 전망하지 않습니다. ("오를 것이다" 금지, "~할 수 있다/~라는 분석이 나온다" 사용)
4. 제도의 세부 기준(금액·비율·기간·요건)은 자주 바뀌므로, 확신이 없으면 숫자를 쓰지 않고 "시점에 따라 달라질 수 있어 공식 안내 확인이 필요합니다"로 처리합니다.
5. 이해를 돕는 예시는 얼마든지 넣되, 반드시 "예를 들어 가정해 보면"처럼 가상의 상황임을 밝히고 계산이 쉬운 단순한 숫자를 씁니다. 실제 통계처럼 보이게 쓰지 않습니다.

[깊이 있는 글을 위한 규칙]
- 소제목(##)마다 최소 2개 이상의 문단으로 충분히 설명합니다. 한두 문장짜리 항목을 나열하지 않습니다.
- "왜 그런가(이유·원리)", "그래서 나에게 어떤 영향이 있나", "어떻게 확인·대응하나"를 빠뜨리지 않습니다.
- 관련 제도·용어와의 차이, 흔한 오해와 실수, 상황별(예: 세입자/집주인, 신규 가입자/기존 가입자) 유의점을 구체적으로 짚습니다.
- 관련 제도·상품은 줄임말 대신 정식 명칭으로 정확히 적습니다. (사이트 내 해설 글과 자동으로 연결됩니다)
- 비교가 필요하면 마크다운 표(| 항목 | A | B |)를 1개 이상 넣습니다.
- 체크리스트(- [ ] 형식이 아닌 일반 불릿)로 실행 항목을 정리합니다.

[검색 노출을 위한 키워드 규칙] (과도한 반복·나열 금지, 자연스러운 문장 우선)
- 핵심 키워드는 제목에 1회, 첫 문단에 1회, 소제목(##)에 1~2회, 본문 전체에서 5~8회 이내로 씁니다.
- 같은 단어를 억지로 반복하거나 키워드만 나열하지 않습니다. 관련 연관어(동의어·유사 용어)를 섞어 씁니다.
- 제목은 40자 이내로, 독자가 검색할 만한 표현을 담되 과장·낚시 표현은 쓰지 않습니다.
- 문체는 부드러운 존댓말, 문단은 3~5문장 정도로 읽기 편하게 나눕니다.`;

const SCHEMA_NEWS = `{"title": "제목", "description": "검색결과용 요약 1문장(100자 이내)", "body": "마크다운 본문(H1 금지)", "tags": ["핵심 키워드 포함 3~5개"], "terms": ["이 글에 나온 부동산·보험 제도/용어 중 독자가 뜻·절차를 검색할 만한 것 0~3개. 독립된 제도·상품·세금·대출 이름만 허용. 통계조사명·기관명·지자체 사업명·기업/단지명, 일반 명사·직함·행위(예: 시공사 수주, 입주 예정자)는 제외 (예: 재건축초과이익환수제, 전세보증금반환보증)"]}`;
const SCHEMA_GUIDE = `{"title": "제목", "description": "검색결과용 요약 1문장(100자 이내)", "body": "마크다운 본문(H1 금지)", "tags": ["핵심 키워드 포함 3~5개"], "terms": ["본문에 등장하는 연관 제도/용어 중 따로 해설할 만한 것 0~3개"]}`;

const PROMPTS = {
  digest: `${COMMON_RULES}

[글 종류] 오늘의 이슈 요약 (분량: 공백 포함 1800~2600자)
- 첫 문단: 오늘 핵심 3~4문장 + 이 글에서 알 수 있는 것
- "## 오늘의 주요 이슈": 이슈마다 "### 소제목" 아래 4~6문장 (무슨 일인지 → 왜 중요한지 → 독자에게 의미)
- "## 이슈 사이의 연결고리": 오늘 이슈들이 서로 어떻게 이어지는지 한 문단
- "## 한눈에 보는 체크포인트": 불릿 4~5개
[출력] JSON 한 개만: ${SCHEMA_NEWS}`,

  news: `${COMMON_RULES}

[글 종류] 이슈 집중 분석 (분량: 공백 포함 2600~3600자)
제공된 기사들은 같은 주제를 다룹니다. 이 주제 하나를 깊이 있게 설명하는 글을 쓰세요.
- 첫 문단: 무슨 일인지 핵심 3~4문장 + 이 글에서 알 수 있는 것
- "## 무슨 일이 있었나": 제공된 사실만 차분히 정리 (새로운 사실·수치를 만들지 말 것)
- "## 배경 이해하기": 이 이슈가 나오게 된 제도·시장의 일반적 배경과 원리를 쉽게 풀이
- "## 누구에게 어떤 영향이 있을까": 대상별(예: 실수요자, 세입자, 집주인, 가입자 등) 소제목(###)으로 나누어 설명하되 단정하지 말 것
- "## 앞으로 지켜볼 점": 확정되지 않은 사항과 확인해야 할 일정·발표를 정리
- "## 독자가 확인할 점": 실행 가능한 불릿 4~5개
- "## 함께 알아두면 좋은 용어": 글에 나온 용어 3개를 각각 3~4문장으로 설명
[출력] JSON 한 개만: ${SCHEMA_NEWS}`,

  guide: `${COMMON_RULES}

[글 종류] 용어·제도 해설 (분량: 공백 포함 3800~5200자)
검색해서 들어온 독자가 이 글 하나로 주제를 이해하도록 완결성 있게 씁니다. 오래 읽혀야 하는 글이므로 특정 날짜의 뉴스 내용은 넣지 않습니다.
- 첫 문단: 한 줄 정의 + 이 글에서 알 수 있는 것(목차 느낌으로 3~4가지)
- "## ○○란?": 쉬운 정의, 등장 배경, 왜 필요한지
- "## 핵심 개념 쉽게 이해하기": 어려운 용어를 일상적인 비유와 가정 예시로 설명
- "## 누가, 언제 해당되나": 대상·조건을 일반적 수준으로, 상황별 사례를 2~3개 가정으로 제시
- "## 진행 절차": 번호 목록으로 단계별 설명하고 각 단계에서 준비할 것과 주의점을 함께
- "## 비슷한 제도와 비교": 헷갈리기 쉬운 제도·상품과의 차이를 마크다운 표로 정리하고 표 아래에 해설
- "## 장점과 한계": 장단점과 흔한 오해를 각각 구체적으로
- "## 자주 하는 실수와 주의사항": 불릿 5개 이상, 각각 이유 포함
- "## 자주 묻는 질문": 질문 4~5개 (### 질문 형식), 답변은 각 3문장 이상
- "## 한눈에 정리": 불릿 5개
- 제도의 세부 기준·금액은 "시점에 따라 달라질 수 있어 공식 안내 확인이 필요합니다"를 본문에 두 번 이상 명시
[출력] JSON 한 개만: ${SCHEMA_GUIDE}`,
};

async function callLLM(system, user) {
  const body = {
    model: MODEL,
    temperature: 0.6,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = await res.json();
      const parsed = JSON.parse(json.choices[0].message.content);
      if (!parsed.title || !parsed.body) throw new Error('응답에 title/body 없음');
      return {
        title: String(parsed.title).trim(),
        description: String(parsed.description || '').trim(),
        body: String(parsed.body).trim(),
        tags: (Array.isArray(parsed.tags) ? parsed.tags : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 6),
        terms: (Array.isArray(parsed.terms) ? parsed.terms : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 3),
      };
    } catch (e) {
      lastErr = e;
      console.warn(`[generate] 시도 ${attempt} 실패: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw lastErr;
}

/** 초안이 최소 분량보다 짧으면, 사실 규칙은 그대로 두고 내용을 더 풍부하게 보강시킨다 (최대 1회) */
async function withExpand(kind, draft, userContext) {
  if (draft.body.length >= MIN_CHARS[kind]) return draft;
  console.log(`   초안이 짧음(${draft.body.length}자) → 보강 요청`);
  try {
    const better = await callLLM(
      PROMPTS[kind],
      `${userContext}\n\n[기존 초안 — 분량과 깊이가 부족합니다]\n제목: ${draft.title}\n${draft.body}\n\n위 초안의 구조와 사실 규칙은 유지하되, 각 소제목의 설명을 더 구체적이고 풍부하게 늘리고 사례·비교·주의사항을 보강해 처음부터 다시 완성된 글로 작성하세요. 분량은 반드시 ${MIN_CHARS[kind]}자 이상이어야 합니다.`,
    );
    return better.body.length > draft.body.length ? better : draft;
  } catch (e) {
    console.warn(`   보강 실패, 초안 사용: ${e.message}`);
    return draft;
  }
}

const material = (items) =>
  items.map((it, i) => `${i + 1}. [${it.publisher}] ${it.title}\n   요약: ${it.summary || '(요약 없음)'}`).join('\n');

export async function writeDigest(category, items, dateLabel, hot) {
  const ctx = `오늘 날짜: ${dateLabel}\n분야: ${category}\n참고 키워드(자연스럽게 반영): ${hot.slice(0, 8).join(', ')}\n\n[수집된 기사 목록]\n${material(items)}\n\n위 자료 중 독자에게 중요한 3~5개 이슈를 골라 오늘의 ${category} 이슈 정리 글을 작성하세요.`;
  return withExpand('digest', await callLLM(PROMPTS.digest, ctx), ctx);
}

export async function writeNews(category, items, dateLabel, keywords) {
  const ctx = `오늘 날짜: ${dateLabel}\n분야: ${category}\n핵심 키워드: ${keywords.join(', ')}\n\n[같은 주제의 기사 목록]\n${material(items)}\n\n이 주제를 하나의 집중 분석 글로 작성하세요.`;
  return withExpand('news', await callLLM(PROMPTS.news, ctx), ctx);
}

export async function writeGuide(category, topic, relatedHot) {
  const ctx = `분야: ${category}\n주제(핵심 키워드): ${topic}\n함께 자연스럽게 쓸 연관 키워드: ${relatedHot.join(', ')}\n\n이 주제의 해설 글을 작성하세요.`;
  return withExpand('guide', await callLLM(PROMPTS.guide, ctx), ctx);
}
