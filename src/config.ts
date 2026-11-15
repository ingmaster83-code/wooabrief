export const SITE_NAME = '우아브리핑';
export const SITE_ICON = '📰';
export const SITE_DOMAIN = 'wooabrief.wooahouse.com';
export const SITE_TITLE = '우아브리핑 - 오늘의 부동산·보험 이슈 정리';
export const SITE_DESC = '부동산·보험 분야의 오늘 이슈를 매일 아침 쉽게 정리해 드립니다. 전세·청약·대출·실손보험 등 생활 금융 소식을 한눈에.';
export const CATEGORIES = ['부동산', '보험'] as const;
export const CONTACT_EMAIL = 'ingmaster83@gmail.com';

export const ADSENSE_CLIENT = 'ca-pub-6464921081676309';
export const GA_ID = 'G-9ZGENFSXWC';
export const AD_SLOT_BANNER = '7080296704';
export const AD_SLOT_SIDEBAR = '1419180025';

export const DISCLAIMER =
  '본 글은 공개된 보도 내용을 바탕으로 정리한 정보 제공 목적의 글이며, 투자·가입·계약을 권유하지 않습니다. 정확한 내용은 반드시 원문과 공식 기관 안내를 확인하세요.';

export const KIND_LABEL = { digest: '오늘의 이슈', news: '이슈 분석', guide: '용어·제도 해설' } as const;

// 글 하단 "공식 확인처" (신뢰도·독자 편의용, 실제 공식 사이트만)
export const OFFICIAL_LINKS: Record<string, { name: string; url: string }[]> = {
  부동산: [
    { name: '청약홈', url: 'https://www.applyhome.co.kr' },
    { name: '국토교통부', url: 'https://www.molit.go.kr' },
    { name: '국가법령정보센터', url: 'https://www.law.go.kr' },
    { name: '정부24', url: 'https://www.gov.kr' },
  ],
  보험: [
    { name: '금융감독원', url: 'https://www.fss.or.kr' },
    { name: '생명보험협회', url: 'https://www.klia.or.kr' },
    { name: '손해보험협회', url: 'https://www.knia.or.kr' },
    { name: '국가법령정보센터', url: 'https://www.law.go.kr' },
  ],
};

// 부동산·보험과 관련 있는 자매 사이트 (푸터 링크)
export const SISTER_SITES = [
  { name: '우아청약', url: 'https://wooaaptpass.wooahouse.com' },
  { name: '우아분양', url: 'https://wooabunyang.wooahouse.com' },
  { name: '우아세금', url: 'https://wooatax.wooahouse.com' },
  { name: '우아대출', url: 'https://wooaloan.wooahouse.com' },
  { name: '우아보조금', url: 'https://wooabojopass.wooahouse.com' },
];
