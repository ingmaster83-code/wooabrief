import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;
export const PAGE_SIZE = 20;

/** 세부 주제(소분류). 제목·태그·주제어의 키워드로 자동 분류한다 (글 파일을 고칠 필요 없음) */
export const SUBS = {
  부동산: [
    { slug: 'subscription', name: '청약·분양', keywords: ['청약', '분양', '특별공급', '무순위', '입주자', '분양권', '중도금', '사전점검', '공공분양', '일반분양', '입주'] },
    { slug: 'loan', name: '대출·금리', keywords: ['대출', '금리', 'DSR', 'LTV', 'DTI', '코픽스', '디딤돌', '버팀목', '주택연금', '주담대', '잔금', '스트레스'] },
    { slug: 'tax', name: '세금', keywords: ['취득세', '양도세', '양도소득', '종부세', '종합부동산세', '재산세', '증여', '상속', '세금', '공시가격', '과세', '감면', '비과세'] },
    { slug: 'rent', name: '전월세·임대', keywords: ['전세', '월세', '임대', '보증금', '깡통', '역전세', '갱신', '전입신고', '확정일자', '행복주택', '임차', '집주인'] },
    { slug: 'redevelopment', name: '재건축·재개발', keywords: ['재건축', '재개발', '정비', '리모델링', '조합', '모아타운', '신속통합', '안전진단', '가로주택', '신도시', '시공사', '수주'] },
    { slug: 'market', name: '시장·정책', keywords: [] },
  ],
  보험: [
    { slug: 'health', name: '실손·건강', keywords: ['실손', '암보험', '암진단', '건강', '치아', '간병', '치매', '어린이', '태아', '산정특례', '간편심사', '입원', '수술', '비급여', '장기요양'] },
    { slug: 'auto', name: '자동차·운전자', keywords: ['자동차', '운전자', '자차', '대인', '대물', '자손', '다이렉트'] },
    { slug: 'life', name: '생명·연금', keywords: ['생명보험', '종신', '연금', '변액', 'IRP', '퇴직연금', '저축', '해약환급', '납입면제', '무배당', '유배당'] },
    { slug: 'property', name: '화재·배상·기타', keywords: ['화재', '배상', '펫', '여행자', '단체보험', '소상공인', '재산', '임차인'] },
    { slug: 'policy', name: '제도·이슈', keywords: [] },
  ],
} as const;

export type Category = keyof typeof SUBS;
export const ALL_SUBS = (Object.keys(SUBS) as Category[]).flatMap((cat) => SUBS[cat].map((s) => ({ ...s, category: cat })));

/** 글의 세부 주제 결정: 주제어·제목·태그에서 키워드가 가장 많이 걸린 소분류 (없으면 마지막 '시장·정책'/'제도·이슈') */
export function subOf(post: Post) {
  const list = SUBS[post.data.category as Category];
  const text = [post.data.topic ?? '', post.data.title, ...post.data.tags].join(' ');
  let best = list[list.length - 1];
  let bestScore = 0;
  for (const s of list) {
    let score = 0;
    for (const k of s.keywords) if (text.includes(k)) score++;
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return best;
}

export async function getSortedPosts() {
  return (await getCollection('posts')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf() || b.id.localeCompare(a.id),
  );
}

export const KINDS = {
  guide: { name: '용어·제도 해설', desc: '부동산·보험 용어와 제도를 쉽게 풀어 설명한 글 모음', match: (k: string) => k === 'guide' },
  issue: { name: '이슈·뉴스 분석', desc: '오늘의 이슈 요약과 이슈 집중 분석 글 모음', match: (k: string) => k !== 'guide' },
} as const;

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
