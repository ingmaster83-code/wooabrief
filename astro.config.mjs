import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 커스텀 도메인(wooabrief.wooahouse.com) 기준. 다른 주소에서 미리 볼 때만 환경변수로 덮어쓴다.
export default defineConfig({
  site: process.env.SITE_URL || 'https://wooabrief.wooahouse.com',
  base: process.env.BASE_PATH || '/',
  integrations: [sitemap()],
});
