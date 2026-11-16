import { defineConfig } from 'astro/config';
import remarkInternalLinks from './scripts/remark-internal-links.mjs';

// 커스텀 도메인(wooabrief.wooahouse.com) 기준. 다른 주소에서 미리 볼 때만 환경변수로 덮어쓴다.
// 사이트맵은 src/pages/sitemap.xml.ts 가 /sitemap.xml 로 직접 만든다.
export default defineConfig({
  site: process.env.SITE_URL || 'https://wooabrief.wooahouse.com',
  base: process.env.BASE_PATH || '/',
  markdown: { remarkPlugins: [remarkInternalLinks] },
});
