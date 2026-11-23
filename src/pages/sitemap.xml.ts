import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CATEGORIES } from '../config';
import { ALL_SUBS, subOf } from '../lib/posts';

// 네이버·구글이 바로 읽을 수 있는 단일 /sitemap.xml
export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://wooabrief.wooahouse.com')).origin;
  const posts = await getCollection('posts');
  const latest = posts.map((p) => p.data.date.valueOf()).sort((a, b) => b - a)[0];
  const day = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : undefined);

  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${origin}/`, lastmod: day(latest) },
    ...CATEGORIES.map((c) => ({ loc: `${origin}/category/${encodeURIComponent(c)}/`, lastmod: day(latest) })),
    { loc: `${origin}/guide/`, lastmod: day(latest) },
    { loc: `${origin}/issues/`, lastmod: day(latest) },
    ...ALL_SUBS.filter((s) => posts.some((p) => p.data.category === s.category && subOf(p).slug === s.slug)).map((s) => ({ loc: `${origin}/topic/${s.slug}/`, lastmod: day(latest) })),
    { loc: `${origin}/about/` },
    { loc: `${origin}/privacy/` },
    ...posts.map((p) => ({ loc: `${origin}/posts/${p.id}/`, lastmod: day(p.data.date.valueOf()) })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
    `\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
