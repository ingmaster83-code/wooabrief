const API_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';

const SYSTEM = `당신은 한국의 부동산·보험 분야를 쉽게 풀어 설명하는 블로그 에디터입니다.
독자는 일반 직장인·가계 의사결정자입니다. 아래 규칙을 반드시 지키세요.

[절대 규칙]
1. 제공된 기사 제목·요약에 있는 사실만 사용합니다. 없는 수치·날짜·기관명·인용문을 지어내지 않습니다.
2. 기사 문장을 그대로 옮기지 않고 자신의 말로 재구성합니다. 직접 인용은 쓰지 않습니다.
3. 투자·가입·매수·매도를 권유하거나 단정적으로 전망하지 않습니다. ("오를 것이다" 금지, "~할 수 있다/~라는 분석이 나온다" 사용)
4. 요약만으로 확실하지 않은 내용은 "자세한 내용은 원문 확인이 필요합니다"로 처리합니다.
5. 독자에게 도움이 되도록 "그래서 무엇을 확인하면 좋은가" 체크포인트를 포함합니다.

[글 구조] (마크다운, 본문에 H1은 쓰지 않음)
- 첫 문단: 오늘 핵심을 2~3문장으로
- "## 오늘의 주요 이슈": 이슈별 "### 소제목" + 2~4문장 설명 (3~5개 이슈)
- "## 한눈에 보는 체크포인트": 불릿 3~4개
- 문체: 부드러운 존댓말, 전체 900~1500자

[출력] 아래 JSON 한 개만 출력:
{"title": "클릭하고 싶지만 과장 없는 제목(40자 이내)", "description": "검색결과용 요약 1문장(100자 이내)", "body": "마크다운 본문"}`;

export async function writePost(category, items, dateLabel) {
  const material = items
    .map((it, i) => `${i + 1}. [${it.publisher}] ${it.title}\n   요약: ${it.summary || '(요약 없음)'}`)
    .join('\n');

  const body = {
    model: MODEL,
    temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `오늘 날짜: ${dateLabel}\n분야: ${category}\n\n[수집된 기사 목록]\n${material}\n\n위 자료 중 독자에게 중요한 3~5개 이슈를 골라 오늘의 ${category} 이슈 정리 글을 작성하세요.` },
    ],
  };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = await res.json();
      const parsed = JSON.parse(json.choices[0].message.content);
      if (!parsed.title || !parsed.body) throw new Error('응답에 title/body 없음');
      return {
        title: String(parsed.title).trim(),
        description: String(parsed.description || '').trim(),
        body: String(parsed.body).trim(),
      };
    } catch (e) {
      lastErr = e;
      console.warn(`[generate] 시도 ${attempt} 실패: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw lastErr;
}
