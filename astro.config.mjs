import { defineConfig } from 'astro/config';

// GitHub Pages 배포 시 워크플로가 SITE_URL / BASE_PATH 를 주입한다.
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:8775',
  base: process.env.BASE_PATH || '/',
});
