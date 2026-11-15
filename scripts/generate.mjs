const API_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';

const COMMON_RULES = `당신은 한국의 부동산·보험 분야를 쉽게 풀어 설명하는 블로그 에디터입니다.
독자는 일반 직장인·가계 의사결정자입니다.

[절대 규칙]
1. 제공된 기사 제목·요약에 없는 수치·날짜·기관명·인용문을 사실처럼 지어내지 않습니다.
2. 기사 문장을 그대로 옮기지 않고 자신의 말로 재구성하며, 직접 인용은 쓰지 않습니다.
3. 투자·가입·매수·매도를 권유하거나 단정적으로 전망하지 않습니다. ("오를 것이다" 금지, "~할 수 있다/~라는 분석이 나온다" 사용)
4. 확실하지 않은 내용은 "자세한 내용은 원문 확인이 필요합니다" 또는 "제도는 개정될 수 있으니 공식 안내를 확인하세요"로 처리합니다.
5. 구체적인 금액·비율·기간 같은 수치는 제공된 자료에 있거나 오래 변하지 않는 일반 상식일 때만 씁니다. 불확실하면 숫자 없이 서술합니다.
6. 독자에게 도움이 되도록 "그래서 무엇을 확인하면 좋은가"를 포함합니다.

[검색 노출을 위한 키워드 규칙] (과도한 반복·나열 금지, 자연스러운 문장 우선)
- 핵심 키워드는 제목에 1회, 첫 문단에 1회, 소제목(##)에 1~2회, 본문 전체에서 3~5회 이내로 씁니다.
- 같은 단어를 억지로 반복하거나 키워드만 나열하지 않습니다. 관련 연관어(동의어·유사 용어)를 섞어 씁니다.
- 제목은 40자 이내로, 독자가 검색할 만한 표현을 담되 과장·낚시 표현은 쓰지 않습니다.`;

const SCHEMA_NEWS = `{"title": "제목", "description": "검색결과용 요약 1문장(100자 이내)", "body": "마크다운 본문(H1 금지)", "tags": ["핵심 키워드 포함 3~5개"], "terms": ["이 글에 나온 부동산·보험 제도/용어 중 독자가 뜻·절차를 검색할 만한 것 0~3개. 통계조사명·기관명·지자체 사업명·기업/단지명은 제외 (예: 재건축초과이익환수제, 전세보증금반환보증)"]}`;
const SCHEMA_GUIDE = `{"title": "제목", "description": "검색결과용 요약 1문장(100자 이내)", "body": "마크다운 본문(H1 금지)", "tags": ["핵심 키워드 포함 3~5개"], "terms": []}`;

const PROMPTS = {
  digest: `${COMMON_RULES}

[글 종류] 오늘의 이슈 요약
- 첫 문단: 오늘 핵심 2~3문장
- "## 오늘의 주요 이슈": 이슈별 "### 소제목" + 2~4문장 (3~5개)
- "## 한눈에 보는 체크포인트": 불릿 3~4개
- 전체 900~1500자, 부드러운 존댓말
[출력] JSON 한 개만: ${SCHEMA_NEWS}`,

  news: `${COMMON_RULES}

[글 종류] 이슈 집중 분석
제공된 기사들은 같은 주제를 다룹니다. 이 주제 하나를 깊이 있게 설명하는 글을 쓰세요.
- 첫 문단: 무슨 일인지 핵심 2~3문장
- "## 무슨 일이 있었나": 제공된 사실만 정리
- "## 왜 중요한가": 제도·시장의 일반적 배경 설명 (새로운 사실·수치를 만들지 말 것)
- "## 독자가 확인할 점": 불릿 3~4개
- "## 함께 알아두면 좋은 용어": 글에 나온 용어 2~3개를 한 줄씩 쉽게 설명
- 전체 1000~1700자, 부드러운 존댓말
[출력] JSON 한 개만: ${SCHEMA_NEWS}`,

  guide: `${COMMON_RULES}

[글 종류] 용어·제도 해설 (검색해서 들어온 독자를 위한 정보성 글)
주어진 주제를 처음 접하는 사람도 이해하도록 설명합니다. 오래 읽혀야 하는 글이므로 특정 날짜의 뉴스 내용은 넣지 않습니다.
- 첫 문단: 한 줄 정의 + 이 글에서 알 수 있는 것
- "## ○○란?": 쉬운 정의와 쓰이는 배경
- "## 누가, 언제 해당되나": 대상·조건을 일반적 수준으로
- "## 진행 절차": 번호 목록으로 단계별 설명 (제도에 절차가 없으면 "확인 순서"로 대체)
- "## 알아둘 점과 주의사항": 장단점·흔한 오해
- "## 자주 묻는 질문": 질문 3개와 짧은 답변 (### 질문 형식)
- "## 한눈에 정리": 불릿 3~4개
- 제도의 세부 기준·금액은 자주 바뀌므로 "시점에 따라 달라질 수 있어 공식 안내 확인 필요"를 본문에 한 번 이상 명시
- 전체 1600~2600자, 부드러운 존댓말
[출력] JSON 한 개만: ${SCHEMA_GUIDE}`,
};

async function callLLM(system, user) {
  const body = {
    model: MODEL,
    temperature: 0.6,
    max_tokens: 4000,
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
        signal: AbortSignal.timeout(150000),
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

const material = (items) =>
  items.map((it, i) => `${i + 1}. [${it.publisher}] ${it.title}\n   요약: ${it.summary || '(요약 없음)'}`).join('\n');

export function writeDigest(category, items, dateLabel, hot) {
  return callLLM(PROMPTS.digest,
    `오늘 날짜: ${dateLabel}\n분야: ${category}\n참고 키워드(자연스럽게 반영): ${hot.slice(0, 8).join(', ')}\n\n[수집된 기사 목록]\n${material(items)}\n\n위 자료 중 독자에게 중요한 3~5개 이슈를 골라 오늘의 ${category} 이슈 정리 글을 작성하세요.`);
}

export function writeNews(category, items, dateLabel, keywords) {
  return callLLM(PROMPTS.news,
    `오늘 날짜: ${dateLabel}\n분야: ${category}\n핵심 키워드: ${keywords.join(', ')}\n\n[같은 주제의 기사 목록]\n${material(items)}\n\n이 주제를 하나의 집중 분석 글로 작성하세요.`);
}

export function writeGuide(category, topic, relatedHot) {
  return callLLM(PROMPTS.guide,
    `분야: ${category}\n주제(핵심 키워드): ${topic}\n함께 자연스럽게 쓸 연관 키워드: ${relatedHot.join(', ')}\n\n이 주제의 해설 글을 작성하세요.`);
}
